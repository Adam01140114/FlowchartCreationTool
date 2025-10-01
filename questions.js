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
    // DISABLED: Automatic Node ID generation when setting question type
    // Node IDs will only change when manually edited or reset using the button
  } finally {
    graph.getModel().endUpdate();
  }
  getRefreshAllCells()();
}

// Helper function to extract text content from a cell
function extractTextFromCell(cell) {
  if (!cell) return '';
  
  // First, try to get text from _questionText property, but only if it's not dropdown options
  if (cell._questionText && cell._questionText.trim()) {
    // Check if _questionText contains dropdown options
    if (cell._questionText.includes('-- Choose Question Type --') || 
        cell._questionText.includes('Text Dropdown Checkbox Number Date Big Paragraph')) {
      // This is dropdown options, ignore it and try to extract from cell.value
    } else {
      return cell._questionText.trim();
    }
  }
  
  // If no valid _questionText, try to extract from the cell value
  if (cell.value) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cell.value;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    // Check if the extracted text is dropdown options
    if (textContent.includes('-- Choose Question Type --') || 
        textContent.includes('Text Dropdown Checkbox Number Date Big Paragraph')) {
      // This is dropdown options, return empty string
      return '';
    }
    
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
  const questionType = getQuestionType(cell);
  
  // Debug logging for date range nodes
  console.log('🔧 [RENDER DEBUG] Cell ID:', cell.id, 'Question Type:', questionType, 'Cell style:', cell.style);
  
  // For date range nodes, add a copy ID button
  if (questionType === 'dateRange') {
    console.log('🔧 [RENDER DEBUG] Rendering date range node with copy ID button');
    return `<div style="display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; justify-content: center;">
      <div class="question-title-input" onfocus="if(this.innerText==='${placeholder}')this.innerText='';" onblur="window.updateSimpleQuestionTitle('${cell.id}', this.innerText)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')" style="margin-bottom: 8px;">${getEscapeHtml()(text) || placeholder}</div>
      <button onclick="window.showDateRangeCopyDialog('${cell.id}')" style="padding: 6px 12px; background-color: #007bff; color: white; border: 2px solid #0056b3; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Copy ID" onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007bff'">Copy ID</button>
    </div>`;
  }
  
  console.log('🔧 [RENDER DEBUG] Rendering normal node without copy ID button');
  return `<div class="question-title-input" onfocus="if(this.innerText==='${placeholder}')this.innerText='';" onblur="window.updateSimpleQuestionTitle('${cell.id}', this.innerText)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')">${getEscapeHtml()(text) || placeholder}</div>`;
}

function renderInputQuestionTitle(cell, placeholder) {
  const text = cell._questionText || '';
  return `<input class="question-title-input" type="text" value="${getEscapeAttr()(text)}" placeholder="${placeholder}" oninput="window.updateInputQuestionTitle('${cell.id}', this.value)" onblur="window.updateInputQuestionTitle('${cell.id}', this.value)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')" />`;
}

function updateSimpleQuestionCell(cell) {
  const graph = getGraph();
  if (!graph) return;
  
  // If the cell doesn't have a question type yet, show the dropdown
  if (!cell._questionType || cell._questionType === '') {
    const html = `
      <div style="display: flex; justify-content: center; align-items: center; height:100%;">
        <select class="question-type-dropdown" data-cell-id="${cell.id}" style="margin:auto; font-size: 1.1em; padding: 10px 18px; border-radius: 8px; border: 1px solid #b0b8c9; box-shadow: 0 2px 8px rgba(0,0,0,0.07); background: #f8faff; color: #222; transition: border-color 0.2s, box-shadow 0.2s; outline: none; min-width: 220px; cursor:pointer;"
          onfocus="this.style.borderColor='#4a90e2'; this.style.boxShadow='0 0 0 2px #b3d4fc';"
          onblur="this.style.borderColor='#b0b8c9'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)';"
          onmouseover="this.style.borderColor='#4a90e2';"
          onmouseout="this.style.borderColor='#b0b8c9';"
          onmousedown="event.stopPropagation();"
          onclick="event.stopPropagation();"
          onchange="window.pickTypeForCell('${cell.id}', this.value)">
          <option value="">-- Choose Question Type --</option>
          <option value="text">Text</option>
          <option value="text2">Dropdown</option>
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
    graph.getModel().setValue(cell, html);
  } else {
    // If question type is already set, render the normal title
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
        <button onclick="window.copyMultipleTextboxId('${cell.id}', ${index})" style="margin-left: 4px; background-color: #4CAF50; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Copy ID</button>
      </div>`;
  });

  html += `
    <div style="text-align:center;margin-top:8px;">
      <button onclick="window.addMultipleTextboxHandler('${cell.id}')">Add Option</button>
      <button onclick="window.showReorderModal('${cell.id}', 'multipleTextboxes')" style="margin-left: 8px; background-color: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">Reorder</button>
    </div>`;

  return html;
}

