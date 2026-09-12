# Working on the Flowchart Creation Tool

**For every AI agent working on this repository, Claude or otherwise.** Read this
file first. It is short on purpose: it says what never to do, how the user
works, what "done" means, and where the real documentation is.

The project turns court PDFs into guided online interviews. The flowchart
editor (`index.html`) builds a form's interview as a flowchart; that compiles to
a GUI JSON; `FormWiz GUI/generate.js` turns the JSON into an HTML form; the
filer's answers fill the PDFs through the dev server. The current work is the
California domestic violence restraining order packet (DV-100 with DV-101,
DV-105, DV-108, DV-140, CLETS-001, DV-109, DV-110).

---

## Read, in this order

1. **This file.**
2. [`Hand Off/HANDOFF.md`](Hand%20Off/HANDOFF.md) - the project, the repository
   map, and the rules the code does not state.
3. [`Hand Off/AUDIT.md`](Hand%20Off/AUDIT.md) - **how every change is checked**:
   the full audit, the safety rules for testing with the user's data, how to test
   a feature by hand without fooling yourself, and the incident log.
4. [`Hand Off/PIPELINE.md`](Hand%20Off/PIPELINE.md) - the packet pipeline,
   artifact by artifact, and the story behind each rule.
5. [`form-rules.html`](form-rules.html) (open it at
   `http://localhost:8080/form-rules.html`) - every rule: what it requires, why
   it exists, and what enforces it.
6. As the task needs it: [`Hand Off/NEW-FORM.md`](Hand%20Off/NEW-FORM.md) (a new
   form), [`Hand Off/PDF-PAGE-AUDIT.md`](Hand%20Off/PDF-PAGE-AUDIT.md) (reading
   the printed pages), [`Hand Off/syntax.txt`](Hand%20Off/syntax.txt) (**before
   editing the runtime in `generate.js`**), the publish skill
   [`.claude/skills/publish-live-site/SKILL.md`](.claude/skills/publish-live-site/SKILL.md).

---

## Never

- **Never touch the user's saved answers.** The test account's saved copy under
  formId `DV-100 Request for Domestic Violence Restraining Order` is theirs:
  never delete or overwrite it. Browser tests stub Firestore writes, or use the
  published site (no Firebase) or `pipeline-nav-audit.js` (throwaway profile).
- **Never sign in with credentials**, never write code that reads credentials
  from `.env` to sign in, and never put a credential in a file.
- **Never leave the browser draft changed.** Filling a form writes the user's
  `localStorage` draft. Back it up and restore it exactly as
  [`AUDIT.md` §0](Hand%20Off/AUDIT.md) says.
- **Never answer the editor's "Pick up where you left off?" modal.**
- **Never edit generated output to fix something.** `*-flowchart.json`,
  `dv-packet-project.json`, `dv-packet-gui.json` and `live-sites/` are rebuilt
  from the hints, field configs and code; an edit there is lost at the next
  build. Fix the source.
- **Never write a rule for one form.** Every fix is general (rule `no-hard-coding`).
- **Never commit or push unless the user asks.** Never force-push `main`.
- **Never hand-edit `FormWiz GUI/CountyLookup/zipData.js`** - regenerate it with
  `node "FormWiz GUI/CountyLookup/build-zip-data.js"`. `FormWiz GUI/CountyLookup/` is copied by hand into a
  separate repo (`Desktop/Finance Forms/blue/public/CountyLookup`, GitHub
  adam01140/blue); after changing it, copy the folder there and confirm with
  `diff -rq`.
- **Never claim a check you did not run**, or describe a result you did not see.

---

## How the user works

- Requests are short. Take the obvious reading, do it, and say what you did.
- **"Run this"** about the project or site means publish the live site (the
  publish-live-site skill) and hand back the link.
- **"Git push to main"** means commit everything the session changed and push -
  **including `live-sites/` and `auto-form/`**, which must never be left out. End
  the commit message with the attribution line your harness specifies.
- **"Do a full audit"** means all of [`AUDIT.md` §3](Hand%20Off/AUDIT.md), in
  order, then a report with numbers.
- When something the user finds got past you, they will ask how you missed it.
  Answer plainly: what you checked, what they saw, and where the two differ.
  Then close the gap for good: a fix, an automated check that fails on the old
  build, a rule in `form-rules.html`, and the account in `PIPELINE.md` and the
  `AUDIT.md` incident log ([`AUDIT.md` §6](Hand%20Off/AUDIT.md)).
- Explanations should be plain English. The user reads the result, not the code.

---

## Done means

1. The sources changed, and every artifact downstream was rebuilt in order
   ([`AUDIT.md` §2](Hand%20Off/AUDIT.md)).
2. The audit for that kind of change passed ([`AUDIT.md` §1](Hand%20Off/AUDIT.md)).
3. **You used the feature the way the user will** - the real button, in the
   real state, and you looked at what it drew ([`AUDIT.md` §4](Hand%20Off/AUDIT.md)).
4. Anything you learned the hard way is written into the docs, where the next
   agent will find it.
5. You reported what you ran, what it found, and what you did not do.

---

## Traps that each cost a session

- `generate.js` emits the form's runtime inside giant template literals: no
  backticks, no `${`, no backslashes in that code (`Hand Off/syntax.txt`).
- Export the GUI JSON from a **freshly loaded** editor tab, and wait for the
  builder before reading it back ([`AUDIT.md` §2](Hand%20Off/AUDIT.md)).
- Restart the dev server after editing `dev-server.js`; nothing changes until you do.
- `isOptions` is defined twice (`library.js` and `script.js`, which wins); grep
  for other definitions before editing a shared function name.
- A tab nobody is looking at does not render; a `window.open()` after an
  `await` is popup-blocked.
- Checks that read data pass on pages and PDFs that are wrong. See the incident
  log in [`AUDIT.md` §8](Hand%20Off/AUDIT.md) before trusting a green run.

---

## Working alongside other agents

Several agents may work here at once. They share one machine, one dev server
(port 8080), one set of generated artifacts and one live site.

- **One build at a time.** Publishing replaces `live-sites/<name>/` wholesale.
  Do not publish while another agent's nav audit or browser test is running,
  and do not take timing measurements while a build runs; if you must, say so
  in the report.
- **The dev server is shared.** Restarting it interrupts everyone using it.
  Restart only when you changed `dev-server.js`, and only when no one else is
  mid-run.
- **Re-read a file immediately before editing it** - another agent may have
  changed it since you last looked. Keep changes scoped to your task.
- **Generated artifacts are rebuilt from sources.** When two agents change
  sources, rebuild once after both land, then audit once.
- **Before pushing**, pull and rebase onto `main`, rebuild if sources changed
  under you, and run the audit again.
- **The browser draft backup is per browser profile and per origin.** An agent
  using its own browser follows [`AUDIT.md` §0](Hand%20Off/AUDIT.md) in that
  browser.
- **Write lessons into the docs, not only into your own memory.** Another agent
  cannot read your memory; it can read `AUDIT.md`.

---

## Where things are

| | |
|---|---|
| Dev server | `npm start` -> `http://localhost:8080` (editor at `/index.html`, form builder at `/FormWiz%20GUI/gui.html`, rules at `/form-rules.html`) |
| Published form | `/form/<projectId>/section.html?saved=<stamp>` (project `p_mtumpmov7t2gh0`, set in `dv-packet.spec.json`) |
| Static audits | `npm run audit` |
| Published-site audit | `npm run audit:nav` (`pipeline-nav-audit.js`) |
| Every script | [`AUDIT.md` §9](Hand%20Off/AUDIT.md) |
