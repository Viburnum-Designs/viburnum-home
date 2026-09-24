window.VTradeForm = (function () {
  'use strict';

  // Keep uploads under your host's request body limit
  // (Vercel serverless functions cap requests at ~4.5 MB).
  var MAX_FILE_BYTES = 4 * 1024 * 1024;
  var MAX_TOTAL_BYTES = 4 * 1024 * 1024;
  var ALLOWED_EXT = ['jpg', 'jpeg', 'pdf'];
  var REQUEST_TIMEOUT_MS = 30000;
  var HONEYPOT_NAME = 'website';

  var instances = {};

  /* ---------- helpers ---------- */

  function formatBytes(bytes) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function addDescribedBy(input, id) {
    var ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    if (ids.indexOf(id) === -1) ids.push(id);
    input.setAttribute('aria-describedby', ids.join(' '));
  }

  function removeDescribedBy(input, id) {
    var ids = (input.getAttribute('aria-describedby') || '')
      .split(' ')
      .filter(function (x) { return x && x !== id; });
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  }

  function normalizeUrl(value) {
    var v = value.trim();
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
      var url = new URL(v);
      return url.hostname.indexOf('.') > -1 ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  /* ---------- per-control validation ---------- */

  // Returns { container, inputs, errorId } describing where an error for this control lives.
  function getTarget(form, input) {
    if (input.type === 'radio') {
      return {
        container: input.closest('fieldset'),
        inputs: Array.prototype.slice.call(
          form.querySelectorAll('input[type="radio"][name="' + input.name + '"]')
        ),
        errorId: form.id + '-' + input.name + '-error',
      };
    }
    return {
      container: input.closest('.v-field'),
      inputs: [input],
      errorId: input.id + '-error',
    };
  }

  function getError(form, input, inst) {
    var value = input.value ? input.value.trim() : '';

    if (input.type === 'radio') {
      var checked = form.querySelector('input[name="' + input.name + '"]:checked');
      return input.required && !checked ? 'Choose an option.' : null;
    }

    if (input.type === 'file') {
      var file = input.files[0];
      if (!file) return input.required ? 'Upload a JPG or PDF file.' : null;
      var ext = file.name.split('.').pop().toLowerCase();
      if (ALLOWED_EXT.indexOf(ext) === -1) return 'This file type isn’t supported. Upload a JPG or PDF.';
      if (file.size > MAX_FILE_BYTES) {
        return 'This file is ' + formatBytes(file.size) + '. Upload a file under ' + formatBytes(MAX_FILE_BYTES) + '.';
      }
      return null;
    }

    if (!value) return input.required ? 'Enter your ' + getLabelText(input) + '.' : null;

    if (input.type === 'email' && input.validity.typeMismatch) {
      return 'Enter an email address like name@company.com.';
    }

    if (input.type === 'tel' && inst.iti && !inst.iti.isValidNumber()) {
      return 'Enter a valid phone number for the selected country.';
    }

    if (input.type === 'url') {
      var normalized = normalizeUrl(value);
      if (normalized === null) return 'Enter a web address like instagram.com/yourstudio.';
      input.value = normalized;
    }

    return null;
  }

  function getLabelText(input) {
    var label = input.id && document.querySelector('label[for="' + input.id + '"]');
    if (!label) return 'details';
    // Strip the "*" required marker.
    return label.textContent.replace('*', '').trim().toLowerCase();
  }

  function showError(target, message) {
    var errorEl = document.getElementById(target.errorId);

    if (message) {
      if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.id = target.errorId;
        errorEl.className = 'v-field__error';
        target.container.appendChild(errorEl);
      }
      errorEl.textContent = message;
    } else if (errorEl) {
      errorEl.remove();
    }

    target.container.classList.toggle('is-invalid', !!message);
    target.inputs.forEach(function (input) {
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        addDescribedBy(input, target.errorId);
      } else {
        input.removeAttribute('aria-invalid');
        removeDescribedBy(input, target.errorId);
      }
    });
  }

  function validateControl(inst, input) {
    var message = getError(inst.form, input, inst);
    showError(getTarget(inst.form, input), message);
    return message;
  }

  // Validates every control in DOM order; returns the first control to focus, or null.
  function validateAll(inst) {
    var form = inst.form;
    var seenRadioGroups = {};
    var firstInvalid = null;
    var totalBytes = 0;

    var controls = form.querySelectorAll('input:not([type="hidden"]):not([name="' + HONEYPOT_NAME + '"]), textarea, select');

    controls.forEach(function (input) {
      if (input.type === 'radio') {
        if (seenRadioGroups[input.name]) return;
        seenRadioGroups[input.name] = true;
      }
      if (input.type === 'file' && input.files[0]) totalBytes += input.files[0].size;

      if (validateControl(inst, input) && !firstInvalid) firstInvalid = input;
    });

    if (!firstInvalid && totalBytes > MAX_TOTAL_BYTES) {
      var lastFile = form.querySelectorAll('[data-file-input]');
      lastFile = lastFile[lastFile.length - 1];
      showError(
        getTarget(form, lastFile),
        'Your files add up to ' + formatBytes(totalBytes) + '. Keep the total under ' + formatBytes(MAX_TOTAL_BYTES) + '.'
      );
      firstInvalid = lastFile;
    }

    return firstInvalid;
  }

  /* ---------- status ---------- */

  function setStatus(statusEl, state, message, focus) {
    statusEl.hidden = false;
    statusEl.dataset.state = state;
    // Clear, then set on the next tick so screen readers announce repeat messages.
    statusEl.textContent = '';
    window.setTimeout(function () {
      statusEl.textContent = message;
      if (focus) statusEl.focus();
    }, 100);
  }

  /* ---------- submit ---------- */

  function setBusy(inst, busy) {
    inst.submitting = busy;
    inst.submitBtn.disabled = busy;
    inst.form.setAttribute('aria-busy', busy ? 'true' : 'false');
    inst.btnLabel.textContent = busy ? 'Sending application…' : inst.originalLabel;
  }

  function resetForm(inst) {
    inst.form.reset();
    inst.form.querySelectorAll('[data-file-name]').forEach(function (el) {
      el.textContent = '';
    });
  }

  async function handleSubmit(event, inst) {
    event.preventDefault();
    if (inst.submitting) return;

    var firstInvalid = validateAll(inst);
    if (firstInvalid) {
      setStatus(inst.statusEl, 'error', 'Some fields need attention. Check the highlighted fields and try again.');
      firstInvalid.focus();
      return;
    }

    // Bots fill the hidden honeypot field; pretend it worked and send nothing.
    var honeypot = inst.form.querySelector('[name="' + HONEYPOT_NAME + '"]');
    if (honeypot && honeypot.value) {
      resetForm(inst);
      setStatus(inst.statusEl, 'success', 'Application sent. We’ll be in touch soon.', true);
      return;
    }

    if (!inst.endpoint) {
      setStatus(inst.statusEl, 'error', 'This form isn’t connected to a submission endpoint yet.');
      return;
    }

    var formData = new FormData(inst.form);
    formData.delete(HONEYPOT_NAME);
    // Send the full international number (e.g. +19735551234), not just what was typed.
    if (inst.iti) formData.set('phone', inst.iti.getNumber());

    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);

    setBusy(inst, true);

    try {
      var response = await fetch(inst.endpoint, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('HTTP ' + response.status);

      resetForm(inst);
      setStatus(inst.statusEl, 'success', 'Application sent. We’ll review it and be in touch soon.', true);
    } catch (err) {
      var message =
        err.name === 'AbortError'
          ? 'The upload took too long and was stopped. Check your connection and send the application again.'
          : 'Your application didn’t go through. Send it again, or email us if the problem continues.';
      setStatus(inst.statusEl, 'error', message, true);
    } finally {
      window.clearTimeout(timer);
      setBusy(inst, false);
    }
  }

  /* ---------- setup ---------- */

  function initPhoneField(root) {
    var phoneInput = root.querySelector('input[type="tel"]');
    if (!phoneInput || typeof window.intlTelInput !== 'function') return null;

    // intlTelInputWithUtils already bundles utils, so no utilsScript is needed.
    return window.intlTelInput(phoneInput, {
      initialCountry: 'us',
      separateDialCode: true,
    });
  }

  function initFileFields(root) {
    root.querySelectorAll('[data-file-input]').forEach(function (input) {
      input.addEventListener('change', function () {
        var nameEl = input.closest('.v-field').querySelector('[data-file-name]');
        if (nameEl) nameEl.textContent = input.files.length ? input.files[0].name : '';
      });
    });
  }

  function init(sectionId) {
    if (instances[sectionId]) return;

    var root = document.getElementById('v-trade-form-' + sectionId);
    if (!root) return;

    var form = root.querySelector('[data-v-trade-form]');
    if (!form) return;

    var inst = {
      form: form,
      statusEl: root.querySelector('[data-form-status]'),
      submitBtn: root.querySelector('[data-submit-btn]'),
      btnLabel: root.querySelector('[data-btn-label]'),
      endpoint: form.dataset.endpoint,
      submitting: false,
      iti: null,
    };
    inst.originalLabel = inst.btnLabel.textContent;
    inst.statusEl.setAttribute('tabindex', '-1');

    inst.iti = initPhoneField(root);
    initFileFields(root);

    // Once a field has been flagged, clear or update its error as the user fixes it.
    function revalidate(event) {
      var input = event.target;
      if (!input.name || input.name === HONEYPOT_NAME) return;
      var target = getTarget(form, input);
      if (target.container && target.container.classList.contains('is-invalid')) {
        validateControl(inst, input);
      }
    }
    form.addEventListener('change', revalidate);
    form.addEventListener('input', revalidate);

    form.addEventListener('submit', function (event) {
      handleSubmit(event, inst);
    });

    instances[sectionId] = inst;
  }

  function destroy(sectionId) {
    var inst = instances[sectionId];
    if (!inst) return;
    if (inst.iti) inst.iti.destroy();
    delete instances[sectionId];
  }

  function initAll() {
    document.querySelectorAll('.v-trade-form-section').forEach(function (el) {
      init(el.id.replace('v-trade-form-', ''));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Theme editor support
  document.addEventListener('shopify:section:load', function (event) {
    init(event.detail.sectionId);
  });
  document.addEventListener('shopify:section:unload', function (event) {
    destroy(event.detail.sectionId);
  });

  return { init: init, destroy: destroy };
})();