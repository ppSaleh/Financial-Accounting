
import { custodies, Custody, FinancialSummary, formatDateDDMMYYYY, formatReceiptDate, switchTable } from "./custodies";
import { isSupervisor, supabaseClient } from "./login";
import { openEdit } from "./createTransaction";
import { confirmAction } from "./overlays";

export { Transaction, loadCustody, activeCustody }

interface Transaction {
    id: string
    created_at: string
    custody_id: string
    description: string
    deposit: number
    expense: number
    doc_path: string | null
    transaction_date: string
    running_balance?: number
    receipt_url?: string
}

let activeCustody: Custody;
let txns: Transaction[];
const riyalsSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="saudi-riyal" aria-hidden="true" class="lucide lucide-saudi-riyal"><path d="m20 19.5-5.5 1.2"></path><path d="M14.5 4v11.22a1 1 0 0 0 1.242.97L20 15.2"></path><path d="m2.978 19.351 5.549-1.363A2 2 0 0 0 10 16V2"></path><path d="M20 10 4 13.5"></path></svg>';
const riyalsSVGsmol = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="saudi-riyal" aria-hidden="true" class="h-3.5 w-3.5 lucide lucide-saudi-riyal"><path d="m20 19.5-5.5 1.2"></path><path d="M14.5 4v11.22a1 1 0 0 0 1.242.97L20 15.2"></path><path d="m2.978 19.351 5.549-1.363A2 2 0 0 0 10 16V2"></path><path d="M20 10 4 13.5"></path></svg>';
const body = document.getElementById('txn-body')!;
const summaryBalance = document.getElementById('txn-sum-balance')!;
const summaryTotalDeposit = document.getElementById('txn-sum-deposit')!;
const summaryTotalExpense = document.getElementById('txn-sum-expense')!;
const idLabel = document.getElementById('custody-id')!;
const detailsLabel = document.getElementById('custody-details')!;

const crtForm = document.getElementById('crt-txn-form') as HTMLFormElement
const returnBtn = document.getElementById('txn-return')!;
const editBtn = document.getElementById('txn-edit')!;
const printBtn = document.getElementById('txn-print-btn')!;

