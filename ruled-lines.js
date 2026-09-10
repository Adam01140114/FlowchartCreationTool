/**
 * Find the lines the form actually printed, and put the text on them.
 *
 * A ruled box on a court form is a run of horizontal rules at the form's own
 * pitch, and nothing in the AcroForm records that pitch: the widget is one
 * rectangle, and the rules underneath it are page content. Everything that
 * tried to infer the pitch from the rectangle got it slightly wrong, and
 * slightly wrong compounds - dividing DV-101 item 5's height by the number of
 * lines that fit gives 15.1pt against a real pitch of 14.0, so the first line
 * cleared its rule, the second touched it, and the fourth was struck through.
 *
 * The rules are in the content stream, so they can simply be read. This walks
 * the page's operators, keeps every horizontal segment, and hands back the ones
 * inside a given box - which is an exact answer for any form, not a rule tuned
 * to this packet.
 */
const PAGE_CACHE = new Map();

/** Concatenate two matrices the way a `cm` operator does. */
function concat(c, m) {
  return [
    c[0] * m[0] + c[2] * m[1], c[1] * m[0] + c[3] * m[1],
    c[0] * m[2] + c[2] * m[3], c[1] * m[2] + c[3] * m[3],
    c[0] * m[4] + c[2] * m[5] + c[4], c[1] * m[4] + c[3] * m[5] + c[5],
  ];
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Every horizontal segment on one page, in PDF user space.
 *
 * Both ways of drawing a rule are counted: a stroked line, and a rectangle
 * filled so thin it reads as one. Short segments are dropped - a box's own
 * border, the tick of a checkbox and the underline of a heading are all
 * horizontal, and none of them is a writing line.
 */
async function horizontalSegments(page, OPS) {
  const ops = await page.getOperatorList();
  const segs = [];
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) { stack.push(ctm.slice()); continue; }
    if (fn === OPS.restore) { ctm = stack.pop() || ctm; continue; }
    if (fn === OPS.transform) { ctm = concat(ctm, args); continue; }
    if (fn !== OPS.constructPath) continue;

    const [fns, coords] = args;
    let k = 0;
    let cx = 0; let cy = 0; let sx = 0; let sy = 0;
    for (const op of fns) {
      if (op === OPS.moveTo) { sx = cx = coords[k++]; sy = cy = coords[k++]; continue; }
      if (op === OPS.lineTo) {
        const nx = coords[k++]; const ny = coords[k++];
        if (Math.abs(ny - cy) < 0.01 && Math.abs(nx - cx) > 20) {
          const p = apply(ctm, cx, cy); const q = apply(ctm, nx, ny);
          segs.push({ y: p[1], x1: Math.min(p[0], q[0]), x2: Math.max(p[0], q[0]) });
        }
        cx = nx; cy = ny; continue;
      }
      if (op === OPS.rectangle) {
        const x = coords[k++]; const y = coords[k++];
        const w = coords[k++]; const h = coords[k++];
        if (Math.abs(h) < 1.2 && Math.abs(w) > 20) {
          const p = apply(ctm, x, y);
          segs.push({ y: p[1], x1: Math.min(p[0], p[0] + w), x2: Math.max(p[0], p[0] + w) });
        }
        continue;
      }
      if (op === OPS.curveTo) { k += 6; continue; }
      if (op === OPS.curveTo2 || op === OPS.curveTo3) { k += 4; continue; }
      if (op === OPS.closePath) { cx = sx; cy = sy; }
    }
  }
  return segs;
}

/**
 * Read every page's rules once, keyed by whatever the caller wants to look them
 * up by later. Harvesting is a second parse of the whole document, so it is
 * done once per fill rather than once per field.
 */
async function harvest(bytes, cacheKey) {
  if (cacheKey && PAGE_CACHE.has(cacheKey)) return PAGE_CACHE.get(cacheKey);
  let pages = [];
  try {
    const path_ = require('path');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      verbosity: 0,
      standardFontDataUrl: path_.join(
        path_.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path_.sep,
    }).promise;
    for (let n = 1; n <= doc.numPages; n++) {
      // eslint-disable-next-line no-await-in-loop
      pages.push(await horizontalSegments(await doc.getPage(n), pdfjs.OPS));
    }
    await doc.destroy();
  } catch (err) {
    // A form whose rules cannot be read is not a failure - the caller falls
    // back to laying the text out from the box, which is what it did before.
    pages = [];
  }
  if (cacheKey) PAGE_CACHE.set(cacheKey, pages);
  return pages;
}

/**
 * The writing lines inside one box, top to bottom.
 *
 * A rule counts when it lies within the box and runs most of its width. The
 * width test is what separates a writing line from the short rule that
 * underlines a label sitting behind the same box, and the vertical margin
 * keeps the box's own bottom border from being taken for a line to write on.
 */
function linesInBox(segments, rect) {
  if (!segments || !segments.length) return [];
  const left = rect.x;
  const right = rect.x + rect.width;
  const span = rect.width;
  const found = segments
    .filter((s) => {
      // Down to the bottom edge, not a point above it. A form often draws a
      // box so that its last writing line is the bottom edge - both DV-105
      // item 5b boxes do - and a one-point margin threw that line away, so
      // the answer stopped on the third of four rules. Nothing here is the
      // widget's own border: a widget draws its border in its appearance
      // stream, and this reads the page's content.
      if (s.y < rect.y - 0.5 || s.y > rect.y + rect.height - 1) return false;
      const overlap = Math.min(right, s.x2) - Math.max(left, s.x1);
      return overlap > span * 0.7;
    })
    .map((s) => s.y)
    .sort((a, b) => b - a)
    // A rule drawn twice - stroked and filled, or once per layer - is one line.
    .filter((y, i, all) => i === 0 || Math.abs(all[i - 1] - y) > 2);
  return evenlySpacedRun(found);
}

/**
 * The evenly spaced run, which is the part that is a place to write.
 *
 * A widget's rectangle is not drawn to the ruled area and often reaches past
 * it, so a horizontal line inside it is not necessarily one of its lines:
 * DV-101 item 3d's box extends over the label rule of item 3e below it and the
 * short rule beside it, and both run the box's full width. Counted as writing
 * lines they gave the box six lines where it has four, and two baselines
 * landed 4.7pt apart - one sentence printed over another.
 *
 * What separates them is regularity. A form rules the lines of a box at one
 * pitch and anything else it draws nearby is at some other distance, so the
 * longest run of consecutive rules sharing the commonest gap is the box.
 */
function evenlySpacedRun(ys) {
  if (ys.length < 3) return ys;
  const gaps = ys.slice(1).map((y, i) => ys[i] - y);
  const sorted = gaps.slice().sort((a, b) => a - b);
  const pitch = sorted[Math.floor(sorted.length / 2)];
  const TOLERANCE = 1.5;

  let best = [0, 1];
  let start = 0;
  for (let i = 0; i < gaps.length; i++) {
    if (Math.abs(gaps[i] - pitch) <= TOLERANCE) {
      if (i + 2 - start > best[1] - best[0]) best = [start, i + 2];
    } else {
      start = i + 1;
    }
  }
  return ys.slice(best[0], best[1]);
}

module.exports = { harvest, linesInBox };
