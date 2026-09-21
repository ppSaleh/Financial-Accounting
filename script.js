// --- إعدادات Supabase ---
const SUPABASE_URL = 'https://mrieddqxzmzlpodrnzyl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yaWVkZHF4em16bHBvZHJuenlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyODg0NTcsImV4cCI6MjEwNDg2NDQ1N30._PNBpDBjNOC2IUN9aZKhUobh-F9eWhHz0ZFg1WVSWGA';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let activeCustodyCode = null;
let activeCustodyData = null;
let activeItemsData = [];

function openCreate() {
    const formOverlay = document.getElementById('create-overlay');
    formOverlay.classList.remove('hidden');
}
function switchTab(tab) {
    const secList = document.getElementById('section-list');
    const secDetails = document.getElementById('section-details');

    if (tab === 'list') {
        secList.classList.remove('hidden');
        secDetails.classList.add('hidden');
        loadCustodyList();
    }
}
function renderApp() {
    // loadCustodyList();
}

// --- إنشاء حساب عهدة جديد ---
document.getElementById('create-custody-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const code = document.getElementById('new-code').value.trim();
    const type = document.getElementById('new-type').value;
    const custodian = document.getElementById('new-custodian').value.trim();
    const amount = parseFloat(document.getElementById('new-amount').value);

    const btn = document.getElementById('btn-save-custody');
    btn.disabled = true;
    btn.innerText = 'جاري الحفظ في السحابة...';

    try {
        // حفظ العهدة مع تهيئة الأعمدة
        const { error: custodyErr } = await supabaseClient
            .from('custodies')
            .insert([{
                code: code,
                type: type,
                custodian: custodian,
                amount: amount,
                total_amount: 0,
                remaining_amount: amount
            }]);

        if (custodyErr) throw custodyErr;

        // محاولة إضافة السجل الأولي في جدول الحركات إن وجد
        try {
            await supabaseClient
                .from('imprest_items')
                .insert([{
                    custody_code: code,
                    date: new Date().toISOString().split('T')[0],
                    description: `رصيد أول المدة (${custodian})`,
                    deposit: amount,
                    expense: 0.00
                }]);
        } catch (e) { console.log('Notice: imprest_items skip'); }

        this.reset();
        alert('تمت إضافة العهدة بنجاح!');
        openCustodyDetails(code);
    } catch (err) {
        alert('خطأ أثناء حفظ العهدة: ' + err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerText = 'حفظ في قاعدة البيانات السحابية';
    }
});

// --- جلب قائمة العهد المالية مباشرة ومضمونة ---
async function loadCustodyList() {
    const grid = document.getElementById('custody-cards-grid');
    grid.innerHTML = '<p class="text-xs text-gray-400 col-span-3 text-center py-6">جاري تحميل السجلات السحابية...</p>';

    try {
        // جلب جدول العهد الرئيسي فقط دون إجبار الربط مع جداول ثانوية
        const { data: custodies, error: cErr } = await supabaseClient.from('custodies').select('*').order('id', { ascending: false });
        if (cErr) throw cErr;

        if (!custodies || custodies.length === 0) {
            grid.innerHTML = '<p class="text-xs text-gray-400 col-span-3 text-center py-6">لا توجد سجلات عهد في قاعدة البيانات السحابية.</p>';
            return;
        }

        // جلب الحركات المالية بأسلوب آمن لا يوقف التطبيق في حال عدم وجود الجدول
        let itemsMap = {};
        try {
            const { data: items } = await supabaseClient.from('imprest_items').select('*');
            if (items) {
                items.forEach(i => {
                    if (!itemsMap[i.custody_code]) itemsMap[i.custody_code] = [];
                    itemsMap[i.custody_code].push(i);
                });
            }
        } catch (e) {
            console.warn('تنويه: متعذر جلب جدول imprest_items، يتم الاعتماد على قيم custodies مباشرة');
        }

        grid.innerHTML = '';
        custodies.forEach(c => {
            let deposit = parseFloat(c.amount || 0);
            let spent = parseFloat(c.total_amount || 0);

            if (itemsMap[c.code] && itemsMap[c.code].length > 0) {
                deposit = 0;
                spent = 0;
                itemsMap[c.code].forEach(i => {
                    deposit += parseFloat(i.deposit || 0);
                    spent += parseFloat(i.expense || 0);
                });
            }

            let rem = deposit - spent;

            grid.innerHTML += `
                        <div onclick="openCustodyDetails('${c.code}')" class="bg-gray-50 hover:bg-blue-50 border border-gray-200 p-4 rounded-xl cursor-pointer transition space-y-2">
                            <div class="flex justify-between items-center">
                                <span class="font-bold text-gray-800 text-sm">${c.code}</span>
                                <span class="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-md">${c.type || 'عهدة'}</span>
                            </div>
                            <div class="text-xs text-gray-600">المسؤول: <span class="font-semibold">${c.custodian || '-'}</span></div>
                            <div class="flex justify-between items-center pt-2 border-t border-gray-200 text-xs">
                                <span class="text-gray-500">الرصيد المتبقي: <strong class="text-emerald-700">${rem.toFixed(2)} ر.س</strong></span>
                                <span class="text-blue-600 font-bold hover:underline">عرض التفاصيل &larr;</span>
                            </div>
                        </div>
                    `;
        });
    } catch (err) {
        grid.innerHTML = `<p class="text-xs text-rose-500 col-span-3 text-center py-6">تعذر جلب البيانات: ${err.message}</p>`;
        console.error(err);
    }
}

