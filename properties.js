/**************************************************
 ************ PROPERTIES PANEL MODULE ********
 **************************************************/
// This module handles all properties panel functionality including:
// - Properties display and management
// - Property editing and validation
// - Section management in properties
// - Editable field functionality

// Use shared dependency accessors from dependencies.js module

// Properties Panel DOM Elements
let propNodeText, propNodeId, propNodeType, propNodeSection, propSectionName, propPdfNode, propPdfFilename;

// Initialize Properties Panel DOM Elements
function initializePropertiesPanelElements() {
  propNodeText = document.getElementById("propNodeText");
  propNodeId = document.getElementById("propNodeId");
  propNodeType = document.getElementById("propNodeType");
  propNodeSection = document.getElementById("propNodeSection");
  propSectionName = document.getElementById("propSectionName");
  propPdfNode = document.getElementById("propPdfNode");
  propPdfFilename = document.getElementById("propPdfFilename");
}

// Utility: make <span> text editable on double-click
function makeEditableField(spanEl, onChangeCb) {
  if (!spanEl) return;
  
  spanEl.addEventListener("dblclick", e => {
    e.stopPropagation();
    e.preventDefault();
    spanEl.contentEditable = "true";
    spanEl.focus();
  });
  
  spanEl.addEventListener("blur", () => {
    spanEl.contentEditable = "false";
    if (onChangeCb) onChangeCb(spanEl.textContent);
  });
  
  spanEl.addEventListener("keydown", evt => {
    if (evt.key === "Delete" || evt.key === "Backspace") {
      evt.stopPropagation();
    }
    if (evt.key === "Enter") {
      evt.preventDefault();
      spanEl.blur();
    }
  });
}

// Node Text Field Change Handler
function onNodeTextFieldChange(newText) {
  const selectedCell = window.selectedCell;
  if (!selectedCell) return;
  
  // Store the old nodeId before making changes (for tracking calculation dependencies)
  const oldNodeId = (typeof window.isQuestion === 'function' && window.isQuestion(selectedCell)) ? 
    (typeof window.getNodeId === 'function' ? window.getNodeId(selectedCell) : null) : null;
  
  const graph = window.graph;
  if (!graph) return;
  
  graph.getModel().beginUpdate();
  try {
    if (typeof window.isQuestion === 'function' && window.isQuestion(selectedCell)) {
      const qType = typeof window.getQuestionType === 'function' ? window.getQuestionType(selectedCell) : "text";
      if (qType === "multipleTextboxes" || qType === "multipleDropdownType") {
        selectedCell._questionText = newText.trim() || "Enter question text";
        if (qType === "multipleTextboxes") {
          if (typeof window.updateMultipleTextboxesCell === 'function') {
            window.updateMultipleTextboxesCell(selectedCell);
          }
        } else {
          if (typeof window.updatemultipleDropdownTypeCell === 'function') {
            window.updatemultipleDropdownTypeCell(selectedCell);
          }
        }
      } else {
        selectedCell.value = newText.trim();
      }
      
      if (typeof window.refreshNodeIdFromLabel === 'function') {
        window.refreshNodeIdFromLabel(selectedCell);
      }
      
      // Update dependent calculation nodes if the text changed 
      // (which would change the nodeId)
      if (oldNodeId && oldNodeId !== (typeof window.getNodeId === 'function' ? window.getNodeId(selectedCell) : null)) {
        if (typeof window.updateAllCalcNodesOnQuestionChange === 'function') {
          window.updateAllCalcNodesOnQuestionChange(selectedCell, false, oldNodeId);
        }
      }
    } else if (typeof window.isOptions === 'function' && window.isOptions(selectedCell)) {
      selectedCell.value = newText.trim();
      if (typeof window.refreshOptionNodeId === 'function') {
        window.refreshOptionNodeId(selectedCell);
      }
    } else if (typeof window.isCalculationNode === 'function' && window.isCalculationNode(selectedCell)) {
      // This is the "title" for the calculation node - now handled by calc.js
      if (typeof window.updateCalculationNodeTitle === 'function') {
        window.updateCalculationNodeTitle(selectedCell, newText);
      }
    } else if (typeof window.isSubtitleNode === 'function' && window.isSubtitleNode(selectedCell)) {
      selectedCell._subtitleText = newText.trim();
      if (typeof window.updateSubtitleNodeCell === 'function') {
        window.updateSubtitleNodeCell(selectedCell);
      }
    } else if (typeof window.isInfoNode === 'function' && window.isInfoNode(selectedCell)) {
      selectedCell._infoText = newText.trim();
      if (typeof window.updateInfoNodeCell === 'function') {
        window.updateInfoNodeCell(selectedCell);
      }
    }
  } finally {
    graph.getModel().endUpdate();
  }
  
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
}

// Node ID Field Change Handler
function onNodeIdFieldChange(newId) {
  const selectedCell = window.selectedCell;
  if (!selectedCell) return;
  
  const graph = window.graph;
  if (!graph) return;
  
  // Store the old nodeId before making changes (for tracking calculation dependencies)
  const oldNodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(selectedCell) : null);
  
  graph.getModel().beginUpdate();
  try {
    if (typeof window.isQuestion === 'function' && window.isQuestion(selectedCell)) {
      selectedCell._questionId = newId.trim();
      if (typeof window.refreshAllCells === 'function') {
        window.refreshAllCells();
      }
      
      // Update dependent calculation nodes if the nodeId changed
      if (oldNodeId && oldNodeId !== newId.trim()) {
        if (typeof window.updateAllCalcNodesOnQuestionChange === 'function') {
          window.updateAllCalcNodesOnQuestionChange(selectedCell, false, oldNodeId);
        }
      }
    }
  } finally {
    graph.getModel().endUpdate();
  }
  
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
}

