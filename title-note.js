/**
 * The note every form's flowchart opens with: the form's name, large, above
 * everything else in the chart.
 *
 * A packet is several charts in one editor, each tens of thousands of pixels
 * tall and built from the same few shapes, and zoomed out one looks like the
 * next - DV-140's chart is DV-105's first twenty nodes in the same order. The
 * form's name in large type above the chart is what says which one is open.
 *
 * Defined once, here, so the builder that adds it (pipeline-build-packet.js)
 * and the audit that insists on it (pipeline-audit-flowchart.js) cannot
 * disagree about what it is. The standard is the one drawn by hand on DV-100:
 * "<form> Form", bold, font 50, 1580 x 350, 150 above the first node.
 */
const STANDARD = { x: 0, width: 1580, height: 350, gapAbove: 150, fontSize: 50, bold: true };
const NODE_ID = 'form_title';

const titleText = (formName) => String(formName || '').trim() + ' Form';

const isNotesNode = (c) => /questionType=notesNode/.test(String((c && c.style) || ''));

/** What a notes node says, whether it was saved with _notesText or only as HTML. */
function noteText(c) {
  const raw = c._notesText != null
    ? String(c._notesText)
    : String(c.value || '').replace(/<[^>]*>/g, ' ');
  return raw.replace(/\s+/g, ' ').trim();
}

const isTitleNote = (c, formName) => isNotesNode(c)
  && (new RegExp('nodeId=' + NODE_ID + '(;|$)').test(String(c.style || ''))
    || noteText(c) === titleText(formName));

/**
 * The size the editor draws a notes node's text at. updateNotesNodeCell in
 * script.js scales the chosen size by the node's area and caps it at 200; the
 * same sum here means the chart looks the same before the editor redraws it.
 */
function renderedFontSize(fontSize, width, height) {
  const scale = Math.sqrt((width * height) / (200 * 100));
  return Math.max(8, Math.min(200, Math.round(fontSize * scale)));
}

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);

/** The markup updateNotesNodeCell writes, centred both ways. */
function noteHtml(id, text, px, bold) {
  return '<div class="notes-body" style="font-size:' + px + 'px !important;'
    + 'font-weight:' + (bold ? 700 : 400) + '; line-height:1.35; white-space:pre-wrap; text-align:center;'
    + 'display:flex; align-items:center; justify-content:center;'
    + 'cursor: pointer; user-select: text; width: 100%; height: 100%; box-sizing: border-box; padding: 8px;"'
    + ' ondblclick="window.editNotesNodeText(\'' + id + '\')">' + escapeHtml(text) + '</div>';
}

/**
 * Put the title note on a chart, replacing any it already has - a rebuild, or
 * one drawn by hand, must not leave two. Call it after everything else has been
 * placed, so it sits above all of it.
 */
function addTitleNote(flowchart, formName) {
  const cells = flowchart.cells || (flowchart.cells = []);
  for (let i = cells.length - 1; i >= 0; i--) {
    if (isTitleNote(cells[i], formName)) cells.splice(i, 1);
  }
  const tops = cells.filter((c) => c.vertex && c.geometry).map((c) => Number(c.geometry.y) || 0);
  const top = tops.length ? Math.min(...tops) : 0;
  const id = String(Math.max(0, ...cells.map((c) => parseInt(c.id, 10)).filter((n) => !isNaN(n))) + 1);
  const px = renderedFontSize(STANDARD.fontSize, STANDARD.width, STANDARD.height);
  const text = titleText(formName);
  cells.push({
    id, vertex: true, edge: false,
    value: noteHtml(id, text, px, STANDARD.bold),
    style: 'shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;'
      + 'questionType=notesNode;spacing=12;strokeWidth=3;pointerEvents=1;overflow=fill;'
      + 'fontSize=' + px + ';fillColor=#ffffff;fontColor=#000000;strokeColor=#000000;nodeId=' + NODE_ID + ';',
    geometry: {
      x: STANDARD.x, y: top - STANDARD.gapAbove - STANDARD.height,
      width: STANDARD.width, height: STANDARD.height
    },
    _questionText: text,
    _notesText: text,
    _notesBold: STANDARD.bold,
    _notesFontSize: STANDARD.fontSize,
    _pdfName: '', _pdfFile: '', _pdfPrice: ''
  });
  return id;
}

/** Everything wrong with a chart's title note, as sentences; empty when it is right. */
function titleNoteProblems(flowchart, formName) {
  const vertices = (flowchart.cells || []).filter((c) => c.vertex);
  const notes = vertices.filter((c) => isTitleNote(c, formName));
  if (!notes.length) {
    return ['no title note - a notes node reading "' + titleText(formName) + '" above the chart'];
  }
  const out = [];
  if (notes.length > 1) out.push(notes.length + ' title notes; there should be one');
  const note = notes[0];
  const g = note.geometry || {};
  if (noteText(note) !== titleText(formName)) {
    out.push('title note reads "' + noteText(note) + '", not "' + titleText(formName) + '"');
  }
  if (Number(note._notesFontSize) !== STANDARD.fontSize || !note._notesBold
    || Number(g.width) !== STANDARD.width || Number(g.height) !== STANDARD.height) {
    out.push('title note is not the standard (bold, font ' + STANDARD.fontSize + ', '
      + STANDARD.width + ' x ' + STANDARD.height + '): it is ' + (note._notesBold ? 'bold' : 'not bold')
      + ', font ' + note._notesFontSize + ', ' + g.width + ' x ' + g.height);
  }
  const rest = vertices.filter((c) => c !== note && c.geometry);
  if (rest.length) {
    const top = Math.min(...rest.map((c) => Number(c.geometry.y) || 0));
    if ((Number(g.y) || 0) + (Number(g.height) || 0) > top) out.push('title note is not above every other node');
  }
  return out;
}

module.exports = { STANDARD, titleText, isNotesNode, isTitleNote, addTitleNote, titleNoteProblems };
