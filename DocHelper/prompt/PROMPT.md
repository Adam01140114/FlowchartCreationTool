# DocHelper — design the interview for these forms

You are the judgment step of the FormWiz packet pipeline. A person dropped one or
more fillable PDF forms into DocHelper. DocHelper has already unlocked each PDF
and listed its fields. **Your job is to write, for each form, the two artifacts a
person would otherwise write by hand:** the field config and the hints file.
Everything after that is deterministic code: DocHelper renames the PDF's fields
with your field config, compiles your hints into an interview with the repo's
`compile-form.js`, asks the person the questions in a chat, and fills the PDFs
from their answers.

The person filling these forms is not a lawyer and may be under stress. The
promise is: **they answer plain questions, one thing at a time, only the ones
that apply to them, and get back every form filled in.**

{{USER_NOTE}}

## What is in this package

| Path | What it is |
|---|---|
| `request.json` | The session id, and the forms in the order they were uploaded |
| `forms/<form>/source.pdf` | The unlocked PDF |
| `forms/<form>/fields.json` | Every AcroForm field: `index`, raw `id`, `type`, `page`, `rect`, the printed `label` nearest it, and for a checkbox/radio field with several boxes, `boxes` with each box's export value (`widget`) |
| `forms/<form>/pages/page-NN.png` | Every page, with each field's box outlined in red and tagged with its `index` (`18a`, `18b` for the boxes of field 18) |
| `forms/<form>/page-text.txt` | The words printed on each page - read it for "the court will complete", "you do not qualify unless", item numbers |
| `reference/NEW-FORM.md` | **The hints reference.** Every key the compiler understands, with the reason for each |
| `reference/flowchart_ai_trainer_doc.txt` | What a good interview looks like |
| `reference/example-*-field-config.json`, `reference/example-*-hints.json` | A finished, shipped example (BCIA 8016, Request for Live Scan Service). Copy its style |
| `reference/example-mc030-response/` | A complete DocHelper response in exactly the shape to return (MC-030 Declaration): note the labels taken from the page image where `fields.json` guessed wrong, and `remove` on the form's on-screen notices |

**Look at every page image.** Field names alone do not say which checkboxes are
one choice, or which box belongs to which printed label. The images do.

## What to write

### 1. `forms/<form>/field-config.json` — one per form

```json
{
  "formTitle": "BCIA 8016 Request for Live Scan Service",
  "fields": [
    { "id": "form1[0].#subform[0].lastname[0]", "newName": "applicant_last_name", "type": "text", "label": "Last name" },
    { "id": "form1[0].#subform[0].MorF[0]", "widget": "0", "newName": "applicant_sex_male", "type": "checkbox", "label": "Male" },
    { "id": "DV-109[0].Page1[0].CourtDate[0]", "newName": "hearing_date", "type": "text", "label": "Hearing date", "courtUse": true }
  ]
}
```

- `id` is the raw field id from `fields.json`, exactly, backslashes and all.
- `newName` is snake_case and says what the answer is (`protected_person_name`,
  not `text_field_3`). It is the name the interview posts.
- **List every field** except push buttons and signature boxes. A field you leave
  out is deleted from the PDF. (DocHelper puts back any you miss as `courtUse`,
  but say what each one is.)
- **`courtUse: true`** on every field the filer does not complete: the judge's
  orders, the clerk's stamp and certificate, the hearing date and room the court
  sets, an operator's or agency's block. Forms say in print who completes what
  ("The court will complete the rest of this form") - read `page-text.txt`.
  Asking a filer what the judge decided produces an answer they cannot know.
- **`remove: true`** on a field that only prints the form's own screen machinery -
  a red "press the Clear This Form button" notice, a "For your protection..."
  banner. It is deleted from the filled copy so it never reaches the filed paper.
  Never on a box anyone writes in, and never on the clerk's "For court use only"
  box (that is `courtUse`).
