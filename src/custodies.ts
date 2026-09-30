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

// Custody filters
const custodySearch = document.getElementById('custodies-search') as HTMLInputElement;
custodySearch.addEventListener('input', applyCustodyFilters);
const filterButton = document.getElementById('custodies-filter')!;
const filterMenu = document.getElementById('custodies-filter-menu')!;
const filterPanel = document.getElementById('custodies-filter-panel') as HTMLFormElement;
const initialMin = document.getElementById('custodies-initial-min') as HTMLInputElement;
const initialMax = document.getElementById('custodies-initial-max') as HTMLInputElement;
const balanceMin = document.getElementById('custodies-balance-min') as HTMLInputElement;
const balanceMax = document.getElementById('custodies-balance-max') as HTMLInputElement;
const filterType = document.getElementById('custodies-filter-type') as HTMLSelectElement;
const dateMin = document.getElementById('custodies-date-min') as HTMLInputElement;
const dateMax = document.getElementById('custodies-date-max') as HTMLInputElement;

function setFiltersOpen(open: boolean) {
    filterPanel.classList.toggle('opacity-0', !open);
    filterPanel.classList.toggle('-translate-y-2', !open);
    filterPanel.classList.toggle('pointer-events-none', !open);
    filterPanel.inert = !open;
    filterButton.setAttribute('aria-expanded', String(open));
}
filterButton.addEventListener('click', () => setFiltersOpen(filterPanel.inert));
document.getElementById('custodies-filter-close')!.addEventListener('click', () => {
    setFiltersOpen(false);
    filterButton.focus();
});
document.addEventListener('click', event => {
    if (event.target instanceof Node && !filterMenu.contains(event.target)) setFiltersOpen(false);
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !filterPanel.inert) {
        setFiltersOpen(false);
        filterButton.focus();
    }
});
filterPanel.addEventListener('submit', event => event.preventDefault());
filterPanel.addEventListener('input', applyCustodyFilters);
filterPanel.addEventListener('reset', () => {
    // The reset event fires before native controls receive their default values.
    queueMicrotask(applyCustodyFilters);
});

function applyCustodyFilters() {
    const ranges = [[initialMin, initialMax], [balanceMin, balanceMax], [dateMin, dateMax]];
    for (const [min, max] of ranges) {
        const reversed = min.value !== '' && max.value !== '' && (min.type === 'number'
            ? min.valueAsNumber > max.valueAsNumber : min.value > max.value);
        max.setCustomValidity(reversed ? 'يجب أن تكون قيمة النهاية أكبر من أو تساوي البداية' : '');
    }
    if (!filterPanel.reportValidity()) return;
    const inRange = (value: number, min: HTMLInputElement, max: HTMLInputElement) =>
        (min.value === '' || value >= min.valueAsNumber) &&
        (max.value === '' || value <= max.valueAsNumber);
    const search = custodySearch.value.trim().toLocaleLowerCase();
    const filtered = Object.values(custodies).filter(custody => {
        // Match the local calendar date displayed in the table, including the entire end day.
        const [day, month, year] = formatDateDDMMYYYY(custody.created_at).split('-');
        const date = `${year}-${month}-${day}`;
        return (!search || custody.id.toLocaleLowerCase().includes(search) || custody.custodian.toLocaleLowerCase().includes(search)) &&
            inRange(custody.initial_funding, initialMin, initialMax) &&
            inRange(custody.balance, balanceMin, balanceMax) &&
            (!filterType.value || custody.type === filterType.value) &&
            (!dateMin.value || date >= dateMin.value) &&
            (!dateMax.value || date <= dateMax.value);
    });
    filterButton.classList.toggle('ring-2', [initialMin, initialMax, balanceMin, balanceMax, filterType, dateMin, dateMax].some(input => input.value !== ''));
    if (filtered.length === 0 && Object.keys(custodies).length > 0) {
        custodiesBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-gray-500">لا توجد عهد تطابق معايير البحث والتصفية.</td></tr>';
        return;
    }
    const field = sortField;
    if (field) filtered.sort((a, b) => compareCustodies(a, b, field) * (sortDirection === 'asc' ? 1 : -1));
    renderCustodies(filtered);
}

