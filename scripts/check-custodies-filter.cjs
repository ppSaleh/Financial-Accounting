// Run after compiling: node scripts/check-custodies-filter.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/custodies.js'), 'utf8');
const elements = new Map();
function get(id) {
    if (!elements.has(id)) elements.set(id, {
        value: '', type: id.includes('date-') ? 'date' : 'number', inert: true,
        listeners: {}, classes: new Set(), error: '',
        get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); },
        classList: { toggle(name, on) { on ? get(id).classes.add(name) : get(id).classes.delete(name); } },
        addEventListener(event, fn) { this.listeners[event] = fn; },
        querySelectorAll() { return []; },
        setAttribute(name, value) { this[name] = value; },
        setCustomValidity(message) { this.error = message; },
        reportValidity() { return [...elements.values()].every(element => !element.error); },
        focus() { this.focused = true; }, contains(target) { return target === this; },
    });
    return elements.get(id);
}
const events = {};
let rendered;
const custodies = {
    a: { id: 'a', custodian: 'أحمد', initial_funding: 100, balance: 0, type: 'عهدة مشتريات', created_at: '2026-09-30T23:59:59' },
    b: { id: 'b', custodian: 'زيد', initial_funding: 200, balance: -10, type: 'عهدة طوارئ', created_at: '2026-10-01T00:00:00' },
};
const context = vm.createContext({
    document: { getElementById: get, addEventListener: (event, fn) => {
        const previous = events[event];
        events[event] = value => { previous?.(value); fn(value); };
    } },
    Node: Object, custodies, custodiesBody: get('custody-body'), queueMicrotask,
    renderCustodies: rows => rendered = rows.map(row => row.id).join(','),
});
vm.runInContext(source.slice(source.indexOf('function formatDateDDMMYYYY'), source.indexOf('export function formatReceiptDate')), context);
vm.runInContext(source.slice(source.indexOf('// Custody filters'), source.indexOf('async function loadCustodies')), context);
const apply = () => context.applyCustodyFilters();
const set = (id, value) => get(`custodies-${id}`).value = value;
apply();
assert.equal(rendered, 'a,b');
set('initial-min', '100'); set('initial-max', '100');
set('balance-min', '0'); set('balance-max', '0');
set('filter-type', 'عهدة مشتريات');
set('date-min', '2026-09-30'); set('date-max', '2026-09-30');
apply();
assert.equal(rendered, 'a', 'Combined filters include exact money bounds and the whole end date');
set('initial-max', '99'); apply();
assert.ok(get('custodies-initial-max').error, 'Reversed ranges are invalid');
set('initial-max', '100'); set('filter-type', 'عهدة طوارئ'); apply();
assert.match(get('custody-body').innerHTML, /لا توجد عهد تطابق/);
get('custodies-filter-panel').listeners.reset();
for (const element of elements.values()) element.value = '';
queueMicrotask(() => {
    assert.equal(rendered, 'a,b', 'Reset restores all records after native values clear');
    for (const [field, ascending] of [['id', 'a,b'], ['custodian', 'a,b'], ['initial_funding', 'a,b'], ['balance', 'b,a'], ['type', 'b,a'], ['created_at', 'a,b']]) {
        vm.runInContext(`sortField = '${field}'; sortDirection = 'asc'; applyCustodyFilters();`, context);
        assert.equal(rendered, ascending, `${field} ascending`);
        vm.runInContext("sortDirection = 'desc'; applyCustodyFilters();", context);
        assert.equal(rendered, ascending.split(',').reverse().join(','), `${field} descending`);
    }
    set('balance-max', '-1'); apply(); assert.equal(rendered, 'b');
    get('custodies-sort-reset').listeners.click();
    assert.equal(rendered, 'b', 'Clearing sorting preserves filters');
    assert.equal(get('custodies-balance-max').value, '-1');
    assert.equal(vm.runInContext('sortField', context), null);
    assert.equal(get('custodies-sort')['aria-label'], 'ترتيب العهد');
    assert.equal(get('custodies-sort').classes.has('ring-2'), false);
    set('balance-max', ''); apply();
    assert.equal(rendered, 'a,b', 'Clearing sorting restores the original order');
    const search = value => {
        set('search', value);
        get('custodies-search').listeners.input();
    };
    search(' A ');
    assert.equal(rendered, 'a', 'ID search ignores case and surrounding spaces');
    search('حم');
    assert.equal(rendered, 'a', 'Arabic custodian names match partial text');
    set('balance-max', '-1');
    search('حم');
    assert.match(get('custody-body').innerHTML, /لا توجد عهد تطابق/, 'Search intersects filters');
    search('زي');
    assert.equal(rendered, 'b');
    search('');
    assert.equal(rendered, 'b', 'Clearing search preserves active filters');
    set('balance-max', '');
    vm.runInContext("sortField = 'id'; sortDirection = 'desc';", context);
    search('د');
    assert.equal(rendered, 'b,a', 'Matching search results retain the selected sort');
    get('custodies-sort-reset').listeners.click();
    assert.equal(get('custodies-search').value, 'د', 'Clearing sorting preserves search');
    search('<no-match>');
    assert.match(get('custody-body').innerHTML, /لا توجد عهد تطابق/);
    assert.ok(!get('custody-body').innerHTML.includes('<no-match>'), 'Search text is not inserted as markup');
    search('   ');
    assert.equal(rendered, 'a,b', 'Whitespace-only search restores all rows');
    assert.equal(context.compareCustodies(
        { created_at: '2026-10-01T01:00:00+03:00' },
        { created_at: '2026-09-30T22:00:00Z' }, 'created_at'), 0, 'Dates compare actual instants');
    get('custodies-filter').listeners.click();
    assert.equal(get('custodies-filter-panel').inert, false);
    assert.equal(get('custodies-filter')['aria-expanded'], 'true');
    events.keydown({ key: 'Escape' });
    assert.equal(get('custodies-filter-panel').inert, true);
    assert.equal(get('custodies-filter').focused, true);
    get('custodies-filter').listeners.click();
    events.click({ target: {} });
    assert.equal(get('custodies-filter-panel').inert, true);
    get('custodies-sort').listeners.click();
    assert.equal(get('custodies-sort-panel').inert, false);
    events.keydown({ key: 'Escape' });
    assert.equal(get('custodies-sort-panel').inert, true);
    assert.equal(get('custodies-sort').focused, true);
    get('custodies-sort').listeners.click();
    events.click({ target: {} });
    assert.equal(get('custodies-sort-panel').inert, true);
    console.log('Custody search, filters, and sorting passed: combined results, resets, all columns, ranges, dates, and dismissal.');
});
