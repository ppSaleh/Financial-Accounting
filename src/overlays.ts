let mouseDownTarget: EventTarget | null = null;

const confirmOverlay = document.getElementById('confirm-overlay')!;
const confirmMessage = document.getElementById('confirm-overlay-message')!;
let resolveConfirmation: ((confirmed: boolean) => void) | null = null;

export function confirmAction(message: string): Promise<boolean> {
  if (resolveConfirmation) return Promise.resolve(false);
  confirmMessage.textContent = message;
  confirmOverlay.classList.remove('hidden');
  return new Promise(resolve => { resolveConfirmation = resolve; });
}

function finishConfirmation(confirmed: boolean) {
  if (!resolveConfirmation) return;
  const resolve = resolveConfirmation;
  resolveConfirmation = null;
  confirmOverlay.classList.add('hidden');
  resolve(confirmed);
}

document.getElementById('confirm-overlay-confirm')!.addEventListener('click', () => finishConfirmation(true));
document.getElementById('confirm-overlay-cancel')!.addEventListener('click', () => finishConfirmation(false));
document.getElementById('confirm-overlay-close')!.addEventListener('click', () => finishConfirmation(false));

const imageOverlay = document.getElementById('image-overlay')!;
document.getElementById('image-overlay-close')?.addEventListener('click', () => {
  imageOverlay.classList.add('hidden');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
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

  if (
    event.button === 0 &&
    target === mouseDownTarget &&
    target instanceof Element &&
    target.matches(".overlay:not(.forced)")
  ) {
    if (target === confirmOverlay) finishConfirmation(false);
    else target.classList.add("hidden");
  }

  mouseDownTarget = null;
});
