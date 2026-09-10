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
The maximum path gives 11: DV-101 (2) + DV-105 (6) + three separate sheets.

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

## Running out of space is what brings in the continuation form

DV-100 item 7 ends with *"Check this box if you need more space to describe the
abuse. You can use form DV-101"* — and asked as a question, that is asking
someone to predict, before they have written a word, whether what they are about
to say will fit in a box whose size they cannot see. Nobody knows that.

They need more space exactly when they have used more than the box holds, and
the box has been measured. So the question is gone. Both ends of the link are
dropped from the interview by the compiler, and the form simply notices:

```json
"overflow": {
  "other_abuse_incident_details": {
    "form": "DV-101",
    "field": "dv101_further_abuse_description",
    "marks": "other_abuse_incident_additional_space_attached_yes"
  }
}
```

Past the printable length the attachment box is ticked, DV-101 switches on, and
what the first box cannot print is carried onto DV-101 item 5. The limit the
filer meets is the sum of what the two boxes hold — 1115 + 387 — which is the
extra space, honestly counted.

**The continuation carries the remainder, not a copy.** The intent was to put
the whole answer on DV-101 so the attachment reads on its own, and the paper
does not allow it: DV-100 item 7 holds 1115 characters and DV-101 item 5, the
box that continues it, holds 387. Copying the whole answer there would print a
clipped one, and a court document that is unreadable at the bottom is worse than
one that is split. The two boxes read as one passage instead, nothing is lost,
and nothing is cut. `overflowSplit()` is one function for both readers — the
live form writing the tail as it is typed, and the payload trimming the head on
the way out — because a split computed twice drops a word between the two pages
or prints it on both.

Three things had to be got right for this to work at all, and each looked like
the feature not working:

- The condition lives in the **connector cell's style**, beside
  `connectorTarget`. Set as a property on the cell it did not survive the
  editor's canvas round trip, and the rule exported as `unconditional: true`.
- `applyFieldCapacities` runs again every time the form grows a field, and put
  the narrow cap back within a frame of `applyOverflowLinks` removing it. A box
  that can spill is now skipped by that sweep.
- The maximum path has to **go over the edge on purpose**. Stopping at what the
  box prints leaves the continuation form switched off and its page blank, and
  the value is built so the split lands exactly on the two boxes' limits rather
  than wherever a word boundary falls — letting it fall put ten characters more
  on DV-101 than DV-101 holds, which is testing the overflow by overflowing.

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
the one after it.

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

## Running it

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
node pipeline-audit.js
node pipeline-disqualifiers.js --check    # every declared one has an alert

# 6. fill the form (debug menu: Ctrl+Shift, then "Fill maximum path"),
#    save the answers, and produce the PDFs
node pipeline-fill.js --render   # every form in the packet, not a list kept here
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
checkbox ticked at all. It measures the opposite thing - that a gate answered No
actually closes the block behind it. A form can pass the widest path and fail
this one, which is how thirty questions about further abuse stayed on screen for
a filer who had just said it happened once.

Run both. Neither is sufficient alone, and each takes a few seconds.

Either can be run on a page the other has already filled. A fill clears the
questions its path does not reach, the way the generated logic clears a question
it closes, so a minimum run does not inherit a maximum run's answers - it used
to, and reported nineteen ticked boxes on the run whose whole job is to show
that unticked gates close their blocks.

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
