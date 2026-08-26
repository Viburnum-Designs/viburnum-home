document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('v-gallery-modal');
  const modalImg = document.getElementById('modal-active-img');
  const prevBtn = document.getElementById('modal-prev');
  const nextBtn = document.getElementById('modal-next');
  const thumbs = Array.from(document.querySelectorAll('.js--v-gallery-open'));

  let currentIndex = 0;
  let lastActiveElement = null;

  function openModal(index) {
    lastActiveElement = document.activeElement;
    currentIndex = index;
    updateModalImage();
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    modal.querySelector('.close-btn')?.focus();
    document.addEventListener('keydown', handleKeyDown);
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleKeyDown);
    if (lastActiveElement) lastActiveElement.focus();
  }

  function updateModalImage() {
    const thumb = thumbs[currentIndex];
    if (!thumb) return;
    modalImg.src = thumb.getAttribute('data-full-src');
    modalImg.alt = thumb.getAttribute('data-alt') || '';
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % thumbs.length;
    updateModalImage();
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + thumbs.length) % thumbs.length;
    updateModalImage();
  }

  function handleKeyDown(e) {
    if (modal.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  }

  thumbs.forEach((thumb, i) => thumb.addEventListener('click', () => openModal(i)));
  nextBtn.addEventListener('click', showNext);
  prevBtn.addEventListener('click', showPrev);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
});