import pdfMake from "pdfmake/build/pdfmake";
import logoUrl from '../logo.png';
import type { Content, ContentStack, ContentText, TDocumentDefinitions } from "pdfmake/interfaces";
import type { Custody, FinancialSummary } from "./custodies";
import type { Transaction } from "./custodyTransactions";

// Existing local fonts cover Arabic custody names and descriptions.
pdfMake.addFonts({
  Tajawal: {
    normal: new URL('/fonts/Tajawal-Regular.ttf', window.location.href).href,
    bold: new URL('/fonts/Tajawal-Bold.ttf', window.location.href).href,
    italics: new URL('/fonts/Tajawal-Regular.ttf', window.location.href).href,
    bolditalics: new URL('/fonts/Tajawal-Bold.ttf', window.location.href).href,
  },
});

export interface CustodyStatementData {
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    vat?: string;
  };
  custody: Custody;
  period: string;
  issued: string;
  summary: FinancialSummary;
  transactions: Transaction[];
}

// Use the same loaded custody, summary, and transactions as the screen.
export function prepareCustodyStatement(
  custody: Custody,
  company: CustodyStatementData['company'],
): CustodyStatementData {
  if (!custody.summary || !custody.transactions) {
    throw new Error('Load the custody summary and transactions before exporting.');
  }
  const dates = custody.transactions.map(tx => tx.transaction_date).sort();
  return {
    company,
    custody,
    summary: custody.summary,
    transactions: custody.transactions,
    period: dates.length
      ? formatDate(dates[0]) + ' – ' + formatDate(dates[dates.length - 1])
      : 'لا توجد حركات',
    issued: formatDate(new Date().toISOString()),
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

// Shape each complete Arabic line together: ordinary spaces make PDFKit split it
// into separate runs and place some spaces on the wrong side of the words.
let textMeasure: CanvasRenderingContext2D | null = null;
function arabicText(value: string, width: number, fontSize = 9, bold = false): ContentStack {
  textMeasure ??= document.createElement('canvas').getContext('2d');
  if (!textMeasure) throw new Error('تعذر تجهيز النص العربي.');
  textMeasure.font = (bold ? '700 ' : '400 ') + fontSize + 'px CustodyStatement';
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? line + ' ' + word : word;
      if (line && textMeasure.measureText(candidate).width > width - 3) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return {
    stack: lines.map(line => ({
      text: /[\u0600-\u06FF]/.test(line)
        ? line.replace(/[A-Za-z0-9\u0660-\u0669\u06F0-\u06F9]+(?:[.,\u066B\u066C:/_-][A-Za-z0-9\u0660-\u0669\u06F0-\u06F9]+)*/g,
            part => [...part].reverse().join(''))
          .replace(/[()\[\]{}<>]/g, char => ({ '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' })[char]!)
          .replace(/ /g, '\u00a0')
        : line,
      noWrap: true,
    })),
    fontSize, bold, alignment: 'right',
  };
}

// ---------- Helper ----------
function formatSAR(value: number): string {
  const abs = Math.abs(value).toLocaleString("ar-SA", {
    numberingSystem: "latn",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `(${abs})` : abs;
}

// Columns are declared left to right in pdfmake, so each table below lists
// its visual leftmost column first; the reading order starts at the right.
export function buildCustodyStatement(data: CustodyStatementData): TDocumentDefinitions {
  const width = 495;
  const text = (value: string, size = 9, bold = false, maxWidth = width) => arabicText(value, maxWidth, size, bold);
  const amount = (value: number): ContentText => ({ text: formatSAR(value), alignment: 'right', fontSize: 9 });
  const section = (title: string): Content => ({
    table: { widths: ['*'], body: [[{ ...text(title, 10, true, 475), color: 'white', margin: [6, 5, 6, 5] }]] },
    layout: { fillColor: () => '#2c5282', hLineWidth: () => 0, vLineWidth: () => 0 },
    margin: [0, 0, 0, 4],
  });
  const companyDetails = [data.company.address, data.company.phone && 'الهاتف: ' + data.company.phone,
    data.company.vat && 'الرقم الضريبي: ' + data.company.vat].filter(Boolean).join(' · ');
  const attachments = data.transactions.map((tx, index) => ({ tx, number: index + 1 })).filter(({ tx }) => tx.doc_path);
  const number = (value: number) => value.toLocaleString('ar-SA', { useGrouping: false, numberingSystem: 'latn' });
  return {
    pageSize: 'A4', pageMargins: [50, 60, 50, 50],
    images: { companyLogo: new URL(logoUrl, window.location.href).href },
    info: { title: 'كشف العهدة', subject: 'حركات العهدة وملخصها المالي' },
    header: () => ({ margin: [50, 20, 50, 0], canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 1.5, lineColor: '#1a365d' }] }),
    footer: (page, count) => ({
      margin: [50, 10, 50, 0],
      columns: [
        { ...text('صفحة ' + number(page) + ' من ' + number(count), 7, false, 115), width: 115 },
        { ...text('كشف العهدة | سري للاستخدام الداخلي', 7, false, 370), width: '*' },
      ], color: '#718096',
    }),
    content: [
      {
        columns: [
          { image: 'companyLogo', fit: [80, 54], width: 80, alignment: 'left' },
          {
            width: '*', margin: [0, 12, 0, 0], stack: [
              { ...text(data.company.name, 14, true, 399), color: '#1a365d', margin: [0, 0, 0, 4] },
              { ...text(companyDetails, 8, false, 399), color: '#4a5568' },
            ],
          },
        ], columnGap: 16, margin: [0, 0, 0, 8],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 1.2, lineColor: '#1a365d' }], margin: [0, 0, 0, 10] },
      { ...text('كشف العهدة', 18, true), color: '#1a365d', margin: [0, 0, 0, 5] },
      { ...text('الفترة: ' + data.period + ' | تاريخ الإصدار: ' + data.issued, 9), margin: [0, 0, 0, 12] },
      section('بيانات العهدة'),
      {
        table: { widths: ['*', 65, '*', 70], body: [
          [ { text: formatDate(data.custody.created_at) }, text('تاريخ الإنشاء', 8, false, 65), { text: data.custody.id }, text('رقم العهدة', 8, false, 70) ],
          [ amount(data.custody.initial_funding), text('مبلغ العهدة', 8, false, 65), text(data.custody.custodian, 9, true, 155), text('صاحب العهدة', 8, false, 70) ],
          [ { ...text(data.custody.type, 9, true, 390), colSpan: 3 }, {}, {}, text('نوع العهدة', 8, false, 70) ],
        ] },
        layout: { fillColor: () => '#edf2f7', hLineWidth: () => 0.4, vLineWidth: () => 0, hLineColor: () => '#cbd5e0', paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 6, paddingBottom: () => 6 },
        margin: [0, 0, 0, 12],
      },
      section('الملخص المالي'),
      {
        table: { widths: [120, '*'], body: [
          [amount(data.custody.initial_funding), text('مبلغ العهدة الأصلي', 9, false, 340)],
          [amount(data.summary.total_deposit), text('إجمالي المقبوضات', 9, false, 340)],
          [amount(data.summary.total_expense), text('إجمالي المصروفات', 9, false, 340)],
          [{ ...amount(data.summary.balance), bold: true, color: '#276749', fontSize: 12 }, text('الرصيد المتبقي', 10, true, 340)],
        ] },
        layout: { fillColor: row => row === 3 ? '#e6fffa' : null, hLineWidth: () => 0.4, vLineWidth: () => 0.8, hLineColor: () => '#1a365d', vLineColor: () => '#1a365d', paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 6, paddingBottom: () => 6 },
        margin: [0, 0, 0, 14],
      },
      section('حركات العهدة'),
      {
        table: { headerRows: 1, widths: [55, 55, 55, 32, '*', 55, 18], body: [
          ['الرصيد', 'المصروفات', 'المقبوضات', 'المرفق', 'البيان', 'تاريخ الفاتورة', 'م'].map((label, i) => ({ ...text(label, 8, true, [55, 55, 55, 32, 150, 55, 18][i]), color: 'white' })),
          ...data.transactions.map((tx, index) => [
            tx.running_balance === undefined ? { text: '—' } : { ...amount(tx.running_balance), bold: true },
            amount(tx.expense), amount(tx.deposit), text(tx.doc_path ? 'مرفق' : '—', 8, false, 32),
            text(tx.description, 9, false, 165), { text: formatDate(tx.transaction_date), fontSize: 8 }, { text: number(index + 1), fontSize: 8 },
          ]),
          [ { ...amount(data.summary.balance), bold: true }, { ...amount(data.summary.total_expense), bold: true }, { ...amount(data.summary.total_deposit), bold: true }, {}, text('الإجمالي', 9, true, 165), {}, {} ],
        ] },
        layout: {
          fillColor: row => row === 0 ? '#2c5282' : row === data.transactions.length + 1 ? '#edf2f7' : row % 2 === 0 ? '#f7fafc' : null,
          hLineWidth: () => 0.4, vLineWidth: () => 0.4, hLineColor: () => '#cbd5e0', vLineColor: () => '#cbd5e0',
          paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 5, paddingBottom: () => 5,
        }, margin: [0, 0, 0, 14],
      },
      section('المرفقات والمستندات المؤيدة'),
      { stack: attachments.length
        ? attachments.map(({ tx, number: row }) => text('مرفق الحركة ' + number(row) + ': ' + tx.description, 9))
        : [text('لا توجد مرفقات.', 9)], margin: [0, 4, 0, 6] },
      { ...text('المرفقات الأصلية محفوظة في النظام. يعرض هذا الكشف بيانات الحركات المرتبطة بها، ولا يتضمن الملفات نفسها.', 8), color: '#4a5568', margin: [0, 0, 0, 12] },
      section('ملاحظات وإقرار'),
      { ...text('يوضح هذا الكشف المقبوضات والمصروفات المسجلة للعهدة خلال الفترة المبينة. جميع المبالغ بالريال السعودي. الرصيد المتبقي يساوي إجمالي المقبوضات مطروحاً منه إجمالي المصروفات. مبلغ العهدة الأصلي معروض للتوضيح ولا يضاف إلى إجمالي المقبوضات مرة أخرى.', 9), margin: [0, 4, 0, 8] },
      { ...text('أُعد هذا الكشف آلياً من نظام إدارة العهد والسلف المالية. للاستفسار، يرجى مراجعة الإدارة المالية أو صاحب العهدة.', 9), margin: [0, 0, 0, 10] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.6, lineColor: '#cbd5e0' }], margin: [0, 0, 0, 6] },
      { ...text(data.company.name, 8), color: '#718096' },
    ],
    defaultStyle: { font: 'Tajawal', fontSize: 9, alignment: 'right', color: '#2d3748', lineHeight: 1.2 },
  };
}

let fontsReady: Promise<void> | undefined;
function loadMeasurementFonts(): Promise<void> {
  return fontsReady ??= (async () => {
    const fonts = await Promise.all([
      new FontFace('CustodyStatement', 'url(/fonts/Tajawal-Regular.ttf)', { weight: '400' }).load(),
      new FontFace('CustodyStatement', 'url(/fonts/Tajawal-Bold.ttf)', { weight: '700' }).load(),
    ]);
    fonts.forEach(font => document.fonts.add(font));
  })().catch(error => { fontsReady = undefined; throw error; });
}

export async function generateCustodyStatementPDF(data: CustodyStatementData): Promise<void> {
  await loadMeasurementFonts();
  const filename = 'كشف_العهدة_' + data.custody.id.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') + '.pdf';
  await pdfMake.createPdf(buildCustodyStatement(data)).download(filename);
}
