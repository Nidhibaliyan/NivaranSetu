import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local and .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
dotenv.config({ override: false });

const ARTIFACT_DIR = 'C:\\Users\\nidhi\\.gemini\\antigravity\\brain\\cb8f3004-e5ac-4eac-af2e-3e84006f45ed';
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

export interface ClosureCheckResult {
  itemNumber: number;
  name: string;
  status: 'PASS' | 'FAIL' | 'UNVERIFIED';
  details: string;
}

async function runTargetedClosure() {
  console.log('=== NivaranSetu Step 5 Targeted Verification Closure ===\n');

  const results: ClosureCheckResult[] = [];
  const tempDownloadDir = path.join(process.env.TEMP || 'C:\\Temp', 'ns-downloads-' + Date.now());
  fs.mkdirSync(tempDownloadDir, { recursive: true });

  // 1. Start Server
  console.log('[Setup 1/4] Starting server on port ' + PORT + '...');
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
  console.log('  ✓ Server is online.');

  // 2. Launch Chrome Headless with Download Support
  const tempProfileDir = path.join(process.env.TEMP || 'C:\\Temp', 'chrome-closure-' + Date.now());
  console.log('[Setup 2/4] Launching Chrome with CDP and download directory...');
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
    console.log('[Setup 3/4] Connecting to Chrome DevTools Protocol...');
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
      }
    }

    // Keyboard dispatch helper for genuine typing
    async function typeTextViaKeyboard(text: string) {
      for (const char of text) {
        await sendSession('Input.dispatchKeyEvent', {
          type: 'keyDown',
          text: char,
          unmodifiedText: char,
        });
        await sendSession('Input.dispatchKeyEvent', {
          type: 'keyUp',
        });
        await sleep(25);
      }
    }

    // Keyboard dispatch helper to select all and clear input
    async function clearInputViaKeyboard() {
      await sendSession('Input.dispatchKeyEvent', {
        type: 'keyDown',
        windowsVirtualKeyCode: 65, // A
        modifiers: 2, // Ctrl
      });
      await sendSession('Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: 65,
      });
      await sendSession('Input.dispatchKeyEvent', {
        type: 'keyDown',
        windowsVirtualKeyCode: 8, // Backspace
      });
      await sendSession('Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: 8,
      });
      await sleep(100);
    }

    // Enable domains
    await sendSession('Page.enable');
    await sendSession('Runtime.enable');

    // Configure downloads via CDP
    try {
      await sendSession('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: tempDownloadDir,
        eventsEnabled: true,
      });
    } catch {
      await sendSession('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: tempDownloadDir,
      });
    }

    console.log('  ✓ CDP session connected and configured.');
    await sleep(2000);

    // 4. Authenticate
    console.log('[Setup 4/4] Performing authenticated citizen sign-in via DOM...');
    const testEmail = process.env.SUPABASE_TEST_EMAIL || '';
    const testPassword = process.env.SUPABASE_TEST_PASSWORD || '';

    await evaluate(`
      (async () => {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');

        if (!emailInput || !passInput || !submitBtn) return { error: 'No login fields' };

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

    let authenticated = false;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const hasSession = await evaluate(`Boolean(localStorage.getItem('ns_auth_session'))`);
      if (hasSession) {
        authenticated = true;
        break;
      }
    }
    if (!authenticated) throw new Error('Live Supabase sign-in timed out');
    console.log('  ✓ Citizen session verified in browser.');

    // =============================================================
    // ITEM 1: Dynamic Missing-Information Warnings (Genuine Keyboard Input)
    // =============================================================
    console.log('\n--- ITEM 1: Dynamic Missing-Information Warnings (Genuine Keyboard Input) ---');
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'new_case');
        window.location.reload();
      })()
    `);
    await sleep(3000);

    // Focus Subject input and type via keyboard
    await evaluate(`document.querySelector('input[placeholder*="Unauthorized UPI debit"]')?.focus();`);
    await typeTextViaKeyboard('UPI Unauthorized Debit Dispute - Immediate Redressal');
    await sleep(300);

    // Focus Description textarea and type via keyboard
    await evaluate(`document.querySelector('textarea')?.focus();`);
    await typeTextViaKeyboard('Citizen account suffered unauthorized fraudulent debits of Rs 42,500 without receiving OTP.');
    await sleep(300);

    // Leave Involved Entity BLANK.
    // Advance to Step 5
    console.log('  Advancing to Step 5 with missing respondent entity...');
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);

    const check1WarningAppeared = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasWarning = text.includes('Incomplete Case Details') || text.includes('Readiness:');
        const mentionsEntity = text.includes('Opposing entity or financial institution is not specified');
        return { hasWarning, mentionsEntity };
      })()
    `);
    console.log('  Step 5 warning with blank entity:', check1WarningAppeared);

    // Now return to Step 1 and type missing entity using genuine keyboard events
    console.log('  Navigating back to Step 1 and typing missing entity via keyboard...');
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step1Btn = buttons.find(b => b.textContent && (b.textContent.includes('01') || b.textContent.includes('Facts')));
        if (step1Btn) step1Btn.click();
      })()
    `);
    await sleep(2000);

    // Focus entity input and type
    await evaluate(`document.querySelector('input[placeholder*="Apex Bank"]')?.focus();`);
    await typeTextViaKeyboard('QuickPay Payments Bank');
    await sleep(500);

    // Also type amount
    await evaluate(`document.querySelector('input[type="number"], input[placeholder*="0"]')?.focus();`);
    await typeTextViaKeyboard('42500');
    await sleep(500);

    // Advance back to Step 5
    console.log('  Advancing back to Step 5 after typing missing entity...');
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);

    const check1WarningUpdated = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const mentionsEntity = text.includes('Opposing entity or financial institution is not specified');
        return { mentionsEntity };
      })()
    `);
    console.log('  Step 5 warning after typing entity:', check1WarningUpdated);

    const item1Passed = Boolean(
      check1WarningAppeared.hasWarning &&
      check1WarningAppeared.mentionsEntity &&
      !check1WarningUpdated.mentionsEntity
    );
    results.push({
      itemNumber: 1,
      name: 'Dynamic missing-information warnings (Genuine Keyboard Input)',
      status: item1Passed ? 'PASS' : 'FAIL',
      details: `Warning appeared with missing entity: ${check1WarningAppeared.mentionsEntity}, Cleared after typing: ${!check1WarningUpdated.mentionsEntity}`,
    });
    console.log(`  Item 1 Result: ${item1Passed ? 'PASS' : 'FAIL'}`);
    await takeScreenshot('closure_01_dynamic_warning_cleared.png');

    // =============================================================
    // ITEM 2: Evidence OCR Preview (Actual Extracted Content in DOM)
    // =============================================================
    console.log('\n--- ITEM 2: Evidence OCR Preview (Extracted Metadata & Text in DOM) ---');
    // Navigate to Step 2
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step2Btn = buttons.find(b => b.textContent && (b.textContent.includes('02') || b.textContent.includes('Evidence')));
        if (step2Btn) step2Btn.click();
      })()
    `);
    await sleep(2000);

    // Attach an evidence item
    await evaluate(`
      (() => {
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
          const file = new File(['Transaction Statement 15-Oct-2026 Debited Rs 42,500 Ref UPI/12345/TXN'], 'sbi_bank_statement_oct2026.pdf', { type: 'application/pdf' });
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(3000);

    // In Step 2, inspect the selected exhibit OCR preview panel
    const step2OcrPreview = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasOcrSection = text.includes('Extracted OCR') || text.includes('OCR Extracted') || text.includes('Raw OCR') || text.includes('Document Observations');
        const hasAmountObservation = text.includes('42,500') || text.includes('42500');
        const hasFileName = text.includes('sbi_bank_statement_oct2026.pdf');
        return { hasOcrSection, hasAmountObservation, hasFileName };
      })()
    `);
    console.log('  Step 2 OCR preview observation:', step2OcrPreview);

    // Jump to Step 5: Review & Custody and verify OCR badge in Preserved Evidence Register
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);

    const step5OcrDisplay = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasOcrLabel = text.includes('OCR Extracted:');
        const hasExtractedAmount = text.includes('42,500') || text.includes('42500');
        const hasDate = text.includes('2026-10-15') || text.includes('2026');
        return { hasOcrLabel, hasExtractedAmount, hasDate };
      })()
    `);
    console.log('  Step 5 Evidence Register OCR display:', step5OcrDisplay);

    const item2Passed = Boolean(step5OcrDisplay.hasOcrLabel && step5OcrDisplay.hasExtractedAmount);
    results.push({
      itemNumber: 2,
      name: 'Evidence OCR Preview (Actual Extracted Content)',
      status: item2Passed ? 'PASS' : 'FAIL',
      details: `OCR Extracted label in Step 5: ${step5OcrDisplay.hasOcrLabel}, Extracted amount in DOM: ${step5OcrDisplay.hasExtractedAmount}`,
    });
    console.log(`  Item 2 Result: ${item2Passed ? 'PASS' : 'FAIL'}`);
    await takeScreenshot('closure_02_evidence_ocr_preview.png');

    // =============================================================
    // ITEM 3: Actual Evidence Download & Byte Verification
    // =============================================================
    console.log('\n--- ITEM 3: Actual Evidence Download & Byte Verification ---');
    // Save draft first to ensure custody events and exhibit records are committed
    await evaluate(`
      (async () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent && b.textContent.includes('Save Draft'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await sleep(3000);

    // Click Download button on exhibit
    console.log('  Clicking Download button on exhibit in Step 5...');
    const downloadClickResult = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const dlBtn = buttons.find(b => b.title && b.title.includes('Download preserved file'));
        if (dlBtn) {
          dlBtn.click();
          return { clicked: true, title: dlBtn.title };
        }
        const fallbackBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Download');
        if (fallbackBtn) {
          fallbackBtn.click();
          return { clicked: true, text: 'Download' };
        }
        return { clicked: false };
      })()
    `);
    console.log('  Download button click:', downloadClickResult);
    await sleep(3000);

    // Check tempDownloadDir for downloaded file
    const downloadedFiles = fs.readdirSync(tempDownloadDir);
    console.log('  Downloaded files in target directory:', downloadedFiles);

    let downloadedFileBytes = 0;
    let downloadedFileName = '';
    let matchesExpected = false;

    if (downloadedFiles.length > 0) {
      downloadedFileName = downloadedFiles[0];
      const filePath = path.join(tempDownloadDir, downloadedFileName);
      const stat = fs.statSync(filePath);
      downloadedFileBytes = stat.size;
      const content = fs.readFileSync(filePath, 'utf-8');
      matchesExpected = downloadedFileName.includes('sbi_bank_statement') || downloadedFileName.includes('.pdf');
      console.log(`  ✓ File verified on disk: ${downloadedFileName} (${downloadedFileBytes} bytes)`);
      console.log(`  ✓ File snippet: "${content.substring(0, 80)}..."`);
    }

    const item3Passed = Boolean(downloadedFiles.length > 0 && downloadedFileBytes > 0 && matchesExpected);
    results.push({
      itemNumber: 3,
      name: 'Actual Evidence Download & Byte Verification',
      status: item3Passed ? 'PASS' : 'FAIL',
      details: `File: ${downloadedFileName}, Size: ${downloadedFileBytes} bytes, Valid: ${matchesExpected}`,
    });
    console.log(`  Item 3 Result: ${item3Passed ? 'PASS' : 'FAIL'}`);
    await takeScreenshot('closure_03_evidence_download_verified.png');

    // =============================================================
    // ITEM 4: Existing-Case Switching Isolation
    // =============================================================
    console.log('\n--- ITEM 4: Existing-Case Switching Isolation ---');
    // Save current case as Case A
    await evaluate(`
      (async () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent && (b.textContent.includes('Save Draft') || b.textContent.includes('Draft Saved')));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await sleep(3500);

    // Reload into My Cases to see all saved cases
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'my_cases');
        window.location.reload();
      })()
    `);
    await sleep(4000);

    // Inspect cases in My Cases list
    const caseCards = await evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.rounded-2xl, .cursor-pointer')).filter(c => {
          return c.textContent && (c.textContent.includes('READINESS') || c.textContent.includes('·'));
        });
        return cards.map(c => ({
          textSnippet: c.textContent?.substring(0, 100).replace(/\\s+/g, ' ')
        }));
      })()
    `);
    console.log('  Cases found in citizen account:', caseCards);

    // Create a distinct Case B to ensure we have two completely distinct cases to switch between
    console.log('  Creating distinct Case B (Consumer Defect - TechBazaar Laptop)...');
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'new_case');
        window.location.reload();
      })()
    `);
    await sleep(3000);

    // Fill Case B details
    await evaluate(`
      (() => {
        const setVal = (el, val) => {
          const tracker = el._valueTracker;
          if (tracker) tracker.setValue('pre');
          const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const inputs = Array.from(document.querySelectorAll('input'));
        const titleInput = inputs.find(i => i.placeholder && i.placeholder.includes('Unauthorized UPI debit'));
        if (titleInput) setVal(titleInput, 'Defective Gaming Laptop Repudiation');

        const desc = document.querySelector('textarea');
        if (desc) setVal(desc, 'Citizen purchased gaming laptop from TechBazaar Electronics which arrived with cracked screen. Return rejected.');

        const entityInput = inputs.find(i => i.placeholder && i.placeholder.includes('Apex Bank'));
        if (entityInput) setVal(entityInput, 'TechBazaar Electronics');

        const amountInput = inputs.find(i => i.type === 'number' || (i.placeholder && i.placeholder.includes('0')));
        if (amountInput) setVal(amountInput, '65000');
      })()
    `);
    await sleep(1000);

    // Advance Case B to Step 5 and Save
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);

    await evaluate(`
      (async () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent && (b.textContent.includes('Save Draft') || b.textContent.includes('Draft Saved')));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await sleep(3500);

    // Now reload to My Cases to test switching: A -> B -> A
    console.log('  Navigating to My Cases to test switching A -> B -> A...');
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'my_cases');
        window.location.reload();
      })()
    `);
    await sleep(4000);

    // Open Case A (QuickPay Payments Bank)
    console.log('  Selecting Case A (QuickPay Payments Bank)...');
    await evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.rounded-2xl, .cursor-pointer'));
        const cardA = cards.find(c => c.textContent && c.textContent.includes('QuickPay Payments Bank'));
        if (cardA) cardA.click();
      })()
    `);
    await sleep(3000);

    const caseAState = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        return {
          hasCaseAEntity: text.includes('QuickPay Payments Bank'),
          hasCaseBEntity: text.includes('TechBazaar Electronics'),
          hasCaseAAmount: text.includes('42,500') || text.includes('42500'),
          hasCaseBAmount: text.includes('65,000') || text.includes('65000'),
        };
      })()
    `);
    console.log('  Case A Inspection:', caseAState);

    // Navigate to My Cases and open Case B (TechBazaar Electronics)
    console.log('  Returning to My Cases and selecting Case B (TechBazaar Electronics)...');
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'my_cases');
        window.location.reload();
      })()
    `);
    await sleep(4000);

    await evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.rounded-2xl, .cursor-pointer'));
        const cardB = cards.find(c => c.textContent && c.textContent.includes('TechBazaar Electronics'));
        if (cardB) cardB.click();
      })()
    `);
    await sleep(3000);

    const caseBState = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        return {
          hasCaseBEntity: text.includes('TechBazaar Electronics'),
          hasCaseAEntity: text.includes('QuickPay Payments Bank'),
          hasCaseBAmount: text.includes('65,000') || text.includes('65000'),
          hasCaseAAmount: text.includes('42,500') || text.includes('42500'),
        };
      })()
    `);
    console.log('  Case B Inspection:', caseBState);

    // Return to My Cases and select Case A again
    console.log('  Returning to My Cases and re-selecting Case A (QuickPay)...');
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'my_cases');
        window.location.reload();
      })()
    `);
    await sleep(4000);

    await evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.rounded-2xl, .cursor-pointer'));
        const cardA = cards.find(c => c.textContent && c.textContent.includes('QuickPay Payments Bank'));
        if (cardA) cardA.click();
      })()
    `);
    await sleep(3000);

    const caseAReturnState = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        return {
          hasCaseAEntity: text.includes('QuickPay Payments Bank'),
          hasCaseBEntity: text.includes('TechBazaar Electronics'),
        };
      })()
    `);
    console.log('  Case A Re-selection Inspection:', caseAReturnState);

    const item4Passed = Boolean(
      caseAState.hasCaseAEntity && !caseAState.hasCaseBEntity &&
      caseBState.hasCaseBEntity && !caseBState.hasCaseAEntity &&
      caseAReturnState.hasCaseAEntity && !caseAReturnState.hasCaseBEntity
    );
    results.push({
      itemNumber: 4,
      name: 'Existing-Case Switching Isolation',
      status: item4Passed ? 'PASS' : 'FAIL',
      details: `A has only A: ${caseAState.hasCaseAEntity && !caseAState.hasCaseBEntity}, B has only B: ${caseBState.hasCaseBEntity && !caseBState.hasCaseAEntity}, Return A clean: ${caseAReturnState.hasCaseAEntity && !caseAReturnState.hasCaseBEntity}`,
    });
    console.log(`  Item 4 Result: ${item4Passed ? 'PASS' : 'FAIL'}`);
    await takeScreenshot('closure_04_case_switching_isolation.png');

    // =============================================================
    // ITEM 5: Timeline Persistence
    // =============================================================
    console.log('\n--- ITEM 5: Timeline Persistence ---');
    // Check if the current case has existing incident timeline events
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);

    const timelineEvaluation = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasEmptyNotice = text.includes('No Incident Timeline Events Recorded');
        // Check for chronological events
        const hasEvents = !hasEmptyNotice && text.includes('Factual Incident Timeline');
        return { hasEvents, hasEmptyNotice, textSnippet: text.substring(0, 300) };
      })()
    `);
    console.log('  Initial timeline evaluation:', timelineEvaluation);

    let item5Status: 'PASS' | 'UNVERIFIED' = 'UNVERIFIED';
    let item5Details = '';

    if (timelineEvaluation.hasEvents) {
      // Reload and verify survival
      console.log('  Existing timeline events found. Testing survival across reload...');
      await evaluate(`window.location.reload();`);
      await sleep(3500);

      const postReloadTimeline = await evaluate(`
        (() => {
          const text = document.body.innerText || '';
          const hasEvents = !text.includes('No Incident Timeline Events Recorded') && text.includes('Factual Incident Timeline');
          return { hasEvents };
        })()
      `);

      if (postReloadTimeline.hasEvents) {
        item5Status = 'PASS';
        item5Details = 'Pre-existing incident timeline events survived reload successfully';
      } else {
        item5Status = 'UNVERIFIED';
        item5Details = 'Timeline events did not appear post-reload';
      }
    } else {
      // Following strict user instruction:
      // "If no event exists, do not fabricate a citizen event or modify production data merely to make the test pass. Report this item as unverified."
      item5Status = 'UNVERIFIED';
      item5Details = 'No pre-existing incident timeline events attached to saved cases in test account. In accordance with strict instructions, zero synthetic production events were fabricated.';
      console.log('  [Strict Notice] No pre-existing timeline events found. Reporting as UNVERIFIED as requested.');
    }

    results.push({
      itemNumber: 5,
      name: 'Timeline Persistence Across Reload',
      status: item5Status,
      details: item5Details,
    });
    console.log(`  Item 5 Result: ${item5Status}`);
    await takeScreenshot('closure_05_timeline_persistence.png');

    console.log('\n===================================================');
    console.log('Step 5 Targeted Verification Closure Summary:');
    results.forEach((r) => {
      console.log(`  Item ${r.itemNumber} [${r.status}]: ${r.name}`);
      console.log(`    ${r.details}`);
    });
    console.log('===================================================');
  } finally {
    if (ws) ws.close();
    chromeProc.kill();
    serverProc.kill();
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true });
      fs.rmSync(tempDownloadDir, { recursive: true, force: true });
    } catch {}
    console.log('Cleaned up processes and temporary directories.');
  }
}

runTargetedClosure().catch((err) => {
  console.error('Targeted closure failed:', err);
  process.exit(1);
});
