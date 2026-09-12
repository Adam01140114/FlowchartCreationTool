#!/usr/bin/env node
/**
 * Rebuild a sanitized PDF from its field config.
 *
 * The Judicial Council PDFs are encrypted XFA forms whose AcroForm names are
 * paths like DV-110[0].Page2[0].List6[0].Li1[0].TextField[0]. The sanitizer
 * renames every field to the canonical name in the field config, and that
 * renamed copy is what /edit_pdf fills. So a field config edit is not live
 * until the PDF is rebuilt - this is that step, as a command.
 *
 * Usage: node pipeline-sanitize.js [dv100 dv110 ...] [--check]
 *   --check  rebuild into memory and report what would change, writing nothing
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const {
  PDFDocument, PDFName, PDFNumber, PDFRef, PDFStream, PDFObjectCopier, StandardFonts, rgb,
  decodePDFRawStream, pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject,
} = require('pdf-lib');
const { sanitizePdfFields } = require('./auto-form/pdf-field-sanitizer');
const { packetForms } = require('./packet-forms');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const FORMS = args.filter((a) => !a.startsWith('--'));
const OUT_DIR = 'FormWiz GUI';
const CONFIG_DIR = 'dv-field-configs';

/**
 * Where qpdf is, whether or not somebody put it on PATH.
 *
 * The Windows installer does not add itself to PATH, so `qpdf` is present and
 * unreachable - and the failure reads as "qpdf is not installed", which sends
 * the next person off to install it again.
 */
function qpdfCommand() {
  try {
    execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
    return 'qpdf';
  } catch (e) { /* not on PATH; look where the installers put it */ }

  const roots = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean);
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root).filter((d) => d.toLowerCase().startsWith('qpdf'));
    } catch (e) { continue; }
    for (const dir of entries) {
      const exe = path.join(root, dir, 'bin', 'qpdf.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  throw new Error(
    'qpdf not found. These PDFs ship encrypted and pdf-lib cannot open one.\n'
    + 'Install it (winget install QPDF.QPDF) or put qpdf on PATH.'
  );
}

/** qpdf strips the owner password these forms ship with; pdf-lib cannot. */
function decrypt(source) {
  const tmp = path.join(os.tmpdir(), 'pipeline-' + path.basename(source));
  try {
    execFileSync(qpdfCommand(), ['--decrypt', '--password=', source, tmp], { stdio: 'ignore' });
  } catch (err) {
    // qpdf exits 3 on warnings it also repairs; only a missing output is fatal.
    if (!fs.existsSync(tmp)) throw err;
  }
  return fs.readFileSync(tmp);
}

/**
 * Move a field's box off the form's own printed label.
 *
 * DV-101 item 3e is the case: the widget rectangle for "Describe any injuries"
 * starts eight points ABOVE the label it belongs to, so the label sits on the
 * box's first line. Anything that draws the answer from the top of the box -
 * this pipeline, and Acrobat too - prints it straight through the words
 * "Describe any injuries:". The value is correct, the field name is correct,
 * and the page is unreadable; only looking at the rendered page finds it.
 *
 * The fix belongs here rather than in the filler. A rectangle that covers ink
 * the page has already laid down is wrong in the PDF, and every consumer of
 * the sanitized PDF should see the corrected one. So: find text whose baseline
 * falls inside a multi-line box and whose columns overlap it, and lower the
 * top of the box to just under that text. Never grow a box, and never shrink
 * one past a single line of room.
 */
async function unoverlapLabels(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes), isEvalSupported: false,
    standardFontDataUrl: path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep,
  }).promise;

  const moved = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const texts = (await page.getTextContent()).items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width || 0, h: i.height || 8, str: i.str.trim() }));
    (await page.getAnnotations())
      .filter((a) => a.subtype === 'Widget' && a.fieldName && a.multiLine)
      .forEach((a) => {
        const [x1, y1, x2, y2] = a.rect;
        const left = Math.min(x1, x2), right = Math.max(x1, x2);
        const bottom = Math.min(y1, y2), top = Math.max(y1, y2);
        let lowest = null;
        texts.forEach((t) => {
          if (Math.min(right, t.x + t.w) - Math.max(left, t.x) <= 2) return;
          if (t.y < bottom || t.y > top) return;
          if (lowest === null || t.y < lowest) lowest = t.y;
        });
        if (lowest === null) return;
        // Just under the label's baseline, leaving room for its descenders.
        const newTop = lowest - 3;
        if (newTop >= top || newTop - bottom < 12) return;
        moved.push({ page: n, name: a.fieldName, from: Math.round(top), to: Math.round(newTop) });
      });
  }
  return moved;
}

