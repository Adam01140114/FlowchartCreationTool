# Flowchart Creation Tool — Agent Handoff

**Date:** September 8, 2026  
**Repository:** https://github.com/Adam01140114/FlowchartCreationTool  
**Branch:** `main`

This document is for the next AI agent (Claude or otherwise) taking over development. Read this first, then read the trainer spec bundled in this folder.

---

## 1. What this project is

The **Flowchart Creation Tool** is a browser-based mxGraph editor for building **form interview flowcharts**. Those flowcharts compile/export into **FormWiz GUI JSON**, which generates fillable HTML forms and maps answers onto PDFs.

The product has two layers:

| Layer | Owner | Responsibility |
|-------|--------|----------------|
| **Logical form schema** | Human | Sections, questions, types, options, conditions — what the form *means* |
| **Flowchart + form quality** | AI agent | Interview design, layout, routing, gates, export JSON, **and auditing the generated HTML form** |

The form is the deliverable. A broken dropdown in Preview Form is as serious as a broken edge in the flowchart.

---

## 2. Required reading: trainer document

**Primary spec:** [`flowchart_ai_trainer_doc.txt`](./flowchart_ai_trainer_doc.txt). This folder is now the only copy — the duplicate at the repo root has been removed so there is one place to edit.

That file defines:

- Role split (human = schema, bot = flowchart + compile)
- Semantic compile rules (mutually exclusive checkboxes → one dropdown, gates, skip paths, merge/split hubs)
- Flowchart JSON shape (`edgeStyle: "curved"`, `sectionPrefs`, waypoints)
- Circuit-board routing rules (orthogonal edges, merge/split hubs, `NODE_GAP`, `fitBox`)
- W-9 worked example and pre-ship checklist
- **Preview Form audit:** every dropdown must list flowchart option labels — empty options must not silently become Yes/No

Treat the trainer doc as the source of truth for flowchart bot behavior.

For a form this repo has never seen, read [`NEW-FORM.md`](./NEW-FORM.md)
alongside it: the trainer doc says what a good interview looks like, and that one
says which artifacts you write and which are generated.

---

## 2b. Rules the code does not state

These are the things that cost a session each to learn. None of them can be
worked out by reading the source, because in every case the code looks
reasonable and the data is what carries the meaning.

### A linked field means two different things, and only the separator says which

A `linkedFields` entry with a `join` is a **join**: its boxes hold different
halves of one PDF field, concatenated in field order. The same entry *without*
a `join` is a **mirror**: its boxes are the same answer asked in branches that
exclude one another, so only one is ever on screen.

Nothing else distinguishes them. A join that loses its separator on the way to
the page therefore reads as a mirror, and the runtime keeps "the longest" box.
On the DV-100 that meant `court_name` (10 characters) losing to
`court_street_address` (20), so the caption printed a court with a street and
no name — and the box on screen still looked right, because only the PDF field
was wrong.

The runtime now infers a join when a link has no separator but its on-screen
boxes hold *different* answers, and says so in the console. Do not rely on
that: **set the separator in the builder.** The inference exists to stop a
stale form record destroying answers, not as the way links are meant to work.

### The schema decides what a field is; the name is only a guess

A textbox in `allFieldsInOrder` carries `type: "amount"` or `type: "label"`.
That is authoritative. Name-based guessing (`id.includes('_amount')`) is a
fallback for fields built before the flag existed, and it is wrong often
enough to matter: the DV-100 firearms table asks for a "Number or amount" of
guns and rounds, which ends in `_amount` and is not money.

### A currency symbol is decoration, not data

A money box shows `$` so the filer can see what the box is for. The PDF prints
its own `$` beside the field. Send the symbol and the court form reads
`Amount: $ $100`. `pdfValueForField` strips a leading symbol on the way out,
and only when the rest is a plain number — an answer that merely starts with
one is somebody's text and is passed through.

### The value in a PDF field is not the ink on the page

The value lives in the field dictionary; the ink comes from the appearance
stream. Every check that reads values passes on a form that prints wrongly.
pdf-lib starts a multiline block one *line-height* below the top of the box
where it should be one *ascender*, so on a ruled form the printed rule strikes
through the answer. See [`PDF-PAGE-AUDIT.md`](./PDF-PAGE-AUDIT.md), which is
the only check that sees any of this.

### Lay text out by the size of the box, not by the field's flag

A PDF field's multiline flag says what a person is allowed to *type*. It says
nothing about how much room the box has, and the two disagree more often than
you would think: `extend_service_deadline_reason` on the DV-100 is flagged
multiline and its rect is 12.00pt tall, while pdf-lib's multiline line box at
11pt Helvetica is 12.21pt. The one line it draws does not fit, and the glyphs
are clipped through the middle.

So before drawing, compare the box against one line of the layout you are
about to use, and fall back to single-line layout when it does not fit -
single-line centres the text in whatever height there is. `dev-server.js`
does this by turning the flag off for the length of one call and restoring
it, so the saved document keeps the field as the form author declared it and
only the appearance is drawn the other way.

The general form of this rule: **a flag is a statement of intent and a
rectangle is a fact.** Where a layout decision can be made from the geometry,
make it from the geometry.

### In a packet, a shared field name *is* the wiring

