/**
 * Project search - find a node in any form of the project, not just the one
 * on the canvas.
 *
 * The search box in the form panel (initializeSearch in script.js) only sees
 * the live graph, and a project is several flowcharts of which only one is
 * ever loaded. The others live in window.projectForms as the JSON they were
 * last captured to. So this searches the open form on the canvas, where the
 * operator's latest edits are, and every other form in its slot.
 *
 * Going to a match in another form opens that form the way the form navigator
 * does, then selects and centres the node the way the per-form search does.
 */
(function () {
  'use strict';

  // Same pause as the per-form search, so typing does not search per keystroke.
  const DEBOUNCE_MS = 200;
  // Opening a form rebuilds the canvas at once, but the loader also queues its
  // own "centre on the topmost node" 100 ms later. Polling at the same
  // interval, with the first poll queued after the switch, means the loader's
  // centring has always run before ours, so it cannot undo it.
  const POLL_MS = 100;
  // Past this the node is not coming: the form failed to load, or it changed.
  const POLL_GIVE_UP_MS = 10000;

  let results = [];
  let position = -1;      // the match on screen, or -1 before the first step
  let lastMatch = null;   // what was visited, to step on from after a re-search
  let searchedQuery = ''; // the query `results` was built for
  let debounceTimer = null;
  let jumpToken = 0;      // bumped by every jump and every new query
  let opening = false;    // a jump is waiting for another form to load

  function el(id) { return document.getElementById(id); }

  function currentQuery() {
    const box = el('projectSearchBox');
    return box ? box.value.trim() : '';
  }

  /**
   * The text of an HTML label, read without running it. A <template> parses
   * inertly, so an <img onerror> in a saved label does not fire, as it would
   * in a detached <div>.
   */
  function htmlToText(html) {
    if (typeof html !== 'string' || !html) return '';
    if (html.indexOf('<') === -1 && html.indexOf('&') === -1) return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    // Multiple-textbox and dropdown questions keep their title in an <input>,
    // and an input's text is its value attribute, which textContent skips.
    const title = template.content.querySelector('input.question-title-input');
    const titleText = title ? (title.getAttribute('value') || '') : '';
    return (titleText + ' ' + (template.content.textContent || '')).trim();
  }

  /** The box labels of a multiple-textbox node: each one is asked on the form. */
  function textboxLabels(textboxes) {
    if (!Array.isArray(textboxes)) return '';
    return textboxes
      .map(function (box) { return box && box.label ? String(box.label) : ''; })
      .filter(Boolean)
      .join(' ');
  }

  /**
   * A node on the canvas, read by the per-form search's own getCellText so
   * the two boxes agree about what a node says.
   */
  function liveCellText(cell) {
    let text = '';
    if (typeof window.getCellText === 'function') {
      try { text = String(window.getCellText(cell) || ''); } catch (e) { text = ''; }
    }
    // getCellText falls back to the label's text, which is empty when the
    // only words are an input's value - a multiple-textbox title.
    if (!text.trim()) text = htmlToText(cell.value);
    return (text + ' ' + textboxLabels(cell._textboxes)).trim();
  }

  /** A node in a form's saved JSON: the same fields getCellText reads, in its order. */
  function savedCellText(item) {
    const own = item._questionText || item._subtitleText || item._infoText
      || item._notesText || item._checklistText || item._alertText || item._calcTitle;
    const text = own ? htmlToText(String(own)) : htmlToText(item.value);
    return (text + ' ' + textboxLabels(item._textboxes)).trim();
  }

  function formName(index) {
    const slot = (window.projectForms || [])[index];
    let name = slot && slot.name ? slot.name : '';
    // The open form's name box is fresher than its slot, which is only
    // written when the form is captured.
    if (index === openFormIndex()) {
      const typed = el('formNameInput') ? el('formNameInput').value.trim() : '';
      name = typed || name;
    }
    return name || ('Form ' + (index + 1));
  }

  /** Before the project is seeded there are no slots, and the canvas is form 1. */
  function openFormIndex() {
    return (window.projectForms || []).length ? (window.currentFormIndex || 0) : 0;
  }

  function makeMatch(formIndex, id, geometry) {
    return {
      formIndex: formIndex,
      formName: formName(formIndex),
      cellId: String(id),
      key: formIndex + ':' + id,
      x: geometry ? Number(geometry.x) || 0 : 0,
      y: geometry ? Number(geometry.y) || 0 : 0
    };
  }

  /** Form, then top to bottom, then left to right - reading order. */
  function compareMatches(a, b) {
    return (a.formIndex - b.formIndex) || (a.y - b.y) || (a.x - b.x)
      || (a.cellId < b.cellId ? -1 : a.cellId > b.cellId ? 1 : 0);
  }

  function collectMatches(query) {
    const needle = query.toLowerCase();
    const forms = window.projectForms || [];
    const open = openFormIndex();
    const found = [];
    const hit = function (text) { return !!text && text.toLowerCase().indexOf(needle) !== -1; };

    for (let i = 0; i < Math.max(forms.length, 1); i++) {
      if (i === open) {
        // The canvas, not the slot: the slot may be minutes behind it.
        const graph = window.graph;
        if (!graph) continue;
        graph.getChildVertices(graph.getDefaultParent()).forEach(function (cell) {
          if (hit(liveCellText(cell))) found.push(makeMatch(i, cell.id, cell.geometry));
        });
        continue;
      }
      const cells = (forms[i] && forms[i].flowchart && forms[i].flowchart.cells) || [];
      cells.forEach(function (item) {
        if (!item || item.edge || !item.vertex) return;
        if (hit(savedCellText(item))) found.push(makeMatch(i, item.id, item.geometry));
      });
    }
    return found.sort(compareMatches);
  }

  /* ---------------------------------------------------------------- */
  /* the count and buttons                                             */
  /* ---------------------------------------------------------------- */

  function render(message) {
    const row = el('projectSearchRow');
    const label = el('projectSearchCount');
    if (!row || !label) return;
    if (!currentQuery()) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    if (message) {
      label.textContent = message;
    } else if (!results.length) {
      label.textContent = 'No matches';
    } else if (position < 0) {
      label.textContent = results.length + (results.length === 1 ? ' match' : ' matches');
    } else {
      label.textContent = (position + 1) + ' of ' + results.length + ' · '
        + results[position].formName;
    }
    label.title = label.textContent;
    el('projectSearchPrevBtn').disabled = !results.length;
    el('projectSearchNextBtn').disabled = !results.length;
  }

  /** A new query starts over: nothing visited, and any pending jump abandoned. */
  function runSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = null;
    jumpToken++;
    opening = false;
    const query = currentQuery();
    searchedQuery = query;
    results = query ? collectMatches(query) : [];
    position = -1;
    lastMatch = null;
    render();
  }

  /* ---------------------------------------------------------------- */
  /* stepping through matches                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Where a step lands when the node last visited is no longer a match, or
   * nothing has been visited yet: the next match after that spot in reading
   * order. With nothing visited the spot is the top of the open form, so the
   * first Next stays on the canvas when the canvas has a match, rather than
   * leaping to form 1.
   */
  function indexAfter(anchor, direction) {
    if (direction > 0) {
      const i = results.findIndex(function (m) { return compareMatches(m, anchor) > 0; });
      return i === -1 ? 0 : i;
    }
    for (let i = results.length - 1; i >= 0; i--) {
      if (compareMatches(results[i], anchor) < 0) return i;
    }
    return results.length - 1;
  }

  function step(direction) {
    const query = currentQuery();
    if (!query || opening) return;
    // Search again on every step. The open form may have been edited since
    // the last one, and opening another form captured the one it left.
    results = collectMatches(query);
    searchedQuery = query;
    if (!results.length) {
      position = -1;
      lastMatch = null;
      render();
      return;
    }
    let target;
    const same = lastMatch
      ? results.findIndex(function (m) { return m.key === lastMatch.key; })
      : -1;
    if (same !== -1) {
      target = (same + direction + results.length) % results.length;
    } else {
      const edge = direction > 0 ? -Infinity : Infinity;
      const anchor = lastMatch || { formIndex: openFormIndex(), y: edge, x: edge, cellId: '' };
      target = indexAfter(anchor, direction);
    }
    goTo(target);
  }

  /** Select and centre, as the per-form search's Enter does. */
  function reveal(cell) {
    const graph = window.graph;
    if (!graph || !cell) return false;
    graph.getSelectionModel().setCell(cell);
    if (typeof window.centerOnCell === 'function') {
      window.centerOnCell(cell);
    } else {
      graph.scrollCellToVisible(cell, true);
    }
    return true;
  }

  /**
   * The match's node, once its form is on the canvas. Ids are only unique
   * within a form, so the form that was open a moment ago may hold a
   * different node under the same id. Loading builds every node afresh, so
   * the node that was there before the switch - `before` - is never the one
   * wanted. The saved position cannot tell them apart: loading nudges some
   * nodes a few pixels.
   */
  function loadedCell(match, before) {
    if (openFormIndex() !== match.formIndex) return null;
    const graph = window.graph;
    const cell = graph ? graph.getModel().getCell(match.cellId) : null;
    if (!cell || !cell.vertex || cell === before) return null;
    return cell;
  }

  function goTo(index) {
    const match = results[index];
    position = index;
    lastMatch = match;

    if (match.formIndex === openFormIndex() || typeof window.switchToProjectForm !== 'function') {
      const graph = window.graph;
      reveal(graph ? graph.getModel().getCell(match.cellId) : null);
      render();
      return;
    }

    // Another form: open it, then wait for the node to appear. Loading has
    // no completion signal, so poll for the node itself.
    const token = ++jumpToken;
    const startedAt = Date.now();
    const graph = window.graph;
    const before = graph ? graph.getModel().getCell(match.cellId) : null;
    opening = true;
    render('Opening ' + match.formName + '…');
    window.switchToProjectForm(match.formIndex);
    (function poll() {
      setTimeout(function () {
        if (token !== jumpToken) return;
        const cell = loadedCell(match, before);
        if (cell) {
          opening = false;
          reveal(cell);
          render();
          return;
        }
        if (Date.now() - startedAt > POLL_GIVE_UP_MS) {
          opening = false;
          render('Could not find that node in ' + match.formName);
          return;
        }
        poll();
      }, POLL_MS);
    })();
  }

  /* ---------------------------------------------------------------- */

  function init() {
    const box = el('projectSearchBox');
    const clearBtn = el('projectSearchClearBtn');
    if (!box || !clearBtn) return;

    box.addEventListener('input', function () {
      clearBtn.classList.toggle('show', box.value.length > 0);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
    });
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      // Enter straight after typing must not step through the previous
      // query's matches while the debounce is still waiting.
      if (debounceTimer || currentQuery() !== searchedQuery) runSearch();
      step(e.shiftKey ? -1 : 1);
    });
    clearBtn.addEventListener('click', function () {
      box.value = '';
      clearBtn.classList.remove('show');
      runSearch();
      box.focus();
    });
    el('projectSearchPrevBtn').addEventListener('click', function () { step(-1); });
    el('projectSearchNextBtn').addEventListener('click', function () { step(1); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.projectSearch = {
    run: runSearch,
    next: function () { step(1); },
    back: function () { step(-1); },
    matches: function () { return results.slice(); }
  };
})();
