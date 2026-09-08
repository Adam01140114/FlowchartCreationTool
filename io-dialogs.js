/**
 * Export / import dialogs.
 *
 * Every export used to fire a download straight from the button, which is the
 * wrong shape half the time: the JSON is usually on its way to a chat window,
 * another tab, or a paste box, and a file in ~/Downloads is a detour. Every
 * import used to open the file picker for the same reason in reverse. So both
 * now open a small dialog that offers each route - copy or download, paste or
 * choose a file.
 *
 * The dialogs are deliberately self-contained: they build their own DOM with
 * their own inline styles, so dropping this file into a page adds working
 * dialogs without depending on that page's modal CSS.
 *
 * FormWiz GUI ships as its own server rooted at its own folder, so it cannot
 * reach this file one directory up - it carries an identical copy. Change both.
 */
(function () {
  'use strict';

  const OVERLAY = 'position:fixed;inset:0;background:rgba(20,32,54,0.55);'
    + 'display:flex;align-items:center;justify-content:center;z-index:100000;'
    + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  const CARD = 'background:#fff;border-radius:12px;box-shadow:0 12px 40px rgba(15,23,42,0.28);'
    + 'width:min(680px,92vw);max-height:88vh;display:flex;flex-direction:column;'
    + 'padding:22px 24px 20px;box-sizing:border-box;';
  // The host pages style bare <h3>/<button>, so every rule these need is set
  // here - width included, or a sidebar's full-width buttons stack the row.
  const TITLE = 'margin:0;font-size:1.15rem;color:#1f2d3d;font-weight:700;'
    + 'flex:1 1 auto;min-width:0;width:auto;';
  const HINT = 'margin:10px 0 12px;color:#5a6c7d;font-size:0.92rem;line-height:1.45;';
  const AREA = 'width:100%;flex:1 1 auto;height:280px;min-height:140px;resize:vertical;box-sizing:border-box;'
    + 'padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;'
    + 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.45;color:#1f2d3d;';
  const ROW = 'display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap;';
  const BTN = 'padding:9px 18px;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;'
    + 'color:#1f2d3d;font-size:0.95rem;font-weight:600;cursor:pointer;'
    + 'width:auto;margin:0;display:inline-block;flex:0 0 auto;';
  const PRIMARY = 'padding:9px 18px;border-radius:8px;border:none;background:#2980b9;color:#fff;'
    + 'font-size:0.95rem;font-weight:600;cursor:pointer;'
    + 'width:auto;margin:0;display:inline-block;flex:0 0 auto;';
  const ERROR = 'margin:10px 0 0;color:#c0392b;font-size:0.9rem;min-height:1.2em;';
  const CLOSE_X = 'margin-left:auto;background:none;border:none;font-size:1.6rem;line-height:1;'
    + 'color:#64748b;cursor:pointer;padding:0 4px;width:auto;flex:0 0 auto;';

  function el(tag, style, text) {
    const node = document.createElement(tag);
    if (style) node.setAttribute('style', style);
    if (text != null) node.textContent = text;
    return node;
  }

  /** One overlay at a time, closed by Escape, the backdrop, or its own X. */
  function openOverlay(card) {
    const overlay = el('div', OVERLAY);
    overlay.appendChild(card);
    function close() {
      document.removeEventListener('keydown', onKey, true);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    return close;
  }

  function header(card, titleText, close) {
    const bar = el('div', 'display:flex;align-items:center;');
    bar.appendChild(el('h3', TITLE, titleText));
    const x = el('button', CLOSE_X, '×');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', close);
    bar.appendChild(x);
    card.appendChild(bar);
  }

  function saveFile(text, filename, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'export.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Copy, whichever way this page allows.
   *
   * The Clipboard API is missing outside a secure context and rejects even
   * where it exists - an unfocused document is enough - so the old selection
   * copy is not just a fallback for old browsers, it is the one that still
   * works when the modern call gives up.
   */
  function copyText(area, text) {
    function selectionCopy() {
      return new Promise(function (resolve, reject) {
        try {
          area.removeAttribute('readonly');
          area.select();
          const ok = document.execCommand('copy');
          area.setAttribute('readonly', 'readonly');
          ok ? resolve() : reject(new Error('the browser blocked the copy'));
        } catch (err) { reject(err); }
      });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(selectionCopy);
    }
    return selectionCopy();
  }

  function flash(button, message) {
    const original = button.textContent;
    button.textContent = message;
    setTimeout(function () { button.textContent = original; }, 1600);
  }

  /**
   * Show exported text with both ways out of it.
   *
   * `text` may be a string, or a function returning one - or a promise, since a
   * project export loads every form in turn and takes a few seconds.
   */
  window.showExportDialog = function (options) {
    const opts = options || {};
    const card = el('div', CARD);
    const close = openOverlay(card);
    header(card, opts.title || 'Export', close);
    card.appendChild(el('p', HINT, opts.description
      || 'Copy this to the clipboard, or download it as a file.'));

    const area = el('textarea', AREA);
    area.setAttribute('readonly', 'readonly');
    area.value = 'Preparing…';
    card.appendChild(area);
    const error = el('p', ERROR, '');
    card.appendChild(error);

    const row = el('div', ROW);
    const copyBtn = el('button', PRIMARY, 'Copy');
    const downloadBtn = el('button', BTN, 'Download');
    const closeBtn = el('button', BTN, 'Close');
    [copyBtn, downloadBtn, closeBtn].forEach(function (b) { b.type = 'button'; });
    copyBtn.disabled = downloadBtn.disabled = true;
    row.appendChild(copyBtn);
    row.appendChild(downloadBtn);
    row.appendChild(closeBtn);
    card.appendChild(row);
    closeBtn.addEventListener('click', close);

    function ready(text) {
      area.value = text;
      copyBtn.disabled = downloadBtn.disabled = false;
      copyBtn.addEventListener('click', function () {
        copyText(area, text).then(function () {
          flash(copyBtn, 'Copied');
        }).catch(function (err) {
          error.textContent = 'Could not copy: ' + (err && err.message ? err.message : err);
        });
      });
      downloadBtn.addEventListener('click', function () {
        saveFile(text, opts.filename, opts.mime);
        flash(downloadBtn, 'Downloaded');
      });
      setTimeout(function () { area.focus(); area.select(); }, 0);
    }

    let produced;
    try {
      produced = (typeof opts.text === 'function') ? opts.text() : opts.text;
    } catch (err) {
      area.value = '';
      error.textContent = 'Export failed: ' + (err && err.message ? err.message : err);
      return close;
    }
    Promise.resolve(produced).then(function (text) {
      ready(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    }).catch(function (err) {
      area.value = '';
      error.textContent = 'Export failed: ' + (err && err.message ? err.message : err);
    });
    return close;
  };

  /**
   * Take input as pasted text or as a file. `apply(text)` does the importing and
   * throws with a readable message when the text is not what it should be; the
   * dialog stays open on failure so the paste can be corrected in place.
   */
  window.showImportDialog = function (options) {
    const opts = options || {};
    const card = el('div', CARD);
    const close = openOverlay(card);
    header(card, opts.title || 'Import', close);
    card.appendChild(el('p', HINT, opts.description
      || 'Paste the JSON below, or choose a file from your computer.'));

    const area = el('textarea', AREA);
    area.placeholder = opts.placeholder || '{ ... }';
    card.appendChild(area);
    const error = el('p', ERROR, '');
    card.appendChild(error);

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = opts.accept || '.json,application/json';
    file.style.display = 'none';
    card.appendChild(file);

    const row = el('div', ROW);
    const importBtn = el('button', PRIMARY, 'Import Pasted');
    const chooseBtn = el('button', BTN, 'Choose File…');
    const cancelBtn = el('button', BTN, 'Cancel');
    [importBtn, chooseBtn, cancelBtn].forEach(function (b) { b.type = 'button'; });
    row.appendChild(importBtn);
    row.appendChild(chooseBtn);
    row.appendChild(cancelBtn);
    card.appendChild(row);

    function run(text) {
      error.textContent = '';
      try {
        opts.apply(String(text == null ? '' : text));
      } catch (err) {
        error.textContent = (err && err.message) ? err.message : String(err);
        return;
      }
      close();
    }

    importBtn.addEventListener('click', function () {
      if (!area.value.trim()) {
        error.textContent = 'Paste something first, or choose a file.';
        return;
      }
      run(area.value);
    });
    chooseBtn.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      const reader = new FileReader();
      reader.onload = function (e) { run(e.target.result); };
      reader.onerror = function () { error.textContent = 'Could not read that file.'; };
      reader.readAsText(chosen);
      file.value = '';
    });
    cancelBtn.addEventListener('click', close);

    setTimeout(function () { area.focus(); }, 0);
    return close;
  };
})();