One payload fills every PDF, so a name present in two PDFs carries across.
Thirty-three names are shared between DV-100 and DV-110, and that is how the
DV-110 gets the case number, the parties, the protected people and the firearm
rows. There is no way to tell a deliberate share from an accidental collision
from inside the code. If a value lands somewhere it should not, **rename it in
the field config** — do not add a special case.

### A repeating block can outgrow the PDF it feeds

The DV-100 asks for up to six firearms; the DV-110 table holds four. Entries
five and six have nowhere to land and vanish without an error. `/edit_pdf`
now logs submitted values that matched no field and flags the numbered ones,
which is what this looks like from the outside. Check the `_twoNumbers`
maximum on a repeating question against the row count in every PDF it feeds.

### `generate.js` emits the form as one enormous template literal

Roughly lines 14000-21500. Inside that region backticks, `${` and backslashes
are consumed before they reach the browser. Edits there must avoid all three,
use `.indexOf()`/`.endsWith()` rather than regex, and be checked before they
are written — an edit that looks right in the file produces broken JavaScript
in the generated HTML, and it only shows when a form is opened. `syntax.txt`
in this folder has the detail.

### A green audit is not evidence

Said in several places in this folder because it keeps being the thing that
goes wrong. `pipeline-audit.js` finds what it was taught to find. Every defect
listed above was found *after* a clean audit run.

---

## 3. Quick start (local dev)

From repo root `FlowchartCreationTool/`:

```powershell
npm start
```

Opens **http://127.0.0.1:8080** → flowchart editor (`index.html`).

**Important:** Use `npm start` (runs `dev-server.js`), **not** plain `http-server`. Only the dev server implements:

- `POST /edit_pdf?pdf=W9.pdf` — fill PDF AcroForm fields from form data (Preview/Download PDF)
- `POST /api/test-payload` — build downloadable zip for test deployment

`npm run start:static` and `npm run start:gui` return **405** on `/edit_pdf` and filled PDF preview will fail or show blank templates.

FormWiz GUI only (no PDF fill):

```powershell
npm run start:gui
```

Or via main app: **Preview Form** → modal picks **Question style** + **Deployment style** (default: **Test**) → opens `FormWiz GUI/gui.html?previewKey=...&questionStyle=...&deploymentStyle=test` in a new tab.

**Compile W-9 reference flowchart from schema:**

```powershell
node compile-form-schema.js
```

Defaults:

- Input: `_w9_payload/IRS_Form_W-9_.../field_config.txt`
- Output: `w9-flowchart.json` (repo + Desktop copy)

---

## 4. Repository map (high-signal files)

### Flowchart editor

| File | Purpose |
|------|---------|
| `index.html` | Main UI — palette (**Select Nodes**), Preview Form, Import/Export |
| `script.js` | Graph logic, autosave, `previewForm()`, `startPreviewForm(questionStyle)` |
| `library.js` | **Export GUI JSON**, merge/split hub edge walking, section consolidation (min 2 questions/section), `exportGuiJson()` |
| `context-menus.js` | Node menus; `isEndNode` only checks `nodeType=end` (not hardcoded ids) |
| `compile-form-schema.js` | Schema → W-9 flowchart JSON (layout + routing + audit) |
| `dev-server.js` | **Default `npm start` server** — static files + `/edit_pdf` + `/api/test-payload` |
| `payload-html.js` | Sanitizes HTML for test-payload zip folders |
| `w9-flowchart.json` | Latest compiled W-9 flowchart |
| `_w9_payload/` | W-9 logical schema (`field_config.txt`) |
| `project-gui-export.js` | **Project-level GUI JSON** — merges every form, builds `projectForms` / `formActivations` / `packetMirrors`, drops sections left empty |
| `audit-pdf-pages.js` | Renders a filled PDF to page images — see `Hand Off/PDF-PAGE-AUDIT.md` |
| `pipeline-*.js` | audit, fill, explain, connect, sanitize, build-packet, harvest-text |
| `dv-packet.spec.json` | what the DV packet is: form order, PDFs, connectors |
| `dv-packet-connections.json` | which fields on different forms hold the same answer |
| `io-dialogs.js` | copy-or-download / paste-or-upload dialogs (a copy lives in `FormWiz GUI/`) |
| `dv-packet-project.json` | The DV packet project (DV-100 + DV-109 + DV-110). This is what `Import Project JSON` takes |
| `dv-field-configs/` | **`id` → `newName` maps for the three DV PDFs.** Without these there are no sanitized PDFs and nothing fills |
| `dv100.pdf` / `dv109.pdf` / `dv110.pdf` | Original Judicial Council forms (encrypted; qpdf decrypts them) |
| `FormWiz GUI/dv1*.pdf` | **Sanitized** copies — fields renamed to `newName`. These are the ones `/edit_pdf` fills |

### FormWiz GUI (generated form)

| File | Purpose |
|------|---------|
| `FormWiz GUI/gui.html` | Loads preview JSON; sets `window.__FORM_QUESTION_STYLE__` |
| `FormWiz GUI/generate.js` | **Form HTML generator** — question styles, section cards, debug menu, nav, test/prod deployment UI, PDF fill helpers |
| `FormWiz GUI/generate.css` / `generate2.css` | Form + stepper styles |
| `FormWiz GUI/download.js` | `showPreview()`, import/export; supports option `{ text, nameId }` |
| `FormWiz GUI/W9.pdf` | W-9 AcroForm template used by `/edit_pdf` |

