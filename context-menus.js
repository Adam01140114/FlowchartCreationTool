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
let newSectionButton, untangleEdge, changeEdgeStyle, deleteEdge, edgeStyleCurved, edgeStyleDirect;
let placeQuestionNode, placeOptionNode, placeNotesNode, placeChecklistNode, placeSubtitleNode, placeInfoNode, placeImageNode, placePdfNode, placeAmountNode, placeEndNode;


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
  
  newSectionButton = document.getElementById('newSectionButton');
  untangleEdge = document.getElementById('untangleEdge');
  changeEdgeStyle = document.getElementById('changeEdgeStyle');
  deleteEdge = document.getElementById('deleteEdge');
  edgeStyleCurved = document.getElementById('edgeStyleCurved');
  edgeStyleDirect = document.getElementById('edgeStyleDirect');
  
  placeQuestionNode = document.getElementById('placeQuestionNode');
  placeOptionNode = document.getElementById('placeOptionNode');
  placeNotesNode = document.getElementById('placeNotesNode');
  placeChecklistNode = document.getElementById('placeChecklistNode');
  placeSubtitleNode = document.getElementById('placeSubtitleNode');
  placeInfoNode = document.getElementById('placeInfoNode');
  placeImageNode = document.getElementById('placeImageNode');
  placePdfNode = document.getElementById('placePdfNode');
  placeAmountNode = document.getElementById('placeAmountNode');
  placeEndNode = document.getElementById('placeEndNode');
  

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

// Helper function to get node ID
function getNodeId(cell) {
  if (!cell) return "";
  
  // For question nodes, use the _questionId property
  if (typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
    return cell._questionId || "";
  }
  
  // For option nodes, use the _optionId property
  if (typeof window.isOptions === 'function' && window.isOptions(cell)) {
    return cell._optionId || "";
  }
  
  // For other nodes, try to extract from the label
  if (cell.value) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cell.value;
    const text = (tempDiv.textContent || tempDiv.innerText || "").trim();
    // Extract first word as ID
    return text.split(' ')[0] || "";
  }
  
  return "";
}

