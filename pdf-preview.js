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
    // Fit the width the panel actually has, and the height the screen has when
    // it is filling the screen.
    //
    // Measured from the panel around the box, never from the box itself. The
    // canvas is what makes the box tall enough to need a scrollbar, and the
    // scrollbar is what makes the box narrower - so sizing to the box meant
    // every draw changed the width the next draw would use, and the preview
    // redrew itself forever without ever finishing one.
    const full = document.fullscreenElement === stage;
    const width = full
      ? Math.max(160, stage.clientWidth || 260)
      : Math.max(160, fitWidth());
    let scale = width / unscaled.width;
    if (full) {
      scale = Math.min(scale, (stage.clientHeight - 8) / unscaled.height);
    }
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

    const full = $('pdfPreviewFullscreen');
    const stage = $('pdfPreviewStage');
    if (full && stage) {
      full.addEventListener('click', function () {
        if (document.fullscreenElement === stage) { document.exitFullscreen(); return; }
        if (stage.requestFullscreen) stage.requestFullscreen();
      });
      document.addEventListener('fullscreenchange', function () {
        const on = document.fullscreenElement === stage;
        stage.classList.toggle('full', on);
        full.textContent = on ? 'Exit Fullscreen' : 'View Fullscreen';
        // The page is drawn at a fixed pixel size, so it has to be redrawn for
        // the size it is now being shown at or it is a small sharp page in the
        // middle of a large black screen.
        draw();
      });
    }

    // Draw what was deferred while the tab was in the background.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && deferred) draw();
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
      indexed: Object.keys(fields).length, highlighting: wanted.slice()
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
