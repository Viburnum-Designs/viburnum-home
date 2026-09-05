document.addEventListener('DOMContentLoaded', () => {
  const pickupContainer = document.querySelector('[data-surface-pick-up]');
  if (!pickupContainer) return;

  const observer = new MutationObserver(() => {
    const btn = pickupContainer.querySelector('[data-surface-pick-up-embed-modal-btn]');
    // Guard against re-clicking the same button: SurfacePickUp can mutate this
    // container more than once per variant load (e.g. loading class toggles,
    // then content injection), and without this flag each mutation would
    // re-trigger btn.click() - refetching and reopening the modal repeatedly.
    if (btn && !btn.dataset.autoClicked) {
      btn.dataset.autoClicked = 'true';
      btn.click();                 // triggers SurfacePickUp's existing fetch + distance calc + modal-open
      btn.style.display = 'none';  // hide the now-redundant trigger text
    }
  });

  observer.observe(pickupContainer, { childList: true, subtree: true });
});