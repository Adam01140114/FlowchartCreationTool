# Every form in the domestic violence restraining order process

The packet's promise: **the filer answers questions, and gets back every piece
of paperwork their situation calls for, filled in.** The interview never tells
them to find, fill in or attach a form themselves (rules
`the-packet-makes-every-form-the-paper-asks-for` and
`the-interview-never-sends-the-filer-for-a-form` on `form-rules.html`).

This page lists every Judicial Council form the California process uses, who
completes it, and what the packet does about it. It is kept honest by
`node pipeline-form-refs.js --check` (in `npm run audit`): every form number
mentioned anywhere in the packet's PDFs, or in the court's own guides listed in
`referenceSources` in `dv-packet.spec.json`, must be one of

- in the packet (`forms`),
- the filer's and still to build (`formsStillToBuild` - printed on every run),
- someone else's (`formsNotInPacket`, saying whose),
- outside the packet's scope (`formsOutOfScope`, saying why) - the packet
  covers only the first-filing forms listed in `scope`,
- the continuation form, MC-025, or a form it replaces (`continuation` -
  rule `the-packet-uses-mc025-for-more-space`: anything that needs more space
  goes on MC-025, never on DV-101 or MC-020), or
- a guide that is read, never filed (`-INFO`, or `formsToRead`).

A form nobody has decided about fails the audit. That is how DV-105(A) got
through: DV-105 item 4a said "complete form DV-105(A)", no check read what the
forms send the filer to get, and the interview told the filer to get it from
the clerk. See `PIPELINE.md`, "Every form the paper asks for, the packet makes".

---

## Getting a form in

1. **Download the blank.** `curl` from `https://courts.ca.gov/documents/<form>.pdf`
   (lower case, punctuation dropped: `dv105a.pdf`, `fl150.pdf`, `dv505info.pdf`)
   and check it is a PDF - [`NEW-FORM.md` §0](./NEW-FORM.md) has the exact
   command and the checks. The user has given standing permission to download
   PDFs; say in your report what you fetched. A guide the audit should read goes
   in `reference-forms/` and in `referenceSources`.
2. **Build it** - [`NEW-FORM.md`](./NEW-FORM.md) and
   [`PIPELINE.md`](./PIPELINE.md) "Adding a form to the packet": field config,
   hints, sanitize, compile.
3. **Say what brings it in** - an `activates` entry in `dv-packet.spec.json` on
   the question whose answer calls for it. A form the paper asks for more than
   once gets a second copy from the same blank (`"blank"`, as DV-105(A) (2)).
4. **Take it out of `formsStillToBuild`**, rebuild and audit in order
   ([`AUDIT.md` §2-3](./AUDIT.md)), publish, and read its pages.
5. **Update the tables below.**

---

## The packet: first-filing forms

**The packet covers exactly these sixteen forms** - the forms used to open a
new California DVRO case, as the user listed them on September 14, 2026
(`scope` in `dv-packet.spec.json`). `pipeline-form-refs.js --check` fails a
packet form outside the list, or a listed form nothing makes. Each comes in on
the answer that calls for it; the filer never asks for one by name.

"Filer" is the person asking for protection (Person in 1); "other person" is the
person to be restrained (Person in 2).

### 1. Core first filing

| Form | What it is | Who completes it | Comes in when |
|---|---|---|---|
| DV-100 | Request for Domestic Violence Restraining Order | Filer | Always |
| CLETS-001 | Confidential Information for Law Enforcement | Filer | Always |
| DV-109 | Notice of Court Hearing | Court; the filer's identifying items (from DV-100) | Always |
| DV-110 | Temporary Restraining Order | Court; the filer's identifying and requested-order items (from DV-100) | Always |

### 2. Children, custody and abduction