// Function to auto-select connecting edges
function autoSelectConnectingEdges() {
  const graph = window.graph;
  if (!graph) return;
  
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

// Core Context Menu Functions
function hideContextMenu() {
  if (contextMenu) contextMenu.style.display = 'none';
  if (notesContextMenu) notesContextMenu.style.display = 'none';
  if (edgeContextMenu) edgeContextMenu.style.display = 'none';
  if (edgeStyleSubmenu) edgeStyleSubmenu.style.display = 'none';
  if (typeSubmenu) typeSubmenu.style.display = 'none';
  if (calcSubmenu) calcSubmenu.style.display = 'none';
  if (optionTypeSubmenu) optionTypeSubmenu.style.display = 'none';
  if (emptySpaceMenu) emptySpaceMenu.style.display = 'none';
  if (propertiesMenu) propertiesMenu.style.display = 'none';
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
                changeType.textContent = 'Change Type &raquo;';
              }
            } else if (getNodeType(cell) === 'options') {
              if (yesNoNode) yesNoNode.style.display = 'none';
              if (changeType) {
                changeType.style.display = 'block';
                // Change the text to indicate it's for option types
                changeType.textContent = 'Change Option Type &raquo;';
              }
            } else {
              if (yesNoNode) yesNoNode.style.display = 'none';
              if (changeType) changeType.style.display = 'none';
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
          const oldNodeId = getNodeId(cell);
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
      console.log("Checkbox type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to checkbox type");
        // Clear existing complex structure and convert to checkbox
        window.selectedCell._questionType = "checkbox";
        window.selectedCell._questionText = "Checkbox question node";
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
      console.log("Text type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to text type");
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
      console.log("Dropdown type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to dropdown type");
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
      console.log("Number type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to number type");
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
      console.log("Date type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to date type");
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
      console.log("Date range type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to date range type");
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
      console.log("Email type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to email type");
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
      console.log("Phone type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to phone type");
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
      console.log("Big paragraph type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to big paragraph type");
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
      console.log("Multiple textboxes type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to multiple textboxes type");
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
      console.log("Multiple dropdown type button clicked!");
      if (window.selectedCell) {
        console.log("Converting to multiple dropdown type");
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
    console.log("Regular option type button found, adding event listener");
    regularOptionType.addEventListener("click", () => {
      console.log("Regular option type button clicked!");
      console.log("selectedCell:", window.selectedCell);
      console.log("isOptions function exists:", typeof window.isOptions === 'function');
      if (window.selectedCell && typeof window.isOptions === 'function' && window.isOptions(window.selectedCell)) {
        console.log("Cell is an options node, calling setOptionType");
        if (typeof window.setOptionType === 'function') {
          console.log("setOptionType function exists, calling it");
          window.setOptionType(window.selectedCell, "dropdown");
        } else {
          console.log("setOptionType function not found!");
        }
        if (typeof window.refreshAllCells === 'function') {
          console.log("refreshAllCells function exists, calling it");
          window.refreshAllCells();
        } else {
          console.log("refreshAllCells function not found!");
        }
      } else {
        console.log("Cell is not an options node or isOptions function not found");
      }
      hideContextMenu();
    });
  } else {
    console.log("Regular option type button not found!");
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
    console.log("Properties button found, adding event listener");
    propertiesButton.addEventListener("click", () => {
      console.log("Properties button clicked!");
      console.log("selectedCell:", window.selectedCell);
      console.log("currentMouseEvent:", window.currentMouseEvent);
      if (window.selectedCell && window.currentMouseEvent) {
        showPropertiesMenu(window.selectedCell, window.currentMouseEvent);
      } else {
        console.log("Missing selectedCell or currentMouseEvent");
      }
      hideContextMenu();
    });
  } else {
    console.log("Properties button not found!");
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

  // Increase the "section number" for a question
  if (newSectionButton) {
    newSectionButton.addEventListener("click", () => {
      console.log("New Section button clicked!");
      if (window.selectedCell) {
        console.log("Selected cell:", window.selectedCell);
        // getSection is defined in legend.js
        if (typeof window.getSection === 'function') {
          const currentSection = parseInt(window.getSection(window.selectedCell) || "1", 10);
          console.log("Current section:", currentSection);
          const newSection = currentSection + 1;
          console.log("New section will be:", newSection);
          
          // setSection is defined in legend.js
          if (typeof window.setSection === 'function') {
            console.log("Calling setSection with:", window.selectedCell, newSection);
            window.setSection(window.selectedCell, newSection);
            console.log("setSection completed");
            
            // Verify the change
            const updatedSection = window.getSection(window.selectedCell);
            console.log("Updated section is now:", updatedSection);
          } else {
            console.log("setSection function not found!");
          }
        } else {
          console.log("getSection function not found!");
        }
        
        if (typeof window.refreshAllCells === 'function') {
          console.log("Calling refreshAllCells");
          window.refreshAllCells();
        } else {
          console.log("refreshAllCells function not found!");
        }
      } else {
        console.log("No selected cell!");
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
  
  if (placeNotesNode) {
    placeNotesNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'notesNode');
      hideContextMenu();
    });
  }
  
  if (placeChecklistNode) {
    placeChecklistNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'checklistNode');
      hideContextMenu();
    });
  }
  
  if (placeSubtitleNode) {
    placeSubtitleNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'subtitle');
      hideContextMenu();
    });
  }
  
  if (placeInfoNode) {
    placeInfoNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'info');
      hideContextMenu();
    });
  }
  
  if (placeImageNode) {
    placeImageNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'imageOption');
      hideContextMenu();
    });
  }
  
  if (placePdfNode) {
    placePdfNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'pdfNode');
      hideContextMenu();
    });
  }
  
  if (placeAmountNode) {
    placeAmountNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'amountOption');
      hideContextMenu();
    });
  }
  
  if (placeEndNode) {
    placeEndNode.addEventListener('click', function() {
      placeNodeAtClickLocation(graph, 'end');
      hideContextMenu();
    });
  }

  // Global click listener for hiding menus
  document.addEventListener("click", e => {
    if (
      !(contextMenu && contextMenu.contains(e.target)) &&
      !(notesContextMenu && notesContextMenu.contains(e.target)) &&
      !(edgeContextMenu && edgeContextMenu.contains(e.target)) &&
      !(edgeStyleSubmenu && edgeStyleSubmenu.contains(e.target)) &&
      !(typeSubmenu && typeSubmenu.contains(e.target)) &&
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
  console.log("showPropertiesMenu called with:", cell, evt);
  if (!cell) {
    console.log("No cell provided");
    return;
  }
  if (propertiesMenu) {
    console.log("Properties menu found, showing it");
    propertiesMenu.style.display = "block";
    propertiesMenu.style.left = evt.clientX + 10 + "px";
    propertiesMenu.style.top = evt.clientY + 10 + "px";
  } else {
    console.log("Properties menu not found!");
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

  if (propNodeId) propNodeId.textContent = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : "") || "";
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
    }
    
    // Create the cell
    cell = graph.insertVertex(parent, null, label, window.emptySpaceClickX, window.emptySpaceClickY, width, height, style);
    
    // Initialize specific node types
    if (nodeType === 'question') {
      // Initialize as a simple text question
      cell._questionText = "";
      if (typeof window.updateSimpleQuestionCell === 'function') {
        window.updateSimpleQuestionCell(cell);
      }
    } else if (nodeType === 'calculation') {
      // Initialize calculation node
      if (typeof window.initializeCalculationNode === 'function') {
        window.initializeCalculationNode(cell);
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
    }
    
    // Clear the click position
    window.emptySpaceClickX = undefined;
    window.emptySpaceClickY = undefined;
    
  } finally {
    graph.getModel().endUpdate();
  }
  
  // Select the new cell
  if (cell) {
    graph.setSelectionCell(cell);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  }
}

// Initialize the module
function initializeContextMenusModule(graph) {
  if (!graph) return;
  
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
  getNodeId,
  
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
  getNodeType,
  isEndNode,
  getNodeId,
  showPropertiesMenu,
  placeNodeAtClickLocation
});

// Initialize the module when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Will be initialized when graph is available
  });
} else {
  // DOM already loaded, will be initialized when graph is available
}
