// Run with: node scripts/check-transaction-edit.cjs
// Checks the form against a DOM/Supabase stub; never contacts the database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'transaction-edit-check-'));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--outDir', output], { cwd: root, stdio: 'inherit' });
const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    const classes = new Set();
    elements.set(id, {
      value: '', dataset: {}, textContent: '', listeners: {},
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
        contains: name => classes.has(name),
      },
      addEventListener(type, listener) { this.listeners[type] = listener; },
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; },
      focus() {}, reset() { for (const el of elements.values()) el.value = ''; },
      checkValidity: () => true, reportValidity() {}, dispatchEvent() {},
    });
  }
  return elements.get(id);
}
const writes = [], removed = [], uploaded = [];
let dbError = null, refreshes = 0;
const storage = {
  async upload(name) { uploaded.push(name); return { error: null }; },
  async remove(names) { removed.push(...names); return { error: null }; },
};
const context = vm.createContext({
  document: { getElementById: element, querySelectorAll: () => [] },
  window: { addEventListener() {} }, URL,
  CustomEvent: class { constructor(type, options) { Object.assign(this, { type }, options); } },
  console: { error() {} },
  activeCustody: { id: 'custody-1' },
  loadCustody: async () => { refreshes++; },
  supabaseClient: {
    storage: { from: () => storage },
    from: () => ({
      update(payload) {
        writes.push({ kind: 'update', payload });
        return { eq(key, id) {
          writes.at(-1).id = id;
          return { select: () => ({ single: async () => ({ error: dbError }) }) };
        } };
      },
      async insert(payload) { writes.push({ kind: 'insert', payload }); return { error: dbError }; },
    }),
  },
});
const source = fs.readFileSync(path.join(output, 'createTransaction.js'), 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '');
vm.runInContext(source, context);
const input = name => element('crt-txn-' + name);
const submit = () => input('form').listeners.submit({ preventDefault() {} });
const txn = { id: 'txn-2', description: 'Original', expense: 100, deposit: 0,
  transaction_date: '2020-02-02', doc_path: 'receipts/old.pdf' };
input('form').dataset.availableBalance = '20';

(async () => {
  context.openEdit(txn);
  assert.equal(input('amount').max, '120');
  assert.equal(input('date').value, txn.transaction_date);
  assert.equal(input('file-name').textContent, 'old.pdf');
  await Promise.all([submit(), submit()]);
  assert.equal(writes.length, 1, 'Repeated submit must save once');
  assert.equal(writes[0].id, txn.id);
  assert.equal(writes[0].payload.doc_path, txn.doc_path);
  assert.equal(writes[0].payload.transaction_date, txn.transaction_date);
  assert.equal(refreshes, 1);

  context.openEdit(txn);
  context.selectFile({ name: 'invalid.txt', type: 'text/plain', size: 10 });
  await submit();
  assert.equal(writes.at(-1).payload.doc_path, txn.doc_path, 'Invalid replacement must retain existing receipt');
  assert.equal(removed.length, 0);

  context.openEdit(txn);
  input('clear-file').listeners.click();
  await submit();
  assert.equal(writes.at(-1).payload.doc_path, null);
  assert.equal(removed.at(-1), txn.doc_path);

  context.openEdit(txn);
  context.selectFile({ name: 'new.pdf', type: 'application/pdf', size: 10 });
  await submit();
  assert.equal(writes.at(-1).payload.doc_path, uploaded.at(-1));
  assert.equal(removed.at(-1), txn.doc_path);

  context.openEdit(txn);
  context.selectFile({ name: 'retry.pdf', type: 'application/pdf', size: 10 });
  dbError = { message: 'Update denied' };
  await submit();
  assert.equal(removed.at(-1), uploaded.at(-1), 'Failed edit rolls back new upload only');
  assert.equal(input('overlay').classList.contains('hidden'), false);
  assert.equal(input('action').disabled, false);
  assert.match(input('message').textContent, /Update denied/);
  dbError = null;

  const before = writes.length;
  context.openEdit({ ...txn, expense: 0, deposit: 100 });
  input('amount').value = '79';
  await submit();
  assert.equal(writes.length, before, 'Reducing a deposit must not overdraw the balance');
  input('amount').value = '80';
  await submit();
  assert.equal(writes.at(-1).payload.deposit, 80);

  context.openEdit(txn);
  input('cancel').listeners.click();
  input('open').listeners.click();
  assert.equal(input('description').value, '');
  assert.equal(input('file-name').textContent, 'لم يتم اختيار ملف');
  input('description').value = 'New transaction';
  input('amount').value = '10.25';
  input('date').value = '2020-03-03';
  await submit();
  assert.equal(writes.at(-1).kind, 'insert');
  assert.equal(writes.at(-1).payload.transaction_date, '2020-03-03');
  assert.equal(writes.at(-1).payload.doc_path, null);
  console.log('Transaction edit checks passed (mock DOM and Supabase).');
})().catch(error => { console.error(error); process.exitCode = 1; });
