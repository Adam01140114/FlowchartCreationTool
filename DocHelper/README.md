# DocHelper

A chat that fills out paperwork. A person drops in PDF forms, DocHelper runs them
through the packet pipeline, asks the questions one at a time, and hands back the
PDFs filled in.

```
npm start            ->  http://localhost:8080/DocHelper/
```

## What happens

| Step | What runs | Where |
|---|---|---|
| 1. Drop PDFs, Submit | upload (PDF only) | `server/routes.js` |
| 2. "Analyzing forms" | qpdf unlock, every field listed with its page, box and nearest printed words, pages drawn with every box numbered | `server/pdf-tools.js` |
| 3. Design the interview | **the judgment step**: a field config + hints file per form, and `packet.json` (NEW-FORM.md) - by Claude | `server/ai.js`, or the prompt package |
| 4. Build | field config checked against the PDF, PDF sanitized (`auto-form/pdf-field-sanitizer.js`), interview compiled (`compile-form.js`), wording rules (`wording-rules.js`) | `server/build.js` |
| 5. Questions | the compiled interview walked one question at a time; gates, follow-ups, forms switched on by answers, a question shared by two forms asked once | `interview-walk.js` (page and server share it) |
| 6. Filled PDFs | answers -> field names -> the dev server's own `POST /edit_pdf` (shrink-to-fit, ruled lines) | `server/fill.js` |

Steps 4 and 6 are the repo's own code, not copies. DocHelper replaces only the
browser steps of the pipeline (editor export + `generate.js`) with its chat. The
compiled flowchart is still written for each form
(`sessions/<id>/built/<form>/flowchart.json`), so a form DocHelper designed can be
opened in the editor.

## Step 3 without an API key

The page offers two ways, and watches for both:

1. **Claude Code on this computer** - say *"process the DocHelper inbox"*. The
   skill `.claude/skills/dochelper-inbox/SKILL.md` tells it what to do: read the
   package in `inbox/<session>/`, write the answer to `outbox/<session>/`, check it
   with `node DocHelper/check-output.js <session>`, then create `READY`. The page
   picks it up within a few seconds.
2. **By hand** - *Download package* gives `prompt_package_input.zip` (prompt, PDFs,
   field lists, numbered page images, the hints reference and a shipped example).
   Give it to Claude, ask for `prompt_package_output.zip`, and *Upload response*.
   A single JSON reply (`{ packet, forms: { <form>: { fieldConfig, hints } } }`)
   is accepted too.

The prompt is `prompt/PROMPT.md`. Improve it there: it is the same text for the
package, the inbox and the API.

## With an API key

Put `ANTHROPIC_API_KEY=...` in `.env` and restart. Step 3 then runs by itself,
one form at a time in upload order, each form told the names the earlier ones
chose. `DOCHELPER_MODEL` picks the model (default `claude-opus-5-5`). **This path
has not been run yet** - it was built before there was a key.

## Response format, in short

```
packet.json                       { "title", "forms": [{ "form", "title", "includeWhen"? }] }
forms/<form>/field-config.json    { "formTitle", "fields": [{ "id", "newName", "type", "label", "courtUse"?, "widget"?, "remove"? }] }
forms/<form>/hints.json           compile-form.js hints (Hand Off/NEW-FORM.md)
notes.md                          optional; shown to the person
```

- `courtUse: true` - kept on the paper, never asked.
- `remove: true` - deleted from the filled copy (a form's own on-screen notice, such
  as "press the Clear This Form button").
- `includeWhen` - the form is filled only when one of these answers is given: an
  option's name, a Yes/No question's id, or `"questionId=option"`.
- A field the config leaves out is put back as `courtUse` and reported, since the
  sanitizer would otherwise delete it.

`examples/mc030-response/` is a complete response (MC-030 Declaration), made
through the inbox.

## Files and privacy

`sessions/`, `inbox/` and `outbox/` hold people's PDFs and answers. They are in
`.gitignore` and the server refuses to serve them. Delete a session folder to
delete everything about it.

## An answer too long for its box

Every typed answer is measured before it is accepted (`server/fit.js`,
`POST /api/dochelper/sessions/<id>/check`). If it would not print at 8pt or
larger (`READABLE_MIN`; the filler itself goes down to 6pt), the chat says so -
"the box holds about 34 characters (roughly 6 words), and your answer is 104" -
and offers a version that fits:

- **With an API key:** Claude rewrites it shorter, keeping names, dates and facts.
- **Without one:** the person's own whole sentences, up to the last that fits (or
  as many words as fit, for a one-line box).

Either way the version is measured against the box before it is offered. The
person picks **Use this version**, or **Write my own**, which reopens their text
with a live "312 / 400 characters" counter and checks it again on send.

How it measures: a box drawn over several lines is laid out here with pdf-lib's
own line-breaking rule and the form's printed rules (`ruled-lines.js`) - checked
against `/edit_pdf` on 65 box/length combinations across MC-030 and every
multi-line DV-100 box, 65 agreeing. A one-line box, which the filler may spill
onto ruled lines beneath it, is sent to `/edit_pdf` itself, with every box the
interview will fill marked as taken. Each check takes well under a second.

## What it does not do yet

- **No MC-025 continuation pages.** A long answer is shortened to fit its box
  (above) instead of continuing on an attachment page; the packet pipeline's
  attachment pages are not wired in.
- **Joined boxes are checked as they stand.** A box built from several answers
  (a split name, a joined list) is measured with the answers given so far; one
  that only overflows once a later answer joins it is caught at fill time and
  reported as "too long for its box".
- **Fillable PDFs only.** A scanned or flattened PDF has no fields and is refused
  with a message saying so.
- **No accounts.** A session lives on this machine; answers are kept in the
  browser so a reload resumes, and sent to the server only to fill the PDFs.
