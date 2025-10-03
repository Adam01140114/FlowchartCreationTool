/**************************************************
 ************ EVENT HANDLERS MODULE ********
 **************************************************/
// This module handles all event handling functionality including:
// - Mouse events (click, double-click, drag)
// - Keyboard events (delete, copy, paste)
// - Graph events (selection, movement)
// - Drag and drop functionality

// Use shared dependency accessors from dependencies.js module

// Mouse position tracking
let currentMouseX = 0;
let currentMouseY = 0;

// Multiple Textbox Event Handlers
function handleMultipleTextboxClick(event, cellId) {
  event.stopPropagation();
  const graph = window.graph;
  if (graph) {
    const cell = graph.getModel().getCell(cellId);
    graph.selectionModel.setCell(cell);
  }
}

function handleMultipleTextboxFocus(event, cellId) {
  const graph = window.graph;
  if (graph) {
    const cell = graph.getModel().getCell(cellId);
    if (!cell) return;
    const textDiv = event.target;
    if (textDiv.innerText === "Enter question text") {
      textDiv.innerText = "";
    }
  }
}

// Dropdown Event Handlers
function handleDropdownClick(event, cellId) {
  // Only stop propagation if clicking on the container div
  if (event.target.classList.contains('dropdown-question')) {
    event.stopPropagation();
    const graph = window.graph;
    if (graph) {
      const cell = graph.getModel().getCell(cellId);
      if (cell) graph.selectionModel.setCell(cell);
    }
  }
  // Let all events bubble naturally for the contenteditable text
}

function handleDropdownFocus(event, cellId) {
  const graph = window.graph;
  if (graph) {
    const cell = graph.getModel().getCell(cellId);
    if (!cell) return;
    
    // Initialize text editing capabilities
    initDropdownTextEditing(event.target.parentElement);
    
    if (event.target.innerText === "Enter dropdown question") {
      event.target.innerText = "";
    }
  }
}

function handleDropdownMouseDown(event) {
  // Prevent the default mxGraph handlers from running when clicking inside the text
  event.stopPropagation();
}

// Helper to make text selection in dropdown nodes work
function initDropdownTextEditing(element) {
  if (!element) return;
  
  const textDiv = element.querySelector('.question-text');
  if (!textDiv) return;
  
  // Override any parent styles that might interfere with text editing
  textDiv.style.userSelect = 'text';
  textDiv.style.webkitUserSelect = 'text';
  textDiv.style.msUserSelect = 'text';
  textDiv.style.mozUserSelect = 'text';
  textDiv.style.pointerEvents = 'auto';
  textDiv.style.cursor = 'text';
  
  // Remove any event handlers that might interfere
  textDiv.onmousedown = null;
  textDiv.onmousemove = null;
  textDiv.onmouseup = null;
  
  // Prevent the default mxGraph handlers from running when clicking inside the text
  textDiv.addEventListener('mousedown', function(e) {
    e.stopPropagation();
  });
  
  // Allow normal clipboard operations
  textDiv.addEventListener('copy', function(e) {
    e.stopPropagation();
  });
  
  textDiv.addEventListener('cut', function(e) {
    e.stopPropagation();
  });
  
  textDiv.addEventListener('paste', function(e) {
    e.stopPropagation();
  });
}

// Title Input Event Handler
function handleTitleInputKeydown(event, cellId) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.target.blur();
  }
}

