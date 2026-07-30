/**
 * Alert-list signup. The only place this site writes to the network.
 *
 * Sends exactly two fields: an email address and a medication preference. It does
 * not and must not send the visitor's insurance situation, dose, or anything else
 * selected in the price tool -- those are health information and they never leave
 * the browser. The tool's state is not even importable from here.
 */

const form = document.querySelector('[data-alerts-form]');
const status = document.querySelector('[data-alerts-status]');

/** Set the status line. `kind` is 'ok', 'error' or '' for neutral. */
function setStatus(message, kind = '') {
  if (!status) return;
  status.textContent = message;
  status.className = `form-status${kind ? ` form-status--${kind}` : ''}`;
}

/**
 * Shape check only. The server validates authoritatively; this exists so a
 * mistyped address gets an instant answer instead of a round trip.
 *
 * @param {string} value
 * @returns {boolean}
 */
function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const button = form.querySelector('button[type="submit"]');
  const email = form.querySelector('#email')?.value.trim() ?? '';
  const drug = form.querySelector('#alert-drug')?.value ?? 'all';

  if (!looksLikeEmail(email)) {
    setStatus('That does not look like an email address. Check it and try again.', 'error');
    form.querySelector('#email')?.focus();
    return;
  }

  button.disabled = true;
  setStatus('Signing you up.');

  try {
    const response = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, drug }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus(
        payload.error ?? 'Something went wrong signing you up. Please try again shortly.',
        'error'
      );
      button.disabled = false;
      return;
    }

    setStatus(
      'Done. You will get an email when a price for your medication changes, with the source.',
      'ok'
    );
    form.reset();
  } catch {
    setStatus(
      'We could not reach the server. Check your connection and try again.',
      'error'
    );
    button.disabled = false;
  }
});
