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
  
  // For dropdown, allow double-click editing directly
  if (newType === 'dropdown') {
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
      case 'dateRange': case 'email': case 'phone':
        // Preserve the text content
        cell._questionText = preservedText || '';
        updateSimpleQuestionCell(cell);
        break;
      case 'checkbox':
        // Preserve the text content
        cell._questionText = preservedText || '';
        // Set default checkbox availability
        cell._checkboxAvailability = cell._checkboxAvailability || 'markAll';
        updateSimpleQuestionCell(cell);
        break;
      case 'dropdown':
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
      <div style="display: flex; justify-content: center; align-items: flex-start; height:100%; padding-top: 4px;">
        <select class="question-type-dropdown" data-cell-id="${cell.id}" style="margin:auto; font-size: 1.2em; padding: 12px 20px; border-radius: 8px; border: 1px solid #b0b8c9; box-shadow: 0 2px 8px rgba(0,0,0,0.07); background: #f8faff; color: #222; transition: border-color 0.2s, box-shadow 0.2s; outline: none; min-width: 240px; height: 44px; cursor:pointer;"
          onfocus="this.style.borderColor='#4a90e2'; this.style.boxShadow='0 0 0 2px #b3d4fc';"
          onblur="this.style.borderColor='#b0b8c9'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)';"
          onmouseover="this.style.borderColor='#4a90e2';"
          onmouseout="this.style.borderColor='#b0b8c9';"
          onmousedown="event.stopPropagation();"
          onclick="event.stopPropagation();"
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
    cell._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
  }

  let html = "";

  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || "";
    const ph  = tb.placeholder || "Enter value";
    const isAmountOption = tb.isAmountOption || false;

    html += `
      <div class="textbox-entry" style="margin-bottom:8px;text-align:center; display: flex; align-items: center; gap: 4px;">
        <input type="text" value="${getEscapeAttr()(val)}" data-index="${index}" placeholder="${getEscapeAttr()(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updateMultipleTextboxHandler('${cell.id}', ${index}, this.value)" style="flex: 1;" />
        <button onclick="window.deleteMultipleTextboxHandler('${cell.id}', ${index})">Delete</button>
        <button onclick="window.copyMultipleTextboxId('${cell.id}', ${index})" style="margin-left: 4px; background-color: #4CAF50; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Copy ID</button>
        <label>
          <input type="checkbox" ${isAmountOption ? 'checked' : ''} onclick="window.toggleMultipleTextboxAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
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
    if (startCell._pdfName || startCell._pdfFile || startCell._pdfUrl) {
      return {
        nodeId: startCell.id,
        filename: startCell._pdfFile || startCell._pdfUrl || startCell._pdfName || "",
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
        if (sourceCell._pdfName || sourceCell._pdfFile || sourceCell._pdfUrl) {
          return {
            nodeId: sourceCell.id,
            filename: sourceCell._pdfFile || sourceCell._pdfUrl || sourceCell._pdfName || "",
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

// Numbered Dropdown Properties Popup
window.showNumberedDropdownProperties = function(cell) {
  if (!cell) return;
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'numbered-dropdown-properties-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 30px;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    position: relative;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 2px solid #e0e7ef;
  `;
  
  const title = document.createElement('h2');
  title.textContent = 'Numbered Dropdown Properties';
  title.style.cssText = `
    margin: 0;
    color: #2c3e50;
    font-size: 24px;
    font-weight: 600;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 28px;
    color: #aaa;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => document.body.removeChild(modal);
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  modalContent.appendChild(header);
  
  // Question Text Section
  const questionSection = createFieldSection('Question Text', [
    createTextField('Question', cell._questionText || '', (value) => {
      cell._questionText = value;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    })
  ]);
  modalContent.appendChild(questionSection);
  
  // Number Range Section
  const rangeSection = createFieldSection('Number Range', [
    createNumberField('From', cell._twoNumbers?.first || '0', (value) => {
      if (!cell._twoNumbers) cell._twoNumbers = { first: '0', second: '0' };
      cell._twoNumbers.first = value;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    }),
    createNumberField('To', cell._twoNumbers?.second || '0', (value) => {
      if (!cell._twoNumbers) cell._twoNumbers = { first: '0', second: '0' };
      cell._twoNumbers.second = value;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    })
  ]);
  modalContent.appendChild(rangeSection);
  
  // Options Section (now includes location functionality)
  const optionsSection = createFieldSection('Dropdown Options', [
    createOptionsContainer(cell)
  ]);
  modalContent.appendChild(optionsSection);
  
  // Footer buttons
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e0e7ef;
  `;
  
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save & Close';
  saveBtn.style.cssText = `
    background: #4CAF50;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    width: 200px;
  `;
  saveBtn.onclick = () => {
    // Refresh the cell display
    if (typeof window.updatemultipleDropdownTypeCell === 'function') {
      window.updatemultipleDropdownTypeCell(cell);
    }
    document.body.removeChild(modal);
  };
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    background: #f44336;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    width: 200px;
  `;
  cancelBtn.onclick = () => {
    // Auto-save before closing
    if (typeof window.updatemultipleDropdownTypeCell === 'function') {
      window.updatemultipleDropdownTypeCell(cell);
    }
    document.body.removeChild(modal);
  };
  
  footer.appendChild(saveBtn);
  footer.appendChild(cancelBtn);
  modalContent.appendChild(footer);
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Close on outside click (auto-save)
  modal.onclick = (e) => {
    if (e.target === modal) {
      // Auto-save before closing
      if (typeof window.updatemultipleDropdownTypeCell === 'function') {
        window.updatemultipleDropdownTypeCell(cell);
      }
      document.body.removeChild(modal);
    }
  };
  
  // Close on X button click (auto-save)
  closeBtn.onclick = () => {
    // Auto-save before closing
    if (typeof window.updatemultipleDropdownTypeCell === 'function') {
      window.updatemultipleDropdownTypeCell(cell);
    }
    document.body.removeChild(modal);
  };
};

// Helper function to create field sections
function createFieldSection(title, fields) {
  const section = document.createElement('div');
  section.style.cssText = `
    margin-bottom: 25px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e0e7ef;
  `;
  
  const sectionTitle = document.createElement('h3');
  sectionTitle.textContent = title;
  sectionTitle.style.cssText = `
    margin: 0 0 15px 0;
    color: #2c3e50;
    font-size: 18px;
    font-weight: 600;
  `;
  
  section.appendChild(sectionTitle);
  fields.forEach(field => section.appendChild(field));
  
  return section;
}

// Helper function to create text field
function createTextField(label, value, onChange) {
  const container = document.createElement('div');
  container.style.cssText = `
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  `;
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.cssText = `
    font-weight: 500;
    color: #2c3e50;
    font-size: 14px;
  `;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.style.cssText = `
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
  `;
  input.onblur = () => onChange(input.value);
  
  container.appendChild(labelEl);
  container.appendChild(input);
  
  return container;
}

// Helper function to create number field
function createNumberField(label, value, onChange) {
  const container = document.createElement('div');
  container.style.cssText = `
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
  `;
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.cssText = `
    font-weight: 500;
    color: #2c3e50;
    font-size: 14px;
  `;
  
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value;
  input.style.cssText = `
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
  `;
  input.onblur = () => onChange(input.value);
  
  container.appendChild(labelEl);
  container.appendChild(input);
  
  return container;
}

// Helper function to create options container
function createOptionsContainer(cell) {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;
  
  // Add drag and drop event listeners
  let draggedElement = null;
  
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });
  
  container.addEventListener('dragenter', (e) => {
    e.preventDefault();
  });
  
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedElement) return;
    
    const dropTarget = e.target.closest('[data-index]');
    if (!dropTarget || dropTarget === draggedElement) return;
    
    const draggedType = draggedElement.dataset.type;
    const dropType = dropTarget.dataset.type;
    const draggedIndex = parseInt(draggedElement.dataset.index);
    const dropIndex = parseInt(dropTarget.dataset.index);
    
    if (draggedType === 'location' && dropType === 'location') {
      // Can't drop location on location
      return;
    }
    
    if (draggedType === 'option' && dropType === 'option') {
      // Reorder options
      const options = cell._textboxes || [];
      const draggedOption = options[draggedIndex];
      options.splice(draggedIndex, 1);
      options.splice(dropIndex, 0, draggedOption);
      
      // Update location index if needed
      if (cell._locationIndex !== undefined) {
        if (draggedIndex < cell._locationIndex && dropIndex >= cell._locationIndex) {
          cell._locationIndex--;
        } else if (draggedIndex > cell._locationIndex && dropIndex <= cell._locationIndex) {
          cell._locationIndex++;
        }
      }
    } else if (draggedType === 'location' && dropType === 'option') {
      // Move location to position of option
      cell._locationIndex = dropIndex;
    } else if (draggedType === 'option' && dropType === 'location') {
      // Move option to position of location
      const options = cell._textboxes || [];
      const draggedOption = options[draggedIndex];
      options.splice(draggedIndex, 1);
      options.splice(cell._locationIndex, 0, draggedOption);
      
      // Update location index
      if (draggedIndex < cell._locationIndex) {
        cell._locationIndex--;
      }
    }
    
    // Refresh the entire container
    const newContainer = createOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  });
  
  // Add existing options and location indicator in correct order
  const options = cell._textboxes || [];
  const locationIndex = cell._locationIndex !== undefined ? cell._locationIndex : -1;
  
  options.forEach((option, index) => {
    const optionContainer = createOptionField(option, index, cell, container);
    
    // Add drag event listeners
    optionContainer.addEventListener('dragstart', (e) => {
      draggedElement = optionContainer;
      e.dataTransfer.effectAllowed = 'move';
      optionContainer.style.opacity = '0.5';
    });
    
    optionContainer.addEventListener('dragend', (e) => {
      optionContainer.style.opacity = '1';
      draggedElement = null;
    });
    
    container.appendChild(optionContainer);
    
    // Add location indicator after this option if it's at the location index
    if (index === locationIndex) {
      const locationIndicator = createLocationIndicator(cell, container);
      
      // Add drag event listeners to location indicator
      locationIndicator.addEventListener('dragstart', (e) => {
        draggedElement = locationIndicator;
        e.dataTransfer.effectAllowed = 'move';
        locationIndicator.style.opacity = '0.5';
      });
      
      locationIndicator.addEventListener('dragend', (e) => {
        locationIndicator.style.opacity = '1';
        draggedElement = null;
      });
      
      container.appendChild(locationIndicator);
    }
  });
  
  // Add location indicator at the end if location index is beyond the current options
  if (locationIndex >= options.length) {
    const locationIndicator = createLocationIndicator(cell, container);
    
    // Add drag event listeners to location indicator
    locationIndicator.addEventListener('dragstart', (e) => {
      draggedElement = locationIndicator;
      e.dataTransfer.effectAllowed = 'move';
      locationIndicator.style.opacity = '0.5';
    });
    
    locationIndicator.addEventListener('dragend', (e) => {
      locationIndicator.style.opacity = '1';
      draggedElement = null;
    });
    
    container.appendChild(locationIndicator);
  }
  
  // Add new option button
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add Option';
  addBtn.style.cssText = `
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-top: 10px;
  `;
  addBtn.onclick = () => {
    const newOption = { nameId: '', placeholder: 'Enter value', isAmountOption: false };
    if (!cell._textboxes) cell._textboxes = [];
    cell._textboxes.push(newOption);
    
    const optionContainer = createOptionField(newOption, cell._textboxes.length - 1, cell, container);
    container.insertBefore(optionContainer, addBtn);
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  // Add location button
  const addLocationBtn = document.createElement('button');
  addLocationBtn.textContent = '+ Add Location';
  addLocationBtn.style.cssText = `
    background: #28a745;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-top: 5px;
  `;
  addLocationBtn.onclick = () => {
    cell._locationIndex = (cell._textboxes || []).length;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    // Refresh the entire container to show the location indicator
    const newContainer = createOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
  };
  
  container.appendChild(addBtn);
  container.appendChild(addLocationBtn);
  
  return container;
}

// Helper function to create location indicator
function createLocationIndicator(cell, parentContainer) {
  const locationIndicator = document.createElement('div');
  locationIndicator.style.cssText = `
    margin: 8px 0;
    padding: 8px;
    background-color: #e8f5e8;
    border: 2px dashed #28a745;
    border-radius: 4px;
    text-align: center;
    color: #28a745;
    font-weight: bold;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: move;
    transition: all 0.2s ease;
  `;
  locationIndicator.draggable = true;
  locationIndicator.dataset.type = 'location';
  locationIndicator.dataset.index = cell._locationIndex;
  
  // Add hover effect
  locationIndicator.addEventListener('mouseenter', () => {
    locationIndicator.style.backgroundColor = '#d4edda';
    locationIndicator.style.borderColor = '#1e7e34';
  });
  locationIndicator.addEventListener('mouseleave', () => {
    locationIndicator.style.backgroundColor = '#e8f5e8';
    locationIndicator.style.borderColor = '#28a745';
  });
  
  // Drag handle
  const dragHandle = document.createElement('div');
  dragHandle.innerHTML = '⋮⋮';
  dragHandle.style.cssText = `
    cursor: move;
    color: #28a745;
    font-size: 14px;
    user-select: none;
    padding: 2px;
    margin-right: 5px;
  `;
  
  const locationText = document.createElement('span');
  locationText.textContent = '📍 Location Date Inserted';
  
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.style.cssText = `
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    cursor: pointer;
  `;
  removeBtn.onclick = () => {
    delete cell._locationIndex;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    // Refresh the entire container to remove the location indicator
    const newContainer = createOptionsContainer(cell);
    parentContainer.parentNode.replaceChild(newContainer, parentContainer);
  };
  
  locationIndicator.appendChild(dragHandle);
  locationIndicator.appendChild(locationText);
  locationIndicator.appendChild(removeBtn);
  
  return locationIndicator;
}

// Helper function to create individual option field
function createOptionField(option, index, cell, parentContainer) {
  const optionContainer = document.createElement('div');
  optionContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: move;
    transition: all 0.2s ease;
  `;
  optionContainer.draggable = true;
  optionContainer.dataset.index = index;
  optionContainer.dataset.type = 'option';
  
  // Add hover effect
  optionContainer.addEventListener('mouseenter', () => {
    optionContainer.style.backgroundColor = '#f8f9fa';
    optionContainer.style.borderColor = '#007bff';
  });
  optionContainer.addEventListener('mouseleave', () => {
    optionContainer.style.backgroundColor = 'white';
    optionContainer.style.borderColor = '#ddd';
  });
  
  // Drag handle
  const dragHandle = document.createElement('div');
  dragHandle.innerHTML = '⋮⋮';
  dragHandle.style.cssText = `
    cursor: move;
    color: #666;
    font-size: 14px;
    user-select: none;
    padding: 2px;
    margin-right: 5px;
  `;
  
  // Option text input
  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.value = option.nameId || '';
  textInput.placeholder = 'Option text';
  textInput.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  textInput.onblur = () => {
    option.nameId = textInput.value;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  // Amount checkbox
  const amountCheckbox = document.createElement('input');
  amountCheckbox.type = 'checkbox';
  amountCheckbox.checked = option.isAmountOption || false;
  amountCheckbox.onchange = () => {
    option.isAmountOption = amountCheckbox.checked;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  const amountLabel = document.createElement('label');
  amountLabel.textContent = 'Amount?';
  amountLabel.style.cssText = `
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: #2c3e50;
  `;
  amountLabel.insertBefore(amountCheckbox, amountLabel.firstChild);
  
  // Copy ID button
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy ID';
  copyBtn.style.cssText = `
    background: #4CAF50;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  copyBtn.onclick = () => {
    if (typeof window.copyMultipleDropdownId === 'function') {
      window.copyMultipleDropdownId(cell.id, index);
    }
  };
  
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  deleteBtn.onclick = () => {
    cell._textboxes.splice(index, 1);
    // Refresh the entire container to maintain proper order
    const newContainer = createOptionsContainer(cell);
    parentContainer.parentNode.replaceChild(newContainer, parentContainer);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  optionContainer.appendChild(dragHandle);
  optionContainer.appendChild(textInput);
  optionContainer.appendChild(amountLabel);
  optionContainer.appendChild(copyBtn);
  optionContainer.appendChild(deleteBtn);
  
  return optionContainer;
}


// Multiple Textbox Properties Popup
window.showMultipleTextboxProperties = function(cell) {
  if (!cell) return;
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'multiple-textbox-properties-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    justify-content: center;
    align-items: center;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 30px;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    position: relative;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    padding-bottom: 15px;
    border-bottom: 2px solid #e0e7ef;
  `;
  
  const title = document.createElement('h2');
  title.textContent = 'Multiple Textbox Properties';
  title.style.cssText = `
    margin: 0;
    color: #2c3e50;
    font-size: 24px;
    font-weight: 600;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 28px;
    color: #aaa;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => document.body.removeChild(modal);
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  modalContent.appendChild(header);
  
  // Question Text Section
  const questionSection = createFieldSection('Question Text', [
    createTextField('Question', cell._questionText || '', (value) => {
      cell._questionText = value;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    })
  ]);
  modalContent.appendChild(questionSection);
  
  // Textbox Options Section
  const optionsSection = createFieldSection('Textbox Options', [
    createTextboxOptionsContainer(cell)
  ]);
  modalContent.appendChild(optionsSection);
  
  // Location Section
  const locationSection = createFieldSection('Location Settings', [
    createTextboxLocationContainer(cell)
  ]);
  modalContent.appendChild(locationSection);
  
  // Footer buttons
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 15px;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e0e7ef;
  `;
  
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save & Close';
  saveBtn.style.cssText = `
    background: #4CAF50;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
  `;
  saveBtn.onclick = () => {
    // Refresh the cell display
    if (typeof window.updateMultipleTextboxesCell === 'function') {
      window.updateMultipleTextboxesCell(cell);
    }
    document.body.removeChild(modal);
  };
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    background: #f44336;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
  `;
  cancelBtn.onclick = () => document.body.removeChild(modal);
  
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  modalContent.appendChild(footer);
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Close on outside click
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
};

// Helper function to create textbox options container
function createTextboxOptionsContainer(cell) {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;
  
  // Add existing textboxes
  const textboxes = cell._textboxes || [];
  textboxes.forEach((textbox, index) => {
    const textboxContainer = createTextboxField(textbox, index, cell, container);
    container.appendChild(textboxContainer);
  });
  
  // Add new textbox button
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add Textbox';
  addBtn.style.cssText = `
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-top: 10px;
  `;
  addBtn.onclick = () => {
    const newTextbox = { nameId: '', placeholder: 'Enter value', isAmountOption: false };
    if (!cell._textboxes) cell._textboxes = [];
    cell._textboxes.push(newTextbox);
    
    const textboxContainer = createTextboxField(newTextbox, cell._textboxes.length - 1, cell, container);
    container.insertBefore(textboxContainer, addBtn);
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  container.appendChild(addBtn);
  
  return container;
}

// Helper function to create individual textbox field
function createTextboxField(textbox, index, cell, parentContainer) {
  const textboxContainer = document.createElement('div');
  textboxContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
  `;
  
  // Textbox name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = textbox.nameId || '';
  nameInput.placeholder = 'Textbox name';
  nameInput.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  nameInput.onblur = () => {
    textbox.nameId = nameInput.value;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  // Placeholder input
  const placeholderInput = document.createElement('input');
  placeholderInput.type = 'text';
  placeholderInput.value = textbox.placeholder || '';
  placeholderInput.placeholder = 'Placeholder text';
  placeholderInput.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  placeholderInput.onblur = () => {
    textbox.placeholder = placeholderInput.value;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  // Amount checkbox
  const amountCheckbox = document.createElement('input');
  amountCheckbox.type = 'checkbox';
  amountCheckbox.checked = textbox.isAmountOption || false;
  amountCheckbox.onchange = () => {
    textbox.isAmountOption = amountCheckbox.checked;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  const amountLabel = document.createElement('label');
  amountLabel.textContent = 'Amount?';
  amountLabel.style.cssText = `
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: #2c3e50;
  `;
  amountLabel.insertBefore(amountCheckbox, amountLabel.firstChild);
  
  // Copy ID button
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy ID';
  copyBtn.style.cssText = `
    background: #4CAF50;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  copyBtn.onclick = () => {
    if (typeof window.copyMultipleTextboxId === 'function') {
      window.copyMultipleTextboxId(cell.id, index);
    }
  };
  
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  deleteBtn.onclick = () => {
    cell._textboxes.splice(index, 1);
    parentContainer.removeChild(textboxContainer);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  textboxContainer.appendChild(nameInput);
  textboxContainer.appendChild(placeholderInput);
  textboxContainer.appendChild(amountLabel);
  textboxContainer.appendChild(copyBtn);
  textboxContainer.appendChild(deleteBtn);
  
  return textboxContainer;
}

// Helper function to create textbox location container
function createTextboxLocationContainer(cell) {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 15px;
  `;
  
  // Location status
  const hasLocation = cell._locationIndex !== undefined && cell._locationIndex >= 0;
  
  if (hasLocation) {
    const locationInfo = document.createElement('div');
    locationInfo.style.cssText = `
      padding: 15px;
      background: #e8f5e8;
      border: 2px dashed #28a745;
      border-radius: 6px;
      text-align: center;
      color: #28a745;
      font-weight: bold;
    `;
    locationInfo.textContent = '📍 Location Date Inserted';
    container.appendChild(locationInfo);
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove Location';
    removeBtn.style.cssText = `
      background: #dc3545;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    removeBtn.onclick = () => {
      delete cell._locationIndex;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
      // Refresh the container
      const newContainer = createTextboxLocationContainer(cell);
      container.parentNode.replaceChild(newContainer, container);
    };
    container.appendChild(removeBtn);
  } else {
    const addLocationBtn = document.createElement('button');
    addLocationBtn.textContent = 'Add Location';
    addLocationBtn.style.cssText = `
      background: #28a745;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
    `;
    addLocationBtn.onclick = () => {
      cell._locationIndex = (cell._textboxes || []).length;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
      // Refresh the container
      const newContainer = createTextboxLocationContainer(cell);
      container.parentNode.replaceChild(newContainer, container);
    };
    container.appendChild(addLocationBtn);
  }
  
  return container;
}

function updateMultipleTextboxesCell(cell) {
  const graph = getGraph();
  if (!graph) return;
  
  const qText = cell._questionText || 'Multiple Textbox Question';
  const textboxes = cell._textboxes || [];
  const hasLocation = cell._locationIndex !== undefined && cell._locationIndex >= 0;
  
  // Create simple display with essential information
  const html = `
    <div style="padding: 20px; font-family: Arial, sans-serif; text-align: center;">
      <div style="font-weight: bold; color: #2196F3; margin-bottom: 10px; font-size: 16px;">${getEscapeAttr()(qText)}</div>
      <div style="margin-bottom: 8px; color: #666; font-size: 14px;">
        <strong>Textboxes:</strong> ${textboxes.length} configured
      </div>
      ${hasLocation ? '<div style="margin-bottom: 8px; color: #28a745; font-size: 14px;"><strong>📍 Location:</strong> Enabled</div>' : ''}
      <div style="font-style: italic; color: #999; font-size: 12px; margin-top: 15px;">Double-click to configure</div>
    </div>
  `;
  
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

// Multiple Dropdown Type Functions
function updatemultipleDropdownTypeCell(cell) {
  const graph = getGraph();
  if (!graph) return;
  
  const qText = cell._questionText || 'Numbered Dropdown Question';
  const twoNums = cell._twoNumbers || { first: '0', second: '0' };
  const options = cell._textboxes || [];
  const hasLocation = cell._locationIndex !== undefined && cell._locationIndex >= 0;
  
  // Create simple display with essential information
  const html = `
    <div style="padding: 20px; font-family: Arial, sans-serif; text-align: center;">
      <div style="font-weight: bold; color: #2196F3; margin-bottom: 10px; font-size: 16px;">${getEscapeAttr()(qText)}</div>
      <div style="margin-bottom: 8px; color: #666; font-size: 14px;">
        <strong>Range:</strong> ${twoNums.first} to ${twoNums.second}
    </div>
      <div style="margin-bottom: 8px; color: #666; font-size: 14px;">
        <strong>Options:</strong> ${options.length} configured
    </div>
      ${hasLocation ? '<div style="margin-bottom: 8px; color: #28a745; font-size: 14px;"><strong>📍 Location:</strong> Enabled</div>' : ''}
      <div style="font-style: italic; color: #999; font-size: 12px; margin-top: 15px;">Double-click to configure</div>
    </div>
  `;
  
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
        setQuestionType(window.selectedCell, "dropdown");
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
          window.selectedCell._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
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
      getGraph().getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

window.addMultipleTextboxLocationHandler = function(cellId) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes") {
    getGraph().getModel().beginUpdate();
    try {
      // Set the location index to the current number of textboxes (at the end)
      cell._locationIndex = cell._textboxes ? cell._textboxes.length : 0;
    } finally {
      getGraph().getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

window.removeMultipleTextboxLocationHandler = function(cellId) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes") {
    getGraph().getModel().beginUpdate();
    try {
      // Remove the location index
      delete cell._locationIndex;
    } finally {
      getGraph().getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

// Toggle amount option for multiple textboxes
window.toggleMultipleTextboxAmount = function(cellId, index, checked) {
  console.log('🔧 [TEXTBOX AMOUNT DEBUG] toggleMultipleTextboxAmount called');
  console.log('🔧 [TEXTBOX AMOUNT DEBUG] cellId:', cellId);
  console.log('🔧 [TEXTBOX AMOUNT DEBUG] index:', index);
  console.log('🔧 [TEXTBOX AMOUNT DEBUG] checked:', checked);
  
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes" && cell._textboxes) {
    console.log('🔧 [TEXTBOX AMOUNT DEBUG] Cell found, updating _textboxes');
    console.log('🔧 [TEXTBOX AMOUNT DEBUG] Current _textboxes:', cell._textboxes);
    
    getGraph().getModel().beginUpdate();
    try {
      cell._textboxes[index].isAmountOption = checked;
      console.log('🔧 [TEXTBOX AMOUNT DEBUG] Updated _textboxes:', cell._textboxes);
    } finally {
      getGraph().getModel().endUpdate();
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
    
    // Trigger autosave to ensure the change is persisted
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  }
};

window.addMultipleDropdownLocationHandler = function(cellId) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    getGraph().getModel().beginUpdate();
    try {
      // Set the location index to the current number of textboxes (at the end)
      cell._locationIndex = cell._textboxes ? cell._textboxes.length : 0;
    } finally {
      getGraph().getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.removeMultipleDropdownLocationHandler = function(cellId) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    getGraph().getModel().beginUpdate();
    try {
      // Remove the location index
      delete cell._locationIndex;
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
    defaultTextToCopy = `${sanitizedPdfName}_${sanitizedQuestionText}_${sanitizedEntryText}_1`;
  } else {
    defaultTextToCopy = `${sanitizedQuestionText}_${sanitizedEntryText}_1`;
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
  
  // Always copy the final ID with the user's number (even if it's "1")
  const sanitizedNumber = finalNumber;
  
  // Build the final ID with PDF name if available
  let finalTextToCopy;
  if (sanitizedPdfName) {
    finalTextToCopy = `${sanitizedPdfName}_${sanitizedQuestionText}_${sanitizedEntryText}_${sanitizedNumber}`;
  } else {
    finalTextToCopy = `${sanitizedQuestionText}_${sanitizedEntryText}_${sanitizedNumber}`;
  }
  
  
  // Copy the final ID to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(finalTextToCopy).catch(() => {
      // Fallback for older browsers
      fallbackCopyToClipboard(finalTextToCopy);
    });
  } else {
    // Fallback for older browsers
    fallbackCopyToClipboard(finalTextToCopy);
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
      c._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
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