// Node Section Field Change Handler
function onNodeSectionFieldChange(newSection) {
  const selectedCell = window.selectedCell;
  if (!selectedCell) return;
  
  const graph = window.graph;
  if (!graph) return;
  
  graph.getModel().beginUpdate();
  try {
    if (typeof window.setSection === 'function') {
      window.setSection(selectedCell, newSection.trim());
    }
    if (typeof window.refreshAllCells === 'function') {
      window.refreshAllCells();
    }
  } finally {
    graph.getModel().endUpdate();
  }
  
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
}

// Section Name Field Change Handler
function onSectionNameFieldChange(newName) {
  const selectedCell = window.selectedCell;
  if (!selectedCell) return;
  
  const graph = window.graph;
  if (!graph) return;
  
  const section = typeof window.getSection === 'function' ? window.getSection(selectedCell) : "1";
  
  graph.getModel().beginUpdate();
  try {
    if (typeof window.setSectionName === 'function') {
      window.setSectionName(section, newName.trim());
    }
    if (typeof window.refreshAllCells === 'function') {
      window.refreshAllCells();
    }
  } finally {
    graph.getModel().endUpdate();
  }
  
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
}

// Setup Properties Panel Event Listeners
function setupPropertiesPanelEventListeners() {
  // Properties button event listener is now handled by context-menus.js
  // No need to duplicate the event listener here
}

// Setup Reset Node ID Button
function setupResetNodeIdButton() {
  const resetBtn = document.getElementById('resetNodeIdBtn');
  if (!resetBtn) {
    console.warn("Reset Node ID button not found");
    return;
  }
  
  resetBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const selectedCell = window.selectedCell;
    if (!selectedCell) {
      console.warn("No cell selected for reset");
      return;
    }
    
    // Generate the correct Node ID using the naming convention
    let correctNodeId = '';
    if (typeof window.generateCorrectNodeId === 'function') {
      correctNodeId = window.generateCorrectNodeId(selectedCell);
    } else {
      console.warn("generateCorrectNodeId function not available");
      return;
    }
    
    if (!correctNodeId) {
      console.warn("Could not generate correct Node ID");
      return;
    }
    
    // Update the Node ID field display
    if (propNodeId) {
      propNodeId.textContent = correctNodeId;
    }
    
    // Update the actual cell's Node ID
    if (typeof window.setNodeId === 'function') {
      window.setNodeId(selectedCell, correctNodeId);
    } else {
      console.warn("setNodeId function not available");
      return;
    }
    
    // Refresh all cells to update the display
    if (typeof window.refreshAllCells === 'function') {
      window.refreshAllCells();
    }
    
    // Trigger autosave
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    
    console.log("Node ID reset to:", correctNodeId);
  });
}

// Setup Editable Fields
function setupEditableFields() {
  if (!propNodeText || !propNodeId || !propNodeSection || !propSectionName) {
    console.warn("Properties panel elements not found, skipping editable field setup");
    return;
  }
  
  makeEditableField(propNodeText, onNodeTextFieldChange);
  makeEditableField(propNodeId, onNodeIdFieldChange);
  makeEditableField(propNodeSection, onNodeSectionFieldChange);
  makeEditableField(propSectionName, onSectionNameFieldChange);
  
  // Setup reset button for Node ID
  setupResetNodeIdButton();

  // For amount fields
  const propAmountName = document.getElementById("propAmountName");
  const propAmountPlaceholder = document.getElementById("propAmountPlaceholder");
  
  if (propAmountName) {
    makeEditableField(propAmountName, (newName) => {
      if (window.selectedCell && 
          typeof window.getQuestionType === 'function' && 
          window.getQuestionType(window.selectedCell) === "amountOption") {
        window.selectedCell._amountName = newName.trim();
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
    });
  }
  
  if (propAmountPlaceholder) {
    makeEditableField(propAmountPlaceholder, (newPh) => {
      if (window.selectedCell && 
          typeof window.getQuestionType === 'function' && 
          window.getQuestionType(window.selectedCell) === "amountOption") {
        window.selectedCell._amountPlaceholder = newPh.trim();
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      }
    });
  }
}

// Initialize the Properties Panel Module
function initializePropertiesPanelModule() {
  // Initialize DOM elements
  initializePropertiesPanelElements();
  
  // Setup event listeners
  setupPropertiesPanelEventListeners();
  
  // Setup editable fields
  setupEditableFields();
}

// Export all functions to window.properties namespace
window.properties = {
  // Core functions
  makeEditableField,
  
  // Change handlers
  onNodeTextFieldChange,
  onNodeIdFieldChange,
  onNodeSectionFieldChange,
  onSectionNameFieldChange,
  
  // Setup functions
  setupPropertiesPanelEventListeners,
  setupEditableFields,
  setupResetNodeIdButton,
  
  // Initialization
  initializePropertiesPanelModule
};

// Also export individual functions for backward compatibility
Object.assign(window, {
  makeEditableField,
  onNodeTextFieldChange,
  onNodeIdFieldChange,
  onNodeSectionFieldChange,
  onSectionNameFieldChange,
  setupResetNodeIdButton
});

// Initialize the module when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Will be initialized when graph is available
  });
} else {
  // DOM already loaded, will be initialized when graph is available
}
