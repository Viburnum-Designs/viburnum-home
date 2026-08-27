document.addEventListener('DOMContentLoaded', () => {
  const slideshows = document.querySelectorAll('[data-slideshow]');

  slideshows.forEach((slideshow) => {
    const slides = slideshow.querySelectorAll('.home-slideshow-slide');

    function syncSlideFocusability(slide) {
      const isHidden = slide.getAttribute('aria-hidden') === 'true';
      const focusableEls = slide.querySelectorAll('a, button, input, [tabindex]');

      focusableEls.forEach((el) => {
        if (isHidden) {
          if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') {
            el.dataset.originalTabindex = el.getAttribute('tabindex');
          }
          el.setAttribute('tabindex', '-1');
        } else {
          if (el.dataset.originalTabindex) {
            el.setAttribute('tabindex', el.dataset.originalTabindex);
            delete el.dataset.originalTabindex;
          } else {
            el.removeAttribute('tabindex');
          }
        }
      });
    }

    slides.forEach((slide) => {
      // Run once immediately, in case slides already have aria-hidden set on load
      syncSlideFocusability(slide);

      // Watch for future changes to aria-hidden, whenever grid.js/Flickity updates it
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'aria-hidden') {
            syncSlideFocusability(slide);
          }
        });
      });

      observer.observe(slide, { attributes: true, attributeFilter: ['aria-hidden'] });
    });
  });
});