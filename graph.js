/**************************************************
 ************ Graph Management ********************
 **************************************************/

// Global graph variable
let graph = null;

/**
 * Initialize the mxGraph instance and set up all necessary configurations
 */
window.initializeGraph = function() {
  try {
    // Check if mxGraph is available
    if (typeof mx === 'undefined') {
      console.error('mxGraph library not loaded');
      return false;
    }

    // Create the graph
    graph = new mxGraph();
    
    // Configure graph behavior
    graph.setAllowDanglingEdges(false);
    graph.setAllowLoops(false);
    graph.setConnectable(true);
    graph.setCellsEditable(false);
    graph.setCellsMovable(true);
    graph.setCellsResizable(false);
    graph.setDropEnabled(false);
    graph.setSplitEnabled(false);
    graph.setTooltips(true);
    
    // Set up graph model
    const model = graph.getModel();
    model.beginUpdate();
    
    try {
      // Create default parent
      const parent = graph.getDefaultParent();
      
      // Set up graph container
      const container = document.getElementById('graphContainer');
      if (container) {
        const graphView = new mxGraphView(graph);
        graph.setView(graphView);
        
        // Create the graph UI
        const graphUI = new mxGraph(graph, container);
        graph = graphUI;
        
        // Set up event handlers
        setupGraphEventHandlers();
        
        console.log('Graph initialized successfully');
        return true;
      } else {
        console.error('Graph container not found');
        return false;
      }
    } finally {
      model.endUpdate();
    }
  } catch (error) {
    console.error('Error initializing graph:', error);
    return false;
  }
};

/**
 * Set up all graph event handlers
 */
function setupGraphEventHandlers() {
  if (!graph) return;
  
  // Cell selection change
  graph.getSelectionModel().addListener(mxEvent.CHANGE, function(sender, evt) {
    const selection = graph.getSelectionCells();
    if (selection.length > 0) {
      updatePropertiesPanel(selection[0]);
    }
  });
  
  // Cell double click
  graph.addMouseListener({
    mouseDown: function(sender, evt) {
      // Handle right-click for context menu
      if (evt.isPopupTrigger()) {
        const cell = graph.getCellAt(evt.getGraphX(), evt.getGraphY());
        if (cell) {
          showContextMenu(evt.getGraphX(), evt.getGraphY(), cell);
        } else {
          showEmptySpaceMenu(evt.getGraphX(), evt.getGraphY());
        }
        evt.consume();
      }
    },
    
    mouseDoubleClick: function(sender, evt) {
      const cell = graph.getCellAt(evt.getGraphX(), evt.getGraphY());
      if (cell && cell.vertex) {
        editCell(cell);
      }
    }
  });
  
  // Graph model change
  graph.getModel().addListener(mxEvent.CHANGE, function(sender, evt) {
    const changes = evt.getProperty('edit').changes;
    changes.forEach(change => {
      if (change instanceof mxValueChange) {
        // Handle value changes
        updateCellDisplay(change.cell);
      }
    });
  });
}

/**
 * Update the properties panel when a cell is selected
 */
function updatePropertiesPanel(cell) {
  if (!cell) return;
  
  // Implementation depends on your properties panel structure
  if (window.updatePropertiesPanel) {
    window.updatePropertiesPanel(cell);
  }
}

/**
 * Edit a cell (double-click behavior)
 */
function editCell(cell) {
  if (!cell) return;
  
  // Implementation depends on cell type
  if (window.editCell) {
    window.editCell(cell);
  }
}

/**
 * Update cell display after changes
 */
function updateCellDisplay(cell) {
  if (!cell) return;
  
  // Implementation depends on cell type
  if (window.updateCellDisplay) {
    window.updateCellDisplay(cell);
  }
}

/**
 * Show context menu for a cell
 */
function showContextMenu(x, y, cell) {
  if (window.showContextMenu) {
    window.showContextMenu(x, y, cell);
  }
}

/**
 * Show empty space context menu
 */
function showEmptySpaceMenu(x, y) {
  if (window.showEmptySpaceMenu) {
    window.showEmptySpaceMenu(x, y);
  }
}

/**
 * Get the current graph instance
 */
window.getGraph = function() {
  return graph;
};

/**
 * Refresh all cells in the graph
 */
window.refreshAllCells = function() {
  if (!graph) return;
  
  const parent = graph.getDefaultParent();
  const cells = graph.getChildCells(parent, true, true);
  
  cells.forEach(cell => {
    if (cell.vertex) {
      updateCellDisplay(cell);
    }
  });
  
  // Refresh the graph view
  graph.refresh();
};

/**
 * Place a node at the specified click location
 */
window.placeNodeAtClickLocation = function(nodeType, x, y) {
  if (!graph) return;
  
  // Use provided coordinates or get from last click event
  const posX = x || (window.lastClickX || 100);
  const posY = y || (window.lastClickY || 100);
  
  if (window.createNode) {
    const node = window.createNode(nodeType, posX, posY);
    if (node) {
      graph.getModel().beginUpdate();
      try {
        graph.addCell(node);
        graph.setSelectionCell(node);
      } finally {
        graph.getModel().endUpdate();
      }
    }
  }
};

// Export graph for use in other modules
window.graph = graph;
