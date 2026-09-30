import { loadCustody, Transaction } from "./custodyTransactions"
import { isSupervisor, supabaseClient } from "./login"

export { Custody, loadCustodies, custodies, formatDateDDMMYYYY, FinancialSummary, switchTable }

interface Custody {
    id: string
    created_at: string
    custodian: string
    type: 'عهدة مشتريات' | 'عهدة تشغيل وصيانة' | 'عهدة مصاريف سفر' | 'عهدة مكتبية وإدارية' | 'عهدة طوارئ'
    balance: number
    initial_funding: number
    transactions?: Transaction[]
    summary?: FinancialSummary
}
interface FinancialSummary {
    balance: number
    total_deposit: number
    total_expense: number
}

let custodies: Record<string, Custody> = {};

const riyalsSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="saudi-riyal" aria-hidden="true" class="lucide lucide-saudi-riyal"><path d="m20 19.5-5.5 1.2"></path><path d="M14.5 4v11.22a1 1 0 0 0 1.242.97L20 15.2"></path><path d="m2.978 19.351 5.549-1.363A2 2 0 0 0 10 16V2"></path><path d="M20 10 4 13.5"></path></svg>';
const custodiesTable = document.getElementById('custodies-table')!;
const custodiesBody = document.getElementById('custody-body')!;
const custodyTable = document.getElementById('custody-table')!;

async function loadCustodies(forceRefresh = false) {
    if (Object.keys(custodies).length === 0 || forceRefresh) {
        loadSummary();
        custodies = await fetchAllCustodiesAsRecord()
        renderCustodies(Object.values(custodies));
    }
}
function renderCustodies(custodies: Custody[]) {
    custodiesBody.innerHTML = '';
    if (custodies.length === 0) {
        custodiesBody.innerHTML = 'NO CUSTODIES!';
        return;
    }
    const fragment = document.createDocumentFragment();
    let order = 1;
    custodies.forEach(custody => {
        const row = document.createElement('tr');
        const actions = isSupervisor() ? `<button
                                        class="cursor-pointer bg-[#B37073] hover:bg-[#C79497] text-white text-xs font-semibold px-4 py-1.5 rounded-md transition-colors">
                                        حذف</button>
                                    <button
                                        class="cursor-pointer bg-slate-500 text-white text-xs font-semibold px-4 py-1.5 rounded-md hover:bg-slate-400 transition-colors">
                                        تعديل</button>` : ''
        row.classList = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
        row.innerHTML = `<td class="px-4 py-3 text-gray-400 mono">${order}</td>
                            <td class="px-4 py-3 mono font-semibold text-gray-500">${custody.id}</td>
                            <td class="px-4 py-3 text-gray-700">${custody.custodian}</td>
                            <td class="px-4 py-3 mono text-left font-bold text-emerald-600">
                                <span class="flex items-center justify-end gap-1">${custody.initial_funding.toFixed(2)}${riyalsSVG}</span>
                            </td>
                            <td class="px-4 py-3 mono text-left font-bold text-emerald-600">
                                <span class="flex items-center justify-end gap-1">${custody.balance.toFixed(2)}${riyalsSVG}</span>
                            </td>
                            <td class="px-4 py-3">
                                <span
                                    class="text-xs px-3 py-1 rounded-full font-semibold bg-blue-50 text-blue-800 border border-blue-200">${custody.type}</span>
                            </td>
                            <td class="px-4 py-3 mono text-gray-600 text-xs" dir="ltr">${formatDateDDMMYYYY(custody.created_at)}</td>
                            <td class="px-4 py-3 flex items-center gap-2 justify-center">
                                <button
                                    class="custodies-view row-btn">عرض
                                    التفاصيل</button>
                            </td>`;
        row.querySelector('.custodies-view')?.addEventListener('click', () => {
            openCustody(custody.id)
        });
        row.querySelector(`custodies-action`)?.addEventListener('click', () => {

        })
        fragment.appendChild(row);
        order++;
    });
    custodiesBody.appendChild(fragment);
}
function formatDateDDMMYYYY(isoString: string): string {
    const date = new Date(isoString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
}

export function formatReceiptDate(isoString: string, language: 'ar' | 'en' = 'ar'): string {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        calendar: 'gregory',
        numberingSystem: 'latn',
        timeZone: 'UTC',
    }).format(new Date(isoString))
}

async function fetchAllCustodiesAsRecord(): Promise<Record<string, Custody>> {
    const { data, error } = await supabaseClient
        .from('custodies')
        .select('id, created_at, custodian, type, balance, initial_funding')
        .order('created_at', { ascending: false })
        .returns<Custody[]>()

    if (error) {
        console.error('Failed to fetch custodies:', error)
        return {}
    }

    return data.reduce<Record<string, Custody>>((acc, custody) => {
        acc[custody.id] = custody
        return acc
    }, {})
}

const summaryBalance = document.getElementById('sum-balance')!;
const summaryTotalDeposit = document.getElementById('sum-deposit')!;
const summaryTotalExpense = document.getElementById('sum-expense')!;
async function loadSummary() {
    let summary = await getOverallSummary();
    if (summary === null) {
        console.error("unable to get overall summary");
        return;
    }
    summaryBalance.textContent = summary.balance.toFixed(2);
    summaryTotalDeposit.textContent = summary.total_deposit.toFixed(2);
    summaryTotalExpense.textContent = summary.total_expense.toFixed(2);
}
async function getOverallSummary(): Promise<FinancialSummary | null> {
    const { data, error } = await supabaseClient
        .rpc('get_overall_summary')
        .single<FinancialSummary>()

    if (error) {
        console.error('Failed to fetch overall summary:', error)
        return null
    }

    return data
}
function switchTable(table: string) {
    custodiesTable.classList.toggle('hidden', table !== 'custodies');
    custodyTable.classList.toggle('hidden', table !== 'custody');
}
function openCustody(custodyid: string) {
    switchTable('custody');
    loadCustody(custodies[custodyid]);
}
