/*******************************************************
 ************ Calculation Node: RENDER & EDITS *********
 *******************************************************/
function isCalculationNode(cell) {
  return cell && cell.style && cell.style.includes("nodeType=calculation");
}
/**
 * Initialize a new calculation node with default values
 */
function initializeCalculationNode(cell) {
  if (!cell) return;
  cell._calcTitle = "Calculation Title";
  cell._calcTerms = [{amountLabel: "", mathOperator: ""}];
  cell._calcOperator = "=";
  cell._calcThreshold = "0";
  cell._calcFinalText = "";
  cell._calcFinalOutputType = "textbox";
  cell._calcFinalCheckboxChecked = false;
  // For backward compatibility
  if (cell._calcAmountLabel !== undefined) {
    cell._calcTerms[0].amountLabel = cell._calcAmountLabel;
  }
  updateCalculationNodeCell(cell);
}
/**
 * Convert an existing cell to a calculation node
 */
function convertToCalculationNode(cell, preservedText = null) {
  if (!cell) return;
  cell.style = cell.style.replace(/nodeType=[^;]+/, "nodeType=calculation");
  cell._calcTitle = preservedText || "Calculation Title";
  cell._calcAmountLabel = "";
  cell._calcOperator = "=";
  cell._calcThreshold = "0";
  cell._calcFinalText = "";
  cell._calcTerms = [{amountLabel: "", mathOperator: ""}];
  cell._calcFinalOutputType = "textbox";
  cell._calcFinalCheckboxChecked = false;
  updateCalculationNodeCell(cell);
}
/**
 * Handle calculation node title updates
 */
function updateCalculationNodeTitle(cell, newText) {
  if (!cell || !isCalculationNode(cell)) return;
  cell._calcTitle = newText.trim();
  updateCalculationNodeCell(cell);
}
/**
 * Get calculation node style and label for node placement
 */
function getCalculationNodeStyle() {
  return {
    style: "shape=roundRect;rounded=1;arcSize=10;whiteSpace=wrap;html=1;nodeType=calculation;spacing=12;fontSize=16;pointerEvents=1;overflow=fill;",
    label: "Calculation node"
  };
}
/**
 * Export calculation node data for save/export operations
 */
function exportCalculationNodeData(cell, cellData) {
  if (!cell || !isCalculationNode(cell)) return;
  if (cell._calcTitle !== undefined) cellData._calcTitle = cell._calcTitle;
  if (cell._calcAmountLabel !== undefined) cellData._calcAmountLabel = cell._calcAmountLabel;
  if (cell._calcOperator !== undefined) cellData._calcOperator = cell._calcOperator;
  if (cell._calcThreshold !== undefined) cellData._calcThreshold = cell._calcThreshold;
  if (cell._calcFinalText !== undefined) cellData._calcFinalText = cell._calcFinalText;
  if (cell._calcTerms !== undefined) cellData._calcTerms = JSON.parse(JSON.stringify(cell._calcTerms));
  if (cell._calcFinalOutputType !== undefined) cellData._calcFinalOutputType = cell._calcFinalOutputType;
  if (cell._calcFinalCheckboxChecked !== undefined) cellData._calcFinalCheckboxChecked = cell._calcFinalCheckboxChecked;
}
/**
 * Get calculation node text for display and search
 */
function getCalculationNodeText(cell) {
  if (!cell || !isCalculationNode(cell)) return '';
  return cell._calcTitle || cell.value || '';
}
/**
 * Handle calculation node copy/paste operations
 */
function handleCalculationNodeCopyPaste(newCell) {
  if (!newCell || !isCalculationNode(newCell)) return;
  if (typeof updateCalculationNodeCell === "function") {
    updateCalculationNodeCell(newCell);
  }
}
/**
 * Setup calculation node event listeners
 */
function setupCalculationNodeEventListeners() {
  // Place calculation node button
  const placeCalcNodeBtn = document.getElementById('placeCalcNode');
  if (placeCalcNodeBtn) {
    placeCalcNodeBtn.addEventListener('click', function() {
      if (typeof window.placeNodeAtClickLocation === 'function') {
        window.placeNodeAtClickLocation('calculation');
      }
    });
  }
}
/**
 * Handle calculation node placement
 */
function handleCalculationNodePlacement(cell) {
  if (!cell || !isCalculationNode(cell)) return;
  initializeCalculationNode(cell);
}
/**
 * Get calculation node properties for display in properties panel
 */
function getCalculationNodeProperties(cell) {
  if (!cell || !isCalculationNode(cell)) return null;
  return {
    nodeType: "calculation",
    title: cell._calcTitle || "Calculation Title",
    operator: cell._calcOperator || "=",
    threshold: cell._calcThreshold || "0",
    finalText: cell._calcFinalText || "",
    terms: cell._calcTerms || []
  };
}
/**
 * Update calculation nodes when questions change
 */
function updateCalculationNodesOnQuestionChange(questionCell, isDeleted = false, oldNodeId = null) {
  if (isDeleted && !oldNodeId) {
    return;
  }
  const graph = window.graph;
  if (!graph) return;
  const questionId = isDeleted ? oldNodeId : ((typeof window.getNodeId === 'function' ? window.getNodeId(questionCell) : '') || "");
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  const calculationNodes = vertices.filter(cell => isCalculationNode(cell));
  // For direct references to number/money fields, we need to extract the question ID
  const directQuestionId = isDeleted ? 
    (oldNodeId.split('_').pop() || "") : 
    (questionCell._questionId || (questionId.split('_').pop() || ""));
  // If the question was deleted, find and delete any calc nodes that depend on it
  if (isDeleted) {
    // Gather a list of calc nodes to delete
    const calcNodesToDelete = [];
    calculationNodes.forEach(calcNode => {
      if (!calcNode._calcTerms) return;
      let dependsOnDeletedQuestion = false;
      calcNode._calcTerms.forEach(term => {
        if (!term.amountLabel) return;
        // Check for direct references to the question ID
        if (term.amountLabel.toLowerCase().includes(oldNodeId.toLowerCase())) {
          dependsOnDeletedQuestion = true;
        }
        // Check for direct answer references (money/number types)
        const answerPattern = `answer${directQuestionId}`;
        if (term.amountLabel === answerPattern) {
          dependsOnDeletedQuestion = true;
        }
      });
      if (dependsOnDeletedQuestion) {
        calcNodesToDelete.push(calcNode);
      }
    });
    // Delete the dependent calc nodes
    if (calcNodesToDelete.length > 0) {
      graph.getModel().beginUpdate();
      try {
        graph.removeCells(calcNodesToDelete);
      } finally {
        graph.getModel().endUpdate();
      }
    }
  }
  // If the question was modified, update all dependent calculation nodes
  else {
    const dependentCalcNodes = findCalcNodesDependentOnQuestion(questionCell);
    if (dependentCalcNodes.length > 0) {
      graph.getModel().beginUpdate();
      try {
        // Update each calculation node
        dependentCalcNodes.forEach(calcNode => {
          updateCalculationNodeCell(calcNode);
        });
      } finally {
        graph.getModel().endUpdate();
      }
    }
  }
}
/**
 * Build a list of all "amount" labels from numbered dropdown questions.
 * We'll gather them in the format:
 *    "<question_id_text>_<amount_label>"
 * E.g. "how_many_cars_do_you_have_car_value"
 * Also include calculation node titles as potential sources
 */
