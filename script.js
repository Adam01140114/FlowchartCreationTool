/**************************************************
 ************ Firebase Config & Basic Auth ********
 **************************************************/
// Firebase configuration moved to config.js module
// const db and currentUser are now available from config.js
  
  // Colors moved to config.js module

// TEST: Script.js is loading!
// Script loading


/**************************************************
 *            GLOBAL  TYPING  HELPER              *
 **************************************************/
function isUserTyping (evt = null) {
  // Prefer the event target if we got one, otherwise fall back to activeElement
  const el = (evt && evt.target) || document.activeElement;
  if (!el) return false;
  // Direct hit?
  if (el.matches('input, textarea, [contenteditable="true"]')) return true;
  // Something nested inside a foreignObject? walk up the DOM
  return !!el.closest('input, textarea, [contenteditable="true"]');
}



  // Context menu functions moved to context-menus.js module
  
  // updateEndNodeCell function moved inside DOMContentLoaded event listener
  // colorPreferences moved to config.js module
  
  // Section preferences moved to config.js module
  
  // currentFlowchartName moved to config.js module
  
  // updateLegendColors function moved to config.js module

const loginOverlay = document.getElementById("loginOverlay");
const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

const flowchartListOverlay = document.getElementById("flowchartListOverlay");
const flowchartListDiv = document.getElementById("flowchartList");
const closeFlowchartListBtn = document.getElementById("closeFlowchartListBtn");

const logoutBtn = document.getElementById("logoutBtn");

// Close flowchart list overlay
closeFlowchartListBtn.addEventListener("click", function() {
  document.getElementById("flowchartListOverlay").style.display = "none";
});

// Add click-outside-to-close for library overlay
document.getElementById("flowchartListOverlay").addEventListener("click", function(event) {
  if (event.target === this) {
    // Clicked on the overlay background, not the panel
    this.style.display = "none";
  }
});

  // Authentication functions have been moved to auth.js

/**************************************************
 ************ Section Preferences & Legend ********
 **************************************************/
// Section-related functions have been moved to legend.js

// Add these functions at the top level
// Section-related functions have been moved to legend.js
let selectedSectionForColor = null;

/**************************************************
 ************  GRAPH, NODES, CONTEXT MENU, etc. ********
 **************************************************/
let graph = null;
let selectedCell = null;
let currentMouseEvent = null;
let lastSelectedCell = null;
let jumpModeNode = null;
  // jumpBorderStyle moved to config.js module
  
  // Mouse position tracking moved to events.js module
  
  // Graph-dependent functions will be defined after graph initialization
  
  // Helper function to get the current graph safely
  function getCurrentGraph() {
    return window.graph || graph;
  }
  
  // Override the global graph variable to ensure it's always available
  Object.defineProperty(window, 'graph', {
    get: function() {
      return graph;
    },
    set: function(value) {
      graph = value;
      // Also update the local variable
      if (value) {
        console.log('Graph initialized globally:', value);
      }
    }
  });
  
  
  // cleanStyle function moved to config.js module

// loadFlowchartData function removed - using the one from library.js instead
// The library.js version properly handles groups data and all other functionality

document.addEventListener("DOMContentLoaded", function() {
  checkForSavedLogin();
  
  // autoLogin has been moved to auth.js

  const container = document.getElementById("graphContainer");
  const contextMenu = document.getElementById("contextMenu");
  const notesContextMenu = document.getElementById("notesContextMenu");
  const edgeContextMenu = document.getElementById("edgeContextMenu");
  const edgeStyleSubmenu = document.getElementById("edgeStyleSubmenu");
  const deleteNodeButton = document.getElementById("deleteNode");
  
  // Add event listener for location IDs popup close button
  const closeLocationIdsPopupBtn = document.getElementById("closeLocationIdsPopup");
  if (closeLocationIdsPopupBtn) {
    closeLocationIdsPopupBtn.addEventListener("click", function() {
      window.closeLocationIdsPopup();
    });
  }
  const jumpNodeButton = document.getElementById("jumpNode");
  const changeTypeButton = document.getElementById("changeType");
  const propertiesButton = document.getElementById("propertiesButton");
  const yesNoNodeButton = document.getElementById("yesNoNode");
  const newSectionButton = document.getElementById("newSectionNode");

  const typeSubmenu = document.getElementById("typeSubmenu");
  const calcSubmenu = document.getElementById("calcSubmenu");
  const optionTypeSubmenu = document.getElementById("optionTypeSubmenu");
  const calcTypeBtn = document.getElementById("calcType");
  const subtitleTypeBtn = document.getElementById("subtitleType");
  const infoTypeBtn = document.getElementById("infoType");
      // Question type buttons moved to questions.js module
  
    // Properties panel elements moved to properties.js module

  const resetBtn = document.getElementById("resetBtn");

    // Graph initialization moved to graph.js module
    if (typeof initializeGraph === 'function') {
      graph = initializeGraph();
      console.log('Graph initialized:', graph);
      
      // Set up zoom sensitivity for the new graph
      if (typeof window.setupZoomSensitivityForGraph === 'function') {
        window.setupZoomSensitivityForGraph(graph);
      }
    } else {
      console.error('initializeGraph function not found');
      // Fallback: create graph directly
  graph = new mxGraph(container);
      console.log('Fallback graph created:', graph);
      
      // Set up zoom sensitivity for the fallback graph
      if (typeof window.setupZoomSensitivityForGraph === 'function') {
        window.setupZoomSensitivityForGraph(graph);
      }
    }
    
    // Mouse event listeners moved to events.js module
  
    // Graph-dependent event handler functions moved to events.js module
    
    // Define updateEndNodeCell function after graph initialization
    window.updateEndNodeCell = function(cell) {
      if (graph) {
        const html = `<div style="text-align:center;padding:8px;"><strong>END</strong></div>`;
        graph.getModel().beginUpdate();
        try {
          graph.getModel().setValue(cell, html);
          graph.setCellStyles(mxConstants.STYLE_EDITABLE, "0", [cell]);
        } finally {
          graph.getModel().endUpdate();
        }
      }
    };
    
    // Define refreshAllCells and performRefreshAllCells functions after graph initialization
    window.refreshAllCells = function(selectedCells = null) {
      if (!graph) return;
      
      // Prevent multiple simultaneous calls
      if (window.isRefreshing) {
        return;
      }
      
      // Throttle rapid successive calls
      if (window.refreshAllCellsTimeout) {
        clearTimeout(window.refreshAllCellsTimeout);
      }
      
      // Dynamic throttle delay based on cell count for better performance
      const cellCount = graph.getModel().getChildCount(graph.getDefaultParent());
      const throttleDelay = cellCount > 100 ? 300 : (cellCount > 50 ? 200 : 150);
      
      window.refreshAllCellsTimeout = setTimeout(() => {
        window.performRefreshAllCells(selectedCells);
      }, throttleDelay);
    };
    
    window.performRefreshAllCells = function(selectedCells = null) {
      if (!graph || window.isRefreshing) return;
      
      window.isRefreshing = true;
      const startTime = performance.now();
      
      try {
        const parent = graph.getDefaultParent();
        let vertices;
        
        // If specific cells are provided, only refresh those
        if (selectedCells && selectedCells.length > 0) {
          vertices = selectedCells;
        } else {
          vertices = graph.getChildVertices(parent);
        }
        
        // Skip refresh if no cells to process
        if (!vertices || vertices.length === 0) {
          return;
        }
        
        // Batch updates for better performance
        graph.getModel().beginUpdate();
        
        // Use for...of for better performance with large arrays
        for (const cell of vertices) {
          // Skip cells that don't need updates (optimization for large flowcharts)
          if (cell._skipRefresh) {
            continue;
          }
          
          if (window.colorCell) {
            window.colorCell(cell);
          }
    
          if (isEndNode(cell)) {
            window.updateEndNodeCell(cell);
          }
          
          // Handle different option node types
          if (isOptions(cell)) {
            const questionType = getQuestionType(cell);
            if (questionType === "imageOption") {
              if (window.updateImageOptionCell) window.updateImageOptionCell(cell);
            } else if (questionType === "amountOption") {
              // Amount option has its own handling
            } else if (questionType === "notesNode") {
              if (window.updateNotesNodeCell) window.updateNotesNodeCell(cell);
            } else if (questionType === "checklistNode") {
              if (window.updateChecklistNodeCell) window.updateChecklistNodeCell(cell);
            } else if (questionType === "alertNode") {
              if (window.updateAlertNodeCell) window.updateAlertNodeCell(cell);
            } else {
              // Regular option nodes
              if (window.updateOptionNodeCell) window.updateOptionNodeCell(cell);
            }
            
            // DISABLED: Automatic Node ID regeneration during text editing
            // Node IDs will only change when manually edited or reset using the button
          }
          
          // Handle PDF nodes
          if (isPdfNode(cell)) {
            if (window.updatePdfNodeCell) window.updatePdfNodeCell(cell);
          }
          
          // If it's a dropdown node, make sure we update _questionText from value
          if (isQuestion(cell) && getQuestionType(cell) === "dropdown") {
            // Extract text from HTML value if present
            if (cell.value) {
              const cleanValue = cell.value.replace(/<[^>]+>/g, "").trim();
              if (cleanValue) {
                cell._questionText = cleanValue;
              }
            }
          }
          
          // If newly dropped question node is just placeholder or has empty value
          if (isQuestion(cell) && (!cell.value || /^\s*$/.test(cell.value) || cell.value === "question node" || cell.value === "Question Node")) {
            cell.value = `
              <div style="display: flex; justify-content: center; align-items: center; height:100%;">
                <select class="question-type-dropdown" data-cell-id="${cell.id}" style="margin:auto; font-size: 1.1em; padding: 10px 18px; border-radius: 8px; border: 1px solid #b0b8c9; box-shadow: 0 2px 8px rgba(0,0,0,0.07); background: #f8faff; color: #222; transition: border-color 0.2s, box-shadow 0.2s; outline: none; min-width: 220px; cursor:pointer;"
                  onfocus="this.style.borderColor='#4a90e2'; this.style.boxShadow='0 0 0 2px #b3d4fc';"
                  onblur="this.style.borderColor='#b0b8c9'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)';"
                  onmouseover="this.style.borderColor='#4a90e2';"
                  onmouseout="this.style.borderColor='#b0b8c9';"
                  onchange="window.pickTypeForCell('${cell.id}', this.value)">
                  <option value="">-- Choose Question Type --</option>
                  <option value="text">Text</option>
                  <option value="dropdown">Dropdown</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="bigParagraph">Big Paragraph</option>
                  <option value="multipleTextboxes">Multiple Textboxes</option>
                  <option value="multipleDropdownType">Multiple Dropdown Type</option>
                  <option value="dateRange">Date Range</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </div>`;
          }
        }
        
        graph.getModel().endUpdate();
        
        // Clear cell text cache when refreshing all cells
        if (window.cellTextCache) {
          window.cellTextCache.clear();
        }
        
        // Renumber question IDs automatically based on Y position
        renumberQuestionIds();
        
        // Performance monitoring
        const endTime = performance.now();
        const refreshTime = endTime - startTime;
        if (window.performanceMetrics) {
          window.performanceMetrics.refreshCount++;
          window.performanceMetrics.lastRefreshTime = refreshTime;
          window.performanceMetrics.cellCount = vertices.length;
          window.performanceMetrics.averageRefreshTime = 
            (window.performanceMetrics.averageRefreshTime * (window.performanceMetrics.refreshCount - 1) + refreshTime) / window.performanceMetrics.refreshCount;
          
          // Log performance warning for slow refreshes (adjusted thresholds for large flowcharts)
          const warningThreshold = vertices.length > 100 ? 500 : (vertices.length > 50 ? 200 : 100);
          if (refreshTime > warningThreshold && vertices.length > 20) {
            console.warn(`Slow refresh detected: ${refreshTime.toFixed(2)}ms for ${vertices.length} cells`);
          }
        }
        
      } finally {
        window.isRefreshing = false;
      }
    };
    
    // Optimized function to refresh only specific cells
    window.refreshSpecificCells = function(cells) {
      if (!graph || !cells || cells.length === 0) return;
      
      // Prevent multiple simultaneous calls
      if (window.isRefreshing) {
        return;
      }
      
      // Mark cells as needing refresh
      cells.forEach(cell => {
        if (cell) {
          cell._needsRefresh = true;
          cell._skipRefresh = false;
        }
      });
      
      // Throttle rapid successive calls
      if (window.refreshAllCellsTimeout) {
        clearTimeout(window.refreshAllCellsTimeout);
      }
      
      window.refreshAllCellsTimeout = setTimeout(() => {
        window.performRefreshAllCells(cells);
      }, 100); // Faster throttle for specific cells
    };
  
  
    /*****************************************************************
   * SHOW-ONLY-THE-TEXT   (hides the wrapper while the user edits)
   *****************************************************************/
  
  // isSimpleHtmlQuestion function moved to questions.js module
  
  /* ----------  a) what the in-place editor should display  ---------- */
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
  
  // Label changed event listener moved to events.js module
  
  
      // Double-click behavior moved to graph.js module
    // Custom double-click handling for specific node types
    if (typeof window.setupCustomDoubleClickBehavior === 'function') {
      try {
        window.setupCustomDoubleClickBehavior(graph);
      } catch (error) {
        console.error("Error calling window.setupCustomDoubleClickBehavior:", error);
      }
    }
  

  // Let mxGraph render cell labels as HTML
  graph.setHtmlLabels(true);

  // Force all vertex labels to be interpreted as HTML
  graph.isHtmlLabel = function(cell) {
    return true;
  };

  // Disable built-in label editing if it's multipleTextboxes or multipleDropdownType
  // ----------  AFTER  ----------
graph.isCellEditable = function (cell) {
  if (!cell) return false;
  const qt = getQuestionType(cell);
  if (qt === 'multipleTextboxes' ||
      qt === 'multipleDropdownType' ||
      qt === 'dropdown') {          // new âœ±
    return false;
  }
  // Disable direct editing for PDF nodes (they use custom input fields)
  if (isPdfNode(cell)) {
    return false;
  }
  // Disable direct editing for alert nodes (they use custom input fields)
  if (isAlertNode(cell)) {
    return false;
  }
  // Allow dropdown to be edited directly with double-click
  if (qt === 'dropdown') {
    return true;
  }
  // Allow option nodes to be edited directly with double-click
  if (isOptions(cell) && !qt.includes('image') && !qt.includes('amount')) {
    return true;
  }
  // Allow subtitle and info nodes to be edited directly with double-click
  if (isSubtitleNode(cell) || isInfoNode(cell)) {
    return true;
  }
  return true;
};


  // Enter => newline
  graph.setEnterStopsCellEditing(false);

  // Set up proper panning with left button
  graph.setPanning(true);
  graph.panningHandler.useLeftButtonForPanning = true;

    // Cell editing listener moved to events.js module

  // Comment out the line that disables the context menu on the graph container
  // mxEvent.disableContextMenu(container);   // comment this out
  graph.setCellsMovable(true);
  graph.setConnectable(true);
  graph.setCellsResizable(true);

  // We'll focus just on making right-click work properly
  // Customize rubberband handling (we'll skip selection box for now)
  const rubberband = new mxRubberband(graph);
  
  // Function to auto-select connecting edges
  function autoSelectConnectingEdges() {
    const sel = graph.getSelectionCells();
    const verts = sel.filter(c => c && c.vertex);
    if (verts.length < 2) return;
  
    const toAdd = [];
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        const between = graph.getEdgesBetween(verts[i], verts[j], false) || [];
        for (const e of between) {
          if (!sel.includes(e) && !toAdd.includes(e)) toAdd.push(e);
        }
      }
    }
    if (toAdd.length) graph.getSelectionModel().addCells(toAdd);
  }

  // Add resize listener for notes nodes to update font size dynamically
  graph.getModel().addListener(mxEvent.CHANGE, function(sender, evt) {
    const changes = evt.getProperty('edit').changes;
    changes.forEach(change => {
      // Check for geometry changes (resize/move) on notes nodes
      if (change instanceof mxGeometryChange && change.cell && isNotesNode(change.cell)) {
        // Notes node was resized, update the font size
        setTimeout(() => {
          updateNotesNodeCell(change.cell);
        }, 10); // Small delay to ensure geometry is updated
      }
      
      // Check for geometry changes (resize/move) on calculation nodes
      if (change instanceof mxGeometryChange && change.cell && typeof window.isCalculationNode === 'function' && window.isCalculationNode(change.cell)) {
        // Calculation node was resized - alert disabled
        // Dimensions are now handled silently without showing alert
      }
    });
  });
  

    // Selection change listener moved to events.js module
  
    // Cells moved event listener moved to events.js module
    
    // Custom click and double-click handlers moved to events.js module
    
  
    
    // Context menu handling moved to context-menus.js module
    if (typeof window.initializeContextMenusModule === 'function') {
      window.initializeContextMenusModule(graph);
    }
    
    // Properties panel handling moved to properties.js module
    if (typeof window.initializePropertiesPanelModule === 'function') {
      window.initializePropertiesPanelModule();
    }
    
    // Event handlers moved to events.js module
    if (typeof window.initializeEventHandlersModule === 'function') {
      window.initializeEventHandlersModule(graph);
    }
  
    // Global click listener for hiding menus moved to context-menus.js module

  // Slight style tweaks to move label text away from top
  const style = graph.getStylesheet().getDefaultVertexStyle();
  style[mxConstants.STYLE_VERTICAL_ALIGN] = "top";
  style[mxConstants.STYLE_VERTICAL_LABEL_POSITION] = "middle";
  style[mxConstants.STYLE_SPACING_TOP] = 10;
  
  // Ensure vertices (nodes) are always displayed in front of edges (connectors)
  style[mxConstants.STYLE_Z_INDEX] = 1;
  
  // Set edge z-index to be behind vertices
  const edgeStyle = graph.getStylesheet().getDefaultEdgeStyle();
  edgeStyle[mxConstants.STYLE_Z_INDEX] = 0;

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
      
      // Limit zoom range - maximum range for better usability
      if (newScale >= 0.01 && newScale <= 20.0) {
        // Get mouse position relative to the container
        const container = graph.container;
        const rect = container.getBoundingClientRect();
        const mouseX = evt.clientX - rect.left;
        const mouseY = evt.clientY - rect.top;
        
        // Get current view state
        const currentTranslate = graph.view.translate;
        const currentScale = graph.view.scale;
        
        // Calculate the point in graph coordinates that the mouse is over
        const graphX = (mouseX / currentScale) - currentTranslate.x;
        const graphY = (mouseY / currentScale) - currentTranslate.y;
        
        // Set the new scale
        graph.view.setScale(newScale);
        
        // Calculate the new translation to keep the mouse point in the same screen position
        const newTranslateX = (mouseX / newScale) - graphX;
        const newTranslateY = (mouseY / newScale) - graphY;
        
        // Apply the new translation
        graph.view.setTranslate(newTranslateX, newTranslateY);
      }
      
      mxEvent.consume(evt);
    }
  }, container);

    // Keyboard shortcuts and selection tracking moved to events.js module
  
    // Draggable shapes setup moved to events.js module
  
    // MOVE_CELLS event listener moved to events.js module
  
    // Delete node event handler moved to context-menus.js module

  // Mark/unmark jump node
  jumpNodeButton.addEventListener("click", () => {
    if (selectedCell) {
      if (jumpModeNode && jumpModeNode !== selectedCell) {
        removeJumpStyling(jumpModeNode);
      }
      jumpModeNode = selectedCell;
      addJumpStyling(jumpModeNode);
    }
    hideContextMenu();
  });

  // Create yes/no child options
  yesNoNodeButton.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      createYesNoOptions(selectedCell);
    }
    hideContextMenu();
  });

  // 'Change Type' -> Show submenu
  changeTypeButton.addEventListener("click", () => {
    const rect = contextMenu.getBoundingClientRect();
    if (selectedCell && isQuestion(selectedCell)) {
      typeSubmenu.style.display = "block";
      typeSubmenu.style.left = rect.right + "px";
      typeSubmenu.style.top = rect.top + "px";
      calcSubmenu.style.display = "none";
      optionTypeSubmenu.style.display = "none";
    } else if (selectedCell && isOptions(selectedCell)) {
      optionTypeSubmenu.style.display = "block";
      optionTypeSubmenu.style.left = rect.right + "px";
      optionTypeSubmenu.style.top = rect.top + "px";
      typeSubmenu.style.display = "none";
      calcSubmenu.style.display = "none";
    } else if (selectedCell && (isCalculationNode(selectedCell) || isSubtitleNode(selectedCell) || isInfoNode(selectedCell))) {
      calcSubmenu.style.display = "block";
      calcSubmenu.style.left = rect.right + "px";
      calcSubmenu.style.top = rect.top + "px";
      typeSubmenu.style.display = "none";
      optionTypeSubmenu.style.display = "none";
    }
  });

    // Question type event handlers moved to questions.js module

  // Calc submenu buttons
  calcTypeBtn.addEventListener("click", () => {
    if (selectedCell) {
        // Extract and preserve the current text content
        const preservedText = extractTextFromCell(selectedCell);
        
      // Convert to calculation node
      graph.getModel().beginUpdate();
      try {
          if (typeof window.convertToCalculationNode === 'function') {
            window.convertToCalculationNode(selectedCell, preservedText);
          }
      } finally {
        graph.getModel().endUpdate();
      }
      refreshAllCells();
    }
    hideContextMenu();
  });

  subtitleTypeBtn.addEventListener("click", () => {
    if (selectedCell) {
        // Extract and preserve the current text content
        const preservedText = extractTextFromCell(selectedCell);
        
      // Convert to subtitle node
      graph.getModel().beginUpdate();
      try {
        selectedCell.style = selectedCell.style.replace(/nodeType=[^;]+/, "nodeType=subtitle");
          selectedCell._subtitleText = preservedText || "Subtitle text";
        updateSubtitleNodeCell(selectedCell);
      } finally {
        graph.getModel().endUpdate();
      }
      refreshAllCells();
    }
    hideContextMenu();
  });

  infoTypeBtn.addEventListener("click", () => {
    if (selectedCell) {
        // Extract and preserve the current text content
        const preservedText = extractTextFromCell(selectedCell);
        
      // Convert to info node
      graph.getModel().beginUpdate();
      try {
        selectedCell.style = selectedCell.style.replace(/nodeType=[^;]+/, "nodeType=info");
          selectedCell._infoText = preservedText || "Information text";
        updateInfoNodeCell(selectedCell);
      } finally {
        graph.getModel().endUpdate();
      }
      refreshAllCells();
    }
    hideContextMenu();
  });

    // Multiple textboxes and dropdown event handlers moved to questions.js module

  // Option type submenu event handlers
  const regularOptionTypeBtn = document.getElementById("regularOptionType");
  const imageOptionTypeBtn = document.getElementById("imageOptionType");
  const amountOptionTypeBtn = document.getElementById("amountOptionType");
  const notesNodeTypeBtn = document.getElementById("notesNodeType");
  const alertNodeTypeBtn = document.getElementById("alertNodeType");
  const checklistNodeTypeBtn = document.getElementById("checklistNodeType");
  const endNodeTypeBtn = document.getElementById("endNodeType");

  regularOptionTypeBtn.addEventListener("click", () => {
    if (selectedCell && isOptions(selectedCell)) {
      setOptionType(selectedCell, "dropdown");
      refreshSpecificCells([selectedCell]);
    }
    hideContextMenu();
  });

  imageOptionTypeBtn.addEventListener("click", () => {
    if (selectedCell && isOptions(selectedCell)) {
      setOptionType(selectedCell, "imageOption");
      refreshSpecificCells([selectedCell]);
    }
    hideContextMenu();
  });

  amountOptionTypeBtn.addEventListener("click", () => {
    if (selectedCell && isOptions(selectedCell)) {
      setOptionType(selectedCell, "amountOption");
      refreshSpecificCells([selectedCell]);
    }
    hideContextMenu();
  });

  notesNodeTypeBtn.addEventListener("click", () => {
    if (selectedCell && isOptions(selectedCell)) {
      setOptionType(selectedCell, "notesNode");
      refreshSpecificCells([selectedCell]);
    }
    hideContextMenu();
  });

  checklistNodeTypeBtn.addEventListener("click", () => {
    if (selectedCell && isOptions(selectedCell)) {
      setOptionType(selectedCell, "checklistNode");
      refreshSpecificCells([selectedCell]);
    }
    hideContextMenu();
  });

  alertNodeTypeBtn.addEventListener("click", () => {
    if (selectedCell && isOptions(selectedCell)) {
      setOptionType(selectedCell, "alertNode");
      refreshSpecificCells([selectedCell]);
    }
    hideContextMenu();
  });

  endNodeTypeBtn.addEventListener("click", () => {
    if (selectedCell && isOptions(selectedCell)) {
      setOptionType(selectedCell, "end");
      refreshSpecificCells([selectedCell]);
    }
    hideContextMenu();
  });

  // Notes context menu event handlers are now handled in context-menus.js
  // Removed duplicate event listeners to prevent conflicts

  // Increase the "section number" for a question
  newSectionButton.addEventListener("click", () => {
    if (selectedCell) {
      // getSection is defined in legend.js
      const currentSection = parseInt(getSection(selectedCell) || "1", 10);
      // setSection is defined in legend.js
      setSection(selectedCell, currentSection + 1);
      refreshAllCells();
    }
    hideContextMenu();
  });

    // Properties menu function moved to properties.js module
  
    // Properties button event listener moved to properties.js module
  
    // Editable field function moved to properties.js module
  
    // Properties panel functions moved to properties.js module
/**************************************************
 *              KEYBOARD  SHORTCUTS               *
 **************************************************/
// Use document event listener instead of mxKeyHandler to avoid duplicate bindings
if (!window.flowchartKeyboardInitialized) {
  
  document.addEventListener('keydown', function(event) {
    // Handle Ctrl+C
    if ((event.key === 'c' || event.key === 'C') && (event.ctrlKey || event.metaKey)) {
      if (isUserTyping(event)) return;
      event.preventDefault();
      copySelectedNodeAsJson();
    }
    
    // Handle Ctrl+V
    if ((event.key === 'v' || event.key === 'V') && (event.ctrlKey || event.metaKey)) {
      console.log('🔍 [KEY DEBUG] Ctrl+V document listener triggered');
      if (isUserTyping(event)) return;
      event.preventDefault();
      const mousePos = graph.getPointForEvent(graph.lastEvent);
      window.pasteNodeFromJson(mousePos ? mousePos.x : undefined,
                        mousePos ? mousePos.y : undefined);
    }
    
    // Handle Ctrl+S
    if ((event.key === 's' || event.key === 'S') && (event.ctrlKey || event.metaKey)) {
      console.log('🔍 [KEY DEBUG] Ctrl+S document listener triggered');
      if (isUserTyping(event)) return;
      event.preventDefault();
      // Call saveFlowchart function directly if it exists
      if (typeof window.saveFlowchart === 'function') {
        console.log('🔍 [KEY DEBUG] Calling saveFlowchart function directly');
        window.saveFlowchart();
      } else {
        // Fallback: try to find and click save button
        const saveButton = document.getElementById('saveFlowchartButton');
        if (saveButton) {
          saveButton.click();
        } else {
          console.log('🔍 [KEY DEBUG] No save functionality found');
        }
      }
    }
  });
  
  // Mark that keyboard shortcuts have been initialized
  window.flowchartKeyboardInitialized = true;
} else {
  console.log('🔍 [KEYHANDLER DEBUG] Keyboard shortcuts already initialized, skipping');
}

/* Ctrl + Shift – reset all PDF and node IDs */
document.addEventListener('keydown', function(event) {
  if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey) {
    // Only trigger on the initial keydown, not on key repeats
    if (event.repeat) return;
    
    if (isUserTyping()) return; // Don't trigger if user is typing
    
    // Proceed without confirmation dialog
    
    console.log('🔄 [CTRL+SHIFT] Running reset all PDF and node IDs...');
    
    // Reset PDF inheritance for all nodes FIRST
    if (typeof window.resetAllPdfInheritance === 'function') {
      window.resetAllPdfInheritance();
      console.log('🔄 [CTRL+SHIFT] PDF inheritance reset completed');
    } else {
      console.warn('🔄 [CTRL+SHIFT] resetAllPdfInheritance function not available');
    }
    
    // Reset all Node IDs SECOND (after PDF inheritance is fixed)
    if (typeof resetAllNodeIds === 'function') {
      resetAllNodeIds();
      console.log('🔄 [CTRL+SHIFT] Node IDs reset completed');
    } else {
      console.warn('🔄 [CTRL+SHIFT] resetAllNodeIds function not available');
    }
    
    event.preventDefault();
  }
});

  
  // Add listener for copy button
  document.getElementById('copyNodeButton').addEventListener('click', function() {
    console.log('🔍 [BUTTON DEBUG] Copy button clicked');
    copySelectedNodeAsJson();
    hideContextMenu();
  });
  
  // Add listener for paste here button
  document.getElementById('pasteHereButton').addEventListener('click', function() {
    if (window.emptySpaceClickX !== undefined && window.emptySpaceClickY !== undefined) {
      window.pasteNodeFromJson(window.emptySpaceClickX, window.emptySpaceClickY);
      window.emptySpaceClickX = undefined;
      window.emptySpaceClickY = undefined;
    } else {
      window.pasteNodeFromJson();
    }
    hideContextMenu();
  });

  // Edge context menu event listeners
  document.getElementById('untangleEdge').addEventListener('click', function() {
    const selectedCells = graph.getSelectionCells();
    if (selectedCells.length === 1 && selectedCells[0].edge) {
      const edge = selectedCells[0];
      // Reset edge geometry to default (remove any custom points)
      const geo = new mxGeometry();
      graph.getModel().setGeometry(edge, geo);
      requestAutosave();
    }
    hideContextMenu();
  });

  document.getElementById('changeEdgeStyle').addEventListener('click', function() {
    const rect = edgeContextMenu.getBoundingClientRect();
    edgeStyleSubmenu.style.display = "block";
    edgeStyleSubmenu.style.left = rect.right + "px";
    edgeStyleSubmenu.style.top = rect.top + "px";
  });

  document.getElementById('deleteEdge').addEventListener('click', function() {
    const selectedCells = graph.getSelectionCells();
    if (selectedCells.length === 1 && selectedCells[0].edge) {
      graph.removeCells(selectedCells);
      requestAutosave();
    }
    hideContextMenu();
  });

  // Edge style submenu event listeners
  document.getElementById('edgeStyleCurved').addEventListener('click', function() {
    const selectedCells = graph.getSelectionCells();
    if (selectedCells.length === 1 && selectedCells[0].edge) {
      const edge = selectedCells[0];
      let style = edge.style || "";
      style = style.replace(/edgeStyle=[^;]+/g, 'edgeStyle=orthogonalEdgeStyle');
      style = style.replace(/rounded=[^;]+/g, 'rounded=1');
      style = style.replace(/orthogonalLoop=[^;]+/g, 'orthogonalLoop=1');
      if (!style.includes('rounded=')) {
        style += ';rounded=1';
      }
      if (!style.includes('orthogonalLoop=')) {
        style += ';orthogonalLoop=1';
      }
      graph.getModel().setStyle(edge, style);
      requestAutosave();
    }
    hideContextMenu();
  });

  document.getElementById('edgeStyleDirect').addEventListener('click', function() {
    const selectedCells = graph.getSelectionCells();
    if (selectedCells.length === 1 && selectedCells[0].edge) {
      const edge = selectedCells[0];
      let style = edge.style || "";
      style = style.replace(/edgeStyle=[^;]+/g, 'edgeStyle=none');
      style = style.replace(/rounded=[^;]+/g, 'rounded=0');
      style = style.replace(/orthogonalLoop=[^;]+/g, 'orthogonalLoop=0');
      if (!style.includes('rounded=')) {
        style += ';rounded=0';
      }
      if (!style.includes('orthogonalLoop=')) {
        style += ';orthogonalLoop=0';
      }
      graph.getModel().setStyle(edge, style);
      requestAutosave();
    }
    hideContextMenu();
  });

  graph.getModel().addListener(mxEvent.EVENT_CHANGE, function(sender, evt) {
    const changes = evt.getProperty("changes");
    if (!changes) return;
    
    const modifiedQuestionCells = new Set();
    
    changes.forEach(change => {
      if (change.constructor.name === "mxValueChange") {
        const { cell, value } = change;
        
        // Track modified question cells
        if (isQuestion(cell)) {
          modifiedQuestionCells.add(cell);
        }
        
        if (value && typeof value === "string") {
          // If a label ends with "?", treat as question
          if (value.trim().endsWith("?")) {
            if (!isQuestion(cell)) {
              let style = cell.style || "";
              style += ";nodeType=question;";
              graph.getModel().setStyle(cell, style);
              // DISABLED: Automatic Node ID generation
              // Node IDs will only change when manually edited or reset using the button
            }
          }
        }
      }
    });
    
    // Update calculation nodes that depend on modified questions
    modifiedQuestionCells.forEach(questionCell => {
      updateAllCalcNodesOnQuestionChange(questionCell, false);
    });
    
    refreshAllCells();
  });

