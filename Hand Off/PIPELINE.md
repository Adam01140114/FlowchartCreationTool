# Packet pipeline — PDFs in, filled forms out

Everything from a folder of court PDFs to a verified HTML interview runs as
commands. Each stage writes an artifact the next stage reads, so any stage can
be re-run on its own and the result is reproducible rather than remembered.

```
   PDFs ──► field configs ──► connections ──► sanitized PDFs
                  │                                   │
                  └──► hints ──► flowcharts ──► project ──► packet GUI JSON
                                                                │
                                                    HTML form ──┴──► filled PDFs
```

## The cornerstone: a question never carries its condition

Every other interview rule rests on this one. When a question only applies in
some situations, the situation is asked first, as a Yes/No question of its own,
and the question is shown only on Yes.

| Never | Always |
|---|---|
| "If there is another parent or legal guardian besides you and the other person, what is their name?" | "Is there another parent or legal guardian besides you and the other person?", then on Yes "What is their name?" |
| "Where is it, if you know?" | "Where it is kept", marked optional |
| "If someone else, their relationship to the child" - a box everyone sees | "How is the other person they lived with related to the children?", shown only when "Someone else" is ticked |
| "End, if it applies" | "End", marked optional |

The words of a title, a box label or a choice never hold an "if". A condition an
earlier choice already answers is that question's `conditional`; one nobody has
asked yet is a gate the hints create:

```json
"dv105_other_guardian_name": {
  "text": "What is their name?",
  "conditional": {
    "onlyWhen": "dv105_other_guardian_exists",
    "gateQuestion": "Is there another parent or legal guardian besides you and the other person?"
  }
},
"dv105_other_guardian_role": { "conditional": { "onlyWhen": "dv105_other_guardian_exists" } }
```

An `onlyWhen` naming something that does not exist yet creates the Yes/No gate,
worded by `gateQuestion`, and everything naming the same gate waits on the same
Yes. Something the filer may simply not know - a serial number, a breed - is
`"optional": true`, and the Next button lets the filer past it. The title never
says "(optional)" - see "Optional is coded, never said" below.

This is enforced, not advised. The patterns live in `wording-rules.js`, which
tests itself (`node wording-rules.js`). `compile-form.js` refuses to write a
flowchart whose wording carries a condition, and `pipeline-audit.js` fails the
run (RULE 2, CORNERSTONE). The audit's earlier copy of the pattern held literal
backspace characters where `\b` belonged: it matched nothing and printed
"passes", which is how that DV-105 question shipped after the rule was written.

## Every question title is a full sentence

A title stands on its own; the one-question-at-a-time mode shows nothing else.
It ends in a question mark or a full stop, never leans on the question before it
("And before that?"), is never a fragment ("Which county?", "Your lawyer's
information"), never opens with a label and a colon ("Monday: what should the
visit look like?") and never ends in one. Name what is asked about: "Where did
the children live before the address you just gave?", "Which county should the
children not be taken out of?", "What should the visit on Monday look like?".
The "(check all that apply)" the form adds to a checklist is not part of the
title. `pipeline-audit.js` RULE 14 fails the run on a title that is not a
sentence.

## Optional is coded, never said

A question the filer may skip is marked optional in the hints - `"optional":
true` on the question, the combine or one part - and that is all it takes: the
editor exports `required: false`, the form tags the question `data-optional`, and
the Next button lets the filer past it blank. The title never says "(optional)",
and neither does a box label in the hints. An optional box inside an otherwise
required question is the one place the form shows it, in the box itself.

"How can the court reach you? (optional)" said it and was required anyway -
nothing had marked it - so a filer who believed the title was stopped at Next.
`pipeline-audit.js` RULE 15 fails the run on any title or box label that says
"optional", and tells you whether the question was really marked;
`compile-form.js` refuses to write a flowchart whose title says it.

## What disqualifies a filer

A court form does not only ask questions. It also says when the answers rule
the filer out - "you do not qualify unless", "only if you are married",
"this applies only if you have a minor child". Nothing in a field list
records that, the compiler cannot infer it, and left undeclared it is
invisible to every other step: the filer discovers it at the courthouse.

So it gets its own artifact next to `form_connections`:
`dv-packet-disqualifiers.json`, and a step that keeps it honest.

```bash
node pipeline-disqualifiers.js --scan     # read the PDFs for the language
node pipeline-disqualifiers.js            # list what has been declared
node pipeline-disqualifiers.js --check    # is each one actually wired up?
```

`--scan` prints sentences that sound like a disqualifier, with form and page.
They are leads, not rules: a person decides which fields each one is about.
On the DV packet it finds five in the DV-100 and one in the DV-109 - the
DV-109 lead is a service deadline rather than a disqualifier, which is why
the step stops at printing.

`--check` compares each declared disqualifier against the alert rules in the
exported packet GUI JSON and exits non-zero when one has no alert behind it.
That is the half that matters. A disqualifier written down and never wired
up is worse than one nobody wrote down, because it looks handled.

How to wire one: [`NEW-FORM.md`](./NEW-FORM.md), "Disqualifying factors".

## The artifacts

| File | What it holds | Who writes it |
|---|---|---|
| `dv-field-configs/<form>-field-config.json` | every AcroForm field: raw path, canonical `newName`, and `courtUse` | Auto Form Creator, then edited |
| `dv-packet-connections.json` | which fields on different forms are the same answer | you |
| `<form>-hints.json` | interview knowledge the field config cannot express: question wording, option labels, exclusive groups, sections | you |
| `<form>-flowchart.json` | the compiled flowchart | `compile-form.js` |
| `dv-packet.spec.json` | the packet: form order, PDFs, connectors | you |
| `dv-packet-disqualifiers.json` | the answer combinations that rule a filer out | you |
| `dv-packet-project.json` | the project the editor opens | `pipeline-build-packet.js` |
| `dv-packet-gui.json` | every form merged into one interview | the editor's **Export Project GUI JSON** |
| `pipeline-answers.json` | what a debug fill answered | the generated form |
| `pipeline-out/` | filled PDFs, field read-backs, page images | `pipeline-fill.js` |

## `courtUse` — who completes what

Every Judicial Council form prints it. DV-109: *"The person asking for a
restraining order must complete items 1 and 2. The court will complete the rest
of this form."* DV-110 says the same for items 1, 2 and 3.

A field marked `"courtUse": true` in the field config never becomes a question.
It stays on the PDF, blank, for the judge or clerk. This is not a cosmetic
choice: asking a survivor what the judge decided produces an answer they cannot
know and a filed order that says the court ruled something it has not.

## Generating the form: wait for the builder before reading it back

`loadFormData` restores each question's hidden-logic rows on per-question
`setTimeout(..., 50)` timers, and `getFormHTML` reads those rows back out of the
builder DOM. Call `getFormHTML` too soon and the page is emitted with
`var hiddenLogicConfigs = []`.

That is not a small loss. Hidden logic is how an exclusive choice reaches its
PDF checkbox: the config maps the option's label to the option's own field name.
Without it the runtime falls back to a box named `<question>_<slug(label)>`, so
"Someone trusted, like a relative or friend" posts
`dv105_supervisor_someone_trusted_like_a_relative_or_friend` and the field
`dv105_supervisor_nonprofessional` is never ticked. The interview looks right,
the payload looks full, `pipeline-audit` passes, and the printed form has empty
boxes - fifteen groups on DV-100 alone.

So after loading, wait, and check before generating:

```js
document.querySelectorAll('.hidden-logic-config').length   // 299 for the DV packet
```

and confirm the emitted HTML carries a non-empty `var hiddenLogicConfigs = [`.
The editor's own **Preview Form** does this for you; a scripted export does not.

## An order owns its questions

A court form asks which orders you want, and then asks about each one. Those
follow-ups belong to the order, and the option that asks for it is their gate:

```json
"questions": {
  "protected_animal":  { "conditional": { "onlyWhen": "protect_animals_order_requested" } },
  "animal_order_stay_away_requested_yes": { "conditional": { "onlyWhen": "protect_animals_order_requested" } }
}
```

Gate the **whole run**, not its first question. Gating only the entry moved the
block and left its tail on the spine, so "Why do you have the right to live
there?" was still asked of a filer who never asked anyone to move out. A
question that already waits on something inside its own run - the yardage waits
on the stay-away answer - inherits the order through that parent and is left
alone.

Sections switch on any question in interview order, branches included, so a
section may open inside a branch. It did not always: assignment used to run
along the spine and hand each branch the section of its top-level question,
which emptied "Animals, Property and Support" the moment items 16 through 28
moved under the orders question.

## A repeating block behind a gate starts at one

"Does the person have firearms? Yes" is followed by "How many firearms do you
know about?", and a spinner starting at zero offers a filer who just said yes
the answer none. The compiler raises the minimum to one for any block reached
through an answer and prints which:

```
 * gated block firearm_item -> minimum 1 entry (an answer already said there is at least one)
```

A block on the spine keeps whatever the hint says, because there zero can be a
real answer. A hint that sets `"min": 0` behind a gate is overridden, visibly.

## The rules, one page, each one addressable

```
http://127.0.0.1:8080/form-rules.html
http://127.0.0.1:8080/form-rules.html#rule-court-field-not-filer-name
```

Every rule this pipeline enforces, grouped into the interview, the packet, the
printed page and working on it. Each entry says three separate things and they
are not interchangeable: what the rule requires, the specific failure that
caused it to be written, and what actually checks it. A rule with no checker is
a preference.

Each rule has a stable id, so "what rule is this?" can be answered with a link
that opens the page, scrolls to the rule and lights it up rather than with a
paragraph that has to be trusted. **Those ids never change once published** -
renaming one breaks every link already sent. Add rules; do not rename them.
The Copy link button on each rule hands you its address.

The rules page and the page-image dashboard link to each other, top right.

## The paper is on screen, and a node points at a box on it

Under **Default PDF Properties** the editor renders the form that panel names,
page by page, with a **View Fullscreen** button that lays every page out one
under the next to scroll through, opening on the page that was showing and
handing the panel back the page the reading reached. Select a node and the box it
fills lights up: the preview jumps to the page that box is on, outlines it, and
prints the field name in full above the page. A node whose name matches nothing
on the PDF says so in red.

That last part is the cheapest check in the whole pipeline that a node is wired
to something real, and until now it took an audit run to find out.

It is drawn to a canvas rather than shown in an `<iframe>` because the highlight
needs the widget rectangles, which means reading the annotations and drawing
over them. `pdf-preview.js` indexes every widget by name on load - one name can
be printed on several pages, and the view goes to the first.

Three things about it are worth keeping in mind if it is ever touched:

- **Its width comes from the panel, never from the box the canvas sits in.** The
  canvas is what makes that box tall enough to need a scrollbar, and the
  scrollbar is what makes it narrower, so a redraw sized to the box changed the
  width the next redraw would use. It ran forever and took the editor's main
  thread with it.
- **It does not render to a hidden tab.** pdf.js drives a canvas render from
  `requestAnimationFrame`, and a hidden tab is served no frames, so the render
  paints part of the page and never settles its promise. It defers, and draws on
  `visibilitychange`. The highlight still lands, because the viewport is computed
  before the render.
- **Loading is debounced.** Exporting the project GUI JSON walks every form,
  which rewrites these inputs five times in a row; reading thirteen pages of
  annotations five times to end up back where it started is seconds spent on a
  panel nobody is looking at.

### Which boxes a node points at

Measured on September 13, the preview found a field for 136 of the packet's 288
question nodes and reported the other 152 in red as matching nothing - and the
red message is the one thing this preview is trusted to say. Three kinds of
question were wired correctly and shown as broken:

- **Checkbox and dropdown questions.** On the paper such a question is often
  only a heading; the boxes belong to its options. The question now reaches
  through to the option nodes it leads to, through its split hub.
- **Multi-textbox questions.** A box's `nameId` is spelled two ways and both
  are in use: some carry the whole field name (`person_asking_protection_name`),
  others only the part after the question's (`address`, printed as
  `<question>_address`). Both are looked for.
