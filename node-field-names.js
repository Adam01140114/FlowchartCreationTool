/**
 * Which PDF fields a flowchart node fills, named the way the generated form
 * names them.
 *
 * Shared by the editor's PDF preview (pdf-preview.js), which marks those boxes
 * when a node is selected, and by pipeline-node-fields.js, which holds the
 * preview to what the exported form really posts. One copy, so that check can
 * never pass on a rule the editor does not run.
 *
 * What differs between the two is where the chart comes from - the editor asks
 * mxGraph, the check reads saved cells - so the two things read from the chart
 * are passed in: `targetsOf(cell)`, the cells a node's arrows lead to, and the
 * chart's joins, from joinsFromCells().
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NodeFieldNames = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_ENTRIES = 12;    // the most entries of a numbered block looked for

  function styled(cell, token) {
    return !!(cell && cell.style && String(cell.style).indexOf(token) !== -1);
  }

  /** The id a node goes by: its _nameId, or the nodeId written into its style. */
  function nodeIdOf(cell) {
    if (!cell) return '';
    if (cell._nameId) return String(cell._nameId).trim();
    const m = cell.style && String(cell.style).match(/nodeId=([^;]+)/);
    if (!m) return '';
    try { return decodeURIComponent(m[1]).trim(); } catch (e) { return m[1].trim(); }
  }

  /** The option nodes a question leads to, through its split hub if it has one. */
  function optionCellsOf(cell, targetsOf) {
    const found = [];
    if (typeof targetsOf !== 'function') return found;
    const seen = {};
    const walk = function (from, depth) {
      if (depth > 2) return;
      (targetsOf(from) || []).forEach(function (t) {
        if (!t || seen[t.id]) return;
        seen[t.id] = true;
        if (styled(t, 'nodeType=options')) found.push(t);
        else if (styled(t, 'nodeType=mergeHub')) walk(t, depth + 1);
      });
    };
    walk(cell, 0);
    return found;
  }

  /** The entry numbers a numbered block offers, from its "how many?" range. */
  function entryNumbers(cell) {
    const two = cell._twoNumbers;
    const first = Math.max(1, parseInt(two && two.first, 10) || 1);
    const last = Math.min(Math.max(first, parseInt(two && two.second, 10) || first),
      first + MAX_ENTRIES - 1);
    const out = [];
    for (let n = first; n <= last; n++) out.push(n);
    return out;
  }

  /** An address title as a name part - the editor's own rule when it is loaded. */
  function titlePart(title) {
    if (typeof window !== 'undefined' && typeof window.sanitizeNameId === 'function') {
      return window.sanitizeNameId(title);
    }
    // graph.js's fallback, written out.
    return String(title).toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^a-z0-9\s_]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')
      .trim();
  }

  /**
   * The fields one cell writes to, in the spellings the generated form uses.
   *
   * A box of a multi-textbox question is named two ways, and both are in use:
   * some boxes carry their whole field name (person_asking_protection_name),
   * others only the part after the question's (address, which the form prints
   * as <question>_address). So both are looked for; a name that matches nothing
   * costs nothing. A numbered block puts the entry number where {n} stands, or
   * after the name when there is no {n}. An address is asked once and printed
   * as its parts.
   */
  function ownNames(cell, add) {
    const base = nodeIdOf(cell);
    add(base);
    // One answer printed on several pages is several fields.
    (cell._mirrorTargets || []).forEach(add);

    const numbers = styled(cell, 'questionType=multipleDropdownType') ? entryNumbers(cell) : [];
    const each = numbers.length ? numbers : [1];
    const perEntry = function (name) {
      add(name);
      numbers.forEach(function (n) { add(name + '_' + n); });
    };
    const numbered = function (name) {
      each.forEach(function (n) { add(name.split('{n}').join(String(n))); });
    };

    (cell._textboxes || []).forEach(function (box) {
      const id = String((box && box.nameId) || '').trim();
      if (!id) return;
      if (id.indexOf('{n}') !== -1) { if (base) numbered(base + '_' + id); return; }
      perEntry(id);
      if (base) perEntry(base + '_' + id);
    });

    // A choice inside a numbered block carries its whole field name itself.
    (cell._checkboxes || []).forEach(function (group) {
      ((group && group.options) || []).forEach(function (option) {
        const id = String((option && option.nodeId) || '').trim();
        if (id) { if (id.indexOf('{n}') !== -1) numbered(id); else perEntry(id); }
        ((option && option.linkedFields) || []).forEach(function (linked) {
          const title = String((linked && (linked.title || linked.nodeId)) || '').trim();
          if (title) perEntry(title);
        });
      });
    });

    // A choice inside a multi-textbox question - a gender between the name and
    // the age - ticks one box per option, and the option carries its name.
    (cell._dropdowns || []).forEach(function (dropdown) {
      ((dropdown && dropdown.options) || []).forEach(function (option) {
        const id = String((option && option.nodeId) || '').trim();
        if (id) { if (id.indexOf('{n}') !== -1) numbered(id); else perEntry(id); }
      });
    });

    if (base && cell._locationIndex !== undefined && cell._locationIndex !== null) {
      let prefix = base;
      const title = String(cell._locationTitle || '').trim();
      if (title) {
        const part = titlePart(title);
        if (part) prefix = base + '_' + part;
      }
      ['street', 'city', 'state', 'state_short', 'zip', 'address'].forEach(function (p) {
        perEntry(prefix + '_' + p);
      });
    }
  }

  /**
   * The boxes that join several answers, from a chart's Linked Logic nodes:
   * [{ into: 'court_name_and_street_address', from: ['court_name', 'court_street_address'] }].
   *
   * Read the way the export reads them (library.js), so a join the form prints
   * is a join the preview knows: spaces in a part become underscores, and a
   * part numbered for another entry takes the joined box's entry number.
   */
  function joinsFromCells(cells) {
    const out = [];
    (cells || []).forEach(function (cell) {
      if (!styled(cell, 'nodeType=linkedLogic')) return;
      const into = String(cell._linkedLogicNodeId || '').trim();
      const parts = Array.isArray(cell._linkedFields) ? cell._linkedFields : [];
      if (!into || !parts.length) return;
      const entry = into.match(/_(\d+)$/);
      out.push({
        into: into,
        from: parts.map(function (f) {
          const name = String(f).replace(/\s+/g, '_');
          return entry ? name.replace(/_(\d+)$/, '_' + entry[1]) : name;
        })
      });
    });
    return out;
  }

  /**
   * Every field name a cell could be pointing at, its own id first.
   *
   * A checkbox or dropdown question is often only a heading on the paper - the
   * boxes belong to its options - so a question also reaches through to the
   * options it leads to. Without that, half the questions in the DV packet were
   * reported in red as matching no field, which is the one thing the preview is
   * trusted to say.
   *
   * And an answer printed inside a joined box fills that box too: "court name"
   * and "court street address" are asked as two questions and printed in one.
   */
  function namesOf(cell, targetsOf, joins) {
    if (!cell) return [];
    const out = [];
    const add = function (v) {
      const s = String(v == null ? '' : v).trim();
      if (s && out.indexOf(s) === -1) out.push(s);
    };
    ownNames(cell, add);
    if (!styled(cell, 'nodeType=options')) {
      const base = nodeIdOf(cell);
      const dropdown = styled(cell, 'questionType=dropdown');
      optionCellsOf(cell, targetsOf).forEach(function (option) {
        ownNames(option, add);
        // A dropdown's answer also ticks a box of its own, "<question>_<answer>",
        // named as the page names it (createHiddenCheckboxesForAutofilledDropdowns).
        // SER-001 prints DV-110's "Do you know where they live?" Yes that way.
        if (dropdown && base) {
          const label = String(option.value == null ? '' : option.value).replace(/<[^>]*>/g, '').trim();
          const suffix = label.replace(/[^A-Za-z0-9_]+/g, '_').toLowerCase().replace(/^_+|_+$/g, '');
          if (suffix) add(base + '_' + suffix);
        }
      });
    }
    if (joins && joins.length) {
      const have = {};
      out.forEach(function (n) { have[n.toLowerCase()] = true; });
      joins.forEach(function (j) {
        if (j.from.some(function (n) { return have[String(n).toLowerCase()]; })) add(j.into);
      });
    }
    return out;
  }

  /**
   * Of `fieldNames`, those that carry `name` as whole words inside a longer name.
   *
   * On underscore boundaries only, so "state" does not match "real_estate". And
   * only the name as it stands: trying it with a leading word dropped made
   * "other_abuse_incident_police" point at "different_abuse_incident_police",
   * which is another question's boxes.
   */
  function partialMatches(name, fieldNames) {
    const base = String(name || '').toLowerCase();
    if (base.indexOf('_') === -1) return [];
    return (fieldNames || []).filter(function (f) {
      const key = String(f).toLowerCase();
      if (key === base) return false;
      const at = key.indexOf(base);
      if (at === -1) return false;
      const end = at + base.length;
      return (at === 0 || key.charAt(at - 1) === '_')
        && (end === key.length || key.charAt(end) === '_');
    });
  }

  return {
    namesOf: namesOf, joinsFromCells: joinsFromCells, partialMatches: partialMatches,
    nodeIdOf: nodeIdOf, MAX_ENTRIES: MAX_ENTRIES
  };
}));