// Function to propagate PDF properties downstream through the flowchart
function propagatePdfPropertiesDownstream(startCell, sourceCell, visited = new Set()) {
    if (!startCell || visited.has(startCell.id)) return;
    visited.add(startCell.id);
    
    const graph = window.graph;
    if (!graph) return;
    
    // Get all outgoing edges from the start cell
    const outgoingEdges = graph.getOutgoingEdges(startCell) || [];
    
    for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (targetCell && !visited.has(targetCell.id)) {
            // Check if target doesn't already have PDF properties
            if (!targetCell._pdfName && !targetCell._pdfFilename && !targetCell._pdfUrl && 
                !(typeof window.isPdfNode === 'function' && window.isPdfNode(targetCell))) {
                
                // Copy PDF properties from source to target
                if (sourceCell._pdfName) targetCell._pdfName = sourceCell._pdfName;
                if (sourceCell._pdfFilename) targetCell._pdfFilename = sourceCell._pdfFilename;
                if (sourceCell._pdfUrl) targetCell._pdfUrl = sourceCell._pdfUrl;
                if (sourceCell._priceId) targetCell._priceId = sourceCell._priceId;
                if (sourceCell._characterLimit) targetCell._characterLimit = sourceCell._characterLimit;
                
                console.log(`ðŸ” [PDF INHERITANCE] Propagated PDF properties from ${sourceCell.id} to downstream ${targetCell.id}`);
                
                // Recursively propagate to further downstream nodes
                propagatePdfPropertiesDownstream(targetCell, sourceCell, visited);
            }
        }
    }
}

  graph.connectionHandler.addListener(mxEvent.CONNECT, function(sender, evt) {
    const edge = evt.getProperty("cell");
    if (!edge) return;

    // Apply current edge style setting to manually created edges
    let edgeStyle;
    if (currentEdgeStyle === 'curved') {
      edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
    } else if (currentEdgeStyle === 'straight') {
      edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;";
    } else if (currentEdgeStyle === 'direct') {
      edgeStyle = "edgeStyle=none;rounded=0;orthogonalLoop=0;jettySize=auto;html=1;";
    } else {
      edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
    }
    graph.getModel().setStyle(edge, edgeStyle);

    const source = graph.getModel().getTerminal(edge, true);
    const target = graph.getModel().getTerminal(edge, false);

    if (source && target) {
        // When connecting an option to a question, the option and its descendants
        // should adopt the question's section only if it's a higher section number.
        if (isOptions(source) && isQuestion(target)) {
            const questionSection = getSection(target);
            const sourceSection = getSection(source);

            // Only update if the question's section is greater.
            // A null section can be treated as 0 for comparison.
            if (questionSection !== null && questionSection > (sourceSection || 0)) {
                setSection(source, questionSection);

                // Also apply to all downstream cells from this source, with the same condition.
                const downstreamCells = getConnectedDescendants(source); // Assuming getConnectedDescendants exists
                downstreamCells.forEach(cell => {
                    const cellSection = getSection(cell);
                    if ((isOptions(cell) || isQuestion(cell)) && (questionSection > (cellSection || 0))) {
                        setSection(cell, questionSection);
                    }
                });
            }
        }
        // When connecting a question to an option (reverse case), the question should
        // adopt the option's section only if it's a higher number.
        else if (isQuestion(source) && isOptions(target)) {
            const optionSection = getSection(target);
            const questionSection = getSection(source);

            if (optionSection !== null && optionSection > (questionSection || 0)) {
                setSection(source, optionSection);
            }
        }
        
        // PDF Property Inheritance: Propagate PDF properties from source to target
        // This ensures PDF properties flow through the entire flowchart chain
        if (source && target) {
            // Check if source has PDF properties
            const sourceHasPdfProperties = source._pdfName || source._pdfFilename || source._pdfUrl || 
                                         (typeof window.isPdfNode === 'function' && window.isPdfNode(source));
            
            if (sourceHasPdfProperties) {
                // Propagate PDF properties to target if it doesn't already have them
                if (!target._pdfName && !target._pdfFilename && !target._pdfUrl && 
                    !(typeof window.isPdfNode === 'function' && window.isPdfNode(target))) {
                    
                    // Copy PDF properties from source to target
                    if (source._pdfName) target._pdfName = source._pdfName;
                    if (source._pdfFilename) target._pdfFilename = source._pdfFilename;
                    if (source._pdfUrl) target._pdfUrl = source._pdfUrl;
                    if (source._priceId) target._priceId = source._priceId;
                    if (source._characterLimit) target._characterLimit = source._characterLimit;
                    
                    console.log(`ðŸ” [PDF INHERITANCE] Propagated PDF properties from ${source.id} to ${target.id}`);
                    
                    // Also propagate to all downstream nodes from the target
                    propagatePdfPropertiesDownstream(target, source);
                }
            }
        }
      }
  
      // Update PDF nodes when connections change (to show/hide character limit field)
      const allCells = graph.getModel().cells;
      for (const cellId in allCells) {
        const cell = allCells[cellId];
        if (cell && isPdfNode(cell)) {
          updatePdfNodeCell(cell);
        }
    }

    // DISABLED: Automatic Node ID regeneration has been completely disabled
    // Node IDs will only change when manually edited or reset using the button
    // This prevents Node IDs from changing when connections change or structure changes
    // Users will set all Node IDs at the end when the structure is complete

    refreshAllCells();
});


  resetBtn.addEventListener("click", () => {
    colorPreferences = { ...defaultColors };
    updateLegendColors();
    refreshAllCells();
    saveUserColorPrefs();
  });

  updateLegendColors();
  // updateSectionLegend is defined in legend.js
  updateSectionLegend();

  // Add event listeners for empty space menu buttons
  document.getElementById('placeQuestionNode').addEventListener('click', function() {
    placeNodeAtClickLocation('question');
    hideContextMenu();
  });
  
  document.getElementById('placeOptionNode').addEventListener('click', function() {
    placeNodeAtClickLocation('options');
    hideContextMenu();
  });
  
    // Calculation node placement now handled by calc.js
    if (typeof window.setupCalculationNodeEventListeners === 'function') {
      window.setupCalculationNodeEventListeners();
    }
  
  const placeNotesNode = document.getElementById('placeNotesNode');
  if (placeNotesNode) {
    placeNotesNode.addEventListener('click', function() {
      placeNodeAtClickLocation('notesNode');
      hideContextMenu();
    });
  }
  
  const placeChecklistNode = document.getElementById('placeChecklistNode');
  if (placeChecklistNode) {
    placeChecklistNode.addEventListener('click', function() {
      placeNodeAtClickLocation('checklistNode');
      hideContextMenu();
    });
  }
  
  const placeSubtitleNode = document.getElementById('placeSubtitleNode');
  if (placeSubtitleNode) {
    placeSubtitleNode.addEventListener('click', function() {
      placeNodeAtClickLocation('subtitle');
      hideContextMenu();
    });
  }
  
  const placeInfoNode = document.getElementById('placeInfoNode');
  if (placeInfoNode) {
    placeInfoNode.addEventListener('click', function() {
      placeNodeAtClickLocation('info');
      hideContextMenu();
    });
  }
  
  const placeImageNode = document.getElementById('placeImageNode');
  if (placeImageNode) {
    placeImageNode.addEventListener('click', function() {
      placeNodeAtClickLocation('imageOption');
      hideContextMenu();
    });
  }
  
  const placePdfNode = document.getElementById('placePdfNode');
  if (placePdfNode) {
    placePdfNode.addEventListener('click', function() {
      placeNodeAtClickLocation('pdfNode');
      hideContextMenu();
    });
  }
  
  const placeAmountNode = document.getElementById('placeAmountNode');
  if (placeAmountNode) {
    placeAmountNode.addEventListener('click', function() {
      placeNodeAtClickLocation('amountOption');
      hideContextMenu();
    });
  }
  
  const placeEndNode = document.getElementById('placeEndNode');
  if (placeEndNode) {
    placeEndNode.addEventListener('click', function() {
      placeNodeAtClickLocation('end');
      hideContextMenu();
    });
  }
  
  // Settings menu event listeners
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', hideSettingsMenu);
  }
  
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }
  
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  if (cancelSettingsBtn) {
    cancelSettingsBtn.addEventListener('click', hideSettingsMenu);
  }
  
  const resetAllNodeIdsBtn = document.getElementById('resetAllNodeIdsBtn');
  if (resetAllNodeIdsBtn) {
    resetAllNodeIdsBtn.addEventListener('click', resetAllNodeIds);
  }
  
  const resetAllPdfBtn = document.getElementById('resetAllPdfBtn');
  if (resetAllPdfBtn) {
    resetAllPdfBtn.addEventListener('click', window.resetAllPdfInheritance);
  }
  
  // Load settings on startup
  function loadSettingsWhenReady() {
    if (typeof window.loadSettingsFromLocalStorage === 'function') {
      try {
        const result = window.loadSettingsFromLocalStorage();
        if (result && typeof result.then === 'function') {
          result.then(() => {
          }).catch(error => {
            console.error('Error loading settings:', error);
          });
        } else {
        }
      } catch (error) {
        console.error('Error calling loadSettingsFromLocalStorage:', error);
      }
    } else {
      // Try again after a short delay if the function isn't available yet
      setTimeout(loadSettingsWhenReady, 100);
    }
  }
  
  loadSettingsWhenReady();
  
  // Load zoom sensitivity from Firebase after page loads
  setTimeout(async () => {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        const user = firebase.auth().currentUser;
        const db = firebase.firestore();
        const doc = await db.collection('userSettings').doc(user.uid).get();
        
        if (doc.exists) {
          const data = doc.data();
          if (data.zoomSensitivity !== undefined) {
            // Update the global settings
            if (window.userSettings) {
              window.userSettings.zoomSensitivity = data.zoomSensitivity;
            }
            
            // Update the UI
            const input = document.getElementById('zoomSensitivityInput');
            const displaySpan = document.getElementById('zoomSensitivityValue');
            
            if (input) {
              input.value = data.zoomSensitivity;
            }
            
            if (displaySpan) {
              displaySpan.textContent = data.zoomSensitivity;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading zoom sensitivity from Firebase:', error);
    }
  }, 1000);
  
  // Initialize search functionality
  initializeSearch();
  
  function placeNodeAtClickLocation(nodeType) {
    if (window.emptySpaceClickX === undefined || window.emptySpaceClickY === undefined) return;
    
    const parent = graph.getDefaultParent();
    graph.getModel().beginUpdate();
    let cell;
    try {
      let style = "";
      let label = "";
      let width = 160;
      let height = 80;
      
      if (nodeType === 'question') {
        // Use default style for question, but do not set a static label or questionType
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;spacing=12;fontSize=16;align=center;verticalAlign=middle;";
        label = ""; // No static label
        width = 280; // Ensure wide enough for dropdown
      } else if (nodeType === 'options') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=dropdown;spacing=12;fontSize=16;align=center;";
        label = "Option Text";
      } else if (nodeType === 'calculation') {
          // Calculation node style and label now handled by calc.js
          if (typeof window.getCalculationNodeStyle === 'function') {
            const calcStyle = window.getCalculationNodeStyle();
            style = calcStyle.style;
            label = calcStyle.label;
          } else {
        style = "shape=roundRect;rounded=1;arcSize=10;whiteSpace=wrap;html=1;nodeType=calculation;spacing=12;fontSize=16;pointerEvents=1;overflow=fill;";
        label = "Calculation node";
          }
          // Set fixed dimensions for calculation nodes
          width = 400;
          height = 450;
      } else if (nodeType === 'notesNode') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=notesNode;spacing=12;fontSize=16;strokeWidth=3;strokeColor=#000000;";
        label = "Notes Node";
      } else if (nodeType === 'checklistNode') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=checklistNode;spacing=12;fontSize=16;strokeWidth=3;strokeColor=#FF0000;strokeDasharray=5,5;";
        label = "Checklist Node";
      } else if (nodeType === 'subtitle') {
        style = "shape=roundRect;rounded=1;arcSize=10;whiteSpace=wrap;html=1;nodeType=subtitle;spacing=12;fontSize=14;fontStyle=italic;";
        label = "Subtitle text";
      } else if (nodeType === 'info') {
        style = "shape=roundRect;rounded=1;arcSize=10;whiteSpace=wrap;html=1;nodeType=info;spacing=12;fontSize=14;";
        label = "Information text";
      } else if (nodeType === 'imageOption') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=imageOption;spacing=12;fontSize=16;";
        label = "Image Option";
          } else if (nodeType === 'pdfNode') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=pdfNode;spacing=6;fontSize=16;";
        label = "PDF Node";
      } else if (nodeType === 'amountOption') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=amountOption;spacing=12;fontSize=16;";
        label = "Amount Option";
      } else if (nodeType === 'end') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=end;fillColor=#CCCCCC;fontColor=#000000;spacing=12;fontSize=16;";
        label = "END";
      }
      
      // Create cell with appropriate width/height based on type
      if (nodeType === 'calculation') {
        width = 300;
        height = 250;
      } else if (nodeType === 'end') {
        width = 120;
        height = 60;
      }
      
      cell = graph.insertVertex(
        parent, 
        null, 
        label, 
        window.emptySpaceClickX, 
        window.emptySpaceClickY, 
        width,
        height,
        style
      );
      
      // Set IDs and section
      if (nodeType === 'question') {
        // Set a temporary ID that will be updated when the user enters text
        setNodeId(cell, 'new_question');
        // Do NOT call setQuestionType or set questionType here; let refreshAllCells show the dropdown
      } else if (nodeType === 'options') {
        setNodeId(cell, 'Option_' + Date.now().toString().slice(-4));
      }
      
      setSection(cell, "1");
      
        // Special handling for calculation nodes - now handled by calc.js
      if (nodeType === 'calculation') {
          if (typeof window.handleCalculationNodePlacement === 'function') {
            window.handleCalculationNodePlacement(cell);
          }
      } else if (nodeType === 'notesNode') {
        cell._notesText = "Notes text";
        updateNotesNodeCell(cell);
      } else if (nodeType === 'checklistNode') {
        cell._checklistText = "Checklist text";
        updateChecklistNodeCell(cell);
      } else if (nodeType === 'subtitle') {
        cell._subtitleText = "Subtitle text";
        updateSubtitleNodeCell(cell);
      } else if (nodeType === 'info') {
        cell._infoText = "Information text";
        updateInfoNodeCell(cell);
      } else if (nodeType === 'imageOption') {
        cell._image = {
          url: "",
          width: "100",
          height: "100"
        };
        updateImageOptionCell(cell);
      } else if (nodeType === 'pdfNode') {
        cell._pdfName = "PDF Document";
        cell._pdfFile = "";
        cell._pdfPrice = "";
        updatePdfNodeCell(cell);
      } else if (nodeType === 'end') {
        updateEndNodeCell(cell);
      }
      
    } finally {
      graph.getModel().endUpdate();
    }
    
    // Apply coloring and show dropdown for question nodes
    refreshAllCells();
    
    // Clear the click location
    window.emptySpaceClickX = undefined;
    window.emptySpaceClickY = undefined;
  }
  
    // Keyboard event listeners moved to events.js module
  
   
  
    // Global keydown event listener moved to events.js module
  

});

/*******************************************************
 ********** RENUMBERING QUESTIONS BY POSITION **********
 *******************************************************/
function renumberQuestionIds() {
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  const questions = vertices.filter(cell => isQuestion(cell));
  
  // Sort questions by vertical position (Y coordinate)
  questions.sort((a, b) => {
    const aY = a.geometry.y;
    const bY = b.geometry.y;
    if (Math.abs(aY - bY) < 10) { // If Y positions are very close, sort by X
      return a.geometry.x - b.geometry.x;
    }
    return aY - bY;
  });

  // Assign sequential IDs based on vertical position
  questions.forEach((cell, index) => {
    cell._questionId = index + 1;
  });
  
  // If properties menu is open for a selected question, update displayed ID
  if (selectedCell && document.getElementById("propertiesMenu").style.display === "block") {
    document.getElementById("propQuestionNumber").textContent = selectedCell._questionId;
  }
}

/*******************************************************
 ********** MULTIPLE TEXTBOXES: RENDERING & EDITS ******
 *******************************************************/
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}
function escapeAttr(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Helper function to render textboxes for multiple textboxes question
function renderTextboxes(cell) {
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
  }
  
  let html = '';
  
  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || "";
    const ph = tb.placeholder || "Enter value";
    const isAmountOption = tb.isAmountOption || false;
    html += 
      `<div class="textbox-entry" style="margin-bottom:8px; text-align:center; display: flex; align-items: center; gap: 4px;">
        <input type="text" value="${escapeAttr(val)}" data-index="${index}" placeholder="${escapeAttr(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updateMultipleTextboxHandler('${cell.id}', ${index}, this.value)" style="flex: 1;"/>
        <button onclick="window.deleteMultipleTextboxHandler('${cell.id}', ${index})">Delete</button>
        <button onclick="window.copyMultipleTextboxId('${cell.id}', ${index})" style="margin-left: 4px; background-color: #4CAF50; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Copy ID</button>
        <label>
          <input type="checkbox" ${isAmountOption ? 'checked' : ''} onclick="window.toggleMultipleTextboxAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });
  
  html += `<div style="text-align:center; margin-top:8px;">
      <button onclick="window.addMultipleTextboxHandler('${cell.id}')">Add Option</button>
      <button onclick="window.showReorderModal('${cell.id}', 'multipleTextboxes')" style="margin-left: 8px; background-color: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Reorder</button>
    </div>`;
  
  return html;
}

  // Multiple textboxes functions moved to questions.js module

/*******************************************************
 ********** multipleDropdownType: RENDER & EDITS *******
 *******************************************************/
function updatemultipleDropdownTypeCell(cell) {
  const qText = cell._questionText || '';
  const twoNums = cell._twoNumbers || { first: '0', second: '0' };
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: '', placeholder: 'Enter value', isAmountOption: false }];
  }
  let html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
    <input class="question-title-input" type="text" value="${escapeAttr(qText)}" placeholder="Enter question text" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeTextHandler('${cell.id}', this.value)" style="margin-bottom:8px; width:90%; text-align:center;" />
    <div class="two-number-container" style="display: flex; justify-content:center; gap: 10px; margin-top: 8px; width:100%;">
      <input type="number" value="${escapeAttr(twoNums.first)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'first', this.value)"/>
      <input type="number" value="${escapeAttr(twoNums.second)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'second', this.value)"/>
    </div>
    <div class="multiple-textboxes-container" style="margin-top: 8px; width:100%;">`;
  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || '';
    const ph = tb.placeholder || 'Enter value';
    const checked = tb.isAmountOption ? 'checked' : '';
    
    // Add location indicator before this option if it's at the location index
    if (index === locationIndex) {
      html += `
        <div class="location-indicator" style="margin: 8px 0; padding: 8px; background-color: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; text-align: center; color: #28a745; font-weight: bold; font-size: 12px;">
          📍 Location Date Inserted
          <input type="text" value="${escapeAttr(cell._locationTitle || '')}" placeholder="Enter location title..." onblur="window.updateMultipleDropdownLocationTitle('${cell.id}', this.value)" style="width: 100%; max-width: 300px; padding: 4px 8px; border: 1px solid #28a745; border-radius: 3px; font-size: 12px; margin-top: 8px; text-align: center; background: white; color: #333; display: block; margin-left: auto; margin-right: auto;"/>
          <button onclick="window.removeMultipleDropdownLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Remove</button>
          <button onclick="window.showDropdownLocationIdsPopup('${cell.id}')" style="margin-left: 8px; background-color: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Copy ID's</button>
        </div>`;
    }
    
    html += `
      <div class="textbox-entry" style="margin-bottom:4px; text-align:center; display: flex; align-items: center; gap: 4px;" data-index="${index}">
        <div class="drag-handle" style="cursor: move; color: #666; font-size: 14px; user-select: none; padding: 2px;" draggable="true" data-cell-id="${cell.id}" ondragstart="window.handleDragStart(event, '${cell.id}', ${index})" ondragend="window.handleDragEnd(event)" onmousedown="event.stopPropagation()">Field:</div>
        <input type="text" value="${escapeAttr(val)}" data-index="${index}" placeholder="${escapeAttr(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeHandler('${cell.id}', ${index}, this.value)" style="flex: 1;"/>
        <button onclick="window.deletemultipleDropdownTypeHandler('${cell.id}', ${index})">Delete</button>
        <button onclick="window.copyMultipleDropdownId('${cell.id}', ${index})" style="margin-left: 4px; background-color: #4CAF50; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Copy ID</button>
        <label>
          <input type="checkbox" ${checked} onclick="window.toggleMultipleDropdownAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });
  
  // Add location indicator at the end if location index is beyond the current options
  if (locationIndex >= cell._textboxes.length) {
    html += `
      <div class="location-indicator" style="margin: 8px 0; padding: 8px; background-color: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; text-align: center; color: #28a745; font-weight: bold; font-size: 12px;">
        📍 Location Date Inserted
        <input type="text" value="${escapeAttr(cell._locationTitle || '')}" placeholder="Enter location title..." onblur="window.updateMultipleDropdownLocationTitle('${cell.id}', this.value)" style="width: 100%; max-width: 300px; padding: 4px 8px; border: 1px solid #28a745; border-radius: 3px; font-size: 12px; margin-top: 8px; text-align: center; background: white; color: #333; display: block; margin-left: auto; margin-right: auto;"/>
        <button onclick="window.removeMultipleDropdownLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Remove</button>
        <button onclick="window.showDropdownLocationIdsPopup('${cell.id}')" style="margin-left: 8px; background-color: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Copy ID's</button>
      </div>`;
  }
  
  html += `<div style="text-align:center; margin-top:8px;">
      <button onclick="window.addmultipleDropdownTypeHandler('${cell.id}')">Add Option</button>
      <button onclick="window.addMultipleDropdownLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Add Location</button>
      <button onclick="window.showReorderModal('${cell.id}', 'multipleDropdownType')" style="margin-left: 8px; background-color: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Reorder</button>
    </div>
    </div>
  </div>`;
  
  // Add drop zone event listeners
  html = html.replace('class="multiple-textboxes-container"', 'class="multiple-textboxes-container" ondragover="window.handleDragOver(event)" ondrop="window.handleDrop(event, \'' + cell.id + '\')"');
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
    let st = cell.style || '';
    if (!st.includes('verticalAlign=middle')) {
      st += 'verticalAlign=middle;';
    }
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
  
  // Force a refresh to ensure the new HTML is rendered
  setTimeout(() => {
    if (graph.getModel().getCell(cell.id)) {
      graph.refresh(cell);
    }
  }, 10);
}

window.updatemultipleDropdownTypeTextHandler = function(cellId, text) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    graph.getModel().beginUpdate();
    try {
      cell._questionText = text.trim() || "Enter question text";
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.updatemultipleDropdownTypeNumber = function(cellId, which, value) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    graph.getModel().beginUpdate();
    try {
      if (!cell._twoNumbers) {
        cell._twoNumbers = { first: "0", second: "0" };
      }
      if (which === "first") {
        cell._twoNumbers.first = value;
      } else {
        cell._twoNumbers.second = value;
      }
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.updatemultipleDropdownTypeHandler = function(cellId, index, value) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes) {
    graph.getModel().beginUpdate();
    try {
      let existingPlaceholder = cell._textboxes[index].placeholder;
      if (!existingPlaceholder || existingPlaceholder === "Enter value") {
        cell._textboxes[index].placeholder = value || "";
      }
      cell._textboxes[index].nameId = value;
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.addmultipleDropdownTypeHandler = function(cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    graph.getModel().beginUpdate();
    try {
      if (!cell._textboxes) cell._textboxes = [];
      
      // If there's a location indicator, add the new option after it
      if (cell._locationIndex !== undefined && cell._locationIndex >= cell._textboxes.length) {
        // Location is at the end, just add normally
        cell._textboxes.push({ nameId: "", placeholder: "Enter value", isAmountOption: false });
      } else {
        // Add the new option
        cell._textboxes.push({ nameId: "", placeholder: "Enter value", isAmountOption: false });
        
        // If there's a location indicator before the end, shift it down
        if (cell._locationIndex !== undefined && cell._locationIndex < cell._textboxes.length - 1) {
          cell._locationIndex++;
        }
      }
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.deletemultipleDropdownTypeHandler = function(cellId, index) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes) {
    graph.getModel().beginUpdate();
    try {
      cell._textboxes.splice(index, 1);
      
      // Adjust location index if needed
      if (cell._locationIndex !== undefined) {
        if (index < cell._locationIndex) {
          // Deleted option was before location indicator, shift location index up
          cell._locationIndex--;
        } else if (index === cell._locationIndex) {
          // Deleted option was at the location indicator position, remove location indicator
          delete cell._locationIndex;
        }
        // If index > locationIndex, no adjustment needed
      }
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.toggleMultipleDropdownAmount = function(cellId, index, checked) {
  console.log('🔧 [AMOUNT DEBUG] toggleMultipleDropdownAmount called');
  console.log('🔧 [AMOUNT DEBUG] cellId:', cellId);
  console.log('🔧 [AMOUNT DEBUG] index:', index);
  console.log('🔧 [AMOUNT DEBUG] checked:', checked);
  
  const cell = graph.getModel().getCell(cellId);
  console.log('🔧 [AMOUNT DEBUG] cell found:', !!cell);
  console.log('🔧 [AMOUNT DEBUG] cell:', cell);
  
  if (cell) {
    const questionType = getQuestionType(cell);
    console.log('🔧 [AMOUNT DEBUG] questionType:', questionType);
    console.log('🔧 [AMOUNT DEBUG] is multipleDropdownType:', questionType === "multipleDropdownType");
    console.log('🔧 [AMOUNT DEBUG] has _textboxes:', !!cell._textboxes);
    console.log('🔧 [AMOUNT DEBUG] _textboxes:', cell._textboxes);
    
    if (cell._textboxes && cell._textboxes[index]) {
      console.log('🔧 [AMOUNT DEBUG] textbox at index', index, ':', cell._textboxes[index]);
      console.log('🔧 [AMOUNT DEBUG] current isAmountOption:', cell._textboxes[index].isAmountOption);
    }
  }
  
  if (cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes) {
    console.log('🔧 [AMOUNT DEBUG] All conditions met, updating data...');
    
    graph.getModel().beginUpdate();
    try {
      const oldValue = cell._textboxes[index].isAmountOption;
      cell._textboxes[index].isAmountOption = checked;
      console.log('🔧 [AMOUNT DEBUG] Updated isAmountOption from', oldValue, 'to', checked);
      console.log('🔧 [AMOUNT DEBUG] Updated _textboxes:', cell._textboxes);
    } finally {
      graph.getModel().endUpdate();
      console.log('🔧 [AMOUNT DEBUG] Graph model update completed');
    }
    
    console.log('🔧 [AMOUNT DEBUG] Calling updatemultipleDropdownTypeCell...');
    updatemultipleDropdownTypeCell(cell);
    console.log('🔧 [AMOUNT DEBUG] updatemultipleDropdownTypeCell completed');
    
    // Trigger autosave to ensure the change is persisted
    console.log('🔧 [AMOUNT DEBUG] Checking for requestAutosave function...');
    console.log('🔧 [AMOUNT DEBUG] requestAutosave available:', typeof window.requestAutosave === 'function');
    if (typeof window.requestAutosave === 'function') {
      console.log('🔧 [AMOUNT DEBUG] Triggering autosave...');
      window.requestAutosave();
      console.log('🔧 [AMOUNT DEBUG] Autosave triggered');
    } else {
      console.log('🔧 [AMOUNT DEBUG] ERROR: requestAutosave function not available!');
    }
  } else {
    console.log('🔧 [AMOUNT DEBUG] ERROR: Conditions not met for update');
    console.log('🔧 [AMOUNT DEBUG] cell exists:', !!cell);
    console.log('🔧 [AMOUNT DEBUG] is multipleDropdownType:', cell ? getQuestionType(cell) === "multipleDropdownType" : false);
    console.log('🔧 [AMOUNT DEBUG] has _textboxes:', cell ? !!cell._textboxes : false);
  }
  
  console.log('🔧 [AMOUNT DEBUG] toggleMultipleDropdownAmount completed');
};

// Toggle amount option for multiple textboxes
window.toggleMultipleTextboxAmount = function(cellId, index, checked) {
  console.log('🔧 [TEXTBOX AMOUNT DEBUG] toggleMultipleTextboxAmount called');
  console.log('🔧 [TEXTBOX AMOUNT DEBUG] cellId:', cellId);
  console.log('🔧 [TEXTBOX AMOUNT DEBUG] index:', index);
  console.log('🔧 [TEXTBOX AMOUNT DEBUG] checked:', checked);
  
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes" && cell._textboxes) {
    console.log('🔧 [TEXTBOX AMOUNT DEBUG] Cell found, updating _textboxes');
    console.log('🔧 [TEXTBOX AMOUNT DEBUG] Current _textboxes:', cell._textboxes);
    
    graph.getModel().beginUpdate();
    try {
      cell._textboxes[index].isAmountOption = checked;
      console.log('🔧 [TEXTBOX AMOUNT DEBUG] Updated _textboxes:', cell._textboxes);
    } finally {
      graph.getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
    
    // Trigger autosave to ensure the change is persisted
    if (typeof window.requestAutosave === 'function') {
      console.log('🔧 [TEXTBOX AMOUNT DEBUG] Triggering autosave');
      window.requestAutosave();
    } else {
      console.log('🔧 [TEXTBOX AMOUNT DEBUG] ERROR: requestAutosave function not found!');
    }
  } else {
    console.log('🔧 [TEXTBOX AMOUNT DEBUG] ERROR: Cell not found or invalid type');
  }
  console.log('🔧 [TEXTBOX AMOUNT DEBUG] toggleMultipleTextboxAmount completed');
};

window.addMultipleDropdownLocationHandler = function(cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    graph.getModel().beginUpdate();
    try {
      // Set the location index to the current number of textboxes (at the end)
      cell._locationIndex = cell._textboxes ? cell._textboxes.length : 0;
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.removeMultipleDropdownLocationHandler = function(cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    graph.getModel().beginUpdate();
    try {
      // Remove the location index
      delete cell._locationIndex;
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.updateMultipleDropdownLocationTitle = function(cellId, title) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    graph.getModel().beginUpdate();
    try {
      cell._locationTitle = title.trim();
    } finally {
      graph.getModel().endUpdate();
    }
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  }
};


function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
  } catch (err) {
    // Silent fail - user can manually copy if needed
  }
  
  document.body.removeChild(textArea);
}

// Drag and Drop functionality for reordering entries
window.handleDragStart = function(event, cellId, index) {
  // Prevent the event from bubbling up to the cell's drag handlers
  event.stopPropagation();
  event.stopImmediatePropagation();
  
  event.dataTransfer.setData('text/plain', JSON.stringify({ cellId, index }));
  event.dataTransfer.effectAllowed = 'move';
  
  // Add visual feedback
  event.target.style.opacity = '0.5';
  event.target.parentElement.style.backgroundColor = '#f0f0f0';
  
  // Store the dragged element for reference
  window.draggedElement = event.target.parentElement;
  
  // Prevent the cell from being dragged
  const cell = graph.getModel().getCell(cellId);
  if (cell) {
    cell.setConnectable(false);
  }
};

window.handleDragEnd = function(event) {
  // Prevent the event from bubbling up
  event.stopPropagation();
  event.stopImmediatePropagation();
  
  // Remove visual feedback
  if (event.target) {
    event.target.style.opacity = '1';
    if (event.target.parentElement) {
      event.target.parentElement.style.backgroundColor = '';
    }
  }
  
  // Re-enable cell dragging
  const cellId = event.target.getAttribute('data-cell-id') || 
                 (event.target.parentElement && event.target.parentElement.getAttribute('data-cell-id'));
  if (cellId) {
    const cell = graph.getModel().getCell(cellId);
    if (cell) {
      cell.setConnectable(true);
    }
  }
  
  // Clear dragged element reference
  window.draggedElement = null;
};

window.handleDragOver = function(event) {
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = 'move';
  
  // Add visual feedback for drop zones
  const dropZone = event.currentTarget;
  const rect = dropZone.getBoundingClientRect();
  const y = event.clientY - rect.top;
  
  // Find the closest entry element
  const entries = dropZone.querySelectorAll('.textbox-entry');
  let closestEntry = null;
  let closestDistance = Infinity;
  
  entries.forEach(entry => {
    const entryRect = entry.getBoundingClientRect();
    const entryY = entryRect.top - rect.top + (entryRect.height / 2);
    const distance = Math.abs(y - entryY);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestEntry = entry;
    }
  });
  
  // Remove previous drop indicators
  dropZone.querySelectorAll('.drop-indicator').forEach(indicator => {
    indicator.remove();
  });
  
  // Add drop indicator
  if (closestEntry && window.draggedElement && closestEntry !== window.draggedElement) {
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.style.cssText = 'height: 2px; background-color: #4CAF50; margin: 2px 0; border-radius: 1px;';
    
    if (y < closestEntry.getBoundingClientRect().top - rect.top + (closestEntry.getBoundingClientRect().height / 2)) {
      closestEntry.parentNode.insertBefore(indicator, closestEntry);
    } else {
      closestEntry.parentNode.insertBefore(indicator, closestEntry.nextSibling);
    }
  }
};

window.handleDrop = function(event, cellId) {
  event.preventDefault();
  event.stopPropagation();
  
  try {
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    const sourceCellId = data.cellId;
    const sourceIndex = data.index;
    
    if (sourceCellId !== cellId) {
      return; // Can only reorder within the same cell
    }
    
    const dropZone = event.currentTarget;
    const rect = dropZone.getBoundingClientRect();
    const y = event.clientY - rect.top;
    
    // Find the target position
    const entries = Array.from(dropZone.querySelectorAll('.textbox-entry'));
    let targetIndex = entries.length; // Default to end
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const entryRect = entry.getBoundingClientRect();
      const entryY = entryRect.top - rect.top + (entryRect.height / 2);
      
      if (y < entryY) {
        targetIndex = i;
        break;
      }
    }
    
    // Adjust target index if dropping after the source
    if (targetIndex > sourceIndex) {
      targetIndex--;
    }
    
    // Reorder the entries
    if (sourceIndex !== targetIndex) {
      reorderMultipleDropdownEntries(sourceCellId, sourceIndex, targetIndex);
    }
    
  } catch (error) {
    console.error('Error handling drop:', error);
  } finally {
    // Clean up visual feedback
    dropZone.querySelectorAll('.drop-indicator').forEach(indicator => {
      indicator.remove();
    });
  }
};

function reorderMultipleDropdownEntries(cellId, sourceIndex, targetIndex) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "multipleDropdownType" || !cell._textboxes) {
    return;
  }
  
  graph.getModel().beginUpdate();
  try {
    // Remove the item from source position
    const [movedItem] = cell._textboxes.splice(sourceIndex, 1);
    
    // Insert it at target position
    cell._textboxes.splice(targetIndex, 0, movedItem);
    
    // Re-render the cell to reflect the new order
    updatemultipleDropdownTypeCell(cell);
    
  } finally {
    graph.getModel().endUpdate();
  }
}

/*******************************************************
 ************ Subtitle and Info Nodes: RENDER & EDITS *********
 *******************************************************/
// isCalculationNode is now in calc.js but referenced here
// function isCalculationNode(cell) is defined in calc.js

function isSubtitleNode(cell) {
  return cell && cell.style && cell.style.includes("nodeType=subtitle");
}

function isInfoNode(cell) {
  return cell && cell.style && cell.style.includes("nodeType=info");
}

function updateSubtitleNodeCell(cell) {
  if (!cell) return;
  cell._subtitleText = cell._subtitleText || "Add subtitle text";
  cell.value = `<span style="font-size: 14px; font-style: italic;">${escapeHtml(cell._subtitleText)}</span>`;
  colorCell(cell);
}

function updateInfoNodeCell(cell) {
  if (!cell) return;
  cell._infoText = cell._infoText || "Add information text";
  cell.value = `<span style="font-size: 14px; color: #555;">${escapeHtml(cell._infoText)}</span>`;
  colorCell(cell);
}

// The calculation node functions have been moved to calc.js

/*******************************************************
 ************  HELPER / STYLING / JSON Exports  ********
 *******************************************************/
function autoUpdateNodeIdBasedOnLabel(cell) {
  // DISABLED: Automatic Node ID regeneration has been completely disabled
  // Node IDs will only change when manually edited or reset using the button
  return;
}
  // isQuestion function moved to questions.js module
function isOptions(cell) {
  return cell && cell.style && (
    cell.style.includes("nodeType=options") ||
    cell.style.includes("questionType=amountOption") ||
    cell.style.includes("questionType=imageOption")
  );
}

function isAmountOption(cell) {
  return cell && cell.style && cell.style.includes("questionType=amountOption");
}

function setNodeId(cell, nodeId) {
  // Debug mode - set to true only when debugging node ID issues
  const DEBUG_NODE_ID = false;
  
  if (DEBUG_NODE_ID) {
    console.log("ðŸ”§ SET NODE ID DEBUG START");
    console.log("Cell:", cell);
    console.log("Setting nodeId to:", nodeId);
    console.log("Original style:", cell.style);
  }
  
  // DISABLED: PDF prefix logic has been completely disabled
  // Node IDs will only be set when manually edited or reset using the button
  // Users will set all Node IDs at the end when the structure is complete
  let finalNodeId = nodeId;
  
  let style = cell.style || "";
  style = style.replace(/nodeId=[^;]+/, "");
  style += `;nodeId=${encodeURIComponent(finalNodeId)};`;
  
  if (DEBUG_NODE_ID) {
    console.log("New style:", style);
    console.log("Calling graph.getModel().setStyle");
  }
  graph.getModel().setStyle(cell, style);
  
  if (DEBUG_NODE_ID) {
    console.log("After setStyle - cell.style:", cell.style);
    console.log("ðŸ”§ SET NODE ID DEBUG END");
  }
}
// Local getNodeId function removed - now using global window.getNodeId function
// which includes PDF name prefixing logic

function refreshNodeIdFromLabel(cell) {
  // DISABLED: Automatic Node ID regeneration has been completely disabled
  // Node IDs will only change when manually edited or reset using the button
  return;
}

function generateUniqueNodeId(baseNodeId, currentCell) {
  // Get all cells in the graph
  const allCells = graph.getModel().cells;
  const existingNodeIds = new Set();
  
  // Collect all existing node IDs except the current cell
  for (let id in allCells) {
    if (id === "0" || id === "1") continue; // Skip root cells
    const cell = allCells[id];
    if (cell && cell !== currentCell) {
      const existingId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || "";
      if (existingId) {
        existingNodeIds.add(existingId);
      }
    }
  }
  
  // If the base ID is unique, use it
  if (!existingNodeIds.has(baseNodeId)) {
    return baseNodeId;
  }
  
  // If not unique, add numbering
  let counter = 1;
  let uniqueId = `${baseNodeId}_${counter}`;
  
  while (existingNodeIds.has(uniqueId)) {
    counter++;
    uniqueId = `${baseNodeId}_${counter}`;
  }
  
  return uniqueId;
}

function refreshOptionNodeId(cell) {
  // DISABLED: Automatic Node ID regeneration has been completely disabled
  // Node IDs will only change when manually edited or reset using the button
  return;
}

// Function to refresh all option node IDs in the graph
function refreshAllOptionNodeIds() {
  console.log("ðŸ”„ REFRESH ALL OPTION NODE IDS DEBUG START");
  if (!graph) {
    console.log("No graph available");
    return;
  }
  
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  console.log("Found vertices:", vertices.length);
  
  let updatedCount = 0;
  vertices.forEach(cell => {
    console.log("Checking cell:", cell);
    console.log("Is options?", isOptions(cell));
    if (isOptions(cell)) {
      console.log("Refreshing option node ID for:", cell);
      // DISABLED: Automatic Node ID regeneration
      // refreshOptionNodeId(cell);
      updatedCount++;
    }
  });
  
  console.log(`Updated ${updatedCount} option node IDs`);
  
  // Refresh the graph to show changes
  if (window.refreshAllCells) {
    console.log("Calling refreshAllCells");
    window.refreshAllCells();
  }
  console.log("ðŸ”„ REFRESH ALL OPTION NODE IDS DEBUG END");
}

function addSkipReassign(cell) {
  if (!cell) return;
  let style = cell.style || "";
  style = style.replace(/skipReassign=[^;]+/, "");
  style += ";skipReassign=true;";
  graph.getModel().setStyle(cell, style);
}
function removeJumpStyling(cell) {
  if (!cell) return;
  let style = cell.style || "";
  style = style.replace(/strokeWidth=\d+;?/, "");
  style = style.replace(/strokeColor=[^;]+;?/, "");
  style = style.replace(/dashed=\d;?/, "");
  style = style.replace(/dashPattern=[^;]+;?/, "");
  graph.getModel().setStyle(cell, style);
}
function addJumpStyling(cell) {
  if (!cell) return;
  let style = cell.style || "";
  style = style.replace(/strokeWidth=\d+;?/, "");
  style = style.replace(/strokeColor=[^;]+;?/, "");
  style = style.replace(/dashed=\d;?/, "");
  style = style.replace(/dashPattern=[^;]+;?/, "");
  style += jumpBorderStyle;
  graph.getModel().setStyle(cell, style);
}

  // getQuestionType function moved to questions.js module

/**
 * Define pickTypeForCell globally
 */
window.pickTypeForCell = function(cellId, val) {
  if (!val) {
    return; // Do nothing if no type selected
  }
  const c = graph.getModel().getCell(cellId);
  if (!c) {
    return;
  }

  graph.getModel().beginUpdate();
  try {
    setQuestionType(c, val);
    // DISABLED: Automatic Node ID generation when changing question type
    // Node IDs will only change when manually edited or reset using the button
    
    if (!c._placeholder) {
      c._placeholder = "";
    }
    // Only handle special cases for multi types
    if (val === "multipleTextboxes") {
      c._questionText = "Enter question text";
      c._textboxes = [{ nameId: "", placeholder: "Enter value" }];
      updateMultipleTextboxesCell(c);
    } else if (val === "multipleDropdownType") {
      c._questionText = "Enter question text";
      c._twoNumbers = { first: "0", second: "0" };
      c._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
      updatemultipleDropdownTypeCell(c);
    }
    // For all other types, setQuestionType handles rendering
  } finally {
    graph.getModel().endUpdate();
  }

  graph.setSelectionCell(c);
  graph.startEditingAtCell(c);
  refreshAllCells();
};

/******************************************************************
 * 1) Universal key-down guard â€“ put this in your global helpers  *
 ******************************************************************/
window.handleTitleInputKeydown = function (evt) {
  // Let the browser handle native shortcuts, but don't let mxGraph see them
  if ((evt.ctrlKey || evt.metaKey) &&
      ['c', 'v', 'x', 'a'].includes(evt.key.toLowerCase())) {
    evt.stopPropagation(); // <-- added line
    return;
  }
  evt.stopPropagation(); // existing line for all other keys
  if (evt.key === 'Enter') {
    evt.preventDefault();
    evt.target.blur();
  }
};

/******************************************************************
 * 2) renderTextboxes() â€“ used by multiple-textboxes questions     *
 *    (full replacement)                                          *
 ******************************************************************/
function renderTextboxes(cell) {
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
  }

  let html = "";
  const locationIndex = cell._locationIndex !== undefined ? cell._locationIndex : -1;

  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || "";
    const ph  = tb.placeholder || "Enter value";
    const isAmountOption = tb.isAmountOption || false;

    // Add location indicator before this option if it's at the location index
    if (index === locationIndex) {
      html += `
        <div class="location-indicator" style="margin: 8px 0; padding: 8px; background-color: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; text-align: center; color: #28a745; font-weight: bold; font-size: 12px;">
          📍 Location Date Inserted
          <button onclick="window.removeMultipleTextboxLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Remove</button>
          <button onclick="window.showLocationIdsPopup('${cell.id}')" style="margin-left: 8px; background-color: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Copy ID's</button>
        </div>`;
    }

    html += `
      <div class="textbox-entry" style="margin-bottom:8px;text-align:center; display: flex; align-items: center; gap: 4px;">
        <input type="text" value="${escapeAttr(val)}" data-index="${index}" placeholder="${escapeAttr(ph)}"onkeydown="window.handleTitleInputKeydown(event)"onblur="window.updateMultipleTextboxHandler('${cell.id}', ${index}, this.value)" style="flex: 1;" />
        <button onclick="window.deleteMultipleTextboxHandler('${cell.id}', ${index})">Delete</button>
        <button onclick="window.copyMultipleTextboxId('${cell.id}', ${index})" style="margin-left: 4px; background-color: #4CAF50; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Copy ID</button>
        <label>
          <input type="checkbox" ${isAmountOption ? 'checked' : ''} onclick="window.toggleMultipleTextboxAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });

  // Add location indicator at the end if location index is beyond the current options
  if (locationIndex >= cell._textboxes.length) {
    html += `
      <div class="location-indicator" style="margin: 8px 0; padding: 8px; background-color: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; text-align: center; color: #28a745; font-weight: bold; font-size: 12px;">
        📍 Location Date Inserted
        <button onclick="window.removeMultipleTextboxLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Remove</button>
        <button onclick="window.showLocationIdsPopup('${cell.id}')" style="margin-left: 8px; background-color: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Copy ID's</button>
      </div>`;
  }

  html += `
    <div style="text-align:center;margin-top:8px;">
      <button onclick="window.addMultipleTextboxHandler('${cell.id}')">Add Option</button>
      <button onclick="window.addMultipleTextboxLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Add Location</button>
      <button onclick="window.showReorderModal('${cell.id}', 'multipleTextboxes')" style="margin-left: 8px; background-color: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Reorder</button>
    </div>`;

  return html;
}