- **Numbered blocks.** `{n}_name` was looked up as written. The entry number now
  goes where `{n}` stands - or after the name when there is none - over the
  block's own "how many?" range.

Mirrors, the parts of an address, a block's own choices and a combined
question's own dropdown (a gender between the name and the age, in
`_dropdowns`) are named too, and names compare without case.

- **Joined boxes.** Two answers printed in one box - "court name" and "court
  street address" in `court_name_and_street_address` - are joined by a Linked
  Logic node, which records the box in `_linkedLogicNodeId` and the answers in
  `_linkedFields`, with no arrows. The rule reads those the way the export does
  (`library.js`, which turns them into `linkedFields`), so an answer that is
  printed inside a joined box marks that box.

When nothing matches, the node's own id is still looked for as whole words
inside a longer field name, drawn dashed and grey and labelled as partial. With
joins read from the chart it rarely fires. Dropping the name's first word to
widen that search is not done: it made `other_abuse_incident_police` point at
`different_abuse_incident_police`, another question's boxes.

After, in the editor on DV-100: 99 questions marked, 0 partial, 4 with no field
(three flow-only gates, and DV-105's child block, whose fields are on
dv105.pdf) - against 49 marked and 54 in red before.

**One copy of the rule.** It lives in `node-field-names.js`, which the editor
loads ahead of `pdf-preview.js` and which `pipeline-node-fields.js` requires.
The check runs in `npm run audit` (AUDIT.md §3 step 5a). For every question node
of every form it takes what that node's question posts - `postedNames()` from
`pipeline-audit.js`, asked about the one question, plus every joined box in the
export's `linkedFields` fed by it - keeps what exists on the form's own
sanitized PDF, and requires the preview to mark all of it and nothing else. A
node whose question is asked once in another form has no GUI question of its
own; there the preview must find the node's own field, and must not mark a box
nothing in the packet fills. Today: 274 of 274 nodes fully marked. Run against
the old rule it fails with 138 nodes shown red, which is the defect it was
written for.

Why nothing caught it before: the feature was tried on questions that fill one
box named after themselves. Nothing selected a question whose boxes are its
options, and nothing compared the preview with what the form posts.

## Adding a form to the packet

The packet's forms are in `dv-packet.spec.json` and, with what each is for and
when it comes in, in `Hand Off/FORMS.md`; every continuation is drawn on MC-025.

**The packet's scope is the user's list, not the paper's.** On September 14,
2026 the user limited the packet to the sixteen first-filing forms (`scope` in
the spec). SER-001, DV-200, INT-300, MC-410 and RA-010 left the packet, with
the four DV-100 questions that existed only to bring them in (sheriff service,
interpreter, disability accommodation, remote appearance); DV-145, FL-155,
MC-030 and MC-031 came in. A form the paper mentions outside the list goes in
`formsOutOfScope`, saying why. `pipeline-form-refs.js --check` fails a packet
form outside `scope`, or a `scope` form nothing makes. Add a form to `scope`
only when the user asks.

**The numbered steps grow with the answers.** The bar at the top of the form
starts with only the forms every filer fills: the one nothing switches on
(DV-100), any marked always included, and what those bring in unconditionally
(CLETS-001, DV-109, and DV-110 through DV-109 - DV-109 asks nothing, so it has
no step). `generate.js` works this out at build time from the activation rules
and builds the other steps hidden. When an answer brings a form in, the step
appears in its place in the packet order, the steps after it renumber, and the
new one is marked for a moment; when the answer is taken back, the step goes.
`updateProgressBar` runs 150 ms after any change or keystroke and when a fill
finishes. The bar used to list the whole packet and hide what was not needed,
and it only redrew when the filer changed page - after Fill maximum path
brought in six forms it still showed three. The nav audit reads the bar on a
fresh page and after each fill and fails it if it is wrong.

