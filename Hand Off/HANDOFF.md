# Flowchart Creation Tool — Agent Handoff

**Date:** September 3, 2026  
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

**Primary spec:** [`flowchart_ai_trainer_doc.txt`](./flowchart_ai_trainer_doc.txt) (copy included in this folder; also at repo root `flowchart_ai_trainer_doc.txt`).

That file defines:

- Role split (human = schema, bot = flowchart + compile)
- Semantic compile rules (mutually exclusive checkboxes → one dropdown, gates, skip paths, merge/split hubs)
- Flowchart JSON shape (`edgeStyle: "curved"`, `sectionPrefs`, waypoints)
- Circuit-board routing rules (orthogonal edges, merge/split hubs, `NODE_GAP`, `fitBox`)
- W-9 worked example and pre-ship checklist
- **Preview Form audit:** every dropdown must list flowchart option labels — empty options must not silently become Yes/No

Treat the trainer doc as the source of truth for flowchart bot behavior.

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
| `flowchart_ai_trainer_doc.txt` | AI trainer spec (duplicate in `Hand Off/`) |
| `w9-flowchart.json` | Latest compiled W-9 flowchart |
| `_w9_payload/` | W-9 logical schema (`field_config.txt`) |
| `project-gui-export.js` | **Project-level GUI JSON** — merges every form, builds `projectForms` / `formActivations` / `packetMirrors` |
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

- **Fill maximum path** — fills form for worst-case PDF coverage: avoids jump-to-end and hard alerts, maxes numbered dropdowns, prefers branches that reveal more fields, 8 passes with hidden checkbox sync.

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
| `HANDOFF.md` | This document |
| `flowchart_ai_trainer_doc.txt` | Full AI trainer spec — **read before editing flowcharts** |

Good luck. Prefer a longer U-shaped detour over a short line through a node — for both wires and skip logic.