// Copy ID function for multiple textboxes
window.copyMultipleTextboxId = function(cellId, index) {
  const cell = getGraph().getModel().getCell(cellId);
  if (!cell || !cell._textboxes || !cell._textboxes[index]) return;
  
  const questionText = cell._questionText || '';
  const entryText = cell._textboxes[index].nameId || '';
  
  // Check if this question has a PDF property (only for nodes that should have PDF properties)
  const pdfName = findPdfNameForQuestion(cell);
  const sanitizedPdfName = pdfName ? sanitizePdfName(pdfName) : '';
  
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
  closeBtn.innerHTML = '×';
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
    dragHandle.innerHTML = '⋮⋮';
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
    
    // Create amount checkbox
    const amountContainer = document.createElement('div');
    amountContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      margin-right: 12px;
    `;
    
    const amountCheckbox = document.createElement('input');
    amountCheckbox.type = 'checkbox';
    amountCheckbox.checked = entry.isAmount || false;
    amountCheckbox.onchange = () => {
      window.toggleReorderAmount(cellId, index, amountCheckbox.checked);
    };
    amountCheckbox.style.cssText = `
      margin: 0;
    `;
    
    const amountLabel = document.createElement('label');
    amountLabel.textContent = 'Amount?';
    amountLabel.style.cssText = `
      font-size: 12px;
      color: #666;
      cursor: pointer;
      margin: 0;
    `;
    
    amountContainer.appendChild(amountCheckbox);
    amountContainer.appendChild(amountLabel);
    
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
    listItem.appendChild(amountContainer);
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
  
  // Create Add Option button
  const addOptionContainer = document.createElement('div');
  addOptionContainer.style.cssText = `
    text-align: center;
    margin-bottom: 20px;
  `;
  
  const addOptionBtn = document.createElement('button');
  addOptionBtn.textContent = 'Add Option';
  addOptionBtn.style.cssText = `
    background: #007bff;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 14px;
    transition: background-color 0.2s;
  `;
  addOptionBtn.onmouseover = () => addOptionBtn.style.backgroundColor = '#0056b3';
  addOptionBtn.onmouseout = () => addOptionBtn.style.backgroundColor = '#007bff';
  addOptionBtn.onclick = () => {
    window.addOptionInReorderModal(cellId, questionType);
    modalOverlay.remove();
    showReorderModal(cellId, questionType); // Refresh modal
  };
  
  addOptionContainer.appendChild(addOptionBtn);
  
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
  modalContent.appendChild(addOptionContainer);
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

// Helper function to toggle amount checkbox in reorder modal
function toggleReorderAmount(cellId, index, isAmount) {
  const cell = getGraph().getModel().getCell(cellId);
  if (cell && cell._textboxes && cell._textboxes[index]) {
    cell._textboxes[index].isAmount = isAmount;
    
    // Refresh the specific cell to update the UI
    if (typeof window.refreshSpecificCells === 'function') {
      window.refreshSpecificCells([cell]);
    }
    
    // Autosave the changes
    getRequestAutosave()();
  }
}

// Helper function to add option in reorder modal
function addOptionInReorderModal(cellId, questionType) {
  const cell = getGraph().getModel().getCell(cellId);
  if (cell && cell._textboxes) {
    // Add a new entry
    const newEntry = {
      nameId: `New Option ${cell._textboxes.length + 1}`,
      placeholder: `New Option ${cell._textboxes.length + 1}`,
      isAmount: false
    };
    
    cell._textboxes.push(newEntry);
    
    // Refresh the specific cell to update the UI
    if (typeof window.refreshSpecificCells === 'function') {
      window.refreshSpecificCells([cell]);
    }
    
    // Autosave the changes
    getRequestAutosave()();
  }
}

// Helper function to find PDF name for a question node
function findPdfNameForQuestion(cell) {
  if (!cell) return null;
  
  const graph = getGraph();
  if (!graph) return null;
  
  // Use the same logic as getPdfName function in nodes.js for consistency
  const findPdfProperties = (startCell) => {
    // Check if this node has direct PDF properties
    if (startCell._pdfName || startCell._pdfFilename || startCell._pdfUrl) {
      return {
        nodeId: startCell.id,
        filename: startCell._pdfUrl || startCell._pdfFilename || startCell._pdfName || "",
        pdfUrl: startCell._pdfUrl || "",
        priceId: startCell._priceId || ""
      };
    }
    
    // Check if this is a PDF node
    if (typeof window.isPdfNode === 'function' && window.isPdfNode(startCell)) {
      return {
        nodeId: startCell.id,
        filename: startCell._pdfUrl || "",
        pdfUrl: startCell._pdfUrl || "",
        priceId: startCell._priceId || ""
      };
    }
    
    // Check direct outgoing connections to PDF nodes
    const outgoingEdges = graph.getOutgoingEdges(startCell) || [];
    const pdfNode = outgoingEdges.find(edge => {
      const target = edge.target;
      return typeof window.isPdfNode === 'function' && window.isPdfNode(target);
    });
    
    if (pdfNode) {
      const targetCell = pdfNode.target;
      return {
        nodeId: targetCell.id,
        filename: targetCell._pdfUrl || "",
        pdfUrl: targetCell._pdfUrl || "",
        priceId: targetCell._priceId || ""
      };
    }
    
    // Check incoming edges for PDF properties (nodes that point to this node)
    const incomingEdges = graph.getIncomingEdges(startCell) || [];
    for (const edge of incomingEdges) {
      const sourceCell = edge.source;
      if (sourceCell) {
        // Check if the source node has PDF properties
        if (sourceCell._pdfName || sourceCell._pdfFilename || sourceCell._pdfUrl) {
          return {
            nodeId: sourceCell.id,
            filename: sourceCell._pdfUrl || sourceCell._pdfFilename || sourceCell._pdfName || "",
            pdfUrl: sourceCell._pdfUrl || "",
            priceId: sourceCell._priceId || ""
          };
        }
        
        // Check if the source node is a PDF node
        if (typeof window.isPdfNode === 'function' && window.isPdfNode(sourceCell)) {
          return {
            nodeId: sourceCell.id,
            filename: sourceCell._pdfUrl || "",
            pdfUrl: sourceCell._pdfUrl || "",
            priceId: sourceCell._priceId || ""
          };
        }
        
        // Check if the source node connects to PDF nodes
        const sourceOutgoingEdges = graph.getOutgoingEdges(sourceCell) || [];
        for (const sourceEdge of sourceOutgoingEdges) {
          const sourceTarget = sourceEdge.target;
          if (sourceTarget && typeof window.isPdfNode === 'function' && window.isPdfNode(sourceTarget)) {
            return {
              nodeId: sourceTarget.id,
              filename: sourceTarget._pdfUrl || "",
              pdfUrl: sourceTarget._pdfUrl || "",
              priceId: sourceTarget._priceId || ""
            };
          }
        }
      }
    }
    
    return null;
  };
  
  const pdfProperties = findPdfProperties(cell);
  
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

// Make functions globally accessible
window.toggleReorderAmount = toggleReorderAmount;
window.addOptionInReorderModal = addOptionInReorderModal;
window.findPdfNameForQuestion = findPdfNameForQuestion;
window.sanitizePdfName = sanitizePdfName;

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
      <div class="textbox-entry" style="margin-bottom:4px; text-align:center; display: flex; align-items: center; gap: 4px;" data-index="${index}">
        <div class="drag-handle" style="cursor: move; color: #666; font-size: 14px; user-select: none; padding: 2px;" draggable="true" data-cell-id="${cell.id}" ondragstart="window.handleDragStart(event, '${cell.id}', ${index})" ondragend="window.handleDragEnd(event)" onmousedown="event.stopPropagation()">⋮⋮</div>
        <input type="text" value="${getEscapeAttr()(val)}" data-index="${index}" placeholder="${getEscapeAttr()(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeHandler('${cell.id}', ${index}, this.value)" style="flex: 1;"/>
        <button onclick="window.deletemultipleDropdownTypeHandler('${cell.id}', ${index})">Delete</button>
        <button onclick="window.copyMultipleDropdownId('${cell.id}', ${index})" style="margin-left: 4px; background-color: #4CAF50; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Copy ID</button>
        <label>
          <input type="checkbox" ${checked} onclick="window.toggleMultipleDropdownAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });
  html += `<div style="text-align:center; margin-top:8px;">
      <button onclick="window.addmultipleDropdownTypeHandler('${cell.id}')">Add Option</button>
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
  // DISABLED: Automatic Node ID generation when updating question text
  // Node IDs will only change when manually edited or reset using the button
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
  // DISABLED: Automatic Node ID generation when updating question text
  // Node IDs will only change when manually edited or reset using the button
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

window.copyMultipleDropdownId = function(cellId, index) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "multipleDropdownType" || !cell._textboxes || !cell._textboxes[index]) {
    return;
  }
  
  // Get the question text and entry text
  const questionText = cell._questionText || '';
  const entryText = cell._textboxes[index].nameId || '';
  
  // Check if this question has a PDF property (only for nodes that should have PDF properties)
  const pdfName = findPdfNameForQuestion(cell);
  const sanitizedPdfName = pdfName ? sanitizePdfName(pdfName) : '';
  
  // Create the ID string with default number "1" first
  const sanitizedQuestionText = questionText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const sanitizedEntryText = entryText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  
  // Build the default ID with PDF name if available
  let defaultTextToCopy;
  if (sanitizedPdfName) {
    defaultTextToCopy = `${sanitizedPdfName}_${sanitizedQuestionText}_1_${sanitizedEntryText}`;
  } else {
    defaultTextToCopy = `${sanitizedQuestionText}_1_${sanitizedEntryText}`;
  }
  
  // Copy the default ID to clipboard immediately
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(defaultTextToCopy).catch(() => {
      // Fallback for older browsers
      fallbackCopyToClipboard(defaultTextToCopy);
    });
  } else {
    // Fallback for older browsers
    fallbackCopyToClipboard(defaultTextToCopy);
  }
  
  // Prompt user for number with default value of "1"
  const number = prompt('Enter a number for this ID:', '1');
  if (number === null) {
    return; // User cancelled, but ID was already copied with default value
  }
  const finalNumber = number.trim() || '1'; // Use "1" as default if empty
  
  // If user entered a different number, copy the updated ID
  if (finalNumber !== '1') {
    const sanitizedNumber = finalNumber;
    
    // Build the updated ID with PDF name if available
    let updatedTextToCopy;
    if (sanitizedPdfName) {
      updatedTextToCopy = `${sanitizedPdfName}_${sanitizedQuestionText}_${sanitizedNumber}_${sanitizedEntryText}`;
    } else {
      updatedTextToCopy = `${sanitizedQuestionText}_${sanitizedNumber}_${sanitizedEntryText}`;
    }
    
    // Copy the updated ID to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(updatedTextToCopy).catch(() => {
        // Fallback for older browsers
        fallbackCopyToClipboard(updatedTextToCopy);
      });
    } else {
      // Fallback for older browsers
      fallbackCopyToClipboard(updatedTextToCopy);
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
  const cell = getGraph()?.getModel().getCell(cellId);
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
    const cell = getGraph()?.getModel().getCell(cellId);
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
  const cell = getGraph()?.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "multipleDropdownType" || !cell._textboxes) {
    return;
  }
  
  getGraph().getModel().beginUpdate();
  try {
    // Remove the item from source position
    const [movedItem] = cell._textboxes.splice(sourceIndex, 1);
    
    // Insert it at target position
    cell._textboxes.splice(targetIndex, 0, movedItem);
    
    // Re-render the cell to reflect the new order
    updatemultipleDropdownTypeCell(cell);
    
  } finally {
    getGraph().getModel().endUpdate();
  }
}

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

// Function to refresh all existing multiple dropdown cells with drag handles
window.refreshAllMultipleDropdownCells = function() {
  const graph = getGraph();
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

// Initialize the module
function initializeQuestionsModule() {
  // Setup event listeners when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupQuestionTypeEventListeners);
  } else {
    setupQuestionTypeEventListeners();
  }
  
  // Refresh existing multiple dropdown cells after a short delay
  setTimeout(() => {
    if (typeof window.refreshAllMultipleDropdownCells === 'function') {
      window.refreshAllMultipleDropdownCells();
    }
  }, 1000);
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
