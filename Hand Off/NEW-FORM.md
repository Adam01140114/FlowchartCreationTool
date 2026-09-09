# Taking on a new form

You have a blank PDF and nothing else. This is the path from there to a form
that fills it, and the decisions you have to make yourself along the way.

Read [`flowchart_ai_trainer_doc.txt`](./flowchart_ai_trainer_doc.txt) first for
what a good interview looks like. This document is about the artifacts.

---

## The four artifacts, and which are yours to write

| Artifact | Who makes it | What it holds |
|---|---|---|
| `<form>-field-config.json` | You, from the PDF | Every AcroForm field, renamed to what the interview will post |
| `<form>-hints.json` | **You, and this is the work** | Everything about the interview a field list cannot express |
| `<form>-flowchart.json` | `compile-form.js` | Generated. Do not hand-edit |
| `<packet>.spec.json` | You, once per packet | Form order, PDFs, connectors between forms |

The compiler is deterministic. Two agents with the same hints file produce the
same flowchart. **All of the judgment lives in the hints file** — which is why
a new form is mostly a hints-writing exercise, and why the existing
`dv100-hints.json` (67KB, 215 question entries) is the best worked example in
the repo.

---

## 1. Get the real field names out of the PDF

Judicial Council forms are encrypted and pdf-lib reports **zero fields** until
you decrypt:

```bash
qpdf --decrypt in.pdf out.pdf
```

Then list `getForm().getFields()`. You will get paths like
`DV-100[0].Page1[0].rightCaption[0].CaseNumber[0]`.

## 2. Write the field config

`{ formTitle, fields: [{ id, newName, type, label }] }` where `id` is the raw
AcroForm path and `newName` is the name the generated form will post.

Three rules that cost a session each:

- **List every field.** The sanitizer drops anything absent. Map fields you do
  not understand yet to their own `id` so they survive.
- **Repeated fields can share one `newName`.** A case number on nine pages gets
  one name and fills from one answer — `/edit_pdf` loops every field.
- **In a packet, a name shared with another form is the wiring.** If the
  DV-110 should show the case number the DV-100 asked for, give it the same
  `newName`. There is no other mechanism, and no way for the tooling to tell a
  deliberate share from an accident. See HANDOFF.md §2b.

Sanitize with `sanitizePdfFields(bytes, config)` and put the result where
`findPdfFile` looks — `FormWiz GUI/` wins over the repo root.

## 3. Write the hints file

This is the interview design. Every key below is optional; the compiler falls
back to one-question-per-field, which is almost never what you want.

### `sections`
`[{ name, fields: [...] }]` — the order a person meets the questions, grouped.
Sections are the spine; write these first.

### `questions`
`{ <nameId>: { question, type, options, conditional: { onlyWhen } } }` — per
field overrides. `onlyWhen` is how you gate one question behind another. This
is the biggest key by far (215 entries on the DV-100) and most of it is
question wording.

### `groups`
```json
{ "nameId": "person_to_restrain_gender",
  "members": ["..._male", "..._female", "..._nonbinary"],
  "question": "What is the gender of the person you want protection from?",
  "labels": ["Male", "Female", "Nonbinary"] }
```
Mutually exclusive checkboxes on the PDF become **one dropdown** in the
interview. A form that asks "check one" three times is a form nobody finishes.

### `splits`
```json
{ "field": "court_name_and_street_address", "join": ", ",
  "parts": [{ "nameId": "court_name", "question": "What is the name of the court?" },
            { "nameId": "court_street_address", "question": "What is the court's street address?" }] }
```
One PDF box that holds two answers becomes two questions, rejoined for the PDF.

**`join` is not optional and not cosmetic.** It is what tells the generated
form these boxes are halves of one field rather than copies of one answer. A
split that loses its separator becomes a "mirror", the runtime keeps the
longest box, and the court prints with a street and no name. See HANDOFF.md
§2b — this is the single most expensive mistake in this repo's history.

### `combines`
The inverse: several PDF fields that are one thought become one question with
several boxes. An address is the canonical case.

### `repeats`
```json
{ "nameId": "firearm_item", "question": "How many firearms...?",
  "entryTitle": "Firearm or Ammunition", "min": 0, "max": 6,
  "fields": [{ "label": "...", "nameId": "{n}_description" }] }
```
`{n}` is the entry number. **Check `max` against the number of rows every PDF
this feeds actually has** — the DV-100 allows six firearms and the DV-110 table
holds four, so entries five and six go nowhere. `/edit_pdf` logs submitted
values that matched no field, which is how this shows up.

### `mirrors`
One answer that fills many PDF fields — a case number on every page. `members`
is the list of PDF field names it populates.

### `continuations`
```json
{ "field": "...", "keep": "..._line_1", "drop": ["..._line_2"] }
```
A PDF that ruled two lines for one answer. Ask once, fill the first, leave the
second blank on purpose. Expect these to show up as blanks in the page audit
and do not "fix" them.

### `autofill`
```json
{ "field": "person_asking_protection_signature_date", "from": ["current_date"],
  "why": "A signature date has one correct answer and the form already knows it." }
```
Write the `why`. It is the difference between a rule and a mystery.

### `alwaysShown`
Questions the gate inference would hide but that the paper form asks
unconditionally. Each needs a `why` naming the item number on the form.

---

## 4. Compile, assemble, and check

Follow [`PIPELINE.md`](./PIPELINE.md) from step 2. Then the checks, in order,
none of them skippable:

1. `node pipeline-audit-flowchart.js` — the chart: reachability, dead ends,
   stray options, duplicate nodeIds, overlaps.
2. `node pipeline-audit.js` — the ten rules in `form_quality_check.txt`.
3. `node pipeline-review.js` — **read the whole interview yourself**, then
   answer each gate No in the preview and confirm the block behind it goes.
4. Fill maximum path, produce the PDFs, and
   **[read every page](./PDF-PAGE-AUDIT.md)**.

Steps 1 and 2 are regression tests for defects that already happened once. They
have reported zero failures on a packet that asked "Do you have a
dV 100[0].Page4[0]...?", on one that asked thirty questions about further abuse
of a filer who had just said it happened once, and on one that printed a court
with no name. Steps 3 and 4 are where those were caught.

---

## What a second form in the same packet costs

Much less, if you make the first form canonical. The DV-100 owns the nameIds;
the DV-109 and DV-110 hint files are 6KB and 17KB against its 67KB, because
they mostly declare `mirrors` onto names the DV-100 already chose.

So: **compile the primary form first, and let the others borrow its names.**
`project-gui-export.js` builds `packetMirrors` from the overlap, and
`projectForms` records which sections belong to which PDF.
