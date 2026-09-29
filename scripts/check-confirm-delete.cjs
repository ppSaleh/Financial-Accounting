// Run: node scripts/check-confirm-delete.cjs (no database calls).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'confirm-delete-check-'));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--outDir', output], { cwd: root, stdio: 'inherit' });

class Element {
  constructor() {
    this.listeners = {};
    this.dataset = {};
    this.children = new Map();
    const classes = new Set(['hidden']);
    this.classList = {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
    };
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  querySelector(selector) {
    if (!this.children.has(selector)) this.children.set(selector, new Element());
    return this.children.get(selector);
  }
  querySelectorAll() { return []; }
  appendChild(child) { this.lastChild = child; }
  matches() { return true; }
}
const elements = new Map();
const get = id => {
  if (!elements.has(id)) elements.set(id, new Element());
  return elements.get(id);
};
const documentListeners = {};
const context = vm.createContext({
  Element, console,
  document: {
    getElementById: get, createElement: () => new Element(),
    addEventListener: (type, listener) => { documentListeners[type] = listener; },
    querySelectorAll: () => [],
  },
});
for (const name of ['overlays', 'custodyTransactions']) {
  const source = fs.readFileSync(path.join(output, name + '.js'), 'utf8')
    .replace(/^import .*$/gm, '').replace(/^export \{.*$/gm, '').replace(/^export /gm, '');
  vm.runInContext(name === 'overlays'
    ? `{ ${source}\nglobalThis.confirmAction = confirmAction; }`
    : source, context);
}
const firstRow = new Element(), txnRow = new Element();
txnRow.dataset.id = 'txn-2';
get('txn-body').querySelectorAll = () => [firstRow, txnRow];
vm.runInContext(`
  activeCustody = { id: 'custody-1' };
  txns = [{ id: 'txn-2', description: '<b>Receipt</b>' }];
  toggleEditMode();
`, context);
let deletions = 0, refreshes = 0;
context.deleteTransaction = async txn => { assert.equal(txn.id, 'txn-2'); deletions++; return true; };
context.loadCustody = async () => { refreshes++; };
const button = txnRow.lastChild.querySelector('.custody-delete');
const clickDelete = () => button.listeners.click({ currentTarget: button });
const click = id => get(id).listeners.click();

(async () => {
  for (const cancel of [
    () => click('confirm-overlay-cancel'),
    () => click('confirm-overlay-close'),
    () => documentListeners.keydown({ key: 'Escape' }),
    () => {
      const event = { button: 0, target: get('confirm-overlay') };
      documentListeners.mousedown(event);
      documentListeners.mouseup(event);
    },
  ]) {
    const pending = clickDelete();
    assert.equal(deletions, 0, 'Opening the dialog must not delete');
    assert.equal(get('confirm-overlay').classList.contains('hidden'), false);
    cancel();
    await pending;
    assert.equal(deletions, 0, 'Cancellation must not delete');
    assert.equal(button.disabled, false);
  }
  const pending = clickDelete();
  await clickDelete();
  assert.equal(await context.confirmAction('Second request'), false);
  assert.match(get('confirm-overlay-message').textContent, /<b>Receipt<\/b>/);
  click('confirm-overlay-confirm');
  click('confirm-overlay-confirm');
  await pending;
  assert.equal(deletions, 1, 'Confirm must delete only once');
  assert.equal(refreshes, 1);
  assert.equal(button.disabled, false);
  assert.equal(get('confirm-overlay').classList.contains('hidden'), true);
  console.log('Confirmation and delete-handler checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