---

## 5. Work completed before this handoff

### Flowchart / export

- **Merge/split hubs** for 3+ incoming/outgoing edges; export walks through hubs so dropdowns get real options (fixes Yes/No fallback in Preview).
- **Circuit-board routing** with waypoints, `packRow`, text-fit sizing.
- **W-9 compiler** (`compile-form-schema.js`) with identification gates, tax-class dropdown, LLC C/S/P, exemptions, address, TIN columns.
- **`isEndNode` fix** — only `nodeType=end`; cell id `"19"` was wrongly treated as End ( broke LLC “C corporation” option).
- **Section consolidation** on export: sections with fewer than 2 questions merge into an adjacent section; jump targets remapped.

### Flowchart UI

- Palette collapsed under **Select Nodes** (`<details>`).
- **Export GUI JSON** modal (copy + download).
- **Preview Form** → modal picks **Question style** (default: **One section at a time**):
  - `question` — one question at a time (classic)
  - `section` — all non-hidden questions in section visible; Next = next section
  - `all` — entire form stacked

### Form generation (`generate.js`)

- **Section / all modes:** questions that always appear (e.g. “Any Text” logic, all Yes/No paths lead to same next Q) stay visible without answering the previous field.
- **Stepper labels** — no longer cramped; labels use natural width, wrap on small screens.
- **Section mode spacing** — more space under stepper, less under ← → nav.
- **Back button fix** in section mode — Back goes to previous section (was trying to step within section while all questions visible).

### Form Debug Menu (Ctrl+Shift in preview)

- **Fill maximum path** — fills form for worst-case PDF coverage: avoids jump-to-end and hard alerts, maxes numbered dropdowns, prefers branches that reveal more fields, up to 8 passes (stops when a pass changes nothing), with a progress bar and a yield between questions so the tab stays alive.
- **Fill minimum path** — every gate answered the way that opens the least, to check that saying No really does close the block behind it. Both modes write each field's own id as its value, so a rendered page can be read against the blank form.

### Test deployment mode & dev server (September 2026 session)

- **`npm start` → `dev-server.js`** — Express on port 8080; required for filled PDF preview/download.
- **Preview Form modal** — **Deployment style** radio: **Production** vs **Test** (default: **Test**). Passed as `deploymentStyle=test|production` in preview URL.
- **Test mode thank-you screen** — shows **Download PDFs**, **Preview PDFs**, **Download Payload**; hides Checkout / Exit Survey.
- **Download Payload** — POST `/api/test-payload` builds a zip (`index.html`, CSS, logo, PDFs, README) for offline test folders under `FormWiz GUI/<FormName>/`.
- **`window.__FORM_DEPLOYMENT_STYLE__`** — set from preview URL / GUI; test mode sets `__FORM_SKIP_SIGNIN_GATE__` where configured.

### Generated HTML & preview fixes

- **Template-literal escaping** in `getFormHTML()` — `downloadTestPayload()` / `preparePayloadHtml()` backslashes must be doubled in generator source or embedded JS breaks (section nav, debug menu, entire main script block fails to parse).
- **Section-mode preview** — fixed by above; Ctrl+Shift debug menu works in separate script block once main script parses.

### PDF fill / field mapping fixes

- **`resetAllNodeIds()` before preview** was overwriting PDF field names (`taxpayer_name`) with text-derived ids (`what_is_your_name`). **`generateCorrectNodeId()`** now prefers `cell._nameId` and existing `nodeId=` in style before text-based generation.
- **Dropdown → PDF checkbox mapping** — flowchart option cells carry `_nameId` (e.g. `tax_classification_individual`). Export now:
  - includes `option.nameId` in GUI JSON;
  - auto-builds `hiddenLogic.configs` from option `_nameId`s;
  - `dropdownMirror` / `createHiddenCheckboxesForAutofilledDropdowns` skip label-suffix mirror checkboxes when hidden logic handles the PDF field.
- **`pdfOutputFileName` default** — falls back to `W9.pdf` when unset (was `example.html`).
- **Preview PDF** — no silent fallback to unfilled static PDF on 404/405; shows explicit error to run `npm start`.
- **`hiddenLogicConfigs` TDZ bug** — declare array before option loop in `exportGuiJson()` (fix for preview crash).

---

## 5b. September 3, 2026 session — making the DV packet actually produce filled PDFs

Importing `dv-packet-project.json` and pressing Preview Form produced a form that
looked fine and was wrong in six ways. All six are fixed; the notes matter because
several were invisible until you checked the output rather than the chart.

### Preview only ever showed the first form

`startPreviewForm()` called `exportGuiJson`, which only sees the form currently open
on the canvas. A three-form packet previewed as DV-100 alone — 9 sections instead of
20 — and dropped `formActivations` and `packetMirrors` with the other two forms. It
now routes through `exportProjectGuiJson` whenever `window.projectForms.length > 1`.

