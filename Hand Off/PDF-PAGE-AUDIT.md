# The page-image audit

**This is the last check before a packet ships, and it is not optional.**

Every other check in this repo reads *data*: the DOM, the submitted payload,
the PDF's field dictionary. All three can pass on a form that prints wrong. The
value lives in the field dictionary; the ink comes from the appearance stream;
and the two are only in step if something built the appearance correctly. The
page image is the only artifact that shows what a judge will actually read.

Everything in the "What only the images catch" list below was found this way,
after a green audit and a field-by-field check that reported zero problems.

---

## Running it

The dev server must be running (`npm start`), and the form must be filled —
debug menu (**Ctrl+Shift**) → **Fill maximum path**.

```bash
# 1. Fill the PDFs from the filled form and keep the bytes.
#    In the form's console, capture what /edit_pdf returns:
```

```js
window.__cap = {};
const realFetch = window.fetch.bind(window);
window.fetch = function (u, o) {
  const p = realFetch(u, o);
  if (String(u).indexOf('/edit_pdf') !== -1) {
    p.then(r => r.clone().arrayBuffer().then(b => {
      const bytes = new Uint8Array(b);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      window.__cap[String(u).match(/pdf=([^&]+)/)[1]] = btoa(s);
    }));
  }
  return p;
};
for (const name of ['dv100.pdf', 'dv109.pdf', 'dv110.pdf']) await editAndDownloadPDF(name);
```

Save each one to disk (`/api/dev-save` takes JSON, so send the base64 and decode
it with Node), then:

```bash
node audit-pdf-pages.js ./audit 1.6 dv100-filled.pdf dv109-filled.pdf dv110-filled.pdf
```

**Then read every page.** Not the console output — the PNGs. A 13-page DV-100,
a 3-page DV-109 and a 9-page DV-110 is 25 images, and the defects found so far
were each on exactly one of them.

`audit-pdf-pages.js` runs in Node rather than the browser on purpose: a browser
tab that is not being composited freezes its timers and a pdf.js render there
never returns. It also passes `standardFontDataUrl`; without it pdf.js cannot
draw Helvetica and **every filled value renders blank**, which reads as a
catastrophic failure that is not real. If a whole form comes back empty, suspect
the renderer before the form.

---

## What only the images catch

Each of these passed a field-value check and failed on the page.

| Symptom on the page | Cause |
|---|---|
| `Amount: $ $100` | The form's own currency symbol was sent to a PDF that prints its own. Fixed by `pdfValueForField` in `generate.js` — strips a leading symbol when the rest is a plain number. |
| `$100` in a column counting guns and rounds | A field was treated as money because its id contained `_amount`. The schema says `type: "amount"` vs `type: "label"`; the schema is now asked first. |
| A printed rule struck through the answer | pdf-lib starts a multiline block one *line-height* below the top of the box where it should be one *ascender* — 12.21pt against 7.90pt at 11pt Helvetica. Fixed by `ruledLineTextAppearance` in `dev-server.js`. |
| Text cut in half at the top of a short box | The lift above, applied to a box with no room for it. The fix clamps the lift to slack the box actually has. |
| An answer clipped mid-glyph in a one-line box | The box is 12.00pt and pdf-lib's multiline line box at 11pt Helvetica is 12.21pt, so the only line it draws does not fit. Fixed: a box shorter than one line is drawn with single-line layout, which centres in whatever height there is. |
| A repeating block's later rows simply absent | The interview allows more entries than the PDF has rows — the DV-100 asks for up to six firearms, the DV-110 table holds four. `/edit_pdf` now logs submitted values that matched no field, and flags the numbered ones. |

---

## Reading the pages: what "blank" means

Most blanks are correct, and mistaking them for defects wastes a session.
Judicial Council forms are mostly **not** filled by the filer:

- **DV-100** — the filer completes nearly all of it. Blanks here are suspicious.
  On a maximum-path fill only the `_line_2` continuation lines should be empty,
  and only because the project JSON's `continuationLines` deliberately drops
  them.
- **DV-109** — "The court will complete the rest of this form." Only items 1 and
  2 are the filer's. Hearing date/time/dept/room, the judge's signature and the
  clerk's certificate are all correctly blank.
- **DV-110** — "complete 1, 2, and 3 only." Everything under a
  *Not requested / Denied until the hearing / Granted as follows* tri-state is
  the judge's. Sixty-three blanks on a filled DV-110 is the correct number.

So the question is never "is this blank?" It is **"did the filer answer
something that is not on the page?"** Cross-check that mechanically first — the
payload against the PDF's field values — and use the images for the rest.

---

## The mechanical half

Do this before reading the pages; it makes the images faster to read.

```js
// every value the form actually submitted
const submitted = {};
document.querySelectorAll('input,select,textarea').forEach(el => {
  if (!el.name || el.disabled) return;
  if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) submitted[el.name] = '__CHECKED__'; return; }
  const v = String(el.value || '').trim();
  if (v) submitted[el.name] = v;
});
```

Then, per PDF, split the submitted names three ways:

1. **Landed in a field** — matched an AcroForm name and is non-empty. Good.
2. **Matched a field but arrived blank** — a real defect. Should be zero.
3. **Matched no field in this PDF** — expect a lot of these, and check what they
   are. Option mirrors (`<question>_<option-slug>`), `_hidden` / `_short` /
   phone `_code` splits, repeat counters, and the member halves of a linked
   field all legitimately have no PDF home. A *numbered* name here
   (`firearm_item_5_description`) means a repeating block overflowed the PDF's
   rows and the answer went nowhere.

---

## Cross-form names in a packet

A packet fills every PDF from one payload, so a name that appears in two PDFs
carries across. That is the mechanism, not a bug: 33 field names are shared
between DV-100 and DV-110 and 32 of them are how the DV-110 gets the case
number, the parties, the protected people and the firearm rows.

The consequence to keep in mind: **naming a field in form B the same as a
question in form A is how you wire them together, and there is no way to do it
by accident that the tooling can distinguish from doing it on purpose.** If a
value appears somewhere it should not, the fix is a rename in the field config,
not a code change.

---

## Where this sits in the order of checks

See `HANDOFF.md` §6 "Export / audit checklist". The page-image audit is the step
after reading the interview, and before saying a packet is done.
