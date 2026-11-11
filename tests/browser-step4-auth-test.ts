import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\nidhi\\.gemini\\antigravity\\brain\\cb8f3004-e5ac-4eac-af2e-3e84006f45ed';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 3000;
const CDP_PORT = 9222;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404 || res.status === 304) return true;
    } catch {}
    await sleep(300);
  }
  return false;
}

async function runBrowserTest() {
  console.log('=== NivaranSetu Step 4 Real Browser Legal Analysis Verification ===\n');

  // 1. Start Server
  console.log('[1/7] Starting NivaranSetu server on port ' + PORT + '...');
  const serverProc: ChildProcess = spawn('npx', ['tsx', 'server.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    shell: true,
    stdio: 'pipe',
  });

  serverProc.stdout?.on('data', (d) => {
    const text = d.toString();
    if (text.includes('running on port') || text.includes('Gemini API configured')) {
      console.log(`  [Server] ${text.trim()}`);
    }
  });

  const serverReady = await waitForServer(`http://127.0.0.1:${PORT}`, 20000);
  if (!serverReady) {
    serverProc.kill();
    throw new Error('Server failed to start on port ' + PORT);
  }
  console.log('  ✓ Server is online and accepting requests.');

  // 2. Launch Chrome Headless
  const tempProfileDir = path.join(process.env.TEMP || 'C:\\Temp', 'chrome-step4-' + Date.now());
  console.log('[2/7] Launching Google Chrome with CDP...');
  const chromeProc: ChildProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${tempProfileDir}`,
      '--window-size=1440,900',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let ws: WebSocket | null = null;

  try {
    // 3. Connect to CDP
    console.log('[3/7] Connecting to Chrome DevTools Protocol...');
    let debuggerUrl = '';
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        if (res.ok) {
          const info = await res.json();
          debuggerUrl = info.webSocketDebuggerUrl;
          break;
        }
      } catch {}
      await sleep(200);
    }

    if (!debuggerUrl) throw new Error('Failed to connect to Chrome CDP.');
    ws = new WebSocket(debuggerUrl);
    await new Promise((resolve) => ws!.once('open', resolve));

    let msgId = 1;
    function sendRoot(method: string, params: any = {}, timeoutMs = 10000) {
      const id = msgId++;
      return new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws!.off('message', handler);
          reject(new Error(`Root command ${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const handler = (data: any) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id === id) {
              clearTimeout(timer);
              ws!.off('message', handler);
              if (msg.error) reject(new Error(msg.error.message));
              else resolve(msg.result);
            }
          } catch {}
        };
        ws!.on('message', handler);
        ws!.send(JSON.stringify({ id, method, params }));
      });
    }

    // Attach to page target
    const { targetId } = await sendRoot('Target.createTarget', { url: `http://127.0.0.1:${PORT}` });
    const { sessionId } = await sendRoot('Target.attachToTarget', { targetId, flatten: true });

    function sendSession(method: string, params: any = {}, timeoutMs = 15000) {
      const id = msgId++;
      return new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws!.off('message', handler);
          reject(new Error(`Session command ${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const handler = (data: any) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id === id) {
              clearTimeout(timer);
              ws!.off('message', handler);
              if (msg.error) reject(new Error(msg.error.message));
              else resolve(msg.result);
            }
          } catch {}
        };
        ws!.on('message', handler);
        ws!.send(JSON.stringify({ id, sessionId, method, params }));
      });
    }

    // Helper to evaluate JavaScript in the target page
    async function evaluate(expression: string, timeoutMs = 15000) {
      const result = await sendSession(
        'Runtime.evaluate',
        {
          expression,
          returnByValue: true,
          awaitPromise: true,
        },
        timeoutMs
      );
      if (result?.exceptionDetails) {
        throw new Error(`Evaluation exception: ${result.exceptionDetails.text || JSON.stringify(result.exceptionDetails)}`);
      }
      return result?.result?.value;
    }

    async function takeScreenshot(fileName: string) {
      const result = await sendSession('Page.captureScreenshot', { format: 'png' });
      if (result?.data) {
        const outPath = path.join(ARTIFACT_DIR, fileName);
        fs.writeFileSync(outPath, Buffer.from(result.data, 'base64'));
        console.log(`  ✓ Screenshot saved: ${outPath}`);
      } else {
        throw new Error('Screenshot failed: no image data returned');
      }
    }

    // Enable Page domain
    await sendSession('Page.enable');
    await sendSession('Runtime.enable');

    console.log('  ✓ CDP session connected and enabled.');
    await sleep(2000);

    // 4. Authenticate via Real Form in Browser
    console.log('[4/7] Performing live citizen sign-in via DOM form...');
    const testEmail = process.env.SUPABASE_TEST_EMAIL || '';
    const testPassword = process.env.SUPABASE_TEST_PASSWORD || '';

    const loginResult = await evaluate(`
      (async () => {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');

        if (!emailInput || !passInput || !submitBtn) {
          return { error: 'Login form fields not found in DOM' };
        }

        // Fill inputs using React-compatible value setters
        const setVal = (el, val) => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        setVal(emailInput, '${testEmail}');
        setVal(passInput, '${testPassword}');

        // Submit form
        submitBtn.click();
        return { submitted: true };
      })()
    `);
    console.log('  Form submission result:', loginResult);

    // Wait for Supabase live login network exchange and App transition
    console.log('  Waiting for Supabase authentication to complete...');
    let loggedIn = false;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const appState = await evaluate(`
        (() => {
          const authView = localStorage.getItem('ns_auth_view');
          const session = localStorage.getItem('ns_auth_session');
          const hasDashboard = Boolean(document.querySelector('aside') || document.querySelector('header') || document.querySelector('nav'));
          const errorAlert = document.querySelector('.bg-red-50, .text-red-600, .text-red-500')?.textContent || null;
          return { authView, hasSession: Boolean(session), hasDashboard, errorAlert };
        })()
      `);

      if (appState.hasSession && appState.authView === 'app') {
        loggedIn = true;
        console.log('  ✓ Live Supabase session established in browser localStorage!');
        break;
      }
      if (appState.errorAlert) {
        console.log(`  [Notice] Auth form alert: ${appState.errorAlert}`);
      }
    }

    if (!loggedIn) {
      throw new Error('Supabase login timed out or failed in browser.');
    }

    // 5. Navigate to Step 4 (Statutory Legal Analysis) in CaseBuilder
    console.log('[5/7] Navigating to CaseBuilder Step 4...');

    // Set tab to 'new_case' and trigger builder
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'new_case');
        window.location.reload();
      })()
    `);
    await sleep(3000);

    // Populate initial complaint details in Step 1
    console.log('  Populating complaint details in Step 1...');
    await evaluate(`
      (() => {
        const setVal = (el, val) => {
          const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const desc = document.querySelector('textarea');
        if (desc) setVal(desc, 'Citizen received fraudulent SMS claiming bank KYC expired. Debited Rs 42,500 unauthorized via UPI to QuickPay account.');

        const inputs = Array.from(document.querySelectorAll('input'));
        const entityInput = inputs.find(i => i.placeholder && i.placeholder.includes('Bank'));
        if (entityInput) setVal(entityInput, 'QuickPay Payments Bank');

        const amountInput = inputs.find(i => i.type === 'number' || (i.placeholder && i.placeholder.includes('0')));
        if (amountInput) setVal(amountInput, '42500');
      })()
    `);
    await sleep(1000);

    // Click Step 4 in top step navigation
    console.log('  Clicking Step 4: Statutory Legal Analysis in top navigation...');
    const step4ClickResult = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step4Btn = buttons.find(b => {
          const t = b.textContent || '';
          return t.includes('Statutory Legal Analysis') || t.includes('AI Refinement') || t.includes('Step 4') || (t.includes('4') && t.includes('Legal'));
        });
        if (step4Btn) {
          step4Btn.click();
          return { clicked: true, text: step4Btn.textContent?.trim() };
        }
        return { clicked: false, availableButtons: buttons.map(b => b.textContent?.trim()).filter(Boolean).slice(0, 10) };
      })()
    `);
    console.log('  Step 4 navigation click:', step4ClickResult);
    await sleep(2000);

    // 6. Trigger "Run Statutory Legal Analysis"
    console.log('[6/7] Clicking "Run Statutory Legal Analysis" button in browser...');
    const runClickResult = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const runBtn = buttons.find(b => {
          const t = b.textContent || '';
          return t.includes('Run Statutory Legal Analysis') || t.includes('Analyze') || t.includes('Re-run');
        });
        if (runBtn) {
          runBtn.click();
          return { clicked: true, text: runBtn.textContent?.trim() };
        }
        return { clicked: false, availableButtons: buttons.map(b => b.textContent?.trim()).filter(Boolean).slice(0, 15) };
      })()
    `);
    console.log('  Run button click:', runClickResult);

    // 7. Poll for Legal Analysis Completion & Absence of Unconfigured Error
    console.log('[7/7] Polling for legal analysis response in the real browser DOM...');
    let analysisPassed = false;
    let finalState: any = null;

    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      finalState = await evaluate(`
        (() => {
          const bodyText = document.body.innerText || '';
          const hasUnconfiguredError = bodyText.includes('Supabase authentication service is not configured');
          const hasInterrupted = bodyText.includes('Statutory Analysis Interrupted');
          const hasSynthesis = bodyText.includes('Statutory Assessment Complete') ||
                               bodyText.includes('Temporal Jurisdiction') ||
                               bodyText.includes('Governing Criminal Statutes') ||
                               bodyText.includes('Reserve Bank of India') ||
                               bodyText.includes('Offence Ingredients Assessment');
          const isLoading = bodyText.includes('Analyzing Statutory Framework') || bodyText.includes('Saving case facts');

          // Check for analysis cards
          const cards = Array.from(document.querySelectorAll('div, section')).filter(el => {
            const t = el.textContent || '';
            return t.includes('Governing Criminal Statutes') || t.includes('Temporal Jurisdiction');
          }).length;

          return {
            hasUnconfiguredError,
            hasInterrupted,
            hasSynthesis,
            isLoading,
            matchingCards: cards,
            textSnippet: bodyText.substring(0, 300).replace(/\\n+/g, ' ')
          };
        })()
      `);

      if (finalState.hasUnconfiguredError) {
        console.log('  [FAIL] "Supabase authentication service is not configured" error banner appeared!');
        break;
      }

      if (finalState.hasSynthesis && !finalState.isLoading) {
        analysisPassed = true;
        console.log('  ✓ Legal analysis completed successfully in browser DOM!');
        console.log(`  ✓ Assessment sections rendered (matching cards: ${finalState.matchingCards})`);
        break;
      }
    }

    console.log('  Browser DOM State:', finalState);

    // Capture screenshot of Step 4 with completed legal analysis
    await takeScreenshot('step4_real_browser_legal_analysis_success.png');

    // Verify persistence after reload
    console.log('\n  Verifying Step 4 persistence across browser reload (location.reload)...');
    await evaluate(`window.location.reload();`);
    await sleep(3500);

    const postReloadState = await evaluate(`
      (() => {
        const bodyText = document.body.innerText || '';
        const hasSynthesis = bodyText.includes('Statutory Assessment Complete') ||
                             bodyText.includes('Temporal Jurisdiction') ||
                             bodyText.includes('Governing Criminal Statutes') ||
                             bodyText.includes('Reserve Bank of India') ||
                             bodyText.includes('Statutory Legal Analysis');
        return { hasSynthesis, textSnippet: bodyText.substring(0, 250).replace(/\\n+/g, ' ') };
      })()
    `);
    console.log('  Post-reload DOM State:', postReloadState);
    await takeScreenshot('step4_real_browser_legal_analysis_persisted.png');

    console.log('\n===================================================');
    console.log('Step 4 Browser Verification Result: ' + (analysisPassed ? 'SUCCESS' : 'FAILED'));
    console.log('Unconfigured Error Present: ' + (finalState?.hasUnconfiguredError ? 'YES' : 'NO'));
    console.log('Legal Analysis Synthesis Rendered: ' + (analysisPassed ? 'YES' : 'NO'));
    console.log('===================================================');
  } finally {
    if (ws) ws.close();
    chromeProc.kill();
    serverProc.kill();
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true });
    } catch {}
    console.log('Cleaned up processes and temporary profile directory.');
  }
}

runBrowserTest().catch((err) => {
  console.error('Browser test failed:', err);
  process.exit(1);
});
