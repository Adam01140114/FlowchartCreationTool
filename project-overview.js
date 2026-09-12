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
 *
 * Each frame's caption carries a View PDF button. The paper a chart fills is
 * the other half of reading the chart, and it opens over this view rather
 * than instead of it, so closing it puts the operator back where they were -
 * the same zoom, over the same form.
 */
(function () {
  'use strict';

  const GAP = 2400;       // between one form's frame and the next
  const PAD = 400;        // inside a frame, around its chart
  const CAPTION = 300;    // font size of each frame's caption
  const CAPTION_SPACING = 80;   // between a caption and the top of its frame
  const FILLS = ['#f4f7fb', '#fbf7f0'];   // alternate, so neighbours read as two boxes
  const LABEL_MIN_SCALE = 0.6;   // below this a node's own text is under 10px, so only its title is drawn
  const LABEL_MARGIN = 0.5;      // labels drawn this far past each edge of the window
  const ZOOM_SETTLE_MS = 180;    // a wheel burst is one zoom, redrawn once when it stops
  const TITLE_MAX_PX = 13;       // a title's size on screen when its box has room for all of it
  const TITLE_CUT_PX = 9;        // the size a title too long for its box is cut short at
  const TITLE_MIN_PX = 8;        // below this a title cannot be read, so none is drawn
  const TITLE_LINE = 1.15;       // a title's line height, in font sizes
  const TITLE_WEIGHT = '600';
  const BUTTON_GAP = 12;         // screen pixels between a caption and its View PDF button

  // Where the editor's own PDF preview finds a form's paper - see pdf-preview.js.
  const PDF_DIR = 'FormWiz GUI/';
  const PDF_LIB = '/node_modules/pdfjs-dist/build/pdf.mjs';
  const PDF_WORKER = '/node_modules/pdfjs-dist/build/pdf.worker.mjs';

  let overlay = null;
  let view = null;
  let paper = null;   // the PDF open over the view, if one is

  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fontFamily = () => (window.mxConstants && mxConstants.DEFAULT_FONTFAMILY) || 'Arial,Helvetica';

  /**
   * The view's own styles, put in the page the first time it opens. They live
   * here rather than in index.html so everything about this view is in one file.
   */
  const STYLE = [
    '#fullProjectView .fpv-stage { position: relative; flex: 1; display: flex; min-height: 0; }',
    // Over the canvas, but only its buttons take the pointer: a drag that
    // starts anywhere else still reaches the graph underneath and pans it.
    '#fullProjectView .fpv-buttons { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }',
    '#fullProjectView .fpv-pdf-btn { position: absolute; left: 0; top: 0; pointer-events: auto;'
      + ' width: auto; margin: 0; padding: 4px 10px; border: 1px solid #1f3a5f; border-radius: 4px;'
      + ' background: #fff; color: #1f3a5f; font: 600 12px/16px Arial, Helvetica, sans-serif;'
      + ' white-space: nowrap; cursor: pointer; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25); }',
    '#fullProjectView .fpv-pdf-btn:hover { background: #1f3a5f; color: #fff; }',
    '#fpvPaper { position: fixed; inset: 0; z-index: 10001; display: flex; flex-direction: column; background: #525659; }',
    '#fpvPaper .fpv-paper-bar { display: flex; align-items: center; gap: 12px; padding: 8px 14px;'
      + ' background: #1f3a5f; color: #fff; font-size: 14px; }',
    '#fpvPaper .fpv-paper-title { font-size: 15px; }',
    '#fpvPaper .fpv-paper-note { flex: 1; opacity: 0.8; font-size: 13px; }',
    '#fpvPaper .fpv-paper-bar button { width: auto; margin: 0; padding: 6px 14px; border: 0; border-radius: 4px;'
      + ' background: #fff; color: #1f3a5f; font-weight: 600; cursor: pointer; }',
    '#fpvPaper .fpv-paper-pages { flex: 1; overflow: auto; padding: 4px 16px 40px; outline: none; }',
    '#fpvPaper .fpv-paper-caption { color: #e8eaed; font-size: 12px; text-align: center; margin: 14px 0 6px; }',
    '#fpvPaper .fpv-paper-sheet { margin: 0 auto; max-width: 100%; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); }',
    '#fpvPaper .fpv-paper-sheet canvas { display: block; width: 100%; height: auto; }'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('fullProjectViewStyle')) return;
    const el = document.createElement('style');
    el.id = 'fullProjectViewStyle';
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

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

  /**
   * The words a node is known by when it is too small to show anything else:
   * a question's text, a note's or an alert's message, an option's own label.
   * Read from the slot's cell rather than from what the editor drew, which for
   * an alert is the word ALERT and an id, and for a multi-box question is every
   * box's label after the question.
   */
  function titleOf(c) {
    const style = String(c.style || '');
    const nodeType = (/(?:^|;)nodeType=([^;]*)/.exec(style) || [])[1] || '';
    const questionType = (/(?:^|;)questionType=([^;]*)/.exec(style) || [])[1] || '';
    const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (questionType === 'notesNode' && clean(c._notesText)) return clean(c._notesText);
    if (questionType === 'alertNode' && clean(c._alertText)) return clean(c._alertText);
    if (nodeType === 'question' && clean(c._questionText)) return clean(c._questionText);
    const t = document.createElement('template');
    // A line break or the end of a block is a gap between words on screen,
    // and textContent would run the two words together without this.
    t.innerHTML = String(c.value == null ? '' : c.value)
      .replace(/<br\s*\/?>|<\/(?:div|p|li|h[1-6]|tr)>/gi, ' $&');
    const title = nodeType === 'question' && t.content.querySelector('input.question-title-input');
    if (title && clean(title.getAttribute('value'))) return clean(title.getAttribute('value'));
    return clean(t.content.textContent);
  }

  /*
   * A title is drawn as plain SVG text, and measured on a canvas that is never
   * shown. Asking the drawn text for its width would lay the page out again
   * for every node, which is the cost the culling below exists to avoid; a
   * canvas measures without touching the page. Widths are kept per word, at
   * 100px, and scale with the size - the same few hundred words come back on
   * every zoom.
   */
  let titleCtx = null;
  const titleWidths = new Map();
  function wordWidth(word) {
    let w = titleWidths.get(word);
    if (w === undefined) {
      if (!titleCtx) {
        titleCtx = document.createElement('canvas').getContext('2d');
        titleCtx.font = TITLE_WEIGHT + ' 100px ' + fontFamily();
      }
      w = titleCtx.measureText(word).width;
      titleWidths.set(word, w);
    }
    return w;
  }

  /** Words in lines no wider than width at this size. Stops once past limit lines. */
  function wrapWords(words, width, size, limit) {
    const k = size / 100, space = wordWidth(' ') * k;
    const lines = [];
    let line = '', used = 0;
    for (let i = 0; i < words.length && lines.length <= limit; i++) {
      let word = words[i], w = wordWidth(word) * k;
      // A word wider than the whole box - an identifier, mostly - is broken
      // where it fills a line, rather than left to run out of the box.
      while (w > width && lines.length <= limit) {
        lines.broken = true;
        if (line) { lines.push(line); line = ''; used = 0; }
        if (lines.brokenAt === undefined) lines.brokenAt = lines.length;
        let n = word.length - 1;
        while (n > 1 && wordWidth(word.slice(0, n)) * k > width) n--;
        lines.push(word.slice(0, n));
        word = word.slice(n);
        w = wordWidth(word) * k;
      }
      if (!line) { line = word; used = w; }
      else if (used + space + w <= width) { line += ' ' + word; used += space + w; }
      else { lines.push(line); line = word; used = w; }
    }
    if (line && lines.length <= limit) lines.push(line);
    return lines;
  }

  /**
   * The size and lines a title is drawn in, inside a box w x h pixels on screen.
   *
   * The whole title at the largest size that holds it, from `largest` down to
   * TITLE_MIN_PX. A title no size holds is cut short with an ellipsis - at
   * TITLE_CUT_PX, the smallest size still easy to read, so as much of it shows
   * as can. A box too small for even that gets nothing: a few pixels of text
   * is noise over the shape it sits on.
   */
  function fitTitle(words, w, h, largest) {
    const padX = Math.min(10, Math.max(2, w * 0.06));
    const padY = Math.min(8, Math.max(1, h * 0.06));
    const width = w - 2 * padX, height = h - 2 * padY;
    if (width < TITLE_MIN_PX * 2.5 || height < TITLE_MIN_PX * TITLE_LINE) return null;
    // A size that holds the title only by breaking a word in two - "protectio
    // / n from?" - is kept in reserve while a smaller one is tried: a size
    // smaller still that keeps every word whole reads better, and the eye
    // does not notice the step down.
    //
    // A title cut short is the same: only a cut whose lines keep their words
    // whole is used - the last line is refilled letter by letter below, so a
    // break there does not count. "Ho / w / m…" is noise, and a box that can
    // offer nothing better is left without a title.
    let cut = null, smallCut = null, broken = null;
    for (let size = largest; ; size = Math.max(TITLE_MIN_PX, size * 0.9)) {
      const room = Math.floor(height / (size * TITLE_LINE));
      if (room >= 1) {
        const lines = wrapWords(words, width, size, room);
        if (lines.length <= room) {
          if (!lines.broken) return { size: size, lines: lines };
          if (!broken) broken = { size: size, lines: lines };
        } else if (lines.brokenAt === undefined || lines.brokenAt >= room - 1) {
          const candidate = { size: size, lines: lines.slice(0, room) };
          if (size >= TITLE_CUT_PX) cut = candidate;
          else if (!smallCut) smallCut = candidate;
        }
      }
      if (size <= TITLE_MIN_PX) break;
    }
    // All of it with a word broken still beats part of it.
    if (broken) return broken;
    cut = cut || smallCut;
    if (!cut) return null;
    // The last line takes everything the lines above it left, filled to the
    // edge letter by letter, as a browser's own ellipsis does. Cut at a word
    // boundary instead, a question in a one-line box read "What…" - the one
    // word every question starts with.
    const k = cut.size / 100;
    const full = words.join(' ');
    let pos = 0;
    for (let n = 0; n < cut.lines.length - 1; n++) pos = full.indexOf(cut.lines[n], pos) + cut.lines[n].length;
    const rest = full.slice(pos).trim();
    // Measured straight off the canvas, not through wordWidth: each prefix is
    // asked once, and caching them all would fill the cache with fragments.
    const fits = (n) => titleCtx.measureText(rest.slice(0, n).replace(/\s+$/, '') + '…').width * k <= width;
    let lo = 0, hi = rest.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(mid)) lo = mid; else hi = mid - 1;
    }
    const last = rest.slice(0, lo).replace(/\s+$/, '');
    if (cut.lines.length === 1 && last.length < 3) return null;
    cut.lines[cut.lines.length - 1] = last + '…';
    return cut;
  }

  /**
   * Every node's title, for when the view is too far out for its own label.
   *
   * Plain SVG text in one group, written in one go after mxGraph has drawn.
   * Unlike an HTML label it is never measured by the browser, so a few hundred
   * of them cost milliseconds where the labels cost seconds. Only the nodes on
   * screen, or near it, get one - the same margin the labels are culled by.
   * The size is chosen on screen, so it stays readable as the view zooms out
   * and the nodes shrink under it, until the box is too small to hold any.
   */
  function drawTitles(g) {
    const layer = g.overviewTitles;
    if (!layer) return;
    const s = g.view.scale;
    let out = '';
    if (s < LABEL_MIN_SCALE) {
      const size = g.overviewViewport || { w: 0, h: 0 };
      const mx = size.w * LABEL_MARGIN, my = size.h * LABEL_MARGIN;
      const r = (n) => Math.round(n * 10) / 10;
      (g.overviewTitled || []).forEach(function (cell) {
        const st = g.view.getState(cell);
        if (!st || st.x > size.w + mx || st.y > size.h + my
          || st.x + st.width < -mx || st.y + st.height < -my) return;
        // Never smaller than the editor would draw it: a note set in 200px
        // type is a heading, and stays one.
        const own = (Number(st.style[mxConstants.STYLE_FONTSIZE]) || 0) * s;
        const fit = fitTitle(cell.overviewWords, st.width, st.height, Math.max(TITLE_MAX_PX, own));
        if (!fit) return;
        const lh = fit.size * TITLE_LINE;
        const cx = r(st.x + st.width / 2);
        // The block of lines centred in the box; 0.92 of a size puts the first
        // baseline where a line box of TITLE_LINE would.
        const y = st.y + (st.height - lh * fit.lines.length) / 2 + fit.size * 0.92;
        out += '<text x="' + cx + '" y="' + r(y) + '" font-size="' + r(fit.size) + '" fill="'
          + escapeHtml(st.style[mxConstants.STYLE_FONTCOLOR] || '#1f2937') + '">'
          + fit.lines.map(function (line, n) {
            return '<tspan x="' + cx + '"' + (n ? ' dy="' + r(lh) + '"' : '') + '>' + escapeHtml(line) + '</tspan>';
          }).join('')
          + '</text>';
      });
    }
    if (out || layer.firstChild) layer.innerHTML = out;
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
    // packet's drawn, one wheel notch took 4.6 seconds. Further out than
    // LABEL_MIN_SCALE a node gets its title instead - see drawTitles(). A
    // frame's caption is always drawn - it is how the boxes are told apart
    // from far out.
    const baseGetLabel = g.getLabel;
    g.getLabel = function (cell) {
      if (cell && cell.vertex && !/^frame_/.test(String(cell.id)) && !labelReadable(this, cell)) return '';
      return baseGetLabel.apply(this, arguments);
    };
    // The titles sit inside mxGraph's own canvas, above the shapes, so that
    // the picture-scaling of a wheel burst and the shifting of a drag move
    // them with everything else. They take no pointer: a double-click on a
    // title is a double-click on its node.
    const titles = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    titles.setAttribute('class', 'fpv-titles');
    titles.setAttribute('text-anchor', 'middle');
    titles.setAttribute('font-family', fontFamily());
    titles.setAttribute('font-weight', TITLE_WEIGHT);
    titles.setAttribute('pointer-events', 'none');
    g.view.getCanvas().appendChild(titles);
    g.overviewTitles = titles;
    g.overviewTitled = [];
    // The size labelReadable measures against, read once at the start of each
    // drawing pass - before any label is written, so the read costs nothing.
    g.overviewViewport = { w: 0, h: 0 };
    const baseValidate = g.view.validate;
    g.view.validate = function () {
      g.overviewViewport = { w: container.clientWidth, h: container.clientHeight };
      const result = baseValidate.apply(this, arguments);
      drawTitles(g);
      return result;
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

  /**
   * How wide a caption is, and so where its View PDF button goes. Measured as
   * mxGraph will draw it: bold, in the default face, with the run of spaces
   * after the number collapsed the way the label's nowrap collapses it.
   */
  let captionCtx = null;
  function captionWidth(text, size) {
    if (!captionCtx) captionCtx = document.createElement('canvas').getContext('2d');
    captionCtx.font = 'bold ' + size + 'px ' + fontFamily();
    return captionCtx.measureText(String(text).replace(/\s+/g, ' ')).width;
  }

  /** The PDF a form fills, named as the properties panel names it. */
  function pdfFileOf(chart) {
    let name = String(((chart || {}).defaultPdfProperties || {}).pdfFile || '').trim();
    if (name && !/\.pdf$/i.test(name)) name += '.pdf';
    return name;
  }

  /**
   * Lay every form out left to right, each inside a frame. Returns the frames,
   * and for each the caption it was given and the PDF it fills.
   */
  function populate(g, forms) {
    const parent = g.getDefaultParent();
    const frames = [];
    const captions = [];
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
          + ';verticalLabelPosition=top;verticalAlign=bottom;align=left;spacingBottom=' + CAPTION_SPACING + ';'));
        captions.push({
          title: pdf || name,
          file: pdfFileOf(chart),
          // Both in the graph's units. mxGraph adds its default spacing of 2
          // on every side, and an HTML label's line is 1.2 of its size tall.
          width: 2 + captionWidth(cap.text, cap.size),
          middle: CAPTION_SPACING + 2 + 0.6 * cap.size
        });

        const made = new Map();
        cells.forEach(function (c) {
          if (!c.vertex || !c.geometry) return;
          const geo = c.geometry;
          const v = g.insertVertex(parent, 'f' + i + '_' + c.id, inert(c.value),
            (Number(geo.x) || 0) + dx, (Number(geo.y) || 0) + dy,
            Number(geo.width) || 0, Number(geo.height) || 0, c.style || '');
          const title = titleOf(c);
          if (title) {
            v.overviewWords = title.split(' ');
            g.overviewTitled.push(v);
          }
          made.set(String(c.id), v);
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
    return { frames: frames, captions: captions };
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
    // The canvas may have changed size with the window, and nothing has been
    // drawn since, so reading it here costs nothing. The buttons are checked
    // against it below, and the next drawing pass would read the same.
    if (view) {
      const c = view.graph.container;
      view.graph.overviewViewport = { w: c.clientWidth, h: c.clientHeight };
    }
    if (pendingFit) fitWhenReady();
    else if (pendingZoom && !zoomTimer) commitZoom();
    placeButtons(pendingZoom);
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
    placeButtons(pendingZoom);
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
    if (view) {
      svgOf(view.graph).style.transform = '';
      placeButtons();
    }
  }

  /**
   * Put each View PDF button just after its caption, where the view is now -
   * or, given zoom, where a wheel burst not yet handed to mxGraph shows it.
   *
   * Captions are mxGraph labels and take no pointer, so the buttons are HTML
   * over the canvas and follow it: every zoom and pan mxGraph draws, the
   * picture-scaling of a wheel burst, and the shift of a drag in progress.
   * All of it is worked out from numbers already known - the frames, the
   * view, the canvas size read at the start of the last drawing pass - so
   * moving them never makes the page lay itself out again.
   *
   * A button is hidden when it would be off the canvas, and when it would
   * reach into the next frame: from far enough out the frames are closer
   * together than a button is wide, and a row of overlapping buttons, each
   * over the wrong box, is worse than none.
   */
  function placeButtons(zoom) {
    if (!view || !view.buttons.length) return;
    const g = view.graph;
    const s = zoom ? zoom.s : g.view.scale;
    const tx = zoom ? zoom.tx : g.view.translate.x;
    const ty = zoom ? zoom.ty : g.view.translate.y;
    const dx = g.panDx || 0, dy = g.panDy || 0;   // a drag still in progress
    const size = g.overviewViewport, bw = view.buttonSize.w, bh = view.buttonSize.h;
    view.buttons.forEach(function (b, i) {
      if (!b) return;
      const frame = view.frames[i].geometry, cap = view.captions[i], next = view.frames[i + 1];
      const x = (frame.x + cap.width + tx) * s + dx + BUTTON_GAP;
      const y = (frame.y - cap.middle + ty) * s + dy - bh / 2;
      const room = next ? (next.geometry.x + tx) * s + dx - BUTTON_GAP - x : Infinity;
      const show = room >= bw && x < size.w && x + bw > 0 && y < size.h && y + bh > 0;
      b.style.display = show ? '' : 'none';
      if (show) b.style.transform = 'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px)';
    });
  }

  /** A View PDF button for every form that names its PDF. */
  function makeButtons(layer) {
    view.buttons = view.captions.map(function (cap) {
      if (!cap.file) return null;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fpv-pdf-btn';
      b.textContent = 'View PDF';
      b.title = 'Open ' + cap.file;
      b.addEventListener('click', function () { openPaper(cap); });
      layer.appendChild(b);
      return b;
    });
    // They all carry the same words, so one size serves for all - read once,
    // here, rather than on every move.
    const first = view.buttons.find(Boolean);
    if (first) view.buttonSize = { w: first.offsetWidth || 80, h: first.offsetHeight || 26 };
    // The wheel over a button zooms the view, as it does everywhere else on it.
    layer.addEventListener('wheel', onWheel, { passive: false });
  }

  /* ------------------------------------------------------------------ */
  /* a form's PDF, over the view                                         */
  /* ------------------------------------------------------------------ */

  let pdfjs = null;
  async function pdfLibrary() {
    if (!pdfjs) {
      // The same module the editor's preview imports, so the browser hands
      // back the copy it already has, worker setting and all.
      pdfjs = await import(PDF_LIB);
      try {
        if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
      } catch (e) { /* runs on the main thread instead */ }
    }
    return pdfjs;
  }

  /**
   * Resolves once the tab is being looked at. pdf.js draws a page on
   * animation frames, and a hidden tab is given none, so a page started while
   * hidden would hang half-drawn - the same reason pdf-preview.js defers.
   */
  function whenShown() {
    if (!document.hidden) return Promise.resolve();
    return new Promise(function (resolve) {
      document.addEventListener('visibilitychange', function wait() {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', wait);
        resolve();
      });
    });
  }

  /**
   * A form's PDF over the whole window: every page, one under the next, at
   * the window's width. The view underneath is left exactly as it was, so
   * closing this - Close, or Escape - is going straight back to it.
   *
   * Drawn with pdf.js onto canvases, as the editor's own preview draws it,
   * rather than handed to the browser's viewer in a frame: a key pressed in
   * a frame never reaches this page, and Escape has to.
   */
  function openPaper(cap) {
    closePaper();
    const el = document.createElement('div');
    el.id = 'fpvPaper';
    el.innerHTML = '<div class="fpv-paper-bar">'
      + '<strong class="fpv-paper-title"></strong>'
      + '<span class="fpv-paper-note"></span>'
      + '<button type="button" data-act="close-pdf">Close</button>'
      + '</div>'
      + '<div class="fpv-paper-pages" tabindex="-1"></div>';
    el.querySelector('.fpv-paper-title').textContent = cap.title + '  -  ' + cap.file;
    el.querySelector('[data-act="close-pdf"]').addEventListener('click', closePaper);
    document.body.appendChild(el);
    const me = { el: el, file: cap.file, doc: null, loading: null, tasks: [], drawn: 0 };
    paper = me;
    // So the arrow keys and Page Down scroll the pages straight away.
    el.querySelector('.fpv-paper-pages').focus({ preventScroll: true });
    showPaper(me);
  }

  async function showPaper(me) {
    const note = me.el.querySelector('.fpv-paper-note');
    const holder = me.el.querySelector('.fpv-paper-pages');
    const live = () => paper === me;
    note.textContent = 'Loading ' + me.file + '…';
    try {
      const lib = await pdfLibrary();
      if (!live()) return;
      me.loading = lib.getDocument({ url: PDF_DIR + me.file, isEvalSupported: false, verbosity: 0 });
      const doc = await me.loading.promise;
      me.loading = null;
      if (!live()) { doc.destroy(); return; }
      me.doc = doc;
    } catch (err) {
      // A PDF that is not on this machine is a normal state for a project
      // someone else drew, so it is said plainly, not thrown.
      if (live()) note.textContent = 'Could not open ' + PDF_DIR + me.file;
      return;
    }
    const doc = me.doc;
    note.textContent = doc.numPages + ' page' + (doc.numPages === 1 ? '' : 's')
      + '  ·  Close or Escape goes back to the project';
    // From the window, the one size here nothing drawn can change; a window
    // made narrower later shrinks the pages to fit rather than drawing again.
    const width = Math.max(320, Math.min(window.innerWidth - 80, 1100));
    const ratio = window.devicePixelRatio || 1;
    try {
      // Every sheet at its full size first, so the scrollbar is right from
      // the start and the pages fill in where they will stay.
      const sheets = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);   // eslint-disable-line no-await-in-loop
        if (!live()) return;
        const vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
        const caption = document.createElement('div');
        caption.className = 'fpv-paper-caption';
        caption.textContent = 'Page ' + n + ' of ' + doc.numPages;
        const sheet = document.createElement('div');
        sheet.className = 'fpv-paper-sheet';
        sheet.style.width = Math.floor(vp.width) + 'px';
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width * ratio);
        canvas.height = Math.floor(vp.height * ratio);
        sheet.appendChild(canvas);
        holder.append(caption, sheet);
        sheets.push({ page: page, vp: vp, canvas: canvas });
      }
      for (const sheet of sheets) {
        await whenShown();                   // eslint-disable-line no-await-in-loop
        if (!live()) return;
        const ctx = sheet.canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sheet.vp.width, sheet.vp.height);
        const task = sheet.page.render({ canvasContext: ctx, viewport: sheet.vp });
        me.tasks.push(task);
        try {
          await task.promise;                // eslint-disable-line no-await-in-loop
          me.drawn++;
        } catch (err) {
          // Cancelled is how closing stops it. Any other failure leaves that
          // one page blank and the rest still come.
          if (err && err.name === 'RenderingCancelledException') return;
        } finally {
          me.tasks = me.tasks.filter((t) => t !== task);
        }
      }
    } catch (err) {
      if (live()) note.textContent = 'Could not draw ' + me.file;
    }
  }

  /** Take the PDF away, and with it everything it was still loading or drawing. */
  function closePaper() {
    if (!paper) return;
    const me = paper;
    paper = null;
    me.tasks.forEach(function (t) { try { t.cancel(); } catch (e) { /* already done */ } });
    if (me.loading) { try { me.loading.destroy(); } catch (e) { /* already gone */ } }
    if (me.doc) { try { me.doc.destroy(); } catch (e) { /* already gone */ } }
    me.el.remove();
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    // The PDF sits over the view, and Escape takes away only what is on top.
    if (paper) closePaper();
    else close();
  }

  function open() {
    if (overlay) return;
    if (typeof window.captureCurrentProjectForm === 'function') window.captureCurrentProjectForm();
    const forms = (window.projectForms || []).filter(Boolean);
    if (!forms.length || !forms.some((f) => ((f.flowchart || {}).cells || []).length)) {
      window.alert('There is nothing to show yet - this project has no flowcharts.');
      return;
    }

    injectStyle();
    overlay = document.createElement('div');
    overlay.id = 'fullProjectView';
    overlay.innerHTML =
      '<div class="fpv-bar">'
      + '<strong class="fpv-title"></strong>'
      + '<span class="fpv-hint">Scroll to zoom &middot; drag to pan &middot; double-click a form to open it'
      + ' &middot; View PDF shows the form it fills</span>'
      + '<button type="button" data-act="fit">Fit</button>'
      + '<button type="button" data-act="close">Back to Editing</button>'
      + '</div>'
      // The buttons are a sibling of the canvas, not inside it: mxGraph moves
      // everything in its container but the drawing itself while a drag lasts.
      + '<div class="fpv-stage"><div class="fpv-canvas"></div><div class="fpv-buttons"></div></div>';
    document.body.appendChild(overlay);

    const nameBox = document.getElementById('projectNameInput');
    const projectName = (nameBox && nameBox.value.trim()) || 'Untitled project';
    overlay.querySelector('.fpv-title').textContent =
      projectName + '  -  ' + forms.length + ' form' + (forms.length === 1 ? '' : 's');

    const container = overlay.querySelector('.fpv-canvas');
    const g = makeGraph(container);
    const laid = populate(g, forms);
    const frames = laid.frames;
    view = { graph: g, frames: frames, captions: laid.captions, buttons: [], buttonSize: { w: 0, h: 0 } };
    makeButtons(overlay.querySelector('.fpv-buttons'));
    // Every way the view moves: a zoom or a pan given to mxGraph, and a drag
    // in progress, which shifts the drawing without redrawing it.
    const follow = function () { placeButtons(); };
    g.view.addListener(mxEvent.SCALE, follow);
    g.view.addListener(mxEvent.TRANSLATE, follow);
    g.view.addListener(mxEvent.SCALE_AND_TRANSLATE, follow);
    g.addListener(mxEvent.PAN, follow);
    document.addEventListener('visibilitychange', onShown);
    window.addEventListener('resize', onShown);
    fitWhenReady();
    placeButtons();

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
    closePaper();
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
      titlesDrawn: g.overviewTitles ? g.overviewTitles.childElementCount : 0,
      buttonsShown: view.buttons.filter((b) => b && b.style.display !== 'none').length,
      pdf: paper ? { file: paper.file, pages: paper.doc ? paper.doc.numPages : 0, drawn: paper.drawn } : null,
      zoomPending: !!pendingZoom,
      lastRedrawMs: lastRedrawMs
    };
  };
  // For timing from the console: the overview's graph, while it is open.
  window.fullProjectViewDebug.graph = function () { return view ? view.graph : null; };
})();