// Location IDs Popup Functions
window.showLocationIdsPopup = function(cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  
  // Get the question text and convert it to a valid prefix
  const questionText = cell._questionText || 'enter_info';
  const sanitizedQuestion = questionText.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .trim();
  
  // Check if this question has a PDF property
  const pdfName = window.findPdfNameForQuestion ? window.findPdfNameForQuestion(cell) : null;
  const sanitizedPdfName = pdfName && window.sanitizePdfName ? window.sanitizePdfName(pdfName) : '';
  
  // Build the prefix with PDF name if available
  let prefix;
  if (sanitizedPdfName) {
    prefix = `${sanitizedPdfName}_${sanitizedQuestion}`;
  } else {
    prefix = sanitizedQuestion;
  }
  
  // Generate dynamic entries based on the prefix
  const locationIds = [
    `${prefix}_street`,
    `${prefix}_city`,
    `${prefix}_state`,
    `${prefix}_state_short`,
    `${prefix}_zip`
  ];
  
  // Update the popup content
  const popup = document.getElementById('locationIdsPopup');
  if (popup) {
    // Add a class to identify this popup
    popup.classList.add('popup');
    const content = popup.querySelector('.location-ids-content');
    if (content) {
      content.innerHTML = '';
      
      // Add search bar
      const searchBar = document.createElement('input');
      searchBar.type = 'text';
      searchBar.placeholder = 'Search location IDs...';
      searchBar.className = 'location-id-search';
      searchBar.style.cssText = `
        width: calc(100% - 20px);
        padding: 8px 10px;
        margin-bottom: 12px;
        border: 2px solid #ccc;
        border-radius: 6px;
        font-size: 14px;
        outline: none;
      `;
      content.appendChild(searchBar);
      
      // Create container for location items
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'location-items-container';
      
      locationIds.forEach(locationId => {
        const item = document.createElement('div');
        item.className = 'location-id-item';
        item.setAttribute('data-id', locationId);
        item.innerHTML = `
          <span class="location-id-text">${locationId}</span>
          <br><br>
          <button class="copy-btn" onclick="copyLocationId('${locationId}')">Copy</button>
        `;
        itemsContainer.appendChild(item);
      });
      
      content.appendChild(itemsContainer);
      
      // Add search functionality
      searchBar.addEventListener('input', function() {
        const searchText = this.value.toLowerCase();
        const items = itemsContainer.querySelectorAll('.location-id-item');
        
        items.forEach(item => {
          const locationId = item.getAttribute('data-id');
          
          // Normalize both the search text and the location ID for comparison
          // Replace underscores with spaces in location ID for matching
          const normalizedLocationId = locationId.toLowerCase().replace(/_/g, ' ');
          const normalizedSearchText = searchText.replace(/_/g, ' ');
          
          // Check if either version matches
          const matchesWithSpaces = normalizedLocationId.includes(normalizedSearchText);
          const matchesWithUnderscores = locationId.toLowerCase().includes(searchText);
          
          if (matchesWithSpaces || matchesWithUnderscores) {
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
        });
      });
    }
    
    popup.style.display = 'block';
    console.log('🔍 [LOCATION DEBUG] Popup display set to block, current style:', popup.style.display);
    
    // Make popup draggable
    makePopupDraggable(popup);
    
    // Add click outside to close functionality
    const handleClickOutside = (event) => {
      // Check if the click is outside the popup and not on any other popup/modal
      if (!popup.contains(event.target) && 
          !event.target.closest('.context-menu') &&
          !event.target.closest('.modal') &&
          !event.target.closest('.popup')) {
        popup.style.display = 'none';
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
    
    // Add both click and mousedown listeners for better coverage
    // Add the event listeners after a short delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
  }
};

window.copyLocationId = function(locationId) {
  // Copy the location ID to clipboard
  navigator.clipboard.writeText(locationId).then(() => {
    // Remove any existing copied indicators
    const allItems = document.querySelectorAll('.location-id-item');
    allItems.forEach(item => {
      item.classList.remove('copied');
      const btn = item.querySelector('.copy-btn');
      if (btn) {
        btn.classList.remove('copied');
        btn.textContent = 'Copy';
      }
    });
    
    // Add copied indicator to the clicked item
    const clickedItem = document.querySelector(`[data-id="${locationId}"]`);
    if (clickedItem) {
      clickedItem.classList.add('copied');
      const btn = clickedItem.querySelector('.copy-btn');
      if (btn) {
        btn.classList.add('copied');
        btn.textContent = 'Copied!';
      }
    }
    
    // Remove the copied indicator after 2 seconds
    setTimeout(() => {
      if (clickedItem) {
        clickedItem.classList.remove('copied');
        const btn = clickedItem.querySelector('.copy-btn');
        if (btn) {
          btn.classList.remove('copied');
          btn.textContent = 'Copy';
        }
      }
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy location ID:', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = locationId;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  });
};

// Close popup function
window.closeLocationIdsPopup = function() {
  const popup = document.getElementById('locationIdsPopup');
  if (popup) {
    popup.style.display = 'none';
  }
};

// Function to make popup draggable
function makePopupDraggable(popup) {
  let isDragging = false;
  let startX;
  let startY;
  let initialX;
  let initialY;

  const header = popup.querySelector('.location-ids-header');
  if (!header) return;

  // Remove the initial centering transform and set absolute positioning
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';

  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    if (e.target.classList.contains('close-btn')) return; // Don't drag when clicking close button
    
    isDragging = true;
    header.style.cursor = 'grabbing';
    
    // Get the current position of the popup
    const rect = popup.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    // Get the mouse position relative to the popup
    startX = e.clientX - initialX;
    startY = e.clientY - initialY;
    
    // Remove the centering transform and set absolute positioning
    popup.style.top = initialY + 'px';
    popup.style.left = initialX + 'px';
    popup.style.transform = 'none';
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      
      popup.style.left = newX + 'px';
      popup.style.top = newY + 'px';
    }
  }

  function dragEnd(e) {
    isDragging = false;
    header.style.cursor = 'move';
  }
}

// Dropdown Location IDs Popup Functions
window.showDropdownLocationIdsPopup = function(cellId) {
  const graph = getGraph();
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  
  const twoNums = cell._twoNumbers || { first: '0', second: '0' };
  const firstNum = parseInt(twoNums.first) || 1;
  const secondNum = parseInt(twoNums.second) || 1;
  
  // Get the question text and convert it to a valid prefix
  const questionText = cell._questionText || 'how_many';
  const sanitizedQuestion = questionText.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .trim();
  
  // Check if this question has a PDF property
  const pdfName = window.findPdfNameForQuestion ? window.findPdfNameForQuestion(cell) : null;
  const sanitizedPdfName = pdfName && window.sanitizePdfName ? window.sanitizePdfName(pdfName) : '';
  
  // Get location title and sanitize it
  const locationTitle = cell._locationTitle || '';
  const sanitizedLocationTitle = locationTitle.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .trim();
  
  // Build the prefix with PDF name if available
  let prefix;
  if (sanitizedPdfName) {
    prefix = `${sanitizedPdfName}_${sanitizedQuestion}`;
  } else {
    prefix = sanitizedQuestion;
  }
  
  // Add location title to prefix if available
  if (sanitizedLocationTitle) {
    prefix = `${prefix}_${sanitizedLocationTitle}`;
  }
  
  // Generate dynamic entries based on range
  const locationIds = [];
  const locationFields = ['street', 'city', 'state', 'state_short', 'zip', 'address'];
  
  for (let i = firstNum; i <= secondNum; i++) {
    locationFields.forEach(field => {
      locationIds.push(`${prefix}_${field}_${i}`);
    });
  }
  
  // Update the popup content
  const popup = document.getElementById('locationIdsPopup');
  console.log('🔍 [LOCATION DEBUG] Popup element found:', !!popup);
  if (popup) {
    console.log('🔍 [LOCATION DEBUG] Popup element details:', popup);
    // Add a class to identify this popup
    popup.classList.add('popup');
    const content = popup.querySelector('.location-ids-content');
    console.log('🔍 [LOCATION DEBUG] Content element found:', !!content);
    if (content) {
      content.innerHTML = '';
      
      // Add search bar
      const searchBar = document.createElement('input');
      searchBar.type = 'text';
      searchBar.placeholder = 'Search location IDs...';
      searchBar.className = 'location-id-search';
      searchBar.style.cssText = `
        width: calc(100% - 20px);
        padding: 8px 10px;
        margin-bottom: 12px;
        border: 2px solid #ccc;
        border-radius: 6px;
        font-size: 14px;
        outline: none;
      `;
      content.appendChild(searchBar);
      
      // Create container for location items
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'location-items-container';
      
      locationIds.forEach(locationId => {
        const item = document.createElement('div');
        item.className = 'location-id-item';
        item.setAttribute('data-id', locationId);
        item.innerHTML = `
          <span class="location-id-text">${locationId}</span>
          <br><br>
          <button class="copy-btn" onclick="copyLocationId('${locationId}')">Copy</button>
        `;
        itemsContainer.appendChild(item);
      });
      
      content.appendChild(itemsContainer);
      
      // Add search functionality
      searchBar.addEventListener('input', function() {
        const searchText = this.value.toLowerCase();
        const items = itemsContainer.querySelectorAll('.location-id-item');
        
        items.forEach(item => {
          const locationId = item.getAttribute('data-id');
          
          // Normalize both the search text and the location ID for comparison
          // Replace underscores with spaces in location ID for matching
          const normalizedLocationId = locationId.toLowerCase().replace(/_/g, ' ');
          const normalizedSearchText = searchText.replace(/_/g, ' ');
          
          // Check if either version matches
          const matchesWithSpaces = normalizedLocationId.includes(normalizedSearchText);
          const matchesWithUnderscores = locationId.toLowerCase().includes(searchText);
          
          if (matchesWithSpaces || matchesWithUnderscores) {
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
        });
      });
    }
    
    popup.style.display = 'block';
    console.log('🔍 [LOCATION DEBUG] Popup display set to block, current style:', popup.style.display);
    
    // Make popup draggable
    makePopupDraggable(popup);
    
    // Add click outside to close functionality
    const handleClickOutside = (event) => {
      // Check if the click is outside the popup and not on any other popup/modal
      if (!popup.contains(event.target) && 
          !event.target.closest('.context-menu') &&
          !event.target.closest('.modal') &&
          !event.target.closest('.popup')) {
        popup.style.display = 'none';
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
    
    // Add both click and mousedown listeners for better coverage
    // Add the event listeners after a short delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
  }
};

// Show popup for trigger sequence location IDs
window.showTriggerSequenceLocationIdsPopup = function(cellId, dropdownName, triggerOption, locationTitle) {
  const graph = getGraph();
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  
  const twoNums = cell._twoNumbers || { first: '0', second: '0' };
  const firstNum = parseInt(twoNums.first) || 1;
  const secondNum = parseInt(twoNums.second) || 1;
  
  // Get the question text and convert it to a valid prefix
  const questionText = cell._questionText || 'how_many';
  const sanitizedQuestion = questionText.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .trim();
  
  // Sanitize dropdown name
  const sanitizedDropdownName = (dropdownName || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
  
  // Sanitize trigger option
  const sanitizedTriggerOption = (triggerOption || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
  
  // Sanitize location title
  const sanitizedLocationTitle = (locationTitle || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
  
  // Check if this question has a PDF property
  const pdfName = window.findPdfNameForQuestion ? window.findPdfNameForQuestion(cell) : null;
  const sanitizedPdfName = pdfName && window.sanitizePdfName ? window.sanitizePdfName(pdfName) : '';
  
  // Build the prefix with PDF name if available
  let prefix;
  if (sanitizedPdfName) {
    prefix = `${sanitizedPdfName}_${sanitizedQuestion}`;
  } else {
    prefix = sanitizedQuestion;
  }
  
  // Add dropdown name, trigger option, and location title to prefix
  if (sanitizedDropdownName) {
    prefix = `${prefix}_${sanitizedDropdownName}`;
  }
  if (sanitizedTriggerOption) {
    prefix = `${prefix}_${sanitizedTriggerOption}`;
  }
  if (sanitizedLocationTitle) {
    prefix = `${prefix}_${sanitizedLocationTitle}`;
  }
  
  // Generate dynamic entries based on range
  const locationIds = [];
  const locationFields = ['street', 'city', 'state', 'state_short', 'zip', 'address'];
  
  for (let i = firstNum; i <= secondNum; i++) {
    locationFields.forEach(field => {
      locationIds.push(`${prefix}_${field}_${i}`);
    });
  }
  
  // Update the popup content (reuse the same popup element)
  const popup = document.getElementById('locationIdsPopup');
  if (popup) {
    popup.classList.add('popup');
    const content = popup.querySelector('.location-ids-content');
    if (content) {
      content.innerHTML = '';
      
      // Add search bar
      const searchBar = document.createElement('input');
      searchBar.type = 'text';
      searchBar.placeholder = 'Search location IDs...';
      searchBar.className = 'location-id-search';
      searchBar.style.cssText = `
        width: calc(100% - 20px);
        padding: 8px 10px;
        margin-bottom: 12px;
        border: 2px solid #ccc;
        border-radius: 6px;
        font-size: 14px;
        outline: none;
      `;
      content.appendChild(searchBar);
      
      // Create container for location items
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'location-items-container';
      
      locationIds.forEach(locationId => {
        const item = document.createElement('div');
        item.className = 'location-id-item';
        item.setAttribute('data-id', locationId);
        item.innerHTML = `
          <span class="location-id-text">${locationId}</span>
          <br><br>
          <button class="copy-btn" onclick="copyLocationId('${locationId}')">Copy</button>
        `;
        itemsContainer.appendChild(item);
      });
      
      content.appendChild(itemsContainer);
      
      // Add search functionality
      searchBar.addEventListener('input', function() {
        const searchText = this.value.toLowerCase();
        const items = itemsContainer.querySelectorAll('.location-id-item');
        
        items.forEach(item => {
          const locationId = item.getAttribute('data-id');
          
          // Normalize both the search text and the location ID for comparison
          const normalizedLocationId = locationId.toLowerCase().replace(/_/g, ' ');
          const normalizedSearchText = searchText.replace(/_/g, ' ');
          
          const matchesWithSpaces = normalizedLocationId.includes(normalizedSearchText);
          const matchesWithUnderscores = locationId.toLowerCase().includes(searchText);
          
          if (matchesWithSpaces || matchesWithUnderscores) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });
    }
    
    popup.style.display = 'block';
    
    // Make popup draggable
    makePopupDraggable(popup);
    
    // Add click outside to close functionality
    const handleClickOutside = (event) => {
      if (!popup.contains(event.target) && 
          !event.target.closest('.context-menu') &&
          !event.target.closest('.modal') &&
          !event.target.closest('.popup')) {
        popup.style.display = 'none';
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
  }
};

// Copy ID function for multiple textboxes
window.copyMultipleTextboxId = function(cellId, index) {
  const cell = getGraph().getModel().getCell(cellId);
  if (!cell || !cell._textboxes || !cell._textboxes[index]) return;
  
  const questionText = cell._questionText || '';
  const entryText = cell._textboxes[index].nameId || '';
  
  // Check if this question has a PDF property (only for nodes that should have PDF properties)
  const pdfName = window.findPdfNameForQuestion ? window.findPdfNameForQuestion(cell) : null;
  const sanitizedPdfName = pdfName && window.sanitizePdfName ? window.sanitizePdfName(pdfName) : '';
  
  // Sanitize the text: convert to lowercase, replace non-alphanumeric with underscores
  const sanitizedQuestion = questionText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const sanitizedEntry = entryText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  
  // Build the final ID with PDF name if available
  let idToCopy;
  if (sanitizedPdfName) {
    idToCopy = `${sanitizedPdfName}_${sanitizedQuestion}_${sanitizedEntry}`;
  } else {
    idToCopy = `${sanitizedQuestion}_${sanitizedEntry}`;
  }
  
  // Copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(idToCopy).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = idToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    });
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = idToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
};

// Reorder Modal Functions
window.showReorderModal = function(cellId, questionType) {
  const cell = getGraph().getModel().getCell(cellId);
  if (!cell) return;
  
  let entries = [];
  let questionText = '';
  
  if (questionType === 'multipleTextboxes') {
    entries = cell._textboxes || [];
    questionText = cell._questionText || 'Multiple Textboxes';
  } else if (questionType === 'multipleDropdownType') {
    entries = cell._textboxes || [];
    questionText = cell._questionText || 'Multiple Dropdown';
  }
  
  if (entries.length === 0) {
    alert('No entries to reorder');
    return;
  }
  
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'reorderModalOverlay';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, sans-serif;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    padding: 24px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e0e0e0;
  `;
  
  const title = document.createElement('h3');
  title.textContent = `Reorder: ${questionText}`;
  title.style.cssText = `
    margin: 0;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = 'Ã—';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    color: #666;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  `;
  closeBtn.onmouseover = () => closeBtn.style.backgroundColor = '#f0f0f0';
  closeBtn.onmouseout = () => closeBtn.style.backgroundColor = 'transparent';
  closeBtn.onclick = () => modalOverlay.remove();
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Create instructions
  const instructions = document.createElement('div');
  instructions.textContent = 'Drag and drop the items below to reorder them:';
  instructions.style.cssText = `
    color: #666;
    margin-bottom: 16px;
    font-size: 14px;
  `;
  
  // Create sortable list
  const sortableList = document.createElement('div');
  sortableList.id = 'reorderSortableList';
  sortableList.style.cssText = `
    margin-bottom: 20px;
  `;
  
  // Create list items
  entries.forEach((entry, index) => {
    const listItem = document.createElement('div');
    listItem.className = 'reorder-item';
    listItem.draggable = true;
    listItem.dataset.index = index;
    listItem.style.cssText = `
      background: #f8f9fa;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 8px;
      cursor: move;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.2s ease;
      user-select: none;
    `;
    
    // Add hover effects
    listItem.onmouseover = () => {
      listItem.style.backgroundColor = '#e3f2fd';
      listItem.style.borderColor = '#2196f3';
      listItem.style.transform = 'translateY(-1px)';
      listItem.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.2)';
    };
    listItem.onmouseout = () => {
      listItem.style.backgroundColor = '#f8f9fa';
      listItem.style.borderColor = '#e9ecef';
      listItem.style.transform = 'translateY(0)';
      listItem.style.boxShadow = 'none';
    };
    
    // Create content
    const content = document.createElement('div');
    content.style.cssText = `
      display: flex;
      align-items: center;
      flex: 1;
    `;
    
    const dragHandle = document.createElement('div');
    dragHandle.innerHTML = 'Field:';
    dragHandle.style.cssText = `
      color: #999;
      font-size: 16px;
      margin-right: 12px;
      cursor: move;
    `;
    
    const entryText = document.createElement('span');
    entryText.textContent = entry.nameId || `Entry ${index + 1}`;
    entryText.style.cssText = `
      font-weight: 500;
      color: #333;
    `;
    
    const placeholder = document.createElement('span');
    if (entry.placeholder) {
      placeholder.textContent = ` (${entry.placeholder})`;
      placeholder.style.cssText = `
        color: #666;
        font-size: 14px;
        margin-left: 8px;
      `;
    }
    
    content.appendChild(dragHandle);
    content.appendChild(entryText);
    content.appendChild(placeholder);
    
    // Create position indicator
    const position = document.createElement('div');
    position.textContent = `#${index + 1}`;
    position.style.cssText = `
      background: #007bff;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    `;
    
    listItem.appendChild(content);
    listItem.appendChild(position);
    
    // Add drag event listeners
    listItem.ondragstart = (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', listItem.outerHTML);
      listItem.style.opacity = '0.5';
    };
    
    listItem.ondragend = (e) => {
      listItem.style.opacity = '1';
    };
    
    listItem.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };
    
    listItem.ondrop = (e) => {
      e.preventDefault();
      const draggedIndex = parseInt(e.dataTransfer.getData('text/plain') || e.target.dataset.index);
      const targetIndex = parseInt(listItem.dataset.index);
      
      if (draggedIndex !== targetIndex) {
        reorderEntries(cellId, questionType, draggedIndex, targetIndex);
        modalOverlay.remove();
        showReorderModal(cellId, questionType); // Refresh modal
      }
    };
    
    sortableList.appendChild(listItem);
  });
  
  // Create buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
  `;
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    background: #6c757d;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  `;
  cancelBtn.onmouseover = () => cancelBtn.style.backgroundColor = '#5a6268';
  cancelBtn.onmouseout = () => cancelBtn.style.backgroundColor = '#6c757d';
  cancelBtn.onclick = () => modalOverlay.remove();
  
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Order';
  saveBtn.style.cssText = `
    background: #28a745;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  `;
  saveBtn.onmouseover = () => saveBtn.style.backgroundColor = '#218838';
  saveBtn.onmouseout = () => saveBtn.style.backgroundColor = '#28a745';
  saveBtn.onclick = () => {
    // Save the current order
    saveReorderChanges(cellId, questionType);
    modalOverlay.remove();
  };
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(saveBtn);
  
  // Assemble modal
  modalContent.appendChild(header);
  modalContent.appendChild(instructions);
  modalContent.appendChild(sortableList);
  modalContent.appendChild(buttonContainer);
  modalOverlay.appendChild(modalContent);
  
  // Add to document
  document.body.appendChild(modalOverlay);
  
  // Close on overlay click
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.remove();
    }
  };
  
  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      modalOverlay.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
};

// Helper function to reorder entries
function reorderEntries(cellId, questionType, fromIndex, toIndex) {
  const cell = getGraph().getModel().getCell(cellId);
  if (!cell || !cell._textboxes) return;
  
  const entries = cell._textboxes;
  const item = entries.splice(fromIndex, 1)[0];
  entries.splice(toIndex, 0, item);
  
  // Update the cell
  getGraph().getModel().beginUpdate();
  try {
    cell._textboxes = entries;
    getRefreshAllCells()();
    getRequestAutosave()();
  } finally {
    getGraph().getModel().endUpdate();
  }
}

// Helper function to save reorder changes
function saveReorderChanges(cellId, questionType) {
  // The reordering is already applied in real-time, so this just refreshes the display
  getRefreshAllCells()();
  getRequestAutosave()();
}

/******************************************************************
 * 3) updatemultipleDropdownTypeCell() â€“ full replacement          *
 ******************************************************************/
function updatemultipleDropdownTypeCell(cell) {
  const qText   = cell._questionText || "";
  const twoNums = cell._twoNumbers   || { first: "0", second: "0" };

  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
  }

  let html = `
    <div class="multiple-textboxes-node"
         style="display:flex;flex-direction:column;align-items:center;">
      <input class="question-title-input"
             type="text"
             value="${escapeAttr(qText)}"
             placeholder="Enter question text"
             onkeydown="window.handleTitleInputKeydown(event)"
             onblur="window.updatemultipleDropdownTypeTextHandler('${cell.id}', this.value)"
             style="margin-bottom:8px;width:90%;text-align:center;" />

      <div class="two-number-container"
           style="display:flex;justify-content:center;gap:10px;margin-top:8px;width:100%;">
        <input type="number"
               value="${escapeAttr(twoNums.first)}"
               onkeydown="window.handleTitleInputKeydown(event)"
               onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'first', this.value)" />
        <input type="number"
               value="${escapeAttr(twoNums.second)}"
               onkeydown="window.handleTitleInputKeydown(event)"
               onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'second', this.value)" />
      </div>

      <div class="multiple-textboxes-container" style="margin-top:8px;width:100%;">`;

  // Check if there's a location indicator position
  const locationIndex = cell._locationIndex !== undefined ? cell._locationIndex : -1;
  
  cell._textboxes.forEach((tb, index) => {
    const val      = tb.nameId      || "";
    const ph       = tb.placeholder || "Enter value";
    const checked  = tb.isAmountOption ? "checked" : "";

    // Add location indicator before this option if it's at the location index
    if (index === locationIndex) {
      html += `
        <div class="location-indicator" style="margin: 8px 0; padding: 8px; background-color: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; text-align: center; color: #28a745; font-weight: bold; font-size: 12px;">
          📍 Location Date Inserted
          <input type="text" value="${escapeAttr(cell._locationTitle || '')}" placeholder="Enter location title..." onblur="window.updateMultipleDropdownLocationTitle('${cell.id}', this.value)" style="width: 100%; max-width: 300px; padding: 4px 8px; border: 1px solid #28a745; border-radius: 3px; font-size: 12px; margin-top: 8px; text-align: center; background: white; color: #333; display: block; margin-left: auto; margin-right: auto;"/>
          <button onclick="window.removeMultipleDropdownLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Remove</button>
          <button onclick="window.showDropdownLocationIdsPopup('${cell.id}')" style="margin-left: 8px; background-color: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Copy ID's</button>
        </div>`;
    }

    html += `
      <div class="textbox-entry" style="margin-bottom:4px;text-align:center;">
        <input type="text"value="${escapeAttr(val)}"data-index="${index}"placeholder="${escapeAttr(ph)}"onkeydown="window.handleTitleInputKeydown(event)"onblur="window.updatemultipleDropdownTypeHandler('${cell.id}', ${index}, this.value)" />
        <button onclick="window.deletemultipleDropdownTypeHandler('${cell.id}', ${index})">Delete</button>
        <label>
          <input type="checkbox" ${checked}
                 onclick="window.toggleMultipleDropdownAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });
  
  // Add location indicator at the end if location index is beyond the current options
  if (locationIndex >= cell._textboxes.length) {
    html += `
      <div class="location-indicator" style="margin: 8px 0; padding: 8px; background-color: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; text-align: center; color: #28a745; font-weight: bold; font-size: 12px;">
        📍 Location Date Inserted
        <input type="text" value="${escapeAttr(cell._locationTitle || '')}" placeholder="Enter location title..." onblur="window.updateMultipleDropdownLocationTitle('${cell.id}', this.value)" style="width: 100%; max-width: 300px; padding: 4px 8px; border: 1px solid #28a745; border-radius: 3px; font-size: 12px; margin-top: 8px; text-align: center; background: white; color: #333; display: block; margin-left: auto; margin-right: auto;"/>
        <button onclick="window.removeMultipleDropdownLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Remove</button>
        <button onclick="window.showDropdownLocationIdsPopup('${cell.id}')" style="margin-left: 8px; background-color: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Copy ID's</button>
      </div>`;
  }

  html += `
        <div style="text-align:center;margin-top:8px;">
          <button onclick="window.addmultipleDropdownTypeHandler('${cell.id}')">Add Option</button>
          <button onclick="window.addMultipleDropdownLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Add Location</button>
          <button onclick="window.showReorderModal('${cell.id}', 'multipleDropdownType')" style="margin-left: 8px; background-color: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Reorder</button>
        </div>
      </div>
    </div>`;

  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);

    // make sure the style keeps pointer events enabled
    let st = cell.style || "";
    if (!/pointerEvents=/.test(st)) {
      st += "pointerEvents=1;overflow=fill;";
    }
    if (!/verticalAlign=middle/.test(st)) {
      st += "verticalAlign=middle;";
    }
    graph.getModel().setStyle(cell, st);
  } finally {
    graph.getModel().endUpdate();
  }

  graph.updateCellSize(cell);
}

/**************************************************
 *                setQuestionType                 *
 *  â€“ now stores plain text for the simple types  *
 **************************************************/
/**************************************************
 *                setQuestionType                 *
 **************************************************/
/* ----------  REPLACE ENTIRE FUNCTION  ---------- */
  // setQuestionType function moved to questions.js module
  
  // extractTextFromCell function moved to questions.js module

// Function to set option type for option nodes
function setOptionType(cell, newType) {
  if (!cell || !isOptions(cell)) return;
    
    // Extract and preserve the current text content
    const preservedText = extractTextFromCell(cell);
  
  /* â€”â€” 1. update style â€”â€” */
  let st = (cell.style || '').replace(/questionType=[^;]+/, '');
  st += `;questionType=${newType};align=center;verticalAlign=middle;spacing=12;`;
  
  graph.getModel().setStyle(cell, st);

  /* â€”â€” 2. update internals â€”â€” */
  graph.getModel().beginUpdate();
  try {
    switch (newType) {
      case 'dropdown':
          // Regular option - preserve text content
          if (preservedText) {
            cell.value = `<div style="text-align:center;">${mxUtils.htmlEntities(preservedText)}</div>`;
          }
        updateOptionNodeCell(cell);
        break;
      case 'imageOption':
        // Image option - needs image URL and alt text
        if (!cell._imageUrl) {
          cell._imageUrl = '';
            cell._imageAltText = preservedText || 'Image description';
        }
        updateImageOptionCell(cell);
        break;
      case 'amountOption':
        // Amount option - needs amount name and placeholder
        if (!cell._amountName) {
            cell._amountName = preservedText || 'Amount';
          cell._amountPlaceholder = 'Enter amount';
        }
        // updateAmountOptionCell is handled in the existing code
        break;
      case 'notesNode':
          // Notes node - preserve text content
          cell._notesText = preservedText || 'Notes text';
        // Add bold border style
        st = (cell.style || '').replace(/strokeWidth=[^;]+/, '');
        st = st.replace(/strokeColor=[^;]+/, '');
        st += ';strokeWidth=3;strokeColor=#000000;';
        graph.getModel().setStyle(cell, st);
        updateNotesNodeCell(cell);
        break;
      case 'checklistNode':
          // Checklist node - preserve text content
          cell._checklistText = preservedText || 'Checklist text';
        // Add striped red border style
        st = (cell.style || '').replace(/strokeWidth=[^;]+/, '');
        st = (cell.style || '').replace(/strokeColor=[^;]+/, '');
        st = (cell.style || '').replace(/strokeDasharray=[^;]+/, '');
        st += ';strokeWidth=3;strokeColor=#FF0000;strokeDasharray=5,5;';
        graph.getModel().setStyle(cell, st);
        updateChecklistNodeCell(cell);
        break;
      case 'alertNode':
          // Alert node - preserve text content
          cell._alertText = preservedText || 'Alert message';
          cell._questionText = preservedText || 'Alert message';
        // Add bold black and red checkered border style
        st = (cell.style || '').replace(/strokeWidth=[^;]+/, '');
        st = (cell.style || '').replace(/strokeColor=[^;]+/, '');
        st = (cell.style || '').replace(/strokeDasharray=[^;]+/, '');
        st += ';strokeWidth=3;strokeColor=#000000;strokeDasharray=5,5;';
        graph.getModel().setStyle(cell, st);
        updateAlertNodeCell(cell);
        break;
      case 'end':
        // End node option - convert to end node
        // Change the node type from options to end
        let endStyle = (cell.style || '').replace(/nodeType=[^;]+/, '');
        endStyle = endStyle.replace(/questionType=[^;]+/, '');
        endStyle += ';nodeType=end;fillColor=#CCCCCC;fontColor=#000000;';
        graph.getModel().setStyle(cell, endStyle);
        updateEndNodeCell(cell);
        break;
      default:
        updateOptionNodeCell(cell);
    }
    // DISABLED: Automatic Node ID regeneration during option type changes
    // Node IDs will only change when manually edited or reset using the button
  } finally {
    graph.getModel().endUpdate();
  }
  refreshAllCells();
}
/* ----------  END OF REPLACEMENT  #2 ------------- */

  // Export setOptionType to global scope
  window.setOptionType = setOptionType;
  
  // Export other functions needed by context menus
  window.updateSubtitleNodeCell = updateSubtitleNodeCell;
  window.updateInfoNodeCell = updateInfoNodeCell;
  window.updateNotesNodeCell = updateNotesNodeCell;
  window.updateChecklistNodeCell = updateChecklistNodeCell;
  window.updateImageOptionCell = updateImageOptionCell;
  window.updatePdfNodeCell = updatePdfNodeCell;
  window.updateOptionNodeCell = updateOptionNodeCell;
  window.updateAlertNodeCell = updateAlertNodeCell;
  window.refreshOptionNodeId = refreshOptionNodeId;
  window.refreshAllOptionNodeIds = refreshAllOptionNodeIds;
  window.refreshNodeIdFromLabel = refreshNodeIdFromLabel;
  window.updateSimpleQuestionCell = updateSimpleQuestionCell;
  
  // Debug function to test node ID retrieval
  window.debugNodeId = function(cellId) {
    const cell = graph.getModel().getCell(cellId);
    if (!cell) {
      console.log("Cell not found");
      return;
    }
    console.log("Cell found:", cell);
    console.log("Cell style:", cell.style);
    console.log("Cell value:", cell.value);
    
    // Test different getNodeId functions
    console.log("getNodeId result:", (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || "");
    console.log("Window getNodeId result:", window.getNodeId(cell));
    
    // Test style parsing manually
    const style = cell.style || "";
    const match = style.match(/nodeId=([^;]+)/);
    console.log("Manual style match:", match);
    if (match) {
      console.log("Manual decoded result:", decodeURIComponent(match[1]));
    }
  };
  
  // Function to refresh all question node IDs in the graph
  window.refreshAllQuestionNodeIds = function() {
    console.log("ðŸ”„ REFRESH ALL QUESTION NODE IDS DEBUG START");
    if (!graph) {
      console.log("No graph available");
      return;
    }
    
    const parent = graph.getDefaultParent();
    const vertices = graph.getChildVertices(parent);
    console.log("Found vertices:", vertices.length);
    
    let updatedCount = 0;
    vertices.forEach(cell => {
      console.log("Checking cell:", cell);
      console.log("Is question?", isQuestion(cell));
      if (isQuestion(cell)) {
        console.log("Refreshing question node ID for:", cell);
        // DISABLED: Automatic Node ID generation
        // Node IDs will only change when manually edited or reset using the button
        updatedCount++;
      }
    });
    
    console.log(`Updated ${updatedCount} question node IDs`);
    
    // Refresh the graph to show changes
    if (window.refreshAllCells) {
      console.log("Calling refreshAllCells");
      window.refreshAllCells();
    }
    console.log("ðŸ”„ REFRESH ALL QUESTION NODE IDS DEBUG END");
  };


/**************************************************
 *           COLORING & REFRESHING CELLS          *
 **************************************************/
function colorCell(cell) {
  if (!cell.vertex) return;
  let fillColor = "#ADD8E6"; // fallback
  
  if (isEndNode(cell)) {
    fillColor = "#CCCCCC";
    const st = cell.style || "";
    if (!st.includes("fillColor=#CCCCCC")) {
      graph.getModel().setStyle(cell, st + "fillColor=#CCCCCC;");
    }
    return;
  }

  if (isQuestion(cell)) {
    const qType = getQuestionType(cell);
    switch (qType) {
      case "text":         fillColor = colorPreferences.text; break;
      case "checkbox":     fillColor = colorPreferences.checkbox; break;
      case "dropdown":     fillColor = colorPreferences.dropdown; break;
      case "number":       fillColor = colorPreferences.money; break;
      case "date":         fillColor = colorPreferences.date; break;
      case "dateRange":    fillColor = colorPreferences.date; break; // Use date color for dateRange
      case "email":        fillColor = colorPreferences.text; break; // Use text color for email
      case "phone":        fillColor = colorPreferences.text; break; // Use text color for phone
      case "bigParagraph": fillColor = colorPreferences.bigParagraph; break;
      case "multipleTextboxes":
      case "multipleDropdownType":
        fillColor = colorPreferences.text;
        break;
      default:
        fillColor = "#ADD8E6";
        break;
    }
  } else if (isOptions(cell)) {
    if (getQuestionType(cell) === "amountOption") {
      fillColor = colorPreferences.amountOption;
    } else if (getQuestionType(cell) === "imageOption") {
      fillColor = "#FFF8DC"; 
    } else if (getQuestionType(cell) === "notesNode") {
      fillColor = "#ffffff"; // Notes nodes are white with black border
    } else if (getQuestionType(cell) === "checklistNode") {
      fillColor = "#ffffff"; // Checklist nodes are white with striped red border
    } else {
      fillColor = "#ffffff";
    }
  } else if (isPdfNode(cell)) {
    fillColor = "#FFF8DC"; // Same color as image nodes
  } else if (isCalculationNode(cell)) {
    // You can pick a distinct color for calculation nodes
    fillColor = "#FFDDAA";
  }

  const fontColor = colorPreferences.textColor;
  const sec = getSection(cell) || "1";
  const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
  let borderColor = (currentSectionPrefs[sec] && currentSectionPrefs[sec].borderColor) || getDefaultSectionColor(parseInt(sec));
  let style = cell.style || "";
  style = style.replace(/fillColor=[^;]+/, "");
  style = style.replace(/fontColor=[^;]+/, "");
  style = style.replace(/strokeColor=[^;]+/, "");
  style += `;fillColor=${fillColor};fontColor=${fontColor};strokeColor=${borderColor};`;
  graph.getModel().setStyle(cell, style);
}

// Performance optimization: prevent excessive refreshAllCells calls
  // refreshAllCellsTimeout and isRefreshing moved to config.js module
  
  // refreshAllCells and performRefreshAllCells functions moved inside DOMContentLoaded event listener

/*******************************************************
 ************ Export/Import Flowchart JSON  ************
 *******************************************************/
// downloadJson, exportFlowchartJson, and importFlowchartJson have been moved to library.js

/*******************************************************
 ************ BFS + Export GUI JSON (with BFS) *********
 *******************************************************/
function isJumpNode(cell) {
  const style = cell.style || "";
  return style.includes("strokeWidth=3") &&
         style.includes("strokeColor=#ff0000") &&
         style.includes("dashed=1");
}

/**
 * BFS helper: climb from question Q up to all option nodes feeding into Q (even if via multiple questionâ†’question).
 */
function findAllUpstreamOptions(questionCell) {
  const results = [];
  const visited = new Set();
  const queue = [];

  const incomings = graph.getIncomingEdges(questionCell) || [];
  incomings.forEach(edge => {
    const src = edge.source;
    if (src && isOptions(src)) {
      const optLabel = (src.value || "Option").replace(/<[^>]+>/g, "").trim();
      const parentEdges = graph.getIncomingEdges(src) || [];
      if (parentEdges.length > 0) {
        const parentQ = parentEdges[0].source;
        if (parentQ && isQuestion(parentQ)) {
          results.push({
            questionId: parentQ._questionId,
            answerLabel: optLabel
          });
        }
      }
    } else if (src && isQuestion(src)) {
      queue.push(src);
    }
  });

  while (queue.length > 0) {
    const currentQ = queue.shift();
    if (!currentQ || visited.has(currentQ.id)) continue;
    visited.add(currentQ.id);

    const qIncomings = graph.getIncomingEdges(currentQ) || [];
    qIncomings.forEach(edge => {
      const src = edge.source;
      if (src && isOptions(src)) {
        const optLabel = (src.value || "Option").replace(/<[^>]+>/g, "").trim();
        const parentEdges = graph.getIncomingEdges(src) || [];
        if (parentEdges.length > 0) {
          const parentQ = parentEdges[0].source;
          if (parentQ && isQuestion(parentQ)) {
            results.push({
              questionId: parentQ._questionId,
              answerLabel: optLabel
            });
          }
        }
      } else if (src && isQuestion(src)) {
        queue.push(src);
      }
    });
  }

  return results;
}

function detectSectionJumps(cell, questionCellMap, questionIdMap) {
  const jumps = [];
  const outgoingEdges = graph.getOutgoingEdges(cell) || [];
  
  const cellSection = parseInt(getSection(cell) || "1", 10);
  
  for (const edge of outgoingEdges) {
    const targetCell = edge.target;
    if (!targetCell || !isOptions(targetCell)) continue;
    
    const optionText = targetCell.value.replace(/<[^>]+>/g, "").trim();
    
    const optionOutgoingEdges = graph.getOutgoingEdges(targetCell) || [];
    
    for (const optionEdge of optionOutgoingEdges) {
      const targetQuestionCell = optionEdge.target;
      if (!targetQuestionCell || !isQuestion(targetQuestionCell)) continue;
      
      const sourceSection = parseInt(getSection(cell) || "1", 10);
      const targetSection = parseInt(getSection(targetQuestionCell) || "1", 10);
      
      // If target section is more than 1 section away
      if (Math.abs(targetSection - sourceSection) > 1) {
        const targetQuestionId = questionIdMap.get(targetQuestionCell.id);
        if (targetQuestionId) {
          // Check if this jump already exists
          const exists = jumps.some(j => j.option === optionText && j.to === targetSection.toString());
          if (!exists) {
            jumps.push({
              option: optionText,
              to: targetSection.toString()
            });
          }
        }
      }
    }
  }
  
  return jumps;
}

/**************************************************
 ************  CREATE YES/NO  OPTIONS  ************
 **************************************************/
function createYesNoOptions(parentCell) {
  const geo = parentCell.geometry;
  if (!geo) return;
  const parent = graph.getDefaultParent();
  graph.getModel().beginUpdate();
  try {
    const parentSection = getSection(parentCell) || "1";

    const noX = geo.x + geo.width - 50;
    const noY = geo.y + geo.height + 50;
    let noStyle = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;pointerEvents=1;overflow=fill;nodeType=options;questionType=dropdown;spacing=12;fontSize=16;";
    const noNode = graph.insertVertex(parent, null, "<div style=\"text-align:center;\">No</div>", noX, noY, 100, 60, noStyle);
    // DISABLED: Automatic Node ID regeneration during node creation
    // Node IDs will only change when manually edited or reset using the button
    if (parentCell !== jumpModeNode) {
      setSection(noNode, parentSection);
    }
    const noEdge = graph.insertEdge(parent, null, "", parentCell, noNode);
    // Apply current edge style
    let edgeStyle;
    if (currentEdgeStyle === 'curved') {
      edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
    } else if (currentEdgeStyle === 'straight') {
      edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;";
    } else if (currentEdgeStyle === 'direct') {
      edgeStyle = "edgeStyle=none;rounded=0;orthogonalLoop=0;jettySize=auto;html=1;";
    } else {
      edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
    }
    graph.getModel().setStyle(noEdge, edgeStyle);

    const yesX = geo.x - 40;
    const yesY = geo.y + geo.height + 50;
    let yesStyle = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;pointerEvents=1;overflow=fill;nodeType=options;questionType=dropdown;spacing=12;fontSize=16;";
    const yesNode = graph.insertVertex(parent, null, "<div style=\"text-align:center;\">Yes</div>", yesX, yesY, 100, 60, yesStyle);
    // DISABLED: Automatic Node ID regeneration during node creation
    // Node IDs will only change when manually edited or reset using the button
    if (parentCell !== jumpModeNode) {
      setSection(yesNode, parentSection);
    }
    const yesEdge = graph.insertEdge(parent, null, "", parentCell, yesNode);
    // Apply current edge style
    graph.getModel().setStyle(yesEdge, edgeStyle);

    // Make sure the option nodes are properly formatted
    updateOptionNodeCell(noNode);
    updateOptionNodeCell(yesNode);

  } finally {
    graph.getModel().endUpdate();
  }
  refreshAllCells();
}



// Add a function to directly import a JSON string
window.importFlowchartJsonDirectly = function(jsonString) {
  try {
    if (!jsonString) {
      throw new Error("No data provided");
    }
    
    console.log("Original input:", jsonString.substring(0, 100) + "...");
    
    // Check if the string starts and ends with quotes
    if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
      console.log("Detected quoted JSON string, unquoting...");
      jsonString = jsonString.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      console.log("After unquoting:", jsonString.substring(0, 100) + "...");
    }
    
    // Try to parse the JSON
    let jsonData;
    try {
      jsonData = JSON.parse(jsonString);
    } catch (parseError) {
      // Fallback approach for handling complex cases
      jsonData = JSON.parse(JSON.stringify(eval("(" + jsonString + ")")));
    }
    
    // Check if this is a GUI JSON instead of a flowchart JSON
    if (jsonData.sections && Array.isArray(jsonData.sections) && !jsonData.cells) {
      throw new Error("You are trying to import a GUI JSON. Please import a flowchart JSON that has a 'cells' property.");
    }
    
    // Validate the JSON data
    if (!jsonData || !jsonData.cells || !Array.isArray(jsonData.cells)) {
      throw new Error("Invalid flowchart data: missing cells array");
    }
    
    // Debug: Log the sectionPrefs before passing to loadFlowchartData
    
    loadFlowchartData(jsonData);
    currentFlowchartName = null;
    return true;
  } catch (error) {
    alert("Error importing flowchart: " + error.message);
    return false;
  }
};

// Add a UI element to import JSON directly
document.addEventListener('DOMContentLoaded', function() {
  // Create keyboard navigation help tooltip
  // createKeyboardNavigationHelp(); // Disabled keyboard navigation popup
});

/**
 * Creates a small tooltip in the bottom corner showing keyboard navigation instructions
 */
function createKeyboardNavigationHelp() {
  const helpDiv = document.createElement('div');
  helpDiv.innerHTML = `
    <div style="position: fixed; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); 
                color: white; padding: 10px; border-radius: 5px; font-size: 12px; 
                z-index: 1000; max-width: 300px;">
      <strong>Keyboard Navigation:</strong>
      <ul style="margin: 5px 0; padding-left: 20px;">
        <li>Arrow Keys / WASD: Pan canvas</li>
        <li>Z: Zoom in</li>
        <li>X: Zoom out</li>
      </ul>
      <button onclick="this.parentNode.style.display='none';" 
              style="background: #444; border: none; color: white; padding: 3px 8px; 
                    border-radius: 3px; cursor: pointer;">
        Dismiss
      </button>
    </div>
  `;
  document.body.appendChild(helpDiv);
}

/**************************************************
 ********** KEYBOARD NAVIGATION CONTROLS **********
 **************************************************/
// Track which movement keys are currently pressed
const keysPressed = {
  left: false,
  right: false,
  up: false,
  down: false,
  zoom: 0, // 1 for zoom in, -1 for zoom out
  // Fast movement tracking
  leftFast: false,
  rightFast: false,
  upFast: false,
  downFast: false
};

// Double-tap detection vars
const doubleTapTime = 300; // ms between taps to count as double-tap
const keyLastPressed = {
  left: 0,
  right: 0,
  up: 0,
  down: 0
};

// Animation frame request ID for smooth movement
let animationFrameId = null;

// Speed and smoothness settings
const MOVEMENT_SPEED = 2; // pixels per frame (much slower for single tap)
const FAST_MOVEMENT_MULTIPLIER = 2.5; // how much faster when double-tapped
  const BASE_ZOOM_FACTOR = 1.005; // base zoom factor per frame

// Handle key down events - start movement
document.addEventListener('keydown', function(evt) {
  // Skip if user is typing in a text field
  if (isUserTyping(evt)) return;
  
  // Skip if modifier keys are pressed (to avoid interfering with browser shortcuts)
  if (evt.ctrlKey || evt.altKey || evt.metaKey) return;
  
  const now = Date.now();
  let keyHandled = true;
  
  switch (evt.key) {
    // Arrow keys and WASD for panning
    case 'ArrowLeft':
    case 'a':
    case 'A':
      // Handle double-tap detection
      if (!keysPressed.left) {
        const lastPress = keyLastPressed.left;
        keyLastPressed.left = now;
        
        // Check for double-tap (if pressed twice within doubleTapTime ms)
        if (now - lastPress < doubleTapTime) {
          keysPressed.leftFast = true;
        }
      }
      keysPressed.left = true;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      if (!keysPressed.right) {
        const lastPress = keyLastPressed.right;
        keyLastPressed.right = now;
        
        if (now - lastPress < doubleTapTime) {
          keysPressed.rightFast = true;
        }
      }
      keysPressed.right = true;
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      if (!keysPressed.up) {
        const lastPress = keyLastPressed.up;
        keyLastPressed.up = now;
        
        if (now - lastPress < doubleTapTime) {
          keysPressed.upFast = true;
        }
      }
      keysPressed.up = true;
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      if (!keysPressed.down) {
        const lastPress = keyLastPressed.down;
        keyLastPressed.down = now;
        
        if (now - lastPress < doubleTapTime) {
          keysPressed.downFast = true;
        }
      }
      keysPressed.down = true;
      break;
    
    // Z/X keys for zooming
    case 'z':
    case 'Z':
      keysPressed.zoom = 1;
      break;
    case 'x':
    case 'X':
      keysPressed.zoom = -1;
      break;
    default:
      keyHandled = false;
  }
  
  if (keyHandled) {
    evt.preventDefault();
    // Start the animation if not already running
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(updateCanvasPosition);
    }
  }
});

// Handle key up events - stop movement
document.addEventListener('keyup', function(evt) {
  switch (evt.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      keysPressed.left = false;
      keysPressed.leftFast = false;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      keysPressed.right = false;
      keysPressed.rightFast = false;
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      keysPressed.up = false;
      keysPressed.upFast = false;
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      keysPressed.down = false;
      keysPressed.downFast = false;
      break;
    case 'z':
    case 'Z':
    case 'x':
    case 'X':
      keysPressed.zoom = 0;
      break;
  }
  
  // If no keys are pressed, cancel the animation frame
  if (!keysPressed.left && !keysPressed.right && !keysPressed.up && !keysPressed.down && keysPressed.zoom === 0) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
});

// Animation function to update the canvas position
function updateCanvasPosition() {
  const translator = graph.view.getTranslate();
  let dx = 0;
  let dy = 0;
  
  // Calculate the translation change, applying speed multiplier for fast movement
  if (keysPressed.left) {
    dx += keysPressed.leftFast ? MOVEMENT_SPEED * FAST_MOVEMENT_MULTIPLIER : MOVEMENT_SPEED;
  }
  if (keysPressed.right) {
    dx -= keysPressed.rightFast ? MOVEMENT_SPEED * FAST_MOVEMENT_MULTIPLIER : MOVEMENT_SPEED;
  }
  if (keysPressed.up) {
    dy += keysPressed.upFast ? MOVEMENT_SPEED * FAST_MOVEMENT_MULTIPLIER : MOVEMENT_SPEED;
  }
  if (keysPressed.down) {
    dy -= keysPressed.downFast ? MOVEMENT_SPEED * FAST_MOVEMENT_MULTIPLIER : MOVEMENT_SPEED;
  }
  
  // Apply translation change if needed
  if (dx !== 0 || dy !== 0) {
    graph.view.setTranslate(translator.x + dx / graph.view.scale, translator.y + dy / graph.view.scale);
  }
  
  // Apply zoom change if needed (centered on mouse)
  if (keysPressed.zoom !== 0) {
    const container = graph.container;
    const rect = container.getBoundingClientRect();
    // Use the last mouse position relative to the container
    // (If mouse is outside, just use center of container)
    let mouseX = currentMouseX, mouseY = currentMouseY;
    // Convert graph coordinates to screen coordinates
    // But for zooming, we want the mouse position in container (screen) coordinates
    let mx = 0, my = 0;
    if (
      typeof window.event !== 'undefined' &&
      window.event.clientX !== undefined &&
      window.event.clientY !== undefined &&
      window.event.type &&
      window.event.type.startsWith('mouse')
    ) {
      mx = window.event.clientX - rect.left;
      my = window.event.clientY - rect.top;
    } else {
      // Fallback: use last known mouse position in graph coordinates, convert to screen
      // (graphX, graphY) -> screen: (graphX + tx) * scale
      mx = (mouseX + graph.view.getTranslate().x) * graph.view.scale;
      my = (mouseY + graph.view.getTranslate().y) * graph.view.scale;
      // If mouse is not over the container, fallback to center
      if (mx < 0 || mx > container.clientWidth || my < 0 || my > container.clientHeight) {
        mx = container.clientWidth / 2;
        my = container.clientHeight / 2;
      }
    }
    // Current scale and translation
    const oldScale = graph.view.scale;
    const oldTx = graph.view.getTranslate().x;
    const oldTy = graph.view.getTranslate().y;
    // Graph coordinates under mouse before zoom
    const graphX = (mx / oldScale) - oldTx;
    const graphY = (my / oldScale) - oldTy;
    // Get zoom sensitivity from settings (default to 0.01 if not set)
    const sensitivity = window.userSettings?.zoomSensitivity || 0.01;
    const sensitivityFactor = sensitivity * 50; // Scale up the sensitivity value
    const zoomFactor = 1 + (BASE_ZOOM_FACTOR - 1) * sensitivityFactor;
    
    
    // New scale
    let newScale;
    if (keysPressed.zoom > 0) {
      newScale = oldScale * zoomFactor;
    } else {
      newScale = oldScale / zoomFactor;
    }
    // New translation so that (graphX, graphY) stays under mouse
    const newTx = mx / newScale - graphX;
    const newTy = my / newScale - graphY;
    graph.view.setScale(newScale);
    graph.view.setTranslate(newTx, newTy);
  }

  // Refresh the graph if any changes were made
  if (dx !== 0 || dy !== 0 || keysPressed.zoom !== 0) {
    graph.view.refresh();
  }

  // Continue the animation if any key is still pressed
  if (keysPressed.left || keysPressed.right || keysPressed.up || keysPressed.down || keysPressed.zoom !== 0) {
    animationFrameId = requestAnimationFrame(updateCanvasPosition);
  } else {
    animationFrameId = null;
  }
}

// Fix the case sensitivity issue with the prevAnswer in logic conditions
// Add this code at the end of the sixth pass, just before creating the final JSON object

// Ensure checkbox options are properly capitalized in both the options and the conditions
// Access the 'sections' variable from the exportGuiJson function scope
window.fixCapitalizationInJumps = function() {
  // Get reference to sections from the main exportGuiJson function
  const sections = window.exportGuiJson.sections || [];
  
  for (const section of sections) {
    for (const question of section.questions) {
      // Fix capitalization of checkbox options
      if (question.type === "checkbox" && Array.isArray(question.options)) {
        // Create a mapping of lowercase option text to properly capitalized option text
        const optionCapitalizationMap = {};
        
        // Special handling for checkbox questions and their options
        if (Array.isArray(question.options)) {
          for (const option of question.options) {
            if (typeof option === 'object' && option.label) {
              // Store both the lowercase and original versions
              optionCapitalizationMap[option.label.toLowerCase()] = option.label;
              
              // Special case for "maybe" to ensure it's always properly capitalized
              if (option.label.toLowerCase() === "maybe") {
                optionCapitalizationMap["maybe"] = "Maybe";
              }
            }
          }
        }
        
        // Apply the capitalization fix to logic conditions
        for (const section2 of sections) {
          for (const question2 of section2.questions) {
            // Fix logic conditions
            if (question2.logic && question2.logic.conditions) {
              for (const condition of question2.logic.conditions) {
                if (condition.prevQuestion === question.questionId.toString()) {
                  // Special case for "maybe"
                  if (condition.prevAnswer && condition.prevAnswer.toLowerCase() === "maybe") {
                    condition.prevAnswer = "Maybe";
                    console.log(`Fixed capitalization: Changed logic condition prevAnswer to "Maybe"`);
                  }
                  // General case
                  else if (condition.prevAnswer && optionCapitalizationMap[condition.prevAnswer.toLowerCase()]) {
                    condition.prevAnswer = optionCapitalizationMap[condition.prevAnswer.toLowerCase()];
                    console.log(`Fixed capitalization: Changed logic condition prevAnswer from "${condition.prevAnswer}" to "${optionCapitalizationMap[condition.prevAnswer.toLowerCase()]}"`);
                  }
                }
              }
            }
            
            // Also check jump conditions that might reference options
            if (question2.jump && question2.jump.conditions) {
              for (const jumpCondition of question2.jump.conditions) {
                // For checkbox questions, make sure jump condition options match the case of option labels
                if (question2.questionId === question.questionId && 
                    jumpCondition.option && 
                    optionCapitalizationMap[jumpCondition.option.toLowerCase()]) {
                  jumpCondition.option = optionCapitalizationMap[jumpCondition.option.toLowerCase()];
                  // Fixed capitalization for jump condition option
                }
              }
            }
          }
        }
      }
    }
  }
}

// Call the function to fix capitalization
window.fixCapitalizationInJumps();

// Final check - look for any remaining issues in our resulting logic constraints
let stillHaveIssues = true;
let fixIteration = 0;
const maxIterations = 10; // Define maxIterations here instead of assuming it's already defined

while (stillHaveIssues && fixIteration < maxIterations) {
  stillHaveIssues = false;
  fixIteration++;
}

// --- PATCH START: sanitize option nameId generation ---
// Preserves forward slashes "/" in the name
function sanitizeNameId(str) {
  return str
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9\/]+/gi, "_") // replace any sequence of non-alphanumeric chars (except /) with _
    .replace(/^_+|_+$/g, ""); // trim leading/trailing underscores
}
// --- PATCH END ---

// Calculation node dependency management functions have been moved to calc.js

/**************************************************
 *           COLORING & REFRESHING CELLS          *
 **************************************************/

/**
 * Create a cell for dropdown - a textbox that functions like a dropdown but 
 * has better text editing capabilities
 */
function updateText2Cell(cell) {
  if (!cell) return;
    // Ensure we have question text - only set default if it's completely undefined or null
    if (cell._questionText === undefined || cell._questionText === null) {
    cell._questionText = "Enter dropdown question";
  }
  // Create the HTML content as a single line
  const html = `
    <div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center; width:100%;">
        <div class="question-text" style="text-align:center; padding:8px; width:100%; user-select:text;"contenteditable onkeydown="window.handleTitleInputKeydown(event)"onmousedown="event.stopPropagation();"onclick="window.handleMultipleTextboxClick(event, '${cell.id}')"onfocus="window.handleMultipleTextboxFocus(event, '${cell.id}')"onblur="window.updateText2Handler('${cell.id}', this.innerText)">${escapeHtml(cell._questionText || "")}</div>
    </div>`;
  graph.getModel().setValue(cell, html);
}

/**
 * Handler for dropdown question text changes
 */
window.updateText2Handler = function(cellId, text) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "dropdown") return;
  
      graph.getModel().beginUpdate();
      try {
    cell._questionText = text.trim() || "Enter dropdown question";
    updateText2Cell(cell);
      } finally {
        graph.getModel().endUpdate();
      }
  
  // DISABLED: Automatic Node ID generation
  // Node IDs will only change when manually edited or reset using the button
};

/**
 * Create or update a standard option node cell
 * This ensures option nodes have consistent styling and behavior
 */
function updateOptionNodeCell(cell) {
  if (!cell || !isOptions(cell)) return;
  
  // Skip image and amount options as they have their own handlers
  const qt = getQuestionType(cell);
  if (qt === "imageOption" || qt === "amountOption") return;
  
  // Get the current label text
  const currentValue = cell.value || "Option";
  let labelText = currentValue;
  
  // If it's an HTML string, extract the text
  if (typeof currentValue === 'string' && currentValue.includes('<')) {
    const tmp = document.createElement('div');
    tmp.innerHTML = currentValue;
    labelText = (tmp.textContent || tmp.innerText || "Option").trim();
  }
  
  // Create a simple centered div with the text
  const html = `<div style="text-align:center;">${escapeHtml(labelText)}</div>`;
  
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
  } finally {
    graph.getModel().endUpdate();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Force refresh of the type submenu
  const typeSubmenu = document.getElementById("typeSubmenu");
  
  // Make sure all type buttons are visible
  const allButtons = typeSubmenu.querySelectorAll("button");
  allButtons.forEach(button => {
    button.style.display = "block";
  });
  
  // Double-check specific buttons
  ["dateRangeType", "emailType", "phoneType"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.style.display = "block";
    }
  });
});

// --- Standardized Question Title Input (for all question types) ---

// Helper: Render a single-line contenteditable div for simple question types
function renderSimpleQuestionTitle(cell, placeholder) {
  const text = cell._questionText || '';
  const questionType = getQuestionType(cell);
  
  // For date range nodes, add a copy ID button
  if (questionType === 'dateRange') {
    return `<div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
      <div class="question-title-input" onfocus="if(this.innerText==='${placeholder}')this.innerText='';" onblur="window.updateSimpleQuestionTitle('${cell.id}', this.innerText)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')">${escapeHtml(text) || placeholder}</div>
      <button onclick="window.showDateRangeCopyDialog('${cell.id}')" style="margin-top: 8px; padding: 4px 8px; background-color: #007bff; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;" title="Copy ID">Copy ID</button>
    </div>`;
  }
  
  // Remove all inline styles, only use the class
  return `<div class="question-title-input"  onfocus="if(this.innerText==='${placeholder}')this.innerText='';" onblur="window.updateSimpleQuestionTitle('${cell.id}', this.innerText)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')">${escapeHtml(text) || placeholder}</div>`;
}

// Helper: Render a real <input> for multi-textbox/multi-dropdown types
function renderInputQuestionTitle(cell, placeholder) {
  const text = cell._questionText || '';
  // Remove all inline styles, only use the class
  return `<input class="question-title-input" type="text" value="${escapeAttr(text)}" placeholder="${placeholder}" oninput="window.updateInputQuestionTitle('${cell.id}', this.value)" onblur="window.updateInputQuestionTitle('${cell.id}', this.value)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')" />`;
}

// Update for simple question types
window.updateSimpleQuestionTitle = function(cellId, text) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  
  // Debug logging for big paragraph nodes
  if (typeof window.getQuestionType === 'function' && window.getQuestionType(cell) === 'bigParagraph') {
    console.log('ðŸ”§ [BIG PARAGRAPH UPDATE DEBUG] Cell ID:', cellId);
    console.log('ðŸ”§ [BIG PARAGRAPH UPDATE DEBUG] Input text:', text);
    console.log('ðŸ”§ [BIG PARAGRAPH UPDATE DEBUG] Cell before update:', cell);
  }
  
  graph.getModel().beginUpdate();
  try {
    cell._questionText = text.replace(/<[^>]+>/g, '').trim() || '';
    
    // Debug logging after update
    if (typeof window.getQuestionType === 'function' && window.getQuestionType(cell) === 'bigParagraph') {
      console.log('ðŸ”§ [BIG PARAGRAPH UPDATE DEBUG] cell._questionText after update:', cell._questionText);
    }
  } finally {
    graph.getModel().endUpdate();
  }
  // Only re-render on blur, not on every input
  updateSimpleQuestionCell(cell);
  
  // Only refresh Node ID if it's not a custom one
  const existingNodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || "";
  const hasCustomNodeId = existingNodeId && existingNodeId !== "unnamed_node" && 
                         !existingNodeId.startsWith("node_") && 
                         !existingNodeId.match(/^[a-z]+_question_node$/);
  
  if (!hasCustomNodeId) {
    // DISABLED: Automatic Node ID generation
  // Node IDs will only change when manually edited or reset using the button
  }
};

// Show dialog for date range copy ID functionality
window.showDateRangeCopyDialog = function(cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  
  // Get the question text and sanitize it
  const questionText = cell._questionText || '';
  const sanitizedQuestionText = questionText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  
  // Check if this question has a PDF property
  const pdfName = window.findPdfNameForQuestion ? window.findPdfNameForQuestion(cell) : null;
  const sanitizedPdfName = pdfName && window.sanitizePdfName ? window.sanitizePdfName(pdfName) : '';
  
  // Create the base ID
  let baseId;
  if (sanitizedPdfName) {
    baseId = `${sanitizedPdfName}_${sanitizedQuestionText}`;
  } else {
    baseId = sanitizedQuestionText;
  }
  
  // Show the dialog
  const choice = confirm('Copy ID for:\n\nOK = Start Date (_1)\nCancel = Finish Date (_2)');
  
  let idToCopy;
  if (choice) {
    // Start date
    idToCopy = `${baseId}_1`;
  } else {
    // Finish date
    idToCopy = `${baseId}_2`;
  }
  
  // Copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(idToCopy).then(() => {
      // Show visual feedback
      showCopyFeedback(idToCopy);
    }).catch(() => {
      // Fallback for older browsers
      fallbackCopyToClipboard(idToCopy);
      showCopyFeedback(idToCopy);
    });
  } else {
    // Fallback for older browsers
    fallbackCopyToClipboard(idToCopy);
    showCopyFeedback(idToCopy);
  }
};

// Show visual feedback for copy operations
function showCopyFeedback(copiedText) {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    max-width: 300px;
    word-wrap: break-word;
  `;
  notification.textContent = `Copied: ${copiedText}`;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Update for input-based question types
window.updateInputQuestionTitle = function(cellId, text) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  graph.getModel().beginUpdate();
  try {
    cell._questionText = text.trim();
  } finally {
    graph.getModel().endUpdate();
  }
  // Only re-render on blur, not on every input
  if (getQuestionType(cell) === 'multipleTextboxes') {
    updateMultipleTextboxesCell(cell);
  } else if (getQuestionType(cell) === 'multipleDropdownType') {
    updatemultipleDropdownTypeCell(cell);
  }
  // DISABLED: Automatic Node ID generation
  // Node IDs will only change when manually edited or reset using the button
};

// Handle Enter key: blur on Enter
window.handleTitleInputKeydown = function(event, cellId) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.target.blur();
  }
  // Do not stop propagation for copy/cut/paste
};

// Update rendering for simple question types
function updateSimpleQuestionCell(cell) {
  const placeholder = getQuestionType(cell).charAt(0).toUpperCase() + getQuestionType(cell).slice(1) + ' question node';
  // Strip any HTML from _questionText before rendering
  let text = cell._questionText || '';
  text = text.replace(/<[^>]+>/g, '').trim();
  cell._questionText = text; // keep it clean for future edits
  const html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center; width:100%;">
    ${renderSimpleQuestionTitle(cell, placeholder)}
  </div>`;
  graph.getModel().setValue(cell, html);
}

  

// Patch updateMultipleTextboxesCell to use <input> for title
function updateMultipleTextboxesCell(cell) {
  graph.getModel().beginUpdate();
  try {
    let html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
      <input class="question-title-input" type="text" value="${escapeAttr(cell._questionText || "")}" placeholder="Enter question text" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updateInputQuestionTitle('${cell.id}', this.value)" style="margin-bottom:8px; width:90%; text-align:center;" />
      <div class="multiple-textboxes-container" style="padding: 8px; width:100%;">${renderTextboxes(cell)}</div>
    </div>`;
    cell.value = html;
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

// Patch updatemultipleDropdownTypeCell to use <input> for title
function updatemultipleDropdownTypeCell(cell) {
  const qText = cell._questionText || '';
  const twoNums = cell._twoNumbers || { first: '0', second: '0' };
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: '', placeholder: 'Enter value', isAmountOption: false }];
  }
  let html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
    <input class="question-title-input" type="text" value="${escapeAttr(qText)}" placeholder="Enter question text" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeTextHandler('${cell.id}', this.value)" style="margin-bottom:8px; width:90%; text-align:center;" />
    <div class="two-number-container" style="display: flex; justify-content:center; gap: 10px; margin-top: 8px; width:100%;">
      <input type="number" value="${escapeAttr(twoNums.first)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'first', this.value)"/>
      <input type="number" value="${escapeAttr(twoNums.second)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'second', this.value)"/>
    </div>
    <div class="multiple-textboxes-container" style="margin-top:8px;width:100%;">`;
  // Check if there's a location indicator position
  // Only show location if _locationIndex is defined, not null, and >= 0
  const locationIndex = (cell._locationIndex !== undefined && cell._locationIndex !== null && cell._locationIndex >= 0) ? cell._locationIndex : -1;
  
  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || '';
    const ph = tb.placeholder || 'Enter value';
    const checked = tb.isAmountOption ? 'checked' : '';
    
    // Add location indicator before this option if it's at the location index
    if (index === locationIndex) {
      html += `
        <div class="location-indicator" style="margin: 8px 0; padding: 8px; background-color: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; text-align: center; color: #28a745; font-weight: bold; font-size: 12px;">
          📍 Location Date Inserted
          <input type="text" value="${escapeAttr(cell._locationTitle || '')}" placeholder="Enter location title..." onblur="window.updateMultipleDropdownLocationTitle('${cell.id}', this.value)" style="width: 100%; max-width: 300px; padding: 4px 8px; border: 1px solid #28a745; border-radius: 3px; font-size: 12px; margin-top: 8px; text-align: center; background: white; color: #333; display: block; margin-left: auto; margin-right: auto;"/>
          <button onclick="window.removeMultipleDropdownLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Remove</button>
          <button onclick="window.showDropdownLocationIdsPopup('${cell.id}')" style="margin-left: 8px; background-color: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Copy ID's</button>
        </div>`;
    }
    
    html += `
      <div class="textbox-entry" style="margin-bottom:4px; text-align:center; display: flex; align-items: center; gap: 4px;" data-index="${index}">
        <div class="drag-handle" style="cursor: move; color: #666; font-size: 14px; user-select: none; padding: 2px;" draggable="true" data-cell-id="${cell.id}" ondragstart="window.handleDragStart(event, '${cell.id}', ${index})" ondragend="window.handleDragEnd(event)" onmousedown="event.stopPropagation()">Field:</div>
        <input type="text" value="${escapeAttr(val)}" data-index="${index}" placeholder="${escapeAttr(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeHandler('${cell.id}', ${index}, this.value)" style="flex: 1;"/>
        <button onclick="window.deletemultipleDropdownTypeHandler('${cell.id}', ${index})">Delete</button>
        <button onclick="window.copyMultipleDropdownId('${cell.id}', ${index})" style="margin-left: 4px; background-color: #4CAF50; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Copy ID</button>
        <label>
          <input type="checkbox" ${checked} onclick="window.toggleMultipleDropdownAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });
  
  // Add location indicator at the end if location index is beyond the current options
  if (locationIndex >= cell._textboxes.length) {
    html += `
      <div class="location-indicator" style="margin: 8px 0; padding: 8px; background-color: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; text-align: center; color: #28a745; font-weight: bold; font-size: 12px;">
        📍 Location Date Inserted
        <input type="text" value="${escapeAttr(cell._locationTitle || '')}" placeholder="Enter location title..." onblur="window.updateMultipleDropdownLocationTitle('${cell.id}', this.value)" style="width: 100%; max-width: 300px; padding: 4px 8px; border: 1px solid #28a745; border-radius: 3px; font-size: 12px; margin-top: 8px; text-align: center; background: white; color: #333; display: block; margin-left: auto; margin-right: auto;"/>
        <button onclick="window.removeMultipleDropdownLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #dc3545; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px;">Remove</button>
        <button onclick="window.showDropdownLocationIdsPopup('${cell.id}')" style="margin-left: 8px; background-color: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Copy ID's</button>
      </div>`;
  }
  
  html += `<div style="text-align:center; margin-top:8px;">
      <button onclick="window.addmultipleDropdownTypeHandler('${cell.id}')">Add Option</button>
      <button onclick="window.addMultipleDropdownLocationHandler('${cell.id}')" style="margin-left: 8px; background-color: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Add Location</button>
      <button onclick="window.showReorderModal('${cell.id}', 'multipleDropdownType')" style="margin-left: 8px; background-color: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Reorder</button>
    </div>
    </div>
  </div>`;
  
  // Add drop zone event listeners
  html = html.replace('class="multiple-textboxes-container"', 'class="multiple-textboxes-container" ondragover="window.handleDragOver(event)" ondrop="window.handleDrop(event, \'' + cell.id + '\')"');
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
    let st = cell.style || '';
    if (!st.includes('verticalAlign=middle')) {
      st += 'verticalAlign=middle;';
    }
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
  
  // Force a refresh to ensure the new HTML is rendered
  setTimeout(() => {
    if (graph.getModel().getCell(cell.id)) {
      graph.refresh(cell);
    }
  }, 10);
}
// ... existing code ...

// Add this in the DOMContentLoaded event listener

document.addEventListener("DOMContentLoaded", function() {
  // ... existing code ...

  // Prevent browser context menu on empty space (graph background),
  // but allow it inside input, textarea, or contenteditable elements
  const container = document.getElementById("graphContainer");
  container.addEventListener("contextmenu", function(e) {
    // Allow native context menu in text fields/contenteditable
    if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
  });
  
  // Add left-click handler for canvas with capture phase to intercept before graph handlers
  container.addEventListener("click", function(e) {
    
    // Handle left-clicks (button 0) on the canvas or nodes
    if (e.button === 0 && container.contains(e.target)) {
      // Check if this is on empty canvas (not on a node)
      const cell = graph.getCellAt(e.clientX, e.clientY);
      if (!cell) {
        // Additional check: make sure we're not clicking on any interactive elements
        const interactiveElement = e.target.closest('input, button, select, textarea, [contenteditable], [draggable="true"]');
        if (interactiveElement) {
          console.log('🔧 [SQUARE DEBUG] Left-click on interactive element - ignoring for square creation');
          return;
        }
        
        // This is a click on empty canvas - check for double left-click
        console.log('🔧 [SQUARE DEBUG] Left-click detected on empty canvas at:', e.clientX, e.clientY);
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - lastLeftClickTime;
        
        // If we're currently in square creation mode, cancel it
        if (rightClickDragging) {
        resetSquareCreationState();
          return;
        }
        
        // Check if this is a double left-click (within 500ms)
        if (timeSinceLastClick < 500) {
          leftClickCount++;
          console.log('🔧 [SQUARE DEBUG] Double left-click detected on empty canvas - initiating square creation');
          
          // Clear any existing timeout
          if (leftClickTimeout) {
            clearTimeout(leftClickTimeout);
            leftClickTimeout = null;
          }
          
          // Start square creation
          rightClickDragging = true;
          rightClickStartPos = { x: e.clientX, y: e.clientY };
          startSquareCreationTimeout();
          
          // Reset the counter
          leftClickCount = 0;
          lastLeftClickTime = 0;
          
          // Prevent default behavior
          e.preventDefault();
          return false;
        } else {
          // Single left-click - start counting
          console.log('🔧 [SQUARE DEBUG] Single left-click on empty canvas - starting double-click detection');
          leftClickCount = 1;
          lastLeftClickTime = currentTime;
          
          // Set a timeout to reset the counter if no second click comes
          leftClickTimeout = setTimeout(() => {
            leftClickCount = 0;
            lastLeftClickTime = 0;
          }, 500);
        }
      } else {
        // Click is on a node - end any ongoing square creation process
        console.log('🔧 [SQUARE DEBUG] Left-click detected on node - resetting square creation state');
      if (typeof resetSquareCreationState === 'function') {
        resetSquareCreationState();
      }
    }
    }
  }, true); // Use capture phase to intercept before graph handlers
  
  // Global click handler removed - now handled by container click handler above

  // Experimental feature: Right-click drag detection for "square initiated" alert
  // Setting up right-click drag detection
  
  let rightClickDragging = false;
  let rightClickStartPos = null;
  
  container.addEventListener("mousedown", function(e) {
    // Check if it's a right-click (button 2)
    if (e.button === 2) {
      rightClickDragging = true;
      rightClickStartPos = { x: e.clientX, y: e.clientY };
    }
  }, true); // Use capture phase to intercept events before other handlers
  
  container.addEventListener("mousemove", function(e) {
    if (rightClickDragging && rightClickStartPos) {
      // Check if mouse has moved a significant distance (threshold of 10 pixels)
      const distance = Math.sqrt(
        Math.pow(e.clientX - rightClickStartPos.x, 2) + 
        Math.pow(e.clientY - rightClickStartPos.y, 2)
      );
      
      if (distance > 10) {
        // Distance threshold exceeded - square creation initiated
        // Don't reset state yet - we need to track until mouseup to determine final size
      }
    }
  });
  
  container.addEventListener("mouseup", function(e) {
    if (e.button === 2) {
      rightClickDragging = false;
      rightClickStartPos = null;
    }
  });
  
  // Also handle mouse leave to reset state (but be less aggressive)
  container.addEventListener("mouseleave", function(e) {
    // Don't reset state immediately - let the timeout or mouseup handle it
  });
  
  // All event listeners added successfully
  
  document.addEventListener("mousemove", function(e) {
    if (rightClickDragging && rightClickStartPos) {
      // Check if mouse has moved a significant distance (threshold of 10 pixels)
      const distance = Math.sqrt(
        Math.pow(e.clientX - rightClickStartPos.x, 2) + 
        Math.pow(e.clientY - rightClickStartPos.y, 2)
      );
      
      if (distance > 10) {
        // Distance threshold exceeded - square creation initiated
        // Don't reset state yet - we need to track until mouseup to determine final size
      }
    }
  }, true);
  
  document.addEventListener("mouseup", function(e) {
    if (e.button === 2) {
      rightClickDragging = false;
      rightClickStartPos = null;
    }
  }, true);
  
  // All global backup listeners added successfully
  
  // Add window-level listeners as ultimate backup
  window.addEventListener("mousedown", function(e) {
    // Only process if it's inside our container and a right-click
    if (container.contains(e.target) && e.button === 2) {
      rightClickDragging = true;
      rightClickStartPos = { x: e.clientX, y: e.clientY };
    }
  }, true);
  
  window.addEventListener("mousemove", function(e) {
    if (rightClickDragging && rightClickStartPos) {
      // Check if mouse has moved a significant distance (threshold of 10 pixels)
      const distance = Math.sqrt(
        Math.pow(e.clientX - rightClickStartPos.x, 2) + 
        Math.pow(e.clientY - rightClickStartPos.y, 2)
      );
      
      if (distance > 10) {
        // Distance threshold exceeded - square creation initiated
        // Don't reset state yet - we need to track until mouseup to determine final size
      }
    }
  }, true);
  
  window.addEventListener("mouseup", function(e) {
    if (e.button === 2) {
      rightClickDragging = false;
      rightClickStartPos = null;
    }
  }, true);
  
  // All window-level listeners added successfully
  // Test listeners removed
  
  // Test listeners added
  container.onclick = function(e) {
  };
  
  container.onmousedown = function(e) {
  };
  
  // First contextmenu handler removed - using the one with timeout below
  
  // Also try adding to the body element
  document.body.onclick = function(e) {
  };
  
  document.body.onmousedown = function(e) {
  };
  
  // Test div removed - no longer needed
  
  // Add a more aggressive mousemove detection that works independently
  let lastMousePos = null;
  let rightClickActive = false;
  
  // Track mouse position continuously
  document.addEventListener("mousemove", function(e) {
    lastMousePos = { x: e.clientX, y: e.clientY };
    // Update the last mouse move time
    lastMouseMoveTime = Date.now();
    
    // If we're in right-click drag mode, check distance
    if (rightClickDragging && rightClickStartPos) {
      
      const distance = Math.sqrt(
        Math.pow(e.clientX - rightClickStartPos.x, 2) + 
        Math.pow(e.clientY - rightClickStartPos.y, 2)
      );
      
      
      if (distance > 10) {
        
        // Create or update the temporary selection box
        updateTemporarySelectionBox(rightClickStartPos, lastMousePos);
        // Don't reset state yet - we need to track until mouseup to determine final size
      }
    }
  }, true);
  
  // Also try to detect right-click by monitoring contextmenu events
  // Global context menu listener removed - using double right-click detection instead
  
  
  // Add mouseup detection to complete the square creation
  document.addEventListener("mouseup", function(e) {
    
    // Check if this is a left-click - end any ongoing square creation
    if (e.button === 0 && rightClickDragging) {
      resetSquareCreationState();
      return;
    }
    
    if (rightClickDragging && rightClickStartPos) {
      const endPos = { x: e.clientX, y: e.clientY };
      
      // Calculate square dimensions
      const width = Math.abs(endPos.x - rightClickStartPos.x);
      const height = Math.abs(endPos.y - rightClickStartPos.y);
      const left = Math.min(rightClickStartPos.x, endPos.x);
      const top = Math.min(rightClickStartPos.y, endPos.y);
      
      
      // Remove the temporary selection box
      removeTemporarySelectionBox();
      
      // Only create square if it has meaningful size
      if (width > 5 && height > 5) {
        // createBlueSquare(left, top, width, height); // DISABLED - user doesn't want solid blue squares
      }
      
      // Cancel timeout since we're handling it here
      cancelSquareCreationTimeout();
      
      // Reset state
      resetSquareCreationState();
    }
  }, true);
  
  // Add window-level mouseup listener as backup
  window.addEventListener("mouseup", function(e) {
    
    // Check if this is a left-click - end any ongoing square creation
    if (e.button === 0 && rightClickDragging) {
      resetSquareCreationState();
      return;
    }
    
    if (rightClickDragging && rightClickStartPos) {
      const endPos = { x: e.clientX, y: e.clientY };
      
      // Calculate square dimensions
      const width = Math.abs(endPos.x - rightClickStartPos.x);
      const height = Math.abs(endPos.y - rightClickStartPos.y);
      const left = Math.min(rightClickStartPos.x, endPos.x);
      const top = Math.min(rightClickStartPos.y, endPos.y);
      
      
      // Remove the temporary selection box
      removeTemporarySelectionBox();
      
      // Only create square if it has meaningful size
      if (width > 5 && height > 5) {
        // createBlueSquare(left, top, width, height); // DISABLED - user doesn't want solid blue squares
      }
      
      // Cancel timeout since we're handling it here
      cancelSquareCreationTimeout();
      
      // Reset state
      resetSquareCreationState();
    }
  }, true);
  
  // Add inline mousedown handler to body to detect left-clicks (for cancellation)
  document.body.onmousedown = function(e) {
    
    // Check if this is a left-click - end any ongoing square creation
    if (e.button === 0 && rightClickDragging) {
      resetSquareCreationState();
      return;
    }
  };
  
  // Add double right-click detection system
  let rightClickCount = 0;
  let rightClickTimeout = null;
  let lastRightClickTime = 0;
  
  // Add double left-click detection system
  let leftClickCount = 0;
  let leftClickTimeout = null;
  let lastLeftClickTime = 0;
  
  // Add inline contextmenu handler to body to detect double right-clicks
  document.body.oncontextmenu = function(e) {
    
    // Check if this is a right-click on the canvas
    if (container.contains(e.target)) {
      const currentTime = Date.now();
      const timeSinceLastClick = currentTime - lastRightClickTime;
      
      
       // If we're currently in square creation mode, cancel it
       if (rightClickDragging) {
         resetSquareCreationState();
         return;
       }
      
      // Check if this is a double right-click (within 500ms)
      if (timeSinceLastClick < 500) {
        rightClickCount++;
        
        // Clear any existing timeout
        if (rightClickTimeout) {
          clearTimeout(rightClickTimeout);
          rightClickTimeout = null;
        }
        
        // Start square creation
        rightClickDragging = true;
        rightClickStartPos = { x: e.clientX, y: e.clientY };
        startSquareCreationTimeout();
        
        // Reset the counter
        rightClickCount = 0;
        lastRightClickTime = 0;
        
        // Prevent the context menu from appearing
        e.preventDefault();
        return false;
      } else {
        // Single right-click - start counting
        rightClickCount = 1;
        lastRightClickTime = currentTime;
        
        // Set a timeout to reset the counter if no second click comes
        rightClickTimeout = setTimeout(() => {
          rightClickCount = 0;
          lastRightClickTime = 0;
        }, 500);
      }
    }
  };
  
  // Add inline mousemove handler to body to track drag
  document.body.onmousemove = function(e) {
    // Track global mouse position for timeout fallback
    lastMousePos = { x: e.clientX, y: e.clientY };
    // Update the last mouse move time
    lastMouseMoveTime = Date.now();
    
    if (rightClickDragging && rightClickStartPos) {
      
      const distance = Math.sqrt(
        Math.pow(e.clientX - rightClickStartPos.x, 2) + 
        Math.pow(e.clientY - rightClickStartPos.y, 2)
      );
      
      
      if (distance > 10) {
        
        // Create or update the temporary selection box
        updateTemporarySelectionBox(rightClickStartPos, lastMousePos);
      }
    }
  };
  
  // Add inline mouseup handler to body as ultimate backup
  document.body.onmouseup = function(e) {
    
    if (rightClickDragging && rightClickStartPos) {
      const endPos = { x: e.clientX, y: e.clientY };
      
      // Calculate square dimensions
      const width = Math.abs(endPos.x - rightClickStartPos.x);
      const height = Math.abs(endPos.y - rightClickStartPos.y);
      const left = Math.min(rightClickStartPos.x, endPos.x);
      const top = Math.min(rightClickStartPos.y, endPos.y);
      
      
      // Remove the temporary selection box
      removeTemporarySelectionBox();
      
      // Only create square if it has meaningful size
      if (width > 5 && height > 5) {
        // createBlueSquare(left, top, width, height); // DISABLED - user doesn't want solid blue squares
      }
      
      // Cancel timeout since we're handling it here
      cancelSquareCreationTimeout();
      
      // Reset state
      resetSquareCreationState();
    }
  };
  
  // Global variable to track the temporary selection box
  let temporarySelectionBox = null;
  
  // Function to create or update the temporary selection box during drag
  function updateTemporarySelectionBox(startPos, currentPos) {
    
    // Calculate dimensions
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);
    const left = Math.min(startPos.x, currentPos.x);
    const top = Math.min(startPos.y, currentPos.y);
    
    
    // Remove existing temporary selection box if it exists
    if (temporarySelectionBox) {
      temporarySelectionBox.remove();
      temporarySelectionBox = null;
    }
    
    // Create new temporary selection box
    temporarySelectionBox = document.createElement('div');
    temporarySelectionBox.id = 'temporarySelectionBox';
    temporarySelectionBox.style.cssText = `
      position: fixed;
      left: ${left}px;
      top: ${top}px;
      width: ${width}px;
      height: ${height}px;
      background-color: rgba(0, 123, 255, 0.2);
      border: 2px solid #007bff;
      z-index: 1000;
      pointer-events: none;
      opacity: 0.8;
    `;
    
    document.body.appendChild(temporarySelectionBox);
    
    // Update selection in real-time during drag (only if we have a meaningful size)
    if (width > 10 && height > 10) {
      selectNodesInSquareArea(left, top, width, height);
    }
  }
  
  // Function to remove the temporary selection box
  function removeTemporarySelectionBox() {
    if (temporarySelectionBox) {
      temporarySelectionBox.remove();
      temporarySelectionBox = null;
    }
  }
  
  // Function to select nodes that overlap with the square area
  function selectNodesInSquareArea(left, top, width, height) {
    
    // Get the graph container to convert screen coordinates to graph coordinates
    const container = document.getElementById('graphContainer');
    if (!container) {
      return [];
    }
    
    // Get the graph's view to convert coordinates
    const view = graph.getView();
    const scale = view.getScale();
    const translate = view.getTranslate();
    
    
    // Convert screen coordinates to graph coordinates
    const containerRect = container.getBoundingClientRect();
    const graphLeft = (left - containerRect.left) / scale - translate.x;
    const graphTop = (top - containerRect.top) / scale - translate.y;
    const graphWidth = width / scale;
    const graphHeight = height / scale;
    
    
    // Get all vertex cells (nodes) from the graph
    const vertices = graph.getChildVertices(graph.getDefaultParent());
    const selectedNodes = [];
    
    vertices.forEach(cell => {
      // Get the cell's position and size
      const geometry = cell.getGeometry();
      if (!geometry) return;
      
      const cellLeft = geometry.x;
      const cellTop = geometry.y;
      const cellWidth = geometry.width || 100; // Default width if not specified
      const cellHeight = geometry.height || 50; // Default height if not specified
      
      
      // Check if the cell overlaps with the square area (using graph coordinates)
      const overlaps = !(cellLeft + cellWidth < graphLeft || 
                        cellLeft > graphLeft + graphWidth || 
                        cellTop + cellHeight < graphTop || 
                        cellTop > graphTop + graphHeight);
      
      if (overlaps) {
        selectedNodes.push(cell);
      }
    });
    
    
    // Select the overlapping nodes using the same method as section selection
    if (selectedNodes.length > 0) {
      // Clear current selection first
      graph.clearSelection();
      
      // Select all overlapping nodes at once (like section selection does)
      graph.addSelectionCells(selectedNodes);
      
    }
    
    return selectedNodes;
  }
  
  // Function to create the blue square
  function createBlueSquare(left, top, width, height) {
    
    // Create the square element
    const square = document.createElement('div');
    square.style.cssText = `
      position: fixed;
      left: ${left}px;
      top: ${top}px;
      width: ${width}px;
      height: ${height}px;
      background-color: blue;
      border: 2px solid darkblue;
      z-index: 1000;
      pointer-events: none;
      opacity: 0.7;
    `;
    
    // Add a unique ID for tracking
    const squareId = 'blueSquare_' + Date.now();
    square.id = squareId;
    square.setAttribute('data-created', new Date().toISOString());
    
    // Add a class to identify this as a blue square for event handling
    square.classList.add('blue-selection-square');
    
    
    // Add to document
    document.body.appendChild(square);
    
    // Add click handler to remove the square
    square.style.pointerEvents = 'auto';
    square.style.cursor = 'pointer';
    square.title = 'Click to remove this square';
    
    square.addEventListener('click', function(e) {
      console.log('🔧 [SQUARE DEBUG] REMOVE: Square clicked for removal');
      console.log('🔧 [SQUARE DEBUG] REMOVE: Square ID:', squareId);
      console.log('🔧 [SQUARE DEBUG] REMOVE: Event target:', e.target);
      console.log('🔧 [SQUARE DEBUG] REMOVE: Event currentTarget:', e.currentTarget);
      
      // Prevent event propagation to avoid interference from other handlers
      e.stopPropagation();
      e.preventDefault();
      
      // Get the current selection before removing the square
      const currentSelection = graph.getSelectionCells();
      console.log('🔧 [SQUARE DEBUG] REMOVE: Current selection before removal:', currentSelection.length, 'nodes');
      console.log('🔧 [SQUARE DEBUG] REMOVE: Selected cells:', currentSelection.map(c => c.id));
      
      // Remove the square
      e.target.remove();
      console.log('🔧 [SQUARE DEBUG] REMOVE: Square removed from document');
      
      // Restore the selection after a brief delay to ensure the square is fully removed
      setTimeout(() => {
        if (currentSelection.length > 0) {
          console.log('🔧 [SQUARE DEBUG] REMOVE: Restoring selection of', currentSelection.length, 'nodes');
          graph.clearSelection();
          graph.addSelectionCells(currentSelection);
          console.log('🔧 [SQUARE DEBUG] REMOVE: Selection restored');
          
          // Verify the selection was actually restored
          const restoredSelection = graph.getSelectionCells();
          console.log('🔧 [SQUARE DEBUG] REMOVE: Verification - restored selection:', restoredSelection.length, 'nodes');
          console.log('🔧 [SQUARE DEBUG] REMOVE: Verification - restored cells:', restoredSelection.map(c => c.id));
        }
      }, 10);
    });
    
    console.log('🔧 [SQUARE DEBUG] CREATE: Square creation complete');
    console.log('🔧 [SQUARE DEBUG] CREATE: Square is clickable to remove');
    
    // Force a repaint to ensure visibility
    square.style.display = 'block';
    square.offsetHeight; // Force reflow
    
    // Select nodes that overlap with the square area
    selectNodesInSquareArea(left, top, width, height);
    
    // Add a test to see if we can find the square in the DOM
    setTimeout(() => {
      const foundSquare = document.getElementById(squareId);
      console.log('🔧 [SQUARE DEBUG] VERIFY: Square found in DOM after 100ms:', foundSquare);
      if (foundSquare) {
        console.log('🔧 [SQUARE DEBUG] VERIFY: Square is visible:', foundSquare.offsetWidth > 0 && foundSquare.offsetHeight > 0);
        console.log('🔧 [SQUARE DEBUG] VERIFY: Square final computed styles:', window.getComputedStyle(foundSquare));
      }
    }, 100);
  }
  
  // Add timeout-based fallback for square creation
  // This will create a square after a delay if mouseup events are blocked
  let squareCreationTimeout = null;
  let lastMouseMoveTime = 0;
  
  // Function to start timeout-based square creation
  function startSquareCreationTimeout() {
    if (squareCreationTimeout) {
      clearTimeout(squareCreationTimeout);
    }
    
    // Reset the last mouse move time
    lastMouseMoveTime = Date.now();
    
    squareCreationTimeout = setTimeout(() => {
      if (rightClickDragging && rightClickStartPos) {
        // Check if there's been recent mouse movement
        const timeSinceLastMove = Date.now() - lastMouseMoveTime;
        console.log('🔧 [SQUARE DEBUG] TIMEOUT: Time since last mouse move:', timeSinceLastMove);
        
        // Only create square if there's been no mouse movement for 3 seconds
        if (timeSinceLastMove > 3000) {
          console.log('🔧 [SQUARE DEBUG] TIMEOUT: Creating square via timeout fallback (no mouse movement)');
          console.log('🔧 [SQUARE DEBUG] TIMEOUT: Start position:', rightClickStartPos);
          
          // Try to get current mouse position for better sizing
          let endPos = rightClickStartPos; // fallback to start position
          try {
            // Get the last known mouse position from the global mouse tracking
            if (lastMousePos) {
              endPos = lastMousePos;
              console.log('🔧 [SQUARE DEBUG] TIMEOUT: Using last known mouse position:', endPos);
            } else {
              console.log('🔧 [SQUARE DEBUG] TIMEOUT: No last mouse position available, using start position');
            }
          } catch (e) {
            console.log('🔧 [SQUARE DEBUG] TIMEOUT: Could not get last mouse position, using start position');
          }
          
          // Calculate square dimensions based on start and end positions
          const width = Math.abs(endPos.x - rightClickStartPos.x);
          const height = Math.abs(endPos.y - rightClickStartPos.y);
          const left = Math.min(rightClickStartPos.x, endPos.x);
          const top = Math.min(rightClickStartPos.y, endPos.y);
          
          // Ensure minimum size
          const finalWidth = Math.max(width, 20);
          const finalHeight = Math.max(height, 20);
          
          console.log('🔧 [SQUARE DEBUG] TIMEOUT: Calculated dimensions - width:', finalWidth, 'height:', finalHeight);
          console.log('🔧 [SQUARE DEBUG] TIMEOUT: Calculated position - left:', left, 'top:', top);
          
          // Remove the temporary selection box
          removeTemporarySelectionBox();
          
          // createBlueSquare(left, top, finalWidth, finalHeight); // DISABLED - user doesn't want solid blue squares
          
          // Reset state - but keep rightClickDragging true so user can still cancel
          // rightClickDragging = false; // REMOVED - keep dragging state active
          rightClickStartPos = null;
          console.log('🔧 [SQUARE DEBUG] TIMEOUT: Square created, but dragging state kept active for cancellation');
        } else {
          console.log('🔧 [SQUARE DEBUG] TIMEOUT: Recent mouse movement detected, not creating square yet');
          // Restart the timeout
          startSquareCreationTimeout();
        }
      }
    }, 5000); // 5 second timeout - check every 5 seconds
  }
  
  // Function to cancel timeout-based square creation
  function cancelSquareCreationTimeout() {
    if (squareCreationTimeout) {
      clearTimeout(squareCreationTimeout);
      squareCreationTimeout = null;
    }
  }
  
  // Function to properly reset square creation state
  function resetSquareCreationState() {
    rightClickDragging = false;
    rightClickStartPos = null;
    rightClickCount = 0;
    lastRightClickTime = 0;
    leftClickCount = 0;
    lastLeftClickTime = 0;
    if (rightClickTimeout) {
      clearTimeout(rightClickTimeout);
      rightClickTimeout = null;
    }
    if (leftClickTimeout) {
      clearTimeout(leftClickTimeout);
      leftClickTimeout = null;
    }
    cancelSquareCreationTimeout();
    removeTemporarySelectionBox();
  }
  
  // Modify the contextmenu handler to start the timeout
  // Container context menu handler removed - using double right-click detection instead
  
  // Add test function to verify createBlueSquare works
  window.testCreateBlueSquare = function() {
    console.log('🔧 [SQUARE DEBUG] TEST: Testing createBlueSquare function');
    // createBlueSquare(100, 100, 100, 100); // DISABLED - user doesn't want solid blue squares
  };
  
  // Add CTRL key listener to remove light blue square
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Control' || e.ctrlKey) {
      console.log('🔧 [SQUARE DEBUG] CTRL: CTRL key pressed - removing light blue square');
      removeTemporarySelectionBox();
      // Also reset the square creation state when CTRL is pressed
      resetSquareCreationState();
    }
  });
  
  // Test square function removed - no longer needed
  
  
  // Immediate test square creation removed - no longer needed

  // ... existing code ...
});
// ... existing code ...

/**
 * Define pickTypeForCell globally
 */
window.pickTypeForCell = function(cellId, val) {
  console.log('[pickTypeForCell] called with cellId:', cellId, 'val:', val); // DEBUG
  if (!val) {
    console.log('[pickTypeForCell] No value selected, returning');
    return; // Do nothing if no type selected
  }
  const c = graph.getModel().getCell(cellId);
  if (!c) {
    console.log('[pickTypeForCell] No cell found for id', cellId);
    return;
  }

  graph.getModel().beginUpdate();
  try {
    setQuestionType(c, val);
    // DISABLED: Automatic Node ID generation when changing question type
    // Node IDs will only change when manually edited or reset using the button
    
    if (!c._placeholder) {
      c._placeholder = "";
    }
    // Only handle special cases for multi types
    if (val === "multipleTextboxes") {
      c._questionText = "Enter question text";
      c._textboxes = [{ nameId: "", placeholder: "Enter value" }];
      updateMultipleTextboxesCell(c);
    } else if (val === "multipleDropdownType") {
      c._questionText = "Enter question text";
      c._twoNumbers = { first: "0", second: "0" };
      c._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
      updatemultipleDropdownTypeCell(c);
    }
    // For all other types, setQuestionType handles rendering
  } finally {
    graph.getModel().endUpdate();
  }

  graph.setSelectionCell(c);
  graph.startEditingAtCell(c);
  refreshAllCells();
  console.log('[pickTypeForCell] Finished updating cell', c);
};

// Function to refresh all existing multiple dropdown cells with drag handles
window.refreshAllMultipleDropdownCells = function() {
  if (!graph) return;
  
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  
  vertices.forEach(cell => {
    if (getQuestionType(cell) === "multipleDropdownType") {
      console.log('Refreshing multiple dropdown cell:', cell.id);
      updatemultipleDropdownTypeCell(cell);
    }
  });
};

// --- Ensure event handler is attached for all .question-type-dropdown selects (event delegation) ---
document.addEventListener('change', function(e) {
  if (e.target && e.target.classList.contains('question-type-dropdown')) {
    const cellId = e.target.getAttribute('data-cell-id');
    const val = e.target.value;
    // Removed: console.log('[delegated change] .question-type-dropdown changed:', cellId, val); // DEBUG
    if (window.pickTypeForCell) {
      window.pickTypeForCell(cellId, val);
    } else {
      // Removed: console.error('window.pickTypeForCell is not defined!');
    }
  }
});

// Refresh existing multiple dropdown cells after page load
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    if (typeof window.refreshAllMultipleDropdownCells === 'function') {
      window.refreshAllMultipleDropdownCells();
    }
  }, 1000);
});

