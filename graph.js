/**************************************************
 *              GRAPH MANAGEMENT MODULE            *
 **************************************************/

// Import configuration from config.js
// Note: This assumes config.js is loaded before graph.js

/**
 * Initialize the mxGraph with all necessary configuration and event handlers
 */
function initializeGraph() {
  // Create the graph inside the specified container
  const container = document.getElementById('graphContainer');
  if (!container) {
    console.error('Graph container not found');
    return null;
  }
  
  const graph = new mxGraph(container);
  
  // Performance optimizations
  graph.setAllowLoops(false);
  graph.setAllowDanglingEdges(false);
  // Note: setAllowParallelEdges doesn't exist in mxGraph
  graph.setConnectable(true);
  graph.setCellsEditable(true);
  graph.setCellsResizable(true);
  graph.setCellsMovable(true);
  // Note: Some of these methods don't exist in this version of mxGraph
  // graph.setCellsBendable(true);
  // graph.setCellsCloneable(true);
  // graph.setCellsDisconnectable(true);
  // graph.setCellsSelectable(true);
  // graph.setCellsDeletable(true);
  // graph.setCellsConnectable(true);
  graph.setDropEnabled(false);
  graph.setSplitEnabled(false);
  // Note: setDisconnectOnMove doesn't exist in this version of mxGraph
  // graph.setDisconnectOnMove(false);
  
  // Set default edge style
  const defaultEdgeStyle = graph.getStylesheet().getDefaultEdgeStyle();
  defaultEdgeStyle[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
  defaultEdgeStyle[mxConstants.STYLE_ROUNDED] = true;
  defaultEdgeStyle[mxConstants.STYLE_ORTHOGONAL_LOOP] = true;
  defaultEdgeStyle[mxConstants.STYLE_JETTY_SIZE] = 'auto';
  
  // Optimize rendering for better performance
  graph.setHtmlLabels(true);
  graph.setTooltips(true);
  
  // Set up event handlers
  setupGraphEventHandlers(graph);
  
  // Set up custom editing behavior
  setupCustomGraphEditing(graph);
  
  // Set up custom double-click behavior
  setupCustomDoubleClickBehavior(graph);
  
  // Set up keyboard navigation
  setupKeyboardNavigation(graph);
  
  // Set up panning and zooming
  setupPanningAndZooming(graph);
  
  return graph;
}

/**
 * Set up all graph event handlers
 */
function setupGraphEventHandlers(graph) {
  // Cell selection change
  graph.getSelectionModel().addListener(mxEvent.CHANGE, function(sender, evt) {
    const selection = graph.getSelectionCells();
    if (selection.length > 0) {
      // Properties panel update is handled in script.js
      console.log('Cell selected:', selection[0]);
    }
  });
  
  // Mouse event handling is done in script.js
  // Removed mouse event handlers to avoid calling non-existent functions
  
  // Graph model change
  graph.getModel().addListener(mxEvent.CHANGE, function(sender, evt) {
    const changes = evt.getProperty('edit').changes;
    changes.forEach(change => {
      if (change instanceof mxValueChange) {
        // Cell display updates are handled in script.js
        console.log('Cell value changed:', change.cell);
      }
    });
  });
}

/**
 * Set up custom editing behavior for specific node types
 */
function setupCustomGraphEditing(graph) {
  // Override getEditingValue for specific node types
  const origGetEditingValue = graph.getEditingValue.bind(graph);
  graph.getEditingValue = function (cell, evt) {
    if (isSimpleHtmlQuestion(cell) || 
        (isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) ||
        isSubtitleNode(cell) ||
        isInfoNode(cell)) {
      const tmp = document.createElement("div");
      tmp.innerHTML = cell.value || "";
      return tmp.textContent || tmp.innerText || "";
    }
    return origGetEditingValue(cell, evt);
  };
  
  // Handle label changes for specific node types
  graph.addListener(mxEvent.LABEL_CHANGED, (sender, evt) => {
    const cell = evt.getProperty("cell");
    let value = evt.getProperty("value");   // plain text the user typed
    
    if (isSimpleHtmlQuestion(cell)) {
      value = mxUtils.htmlEntities(value || "");           // escape <>&
      graph.getModel().setValue(
        cell,
        `<div style="text-align:center;">${value}</div>`
      );
      
      // For text2 cells, also update _questionText for export
      if (getQuestionType(cell) === "text2") {
        cell._questionText = value;
      }
      
      evt.consume();   // stop mxGraph from writing the raw text
    } else if (isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) {
      // For regular option nodes, update the label and node ID
      graph.getModel().beginUpdate();
      try {
        // Set the clean value
        value = value.trim() || "Option";
        // Wrap the plain text in a centered div, escaping any HTML
        value = `<div style="text-align:center;">${mxUtils.htmlEntities(value)}</div>`;
        graph.getModel().setValue(cell, value);
        
        // Update the option node ID based on the new label
        if (window.refreshOptionNodeId) {
          window.refreshOptionNodeId(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      if (window.refreshAllCells) {
        window.refreshAllCells();
      }
      evt.consume();
    } else if (isSubtitleNode(cell)) {
      // Update subtitle node
      graph.getModel().beginUpdate();
      try {
        // Save the plain text in the _subtitleText property
        value = value.trim() || "Subtitle text";
        cell._subtitleText = value;
        
        // Update the display value with the appropriate styling
        if (window.updateSubtitleNodeCell) {
          window.updateSubtitleNodeCell(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      evt.consume();
    } else if (isInfoNode(cell)) {
      // Update info node
      graph.getModel().beginUpdate();
      try {
        // Save the plain text in the _infoText property
        value = value.trim() || "Information text";
        cell._infoText = value;
        
        // Update the display value with the appropriate styling
        if (window.updateInfoNodeCell) {
          window.updateInfoNodeCell(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      evt.consume();
    }
  });
}

/**
 * Set up custom double-click behavior for specific node types
 */
function setupCustomDoubleClickBehavior(graph) {
  const originalDblClick = graph.dblClick.bind(graph);
  graph.dblClick = function (evt, cell) {
    // make multiple-textbox **and** dropdown-style questions
    // jump straight into the inner <div class="question-text">
    if (cell && isQuestion(cell)) {
      const qt = getQuestionType(cell);
      if (qt === 'multipleTextboxes' ||
          qt === 'multipleDropdownType' ||   // numbered-dropdown
          qt === 'dropdown') {               // simple dropdown
        const state = graph.view.getState(cell);
        if (state && state.text && state.text.node) {
          const qDiv = state.text.node.querySelector('.question-text');
          if (qDiv) {
            graph.selectionModel.setCell(cell); // keep node selected
            qDiv.focus();                       // put caret inside
            mxEvent.consume(evt);
            return;
          }
        }
      }
    }
    
    // Add direct editing for option nodes on double-click
    if (cell && isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) {
      // Enable direct editing for option nodes
      graph.startEditingAtCell(cell);
      mxEvent.consume(evt);
      return;
    }
    
    // Add direct editing for subtitle and info nodes on double-click
    if (cell && (isSubtitleNode(cell) || isInfoNode(cell))) {
      // Enable direct editing
      graph.startEditingAtCell(cell);
      mxEvent.consume(evt);
      return;
    }
    
    // Handle alert nodes - focus on the input field instead of editing the whole cell
    if (cell && isAlertNode(cell)) {
      const state = graph.view.getState(cell);
      if (state && state.text && state.text.node) {
        const inputField = state.text.node.querySelector('input[type="text"]');
        if (inputField) {
          graph.selectionModel.setCell(cell); // keep node selected
          inputField.focus();                 // put caret inside input field
          inputField.select();                // select all text for easy editing
          mxEvent.consume(evt);
          return;
        }
      }
    }

    // anything else keeps the stock behaviour
    originalDblClick(evt, cell);
  };
}

/**
 * Set up keyboard navigation controls
 */
function setupKeyboardNavigation(graph) {
  // Add keyboard event listener to the graph container
  const container = document.getElementById('graphContainer');
  
  container.addEventListener('keydown', function(evt) {
    const key = evt.key;
    const ctrl = evt.ctrlKey;
    const shift = evt.shiftKey;
    
    switch(key) {
      case 'Delete':
      case 'Backspace':
        if (graph.isSelectionEmpty()) break;
        deleteSelectedCells(graph);
        evt.preventDefault();
        break;
        
      case 'c':
        if (ctrl) {
          copySelectedCells(graph);
          evt.preventDefault();
        }
        break;
        
      case 'v':
        if (ctrl) {
          pasteCells(graph);
          evt.preventDefault();
        }
        break;
        
      case 'x':
        if (ctrl) {
          cutSelectedCells(graph);
          evt.preventDefault();
        }
        break;
        
      case 'a':
        if (ctrl) {
          selectAllCells(graph);
          evt.preventDefault();
        }
        break;
        
      case 'z':
        if (ctrl) {
          if (shift) {
            redo(graph);
          } else {
            undo(graph);
          }
          evt.preventDefault();
        }
        break;
        
      case 'Escape':
        graph.clearSelection();
        evt.preventDefault();
        break;
    }
  });
  
  // Make the container focusable
  container.setAttribute('tabindex', '0');
}

/**
 * Set up panning and zooming functionality
 */
function setupPanningAndZooming(graph) {
  // Enable panning
  graph.setPanning(true);
  
  // Add mouse wheel zoom
  const container = document.getElementById('graphContainer');
  
  container.addEventListener('wheel', function(evt) {
    if (evt.ctrlKey) {
      evt.preventDefault();
      
      const delta = evt.deltaY > 0 ? 0.9 : 1.1;
      const scale = graph.view.scale * delta;
      
      // Limit zoom range
      if (scale >= 0.1 && scale <= 3.0) {
        graph.view.setScale(scale);
      }
    }
  });
  
  // Add panning with middle mouse button
  let isPanning = false;
  let lastX, lastY;
  
  container.addEventListener('mousedown', function(evt) {
    if (evt.button === 1) { // Middle mouse button
      isPanning = true;
      lastX = evt.clientX;
      lastY = evt.clientY;
      evt.preventDefault();
    }
  });
  
  container.addEventListener('mousemove', function(evt) {
    if (isPanning) {
      const deltaX = evt.clientX - lastX;
      const deltaY = evt.clientY - lastY;
      
      graph.view.setTranslate(
        graph.view.translate.x + deltaX / graph.view.scale,
        graph.view.translate.y + deltaY / graph.view.scale
      );
      
      lastX = evt.clientX;
      lastY = evt.clientY;
    }
  });
  
  container.addEventListener('mouseup', function(evt) {
    if (evt.button === 1) {
      isPanning = false;
    }
  });
}

/**
 * Update the properties panel when a cell is selected
 */
function updatePropertiesPanel(cell) {
  if (!cell) return;
  
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.updatePropertiesPanel to avoid infinite recursion
  console.log('updatePropertiesPanel called for cell:', cell);
}

/**
 * Edit a cell (double-click behavior)
 */
function editCell(cell) {
  if (!cell) return;
  
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.editCell to avoid infinite recursion
  console.log('editCell called for cell:', cell);
}

/**
 * Update cell display after changes
 */
function updateCellDisplay(cell) {
  if (!cell) return;
  
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.updateCellDisplay to avoid infinite recursion
  console.log('updateCellDisplay called for cell:', cell);
}

/**
 * Show context menu for a cell
 */
function showContextMenu(x, y, cell) {
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.showContextMenu to avoid infinite recursion
  console.log('showContextMenu called for cell:', cell, 'at', x, y);
}

/**
 * Show empty space context menu
 */
function showEmptySpaceMenu(x, y) {
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.showEmptySpaceMenu to avoid infinite recursion
  console.log('showEmptySpaceMenu called at', x, y);
}

/**
 * Delete selected cells
 */
function deleteSelectedCells(graph) {
  const cells = graph.getSelectionCells();
  if (cells.length > 0) {
    graph.removeCells(cells);
  }
}

/**
 * Copy selected cells
 */
function copySelectedCells(graph) {
  const cells = graph.getSelectionCells();
  if (cells.length > 0) {
    graph.copyCells(cells);
  }
}

/**
 * Cut selected cells
 */
function cutSelectedCells(graph) {
  const cells = graph.getSelectionCells();
  if (cells.length > 0) {
    graph.cutCells(cells);
  }
}

/**
 * Paste cells from clipboard
 */
function pasteCells(graph) {
  graph.pasteCells();
}

/**
 * Select all cells
 */
function selectAllCells(graph) {
  graph.selectAll();
}

/**
 * Undo last action
 */
function undo(graph) {
  if (graph.undoManager && graph.undoManager.canUndo()) {
    graph.undoManager.undo();
  }
}

/**
 * Redo last action
 */
function redo(graph) {
  if (graph.undoManager && graph.undoManager.canRedo()) {
    graph.undoManager.redo();
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeGraph,
    setupGraphEventHandlers,
    setupCustomGraphEditing,
    setupCustomDoubleClickBehavior,
    setupKeyboardNavigation,
    setupPanningAndZooming,
    updatePropertiesPanel,
    editCell,
    updateCellDisplay,
    showContextMenu,
    showEmptySpaceMenu,
    deleteSelectedCells,
    copySelectedCells,
    cutSelectedCells,
    pasteCells,
    selectAllCells,
    undo,
    redo
  };
}

// Make functions globally accessible for browser use
window.initializeGraph = initializeGraph;
window.setupGraphEventHandlers = setupGraphEventHandlers;
window.setupCustomGraphEditing = setupCustomGraphEditing;
window.setupCustomDoubleClickBehavior = setupCustomDoubleClickBehavior;
window.setupKeyboardNavigation = setupKeyboardNavigation;
window.setupPanningAndZooming = setupPanningAndZooming;