| Form | What it is | Who completes it | Comes in when |
|---|---|---|---|
| DV-105 | Request for Child Custody and Visitation Orders | Filer | "Child custody and visitation" among DV-100's orders |
| DV-105(A) | Child residence history | Filer | DV-105 item 4a answered No; a second copy when children have a different history |
| DV-140 | Child Custody and Visitation Order | Court; the filer's identifying and proposed items (from DV-100 and DV-105) | With DV-105 |
| DV-108 | Request for Orders to Prevent Child Abduction | Filer | DV-105 item 8 answered Yes |
| DV-145 | Order to Prevent Child Abduction (attached to DV-140) | Court; the filer's identifying and proposed items (from DV-108) | With DV-108 |

### 3. Support and lawyer's fees

| Form | What it is | Who completes it | Comes in when |
|---|---|---|---|
| FL-150 | Income and Expense Declaration | Filer | Spousal support or lawyer's fees asked for; or child support with any DV-570 screening answer Yes |
| FL-155 | Financial Statement (Simplified) | Filer | Child support only, and every DV-570 screening answer No - the packet then uses the simpler form |

DV-570 is read for the filer, never handed to them: DV-100 asks its four
remaining questions (self-employed; the other person asking for spousal support;
the other person asking for lawyer's fees; income outside DV-570's list), each
only after a No to the one before.

### 4. A minor's information

| Form | What it is | Who completes it | Comes in when |
|---|---|---|---|
| DV-160 | Request to Keep Minor's Information Confidential | Filer | "Private information about a child" answered Yes |
| DV-165 | Order on Request to Keep Minor's Information Confidential | Court; the filer's items 1-2 | With DV-160 |

### 5. Attachments and declarations

| Form | What it is | Who completes it | Comes in when |
|---|---|---|---|
| MC-025 | Attachment - the continuation page for any form | Filled from the answers, never asked | Any answer longer than its box, any list longer than its rows (`continuation` in the spec) |
| MC-030 | Declaration | Filer | The filer wants to add a sworn statement of their own |
| MC-031 | Attached Declaration (attached to DV-100) | A witness | Someone else gives a sworn statement |

DV-101 and MC-020, which the paper names for more space, are replaced by MC-025.

## Outside this packet

Every other form the paperwork names is declared in the spec, so the audit
knows it was decided about - and the interview never sends the filer for one:

- **Out of scope** (`formsOutOfScope`): SER-001 and DV-200 (serving the papers,
  after filing), INT-300, MC-410 and RA-010 (requests about the hearing) - all
  five were in the packet until September 14, 2026 - and the filer's
  later-stage forms: DV-112, DV-115, DV-130, DV-175, DV-250, DV-305, DV-310.
- **Someone else's** (`formsNotInPacket`): the court's orders and findings
  (DV-116, DV-117, DV-150, DV-170, DV-820, FL-342, FL-343 and the like), the
  other person's responses (DV-120, DV-125, DV-325), firearms receipts and
  notices (DV-800 / JV-270, DV-805 and on).
- **Separate processes**: renewing the order (DV-700 and on) and changing or
  ending it (DV-300 and on).

### Fees

None: there is no fee to file, renew or change a domestic violence restraining
order, and the sheriff serves it free. No fee waiver (FW-001) is needed.

### Guides - read, never filed

DV-500-INFO, DV-505-INFO, DV-520-INFO, DV-530-INFO, DV-570 (which financial
form), DV-105-INFO, DV-115-INFO, DV-120-INFO, DV-160-INFO, DV-200-INFO,
DV-205-INFO, DV-300-INFO, DV-700-INFO, DV-800-INFO, MC-410-INFO. What they tell
the filer is built into the interview instead: nobody has to read one to finish.

### Not yet confirmed

- Whether DV-330 fully replaced DV-400 (Findings and Order to Terminate); the
  self-help pages disagree.
- Which DV-130 item says whether the order must be served (item 30 or 32(b));
  the January 2026 revision may have renumbered it.
- Whether any DV-710 items are the filer's.
