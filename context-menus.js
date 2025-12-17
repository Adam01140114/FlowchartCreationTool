/**************************************************
 ************ CONTEXT MENUS MODULE ********
 **************************************************/
// This module handles all context menu functionality including:
// - Context menu setup and management
// - Right-click handling for all node types
// - Menu item creation and event handlers
// - Empty space context menu
// - Edge context menu
// - Notes context menu
// Use shared dependency accessors from dependencies.js module
// Module-level DOM element references
let contextMenu, notesContextMenu, edgeContextMenu, edgeStyleSubmenu, typeSubmenu, calcSubmenu, optionTypeSubmenu, emptySpaceMenu, propertiesMenu;
let deleteNode, copyNodeButton, jumpNode, yesNoNode, changeType, calcTypeBtn, subtitleTypeBtn, infoTypeBtn, propertiesButton;
let regularOptionType, imageOptionType, amountOptionType, notesNodeType, alertNodeType, checklistNodeType, endNodeType;
let notesBoldButton, notesFontButton, notesCopyButton, notesDeleteButton;
let newSectionButton, untangleEdge, changeEdgeStyle, disableDragEdge, deleteEdge, edgeStyleCurved, edgeStyleDirect;
let disableDragNode;
let placeQuestionNode, placeOptionNode, placeSampleQuestionNode, placeMiscellaneousNode;
// Initialize DOM element references
function initializeContextMenuElements() {
  contextMenu = document.getElementById('contextMenu');
  notesContextMenu = document.getElementById('notesContextMenu');
  edgeContextMenu = document.getElementById('edgeContextMenu');
  edgeStyleSubmenu = document.getElementById('edgeStyleSubmenu');
  typeSubmenu = document.getElementById('typeSubmenu');
  calcSubmenu = document.getElementById('calcSubmenu');
  optionTypeSubmenu = document.getElementById('optionTypeSubmenu');
  emptySpaceMenu = document.getElementById('emptySpaceMenu');
  propertiesMenu = document.getElementById('propertiesMenu');
  deleteNode = document.getElementById('deleteNode');
  copyNodeButton = document.getElementById('copyNodeButton');
  jumpNode = document.getElementById('jumpNode');
  yesNoNode = document.getElementById('yesNoNode');
  changeType = document.getElementById('changeType');
  calcTypeBtn = document.getElementById('calcTypeBtn');
  subtitleTypeBtn = document.getElementById('subtitleTypeBtn');
  infoTypeBtn = document.getElementById('infoTypeBtn');
  renameNode = document.getElementById('renameNode');
  propertiesButton = document.getElementById('propertiesButton');
  regularOptionType = document.getElementById('regularOptionType');
  imageOptionType = document.getElementById('imageOptionType');
  amountOptionType = document.getElementById('amountOptionType');
  notesNodeType = document.getElementById('notesNodeType');
  alertNodeType = document.getElementById('alertNodeType');
  checklistNodeType = document.getElementById('checklistNodeType');
  endNodeType = document.getElementById('endNodeType');
  notesBoldButton = document.getElementById('notesBoldButton');
  notesFontButton = document.getElementById('notesFontButton');
  notesCopyButton = document.getElementById('notesCopyButton');
  notesDeleteButton = document.getElementById('notesDeleteButton');
  newSectionButton = document.getElementById('newSectionNode');
  untangleEdge = document.getElementById('untangleEdge');
  changeEdgeStyle = document.getElementById('changeEdgeStyle');
  disableDragEdge = document.getElementById('disableDragEdge');
  deleteEdge = document.getElementById('deleteEdge');
  edgeStyleCurved = document.getElementById('edgeStyleCurved');
  edgeStyleDirect = document.getElementById('edgeStyleDirect');
  disableDragNode = document.getElementById('disableDragNode');
  placeQuestionNode = document.getElementById('placeQuestionNode');
  placeOptionNode = document.getElementById('placeOptionNode');
  placeSampleQuestionNode = document.getElementById('placeSampleQuestionNode');
  placeMiscellaneousNode = document.getElementById('placeMiscellaneousNode');
}
// Determine the type of a node (question, options, etc.)
function getNodeType(cell) {
  if (!cell || !cell.style) return "unknown";
  if (cell.style.includes("nodeType=question")) {
    return "question";
  } else if (cell.style.includes("nodeType=options")) {
    return "options";
  } else if (cell.style.includes("nodeType=calculation")) {
    return "calculation"; 
  } else if (cell.style.includes("nodeType=end")) {
    return "end";
  }
  return "unknown";
}
function isEndNode(cell) {
  return (cell && cell.style && cell.style.includes("nodeType=end")) || 
         (cell && cell.id === "1") || 
         (cell && cell.id === "19");
}
// Helper function to get node ID - REMOVED
// This function was causing conflicts with the global window.getNodeId function
// The properties dialog now uses window.getNodeId directly
// Function to auto-select connecting edges
function autoSelectConnectingEdges() {
  const graph = window.graph;
  if (!graph) return;
  const sel = graph.getSelectionCells();
  const verts = sel.filter(c => c && c.vertex);
  // If there are 2 or more vertices, find edges between them
  const toAdd = [];
  if (verts.length >= 2) {
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        // Check edges in both directions
        const between1 = graph.getEdgesBetween(verts[i], verts[j], false) || [];
        const between2 = graph.getEdgesBetween(verts[j], verts[i], false) || [];
        const allBetween = [...between1, ...between2];
        for (const e of allBetween) {
          if (!sel.includes(e) && !toAdd.includes(e)) {
            toAdd.push(e);
          }
        }
      }
    }
  }
  // Also find edges that connect any selected vertex to any other selected vertex
  // This handles cases where edges might connect through intermediate nodes
  for (const vert of verts) {
    const outgoingEdges = graph.getOutgoingEdges(vert) || [];
    const incomingEdges = graph.getIncomingEdges(vert) || [];
    const allEdges = [...outgoingEdges, ...incomingEdges];
    for (const edge of allEdges) {
      const source = edge.source;
      const target = edge.target;
      // If both source and target are in the selected vertices, add the edge
      if (source && target && 
          verts.includes(source) && verts.includes(target) &&
          !sel.includes(edge) && !toAdd.includes(edge)) {
        toAdd.push(edge);
      }
    }
  }
  if (toAdd.length) {
    graph.getSelectionModel().addCells(toAdd);
  }
}
// Make function available globally
window.autoSelectConnectingEdges = autoSelectConnectingEdges;
/**
 * Hide all context menus and submenus
 * This is the single source of truth for hiding context menus
 */