// --- فتح تفاصيل العهدة وعرض كشف الحساب ---
async function openCustodyDetails(code) {
    activeCustodyCode = code;
    // document.getElementById('section-create').classList.add('hidden');
    document.getElementById('section-list').classList.add('hidden');
    document.getElementById('section-details').classList.remove('hidden');
    await renderDetailsUI();
}

async function renderDetailsUI() {
    if (!activeCustodyCode) return;

    try {
        const { data: custody, error: cErr } = await supabaseClient.from('custodies').select('*').eq('code', activeCustodyCode).single();
        if (cErr) throw cErr;
        activeCustodyData = custody;

        activeItemsData = [];
        try {
            const { data: items } = await supabaseClient.from('imprest_items').select('*').eq('custody_code', activeCustodyCode);
            if (items) activeItemsData = items;
        } catch (e) { }

        // إذا لم توجد حركة سابقة، يتم إظهار الرصيد المبدئي
        if (activeItemsData.length === 0) {
            activeItemsData = [{
                id: 'init',
                date: new Date().toISOString().split('T')[0],
                description: `رصيد أول المدة (${custody.custodian || ''})`,
                deposit: parseFloat(custody.amount || 0),
                expense: 0.00,
                doc_url: null
            }];
        }

        const tbody = document.getElementById('table-body');
        const pdfImgContainer = document.getElementById('pdf-images-container');
        tbody.innerHTML = '';
        pdfImgContainer.innerHTML = '';

        let currentBalance = 0, totalDeposit = 0, totalExpense = 0;

        activeItemsData.forEach((item, index) => {
            const dep = Number(item.deposit || 0);
            const exp = Number(item.expense || 0);
            totalDeposit += dep;
            totalExpense += exp;
            currentBalance += (dep - exp);

            tbody.innerHTML += `
                        <tr class="hover:bg-gray-50 transition">
                            <td class="p-3 text-xs font-bold text-gray-500">${index + 1}</td>
                            <td class="p-3 text-xs text-gray-500">${item.date || '-'}</td>
                            <td class="p-3 font-semibold text-gray-800">${item.description}</td>
                            <td class="p-3 text-center no-print">
                                ${item.doc_url ? `
                                    <div class="flex justify-center gap-1">
                                        <button onclick="viewDoc('${item.doc_url}')" class="bg-blue-50 text-blue-600 border border-blue-200 text-xs px-2 py-1 rounded-md hover:bg-blue-100">عرض</button>
                                        <a href="${item.doc_url}" target="_blank" download class="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs px-2 py-1 rounded-md hover:bg-emerald-100">تحميل</a>
                                    </div>
                                ` : '<span class="text-xs text-gray-400">لا يوجد</span>'}
                            </td>
                            <td class="p-3 font-bold text-emerald-600">${dep > 0 ? dep.toFixed(2) + ' ر.س' : '-'}</td>
                            <td class="p-3 font-bold text-rose-600">${exp > 0 ? exp.toFixed(2) + ' ر.س' : '-'}</td>
                            <td class="p-3 font-bold text-blue-800">${currentBalance.toFixed(2)} ر.س</td>
                            <td class="p-3 text-center no-print">
                                ${item.id !== 'init' ? `<button onclick="deleteExpense(${item.id})" class="text-rose-500 hover:text-rose-700 text-xs font-medium">حذف</button>` : '-'}
                            </td>
                        </tr>
                    `;

            if (item.doc_url) {
                pdfImgContainer.innerHTML += `
                            <div class="border border-gray-200 p-2 rounded-lg text-center space-y-1">
                                <span class="text-xs font-semibold text-gray-600 block">${item.description} (${exp.toFixed(2)} ر.س)</span>
                                <img src="${item.doc_url}" class="max-h-48 mx-auto rounded border border-gray-100">
                            </div>
                        `;
            }
        });

        document.getElementById('dash-code').innerText = custody.code;
        document.getElementById('dash-type').innerText = custody.type || 'عهدة';
        document.getElementById('dash-custodian').innerText = `المسؤول: ${custody.custodian || '-'}`;
        document.getElementById('dash-received').innerText = totalDeposit.toFixed(2) + ' ر.س';
        document.getElementById('dash-spent').innerText = totalExpense.toFixed(2) + ' ر.س';
        document.getElementById('dash-remaining').innerText = currentBalance.toFixed(2) + ' ر.س';

        document.getElementById('total-received-cell').innerText = totalDeposit.toFixed(2) + ' ر.س';
        document.getElementById('total-spent-cell').innerText = totalExpense.toFixed(2) + ' ر.س';
        document.getElementById('total-balance-cell').innerText = currentBalance.toFixed(2) + ' ر.س';

    } catch (err) {
        alert('خطأ أثناء جلب التفاصيل: ' + err.message);
        console.error(err);
    }
}

