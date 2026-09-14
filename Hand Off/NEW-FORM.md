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
| `<packet>-disqualifiers.json` | You, from the PDF text | Which combinations of answers rule the filer out |

The compiler is deterministic. Two agents with the same hints file produce the
same flowchart. **All of the judgment lives in the hints file** — which is why
a new form is mostly a hints-writing exercise, and why the existing
`dv100-hints.json` (67KB, 215 question entries) is the best worked example in
the repo.

---

## 0. Get the blank PDF

Which forms the packet still needs is in [`FORMS.md`](./FORMS.md), and
`node pipeline-form-refs.js` lists every form the paperwork mentions and what
covers it.

Judicial Council forms download with a plain request - no browser, no login,
no human check. Every form is at `https://courts.ca.gov/documents/<form>.pdf`,
the form number in lower case with its punctuation dropped (`dv105a.pdf` for
DV-105(A), `clets001.pdf` for CLETS-001), and that address forwards to the
current revision. This is exactly how DV-105(A) was fetched on September 14,
2026:

```bash
curl -sSL --max-time 60 \
  -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" \
  -o dv105a.pdf \
  -w 'http %{http_code}  type %{content_type}  bytes %{size_download}  final %{url_effective}\n' \
  https://courts.ca.gov/documents/dv105a.pdf
file dv105a.pdf                 # must say "PDF document"
qpdf --show-npages dv105a.pdf   # and have pages
```

It answered `http 200  type application/pdf  bytes 1494750  final
https://courts.ca.gov/sites/default/files/courts/default/2024-11/dv105a.pdf`
(the form's January 1, 2025 revision). The browser user-agent is a precaution,
not a requirement: a `curl -I` with curl's own reached the same PDF.

- **Check what came back before using it.** A site that ever puts a
  "prove you are human" page in the way answers with HTML and status 200;
  `file` saying "HTML document" is how you find out. Then a person has to
  download it - ask the user.
- Save it in the repo root, named like the others (`dv105a.pdf`), and put the
  address in the spec entry's `_source`.
- The user has given standing permission to download court PDFs (September
  14, 2026: "you always have full permission to download any pdfs you want").
  Download, verify, and say in your report what you fetched, from where and
  how big. A court guide the audit should read, rather than a form to fill,
  goes in `reference-forms/` and in the spec's `referenceSources`.

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

### `overflow` - a long answer continues on MC-025
```json
"overflow": { "other_abuse_incident_details": {
  "marks": "other_abuse_incident_additional_space_attached_yes",
  "page": { "name": "DV100_Item_7f", "heading": "DV-100, Item 7(f)", "item": "7(f)",
            "itemTitle": "Description of the abuse", "form": "DV-100" } } }
```
Rule `the-packet-uses-mc025-for-more-space`: **anything that needs more space
continues on MC-025.** A narrative box with a "need more space" / "not enough
space" box beside it gets an overflow link: past what the box prints, `marks`
ticks and the rest is filled onto an MC-025 page, as many sheets as it takes,
with no limit on the answer. Never continue onto another form's box (DV-101,
MC-020) and never hold an answer to its box and mark the "more space" box
`courtUse` - RULE 21 and RULE 13 fail both. `page.name` must be unique in the
packet; `attachmentNumber` is optional (default "<form>, Item <item>"). Several
answers may share one `marks` (DV-160 item 8). A table's entries past its rows
go on MC-025 the same way, through `repeats[].attachment`. DV-105, DV-108,
FL-150 and DV-160 are forms of their own and are never replaced by MC-025.

### `computed` - `tickWhen`, a box other answers tick
```json
"financial_statement_simplified_allowed": { "tickWhen": {
  "all": ["child_support_order_requested", "dv570_other_income_no"],
  "none": ["spousal_support_order_requested", "lawyers_fees_and_costs_order_requested"] } }
```
A checkbox the form ticks while every box in `all` is ticked and none in `none`
is. Use it when a form comes in on a combination of answers: an activation
(`whenFieldTicked` in the spec) reads a single box, and a gate's `onlyWhen`
only ORs its conditions. It is how DV-570's verdict brings in FL-155.

