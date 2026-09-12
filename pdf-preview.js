/**
 * The paper, beside the flowchart that fills it.
 *
 * A question in the editor is a rectangle with a name on it, and the thing that
 * name refers to is a box on a court form the author cannot see. Everything
 * about whether the wiring is right - whether this question is the one that
 * prints in item 7, whether the box is a line or a paragraph, whether two
 * questions are pointing at the same box - is knowable only by opening the PDF
 * separately and finding the field by eye.
 *
 * So the PDF is rendered here, and selecting a node lights up the box it fills.
 *
 * It is drawn to a canvas rather than shown in an <iframe> for exactly that
 * reason: a frame is opaque, and the highlight needs the widget rectangles,
 * which means reading the annotations and drawing over them.
 */
(function () {
  'use strict';

  const PDF_DIR = 'FormWiz GUI/';
  const LIB = '/node_modules/pdfjs-dist/build/pdf.mjs';
  const WORKER = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';

  let pdfjs = null;
  let doc = null;            // the loaded PDFDocumentProxy
  let loadedName = '';       // the file it was loaded from
  let pageNumber = 1;
  let viewport = null;       // the viewport the canvas was last drawn at
  let fields = {};           // fieldName -> [{ page, rect }]
  let task = null;           // the render in flight, so pages cannot overtake
  let generation = 0;        // which draw is the current one
  let wanted = [];           // names to light up once the page is drawn
  let deferred = false;      // a draw waiting for the tab to be looked at

  const $ = (id) => document.getElementById(id);
  // Reserved whether or not a scrollbar is showing, so the width never moves.
  const SCROLLBAR = 16;

  /* ------------------------------------------------------------------ */
  /* loading                                                             */
  /* ------------------------------------------------------------------ */

  async function library() {
    if (pdfjs) return pdfjs;
    pdfjs = await import(LIB);
    // The worker is the same ESM build; without this pdf.js falls back to
    // running on the main thread and the editor stutters on every page.
    try { pdfjs.GlobalWorkerOptions.workerSrc = WORKER; } catch (e) { /* main thread */ }
    return pdfjs;
  }

  /** Which PDF this form declares, as the properties panel has it. */
  function declaredFile() {
    const input = $('defaultPdfFileInput');
    let name = String((input && input.value) || '').trim();
    if (!name) return '';
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    return name;
  }

  function say(text, kind) {
    const el = $('pdfPreviewNote');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'pdf-preview-note' + (kind ? ' ' + kind : '');
    el.hidden = !text;
  }

  /**
   * Every text and choice widget on the document, by the name it answers to.
   *
   * One name can appear on several pages - a case number is printed on every
   * one - so this keeps them all and the highlight uses the nearest.
   */
  async function indexFields(pdf) {
    const found = {};
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);            // eslint-disable-line no-await-in-loop
      const annots = await page.getAnnotations();   // eslint-disable-line no-await-in-loop
      annots.forEach((a) => {
        if (a.subtype !== 'Widget' || !a.fieldName || a.pushButton) return;
        (found[a.fieldName] = found[a.fieldName] || []).push({ page: n, rect: a.rect });
      });
    }
    return found;
  }

  async function load(force) {
    const name = declaredFile();
    const stage = $('pdfPreviewStage');
    if (!stage) return;
    if (!name) {
      doc = null; loadedName = ''; fields = {};
      stage.hidden = true;
      say('No PDF file named above.');
      return;
    }
    if (!force && name === loadedName && doc) return;

    say('Loading ' + name + '…');
    try {
      const lib = await library();
      const url = PDF_DIR + name;
      const next = await lib.getDocument({ url: url, isEvalSupported: false, verbosity: 0 }).promise;
      if (doc) { try { await doc.destroy(); } catch (e) { /* already gone */ } }
      doc = next;
      loadedName = name;
      pageNumber = 1;
      fields = await indexFields(doc);
      stage.hidden = false;
      say('');
      await draw();
    } catch (err) {
      doc = null; loadedName = ''; fields = {};
      stage.hidden = true;
      // A form whose PDF is not on this machine is a normal state for a
      // flowchart someone else drew, not an error to shout about.
      say('Could not open ' + PDF_DIR + name, 'warn');
    }
  }

  /* ------------------------------------------------------------------ */
  /* drawing                                                             */
  /* ------------------------------------------------------------------ */

  async function draw() {
    if (!doc) return;
    // Pages can be clicked through, and the panel resized, faster than a page
    // renders. Two renders on one canvas is an error pdf.js raises rather than
    // a torn page - and an async function nobody awaits swallows it, so the
    // page after the collision drew but never finished its own bookkeeping and
    // the counter under it stayed blank. Cancel the old one and number the new.
    if (task) { try { task.cancel(); } catch (e) { /* already done */ } task = null; }
    const mine = ++generation;

    const canvas = $('pdfPreviewCanvas');
    const stage = $('pdfPreviewStage');
    if (!canvas || !stage) return;

    // The counter first. It is bookkeeping, not a result of the drawing, and
    // hanging it off the end of the render meant that any draw which lost a
    // race - or whose document was replaced under it by the next form being
    // loaded - left the page number blank under a page that had drawn fine.
    const label = $('pdfPreviewPage');
    if (label) label.textContent = pageNumber + ' / ' + doc.numPages;

    const page = await doc.getPage(pageNumber);
    if (mine !== generation) return;
    const unscaled = page.getViewport({ scale: 1 });
    // Fit the width the panel actually has.
    //
    // Measured from the panel around the box, never from the box itself. The
    // canvas is what makes the box tall enough to need a scrollbar, and the
    // scrollbar is what makes the box narrower - so sizing to the box meant
    // every draw changed the width the next draw would use, and the preview
    // redrew itself forever without ever finishing one.
    const scale = Math.max(160, fitWidth()) / unscaled.width;
    const ratio = window.devicePixelRatio || 1;
    viewport = page.getViewport({ scale: scale });

    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // Not while nobody is looking.
    //
    // pdf.js drives a canvas render from requestAnimationFrame, and a hidden
    // tab is served no frames - so the render starts, paints part of the page
    // and never finishes or settles its promise. Left to run, that is a task
    // that never clears and a preview stuck half-drawn from the moment the
    // editor is opened in a background tab. The overlay does not need it: the
    // viewport above is what positions a highlight, so a field selected while
    // hidden is already marked when the page arrives.
    if (document.hidden) { deferred = true; paintHighlights(); return; }
    deferred = false;

    task = page.render({ canvasContext: ctx, viewport: viewport });
    try {
      await task.promise;
    } catch (err) {
      // Cancelling is how this supersedes itself, and is not a failure.
      if (mine === generation && !(err && err.name === 'RenderingCancelledException')) {
        say('Could not draw page ' + pageNumber, 'warn');
      }
      return;
    } finally {
      if (mine === generation) task = null;
    }
    if (mine !== generation) return;
    paintHighlights();
  }

  /**
   * The width to draw at: the panel's, less what the box spends on its own
   * frame and its scrollbar gutter. Independent of the canvas, by design.
   */
  function fitWidth() {
    const stage = $('pdfPreviewStage');
    const panel = (stage && stage.parentElement) || $('defaultPdfPropertiesContainer');
    if (!panel) return 260;
    const style = window.getComputedStyle(panel);
    const inner = panel.clientWidth
      - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
    // 2px of border either side, and room for a scrollbar that may appear.
    return Math.floor(inner - 4 - SCROLLBAR);
  }

  function goTo(n) {
    if (!doc) return;
    const next = Math.min(Math.max(1, n), doc.numPages);
    if (next === pageNumber) return;
    pageNumber = next;
    draw();
  }

  /* ------------------------------------------------------------------ */
  /* the highlight                                                       */
  /* ------------------------------------------------------------------ */

  /** Draw a box over each wanted field that is on the page now showing. */
  function paintHighlights() {
    const layer = $('pdfPreviewLayer');
    const canvas = $('pdfPreviewCanvas');
    if (!layer || !canvas || !viewport) return;
    layer.textContent = '';
    layer.style.width = canvas.style.width;
    layer.style.height = canvas.style.height;
    if (!wanted.length) return;

    let drawn = 0;
    wanted.forEach((name) => {
      (fields[name] || []).forEach((hit) => {
        if (hit.page !== pageNumber) return;
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(hit.rect);
        const box = document.createElement('div');
        box.className = 'pdf-preview-hit';
        box.style.left = Math.min(x1, x2) + 'px';
        box.style.top = Math.min(y1, y2) + 'px';
        box.style.width = Math.abs(x2 - x1) + 'px';
        box.style.height = Math.abs(y2 - y1) + 'px';
        box.title = name;
        layer.appendChild(box);
        drawn++;
      });
    });
    if (drawn) {
      const first = layer.firstChild;
      if (first && first.scrollIntoView) {
        first.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
    }
  }

  /**
   * Light up the boxes a selected node fills.
   *
   * A node can name more than one field - a multi-textbox question carries one
   * name per box - and a name can be printed on more than one page, so the view
   * goes to the first page that has any of them and marks every one it finds
   * there.
   */
  function highlight(names) {
    wanted = (names || []).filter(function (n) { return n && fields[n]; });
    const label = $('pdfPreviewFieldLabel');
    if (label) {
      label.textContent = wanted.length
        ? wanted.join(', ')
        : ((names || []).length ? (names[0] + ' — no such field on this PDF') : '');
      label.hidden = !label.textContent;
      label.className = 'pdf-preview-field' + (wanted.length ? '' : ' miss');
    }
    if (!wanted.length) { paintHighlights(); return; }

    const pages = [];
    wanted.forEach((n) => fields[n].forEach((h) => pages.push(h.page)));
    const target = Math.min.apply(null, pages);
    if (target !== pageNumber) { pageNumber = target; draw(); } else { paintHighlights(); }
  }

  /** Every field name a cell could be pointing at. */
  function namesOf(cell) {
    if (!cell) return [];
    const out = [];
    if (cell._nameId) out.push(String(cell._nameId));
    // A multi-textbox question names one field per box, and it is the boxes
    // that exist on the paper - the question itself may name nothing.
    const boxes = cell._textboxes;
    if (Array.isArray(boxes)) {
      boxes.forEach((b) => { if (b && b.nameId) out.push(String(b.nameId)); });
    }
    return out.filter((n, i) => out.indexOf(n) === i);
  }

  /* ------------------------------------------------------------------ */
  /* fullscreen: every page, one under the next                          */
  /* ------------------------------------------------------------------ */

  // Fullscreen used to enlarge the one page being previewed, which is the
  // wrong half of the job: the reason to go fullscreen is to read the form,
  // and a form is read by scrolling through it. So it lays out every page,
  // each at the width of the window, and opens on the page that was showing -
  // with any highlighted box marked wherever it is printed.

  let fullView = null;       // the view, made the first time it is opened
  let fullGeneration = 0;    // which full render is the current one
  let fullTasks = [];        // its page renders still in flight
  let fullDeferred = false;  // a full render waiting for the tab to be looked at
  let fullWidth = 0;         // the page width it was last laid out at

  function isFullOpen() { return !!fullView && !fullView.hidden; }

  /** The page width: from the window, the one size no drawing here changes. */
  function fullTargetWidth() {
    return Math.max(320, Math.min(window.innerWidth - 80, 1200));
  }

  function fullElement() {
    if (fullView) return fullView;
    fullView = document.createElement('div');
    fullView.id = 'pdfFullView';
    fullView.hidden = true;
    fullView.innerHTML = '<div class="pdf-full-bar">'
      + '<strong class="pdf-full-title"></strong>'
      + '<span class="pdf-full-page"></span>'
      + '<button type="button" class="pdf-full-exit">Exit Fullscreen</button>'
      + '</div>'
      + '<div class="pdf-full-pages"></div>';
    document.body.appendChild(fullView);
    fullView.querySelector('.pdf-full-exit').addEventListener('click', closeFull);
    fullView.querySelector('.pdf-full-pages').addEventListener('scroll', showFullPage, { passive: true });
    return fullView;
  }

  function openFull() {
    if (!doc) return;
    const el = fullElement();
    el.hidden = false;
    el.querySelector('.pdf-full-title').textContent = loadedName;
    document.addEventListener('keydown', onFullKey);
    drawFull(true);
    // The browser's own fullscreen where it is allowed. Where it is not - a
    // preview pane, an iframe - the view already covers the whole window.
    if (el.requestFullscreen) {
      try { el.requestFullscreen().catch(function () { /* stays a window-sized view */ }); }
      catch (e) { /* the same */ }
    }
  }

  function closeFull() {
    if (!isFullOpen()) return;
    const reading = currentFullPage();
    fullGeneration++;                 // any page still rendering stops
    fullTasks.forEach(function (t) { try { t.cancel(); } catch (e) { /* done */ } });
    fullTasks = [];
    fullDeferred = false;
    fullView.hidden = true;
    fullView.querySelector('.pdf-full-pages').textContent = '';
    document.removeEventListener('keydown', onFullKey);
    if (document.fullscreenElement === fullView && document.exitFullscreen) {
      document.exitFullscreen().catch(function () { /* already out */ });
    }
    // Back in the panel on the page the reading got to.
    if (doc && reading && reading !== pageNumber) { pageNumber = reading; draw(); }
  }

  function onFullKey(e) { if (e.key === 'Escape') closeFull(); }

  /** The page under the middle of the view - the one being read. */
  function currentFullPage() {
    if (!isFullOpen()) return 0;
    const holder = fullView.querySelector('.pdf-full-pages');
    const mid = holder.scrollTop + holder.clientHeight / 2;
    let best = 0, bestGap = Infinity;
    holder.querySelectorAll('.pdf-full-sheet').forEach(function (sheet) {
      const top = sheet.offsetTop, bottom = top + sheet.offsetHeight;
      const gap = mid < top ? top - mid : (mid > bottom ? mid - bottom : 0);
      if (gap < bestGap) { bestGap = gap; best = Number(sheet.dataset.page); }
    });
    return best;
  }

  function showFullPage() {
    if (!isFullOpen() || !doc) return;
    const n = currentFullPage();
    fullView.querySelector('.pdf-full-page').textContent = n ? 'Page ' + n + ' of ' + doc.numPages : '';
  }

  /** Mark the wanted boxes that are printed on page n. */
  function paintFullHighlights(layer, n, vp) {
    layer.textContent = '';
    wanted.forEach(function (name) {
      (fields[name] || []).forEach(function (hit) {
        if (hit.page !== n) return;
        const [x1, y1, x2, y2] = vp.convertToViewportRectangle(hit.rect);
        const box = document.createElement('div');
        box.className = 'pdf-preview-hit';
        box.style.left = Math.min(x1, x2) + 'px';
        box.style.top = Math.min(y1, y2) + 'px';
        box.style.width = Math.abs(x2 - x1) + 'px';
        box.style.height = Math.abs(y2 - y1) + 'px';
        box.title = name;
        layer.appendChild(box);
      });
    });
  }

  /** Bring page n into view - its highlighted box if it has one, else its top. */
  function scrollFullTo(n) {
    const holder = fullView.querySelector('.pdf-full-pages');
    const sheet = holder.querySelector('.pdf-full-sheet[data-page="' + n + '"]');
    if (!sheet) return;
    const hit = sheet.querySelector('.pdf-preview-hit');
    holder.scrollTop = hit
      ? sheet.offsetTop + hit.offsetTop - holder.clientHeight / 2
      : Math.max(0, sheet.offsetTop - 40);
  }

  async function drawFull(opening) {
    if (!doc || !isFullOpen()) return;
    fullTasks.forEach(function (t) { try { t.cancel(); } catch (e) { /* done */ } });
    fullTasks = [];
    const mine = ++fullGeneration;
    const keep = opening ? pageNumber : (currentFullPage() || pageNumber);
    const holder = fullView.querySelector('.pdf-full-pages');
    const width = fullTargetWidth();
    const ratio = window.devicePixelRatio || 1;
    fullWidth = width;

    // Every sheet at its full size before any is drawn, so the page being
    // read can be scrolled to at once and the rest fill in around it.
    const sheets = [];
    const frag = document.createDocumentFragment();
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);   // eslint-disable-line no-await-in-loop
      if (mine !== fullGeneration) return;
      const vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      const caption = document.createElement('div');
      caption.className = 'pdf-full-caption';
      caption.textContent = 'Page ' + n + ' of ' + doc.numPages;
      const sheet = document.createElement('div');
      sheet.className = 'pdf-full-sheet';
      sheet.dataset.page = String(n);
      sheet.style.width = Math.floor(vp.width) + 'px';
      sheet.style.height = Math.floor(vp.height) + 'px';
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width * ratio);
      canvas.height = Math.floor(vp.height * ratio);
      canvas.style.width = Math.floor(vp.width) + 'px';
      canvas.style.height = Math.floor(vp.height) + 'px';
      const layer = document.createElement('div');
      layer.className = 'pdf-full-layer';
      sheet.append(canvas, layer);
      frag.append(caption, sheet);
      paintFullHighlights(layer, n, vp);
      sheets.push({ n: n, page: page, vp: vp, canvas: canvas });
    }
    holder.textContent = '';
    holder.appendChild(frag);
    scrollFullTo(keep);
    showFullPage();

    // Not while nobody is looking - the same reason as draw(): a hidden tab
    // gets no animation frames, and pdf.js renders on them.
    if (document.hidden) { fullDeferred = true; return; }
    fullDeferred = false;

    // The page being read first, then outward from it.
    sheets.sort(function (a, b) { return Math.abs(a.n - keep) - Math.abs(b.n - keep); });
    for (const s of sheets) {
      if (mine !== fullGeneration) return;
      if (document.hidden) { fullDeferred = true; return; }
      const ctx = s.canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, s.vp.width, s.vp.height);
      const t = s.page.render({ canvasContext: ctx, viewport: s.vp });
      fullTasks.push(t);
      try {
        await t.promise;                    // eslint-disable-line no-await-in-loop
      } catch (err) {
        if (err && err.name === 'RenderingCancelledException') return;
        // One page that will not draw is left blank; the rest still come.
      } finally {
        fullTasks = fullTasks.filter(function (x) { return x !== t; });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* wiring                                                              */
  /* ------------------------------------------------------------------ */

  /**
 * Load once the name has stopped changing.
 *
 * Both callers arrive in bursts. Someone typing a filename produces one call
 * per keystroke, and exporting the project GUI JSON walks every form in it,
 * which sets these inputs five times in a row - and reading thirteen pages of
 * annotations five times to end up back where it started is several seconds
 * spent on a panel nobody is looking at during an export.
 */
  let loadTimer = null;
  function scheduleLoad() {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () { load(false); }, 350);
  }

  function wire() {
    const file = $('defaultPdfFileInput');
    if (file) file.addEventListener('input', scheduleLoad);
    const prev = $('pdfPreviewPrev');
    const next = $('pdfPreviewNext');
    if (prev) prev.addEventListener('click', function () { goTo(pageNumber - 1); });
    if (next) next.addEventListener('click', function () { goTo(pageNumber + 1); });

    // Every page, one under the next, to scroll through - see openFull().
    const full = $('pdfPreviewFullscreen');
    if (full) full.addEventListener('click', openFull);
    // Double-clicking the page is the other way in, and the more natural one:
    // the page is what is being looked at, the button is below it. Nothing
    // listens for a single click here, so this takes nothing away from one.
    const stage = $('pdfPreviewStage');
    if (stage) stage.addEventListener('dblclick', openFull);
    document.addEventListener('fullscreenchange', function () {
      // Esc in the browser's fullscreen leaves it without a keydown ever
      // reaching the page, so leaving fullscreen is what closes the view.
      if (isFullOpen() && document.fullscreenElement !== fullView) closeFull();
    });

    // Draw what was deferred while the tab was in the background.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && deferred) draw();
      if (!document.hidden && fullDeferred) drawFull(false);
    });

    // Redraw when the window is resized, and only then.
    //
    // Not a ResizeObserver on the panel: drawing changes the panel's height,
    // an observer fires on height as well as width, and a redraw that can be
    // caused by its own last redraw is a loop looking for somewhere to happen.
    // It found one, and the editor's main thread went with it. The window is
    // the only thing here whose size is not an effect of the drawing.
    let lastWidth = 0;
    let resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        // Going into the browser's fullscreen is itself a resize.
        if (isFullOpen() && Math.abs(fullTargetWidth() - fullWidth) >= 8) drawFull(false);
        const w = fitWidth();
        if (Math.abs(w - lastWidth) < 8) return;
        lastWidth = w;
        draw();
      }, 200);
    });
  }

  // With no argument this is the burst-tolerant one the editor calls whenever
  // it rewrites the properties panel; pass true to reload the same file now.
  window.pdfPreviewLoad = function (force) {
    if (force === true) return load(true);
    scheduleLoad();
    return Promise.resolve();
  };
  // Its whole state, for when something looks wrong from outside.
  window.pdfPreviewDebug = function () {
    return {
      file: loadedName, pages: doc ? doc.numPages : 0, page: pageNumber,
      generation: generation, rendering: !!task, deferred: deferred,
      indexed: Object.keys(fields).length, highlighting: wanted.slice(),
      full: isFullOpen() ? { page: currentFullPage(), width: fullWidth,
        rendering: fullTasks.length, deferred: fullDeferred } : null
    };
  };
  window.pdfPreviewHighlightCell = function (cell) { highlight(namesOf(cell)); };
  window.pdfPreviewHighlightNames = function (names) { highlight(names); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { wire(); load(false); });
  } else {
    wire(); load(false);
  }
}());
