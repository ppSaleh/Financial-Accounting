import { supabaseClient } from "./auth";
import { Custody, loadCustodies } from "./custodies";

const overlay = document.getElementById('crt-cust-overlay') as HTMLDialogElement;
const overlayLayout = document.getElementById('crt-cust-overlay-layout')!;
const message = document.getElementById('crt-cust-message')!;

const createBtn = document.getElementById('crt-cust-create')!;
const cancelBtn = document.getElementById('crt-cust-cancel')!;
const idInput = document.getElementById('crt-cust-id') as HTMLInputElement;
const typeInput = document.getElementById('crt-cust-type') as HTMLInputElement;
const custodianInput = document.getElementById('crt-cust-custodian') as HTMLInputElement;
const initialFundingInput = document.getElementById('crt-cust-initial-funding') as HTMLInputElement;

const openBtn = document.getElementById('crt-cust-btn')!;
const fileInput = document.getElementById('crt-cust-receipt') as HTMLInputElement;
const fileName = document.getElementById('crt-cust-file-name')!;
const fileActions = document.getElementById('crt-cust-file-actions')!;
const dropZone = document.getElementById('crt-cust-drop-zone')!;
let selectedFile: File | null = null;
let selectedFileUrl: string | undefined;
let dragDepth = 0;
let isSaving = false;

function clearSelectedFile() {
    selectedFile = null;
    fileInput.value = '';
    fileName.textContent = 'لم يتم اختيار ملف';
    fileActions.classList.add('hidden');
    fileActions.classList.remove('flex');
    if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    selectedFileUrl = undefined;
}

function selectFile(file: File | undefined) {
    if (isSaving || !file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        showMessage('يرجى اختيار صورة أو ملف PDF');
        fileInput.value = '';
        return;
    }
    if (file.size > 6 * 1024 * 1024) {
        showMessage('حجم الملف يجب ألا يتجاوز 6 ميجابايت');
        fileInput.value = '';
        return;
    }
    clearSelectedFile();
    selectedFile = file;
    fileName.textContent = file.name;
    fileActions.classList.remove('hidden');
    fileActions.classList.add('flex');
    message.classList = 'hidden';
}

fileInput.addEventListener('change', () => selectFile(fileInput.files?.[0]));
document.getElementById('crt-cust-clear-file')!.addEventListener('click', () => {
    if (isSaving) return;
    clearSelectedFile();
    fileInput.focus();
});
document.getElementById('crt-cust-view-file')!.addEventListener('click', () => {
    if (!selectedFile) return;
    if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    selectedFileUrl = URL.createObjectURL(selectedFile);
    window.open(selectedFileUrl, '_blank', 'noopener,noreferrer');
});
function highlightDropZone(active: boolean) {
    dropZone.classList.toggle('border-emerald-500', active);
    dropZone.classList.toggle('bg-emerald-50', active);
    dropZone.classList.toggle('border-gray-300', !active);
}
dropZone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    if (isSaving) return;
    dragDepth++;
    highlightDropZone(true);
});
dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = isSaving ? 'none' : 'copy';
});
dropZone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) highlightDropZone(false);
});
dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dragDepth = 0;
    highlightDropZone(false);
    selectFile(event.dataTransfer?.files[0]);
});
window.addEventListener('beforeunload', () => {
    if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
});


interface CustodyInsert {
    id: string
    custodian: string
    type: CustodyType
}

interface CustodyTransaction {
    id: string
    created_at: string
    custody_id: string
    description: string
    deposit: number
    expense: number
    doc_path: string | null
    transaction_date: string
}

interface CustodyTransactionInsert {
    custody_id: string
    description: string
    deposit: number
    expense: number
    doc_path?: string | null
    transaction_date: string
}

type CustodyType = Custody['type']
const CUSTODY_TYPES: CustodyType[] = [
    'عهدة مشتريات',
    'عهدة تشغيل وصيانة',
    'عهدة مصاريف سفر',
    'عهدة مكتبية وإدارية',
    'عهدة طوارئ',
]

