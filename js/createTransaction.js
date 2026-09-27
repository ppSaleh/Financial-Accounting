import { supabaseClient } from "./login";
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
    //await loadTransactionsForCustody(data.custody_id) // refresh the list
    //delete summaryCache[data.custody_id] // invalidate summary too, if you're using that
    return data;
}
const overlay = document.getElementById('crt-txn-overlay');
const title = document.getElementById('crt-txn-title');
const description = document.getElementById('crt-txn-description');
const type = document.getElementById('crt-txn-type');
const amount = document.getElementById('crt-txn-amount');
const amountLabel = document.getElementById('crt-txn-amount-label');
const actionbtn = document.getElementById('crt-txn-action');
const cancelbtn = document.getElementById('crt-txn-cancel');
const message = document.getElementById('crt-txn-message');
// Create / Edit txn
actionbtn.addEventListener('click', () => {
});
//#region drop input stuff
const dropZone = document.getElementById("#crt-txn-dropzone");
const fileInput = document.getElementById("crt-txn-receipt");
const fileName = document.getElementById("crt-txn-fileName");
const clearFile = document.getElementById("crt-txn-clearFile");
const preview = document.getElementById("crt-txn-filePreview");
const fileError = document.getElementById("crt-txn-fileError");
let previewUrl;
let dragDepth = 0;
function showError(message) {
    fileError.textContent = message;
    fileError.classList.toggle("hidden", !message);
}
function acceptsFile(file) {
    return file.type === "application/pdf" || file.type.startsWith("image/");
}
function updateFile() {
    preview.classList.add("hidden");
    preview.removeAttribute("src");
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = undefined;
    }
    const file = fileInput.files?.[0];
    fileName.textContent = file?.name ?? "لم يتم اختيار ملف";
    clearFile.classList.toggle("hidden", !file);
    if (file?.type.startsWith("image/")) {
        previewUrl = URL.createObjectURL(file);
        preview.src = previewUrl;
        preview.classList.remove("hidden");
    }
}
fileInput.addEventListener("change", () => {
    showError("");
    const file = fileInput.files?.[0];
    if (file && !acceptsFile(file)) {
        fileInput.value = "";
        showError("يرجى اختيار صورة أو ملف PDF");
    }
    updateFile();
});
clearFile.addEventListener("click", () => {
    fileInput.value = "";
    showError("");
    updateFile();
    fileInput.focus();
});
dropZone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth++;
    dropZone.classList.add("dragging");
});
dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
    }
});
dropZone.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
        dropZone.classList.remove("dragging");
    }
});
dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    dropZone.classList.remove("dragging");
    showError("");
    const file = event.dataTransfer?.files[0];
    if (!file)
        return;
    if (!acceptsFile(file)) {
        showError("يرجى اختيار صورة أو ملف PDF");
        return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    updateFile();
});
//#endregion
