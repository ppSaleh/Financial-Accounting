"use strict";
let mouseDownTarget = null;
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