document.addEventListener('contextmenu', function(e) {
  if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
});

document.addEventListener('DOMContentLoaded', function() {
  // Map legend color box IDs to color picker IDs and colorPreferences keys
  const colorMap = [
    { box: 'colorText', picker: 'colorPickerText', key: 'text' },
    { box: 'colorCheckbox', picker: 'colorPickerCheckbox', key: 'checkbox' },
    { box: 'colorDropdown', picker: 'colorPickerDropdown', key: 'dropdown' },
    { box: 'colorMoney', picker: 'colorPickerMoney', key: 'money' },
    { box: 'colorDate', picker: 'colorPickerDate', key: 'date' },
    { box: 'colorBigParagraph', picker: 'colorPickerBigParagraph', key: 'bigParagraph' },
    { box: 'colorTextColor', picker: 'colorPickerTextColor', key: 'textColor' },
    { box: 'colorDateRange', picker: 'colorPickerDate', key: 'date' }, // Date Range uses date color
    { box: 'colorEmail', picker: 'colorPickerText', key: 'text' },     // Email uses text color
    { box: 'colorPhone', picker: 'colorPickerText', key: 'text' }      // Phone uses text color
  ];

  colorMap.forEach(({ box, picker, key }) => {
    const boxEl = document.getElementById(box);
    const pickerEl = document.getElementById(picker);
    if (boxEl && pickerEl) {
      boxEl.addEventListener('click', function() {
        pickerEl.value = rgbToHex(getComputedStyle(boxEl).backgroundColor);
        pickerEl.click();
      });
      pickerEl.addEventListener('input', function(e) {
        colorPreferences[key] = e.target.value;
        updateLegendColors();
        refreshAllCells();
        saveUserColorPrefs();
      });
    }
  });
});

