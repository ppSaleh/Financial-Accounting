import { custodies, formatDateDDMMYYYY, switchTable } from "./custodies";
import { isSupervisor, supabaseClient } from "./login";
export { loadCustody, activeCustody };
let activeCustody;
let txns;
const riyalsSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="saudi-riyal" aria-hidden="true" class="lucide lucide-saudi-riyal"><path d="m20 19.5-5.5 1.2"></path><path d="M14.5 4v11.22a1 1 0 0 0 1.242.97L20 15.2"></path><path d="m2.978 19.351 5.549-1.363A2 2 0 0 0 10 16V2"></path><path d="M20 10 4 13.5"></path></svg>';
const body = document.getElementById('txn-body');
const summaryBalance = document.getElementById('trans-sum-balance');
const summaryTotalDeposit = document.getElementById('trans-sum-deposit');
const summaryTotalExpense = document.getElementById('trans-sum-expense');
const idLabel = document.getElementById('custody-id');
const detailsLabel = document.getElementById('custody-details');
const crtForm = document.getElementById('crt-txn-form');
const returnBtn = document.getElementById('trans-return');
const printBtn = document.getElementById('trans-print-btn');
async function loadCustody(importedcustody) {
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
    const fragment = document.createDocumentFragment();
    let order = 1;
    txns.forEach(txn => {
        const row = document.createElement('tr');
        const fileCol = txn.doc_path === null ? '—' : `<button
                                    class="cursor-pointer bg-slate-500 hover:bg-slate-400 text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors">
                                    عرض</button>
                                <button
                                    class="cursor-pointer bg-[#659095] hover:bg-[#83A6AA] text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors">
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
        order++;
        fragment.appendChild(row);
    });
    body.append(fragment);
}
async function loadMeta(forceRefresh = false) {
    // id & details
    idLabel.textContent = activeCustody.id;
    detailsLabel.textContent = activeCustody.custodian + ' • ' + activeCustody.type;
    // Summary section
    if (activeCustody.summary === undefined || forceRefresh) {
        const refreshedSummary = await getCustodySummary(activeCustody.id);
        if (refreshedSummary === null)
            return;
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
async function loadTransactionsForCustody(custodyId, forceRefresh = false) {
    if (custodies[custodyId].transactions === undefined || forceRefresh) {
        const transactions = await fetchTransactions(custodyId); // already sorted by transaction_date, created_at
        let runningBalance = 0;
        custodies[custodyId].transactions = transactions.map(t => {
            runningBalance += t.deposit - t.expense;
            return { ...t, running_balance: runningBalance };
        });
    }
    return custodies[custodyId].transactions;
}
async function getCustodySummary(custodyId) {
    const { data, error } = await supabaseClient
        .rpc('get_custody_summary', { p_custody_id: custodyId })
        .single();
    if (error) {
        console.error('Failed to fetch custody summary:', error);
        return null;
    }
    return data;
}
async function fetchTransactions(custodyId) {
    const { data, error } = await supabaseClient
        .from('custody_transactions')
        .select('id, created_at, custody_id, description, deposit, expense, doc_path, transaction_date')
        .eq('custody_id', custodyId)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true })
        .returns();
    if (error) {
        console.error('Failed to fetch transactions:', error);
        return [];
    }
    return data;
}
returnBtn.addEventListener('click', () => {
    switchTable('custodies');
});
/*async function createTransaction(payload: CustodyTransactionInsert): Promise<CustodyTransaction | null> {
  const { data, error } = await supabaseClient
    .from('custody_transactions')
    .insert(payload)
    .select('id, created_at, custody_id, description, deposit, expense, doc_path, transaction_date')
    .single<CustodyTransaction>()

  if (error) {
    console.error('Failed to create transaction:', error)
    return null
  }

  await loadTransactionsForCustody(data.custody_id) // refresh the list
  delete summaryCache[data.custody_id] // invalidate summary too, if you're using that
  return data
}

async function getCustodySummaryCached(custodyId: string, force = false): Promise<FinancialSummary | null> {
    if (!force && summaryCache[custodyId]) {
        return summaryCache[custodyId]
    }

    const summary = await getCustodySummary(custodyId)
    if (summary) {
        summaryCache[custodyId] = summary
    }
    return summary
}*/ 