// Setup Mouse Event Listeners
function setupMouseEventListeners(graph) {
  if (!graph) return;
  
  // When the user starts panning/dragging the canvas, hide any open menus.
  graph.addListener(mxEvent.PAN, function(sender, evt) {
    if (typeof window.hideContextMenu === 'function') {
      window.hideContextMenu();
    }
  });
  
  // Add mouse move event listener for tracking mouse position
  document.addEventListener('mousemove', function(e) {
    if (graph) {
      // Convert client coordinates to graph coordinates
      const pt = graph.getPointForEvent(e, false);
      currentMouseX = pt.x;
      currentMouseY = pt.y;
    }
  });
  
  // Zoom with mouse wheel
  mxEvent.addMouseWheelListener(function(evt, up) {
    if (!mxEvent.isConsumed(evt)) {
      // Get zoom sensitivity from settings (default to 0.01 if not set)
      const sensitivity = window.userSettings?.zoomSensitivity || 0.01;
      
      // Apply custom zoom based on sensitivity
      const currentScale = graph.view.scale;
      const baseZoomFactor = 1.02; // Much smaller base zoom factor
      const sensitivityFactor = sensitivity * 50; // Scale up the sensitivity value
      const zoomFactor = 1 + (baseZoomFactor - 1) * sensitivityFactor;
      
      let newScale;
      if (up) {
        newScale = currentScale * zoomFactor;
      } else {
        newScale = currentScale / zoomFactor;
      }
      
      // Limit zoom range
      if (newScale >= 0.1 && newScale <= 3.0) {
        graph.view.setScale(newScale);
      }
      
      mxEvent.consume(evt);
    }
  }, graph.container);
  
  // Add global event listeners to prevent graph interference with dropdowns
  document.addEventListener('mousedown', function(e) {
    // If clicking on a dropdown or form element, prevent graph from handling it
    if (e.target.closest('.question-type-dropdown') || 
        e.target.closest('select') || 
        e.target.closest('input') || 
        e.target.closest('textarea') ||
        e.target.closest('[contenteditable="true"]')) {
      e.stopPropagation();
    }
  }, true); // Use capture phase to intercept before graph handlers
  
  document.addEventListener('click', function(e) {
    // If clicking on a dropdown or form element, prevent graph from handling it
    if (e.target.closest('.question-type-dropdown') || 
        e.target.closest('select') || 
        e.target.closest('input') || 
        e.target.closest('textarea') ||
        e.target.closest('[contenteditable="true"]')) {
      e.stopPropagation();
    }
  }, true); // Use capture phase to intercept before graph handlers
}

