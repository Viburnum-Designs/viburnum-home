window.VTradeForm = (function () {
  function initPhoneField(root) {
    var phoneInput = root.querySelector('input[type="tel"]');
    if (!phoneInput || typeof window.intlTelInput !== 'function') return null;

    return window.intlTelInput(phoneInput, {
      initialCountry: 'us',
      separateDialCode: true,
      utilsScript:
        'https://cdn.jsdelivr.net/npm/intl-tel-input@23/build/js/utils.js',
    });
  }

  function initFileFields(root) {
    var fileInputs = root.querySelectorAll('[data-file-input]');
    fileInputs.forEach(function (input) {
      input.addEventListener('change', function () {
        var nameEl = input.closest('.v-field').querySelector('[data-file-name]');
        if (!nameEl) return;
        nameEl.textContent = input.files.length ? input.files[0].name : '';
      });
    });
  }

  function setFieldError(field, message) {
    var input = field.querySelector('input, textarea');
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');

    var existing = field.querySelector('.v-field__error');
    if (existing) existing.remove();

    if (message) {
      var errorEl = document.createElement('span');
      errorEl.className = 'v-field__error';
      errorEl.textContent = message;
      field.appendChild(errorEl);
    }
  }

  function validate(form) {
    var isValid = true;
    var requiredFields = form.querySelectorAll('[required]');

    requiredFields.forEach(function (input) {
      var field = input.closest('.v-field, .v-fieldset') || input.parentElement;
      var filled =
        input.type === 'radio'
          ? form.querySelectorAll('input[name="' + input.name + '"]:checked').length > 0
          : input.type === 'file'
          ? input.files.length > 0
          : input.value.trim() !== '';

      if (!filled) {
        isValid = false;
        if (field.classList.contains('v-field')) {
          setFieldError(field, 'This field is required.');
        } else {
          field.classList.add('v-fieldset--error');
        }
      } else if (field.classList.contains('v-field')) {
        setFieldError(field, null);
      } else {
        field.classList.remove('v-fieldset--error');
      }
    });

    return isValid;
  }

  function setStatus(statusEl, state, message) {
    statusEl.hidden = false;
    statusEl.dataset.state = state;
    statusEl.textContent = message;
  }

  async function handleSubmit(event, form, endpoint, statusEl, submitBtn, btnLabel) {
    event.preventDefault();

    if (!validate(form)) {
      setStatus(statusEl, 'error', 'Please fill in all required fields.');
      var firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    if (!endpoint) {
      setStatus(
        statusEl,
        'error',
        'This form is not connected to a submission endpoint yet.'
      );
      return;
    }

    submitBtn.disabled = true;
    var originalLabel = btnLabel.textContent;
    btnLabel.textContent = 'Submitting…';

    try {
      var formData = new FormData(form);
      var response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Request failed');

      form.reset();
      form.querySelectorAll('[data-file-name]').forEach(function (el) {
        el.textContent = '';
      });
      setStatus(
        statusEl,
        'success',
        'Thanks — your application has been submitted. We will be in touch soon.'
      );
    } catch (err) {
      setStatus(
        statusEl,
        'error',
        'Something went wrong submitting your application. Please try again.'
      );
    } finally {
      submitBtn.disabled = false;
      btnLabel.textContent = originalLabel;
    }
  }

  function init(sectionId) {
    var root = document.getElementById('v-trade-form-' + sectionId);
    if (!root) return;

    var form = root.querySelector('[data-v-trade-form]');
    var statusEl = root.querySelector('[data-form-status]');
    var submitBtn = root.querySelector('[data-submit-btn]');
    var btnLabel = root.querySelector('[data-btn-label]');
    var endpoint = form.dataset.endpoint;

    initPhoneField(root);
    initFileFields(root);

    form.addEventListener('submit', function (event) {
      handleSubmit(event, form, endpoint, statusEl, submitBtn, btnLabel);
    });
  }

  return { init: init };
})();