function previewForm() {
  // Automatically reset PDF inheritance and Node IDs before previewing
  // CORRECT ORDER: PDF inheritance first, then Node IDs (so Node IDs can use correct PDF names)
  console.log('🔄 [PREVIEW RESET] Running automatic PDF and Node ID reset before previewing...');
  
  // Reset PDF inheritance for all nodes FIRST
  if (typeof window.resetAllPdfInheritance === 'function') {
    window.resetAllPdfInheritance();
    console.log('🔄 [PREVIEW RESET] PDF inheritance reset completed before previewing');
  } else {
    console.warn('🔄 [PREVIEW RESET] resetAllPdfInheritance function not available');
  }
  
  // Reset all Node IDs SECOND (after PDF inheritance is fixed)
  if (typeof resetAllNodeIds === 'function') {
    resetAllNodeIds();
    console.log('🔄 [PREVIEW RESET] Node IDs reset completed before previewing');
  } else {
    console.warn('🔄 [PREVIEW RESET] resetAllNodeIds function not available');
  }
  
  // Generate the GUI JSON string (do not download)
  let guiJsonStr = "";
  if (typeof window.exportGuiJson === "function") {
    // exportGuiJson returns the JSON string if called directly
    guiJsonStr = window.exportGuiJson(false);
    if (typeof guiJsonStr !== "string") {
      // If it returned an object, convert to string
      guiJsonStr = JSON.stringify(guiJsonStr, null, 2);
    }
  }
    
  if (guiJsonStr) {
      // Encode the JSON for URL transmission
      const encodedJson = encodeURIComponent(guiJsonStr);
      const guiUrl = `FormWiz%20GUI/gui.html?preview=${encodedJson}`;
      
      // Still copy to clipboard for manual use if needed
    navigator.clipboard.writeText(guiJsonStr).then(() => {
      // Optionally, show a message: copied!
    });
      
      // Open the GUI preview in a new tab with the JSON in the URL
      window.open(guiUrl, '_blank');
    } else {
      // Fallback to regular GUI if no JSON generated
  window.open('FormWiz%20GUI/gui.html', '_blank');
    }
}