That export is `async` (it walks each form with a settle delay), so the preview tab is
now opened **before** the first `await`. A `window.open()` after an await has lost the
user gesture that started it and the browser blocks it as a popup.

### 55 questions shared one checkbox called `yes`, 56 shared one called `no`

Option cells on a plain Yes/No branch are named with the bare word, and `exportGuiJson`
used that as the hidden checkbox id verbatim. `qualifyOptionNameId()` in `library.js`
now prefixes the owning question — `serve_form_dv_110_yes` — but **only for names that
say nothing on their own** (`yes`, `no`, `true`, `false`, `none`, `other`, `unknown`,
`n_a`, `na`).

Do not widen that rule. An earlier attempt qualified anything not sharing two leading
tokens with its question, which rewrote perfectly good names like
`relationship_have_children_together` into
`relationship_to_person_to_restrain_relationship_have_children_together` and broke the
PDF mapping those names were written against.

### Fill maximum path took the branch that skipped a third of the packet

The option scorer counts what becomes visible the instant an option is picked. On
DV-109 that made "Partly Granted and Partly Denied" beat "All Granted Until the Court
Hearing": the first reveals its orders detail immediately, while the second only
reveals *"Must DV-110 be served with this notice?"* — and the whole of DV-110 hangs
off answering that Yes. `activationLookaheadBonus()` now prices an activation at the
size of the form it unlocks, and pays it when a choice merely brings the gate question
into view, so the path toward it gets explored at all.

### Multi-select answers never reached the PDF (three stacked faults)

1. `updateHiddenLogicTriggerOptions()` in `gui.js` read a question's options only from
   `dropdownOptions{id}`. A checkbox question keeps its options in
   `checkboxOptions{id}`, so its trigger list came back empty; import then assigned
   trigger values that did not exist as `<option>`s, **which a `<select>` silently
   discards**, and generation threw the rule away with them. 246 of 323 configs
   survived. Rebuilding the list now also preserves the current selection, because the
   post-bulk-import catch-up runs it a second time.
2. Hidden logic was collected only in the dropdown branch of `getFormHTML()`.
   `collectHiddenLogicConfigs()` is now shared with the checkbox branch.
3. Nothing evaluated a rule against a *set* of answers — `updateHiddenLogic()` compares
   a trigger to one selected value. `syncHiddenLogicForCheckboxQuestions()` handles the
   multi-select case and is bound to `change`, so it works for real users and not just
   during a debug fill.

Also: max fill scored a checkbox group like a radio group and left **one** box ticked.
A checkbox question is multi-select, so the widest path ticks every option that would
not jump to the end or fire a hard alert.

### The missing artifact: `field_config.json` was never saved for these forms

This is the one to remember. The form posted `case_number`; the PDF field is really
called `DV-100[0].Page1[0].rightCaption[0].CaseNumber[0]`. **Zero of 419 names the form
sends matched any of the 575 in the three PDFs.**

`field_config.json` is the only artifact that carries the raw AcroForm path next to the
canonical name, and `pdf-field-sanitizer.js` uses it to rewrite each field's `/T` from
`id` to `newName`. That is why `FormWiz GUI/W9.pdf` has a field literally called
`taxpayer_name` and fills correctly. No DV field config had ever been committed, so no
sanitized DV PDF existed and nothing could match.

The three configs are now in `dv-field-configs/` (321, 30 and 182 fields) and the
sanitized PDFs sit in `FormWiz GUI/`. Eleven DV-110 fields have no question behind them
— the firearm description and location columns, the page-9 clerk block — and are mapped
to their own names so the sanitizer **preserves** them; it keeps only fields listed in
the config and drops the rest.

The DV PDFs are also **encrypted**, not XFA as the paths suggest. `/api/unlock-pdf`
handles that with qpdf. `/edit_pdf` still calls `PDFDocument.load(bytes)` without
`ignoreEncryption`, so it can only fill an already-decrypted (sanitized) PDF.

### The interview asked about the wrong person

The compiler phrased every field as "What is your <field>?" whoever the field was about,
so the animal block asked "What is your breed?", DV-110 asked the filer "What is your
race?" about the restrained person, and three yes/no pairs became the literal questions
"Do you have a no?" and "Do you have yes?". 484 questions reworded from their nameIds;
the 14 still starting "What is your" are genuinely about the person filling the form.

### Where it stands

Maximum path, one run, section-at-a-time + test:

| Form | text fields | checkboxes |
|------|-------------|------------|
| DV-100 | 163 / 163 | 105 / 158 |
| DV-109 | 17 / 17 | 9 / 13 |
| DV-110 | 97 / 108 | 56 / 85 |

Unticked checkboxes are branches the answers ruled out (gender Nonbinary, so not
male/female). **This is not production ready** — see section 8.

---

---

## 5c. September 8, 2026 session — the packet pipeline, and what the DV packet was doing wrong

The whole chain now runs as commands, and running it found that the packet was
asking survivors the court's questions. Read `PIPELINE.md` first; it is the map.

### The pipeline is scripted end to end