// Setup Graph Event Listeners
function setupGraphEventListeners(graph) {
  if (!graph) return;
  
  // Label changed event
  graph.addListener(mxEvent.LABEL_CHANGED, (sender, evt) => {
    const cell = evt.getProperty("cell");
    let value = evt.getProperty("value");   // plain text the user typed
    
    if (typeof window.isSimpleHtmlQuestion === 'function' && window.isSimpleHtmlQuestion(cell)) {
      value = mxUtils.htmlEntities(value || "");           // escape <>&
      graph.getModel().setValue(
        cell,
        `<div style="text-align:center;">${value}</div>`
      );
      
      // For text2 cells, also update _questionText for export
      if (typeof window.getQuestionType === 'function' && window.getQuestionType(cell) === "text2") {
        cell._questionText = value;
      }
      
      evt.consume();   // stop mxGraph from writing the raw text
    } else if (typeof window.isOptions === 'function' && window.isOptions(cell) && 
               typeof window.getQuestionType === 'function' && 
               !window.getQuestionType(cell).includes('image') && 
               !window.getQuestionType(cell).includes('amount')) {
      // For regular option nodes, update the label and node ID
      graph.getModel().beginUpdate();
      try {
        // Set the clean value
        value = value.trim() || "Option";
        // Wrap the plain text in a centered div, escaping any HTML
        value = `<div style="text-align:center;">${mxUtils.htmlEntities(value)}</div>`;
        graph.getModel().setValue(cell, value);
        
        // Update the option node ID based on the new label
        if (typeof window.refreshOptionNodeId === 'function') {
          window.refreshOptionNodeId(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      if (typeof window.refreshAllCells === 'function') {
        window.refreshAllCells();
      }
      evt.consume();
    } else if (typeof window.isSubtitleNode === 'function' && window.isSubtitleNode(cell)) {
      // Update subtitle node
      graph.getModel().beginUpdate();
      try {
        // Save the plain text in the _subtitleText property
        value = value.trim() || "Subtitle text";
        cell._subtitleText = value;
        
        // Update the display value with the appropriate styling
        if (typeof window.updateSubtitleNodeCell === 'function') {
          window.updateSubtitleNodeCell(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      evt.consume();
    } else if (typeof window.isInfoNode === 'function' && window.isInfoNode(cell)) {
      // Update info node
      graph.getModel().beginUpdate();
      try {
        // Save the plain text in the _infoText property
        value = value.trim() || "Information text";
        cell._infoText = value;
        
        // Update the display value with the appropriate styling
        if (typeof window.updateInfoNodeCell === 'function') {
          window.updateInfoNodeCell(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      evt.consume();
    }
  });
  
  // Model change event
  graph.getModel().addListener(mxEvent.CHANGE, function(sender, evt) {
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  });
  
  // Selection change event
  graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
    // DO NOT auto-update Node IDs when selection changes
    // Node IDs should only change when manually edited or reset using the button
    window.lastSelectedCell = graph.getSelectionCell();
    
    // Highlight the section in the legend if a cell is selected
    const selectedCell = graph.getSelectionCell();
    if (selectedCell) {
      if (typeof window.getSection === 'function') {
        const sec = window.getSection(selectedCell);
        if (typeof window.highlightSectionInLegend === 'function') {
          window.highlightSectionInLegend(sec);
        }
      }
    } else {
      // If no cell is selected, remove all highlights
      const allSectionItems = document.querySelectorAll(".section-item");
      allSectionItems.forEach(item => {
        item.classList.remove("highlighted");
      });
    }
  });
  
  // Cells moved event
  graph.addListener(mxEvent.CELLS_MOVED, function(sender, evt) {
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  });
  
  // Move cells event for connected node handling
  graph.addListener(mxEvent.MOVE_CELLS, function(sender, evt) {
    const movedCells = evt.getProperty('cells');
    const dx = evt.getProperty('dx');
    const dy = evt.getProperty('dy');
    
    if (!movedCells || movedCells.length === 0) return;
    
    const movedIds = new Set(movedCells.map(c => c.id));
    
    // Function to get all connected descendants (including notes nodes)
    const getConnectedDescendants = (cell) => {
      const descendants = new Set();
      const queue = [cell];
      
      while (queue.length > 0) {
        const current = queue.shift();
        const edges = graph.getOutgoingEdges(current) || [];
        
        edges.forEach(edge => {
          const target = edge.target;
          if (!descendants.has(target) && !movedIds.has(target.id)) {
            descendants.add(target);
            queue.push(target);
          }
        });
      }
      return Array.from(descendants);
    };
    
    // Function to get all connected ancestors (for notes nodes pointing to questions)
    const getConnectedAncestors = (cell) => {
      const ancestors = new Set();
      const queue = [cell];
      
      while (queue.length > 0) {
        const current = queue.shift();
        const edges = graph.getIncomingEdges(current) || [];
        
        edges.forEach(edge => {
          const source = edge.source;
          if (!ancestors.has(source) && !movedIds.has(source.id)) {
            ancestors.add(source);
            queue.push(source);
          }
        });
      }
      return Array.from(ancestors);
    };
    
    movedCells.forEach(cell => {
      if (typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
        // When dragging a question node, move all connected descendants (including notes nodes)
        const descendants = getConnectedDescendants(cell);
        descendants.forEach(descendant => {
          const geo = descendant.geometry;
          if (geo) {
            const newGeo = geo.clone();
            newGeo.x += dx;
            newGeo.y += dy;
            graph.getModel().setGeometry(descendant, newGeo);
          }
        });
      } else if ((typeof window.isNotesNode === 'function' && window.isNotesNode(cell)) || 
                 (typeof window.isChecklistNode === 'function' && window.isChecklistNode(cell)) || 
                 (typeof window.isAlertNode === 'function' && window.isAlertNode(cell)) || 
                 (typeof window.isSubtitleNode === 'function' && window.isSubtitleNode(cell)) || 
                 (typeof window.isInfoNode === 'function' && window.isInfoNode(cell))) {
        // When dragging a notes/checklist/alert/subtitle/info node, check if it points to a question node
        const incomingEdges = graph.getIncomingEdges(cell) || [];
        const outgoingEdges = graph.getOutgoingEdges(cell) || [];
        
        // If node has outgoing edges (points to other nodes), move those descendants
        if (outgoingEdges.length > 0) {
          const descendants = getConnectedDescendants(cell);
          descendants.forEach(descendant => {
            const geo = descendant.geometry;
            if (geo) {
              const newGeo = geo.clone();
              newGeo.x += dx;
              newGeo.y += dy;
              graph.getModel().setGeometry(descendant, newGeo);
            }
          });
        }
        
        // If node has incoming edges (is pointed to by other nodes), 
        // check if any of those are question nodes and move them with their descendants
        incomingEdges.forEach(edge => {
          const source = edge.source;
          if (typeof window.isQuestion === 'function' && window.isQuestion(source) && !movedIds.has(source.id)) {
            // Move the question node and all its descendants
            const questionAndDescendants = [source, ...getConnectedDescendants(source)];
            questionAndDescendants.forEach(descendant => {
              const geo = descendant.geometry;
              if (geo) {
                const newGeo = geo.clone();
                newGeo.x += dx;
                newGeo.y += dy;
                graph.getModel().setGeometry(descendant, newGeo);
              }
            });
          }
        });
      } else if (typeof window.isPdfNode === 'function' && window.isPdfNode(cell)) {
        // PDF nodes should NOT drag any connected nodes - they move independently
        // This prevents PDF nodes from dragging question nodes or other connected elements
        console.log('PDF node dragged independently - no connected nodes moved');
      }
    });
    
    // Renumber question IDs based on new Y positions
    if (typeof window.renumberQuestionIds === 'function') {
      window.renumberQuestionIds();
    }
  });
}

// Setup Keyboard Event Listeners
function setupKeyboardEventListeners(graph) {
  if (!graph) return;
  
  // Keyboard shortcuts for copy/paste
  document.addEventListener('keydown', function(evt) {
    // Only handle shortcuts when not typing in input fields
    if (typeof window.isUserTyping === 'function' && window.isUserTyping(evt)) return;
    
    if (evt.ctrlKey || evt.metaKey) {
      if (evt.key === 'c') {
        evt.preventDefault();
        if (typeof window.copySelectedNodeAsJson === 'function') {
          window.copySelectedNodeAsJson();
        }
      } else if (evt.key === 'v') {
        evt.preventDefault();
        // Get the center of the viewport for pasting
        const viewport = graph.view.getGraphBounds();
        const centerX = viewport.x + viewport.width / 2;
        const centerY = viewport.y + viewport.height / 2;
        if (typeof window.pasteNodeFromJson === 'function') {
          window.pasteNodeFromJson(centerX, centerY);
        }
      }
    }
  });
  
  // Additional keyboard event listeners
  document.addEventListener('keydown', function(event) {
    // Only handle Delete key for node deletion, not Backspace
    // Backspace should only work in input fields for text editing
    if (event.key === 'Delete') {
      // Check if user is typing in an input field
      if (typeof window.isUserTyping === 'function' && window.isUserTyping(event)) return;
      
      if (typeof window.deleteSelectedNode === 'function') {
        window.deleteSelectedNode();
      }
    }
  });
  
  document.addEventListener('keyup', function(event) {
    if (event.key === 'Delete') {
      if (typeof window.refreshAllCells === 'function') {
        window.refreshAllCells();
      }
    }
  });
  
  document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      if (typeof window.undo === 'function') {
        window.undo();
      }
    } else if (event.ctrlKey && event.key === 'y') {
      event.preventDefault();
      if (typeof window.redo === 'function') {
        window.redo();
      }
    }
  });
}

// Setup Custom Click and Double-Click Handlers
function setupCustomClickHandlers(graph) {
  if (!graph) return;
  
  // Override the click handler to ensure proper behavior
  const baseClick = graph.click.bind(graph);
  graph.click = function(me) {
    const cell = me.getCell();
    const evt = me.getEvent();
    
    // Check if the click is on a dropdown or other interactive element
    if (evt && evt.target) {
      // Don't process clicks on dropdowns, inputs, or other form elements
      if (evt.target.closest('.question-type-dropdown') || 
          evt.target.closest('select') || 
          evt.target.closest('input') || 
          evt.target.closest('textarea') ||
          evt.target.closest('[contenteditable="true"]')) {
        return; // Let the dropdown handle its own events
      }
    }
    
    // Handle Ctrl/Shift+click manually
    // Use the event object properties to check modifier keys
    if (evt && (evt.ctrlKey || evt.metaKey || evt.shiftKey)) {
      if (cell) {
        const selection = graph.getSelectionCells();
        if (evt.ctrlKey || evt.metaKey) {
          // Ctrl/Cmd+click: toggle selection
          if (selection.includes(cell)) {
            graph.removeSelectionCell(cell);
          } else {
            graph.addSelectionCell(cell);
          }
        } else if (evt.shiftKey) {
          // Shift+click: add to selection
          if (!selection.includes(cell)) {
            graph.addSelectionCell(cell);
          }
        }
        me.consume();
        return;
      }
    }
    
    // Call the original click handler for normal clicks
    return baseClick(me);
  };
  
  // Proper double-click handler that handles all cases
  const baseDblClick = graph.dblClick.bind(graph);
  graph.dblClick = function(evt, cell) {
    // a) Question double-click = show properties popup
    if (typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
      if (typeof window.showPropertiesPopup === 'function') {
        window.showPropertiesPopup(cell);
      }
      mxEvent.consume(evt);
      return;
    }
    
    // b) Options double-click = show properties popup
    if (typeof window.isOptions === 'function' && window.isOptions(cell)) {
      if (typeof window.showPropertiesPopup === 'function') {
        window.showPropertiesPopup(cell);
      }
      mxEvent.consume(evt);
      return;
    }
    
    // c) Calculation node double-click = show calculation properties
    if (typeof window.isCalculationNode === 'function' && window.isCalculationNode(cell)) {
      if (typeof window.showCalculationProperties === 'function') {
        window.showCalculationProperties(cell, evt);
      }
      mxEvent.consume(evt);
      return;
    }
    
    // d) PDF node double-click = show properties popup
    if (typeof window.isPdfNode === 'function' && window.isPdfNode(cell)) {
      if (typeof window.showPropertiesPopup === 'function') {
        window.showPropertiesPopup(cell);
      }
      mxEvent.consume(evt);
      return;
    }
    
    // e) Edge double-click = reset geometry
    if (cell && cell.edge) {
      const geo = new mxGeometry();
      graph.getModel().setGeometry(cell, geo);
      mxEvent.consume(evt);
      return;
    }
    
    // e) Default behavior
    return baseDblClick(evt, cell);
  };
}

// Setup Draggable Shapes
function setupDraggableShapes(graph) {
  if (!graph) return;
  
  // Draggable shapes (including new Calculation Node)
  const toolbarShapes = document.querySelectorAll(".shape");
  toolbarShapes.forEach(shapeEl => {
    const baseStyle = shapeEl.dataset.style;
    mxUtils.makeDraggable(
      shapeEl,
      graph,
      function (graph, evt, targetCell, x, y) {
        const parent = graph.getDefaultParent();
        graph.getModel().beginUpdate();
        let newVertex;
        try {
          const label = shapeEl.dataset.type + " node";
          let styleWithPointer = baseStyle;
          if (!styleWithPointer.includes("pointerEvents=")) {
            styleWithPointer += "pointerEvents=1;overflow=fill;";
          }
          
          let width = 160;
          if (shapeEl.dataset.type === 'question') {
            width = 280; // Wider for questions to fit dropdown
          }
          
          newVertex = graph.insertVertex(
            parent,
            null,
            label,
            x,
            y,
            width,
            80,
            styleWithPointer
          );
        } finally {
          graph.getModel().endUpdate();
        }
        
        // If question
        if (typeof window.isQuestion === 'function' && window.isQuestion(newVertex)) {
          // Only set type if there is a questionType in the style
          if (typeof window.getQuestionType === 'function') {
            const qType = window.getQuestionType(newVertex);
            if (qType && typeof window.setQuestionType === 'function') {
              window.setQuestionType(newVertex, qType);
            }
          }
          // Otherwise, leave as unassigned so the dropdown appears
        } else if (typeof window.isOptions === 'function' && window.isOptions(newVertex)) {
          if (typeof window.refreshOptionNodeId === 'function') {
            window.refreshOptionNodeId(newVertex);
          }
        } else if (typeof window.isCalculationNode === 'function' && window.isCalculationNode(newVertex)) {
          if (typeof window.initializeCalculationNode === 'function') {
            window.initializeCalculationNode(newVertex);
          }
        }
        
        // Select the new vertex
        graph.setSelectionCell(newVertex);
        
        // Request autosave
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      }
    );
  });
}

// Initialize the Event Handlers Module
function initializeEventHandlersModule(graph) {
  if (!graph) return;
  
  // Setup all event listeners
  setupMouseEventListeners(graph);
  setupGraphEventListeners(graph);
  setupKeyboardEventListeners(graph);
  setupCustomClickHandlers(graph);
  setupDraggableShapes(graph);
}

// Export all functions to window.events namespace
window.events = {
  // Mouse event handlers
  handleMultipleTextboxClick,
  handleMultipleTextboxFocus,
  handleDropdownClick,
  handleDropdownFocus,
  handleDropdownMouseDown,
  initDropdownTextEditing,
  handleTitleInputKeydown,
  
  // Setup functions
  setupMouseEventListeners,
  setupGraphEventListeners,
  setupKeyboardEventListeners,
  setupCustomClickHandlers,
  setupDraggableShapes,
  
  // Initialization
  initializeEventHandlersModule
};

// Also export individual functions for backward compatibility
Object.assign(window, {
  handleMultipleTextboxClick,
  handleMultipleTextboxFocus,
  handleDropdownClick,
  handleDropdownFocus,
  handleDropdownMouseDown,
  initDropdownTextEditing,
  handleTitleInputKeydown
});

// Initialize the module when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Will be initialized when graph is available
  });
} else {
  // DOM already loaded, will be initialized when graph is available
}
