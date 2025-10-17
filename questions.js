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
  if (!cell) {
    console.log('🔍 [LOCATION ORDER DEBUG] getQuestionType called with undefined cell');
    return "";
  }
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
    console.log('🔍 [LOCATION ORDER DEBUG] Save button clicked for cell:', cell.id);
    console.log('🔍 [LOCATION ORDER DEBUG] Cell state before save:', {
      locationIndex: cell._locationIndex,
      textboxes: cell._textboxes?.map((tb, idx) => ({ index: idx, nameId: tb.nameId }))
    });
    
    // Force a model update to ensure data is saved
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        // Force the cell to be marked as changed
        graph.getModel().setValue(cell, cell.value);
      } finally {
        graph.getModel().endUpdate();
      }
    }
    
    // Refresh the cell display
    if (typeof window.updatemultipleDropdownTypeCell === 'function') {
      console.log('🔍 [LOCATION ORDER DEBUG] Calling updatemultipleDropdownTypeCell...');
      window.updatemultipleDropdownTypeCell(cell);
      console.log('🔍 [LOCATION ORDER DEBUG] updatemultipleDropdownTypeCell completed');
    } else {
      console.log('🔍 [LOCATION ORDER DEBUG] updatemultipleDropdownTypeCell function not found!');
    }
    
    console.log('🔍 [LOCATION ORDER DEBUG] Cell state after save:', {
      locationIndex: cell._locationIndex,
      textboxes: cell._textboxes?.map((tb, idx) => ({ index: idx, nameId: tb.nameId }))
    });
    
    // Verify the cell data is properly stored
    console.log('🔍 [PROPERTIES MENU DEBUG] Final cell verification:', {
      cellId: cell.id,
      locationIndex: cell._locationIndex,
      hasLocationIndex: cell._locationIndex !== undefined,
      locationIndexType: typeof cell._locationIndex,
      textboxesLength: cell._textboxes?.length
    });
    
    console.log('🔍 [LOCATION ORDER DEBUG] Cell display updated, closing modal');
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
  
  // Close on Enter key press (auto-save)
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.target.matches('input, textarea, button')) {
      e.preventDefault();
      // Auto-save before closing
      if (typeof window.updatemultipleDropdownTypeCell === 'function') {
        window.updatemultipleDropdownTypeCell(cell);
      }
      document.body.removeChild(modal);
    }
  });
  
  // Make modal focusable for keyboard events
  modal.setAttribute('tabindex', '0');
  modal.focus();
  
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
    
    // Add visual feedback for where the location will be dropped
    const dropTarget = e.target.closest('[data-index]');
    if (dropTarget && dropTarget.dataset.type === 'option') {
      const dropIndex = parseInt(dropTarget.dataset.index);
      console.log('🔍 [PROPERTIES MENU DEBUG] Dragging over option at index:', dropIndex, 
        'Location will be inserted at position:', dropIndex, 
        dropIndex === 0 ? '(TOP)' : dropIndex === 1 ? '(MIDDLE)' : '(AFTER)');
      
      // Add visual indicator
      dropTarget.style.borderColor = '#007bff';
      dropTarget.style.borderWidth = '2px';
    }
  });
  
  container.addEventListener('dragenter', (e) => {
    e.preventDefault();
  });
  
  container.addEventListener('dragleave', (e) => {
    // Remove visual feedback when leaving drop targets
    const dropTarget = e.target.closest('[data-index]');
    if (dropTarget && dropTarget.dataset.type === 'option') {
      dropTarget.style.borderColor = '#ddd';
      dropTarget.style.borderWidth = '1px';
    }
  });
  
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedElement) return;
    
    const dropTarget = e.target.closest('[data-index]');
    if (!dropTarget || dropTarget === draggedElement) return;
    
    console.log('🔍 [PROPERTIES MENU DEBUG] Drop target element:', dropTarget);
    console.log('🔍 [PROPERTIES MENU DEBUG] Drop target dataset:', dropTarget.dataset);
    console.log('🔍 [PROPERTIES MENU DEBUG] Dragged element:', draggedElement);
    console.log('🔍 [PROPERTIES MENU DEBUG] Dragged element dataset:', draggedElement.dataset);
    
    // Try to get drag data from dataTransfer first, fallback to dataset
    let draggedType, draggedIndex;
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
      draggedType = dragData.type || draggedElement.dataset.type;
      draggedIndex = dragData.index !== undefined ? dragData.index : parseInt(draggedElement.dataset.index);
    } catch (error) {
      // Fallback to dataset if dataTransfer parsing fails
      draggedType = draggedElement.dataset.type;
      draggedIndex = parseInt(draggedElement.dataset.index);
    }
    
    const dropType = dropTarget.dataset.type;
    const dropIndex = parseInt(dropTarget.dataset.index);
    
    console.log('🔍 [LOCATION ORDER DEBUG] Drop event details:', {
      draggedType: draggedType,
      draggedIndex: draggedIndex,
      dropType: dropType,
      dropIndex: dropIndex
    });
    
    if (draggedType === 'location' && dropType === 'location') {
      // Can't drop location on location
      return;
    }
    
    if (draggedType === 'option' && dropType === 'option') {
      // Reorder options using unified item order
      const options = cell._textboxes || [];
      
      // Find the dragged option in the item order
      const draggedOptionIndex = cell._itemOrder.findIndex(item => 
        item.type === 'option' && item.index === draggedIndex
      );
      
      // Find the target option in the item order
      const targetOptionIndex = cell._itemOrder.findIndex(item => 
        item.type === 'option' && item.index === dropIndex
      );
      
      if (draggedOptionIndex !== -1 && targetOptionIndex !== -1) {
        // Remove the option from its current position
        const draggedOption = cell._itemOrder.splice(draggedOptionIndex, 1)[0];
        
        // Insert it at the target position
        cell._itemOrder.splice(targetOptionIndex, 0, draggedOption);
        
        // Update the option indices to match their new positions
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'option') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'option'
            ).length - 1;
          }
        });
      }
      
      console.log('🔍 [LOCATION ORDER DEBUG] Option reordered using unified ordering:', {
        draggedIndex: draggedIndex,
        dropIndex: dropIndex,
        itemOrder: cell._itemOrder
      });
    } else if (draggedType === 'checkbox' && dropType === 'checkbox') {
      // Reorder checkboxes
      const checkboxes = cell._checkboxes || [];
      const draggedCheckbox = checkboxes[draggedIndex];
      checkboxes.splice(draggedIndex, 1);
      checkboxes.splice(dropIndex, 0, draggedCheckbox);
      
      console.log('🔍 [CHECKBOX ORDER DEBUG] Checkbox reordered:', {
        draggedIndex: draggedIndex,
        dropIndex: dropIndex,
        checkboxesCount: checkboxes.length
      });
    } else if (draggedType === 'checkbox' && dropType === 'option') {
      // Move checkbox to position of option using unified ordering
      const checkboxes = cell._checkboxes || [];
      const options = cell._textboxes || [];
      const draggedCheckbox = checkboxes[draggedIndex];
      
      // Initialize item order if it doesn't exist
      if (!cell._itemOrder) {
        cell._itemOrder = [];
        // Add all options first
        options.forEach((_, index) => {
          cell._itemOrder.push({ type: 'option', index: index });
        });
        // Add all checkboxes second
        checkboxes.forEach((_, index) => {
          cell._itemOrder.push({ type: 'checkbox', index: index });
        });
        // Add location if it exists
        if (cell._locationIndex >= 0) {
          cell._itemOrder.push({ type: 'location', index: cell._locationIndex });
        }
      }
      
      // Find the dragged checkbox in the item order
      const draggedItemIndex = cell._itemOrder.findIndex(item => 
        item.type === 'checkbox' && item.index === draggedIndex
      );
      
      // Find the target option in the item order
      const targetItemIndex = cell._itemOrder.findIndex(item => 
        item.type === 'option' && item.index === dropIndex
      );
      
      if (draggedItemIndex !== -1 && targetItemIndex !== -1) {
        // Remove the dragged item from its current position
        const draggedItem = cell._itemOrder.splice(draggedItemIndex, 1)[0];
        
        // Insert it at the target position
        cell._itemOrder.splice(targetItemIndex, 0, draggedItem);
        
        // Update the checkbox index to match its new position in the item order
        const newCheckboxIndex = cell._itemOrder.findIndex(item => 
          item.type === 'checkbox' && item === draggedItem
        );
        draggedItem.index = newCheckboxIndex;
      }
      
      console.log('🔍 [CHECKBOX ORDER DEBUG] Checkbox moved to option position using unified ordering:', {
        draggedIndex: draggedIndex,
        dropIndex: dropIndex,
        itemOrder: cell._itemOrder,
        checkboxesCount: checkboxes.length,
        optionsCount: options.length
      });
    } else if (draggedType === 'location' && dropType === 'option') {
      // Move location to position of option using unified item order
      console.log('🔍 [LOCATION ORDER DEBUG] Moving location to position:', dropIndex);
      console.log('🔍 [PROPERTIES MENU DEBUG] Before location index update:', cell._locationIndex);
      
      // Find the dragged location in the item order
      const draggedLocationIndex = cell._itemOrder.findIndex(item => 
        item.type === 'location'
      );
      
      // Find the target option in the item order
      const targetOptionIndex = cell._itemOrder.findIndex(item => 
        item.type === 'option' && item.index === dropIndex
      );
      
      if (draggedLocationIndex !== -1 && targetOptionIndex !== -1) {
        // Remove the location from its current position
        const draggedLocation = cell._itemOrder.splice(draggedLocationIndex, 1)[0];
        
        // Insert it at the target position
        cell._itemOrder.splice(targetOptionIndex, 0, draggedLocation);
        
        // Update the location index to match its new position
        const newLocationIndex = cell._itemOrder.findIndex(item => 
          item.type === 'location'
        );
        cell._locationIndex = newLocationIndex;
      }
      
      console.log('🔍 [LOCATION ORDER DEBUG] New location index:', cell._locationIndex);
      console.log('🔍 [PROPERTIES MENU DEBUG] After location index update:', cell._locationIndex);
      console.log('🔍 [PROPERTIES MENU DEBUG] Location will be inserted at position:', cell._locationIndex, 'which means:', 
        cell._locationIndex === 0 ? 'TOP (before first option)' : 
        cell._locationIndex === 1 ? 'MIDDLE (between first and second option)' : 
        'AFTER options');
      console.log('🔍 [PROPERTIES MENU DEBUG] This will place the location BEFORE the option at index:', cell._locationIndex);
    } else if (draggedType === 'option' && dropType === 'location') {
      // Move option to position of location using unified item order
      const options = cell._textboxes || [];
      
      // Find the dragged option in the item order
      const draggedOptionIndex = cell._itemOrder.findIndex(item => 
        item.type === 'option' && item.index === draggedIndex
      );
      
      // Find the location in the item order
      const locationIndex = cell._itemOrder.findIndex(item => 
        item.type === 'location'
      );
      
      if (draggedOptionIndex !== -1 && locationIndex !== -1) {
        // Remove the option from its current position
        const draggedOption = cell._itemOrder.splice(draggedOptionIndex, 1)[0];
        
        // Insert it at the location position
        cell._itemOrder.splice(locationIndex, 0, draggedOption);
        
        // Update the option indices to match their new positions
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'option') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'option'
            ).length - 1;
          }
        });
      }
      
      console.log('🔍 [LOCATION ORDER DEBUG] Option moved to location position using unified ordering:', {
        draggedIndex: draggedIndex,
        locationIndex: locationIndex,
        itemOrder: cell._itemOrder
      });
    }
    
    // Clean up visual feedback
    container.querySelectorAll('[data-index]').forEach(element => {
      element.style.borderColor = '#ddd';
      element.style.borderWidth = '1px';
    });
    
    // Refresh the entire container
    console.log('🔍 [PROPERTIES MENU DEBUG] Refreshing container after drag operation');
    const newContainer = createOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    console.log('🔍 [PROPERTIES MENU DEBUG] Container refreshed after drag operation');
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  });
  
  // Add existing options, checkboxes, times, and location indicator in correct order
  const options = cell._textboxes || [];
  const checkboxes = cell._checkboxes || [];
  const times = cell._times || [];
  const locationIndex = cell._locationIndex !== undefined ? cell._locationIndex : -1;
  
  console.log('🔍 [PROPERTIES MENU DEBUG] createOptionsContainer called for cell:', cell.id);
  console.log('🔍 [PROPERTIES MENU DEBUG] Cell data:', {
    cellId: cell.id,
    locationIndex: locationIndex,
    optionsCount: options.length,
    checkboxesCount: checkboxes.length,
    options: options.map((opt, idx) => ({ index: idx, nameId: opt.nameId })),
    checkboxes: checkboxes.map((cb, idx) => ({ index: idx, fieldName: cb.fieldName }))
  });
  
  // Use unified item order if it exists, otherwise use default order
  if (cell._itemOrder && cell._itemOrder.length > 0) {
    console.log('🔍 [PROPERTIES MENU DEBUG] Using unified item order for display:', cell._itemOrder);
    
    cell._itemOrder.forEach((item, displayIndex) => {
      if (item.type === 'option' && options[item.index]) {
        const optionContainer = createOptionField(options[item.index], item.index, cell, container);
        
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
        } else if (item.type === 'checkbox' && checkboxes[item.index]) {
          const checkboxContainer = createCheckboxField(checkboxes[item.index], item.index, cell, container);
          
          // Add drag event listeners
          checkboxContainer.addEventListener('dragstart', (e) => {
            draggedElement = checkboxContainer;
            e.dataTransfer.effectAllowed = 'move';
            checkboxContainer.style.opacity = '0.5';
          });
          
          checkboxContainer.addEventListener('dragend', (e) => {
            checkboxContainer.style.opacity = '1';
            draggedElement = null;
          });
          
          container.appendChild(checkboxContainer);
        } else if (item.type === 'time' && times[item.index]) {
          const timeContainer = createTimeField(times[item.index], item.index, cell, container);
          
          // Add drag event listeners
          timeContainer.addEventListener('dragstart', (e) => {
            draggedElement = timeContainer;
            e.dataTransfer.effectAllowed = 'move';
            timeContainer.style.opacity = '0.5';
          });
          
          timeContainer.addEventListener('dragend', (e) => {
            timeContainer.style.opacity = '1';
            draggedElement = null;
          });
          
          container.appendChild(timeContainer);
        } else if (item.type === 'location') {
        const locationIndicator = createLocationIndicator(cell, container);
        
        // Add drag event listeners to location indicator
        locationIndicator.addEventListener('dragstart', (e) => {
          draggedElement = locationIndicator;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', JSON.stringify({ 
            cellId: cell.id, 
            index: locationIndex, 
            type: 'location' 
          }));
          locationIndicator.style.opacity = '0.5';
          console.log('🔍 [LOCATION ORDER DEBUG] Location drag started:', {
            cellId: cell.id,
            locationIndex: locationIndex,
            type: 'location'
          });
        });
        
        locationIndicator.addEventListener('dragend', (e) => {
          locationIndicator.style.opacity = '1';
          draggedElement = null;
        });
        
        container.appendChild(locationIndicator);
      }
    });
  } else {
    // Fallback to default order (options first, then checkboxes, then location)
    console.log('🔍 [PROPERTIES MENU DEBUG] Using default order (no unified item order)');
    
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
      
      // Add location indicator BEFORE this option if it's at the location index
      if (index === locationIndex) {
        console.log('🔍 [PROPERTIES MENU DEBUG] Adding location indicator before option index:', index);
        const locationIndicator = createLocationIndicator(cell, container);
        
        // Add drag event listeners to location indicator
        locationIndicator.addEventListener('dragstart', (e) => {
          draggedElement = locationIndicator;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', JSON.stringify({ 
            cellId: cell.id, 
            index: locationIndex, 
            type: 'location' 
          }));
          locationIndicator.style.opacity = '0.5';
          console.log('🔍 [LOCATION ORDER DEBUG] Location drag started:', {
            cellId: cell.id,
            locationIndex: locationIndex,
            type: 'location'
          });
        });
        
        locationIndicator.addEventListener('dragend', (e) => {
          locationIndicator.style.opacity = '1';
          draggedElement = null;
        });
        
        container.appendChild(locationIndicator);
      }
      
      container.appendChild(optionContainer);
    });
    
    // Add checkbox entries
    checkboxes.forEach((checkbox, index) => {
      const checkboxContainer = createCheckboxField(checkbox, index, cell, container);
      
      // Add drag event listeners
      checkboxContainer.addEventListener('dragstart', (e) => {
        draggedElement = checkboxContainer;
        e.dataTransfer.effectAllowed = 'move';
        checkboxContainer.style.opacity = '0.5';
      });
      
      checkboxContainer.addEventListener('dragend', (e) => {
        checkboxContainer.style.opacity = '1';
        draggedElement = null;
      });
      
      container.appendChild(checkboxContainer);
    });
    
    // Add location indicator at the end if location index is beyond the current options
    if (locationIndex >= options.length) {
      console.log('🔍 [PROPERTIES MENU DEBUG] Adding location indicator at end (beyond options)');
      const locationIndicator = createLocationIndicator(cell, container);
      
      // Add drag event listeners to location indicator
      locationIndicator.addEventListener('dragstart', (e) => {
        draggedElement = locationIndicator;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ 
          cellId: cell.id, 
          index: locationIndex, 
          type: 'location' 
        }));
        locationIndicator.style.opacity = '0.5';
        console.log('🔍 [LOCATION ORDER DEBUG] Location drag started (end position):', {
          cellId: cell.id,
          locationIndex: locationIndex,
          type: 'location'
        });
      });
      
      locationIndicator.addEventListener('dragend', (e) => {
        locationIndicator.style.opacity = '1';
        draggedElement = null;
      });
      
      container.appendChild(locationIndicator);
    }
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
  addLocationBtn.textContent = '+ Add Checkbox';
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
    console.log('🔍 [PROPERTIES MENU DEBUG] Add Location button clicked for cell:', cell.id);
    console.log('🔍 [PROPERTIES MENU DEBUG] Before adding checkbox:', {
      checkboxesCount: (cell._checkboxes || []).length
    });
    
    // Create new checkbox entry
    const newCheckbox = { fieldName: '', options: [] };
    if (!cell._checkboxes) cell._checkboxes = [];
    cell._checkboxes.push(newCheckbox);
    
    // Initialize item order if it doesn't exist, preserving current visual order
    if (!cell._itemOrder) {
      cell._itemOrder = [];
      const options = cell._textboxes || [];
      const locationIndex = cell._locationIndex;
      
      // Replicate the exact same logic as the default order display
      // This matches the createOptionsContainer default order logic
      options.forEach((option, index) => {
        // Add location indicator BEFORE this option if it's at the location index
        if (index === locationIndex) {
          cell._itemOrder.push({ type: 'location', index: locationIndex });
        }
        // Add the option
        cell._itemOrder.push({ type: 'option', index: index });
      });
      
      // Add any existing checkboxes at the end (they weren't in the original display)
      const existingCheckboxes = cell._checkboxes.slice(0, -1); // Exclude the one we just added
      existingCheckboxes.forEach((_, index) => {
        cell._itemOrder.push({ type: 'checkbox', index: index });
      });
    }
    
    // Add the new checkbox to the end of the item order
    cell._itemOrder.push({ type: 'checkbox', index: cell._checkboxes.length - 1 });
    
    console.log('🔍 [PROPERTIES MENU DEBUG] After adding checkbox:', {
      checkboxesCount: cell._checkboxes.length,
      itemOrder: cell._itemOrder
    });
    
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        // Debug: Log the cell properties before saving
        console.log('🔍 [CHECKBOX DEBUG] Cell properties before saving:', {
          cellId: cell.id,
          hasCheckboxes: !!cell._checkboxes,
          checkboxesCount: cell._checkboxes?.length || 0,
          checkboxes: cell._checkboxes,
          hasItemOrder: !!cell._itemOrder,
          itemOrder: cell._itemOrder
        });
        
        // Explicitly set the cell properties
        graph.getModel().setValue(cell, cell.value);
        // Also ensure the properties are marked as changed
        cell._checkboxes = cell._checkboxes; // Force property update
        
        // Debug: Log the cell properties after saving
        console.log('🔍 [CHECKBOX DEBUG] Cell properties after saving:', {
          cellId: cell.id,
          hasCheckboxes: !!cell._checkboxes,
          checkboxesCount: cell._checkboxes?.length || 0,
          checkboxes: cell._checkboxes,
          hasItemOrder: !!cell._itemOrder,
          itemOrder: cell._itemOrder
        });
      } finally {
        graph.getModel().endUpdate();
      }
    }
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    
    // Refresh the canvas display to show the checkbox
    if (typeof window.updatemultipleDropdownTypeCell === 'function') {
      console.log('🔍 [CHECKBOX DEBUG] Refreshing canvas display to show checkbox');
      window.updatemultipleDropdownTypeCell(cell);
    }
    
    // Refresh the entire container to show the new checkbox entry
    console.log('🔍 [PROPERTIES MENU DEBUG] Refreshing properties menu container');
    const newContainer = createOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    console.log('🔍 [PROPERTIES MENU DEBUG] Properties menu container refreshed');
  };
  
  container.appendChild(addBtn);
  container.appendChild(addLocationBtn);
  
  // Add location button (for location indicators)
  const addLocationIndicatorBtn = document.createElement('button');
  addLocationIndicatorBtn.textContent = '+ Add Location';
  addLocationIndicatorBtn.style.cssText = `
    background: #17a2b8;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-top: 5px;
  `;
  addLocationIndicatorBtn.onclick = () => {
    console.log('🔍 [LOCATION ORDER DEBUG] Add Location button clicked for cell:', cell.id);
    console.log('🔍 [PROPERTIES MENU DEBUG] Before adding location:', {
      locationIndex: cell._locationIndex,
      textboxesCount: (cell._textboxes || []).length
    });
    
    cell._locationIndex = (cell._textboxes || []).length;
    
    console.log('🔍 [LOCATION ORDER DEBUG] After adding location:', {
      locationIndex: cell._locationIndex,
      textboxesCount: (cell._textboxes || []).length
    });
    console.log('🔍 [PROPERTIES MENU DEBUG] Location index set to:', cell._locationIndex);
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    // Refresh the entire container to show the location indicator
    console.log('🔍 [PROPERTIES MENU DEBUG] Refreshing properties menu container');
    const newContainer = createOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    console.log('🔍 [PROPERTIES MENU DEBUG] Properties menu container refreshed');
  };
  
  container.appendChild(addLocationIndicatorBtn);
  
  // Add time button
  const addTimeBtn = document.createElement('button');
  addTimeBtn.textContent = '+ Add Time';
  addTimeBtn.style.cssText = `
    background: #ff9800;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-top: 5px;
  `;
  addTimeBtn.onclick = () => {
    console.log('🔍 [PROPERTIES MENU DEBUG] Add Time button clicked for cell:', cell.id);
    console.log('🔍 [PROPERTIES MENU DEBUG] Before adding time:', {
      timesCount: (cell._times || []).length
    });
    
    // Create new time entry
    const newTime = { timeText: '', timeId: '' };
    if (!cell._times) cell._times = [];
    cell._times.push(newTime);
    
    // Initialize item order if it doesn't exist, preserving current visual order
    if (!cell._itemOrder) {
      cell._itemOrder = [];
      const options = cell._textboxes || [];
      const locationIndex = cell._locationIndex;
      
      // Replicate the exact same logic as the default order display
      // This matches the createOptionsContainer default order logic
      options.forEach((option, index) => {
        // Add location indicator BEFORE this option if it's at the location index
        if (index === locationIndex) {
          cell._itemOrder.push({ type: 'location', index: locationIndex });
        }
        // Add the option
        cell._itemOrder.push({ type: 'option', index: index });
      });
      
      // Add any existing checkboxes at the end
      const existingCheckboxes = cell._checkboxes || [];
      existingCheckboxes.forEach((_, index) => {
        cell._itemOrder.push({ type: 'checkbox', index: index });
      });
      
      // Add any existing times at the end
      const existingTimes = cell._times.slice(0, -1); // Exclude the one we just added
      existingTimes.forEach((_, index) => {
        cell._itemOrder.push({ type: 'time', index: index });
      });
    }
    
    // Add the new time to the end of the item order
    cell._itemOrder.push({ type: 'time', index: cell._times.length - 1 });
    
    console.log('🔍 [PROPERTIES MENU DEBUG] After adding time:', {
      timesCount: cell._times.length,
      itemOrder: cell._itemOrder
    });
    
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        graph.getModel().setValue(cell, cell.value);
        cell._times = cell._times;
        cell._itemOrder = cell._itemOrder;
      } finally {
        graph.getModel().endUpdate();
      }
    }
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    
    // Refresh the canvas display to show the time
    if (typeof window.updatemultipleDropdownTypeCell === 'function') {
      console.log('🔍 [TIME DEBUG] Refreshing canvas display to show time');
      window.updatemultipleDropdownTypeCell(cell);
    }
    
    // Refresh the entire container to show the new time entry
    console.log('🔍 [PROPERTIES MENU DEBUG] Refreshing properties menu container');
    const newContainer = createOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    console.log('🔍 [PROPERTIES MENU DEBUG] Properties menu container refreshed');
  };
  
  container.appendChild(addTimeBtn);
  
  return container;
}