| Command | What it does |
|---------|--------------|
| `node pipeline-connect.js` | applies `dv-packet-connections.json` — which fields on different forms hold the same answer |
| `node pipeline-sanitize.js dv110` | rebuilds a sanitized PDF after a field-config edit |
| `node compile-form.js <config> <out> --hints <hints>` | one form's flowchart |
| `node pipeline-build-packet.js` | assembles the project: connectors, one group per form, each form's PDF |
| `node pipeline-audit.js` | the static rules, per form |
| `node pipeline-fill.js --render` | fills the PDFs from a captured answer set, reads every field back, renders pages |
| `node pipeline-explain.js dv110` | why each empty field is empty: branch, court field, or defect |
| `node pipeline-harvest-text.js old.json --write` | rescues authored question wording into the hints |

The one browser step is Import Project JSON → Export Project GUI JSON, and the
debug fill; `/api/dev-save` writes those artifacts back to the repo.

### `courtUse` — the finding that mattered

Every Judicial Council form prints who completes it. DV-109: *"The person asking
for a restraining order must complete items 1 and 2. The court will complete the
rest of this form."* DV-110 says the same for items 1, 2 and 3.

The packet was asking 139 questions no filer can answer — what the judge decided
about each order, the clerk's certificate, which forms to serve. Fields marked
`"courtUse": true` in the field config never become questions. The packet went
from 358 questions to about 145, and DV-109 now asks nothing of its own.

### Ten rules, and the tooling that checks them

`form_quality_check.txt` grew from four rules to ten. New since the last handoff:

- **Rule 5** one group per form, named after the form
- **Rule 6** ask only what the filer completes (`courtUse`)
- **Rule 7** a form that asks nothing still ships — DV-109 has no step, and its
  PDF must still be produced and listed in Preview PDFs
- **Rule 8** one question asks one thing — a PDF box holding two answers is
  asked as two questions and rejoined (`splits` hint + a joined linked-logic node)
- **Rule 9** fields about one subject are one question — an address is one
  question with four boxes (`combines` hint → `multipleTextboxes`)
- **Rule 10** ask for a value in the type it is — date, phone, email, number

Rules 1, 3, 5, 6, 7, 8, 9 and 10 are checked by `pipeline-audit.js`; rule 4 by
`pipeline-fill.js` + `pipeline-explain.js` and a page-by-page read.

### New compiler capabilities (all hint-driven, none form-specific)

| Hint | Effect |
|------|--------|
| `courtUse` on a field config entry | never generate a question for it |
| `splits` | one PDF field asked as several questions, rejoined with a separator |
| `combines` | several PDF fields asked as one `multipleTextboxes` question |
| `repeats` | a numbered family becomes one "how many?" block, `{n}` puts the entry number where the PDF wants it |
| `questions[...].type` | date / phone / email / number instead of a text box |
| `groups[...].labels` | option labels the field names cannot give |

Same-named AcroForm fields now collapse to one question without a hint, and a
section hint that names a family's first field places the block that replaced it.

### Generated-form fixes worth knowing

- **The debug fill was not maximal.** It scored options by counting fields that
  already held a value, so revealing a follow-up scored zero. It now counts what
  an answer puts on screen, shows a progress bar, and yields between questions —
  the run used to freeze the tab for minutes.
  The yield races a frame, a self-posted message and a 50 ms timer: a hidden tab
  gets no frames and clamps timers, and a fill left in the background used to
  stall for minutes at a time. Progress shows as a modal overlay above the debug
  menu — phase, bar and percentage — rather than a word on the button.
- **Both fill buttons** write each field's own id into it, so a
  rendered page can be read against the blank form. That is rule 4b.
- **A composed address overwrote a real answer.** The form builds a convenience
  field `<base>_address` from street, city, state and zip. A question is free to
  own that name — DV-100's mailing address does — and the composer was writing
  "city, ST" over the street the filer typed. Composed fields carry
  `data-address-composite` now, and nothing else is ever written to.
- **`processAllPdfs` crashed** on four variables declared in another function, so
  finishing a packet skipped later PDFs and never showed the completion screen.
- **Preview PDFs listed only the first form** of a packet.
- **A renamed form switched itself off.** A connector stores the name its target
  form had when it was drawn, and the editor renames a project slot from the
  flowchart's own `formName` every time it loads one — so a connector to
  "DV-109" ended up beside a form now called "DV-109 Notice of Court Hearing".
  The runtime matched rule to form on that exact string, found nothing, and
  counted both later forms as never activated: the interview stopped after the
  first form and offered one PDF. The export writes canonical names now, the
  runtime also accepts a name that is the start of the other, and the packet
  builder titles the PDF without renaming the form.
- **Reserved names.** The form generates hidden `court_name`, `court_address`,
  `form_zip`, `current_date` and friends. A question that claims one of those
  names now wins, and the built-in is not emitted — two elements shared an id and
  `getElementById` returned the empty one.
- **Silent field loss.** A field type nobody drew (an `email` box inside a
  combined question) was skipped on import and never rendered. Unknown types now
  fall back to a text box.
- **`{n}` in a node id** puts the entry number where the PDF wants it
  (`firearm_item_3_description`), and `sanitizeNameId` keeps the braces.

### Where the DV packet stands