async function loadCustody(importedcustody: Custody) {
    activeCustody = importedcustody;
    loadMeta();
    showCustodyPulse();
    txns = await loadTransactionsForCustody(importedcustody.id);
    await loadBalance(true);
    await renderCustody();
}
async function renderCustody() {
    body.innerHTML = '';
    receiptsArea.replaceChildren();
    receiptsTable.classList.add('hidden');
    if (txns.length === 0) {
        body.innerHTML = `<td colspan="8" class="p-4 text-center">
                            <p>
                                لا توجد عهد مسجلة حتى الآن،
                                <a id="empty-custody" class="text-blue-500 font-bold underline cursor-pointer">أضف عهدة جديدة
                                </a>
                                للبدء.
                            </p>
                        </td>`;
        const createTxnbtn = document.getElementById('crt-txn-open')!;
        body.querySelector('#empty-custody')?.addEventListener('click', () => createTxnbtn.click());
        return;
    }
    const receiptPaths: string[] = []
    const fragment = document.createDocumentFragment();
    let order = 1;
    txns.forEach(txn => {
        if (txn.doc_path !== null) receiptPaths.push(txn.doc_path)
        const row = document.createElement('tr');
        const fileCol = txn.doc_path === null ? '—' : `<button
                                    class="view-img row-btn">
                                    عرض</button>
                                <button
                                    class="download-img row-btn-green">
                                    تحميل</button>`;
        row.dataset.id = txn.id;
        row.classList = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
        row.innerHTML = `<tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td class="px-4 py-3 text-gray-400 mono">${order}</td>
                            <td class="px-4 py-3 mono text-gray-600 text-xs" dir="ltr">${formatDateDDMMYYYY(txn.created_at)}</td>
                            <td class="px-4 py-3 mono font-semibold text-gray-500">${txn.description}</td>
                            <td class="px-4 py-3 text-gray-400">${fileCol}</td>
                            <td class="px-4 py-3 mono text-left font-bold text-emerald-600">
                                <span class="flex items-center justify-end gap-1 ml-4">${txn.deposit === 0 ? '—' : (txn.deposit.toFixed(2) + riyalsSVG)}</span>
                            </td>
                            <td class="px-4 py-3 mono text-left font-bold text-[#B37073]">
                                <span class="flex items-center justify-end gap-1 ml-4">${txn.expense === 0 ? '—' : (txn.expense.toFixed(2) + riyalsSVG)}</span>
                            </td>
                            <td class="px-4 py-3 mono text-left font-bold text-[#76797D]">
                                <span class="flex items-center justify-end gap-1 ml-4">${txn.running_balance}${riyalsSVG}</span>
                            </td>
                        </tr>`;
        row.querySelector('.view-img')?.addEventListener('click', () => viewReceipt(txn))
        row.querySelector('.download-img')?.addEventListener('click', () => downloadReceipt(txn))
        order++;
        fragment.appendChild(row);
    })
    body.append(fragment);

    if (isEditmode) toggleEditMode();

    loadRecipts();
}
function showCustodyPulse() {
    summaryBalance.textContent = '0.00';
    summaryTotalDeposit.textContent = '0.00';
    summaryTotalExpense.textContent = '0.00';
    body.innerHTML = `<tr>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                        </tr>`;
    receiptsTable.classList.add('hidden');
}
function loadMeta() {
    // id & details
    idLabel.textContent = activeCustody.id;
    detailsLabel.textContent = activeCustody.custodian + ' • ' + activeCustody.type
}
async function loadBalance(forceRefresh = false): Promise<void> {
    // Summary section
    if (activeCustody.summary === undefined || forceRefresh) {
        const refreshedSummary = await getCustodySummary(activeCustody.id);
        if (refreshedSummary === null) return;

        activeCustody.summary = refreshedSummary;
    }

    summaryBalance.textContent = activeCustody.summary.balance.toFixed(2);
    summaryTotalDeposit.textContent = activeCustody.summary.total_deposit.toFixed(2);
    summaryTotalExpense.textContent = activeCustody.summary.total_expense.toFixed(2);

    crtForm.dataset.availableBalance = activeCustody.summary.balance.toFixed(2);
}

async function loadTransactionsForCustody(custodyId: string, forceRefresh = false): Promise<Transaction[]> {
    if (custodies[custodyId].transactions === undefined || forceRefresh) {
        const transactions = await fetchTransactions(custodyId) // already sorted by transaction_date, created_at
        let runningBalance = 0
        custodies[custodyId].transactions = transactions.map(t => {
            runningBalance += t.deposit - t.expense
            return { ...t, running_balance: runningBalance }
        });
    }
    return custodies[custodyId].transactions;
}

async function getCustodySummary(custodyId: string): Promise<FinancialSummary | null> {
    const { data, error } = await supabaseClient
        .rpc('get_custody_summary', { p_custody_id: custodyId })
        .single<FinancialSummary>()

    if (error) {
        console.error('Failed to fetch custody summary:', error)
        return null
    }

    return data
}

async function fetchTransactions(custodyId: string): Promise<Transaction[]> {
    const { data, error } = await supabaseClient
        .from('custody_transactions')
        .select('id, created_at, custody_id, description, deposit, expense, doc_path, transaction_date')
        .eq('custody_id', custodyId)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true })
        .returns<Transaction[]>()

    if (error) {
        console.error('Failed to fetch transactions:', error)
        return []
    }

    return data
}

async function getSignedUrlsForPaths(paths: string[]): Promise<Record<string, string>> {
    if (paths.length === 0) return {}

    const { data, error } = await supabaseClient.storage
        .from('receipts')
        .createSignedUrls(paths, 3600) // 1 hour, matches getReceiptUrl's expiry

    if (error) {
        console.error('Failed to get signed URLs:', error)
        return {}
    }

    const map: Record<string, string> = {}
    for (const item of data) {
        if (item.signedUrl && !item.error) {
            map[item.path!] = item.signedUrl
        } else {
            console.error(`Failed to sign ${item.path}:`, item.error)
        }
    }
    return map
}

