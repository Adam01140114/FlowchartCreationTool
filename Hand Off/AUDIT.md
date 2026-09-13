# The audit playbook

**Read this before calling any change done.** It is the complete procedure for
checking this project: what to run, in what order, what each check proves, what
it cannot see, and how to test in the browser without fooling yourself. Every
agent working on this repo follows it, and every rule in it was learned from a
defect that got past the checks before it existed (§8).

The one principle the rest of this file serves:

> **Judge the work by what the filer and the court will see, found by doing
> what they do.** A check that reads data - a field's value, a JSON file, a
> payload - is evidence that the data is right. It is not evidence that the
> page, the button or the printed PDF is right.

Related: [`HANDOFF.md`](./HANDOFF.md) (the project), [`PIPELINE.md`](./PIPELINE.md)
(the packet pipeline and the story behind each rule),
[`PDF-PAGE-AUDIT.md`](./PDF-PAGE-AUDIT.md) (reading the printed pages),
[`../form-rules.html`](../form-rules.html) (every rule, one page, each addressable
by id), [`../AGENTS.md`](../AGENTS.md) (the rules every agent follows),
[`../update_docs_and_audit.txt`](../update_docs_and_audit.txt) (the prompt that
runs this whole audit and a documentation update in any session).

---

## 0. Safety rules for anyone who tests

These protect the user's own data. Break one and you have destroyed something
that cannot be rebuilt.

1. **The user's saved answers are theirs.** The test account holds a saved copy
   of the DV packet in Firestore under formId
   `DV-100 Request for Domestic Violence Restraining Order`. Never delete it,
   overwrite it, or run anything that saves over it. A page in the editor's
   preview (`FormWiz GUI/gui.html`) can be signed in; stub Firestore writes
   before filling there. The published live site has Firebase stripped out, and
   `pipeline-nav-audit.js` uses a throwaway Chrome profile - prefer those.
2. **Never sign in with credentials.** Do not type the test account's password,
   do not write code that reads credentials from `.env` to sign in, and do not
   paste credentials into any doc. If a task needs a signed-in page, ask the user.
3. **Back up and restore the browser draft.** A generated form saves its answers
   to `localStorage` as it fills, under
   `formData_DV-100 Request for Domestic Violence Restraining Order`, and the
   user's own draft lives in that same key. Storage is per origin:
   `http://localhost:8080` and `http://127.0.0.1:8080` are two different stores.
   Before the first browser test, make sure a backup exists; after every test
   that loads or fills a form, restore it and verify the length. The backup is
   in IndexedDB database `claude_ls_backup`, store `b`, key `audit`, as a
   `{ key: value }` snapshot of all of localStorage:

   ```js
   // Take the backup ONLY if it does not exist yet, and only from the user's
   // untouched draft. Re-taking it after a test saves test answers as theirs.
   const open = () => new Promise((res, rej) => {
     const r = indexedDB.open('claude_ls_backup', 1);
     r.onupgradeneeded = () => r.result.createObjectStore('b');
     r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
   });
   const db = await open();
   const existing = await new Promise((res) => {
     const g = db.transaction('b').objectStore('b').get('audit');
     g.onsuccess = () => res(g.result); g.onerror = () => res(undefined);
   });
   if (!existing) {
     const snap = {};
     for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
     await new Promise((res) => { const tx = db.transaction('b', 'readwrite'); tx.objectStore('b').put(snap, 'audit'); tx.oncomplete = res; });
   }

   // Restore - after every test that loads or fills a form.
   const K = 'formData_DV-100 Request for Domestic Violence Restraining Order';
   const backup = await new Promise((res) => {
     const g = db.transaction('b').objectStore('b').get('audit');
     g.onsuccess = () => res(g.result);
   });
   localStorage.setItem(K, backup[K]);
   localStorage.getItem(K).length === backup[K].length;   // must be true
   ```

4. **Do not answer the editor's "Pick up where you left off?" modal.** Yes or No
   both change the user's autosave. Leave it alone.
5. **`POST /api/dev-save` takes `{ name, data }` with `data` as the parsed
   object**, never a JSON string - a string is written as a quoted blob.
6. **Commit and push only when the user asks.** When they say "git push to
   main", commit everything the session changed - including `live-sites/` and
   `auto-form/`, which the user has said must never be left out - and use the
   commit attribution your harness specifies.

---

## 1. When to run what

