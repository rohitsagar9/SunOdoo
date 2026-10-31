import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const userDataDir = path.join(os.tmpdir(), `sunpower-chrome-${Date.now()}`);
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1440,1000',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForChrome() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      // not ready yet
    }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      } else if (message.method) {
        this.events.push(message);
      }
    });
  }

  send(method, params = {}) {
    this.id += 1;
    const id = this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(new CDP(ws)));
    ws.addEventListener('error', (event) => reject(new Error(String(event.message ?? 'ws error'))));
  });
}

const checks = [];
function check(label, condition, detail = '') {
  checks.push({ label, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  await waitForChrome();

  const targetResponse = await fetch(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('http://localhost:3000/login')}`,
    { method: 'PUT' },
  );
  const target = await targetResponse.json();
  const cdp = await connect(target.webSocketDebuggerUrl);

  const pageErrors = [];
  cdp.ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      pageErrors.push(message.params.exceptionDetails?.exception?.description ?? 'Unknown exception');
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      pageErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await sleep(2500);

  async function evaluate(expression) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'Evaluation failed');
    }
    return result.result?.value;
  }

  async function goto(url, expectedText, label) {
    await cdp.send('Page.navigate', { url });
    const targetPath = new URL(url).pathname;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await sleep(250);
      const state = await evaluate(
        `({ ready: document.readyState, path: window.location.pathname, text: document.body ? document.body.innerText : '' })`,
      );
      if (state.ready === 'complete' && state.path === targetPath) {
        const hasText = Array.isArray(expectedText)
          ? expectedText.every((item) => state.text.includes(item))
          : state.text.includes(expectedText);
        if (hasText) {
          check(label, true);
          return state.text;
        }
      }
    }
    const final = await evaluate('document.body ? document.body.innerText : ""');
    const hasText = Array.isArray(expectedText)
      ? expectedText.every((item) => final.includes(item))
      : final.includes(expectedText);
    check(label, hasText, hasText ? '' : `missing: ${expectedText} | body: ${final.slice(0, 260).replace(/\n/g, ' / ')}`);
    return final;
  }

  // Sign in through the API and persist the same storage the app uses.
  const login = await evaluate(`(async () => {
    const response = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'director@sunpower.in', password: 'SunPower@123' }),
    });
    const data = await response.json();
    localStorage.setItem('sp_token', data.token);
    localStorage.setItem('sp_user', JSON.stringify(data.user));
    return data.user;
  })()`);
  check('browser login stores session', login?.role === 'DIRECTOR', login?.email ?? 'no user');

  const dashboardPages = [
    ['/dashboard/director', ['Director overview', 'Revenue today'], 'director dashboard renders'],
    ['/dashboard/leads', ['Leads', 'Pipeline'], 'leads kanban renders'],
    ['/dashboard/quotes', ['Quotes'], 'quotes list renders'],
    ['/dashboard/payments', ['Payment'], 'payment approvals render'],
    ['/dashboard/orders', ['Orders'], 'orders list renders'],
    ['/dashboard/schedule', ['Schedule'], 'schedule renders'],
    ['/dashboard/warehouse', ['Dispatch control', 'Packing & dispatch queue'], 'warehouse overview renders'],
    ['/dashboard/inventory', ['Inventory & serials', 'Stock summary'], 'inventory renders'],
    ['/dashboard/barcodes', ['Barcode library', 'Labels generated'], 'barcode library renders'],
    ['/dashboard/subsidies', ['PM Surya Ghar subsidies'], 'subsidies render'],
    ['/dashboard/expenses', ['Expense book'], 'expenses render'],
    ['/dashboard/support', ['Support desk'], 'support desk renders'],
  ];

  for (const [route, text, label] of dashboardPages) {
    await goto(`http://localhost:3000${route}`, text, label);
  }

  // Public pages do not require auth.
  await goto('http://localhost:3000/portal?phone=9876543218', ['Lakshmi', 'Your orders'], 'customer portal renders seeded customer');
  await goto('http://localhost:3000/q/demo-meenakshi', ['Your solar proposal', 'Itemised bill of materials'], 'public quote renders');
  await goto('http://localhost:3000/', ['SunPower', 'Get a free solar plan'], 'landing page renders');

  // Reload a dashboard while signed out to confirm the guard redirects to login.
  await evaluate('localStorage.clear()');
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/dashboard/director' });
  await sleep(3000);
  const guardedUrl = await evaluate('window.location.pathname');
  check('auth guard redirects signed-out dashboard to login', guardedUrl === '/login', guardedUrl);

  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));

  cdp.ws.close();
  chrome.kill();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // best effort
  }

  const failed = checks.filter((item) => !item.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} browser checks passed.`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Browser test crashed:', error);
    chrome.kill();
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 500);
  });
