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

const SPEC = process.argv[2] || 'dv-packet.spec.json';
const OUT = process.argv[3] || 'dv-packet-project.json';

const CONNECTOR_STYLE = 'shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;'
  + 'nodeType=connector;spacing=12;fontSize=14;align=center;verticalAlign=middle;'
  + 'fillColor=#fff3cd;fontColor=#7a5c00;strokeColor=#e0a800;strokeWidth=3;';

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

function optionCellFor(flowchart, questionNameId, answer) {
  const cells = flowchart.cells || [];
  const question = cells.find((c) => new RegExp('nodeId=' + questionNameId + ';').test(c.style || ''));
  if (!question) return null;
  const wanted = String(answer).trim().toLowerCase();
  const edges = cells.filter((e) => e.edge && e.source === question.id);
  for (const edge of edges) {
    const target = cells.find((c) => c.id === edge.target);
    if (!target) continue;
    const text = String(target.value || '').replace(/<[^>]*>/g, '').trim().toLowerCase();
    if (text === wanted) return target;
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

function main() {
  const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
  const forms = spec.forms.map((entry) => {
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
      pdfPrice: String(entry.price == null ? 0 : entry.price)
    };
    // Rule 5: exactly one group per form, named after the form, holding the
    // sections that actually carry a question.
    flowchart.groups = [{ groupId: 1, name: entry.name, sections: usedSectionNames(flowchart) }];
    return { entry, flowchart };
  });

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
    const unused = sectionNames(flowchart).filter((n) => !flowchart.groups[0].sections.includes(n));
    if (unused.length) console.log('      sections with no questions (dropped from the group): ' + unused.join(', '));
  });
}

main();
