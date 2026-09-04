# Flowchart Creation Tool — Agent Handoff

**Date:** September 2, 2026  
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

## 6. Critical workflows

### Preview Form

1. User clicks **Preview Form** → chooses **question style** + **deployment style** (default: **Test**, **One section at a time**).
2. `script.js` → `resetAllPdfInheritance()` + `resetAllNodeIds()` → `exportGuiJson()` → localStorage → `FormWiz GUI/gui.html?previewKey=...&questionStyle=...&deploymentStyle=test`.
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

---

## 8. Suggested next steps for the new agent

1. Re-read [`flowchart_ai_trainer_doc.txt`](./flowchart_ai_trainer_doc.txt) and run through W-9 Preview + PDF export after pull (**must use `npm start`**).
2. Verify test payload zip → unzip → localhost preview workflow end-to-end.
3. Extend `compile-form-schema.js` beyond W-9 when new schemas arrive (reuse generic router).
5. **Packet-level mirroring is not built yet.** `mirrors` collapses repeated fields
   within one form; the DV case number is 25 fields *across* three. Extending
   `mirrors` across forms would collapse those to one question.
6. **Nothing consumes `_mirrorTargets` yet.** The compiler records every PDF field a
   mirrored answer must reach; the filler still has to be taught to write them.
4. Optionally persist **question style** and **deployment style** in exported GUI JSON (not only preview URL).
5. Add automated test: Fill maximum path → POST `/edit_pdf` → assert PDF field values match exportable HTML field names.
6. Keep **form audit** in the loop — any flowchart change should be validated in Preview Form.

---

## 9. Git & contact context

- **Remote:** `origin` → `https://github.com/Adam01140114/FlowchartCreationTool.git`
- **User expectation:** Flowchart bot owns layout + routing + form quality; human supplies logical schema payloads.
- **Commit before handoff:** All session changes including this `Hand Off/` folder, compiler, W-9 artifacts, and UI/form updates.

---

## 10. File index (this folder)

| File | Description |
|------|-------------|
| `HANDOFF.md` | This document |
| `flowchart_ai_trainer_doc.txt` | Full AI trainer spec — **read before editing flowcharts** |

Good luck. Prefer a longer U-shaped detour over a short line through a node — for both wires and skip logic.
