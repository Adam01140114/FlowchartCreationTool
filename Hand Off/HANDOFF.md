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

FormWiz GUI (form preview/builder):

```powershell
npm run start:gui
```

Or via main app: **Preview Form** opens `FormWiz GUI/gui.html?previewKey=...` in a new tab.

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
| `flowchart_ai_trainer_doc.txt` | AI trainer spec (duplicate in `Hand Off/`) |
| `w9-flowchart.json` | Latest compiled W-9 flowchart |
| `_w9_payload/` | W-9 logical schema (`field_config.txt`) |

### FormWiz GUI (generated form)

| File | Purpose |
|------|---------|
| `FormWiz GUI/gui.html` | Loads preview JSON; sets `window.__FORM_QUESTION_STYLE__` |
| `FormWiz GUI/generate.js` | **Form HTML generator** — question styles, section cards, debug menu, nav |
| `FormWiz GUI/generate.css` / `generate2.css` | Form + stepper styles |
| `FormWiz GUI/download.js` | `showPreview()`, import/export |

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

---

## 6. Critical workflows

### Preview Form

1. User clicks **Preview Form** → chooses question style.
2. `script.js` → `exportGuiJson()` → localStorage → `FormWiz GUI/gui.html?previewKey=...&questionStyle=section|question|all`.
3. `gui.html` sets `window.__FORM_QUESTION_STYLE__`, loads JSON, auto-runs `showPreview()`.
4. `generate.js` `getFormHTML()` reads style and generates HTML + nav behavior.

### Export / audit checklist

Before calling a form done:

1. Import flowchart JSON in editor — edges clean, no overlap.
2. **Preview Form** — every dropdown shows flowchart options (not Yes/No unless the question is Yes/No).
3. Run **Ctrl+Shift** → **Fill maximum path** → export PDF / inspect field coverage.
4. Compiler `auditForm()` output if using `compile-form-schema.js`.

---

## 7. Known constraints & pitfalls

1. **Cell ids vs End nodes** — Never treat numeric ids as End; only `nodeType=end`.
2. **Export through hubs** — `getLogicalOutgoingEdges` / `getLogicalIncomingEdges` in `library.js` must walk merge/split hubs or options export empty.
3. **Question style is preview-only** — passed via URL param + global; default in GUI import path is `section` when previewing from flowchart.
4. **Section consolidation** runs at GUI JSON export time, not in the mxGraph file itself — re-export after flowchart edits.
5. **Mutually exclusive PDF fields** (e.g. W-9 SSN *or* EIN) — “Fill maximum path” picks one branch; it does not fill both columns by design.
6. **Firebase / auth** — `auth.js` has substantial changes; preview uses `__FORM_SKIP_SIGNIN_GATE__` when configured.
7. Desktop copies — compiler also writes `Desktop/w9-flowchart.json`; user may edit outside repo.

---

## 8. Suggested next steps for the new agent

1. Re-read [`flowchart_ai_trainer_doc.txt`](./flowchart_ai_trainer_doc.txt) and run through W-9 Preview + PDF export after pull.
2. Extend `compile-form-schema.js` beyond W-9 when new schemas arrive (reuse generic router).
3. Optionally persist **question style** in exported GUI JSON (not only preview URL).
4. Add automated test or script that runs Fill maximum path + counts exportable fields vs PDF field list.
5. Keep **form audit** in the loop — any flowchart change should be validated in Preview Form.

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