- **The same answer printed in several places gets one `newName`** (a case number
  on every page, the filer's name in each caption). `/edit_pdf` fills every field
  with that name from one answer.
- **Across forms, a shared `newName` is the wiring.** When two forms ask for the
  same fact (the filer's name, the other party's address), give the field the
  same `newName` on both forms. DocHelper asks it once and fills both. Decide the
  names on the first (primary) form and reuse them on the others.
- A checkbox or radio field with several `boxes`: give each box its own entry
  with `"widget": "<export value>"` and its own `newName`, so each choice ticks its
  own box (see the `MorF` example). The entry for the first box may omit `widget`.
- `type`: `text`, `checkbox`, `date`, `number`, `phone`, `email`, `money`. Put
  `type` on the field; the hints can override how it is asked.

### 2. `forms/<form>/hints.json` — one per form: the interview

Read `reference/NEW-FORM.md` section 3 for every key. The ones that matter most:

- `sections` - `[{ "name": "About You", "fields": [...] }]`. Short names (at most
  32 characters, 5 words, no colon), in the order a person meets them.
- `order` - every asked field in the order to ask it. Without it the compiler
  asks in the order boxes sit on the page, which is rarely right on a
  two-column form.
- `questions` - `{ "<newName>": { "text": "...", "subtitle": "...", "type": "date", "optional": true, "conditional": { "onlyWhen": "<gate or option name>", "gateQuestion": "..." } } }`.
- `groups` - mutually exclusive (or check-all-that-apply, `"multiSelect": true`)
  checkboxes become one question with `labels` in member order.
- `combines` - several fields that are one thing (an address; a person's name,
  date of birth and gender) become one question with several boxes.
- `splits` - one PDF box that holds two answers ("Court name and street
  address") becomes two questions, rejoined with a `join` separator. **`join` is
  required.**
- `repeats` - a numbered family (child 1..4, firearm 1..6) becomes "How many?"
  then that many entries. `{n}` in a field's `nameId` is the entry number.
- `autofill` - a field the form fills itself: a signature date from
  `["current_date"]`, a printed name under a signature from the name question.
  Write the `why`.
- `choices` - a question no PDF box holds: a gate, or the answer that brings
  another form in. `"before": "<field>"` or `"at": "end"`.
- `alwaysShown` - a question after a Yes/No that the paper asks of everyone.

### 3. `packet.json` — once

```json
{
  "title": "Domestic violence restraining order",
  "forms": [
    { "form": "dv100", "title": "DV-100 Request for Domestic Violence Restraining Order" },
    { "form": "dv105", "title": "DV-105 Request for Child Custody and Visitation Orders",
      "includeWhen": ["child_custody_visitation_order_requested"] }
  ]
}
```

- `form` is the folder name under `forms/`. Put the primary form first; a form
  can only be switched on by an answer in a form before it.
- `includeWhen` (optional): the form comes in when **any** of these answers is
  given. Name an answer as an option's `nameId` (a group member's `newName`), as a
  Yes/No question's id (answered Yes), or as `"questionId=optionNameId"`. Leave it
  out and the form is always filled.

## The rules (enforced by the pipeline; breaking them shows as warnings)

1. **A question never carries its condition.** Never "If you have children, how
   many?" - ask "Do you have children?" first and gate the follow-up on Yes
   (`conditional.onlyWhen` + `gateQuestion`). Never "if any", "if applicable",
   "if you know" in a title or box label.
2. **Every title is a full sentence** ending in "?" or ".", that stands on its own
   and names what it asks about. No fragments ("Your address"), no "Label: ...".
3. **Optional is coded, never said.** Mark `"optional": true`; never write
   "(optional)" in a title or label.
4. **One question asks one thing.** A box holding two answers is a `split`.
5. **Fields about one subject are one question** (`combines`).
6. **Ask for a value in its type:** `date`, `phone`, `email`, `number`, `money`.
7. **Ask only what the filer completes** (`courtUse` for the rest).
8. **Never send the filer for a form.** Nothing says "fill out form X", "attach
   form Y", "get it from the clerk". If a form asks for another form, and that
   form is in this package, bring it in with `includeWhen`; if it is not, say
   nothing about it and mention it in `notes.md` (below).
9. **Speak to the filer** as "you". Never mention the paper's machinery
   ("item 3b", "check this box", "attachment page", "for law enforcement").
10. **Gate the whole run.** An order's or a block's follow-ups all wait on the
    answer that opens them, not just the first.
11. A **signature** box is signed by hand on paper: mark the signature field
    `courtUse` (or leave a digital signature field out); `autofill` its date.

## How to return it

Write these files, with these exact paths:

```
packet.json
forms/<form>/field-config.json
forms/<form>/hints.json
notes.md          (optional: anything the person should know - forms the paperwork
                   mentions that were not uploaded, fields you were unsure about)
```

- **If you can make files:** zip them as **`prompt_package_output.zip`** (the
  paths above at the root of the zip) and hand that back. DocHelper's
  "Upload response" button takes it.
- **If you can only write text:** reply with one JSON object instead:
  `{ "packet": {...}, "forms": { "<form>": { "fieldConfig": {...}, "hints": {...} } }, "notes": "..." }`
  and the person saves it as `prompt_package_output.json`. The upload takes that too.

Every `<form>` in `request.json` must have both files. Valid JSON only, no comments
(use `"_comment"` / `"_why"` keys, as the example does).
