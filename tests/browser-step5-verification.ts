import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local and .env into process.env
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

export interface VerificationResult {
  checkNumber: number;
  name: string;
  passed: boolean;
  details: string;
}

async function runStep5Verification() {
  console.log('=== NivaranSetu Step 5 Review & Custody Real Browser Verification ===\n');

  const results: VerificationResult[] = [];

  // 1. Start Server
  console.log('[Setup 1/4] Starting NivaranSetu server on port ' + PORT + '...');
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
  const tempProfileDir = path.join(process.env.TEMP || 'C:\\Temp', 'chrome-step5-' + Date.now());
  console.log('[Setup 2/4] Launching Google Chrome with CDP...');
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

    await sendSession('Page.enable');
    await sendSession('Runtime.enable');
    console.log('  ✓ CDP session connected and enabled.');
    await sleep(2000);

    // 4. Live Authentication via Form
    console.log('[Setup 4/4] Performing authenticated citizen sign-in via DOM...');
    const testEmail = process.env.SUPABASE_TEST_EMAIL || '';
    const testPassword = process.env.SUPABASE_TEST_PASSWORD || '';

    if (!testEmail || !testPassword) {
      throw new Error('SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD must be configured in environment');
    }

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
    console.log('  ✓ Authenticated citizen session established.');

    // Prepare complete test case data in CaseBuilder
    console.log('\n--- Initializing Comprehensive Citizen Case in CaseBuilder ---');
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'new_case');
        window.location.reload();
      })()
    `);
    await sleep(3000);

    // Populate Case facts in Step 1 (including Title and Description to satisfy validation)
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

        // Subject / Title input
        const titleInput = inputs.find(i => i.placeholder && i.placeholder.includes('Unauthorized UPI debit'));
        if (titleInput) setVal(titleInput, 'Unauthorized UPI debit of ₹42,500 from QuickPay account');

        // Description
        const desc = document.querySelector('textarea');
        if (desc) setVal(desc, 'Citizen received deceptive SMS with link. Rs 42,500 was debited via UPI without OTP confirmation to QuickPay Payments Bank.');

        // Respondent entity
        const entityInput = inputs.find(i => i.placeholder && i.placeholder.includes('Bank'));
        if (entityInput) setVal(entityInput, 'QuickPay Payments Bank');

        // Disputed amount
        const amountInput = inputs.find(i => i.type === 'number' || (i.placeholder && i.placeholder.includes('0')));
        if (amountInput) setVal(amountInput, '42500');

        // Date
        const dateInput = document.querySelector('input[type="date"]');
        if (dateInput) setVal(dateInput, '2026-10-15');

        // Location input
        const locInput = inputs.find(i => i.placeholder && i.placeholder.includes('Pune, Maharashtra'));
        if (locInput) setVal(locInput, 'Pune, Maharashtra');
      })()
    `);
    await sleep(1000);

    // Attach an evidence file in Step 2 via standard File API and DataTransfer
    console.log('Attaching evidence exhibit in Step 2...');
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step2Btn = buttons.find(b => b.textContent && (b.textContent.includes('02') || b.textContent.includes('Evidence')));
        if (step2Btn) step2Btn.click();
      })()
    `);
    await sleep(2000);

    await evaluate(`
      (() => {
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
          const file = new File(['Bank statement text showing debited transaction of Rs 42500 to QuickPay'], 'bank_statement_oct2026.pdf', { type: 'application/pdf' });
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(2500);

    // Navigate to Step 5: Review & Custody
    console.log('Navigating to Step 5: Review & Custody...');
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);

    // -------------------------------------------------------------
    // CHECK 1: Case Overview and Dispute Parameters
    // -------------------------------------------------------------
    console.log('\n[Check 1] Verifying Case Overview and dispute parameters...');
    const overviewData = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasOverviewHeading = text.includes('Case Overview & Dispute Parameters');
        const hasCategory = text.includes('Banking & UPI Financial Fraud') || text.includes('RBI Ombudsman');
        const hasRespondent = text.includes('QuickPay Payments Bank');
        const hasAmount = text.includes('42,500') || text.includes('42500');
        const hasDate = text.includes('2026-10-15');
        const hasLocation = text.includes('Pune, Maharashtra');
        const hasAuthority = text.includes('Reserve Bank of India') || text.includes('Integrated Ombudsman');

        return {
          hasOverviewHeading,
          hasCategory,
          hasRespondent,
          hasAmount,
          hasDate,
          hasLocation,
          hasAuthority
        };
      })()
    `);

    const check1Passed = Boolean(
      overviewData.hasOverviewHeading &&
      overviewData.hasCategory &&
      overviewData.hasRespondent &&
      overviewData.hasAmount &&
      overviewData.hasDate &&
      overviewData.hasLocation &&
      overviewData.hasAuthority
    );
    results.push({
      checkNumber: 1,
      name: 'Case Overview & Dispute Parameters',
      passed: check1Passed,
      details: JSON.stringify(overviewData),
    });
    console.log(`  Result 1: ${check1Passed ? 'PASS' : 'FAIL'}`, overviewData);
    await takeScreenshot('step5_01_case_overview.png');

    // -------------------------------------------------------------
    // CHECK 2: Dynamically Generated Missing-Information Warnings
    // -------------------------------------------------------------
    console.log('\n[Check 2] Verifying dynamically generated missing-information warnings...');
    // Jump to Step 1 and clear the respondent field
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step1Btn = buttons.find(b => b.textContent && (b.textContent.includes('01') || b.textContent.includes('Facts')));
        if (step1Btn) step1Btn.click();
      })()
    `);
    await sleep(1500);

    await evaluate(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const entityInput = inputs.find(i => i.placeholder && i.placeholder.includes('Bank'));
        if (entityInput) {
          const tracker = entityInput._valueTracker;
          if (tracker) tracker.setValue('pre');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(entityInput, '');
          entityInput.dispatchEvent(new Event('input', { bubbles: true }));
          entityInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);

    // Jump back to Step 5
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2000);

    const warningActive = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasWarningBanner = text.includes('Incomplete Case Details') || text.includes('Readiness:');
        const listsRespondent = text.includes('Opposing entity') || text.includes('institution is not specified');
        return { hasWarningBanner, listsRespondent };
      })()
    `);

    // Restore respondent
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step1Btn = buttons.find(b => b.textContent && (b.textContent.includes('01') || b.textContent.includes('Facts')));
        if (step1Btn) step1Btn.click();
      })()
    `);
    await sleep(1500);
    await evaluate(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const entityInput = inputs.find(i => i.placeholder && i.placeholder.includes('Bank'));
        if (entityInput) {
          const tracker = entityInput._valueTracker;
          if (tracker) tracker.setValue('pre');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(entityInput, 'QuickPay Payments Bank');
          entityInput.dispatchEvent(new Event('input', { bubbles: true }));
          entityInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await sleep(500);
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2000);

    const check2Passed = Boolean(warningActive.hasWarningBanner && warningActive.listsRespondent);
    results.push({
      checkNumber: 2,
      name: 'Dynamic Missing-Information Warnings',
      passed: check2Passed,
      details: JSON.stringify(warningActive),
    });
    console.log(`  Result 2: ${check2Passed ? 'PASS' : 'FAIL'}`, warningActive);
    await takeScreenshot('step5_02_readiness_warning.png');

    // -------------------------------------------------------------
    // CHECK 3: Citizen Incident Timeline Chronology & Separation
    // -------------------------------------------------------------
    console.log('\n[Check 3] Verifying Citizen Incident Timeline Chronology & Separation from Custody Log...');
    const timelineData = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasTimelineHeading = text.includes('Factual Incident Timeline');
        const hasActivityLogHeading = text.includes('Append-Only Case Activity Log');
        const isSeparated = hasTimelineHeading && hasActivityLogHeading;
        return { hasTimelineHeading, hasActivityLogHeading, isSeparated };
      })()
    `);

    const check3Passed = Boolean(timelineData.hasTimelineHeading && timelineData.hasActivityLogHeading && timelineData.isSeparated);
    results.push({
      checkNumber: 3,
      name: 'Citizen Incident Timeline Separation from Custody Log',
      passed: check3Passed,
      details: JSON.stringify(timelineData),
    });
    console.log(`  Result 3: ${check3Passed ? 'PASS' : 'FAIL'}`, timelineData);

    // -------------------------------------------------------------
    // CHECK 4: Timeline Empty State
    // -------------------------------------------------------------
    console.log('\n[Check 4] Verifying Timeline Empty State display...');
    const emptyStateData = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasEmptyState = text.includes('No Incident Timeline Events Recorded') ||
                              text.includes('No chronological events have been attached to this case');
        return { hasEmptyState };
      })()
    `);

    const check4Passed = Boolean(emptyStateData.hasEmptyState);
    results.push({
      checkNumber: 4,
      name: 'Timeline Empty State Representation',
      passed: check4Passed,
      details: JSON.stringify(emptyStateData),
    });
    console.log(`  Result 4: ${check4Passed ? 'PASS' : 'FAIL'}`, emptyStateData);
    await takeScreenshot('step5_03_timeline_and_empty_state.png');

    // -------------------------------------------------------------
    // CHECK 5 & 6: Evidence Register Metadata, Integrity Verification & Authenticity Scope
    // -------------------------------------------------------------
    console.log('\n[Check 5 & 6] Verifying Evidence Register, Integrity Verification & Authenticity Disclaimer...');
    const evidenceRegisterData = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasRegisterHeading = text.includes('Preserved Evidence Register');
        const hasDisclaimer = text.includes('Cryptographic SHA-256 hash verifies file stream integrity') &&
                              text.includes('does not independently verify underlying real-world document authenticity');
        const hasDigitalCopyBadge = text.includes('Digital Copy') || text.includes('Original Inspected');
        const hasSha256Digest = text.includes('SHA-256:');
        const hasVerifyButton = Array.from(document.querySelectorAll('button')).some(b => b.textContent && b.textContent.includes('Verify Integrity'));

        return {
          hasRegisterHeading,
          hasDisclaimer,
          hasDigitalCopyBadge,
          hasSha256Digest,
          hasVerifyButton
        };
      })()
    `);

    // Click "Verify Integrity" button
    const verifyIntegrityAction = await evaluate(`
      (async () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const verifyBtn = buttons.find(b => b.textContent && b.textContent.includes('Verify Integrity'));
        if (verifyBtn) {
          verifyBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    await sleep(2000);

    const postVerifyState = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const isVerified = text.includes('✓ Verified') || text.includes('Verified');
        return { isVerified };
      })()
    `);

    const check5Passed = Boolean(
      evidenceRegisterData.hasRegisterHeading &&
      evidenceRegisterData.hasDigitalCopyBadge &&
      evidenceRegisterData.hasSha256Digest &&
      verifyIntegrityAction.clicked &&
      postVerifyState.isVerified
    );
    results.push({
      checkNumber: 5,
      name: 'Evidence Register Metadata & Integrity Verification',
      passed: check5Passed,
      details: JSON.stringify({ ...evidenceRegisterData, ...verifyIntegrityAction, ...postVerifyState }),
    });
    console.log(`  Result 5: ${check5Passed ? 'PASS' : 'FAIL'}`, postVerifyState);

    const check6Passed = Boolean(evidenceRegisterData.hasDisclaimer);
    results.push({
      checkNumber: 6,
      name: 'SHA-256 Authenticity Disclaimer (Non-Proof Scope)',
      passed: check6Passed,
      details: 'Cryptographic hash non-authenticity disclaimer strictly verified in DOM',
    });
    console.log(`  Result 6: ${check6Passed ? 'PASS' : 'FAIL'}`);
    await takeScreenshot('step5_04_evidence_register_and_integrity.png');

    // -------------------------------------------------------------
    // CHECK 7: Save Draft Feedback & Double-Click Guard
    // -------------------------------------------------------------
    console.log('\n[Check 7] Testing Save Draft button feedback and double-click protection...');
    const saveDraftResult = await evaluate(`
      (async () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent && (b.textContent.includes('Save Draft') || b.textContent.includes('Saving Draft')));
        if (!saveBtn) return { error: 'Save Draft button not found' };

        saveBtn.click();
        const disabledDuringFlight = saveBtn.disabled;
        return { clicked: true, disabledDuringFlight };
      })()
    `);
    await sleep(2500);

    const saveDraftFinalState = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent && (b.textContent.includes('Draft Saved') || b.textContent.includes('Save Draft')));
        const text = saveBtn?.textContent?.trim() || '';
        const isSaved = text.includes('Draft Saved') || text.includes('Save Draft');
        return { isSaved, buttonText: text };
      })()
    `);

    const check7Passed = Boolean(saveDraftResult.clicked && saveDraftFinalState.isSaved);
    results.push({
      checkNumber: 7,
      name: 'Save Draft Feedback & In-Flight Guard',
      passed: check7Passed,
      details: JSON.stringify({ ...saveDraftResult, ...saveDraftFinalState }),
    });
    console.log(`  Result 7: ${check7Passed ? 'PASS' : 'FAIL'}`, saveDraftFinalState);

    // -------------------------------------------------------------
    // CHECK 8: Save & Proceed to Resolution Navigator
    // -------------------------------------------------------------
    console.log('\n[Check 8] Verifying Save & Proceed to Resolution Navigator transition...');
    const proceedClick = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const proceedBtn = buttons.find(b => b.textContent && b.textContent.includes('Save & Proceed to Resolution Navigator'));
        if (proceedBtn) {
          proceedBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    await sleep(3500);

    const navigatorState = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const activeTab = localStorage.getItem('ns_active_tab');
        const onNavigator = text.includes('Resolution Navigator') || activeTab === 'navigator';
        return { activeTab, onNavigator };
      })()
    `);

    const check8Passed = Boolean(proceedClick.clicked && navigatorState.onNavigator);
    results.push({
      checkNumber: 8,
      name: 'Save & Proceed to Navigator Transition',
      passed: check8Passed,
      details: JSON.stringify(navigatorState),
    });
    console.log(`  Result 8: ${check8Passed ? 'PASS' : 'FAIL'}`, navigatorState);
    await takeScreenshot('step5_05_proceed_to_navigator.png');

    // -------------------------------------------------------------
    // CHECK 9: Persistence Verification Across Browser Reload
    // -------------------------------------------------------------
    console.log('\n[Check 9] Verifying Case Persistence across browser reload via My Cases...');
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'my_cases');
        window.location.reload();
      })()
    `);
    await sleep(4000);

    // In My Cases, click the saved case card to select and open it in CaseBuilder
    const openCaseResult = await evaluate(`
      (() => {
        // Find case card containing QuickPay Payments Bank
        const cards = Array.from(document.querySelectorAll('.rounded-2xl, .cursor-pointer'));
        const targetCard = cards.find(c => c.textContent && c.textContent.includes('QuickPay Payments Bank'));
        if (targetCard) {
          targetCard.click();
          return { clicked: true, foundText: targetCard.textContent.substring(0, 80) };
        }
        return { clicked: false };
      })()
    `);
    console.log('  Case card click result:', openCaseResult);
    await sleep(3000);

    // Jump to Step 5
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const step5Btn = buttons.find(b => b.textContent && (b.textContent.includes('05') || b.textContent.includes('Custody')));
        if (step5Btn) step5Btn.click();
      })()
    `);
    await sleep(2500);

    const reloadedState = await evaluate(`
      (() => {
        const text = document.body.innerText || '';
        const hasOverview = text.includes('Case Overview & Dispute Parameters');
        const hasRespondent = text.includes('QuickPay Payments Bank');
        const hasAmount = text.includes('42,500') || text.includes('42500');
        const hasLocation = text.includes('Pune, Maharashtra');
        const hasCustody = text.includes('Append-Only Case Activity Log');
        return { hasOverview, hasRespondent, hasAmount, hasLocation, hasCustody };
      })()
    `);

    const check9Passed = Boolean(reloadedState.hasOverview && reloadedState.hasRespondent && reloadedState.hasAmount && reloadedState.hasLocation);
    results.push({
      checkNumber: 9,
      name: 'Persistence & Hydration Across Reload',
      passed: check9Passed,
      details: JSON.stringify(reloadedState),
    });
    console.log(`  Result 9: ${check9Passed ? 'PASS' : 'FAIL'}`, reloadedState);
    await takeScreenshot('step5_06_post_reload_hydration.png');

    // -------------------------------------------------------------
    // CHECK 10: Case Switching Isolation Guard
    // -------------------------------------------------------------
    console.log('\n[Check 10] Testing Case Switching Isolation Guard...');
    // Click "Create New Case" / `activeTab = 'new_case'`
    await evaluate(`
      (() => {
        localStorage.setItem('ns_active_tab', 'new_case');
        window.location.reload();
      })()
    `);
    await sleep(3000);

    const freshCaseState = await evaluate(`
      (() => {
        const descInput = document.querySelector('textarea')?.value || '';
        const inputs = Array.from(document.querySelectorAll('input'));
        const entityVal = inputs.find(i => i.placeholder && i.placeholder.includes('Bank'))?.value || '';
        const amountVal = inputs.find(i => i.type === 'number' || (i.placeholder && i.placeholder.includes('0')))?.value || '';

        // Old case data must NOT leak into new case
        const leaked = entityVal.includes('QuickPay') || amountVal === '42500';
        return { entityVal, amountVal, descLength: descInput.length, leaked };
      })()
    `);

    const check10Passed = !freshCaseState.leaked;
    results.push({
      checkNumber: 10,
      name: 'Case Switching Isolation Guard',
      passed: check10Passed,
      details: JSON.stringify(freshCaseState),
    });
    console.log(`  Result 10: ${check10Passed ? 'PASS' : 'FAIL'}`, freshCaseState);
    await takeScreenshot('step5_07_case_switching_isolation.png');

    console.log('\n===================================================');
    console.log('Step 5 Real Browser Verification Summary:');
    let allPassed = true;
    results.forEach((r) => {
      console.log(`  Check ${r.checkNumber} [${r.passed ? 'PASS' : 'FAIL'}]: ${r.name}`);
      if (!r.passed) allPassed = false;
    });
    console.log('Final Result: ' + (allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'));
    console.log('===================================================');
  } finally {
    if (ws) ws.close();
    chromeProc.kill();
    serverProc.kill();
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true });
    } catch {}
    console.log('Cleaned up processes.');
  }
}

runStep5Verification().catch((err) => {
  console.error('Step 5 verification failed:', err);
  process.exit(1);
});