// Helper function to create location indicator
function createLocationIndicator(cell, parentContainer) {
  console.log('🔍 [PROPERTIES MENU DEBUG] createLocationIndicator called for cell:', cell.id, 'with locationIndex:', cell._locationIndex);
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

// Helper function to create mini checkbox option entry
function createMiniCheckboxOption(option, optionIndex, checkbox, checkboxContainer, addButton) {
  const miniOptionEntry = document.createElement('div');
  miniOptionEntry.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    margin-bottom: 5px;
  `;
  
  // Checkbox text input
  const checkboxTextInput = document.createElement('input');
  checkboxTextInput.type = 'text';
  checkboxTextInput.value = option.checkboxText || '';
  checkboxTextInput.placeholder = 'Checkbox text';
  checkboxTextInput.style.cssText = `
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 12px;
  `;
  checkboxTextInput.onblur = () => {
    option.checkboxText = checkboxTextInput.value;
    
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        // Explicitly set the cell properties
        graph.getModel().setValue(cell, cell.value);
        // Also ensure the properties are marked as changed
        cell._checkboxes = cell._checkboxes; // Force property update
      } finally {
        graph.getModel().endUpdate();
      }
    }
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  // Node ID input
  const nodeIdInput = document.createElement('input');
  nodeIdInput.type = 'text';
  nodeIdInput.value = option.nodeId || '';
  nodeIdInput.placeholder = 'Node ID';
  nodeIdInput.style.cssText = `
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 12px;
  `;
  nodeIdInput.onblur = () => {
    option.nodeId = nodeIdInput.value;
    
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        // Explicitly set the cell properties
        graph.getModel().setValue(cell, cell.value);
        // Also ensure the properties are marked as changed
        cell._checkboxes = cell._checkboxes; // Force property update
      } finally {
        graph.getModel().endUpdate();
      }
    }
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  // Delete button for mini option
  const deleteMiniBtn = document.createElement('button');
  deleteMiniBtn.textContent = '×';
  deleteMiniBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
    min-width: 24px;
  `;
  deleteMiniBtn.onclick = () => {
    // Remove the option from the checkbox options array
    checkbox.options.splice(optionIndex, 1);
    
    // Remove the mini option entry from the DOM
    checkboxContainer.removeChild(miniOptionEntry);
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  // Assemble mini option entry
  miniOptionEntry.appendChild(checkboxTextInput);
  miniOptionEntry.appendChild(nodeIdInput);
  miniOptionEntry.appendChild(deleteMiniBtn);
  
  return miniOptionEntry;
}

// Helper function to create time field
function createTimeField(time, index, cell, parentContainer) {
  const timeContainer = document.createElement('div');
  timeContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: move;
    transition: 0.2s;
  `;
  timeContainer.draggable = true;
  timeContainer.dataset.index = index;
  timeContainer.dataset.type = 'time';

  // Drag handle
  const dragHandle = document.createElement('div');
  dragHandle.textContent = '⋮⋮';
  dragHandle.style.cssText = `
    cursor: move;
    color: #666;
    font-size: 14px;
    user-select: none;
    padding: 2px;
  `;

  // Time Text input
  const timeTextInput = document.createElement('input');
  timeTextInput.type = 'text';
  timeTextInput.placeholder = 'Time Text:';
  timeTextInput.value = time.timeText || '';
  timeTextInput.style.cssText = `
    flex: 1;
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
  `;
  timeTextInput.onblur = () => {
    time.timeText = timeTextInput.value;
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        graph.getModel().setValue(cell, cell.value);
        cell._times = cell._times;
      } finally {
        graph.getModel().endUpdate();
      }
    }
  };

  // Time ID input
  const timeIdInput = document.createElement('input');
  timeIdInput.type = 'text';
  timeIdInput.placeholder = 'Time ID:';
  timeIdInput.value = time.timeId || '';
  timeIdInput.style.cssText = `
    flex: 1;
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
  `;
  timeIdInput.onblur = () => {
    time.timeId = timeIdInput.value;
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        graph.getModel().setValue(cell, cell.value);
        cell._times = cell._times;
      } finally {
        graph.getModel().endUpdate();
      }
    }
  };

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
    const timeId = time.timeId || `time_${index}`;
    navigator.clipboard.writeText(timeId);
    alert(`Time ID copied: ${timeId}`);
  };

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.style.cssText = `
    background: #f44336;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  deleteBtn.onclick = () => {
    if (!cell._times) cell._times = [];
    cell._times.splice(index, 1);
    // Refresh the entire container to maintain proper order
    const newContainer = createOptionsContainer(cell);
    parentContainer.parentNode.replaceChild(newContainer, parentContainer);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };

  timeContainer.appendChild(dragHandle);
  timeContainer.appendChild(timeTextInput);
  timeContainer.appendChild(timeIdInput);
  timeContainer.appendChild(copyBtn);
  timeContainer.appendChild(deleteBtn);

  return timeContainer;
}

// Helper function to create checkbox field
function createCheckboxField(checkbox, index, cell, parentContainer) {
  const checkboxContainer = document.createElement('div');
  checkboxContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 15px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: move;
    transition: all 0.2s ease;
  `;
  checkboxContainer.draggable = true;
  checkboxContainer.dataset.index = index;
  checkboxContainer.dataset.type = 'checkbox';
  
  // Add hover effect
  checkboxContainer.addEventListener('mouseenter', () => {
    checkboxContainer.style.backgroundColor = '#f8f9fa';
    checkboxContainer.style.borderColor = '#007bff';
  });
  checkboxContainer.addEventListener('mouseleave', () => {
    checkboxContainer.style.backgroundColor = 'white';
    checkboxContainer.style.borderColor = '#ddd';
  });
  
  // Top row with drag handle, field name input, and action buttons
  const topRow = document.createElement('div');
  topRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  
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
  
  // Field name input
  const fieldNameInput = document.createElement('input');
  fieldNameInput.type = 'text';
  fieldNameInput.value = checkbox.fieldName || '';
  fieldNameInput.placeholder = 'Field Name';
  fieldNameInput.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  fieldNameInput.onblur = () => {
    checkbox.fieldName = fieldNameInput.value;
    
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        // Explicitly set the cell properties
        graph.getModel().setValue(cell, cell.value);
        // Also ensure the properties are marked as changed
        cell._checkboxes = cell._checkboxes; // Force property update
      } finally {
        graph.getModel().endUpdate();
      }
    }
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
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
    if (!cell._checkboxes) cell._checkboxes = [];
    cell._checkboxes.splice(index, 1);
    // Refresh the entire container to maintain proper order
    const newContainer = createOptionsContainer(cell);
    parentContainer.parentNode.replaceChild(newContainer, parentContainer);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  // Add checkbox option button
  const addCheckboxOptionBtn = document.createElement('button');
  addCheckboxOptionBtn.textContent = 'Add checkbox option';
  addCheckboxOptionBtn.style.cssText = `
    background: #6f42c1;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    margin-top: 5px;
  `;
  addCheckboxOptionBtn.onclick = () => {
    console.log('🔍 [PROPERTIES MENU DEBUG] Add checkbox option clicked for checkbox:', index);
    
    // Create new checkbox option
    const newOption = { checkboxText: '', nodeId: '' };
    if (!checkbox.options) checkbox.options = [];
    checkbox.options.push(newOption);
    
    // Create mini checkbox option entry
    const miniOptionEntry = createMiniCheckboxOption(newOption, checkbox.options.length - 1, checkbox, checkboxContainer, addCheckboxOptionBtn);
    
    // Insert the mini option above the "Add checkbox option" button
    // Check if the button still exists in the container before inserting
    if (checkboxContainer.contains(addCheckboxOptionBtn)) {
      checkboxContainer.insertBefore(miniOptionEntry, addCheckboxOptionBtn);
    } else {
      // If button doesn't exist, just append to the end
      checkboxContainer.appendChild(miniOptionEntry);
    }
    
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        // Explicitly set the cell properties
        graph.getModel().setValue(cell, cell.value);
        // Also ensure the properties are marked as changed
        cell._checkboxes = cell._checkboxes; // Force property update
      } finally {
        graph.getModel().endUpdate();
      }
    }
    
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  
  // Assemble top row
  topRow.appendChild(dragHandle);
  topRow.appendChild(fieldNameInput);
  topRow.appendChild(copyBtn);
  topRow.appendChild(deleteBtn);
  
  // Add existing mini checkbox options
  if (checkbox.options && checkbox.options.length > 0) {
    checkbox.options.forEach((option, optionIndex) => {
      const miniOptionEntry = createMiniCheckboxOption(option, optionIndex, checkbox, checkboxContainer, addCheckboxOptionBtn);
      // Check if the button still exists in the container before inserting
      if (checkboxContainer.contains(addCheckboxOptionBtn)) {
        checkboxContainer.insertBefore(miniOptionEntry, addCheckboxOptionBtn);
      } else {
        // If button doesn't exist, just append to the end
        checkboxContainer.appendChild(miniOptionEntry);
      }
    });
  }
  
  // Assemble checkbox container
  checkboxContainer.appendChild(topRow);
  checkboxContainer.appendChild(addCheckboxOptionBtn);
  
  return checkboxContainer;
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
  console.log('🔍 [CANVAS DISPLAY DEBUG] updatemultipleDropdownTypeCell called for cell:', cell.id);
  console.log('🔍 [CANVAS DISPLAY DEBUG] Function called from:', new Error().stack?.split('\n')[2]?.trim());
  
  const graph = getGraph();
  if (!graph) return;
  
  const qText = cell._questionText || 'Numbered Dropdown Question';
  const twoNums = cell._twoNumbers || { first: '0', second: '0' };
  const options = cell._textboxes || [];
  const checkboxes = cell._checkboxes || [];
  const times = cell._times || [];
  const locationIndex = cell._locationIndex !== undefined ? cell._locationIndex : -1;
  
  console.log('🔍 [CANVAS DISPLAY DEBUG] Cell data received:', {
    cellId: cell.id,
    questionText: qText,
    twoNumbers: twoNums,
    optionsCount: options.length,
    checkboxesCount: checkboxes.length,
    locationIndex: locationIndex,
    rawLocationIndex: cell._locationIndex,
    locationIndexType: typeof cell._locationIndex,
    options: options.map((opt, idx) => ({ index: idx, nameId: opt.nameId, placeholder: opt.placeholder })),
    checkboxes: checkboxes.map((cb, idx) => ({ index: idx, fieldName: cb.fieldName, optionsCount: cb.options?.length || 0 }))
  });
  
  // Create display showing the actual order of options and location
  let optionsHtml = '';
  
  // Create a combined array that includes all items in the correct order
  const allItems = [];
  
  // Use unified item order if it exists, otherwise create default order
  if (cell._itemOrder && cell._itemOrder.length > 0) {
    console.log('🔍 [CANVAS DISPLAY DEBUG] Using unified item order:', cell._itemOrder);
    
    cell._itemOrder.forEach((item, displayIndex) => {
      if (item.type === 'option' && options[item.index]) {
        allItems.push({
          type: 'option',
          index: item.index,
          text: options[item.index].nameId || 'Option ' + (item.index + 1)
        });
      } else if (item.type === 'checkbox' && checkboxes[item.index]) {
        allItems.push({
          type: 'checkbox',
          index: item.index,
          text: checkboxes[item.index].fieldName || 'Checkbox ' + (item.index + 1),
          options: checkboxes[item.index].options || []
        });
      } else if (item.type === 'time' && times[item.index]) {
        allItems.push({
          type: 'time',
          index: item.index,
          text: times[item.index].timeText || 'Time ' + (item.index + 1),
          timeId: times[item.index].timeId || ''
        });
      } else if (item.type === 'location') {
        allItems.push({
          type: 'location',
          index: item.index,
          text: 'Location Date Inserted'
        });
      }
    });
  } else {
    // Fallback to default order (options first, then checkboxes, then location)
    console.log('🔍 [CANVAS DISPLAY DEBUG] Using default order (no unified item order)');
    
    // Add all options to the combined array
    options.forEach((option, index) => {
      allItems.push({
        type: 'option',
        index: index,
        text: option.nameId || 'Option ' + (index + 1)
      });
    });
    
    // Add all checkboxes to the combined array
    checkboxes.forEach((checkbox, index) => {
      allItems.push({
        type: 'checkbox',
        index: index,
        text: checkbox.fieldName || 'Checkbox ' + (index + 1),
        options: checkbox.options || []
      });
    });
    
    // Add all times to the combined array
    times.forEach((time, index) => {
      allItems.push({
        type: 'time',
        index: index,
        text: time.timeText || 'Time ' + (index + 1),
        timeId: time.timeId || ''
      });
    });
    
    // Insert location indicator at the correct position
    if (locationIndex >= 0) {
      console.log('🔍 [CANVAS DISPLAY DEBUG] Inserting location at index:', locationIndex);
      console.log('🔍 [CANVAS DISPLAY DEBUG] All items before location insertion:', allItems);
      allItems.splice(locationIndex, 0, {
        type: 'location',
        index: locationIndex,
        text: 'Location Date Inserted'
      });
      console.log('🔍 [CANVAS DISPLAY DEBUG] All items after location insertion:', allItems);
    } else {
      console.log('🔍 [CANVAS DISPLAY DEBUG] No location to insert (locationIndex < 0)');
    }
  }
  
  console.log('🔍 [LOCATION ORDER DEBUG] Combined items array:', allItems);
  console.log('🔍 [LOCATION ORDER DEBUG] About to generate HTML for', allItems.length, 'items');
  
  // Generate HTML for all items in the correct order
  allItems.forEach((item, displayIndex) => {
    console.log('🔍 [CANVAS DISPLAY DEBUG] Processing item', displayIndex, ':', item);
    if (item.type === 'option') {
      console.log('🔍 [CANVAS DISPLAY DEBUG] Adding option HTML for:', item.text);
      optionsHtml += `
        <div style="margin: 4px 0; padding: 6px 10px; background: #f8f9fa; border: 1px solid #e0e7ef; border-radius: 4px; font-size: 12px; color: #2c3e50;">
          ${getEscapeAttr()(item.text)}
        </div>
      `;
    } else if (item.type === 'location') {
      console.log('🔍 [CANVAS DISPLAY DEBUG] Adding location HTML for:', item.text);
      optionsHtml += `
        <div style="margin: 4px 0; padding: 6px 10px; background: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; font-size: 12px; color: #28a745; font-weight: bold; text-align: center;">
          📍 ${getEscapeAttr()(item.text)}
        </div>
      `;
    } else if (item.type === 'checkbox') {
      console.log('🔍 [CANVAS DISPLAY DEBUG] Adding checkbox HTML for:', item.text);
      const checkboxOptionsHtml = item.options.map(opt => 
        `<div style="margin: 2px 0; padding: 2px 6px; background: #f3e5f5; border: 1px solid #9c27b0; border-radius: 3px; font-size: 10px; color: #6a1b9a;">
          ☑ ${getEscapeAttr()(opt.checkboxText || '')} → ${getEscapeAttr()(opt.nodeId || '')}
        </div>`
      ).join('');
      
        optionsHtml += `
          <div style="margin: 4px 0; padding: 8px 12px; background: #f3e5f5; border: 2px dashed #9c27b0; border-radius: 6px; font-size: 12px; color: #6a1b9a; font-weight: bold; text-align: center;">
            <div style="margin-bottom: 4px;">☑ ${getEscapeAttr()(item.text)}</div>
            ${checkboxOptionsHtml}
          </div>
        `;
      } else if (item.type === 'time') {
        console.log('🔍 [CANVAS DISPLAY DEBUG] Adding time HTML for:', item.text);
        optionsHtml += `
          <div style="margin: 4px 0; padding: 8px 12px; background: #fff3e0; border: 2px dashed #ff9800; border-radius: 6px; font-size: 12px; color: #e65100; font-weight: bold; text-align: center;">
            <div style="margin-bottom: 4px;">🕐 ${getEscapeAttr()(item.text)}</div>
            <div style="font-size: 10px; color: #bf360c;">ID: ${getEscapeAttr()(item.timeId || '')}</div>
          </div>
        `;
      }
    });
  
  console.log('🔍 [LOCATION ORDER DEBUG] Generated HTML length:', optionsHtml.length);
  console.log('🔍 [LOCATION ORDER DEBUG] Generated options HTML:', optionsHtml);
  
  const html = `
    <div style="padding: 15px; font-family: Arial, sans-serif; text-align: center;">
      <div style="font-weight: bold; color: #2196F3; margin-bottom: 8px; font-size: 14px;">${getEscapeAttr()(qText)}</div>
      <div style="margin-bottom: 8px; color: #666; font-size: 12px;">
        <strong>Range:</strong> ${twoNums.first} to ${twoNums.second}
      </div>
      <div style="margin-bottom: 8px; color: #666; font-size: 12px;">
        <strong>Order:</strong>
      </div>
      <div style="max-height: 200px; overflow-y: auto; margin-bottom: 8px;">
        ${optionsHtml}
      </div>
      <div style="font-style: italic; color: #999; font-size: 10px;">Double-click to configure</div>
    </div>
  `;
  
  console.log('🔍 [CANVAS DISPLAY DEBUG] About to update cell with HTML');
  console.log('🔍 [CANVAS DISPLAY DEBUG] Final HTML length:', html.length);
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
    let st = cell.style || '';
    if (!st.includes('verticalAlign=middle')) {
      st += 'verticalAlign=middle;';
    }
    graph.getModel().setStyle(cell, st);
    console.log('🔍 [CANVAS DISPLAY DEBUG] Cell value and style updated');
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
  console.log('🔍 [CANVAS DISPLAY DEBUG] Cell size updated, function complete');
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
  console.log('🔍 [LOCATION ORDER DEBUG] reorderMultipleDropdownEntries called:', {
    cellId: cellId,
    sourceIndex: sourceIndex,
    targetIndex: targetIndex
  });
  
  const cell = getGraph()?.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "multipleDropdownType" || !cell._textboxes) {
    console.log('🔍 [LOCATION ORDER DEBUG] Invalid cell or not multipleDropdownType, returning');
    return;
  }
  
  console.log('🔍 [LOCATION ORDER DEBUG] Before reorder:', {
    locationIndex: cell._locationIndex,
    textboxes: cell._textboxes.map((tb, idx) => ({ index: idx, nameId: tb.nameId }))
  });
  
  getGraph().getModel().beginUpdate();
  try {
    // Remove the item from source position
    const [movedItem] = cell._textboxes.splice(sourceIndex, 1);
    
    // Insert it at target position
    cell._textboxes.splice(targetIndex, 0, movedItem);
    
    console.log('🔍 [LOCATION ORDER DEBUG] After reorder:', {
      locationIndex: cell._locationIndex,
      textboxes: cell._textboxes.map((tb, idx) => ({ index: idx, nameId: tb.nameId }))
    });
    
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
