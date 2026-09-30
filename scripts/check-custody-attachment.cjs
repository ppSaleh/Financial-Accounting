// Run: node scripts/check-custody-attachment.cjs (mock DOM/storage/RPC; no database writes).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'custody-attachment-'));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--outDir', output], { cwd: root, stdio: 'inherit' });
const elements = new Map();
function get(id) {
  if (!elements.has(id)) {
    const classes = new Set();
    elements.set(id, {
      value: '', textContent: '', listeners: {}, disabled: false,
      classList: {
        add: name => classes.add(name), remove: name => classes.delete(name),
        toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
        contains: name => classes.has(name),
      },
      addEventListener(type, fn) { this.listeners[type] = fn; }, focus() {},
      open: false,
      showModal() { this.open = true; },
      close() { this.open = false; },
    });
  }
  return elements.get(id);
}
const rpcCalls = [], uploads = [], removed = [], revoked = [], opened = [];
let rpcError = null, uploadError = null;
const context = vm.createContext({
  document: { getElementById: get, querySelectorAll: () => [...elements.values()] },
  window: { addEventListener() {}, open: (...args) => opened.push(args) },
  URL: { createObjectURL: () => 'blob:receipt', revokeObjectURL: url => revoked.push(url) },
  console: { error() {} }, loadCustodies: async () => {
    assert.equal(get('create-custody-overlay').open, false, 'Close before refreshing custodies');
  },
  supabaseClient: {
    rpc: async (name, args) => { rpcCalls.push({ name, args }); return { error: rpcError }; },
    storage: { from: bucket => {
      assert.equal(bucket, 'receipts');
      return {
        upload: async (path, file) => { uploads.push({ path, file }); return { error: uploadError }; },
        remove: async paths => { removed.push(...paths); return { error: null }; },
      };
    } },
  },
});
vm.runInContext(fs.readFileSync(path.join(output, 'createCustody.js'), 'utf8').replace(/^import .*$/gm, ''), context);
const field = name => get('create-custody-' + name);
const file = { name: 'funding.pdf', type: 'application/pdf', size: 100 };
function fill() {
  field('id').value = 'C-1'; field('custodian').value = 'Test';
  field('type').value = 'عهدة مشتريات'; field('initial-funding').value = '200';
}
async function submit() { fill(); await field('create').listeners.click(); }
(async () => {
  field('btn').listeners.click();
  assert.equal(field('overlay').open, true);
  field('overlay').listeners.cancel({ preventDefault() { assert.fail('Idle dialog should allow Escape'); } });
  const mouse = target => ({ target, button: 0 });
  field('overlay').listeners.mousedown(mouse(field('form')));
  field('overlay').listeners.mouseup(mouse(field('overlay-layout')));
  assert.equal(field('overlay').open, true, 'Dragging from the form to the backdrop must not dismiss');
  field('overlay').listeners.mousedown(mouse(field('overlay-layout')));
  field('overlay').listeners.mouseup(mouse(field('overlay-layout')));
  assert.equal(field('overlay').open, false, 'Backdrop click closes the dialog');
  field('btn').listeners.click();
  field('cancel').listeners.click();
  assert.equal(field('overlay').open, false);
  field('btn').listeners.click();
  await submit();
  assert.equal(field('overlay').open, false, 'Successful creation closes the dialog');
  assert.equal(rpcCalls.at(-1).args.p_doc_path, null);
  assert.equal(uploads.length, 0);

  field('receipt').files = [file];
  field('receipt').listeners.change();
  assert.equal(field('file-name').textContent, file.name);
  field('view-file').listeners.click();
  assert.equal(opened[0][0], 'blob:receipt');
  fill();
  field('btn').listeners.click();
  const saving = field('create').listeners.click();
  let cancelPrevented = false;
  field('overlay').listeners.cancel({ preventDefault() { cancelPrevented = true; } });
  assert.equal(cancelPrevented, true, 'Escape is blocked while saving');
  field('overlay').listeners.mousedown(mouse(field('overlay')));
  field('overlay').listeners.mouseup(mouse(field('overlay')));
  field('cancel').listeners.click();
  assert.equal(field('overlay').open, true, 'Backdrop and Back cannot dismiss while saving');
  await Promise.all([saving, field('create').listeners.click()]);
  assert.equal(rpcCalls.length, 2, 'Repeated click must not create another custody');
  assert.equal(rpcCalls.at(-1).args.p_doc_path, uploads.at(-1).path);
  assert.equal(uploads.at(-1).file, file);
  assert.equal(field('file-name').textContent, 'لم يتم اختيار ملف');
  assert.deepEqual(revoked, ['blob:receipt']);

  context.selectFile(file);
  uploadError = { message: 'Upload denied' };
  await submit();
  assert.equal(rpcCalls.length, 2, 'Failed upload must abort RPC');
  assert.match(field('message').textContent, /تعذر رفع/);
  assert.equal(field('create').disabled, false);

  uploadError = null;
  rpcError = { message: 'Creation denied' };
  await submit();
  assert.equal(removed.at(-1), uploads.at(-1).path);
  assert.match(field('message').textContent, /Creation denied/);
  assert.equal(field('file-name').textContent, file.name, 'Failed save keeps selection for retry');
  rpcError = null;
  await submit();
  assert.equal(field('file-name').textContent, 'لم يتم اختيار ملف');

  context.selectFile({ ...file, type: 'text/plain' });
  assert.match(field('message').textContent, /PDF/);
  context.selectFile({ ...file, size: 6 * 1024 * 1024 + 1 });
  assert.match(field('message').textContent, /6/);
  await submit();
  assert.equal(rpcCalls.at(-1).args.p_doc_path, null, 'Invalid files must not be uploaded');

  field('drop-zone').listeners.drop({ preventDefault() {}, dataTransfer: { files: [file] } });
  assert.equal(field('file-name').textContent, file.name);
  field('clear-file').listeners.click();
  await submit();
  assert.equal(rpcCalls.at(-1).args.p_doc_path, null);
  console.log('Custody attachment checks passed (mock DOM, storage, and RPC).');
})().catch(error => { console.error(error); process.exitCode = 1; });
