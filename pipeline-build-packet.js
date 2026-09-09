#!/usr/bin/env node
/**
 * Assemble compiled flowcharts into one project the editor can open.
 *
 * Each form compiles on its own (compile-form.js), but a packet is more than a
 * list of forms: it needs the connectors that decide when a later form is asked,
 * one group per form so the progress bar counts forms rather than sections, and
 * each form's own PDF so the packet finishes with one filled PDF per form.
 * Doing that by hand is how a project drifts from the flowcharts it came from.
 *
 * Spec (JSON):
 *   { "project": "DV Restraining Order Packet",
 *     "forms": [ { "name": "DV-100", "title": "...", "flowchart": "dv100-flowchart.json",
 *                  "pdf": "dv100.pdf", "activates": ["DV-109"] } ] }
 *
 * "activates" names the forms this one switches on. A connector with no option
 * feeding it activates its target unconditionally - the way to say two forms
 * always travel together. To make one conditional, give the entry
 * { "form": "DV-110", "whenQuestion": "<nameId>", "isAnswer": "Yes" } and the
 * connector is wired to that option instead.
 *
 * Usage: node pipeline-build-packet.js [spec.json] [out.json]
 */
const fs = require('fs');
const path = require('path');
const OUT_DIR = 'FormWiz GUI';

const SPEC = process.argv[2] || 'dv-packet.spec.json';
const OUT = process.argv[3] || 'dv-packet-project.json';
const DISQUALIFIERS = process.argv[4] || 'dv-packet-disqualifiers.json';
const alerted = {};

const CONNECTOR_STYLE = 'shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;'
  + 'nodeType=connector;spacing=12;fontSize=14;align=center;verticalAlign=middle;'
  + 'fillColor=#fff3cd;fontColor=#7a5c00;strokeColor=#e0a800;strokeWidth=3;';

/**
 * How many pages a form has, read from the PDF rather than written down.
 *
 * DV-100 item 32 asks how many extra pages are attached, and the answer is the
 * length of the attachments. Counting them here means the number cannot go
 * stale when a form is revised.
 */
async function pageCount(pdfFile) {
  const { PDFDocument } = require('pdf-lib');
  for (const file of [path.join(OUT_DIR, pdfFile), pdfFile]) {
    if (!fs.existsSync(file)) continue;
    try {
      const doc = await PDFDocument.load(fs.readFileSync(file), { ignoreEncryption: true });
      return doc.getPageCount();
    } catch (e) { /* the unsanitized original is encrypted; try the next one */ }
  }
  return 0;
}

const nextId = (cells) => String(Math.max(0, ...cells
  .map((c) => parseInt(c.id, 10)).filter((n) => !isNaN(n))) + 1);

/** Section names in the order the compiler numbered them. */
function sectionNames(flowchart) {
  return Object.keys(flowchart.sectionPrefs || {})
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => (flowchart.sectionPrefs[k] || {}).name)
    .filter(Boolean);
}

/** Sections that actually hold a question — an empty section is a dead step. */
function usedSectionNames(flowchart) {
  const used = new Set();
  (flowchart.cells || []).forEach((c) => {
    const m = /(?:^|;)section=(\d+)/.exec(c.style || '');
    if (m) used.add(m[1]);
  });
  return Object.keys(flowchart.sectionPrefs || {})
    .sort((a, b) => Number(a) - Number(b))
    .filter((k) => used.has(k))
    .map((k) => (flowchart.sectionPrefs[k] || {}).name)
    .filter(Boolean);
}

/**
 * Find the option cell for one answer to one question.
 *
 * A question does not always reach its options directly. An exclusive choice
 * wires each option straight off the question, but a multi-select puts a merge
 * hub in between - the layout needs somewhere for several checked boxes to
 * rejoin - so "Child custody and visitation" sits one hop further out than
 * "Yes" does. Hubs are transparent everywhere else in this pipeline and they
 * are transparent here too, or a connector could only ever hang off a Yes/No.
 */