| You changed | Rebuild (§2) | Then run |
|---|---|---|
| A hints file, field config, compiler (`compile-form.js`), `library.js` export, or `pipeline-build-packet.js` | From the compile step | The full audit (§3) |
| The generated form's runtime (`FormWiz GUI/generate.js`, `download.js`) | Publish only | §3 steps 7-8, then test the feature by hand (§4) |
| The dev server (`dev-server.js`) | Restart the server in place | Whatever the route serves, by hand, with `curl` or the browser |
| The editor UI (`index.html`, `script.js`, editor modules) | Nothing | Click the feature in a freshly loaded editor (§4) |
| Docs only | Nothing | Nothing - but check links and commands you cite actually exist |

"Do a full audit" from the user means **all of §3, in order, and a report (§7)**.

---

## 2. The chain, and rebuilding it in order

Each artifact is generated from the one before it. Edit the source, never the
output - an edit to generated JSON is lost at the next build (rule
`survive-a-rebuild`).

```
<form>-hints.json + dv-field-configs/<form>-field-config.json      (you write these)
  -> node compile-form.js <config> <form>-flowchart.json --hints <form>-hints.json
  -> node pipeline-build-packet.js            -> dv-packet-project.json
  -> editor: applyProjectJson + exportProjectGuiJson(false)  -> dv-packet-gui.json
  -> publish (the publish-live-site skill)    -> live-sites/<name>/  + fill paths
```

- **Export the GUI JSON from a freshly loaded editor tab.** In the Browser pane
  open `http://localhost:8080/index.html`, run
  `applyProjectJson(await (await fetch('/dv-packet-project.json')).text())`,
  **wait for the builder** (a few seconds - rule `wait-for-the-builder`), then
  `exportProjectGuiJson(false)` and POST the parsed result to `/api/dev-save`
  as `{ name: 'dv-packet-gui.json', data }`. A tab that had been open through
  earlier edits once exported activations for forms that no longer existed;
  `pipeline-audit.js` RULE 7 now fails dead activations, but the fix is a fresh tab.
- **The project id** (`p_mtumpmov7t2gh0`) lives in `dv-packet.spec.json`, which
  the build reads first. It keys the editor library, the live-site folder and
  every form link. Kept only in build output, it was lost once and the site
  landed in a second folder.
- **Publishing** (`.claude/skills/publish-live-site/SKILL.md`) generates the
  pages in `FormWiz GUI/gui.html` via `live-site-builder.js`, and the dev
  server writes `live-sites/<name>/`. It also **records the Fill minimum path
  and Fill maximum path results** (`fillPaths` in the GUI JSON,
  `window.__BAKED_FILLS__` in the pages): each path is run in a hidden frame,
  up to five times, and kept when two runs agree *and* leave the fewest
  required boxes on shown questions empty - two runs once agreed on a question
  page with all 180 repeating-block entries blank. A `[live site] ... leaves N
  required field(s) empty` or `No two ... fills agreed` warning in the builder
  console is a finding. A build takes 1-4 min. After any
  change to the questions, publish again - a page whose form logic no longer
  matches its recording ignores the recording and works the path out (slower,
  still correct).
- **Links**: `http://localhost:8080/form/<projectId>/section.html?saved=<stamp>`
  (and `question.html`). The stamp is the save's moment (`9-12-26_12-34pm`); a
  link with no stamp or an old one redirects to the newest build, so the address
  bar always names the build on screen. Only the newest build is kept.
- **Restart the dev server after editing `dev-server.js`** (Browser pane:
  `preview_stop`, then `preview_start` with name `flowchart-dev`; or `npm start`).

---

## 3. The full audit, in order

Run from the repo root with the dev server up. `npm run audit` runs steps 1-5
in one go and stops at the first failure; each also runs on its own.