async function downloadReceipt(t: Transaction): Promise<void> {
    if (!t.doc_path) return;
    try {
        // Download the original file, never the PDF's page-one preview.
        const { data, error } = await supabaseClient.storage.from('receipts').download(t.doc_path);
        if (error) throw error;
        const objectUrl = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = t.doc_path.split('/').pop() || 'receipt';
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
        console.error('Failed to download receipt:', error);
        alert('تعذر تحميل المرفق. يرجى المحاولة مرة أخرى.');
    }
}
const imageOverlay = document.getElementById('image-overlay')!;
const imageSrc = document.getElementById('image-src') as HTMLImageElement;
async function viewReceipt(t: Transaction): Promise<void> {
    if (!t.receipt_url) {
        alert('المرفق غير جاهز للعرض. يرجى إعادة فتح العهدة والمحاولة مرة أخرى.');
        return;
    }
    if (isPdfReceipt(t)) {
        window.open(t.receipt_url, '_blank', 'noopener,noreferrer');
        return;
    }
    imageOverlay.classList.remove('hidden');
    imageSrc.src = t.receipt_url;
}

function isPdfReceipt(t: Transaction): boolean {
    return /\.pdf$/i.test(t.doc_path ?? '');
}

async function renderPdfPreview(url: string, img: HTMLImageElement): Promise<void> {
    const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    if (!img.isConnected) return;
    GlobalWorkerOptions.workerSrc = workerUrl;
    const task = getDocument({ url });
    // Password-protected files can still be opened in the browser's PDF viewer.
    task.onPassword = () => { void task.destroy(); };
    try {
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        const original = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 800 / Math.max(original.width, original.height) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        if (img.isConnected) img.src = canvas.toDataURL('image/png');
    } finally {
        await task.destroy();
    }
}

const receiptsTable = document.getElementById('custody-attachments-table')!;
const receiptsArea = document.getElementById('custody-attachments')!;
async function loadRecipts() {
    await attachReceiptUrls(txns);
    const txnsReceipts = txns
        .filter(t => t.doc_path !== null);
    if (txnsReceipts.length === 0) {
        receiptsTable.classList.add('hidden');
        return;
    }
    let receiptsArray: string[] = [];
    txnsReceipts.forEach(txn => {
        const isExpense = txn.expense !== 0;
        const amountspan = `<span class="flex shrink-0 items-center gap-1 text-xs font-medium text-${isExpense ? '[#B37073]' : 'emerald-800'}">${isExpense ? txn.expense.toFixed(2) : txn.deposit.toFixed(2)}${riyalsSVGsmol}</span>`;
        let cell: string = `<div class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <button type="button" class="receipt-preview cursor-pointer" aria-label="عرض المرفق">
                                <img class="h-56 w-full bg-gray-50 object-contain p-3" alt="${isPdfReceipt(txn) ? 'PDF — الصفحة الأولى' : 'صورة المرفق'}">
                            </button>
                            <div class="space-y-2 border-t border-gray-100 px-3 py-3 text-right">
                                <span class="block truncate text-sm font-semibold text-gray-700" dir="auto">${txn.description}</span>
                                <div class="flex items-center justify-between gap-2">
                                    <time datetime="${txn.transaction_date}" class="text-xs font-normal text-gray-500">${formatReceiptDate(txn.transaction_date)}</time>
                                    ${amountspan}
                                </div>
                            </div>
                        </div>`;
        receiptsArray.push(cell);
    })
    receiptsArea.innerHTML = receiptsArray.join('\n');
    receiptsTable.classList.remove('hidden');
    receiptsArea.querySelectorAll<HTMLButtonElement>('.receipt-preview').forEach((button, index) => {
        const txn = txnsReceipts[index];
        button.addEventListener('click', () => viewReceipt(txn));
        const img = button.querySelector('img')!;
        if (!txn.receipt_url) {
            img.alt = 'تعذر تحميل المرفق';
        } else if (isPdfReceipt(txn)) {
            void renderPdfPreview(txn.receipt_url, img).catch(error => {
                console.error('Failed to render PDF preview:', error);
                img.alt = 'تعذرت معاينة PDF — اضغط لفتح الملف';
            });
        } else {
            img.src = txn.receipt_url;
        }
    });
}

