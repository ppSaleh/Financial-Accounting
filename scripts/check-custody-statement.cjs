// Run after compiling: node scripts/check-custody-statement.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const pdfMake = require('pdfmake/build/pdfmake');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

for (const name of ['Tajawal-Regular.ttf', 'Tajawal-Bold.ttf']) {
  GlobalFonts.registerFromPath(path.resolve('public/fonts', name), 'CustodyStatement');
  pdfMake.addVirtualFileSystem({
    ['http://localhost/fonts/' + name]: fs.readFileSync('public/fonts/' + name).toString('base64'),
  });
}
const context = vm.createContext({
  logoUrl: 'data:image/png;base64,' + fs.readFileSync('logo.png').toString('base64'),
  pdfMake, URL, window: { location: { href: 'http://localhost/' } },
  document: { createElement: () => createCanvas(1, 1) },
});
vm.runInContext(fs.readFileSync('js/custodyStatement.js', 'utf8')
  .replace(/^import .*;$/gm, '').replace(/^export /gm, ''), context);

const descriptions = [
  'رصيد أول المدة صالح (عبدالله) محمد', 'شراء مستلزمات مكتبية', 'شراء معدات',
  'تعبئة وقود', 'استرداد مبلغ',
  'شراء مستلزمات مكتبية وتجهيزات إضافية للمكتب مع توصيل الطلبات وتركيب المعدات والتأكد من مطابقة جميع البنود للفاتورة المعتمدة',
  'شراء عدد 12 بقيمة 4,300.00 ريال للفاتورة رقم 2026/09',
];
const transactions = descriptions.map((description, index) => ({
  transaction_date: '2026-09-29', description, doc_path: index % 2 ? 'receipts/test.pdf' : null,
  deposit: index === 0 ? 4000 : index === 4 ? 300 : 0,
  expense: [0, 500, 2000, 100, 0, 0, 0][index],
  running_balance: [4000, 3500, 1500, 1400, 1700, 1700, 1700][index],
}));
const custody = {
  id: '١٠٠١', custodian: 'صالح (عبدالله) محمد', type: 'عهدة مشتريات', created_at: '2026-09-01',
  initial_funding: 4000, summary: { balance: 1700, total_deposit: 4300, total_expense: 2600 }, transactions,
};

(async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  for (const count of [transactions.length, 0, 60]) {
    const input = { ...custody, transactions: Array.from({ length: count }, (_, i) => transactions[i % transactions.length]) };
    const data = context.prepareCustodyStatement(input, { name: 'نظام إدارة العهد والسلف المالية' });
    const doc = context.buildCustodyStatement(data);
    assert.equal(data.transactions, input.transactions);
    assert.equal(data.summary.balance, 1700);
    const table = doc.content.find(item => item.table?.headerRows === 1).table;
    assert.equal(table.body[0].length, 7);
    assert.equal(table.body[0][6].stack[0].text, 'م');
    assert.equal(table.body[0][0].stack[0].text, 'الرصيد');
    const buffer = await pdfMake.createPdf(doc).getBuffer();
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    const task = getDocument({ data: new Uint8Array(buffer) });
    const pdf = await task.promise;
    if (count === 60) assert.ok(pdf.numPages > 1);
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      assert.ok(!content.items.some(item => /[A-Za-z]/.test(item.str ?? '')), 'Unexpected English text');
      if (count === transactions.length) {
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
        const preview = path.join(os.tmpdir(), `arabic-statement-${pageNumber}.png`);
        fs.writeFileSync(preview, canvas.toBuffer('image/png'));
        console.log(preview);
      }
    }
    console.log(`Arabic PDF passed: ${count} transactions, ${pdf.numPages} pages.`);
    await task.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