| # | Command | Proves | Cannot see |
|---|---|---|---|
| 1 | `node pipeline-connect.js --check` | Cross-form identity: a value shared between forms has one name everywhere | Whether a share is intended - a shared name *is* the wiring |
| 2 | `node pipeline-audit-flowchart.js` | The flowchart graph: reachability, dead ends, stray options, duplicate nodeIds, overlaps, raw field names on nodes | Whether the interview reads well |
| 3 | `node wording-rules.js` | The wording patterns the audit uses still catch their own test cases | Anything about this packet |
| 4 | `node pipeline-audit.js` | The interview rules (below). **Exit 1 = not shippable** | What it was never taught (§8 is the list of what it was taught, and when) |
| 5 | `node pipeline-disqualifiers.js --check` | Every disqualifying combination the paper form declares has an alert node | Disqualifiers nobody declared - run `--scan` on a new form |
| 6 | Publish (§2) | The pages you are about to test are the pages that exist | - |
| 7 | `node pipeline-nav-audit.js` | The published site, driven in headless Chrome like a person (below) | Question-at-a-time mode unless `--modes section,question` |
| 8 | Fill and read back: capture the answers, then `node pipeline-fill.js --render` and `node pipeline-explain.js <form>` | Every field the answers reach carries a value; `pipeline-explain` sorts each empty field into gate-closed, court's, or **defect** - the defect list must be empty | Where the ink lands - step 10 |
| 9 | `node pipeline-review.js`, then answer the form in the preview | The interview, read end to end as a person meets it; each gate answered No really closes its block | Nothing - this is the human read. **Not optional** |
| 10 | `node audit-pdf-pages.js ./audit 1.6 <filled.pdf ...>`, then read every PNG | What the court reads | Nothing - this is the last check. **Not optional.** See [`PDF-PAGE-AUDIT.md`](./PDF-PAGE-AUDIT.md) |

When field configs or PDFs change, also run `node pipeline-sanitize.js --check`
(what a rebuild of the sanitized PDFs would change, writing nothing) and
`node pipeline-capacity.js` (what each box holds).

### Step 4 in detail: `pipeline-audit.js`

It prints one block per rule. The rule numbers match `form-rules.html`.

| Printed as | Blocking (exit 1) |
|---|---|
| RULE 1 - every PDF field reachable | no - but every unreached field is a defect to explain |
| RULE 2 - nothing a person reads is a field name (and the cornerstone wording: a question never carries its condition) | **yes** (the wording part) |
| RULE 3 - repeated entries use a block | no |
| RULE 7 - a form that asks nothing still ships (and no dead activations) | **yes** |
| RULE 8 - one question asks one thing | **yes** (compound questions) |
| RULE 9 / 11 / 12 / 13 - subject grouping, say what to enter, narratives, "need more space" boxes | no |
| RULE 10 - ask for a value in the type it is | **yes** |
| RULE 14 - every question title is a full sentence | **yes** |
| RULE 15 - optional is coded, never said | **yes** |
| ORDERING - no question waits on one that comes after it | no - read it |
| JUMPS - every jump lands on a section that exists | **yes** |
| RULE 17 - short section names; titles speak to the filer | **yes** |
| RULE 18 - a form an answer brings in gets its data whenever that answer is given | **yes** |
| RULE 5 - one group per form, named after the form | no |

The last line reads `NOT SHIPPABLE - <rules>` when a blocking rule fails. A
non-blocking finding is not noise: it is a list of things to look at, and
"passes" on a non-blocking rule is still only what that rule was taught.

### Step 7 in detail: `pipeline-nav-audit.js`

For each fill path (minimum, then maximum) it opens the published section page
in a fresh headless tab with empty storage and:

1. **Runs the worked-out fill** in a tab of its own - the reference.
2. **Presses the real button**: opens the debug menu (`showDebugMenu()`) and
   clicks Fill minimum/maximum path, the way a person does.
3. **Times it** against `--fill-budget` (3000 ms).
4. **Waits 3 s and checks nothing the fill wrote is gone** - pages do deferred
   work after a burst of changes.
5. **Compares the page against the reference**: every answer - hidden fields
   included, since the page derives them from what is typed and they reach the
   PDF (unticked, empty and absent count as equal) - every element's classes and
   display state, and which sections are reachable. An element on one page
   only that draws nothing (display:none) is not a difference, and neither is
   where a question-at-a-time section's pointer stopped (question-step-hidden). A difference counts only if a second reference
   run shows it too - the worked-out fill occasionally races the page.
   Sections the answers switched off, and invisible plumbing outside every
   section, are not compared for existence (their values still are).
6. **Walks Next to the last section**, and on every section it passes lists any
   field on a shown question that is **empty as drawn** - a value painted
   transparent or hidden counts as empty.
7. **Walks Back to the first section** and requires Back to retrace Next: same
   sections in reverse, none twice, none in a form that is not in the packet.
   On the thank-you screen, Back must return to the last section.
8. **Does it again on a page that restored a saved draft**: a third tab puts
   the other path's recorded answers in storage as a draft, loads the page, and
   presses the button half a second later, while the restore's timers are still
   running. Anything the fill wrote that is gone eight seconds later fails -
   a returning filer's page, where a restore once landed over the fill and
   emptied every repeating block.

