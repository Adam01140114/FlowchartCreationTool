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
      graph.getModel().setValue(cell, renderLabel(name, { style: style }));
    } finally {
      graph.getModel().endUpdate();
    }
  }

  /**
   * The condition a connector waits on, in words, or ''. Hung under End, a
   * connector reads as "always, in this order", and one that waits on a ticked
   * field looked exactly like the others: DV-101 sat first in DV-100's chain,
   * and a filer whose description fitted on DV-100 went straight to CLETS-001
   * wondering why the chain was skipped.
   */
  function conditionOf(cell) {
    const style = (cell && cell.style) || '';
    const words = /activateWhenLabel=([^;]*)/.exec(style);
    if (words && words[1]) return decodeURIComponent(words[1]);
    const ticked = /activateWhenTicked=([^;]*)/.exec(style);
    return ticked && ticked[1] ? 'only when ' + decodeURIComponent(ticked[1]) + ' is ticked' : '';
  }

  function renderLabel(name, cell) {
    const shown = name || '(no target form)';
    const when = conditionOf(cell);
    return '<div style="text-align:center;padding:6px;">'
      + '<strong>&#8618; Connector</strong><br><span style="font-size:12px;">'
      + escapeHtml(shown) + '</span>'
      + (when ? '<br><span style="font-size:11px;font-style:italic;">' + escapeHtml(when) + '</span>' : '')
      + '</div>';
  }

  // Draw every connector from its style, not from the label saved with it, so
  // a project saved before connectors said their condition shows it too. Once,
  // when the editor's graph exists.
  (function drawConnectorLabelsFromStyle() {
    let tries = 0;
    const timer = setInterval(() => {
      const g = window.graph;
      if (!g || typeof g.getLabel !== 'function') {
        if (++tries > 120) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      if (g.__connectorLabelsFromStyle) return;
      g.__connectorLabelsFromStyle = true;
      const base = g.getLabel.bind(g);
      g.getLabel = function (cell) {
        return isConnectorNode(cell) ? renderLabel(getConnectorTarget(cell), cell) : base(cell);
      };
      if (typeof g.refresh === 'function') g.refresh();
    }, 250);
  })();

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
   *
   * The option alone is not enough to recognise the answer later: an option
   * node need not carry a Node ID at all, and a dropdown option never becomes
   * an element of its own in the generated form. So the question that owns the
   * option travels with the rule, and the export turns it into the id the form
   * actually renders.
   */
  function collectProjectConnectors() {
    const out = [];
    // A hand-edited style can carry a target that is not valid percent-encoding.
    // Reading it literally is better than throwing and taking the whole project
    // export down with it.
    const decodeTarget = (raw) => {
      try { return decodeURIComponent(raw); } catch (err) { return String(raw); }
    };
    (window.projectForms || []).forEach((slot, formIndex) => {
      const cells = (slot.flowchart && slot.flowchart.cells) || [];
      const byId = new Map(cells.map((c) => [c.id, c]));
      const sourceOf = (cell) => {
        if (!cell) return null;
        const edge = cells.find((e) => e.edge && e.target === cell.id);
        return edge ? byId.get(edge.source) : null;
      };
      // What feeds a connector is its condition, except when it is the form's
      // End node or another connector. A connector that nothing decides hangs
      // under End, one below the other, so the chart shows where the filer goes
      // once the form is finished - and the one above it in that chain is a
      // place, not an answer. Read as an answer, End became an option labelled
      // "END" that no filer can choose, and every form chained under it stayed
      // switched off.
      const isChainLink = (cell) => /nodeType=(end|connector)(;|$)/.test((cell && cell.style) || '');
      cells.forEach((c) => {
        if (!/nodeType=connector/.test(c.style || '')) return;
        const target = c._connectorTarget
          || (/connectorTarget=([^;]*)/.exec(c.style || '') || [])[1];
        if (!target) return;
        // A connector fed by an option activates its target only when that
        // option is chosen. A connector wired to nothing - or chained under End -
        // activates its target unconditionally, the way to say two forms always
        // travel together.
        const feeder = sourceOf(c);
        // A connector can also wait on a plain field rather than on an option.
        // DV-101 arrives because the description outgrew its box, and the box
        // that records it is ticked by the writing rather than answered - so
        // the field itself is the condition, and the question it hangs off (the
        // one whose writing ticks it) is only where it is drawn.
        const ticked = c._activateWhenTicked
          || decodeTarget((/activateWhenTicked=([^;]*)/.exec(c.style || '') || [])[1] || '')
          || '';
        // Only an answer is a condition. End, a connector above in a chain, or a
        // question the connector hangs beside are places: read as an answer, a
        // question became an "option" labelled with its own question text that
        // no filer can choose.
        const isOptionCell = (cell) => /nodeType=options/.test((cell && cell.style) || '');
        const option = !ticked && !isChainLink(feeder) && isOptionCell(feeder) ? feeder : null;
        const owner = option ? sourceOf(option) : null;
        out.push({
          fromForm: slot.name || ('Form ' + (formIndex + 1)),
          fromFormIndex: formIndex,
          unconditional: !option && !ticked,
          optionNodeId: option ? (option._nameId || option.id) : (ticked || null),
          optionLabel: option ? String(option.value || '').replace(/<[^>]*>/g, '').trim() : null,
          // Per-form question number, renumbered on export; the project export
          // shifts it into the merged numbering.
          questionId: owner && owner._questionId ? String(owner._questionId) : null,
          questionNodeId: owner ? (owner._nameId || '') : '',
          targetForm: decodeTarget(target)
        });
      });
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Connector properties - double-click a connector                     */
  /* ------------------------------------------------------------------ */

  /** One key of an mxGraph style, decoded, or ''. */
  function styleValue(style, key) {
    const m = new RegExp('(?:^|;)' + key + '=([^;]*)').exec(style || '');
    if (!m) return '';
    try { return decodeURIComponent(m[1]); } catch (err) { return m[1]; }
  }

  /** The style with one key set (encoded) or, given no value, removed. */
  function withStyleKey(style, key, value) {
    let out = String(style || '').replace(new RegExp('(^|;)' + key + '=[^;]*;?', 'g'), '$1');
    if (out && !/;$/.test(out)) out += ';';
    if (value) out += key + '=' + encodeURIComponent(value) + ';';
    return out;
  }

  function plainText(cell) {
    return String((cell && (cell._questionText || cell.value)) || '')
      .replace(/<[^>]*>/g, ' ').replace(/&#8618;/g, '').replace(/\s+/g, ' ').trim();
  }

  /** What the connector hangs from, in words, and what that makes it. */
  function describeFeeder(cell) {
    const graph = window.graph;
    const incoming = (graph && graph.getIncomingEdges) ? graph.getIncomingEdges(cell) : [];
    const feeder = incoming && incoming[0] ? incoming[0].source : null;
    if (!feeder) return { kind: 'none', text: 'Nothing - it is not wired to anything, so its form always comes in.' };
    const st = feeder.style || '';
    if (/nodeType=end(;|$)/.test(st)) return { kind: 'end', text: 'End - its form comes in once this form is finished.' };
    if (/nodeType=connector/.test(st)) {
      return { kind: 'chain', text: 'The ' + (getConnectorTarget(feeder) || 'unnamed') + ' connector above it - next in the chain under End.' };
    }
    if (/nodeType=options/.test(st)) {
      const up = graph.getIncomingEdges(feeder);
      const question = up && up[0] ? up[0].source : null;
      return { kind: 'option', text: 'The answer "' + plainText(feeder) + '"'
        + (question ? ' to "' + plainText(question).slice(0, 100) + '"' : '') + '.' };
    }
    if (/nodeType=question/.test(st)) {
      return { kind: 'question', text: 'The question "' + plainText(feeder).slice(0, 100) + '".' };
    }
    return { kind: 'other', text: (plainText(feeder).slice(0, 100) || 'Another node') + '.' };
  }

  /**
   * Everything a connector is, in one place: the form it brings in, what it
   * hangs from, what switches it on, and the note the canvas prints under it.
   * The condition used to live only in the node's style, where nobody could see
   * it - which is how DV-101 sat first under End looking like "always, next".
   */
  function showConnectorProperties(cell) {
    if (!isConnectorNode(cell)) return;
    const graph = window.graph;
    if (!graph) return;
    document.querySelectorAll('.connector-properties-modal').forEach((n) => n.remove());

    const style = cell.style || '';
    const target = getConnectorTarget(cell);
    const ticked = styleValue(style, 'activateWhenTicked') || cell._activateWhenTicked || '';
    const note = styleValue(style, 'activateWhenLabel');
    const feeder = describeFeeder(cell);
    const forms = availableTargets().map((f) => f.name);
    if (target && forms.indexOf(target) === -1) forms.unshift(target);
    const wired = feeder.kind === 'option'
      ? 'When that answer is chosen'
      : 'Always - every filer gets this form';

    const overlay = document.createElement('div');
    overlay.className = 'connector-properties-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.35);z-index:10000;'
      + 'display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border:2px solid #1976d2;border-radius:12px;padding:24px;width:560px;'
      + 'max-width:92vw;max-height:90vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);'
      + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1f2937;';
    const label = 'display:block;font-weight:600;margin:16px 0 6px;';
    const field = 'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;';
    box.innerHTML = ''
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #e0e0e0;">'
      + '<h3 style="margin:0;font-size:18px;">Connector Node Properties</h3>'
      + '<button type="button" data-cp="close" aria-label="Close" style="border:none;background:none;font-size:22px;cursor:pointer;color:#64748b;">&times;</button></div>'
      + '<label style="' + label + '" for="cpTarget">Brings in form</label>'
      + '<select id="cpTarget" style="' + field + '">'
      + forms.map((n) => '<option' + (n === target ? ' selected' : '') + '>' + escapeHtml(n) + '</option>').join('')
      + '</select>'
      + '<span style="' + label + '">Hangs from</span>'
      + '<div style="padding:8px 10px;background:#f1f5f9;border-radius:6px;font-size:14px;">' + escapeHtml(feeder.text) + '</div>'
      + '<div style="font-size:12px;color:#64748b;margin-top:4px;">Move the arrow into this connector on the canvas to change it.</div>'
      + '<span style="' + label + '">Switched on</span>'
      + '<label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;margin:4px 0;cursor:pointer;">'
      + '<input type="radio" name="cpWhen" value="wired"' + (ticked ? '' : ' checked') + '> <span>By what it hangs from: ' + escapeHtml(wired) + '</span></label>'
      + '<label style="display:flex;gap:8px;align-items:flex-start;font-size:14px;margin:4px 0;cursor:pointer;">'
      + '<input type="radio" name="cpWhen" value="ticked"' + (ticked ? ' checked' : '') + '> <span>Only when this box is ticked (a field the form ticks itself, such as an overflow box):</span></label>'
      + '<input id="cpTicked" type="text" placeholder="PDF field name, e.g. other_abuse_incident_additional_space_attached_yes" value="' + escapeHtml(ticked) + '" style="' + field + '">'
      + '<label style="' + label + '" for="cpNote">Note shown under the connector</label>'
      + '<input id="cpNote" type="text" placeholder="e.g. only if item 7f needs more space" value="' + escapeHtml(note) + '" style="' + field + '">'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px;">'
      + '<button type="button" data-cp="cancel" style="padding:8px 16px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;width:auto;">Cancel</button>'
      + '<button type="button" data-cp="save" style="padding:8px 16px;border:none;border-radius:6px;background:#1976d2;color:#fff;cursor:pointer;width:auto;">Save</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const tickedInput = box.querySelector('#cpTicked');
    const syncTicked = () => {
      const on = box.querySelector('input[name="cpWhen"][value="ticked"]').checked;
      tickedInput.disabled = !on;
      tickedInput.style.opacity = on ? '1' : '0.5';
    };
    box.querySelectorAll('input[name="cpWhen"]').forEach((r) => r.addEventListener('change', syncTicked));
    syncTicked();

    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) close(); });
    box.querySelector('[data-cp="close"]').addEventListener('click', close);
    box.querySelector('[data-cp="cancel"]').addEventListener('click', close);
    box.querySelector('[data-cp="save"]').addEventListener('click', () => {
      const newTarget = box.querySelector('#cpTarget').value;
      const useTicked = box.querySelector('input[name="cpWhen"][value="ticked"]').checked;
      const field = tickedInput.value.trim();
      const newNote = box.querySelector('#cpNote').value.trim();
      if (useTicked && !field) {
        window.alert('Name the box that switches this form on, or choose "By what it hangs from".');
        return;
      }
      let next = withStyleKey(cell.style, 'connectorTarget', newTarget);
      next = withStyleKey(next, 'activateWhenTicked', useTicked ? field : '');
      next = withStyleKey(next, 'activateWhenLabel', newNote);
      const model = graph.getModel();
      model.beginUpdate();
      try {
        model.setStyle(cell, next);
        model.setValue(cell, renderLabel(newTarget, { style: next }));
        const geo = cell.geometry ? cell.geometry.clone() : null;
        if (geo) {
          geo.height = newNote || useTicked ? Math.max(geo.height, 80) : geo.height;
          model.setGeometry(cell, geo);
        }
      } finally {
        model.endUpdate();
      }
      cell._connectorTarget = newTarget;
      if (useTicked) cell._activateWhenTicked = field; else delete cell._activateWhenTicked;
      close();
    });
    box.querySelector('#cpTarget').focus();
  }

  window.isConnectorNode = isConnectorNode;
  window.getConnectorTarget = getConnectorTarget;
  window.setConnectorTarget = setConnectorTarget;
  window.chooseConnectorTarget = chooseConnectorTarget;
  window.showConnectorProperties = showConnectorProperties;
  window.addConnectorToCell = addConnectorToCell;
  window.collectProjectConnectors = collectProjectConnectors;
  window.CONNECTOR_STYLE = STYLE;
})();
