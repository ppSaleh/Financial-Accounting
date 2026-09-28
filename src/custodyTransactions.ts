import { custodies, Custody, FinancialSummary, formatDateDDMMYYYY, formatReceiptDate, switchTable } from "./custodies";
import { isSupervisor, supabaseClient } from "./login";

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
const summaryBalance = document.getElementById('trans-sum-balance')!;
const summaryTotalDeposit = document.getElementById('trans-sum-deposit')!;
const summaryTotalExpense = document.getElementById('trans-sum-expense')!;
const idLabel = document.getElementById('custody-id')!;
const detailsLabel = document.getElementById('custody-details')!;

const crtForm = document.getElementById('crt-txn-form') as HTMLFormElement
const returnBtn = document.getElementById('trans-return')!;
const printBtn = document.getElementById('trans-print-btn')!;

async function loadCustody(importedcustody: Custody) {
    activeCustody = importedcustody;
    txns = await loadTransactionsForCustody(importedcustody.id);
    await loadMeta(true);
    await renderCustody();
}
async function renderCustody() {
    body.innerHTML = '';
    if (txns.length === 0) {
        body.innerHTML = 'NO TRANSACTIONS';
        return;
    }
    const receiptPaths: string[] = []
    const fragment = document.createDocumentFragment();
    let order = 1;
    txns.forEach(txn => {
        if (txn.doc_path !== null) receiptPaths.push(txn.doc_path)
        const row = document.createElement('tr');
        const fileCol = txn.doc_path === null ? '—' : `<button
                                    class="view-img cursor-pointer bg-slate-500 hover:bg-slate-400 text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors">
                                    عرض</button>
                                <button
                                    class="download-img cursor-pointer bg-[#659095] hover:bg-[#83A6AA] text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors">
                                    تحميل</button>`;
        const buttonCol = isSupervisor() ? ` <button
                                    class="cursor-pointer bg-[#B37073] hover:bg-[#C79497] text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors">
                                    حذف</button>
                                <button
                                    class="cursor-pointer bg-slate-500 text-white text-xs font-semibold px-4 py-1.5 rounded-md hover:bg-slate-400 transition-colors">
                                    تعديل</button>` : '—';
        row.classList = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
        row.innerHTML = `<tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td class="px-4 py-3 text-gray-400 mono">${order}</td>
                            <td class="px-4 py-3 mono text-gray-600 text-xs" dir="ltr">${formatDateDDMMYYYY(txn.created_at)}</td>
                            <td class="px-4 py-3 mono font-semibold text-gray-500">${txn.description}</td>
                            <td class="px-4 py-3 text-gray-400">${fileCol}</td>
                            <td class="px-4 py-3 mono text-left font-bold text-emerald-600">
                                <span class="flex items-center justify-end gap-1">${txn.deposit}${riyalsSVG}</span>
                            </td>
                            <td class="px-4 py-3 mono text-left font-bold text-[#B37073]">
                                <span class="flex items-center justify-end gap-1">${txn.expense}${riyalsSVG}</span>
                            </td>
                            <td class="px-4 py-3 mono text-left font-bold text-[#76797D]">
                                <span class="flex items-center justify-end gap-1">${txn.running_balance}${riyalsSVG}</span>
                            </td>
                            <td class="px-4 py-3">${buttonCol}</td>
                        </tr>`;
        row.querySelector('.view-img')?.addEventListener('click', () => viewReceipt(txn))
        row.querySelector('.download-img')?.addEventListener('click', () => downloadReceipt(txn))
        order++;
        fragment.appendChild(row);
    })
    body.append(fragment);

    loadRecipts();
}

async function loadMeta(forceRefresh = false): Promise<void> {
    // id & details
    idLabel.textContent = activeCustody.id;
    detailsLabel.textContent = activeCustody.custodian + ' • ' + activeCustody.type
    // Summary section
    if (activeCustody.summary === undefined || forceRefresh) {
        const refreshedSummary = await getCustodySummary(activeCustody.id);
        if (refreshedSummary === null) return;

        activeCustody.summary = refreshedSummary;
    }

    summaryBalance.textContent = activeCustody.summary.balance.toString();
    summaryTotalDeposit.textContent = activeCustody.summary.total_deposit.toString();
    summaryTotalExpense.textContent = activeCustody.summary.total_expense.toString();
    summaryBalance.innerHTML += riyalsSVG;
    summaryTotalDeposit.innerHTML += riyalsSVG;
    summaryTotalExpense.innerHTML += riyalsSVG;

    crtForm.dataset.availableBalance = activeCustody.summary.balance.toString();
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
    if (!t.receipt_url || !t.doc_path) {
        console.log('nuh uh')
        return;
    }
    console.log('clicked');

    const res = await fetch(t.receipt_url)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = objectUrl
    a.download = t.doc_path.split('/').pop() ?? 'receipt'
    a.click()

    URL.revokeObjectURL(objectUrl)
}
const imageOverlay = document.getElementById('image-overlay')!;
const imageSrc = document.getElementById('image-src') as HTMLImageElement;
async function viewReceipt(t: Transaction): Promise<void> {
    imageOverlay.classList.remove('hidden');
    imageSrc.src = t.receipt_url ?? '';
}

const receiptsTable = document.getElementById('custody-attachments-table')!;
const receiptsArea = document.getElementById('custody-attachments')!;
async function loadRecipts() {
    await attachReceiptUrls();
    const txnsReceipts = txns
        .filter(t => t.doc_path !== null);
    if (txnsReceipts.length === 0) {
        receiptsTable.classList.add('hidden');
        return;
    }
    console.log(txnsReceipts);
    let receiptsArray: string[] = [];
    txnsReceipts.forEach(txn => {
        const isExpense = txn.expense !== 0;
        const amountspan = `<span class="flex shrink-0 items-center gap-1 text-xs font-medium text-${isExpense ? '[#B37073]' : 'emerald-800'}">${isExpense ? txn.expense : txn.deposit}${riyalsSVGsmol}</span>`;
        let cell: string = `<div class="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <img class="h-56 w-full bg-gray-50 object-contain p-3" src="${txn.receipt_url}">
                            <div class="space-y-2 border-t border-gray-100 px-3 py-3 text-right">
                                <span class="block truncate text-sm font-semibold text-gray-700" dir="auto">${txn.description}</span>
                                <div class="flex items-center justify-between gap-2">
                                    <time datetime="${txn.transaction_date}" dir="ltr" class="text-xs font-normal text-gray-500">${formatReceiptDate(txn.transaction_date)}</time>
                                    ${amountspan}
                                </div>
                            </div>
                        </div>`;
        receiptsArray.push(cell);
    })
    receiptsArea.innerHTML = receiptsArray.join('\n');
    receiptsTable.classList.remove('hidden');
}

async function attachReceiptUrls(): Promise<void> {
    const paths = txns
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

    for (const t of txns) {
        t.receipt_url = t.doc_path ? (urlByPath[t.doc_path] ?? undefined) : undefined
    }
}


returnBtn.addEventListener('click', () => {
    switchTable('custodies')
})
