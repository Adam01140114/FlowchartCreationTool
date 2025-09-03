/**************************************************
 ************ QUESTION NODES MODULE ********
 **************************************************/
// This module handles all question node functionality including:
// - Question type detection and switching
// - Question rendering and updates
// - Multiple textboxes and dropdown handling
// - Question type event handlers

// Use shared dependency accessors from dependencies.js module

// Core Question Functions
function isQuestion(cell) {
  return cell && cell.style && cell.style.includes("nodeType=question");
}

function getQuestionType(cell) {
  const style = cell.style || "";
  const m = style.match(/questionType=([^;]+)/);
  return m ? m[1] : "";
}

function isSimpleHtmlQuestion(cell) {
  if (!cell || !cell.style) return false;
  const qt = getQuestionType(cell);
  return qt === 'text' || qt === 'number' || qt === 'date' || qt === 'email' || qt === 'phone' || qt === 'bigParagraph';
}

// Question Type Switching
function setQuestionType(cell, newType) {
  const graph = getGraph();
  if (!graph) return;
  
  // Extract and preserve the current text content
  const preservedText = extractTextFromCell(cell);
  
  /* —— 1. update style —— */
  let st = (cell.style || '').replace(/questionType=[^;]+/, '');
  st += `;questionType=${newType};align=center;verticalAlign=middle;spacing=12;`;
  
  // For text2, allow double-click editing directly
  if (newType === 'text2') {
    st += 'editable=1;';
  } else if (!/pointerEvents=/.test(st)) {
    st += 'pointerEvents=1;overflow=fill;';
  }
  
  graph.getModel().setStyle(cell, st);

  /* —— 2. update internals —— */
  graph.getModel().beginUpdate();
  try {
    switch (newType) {
      case 'text': case 'date': case 'number': case 'bigParagraph':
      case 'dateRange': case 'email': case 'phone': case 'checkbox':
        // Preserve the text content
        cell._questionText = preservedText || '';
        updateSimpleQuestionCell(cell);
        break;
      case 'text2':
        cell._questionText = preservedText || '';
        updateText2Cell(cell);
        break;
      case 'multipleTextboxes':
        cell._questionText = preservedText || '';
        cell._textboxes = [{ nameId:'', placeholder:'Enter value' }];
        updateMultipleTextboxesCell(cell);
        break;
      case 'multipleDropdownType':
        cell._questionText = preservedText || '';
        cell._twoNumbers = { first:'0', second:'0' };
        cell._textboxes = [{ nameId:'', placeholder:'Enter value', isAmountOption:false }];
        updatemultipleDropdownTypeCell(cell);
        break;
      default:
        cell._questionText = preservedText || '';
        updateSimpleQuestionCell(cell);
    }
    refreshNodeIdFromLabel(cell);
  } finally {
    graph.getModel().endUpdate();
  }
  getRefreshAllCells()();
}

// Helper function to extract text content from a cell
function extractTextFromCell(cell) {
  if (!cell) return '';
  
  // First, try to get text from _questionText property
  if (cell._questionText && cell._questionText.trim()) {
    return cell._questionText.trim();
  }
  
  // If no _questionText, try to extract from the cell value
  if (cell.value) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cell.value;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    return textContent.trim();
  }
  
  return '';
}