Output: `passes|FAILS <mode> page, <path> path   fill 1.6 s, 11 sections forward,
11 back`, then the Next and Back paths, then one line per problem. The last line
is `NOT SHIPPABLE - N paths failed` or `The fill buttons are quick and complete,
and Back retraces Next on every path walked`. Exit 1 on any failure. A run takes
3-4 minutes. Flags: `--site`, `--server`, `--modes section,question`,
`--paths minimum,maximum`, `--fill-budget <ms>`.

### Step 8 in detail: capturing the answers

`pipeline-fill.js` fills the PDFs from `pipeline-answers.json` - the answers a
debug fill posted, saved from the generated form. Fill the form (debug menu,
Ctrl+Shift, Fill maximum path), capture the payload, save it with
`/api/dev-save`, then run `pipeline-fill.js --render`. It writes the filled PDFs
and page images to `pipeline-out/`. `node pipeline-current-output.js` publishes
the exact images you read into `Current Form Output/`, so the user sees the
same pages you did; `node pipeline-crop.js <pdf> <page> --field <name>` zooms
into one box when a page-scale image cannot show whether text sits on its line.

The dev server sets an answer too long for its box smaller, down to 6pt, and
says so; `pipeline-fill.js` prints what it shrank and **fails (exit 1) on any
answer that does not fit even at 6pt** - lost ink that no value check can see.
A marker cut to fit a small box keeps the end of the field's name (`~color`),
which is the part that tells one column from the next.

---

## 4. Testing a feature in the browser without fooling yourself

The checks in §3 are regression tests. A new feature has none yet, so it is
tested by hand - and by hand is where this project's worst misses happened.
Every item below is here because skipping it let a defect reach the user.

1. **Do what the person does, in the state they will be in.** Click the real
   control, not the function behind it. Have open whatever they will have open
   (the debug menu is open whenever its buttons are pressed). Use a fresh load of
   the page they will use - the published link, after the save. Remember their
   origin may differ from yours (`127.0.0.1` vs `localhost` do not share storage).
   *The recorded fill took one second called from a script with the menu shut,
   and 45 seconds pressed with the menu open.*
2. **Judge by what is drawn, not by what is stored.** Take a screenshot of the
   exact thing the user will look at and read it. *Every restraining-order date
   held its value while its box drew "Date of the order" over it.* The PDF has
   the same trap: the value lives in the field dictionary, the ink in the
   appearance stream.
3. **Set a time budget and measure the real path.** If it is slow for the user
   it is broken, whatever your measurement said.
4. **Look again a few seconds after "done".** Pages do deferred work - idle-time
   visibility batches, entries rebuilt after a count changes, a saved draft
   restored late. *Repeating-block entries were emptied 250 ms after a fill that
   checked out perfectly at 0 ms.*
5. **Compare against a known-good path, and re-run the reference before
   believing a difference.** Diffing a new fast path against the old slow one
   found 46 bad elements out of 4,414 in one pass. Re-running the reference
   filters out races in the reference itself.
6. **Prove a new check can fail.** Run it on the broken build, or break one
   thing on purpose, and watch it fail - then fix and watch it pass. *The first
   version of several checks here could not have failed on the defect they were
   written for.*
7. **Make sure a comparison looks where the defect is.** "0 differences" means
   nothing if the comparison only examined what you expected. *A report of
   "0 differences, 0 missing" was blind to fields that existed but had been
   emptied.*
8. **When two environments disagree, list every difference between them and
   eliminate them one at a time.** Guessing costs more than listing. *A recorded
   path differed from the live one; frame throttling, base URL, doctype, parent
   page and Firebase were each ruled out by experiment before the real cause -
   a race inside the fill - was found.*
9. **A green audit is not evidence.** It is a regression test for defects
   already seen.
10. **Change your mind.** Answer a gate Yes, fill what it opens, then change it
   to No with real keys: everything it opened must close and empty, all the
   way down the chain. Every automated check fills forwards and never changes
   an answer back. *A description stayed on screen, holding what was typed,
   after "Is there another incident?" went to No.* The human read (§3 step 9) and the page images (step 10) are
   the only checks that can find a new kind of problem.

Practical notes for the Browser pane:

- Scripts you run there have a 45 s limit. Start long work, store the result on
  `window`, and poll in a second call.
- A same-origin iframe shares the page's storage; give it an in-memory
  `localStorage` before anything in it runs (see `forBaking` in
  `live-site-builder.js`) or it will write the user's draft.