// AUTOSAVE FLOWCHART TO COOKIES FEATURE
// --- AUTOSAVE CONSTANTS ---
  // AUTOSAVE_KEY moved to config.js module

// --- AUTOSAVE CORE FUNCTIONS (localStorage version) ---
// Cache for autosave data to avoid unnecessary processing
  // lastAutosaveData and autosaveDataHash moved to config.js module

function autosaveFlowchartToLocalStorage() {
  try {
    if (!graph) {
      return;
    }
    const parent = graph.getDefaultParent();
    const cells = graph.getChildCells(parent, true, true);
    
    // Quick check if data has actually changed
    const currentHash = JSON.stringify({
      cellCount: cells.length,
      sectionPrefs: sectionPrefs,
      groups: groups
    });
    
    if (currentHash === autosaveDataHash && lastAutosaveData) {
      // Data hasn't changed, skip autosave
      return;
    }
    
    const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
    const sectionPrefsCopy = JSON.parse(JSON.stringify(currentSectionPrefs));
    
    // Use the same safe serialization logic as exportFlowchartJson
    const simplifiedCells = cells.map(cell => {
      // Basic info about the cell
      const cellData = {
        id: cell.id,
        vertex: cell.vertex,
        edge: cell.edge,
        value: cell.value,
        style: cleanStyle(cell.style), // Clean the style to remove excessive semicolons
      };

      // Handle geometry 
      if (cell.geometry) {
        cellData.geometry = {
          x: cell.geometry.x,
          y: cell.geometry.y,
          width: cell.geometry.width,
          height: cell.geometry.height,
        };
      }

      // Add source and target for edges
      if (cell.edge && cell.source && cell.target) {
        cellData.source = cell.source.id;
        cellData.target = cell.target.id;
        
        // Save edge geometry (articulation points) if it exists
        if (cell.geometry && cell.geometry.points && cell.geometry.points.length > 0) {
          cellData.edgeGeometry = {
            points: cell.geometry.points.map(point => ({
              x: point.x,
              y: point.y
            }))
          };
        }
      }

      // Custom fields for specific nodes
      if (cell._textboxes) {
        cellData._textboxes = JSON.parse(JSON.stringify(cell._textboxes));
      }
      if (cell._questionText) cellData._questionText = cell._questionText;
      if (cell._twoNumbers) cellData._twoNumbers = cell._twoNumbers;
      if (cell._nameId) cellData._nameId = cell._nameId;
      if (cell._placeholder) cellData._placeholder = cell._placeholder;
      if (cell._questionId) cellData._questionId = cell._questionId;
      if (cell._locationIndex !== undefined) cellData._locationIndex = cell._locationIndex;
      if (cell._locationTitle !== undefined) cellData._locationTitle = cell._locationTitle;
      
      // checkbox properties
      if (cell._checkboxes) {
        cellData._checkboxes = JSON.parse(JSON.stringify(cell._checkboxes));
      }
      if (cell._itemOrder) {
        cellData._itemOrder = JSON.parse(JSON.stringify(cell._itemOrder));
      }
      if (cell._times) {
        cellData._times = JSON.parse(JSON.stringify(cell._times));
      }
      if (cell._dropdowns) {
        cellData._dropdowns = JSON.parse(JSON.stringify(cell._dropdowns));
      }
      
      // textbox properties
      if (cell._amountName) cellData._amountName = cell._amountName;
      if (cell._amountPlaceholder) cellData._amountPlaceholder = cell._amountPlaceholder;
      
      // image option
      if (cell._image) cellData._image = cell._image;
      
      // PDF node properties
      if (cell._pdfName !== undefined) cellData._pdfName = cell._pdfName;
      if (cell._pdfFile !== undefined) cellData._pdfFile = cell._pdfFile;
      if (cell._pdfPrice !== undefined) cellData._pdfPrice = cell._pdfPrice;
      if (cell._pdfLogicEnabled !== undefined) cellData._pdfLogicEnabled = cell._pdfLogicEnabled;
      if (cell._pdfTriggerLimit !== undefined) cellData._pdfTriggerLimit = cell._pdfTriggerLimit;
      
      // Notes node properties
      if (cell._notesText !== undefined) cellData._notesText = cell._notesText;
      if (cell._notesBold !== undefined) cellData._notesBold = cell._notesBold;
      if (cell._notesFontSize !== undefined) cellData._notesFontSize = cell._notesFontSize;
      
      // Checklist node properties
      if (cell._checklistText !== undefined) cellData._checklistText = cell._checklistText;
      
      // Alert node properties
      if (cell._alertText !== undefined) cellData._alertText = cell._alertText;
      
      // Hidden node properties - always save these if they exist on the cell
      if (cell.hasOwnProperty('_hiddenNodeId')) cellData._hiddenNodeId = cell._hiddenNodeId;
      if (cell.hasOwnProperty('_defaultText')) cellData._defaultText = cell._defaultText;
      
      // Linked logic node properties - always save these if they exist on the cell
      if (cell.hasOwnProperty('_linkedLogicNodeId')) {
        cellData._linkedLogicNodeId = cell._linkedLogicNodeId;
      }
      if (cell.hasOwnProperty('_linkedFields')) {
        cellData._linkedFields = cell._linkedFields;
      }
      // Linked checkbox node properties - always save these if they exist on the cell
      if (cell.hasOwnProperty('_linkedCheckboxNodeId')) {
        cellData._linkedCheckboxNodeId = cell._linkedCheckboxNodeId;
      }
      if (cell.hasOwnProperty('_linkedCheckboxOptions')) {
        cellData._linkedCheckboxOptions = cell._linkedCheckboxOptions;
      }
      
      // Special handling for hidden textbox nodes - always save _defaultText even if empty
      if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
        // Always save _defaultText for hidden textbox nodes, even if undefined or empty
        cellData._defaultText = cell._defaultText !== undefined ? cell._defaultText : "";
      }
      
      // calculation node properties
        // Calculation node data export now handled by calc.js
        if (typeof window.isCalculationNode === 'function' && window.isCalculationNode(cell)) {
          if (typeof window.exportCalculationNodeData === 'function') {
            window.exportCalculationNodeData(cell, cellData);
          }
        }
      
      // subtitle & info nodes
      if (cell._subtitleText !== undefined) cellData._subtitleText = cell._subtitleText;
      if (cell._infoText !== undefined) cellData._infoText = cell._infoText;
      
      // checkbox availability
      if (cell._checkboxAvailability !== undefined) cellData._checkboxAvailability = cell._checkboxAvailability;
      
      // big paragraph properties
      if (cell._lineLimit !== undefined) cellData._lineLimit = cell._lineLimit;
      if (cell._characterLimit !== undefined) cellData._characterLimit = cell._characterLimit;
      if (cell._paragraphLimit !== undefined) cellData._paragraphLimit = cell._paragraphLimit;

      return cellData;
    });

    // Get current groups data without updating from DOM
    const groupsArray = [];
    Object.keys(groups).forEach(groupId => {
      // Export all groups, even if they have no sections
      groupsArray.push({
        groupId: parseInt(groupId),
        name: groups[groupId].name,
        sections: groups[groupId].sections
      });
    });
    
    // Get default PDF properties
    const defaultPdfProps = typeof window.getDefaultPdfProperties === 'function' ? 
      window.getDefaultPdfProperties() : { pdfName: "", pdfFile: "", pdfPrice: "" };
    
    // Get form name
    const formName = document.getElementById('formNameInput')?.value || '';
    
    // Get current library flowchart name (if any)
    const libraryFlowchartName = window.currentFlowchartName || null;
    
    const data = {
      cells: simplifiedCells,
      sectionPrefs: sectionPrefsCopy,
      groups: groupsArray,
      defaultPdfProperties: defaultPdfProps,
      formName: formName,
      libraryFlowchartName: libraryFlowchartName,
      edgeStyle: currentEdgeStyle
    };
    
    // Cache the data and hash for next comparison
    lastAutosaveData = data;
    autosaveDataHash = currentHash;
    
    const json = JSON.stringify(data);
    localStorage.setItem(AUTOSAVE_KEY, json);
  } catch (e) {
    // Silently handle errors to avoid performance impact
  }
}

function clearAutosaveLocalStorage() {
  localStorage.removeItem(AUTOSAVE_KEY);
  // Removed: console.log('[AUTOSAVE][localStorage] Cleared autosave.');
}

function getAutosaveFlowchartFromLocalStorage() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  // Removed: console.log('[AUTOSAVE][localStorage][get] Raw value:', raw ? raw.substring(0, 100) : raw);
  if (!raw) {
    // Removed: console.log('[AUTOSAVE][localStorage] No autosave found.');
    return null;
  }
  try {
    const data = JSON.parse(raw);
    // Removed: console.log('[AUTOSAVE][localStorage] Loaded autosave JSON. Length:', raw.length);
    // Removed: console.log('[AUTOSAVE][localStorage] Autosave data has groups:', data.hasOwnProperty('groups'));
    if (data.groups) {
      // Removed: console.log('[AUTOSAVE][localStorage] Groups data:', data.groups);
    }
    return data;
  } catch (e) {
    // Removed: console.log('[AUTOSAVE][localStorage] Error parsing autosave:', e);
    return null;
  }
}

// --- AUTOSAVE HOOKS ---
  // autosaveTimeout, autosaveThrottleDelay, lastAutosaveTime, and autosaveMinInterval moved to config.js module

// Test function to check current cell state
window.testCellState = function(cellId) {
  console.log('🔧 [TEST DEBUG] Testing cell state for cellId:', cellId);
  const cell = graph.getModel().getCell(cellId);
  if (cell) {
    console.log('🔧 [TEST DEBUG] Cell found:', cell);
    console.log('🔧 [TEST DEBUG] Cell _textboxes:', cell._textboxes);
    if (cell._textboxes && cell._textboxes[0]) {
      console.log('🔧 [TEST DEBUG] First textbox isAmountOption:', cell._textboxes[0].isAmountOption);
    }
  } else {
    console.log('🔧 [TEST DEBUG] Cell not found!');
  }
};

// Test function to manually toggle amount option
window.testToggleAmount = function(cellId, index, checked) {
  console.log('🔧 [TEST DEBUG] Manually toggling amount for cellId:', cellId, 'index:', index, 'checked:', checked);
  if (typeof window.toggleMultipleDropdownAmount === 'function') {
    window.toggleMultipleDropdownAmount(cellId, index, checked);
  } else {
    console.log('🔧 [TEST DEBUG] ERROR: toggleMultipleDropdownAmount function not found!');
  }
};

window.testToggleTextboxAmount = function(cellId, index, checked) {
  console.log('🔧 [TEST DEBUG] Manually toggling textbox amount for cellId:', cellId, 'index:', index, 'checked:', checked);
  if (typeof window.toggleMultipleTextboxAmount === 'function') {
    window.toggleMultipleTextboxAmount(cellId, index, checked);
  } else {
    console.log('🔧 [TEST DEBUG] ERROR: toggleMultipleTextboxAmount function not found!');
  }
};

