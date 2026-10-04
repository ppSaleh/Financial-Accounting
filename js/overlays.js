let mouseDownTarget = null;
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmMessage = document.getElementById('confirm-overlay-message');
let resolveConfirmation = null;
export function confirmAction(message) {
    if (resolveConfirmation)
        return Promise.resolve(false);
    confirmMessage.textContent = message;
    confirmOverlay.classList.remove('hidden');
    return new Promise(resolve => { resolveConfirmation = resolve; });
}
function finishConfirmation(confirmed) {
    if (!resolveConfirmation)
        return;
    const resolve = resolveConfirmation;
    resolveConfirmation = null;
    confirmOverlay.classList.add('hidden');
    resolve(confirmed);
}
document.getElementById('confirm-overlay-confirm').addEventListener('click', () => finishConfirmation(true));
document.getElementById('confirm-overlay-cancel').addEventListener('click', () => finishConfirmation(false));
document.getElementById('confirm-overlay-close').addEventListener('click', () => finishConfirmation(false));
const imageOverlay = document.getElementById('image-overlay');
document.getElementById('image-overlay-close')?.addEventListener('click', () => {
    imageOverlay.classList.add('hidden');
});
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape')
        return;
    if (resolveConfirmation) {
        finishConfirmation(false);
        return;
    }
    document.querySelectorAll('.overlay:not(.forced):not(.hidden)').forEach((overlay) => {
        overlay.classList.add('hidden');
    });
});
document.addEventListener("mousedown", (event) => {
    mouseDownTarget = event.target;
});
document.addEventListener("mouseup", (event) => {
    const target = event.target;
    if (event.button === 0 &&
        target === mouseDownTarget &&
        target instanceof Element &&
        target.matches(".overlay:not(.forced)")) {
        if (target === confirmOverlay)
            finishConfirmation(false);
        else
            target.classList.add("hidden");
    }
    mouseDownTarget = null;
});
// Tooltips
const tooltipEl = document.getElementById('custom-tooltip');
function attachTooltip(element, context) {
    element.onmouseenter = () => showTooltip(element, context);
    element.onmouseleave = hideTooltip;
}
function showTooltip(element, context) {
    if (!element)
        return;
    tooltipEl.textContent = context;
    tooltipEl.className = 'show';
    const r = element.getBoundingClientRect();
    let top = r.top + window.scrollY - tooltipEl.offsetHeight - 8;
    if (r.top - tooltipEl.offsetHeight - 10 < 0)
        top = r.bottom + window.scrollY + 8;
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${r.left + window.scrollX + (r.width / 2) - (tooltipEl.offsetWidth / 2)}px`;
}
async function hideTooltip() {
    tooltipEl.className = '';
}
function attachtooltips() {
    let elements = document.querySelectorAll(".has-tooltip");
    elements.forEach(element => attachTooltip(element, element.dataset.tooltip ?? 'no tooltip'));
}
attachtooltips();
