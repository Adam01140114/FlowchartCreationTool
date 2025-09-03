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
  console.log("=== SETUP CUSTOM DOUBLE CLICK BEHAVIOR DEBUG ===");
  console.log("Function called with graph:", graph);
  console.log("Graph object type:", typeof graph);
  
  // Add double-click handler to the graph container with a delay to ensure DOM is ready
  setTimeout(() => {
    const graphContainer = document.getElementById('graphContainer');
    if (graphContainer) {
      console.log("Graph container found, adding double-click listener");
      graphContainer.addEventListener('dblclick', function(evt) {
        console.log("Graph container double-click event triggered");
        console.log("Target:", evt.target);
        
        // Check if we clicked on a cell element
        let cellElement = evt.target;
        while (cellElement && !cellElement.classList.contains('mxCell')) {
          cellElement = cellElement.parentElement;
        }
        
        if (cellElement && cellElement.classList.contains('mxCell')) {
          console.log("Cell element found:", cellElement);
          console.log("Cell element ID:", cellElement.id);
          
          // Try to get the cell object from the graph
          const cellId = cellElement.id;
          if (cellId && cellId !== '0') {
            try {
              const cell = graph.getModel().getCell(cellId);
              console.log("Cell object:", cell);
              console.log("Is vertex:", cell && cell.vertex);
              
              if (cell && cell.vertex) {
                console.log("Double-click detected on vertex:", cell);
                alert("hello");
              }
            } catch (error) {
              console.error("Error getting cell:", error);
            }
          }
        }
      });
    } else {
      console.log("Graph container not found");
    }
  }, 1000); // Wait 1 second for DOM to be ready
  
  // Add a simple test double-click handler to the document body
  document.addEventListener('dblclick', function(evt) {
    console.log("Document double-click event triggered");
    console.log("Target:", evt.target);
    console.log("Target tag:", evt.target.tagName);
    console.log("Target classes:", evt.target.className);
  });
  
  // Use mxGraph's event system to catch double-clicks
  graph.addListener(mxEvent.DOUBLE_CLICK, function(sender, evt) {
    console.log("mxGraph DOUBLE_CLICK event triggered");
    console.log("Event:", evt);
    
    // Get the cell from the event
    const cell = evt.getProperty('cell');
    if (cell && cell.vertex) {
      console.log("Double-click on vertex via mxGraph event:", cell);
      alert("hello");
    }
  });
  
  // Track clicks to detect double-clicks
  let lastClickTime = 0;
  let lastClickedCell = null;
  const DOUBLE_CLICK_DELAY = 500; // 500ms = half a second
  
  // Add a simple click listener to test if mouse events work at all
  graph.addListener(mxEvent.CLICK, function(sender, evt) {
    console.log("mxGraph CLICK event triggered");
    const cell = evt.getProperty('cell');
    if (cell && cell.vertex) {
      console.log("Click on vertex:", cell);
      console.log("Cell ID:", cell.id);
      
      const currentTime = Date.now();
      console.log("Current time:", currentTime);
      console.log("Last click time:", lastClickTime);
      console.log("Time difference:", currentTime - lastClickTime);
      console.log("Last clicked cell:", lastClickedCell);
      console.log("Same cell as last click:", lastClickedCell === cell);
      
      // Check if this is a double-click on the same cell
      if (lastClickedCell === cell && (currentTime - lastClickTime) <= DOUBLE_CLICK_DELAY) {
        console.log("🎯 DOUBLE CLICK DETECTED!");
        console.log("Double-click on vertex:", cell);
        
        // Show the edit question text popup instead of alert
        if (typeof showQuestionTextPopup === 'function') {
          console.log("Calling showQuestionTextPopup for double-click");
          showQuestionTextPopup(cell);
        } else if (typeof window.showQuestionTextPopup === 'function') {
          console.log("Calling window.showQuestionTextPopup for double-click");
          window.showQuestionTextPopup(cell);
        } else {
          console.log("showQuestionTextPopup function not found, falling back to alert");
          alert("hello");
        }
        
        // Reset the tracking
        lastClickTime = 0;
        lastClickedCell = null;
      } else {
        // Update tracking for next potential double-click
        lastClickTime = currentTime;
        lastClickedCell = cell;
        console.log("Updated tracking - waiting for potential double-click");
      }
    }
  });
  
  // Also keep the original dblClick override for compatibility
  // Override the graph's dblClick method
  const originalDblClick = graph.dblClick;
  console.log("Original double-click handler bound:", originalDblClick);
  console.log("Original handler type:", typeof originalDblClick);
  graph.dblClick = function (evt, cell) {
    console.log("=== DOUBLE CLICK EVENT TRIGGERED ===");
    console.log("Event:", evt);
    console.log("Cell:", cell);
    console.log("Event type:", evt.type);
    console.log("Event target:", evt.target);
    console.log("Event currentTarget:", evt.currentTarget);
    console.log("This context:", this);
    console.log("Graph object:", graph);
    console.log("Double-click detected on cell:", cell);
    
    // Show "hello" alert for all node double-clicks
    if (cell && cell.vertex) {
      alert("hello");
    }
    
    // Ensure the cell is selected before editing
    if (cell && !graph.isCellSelected(cell)) {
      graph.setSelectionCell(cell);
    }
    
    // Handle question nodes with a popup for text editing
    console.log("Checking if cell is a question node...");
    console.log("isQuestion function exists:", typeof isQuestion === 'function');
    console.log("isQuestion function available:", typeof window.isQuestion === 'function');
    
    if (cell && typeof isQuestion === 'function' && isQuestion(cell)) {
      console.log("🎯 Question node detected via local isQuestion function!");
      const qt = typeof getQuestionType === 'function' ? getQuestionType(cell) : 'unknown';
      console.log("Question type:", qt);
      
      // Show popup for question text editing
      console.log("About to call showQuestionTextPopup...");
      if (typeof showQuestionTextPopup === 'function') {
        console.log("✅ showQuestionTextPopup function found locally");
        showQuestionTextPopup(cell);
        console.log("✅ showQuestionTextPopup called successfully");
        mxEvent.consume(evt);
        return;
      } else {
        console.log("❌ showQuestionTextPopup function not found locally");
        console.log("Available local functions:", Object.keys(this).filter(key => key.includes('Question')));
      }
    } else if (cell && typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
      console.log("🎯 Question node detected via window.isQuestion function!");
      const qt = typeof window.getQuestionType === 'function' ? window.getQuestionType(cell) : 'unknown';
      console.log("Question type:", qt);
      
      // Show popup for question text editing
      console.log("About to call window.showQuestionTextPopup...");
      if (typeof window.showQuestionTextPopup === 'function') {
        console.log("✅ window.showQuestionTextPopup function found");
        window.showQuestionTextPopup(cell);
        console.log("✅ window.showQuestionTextPopup called successfully");
        mxEvent.consume(evt);
        return;
      } else {
        console.log("❌ window.showQuestionTextPopup function not found");
        console.log("Available window functions:", Object.keys(window).filter(key => key.includes('Question')));
      }
    } else {
      console.log("ℹ️ Not a question node");
      console.log("Cell exists:", !!cell);
      console.log("Local isQuestion function:", typeof isQuestion);
      console.log("Window isQuestion function:", typeof window.isQuestion);
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
  
  console.log("✅ Custom double-click behavior set up successfully");
  console.log("New dblClick function:", graph.dblClick);
  console.log("Graph dblClick property after setup:", graph.dblClick);
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
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    z-index: 10000;
    min-width: 500px;
    max-width: 500px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Create popup content
  popup.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: #1976d2; font-size: 20px; font-weight: 600; text-align: center;">Edit Question Text</h3>
    <textarea 
      id="questionTextInput" 
      placeholder="Enter question text here..."
      style="
        width: 400px;
        min-height: 120px;
        padding: 15px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 16px;
        font-family: inherit;
        resize: vertical;
        margin-bottom: 20px;
        line-height: 1.5;
        transition: all 0.2s ease;
        outline: none;
      "
    >${currentText}</textarea>
    <div style="text-align: center;">
      <button id="submitQuestionText" style="
        background: #1976d2;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 12px;
        display: block;
        width: 100%;
        transition: background-color 0.2s ease;
      ">Submit</button>
      <button id="cancelQuestionText" style="
        background: #1976d2;
        color: white;
        border: 1px solid #1976d2;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      ">Cancel</button>
    </div>
  `;
  
  // Add popup to page
  console.log("Adding popup to document body");
  document.body.appendChild(popup);
  console.log("Popup added to DOM");
  
  // Focus on textarea
  const textarea = popup.querySelector('#questionTextInput');
  console.log("Textarea element found:", textarea);
  
  // Add hover and focus effects
  textarea.addEventListener('focus', () => {
    textarea.style.borderColor = '#1976d2';
    textarea.style.boxShadow = '0 0 0 3px rgba(25, 118, 210, 0.1)';
  });
  
  // Ensure textarea is immediately ready for typing
  textarea.addEventListener('click', () => {
    // If no text is selected, position cursor at end
    if (textarea.selectionStart === textarea.selectionEnd) {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  });
  
  textarea.addEventListener('blur', () => {
    textarea.style.borderColor = '#e0e0e0';
    textarea.style.boxShadow = 'none';
  });
  
  textarea.addEventListener('mouseenter', () => {
    if (document.activeElement !== textarea) {
      textarea.style.borderColor = '#bdbdbd';
    }
  });
  
  textarea.addEventListener('mouseleave', () => {
    if (document.activeElement !== textarea) {
      textarea.style.borderColor = '#e0e0e0';
    }
  });
  
  // Ensure proper focus and cursor positioning using multiple approaches
  requestAnimationFrame(() => {
    // First attempt: standard focus and select
    textarea.focus();
    textarea.select();
    
    // Second attempt: ensure cursor is at end
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    
    // Third attempt: force focus again after a tiny delay
    setTimeout(() => {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      console.log("Textarea focused, text selected, and cursor positioned (final attempt)");
    }, 5);
    
    console.log("Textarea focused, text selected, and cursor positioned");
  });
  
  // Create a reliable submit function
  function submitQuestionText() {
    console.log("=== SUBMIT FUNCTION CALLED ===");
    
    // Force the textarea to lose focus to ensure value is captured
    textarea.blur();
    
    // Small delay to ensure the value is properly captured
    setTimeout(() => {
      try {
      const newText = textarea.value.trim();
      console.log("New text from textarea (after blur):", newText);
      console.log("Textarea value before trim:", textarea.value);
      
      if (newText) {
        console.log("New text is valid, updating cell...");
        
        // Update the cell's question text
        cell._questionText = newText;
        console.log("Updated cell._questionText to:", cell._questionText);
        
        // Also update the cell's value directly for immediate visual update
        if (cell.value && typeof cell.value === 'string' && cell.value.includes('<div')) {
          // For HTML content, update the text content
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = cell.value;
          const textElement = tempDiv.querySelector('.question-text, .question-title-input, div');
          if (textElement) {
            textElement.textContent = newText;
            cell.value = tempDiv.innerHTML;
          } else {
            // Fallback: replace the entire content
            cell.value = `<div style="text-align:center;">${newText}</div>`;
          }
        } else {
          // For plain text, update directly
          cell.value = newText;
        }
        
        console.log("Updated cell.value to:", cell.value);
        
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
        
        // Force the graph to refresh this specific cell
        try {
          graph.refresh(cell);
          console.log("Graph.refresh(cell) called successfully");
        } catch (error) {
          console.log("Graph.refresh(cell) failed:", error);
        }
        
        // Also try to trigger a model change event
        try {
          graph.getModel().beginUpdate();
          graph.getModel().setValue(cell, cell.value);
          graph.getModel().endUpdate();
          console.log("Graph model updated successfully");
        } catch (error) {
          console.log("Graph model update failed:", error);
        }
        
        // Refresh the display
        if (typeof window.refreshAllCells === 'function') {
          console.log("refreshAllCells function exists, calling it");
          window.refreshAllCells();
        } else {
          console.log("refreshAllCells function not found!");
        }
        
        // Final verification
        console.log("Final cell._questionText:", cell._questionText);
        console.log("Final cell.value:", cell.value);
      } else {
        console.log("New text is empty or invalid, not updating");
      }
      
      } catch (error) {
        console.error("Error in submit function:", error);
      }
      // Note: Popup removal is now handled by the Enter key handler calling cancelBtn.click()
    }, 10); // Small delay to ensure value capture
  }
  
  // Handle submit button
  const submitBtn = popup.querySelector('#submitQuestionText');
  console.log("Submit button found:", submitBtn);
  
  // Add hover effects to submit button
  submitBtn.addEventListener('mouseenter', () => {
    submitBtn.style.background = '#1565c0';
  });
  
  submitBtn.addEventListener('mouseleave', () => {
    submitBtn.style.background = '#1976d2';
  });
  
  submitBtn.addEventListener('click', submitQuestionText);
  
  // Handle cancel button
  const cancelBtn = popup.querySelector('#cancelQuestionText');
  
  // Add hover effects to cancel button
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = '#1565c0';
    cancelBtn.style.borderColor = '#1565c0';
  });
  
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = '#1976d2';
    cancelBtn.style.borderColor = '#1976d2';
  });
  
  cancelBtn.addEventListener('click', () => {
    console.log("Cancelling question text edit");
    document.body.removeChild(popup);
  });
  
  // Handle Enter key in textarea
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      submitQuestionText();
      // Close the menu after submitting
      setTimeout(() => cancelBtn.click(), 50);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Enter key (without Shift) submits the form
      e.preventDefault(); // Prevent new line
      submitQuestionText();
      // Close the menu after submitting
      setTimeout(() => cancelBtn.click(), 50);
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