function gatherAllAmountLabels() {
  const labels = [];
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  // First collect all calculation nodes
  const calculationNodes = vertices.filter(cell => isCalculationNode(cell));
  vertices.forEach(cell => {
    if (isCalculationNode(cell)) {
      // Add calculation node titles as potential sources
      if (cell._calcTitle) {
        labels.push(cell._calcTitle);
      }
    } else if (isQuestion(cell)) {
      const qType = getQuestionType(cell);
      if (qType === "multipleDropdownType") {
        // We'll rename it "numberedDropdown" in final JSON
        // If it has amounts, push numbered variants (#1, #2, #3, etc.)
        if (cell._textboxes) {
          const questionText = cell._questionText || cell.value || "unnamed_question";
          // Use the actual nodeId instead of sanitized question text to handle duplicates (_dup2, etc.)
          const actualNodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || 
                               cell._nameId || 
                               sanitizeNameId(questionText);
          // Get min and max from _twoNumbers
          const min = cell._twoNumbers?.first ? parseInt(cell._twoNumbers.first) : 1;
          const max = cell._twoNumbers?.second ? parseInt(cell._twoNumbers.second) : min;
          console.log('[CALC gatherAllAmountLabels] Processing numberedDropdown:', {
            questionText,
            actualNodeId,
            min,
            max,
            textboxesCount: cell._textboxes.length
          });
          cell._textboxes.forEach((tb, tbIndex) => {
            if (tb.isAmountOption) {
              const amountName = tb.nameId || "";
              const sanitizedAmountName = sanitizeNameId(amountName);
              console.log('[CALC gatherAllAmountLabels] Processing amount option:', {
                tbIndex,
                amountName,
                sanitizedAmountName
              });
              // Generate numbered variants from min to max
              for (let i = min; i <= max; i++) {
                // Store value: nodeId_amountName_#N (for identification)
                // This uses the actual nodeId which includes _dup2 suffixes
                const storedValue = `${actualNodeId}_${sanitizedAmountName}_${i}`;
                // Display name: "Question Text - Amount Label #N"
                const displayName = `${questionText} - ${amountName} #${i}`;
                // Store with special prefix to identify it's a numbered dropdown amount
                labels.push(`numbered_dropdown:${storedValue}:${displayName}`);
                console.log('[CALC gatherAllAmountLabels] Added numbered variant:', {
                  i,
                  storedValue,
                  displayName,
                  fullLabel: `numbered_dropdown:${storedValue}:${displayName}`
                });
              }
            }
          });
        }
      } else if (qType === "checkbox") {
        // Find all amount options linked to this checkbox question
        const cleanQuestionName = sanitizeNameId(cell.value || "unnamed_question");
        const outgoingEdges = graph.getOutgoingEdges(cell) || [];
        for (const edge of outgoingEdges) {
          const targetCell = edge.target;
          if (targetCell && isOptions(targetCell) && isAmountOption(targetCell)) {
            let optionText = sanitizeNameId(targetCell.value || "");
            optionText = optionText.replace(/\//g, "_").replace(/_+/g, "_");
            const optionLabel = `${cleanQuestionName}_${optionText}_amount`;
            labels.push(optionLabel);
          }
        }
      } else if (qType === "money" || qType === "number" || qType === "currency") {
        // Add number/money/currency type questions directly
        const cleanQuestionName = sanitizeNameId(cell.value || "unnamed_question");
        const nodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || "";
        // Use answer{questionId} format for consistent JSON export
        const questionId = cell._questionId || nodeId.split('_').pop() || "";
        const label = `answer${questionId}`;
        // Prefer the actual nodeId for display (e.g., currency_test)
        const displayLabel = nodeId || cleanQuestionName;
        // Store with a special prefix to identify it's a direct question value
        labels.push(`question_value:${label}:${displayLabel}`);
      }
    }
  });
  return labels;
}
/**
 * Renders the Calculation Node as HTML:
 * - Title (editable)
 * - 1st dropdown: any amount labels
 * - 2nd dropdown: operator (=, >, <)
 * - threshold number
 * - final text
 */
function updateCalculationNodeCell(cell) {
  // Prepare default fields if missing
  if (cell._calcTitle === undefined) cell._calcTitle = "Calculation Title";
  if (cell._calcTerms === undefined) cell._calcTerms = [{amountLabel: "", mathOperator: ""}];
  if (cell._calcOperator === undefined) cell._calcOperator = "=";
  if (cell._calcThreshold === undefined) cell._calcThreshold = "0";
  if (cell._calcFinalText === undefined) cell._calcFinalText = "";
  if (cell._calcFinalOutputType === undefined) cell._calcFinalOutputType = "textbox";
  if (cell._calcFinalCheckboxChecked === undefined) cell._calcFinalCheckboxChecked = false;
  // For backward compatibility
  if (cell._calcAmountLabel !== undefined && cell._calcTerms.length === 1 && !cell._calcTerms[0].amountLabel) {
    cell._calcTerms[0].amountLabel = cell._calcAmountLabel;
  }
  // Gather possible "amount" labels
  const allAmountLabels = gatherAllAmountLabels();
  // Build the HTML for all calculation terms
  let calcTermsHtml = '';
  cell._calcTerms.forEach((term, index) => {
    // Build dropdown of amount labels for this term
    let amountOptionsHtml = `<option value="">-- pick an amount label --</option>`;
    allAmountLabels.forEach(lbl => {
      // Check if this is a numbered dropdown amount or direct question value
      const isNumberedDropdown = lbl.startsWith('numbered_dropdown:');
      const isQuestionValue = lbl.startsWith('question_value:');
      let value = lbl;
      let displayName = lbl;
      if (isNumberedDropdown) {
        // Format: numbered_dropdown:storedValue:displayName
        const parts = lbl.split(':');
        if (parts.length >= 3) {
          value = parts[1]; // The stored value (questionName_amountName_#N)
          displayName = parts[2]; // The display name (Question Text - Amount Label #N)
        }
      } else if (isQuestionValue) {
        // Format: question_value:label:displayName
        const parts = lbl.split(':');
        if (parts.length >= 3) {
          value = parts[1]; // The actual value to store (answer1, etc.)
          displayName = parts[2]; // The display name for the dropdown
        }
      } else {
        // Regular calculation label formatting
        // Strip out common artifacts like delete_amount, add_option etc.
        displayName = displayName.replace(/delete_amount_/g, "");
        displayName = displayName.replace(/add_option_/g, "");
        // Find the last instance of the question name + underscore
        const lastUnderscoreIndex = displayName.lastIndexOf("_");
        if (lastUnderscoreIndex !== -1) {
          const questionPart = displayName.substring(0, lastUnderscoreIndex);
          const amountPart = displayName.substring(lastUnderscoreIndex + 1);
          // Format: "how_many_cars_do_you_have + car_value"
          displayName = `${questionPart}_${amountPart}`;
        }
      }
      // Check if this option should be selected
      let selected = "";
      if (term.amountLabel) {
        if (isNumberedDropdown || isQuestionValue) {
          // For numbered_dropdown or question_value, check if the stored value matches
          // Also check if the full label format matches
          if (term.amountLabel === lbl || term.amountLabel === value) {
          selected = "selected";
        }
      } else {
        // For regular values, check direct match
        if (lbl === term.amountLabel) {
          selected = "selected";
          }
        }
      }
      amountOptionsHtml += `<option value="${escapeAttr(value)}" ${selected}>${displayName}</option>`;
    });
    // For the first term, don't show a math operator
    if (index === 0) {
      calcTermsHtml += `
        <div class="calc-term" data-index="${index}">
          <label>Calc ${index + 1}:</label>
          <select onchange="window.updateCalcNodeTerm('${cell.id}', ${index}, 'amountLabel', this.value)" style="width:100%; max-width:500px;">
            ${amountOptionsHtml}
          </select>
          <br/><br/>
        </div>
      `;
    } else {
      // For subsequent terms, show a math operator dropdown first
      let mathOperatorOptionsHtml = "";
      const mathOperators = ["+", "-", "*", "/"];
      mathOperators.forEach(op => {
        const selected = (op === term.mathOperator) ? "selected" : "";
        mathOperatorOptionsHtml += `<option value="${op}" ${selected}>${op}</option>`;
      });
      calcTermsHtml += `
        <div class="calc-term" data-index="${index}">
          <label>Math Operator:</label>
          <select onchange="window.updateCalcNodeTerm('${cell.id}', ${index}, 'mathOperator', this.value)" style="width:100px;">
            ${mathOperatorOptionsHtml}
          </select>
          <label style="margin-left:10px;">Calc ${index + 1}:</label>
          <select onchange="window.updateCalcNodeTerm('${cell.id}', ${index}, 'amountLabel', this.value)" style="width:calc(100% - 120px); max-width:380px;">
            ${amountOptionsHtml}
          </select>
          <button onclick="window.removeCalcNodeTerm('${cell.id}', ${index})" style="margin-left:5px;">Remove</button>
          <br/><br/>
        </div>
      `;
    }
  });
  // Add button for adding more terms
  calcTermsHtml += `
    <div style="margin-bottom:15px;">
      <button onclick="window.addCalcNodeTerm('${cell.id}')">Add More</button>
    </div>
  `;
  // Operator dropdown
  const operators = ["=", ">", "<"];
  let operatorOptionsHtml = "";
  operators.forEach(op => {
    const selected = (op === cell._calcOperator) ? "selected" : "";
    operatorOptionsHtml += `<option value="${op}" ${selected}>${op}</option>`;
  });
  // Create a simple display for the calculation node
  const termsText = cell._calcTerms.map((term, index) => {
    if (index === 0) {
      return term.amountLabel || 'No amount selected';
    } else {
      return `${term.mathOperator || '+'} ${term.amountLabel || 'No amount selected'}`;
    }
  }).join(' ');
  const finalOutputText = cell._calcFinalOutputType === 'textbox' 
    ? `Text: "${cell._calcFinalText || 'No text set'}"`
    : `Checkbox: ${cell._calcFinalCheckboxChecked ? 'Checked' : 'Unchecked'} by default`;
  const html = `
    <div style="padding:15px; text-align:center; font-family: Arial, sans-serif;">
      <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: #1976d2;">
        ${escapeHtml(cell._calcTitle || 'Calculation Title')}
      </div>
      <div style="font-size: 14px; margin-bottom: 6px; color: #333;">
        <strong>Calculation:</strong> ${escapeHtml(termsText)}
      </div>
      <div style="font-size: 14px; margin-bottom: 6px; color: #333;">
        <strong>Condition:</strong> ${escapeHtml(termsText)} ${cell._calcOperator || '='} ${cell._calcThreshold || '0'}
      </div>
      <div style="font-size: 14px; color: #333;">
        <strong>Output:</strong> ${finalOutputText}
      </div>
      <div style="font-size: 12px; color: #666; margin-top: 8px; font-style: italic;">
        Double-click to configure
      </div>
    </div>
  `;
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
    let st = cell.style || "";
    // Ensure it's a rounded rectangle
    if (st.includes("shape=hexagon")) {
      st = st.replace("shape=hexagon", "shape=roundRect;rounded=1;arcSize=10");
    }
    if (!st.includes("rounded=1")) {
      st += "rounded=1;arcSize=10;";
    }
    if (!st.includes("pointerEvents=")) {
      st += "pointerEvents=1;overflow=fill;";
    }
    if (!st.includes("html=1")) {
      st += "html=1;";
    }
    graph.getModel().setStyle(cell, st);
    // Set fixed size for the calculation node
    const geo = cell.geometry;
    if (geo) {
      // Set fixed dimensions: 400px width, 450px height
      geo.width = 400;
      geo.height = 450;
    }
  } finally {
    graph.getModel().endUpdate();
  }
  // Note: Removed graph.updateCellSize(cell) to prevent unwanted cell movement
  // The cell size should already be appropriate from the initial creation
}
// Calculation node field updates
window.updateCalcNodeTitle = (cellId, title) => {
  const cell = graph.model.getCell(cellId);
  if (!cell) return;
  cell._calcTitle = title;
  updateCalculationNodeCell(cell);
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
};
window.updateCalcNodeAmountLabel = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isCalculationNode(cell)) return;
  graph.getModel().beginUpdate();
  try {
    cell._calcAmountLabel = value.trim();
    // Also update _calcTerms for backward compatibility
    if (!cell._calcTerms || cell._calcTerms.length === 0) {
      cell._calcTerms = [{
        amountLabel: value.trim(),
        mathOperator: ""
      }];
    } else if (cell._calcTerms.length > 0) {
      cell._calcTerms[0].amountLabel = value.trim();
    }
  } finally {
    graph.getModel().endUpdate();
  }
  updateCalculationNodeCell(cell);
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
};
window.updateCalcNodeOperator = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isCalculationNode(cell)) return;
  graph.getModel().beginUpdate();
  try {
    cell._calcOperator = value;
  } finally {
    graph.getModel().endUpdate();
  }
  updateCalculationNodeCell(cell);
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
};
window.updateCalcNodeThreshold = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isCalculationNode(cell)) return;
  graph.getModel().beginUpdate();
  try {
    cell._calcThreshold = value;
  } finally {
    graph.getModel().endUpdate();
  }
  updateCalculationNodeCell(cell);
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
};
window.updateCalcNodeFinalText = (cellId, text) => {
  const cell = graph.model.getCell(cellId);
  if (!cell) return;
  cell._calcFinalText = text;
  updateCalculationNodeCell(cell);
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
};
window.updateCalcNodeFinalOutputType = (cellId, outputType) => {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isCalculationNode(cell)) return;
  graph.getModel().beginUpdate();
  try {
    cell._calcFinalOutputType = outputType;
  } finally {
    graph.getModel().endUpdate();
  }
  updateCalculationNodeCell(cell);
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
};
window.updateCalcNodeFinalCheckboxChecked = (cellId, checked) => {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isCalculationNode(cell)) return;
  graph.getModel().beginUpdate();
  try {
    cell._calcFinalCheckboxChecked = checked;
  } finally {
    graph.getModel().endUpdate();
  }
  updateCalculationNodeCell(cell);
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
};
/**
 * Show calculation node properties popup
 * @param {mxCell} cell - The calculation node cell
 * @param {number} scrollPosition - Optional scroll position to restore (default: 0)
 */
