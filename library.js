// **********************************************
// ******** Import/Export & Library *************
// **********************************************

// Utility to download JSON
function downloadJson(str, filename) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(str);
  const dlAnchorElem = document.createElement("a");
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", filename);
  document.body.appendChild(dlAnchorElem);
  dlAnchorElem.click();
  document.body.removeChild(dlAnchorElem);
}

// Export the flowchart structure as JSON
window.exportFlowchartJson = function () {
  const parent = graph.getDefaultParent();
  const encoder = new mxCodec();
  const cells = graph.getChildCells(parent, true, true);

  // Map cells, keeping only needed properties
  const simplifiedCells = cells.map(cell => {
    // Basic info about the cell
    const cellData = {
      id: cell.id,
      vertex: cell.vertex,
      edge: cell.edge,
      value: cell.value,
      style: cleanStyle(cell.style), // Clean the style to remove excessive semicolons
    };

    // Handle geometry 
    if (cell.geometry) {
      cellData.geometry = {
        x: cell.geometry.x,
        y: cell.geometry.y,
        width: cell.geometry.width,
        height: cell.geometry.height,
      };
    }

    // Add source and target for edges
    if (cell.edge && cell.source && cell.target) {
      cellData.source = cell.source.id;
      cellData.target = cell.target.id;
    }

    // Custom fields for specific nodes
    if (cell._textboxes) cellData._textboxes = JSON.parse(JSON.stringify(cell._textboxes));
    if (cell._questionText) cellData._questionText = cell._questionText;
    if (cell._twoNumbers) cellData._twoNumbers = cell._twoNumbers;
    if (cell._nameId) cellData._nameId = cell._nameId;
    if (cell._placeholder) cellData._placeholder = cell._placeholder;
    if (cell._questionId) cellData._questionId = cell._questionId;
    
    // textbox properties
    if (cell._amountName) cellData._amountName = cell._amountName;
    if (cell._amountPlaceholder) cellData._amountPlaceholder = cell._amountPlaceholder;
    
    // image option
    if (cell._image) cellData._image = cell._image;
    
    // calculation node properties
    if (cell._calcTitle !== undefined) cellData._calcTitle = cell._calcTitle;
    if (cell._calcAmountLabel !== undefined) cellData._calcAmountLabel = cell._calcAmountLabel;
    if (cell._calcOperator !== undefined) cellData._calcOperator = cell._calcOperator;
    if (cell._calcThreshold !== undefined) cellData._calcThreshold = cell._calcThreshold;
    if (cell._calcFinalText !== undefined) cellData._calcFinalText = cell._calcFinalText;
    if (cell._calcTerms !== undefined) cellData._calcTerms = JSON.parse(JSON.stringify(cell._calcTerms));
    
    // subtitle & info nodes
    if (cell._subtitleText !== undefined) cellData._subtitleText = cell._subtitleText;
    if (cell._infoText !== undefined) cellData._infoText = cell._infoText;

    return cellData;
  });

  const exportObj = {
    cells: simplifiedCells,
    sectionPrefs: sectionPrefs
  };

  const jsonStr = JSON.stringify(exportObj, null, 2);
  
  // Copy to clipboard
  navigator.clipboard.writeText(jsonStr).then(() => {
    console.log('Flowchart JSON copied to clipboard');
    // Show user feedback
    const notification = document.createElement('div');
    notification.textContent = 'Flowchart JSON copied to clipboard!';
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
    document.body.appendChild(notification);
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }).catch(err => {
    console.error('Failed to copy to clipboard:', err);
  });
  
  downloadJson(jsonStr, "flowchart.json");
};

// Import a flowchart JSON file
function importFlowchartJson(event) {
  const file = event.target.files[0];
  if (file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let jsonString = e.target.result;
      if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
        jsonString = jsonString.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      let jsonData;
      try { jsonData = JSON.parse(jsonString); }
      catch { jsonData = JSON.parse(JSON.stringify(eval("(" + jsonString + ")"))); }
      if (!jsonData || !jsonData.cells || !Array.isArray(jsonData.cells)) {
        throw new Error("Invalid flowchart data: missing cells array");
      }
      loadFlowchartData(jsonData);
      currentFlowchartName = null;
    } catch (error) {
      alert("Error importing flowchart: " + error.message);
    }
  };
  reader.readAsText(file);
  }
}
window.importFlowchartJson = importFlowchartJson;

// Direct import from pasted JSON string
window.importFlowchartJsonDirectly = function(jsonString) {
  try {
    if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
      jsonString = jsonString.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    let jsonData;
    try { jsonData = JSON.parse(jsonString); }
    catch { jsonData = JSON.parse(JSON.stringify(eval("(" + jsonString + ")"))); }
    if (!jsonData || !jsonData.cells || !Array.isArray(jsonData.cells)) {
      throw new Error('Import a flowchart JSON (with cells) not GUI JSON');
    }
    loadFlowchartData(jsonData);
    currentFlowchartName = null;
  } catch (error) {
    alert("Error importing flowchart: " + error.message);
  }
};

