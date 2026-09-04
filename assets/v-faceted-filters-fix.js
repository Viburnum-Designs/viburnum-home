/**
 * Faceted Filters Fix
 * -----------------------------------------------------------------------
 * Works around a bug in this theme's grid.js `FacetedFilters` class:
 *
 *   1. `_filterClick()` — the handler bound to every non-range filter
 *      option (e.g. Availability) — only toggles a decorative
 *      `data-checked` / `data-filter-active` attribute. It never rebuilds
 *      the URL or reloads the collection, so choosing an option looks
 *      "selected" but nothing actually filters.
 *
 *   2. `buildFilterQuery()` only has a code path for the Price range
 *      slider (`.filter-range-input`). Every other filter type falls
 *      through with `searchParameters` left `undefined`, which would
 *      produce an invalid `?undefined` URL if it were ever reached.
 *
 * This file loads AFTER grid.js and re-implements "apply on change"
 * generically for every filter type, so it works regardless of which
 * facet (Availability, Price, Vendor, Type, etc.) the shopper touches.
 *
 * Load it right after grid.js, e.g. in theme.liquid:
 *   {{ 'grid.js' | asset_url | script_tag }}
 *   {{ 'faceted-filters-fix.js' | asset_url | script_tag }}
 *
 * NOTE: This assumes the filter markup lives inside a <form> (the same
 * assumption the theme's own price-range code makes via
 * `new FormData(element.closest('form'))`). If your collection template
 * wraps filters in a form with a specific id, add it to
 * `FORM_SELECTORS` below.
 */
console.log("loaded");
(function () {
  'use strict';

  var FORM_SELECTORS = [
    'form[data-faceted-filter]',
    '#FacetFiltersForm',
    '#CollectionFiltersForm',
  ];

  function debounce(fn, wait) {
    var timeout;
    return function debounced() {
      var args = arguments;
      var context = this;
      clearTimeout(timeout);
      timeout = setTimeout(function () {
        fn.apply(context, args);
      }, wait);
    };
  }

  function getFilterForm() {
    for (var i = 0; i < FORM_SELECTORS.length; i++) {
      var form = document.querySelector(FORM_SELECTORS[i]);
      if (form) return form;
    }

    // Fall back to whatever <form> wraps the filter groups.
    var anyFilterGroup = document.querySelector('[data-filter-group]');
    return anyFilterGroup ? anyFilterGroup.closest('form') : null;
  }

  function currentSortBy() {
    var params = new URLSearchParams(window.location.search);
    return params.get('sort_by');
  }

  // Rebuilds the query string from the ENTIRE filter form's current
  // state (all checked checkboxes/radios/selects + price range fields)
  // and navigates. This replaces the theme's incomplete
  // `buildFilterQuery()` / `_filterClick()` combo.
  function applyFilters(form) {
    if (!form) return;

    var formData = new FormData(form);
    var params = new URLSearchParams(formData);

    // Preserve the current sort order if the form itself doesn't include it.
    if (!params.has('sort_by')) {
      var sortBy = currentSortBy();
      if (sortBy) params.set('sort_by', sortBy);
    }

    window.location.search = params.toString();
  }

  // Keeps the theme's decorative checkbox mark (`[data-filter-checkbox]`)
  // in sync with whatever we determine the "on" state to be, purely for
  // visual consistency during the brief moment before the page reloads.
  function syncDecorativeCheckbox(target) {
    var decorative = target.querySelector('[data-filter-checkbox]');
    var isActive = target.hasAttribute('data-filter-active');

    if (!decorative) return;

    if (isActive) {
      decorative.setAttribute('data-checked', '');
    } else {
      decorative.removeAttribute('data-checked');
    }
  }

  function initFacetedFiltersFix() {
    var form = getFilterForm();
    if (!form) return;

    // Avoid double-binding if this fires more than once (e.g. theme
    // editor section reloads).
    if (form.dataset.facetedFiltersFixBound === 'true') return;
    form.dataset.facetedFiltersFixBound = 'true';

    var debouncedApply = debounce(function () {
      applyFilters(form);
    }, 50);

    // 1. Real <input type="checkbox"/"radio"> or <select> filters.
    //    Native `change` events already update FormData correctly -
    //    we just need to actually apply them (the theme never does).
    form.addEventListener('change', function (event) {
      var input = event.target;
      if (
        input.matches &&
        input.matches('input[type="checkbox"], input[type="radio"], select')
      ) {
        debouncedApply();
      }
    });

    // 2. The theme's decorative `[data-filter-input]` wrappers (this is
    //    what `FacetedFilters.prototype._filterClick` binds to, and all
    //    it does is toggle a `data-filter-active` attribute). If there's
    //    a real checkbox/radio inside, its native `change` event (above)
    //    will already trigger a reapply - this just also covers wrappers
    //    with no underlying native input.
    var filterInputs = form.querySelectorAll('[data-filter-input]');
    for (var i = 0; i < filterInputs.length; i++) {
      (function (target) {
        target.addEventListener('click', function () {
          if (target.dataset.hasOwnProperty('disabled')) return;

          // Let the theme's own click handler (and any native input
          // toggle) finish first, then re-sync + apply.
          requestAnimationFrame(function () {
            syncDecorativeCheckbox(target);
            debouncedApply();
          });
        });
      })(filterInputs[i]);
    }

    // 3. Price range inputs. These partly work already via the theme's
    //    own `updatePrice()`/`getFilteredResults()`, but that path only
    //    ever builds a query for the range fields themselves - any
    //    checkbox filters checked at the same time were never included
    //    (since `_filterClick` never applies anything). Debounce +
    //    reapply full form state here too so nothing gets lost.
    var rangeInputs = form.querySelectorAll('[data-filter-range]');
    for (var j = 0; j < rangeInputs.length; j++) {
      rangeInputs[j].addEventListener('change', debouncedApply);
      rangeInputs[j].addEventListener('keyup', function (event) {
        if (event.key !== 'Tab') debouncedApply();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFacetedFiltersFix);
  } else {
    initFacetedFiltersFix();
  }

  // Re-init after theme editor swaps sections in/out.
  document.addEventListener('shopify:section:load', initFacetedFiltersFix);
})();