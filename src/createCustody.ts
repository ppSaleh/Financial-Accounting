import { supabaseClient } from "./login";
import { Custody } from "./custodies";

const overlay = document.getElementById('create-custody-overlay')!;
const form = document.getElementById('create-custody-form')!;
const message = document.getElementById('create-custody-message')!;

const createBtn = document.getElementById('create-custody-create')!;
const cancelBtn = document.getElementById('create-custody-cancel')!;
const idInput = document.getElementById('create-custody-id') as HTMLInputElement;
const typeInput = document.getElementById('create-custody-type') as HTMLInputElement;
const custodianInput = document.getElementById('create-custody-custodian') as HTMLInputElement;
const initialFundingInput = document.getElementById('create-custody-initial-funding') as HTMLInputElement;

const openBtn = document.getElementById('create-custody-btn')!;


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
    overlay.classList.remove('hidden');
    message.classList = 'hidden';
});
cancelBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
})
createBtn.addEventListener('click', async () => {
    const id = idInput.value.trim();
    const custodian = custodianInput.value.trim();
    const type = typeInput.value;
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
        showMessage('تم إنشاء العهدة');
        setTimeout(() => {
            cancelBtn.click();
        }, 2000);
    }
});

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
    initialAmount: number
): Promise<Custody | null> {
    const { data, error } = await supabaseClient
        .rpc('create_custody_with_opening_transaction', {
            p_id: id,
            p_custodian: custodian,
            p_type: type,
            p_initial_amount: initialAmount,
        })
        .single<Custody>()

    if (error) {
        showMessage('لقد حصل خطأ اثناء انشاء العهدة: ' + error);
        console.error('Failed to create custody:', error)
        return null
    }

    return data
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