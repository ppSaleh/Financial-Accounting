// Owns the custody toolbar's search, filter and sort state and event handlers.
// Read the latest records on each update; render through the existing table renderer.
export function initCustodySearch(getCustodies, renderCustodies) {
    const custodiesBody = document.getElementById('custodies-body');
    // Custody filters
    const custodySearch = document.getElementById('custodies-search');
    custodySearch.addEventListener('input', applyCustodyFilters);
    const filterButton = document.getElementById('custodies-filter');
    const filterMenu = document.getElementById('custodies-filter-menu');
    const filterPanel = document.getElementById('custodies-filter-panel');
    const initialMin = document.getElementById('custodies-initial-min');
    const initialMax = document.getElementById('custodies-initial-max');
    const balanceMin = document.getElementById('custodies-balance-min');
    const balanceMax = document.getElementById('custodies-balance-max');
    const filterType = document.getElementById('custodies-filter-type');
    const dateMin = document.getElementById('custodies-date-min');
    const dateMax = document.getElementById('custodies-date-max');
    function setFiltersOpen(open) {
        filterPanel.classList.toggle('opacity-0', !open);
        filterPanel.classList.toggle('-translate-y-2', !open);
        filterPanel.classList.toggle('pointer-events-none', !open);
        filterPanel.inert = !open;
        filterButton.setAttribute('aria-expanded', String(open));
    }
    filterButton.addEventListener('click', () => setFiltersOpen(filterPanel.inert));
    document.getElementById('custodies-filter-close').addEventListener('click', () => {
        setFiltersOpen(false);
        filterButton.focus();
    });
    document.addEventListener('click', event => {
        if (event.target instanceof Node && !filterMenu.contains(event.target))
            setFiltersOpen(false);
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
        const custodies = getCustodies();
        const ranges = [[initialMin, initialMax], [balanceMin, balanceMax], [dateMin, dateMax]];
        for (const [min, max] of ranges) {
            const reversed = min.value !== '' && max.value !== '' && (min.type === 'number'
                ? min.valueAsNumber > max.valueAsNumber : min.value > max.value);
            max.setCustomValidity(reversed ? 'يجب أن تكون قيمة النهاية أكبر من أو تساوي البداية' : '');
        }
        if (!filterPanel.reportValidity())
            return;
        const inRange = (value, min, max) => (min.value === '' || value >= min.valueAsNumber) &&
            (max.value === '' || value <= max.valueAsNumber);
        const search = custodySearch.value.trim().toLocaleLowerCase();
        const filtered = Object.values(custodies).filter(custody => {
            // Match the local calendar date displayed in the table, including the entire end day.
            const created = new Date(custody.created_at);
            const year = created.getFullYear();
            const month = String(created.getMonth() + 1).padStart(2, '0');
            const day = String(created.getDate()).padStart(2, '0');
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
        if (field)
            filtered.sort((a, b) => compareCustodies(a, b, field) * (sortDirection === 'asc' ? 1 : -1));
        renderCustodies(filtered);
    }
    let sortField = null;
    let sortDirection = 'asc';
    const sortButton = document.getElementById('custodies-sort');
    const sortMenu = document.getElementById('custodies-sort-menu');
    const sortPanel = document.getElementById('custodies-sort-panel');
    const sortStatus = document.getElementById('custodies-sort-status');
    const sortOptions = sortPanel.querySelectorAll('button[data-sort]');
    const textOrder = new Intl.Collator('ar', { sensitivity: 'base' });
    function compareCustodies(a, b, field) {
        if (field === 'initial_funding' || field === 'balance')
            return a[field] - b[field];
        if (field === 'created_at')
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return textOrder.compare(a[field], b[field]);
    }
    function setSortOpen(open) {
        sortPanel.classList.toggle('opacity-0', !open);
        sortPanel.classList.toggle('-translate-y-2', !open);
        sortPanel.classList.toggle('pointer-events-none', !open);
        sortPanel.inert = !open;
        sortButton.setAttribute('aria-expanded', String(open));
    }
    sortButton.addEventListener('click', () => setSortOpen(sortPanel.inert));
    document.getElementById('custodies-sort-reset').addEventListener('click', () => {
        sortField = null;
        sortDirection = 'asc';
        sortOptions.forEach(button => button.setAttribute('aria-pressed', 'false'));
        sortPanel.querySelectorAll('[data-field]').forEach(row => row.classList.toggle('active', false));
        sortStatus.textContent = 'اختر العمود واتجاه الترتيب';
        sortButton.title = '';
        sortButton.setAttribute('aria-label', 'ترتيب العهد');
        sortButton.classList.toggle('ring-2', false);
        applyCustodyFilters();
        setSortOpen(false);
        sortButton.focus();
    });
    document.getElementById('custodies-sort-close').addEventListener('click', () => {
        setSortOpen(false);
        sortButton.focus();
    });
    sortOptions.forEach(option => option.addEventListener('click', () => {
        sortField = option.dataset.sort;
        sortDirection = option.dataset.direction;
        sortOptions.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sort === sortField && button.dataset.direction === sortDirection)));
        sortPanel.querySelectorAll('[data-field]').forEach(row => {
            row.classList.toggle('active', row.dataset.field === sortField);
        });
        const selected = Array.from(sortOptions).find(button => button.dataset.sort === sortField && button.dataset.direction === sortDirection && button.title);
        sortStatus.textContent = selected.getAttribute('aria-label');
        sortButton.title = sortStatus.textContent ?? '';
        sortButton.setAttribute('aria-label', 'ترتيب العهد: ' + sortStatus.textContent);
        sortButton.classList.toggle('ring-2', true);
        applyCustodyFilters();
        setSortOpen(false);
        sortButton.focus();
    }));
    document.addEventListener('click', event => {
        if (event.target instanceof Node && !sortMenu.contains(event.target))
            setSortOpen(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !sortPanel.inert) {
            setSortOpen(false);
            sortButton.focus();
        }
    });
    return applyCustodyFilters;
}