function hideContextMenuMain() {
  // Hide main context menus
  if (contextMenu) contextMenu.style.display = 'none';
  if (notesContextMenu) notesContextMenu.style.display = 'none';
  if (edgeContextMenu) edgeContextMenu.style.display = 'none';
  if (emptySpaceMenu) emptySpaceMenu.style.display = 'none';
  if (propertiesMenu) propertiesMenu.style.display = 'none';
  // Hide all submenus
  if (typeSubmenu) typeSubmenu.style.display = 'none';
  if (calcSubmenu) calcSubmenu.style.display = 'none';
  if (optionTypeSubmenu) optionTypeSubmenu.style.display = 'none';
  if (edgeStyleSubmenu) edgeStyleSubmenu.style.display = 'none';
  // Update UI state
  if (typeof window.contextMenuVisible !== 'undefined') {
    window.contextMenuVisible = false;
  }
  if (typeof window.contextMenuTarget !== 'undefined') {
    window.contextMenuTarget = null;
  }
}
// Keep the old function name for backward compatibility
function hideContextMenu() {
  hideContextMenuMain();
}
// Context Menu Setup
function setupContextMenus(graph) {
  if (!graph) return;
  // Context menu handling
  graph.popupMenuHandler.factoryMethod = function(menu, cell, evt) {
    // NEW – let native menu appear inside inputs / textareas / contenteditable
    if (evt.target.closest('input, textarea, [contenteditable="true"]')) {
      return null;            // don't build a graph menu, don't call preventDefault
    }
    propertiesMenu.style.display = "none";
    typeSubmenu.style.display = "none";
    window.selectedCell = cell;
    window.currentMouseEvent = evt;
    // Right-click context menu
    if (mxEvent.isRightMouseButton(evt)) {
      // Store current selection before showing menu
      const currentSelection = graph.getSelectionCells();
      // If right-clicking on a cell that's not in the current selection,
      // select it first (but preserve multi-selection if Ctrl/Shift is held)
      if (cell && !currentSelection.includes(cell)) {
        if (evt.ctrlKey || evt.metaKey || evt.shiftKey) {
          // Add to selection
          graph.getSelectionModel().addCell(cell);
        } else {
          // Replace selection
          graph.getSelectionModel().setCell(cell);
        }
        // Immediately trigger the selection change to ensure connecting edges are selected
        autoSelectConnectingEdges();
      }
      const selectedCells = graph.getSelectionCells();
      if (selectedCells && selectedCells.length > 0) {
        // Check if we have a single edge selected
        if (selectedCells.length === 1 && selectedCells[0].edge) {
          // Show edge context menu
          const x = evt.clientX;
          const y = evt.clientY;
          if (edgeContextMenu) {
            // Update "Disable Drag" button text based on current state
            const edge = selectedCells[0];
            const isDragDisabled = edge.style && edge.style.includes('dragDisabled=1');
            if (disableDragEdge) {
              disableDragEdge.textContent = isDragDisabled ? 'Enable Drag' : 'Disable Drag';
            }
            edgeContextMenu.style.display = 'block';
            edgeContextMenu.style.left = x + 'px';
            edgeContextMenu.style.top = y + 'px';
          }
        }
        // Check if we have a single Notes node selected
        else if (selectedCells.length === 1 && typeof window.isNotesNode === 'function' && window.isNotesNode(selectedCells[0])) {
          // Show special Notes context menu
          const x = evt.clientX;
          const y = evt.clientY;
          if (notesContextMenu) {
            notesContextMenu.style.display = 'block';
            notesContextMenu.style.left = x + 'px';
            notesContextMenu.style.top = y + 'px';
          }
          // Update bold button text based on current state
          const notesCell = selectedCells[0];
          const isBold = notesCell._notesBold || false;
          if (notesBoldButton) {
            notesBoldButton.textContent = isBold ? 'Unbold' : 'Bold';
          }
        } else {
          // Show regular context menu for other cells
          const x = evt.clientX;
          const y = evt.clientY;
          if (contextMenu) {
            contextMenu.style.display = 'block';
            contextMenu.style.left = x + 'px';
            contextMenu.style.top = y + 'px';
          }
          // Update menu title to show number of selected items
          if (selectedCells.length > 1) {
            if (deleteNode) deleteNode.textContent = `Delete ${selectedCells.length} Nodes`;
            if (copyNodeButton) copyNodeButton.textContent = `Copy ${selectedCells.length} Nodes`;
            // Hide options that don't apply to multiple nodes
            if (yesNoNode) yesNoNode.style.display = 'none';
            if (changeType) changeType.style.display = 'none';
            if (jumpNode) jumpNode.style.display = 'none';
            // Note: propertiesButton is not in our module-level references, need to add it
          } else {
            // Single node selection - restore original text and show/hide options based on node type
            if (deleteNode) deleteNode.textContent = "Delete Node";
            if (copyNodeButton) copyNodeButton.textContent = "Copy";
            if (jumpNode) jumpNode.style.display = 'block';
            if (propertiesButton) propertiesButton.style.display = 'block';
            const cell = selectedCells[0];
            if (getNodeType(cell) === 'question') {
              if (yesNoNode) yesNoNode.style.display = 'block';
              if (changeType) {
                changeType.style.display = 'block';
                changeType.textContent = 'Change Type';
              }
              // Show and update "Disable Drag" button for question nodes
              if (disableDragNode) {
                disableDragNode.style.display = 'block';
                const isDragDisabled = cell.style && cell.style.includes('dragDisabled=1');
                disableDragNode.textContent = isDragDisabled ? 'Enable Drag' : 'Disable Drag';
              }
            } else if (getNodeType(cell) === 'options') {
              if (yesNoNode) yesNoNode.style.display = 'none';
              if (changeType) {
                changeType.style.display = 'block';
                // Change the text to indicate it's for option types
                changeType.textContent = 'Change Option Type';
              }
              // Hide "Disable Drag" button for option nodes
              if (disableDragNode) disableDragNode.style.display = 'none';
            } else {
              if (yesNoNode) yesNoNode.style.display = 'none';
              if (changeType) changeType.style.display = 'none';
              // Hide "Disable Drag" button for other node types
              if (disableDragNode) disableDragNode.style.display = 'none';
            }
          }
        }
      } else {
        // No cells selected - show empty space context menu
        const x = evt.clientX;
        const y = evt.clientY;
        // Convert client coordinates to graph coordinates
        const pt = graph.getPointForEvent(evt, false);
        // Store click position in global variables for later use
        window.emptySpaceClickX = pt.x;
        window.emptySpaceClickY = pt.y;
        // Show empty space context menu
        if (emptySpaceMenu) {
          emptySpaceMenu.style.display = 'block';
          emptySpaceMenu.style.left = x + 'px';
          emptySpaceMenu.style.top = y + 'px';
        }
      }
      evt.preventDefault();
    }
    return null; // Always return null to prevent the default menu
  };
}
// Setup Context Menu Event Listeners
function setupContextMenuEventListeners(graph) {
  if (!graph) return;
  // Ensure DOM elements are initialized
  if (!deleteNode) {
    initializeContextMenuElements();
  }
  // Regular context menu event handlers
  if (deleteNode) deleteNode.addEventListener("click", () => {
    const selectedCells = graph.getSelectionCells();
    if (selectedCells && selectedCells.length > 0) {
      // For each question cell that will be deleted, handle dependent calc nodes
      const questionCells = selectedCells.filter(cell => getNodeType(cell) === 'question');
      if (questionCells.length > 0) {
        questionCells.forEach(cell => {
          const oldNodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || "";
          // Update or remove dependent calculation nodes
          if (typeof window.updateAllCalcNodesOnQuestionChange === 'function') {
            window.updateAllCalcNodesOnQuestionChange(null, true, oldNodeId);
          }
        });
      }
      graph.removeCells(selectedCells);
      if (typeof window.refreshAllCells === 'function') {
        window.refreshAllCells();
      }
    }
    hideContextMenu();
  });
  if (copyNodeButton) copyNodeButton.addEventListener("click", () => {
    const selectedCells = graph.getSelectionCells();
    if (selectedCells && selectedCells.length > 0) {
      if (typeof window.copySelectedNodeAsJson === 'function') {
        window.copySelectedNodeAsJson();
      }
    }
    hideContextMenu();
  });
  // Mark/unmark jump node
  if (jumpNode) jumpNode.addEventListener("click", () => {
    if (window.selectedCell) {
      if (window.jumpModeNode && window.jumpModeNode !== window.selectedCell) {
        if (typeof window.removeJumpStyling === 'function') {
          window.removeJumpStyling(window.jumpModeNode);
        }
      }
      window.jumpModeNode = window.selectedCell;
      if (typeof window.addJumpStyling === 'function') {
        window.addJumpStyling(window.selectedCell);
      }
    }
    hideContextMenu();
  });
  // Create yes/no child options
  if (yesNoNode) yesNoNode.addEventListener("click", () => {
    if (window.selectedCell && typeof window.isQuestion === 'function' && window.isQuestion(window.selectedCell)) {
      if (typeof window.createYesNoOptions === 'function') {
        window.createYesNoOptions(window.selectedCell);
      }
    }
    hideContextMenu();
  });
  // Disable/Enable drag for question nodes
  if (disableDragNode) {
    disableDragNode.addEventListener('click', function() {
      const selectedCells = graph.getSelectionCells();
      if (selectedCells.length === 1) {
        const cell = selectedCells[0];
        // Only allow for question nodes
        if (getNodeType(cell) === 'question') {
          let style = cell.style || "";
          // Check if drag is currently disabled
          const isDragDisabled = style.includes('dragDisabled=1');
          if (isDragDisabled) {
            // Enable drag - remove dragDisabled
            style = style.replace(/dragDisabled=1;?/g, '');
            // Clean up any double semicolons
            style = style.replace(/;;+/g, ';');
            if (style.endsWith(';')) {
              style = style.slice(0, -1);
            }
          } else {
            // Disable drag - add dragDisabled
            if (!style.includes('dragDisabled=')) {
              style += (style ? ';' : '') + 'dragDisabled=1';
            }
          }
          graph.getModel().setStyle(cell, style);
          graph.refresh();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        }
      }
      hideContextMenu();
    });
  }
  // 'Change Type' -> Show submenu
  if (changeType) changeType.addEventListener("click", () => {
    const rect = contextMenu ? contextMenu.getBoundingClientRect() : { right: 0, top: 0 };
    if (window.selectedCell && typeof window.isQuestion === 'function' && window.isQuestion(window.selectedCell)) {
      if (typeSubmenu) {
        typeSubmenu.style.display = "block";
        typeSubmenu.style.left = rect.right + "px";
        typeSubmenu.style.top = rect.top + "px";
      }
      if (calcSubmenu) calcSubmenu.style.display = "none";
      if (optionTypeSubmenu) optionTypeSubmenu.style.display = "none";
    } else if (window.selectedCell && typeof window.isOptions === 'function' && window.isOptions(window.selectedCell)) {
      if (optionTypeSubmenu) {
        optionTypeSubmenu.style.display = "block";
        optionTypeSubmenu.style.left = rect.right + "px";
        optionTypeSubmenu.style.top = rect.top + "px";
      }
      if (typeSubmenu) typeSubmenu.style.display = "none";
      if (calcSubmenu) calcSubmenu.style.display = "none";
    } else if (window.selectedCell && (typeof window.isCalculationNode === 'function' && window.isCalculationNode(window.selectedCell) || 
               typeof window.isSubtitleNode === 'function' && window.isSubtitleNode(window.selectedCell) || 
               typeof window.isInfoNode === 'function' && window.isInfoNode(window.selectedCell))) {
      if (calcSubmenu) {
        calcSubmenu.style.display = "block";
        calcSubmenu.style.left = rect.right + "px";
        calcSubmenu.style.top = rect.top + "px";
      }
      if (typeSubmenu) typeSubmenu.style.display = "none";
      if (optionTypeSubmenu) optionTypeSubmenu.style.display = "none";
    }
  });
  // Type submenu buttons (for question nodes)
  if (document.getElementById('checkboxType')) {
    document.getElementById('checkboxType').addEventListener("click", () => {
      if (window.selectedCell) {
        // Clear existing complex structure and convert to checkbox
        window.selectedCell._questionType = "checkbox";
        window.selectedCell._questionText = "Checkbox question node";
        // Set default checkbox availability
        window.selectedCell._checkboxAvailability = "markAll";
        // Clear any complex properties
        delete window.selectedCell._textboxes;
        delete window.selectedCell._twoNumbers;
        delete window.selectedCell._options;
        // Update the cell style to reflect the new question type
        let style = window.selectedCell.style || '';
        style = style.replace(/questionType=[^;]+/g, '');
        style += ';questionType=checkbox;';
        window.selectedCell.style = style;
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.updateSimpleQuestionCell(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('textType')) {
    document.getElementById('textType').addEventListener("click", () => {
      if (window.selectedCell) {
        // Clear existing complex structure and convert to simple text
        window.selectedCell._questionType = "text";
        window.selectedCell._questionText = "Text question node";
        // Clear any complex properties
        delete window.selectedCell._textboxes;
        delete window.selectedCell._twoNumbers;
        delete window.selectedCell._options;
        // Update the cell style to reflect the new question type
        let style = window.selectedCell.style || '';
        style = style.replace(/questionType=[^;]+/g, '');
        style += ';questionType=text;';
        window.selectedCell.style = style;
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.updateSimpleQuestionCell(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('text2Type')) {
    document.getElementById('text2Type').addEventListener("click", () => {
      if (window.selectedCell) {
        // Clear existing complex structure and convert to dropdown
        window.selectedCell._questionType = "dropdown";
        window.selectedCell._questionText = "Dropdown question node";
        // Clear any complex properties
        delete window.selectedCell._textboxes;
        delete window.selectedCell._twoNumbers;
        delete window.selectedCell._options;
        // Update the cell style to reflect the new question type
        let style = window.selectedCell.style || '';
        style = style.replace(/questionType=[^;]+/g, '');
        style += ';questionType=dropdown;';
        window.selectedCell.style = style;
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.updateSimpleQuestionCell(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('moneyType')) {
    document.getElementById('moneyType').addEventListener("click", () => {
      if (window.selectedCell) {
        // Clear existing complex structure and convert to number
        window.selectedCell._questionType = "number";
        window.selectedCell._questionText = "Number question node";
        // Clear any complex properties
        delete window.selectedCell._textboxes;
        delete window.selectedCell._twoNumbers;
        delete window.selectedCell._options;
        // Update the cell style to reflect the new question type
        let style = window.selectedCell.style || '';
        style = style.replace(/questionType=[^;]+/g, '');
        style += ';questionType=number;';
        window.selectedCell.style = style;
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.updateSimpleQuestionCell(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('dateType')) {
    document.getElementById('dateType').addEventListener("click", () => {
      if (window.selectedCell) {
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.selectedCell._questionType = "date";
          window.updateSimpleQuestionCell(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('dateRangeType')) {
    document.getElementById('dateRangeType').addEventListener("click", () => {
      if (window.selectedCell) {
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.selectedCell._questionType = "dateRange";
          window.updateSimpleQuestionCell(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('emailType')) {
    document.getElementById('emailType').addEventListener("click", () => {
      if (window.selectedCell) {
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.selectedCell._questionType = "email";
          window.updateSimpleQuestionCell(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('phoneType')) {
    document.getElementById('phoneType').addEventListener("click", () => {
      if (window.selectedCell) {
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.selectedCell._questionType = "phone";
          window.updateSimpleQuestionCell(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('bigParagraphType')) {
    document.getElementById('bigParagraphType').addEventListener("click", () => {
      if (window.selectedCell) {
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.selectedCell._questionType = "bigParagraph";
          window.updateSimpleQuestionCell(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('multipleTextboxesTypeBtn')) {
    document.getElementById('multipleTextboxesTypeBtn').addEventListener("click", () => {
      if (window.selectedCell) {
        if (typeof window.updateMultipleTextboxHandler === 'function') {
          window.selectedCell._questionType = "multipleTextboxes";
          window.updateMultipleTextboxHandler(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (document.getElementById('multipleDropdownTypeBtn')) {
    document.getElementById('multipleDropdownTypeBtn').addEventListener("click", () => {
      if (window.selectedCell) {
        if (typeof window.updateMultipleTextboxHandler === 'function') {
          window.selectedCell._questionType = "multipleDropdownType";
          window.updateMultipleTextboxHandler(window.selectedCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  // Calc submenu buttons
  if (calcTypeBtn) calcTypeBtn.addEventListener("click", () => {
    if (window.selectedCell) {
      // Extract and preserve the current text content
      if (typeof window.extractTextFromCell === 'function') {
        const preservedText = window.extractTextFromCell(window.selectedCell);
        // Convert to calculation node
        graph.getModel().beginUpdate();
        try {
          if (typeof window.convertToCalculationNode === 'function') {
            window.convertToCalculationNode(window.selectedCell, preservedText);
          }
        } finally {
          graph.getModel().endUpdate();
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
    }
    hideContextMenu();
  });
  if (subtitleTypeBtn) subtitleTypeBtn.addEventListener("click", () => {
    if (window.selectedCell) {
      // Extract and preserve the current text content
      if (typeof window.extractTextFromCell === 'function') {
        const preservedText = window.extractTextFromCell(window.selectedCell);
        // Convert to subtitle node
        graph.getModel().beginUpdate();
        try {
          window.selectedCell.style = window.selectedCell.style.replace(/nodeType=[^;]+/, "nodeType=subtitle");
          window.selectedCell._subtitleText = preservedText || "Subtitle text";
          if (typeof window.updateSubtitleNodeCell === 'function') {
            window.updateSubtitleNodeCell(window.selectedCell);
          }
        } finally {
          graph.getModel().endUpdate();
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
    }
    hideContextMenu();
  });
  if (infoTypeBtn) infoTypeBtn.addEventListener("click", () => {
    if (window.selectedCell) {
      // Extract and preserve the current text content
      if (typeof window.extractTextFromCell === 'function') {
        const preservedText = window.extractTextFromCell(window.selectedCell);
        // Convert to info node
        graph.getModel().beginUpdate();
        try {
          window.selectedCell.style = window.selectedCell.style.replace(/nodeType=[^;]+/, "nodeType=info");
          window.selectedCell._infoText = preservedText || "Information text";
          if (typeof window.updateInfoNodeCell === 'function') {
            window.updateInfoNodeCell(window.selectedCell);
          }
        } finally {
          graph.getModel().endUpdate();
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
    }
    hideContextMenu();
  });
  // Option type submenu event handlers
  if (regularOptionType) {
    regularOptionType.addEventListener("click", () => {
      if (window.selectedCell && typeof window.isOptions === 'function' && window.isOptions(window.selectedCell)) {
        if (typeof window.setOptionType === 'function') {
          window.setOptionType(window.selectedCell, "dropdown");
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (imageOptionType) {
    imageOptionType.addEventListener("click", () => {
      if (window.selectedCell && typeof window.isOptions === 'function' && window.isOptions(window.selectedCell)) {
        if (typeof window.setOptionType === 'function') {
          window.setOptionType(window.selectedCell, "imageOption");
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (amountOptionType) {
    amountOptionType.addEventListener("click", () => {
      if (window.selectedCell && typeof window.isOptions === 'function' && window.isOptions(window.selectedCell)) {
        if (typeof window.setOptionType === 'function') {
          window.setOptionType(window.selectedCell, "amountOption");
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (notesNodeType) {
    notesNodeType.addEventListener("click", () => {
      if (window.selectedCell && typeof window.isOptions === 'function' && window.isOptions(window.selectedCell)) {
        if (typeof window.setOptionType === 'function') {
          window.setOptionType(window.selectedCell, "notesNode");
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (checklistNodeType) {
    checklistNodeType.addEventListener("click", () => {
      if (window.selectedCell && typeof window.isOptions === 'function' && window.isOptions(window.selectedCell)) {
        if (typeof window.setOptionType === 'function') {
          window.setOptionType(window.selectedCell, "checklistNode");
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (alertNodeType) {
    alertNodeType.addEventListener("click", () => {
      if (window.selectedCell && typeof window.isOptions === 'function' && window.isOptions(window.selectedCell)) {
        if (typeof window.setOptionType === 'function') {
          window.setOptionType(window.selectedCell, "alertNode");
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  if (endNodeType) {
    endNodeType.addEventListener("click", () => {
      if (window.selectedCell && typeof window.isOptions === 'function' && window.isOptions(window.selectedCell)) {
        if (typeof window.setOptionType === 'function') {
          window.setOptionType(window.selectedCell, "end");
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  // Properties button event handler
  if (propertiesButton) {
    propertiesButton.addEventListener("click", (event) => {
      if (window.selectedCell) {
        // Use the new popup instead of the old menu
        if (window.showPropertiesPopup) {
          try {
            window.showPropertiesPopup(window.selectedCell);
          } catch (error) {
          }
        } else {
          // Fallback to old properties menu
          if (typeof showPropertiesMenu === 'function') {
            showPropertiesMenu(window.selectedCell, window.currentMouseEvent || { clientX: 0, clientY: 0 });
          } else {
            // Try to wait a bit and check again for showPropertiesPopup
            setTimeout(() => {
              if (typeof window.showPropertiesPopup === 'function') {
                window.showPropertiesPopup(window.selectedCell);
              }
            }, 100);
          }
        }
      }
      // Delay hiding the context menu to give the popup time to be created
      setTimeout(() => {
        hideContextMenu();
      }, 100);
    });
  }
  // Notes context menu event handlers
  if (notesBoldButton) {
    notesBoldButton.addEventListener("click", () => {
      const selectedCells = graph.getSelectionCells();
      if (selectedCells.length === 1 && typeof window.isNotesNode === 'function' && window.isNotesNode(selectedCells[0])) {
        const notesCell = selectedCells[0];
        notesCell._notesBold = !notesCell._notesBold;
        if (typeof window.updateNotesNodeCell === 'function') {
          window.updateNotesNodeCell(notesCell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
        if (typeof window.autosaveFlowchartToLocalStorage === 'function') {
          window.autosaveFlowchartToLocalStorage();
        }
      }
      hideContextMenu();
    });
  }
  if (notesFontButton) {
    notesFontButton.addEventListener("click", () => {
      const selectedCells = graph.getSelectionCells();
      if (selectedCells.length === 1 && typeof window.isNotesNode === 'function' && window.isNotesNode(selectedCells[0])) {
        const notesCell = selectedCells[0];
        const currentFontSize = notesCell._notesFontSize || 14;
        const newFontSize = prompt('Enter font size (number):', currentFontSize);
        if (newFontSize && !isNaN(newFontSize) && newFontSize > 0) {
          notesCell._notesFontSize = parseInt(newFontSize);
          if (typeof window.updateNotesNodeCell === 'function') {
            window.updateNotesNodeCell(notesCell);
          }
          if (typeof window.refreshAllCells === 'function') {
            window.refreshAllCells();
          }
          if (typeof window.autosaveFlowchartToLocalStorage === 'function') {
            window.autosaveFlowchartToLocalStorage();
          }
        }
      }
      hideContextMenu();
    });
  }
  if (notesCopyButton) {
    notesCopyButton.addEventListener("click", () => {
      const selectedCells = graph.getSelectionCells();
      if (selectedCells.length === 1 && typeof window.isNotesNode === 'function' && window.isNotesNode(selectedCells[0])) {
        if (typeof window.copySelectedNodeAsJson === 'function') {
          window.copySelectedNodeAsJson();
        }
      }
      hideContextMenu();
    });
  }
  if (notesDeleteButton) {
    notesDeleteButton.addEventListener("click", () => {
      const selectedCells = graph.getSelectionCells();
      if (selectedCells.length === 1 && typeof window.isNotesNode === 'function' && window.isNotesNode(selectedCells[0])) {
        graph.removeCells(selectedCells);
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
      hideContextMenu();
    });
  }
  // Rename node button event handler
  if (document.getElementById('renameNode')) {
    document.getElementById('renameNode').addEventListener("click", () => {
      if (window.selectedCell) {
        // Show rename popup for any node type
        if (typeof window.showQuestionTextPopup === 'function') {
          window.showQuestionTextPopup(window.selectedCell);
        } else {
          // Fallback: show a simple prompt
          const newText = prompt("Enter new text for the node:", window.selectedCell._questionText || "Node text");
          if (newText && newText.trim()) {
            window.selectedCell._questionText = newText.trim();
            if (typeof window.refreshAllCells === 'function') {
              window.refreshAllCells();
            }
          }
        }
      } else {
      }
      hideContextMenu();
    });
  }
  // Increase the "section number" for a question
  if (document.getElementById('newSectionNode')) {
    document.getElementById('newSectionNode').addEventListener("click", () => {
      if (window.selectedCell) {
        // Check if getSection function exists and works
        if (typeof window.getSection === 'function') {
          // Try to get current section
          const currentSection = window.getSection(window.selectedCell);
          const currentSectionNum = parseInt(currentSection || "1", 10);
          const newSection = currentSectionNum + 1;
          // Check if setSection function exists
          if (typeof window.setSection === 'function') {
            // Call setSection
            try {
              window.setSection(window.selectedCell, newSection);
            } catch (error) {
            }
            // Wait a moment then verify the change
            setTimeout(() => {
              const updatedSection = window.getSection(window.selectedCell);
              // Check if the style actually changed
              if (window.selectedCell.style.includes(`section=${newSection}`)) {
              } else {
              }
              // Try to manually update the style if setSection didn't work
              if (!window.selectedCell.style.includes(`section=${newSection}`)) {
                let style = window.selectedCell.style || "";
                style = style.replace(/section=[^;]+/g, "");
                style += `;section=${newSection};`;
                window.selectedCell.style = style;
              }
            }, 100);
          } else {
          }
        } else {
        }
        // Try to refresh the display
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        } else {
        }
        // Also try graph refresh
        if (window.graph) {
          if (typeof window.graph.refresh === 'function') {
            window.graph.refresh();
          } else {
          }
        } else {
        }
      } else {
      }
      hideContextMenu();
    });
  }
  // Edge context menu event listeners
  if (untangleEdge) {
    untangleEdge.addEventListener('click', function() {
      const selectedCells = graph.getSelectionCells();
      if (selectedCells.length === 1 && selectedCells[0].edge) {
        const edge = selectedCells[0];
        // Reset edge geometry to default (remove any custom points)
        const geo = new mxGeometry();
        graph.getModel().setGeometry(edge, geo);
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      }
      hideContextMenu();
    });
  }
  if (changeEdgeStyle) {
    changeEdgeStyle.addEventListener('click', function() {
      const rect = edgeContextMenu ? edgeContextMenu.getBoundingClientRect() : { right: 0, top: 0 };
      if (edgeStyleSubmenu) {
        edgeStyleSubmenu.style.display = "block";
        edgeStyleSubmenu.style.left = rect.right + "px";
        edgeStyleSubmenu.style.top = rect.top + "px";
      }
    });
  }
  if (disableDragEdge) {
    disableDragEdge.addEventListener('click', function() {
      const selectedCells = graph.getSelectionCells();
      if (selectedCells.length === 1 && selectedCells[0].edge) {
        const edge = selectedCells[0];
        let style = edge.style || "";
        // Check if drag is currently disabled
        const isDragDisabled = style.includes('dragDisabled=1');
        if (isDragDisabled) {
          // Enable drag - remove dragDisabled and strokeDasharray
          style = style.replace(/dragDisabled=1;?/g, '');
          style = style.replace(/strokeDasharray=[^;]+;?/g, '');
          // Clean up any double semicolons
          style = style.replace(/;;+/g, ';');
          if (style.endsWith(';')) {
            style = style.slice(0, -1);
          }
          disableDragEdge.textContent = 'Disable Drag';
        } else {
          // Disable drag - add dragDisabled and make edge dotted
          if (!style.includes('dragDisabled=')) {
            style += (style ? ';' : '') + 'dragDisabled=1';
          }
          // Add or update strokeDasharray for visual indicator
          style = style.replace(/strokeDasharray=[^;]+/g, '');
          style += ';strokeDasharray=5,5';
          disableDragEdge.textContent = 'Enable Drag';
        }
        graph.getModel().setStyle(edge, style);
        graph.refresh();
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      }
      hideContextMenu();
    });
  }
  if (deleteEdge) {
    deleteEdge.addEventListener('click', function() {
      const selectedCells = graph.getSelectionCells();
      if (selectedCells.length === 1 && selectedCells[0].edge) {
        graph.removeCells(selectedCells);
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      }
      hideContextMenu();
    });
  }
  // Edge style submenu event listeners
  if (edgeStyleCurved) {
    edgeStyleCurved.addEventListener('click', function() {
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
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      }
      hideContextMenu();
    });
  }
  if (edgeStyleDirect) {
    edgeStyleDirect.addEventListener('click', function() {
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
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      }
      hideContextMenu();
    });
  }
  // Empty space menu event listeners
  if (placeQuestionNode) {
    placeQuestionNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'question');
      hideContextMenu();
    });
  }
  if (placeOptionNode) {
    placeOptionNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'options');
      hideContextMenu();
    });
  }
  if (placeSampleQuestionNode) {
    placeSampleQuestionNode.addEventListener('click', function() {
      placeSampleQuestion(graph);
      hideContextMenu();
    });
  }
  if (placeMiscellaneousNode) {
    placeMiscellaneousNode.addEventListener('click', function() {
      placeMiscellaneousNodeAtClickLocation(graph);
      hideContextMenu();
    });
  }
  // Global click listener for hiding menus
  document.addEventListener("click", e => {
    // Don't hide context menu if clicking on properties popup
    if (e.target.closest('.properties-modal')) {
      return;
    }
    // Hide menus if clicking outside of them
    if (
      !(contextMenu && contextMenu.contains(e.target)) &&
      !(notesContextMenu && notesContextMenu.contains(e.target)) &&
      !(edgeContextMenu && edgeContextMenu.contains(e.target)) &&
      !(edgeStyleSubmenu && edgeStyleSubmenu.contains(e.target)) &&
      !(typeSubmenu && typeSubmenu.contains(e.target)) &&
      !(calcSubmenu && calcSubmenu.contains(e.target)) &&
      !(optionTypeSubmenu && optionTypeSubmenu.contains(e.target)) &&
      !e.target.closest('.question-type-dropdown')
    ) {
      hideContextMenu();
    }
  });
  // Global contextmenu listener
  document.addEventListener('contextmenu', function(e) {
    if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
  });
}
// Properties Menu Functions
function showPropertiesMenu(cell, evt) {
  if (!cell) {
    return;
  }
  if (propertiesMenu) {
    propertiesMenu.style.display = "block";
    propertiesMenu.style.left = evt.clientX + 10 + "px";
    propertiesMenu.style.top = evt.clientY + 10 + "px";
  } else {
  }
  // Get properties panel elements from the properties module
  const propNodeText = document.getElementById('propNodeText');
  const propNodeId = document.getElementById('propNodeId');
  const propNodeType = document.getElementById('propNodeType');
  const propNodeSection = document.getElementById('propNodeSection');
  const propSectionName = document.getElementById('propSectionName');
  const propPdfNode = document.getElementById('propPdfNode');
  const propPdfFilename = document.getElementById('propPdfFilename');
  if (propNodeText) {
    // For multiple-text or multiple-dropdown
    if (typeof window.isQuestion === 'function' && window.isQuestion(cell) && 
       (typeof window.getQuestionType === 'function' && 
        (window.getQuestionType(cell) === "multipleTextboxes" || 
         window.getQuestionType(cell) === "multipleDropdownType"))) {
      propNodeText.textContent = cell._questionText || "";
    } else {
      // For all normal nodes, extract the plain text from the HTML value
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cell.value || "";
      propNodeText.textContent = (tempDiv.textContent || tempDiv.innerText || "").trim();
    }
  }
  // If it's an amount option
  if (typeof window.isOptions === 'function' && window.isOptions(cell) && 
      typeof window.getQuestionType === 'function' && window.getQuestionType(cell) === "amountOption") {
    const propAmountName = document.getElementById("propAmountName");
    const propAmountPlaceholder = document.getElementById("propAmountPlaceholder");
    const amountProps = document.getElementById("amountProps");
    if (propAmountName) propAmountName.textContent = cell._amountName || "";
    if (propAmountPlaceholder) propAmountPlaceholder.textContent = cell._amountPlaceholder || "";
    if (amountProps) amountProps.style.display = "block";
  } else {
    const amountProps = document.getElementById("amountProps");
    if (amountProps) amountProps.style.display = "none";
  }
  // Check if it's an option node that points to a PDF node
  if (typeof window.isOptions === 'function' && window.isOptions(cell)) {
    const pdfProps = document.getElementById("pdfProps");
    if (pdfProps) {
      // Get the graph to check outgoing edges
      const graph = window.graph;
      if (graph) {
        const outgoingEdges = graph.getOutgoingEdges(cell) || [];
        const pdfNode = outgoingEdges.find(edge => {
          const target = edge.target;
          return typeof window.isPdfNode === 'function' && window.isPdfNode(target);
        });
        if (pdfNode) {
          // Show PDF properties
          pdfProps.style.display = "block";
          // Display PDF node information
          if (propPdfNode) {
            const targetCell = pdfNode.target;
            propPdfNode.textContent = `Node ${targetCell.id}`;
          }
          if (propPdfFilename) {
            const targetCell = pdfNode.target;
            // Extract filename from the PDF node value or use a default
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = targetCell.value || "";
            const pdfText = (tempDiv.textContent || tempDiv.innerText || "").trim();
            propPdfFilename.textContent = pdfText || "PDF Document";
          }
        } else {
          // Hide PDF properties if no PDF node is connected
          pdfProps.style.display = "none";
        }
      }
    }
  } else {
    // Hide PDF properties for non-option nodes
    const pdfProps = document.getElementById("pdfProps");
    if (pdfProps) pdfProps.style.display = "none";
  }
  if (propNodeId) {
    const nodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : "") || "";
    propNodeId.textContent = nodeId;
  }
  if (propNodeSection) propNodeSection.textContent = (typeof window.getSection === 'function' ? window.getSection(cell) : "") || "1";
  const sec = typeof window.getSection === 'function' ? window.getSection(cell) : "1";
  if (propSectionName) {
    const sectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
    propSectionName.textContent = (sectionPrefs[sec] && sectionPrefs[sec].name) || "Enter section name";
  }
  const propQuestionNumber = document.getElementById("propQuestionNumber");
  if (propQuestionNumber) propQuestionNumber.textContent = cell._questionId || "";
  if (propNodeType) {
    if (typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
      propNodeType.textContent = typeof window.getQuestionType === 'function' ? window.getQuestionType(cell) : "question";
    } else if (typeof window.isOptions === 'function' && window.isOptions(cell)) {
      propNodeType.textContent = "options";
    } else if (typeof window.isCalculationNode === 'function' && window.isCalculationNode(cell)) {
      propNodeType.textContent = "calculation";
      // Calculation node properties now handled by calc.js
      if (typeof window.getCalculationNodeProperties === 'function') {
        const calcProps = window.getCalculationNodeProperties(cell);
        if (calcProps) {
          // Display calculation node properties
          propNodeType.textContent = calcProps.nodeType;
          // You can add more property display logic here if needed
        }
      }
    } else if (typeof window.isSubtitleNode === 'function' && window.isSubtitleNode(cell)) {
      propNodeType.textContent = "subtitle";
    } else if (typeof window.isInfoNode === 'function' && window.isInfoNode(cell)) {
      propNodeType.textContent = "info";
    } else {
      propNodeType.textContent = "other";
    }
  }
}
// Node Placement Functions
function placeNodeAtClickLocation(graph, nodeType) {
  if (window.emptySpaceClickX === undefined || window.emptySpaceClickY === undefined) return;
  // Use the global graph variable if the parameter is not available
  const graphToUse = graph || window.graph;
  if (!graphToUse) {
    return;
  }
  const parent = graphToUse.getDefaultParent();
  graphToUse.getModel().beginUpdate();
  let cell;
  try {
    let style = "";
    let label = "";
    let width = 160;
    let height = 80;
    if (nodeType === 'question') {
      // Use the same style as the drag-and-drop elements
      const toolbarShape = document.querySelector('.shape[data-type="question"]');
      if (toolbarShape) {
        style = toolbarShape.dataset.style;
        if (!style.includes("pointerEvents=")) {
          style += "pointerEvents=1;overflow=fill;";
        }
      } else {
        // Fallback style if toolbar element not found
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;spacing=12;fontSize=16;align=center;verticalAlign=middle;";
      }
      label = "question node"; // Set placeholder label to trigger dropdown in refreshAllCells
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
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=notesNode;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Notes text";
      width = 200;
      height = 100;
    } else if (nodeType === 'checklistNode') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=checklistNode;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Checklist text";
      width = 200;
      height = 100;
    } else if (nodeType === 'subtitle') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=subtitle;spacing=12;fontSize=18;align=center;verticalAlign=middle;";
      label = "Subtitle text";
      width = 200;
      height = 60;
    } else if (nodeType === 'info') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=info;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Information text";
      width = 200;
      height = 100;
    } else if (nodeType === 'imageOption') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=imageOption;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Image option";
      width = 200;
      height = 120;
    } else if (nodeType === 'pdfNode') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=pdfNode;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "PDF document";
      width = 200;
      height = 100;
    } else if (nodeType === 'amountOption') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=amountOption;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Amount option";
      width = 200;
      height = 100;
    } else if (nodeType === 'end') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=end;spacing=12;fontSize=16;align=center;verticalAlign=middle;";
      label = "End";
      width = 120;
      height = 60;
    } else if (nodeType === 'hiddenCheckbox') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=hiddenCheckbox;section=1;strokeWidth=3;strokeColor=#0066CC;strokeDasharray=5,5;";
      label = "Hidden Checkbox";
      width = 150;
      height = 80;
    } else if (nodeType === 'hiddenTextbox') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=hiddenTextbox;section=1;strokeWidth=3;strokeColor=#0066CC;strokeDasharray=5,5;";
      label = "Hidden Textbox";
      width = 150;
      height = 80;
    } else if (nodeType === 'linkedLogic') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=linkedLogic;section=1;fillColor=#DDA0DD;strokeColor=#9370DB;";
      label = "Linked Logic";
      width = 150;
      height = 80;
    } else if (nodeType === 'linkedCheckbox') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=linkedCheckbox;section=1;fillColor=#FFB6C1;strokeColor=#FF69B4;";
      label = "Linked Checkbox";
      width = 150;
      height = 80;
    }
    // Create the cell
    cell = graphToUse.insertVertex(parent, null, label, window.emptySpaceClickX, window.emptySpaceClickY, width, height, style);
    // Initialize specific node types - use same logic as drag-and-drop
    if (nodeType === 'question') {
      // Use the same initialization logic as drag-and-drop
      if (typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
        // Only set type if there is a questionType in the style
        if (typeof window.getQuestionType === 'function') {
          const qType = window.getQuestionType(cell);
          if (qType && typeof window.setQuestionType === 'function') {
            window.setQuestionType(cell, qType);
          }
        }
        // Otherwise, leave as unassigned so the dropdown appears
      }
    } else if (nodeType === 'options') {
      // Use same logic as drag-and-drop for options
      if (typeof window.isOptions === 'function' && window.isOptions(cell)) {
        if (typeof window.refreshOptionNodeId === 'function') {
          window.refreshOptionNodeId(cell);
        }
      }
    } else if (nodeType === 'calculation') {
      // Use same logic as drag-and-drop for calculation nodes
      if (typeof window.isCalculationNode === 'function' && window.isCalculationNode(cell)) {
        if (typeof window.initializeCalculationNode === 'function') {
          window.initializeCalculationNode(cell);
        }
      }
    } else if (nodeType === 'notesNode') {
      cell._notesText = "Notes text";
      cell._notesBold = false;
      cell._notesFontSize = 14;
      if (typeof window.updateNotesNodeCell === 'function') {
        window.updateNotesNodeCell(cell);
      }
    } else if (nodeType === 'checklistNode') {
      cell._checklistText = "Checklist text";
      cell._checklistItems = ["Item 1", "Item 2", "Item 3"];
      if (typeof window.updateChecklistNodeCell === 'function') {
        window.updateChecklistNodeCell(cell);
      }
    } else if (nodeType === 'subtitle') {
      cell._subtitleText = "Subtitle text";
      if (typeof window.updateSubtitleNodeCell === 'function') {
        window.updateSubtitleNodeCell(cell);
      }
    } else if (nodeType === 'info') {
      cell._infoText = "Information text";
      if (typeof window.updateInfoNodeCell === 'function') {
        window.updateInfoNodeCell(cell);
      }
    } else if (nodeType === 'imageOption') {
      cell._imageText = "Image option";
      cell._imageUrl = "";
      if (typeof window.updateImageOptionCell === 'function') {
        window.updateImageOptionCell(cell);
      }
    } else if (nodeType === 'pdfNode') {
      cell._pdfText = "PDF document";
      cell._pdfUrl = "";
      if (typeof window.updatePdfNodeCell === 'function') {
        window.updatePdfNodeCell(cell);
      }
    } else if (nodeType === 'amountOption') {
      cell._amountText = "Amount option";
      cell._amountName = "";
      cell._amountPlaceholder = "";
      if (typeof window.updateAmountOptionCell === 'function') {
        window.updateAmountOptionCell(cell);
      }
    } else if (nodeType === 'end') {
      cell._endText = "End";
      if (typeof window.updateEndNodeCell === 'function') {
        window.updateEndNodeCell(cell);
      }
    } else if (nodeType === 'hiddenCheckbox') {
      cell._hiddenNodeId = "hidden_checkbox";
      if (typeof window.updateHiddenCheckboxNodeCell === 'function') {
        window.updateHiddenCheckboxNodeCell(cell);
      }
    } else if (nodeType === 'hiddenTextbox') {
      cell._hiddenNodeId = "hidden_textbox";
      cell._defaultText = "";
      if (typeof window.updateHiddenTextboxNodeCell === 'function') {
        window.updateHiddenTextboxNodeCell(cell);
      }
    } else if (nodeType === 'linkedLogic') {
      cell._linkedLogicNodeId = "linked_logic";
      cell._linkedFields = [];
      if (typeof window.updateLinkedLogicNodeCell === 'function') {
        window.updateLinkedLogicNodeCell(cell);
      }
    } else if (nodeType === 'linkedCheckbox') {
      cell._linkedCheckboxNodeId = "linked_checkbox";
      cell._linkedCheckboxOptions = [];
      if (typeof window.updateLinkedCheckboxNodeCell === 'function') {
        window.updateLinkedCheckboxNodeCell(cell);
      }
    } else if (nodeType === 'inverseCheckbox') {
      cell._inverseCheckboxNodeId = "inverse_checkbox";
      cell._inverseCheckboxOption = "";
      if (typeof window.updateInverseCheckboxNodeCell === 'function') {
        window.updateInverseCheckboxNodeCell(cell);
      }
    }
    // Clear the click position
    window.emptySpaceClickX = undefined;
    window.emptySpaceClickY = undefined;
  } finally {
    graphToUse.getModel().endUpdate();
  }
  // Select the new cell and finalize - use same logic as drag-and-drop
  if (cell) {
    graphToUse.setSelectionCell(cell);
    // Call refreshAllCells for all node types to ensure proper display
    if (typeof window.refreshAllCells === 'function') {
      window.refreshAllCells();
    }
    // Request autosave
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  }
}
// Place Miscellaneous Node at click location
function placeMiscellaneousNodeAtClickLocation(graph) {
  if (window.emptySpaceClickX === undefined || window.emptySpaceClickY === undefined) return;
  // Use the global graph variable if the parameter is not available
  const graphToUse = graph || window.graph;
  if (!graphToUse) {
    return;
  }
  const parent = graphToUse.getDefaultParent();
  graphToUse.getModel().beginUpdate();
  let cell;
  try {
    // Create a question-style node with a dropdown for node type selection
    const style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;nodeId=Miscellaneous_node;section=1;spacing=12;fontSize=16;";
    const label = `<div style="text-align: center; padding: 4px 10px 10px 10px; height: 100%; display: flex; align-items: flex-start; justify-content: center;">
      <select id="miscNodeTypeSelect" style="width: 100%; padding: 14px; border: 1px solid #ccc; border-radius: 4px; font-size: 17px; background-color: white; color: #333; height: 48px;" onchange="convertMiscellaneousNode(this)">
        <option value="">-- Choose Node Type --</option>
        <option value="calculation">Calc Node</option>
        <option value="notesNode">Notes Node</option>
        <option value="checklistNode">Checklist Node</option>
        <option value="subtitle">Subtitle Node</option>
        <option value="info">Info Node</option>
        <option value="imageOption">Image Node</option>
        <option value="pdfNode">PDF Node</option>
        <option value="amountOption">Amount Option Node</option>
        <option value="end">End Node</option>
        <option value="hiddenCheckbox">Hidden Checkbox Node</option>
        <option value="hiddenTextbox">Hidden Textbox Node</option>
        <option value="linkedLogic">Linked Logic Node</option>
        <option value="linkedCheckbox">Linked Checkbox Node</option>
        <option value="inverseCheckbox">Inverse Checkbox Node</option>
      </select>
    </div>`;
    cell = graphToUse.insertVertex(parent, null, label, window.emptySpaceClickX, window.emptySpaceClickY, 280, 80, style);
    // Mark this as a miscellaneous node
    cell._isMiscellaneousNode = true;
    // Clear the click position
    window.emptySpaceClickX = undefined;
    window.emptySpaceClickY = undefined;
  } finally {
    graphToUse.getModel().endUpdate();
  }
  // Select the new cell and finalize
  if (cell) {
    graphToUse.setSelectionCell(cell);
    // Call refreshAllCells to ensure proper display
    if (typeof window.refreshAllCells === 'function') {
      window.refreshAllCells();
    }
    // Request autosave
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  }
}
// Convert Miscellaneous Node to selected type
window.convertMiscellaneousNode = function(selectElement) {
  const selectedType = selectElement.value;
  if (!selectedType) return;
  // Find the cell that contains this select element
  const graph = window.graph;
  if (!graph) return;
  const cells = graph.getChildCells(graph.getDefaultParent(), true, true);
  let targetCell = null;
  // Find the cell that contains this select element
  for (const cell of cells) {
    if (cell._isMiscellaneousNode && cell.value && cell.value.includes(selectElement.id)) {
      targetCell = cell;
      break;
    }
  }
  if (!targetCell) return;
  // Get current position and size
  const geometry = targetCell.geometry;
  const x = geometry.x;
  const y = geometry.y;
  // Use the exact same logic as placeNodeAtClickLocation
  graph.getModel().beginUpdate();
  try {
    // Remove the miscellaneous node marker
    delete targetCell._isMiscellaneousNode;
    let style = "";
    let label = "";
    let width = 160;
    let height = 80;
    // Use exact same logic as placeNodeAtClickLocation
    if (selectedType === 'calculation') {
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
    } else if (selectedType === 'notesNode') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=notesNode;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Notes text";
      width = 200;
      height = 100;
    } else if (selectedType === 'checklistNode') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=checklistNode;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Checklist text";
      width = 200;
      height = 100;
    } else if (selectedType === 'subtitle') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=subtitle;spacing=12;fontSize=18;align=center;verticalAlign=middle;";
      label = "Subtitle text";
      width = 200;
      height = 60;
    } else if (selectedType === 'info') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=info;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Information text";
      width = 200;
      height = 100;
    } else if (selectedType === 'imageOption') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=imageOption;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Image option";
      width = 200;
      height = 120;
    } else if (selectedType === 'pdfNode') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=pdfNode;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "PDF document";
      width = 200;
      height = 100;
    } else if (selectedType === 'amountOption') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=amountOption;spacing=12;fontSize=14;align=center;verticalAlign=middle;";
      label = "Amount option";
      width = 200;
      height = 100;
    } else if (selectedType === 'end') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=end;spacing=12;fontSize=16;align=center;verticalAlign=middle;";
      label = "End";
      width = 120;
      height = 60;
    } else if (selectedType === 'hiddenCheckbox') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=hiddenCheckbox;section=1;strokeWidth=3;strokeColor=#0066CC;strokeDasharray=5,5;";
      label = "Hidden Checkbox";
      width = 150;
      height = 80;
    } else if (selectedType === 'hiddenTextbox') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=hiddenTextbox;section=1;strokeWidth=3;strokeColor=#0066CC;strokeDasharray=5,5;";
      label = "Hidden Textbox";
      width = 150;
      height = 80;
    } else if (selectedType === 'linkedLogic') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=linkedLogic;section=1;fillColor=#DDA0DD;strokeColor=#9370DB;";
      label = "Linked Logic";
      width = 150;
      height = 80;
    } else if (selectedType === 'linkedCheckbox') {
      style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=linkedCheckbox;section=1;fillColor=#FFB6C1;strokeColor=#FF69B4;";
      label = "Linked Checkbox";
      width = 150;
      height = 80;
    }
    // Update the cell with new style, label, and dimensions
    targetCell.style = style;
    targetCell.value = label;
    // Update geometry with new dimensions
    const newGeometry = geometry.clone();
    newGeometry.width = width;
    newGeometry.height = height;
    graph.getModel().setGeometry(targetCell, newGeometry);
    // Initialize specific node types - use exact same logic as placeNodeAtClickLocation
    if (selectedType === 'calculation') {
      // Use same logic as drag-and-drop for calculation nodes
      if (typeof window.isCalculationNode === 'function' && window.isCalculationNode(targetCell)) {
        if (typeof window.initializeCalculationNode === 'function') {
          window.initializeCalculationNode(targetCell);
        }
      }
    } else if (selectedType === 'notesNode') {
      targetCell._notesText = "Notes text";
      targetCell._notesBold = false;
      targetCell._notesFontSize = 14;
      if (typeof window.updateNotesNodeCell === 'function') {
        window.updateNotesNodeCell(targetCell);
      }
    } else if (selectedType === 'checklistNode') {
      targetCell._checklistText = "Checklist text";
      targetCell._checklistItems = ["Item 1", "Item 2", "Item 3"];
      if (typeof window.updateChecklistNodeCell === 'function') {
        window.updateChecklistNodeCell(targetCell);
      }
    } else if (selectedType === 'subtitle') {
      targetCell._subtitleText = "Subtitle text";
      if (typeof window.updateSubtitleNodeCell === 'function') {
        window.updateSubtitleNodeCell(targetCell);
      }
    } else if (selectedType === 'info') {
      targetCell._infoText = "Information text";
      if (typeof window.updateInfoNodeCell === 'function') {
        window.updateInfoNodeCell(targetCell);
      }
    } else if (selectedType === 'imageOption') {
      targetCell._imageText = "Image option";
      targetCell._imageUrl = "";
      if (typeof window.updateImageOptionCell === 'function') {
        window.updateImageOptionCell(targetCell);
      }
    } else if (selectedType === 'pdfNode') {
      targetCell._pdfText = "PDF document";
      targetCell._pdfUrl = "";
      if (typeof window.updatePdfNodeCell === 'function') {
        window.updatePdfNodeCell(targetCell);
      }
    } else if (selectedType === 'amountOption') {
      targetCell._amountText = "Amount option";
      targetCell._amountName = "";
      targetCell._amountPlaceholder = "";
      if (typeof window.updateAmountOptionCell === 'function') {
        window.updateAmountOptionCell(targetCell);
      }
    } else if (selectedType === 'end') {
      targetCell._endText = "End";
      if (typeof window.updateEndNodeCell === 'function') {
        window.updateEndNodeCell(targetCell);
      }
    } else if (selectedType === 'hiddenCheckbox') {
      targetCell._hiddenNodeId = "hidden_checkbox";
      if (typeof window.updateHiddenCheckboxNodeCell === 'function') {
        window.updateHiddenCheckboxNodeCell(targetCell);
      }
    } else if (selectedType === 'hiddenTextbox') {
      targetCell._hiddenNodeId = "hidden_textbox";
      targetCell._defaultText = "";
      if (typeof window.updateHiddenTextboxNodeCell === 'function') {
        window.updateHiddenTextboxNodeCell(targetCell);
      }
    } else if (selectedType === 'linkedLogic') {
      targetCell._linkedLogicNodeId = "linked_logic";
      targetCell._linkedFields = [];
      if (typeof window.updateLinkedLogicNodeCell === 'function') {
        window.updateLinkedLogicNodeCell(targetCell);
      }
    }
  } finally {
    graph.getModel().endUpdate();
  }
  // Refresh the cell display
  if (typeof window.refreshAllCells === 'function') {
    window.refreshAllCells();
  }
  // Request autosave
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
}
/**
 * Place a sample question with "Hungry?" text and yes/no options
 */
function placeSampleQuestion(graph) {
  if (window.emptySpaceClickX === undefined || window.emptySpaceClickY === undefined) return;
  const graphToUse = graph || window.graph;
  if (!graphToUse) {
    return;
  }
  const parent = graphToUse.getDefaultParent();
  graphToUse.getModel().beginUpdate();
  try {
    // Create the main question node (dropdown type)
    const questionStyle = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;questionType=dropdown;spacing=12;fontSize=16;align=center;verticalAlign=middle;pointerEvents=1;overflow=fill;";
    const questionCell = graphToUse.insertVertex(parent, null, "Hungry?", 
      window.emptySpaceClickX, window.emptySpaceClickY, 280, 80, questionStyle);
    // Set question text
    questionCell._questionText = "Hungry?";
    // Create Yes option - positioned slightly to the right of the dropdown
    const yesOptionStyle = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;spacing=12;fontSize=16;align=center;verticalAlign=middle;pointerEvents=1;overflow=fill;";
    const yesOption = graphToUse.insertVertex(parent, null, "Yes", 
      window.emptySpaceClickX + 20, window.emptySpaceClickY + 120, 80, 40, yesOptionStyle);
    yesOption._optionText = "Yes";
    // Create No option - positioned slightly to the right of the dropdown
    const noOptionStyle = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;spacing=12;fontSize=16;align=center;verticalAlign=middle;pointerEvents=1;overflow=fill;";
    const noOption = graphToUse.insertVertex(parent, null, "No", 
      window.emptySpaceClickX + 120, window.emptySpaceClickY + 120, 80, 40, noOptionStyle);
    noOption._optionText = "No";
    // Connect question to options
    graphToUse.insertEdge(parent, null, "", questionCell, yesOption, "edgeStyle=none;rounded=0;orthogonalLoop=0;");
    graphToUse.insertEdge(parent, null, "", questionCell, noOption, "edgeStyle=none;rounded=0;orthogonalLoop=0;");
    // Select the question cell
    graphToUse.setSelectionCell(questionCell);
    // Call refreshAllCells to ensure proper display
    if (typeof window.refreshAllCells === 'function') {
      window.refreshAllCells();
    }
    // Request autosave
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  } catch (error) {
  }
  graphToUse.getModel().endUpdate();
}
// Initialize the module
function initializeContextMenusModule(graph) {
  if (!graph) {
    return;
  }
  // Initialize DOM element references first
  initializeContextMenuElements();
  // Setup context menus
  setupContextMenus(graph);
  // Setup event listeners
  setupContextMenuEventListeners(graph);
}
// Export all functions to window.contextMenus namespace
window.contextMenus = {
  // Core functions
  hideContextMenu,
  getNodeType,
  isEndNode,
  // Setup functions
  setupContextMenus,
  setupContextMenuEventListeners,
  // Menu functions
  showPropertiesMenu,
  placeNodeAtClickLocation,
  // Initialization
  initializeContextMenusModule
};
// Also export individual functions for backward compatibility
Object.assign(window, {
  hideContextMenu,
  hideContextMenuMain,
  getNodeType,
  isEndNode,
  showPropertiesMenu,
  placeNodeAtClickLocation
});
// Test function for debugging context menu properties button
window.testContextMenuProperties = function() {
  const graph = window.graph;
  if (!graph) {
    return;
  }
  const selectedCells = graph.getSelectionCells();
  if (selectedCells.length === 0) {
    const vertices = graph.getChildVertices(graph.getModel().getRoot());
    if (vertices.length > 0) {
      graph.setSelectionCell(vertices[0]);
      window.selectedCell = vertices[0];
    } else {
      return;
    }
  } else {
    window.selectedCell = selectedCells[0];
  }
  // Simulate clicking the properties button
  const propertiesButton = document.getElementById('propertiesButton');
  if (propertiesButton) {
    propertiesButton.click();
  } else {
  }
};
// Initialize the module when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Will be initialized when graph is available
  });
} else {
  // DOM already loaded, will be initialized when graph is available
}