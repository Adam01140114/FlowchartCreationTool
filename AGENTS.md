# Working on the Flowchart Creation Tool

**For every AI agent working on this repository, Claude or otherwise.** Read this
file first. It is short on purpose: it says what never to do, how the user
works, what "done" means, and where the real documentation is.

The project turns court PDFs into guided online interviews. The flowchart
editor (`index.html`) builds a form's interview as a flowchart; that compiles to
a GUI JSON; `FormWiz GUI/generate.js` turns the JSON into an HTML form; the
filer's answers fill the PDFs through the dev server. The current work is the
California domestic violence restraining order packet for a first filing -
exactly the sixteen forms in `scope` in `dv-packet.spec.json` and
[`Hand Off/FORMS.md`](Hand%20Off/FORMS.md): DV-100, CLETS-001, DV-109, DV-110,
DV-105, DV-105(A), DV-108, DV-140, DV-145, FL-150, FL-155, DV-160, DV-165,
MC-025, MC-030, MC-031. Nothing else goes in without the user saying so.
Anything that needs more space continues on MC-025 (rule
`the-packet-uses-mc025-for-more-space`).

A second project stands on its own: California DOJ **BCIA 8016**, Request for
Live Scan Service (`bcia8016.spec.json` -> `bcia8016-project.json`, project
`p_bcia8016_livescan`, published as `live-sites/request-for-live-scan-service`).
Its files are named after its spec, and the commands to build and check it are
in [`Hand Off/NEW-FORM.md`](Hand%20Off/NEW-FORM.md), "A project of its own".

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
6. [`Hand Off/FORMS.md`](Hand%20Off/FORMS.md) - every form in the domestic
   violence process, who completes it, and whether the packet makes it. The
   packet must cover every document the filer needs; nothing may tell them to
   get a form themselves.
7. As the task needs it: [`Hand Off/NEW-FORM.md`](Hand%20Off/NEW-FORM.md) (a new
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
  A test-mode page never loads Firebase: test mode checks that a form is built
  right, and nothing typed into it is meant to be saved.
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
- **Never send the filer for a form.** Nothing the interview says tells them to
  get, fill in or attach a form themselves: every form the paper asks the filer
  for is brought into the packet and filled (rules
  `the-packet-makes-every-form-the-paper-asks-for` and
  `the-interview-never-sends-the-filer-for-a-form`). `pipeline-form-refs.js`
  lists what the paper asks for, and the forms the packet does not make yet.
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
- **Every link you give the user uses `https://onbase-demo.tail7f705f.ts.net/`**,
  never `http://localhost:8080/` - same path, different host. The user follows
  along from devices where localhost does not reach the dev server. This Mac is
  `onbase-demo`: `tailscale serve` forwards that host (tailnet only) to
  `http://127.0.0.1:8080`. Tailscale runs in userspace mode, so this Mac cannot
  look up its own `ts.net` name, and a curl of the tailnet link from here always
  fails - that does not mean the link is broken. Check a link by fetching the
  same path on `127.0.0.1:8080`, and the mapping with
  `tailscale --socket=/Users/platnm/.tailscale-userspace/tailscaled.sock serve status`.
  Never change the Tailscale settings.
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
- Two fill runs that agree can agree on the same mistake. The publish keeps a
  recorded path only at the fewest empty required boxes (`emptyRequiredFields`
  in `live-site-builder.js`), and warns in the builder console when one stays
  empty. After a publish, compare each page's recorded maximum value count - a
  page far below the other lost something.
- A page with a saved draft restores it on timers for seconds after it loads.
  Anything that writes the form must survive a restore landing after it - the
  debug fills are guarded by `window.__fwDebugFillRan`.
- A box on the paper holds what it holds. The server shrinks an answer to fit,
  down to 6pt, and `pipeline-fill.js` fails on one that still does not.
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
| Public site (Render, `https://formwiz.onrender.com`) | `node server.js`: the dev server in public mode (`FORMWIZ_PUBLIC=1`). It answers only the published forms (`/form/<site name or projectId>/...`), `POST /edit_pdf`, the read-only flowchart view the forms' "View flowchart" button opens (`/flowchart/<project>`), and a list of the forms at `/` - everything else is 404 (`publicAllows` in `dev-server.js`). Render deploys `main` and runs `node server.js`; `npm start` is the private server with everything |
| Static audits | `npm run audit` |
| Every form the paperwork mentions, and what covers it | `node pipeline-form-refs.js` (in `npm run audit` as `--check`) |
| A court form's blank PDF | [`Hand Off/NEW-FORM.md` §0](Hand%20Off/NEW-FORM.md) - `curl` from courts.ca.gov; the user has given standing permission to download PDFs |
| Published-site audit | `npm run audit:nav` (`pipeline-nav-audit.js`) |
| Every script | [`AUDIT.md` §9](Hand%20Off/AUDIT.md) |
| A full audit and docs refresh | [`update_docs_and_audit.txt`](update_docs_and_audit.txt) - the user pastes it as a prompt; follow it end to end |
