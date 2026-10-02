---
name: dochelper-inbox
description: Process the DocHelper inbox - design the interview (field config + hints + packet.json) for PDFs a person dropped into DocHelper, acting as DocHelper's "makeshift API" when there is no API key. Use when the user says "process the DocHelper inbox", "do the DocHelper package", hands you a prompt_package_input.zip, or asks for a prompt_package_output.zip.
---

# Process the DocHelper inbox

DocHelper (`DocHelper/`, page at `/DocHelper/` on the dev server) takes PDFs, asks
the filer questions in a chat, and fills the PDFs. The one step that needs
judgment - naming each PDF field and designing the interview - is done by Claude.
With no API key, DocHelper writes a **prompt package** and waits; you are the API.

## Find the work

- Pending sessions: `DocHelper/inbox/<session-id>/` that has no
  `DocHelper/outbox/<session-id>/READY`. Each holds the package unzipped
  (`PROMPT.md`, `request.json`, `forms/<form>/...`, `reference/...`) and
  `prompt_package_input.zip`.
- If the user handed you a `prompt_package_input.zip` instead, unzip it to a
  scratch folder and work from there; your answer is a `prompt_package_output.zip`
  they upload in DocHelper.

## Do the work

1. Read `PROMPT.md` in full - it is the spec. Then `reference/NEW-FORM.md` and the
   BCIA 8016 example in `reference/`.
2. For each form in `request.json`: **look at every page image** in
   `forms/<form>/pages/` (boxes are outlined and numbered by their `index` in
   `fields.json`), read `page-text.txt` for who completes what, and read
   `fields.json`.
3. Write, in `DocHelper/outbox/<session-id>/`:
   - `forms/<form>/field-config.json` - every field except push buttons and
     signatures, `courtUse: true` on anything the filer does not complete
   - `forms/<form>/hints.json` - sections, order, question wording, groups,
     combines, splits, gates, autofill
   - `packet.json` - form order and `includeWhen`
   - `notes.md` (optional) - what the person should know
4. Check it builds and read the interview it produces:

   ```bash
   node DocHelper/check-output.js <session-id>
   ```

   Fix every `ERROR` and every wording `problem`, and read the printed interview
   the way the filer will meet it: one thing per question, full sentences, no
   "if" in a question, gates closing what they should.
5. **Only then** create the empty file `DocHelper/outbox/<session-id>/READY`.
   The DocHelper page polls for it and continues by itself within a few seconds.
   Writing READY last matters: the server reads the folder the moment it appears.

For a hand-carried package, zip the same files (paths at the zip's root) as
`prompt_package_output.zip` and give the user its path.

## Report

Say which session and forms you did, the question count per form, any field you
were unsure of, and anything in `notes.md`.