// Question Rendering Functions
function updateText2Cell(cell) {
  const graph = getGraph();
  if (!graph) return;
  
  const text = cell._questionText || '';
  const html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
    <div class="question-title-input" contenteditable="true" onfocus="if(this.innerText==='Textbox Dropdown question node')this.innerText='';" onblur="window.updateText2Title('${cell.id}', this.innerText)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')">${getEscapeHtml()(text) || 'Textbox Dropdown question node'}</div>
  </div>`;
  
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
    let st = cell.style || '';
    if (!st.includes('verticalAlign=middle')) {
      st += 'verticalAlign=middle;';
    }
    graph.getModel().setStyle(cell, st);
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

function renderSimpleQuestionTitle(cell, placeholder) {
  const text = cell._questionText || '';
  return `<div class="question-title-input" onfocus="if(this.innerText==='${placeholder}')this.innerText='';" onblur="window.updateSimpleQuestionTitle('${cell.id}', this.innerText)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')">${getEscapeHtml()(text) || placeholder}</div>`;
}

function renderInputQuestionTitle(cell, placeholder) {
  const text = cell._questionText || '';
  return `<input class="question-title-input" type="text" value="${getEscapeAttr()(text)}" placeholder="${placeholder}" oninput="window.updateInputQuestionTitle('${cell.id}', this.value)" onblur="window.updateInputQuestionTitle('${cell.id}', this.value)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')" />`;
}

function updateSimpleQuestionCell(cell) {
  const graph = getGraph();
  if (!graph) return;
  
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

// Multiple Textboxes Functions
function renderTextboxes(cell) {
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: "", placeholder: "Enter value" }];
  }

  let html = "";

  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || "";
    const ph  = tb.placeholder || "Enter value";

    html += `
      <div class="textbox-entry" style="margin-bottom:8px;text-align:center;">
        <input type="text" value="${getEscapeAttr()(val)}" data-index="${index}" placeholder="${getEscapeAttr()(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updateMultipleTextboxHandler('${cell.id}', ${index}, this.value)" />
        <button onclick="window.deleteMultipleTextboxHandler('${cell.id}', ${index})">Delete</button>
      </div>`;
  });

  html += `
    <div style="text-align:center;margin-top:8px;">
      <button onclick="window.addMultipleTextboxHandler('${cell.id}')">Add Option</button>
    </div>`;

  return html;
}

function updateMultipleTextboxesCell(cell) {
  const graph = getGraph();
  if (!graph) return;
  
  graph.getModel().beginUpdate();
  try {
    let html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
      <input class="question-title-input" type="text" value="${getEscapeAttr()(cell._questionText || "")}" placeholder="Enter question text" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updateInputQuestionTitle('${cell.id}', this.value)" style="margin-bottom:8px; width:90%; text-align:center;" />
      <div class="multiple-textboxes-container" style="padding: 8px; width:100%;">${renderTextboxes(cell)}</div>
    </div>`;
    cell.value = html;
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

// Multiple Dropdown Type Functions
function updatemultipleDropdownTypeCell(cell) {
  const graph = getGraph();
  if (!graph) return;
  
  const qText = cell._questionText || '';
  const twoNums = cell._twoNumbers || { first: '0', second: '0' };
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: '', placeholder: 'Enter value', isAmountOption: false }];
  }
  let html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
    <input class="question-title-input" type="text" value="${getEscapeAttr()(qText)}" placeholder="Enter question text" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeTextHandler('${cell.id}', this.value)" style="margin-bottom:8px; width:90%; text-align:center;" />
    <div class="two-number-container" style="display: flex; justify-content:center; gap: 10px; margin-top: 8px; width:100%;">
      <input type="number" value="${getEscapeAttr()(twoNums.first)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'first', this.value)"/>
      <input type="number" value="${getEscapeAttr()(twoNums.second)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'second', this.value)"/>
    </div>
    <div class="multiple-textboxes-container" style="margin-top:8px;width:100%;">`;
  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || '';
    const ph = tb.placeholder || 'Enter value';
    const checked = tb.isAmountOption ? 'checked' : '';
    html += `
      <div class="textbox-entry" style="margin-bottom:4px; text-align:center;">
        <input type="text" value="${getEscapeAttr()(val)}" data-index="${index}" placeholder="${getEscapeAttr()(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeHandler('${cell.id}', ${index}, this.value)"/>
        <button onclick="window.deletemultipleDropdownTypeHandler('${cell.id}', ${index})">Delete</button>
        <label>
          <input type="checkbox" ${checked} onclick="window.toggleMultipleDropdownAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });
  html += `<div style="text-align:center; margin-top:8px;"><button onclick="window.addmultipleDropdownTypeHandler('${cell.id}')">Add Option</button></div>
    </div>
  </div>`;
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
}

