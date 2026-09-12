/**
 * Click a node, see what it leads to.
 *
 * Selecting a node outlined only that node, and finding where it goes meant
 * following thin wires across a chart hundreds of nodes tall. Now the wires
 * leaving it and the nodes they reach light up with it:
 *
 *   - a wire is followed through the little merge hubs the router joins lines
 *     at, to the node it actually ends on;
 *   - a question's answers are part of the question, so its option nodes light
 *     up and so does wherever each answer leads - the next question, a form's
 *     connector, an alert;
 *   - an alert is a node like any other here: built with the options style, it
 *     is somewhere an answer leads, not an answer.
 *
 * It only paints an outline over the chart - nothing about a node changes - and
 * it clears the moment the selection does. The outlines follow the chart when
 * it is zoomed, panned or rearranged.
 */
(function () {
  'use strict';

  const CHILD_COLOR = '#f59e0b';
  const EDGE_COLOR = '#f59e0b';
  let lit = [];

  const styleOf = (cell) => (cell && cell.style) || '';
  const isHub = (cell) => /nodeType=mergeHub/.test(styleOf(cell));
  const isAlert = (cell) => /questionType=(alertNode|hardAlertNode)/.test(styleOf(cell));
  // The editor's own test when it is there (it knows amount and image
  // options); the style otherwise.
  const isOptionNode = (cell) => (typeof window.isOptions === 'function'
    ? window.isOptions(cell)
    : /nodeType=options/.test(styleOf(cell)) && !isAlert(cell));
  const labelOf = (cell) => String((cell && (cell._questionText || cell.value)) || '')
    .replace(/<[^>]*>/g, ' ').replace(/&#8618;/g, '').replace(/\s+/g, ' ').trim();
  let last = { node: '', wires: 0, children: [] };
  const isQuestionNode = (cell) => /nodeType=question/.test(styleOf(cell));

  function clear() {
    lit.forEach((h) => { try { h.destroy(); } catch (e) { /* already gone */ } });
    lit = [];
  }

  /**
   * The wires leaving a cell and the nodes they end on, through merge hubs.
   * Every wire segment on the way is returned, so the whole path lights up.
   */
  function reach(graph, cell) {
    const edges = [];
    const nodes = [];
    const seen = new Set();
    const queue = [cell];
    while (queue.length) {
      const current = queue.shift();
      (graph.getOutgoingEdges(current) || []).forEach((edge) => {
        const target = edge.target;
        if (!target) return;
        edges.push(edge);
        if (isHub(target)) {
          if (!seen.has(target.id)) { seen.add(target.id); queue.push(target); }
          return;
        }
        nodes.push(target);
      });
    }
    return { edges, nodes };
  }

  function light(graph, cell, color, width) {
    const state = graph.view.getState(cell);
    if (!state || typeof mxCellHighlight !== 'function') return;
    const h = new mxCellHighlight(graph, color, width, false);
    h.highlight(state);
    lit.push(h);
  }

  function show(graph) {
    clear();
    const cells = graph.getSelectionCells() || [];
    if (cells.length !== 1) return;
    const cell = cells[0];
    if (!cell || !graph.getModel().isVertex(cell)) return;

    const first = reach(graph, cell);
    const edges = first.edges.slice();
    const children = [];
    first.nodes.forEach((node) => {
      children.push(node);
      // A question's options are its answers: go one step further, to where
      // each answer leads.
      if (isQuestionNode(cell) && isOptionNode(node)) {
        const next = reach(graph, node);
        next.edges.forEach((e) => edges.push(e));
        next.nodes.forEach((n) => children.push(n));
      }
    });

    // Several answers can lead to the same place - most of an orders list ends
    // at End - so each node and wire is outlined once.
    [...new Set(edges)].forEach((edge) => light(graph, edge, EDGE_COLOR, 4));
    const shown = [...new Set(children)].filter((node) => node !== cell && !isHub(node));
    shown.forEach((node) => light(graph, node, CHILD_COLOR, 3));
    last = { node: labelOf(cell), wires: edges.length, children: shown.map(labelOf) };
  }
  // What the last selection lit, for anyone checking it from the console.
  window.childHighlightLast = () => last;

  // Wire up once the editor's graph exists.
  let tries = 0;
  const timer = setInterval(() => {
    const graph = window.graph;
    if (!graph || typeof graph.getSelectionModel !== 'function') {
      if (++tries > 240) clearInterval(timer);
      return;
    }
    clearInterval(timer);
    if (graph.__childHighlight) return;
    graph.__childHighlight = true;
    graph.getSelectionModel().addListener(mxEvent.CHANGE, () => show(graph));
    // A whole new chart - switching forms, importing - replaces the cells the
    // outlines were drawn for.
    graph.getModel().addListener(mxEvent.CHANGE, () => {
      if (lit.length && !(graph.getSelectionCells() || []).length) clear();
    });
    window.refreshChildHighlight = () => show(graph);
  }, 250);
})();