openBtn.addEventListener('click', () => {
    overlay.showModal();
    message.classList = 'hidden';
    idInput.focus();
});
cancelBtn.addEventListener('click', () => {
    if (isSaving) return;
    overlay.close();
    clearSelectedFile();
})
overlay.addEventListener('cancel', (event) => {
    if (isSaving) event.preventDefault();
});
let mouseDownTarget: EventTarget | null = null;
overlay.addEventListener('mousedown', (event) => {
    mouseDownTarget = event.target;
});
overlay.addEventListener('mouseup', (event) => {
    if (!isSaving && event.button === 0 && event.target === mouseDownTarget &&
        (event.target === overlay || event.target === overlayLayout)) {
        overlay.close();
    }
    mouseDownTarget = null;
});
createBtn.addEventListener('click', async () => {
    if (isSaving) return;
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

    isSaving = true;
    const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
        '#crt-cust-form input, #crt-cust-form select, #crt-cust-form button'
    ));
    controls.forEach(control => { control.disabled = true; });
    try {
        const created = await createCustodyWithOpeningTransaction(id, custodian, type, initialFunding, selectedFile ?? undefined);
        if (created) {
            overlay.close();
            clearPanel();
            void loadCustodies(true).catch(error => console.error('Failed to refresh custodies:', error));
        }
    } catch (error) {
        console.error('Failed to create custody:', error);
        showMessage('تعذر إتمام إنشاء العهدة. تحقق من الاتصال وحالة العهدة قبل إعادة المحاولة.');
    } finally {
        isSaving = false;
        controls.forEach(control => { control.disabled = false; });
    }
});
function clearPanel(){
    idInput.value = '';
    custodianInput.value = '';
    typeInput.value = '';
    initialFundingInput.value = '';
    clearSelectedFile();
}
function showMessage(msgContext: string, isError = true) {
    const classlist: string = isError ?
        'w-full flex justify-center text-center p-1 border-2 border-red-400 border-dashed rounded-lg bg-red-50 text-red-600 w-4/5' :
        'w-full flex justify-center text-center p-1 border-2 border-green-400 border-dashed rounded-lg bg-emerald-50 text-emerald-600 w-4/5';

    message.textContent = msgContext;
    message.classList = classlist;
}
function isCustodyType(value: string): value is CustodyType {
    return CUSTODY_TYPES.includes(value as CustodyType)
}
function getSelectedCustodyType(): CustodyType | null {
    const value = typeInput.value
    return isCustodyType(value) ? value : null
}
async function createCustodyWithOpeningTransaction(
    id: string,
    custodian: string,
    type: CustodyType,
    initialAmount: number,
    file?: File
): Promise<boolean> {
    const docPath = file ? await uploadReceipt(file) : null;
    if (file && docPath === null) {
        showMessage('تعذر رفع مرفق المبلغ الأولي. لم يتم إنشاء العهدة.');
        return false;
    }
    const { error } = await supabaseClient
        .rpc('create_custody_with_opening_transaction', {
            p_id: id,
            p_custodian: custodian,
            p_type: type,
            p_initial_amount: initialAmount,
            p_doc_path: docPath,
        })

    if (error) {
        showMessage('لقد حصل خطأ اثناء انشاء العهدة: ' + error.message);
        console.error('Failed to create custody:', error)
        if (docPath !== null) {
            const { error: cleanupError } = await supabaseClient.storage.from('receipts').remove([docPath]);
            if (cleanupError) console.error('Failed to remove uploaded receipt after failed RPC:', cleanupError);
        }
        return false
    }

    return true
}
async function createCustody(payload: CustodyInsert): Promise<Custody | null> {
    const { data, error } = await supabaseClient
        .from('custodies')
        .insert(payload)
        .select('id, created_at, custodian, type, balance, initial_funding')
        .single<Custody>()

    if (error) {
        showMessage('لقد حصل خطأ اثناء انشاء العهدة: ' + error);
        console.error('Failed to create custody:', error);
        return null
    }

    return data
}

async function uploadReceipt(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `receipts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabaseClient.storage
        .from('receipts')
        .upload(path, file)

    if (error) {
        console.error('Failed to upload receipt:', error)
        return null
    }

    return path
}

async function createTransaction(payload: CustodyTransactionInsert): Promise<CustodyTransaction | null> {
    const { data, error } = await supabaseClient
        .from('custody_transactions')
        .insert(payload)
        .select('id, created_at, custody_id, description, deposit, expense, doc_path, transaction_date')
        .single<CustodyTransaction>()

    if (error) {
        console.error('Failed to create transaction:', error)
        return null
    }

    return data
}
