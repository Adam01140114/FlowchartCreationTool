/**
 * How a continuation page is laid out on MC-025 - one copy, shared by the
 * server that draws the pages and the form that counts them.
 *
 * Rule the-packet-uses-mc025-for-more-space: anything that needs more room goes
 * on MC-025. The pages are drawn by FormWiz GUI/attachment-page.js, but the
 * interview has to know how many there will be before any is drawn: DV-100 item
 * 32 and DV-160 item 10 ask for the number of pages attached, and the filer
 * signs them. Counting "one page per list" was wrong the moment a list ran onto
 * a second sheet, and a count worked out separately would drift from the
 * drawing the first time either changed. So the lines and the page breaks are
 * worked out here, once: attachment-page.js requires this file, and generate.js
 * embeds its source in every page it builds (gui.html loads it as a script).
 *
 * Widths are Helvetica's, as pdf-lib's standard font reports them, with no
 * kerning. pdf-lib kerns when it measures ("AV To" is 2.4pt narrower than its
 * letters added up), so a line measured here is never narrower than the one
 * printed - it can only fit with room to spare - and the browser, which has no
 * pdf-lib, gets exactly the same answer from the same table.
 *
 * No backslashes anywhere in this file: its source is written into the page as
 * a string, the way the rest of the runtime is (Hand Off/syntax.txt).
 */
