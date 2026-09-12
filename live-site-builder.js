/**
 * Build the project's live site from the form builder page (FormWiz GUI/gui.html).
 *
 * Generates the whole packet - the page the thank-you screen's Download Payload
 * packages - once per way of asking (one question at a time, one section at a
 * time), and has the dev server write them to live-sites/<name>/ with its CSS,
 * logo, county lookup and PDFs. index.html?mode=question and ?mode=section pick
 * the page. Run inside gui.html; the skill .claude/skills/publish-live-site
 * says when.
 *
 *   const s = document.createElement('script');
 *   s.src = '/live-site-builder.js?t=' + Date.now();
 *   document.head.appendChild(s);
 *   await new Promise(function (r) { s.onload = r; });
 *   await window.buildLiveSite({ gui: '/dv-packet-gui.json' });
 */
(function () {
  /** Every PDF the packet can produce: each form's, the main one, and any extras. */
  function pdfNamesOf(json) {
    const names = [];
    const add = function (name) {
      if (!name) return;
      const base = String(typeof name === 'object' ? (name.pdfName || name.name || name.file || '') : name)
        .replace(/^.*[\\/]/, '').trim();
      if (!base) return;
      const withExt = /\.pdf$/i.test(base) ? base : base + '.pdf';
      if (names.indexOf(withExt) < 0) names.push(withExt);
    };
    (json.projectForms || []).forEach(function (form) { add(form.pdfFile); });
    add(json.pdfOutputName);
    (json.additionalPDFs || []).forEach(add);
    return names;
  }

  window.buildLiveSite = async function (options) {
    const opts = options || {};
    if (typeof loadFormData !== 'function' || typeof getFormHTML !== 'function') {
      throw new Error('Run buildLiveSite inside FormWiz GUI/gui.html');
    }
    const modes = (opts.modes || ['question', 'section']).filter(function (m) {
      return m === 'question' || m === 'section' || m === 'all';
    });
    if (!modes.length) throw new Error('modes must name question, section and/or all');

    // The editor's Save hands the interview over directly (live-site-publish.js);
    // the skill reads it from a file.
    let json = opts.json || null;
    const guiUrl = opts.gui || '/dv-packet-gui.json';
    if (!json) {
      const response = await fetch(guiUrl + (guiUrl.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now());
      if (!response.ok) throw new Error('Could not read ' + guiUrl + ' (HTTP ' + response.status + ')');
      json = await response.json();
    }

    window.__FORM_QUESTION_STYLE__ = modes[0];
    window.__FORM_DEPLOYMENT_STYLE__ = 'test';
    window.__isPreviewImport = true;
    loadFormData(json);
    // loadFormData builds the questions' editor blocks in stages; the form is
    // generated from those blocks, so give them the moment the preview gives them.
    await new Promise(function (r) { setTimeout(r, 1500); });

    // The style is read when a page is generated, so each mode is its own page.
    const pages = {};
    modes.forEach(function (mode) {
      window.__FORM_QUESTION_STYLE__ = mode;
      pages[mode] = getFormHTML();
    });

    const title = opts.title || json.formName || json.defaultPDFName || 'Form';
    const res = await fetch('/api/publish-live-site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderName: opts.folder || title,
        title: title,
        tabTitle: opts.tabTitle || '',
        pages: pages,
        pdfs: pdfNamesOf(json),
        source: opts.json ? 'saved from the editor' : guiUrl.replace(/^\//, ''),
        projectId: opts.projectId || json.projectId || '',
        gui: opts.json ? json : undefined
      })
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || ('HTTP ' + res.status));
    out.links = {};
    (out.modes || modes).forEach(function (mode) {
      out.links[mode] = location.origin + out.url + '?mode=' + mode;
    });
    Object.keys(out.pages || {}).forEach(function (mode) {
      out.pages[mode] = location.origin + out.pages[mode];
    });
    out.questions = (json.sections || []).reduce(function (n, s) { return n + (s.questions || []).length; }, 0);
    out.sections = (json.sections || []).length;
    return out;
  };
})();
