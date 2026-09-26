import { supabaseClient } from "./login"

export { Custody, loadCustodies}

interface Custody {
    id: string
    created_at: string
    custodian: string
    type: 'عهدة مشتريات' | 'عهدة تشغيل وصيانة' | 'عهدة مصاريف سفر' | 'عهدة مكتبية وإدارية' | 'عهدة طوارئ'
    balance: number
    initial_funding: number
}

let custodies: Record<string, Custody> = {};
const riyalsSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-lucide="saudi-riyal" aria-hidden="true" class="lucide lucide-saudi-riyal"><path d="m20 19.5-5.5 1.2"></path><path d="M14.5 4v11.22a1 1 0 0 0 1.242.97L20 15.2"></path><path d="m2.978 19.351 5.549-1.363A2 2 0 0 0 10 16V2"></path><path d="M20 10 4 13.5"></path></svg>';
const custodyBody = document.getElementById('custody-body')!;

async function loadCustodies() {
    custodies = await fetchAllCustodiesAsRecord()
    renderCustodies(Object.values(custodies));
}
function renderCustodies(custodies: Custody[]) {
    custodyBody.innerHTML = '';
    if (custodies.length === 0) {
        custodyBody.innerHTML = 'NO CUSTODIES!';
        return;
    }
    const fragment = document.createDocumentFragment();
    let order = 1;
    custodies.forEach(custody => {
        const row = document.createElement('tr');
        row.classList = 'border-b border-gray-100 hover:bg-gray-50 transition-colors';
        row.innerHTML = `<td class="px-4 py-3 text-gray-400 mono">${order}</td>
                            <td class="px-4 py-3 mono font-semibold text-gray-500">${custody.id}</td>
                            <td class="px-4 py-3 text-gray-700">${custody.custodian}</td>
                            <td class="px-4 py-3 mono text-left font-bold text-emerald-600">
                                <span class="flex items-center justify-end gap-1">${custody.initial_funding}${riyalsSVG}</span>
                            </td>
                            <td class="px-4 py-3 mono text-left font-bold text-emerald-600">
                                <span class="flex items-center justify-end gap-1">${custody.balance}${riyalsSVG}</span>
                            </td>
                            <td class="px-4 py-3">
                                <span
                                    class="text-xs px-3 py-1 rounded-full font-semibold bg-blue-50 text-blue-800 border border-blue-200">${custody.type}</span>
                            </td>
                            <td class="px-4 py-3 mono text-gray-600 text-xs" dir="ltr">${formatDateDDMMYYYY(custody.created_at)}</td>
                            <td class="px-4 py-3">
                                <button
                                    class="cursor-pointer bg-slate-500 text-white text-xs font-semibold px-4 py-1.5 rounded-md hover:bg-slate-600 transition-colors">عرض
                                    التفاصيل</button>
                            </td>`;
        fragment.appendChild(row);
        order++;
    });
    custodyBody.appendChild(fragment);
}
function formatDateDDMMYYYY(isoString: string): string {
  const date = new Date(isoString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
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