async function attachReceiptUrls(transactions: Transaction[]): Promise<void> {
    const paths = transactions
        .filter(t => t.doc_path !== null)
        .map(t => t.doc_path as string)

    if (paths.length === 0) return

    const { data, error } = await supabaseClient.storage
        .from('receipts')
        .createSignedUrls(paths, 3600)

    if (error) {
        console.error('Failed to sign receipt URLs:', error)
        return
    }

    const urlByPath: Record<string, string> = {}
    for (const item of data) {
        if (item.signedUrl && item.path) urlByPath[item.path] = item.signedUrl
    }

    for (const t of transactions) {
        t.receipt_url = t.doc_path ? (urlByPath[t.doc_path] ?? undefined) : undefined
    }
}


returnBtn.addEventListener('click', () => {
    switchTable('custodies')
    if (isEditmode) toggleEditMode();
})
const custodyTableRow = document.getElementById('custody-table-head')!;
let isEditmode = false;
editBtn.addEventListener('click', () => {
    toggleEditMode();
})

function toggleEditMode() {
    isEditmode = !isEditmode;
    if (isEditmode) {
        editBtn.classList = 'btn-green';
        custodyTableRow.innerHTML += `<th
                                    class="actions-col px-4 py-3 font-bold text-gray-600 border-b border-gray-200 whitespace-nowrap">
                                    الإجراءات</th>`;
        const rows = body.querySelectorAll('tr');
        if (!rows) return;
        let firstrow = true;
        rows.forEach(row => {
            if (firstrow) {
                firstrow = false;
                const col = document.createElement('td');
                col.classList = 'action-row px-4 py-3';
                col.textContent = '—';
                row.appendChild(col);
                return;
            }
            const col = document.createElement('td');
            col.classList = 'action-row px-4 py-3';
            col.innerHTML = `<button
                                        class="custody-delete row-btn-red">
                                        حذف</button>
                                    <button
                                        class="custody-edit row-btn">
                                        تعديل</button>
`;
            row.appendChild(col);
            const id: string | undefined = row.dataset.id;
            if (!id) {
                console.error('error deleting transcation, no ID found.');
                return;
            }
            const txn = txns.find(txn => txn.id === id);
            if (!txn) {
                console.error('error deleting transcation, no transcation found.');
                return;
            }
            col.querySelector<HTMLButtonElement>('.custody-delete')?.addEventListener('click', async (event) => {
                const button = event.currentTarget as HTMLButtonElement;
                if (button.disabled) return;
                button.disabled = true;
                const custody = activeCustody;
                try {
                    if (!await confirmAction(`هل تريد حذف الفاتورة «${txn.description}»؟`)) return;
                    if (!await deleteTransaction(txn)) return;
                    custody.transactions = undefined;
                    custody.summary = undefined;
                    if (activeCustody === custody) await loadCustody(custody);
                } catch (error) {
                    console.error('Failed to delete or refresh transaction:', error);
                } finally {
                    button.disabled = false;
                }
            });
            col.querySelector('.custody-edit')?.addEventListener('click', () => {
                openEdit(txn);
            });
        })
    } else {
        editBtn.classList = 'btn';
        custodyTableRow.querySelector('.actions-col')?.remove();
        const rows = body.querySelectorAll('tr');
        if (!rows) return;
        rows.forEach(row => {
            row.querySelector('.action-row')?.remove();
        })
    }
}
async function deleteTransaction(txn: Transaction): Promise<boolean> {
    const { error } = await supabaseClient
        .from('custody_transactions')
        .delete()
        .eq('id', txn.id)

    if (error) {
        console.error('Failed to delete transaction:', error)
        return false
    }

    // row is gone — now clean up its receipt, if any
    if (txn.doc_path) {
        const { error: storageError } = await supabaseClient.storage
            .from('receipts')
            .remove([txn.doc_path])

        if (storageError) {
            console.error('Transaction deleted, but receipt removal failed:', storageError)
            // not fatal — the transaction is gone either way, just an orphaned file left behind
        }
    }

    return true
}


