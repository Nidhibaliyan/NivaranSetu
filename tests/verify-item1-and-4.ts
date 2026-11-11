import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
dotenv.config({ override: false });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 3000;
const CDP_PORT = 9222;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, timeoutMs = 20000): Promise<boolean> {
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

async function verifyItem1And4() {
  console.log('=== Verifying Item 1 (Exact Missing String) and Item 4 (Input Values) ===\n');

  const serverProc: ChildProcess = spawn('npx', ['tsx', 'server.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    shell: true,
    stdio: 'ignore',
  });

  await waitForServer(`http://127.0.0.1:${PORT}`, 20000);

  const tempProfileDir = path.join(process.env.TEMP || 'C:\\Temp', 'chrome-check-' + Date.now());
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

    ws = new WebSocket(debuggerUrl);
    await new Promise((resolve) => ws!.once('open', resolve));

    let msgId = 1;
    function sendRoot(method: string, params: any = {}) {
      const id = msgId++;
      return new Promise<any>((resolve) => {
        const handler = (data: any) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            ws!.off('message', handler);
            resolve(msg.result);
          }
        };
        ws!.on('message', handler);
        ws!.send(JSON.stringify({ id, method, params }));
      });
    }

    const { targetId } = await sendRoot('Target.createTarget', { url: `http://127.0.0.1:${PORT}` });
    const { sessionId } = await sendRoot('Target.attachToTarget', { targetId, flatten: true });

    function sendSession(method: string, params: any = {}) {
      const id = msgId++;
      return new Promise<any>((resolve) => {
        const handler = (data: any) => {
          const msg = JSON.parse(data.toString());
          if (msg.id === id) {
            ws!.off('message', handler);
            resolve(msg.result);
          }
        };
        ws!.on('message', handler);
        ws!.send(JSON.stringify({ id, sessionId, method, params }));
      });
    }

    async function evaluate(expression: string) {
      const res = await sendSession('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return res?.result?.value;
    }

    async function typeTextViaKeyboard(text: string) {
      for (const char of text) {
        await sendSession('Input.dispatchKeyEvent', { type: 'keyDown', text: char, unmodifiedText: char });
        await sendSession('Input.dispatchKeyEvent', { type: 'keyUp' });
        await sleep(20);
      }
    }

    await sendSession('Page.enable');
    await sendSession('Runtime.enable');
    await sleep(2000);

    // Login
    const testEmail = process.env.SUPABASE_TEST_EMAIL || '';
    const testPassword = process.env.SUPABASE_TEST_PASSWORD || '';
    await evaluate(`
      (async () => {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');
        const setVal = (el, val) => {
          const tracker = el._valueTracker;
          if (tracker) tracker.setValue('pre');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        setVal(emailInput, '${testEmail}');
        setVal(passInput, '${testPassword}');
        submitBtn.click();
      })()
    `);
    await sleep(2500);

    // ==========================================
    // TEST 1: Check 1 Warning with exact string
    // ==========================================
    console.log('[Test 1] Testing missing-information warning with exact string...');
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'new_case');
        window.location.reload();
      })()
    `);
    await sleep(3000);

    // Type title and description via keyboard, leave entity empty
    await evaluate(`document.querySelector('input[placeholder*="Unauthorized UPI debit"]')?.focus();`);
    await typeTextViaKeyboard('UPI Dispute Subject');
    await evaluate(`document.querySelector('textarea')?.focus();`);
    await typeTextViaKeyboard('Detailed incident narrative description exceeding thirty characters.');
    await sleep(500);

    // Advance to Step 5
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);

    const checkWarningWithBlank = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const exactMatch = text.includes('Opposite party / respondent entity is not clearly identified.');
        return { exactMatch, textSnippet: text.substring(0, 400) };
      })()
    `);
    console.log('  Warning with empty entity (exact match):', checkWarningWithBlank.exactMatch);

    // Now return to Step 1 and type entity via keyboard
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step1Btn = buttons.find(b => b.textContent && (b.textContent.includes('01') || b.textContent.includes('Facts')));
        if (step1Btn) step1Btn.click();
      })()
    `);
    await sleep(2000);

    await evaluate(`document.querySelector('input[placeholder*="Apex Bank"]')?.focus();`);
    await typeTextViaKeyboard('QuickPay Payments Bank');
    await sleep(500);

    // Return to Step 5
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);

    const checkWarningAfterTyping = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const exactMatch = text.includes('Opposite party / respondent entity is not clearly identified.');
        return { exactMatch };
      })()
    `);
    console.log('  Warning after typing entity (cleared):', !checkWarningAfterTyping.exactMatch);
    console.log('  Item 1 Status:', (checkWarningWithBlank.exactMatch && !checkWarningAfterTyping.exactMatch) ? 'PASS' : 'FAIL');

    // ==========================================
    // TEST 2: Check 4 Case Switching with input values
    // ==========================================
    console.log('\n[Test 2] Testing Case Switching Isolation (Reading input values)...');
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'my_cases');
        window.location.reload();
      })()
    `);
    await sleep(3500);

    // Select Case A (QuickPay Payments Bank)
    await evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.rounded-2xl, .cursor-pointer'));
        const cardA = cards.find(c => c.textContent && c.textContent.includes('QuickPay Payments Bank'));
        if (cardA) cardA.click();
      })()
    `);
    await sleep(2500);

    const caseAInputs = await evaluate(`
      (() => {
        const entityVal = document.querySelector('input[placeholder*="Apex Bank"]')?.value || '';
        const amountVal = document.querySelector('input[type="number"], input[placeholder*="0"]')?.value || '';
        return { entityVal, amountVal };
      })()
    `);
    console.log('  Case A inputs in Step 1:', caseAInputs);

    // Return to My Cases and select Case B (TechBazaar Electronics)
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'my_cases');
        window.location.reload();
      })()
    `);
    await sleep(3500);

    await evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.rounded-2xl, .cursor-pointer'));
        const cardB = cards.find(c => c.textContent && c.textContent.includes('TechBazaar Electronics'));
        if (cardB) cardB.click();
      })()
    `);
    await sleep(2500);

    const caseBInputs = await evaluate(`
      (() => {
        const entityVal = document.querySelector('input[placeholder*="Apex Bank"]')?.value || '';
        const amountVal = document.querySelector('input[type="number"], input[placeholder*="0"]')?.value || '';
        return { entityVal, amountVal };
      })()
    `);
    console.log('  Case B inputs in Step 1:', caseBInputs);

    // Return to My Cases and re-select Case A
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'my_cases');
        window.location.reload();
      })()
    `);
    await sleep(3500);

    await evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.rounded-2xl, .cursor-pointer'));
        const cardA = cards.find(c => c.textContent && c.textContent.includes('QuickPay Payments Bank'));
        if (cardA) cardA.click();
      })()
    `);
    await sleep(2500);

    const caseAReturnInputs = await evaluate(`
      (() => {
        const entityVal = document.querySelector('input[placeholder*="Apex Bank"]')?.value || '';
        const amountVal = document.querySelector('input[type="number"], input[placeholder*="0"]')?.value || '';
        return { entityVal, amountVal };
      })()
    `);
    console.log('  Case A re-selected inputs:', caseAReturnInputs);

    const item4Passed = Boolean(
      caseAInputs.entityVal.includes('QuickPay') &&
      caseBInputs.entityVal.includes('TechBazaar') &&
      caseAReturnInputs.entityVal.includes('QuickPay') &&
      caseAInputs.entityVal !== caseBInputs.entityVal
    );
    console.log('  Item 4 Status:', item4Passed ? 'PASS' : 'FAIL');

  } finally {
    if (ws) ws.close();
    chromeProc.kill();
    serverProc.kill();
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true });
    } catch {}
    console.log('Verification finished.');
  }
}

verifyItem1And4().catch(console.error);