- Rendering is throttled in hidden tabs: nothing that must render may run in a
  tab nobody is looking at (rule `nothing-renders-to-a-hidden-tab`).
- A `window.open()` after an `await` is popup-blocked; claim the tab first.

---

## 5. Reading a failure

- **`pipeline-audit.js` NOT SHIPPABLE**: find the rule's block above the last
  line; each finding names the question (`q<n>`), its form and the text. Look
  the rule up in `form-rules.html` for what it requires and why. Fix it in the
  **hints** (or the compiler, if the rule is general), never in generated JSON.
- **Nav audit "Next is disabled on section N"**: something on that section reads
  as unanswered. Reproduce it in the Browser pane with the same steps (fill,
  then walk from section 1), then dump that section's visible fields.
- **"answers the fill wrote were gone 3 s later"**: the page undid the fill -
  deferred work emptied or rebuilt something. The fill must hold its result
  until the page is quiet.
- **"shows N empty fields"**: open the section and look. Either the fill never
  answered the field, the page cleared it, or it is drawn empty.
- **"drawn differently ... (missing <class>)"**: the page sets that class from
  an event the fast path did not fire. Find what sets the class
  (`grep -n "<class>" "FormWiz GUI/generate.js"`) and do the same after writing.
- **"With a saved draft, N answers the fill wrote were gone 8 s later"**: a
  step of the page's draft restore ran after the fill. Every deferred restore
  step must return once `window.__fwDebugFillRan` is set.
- **pipeline-fill "do not fit their box even at 6pt"**: a joined or computed box
  is given more than it can print. Share the room among the parts or shorten
  the words - never lift a limit past what the paper prints.
- **`pipeline-explain.js` lists a defect**: a field whose question exists and
  whose gates are open, still empty. Trace the question in the review output.

---

## 6. When a new kind of defect gets through

It will. When it does, close the gap in all of these places, in this order, so
the next agent inherits the lesson and not just the fix:

1. **Fix it in general code.** Never special-case one form or one field (rule
   `no-hard-coding`). If the fix is data, put it in the source the build reads.
2. **Add or extend an automated check that fails on the old build.** Run it on
   the broken build and watch it fail (§4.6), then on the fixed one.
3. **Add the rule to `form-rules.html`**: `id`, `group`, `num`, `title`, `says`
   (the requirement, stated generally), `why` (the incident, concretely - what
   the filer saw), `by` (the check that enforces it and where the fix lives).
4. **Tell the story in `PIPELINE.md`**: what happened, why every existing check
   missed it, what changed.
5. **Add a row to the incident log (§8)** and, if a step of the procedure
   changed, update §3 and `HANDOFF.md` §6.

---

## 7. Reporting

