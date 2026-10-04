import { initCustodySearch } from './search';
import { loadCustody } from "./custodyTransactions";
import { isSupervisor, supabaseClient } from "./auth";
export { CUSTODY_TYPES, loadCustodies, custodies, formatDateDDMMYYYY, switchTable };
let custodies = {};
const riyalsSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="saudi-riyal" aria-hidden="true" class="lucide lucide-saudi-riyal"><path d="m20 19.5-5.5 1.2"></path><path d="M14.5 4v11.22a1 1 0 0 0 1.242.97L20 15.2"></path><path d="m2.978 19.351 5.549-1.363A2 2 0 0 0 10 16V2"></path><path d="M20 10 4 13.5"></path></svg>';
const custodiesTable = document.getElementById('custodies-table');
const custodiesBody = document.getElementById('custodies-body');
const custodyTable = document.getElementById('custody-table');
const CUSTODY_TYPES = [
    'عهدة مشتريات',
    'عهدة تشغيل وصيانة',
    'عهدة مصاريف سفر',
    'عهدة مكتبية وإدارية',
    'عهدة طوارئ',
];
const CUSTODY_COLORS = {
    'عهدة مشتريات': 'type-Purchasing',
    'عهدة تشغيل وصيانة': 'type-OM',
    'عهدة مصاريف سفر': 'type-Travel',
    'عهدة مكتبية وإدارية': 'type-Admin',
    'عهدة طوارئ': 'type-Emergency',
};
const CUSTODY_ICONS = {
    'عهدة مشتريات': '<path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18"></path><path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25"></path><circle cx="18" cy="20" r="2"></circle><circle cx="8" cy="20" r="2"></circle>',
    'عهدة تشغيل وصيانة': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"></path>',
    'عهدة مصاريف سفر': '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>',
    'عهدة مكتبية وإدارية': '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"></path><path d="M8 11h8"></path><path d="M8 7h6"></path>',
    'عهدة طوارئ': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>',
};
// Keep search, filter and sort controls together in search.ts.
const applyCustodyFilters = initCustodySearch(() => custodies, renderCustodies);
async function loadCustodies(forceRefresh = false) {
    if (Object.keys(custodies).length === 0 || forceRefresh) {
        showCustodiesPulse();
        loadSummary();
        custodies = await fetchAllCustodiesAsRecord();
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
function renderCustodies(custodies) {
    if (custodies.length === 0) {
        custodiesBody.innerHTML = `<td colspan="8" class="p-4 text-center">
                            <p>
                                لا توجد عهد مسجلة حتى الآن،
                                <a id="empty-custodies" class="text-blue-500 font-bold underline cursor-pointer">أضف عهدة جديدة
                                </a>
                                للبدء.
                            </p>
                        </td>`;
        const createCustodybtn = document.getElementById('crt-cust-btn');
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
                                        تعديل</button>` : '';
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
                            <div class="custody-type ${CUSTODY_COLORS[custody.type]}" dir="rtl">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CUSTODY_ICONS[custody.type]}</svg>
                                <span>${custody.type.replace('عهدة ', '')}</span>
                            </div>
                            </td>
                            <td class="px-4 py-3 mono text-gray-600 text-xs" dir="ltr">${formatDateDDMMYYYY(custody.created_at)}</td>
                            <td class="px-4 py-3 flex items-center gap-2 justify-center">
                                <button
                                    class="custodies-view row-btn-accent">عرض
                                    التفاصيل</button>
                            </td>`;
        row.querySelector('.custodies-view')?.addEventListener('click', () => {
            openCustody(custody.id);
        });
        row.querySelector(`custodies-action`)?.addEventListener('click', () => {
        });
        fragment.appendChild(row);
        order++;
    });
    custodiesBody.innerHTML = '';
    custodiesBody.appendChild(fragment);
}
function formatDateDDMMYYYY(isoString) {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}
export function formatReceiptDate(isoString, language = 'ar') {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        calendar: 'gregory',
        numberingSystem: 'latn',
        timeZone: 'UTC',
    }).format(new Date(isoString));
}
async function fetchAllCustodiesAsRecord() {
    const { data, error } = await supabaseClient
        .from('custodies')
        .select('id, created_at, custodian, type, balance, initial_funding')
        .order('created_at', { ascending: false })
        .returns();
    if (error) {
        console.error('Failed to fetch custodies:', error);
        return {};
    }
    return data.reduce((acc, custody) => {
        acc[custody.id] = custody;
        return acc;
    }, {});
}
const summaryBalance = document.getElementById('sum-balance');
const summaryTotalDeposit = document.getElementById('sum-deposit');
const summaryTotalExpense = document.getElementById('sum-expense');
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
async function getOverallSummary() {
    const { data, error } = await supabaseClient
        .rpc('get_overall_summary')
        .single();
    if (error) {
        console.error('Failed to fetch overall summary:', error);
        return null;
    }
    return data;
}
function switchTable(table) {
    custodiesTable.classList.toggle('hidden', table !== 'custodies');
    custodyTable.classList.toggle('hidden', table !== 'custody');
}
function openCustody(custodyid) {
    switchTable('custody');
    loadCustody(custodies[custodyid]);
}