Rules 1, 2, 4a, 4b, 5, 6, 7, 8, 9, 10 pass. Rule 3 is five of eight numbered
families; the other three carry per-entry checkboxes, which need `{n}` support in
the entry-dropdown id paths. Before filing: run the minimum and typical paths,
finish rule 3, and add DV-140, which DV-100 page 13 lists as required.

---

## 6. Critical workflows

### Preview Form

1. User clicks **Preview Form** → chooses **question style** + **deployment style** (default: **Test**, **One section at a time**).
2. `script.js` → opens the preview tab (before any await, or the popup blocker eats
   it) → `resetAllPdfInheritance()` + `resetAllNodeIds()` → **`exportProjectGuiJson()`
   when the project holds more than one form, otherwise `exportGuiJson()`** →
   localStorage → `FormWiz GUI/gui.html?previewKey=...&questionStyle=...&deploymentStyle=test`.
   The project export walks every form and switches back, so the canvas visibly
   flickers through each one — that is expected.
3. `gui.html` sets `window.__FORM_QUESTION_STYLE__`, `window.__FORM_DEPLOYMENT_STYLE__`, loads JSON, auto-runs `showPreview()`.
4. `generate.js` `getFormHTML()` reads style/deployment and generates HTML + nav behavior.
5. On completion (test mode): **Download Payload** / **Preview PDFs** require dev server (`npm start`).

### Test payload workflow

1. Complete form in test preview → **Download Payload** on thank-you screen.
2. Unzip to `FormWiz GUI/<FormName>/` (folder name = main PDF basename).
3. Serve via `npm start` → open `http://127.0.0.1:8080/FormWiz%20GUI/<FormName>/index.html` for PDF preview/download.

### Export / audit checklist

Before calling a form done:

1. Import flowchart JSON in editor — edges clean, no overlap.
2. **Preview Form** — every dropdown shows flowchart options (not Yes/No unless the question is Yes/No).
3. Run **Ctrl+Shift** → **Fill maximum path** → **Preview PDFs** or **Download PDFs** (dev server must be running).
4. In DevTools Network, confirm `POST /edit_pdf?pdf=W9.pdf` body includes keys matching PDF AcroForm names (`taxpayer_name`, `tax_classification_individual`, etc.).
5. Compiler `auditForm()` output if using `compile-form-schema.js`.
6. `node pipeline-audit-flowchart.js` — the chart itself: reachability, dead ends, stray options, duplicate nodeIds, overlaps, and any node showing a raw field name. The interview audit cannot see these.
7. **Read the interview yourself.** `node pipeline-review.js`
   prints every question in the order a person meets it; read all of them, then
   answer each gate No in the preview and confirm the block behind it goes away.
   `pipeline-audit.js` only finds what it was taught to find, so a green audit
   is not evidence the form is right. See the opening section of
   `form_quality_check.txt`.
8. **Look at the filled PDF, page by page — always, and last.**
   `node audit-pdf-pages.js ./audit 1.6 dv100-filled.pdf ...`, then read every
   PNG. Steps 1-7 all read data: the DOM, the payload, the field dictionary. A
   field can hold exactly the right string and still print in the wrong place,
   or print the form's own decoration back at it. Everything in
   [`PDF-PAGE-AUDIT.md`](./PDF-PAGE-AUDIT.md) was found this way *after* the
   checks above came back clean.

### Wiring a compiled form to its PDF (do not skip the field config)

A flowchart that compiles and previews cleanly still produces a blank PDF until this
is done, and the failure is silent — `/edit_pdf` returns 200 and an untouched form.

1. Get the real field names: decrypt the source PDF (`qpdf --decrypt in.pdf out.pdf`)
   and list `getForm().getFields()`. Judicial Council forms are encrypted, so pdf-lib
   reports 0 fields until you do.
2. Write `<form>-field-config.json`: `{ formTitle, fields: [{ id, newName, type, label }] }`
   where `id` is the raw AcroForm path and `newName` is **the name the generated form
   actually posts** — question `nameId`s and hiddenLogic `nodeId`s, not what you wish
   they were called. Get the real list from the exported GUI JSON.
   *List every field.* The sanitizer drops anything absent; map unknowns to their own
   `id` to keep them.
3. Sanitize: `sanitizePdfFields(bytes, config)` rewrites each `/T` to `newName`. Put
   the result where `findPdfFile` looks — `FormWiz GUI/` wins over the repo root.
4. Point the flowchart at it: `defaultPdfProperties.pdfFile` must be a real filename.
   All three DV flowcharts shipped with the placeholder `"form.pdf"`.
5. Check coverage by name before trusting it, then **verify visually** — matching names
   do not prove values land in the right boxes.

Repeated fields (a case number on nine pages) can share one `newName`; `/edit_pdf`
loops every field, so all nine fill from one answer.

### Compiling a form to a flowchart

Per form, using `compile-form.js` (generic) rather than `compile-form-schema.js`
(W-9 only):

1. **Baseline first.** `node compile-form.js <field_config.txt> out.json` with no
   hints. The audit reports overlaps, edge/node crossings, unreachable nodes and
   missing fields. A clean audit here only means the *geometry* is sound - it says
   nothing about whether the interview reads well.