- Say what you ran and what it found, with the numbers. Quote failing output.
- Say what you skipped and why. Never claim a check you did not run.
- Say how a measurement was taken if it could mislead ("3.8 s, with the audit
  running at the same time").
- When the user reports something you did not see, reproduce it their way
  first. Then answer plainly where their experience and yours differed.
- A defect you find outside the task: report it, do not silently fix or ignore it.

---

## 8. Incident log

Each row is a defect that reached the user or a finished build after the checks
of the day passed, and the check that now catches it.

| Defect | Why the checks missed it | What catches it now |
|---|---|---|
| The interview showed a field name: "Do you have a dV 100[0].Page4[0]...?" | Rule 2 looked for underscores; the humanizer had removed them | Rule 2 patterns for PDF paths; the human read (`pipeline-review.js`) |
| Thirty questions about further abuse asked after "it happened once" | Every question worked alone; nothing answered a gate No | Fill minimum path; rule `no-means-no` |
| A court printed with a street and no name; `Amount: $ $100`; a ruled line through an answer | Value checks read the field dictionary, not the ink | Page-image audit (`PDF-PAGE-AUDIT.md`) |
| Back went from CLETS-001 to DV-108, a form the answers had switched off | Every check read data; none pressed a button | `pipeline-nav-audit.js` Next/Back walk; rule `back-retraces-next` |
| A jump to section 26 of a 23-section packet ended the form early | Nothing walked the jumps | `pipeline-audit.js` JUMPS |
| Dead form activations in the export | Exported from an editor tab open through earlier edits | RULE 7 fails dead activations; export from a fresh tab (§2) |
| The live site landed in a second folder with new links | The project id lived only in build output and a rebuild minted a new one | `projectId` in `dv-packet.spec.json`; rule `survive-a-rebuild` |
| CLETS-001 sections titled "For Law Enforcement: ..." | Section names and titles were never checked | RULE 17 |
| DV-140 printed "children" ticked with no child named for a custody request | Each question worked alone; the gap was between the answer that brought the form in and the one that fed it | RULE 18 |
| The fill buttons took 45 s with the debug menu open | Tested by calling the function with the menu shut | Nav audit presses the button with the menu open, 3 s budget |
| A recorded path had the protected animals' entries blank | One fill run raced the page | The builder keeps a recording only when two runs agree |
| The question page's recorded maximum had 781 values to the section page's 961 - every repeating-block entry blank - and no warning | Both runs agreed on the same blanks, and agreement was the only test | Runs are also held to the empty required boxes they leave (up to five runs, fewest wins); compare `fillPaths.byMode.*.maximum` value counts across pages after every publish |
| Entries emptied 250 ms after a fast fill; Next locked | Checked immediately after the fill | Nav audit re-checks after 3 s; the fill holds its result until the page is quiet |
| Dates blank on screen although every value was stored | Every check read stored values | Nav audit: empty-as-drawn, and every element's classes against the worked-out fill |
| Every repeating block emptied a second after the fill, on a page with a saved draft - one load in two | Every audit started with empty storage, so no restore ever ran | Nav audit's saved-draft run; every restore step stops once a fill has run |
| The question-at-a-time page worked its path out every time: 10.7 s | Only the section page was recorded; the question page's logic differs by a display flag | Each page records its own paths; `pipeline-nav-audit.js --modes question` |
| Joined answers ran off the edge: case numbers, a license's state, an employer's address, firearms four to six | Every value was whole in its field; nothing measured the ink | The server shrinks to fit and names what still does not; `pipeline-fill.js` fails on it |
| Child support asked as one choice where DV-100 says check all that apply | Nothing compared a question's type with the paper's instruction | The human read against the paper; rule `check-all-that-apply-is-asked-that-way` |
| DV-105 item 4a's "complete form DV-105(A)" never mentioned to the filer | The interview followed the paper's skip and nothing said why | A subtitle names the form and where to get it; rule `a-form-the-packet-cannot-fill-is-named` |
| DV-101 required a second incident of everyone | Each question worked; nothing asked whether there was a second | A gate before incident 2; rule `room-for-another-is-offered` |
| Changing a gate back to No left the questions after it on screen, holding what was typed (DV-101's second incident, DV-105's custody order) | A closing question emptied itself and told nothing waiting on it; every check filled forwards and never changed an answer back | The page re-checks every question after a person's change; found and verified by changing gates back with real keys (§4.10) |

---

## 9. Where things are

| Path | What it is |
|---|---|
| `pipeline-audit.js` | The interview rules (§3 step 4) |
| `pipeline-audit-flowchart.js` | The flowchart graph |
| `pipeline-nav-audit.js` | The published site in headless Chrome: fill buttons, appearance, Next/Back |
| `wording-rules.js` | The wording patterns, with their own tests |
| `pipeline-disqualifiers.js` | `--scan` for disqualifying language, `--check` that each declared one is wired |
| `pipeline-connect.js` | Cross-form shared names; `--check` writes nothing |
| `pipeline-sanitize.js` | Rebuilds the sanitized PDFs from field configs; `--check` writes nothing |
| `pipeline-capacity.js` | What each PDF box holds |
| `pipeline-fill.js` | Fills the PDFs from captured answers and reads them back; `--render` |
| `pipeline-explain.js` | Why each empty field is empty |
| `pipeline-review.js` | The whole interview in reading order |
| `audit-pdf-pages.js` | Renders filled PDFs to PNG for reading |
| `pipeline-crop.js` | Zooms into one box on one page |
| `pipeline-current-output.js` | Publishes the page images you read to `Current Form Output/` |
| `pipeline-field-labels.js` | Names a PDF's fields from the text beside them (for new field configs) |
| `pipeline-harvest-text.js` | Moves authored wording from an old export back into the hints |
| `auto-form/pipeline-quality.js` | Quality validation for the Auto Form Creator's generated configs |
| `form-rules.html` | Every rule: what it requires, why, and what enforces it |
| `live-site-builder.js`, `live-site-publish.js` | Publishing, and recording the fill paths |
| `.claude/skills/publish-live-site/SKILL.md` | The publish procedure |