function optionCellFor(flowchart, questionNameId, answer) {
  const cells = flowchart.cells || [];
  const question = cells.find((c) => new RegExp('nodeId=' + questionNameId + ';').test(c.style || ''));
  if (!question) return null;
  const wanted = String(answer).trim().toLowerCase();
  const byId = new Map(cells.map((c) => [c.id, c]));
  const isHub = (c) => /nodeType=(mergeHub|hub)/.test(c.style || '');
  const isOption = (c) => /nodeType=options/.test(c.style || '');

  const seen = new Set([question.id]);
  let frontier = [question.id];
  for (let hop = 0; hop < 4 && frontier.length; hop++) {
    const next = [];
    for (const from of frontier) {
      for (const edge of cells.filter((e) => e.edge && e.source === from)) {
        const target = byId.get(edge.target);
        if (!target || seen.has(target.id)) continue;
        seen.add(target.id);
        if (isOption(target)) {
          const text = String(target.value || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
          if (text === wanted) return target;
        } else if (isHub(target)) {
          next.push(target.id);
        }
      }
    }
    frontier = next;
  }
  return null;
}

function addConnector(flowchart, targetForm, from) {
  const cells = flowchart.cells;
  const id = nextId(cells);
  const anchor = from || cells.filter((c) => c.vertex)
    .reduce((low, c) => (c.geometry.y > (low ? low.geometry.y : -1) ? c : low), null);
  const y = anchor ? anchor.geometry.y + (anchor.geometry.height || 60) + 60 : 80;
  const x = anchor ? anchor.geometry.x : 80;
  cells.push({
    id, vertex: true, edge: false,
    value: '<div style="text-align:center;padding:6px;"><strong>&#8618; Connector</strong>'
      + '<br><span style="font-size:12px;">' + targetForm + '</span></div>',
    style: CONNECTOR_STYLE + 'connectorTarget=' + encodeURIComponent(targetForm) + ';',
    geometry: { x, y, width: 180, height: 60 },
    _connectorTarget: targetForm
  });
  if (from) {
    cells.push({
      id: nextId(cells), vertex: false, edge: true, value: '',
      style: 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;',
      geometry: { x: 0, y: 0, width: 0, height: 0 },
      source: from.id, target: id
    });
  }
  return id;
}

const ALERT_STYLE = 'shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;'
  + 'nodeType=options;questionType=alertNode;spacing=12;fontSize=14;align=center;'
  + 'verticalAlign=middle;strokeWidth=3;fillColor=#ffffff;fontColor=#1976d2;strokeColor=#1976d2;';
const EDGE_STYLE = 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;';
const NEGATE_STYLE = EDGE_STYLE + 'alertNegate=1;dashed=1;strokeColor=#d32f2f;';

/**
 * Turn each declared disqualifier into an alert node wired to the answers that
 * trigger it.
 *
 * These were wired by hand once, into the built project rather than into
 * anything the build reads - so the next rebuild silently dropped all four, and
 * the packet went out with the rules declared and none of them implemented.
 * That is the failure the disqualifiers file exists to prevent, so the build
 * does the wiring now: dv-packet-disqualifiers.json is the source, and a
 * condition that names an answer no question offers is an error, not a warning.
 *
 * A condition is an arrow. "is" points from the option that must be chosen;
 * "isNot" and "noneOf" point from the options that must not be, marked NOT.
 */
function wireDisqualifiers(flowchart, formName, declared) {
  const mine = declared.filter((d) => d.form === formName);
  if (!mine.length) return 0;
  const cells = flowchart.cells;

  // A column to the right of everything else, so an alert never lands on top of
  // a question the router already placed.
  const vertices = cells.filter((c) => c.vertex && c.geometry);
  const x = Math.max(...vertices.map((c) => c.geometry.x + (c.geometry.width || 0))) + 240;
  let y = Math.min(...vertices.map((c) => c.geometry.y));

  mine.forEach((d) => {
    const id = nextId(cells);
    cells.push({
      id, vertex: true, edge: false,
      value: '<div style="text-align:center;padding:6px;"><strong>ALERT</strong>'
        + '<br><span style="font-size:12px;">' + d.id + '</span></div>',
      style: ALERT_STYLE + 'nodeId=' + d.id + ';',
      geometry: { x, y, width: 320, height: 130 },
      _questionText: d.message,
      _alertText: d.message,
      _alertMode: d.mode === 'any' ? 'any' : 'all',
      _disqualifierId: d.id
    });
    y += 260;

    (d.when || []).forEach((condition) => {
      const negated = condition.op === 'isNot' || Array.isArray(condition.noneOf);
      const values = Array.isArray(condition.noneOf)
        ? condition.noneOf
        : (Array.isArray(condition.anyOf) ? condition.anyOf : [condition.value]);
      values.forEach((value) => {
        const option = optionCellFor(flowchart, condition.question, value);
        if (!option) {
          throw new Error(d.id + ': question "' + condition.question + '" has no answer "'
            + value + '" to wire the alert to');
        }
        cells.push({
          id: nextId(cells), vertex: false, edge: true, value: negated ? 'NOT' : '',
          style: negated ? NEGATE_STYLE : EDGE_STYLE,
          geometry: { x: 0, y: 0, width: 0, height: 0 },
          source: option.id, target: id
        });
      });
    });
  });
  return mine.length;
}

async function main() {
  const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
  const forms = [];
  for (const entry of spec.forms) {
    const flowchart = JSON.parse(fs.readFileSync(entry.flowchart, 'utf8'));
    // The form's identity, not its PDF's title. The editor renames a project
    // slot from this every time it loads the form, and a connector points at
    // the slot by name - so titling the flowchart "DV-109 Notice of Court
    // Hearing" renamed the slot out from under the connector to "DV-109" and
    // switched the form off. The title still reaches the PDF below.
    flowchart.formName = entry.name;
    flowchart.defaultPdfProperties = {
      pdfName: entry.title || entry.name,
      pdfFile: entry.pdf,
      pdfPrice: String(entry.price == null ? 0 : entry.price),
      pdfPages: await pageCount(entry.pdf)
    };
    // Rule 5: exactly one group per form, named after the form, holding the
    // sections that actually carry a question.
    flowchart.groups = [{ groupId: 1, name: entry.name, sections: usedSectionNames(flowchart) }];
    forms.push({ entry, flowchart });
  }

  forms.forEach(({ entry, flowchart }) => {
    (entry.activates || []).forEach((activation) => {
      const target = typeof activation === 'string' ? activation : activation.form;
      const option = (activation && activation.whenQuestion)
        ? optionCellFor(flowchart, activation.whenQuestion, activation.isAnswer)
        : null;
      if (activation && activation.whenQuestion && !option) {
        throw new Error(entry.name + ': no option "' + activation.isAnswer + '" under question "'
          + activation.whenQuestion + '" to hang the ' + target + ' connector on');
      }
      addConnector(flowchart, target, option);
    });
  });

  const declared = fs.existsSync(DISQUALIFIERS)
    ? (JSON.parse(fs.readFileSync(DISQUALIFIERS, 'utf8')).disqualifiers || []) : [];
  forms.forEach(({ entry, flowchart }) => {
    const n = wireDisqualifiers(flowchart, entry.name, declared);
    if (n) alerted[entry.name] = n;
  });

  const project = {
    type: 'flowchart-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    projectName: spec.project || 'Packet',
    currentFormIndex: 0,
    forms: forms.map(({ entry, flowchart }) => ({ name: entry.name, flowchart }))
  };
  fs.writeFileSync(OUT, JSON.stringify(project, null, 2));

  console.log('packet: ' + OUT);
  forms.forEach(({ entry, flowchart }) => {
    const questions = (flowchart.cells || []).filter((c) => /nodeType=question/.test(c.style || '')).length;
    const connectors = (flowchart.cells || []).filter((c) => /nodeType=connector/.test(c.style || ''));
    console.log('  ' + entry.name.padEnd(8) + questions + ' questions'
      + '  group "' + flowchart.groups[0].name + '" over ' + flowchart.groups[0].sections.length + ' section(s)'
      + '  pdf ' + entry.pdf
      + (connectors.length ? '  -> ' + connectors.map((c) => c._connectorTarget).join(', ') : ''));
    if (alerted[entry.name]) console.log('      ' + alerted[entry.name] + ' disqualifier alert(s) wired from ' + DISQUALIFIERS);
    const unused = sectionNames(flowchart).filter((n) => !flowchart.groups[0].sections.includes(n));
    if (unused.length) console.log('      sections with no questions (dropped from the group): ' + unused.join(', '));
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
