import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

console.log('Testing Chrome CDP launch from inside workspace...');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempProfileDir = path.join(process.env.TEMP || 'C:\\Temp', 'chrome-cdp-test-' + Date.now());

const chrome = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  `--user-data-dir=${tempProfileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
], { stdio: 'ignore' });

async function checkCdp() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        const data = await res.json();
        console.log('Chrome CDP ready! Browser:', data.Browser, 'WS URL:', data.webSocketDebuggerUrl);
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {
      // wait
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Chrome CDP failed to start within 6 seconds');
}

try {
  const wsUrl = await checkCdp();
  const ws = new WebSocket(wsUrl);
  await new Promise(resolve => ws.once('open', resolve));
  console.log('Connected to Chrome WebSocket debugger successfully!');

  let msgId = 1;
  function send(method: string, params: any = {}) {
    const id = msgId++;
    return new Promise<any>((resolve) => {
      const handler = (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Create new target
  const newTarget = await send('Target.createTarget', { url: 'about:blank' });
  console.log('Created browser page target:', newTarget.targetId);

  ws.close();
} finally {
  chrome.kill();
  try {
    fs.rmSync(tempProfileDir, { recursive: true, force: true });
  } catch {}
  console.log('Chrome cleaned up.');
}
