export { loadCustodyList }


const grid = document.getElementById('custody-cards-grid')!;

function loadCustodyList() {
    grid.innerHTML = '<p class="text-xs text-gray-400 col-span-3 text-center py-6">جاري تحميل السجلات السحابية...</p>';

}
loadCustodyList();