// Question Type Event Handlers
function setupQuestionTypeEventListeners() {
  const graph = getGraph();
  if (!graph) return;
  
  const checkboxTypeBtn = document.getElementById("checkboxType");
  const textTypeBtn = document.getElementById("textType");
  const moneyTypeBtn = document.getElementById("moneyType");
  const dateTypeBtn = document.getElementById("dateType");
  const dateRangeTypeBtn = document.getElementById("dateRangeType");
  const emailTypeBtn = document.getElementById("emailType");
  const phoneTypeBtn = document.getElementById("phoneType");
  const bigParagraphTypeBtn = document.getElementById("bigParagraphType");
  const multipleTextboxesTypeBtn = document.getElementById("multipleTextboxesTypeBtn");
  const multipleDropdownTypeBtn = document.getElementById("multipleDropdownTypeBtn");
  const text2TypeBtn = document.getElementById("text2Type");

  // Submenu question-type events
  if (checkboxTypeBtn) {
    checkboxTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "checkbox");
        getRefreshAllCells()();
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (textTypeBtn) {
    textTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "text");
        getRefreshAllCells()();
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (text2TypeBtn) {
    text2TypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "text2");
        getRefreshAllCells()();
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (moneyTypeBtn) {
    moneyTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "number");
        getRefreshAllCells()();
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (dateTypeBtn) {
    dateTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "date");
        getRefreshAllCells()();
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (dateRangeTypeBtn) {
    dateRangeTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "dateRange");
        getRefreshAllCells()();
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (emailTypeBtn) {
    emailTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "email");
        getRefreshAllCells()();
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (phoneTypeBtn) {
    phoneTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "phone");
        getRefreshAllCells()();
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (bigParagraphTypeBtn) {
    bigParagraphTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "bigParagraph");
        getRefreshAllCells()();
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (multipleTextboxesTypeBtn) {
    multipleTextboxesTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "multipleTextboxes");
        if (!window.selectedCell._questionText) {
          window.selectedCell._questionText = "Enter question text";
        }
        if (!window.selectedCell._textboxes) {
          window.selectedCell._textboxes = [{ nameId: "", placeholder: "Enter value" }];
        }
        let st = window.selectedCell.style || "";
        if (!st.includes("pointerEvents=")) {
          st += "pointerEvents=1;overflow=fill;";
        }
        graph.getModel().setStyle(window.selectedCell, st);
        updateMultipleTextboxesCell(window.selectedCell);
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }

  if (multipleDropdownTypeBtn) {
    multipleDropdownTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "multipleDropdownType");
        if (!window.selectedCell._questionText) {
          window.selectedCell._questionText = "Enter question text";
        }
        if (!window.selectedCell._twoNumbers) {
          window.selectedCell._twoNumbers = { first: "0", second: "0" };
        }
        if (!window.selectedCell._textboxes) {
          window.selectedCell._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
        }
        let st = window.selectedCell.style || "";
        if (!st.includes("pointerEvents=")) {
          st += "pointerEvents=1;overflow=fill;";
        }
        graph.getModel().setStyle(window.selectedCell, st);
        updatemultipleDropdownTypeCell(window.selectedCell);
      }
      if (typeof window.hideContextMenu === 'function') {
        window.hideContextMenu();
      }
    });
  }
}

// Global function handlers for HTML event handlers
window.updateSimpleQuestionTitle = function(cellId, text) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (!cell) return;
  getGraph().getModel().beginUpdate();
  try {
    cell._questionText = text.replace(/<[^>]+>/g, '').trim() || '';
  } finally {
    getGraph().getModel().endUpdate();
  }
  // Only re-render on blur, not on every input
  updateSimpleQuestionCell(cell);
  if (typeof window.refreshNodeIdFromLabel === 'function') {
    window.refreshNodeIdFromLabel(cell);
  }
};

window.updateInputQuestionTitle = function(cellId, text) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (!cell) return;
  getGraph().getModel().beginUpdate();
  try {
    cell._questionText = text.trim();
  } finally {
    getGraph().getModel().endUpdate();
  }
  // Only re-render on blur, not on every input
  if (getQuestionType(cell) === 'multipleTextboxes') {
    updateMultipleTextboxesCell(cell);
  } else if (getQuestionType(cell) === 'multipleDropdownType') {
    updatemultipleDropdownTypeCell(cell);
  }
  if (typeof window.refreshNodeIdFromLabel === 'function') {
    window.refreshNodeIdFromLabel(cell);
  }
};

window.handleTitleInputKeydown = function(event, cellId) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.target.blur();
  }
  // Do not stop propagation for copy/cut/paste
};

