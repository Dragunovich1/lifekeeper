import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = 'C:\\Users\\Dragunovich\\.gemini\\antigravity\\brain\\7cb6c473-4302-40e0-a7d8-d4809d016326\\preview';
const tmpDir = path.join(os.tmpdir(), 'chrome_cdp_' + Date.now());

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

console.log('Starting Chrome for mobile capture...');
const chrome = spawn(chromePath, [
  '--remote-debugging-port=9222',
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${tmpDir}`,
  '--window-size=412,915',
  'about:blank'
], { stdio: 'ignore' });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) return;
    } catch {}
    await sleep(400);
  }
  throw new Error('Chrome remote debugging port not available');
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.msgId = 1;
    this.callbacks = new Map();
  }

  init() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const { resolve, reject } = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        } catch (e) {
          console.error(e);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  try {
    await waitForPort();
    console.log('Chrome ready. Opening local app on 127.0.0.1:4173...');

    let tabData;
    try {
      const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:4173/', { method: 'PUT' });
      tabData = await newTabRes.json();
    } catch {
      const listRes = await fetch('http://127.0.0.1:9222/json/list');
      const tabs = await listRes.json();
      tabData = tabs[0];
    }
    console.log('Target tab opened:', tabData.id);
    const client = new CDPClient(tabData.webSocketDebuggerUrl);
    await client.init();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');
    await client.send('Page.navigate', { url: 'http://127.0.0.1:4173/' });

    // Emulate mobile Pixel 7 device
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 412,
      height: 915,
      deviceScaleFactor: 2.625,
      mobile: true,
      screenOrientation: { angle: 0, type: 'portraitPrimary' }
    });

    await client.send('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    });

    await sleep(2500);

    // Register / Create vault to enter dashboard
    console.log('Filling registration to enter dashboard...');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        function setVal(id, val) {
          const el = document.getElementById(id);
          if (el) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, val);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        setVal('signup-firstname', 'Nicolás');
        setVal('signup-lastname', 'LifeKeeper');
        setVal('signup-username', 'dragunovich');
        setVal('signup-email', 'dragunovich@lifekeeper.lat');
        setVal('signup-password', 'MasterKey123456!');
        setVal('signup-confirm', 'MasterKey123456!');

        const submitBtn = document.querySelector('button[type="submit"], form.auth-form button');
        if (submitBtn) submitBtn.click();
      })()`
    });

    console.log('Waiting for vault creation & dashboard mount...');
    await sleep(3500);

    // 1. Capture Mobile Dashboard
    console.log('Capturing Screen 1: Mobile Dashboard');
    const shot1 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'apk_new_01_dashboard.png'), Buffer.from(shot1.data, 'base64'));

    // 2. Navigate to Health Section
    console.log('Navigating to Health Section...');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        window.location.hash = '#health:vaccines';
      })()`
    });
    await sleep(2000);

    console.log('Capturing Screen 2: Mobile Health Section');
    const shot2 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'apk_new_02_health.png'), Buffer.from(shot2.data, 'base64'));

    // 3. Open "Más" Menu Bottom Sheet
    console.log('Opening "Más" Menu Sheet...');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const tabs = Array.from(document.querySelectorAll('.mobile-nav-tab'));
        const masTab = tabs.find(t => t.textContent.includes('Más'));
        if (masTab) masTab.click();
      })()`
    });
    await sleep(1500);

    console.log('Capturing Screen 3: Mobile Menu Sheet');
    const shot3 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'apk_new_03_menusheet.png'), Buffer.from(shot3.data, 'base64'));

    // 4. Test Desktop Web View (Unchanged verification)
    console.log('Testing desktop view (1280x800)...');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await client.send('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        window.location.hash = '';
        window.dispatchEvent(new Event('resize'));
      })()`
    });
    await sleep(2000);

    console.log('Capturing Screen 4: Desktop Web Intact');
    const shot4 = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'apk_new_04_desktop.png'), Buffer.from(shot4.data, 'base64'));

    client.close();
    console.log('All screens captured successfully!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    try { chrome.kill(); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    process.exit(0);
  }
}

run();
