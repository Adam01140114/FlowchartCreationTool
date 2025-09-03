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
    console.log("Double-click detected on cell:", cell);
    
    // Ensure the cell is selected before editing
    if (cell && !graph.isCellSelected(cell)) {
      graph.setSelectionCell(cell);
    }
    
    // Handle question nodes with a popup for text editing
    if (cell && isQuestion(cell)) {
      const qt = getQuestionType(cell);
      console.log("Question type:", qt);
      
      // Show popup for question text editing
      showQuestionTextPopup(cell);
      mxEvent.consume(evt);
      return;
    }
    
    // Add direct editing for option nodes on double-click
    if (cell && isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) {
      console.log("Option node detected, enabling direct editing");
      // Enable direct editing for option nodes
      graph.startEditingAtCell(cell);
      mxEvent.consume(evt);
      return;
    }
    
    // Add direct editing for subtitle and info nodes on double-click
    if (cell && (isSubtitleNode(cell) || isInfoNode(cell))) {
      console.log("Subtitle/Info node detected, enabling direct editing");
      // Enable direct editing
      graph.startEditingAtCell(cell);
      mxEvent.consume(evt);
      return;
    }
    
    // Handle alert nodes - focus on the input field instead of editing the whole cell
    if (cell && isAlertNode(cell)) {
      console.log("Alert node detected, focusing on input field");
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

    // For all other nodes, enable general text editing
    if (cell && cell.vertex && !cell.edge) {
      console.log("General vertex node detected, enabling text editing");
      // Enable direct text editing for any vertex node
      try {
        graph.startEditingAtCell(cell);
        console.log("startEditingAtCell called successfully");
        mxEvent.consume(evt);
        return;
      } catch (error) {
        console.error("Error calling startEditingAtCell:", error);
        // Fall back to original behavior
        originalDblClick(evt, cell);
        return;
      }
    }

    console.log("Using original double-click behavior");
    // anything else keeps the stock behaviour
    originalDblClick(evt, cell);
  };
}

/**
 * Show popup for editing question node text
 */
function showQuestionTextPopup(cell) {
  console.log("=== SHOW QUESTION TEXT POPUP DEBUG ===");
  console.log("showQuestionTextPopup called with cell:", cell);
  console.log("Cell ID:", cell.id);
  console.log("Cell style:", cell.style);
  console.log("Cell _questionText:", cell._questionText);
  console.log("Cell value:", cell.value);
  
  // Get current text from the cell
  let currentText = "";
  if (cell._questionText) {
    currentText = cell._questionText;
  } else if (cell.value) {
    // Extract text from HTML value
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cell.value;
    currentText = (tempDiv.textContent || tempDiv.innerText || "").trim();
  }
  
  // Create popup container
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #1976d2;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10000;
    min-width: 300px;
    font-family: Arial, sans-serif;
  `;
  
  // Create popup content
  popup.innerHTML = `
    <h3 style="margin: 0 0 15px 0; color: #1976d2;">Edit Question Text</h3>
    <textarea 
      id="questionTextInput" 
      placeholder="Enter question text here..."
      style="
        width: 100%;
        min-height: 100px;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        margin-bottom: 15px;
      "
    >${currentText}</textarea>
    <div style="text-align: right;">
      <button id="cancelQuestionText" style="
        background: #f5f5f5;
        border: 1px solid #ccc;
        padding: 8px 16px;
        margin-right: 10px;
        border-radius: 4px;
        cursor: pointer;
      ">Cancel</button>
      <button id="submitQuestionText" style="
        background: #1976d2;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      ">Submit</button>
    </div>
  `;
  
  // Add popup to page
  console.log("Adding popup to document body");
  document.body.appendChild(popup);
  console.log("Popup added to DOM");
  
  // Focus on textarea
  const textarea = popup.querySelector('#questionTextInput');
  console.log("Textarea element found:", textarea);
  textarea.focus();
  textarea.select();
  console.log("Textarea focused and text selected");
  
  // Handle submit button
  const submitBtn = popup.querySelector('#submitQuestionText');
  console.log("Submit button found:", submitBtn);
  submitBtn.addEventListener('click', () => {
    console.log("Submit button clicked!");
    const newText = textarea.value.trim();
    console.log("New text from textarea:", newText);
    console.log("Textarea value before trim:", textarea.value);
    
    if (newText) {
      console.log("New text is valid, updating cell...");
      
      // Update the cell's question text
      cell._questionText = newText;
      console.log("Updated cell._questionText to:", cell._questionText);
      
      // Update the cell display based on question type
      const qt = getQuestionType(cell);
      console.log("Question type for update:", qt);
      
      if (qt === 'multipleTextboxes' || qt === 'multipleDropdownType') {
        console.log("Complex question type detected, calling updateMultipleTextboxHandler");
        // For complex question types, call the appropriate update function
        if (typeof window.updateMultipleTextboxHandler === 'function') {
          console.log("updateMultipleTextboxHandler function exists, calling it");
          window.updateMultipleTextboxHandler(cell);
        } else {
          console.log("updateMultipleTextboxHandler function not found!");
        }
      } else {
        console.log("Simple question type detected, calling updateSimpleQuestionCell");
        // For simple question types, call updateSimpleQuestionCell
        if (typeof window.updateSimpleQuestionCell === 'function') {
          console.log("updateSimpleQuestionCell function exists, calling it");
          window.updateSimpleQuestionCell(cell);
        } else {
          console.log("updateSimpleQuestionCell function not found!");
        }
      }
      
      // Refresh the display
      if (typeof window.refreshAllCells === 'function') {
        console.log("refreshAllCells function exists, calling it");
        window.refreshAllCells();
      } else {
        console.log("refreshAllCells function not found!");
      }
    } else {
      console.log("New text is empty or invalid, not updating");
    }
    
    // Remove popup
    document.body.removeChild(popup);
  });
  
  // Handle cancel button
  const cancelBtn = popup.querySelector('#cancelQuestionText');
  cancelBtn.addEventListener('click', () => {
    console.log("Cancelling question text edit");
    document.body.removeChild(popup);
  });
  
  // Handle Enter key in textarea
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submitBtn.click();
    } else if (e.key === 'Escape') {
      cancelBtn.click();
    }
  });
  
  // Handle clicking outside popup to close
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      cancelBtn.click();
    }
  });
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
window.showQuestionTextPopup = showQuestionTextPopup;
