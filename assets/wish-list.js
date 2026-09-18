document.addEventListener('click', function (event) {
  const button = event.target.closest('[data-wishlist-toggle]');
  if (!button) return;

  event.preventDefault();
  toggleWishlist(button);
});

async function toggleWishlist(button) {
  const productId = button.dataset.productId;
  const isActive = button.classList.contains('is-active');
  const nextState = !isActive;

  // Optimistic UI update — flip immediately, roll back on failure
  setButtonState(button, nextState);
  button.disabled = true;

  try {
    const response = await fetch('/apps/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        action: nextState ? 'add' : 'remove',
      }),
    });

    if (!response.ok) throw new Error('Wishlist toggle failed');

    const data = await response.json();
    // Trust the server's actual resulting state over our optimistic guess
    setButtonState(button, data.is_wishlisted);
  } catch (error) {
    console.error('Wishlist toggle error:', error);
    setButtonState(button, isActive); // roll back
  } finally {
    button.disabled = false;
  }
}

function setButtonState(button, isActive) {
  button.classList.toggle('is-active', isActive);
  button.setAttribute('aria-pressed', isActive);
  button.setAttribute(
    'aria-label',
    isActive ? 'Remove from wishlist' : 'Add to wishlist'
  );
}