2. **Diagnose the interview.** Three faults recur, none of which the audit catches:
   - **Raw-PDF-path group names.** An inferred exclusive group is named from the
     shared PDF path (`DV-110[0].Page1[0].OrigAmen`) instead of something readable.
   - **Repeated fields.** One value printed on every page (case number) becomes one
     question per page.
   - **Invented gates.** A `conditional.onlyWhen` naming something that is not a real
     field makes the compiler manufacture a question, usually duplicating a real one
     nearly word for word. Find them by checking every `onlyWhen` against the set of
     `newName`s.
3. **Author `<form>-hints.json`** - `groups` (name and word each exclusive set),
   `mirrors` (collapse repeated fields), `questions` (readable wording, and
   `conditional` retargeted at a real field to kill invented gates), `sections`.
4. **Recompile with `--hints` and require a clean audit.** Question count should drop
   noticeably; DV-109 went 33 -> 25, DV-110 168 -> 147.

### Multi-form packets: compile in packet order, primary first

**Establish packet order before compiling anything.** Read `form_connections.json`
(`forms[].role` and `connections[]`) and compile the primary form first, then each
attached form in dependency order. For the DV packet that is:

```
DV-100  primary, always included
DV-109  attached to DV-100, always included (no triggering field)
DV-110  attached to DV-109, gated on serve_form_dv_110 = checked
```

The reason is shared fields, not aesthetics. The DV packet shares **25** case-number
fields across the three forms, plus the protected/restrained person names, court
address, hearing date and time, and four blocks of other-protected-person details.
Whichever form is compiled first fixes the `nameId` every other form has to mirror.
Compile a leaf form first and the primary form later either inherits a vocabulary
chosen from a lesser form, or you rename across every hints file already written.

Practical sequence:

1. Read `form_connections.json`; note `sharedFields` and the packet order.
2. Compile the **primary** form. Its hints define the canonical `nameId` for every
   shared value (`case_number`, `protected_person_name`, ...).
3. Compile each attached form, reusing those exact names in its `mirrors` and
   `questions` hints.
4. Cross-check that each `sharedFields` entry resolves to the same `nameId` in every
   form that carries it.

`form_connections.json` is written by a chat session and is a **claim, not ground
truth** - validate every field it references against the real `newName`s before
relying on it, and read its `openQuestions`, which is where it admits what it guessed.
On the DV packet only one connection had an actual triggering field
(`serve_form_dv_110`); the DV-100 -> DV-109 link was inferred from form roles alone.

---
## 7. Known constraints & pitfalls

1. **Cell ids vs End nodes** — Never treat numeric ids as End; only `nodeType=end`.
2. **Export through hubs** — `getLogicalOutgoingEdges` / `getLogicalIncomingEdges` in `library.js` must walk merge/split hubs or options export empty.
3. **Question style is preview-only** — passed via URL param + global; default in GUI import path is `section` when previewing from flowchart.
4. **Deployment style** — default **Test** in preview modal; production shows checkout on thank-you screen.
5. **Section consolidation** runs at GUI JSON export time, not in the mxGraph file itself — re-export after flowchart edits.
6. **Mutually exclusive PDF fields** (e.g. W-9 SSN *or* EIN) — “Fill maximum path” picks one branch; it does not fill both columns by design.
7. **PDF fill requires dev server** — `http-server` alone cannot POST `/edit_pdf`; preview may error or PDFs stay blank.
8. **Node IDs must match PDF field names** — `_nameId` on flowchart cells (e.g. `taxpayer_name`) must survive export; do not rely on text-derived ids after `resetAllNodeIds`.
9. **Dropdown options need `_nameId`** for PDF checkboxes — export auto-creates hidden logic; without `_nameId`, mirror checkboxes use label suffixes that do not match AcroForm names.
10. **Firebase / auth** — `auth.js` has substantial changes; preview uses `__FORM_SKIP_SIGNIN_GATE__` in test mode when configured.
11. Desktop copies — compiler also writes `Desktop/w9-flowchart.json`; user may edit outside repo.
12. **`hints.gates` does not merge questions** — it renames a gate the compiler
    invented, but will not make it reuse an existing question. To collapse a
    duplicate, retarget the field's `conditional.onlyWhen` at the real field instead.
13. **A clean audit is not a good interview** — `auditForm()` checks geometry and
    reachability only. Read the question list before calling a form done.
14. **`exportGuiJson` only ever sees the form on the canvas.** For a project use
    `exportProjectGuiJson` (or the four toolbar buttons: *Export Project JSON* to
    round-trip the project, *Export Project GUI JSON* for the merged config; the two
    without "Project" silently give you one form).
15. **Without `field_config.json` nothing fills.** It is the only place the raw
    AcroForm path and the canonical name sit together. Save one per form, in
    `dv-field-configs/`-style, whenever you compile a new packet — the previous
    session compiled three flowcharts and never saved the configs, which cost this
    session most of a day to reconstruct.
16. **The sanitizer keeps only what the config lists.** A field you leave out is
    removed from the PDF, not merely left unfilled. Map unknown fields to their own
    `id` to preserve them.
17. **Setting `<select>.value` to a value with no matching `<option>` fails silently.**
    It leaves the select empty and no error is raised. This is what swallowed every
    checkbox question's hidden logic. If an import "loses" values, check that the
    options were populated before the values were assigned.
