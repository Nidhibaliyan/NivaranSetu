/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore - proxy-addr is installed via express dependency
import proxyaddr from 'proxy-addr';

/**
 * Live Voice connection manager and rate-limiting safeguards for /api/live WebSocket.
 *
 * NOTE: These are server-process safeguards designed to protect resources
 * against connection flooding, orphaned streams, and runaway costs in development
 * and single-instance deployments.
 *
 * Production Limitation Notice:
 * - In multi-instance or clustered deployments behind a load balancer,
 *   in-memory counters are per-process and do not coordinate globally without a shared
 *   distributed store (e.g. Redis).
 * - IP-based controls can conflate multiple users behind shared enterprise/NAT gateways.
 *   These protections are a complement to, not a replacement for, authenticated per-user quotas.
 */

/**
 * Resolves normalized, secure client IP address.
 *
 * Security Model (DEF-02):
 * 1. When proxy trust is NOT configured (trustFn is null/undefined), strictly returns socket remote address.
 *    X-Forwarded-For headers from untrusted clients are 100% ignored.
 * 2. When proxy trust IS configured, evaluates proxy chain via proxyaddr to walk
 *    from the socket inward, selecting the first untrusted upstream hop rather than trusting index 0.
 * 3. Never trusts arbitrary client-supplied X-Forwarded-For values.
 */
export function getClientIp(
  req: any,
  trustFn?: ((addr: string, i: number) => boolean) | null
): string {
  if (!req) return '127.0.0.1';

  // 1. If no trust function is provided or proxy trust is inactive:
  // Strictly rely on the socket peer address. Ignore all X-Forwarded-* headers.
  if (!trustFn) {
    return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
  }

  // 2. If it's an Express request that already evaluated req.ip safely:
  if (typeof req.ip === 'string' && req.ip) {
    return req.ip;
  }

  // 3. For raw IncomingMessage (WebSocket upgrade) with proxy trust configured:
  try {
    const resolved = proxyaddr(req, trustFn);
    if (resolved) return resolved;
  } catch (_) {
    // Fall back to socket peer address on malformed inputs
  }

  return req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
}

export interface LiveVoiceLimitsConfig {
  maxGlobalConnections?: number;
  maxConnectionsPerIp?: number;
  maxSessionDurationMs?: number;
  maxAttemptsPerWindow?: number;
  attemptWindowMs?: number;
}

export interface CanConnectResult {
  allowed: boolean;
  reason?: 'RATE_LIMIT' | 'GLOBAL_CAPACITY' | 'IP_CAPACITY';
  message: string;
  statusCode: number;
}

export interface ActiveSessionRecord {
  id: string;
  clientIp: string;
  connectedAt: number;
  durationTimer: NodeJS.Timeout | null;
  cleanedUp: boolean;
  onDurationExpired?: () => void;
  upstreamSession?: { close?: () => void } | null;
}

export class LiveVoiceManager {
  readonly maxGlobalConnections: number;
  readonly maxConnectionsPerIp: number;
  readonly maxSessionDurationMs: number;
  readonly maxAttemptsPerWindow: number;
  readonly attemptWindowMs: number;

  private activeGlobalConnections = 0;
  private readonly activeConnectionsByIp = new Map<string, number>();
  private readonly connectionAttemptsByIp = new Map<string, number[]>();
  private readonly sessions = new Map<string, ActiveSessionRecord>();

  constructor(config: LiveVoiceLimitsConfig = {}) {
    this.maxGlobalConnections = config.maxGlobalConnections ?? 10;
    this.maxConnectionsPerIp = config.maxConnectionsPerIp ?? 1;
    this.maxSessionDurationMs = config.maxSessionDurationMs ?? 5 * 60 * 1000; // 5 minutes
    this.maxAttemptsPerWindow = config.maxAttemptsPerWindow ?? 5; // Max 5 attempts
    this.attemptWindowMs = config.attemptWindowMs ?? 60 * 1000; // per 1 minute
  }

