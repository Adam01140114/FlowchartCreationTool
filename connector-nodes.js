/**
 * Connector nodes — link an option in one form to another form in the project.
 *
 * A connector hangs off an option node and names a target form. When the whole
 * project is generated, a non-primary form is only asked if some option that
 * connects to it was chosen; otherwise its sections are skipped. That is how
 * DV-100 / DV-109 / DV-110 stay separate flowcharts while still producing one
 * interview that only asks what the situation calls for.
 *
 * The target is stored on the cell as `_connectorTarget` (a form name) so it
 * survives export/import, and mirrored into the style as `connectorTarget=` so
 * it is visible in the raw JSON.
 */
(function () {
  'use strict';

  const STYLE = 'shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;'
    + 'nodeType=connector;spacing=12;fontSize=14;align=center;verticalAlign=middle;'
    + 'fillColor=#fff3cd;fontColor=#7a5c00;strokeColor=#e0a800;strokeWidth=3;';

  function isConnectorNode(cell) {
    if (!cell || !cell.style) return false;
    return /nodeType=connector/.test(cell.style);
  }

  /** Target form name, or '' when unset. */
  function getConnectorTarget(cell) {
    if (!cell) return '';
    if (cell._connectorTarget) return cell._connectorTarget;
    const m = /connectorTarget=([^;]*)/.exec(cell.style || '');
    return m ? decodeURIComponent(m[1]) : '';
  }

  function setConnectorTarget(cell, formName) {
    if (!cell) return;
    const name = String(formName || '');
    cell._connectorTarget = name;

    let style = (cell.style || '').replace(/connectorTarget=[^;]*;?/g, '');
    if (name) style += 'connectorTarget=' + encodeURIComponent(name) + ';';

    const graph = window.graph;
    if (!graph) return;
    graph.getModel().beginUpdate();
    try {
      graph.getModel().setStyle(cell, style);
      graph.getModel().setValue(cell, renderLabel(name));
    } finally {
      graph.getModel().endUpdate();
    }
  }

  function renderLabel(name) {
    const shown = name || '(no target form)';
    return '<div style="text-align:center;padding:6px;">'
      + '<strong>&#8618; Connector</strong><br><span style="font-size:12px;">'
      + escapeHtml(shown) + '</span></div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /** Form names in the project, minus the one being edited. */
  function availableTargets() {
    const forms = window.projectForms || [];
    return forms
      .map((f, i) => ({ index: i, name: f.name || ('Form ' + (i + 1)) }))
      .filter((f) => f.index !== window.currentFormIndex);
  }

  /**
   * Prompt for the target form. Uses the project's own form list so the target
   * is always a form that exists rather than free text.
   */
  function chooseConnectorTarget(cell) {
    if (!isConnectorNode(cell)) return;
    const targets = availableTargets();
    if (!targets.length) {
      window.alert('Add another form to the project first — a connector needs somewhere to point.');
      return;
    }
    const current = getConnectorTarget(cell);
    const menu = targets.map((t, i) => (i + 1) + ') ' + t.name).join('\n');
    const answer = window.prompt(
      'Which form should this connect to?\n\n' + menu
        + '\n\nEnter a number' + (current ? ' (currently: ' + current + ')' : '') + ':',
      ''
    );
    if (answer === null) return;
    const pick = targets[parseInt(answer, 10) - 1];
    if (!pick) {
      window.alert('No form matches "' + answer + '".');
      return;
    }
    setConnectorTarget(cell, pick.name);
  }

  /** Place a connector under a cell and wire an edge from it. */
  function addConnectorToCell(sourceCell) {
    const graph = window.graph;
    if (!graph || !sourceCell) return null;
    const geo = sourceCell.geometry;
    const parent = graph.getDefaultParent();
    let node = null;
    graph.getModel().beginUpdate();
    try {
      node = graph.insertVertex(
        parent, null, renderLabel(''),
        geo.x, geo.y + geo.height + 50, 180, 60, STYLE
      );
      graph.insertEdge(parent, null, '', sourceCell, node);
    } finally {
      graph.getModel().endUpdate();
    }
    chooseConnectorTarget(node);
    return node;
  }

  /**
   * Every connector in the project, as {fromForm, optionNodeId, targetForm}.
   * Reads the stored slots, so capture the live graph first.
   */
  function collectProjectConnectors() {
    const out = [];
    (window.projectForms || []).forEach((slot, formIndex) => {
      const cells = (slot.flowchart && slot.flowchart.cells) || [];
      const byId = new Map(cells.map((c) => [c.id, c]));
      cells.forEach((c) => {
        if (!/nodeType=connector/.test(c.style || '')) return;
        const target = c._connectorTarget
          || (/connectorTarget=([^;]*)/.exec(c.style || '') || [])[1];
        if (!target) return;
        // A connector fed by an option activates its target only when that
        // option is chosen. A connector wired to nothing activates its target
        // unconditionally - the way to say two forms always travel together.
        const feeder = cells.find((e) => e.edge && e.target === c.id);
        const option = feeder ? byId.get(feeder.source) : null;
        out.push({
          fromForm: slot.name || ('Form ' + (formIndex + 1)),
          fromFormIndex: formIndex,
          unconditional: !option,
          optionNodeId: option ? (option._nameId || option.id) : null,
          optionLabel: option ? String(option.value || '').replace(/<[^>]*>/g, '').trim() : null,
          targetForm: decodeURIComponent(target)
        });
      });
    });
    return out;
  }

  window.isConnectorNode = isConnectorNode;
  window.getConnectorTarget = getConnectorTarget;
  window.setConnectorTarget = setConnectorTarget;
  window.chooseConnectorTarget = chooseConnectorTarget;
  window.addConnectorToCell = addConnectorToCell;
  window.collectProjectConnectors = collectProjectConnectors;
  window.CONNECTOR_STYLE = STYLE;
})();