**FL-150 or FL-155 is DV-570's decision, made in the interview.** FL-150 comes
in on spousal support or lawyer's fees among DV-100's orders, or on a Yes to any
of DV-570's four remaining questions (self-employed; the other person asking for
spousal support; the other person asking for lawyer's fees; other income). Those
four are asked only when child support is requested, each only after a No to the
one before, so a No to the last means all four were No. FL-155 comes in on
`financial_statement_simplified_allowed`, a box the form ticks itself (a
`tickWhen` computed field in `dv100-hints.json`: child support and the last No
ticked, spousal support and lawyer's fees not). The activation reads the box's
tick, so `tickWhen` makes a real checkbox. A gate's `onlyWhen` can only OR its
conditions, which is why the questions are chained rather than each gated on
three answers.

**Where the chain hangs matters.** The first DV-570 question hangs straight off
the "Child support" order, so the chain is part of the child-support branch and
its answers carry that order on. DV-100's children block (`dv105_child`) is
gated on custody, child support or "We have a child together", and the compiler
feeds it the exits that still carry one of those orders. Hung on item 24's
answers instead, the chain left the branch: the children block stopped showing
for a child-support filer and FL-150 printed the count blank (RULE 18 caught it).
The pipeline audit then says the children block shows on both Yes and No of the
last DV-570 question; that is declared in `alwaysShown`, because DV-570 is not
what gates it. The questions and the children block share the "Animals,
Property and Support" page, after item 24: a question cannot be listed on a page
before the answers it waits on.
Adding one is seven steps and about half of it is naming.

```bash
curl -sSL -o dv108.pdf https://courts.ca.gov/documents/dv108.pdf   # NEW-FORM.md §0 - PDFs are pre-approved
qpdf --decrypt dv108.pdf plain.pdf            # Judicial Council PDFs are encrypted XFA
node pipeline-field-labels.js plain.pdf       # what each field sits next to on the page
#  write dv-field-configs/dv108-field-config.json  - every field, named
node pipeline-sanitize.js dv108               # rebuild with those names into FormWiz GUI/
#  write dv108-hints.json                     - the interview
node compile-form.js dv-field-configs/dv108-field-config.json dv108-flowchart.json --hints dv108-hints.json
#  add it to dv-packet.spec.json, with what activates it
node pipeline-connect.js && node pipeline-capacity.js && node pipeline-build-packet.js
```

Then the usual: import the project JSON in the editor, export the GUI JSON,
audit, generate, fill, render, read the pages.

**Name a field after the answer, not after the form.** A field the packet
already asks about takes the packet's name and is filled from the answer that
already exists - that is the whole wiring. DV-140 is the clearest case: 221
fields, 195 of them the judge's, and every one of the remaining 25 is a
question DV-100 or DV-105 already asks. It ends up asking nothing at all.

**A form that says "This is a Court Order" is the court's, bar its identifying
items.** DV-110, DV-109 and DV-140 all take that shape: the filer completes the
first two or three items and every other field is marked `courtUse`, so no
question is ever generated for it and `pipeline-explain.js` counts the blank as
blank by design.

**Say what each attachment is attached to.** `attachedTo` in the spec, copied
from the form's own first line, is a different fact from what switches it on.
DV-140 is switched on by DV-100's custody box and printed as attached to DV-110;
counting it as DV-100's put six pages into DV-100 item 32, which read 18 where
the stack is 12. The computed rule `pagesOfFormsAttachedTo` follows the chain,
so DV-108 (attached to DV-105, attached to DV-100) counts and DV-140 does not.
It travels in `defaultPdfProperties` beside `pdfPages`, and has to be named in
`project-gui-export.js`, the one place the export lists a form's keys by name.

**Which forms are in the packet is answered in one place.** `packet-forms.js`,
reading `dv-packet.spec.json`. Four scripts used to keep their own list and
every one went stale silently - a form joined the packet and was not filled, or
not measured, or not reconciled with the others, and the run looked exactly like
a clean one with fewer pages.

**Types the compiler accepts are not all types the builder renders.** `ssn` is
in `compile-form.js`'s KNOWN_TYPES and the builder draws no input for it, so the
question reached the GUI JSON and no field ever appeared on the page. Nothing
catches that but the page audit. CLETS-001's SSN is declared `text`, and the
runtime still shapes it because `hasValidatedShape()` keys off the name.

## A project knows its own name

Every project JSON carries a `projectId`, minted once and preserved from then
on. It survives import and export because it is read from the file when there
is one and only minted when there is not, so a project that has been round the
loop keeps the same id for the life of the file.

It travels: project JSON -> merged GUI JSON -> the generated form -> the
answers payload (as `__projectId`, which no PDF has a field for) -> the
published folder. So the output lives under the project that produced it:

```
Current Form Output/
  index.json                 what has been published, most recent first
  p_mtumpmov7t2gh0/
    manifest.json  README.txt
    DV100/  page-01.png ...  fields.json
```

and **View PDF Output** on the flowchart page opens that project's dashboard:

```
http://127.0.0.1:8080/form-output-dashboard.html?project=p_mtumpmov7t2gh0
```

The id resolves in one order and it matters: **what the file says, then what
this browser last used, then a new one.** A file with an id always wins, so
opening someone else's project does not quietly adopt yours; and the browser's
memory covers the editor restoring a project saved before ids existed, which
otherwise minted a fresh id on every reload and moved the link out from under
you. An id that changes by itself is not an id.

Opening a project with no output says so, gives the command, and lists the
projects that do have output. A dashboard that only says "no manifest" is a
dead end, and the usual cause is worth naming: the editor is holding a
different project from the one that was published.

Import a different project, press the button, and you land on its output rather
than on whatever ran last. Arriving without a `?project=` shows the most recent
and offers a picker; arriving with one always shows that one, because a link
handed out for a project has to keep pointing at it.

### And a name a person can read, on the project and on every form

The id is for machines. The project also carries a `projectName` - the
spec's `"project"` when the builder writes it, the **Project Name** box when
the editor exports it - and import puts it back in that box. It used to be
dropped on the editor's first export, so one round trip made the file
anonymous; `pipeline-audit-flowchart.js` now fails a project without one.

Each form's chart opens with its own name: one notes node above everything
else, reading `DV-105 Form`, bold, font 50, 1580 x 350, text centred both
ways. Several charts share one editor and look alike zoomed out - DV-140's
is DV-105's first twenty nodes - and this is what says which one is open.
`pipeline-build-packet.js` adds it after everything else is placed (so it
sits above all of it) and replaces any it finds rather than adding a second;
audit check 9 fails a form without it. Both read the standard from
`title-note.js`, so changing the size is one edit, not two that can drift.

## Publish the pages you looked at

The page-image audit is the last and least skippable step, and describing what
you saw asks the reader to take your word for it. Every full pass ends by
copying the exact images the audit read into one folder:

```bash
node pipeline-fill.js --render
node pipeline-current-output.js
```

```
Current Form Output/
  DV100/  page-01.png ... page-13.png
  DV101/  page-01.png  page-02.png
  ...
  manifest.json   what the dashboard polls
  README.txt      when, and from which answers
```

The folder is replaced rather than merged: a leftover page from an older run is
worse than no page, because it looks current and is not. Page numbers are
zero-padded so ten sorts after nine.

`form-output-dashboard.html` shows the whole folder and re-reads it every three
seconds, so a pass run in the terminal appears in the browser without a reload:

```
http://127.0.0.1:8080/form-output-dashboard.html
```

Every page image carries its own **Field data** panel: which fields print on
that page and what each holds, **empty ones first and counted in the summary**.
A blank is a fact about a place on paper - "item 6 is empty" is a sentence
about page two - and a list that buries the empties reads as though everything
is fine. DV-110 page 2 says "28 fields · 27 empty", which is exactly right for
a page that belongs to the judge.

A page wired to the rest of the packet is outlined and says so — "↔ 25 fields
shared with DV100, DV101, DV105, DV109" — and each shared field names where
else it appears. In this packet a shared name IS the wiring, so the connection
is real, load-bearing and otherwise nowhere on the page.

The caption is told apart from a link **without a list or a threshold**: a name
on *every* page of every form that has it is the letterhead, and a name that
reaches one page of four forms is an answer travelling. Counting the case
number would mark all thirty-three pages and separate nothing; excluding it by
name would be a rule about this packet. Eight of thirty-three pages carry real
cross-form wiring, which is the number worth seeing.

In the enlarged view, Back and Next walk all thirty-three pages in order across
form boundaries, with the arrow keys too. The ends are dead rather than
wrapping — wrapping from the last page to the first reads as a bug.

Every page shows its verdict **closed**, so thirty-three pages can be skimmed
and the one with something wrong stops you. The counts are the reason to open a
page, so making you open it to see them is backwards.

Every blank says why it is blank. `pipeline-explain.js --json` is published
beside the fields as `why.json`, so a page reads

```
Field data      71 fields · 70 empty · all accounted for
```

in green, and each empty field names the answer that closed it. A page with a
blank nothing accounts for says **"n unexplained"** in red and marks the rows.

This is the distinction that matters and the one a page cannot show on its own:
an empty field is either a branch the filer did not take or a defect, and they
look identical printed. DV-105 page 6 is seventy empty fields and entirely
correct — the filer chose supervised visits at item 11, so item 12 is filled and
the form says in print "If you completed 12, you are done. Do not complete 13."
Counting empties without saying which kind they are turns that into an alarm.

Each page also has a **Copy page data** button, which hands the page over as
JSON — form, page, project, the publish timestamp, counts, and every field with
its value:

```json
{ "project": "p_...", "form": "DV110", "page": 2,
  "counts": { "fields": 28, "empty": 27, "text": 21, "filled": 1,
              "checkbox": 7, "ticked": 0 },
  "fields": [ { "name": "restrained_person_has_prohibited_items_yes",
                "kind": "checkbox", "value": false }, ... ] }
```

Blanks are in it, and so is the count of them: the reason to copy a page is
usually to ask a question about it, and "these four are empty" is the question.
Buttons are left out — the Print and Save controls and the form-number links are
not fields anybody fills. If the clipboard is refused, the JSON opens in a
dialog, selected, rather than the button claiming a copy it did not make.

Each form also carries a **PDF Data** panel, collapsed: one list of every text
field with its name and value, one of every checkbox with ticked or not ticked,
both filterable. The images show where a value printed; this shows what the
field is called and what is in it, which is the half you cannot get by looking
at a page. It is fetched only when opened, and re-read when a new pass lands
under an open panel.

The flowchart page has a **View PDF Output** button above Clear that opens the
dashboard in its own tab.

It polls two different things. The manifest says which forms exist and how many
pages each has, and the layout is rebuilt only when that changes - rebuilding
every three seconds would throw away the scroll position and flash every image
while you are reading one. The publish timestamp goes on each image URL, so the
browser fetches the new bytes for a page whose name did not change.

## A field the form asks for and the filer cannot know

DV-100 item 32 - "enter the number of extra pages attached to this form" - was
a question, and a question there gets a guess. The debug fill answered 100. A
filer would answer something too, and a wrong number on a filed court document
is worse than a blank one.

It is not unknowable, only unknown to the person holding the pen. Declare it in
the hints and no question is generated; the form works it out when it posts:

```json
"computed": {
  "additional_pages_count": {
    "pagesOfAttachedForms": true,
    "onePageEachWhenYes": [
      "other_protected_people_additional_list_attached_yes",
      "dv101_additional_pages_attached",
      "dv105_children_additional_list_attached" ] } }
```

Nothing here is a number someone typed. Page counts are read from the PDFs when
the packet is built (`pdfPages` on each form), and which attachments are on is
the same answer that decides whether their questions get asked at all. An
attachment is a form switched on **conditionally** - DV-109 and DV-110 are
switched on unconditionally and travel with the packet rather than being
attached to it, which is the distinction the activation rules already draw.
The count is the pages of every form attached, plus every MC-025 sheet
continuing one of them, counted with the layout that draws them ("MC-025, the
one continuation form", below).

It crosses four layers, so a change to any of them has to keep all four:
`compile-form.js` drops the field and records it, `pipeline-build-packet.js`
counts the pages, `project-gui-export.js` merges it, and the generated form
evaluates it in `applyComputedFields()`.

One thing this turned up: `captureCurrentForm` rebuilt a project slot from the
canvas, and the canvas knows about cells and sections and nothing else - so the
first walk of a project silently threw away the continuation lines, the
always-shown declarations and the computed fields. It now keeps whatever the
slot had that the canvas does not produce.

## A court field must not share a filer's name

Sharing a name is how this packet wires one answer into every form that prints
it, which makes an accidental share indistinguishable from a deliberate one.
There is one kind that is never deliberate.

DV-110 says the filer completes items 1, 2 and 3 and the court completes the
rest. Its item 6 is a court **finding** - "The court finds that you have the
following prohibited items" - and its field for the first firearm was called
`firearm_item_1_description`, the same as the box on DV-100 where the filer
lists what they believe the person has. The filer's claim was posted straight
into the judge's finding, and the same for item 12a's stay-away grant. Nine
fields, and the filled order read as though the court had already decided.

`pipeline-connect.js` now enforces the inverse of its own rule: a `courtUse`
field may not carry a name that a filer field somewhere in the packet also
carries. Where it does, the court's copy is renamed with its own form in front
and the answer stops reaching it. `--check` exits non-zero while any remain.

## Know what a box holds, and stop there

Every text field on these forms declares a fixed font size — 10pt or 11pt, not
one of the 465 is auto-sizing — so a value wider than its box is drawn and then
clipped. The answer is on the page and unreadable, and nothing upstream knows:
the DOM has the whole string, the payload has the whole string, only the ink is
short.

```bash
node pipeline-capacity.js        # measures every box into dv-packet-capacity.json
node pipeline-build-packet.js    # carries the measurements into the project
```

The number travels project JSON → GUI JSON → generated form, and lands as
`maxlength` on the input. That is the only place a limit helps: a filer stopped
at the point of typing can shorten what they meant to say, and one truncated
afterwards cannot. A box with continuation lines is measured across the whole
chain, because the filler spills onto them.

**A character count is an approximation, and the docs should say so.** These are
proportional fonts — at 11pt Helvetica a `W` is 10.38pt and an `i` is 2.44pt, so
no single number is right for every string. The number says how much of *one*
text fits: a corpus of what people actually write on these forms (names,
streets, cities, dates, short sentences) rather than English prose, which runs
narrower and would spend its error in the direction that clips. Answers in block
capitals are the case that can still run long.

**It is measured by laying the text out, not by dividing by an average.** An
average is what a character costs; it is not what a line holds, because a word
does not split across a line break and every line therefore ends early by part
of a word. Worse, the measurement has to agree with the thing that draws — so it
calls pdf-lib's own `layoutMultilineText` and bisects for the longest run that
stays inside the box. Four separate attempts at predicting that layout were each
wrong by about one line:

| what was measured | what was drawn | result |
| --- | --- | --- |
| width ÷ average character | pdf-lib wraps on words | DV-101 item 5 measured 400, printed ~350 |
| a wrap written here | pdf-lib's wrap | DV-100 item 14: 98 chars/line here, 94 there |
| box height ÷ font line height | the rules the form printed | DV-101 item 4c: 19 lines measured, 17 ruled |
| a plain prefix of the sample | the sample with `[end]` welded on | the marker lengthens the last word by five characters |

So the capacity is the length of the string the fill will actually write,
counted over the lines the form actually ruled. `pipeline-capacity.js` and
`fillToLength()` in `FormWiz GUI/generate.js` therefore share one filler text
verbatim — the runtime is emitted as a template literal and can require nothing,
so the two copies are kept in step by hand and each names the other.

**A box too narrow for a whole word still gets a limit.** Fitting whole words
returned zero for DV-110's `State` box, which was read as "not measured" and
left uncapped — so "Wyoming" printed as "Wyor" with nothing to say so. A line
that takes no word now takes as many characters as fit and ends the run.

**And where the long form will not fit, the short form goes on the paper.** That
State box holds four characters — it is printed for a postal code — while the
question is a dropdown of full state names, because picking "California" is
easier and less error-prone than typing two letters. The dropdown already keeps
the code beside the name, in the hidden `<field>_short` it maintains, so
`pdfValueForNamedField` reaches for it when the measured capacity says the long
form does not fit and the short one does. An answer that fits is never
shortened: the same run sends `WY` to DV-110's four-character box and `Wyoming`
to DV-100's eleven-character one.

Two things had to be fixed under that. The debug fill was writing "Test Value"
over every derived mirror — `_short`, `_hidden`, `_code`, `_no_code` are text
inputs hidden by an inline style, not questions — so the short form it reached
for was test text. And a fill sets a `<select>` without its inline `onchange`
ever running, so the mirrors were empty afterwards; `refreshStateMirrors()` now
recomputes them where the other derived fields are recomputed.

**Which boxes wrap travels with the measurement**, under a reserved `__wraps`
key inside `fieldCapacity`, because whether a box wraps is part of measuring it
and a second map would have to be threaded by hand through the project file,
the editor, the GUI export, the builder's round trip and the emitted runtime.
The maximum path uses it to decide whether to keep its sample seed: in a box
that wraps, the words before the padding decide where every later line breaks,
so the fill has to be the text the capacity was measured from. Keying that off
`<textarea>` was wrong — `dv101_abuse_1_witnesses` is a plain input on the page
and two ruled lines on the paper.

Two things are deliberately left alone. A field whose **content** has a shape —
a ZIP, a date, a phone, a percentage — is never padded or capped-to-fill: a ZIP
padded to eleven characters is not a longer ZIP, it is a wrong one. And the
continuation chain comes from the compiler's own `continuationLines`, not from
geometry: the filler can find them by shape because it also checks the next line
is empty, and without that check the same rule chained an age box to whatever
sat under it and awarded it a hundred characters.

Every capacity fill ends with **`[end]`**. A filled box that stops mid-word
could be the capacity working or the ink being clipped, and on a rendered page
those look identical; the marker settles it at a glance. It earned its keep
immediately — the first run printed `uvwxyz[en` on DV-100 item 16b, which is
how the chain allowance below was found.

The two halves of an overflow carry different markers — **`[cont]`** on the box
that continues and **`[end]`** on the one that finishes — so a page audit can
see both ends of the split printed in full.

A chain of ruled lines is wrapped as one run of lines rather than summed box by
box, so the part-word lost at each break is counted once, where it happens.

**The maximum path fills every measured box to exactly its capacity**, so the
rendered page answers the only question that matters — does the text stop
cleanly at the edge, or is it cut through? "Test Value" in a box that holds
fifty-seven characters proves nothing about the fifty-eighth. The minimum path
is left alone, because there the question is what happens when people answer as
little as they can.

## Lay multi-line text on the lines the form ruled

pdf-lib leads at the font's own line height — 12.21pt at 11pt Helvetica — and
the paper is ruled at whatever pitch the form chose. DV-100 item 17b is a 52.4pt
box holding four lines, so the form ruled them 13.1pt apart: 0.89pt a line, and
by the fourth line the text has moved 3.6pt and sits on the rules.

Dividing the box height by the number of lines it holds is close, and close
compounds. DV-101 item 5 is 60.4pt over four lines, which gives 15.1pt against a
real pitch of 14.0: the first line cleared its rule, the second touched it, and
the fourth was struck through.

So **the rules are read rather than inferred**. `ruled-lines.js` walks the
page's content stream, keeps every horizontal segment (stroked lines and
rectangles filled thin enough to read as one), and returns the ones inside a
given box. `dev-server.js` harvests them once per fill — the appearance provider
is called synchronously and cannot parse anything itself — and puts each
baseline 1.6pt above its rule.

Two filters earn their place:

- **Only the evenly spaced run counts.** A widget's rectangle is not drawn to
  the ruled area and often reaches past it. DV-101 item 3d's box covers the
  label rule of item 3e below it, and both run its full width; counted as
  writing lines they gave the box six lines where it has four, and two
  baselines landed 4.7pt apart — one sentence printed over another. A form rules
  a box at one pitch, so the longest consecutive run sharing the commonest gap
  is the box.
- **A rule on the bottom edge is a writing line.** Both DV-105 item 5b boxes are
  drawn so their last rule is the box's bottom edge, and a one-point margin threw
  it away, so the answer stopped on the third of four lines. Nothing here can be
  the widget's own border: a widget draws its border in its appearance stream,
  and this reads the page's content.

Where the rules cannot be read the old height-divided-by-lines estimate still
runs, so a form that defeats the parser is no worse off than before.

**A line with nowhere to go now says so.** Text laid out past the last rule is
written below the box and clipped: the value is complete in the AcroForm, the
payload is complete, and only the ink is short — so every check that reads data
passes and the paper is wrong. `dev-server` logs the field, the lines it needs
and the lines it has. A clean run prints none.

Filling every box to capacity is what made all of this visible. With one short
line in a four-line box there was nothing to drift.

## Running out of space continues on MC-025

DV-100 item 7 ends with *"Check this box if you need more space to describe the
abuse. You can use form DV-101"* — and asked as a question, that is asking
someone to predict, before they have written a word, whether what they are about
to say will fit in a box whose size they cannot see. Nobody knows that.

They need more space exactly when they have used more than the box holds, and
the box has been measured. So the question is gone. The box is dropped from the
interview by the compiler, and the form simply notices:

```json
"overflow": {
  "other_abuse_incident_details": {
    "marks": "other_abuse_incident_additional_space_attached_yes",
    "page": { "name": "DV100_Item_7f", "heading": "DV-100, Item 7(f)", "item": "7(f)",
              "itemTitle": "Description of the abuse", "form": "DV-100" }
  }
}
```

| what the filer wrote | what happens |
| --- | --- |
| within DV-100 item 7's 1115 characters | it prints there, nothing else happens |
| more than that | `…additional_space_attached_yes` ticks, the box prints what it holds ending on a whole word, and the rest continues on an MC-025 page headed "DV-100, Item 7(f)" - as many sheets as it takes |

There is no limit. The page takes another sheet, so the form never decides how
much of someone's account is worth having.

**It used to continue on DV-101.** DV-101 item 5 held 387 characters more, and
carried the same escape again - *"Check here if you need more space. Attach a
sheet of paper"* - which needed a third box (`marksBeyond`) and a limit that
came off only past both. California's own instructions name MC-025,
Attachment, for any form that runs out of room, so the packet now uses it for
every continuation (next section). The runtime still reads a link with a
`field` on another form so an old project opens; `pipeline-audit.js` RULE 21
fails one.

**A box two answers share.** DV-160 prints one "not enough space (Attachment 8)"
box under both 8b and 8c. Each answer has its own overflow link and its own
MC-025 page; `applyOverflowLinks` ticks the shared box while either runs over.
Until MC-025 these three DV-160 answers were held to what their boxes printed and
their boxes were `courtUse`.

**The continuation carries the remainder, not a copy.** The first box keeps
what it can print and MC-025 takes the rest, so the two read as one passage.
`overflowSplit()` in `FormWiz GUI/continuation-layout.js` is one function for
all three readers - the live page, the payload trimming the box's own answer on
the way out, and `pipeline-fill.js` - because a split computed twice drops a word
between the two pages or prints it on both.

**The payload carries the rest.** The box's own value is cut on the way out, so
an answer set captured from what the form posts held no trace of what went on
MC-025. Every `/edit_pdf` request now also posts `__continued_<name>` with the
remainder (`overflowContinuedFields`); the server has no field by that name, and
`pipeline-fill.js` draws the MC-025 page from it. A captured set whose "more
space" box is ticked but that holds nothing past the box fails the fill.

Three things had to be got right for this to work at all, and each looked like
the feature not working:

- The condition lives in the **connector cell's style**, beside
  `connectorTarget`. Set as a property on the cell it did not survive the
  editor's canvas round trip, and the rule exported as `unconditional: true`.
  (This was DV-101's connector; a continuation on MC-025 needs no connector.)
- `applyFieldCapacities` runs again every time the form grows a field, and put
  the narrow cap back within a frame of `applyOverflowLinks` removing it. A box
  that can spill is now skipped by that sweep.
- The maximum path has to **go over the edge on purpose**. Stopping at what the
  box prints leaves the continuation off and its page blank. The value is built
  so the split lands exactly on the box's limit (`[cont]` ends the box's part)
  and then runs `OVERFLOW_TEST_SPILL` (6,000) characters further, past one MC-025
  sheet, so the run shows "Page 1 of 2" (`[end]` ends the page's part).

## MC-025, the one continuation form

Rule `the-packet-uses-mc025-for-more-space`. MC-025 *"may be used with any
Judicial Council form"*, and anything in the packet that needs more space
continues on it: a long answer past its box (the overflow above: DV-100 item
7(f), DV-160 items 6a, 6b, 8b, 8c) and a table's entries past its rows (the next
section: DV-105 item 3, the other protected people on DV-100, DV-110 and
CLETS-001, DV-160's minors and redactions). The forms the paper names for the
same job - DV-101, MC-020 - are never used; `dv-packet.spec.json` says so in
`continuation.replaces`, which `pipeline-form-refs.js` reads. Substantive forms
that hold more information - DV-105, DV-108, FL-150, DV-160 - are forms of their
own and MC-025 never stands in for them.

| MC-025 box | what the packet puts there |
| --- | --- |
| SHORT TITLE | `case_short_title`, "Mora v. Smith" - a `joinFields` computed field in `dv100-hints.json` (filer v. restrained person), filled once both names are given |
| CASE NUMBER | nothing: the clerk's, as on every form |
| ATTACHMENT (Number) | the page's `attachmentNumber`, or its form and item: "DV-100, Item 7(f)", "DV-105, Item 3" |
| body | the heading the form asks for, "Continues Item X - title.", then the text or the lettered rows |
| Page __ of __ | numbered across the sheets of that one page |

How it is drawn:

- `FormWiz GUI/attachment-page.js` fills a fresh copy of the sanitized blank
  (`FormWiz GUI/mc025.pdf`, named by `dv-field-configs/mc025-field-config.json`)
  for each sheet and flattens it. The form's Save/Print/Clear buttons and its red
  on-screen notices are removed first, or they print.
- `FormWiz GUI/continuation-layout.js` works out the lines and the page breaks:
  Helvetica widths **without kerning** (pdf-lib kerns, so a line measured here is
  never narrower than the one printed), 12pt a line, 48 lines a sheet. The drawer
  requires it; `gui.html` loads it and `generate.js` embeds its source in every
  page as `fwContinuationLayout`. No backslashes in that file - it is written into
  the page as a string. The drawer refuses a replaced MC-025 whose body box is a
  different size.
- **The count is the drawing.** DV-100 item 32, DV-160 item 10 and FL-150's pages
  attached use `pagesOfFormsAttachedTo`, which now adds every MC-025 sheet
  continuing a form in that stack, counted with the same layout
  (`continuationSheets`). One page per list, the old count, was wrong the moment
  a list took two sheets. `pipeline-fill.js` fails a page drawn with a different
  number of sheets than the layout counts.
- `attachment-page.js` is required by the dev server at start: **restart it**
  after changing either file.

## Asked once across the packet

A form later in the packet that prints what an earlier form already asked
must not ask it again. Matching question names was not enough; five shapes of
the same answer got through, and each now has its own mechanism.

- **The court's box.** DV-100 prints "Court fills in case number when form is
  filed." `case_number` is `courtUse` on every form, so no form asks it and the
  attachment pages leave it off.
- **A box an earlier answer ticks.** DV-110's "protect other people" box and
  DV-140's item 3 box carry the names DV-100's answers already tick
  (`other_protected_people_yes_yes`, `child_custody_and_visitation_order_requested`).
  `collapseSharedQuestions` in `project-gui-export.js` drops a later question
  whose own name, or every one of whose options, an earlier question posts
  through its answers (recorded in `packetMirrors` with `viaAnswer: true`).
  CLETS-001's firearms Yes/No/Don't know are renamed to DV-100's in
  `dv-packet-connections.json` and collapse the same way.
- **A list carried over.** DV-110 item 2 and CLETS-001 ask for the firearms DV-100
  item 9 lists. Both boxes are `autofill` from DV-100's entries, joined with "; ".
  The CLETS phone is DV-100's phone by name.
- **The same answer in other words.** DV-110's "relationship to person in 1" is a
  `computed` field with `wordsWhenTicked`: a word or two for each DV-100
  relationship box that is ticked. The box holds 29 characters, so the words are
  short.
- **The same block.** DV-100 asks for the children with a date of birth under
  DV-105's block name, so DV-105's declaration collapses into it. Its `joinInto`
  takes only `{n}_name` for DV-100's names line. The page for children five to
  twelve belongs to DV-105 (`attachment.form`) and is drawn again as "DV-140,
  Children" (`otherPages`), each only while its form is in the packet.

An optional checkbox question passes its own condition on, like an optional text
question: "Which of those days should be virtual visits?" is answered by ticking
none, and the days after it open on the chart choice as well as on its boxes
(`library.js`, only where every box leads on). Groups take `"optional": true`.

## No connector is left loose

A connector an answer decides hangs off that answer's option. One that waits on
a box the writing ticks hangs beside the question whose answer ticks it, with
its condition written under it (`overflowQuestionFor` finds the question from an
overflow link; DV-101 once hung off item 7f's description this way, labelled
"only if item 7f needs more space", before MC-025 replaced it). Every connector nothing decides - a
form that always travels with this one (DV-109, CLETS-001) - is a child of the
form's central **End** node, chained one below the other in the order the spec's
`activates` lists them: **most important at the top, least important at the
bottom.** DV-100 reads End, DV-109, CLETS-001; DV-109 reads End, DV-110.

DV-101 used to sit first under End, where it read as "always, next": a filer
whose 7f fitted went from DV-100 straight to CLETS-001 and saw the chain as
broken. (DV-109 comes before CLETS-001 but asks nothing - its filer items are
DV-100's answers - so it has no page to show.) Double-clicking a connector opens
its properties: the form it brings in, what it hangs from, what switches it on
and the note under it.

They used to be dropped under the lowest node and wired to nothing, which left
every chart ending in boxes floating below it. `pipeline-build-packet.js`
(`endNodeOf`, and the chain in `main`) now wires them. The reader had to change
with it: `collectProjectConnectors` in `connector-nodes.js` took whatever fed a
connector as its condition, so End read as an answer labelled "END" and every
form chained under it would never have switched on. An End or connector feeder
is now a place in the chain, not a condition.

## More entries than the paper has rows go on a page the form draws

DV-105 item 3 prints four rows for children - a name and a date of birth each -
and under them: *"Check here if you need more space. Write 'DV-105, Children' at
the top and attach it to this form."* It was asked as "Do you have more children
to list on a separate page?", and nothing let a fifth child be entered or produced
the page, while DV-100 item 32 counted one the moment the filer said yes.

It is the row version of the overflow link above, and it is declared on the
block, beside the rows it continues:

```json
"repeats": [{
  "nameId": "dv105_child", "entryTitle": "Child", "min": 1, "max": 4,
  "fields": [ ... ],
  "attachment": {
    "name": "Additional_Children",
    "heading": "DV-105, Children",
    "item": "3",
    "itemTitle": "Children Under 18 Years Old",
    "marks": "dv105_children_additional_list_attached",
    "most": 12
  }
}]
```

- `max` stays the rows the PDF prints; `most` is how many the filer may add.
- The compiler drops `marks` as a question, as it drops an overflow link's box.
- The form's "how many" goes up to `most`, and an entry past `max` says it goes
  on the attached page. Whenever there are more than `max`, `marks` ticks - so
  DV-100 item 32 counts the page - and the page joins Download PDFs, Preview
  PDFs and the payload.
- The page is drawn, not filled. The form posts its extra rows with the request
  (`__attachment`) and `/edit_pdf` hands them to `FormWiz GUI/attachment-page.js`:
  the heading the form says to write at the top, the item it continues, the case
  number, and one lettered row per entry carrying on from the PDF's last letter
  (the form prints a-d; the page starts at e). A long list runs onto more pages,
  each headed the same way.

**Setting it up by hand.** On a Multiple Dropdown node open Properties →
*Extra entries on an attached page*, tick it, and fill in the most entries, the
page's file name, its heading, the item it continues and the PDF checkbox it
ticks. "Number Range - To" stays the number of rows the PDF prints. The FormWiz
builder's numbered dropdown has the same settings under its Entry Title.

**One block, several forms' pages.** DV-100, DV-110 and CLETS-001 each print four
other protected people and each says to attach a sheet for the rest - under its
own heading ("DV-100, Other Protected People", "DV-110, Other Protected People",
"Item 4"), with its own columns, ticking its own box. The people are asked once,
in DV-100's block, which asks everything any of the three forms prints about each
person (CLETS-001's gender, race and date of birth included - it used to ask them
on four screens of their own). The block's attachment says which columns its own
page prints, and lists the other forms' pages:

```json
"attachment": {
  "name": "DV100_Other_Protected_People", "heading": "DV-100, Other Protected People",
  "item": "8", "itemTitle": "Other Protected People",
  "marks": "other_protected_people_additional_list_attached_yes", "most": 12,
  "fields": ["{n}_full_name", "{n}_age", "{n}_relationship", "Lives with you?"],
  "otherPages": [
    { "form": "DV-110", "name": "DV110_Other_Protected_People", "heading": "DV-110, Other Protected People",
      "item": "3", "itemTitle": "Other Protected People",
      "marks": "other_protected_people_additional_list_attached_yes",
      "fields": ["{n}_full_name", "{n}_relationship", "{n}_age"] },
    { "form": "CLETS-001", "name": "CLETS001_Item_4", "heading": "Item 4",
      "item": "4", "itemTitle": "Other People You Want Protected",
      "marks": "clets_other_protected_people_attached_page",
      "fields": ["{n}_full_name", "{n}_gender", "{n}_race", "{n}_date_of_birth"] } ] }
```

- A `fields` entry is an entry field's key as the hints write it (`{n}_age`) or
  its label (`Lives with you?`), in the order the page prints them. None: all.
- A page in `otherPages` exists only while its `form` is in the packet, and a box
  two pages share by name (DV-100 and DV-110 print the same one) ticks when either
  page exists.
- The other forms still declare the block under the same `nameId`, so each
  compiles on its own; the project export asks it once. Each names the box its
  page ticks in `attachmentTargets`, or it would ask for it.

**The audit finds the ones still missing.** `pipeline-audit.js` RULE 13 reads
every PDF's text for a checkbox beside "need more space", "list more people",
"on a separate piece of paper" and the like, and fails each such box nothing
ticks - no overflow link, no attachment. Court-use boxes are exempt. A box two
forms share by name (DV-105 and DV-140 both print the children one) is covered
by the one declaration - and the other form names it in its hints'
`attachmentTargets`, the way a continuation field goes in `overflowTargets`, or
it is compiled as a question there. DV-140 asked "Do you have more children to
list on a separate page?" the moment DV-105 stopped.

**The pipeline draws it too.** `pipeline-fill.js` reads every block with an
`attachment` from `dv-packet-gui.json` (`--gui` for another), and every page it
feeds, `otherPages` included. When the answers' count is past `max`, it ticks
each page's `marks` in the answers it fills the forms with, posts the same
`__attachment` the form would, and writes one PDF per page, named for the page -
`pipeline-out/additional_children-filled.pdf`, `dv110_other_protected_people-filled.pdf`
- plus its `-pages` folder under `--render`. When the count fits the paper, it says no attachment is needed and
removes any page an earlier run left there. `--answers <file>` fills from another
answer set.

## A long answer runs onto the next ruled line

A court form often prints two ruled lines for one answer and gives each its own
field. The interview asks once, so only the first is submitted, and pdf-lib
draws it at the size the field declares and clips whatever runs past the right
edge - DV-100 item 16b(3) has 166pt of line and the answer wanted 226pt. The
answer was on the page and unreadable, and the second ruled line the form
printed for exactly this was left empty.

`dev-server.js` now measures each answer against its own line and wraps the
remainder onto the lines beneath it, and says so:

```
[edit_pdf] Edited_dv100.pdf: "animal_sole_possession_other_reason_line_1" ran past
                             its ruled line; continued on ..._line_2
```

Which field continues which is read off the page, not off the names. A
continuation is on the same page, sits below its line by no more than one line
pitch, ends at the same right edge, is the same height, and has nothing in it.
A fixed few-point tolerance is not enough for the vertical test: the gap is
0.33pt on the animals pair and 3.42pt on the move-out pair, so it is measured
against the line's own height, which is also what separates the next line from
the one after it. It is measured bottom to bottom, line to line, not from one
box's bottom to the next box's top: FL-155 item 3c's two lines are 8.8pt apart
in boxes 15.8pt tall, so the boxes overlap, the old box-to-box test never found
the second line, and the first printed its whole part at 6pt, 84pt past the edge.
The capacity (the declared `continuations` chain, 96 characters) had counted
both lines all along; the server now agrees with it.

**A short answer stays on its own line.** An answer that fits its line at three
quarters of its declared size or more (and at least 8pt) is set smaller there,
not broken over the next line: FL-155's phone number, "(310) 555-0142", was
printed as "(310)" over "555-0142". Only an answer that would have to shrink
further runs on - DV-100 item 16b(3) needs 8.1pt of an 11pt line, so it still
does.

Two things it deliberately does not do. An auto-sized field is left alone -
there the layout shrinks the text to fit rather than clipping it, so there is
no overflow to move. And nothing is ever dropped: if the answer outruns every
line the form printed, the last one takes the remainder and clips exactly as
before, because a form with two ruled lines cannot hold four lines of text and
silently losing the end would be worse than showing it run out.

## Buttons that were printing words

The sanitizer deletes push buttons, which is right for a control and wrong for
the rest. DV-100 page 13 lists the forms to file, and each form number is a push
button whose caption is the only place those characters exist - deleting it
printed "Form , *Temporary Restraining Order*". The caption is not in the
appearance stream, which draws nothing; it is `/MK /CA`, which a viewer paints.
So it is drawn onto the page as real ink before the widget goes:

```
    10 button caption(s) drawn as text: DV-110, DV-109, CLETS-001, DV-105, ...
```

The test is intrinsic, not a list. A control carries `/MK /BG`, a background
colour - that is what makes it look like a button rather than like text - and
Print, Save and Clear all have one. A caption with no background that shares a
line with those coloured buttons is the notice about them, and goes too. And a
caption is only drawn where the page does not already say it: that comparison is
on the words, because a form number sits flush against the comma after it and
testing for any overlap dropped three captions on the strength of one comma.

## A field box that covers the form's own label

`pipeline-sanitize.js` lowers the top of any multi-line field whose rectangle
covers text the page has already printed, and says so:

```
    box lowered off its own label: dv101_abuse_1_injuries (page 1, top 224 -> 213)
```

DV-101 item 3e is the case: the widget starts eight points above the label it
belongs to, so anything drawing from the top of the box prints the answer
straight through the words "Describe any injuries:". The value is right, the
field name is right, and the page is unreadable - only the page-image audit
finds it. The correction belongs in the sanitized PDF, not in the filler, so
every consumer sees the same rectangle.

## Splitting a field that holds two answers

A PDF box labelled "Court name and street address" is one field and two
questions. Declare the split in the form's hints and the pipeline handles both
halves:

```json
"splits": [
  { "field": "court_name_and_street_address",
    "join": ", ",
    "parts": [
      { "nameId": "court_name",           "question": "What is the name of the court?" },
      { "nameId": "court_street_address", "question": "What is the court's street address?" }
    ] } ]
```

The compiler asks the parts in the original's place and emits a linked-logic
node carrying the separator; the generated form keeps a hidden field of the
original name holding the parts joined in order, and that is what fills the PDF.
Any field, any separator, any form - see rule 8.

Two values in one box are two boxes even when the paper prints one line for
them, and even inside a combined question. DV-105 item 4's "City and state" is
split into `_city` and `_state` and joined with ", "; CLETS-001's "Driver's
license number and state" and "Employer (name and address)" are split the same
way. Splits run before combines, so a combine names the parts, not the original:

```json
"splits": [ { "field": "dv105_child_home_1_city_and_state", "join": ", ",
              "parts": [ { "nameId": "dv105_child_home_1_city",  "label": "City" },
                         { "nameId": "dv105_child_home_1_state", "label": "State" } ] } ],
"combines": [ { "question": "Where do the children live now, and since when?",
                "fields": [ { "field": "dv105_child_home_1_from",  "label": "Living there since", "type": "date" },
                            { "field": "dv105_child_home_1_city",  "label": "City" },
                            { "field": "dv105_child_home_1_state", "label": "State" } ] } ]
```

RULE 8 reads every box inside a question as well as whole questions, by field
name (`_and_`) and by label ("number and state", "name and address"), and a
failure fails the audit run.

## Combining fields into one question, and typing them properly

Fields that describe one subject are one question (rule 9), and a value is asked
in the type it is (rule 10):

```json
"combines": [
  { "question": "Where can the court send you papers?",
    "fields": [
      { "field": "person_asking_protection_mailing_address",  "label": "Street address" },
      { "field": "person_asking_protection_mailing_city",     "label": "City" },
      { "field": "person_asking_protection_mailing_state",    "label": "State" },
      { "field": "person_asking_protection_mailing_zip_code", "label": "ZIP code" } ] } ],
"questions": {
  "person_to_restrain_date_of_birth": { "type": "date" },
  "person_asking_protection_age":     { "type": "number" }
}
```

A combine becomes a `multipleTextboxes` question whose boxes keep the PDF's own
field names; a type becomes a date picker, a phone keypad, an email field or a
number box. Types work inside combined and repeating questions too.

A date is a date by what the box says, not only by what it is called. DV-105
item 4 named its boxes `_from` and `_until` and printed "(month/year)" beside
them, and they were asked as text: RULE 10 read field names only. It now reads
the part's label and the PDF's own caption too (date, since, from, until,
month/year) and fails the run. A date the box cannot print whole prints in its
short form - a "(month/year)" box five characters wide gets `03/20`, a wider one
`03/2020` (`shorterFormThatFits` in the generated form).

Not only addresses: whenever several questions are about one subject, they are
one question. A part can name a group - a family of checkboxes asked as one
choice - and it sits in the question as a dropdown whose options keep the
checkboxes' names, so the answer ticks the same box the separate question did:

```json
{ "question": "Who do you want protection from?",
  "fields": [
    { "field": "person_to_restrain_full_name",     "label": "Name" },
    { "field": "person_to_restrain_age",           "label": "Age", "type": "number" },
    { "field": "person_to_restrain_date_of_birth", "label": "Date of birth", "type": "date" },
    { "group": "person_to_restrain_gender",        "label": "Gender" },
    { "field": "person_to_restrain_race",          "label": "Race" } ] }
```

Every box carries the PDF field it fills, so the question's own name is free.
Give a combine a `nameId` when its fields' shared prefix already names another
combined question - DV-100's name and age share `person_asking_protection` with
its contact details. A choice that opens other questions cannot be a part: it
stays a question of its own, and so does anything asked as a narrative.

A question the filer may not know the answer to is optional: `"optional": true`
on a question hint, on a combine, or on one part of a combine. The form lets the
filer past it, and the question after it waits on what it waited on rather than
on its answer. An optional part inside an otherwise required question says
"(optional)" in its box; a question that is optional as a whole never says so in
its title (RULE 15) - the flag is what makes it skippable.

## Running it

This is the command sequence. The full audit procedure - what each check proves
and cannot see, how to test a feature by hand, and the safety rules for the
user's data - is [`AUDIT.md`](./AUDIT.md); follow it before calling anything done.

```bash
# 1. cross-form identity, then rebuild the PDFs whose field names changed
node pipeline-connect.js
node pipeline-sanitize.js dv100 dv101 dv105 dv109 dv110
node pipeline-capacity.js     # what each box holds, once the PDFs are final

# 2. what the paper form says disqualifies a filer, and whether it is wired
node pipeline-disqualifiers.js --scan     # leads, per form, per page
node pipeline-disqualifiers.js            # what is declared

# 3. compile each form, then assemble the packet
node compile-form.js dv-field-configs/dv100-field-config.json dv100-flowchart.json --hints dv100-hints.json
#   ... and one line per form: dv101, dv105, dv109, dv110
node pipeline-build-packet.js   # also wires every declared disqualifier as an alert node

# 4. open dv-packet-project.json in the editor (Import Project JSON),
#    then Export Project GUI JSON -> dv-packet-gui.json

# 5. audit the static rules - the chart, the disqualifiers, then the interview
node pipeline-audit-flowchart.js
node wording-rules.js                     # the wording patterns test themselves
node pipeline-audit.js                    # exits 1 when a wording rule fails
node pipeline-disqualifiers.js --check    # every declared one has an alert

# 6. fill the form (debug menu: Ctrl+Shift, then "Fill maximum path"),
#    save the answers, and produce the PDFs
node pipeline-fill.js --render   # every form in the packet, not a list kept here
#    publish first (the publish-live-site skill) - it also records the fill paths
node pipeline-nav-audit.js       # presses each fill button (menu open, 3 s budget,
                                 # no empty field shown), then Next to the end and Back to the start
node pipeline-explain.js dv110

# 7. read the interview yourself. This step is not optional and no packet
#    ships without it - the audit only catches what it was taught to catch.
node pipeline-review.js

# 8. look at the filled PDFs, page by page. Also not optional: every check
#    above reads data, and a field can hold the right string and still
#    print in the wrong place. See Hand Off/PDF-PAGE-AUDIT.md.
node audit-pdf-pages.js ./audit 1.6 dv100-filled.pdf dv101-filled.pdf dv105-filled.pdf \n                                  dv109-filled.pdf dv110-filled.pdf
```

## The last step: read it

`node pipeline-review.js` prints the whole interview in the order a person meets
it - question text, type, what each one waits on, and the boxes inside combined
and repeating questions. Read all of it, then answer the form in the preview and
check that saying No to a gate really does remove the block behind it.

This is a required step, not a review of last resort. `pipeline-audit.js` is a
regression test for defects that already happened once; it reported zero
failures on a packet that asked "Do you have a dV 100[0].Page4[0]...?" and that
asked thirty questions about further abuse of a filer who had just said it
happened once. Both were obvious on one read.

## And then look at the pages

Reading the interview checks the questions. It cannot check the answers that
come out the other end, because the interview is HTML and the deliverable is a
PDF. A field can hold exactly the right string and still print in the wrong
place, or print the form’s own decoration back at it - the value lives in the
field dictionary and the ink comes from the appearance stream.

So: fill the packet, render every page of every filled PDF, and read the
images. `node audit-pdf-pages.js <out-dir> 1.6 <filled.pdf ...>`.

A DV packet is 25 pages. The defects found this way - a court printed with a
street and no name, `Amount: $ $100`, a ruled line struck through an answer -
were each on exactly one of them, and each was found after the audit and a
field-by-field value check both reported nothing wrong.

Full procedure, and what a legitimate blank looks like on a Judicial Council
form: [`PDF-PAGE-AUDIT.md`](./PDF-PAGE-AUDIT.md).

## A form an answer brings in gets its data whenever that answer is given

When an answer switches a form on, every question on another form that fills
that form's boxes must be asked whenever that answer is given - not only after
some other choice the filer may not make.

DV-105 and DV-140 come in on "Child custody and visitation", and both list the
children. The children were asked only after "We have a child or children
together", so a custody request without that box (a guardian, say) reached
DV-140 item 3 ticked with no child named. The block is now asked after
"children together" OR "Child custody and visitation", placed after the orders
question so both answers are known when it is reached. DV-100 item 3a prints
the names beside its "children together" box, so that line is a computed field
(`joinWhenTicked`) filled only while the box is ticked.

`pipeline-audit.js` RULE 18 checks it: for each form brought in by an answer, it
walks every feeding question's conditions from that answer - and from the
answers that bring in the form the answer is asked on (DV-108 through DV-105 to
DV-100) - and fails any question that also needs some other, unrelated choice.

## Section names are short, and every title speaks to the filer

A section name names what the section is about in a few words: at most 32
characters and 5 words, no colon, no prefix. No section name or question title
says who else will read the answers - "For Law Enforcement", "for the court",
"court use only", "what law enforcement needs to know about you". Every page the
filer sees is theirs to fill in.

CLETS-001's sections were "For Law Enforcement: The Person to Restrain" and "For
Law Enforcement: You and Yours", and it asked "What does law enforcement need to
know about you?". They are now "The Person to Restrain", "Your Information" and
"What are your identification details?" - in `clets001-hints.json`, because an
edit made only in the editor is lost at the next rebuild. `pipeline-audit.js`
RULE 17 fails a long or prefixed section name and any title that names another
reader.

## Back retraces Next

Every check above reads data; none presses a button. A filer who asked only for
an order not to abuse them went from DV-100 "Orders You Want" to CLETS-001,
pressed Back, and landed in DV-108 "Risk of Abduction" - switched off by their
own answers, with a required question on it. Back took the nearest earlier
section with a question showing, not the section the filer had left.

Back now reads the history of sections left (`sectionStack`) and passes over any
section `sectionReachable` rejects: a form not in the packet, or a section whose
questions have all closed. `node pipeline-nav-audit.js` proves it on the
published site in headless Chrome, with a throwaway profile so no saved answers
are touched: for the minimum and the maximum fill it presses Next to the last
section and Back to the first, and fails unless Back visits the same sections in
reverse, none twice, all in forms that are in the packet. `--modes
section,question` walks the question-at-a-time page too (a few minutes a path).

The first run found a second defect the same way. DV-110's "Do you know where
the restrained person lives?" answered No jumped to section 26 of a 23-section
packet - the section it pointed at had been dropped for being empty once its
only question was asked on DV-100 - so Next finished the form and "What does the
restrained person look like?" was never asked. `dropEmptySections` now sends a
jump into a dropped section to the next section still there (or the end), and
`pipeline-audit.js` fails any jump whose section does not exist (JUMPS).

The fill buttons are pressed too. The recorded fill (the minimum and maximum
paths baked into the page at build time) passed every check when called from a
script with the debug menu shut: about a second, every answer the same as the
worked-out fill. Pressed for real, with the menu open, it took 45 seconds. The
menu rebuilt its list of every field on each `input` event (the `change`
listener already skipped a fill; this one did not). Meanwhile the page emptied
the restraining orders' dates, and the fill's settle ran out of time before it
could put them back. So the audit opens the menu and clicks the button. It fails
a fill over `--fill-budget` (3000 ms), fails when answers the fill wrote are gone
three seconds later, and fails when any section the walk passes shows an empty
field on a question it shows.

With that fixed, the restraining orders' dates were still blank on screen. Every
date held its value; 46 date boxes drew their caption ("Date of the order") over
it. The CSS paints a date transparent until its box has `fw-has-value`, and only
an event sets that class, which the recorded fill does not fire. Every check had
asked what a field holds; the filer sees what it draws. So the audit now judges
by what is drawn. A value painted transparent or hidden counts as empty. It also
holds the page after the button against the page after the worked-out fill, run
in a tab of its own with empty storage: every answer, and every element's
classes. That comparison is what found the 46, the only difference across 4,414
elements. A difference counts only when a second worked-out run shows it too,
because the worked-out fill occasionally races the page.

## The two fill modes

Both live in the preview's debug menu (Ctrl+Shift), and both write each field's
own id into it, so a rendered page can be read against the blank form and every
box says which field it is. A name-level match only proves a value went
somewhere; markers are the only way to see that height went into the height box.

**Fill maximum path** answers every question the way that opens the most
questions. It measures coverage - rule 4a, every field the answers reached
carries a value.

**Fill minimum path** answers every question the way that opens the fewest:
"no" before "yes", the smallest count on a numbered block, and no optional
checkbox ticked at all. A **required** checkbox question gets exactly one box -
the one that opens least - because Next will not take none: "What is your
relationship to the person you want protection from?" came back blank from every
minimum run and from the test-mode double-click, which stopped the path at a
question the filer cannot get past (`solverQuestionRequired` in the solver, the
same test in the DOM fill). It measures the opposite thing - that a gate answered No
actually closes the block behind it. A form can pass the widest path and fail
this one, which is how thirty questions about further abuse stayed on screen for
a filer who had just said it happened once.

Run both. Neither is sufficient alone, and each takes a few seconds.

### Recorded paths

Working a path out takes about twenty milliseconds; writing a thousand answers
one change event at a time took 3 s for the maximum path and 9 s for the
minimum. So publishing records both. `live-site-builder.js` runs each fill in a
hidden frame with Firebase stripped and an in-memory `localStorage`, up to five
times, and keeps a recording when two runs agree at the fewest empty required
boxes (`emptyRequiredFields`: typed boxes on shown questions, not optional, not
inside something hidden, not in a packet form the path left switched off -
`formOwningSection` / `isFormActivated`, because a section page hides every
section but the current one and layout cannot tell the two apart). Agreement alone was not enough: one build's two
question-page runs agreed on 781 values with all 180 repeating-block entries
blank, where the section page recorded 961. It records once for each page, because the
section page and the question-at-a-time page do not start with the same
questions on screen (`fillPaths.byMode`; pages with identical logic share one). The recording is every field's
final value and which questions are shown, stored as `fillPaths` in the GUI JSON
and as `window.__BAKED_FILLS__` in the pages. The buttons then put it back
(`applyBakedFill`): choices first, with one change event each where the page
has to build something (a block's entries, a mirrored box); then the typed
answers, silently; then what the page draws from values (`fwSyncDateFields`).
Then it waits for the page to go quiet and puts back whatever the page's own
deferred work moved.

A recording names the form logic it came from (`fwLogicSignature`). A page
whose questions have changed since ignores it and works the path out, so
publish again after changing the interview. `pipeline-nav-audit.js` checks
that the button leaves the page exactly as the worked-out fill does.

Either can be run on a page the other has already filled. A fill clears the
questions its path does not reach, the way the generated logic clears a question
it closes, so a minimum run does not inherit a maximum run's answers - it used
to, and reported nineteen ticked boxes on the run whose whole job is to show
that unticked gates close their blocks.

Both obey the forms the answers switch on. The page skips a switched-off form's
sections, so once the path is written the fill reads `isFormActivated` for every
form and, if any are off, solves again with their questions shut - emptied, and
nothing they held open left open. A minimum run on the DV packet leaves DV-101,
DV-105 and DV-108 off with nothing in them; it used to post sixty-odd answers
there that no filer could ever see.

In question-at-a-time mode a minimum path leaves a handful of questions on
screen that it says are not asked. The step navigator will not show an empty
section, so it un-hides the first question in one rather than put a Next button
under a blank screen. They stay empty, and nothing of theirs reaches the PDF.

### Testing the form by hand

Save the generated HTML into `FormWiz GUI/` and open it at
`/FormWiz%20GUI/<name>.html`. The page links `generate.css`, `generate2.css` and
`cart.js` with no path, so they only resolve from that directory; served from the
repo root it renders unstyled, every control collapses to a zero-size box, and
nothing can be clicked. The preview iframe gets away with it because `srcdoc`
resolves relative URLs against `/FormWiz GUI/gui.html`.

That matters for anything gated on a real interaction. Rule 16 - a question that
closes empties itself - deliberately ignores synthetic events, so it can only be
checked with actual clicks: navigate the question-at-a-time form with its own
arrows and click the option. Removing `question-step-hidden` by hand does not
work; `refreshNav` puts it back within a few hundred milliseconds.

Fields the form validates - dates, zips, phones, amounts - keep valid data in
either mode, because a marker there fails validation and stops the run.

**Double-click copies what the page knows about the question.** In test mode,
double-clicking a question fills it the way the minimum path would and, once
the fill is done, copies a JSON of that question to the clipboard: its title,
id, `nameId`, type and position; its section and the packet form (and PDF) it
belongs to; whether it is required and showing; what it waits on, with those
questions' titles; every field it fills, each with its value now, the value
that would be posted to the PDF, its capacity and any joined box it prints in;
the boxes outside it that its answer ticks or joins into; its jumps, the forms
it brings in, and the questions elsewhere in the packet it also answers.
`questionDebugInfo()` in `generate.js` builds it from the page's own tables, so
it describes the page that is open, not the flowchart. The copy is asked for
inside the click with the text still to come - a page may copy only close to
the click - and falls back to `writeText`, then to a hidden textarea; the JSON
is always logged and kept on `window.__lastQuestionInfo`, and a note in the
corner says whether it copied.

**Double-click a section's title** to copy the same for the whole section:
its number, name and form, whether it is the section showing, and every
question in it as a double-click on the question describes it - with
`shownNow` (the questions the answers so far have switched on), `hiddenNow`,
and `onScreenNow` (the ones actually drawn this moment, which on the
question-at-a-time page is one at most). `sectionDebugInfo()` builds it; it is
kept on `window.__lastSectionInfo`.

**Type "prompt"** - or hold p, r, o, m and t together - anywhere on the page
but inside a box, and a side panel opens with a box to write a prompt in and a
Copy button; Escape or the × closes it. Keys typed into an answer never open
it. What is written stays while the page is open and is not saved anywhere
(`openPromptPanel()` in `generate.js`). Both of these, like the double-click
fill, exist only in test mode.

A question or section JSON pasted into the panel - what a double-click copies -
shows as a small labelled block, "Question JSON" or "Section JSON", instead of
hundreds of lines; Backspace removes it whole, and Copy puts the full JSON back
where the block sits (`promptJsonKind`, `promptText`). The box is a
contenteditable editor for that reason: a textarea can only hold text. Its
styles are set by id, because the form's stylesheet styles every button - that
`margin: 0 auto` is what floated the close button toward the middle.

**Test mode never uses Firebase.** A test page exists to check that the form is
built right, and nothing typed into it is meant to be saved or remembered, so
`generate.js` leaves the Firebase SDK out of a test-mode page and the publish
and the payload strip it. For a few hours on September 14 test mode signed
each browser in anonymously to a separate Firebase project and saved there;
that was taken out for this reason. `pipeline-nav-audit.js` still blocks
Firebase in every tab it opens, so an audit can never write to a database.

### How a path is found

Both modes solve the interview as data and then write the answer to the page
once. `generate.js` emits every question's conditions as `window.__FORM_LOGIC__`
alongside the closures that enforce them, and the fill settles answers and
visibility against that model - a few thousand comparisons - before touching a
field.

It used to work the other way round: the page was the only model, so the only
way to learn what an answer would reveal was to write it in and watch which
handlers fired. Scoring one dropdown meant doing that once per option, and a
pass meant doing it once per dropdown, over eight passes. On the DV packet that
was 12,872 change events and a minute and a half, and it answered 215 of 474
fields, because `isDebugFillEligible` asked what was on screen and in
question-at-a-time mode that is one question. The same packet now settles in
about three seconds and 200 events, with every field the path reaches answered.

One thing the walk was doing by accident is now done on purpose. The page
finishes autofilling on a timer after load, and those events re-run the
conditional logic in an order that can hide a question for one event and show
it for the next - and hiding a question clears the dropdowns inside it without
putting them back. Each of the eight passes quietly repaired that. A solved
fill is finished before the page has stopped moving, so it waits for quiet and
puts back what moved, up to three times.

## Reading the result

`pipeline-fill.js` reports, per form, how many text fields and checkboxes came
back filled, and lists what is still empty. `--render` also rasterises every
page to `pipeline-out/<form>-pages/`, in-process via pdfjs - it used to shell
out to Ghostscript, which the repo does not install, so rule 4b died on any
machine without `gs`. `--scale` sets the resolution (1.6 by default). `pipeline-explain.js` says why each
empty field is empty: a gate the answers closed, a field the court fills, or a
defect. A defect is a field whose question exists, whose gates are open, and
which is still empty — that list should always be empty before shipping.

## A saved draft is never restored over a fill

A page with a saved draft restores it on timers - passes at one, two, three and
four seconds after load, then a replay of every answer that re-runs the logic
and rebuilds the blocks those answers open. Each pass checked, as it began,
whether a debug fill had run; the deferred steps inside it did not. So a pass
that began before Fill maximum path could finish after it, and its rebuild of
the numbered blocks came back empty: 180 fields - restraining orders, protected
people, children, animals, debts, expenses - one load in two, on exactly the
page a returning filer has. The fill had finished and checked itself clean.

Every deferred step of the restore now returns once `window.__fwDebugFillRan`
is set, and `replayRestoredAnswers` stops mid-replay when a fill starts. No
audit had caught it because every audit started with empty storage, and an
empty store never restores anything. `pipeline-nav-audit.js` now loads each page
a second time with a saved draft (the other path's recorded answers), presses
the button half a second after load, and fails if anything the fill wrote is
gone eight seconds later.

## Each page has its own recorded paths

The recording was made on the section page only. A recording names the form
logic it came from, and the question-at-a-time page's logic differs in one
display flag (`alwaysVisibleStacked`, which keeps some questions open on a
stacked page) - so that page rejected the recording and worked the path out
every time: 10.7 s for the minimum path. `live-site-builder.js` now records each
page (`fillPaths.byMode`), sharing one recording between pages whose logic is
identical, and `generate.js` gives each page its own.

## What goes on the paper fits its box

The interview holds a single answer to what its box holds, but a box that joins
several answers had no such limit. DV-100 item 4b prints where, when and the
number of a court case on one line, and the number ran off the edge; CLETS-001
lost the state of a driver's license and an employer's address; DV-110 printed
three of six firearms and cut the relationship mid-word. Every value was whole
in its field, so every check that reads values passed.

Three changes, each general:

- `dev-server.js` `fitToBox`: an answer longer than its box at the declared size
  is set smaller, half a point at a time, down to 6pt. A ruled box keeps its
  rules (a smaller size puts more words on each line, never more lines). It runs
  after the spill onto a ruled line below, so that happens first. The response
  names what was shrunk (`X-Fill-Shrunk`) and what did not fit even at 6pt
  (`X-Fill-Unfitted`), and `pipeline-fill.js` fails on the second.
- `generate.js` `applyFieldCapacities`: the parts of a joined box share its room.
  On the widest path each is filled to an even share; typed, a part may take
  whatever the others leave, so a long court name typed first still fits.
- `applyComputedFields`: a list of words the box cannot hold keeps what fits, in
  the declared order, and ends with "etc." - DV-110 item 2's relationship, whose
  full list is on DV-100 item 3.

## Smaller fixes from the September 12 full audit

- DV-100 item 24 says "check all that apply", and child support was asked as one
  choice - a filer on TANF who wanted an order could say only one. It is a
  check-all question now.
- DV-105 item 4a: "If no, complete form DV-105(A)." The interview skipped the
  section on No, as it should, and said nothing about DV-105(A), which the
  packet did not include. The fix made that day - a subtitle telling the filer
  to get DV-105(A) from the court clerk and fill it out - was the wrong fix; see
  "Every form the paper asks for, the packet makes" below. DV-105(A) is in the
  packet now.
- DV-101 asked every filer about a second incident. It asks first whether there
  is one (`choices` in `dv101-hints.json`).
- "How is the other person they lived with related to the children?" became
  "How is that person related to the children?"; DV-110 speaks of "the person
  you want protection from", not "the restrained person"; no two sections share
  a name ("The Children's Other Court Cases", "About the Person to Restrain").
- DV-105's "Which of those days should be virtual visits?" came before Tuesday
  to Sunday had been described, because each day's virtual box sits in that
  day's row of the field config. The boxes now follow the Sunday row.
- A test marker cut to fit a small box keeps the end of the field name, not the
  start (`~color`, not `protec`), so a page audit can tell the columns apart.

## A question that closes closes everything waiting on it

A question's visibility is checked when a question it waits on changes. When a
changed answer closes a question, that question empties itself - but it was
closed by a change somewhere else, so it fires nothing, and the questions that
wait on it never look again. Changing DV-101's "Is there another incident you
want to describe?" to No closed and emptied the incident's date; the
description after it, which waits on the date, stayed on screen holding what
had been typed. DV-105's "What did the judge order?" and "Why do you want to
change that order?" did the same when the custody-order question went to No.

The page now runs `fwSettleVisibility` - every question looked at again until
nothing moves - a moment after any change a person makes (never during a fill,
which settles itself). Every automated check fills the form forwards and never
changes an answer back, which is how this got through; it is found by answering
a gate Yes, filling what it opens, and changing it to No with real keys.

A joined list that will not fit its box even set at 6pt - DV-110's copy of six
firearms into three lines - keeps its whole parts that fit and ends with
"etc." (`dev-server.js`; the form names its lists in `__lists`, from
`fwListSeparators`). DV-110 prints "(Include information from form DV-100, item
9)" beside that box, and DV-100 item 9 holds all six.

## Found by reading the interview, September 13

The full audit's human read (`pipeline-review.js`, AUDIT.md §3 step 9) found
four things every automated check had passed:

- **DV-100 asked "Why else should you have the animals?" of a filer who had
  just said they did not want the animals.** The box is the line beside
  "Another reason", and its hint gated it on "Protect animals" - so it opened
  after every reason, and after No. It now waits on "Another reason". No check
  can tell which option a box belongs to; this is what the read is for.
- **The three abuse narratives asked "how often it happened", and the next
  question asked how often.** The narrative now asks what happened; frequency
  is the next question's.
- **DV-105 asked where, when and which case number in one box, six times.**
  RULE 8 had put it on its review list - wording with an "and" - for a person
  to read, and nobody did. The six are now asked in three boxes and joined for
  the one line the paper has, as DV-100 already did, and RULE 8 fails a one-box
  question whose title is two questions (`twoQuestionsInOneBox` in
  `wording-rules.js`). On the build before the fix it failed with 7: the six,
  and "How often and how long should the visits be?".
- **Five DV-105 follow-ups repeated the question they follow word for word.**
  "Where should the visits happen?", answered "Somewhere else", opened a box
  titled "Where should the visits happen?". RULE 19 (blocking) compares each
  question with every question it waits on; before the fix it failed with 5.

The same audit found that the committed `dv-packet-gui.json` did not match what
the sources export: one question in DV-100's "Animals, Property and Support"
sat two places earlier than the flowchart puts it. Everything else matched, two
fresh exports agreed with each other, and the flowcharts and project rebuilt
byte for byte - so the committed export had been taken before a last change to
the sources. It was re-exported and the site republished.

## The ink is wider than pdf-lib measures it

Reading the pages on September 13, CLETS-001's firearms answer ended "... Tes"
at the right edge of its box, and the next line began "Value". Two renderers -
pdf.js and Ghostscript - agreed, so it was the PDF, not the renderer.

pdf-lib's `widthOfTextAtSize` for a standard font subtracts the font's kerning
pairs ("Te" is 120/1000 em narrower, "Va" 70). A PDF's `Tj` is drawn at the
plain advance widths; no viewer kerns it. So every "does this fit" in the
server - the shrink-to-fit, the continuation spill, the ruled layout and
pdf-lib's own appearance providers - was decided on a width about 2% short of
the ink. The firearms line measured 505pt in a 509pt line and printed 516pt.
A plain line drawn on a blank page, with a tick where pdf-lib said it ended,
ran past the tick in Ghostscript: that is how the renderer was ruled out.

`measureAsDrawn` in `dev-server.js` gives the Helvetica each fill embeds a
width function that measures one character at a time, so no pair ever forms
and every layout decision sees the drawn width. `pipeline-fill.js` now reads
each text field's appearance stream and fails any line drawn past the edge of
its box (`--ink` runs that check alone). On the output of the old server it
failed on two lines - the CLETS-001 answer, 5.2pt over, and DV-110's firearms
list, 2.1pt over at 6pt, which the page read had missed; after the fix, none.
Three narratives that had filled their boxes exactly now set at 10.5pt instead
of 11, which is the right answer: at 11 they did not fit.

Not yet done: `pipeline-capacity.js` measures what each box holds with the same
kerned width, so the limits the interview puts on a box are about 2% generous.
Nothing is lost on paper - the server shrinks to the true width and the ink
check fails anything that does not fit - but the limits should be measured the
same way, and rebuilding them means a re-export and a publish.

## Every form the paper asks for, the packet makes

DV-105 item 4a asks "Have all the children listed in 3 lived together for the
last five years?" and says beside No: *"If no, complete form DV-105(A). Do not
complete the section below."* The packet had no DV-105(A). The interview
skipped the section on No, as the paper says, and on September 12 gained a
subtitle under the question: "This packet does not include it: get it from your
court clerk or at courts.ca.gov, fill it out, and attach it to DV-105." A rule
on `form-rules.html` required that sentence.

It is the one thing this tool exists never to say. The filer answers
questions; the packet hands back finished paperwork. So:

- **DV-105(A) is in the packet.** A No to item 4a brings it in (`activates` on
  DV-105, as item 8 brings in DV-108). Its interview goes one group of children
  at a time - one child, or several who have always lived together - asking
  their names, then their homes from the current one back, one address at a
  time behind "Did these children live somewhere else ...?", up to the seven
  rows the paper prints. There are always two groups, because the children did
  not all live together. Box 1, "This form is attached to DV-105", carries the
  name of DV-105's No box, so the one answer ticks both.
- **A form the paper asks for more of gets a second copy.** DV-105(A) holds two
  groups, and its last box says "Check here to list other children with a
  different residence history ... Use another form DV-105(A)". Asked as "Are
  there other children whose homes were different from all the children you
  have listed?", a Yes ticks it and brings in `DV-105(A) (2)`: its own field
  config (`dv105a2`, the same paths with groups 3 and 4) and its own sanitized
  PDF, made from the first copy's download - `"blank": "dv105a.pdf"` in the
  spec, read by `blankOf()` in `packet-forms.js` and `pipeline-sanitize.js`.
  Four groups is the most the packet takes; the second copy's own "use another"
  box is `courtUse`, and its `_why` says so.
- **Why every check missed it.** Every check read the forms the packet had;
  none read what those forms send the filer to get. `pipeline-form-refs.js`
  does. It reads each PDF in reading order - pdf.js returns a linked form number
  after the sentence it sits in ("complete form , Income and Expense
  Declaration" ... "FL-150"), so the runs are sorted by position first - finds
  each sentence that tells someone to complete, fill out, attach, file or turn
  in another form, and fails any form that is neither in the packet nor in the
  spec's `formsNotInPacket`, which says whose form it is. On the old spec it
  failed six: DV-105(A), DV-120 (the restrained person's response), DV-145 (the
  judge's decision), FL-150, FL-155 and SER-001.
  It was first written to follow only sentences that tell the filer to
  complete or attach a form. That is still how DV-105(A) could have slipped:
  a form the paper only points at ("See form SER-001") or lists is just as
  much paperwork. So every form number mentioned anywhere - in the packet's
  PDFs and in the court's own guides to the process, the spec's
  `referenceSources` - must be in the packet, in `formsStillToBuild`, in
  `formsNotInPacket` saying whose it is, or a guide (`-INFO`, or `formsToRead`).
  Its first strict run found twenty that nobody had decided about.
- **The known gaps are printed, not hidden.** FL-150 (DV-100 page 13: "If you
  are asking for child support or spousal support you must also complete form
  FL-150"), its simpler alternative FL-155, and SER-001 (the request for the
  sheriff to serve) are the filer's and not built yet. They are in
  `formsStillToBuild`, and every run of the check prints them. The interview
  does not tell the filer to get them; the fix is to build them.
- **And the wording cannot come back.** `sendsFilerForAForm` in
  `wording-rules.js` ("get it from your court clerk", "fill it out", "attach
  it", "this packet does not include") is refused by `compile-form.js` in any
  question, subtitle or alert, and RULE 20 in `pipeline-audit.js` fails the
  export on any question, subtitle, box, choice or alert. On the old build it
  found the one sentence, and the compiler refused the old DV-105 hints.

The blank came from courts.ca.gov with a plain `curl`; NEW-FORM.md §0 has the
exact command and how to check what came back.

### A form is on only for an answer in a form that is on

The first publish with DV-105(A) passed every check, and its minimum path -
which asks for no custody orders - walked twenty sections, DV-105 and both
copies of DV-105(A) among them. Two things were wrong in the page, and neither
was DV-105(A)'s own:

- `activationNamesForm` accepted a name that is the start of another, so that
  a connector drawn to "DV-109" still found "DV-109 Notice of Court Hearing".
  "DV-105(A)" starts with "DV-105", so DV-105(A)'s rule switched DV-105 on -
  and "DV-105(A) (2)" starts with "DV-105(A)". A rule now belongs to the form it
  names exactly, and a leading name counts only up to a space, and only when no
  form carries the exact name.
- The fill works the path out as if every form were on and then lets the page
  switch forms off. It had answered item 4a No inside DV-105, a form that stays
  off on the minimum path, and that No switched DV-105(A) on. A filer can do
  the same: answer item 4a, then untick the custody request. So an answer now
  brings a form in only while the form it is asked in is itself on
  (`isFormActivatedAt`, following `fromForm` up the chain). The same held for
  DV-108 behind DV-105's abduction answer, which nobody had noticed.

A third thing came out once those two were fixed: the recorded maximum path
held thirty answers inside DV-105(A), a form that path leaves off, and the live
button left none - the nav audit's drift check failed on it. The fill answers a
question, and a round later takes the answer back when its form turns out to be
off; the select empties, but the hidden "<id>_yes" box beside it stayed ticked,
because `createHiddenCheckboxesForAutofilledDropdowns` only ever looked at a
dropdown that holds an answer. It now unticks every box for an answer the
dropdown does not hold. A stale box is not harmless: activation reads it, and
the one for "Are there other children ...?" put the second copy of DV-105(A) in
the step bar of a filer who had never been asked.

The nav audit passed the first build because it checked only that Back retraces
Next. It now also fails any form that is on without a rule that names it
exactly and is unconditional, or is answered in a form that is itself on; on
the old build it named DV-105, DV-105(A) and DV-105(A) (2).

The widest path answers item 4a Yes - the solver prefers Yes - so it fills
DV-105's own table and leaves DV-105(A) off; two branches of one question
cannot both be on one path. DV-105(A) is checked with an answer set that says
No (`pipeline-fill.js <answers> --forms dv105a,dv105a2 --render`) and by hand.

### The questions that bring the rest of the process in

The strict check's first run left the filer's own forms for serving the papers
and going to the hearing: SER-001 or DV-200, DV-160 and DV-165, INT-300, MC-410
and RA-010. None of them hangs off an answer DV-100 already had, so DV-100 now
ends with a short section, "Serving and Your Hearing", of five Yes/No
questions (`choices` in `dv100-hints.json`), and each answer brings its forms
in: the sheriff serving (SER-001) or someone else (DV-200); private information
about a child (DV-160, DV-165); an interpreter (INT-300); a disability
accommodation (MC-410); attending by phone or video (RA-010). FL-150 needs no
new question: it hangs off DV-100's own "Child support" and "Spousal support"
choices under the orders requested.

They sit after DV-100's last asked field, which no `before` could say: that
field is followed only by signatures the form fills itself. `"at": "end"` on a
choice asks it there. And a choice whose `before` names no asked field is now a
NOT ASKED note from the compiler; it used to be dropped without a word.

### What eight new forms taught the audit

Wiring FL-150, SER-001, DV-200, DV-160, DV-165, INT-300, MC-410 and RA-010 in
turned up six places where a check was wrong, not a form:

- **RULE 18 could not see a question reached down two branches.** SER-001
  prints DV-100's firearms answer, asked "when q60 = No, or when q62 is
  answered" - and q62 is asked on q60 = Yes. Neither branch alone proves the
  question is asked, so the rule failed an answer every filer gives. It now
  also tries a question under each answer of a question it depends on, as deep
  as DV-100's three incidents need, counting a step only when it assumes an
  answer: the first version counted every question it looked at and ran out
  of depth four questions short of the first incident. It still catches a real
  gap - with its note removed, DV-160's lawyer name fails again.
- **A blank that is the answer is said, not guessed.** "Who is your lawyer?"
  is asked only after "Do you have a lawyer?" Yes, so a form that prints the
  lawyer's name prints it blank for a filer without one, correctly. The rule
  cannot tell that from DV-140's children, which were blank by mistake, so the
  form's author says it: `"blankWhenNotAsked": "<why>"` on the field in the
  form's field config, and RULE 18 honours it.
- **A block's count posts under the block's own id.** FL-150 item 16a prints
  how many children DV-100's children block holds. The page posts the count as
  `<select name="dv105_child">`, but `postedNames()` read a question by its
  `nameId`, which a block does not have, so RULE 1 called the box unreachable
  and the preview check called it unfilled. Both read `postedNames()`, which
  now adds the block's id.
- **A dropdown ticks `<question>_<answer>`.** SER-001's "home" box is DV-110's
  "Do you know where the person lives?" Yes, posted as the page mirrors every
  dropdown answer. The preview's naming (`node-field-names.js`) knows that
  shape now.
- **RULE 13 reads "not enough space".** DV-160 prints it three times and the
  pattern knew only "need more space". Those three boxes are `courtUse` with
  their reason: the interview holds each answer to what its box prints, and a
  drawn continuation page for longer answers is still to build.
- **The compiler says when it drops a question.** It caught one at once:
  splitting FL-150's "names and ages" box left two hardship questions anchored
  before a field that no longer existed.

And the ink check needs real words: a marker is one long word, which a box
that wraps lines cannot break. DV-160's and MC-410's multi-line boxes failed
with markers and passed with real text.

Four more came out of the nav audit and the page read:

- **A box with a character limit took nothing.** FL-150's and RA-010's caption
  STATE boxes hold two characters; the filer's state arrives spelled out, and
  pdf-lib throws on text longer than a box's limit - the error was caught and
  the answer vanished. `/edit_pdf` now fits a value to the limit first: a US
  state or territory becomes its two-letter code (`stateCode` in
  `dev-server.js`), and anything else is cut and reported as not fitting, so
  `pipeline-fill.js` fails on it. "California" printed "CA" on both.
- **The fill guessed a money box from its name.** `hasValidatedShape` knew an
  amount by the word "amount", so FL-150's household members'
  `monthly_income` got a marker, the money box stripped the letters, and five
  required boxes stayed empty with Next locked. The page draws every amount
  with `inputmode="decimal"`; the fill reads that now.
- **A section that holds only a block is dropped by the export.** FL-150's
  "People Who Live With You" held only the household block and vanished,
  folding the block into "Your Assets". The block now sits behind "Does anyone
  else live with you?" - a question of the section's own, and a list that
  starts at one for everyone who answers Yes. List every row of a block's first
  field in the section, as DV-100 does for other protected people.
- **A choice anchored to a block's row is never asked.** `before` has to name a
  field the form asks, and a block's rows are not; the compiler says NOT ASKED,
  and then invents a gate for whatever waited on the missing choice - worded
  "Do you want to answer this question?". Anchor before the first real field
  that follows the block on the paper.