// Test function to check if functions are available
window.testFunctionAvailability = function() {
  console.log('🔧 [FUNCTION TEST] Testing function availability:');
  console.log('🔧 [FUNCTION TEST] toggleMultipleDropdownAmount:', typeof window.toggleMultipleDropdownAmount);
  console.log('🔧 [FUNCTION TEST] toggleMultipleTextboxAmount:', typeof window.toggleMultipleTextboxAmount);
  console.log('🔧 [FUNCTION TEST] requestAutosave:', typeof window.requestAutosave);
  console.log('🔧 [FUNCTION TEST] updatemultipleDropdownTypeCell:', typeof window.updatemultipleDropdownTypeCell);
  console.log('🔧 [FUNCTION TEST] updateMultipleTextboxesCell:', typeof window.updateMultipleTextboxesCell);
  console.log('🔧 [FUNCTION TEST] getQuestionType:', typeof window.getQuestionType);
};

// Global click handler to debug checkbox clicks
document.addEventListener('click', function(e) {
  
  if (e.target.type === 'checkbox') {
    
    if (e.target.closest('.textbox-entry')) {
      
      // Try to extract cell ID and index from the onclick attribute
      const onclick = e.target.getAttribute('onclick');
      
      if (onclick && onclick.includes('toggleMultipleDropdownAmount')) {
        // Extract cell ID and index using regex
        const match = onclick.match(/toggleMultipleDropdownAmount\('([^']+)',\s*(\d+),\s*this\.checked\)/);
        if (match) {
          const cellId = match[1];
          const index = parseInt(match[2]);
          
          // Check current state before toggling
          window.testCellState(cellId);
          
          // Manually call the function
          if (typeof window.toggleMultipleDropdownAmount === 'function') {
            window.toggleMultipleDropdownAmount(cellId, index, e.target.checked);
          }
          
          // Check state after toggling
          setTimeout(() => {
            window.testCellState(cellId);
          }, 100);
        }
      }
    }
  }
});

// Also add a mousedown listener to catch checkbox interactions earlier
document.addEventListener('mousedown', function(e) {
  if (e.target.type === 'checkbox') {
    console.log('🔧 [MOUSEDOWN DEBUG] Checkbox mousedown:', e.target);
    console.log('🔧 [MOUSEDOWN DEBUG] Checkbox checked before:', e.target.checked);
  }
});

// Add a change listener to catch checkbox state changes
document.addEventListener('change', function(e) {
  if (e.target.type === 'checkbox') {
    console.log('🔧 [CHANGE DEBUG] Checkbox changed:', e.target);
    console.log('🔧 [CHANGE DEBUG] Checkbox checked after:', e.target.checked);
    console.log('🔧 [CHANGE DEBUG] Checkbox onclick:', e.target.getAttribute('onclick'));
    
    // If this is an amount checkbox, manually call the function
    if (e.target.closest('.textbox-entry')) {
      const onclick = e.target.getAttribute('onclick');
      if (onclick && onclick.includes('toggleMultipleDropdownAmount')) {
        console.log('🔧 [CHANGE DEBUG] Manually executing onclick for dropdown amount checkbox');
        try {
          // Extract and call the function manually
          const match = onclick.match(/toggleMultipleDropdownAmount\('([^']+)',\s*(\d+),\s*this\.checked\)/);
          if (match) {
            const cellId = match[1];
            const index = parseInt(match[2]);
            console.log('🔧 [CHANGE DEBUG] Manually calling toggleMultipleDropdownAmount with cellId:', cellId, 'index:', index, 'checked:', e.target.checked);
            
            if (typeof window.toggleMultipleDropdownAmount === 'function') {
              window.toggleMultipleDropdownAmount(cellId, index, e.target.checked);
            } else {
              console.log('🔧 [CHANGE DEBUG] ERROR: toggleMultipleDropdownAmount function not found!');
            }
          }
        } catch (error) {
          console.log('🔧 [CHANGE DEBUG] Error executing onclick:', error);
        }
      } else if (onclick && onclick.includes('toggleMultipleTextboxAmount')) {
        console.log('🔧 [CHANGE DEBUG] Manually executing onclick for textbox amount checkbox');
        try {
          // Extract and call the function manually
          const match = onclick.match(/toggleMultipleTextboxAmount\('([^']+)',\s*(\d+),\s*this\.checked\)/);
          if (match) {
            const cellId = match[1];
            const index = parseInt(match[2]);
            console.log('🔧 [CHANGE DEBUG] Manually calling toggleMultipleTextboxAmount with cellId:', cellId, 'index:', index, 'checked:', e.target.checked);
            
            if (typeof window.toggleMultipleTextboxAmount === 'function') {
              window.toggleMultipleTextboxAmount(cellId, index, e.target.checked);
            } else {
              console.log('🔧 [CHANGE DEBUG] ERROR: toggleMultipleTextboxAmount function not found!');
            }
          }
        } catch (error) {
          console.log('🔧 [CHANGE DEBUG] Error executing onclick:', error);
        }
      }
    }
  }
});

// Global helper to request a throttled autosave from anywhere (including Groups UI)
function requestAutosave() {
  try {
    const now = Date.now();
    
    // Prevent too frequent autosaves
    if (now - lastAutosaveTime < autosaveMinInterval) {
      return;
    }
    
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
    }
    autosaveTimeout = setTimeout(() => {
      autosaveFlowchartToLocalStorage();
      autosaveTimeout = null;
      lastAutosaveTime = Date.now();
    }, autosaveThrottleDelay);
  } catch (e) {
    // Fallback to immediate autosave if throttling fails
    autosaveFlowchartToLocalStorage();
    lastAutosaveTime = Date.now();
  }
}

function setupAutosaveHooks() {
  if (!graph) return;
  
  // Throttled autosave function - optimized for large flowcharts
  function throttledAutosave() {
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
    }
    
    // Use longer delay for large flowcharts
    const cellCount = graph.getChildVertices(graph.getDefaultParent()).length;
    const delay = cellCount > 50 ? autosaveThrottleDelay * 1.5 : autosaveThrottleDelay;
    
    autosaveTimeout = setTimeout(() => {
      autosaveFlowchartToLocalStorage();
      autosaveTimeout = null;
    }, delay);
  }
  
  // Save after any model change (throttled)
  graph.getModel().addListener(mxEvent.CHANGE, function() {
    throttledAutosave();
  });
  
  // Save after refreshAllCells (in case of programmatic changes) - throttled
  const origRefreshAllCells = window.refreshAllCells;
  window.refreshAllCells = function() {
    origRefreshAllCells.apply(this, arguments);
    throttledAutosave();
  };
  
  // Save after loadFlowchartData (delayed to ensure groups are loaded)
  const origLoadFlowchartData = window.loadFlowchartData;
  window.loadFlowchartData = function(data) {
    // Set flag to prevent automatic Node ID regeneration during loading
    window._isLoadingFlowchart = true;
    
    origLoadFlowchartData.apply(this, arguments);
    
    // Apply groups from imported JSON if present
    if (data && Array.isArray(data.groups)) {
      if (typeof window.loadGroupsFromData === 'function') {
        window.loadGroupsFromData(data.groups);
        console.log('Groups loaded from data:', data.groups);
      } else {
        window.pendingGroupsData = data.groups;
      }
    }
    
    // Ensure section legend is updated after import
    if (data && data.sectionPrefs) {
      console.log('ðŸ” [SCRIPT DEBUG] Autosave hook detected sectionPrefs, scheduling updateSectionLegend...');
      setTimeout(() => {
        console.log('ðŸ” [SCRIPT DEBUG] Autosave hook calling updateSectionLegend after 100ms delay...');
        if (typeof window.updateSectionLegend === 'function') {
          window.updateSectionLegend();
          console.log('ðŸ” [SCRIPT DEBUG] Autosave hook: Section legend updated after import');
        } else {
          console.error('âŒ [SCRIPT DEBUG] Autosave hook: updateSectionLegend function not available!');
        }
      }, 100); // Small delay to ensure DOM is ready
    }
    
    // Automatically reset PDF inheritance and Node IDs after flowchart loading
    // Note: This runs after the internal loadFlowchartData processes:
    // - 500ms: PDF properties propagation
    // - 1000ms: Node ID validation and correction
    // - 3000ms: Our automatic reset (after all internal processes complete)
    // CORRECT ORDER: PDF inheritance first, then Node IDs (so Node IDs can use correct PDF names)
    setTimeout(() => {
      // Reset PDF inheritance for all nodes FIRST
      if (typeof window.resetAllPdfInheritance === 'function') {
        window.resetAllPdfInheritance();
      }
      
      // Reset all Node IDs SECOND (after PDF inheritance is fixed)
      if (typeof resetAllNodeIds === 'function') {
        resetAllNodeIds();
      }
    }, 3000); // Increased delay to ensure all internal loading processes are complete
    
    // Delay autosave to ensure groups are loaded
    setTimeout(() => {
      console.log('Autosaving after loadFlowchartData, current groups:', groups);
      // Get library flowchart name from global variable (set by loadFlowchartData)
      const libraryName = window._loadingLibraryFlowchartName;
      // Set currentFlowchartName before autosave if we're loading from library
      if (libraryName) {
        window.currentFlowchartName = libraryName;
      }
      autosaveFlowchartToLocalStorage();
      // Clear the global variable after autosave
      window._loadingLibraryFlowchartName = null;
    }, 1000); // Increased delay to ensure groups are fully processed
    
    // Clear the loading flag after all loading processes are complete
    setTimeout(() => {
      window._isLoadingFlowchart = false;
    }, 4000); // Clear flag after all loading processes (including the 3000ms automatic reset)
  };
  
  // Removed: console.log('[AUTOSAVE][localStorage] Autosave hooks set up with throttling.');
}

// --- AUTOSAVE RESTORE PROMPT ---
function showAutosaveRestorePrompt() {
  let modal = document.createElement('div');
  modal.id = 'autosaveRestoreModal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';

  let box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '32px 40px';
  box.style.borderRadius = '12px';
  box.style.boxShadow = '0 4px 32px rgba(0,0,0,0.18)';
  box.style.textAlign = 'center';
  box.innerHTML = `<h2>Pick up where you left off?</h2><p>We found an autosaved flowchart. Would you like to continue editing it?</p>`;

  let yesBtn = document.createElement('button');
  yesBtn.textContent = 'Yes';
  yesBtn.style.margin = '12px 24px 0 0';
  yesBtn.style.padding = '10px 28px';
  yesBtn.style.fontSize = '1.1em';
  yesBtn.style.borderRadius = '6px';
  yesBtn.style.background = '#1976d2';
  yesBtn.style.color = '#fff';
  yesBtn.style.border = 'none';
  yesBtn.style.cursor = 'pointer';

  let noBtn = document.createElement('button');
  noBtn.textContent = 'No';
  noBtn.style.margin = '12px 0 0 0';
  noBtn.style.padding = '10px 28px';
  noBtn.style.fontSize = '1.1em';
  noBtn.style.borderRadius = '6px';
  noBtn.style.background = '#bbb';
  noBtn.style.color = '#222';
  noBtn.style.border = 'none';
  noBtn.style.cursor = 'pointer';

  yesBtn.onclick = function() {
    modal.remove();
    const data = getAutosaveFlowchartFromLocalStorage();
    if (data) {
      
      // Check if this was a library flowchart and handle it specially
      if (data.libraryFlowchartName && typeof window.openSavedFlowchart === 'function') {
        
        // Show alert to user
        alert(`Opening ${data.libraryFlowchartName} from library`);
        
        // Set the current flowchart name first
        window.currentFlowchartName = data.libraryFlowchartName;
        
        // Open the library flowchart directly (this will load the latest version from the library)
        window.openSavedFlowchart(data.libraryFlowchartName);
        
        // Wait for groups to be loaded before setting up autosave hooks
        setTimeout(safeSetupAutosaveHooks, 1000);
      } else {
        // Handle regular autosave restore (non-library flowchart)
        window.loadFlowchartData(data);
        
        // Restore form name if it exists
        if (data.formName) {
          const formNameInput = document.getElementById('formNameInput');
          if (formNameInput) {
            formNameInput.value = data.formName;
          }
        }
        
        // Wait for groups to be loaded before setting up autosave hooks
        setTimeout(safeSetupAutosaveHooks, 1000);
      }
    } else {
      setTimeout(safeSetupAutosaveHooks, 500);
    }
  };
  noBtn.onclick = function() {
    modal.remove();
    clearAutosaveLocalStorage();
    window.location.reload();
    // Removed: console.log('[AUTOSAVE][localStorage] User chose NO: cleared autosave and reloaded.');
  };

  box.appendChild(yesBtn);
  box.appendChild(noBtn);
  modal.appendChild(box);
  document.body.appendChild(modal);
  
  // Add click outside to close functionality
  modal.addEventListener('click', function(event) {
    if (event.target === modal) {
      // User clicked on the modal background (outside the box)
      modal.remove();
      clearAutosaveLocalStorage();
      window.location.reload();
    }
  });
  
  // Removed: console.log('[AUTOSAVE][localStorage] Restore prompt shown.');
}

// --- INIT AUTOSAVE ON PAGE LOAD ---
let autosaveHooksSetup = false;
function safeSetupAutosaveHooks() {
  if (!autosaveHooksSetup) {
    setupAutosaveHooks();
    autosaveHooksSetup = true;
  }
}
document.addEventListener('DOMContentLoaded', function() {
  const autosaveData = getAutosaveFlowchartFromLocalStorage();
  if (autosaveData && autosaveData.cells && autosaveData.cells.length > 0) {
    showAutosaveRestorePrompt();
  } else {
    setTimeout(safeSetupAutosaveHooks, 1000);
  }
});

// --- COPY/PASTE NODE AS JSON ---
  // flowchartClipboard, FLOWCHART_CLIPBOARD_KEY, and FLOWCHART_CLIPBOARD_TIMESTAMP_KEY moved to config.js module

function copySelectedNodeAsJson() {
  // Add debugging to track duplicate calls
  const stack = new Error().stack;
  console.log('🔍 [COPY DEBUG] copySelectedNodeAsJson called from:', stack.split('\n')[1]);
  
  try {
    const cells = graph.getSelectionCells();
    if (!cells || cells.length === 0) {
      console.log('No cells selected');
      return;
    }
  
    // Separate vertices (nodes) and edges
    const nodes = cells.filter(cell => cell.vertex);
    let edges = cells.filter(cell => cell.edge);
    
    console.log('Total selected cells:', cells.length);
    console.log('Selected nodes (vertex):', nodes.length);
    console.log('Selected edges (edge):', edges.length);
    console.log('All selected cells:', cells.map(c => ({ id: c.id, vertex: c.vertex, edge: c.edge })));
    
    // If no nodes are selected, we can't copy anything meaningful
    if (nodes.length === 0) {
      console.log('No nodes selected for copying');
      return;
    }
    
    // Get all node IDs for edge detection
    const selectedNodeIds = new Set(nodes.map(node => node.id));
    
    // Find all edges that connect selected nodes (even if not explicitly selected)
    const allEdges = graph.getModel().getEdges();
    console.log('All edges in graph:', allEdges.length);
    console.log('Sample edges:', allEdges.slice(0, 3).map(e => ({ 
      id: e.id, 
      source: e.source ? e.source.id : null, 
      target: e.target ? e.target.id : null,
      vertex: e.vertex,
      edge: e.edge
    })));
    
    const connectingEdges = allEdges.filter(edge => {
      const sourceId = edge.source ? edge.source.id : null;
      const targetId = edge.target ? edge.target.id : null;
      const connectsSelected = selectedNodeIds.has(sourceId) && selectedNodeIds.has(targetId);
      if (connectsSelected) {
        console.log('Found connecting edge:', edge.id, 'from', sourceId, 'to', targetId);
      }
      return connectsSelected;
    });
    
    // Debug logging for edge detection
    console.log('Selected nodes:', Array.from(selectedNodeIds));
    console.log('All edges in graph:', allEdges.length);
    console.log('Connecting edges found:', connectingEdges.length);
    console.log('Explicitly selected edges:', edges.length);
    
    // Combine explicitly selected edges with connecting edges
    const allSelectedEdges = new Set([...edges, ...connectingEdges]);
    edges = Array.from(allSelectedEdges);
    
    // Calculate the bounding box of all selected nodes to determine the center
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(cell => {
      if (cell.geometry) {
        minX = Math.min(minX, cell.geometry.x);
        minY = Math.min(minY, cell.geometry.y);
        maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
        maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
      }
    });
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Create a map of old IDs to new IDs for edge reconstruction
    const idMap = {};
    const newIds = [];
    
    // Prepare node data with relative positioning
    const nodeData = nodes.map(cell => {
      const cellData = {};
      
      // Only copy specific properties we need, avoiding circular references
      const safeProperties = [
        'id', 'value', 'style', 'section', '_questionText', '_textboxes', '_twoNumbers', 
        '_nameId', '_placeholder', '_questionId', '_image', '_calcTitle', '_calcAmountLabel',
        '_calcOperator', '_calcThreshold', '_calcFinalText', '_calcTerms', '_subtitleText',
              '_infoText', '_amountName', '_amountPlaceholder', '_notesText', '_notesBold', '_notesFontSize',
      '_checklistText', '_alertText', '_pdfName', '_pdfFile', '_pdfPrice', '_hiddenNodeId', '_defaultText', '_linkedLogicNodeId', '_linkedFields', '_linkedCheckboxNodeId', '_linkedCheckboxOptions', '_pdfLogicEnabled', '_pdfTriggerLimit', '_bigParagraphPdfName', '_bigParagraphPdfFile', '_bigParagraphPdfPrice', '_locationIndex', '_checkboxes', '_itemOrder', '_times', '_dropdowns'
      ];
      
      safeProperties.forEach(prop => {
        if (cell.hasOwnProperty(prop) && cell[prop] !== undefined) {
          cellData[prop] = cell[prop];
        }
      });
      
      // Store the original ID for edge mapping
      const originalId = cell.id;
      const newId = "node_" + Date.now() + "_" + Math.floor(Math.random() * 10000) + "_" + newIds.length;
      idMap[originalId] = newId;
      newIds.push(newId);
      cellData.originalId = originalId;
      cellData.newId = newId;
      
      // Calculate relative position from center
      if (cell.geometry) {
        cellData.geometry = {
          x: cell.geometry.x - centerX,
          y: cell.geometry.y - centerY,
          width: cell.geometry.width,
          height: cell.geometry.height
        };
      }
      return cellData;
    });
    
    // Prepare edge data with updated source/target IDs
    const edgeData = edges.map(cell => {
      const cellData = {};
      
      // Only copy specific edge properties we need, avoiding circular references
      const safeEdgeProperties = [
        'id', 'value', 'style', 'geometry'
      ];
      
      safeEdgeProperties.forEach(prop => {
        if (cell.hasOwnProperty(prop) && cell[prop] !== undefined) {
          cellData[prop] = cell[prop];
        }
      });
      
      // Update source and target IDs to use the new node IDs
      if (cell.source && idMap[cell.source.id]) {
        cellData.sourceId = idMap[cell.source.id];
      }
      if (cell.target && idMap[cell.target.id]) {
        cellData.targetId = idMap[cell.target.id];
      }
      
      return cellData;
    });
    
    console.log('Copy operation - Nodes:', nodes.length, 'Edges found:', edges.length, 'Edge data:', edgeData.length);
    
    // Collect section preferences from the copied nodes
    const copiedSectionPrefs = {};
    const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
    nodes.forEach(cell => {
      const section = cell.section || "1";
      if (currentSectionPrefs[section]) {
        copiedSectionPrefs[section] = {
          name: currentSectionPrefs[section].name,
          borderColor: currentSectionPrefs[section].borderColor
        };
      }
    });
    
    // Create the complete clipboard data
    const clipboardData = {
      nodes: nodeData,
      edges: edgeData,
      centerX: centerX,
      centerY: centerY,
      isMultiCopy: true,
      sectionPrefs: copiedSectionPrefs
    };
    
    const jsonData = JSON.stringify(clipboardData);
    const timestamp = Date.now();
    
    // Store in localStorage for cross-tab functionality
    localStorage.setItem(FLOWCHART_CLIPBOARD_KEY, jsonData);
    localStorage.setItem(FLOWCHART_CLIPBOARD_TIMESTAMP_KEY, timestamp.toString());
    
    // Also keep in memory for same-tab functionality
    flowchartClipboard = jsonData;
    
    // Copy to system clipboard as well
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonData).then(() => {
        console.log('Nodes copied to clipboard and localStorage');
      }).catch(err => {
        console.log('Failed to copy to system clipboard:', err);
      });
    }
    
    // Show feedback to user
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    showCopyFeedback(nodeCount, edgeCount);
  } catch (error) {
    console.error('Error in copySelectedNodeAsJson:', error);
    throw error;
  }
}

window.pasteNodeFromJson = function(x, y) {
  // Prevent multiple simultaneous paste operations
  if (window._isPasting) {
    return;
  }
  window._isPasting = true;
  
  // Try to get data from localStorage first (for cross-tab functionality)
  let clipboardData = localStorage.getItem(FLOWCHART_CLIPBOARD_KEY);
  let timestamp = localStorage.getItem(FLOWCHART_CLIPBOARD_TIMESTAMP_KEY);
  
  // If no localStorage data, fall back to memory clipboard
  if (!clipboardData && flowchartClipboard) {
    clipboardData = flowchartClipboard;
  }
  
  if (!clipboardData) {
    // Try to get from system clipboard as last resort
    navigator.clipboard.readText().then(text => {
      try {
        JSON.parse(text); // Validate it's JSON
        pasteNodeFromJsonData(text, x, y);
      } catch (e) {
        alert("No valid node data found in clipboard");
        window._isPasting = false; // Clear flag on error
      }
    }).catch(err => {
      alert("No node data found to paste");
      window._isPasting = false; // Clear flag on error
    });
    return;
  }
  
  pasteNodeFromJsonData(clipboardData, x, y);
}

function pasteNodeFromJsonData(clipboardData, x, y) {
  let data;
  try {
    data = JSON.parse(clipboardData);
  } catch (e) {
    alert("Clipboard data is invalid");
    window._isPasting = false; // Clear flag on error
    return;
  }
  
  const parent = graph.getDefaultParent();
  graph.getModel().beginUpdate();
  
  try {
    // Handle new multi-copy format
    if (data.isMultiCopy && data.nodes) {
      // Use provided position or default to center of viewport
      const pasteX = typeof x === "number" ? x : (data.centerX || 100);
      const pasteY = typeof y === "number" ? y : (data.centerY || 100);
      
      // Create a map to store new cell instances
      const newCells = {};
      
      // First, create all nodes
      data.nodes.forEach((nodeData) => {
        // Calculate absolute position based on relative position and paste location
        const absX = pasteX + (nodeData.geometry?.x || 0);
        const absY = pasteY + (nodeData.geometry?.y || 0);
        
        const geo = new mxGeometry(
          absX, 
          absY, 
          nodeData.geometry?.width || 160, 
          nodeData.geometry?.height || 80
        );
        
        const newCell = new mxCell(nodeData.value, geo, nodeData.style);
        newCell.vertex = true;
        newCell.id = nodeData.newId;
        
        // Copy custom fields
        ["_textboxes","_questionText","_twoNumbers","_nameId","_placeholder","_questionId","_image","_pdfName","_pdfFile","_pdfPrice","_notesText","_notesBold","_notesFontSize","_checklistText","_alertText","_calcTitle","_calcAmountLabel","_calcOperator","_calcThreshold","_calcFinalText","_calcTerms","_subtitleText","_infoText","_amountName","_amountPlaceholder","_hiddenNodeId","_defaultText","_linkedLogicNodeId","_linkedFields","_linkedCheckboxNodeId","_linkedCheckboxOptions","_pdfLogicEnabled","_pdfTriggerLimit","_bigParagraphPdfName","_bigParagraphPdfFile","_bigParagraphPdfPrice","_locationIndex","_checkboxes","_itemOrder","_times","_dropdowns"].forEach(k => {
          if (nodeData[k] !== undefined) newCell[k] = nodeData[k];
        });
        
        // Section
        if (nodeData.section !== undefined) newCell.section = nodeData.section;
        
        // Insert into graph
        graph.addCell(newCell, parent);
        newCells[nodeData.newId] = newCell;
        
        // Update rendering for special node types
        if (getQuestionType(newCell) === "imageOption") {
          updateImageOptionCell(newCell);
        } else if (getQuestionType(newCell) === "notesNode") {
          updateNotesNodeCell(newCell);
        } else if (getQuestionType(newCell) === "checklistNode") {
          updateChecklistNodeCell(newCell);
        } else if (getQuestionType(newCell) === "alertNode") {
          updateAlertNodeCell(newCell);
        } else if (isPdfNode(newCell)) {
          updatePdfNodeCell(newCell);
        } else if (isOptions(newCell)) {
          // DISABLED: Automatic Node ID regeneration during node creation
          // Node IDs will only change when manually edited or reset using the button
        } else if (isCalculationNode && typeof isCalculationNode === "function" && isCalculationNode(newCell)) {
          if (typeof updateCalculationNodeCell === "function") updateCalculationNodeCell(newCell);
        }
        
        // Handle hidden node copy/paste
        if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(newCell)) {
          // Update hidden checkbox node display
          if (typeof window.updateHiddenCheckboxNodeCell === 'function') {
            window.updateHiddenCheckboxNodeCell(newCell);
          }
        } else if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(newCell)) {
          // Update hidden textbox node display
          if (typeof window.updateHiddenTextboxNodeCell === 'function') {
            window.updateHiddenTextboxNodeCell(newCell);
          }
        } else if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(newCell)) {
          // Update linked logic node display
          if (typeof window.updateLinkedLogicNodeCell === 'function') {
            window.updateLinkedLogicNodeCell(newCell);
          }
        } else if (typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(newCell)) {
          // Update linked checkbox node display
          if (typeof window.updateLinkedCheckboxNodeCell === 'function') {
            window.updateLinkedCheckboxNodeCell(newCell);
          }
        }
      });
      
      // Then, create all edges
      if (data.edges) {
        console.log('Paste operation - Creating', data.edges.length, 'edges');
        data.edges.forEach((edgeData, index) => {
          const sourceCell = newCells[edgeData.sourceId];
          const targetCell = newCells[edgeData.targetId];
          
          if (sourceCell && targetCell) {
            // Use the proper insertEdge method instead of manual creation
            const newEdge = graph.insertEdge(parent, null, edgeData.value || "", sourceCell, targetCell, edgeData.style);
            
            // Apply current edge style if no style is provided
            if (!edgeData.style || edgeData.style === "") {
              let edgeStyle;
              if (currentEdgeStyle === 'curved') {
                edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
              } else if (currentEdgeStyle === 'straight') {
                edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;";
              } else if (currentEdgeStyle === 'direct') {
                edgeStyle = "edgeStyle=none;rounded=0;orthogonalLoop=0;jettySize=auto;html=1;";
              } else {
                edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
              }
              graph.getModel().setStyle(newEdge, edgeStyle);
            }
            
            // Copy edge properties if they exist
            if (edgeData.geometry) {
              newEdge.geometry = new mxGeometry(
                edgeData.geometry.x || 0,
                edgeData.geometry.y || 0,
                edgeData.geometry.width || 0,
                edgeData.geometry.height || 0
              );
            }
            
            console.log('Edge created successfully:', newEdge.id);
          } else {
            console.log('Failed to create edge - missing source or target');
          }
        });
      } else {
        console.log('No edges data found in clipboard');
      }
      
      // Merge section preferences from clipboard with current ones
      if (data.sectionPrefs) {
        const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
        Object.keys(data.sectionPrefs).forEach(sectionNum => {
          const clipboardSection = data.sectionPrefs[sectionNum];
          // Always use the clipboard section data (prioritize updated names)
          currentSectionPrefs[sectionNum] = {
            name: clipboardSection.name,
            borderColor: clipboardSection.borderColor
          };
        });
        // Update the section preferences in the proper location
        if (window.flowchartConfig) {
          window.flowchartConfig.sectionPrefs = currentSectionPrefs;
        } else {
          window.sectionPrefs = currentSectionPrefs;
        }
        
        // Update the section legend to reflect the new sections
        if (typeof updateSectionLegend === 'function') {
          updateSectionLegend();
        }
      }
      
      // Show feedback with counts
      const nodeCount = data.nodes.length;
      const edgeCount = data.edges ? data.edges.length : 0;
      showPasteFeedback(nodeCount, edgeCount);
      
    } else {
      // Handle legacy single-node format (backward compatibility)
      let legacyData = Array.isArray(data) ? data : [data];
      
      legacyData.forEach((cellData, idx) => {
        // Assign a new ID
        cellData.id = "node_" + Date.now() + "_" + Math.floor(Math.random() * 10000) + "_" + idx;
        // Offset geometry for each pasted node
        let dx = 40 * idx;
        let dy = 40 * idx;
        let px = (typeof x === "number" ? x : (cellData.geometry?.x || 100)) + dx;
        let py = (typeof y === "number" ? y : (cellData.geometry?.y || 100)) + dy;
        const geo = new mxGeometry(px, py, cellData.geometry?.width || 160, cellData.geometry?.height || 80);
        const newCell = new mxCell(cellData.value, geo, cellData.style);
        newCell.vertex = true;
        // Copy custom fields
        ["_textboxes","_questionText","_twoNumbers","_nameId","_placeholder","_questionId","_image","_pdfName","_pdfFile","_pdfPrice","_notesText","_notesBold","_notesFontSize","_checklistText","_alertText","_calcTitle","_calcAmountLabel","_calcOperator","_calcThreshold","_calcFinalText","_calcTerms","_subtitleText","_infoText","_amountName","_amountPlaceholder","_hiddenNodeId","_defaultText","_linkedLogicNodeId","_linkedFields","_linkedCheckboxNodeId","_linkedCheckboxOptions","_pdfLogicEnabled","_pdfTriggerLimit","_bigParagraphPdfName","_bigParagraphPdfFile","_bigParagraphPdfPrice","_locationIndex","_checkboxes","_itemOrder","_times","_dropdowns"].forEach(k => {
          if (cellData[k] !== undefined) newCell[k] = cellData[k];
        });
        // Section
        if (cellData.section !== undefined) newCell.section = cellData.section;
        // Insert into graph
        graph.addCell(newCell, parent);
        // If image option, update rendering
        if (getQuestionType(newCell) === "imageOption") {
          updateImageOptionCell(newCell);
        } else if (getQuestionType(newCell) === "notesNode") {
          updateNotesNodeCell(newCell);
        } else if (getQuestionType(newCell) === "checklistNode") {
          updateChecklistNodeCell(newCell);
        } else if (getQuestionType(newCell) === "alertNode") {
          updateAlertNodeCell(newCell);
        } else if (isPdfNode(newCell)) {
          updatePdfNodeCell(newCell);
        } else if (isOptions(newCell)) {
          // DISABLED: Automatic Node ID regeneration during node creation
          // Node IDs will only change when manually edited or reset using the button
        } else if (isCalculationNode && typeof isCalculationNode === "function" && isCalculationNode(newCell)) {
          // FIRST OCCURRENCE - Calculation node copy/paste now handled by calc.js
          if (typeof window.handleCalculationNodeCopyPaste === "function") {
            window.handleCalculationNodeCopyPaste(newCell);
          }
        }
        
        // Handle hidden node copy/paste
        if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(newCell)) {
          // Update hidden checkbox node display
          if (typeof window.updateHiddenCheckboxNodeCell === 'function') {
            window.updateHiddenCheckboxNodeCell(newCell);
          }
        } else if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(newCell)) {
          // Update hidden textbox node display
          if (typeof window.updateHiddenTextboxNodeCell === 'function') {
            window.updateHiddenTextboxNodeCell(newCell);
          }
        } else if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(newCell)) {
          // Update linked logic node display
          if (typeof window.updateLinkedLogicNodeCell === 'function') {
            window.updateLinkedLogicNodeCell(newCell);
          }
        } else if (typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(newCell)) {
          // Update linked checkbox node display
          if (typeof window.updateLinkedCheckboxNodeCell === 'function') {
            window.updateLinkedCheckboxNodeCell(newCell);
          }
        }
      });
      
      // Merge section preferences from clipboard with current ones (for legacy format)
      if (data.sectionPrefs) {
        const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
        Object.keys(data.sectionPrefs).forEach(sectionNum => {
          const clipboardSection = data.sectionPrefs[sectionNum];
          // Always use the clipboard section data (prioritize updated names)
          currentSectionPrefs[sectionNum] = {
            name: clipboardSection.name,
            borderColor: clipboardSection.borderColor
          };
        });
        // Update the section preferences in the proper location
        if (window.flowchartConfig) {
          window.flowchartConfig.sectionPrefs = currentSectionPrefs;
        } else {
          window.sectionPrefs = currentSectionPrefs;
        }
        
        // Update the section legend to reflect the new sections
        if (typeof updateSectionLegend === 'function') {
          updateSectionLegend();
        }
      }
      
      showPasteFeedback(legacyData.length, 0);
    }
    
  } finally {
    graph.getModel().endUpdate();
  }
  
  // Clear the paste flag
  window._isPasting = false;
  
  // Correct Node IDs for pasted nodes to follow proper naming scheme
  setTimeout(() => {
    if (typeof window.correctNodeIdsAfterImport === 'function') {
      window.correctNodeIdsAfterImport();
    }
  }, 100);
  
  refreshAllCells();
}