/** Apply the corrected tops to the rebuilt document. */
async function applyRects(bytes, moved) {
  if (!moved.length) return bytes;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const wanted = new Map(moved.map((m) => [m.name, m.to]));
  doc.getPages().forEach((page) => {
    page.node.Annots() && page.node.Annots().asArray().forEach((ref) => {
      const dict = doc.context.lookup(ref);
      if (!dict || typeof dict.get !== 'function') return;
      const name = dict.get(PDFName.of('T'));
      const key = name && typeof name.decodeText === 'function' ? name.decodeText() : null;
      if (!key || !wanted.has(key)) return;
      const rect = dict.get(PDFName.of('Rect'));
      if (!rect || typeof rect.asArray !== 'function') return;
      const nums = rect.asArray().map((v) => v.asNumber());
      const top = Math.max(nums[1], nums[3]);
      const at = nums[1] === top ? 1 : 3;
      rect.set(at, PDFNumber.of(wanted.get(key)));
    });
  });
  return doc.save();
}

/**
 * Keep the words a push button was printing.
 *
 * The sanitizer deletes every push button, which is right for a control and
 * wrong for the rest. DV-100 page 13 says "You must complete at least three
 * additional forms: Form DV-110, Temporary Restraining Order ...", and DV-110
 * there is a push button whose only job is to draw those six characters and
 * link to the form. Delete it and the sentence goes out to a filer as "Form ,
 * Temporary Restraining Order" - six numbers missing from the list of forms
 * they are being told to file.
 *
 * The text is the button's /MK /CA caption, drawn by its appearance stream in
 * the button's own font, size and colour. The widget goes, so that drawing has
 * to be put onto the page as real ink first.
 *
 * Which buttons are words and which are controls is not a guess. A control
 * carries /MK /BG, a background colour - that is what makes it look like a
 * button rather than like text - and the Print, Save and Clear buttons all
 * have one. The form numbers have none. The notice that says "please press the
 * Clear This Form button" has none either, but it sits in the same strip as
 * those coloured buttons and is about them, so a caption whose box shares a
 * line with a control is dropped along with the controls it describes.
 *
 * Last: a form that already prints the caption in its page content would end
 * up saying it twice, so a caption is only drawn where the page is bare.
 */
async function buttonCaptions(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes), isEvalSupported: false,
    standardFontDataUrl: path.join(__dirname, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep,
  }).promise;

  // pdfjs does not hand over a push button's /MK /CA caption or its /DA - both
  // come back missing - so they are read off the widget itself. Without them
  // DV-140's footer link fell back to its alt text at a guessed 7.7pt in black,
  // against 6pt blue in the button, and landed on "Mandatory Form" below it.
  const raw = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const text = (v) => (v && typeof v.decodeText === 'function' ? v.decodeText() : '');
  const inherited = (dict, key) => {
    for (let d = dict; d; d = d.lookup(PDFName.of('Parent'))) {
      const v = d.lookup(PDFName.of(key));
      if (v) return v;
    }
    return null;
  };

  const wanted = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const printed = (await page.getTextContent()).items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ str: i.str, left: i.transform[4], right: i.transform[4] + (i.width || 0), y: i.transform[5] }));

    const buttons = (await page.getAnnotations())
      .filter((a) => a.subtype === 'Widget' && a.pushButton);
    const controls = buttons.filter((a) => a.backgroundColor);

    buttons.forEach((a) => {
      if (a.backgroundColor) return;                       // a control, not words
      const widget = widgetDict(raw, a.id);
      const mk = widget && widget.lookup(PDFName.of('MK'));
      const ca = mk && typeof mk.lookup === 'function' ? text(mk.lookup(PDFName.of('CA'))) : '';
      const caption = String(ca || a.buttonValue || a.alternativeText || '').trim();
      if (!caption) return;
      const [x1, y1, x2, y2] = a.rect;
      const left = Math.min(x1, x2), right = Math.max(x1, x2);
      const bottom = Math.min(y1, y2), top = Math.max(y1, y2);

      // in the strip of coloured buttons, so it is about them
      const inControlStrip = controls.some((c) => {
        const cb = Math.min(c.rect[1], c.rect[3]), ct = Math.max(c.rect[1], c.rect[3]);
        return Math.min(top, ct) - Math.max(bottom, cb) > 0;
      });
      if (inControlStrip) return;

      // The page already says it. This has to compare the words, not just ask
      // whether something is in the way: a form number sits flush against the
      // comma that follows it, and "," at x148-151 overlaps a box ending at 151.
      // Testing for any overlap dropped CLETS-001, SER-001 and a URL on the
      // strength of one comma and one full stop.
      const under = printed
        .filter((t) => t.y >= bottom - 2 && t.y <= top + 2
          && Math.min(right, t.right) - Math.max(left, t.left) > 2)
        .map((t) => t.str).join('');
      const bare = (s) => s.replace(/\s+/g, '').toLowerCase();
      // A caption can be the alt text a screen reader would say, which spells
      // the punctuation out: DV-108's footer link is captioned "COURTS DOT CA
      // DOT GOV" over a page that prints "www.courts.ca.gov". Compared
      // literally that is not the same string, so it was drawn again - across
      // the title of the form.
      const spoken = (s) => bare(s.replace(/\bdot\b/gi, '.'));
      if (bare(under).indexOf(bare(caption)) >= 0) return;
      if (spoken(under).indexOf(spoken(caption)) >= 0) return;

      const appearance = text(widget && inherited(widget, 'DA')) || a.defaultAppearance || '';
      wanted.push({ page: n, id: a.id, caption, left, right, bottom, top, appearance });
    });
  }
  return wanted;
}

