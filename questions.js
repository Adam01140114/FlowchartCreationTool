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
// Helper function to generate node IDs for dropdown trigger sequence fields
// Make it globally accessible for use in library.js
window.generateNodeIdForDropdownField = function generateNodeIdForDropdownField(fieldName, dropdownName, cell, triggerOption = '') {
  // Get PDF name if available
  const pdfName = typeof window.getPdfNameForNode === 'function' ? window.getPdfNameForNode(cell) : null;
  const sanitizedPdfName = pdfName ? pdfName.replace(/\.pdf$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
  // Build base name components - use window.sanitizeNameId to preserve forward slashes
  const sanitizeFn = typeof window.sanitizeNameId === 'function' ? window.sanitizeNameId : 
    (name) => (name || '').toLowerCase().replace(/[?]/g, '').replace(/[^a-z0-9\s\/]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
  const baseQuestionName = sanitizeFn(cell._questionText || cell.value || "unnamed");
  const nodeId = sanitizedPdfName ? `${sanitizedPdfName}_${baseQuestionName}` : baseQuestionName;
  // Generate the field node ID - use dropdown name as the base, not the full question name
  // Use window.sanitizeNameId to preserve forward slashes
  const sanitizedFieldName = sanitizeFn(fieldName);
  const sanitizedDropdownName = sanitizeFn(dropdownName);
  const sanitizedTriggerOption = sanitizeFn(triggerOption);
  // Format: dropdownName_triggerOption_fieldName (or with PDF prefix if available)
  if (sanitizedTriggerOption) {
    return sanitizedPdfName ? 
      `${nodeId}_${sanitizedDropdownName}_${sanitizedTriggerOption}_${sanitizedFieldName}` : 
      `${sanitizedDropdownName}_${sanitizedTriggerOption}_${sanitizedFieldName}`;
  } else {
    // Fallback to old format if no trigger option
    return sanitizedPdfName ? 
      `${nodeId}_${sanitizedDropdownName}_${sanitizedFieldName}` : 
      `${sanitizedDropdownName}_${sanitizedFieldName}`;
  }
}
// Helper function to create uneditable node ID input with double-click copy
function createUneditableNodeIdInput(placeholder, value, onDoubleClick) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.placeholder = placeholder;
  input.readOnly = true;
  input.style.cssText = `
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 12px;
    background-color: #f8f9fa;
    cursor: pointer;
  `;
  // Add double-click to copy functionality
  input.ondblclick = () => {
    if (onDoubleClick) {
      onDoubleClick(input);
    }
  };
  return input;
}
// Helper function to get all checkbox option node IDs from a trigger sequence
// Make it globally accessible for use in library.js
window.getCheckboxOptionNodeIdsFromTriggerSequence = function getCheckboxOptionNodeIdsFromTriggerSequence(triggerSequence, parentDropdown = null, cell = null) {
  const nodeIds = [];
  // Get checkbox option node IDs
  if (triggerSequence && triggerSequence.checkboxes) {
    triggerSequence.checkboxes.forEach(checkbox => {
      if (checkbox.options && Array.isArray(checkbox.options)) {
        checkbox.options.forEach(option => {
          if (option.nodeId) {
            nodeIds.push(option.nodeId);
          }
        });
      }
    });
  }
  // Get dropdown option node IDs from dropdowns inside the trigger sequence
  if (triggerSequence && triggerSequence.dropdowns && parentDropdown && cell) {
    // Get the parent dropdown's nodeId - use sanitizeNameId for consistency
    const parentDropdownNodeId = typeof window.sanitizeNameId === 'function' 
      ? window.sanitizeNameId(parentDropdown.name || '')
      : (parentDropdown.name || '').toLowerCase().replace(/[?]/g, '').replace(/[^a-z0-9\s\/]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
    triggerSequence.dropdowns.forEach((dropdown, dropdownIndex) => {
      if (dropdown.fieldName && dropdown.options && Array.isArray(dropdown.options)) {
        dropdown.options.forEach((option, optionIndex) => {
          if (option.text) {
            // Sanitize the dropdown field name and option value
            // Use sanitizeNameId for consistency with generateNodeIdForDropdownField
            const sanitizedFieldName = typeof window.sanitizeNameId === 'function'
              ? window.sanitizeNameId(dropdown.fieldName || '')
              : (dropdown.fieldName || '').toLowerCase().replace(/[?]/g, '').replace(/[^a-z0-9\s\/]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
            const sanitizedOptionValue = typeof window.sanitizeNameId === 'function'
              ? window.sanitizeNameId(option.text || '')
              : (option.text || '').toLowerCase().replace(/[?]/g, '').replace(/[^a-z0-9\s\/]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
            // Generate the hidden checkbox ID: {parentDropdownNodeId}_{dropdownFieldName}_{optionValue}
            const checkboxId = `${parentDropdownNodeId}_${sanitizedFieldName}_${sanitizedOptionValue}`;
            if (!nodeIds.includes(checkboxId)) {
              nodeIds.push(checkboxId);
            }
          }
        });
      }
    });
  }
  return nodeIds;
}
// Helper function to create unified dropdown entry that looks like other entries
function createUnifiedDropdownEntry(dropdown, index, cell) {
  const entryContainer = document.createElement('div');
  entryContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: white;
    border: 1px solid #9c27b0;
    border-radius: 6px;
    margin-bottom: 8px;
    cursor: move;
    transition: all 0.2s ease;
  `;
  entryContainer.draggable = true;
  entryContainer.dataset.index = index;
  entryContainer.dataset.type = 'dropdown';
  // Drag handle
  const dragHandle = document.createElement('div');
  dragHandle.textContent = '⋮⋮';
  dragHandle.style.cssText = `
    cursor: move;
    color: #666;
    font-size: 14px;
    user-select: none;
    padding: 2px;
    margin-right: 8px;
  `;
  entryContainer.appendChild(dragHandle);
  // Dropdown name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = dropdown.name || '';
  nameInput.placeholder = 'Dropdown Name';
  nameInput.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  nameInput.onblur = () => {
    dropdown.name = nameInput.value.trim();
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  entryContainer.appendChild(nameInput);
  // Summary display
  const summaryDiv = document.createElement('div');
  summaryDiv.style.cssText = `
    font-size: 11px;
    color: #666;
    margin-left: 8px;
    flex-shrink: 0;
  `;
  const updateSummary = () => {
    const optionsCount = dropdown.options ? dropdown.options.length : 0;
    const triggersCount = dropdown.triggerSequences ? dropdown.triggerSequences.length : 0;
    summaryDiv.textContent = `${optionsCount} options, ${triggersCount} triggers`;
  };
  updateSummary();
  entryContainer.appendChild(summaryDiv);
  // Copy ID button
  const copyIdBtn = document.createElement('button');
  copyIdBtn.textContent = 'Copy ID';
  copyIdBtn.style.cssText = `
    background: #17a2b8;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    margin-left: 4px;
  `;
  copyIdBtn.onclick = () => {
    const nodeId = dropdown.name || 'dropdown';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(nodeId).then(() => {
        copyIdBtn.textContent = 'Copied!';
        copyIdBtn.style.background = '#28a745';
        setTimeout(() => {
          copyIdBtn.textContent = 'Copy ID';
          copyIdBtn.style.background = '#17a2b8';
        }, 1500);
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = nodeId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      copyIdBtn.textContent = 'Copied!';
      copyIdBtn.style.background = '#28a745';
      setTimeout(() => {
        copyIdBtn.textContent = 'Copy ID';
        copyIdBtn.style.background = '#17a2b8';
      }, 1500);
    }
  };
  entryContainer.appendChild(copyIdBtn);
  // Configure button to open full dropdown configuration
  const configureBtn = document.createElement('button');
  configureBtn.textContent = 'Configure';
  configureBtn.style.cssText = `
    background: #9c27b0;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    margin-left: 4px;
  `;
  configureBtn.onclick = () => {
    // Create and show the full dropdown configuration
    const dropdownConfigModal = document.createElement('div');
    dropdownConfigModal.style.cssText = `
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
    `;
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 20px;
      max-width: 90%;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    // Create the full dropdown field configuration
    const dropdownContainer = createDropdownField(dropdown, index, cell, modalContent);
    modalContent.appendChild(dropdownContainer);
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      background: #6c757d;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 15px;
      width: 100%;
    `;
    closeBtn.onclick = () => {
      document.body.removeChild(dropdownConfigModal);
      updateSummary(); // Refresh the summary display
    };
    modalContent.appendChild(closeBtn);
    dropdownConfigModal.appendChild(modalContent);
    document.body.appendChild(dropdownConfigModal);
    // Close on background click
    dropdownConfigModal.onclick = (e) => {
      if (e.target === dropdownConfigModal) {
        document.body.removeChild(dropdownConfigModal);
        updateSummary(); // Refresh the summary display
      }
    };
  };
  entryContainer.appendChild(configureBtn);
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.style.cssText = `
    background: #f44336;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
  `;
  deleteBtn.onclick = () => {
    // Remove from data
    const dropdownIndex = cell._dropdowns.findIndex(d => d.id === dropdown.id);
    if (dropdownIndex !== -1) {
      cell._dropdowns.splice(dropdownIndex, 1);
    }
    // Remove from item order
    const itemOrderIndex = cell._itemOrder.findIndex(item => item.type === 'dropdown' && item.index === dropdownIndex);
    if (itemOrderIndex !== -1) {
      cell._itemOrder.splice(itemOrderIndex, 1);
    }
    // Remove from DOM
    entryContainer.remove();
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  entryContainer.appendChild(deleteBtn);
  return entryContainer;
}
function getQuestionType(cell) {
  if (!cell) {
    return "";
  }
  const style = cell.style || "";
  const m = style.match(/questionType=([^;]+)/);
  return m ? m[1] : "";
}
function isSimpleHtmlQuestion(cell) {
  if (!cell || !cell.style) return false;
  const qt = getQuestionType(cell);
  return qt === 'text' || qt === 'number' || qt === 'currency' || qt === 'date' || qt === 'email' || qt === 'phone' || qt === 'bigParagraph';
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
      case 'text': case 'date': case 'number': case 'currency': case 'bigParagraph':
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
        cell._textboxes = [{ nameId:'', placeholder:'Enter value', prefill: '' }];
        updateMultipleTextboxesCell(cell);
        break;
      case 'multipleDropdownType':
        cell._questionText = preservedText || '';
        cell._twoNumbers = { first:'0', second:'0' };
        cell._textboxes = [{ nameId:'', placeholder:'Enter value', isAmountOption:false, prefill: '' }];
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
  // For date range nodes, add a copy ID button
  if (questionType === 'dateRange') {
    return `<div style="display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; justify-content: center;">
      <div class="question-title-input" onfocus="if(this.innerText==='${placeholder}')this.innerText='';" onblur="window.updateSimpleQuestionTitle('${cell.id}', this.innerText)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')" style="margin-bottom: 8px;">${getEscapeHtml()(text) || placeholder}</div>
      <button onclick="window.showDateRangeCopyDialog('${cell.id}')" style="padding: 6px 12px; background-color: #007bff; color: white; border: 2px solid #0056b3; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Copy ID" onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007bff'">Copy ID</button>
    </div>`;
  }
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
          <option value="currency">Currency</option>
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
    cell._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false, prefill: '' }];
  }
  let html = "";
  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || "";
    const ph  = tb.placeholder || "Enter value";
    const entryType = tb.type || (tb.isAmountOption ? 'amount' : 'label');
    const isAmountOption = entryType === 'amount';
    const isPhoneOption = entryType === 'phone';
    html += `
      <div class="textbox-entry" style="margin-bottom:8px;text-align:center; display: flex; align-items: center; gap: 4px;">
        <input type="text" value="${getEscapeAttr()(val)}" data-index="${index}" placeholder="${getEscapeAttr()(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updateMultipleTextboxHandler('${cell.id}', ${index}, this.value)" style="flex: 1;" />
        <button onclick="window.deleteMultipleTextboxHandler('${cell.id}', ${index})">Delete</button>
        <button onclick="window.copyMultipleTextboxId('${cell.id}', ${index})" style="margin-left: 4px; background-color: #4CAF50; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 11px;">Copy ID</button>
        <div style="display:flex; align-items:center; gap:10px;">
          <label style="display:flex; align-items:center; gap:5px; font-size:13px;">
            <input type="radio" name="mtb_type_${cell.id}_${index}" value="amount" ${isAmountOption ? 'checked' : ''} onclick="window.setMultipleTextboxType('${cell.id}', ${index}, 'amount')" />
            Amount?
          </label>
          <label style="display:flex; align-items:center; gap:5px; font-size:13px;">
            <input type="radio" name="mtb_type_${cell.id}_${index}" value="phone" ${isPhoneOption ? 'checked' : ''} onclick="window.setMultipleTextboxType('${cell.id}', ${index}, 'phone')" />
            Phone?
          </label>
        </div>
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
      isAmount: false,
      prefill: ''
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
// Make functions globally accessible
window.toggleReorderAmount = toggleReorderAmount;
window.addOptionInReorderModal = addOptionInReorderModal;
window.findPdfNameForQuestion = findPdfNameForQuestion;
window.sanitizePdfName = sanitizePdfName;
// Function to save trigger sequence order based on DOM position
function saveTriggerSequenceOrder(actionsList, triggerSequence) {
  // Get all draggable entries in their current DOM order
  const entries = Array.from(actionsList.querySelectorAll('[draggable="true"]'));
  // Separate entries by type
  const orderedLabels = [];
  const orderedCheckboxes = [];
  const orderedTimes = [];
  const orderedLocations = [];
  const orderedPdfs = [];
  const orderedDropdowns = [];
  // Create unified order array that preserves cross-type ordering
  const unifiedOrder = [];
  entries.forEach((entry) => {
    const type = entry.dataset.type;
    if (type === 'label') {
      // Find the label object by matching fieldName from the DOM
      const fieldNameInput = entry.querySelector('input[type="text"]');
      if (fieldNameInput) {
        const fieldName = fieldNameInput.value.trim();
        const label = (triggerSequence.labels || []).find(l => l.fieldName === fieldName);
        if (label) {
          orderedLabels.push(label);
          unifiedOrder.push({ type: 'label', identifier: fieldName });
        }
      }
    } else if (type === 'checkbox') {
      // Find the checkbox object by matching fieldName from the DOM
      const fieldNameInput = entry.querySelector('input[type="text"]');
      if (fieldNameInput) {
        const fieldName = fieldNameInput.value.trim();
        const checkbox = (triggerSequence.checkboxes || []).find(c => c.fieldName === fieldName);
        if (checkbox) {
          orderedCheckboxes.push(checkbox);
          unifiedOrder.push({ type: 'checkbox', identifier: fieldName });
        }
      }
    } else if (type === 'time') {
      // Find the time object by matching fieldName from the DOM
      const fieldNameInput = entry.querySelector('input[type="text"]');
      if (fieldNameInput) {
        const fieldName = fieldNameInput.value.trim();
        const time = (triggerSequence.times || []).find(t => t.fieldName === fieldName);
        if (time) {
          orderedTimes.push(time);
          unifiedOrder.push({ type: 'time', identifier: fieldName });
        }
      }
    } else if (type === 'location') {
      // Find the location object by matching locationTitle or fieldName from the DOM
      const locationTitleInput = entry.querySelector('input[placeholder="Enter location title..."]');
      const fieldNameInput = entry.querySelector('input[type="text"]:not([placeholder="Enter location title..."])');
      // Try matching by locationTitle first, then fieldName
      let location = null;
      let identifier = null;
      if (locationTitleInput && locationTitleInput.value.trim()) {
        const locationTitle = locationTitleInput.value.trim();
        location = (triggerSequence.locations || []).find(l => l.locationTitle === locationTitle);
        if (location) {
          identifier = location.locationTitle || location.fieldName || 'location';
        }
      }
      if (!location && fieldNameInput && fieldNameInput.value.trim()) {
        const fieldName = fieldNameInput.value.trim();
        location = (triggerSequence.locations || []).find(l => l.fieldName === fieldName);
        if (location) {
          identifier = location.locationTitle || location.fieldName || 'location';
        }
      }
      if (!location && triggerSequence.locations && triggerSequence.locations.length > 0) {
        // Fallback: if only one location, use it
        if (triggerSequence.locations.length === 1) {
          location = triggerSequence.locations[0];
          identifier = location.locationTitle || location.fieldName || 'location';
        }
      }
      if (location) {
        orderedLocations.push(location);
        unifiedOrder.push({ type: 'location', identifier: identifier || 'location' });
      }
    } else if (type === 'pdf') {
      // Find the PDF object by matching triggerNumber, pdfTitle, or pdfFilename from the DOM
      const triggerNumberInput = entry.querySelector('input[placeholder="Trigger number..."]');
      const pdfTitleInput = entry.querySelector('input[placeholder="PDF title..."]');
      const pdfFilenameInput = entry.querySelector('input[placeholder="PDF filename..."]');
      let pdf = null;
      let identifier = null;
      // Try matching by triggerNumber first, then pdfTitle, then pdfFilename
      if (triggerNumberInput && triggerNumberInput.value.trim()) {
        const triggerNumber = triggerNumberInput.value.trim();
        pdf = (triggerSequence.pdfs || []).find(p => p.triggerNumber === triggerNumber);
        if (pdf) {
          identifier = triggerNumber || pdf.pdfTitle || pdf.pdfFilename || 'pdf';
        }
      }
      if (!pdf && pdfTitleInput && pdfTitleInput.value.trim()) {
        const pdfTitle = pdfTitleInput.value.trim();
        pdf = (triggerSequence.pdfs || []).find(p => p.pdfTitle === pdfTitle);
        if (pdf) {
          identifier = pdf.triggerNumber || pdfTitle || pdf.pdfFilename || 'pdf';
        }
      }
      if (!pdf && pdfFilenameInput && pdfFilenameInput.value.trim()) {
        const pdfFilename = pdfFilenameInput.value.trim();
        pdf = (triggerSequence.pdfs || []).find(p => p.pdfFilename === pdfFilename);
        if (pdf) {
          identifier = pdf.triggerNumber || pdf.pdfTitle || pdfFilename || 'pdf';
        }
      }
      if (!pdf && triggerSequence.pdfs && triggerSequence.pdfs.length > 0) {
        // Fallback: if only one PDF, use it
        if (triggerSequence.pdfs.length === 1) {
          pdf = triggerSequence.pdfs[0];
          identifier = pdf.triggerNumber || pdf.pdfTitle || pdf.pdfFilename || 'pdf';
        }
      }
      if (pdf) {
        orderedPdfs.push(pdf);
        unifiedOrder.push({ type: 'pdf', identifier: identifier || 'pdf' });
      }
    } else if (type === 'dropdown') {
      // Find the dropdown object by matching fieldName from the DOM
      const fieldNameInput = entry.querySelector('input[placeholder="Enter dropdown question title..."]');
      if (fieldNameInput) {
        const fieldName = fieldNameInput.value.trim();
        const dropdown = (triggerSequence.dropdowns || []).find(d => d.fieldName === fieldName);
        if (dropdown) {
          orderedDropdowns.push(dropdown);
          unifiedOrder.push({ type: 'dropdown', identifier: fieldName });
        }
      }
    }
  });
  // Update the arrays with the new order (preserve items not found in DOM)
  if (triggerSequence.labels) {
    // Add any labels that weren't found (shouldn't happen, but safety check)
    orderedLabels.forEach(label => {
      if (!triggerSequence.labels.includes(label)) {
        // This shouldn't happen, but handle it
      }
    });
    triggerSequence.labels = orderedLabels;
  }
  if (triggerSequence.checkboxes) {
    triggerSequence.checkboxes = orderedCheckboxes;
  }
  if (triggerSequence.times) {
    triggerSequence.times = orderedTimes;
  }
  if (triggerSequence.locations) {
    triggerSequence.locations = orderedLocations;
  }
  if (triggerSequence.pdfs) {
    triggerSequence.pdfs = orderedPdfs;
  }
  if (triggerSequence.dropdowns) {
    triggerSequence.dropdowns = orderedDropdowns;
  }
  // Store the unified order array to preserve cross-type ordering
  triggerSequence._actionOrder = unifiedOrder;
}
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
  closeBtn.onclick = () => {
    // Save order for all trigger sequences before closing
    if (cell._dropdowns) {
      cell._dropdowns.forEach((dropdown) => {
        if (dropdown.triggerSequences) {
          dropdown.triggerSequences.forEach((triggerSequence) => {
            // Find all trigger divs and match them to trigger sequences
            const allTriggerDivs = modal.querySelectorAll('.trigger-sequence');
            allTriggerDivs.forEach((triggerDiv) => {
              const actionsList = triggerDiv.querySelector('.actions-list');
              if (actionsList) {
                // Check if this matches our trigger sequence by comparing triggerOption
                const select = triggerDiv.querySelector('select');
                if (select && select.value === triggerSequence.triggerOption) {
                  saveTriggerSequenceOrder(actionsList, triggerSequence);
                }
              }
            });
          });
        }
      });
    }
    // Trigger autosave before closing
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    document.body.removeChild(modal);
  };
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
  // Function to update all conditional prefill dropdowns when range changes
  const updateConditionalPrefillDropdowns = () => {
    const rangeStart = cell._twoNumbers?.first ? parseInt(cell._twoNumbers.first) : 1;
    const rangeEnd = cell._twoNumbers?.second ? parseInt(cell._twoNumbers.second) : 1;
    // Find all conditional prefill trigger selects in the modal
    const allTriggerSelects = modalContent.querySelectorAll('[data-conditional-prefill-trigger]');
    allTriggerSelects.forEach(select => {
      const currentValue = select.value;
      // Clear existing options
      select.innerHTML = '';
      // Populate with new range
      for (let i = rangeStart; i <= rangeEnd; i++) {
        const optionEl = document.createElement('option');
        optionEl.value = i.toString();
        optionEl.textContent = i.toString();
        select.appendChild(optionEl);
      }
      // Restore previous value if it's still valid
      if (currentValue && parseInt(currentValue) >= rangeStart && parseInt(currentValue) <= rangeEnd) {
        select.value = currentValue;
      }
    });
  };
  // Number Range Section
  const rangeSection = createFieldSection('Number Range', [
    createNumberField('From', cell._twoNumbers?.first || '0', (value) => {
      if (!cell._twoNumbers) cell._twoNumbers = { first: '0', second: '0' };
      cell._twoNumbers.first = value;
      updateConditionalPrefillDropdowns();
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    }),
    createNumberField('To', cell._twoNumbers?.second || '0', (value) => {
      if (!cell._twoNumbers) cell._twoNumbers = { first: '0', second: '0' };
      cell._twoNumbers.second = value;
      updateConditionalPrefillDropdowns();
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
      window.updatemultipleDropdownTypeCell(cell);
    } else {
    }
    // Verify the cell data is properly stored
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
  // Auto-focus and select the question text input
  setTimeout(() => {
    const questionInput = modal.querySelector('input[type="text"]');
    if (questionInput) {
      questionInput.focus();
      questionInput.select();
    }
  }, 100);
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
// Helper function to ensure _itemOrder is initialized with all existing items
function ensureItemOrderInitialized(cell) {
  if (!cell._itemOrder || cell._itemOrder.length === 0) {
    cell._itemOrder = [];
    const options = cell._textboxes || [];
    const checkboxes = cell._checkboxes || [];
    const times = cell._times || [];
    const dropdowns = cell._dropdowns || [];
    // Add all existing options
    options.forEach((_, index) => {
      cell._itemOrder.push({ type: 'option', index: index });
    });
    // Add all existing checkboxes
    checkboxes.forEach((_, index) => {
      cell._itemOrder.push({ type: 'checkbox', index: index });
    });
    // Add all existing times
    times.forEach((_, index) => {
      cell._itemOrder.push({ type: 'time', index: index });
    });
    // Add all existing dropdowns
    dropdowns.forEach((_, index) => {
      cell._itemOrder.push({ type: 'dropdown', index: index });
    });
    // Add location if it exists
    if (cell._locationIndex !== undefined && cell._locationIndex >= 0) {
      cell._itemOrder.push({ type: 'location', index: cell._locationIndex });
    }
  }
  return cell._itemOrder;
}
// Helper function to validate indices before reordering
function validateReorderIndices(cell, draggedType, draggedIndex, dropType, dropIndex) {
  // Ensure item order exists
  ensureItemOrderInitialized(cell);
  // Validate dragged item exists
  const draggedItem = cell._itemOrder.find(item => 
    item.type === draggedType && item.index === draggedIndex
  );
  if (!draggedItem) {
    return false;
  }
  // Validate drop target exists
  const dropItem = cell._itemOrder.find(item => 
    item.type === dropType && item.index === dropIndex
  );
  if (!dropItem) {
    return false;
  }
  // Don't allow reordering item onto itself
  if (draggedType === dropType && draggedIndex === dropIndex) {
    return false;
  }
  return true;
}
// Helper function to create options container
function createOptionsContainer(cell) {
  const container = document.createElement('div');
  container.className = 'unified-fields-container';
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
    if (draggedType === 'location' && dropType === 'location') {
      // Can't drop location on location
      return;
    }
    if (draggedType === 'option' && dropType === 'option') {
      // Reorder options using unified item order
      ensureItemOrderInitialized(cell);
      if (!validateReorderIndices(cell, draggedType, draggedIndex, dropType, dropIndex)) {
        return;
      }
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
    } else if (draggedType === 'checkbox' && dropType === 'checkbox') {
      // Reorder checkboxes using unified item order
      ensureItemOrderInitialized(cell);
      if (!validateReorderIndices(cell, draggedType, draggedIndex, dropType, dropIndex)) {
        return;
      }
      // Find the dragged checkbox in the item order
      const draggedCheckboxIndex = cell._itemOrder.findIndex(item => 
        item.type === 'checkbox' && item.index === draggedIndex
      );
      // Find the target checkbox in the item order
      const targetCheckboxIndex = cell._itemOrder.findIndex(item => 
        item.type === 'checkbox' && item.index === dropIndex
      );
      if (draggedCheckboxIndex !== -1 && targetCheckboxIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedCheckboxIndex, 1)[0];
        cell._itemOrder.splice(targetCheckboxIndex, 0, draggedItem);
        // Update checkbox indices in item order to match their new positions
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'checkbox') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'checkbox'
            ).length - 1;
          }
        });
      }
    } else if (draggedType === 'checkbox' && dropType === 'option') {
      // Move checkbox to position of option using unified ordering
      ensureItemOrderInitialized(cell);
      if (!validateReorderIndices(cell, draggedType, draggedIndex, dropType, dropIndex)) {
        return;
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
    } else if (draggedType === 'location' && dropType === 'option') {
      // Move location to position of option using unified item order
      ensureItemOrderInitialized(cell);
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
    } else if (draggedType === 'option' && dropType === 'location') {
      // Move option to position of location using unified item order
      ensureItemOrderInitialized(cell);
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
    } else if (draggedType === 'dropdown' && dropType === 'option') {
      // Move dropdown to position of option using unified item order
      ensureItemOrderInitialized(cell);
      if (!validateReorderIndices(cell, draggedType, draggedIndex, dropType, dropIndex)) {
        return;
      }
      // Find the dragged dropdown in the item order
      const draggedDropdownIndex = cell._itemOrder.findIndex(item => 
        item.type === 'dropdown' && item.index === draggedIndex
      );
      // Find the target option in the item order
      const targetOptionIndex = cell._itemOrder.findIndex(item => 
        item.type === 'option' && item.index === dropIndex
      );
      if (draggedDropdownIndex !== -1 && targetOptionIndex !== -1) {
        // Remove the dropdown from its current position
        const draggedDropdown = cell._itemOrder.splice(draggedDropdownIndex, 1)[0];
        // Insert it at the target position
        cell._itemOrder.splice(targetOptionIndex, 0, draggedDropdown);
      }
    } else if (draggedType === 'dropdown' && dropType === 'dropdown') {
      // Reorder dropdowns using unified item order
      ensureItemOrderInitialized(cell);
      if (!validateReorderIndices(cell, draggedType, draggedIndex, dropType, dropIndex)) {
        return;
      }
      // Find the dragged dropdown in the item order
      const draggedDropdownIndex = cell._itemOrder.findIndex(item => 
        item.type === 'dropdown' && item.index === draggedIndex
      );
      // Find the target dropdown in the item order
      const targetDropdownIndex = cell._itemOrder.findIndex(item => 
        item.type === 'dropdown' && item.index === dropIndex
      );
      if (draggedDropdownIndex !== -1 && targetDropdownIndex !== -1) {
        // Remove the dropdown from its current position
        const draggedDropdown = cell._itemOrder.splice(draggedDropdownIndex, 1)[0];
        // Insert it at the target position
        cell._itemOrder.splice(targetDropdownIndex, 0, draggedDropdown);
        // Update the dropdown indices to match their new positions
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'dropdown') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'dropdown'
            ).length - 1;
          }
        });
      }
    } else if (draggedType === 'dropdown' && dropType === 'location') {
      // Move dropdown to position of location using unified item order
      ensureItemOrderInitialized(cell);
      // Find the dragged dropdown in the item order
      const draggedDropdownIndex = cell._itemOrder.findIndex(item => 
        item.type === 'dropdown' && item.index === draggedIndex
      );
      // Find the location in the item order
      const locationIndex = cell._itemOrder.findIndex(item => 
        item.type === 'location'
      );
      if (draggedDropdownIndex !== -1 && locationIndex !== -1) {
        // Remove the dropdown from its current position
        const draggedDropdown = cell._itemOrder.splice(draggedDropdownIndex, 1)[0];
        // Insert it at the location position
        cell._itemOrder.splice(locationIndex, 0, draggedDropdown);
      }
    } else if (draggedType === 'option' && dropType === 'dropdown') {
      // Move option to position of dropdown using unified item order
      ensureItemOrderInitialized(cell);
      if (!validateReorderIndices(cell, draggedType, draggedIndex, dropType, dropIndex)) {
        return;
      }
      // Find the dragged option in the item order
      const draggedOptionIndex = cell._itemOrder.findIndex(item => 
        item.type === 'option' && item.index === draggedIndex
      );
      // Find the target dropdown in the item order
      const targetDropdownIndex = cell._itemOrder.findIndex(item => 
        item.type === 'dropdown' && item.index === dropIndex
      );
      if (draggedOptionIndex !== -1 && targetDropdownIndex !== -1) {
        // Remove the option from its current position
        const draggedOption = cell._itemOrder.splice(draggedOptionIndex, 1)[0];
        // Insert it at the target position
        cell._itemOrder.splice(targetDropdownIndex, 0, draggedOption);
        // Update the option indices to match their new positions
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'option') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'option'
            ).length - 1;
          }
        });
      }
    } else if (draggedType === 'location' && dropType === 'dropdown') {
      // Move location to position of dropdown using unified item order
      ensureItemOrderInitialized(cell);
      // Find the dragged location in the item order
      const draggedLocationIndex = cell._itemOrder.findIndex(item => 
        item.type === 'location'
      );
      // Find the target dropdown in the item order
      const targetDropdownIndex = cell._itemOrder.findIndex(item => 
        item.type === 'dropdown' && item.index === dropIndex
      );
      if (draggedLocationIndex !== -1 && targetDropdownIndex !== -1) {
        // Remove the location from its current position
        const draggedLocation = cell._itemOrder.splice(draggedLocationIndex, 1)[0];
        // Insert it at the target position
        cell._itemOrder.splice(targetDropdownIndex, 0, draggedLocation);
        // Update the location index to match its new position
        const newLocationIndex = cell._itemOrder.findIndex(item => 
          item.type === 'location'
        );
        cell._locationIndex = newLocationIndex;
      }
    } else if (draggedType === 'time' && dropType === 'time') {
      // Reorder times using unified item order
      ensureItemOrderInitialized(cell);
      if (!validateReorderIndices(cell, draggedType, draggedIndex, dropType, dropIndex)) {
        return;
      }
      // Find the dragged time in the item order
      const draggedTimeIndex = cell._itemOrder.findIndex(item => 
        item.type === 'time' && item.index === draggedIndex
      );
      // Find the target time in the item order
      const targetTimeIndex = cell._itemOrder.findIndex(item => 
        item.type === 'time' && item.index === dropIndex
      );
      if (draggedTimeIndex !== -1 && targetTimeIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedTimeIndex, 1)[0];
        cell._itemOrder.splice(targetTimeIndex, 0, draggedItem);
        // Update time indices in item order to match their new positions
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'time') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'time'
            ).length - 1;
          }
        });
      }
    } else if (draggedType === 'time' && (dropType === 'checkbox' || dropType === 'option' || dropType === 'dropdown' || dropType === 'location')) {
      // Move time to position of another field type
      ensureItemOrderInitialized(cell);
      // Find the dragged time in the item order
      const draggedItemIndex = cell._itemOrder.findIndex(item => 
        item.type === 'time' && item.index === draggedIndex
      );
      // Find the target item in the item order
      let targetItemIndex = -1;
      if (dropType === 'location') {
        targetItemIndex = cell._itemOrder.findIndex(item => item.type === 'location');
      } else {
        targetItemIndex = cell._itemOrder.findIndex(item => 
          item.type === dropType && item.index === dropIndex
        );
      }
      if (draggedItemIndex !== -1 && targetItemIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedItemIndex, 1)[0];
        cell._itemOrder.splice(targetItemIndex, 0, draggedItem);
        // Update time indices in item order to match their new positions
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'time') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'time'
            ).length - 1;
          }
        });
      }
    } else if (draggedType === 'checkbox' && (dropType === 'time' || dropType === 'dropdown' || dropType === 'location')) {
      // Move checkbox to position of time/dropdown/location (checkbox-to-option is already handled above)
      ensureItemOrderInitialized(cell);
      // Find the dragged checkbox in the item order
      const draggedItemIndex = cell._itemOrder.findIndex(item => 
        item.type === 'checkbox' && item.index === draggedIndex
      );
      // Find the target item in the item order
      let targetItemIndex = -1;
      if (dropType === 'location') {
        targetItemIndex = cell._itemOrder.findIndex(item => item.type === 'location');
      } else {
        targetItemIndex = cell._itemOrder.findIndex(item => 
          item.type === dropType && item.index === dropIndex
        );
      }
      if (draggedItemIndex !== -1 && targetItemIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedItemIndex, 1)[0];
        cell._itemOrder.splice(targetItemIndex, 0, draggedItem);
        // Update checkbox indices in item order to match their new positions
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'checkbox') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'checkbox'
            ).length - 1;
          }
        });
      }
    }
    // Clean up visual feedback
    container.querySelectorAll('[data-index]').forEach(element => {
      element.style.borderColor = '#ddd';
      element.style.borderWidth = '1px';
    });
    // Refresh the entire container
    const newContainer = createOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  });
  // Add existing options, checkboxes, times, and location indicator in correct order
  const options = cell._textboxes || [];
  const checkboxes = cell._checkboxes || [];
  const times = cell._times || [];
  const locationIndex = cell._locationIndex !== undefined ? cell._locationIndex : -1;
  // Use unified item order if it exists, otherwise use default order
  if (cell._itemOrder && cell._itemOrder.length > 0) {
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
        } else if (item.type === 'location' && cell._locationIndex >= 0) {
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
        });
        locationIndicator.addEventListener('dragend', (e) => {
          locationIndicator.style.opacity = '1';
          draggedElement = null;
        });
        container.appendChild(locationIndicator);
        } else if (item.type === 'dropdown' && cell._dropdowns && cell._dropdowns[item.index]) {
          const unifiedDropdownEntry = createUnifiedDropdownEntry(cell._dropdowns[item.index], item.index, cell);
          // Add drag event listeners
          unifiedDropdownEntry.addEventListener('dragstart', (e) => {
            draggedElement = unifiedDropdownEntry;
            e.dataTransfer.effectAllowed = 'move';
            unifiedDropdownEntry.style.opacity = '0.5';
          });
          unifiedDropdownEntry.addEventListener('dragend', (e) => {
            unifiedDropdownEntry.style.opacity = '1';
            draggedElement = null;
          });
          container.appendChild(unifiedDropdownEntry);
        }
    });
  } else {
    // Fallback to default order (options first, then checkboxes, then location)
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
    const newOption = { nameId: '', placeholder: 'Enter value', isAmountOption: false, prefill: '', conditionalPrefills: [] };
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
    // Create new checkbox entry
    const newCheckbox = { fieldName: '', options: [], selectionType: 'multiple' };
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
        // Add the option
        cell._itemOrder.push({ type: 'option', index: index });
      });
      // Add location indicator if it exists (at the end, not before a specific option)
      if (locationIndex >= 0) {
        cell._itemOrder.push({ type: 'location', index: locationIndex });
      }
      // Add any existing checkboxes at the end (they weren't in the original display)
      const existingCheckboxes = cell._checkboxes.slice(0, -1); // Exclude the one we just added
      existingCheckboxes.forEach((_, index) => {
        cell._itemOrder.push({ type: 'checkbox', index: index });
      });
    }
    // Add the new checkbox to the end of the item order
    cell._itemOrder.push({ type: 'checkbox', index: cell._checkboxes.length - 1 });
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        // Debug: Log the cell properties before saving
        // Explicitly set the cell properties
        graph.getModel().setValue(cell, cell.value);
        // Also ensure the properties are marked as changed
        cell._checkboxes = cell._checkboxes; // Force property update
        // Debug: Log the cell properties after saving
      } finally {
        graph.getModel().endUpdate();
      }
    }
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    // Refresh the canvas display to show the checkbox
    if (typeof window.updatemultipleDropdownTypeCell === 'function') {
      window.updatemultipleDropdownTypeCell(cell);
    }
    // Refresh the entire container to show the new checkbox entry
    const newContainer = createOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
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
    // Only add if location doesn't already exist
    if (cell._locationIndex === undefined || cell._locationIndex < 0) {
      cell._locationIndex = (cell._textboxes || []).length;
      // Initialize item order if it doesn't exist
      if (!cell._itemOrder) {
        cell._itemOrder = [];
        const options = cell._textboxes || [];
        const checkboxes = cell._checkboxes || [];
        const times = cell._times || [];
        const dropdowns = cell._dropdowns || [];
        // Add all existing options
        options.forEach((_, index) => {
          cell._itemOrder.push({ type: 'option', index: index });
        });
        // Add all existing checkboxes
        checkboxes.forEach((_, index) => {
          cell._itemOrder.push({ type: 'checkbox', index: index });
        });
        // Add all existing times
        times.forEach((_, index) => {
          cell._itemOrder.push({ type: 'time', index: index });
        });
        // Add all existing dropdowns
        dropdowns.forEach((_, index) => {
          cell._itemOrder.push({ type: 'dropdown', index: index });
        });
      }
      // Add location to the end of the item order
      cell._itemOrder.push({ type: 'location', index: cell._locationIndex });
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
      // Refresh the entire container to show the location indicator
      const newContainer = createOptionsContainer(cell);
      container.parentNode.replaceChild(newContainer, container);
    }
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
    // Prevent multiple rapid clicks
    if (addTimeBtn.disabled) {
      return;
    }
    // Disable button to prevent multiple clicks
    addTimeBtn.disabled = true;
    addTimeBtn.textContent = 'Adding...';
    // Create new time entry
    const newTime = { timeText: '', timeId: '' };
    if (!cell._times) cell._times = [];
    cell._times.push(newTime);
    // Initialize item order if it doesn't exist, preserving current visual order
    if (!cell._itemOrder) {
      cell._itemOrder = [];
      const options = cell._textboxes || [];
      const locationIndex = cell._locationIndex;
      // Build the order to match the current visual display
      // First, add all options in order
      options.forEach((option, index) => {
        cell._itemOrder.push({ type: 'option', index: index });
      });
      // Then add location indicator if it exists (at the end, not before a specific option)
      if (locationIndex >= 0) {
        cell._itemOrder.push({ type: 'location', index: locationIndex });
      }
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
      window.updatemultipleDropdownTypeCell(cell);
    }
    // Refresh the entire container to show the new time entry
    const newContainer = createOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    // Re-enable button after a short delay
    setTimeout(() => {
      addTimeBtn.disabled = false;
      addTimeBtn.textContent = '+ Add Time';
    }, 500);
  };
  container.appendChild(addTimeBtn);
  // Add Dropdown button
  const addDropdownBtn = document.createElement('button');
  addDropdownBtn.textContent = '+ Add Dropdown';
  addDropdownBtn.style.cssText = `
    background: #9c27b0;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-top: 5px;
  `;
  addDropdownBtn.onclick = () => {
    // Initialize dropdowns array if it doesn't exist
    if (!cell._dropdowns) {
      cell._dropdowns = [];
    }
    // Create new dropdown entry
    const newDropdown = {
      id: 'dropdown_' + Date.now(),
      name: 'New Dropdown',
      options: [],
      triggerSequences: []
    };
    cell._dropdowns.push(newDropdown);
    // Add to item order
    if (!cell._itemOrder) {
      cell._itemOrder = [];
      // Initialize item order with existing entries if it's empty
      const options = cell._textboxes || [];
      const checkboxes = cell._checkboxes || [];
      const times = cell._times || [];
      // Add all existing options
      options.forEach((_, index) => {
        cell._itemOrder.push({ type: 'option', index: index });
      });
      // Add all existing checkboxes
      checkboxes.forEach((_, index) => {
        cell._itemOrder.push({ type: 'checkbox', index: index });
      });
      // Add all existing times
      times.forEach((_, index) => {
        cell._itemOrder.push({ type: 'time', index: index });
      });
      // Add location if it exists
      if (cell._locationIndex >= 0) {
        cell._itemOrder.push({ type: 'location', index: cell._locationIndex });
      }
    }
    cell._itemOrder.push({
      type: 'dropdown',
      index: cell._dropdowns.length - 1
    });
      // Refresh the display to show the new dropdown in the correct position
      const mainContainer = document.querySelector('.unified-fields-container');
      if (mainContainer) {
        // Clear the container
        mainContainer.innerHTML = '';
        // Re-render all entries in the correct order
        if (cell._itemOrder && cell._itemOrder.length > 0) {
          const options = cell._textboxes || [];
          const checkboxes = cell._checkboxes || [];
          const times = cell._times || [];
          cell._itemOrder.forEach((item, displayIndex) => {
            if (item.type === 'option' && options[item.index]) {
              const optionContainer = createOptionField(options[item.index], item.index, cell, mainContainer);
              mainContainer.appendChild(optionContainer);
            } else if (item.type === 'checkbox' && checkboxes[item.index]) {
              const checkboxContainer = createCheckboxField(checkboxes[item.index], item.index, cell, mainContainer);
              mainContainer.appendChild(checkboxContainer);
            } else if (item.type === 'time' && times[item.index]) {
              const timeContainer = createTimeField(times[item.index], item.index, cell, mainContainer);
              mainContainer.appendChild(timeContainer);
            } else if (item.type === 'location' && cell._locationIndex >= 0) {
              const locationIndicator = createLocationIndicator(cell, mainContainer);
              mainContainer.appendChild(locationIndicator);
            } else if (item.type === 'dropdown' && cell._dropdowns && cell._dropdowns[item.index]) {
              const unifiedDropdownEntry = createUnifiedDropdownEntry(cell._dropdowns[item.index], item.index, cell);
              mainContainer.appendChild(unifiedDropdownEntry);
            }
          });
        }
      }
    // Trigger autosave
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  container.appendChild(addDropdownBtn);
  return container;
}
// Helper function to create dropdown field
function createDropdownField(dropdown, index, cell, parentContainer) {
  const dropdownContainer = document.createElement('div');
  dropdownContainer.style.cssText = `
    margin: 8px 0;
    padding: 15px;
    background: #f8f9fa;
    border: 2px solid #9c27b0;
    border-radius: 8px;
    position: relative;
  `;
  dropdownContainer.draggable = true;
  dropdownContainer.dataset.index = index;
  dropdownContainer.dataset.type = 'dropdown';
  dropdownContainer.dataset.dropdownIndex = index;
  // Drag handle
  const dragHandle = document.createElement('div');
  dragHandle.textContent = '⋮⋮';
  dragHandle.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    cursor: move;
    color: #666;
    font-size: 14px;
    user-select: none;
    padding: 2px;
  `;
  dropdownContainer.appendChild(dragHandle);
  // Dropdown name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = dropdown.name || 'New Dropdown';
  nameInput.placeholder = 'Dropdown Name';
  nameInput.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    margin-bottom: 10px;
  `;
  nameInput.onblur = () => {
    dropdown.name = nameInput.value;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  dropdownContainer.appendChild(nameInput);
  // Add Options Section
  const optionsSection = document.createElement('div');
  optionsSection.style.cssText = `
    margin-bottom: 15px;
    padding: 10px;
    background: #e3f2fd;
    border-radius: 6px;
  `;
  const optionsTitle = document.createElement('h4');
  optionsTitle.textContent = 'Add Options';
  optionsTitle.style.cssText = `
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #1976d2;
  `;
  optionsSection.appendChild(optionsTitle);
  const addOptionBtn = document.createElement('button');
  addOptionBtn.textContent = '+ Add Option';
  addOptionBtn.style.cssText = `
    background: #1976d2;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  addOptionBtn.onclick = () => {
    // Create new option with blank text
    const newOption = {
      id: 'option_' + Date.now(),
      text: '',
      value: ''
    };
    dropdown.options.push(newOption);
    // Update the options list for this specific dropdown
    const dropdownContainer = document.querySelector(`[data-dropdown-index="${index}"]`);
    if (dropdownContainer) {
      const optionsList = dropdownContainer.querySelector('.options-list');
      if (optionsList) {
        // Add the new option to the list with an input field
        const optionDiv = document.createElement('div');
        optionDiv.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 4px;
        `;
        const optionInput = document.createElement('input');
        optionInput.type = 'text';
        optionInput.placeholder = 'Enter option text...';
        optionInput.style.cssText = `
          flex: 1;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
        `;
        optionInput.onblur = () => {
          newOption.text = optionInput.value.trim();
          newOption.value = optionInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        const deleteOptionBtn = document.createElement('button');
        deleteOptionBtn.textContent = '×';
        deleteOptionBtn.style.cssText = `
          background: #f44336;
          color: white;
          border: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
        `;
        deleteOptionBtn.onclick = () => {
          const optionIndex = dropdown.options.findIndex(opt => opt.id === newOption.id);
          if (optionIndex !== -1) {
            dropdown.options.splice(optionIndex, 1);
          }
          optionDiv.remove();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        optionDiv.appendChild(optionInput);
        optionDiv.appendChild(deleteOptionBtn);
        optionsList.appendChild(optionDiv);
        optionInput.focus(); // Focus the input for immediate typing
      }
    }
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  optionsSection.appendChild(addOptionBtn);
  // Display existing options
  const optionsList = document.createElement('div');
  optionsList.className = 'options-list';
  optionsList.style.cssText = `
    margin-top: 10px;
  `;
  dropdown.options.forEach((option, optionIndex) => {
    const optionDiv = document.createElement('div');
    optionDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 4px;
    `;
    const optionInput = document.createElement('input');
    optionInput.type = 'text';
    optionInput.value = option.text;
    optionInput.placeholder = 'Enter option text...';
    optionInput.style.cssText = `
      flex: 1;
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 12px;
    `;
    optionInput.onblur = () => {
      option.text = optionInput.value.trim();
      option.value = optionInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    // Add Copy ID button for this option
    const copyIdBtn = document.createElement('button');
    copyIdBtn.textContent = 'Copy ID';
    copyIdBtn.style.cssText = `
      background: #17a2b8;
      color: white;
      border: none;
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      margin-right: 4px;
    `;
    copyIdBtn.onclick = () => {
      const number = prompt('Enter number for this option:', '1');
      if (number !== null && number.trim() !== '') {
        const nodeId = `${dropdown.name || 'dropdown'}_${number}_${option.value}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(nodeId).then(() => {
            // Show visual feedback
            copyIdBtn.textContent = 'Copied!';
            copyIdBtn.style.background = '#28a745';
            setTimeout(() => {
              copyIdBtn.textContent = 'Copy ID';
              copyIdBtn.style.background = '#17a2b8';
            }, 1500);
          }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = nodeId;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            copyIdBtn.textContent = 'Copied!';
            copyIdBtn.style.background = '#28a745';
            setTimeout(() => {
              copyIdBtn.textContent = 'Copy ID';
              copyIdBtn.style.background = '#17a2b8';
            }, 1500);
          });
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = nodeId;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          copyIdBtn.textContent = 'Copied!';
          copyIdBtn.style.background = '#28a745';
          setTimeout(() => {
            copyIdBtn.textContent = 'Copy ID';
            copyIdBtn.style.background = '#17a2b8';
          }, 1500);
        }
      }
    };
    const deleteOptionBtn = document.createElement('button');
    deleteOptionBtn.textContent = '×';
    deleteOptionBtn.style.cssText = `
      background: #f44336;
      color: white;
      border: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 12px;
    `;
    deleteOptionBtn.onclick = () => {
      dropdown.options.splice(optionIndex, 1);
      // Remove the option div from the DOM
      optionDiv.remove();
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    optionDiv.appendChild(optionInput);
    optionDiv.appendChild(copyIdBtn);
    optionDiv.appendChild(deleteOptionBtn);
    optionsList.appendChild(optionDiv);
  });
  optionsSection.appendChild(optionsList);
  dropdownContainer.appendChild(optionsSection);
  // Conditional Logic Section
  const conditionalSection = document.createElement('div');
  conditionalSection.style.cssText = `
    margin-bottom: 15px;
    padding: 10px;
    background: #fff3e0;
    border-radius: 6px;
  `;
  const conditionalTitle = document.createElement('h4');
  conditionalTitle.textContent = 'Conditional Logic';
  conditionalTitle.style.cssText = `
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #f57c00;
  `;
  conditionalSection.appendChild(conditionalTitle);
  const addTriggerBtn = document.createElement('button');
  addTriggerBtn.textContent = '+ Add Trigger';
  addTriggerBtn.style.cssText = `
    background: #f57c00;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  addTriggerBtn.onclick = () => {
    const triggerSequence = {
      id: 'trigger_' + Date.now(),
      triggerOption: '',
      actions: []
    };
    dropdown.triggerSequences.push(triggerSequence);
    // Update the trigger sequences list for this specific dropdown
    const dropdownContainer = document.querySelector(`[data-dropdown-index="${index}"]`);
    if (dropdownContainer) {
      const triggerSequencesList = dropdownContainer.querySelector('.trigger-sequences-list');
      if (triggerSequencesList) {
        // Add the new trigger sequence to the list
        const triggerDiv = document.createElement('div');
        triggerDiv.className = 'trigger-sequence';
        triggerDiv.style.cssText = `
          margin-bottom: 10px;
          padding: 10px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 6px;
        `;
        // Create trigger dropdown
        const triggerLabel = document.createElement('label');
        triggerLabel.textContent = 'When option is selected:';
        triggerLabel.style.cssText = `
          display: block;
          font-size: 12px;
          margin-bottom: 5px;
          color: #666;
        `;
        triggerDiv.appendChild(triggerLabel);
        const triggerSelect = document.createElement('select');
        triggerSelect.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          margin-bottom: 10px;
        `;
        // Function to update options in the dropdown
        const updateTriggerOptions = () => {
          // Clear existing options
          triggerSelect.innerHTML = '';
          const defaultOption = document.createElement('option');
          defaultOption.value = '';
          defaultOption.textContent = 'Select an option...';
          triggerSelect.appendChild(defaultOption);
          dropdown.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            triggerSelect.appendChild(optionElement);
          });
        };
        // Initial population
        updateTriggerOptions();
        // Update options when dropdown is clicked/focused
        triggerSelect.onfocus = updateTriggerOptions;
        triggerSelect.onchange = () => {
          triggerSequence.triggerOption = triggerSelect.value;
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        triggerDiv.appendChild(triggerSelect);
        // Add delete trigger button
        const deleteTriggerBtn = document.createElement('button');
        deleteTriggerBtn.textContent = 'Delete Trigger';
        deleteTriggerBtn.style.cssText = `
          background: #f44336;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          margin-bottom: 10px;
        `;
        deleteTriggerBtn.onclick = () => {
          // Ensure dropdown.triggerSequences exists
          if (!dropdown.triggerSequences) {
            dropdown.triggerSequences = [];
            return;
          }
          const triggerIndex = dropdown.triggerSequences.findIndex(trigger => trigger.id === triggerSequence.id);
          if (triggerIndex !== -1) {
            dropdown.triggerSequences.splice(triggerIndex, 1);
          }
          triggerDiv.remove();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        triggerDiv.appendChild(deleteTriggerBtn);
        // Add action buttons section
        const actionButtons = document.createElement('div');
        actionButtons.style.cssText = `
          display: flex;
          gap: 8px;
          margin-top: 10px;
          flex-wrap: wrap;
        `;
        const addLabelBtn = document.createElement('button');
        addLabelBtn.textContent = 'Add Label';
        addLabelBtn.style.cssText = `
          background: #4caf50;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        addLabelBtn.onclick = () => {
          // Ensure dropdown.triggerSequences exists
          if (!dropdown.triggerSequences) {
            dropdown.triggerSequences = [];
          }
          // Create new label entry like the main button
          const newLabel = { fieldName: '', nodeId: '' };
          if (!triggerSequence.labels) triggerSequence.labels = [];
          triggerSequence.labels.push(newLabel);
          // Calculate triggerIndex by finding the index of this triggerSequence in the dropdown's triggerSequences array
          const triggerIndex = dropdown.triggerSequences.findIndex(trigger => trigger.id === triggerSequence.id);
          // Update the actions list for this trigger sequence
          const triggerDiv = addLabelBtn.closest('.trigger-sequence');
          if (triggerDiv) {
            const actionsList = triggerDiv.querySelector('.actions-list');
            if (actionsList) {
              // Create label entry container
              const labelContainer = document.createElement('div');
              labelContainer.draggable = true;
              labelContainer.dataset.type = 'label';
              labelContainer.dataset.triggerIndex = triggerIndex >= 0 ? triggerIndex : 0;
              labelContainer.style.cssText = `
                margin-bottom: 10px;
                padding: 8px;
                background: #e8f5e8;
                border: 1px solid #4caf50;
                border-radius: 4px;
                cursor: move;
                position: relative;
              `;
              // Add drag handle
              const dragHandle = document.createElement('div');
              dragHandle.innerHTML = '⋮⋮';
              dragHandle.style.cssText = `
                position: absolute;
                left: 4px;
                top: 50%;
                transform: translateY(-50%);
                cursor: move;
                color: #4caf50;
                font-size: 14px;
                user-select: none;
                padding: 2px;
              `;
              labelContainer.appendChild(dragHandle);
              // Create content container to hold all other elements
              const contentContainer = document.createElement('div');
              contentContainer.style.cssText = `
                margin-left: 24px;
              `;
              // Field name input
              const fieldNameInput = document.createElement('input');
              fieldNameInput.type = 'text';
              fieldNameInput.placeholder = 'Enter label field name...';
              fieldNameInput.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
              `;
              fieldNameInput.onblur = () => {
                newLabel.fieldName = fieldNameInput.value.trim();
                // Update the node ID when field name changes
                const updatedNodeId = generateNodeIdForDropdownField(newLabel.fieldName || '', dropdown.name || '', cell, triggerSequence.triggerOption || '');
                newLabel.nodeId = updatedNodeId;
                labelIdInput.value = updatedNodeId;
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Label ID input (uneditable and autofilled)
              // Auto-fix incorrect node IDs when creating new fields
              const correctLabelId = generateNodeIdForDropdownField(newLabel.fieldName || '', dropdown.name || '', cell, triggerSequence.triggerOption || '');
              const labelIdValue = (newLabel.nodeId && newLabel.nodeId === correctLabelId) ? newLabel.nodeId : correctLabelId;
              newLabel.nodeId = labelIdValue; // Set the nodeId in the data
              const labelIdInput = createUneditableNodeIdInput('Label ID...', labelIdValue, (input) => {
                // Double-click to copy functionality
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(input.value).then(() => {
                    // Show visual feedback
                    const originalBg = input.style.backgroundColor;
                    input.style.backgroundColor = '#d4edda';
                    input.style.borderColor = '#28a745';
                    setTimeout(() => {
                      input.style.backgroundColor = originalBg;
                      input.style.borderColor = '#ddd';
                    }, 1000);
                  });
                } else {
                  // Fallback for older browsers
                  input.select();
                  document.execCommand('copy');
                  const originalBg = input.style.backgroundColor;
                  input.style.backgroundColor = '#d4edda';
                  input.style.borderColor = '#28a745';
                  setTimeout(() => {
                    input.style.backgroundColor = originalBg;
                    input.style.borderColor = '#ddd';
                  }, 1000);
                }
              });
              labelIdInput.style.marginBottom = '8px';
              // Delete label button
              const deleteLabelBtn = document.createElement('button');
              deleteLabelBtn.textContent = 'Delete Label';
              deleteLabelBtn.style.cssText = `
                background: #f44336;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
              `;
              deleteLabelBtn.onclick = () => {
                const labelIndex = triggerSequence.labels.findIndex(l => l === newLabel);
                if (labelIndex !== -1) {
                  triggerSequence.labels.splice(labelIndex, 1);
                }
                labelContainer.remove();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              contentContainer.appendChild(fieldNameInput);
              contentContainer.appendChild(labelIdInput);
              contentContainer.appendChild(deleteLabelBtn);
              // Copy ID button for label (positioned after delete button)
              const copyLabelIdBtn = document.createElement('button');
              copyLabelIdBtn.textContent = 'Copy ID';
              copyLabelIdBtn.style.cssText = `
                background: #17a2b8;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                margin-bottom: 8px;
                width: 100%;
              `;
              copyLabelIdBtn.onclick = () => {
                const number = prompt('Enter number:', '1');
                if (number !== null && number !== '') {
                  const nodeIdWithNumber = `${labelIdInput.value}_${number}`;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(nodeIdWithNumber).then(() => {
                      copyLabelIdBtn.textContent = 'Copied!';
                      copyLabelIdBtn.style.background = '#28a745';
                      setTimeout(() => {
                        copyLabelIdBtn.textContent = 'Copy ID';
                        copyLabelIdBtn.style.background = '#17a2b8';
                      }, 1500);
                    });
                  } else {
                    const textArea = document.createElement('textarea');
                    textArea.value = nodeIdWithNumber;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    copyLabelIdBtn.textContent = 'Copied!';
                    copyLabelIdBtn.style.background = '#28a745';
                    setTimeout(() => {
                      copyLabelIdBtn.textContent = 'Copy ID';
                      copyLabelIdBtn.style.background = '#17a2b8';
                    }, 1500);
                  }
                }
              };
              contentContainer.appendChild(copyLabelIdBtn);
              labelContainer.appendChild(contentContainer);
              // Add drag handlers
              labelContainer.addEventListener('dragstart', (e) => {
                labelContainer.classList.add('dragging');
                labelContainer.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', labelContainer.outerHTML);
                e.dataTransfer.setData('text/plain', JSON.stringify({
                  type: 'label',
                  triggerIndex: triggerIndex,
                  labelIndex: triggerSequence.labels.indexOf(newLabel)
                }));
              });
              labelContainer.addEventListener('dragend', (e) => {
                labelContainer.classList.remove('dragging');
                labelContainer.style.opacity = '1';
              });
              actionsList.appendChild(labelContainer);
              fieldNameInput.focus();
            }
          }
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        const addCheckboxBtn = document.createElement('button');
        addCheckboxBtn.textContent = 'Add Checkbox';
        addCheckboxBtn.style.cssText = `
          background: #9c27b0;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        addCheckboxBtn.onclick = () => {
          if (typeof window.getQuestionType === 'function') {
          }
          // Ensure dropdown.triggerSequences exists
          if (!dropdown.triggerSequences) {
            dropdown.triggerSequences = [];
          }
          // Create new checkbox entry like the main button
          const newCheckbox = { fieldName: '', options: [] };
          if (!triggerSequence.checkboxes) triggerSequence.checkboxes = [];
          triggerSequence.checkboxes.push(newCheckbox);
          // Calculate triggerIndex by finding the index of this triggerSequence in the dropdown's triggerSequences array
          const triggerIndex = dropdown.triggerSequences.findIndex(trigger => trigger.id === triggerSequence.id);
          // Update the actions list for this trigger sequence
          const triggerDiv = addCheckboxBtn.closest('.trigger-sequence');
          if (triggerDiv) {
            const actionsList = triggerDiv.querySelector('.actions-list');
            if (actionsList) {
              // Create checkbox entry container
              const checkboxContainer = document.createElement('div');
              checkboxContainer.draggable = true;
              checkboxContainer.dataset.type = 'checkbox';
              checkboxContainer.dataset.triggerIndex = triggerIndex >= 0 ? triggerIndex : 0;
              checkboxContainer.style.cssText = `
                margin-bottom: 10px;
                padding: 8px;
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                cursor: move;
                position: relative;
              `;
              // Add drag handle
              const dragHandle = document.createElement('div');
              dragHandle.innerHTML = '⋮⋮';
              dragHandle.style.cssText = `
                position: absolute;
                left: 4px;
                top: 50%;
                transform: translateY(-50%);
                cursor: move;
                color: #9c27b0;
                font-size: 14px;
                user-select: none;
                padding: 2px;
              `;
              checkboxContainer.appendChild(dragHandle);
              // Create content container
              const contentContainer = document.createElement('div');
              contentContainer.style.cssText = `
                margin-left: 24px;
              `;
              // Field name input
              const fieldNameInput = document.createElement('input');
              fieldNameInput.type = 'text';
              fieldNameInput.placeholder = 'Enter checkbox field name...';
              fieldNameInput.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
              `;
              // Update all checkbox option node IDs in real-time as user types field name
              const updateCheckboxFieldNameAndNodeIds = () => {
                newCheckbox.fieldName = fieldNameInput.value.trim();
                // Update all checkbox option node IDs when field name changes
                if (newCheckbox.options && newCheckbox.options.length > 0) {
                  newCheckbox.options.forEach((option, optionIndex) => {
                    const combinedFieldName = `${newCheckbox.fieldName}_${option.checkboxText || ''}`;
                    const updatedNodeId = generateNodeIdForDropdownField(combinedFieldName, dropdown.name || '', cell, triggerSequence.triggerOption || '');
                    option.nodeId = updatedNodeId;
                    // Update the checkbox ID input in the UI if it exists
                    const checkboxOptionEntry = checkboxContainer.querySelector(`[data-option-index="${optionIndex}"]`);
                    if (checkboxOptionEntry) {
                      const optionIdInput = checkboxOptionEntry.querySelector('input[placeholder*="Checkbox ID"]');
                      if (optionIdInput) {
                        optionIdInput.value = updatedNodeId;
                      }
                    }
                  });
                }
              };
              // Update on input (real-time as user types)
              fieldNameInput.oninput = updateCheckboxFieldNameAndNodeIds;
              // Also update on blur (for final save)
              fieldNameInput.onblur = () => {
                updateCheckboxFieldNameAndNodeIds();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Selection type dropdown
              const selectionTypeLabel = document.createElement('label');
              selectionTypeLabel.textContent = 'Selection Type:';
              selectionTypeLabel.style.cssText = `
                display: block;
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 4px;
                color: #333;
              `;
              const selectionTypeSelect = document.createElement('select');
              selectionTypeSelect.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
                background: white;
              `;
              const markAllOption = document.createElement('option');
              markAllOption.value = 'multiple';
              markAllOption.textContent = 'Mark All That Apply';
              markAllOption.selected = true;
              const markOneOption = document.createElement('option');
              markOneOption.value = 'single';
              markOneOption.textContent = 'Mark Only One';
              selectionTypeSelect.appendChild(markAllOption);
              selectionTypeSelect.appendChild(markOneOption);
              // Initialize selection type
              if (!newCheckbox.selectionType) {
                newCheckbox.selectionType = 'multiple';
              }
              selectionTypeSelect.value = newCheckbox.selectionType;
              selectionTypeSelect.onchange = () => {
                newCheckbox.selectionType = selectionTypeSelect.value;
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Required type dropdown
              const requiredTypeLabel = document.createElement('label');
              requiredTypeLabel.textContent = 'Required Type:';
              requiredTypeLabel.style.cssText = `
                display: block;
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 4px;
                color: #333;
              `;
              const requiredTypeSelect = document.createElement('select');
              requiredTypeSelect.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
                background: white;
              `;
              const requiredOption = document.createElement('option');
              requiredOption.value = 'required';
              requiredOption.textContent = 'Required';
              const optionalOption = document.createElement('option');
              optionalOption.value = 'optional';
              optionalOption.textContent = 'Optional';
              requiredTypeSelect.appendChild(requiredOption);
              requiredTypeSelect.appendChild(optionalOption);
              // Initialize required type
              if (!newCheckbox.required) {
                newCheckbox.required = 'required';
              }
              requiredTypeSelect.value = newCheckbox.required;
              requiredTypeSelect.onchange = () => {
                newCheckbox.required = requiredTypeSelect.value;
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
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                margin-bottom: 8px;
              `;
              addCheckboxOptionBtn.onclick = () => {
                const newOption = { checkboxText: '', nodeId: '' };
                if (!newCheckbox.options) newCheckbox.options = [];
                newCheckbox.options.push(newOption);
                // Create mini checkbox option entry
                const miniOptionEntry = document.createElement('div');
                const optionIndex = newCheckbox.options.length - 1; // Get the index of this option
                miniOptionEntry.dataset.optionIndex = optionIndex;
                miniOptionEntry.style.cssText = `
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 4px 8px;
                  background: white;
                  border: 1px solid #ddd;
                  border-radius: 3px;
                  margin-bottom: 4px;
                `;
                const checkboxTextInput = document.createElement('input');
                checkboxTextInput.type = 'text';
                checkboxTextInput.placeholder = 'Checkbox text...';
                checkboxTextInput.style.cssText = `
                  flex: 1;
                  padding: 2px 4px;
                  border: 1px solid #ddd;
                  border-radius: 2px;
                  font-size: 11px;
                `;
                // Update node ID in real-time as user types
                const updateCheckboxOptionNodeId = () => {
                  newOption.checkboxText = checkboxTextInput.value.trim();
                  // Update the node ID when checkbox text changes
                  const combinedFieldName = `${newCheckbox.fieldName}_${newOption.checkboxText || ''}`;
                  const updatedNodeId = generateNodeIdForDropdownField(combinedFieldName, dropdown.name || '', cell, triggerSequence.triggerOption || '');
                  newOption.nodeId = updatedNodeId;
                  checkboxIdInput.value = updatedNodeId;
                };
                // Update on input (real-time as user types)
                checkboxTextInput.oninput = updateCheckboxOptionNodeId;
                // Also update on blur (for final save)
                checkboxTextInput.onblur = () => {
                  updateCheckboxOptionNodeId();
                  if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                  }
                };
                // Checkbox ID input (uneditable and autofilled)
                // For checkbox options, we need to include both the field name and the option text
                const checkboxFieldName = newCheckbox.fieldName || '';
                const checkboxOptionText = newOption.checkboxText || '';
                const combinedFieldName = `${checkboxFieldName}_${checkboxOptionText}`;
                // Auto-fix incorrect node IDs when creating new fields
                const correctCheckboxId = generateNodeIdForDropdownField(combinedFieldName, dropdown.name || '', cell, triggerSequence.triggerOption || '');
                const checkboxIdValue = (newOption.nodeId && newOption.nodeId === correctCheckboxId) ? newOption.nodeId : correctCheckboxId;
                newOption.nodeId = checkboxIdValue; // Set the nodeId in the data
                const checkboxIdInput = createUneditableNodeIdInput('Checkbox ID...', checkboxIdValue, (input) => {
                  // Double-click to copy functionality
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(input.value).then(() => {
                      // Show visual feedback
                      const originalBg = input.style.backgroundColor;
                      input.style.backgroundColor = '#d4edda';
                      input.style.borderColor = '#28a745';
                      setTimeout(() => {
                        input.style.backgroundColor = originalBg;
                        input.style.borderColor = '#ddd';
                      }, 1000);
                    });
                  } else {
                    // Fallback for older browsers
                    input.select();
                    document.execCommand('copy');
                    const originalBg = input.style.backgroundColor;
                    input.style.backgroundColor = '#d4edda';
                    input.style.borderColor = '#28a745';
                    setTimeout(() => {
                      input.style.backgroundColor = originalBg;
                      input.style.borderColor = '#ddd';
                    }, 1000);
                  }
                });
                checkboxIdInput.style.cssText = `
                  flex: 1;
                  padding: 2px 4px;
                  border: 1px solid #ddd;
                  border-radius: 2px;
                  font-size: 11px;
                  background-color: #f8f9fa;
                  cursor: pointer;
                `;
                const deleteOptionBtn = document.createElement('button');
                deleteOptionBtn.textContent = '×';
                deleteOptionBtn.style.cssText = `
                  background: #f44336;
                  color: white;
                  border: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  cursor: pointer;
                  font-size: 10px;
                `;
                deleteOptionBtn.onclick = () => {
                  const optionIndex = newCheckbox.options.findIndex(opt => opt === newOption);
                  if (optionIndex !== -1) {
                    newCheckbox.options.splice(optionIndex, 1);
                  }
                  miniOptionEntry.remove();
                  if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                  }
                };
                // Copy ID button for checkbox option
                const copyCheckboxIdBtn = document.createElement('button');
                copyCheckboxIdBtn.textContent = 'Copy ID';
                copyCheckboxIdBtn.style.cssText = `
                  background: #17a2b8;
                  color: white;
                  border: none;
                  padding: 2px 4px;
                  border-radius: 2px;
                  cursor: pointer;
                  font-size: 10px;
                  margin-left: 4px;
                `;
                copyCheckboxIdBtn.onclick = () => {
                  const number = prompt('Enter number:', '1');
                  if (number !== null && number !== '') {
                    const nodeIdWithNumber = `${checkboxIdInput.value}_${number}`;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      navigator.clipboard.writeText(nodeIdWithNumber).then(() => {
                        copyCheckboxIdBtn.textContent = 'Copied!';
                        copyCheckboxIdBtn.style.background = '#28a745';
                        setTimeout(() => {
                          copyCheckboxIdBtn.textContent = 'Copy ID';
                          copyCheckboxIdBtn.style.background = '#17a2b8';
                        }, 1500);
                      });
                    } else {
                      const textArea = document.createElement('textarea');
                      textArea.value = nodeIdWithNumber;
                      document.body.appendChild(textArea);
                      textArea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textArea);
                      copyCheckboxIdBtn.textContent = 'Copied!';
                      copyCheckboxIdBtn.style.background = '#28a745';
                      setTimeout(() => {
                        copyCheckboxIdBtn.textContent = 'Copy ID';
                        copyCheckboxIdBtn.style.background = '#17a2b8';
                      }, 1500);
                    }
                  }
                };
                miniOptionEntry.appendChild(checkboxTextInput);
                miniOptionEntry.appendChild(checkboxIdInput);
                miniOptionEntry.appendChild(copyCheckboxIdBtn);
                miniOptionEntry.appendChild(deleteOptionBtn);
                // Insert the new option before the delete button in contentContainer
                // Find the delete button by searching for a button with "Delete Checkbox" text
                const allButtons = Array.from(contentContainer.querySelectorAll('button'));
                const deleteCheckboxBtn = allButtons.find(btn => btn.textContent.trim() === 'Delete Checkbox');
                if (deleteCheckboxBtn) {
                  contentContainer.insertBefore(miniOptionEntry, deleteCheckboxBtn);
                } else {
                  // Fallback: append to contentContainer if delete button not found yet
                  contentContainer.appendChild(miniOptionEntry);
                }
                checkboxTextInput.focus();
              };
              // Delete checkbox button
              const deleteCheckboxBtn = document.createElement('button');
              deleteCheckboxBtn.textContent = 'Delete Checkbox';
              deleteCheckboxBtn.style.cssText = `
                background: #f44336;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
              `;
              deleteCheckboxBtn.onclick = () => {
                const checkboxIndex = triggerSequence.checkboxes.findIndex(cb => cb === newCheckbox);
                if (checkboxIndex !== -1) {
                  triggerSequence.checkboxes.splice(checkboxIndex, 1);
                }
                checkboxContainer.remove();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              contentContainer.appendChild(fieldNameInput);
              contentContainer.appendChild(selectionTypeLabel);
              contentContainer.appendChild(selectionTypeSelect);
              contentContainer.appendChild(requiredTypeLabel);
              contentContainer.appendChild(requiredTypeSelect);
              contentContainer.appendChild(addCheckboxOptionBtn);
              contentContainer.appendChild(deleteCheckboxBtn);
              checkboxContainer.appendChild(contentContainer);
              // Add drag handlers
              checkboxContainer.addEventListener('dragstart', (e) => {
                checkboxContainer.classList.add('dragging');
                checkboxContainer.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
              });
              checkboxContainer.addEventListener('dragend', (e) => {
                checkboxContainer.classList.remove('dragging');
                checkboxContainer.style.opacity = '1';
              });
              actionsList.appendChild(checkboxContainer);
              fieldNameInput.focus();
            }
          }
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
          // Debug: Check cell state after checkbox addition
          if (typeof window.getQuestionType === 'function') {
          }
        };
        const addTimeBtn = document.createElement('button');
        addTimeBtn.textContent = 'Add Time';
        addTimeBtn.style.cssText = `
          background: #ff9800;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        addTimeBtn.onclick = () => {
          // Ensure dropdown.triggerSequences exists
          if (!dropdown.triggerSequences) {
            dropdown.triggerSequences = [];
          }
          // Create new time entry like the main button
          const newTime = { fieldName: '', nodeId: '' };
          if (!triggerSequence.times) triggerSequence.times = [];
          triggerSequence.times.push(newTime);
          // Calculate triggerIndex by finding the index of this triggerSequence in the dropdown's triggerSequences array
          const triggerIndex = dropdown.triggerSequences.findIndex(trigger => trigger.id === triggerSequence.id);
          // Update the actions list for this trigger sequence
          const triggerDiv = addTimeBtn.closest('.trigger-sequence');
          if (triggerDiv) {
            const actionsList = triggerDiv.querySelector('.actions-list');
            if (actionsList) {
              // Create time entry container
              const timeContainer = document.createElement('div');
              timeContainer.draggable = true;
              timeContainer.dataset.type = 'time';
              timeContainer.dataset.triggerIndex = triggerIndex >= 0 ? triggerIndex : 0;
              timeContainer.style.cssText = `
                margin-bottom: 10px;
                padding: 8px;
                background: #fff3e0;
                border: 1px solid #ffcc02;
                border-radius: 4px;
                cursor: move;
                position: relative;
              `;
              // Add drag handle
              const dragHandle = document.createElement('div');
              dragHandle.textContent = '⋮⋮';
              dragHandle.style.cssText = `
                position: absolute;
                left: 4px;
                top: 50%;
                transform: translateY(-50%);
                cursor: move;
                color: #ff9800;
                font-size: 14px;
                user-select: none;
                padding: 2px;
              `;
              timeContainer.appendChild(dragHandle);
              // Create content container
              const contentContainer = document.createElement('div');
              contentContainer.style.cssText = `
                margin-left: 24px;
              `;
              // Field name input
              const fieldNameInput = document.createElement('input');
              fieldNameInput.type = 'text';
              fieldNameInput.placeholder = 'Enter time field name...';
              fieldNameInput.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
              `;
              fieldNameInput.onblur = () => {
                newTime.fieldName = fieldNameInput.value.trim();
                // Update the node ID when field name changes
                const updatedNodeId = generateNodeIdForDropdownField(newTime.fieldName || '', dropdown.name || '', cell, triggerSequence.triggerOption || '');
                newTime.nodeId = updatedNodeId;
                timeIdInput.value = updatedNodeId;
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Time ID input (uneditable and autofilled)
              // Auto-fix incorrect node IDs when creating new fields
              const correctTimeId = generateNodeIdForDropdownField(newTime.fieldName || '', dropdown.name || '', cell, triggerSequence.triggerOption || '');
              const timeIdValue = (newTime.nodeId && newTime.nodeId === correctTimeId) ? newTime.nodeId : correctTimeId;
              newTime.nodeId = timeIdValue; // Set the nodeId in the data
              const timeIdInput = createUneditableNodeIdInput('Time ID...', timeIdValue, (input) => {
                // Double-click to copy functionality
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(input.value).then(() => {
                    // Show visual feedback
                    const originalBg = input.style.backgroundColor;
                    input.style.backgroundColor = '#d4edda';
                    input.style.borderColor = '#28a745';
                    setTimeout(() => {
                      input.style.backgroundColor = originalBg;
                      input.style.borderColor = '#ddd';
                    }, 1000);
                  });
                } else {
                  // Fallback for older browsers
                  input.select();
                  document.execCommand('copy');
                  const originalBg = input.style.backgroundColor;
                  input.style.backgroundColor = '#d4edda';
                  input.style.borderColor = '#28a745';
                  setTimeout(() => {
                    input.style.backgroundColor = originalBg;
                    input.style.borderColor = '#ddd';
                  }, 1000);
                }
              });
              timeIdInput.style.marginBottom = '8px';
              // Delete time button
              const deleteTimeBtn = document.createElement('button');
              deleteTimeBtn.textContent = 'Delete Time';
              deleteTimeBtn.style.cssText = `
                background: #f44336;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
              `;
              deleteTimeBtn.onclick = () => {
                const timeIndex = triggerSequence.times.findIndex(t => t === newTime);
                if (timeIndex !== -1) {
                  triggerSequence.times.splice(timeIndex, 1);
                }
                timeContainer.remove();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              contentContainer.appendChild(fieldNameInput);
              contentContainer.appendChild(timeIdInput);
              // Initialize conditional logic if it doesn't exist
              if (!newTime.conditionalLogic) {
                newTime.conditionalLogic = {
                  enabled: false,
                  conditions: []
                };
              }
              // Enable Conditional Logic checkbox
              const enableConditionalLogicCheckbox = document.createElement('input');
              enableConditionalLogicCheckbox.type = 'checkbox';
              enableConditionalLogicCheckbox.checked = newTime.conditionalLogic.enabled || false;
              enableConditionalLogicCheckbox.style.cssText = `
                margin-bottom: 8px;
              `;
        const enableConditionalLogicLabel = document.createElement('label');
        enableConditionalLogicLabel.textContent = 'Enable Conditional Logic';
        enableConditionalLogicLabel.style.cssText = `
          font-size: 12px;
          margin-left: 4px;
          cursor: pointer;
        `;
        enableConditionalLogicLabel.htmlFor = enableConditionalLogicCheckbox.id || `enableConditionalLogic_${triggerIndex}_${triggerSequence.times.length - 1}`;
        enableConditionalLogicCheckbox.id = enableConditionalLogicLabel.htmlFor;
        const conditionalLogicContainer = document.createElement('div');
        conditionalLogicContainer.style.cssText = `
          margin-bottom: 8px;
          display: flex;
          align-items: center;
        `;
        conditionalLogicContainer.appendChild(enableConditionalLogicCheckbox);
        conditionalLogicContainer.appendChild(enableConditionalLogicLabel);
              // Conditional logic UI container
              const conditionalLogicUIContainer = document.createElement('div');
              conditionalLogicUIContainer.id = `conditionalLogic_${triggerIndex}_${triggerSequence.times.length - 1}`;
              conditionalLogicUIContainer.style.display = newTime.conditionalLogic.enabled ? 'block' : 'none';
              // Function to update conditional logic UI
              const updateConditionalLogicUI = () => {
                conditionalLogicUIContainer.innerHTML = '';
                if (!newTime.conditionalLogic.conditions || newTime.conditionalLogic.conditions.length === 0) {
                  newTime.conditionalLogic.conditions = [''];
                }
                const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(triggerSequence, dropdown, cell);
                newTime.conditionalLogic.conditions.forEach((condition, conditionIndex) => {
                  const conditionRow = document.createElement('div');
                  conditionRow.style.cssText = `
                    margin-bottom: 8px;
                    display: flex;
                    gap: 4px;
                    align-items: center;
                  `;
                  const conditionDropdown = document.createElement('select');
                  conditionDropdown.style.cssText = `
                    flex: 1;
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    font-size: 12px;
                  `;
                  // Add placeholder option
                  const placeholderOption = document.createElement('option');
                  placeholderOption.value = '';
                  placeholderOption.textContent = 'Select checkbox option...';
                  conditionDropdown.appendChild(placeholderOption);
                  // Add checkbox option node IDs
                  checkboxNodeIds.forEach(nodeId => {
                    const option = document.createElement('option');
                    option.value = nodeId;
                    option.textContent = nodeId;
                    if (condition === nodeId) {
                      option.selected = true;
                    }
                    conditionDropdown.appendChild(option);
                  });
                  conditionDropdown.value = condition || '';
                  conditionDropdown.onchange = () => {
                    newTime.conditionalLogic.conditions[conditionIndex] = conditionDropdown.value;
                    if (typeof window.requestAutosave === 'function') {
                      window.requestAutosave();
                    }
                  };
                  const removeConditionBtn = document.createElement('button');
                  removeConditionBtn.textContent = '×';
                  removeConditionBtn.style.cssText = `
                    background: #f44336;
                    color: white;
                    border: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 14px;
                    flex-shrink: 0;
                  `;
                  removeConditionBtn.onclick = () => {
                    if (newTime.conditionalLogic.conditions.length > 1) {
                      newTime.conditionalLogic.conditions.splice(conditionIndex, 1);
                      updateConditionalLogicUI();
                      if (typeof window.requestAutosave === 'function') {
                        window.requestAutosave();
                      }
                    }
                  };
                  conditionRow.appendChild(conditionDropdown);
                  conditionRow.appendChild(removeConditionBtn);
                  conditionalLogicUIContainer.appendChild(conditionRow);
                });
                // Add Another Condition button
                const addConditionBtn = document.createElement('button');
                addConditionBtn.textContent = 'Add Another Condition';
                addConditionBtn.style.cssText = `
                  background: #2196F3;
                  color: white;
                  border: none;
                  padding: 4px 8px;
                  border-radius: 3px;
                  cursor: pointer;
                  font-size: 11px;
                  width: 100%;
                  margin-top: 4px;
                `;
                addConditionBtn.onclick = () => {
                  if (!newTime.conditionalLogic.conditions) {
                    newTime.conditionalLogic.conditions = [];
                  }
                  newTime.conditionalLogic.conditions.push('');
                  updateConditionalLogicUI();
                  if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                  }
                };
                conditionalLogicUIContainer.appendChild(addConditionBtn);
              };
              enableConditionalLogicCheckbox.onchange = () => {
                newTime.conditionalLogic.enabled = enableConditionalLogicCheckbox.checked;
                conditionalLogicUIContainer.style.display = enableConditionalLogicCheckbox.checked ? 'block' : 'none';
                if (enableConditionalLogicCheckbox.checked && (!newTime.conditionalLogic.conditions || newTime.conditionalLogic.conditions.length === 0)) {
                  newTime.conditionalLogic.conditions = [''];
                }
                updateConditionalLogicUI();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Initialize conditional logic UI if enabled
              if (newTime.conditionalLogic.enabled) {
                updateConditionalLogicUI();
              }
              contentContainer.appendChild(conditionalLogicContainer);
              contentContainer.appendChild(conditionalLogicUIContainer);
              contentContainer.appendChild(deleteTimeBtn);
              // Copy ID button for time (positioned after delete button)
              const copyTimeIdBtn = document.createElement('button');
              copyTimeIdBtn.textContent = 'Copy ID';
              copyTimeIdBtn.style.cssText = `
                background: #17a2b8;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                margin-bottom: 8px;
                width: 100%;
              `;
              copyTimeIdBtn.onclick = () => {
                const number = prompt('Enter number:', '1');
                if (number !== null && number !== '') {
                  const nodeIdWithNumber = `${timeIdInput.value}_${number}`;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(nodeIdWithNumber).then(() => {
                      copyTimeIdBtn.textContent = 'Copied!';
                      copyTimeIdBtn.style.background = '#28a745';
                      setTimeout(() => {
                        copyTimeIdBtn.textContent = 'Copy ID';
                        copyTimeIdBtn.style.background = '#17a2b8';
                      }, 1500);
                    });
                  } else {
                    const textArea = document.createElement('textarea');
                    textArea.value = nodeIdWithNumber;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    copyTimeIdBtn.textContent = 'Copied!';
                    copyTimeIdBtn.style.background = '#28a745';
                    setTimeout(() => {
                      copyTimeIdBtn.textContent = 'Copy ID';
                      copyTimeIdBtn.style.background = '#17a2b8';
                    }, 1500);
                  }
                }
              };
              contentContainer.appendChild(copyTimeIdBtn);
              timeContainer.appendChild(contentContainer);
              // Add drag handlers
              timeContainer.addEventListener('dragstart', (e) => {
                timeContainer.classList.add('dragging');
                timeContainer.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
              });
              timeContainer.addEventListener('dragend', (e) => {
                timeContainer.classList.remove('dragging');
                timeContainer.style.opacity = '1';
              });
              actionsList.appendChild(timeContainer);
              fieldNameInput.focus();
            }
          }
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        const addLocationBtn = document.createElement('button');
        addLocationBtn.textContent = 'Add Location';
        addLocationBtn.style.cssText = `
          background: #ff9800;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        addLocationBtn.onclick = () => {
          // Ensure dropdown.triggerSequences exists
          if (!dropdown.triggerSequences) {
            dropdown.triggerSequences = [];
          }
          // Create new location entry (like the main location button)
          const newLocation = { 
            type: 'location',
            fieldName: 'Location Data Inserted',
            nodeId: '',
            locationTitle: ''
          };
          if (!triggerSequence.locations) triggerSequence.locations = [];
          triggerSequence.locations.push(newLocation);
          // Calculate triggerIndex by finding the index of this triggerSequence in the dropdown's triggerSequences array
          const triggerIndex = dropdown.triggerSequences.findIndex(trigger => trigger.id === triggerSequence.id);
          // Update the actions list for this trigger sequence
          const triggerDiv = addLocationBtn.closest('.trigger-sequence');
          if (triggerDiv) {
            const actionsList = triggerDiv.querySelector('.actions-list');
            if (actionsList) {
              // Create location entry container (styled like main location indicator)
              const locationContainer = document.createElement('div');
              locationContainer.draggable = true;
              locationContainer.dataset.type = 'location';
              locationContainer.dataset.triggerIndex = triggerIndex >= 0 ? triggerIndex : 0;
              locationContainer.style.cssText = `
                margin: 8px 0;
                padding: 8px;
                background-color: #e8f5e8;
                border: 2px dashed #28a745;
                border-radius: 4px;
                text-align: center;
                color: #28a745;
                font-weight: bold;
                font-size: 12px;
                cursor: move;
                position: relative;
              `;
              // Add drag handle
              const dragHandle = document.createElement('div');
              dragHandle.textContent = '⋮⋮';
              dragHandle.style.cssText = `
                position: absolute;
                left: 4px;
                top: 50%;
                transform: translateY(-50%);
                cursor: move;
                color: #28a745;
                font-size: 14px;
                user-select: none;
                padding: 2px;
              `;
              locationContainer.appendChild(dragHandle);
              // Create content container
              const contentContainer = document.createElement('div');
              contentContainer.style.cssText = `
                margin-left: 24px;
              `;
              // Location indicator text
              const locationText = document.createElement('div');
              locationText.textContent = '📍 Location Data Inserted';
              locationText.style.cssText = `
                margin-bottom: 8px;
              `;
              // Location title input field
              const locationTitleInput = document.createElement('input');
              locationTitleInput.type = 'text';
              locationTitleInput.placeholder = 'Enter location title...';
              locationTitleInput.value = newLocation.locationTitle || '';
              locationTitleInput.style.cssText = `
                width: 100%;
                max-width: 300px;
                padding: 4px 8px;
                border: 1px solid #28a745;
                border-radius: 3px;
                font-size: 12px;
                margin-top: 8px;
                margin-bottom: 8px;
                text-align: center;
                background: white;
                color: #333;
              `;
              locationTitleInput.onblur = () => {
                newLocation.locationTitle = locationTitleInput.value.trim();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Button container
              const buttonContainer = document.createElement('div');
              buttonContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 4px;
                align-items: center;
              `;
              // Copy ID's button for trigger sequence location
              const copyLocationIdsBtn = document.createElement('button');
              copyLocationIdsBtn.textContent = 'Copy ID\'s';
              copyLocationIdsBtn.style.cssText = `
                background-color: #17a2b8;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
              `;
              copyLocationIdsBtn.onclick = () => {
                if (typeof window.showTriggerSequenceLocationIdsPopup === 'function') {
                  window.showTriggerSequenceLocationIdsPopup(cell.id, dropdown.name, triggerSequence.triggerOption || '', locationTitleInput.value.trim());
                }
              };
              // Delete location button
              const deleteLocationBtn = document.createElement('button');
              deleteLocationBtn.textContent = 'Remove';
              deleteLocationBtn.style.cssText = `
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                font-size: 10px;
                cursor: pointer;
              `;
              deleteLocationBtn.onclick = () => {
                const locationIndex = triggerSequence.locations.findIndex(l => l === newLocation);
                if (locationIndex !== -1) {
                  triggerSequence.locations.splice(locationIndex, 1);
                }
                locationContainer.remove();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              buttonContainer.appendChild(copyLocationIdsBtn);
              buttonContainer.appendChild(deleteLocationBtn);
              contentContainer.appendChild(locationText);
              contentContainer.appendChild(locationTitleInput);
              contentContainer.appendChild(buttonContainer);
              locationContainer.appendChild(contentContainer);
              // Add drag handlers
              locationContainer.addEventListener('dragstart', (e) => {
                locationContainer.classList.add('dragging');
                locationContainer.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
              });
              locationContainer.addEventListener('dragend', (e) => {
                locationContainer.classList.remove('dragging');
                locationContainer.style.opacity = '1';
              });
              actionsList.appendChild(locationContainer);
            }
          }
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        const addPdfBtn = document.createElement('button');
        addPdfBtn.textContent = 'Add PDF';
        addPdfBtn.style.cssText = `
          background: #e91e63;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        addPdfBtn.onclick = () => {
          // Ensure dropdown.triggerSequences exists
          if (!dropdown.triggerSequences) {
            dropdown.triggerSequences = [];
          }
          // Create new PDF entry
          const newPdf = {
            triggerNumber: '',
            pdfTitle: '',
            pdfFilename: '',
            pdfPriceId: ''
          };
          if (!triggerSequence.pdfs) triggerSequence.pdfs = [];
          triggerSequence.pdfs.push(newPdf);
          // Calculate triggerIndex by finding the index of this triggerSequence in the dropdown's triggerSequences array
          const triggerIndex = dropdown.triggerSequences.findIndex(trigger => trigger.id === triggerSequence.id);
          // Update the actions list for this trigger sequence
          const triggerDiv = addPdfBtn.closest('.trigger-sequence');
          if (triggerDiv) {
            const actionsList = triggerDiv.querySelector('.actions-list');
            if (actionsList) {
              // Create PDF entry container
              const pdfContainer = document.createElement('div');
              pdfContainer.draggable = true;
              pdfContainer.dataset.type = 'pdf';
              pdfContainer.dataset.triggerIndex = triggerIndex >= 0 ? triggerIndex : 0;
              pdfContainer.style.cssText = `
                margin-bottom: 10px;
                padding: 8px;
                background: #fce4ec;
                border: 1px solid #e91e63;
                border-radius: 4px;
                cursor: move;
                position: relative;
              `;
              // Add drag handle
              const dragHandle = document.createElement('div');
              dragHandle.innerHTML = '⋮⋮';
              dragHandle.style.cssText = `
                position: absolute;
                left: 4px;
                top: 50%;
                transform: translateY(-50%);
                cursor: move;
                color: #e91e63;
                font-size: 14px;
                user-select: none;
                padding: 2px;
              `;
              pdfContainer.appendChild(dragHandle);
              // Create content container
              const contentContainer = document.createElement('div');
              contentContainer.style.cssText = `
                margin-left: 24px;
              `;
              // Trigger number input
              const triggerNumberInput = document.createElement('input');
              triggerNumberInput.type = 'text';
              triggerNumberInput.placeholder = 'Trigger number...';
              triggerNumberInput.value = newPdf.triggerNumber || '';
              triggerNumberInput.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
              `;
              triggerNumberInput.onblur = () => {
                newPdf.triggerNumber = triggerNumberInput.value.trim();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // PDF title input
              const pdfTitleInput = document.createElement('input');
              pdfTitleInput.type = 'text';
              pdfTitleInput.placeholder = 'PDF title...';
              pdfTitleInput.value = newPdf.pdfTitle || '';
              pdfTitleInput.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
              `;
              pdfTitleInput.onblur = () => {
                newPdf.pdfTitle = pdfTitleInput.value.trim();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // PDF filename input
              const pdfFilenameInput = document.createElement('input');
              pdfFilenameInput.type = 'text';
              pdfFilenameInput.placeholder = 'PDF filename...';
              pdfFilenameInput.value = newPdf.pdfFilename || '';
              pdfFilenameInput.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
              `;
              pdfFilenameInput.onblur = () => {
                newPdf.pdfFilename = pdfFilenameInput.value.trim();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // PDF price ID input
              const pdfPriceIdInput = document.createElement('input');
              pdfPriceIdInput.type = 'text';
              pdfPriceIdInput.placeholder = 'PDF price ID...';
              pdfPriceIdInput.value = newPdf.pdfPriceId || '';
              pdfPriceIdInput.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
              `;
              pdfPriceIdInput.onblur = () => {
                newPdf.pdfPriceId = pdfPriceIdInput.value.trim();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Delete PDF button
              const deletePdfBtn = document.createElement('button');
              deletePdfBtn.textContent = 'Delete PDF';
              deletePdfBtn.style.cssText = `
                background: #f44336;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
              `;
              deletePdfBtn.onclick = () => {
                const pdfIndex = triggerSequence.pdfs.findIndex(p => p === newPdf);
                if (pdfIndex !== -1) {
                  triggerSequence.pdfs.splice(pdfIndex, 1);
                }
                pdfContainer.remove();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              contentContainer.appendChild(triggerNumberInput);
              contentContainer.appendChild(pdfTitleInput);
              contentContainer.appendChild(pdfFilenameInput);
              contentContainer.appendChild(pdfPriceIdInput);
              contentContainer.appendChild(deletePdfBtn);
              pdfContainer.appendChild(contentContainer);
              // Add drag handlers
              pdfContainer.addEventListener('dragstart', (e) => {
                pdfContainer.classList.add('dragging');
                pdfContainer.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
              });
              pdfContainer.addEventListener('dragend', (e) => {
                pdfContainer.classList.remove('dragging');
                pdfContainer.style.opacity = '1';
              });
              actionsList.appendChild(pdfContainer);
              triggerNumberInput.focus();
            }
          }
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        const addDropdownBtn = document.createElement('button');
        addDropdownBtn.textContent = 'Add Dropdown';
        addDropdownBtn.style.cssText = `
          background: #17a2b8;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        addDropdownBtn.onclick = () => {
          // Ensure dropdown.triggerSequences exists
          if (!dropdown.triggerSequences) {
            dropdown.triggerSequences = [];
          }
          // Create new dropdown entry
          const newDropdown = {
            fieldName: '',
            options: []
          };
          if (!triggerSequence.dropdowns) triggerSequence.dropdowns = [];
          triggerSequence.dropdowns.push(newDropdown);
          // Calculate triggerIndex by finding the index of this triggerSequence in the dropdown's triggerSequences array
          const triggerIndex = dropdown.triggerSequences.findIndex(trigger => trigger.id === triggerSequence.id);
          // Update the actions list for this trigger sequence
          const triggerDiv = addDropdownBtn.closest('.trigger-sequence');
          if (triggerDiv) {
            const actionsList = triggerDiv.querySelector('.actions-list');
            if (actionsList) {
              // Create dropdown entry container
              const dropdownContainer = document.createElement('div');
              dropdownContainer.draggable = true;
              dropdownContainer.dataset.type = 'dropdown';
              dropdownContainer.dataset.triggerIndex = triggerIndex >= 0 ? triggerIndex : 0;
              dropdownContainer.style.cssText = `
                margin-bottom: 10px;
                padding: 8px;
                background: #e0f7fa;
                border: 1px solid #17a2b8;
                border-radius: 4px;
                cursor: move;
                position: relative;
              `;
              // Add drag handle
              const dragHandle = document.createElement('div');
              dragHandle.innerHTML = '⋮⋮';
              dragHandle.style.cssText = `
                position: absolute;
                left: 4px;
                top: 50%;
                transform: translateY(-50%);
                cursor: move;
                color: #17a2b8;
                font-size: 14px;
                user-select: none;
                padding: 2px;
              `;
              dropdownContainer.appendChild(dragHandle);
              // Create content container
              const contentContainer = document.createElement('div');
              contentContainer.style.cssText = `
                margin-left: 24px;
              `;
              // Field name input
              const fieldNameInput = document.createElement('input');
              fieldNameInput.type = 'text';
              fieldNameInput.placeholder = 'Enter dropdown question title...';
              fieldNameInput.style.cssText = `
                width: 100%;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
                margin-bottom: 8px;
              `;
              fieldNameInput.onblur = () => {
                newDropdown.fieldName = fieldNameInput.value.trim();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Add option button
              const addOptionBtn = document.createElement('button');
              addOptionBtn.textContent = 'Add option';
              addOptionBtn.style.cssText = `
                background: #17a2b8;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                margin-bottom: 8px;
              `;
              // Options container
              const optionsContainer = document.createElement('div');
              optionsContainer.className = 'dropdown-options-container';
              optionsContainer.style.cssText = `
                margin-bottom: 8px;
              `;
              addOptionBtn.onclick = () => {
                const newOption = { text: '' };
                newDropdown.options.push(newOption);
                // Create option input
                const optionDiv = document.createElement('div');
                optionDiv.style.cssText = `
                  display: flex;
                  gap: 4px;
                  margin-bottom: 4px;
                  align-items: center;
                `;
                const optionInput = document.createElement('input');
                optionInput.type = 'text';
                optionInput.placeholder = 'Enter option text...';
                optionInput.style.cssText = `
                  flex: 1;
                  padding: 4px 8px;
                  border: 1px solid #ddd;
                  border-radius: 3px;
                  font-size: 12px;
                `;
                optionInput.value = newOption.text || '';
                optionInput.onblur = () => {
                  newOption.text = optionInput.value.trim();
                  // Refresh all conditional logic UIs in this trigger sequence when options change
                  const triggerDiv = addDropdownBtn.closest('.trigger-sequence');
                  if (triggerDiv) {
                    // Find all conditional logic containers and trigger their update functions
                    const allConditionalLogicContainers = triggerDiv.querySelectorAll('[id^="conditionalLogicDropdown_"]');
                    allConditionalLogicContainers.forEach(container => {
                      // Try to find and call the updateConditionalLogicUI function for this container
                      // We'll store a reference to it on the container
                      if (container._updateConditionalLogicUI) {
                        container._updateConditionalLogicUI();
                      }
                    });
                  }
                  if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                  }
                };
                optionInput.oninput = () => {
                  // Also refresh on input for real-time updates
                  const triggerDiv = addDropdownBtn.closest('.trigger-sequence');
                  if (triggerDiv) {
                    const allConditionalLogicContainers = triggerDiv.querySelectorAll('[id^="conditionalLogicDropdown_"]');
                    allConditionalLogicContainers.forEach(container => {
                      if (container._updateConditionalLogicUI) {
                        container._updateConditionalLogicUI();
                      }
                    });
                  }
                };
                const deleteOptionBtn = document.createElement('button');
                deleteOptionBtn.textContent = '×';
                deleteOptionBtn.style.cssText = `
                  background: #f44336;
                  color: white;
                  border: none;
                  padding: 2px 6px;
                  border-radius: 3px;
                  cursor: pointer;
                  font-size: 14px;
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                `;
                deleteOptionBtn.onclick = () => {
                  const optionIndex = newDropdown.options.findIndex(o => o === newOption);
                  if (optionIndex !== -1) {
                    newDropdown.options.splice(optionIndex, 1);
                  }
                  optionDiv.remove();
                  if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                  }
                };
                optionDiv.appendChild(optionInput);
                optionDiv.appendChild(deleteOptionBtn);
                optionsContainer.appendChild(optionDiv);
                optionInput.focus();
              };
              // Delete dropdown button
              const deleteDropdownBtn = document.createElement('button');
              deleteDropdownBtn.textContent = 'Delete Dropdown';
              deleteDropdownBtn.style.cssText = `
                background: #f44336;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
              `;
              deleteDropdownBtn.onclick = () => {
                const dropdownIndex = triggerSequence.dropdowns.findIndex(d => d === newDropdown);
                if (dropdownIndex !== -1) {
                  triggerSequence.dropdowns.splice(dropdownIndex, 1);
                }
                dropdownContainer.remove();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Initialize conditional logic if it doesn't exist
              if (!newDropdown.conditionalLogic) {
                newDropdown.conditionalLogic = {
                  enabled: false,
                  conditions: []
                };
              }
              // Enable Conditional Logic checkbox
              const enableConditionalLogicCheckbox = document.createElement('input');
              enableConditionalLogicCheckbox.type = 'checkbox';
              enableConditionalLogicCheckbox.checked = newDropdown.conditionalLogic.enabled || false;
              enableConditionalLogicCheckbox.style.cssText = `
                margin-bottom: 8px;
              `;
              const enableConditionalLogicLabel = document.createElement('label');
              enableConditionalLogicLabel.textContent = 'Enable Conditional Logic';
              enableConditionalLogicLabel.style.cssText = `
                font-size: 12px;
                margin-left: 4px;
                cursor: pointer;
              `;
              enableConditionalLogicLabel.htmlFor = enableConditionalLogicCheckbox.id || `enableConditionalLogicDropdown_${triggerIndex}_${triggerSequence.dropdowns.length - 1}`;
              enableConditionalLogicCheckbox.id = enableConditionalLogicLabel.htmlFor;
              const conditionalLogicContainer = document.createElement('div');
              conditionalLogicContainer.style.cssText = `
                margin-bottom: 8px;
                display: flex;
                align-items: center;
              `;
              conditionalLogicContainer.appendChild(enableConditionalLogicCheckbox);
              conditionalLogicContainer.appendChild(enableConditionalLogicLabel);
              // Conditional logic UI container
              const conditionalLogicUIContainer = document.createElement('div');
              conditionalLogicUIContainer.id = `conditionalLogicDropdown_${triggerIndex}_${triggerSequence.dropdowns.length - 1}`;
              conditionalLogicUIContainer.style.display = newDropdown.conditionalLogic.enabled ? 'block' : 'none';
              // Function to update conditional logic UI
              const updateConditionalLogicUI = () => {
                conditionalLogicUIContainer.innerHTML = '';
                if (!newDropdown.conditionalLogic.conditions || newDropdown.conditionalLogic.conditions.length === 0) {
                  newDropdown.conditionalLogic.conditions = [''];
                }
                // Store reference to this function on the container so it can be called when options change
                conditionalLogicUIContainer._updateConditionalLogicUI = updateConditionalLogicUI;
                const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(triggerSequence, dropdown, cell);
                newDropdown.conditionalLogic.conditions.forEach((condition, conditionIndex) => {
                  const conditionRow = document.createElement('div');
                  conditionRow.style.cssText = `
                    margin-bottom: 8px;
                    display: flex;
                    gap: 4px;
                    align-items: center;
                  `;
                  const conditionDropdown = document.createElement('select');
                  conditionDropdown.style.cssText = `
                    flex: 1;
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    font-size: 12px;
                  `;
                  // Add placeholder option
                  const placeholderOption = document.createElement('option');
                  placeholderOption.value = '';
                  placeholderOption.textContent = 'Select checkbox option...';
                  conditionDropdown.appendChild(placeholderOption);
                  // Add checkbox option node IDs
                  checkboxNodeIds.forEach(nodeId => {
                    const option = document.createElement('option');
                    option.value = nodeId;
                    option.textContent = nodeId;
                    if (condition === nodeId) {
                      option.selected = true;
                    }
                    conditionDropdown.appendChild(option);
                  });
                  conditionDropdown.value = condition || '';
                  conditionDropdown.onchange = () => {
                    newDropdown.conditionalLogic.conditions[conditionIndex] = conditionDropdown.value;
                    if (typeof window.requestAutosave === 'function') {
                      window.requestAutosave();
                    }
                  };
                  const removeConditionBtn = document.createElement('button');
                  removeConditionBtn.textContent = '×';
                  removeConditionBtn.style.cssText = `
                    background: #f44336;
                    color: white;
                    border: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 14px;
                    flex-shrink: 0;
                  `;
                  removeConditionBtn.onclick = () => {
                    if (newDropdown.conditionalLogic.conditions.length > 1) {
                      newDropdown.conditionalLogic.conditions.splice(conditionIndex, 1);
                      updateConditionalLogicUI();
                      if (typeof window.requestAutosave === 'function') {
                        window.requestAutosave();
                      }
                    }
                  };
                  conditionRow.appendChild(conditionDropdown);
                  conditionRow.appendChild(removeConditionBtn);
                  conditionalLogicUIContainer.appendChild(conditionRow);
                });
                // Add Another Condition button
                const addConditionBtn = document.createElement('button');
                addConditionBtn.textContent = 'Add Another Condition';
                addConditionBtn.style.cssText = `
                  background: #2196F3;
                  color: white;
                  border: none;
                  padding: 4px 8px;
                  border-radius: 3px;
                  cursor: pointer;
                  font-size: 11px;
                  width: 100%;
                  margin-top: 4px;
                `;
                addConditionBtn.onclick = () => {
                  if (!newDropdown.conditionalLogic.conditions) {
                    newDropdown.conditionalLogic.conditions = [];
                  }
                  newDropdown.conditionalLogic.conditions.push('');
                  updateConditionalLogicUI();
                  if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                  }
                };
                conditionalLogicUIContainer.appendChild(addConditionBtn);
              };
              enableConditionalLogicCheckbox.onchange = () => {
                newDropdown.conditionalLogic.enabled = enableConditionalLogicCheckbox.checked;
                conditionalLogicUIContainer.style.display = enableConditionalLogicCheckbox.checked ? 'block' : 'none';
                if (enableConditionalLogicCheckbox.checked && (!newDropdown.conditionalLogic.conditions || newDropdown.conditionalLogic.conditions.length === 0)) {
                  newDropdown.conditionalLogic.conditions = [''];
                }
                updateConditionalLogicUI();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              // Initialize conditional logic UI if enabled
              if (newDropdown.conditionalLogic.enabled) {
                updateConditionalLogicUI();
              }
              contentContainer.appendChild(fieldNameInput);
              contentContainer.appendChild(addOptionBtn);
              contentContainer.appendChild(optionsContainer);
              contentContainer.appendChild(conditionalLogicContainer);
              contentContainer.appendChild(conditionalLogicUIContainer);
              contentContainer.appendChild(deleteDropdownBtn);
              dropdownContainer.appendChild(contentContainer);
              // Add drag handlers
              dropdownContainer.addEventListener('dragstart', (e) => {
                dropdownContainer.classList.add('dragging');
                dropdownContainer.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', JSON.stringify({
                  type: 'dropdown',
                  triggerIndex: triggerIndex,
                  dropdownIndex: triggerSequence.dropdowns.indexOf(newDropdown)
                }));
              });
              dropdownContainer.addEventListener('dragend', (e) => {
                dropdownContainer.classList.remove('dragging');
                dropdownContainer.style.opacity = '1';
              });
              actionsList.appendChild(dropdownContainer);
              fieldNameInput.focus();
            }
          }
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        actionButtons.appendChild(addLabelBtn);
        actionButtons.appendChild(addCheckboxBtn);
        actionButtons.appendChild(addTimeBtn);
        actionButtons.appendChild(addDropdownBtn);
        actionButtons.appendChild(addLocationBtn);
        actionButtons.appendChild(addPdfBtn);
        triggerDiv.appendChild(actionButtons);
        // Add actions list container
        const actionsList = document.createElement('div');
        actionsList.className = 'actions-list';
        actionsList.style.cssText = `
          margin-top: 5px;
        `;
        // Add drop handlers to actionsList for reordering entries
        actionsList.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const afterElement = getDragAfterElement(actionsList, e.clientY);
          const dragging = document.querySelector('.dragging');
          if (afterElement == null) {
            actionsList.appendChild(dragging);
          } else {
            actionsList.insertBefore(dragging, afterElement);
          }
        });
        actionsList.addEventListener('drop', (e) => {
          e.preventDefault();
          const dragging = document.querySelector('.dragging');
          if (dragging) {
            dragging.classList.remove('dragging');
            dragging.style.opacity = '1';
            // Save the new order by reordering the underlying arrays
            saveTriggerSequenceOrder(actionsList, triggerSequence);
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          }
        });
        function getDragAfterElement(container, y) {
          const draggableElements = [...container.querySelectorAll(':not(.dragging)[draggable="true"]')];
          return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
              return { offset: offset, element: child };
            } else {
              return closest;
            }
          }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
        triggerDiv.appendChild(actionsList);
        triggerSequencesList.appendChild(triggerDiv);
      }
    }
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  conditionalSection.appendChild(addTriggerBtn);
  // Display existing trigger sequences
  const triggerSequencesList = document.createElement('div');
  triggerSequencesList.className = 'trigger-sequences-list';
  triggerSequencesList.style.cssText = `
    margin-top: 10px;
  `;
  dropdown.triggerSequences.forEach((trigger, triggerIndex) => {
    const triggerDiv = document.createElement('div');
    triggerDiv.className = 'trigger-sequence';
    triggerDiv.style.cssText = `
      margin-bottom: 10px;
      padding: 10px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
    `;
    // Make sure trigger sequence container is NOT draggable
    triggerDiv.draggable = false;
    // Trigger dropdown
    const triggerLabel = document.createElement('label');
    triggerLabel.textContent = 'When option is selected:';
    triggerLabel.style.cssText = `
      display: block;
      font-size: 12px;
      margin-bottom: 5px;
      color: #666;
    `;
    triggerDiv.appendChild(triggerLabel);
    const triggerSelect = document.createElement('select');
    triggerSelect.style.cssText = `
      width: 100%;
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      margin-bottom: 10px;
    `;
    // Function to update options in the dropdown
    const updateTriggerOptions = () => {
      // Clear existing options
      triggerSelect.innerHTML = '';
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Select an option...';
      triggerSelect.appendChild(defaultOption);
      dropdown.options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        if (option.value === trigger.triggerOption) {
          optionElement.selected = true;
        }
        triggerSelect.appendChild(optionElement);
      });
    };
    // Initial population
    updateTriggerOptions();
    // Update options when dropdown is clicked/focused
    triggerSelect.onfocus = updateTriggerOptions;
    triggerSelect.onchange = () => {
      trigger.triggerOption = triggerSelect.value;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    triggerDiv.appendChild(triggerSelect);
    // Add delete trigger button
    const deleteTriggerBtn = document.createElement('button');
    deleteTriggerBtn.textContent = 'Delete Trigger';
    deleteTriggerBtn.style.cssText = `
      background: #f44336;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      margin-bottom: 10px;
    `;
    deleteTriggerBtn.onclick = () => {
      dropdown.triggerSequences.splice(triggerIndex, 1);
      // Remove the trigger div from the DOM
      triggerDiv.remove();
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    triggerDiv.appendChild(deleteTriggerBtn);
    // Action buttons
    const actionButtons = document.createElement('div');
    actionButtons.style.cssText = `
      display: flex;
      gap: 5px;
      margin-bottom: 10px;
    `;
    const addLabelBtn = document.createElement('button');
    addLabelBtn.textContent = '+ Label';
    addLabelBtn.style.cssText = `
      background: #4caf50;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    addLabelBtn.onclick = () => {
      // Create new label entry like the main button
      const newLabel = { fieldName: '', nodeId: '' };
      if (!trigger.labels) trigger.labels = [];
      trigger.labels.push(newLabel);
      // Update the actions list for this trigger sequence
      const triggerDiv = addLabelBtn.closest('.trigger-sequence');
      if (triggerDiv) {
        const actionsList = triggerDiv.querySelector('.actions-list');
        if (actionsList) {
          // Create label entry container
          const labelContainer = document.createElement('div');
          labelContainer.draggable = true;
          labelContainer.dataset.type = 'label';
          labelContainer.dataset.triggerIndex = triggerIndex;
          labelContainer.style.cssText = `
            margin-bottom: 10px;
            padding: 8px;
            background: #e8f5e8;
            border: 1px solid #4caf50;
            border-radius: 4px;
            cursor: move;
            position: relative;
          `;
          // Add drag handle
          const dragHandle = document.createElement('div');
          dragHandle.textContent = '⋮⋮';
          dragHandle.style.cssText = `
            position: absolute;
            left: 4px;
            top: 50%;
            transform: translateY(-50%);
            cursor: move;
            color: #4caf50;
            font-size: 14px;
            user-select: none;
            padding: 2px;
          `;
          labelContainer.appendChild(dragHandle);
          // Create content container
          const contentContainer = document.createElement('div');
          contentContainer.style.cssText = `
            margin-left: 24px;
          `;
          // Field name input
          const fieldNameInput = document.createElement('input');
          fieldNameInput.type = 'text';
          fieldNameInput.placeholder = 'Enter label field name...';
          fieldNameInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
          `;
          fieldNameInput.oninput = () => {
            // Update the node ID dynamically as the user types
            const updatedNodeId = generateNodeIdForDropdownField(fieldNameInput.value.trim() || '', dropdown.name || '', cell, trigger.triggerOption || '');
            newLabel.nodeId = updatedNodeId;
            labelIdInput.value = updatedNodeId;
          };
          fieldNameInput.onblur = () => {
            newLabel.fieldName = fieldNameInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Label ID input (uneditable and autofilled)
          // Auto-fix incorrect node IDs when creating new fields
          const correctLabelId = generateNodeIdForDropdownField(newLabel.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
          const labelIdValue = (newLabel.nodeId && newLabel.nodeId === correctLabelId) ? newLabel.nodeId : correctLabelId;
          newLabel.nodeId = labelIdValue; // Set the nodeId in the data
          const labelIdInput = createUneditableNodeIdInput('Label ID...', labelIdValue, (input) => {
            // Double-click to copy functionality
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(input.value).then(() => {
                // Show visual feedback
                const originalBg = input.style.backgroundColor;
                input.style.backgroundColor = '#d4edda';
                input.style.borderColor = '#28a745';
                setTimeout(() => {
                  input.style.backgroundColor = originalBg;
                  input.style.borderColor = '#ddd';
                }, 1000);
              });
            } else {
              // Fallback for older browsers
              input.select();
              document.execCommand('copy');
              const originalBg = input.style.backgroundColor;
              input.style.backgroundColor = '#d4edda';
              input.style.borderColor = '#28a745';
              setTimeout(() => {
                input.style.backgroundColor = originalBg;
                input.style.borderColor = '#ddd';
              }, 1000);
            }
          });
          labelIdInput.style.marginBottom = '8px';
          // Delete label button
          const deleteLabelBtn = document.createElement('button');
          deleteLabelBtn.textContent = 'Delete Label';
          deleteLabelBtn.style.cssText = `
            background: #f44336;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
          `;
          deleteLabelBtn.onclick = () => {
            const labelIndex = trigger.labels.findIndex(l => l === newLabel);
            if (labelIndex !== -1) {
              trigger.labels.splice(labelIndex, 1);
            }
            labelContainer.remove();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          contentContainer.appendChild(fieldNameInput);
          contentContainer.appendChild(labelIdInput);
          contentContainer.appendChild(deleteLabelBtn);
          labelContainer.appendChild(contentContainer);
          // Add drag handlers
          labelContainer.addEventListener('dragstart', (e) => {
            labelContainer.classList.add('dragging');
            labelContainer.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
          });
          labelContainer.addEventListener('dragend', (e) => {
            labelContainer.classList.remove('dragging');
            labelContainer.style.opacity = '1';
          });
          actionsList.appendChild(labelContainer);
          fieldNameInput.focus();
        }
      }
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    const addCheckboxBtn = document.createElement('button');
    addCheckboxBtn.textContent = 'Add Checkbox';
    addCheckboxBtn.style.cssText = `
      background: #9c27b0;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    addCheckboxBtn.onclick = () => {
      // Create new checkbox entry like the main button
      const newCheckbox = { fieldName: '', options: [] };
      if (!trigger.checkboxes) trigger.checkboxes = [];
      trigger.checkboxes.push(newCheckbox);
      // Update the actions list for this trigger sequence
      const triggerDiv = addCheckboxBtn.closest('.trigger-sequence');
      if (triggerDiv) {
        const actionsList = triggerDiv.querySelector('.actions-list');
        if (actionsList) {
          // Create checkbox entry container
          const checkboxContainer = document.createElement('div');
          checkboxContainer.draggable = true;
          checkboxContainer.dataset.type = 'checkbox';
          checkboxContainer.dataset.triggerIndex = triggerIndex;
          checkboxContainer.style.cssText = `
            margin-bottom: 10px;
            padding: 8px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            cursor: move;
            position: relative;
          `;
          // Add drag handle
          const dragHandle = document.createElement('div');
          dragHandle.textContent = '⋮⋮';
          dragHandle.style.cssText = `
            position: absolute;
            left: 4px;
            top: 50%;
            transform: translateY(-50%);
            cursor: move;
            color: #9c27b0;
            font-size: 14px;
            user-select: none;
            padding: 2px;
          `;
          checkboxContainer.appendChild(dragHandle);
          // Create content container
          const contentContainer = document.createElement('div');
          contentContainer.style.cssText = `
            margin-left: 24px;
          `;
          // Field name input
          const fieldNameInput = document.createElement('input');
          fieldNameInput.type = 'text';
          fieldNameInput.placeholder = 'Enter checkbox field name...';
          fieldNameInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
          `;
          fieldNameInput.onblur = () => {
            newCheckbox.fieldName = fieldNameInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Selection type dropdown
          const selectionTypeLabel = document.createElement('label');
          selectionTypeLabel.textContent = 'Selection Type:';
          selectionTypeLabel.style.cssText = `
            display: block;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 4px;
            color: #333;
          `;
          const selectionTypeSelect = document.createElement('select');
          selectionTypeSelect.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
            background: white;
          `;
          const markAllOption = document.createElement('option');
          markAllOption.value = 'multiple';
          markAllOption.textContent = 'Mark All That Apply';
          markAllOption.selected = true;
          const markOneOption = document.createElement('option');
          markOneOption.value = 'single';
          markOneOption.textContent = 'Mark Only One';
          selectionTypeSelect.appendChild(markAllOption);
          selectionTypeSelect.appendChild(markOneOption);
          // Initialize selection type
          if (!newCheckbox.selectionType) {
            newCheckbox.selectionType = 'multiple';
          }
          selectionTypeSelect.value = newCheckbox.selectionType;
          selectionTypeSelect.onchange = () => {
            newCheckbox.selectionType = selectionTypeSelect.value;
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Required type dropdown
          const requiredTypeLabel = document.createElement('label');
          requiredTypeLabel.textContent = 'Required Type:';
          requiredTypeLabel.style.cssText = `
            display: block;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 4px;
            color: #333;
          `;
          const requiredTypeSelect = document.createElement('select');
          requiredTypeSelect.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
            background: white;
          `;
          const requiredOption = document.createElement('option');
          requiredOption.value = 'required';
          requiredOption.textContent = 'Required';
          const optionalOption = document.createElement('option');
          optionalOption.value = 'optional';
          optionalOption.textContent = 'Optional';
          requiredTypeSelect.appendChild(requiredOption);
          requiredTypeSelect.appendChild(optionalOption);
          // Initialize required type
          if (!newCheckbox.required) {
            newCheckbox.required = 'required';
          }
          requiredTypeSelect.value = newCheckbox.required;
          requiredTypeSelect.onchange = () => {
            newCheckbox.required = requiredTypeSelect.value;
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
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            margin-bottom: 8px;
          `;
          addCheckboxOptionBtn.onclick = () => {
            const newOption = { checkboxText: '', nodeId: '' };
            if (!newCheckbox.options) newCheckbox.options = [];
            newCheckbox.options.push(newOption);
            // Create mini checkbox option entry
            const miniOptionEntry = document.createElement('div');
            miniOptionEntry.style.cssText = `
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 4px 8px;
              background: white;
              border: 1px solid #ddd;
              border-radius: 3px;
              margin-bottom: 4px;
            `;
            const checkboxTextInput = document.createElement('input');
            checkboxTextInput.type = 'text';
            checkboxTextInput.placeholder = 'Checkbox text...';
            checkboxTextInput.style.cssText = `
              flex: 1;
              padding: 2px 4px;
              border: 1px solid #ddd;
              border-radius: 2px;
              font-size: 11px;
            `;
            checkboxTextInput.onblur = () => {
              newOption.checkboxText = checkboxTextInput.value.trim();
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            const checkboxIdInput = document.createElement('input');
            checkboxIdInput.type = 'text';
            checkboxIdInput.placeholder = 'Checkbox ID...';
            checkboxIdInput.style.cssText = `
              flex: 1;
              padding: 2px 4px;
              border: 1px solid #ddd;
              border-radius: 2px;
              font-size: 11px;
            `;
            checkboxIdInput.onblur = () => {
              newOption.nodeId = checkboxIdInput.value.trim();
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            const deleteOptionBtn = document.createElement('button');
            deleteOptionBtn.textContent = '×';
            deleteOptionBtn.style.cssText = `
              background: #f44336;
              color: white;
              border: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              cursor: pointer;
              font-size: 10px;
            `;
            deleteOptionBtn.onclick = () => {
              const optionIndex = newCheckbox.options.findIndex(opt => opt === newOption);
              if (optionIndex !== -1) {
                newCheckbox.options.splice(optionIndex, 1);
              }
              miniOptionEntry.remove();
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            miniOptionEntry.appendChild(checkboxTextInput);
            miniOptionEntry.appendChild(checkboxIdInput);
            miniOptionEntry.appendChild(deleteOptionBtn);
            checkboxContainer.appendChild(miniOptionEntry);
            checkboxTextInput.focus();
          };
          // Delete checkbox button
          const deleteCheckboxBtn = document.createElement('button');
          deleteCheckboxBtn.textContent = 'Delete Checkbox';
          deleteCheckboxBtn.style.cssText = `
            background: #f44336;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
          `;
          deleteCheckboxBtn.onclick = () => {
            const checkboxIndex = trigger.checkboxes.findIndex(cb => cb === newCheckbox);
            if (checkboxIndex !== -1) {
              trigger.checkboxes.splice(checkboxIndex, 1);
            }
            checkboxContainer.remove();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          contentContainer.appendChild(fieldNameInput);
          contentContainer.appendChild(selectionTypeLabel);
          contentContainer.appendChild(selectionTypeSelect);
          contentContainer.appendChild(requiredTypeLabel);
          contentContainer.appendChild(requiredTypeSelect);
          contentContainer.appendChild(addCheckboxOptionBtn);
          contentContainer.appendChild(deleteCheckboxBtn);
          checkboxContainer.appendChild(contentContainer);
          // Add drag handlers
          checkboxContainer.addEventListener('dragstart', (e) => {
            checkboxContainer.classList.add('dragging');
            checkboxContainer.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
          });
          checkboxContainer.addEventListener('dragend', (e) => {
            checkboxContainer.classList.remove('dragging');
            checkboxContainer.style.opacity = '1';
          });
          actionsList.appendChild(checkboxContainer);
          fieldNameInput.focus();
        }
      }
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    const addTimeBtn = document.createElement('button');
    addTimeBtn.textContent = '+ Time';
    addTimeBtn.style.cssText = `
      background: #ff9800;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    addTimeBtn.onclick = () => {
      // Create new time entry like the main button
      const newTime = { fieldName: '', nodeId: '' };
      if (!trigger.times) trigger.times = [];
      trigger.times.push(newTime);
      // Update the actions list for this trigger sequence
      const triggerDiv = addTimeBtn.closest('.trigger-sequence');
      if (triggerDiv) {
        const actionsList = triggerDiv.querySelector('.actions-list');
        if (actionsList) {
          // Create time entry container
          const timeContainer = document.createElement('div');
          timeContainer.draggable = true;
          timeContainer.dataset.type = 'time';
          timeContainer.dataset.triggerIndex = triggerIndex;
          timeContainer.style.cssText = `
            margin-bottom: 10px;
            padding: 8px;
            background: #fff3e0;
            border: 1px solid #ffcc02;
            border-radius: 4px;
            cursor: move;
            position: relative;
          `;
          // Add drag handle
          const dragHandle = document.createElement('div');
          dragHandle.textContent = '⋮⋮';
          dragHandle.style.cssText = `
            position: absolute;
            left: 4px;
            top: 50%;
            transform: translateY(-50%);
            cursor: move;
            color: #ff9800;
            font-size: 14px;
            user-select: none;
            padding: 2px;
          `;
          timeContainer.appendChild(dragHandle);
          // Create content container
          const contentContainer = document.createElement('div');
          contentContainer.style.cssText = `
            margin-left: 24px;
          `;
          // Field name input
          const fieldNameInput = document.createElement('input');
          fieldNameInput.type = 'text';
          fieldNameInput.placeholder = 'Enter time field name...';
          fieldNameInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
          `;
          fieldNameInput.onblur = () => {
            newTime.fieldName = fieldNameInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Time ID input (uneditable and autofilled)
          // Auto-fix incorrect node IDs when creating new fields
          const correctTimeId = generateNodeIdForDropdownField(newTime.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
          const timeIdValue = (newTime.nodeId && newTime.nodeId === correctTimeId) ? newTime.nodeId : correctTimeId;
          newTime.nodeId = timeIdValue; // Set the nodeId in the data
          const timeIdInput = createUneditableNodeIdInput('Time ID...', timeIdValue, (input) => {
            // Double-click to copy functionality
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(input.value).then(() => {
                // Show visual feedback
                const originalBg = input.style.backgroundColor;
                input.style.backgroundColor = '#d4edda';
                input.style.borderColor = '#28a745';
                setTimeout(() => {
                  input.style.backgroundColor = originalBg;
                  input.style.borderColor = '#ddd';
                }, 1000);
              });
            } else {
              // Fallback for older browsers
              input.select();
              document.execCommand('copy');
              const originalBg = input.style.backgroundColor;
              input.style.backgroundColor = '#d4edda';
              input.style.borderColor = '#28a745';
              setTimeout(() => {
                input.style.backgroundColor = originalBg;
                input.style.borderColor = '#ddd';
              }, 1000);
            }
          });
          timeIdInput.style.marginBottom = '8px';
          fieldNameInput.onblur = () => {
            newTime.fieldName = fieldNameInput.value.trim();
            // Update the node ID when field name changes
            const updatedNodeId = generateNodeIdForDropdownField(newTime.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
            newTime.nodeId = updatedNodeId;
            timeIdInput.value = updatedNodeId;
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Delete time button
          const deleteTimeBtn = document.createElement('button');
          deleteTimeBtn.textContent = 'Delete Time';
          deleteTimeBtn.style.cssText = `
            background: #f44336;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
          `;
          deleteTimeBtn.onclick = () => {
            const timeIndex = trigger.times.findIndex(t => t === newTime);
            if (timeIndex !== -1) {
              trigger.times.splice(timeIndex, 1);
            }
            timeContainer.remove();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          contentContainer.appendChild(fieldNameInput);
          contentContainer.appendChild(timeIdInput);
          // Initialize conditional logic if it doesn't exist
          if (!newTime.conditionalLogic) {
            newTime.conditionalLogic = {
              enabled: false,
              conditions: []
            };
          }
          // Enable Conditional Logic checkbox
          const enableConditionalLogicCheckbox = document.createElement('input');
          enableConditionalLogicCheckbox.type = 'checkbox';
          enableConditionalLogicCheckbox.checked = newTime.conditionalLogic.enabled || false;
          enableConditionalLogicCheckbox.style.cssText = `
            margin-bottom: 8px;
          `;
          const enableConditionalLogicLabel = document.createElement('label');
          enableConditionalLogicLabel.textContent = 'Enable Conditional Logic';
          enableConditionalLogicLabel.style.cssText = `
            font-size: 12px;
            margin-left: 4px;
            cursor: pointer;
          `;
          enableConditionalLogicLabel.htmlFor = enableConditionalLogicCheckbox.id || `enableConditionalLogic_${triggerIndex}_${trigger.times.length - 1}`;
          enableConditionalLogicCheckbox.id = enableConditionalLogicLabel.htmlFor;
          const conditionalLogicContainer = document.createElement('div');
          conditionalLogicContainer.style.cssText = `
            margin-bottom: 8px;
            display: flex;
            align-items: center;
          `;
          conditionalLogicContainer.appendChild(enableConditionalLogicCheckbox);
          conditionalLogicContainer.appendChild(enableConditionalLogicLabel);
          // Conditional logic UI container
          const conditionalLogicUIContainer = document.createElement('div');
          conditionalLogicUIContainer.id = `conditionalLogic_${triggerIndex}_${trigger.times.length - 1}`;
          conditionalLogicUIContainer.style.display = newTime.conditionalLogic.enabled ? 'block' : 'none';
          // Function to update conditional logic UI
          const updateConditionalLogicUI = () => {
            conditionalLogicUIContainer.innerHTML = '';
            if (!newTime.conditionalLogic.conditions || newTime.conditionalLogic.conditions.length === 0) {
              newTime.conditionalLogic.conditions = [''];
            }
            const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(trigger, dropdown, cell);
            newTime.conditionalLogic.conditions.forEach((condition, conditionIndex) => {
              const conditionRow = document.createElement('div');
              conditionRow.style.cssText = `
                margin-bottom: 8px;
                display: flex;
                gap: 4px;
                align-items: center;
              `;
              const conditionDropdown = document.createElement('select');
              conditionDropdown.style.cssText = `
                flex: 1;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
              `;
              // Add placeholder option
              const placeholderOption = document.createElement('option');
              placeholderOption.value = '';
              placeholderOption.textContent = 'Select checkbox option...';
              conditionDropdown.appendChild(placeholderOption);
              // Add checkbox option node IDs
              checkboxNodeIds.forEach(nodeId => {
                const option = document.createElement('option');
                option.value = nodeId;
                option.textContent = nodeId;
                if (condition === nodeId) {
                  option.selected = true;
                }
                conditionDropdown.appendChild(option);
              });
              conditionDropdown.value = condition || '';
              conditionDropdown.onchange = () => {
                newTime.conditionalLogic.conditions[conditionIndex] = conditionDropdown.value;
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              const removeConditionBtn = document.createElement('button');
              removeConditionBtn.textContent = '×';
              removeConditionBtn.style.cssText = `
                background: #f44336;
                color: white;
                border: none;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 14px;
                flex-shrink: 0;
              `;
              removeConditionBtn.onclick = () => {
                if (newTime.conditionalLogic.conditions.length > 1) {
                  newTime.conditionalLogic.conditions.splice(conditionIndex, 1);
                  updateConditionalLogicUI();
                  if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                  }
                }
              };
              conditionRow.appendChild(conditionDropdown);
              conditionRow.appendChild(removeConditionBtn);
              conditionalLogicUIContainer.appendChild(conditionRow);
            });
            // Add Another Condition button
            const addConditionBtn = document.createElement('button');
            addConditionBtn.textContent = 'Add Another Condition';
            addConditionBtn.style.cssText = `
              background: #2196F3;
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 3px;
              cursor: pointer;
              font-size: 11px;
              width: 100%;
              margin-top: 4px;
            `;
            addConditionBtn.onclick = () => {
              if (!newTime.conditionalLogic.conditions) {
                newTime.conditionalLogic.conditions = [];
              }
              newTime.conditionalLogic.conditions.push('');
              updateConditionalLogicUI();
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            conditionalLogicUIContainer.appendChild(addConditionBtn);
          };
          enableConditionalLogicCheckbox.onchange = () => {
            newTime.conditionalLogic.enabled = enableConditionalLogicCheckbox.checked;
            conditionalLogicUIContainer.style.display = enableConditionalLogicCheckbox.checked ? 'block' : 'none';
            if (enableConditionalLogicCheckbox.checked && (!newTime.conditionalLogic.conditions || newTime.conditionalLogic.conditions.length === 0)) {
              newTime.conditionalLogic.conditions = [''];
            }
            updateConditionalLogicUI();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Initialize conditional logic UI if enabled
          if (newTime.conditionalLogic.enabled) {
            updateConditionalLogicUI();
          }
          contentContainer.appendChild(conditionalLogicContainer);
          contentContainer.appendChild(conditionalLogicUIContainer);
          contentContainer.appendChild(deleteTimeBtn);
          timeContainer.appendChild(contentContainer);
          // Add drag handlers
          timeContainer.addEventListener('dragstart', (e) => {
            timeContainer.classList.add('dragging');
            timeContainer.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
          });
          timeContainer.addEventListener('dragend', (e) => {
            timeContainer.classList.remove('dragging');
            timeContainer.style.opacity = '1';
          });
          actionsList.appendChild(timeContainer);
          fieldNameInput.focus();
        }
      }
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    const addLocationBtn = document.createElement('button');
    addLocationBtn.textContent = 'Add Location';
    addLocationBtn.style.cssText = `
      background: #ff9800;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    addLocationBtn.onclick = () => {
      // Create new location entry (like the main location button)
      const newLocation = { 
        type: 'location',
        fieldName: 'Location Data Inserted',
        nodeId: ''
      };
      if (!trigger.locations) trigger.locations = [];
      trigger.locations.push(newLocation);
      // Update the actions list for this trigger sequence
      const triggerDiv = addLocationBtn.closest('.trigger-sequence');
      if (triggerDiv) {
        const actionsList = triggerDiv.querySelector('.actions-list');
        if (actionsList) {
          // Create location entry container (styled like main location indicator)
          const locationContainer = document.createElement('div');
          locationContainer.draggable = true;
          locationContainer.dataset.type = 'location';
          locationContainer.dataset.triggerIndex = triggerIndex;
          locationContainer.style.cssText = `
            margin: 8px 0;
            padding: 8px;
            background-color: #e8f5e8;
            border: 2px dashed #28a745;
            border-radius: 4px;
            text-align: center;
            color: #28a745;
            font-weight: bold;
            font-size: 12px;
            cursor: move;
            position: relative;
          `;
          // Add drag handle
          const dragHandle = document.createElement('div');
          dragHandle.textContent = '⋮⋮';
          dragHandle.style.cssText = `
            position: absolute;
            left: 4px;
            top: 50%;
            transform: translateY(-50%);
            cursor: move;
            color: #28a745;
            font-size: 14px;
            user-select: none;
            padding: 2px;
          `;
          locationContainer.appendChild(dragHandle);
          // Create content container
          const contentContainer = document.createElement('div');
          contentContainer.style.cssText = `
            margin-left: 24px;
          `;
          // Location indicator text
          const locationText = document.createElement('div');
          locationText.textContent = '📍 Location Data Inserted';
          locationText.style.cssText = `
            margin-bottom: 8px;
          `;
          // Location title input field
          const locationTitleInput = document.createElement('input');
          locationTitleInput.type = 'text';
          locationTitleInput.placeholder = 'Enter location title...';
          locationTitleInput.value = newLocation.locationTitle || '';
          locationTitleInput.style.cssText = `
            width: 100%;
            max-width: 300px;
            padding: 4px 8px;
            border: 1px solid #28a745;
            border-radius: 3px;
            font-size: 12px;
            margin-top: 8px;
            margin-bottom: 8px;
            text-align: center;
            background: white;
            color: #333;
          `;
          locationTitleInput.onblur = () => {
            newLocation.locationTitle = locationTitleInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Field name input (hidden by default, shown on edit)
          const fieldNameInput = document.createElement('input');
          fieldNameInput.type = 'text';
          fieldNameInput.value = newLocation.fieldName;
          fieldNameInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
            display: none;
          `;
          fieldNameInput.onblur = () => {
            newLocation.fieldName = fieldNameInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Location ID input (hidden by default, shown on edit)
          const locationIdInput = document.createElement('input');
          locationIdInput.type = 'text';
          locationIdInput.placeholder = 'Location ID...';
          locationIdInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
            display: none;
          `;
          locationIdInput.onblur = () => {
            newLocation.nodeId = locationIdInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Button container
          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
          `;
          // Edit button
          const editBtn = document.createElement('button');
          editBtn.textContent = 'Edit';
          editBtn.style.cssText = `
            background-color: #17a2b8;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 10px;
            cursor: pointer;
          `;
          editBtn.onclick = () => {
            if (fieldNameInput.style.display === 'none') {
              fieldNameInput.style.display = 'block';
              locationIdInput.style.display = 'block';
              locationText.style.display = 'none';
              editBtn.textContent = 'Save';
            } else {
              fieldNameInput.style.display = 'none';
              locationIdInput.style.display = 'none';
              locationText.style.display = 'block';
              locationText.textContent = '📍 ' + fieldNameInput.value;
              editBtn.textContent = 'Edit';
            }
          };
          // Delete location button
          const deleteLocationBtn = document.createElement('button');
          deleteLocationBtn.textContent = 'Remove';
          deleteLocationBtn.style.cssText = `
            background-color: #dc3545;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 10px;
            cursor: pointer;
          `;
          deleteLocationBtn.onclick = () => {
            const locationIndex = trigger.locations.findIndex(l => l === newLocation);
            if (locationIndex !== -1) {
              trigger.locations.splice(locationIndex, 1);
            }
            locationContainer.remove();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          buttonContainer.appendChild(editBtn);
          buttonContainer.appendChild(deleteLocationBtn);
          contentContainer.appendChild(locationText);
          contentContainer.appendChild(locationTitleInput);
          contentContainer.appendChild(fieldNameInput);
          contentContainer.appendChild(locationIdInput);
          contentContainer.appendChild(buttonContainer);
          locationContainer.appendChild(contentContainer);
          // Add drag handlers
          locationContainer.addEventListener('dragstart', (e) => {
            locationContainer.classList.add('dragging');
            locationContainer.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
          });
          locationContainer.addEventListener('dragend', (e) => {
            locationContainer.classList.remove('dragging');
            locationContainer.style.opacity = '1';
          });
          actionsList.appendChild(locationContainer);
        }
      }
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    const addPdfBtn = document.createElement('button');
    addPdfBtn.textContent = 'Add PDF';
    addPdfBtn.style.cssText = `
      background: #e91e63;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    addPdfBtn.onclick = () => {
      // Create new PDF entry
      const newPdf = {
        triggerNumber: '',
        pdfTitle: '',
        pdfFilename: '',
        pdfPriceId: ''
      };
      if (!trigger.pdfs) trigger.pdfs = [];
      trigger.pdfs.push(newPdf);
      // Update the actions list for this trigger sequence
      const triggerDiv = addPdfBtn.closest('.trigger-sequence');
      if (triggerDiv) {
        const actionsList = triggerDiv.querySelector('.actions-list');
        if (actionsList) {
          // Create PDF entry container
          const pdfContainer = document.createElement('div');
          pdfContainer.draggable = true;
          pdfContainer.dataset.type = 'pdf';
          pdfContainer.dataset.triggerIndex = triggerIndex;
          pdfContainer.style.cssText = `
            margin-bottom: 10px;
            padding: 8px;
            background: #fce4ec;
            border: 1px solid #e91e63;
            border-radius: 4px;
            cursor: move;
            position: relative;
          `;
          // Add drag handle
          const dragHandle = document.createElement('div');
          dragHandle.textContent = '⋮⋮';
          dragHandle.style.cssText = `
            position: absolute;
            left: 4px;
            top: 50%;
            transform: translateY(-50%);
            cursor: move;
            color: #e91e63;
            font-size: 14px;
            user-select: none;
            padding: 2px;
          `;
          pdfContainer.appendChild(dragHandle);
          // Create content container
          const contentContainer = document.createElement('div');
          contentContainer.style.cssText = `
            margin-left: 24px;
          `;
          // Trigger number input
          const triggerNumberInput = document.createElement('input');
          triggerNumberInput.type = 'text';
          triggerNumberInput.placeholder = 'Trigger number...';
          triggerNumberInput.value = newPdf.triggerNumber || '';
          triggerNumberInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
          `;
          triggerNumberInput.onblur = () => {
            newPdf.triggerNumber = triggerNumberInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // PDF title input
          const pdfTitleInput = document.createElement('input');
          pdfTitleInput.type = 'text';
          pdfTitleInput.placeholder = 'PDF title...';
          pdfTitleInput.value = newPdf.pdfTitle || '';
          pdfTitleInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
          `;
          pdfTitleInput.onblur = () => {
            newPdf.pdfTitle = pdfTitleInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // PDF filename input
          const pdfFilenameInput = document.createElement('input');
          pdfFilenameInput.type = 'text';
          pdfFilenameInput.placeholder = 'PDF filename...';
          pdfFilenameInput.value = newPdf.pdfFilename || '';
          pdfFilenameInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
          `;
          pdfFilenameInput.onblur = () => {
            newPdf.pdfFilename = pdfFilenameInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // PDF price ID input
          const pdfPriceIdInput = document.createElement('input');
          pdfPriceIdInput.type = 'text';
          pdfPriceIdInput.placeholder = 'PDF price ID...';
          pdfPriceIdInput.value = newPdf.pdfPriceId || '';
          pdfPriceIdInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
          `;
          pdfPriceIdInput.onblur = () => {
            newPdf.pdfPriceId = pdfPriceIdInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Delete PDF button
          const deletePdfBtn = document.createElement('button');
          deletePdfBtn.textContent = 'Delete PDF';
          deletePdfBtn.style.cssText = `
            background: #f44336;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
          `;
          deletePdfBtn.onclick = () => {
            const pdfIndex = trigger.pdfs.findIndex(p => p === newPdf);
            if (pdfIndex !== -1) {
              trigger.pdfs.splice(pdfIndex, 1);
            }
            pdfContainer.remove();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          contentContainer.appendChild(triggerNumberInput);
          contentContainer.appendChild(pdfTitleInput);
          contentContainer.appendChild(pdfFilenameInput);
          contentContainer.appendChild(pdfPriceIdInput);
          contentContainer.appendChild(deletePdfBtn);
          pdfContainer.appendChild(contentContainer);
          // Add drag handlers
          pdfContainer.addEventListener('dragstart', (e) => {
            pdfContainer.classList.add('dragging');
            pdfContainer.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
          });
          pdfContainer.addEventListener('dragend', (e) => {
            pdfContainer.classList.remove('dragging');
            pdfContainer.style.opacity = '1';
          });
          actionsList.appendChild(pdfContainer);
          triggerNumberInput.focus();
        }
      }
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    const addDropdownBtn = document.createElement('button');
    addDropdownBtn.textContent = 'Add Dropdown';
    addDropdownBtn.style.cssText = `
      background: #17a2b8;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    addDropdownBtn.onclick = () => {
      // Create new dropdown entry
      const newDropdown = {
        fieldName: '',
        options: []
      };
      if (!trigger.dropdowns) trigger.dropdowns = [];
      trigger.dropdowns.push(newDropdown);
      // Update the actions list for this trigger sequence
      const triggerDiv = addDropdownBtn.closest('.trigger-sequence');
      if (triggerDiv) {
        const actionsList = triggerDiv.querySelector('.actions-list');
        if (actionsList) {
          // Create dropdown entry container
          const dropdownContainer = document.createElement('div');
          dropdownContainer.draggable = true;
          dropdownContainer.dataset.type = 'dropdown';
          dropdownContainer.dataset.triggerIndex = triggerIndex;
          dropdownContainer.style.cssText = `
            margin-bottom: 10px;
            padding: 8px;
            background: #e0f7fa;
            border: 1px solid #17a2b8;
            border-radius: 4px;
            cursor: move;
            position: relative;
          `;
          // Add drag handle
          const dragHandle = document.createElement('div');
          dragHandle.innerHTML = '⋮⋮';
          dragHandle.style.cssText = `
            position: absolute;
            left: 4px;
            top: 50%;
            transform: translateY(-50%);
            cursor: move;
            color: #17a2b8;
            font-size: 14px;
            user-select: none;
            padding: 2px;
          `;
          dropdownContainer.appendChild(dragHandle);
          // Create content container
          const contentContainer = document.createElement('div');
          contentContainer.style.cssText = `
            margin-left: 24px;
          `;
          // Field name input
          const fieldNameInput = document.createElement('input');
          fieldNameInput.type = 'text';
          fieldNameInput.placeholder = 'Enter dropdown question title...';
          fieldNameInput.style.cssText = `
            width: 100%;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            margin-bottom: 8px;
          `;
          fieldNameInput.onblur = () => {
            newDropdown.fieldName = fieldNameInput.value.trim();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Add option button
          const addOptionBtn = document.createElement('button');
          addOptionBtn.textContent = 'Add option';
          addOptionBtn.style.cssText = `
            background: #17a2b8;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            margin-bottom: 8px;
          `;
          // Options container
          const optionsContainer = document.createElement('div');
          optionsContainer.className = 'dropdown-options-container';
          optionsContainer.style.cssText = `
            margin-bottom: 8px;
          `;
          addOptionBtn.onclick = () => {
            const newOption = { text: '' };
            newDropdown.options.push(newOption);
            // Create option input
            const optionDiv = document.createElement('div');
            optionDiv.style.cssText = `
              display: flex;
              gap: 4px;
              margin-bottom: 4px;
              align-items: center;
            `;
            const optionInput = document.createElement('input');
            optionInput.type = 'text';
            optionInput.placeholder = 'Enter option text...';
            optionInput.style.cssText = `
              flex: 1;
              padding: 4px 8px;
              border: 1px solid #ddd;
              border-radius: 3px;
              font-size: 12px;
            `;
            optionInput.value = newOption.text || '';
            optionInput.onblur = () => {
              newOption.text = optionInput.value.trim();
              // Refresh all conditional logic UIs in this trigger sequence when options change
              const triggerDiv = addDropdownBtn.closest('.trigger-sequence');
              if (triggerDiv) {
                const allConditionalLogicContainers = triggerDiv.querySelectorAll('[id^="conditionalLogicDropdown_"]');
                allConditionalLogicContainers.forEach(container => {
                  if (container._updateConditionalLogicUI) {
                    container._updateConditionalLogicUI();
                  }
                });
              }
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            optionInput.oninput = () => {
              // Also refresh on input for real-time updates
              const triggerDiv = addDropdownBtn.closest('.trigger-sequence');
              if (triggerDiv) {
                const allConditionalLogicContainers = triggerDiv.querySelectorAll('[id^="conditionalLogicDropdown_"]');
                allConditionalLogicContainers.forEach(container => {
                  if (container._updateConditionalLogicUI) {
                    container._updateConditionalLogicUI();
                  }
                });
              }
            };
            const deleteOptionBtn = document.createElement('button');
            deleteOptionBtn.textContent = '×';
            deleteOptionBtn.style.cssText = `
              background: #f44336;
              color: white;
              border: none;
              padding: 2px 6px;
              border-radius: 3px;
              cursor: pointer;
              font-size: 14px;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
            `;
            deleteOptionBtn.onclick = () => {
              const optionIndex = newDropdown.options.findIndex(o => o === newOption);
              if (optionIndex !== -1) {
                newDropdown.options.splice(optionIndex, 1);
              }
              optionDiv.remove();
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            optionDiv.appendChild(optionInput);
            optionDiv.appendChild(deleteOptionBtn);
            optionsContainer.appendChild(optionDiv);
            optionInput.focus();
          };
          // Delete dropdown button
          const deleteDropdownBtn = document.createElement('button');
          deleteDropdownBtn.textContent = 'Delete Dropdown';
          deleteDropdownBtn.style.cssText = `
            background: #f44336;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
          `;
          deleteDropdownBtn.onclick = () => {
            const dropdownIndex = trigger.dropdowns.findIndex(d => d === newDropdown);
            if (dropdownIndex !== -1) {
              trigger.dropdowns.splice(dropdownIndex, 1);
            }
            dropdownContainer.remove();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Initialize conditional logic if it doesn't exist
          if (!newDropdown.conditionalLogic) {
            newDropdown.conditionalLogic = {
              enabled: false,
              conditions: []
            };
          }
          // Enable Conditional Logic checkbox
          const enableConditionalLogicCheckbox = document.createElement('input');
          enableConditionalLogicCheckbox.type = 'checkbox';
          enableConditionalLogicCheckbox.checked = newDropdown.conditionalLogic.enabled || false;
          enableConditionalLogicCheckbox.style.cssText = `
            margin-bottom: 8px;
          `;
          const enableConditionalLogicLabel = document.createElement('label');
          enableConditionalLogicLabel.textContent = 'Enable Conditional Logic';
          enableConditionalLogicLabel.style.cssText = `
            font-size: 12px;
            margin-left: 4px;
            cursor: pointer;
          `;
          enableConditionalLogicLabel.htmlFor = enableConditionalLogicCheckbox.id || `enableConditionalLogicDropdown_${triggerIndex}_${trigger.dropdowns.length - 1}`;
          enableConditionalLogicCheckbox.id = enableConditionalLogicLabel.htmlFor;
          const conditionalLogicContainer = document.createElement('div');
          conditionalLogicContainer.style.cssText = `
            margin-bottom: 8px;
            display: flex;
            align-items: center;
          `;
          conditionalLogicContainer.appendChild(enableConditionalLogicCheckbox);
          conditionalLogicContainer.appendChild(enableConditionalLogicLabel);
          // Conditional logic UI container
          const conditionalLogicUIContainer = document.createElement('div');
          conditionalLogicUIContainer.id = `conditionalLogicDropdown_${triggerIndex}_${trigger.dropdowns.length - 1}`;
          conditionalLogicUIContainer.style.display = newDropdown.conditionalLogic.enabled ? 'block' : 'none';
          // Function to update conditional logic UI
          const updateConditionalLogicUI = () => {
            conditionalLogicUIContainer.innerHTML = '';
            if (!newDropdown.conditionalLogic.conditions || newDropdown.conditionalLogic.conditions.length === 0) {
              newDropdown.conditionalLogic.conditions = [''];
            }
            // Store reference to this function on the container so it can be called when options change
            conditionalLogicUIContainer._updateConditionalLogicUI = updateConditionalLogicUI;
            const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(trigger, dropdown, cell);
            newDropdown.conditionalLogic.conditions.forEach((condition, conditionIndex) => {
              const conditionRow = document.createElement('div');
              conditionRow.style.cssText = `
                margin-bottom: 8px;
                display: flex;
                gap: 4px;
                align-items: center;
              `;
              const conditionDropdown = document.createElement('select');
              conditionDropdown.style.cssText = `
                flex: 1;
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 12px;
              `;
              // Add placeholder option
              const placeholderOption = document.createElement('option');
              placeholderOption.value = '';
              placeholderOption.textContent = 'Select checkbox option...';
              conditionDropdown.appendChild(placeholderOption);
              // Add checkbox option node IDs
              checkboxNodeIds.forEach(nodeId => {
                const option = document.createElement('option');
                option.value = nodeId;
                option.textContent = nodeId;
                if (condition === nodeId) {
                  option.selected = true;
                }
                conditionDropdown.appendChild(option);
              });
              conditionDropdown.value = condition || '';
              conditionDropdown.onchange = () => {
                newDropdown.conditionalLogic.conditions[conditionIndex] = conditionDropdown.value;
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              };
              const removeConditionBtn = document.createElement('button');
              removeConditionBtn.textContent = '×';
              removeConditionBtn.style.cssText = `
                background: #f44336;
                color: white;
                border: none;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 14px;
                flex-shrink: 0;
              `;
              removeConditionBtn.onclick = () => {
                if (newDropdown.conditionalLogic.conditions.length > 1) {
                  newDropdown.conditionalLogic.conditions.splice(conditionIndex, 1);
                  updateConditionalLogicUI();
                  if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                  }
                }
              };
              conditionRow.appendChild(conditionDropdown);
              conditionRow.appendChild(removeConditionBtn);
              conditionalLogicUIContainer.appendChild(conditionRow);
            });
            // Add Another Condition button
            const addConditionBtn = document.createElement('button');
            addConditionBtn.textContent = 'Add Another Condition';
            addConditionBtn.style.cssText = `
              background: #2196F3;
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 3px;
              cursor: pointer;
              font-size: 11px;
              width: 100%;
              margin-top: 4px;
            `;
            addConditionBtn.onclick = () => {
              if (!newDropdown.conditionalLogic.conditions) {
                newDropdown.conditionalLogic.conditions = [];
              }
              newDropdown.conditionalLogic.conditions.push('');
              updateConditionalLogicUI();
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            conditionalLogicUIContainer.appendChild(addConditionBtn);
          };
          enableConditionalLogicCheckbox.onchange = () => {
            newDropdown.conditionalLogic.enabled = enableConditionalLogicCheckbox.checked;
            conditionalLogicUIContainer.style.display = enableConditionalLogicCheckbox.checked ? 'block' : 'none';
            if (enableConditionalLogicCheckbox.checked && (!newDropdown.conditionalLogic.conditions || newDropdown.conditionalLogic.conditions.length === 0)) {
              newDropdown.conditionalLogic.conditions = [''];
            }
            updateConditionalLogicUI();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Initialize conditional logic UI if enabled
          if (newDropdown.conditionalLogic.enabled) {
            updateConditionalLogicUI();
          }
          contentContainer.appendChild(fieldNameInput);
          contentContainer.appendChild(addOptionBtn);
          contentContainer.appendChild(optionsContainer);
          contentContainer.appendChild(conditionalLogicContainer);
          contentContainer.appendChild(conditionalLogicUIContainer);
          contentContainer.appendChild(deleteDropdownBtn);
          dropdownContainer.appendChild(contentContainer);
          // Add drag handlers
          dropdownContainer.addEventListener('dragstart', (e) => {
            dropdownContainer.classList.add('dragging');
            dropdownContainer.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({
              type: 'dropdown',
              triggerIndex: triggerIndex,
              dropdownIndex: trigger.dropdowns.indexOf(newDropdown)
            }));
          });
          dropdownContainer.addEventListener('dragend', (e) => {
            dropdownContainer.classList.remove('dragging');
            dropdownContainer.style.opacity = '1';
          });
          actionsList.appendChild(dropdownContainer);
          fieldNameInput.focus();
        }
      }
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    actionButtons.appendChild(addLabelBtn);
    actionButtons.appendChild(addCheckboxBtn);
    actionButtons.appendChild(addTimeBtn);
    actionButtons.appendChild(addDropdownBtn);
    actionButtons.appendChild(addLocationBtn);
    actionButtons.appendChild(addPdfBtn);
    triggerDiv.appendChild(actionButtons);
    // Display existing actions using the new enhanced structure
    const actionsList = document.createElement('div');
    actionsList.className = 'actions-list';
    actionsList.style.cssText = `
      margin-top: 5px;
    `;
    // Add drop handlers to actionsList for reordering entries
    actionsList.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const afterElement = getDragAfterElement(actionsList, e.clientY);
      const dragging = document.querySelector('.dragging');
      if (afterElement == null) {
        actionsList.appendChild(dragging);
      } else {
        actionsList.insertBefore(dragging, afterElement);
      }
    });
    actionsList.addEventListener('drop', (e) => {
      e.preventDefault();
      const dragging = document.querySelector('.dragging');
      if (dragging) {
        dragging.classList.remove('dragging');
        dragging.style.opacity = '1';
        // Save the new order by reordering the underlying arrays
        saveTriggerSequenceOrder(actionsList, trigger);
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      }
    });
    function getDragAfterElement(container, y) {
      const draggableElements = [...container.querySelectorAll(':not(.dragging)[draggable="true"]')];
      return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    // Map to store entry containers by type and identifier for unified ordering
    const entryContainersMap = new Map();
    // Helper to store a container in the map
    const storeEntryContainer = (type, identifier, container) => {
      const key = `${type}_${identifier}`;
      entryContainersMap.set(key, container);
    };
    // Display existing entries - create containers and store them for later appending
    // Display existing labels
      if (trigger.labels && trigger.labels.length > 0) {
        trigger.labels.forEach((label, labelIndex) => {
        const labelContainer = document.createElement('div');
        labelContainer.draggable = true;
        labelContainer.dataset.type = 'label';
        labelContainer.dataset.triggerIndex = triggerIndex;
        labelContainer.style.cssText = `
          margin-bottom: 10px;
          padding: 8px;
          background: #e8f5e8;
          border: 1px solid #4caf50;
          border-radius: 4px;
          cursor: move;
          position: relative;
        `;
        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.textContent = '⋮⋮';
        dragHandle.style.cssText = `
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          cursor: move;
          color: #4caf50;
          font-size: 14px;
          user-select: none;
          padding: 2px;
        `;
        labelContainer.appendChild(dragHandle);
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
          margin-left: 24px;
        `;
        const fieldNameInput = document.createElement('input');
        fieldNameInput.type = 'text';
        fieldNameInput.value = label.fieldName || '';
        fieldNameInput.placeholder = 'Enter label field name...';
        fieldNameInput.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
        `;
        fieldNameInput.oninput = () => {
          // Update the node ID dynamically as the user types
          const updatedNodeId = generateNodeIdForDropdownField(fieldNameInput.value.trim() || '', dropdown.name || '', cell, trigger.triggerOption || '');
          label.nodeId = updatedNodeId;
          labelIdInput.value = updatedNodeId;
        };
        fieldNameInput.onblur = () => {
          label.fieldName = fieldNameInput.value.trim();
          // Update the node ID when field name changes
          const updatedNodeId = generateNodeIdForDropdownField(label.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
          label.nodeId = updatedNodeId;
          labelIdInput.value = updatedNodeId;
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Label ID input (uneditable and autofilled)
        // Auto-fix incorrect node IDs when menu opens
        const correctLabelId = generateNodeIdForDropdownField(label.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
        const labelIdValue = (label.nodeId && label.nodeId === correctLabelId) ? label.nodeId : correctLabelId;
        label.nodeId = labelIdValue; // Ensure the nodeId is set in the data
        const labelIdInput = createUneditableNodeIdInput('Label ID...', labelIdValue, (input) => {
          // Double-click to copy functionality
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(input.value).then(() => {
              // Show visual feedback
              const originalBg = input.style.backgroundColor;
              input.style.backgroundColor = '#d4edda';
              input.style.borderColor = '#28a745';
              setTimeout(() => {
                input.style.backgroundColor = originalBg;
                input.style.borderColor = '#ddd';
              }, 1000);
            });
          } else {
            // Fallback for older browsers
            input.select();
            document.execCommand('copy');
            const originalBg = input.style.backgroundColor;
            input.style.backgroundColor = '#d4edda';
            input.style.borderColor = '#28a745';
            setTimeout(() => {
              input.style.backgroundColor = originalBg;
              input.style.borderColor = '#ddd';
            }, 1000);
          }
        });
        labelIdInput.style.marginBottom = '8px';
        const deleteLabelBtn = document.createElement('button');
        deleteLabelBtn.textContent = 'Delete Label';
        deleteLabelBtn.style.cssText = `
          background: #f44336;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        deleteLabelBtn.onclick = () => {
          trigger.labels.splice(labelIndex, 1);
          labelContainer.remove();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        contentContainer.appendChild(fieldNameInput);
        contentContainer.appendChild(labelIdInput);
        contentContainer.appendChild(deleteLabelBtn);
        // Copy ID button for existing label (positioned after delete button)
        const copyLabelIdBtn = document.createElement('button');
        copyLabelIdBtn.textContent = 'Copy ID';
        copyLabelIdBtn.style.cssText = `
          background: #17a2b8;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          margin-bottom: 8px;
          width: 100%;
        `;
        copyLabelIdBtn.onclick = () => {
          const number = prompt('Enter number:', '1');
          if (number !== null && number !== '') {
            const nodeIdWithNumber = `${labelIdInput.value}_${number}`;
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(nodeIdWithNumber).then(() => {
                copyLabelIdBtn.textContent = 'Copied!';
                copyLabelIdBtn.style.background = '#28a745';
                setTimeout(() => {
                  copyLabelIdBtn.textContent = 'Copy ID';
                  copyLabelIdBtn.style.background = '#17a2b8';
                }, 1500);
              });
            } else {
              const textArea = document.createElement('textarea');
              textArea.value = nodeIdWithNumber;
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand('copy');
              document.body.removeChild(textArea);
              copyLabelIdBtn.textContent = 'Copied!';
              copyLabelIdBtn.style.background = '#28a745';
              setTimeout(() => {
                copyLabelIdBtn.textContent = 'Copy ID';
                copyLabelIdBtn.style.background = '#17a2b8';
              }, 1500);
            }
          }
        };
        contentContainer.appendChild(copyLabelIdBtn);
        labelContainer.appendChild(contentContainer);
        // Add drag handlers
        labelContainer.addEventListener('dragstart', (e) => {
          labelContainer.classList.add('dragging');
          labelContainer.style.opacity = '0.5';
          e.dataTransfer.effectAllowed = 'move';
        });
        labelContainer.addEventListener('dragend', (e) => {
          labelContainer.classList.remove('dragging');
          labelContainer.style.opacity = '1';
        });
        // Store in map instead of appending directly
        storeEntryContainer('label', label.fieldName || '', labelContainer);
      });
    }
    // Display existing checkboxes
    if (trigger.checkboxes && trigger.checkboxes.length > 0) {
      trigger.checkboxes.forEach((checkbox, checkboxIndex) => {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.draggable = true;
        checkboxContainer.dataset.type = 'checkbox';
        checkboxContainer.dataset.triggerIndex = triggerIndex;
        checkboxContainer.style.cssText = `
          margin-bottom: 10px;
          padding: 8px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          cursor: move;
          position: relative;
        `;
        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.textContent = '⋮⋮';
        dragHandle.style.cssText = `
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          cursor: move;
          color: #9c27b0;
          font-size: 14px;
          user-select: none;
          padding: 2px;
        `;
        checkboxContainer.appendChild(dragHandle);
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
          margin-left: 24px;
        `;
        const fieldNameInput = document.createElement('input');
        fieldNameInput.type = 'text';
        fieldNameInput.value = checkbox.fieldName || '';
        fieldNameInput.placeholder = 'Enter checkbox field name...';
        fieldNameInput.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
        `;
        // Update all checkbox option node IDs in real-time as user types field name
        const updateCheckboxFieldNameAndNodeIds = () => {
          checkbox.fieldName = fieldNameInput.value.trim();
          // Update all checkbox option node IDs when field name changes
          if (checkbox.options && checkbox.options.length > 0) {
            checkbox.options.forEach((option, optionIndex) => {
              const combinedFieldName = `${checkbox.fieldName}_${option.checkboxText || ''}`;
              const updatedNodeId = generateNodeIdForDropdownField(combinedFieldName, dropdown.name || '', cell, trigger.triggerOption || '');
              option.nodeId = updatedNodeId;
              // Update the checkbox ID input in the UI if it exists
              const checkboxOptionEntry = checkboxContainer.querySelector(`[data-option-index="${optionIndex}"]`);
              if (checkboxOptionEntry) {
                const optionIdInput = checkboxOptionEntry.querySelector('input[placeholder*="Checkbox ID"]');
                if (optionIdInput) {
                  optionIdInput.value = updatedNodeId;
                }
              }
            });
          }
        };
        // Update on input (real-time as user types)
        fieldNameInput.oninput = updateCheckboxFieldNameAndNodeIds;
        // Also update on blur (for final save)
        fieldNameInput.onblur = () => {
          updateCheckboxFieldNameAndNodeIds();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Selection type dropdown
        const selectionTypeLabel = document.createElement('label');
        selectionTypeLabel.textContent = 'Selection Type:';
        selectionTypeLabel.style.cssText = `
          display: block;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 4px;
          color: #333;
        `;
        const selectionTypeSelect = document.createElement('select');
        selectionTypeSelect.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
          background: white;
        `;
        const markAllOption = document.createElement('option');
        markAllOption.value = 'multiple';
        markAllOption.textContent = 'Mark All That Apply';
        const markOneOption = document.createElement('option');
        markOneOption.value = 'single';
        markOneOption.textContent = 'Mark Only One';
        selectionTypeSelect.appendChild(markAllOption);
        selectionTypeSelect.appendChild(markOneOption);
        // Set the current selection type
        selectionTypeSelect.value = checkbox.selectionType || 'multiple';
        selectionTypeSelect.onchange = () => {
          checkbox.selectionType = selectionTypeSelect.value;
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Required type dropdown
        const requiredTypeLabel = document.createElement('label');
        requiredTypeLabel.textContent = 'Required Type:';
        requiredTypeLabel.style.cssText = `
          display: block;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 4px;
          color: #333;
        `;
        const requiredTypeSelect = document.createElement('select');
        requiredTypeSelect.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
          background: white;
        `;
        const requiredOption = document.createElement('option');
        requiredOption.value = 'required';
        requiredOption.textContent = 'Required';
        const optionalOption = document.createElement('option');
        optionalOption.value = 'optional';
        optionalOption.textContent = 'Optional';
        requiredTypeSelect.appendChild(requiredOption);
        requiredTypeSelect.appendChild(optionalOption);
        // Initialize required type
        if (!checkbox.required) {
          checkbox.required = 'required';
        }
        requiredTypeSelect.value = checkbox.required;
        requiredTypeSelect.onchange = () => {
          checkbox.required = requiredTypeSelect.value;
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Add checkbox option button (should be after field name, before options)
        const addCheckboxOptionBtn = document.createElement('button');
        addCheckboxOptionBtn.textContent = 'Add checkbox option';
        addCheckboxOptionBtn.style.cssText = `
          background: #6f42c1;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          margin-bottom: 8px;
        `;
        addCheckboxOptionBtn.onclick = () => {
          const newOption = { checkboxText: '', nodeId: '' };
          if (!checkbox.options) checkbox.options = [];
          checkbox.options.push(newOption);
          // Create mini checkbox option entry
          const miniOptionEntry = document.createElement('div');
          const optionIndex = checkbox.options.length - 1; // Get the index of this option
          miniOptionEntry.dataset.optionIndex = optionIndex;
          miniOptionEntry.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 3px;
            margin-bottom: 4px;
          `;
          const checkboxTextInput = document.createElement('input');
          checkboxTextInput.type = 'text';
          checkboxTextInput.placeholder = 'Checkbox text...';
          checkboxTextInput.style.cssText = `
            flex: 1;
            padding: 2px 4px;
            border: 1px solid #ddd;
            border-radius: 2px;
            font-size: 11px;
          `;
          // Update node ID in real-time as user types
          const updateCheckboxOptionNodeId = () => {
            newOption.checkboxText = checkboxTextInput.value.trim();
            // Update the node ID when checkbox text changes
            const combinedFieldName = `${checkbox.fieldName}_${newOption.checkboxText || ''}`;
            const updatedNodeId = generateNodeIdForDropdownField(combinedFieldName, dropdown.name || '', cell, trigger.triggerOption || '');
            newOption.nodeId = updatedNodeId;
            checkboxIdInput.value = updatedNodeId;
          };
          // Update on input (real-time as user types)
          checkboxTextInput.oninput = updateCheckboxOptionNodeId;
          // Also update on blur (for final save)
          checkboxTextInput.onblur = () => {
            updateCheckboxOptionNodeId();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          const checkboxIdInput = createUneditableNodeIdInput('Checkbox ID...', '', (input) => {
            // Double-click to copy functionality
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(input.value).then(() => {
                // Show visual feedback
                const originalBg = input.style.backgroundColor;
                input.style.backgroundColor = '#d4edda';
                input.style.borderColor = '#28a745';
                setTimeout(() => {
                  input.style.backgroundColor = originalBg;
                  input.style.borderColor = '#ddd';
                }, 1000);
              });
            } else {
              // Fallback for older browsers
              input.select();
              document.execCommand('copy');
              const originalBg = input.style.backgroundColor;
              input.style.backgroundColor = '#d4edda';
              input.style.borderColor = '#28a745';
              setTimeout(() => {
                input.style.backgroundColor = originalBg;
                input.style.borderColor = '#ddd';
              }, 1000);
            }
          });
          checkboxIdInput.style.cssText = `
            flex: 1;
            padding: 2px 4px;
            border: 1px solid #ddd;
            border-radius: 2px;
            font-size: 11px;
            background-color: #f8f9fa;
            cursor: pointer;
          `;
          // Initialize the node ID
          updateCheckboxOptionNodeId();
          const deleteOptionBtn = document.createElement('button');
          deleteOptionBtn.textContent = '×';
          deleteOptionBtn.style.cssText = `
            background: #f44336;
            color: white;
            border: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 10px;
          `;
          deleteOptionBtn.onclick = () => {
            const optionIndex = checkbox.options.findIndex(opt => opt === newOption);
            if (optionIndex !== -1) {
              checkbox.options.splice(optionIndex, 1);
            }
            miniOptionEntry.remove();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          // Copy ID button for existing checkbox option
          const copyCheckboxIdBtn = document.createElement('button');
          copyCheckboxIdBtn.textContent = 'Copy ID';
          copyCheckboxIdBtn.style.cssText = `
            background: #17a2b8;
            color: white;
            border: none;
            padding: 2px 4px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 10px;
            margin-left: 4px;
          `;
          copyCheckboxIdBtn.onclick = () => {
            const number = prompt('Enter number:', '1');
            if (number !== null && number !== '') {
              const nodeIdWithNumber = `${checkboxIdInput.value}_${number}`;
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(nodeIdWithNumber).then(() => {
                  copyCheckboxIdBtn.textContent = 'Copied!';
                  copyCheckboxIdBtn.style.background = '#28a745';
                  setTimeout(() => {
                    copyCheckboxIdBtn.textContent = 'Copy ID';
                    copyCheckboxIdBtn.style.background = '#17a2b8';
                  }, 1500);
                });
              } else {
                const textArea = document.createElement('textarea');
                textArea.value = nodeIdWithNumber;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                copyCheckboxIdBtn.textContent = 'Copied!';
                copyCheckboxIdBtn.style.background = '#28a745';
                setTimeout(() => {
                  copyCheckboxIdBtn.textContent = 'Copy ID';
                  copyCheckboxIdBtn.style.background = '#17a2b8';
                }, 1500);
              }
            }
          };
          miniOptionEntry.appendChild(checkboxTextInput);
          miniOptionEntry.appendChild(checkboxIdInput);
          miniOptionEntry.appendChild(copyCheckboxIdBtn);
          miniOptionEntry.appendChild(deleteOptionBtn);
          // Insert the new option before the delete button in contentContainer
          // Find the delete button by searching for a button with "Delete Checkbox" text
          const allButtons = Array.from(contentContainer.querySelectorAll('button'));
          const deleteCheckboxBtn = allButtons.find(btn => btn.textContent.trim() === 'Delete Checkbox');
          if (deleteCheckboxBtn) {
            contentContainer.insertBefore(miniOptionEntry, deleteCheckboxBtn);
          } else {
            // Fallback: append to contentContainer if delete button not found yet
            contentContainer.appendChild(miniOptionEntry);
          }
          checkboxTextInput.focus();
        };
        const deleteCheckboxBtn = document.createElement('button');
        deleteCheckboxBtn.textContent = 'Delete Checkbox';
        deleteCheckboxBtn.style.cssText = `
          background: #f44336;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        deleteCheckboxBtn.onclick = () => {
          trigger.checkboxes.splice(checkboxIndex, 1);
          checkboxContainer.remove();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Correct order: field name, selection type, add button, options, delete button
        contentContainer.appendChild(fieldNameInput);
        contentContainer.appendChild(selectionTypeLabel);
        contentContainer.appendChild(selectionTypeSelect);
        contentContainer.appendChild(requiredTypeLabel);
        contentContainer.appendChild(requiredTypeSelect);
        contentContainer.appendChild(addCheckboxOptionBtn);
        // Add existing checkbox options BEFORE the delete button
        if (checkbox.options && checkbox.options.length > 0) {
          checkbox.options.forEach((option, optionIndex) => {
            const optionDiv = document.createElement('div');
            optionDiv.dataset.optionIndex = optionIndex; // Add data attribute for finding this option
            optionDiv.style.cssText = `
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 4px 8px;
              background: white;
              border: 1px solid #ddd;
              border-radius: 3px;
              margin-bottom: 4px;
            `;
            const checkboxTextInput = document.createElement('input');
            checkboxTextInput.type = 'text';
            checkboxTextInput.value = option.checkboxText || '';
            checkboxTextInput.placeholder = 'Checkbox text...';
            checkboxTextInput.style.cssText = `
              flex: 1;
              padding: 2px 4px;
              border: 1px solid #ddd;
              border-radius: 2px;
              font-size: 11px;
            `;
            // Update node ID in real-time as user types
            const updateCheckboxOptionNodeId = () => {
              option.checkboxText = checkboxTextInput.value.trim();
              // Update the node ID when checkbox text changes
              const combinedFieldName = `${checkbox.fieldName}_${option.checkboxText || ''}`;
              const updatedNodeId = generateNodeIdForDropdownField(combinedFieldName, dropdown.name || '', cell, trigger.triggerOption || '');
              option.nodeId = updatedNodeId;
              checkboxIdInput.value = updatedNodeId;
            };
            // Update on input (real-time as user types)
            checkboxTextInput.oninput = updateCheckboxOptionNodeId;
            // Also update on blur (for final save)
            checkboxTextInput.onblur = () => {
              updateCheckboxOptionNodeId();
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
          // Checkbox ID input (uneditable and autofilled)
          // For checkbox options, we need to include both the field name and the option text
          const checkboxFieldName = checkbox.fieldName || '';
          const checkboxOptionText = option.checkboxText || '';
          const combinedFieldName = `${checkboxFieldName}_${checkboxOptionText}`;
          // Auto-fix incorrect node IDs when menu opens
          const correctCheckboxId = generateNodeIdForDropdownField(combinedFieldName, dropdown.name || '', cell, trigger.triggerOption || '');
          const checkboxIdValue = (option.nodeId && option.nodeId === correctCheckboxId) ? option.nodeId : correctCheckboxId;
          option.nodeId = checkboxIdValue; // Ensure the nodeId is set in the data
          const checkboxIdInput = createUneditableNodeIdInput('Checkbox ID...', checkboxIdValue, (input) => {
            // Double-click to copy functionality
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(input.value).then(() => {
                // Show visual feedback
                const originalBg = input.style.backgroundColor;
                input.style.backgroundColor = '#d4edda';
                input.style.borderColor = '#28a745';
                setTimeout(() => {
                  input.style.backgroundColor = originalBg;
                  input.style.borderColor = '#ddd';
                }, 1000);
              });
            } else {
              // Fallback for older browsers
              input.select();
              document.execCommand('copy');
              const originalBg = input.style.backgroundColor;
              input.style.backgroundColor = '#d4edda';
              input.style.borderColor = '#28a745';
              setTimeout(() => {
                input.style.backgroundColor = originalBg;
                input.style.borderColor = '#ddd';
              }, 1000);
            }
          });
          checkboxIdInput.style.cssText = `
            flex: 1;
            padding: 2px 4px;
            border: 1px solid #ddd;
            border-radius: 2px;
            font-size: 11px;
            background-color: #f8f9fa;
            cursor: pointer;
          `;
            const deleteOptionBtn = document.createElement('button');
            deleteOptionBtn.textContent = '×';
            deleteOptionBtn.style.cssText = `
              background: #f44336;
              color: white;
              border: none;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              cursor: pointer;
              font-size: 10px;
            `;
            deleteOptionBtn.onclick = () => {
              checkbox.options.splice(optionIndex, 1);
              optionDiv.remove();
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            // Copy ID button for existing checkbox option
            const copyCheckboxIdBtn = document.createElement('button');
            copyCheckboxIdBtn.textContent = 'Copy ID';
            copyCheckboxIdBtn.style.cssText = `
              background: #17a2b8;
              color: white;
              border: none;
              padding: 2px 4px;
              border-radius: 2px;
              cursor: pointer;
              font-size: 10px;
              margin-left: 4px;
            `;
            copyCheckboxIdBtn.onclick = () => {
              const number = prompt('Enter number:', '1');
              if (number !== null && number !== '') {
                const nodeIdWithNumber = `${checkboxIdInput.value}_${number}`;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(nodeIdWithNumber).then(() => {
                    copyCheckboxIdBtn.textContent = 'Copied!';
                    copyCheckboxIdBtn.style.background = '#28a745';
                    setTimeout(() => {
                      copyCheckboxIdBtn.textContent = 'Copy ID';
                      copyCheckboxIdBtn.style.background = '#17a2b8';
                    }, 1500);
                  });
                } else {
                  const textArea = document.createElement('textarea');
                  textArea.value = nodeIdWithNumber;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  copyCheckboxIdBtn.textContent = 'Copied!';
                  copyCheckboxIdBtn.style.background = '#28a745';
                  setTimeout(() => {
                    copyCheckboxIdBtn.textContent = 'Copy ID';
                    copyCheckboxIdBtn.style.background = '#17a2b8';
                  }, 1500);
                }
              }
            };
            optionDiv.appendChild(checkboxTextInput);
            optionDiv.appendChild(checkboxIdInput);
            optionDiv.appendChild(copyCheckboxIdBtn);
            optionDiv.appendChild(deleteOptionBtn);
            contentContainer.appendChild(optionDiv);
          });
        }
        contentContainer.appendChild(deleteCheckboxBtn);
        checkboxContainer.appendChild(contentContainer);
        // Add drag handlers
        checkboxContainer.addEventListener('dragstart', (e) => {
          checkboxContainer.classList.add('dragging');
          checkboxContainer.style.opacity = '0.5';
          e.dataTransfer.effectAllowed = 'move';
        });
        checkboxContainer.addEventListener('dragend', (e) => {
          checkboxContainer.classList.remove('dragging');
          checkboxContainer.style.opacity = '1';
        });
        // Store in map instead of appending directly
        storeEntryContainer('checkbox', checkbox.fieldName || '', checkboxContainer);
      });
    }
    // Display existing times
    if (trigger.times && trigger.times.length > 0) {
      trigger.times.forEach((time, timeIndex) => {
        const timeContainer = document.createElement('div');
        timeContainer.draggable = true;
        timeContainer.dataset.type = 'time';
        timeContainer.dataset.triggerIndex = triggerIndex;
        timeContainer.style.cssText = `
          margin-bottom: 10px;
          padding: 8px;
          background: #fff3e0;
          border: 1px solid #ffcc02;
          border-radius: 4px;
          cursor: move;
          position: relative;
        `;
        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.textContent = '⋮⋮';
        dragHandle.style.cssText = `
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          cursor: move;
          color: #ff9800;
          font-size: 14px;
          user-select: none;
          padding: 2px;
        `;
        timeContainer.appendChild(dragHandle);
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
          margin-left: 24px;
        `;
        const fieldNameInput = document.createElement('input');
        fieldNameInput.type = 'text';
        fieldNameInput.value = time.fieldName || '';
        fieldNameInput.placeholder = 'Enter time field name...';
        fieldNameInput.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
        `;
        fieldNameInput.onblur = () => {
          time.fieldName = fieldNameInput.value.trim();
          // Update the node ID when field name changes
          const updatedNodeId = generateNodeIdForDropdownField(time.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
          time.nodeId = updatedNodeId;
          timeIdInput.value = updatedNodeId;
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Time ID input (uneditable and autofilled)
        // Auto-fix incorrect node IDs when menu opens
        const correctTimeId = generateNodeIdForDropdownField(time.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
        const timeIdValue = (time.nodeId && time.nodeId === correctTimeId) ? time.nodeId : correctTimeId;
        time.nodeId = timeIdValue; // Ensure the nodeId is set in the data
        const timeIdInput = createUneditableNodeIdInput('Time ID...', timeIdValue, (input) => {
          // Double-click to copy functionality
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(input.value).then(() => {
              // Show visual feedback
              const originalBg = input.style.backgroundColor;
              input.style.backgroundColor = '#d4edda';
              input.style.borderColor = '#28a745';
              setTimeout(() => {
                input.style.backgroundColor = originalBg;
                input.style.borderColor = '#ddd';
              }, 1000);
            });
          } else {
            // Fallback for older browsers
            input.select();
            document.execCommand('copy');
            const originalBg = input.style.backgroundColor;
            input.style.backgroundColor = '#d4edda';
            input.style.borderColor = '#28a745';
            setTimeout(() => {
              input.style.backgroundColor = originalBg;
              input.style.borderColor = '#ddd';
            }, 1000);
          }
        });
        timeIdInput.style.marginBottom = '8px';
        const deleteTimeBtn = document.createElement('button');
        deleteTimeBtn.textContent = 'Delete Time';
        deleteTimeBtn.style.cssText = `
          background: #f44336;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        deleteTimeBtn.onclick = () => {
          trigger.times.splice(timeIndex, 1);
          timeContainer.remove();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        contentContainer.appendChild(fieldNameInput);
        contentContainer.appendChild(timeIdInput);
        // Initialize conditional logic if it doesn't exist
        if (!time.conditionalLogic) {
          time.conditionalLogic = {
            enabled: false,
            conditions: []
          };
        }
        // Enable Conditional Logic checkbox
        const enableConditionalLogicCheckbox = document.createElement('input');
        enableConditionalLogicCheckbox.type = 'checkbox';
        enableConditionalLogicCheckbox.checked = time.conditionalLogic.enabled || false;
        enableConditionalLogicCheckbox.style.cssText = `
          margin-bottom: 8px;
        `;
        const enableConditionalLogicLabel = document.createElement('label');
        enableConditionalLogicLabel.textContent = 'Enable Conditional Logic';
        enableConditionalLogicLabel.style.cssText = `
          font-size: 12px;
          margin-left: 4px;
          cursor: pointer;
        `;
        enableConditionalLogicLabel.htmlFor = enableConditionalLogicCheckbox.id || `enableConditionalLogic_${triggerIndex}_${timeIndex}`;
        enableConditionalLogicCheckbox.id = enableConditionalLogicLabel.htmlFor;
        const conditionalLogicContainer = document.createElement('div');
        conditionalLogicContainer.style.cssText = `
          margin-bottom: 8px;
          display: flex;
          align-items: center;
        `;
        conditionalLogicContainer.appendChild(enableConditionalLogicCheckbox);
        conditionalLogicContainer.appendChild(enableConditionalLogicLabel);
        // Conditional logic UI container
        const conditionalLogicUIContainer = document.createElement('div');
        conditionalLogicUIContainer.id = `conditionalLogic_existing_${triggerIndex}_${timeIndex}`;
        conditionalLogicUIContainer.style.display = time.conditionalLogic.enabled ? 'block' : 'none';
        // Function to update conditional logic UI
        const updateConditionalLogicUI = () => {
          conditionalLogicUIContainer.innerHTML = '';
          if (!time.conditionalLogic.conditions || time.conditionalLogic.conditions.length === 0) {
            time.conditionalLogic.conditions = [''];
          }
          const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(trigger, dropdown, cell);
          time.conditionalLogic.conditions.forEach((condition, conditionIndex) => {
            const conditionRow = document.createElement('div');
            conditionRow.style.cssText = `
              margin-bottom: 8px;
              display: flex;
              gap: 4px;
              align-items: center;
            `;
            const conditionDropdown = document.createElement('select');
            conditionDropdown.style.cssText = `
              flex: 1;
              padding: 4px 8px;
              border: 1px solid #ddd;
              border-radius: 3px;
              font-size: 12px;
            `;
            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = 'Select checkbox option...';
            conditionDropdown.appendChild(placeholderOption);
            // Add checkbox option node IDs
            checkboxNodeIds.forEach(nodeId => {
              const option = document.createElement('option');
              option.value = nodeId;
              option.textContent = nodeId;
              if (condition === nodeId) {
                option.selected = true;
              }
              conditionDropdown.appendChild(option);
            });
            conditionDropdown.value = condition || '';
            conditionDropdown.onchange = () => {
              time.conditionalLogic.conditions[conditionIndex] = conditionDropdown.value;
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            const removeConditionBtn = document.createElement('button');
            removeConditionBtn.textContent = '×';
            removeConditionBtn.style.cssText = `
              background: #f44336;
              color: white;
              border: none;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              cursor: pointer;
              font-size: 14px;
              flex-shrink: 0;
            `;
            removeConditionBtn.onclick = () => {
              if (time.conditionalLogic.conditions.length > 1) {
                time.conditionalLogic.conditions.splice(conditionIndex, 1);
                updateConditionalLogicUI();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              }
            };
            conditionRow.appendChild(conditionDropdown);
            conditionRow.appendChild(removeConditionBtn);
            conditionalLogicUIContainer.appendChild(conditionRow);
          });
          // Add Another Condition button
          const addConditionBtn = document.createElement('button');
          addConditionBtn.textContent = 'Add Another Condition';
          addConditionBtn.style.cssText = `
            background: #2196F3;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            width: 100%;
            margin-top: 4px;
          `;
          addConditionBtn.onclick = () => {
            if (!time.conditionalLogic.conditions) {
              time.conditionalLogic.conditions = [];
            }
            time.conditionalLogic.conditions.push('');
            updateConditionalLogicUI();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          conditionalLogicUIContainer.appendChild(addConditionBtn);
        };
        enableConditionalLogicCheckbox.onchange = () => {
          time.conditionalLogic.enabled = enableConditionalLogicCheckbox.checked;
          conditionalLogicUIContainer.style.display = enableConditionalLogicCheckbox.checked ? 'block' : 'none';
          if (enableConditionalLogicCheckbox.checked && (!time.conditionalLogic.conditions || time.conditionalLogic.conditions.length === 0)) {
            time.conditionalLogic.conditions = [''];
          }
          updateConditionalLogicUI();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Initialize conditional logic UI if enabled
        if (time.conditionalLogic.enabled) {
          updateConditionalLogicUI();
        }
        contentContainer.appendChild(conditionalLogicContainer);
        contentContainer.appendChild(conditionalLogicUIContainer);
        contentContainer.appendChild(deleteTimeBtn);
        // Copy ID button for existing time (positioned after delete button)
        const copyTimeIdBtn = document.createElement('button');
        copyTimeIdBtn.textContent = 'Copy ID';
        copyTimeIdBtn.style.cssText = `
          background: #17a2b8;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          margin-bottom: 8px;
          width: 100%;
        `;
        copyTimeIdBtn.onclick = () => {
          const number = prompt('Enter number:', '1');
          if (number !== null && number !== '') {
            const nodeIdWithNumber = `${timeIdInput.value}_${number}`;
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(nodeIdWithNumber).then(() => {
                copyTimeIdBtn.textContent = 'Copied!';
                copyTimeIdBtn.style.background = '#28a745';
                setTimeout(() => {
                  copyTimeIdBtn.textContent = 'Copy ID';
                  copyTimeIdBtn.style.background = '#17a2b8';
                }, 1500);
              });
            } else {
              const textArea = document.createElement('textarea');
              textArea.value = nodeIdWithNumber;
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand('copy');
              document.body.removeChild(textArea);
              copyTimeIdBtn.textContent = 'Copied!';
              copyTimeIdBtn.style.background = '#28a745';
              setTimeout(() => {
                copyTimeIdBtn.textContent = 'Copy ID';
                copyTimeIdBtn.style.background = '#17a2b8';
              }, 1500);
            }
          }
        };
        contentContainer.appendChild(copyTimeIdBtn);
        timeContainer.appendChild(contentContainer);
        // Add drag handlers
        timeContainer.addEventListener('dragstart', (e) => {
          timeContainer.classList.add('dragging');
          timeContainer.style.opacity = '0.5';
          e.dataTransfer.effectAllowed = 'move';
        });
        timeContainer.addEventListener('dragend', (e) => {
          timeContainer.classList.remove('dragging');
          timeContainer.style.opacity = '1';
        });
        // Store in map instead of appending directly
        storeEntryContainer('time', time.fieldName || '', timeContainer);
      });
    }
    // Display existing locations
    if (trigger.locations && trigger.locations.length > 0) {
      trigger.locations.forEach((location, locationIndex) => {
        const locationContainer = document.createElement('div');
        locationContainer.draggable = true;
        locationContainer.dataset.type = 'location';
        locationContainer.dataset.triggerIndex = triggerIndex;
        locationContainer.style.cssText = `
          margin: 8px 0;
          padding: 8px;
          background-color: #e8f5e8;
          border: 2px dashed #28a745;
          border-radius: 4px;
          text-align: center;
          color: #28a745;
          font-weight: bold;
          font-size: 12px;
          cursor: move;
          position: relative;
        `;
        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.textContent = '⋮⋮';
        dragHandle.style.cssText = `
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          cursor: move;
          color: #28a745;
          font-size: 14px;
          user-select: none;
          padding: 2px;
        `;
        locationContainer.appendChild(dragHandle);
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
          margin-left: 24px;
        `;
        // Location indicator text
        const locationText = document.createElement('div');
        locationText.textContent = '📍 ' + (location.fieldName || 'Location Data Inserted');
        locationText.style.cssText = `
          margin-bottom: 8px;
        `;
        // Location title input field
        const locationTitleInput = document.createElement('input');
        locationTitleInput.type = 'text';
        locationTitleInput.placeholder = 'Enter location title...';
        locationTitleInput.value = location.locationTitle || '';
        locationTitleInput.style.cssText = `
          width: 100%;
          max-width: 300px;
          padding: 4px 8px;
          border: 1px solid #28a745;
          border-radius: 3px;
          font-size: 12px;
          margin-top: 8px;
          margin-bottom: 8px;
          text-align: center;
          background: white;
          color: #333;
        `;
        locationTitleInput.onblur = () => {
          location.locationTitle = locationTitleInput.value.trim();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
        `;
        // Copy ID's button for trigger sequence location
        const copyLocationIdsBtn = document.createElement('button');
        copyLocationIdsBtn.textContent = 'Copy ID\'s';
        copyLocationIdsBtn.style.cssText = `
          background-color: #17a2b8;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        `;
        copyLocationIdsBtn.onclick = () => {
          if (typeof window.showTriggerSequenceLocationIdsPopup === 'function') {
            window.showTriggerSequenceLocationIdsPopup(cell.id, dropdown.name, trigger.triggerOption, location.locationTitle || '');
          }
        };
        // Delete location button
        const deleteLocationBtn = document.createElement('button');
        deleteLocationBtn.textContent = 'Remove';
        deleteLocationBtn.style.cssText = `
          background-color: #dc3545;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          font-size: 10px;
          cursor: pointer;
        `;
        deleteLocationBtn.onclick = () => {
          trigger.locations.splice(locationIndex, 1);
          locationContainer.remove();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        buttonContainer.appendChild(copyLocationIdsBtn);
        buttonContainer.appendChild(deleteLocationBtn);
        contentContainer.appendChild(locationText);
        contentContainer.appendChild(locationTitleInput);
        contentContainer.appendChild(buttonContainer);
        locationContainer.appendChild(contentContainer);
        // Add drag handlers
        locationContainer.addEventListener('dragstart', (e) => {
          locationContainer.classList.add('dragging');
          locationContainer.style.opacity = '0.5';
          e.dataTransfer.effectAllowed = 'move';
        });
        locationContainer.addEventListener('dragend', (e) => {
          locationContainer.classList.remove('dragging');
          locationContainer.style.opacity = '1';
        });
        // Store in map instead of appending directly
        const locationIdentifier = location.locationTitle || location.fieldName || 'location';
        storeEntryContainer('location', locationIdentifier, locationContainer);
      });
    }
    // Display existing PDFs
    if (trigger.pdfs && trigger.pdfs.length > 0) {
      trigger.pdfs.forEach((pdf, pdfIndex) => {
        const pdfContainer = document.createElement('div');
        pdfContainer.draggable = true;
        pdfContainer.dataset.type = 'pdf';
        pdfContainer.dataset.triggerIndex = triggerIndex;
        pdfContainer.style.cssText = `
          margin-bottom: 10px;
          padding: 8px;
          background: #fce4ec;
          border: 1px solid #e91e63;
          border-radius: 4px;
          cursor: move;
          position: relative;
        `;
        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.textContent = '⋮⋮';
        dragHandle.style.cssText = `
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          cursor: move;
          color: #e91e63;
          font-size: 14px;
          user-select: none;
          padding: 2px;
        `;
        pdfContainer.appendChild(dragHandle);
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
          margin-left: 24px;
        `;
        // Trigger number input
        const triggerNumberInput = document.createElement('input');
        triggerNumberInput.type = 'text';
        triggerNumberInput.placeholder = 'Trigger number...';
        triggerNumberInput.value = pdf.triggerNumber || '';
        triggerNumberInput.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
        `;
        triggerNumberInput.onblur = () => {
          pdf.triggerNumber = triggerNumberInput.value.trim();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // PDF title input
        const pdfTitleInput = document.createElement('input');
        pdfTitleInput.type = 'text';
        pdfTitleInput.placeholder = 'PDF title...';
        pdfTitleInput.value = pdf.pdfTitle || '';
        pdfTitleInput.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
        `;
        pdfTitleInput.onblur = () => {
          pdf.pdfTitle = pdfTitleInput.value.trim();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // PDF filename input
        const pdfFilenameInput = document.createElement('input');
        pdfFilenameInput.type = 'text';
        pdfFilenameInput.placeholder = 'PDF filename...';
        pdfFilenameInput.value = pdf.pdfFilename || '';
        pdfFilenameInput.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
        `;
        pdfFilenameInput.onblur = () => {
          pdf.pdfFilename = pdfFilenameInput.value.trim();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // PDF price ID input
        const pdfPriceIdInput = document.createElement('input');
        pdfPriceIdInput.type = 'text';
        pdfPriceIdInput.placeholder = 'PDF price ID...';
        pdfPriceIdInput.value = pdf.pdfPriceId || '';
        pdfPriceIdInput.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
        `;
        pdfPriceIdInput.onblur = () => {
          pdf.pdfPriceId = pdfPriceIdInput.value.trim();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Delete PDF button
        const deletePdfBtn = document.createElement('button');
        deletePdfBtn.textContent = 'Delete PDF';
        deletePdfBtn.style.cssText = `
          background: #f44336;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        deletePdfBtn.onclick = () => {
          trigger.pdfs.splice(pdfIndex, 1);
          pdfContainer.remove();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        contentContainer.appendChild(triggerNumberInput);
        contentContainer.appendChild(pdfTitleInput);
        contentContainer.appendChild(pdfFilenameInput);
        contentContainer.appendChild(pdfPriceIdInput);
        contentContainer.appendChild(deletePdfBtn);
        pdfContainer.appendChild(contentContainer);
        // Add drag handlers
        pdfContainer.addEventListener('dragstart', (e) => {
          pdfContainer.classList.add('dragging');
          pdfContainer.style.opacity = '0.5';
          e.dataTransfer.effectAllowed = 'move';
        });
        pdfContainer.addEventListener('dragend', (e) => {
          pdfContainer.classList.remove('dragging');
          pdfContainer.style.opacity = '1';
        });
        // Store in map instead of appending directly
        const pdfIdentifier = pdf.triggerNumber || pdf.pdfTitle || pdf.pdfFilename || 'pdf';
        storeEntryContainer('pdf', pdfIdentifier, pdfContainer);
      });
    }
    // Display existing dropdowns
    if (trigger.dropdowns && trigger.dropdowns.length > 0) {
      trigger.dropdowns.forEach((nestedDropdown, dropdownIndex) => {
        const dropdownContainer = document.createElement('div');
        dropdownContainer.draggable = true;
        dropdownContainer.dataset.type = 'dropdown';
        dropdownContainer.dataset.triggerIndex = triggerIndex;
        dropdownContainer.style.cssText = `
          margin-bottom: 10px;
          padding: 8px;
          background: #e0f7fa;
          border: 1px solid #17a2b8;
          border-radius: 4px;
          cursor: move;
          position: relative;
        `;
        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.style.cssText = `
          position: absolute;
          left: 4px;
          top: 50%;
          transform: translateY(-50%);
          cursor: move;
          color: #17a2b8;
          font-size: 14px;
          user-select: none;
          padding: 2px;
        `;
        dropdownContainer.appendChild(dragHandle);
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
          margin-left: 24px;
        `;
        // Field name input
        const fieldNameInput = document.createElement('input');
        fieldNameInput.type = 'text';
        fieldNameInput.placeholder = 'Enter dropdown question title...';
        fieldNameInput.value = nestedDropdown.fieldName || '';
        fieldNameInput.style.cssText = `
          width: 100%;
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          margin-bottom: 8px;
        `;
        fieldNameInput.onblur = () => {
          nestedDropdown.fieldName = fieldNameInput.value.trim();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Add option button
        const addOptionBtn = document.createElement('button');
        addOptionBtn.textContent = 'Add option';
        addOptionBtn.style.cssText = `
          background: #17a2b8;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          margin-bottom: 8px;
        `;
        // Options container
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'dropdown-options-container';
        optionsContainer.style.cssText = `
          margin-bottom: 8px;
        `;
        // Render existing options
        if (nestedDropdown.options && nestedDropdown.options.length > 0) {
          nestedDropdown.options.forEach((option, optionIndex) => {
            const optionDiv = document.createElement('div');
            optionDiv.style.cssText = `
              display: flex;
              gap: 4px;
              margin-bottom: 4px;
              align-items: center;
            `;
            const optionInput = document.createElement('input');
            optionInput.type = 'text';
            optionInput.placeholder = 'Enter option text...';
            optionInput.value = option.text || '';
            optionInput.style.cssText = `
              flex: 1;
              padding: 4px 8px;
              border: 1px solid #ddd;
              border-radius: 3px;
              font-size: 12px;
            `;
            optionInput.onblur = () => {
              option.text = optionInput.value.trim();
              // Refresh all conditional logic UIs in this trigger sequence when options change
              const triggerDiv = dropdownContainer.closest('.trigger-sequence');
              if (triggerDiv) {
                const allConditionalLogicContainers = triggerDiv.querySelectorAll('[id^="conditionalLogicDropdown_"]');
                allConditionalLogicContainers.forEach(container => {
                  if (container._updateConditionalLogicUI) {
                    container._updateConditionalLogicUI();
                  }
                });
              }
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            optionInput.oninput = () => {
              // Also refresh on input for real-time updates
              const triggerDiv = dropdownContainer.closest('.trigger-sequence');
              if (triggerDiv) {
                const allConditionalLogicContainers = triggerDiv.querySelectorAll('[id^="conditionalLogicDropdown_"]');
                allConditionalLogicContainers.forEach(container => {
                  if (container._updateConditionalLogicUI) {
                    container._updateConditionalLogicUI();
                  }
                });
              }
            };
            const deleteOptionBtn = document.createElement('button');
            deleteOptionBtn.textContent = '×';
            deleteOptionBtn.style.cssText = `
              background: #f44336;
              color: white;
              border: none;
              padding: 2px 6px;
              border-radius: 3px;
              cursor: pointer;
              font-size: 14px;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
            `;
            deleteOptionBtn.onclick = () => {
              const optIndex = nestedDropdown.options.findIndex(o => o === option);
              if (optIndex !== -1) {
                nestedDropdown.options.splice(optIndex, 1);
              }
              optionDiv.remove();
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            optionDiv.appendChild(optionInput);
            optionDiv.appendChild(deleteOptionBtn);
            optionsContainer.appendChild(optionDiv);
          });
        }
        // Delete dropdown button
        const deleteDropdownBtn = document.createElement('button');
        deleteDropdownBtn.textContent = 'Delete Dropdown';
        deleteDropdownBtn.style.cssText = `
          background: #f44336;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
        `;
        deleteDropdownBtn.onclick = () => {
          const dropIndex = trigger.dropdowns.findIndex(d => d === nestedDropdown);
          if (dropIndex !== -1) {
            trigger.dropdowns.splice(dropIndex, 1);
          }
          dropdownContainer.remove();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Initialize conditional logic if it doesn't exist
        if (!nestedDropdown.conditionalLogic) {
          nestedDropdown.conditionalLogic = {
            enabled: false,
            conditions: []
          };
        }
        // Enable Conditional Logic checkbox
        const enableConditionalLogicCheckbox = document.createElement('input');
        enableConditionalLogicCheckbox.type = 'checkbox';
        enableConditionalLogicCheckbox.checked = nestedDropdown.conditionalLogic.enabled || false;
        enableConditionalLogicCheckbox.style.cssText = `
          margin-bottom: 8px;
        `;
        const enableConditionalLogicLabel = document.createElement('label');
        enableConditionalLogicLabel.textContent = 'Enable Conditional Logic';
        enableConditionalLogicLabel.style.cssText = `
          font-size: 12px;
          margin-left: 4px;
          cursor: pointer;
        `;
        enableConditionalLogicLabel.htmlFor = enableConditionalLogicCheckbox.id || `enableConditionalLogicDropdown_existing_${triggerIndex}_${dropdownIndex}`;
        enableConditionalLogicCheckbox.id = enableConditionalLogicLabel.htmlFor;
        const conditionalLogicContainer = document.createElement('div');
        conditionalLogicContainer.style.cssText = `
          margin-bottom: 8px;
          display: flex;
          align-items: center;
        `;
        conditionalLogicContainer.appendChild(enableConditionalLogicCheckbox);
        conditionalLogicContainer.appendChild(enableConditionalLogicLabel);
        // Conditional logic UI container
        const conditionalLogicUIContainer = document.createElement('div');
        conditionalLogicUIContainer.id = `conditionalLogicDropdown_existing_${triggerIndex}_${dropdownIndex}`;
        conditionalLogicUIContainer.style.display = nestedDropdown.conditionalLogic.enabled ? 'block' : 'none';
        // Function to update conditional logic UI
        const updateConditionalLogicUI = () => {
          conditionalLogicUIContainer.innerHTML = '';
          if (!nestedDropdown.conditionalLogic.conditions || nestedDropdown.conditionalLogic.conditions.length === 0) {
            nestedDropdown.conditionalLogic.conditions = [''];
          }
          // Store reference to this function on the container so it can be called when options change
          conditionalLogicUIContainer._updateConditionalLogicUI = updateConditionalLogicUI;
          const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(trigger, dropdown, cell);
          nestedDropdown.conditionalLogic.conditions.forEach((condition, conditionIndex) => {
            const conditionRow = document.createElement('div');
            conditionRow.style.cssText = `
              margin-bottom: 8px;
              display: flex;
              gap: 4px;
              align-items: center;
            `;
            const conditionDropdown = document.createElement('select');
            conditionDropdown.style.cssText = `
              flex: 1;
              padding: 4px 8px;
              border: 1px solid #ddd;
              border-radius: 3px;
              font-size: 12px;
            `;
            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = 'Select checkbox option...';
            conditionDropdown.appendChild(placeholderOption);
            // Add checkbox option node IDs
            checkboxNodeIds.forEach(nodeId => {
              const option = document.createElement('option');
              option.value = nodeId;
              option.textContent = nodeId;
              if (condition === nodeId) {
                option.selected = true;
              }
              conditionDropdown.appendChild(option);
            });
            conditionDropdown.value = condition || '';
            conditionDropdown.onchange = () => {
              nestedDropdown.conditionalLogic.conditions[conditionIndex] = conditionDropdown.value;
              if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
              }
            };
            const removeConditionBtn = document.createElement('button');
            removeConditionBtn.textContent = '×';
            removeConditionBtn.style.cssText = `
              background: #f44336;
              color: white;
              border: none;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              cursor: pointer;
              font-size: 14px;
              flex-shrink: 0;
            `;
            removeConditionBtn.onclick = () => {
              if (nestedDropdown.conditionalLogic.conditions.length > 1) {
                nestedDropdown.conditionalLogic.conditions.splice(conditionIndex, 1);
                updateConditionalLogicUI();
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
              }
            };
            conditionRow.appendChild(conditionDropdown);
            conditionRow.appendChild(removeConditionBtn);
            conditionalLogicUIContainer.appendChild(conditionRow);
          });
          // Add Another Condition button
          const addConditionBtn = document.createElement('button');
          addConditionBtn.textContent = 'Add Another Condition';
          addConditionBtn.style.cssText = `
            background: #2196F3;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            width: 100%;
            margin-top: 4px;
          `;
          addConditionBtn.onclick = () => {
            if (!dropdown.conditionalLogic.conditions) {
              dropdown.conditionalLogic.conditions = [];
            }
            dropdown.conditionalLogic.conditions.push('');
            updateConditionalLogicUI();
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          conditionalLogicUIContainer.appendChild(addConditionBtn);
        };
        enableConditionalLogicCheckbox.onchange = () => {
          nestedDropdown.conditionalLogic.enabled = enableConditionalLogicCheckbox.checked;
          conditionalLogicUIContainer.style.display = enableConditionalLogicCheckbox.checked ? 'block' : 'none';
          if (enableConditionalLogicCheckbox.checked && (!nestedDropdown.conditionalLogic.conditions || nestedDropdown.conditionalLogic.conditions.length === 0)) {
            nestedDropdown.conditionalLogic.conditions = [''];
          }
          updateConditionalLogicUI();
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
        };
        // Initialize conditional logic UI if enabled
        if (nestedDropdown.conditionalLogic.enabled) {
          updateConditionalLogicUI();
        }
        // Also refresh when options are added via the "Add option" button
        addOptionBtn.onclick = () => {
          const newOption = { text: '' };
          nestedDropdown.options.push(newOption);
          // Create option input
          const optionDiv = document.createElement('div');
          optionDiv.style.cssText = `
            display: flex;
            gap: 4px;
            margin-bottom: 4px;
            align-items: center;
          `;
          const optionInput = document.createElement('input');
          optionInput.type = 'text';
          optionInput.placeholder = 'Enter option text...';
          optionInput.style.cssText = `
            flex: 1;
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
          `;
          optionInput.value = newOption.text || '';
          optionInput.onblur = () => {
            newOption.text = optionInput.value.trim();
            // Refresh all conditional logic UIs in this trigger sequence when options change
            const triggerDiv = dropdownContainer.closest('.trigger-sequence');
            if (triggerDiv) {
              const allConditionalLogicContainers = triggerDiv.querySelectorAll('[id^="conditionalLogicDropdown_"]');
              allConditionalLogicContainers.forEach(container => {
                if (container._updateConditionalLogicUI) {
                  container._updateConditionalLogicUI();
                }
              });
            }
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          optionInput.oninput = () => {
            // Also refresh on input for real-time updates
            const triggerDiv = dropdownContainer.closest('.trigger-sequence');
            if (triggerDiv) {
              const allConditionalLogicContainers = triggerDiv.querySelectorAll('[id^="conditionalLogicDropdown_"]');
              allConditionalLogicContainers.forEach(container => {
                if (container._updateConditionalLogicUI) {
                  container._updateConditionalLogicUI();
                }
              });
            }
          };
          const deleteOptionBtn = document.createElement('button');
          deleteOptionBtn.textContent = '×';
          deleteOptionBtn.style.cssText = `
            background: #f44336;
            color: white;
            border: none;
            padding: 2px 6px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          `;
          deleteOptionBtn.onclick = () => {
            const optIndex = nestedDropdown.options.findIndex(o => o === newOption);
            if (optIndex !== -1) {
              nestedDropdown.options.splice(optIndex, 1);
            }
            optionDiv.remove();
            // Refresh conditional logic UIs when option is deleted
            const triggerDiv = dropdownContainer.closest('.trigger-sequence');
            if (triggerDiv) {
              const allConditionalLogicContainers = triggerDiv.querySelectorAll('[id^="conditionalLogicDropdown_"]');
              allConditionalLogicContainers.forEach(container => {
                if (container._updateConditionalLogicUI) {
                  container._updateConditionalLogicUI();
                }
              });
            }
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          };
          optionDiv.appendChild(optionInput);
          optionDiv.appendChild(deleteOptionBtn);
          optionsContainer.appendChild(optionDiv);
          optionInput.focus();
        };
        contentContainer.appendChild(fieldNameInput);
        contentContainer.appendChild(addOptionBtn);
        contentContainer.appendChild(optionsContainer);
        contentContainer.appendChild(conditionalLogicContainer);
        contentContainer.appendChild(conditionalLogicUIContainer);
        contentContainer.appendChild(deleteDropdownBtn);
        dropdownContainer.appendChild(contentContainer);
        // Add drag handlers
        dropdownContainer.addEventListener('dragstart', (e) => {
          dropdownContainer.classList.add('dragging');
          dropdownContainer.style.opacity = '0.5';
          e.dataTransfer.effectAllowed = 'move';
        });
        dropdownContainer.addEventListener('dragend', (e) => {
          dropdownContainer.classList.remove('dragging');
          dropdownContainer.style.opacity = '1';
        });
        // Store in map instead of appending directly
        const dropdownIdentifier = nestedDropdown.fieldName || 'dropdown';
        storeEntryContainer('dropdown', dropdownIdentifier, dropdownContainer);
      });
    }
    // Append containers in unified order if available, otherwise in stored order
    if (trigger._actionOrder && trigger._actionOrder.length > 0) {
      // Append in unified order
      trigger._actionOrder.forEach((orderItem) => {
        const key = `${orderItem.type}_${orderItem.identifier}`;
        const container = entryContainersMap.get(key);
        if (container) {
          actionsList.appendChild(container);
        }
      });
      // Append any containers not in unified order (shouldn't happen, but safety check)
      entryContainersMap.forEach((container, key) => {
        if (!actionsList.contains(container)) {
          actionsList.appendChild(container);
        }
      });
    } else {
      // Fallback: Append in stored order (which is the old type-based order)
      entryContainersMap.forEach((container) => {
        actionsList.appendChild(container);
      });
    }
    triggerDiv.appendChild(actionsList);
    triggerSequencesList.appendChild(triggerDiv);
  });
  conditionalSection.appendChild(triggerSequencesList);
  dropdownContainer.appendChild(conditionalSection);
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete Dropdown';
  deleteBtn.style.cssText = `
    background: #f44336;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    width: 100%;
  `;
  deleteBtn.onclick = () => {
    if (confirm('Are you sure you want to delete this dropdown?')) {
      cell._dropdowns.splice(index, 1);
      // Update item order to remove this dropdown
      if (cell._itemOrder) {
        cell._itemOrder = cell._itemOrder.filter(item => 
          !(item.type === 'dropdown' && item.index === index)
        );
      }
      // Remove the dropdown container from the DOM
      dropdownContainer.remove();
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    }
  };
  dropdownContainer.appendChild(deleteBtn);
  return dropdownContainer;
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
  // Location title input field
  const locationTitleInput = document.createElement('input');
  locationTitleInput.type = 'text';
  locationTitleInput.placeholder = 'Enter location title...';
  locationTitleInput.value = cell._locationTitle || '';
  locationTitleInput.style.cssText = `
    width: 100%;
    max-width: 300px;
    padding: 4px 8px;
    border: 1px solid #28a745;
    border-radius: 3px;
    font-size: 12px;
    margin-top: 8px;
    text-align: center;
    background: white;
    color: #333;
  `;
  locationTitleInput.onblur = () => {
    cell._locationTitle = locationTitleInput.value.trim();
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Copy Location IDs button
  const copyLocationIdsBtn = document.createElement('button');
  copyLocationIdsBtn.textContent = 'Copy ID\'s';
  copyLocationIdsBtn.style.cssText = `
    background-color: #17a2b8;
    color: white;
    border: none;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    cursor: pointer;
    margin-left: 4px;
  `;
  copyLocationIdsBtn.onclick = () => {
    if (typeof window.showDropdownLocationIdsPopup === 'function') {
      try {
        window.showDropdownLocationIdsPopup(cell.id);
      } catch (error) {
      }
    } else {
    }
  };
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
    margin-left: 4px;
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
  // Create a container for the buttons to stack them vertically under the text
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    width: 100%;
  `;
  // Update button styles to make them bigger and remove margins
  copyLocationIdsBtn.style.cssText = `
    background-color: #17a2b8;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    margin: 0;
    width: 100%;
    max-width: 200px;
  `;
  removeBtn.style.cssText = `
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    margin: 0;
    width: 100%;
    max-width: 200px;
  `;
  // Add buttons to the container
  buttonContainer.appendChild(copyLocationIdsBtn);
  buttonContainer.appendChild(removeBtn);
  // Create a text container to hold the location text
  const textContainer = document.createElement('div');
  textContainer.style.cssText = `
    display: flex;
    align-items: center;
    width: 100%;
  `;
  textContainer.appendChild(dragHandle);
  textContainer.appendChild(locationText);
  // Create main container for the entire location indicator
  const mainContainer = document.createElement('div');
  mainContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    width: 100%;
    align-items: center;
  `;
  mainContainer.appendChild(textContainer);
  mainContainer.appendChild(locationTitleInput);
  mainContainer.appendChild(buttonContainer);
  locationIndicator.appendChild(mainContainer);
  return locationIndicator;
}
// Helper function to create individual option field
function createOptionField(option, index, cell, parentContainer) {
  const optionContainer = document.createElement('div');
  optionContainer.style.cssText = `
    display: flex;
    flex-direction: column;
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
  // Top row: Drag handle, Option text input, Amount checkbox, Copy ID, Delete
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
  const entryType = option.type || (option.isAmountOption ? 'amount' : 'label');
  const isAmount = entryType === 'amount';
  const isPhone = entryType === 'phone';
  // Amount / Phone radios
  const amountLabel = document.createElement('label');
  amountLabel.style.cssText = `
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: #2c3e50;
  `;
  const amountRadio = document.createElement('input');
  amountRadio.type = 'radio';
  amountRadio.value = 'amount';
  amountRadio.name = `mdd_type_${cell.id}_${index}`;
  amountRadio.checked = isAmount;
  amountLabel.appendChild(amountRadio);
  amountLabel.appendChild(document.createTextNode('Amount?'));
  const phoneLabel = document.createElement('label');
  phoneLabel.style.cssText = amountLabel.style.cssText;
  const phoneRadio = document.createElement('input');
  phoneRadio.type = 'radio';
  phoneRadio.value = 'phone';
  phoneRadio.name = `mdd_type_${cell.id}_${index}`;
  phoneRadio.checked = isPhone;
  // Sync helper keeps DOM in step with data
  const syncRadios = (nextType) => {
    const typeToSync = nextType || option.type || (option.isAmountOption ? 'amount' : 'label');
    amountRadio.checked = typeToSync === 'amount';
    phoneRadio.checked = typeToSync === 'phone';
  };
  const applyToggle = (newType) => {
    const current = option.type || (option.isAmountOption ? 'amount' : 'label');
    const finalType = current === newType ? 'label' : newType;
    if (typeof window.setMultipleDropdownType === 'function') {
      window.setMultipleDropdownType(cell.id, index, finalType);
    } else {
      option.type = finalType;
      option.isAmountOption = finalType === 'amount';
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    }
    option.type = finalType;
    option.isAmountOption = finalType === 'amount';
    syncRadios(finalType);
  };
  const handlePointer = (newType) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    applyToggle(newType);
  };
  amountRadio.addEventListener('pointerdown', handlePointer('amount'), true);
  phoneRadio.addEventListener('pointerdown', handlePointer('phone'), true);
  // Change events help keep visual state aligned if native events fire after toggle
  amountRadio.addEventListener('change', () => syncRadios());
  phoneRadio.addEventListener('change', () => syncRadios());
  phoneLabel.appendChild(phoneRadio);
  phoneLabel.appendChild(document.createTextNode('Phone?'));
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
    // Remove the textbox container from the DOM
    optionContainer.remove();
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Second row: Option Prefill input
  const prefillRow = document.createElement('div');
  prefillRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  const prefillLabel = document.createElement('label');
  prefillLabel.textContent = 'Option Prefill:';
  prefillLabel.style.cssText = `
    font-size: 14px;
    color: #2c3e50;
    font-weight: 500;
    min-width: 100px;
  `;
  const prefillInput = document.createElement('input');
  prefillInput.type = 'text';
  prefillInput.value = option.prefill || '';
  prefillInput.placeholder = 'Enter prefill value (optional)';
  prefillInput.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  prefillInput.onblur = () => {
    option.prefill = prefillInput.value.trim();
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Initialize prefill property if it doesn't exist
  if (option.prefill === undefined) {
    option.prefill = '';
  }
  // Initialize conditionalPrefills array if it doesn't exist
  if (!option.conditionalPrefills || !Array.isArray(option.conditionalPrefills)) {
    option.conditionalPrefills = [];
  }
  // Conditional Prefill button
  const conditionalPrefillBtn = document.createElement('button');
  conditionalPrefillBtn.textContent = 'Conditional Prefill';
  conditionalPrefillBtn.style.cssText = `
    background: #17a2b8;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    margin-top: 5px;
    align-self: flex-start;
  `;
  conditionalPrefillBtn.onclick = () => {
    // Create new conditional prefill entry
    const newConditionalPrefill = { trigger: '', value: '' };
    option.conditionalPrefills.push(newConditionalPrefill);
    // Create and add the conditional prefill entry UI
    const conditionalPrefillEntry = createConditionalPrefillEntry(newConditionalPrefill, option.conditionalPrefills.length - 1, option, cell, conditionalPrefillsContainer);
    conditionalPrefillsContainer.appendChild(conditionalPrefillEntry);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Container for conditional prefill entries
  const conditionalPrefillsContainer = document.createElement('div');
  conditionalPrefillsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  `;
  // Create existing conditional prefill entries
  if (option.conditionalPrefills && option.conditionalPrefills.length > 0) {
    option.conditionalPrefills.forEach((conditionalPrefill, cpIndex) => {
      const entry = createConditionalPrefillEntry(conditionalPrefill, cpIndex, option, cell, conditionalPrefillsContainer);
      conditionalPrefillsContainer.appendChild(entry);
    });
  }
  // Assemble top row
  topRow.appendChild(dragHandle);
  topRow.appendChild(textInput);
  topRow.appendChild(amountLabel);
  topRow.appendChild(phoneLabel);
  topRow.appendChild(copyBtn);
  topRow.appendChild(deleteBtn);
  // Assemble prefill row
  prefillRow.appendChild(prefillLabel);
  prefillRow.appendChild(prefillInput);
  // Add rows to container
  optionContainer.appendChild(topRow);
  optionContainer.appendChild(prefillRow);
  optionContainer.appendChild(conditionalPrefillBtn);
  optionContainer.appendChild(conditionalPrefillsContainer);
  return optionContainer;
}
// Helper function to create a conditional prefill entry
function createConditionalPrefillEntry(conditionalPrefill, index, option, cell, parentContainer) {
  const entryContainer = document.createElement('div');
  entryContainer.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    background: #f8f9fa;
    border: 1px solid #ddd;
    border-radius: 4px;
  `;
  // Get number range from cell
  const rangeStart = cell._twoNumbers?.first ? parseInt(cell._twoNumbers.first) : 1;
  const rangeEnd = cell._twoNumbers?.second ? parseInt(cell._twoNumbers.second) : 1;
  // Trigger dropdown label
  const triggerLabel = document.createElement('label');
  triggerLabel.textContent = 'Trigger:';
  triggerLabel.style.cssText = `
    font-size: 12px;
    color: #2c3e50;
    font-weight: 500;
    min-width: 60px;
  `;
  // Trigger dropdown
  const triggerSelect = document.createElement('select');
  triggerSelect.dataset.conditionalPrefillTrigger = 'true';
  triggerSelect.style.cssText = `
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
    min-width: 80px;
  `;
  // Populate dropdown with range values
  for (let i = rangeStart; i <= rangeEnd; i++) {
    const optionEl = document.createElement('option');
    optionEl.value = i.toString();
    optionEl.textContent = i.toString();
    triggerSelect.appendChild(optionEl);
  }
  triggerSelect.value = conditionalPrefill.trigger || '';
  triggerSelect.onchange = () => {
    conditionalPrefill.trigger = triggerSelect.value;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Prefill value label
  const valueLabel = document.createElement('label');
  valueLabel.textContent = 'Prefill Value:';
  valueLabel.style.cssText = `
    font-size: 12px;
    color: #2c3e50;
    font-weight: 500;
    min-width: 90px;
  `;
  // Prefill value input
  const valueInput = document.createElement('input');
  valueInput.type = 'text';
  valueInput.value = conditionalPrefill.value || '';
  valueInput.placeholder = 'Enter prefill value';
  valueInput.style.cssText = `
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
  `;
  valueInput.onblur = () => {
    conditionalPrefill.value = valueInput.value.trim();
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.style.cssText = `
    background: #dc3545;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  removeBtn.onclick = () => {
    option.conditionalPrefills.splice(index, 1);
    entryContainer.remove();
    // Re-render all entries to update indices
    const existingEntries = parentContainer.querySelectorAll('[data-conditional-prefill-index]');
    existingEntries.forEach(entry => entry.remove());
    option.conditionalPrefills.forEach((cp, cpIndex) => {
      const newEntry = createConditionalPrefillEntry(cp, cpIndex, option, cell, parentContainer);
      parentContainer.appendChild(newEntry);
    });
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  entryContainer.dataset.conditionalPrefillIndex = index;
  entryContainer.appendChild(triggerLabel);
  entryContainer.appendChild(triggerSelect);
  entryContainer.appendChild(valueLabel);
  entryContainer.appendChild(valueInput);
  entryContainer.appendChild(removeBtn);
  return entryContainer;
}
// Helper function to create mini checkbox option entry
function createMiniCheckboxOption(option, optionIndex, checkbox, checkboxContainer, addButton, cell) {
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
  // Function to generate Node ID from field name and checkbox text
  const generateNodeId = (fieldName, checkboxText) => {
    const questionText = cell._questionText || '';
    const sanitizedQuestion = questionText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const sanitizedFieldName = (fieldName || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const sanitizedCheckboxText = (checkboxText || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    // Check if this question has a PDF property
    const pdfName = window.findPdfNameForQuestion ? window.findPdfNameForQuestion(cell) : null;
    const sanitizedPdfName = pdfName && window.sanitizePdfName ? window.sanitizePdfName(pdfName) : '';
    // Build the final ID with PDF name and question text prefix
    let idToCopy;
    if (sanitizedPdfName && sanitizedQuestion) {
      idToCopy = `${sanitizedPdfName}_${sanitizedQuestion}_${sanitizedFieldName}_${sanitizedCheckboxText}`;
    } else if (sanitizedQuestion) {
      idToCopy = `${sanitizedQuestion}_${sanitizedFieldName}_${sanitizedCheckboxText}`;
    } else {
      idToCopy = `${sanitizedFieldName}_${sanitizedCheckboxText}`;
    }
    return idToCopy;
  };
  // Initialize linked fields array if it doesn't exist
  if (!option.linkedFields) {
    option.linkedFields = [];
  }
  // Initialize PDF entries array if it doesn't exist
  if (!option.pdfEntries) {
    option.pdfEntries = [];
  }
  // Container for linked fields (created early so updateNodeId can access it)
  const linkedFieldsContainer = document.createElement('div');
  linkedFieldsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #e9ecef;
  `;
  // Container for PDF entries
  const pdfEntriesContainer = document.createElement('div');
  pdfEntriesContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #e9ecef;
  `;
  // Function to update Node ID and save
  const updateNodeId = () => {
    const fieldName = checkbox.fieldName || '';
    const checkboxText = checkboxTextInput.value || '';
    const generatedNodeId = generateNodeId(fieldName, checkboxText);
    option.nodeId = generatedNodeId;
    nodeIdInput.value = generatedNodeId;
    // Update all linked field titles when nodeId changes
    if (option.linkedFields && Array.isArray(option.linkedFields) && linkedFieldsContainer) {
      const linkedFieldEntries = linkedFieldsContainer.querySelectorAll('[data-linked-field-index]');
      linkedFieldEntries.forEach(entry => {
        if (entry.updateTitle && typeof entry.updateTitle === 'function') {
          entry.updateTitle();
        }
      });
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
    updateNodeId();
  };
  // Node ID display (non-editable, auto-generated)
  const nodeIdInput = document.createElement('input');
  nodeIdInput.type = 'text';
  nodeIdInput.readOnly = true;
  nodeIdInput.style.cssText = `
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 12px;
    background-color: #f8f9fa;
    color: #6c757d;
    cursor: pointer;
  `;
  // Double-click to copy functionality with visual indicator
  let copyIndicatorTimeout = null;
  nodeIdInput.ondblclick = () => {
    // Clear any existing indicator
    if (copyIndicatorTimeout) {
      clearTimeout(copyIndicatorTimeout);
    }
    // Copy to clipboard
    nodeIdInput.select();
    document.execCommand('copy');
    // Show visual indicator
    nodeIdInput.style.backgroundColor = '#d4edda';
    nodeIdInput.style.borderColor = '#28a745';
    nodeIdInput.style.color = '#155724';
    // Hide indicator after 1 second
    copyIndicatorTimeout = setTimeout(() => {
      nodeIdInput.style.backgroundColor = '#f8f9fa';
      nodeIdInput.style.borderColor = '#ddd';
      nodeIdInput.style.color = '#6c757d';
    }, 1000);
  };
  // Initialize Node ID
  updateNodeId();
  // Copy ID with number button
  const copyIdBtn = document.createElement('button');
  copyIdBtn.textContent = 'Copy ID';
  copyIdBtn.style.cssText = `
    background: #17a2b8;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 10px;
    margin-left: 4px;
  `;
  copyIdBtn.onclick = () => {
    const number = prompt('What number for this mini checkbox entry?');
    if (number !== null && number.trim() !== '') {
      const baseNodeId = nodeIdInput.value;
      const numberedNodeId = `${baseNodeId}_${number.trim()}`;
      // Copy to clipboard
      navigator.clipboard.writeText(numberedNodeId).then(() => {
        // Show visual indicator on the button
        const originalBg = copyIdBtn.style.backgroundColor;
        const originalText = copyIdBtn.textContent;
        copyIdBtn.style.backgroundColor = '#28a745';
        copyIdBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyIdBtn.style.backgroundColor = originalBg;
          copyIdBtn.textContent = originalText;
        }, 1000);
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = numberedNodeId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        // Show visual indicator
        const originalBg = copyIdBtn.style.backgroundColor;
        const originalText = copyIdBtn.textContent;
        copyIdBtn.style.backgroundColor = '#28a745';
        copyIdBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyIdBtn.style.backgroundColor = originalBg;
          copyIdBtn.textContent = originalText;
        }, 1000);
      });
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
  // Helper function to get all option entries from the numbered dropdown
  const getOptionEntries = () => {
    const options = [];
    const seenFieldNames = new Set(); // Track field names we've already added
    if (cell._textboxes && Array.isArray(cell._textboxes)) {
      const questionText = cell._questionText || '';
      const sanitizedQuestion = questionText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      // Check if this question has a PDF property
      const pdfName = window.findPdfNameForQuestion ? window.findPdfNameForQuestion(cell) : null;
      const sanitizedPdfName = pdfName && window.sanitizePdfName ? window.sanitizePdfName(pdfName) : '';
      const minValue = cell._twoNumbers ? (parseInt(cell._twoNumbers.first) || 1) : 1;
      cell._textboxes.forEach((textbox, textboxIndex) => {
        const fieldName = textbox.nameId || '';
        if (fieldName && !seenFieldNames.has(fieldName)) {
          seenFieldNames.add(fieldName);
          const sanitizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
          // Use the first entry number (minValue) for the node ID
          let nodeId;
          if (sanitizedPdfName && sanitizedQuestion) {
            nodeId = `${sanitizedPdfName}_${sanitizedQuestion}_${sanitizedFieldName}_${minValue}`;
          } else if (sanitizedQuestion) {
            nodeId = `${sanitizedQuestion}_${sanitizedFieldName}_${minValue}`;
          } else {
            nodeId = `${sanitizedFieldName}_${minValue}`;
          }
          options.push({
            nodeId: nodeId,
            label: fieldName,
            fieldName: fieldName,
            entryNum: minValue
          });
        }
      });
    }
    return options;
  };
  // Helper function to create a linked field entry
  const createLinkedFieldEntry = (linkedField, linkedFieldIndex) => {
    const linkedFieldEntry = document.createElement('div');
    linkedFieldEntry.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      background: #ffffff;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      margin-bottom: 6px;
    `;
    linkedFieldEntry.dataset.linkedFieldIndex = linkedFieldIndex;
    // Helper function to generate linked field title
    const generateLinkedFieldTitle = () => {
      const checkboxOptionNodeId = option.nodeId || '';
      let linkedFieldNodeId = linkedField.selectedNodeId || '';
      // Strip entry number suffix from linked field nodeId
      if (linkedFieldNodeId) {
        linkedFieldNodeId = linkedFieldNodeId.replace(/_\d+$/, '');
      }
      // Combine: checkboxOptionNodeId + linkedFieldNodeId
      if (checkboxOptionNodeId && linkedFieldNodeId) {
        return `${checkboxOptionNodeId}_${linkedFieldNodeId}`;
      } else if (checkboxOptionNodeId) {
        return checkboxOptionNodeId;
      } else if (linkedFieldNodeId) {
        return linkedFieldNodeId;
      }
      return '';
    };
    // Linked field title input (read-only, auto-generated)
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.readOnly = true;
    titleInput.value = generateLinkedFieldTitle();
    titleInput.placeholder = 'Linked Field Title (auto-generated)';
    titleInput.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ced4da;
      border-radius: 3px;
      font-size: 12px;
      background-color: #f8f9fa;
      color: #495057;
      cursor: pointer;
    `;
    titleInput.title = 'Double-click to copy to clipboard';
    // Update title when linked field nodeId changes
    const updateTitle = () => {
      const newTitle = generateLinkedFieldTitle();
      titleInput.value = newTitle;
      linkedField.title = newTitle; // Store for persistence
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    // Store updateTitle function on the linkedFieldEntry so it can be called externally
    linkedFieldEntry.updateTitle = updateTitle;
    // Double-click to copy functionality with visual indicator
    let copyIndicatorTimeout = null;
    titleInput.ondblclick = () => {
      // Clear any existing indicator
      if (copyIndicatorTimeout) {
        clearTimeout(copyIndicatorTimeout);
      }
      // Prompt user for a number
      const number = prompt('Enter a number to append to the ID:');
      if (number === null || number.trim() === '') {
        return; // User cancelled or entered nothing
      }
      // Get the base ID from the title input
      const baseId = titleInput.value || '';
      if (!baseId) {
        alert('No ID to copy');
        return;
      }
      // Append the number to the ID
      const idToCopy = `${baseId}_${number.trim()}`;
      // Copy to clipboard
      const textArea = document.createElement('textarea');
      textArea.value = idToCopy;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
      }
      document.body.removeChild(textArea);
      // Show visual indicator (green)
      const originalBg = titleInput.style.backgroundColor;
      const originalBorder = titleInput.style.borderColor;
      const originalColor = titleInput.style.color;
      titleInput.style.backgroundColor = '#d4edda';
      titleInput.style.borderColor = '#28a745';
      titleInput.style.color = '#155724';
      // Hide indicator after 1 second
      copyIndicatorTimeout = setTimeout(() => {
        titleInput.style.backgroundColor = originalBg;
        titleInput.style.borderColor = originalBorder;
        titleInput.style.color = originalColor;
      }, 1000);
    };
    // Linked field dropdown
    const linkedFieldSelect = document.createElement('select');
    linkedFieldSelect.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ced4da;
      border-radius: 3px;
      font-size: 12px;
      background: white;
    `;
    // Populate dropdown with option entries
    const optionEntries = getOptionEntries();
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select an option...';
    linkedFieldSelect.appendChild(defaultOption);
    optionEntries.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.nodeId;
      option.textContent = opt.label;
      if (linkedField.selectedNodeId === opt.nodeId) {
        option.selected = true;
      }
      linkedFieldSelect.appendChild(option);
    });
    linkedFieldSelect.onchange = () => {
      linkedField.selectedNodeId = linkedFieldSelect.value;
      updateTitle(); // Update the auto-generated title
    };
    // Delete linked field button
    const deleteLinkedFieldBtn = document.createElement('button');
    deleteLinkedFieldBtn.textContent = 'Delete';
    deleteLinkedFieldBtn.style.cssText = `
      background: #dc3545;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      align-self: flex-end;
      margin-top: 4px;
    `;
    deleteLinkedFieldBtn.onclick = () => {
      option.linkedFields.splice(linkedFieldIndex, 1);
      linkedFieldEntry.remove();
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    linkedFieldEntry.appendChild(titleInput);
    linkedFieldEntry.appendChild(linkedFieldSelect);
    linkedFieldEntry.appendChild(deleteLinkedFieldBtn);
    return linkedFieldEntry;
  };
  // Render existing linked fields
  if (option.linkedFields && option.linkedFields.length > 0) {
    option.linkedFields.forEach((linkedField, linkedFieldIndex) => {
      const linkedFieldEntry = createLinkedFieldEntry(linkedField, linkedFieldIndex);
      linkedFieldsContainer.appendChild(linkedFieldEntry);
    });
  }
  // Add Linked Field button
  const addLinkedFieldBtn = document.createElement('button');
  addLinkedFieldBtn.textContent = 'Add Linked Field';
  addLinkedFieldBtn.style.cssText = `
    background: #28a745;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    margin-top: 4px;
    align-self: flex-start;
  `;
  addLinkedFieldBtn.onclick = () => {
    const newLinkedField = {
      title: '',
      selectedNodeId: ''
    };
    option.linkedFields.push(newLinkedField);
    const linkedFieldEntry = createLinkedFieldEntry(newLinkedField, option.linkedFields.length - 1);
    linkedFieldsContainer.insertBefore(linkedFieldEntry, addLinkedFieldBtn);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  linkedFieldsContainer.appendChild(addLinkedFieldBtn);
  // Helper function to create a PDF entry
  const createPdfEntry = (pdfEntry, pdfEntryIndex) => {
    const pdfEntryDiv = document.createElement('div');
    pdfEntryDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      background: #ffffff;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      margin-bottom: 6px;
    `;
    pdfEntryDiv.dataset.pdfEntryIndex = pdfEntryIndex;
    // Trigger Number input
    const triggerNumberInput = document.createElement('input');
    triggerNumberInput.type = 'text';
    triggerNumberInput.value = pdfEntry.triggerNumber || '';
    triggerNumberInput.placeholder = 'Trigger Number';
    triggerNumberInput.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ced4da;
      border-radius: 3px;
      font-size: 12px;
    `;
    triggerNumberInput.onblur = () => {
      pdfEntry.triggerNumber = triggerNumberInput.value;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    // PDF Name input
    const pdfNameInput = document.createElement('input');
    pdfNameInput.type = 'text';
    pdfNameInput.value = pdfEntry.pdfName || '';
    pdfNameInput.placeholder = 'PDF Name';
    pdfNameInput.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ced4da;
      border-radius: 3px;
      font-size: 12px;
    `;
    pdfNameInput.onblur = () => {
      pdfEntry.pdfName = pdfNameInput.value;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    // PDF File input
    const pdfFileInput = document.createElement('input');
    pdfFileInput.type = 'text';
    pdfFileInput.value = pdfEntry.pdfFile || '';
    pdfFileInput.placeholder = 'PDF File';
    pdfFileInput.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ced4da;
      border-radius: 3px;
      font-size: 12px;
    `;
    pdfFileInput.onblur = () => {
      pdfEntry.pdfFile = pdfFileInput.value;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    // Price ID input
    const priceIdInput = document.createElement('input');
    priceIdInput.type = 'text';
    priceIdInput.value = pdfEntry.priceId || '';
    priceIdInput.placeholder = 'Price ID';
    priceIdInput.style.cssText = `
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ced4da;
      border-radius: 3px;
      font-size: 12px;
    `;
    priceIdInput.onblur = () => {
      pdfEntry.priceId = priceIdInput.value;
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    // Delete PDF entry button
    const deletePdfEntryBtn = document.createElement('button');
    deletePdfEntryBtn.textContent = 'Delete';
    deletePdfEntryBtn.style.cssText = `
      background: #dc3545;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      align-self: flex-end;
      margin-top: 4px;
    `;
    deletePdfEntryBtn.onclick = () => {
      option.pdfEntries.splice(pdfEntryIndex, 1);
      pdfEntryDiv.remove();
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    pdfEntryDiv.appendChild(triggerNumberInput);
    pdfEntryDiv.appendChild(pdfNameInput);
    pdfEntryDiv.appendChild(pdfFileInput);
    pdfEntryDiv.appendChild(priceIdInput);
    pdfEntryDiv.appendChild(deletePdfEntryBtn);
    return pdfEntryDiv;
  };
  // Render existing PDF entries
  if (option.pdfEntries && option.pdfEntries.length > 0) {
    option.pdfEntries.forEach((pdfEntry, pdfEntryIndex) => {
      const pdfEntryDiv = createPdfEntry(pdfEntry, pdfEntryIndex);
      pdfEntriesContainer.appendChild(pdfEntryDiv);
    });
  }
  // Add PDF button
  const addPdfBtn = document.createElement('button');
  addPdfBtn.textContent = 'Add PDF';
  addPdfBtn.style.cssText = `
    background: #007bff;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    margin-top: 4px;
    align-self: flex-start;
  `;
  addPdfBtn.onclick = () => {
    const newPdfEntry = {
      triggerNumber: '',
      pdfName: '',
      pdfFile: '',
      priceId: ''
    };
    option.pdfEntries.push(newPdfEntry);
    const pdfEntryDiv = createPdfEntry(newPdfEntry, option.pdfEntries.length - 1);
    pdfEntriesContainer.insertBefore(pdfEntryDiv, addPdfBtn);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  pdfEntriesContainer.appendChild(addPdfBtn);
  // Assemble mini option entry
  miniOptionEntry.appendChild(checkboxTextInput);
  miniOptionEntry.appendChild(nodeIdInput);
  miniOptionEntry.appendChild(copyIdBtn);
  miniOptionEntry.appendChild(deleteMiniBtn);
  // Add linked fields container below the main row
  miniOptionEntry.style.flexDirection = 'column';
  miniOptionEntry.style.alignItems = 'stretch';
  // Create a wrapper for the top row
  const topRow = document.createElement('div');
  topRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  topRow.appendChild(checkboxTextInput);
  topRow.appendChild(nodeIdInput);
  topRow.appendChild(copyIdBtn);
  topRow.appendChild(deleteMiniBtn);
  // Clear and rebuild mini option entry
  miniOptionEntry.innerHTML = '';
  miniOptionEntry.appendChild(topRow);
  miniOptionEntry.appendChild(linkedFieldsContainer);
  miniOptionEntry.appendChild(pdfEntriesContainer);
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
  // Function to generate Time Node ID from time text
  const generateTimeNodeId = (timeText) => {
    const questionText = cell._questionText || '';
    const sanitizedQuestion = questionText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const sanitizedTimeText = (timeText || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    // Check if this question has a PDF property
    const pdfName = window.findPdfNameForQuestion ? window.findPdfNameForQuestion(cell) : null;
    const sanitizedPdfName = pdfName && window.sanitizePdfName ? window.sanitizePdfName(pdfName) : '';
    // Build the final ID with PDF name and question text prefix
    let idToCopy;
    if (sanitizedPdfName && sanitizedQuestion) {
      idToCopy = `${sanitizedPdfName}_${sanitizedQuestion}_${sanitizedTimeText}`;
    } else if (sanitizedQuestion) {
      idToCopy = `${sanitizedQuestion}_${sanitizedTimeText}`;
    } else {
      idToCopy = sanitizedTimeText || `time_${index}`;
    }
    return idToCopy;
  };
  // Function to update Time Node ID and save
  const updateTimeNodeId = () => {
    const timeText = timeTextInput.value || '';
    const generatedTimeId = generateTimeNodeId(timeText);
    time.timeId = generatedTimeId;
    timeIdInput.value = generatedTimeId;
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        // Explicitly set the cell properties
        graph.getModel().setValue(cell, cell.value);
        // Also ensure the properties are marked as changed
        cell._times = cell._times; // Force property update
      } finally {
        graph.getModel().endUpdate();
      }
    }
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
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
    updateTimeNodeId();
  };
  // Time ID display (non-editable, auto-generated)
  const timeIdInput = document.createElement('input');
  timeIdInput.type = 'text';
  timeIdInput.readOnly = true;
  timeIdInput.style.cssText = `
    flex: 1;
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: #f8f9fa;
    color: #6c757d;
    cursor: pointer;
  `;
  // Double-click to copy functionality with visual indicator
  let copyIndicatorTimeout = null;
  timeIdInput.ondblclick = () => {
    // Clear any existing indicator
    if (copyIndicatorTimeout) {
      clearTimeout(copyIndicatorTimeout);
    }
    // Copy to clipboard
    timeIdInput.select();
    document.execCommand('copy');
    // Show visual indicator
    timeIdInput.style.backgroundColor = '#d4edda';
    timeIdInput.style.borderColor = '#28a745';
    timeIdInput.style.color = '#155724';
    // Hide indicator after 1 second
    copyIndicatorTimeout = setTimeout(() => {
      timeIdInput.style.backgroundColor = '#f8f9fa';
      timeIdInput.style.borderColor = '#ddd';
      timeIdInput.style.color = '#6c757d';
    }, 1000);
  };
  // Initialize Time Node ID
  updateTimeNodeId();
  // Copy ID with number button
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy ID';
  copyBtn.style.cssText = `
    background: #17a2b8;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  copyBtn.onclick = () => {
    const number = prompt('What number for this time entry?');
    if (number !== null && number.trim() !== '') {
      const baseTimeId = timeIdInput.value;
      const numberedTimeId = `${baseTimeId}_${number.trim()}`;
      // Copy to clipboard
      navigator.clipboard.writeText(numberedTimeId).then(() => {
        // Show visual indicator on the button
        const originalBg = copyBtn.style.backgroundColor;
        const originalText = copyBtn.textContent;
        copyBtn.style.backgroundColor = '#28a745';
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.style.backgroundColor = originalBg;
          copyBtn.textContent = originalText;
        }, 1000);
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = numberedTimeId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        // Show visual indicator
        const originalBg = copyBtn.style.backgroundColor;
        const originalText = copyBtn.textContent;
        copyBtn.style.backgroundColor = '#28a745';
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.style.backgroundColor = originalBg;
          copyBtn.textContent = originalText;
        }, 1000);
      });
    }
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
    // Prevent multiple rapid clicks
    if (deleteBtn.disabled) {
      return;
    }
    // Disable button to prevent multiple clicks
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';
    if (!cell._times) cell._times = [];
    cell._times.splice(index, 1);
    // Remove the time container from the DOM
    timeContainer.remove();
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
    // Update all mini option Node IDs when field name changes
    if (checkbox.options && checkbox.options.length > 0) {
      const questionText = cell._questionText || '';
      const sanitizedQuestion = questionText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      // Check if this question has a PDF property
      const pdfName = window.findPdfNameForQuestion ? window.findPdfNameForQuestion(cell) : null;
      const sanitizedPdfName = pdfName && window.sanitizePdfName ? window.sanitizePdfName(pdfName) : '';
      checkbox.options.forEach((option, optionIndex) => {
        const fieldName = checkbox.fieldName || '';
        const checkboxText = option.checkboxText || '';
        const sanitizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        const sanitizedCheckboxText = checkboxText.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        // Build the final ID with PDF name and question text prefix
        let nodeId;
        if (sanitizedPdfName && sanitizedQuestion) {
          nodeId = `${sanitizedPdfName}_${sanitizedQuestion}_${sanitizedFieldName}_${sanitizedCheckboxText}`;
        } else if (sanitizedQuestion) {
          nodeId = `${sanitizedQuestion}_${sanitizedFieldName}_${sanitizedCheckboxText}`;
        } else {
          nodeId = `${sanitizedFieldName}_${sanitizedCheckboxText}`;
        }
        option.nodeId = nodeId;
      });
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
    // Prevent multiple rapid clicks
    if (deleteBtn.disabled) {
      return;
    }
    // Disable button to prevent multiple clicks
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting...';
    if (!cell._checkboxes) cell._checkboxes = [];
    cell._checkboxes.splice(index, 1);
    // Remove the checkbox container from the DOM
    checkboxContainer.remove();
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
    // Create new checkbox option
    const newOption = { checkboxText: '', nodeId: '' };
    if (!checkbox.options) checkbox.options = [];
    checkbox.options.push(newOption);
    // Create mini checkbox option entry
    const miniOptionEntry = createMiniCheckboxOption(newOption, checkbox.options.length - 1, checkbox, checkboxContainer, addCheckboxOptionBtn, cell);
    // Insert the mini option above the "Add checkbox option" button
    checkboxContainer.appendChild(miniOptionEntry);
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
  // Selection type dropdown
  const selectionTypeLabel = document.createElement('label');
  selectionTypeLabel.textContent = 'Selection Type:';
  selectionTypeLabel.style.cssText = `
    display: block;
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 4px;
    margin-top: 8px;
    color: #333;
  `;
  const selectionTypeSelect = document.createElement('select');
  selectionTypeSelect.style.cssText = `
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 12px;
    margin-bottom: 8px;
    background: white;
  `;
  const markAllOption = document.createElement('option');
  markAllOption.value = 'multiple';
  markAllOption.textContent = 'Mark All That Apply';
  const markOneOption = document.createElement('option');
  markOneOption.value = 'single';
  markOneOption.textContent = 'Mark Only One';
  selectionTypeSelect.appendChild(markAllOption);
  selectionTypeSelect.appendChild(markOneOption);
  // Initialize selection type
  if (!checkbox.selectionType) {
    checkbox.selectionType = 'multiple';
  }
  selectionTypeSelect.value = checkbox.selectionType || 'multiple';
  selectionTypeSelect.onchange = () => {
    checkbox.selectionType = selectionTypeSelect.value;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Required type dropdown
  const requiredTypeLabel = document.createElement('label');
  requiredTypeLabel.textContent = 'Required Type:';
  requiredTypeLabel.style.cssText = `
    display: block;
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 4px;
    margin-top: 8px;
    color: #333;
  `;
  const requiredTypeSelect = document.createElement('select');
  requiredTypeSelect.style.cssText = `
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 12px;
    margin-bottom: 8px;
    background: white;
  `;
  const requiredOption = document.createElement('option');
  requiredOption.value = 'required';
  requiredOption.textContent = 'Required';
  const optionalOption = document.createElement('option');
  optionalOption.value = 'optional';
  optionalOption.textContent = 'Optional';
  requiredTypeSelect.appendChild(requiredOption);
  requiredTypeSelect.appendChild(optionalOption);
  // Initialize required type
  if (!checkbox.required) {
    checkbox.required = 'required';
  }
  requiredTypeSelect.value = checkbox.required;
  requiredTypeSelect.onchange = () => {
    checkbox.required = requiredTypeSelect.value;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Assemble checkbox container
  checkboxContainer.appendChild(topRow);
  checkboxContainer.appendChild(selectionTypeLabel);
  checkboxContainer.appendChild(selectionTypeSelect);
  checkboxContainer.appendChild(requiredTypeLabel);
  checkboxContainer.appendChild(requiredTypeSelect);
  // Add existing mini checkbox options BEFORE the "Add checkbox option" button
  if (checkbox.options && checkbox.options.length > 0) {
    checkbox.options.forEach((option, optionIndex) => {
      const miniOptionEntry = createMiniCheckboxOption(option, optionIndex, checkbox, checkboxContainer, addCheckboxOptionBtn, cell);
      checkboxContainer.appendChild(miniOptionEntry);
    });
  }
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
  // Location is now included in the unified textbox options container, so we don't need a separate section
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
// Helper function to create textbox options container (unified with location entries)
function createTextboxOptionsContainer(cell) {
  const container = document.createElement('div');
  container.className = 'unified-textbox-fields-container';
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;
  // Initialize item order if it doesn't exist
  if (!cell._itemOrder) {
    cell._itemOrder = [];
    const textboxes = cell._textboxes || [];
    const checkboxes = cell._checkboxes || [];
    const times = cell._times || [];
    const dropdowns = cell._dropdowns || [];
    const locationIndex = cell._locationIndex !== undefined && cell._locationIndex >= 0 ? cell._locationIndex : -1;
    // Add all textboxes first
    textboxes.forEach((_, index) => {
      cell._itemOrder.push({ type: 'textbox', index: index });
    });
    // Add checkboxes
    checkboxes.forEach((_, index) => {
      cell._itemOrder.push({ type: 'checkbox', index: index });
    });
    // Add times
    times.forEach((_, index) => {
      cell._itemOrder.push({ type: 'time', index: index });
    });
    // Add dropdowns
    dropdowns.forEach((_, index) => {
      cell._itemOrder.push({ type: 'dropdown', index: index });
    });
    // Add location if it exists (at the end by default)
    if (locationIndex >= 0) {
      cell._itemOrder.push({ type: 'location', index: locationIndex });
    }
  }
  // Add drag and drop event listeners
  let draggedElement = null;
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Add visual feedback for where the item will be dropped
    const dropTarget = e.target.closest('[data-index]');
    if (dropTarget && (dropTarget.dataset.type === 'textbox' || dropTarget.dataset.type === 'location' || 
        dropTarget.dataset.type === 'checkbox' || dropTarget.dataset.type === 'time' || 
        dropTarget.dataset.type === 'dropdown')) {
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
    if (dropTarget && (dropTarget.dataset.type === 'textbox' || dropTarget.dataset.type === 'location' || 
        dropTarget.dataset.type === 'checkbox' || dropTarget.dataset.type === 'time' || 
        dropTarget.dataset.type === 'dropdown')) {
      dropTarget.style.borderColor = '#ddd';
      dropTarget.style.borderWidth = '1px';
    }
  });
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedElement) return;
    const dropTarget = e.target.closest('[data-index]');
    if (!dropTarget || dropTarget === draggedElement) return;
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
    if (draggedType === dropType && draggedType === 'textbox') {
      // Reorder textboxes
      const textboxes = cell._textboxes || [];
      const draggedTextbox = textboxes[draggedIndex];
      textboxes.splice(draggedIndex, 1);
      textboxes.splice(dropIndex, 0, draggedTextbox);
      // Update item order
      const draggedItemIndex = cell._itemOrder.findIndex(item => 
        item.type === 'textbox' && item.index === draggedIndex
      );
      const targetItemIndex = cell._itemOrder.findIndex(item => 
        item.type === 'textbox' && item.index === dropIndex
      );
      if (draggedItemIndex !== -1 && targetItemIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedItemIndex, 1)[0];
        cell._itemOrder.splice(targetItemIndex, 0, draggedItem);
        // Update indices in item order
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'textbox') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'textbox'
            ).length - 1;
          }
        });
      }
    } else if (draggedType === 'location' && dropType === 'textbox') {
      // Move location to position of textbox
      const locationItemIndex = cell._itemOrder.findIndex(item => item.type === 'location');
      const targetItemIndex = cell._itemOrder.findIndex(item => 
        item.type === 'textbox' && item.index === dropIndex
      );
      if (locationItemIndex !== -1 && targetItemIndex !== -1) {
        const locationItem = cell._itemOrder.splice(locationItemIndex, 1)[0];
        cell._itemOrder.splice(targetItemIndex, 0, locationItem);
        cell._locationIndex = dropIndex;
      }
    } else if (draggedType === 'textbox' && dropType === 'location') {
      // Move textbox to position of location
      const textboxes = cell._textboxes || [];
      const draggedTextbox = textboxes[draggedIndex];
      textboxes.splice(draggedIndex, 1);
      const locationItemIndex = cell._itemOrder.findIndex(item => item.type === 'location');
      const targetItemIndex = cell._itemOrder.findIndex(item => 
        item.type === 'textbox' && item.index === dropIndex
      );
      if (locationItemIndex !== -1) {
        // Insert textbox before location
        textboxes.splice(locationItemIndex > 0 ? locationItemIndex - 1 : 0, 0, draggedTextbox);
        const draggedItemIndex = cell._itemOrder.findIndex(item => 
          item.type === 'textbox' && item.index === draggedIndex
        );
        if (draggedItemIndex !== -1) {
          const draggedItem = cell._itemOrder.splice(draggedItemIndex, 1)[0];
          cell._itemOrder.splice(locationItemIndex, 0, draggedItem);
          // Update indices
          cell._itemOrder.forEach((item, index) => {
            if (item.type === 'textbox') {
              item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
                prevIndex <= index && prevItem.type === 'textbox'
              ).length - 1;
            }
          });
        }
      }
    } else if (draggedType === 'checkbox' && dropType === 'checkbox') {
      // Reorder checkboxes using unified item order
      const checkboxes = cell._checkboxes || [];
      // Find the dragged checkbox in the item order
      const draggedCheckboxIndex = cell._itemOrder.findIndex(item => 
        item.type === 'checkbox' && item.index === draggedIndex
      );
      // Find the target checkbox in the item order
      const targetCheckboxIndex = cell._itemOrder.findIndex(item => 
        item.type === 'checkbox' && item.index === dropIndex
      );
      if (draggedCheckboxIndex !== -1 && targetCheckboxIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedCheckboxIndex, 1)[0];
        cell._itemOrder.splice(targetCheckboxIndex, 0, draggedItem);
        // Update indices
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'checkbox') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'checkbox'
            ).length - 1;
          }
        });
      }
    } else if (draggedType === 'time' && dropType === 'time') {
      // Reorder times using unified item order
      const times = cell._times || [];
      // Find the dragged time in the item order
      const draggedTimeIndex = cell._itemOrder.findIndex(item => 
        item.type === 'time' && item.index === draggedIndex
      );
      // Find the target time in the item order
      const targetTimeIndex = cell._itemOrder.findIndex(item => 
        item.type === 'time' && item.index === dropIndex
      );
      if (draggedTimeIndex !== -1 && targetTimeIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedTimeIndex, 1)[0];
        cell._itemOrder.splice(targetTimeIndex, 0, draggedItem);
        // Update indices
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'time') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'time'
            ).length - 1;
          }
        });
      }
    } else if (draggedType === 'dropdown' && dropType === 'dropdown') {
      // Reorder dropdowns using unified item order
      const dropdowns = cell._dropdowns || [];
      // Find the dragged dropdown in the item order
      const draggedDropdownIndex = cell._itemOrder.findIndex(item => 
        item.type === 'dropdown' && item.index === draggedIndex
      );
      // Find the target dropdown in the item order
      const targetDropdownIndex = cell._itemOrder.findIndex(item => 
        item.type === 'dropdown' && item.index === dropIndex
      );
      if (draggedDropdownIndex !== -1 && targetDropdownIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedDropdownIndex, 1)[0];
        cell._itemOrder.splice(targetDropdownIndex, 0, draggedItem);
        // Update indices
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'dropdown') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'dropdown'
            ).length - 1;
          }
        });
      }
    } else if ((draggedType === 'checkbox' || draggedType === 'time' || draggedType === 'dropdown') && 
               (dropType === 'textbox' || dropType === 'checkbox' || dropType === 'time' || dropType === 'dropdown' || dropType === 'location')) {
      // Move checkbox/time/dropdown to position of another field type
      const draggedItemIndex = cell._itemOrder.findIndex(item => 
        item.type === draggedType && item.index === draggedIndex
      );
      let targetItemIndex = -1;
      if (dropType === 'location') {
        targetItemIndex = cell._itemOrder.findIndex(item => item.type === 'location');
      } else {
        targetItemIndex = cell._itemOrder.findIndex(item => 
          item.type === dropType && item.index === dropIndex
        );
      }
      if (draggedItemIndex !== -1 && targetItemIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedItemIndex, 1)[0];
        cell._itemOrder.splice(targetItemIndex, 0, draggedItem);
      }
    } else if (draggedType === 'textbox' && (dropType === 'checkbox' || dropType === 'time' || dropType === 'dropdown')) {
      // Move textbox to position of checkbox/time/dropdown
      const draggedItemIndex = cell._itemOrder.findIndex(item => 
        item.type === 'textbox' && item.index === draggedIndex
      );
      const targetItemIndex = cell._itemOrder.findIndex(item => 
        item.type === dropType && item.index === dropIndex
      );
      if (draggedItemIndex !== -1 && targetItemIndex !== -1) {
        const draggedItem = cell._itemOrder.splice(draggedItemIndex, 1)[0];
        cell._itemOrder.splice(targetItemIndex, 0, draggedItem);
        // Update textbox indices
        cell._itemOrder.forEach((item, index) => {
          if (item.type === 'textbox') {
            item.index = cell._itemOrder.filter((prevItem, prevIndex) => 
              prevIndex <= index && prevItem.type === 'textbox'
            ).length - 1;
          }
        });
      }
    } else if (draggedType === 'location' && (dropType === 'checkbox' || dropType === 'time' || dropType === 'dropdown')) {
      // Move location to position of checkbox/time/dropdown
      const locationItemIndex = cell._itemOrder.findIndex(item => item.type === 'location');
      const targetItemIndex = cell._itemOrder.findIndex(item => 
        item.type === dropType && item.index === dropIndex
      );
      if (locationItemIndex !== -1 && targetItemIndex !== -1) {
        const locationItem = cell._itemOrder.splice(locationItemIndex, 1)[0];
        cell._itemOrder.splice(targetItemIndex, 0, locationItem);
      }
    }
    // Clean up visual feedback
    container.querySelectorAll('[data-index]').forEach(element => {
      element.style.borderColor = '#ddd';
      element.style.borderWidth = '1px';
    });
    // Refresh the container
    const newContainer = createTextboxOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  });
  // Render items in unified order
  const textboxes = cell._textboxes || [];
  const checkboxes = cell._checkboxes || [];
  const times = cell._times || [];
  const dropdowns = cell._dropdowns || [];
  const locationIndex = cell._locationIndex !== undefined && cell._locationIndex >= 0 ? cell._locationIndex : -1;
  if (cell._itemOrder && cell._itemOrder.length > 0) {
    cell._itemOrder.forEach((item, displayIndex) => {
      if (item.type === 'textbox' && textboxes[item.index]) {
        const textboxContainer = createTextboxField(textboxes[item.index], item.index, cell, container);
        // Add drag event listeners
        textboxContainer.addEventListener('dragstart', (e) => {
          draggedElement = textboxContainer;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', JSON.stringify({ 
            cellId: cell.id, 
            index: item.index, 
            type: 'textbox' 
          }));
          textboxContainer.style.opacity = '0.5';
        });
        textboxContainer.addEventListener('dragend', (e) => {
          textboxContainer.style.opacity = '1';
          draggedElement = null;
        });
        container.appendChild(textboxContainer);
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
      } else if (item.type === 'dropdown' && dropdowns[item.index]) {
        const unifiedDropdownEntry = createUnifiedDropdownEntry(dropdowns[item.index], item.index, cell);
        // Add drag event listeners
        unifiedDropdownEntry.addEventListener('dragstart', (e) => {
          draggedElement = unifiedDropdownEntry;
          e.dataTransfer.effectAllowed = 'move';
          unifiedDropdownEntry.style.opacity = '0.5';
        });
        unifiedDropdownEntry.addEventListener('dragend', (e) => {
          unifiedDropdownEntry.style.opacity = '1';
          draggedElement = null;
        });
        container.appendChild(unifiedDropdownEntry);
      } else if (item.type === 'location' && locationIndex >= 0) {
        const locationIndicator = createTextboxLocationIndicator(cell, container);
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
        });
        locationIndicator.addEventListener('dragend', (e) => {
          locationIndicator.style.opacity = '1';
          draggedElement = null;
        });
        container.appendChild(locationIndicator);
      }
    });
  } else {
    // Fallback to default order (textboxes first, then location)
    textboxes.forEach((textbox, index) => {
      const textboxContainer = createTextboxField(textbox, index, cell, container);
      // Add drag event listeners
      textboxContainer.addEventListener('dragstart', (e) => {
        draggedElement = textboxContainer;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ 
          cellId: cell.id, 
          index: index, 
          type: 'textbox' 
        }));
        textboxContainer.style.opacity = '0.5';
      });
      textboxContainer.addEventListener('dragend', (e) => {
        textboxContainer.style.opacity = '1';
        draggedElement = null;
      });
      container.appendChild(textboxContainer);
      // Add location indicator BEFORE this textbox if it's at the location index
      if (index === locationIndex) {
        const locationIndicator = createTextboxLocationIndicator(cell, container);
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
        });
        locationIndicator.addEventListener('dragend', (e) => {
          locationIndicator.style.opacity = '1';
          draggedElement = null;
        });
        container.appendChild(locationIndicator);
      }
    });
    // Add location indicator at the end if location index is beyond the current textboxes
    if (locationIndex >= textboxes.length) {
      const locationIndicator = createTextboxLocationIndicator(cell, container);
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
      });
      locationIndicator.addEventListener('dragend', (e) => {
        locationIndicator.style.opacity = '1';
        draggedElement = null;
      });
      container.appendChild(locationIndicator);
    }
  }
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
    const newTextbox = { nameId: '', placeholder: 'Enter value', isAmountOption: false, prefill: '' };
    if (!cell._textboxes) cell._textboxes = [];
    cell._textboxes.push(newTextbox);
    // Initialize item order if it doesn't exist
    if (!cell._itemOrder) {
      cell._itemOrder = [];
      const existingTextboxes = cell._textboxes.slice(0, -1);
      existingTextboxes.forEach((_, index) => {
        cell._itemOrder.push({ type: 'textbox', index: index });
      });
      if (cell._locationIndex >= 0) {
        cell._itemOrder.push({ type: 'location', index: cell._locationIndex });
      }
    }
    // Add the new textbox to the end of the item order (before location if it exists)
    const locationItemIndex = cell._itemOrder.findIndex(item => item.type === 'location');
    if (locationItemIndex !== -1) {
      cell._itemOrder.splice(locationItemIndex, 0, { type: 'textbox', index: cell._textboxes.length - 1 });
    } else {
      cell._itemOrder.push({ type: 'textbox', index: cell._textboxes.length - 1 });
    }
    // Refresh the container
    const newContainer = createTextboxOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  container.appendChild(addBtn);
  // Add Checkbox button
  const addCheckboxBtn = document.createElement('button');
  addCheckboxBtn.textContent = '+ Add Checkbox';
  addCheckboxBtn.style.cssText = `
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
  addCheckboxBtn.onclick = () => {
    // Create new checkbox entry
    const newCheckbox = { fieldName: '', options: [], selectionType: 'multiple' };
    if (!cell._checkboxes) cell._checkboxes = [];
    cell._checkboxes.push(newCheckbox);
    // Initialize item order if it doesn't exist
    if (!cell._itemOrder) {
      cell._itemOrder = [];
      const textboxes = cell._textboxes || [];
      const locationIndex = cell._locationIndex !== undefined && cell._locationIndex >= 0 ? cell._locationIndex : -1;
      textboxes.forEach((_, index) => {
        cell._itemOrder.push({ type: 'textbox', index: index });
      });
      if (locationIndex >= 0) {
        cell._itemOrder.push({ type: 'location', index: locationIndex });
      }
    }
    // Add the new checkbox to the end of the item order
    cell._itemOrder.push({ type: 'checkbox', index: cell._checkboxes.length - 1 });
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        graph.getModel().setValue(cell, cell.value);
        cell._checkboxes = cell._checkboxes;
        cell._itemOrder = cell._itemOrder;
      } finally {
        graph.getModel().endUpdate();
      }
    }
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    // Refresh the canvas display
    if (typeof window.updateMultipleTextboxesCell === 'function') {
      window.updateMultipleTextboxesCell(cell);
    }
    // Refresh the entire container to show the new checkbox entry
    const newContainer = createTextboxOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
  };
  container.appendChild(addCheckboxBtn);
  // Add Location button (always show, but handle if location already exists)
  const addLocationBtn = document.createElement('button');
  addLocationBtn.textContent = '+ Add Location';
  addLocationBtn.style.cssText = `
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
  addLocationBtn.onclick = () => {
    // Only add if location doesn't exist
    if (locationIndex < 0) {
      cell._locationIndex = (cell._textboxes || []).length;
      // Initialize item order if it doesn't exist
      if (!cell._itemOrder) {
        cell._itemOrder = [];
        const textboxes = cell._textboxes || [];
        textboxes.forEach((_, index) => {
          cell._itemOrder.push({ type: 'textbox', index: index });
        });
      }
      // Add location to the end of the item order
      cell._itemOrder.push({ type: 'location', index: cell._locationIndex });
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
      // Refresh the container
      const newContainer = createTextboxOptionsContainer(cell);
      container.parentNode.replaceChild(newContainer, container);
    }
  };
  container.appendChild(addLocationBtn);
  // Add Time button
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
    // Prevent multiple rapid clicks
    if (addTimeBtn.disabled) {
      return;
    }
    // Disable button to prevent multiple clicks
    addTimeBtn.disabled = true;
    addTimeBtn.textContent = 'Adding...';
    // Create new time entry
    const newTime = { timeText: '', timeId: '' };
    if (!cell._times) cell._times = [];
    cell._times.push(newTime);
    // Initialize item order if it doesn't exist
    if (!cell._itemOrder) {
      cell._itemOrder = [];
      const textboxes = cell._textboxes || [];
      const locationIndex = cell._locationIndex !== undefined && cell._locationIndex >= 0 ? cell._locationIndex : -1;
      textboxes.forEach((_, index) => {
        cell._itemOrder.push({ type: 'textbox', index: index });
      });
      if (locationIndex >= 0) {
        cell._itemOrder.push({ type: 'location', index: locationIndex });
      }
    }
    // Add the new time to the end of the item order
    cell._itemOrder.push({ type: 'time', index: cell._times.length - 1 });
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
    // Refresh the canvas display
    if (typeof window.updateMultipleTextboxesCell === 'function') {
      window.updateMultipleTextboxesCell(cell);
    }
    // Refresh the entire container to show the new time entry
    const newContainer = createTextboxOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
    // Re-enable button after a short delay
    setTimeout(() => {
      addTimeBtn.disabled = false;
      addTimeBtn.textContent = '+ Add Time';
    }, 500);
  };
  container.appendChild(addTimeBtn);
  // Add Dropdown button
  const addDropdownBtn = document.createElement('button');
  addDropdownBtn.textContent = '+ Add Dropdown';
  addDropdownBtn.style.cssText = `
    background: #9c27b0;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin-top: 5px;
  `;
  addDropdownBtn.onclick = () => {
    // Initialize dropdowns array if it doesn't exist
    if (!cell._dropdowns) {
      cell._dropdowns = [];
    }
    // Create new dropdown entry
    const newDropdown = {
      id: 'dropdown_' + Date.now(),
      name: 'New Dropdown',
      options: [],
      triggerSequences: []
    };
    cell._dropdowns.push(newDropdown);
    // Initialize item order if it doesn't exist
    if (!cell._itemOrder) {
      cell._itemOrder = [];
      const textboxes = cell._textboxes || [];
      const locationIndex = cell._locationIndex !== undefined && cell._locationIndex >= 0 ? cell._locationIndex : -1;
      textboxes.forEach((_, index) => {
        cell._itemOrder.push({ type: 'textbox', index: index });
      });
      if (locationIndex >= 0) {
        cell._itemOrder.push({ type: 'location', index: locationIndex });
      }
    }
    // Add the new dropdown to the end of the item order
    cell._itemOrder.push({ type: 'dropdown', index: cell._dropdowns.length - 1 });
    // Force save the cell properties to the graph model
    const graph = getGraph();
    if (graph) {
      graph.getModel().beginUpdate();
      try {
        graph.getModel().setValue(cell, cell.value);
        cell._dropdowns = cell._dropdowns;
        cell._itemOrder = cell._itemOrder;
      } finally {
        graph.getModel().endUpdate();
      }
    }
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    // Refresh the canvas display
    if (typeof window.updateMultipleTextboxesCell === 'function') {
      window.updateMultipleTextboxesCell(cell);
    }
    // Refresh the entire container to show the new dropdown entry
    const newContainer = createTextboxOptionsContainer(cell);
    container.parentNode.replaceChild(newContainer, container);
  };
  container.appendChild(addDropdownBtn);
  return container;
}
// Helper function to create individual textbox field
function createTextboxField(textbox, index, cell, parentContainer) {
  const textboxContainer = document.createElement('div');
  textboxContainer.draggable = true;
  textboxContainer.dataset.type = 'textbox';
  textboxContainer.dataset.index = index;
  textboxContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: move;
    position: relative;
  `;
  // Create top row for drag handle and main inputs
  const topRow = document.createElement('div');
  topRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
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
  `;
  topRow.appendChild(dragHandle);
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
  // Amount / Phone radios (mutually exclusive)
  const entryType = textbox.type || (textbox.isAmountOption ? 'amount' : 'label');
  const isAmount = entryType === 'amount';
  const isPhone = entryType === 'phone';
  const radioGroup = document.createElement('div');
  radioGroup.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  const amountLabel = document.createElement('label');
  amountLabel.style.cssText = `
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    color: #2c3e50;
  `;
  const amountRadio = document.createElement('input');
  amountRadio.type = 'radio';
  amountRadio.name = `mtb_modal_type_${cell.id}_${index}`;
  amountRadio.value = 'amount';
  amountRadio.checked = isAmount;
  amountLabel.appendChild(amountRadio);
  amountLabel.appendChild(document.createTextNode('Amount?'));
  const phoneLabel = document.createElement('label');
  phoneLabel.style.cssText = amountLabel.style.cssText;
  const phoneRadio = document.createElement('input');
  phoneRadio.type = 'radio';
  phoneRadio.name = `mtb_modal_type_${cell.id}_${index}`;
  phoneRadio.value = 'phone';
  phoneRadio.checked = isPhone;
  phoneLabel.appendChild(phoneRadio);
  phoneLabel.appendChild(document.createTextNode('Phone?'));
  const syncRadios = (newType) => {
    amountRadio.checked = newType === 'amount';
    phoneRadio.checked = newType === 'phone';
  };
  const setType = (newType) => {
    textbox.type = newType;
    textbox.isAmountOption = newType === 'amount';
    syncRadios(newType);
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  const applyToggle = (newType) => {
    if (textbox.type === newType) {
      setType('label');
    } else {
      setType(newType);
    }
  };
  const handleAmountPointer = (e) => {
    console.log('[MTB MODAL] amountRadio pointer', { cellId: cell.id, index, currentType: textbox.type, radioChecked: amountRadio.checked });
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    applyToggle('amount');
  };
  const handlePhonePointer = (e) => {
    console.log('[MTB MODAL] phoneRadio pointer', { cellId: cell.id, index, currentType: textbox.type, radioChecked: phoneRadio.checked });
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    applyToggle('phone');
  };
  amountRadio.addEventListener('pointerdown', handleAmountPointer, true);
  phoneRadio.addEventListener('pointerdown', handlePhonePointer, true);
  // Extra logging hooks to diagnose missing events
  amountRadio.addEventListener('change', () => {
    if (textbox.type === 'label') {
      syncRadios('label');
    }
    console.log('[MTB MODAL] amountRadio change', { cellId: cell.id, index, checked: amountRadio.checked, type: textbox.type });
  });
  phoneRadio.addEventListener('change', () => {
    if (textbox.type === 'label') {
      syncRadios('label');
    }
    console.log('[MTB MODAL] phoneRadio change', { cellId: cell.id, index, checked: phoneRadio.checked, type: textbox.type });
  });
  amountLabel.addEventListener('click', (e) => {
    console.log('[MTB MODAL] amountLabel click', { target: e.target.tagName });
  });
  phoneLabel.addEventListener('click', (e) => {
    console.log('[MTB MODAL] phoneLabel click', { target: e.target.tagName });
  });
  radioGroup.addEventListener('click', (e) => {
    console.log('[MTB MODAL] radioGroup click', { target: e.target.tagName, value: e.target.value });
  }, true);
  // Fallback: pointerdown to ensure we capture interactions even if click is swallowed
  amountRadio.addEventListener('pointerdown', () => {
    console.log('[MTB MODAL] amountRadio pointerdown', { cellId: cell.id, index });
  }, true);
  phoneRadio.addEventListener('pointerdown', () => {
    console.log('[MTB MODAL] phoneRadio pointerdown', { cellId: cell.id, index });
  }, true);
  radioGroup.appendChild(amountLabel);
  radioGroup.appendChild(phoneLabel);
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
    // Remove the textbox container from the DOM
    textboxContainer.remove();
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Add inputs to top row
  topRow.appendChild(nameInput);
  topRow.appendChild(placeholderInput);
  topRow.appendChild(radioGroup);
  topRow.appendChild(copyBtn);
  topRow.appendChild(deleteBtn);
  // Create prefill row
  const prefillRow = document.createElement('div');
  prefillRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin-top: 10px;
  `;
  const prefillLabel = document.createElement('label');
  prefillLabel.textContent = 'Prefill:';
  prefillLabel.style.cssText = `
    font-size: 14px;
    color: #2c3e50;
    font-weight: 500;
    min-width: 100px;
  `;
  const prefillInput = document.createElement('input');
  prefillInput.type = 'text';
  prefillInput.value = textbox.prefill || '';
  prefillInput.placeholder = 'Enter prefill value (optional)';
  prefillInput.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  `;
  prefillInput.onblur = () => {
    textbox.prefill = prefillInput.value.trim();
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Initialize prefill property if it doesn't exist
  if (textbox.prefill === undefined) {
    textbox.prefill = '';
  }
  prefillRow.appendChild(prefillLabel);
  prefillRow.appendChild(prefillInput);
  textboxContainer.appendChild(topRow);
  textboxContainer.appendChild(prefillRow);
  // Add hover effect
  textboxContainer.addEventListener('mouseenter', () => {
    textboxContainer.style.backgroundColor = '#f8f9fa';
    textboxContainer.style.borderColor = '#007bff';
  });
  textboxContainer.addEventListener('mouseleave', () => {
    textboxContainer.style.backgroundColor = 'white';
    textboxContainer.style.borderColor = '#ddd';
  });
  return textboxContainer;
}
// Helper function to create textbox location indicator
function createTextboxLocationIndicator(cell, parentContainer) {
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
    cursor: move;
    transition: all 0.2s ease;
    position: relative;
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
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    cursor: move;
    color: #28a745;
    font-size: 14px;
    user-select: none;
    padding: 2px;
  `;
  const locationText = document.createElement('span');
  locationText.textContent = '📍 Location Date Inserted';
  // Location title input field
  const locationTitleInput = document.createElement('input');
  locationTitleInput.type = 'text';
  locationTitleInput.placeholder = 'Enter location title...';
  locationTitleInput.value = cell._locationTitle || '';
  locationTitleInput.style.cssText = `
    width: 100%;
    max-width: 300px;
    padding: 4px 8px;
    border: 1px solid #28a745;
    border-radius: 3px;
    font-size: 12px;
    margin-top: 8px;
    text-align: center;
    background: white;
    color: #333;
    display: block;
    margin-left: auto;
    margin-right: auto;
  `;
  locationTitleInput.onblur = () => {
    cell._locationTitle = locationTitleInput.value.trim();
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  // Copy Location IDs button
  const copyLocationIdsBtn = document.createElement('button');
  copyLocationIdsBtn.textContent = 'Copy ID\'s';
  copyLocationIdsBtn.style.cssText = `
    background-color: #17a2b8;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 8px;
    width: 100%;
    max-width: 200px;
  `;
  copyLocationIdsBtn.onclick = () => {
    if (typeof window.showLocationIdsPopup === 'function') {
      window.showLocationIdsPopup(cell.id);
    }
  };
  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.style.cssText = `
    background-color: #dc3545;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 8px;
    width: 100%;
    max-width: 200px;
  `;
  removeBtn.onclick = () => {
    delete cell._locationIndex;
    delete cell._locationTitle;
    // Remove location from item order
    if (cell._itemOrder) {
      const locationItemIndex = cell._itemOrder.findIndex(item => item.type === 'location');
      if (locationItemIndex !== -1) {
        cell._itemOrder.splice(locationItemIndex, 1);
      }
    }
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
    // Refresh the entire container
    const newContainer = createTextboxOptionsContainer(cell);
    parentContainer.parentNode.replaceChild(newContainer, parentContainer);
  };
  // Create a text container to hold the location text
  const textContainer = document.createElement('div');
  textContainer.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin-left: 24px;
  `;
  textContainer.appendChild(locationText);
  // Create main container for the entire location indicator
  const mainContainer = document.createElement('div');
  mainContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    width: 100%;
    align-items: center;
  `;
  mainContainer.appendChild(dragHandle);
  mainContainer.appendChild(textContainer);
  mainContainer.appendChild(locationTitleInput);
  mainContainer.appendChild(copyLocationIdsBtn);
  mainContainer.appendChild(removeBtn);
  locationIndicator.appendChild(mainContainer);
  return locationIndicator;
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
    // Location title input field
    const locationTitleInput = document.createElement('input');
    locationTitleInput.type = 'text';
    locationTitleInput.placeholder = 'Enter location title...';
    locationTitleInput.value = cell._locationTitle || '';
    locationTitleInput.style.cssText = `
      width: 100%;
      max-width: 300px;
      padding: 8px 12px;
      border: 1px solid #28a745;
      border-radius: 4px;
      font-size: 14px;
      margin-top: 10px;
      text-align: center;
      background: white;
      color: #333;
      display: block;
      margin-left: auto;
      margin-right: auto;
    `;
    locationTitleInput.onblur = () => {
      cell._locationTitle = locationTitleInput.value.trim();
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    };
    container.appendChild(locationTitleInput);
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
      margin-top: 10px;
    `;
    removeBtn.onclick = () => {
      delete cell._locationIndex;
      delete cell._locationTitle;
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
  const checkboxes = cell._checkboxes || [];
  const times = cell._times || [];
  const locationIndex = cell._locationIndex !== undefined ? cell._locationIndex : -1;
  // Create display showing the actual order of options and location
  let optionsHtml = '';
  // Create a combined array that includes all items in the correct order
  const allItems = [];
  // Use unified item order if it exists, otherwise create default order
  if (cell._itemOrder && cell._itemOrder.length > 0) {
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
      allItems.splice(locationIndex, 0, {
        type: 'location',
        index: locationIndex,
        text: 'Location Date Inserted'
      });
    } else {
    }
  }
  // Generate HTML for all items in the correct order
  allItems.forEach((item, displayIndex) => {
    if (item.type === 'option') {
    optionsHtml += `
      <div style="margin: 4px 0; padding: 6px 10px; background: #f8f9fa; border: 1px solid #e0e7ef; border-radius: 4px; font-size: 12px; color: #2c3e50;">
          ${getEscapeAttr()(item.text)}
    </div>
    `;
    } else if (item.type === 'location') {
      optionsHtml += `
        <div style="margin: 4px 0; padding: 6px 10px; background: #e8f5e8; border: 2px dashed #28a745; border-radius: 4px; font-size: 12px; color: #28a745; font-weight: bold; text-align: center;">
          📍 ${getEscapeAttr()(item.text)}
    </div>
      `;
    } else if (item.type === 'checkbox') {
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
        optionsHtml += `
          <div style="margin: 4px 0; padding: 8px 12px; background: #fff3e0; border: 2px dashed #ff9800; border-radius: 6px; font-size: 12px; color: #e65100; font-weight: bold; text-align: center;">
            <div style="margin-bottom: 4px;">🕐 ${getEscapeAttr()(item.text)}</div>
            <div style="font-size: 10px; color: #bf360c;">ID: ${getEscapeAttr()(item.timeId || '')}</div>
      </div>
    `;
  }
    });
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
  const currencyTypeBtn = document.getElementById("currencyType");
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
  if (currencyTypeBtn) {
    currencyTypeBtn.addEventListener("click", () => {
      if (window.selectedCell && isQuestion(window.selectedCell)) {
        setQuestionType(window.selectedCell, "currency");
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
        cell._textboxes.push({ nameId: "", placeholder: "Enter value", isAmountOption: false, prefill: '' });
      } else {
        // Add the new option
        cell._textboxes.push({ nameId: "", placeholder: "Enter value", isAmountOption: false, prefill: '' });
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
window.updateMultipleTextboxLocationTitle = function(cellId, locationTitle) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes") {
    getGraph().getModel().beginUpdate();
    try {
      cell._locationTitle = locationTitle.trim();
    } finally {
      getGraph().getModel().endUpdate();
    }
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  }
};
window.removeMultipleTextboxLocationHandler = function(cellId) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes") {
    getGraph().getModel().beginUpdate();
    try {
      // Remove the location index and title
      delete cell._locationIndex;
      delete cell._locationTitle;
    } finally {
      getGraph().getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};
// Set type for multiple textbox entry: 'label' | 'amount' | 'phone'
window.setMultipleTextboxType = function(cellId, index, type) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (!(cell && getQuestionType(cell) === "multipleTextboxes" && cell._textboxes && cell._textboxes[index])) {
    return;
  }
  const allowed = ['label','amount','phone'];
  const requested = allowed.includes(type) ? type : 'label';
  // Toggle off if the same type is clicked again
  const current = cell._textboxes[index].type || (cell._textboxes[index].isAmountOption ? 'amount' : 'label');
  console.log('[MTB TYPE] setMultipleTextboxType called', { cellId, index, requested, current });
  const finalType = (current === requested) ? 'label' : requested;
  getGraph().getModel().beginUpdate();
  try {
    cell._textboxes[index].type = finalType;
    cell._textboxes[index].isAmountOption = finalType === 'amount'; // backward compat
  } finally {
    getGraph().getModel().endUpdate();
  }
  // Sync radio visuals (both inline list and modal) after toggle
  const names = [
    `mtb_type_${cellId}_${index}`,
    `mtb_modal_type_${cellId}_${index}`
  ];
  names.forEach(name => {
    const radios = document.getElementsByName(name);
    Array.from(radios || []).forEach(r => {
      if (finalType === 'label') {
        r.checked = false;
      } else {
        r.checked = (r.value === finalType);
      }
    });
  });
  updateMultipleTextboxesCell(cell);
  console.log('[MTB TYPE] setMultipleTextboxType applied', { cellId, index, finalType, isAmountOption: cell._textboxes[index].isAmountOption });
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
};
// Backward compat hook (amount checkbox) now routes to setMultipleTextboxType
window.toggleMultipleTextboxAmount = function(cellId, index, checked) {
  window.setMultipleTextboxType(cellId, index, checked ? 'amount' : 'label');
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
// Set type for multiple dropdown option: 'label' | 'amount' | 'phone' with toggle-off
window.setMultipleDropdownType = function(cellId, index, type) {
  const cell = getGraph()?.getModel().getCell(cellId);
  if (!(cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes && cell._textboxes[index])) {
    return;
  }
  const allowed = ['label', 'amount', 'phone'];
  const requested = allowed.includes(type) ? type : 'label';
  const current = cell._textboxes[index].type || (cell._textboxes[index].isAmountOption ? 'amount' : 'label');
  const finalType = current === requested ? 'label' : requested;
  getGraph().getModel().beginUpdate();
  try {
    cell._textboxes[index].type = finalType;
    cell._textboxes[index].isAmountOption = finalType === 'amount'; // backward compat
  } finally {
    getGraph().getModel().endUpdate();
  }
  // Sync radio visuals (inline + any modal mirrors)
  const names = [
    `mdd_type_${cellId}_${index}`,
    `mdd_modal_type_${cellId}_${index}`
  ];
  names.forEach(name => {
    const radios = document.getElementsByName(name);
    Array.from(radios || []).forEach(radio => {
      if (finalType === 'label') {
        radio.checked = false;
      } else {
        radio.checked = (radio.value === finalType);
      }
    });
  });
  updatemultipleDropdownTypeCell(cell);
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
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
      // Also remove location entries from _itemOrder
      if (cell._itemOrder) {
        cell._itemOrder = cell._itemOrder.filter(item => item.type !== 'location');
      }
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
// Track if user is currently interacting with input fields
let isUserInteractingWithInput = false;
// Add global listeners to track input interaction
document.addEventListener('mousedown', function(e) {
  const target = e.target;
  isUserInteractingWithInput = target.matches('input, textarea, select') || 
                              target.closest('input, textarea, select');
});
document.addEventListener('focusin', function(e) {
  const target = e.target;
  isUserInteractingWithInput = target.matches('input, textarea, select');
});
document.addEventListener('focusout', function(e) {
  // Small delay to allow for focus changes
  setTimeout(() => {
    const activeElement = document.activeElement;
    isUserInteractingWithInput = activeElement && activeElement.matches('input, textarea, select');
  }, 10);
});
// Drag and Drop functionality for reordering entries
window.handleDragStart = function(event, cellId, index) {
  // Prevent dragging if user is interacting with input elements
  const target = event.target;
  const isInputElement = target.matches('input, textarea, select, button') || 
                        target.closest('input, textarea, select, button');
  // Also check if user is selecting text in any input field
  const isTextSelection = window.getSelection && window.getSelection().toString().length > 0;
  // Check if focus is on an input element (user is actively typing)
  const activeElement = document.activeElement;
  const isFocusedOnInput = activeElement && activeElement.matches('input, textarea, select');
  // Check if the drag is starting from within an input field (even if not the direct target)
  const isWithinInputField = target.closest('.textbox-entry input, .checkbox-entry input, .time-entry input');
  // Check if any input field in the document has focus
  const anyInputFocused = document.querySelector('input:focus, textarea:focus, select:focus');
  if (isInputElement || isTextSelection || isFocusedOnInput || isWithinInputField || anyInputFocused || isUserInteractingWithInput) {
    event.preventDefault();
    return false;
  }
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
  // Prevent drop operations if user is interacting with input elements
  const target = event.target;
  const isInputElement = target.matches('input, textarea, select, button') || 
                        target.closest('input, textarea, select, button');
  if (isInputElement) {
    event.preventDefault();
    return false;
  }
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
  // Prevent drop operations if user is interacting with input elements
  const target = event.target;
  const isInputElement = target.matches('input, textarea, select, button') || 
                        target.closest('input, textarea, select, button');
  if (isInputElement) {
    event.preventDefault();
    return false;
  }
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
      c._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false, prefill: '' }];
      updateMultipleTextboxesCell(c);
    } else if (val === "multipleDropdownType") {
      c._questionText = "Enter question text";
      c._twoNumbers = { first: "0", second: "0" };
      c._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false, prefill: '' }];
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