function continuationLayoutFactory() {
  // Advance widths per 1000 em: printable ASCII from the space (32) to "~" (126).
  var ASCII = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667,
    667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667,
    611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556,
    278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722,
    500, 500, 500, 334, 260, 334, 584];
  // The rest of what the font can print (WinAnsi): accented letters, curly
  // quotes, dashes, the bullet and the ellipsis a filer's phone puts in.
  var EXTRA = {
    160: 278, 161: 333, 162: 556, 163: 556, 164: 556, 165: 556, 166: 260, 167: 556, 168: 333,
    169: 737, 170: 370, 171: 556, 172: 584, 173: 333, 174: 737, 175: 333, 176: 400, 177: 584,
    178: 333, 179: 333, 180: 333, 181: 556, 182: 537, 183: 278, 184: 333, 185: 333, 186: 365,
    187: 556, 188: 834, 189: 834, 190: 834, 191: 611, 192: 667, 193: 667, 194: 667, 195: 667,
    196: 667, 197: 667, 198: 1000, 199: 722, 200: 667, 201: 667, 202: 667, 203: 667, 204: 278,
    205: 278, 206: 278, 207: 278, 208: 722, 209: 722, 210: 778, 211: 778, 212: 778, 213: 778,
    214: 778, 215: 584, 216: 778, 217: 722, 218: 722, 219: 722, 220: 722, 221: 667, 222: 667,
    223: 611, 224: 556, 225: 556, 226: 556, 227: 556, 228: 556, 229: 556, 230: 889, 231: 500,
    232: 556, 233: 556, 234: 556, 235: 556, 236: 278, 237: 278, 238: 278, 239: 278, 240: 556,
    241: 556, 242: 556, 243: 556, 244: 556, 245: 556, 246: 556, 247: 584, 248: 611, 249: 556,
    250: 556, 251: 556, 252: 556, 253: 500, 254: 556, 255: 500, 338: 1000, 339: 944, 352: 667,
    353: 500, 376: 500, 381: 611, 382: 500, 402: 556, 710: 333, 732: 333, 8211: 556, 8212: 1000,
    8216: 222, 8217: 222, 8218: 222, 8220: 333, 8221: 333, 8222: 333, 8224: 556, 8225: 556,
    8226: 350, 8230: 1000, 8240: 1000, 8249: 333, 8250: 333, 8364: 556, 8482: 1000
  };
  // MC-025's body box (FillText4, mc025_text in the field config), in points.
  // attachment-page.js checks the sanitized blank still has this box and says
  // so if the form is ever replaced with one laid out differently.
  var BODY = { width: 538.8429, height: 598.3468 };
  var BODY_SIZE = 10;
  var PAD = 4;
  // pdf-lib sets a multiline box's lines a little over 11pt apart at 10pt; a
  // page counted at less put its last line under the footer, cut through. So
  // each line is allowed 12pt, and a page never holds more than it shows.
  var LINE_HEIGHT = 12;
  var QUESTION_MARK = 63;

  function known(code) {
    return (code >= 32 && code <= 126) || Object.prototype.hasOwnProperty.call(EXTRA, code);
  }
  function charWidth(code) {
    if (code >= 32 && code <= 126) return ASCII[code - 32];
    if (Object.prototype.hasOwnProperty.call(EXTRA, code)) return EXTRA[code];
    return ASCII[QUESTION_MARK - 32];
  }
  function widthOf(text, size) {
    var s = String(text == null ? '' : text);
    var total = 0;
    for (var i = 0; i < s.length; i++) total += charWidth(s.charCodeAt(i));
    return total * size / 1000;
  }

  /**
   * Only what the font can print: a run of spaces, tabs and the like is one
   * space, a line break stays, and anything else becomes "?" - an emoji in a
   * court filing would otherwise stop the page being drawn at all.
   */
  function drawable(text) {
    var s = String(text == null ? '' : text);
    var out = '';
    var gap = false;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code === 10) { out += String.fromCharCode(10); gap = false; continue; }
      if (code === 13 && s.charCodeAt(i + 1) === 10) continue;
      if (code === 32 || code === 9 || code === 11 || code === 12 || code === 13) {
        if (!gap) out += ' ';
        gap = true;
        continue;
      }
      gap = false;
      // An emoji is two code units; it becomes one "?", not two.
      if (code >= 55296 && code <= 56319) {
        var low = s.charCodeAt(i + 1);
        if (low >= 56320 && low <= 57343) i++;
      }
      out += known(code) ? s.charAt(i) : '?';
    }
    return out;
  }

  /** a, b, ... z, then aa, ab ... - the lettering the form's rows use. */
  function letterFor(n) {
    var s = '';
    var k = n;
    while (k > 0) {
      var r = (k - 1) % 26;
      s = String.fromCharCode(97 + r) + s;
      k = Math.floor((k - 1) / 26);
    }
    return s;
  }

  function trimEnd(text, chars) {
    var s = String(text || '');
    while (s.length && chars.indexOf(s.charAt(s.length - 1)) !== -1) s = s.slice(0, -1);
    return s;
  }

  /** Break one paragraph into lines no wider than width; later lines indented. */
  function wrap(text, size, width, indent) {
    var pad = indent || '';
    var words = String(text || '').split(' ');
    var lines = [];
    var line = '';
    words.forEach(function (word) {
      var next = line ? line + ' ' + word : word;
      if (widthOf(next, size) <= width || !line.trim()) {
        line = next;
      } else {
        lines.push(line);
        line = pad + word;
      }
      // A single word wider than the box is broken where it has to be.
      while (widthOf(line, size) > width && line.length > pad.length + 1) {
        var cut = line.length - 1;
        while (cut > pad.length + 1 && widthOf(line.slice(0, cut), size) > width) cut--;
        lines.push(line.slice(0, cut));
        line = pad + line.slice(cut);
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /**
   * The page's own name for what it continues, for MC-025's small
   * "ATTACHMENT (Number)" box - "DV-105, Item 3" for the page headed "DV-105,
   * Children" - when the declaration does not give one. The full heading opens
   * the body, as each form asks.
   */
  function defaultAttachmentNumber(spec) {
    var heading = String(spec.heading || spec.name || '');
    var cut = heading.indexOf(',');
    var form = (cut > 0 ? heading.slice(0, cut) : heading.split(' ')[0]).trim();
    var item = String(spec.item || '').trim();
    var looksLikeForm = form.indexOf('-') > 0 && form.length <= 14;
    if (!looksLikeForm) return item ? 'Item ' + item : '';
    return form + (item ? ', Item ' + item : '');
  }

  /** The lines of a page's body, before they are split into sheets. */
  function bodyLines(spec, width) {
    var w = width || (BODY.width - PAD * 2);
    var heading = drawable(spec.heading || spec.name || 'Attachment');
    var continues = [spec.item ? 'Item ' + spec.item : '', spec.itemTitle || '']
      .filter(Boolean).join(' - ');
    var lines = wrap(heading, BODY_SIZE, w);
    if (continues) lines = lines.concat(wrap(drawable('Continues ' + continues + '.'), BODY_SIZE, w));
    lines.push('');

    if (typeof spec.text === 'string' && spec.text.trim()) {
      drawable(spec.text).split(String.fromCharCode(10)).forEach(function (para) {
        lines = lines.concat(para.trim() ? wrap(para.trim(), BODY_SIZE, w) : ['']);
      });
    } else {
      var entries = Array.isArray(spec.entries) ? spec.entries : [];
      entries.forEach(function (entry) {
        var cells = (entry.values || []).map(function (v) {
          return drawable(trimEnd(v.label || '', ': ')) + ': ' + drawable(v.value || '');
        });
        var row = letterFor(entry.number) + '.  ' + cells.join('     ');
        lines = lines.concat(wrap(row, BODY_SIZE, w, '      '));
        lines.push('');
      });
      if (!entries.length) lines.push('(No further entries.)');
    }
    // A blank line closing the last entry is not worth a sheet of its own.
    while (lines.length > 1 && !String(lines[lines.length - 1]).trim()) lines.pop();
    return lines;
  }

  /** How many lines one MC-025 body holds. */
  function linesPerPage() {
    return Math.max(3, Math.floor((BODY.height - PAD * 2) / LINE_HEIGHT) - 1);
  }

  /**
   * The body split into MC-025 sheets. Every sheet after the first opens with
   * the heading and "(continued)", so a page that comes loose from the stack
   * still says what it belongs to.
   */
  function paginate(spec) {
    var per = linesPerPage();
    var lines = bodyLines(spec);
    var heading = lines[0];
    var pages = [lines.slice(0, per)];
    var rest = lines.slice(per);
    while (rest.length) {
      var take = rest.slice(0, per - 2);
      rest = rest.slice(per - 2);
      while (take.length && !String(take[0]).trim()) take.shift();
      if (!take.length) continue;
      pages.push([heading + ' (continued)', ''].concat(take));
    }
    return pages;
  }

  /**
   * Where the first box stops and the continuation takes over.
   *
   * One function because there are three readers and they must not disagree:
   * the live form works out the continuation as it is typed, the payload trims
   * the box's own answer on the way out, and pipeline-fill.js does both from a
   * captured answer set. A split computed twice would drop a word between the
   * two pages or print it on both.
   *
   * The cut lands on a word boundary where there is one near enough, so the
   * first box ends on a whole word with room visibly to spare - which is what a
   * clean stop looks like, and what tells a reader it was not clipped.
   */
  function overflowSplit(value, cap, tailCap) {
    var text = String(value == null ? '' : value);
    if (!cap || text.length <= cap) return { head: text, tail: '', beyond: false };
    var at = cap;
    var space = text.slice(0, cap).lastIndexOf(' ');
    if (space > cap * 0.6) at = space;
    var head = text.slice(0, at);
    var tail = text.slice(at);
    while (tail.charAt(0) === ' ') tail = tail.slice(1);
    // Past what a second box holds there is nothing else to print, and the
    // form should say so rather than quietly keeping it. A continuation on
    // MC-025 has no such limit: it takes another sheet.
    var beyond = false;
    if (tailCap && tail.length > tailCap) {
      var cut = tail.slice(0, tailCap);
      var brk = cut.lastIndexOf(' ');
      if (brk > tailCap * 0.6) cut = cut.slice(0, brk);
      tail = cut;
      beyond = true;
    }
    return { head: head, tail: tail, beyond: beyond };
  }

  return {
    BODY: BODY, BODY_SIZE: BODY_SIZE, PAD: PAD, LINE_HEIGHT: LINE_HEIGHT,
    widthOf: widthOf, drawable: drawable, letterFor: letterFor, wrap: wrap,
    defaultAttachmentNumber: defaultAttachmentNumber, bodyLines: bodyLines,
    linesPerPage: linesPerPage, paginate: paginate, overflowSplit: overflowSplit,
    pageCount: function (spec) { return paginate(spec).length; }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = continuationLayoutFactory();
  module.exports.source = continuationLayoutFactory.toString();
} else if (typeof window !== 'undefined') {
  window.ContinuationLayout = continuationLayoutFactory();
  window.ContinuationLayout.source = continuationLayoutFactory.toString();
}
