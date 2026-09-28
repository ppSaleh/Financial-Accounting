"use strict";
let mouseDownTarget = null;
const imageOverlay = document.getElementById('image-overlay');
document.getElementById('image-overlay-close')?.addEventListener('click', () => {
    imageOverlay.classList.add('hidden');
});
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape')
        return;
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
        target.classList.add("hidden");
    }
    mouseDownTarget = null;
});
