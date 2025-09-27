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
        // If it has amounts, push them
        if (cell._textboxes) {
          const cleanQuestionName = sanitizeNameId(cell.value || cell._questionText || "unnamed_question");
          cell._textboxes.forEach(tb => {
            if (tb.isAmountOption) {
              let amountName = sanitizeNameId(tb.nameId || "");
              let label = cleanQuestionName + "_" + amountName;
              labels.push(label);
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
            const optionText = sanitizeNameId(targetCell.value || "");
            const optionLabel = cleanQuestionName + "_" + optionText;
            labels.push(optionLabel);
          }
        }
      } else if (qType === "money" || qType === "number") {
        // Add number/money type questions directly
        const cleanQuestionName = sanitizeNameId(cell.value || "unnamed_question");
        const nodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || "";
        
        // Use answer{questionId} format for consistent JSON export
        const questionId = cell._questionId || nodeId.split('_').pop() || "";
        const label = `answer${questionId}`;
        
        // Add the question text as label for better user identification
        const displayLabel = `${cleanQuestionName} (${label})`;
        
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
      // Check if this is a direct question value (number/money type)
      const isQuestionValue = lbl.startsWith('question_value:');
      
      let value = lbl;
      let displayName = lbl;
      
      if (isQuestionValue) {
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
      if (isQuestionValue) {
        // For question values, check if the stored value matches
        if (term.amountLabel === value) {
          selected = "selected";
        }
      } else {
        // For regular values, check direct match
        if (lbl === term.amountLabel) {
          selected = "selected";
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

  const html = `
    <div style="padding:10px; width:100%;" class="multiple-textboxes-node">
      <label>Calculation Title:</label><br/>
      <div class="textbox-entry">
        <input type="text" value="${escapeAttr(cell._calcTitle)}" onblur="window.updateCalcNodeTitle('${cell.id}', this.value)" style="width:100%;" />
      </div>
      <br/>

      ${calcTermsHtml}

      <label>Comparison Operator:</label>
      <select onchange="window.updateCalcNodeOperator('${cell.id}', this.value)">
        ${operatorOptionsHtml}
      </select>
      <br/><br/>

      <label>Number:</label>
      <input type="number" value="${escapeAttr(cell._calcThreshold)}" onblur="window.updateCalcNodeThreshold('${cell.id}', this.value)"/>
      <br/><br/>

      <label>Final Text:</label><br/>
      <div class="textbox-entry">
        <input type="text" value="${escapeAttr(cell._calcFinalText)}" onblur="window.updateCalcNodeFinalText('${cell.id}', this.value)" style="width:100%;" />
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
    
    // Set minimum size for the calculation node
    const geo = cell.geometry;
    if (geo) {
      // Set a generous minimum width for the calculation node to fit dropdowns
      if (geo.width < 400) {
        geo.width = 400;
      }
      // Ensure height is adequate (add 50px per term after the first)
      const minHeight = 250 + (Math.max(0, cell._calcTerms.length - 1) * 50);
      if (geo.height < minHeight) {
        geo.height = minHeight;
      }
    }
  } finally {
    graph.getModel().endUpdate();
  }
  
  // Force update cell size to fit content
  graph.updateCellSize(cell);
}

// Calculation node field updates
window.updateCalcNodeTitle = (cellId, title) => {
  const cell = graph.model.getCell(cellId);
  if (!cell) return;
  
  cell._calcTitle = title;
  updateCalculationNodeCell(cell);
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
};

window.updateCalcNodeFinalText = (cellId, text) => {
  const cell = graph.model.getCell(cellId);
  if (!cell) return;
  
  cell._calcFinalText = text;
  updateCalculationNodeCell(cell);
};

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
            const optionText = sanitizeNameId(targetCell.value || "");
            const optionPattern = cleanQuestionName + "_" + optionText;
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