// Multiple textboxes handlers
window.updateMultipleTextboxHandler = function(cellId, index, value) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes" && cell._textboxes) {
    getGraph().getModel().beginUpdate();
    try {
      cell._textboxes[index].nameId = value;
    } finally {
      getGraph().getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

window.addMultipleTextboxHandler = function(cellId) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes") {
    getGraph().getModel().beginUpdate();
    try {
      if (!cell._textboxes) cell._textboxes = [];
      cell._textboxes.push({ nameId: "", placeholder: "Enter value" });
    } finally {
      getGraph().getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

window.deleteMultipleTextboxHandler = function(cellId, index) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes" && cell._textboxes) {
    getGraph().getModel().beginUpdate();
    try {
      cell._textboxes.splice(index, 1);
    } finally {
      getGraph().getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

// Multiple dropdown type handlers
window.updatemultipleDropdownTypeTextHandler = function(cellId, text) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    getGraph().getModel().beginUpdate();
    try {
      cell._questionText = text.trim() || "Enter question text";
    } finally {
      getGraph().getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.updatemultipleDropdownTypeNumber = function(cellId, which, value) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    getGraph().getModel().beginUpdate();
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
      getGraph().getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.updatemultipleDropdownTypeHandler = function(cellId, index, value) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes) {
    getGraph().getModel().beginUpdate();
    try {
      let existingPlaceholder = cell._textboxes[index].placeholder;
      if (!existingPlaceholder || existingPlaceholder === "Enter value") {
        cell._textboxes[index].placeholder = value || "";
      }
      cell._textboxes[index].nameId = value;
    } finally {
      getGraph().getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.addmultipleDropdownTypeHandler = function(cellId) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    getGraph().getModel().beginUpdate();
    try {
      if (!cell._textboxes) cell._textboxes = [];
      cell._textboxes.push({ nameId: "", placeholder: "Enter value", isAmountOption: false });
    } finally {
      getGraph().getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.deletemultipleDropdownTypeHandler = function(cellId, index) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes) {
    getGraph().getModel().beginUpdate();
    try {
      cell._textboxes.splice(index, 1);
    } finally {
      getGraph().getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.toggleMultipleDropdownAmount = function(cellId, index, checked) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes) {
    getGraph().getModel().beginUpdate();
    try {
      cell._textboxes[index].isAmountOption = checked;
    } finally {
      getGraph().getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

// Global function for type switching
window.pickTypeForCell = function(cellId, val) {
  if (!val) {
    return; // Do nothing if no type selected
  }
  const graph = getGraph();
  if (!graph) return;
  
  const c = graph.getModel().getCell(cellId);
  if (!c) {
    return;
  }

  graph.getModel().beginUpdate();
  try {
    setQuestionType(c, val);
    if (!c._nameId) {
      c._nameId = "answer" + graph.getChildVertices(graph.getDefaultParent()).length;
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
  getRefreshAllCells()();
};

// Initialize the module
function initializeQuestionsModule() {
  // Setup event listeners when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupQuestionTypeEventListeners);
  } else {
    setupQuestionTypeEventListeners();
  }
}

// Export all functions to window.questions namespace
window.questions = {
  // Core functions
  isQuestion,
  getQuestionType,
  setQuestionType,
  isSimpleHtmlQuestion,
  extractTextFromCell,
  
  // Rendering functions
  updateText2Cell,
  renderSimpleQuestionTitle,
  renderInputQuestionTitle,
  updateSimpleQuestionCell,
  updateMultipleTextboxesCell,
  updatemultipleDropdownTypeCell,
  
  // Multiple textboxes functions
  renderTextboxes,
  
  // Event handlers
  setupQuestionTypeEventListeners,
  
  // Initialization
  initializeQuestionsModule
};

// Also export individual functions for backward compatibility
Object.assign(window, {
  isQuestion,
  getQuestionType,
  setQuestionType,
  isSimpleHtmlQuestion,
  extractTextFromCell,
  updateText2Cell,
  renderSimpleQuestionTitle,
  renderInputQuestionTitle,
  updateSimpleQuestionCell,
  updateMultipleTextboxesCell,
  updatemultipleDropdownTypeCell,
  renderTextboxes,
  pickTypeForCell
});

// Initialize the module
initializeQuestionsModule();
