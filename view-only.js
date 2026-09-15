/**
 * The editor opened to look, not to edit: /index.html?view=<project>.
 *
 * A published form's debug menu has a "View flowchart" button that opens this.
 * It shows that project's flowchart and saves nothing. The editor keeps its
 * autosave, the open project's id and its settings in this browser's
 * localStorage, and a viewer must never replace a person's own work - so while
 * viewing, every write lands in memory instead, and reads see those writes
 * first. The autosave reads as empty, so the "Pick up where you left off?"
 * prompt is never shown (and never answered).
 *
 * Loaded before every other editor script.
 */
(function () {
  var view = new URLSearchParams(window.location.search).get('view');
  if (!view) return;
  window.__FW_VIEW_ONLY = view;

  var real = window.localStorage;
  var proto = Object.getPrototypeOf(real);
  var get = proto.getItem, set = proto.setItem, remove = proto.removeItem, clear = proto.clear;
  var written = {};
  var gone = { flowchart_autosave_json: true };
  proto.getItem = function (k) {
    if (this !== real) return get.call(this, k);
    k = String(k);
    if (Object.prototype.hasOwnProperty.call(written, k)) return written[k];
    return gone[k] ? null : get.call(this, k);
  };
  proto.setItem = function (k, v) {
    if (this !== real) return set.call(this, k, v);
    written[String(k)] = String(v);
    delete gone[String(k)];
  };
  proto.removeItem = function (k) {
    if (this !== real) return remove.call(this, k);
    delete written[String(k)];
    gone[String(k)] = true;
  };
  proto.clear = function () {
    if (this !== real) return clear.call(this);
    written = {};
  };

  function banner(text, bad) {
    var el = document.getElementById('fwViewOnlyBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fwViewOnlyBanner';
      el.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:100000;'
        + 'padding:8px 16px;border-radius:0 0 10px 10px;font:600 14px system-ui,sans-serif;'
        + 'box-shadow:0 4px 14px rgba(0,0,0,.18);';
      document.body.appendChild(el);
    }
    el.style.background = bad ? '#fdecea' : '#e8f1ff';
    el.style.color = bad ? '#8a1c12' : '#123a75';
    el.textContent = text;
  }

  window.addEventListener('load', function () {
    var tries = 0;
    (function open() {
      if (typeof applyProjectJson !== 'function') {
        if (++tries < 150) setTimeout(open, 100);
        else banner('The editor did not start, so the flowchart cannot be shown.', true);
        return;
      }
      banner('Loading the flowchart for this form…');
      fetch('/api/project/' + encodeURIComponent(view), { cache: 'no-store' })
        .then(function (r) {
          if (r.ok) return r.text();
          throw new Error(r.status === 404
            ? 'There is no flowchart saved for this form.'
            : 'The flowchart could not be loaded (' + r.status + ').');
        })
        .then(function (text) { return applyProjectJson(text); })
        .then(function () { banner('Viewing the flowchart for this form. Nothing here is saved.'); })
        .catch(function (e) { banner(e && e.message ? e.message : 'The flowchart could not be loaded.', true); });
    })();
  });
})();
