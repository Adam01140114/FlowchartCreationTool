/**
 * View Full Project - every form's flowchart on one canvas, side by side, each
 * in its own framed box.
 *
 * The editor holds one flowchart at a time, which is right for editing and
 * wrong for seeing the packet: how big each form is, where the connectors send
 * the filer next, and which charts are nearly the same are only visible with
 * all of them in view at once.
 *
 * It is a separate graph over the whole window, and read-only on purpose. The
 * editor's own graph autosaves on every change and is captured back into the
 * open form's slot, so loading eight charts into it would risk writing the
 * merged picture over one form. This one is built from the project's slots,
 * never written back, and thrown away on close. To change something,
 * double-click that form: the view closes and the editor opens on it.
 */
(function () {
  'use strict';

  const GAP = 2400;       // between one form's frame and the next
  const PAD = 400;        // inside a frame, around its chart
  const CAPTION = 300;    // font size of each frame's caption
  const FILLS = ['#f4f7fb', '#fbf7f0'];   // alternate, so neighbours read as two boxes
  const LABEL_MIN_SCALE = 0.25;  // below this a node's text is a smudge, so none is drawn
  const LABEL_MARGIN = 0.5;      // labels drawn this far past each edge of the window
  const ZOOM_SETTLE_MS = 180;    // a wheel burst is one zoom, redrawn once when it stops

  let overlay = null;
  let view = null;

  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /**
   * A label the editor rendered carries live controls - inputs whose onblur
   * writes to a cell id in the editor's graph. Here that id means nothing, or
   * worse the wrong cell, so the handlers go and the controls are disabled.
   */
  function inert(value) {
    const s = String(value == null ? '' : value);
    if (s.indexOf('<') < 0) return s;
    const t = document.createElement('template');
    t.innerHTML = s;
    t.content.querySelectorAll('*').forEach(function (el) {
      Array.from(el.attributes).forEach(function (a) {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      });
      if (/^(INPUT|BUTTON|SELECT|TEXTAREA)$/.test(el.tagName)) {
        el.setAttribute('disabled', '');
        el.setAttribute('tabindex', '-1');
      }
    });
    return t.innerHTML;
  }

  /** The box a chart occupies: its nodes, and the bends of its edges. */
  function bounds(cells) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const take = (x, y) => {
      if (!isFinite(x) || !isFinite(y)) return;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    };
    cells.forEach(function (c) {
      if (c.vertex && c.geometry) {
        const g = c.geometry;
        take(Number(g.x) || 0, Number(g.y) || 0);
        take((Number(g.x) || 0) + (Number(g.width) || 0), (Number(g.y) || 0) + (Number(g.height) || 0));
      } else if (c.edge && c.edgeGeometry && Array.isArray(c.edgeGeometry.points)) {
        c.edgeGeometry.points.forEach((p) => take(Number(p.x), Number(p.y)));
      }
    });
    if (minX === Infinity) return { minX: 0, minY: 0, width: 600, height: 400 };
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Whether a node's text is worth drawing: big enough to read, and on screen
   * or near it. Measured from the view mxGraph is about to draw, so it is
   * asked again - and answered again - after every zoom and every pan.
   *
   * The canvas size comes from g.overviewViewport, read once per drawing pass,
   * never from the canvas here: this runs for every node, between label
   * writes, and each clientWidth read after a write lays the whole page out
   * again - 1,945 of them made one zoom step take 1.6 seconds.
   */
  function labelReadable(g, cell) {
    const s = g.view.scale;
    if (s < LABEL_MIN_SCALE) return false;
    const geo = cell.geometry;
    if (!geo) return true;
    const t = g.view.translate;
    const size = g.overviewViewport || { w: 0, h: 0 };
    const w = size.w / s, h = size.h / s;
    const x0 = -t.x - w * LABEL_MARGIN, y0 = -t.y - h * LABEL_MARGIN;
    return geo.x + geo.width >= x0 && geo.x <= x0 + w * (1 + 2 * LABEL_MARGIN)
      && geo.y + geo.height >= y0 && geo.y <= y0 + h * (1 + 2 * LABEL_MARGIN);
  }

  function makeGraph(container) {
    mxEvent.disableContextMenu(container);
    const g = new mxGraph(container);
    g.setHtmlLabels(true);
    g.isHtmlLabel = function () { return true; };
    g.setCellsEditable(false);
    g.setCellsMovable(false);
    g.setCellsResizable(false);
    g.setCellsSelectable(false);
    g.setCellsDisconnectable(false);
    g.setConnectable(false);
    g.setDropEnabled(false);
    g.setTooltips(false);
    // A whole packet is tens of thousands of pixels wide. mxGraph will not fit
    // below 0.1 by default, which stopped Fit on the first form's corner.
    g.minFitScale = 0.002;
    g.maxFitScale = 1;
    g.setPanning(true);
    g.panningHandler.useLeftButtonForPanning = true;
    g.panningHandler.ignoreCell = true;
    // The editor's own defaults, so a node looks the same in both places.
    const vs = g.getStylesheet().getDefaultVertexStyle();
    vs[mxConstants.STYLE_VERTICAL_ALIGN] = 'top';
    vs[mxConstants.STYLE_SPACING_TOP] = 10;
    const es = g.getStylesheet().getDefaultEdgeStyle();
    es[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
    es[mxConstants.STYLE_ROUNDED] = true;
    // Only text that can be read is drawn. Every node here is an HTML label,
    // and mxGraph re-measures each one on every zoom step: with all 733 of the
    // packet's drawn, one wheel notch took 4.6 seconds. A frame's caption is
    // always drawn - it is how the boxes are told apart from far out.
    const baseGetLabel = g.getLabel;
    g.getLabel = function (cell) {
      if (cell && cell.vertex && !/^frame_/.test(String(cell.id)) && !labelReadable(this, cell)) return '';
      return baseGetLabel.apply(this, arguments);
    };
    // The size labelReadable measures against, read once at the start of each
    // drawing pass - before any label is written, so the read costs nothing.
    g.overviewViewport = { w: 0, h: 0 };
    const baseValidate = g.view.validate;
    g.view.validate = function () {
      g.overviewViewport = { w: container.clientWidth, h: container.clientHeight };
      return baseValidate.apply(this, arguments);
    };
    return g;
  }

  /**
   * The caption over a frame, sized so it stays inside it. The full title when
   * it fits, the form's name when it does not, and a smaller name for the
   * narrowest frames - DV-109's chart is a sixth the width of its caption.
   */
  function captionFor(full, short, width) {
    const fits = (text, size) => text.length * size * 0.62 <= width * 0.95;
    if (fits(full, CAPTION)) return { text: full, size: CAPTION };
    if (fits(short, CAPTION)) return { text: short, size: CAPTION };
    return { text: short, size: Math.max(40, Math.floor((width * 0.95) / (short.length * 0.62))) };
  }

  /** Lay every form out left to right, each inside a frame. */
  function populate(g, forms) {
    const parent = g.getDefaultParent();
    const frames = [];
    const edges = [];
    let cursor = 0;
    g.getModel().beginUpdate();
    try {
      forms.forEach(function (slot, i) {
        const chart = slot.flowchart || {};
        const cells = chart.cells || [];
        const b = bounds(cells);
        const dx = cursor + PAD - b.minX;
        const dy = PAD - b.minY;
        const pdf = (chart.defaultPdfProperties || {}).pdfName || '';
        const name = slot.name || chart.formName || ('Form ' + (i + 1));
        const frameWidth = b.width + 2 * PAD;
        const cap = captionFor((i + 1) + '.  ' + (pdf || name), (i + 1) + '.  ' + name, frameWidth);

        frames.push(g.insertVertex(parent, 'frame_' + i,
          '<b>' + escapeHtml(cap.text) + '</b>',
          cursor, 0, frameWidth, b.height + 2 * PAD,
          'rounded=1;arcSize=2;html=1;whiteSpace=nowrap;fillColor=' + FILLS[i % FILLS.length]
          + ';strokeColor=#1f3a5f;strokeWidth=16;fontColor=#1f3a5f;fontSize=' + cap.size
          + ';verticalLabelPosition=top;verticalAlign=bottom;align=left;spacingBottom=80;'));

        const made = new Map();
        cells.forEach(function (c) {
          if (!c.vertex || !c.geometry) return;
          const geo = c.geometry;
          made.set(String(c.id), g.insertVertex(parent, 'f' + i + '_' + c.id, inert(c.value),
            (Number(geo.x) || 0) + dx, (Number(geo.y) || 0) + dy,
            Number(geo.width) || 0, Number(geo.height) || 0, c.style || ''));
        });
        cells.forEach(function (c) {
          if (!c.edge) return;
          const src = made.get(String(c.source));
          const tgt = made.get(String(c.target));
          if (!src || !tgt) return;
          const e = g.insertEdge(parent, 'f' + i + '_' + c.id, c.value || '', src, tgt, c.style || '');
          const pts = c.edgeGeometry && Array.isArray(c.edgeGeometry.points) ? c.edgeGeometry.points : [];
          if (pts.length) e.geometry.points = pts.map((p) => new mxPoint(Number(p.x) + dx, Number(p.y) + dy));
          edges.push(e);
        });

        cursor += b.width + 2 * PAD + GAP;
      });
      // Nodes on top, edges under them, the frames under everything.
      g.orderCells(true, edges);
      g.orderCells(true, frames);
    } finally {
      g.getModel().endUpdate();
    }
    return frames;
  }

  /**
   * Show every frame, and its caption, centred. From the frames themselves:
   * mxGraph's fit() measures from label boxes, and with hundreds of HTML labels
   * on a first render that put the whole packet in the top corner.
   */
  function fitAll(g, frames) {
    if (!frames.length) return;
    const first = frames[0].geometry, last = frames[frames.length - 1].geometry;
    const minX = first.x, maxX = last.x + last.width;
    const minY = -CAPTION * 1.8;
    const maxY = Math.max.apply(null, frames.map((f) => f.geometry.y + f.geometry.height));
    const cw = g.container.clientWidth, ch = g.container.clientHeight, m = 40;
    const s = Math.max(0.002, Math.min(1, (cw - 2 * m) / (maxX - minX), (ch - 2 * m) / (maxY - minY)));
    const spareX = (cw - 2 * m) / s - (maxX - minX);
    g.view.scaleAndTranslate(s, m / s - minX + spareX / 2, m / s - minY);
  }

  /**
   * Fit now if there is something to fit into, or as soon as there is.
   *
   * A canvas in a hidden tab measures 0 x 0, and a fit computed from that is
   * the smallest scale allowed - the whole packet a speck in the corner. So,
   * as the rules say for the PDF preview: defer while document.hidden or
   * unsized, and finish on visibilitychange, or on a window resize - the
   * window being the one size here that no drawing can change. Only a pending
   * fit is finished that way, so it never undoes a zoom the operator made.
   */
  let pendingFit = false;
  function fitWhenReady() {
    if (!view) return;
    const c = view.graph.container;
    if (document.hidden || !c.clientWidth || !c.clientHeight) { pendingFit = true; return; }
    pendingFit = false;
    fitAll(view.graph, view.frames);
  }
  function onShown() {
    if (pendingFit) fitWhenReady();
    else if (pendingZoom && !zoomTimer) commitZoom();
  }

  /** Which form a double-click landed on: by the cell, or by where it fell. */
  function formAt(g, frames, cell, evt) {
    const id = cell && String(cell.id || '');
    let m = id && /^frame_(\d+)$/.exec(id);
    if (m) return Number(m[1]);
    m = id && /^f(\d+)_/.exec(id);
    if (m) return Number(m[1]);
    if (!evt) return null;
    const pt = g.getPointForEvent(evt, false);
    const hit = frames.findIndex(function (f) {
      const geo = f.geometry;
      return pt.x >= geo.x && pt.x <= geo.x + geo.width && pt.y >= geo.y - CAPTION * 2 && pt.y <= geo.y + geo.height;
    });
    return hit >= 0 ? hit : null;
  }

  /**
   * Zoom about the pointer, so what is under it stays under it.
   *
   * A wheel burst is one zoom. While it lasts the drawing already on screen is
   * scaled as a picture - a CSS transform, which costs nothing - and mxGraph
   * redraws once, at the final scale, when the wheel has been still for
   * ZOOM_SETTLE_MS. Redrawing on every notch is what froze the view.
   */
  let pendingZoom = null;   // { s, tx, ty } not yet given to mxGraph
  let zoomTimer = 0;
  let lastRedrawMs = 0;
  const svgOf = (g) => g.view.getCanvas().ownerSVGElement;

  function onWheel(e) {
    if (!view) return;
    e.preventDefault();
    const g = view.graph;
    const rect = g.container.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cur = pendingZoom || { s: g.view.scale, tx: g.view.translate.x, ty: g.view.translate.y };
    const next = Math.max(0.005, Math.min(3, cur.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const gx = mx / cur.s - cur.tx, gy = my / cur.s - cur.ty;
    pendingZoom = { s: next, tx: mx / next - gx, ty: my / next - gy };
    // What mxGraph drew at (s0, t0), moved to where (s1, t1) would draw it.
    const s0 = g.view.scale, t0 = g.view.translate;
    const svg = svgOf(g);
    svg.style.transformOrigin = '0 0';
    svg.style.transform = 'translate(' + ((pendingZoom.tx - t0.x) * next) + 'px,'
      + ((pendingZoom.ty - t0.y) * next) + 'px) scale(' + (next / s0) + ')';
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(commitZoom, ZOOM_SETTLE_MS);
  }

  /** Give mxGraph the zoom the wheel settled on, and drop the picture scaling. */
  function commitZoom() {
    clearTimeout(zoomTimer);
    zoomTimer = 0;
    if (!view || !pendingZoom) return;
    // Nothing renders to a tab nobody is looking at: finish on visibilitychange.
    if (document.hidden) return;
    const g = view.graph, p = pendingZoom;
    pendingZoom = null;
    const t = performance.now();
    svgOf(g).style.transform = '';
    g.view.scaleAndTranslate(p.s, p.tx, p.ty);
    lastRedrawMs = Math.round(performance.now() - t);
  }

  /** Forget an unfinished zoom, for when something else sets the view. */
  function dropPendingZoom() {
    clearTimeout(zoomTimer);
    zoomTimer = 0;
    pendingZoom = null;
    if (view) svgOf(view.graph).style.transform = '';
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function open() {
    if (overlay) return;
    if (typeof window.captureCurrentProjectForm === 'function') window.captureCurrentProjectForm();
    const forms = (window.projectForms || []).filter(Boolean);
    if (!forms.length || !forms.some((f) => ((f.flowchart || {}).cells || []).length)) {
      window.alert('There is nothing to show yet - this project has no flowcharts.');
      return;
    }

    overlay = document.createElement('div');
    overlay.id = 'fullProjectView';
    overlay.innerHTML =
      '<div class="fpv-bar">'
      + '<strong class="fpv-title"></strong>'
      + '<span class="fpv-hint">Scroll to zoom &middot; drag to pan &middot; text shows once zoomed in &middot; double-click a form to open it</span>'
      + '<button type="button" data-act="fit">Fit</button>'
      + '<button type="button" data-act="close">Back to Editing</button>'
      + '</div>'
      + '<div class="fpv-canvas"></div>';
    document.body.appendChild(overlay);

    const nameBox = document.getElementById('projectNameInput');
    const projectName = (nameBox && nameBox.value.trim()) || 'Untitled project';
    overlay.querySelector('.fpv-title').textContent =
      projectName + '  -  ' + forms.length + ' form' + (forms.length === 1 ? '' : 's');

    const container = overlay.querySelector('.fpv-canvas');
    const g = makeGraph(container);
    const frames = populate(g, forms);
    view = { graph: g, frames: frames };
    document.addEventListener('visibilitychange', onShown);
    window.addEventListener('resize', onShown);
    fitWhenReady();

    g.addListener(mxEvent.DOUBLE_CLICK, function (sender, evt) {
      const index = formAt(g, frames, evt.getProperty('cell'), evt.getProperty('event'));
      if (index == null) return;
      close();
      if (typeof window.switchToProjectForm === 'function') window.switchToProjectForm(index);
    });
    container.addEventListener('wheel', onWheel, { passive: false });
    // A drag or a double-click reads positions from mxGraph's view, so an
    // unfinished zoom is handed over before either one starts.
    container.addEventListener('mousedown', commitZoom, true);
    document.addEventListener('keydown', onKey);
    overlay.querySelector('[data-act="fit"]').addEventListener('click', function () { dropPendingZoom(); fitAll(g, frames); });
    overlay.querySelector('[data-act="close"]').addEventListener('click', close);
  }

  function close() {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onShown);
    window.removeEventListener('resize', onShown);
    pendingFit = false;
    dropPendingZoom();
    if (view) {
      try { view.graph.destroy(); } catch (e) { /* already gone */ }
    }
    overlay.remove();
    overlay = null;
    view = null;
  }

  window.viewFullProject = function () { overlay ? close() : open(); };
  window.closeFullProjectView = close;
  window.fullProjectViewDebug = function () {
    if (!view) return { open: false };
    const g = view.graph, s = g.view.scale, t = g.view.translate;
    const cells = Object.values(g.getModel().cells);
    return {
      open: true,
      scale: s,
      translate: { x: Math.round(t.x), y: Math.round(t.y) },
      visible: { x: Math.round(-t.x), y: Math.round(-t.y),
        width: Math.round(g.container.clientWidth / s), height: Math.round(g.container.clientHeight / s) },
      readable: cells.filter((c) => c.vertex && !/^frame_/.test(String(c.id)) && labelReadable(g, c)).length,
      labelsDrawn: overlay.querySelectorAll('foreignObject').length,
      zoomPending: !!pendingZoom,
      lastRedrawMs: lastRedrawMs
    };
  };
  // For timing from the console: the overview's graph, while it is open.
  window.fullProjectViewDebug.graph = function () { return view ? view.graph : null; };
})();
