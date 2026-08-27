document.addEventListener('DOMContentLoaded', () => {
  // Event delegation handles all 'read more' buttons at once
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.js--read-more-text__toggle');
    if (!btn) return;

    const container = btn.closest('.read-more-text__description');
    const shortText = container.querySelector('.read-more-text__short');
    const fullText = container.querySelector('.read-more-text__full');
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      shortText.style.display = 'block';
      fullText.style.display = 'none';
      btn.textContent = 'Read more';
      btn.setAttribute('aria-expanded', 'false');
    } else {
      shortText.style.display = 'none';
      fullText.style.display = 'block';
      btn.textContent = 'Read less';
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});