/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu AI Client Utilities
 *
 * Provides contract-compliant, reliable utilities for frontend AI workflows:
 * 1. Safe conversation history windowing (max 40 turns, backend limit 50).
 * 2. AbortController-based HTTP fetch timeouts:
 *    - Chat: 35s (allowing backend 30s deadline to resolve first)
 *    - Transcribe: 95s (allowing backend 90s deadline to resolve first)
 * 3. Accurate error categorization (timeout vs network vs HTTP failure).
 */

export const CHAT_CLIENT_TIMEOUT_MS = 35000;
export const TRANSCRIBE_CLIENT_TIMEOUT_MS = 95000;

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface RawChatMessage {
  id?: string;
  sender: 'user' | 'assistant' | 'ai';
  text: string;
  isError?: boolean;
}

/**
 * Bounds conversation history to at most maxTurns (default 40, backend limit is 50).
 * - Filters out UI error notices (isError === true or id starting with 'ast-err-').
 * - Always starts with a genuine 'user' message (required by Gemini API).
 * - Removes any leading assistant/model messages that slicing introduces.
 * - Slices the most recent turns (up to maxTurns).
 * - Strictly guarantees the latest user message is present.
 * - Preserves chronological order without mutating visible caller history.
 * - Strictly maps roles to 'user' | 'model'.
 * - Preserves user message content without accidental truncation.
 * - Returns an empty array only when there is genuinely no valid user message.
 */
export function boundConversationHistory(
  messages: RawChatMessage[],
  maxTurns = 40
): ChatTurn[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  // 1. Filter out UI error notices and empty messages
  const validMessages = messages.filter((m) => {
    if (!m || typeof m !== 'object') return false;
    if (m.isError) return false;
    if (typeof m.id === 'string' && m.id.startsWith('ast-err-')) return false;
    if (typeof m.text !== 'string' || !m.text.trim()) return false;
    return true;
  });

  if (validMessages.length === 0) {
    return [];
  }

  // 2. Locate the latest valid user message to ensure it is NEVER omitted
  let latestUserIdx = -1;
  for (let i = validMessages.length - 1; i >= 0; i--) {
    if (validMessages[i].sender === 'user') {
      latestUserIdx = i;
      break;
    }
  }

  // If there is genuinely no user message in the history, return empty array
  // (Gemini requests must have at least one user message and must start with user)
  if (latestUserIdx === -1) {
    return [];
  }

  const latestUserMsg = validMessages[latestUserIdx];

  // 3. Slice the most recent valid messages up to maxTurns
  let windowed = validMessages.slice(-maxTurns);

  // 4. In edge cases where slicing omitted the latest user message, adjust window
  if (!windowed.includes(latestUserMsg)) {
    windowed = validMessages.slice(latestUserIdx, latestUserIdx + maxTurns);
  }

  // 5. Ensure the conversation strictly starts with a 'user' message (Gemini constraint)
  // If slicing starts with one or more assistant messages, remove those leading assistant messages.
  while (windowed.length > 0 && windowed[0].sender !== 'user') {
    windowed.shift();
  }

  // If removing leading assistant messages emptied windowed or dropped latestUserMsg,
  // guarantee at least latestUserMsg is retained
  if (windowed.length === 0 || !windowed.includes(latestUserMsg)) {
    windowed = [latestUserMsg];
  }

  // 6. Ensure length is strictly <= maxTurns
  if (windowed.length > maxTurns) {
    windowed = windowed.slice(-maxTurns);
    while (windowed.length > 0 && windowed[0].sender !== 'user') {
      windowed.shift();
    }
    if (windowed.length === 0) {
      windowed = [latestUserMsg];
    }
  }

  // 7. Map to valid ChatTurn objects
  return windowed.map((m) => ({
    role: m.sender === 'user' ? 'user' : 'model',
    text: m.text.trim(),
  }));
}

/**
 * Performs an HTTP fetch with an AbortController-based timeout.
 * - Rejects with a custom TimeoutError (name: 'TimeoutError') if timed out.
 * - Always clears the timer when fetch completes or fails.
 * - Properly registers and cleans up external AbortSignal event listeners.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const { signal: externalSignal, ...fetchOptions } = options;

  let isTimedOut = false;
  const timer = setTimeout(() => {
    isTimedOut = true;
    controller.abort();
  }, timeoutMs);

  // Named external abort handler for clean registration and deregistration
  let onExternalAbort: (() => void) | null = null;

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      onExternalAbort = () => {
        clearTimeout(timer);
        controller.abort();
      };
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (isTimedOut || (err?.name === 'AbortError' && isTimedOut)) {
      const timeoutErr = new Error(`Request timed out after ${timeoutMs}ms waiting for response.`);
      timeoutErr.name = 'TimeoutError';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal && onExternalAbort) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Distinguishes timeout errors, network failures, and HTTP errors into citizen-friendly messages.
 */
export function formatAiErrorMessage(err: any, fallback = 'Operation failed'): string {
  if (!err) return fallback;

  if (
    err.name === 'TimeoutError' ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('timed out'))
  ) {
    return 'The request timed out waiting for the AI service. Please verify your connection and try again.';
  }

  if (err.name === 'AbortError') {
    return 'The request was cancelled.';
  }

  if (
    err.message === 'Failed to fetch' ||
    err.name === 'TypeError' ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('networkerror'))
  ) {
    return 'Network connection issue: Unable to reach the server. Please check your internet connection.';
  }

  return err.message || fallback;
}

/**
 * Parses and normalizes the grievance category from LegalSimplifier AI response.
 * - Supports plain text: "CATEGORY: Banking"
 * - Supports Markdown headings: "# CATEGORY: Banking", "## CATEGORY: Banking", "### CATEGORY: Banking"
 * - Supports Markdown bolding: "**CATEGORY:** Banking", "**CATEGORY: Banking**", "## **CATEGORY: Banking**"
 * - Supports list bullets, quotes, brackets: "* **CATEGORY:** [Banking / Financial]"
 * - Avoids false positives when "category" appears inside paragraph text.
 * - Returns null if missing or malformed so caller can apply standard fallback ('Legal / Regulatory').
 */
export function parseNoticeCategory(outputText: string): string | null {
  if (!outputText || typeof outputText !== 'string') {
    return null;
  }

  const lines = outputText.split(/\r?\n/);
  // Match lines starting with optional Markdown headings (#, ##, etc.), blockquotes (>),
  // or list markers (*, -, +), followed by optional bold/italic markers (*, _),
  // the keyword CATEGORY, optional bold/italic markers, colon, and the category value.
  const categoryLineRegex = /^\s*(?:[#>]+|(?:[-*+]\s+)?)?\s*[*_]*CATEGORY[*_]*\s*:\s*(.+)$/i;

  for (const line of lines) {
    const match = line.match(categoryLineRegex);
    if (match) {
      const rawVal = match[1];
      // Strip enclosing asterisks, underscores, backticks, quotes, square brackets, and whitespace
      const cleanVal = rawVal.replace(/^[\*_`"'\s\[]+|[\*_`"'\s\]]+$/g, '').trim();
      if (cleanVal) {
        return cleanVal;
      }
    }
  }

  return null;
}