window.showCalculationNodeProperties = function(cell, scrollPosition = 0) {
  console.log('[CALC PROPERTIES] showCalculationNodeProperties called', cell, 'scrollPosition:', scrollPosition);
  if (!cell || !isCalculationNode(cell)) {
    console.warn('[CALC PROPERTIES] Invalid cell or not a calculation node', cell);
    return;
  }
  // Prevent multiple popups
  if (window.__calcPropertiesPopupOpen) {
    console.warn('[CALC PROPERTIES] Popup already open, returning');
    return;
  }
  window.__calcPropertiesPopupOpen = true;
  console.log('[CALC PROPERTIES] Setting popup flag to true');
  // Clean up any existing popups
  const existingPopups = document.querySelectorAll('.calc-properties-modal');
  console.log('[CALC PROPERTIES] Found', existingPopups.length, 'existing popups, removing them');
  existingPopups.forEach(n => n.remove());
  // Ensure calculation nodes don't have _dropdowns property (which would trigger options UI)
  if (cell._dropdowns) {
    console.warn('[CALC PROPERTIES] Cell has _dropdowns property, deleting it', cell._dropdowns);
    delete cell._dropdowns;
  }
  console.log('[CALC PROPERTIES] Cell properties:', {
    _dropdowns: cell._dropdowns,
    _calcTitle: cell._calcTitle,
    _calcOperator: cell._calcOperator,
    _calcThreshold: cell._calcThreshold,
    _calcTerms: cell._calcTerms
  });
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'calc-properties-modal';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #1976d2;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    min-width: 600px;
    max-width: 800px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: auto;
    opacity: 1;
    max-height: 80vh;
    overflow-y: auto;
  `;
  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e0e0e0;
  `;
  const title = document.createElement('h3');
  title.textContent = 'Calculation Node Properties';
  title.style.cssText = `
    margin: 0;
    color: #1976d2;
    font-size: 18px;
    font-weight: 600;
  `;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  closeBtn.onclick = () => {
    popup.remove();
    window.__calcPropertiesPopupOpen = false;
  };
  header.appendChild(title);
  header.appendChild(closeBtn);
  // Create content container
  const content = document.createElement('div');
  content.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 16px;
  `;
  // Calculation Title
  const titleField = createField('Calculation Title', cell._calcTitle || 'Calculation Title', (value) => {
    cell._calcTitle = value;
    updateCalculationNodeCell(cell);
  });

  // Calc Type dropdown (textbox or checkbox)
  const calcTypeContainer = document.createElement('div');
  calcTypeContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  const calcTypeLabel = document.createElement('label');
  calcTypeLabel.textContent = 'Calc Type:';
  calcTypeLabel.style.cssText = 'font-weight: 500; color: #333;';
  calcTypeContainer.appendChild(calcTypeLabel);
  const calcTypeSelect = document.createElement('select');
  calcTypeSelect.style.cssText = `
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  `;
  const calcTypes = ['textbox', 'checkbox'];
  calcTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    if (type === (cell._calcFinalOutputType || 'textbox')) {
      option.selected = true;
    }
    calcTypeSelect.appendChild(option);
  });
  calcTypeSelect.onchange = () => {
    cell._calcFinalOutputType = calcTypeSelect.value;
    updateCalculationNodeCell(cell);
    // Save scroll position before refreshing
    const scrollPosition = popup.scrollTop;
    // Refresh the popup to show the appropriate output field
    setTimeout(() => {
      popup.remove();
      window.__calcPropertiesPopupOpen = false;
      showCalculationNodeProperties(cell, scrollPosition);
    }, 100);
  };
  calcTypeContainer.appendChild(calcTypeSelect);

  // Calculation Terms
  console.log('[CALC PROPERTIES] Creating calculation terms container');
  const termsContainer = createCalculationTermsContainer(cell);
  console.log('[CALC PROPERTIES] Terms container created', termsContainer);
  // Comparison Operator - create as a proper dropdown (not a text input)
  console.log('[CALC PROPERTIES] Creating comparison operator dropdown');
  const operatorContainer = document.createElement('div');
  operatorContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  const operatorLabel = document.createElement('label');
  operatorLabel.textContent = 'Comparison Operator:';
  operatorLabel.style.cssText = 'font-weight: 500; color: #333;';
  operatorContainer.appendChild(operatorLabel);
  const operatorSelect = document.createElement('select');
  operatorSelect.style.cssText = `
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  `;
  const operators = ['=', '>', '<'];
  operators.forEach(op => {
    const option = document.createElement('option');
    option.value = op;
    option.textContent = op;
    if (op === (cell._calcOperator || '=')) {
      option.selected = true;
    }
    operatorSelect.appendChild(option);
  });
  operatorSelect.onchange = () => {
    cell._calcOperator = operatorSelect.value;
    updateCalculationNodeCell(cell);
  };
  operatorContainer.appendChild(operatorSelect);
  // Threshold Number
  console.log('[CALC PROPERTIES] Creating threshold field');
  const thresholdField = createField('Number', cell._calcThreshold || '0', (value) => {
    cell._calcThreshold = value;
    updateCalculationNodeCell(cell);
  });
  console.log('[CALC PROPERTIES] Threshold field created', thresholdField);
  
  // Output field - conditional based on calc type
  let outputField;
  if ((cell._calcFinalOutputType || 'textbox') === 'checkbox') {
    // Checkbox type: show dropdown with checked/unchecked
    const outputContainer = document.createElement('div');
    outputContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    const outputLabel = document.createElement('label');
    outputLabel.textContent = 'Default State:';
    outputLabel.style.cssText = 'font-weight: 500; color: #333;';
    outputContainer.appendChild(outputLabel);
    const outputSelect = document.createElement('select');
    outputSelect.style.cssText = `
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
    `;
    const states = ['checked', 'unchecked'];
    states.forEach(state => {
      const option = document.createElement('option');
      option.value = state;
      option.textContent = state;
      // Determine current state from _calcFinalCheckboxChecked
      const currentState = cell._calcFinalCheckboxChecked ? 'checked' : 'unchecked';
      if (state === currentState) {
        option.selected = true;
      }
      outputSelect.appendChild(option);
    });
    outputSelect.onchange = () => {
      cell._calcFinalCheckboxChecked = outputSelect.value === 'checked';
      updateCalculationNodeCell(cell);
    };
    outputContainer.appendChild(outputSelect);
    outputField = outputContainer;
  } else {
    // Textbox type: show text input
    outputField = createField('Output Text', cell._calcFinalText || '', (value) => {
      cell._calcFinalText = value;
      updateCalculationNodeCell(cell);
    });
  }

  // Final Output Type
  console.log('[CALC PROPERTIES] Creating final output type field - calling createDropdownField');
  console.log('[CALC PROPERTIES] createDropdownField function:', typeof createDropdownField, createDropdownField);
  const outputTypeField = createDropdownField('Final Output Type', cell._calcFinalOutputType || 'textbox', ['textbox', 'checkbox'], (value) => {
    cell._calcFinalOutputType = value;
    updateCalculationNodeCell(cell);
    // Save scroll position before refreshing
    const scrollPosition = popup.scrollTop;
    // Refresh the popup to show/hide the appropriate field
    setTimeout(() => {
      popup.remove();
      window.__calcPropertiesPopupOpen = false;
      showCalculationNodeProperties(cell, scrollPosition);
    }, 100);
  });
  // Conditional Final Output Field
  const finalOutputContainer = document.createElement('div');
  finalOutputContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  if (cell._calcFinalOutputType === 'textbox') {
    const finalTextField = createField('Final Text', cell._calcFinalText || '', (value) => {
      cell._calcFinalText = value;
      updateCalculationNodeCell(cell);
    });
    finalOutputContainer.appendChild(finalTextField);
  } else {
    const checkboxField = createCheckboxField('Checked by Default', cell._calcFinalCheckboxChecked || false, (checked) => {
      cell._calcFinalCheckboxChecked = checked;
      updateCalculationNodeCell(cell);
    });
    finalOutputContainer.appendChild(checkboxField);
  }
  // Assemble content
  console.log('[CALC PROPERTIES] Assembling content - appending fields');
  console.log('[CALC PROPERTIES] Title field:', titleField);
  console.log('[CALC PROPERTIES] Terms container:', termsContainer);
  console.log('[CALC PROPERTIES] Operator container:', operatorContainer);
  console.log('[CALC PROPERTIES] Threshold field:', thresholdField);
  console.log('[CALC PROPERTIES] Output type field:', outputTypeField);
  console.log('[CALC PROPERTIES] Final output container:', finalOutputContainer);
  content.appendChild(titleField);
  content.appendChild(calcTypeContainer);
  content.appendChild(termsContainer);
  content.appendChild(operatorContainer); // Use operatorContainer instead of operatorField
  content.appendChild(thresholdField);
  content.appendChild(outputField);
  // Removed outputTypeField and finalOutputContainer per user request
  // content.appendChild(outputTypeField);
  // content.appendChild(finalOutputContainer);
  console.log('[CALC PROPERTIES] Content assembled, checking for any "New Dropdown" elements');
  const newDropdownInputs = content.querySelectorAll('input[placeholder*="Dropdown"], input[value*="New Dropdown"], .dropdown-field, [data-type="dropdown"]');
  console.log('[CALC PROPERTIES] Found', newDropdownInputs.length, 'potential "New Dropdown" inputs:', newDropdownInputs);
  // Create footer with buttons
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
  `;
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save & Close';
  saveBtn.style.cssText = `
    background: #1976d2;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
  saveBtn.onclick = () => {
    popup.remove();
    window.__calcPropertiesPopupOpen = false;
    if (typeof window.requestAutosave === 'function') {
      window.requestAutosave();
    }
  };
  footer.appendChild(saveBtn);
  // Assemble popup
  popup.appendChild(header);
  popup.appendChild(content);
  popup.appendChild(footer);
  // Add to document
  console.log('[CALC PROPERTIES] About to append popup to document.body');
  console.log('[CALC PROPERTIES] Popup HTML structure (first 1000 chars):', popup.innerHTML.substring(0, 1000));
  document.body.appendChild(popup);
  console.log('[CALC PROPERTIES] Popup appended to document.body');
  // Restore scroll position if provided
  if (scrollPosition > 0) {
    setTimeout(() => {
      popup.scrollTop = scrollPosition;
      console.log('[CALC PROPERTIES] Restored scroll position to:', scrollPosition);
    }, 50);
  }
  // Check for any "New Dropdown" inputs after appending
  setTimeout(() => {
    const allNewDropdowns = popup.querySelectorAll('input[placeholder*="Dropdown"], input[value*="New Dropdown"], .dropdown-field, [data-type="dropdown"], [data-dropdown-index], input[name*="dropdown"]');
    console.log('[CALC PROPERTIES] After append - Found', allNewDropdowns.length, 'potential "New Dropdown" inputs:', allNewDropdowns);
    allNewDropdowns.forEach((el, idx) => {
      console.log(`[CALC PROPERTIES] "New Dropdown" ${idx}:`, {
        element: el,
        tagName: el.tagName,
        placeholder: el.placeholder,
        value: el.value,
        className: el.className,
        parentElement: el.parentElement,
        parentClasses: el.parentElement ? el.parentElement.className : 'N/A',
        parentHTML: el.parentElement ? el.parentElement.innerHTML.substring(0, 200) : 'N/A'
      });
    });
    // Also check for any elements with purple borders (the styling used for dropdown fields)
    const purpleBordered = popup.querySelectorAll('[style*="border: 2px solid #9c27b0"], [style*="border:2px solid #9c27b0"]');
    console.log('[CALC PROPERTIES] Found', purpleBordered.length, 'elements with purple borders:', purpleBordered);
  }, 100);
  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      popup.remove();
      window.__calcPropertiesPopupOpen = false;
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
};
// Helper functions for creating form fields
function createField(label, value, onChange) {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  const labelEl = document.createElement('label');
  labelEl.textContent = label + ':';
  labelEl.style.cssText = 'font-weight: 500; color: #333;';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.style.cssText = `
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  `;
  input.onblur = () => onChange(input.value);
  container.appendChild(labelEl);
  container.appendChild(input);
  return container;
}
function createDropdownField(label, value, options, onChange) {
  console.log('[CALC createDropdownField] Called with:', { label, value, options, onChange: typeof onChange });
  console.trace('[CALC createDropdownField] Stack trace');
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
  const labelEl = document.createElement('label');
  labelEl.textContent = label + ':';
  labelEl.style.cssText = 'font-weight: 500; color: #333;';
  const select = document.createElement('select');
  console.log('[CALC createDropdownField] Created select element');
  select.style.cssText = `
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  `;
  options.forEach(option => {
    const optionEl = document.createElement('option');
    optionEl.value = option;
    optionEl.textContent = option;
    if (option === value) optionEl.selected = true;
    select.appendChild(optionEl);
  });
  select.onchange = () => onChange(select.value);
  container.appendChild(labelEl);
  container.appendChild(select);
  return container;
}
function createCheckboxField(label, checked, onChange) {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.onchange = () => onChange(checkbox.checked);
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.cssText = 'font-weight: 500; color: #333; margin: 0;';
  container.appendChild(checkbox);
  container.appendChild(labelEl);
  return container;
}
function createCalculationTermsContainer(cell) {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
  const label = document.createElement('label');
  label.textContent = 'Calculation Terms:';
  label.style.cssText = 'font-weight: 500; color: #333;';
  container.appendChild(label);
  // Create terms
  const terms = cell._calcTerms || [{amountLabel: "", mathOperator: ""}];
  terms.forEach((term, index) => {
    const termContainer = createCalculationTermField(cell, term, index);
    container.appendChild(termContainer);
  });
  // Add More button
  const addMoreBtn = document.createElement('button');
  addMoreBtn.textContent = 'Add More';
  addMoreBtn.style.cssText = `
    background: #1976d2;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    align-self: flex-start;
  `;
  addMoreBtn.onclick = () => {
    if (!cell._calcTerms) cell._calcTerms = [];
    cell._calcTerms.push({amountLabel: "", mathOperator: ""});
    updateCalculationNodeCell(cell);
    // Save scroll position before refreshing
    const popup = document.querySelector('.calc-properties-modal');
    const scrollPosition = popup ? popup.scrollTop : 0;
    // Refresh the popup
    setTimeout(() => {
      if (popup) {
        popup.remove();
        window.__calcPropertiesPopupOpen = false;
        showCalculationNodeProperties(cell, scrollPosition);
      }
    }, 100);
  };
  container.appendChild(addMoreBtn);
  return container;
}
function createCalculationTermField(cell, term, index) {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #f9f9f9;
  `;
  const termLabel = document.createElement('label');
  termLabel.textContent = `Calc ${index + 1}:`;
  termLabel.style.cssText = 'font-weight: 500; color: #333;';
  container.appendChild(termLabel);

  // Create searchable dropdown container
  const searchableContainer = document.createElement('div');
  searchableContainer.style.cssText = 'position: relative; width: 100%;';

  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search or select an amount label...';
  searchInput.style.cssText = `
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
    background: white;
  `;

  // Options container (dropdown)
  const optionsContainer = document.createElement('div');
  optionsContainer.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 200px;
    overflow-y: auto;
    background: white;
    border: 1px solid #ddd;
    border-top: none;
    border-radius: 0 0 6px 6px;
    z-index: 1000;
    display: none;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  `;

  // Function to get all options with display names (defined before use)
  const getAllOptions = () => {
    console.log('[CALC createCalculationTermField] getAllOptions called');
    const allAmountLabels = gatherAllAmountLabels();
    console.log('[CALC createCalculationTermField] Gathered labels:', allAmountLabels);
    return allAmountLabels.map(lbl => {
      let displayName = lbl;
      let value = lbl;
      // Handle numbered_dropdown format: numbered_dropdown:storedValue:displayName
      if (lbl.startsWith('numbered_dropdown:')) {
        console.log('[CALC createCalculationTermField] Processing numbered_dropdown label:', lbl);
        const parts = lbl.split(':');
        if (parts.length >= 3) {
          value = lbl; // Store the full label to preserve the prefix for export
          displayName = parts[1]; // Use the actual node ID as the display name instead of the friendly display name
          console.log('[CALC createCalculationTermField] Parsed numbered_dropdown:', { value, displayName });
        }
      } else if (lbl.startsWith('question_value:')) {
        const parts = lbl.split(':');
        if (parts.length >= 3) {
          value = lbl; // Store the full label to preserve the prefix for export
          displayName = parts[2]; // Use the actual node ID as the display name
        }
      }
      return { value, displayName };
    });
  };

  // Get current display value (after getAllOptions is defined)
  let currentDisplayValue = '';
  console.log('[CALC createCalculationTermField] Getting current display value for term:', term);
  if (term.amountLabel) {
    // Handle numbered_dropdown format
    if (term.amountLabel.startsWith('numbered_dropdown:')) {
      const parts = term.amountLabel.split(':');
      if (parts.length >= 3) {
        currentDisplayValue = parts[1]; // Use the actual node ID instead of the display name
        console.log('[CALC createCalculationTermField] Found numbered_dropdown, using node ID:', currentDisplayValue);
      }
    } else if (term.amountLabel.startsWith('question_value:')) {
      const parts = term.amountLabel.split(':');
      if (parts.length >= 3) {
        currentDisplayValue = parts[2]; // Use the actual node ID instead of the display name
      }
    } else {
      // Try to find matching display name from available options
      const options = getAllOptions();
      const matchingOption = options.find(opt => opt.value === term.amountLabel);
      if (matchingOption) {
        currentDisplayValue = matchingOption.displayName; // displayName is now the actual node ID
        console.log('[CALC createCalculationTermField] Found matching option for stored value:', term.amountLabel, '->', currentDisplayValue);
      } else {
        currentDisplayValue = term.amountLabel;
        console.log('[CALC createCalculationTermField] No matching option found, using raw value:', currentDisplayValue);
      }
    }
  }
  searchInput.value = currentDisplayValue;
  console.log('[CALC createCalculationTermField] Set searchInput value to:', currentDisplayValue);

  // Function to render options
  const renderOptions = (searchTerm = '') => {
    optionsContainer.innerHTML = '';
    const options = getAllOptions();
    const filteredOptions = options.filter(opt => 
      opt.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredOptions.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = 'No matching options';
      noResults.style.cssText = 'padding: 8px 12px; color: #666; font-style: italic;';
      optionsContainer.appendChild(noResults);
      return;
    }

    filteredOptions.forEach(opt => {
      const optionRow = document.createElement('div');
      optionRow.textContent = opt.displayName;
      optionRow.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.15s;
      `;
      optionRow.addEventListener('mouseenter', () => {
        optionRow.style.backgroundColor = '#e3f2fd';
      });
      optionRow.addEventListener('mouseleave', () => {
        optionRow.style.backgroundColor = '';
      });
      optionRow.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur
      });
      optionRow.addEventListener('click', () => {
        console.log('[CALC createCalculationTermField] Option clicked:', opt);
        // Store the full label format (numbered_dropdown:value:display or question_value:... or plain value)
        // First, find the original label from gatherAllAmountLabels
        const allAmountLabels = gatherAllAmountLabels();
        const matchingLabel = allAmountLabels.find(lbl => {
          if (lbl.startsWith('numbered_dropdown:') || lbl.startsWith('question_value:')) {
            const parts = lbl.split(':');
            return parts.length >= 3 && parts[1] === opt.value;
          }
          return lbl === opt.value;
        });
        const valueToStore = matchingLabel || opt.value;
        console.log('[CALC createCalculationTermField] Storing value:', {
          optValue: opt.value,
          optDisplayName: opt.displayName,
          valueToStore,
          matchingLabel
        });
        term.amountLabel = valueToStore;
        searchInput.value = opt.displayName;
        optionsContainer.style.display = 'none';
        updateCalculationNodeCell(cell);
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      });
      optionsContainer.appendChild(optionRow);
    });
  };

  // Event listeners
  searchInput.addEventListener('focus', () => {
    searchInput.style.borderColor = '#1976d2';
    renderOptions(searchInput.value);
    optionsContainer.style.display = 'block';
  });

  searchInput.addEventListener('blur', () => {
    searchInput.style.borderColor = '#ddd';
    // Delay hiding to allow click events
    setTimeout(() => {
      optionsContainer.style.display = 'none';
    }, 150);
  });

  searchInput.addEventListener('input', () => {
    renderOptions(searchInput.value);
    optionsContainer.style.display = 'block';
  });

  searchableContainer.appendChild(searchInput);
  searchableContainer.appendChild(optionsContainer);
  container.appendChild(searchableContainer);
  // Math Operator dropdown (only for terms after the first)
  if (index > 0) {
    const operatorSelect = document.createElement('select');
    operatorSelect.style.cssText = `
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      width: 100px;
    `;
    const operators = ['+', '-', '*', '/'];
    operators.forEach(op => {
      const option = document.createElement('option');
      option.value = op;
      option.textContent = op;
      if (op === term.mathOperator) option.selected = true;
      operatorSelect.appendChild(option);
    });
    operatorSelect.onchange = () => {
      term.mathOperator = operatorSelect.value;
      updateCalculationNodeCell(cell);
    };
    const operatorContainer = document.createElement('div');
    operatorContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    const operatorLabel = document.createElement('label');
    operatorLabel.textContent = 'Math Operator:';
    operatorLabel.style.cssText = 'font-weight: 500; color: #333; white-space: nowrap;';
    operatorContainer.appendChild(operatorLabel);
    operatorContainer.appendChild(operatorSelect);
    container.appendChild(operatorContainer);
  }
  // Remove button (only for terms after the first)
  if (index > 0) {
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.cssText = `
      background: #f44336;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      align-self: flex-start;
    `;
    removeBtn.onclick = () => {
      cell._calcTerms.splice(index, 1);
      updateCalculationNodeCell(cell);
      // Save scroll position before refreshing
      const popup = document.querySelector('.calc-properties-modal');
      const scrollPosition = popup ? popup.scrollTop : 0;
      // Refresh the popup
      setTimeout(() => {
        if (popup) {
          popup.remove();
          window.__calcPropertiesPopupOpen = false;
          showCalculationNodeProperties(cell, scrollPosition);
        }
      }, 100);
    };
    container.appendChild(removeBtn);
  }
  return container;
}
// New function to handle updating calculation terms
window.updateCalcNodeTerm = (cellId, termIndex, property, value) => {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isCalculationNode(cell)) return;
  graph.getModel().beginUpdate();
  try {
    // Initialize terms array if it doesn't exist
    if (!cell._calcTerms) {
      cell._calcTerms = [{amountLabel: "", mathOperator: ""}];
    }
    // Ensure the term exists
    if (termIndex >= 0 && termIndex < cell._calcTerms.length) {
      // Update the specified property
      cell._calcTerms[termIndex][property] = value;
      // For backward compatibility, also update _calcAmountLabel if this is the first term
      if (termIndex === 0 && property === 'amountLabel') {
        cell._calcAmountLabel = value;
      }
    }
  } finally {
    graph.getModel().endUpdate();
  }
  updateCalculationNodeCell(cell);
};
// Add a new calculation term
window.addCalcNodeTerm = (cellId) => {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isCalculationNode(cell)) return;
  graph.getModel().beginUpdate();
  try {
    // Initialize terms array if it doesn't exist
    if (!cell._calcTerms) {
      cell._calcTerms = [{amountLabel: "", mathOperator: ""}];
    }
    // Add a new term with default values
    cell._calcTerms.push({
      amountLabel: "",
      mathOperator: "+"  // Default to addition
    });
  } finally {
    graph.getModel().endUpdate();
  }
  updateCalculationNodeCell(cell);
};
// Remove a calculation term
window.removeCalcNodeTerm = (cellId, termIndex) => {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || !isCalculationNode(cell)) return;
  graph.getModel().beginUpdate();
  try {
    // Ensure we have terms and the index is valid
    if (cell._calcTerms && termIndex > 0 && termIndex < cell._calcTerms.length) {
      // Remove the term at the specified index
      cell._calcTerms.splice(termIndex, 1);
    }
  } finally {
    graph.getModel().endUpdate();
  }
  updateCalculationNodeCell(cell);
};
/**
 * Finds all calculation nodes that depend on the given question node.
 * A calculation node depends on a question if it uses an amount value 
 * from that question in any of its terms.
 * 
 * @param {mxCell} questionCell The question node to check dependencies for
 * @returns {Array} Array of calculation node cells that depend on this question
 */