// Add visual feedback for copy/paste operations
function showCopyFeedback(nodeCount = 1, edgeCount = 0) {
  const feedback = document.createElement('div');
  let message = '';
  if (nodeCount === 1 && edgeCount === 0) {
    message = 'Node copied! Available in other tabs.';
  } else if (nodeCount > 1 && edgeCount === 0) {
    message = `${nodeCount} nodes copied! Available in other tabs.`;
  } else if (nodeCount > 1 && edgeCount > 0) {
    message = `${nodeCount} nodes and ${edgeCount} connections copied! Available in other tabs.`;
  } else {
    message = 'Selection copied! Available in other tabs.';
  }
  
  feedback.textContent = message;
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    feedback.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

function showPasteFeedback(nodeCount = 1, edgeCount = 0) {
  const feedback = document.createElement('div');
  let message = '';
  if (nodeCount === 1 && edgeCount === 0) {
    message = 'Node pasted successfully!';
  } else if (nodeCount > 1 && edgeCount === 0) {
    message = `${nodeCount} nodes pasted successfully!`;
  } else if (nodeCount > 1 && edgeCount > 0) {
    message = `${nodeCount} nodes and ${edgeCount} connections pasted successfully!`;
  } else {
    message = 'Selection pasted successfully!';
  }
  
  feedback.textContent = message;
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2196F3;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    feedback.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

// CSS animations are now in style.css

// Listen for storage events to detect when data is copied in other tabs
window.addEventListener('storage', function(e) {
  if (e.key === FLOWCHART_CLIPBOARD_KEY && e.newValue) {
    // Update the memory clipboard when data is copied in another tab
    flowchartClipboard = e.newValue;
    console.log('Node data updated from another tab');
  }
});



// --- UPDATE IMAGE OPTION NODE ---
function updateImageOptionCell(cell) {
  if (!cell || !isOptions(cell) || getQuestionType(cell) !== "imageOption") return;
  // Ensure _image property exists
  if (!cell._image) {
    cell._image = { url: "", width: "100", height: "100" };
  }
  let imgUrl = cell._image.url || "";
  let imgWidth = cell._image.width || "100";
  let imgHeight = cell._image.height || "100";

  // --- FOCUS PRESERVATION PATCH ---
  // Find the currently focused input (if any) and its cursor position
  let focusField = null, cursorPos = null, selectionEnd = null;
  const active = document.activeElement;
  if (active && active.tagName === 'INPUT' && active.type === 'text' || active.type === 'number') {
    if (active.parentElement && active.parentElement.textContent.startsWith('URL')) focusField = 'url';
    else if (active.parentElement && active.parentElement.textContent.startsWith('Width')) focusField = 'width';
    else if (active.parentElement && active.parentElement.textContent.startsWith('Height')) focusField = 'height';
    if (focusField) {
      cursorPos = active.selectionStart;
      selectionEnd = active.selectionEnd;
    }
  }

  // Render image preview and three textboxes
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;padding:8px 0;">
      <img src="${imgUrl}" alt="Image Preview" style="max-width:${imgWidth}px;max-height:${imgHeight}px;object-fit:contain;margin-bottom:8px;border:1px solid #ccc;background:#fff;" onerror="this.style.opacity=0.2" />
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;gap:4px;">
        <label style="font-size:12px;width:100%;text-align:left;">URL:<input type="text" value="${escapeAttr(imgUrl)}" style="width:120px;margin-left:4px;" oninput="window.updateImageNodeField('${cell.id}','url',this.value)" /></label>
        <label style="font-size:12px;width:100%;text-align:left;">Width:<input type="number" min="1" value="${escapeAttr(imgWidth)}" style="width:60px;margin-left:4px;" oninput="window.updateImageNodeField('${cell.id}','width',this.value)" /></label>
        <label style="font-size:12px;width:100%;text-align:left;">Height:<input type="number" min="1" value="${escapeAttr(imgHeight)}" style="width:60px;margin-left:4px;" oninput="window.updateImageNodeField('${cell.id}','height',this.value)" /></label>
      </div>
    </div>
  `;
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);

  // --- RESTORE FOCUS AND CURSOR POSITION ---
  if (focusField) {
    setTimeout(() => {
      // Find the correct input in the newly rendered node
      const state = graph.view.getState(cell);
      if (state && state.text && state.text.node) {
        let input = null;
        if (focusField === 'url') {
          input = state.text.node.querySelector('input[type="text"]');
        } else if (focusField === 'width') {
          input = state.text.node.querySelectorAll('input[type="number"]')[0];
        } else if (focusField === 'height') {
          input = state.text.node.querySelectorAll('input[type="number"]')[1];
        }
        if (input) {
          input.focus();
          if (cursorPos !== null && selectionEnd !== null) {
            input.setSelectionRange(cursorPos, selectionEnd);
          }
        }
      }
    }, 0);
  }
}

// Handler for updating image node fields
window.updateImageNodeField = function(cellId, field, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "imageOption") return;
  if (!cell._image) cell._image = { url: "", width: "100", height: "100" };
  if (field === "width" || field === "height") {
    // Only allow positive integers
    value = String(Math.max(1, parseInt(value) || 1));
  }
  cell._image[field] = value;
  updateImageOptionCell(cell);
};

// PDF Node functions
function isPdfNode(cell) {
  return cell && cell.style && cell.style.includes("nodeType=pdfNode");
}

function updatePdfNodeCell(cell) {
  if (!cell || !isPdfNode(cell)) return;
  
  // Ensure the 3 required properties exist
  if (!cell._pdfName) {
    cell._pdfName = "PDF Document";
  }
  if (!cell._pdfFile) {
    cell._pdfFile = "";
  }
  if (!cell._pdfPrice) {
    cell._pdfPrice = "";
  }
  
  // Render PDF node with the 3 required fields
  let html = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;padding:4px 0;">
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;gap:2px;">
        <label style="font-size:11px;width:100%;text-align:left;">PDF Name:<input type="text" value="${escapeAttr(cell._pdfName)}" style="width:120px;margin-left:4px;" onblur="window.updatePdfNameField('${cell.id}',this.value)" /></label>
        <label style="font-size:11px;width:100%;text-align:left;">PDF File:<input type="text" value="${escapeAttr(cell._pdfFile)}" style="width:120px;margin-left:4px;" onblur="window.updatePdfFileField('${cell.id}',this.value)" /></label>
        <label style="font-size:11px;width:100%;text-align:left;">PDF Price:<input type="text" value="${escapeAttr(cell._pdfPrice)}" style="width:120px;margin-left:4px;" onblur="window.updatePdfPriceField('${cell.id}',this.value)" /></label>
      </div>
    </div>
  `;
  
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

// Handler for updating PDF Name field
window.updatePdfNameField = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isPdfNode(cell)) return;
  
  const oldPdfName = cell._pdfName;
  cell._pdfName = value;
  
  // DISABLED: Automatic Node ID updates when PDF names change
  // Node IDs will only change when manually edited or reset using the button
  // if (oldPdfName && oldPdfName !== value) {
  //   updateAllNodeIdsForPdfChange(oldPdfName, value);
  // }
  
  // Trigger autosave
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
  // Don't call updatePdfNodeCell here to avoid re-rendering while typing
};

/**
 * Update all Node IDs when a PDF name changes
 */
function updateAllNodeIdsForPdfChange(oldPdfName, newPdfName) {
  // DISABLED: Automatic Node ID updates have been completely disabled
  // Node IDs will only change when manually edited or reset using the button
  // Users will set all Node IDs at the end when the structure is complete
  console.log("🔄 [DISABLED] updateAllNodeIdsForPdfChange - Automatic Node ID updates disabled");
  return;
}

// Export the function to window object
window.updateAllNodeIdsForPdfChange = updateAllNodeIdsForPdfChange;

// Handler for updating PDF File field
window.updatePdfFileField = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isPdfNode(cell)) return;
  cell._pdfFile = value;
  // Trigger autosave
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
  // Don't call updatePdfNodeCell here to avoid re-rendering while typing
};

// Handler for updating PDF Price field
window.updatePdfPriceField = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isPdfNode(cell)) return;
  cell._pdfPrice = value;
  // Trigger autosave
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
  // Don't call updatePdfNodeCell here to avoid re-rendering while typing
};
  
  // Function to check if a PDF node is connected to a Big Paragraph node
  function checkIfPdfConnectedToBigParagraph(pdfCell) {
    if (!pdfCell || !isPdfNode(pdfCell)) return false;
    
    // Get all incoming edges to this PDF node
    const incomingEdges = graph.getIncomingEdges(pdfCell) || [];
    
    for (const edge of incomingEdges) {
      const sourceCell = edge.source;
      if (sourceCell && isQuestion(sourceCell)) {
        // Check if the source question is a Big Paragraph
        const questionType = getQuestionType(sourceCell);
        if (questionType === "bigParagraph") {
          return true;
        }
      }
    }
    
    return false;
  }

// Notes Node functions
function isNotesNode(cell) {
  return cell && cell.style && cell.style.includes("questionType=notesNode");
}

function updateNotesNodeCell(cell) {
  if (!cell || !isNotesNode(cell)) return;
  
  // Ensure _notesText property exists
  if (!cell._notesText) {
    cell._notesText = "Notes text";
  }

  // Get current cell dimensions
  const geometry = cell.getGeometry();
  const cellWidth = geometry.width;
  const cellHeight = geometry.height;
  
  // Calculate dynamic font size based on cell dimensions
  // Base font size from user setting, but scale based on cell size
  const baseFontSize = parseInt(cell._notesFontSize, 10) || 14;
  const minFontSize = 8;
  const maxFontSize = 200; // Increased from 48 to allow much larger font sizes
  
  // Scale font size based on cell area (width * height)
  const cellArea = cellWidth * cellHeight;
  const baseArea = 200 * 100; // Default notes node size
  const scaleFactor = Math.sqrt(cellArea / baseArea);
  const dynamicFontSize = Math.max(minFontSize, Math.min(maxFontSize, Math.round(baseFontSize * scaleFactor)));
  
  const isBold = !!cell._notesBold;
  const text = escapeHtml(cell._notesText || "Notes text");

  // Inline styles so they win against theme CSS
  const html =
    `<div class="notes-body" style="font-size:${dynamicFontSize}px !important;` +
    `font-weight:${isBold ? 700 : 400}; line-height:1.35; white-space:pre-wrap; text-align:left;` +
    `cursor: pointer; user-select: text; width: 100%; height: 100%; box-sizing: border-box; padding: 8px;" ondblclick="window.editNotesNodeText('${cell.id}')">` +
    `${text}</div>`;

  graph.getModel().beginUpdate();
  try {
    // Render HTML
    graph.getModel().setValue(cell, html);

    // Also set mxGraph container fontSize to match
    let st = cell.style || "";
    st = st.replace(/fontSize=\d+;?/, "");
    st += `fontSize=${dynamicFontSize};`;
    graph.getModel().setStyle(cell, st);
  } finally {
    graph.getModel().endUpdate();
  }

  colorCell(cell);          // keep your border and fill logic
  // Remove automatic resizing to allow manual resizing
  // graph.updateCellSize(cell);
}

// Handler for updating notes node field (called when user finishes editing)
window.updateNotesNodeField = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isNotesNode(cell)) return;
  cell._notesText = value;
  // Update the cell with proper formatting
  updateNotesNodeCell(cell);
};

// Handler for editing notes node text on double-click
window.editNotesNodeText = function(cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isNotesNode(cell)) return;
  
  const currentText = cell._notesText || "Notes text";
  const newText = prompt("Edit notes text:", currentText);
  
  if (newText !== null && newText !== currentText) {
    cell._notesText = newText;
    updateNotesNodeCell(cell);
    refreshAllCells();
    autosaveFlowchartToLocalStorage();
  }
};

// Checklist Node functions
function isChecklistNode(cell) {
  return cell && cell.style && cell.style.includes("questionType=checklistNode");
}

function updateChecklistNodeCell(cell) {
  if (!cell || !isChecklistNode(cell)) return;
  
  // Ensure _checklistText property exists
  if (!cell._checklistText) {
    cell._checklistText = "Checklist text";
  }

  // Set the cell value directly to the checklist text
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, cell._checklistText);
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

// Handler for updating checklist node field (called when user finishes editing)
window.updateChecklistNodeField = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isChecklistNode(cell)) return;
  cell._checklistText = value;
  // Update the cell value to reflect the new text
  graph.getModel().setValue(cell, value);
};

// Alert Node functions
function isAlertNode(cell) {
  return cell && cell.style && cell.style.includes("questionType=alertNode");
}

function updateAlertNodeCell(cell) {
  if (!cell || !isAlertNode(cell)) return;
  
  // Ensure _alertText property exists
  if (!cell._alertText) {
    cell._alertText = "Alert message";
  }

  // Create the alert node display with editable input field
  // Use _questionText as primary source, fallback to _alertText
  const alertText = cell._questionText || cell._alertText;
  
  let htmlContent = '<div style="padding: 8px; text-align: center; border: 3px solid; border-image: repeating-linear-gradient(45deg, #000000, #000000 5px, #ff0000 5px, #ff0000 10px) 3;">';
  htmlContent += '<div style="font-weight: bold; color: #d32f2f; margin-bottom: 4px; font-size: 16px;">âš ï¸ ALERT</div>';
  htmlContent += `<input type="text" value="${escapeAttr(alertText)}" style="width: 90%; color: #333; font-size: 14px; font-weight: bold; text-align: center; border: 1px solid #ccc; border-radius: 3px; padding: 2px 4px; background: white; outline: none;" onblur="window.updateAlertNodeField('${cell.id}', this.value)" onkeypress="if(event.keyCode===13)this.blur()" />`;
  htmlContent += '</div>';
  
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, htmlContent);
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

// Handler for updating alert node field (called when user finishes editing)
window.updateAlertNodeField = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isAlertNode(cell)) return;
  // Update both _questionText (primary) and _alertText (fallback)
  cell._questionText = value;
  cell._alertText = value;
  // Don't call updateAlertNodeCell here to avoid re-rendering while typing
};

  // Groups functionality moved to groups.js module
  

  


/**
 * Settings functionality
 */
  // currentEdgeStyle moved to config.js module

// Settings menu functions are now handled by ui.js module

// Save settings
function saveSettings() {
  const edgeStyleToggle = document.getElementById('edgeStyleToggle');
  const newEdgeStyle = edgeStyleToggle.value;
  
  if (newEdgeStyle !== currentEdgeStyle) {
    currentEdgeStyle = newEdgeStyle;
    updateEdgeStyle();
    saveSettingsToLocalStorage();
  }
  
  hideSettingsMenu();
}

// Reset all node IDs to match naming convention
function resetAllNodeIds() {
  if (!window.graph) {
    console.warn("Graph not available");
    return;
  }
  
  // Proceed without confirmation dialog
  
  const graph = window.graph;
  const parent = graph.getDefaultParent();
  const cells = graph.getChildVertices(parent);
  
  let resetCount = 0;
  
  // Process each cell
  cells.forEach(cell => {
    // Skip hidden nodes - they should keep their custom Node IDs
    if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) {
      return; // Skip hidden checkbox nodes
    }
    if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
      return; // Skip hidden textbox nodes
    }
    if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
      return; // Skip linked logic nodes
    }
    
    if (typeof window.generateCorrectNodeId === 'function') {
      const correctNodeId = window.generateCorrectNodeId(cell);
      if (correctNodeId) {
        // Clear the manually edited flag since we're resetting to automatic generation
        cell._manuallyEditedNodeId = false;
        
        // Update the cell's Node ID
        if (typeof window.setNodeId === 'function') {
          window.setNodeId(cell, correctNodeId);
          resetCount++;
        }
      }
    }
  });
  
  // Refresh all cells to update the display
  if (typeof window.refreshAllCells === 'function') {
    window.refreshAllCells();
  }
  
  // Trigger autosave
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
  
  // Close settings menu
  hideSettingsMenu();
}

// Update edge style based on current setting
function updateEdgeStyle() {
  // Update graph default edge style
  if (currentEdgeStyle === 'curved') {
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ROUNDED] = true;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ORTHOGONAL_LOOP] = true;
  } else if (currentEdgeStyle === 'straight') {
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ROUNDED] = false;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ORTHOGONAL_LOOP] = true;
  } else if (currentEdgeStyle === 'direct') {
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_EDGE] = mxEdgeStyle.None;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ROUNDED] = false;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ORTHOGONAL_LOOP] = false;
  }
  
  // Update existing edges
  const edges = graph.getChildEdges(graph.getDefaultParent());
  edges.forEach(edge => {
    const currentStyle = edge.style || "";
    let newStyle;
    
    if (currentEdgeStyle === 'curved') {
      newStyle = currentStyle.replace(/edgeStyle=[^;]+/g, 'edgeStyle=orthogonalEdgeStyle');
      newStyle = newStyle.replace(/rounded=0/g, 'rounded=1');
      if (!newStyle.includes('rounded=')) {
        newStyle += ';rounded=1';
      }
      if (!newStyle.includes('orthogonalLoop=')) {
        newStyle += ';orthogonalLoop=1';
      }
    } else if (currentEdgeStyle === 'straight') {
      newStyle = currentStyle.replace(/edgeStyle=[^;]+/g, 'edgeStyle=orthogonalEdgeStyle');
      newStyle = newStyle.replace(/rounded=1/g, 'rounded=0');
      if (!newStyle.includes('rounded=')) {
        newStyle += ';rounded=0';
      }
      if (!newStyle.includes('orthogonalLoop=')) {
        newStyle += ';orthogonalLoop=1';
      }
    } else if (currentEdgeStyle === 'direct') {
      newStyle = currentStyle.replace(/edgeStyle=[^;]+/g, 'edgeStyle=none');
      newStyle = newStyle.replace(/rounded=[^;]+/g, 'rounded=0');
      newStyle = newStyle.replace(/orthogonalLoop=[^;]+/g, 'orthogonalLoop=0');
      if (!newStyle.includes('rounded=')) {
        newStyle += ';rounded=0';
      }
      if (!newStyle.includes('orthogonalLoop=')) {
        newStyle += ';orthogonalLoop=0';
      }
    }
    
    graph.getModel().setStyle(edge, newStyle);
  });
  
  // Refresh the display
  graph.refresh();
}

// Save settings to localStorage
function saveSettingsToLocalStorage() {
  const settings = {
    edgeStyle: currentEdgeStyle
  };
  localStorage.setItem('flowchartSettings', JSON.stringify(settings));
}

// Load settings from localStorage
function loadSettingsFromLocalStorage() {
  const settingsStr = localStorage.getItem('flowchartSettings');
  if (settingsStr) {
    try {
      const settings = JSON.parse(settingsStr);
      if (settings.edgeStyle) {
        currentEdgeStyle = settings.edgeStyle;
        updateEdgeStyle();
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }
}

/**
 * Node Search Functionality
 */
  // searchTimeout moved to config.js module

// Initialize search functionality
function initializeSearch() {
  const searchBox = document.getElementById('nodeSearchBox');
  const clearBtn = document.getElementById('clearSearchBtn');
  
  if (searchBox) {
    searchBox.addEventListener('input', function() {
      const searchTerm = this.value.trim().toLowerCase();
      
      // Clear previous timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      
      // Debounce the search to avoid excessive processing
      searchTimeout = setTimeout(() => {
        performNodeSearch(searchTerm);
      }, 200); // Reduced from 300ms for better responsiveness
      
      // Show/hide clear button
      if (searchTerm.length > 0) {
        clearBtn.classList.add('show');
      } else {
        clearBtn.classList.remove('show');
        clearSearch();
      }
    });
    
    // Handle Enter key to select first result
    searchBox.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length > 0) {
          selectFirstSearchResult(searchTerm);
        }
      }
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      searchBox.value = '';
      clearSearch();
      clearBtn.classList.remove('show');
      searchBox.focus();
    });
  }
}

// Cache for cell text to avoid repeated DOM operations
  // cellTextCache and lastCacheClear moved to config.js module

// Clear cache periodically to prevent memory leaks
function clearCellTextCache() {
  const now = Date.now();
  if (now - lastCacheClear > 30000) { // Clear every 30 seconds
    cellTextCache.clear();
    lastCacheClear = now;
  }
}

// Get cell text with caching for performance
function getCellText(cell) {
  const cacheKey = `${cell.id}_${cell.value}_${cell._questionText}_${cell._subtitleText}_${cell._infoText}_${cell._notesText}_${cell._checklistText}_${cell._alertText}_${cell._calcTitle}`;
  
  if (cellTextCache.has(cacheKey)) {
    return cellTextCache.get(cacheKey);
  }
  
  let cellText = '';
  
  // Get text from different node types
  if (isQuestion(cell)) {
    cellText = cell._questionText || cell.value || '';
  } else if (isOptions(cell)) {
    cellText = cell.value || '';
  } else if (isSubtitleNode(cell)) {
    cellText = cell._subtitleText || cell.value || '';
  } else if (isInfoNode(cell)) {
    cellText = cell._infoText || cell.value || '';
  } else if (isNotesNode(cell)) {
    cellText = cell._notesText || cell.value || '';
  } else if (isChecklistNode(cell)) {
    cellText = cell._checklistText || cell.value || '';
  } else if (isAlertNode(cell)) {
    cellText = cell._questionText || cell._alertText || cell.value || '';
  } else if (isCalculationNode(cell)) {
          // Calculation node text now handled by calc.js
          if (typeof window.getCalculationNodeText === 'function') {
            cellText = window.getCalculationNodeText(cell);
          } else {
    cellText = cell._calcTitle || cell.value || '';
          }
  } else {
    cellText = cell.value || '';
  }
  
  // Clean HTML tags from text (only if needed)
  if (cellText.includes('<')) {
    const temp = document.createElement('div');
    temp.innerHTML = cellText;
    cellText = temp.textContent || temp.innerText || cellText;
  }
  
  cellTextCache.set(cacheKey, cellText);
  return cellText;
}

// Perform the actual search with optimizations
function performNodeSearch(searchTerm) {
  if (!searchTerm || searchTerm.length === 0) {
    clearSearch();
    return;
  }
  
  // Clear cache periodically
  clearCellTextCache();
  
  const vertices = graph.getChildVertices(graph.getDefaultParent());
  const matchingCells = [];
  const searchTermLower = searchTerm.toLowerCase();
  
  // Use for...of for better performance with large arrays
  for (const cell of vertices) {
    const cellText = getCellText(cell);
    
    // Check if search term is found in the text
    if (cellText.toLowerCase().includes(searchTermLower)) {
      matchingCells.push(cell);
    }
  }
  
  // Highlight matching cells
  highlightSearchResults(matchingCells, searchTerm);
}

// Highlight search results
function highlightSearchResults(matchingCells, searchTerm) {
  // Clear existing selection first
  graph.clearSelection();
  
  if (matchingCells.length === 0) {
    return;
  }
  
  // Use the same selection mechanism as section highlighting
  graph.addSelectionCells(matchingCells);
  
  // Show search results count
  showSearchResultsCount(matchingCells.length);
  
  // Center view on first result if there are results
  if (matchingCells.length > 0) {
    centerOnCell(matchingCells[0]);
  }
}

// Clear search highlights
function clearSearch() {
  // Simply clear the selection - this will remove the neon green highlighting
  graph.clearSelection();
  
  // Hide search results count
  hideSearchResultsCount();
}

// Show search results count
function showSearchResultsCount(count) {
  let countElement = document.getElementById('searchResultsCount');
  if (!countElement) {
    countElement = document.createElement('div');
    countElement.id = 'searchResultsCount';
    countElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #007bff;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(countElement);
  }
  
  countElement.textContent = `${count} result${count !== 1 ? 's' : ''} found`;
  countElement.style.display = 'block';
}

// Hide search results count
function hideSearchResultsCount() {
  const countElement = document.getElementById('searchResultsCount');
  if (countElement) {
    countElement.style.display = 'none';
  }
}

// Center view on a specific cell with performance optimization
function centerOnCell(cell) {
  if (!cell || !cell.geometry) return;
  
  const centerX = cell.geometry.x + cell.geometry.width / 2;
  const centerY = cell.geometry.y + cell.geometry.height / 2;
  
  const containerWidth = graph.container.clientWidth;
  const containerHeight = graph.container.clientHeight;
  const scale = graph.view.scale;
  
  const tx = (containerWidth / 2 - centerX * scale);
  const ty = (containerHeight / 2 - centerY * scale);
  
  // Batch view updates for better performance
  graph.view.setTranslate(tx / scale, ty / scale);
  
  // Use requestAnimationFrame for smooth scrolling
  requestAnimationFrame(() => {
    graph.view.refresh();
  });
}

// Select first search result
function selectFirstSearchResult(searchTerm) {
  const vertices = graph.getChildVertices(graph.getDefaultParent());
  const matchingCells = [];
  const searchTermLower = searchTerm.toLowerCase();
  
  // Use for...of for better performance with large arrays
  for (const cell of vertices) {
    const cellText = getCellText(cell);
    
    if (cellText.toLowerCase().includes(searchTermLower)) {
      matchingCells.push(cell);
    }
  }
  
  if (matchingCells.length > 0) {
    // Select the first matching cell
    graph.getSelectionModel().setCell(matchingCells[0]);
    centerOnCell(matchingCells[0]);
  }
}


// Helper function to find PDF name for a question node
function findPdfNameForQuestion(cell) {
  if (!cell) return null;
  
  const graph = getGraph();
  if (!graph) return null;
  
  // Use breadth-first search to find the closest PDF node
  const findClosestPdfProperties = (startCell) => {
    // Check if this node has direct PDF properties (distance 0)
    if (startCell._pdfName || startCell._pdfFile || startCell._pdfUrl) {
      return {
        nodeId: startCell.id,
        filename: startCell._pdfFile || startCell._pdfUrl || startCell._pdfName || "",
        pdfUrl: startCell._pdfUrl || "",
        priceId: startCell._priceId || "",
        distance: 0
      };
    }
    
    // Check if this is a PDF node (distance 0)
    if (typeof window.isPdfNode === 'function' && window.isPdfNode(startCell)) {
      return {
        nodeId: startCell.id,
        filename: startCell._pdfUrl || "",
        pdfUrl: startCell._pdfUrl || "",
        priceId: startCell._priceId || "",
        distance: 0
      };
    }
    
    // Special handling for numbered dropdown questions - check connected option nodes first
    if (typeof window.getQuestionType === 'function' && window.getQuestionType(startCell) === 'multipleDropdownType') {
    const outgoingEdges = graph.getOutgoingEdges(startCell) || [];
      
      // Look for option nodes connected to this numbered dropdown question
      for (const edge of outgoingEdges) {
      const target = edge.target;
        if (target && target.value && typeof target.value === 'string' && /^\d+$/.test(target.value.trim())) {
          // This is an option node (contains only numbers)
          // Check if this option node connects to a PDF node
          const optionOutgoingEdges = graph.getOutgoingEdges(target) || [];
          for (const optionEdge of optionOutgoingEdges) {
            const pdfTarget = optionEdge.target;
            if (pdfTarget && (pdfTarget._pdfName || pdfTarget._pdfFile || pdfTarget._pdfUrl)) {
              // Found a PDF node connected to this option
              return {
                nodeId: pdfTarget.id,
                filename: pdfTarget._pdfFile || pdfTarget._pdfUrl || pdfTarget._pdfName || "",
                pdfUrl: pdfTarget._pdfUrl || "",
                priceId: pdfTarget._priceId || "",
                distance: 2 // Question -> Option -> PDF
              };
            }
            // Also check if the target is a PDF node itself
            if (pdfTarget && typeof window.isPdfNode === 'function' && window.isPdfNode(pdfTarget)) {
              return {
                nodeId: pdfTarget.id,
                filename: pdfTarget._pdfUrl || "",
                pdfUrl: pdfTarget._pdfUrl || "",
                priceId: pdfTarget._priceId || "",
                distance: 2 // Question -> Option -> PDF
              };
            }
          }
        }
      }
    }
    
    // BFS to find closest PDF node
    const visited = new Set();
    const queue = [{ cell: startCell, distance: 0 }];
    visited.add(startCell.id);
    
    while (queue.length > 0) {
      const { cell: currentCell, distance } = queue.shift();
      
      // Check outgoing edges (distance + 1)
      const outgoingEdges = graph.getOutgoingEdges(currentCell) || [];
      for (const edge of outgoingEdges) {
        const target = edge.target;
        if (target && !visited.has(target.id)) {
          visited.add(target.id);
          
          // Check if target has PDF properties
          if (target._pdfName || target._pdfFile || target._pdfUrl) {
      return {
              nodeId: target.id,
              filename: target._pdfFile || target._pdfUrl || target._pdfName || "",
              pdfUrl: target._pdfUrl || "",
              priceId: target._priceId || "",
              distance: distance + 1
            };
          }
          
          // Check if target is a PDF node
          if (typeof window.isPdfNode === 'function' && window.isPdfNode(target)) {
          return {
              nodeId: target.id,
              filename: target._pdfUrl || "",
              pdfUrl: target._pdfUrl || "",
              priceId: target._priceId || "",
              distance: distance + 1
            };
          }
          
          // Add to queue for further exploration
          queue.push({ cell: target, distance: distance + 1 });
        }
      }
      
      // Check incoming edges (distance + 1)
      const incomingEdges = graph.getIncomingEdges(currentCell) || [];
      for (const edge of incomingEdges) {
        const source = edge.source;
        if (source && !visited.has(source.id)) {
          visited.add(source.id);
          
          // Check if source has PDF properties
          if (source._pdfName || source._pdfFile || source._pdfUrl) {
          return {
              nodeId: source.id,
              filename: source._pdfFile || source._pdfUrl || source._pdfName || "",
              pdfUrl: source._pdfUrl || "",
              priceId: source._priceId || "",
              distance: distance + 1
            };
          }
          
          // Check if source is a PDF node
          if (typeof window.isPdfNode === 'function' && window.isPdfNode(source)) {
            return {
              nodeId: source.id,
              filename: source._pdfUrl || "",
              pdfUrl: source._pdfUrl || "",
              priceId: source._priceId || "",
              distance: distance + 1
            };
          }
          
          // Add to queue for further exploration
          queue.push({ cell: source, distance: distance + 1 });
        }
      }
    }
    
    return null;
  };
  
  const pdfProperties = findClosestPdfProperties(cell);
  
  // Only return the PDF name if we found actual PDF properties (same as Node Properties dialog)
  if (pdfProperties && pdfProperties.filename) {
    return pdfProperties.filename;
  }
  
  return null;
}

// Helper function to sanitize PDF name for use in IDs
function sanitizePdfName(pdfName) {
  if (!pdfName) return '';
  
  // Remove file extension if present
  const nameWithoutExt = pdfName.replace(/\.[^/.]+$/, '');
  
  // Sanitize the name: convert to lowercase, replace non-alphanumeric with underscores
  return nameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

// Make helper functions globally accessible
window.findPdfNameForQuestion = findPdfNameForQuestion;
window.sanitizePdfName = sanitizePdfName;

/**************************************************
 ************ Flowchart Details Modal *************
 **************************************************/

// Show the flowchart details modal
window.showFlowchartDetailsModal = function() {
  const modal = document.getElementById('flowchartDetailsModal');
  modal.style.display = 'flex';
  document.getElementById('flowchartDetailsInput').focus();
};