// Export GUI JSON (sections + hidden fields)
function isJumpNode(cell) {
  const style = cell.style || "";
  return style.includes("strokeWidth=3") && style.includes("strokeColor=#ff0000") && style.includes("dashed=1");
}
function findAllUpstreamOptions(questionCell) {
  // BFS helper (omitted for brevity)
  // ... (existing BFS code) ...
}
function detectSectionJumps(cell, questionCellMap, questionIdMap) {
  // Section jump detection (existing code)
}
window.exportGuiJson = function(download = true) {
  // Renumber questions by Y position before export
  renumberQuestionIds();
  
  // Get all cells
  const cells = graph.getModel().cells;
  const sections = [];
  let hiddenFields = [];
  let sectionCounter = 1;
  let questionCounter = 1;
  let hiddenFieldCounter = 1;
  let defaultPDFName = "";

  // Store sections in a property of the function for external access
  window.exportGuiJson.sections = sections;

  // Create a map of all questions by nodeId
  const questionCellMap = new Map();
  const questionIdMap = new Map();
  const optionCellMap = new Map();
  const vertices = graph.getChildVertices(graph.getDefaultParent());
  const questions = vertices.filter(cell => isQuestion(cell));

  // Create sections array structure and get top level data
  const sectionMap = {};
  for (const num in sectionPrefs) {
    if (parseInt(num) >= sectionCounter) {
      sectionCounter = parseInt(num) + 1;
    }
    sectionMap[num] = {
      sectionId: parseInt(num),
      sectionName: sectionPrefs[num].name || `Section ${num}`,
      questions: []
    };
  }

  // Ensure section 1 always exists
  if (!sectionMap["1"]) {
    sectionMap["1"] = {
      sectionId: 1,
      sectionName: "Enter Name",
      questions: []
    };
  }

  // Add questions to sections by their section number
  for (const cell of questions) {
    const section = getSection(cell) || "1";
    if (!sectionMap[section]) {
      sectionMap[section] = {
        sectionId: parseInt(section),
        sectionName: `Section ${section}`,
        questions: []
      };
    }
    
    let questionType = getQuestionType(cell);
    let exportType = questionType;
    // --- PATCH: treat text2 as dropdown ---
    if (questionType === "text2") exportType = "dropdown";
    
    const question = {
      questionId: cell._questionId || questionCounter++,
      text: cell._questionText || cell.value || "",
      type: exportType,
      logic: {
        enabled: false,
        conditions: []
      },
      jump: {
        enabled: false,
        conditions: []
      },
      conditionalPDF: {
        enabled: false,
        pdfName: "",
        answer: "Yes"
      },
      conditionalAlert: {
        enabled: false,
        prevQuestion: "",
        prevAnswer: "",
        text: ""
      },
      subtitle: {
        enabled: false,
        text: ""
      },
      infoBox: {
        enabled: false,
        text: ""
      },
      options: [],
      labels: [],
      nameId: sanitizeNameId(getNodeId(cell) || cell._nameId || cell._questionText || cell.value || "unnamed"),
      placeholder: cell._placeholder || ""
    };
    
    // For text2, clean the text from HTML
    if (questionType === "text2" && question.text) {
      const temp = document.createElement("div");
      temp.innerHTML = question.text;
      question.text = temp.textContent || temp.innerText || question.text;
    }
    
    // For multiple textboxes, add the textboxes array
    if (questionType === "multipleTextboxes" && cell._textboxes) {
      question.textboxes = cell._textboxes.map(tb => ({
        nameId: tb.nameId || "",
        placeholder: tb.placeholder || "Enter value"
      }));
    }
    
    // Handle outgoing edges to option nodes
    const outgoingEdges = graph.getOutgoingEdges(cell);
    const jumpConditions = [];
    let endOption = null;
    
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (targetCell && isOptions(targetCell)) {
          let optionText = targetCell.value || "";
          // Clean HTML from option text
          if (optionText.includes("<")) {
            const temp = document.createElement("div");
            temp.innerHTML = optionText;
            optionText = temp.textContent || temp.innerText || optionText;
          }
          const option = {
            text: optionText
          };
          
          // Check if this option leads to an end node (directly or through multipleDropdownType/multipleTextboxes)
          const optionOutgoingEdges = graph.getOutgoingEdges(targetCell);
          if (optionOutgoingEdges) {
            for (const optionEdge of optionOutgoingEdges) {
              const optionTarget = optionEdge.target;
              if (optionTarget && isEndNode(optionTarget)) {
                // This option leads directly to an end node
                jumpConditions.push({
                  option: optionText.trim(),
                  to: "end"
                });
                endOption = optionText.trim();
                break;
              } else if (optionTarget && isQuestion(optionTarget)) {
                // Check if this question leads to an end node
                const questionType = getQuestionType(optionTarget);
                if (questionType === "multipleDropdownType" || questionType === "multipleTextboxes") {
                  // For multipleDropdownType/multipleTextboxes, check if they lead to an end node
                  const questionOutgoingEdges = graph.getOutgoingEdges(optionTarget);
                  if (questionOutgoingEdges) {
                    for (const questionEdge of questionOutgoingEdges) {
                      const questionTarget = questionEdge.target;
                      if (questionTarget && isEndNode(questionTarget)) {
                        // This option leads to a multipleDropdownType/multipleTextboxes that leads to an end node
                        jumpConditions.push({
                          option: optionText.trim(),
                          to: "end"
                        });
                        endOption = optionText.trim();
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
          
          // Handle amount options
          if (getQuestionType(targetCell) === "amountOption") {
            option.amount = {
              name: targetCell._amountName || "value",
              placeholder: targetCell._amountPlaceholder || "Enter amount"
            };
          }
          // Handle image options
          if (getQuestionType(targetCell) === "imageOption" && targetCell._image) {
            option.image = targetCell._image;
          }
          question.options.push(option);
        }
      }
    }
    
    // Set jump logic if any options lead to end nodes
    if (jumpConditions.length > 0) {
      question.jump.enabled = true;
      question.jump.conditions = jumpConditions;
    }
    
    // Set conditionalPDF answer to the option that leads to end (if any)
    if (endOption) {
      question.conditionalPDF.answer = endOption;
    }
    
    // --- PATCH: For dropdowns, convert options to array of strings and add linking/image fields ---
    if (exportType === "dropdown") {
      let imageData = null;
      // Convert options to array of strings, and extract image node if present
      question.options = question.options.map(opt => {
        if (typeof opt.text === 'string') {
          // If this option is an image node, extract its image data and skip adding text
          if (opt.image && typeof opt.image === 'object') {
            imageData = opt.image;
            return null; // Skip this option text
          }
          return opt.text;
        }
        return "";
      }).filter(opt => opt !== null); // Remove null entries (image options)
      
      // Add linking field
      question.linking = { enabled: false, targetId: "" };
      // Add image field: use imageData if found, else default
      question.image = imageData || { url: "", width: 0, height: 0 };
    }
    
    // --- PATCH: For checkboxes, convert options to proper checkbox format ---
    if (exportType === "checkbox") {
      // Clean the question text from HTML
      if (question.text && question.text.includes("<")) {
        const temp = document.createElement("div");
        temp.innerHTML = question.text;
        question.text = temp.textContent || temp.innerText || question.text;
      }
      
      // Get the proper base nameId from the question's nodeId
      const baseNameId = getNodeId(cell) || question.nameId || "unnamed";
      
      // Convert options to checkbox format
      question.options = question.options.map(opt => {
        if (typeof opt.text === 'string') {
          const optionText = opt.text.trim();
          return {
            label: optionText,
            nameId: `${baseNameId}_${optionText.toLowerCase().replace(/\s+/g, '_')}`,
            value: "",
            hasAmount: false,
            amountName: "",
            amountPlaceholder: ""
          };
        }
        return {
          label: "",
          nameId: "",
          value: "",
          hasAmount: false,
          amountName: "",
          amountPlaceholder: ""
        };
      });
      
      // Set conditionalPDF answer to empty string for checkboxes
      question.conditionalPDF.answer = "";
    }
    
    // --- PATCH: For multipleDropdownType, convert to numberedDropdown format ---
    if (exportType === "multipleDropdownType") {
      // Change type to numberedDropdown
      question.type = "numberedDropdown";
      
      // Extract labels and amounts from textboxes
      if (cell._textboxes && Array.isArray(cell._textboxes)) {
        // Labels should only include non-amount options
        question.labels = [];
        // Amounts should be a simple array of strings for amount options
        question.amounts = [];
        
        cell._textboxes.forEach(tb => {
          if (tb.isAmountOption === true) {
            // Add to amounts as a simple string
            question.amounts.push(tb.nameId || tb.placeholder || "");
          } else {
            // Add to labels as a simple string
            question.labels.push(tb.nameId || tb.placeholder || "");
          }
        });
      } else {
        question.labels = [];
        question.amounts = [];
      }
      
      // Extract min and max from _twoNumbers
      if (cell._twoNumbers) {
        question.min = cell._twoNumbers.first || "1";
        question.max = cell._twoNumbers.second || "1";
      } else {
        question.min = "1";
        question.max = "1";
      }
      
      // Clear options array for numberedDropdown
      question.options = [];
    }
    
    // --- PATCH: For number type questions, convert to money type ---
    if (exportType === "number") {
      // Number questions should be exported as money type
      question.type = "money";
      question.placeholder = cell._placeholder || "";
      
      // Clear options array for money questions
      question.options = [];
      question.labels = [];
    }
    
    // --- PATCH: Add comprehensive parent conditional logic ---
    function findDirectParentCondition(cell) {
      const incomingEdges = graph.getIncomingEdges(cell) || [];
      const conditions = [];
      
      for (const edge of incomingEdges) {
        const sourceCell = edge.source;
        if (sourceCell && isOptions(sourceCell)) {
          // Find the parent question of this option node
          const optionIncoming = graph.getIncomingEdges(sourceCell) || [];
          for (const optEdge of optionIncoming) {
            const parentQ = optEdge.source;
            if (parentQ && isQuestion(parentQ)) {
              const prevQuestionId = parentQ._questionId || "";
              let optionLabel = sourceCell.value || "";
              if (optionLabel.includes("<")) {
                const temp = document.createElement("div");
                temp.innerHTML = optionLabel;
                optionLabel = temp.textContent || temp.innerText || optionLabel;
              }
              conditions.push({
                prevQuestion: String(prevQuestionId),
                prevAnswer: optionLabel.trim()
              });
            }
          }
        } else if (sourceCell && isQuestion(sourceCell)) {
          // This is a direct question-to-question connection
          // Check if the source is a multiple textbox/dropdown question
          const sourceQuestionType = getQuestionType(sourceCell);
          if (sourceQuestionType === "multipleTextboxes" || sourceQuestionType === "multipleDropdownType") {
            // For multiple textbox/dropdown questions, we need to find their parent condition
            const sourceParentCondition = findDirectParentCondition(sourceCell);
            if (sourceParentCondition) {
              if (Array.isArray(sourceParentCondition)) {
                conditions.push(...sourceParentCondition);
              } else {
                conditions.push(sourceParentCondition);
              }
            }
          }
        }
      }
      
      // Remove duplicates based on prevQuestion and prevAnswer combination
      const uniqueConditions = [];
      const seen = new Set();
      for (const condition of conditions) {
        const key = `${condition.prevQuestion}:${condition.prevAnswer}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueConditions.push(condition);
        }
      }
      
      // If there are multiple conditions, return all of them
      if (uniqueConditions.length > 1) {
        return uniqueConditions;
      }
      
      // Return the first condition if only one, or null if none
      return uniqueConditions.length > 0 ? uniqueConditions[0] : null;
    }
    
    const directParentCondition = findDirectParentCondition(cell);
    if (directParentCondition) {
      question.logic.enabled = true;
      // Handle both single condition and array of conditions
      if (Array.isArray(directParentCondition)) {
        question.logic.conditions = directParentCondition;
      } else {
        question.logic.conditions = [directParentCondition];
      }
    }
    // --- END PATCH ---
    
    sectionMap[section].questions.push(question);
  }
  
  // Sort questions within each section by questionId
  for (const secNum in sectionMap) {
    sectionMap[secNum].questions.sort((a, b) => {
      const aId = parseInt(a.questionId) || 0;
      const bId = parseInt(b.questionId) || 0;
      return aId - bId;
    });
  }
  
  // Convert sectionMap to array and sort by sectionId
  for (const secNum in sectionMap) {
    sections.push(sectionMap[secNum]);
  }
  sections.sort((a, b) => a.sectionId - b.sectionId);
  
  // Create final output object
  const output = {
    sections: sections,
    hiddenFields: hiddenFields,
    sectionCounter: sectionCounter,
    questionCounter: questionCounter,
    hiddenFieldCounter: hiddenFieldCounter,
    defaultPDFName: defaultPDFName,
    additionalPDFs: []
  };
  
  // Convert to string and download
  const jsonStr = JSON.stringify(output, null, 2);
  
  // Copy to clipboard
  navigator.clipboard.writeText(jsonStr).then(() => {
    console.log('GUI JSON copied to clipboard');
    // Show user feedback
    const notification = document.createElement('div');
    notification.textContent = 'GUI JSON copied to clipboard!';
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
    document.body.appendChild(notification);
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }).catch(err => {
    console.error('Failed to copy to clipboard:', err);
  });
  
  if (download) {
    downloadJson(jsonStr, "gui.json");
  }
  return jsonStr;
};

// Export both flowchart and GUI JSON in a combined format
window.exportBothJson = function() {
  try {
    // Get flowchart JSON
    const parent = graph.getDefaultParent();
    const encoder = new mxCodec();
    const cells = graph.getChildCells(parent, true, true);

    // Map cells, keeping only needed properties
    const simplifiedCells = cells.map(cell => {
      // Basic info about the cell
      const cellData = {
        id: cell.id,
        vertex: cell.vertex,
        edge: cell.edge,
        value: cell.value,
        style: cleanStyle(cell.style), // Clean the style to remove excessive semicolons
      };

      // Handle geometry 
      if (cell.geometry) {
        cellData.geometry = {
          x: cell.geometry.x,
          y: cell.geometry.y,
          width: cell.geometry.width,
          height: cell.geometry.height,
        };
      }

      // Add source and target for edges
      if (cell.edge && cell.source && cell.target) {
        cellData.source = cell.source.id;
        cellData.target = cell.target.id;
      }

      // Custom fields for specific nodes
      if (cell._textboxes) cellData._textboxes = JSON.parse(JSON.stringify(cell._textboxes));
      if (cell._questionText) cellData._questionText = cell._questionText;
      if (cell._twoNumbers) cellData._twoNumbers = cell._twoNumbers;
      if (cell._nameId) cellData._nameId = cell._nameId;
      if (cell._placeholder) cellData._placeholder = cell._placeholder;
      if (cell._questionId) cellData._questionId = cell._questionId;
      
      // textbox properties
      if (cell._amountName) cellData._amountName = cell._amountName;
      if (cell._amountPlaceholder) cellData._amountPlaceholder = cell._amountPlaceholder;
      
      // image option
      if (cell._image) cellData._image = cell._image;
      
      // calculation node properties
      if (cell._calcTitle !== undefined) cellData._calcTitle = cell._calcTitle;
      if (cell._calcAmountLabel !== undefined) cellData._calcAmountLabel = cell._calcAmountLabel;
      if (cell._calcOperator !== undefined) cellData._calcOperator = cell._calcOperator;
      if (cell._calcThreshold !== undefined) cellData._calcThreshold = cell._calcThreshold;
      if (cell._calcFinalText !== undefined) cellData._calcFinalText = cell._calcFinalText;
      if (cell._calcTerms !== undefined) cellData._calcTerms = JSON.parse(JSON.stringify(cell._calcTerms));
      
      // subtitle & info nodes
      if (cell._subtitleText !== undefined) cellData._subtitleText = cell._subtitleText;
      if (cell._infoText !== undefined) cellData._infoText = cell._infoText;

      return cellData;
    });

    const flowchartExportObj = {
      cells: simplifiedCells,
      sectionPrefs: sectionPrefs
    };

    const flowchartJson = JSON.stringify(flowchartExportObj, null, 2);
    
    // Get GUI JSON (without downloading)
    const guiJson = exportGuiJson(false);
    
    // Combine both JSONs in the specified format
    const combinedText = `Okay great, here is my flowchart json: "${flowchartJson}" and here is the gui json produced: "${guiJson}"`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(combinedText).then(() => {
      console.log('Both JSONs copied to clipboard');
      // Show user feedback
      const notification = document.createElement('div');
      notification.textContent = 'Both JSONs copied to clipboard!';
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
      document.body.appendChild(notification);
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
    
  } catch (error) {
    console.error('Error in exportBothJson:', error);
    alert('Error exporting both JSONs: ' + error.message);
  }
};

// Fix capitalization in jump/logic conditions
titleCaseFix:
window.fixCapitalizationInJumps = function() {
  // ... (existing fix code) ...
};
window.fixCapitalizationInJumps();

// Save flowchart to Firebase
window.saveFlowchart = function() {
  if (!window.currentUser || window.currentUser.isGuest) { alert("Please log in with a real account to save flowcharts. Guest users cannot save."); return;}  
  renumberQuestionIds();
  let flowchartName = currentFlowchartName;
  if (!flowchartName) {
    flowchartName = prompt("Enter a name for this flowchart:");
    if (!flowchartName || !flowchartName.trim()) return;
    currentFlowchartName = flowchartName;
  }
  // Gather data and save
  const data = { cells: [] };
  const cells = graph.getModel().cells;
  for (let id in cells) {
    if (id === "0" || id === "1") continue;
    const cell = cells[id];
    const cellData = {
      id: cell.id, 
      value: cell.value || "",
      geometry: cell.geometry ? { 
        x: cell.geometry.x, 
        y: cell.geometry.y, 
        width: cell.geometry.width, 
        height: cell.geometry.height 
      } : null,
      style: cleanStyle(cell.style || ""),
      vertex: !!cell.vertex, 
      edge: !!cell.edge,
      source: cell.edge ? (cell.source? cell.source.id:null) : null,
      target: cell.edge ? (cell.target? cell.target.id:null) : null,
      _textboxes: cell._textboxes||null, _questionText: cell._questionText||null,
      _twoNumbers: cell._twoNumbers||null, _nameId: cell._nameId||null,
      _placeholder: cell._placeholder||"", _questionId: cell._questionId||null,
      _image: cell._image||null
    };
    if (isCalculationNode(cell)) {
      cellData._calcTitle = cell._calcTitle;
      cellData._calcAmountLabel = cell._calcAmountLabel;
      cellData._calcOperator = cell._calcOperator;
      cellData._calcThreshold = cell._calcThreshold;
      cellData._calcFinalText = cell._calcFinalText;
      cellData._calcTerms = cell._calcTerms;
    }
    data.cells.push(cellData);
  }
  data.sectionPrefs = sectionPrefs;
  db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(flowchartName).set({ flowchart: data })
    .then(()=>alert("Flowchart saved as: " + flowchartName))
    .catch(err=>alert("Error saving: " + err));
};

// View saved flowcharts
window.viewSavedFlowcharts = function() {
  if (!window.currentUser || window.currentUser.isGuest) { alert("Please log in with a real account to view saved flowcharts. Guest users cannot load."); return; }
  db.collection("users").doc(window.currentUser.uid).collection("flowcharts").get()
    .then(snapshot=>{
      let html = snapshot.empty ? "<p>No saved flowcharts.</p>" : "";
      snapshot.forEach(doc=>{
        const name = doc.id;
        html += `<div class="flowchart-item"><strong ondblclick="renameFlowchart('${name}', this)">${name}</strong>
                  <button onclick="openSavedFlowchart('${name}')">Open</button>
                  <button onclick="deleteSavedFlowchart('${name}')">Delete</button></div>`;
      });
      document.getElementById("flowchartList").innerHTML = html;
      document.getElementById("flowchartListOverlay").style.display = "flex";
    })
    .catch(err=>alert("Error fetching: " + err));
};

window.openSavedFlowchart = function(name) {
  if (!window.currentUser || window.currentUser.isGuest) { alert("Please log in with a real account to open saved flowcharts. Guest users cannot load."); return; }
  db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(name)
    .get().then(docSnap=>{
      if (!docSnap.exists) { alert("No flowchart named " + name); return; }
      loadFlowchartData(docSnap.data().flowchart);
      currentFlowchartName = name;
      document.getElementById("flowchartListOverlay").style.display = "none";
    }).catch(err=>alert("Error loading: " + err));
};

window.renameFlowchart = function(oldName, element) {
  if (!window.currentUser || window.currentUser.isGuest) { alert("Please log in with a real account to rename flowcharts. Guest users cannot rename."); return; }
  let newName = prompt("New name:", oldName);
  if (!newName||!newName.trim()||newName===oldName) return;
  const docRef = db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(oldName);
  docRef.get().then(docSnap=>{
    if (docSnap.exists) {
      db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(newName).set(docSnap.data())
        .then(()=>{ docRef.delete(); element.textContent=newName; if(currentFlowchartName===oldName) currentFlowchartName=newName; alert("Renamed to: " + newName); })
        .catch(err=>alert("Error renaming: " + err));
    }
  });
};

window.deleteSavedFlowchart = function(name) {
  if (!window.currentUser || window.currentUser.isGuest) { alert("Please log in with a real account to delete flowcharts. Guest users cannot delete."); return; }
  if (!confirm("Delete '"+name+"'?")) return;
  db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(name).delete()
    .then(()=>{ alert("Deleted: " + name); if(currentFlowchartName===name) currentFlowchartName=null; window.viewSavedFlowcharts(); })
    .catch(err=>alert("Error deleting: " + err));
};

/**************************************************
 *            FILE I/O OPERATIONS               *
 **************************************************/

/**
 * Downloads a string as a JSON file.
 */
function downloadJson(str, filename) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(str);
  const dlAnchorElem = document.createElement("a");
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", filename);
  document.body.appendChild(dlAnchorElem);
  dlAnchorElem.click();
  document.body.removeChild(dlAnchorElem);
}

/**
 * Exports the flowchart to a JSON file.
 */
function exportFlowchartJson() {
  const parent = graph.getDefaultParent();
  const encoder = new mxCodec();
  const cells = graph.getChildCells(parent, true, true);

  // Map cells, keeping only needed properties
  const simplifiedCells = cells.map(cell => {
    // Basic info about the cell
    const cellData = {
      id: cell.id,
      vertex: cell.vertex,
      edge: cell.edge,
      value: cell.value,
      style: cell.style,
    };

    // Handle geometry 
    if (cell.geometry) {
      cellData.geometry = {
        x: cell.geometry.x,
        y: cell.geometry.y,
        width: cell.geometry.width,
        height: cell.geometry.height,
      };
    }

    // Add source and target for edges
    if (cell.edge && cell.source && cell.target) {
      cellData.source = cell.source.id;
      cellData.target = cell.target.id;
    }

    // Custom fields for specific nodes
    if (cell._textboxes) cellData._textboxes = JSON.parse(JSON.stringify(cell._textboxes));
    if (cell._questionText) cellData._questionText = cell._questionText;
    if (cell._twoNumbers) cellData._twoNumbers = cell._twoNumbers;
    if (cell._nameId) cellData._nameId = cell._nameId;
    if (cell._placeholder) cellData._placeholder = cell._placeholder;
    if (cell._questionId) cellData._questionId = cell._questionId;
    
    // textbox properties
    if (cell._amountName) cellData._amountName = cell._amountName;
    if (cell._amountPlaceholder) cellData._amountPlaceholder = cell._amountPlaceholder;
    
    // image option
    if (cell._image) cellData._image = cell._image;
    
    // calculation node properties
    if (cell._calcTitle !== undefined) cellData._calcTitle = cell._calcTitle;
    if (cell._calcAmountLabel !== undefined) cellData._calcAmountLabel = cell._calcAmountLabel;
    if (cell._calcOperator !== undefined) cellData._calcOperator = cell._calcOperator;
    if (cell._calcThreshold !== undefined) cellData._calcThreshold = cell._calcThreshold;
    if (cell._calcFinalText !== undefined) cellData._calcFinalText = cell._calcFinalText;
    if (cell._calcTerms !== undefined) cellData._calcTerms = JSON.parse(JSON.stringify(cell._calcTerms));
    
    // subtitle & info nodes
    if (cell._subtitleText !== undefined) cellData._subtitleText = cell._subtitleText;
    if (cell._infoText !== undefined) cellData._infoText = cell._infoText;

    return cellData;
  });

  const exportObj = {
    cells: simplifiedCells,
    sectionPrefs: sectionPrefs
  };

  const jsonStr = JSON.stringify(exportObj, null, 2);
  downloadJson(jsonStr, "flowchart.json");
}

/**
 * Exports the flowchart to a GUI-usable JSON format.
 */
function exportGuiJson() {
  const parent = graph.getDefaultParent();
  const questionCellMap = new Map();
  const questionIdMap = new Map();
  const optionCellMap = new Map();
  const vertices = graph.getChildVertices(parent);

  // Filter only question nodes
  const questions = vertices.filter(cell => isQuestion(cell));

  // Create a table for the question nodes first
  questions.forEach(cell => {
    // If this node has multiple textboxes, handle specially
    const questionType = getQuestionType(cell); 
    const sectionNum = getSection(cell);
    
    const uniqueNodeId = getNodeId(cell) || "unnamed";
    questionCellMap.set(cell.id, cell); // Map by ID
    questionIdMap.set(uniqueNodeId, cell); // Map by text/nodeId
    
    const outgoingEdges = graph.getOutgoingEdges(cell);
  });

  // For more complex cases, identify & record section jumps
  let jumps = [];
  vertices.forEach(cell => {
    if (isOptions(cell)) {
      detectSectionJumps(cell, questionCellMap, questionIdMap, jumps);
    }
  });

  // Clean up the jumps - filter out any duplicate jumps for the same option leading to the same section
  jumps = jumps.filter((jump, index, self) => 
    index === self.findIndex(j => (j.from === jump.from && j.option === jump.option && j.to === jump.to))
  );

  // Sort questions by section number then question number
  const sortedQuestions = [...questionCellMap.values()].sort((a, b) => {
    const sectionA = parseInt(getSection(a) || "1");
    const sectionB = parseInt(getSection(b) || "1");
    if (sectionA !== sectionB) return sectionA - sectionB;
    
    // First try sorting by questionId if both have one
    if (a._questionId && b._questionId) {
      return parseInt(a._questionId) - parseInt(b._questionId);
    }
    
    // Fall back to sorting by value if no questionId
    return (a.value || "").localeCompare(b.value || "");
  });

  // Build the sections
  const sections = {};
  Object.keys(sectionPrefs).forEach(secNum => {
    sections[secNum] = {
      name: sectionPrefs[secNum].name,
      color: sectionPrefs[secNum].borderColor,
      questions: []
    };
  });

  // Now format each question with its options
  sortedQuestions.forEach(cell => {
    const qType = getQuestionType(cell) || "dropdown";
    const qId = getNodeId(cell) || sanitizeNameId(cell.value || "unnamed");
    const qSection = getSection(cell);
    
    const questionObj = {
      id: qId,
      text: cell._questionText || cell.value || "",
      type: qType,
      questionNumber: cell._questionId || "",
      options: []
    };
    
    // Special handling for multipleTextboxes
    if (qType === "multipleTextboxes" && cell._textboxes) {
      questionObj.textboxes = cell._textboxes;
    }
    
    // Special handling for multipleDropdownType
    if (qType === "multipleDropdownType" && cell._textboxes) {
      questionObj.textboxes = cell._textboxes;
    }
    
    // Get all options for this question
    const outgoingEdges = graph.getOutgoingEdges(cell) || [];
    outgoingEdges.forEach(edge => {
      const targetCell = edge.target;
      if (targetCell && isOptions(targetCell)) {
        const optionText = targetCell.value || "";
        const targetOptions = graph.getOutgoingEdges(targetCell) || [];
        
        // Check if this option leads to another question
        let nextQuestion = null;
        if (targetOptions.length > 0) {
          const firstOptionTarget = targetOptions[0].target;
          if (firstOptionTarget && isQuestion(firstOptionTarget)) {
            const targetId = getNodeId(firstOptionTarget) || "";
            // Only set nextQuestion if it's in a different section
            if (getSection(firstOptionTarget) === qSection) {
              nextQuestion = targetId;
            }
          }
        }
        
        const optionObj = {
          text: optionText,
        };
        
        if (nextQuestion) optionObj.nextQuestion = nextQuestion;
        
        // If this is an amount option, add amount properties
        if (getQuestionType(targetCell) === "amountOption") {
          optionObj.amount = {
            name: targetCell._amountName || "value",
            placeholder: targetCell._amountPlaceholder || "Enter value"
          };
        }
        
        // If this is an image option, add image URL
        if (getQuestionType(targetCell) === "imageOption" && targetCell._image) {
          optionObj.image = targetCell._image;
        }
        
        questionObj.options.push(optionObj);
      }
    });
    
    sections[qSection].questions.push(questionObj);
  });
  
  // Add calculation nodes
  const calcNodes = vertices.filter(cell => isCalculationNode(cell));
  const calculationNodes = calcNodes.map(cell => {
    return {
      id: sanitizeNameId(cell._calcTitle || "calc"),
      title: cell._calcTitle || "Calculation",
      terms: cell._calcTerms || [],
      operator: cell._calcOperator || "=",
      threshold: cell._calcThreshold || "0",
      resultText: cell._calcFinalText || ""
    };
  });

  // Build the final output
  const output = {
    flowTitle: "Flowchart Title",
    sections: Object.values(sections),
    jumps: jumps,
    calculations: calculationNodes
  };

  // Download the JSON
  const jsonStr = JSON.stringify(output, null, 2);
  downloadJson(jsonStr, "flowchart_gui.json");
}

/**
 * Load a flowchart from JSON data.
 */
function loadFlowchartData(data) {
  if (!data.cells) {
    alert("Invalid flowchart data");
    return;
  }
  
  // Check if we have edges without an existing edge style - add default style
  data.cells.forEach(item => {
    if (item.edge && (!item.style || item.style === "")) {
      item.style = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
    }
  });

  graph.getModel().beginUpdate();
  try {
    const parent = graph.getDefaultParent();
    graph.removeCells(graph.getChildVertices(parent));
    const createdCells = {};

    if (data.sectionPrefs) {
      sectionPrefs = data.sectionPrefs;
      // updateSectionLegend is defined in legend.js
      updateSectionLegend();
    }

    // First pass: Create all cells
    data.cells.forEach(item => {
      if (item.vertex) {
        const geo = new mxGeometry(
          item.geometry.x,
          item.geometry.y,
          item.geometry.width,
          item.geometry.height
        );
        const newCell = new mxCell(item.value, geo, item.style);
        newCell.vertex = true;
        newCell.id = item.id;
        
        // Transfer all custom properties
        if (item._textboxes) newCell._textboxes = JSON.parse(JSON.stringify(item._textboxes));
        if (item._questionText) newCell._questionText = item._questionText;
        if (item._twoNumbers) newCell._twoNumbers = item._twoNumbers;
        if (item._nameId) newCell._nameId = item._nameId;
        if (item._placeholder) newCell._placeholder = item._placeholder;
        if (item._questionId) newCell._questionId = item._questionId;
        
        // Amount option properties
        if (item._amountName) newCell._amountName = item._amountName;
        if (item._amountPlaceholder) newCell._amountPlaceholder = item._amountPlaceholder;
        
        // Image option
        if (item._image) newCell._image = item._image;
        
        // Calculation properties
        if (item._calcTitle !== undefined) newCell._calcTitle = item._calcTitle;
        if (item._calcAmountLabel !== undefined) newCell._calcAmountLabel = item._calcAmountLabel;
        if (item._calcOperator !== undefined) newCell._calcOperator = item._calcOperator;
        if (item._calcThreshold !== undefined) newCell._calcThreshold = item._calcThreshold;
        if (item._calcFinalText !== undefined) newCell._calcFinalText = item._calcFinalText;
        if (item._calcTerms !== undefined) newCell._calcTerms = JSON.parse(JSON.stringify(item._calcTerms));
        
        // Subtitle and info node properties - preserve exact text
        if (item._subtitleText !== undefined) newCell._subtitleText = item._subtitleText;
        if (item._infoText !== undefined) newCell._infoText = item._infoText;

        graph.addCell(newCell, parent);
        createdCells[item.id] = newCell;
      }
    });

    // Handle duplicate node IDs after all cells are created
    resolveDuplicateNodeIds(Object.values(createdCells));

    // Second pass: Connect the edges
    data.cells.forEach(item => {
      if (item.edge && item.source && item.target) {
        const source = createdCells[item.source];
        const target = createdCells[item.target];
        
        if (source && target) {
          const geo = new mxGeometry();
          const edge = new mxCell("", geo, item.style);
          edge.edge = true;
          edge.id = item.id;
          edge.source = source;
          edge.target = target;
          graph.addCell(edge, parent);
        }
      }
    });

    // Third pass: Update cell displays based on types
  graph.getModel().beginUpdate();
  try {
      Object.values(createdCells).forEach(cell => {
        if (getQuestionType(cell) === 'multipleTextboxes') {
          updateMultipleTextboxesCell(cell);
        } else if (getQuestionType(cell) === 'multipleDropdownType') {
          updatemultipleDropdownTypeCell(cell);
        } else if (getQuestionType(cell) === 'text2') {
          updateText2Cell(cell);
        } else if (getQuestionType(cell) === 'amountOption') {
          // Amount options are handled in refreshAllCells
        } else if (getQuestionType(cell) === 'imageOption') {
        updateImageOptionCell(cell);
      } else if (isCalculationNode(cell)) {
        updateCalculationNodeCell(cell);
      } else if (isSubtitleNode(cell)) {
          // Use the _subtitleText property if available, otherwise extract from value
        if (!cell._subtitleText && cell.value) {
          const cleanValue = cell.value.replace(/<[^>]+>/g, "").trim();
          cell._subtitleText = cleanValue || "Subtitle text";
        }
        updateSubtitleNodeCell(cell);
      } else if (isInfoNode(cell)) {
          // Use the _infoText property if available, otherwise extract from value
        if (!cell._infoText && cell.value) {
          const cleanValue = cell.value.replace(/<[^>]+>/g, "").trim();
          cell._infoText = cleanValue || "Information text";
        }
        updateInfoNodeCell(cell);
      }
    });
    } finally {
      graph.getModel().endUpdate();
    }
  } finally {
    graph.getModel().endUpdate();
  }

  refreshAllCells();
  
  // Find node with smallest y-position (topmost on screen) and center on it
  setTimeout(() => {
    const vertices = graph.getChildVertices(graph.getDefaultParent());
    if (vertices.length > 0) {
      // Find the node with the smallest y-position (topmost on the screen)
      let topNode = vertices[0];
      let minY = vertices[0].geometry.y;
      vertices.forEach(cell => {
        if (cell.geometry.y < minY) {
          minY = cell.geometry.y;
          topNode = cell;
        }
      });
      // Center the view on the topmost node
      if (topNode) {
        const centerX = topNode.geometry.x + topNode.geometry.width / 2;
        const centerY = topNode.geometry.y + topNode.geometry.height / 2;
        const containerWidth = graph.container.clientWidth;
        const containerHeight = graph.container.clientHeight;
        const scale = graph.view.scale;
        const tx = (containerWidth / 2 - centerX * scale);
        const ty = (containerHeight / 2 - centerY * scale);
        graph.view.setTranslate(tx / scale, ty / scale);
        graph.view.refresh();
      }
    }
  }, 100); // Small delay to ensure all rendering is complete
}

/**
 * Resolves duplicate node IDs by adding numbering to duplicates
 */
function resolveDuplicateNodeIds(cells) {
  const nodeIdCounts = new Map();
  const nodeIdToCells = new Map();
  
  // First pass: collect all node IDs and their occurrences
  cells.forEach(cell => {
    const nodeId = getNodeId(cell);
    if (nodeId) {
      if (!nodeIdCounts.has(nodeId)) {
        nodeIdCounts.set(nodeId, 0);
        nodeIdToCells.set(nodeId, []);
      }
      nodeIdCounts.set(nodeId, nodeIdCounts.get(nodeId) + 1);
      nodeIdToCells.get(nodeId).push(cell);
    }
  });
  
  // Second pass: resolve duplicates by adding numbering
  nodeIdCounts.forEach((count, nodeId) => {
    if (count > 1) {
      const cellsWithThisId = nodeIdToCells.get(nodeId);
      
      // Keep the first occurrence as is, number the rest
      for (let i = 1; i < cellsWithThisId.length; i++) {
        const cell = cellsWithThisId[i];
        const newNodeId = `${nodeId}_${i}`;
        setNodeId(cell, newNodeId);
      }
    }
  });
}