/** The widget pdfjs calls "791R" (or "791R2" for generation 2), from pdf-lib's side. */
function widgetDict(doc, id) {
  const m = /^(\d+)R(\d*)$/.exec(id || '');
  if (!m) return null;
  const dict = doc.context.lookup(PDFRef.of(Number(m[1]), Number(m[2] || 0)));
  return dict && typeof dict.lookup === 'function' ? dict : null;
}

/**
 * The button's normal appearance stream, if it draws any text.
 *
 * That stream is the caption exactly as a viewer showed it: its font, its size,
 * its colour, the underline that marks it as a link, and its baseline inside the
 * box. Drawing the words over again from the box alone has to guess every one of
 * those, and a wrong guess in a six-point footer lands on the line below.
 */
function captionAppearance(source, id) {
  const widget = widgetDict(source, id);
  const ap = widget && widget.lookup(PDFName.of('AP'));
  const ref = ap && typeof ap.get === 'function' ? ap.get(PDFName.of('N')) : null;
  if (!(ref instanceof PDFRef)) return null;
  const form = source.context.lookup(ref);
  if (!(form instanceof PDFStream)) return null;
  let ops = '';
  try { ops = Buffer.from(decodePDFRawStream(form).decode()).toString('latin1'); }
  catch (e) { return null; }
  if (!/T[jJ]/.test(ops)) return null;                      // draws no words
  const box = form.dict.lookup(PDFName.of('BBox'));
  if (!box || typeof box.asArray !== 'function') return null;
  const matrix = form.dict.lookup(PDFName.of('Matrix'));
  return {
    ref,
    bbox: box.asArray().map((v) => v.asNumber()),
    matrix: matrix && typeof matrix.asArray === 'function' ? matrix.asArray().map((v) => v.asNumber()) : [1, 0, 0, 1, 0, 0],
  };
}

/**
 * Put those captions onto the rebuilt document as ordinary page content.
 *
 * Where the button has an appearance stream, that stream is copied in and
 * placed over the button's rectangle the way a viewer places it (PDF 32000
 * 12.5.5: the bounding box, carried through the form's matrix, is fitted to
 * the rectangle). Only a button without one gets its caption typeset afresh.
 */
