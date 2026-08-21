document.addEventListener('DOMContentLoaded', () => {
  const pickupContainer = document.querySelector('[data-surface-pick-up]');
  if (!pickupContainer) return;

  const observer = new MutationObserver(() => {
    const btn = pickupContainer.querySelector('[data-surface-pick-up-embed-modal-btn]');
    if (btn) {
      btn.click();                 // triggers SurfacePickUp's existing fetch + distance calc + modal-open
      btn.style.display = 'none';  // hide the now-redundant trigger text
    }
  });

  observer.observe(pickupContainer, { childList: true, subtree: true });
});