// Custody sorting
type SortField = 'id' | 'custodian' | 'initial_funding' | 'balance' | 'type' | 'created_at';
let sortField: SortField | null = null;
let sortDirection = 'asc';
const sortButton = document.getElementById('custodies-sort')!;
const sortMenu = document.getElementById('custodies-sort-menu')!;
const sortPanel = document.getElementById('custodies-sort-panel')!;
const sortStatus = document.getElementById('custodies-sort-status')!;
const sortOptions = sortPanel.querySelectorAll<HTMLButtonElement>('button[data-sort]');
const textOrder = new Intl.Collator('ar', { sensitivity: 'base' });

function compareCustodies(a: Custody, b: Custody, field: SortField): number {
    if (field === 'initial_funding' || field === 'balance') return a[field] - b[field];
    if (field === 'created_at') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return textOrder.compare(a[field], b[field]);
}
function setSortOpen(open: boolean) {
    sortPanel.classList.toggle('opacity-0', !open);
    sortPanel.classList.toggle('-translate-y-2', !open);
    sortPanel.classList.toggle('pointer-events-none', !open);
    sortPanel.inert = !open;
    sortButton.setAttribute('aria-expanded', String(open));
}
sortButton.addEventListener('click', () => setSortOpen(sortPanel.inert));
document.getElementById('custodies-sort-reset')!.addEventListener('click', () => {
    sortField = null;
    sortDirection = 'asc';
    sortOptions.forEach(button => button.setAttribute('aria-pressed', 'false'));
    sortPanel.querySelectorAll<HTMLElement>('[data-field]').forEach(row => row.classList.toggle('active', false));
    sortStatus.textContent = 'اختر العمود واتجاه الترتيب';
    sortButton.title = '';
    sortButton.setAttribute('aria-label', 'ترتيب العهد');
    sortButton.classList.toggle('ring-2', false);
    applyCustodyFilters();
    setSortOpen(false);
    sortButton.focus();
});
document.getElementById('custodies-sort-close')!.addEventListener('click', () => {
    setSortOpen(false);
    sortButton.focus();
});
sortOptions.forEach(option => option.addEventListener('click', () => {
    sortField = option.dataset.sort as SortField;
    sortDirection = option.dataset.direction!;
    sortOptions.forEach(button => button.setAttribute('aria-pressed', String(
        button.dataset.sort === sortField && button.dataset.direction === sortDirection
    )));
    sortPanel.querySelectorAll<HTMLElement>('[data-field]').forEach(row => {
        row.classList.toggle('active', row.dataset.field === sortField);
    });
    const selected = Array.from(sortOptions).find(button =>
        button.dataset.sort === sortField && button.dataset.direction === sortDirection && button.title
    )!;
    sortStatus.textContent = selected.getAttribute('aria-label');
    sortButton.title = sortStatus.textContent ?? '';
    sortButton.setAttribute('aria-label', 'ترتيب العهد: ' + sortStatus.textContent);
    sortButton.classList.toggle('ring-2', true);
    applyCustodyFilters();
    setSortOpen(false);
    sortButton.focus();
}));
document.addEventListener('click', event => {
    if (event.target instanceof Node && !sortMenu.contains(event.target)) setSortOpen(false);
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !sortPanel.inert) {
        setSortOpen(false);
        sortButton.focus();
    }
});

async function loadCustodies(forceRefresh = false) {
    if (Object.keys(custodies).length === 0 || forceRefresh) {
        showCustodiesPulse();
        loadSummary();
        custodies = await fetchAllCustodiesAsRecord()
        applyCustodyFilters();
    }
}
function showCustodiesPulse() {
    summaryBalance.textContent = '0.00';
    summaryTotalDeposit.textContent = '0.00';
    summaryTotalExpense.textContent = '0.00';
    custodiesBody.innerHTML = `<tr>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                            <td class="px-3 py-2"><div class="skeleton"></div></td>
                        </tr>`;
}
function renderCustodies(custodies: Custody[]) {

    if (custodies.length === 0) {
        custodiesBody.innerHTML = `<td colspan="8" class="p-4 text-center">
                            <p>
                                لا توجد عهد مسجلة حتى الآن،
                                <a id="empty-custodies" class="text-blue-500 font-bold underline cursor-pointer">أضف عهدة جديدة
                                </a>
                                للبدء.
                            </p>
                        </td>`;
        const createCustodybtn = document.getElementById('create-custody-btn')!;
        custodiesBody.querySelector('#empty-custodies')?.addEventListener('click', () => createCustodybtn.click());
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
    custodiesBody.innerHTML = '';
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
