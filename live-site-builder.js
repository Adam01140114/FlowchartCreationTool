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

  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /** Every control's final state after a fill, keyed by id, and what is shown. */
  function captureFill(doc) {
    const form = doc.getElementById('customForm');
    const els = Array.prototype.slice.call(form ? form.querySelectorAll('input, select, textarea') : [])
      .concat(Array.prototype.slice.call(doc.querySelectorAll('[form="customForm"]')));
    const values = {};
    els.forEach(function (el) {
      // Hidden fields are the page's own sums (today's date among them): the
      // page writes them after every fill, so they are not recorded.
      if (!el.id || el.type === 'file' || el.type === 'button' || el.type === 'submit' || el.type === 'hidden') return;
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) values[el.id] = true;
      } else if (String(el.value || '') !== '') {
        values[el.id] = el.value;
      }
    });
    const shown = Array.prototype.slice.call(doc.querySelectorAll('.question-container'))
      .filter(function (c) { return c.id && !c.classList.contains('hidden'); })
      .map(function (c) { return c.id; });
    return { values: values, shown: shown };
  }

  /**
   * The page as the live site serves it, safe to run here. The site's copy has
   * Firebase, Stripe and the cart taken out (payload-html.js); so does this one,
   * because this frame shares the builder's origin and a signed-in Firebase
   * would save the fill's answers over the account's draft. The first script
   * also swaps in a storage of its own - the page saves its answers to
   * localStorage as it fills, and the real one holds the filer's saved draft.
   */
  function forBaking(html) {
    const guard = '<script>(function(){'
      + 'function mem(){var m={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null;},'
      + 'setItem:function(k,v){m[k]=String(v);},removeItem:function(k){delete m[k];},clear:function(){m={};},'
      + 'key:function(i){return Object.keys(m)[i]||null;},get length(){return Object.keys(m).length;}};}'
      + 'try{Object.defineProperty(window,"localStorage",{value:mem(),configurable:true});}catch(e){}'
      + 'try{Object.defineProperty(window,"sessionStorage",{value:mem(),configurable:true});}catch(e){}'
      + 'try{Object.defineProperty(window,"firebase",{get:function(){return undefined;},set:function(){},configurable:false});}catch(e){}'
      + '})();</scr' + 'ipt>';
    // What dev-server.js prepareLiveSitePage and payload-html.js do to the page.
    // The doctype above all: without one the page lays out in quirks mode, the
    // fill finds some fields not laid out, and leaves them empty - the
    // protected animals' entries were recorded blank that way.
    let out = String(html || '')
      .replace(/src="\.\.\/\.\.\/CountyLookup\//g, 'src="CountyLookup/')
      .replace(/<script src="https:\/\/js\.stripe\.com[^>]*><\/script>\s*/gi, '')
      .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs[^>]*><\/script>\s*/gi, '')
      .replace(/<script src="cart\.js"><\/script>\s*/gi, '')
      .replace(/window\.__FORM_DEPLOYMENT_STYLE__\s*=\s*["'][^"']*["']/g, 'window.__FORM_DEPLOYMENT_STYLE__="test"')
      .replace(/id="pdfDevTools" style="display:\s*none"/g, 'id="pdfDevTools" style="display: block"')
      .replace(/id="productionCheckoutTools" style="display:\s*block"/g, 'id="productionCheckoutTools" style="display: none"')
      .replace(/href="\.\.\/\.\.\/[^"]*"/g, 'href="#"')
      .replace(/onclick="location\.href='(?:\.\.\/)+[^']*'[^"]*"/g, 'onclick="return false"');
    const head = /<head(\s[^>]*)?>/i;
    out = head.test(out) ? out.replace(head, function (m) { return m + guard; }) : guard + out;
    return /^<!DOCTYPE/i.test(out) ? out : '<!DOCTYPE html>\n' + out;
  }

  /**
   * Run both debug fills once, here, and record where they end.
   *
   * The page's "Fill maximum path" and "Fill minimum path" buttons worked the
   * path out and typed a thousand answers in one at a time - 3 and 9 seconds.
   * The path itself takes twenty milliseconds; the typing was the cost. So the
   * fills run now, in a frame nobody sees, exactly as the buttons run them, and
   * their finished state goes into the page and the site's GUI JSON. The buttons
   * then put it back in one sweep.
   *
   * Each recording names the form logic it was made from, so a page whose
   * questions have changed since works its path out instead of using it.
   */
  async function bakeFills(html) {
    const doc = forBaking(html);
    const run = async function (opts) {
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      // Off screen, not display:none - the fill asks what is laid out.
      frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:1280px;height:900px;border:0;';
      const loaded = new Promise(function (r) { frame.onload = r; });
      frame.srcdoc = doc;
      document.body.appendChild(frame);
      try {
        await loaded;
        const win = frame.contentWindow;
        for (let i = 0; i < 100 && typeof win.fillMaximumPath !== 'function'; i++) await sleep(100);
        if (typeof win.fillMaximumPath !== 'function') throw new Error('the generated page has no fill');
        // The page finishes autofilling on a timer after it loads.
        await sleep(1500);
        await win.fillMaximumPath(Object.assign({ solve: true }, opts));
        await sleep(600);
        return Object.assign(captureFill(win.document), {
          markers: !!opts.markers,
          logic: typeof win.fwLogicSignature === 'function' ? win.fwLogicSignature() : ''
        });
      } finally {
        frame.remove();
      }
    };
    // Twice each, and a third time when those two disagree. The fill races the
    // page's own deferred work: one build recorded the protected animals'
    // entries blank that every run on its own fills. A recording is what two
    // runs agree on.
    const same = function (a, b) {
      const ka = Object.keys(a.values);
      return ka.length === Object.keys(b.values).length
        && ka.every(function (k) { return String(a.values[k]) === String(b.values[k]); });
    };
    const agreed = async function (opts) {
      const first = await run(opts);
      const second = await run(opts);
      if (same(first, second)) return first;
      const third = await run(opts);
      if (!same(third, first) && !same(third, second)) {
        console.warn('[live site] Three ' + (opts.minimum ? 'minimum' : 'maximum') + ' fills disagreed; recording the last.');
      }
      return third;
    };
    return {
      // The buttons' own settings: both fill with each field's name as marker.
      maximum: await agreed({ markers: true }),
      minimum: await agreed({ markers: true, minimum: true }),
      bakedAt: new Date().toISOString()
    };
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
    let pages = {};
    const generatePages = function () {
      pages = {};
      modes.forEach(function (mode) {
        window.__FORM_QUESTION_STYLE__ = mode;
        pages[mode] = getFormHTML();
      });
    };

    // The finished minimum and maximum paths, recorded once and baked into the
    // GUI JSON and every page (generate.js emits json.fillPaths as
    // window.__BAKED_FILLS__), so the debug buttons put them back instead of
    // working them out. Whatever the JSON carried from an earlier build is
    // recorded again: the questions may have changed since.
    json = Object.assign({}, json);
    delete json.fillPaths;
    window.__BUILDER_FILL_PATHS__ = null;
    generatePages();
    let fills = null;
    if (opts.bakeFills !== false) {
      try {
        fills = await bakeFills(pages.section || pages[modes[0]]);
      } catch (err) {
        console.warn('[live site] The fill paths could not be recorded; the buttons will work them out:', err);
      }
    }
    if (fills) {
      json.fillPaths = fills;
      window.__BUILDER_FILL_PATHS__ = fills;
      generatePages();
      // Read from a file (the skill): that file is the project's GUI JSON, so it
      // keeps the recording too.
      const file = (opts.gui || '/dv-packet-gui.json').split('?')[0].replace(/^\//, '');
      if (!opts.json && opts.saveFillPaths !== false && /^[\w.-]+\.json$/.test(file)) {
        await fetch('/api/dev-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file, data: json })
        });
      }
    }

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
        // Always now: the site's GUI JSON carries the recorded fill paths.
        gui: json
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
    // The same pages by project id - the links that follow the project.
    Object.keys(out.formLinks || {}).forEach(function (mode) {
      out.formLinks[mode] = location.origin + out.formLinks[mode];
    });
    out.fillPaths = fills ? {
      maximum: Object.keys(fills.maximum.values).length,
      minimum: Object.keys(fills.minimum.values).length
    } : null;
    out.questions = (json.sections || []).reduce(function (n, s) { return n + (s.questions || []).length; }, 0);
    out.sections = (json.sections || []).length;
    return out;
  };
})();