  /**
   * Checks whether a new connection from the given IP is permitted under
   * attempt rate limits, global concurrency, and per-IP concurrency.
   */
  canConnect(clientIp: string): CanConnectResult {
    // 1. Check connection attempts rate limit
    if (!this.checkAttemptRate(clientIp)) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT',
        message: 'Too many Live Voice connection attempts. Please wait a minute before retrying.',
        statusCode: 429,
      };
    }

    // 2. Check global concurrency capacity
    if (this.activeGlobalConnections >= this.maxGlobalConnections) {
      return {
        allowed: false,
        reason: 'GLOBAL_CAPACITY',
        message: `Server Live Voice capacity reached (${this.maxGlobalConnections} active sessions). Please try again shortly.`,
        statusCode: 503,
      };
    }

    // 3. Check per-IP concurrent connection limit
    const currentIpCount = this.activeConnectionsByIp.get(clientIp) || 0;
    if (currentIpCount >= this.maxConnectionsPerIp) {
      return {
        allowed: false,
        reason: 'IP_CAPACITY',
        message: 'You already have an active Live Voice session. Only 1 connection per client IP is allowed.',
        statusCode: 429,
      };
    }

    return {
      allowed: true,
      message: 'Connection permitted',
      statusCode: 200,
    };
  }

  /**
   * Evaluates and records a connection attempt within the sliding window.
   */
  private checkAttemptRate(clientIp: string): boolean {
    const now = Date.now();
    const attempts = this.connectionAttemptsByIp.get(clientIp) || [];
    const recent = attempts.filter((t) => now - t < this.attemptWindowMs);

    if (recent.length >= this.maxAttemptsPerWindow) {
      this.connectionAttemptsByIp.set(clientIp, recent);
      return false;
    }

    return true;
  }

  /**
   * Records a connection attempt. Should be called when an upgrade request is received.
   */
  recordAttempt(clientIp: string): void {
    const now = Date.now();
    const attempts = this.connectionAttemptsByIp.get(clientIp) || [];
    const recent = attempts.filter((t) => now - t < this.attemptWindowMs);
    recent.push(now);
    this.connectionAttemptsByIp.set(clientIp, recent);
  }

  /**
   * Registers an active Live Voice session once the WebSocket is connected.
   * Increments global and per-IP counters and sets the 5-minute duration timer.
   * Returns an idempotent cleanup function.
   */
  registerSession(
    sessionId: string,
    clientIp: string,
    onDurationExpired?: () => void
  ): {
    success: boolean;
    cleanup: (reason?: string) => void;
    error?: string;
  } {
    // Re-verify limits in case of race between upgrade and connection
    if (this.activeGlobalConnections >= this.maxGlobalConnections) {
      return {
        success: false,
        cleanup: () => {},
        error: 'Global capacity limit reached.',
      };
    }

    const currentIpCount = this.activeConnectionsByIp.get(clientIp) || 0;
    if (currentIpCount >= this.maxConnectionsPerIp) {
      return {
        success: false,
        cleanup: () => {},
        error: 'Per-IP active connection limit reached.',
      };
    }

    // Acquire slots
    this.activeGlobalConnections++;
    this.activeConnectionsByIp.set(clientIp, currentIpCount + 1);

    // Setup session record and duration timer
    const sessionRecord: ActiveSessionRecord = {
      id: sessionId,
      clientIp,
      connectedAt: Date.now(),
      durationTimer: null,
      cleanedUp: false,
      onDurationExpired,
      upstreamSession: null,
    };

    if (this.maxSessionDurationMs > 0) {
      sessionRecord.durationTimer = setTimeout(() => {
        try {
          if (sessionRecord.onDurationExpired) {
            sessionRecord.onDurationExpired();
          }
        } finally {
          this.cleanupSession(sessionId, 'Duration timer expired');
        }
      }, this.maxSessionDurationMs);

      // Unref timer if running in Node to avoid preventing clean process exit
      if (typeof sessionRecord.durationTimer?.unref === 'function') {
        sessionRecord.durationTimer.unref();
      }
    }

    this.sessions.set(sessionId, sessionRecord);

    const cleanup = (reason = 'Normal close') => {
      this.cleanupSession(sessionId, reason);
    };

    return {
      success: true,
      cleanup,
    };
  }

  /**
   * Associates the upstream Gemini Live session for automated cleanup.
   */
  setUpstreamSession(sessionId: string, upstreamSession: { close?: () => void } | null): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.upstreamSession = upstreamSession;
    }
  }

  /**
   * Idempotent session cleanup.
   * Decrements counters, clears duration timer, closes upstream session, and removes from map.
   * Safe to call multiple times without causing negative counter drift.
   */
  cleanupSession(sessionId: string, _reason = 'Closed'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.cleanedUp) {
      return false;
    }

    session.cleanedUp = true;

    // 1. Decrement global connection count (bounded at 0)
    this.activeGlobalConnections = Math.max(0, this.activeGlobalConnections - 1);

    // 2. Decrement IP connection count
    const ipCount = this.activeConnectionsByIp.get(session.clientIp) || 0;
    if (ipCount <= 1) {
      this.activeConnectionsByIp.delete(session.clientIp);
    } else {
      this.activeConnectionsByIp.set(session.clientIp, ipCount - 1);
    }

    // 3. Clear duration timer
    if (session.durationTimer) {
      clearTimeout(session.durationTimer);
      session.durationTimer = null;
    }

    // 4. Close upstream session if still open
    if (session.upstreamSession && typeof session.upstreamSession.close === 'function') {
      try {
        session.upstreamSession.close();
      } catch (_) {}
      session.upstreamSession = null;
    }

    // 5. Remove session from map
    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * Resets all state and cleans up all active sessions and timers.
   * Useful for server shutdown and isolated test execution.
   */
  reset(): void {
    for (const [id] of this.sessions) {
      this.cleanupSession(id, 'Manager reset');
    }
    this.activeGlobalConnections = 0;
    this.activeConnectionsByIp.clear();
    this.connectionAttemptsByIp.clear();
    this.sessions.clear();
  }

  /**
   * Observability metrics snapshot.
   */
  getStats(): {
    activeGlobal: number;
    activeSessionsCount: number;
    connectionsByIp: Record<string, number>;
  } {
    const connectionsByIp: Record<string, number> = {};
    for (const [ip, count] of this.activeConnectionsByIp.entries()) {
      connectionsByIp[ip] = count;
    }
    return {
      activeGlobal: this.activeGlobalConnections,
      activeSessionsCount: this.sessions.size,
      connectionsByIp,
    };
  }
}
