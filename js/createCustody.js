import { supabaseClient } from "./login";
import { loadCustodies } from "./custodies";
const overlay = document.getElementById('create-custody-overlay');
const form = document.getElementById('create-custody-form');
const message = document.getElementById('create-custody-message');
const createBtn = document.getElementById('create-custody-create');
const cancelBtn = document.getElementById('create-custody-cancel');
const idInput = document.getElementById('create-custody-id');
const typeInput = document.getElementById('create-custody-type');
const custodianInput = document.getElementById('create-custody-custodian');
const initialFundingInput = document.getElementById('create-custody-initial-funding');
const openBtn = document.getElementById('create-custody-btn');
const CUSTODY_TYPES = [
    'عهدة مشتريات',
    'عهدة تشغيل وصيانة',
    'عهدة مصاريف سفر',
    'عهدة مكتبية وإدارية',
    'عهدة طوارئ',
];
openBtn.addEventListener('click', () => {
    overlay.classList.remove('hidden');
    message.classList = 'hidden';
});
cancelBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
});
createBtn.addEventListener('click', async () => {
    const id = idInput.value.trim();
    const custodian = custodianInput.value.trim();
    const type = typeInput.value.trim();
    const initialFunding = parseFloat(initialFundingInput.value) ?? 0;
    if (!id || !custodian) {
        showMessage('رمز المرجع والمستلم مطلوبه');
        console.error('Code and custodian are required');
        return;
    }
    if (!isCustodyType(type)) {
        showMessage('نوع العهدة غير صحيح');
        console.error('Invalid custody type selected');
        return;
    }
    if (isNaN(initialFunding) || initialFunding < 0) {
        showMessage('ادخل المبلغ الاولي');
        console.error('Invalid initial funding selected');
        return;
    }
    const newCustody = await createCustodyWithOpeningTransaction(id, custodian, type, initialFunding);
    if (newCustody) {
        showMessage('تم إنشاء العهدة', false);
        loadCustodies();
        setTimeout(() => {
            if (!overlay.matches('hidden'))
                cancelBtn.click();
            clearPanel();
        }, 2000);
    }
});
function clearPanel() {
    idInput.value = '';
    custodianInput.value = '';
    typeInput.value = '';
    initialFundingInput.value = '';
}
function showMessage(msgContext, isError = true) {
    const classlist = isError ?
        'w-full flex justify-center text-center p-1 border-2 border-red-400 border-dashed rounded-lg bg-red-50 text-red-600 w-4/5' :
        'w-full flex justify-center text-center p-1 border-2 border-green-400 border-dashed rounded-lg bg-emerald-50 text-emerald-600 w-4/5';
    message.textContent = msgContext;
    message.classList = classlist;
}
function isCustodyType(value) {
    return CUSTODY_TYPES.includes(value);
}
function getSelectedCustodyType() {
    const value = typeInput.value;
    return isCustodyType(value) ? value : null;
}
async function createCustodyWithOpeningTransaction(id, custodian, type, initialAmount) {
    const { data, error } = await supabaseClient
        .rpc('create_custody_with_opening_transaction', {
        p_id: id,
        p_custodian: custodian,
        p_type: type,
        p_initial_amount: initialAmount,
    })
        .single();
    if (error) {
        showMessage('لقد حصل خطأ اثناء انشاء العهدة: ' + error);
        console.error('Failed to create custody:', error);
        return null;
    }
    return data;
}
async function createCustody(payload) {
    const { data, error } = await supabaseClient
        .from('custodies')
        .insert(payload)
        .select('id, created_at, custodian, type, balance, initial_funding')
        .single();
    if (error) {
        showMessage('لقد حصل خطأ اثناء انشاء العهدة: ' + error);
        console.error('Failed to create custody:', error);
        return null;
    }
    return data;
}
async function uploadReceipt(file) {
    const ext = file.name.split('.').pop();
    const path = `receipts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabaseClient.storage
        .from('receipts')
        .upload(path, file);
    if (error) {
        console.error('Failed to upload receipt:', error);
        return null;
    }
    return path;
}
async function createTransaction(payload) {
    const { data, error } = await supabaseClient
        .from('custody_transactions')
        .insert(payload)
        .select('id, created_at, custody_id, description, deposit, expense, doc_path, transaction_date')
        .single();
    if (error) {
        console.error('Failed to create transaction:', error);
        return null;
    }
    return data;
}
