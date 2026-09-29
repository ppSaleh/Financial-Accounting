const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
function element(id) {
    if (!elements.has(id)) elements.set(id, {
        addEventListener(event, callback) { this[event] = callback; },
        querySelectorAll() { return []; },
    });
    return elements.get(id);
}

let download;
let blob;
let alerts = 0;
const context = {
    activeCustody: {
        id: 'TEST-1', custodian: 'صالح', type: 'عهدة مشتريات',
        created_at: '2026-09-29', initial_funding: 100, balance: 75,
        summary: { balance: 75, total_deposit: 100, total_expense: 25 },
        transactions: [{
            created_at: '2026-09-29', description: 'شراء، "ورق",\nأقلام',
            doc_path: null, deposit: 0, expense: 25, running_balance: 75,
        }],
    },
    formatDateDDMMYYYY: () => '29-09-2026',
    document: {
        getElementById: element, addEventListener() {},
        body: { appendChild() {} },
        createElement: () => ({ click() { download = this.download; }, remove() {} }),
    },
    Blob: class { constructor(parts) { blob = parts.join(''); } },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    setTimeout: callback => callback(),
    alert: () => alerts++,
};

const compiled = fs.readFileSync('js/custodyTransactions.js', 'utf8');
const marker = '// Print menu and CSV export';
assert.ok(compiled.includes(marker));
const source = "const printBtn = document.getElementById('txn-print-btn');\n" + compiled.slice(compiled.indexOf(marker));
vm.runInNewContext(source, context);
const click = () => element('txn-print-csv').click();
click();
assert.equal(download, 'custody-TEST-1.csv');
assert.equal(blob[0], '\uFEFF');
assert.ok(blob.indexOf('تفاصيل العهدة') < blob.indexOf('الملخص المالي'));
assert.ok(blob.indexOf('الملخص المالي') < blob.indexOf('حركات العهدة'));
assert.ok(blob.includes('"شراء، ""ورق"",\nأقلام"'));
assert.ok(blob.includes('"","0.00","25.00","75.00"'));

context.activeCustody.transactions[0].description = '=1+1';
context.activeCustody.transactions[0].running_balance = -25;
click();
assert.ok(blob.includes('"\'=1+1"'));
assert.ok(blob.includes('"-25.00"'));
context.activeCustody.transactions = [];
click();
assert.ok(blob.includes('حركات العهدة'));
context.activeCustody = undefined;
click();
assert.equal(alerts, 1);
console.log('CSV checks passed: layout, Arabic, escaping, numeric amounts, current data, and missing data.');
