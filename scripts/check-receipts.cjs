// Run: node scripts/check-receipts.cjs (DOM/storage stubs; no database calls).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-check-'));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--outDir', output], { cwd: root, stdio: 'inherit' });
const elements = new Map();
function element() {
  const classes = new Set(['hidden']);
  return {
    listeners: {}, img: {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    querySelector() { return this.img; },
    querySelectorAll() { return this.buttons || []; },
    set innerHTML(html) { this.buttons = [...html.matchAll(/class="receipt-preview/g)].map(element); },
    click() { this.clicked = true; }, remove() {},
  };
}
const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
const opened = [], previews = [], alerts = [], timers = [], revoked = [];
let downloaded, anchor, storageError = null;
const blob = new Blob(['original PDF']);
const context = vm.createContext({
  console: { error() {} },
  document: { getElementById: get, createElement: () => (anchor = element()), body: { append() {} } },
  window: { open: (...args) => opened.push(args) },
  alert: message => alerts.push(message),
  setTimeout: fn => timers.push(fn),
  URL: { createObjectURL: data => { assert.equal(data, blob); return 'blob:original'; }, revokeObjectURL: url => revoked.push(url) },
  formatReceiptDate: date => date,
  supabaseClient: { storage: { from: () => ({
    download: async name => { downloaded = name; return { data: blob, error: storageError }; },
    createSignedUrls: async paths => ({ data: paths.map(path => ({ path, signedUrl: `https://receipts.test/${path}` })), error: null }),
  }) } },
});
vm.runInContext(fs.readFileSync(path.join(output, 'custodyTransactions.js'), 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export \{.*$/gm, ''), context);
context.renderPdfPreview = async (url, img) => { previews.push(url); img.src = 'data:image/png;base64,preview'; };

(async () => {
  const pdf = { doc_path: 'receipts/scan.PDF', receipt_url: 'https://receipts.test/scan.PDF', expense: 5, deposit: 0, description: 'PDF' };
  const image = { ...pdf, doc_path: 'receipts/photo.jpg', receipt_url: 'https://receipts.test/photo.jpg' };
  await context.viewReceipt(pdf);
  assert.deepEqual(opened[0], [pdf.receipt_url, '_blank', 'noopener,noreferrer']);
  assert.equal(get('image-overlay').classList.contains('hidden'), true);
  await context.viewReceipt(image);
  assert.equal(get('image-src').src, image.receipt_url);
  assert.equal(get('image-overlay').classList.contains('hidden'), false);
  await context.viewReceipt({ doc_path: 'pending.pdf' });
  assert.equal(alerts.length, 1);
  context.testTransactions = [pdf, image];
  vm.runInContext('txns = testTransactions', context);
  await context.loadRecipts();
  const buttons = get('custody-attachments').buttons;
  assert.equal(previews.length, 1);
  assert.match(buttons[0].img.src, /^data:image\/png/);
  assert.equal(buttons[1].img.src, image.receipt_url);
  buttons[0].listeners.click();
  assert.equal(opened.length, 2);
  await context.downloadReceipt(pdf);
  assert.equal(downloaded, pdf.doc_path);
  assert.equal(anchor.download, 'scan.PDF');
  assert.equal(anchor.href, 'blob:original');
  assert.equal(anchor.clicked, true);
  assert.equal(revoked.length, 0);
  timers[0]();
  assert.deepEqual(revoked, ['blob:original']);
  storageError = new Error('Download failed');
  await context.downloadReceipt(image);
  assert.equal(alerts.length, 2);
  console.log('PDF/image routing, receipt cards, original-file downloads and failure checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
