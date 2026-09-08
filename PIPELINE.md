# Packet pipeline — PDFs in, filled forms out

Everything from a folder of court PDFs to a verified HTML interview runs as
commands. Each stage writes an artifact the next stage reads, so any stage can
be re-run on its own and the result is reproducible rather than remembered.

```
   PDFs ──► field configs ──► connections ──► sanitized PDFs
                  │                                   │
                  └──► hints ──► flowcharts ──► project ──► packet GUI JSON
                                                                │
                                                    HTML form ──┴──► filled PDFs
```

## The artifacts

| File | What it holds | Who writes it |
|---|---|---|
| `dv-field-configs/<form>-field-config.json` | every AcroForm field: raw path, canonical `newName`, and `courtUse` | Auto Form Creator, then edited |
| `dv-packet-connections.json` | which fields on different forms are the same answer | you |
| `<form>-hints.json` | interview knowledge the field config cannot express: question wording, option labels, exclusive groups, sections | you |
| `<form>-flowchart.json` | the compiled flowchart | `compile-form.js` |
| `dv-packet.spec.json` | the packet: form order, PDFs, connectors | you |
| `dv-packet-project.json` | the project the editor opens | `pipeline-build-packet.js` |
| `dv-packet-gui.json` | every form merged into one interview | the editor's **Export Project GUI JSON** |
| `pipeline-answers.json` | what a debug fill answered | the generated form |
| `pipeline-out/` | filled PDFs, field read-backs, page images | `pipeline-fill.js` |

## `courtUse` — who completes what

Every Judicial Council form prints it. DV-109: *"The person asking for a
restraining order must complete items 1 and 2. The court will complete the rest
of this form."* DV-110 says the same for items 1, 2 and 3.

A field marked `"courtUse": true` in the field config never becomes a question.
It stays on the PDF, blank, for the judge or clerk. This is not a cosmetic
choice: asking a survivor what the judge decided produces an answer they cannot
know and a filed order that says the court ruled something it has not.

## Splitting a field that holds two answers

A PDF box labelled "Court name and street address" is one field and two
questions. Declare the split in the form's hints and the pipeline handles both
halves:

```json
"splits": [
  { "field": "court_name_and_street_address",
    "join": ", ",
    "parts": [
      { "nameId": "court_name",           "question": "What is the name of the court?" },
      { "nameId": "court_street_address", "question": "What is the court's street address?" }
    ] } ]
```

The compiler asks the parts in the original's place and emits a linked-logic
node carrying the separator; the generated form keeps a hidden field of the
original name holding the parts joined in order, and that is what fills the PDF.
Any field, any separator, any form - see rule 8.

## Combining fields into one question, and typing them properly

Fields that describe one subject are one question (rule 9), and a value is asked
in the type it is (rule 10):

```json
"combines": [
  { "question": "Where can the court send you papers?",
    "fields": [
      { "field": "person_asking_protection_mailing_address",  "label": "Street address" },
      { "field": "person_asking_protection_mailing_city",     "label": "City" },
      { "field": "person_asking_protection_mailing_state",    "label": "State" },
      { "field": "person_asking_protection_mailing_zip_code", "label": "ZIP code" } ] } ],
"questions": {
  "person_to_restrain_date_of_birth": { "type": "date" },
  "person_asking_protection_age":     { "type": "number" }
}
```

A combine becomes a `multipleTextboxes` question whose boxes keep the PDF's own
field names; a type becomes a date picker, a phone keypad, an email field or a
number box. Types work inside combined and repeating questions too.

## Running it

