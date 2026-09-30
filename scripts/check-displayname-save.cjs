// Run: node scripts/check-displayname-save.cjs (mock DOM and Supabase).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'displayname-check-'));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--outDir', output], { cwd: root, stdio: 'inherit' });
const elements = new Map();
function get(id) {
  if (!elements.has(id)) {
    const classes = new Set();
    elements.set(id, {
      value: '', textContent: '', disabled: false, listeners: {}, open: false,
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
      addEventListener(type, fn) { this.listeners[type] = fn; },
      setAttribute(name, value) { this[name] = value; }, removeAttribute(name) { delete this[name]; },
      setCustomValidity(text) { this.error = text; }, reportValidity() { return !this.error; },
      showModal() { this.open = true; }, close() { this.open = false; }, focus() {},
    });
  }
  return elements.get(id);
}
let complete, fail, writes = 0;
const profile = { id: 'user-1', display_name: 'Original' };
const context = vm.createContext({
  document: { getElementById: get }, profile, Displayname: get('display-name'),
  console: { error() {} },
  supabaseClient: { from: () => ({ update: () => ({ eq: () => {
    writes++;
    return new Promise((resolve, reject) => { complete = resolve; fail = reject; });
  } }) }) },
});
const source = fs.readFileSync(path.join(output, 'login.js'), 'utf8');
vm.runInContext(source.slice(source.indexOf('// Display name'), source.indexOf('// Session & Auth')), context);
const input = get('displayname-input'), button = get('displayname-confirm');
const overlay = get('displayname-overlay'), status = get('displayname-status');
button.textContent = 'حفظ التعديل';
(async () => {
  context.showDisplayNamePrompt();
  input.value = '   ';
  await button.listeners.click();
  assert.equal(writes, 0);
  input.value = ' Original ';
  await button.listeners.click();
  assert.equal(writes, 0, 'Unchanged names must not be saved');
  input.value = 'Updated';
  const pending = button.listeners.click();
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'جارٍ الحفظ…');
  assert.equal(button.classList.contains('animate-pulse'), true);
  await button.listeners.click();
  assert.equal(writes, 1);
  let prevented = false;
  overlay.listeners.cancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  get('displayname-cancel').listeners.click();
  assert.equal(overlay.open, true);
  complete({ error: null });
  await pending;
  assert.equal(profile.display_name, 'Updated');
  assert.equal(get('display-name').textContent, 'Updated');
  assert.equal(overlay.open, false, 'Successful save closes the dialog');
  assert.equal(button.disabled, false);
  assert.equal(input.disabled, false);
  assert.equal(button.textContent, 'حفظ التعديل');
  assert.equal(button.classList.contains('animate-pulse'), false);
  for (const throws of [false, true]) {
    context.showDisplayNamePrompt();
    input.value = 'Retry';
    const retry = button.listeners.click();
    if (throws) fail(new Error('Network failure'));
    else complete({ error: { message: 'Denied' } });
    await retry;
    assert.match(status.textContent, /تعذر/);
    assert.equal(button.disabled, false);
    assert.equal(profile.display_name, 'Updated');
    assert.equal(overlay.open, true);
  }
  console.log('Display name saving checks passed (mock DOM and Supabase).');
})().catch(error => { console.error(error); process.exitCode = 1; });