// --- إضافة فاتورة / مصروف جديد ---
document.getElementById('expense-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!activeCustodyCode) return;

    const desc = document.getElementById('exp-desc').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const fileInput = document.getElementById('exp-file');
    const btn = document.getElementById('btn-add-expense');

    btn.disabled = true;
    btn.innerText = 'جاري الإرسال للسحابة...';

    try {
        let docUrl = null;

        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `receipts/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadErr } = await supabaseClient.storage.from('receipts').upload(filePath, file);
            if (!uploadErr) {
                const { data: publicUrlData } = supabaseClient.storage.from('receipts').getPublicUrl(filePath);
                docUrl = publicUrlData.publicUrl;
            }
        }

        const { error: insertErr } = await supabaseClient
            .from('imprest_items')
            .insert([{
                custody_code: activeCustodyCode,
                date: new Date().toISOString().split('T')[0],
                description: desc,
                deposit: 0.00,
                expense: amount,
                doc_url: docUrl
            }]);

        if (insertErr) throw insertErr;

        document.getElementById('expense-form').reset();
        await renderDetailsUI();
    } catch (err) {
        alert('حدث خطأ أثناء تسجيل المصروف: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'تسجيل المصروف';
    }
});

// --- حذف حركة مالية ---
async function deleteExpense(itemId) {
    if (!confirm('هل أنت تأكد من رغبتك في حذف هذه العملية من السحابة؟')) return;
    const { error } = await supabaseClient.from('imprest_items').delete().eq('id', itemId);
    if (error) alert('حدث خطأ أثناء الحذف: ' + error.message);
    else renderDetailsUI();
}

function viewDoc(url) {
    document.getElementById('modal-img').src = url;
    document.getElementById('image-modal').classList.remove('hidden');
    document.getElementById('image-modal').classList.add('flex');
}

function closeModal() {
    document.getElementById('image-modal').classList.add('hidden');
    document.getElementById('image-modal').classList.remove('flex');
}

// تصدير كشف الحساب إلى Excel
function exportToExcel() {
    if (!activeItemsData) return;
    const exportData = activeItemsData.map((item, idx) => ({
        '#': idx + 1,
        'التاريخ': item.date,
        'البيان': item.description,
        'المقبوضات (مدين)': item.deposit,
        'المصروفات (دائن)': item.expense,
        'رابط المرفق': item.doc_url || 'لا يوجد'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "كشف العهدة");
    XLSX.writeFile(workbook, `تقرير_العهدة_${activeCustodyCode}.xlsx`);
}

// تصدير كشف الحساب إلى PDF
function exportToPDF() {
    const element = document.getElementById('pdf-content');
    const noPrintElements = document.querySelectorAll('.no-print');
    noPrintElements.forEach(el => el.style.display = 'none');

    const opt = {
        margin: 0.5,
        filename: `تقرير_العهدة_${activeCustodyCode}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        noPrintElements.forEach(el => el.style.display = '');
    });
}
loadCustodyList();