```bash
# 1. cross-form identity, then rebuild the PDFs whose field names changed
node pipeline-connect.js
node pipeline-sanitize.js dv109 dv110

# 2. compile each form, then assemble the packet
node compile-form.js dv-field-configs/dv100-field-config.json dv100-flowchart.json --hints dv100-hints.json
node pipeline-build-packet.js

# 3. open dv-packet-project.json in the editor (Import Project JSON),
#    then Export Project GUI JSON -> dv-packet-gui.json

# 4. audit the static rules - the chart, then the interview it exports to
node pipeline-audit-flowchart.js
node pipeline-audit.js

# 5. fill the form (debug menu: Ctrl+Shift, then "Fill maximum path"),
#    save the answers, and produce the PDFs
node pipeline-fill.js --render
node pipeline-explain.js dv110

# 6. read the interview yourself. This step is not optional and no packet
#    ships without it - the audit only catches what it was taught to catch.
node pipeline-review.js
```

## The last step: read it

`node pipeline-review.js` prints the whole interview in the order a person meets
it - question text, type, what each one waits on, and the boxes inside combined
and repeating questions. Read all of it, then answer the form in the preview and
check that saying No to a gate really does remove the block behind it.

This is a required step, not a review of last resort. `pipeline-audit.js` is a
regression test for defects that already happened once; it reported zero
failures on a packet that asked "Do you have a dV 100[0].Page4[0]...?" and that
asked thirty questions about further abuse of a filer who had just said it
happened once. Both were obvious on one read.

## The two fill modes

Both live in the preview's debug menu (Ctrl+Shift), and both write each field's
own id into it, so a rendered page can be read against the blank form and every
box says which field it is. A name-level match only proves a value went
somewhere; markers are the only way to see that height went into the height box.

**Fill maximum path** answers every question the way that opens the most
questions. It measures coverage - rule 4a, every field the answers reached
carries a value.

**Fill minimum path** answers every question the way that opens the fewest:
"no" before "yes", the smallest count on a numbered block, and no optional
checkbox ticked at all. It measures the opposite thing - that a gate answered No
actually closes the block behind it. A form can pass the widest path and fail
this one, which is how thirty questions about further abuse stayed on screen for
a filer who had just said it happened once.

Run both. Neither is sufficient alone, and each takes a few seconds.

Run each from a freshly loaded preview. The form restores its own saved draft
on load, so a minimum path started on the page a maximum path just finished is
measuring the maximum path's leftovers - it will report far more filled than
the narrow path actually opens.

Fields the form validates - dates, zips, phones, amounts - keep valid data in
either mode, because a marker there fails validation and stops the run.

### How a path is found

Both modes solve the interview as data and then write the answer to the page
once. `generate.js` emits every question's conditions as `window.__FORM_LOGIC__`
alongside the closures that enforce them, and the fill settles answers and
visibility against that model - a few thousand comparisons - before touching a
field.

It used to work the other way round: the page was the only model, so the only
way to learn what an answer would reveal was to write it in and watch which
handlers fired. Scoring one dropdown meant doing that once per option, and a
pass meant doing it once per dropdown, over eight passes. On the DV packet that
was 12,872 change events and a minute and a half, and it answered 215 of 474
fields, because `isDebugFillEligible` asked what was on screen and in
question-at-a-time mode that is one question. The same packet now settles in
about three seconds and 200 events, with every field the path reaches answered.

One thing the walk was doing by accident is now done on purpose. The page
finishes autofilling on a timer after load, and those events re-run the
conditional logic in an order that can hide a question for one event and show
it for the next - and hiding a question clears the dropdowns inside it without
putting them back. Each of the eight passes quietly repaired that. A solved
fill is finished before the page has stopped moving, so it waits for quiet and
puts back what moved, up to three times.

## Reading the result

`pipeline-fill.js` reports, per form, how many text fields and checkboxes came
back filled, and lists what is still empty. `--render` also rasterises every
page to `pipeline-out/<form>-pages/`, in-process via pdfjs - it used to shell
out to Ghostscript, which the repo does not install, so rule 4b died on any
machine without `gs`. `--scale` sets the resolution (1.6 by default). `pipeline-explain.js` says why each
empty field is empty: a gate the answers closed, a field the court fills, or a
defect. A defect is a field whose question exists, whose gates are open, and
which is still empty — that list should always be empty before shipping.