async function drawCaptions(bytes, captions, source) {
  if (!captions.length) return bytes;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const src = await PDFDocument.load(source, { ignoreEncryption: true });
  const copier = PDFObjectCopier.for(src.context, doc.context);
  const pages = doc.getPages();
  const fonts = new Map();
  const fontFor = async (appearance) => {
    const bold = /bold/i.test(appearance);
    const times = /times/i.test(appearance);
    const key = (times ? 'times' : 'helv') + (bold ? '-bold' : '');
    if (!fonts.has(key)) {
      fonts.set(key, await doc.embedFont(times
        ? (bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman)
        : (bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica)));
    }
    return fonts.get(key);
  };

  for (const c of captions) {
    const page = pages[c.page - 1];
    if (!page) continue;

    const look = captionAppearance(src, c.id);
    if (look) {
      const [b0, b1, b2, b3] = look.bbox;
      const [ma, mb, mc, md, me, mf] = look.matrix;
      const xs = [], ys = [];
      [[b0, b1], [b2, b1], [b0, b3], [b2, b3]].forEach(([x, y]) => {
        xs.push(ma * x + mc * y + me);
        ys.push(mb * x + md * y + mf);
      });
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      if (w > 0 && h > 0) {
        const sx = (c.right - c.left) / w, sy = (c.top - c.bottom) / h;
        const name = page.node.newXObject('Caption', copier.copy(look.ref));
        page.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(sx, 0, 0, sy, c.left - Math.min(...xs) * sx, c.bottom - Math.min(...ys) * sy),
          drawObject(name),
          popGraphicsState(),
        );
        continue;
      }
    }

    const font = await fontFor(c.appearance);

    // The size and colour the button was going to be painted in.
    const sizeMatch = /([\d.]+)\s+Tf/.exec(c.appearance);
    let size = sizeMatch ? Number(sizeMatch[1]) : 0;
    if (!size) size = Math.min(11, (c.top - c.bottom) * 0.8);
    const rgbMatch = /([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/.exec(c.appearance);
    const grayMatch = /(?:^|\s)([\d.]+)\s+g(?:\s|$)/.exec(c.appearance);
    const colour = rgbMatch
      ? rgb(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3]))
      : rgb(Number(grayMatch ? grayMatch[1] : 0), Number(grayMatch ? grayMatch[1] : 0),
            Number(grayMatch ? grayMatch[1] : 0));

    // What the button said, not what a screen reader would say it as.
    //
    // A caption is sometimes alt text with the punctuation spelled out: the
    // link in DV-108's footer is captioned COURTS DOT CA DOT GOV and printed
    // courts.ca.gov. Drawn literally it is both wrong on a court form and half
    // again as wide as the box it belongs in, so it ran across the title.
    const spelled = /\bdot\b/i.test(c.caption) && c.caption === c.caption.toUpperCase();
    const text = spelled
      ? c.caption.replace(/\s*\bdot\b\s*/gi, '.').toLowerCase()
      : c.caption;

    // A push button centres its caption in its box, both ways - and clips it to
    // that box, so a caption that does not fit is shrunk rather than spilled
    // across whatever the form printed next to it.
    let width;
    try { width = font.widthOfTextAtSize(text, size); }
    catch (e) { continue; }                                 // a glyph this font has not got
    const room = c.right - c.left;
    if (width > room && room > 0) {
      size = Math.max(4, size * (room / width));
      width = font.widthOfTextAtSize(text, size);
    }
    const x = Math.max(c.left, c.left + (room - width) / 2);
    const y = c.bottom + ((c.top - c.bottom) - size) / 2 + size * 0.22;
    page.drawText(text, { x, y, size, font, color: colour });
  }
  return doc.save();
}

async function names(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getForm().getFields().map((f) => f.getName());
}

async function main() {
  // With no forms named, rebuild every one the packet declares. The written-out
  // default rebuilt three of five, so a field-config edit to one of the other
  // two was silently not live in the PDF being filled.
  for (const base of (FORMS.length ? FORMS : packetForms())) {
    const source = base + '.pdf';
    const config = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, base + '-field-config.json'), 'utf8'));
    const result = await sanitizePdfFields(decrypt(source), config);
    const moved = await unoverlapLabels(result.bytes);
    const plain = decrypt(source);
    const captions = await buttonCaptions(plain);
    const rebuilt = await drawCaptions(await applyRects(result.bytes, moved), captions, plain);
    const after = result.fieldNames;
    const target = path.join(OUT_DIR, base + '.pdf');
    const before = fs.existsSync(target) ? await names(fs.readFileSync(target)) : [];

    const added = after.filter((n) => !before.includes(n));
    const removed = before.filter((n) => !after.includes(n));
    console.log(base + ': ' + after.length + ' fields'
      + '  (renamed ' + result.renamedCount + ', skipped ' + result.skippedCount + ')'
      + (added.length ? '  +' + added.length : '') + (removed.length ? '  -' + removed.length : ''));
    added.forEach((n) => console.log('    + ' + n));
    removed.forEach((n) => console.log('    - ' + n));
    moved.forEach((m) => console.log('    box lowered off its own label: ' + m.name + ' (page ' + m.page + ', top ' + m.from + ' -> ' + m.to + ')'));
    if (captions.length) console.log('    ' + captions.length + ' button caption(s) drawn as text: '
      + captions.map((c) => c.caption).join(', ').slice(0, 160));
    if (!CHECK) {
      fs.writeFileSync(target, rebuilt);
      console.log('    written to ' + target);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