### `computed` - `remainderOf`, the rest of a whole
```json
"fl150_percent_time_with_other_parent": { "remainderOf": { "field": "fl150_percent_time_with_me", "total": 100 } }
```
Two boxes that must add up to a whole (the children's time with each parent)
are asked once: the filer gives their part, the form writes the rest. Asked
both, a filer could answer 100 and 100. Blank unless the part is a number
within the whole.

**Anchor a gate before the first field that waits on it.** A `choice` placed
`before` a later field is not there yet when an earlier field names its answer
in `onlyWhen`, and the compiler invents a second Yes/No gate for that field
(`created gate "..._yes"` in the compile notes, and an extra question). FL-150's
and FL-155's time-share gates had to move from the field after the percentage
to the percentage itself.

**Before adding a form at all:** the packet's forms are the user's list
(`scope` in `dv-packet.spec.json`). A form the paper mentions outside it goes in
`formsOutOfScope`, saying why; add to `scope` only when the user asks.

### A checkbox field with several boxes - `widget`
Older forms (FL-155) put several boxes in one checkbox field, told apart by
export value (`/Yes`, `/1`, `/2`...). pdf-lib ticks a field, not a box, so only
the first could ever print. Name each other box with the field's `id` and its
export value, and the sanitizer splits it into a field of its own:
```json
{ "id": "CB.0.0.1.0a", "newName": "fl155_tax_status_single", "type": "checkbox" },
{ "id": "CB.0.0.1.0a", "widget": "1", "newName": "fl155_tax_status_married_jointly", "type": "checkbox" }
```
Find the values and which box is which by position (`getOnValue()` and each
widget's rectangle against the printed label). RULE 22 fails an unsplit field.

**A question whose answers are PDF boxes is a hint `group`**, members the box
names: each answer then ticks its own box. As a `choice` with the boxes'
names, the boxes are also asked again on their own (and the preview check fails).
An answer with no box ("I have never had a job") is a Yes/No gate before the
group.

### A question no box holds - a `choice` with no options, and `noBox`
"Other information ... attach extra sheet" (FL-155 item 12) has no box on the
paper. Ask it as a `choice` with no `options` and `"type": "bigParagraph"`
(`optional` and `subtitle` are carried), and give it an overflow link with
`"noBox": true` and a `page`: the whole answer is an MC-025 page. When a box on
the paper asks for that sheet ("specify reasons for expenses on separate
sheet"), name it in `"sheetFor"` so RULE 13 knows the page serves it; the form
does not tick or untick it.

### A multi-line box inside a block or a multi-part question
A block's column or a combined question's part that the paper rules over
several lines (DV-160's redaction columns, FL-150's insurance company address)
takes `"type": "bigParagraph"` in `repeats[].fields` or `combines[].fields`.
The compiler keeps it, the export passes it through (`FIELD_TYPE_PASSTHROUGH`
in `library.js`), and the generated form draws a textarea for it. RULE 12 fails
a multi-line box asked on one line.

### An address line built from parts
A caption line joined from city, state and ZIP (`splits` or `autofill` with a
`join`/`separator`) prints the state as its postal code: the form joins each
part's hidden `<id>_short` where there is one. Join with a space: "Los Angeles
CA 90210".

### `autofill`
```json
{ "field": "person_asking_protection_signature_date", "from": ["current_date"],
  "why": "A signature date has one correct answer and the form already knows it." }
```
Write the `why`. It is the difference between a rule and a mystery.

### `alwaysShown`
Questions the gate inference would hide but that the paper form asks
unconditionally. Each needs a `why` naming the item number on the form.

### `choices`
```json
{ "nameId": "papers_served_by_sheriff", "question": "Do you want the sheriff or marshal to serve ...?",
  "at": "end", "options": [{ "label": "Yes", "nameId": "papers_served_by_sheriff_yes" },
                           { "label": "No",  "nameId": "papers_served_by_sheriff_no" }] }
```
A question no PDF field holds - a gate the form implies, or the answer that
brings another form in. `"before": "<field>"` asks it just before that field;
`"at": "end"` asks it after everything the form's own fields ask (DV-100's last
fields are signatures the form fills itself, so nothing came after them).
`onlyWhen` gates it. List its `nameId` in a section. A choice whose `before`
names no field the form asks is reported as NOT ASKED by `compile-form.js` -
it used to vanish silently.

---

## Disqualifying factors: alerts that depend on several answers

Court forms are full of conditions of the shape "you do not qualify unless".
The DV-100 item 3g is the canonical one:

> Have you lived together as a family or household (more than just
> roommates)? ☐ Yes ☐ No
> *(If no, you do not qualify for this kind of restraining order unless you
> checked one of the other relationships listed above.)*

That is two questions joined by AND, and one of them is negative: the filer
answered **No** to the household gate *and* ticked **none** of the six
relationship boxes. A per-question alert cannot say it - it can only speak
about the question that owns the option pointing at it, and its conditions
are OR-ed.

### Finding them

```bash
node pipeline-disqualifiers.js --scan
```

reads the packet's PDFs and prints every sentence that sounds like a
disqualifier, with the form and page - "you do not qualify unless", "only if
you are married", "you must be". Each is a lead, not a rule: decide which
fields it is about, write it into `<packet>-disqualifiers.json`, and wire an
alert node for it. `--check` then verifies the wiring exists and exits
non-zero when it does not.

### Drawing one

You do not have to. `pipeline-build-packet.js` reads
`dv-packet-disqualifiers.json` and wires every declared disqualifier as it
assembles the packet - one alert node per entry, one arrow per condition, `is`
plain and `isNot`/`noneOf` marked NOT - and refuses to build if a condition
names an answer no question offers. Declaring one is enough; the chart follows.

This was not always so. The first four were drawn by hand into the built
project, which is not a file the build reads, so the next `pipeline-build-packet`
silently dropped all four and the packet went out with the rules declared and
none of them wired - exactly the failure the disqualifiers file exists to
prevent. Anything that must survive a rebuild belongs in a source the rebuild
reads.

To draw one by hand in the editor anyway: point more than one arrow at the same alert node. Each arrow is a condition:

| Arrow from | Condition | Marked NOT |
|---|---|---|
| an option | that option is chosen | that option is *not* chosen |
| a question | that question is answered | **nothing** is chosen in it |

Mark an arrow NOT by right-clicking it and choosing **Toggle NOT (alert
condition)**. It turns red and dashed and is labelled `NOT`.

Once an alert has two or more arrows it shows a selector: **fires when
ALL / ANY of N conditions hold**. ALL is the default and is what a
disqualifying factor almost always wants.

A warning the DV-100 itself supplies: item 3g's gate lives **inside** the
relationship question - it is only asked because "We live together or used to
live together" was ticked. So "nothing is answered here" is never true, and
the arrow-from-the-question-marked-NOT shorthand is the wrong condition. What
disqualifies is that none of the *other six* is ticked, which is six arrows
from six options, each marked NOT. Read the gate's wording before reaching
for the shorthand.

So a gate that is a question of its own is: an arrow from that gate's **No** option, plus an
arrow from the relationships **question** marked NOT, with the alert set to
ALL.

### What it compiles to

```json
{ "id": "alertRule0", "mode": "all",
  "message": "You do not qualify for this kind of restraining order unless ...",
  "conditions": [
    { "questionId": "2", "op": "is", "value": "No" },
    { "questionId": "1", "op": "notAnswered" } ] }
```

It lands in the GUI JSON as a top-level `alertRules` array, travels through
the builder untouched, and is tested by `checkAlertRules()` when the filer
leaves a section. Ops are `is`, `isNot`, `answered`, `notAnswered`.

Two behaviours worth knowing:

- **A rule fires where its last question is answered**, not wherever the filer
  happens to press Next. The property-restraint rule mentions the orders
  question in section 8 and the relationship question in section 3; without
  this it went off in section 3, telling the filer they could not have an order
  they had not been offered yet. The deciding answer is the last one given.
- A rule is only tested once **every** question it mentions exists on the
  page, so a half-finished form does not accuse the filer of not qualifying
  before they have had a chance to answer.
- An alert node with a **single** arrow is left on the old per-question path
  and behaves exactly as it always did. Nothing existing changes.

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