function findCalcNodesDependentOnQuestion(questionCell) {
  if (!questionCell || !isQuestion(questionCell)) return [];
  const dependentCalcNodes = [];
  const questionId = (typeof window.getNodeId === 'function' ? window.getNodeId(questionCell) : '') || "";
  const questionText = questionCell._questionText || questionCell.value || "";
  const cleanQuestionName = sanitizeNameId(questionText);
  // Also get the questionId directly if available
  const directQuestionId = questionCell._questionId || (questionId.split('_').pop() || "");
  // Get all calculation nodes in the graph
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  const calculationNodes = vertices.filter(cell => isCalculationNode(cell));
  // For each calculation node, check if it depends on this question
  calculationNodes.forEach(calcNode => {
    if (!calcNode._calcTerms) return;
    let isDependentNode = false;
    // Check each calculation term
    calcNode._calcTerms.forEach(term => {
      if (!term.amountLabel) return;
      // Check if this term references the question directly by name or nodeId
      if (term.amountLabel.toLowerCase().includes(questionId.toLowerCase()) ||
          term.amountLabel.toLowerCase().includes(cleanQuestionName.toLowerCase())) {
        isDependentNode = true;
      }
      // Check if this is a direct answer reference for money/number type questions
      if (getQuestionType(questionCell) === "money" || getQuestionType(questionCell) === "number") {
        // Format for direct question references: answer{questionId}
        const answerPattern = `answer${directQuestionId}`;
        if (term.amountLabel === answerPattern) {
          isDependentNode = true;
        }
      }
      // For multiple dropdown questions, check if term references any of its amounts
      if (getQuestionType(questionCell) === "multipleDropdownType" && questionCell._textboxes) {
        questionCell._textboxes.forEach(tb => {
          if (tb.isAmountOption && tb.nameId) {
            const amountPattern = cleanQuestionName + "_" + sanitizeNameId(tb.nameId);
            if (term.amountLabel.toLowerCase().includes(amountPattern.toLowerCase())) {
              isDependentNode = true;
            }
          }
        });
      }
      // For checkbox questions, check for matching option nodes
      if (getQuestionType(questionCell) === "checkbox") {
        const outgoingEdges = graph.getOutgoingEdges(questionCell) || [];
        for (const edge of outgoingEdges) {
          const targetCell = edge.target;
          if (targetCell && isOptions(targetCell) && isAmountOption(targetCell)) {
            let optionText = sanitizeNameId(targetCell.value || "");
            optionText = optionText.replace(/\//g, "_").replace(/_+/g, "_");
            const optionPattern = `${cleanQuestionName}_${optionText}_amount`;
            if (term.amountLabel.toLowerCase().includes(optionPattern.toLowerCase())) {
              isDependentNode = true;
            }
          }
        }
      }
    });
    if (isDependentNode) {
      dependentCalcNodes.push(calcNode);
    }
  });
  return dependentCalcNodes;
}
/**
 * Updates or deletes calculation nodes when a question node changes or is deleted.
 * 
 * @param {mxCell} questionCell The question node that was changed or null if deleted
 * @param {boolean} isDeleted True if the question was deleted, false if just modified
 * @param {string} oldNodeId The previous node ID if changed (optional)
 */
function updateAllCalcNodesOnQuestionChange(questionCell, isDeleted, oldNodeId = null) {
  if (isDeleted && !oldNodeId) {
    return;
  }
  const questionId = isDeleted ? oldNodeId : ((typeof window.getNodeId === 'function' ? window.getNodeId(questionCell) : '') || "");
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  const calculationNodes = vertices.filter(cell => isCalculationNode(cell));
  // For direct references to number/money fields, we need to extract the question ID
  const directQuestionId = isDeleted ? 
    (oldNodeId.split('_').pop() || "") : 
    (questionCell._questionId || (questionId.split('_').pop() || ""));
  // If the question was deleted, find and delete any calc nodes that depend on it
  if (isDeleted) {
    // Gather a list of calc nodes to delete
    const calcNodesToDelete = [];
    calculationNodes.forEach(calcNode => {
      if (!calcNode._calcTerms) return;
      let dependsOnDeletedQuestion = false;
      calcNode._calcTerms.forEach(term => {
        if (!term.amountLabel) return;
        // Check for direct references to the question ID
        if (term.amountLabel.toLowerCase().includes(oldNodeId.toLowerCase())) {
          dependsOnDeletedQuestion = true;
        }
        // Check for direct answer references (money/number types)
        const answerPattern = `answer${directQuestionId}`;
        if (term.amountLabel === answerPattern) {
          dependsOnDeletedQuestion = true;
        }
      });
      if (dependsOnDeletedQuestion) {
        calcNodesToDelete.push(calcNode);
      }
    });
    // Delete the dependent calc nodes
    if (calcNodesToDelete.length > 0) {
      graph.getModel().beginUpdate();
      try {
        graph.removeCells(calcNodesToDelete);
      } finally {
        graph.getModel().endUpdate();
      }
    }
  }
  // If the question was modified, update all dependent calculation nodes
  else {
    const dependentCalcNodes = findCalcNodesDependentOnQuestion(questionCell);
    if (dependentCalcNodes.length > 0) {
      graph.getModel().beginUpdate();
      try {
        // Update each calculation node
        dependentCalcNodes.forEach(calcNode => {
          updateCalculationNodeCell(calcNode);
        });
      } finally {
        graph.getModel().endUpdate();
      }
    }
  }
} 
/**************************************************
 ************ Module Exports **********************
 **************************************************/
// Export all functions to window object for global access
window.calc = {
  isCalculationNode,
  initializeCalculationNode,
  convertToCalculationNode,
  updateCalculationNodeTitle,
  setupCalculationNodeEventListeners,
  getCalculationNodeStyle,
  handleCalculationNodePlacement,
  getCalculationNodeProperties,
  exportCalculationNodeData,
  getCalculationNodeText,
  handleCalculationNodeCopyPaste,
  updateCalculationNodesOnQuestionChange,
  updateCalculationNodeCell,
  gatherAllAmountLabels,
  findCalcNodesDependentOnQuestion,
  updateAllCalcNodesOnQuestionChange
};
// Export individual functions for backward compatibility
window.isCalculationNode = isCalculationNode;
window.initializeCalculationNode = initializeCalculationNode;
window.convertToCalculationNode = convertToCalculationNode;
window.updateCalculationNodeTitle = updateCalculationNodeTitle;
window.setupCalculationNodeEventListeners = setupCalculationNodeEventListeners;
window.getCalculationNodeStyle = getCalculationNodeStyle;
window.handleCalculationNodePlacement = handleCalculationNodePlacement;
window.getCalculationNodeProperties = getCalculationNodeProperties;
window.exportCalculationNodeData = exportCalculationNodeData;
window.getCalculationNodeText = getCalculationNodeText;
window.handleCalculationNodeCopyPaste = handleCalculationNodeCopyPaste;
window.updateCalculationNodesOnQuestionChange = updateCalculationNodesOnQuestionChange;
window.updateCalculationNodeCell = updateCalculationNodeCell;
window.gatherAllAmountLabels = gatherAllAmountLabels;
window.findCalcNodesDependentOnQuestion = findCalcNodesDependentOnQuestion;
window.updateAllCalcNodesOnQuestionChange = updateAllCalcNodesOnQuestionChange; 