// Print menu and CSV export
const printMenu = document.getElementById('txn-print-menu')!;
const printOptions = document.getElementById('txn-print-options')!;

let printMenuOpen = false;

function togglePrintMenu(nextOpen = !printMenuOpen) {
    printMenuOpen = nextOpen;
    printOptions.classList.toggle('opacity-0', !printMenuOpen);
    printOptions.classList.toggle('-translate-y-2', !printMenuOpen);
    printOptions.classList.toggle('pointer-events-none', !printMenuOpen);
    printOptions.inert = !printMenuOpen;
    printBtn.setAttribute('aria-expanded', String(printMenuOpen));
}

printBtn.addEventListener('click', () => togglePrintMenu());

document.addEventListener('click', (event) => {
    if (printMenuOpen && event.target instanceof Node && !printMenu.contains(event.target)) {
        togglePrintMenu(false);
    }
});

document.addEventListener('keydown', (event) => {
    if (printMenuOpen && event.key === 'Escape') {
        togglePrintMenu(false);
        printBtn.focus();
    }
});

printOptions.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
        togglePrintMenu(false);
        printBtn.focus();
    });
});

document.getElementById('txn-print-csv')!.addEventListener('click', downloadCsv);

const pdfButton = document.getElementById('txn-print-pdf') as HTMLButtonElement;
pdfButton.addEventListener('click', async () => {
    const custody = activeCustody;
    if (!custody || !custody.summary || !custody.transactions) {
        alert('يرجى الانتظار حتى تحميل بيانات العهدة والملخص.');
        return;
    }
    if (pdfButton.disabled) return;
    pdfButton.disabled = true;
    try {
        const { prepareCustodyStatement, generateCustodyStatementPDF } = await import('./custodyStatement');
        const data = prepareCustodyStatement(custody, { name: document.title });
        await generateCustodyStatementPDF(data);
    } catch (error) {
        console.error('Failed to export custody PDF:', error);
        alert('تعذر إنشاء ملف PDF. يرجى المحاولة مرة أخرى.');
    } finally {
        pdfButton.disabled = false;
    }
});

function downloadCsv() {
    const custody = activeCustody;
    if (!custody || !custody.summary || !custody.transactions) {
        alert('يرجى الانتظار حتى تحميل بيانات العهدة والملخص.');
        return;
    }

    const rows: (string | number)[][] = [
        ['تفاصيل العهدة'],
        ['رقم العهدة', custody.id],
        ['صاحب العهدة', custody.custodian],
        ['نوع العهدة', custody.type],
        ['تاريخ الإنشاء', formatDateDDMMYYYY(custody.created_at)],
        ['مبلغ العهدة', custody.initial_funding.toFixed(2)],
        ['رصيد العهدة', custody.balance.toFixed(2)],
        [],
        ['الملخص المالي'],
        ['الرصيد المتبقي', custody.summary.balance.toFixed(2)],
        ['إجمالي المدين (القبض)', custody.summary.total_deposit.toFixed(2)],
        ['إجمالي الدائن (الصرف)', custody.summary.total_expense.toFixed(2)],
        [],
        ['حركات العهدة'],
        ['#', 'تاريخ الفاتورة', 'البيان', 'المرفق', 'المقبوضات (مدين)', 'المصروفات (دائن)', 'الرصيد'],
        ...custody.transactions.map((txn, index) => [
            index + 1,
            formatDateDDMMYYYY(txn.created_at),
            txn.description,
            txn.doc_path ?? '',
            txn.deposit.toFixed(2),
            txn.expense.toFixed(2),
            txn.running_balance?.toFixed(2) ?? '',
        ]),
    ];

    const csv = rows.map(row => row.map(value => {
        let text = String(value);
        // Keep user-entered text from being interpreted as a spreadsheet formula.
        if (/^\s*[=+@-]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = "'" + text;
        return `"${text.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');

    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `custody-${custody.id.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