18. **A `window.open()` after an `await` is popup-blocked.** Claim the tab before the
    first await and set `location` afterwards.
19. **Judicial Council PDFs are encrypted, not XFA.** The `DV-110[0].Page1[0]...`
    paths look like XFA but pdf-lib reports 0 fields because of encryption. Decrypt
    with qpdf (`/api/unlock-pdf` does this) before reading fields.
20. **`Fill maximum path` is a coverage tool, not a correctness test.** It proves
    fields *can* be filled with "Test Value", not that values land in the right boxes.

---

## 8. Suggested next steps for the new agent

Ordered by what actually blocks shipping the DV packet.

1. **Verify the field mapping visually — this is the blocker.** The 83% / 89% / 81%
   coverage figures measure that *names* match, not that values land in the *right*
   boxes. A swapped pair (height ↔ weight, or the restrained person's address into the
   protected person's block) scores as filled and is wrong. Fill each form with
   per-field marker values (so `person_to_restrain_age` prints as
   `person_to_restrain_age`), render every page, and read them against the blank forms.
   Nothing else on this list matters until this is done.
2. **Test more than the maximum path.** Only the widest path has been run, once. Run
   the minimum path, a typical path, and specifically the branch where DV-110 is *not*
   served — that exercises the activation logic that changed most.
3. **Use realistic answers.** Everything so far is "Test User" / "Test Value" / `100`.
   Real answers bring long text that overflows fixed-width fields, real dates and
   apostrophes in names.
4. **Close the eleven unmapped DV-110 fields** — firearm description and location
   columns, page-9 clerk block. They have no question behind them and file blank.
5. **Fix the three DV-100 yes/no pairs structurally.** `other_protected_people_no` /
   `_yes`, `person_to_restrain_firearms_no` / `_yes`, `live_together_or_close_no` /
   `_yes` are two questions where the form has one. They were reworded, not merged;
   merging needs flowchart surgery.
6. **Have a domestic violence practitioner read the 484 reworded questions.** They were
   rewritten mechanically from nameIds and nobody with practice experience has reviewed
   them.
7. **Audit conditional visibility.** Questions were confirmed to *fill*; no one has
   confirmed each appears under the right conditions across 386 questions.
8. **Test production deployment mode.** Only `deploymentStyle=test` has ever been run.
   Production shows checkout, hides the PDF tools and enforces the sign-in gate that
   was bypassed throughout.
9. **Add regression tests.** Every fix this session was verified by hand. Nothing stops
   the next change reintroducing the `yes`/`no` collision or the dropped hidden logic.
   Good first assertions: no two questions share a hiddenLogic `nodeId`; the project
   export yields 20 sections; a maximum-path fill posts a key for every field name in
   each sanitized PDF.
10. **Packet-level mirroring across forms.** `mirrors` collapses repeats within one
    form; `packetMirrors` (26 entries) handles them across forms at question level.
    `_mirrorTargets` on the flowchart cells is still consumed by nothing.
11. Extend `compile-form-schema.js` beyond W-9 when new schemas arrive.
12. Optionally persist question style and deployment style in exported GUI JSON rather
    than only the preview URL.

## 9. Git & contact context

- **Remote:** `origin` → `https://github.com/Adam01140114/FlowchartCreationTool.git`
- **User expectation:** Flowchart bot owns layout + routing + form quality; human supplies logical schema payloads.
- **Commit before handoff:** All session changes including this `Hand Off/` folder, compiler, W-9 artifacts, and UI/form updates.
- **Also read:** `auto-form/public/Auto-Form-Creator/docs/documentation.txt` — the
  Auto Form Creator pipeline (9 steps, the manual no-API-key path, and why
  `field_config.json` is the artifact that must not be lost). A duplicate copy lives at
  `Auto-Form-Creator/docs/documentation.txt`; keep the two in sync.

---

## 10. File index (this folder)

| File | Description |
|------|-------------|
| `HANDOFF.md` | This document — start here |
| `flowchart_ai_trainer_doc.txt` | Full AI trainer spec — **read before editing flowcharts** |
| `PIPELINE.md` | The packet pipeline: artifacts, commands, the two fill modes |
| `PDF-PAGE-AUDIT.md` | **The last check before shipping** — render the filled PDF and read it |
| `NEW-FORM.md` | **Taking on a new form** — the four artifacts, and writing a hints file |
| `form_quality_check.txt` | The ten rules `pipeline-audit.js` enforces, and why each exists |
| `flowchartfeatures.txt` | Feature reference for the editor |
| `syntax.txt` | The `generate.js` template-literal hazard — read before editing it |
| `save.txt` | Preserving data through all three save paths |
| `dropdown-conversion-instructions.txt` | Standard → searchable dropdowns |
| `section_cleanup_test.md` | Section renumbering when a section empties |
| `html_explanation.txt` | HTML editing inside the editor |
| `system-prompt.txt` | Prompt used for PDF field analysis / renaming |
| `README-MODULAR.md` | Module structure of the editor |
| `FIREBASE_SETUP.md` | Firebase config for the generated forms |
| `documentation.txt`, `fixit.txt` | Older notes, kept for history |

Good luck. Prefer a longer U-shaped detour over a short line through a node — for both wires and skip logic.
