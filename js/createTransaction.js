import { activeCustody, loadCustody } from "./custodyTransactions";
import { supabaseClient } from "./login";
const form = document.getElementById('crt-txn-form');
const overlay = document.getElementById('crt-txn-overlay');
const overlayLayout = document.getElementById('crt-txn-overlay-layout');
const openButton = document.getElementById('crt-txn-open');
const typeButtons = Array.from(document.querySelectorAll('.crt-txn-type-button'));
const typeValue = document.getElementById('crt-txn-type-value');
const amountLabel = document.getElementById('crt-txn-amount-label');
const amountInput = document.getElementById('crt-txn-amount');
const fileInput = document.getElementById('crt-txn-receipt');
const dropZone = document.getElementById('crt-txn-drop-zone');
const fileName = document.getElementById('crt-txn-file-name');
const fileActions = document.getElementById('crt-txn-file-actions');
const viewFileButton = document.getElementById('crt-txn-view-file');
const clearFileButton = document.getElementById('crt-txn-clear-file');
const cancelButton = document.getElementById('crt-txn-cancel');
const message = document.getElementById('crt-txn-message');
const descriptionInput = document.getElementById('crt-txn-description');
const dateInput = document.getElementById('crt-txn-date');
const MIN_AMOUNT = 0.01;
const MAX_FILE_SIZE = 6 * 1024 * 1024;
let selectedFile = null;
let selectedFileUrl;
let dragDepth = 0;
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
dateInput.value = getTodayDate();
openButton.addEventListener('click', () => {
    overlay.classList.remove('hidden');
    dateInput.value = getTodayDate();
    descriptionInput.focus();
});
function showMessage(text, isSuccess = false) {
    message.textContent = text;
    message.classList.toggle('hidden', !text);
    message.classList.toggle('border-emerald-200', Boolean(text) && isSuccess);
    message.classList.toggle('bg-emerald-50', Boolean(text) && isSuccess);
    message.classList.toggle('text-emerald-700', Boolean(text) && isSuccess);
    message.classList.toggle('border-red-300', Boolean(text) && !isSuccess);
    message.classList.toggle('bg-red-50', Boolean(text) && !isSuccess);
    message.classList.toggle('text-red-600', Boolean(text) && !isSuccess);
}
function acceptsFile(file) {
    return file.type === 'application/pdf' || file.type.startsWith('image/');
}
function isValidPastDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return (date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day &&
        date.getTime() <= todayUtc);
}
function setTransactionType(type) {
    typeValue.value = type;
    typeButtons.forEach((button) => {
        const isActive = button.dataset.value === type;
        button.setAttribute('aria-pressed', String(isActive));
        button.classList.toggle('bg-white', isActive);
        button.classList.toggle('text-emerald-700', isActive);
        button.classList.toggle('shadow-sm', isActive);
        button.classList.toggle('text-gray-500', !isActive);
    });
    const isExpense = type === 'صرف';
    amountLabel.textContent = isExpense ? 'المبلغ المصروف (دائن)' : 'المبلغ المقبوض (مدين)';
    const availableBalance = Number(form.dataset.availableBalance);
    if (isExpense && form.dataset.availableBalance && Number.isFinite(availableBalance)) {
        amountInput.max = String(availableBalance);
    }
    else {
        amountInput.removeAttribute('max');
    }
}
function clearSelectedFile() {
    selectedFile = null;
    fileInput.value = '';
    fileName.textContent = 'لم يتم اختيار ملف';
    fileActions.classList.add('hidden');
    fileActions.classList.remove('flex');
    if (selectedFileUrl) {
        URL.revokeObjectURL(selectedFileUrl);
        selectedFileUrl = undefined;
    }
}
function selectFile(file) {
    showMessage('');
    if (!file) {
        clearSelectedFile();
        return;
    }
    if (!acceptsFile(file)) {
        clearSelectedFile();
        showMessage('يرجى اختيار صورة أو ملف PDF');
        return;
    }
    if (file.size > MAX_FILE_SIZE) {
        clearSelectedFile();
        showMessage('حجم الملف يجب ألا يتجاوز 6 ميجابايت');
        return;
    }
    selectedFile = file;
    fileName.textContent = file.name;
    fileActions.classList.remove('hidden');
    fileActions.classList.add('flex');
}
typeButtons.forEach((button) => {
    button.addEventListener('click', () => {
        if (button.dataset.value)
            setTransactionType(button.dataset.value);
    });
});
fileInput.addEventListener('change', () => {
    selectFile(fileInput.files && fileInput.files[0]);
});
clearFileButton.addEventListener('click', () => {
    clearSelectedFile();
    fileInput.focus();
});
viewFileButton.addEventListener('click', () => {
    if (!selectedFile)
        return;
    if (selectedFileUrl)
        URL.revokeObjectURL(selectedFileUrl);
    selectedFileUrl = URL.createObjectURL(selectedFile);
    window.open(selectedFileUrl, '_blank', 'noopener,noreferrer');
});
dropZone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    dropZone.classList.add('border-emerald-500', 'bg-emerald-50');
    dropZone.classList.remove('border-gray-300');
});
dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer)
        event.dataTransfer.dropEffect = 'copy';
});
dropZone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
        dropZone.classList.remove('border-emerald-500', 'bg-emerald-50');
        dropZone.classList.add('border-gray-300');
    }
});
dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    dropZone.classList.remove('border-emerald-500', 'bg-emerald-50');
    dropZone.classList.add('border-gray-300');
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (!file)
        return;
    selectFile(file);
    if (selectedFile) {
        const transfer = new DataTransfer();
        transfer.items.add(selectedFile);
        fileInput.files = transfer.files;
    }
});
form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    const amount = Number(amountInput.value);
    const availableBalance = Number(form.dataset.availableBalance);
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
        showMessage('يجب أن يكون المبلغ 0.01 أو أكثر');
        return;
    }
    if (typeValue.value === 'صرف' &&
        form.dataset.availableBalance &&
        Number.isFinite(availableBalance) &&
        amount > availableBalance) {
        showMessage('لا يمكن أن يتجاوز مبلغ الصرف الرصيد المتاح');
        return;
    }
    const date = dateInput.value;
    if (!isValidPastDate(date)) {
        showMessage('يرجى إدخال تاريخ صحيح غير فارغ وليس في المستقبل');
        return;
    }
    const description = descriptionInput.value.trim();
    if (!description) {
        showMessage('يرجى إدخال تفاصيل الفاتورة');
        return;
    }
    const detail = {
        description,
        type: typeValue.value,
        date,
        amount,
        file: selectedFile,
    };
    form.dispatchEvent(new CustomEvent('crt-txn-create', {
        bubbles: true,
        detail,
    }));
    showMessage('يتم إنشاء الفاتورة', true);
    const success = await createTransactionWithReceipt({
        custody_id: activeCustody.id,
        description,
        deposit: typeValue.value === 'قبض' ? amount : 0,
        expense: typeValue.value === 'صرف' ? amount : 0,
        transaction_date: new Date().toISOString().split('T')[0],
        file: selectedFile ?? undefined,
    });
    if (success) {
        showMessage('تم إنشاء الفاتورة بنجاح', true);
        activeCustody.summary = undefined;
        activeCustody.transactions = undefined;
        await loadCustody(activeCustody);
        overlay.classList.add('hidden');
    }
});
async function createTransactionWithReceipt(params) {
    let docPath = null;
    if (params.file) {
        docPath = await uploadReceipt(params.file);
        if (docPath === null) {
            console.error('Receipt upload failed, aborting transaction');
            return false;
        }
    }
    const { error } = await supabaseClient
        .from('custody_transactions')
        .insert({
        custody_id: params.custody_id,
        description: params.description,
        deposit: params.deposit,
        expense: params.expense,
        doc_path: docPath,
        transaction_date: params.transaction_date,
    });
    if (error) {
        showMessage('لقد حصل خطأ اثناء إنشاء الفاتورة ' + error, false);
        console.error('Failed to create transaction:', error);
        if (docPath !== null) {
            await supabaseClient.storage.from('receipts').remove([docPath]);
            console.error('Uploaded receipt removed after failed insert');
        }
        return false;
    }
    return true;
}
async function uploadReceipt(file) {
    const ext = file.name.split('.').pop();
    const path = `receipts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabaseClient.storage
        .from('receipts')
        .upload(path, file);
    if (error) {
        showMessage('لقد حصل خطأ اثناء رفع المرفق', false);
        console.error('Failed to upload receipt:', error);
        return null;
    }
    return path;
}
cancelButton.addEventListener('click', () => {
    overlay.classList.add('hidden');
    form.dispatchEvent(new CustomEvent('crt-txn-cancel', { bubbles: true }));
});
window.addEventListener('beforeunload', () => {
    if (selectedFileUrl)
        URL.revokeObjectURL(selectedFileUrl);
});
let mouseDownTarget = null;
overlay.addEventListener("mousedown", (event) => {
    mouseDownTarget = event.target;
});
overlay.addEventListener("mouseup", (event) => {
    const target = event.target;
    if (event.button === 0 &&
        target === mouseDownTarget &&
        target instanceof Element) {
        if (target.matches(".crt-overlay:not(.forced)"))
            overlay.classList.add("hidden");
        if (target.matches(".crt-overlay-sub"))
            overlay.classList.add("hidden");
    }
    mouseDownTarget = null;
});
