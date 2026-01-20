// **********************************************
// ******** Import/Export & Library *************
// **********************************************
// Helper function to check if a cell is a PDF node
function isPdfNode(cell) {
  return cell && cell.style && cell.style.includes("nodeType=pdfNode");
}
// Helper function to check if a cell is an options node
function isOptions(cell) {
  return cell && cell.style && cell.style.includes("nodeType=options");
}
// Helper function to check if a cell is an alert node
function isAlertNode(cell) {
  return cell && cell.style && cell.style.includes("questionType=alertNode");
}
// Helper function to check if a cell is a hard alert node
function isHardAlertNode(cell) {
  return cell && cell.style && cell.style.includes("questionType=hardAlertNode");
}
function isStatusNode(cell) {
  return cell && cell.style && cell.style.includes("nodeType=status");
}
// Download utility moved to export.js module
// Export functions moved to export.js module
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
  // Automatically reset PDF inheritance and Node IDs before export
  // CORRECT ORDER: PDF inheritance first, then Node IDs (so Node IDs can use correct PDF names)
  // Reset PDF inheritance for all nodes FIRST
  if (typeof window.resetAllPdfInheritance === 'function') {
    window.resetAllPdfInheritance();
  }
  // Reset all Node IDs SECOND (after PDF inheritance is fixed)
  if (typeof resetAllNodeIds === 'function') {
    resetAllNodeIds();
  }
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
  // Collect sanitized PDF prefixes from all PDF nodes to help strip prefixes when setting is off
  const pdfPrefixes = new Set();
  vertices.forEach(cell => {
    if (typeof window.isPdfNode === 'function' && window.isPdfNode(cell)) {
      const pdfNameRaw = cell._pdfFile || cell._pdfUrl || cell._pdfName || '';
      if (pdfNameRaw && typeof window.sanitizePdfName === 'function') {
        const sanitized = window.sanitizePdfName(pdfNameRaw);
        if (sanitized) pdfPrefixes.add(sanitized);
      }
    }
  });
  // Helper: remove PDF prefix from nodeId when setting is off
  const stripPdfPrefixIfDisabled = (nodeId, cell) => {
    // Default to NOT adding PDF names unless explicitly enabled
    const shouldAddPdfName = (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId === true);
    if (shouldAddPdfName) return nodeId;
    if (!nodeId) return nodeId;
    const pdfName = typeof window.getPdfNameForNode === 'function' ? window.getPdfNameForNode(cell) : null;
    if (pdfName && typeof window.sanitizePdfName === 'function') {
      const sanitizedPdfName = window.sanitizePdfName(pdfName);
      if (sanitizedPdfName && nodeId.startsWith(sanitizedPdfName + '_')) {
        return nodeId.substring(sanitizedPdfName.length + 1);
      }
    }
    // Fallback: strip any known pdf prefixes collected from pdf nodes
    for (const prefix of pdfPrefixes) {
      if (nodeId.startsWith(prefix + '_')) {
        return nodeId.substring(prefix.length + 1);
      }
    }
    // Aggressive fallback: if first segment looks like a PDF code (e.g., sc100a2, sc500a)
    const firstSeg = nodeId.split('_')[0] || '';
    if (/^sc[a-z0-9]+$/i.test(firstSeg)) {
      return nodeId.substring(firstSeg.length + 1);
    }
    return nodeId;
  };
  // Create sections array structure and get top level data
  const sectionMap = {};
  // Get current section preferences using the proper function
  const currentSectionPrefs = window.getSectionPrefs ? window.getSectionPrefs() : (window.sectionPrefs || {});
  for (const num in currentSectionPrefs) {
    if (parseInt(num) >= sectionCounter) {
      sectionCounter = parseInt(num) + 1;
    }
    // Handle default section names
    let sectionName = currentSectionPrefs[num].name || `Section ${num}`;
    if (sectionName === "Enter section name" || sectionName === "Enter Name") {
      sectionName = `Section ${num}`;
    }
    sectionMap[num] = {
      sectionId: parseInt(num),
      sectionName: sectionName,
      questions: []
    };
  }
  // Find the maximum section number used by questions
  let maxSectionNumber = 1;
  for (const cell of questions) {
    const section = getSection(cell) || "1";
    const sectionNum = parseInt(section);
    if (sectionNum > maxSectionNumber) {
      maxSectionNumber = sectionNum;
    }
  }
  // Update sectionCounter to be the next available section number
  sectionCounter = Math.max(sectionCounter, maxSectionNumber + 1);
  // Ensure section 1 always exists
  if (!sectionMap["1"]) {
    // Get the section name from sectionPrefs, with fallback to default
    let sectionName = "Section 1";
    if (currentSectionPrefs["1"] && currentSectionPrefs["1"].name) {
      sectionName = currentSectionPrefs["1"].name;
      // Handle default section names
      if (sectionName === "Enter section name" || sectionName === "Enter Name") {
        sectionName = "Section 1";
      }
    }
    sectionMap["1"] = {
      sectionId: 1,
      sectionName: sectionName,
      questions: []
    };
  }
  // Add questions to sections by their section number
  for (const cell of questions) {
    let section = getSection(cell) || "1";
    // Special case: If this is the first question (lowest Y position), put it in Section 1
    const isFirstQuestion = questions.every(otherCell => 
      otherCell === cell || cell.geometry.y <= otherCell.geometry.y
    );
    if (isFirstQuestion && section !== "1") {
      section = "1";
    }
    if (!sectionMap[section]) {
      // Get the section name from sectionPrefs, with fallback to default
      let sectionName = `Section ${section}`;
      if (currentSectionPrefs[section] && currentSectionPrefs[section].name) {
        sectionName = currentSectionPrefs[section].name;
        // Handle default section names
        if (sectionName === "Enter section name" || sectionName === "Enter Name") {
          sectionName = `Section ${section}`;
        }
      }
      sectionMap[section] = {
        sectionId: parseInt(section),
        sectionName: sectionName,
        questions: []
      };
    }
    let questionType = getQuestionType(cell);
    let exportType = questionType;
    // --- PATCH: treat text2 as dropdown ---
    if (questionType === "text2") exportType = "dropdown";
    const question = {
      questionId: cell._questionId || questionCounter,
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
      hiddenLogic: {
        enabled: false,
        configs: []
      },
      pdfLogic: {
        enabled: false,
        conditions: [],
        pdfs: []
      },
      alertLogic: {
        enabled: false,
        message: "",
        conditions: []
      },
      checklistLogic: {
        enabled: false,
        conditions: []
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
      pdfPreview: {
        enabled: false,
        trigger: "",
        title: "",
        file: "",
        priceId: "",
        attachment: "Preview Only",
        filename: ""
      },
      latexPreview: {
        enabled: false,
        trigger: "",
        title: "",
        filename: "",
        content: "",
        priceId: "",
        attachment: "Preview Only"
      },
      status: {
        enabled: false,
        trigger: "",
        title: ""
      },
      hardAlert: {
        enabled: false,
        trigger: "",
        title: ""
      },
      options: [],
      labels: [],
      linking: {
        enabled: false,
        targetId: ""
      },
      image: {
        url: "",
        width: 0,
        height: 0
      }
    };
    // Add nameId and placeholder for non-multiple textboxes questions and non-fileUpload questions
    if (questionType !== "multipleTextboxes" && questionType !== "fileUpload") {
      question.nameId = sanitizeNameId((typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || cell._nameId || cell._questionText || cell.value || "unnamed");
      question.placeholder = cell._placeholder || "";
    }
    // Add uploadTitle and fileTitle for fileUpload questions
    if (questionType === "fileUpload") {
      question.uploadTitle = question.text;
      question.fileTitle = cell._fileName || "";
    }
      // Add line limit and character limit for big paragraph questions
      if (questionType === "bigParagraph") {
        if (cell._lineLimit !== undefined && cell._lineLimit !== '') {
          question.lineLimit = parseInt(cell._lineLimit) || 0;
        }
        if (cell._characterLimit !== undefined && cell._characterLimit !== '') {
          question.characterLimit = parseInt(cell._characterLimit) || 0;
        }
        if (cell._paragraphLimit !== undefined && cell._paragraphLimit !== '') {
          question.paragraphLimit = parseInt(cell._paragraphLimit) || 0;
        }
        // Add Big Paragraph PDF Logic if enabled
        if (cell._pdfLogicEnabled) {
          question.pdfLogic.enabled = true;
          question.pdfLogic.conditions = [{
            characterLimit: parseInt(cell._pdfTriggerLimit) || 0
          }];
          question.pdfLogic.pdfs = [{
            pdfName: cell._bigParagraphPdfFile || "",
            pdfDisplayName: cell._bigParagraphPdfName || "",
            stripePriceId: cell._bigParagraphPdfPrice || "",
            triggerOption: ""
          }];
        }
    }
    // For text2, clean the text from HTML
    if (questionType === "text2" && question.text) {
      const temp = document.createElement("div");
      temp.innerHTML = question.text;
      question.text = temp.textContent || temp.innerText || question.text;
    }
    // Clean HTML entities and tags from all question text
    if (question.text) {
      // First decode HTML entities
      const textarea = document.createElement('textarea');
      textarea.innerHTML = question.text;
      let cleanedText = textarea.value;
      // Then remove HTML tags
      const temp = document.createElement("div");
      temp.innerHTML = cleanedText;
      cleanedText = temp.textContent || temp.innerText || cleanedText;
      // Clean up extra whitespace
      cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
      question.text = cleanedText;
    }
    // For multiple textboxes, add the textboxes array and nodeId with location data support
    if (questionType === "multipleTextboxes" && cell._textboxes) {
      // Get PDF name if available
      const pdfName = typeof window.getPdfNameForNode === 'function' ? window.getPdfNameForNode(cell) : null;
      // Check if PDF name should be added to node ID based on user setting
      const shouldAddPdfName = (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId !== false) ? true : false;
      // Process PDF name to remove .pdf extension and clean up formatting
      const sanitizedPdfName = (pdfName && shouldAddPdfName) ? pdfName.replace(/\.pdf$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
      // Build base name components
      const baseQuestionName = sanitizeNameId(cell._questionText || cell.value || "unnamed");
      // Get the actual nodeId from the cell (which may include _dup2, _dup3, etc.)
      const actualNodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || baseQuestionName;
      // Create nodeId with PDF prefix if available (but preserve the actual nodeId including _dup suffix)
      let nodeId = actualNodeId;
      if (sanitizedPdfName && !actualNodeId.startsWith(sanitizedPdfName + '_')) {
        // Only add PDF prefix if it's not already there
        nodeId = `${sanitizedPdfName}_${actualNodeId}`;
      } else {
        nodeId = actualNodeId;
      }
      // Create allFieldsInOrder array using _itemOrder if available, otherwise use default logic
      const allFieldsInOrder = [];
      // If _itemOrder exists, use it to determine the correct order
      if (cell._itemOrder && cell._itemOrder.length > 0) {
        cell._itemOrder.forEach((item, orderIndex) => {
          // Handle both 'option' (for numbered dropdowns) and 'textbox' (for multiple textboxes) types
          if ((item.type === 'option' || item.type === 'textbox') && cell._textboxes && cell._textboxes[item.index]) {
            const tb = cell._textboxes[item.index];
            const labelName = tb.nameId || "";
            // Use the actual nodeId (which may include _dup2) as the base for fieldNodeId
            const fieldNodeId = sanitizedPdfName ? `${nodeId}_${sanitizeNameId(labelName)}` : `${nodeId}_${sanitizeNameId(labelName)}`;
            const fieldType = tb.type === 'phone'
              ? 'phone'
              : (tb.type === 'currency'
                ? 'currency'
                : (tb.isAmountOption ? "amount" : "label"));
            console.log('[LIBRARY exportGuiJson] Field type determined', { 
              cellId: cell.id, 
              index: item.index, 
              tbType: tb.type, 
              isAmountOption: tb.isAmountOption, 
              fieldType 
            });
            const fieldEntry = {
              type: fieldType,
              label: labelName,
              nodeId: fieldNodeId,
              order: orderIndex + 1
            };
            // Only add prefill for non-amount and non-currency fields
            if (fieldType !== "amount" && fieldType !== "currency") {
              fieldEntry.prefill = tb.prefill || '';
            }
            allFieldsInOrder.push(fieldEntry);
          } else if (item.type === 'location') {
            // Create a single location entry instead of expanding into individual fields
              allFieldsInOrder.push({
              type: "location",
              fieldName: cell._locationTitle || "",
              nodeId: "location_data",
              order: orderIndex + 1
            });
          } else if (item.type === 'time' && cell._times && cell._times[item.index]) {
            const time = cell._times[item.index];
            allFieldsInOrder.push({
              type: "date", // Use "date" type as expected in GUI JSON
              label: time.timeText || "",
              nodeId: time.timeId || "",
              order: orderIndex + 1
            });
          } else if (item.type === 'checkbox' && cell._checkboxes && cell._checkboxes[item.index]) {
            const checkbox = cell._checkboxes[item.index];
            const checkboxOptions = checkbox.options ? checkbox.options.map(option => {
              const optionObj = {
              text: option.checkboxText || option.text || "",
              nodeId: option.nodeId || ""
              };
              // Add linked fields if they exist
              if (option.linkedFields && Array.isArray(option.linkedFields) && option.linkedFields.length > 0) {
                optionObj.linkedFields = option.linkedFields.map(linkedField => {
                  // Strip entry number suffix from selectedNodeId to match label nodeId format
                  // Format: baseNodeId_${entryNumber} -> baseNodeId
                  let baseNodeId = linkedField.selectedNodeId || "";
                  if (baseNodeId) {
                    // Remove trailing _${number} pattern (e.g., "_1", "_2", "_3")
                    baseNodeId = baseNodeId.replace(/_\d+$/, '');
                  }
                  // Check if PDF name should be added to node ID based on user setting
                  const shouldAddPdfName = (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId !== false) ? true : false;
                  // If setting is OFF, remove PDF prefix from baseNodeId if present
                  if (!shouldAddPdfName && baseNodeId) {
                    // Get PDF name for the cell to check if it matches the prefix
                    const pdfName = typeof window.getPdfNameForNode === 'function' ? window.getPdfNameForNode(cell) : null;
                    if (pdfName && typeof window.sanitizePdfName === 'function') {
                      const sanitizedPdfName = window.sanitizePdfName(pdfName);
                      // Remove PDF prefix if present (only if it matches the actual PDF name)
                      if (sanitizedPdfName && baseNodeId.startsWith(sanitizedPdfName + '_')) {
                        baseNodeId = baseNodeId.substring(sanitizedPdfName.length + 1);
                      }
                    }
                  }
                  return {
                    nodeId: baseNodeId,
                    title: linkedField.title || ""
                  };
                });
              }
              // Add PDF entries if they exist
              if (option.pdfEntries && Array.isArray(option.pdfEntries) && option.pdfEntries.length > 0) {
                optionObj.pdfEntries = option.pdfEntries.map(pdfEntry => ({
                  triggerNumber: pdfEntry.triggerNumber || "",
                  pdfName: pdfEntry.pdfName || "",
                  pdfFile: pdfEntry.pdfFile || "",
                  priceId: pdfEntry.priceId || ""
                }));
              }
              return optionObj;
            }) : [];
            allFieldsInOrder.push({
              type: "checkbox",
              fieldName: checkbox.fieldName || "",
              selectionType: checkbox.selectionType || "multiple",
              required: (checkbox.required === false || checkbox.required === 'optional') ? "optional" : (checkbox.required || "required"),
              options: checkboxOptions,
              order: orderIndex + 1
            });
          } else if (item.type === 'dropdown' && cell._dropdowns && cell._dropdowns[item.index]) {
            const dropdown = cell._dropdowns[item.index];
            const dropdownOptions = dropdown.options ? dropdown.options.map(option => {
              // Sanitize the dropdown name and option value for nodeId
              // Preserve forward slashes "/" in the name
              const sanitizedDropdownName = (dropdown.name || "").toLowerCase().replace(/[^a-z0-9\s\/]/g, '').replace(/\s+/g, '_');
              const sanitizedOptionValue = (option.value || option.text || "").toLowerCase().replace(/[^a-z0-9\s\/]/g, '').replace(/\s+/g, '_');
              return {
                text: option.text || "",
                nodeId: `${sanitizedDropdownName}_${sanitizedOptionValue}`
              };
            }) : [];
            // Process trigger sequences
            const triggerSequences = [];
            if (dropdown.triggerSequences && dropdown.triggerSequences.length > 0) {
              dropdown.triggerSequences.forEach(trigger => {
                const fields = [];
                // Create maps for quick lookup by identifier
                const labelMap = new Map();
                if (trigger.labels && trigger.labels.length > 0) {
                  trigger.labels.forEach(label => {
                    labelMap.set(label.fieldName || '', label);
                  });
                }
                const checkboxMap = new Map();
                if (trigger.checkboxes && trigger.checkboxes.length > 0) {
                  trigger.checkboxes.forEach(checkbox => {
                    checkboxMap.set(checkbox.fieldName || '', checkbox);
                  });
                }
                const timeMap = new Map();
                if (trigger.times && trigger.times.length > 0) {
                  trigger.times.forEach(time => {
                    timeMap.set(time.fieldName || '', time);
                  });
                }
                const locationMap = new Map();
                if (trigger.locations && trigger.locations.length > 0) {
                  trigger.locations.forEach(location => {
                    const identifier = location.locationTitle || location.fieldName || 'location';
                    locationMap.set(identifier, location);
                  });
                }
                const pdfMap = new Map();
                if (trigger.pdfs && trigger.pdfs.length > 0) {
                  trigger.pdfs.forEach(pdf => {
                    const identifier = pdf.triggerNumber || pdf.pdfTitle || pdf.pdfFilename || 'pdf';
                    pdfMap.set(identifier, pdf);
                  });
                }
                const dropdownMap = new Map();
                if (trigger.dropdowns && trigger.dropdowns.length > 0) {
                  trigger.dropdowns.forEach(nestedDropdown => {
                    dropdownMap.set(nestedDropdown.fieldName || '', nestedDropdown);
                  });
                }
                // Use unified order if available, otherwise use type-based order
                if (trigger._actionOrder && trigger._actionOrder.length > 0) {
                  // Add fields in the unified order
                  trigger._actionOrder.forEach(orderItem => {
                    if (orderItem.type === 'label') {
                      const label = labelMap.get(orderItem.identifier);
                      if (label) {
                        // Regenerate nodeId if dropdown name contains forward slash but nodeId doesn't
                      let nodeId = stripPdfPrefixIfDisabled(label.nodeId || "", cell);
                        if (dropdown.name && dropdown.name.includes('/') && !nodeId.includes('/')) {
                          // Regenerate using generateNodeIdForDropdownField if available
                          if (typeof window.generateNodeIdForDropdownField === 'function') {
                            nodeId = window.generateNodeIdForDropdownField(label.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
                          }
                        }
                        const labelField = {
                          type: "label",
                          label: label.fieldName || "",
                          nodeId: nodeId
                        };
                        if (label.isAmountOption) {
                          labelField.isAmountOption = true;
                        }
                        fields.push(labelField);
                      }
                    } else if (orderItem.type === 'checkbox') {
                      const checkbox = checkboxMap.get(orderItem.identifier);
                      if (checkbox) {
                        const checkboxOptions = checkbox.options ? checkbox.options.map(option => {
                          const optionObj = {
                            text: option.checkboxText || "",
                          nodeId: stripPdfPrefixIfDisabled(option.nodeId || "", cell)
                          };
                          // Add linked fields if they exist
                          if (option.linkedFields && Array.isArray(option.linkedFields) && option.linkedFields.length > 0) {
                            optionObj.linkedFields = option.linkedFields.map(linkedField => ({
                              nodeId: linkedField.selectedNodeId || "",
                              title: linkedField.title || ""
                            }));
                          }
                          return optionObj;
                        }) : [];
                        fields.push({
                          type: "checkbox",
                          fieldName: checkbox.fieldName || "",
                          selectionType: checkbox.selectionType || "multiple",
                          required: (checkbox.required === false || checkbox.required === 'optional') ? "optional" : (checkbox.required || "required"),
                          options: checkboxOptions
                        });
                      }
                    } else if (orderItem.type === 'time') {
                      const time = timeMap.get(orderItem.identifier);
                      if (time) {
                        // Regenerate nodeId if dropdown name contains forward slash but nodeId doesn't
                      let nodeId = stripPdfPrefixIfDisabled(time.nodeId || "", cell);
                        if (dropdown.name && dropdown.name.includes('/') && !nodeId.includes('/')) {
                          // Regenerate using generateNodeIdForDropdownField if available
                          if (typeof window.generateNodeIdForDropdownField === 'function') {
                            nodeId = window.generateNodeIdForDropdownField(time.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
                          }
                        }
                        const dateField = {
                          type: "date",
                          label: time.fieldName || "",
                          nodeId: nodeId
                        };
                        // Include conditional logic if it exists and has conditions
                        if (time.conditionalLogic && time.conditionalLogic.enabled) {
                          // Process conditions to remove parent question prefix
                          let conditions = time.conditionalLogic.conditions || [];
                          
                          // Get time field label (sanitized) to identify the field-specific part
                          const sanitizeFn = typeof window.sanitizeNameId === 'function' ? window.sanitizeNameId : 
                            (name) => (name || '').toLowerCase().replace(/[?]/g, '').replace(/[^a-z0-9\s\/]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
                          const timeFieldName = sanitizeFn(time.fieldName || '');
                          
                          if (dropdown.name && dropdown.name.includes('/')) {
                            conditions = conditions.map(condition => {
                              if (!condition || !condition.trim()) return condition;
                              
                              // If condition doesn't have forward slash but should, regenerate it
                              if (!condition.includes('/')) {
                                // Try to regenerate using getCheckboxOptionNodeIdsFromTriggerSequence
                                if (typeof window.getCheckboxOptionNodeIdsFromTriggerSequence === 'function') {
                                  const availableNodeIds = window.getCheckboxOptionNodeIdsFromTriggerSequence(trigger, dropdown, cell);
                                  // Find matching nodeId that has the forward slash
                                  const matchingNodeId = availableNodeIds.find(nodeId => {
                                    // Normalize both strings by removing slashes and underscores for comparison
                                    const normalize = (str) => str.replace(/[\/_]/g, '').toLowerCase();
                                    return normalize(condition) === normalize(nodeId);
                                  });
                                  if (matchingNodeId) {
                                    condition = matchingNodeId;
                                  }
                                }
                              }
                              
                              // Extract field-specific part from condition
                              // Conditions may include full path: parentQuestion_parentDropdown_option_fieldName_option
                              // We want only: fieldName_option (or just the dropdown/option reference)
                              // For date fields, conditions typically reference dropdown options
                              // Find where the referenced dropdown name starts in the condition
                              if (condition && !condition.includes('/')) {
                                // Try to find a dropdown name pattern in the condition
                                // Look for common patterns like "have_you_filed" or "are_they_a_public_entity"
                                // We'll extract just the dropdown name and option part
                                // This is a heuristic approach - extract the last meaningful part
                                const parts = condition.split('_');
                                // If condition has many parts, it likely includes parent prefix
                                // For now, return condition as-is and let the UI handle it
                                // The main fix is for nested dropdowns which have a clearer pattern
                              }
                              
                              return condition;
                            });
                          } else {
                            // For conditions without slashes, extract field-specific part
                            // Conditions reference dropdown options in the same trigger sequence
                            // Pattern: parentQuestion_parentDropdown_option_referencedDropdown_option
                            // We want: referencedDropdown_option
                            
                            const sanitizeFn = typeof window.sanitizeNameId === 'function' ? window.sanitizeNameId : 
                              (name) => (name || '').toLowerCase().replace(/[?]/g, '').replace(/[^a-z0-9\s\/]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
                            const parentDropdownName = sanitizeFn(dropdown.name || '');
                            
                            // Build a map of dropdown field names in this trigger sequence
                            const triggerDropdownNames = new Set();
                            dropdownMap.forEach((nestedDropdown, fieldName) => {
                              if (fieldName) {
                                triggerDropdownNames.add(sanitizeFn(fieldName));
                              }
                            });
                            
                            conditions = conditions.map(condition => {
                              if (!condition || !condition.trim()) return condition;
                              
                              // Check if condition includes parent dropdown name pattern
                              if (parentDropdownName && condition.includes(parentDropdownName)) {
                                // Remove parent dropdown prefix pattern
                                const parentDropdownPattern = parentDropdownName + '_';
                                
                                // Find where parent dropdown appears in condition
                                let cleaned = condition;
                                if (condition.startsWith(parentDropdownPattern)) {
                                  // Remove parent dropdown prefix
                                  cleaned = condition.substring(parentDropdownPattern.length);
                                  // Remove option (typically one word after parent dropdown name)
                                  const parts = cleaned.split('_');
                                  if (parts.length > 1) {
                                    cleaned = parts.slice(1).join('_');
                                  }
                                } else if (condition.includes('_' + parentDropdownPattern)) {
                                  // Parent dropdown pattern is in middle (after parent question prefix)
                                  const parentIndex = condition.indexOf('_' + parentDropdownPattern);
                                  cleaned = condition.substring(parentIndex + 1 + parentDropdownPattern.length);
                                  // Remove option (typically one word after parent dropdown name)
                                  const parts = cleaned.split('_');
                                  if (parts.length > 1) {
                                    cleaned = parts.slice(1).join('_');
                                  }
                                }
                                
                                // Try to match cleaned condition to a dropdown in the trigger sequence
                                // Look for dropdown field names that appear in the cleaned condition
                                for (const dropdownName of triggerDropdownNames) {
                                  if (cleaned.includes(dropdownName)) {
                                    // Found a match - extract from this dropdown name onwards
                                    const dropdownIndex = cleaned.indexOf(dropdownName);
                                    if (dropdownIndex >= 0) {
                                      return cleaned.substring(dropdownIndex);
                                    }
                                  }
                                }
                                
                                // If no match found, return cleaned version anyway
                                if (cleaned && cleaned !== condition && cleaned.length > 0) {
                                  return cleaned;
                                }
                              }
                              
                              return condition;
                            });
                          }
                          
                          const filteredConditions = conditions.filter(c => c && c.trim() !== '');
                          // Only include conditionalLogic if there are actual conditions
                          if (filteredConditions.length > 0) {
                          dateField.conditionalLogic = {
                            enabled: time.conditionalLogic.enabled,
                              conditions: filteredConditions
                            };
                          }
                        }
                        // Include alert if it exists and is enabled
                        if (time.alert && time.alert.enabled) {
                          dateField.alert = {
                            enabled: true,
                            condition: time.alert.trigger || '',
                            title: time.alert.title || ''
                          };
                        }
                        // Include hardAlert if it exists and is enabled
                        if (time.hardAlert && time.hardAlert.enabled) {
                          dateField.hardAlert = {
                            enabled: true,
                            condition: time.hardAlert.trigger || '',
                            title: time.hardAlert.title || ''
                          };
                        }
                        fields.push(dateField);
                      }
                    } else if (orderItem.type === 'dropdown') {
                      const nestedDropdown = dropdownMap.get(orderItem.identifier);
                      if (nestedDropdown) {
                        const nestedDropdownOptions = nestedDropdown.options ? nestedDropdown.options.map(option => ({
                          text: option.text || ""
                        })) : [];
                        const dropdownField = {
                          type: "dropdown",
                          fieldName: nestedDropdown.fieldName || "",
                          options: nestedDropdownOptions
                        };
                        // Include conditional logic if it exists
                        if (nestedDropdown.conditionalLogic && nestedDropdown.conditionalLogic.enabled) {
                          // Process conditions to remove parent question prefix
                          let conditions = nestedDropdown.conditionalLogic.conditions || [];
                          
                          // Get nested dropdown field name (sanitized) to identify the nested dropdown part
                          const sanitizeFn = typeof window.sanitizeNameId === 'function' ? window.sanitizeNameId : 
                            (name) => (name || '').toLowerCase().replace(/[?]/g, '').replace(/[^a-z0-9\s\/]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
                          const nestedDropdownName = sanitizeFn(nestedDropdown.fieldName || '');
                          
                            conditions = conditions.map(condition => {
                            if (!condition || !condition.trim()) return condition;
                            
                            // First, handle forward slash case (if dropdown name has slash)
                            if (dropdown.name && dropdown.name.includes('/')) {
                              if (!condition.includes('/')) {
                                // Try to regenerate using getCheckboxOptionNodeIdsFromTriggerSequence
                                if (typeof window.getCheckboxOptionNodeIdsFromTriggerSequence === 'function') {
                                  const availableNodeIds = window.getCheckboxOptionNodeIdsFromTriggerSequence(trigger, dropdown, cell);
                                  // Find matching nodeId that has the forward slash
                                  const matchingNodeId = availableNodeIds.find(nodeId => {
                                    // Normalize both strings by removing slashes and underscores for comparison
                                    const normalize = (str) => str.replace(/[\/_]/g, '').toLowerCase();
                                    return normalize(condition) === normalize(nodeId);
                                  });
                                  if (matchingNodeId) {
                                    condition = matchingNodeId;
                                  }
                                }
                              }
                            }
                            
                            // Extract nested dropdown-specific part from condition
                            // Conditions may include full path: parentQuestion_parentDropdown_option_nestedDropdown_option
                            // We want only: nestedDropdown_option
                            if (nestedDropdownName && condition.includes(nestedDropdownName)) {
                              // Find where nested dropdown name starts
                              const nestedIndex = condition.indexOf(nestedDropdownName);
                              if (nestedIndex > 0) {
                                // Extract from nested dropdown name onwards
                                return condition.substring(nestedIndex);
                                  }
                                }
                            
                              return condition;
                            });
                          
                          dropdownField.conditionalLogic = {
                            enabled: nestedDropdown.conditionalLogic.enabled,
                            conditions: conditions.filter(c => c && c.trim() !== '')
                          };
                        }
                        // Include alert if it exists and is enabled
                        if (nestedDropdown.alert && nestedDropdown.alert.enabled) {
                          dropdownField.alert = {
                            enabled: true,
                            condition: nestedDropdown.alert.trigger || '',
                            title: nestedDropdown.alert.title || ''
                          };
                        }
                        // Include hardAlert if it exists and is enabled
                        if (nestedDropdown.hardAlert && nestedDropdown.hardAlert.enabled) {
                          dropdownField.hardAlert = {
                            enabled: true,
                            condition: nestedDropdown.hardAlert.trigger || '',
                            title: nestedDropdown.hardAlert.title || ''
                          };
                        }
                        fields.push(dropdownField);
                      }
                    } else if (orderItem.type === 'location') {
                      const location = locationMap.get(orderItem.identifier);
                      if (location) {
                        fields.push({
                          type: "location",
                          fieldName: location.locationTitle || "",
                          nodeId: "location_data"
                        });
                      }
                    } else if (orderItem.type === 'pdf') {
                      const pdf = pdfMap.get(orderItem.identifier);
                      if (pdf) {
                        fields.push({
                          type: "pdf",
                          number: pdf.triggerNumber || "",
                          pdfTitle: pdf.pdfTitle || "",
                          pdfName: pdf.pdfFilename || "",
                          priceId: pdf.pdfPriceId || ""
                        });
                      }
                    }
                  });
                  // Add any fields not in the unified order (safety check)
                  if (trigger.labels && trigger.labels.length > 0) {
                    trigger.labels.forEach(label => {
                      if (!labelMap.has(label.fieldName || '')) {
                        const existingField = fields.find(f => f.type === 'label' && f.label === label.fieldName);
                        if (!existingField) {
                          // Regenerate nodeId if dropdown name contains forward slash but nodeId doesn't
                        let nodeId = stripPdfPrefixIfDisabled(label.nodeId || "", cell);
                          if (dropdown.name && dropdown.name.includes('/') && !nodeId.includes('/')) {
                            if (typeof window.generateNodeIdForDropdownField === 'function') {
                              nodeId = window.generateNodeIdForDropdownField(label.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
                            }
                          }
                          const labelField = {
                            type: "label",
                            label: label.fieldName || "",
                            nodeId: nodeId
                          };
                          if (label.isAmountOption) {
                            labelField.isAmountOption = true;
                          }
                          fields.push(labelField);
                        }
                      }
                    });
                  }
                  if (trigger.checkboxes && trigger.checkboxes.length > 0) {
                    trigger.checkboxes.forEach(checkbox => {
                      if (!checkboxMap.has(checkbox.fieldName || '')) {
                        const existingField = fields.find(f => f.type === 'checkbox' && f.fieldName === checkbox.fieldName);
                        if (!existingField) {
                          const checkboxOptions = checkbox.options ? checkbox.options.map(option => ({
                            text: option.checkboxText || "",
                            nodeId: option.nodeId || ""
                          })) : [];
                          fields.push({
                            type: "checkbox",
                            fieldName: checkbox.fieldName || "",
                            selectionType: checkbox.selectionType || "multiple",
                            required: (checkbox.required === false || checkbox.required === 'optional') ? "optional" : (checkbox.required || "required"),
                            options: checkboxOptions
                          });
                        }
                      }
                    });
                  }
                  if (trigger.times && trigger.times.length > 0) {
                    trigger.times.forEach(time => {
                      if (!timeMap.has(time.fieldName || '')) {
                        const existingField = fields.find(f => f.type === 'date' && f.label === time.fieldName);
                        if (!existingField) {
                          // Regenerate nodeId if dropdown name contains forward slash but nodeId doesn't
                          let nodeId = time.nodeId || "";
                          if (dropdown.name && dropdown.name.includes('/') && !nodeId.includes('/')) {
                            if (typeof window.generateNodeIdForDropdownField === 'function') {
                              nodeId = window.generateNodeIdForDropdownField(time.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
                            }
                          }
                          const dateField = {
                            type: "date",
                            label: time.fieldName || "",
                            nodeId: nodeId
                          };
                          // Include conditional logic if it exists
                          if (time.conditionalLogic && time.conditionalLogic.enabled) {
                            dateField.conditionalLogic = {
                              enabled: time.conditionalLogic.enabled,
                              conditions: time.conditionalLogic.conditions || []
                            };
                          }
                          // Include alert if it exists and is enabled
                          if (time.alert && time.alert.enabled) {
                            dateField.alert = {
                              enabled: true,
                              condition: time.alert.trigger || '',
                              title: time.alert.title || ''
                            };
                          }
                          // Include hardAlert if it exists and is enabled
                          if (time.hardAlert && time.hardAlert.enabled) {
                            dateField.hardAlert = {
                              enabled: true,
                              condition: time.hardAlert.trigger || '',
                              title: time.hardAlert.title || ''
                            };
                          }
                          fields.push(dateField);
                        }
                      }
                    });
                  }
                  if (trigger.locations && trigger.locations.length > 0) {
                    trigger.locations.forEach(location => {
                      const identifier = location.locationTitle || location.fieldName || 'location';
                      if (!locationMap.has(identifier)) {
                        const existingField = fields.find(f => f.type === 'location' && f.fieldName === location.locationTitle);
                        if (!existingField) {
                          fields.push({
                            type: "location",
                            fieldName: location.locationTitle || "",
                            nodeId: "location_data"
                          });
                        }
                      }
                    });
                  }
                  if (trigger.dropdowns && trigger.dropdowns.length > 0) {
                    trigger.dropdowns.forEach(nestedDropdown => {
                      // Check if this dropdown was already added to fields
                      const existingField = fields.find(f => f.type === 'dropdown' && f.fieldName === nestedDropdown.fieldName);
                      if (!existingField) {
                        const nestedDropdownOptions = nestedDropdown.options ? nestedDropdown.options.map(option => ({
                          text: option.text || ""
                        })) : [];
                        const dropdownField = {
                          type: "dropdown",
                          fieldName: nestedDropdown.fieldName || "",
                          options: nestedDropdownOptions
                        };
                        // Include alert if it exists and is enabled
                        if (nestedDropdown.alert && nestedDropdown.alert.enabled) {
                          dropdownField.alert = {
                            enabled: true,
                            condition: nestedDropdown.alert.trigger || '',
                            title: nestedDropdown.alert.title || ''
                          };
                        }
                        // Include hardAlert if it exists and is enabled
                        if (nestedDropdown.hardAlert && nestedDropdown.hardAlert.enabled) {
                          dropdownField.hardAlert = {
                            enabled: true,
                            condition: nestedDropdown.hardAlert.trigger || '',
                            title: nestedDropdown.hardAlert.title || ''
                          };
                        }
                        fields.push(dropdownField);
                      }
                    });
                  }
                  if (trigger.pdfs && trigger.pdfs.length > 0) {
                    trigger.pdfs.forEach(pdf => {
                      // Check if this PDF was already added (by _actionOrder processing)
                      const existingField = fields.find(f => f.type === 'pdf' && f.number === pdf.triggerNumber);
                      if (!existingField) {
                        fields.push({
                          type: "pdf",
                          number: pdf.triggerNumber || "",
                          pdfTitle: pdf.pdfTitle || "",
                          pdfName: pdf.pdfFilename || "",
                          priceId: pdf.pdfPriceId || ""
                        });
                      }
                    });
                  }
                } else {
                  // Fallback: Add fields in type-based order (for backward compatibility)
                  // Add labels
                  if (trigger.labels && trigger.labels.length > 0) {
                    trigger.labels.forEach(label => {
                      const labelField = {
                        type: "label",
                        label: label.fieldName || "",
                        nodeId: label.nodeId || ""
                      };
                      if (label.isAmountOption) {
                        labelField.isAmountOption = true;
                      }
                      fields.push(labelField);
                    });
                  }
                  // Add checkboxes
                  if (trigger.checkboxes && trigger.checkboxes.length > 0) {
                    trigger.checkboxes.forEach(checkbox => {
                      const checkboxOptions = checkbox.options ? checkbox.options.map(option => {
                        const optionObj = {
                          text: option.checkboxText || "",
                          nodeId: option.nodeId || ""
                        };
                        // Add linked fields if they exist
                        if (option.linkedFields && Array.isArray(option.linkedFields) && option.linkedFields.length > 0) {
                          optionObj.linkedFields = option.linkedFields.map(linkedField => ({
                            nodeId: linkedField.selectedNodeId || "",
                            title: linkedField.title || ""
                          }));
                        }
                        return optionObj;
                      }) : [];
                      fields.push({
                        type: "checkbox",
                        fieldName: checkbox.fieldName || "",
                      selectionType: checkbox.selectionType || "multiple",
                      required: (checkbox.required === false || checkbox.required === 'optional') ? "optional" : (checkbox.required || "required"),
                        options: checkboxOptions
                      });
                    });
                  }
                  // Add times
                  if (trigger.times && trigger.times.length > 0) {
                    trigger.times.forEach(time => {
                      const dateField = {
                        type: "date",
                        label: time.fieldName || "",
                        nodeId: time.nodeId || ""
                      };
                      // Include conditional logic if it exists
                      if (time.conditionalLogic && time.conditionalLogic.enabled) {
                        dateField.conditionalLogic = {
                          enabled: time.conditionalLogic.enabled,
                          conditions: time.conditionalLogic.conditions || []
                        };
                      }
                      // Include alert if it exists and is enabled
                      if (time.alert && time.alert.enabled) {
                        dateField.alert = {
                          enabled: true,
                          condition: time.alert.trigger || '',
                          title: time.alert.title || ''
                        };
                      }
                      // Include hardAlert if it exists and is enabled
                      if (time.hardAlert && time.hardAlert.enabled) {
                        dateField.hardAlert = {
                          enabled: true,
                          condition: time.hardAlert.trigger || '',
                          title: time.hardAlert.title || ''
                        };
                      }
                      fields.push(dateField);
                    });
                  }
                  // Add locations
                  if (trigger.locations && trigger.locations.length > 0) {
                    trigger.locations.forEach(location => {
                      fields.push({
                        type: "location",
                        fieldName: location.locationTitle || "",
                        nodeId: "location_data"
                      });
                    });
                  }
                  // Add dropdowns
                  if (trigger.dropdowns && trigger.dropdowns.length > 0) {
                    trigger.dropdowns.forEach(nestedDropdown => {
                      const nestedDropdownOptions = nestedDropdown.options ? nestedDropdown.options.map(option => ({
                        text: option.text || ""
                      })) : [];
                      const dropdownField = {
                        type: "dropdown",
                        fieldName: nestedDropdown.fieldName || "",
                        options: nestedDropdownOptions
                      };
                      // Include alert if it exists and is enabled
                      if (nestedDropdown.alert && nestedDropdown.alert.enabled) {
                        dropdownField.alert = {
                          enabled: true,
                          condition: nestedDropdown.alert.trigger || '',
                          title: nestedDropdown.alert.title || ''
                        };
                      }
                      // Include hardAlert if it exists and is enabled
                      if (nestedDropdown.hardAlert && nestedDropdown.hardAlert.enabled) {
                        dropdownField.hardAlert = {
                          enabled: true,
                          condition: nestedDropdown.hardAlert.trigger || '',
                          title: nestedDropdown.hardAlert.title || ''
                        };
                      }
                      fields.push(dropdownField);
                    });
                  }
                  // Add PDFs
                  if (trigger.pdfs && trigger.pdfs.length > 0) {
                    trigger.pdfs.forEach(pdf => {
                      fields.push({
                        type: "pdf",
                        number: pdf.triggerNumber || "",
                        pdfTitle: pdf.pdfTitle || "",
                        pdfName: pdf.pdfFilename || "",
                        priceId: pdf.pdfPriceId || ""
                      });
                    });
                  }
                }
                // Find the matching option text for the condition
                const matchingOption = dropdown.options.find(option => option.value === trigger.triggerOption);
                const conditionText = matchingOption ? matchingOption.text : trigger.triggerOption || "";
                triggerSequences.push({
                  condition: conditionText,
                  title: "Additional Information",
                  fields: fields
                });
              });
            }
            // Calculate the correct order for dropdown
            // All items (including location) are now single entries, so use orderIndex + 1
            let dropdownOrder = orderIndex + 1;
            allFieldsInOrder.push({
              type: "dropdown",
              fieldName: dropdown.name || "",
              options: dropdownOptions,
              triggerSequences: triggerSequences,
              order: dropdownOrder
            });
          }
        });
      } else {
        // Fallback to old logic if _itemOrder doesn't exist
        const locationIndex = cell._locationIndex !== undefined ? cell._locationIndex : -1;
        // Process each textbox in order
        if (cell._textboxes && cell._textboxes.length > 0) {
          cell._textboxes.forEach((tb, index) => {
            const labelName = tb.nameId || "";
            // Check if PDF name should be added to node ID based on user setting
            const shouldAddPdfName = (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId !== false) ? true : false;
            const effectiveSanitizedPdfName = shouldAddPdfName ? sanitizedPdfName : '';
            const effectiveNodeId = effectiveSanitizedPdfName ? `${effectiveSanitizedPdfName}_${baseQuestionName}` : baseQuestionName;
            const fieldNodeId = effectiveSanitizedPdfName ? `${effectiveNodeId}_${sanitizeNameId(labelName)}` : `${baseQuestionName}_${sanitizeNameId(labelName)}`;
            // Check if this textbox is marked as an amount option, phone, or currency
            const fieldType = tb.type === 'phone'
              ? 'phone'
              : (tb.type === 'currency'
                ? 'currency'
                : (tb.isAmountOption ? "amount" : "label"));
            console.log('[LIBRARY exportGuiJson] Field type determined (fallback)', { 
              cellId: cell.id, 
              index, 
              tbType: tb.type, 
              isAmountOption: tb.isAmountOption, 
              fieldType 
            });
            const fieldEntry = {
              type: fieldType,
              label: labelName,
              nodeId: fieldNodeId,
              order: index + 1
            };
            // Only add prefill for non-amount and non-currency fields
            if (fieldType !== "amount" && fieldType !== "currency") {
              fieldEntry.prefill = tb.prefill || '';
            }
            allFieldsInOrder.push(fieldEntry);
          });
        }
        // Insert location entry at the correct position if locationIndex is set
        const shouldIncludeLocationFields = locationIndex >= 0;
        if (shouldIncludeLocationFields) {
          // Export as a single location entry with fieldName (location title) and nodeId: "location_data"
          // Similar to how numbered dropdown questions export location data
          const locationEntry = {
            type: "location",
            fieldName: cell._locationTitle || "",
            nodeId: "location_data",
            order: locationIndex + 1
          };
          if (allFieldsInOrder.length === 0) {
            allFieldsInOrder.push(locationEntry);
          } else {
            allFieldsInOrder.splice(locationIndex, 0, locationEntry);
            // Re-number all fields after insertion
            allFieldsInOrder.forEach((field, index) => {
              field.order = index + 1;
            });
          }
        }
        // Add checkbox fields if they exist
        if (cell._checkboxes && cell._checkboxes.length > 0) {
          cell._checkboxes.forEach((checkbox, checkboxIndex) => {
            const checkboxOptions = checkbox.options ? checkbox.options.map(option => {
              const optionObj = {
              text: option.checkboxText || option.text || "",
              nodeId: option.nodeId || ""
              };
              // Add linked fields if they exist
              if (option.linkedFields && Array.isArray(option.linkedFields) && option.linkedFields.length > 0) {
                optionObj.linkedFields = option.linkedFields.map(linkedField => {
                  // Strip entry number suffix from selectedNodeId to match label nodeId format
                  // Format: baseNodeId_${entryNumber} -> baseNodeId
                  let baseNodeId = linkedField.selectedNodeId || "";
                  if (baseNodeId) {
                    // Remove trailing _${number} pattern (e.g., "_1", "_2", "_3")
                    baseNodeId = baseNodeId.replace(/_\d+$/, '');
                  }
                  // Check if PDF name should be added to node ID based on user setting
                  const shouldAddPdfName = (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId !== false) ? true : false;
                  // If setting is OFF, remove PDF prefix from baseNodeId if present
                  if (!shouldAddPdfName && baseNodeId) {
                    // Get PDF name for the cell to check if it matches the prefix
                    const pdfName = typeof window.getPdfNameForNode === 'function' ? window.getPdfNameForNode(cell) : null;
                    if (pdfName && typeof window.sanitizePdfName === 'function') {
                      const sanitizedPdfName = window.sanitizePdfName(pdfName);
                      // Remove PDF prefix if present (only if it matches the actual PDF name)
                      if (sanitizedPdfName && baseNodeId.startsWith(sanitizedPdfName + '_')) {
                        baseNodeId = baseNodeId.substring(sanitizedPdfName.length + 1);
                      }
                    }
                  }
                  return {
                    nodeId: baseNodeId,
                    title: linkedField.title || ""
                  };
                });
              }
              // Add PDF entries if they exist
              if (option.pdfEntries && Array.isArray(option.pdfEntries) && option.pdfEntries.length > 0) {
                optionObj.pdfEntries = option.pdfEntries.map(pdfEntry => ({
                  triggerNumber: pdfEntry.triggerNumber || "",
                  pdfName: pdfEntry.pdfName || "",
                  pdfFile: pdfEntry.pdfFile || "",
                  priceId: pdfEntry.priceId || ""
                }));
              }
              return optionObj;
            }) : [];
            allFieldsInOrder.push({
              type: "checkbox",
              fieldName: checkbox.fieldName || "",
              selectionType: checkbox.selectionType || "multiple",
              required: (checkbox.required === false || checkbox.required === 'optional') ? "optional" : (checkbox.required || "required"),
              options: checkboxOptions,
              order: allFieldsInOrder.length + 1
            });
          });
        }
        // Add time fields if they exist
        if (cell._times && cell._times.length > 0) {
          cell._times.forEach((time, timeIndex) => {
            allFieldsInOrder.push({
              type: "date", // Use "date" type as expected in GUI JSON
              label: time.timeText || "",
              nodeId: time.timeId || "",
              order: allFieldsInOrder.length + 1
            });
          });
        }
      }
      // Set the allFieldsInOrder array
      question.allFieldsInOrder = allFieldsInOrder;
      // Keep backward compatibility with old format
      question.textboxes = cell._textboxes.map(tb => ({
        label: "", // Empty label field as required
        nameId: tb.nameId ? `${nodeId}_${sanitizeNameId(tb.nameId)}` : "",
        placeholder: tb.nameId || "Name" // Use nameId as placeholder, default to "Name"
      }));
      // Add empty amounts array for multipleTextboxes
      question.amounts = [];
      // Add nodeId for multiple textboxes (with PDF prefix if available)
      question.nodeId = nodeId;
      // Add missing fields to match expected structure
      question.pdfLogic = {
        enabled: false,
        pdfName: "",
        pdfDisplayName: "",
        stripePriceId: "",
        conditions: []
      };
    }
    // Handle outgoing edges to option nodes
    const outgoingEdges = graph.getOutgoingEdges(cell);
    const jumpConditions = [];
    let endOption = null;
    // Check for direct connections to END nodes or other questions (for text-based questions)
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (targetCell && isEndNode(targetCell)) {
          // This question connects directly to an END node
          // For text-based questions, add "Any Text" jump condition
          // For fileUpload questions, use "uploaded a file" instead
          if (exportType === "text" || exportType === "bigParagraph" || exportType === "money" || exportType === "date" || exportType === "dateRange" || exportType === "fileUpload") {
            const jumpOption = exportType === "fileUpload" ? "uploaded a file" : "Any Text";
            jumpConditions.push({
              option: jumpOption,
              to: "end"
            });
            endOption = jumpOption;
          }
        } else if (targetCell && isQuestion(targetCell)) {
          // This question connects directly to another question
          // For text-based questions, add "Any Text" jump condition to the target question
          // but only if the target is in a different section that meets the jump criteria
          // For fileUpload questions, use "uploaded a file" instead
          if (exportType === "text" || exportType === "bigParagraph" || exportType === "money" || exportType === "date" || exportType === "dateRange" || exportType === "fileUpload") {
            const targetQuestionId = targetCell._questionId || "";
            if (targetQuestionId) {
              // Get the target question's section using the same logic as section assignment
              let targetSection = parseInt(getSection(targetCell) || "1", 10);
              // Apply the same section assignment logic for the target question
              const targetIsFirstQuestion = questions.every(otherCell => 
                otherCell === targetCell || targetCell.geometry.y <= otherCell.geometry.y
              );
              if (targetIsFirstQuestion && targetSection !== 1) {
                targetSection = 1;
              }
              const currentSection = parseInt(section || "1", 10);
              // Only add jump logic if:
              // 1. Target is in a section before current section, OR
              // 2. Target is more than 1 section above current section
              const shouldAddJump = targetSection < currentSection || targetSection > currentSection + 1;
              if (shouldAddJump) {
                const jumpOption = exportType === "fileUpload" ? "uploaded a file" : "Any Text";
                jumpConditions.push({
                  option: jumpOption,
                  to: targetSection.toString()
                });
              }
            }
          }
        }
      }
    }
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (targetCell && isOptions(targetCell)) {
          let optionText = targetCell.value || "";
          // Clean HTML entities and tags from option text
          if (optionText) {
            // First decode HTML entities
            const textarea = document.createElement('textarea');
            textarea.innerHTML = optionText;
            let cleanedText = textarea.value;
            // Then remove HTML tags
            const temp = document.createElement("div");
            temp.innerHTML = cleanedText;
            cleanedText = temp.textContent || temp.innerText || cleanedText;
            // Clean up extra whitespace
            cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
            optionText = cleanedText;
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
                // Don't add jump conditions for options leading to numberedDropdown/multipleTextboxes
                // Those questions will handle their own jump conditions based on their min/max values
                if (questionType !== "multipleDropdownType" && questionType !== "multipleTextboxes") {
                // Check for jumps to other questions - only add jump logic if target is in a different section
                // that is either before the current section or more than 1 section above
                const targetQuestionId = optionTarget._questionId || "";
                if (targetQuestionId) {
                  // Get the target question's section using the same logic as section assignment
                  let targetSection = parseInt(getSection(optionTarget) || "1", 10);
                  // Apply the same section assignment logic for the target question
                  const targetIsFirstQuestion = questions.every(otherCell => 
                    otherCell === optionTarget || optionTarget.geometry.y <= otherCell.geometry.y
                  );
                  if (targetIsFirstQuestion && targetSection !== 1) {
                    targetSection = 1;
                  }
                  const currentSection = parseInt(section || "1", 10);
                  // Only add jump logic if:
                  // 1. Target is in a section before current section, OR
                  // 2. Target is more than 1 section above current section
                  const shouldAddJump = targetSection < currentSection || targetSection > currentSection + 1;
                  if (shouldAddJump) {
                    // Check if this jump already exists
                    const exists = jumpConditions.some(j => j.option === optionText.trim() && j.to === targetSection.toString());
                    if (!exists) {
                      jumpConditions.push({
                        option: optionText.trim(),
                        to: targetSection.toString()
                      });
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
    // Check for hidden logic - look for hidden checkbox/textbox nodes connected to options
    const hiddenLogicConfigs = [];
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (targetCell && isOptions(targetCell)) {
          // Get the option text
          let optionText = targetCell.value || "";
          if (optionText) {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = optionText;
            let cleanedText = textarea.value;
            const temp = document.createElement("div");
            temp.innerHTML = cleanedText;
            cleanedText = temp.textContent || temp.innerText || cleanedText;
            cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
            optionText = cleanedText;
          }
          // Check if this option connects to hidden nodes
          const optionOutgoingEdges = graph.getOutgoingEdges(targetCell);
          if (optionOutgoingEdges) {
            for (const optionEdge of optionOutgoingEdges) {
              const hiddenNode = optionEdge.target;
              if (hiddenNode && typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(hiddenNode)) {
                // Hidden checkbox node
                hiddenLogicConfigs.push({
                  trigger: optionText.trim(),
                  type: "checkbox",
                  nodeId: hiddenNode._hiddenNodeId || "hidden_checkbox",
                  textboxText: ""
                });
              } else if (hiddenNode && typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(hiddenNode)) {
                // Hidden textbox node
                hiddenLogicConfigs.push({
                  trigger: optionText.trim(),
                  type: "textbox",
                  nodeId: hiddenNode._hiddenNodeId || "hidden_textbox",
                  textboxText: hiddenNode._defaultText || ""
                });
              }
            }
          }
        }
      }
    }
    // Sort options by their position (X coordinate, then Y coordinate) for both checkbox and dropdown
    if (exportType === "checkbox" || exportType === "dropdown") {
      question.options.sort((a, b) => {
        // Find the option cells to get their positions
        const optionCells = [];
        if (outgoingEdges) {
          for (const edge of outgoingEdges) {
            const targetCell = edge.target;
            if (targetCell && isOptions(targetCell)) {
              let optionText = targetCell.value || "";
              // Clean HTML entities and tags from option text
              if (optionText) {
                const textarea = document.createElement('textarea');
                textarea.innerHTML = optionText;
                let cleanedText = textarea.value;
                const temp = document.createElement("div");
                temp.innerHTML = cleanedText;
                cleanedText = temp.textContent || temp.innerText || cleanedText;
                cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
                optionText = cleanedText;
              }
              if (optionText === a.text || optionText === b.text) {
                optionCells.push({ text: optionText, cell: targetCell });
              }
            }
          }
        }
        const aCell = optionCells.find(oc => oc.text === a.text)?.cell;
        const bCell = optionCells.find(oc => oc.text === b.text)?.cell;
        if (aCell && bCell) {
          const aX = aCell.geometry?.x || 0;
          const bX = bCell.geometry?.x || 0;
          if (aX !== bX) return aX - bX;
          const aY = aCell.geometry?.y || 0;
          const bY = bCell.geometry?.y || 0;
          return aY - bY;
        }
        return 0;
      });
    }
    // Set hidden logic if any hidden nodes are connected to options
    // Update hiddenLogic (already initialized in question object)
    if (hiddenLogicConfigs.length > 0) {
      question.hiddenLogic.enabled = true;
      question.hiddenLogic.configs = hiddenLogicConfigs;
    }
    // Check if numberedDropdown connects directly to end node and add jump conditions for each option
    if (exportType === "multipleDropdownType") {
      const questionOutgoingEdges = graph.getOutgoingEdges(cell);
      if (questionOutgoingEdges) {
        for (const edge of questionOutgoingEdges) {
          const targetCell = edge.target;
          if (targetCell && isEndNode(targetCell)) {
            // This numberedDropdown connects to an end node, add jump conditions for each option
            const min = cell._twoNumbers?.first ? parseInt(cell._twoNumbers.first) : 1;
            const max = cell._twoNumbers?.second ? parseInt(cell._twoNumbers.second) : min;
            for (let i = min; i <= max; i++) {
              jumpConditions.push({
                option: i.toString(),
                to: "end"
              });
            }
            break; // Only need to process once
          }
        }
      }
    }
    // Set jump logic if any options lead to end nodes or section jumps
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
      // Update image field if imageData is found, otherwise remove it
      if (imageData) {
        question.image = imageData;
      } else {
        delete question.image;
      }
      // Remove linking field if not enabled
      if (!question.linking || !question.linking.enabled) {
        delete question.linking;
      }
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
      const baseNameId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || question.nameId || "unnamed";
      // Check if this is a "mark only one" checkbox
      const checkboxAvailability = cell._checkboxAvailability || 'markAll';
      // Convert options to checkbox format with proper amount handling
      question.options = question.options.map(opt => {
        if (typeof opt.text === 'string') {
          const optionText = opt.text.trim();
          // Check if this option has amount properties
          const hasAmount = opt.amount && typeof opt.amount === 'object';
          // Special handling for "None of the above" option
          const isNoneOfTheAbove = optionText.toLowerCase() === "none of the above";
          // Sanitize option text for nodeId: remove commas and non-alphanumerics, collapse to underscores
          // For "None of the above", use "_none" instead of "_none_of_the_above"
          let sanitizedOption;
          if (isNoneOfTheAbove) {
            sanitizedOption = "none";
          } else {
            sanitizedOption = optionText
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
          }
          // Always use the base nameId prefix for checkbox options
          const nameId = `${baseNameId}_${sanitizedOption}`;
          const optionObj = {
            label: optionText,
            nameId: nameId,
            value: isNoneOfTheAbove ? optionText : "", // Set value for "None of the above"
            hasAmount: hasAmount || false
          };
          // Always include amountName and amountPlaceholder (empty strings if hasAmount is false)
          if (hasAmount) {
            optionObj.amountName = opt.amount.name || optionText;
            optionObj.amountPlaceholder = opt.amount.placeholder || "";
          } else {
            optionObj.amountName = "";
            optionObj.amountPlaceholder = "";
          }
          return optionObj;
        }
        return {
          label: "",
          nameId: "",
          value: "",
          hasAmount: false
        };
      });
      // Default required/markOnlyOne flags for checkboxes
      question.required = checkboxAvailability !== 'optional';
      question.markOnlyOne = checkboxAvailability === 'markOne';
      question.allAreRequired = checkboxAvailability === 'allRequired';
      // Set conditionalPDF answer to the first option that leads to end (if endOption was set)
      // Otherwise, use the first option label if we only had the generic "Yes" default
      if (endOption && question.options.length > 0) {
        // Find the option that matches endOption
        const matchingOption = question.options.find(opt => opt.label === endOption);
        if (matchingOption) {
          question.conditionalPDF.answer = matchingOption.label;
        } else if (question.options[0].label) {
        question.conditionalPDF.answer = question.options[0].label;
        }
      } else if (question.conditionalPDF.answer === "Yes" && question.options.length > 0 && question.options[0].label) {
        question.conditionalPDF.answer = question.options[0].label;
      }
      // Remove linking and image fields from checkbox questions (they're not used)
      if (question.linking) {
        delete question.linking;
      }
      if (question.image) {
        delete question.image;
      }
      // For "mark only one" checkboxes, remove nameId/placeholder
      if (question.markOnlyOne) {
        delete question.nameId;
        delete question.placeholder;
      }
    }
    // --- PATCH: For multipleDropdownType, convert to numberedDropdown format ---
    if (exportType === "multipleDropdownType") {
      // Change type to numberedDropdown
      question.type = "numberedDropdown";
      // Get PDF name if available
      const pdfName = typeof window.getPdfNameForNode === 'function' ? window.getPdfNameForNode(cell) : null;
      // Check if PDF name should be added to node ID based on user setting
      const shouldAddPdfName = (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId !== false) ? true : false;
      // Process PDF name to remove .pdf extension and clean up formatting
      const sanitizedPdfName = (pdfName && shouldAddPdfName) ? pdfName.replace(/\.pdf$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase() : '';
      // Build base name components
      const baseQuestionName = sanitizeNameId(cell._questionText || cell.value || "unnamed");
      // Get the actual nodeId from the cell (which may include _dup2, _dup3, etc.)
      const actualNodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || baseQuestionName;
      // Create nodeId with PDF prefix if available (but preserve the actual nodeId including _dup suffix)
      let nodeId = actualNodeId;
      if (sanitizedPdfName && !actualNodeId.startsWith(sanitizedPdfName + '_')) {
        // Only add PDF prefix if it's not already there
        nodeId = `${sanitizedPdfName}_${actualNodeId}`;
      } else {
        nodeId = actualNodeId;
      }
      // Extract labels and amounts from textboxes with location data support
      if (cell._textboxes && Array.isArray(cell._textboxes)) {
        // Create allFieldsInOrder array using _itemOrder if available, otherwise use default logic
        const allFieldsInOrder = [];
        // If _itemOrder exists, use it to determine the correct order
          if (cell._itemOrder && cell._itemOrder.length > 0) {
          cell._itemOrder.forEach((item, orderIndex) => {
            if (item.type === 'option' && cell._textboxes && cell._textboxes[item.index]) {
              const tb = cell._textboxes[item.index];
              const labelName = tb.nameId || tb.placeholder || "";
              const fieldType = tb.type === 'phone'
                ? 'phone'
                : (tb.type === 'currency'
                  ? 'currency'
                  : (tb.isAmountOption === true ? "amount" : "label"));
              console.log('[LIBRARY exportGuiJson multipleDropdownType] Field type determined (_itemOrder path)', { 
                cellId: cell.id, 
                index: item.index, 
                tbType: tb.type, 
                isAmountOption: tb.isAmountOption, 
                fieldType 
              });
              // Use the actual nodeId (which may include _dup2) as the base for fieldNodeId
              const fieldNodeId = sanitizedPdfName ? `${nodeId}_${sanitizeNameId(labelName)}` : `${nodeId}_${sanitizeNameId(labelName)}`;
              const fieldEntry = {
                type: fieldType,
                label: labelName,
                nodeId: fieldNodeId,
                order: orderIndex + 1
              };
              // Only add prefill for non-amount and non-currency fields
              if (fieldType !== "amount" && fieldType !== "currency") {
                fieldEntry.prefill = tb.prefill || '';
              }
              allFieldsInOrder.push(fieldEntry);
            } else if (item.type === 'location') {
              // Only include location if it still exists (locationIndex present)
              if (cell._locationIndex !== undefined && cell._locationIndex >= 0) {
                allFieldsInOrder.push({
                  type: "location",
                  fieldName: cell._locationTitle || "",
                  nodeId: "location_data",
                  order: orderIndex + 1
                });
              }
            } else if (item.type === 'time' && cell._times && cell._times[item.index]) {
              const time = cell._times[item.index];
              allFieldsInOrder.push({
                type: "date", // Use "date" type as expected in GUI JSON
                label: time.timeText || "",
                nodeId: time.timeId || "",
                order: orderIndex + 1
              });
            } else if (item.type === 'checkbox' && cell._checkboxes && cell._checkboxes[item.index]) {
              const checkbox = cell._checkboxes[item.index];
            const checkboxOptions = checkbox.options ? checkbox.options.map(option => {
              const optionObj = {
                text: option.checkboxText || option.text || "",
                nodeId: option.nodeId || ""
              };
              // Add linked fields if they exist
              if (option.linkedFields && Array.isArray(option.linkedFields) && option.linkedFields.length > 0) {
                optionObj.linkedFields = option.linkedFields.map(linkedField => {
                  // Strip entry number suffix from selectedNodeId to match label nodeId format
                  // Format: baseNodeId_${entryNumber} -> baseNodeId
                  let baseNodeId = linkedField.selectedNodeId || "";
                  if (baseNodeId) {
                    // Remove trailing _${number} pattern (e.g., "_1", "_2", "_3")
                    baseNodeId = baseNodeId.replace(/_\d+$/, '');
                  }
                  // Check if PDF name should be added to node ID based on user setting
                  const shouldAddPdfName = (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId !== false) ? true : false;
                  // If setting is OFF, remove PDF prefix from baseNodeId if present
                  if (!shouldAddPdfName && baseNodeId) {
                    // Get PDF name for the cell to check if it matches the prefix
                    const pdfName = typeof window.getPdfNameForNode === 'function' ? window.getPdfNameForNode(cell) : null;
                    if (pdfName && typeof window.sanitizePdfName === 'function') {
                      const sanitizedPdfName = window.sanitizePdfName(pdfName);
                      // Remove PDF prefix if present (only if it matches the actual PDF name)
                      if (sanitizedPdfName && baseNodeId.startsWith(sanitizedPdfName + '_')) {
                        baseNodeId = baseNodeId.substring(sanitizedPdfName.length + 1);
                      }
                    }
                  }
                  return {
                    nodeId: baseNodeId,
                    title: linkedField.title || ""
                  };
                });
              }
              // Add PDF entries if they exist
              if (option.pdfEntries && Array.isArray(option.pdfEntries) && option.pdfEntries.length > 0) {
                optionObj.pdfEntries = option.pdfEntries.map(pdfEntry => ({
                  triggerNumber: pdfEntry.triggerNumber || "",
                  pdfName: pdfEntry.pdfName || "",
                  pdfFile: pdfEntry.pdfFile || "",
                  priceId: pdfEntry.priceId || ""
                }));
              }
              return optionObj;
            }) : [];
              allFieldsInOrder.push({
                type: "checkbox",
                fieldName: checkbox.fieldName || "",
                selectionType: checkbox.selectionType || "multiple",
                required: (checkbox.required === false || checkbox.required === 'optional') ? "optional" : (checkbox.required || "required"),
                options: checkboxOptions,
                order: orderIndex + 1
              });
            } else if (item.type === 'dropdown' && cell._dropdowns && cell._dropdowns[item.index]) {
              const dropdown = cell._dropdowns[item.index];
              const dropdownOptions = dropdown.options ? dropdown.options.map(option => {
                // Sanitize the dropdown name and option value for nodeId
                // Preserve forward slashes "/" in the name
                const sanitizedDropdownName = (dropdown.name || "").toLowerCase().replace(/[^a-z0-9\s\/]/g, '').replace(/\s+/g, '_');
                const sanitizedOptionValue = (option.value || "").toLowerCase().replace(/[^a-z0-9\s\/]/g, '').replace(/\s+/g, '_');
                return {
                  text: option.text || "",
                  nodeId: `${sanitizedDropdownName}_${sanitizedOptionValue}`
                };
              }) : [];
              // Process trigger sequences
              const triggerSequences = [];
              if (dropdown.triggerSequences && dropdown.triggerSequences.length > 0) {
                dropdown.triggerSequences.forEach(trigger => {
                  const fields = [];
                  // Create maps for quick lookup by identifier
                  const labelMap = new Map();
                  if (trigger.labels && trigger.labels.length > 0) {
                    trigger.labels.forEach(label => {
                      labelMap.set(label.fieldName || '', label);
                    });
                  }
                  const checkboxMap = new Map();
                  if (trigger.checkboxes && trigger.checkboxes.length > 0) {
                    trigger.checkboxes.forEach(checkbox => {
                      checkboxMap.set(checkbox.fieldName || '', checkbox);
                    });
                  }
                  const timeMap = new Map();
                  if (trigger.times && trigger.times.length > 0) {
                    trigger.times.forEach(time => {
                      timeMap.set(time.fieldName || '', time);
                    });
                  }
                  const locationMap = new Map();
                  if (trigger.locations && trigger.locations.length > 0) {
                    trigger.locations.forEach(location => {
                      const identifier = location.locationTitle || location.fieldName || 'location';
                      locationMap.set(identifier, location);
                    });
                  }
                  const pdfMap = new Map();
                  if (trigger.pdfs && trigger.pdfs.length > 0) {
                    trigger.pdfs.forEach(pdf => {
                      const identifier = pdf.triggerNumber || pdf.pdfTitle || pdf.pdfFilename || 'pdf';
                      pdfMap.set(identifier, pdf);
                    });
                  }
                  const dropdownMap = new Map();
                  if (trigger.dropdowns && trigger.dropdowns.length > 0) {
                    trigger.dropdowns.forEach(dropdown => {
                      dropdownMap.set(dropdown.fieldName || '', dropdown);
                    });
                  }
                  // Use unified order if available, otherwise use type-based order
                  if (trigger._actionOrder && trigger._actionOrder.length > 0) {
                    // Add fields in the unified order
                    trigger._actionOrder.forEach(orderItem => {
                      if (orderItem.type === 'label') {
                        const label = labelMap.get(orderItem.identifier);
                        if (label) {
                          // Regenerate nodeId if dropdown name contains forward slash but nodeId doesn't
                          let nodeId = label.nodeId || "";
                          if (dropdown.name && dropdown.name.includes('/') && !nodeId.includes('/')) {
                            // Regenerate using generateNodeIdForDropdownField if available
                            if (typeof window.generateNodeIdForDropdownField === 'function') {
                              nodeId = window.generateNodeIdForDropdownField(label.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
                            }
                          }
                          const labelField = {
                            type: "label",
                            label: label.fieldName || "",
                            nodeId: nodeId
                          };
                          if (label.isAmountOption) {
                            labelField.isAmountOption = true;
                          }
                          fields.push(labelField);
                        }
                      } else if (orderItem.type === 'checkbox') {
                        const checkbox = checkboxMap.get(orderItem.identifier);
                        if (checkbox) {
                          const checkboxOptions = checkbox.options ? checkbox.options.map(option => ({
                            text: option.checkboxText || "",
                            nodeId: option.nodeId || ""
                          })) : [];
                          fields.push({
                            type: "checkbox",
                            fieldName: checkbox.fieldName || "",
                            selectionType: checkbox.selectionType || "multiple",
                            required: checkbox.required || "required",
                            options: checkboxOptions
                          });
                        }
                      } else if (orderItem.type === 'time') {
                        const time = timeMap.get(orderItem.identifier);
                        if (time) {
                          // Regenerate nodeId if dropdown name contains forward slash but nodeId doesn't
                          let nodeId = time.nodeId || "";
                          if (dropdown.name && dropdown.name.includes('/') && !nodeId.includes('/')) {
                            // Regenerate using generateNodeIdForDropdownField if available
                            if (typeof window.generateNodeIdForDropdownField === 'function') {
                              nodeId = window.generateNodeIdForDropdownField(time.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
                            }
                          }
                          const dateField = {
                            type: "date",
                            label: time.fieldName || "",
                            nodeId: nodeId
                          };
                          // Include conditional logic if it exists
                          if (time.conditionalLogic && time.conditionalLogic.enabled) {
                            // Regenerate conditions if they're missing forward slashes
                            let conditions = time.conditionalLogic.conditions || [];
                            if (dropdown.name && dropdown.name.includes('/')) {
                              conditions = conditions.map(condition => {
                                // If condition doesn't have forward slash but should, regenerate it
                                if (condition && !condition.includes('/')) {
                                  // Try to regenerate using getCheckboxOptionNodeIdsFromTriggerSequence
                                  if (typeof window.getCheckboxOptionNodeIdsFromTriggerSequence === 'function') {
                                    const availableNodeIds = window.getCheckboxOptionNodeIdsFromTriggerSequence(trigger, dropdown, cell);
                                    // Find matching nodeId that has the forward slash
                                    const matchingNodeId = availableNodeIds.find(nodeId => {
                                      // Normalize both strings by removing slashes and underscores for comparison
                                      // This handles cases where old conditions had underscores instead of slashes
                                      const normalize = (str) => str.replace(/[\/_]/g, '').toLowerCase();
                                      return normalize(condition) === normalize(nodeId);
                                    });
                                    if (matchingNodeId) {
                                      return matchingNodeId;
                                    }
                                  }
                                }
                                return condition;
                              });
                            }
                            const filteredConditions = conditions.filter(c => c && c.trim() !== '');
                            // Only include conditionalLogic if there are actual conditions
                            if (filteredConditions.length > 0) {
                            dateField.conditionalLogic = {
                              enabled: time.conditionalLogic.enabled,
                                conditions: filteredConditions
                              };
                            }
                          }
                          // Include alert if it exists and is enabled
                          if (time.alert && time.alert.enabled) {
                            dateField.alert = {
                              enabled: true,
                              condition: time.alert.trigger || '',
                              title: time.alert.title || ''
                            };
                          }
                          // Include hardAlert if it exists and is enabled
                          if (time.hardAlert && time.hardAlert.enabled) {
                            dateField.hardAlert = {
                              enabled: true,
                              condition: time.hardAlert.trigger || '',
                              title: time.hardAlert.title || ''
                            };
                          }
                          fields.push(dateField);
                        }
                      } else if (orderItem.type === 'dropdown') {
                        const nestedDropdown = dropdownMap.get(orderItem.identifier);
                        if (nestedDropdown) {
                          const dropdownOptions = nestedDropdown.options ? nestedDropdown.options.map(option => ({
                            text: option.text || ""
                          })) : [];
                          const dropdownField = {
                            type: "dropdown",
                            fieldName: nestedDropdown.fieldName || "",
                            options: dropdownOptions
                          };
                          // Include conditional logic if it exists
                          if (nestedDropdown.conditionalLogic && nestedDropdown.conditionalLogic.enabled) {
                            // Regenerate conditions if they're missing forward slashes
                            let conditions = nestedDropdown.conditionalLogic.conditions || [];
                            if (dropdown.name && dropdown.name.includes('/')) {
                              conditions = conditions.map(condition => {
                                // If condition doesn't have forward slash but should, regenerate it
                                if (condition && !condition.includes('/')) {
                                  // Try to regenerate using getCheckboxOptionNodeIdsFromTriggerSequence
                                  if (typeof window.getCheckboxOptionNodeIdsFromTriggerSequence === 'function') {
                                    const availableNodeIds = window.getCheckboxOptionNodeIdsFromTriggerSequence(trigger, dropdown, cell);
                                    // Find matching nodeId that has the forward slash
                                    const matchingNodeId = availableNodeIds.find(nodeId => {
                                      // Normalize both strings by removing slashes and underscores for comparison
                                      // This handles cases where old conditions had underscores instead of slashes
                                      const normalize = (str) => str.replace(/[\/_]/g, '').toLowerCase();
                                      return normalize(condition) === normalize(nodeId);
                                    });
                                    if (matchingNodeId) {
                                      return matchingNodeId;
                                    }
                                  }
                                }
                                return condition;
                              });
                            }
                            dropdownField.conditionalLogic = {
                              enabled: nestedDropdown.conditionalLogic.enabled,
                              conditions: conditions.filter(c => c && c.trim() !== '')
                            };
                          }
                          // Include alert if it exists and is enabled
                          if (nestedDropdown.alert && nestedDropdown.alert.enabled) {
                            dropdownField.alert = {
                              enabled: true,
                              condition: nestedDropdown.alert.trigger || '',
                              title: nestedDropdown.alert.title || ''
                            };
                          }
                          // Include hardAlert if it exists and is enabled
                          if (nestedDropdown.hardAlert && nestedDropdown.hardAlert.enabled) {
                            dropdownField.hardAlert = {
                              enabled: true,
                              condition: nestedDropdown.hardAlert.trigger || '',
                              title: nestedDropdown.hardAlert.title || ''
                            };
                          }
                          fields.push(dropdownField);
                        }
                      } else if (orderItem.type === 'location') {
                        const location = locationMap.get(orderItem.identifier);
                        if (location) {
                          fields.push({
                            type: "location",
                            fieldName: location.locationTitle || "",
                            nodeId: "location_data"
                          });
                        }
                      } else if (orderItem.type === 'pdf') {
                        const pdf = pdfMap.get(orderItem.identifier);
                        if (pdf) {
                          fields.push({
                            type: "pdf",
                            number: pdf.triggerNumber || "",
                            pdfTitle: pdf.pdfTitle || "",
                            pdfName: pdf.pdfFilename || "",
                            priceId: pdf.pdfPriceId || ""
                          });
                        }
                      }
                    });
                    // Add any fields not in the unified order (safety check)
                    if (trigger.labels && trigger.labels.length > 0) {
                      trigger.labels.forEach(label => {
                        if (!labelMap.has(label.fieldName || '')) {
                          const existingField = fields.find(f => f.type === 'label' && f.label === label.fieldName);
                          if (!existingField) {
                            // Regenerate nodeId if dropdown name contains forward slash but nodeId doesn't
                            let nodeId = label.nodeId || "";
                            if (dropdown.name && dropdown.name.includes('/') && !nodeId.includes('/')) {
                              if (typeof window.generateNodeIdForDropdownField === 'function') {
                                nodeId = window.generateNodeIdForDropdownField(label.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
                              }
                            }
                            const labelField = {
                              type: "label",
                              label: label.fieldName || "",
                              nodeId: nodeId
                            };
                            if (label.isAmountOption) {
                              labelField.isAmountOption = true;
                            }
                            fields.push(labelField);
                          }
                        }
                      });
                    }
                    if (trigger.checkboxes && trigger.checkboxes.length > 0) {
                      trigger.checkboxes.forEach(checkbox => {
                        if (!checkboxMap.has(checkbox.fieldName || '')) {
                          const existingField = fields.find(f => f.type === 'checkbox' && f.fieldName === checkbox.fieldName);
                          if (!existingField) {
                            const checkboxOptions = checkbox.options ? checkbox.options.map(option => ({
                              text: option.checkboxText || "",
                              nodeId: stripPdfPrefixIfDisabled(option.nodeId || "", cell)
                            })) : [];
                            fields.push({
                              type: "checkbox",
                              fieldName: checkbox.fieldName || "",
                              selectionType: checkbox.selectionType || "multiple",
                              options: checkboxOptions
                            });
                          }
                        }
                      });
                    }
                    if (trigger.times && trigger.times.length > 0) {
                      trigger.times.forEach(time => {
                        if (!timeMap.has(time.fieldName || '')) {
                          const existingField = fields.find(f => f.type === 'date' && f.label === time.fieldName);
                          if (!existingField) {
                            // Regenerate nodeId if dropdown name contains forward slash but nodeId doesn't
                            let nodeId = stripPdfPrefixIfDisabled(time.nodeId || "", cell);
                            if (dropdown.name && dropdown.name.includes('/') && !nodeId.includes('/')) {
                              if (typeof window.generateNodeIdForDropdownField === 'function') {
                                nodeId = window.generateNodeIdForDropdownField(time.fieldName || '', dropdown.name || '', cell, trigger.triggerOption || '');
                              }
                            }
                            const dateField = {
                              type: "date",
                              label: time.fieldName || "",
                              nodeId: nodeId
                            };
                            // Include conditional logic if it exists
                            if (time.conditionalLogic && time.conditionalLogic.enabled) {
                              dateField.conditionalLogic = {
                                enabled: time.conditionalLogic.enabled,
                                conditions: time.conditionalLogic.conditions || []
                              };
                            }
                            fields.push(dateField);
                          }
                        }
                      });
                    }
                    if (trigger.locations && trigger.locations.length > 0) {
                      trigger.locations.forEach(location => {
                        const identifier = location.locationTitle || location.fieldName || 'location';
                        if (!locationMap.has(identifier)) {
                          const existingField = fields.find(f => f.type === 'location' && f.fieldName === location.locationTitle);
                          if (!existingField) {
                            fields.push({
                              type: "location",
                              fieldName: location.locationTitle || "",
                              nodeId: "location_data"
                            });
                          }
                        }
                      });
                    }
                    if (trigger.dropdowns && trigger.dropdowns.length > 0) {
                      trigger.dropdowns.forEach(dropdown => {
                        // Check if this dropdown was already added to fields
                        const existingField = fields.find(f => f.type === 'dropdown' && f.fieldName === dropdown.fieldName);
                        if (!existingField) {
                          const dropdownOptions = dropdown.options ? dropdown.options.map(option => ({
                            text: option.text || ""
                          })) : [];
                          fields.push({
                            type: "dropdown",
                            fieldName: dropdown.fieldName || "",
                            options: dropdownOptions
                          });
                        }
                      });
                    }
                    if (trigger.pdfs && trigger.pdfs.length > 0) {
                      trigger.pdfs.forEach(pdf => {
                        // Check if this PDF was already added (by _actionOrder processing)
                        const existingField = fields.find(f => f.type === 'pdf' && f.number === pdf.triggerNumber);
                        if (!existingField) {
                          fields.push({
                            type: "pdf",
                            number: pdf.triggerNumber || "",
                            pdfTitle: pdf.pdfTitle || "",
                            pdfName: pdf.pdfFilename || "",
                            priceId: pdf.pdfPriceId || ""
                          });
                        }
                      });
                    }
                  } else {
                    // Fallback: Add fields in type-based order (for backward compatibility)
                    // Add labels
                    if (trigger.labels && trigger.labels.length > 0) {
                      trigger.labels.forEach(label => {
                        const labelField = {
                          type: "label",
                          label: label.fieldName || "",
                          nodeId: label.nodeId || ""
                        };
                        if (label.isAmountOption) {
                          labelField.isAmountOption = true;
                        }
                        fields.push(labelField);
                      });
                    }
                    // Add checkboxes
                    if (trigger.checkboxes && trigger.checkboxes.length > 0) {
                      trigger.checkboxes.forEach(checkbox => {
                        const checkboxOptions = checkbox.options ? checkbox.options.map(option => {
                          const optionObj = {
                            text: option.checkboxText || "",
                            nodeId: option.nodeId || ""
                          };
                          // Add linked fields if they exist
                          if (option.linkedFields && Array.isArray(option.linkedFields) && option.linkedFields.length > 0) {
                            optionObj.linkedFields = option.linkedFields.map(linkedField => ({
                              nodeId: linkedField.selectedNodeId || "",
                              title: linkedField.title || ""
                            }));
                          }
                          return optionObj;
                        }) : [];
                        fields.push({
                          type: "checkbox",
                          fieldName: checkbox.fieldName || "",
                          selectionType: checkbox.selectionType || "multiple",
                          required: checkbox.required || "required",
                          options: checkboxOptions
                        });
                      });
                    }
              // Add times
              if (trigger.times && trigger.times.length > 0) {
                trigger.times.forEach(time => {
                  const dateField = {
                    type: "date",
                    label: time.fieldName || "",
                    nodeId: time.nodeId || ""
                  };
                  // Include conditional logic if it exists
                  if (time.conditionalLogic && time.conditionalLogic.enabled) {
                    dateField.conditionalLogic = {
                      enabled: time.conditionalLogic.enabled,
                      conditions: time.conditionalLogic.conditions || []
                    };
                  }
                  fields.push(dateField);
                });
              }
                    // Add locations
                    if (trigger.locations && trigger.locations.length > 0) {
                      trigger.locations.forEach(location => {
                        fields.push({
                          type: "location",
                          fieldName: location.locationTitle || "",
                          nodeId: "location_data"
                        });
                      });
                    }
                    // Add dropdowns
                    if (trigger.dropdowns && trigger.dropdowns.length > 0) {
                      trigger.dropdowns.forEach(dropdown => {
                        const dropdownOptions = dropdown.options ? dropdown.options.map(option => ({
                          text: option.text || ""
                        })) : [];
                        fields.push({
                          type: "dropdown",
                          fieldName: dropdown.fieldName || "",
                          options: dropdownOptions
                        });
                      });
                    }
                    // Add PDFs
                    if (trigger.pdfs && trigger.pdfs.length > 0) {
                      trigger.pdfs.forEach(pdf => {
                        fields.push({
                          type: "pdf",
                          number: pdf.triggerNumber || "",
                          pdfTitle: pdf.pdfTitle || "",
                          pdfName: pdf.pdfFilename || "",
                          priceId: pdf.pdfPriceId || ""
                        });
                      });
                    }
                  }
                  // Find the matching option text for the condition
                  const matchingOption = dropdown.options.find(option => option.value === trigger.triggerOption);
                  const conditionText = matchingOption ? matchingOption.text : trigger.triggerOption || "";
                  triggerSequences.push({
                    condition: conditionText,
                    title: "Additional Information",
                    fields: fields
                  });
                });
              }
              // Calculate the correct order for dropdown
              // All items (including location) are now single entries, so use orderIndex + 1
              let dropdownOrder = orderIndex + 1;
              allFieldsInOrder.push({
                type: "dropdown",
                fieldName: dropdown.name || "",
                options: dropdownOptions,
                triggerSequences: triggerSequences,
                order: dropdownOrder
              });
            }
          });
        } else {
          // Fallback to old logic if _itemOrder doesn't exist
          const locationIndex = cell._locationIndex !== undefined ? cell._locationIndex : -1;
          // Process each textbox in order
          cell._textboxes.forEach((tb, index) => {
            const labelName = tb.nameId || tb.placeholder || "";
            const fieldType = tb.type === 'phone'
              ? 'phone'
              : (tb.type === 'currency'
                ? 'currency'
                : (tb.isAmountOption === true ? "amount" : "label"));
            console.log('[LIBRARY exportGuiJson multipleDropdownType] Field type determined (fallback path)', { 
              cellId: cell.id, 
              index, 
              tbType: tb.type, 
              isAmountOption: tb.isAmountOption, 
              fieldType 
            });
            // Use the actual nodeId (which may include _dup2) as the base for fieldNodeId
            const fieldNodeId = sanitizedPdfName ? `${nodeId}_${sanitizeNameId(labelName)}` : `${nodeId}_${sanitizeNameId(labelName)}`;
            const fieldEntry = {
              type: fieldType,
              label: labelName,
              nodeId: fieldNodeId,
              order: index + 1
            };
            // Only add prefill for non-amount and non-currency fields
            if (fieldType !== "amount" && fieldType !== "currency") {
              fieldEntry.prefill = tb.prefill || '';
            }
            allFieldsInOrder.push(fieldEntry);
          });
          // Insert location fields at the correct position if locationIndex is set
          const hasLocationFieldsInUI = cell._textboxes && cell._textboxes.some(tb => 
            ['Street', 'City', 'State', 'Zip'].includes(tb.nameId || tb.placeholder || '')
          );
          const shouldIncludeLocationFields = (exportType === "multipleTextboxes" && locationIndex >= 0 && hasLocationFieldsInUI);
          if (shouldIncludeLocationFields && locationIndex <= cell._textboxes.length) {
            // Check if PDF name should be added to node ID based on user setting (for location fields)
            const shouldAddPdfNameForLocation = (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId !== false) ? true : false;
            const effectiveSanitizedPdfName = shouldAddPdfNameForLocation ? sanitizedPdfName : '';
            const effectiveNodeId = effectiveSanitizedPdfName ? `${effectiveSanitizedPdfName}_${baseQuestionName}` : baseQuestionName;
            const locationFields = [
              { label: "Street", nodeId: effectiveSanitizedPdfName ? `${effectiveNodeId}_street` : `${baseQuestionName}_street` },
              { label: "City", nodeId: effectiveSanitizedPdfName ? `${effectiveNodeId}_city` : `${baseQuestionName}_city` },
              { label: "State", nodeId: effectiveSanitizedPdfName ? `${effectiveNodeId}_state` : `${baseQuestionName}_state` },
              { label: "Zip", nodeId: effectiveSanitizedPdfName ? `${effectiveNodeId}_zip` : `${baseQuestionName}_zip` }
            ];
            locationFields.forEach((field, fieldIndex) => {
              allFieldsInOrder.splice(locationIndex + fieldIndex, 0, {
                type: field.label === "Zip" ? "amount" : "label",
                label: field.label,
                nodeId: field.nodeId,
                order: locationIndex + fieldIndex + 1
              });
            });
            allFieldsInOrder.forEach((field, index) => {
              field.order = index + 1;
            });
          }
          // Add checkbox fields if they exist
          if (cell._checkboxes && cell._checkboxes.length > 0) {
            cell._checkboxes.forEach((checkbox, checkboxIndex) => {
              const checkboxOptions = checkbox.options ? checkbox.options.map(option => ({
                text: option.checkboxText || option.text || "",
                nodeId: option.nodeId || ""
              })) : [];
              allFieldsInOrder.push({
                type: "checkbox",
                fieldName: checkbox.fieldName || "",
                selectionType: checkbox.selectionType || "multiple",
                options: checkboxOptions,
                order: allFieldsInOrder.length + 1
              });
            });
          }
          // Add time fields if they exist
          if (cell._times && cell._times.length > 0) {
            cell._times.forEach((time, timeIndex) => {
              allFieldsInOrder.push({
                type: "date", // Use "date" type as expected in GUI JSON
                label: time.timeText || "",
                nodeId: time.timeId || "",
                order: allFieldsInOrder.length + 1
              });
            });
          }
        }
        // Extract min and max from _twoNumbers
        if (cell._twoNumbers) {
          question.min = cell._twoNumbers.first || "1";
          question.max = cell._twoNumbers.second || "1";
        } else {
          question.min = "1";
          question.max = "1";
        }
        // Add nodeId for numberedDropdown (with PDF prefix if available)
        question.nodeId = nodeId;
        // Add entryTitle if _dropdownTitle is set
        if (cell._dropdownTitle) {
          question.entryTitle = cell._dropdownTitle;
        }
        // Set the allFieldsInOrder array
        question.allFieldsInOrder = allFieldsInOrder;
      } else {
      // Extract min and max from _twoNumbers
      if (cell._twoNumbers) {
        question.min = cell._twoNumbers.first || "1";
        question.max = cell._twoNumbers.second || "1";
      } else {
        question.min = "1";
        question.max = "1";
      }
      // Add nodeId for numberedDropdown (with PDF prefix if available)
      question.nodeId = nodeId;
      // Add entryTitle if _dropdownTitle is set
      if (cell._dropdownTitle) {
        question.entryTitle = cell._dropdownTitle;
      }
        question.allFieldsInOrder = [];
      }
      // Clear options array for numberedDropdown
      question.options = [];
      // Remove nameId and placeholder fields that shouldn't be in numberedDropdown
      delete question.nameId;
      delete question.placeholder;
      // Remove linking and image fields that shouldn't be in numberedDropdown
      delete question.linking;
      delete question.image;
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
      // For conditional logic, we need to check if the source and target are in the same logical flow
      // Since we're processing questions in order, we can determine this by position
      const currentSection = parseInt(getSection(cell) || "1", 10);
      for (const edge of incomingEdges) {
        const sourceCell = edge.source;
        if (sourceCell && isOptions(sourceCell)) {
          // Find the parent question of this option node
          const optionIncoming = graph.getIncomingEdges(sourceCell) || [];
          for (const optEdge of optionIncoming) {
            const parentQ = optEdge.source;
            if (parentQ && isQuestion(parentQ)) {
              const sourceSection = parseInt(getSection(parentQ) || "1", 10);
              // Add conditional logic if the source section is the same or earlier than current section
              // Forward connections (earlier -> later) should use logic conditions
              // Backward connections (later -> earlier) should use jump logic
              if (sourceSection <= currentSection) {
                const prevQuestionId = parentQ._questionId || "";
                let optionLabel = sourceCell.value || "";
                // Clean HTML entities and tags from option text
                if (optionLabel) {
                  // First decode HTML entities
                  const textarea = document.createElement('textarea');
                  textarea.innerHTML = optionLabel;
                  let cleanedLabel = textarea.value;
                  // Then remove HTML tags
                  const temp = document.createElement("div");
                  temp.innerHTML = cleanedLabel;
                  cleanedLabel = temp.textContent || temp.innerText || cleanedLabel;
                  // Clean up extra whitespace
                  cleanedLabel = cleanedLabel.replace(/\s+/g, ' ').trim();
                  optionLabel = cleanedLabel;
                }
                conditions.push({
                  prevQuestion: String(prevQuestionId),
                  prevAnswer: optionLabel.trim()
                });
              }
            }
          }
        } else if (sourceCell && isQuestion(sourceCell)) {
          // This is a direct question-to-question connection
          const sourceSection = parseInt(getSection(sourceCell) || "1", 10);
          // Add conditional logic if the source section is the same or earlier than current section
          if (sourceSection <= currentSection) {
            // Check if the source is a multiple textbox/dropdown question or number question
            const sourceQuestionType = getQuestionType(sourceCell);
            if (sourceQuestionType === "multipleTextboxes" || sourceQuestionType === "multipleDropdownType" || sourceQuestionType === "number") {
              // For multiple textbox/dropdown/number questions, we need to find their parent condition
              const sourceParentCondition = findDirectParentCondition(sourceCell);
              if (sourceParentCondition) {
                if (Array.isArray(sourceParentCondition)) {
                  conditions.push(...sourceParentCondition);
                } else {
                  conditions.push(sourceParentCondition);
                }
              }
            } else {
              // Generic question-to-question connection means any answer from the source question
              // For fileUpload questions, use "uploaded a file" instead of "Any Text"
              const sourceQuestionType = getQuestionType(sourceCell);
              const answerText = sourceQuestionType === "fileUpload" ? "uploaded a file" : "Any Text";
              conditions.push({
                prevQuestion: String(sourceCell._questionId || ""),
                prevAnswer: answerText
              });
            }
          }
        } else if (sourceCell && typeof window.isFileNode === 'function' && window.isFileNode(sourceCell)) {
          // This is a connection from a file node to a question
          const sourceSection = parseInt(getSection(sourceCell) || "1", 10);
          // Add conditional logic if the source section is the same or earlier than current section
          if (sourceSection <= currentSection) {
            // File nodes should use "uploaded a file" as the answer text
            conditions.push({
              prevQuestion: String(sourceCell._questionId || ""),
              prevAnswer: "uploaded a file"
            });
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
    // --- PATCH: Add PDF Logic detection ---
    // Check if this question is connected to PDF nodes (directly or through options)
    const pdfs = [];
    const pdfConditions = [];
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        // Check for direct connection to PDF node
        if (targetCell && isPdfNode(targetCell)) {
          // This question is directly connected to a PDF node
          const pdfEntry = {
            pdfName: targetCell._pdfFile || targetCell._pdfUrl || "",
            pdfDisplayName: targetCell._pdfName || "",
            stripePriceId: targetCell._pdfPrice || targetCell._priceId || "",
            triggerOption: "" // For direct connections
          };
          pdfs.push(pdfEntry);
          // If this is a Big Paragraph question and the PDF node has a character limit
          if (questionType === "bigParagraph" && targetCell._characterLimit) {
            pdfConditions.push({
              characterLimit: parseInt(targetCell._characterLimit) || 0
            });
          } else {
            // For regular questions, use the same logic conditions as the question logic
            if (directParentCondition) {
              if (Array.isArray(directParentCondition)) {
                pdfConditions.push(...directParentCondition);
              } else {
                pdfConditions.push(directParentCondition);
              }
            }
          }
        }
        // Check for connection through options
        if (targetCell && isOptions(targetCell)) {
          // Check if this option leads to a PDF node
          const optionOutgoingEdges = graph.getOutgoingEdges(targetCell);
          if (optionOutgoingEdges) {
            for (const optionEdge of optionOutgoingEdges) {
              const pdfCell = optionEdge.target;
              if (pdfCell && isPdfNode(pdfCell)) {
                // This question's option leads to a PDF node
                const pdfEntry = {
                  pdfName: pdfCell._pdfFile || pdfCell._pdfUrl || "",
                  pdfDisplayName: pdfCell._pdfName || "",
                  stripePriceId: pdfCell._pdfPrice || pdfCell._priceId || "",
                  triggerOption: "" // Will be set below
                };
                // Extract the option text
                let optionText = targetCell.value || "";
                // Clean HTML from option text
                if (optionText) {
                  const temp = document.createElement("div");
                  temp.innerHTML = optionText;
                  optionText = temp.textContent || temp.innerText || optionText;
                  optionText = optionText.trim();
                }
                pdfEntry.triggerOption = optionText;
                pdfs.push(pdfEntry);
                // Add condition for this option
                pdfConditions.push({
                  prevQuestion: String(cell._questionId || ""),
                  prevAnswer: optionText
                });
              }
            }
          }
        }
      }
    }
    // Set up the PDF logic structure
    if (pdfs.length > 0) {
      question.pdfLogic.enabled = true;
      question.pdfLogic.conditions = pdfConditions;
      question.pdfLogic.pdfs = pdfs;
    }
    // --- END PDF Logic PATCH ---
    // --- PATCH: Add PDF Preview detection ---
    // Check if any option is connected to a PDF preview node
    if (exportType === "dropdown" && outgoingEdges) {
      for (const edge of outgoingEdges) {
        const optionCell = edge.target;
        if (optionCell && isOptions(optionCell)) {
          // Check if this option leads to a PDF preview node
          const optionOutgoingEdges = graph.getOutgoingEdges(optionCell);
          if (optionOutgoingEdges) {
            for (const optionEdge of optionOutgoingEdges) {
              const pdfPreviewCell = optionEdge.target;
              if (pdfPreviewCell && typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(pdfPreviewCell)) {
                // This question's option leads to a PDF preview node
                // Extract the option text
                let optionText = optionCell.value || "";
                // Clean HTML from option text
                if (optionText) {
                  const temp = document.createElement("div");
                  temp.innerHTML = optionText;
                  optionText = temp.textContent || temp.innerText || optionText;
                  optionText = optionText.trim();
                }
                // Get PDF preview properties
                const previewTitle = pdfPreviewCell._pdfPreviewTitle || "";
                const previewFile = pdfPreviewCell._pdfPreviewFile || "";
                // If filename is not set, default to file value
                const previewFilename = pdfPreviewCell._pdfPreviewFilename || previewFile || "";
                const previewPriceId = pdfPreviewCell._pdfPreviewPriceId || "";
                let previewAttachment = pdfPreviewCell._pdfPreviewAttachment || "Preview Only";
                // Normalize attachment value (handle old "Attach To Packet" format)
                if (previewAttachment === "Attach To Packet") {
                  previewAttachment = "Attach to packet";
                }
                // Set PDF preview properties (order: priceId, attachment, filename)
                question.pdfPreview.enabled = true;
                question.pdfPreview.trigger = optionText;
                question.pdfPreview.title = previewTitle;
                question.pdfPreview.file = previewFile;
                question.pdfPreview.priceId = previewPriceId;
                question.pdfPreview.attachment = previewAttachment;
                question.pdfPreview.filename = previewFilename;
                // Only one PDF preview per question, so break after finding one
                break;
              } else if (pdfPreviewCell && typeof window.isLatexPdfPreviewNode === 'function' && window.isLatexPdfPreviewNode(pdfPreviewCell)) {
                // This question's option leads to a Latex PDF preview node
                // Extract the option text
                let optionText = optionCell.value || "";
                // Clean HTML from option text
                if (optionText) {
                  const temp = document.createElement("div");
                  temp.innerHTML = optionText;
                  optionText = temp.textContent || temp.innerText || optionText;
                  optionText = optionText.trim();
                }
                // Get Latex PDF preview properties
                const previewTitle = pdfPreviewCell._pdfPreviewTitle || "";
                const previewContent = pdfPreviewCell._pdfPreviewFile || "";
                const previewFilename = pdfPreviewCell._pdfPreviewFilename || "";
                const previewPriceId = pdfPreviewCell._pdfPreviewPriceId || "";
                let previewAttachment = pdfPreviewCell._pdfPreviewAttachment || "Preview Only";
                // Normalize attachment value (handle old "Attach To Packet" format)
                if (previewAttachment === "Attach To Packet") {
                  previewAttachment = "Attach to packet";
                }
                // Set Latex PDF preview properties
                question.latexPreview.enabled = true;
                question.latexPreview.trigger = optionText;
                question.latexPreview.title = previewTitle;
                question.latexPreview.content = previewContent;
                question.latexPreview.filename = previewFilename;
                question.latexPreview.priceId = previewPriceId;
                question.latexPreview.attachment = previewAttachment;
                // Only one Latex preview per question, so break after finding one
                break;
              }
            }
          }
        }
        // Break outer loop if PDF preview or Latex preview was found
        if (question.pdfPreview.enabled || question.latexPreview.enabled) {
          break;
        }
      }
    }
    // --- END PDF Preview PATCH ---
    // --- PATCH: Add Alert Logic detection ---
    // Check if this question is connected to an alert node through its options
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const optionCell = edge.target;
        if (optionCell && isOptions(optionCell)) {
          // Check if this option leads to an alert node
          const optionOutgoingEdges = graph.getOutgoingEdges(optionCell);
          if (optionOutgoingEdges) {
            for (const optionEdge of optionOutgoingEdges) {
              const targetCell = optionEdge.target;
              if (targetCell && isAlertNode(targetCell)) {
                // This question's option leads to an alert node
                question.alertLogic.enabled = true;
                // Extract alert text from the alert node's HTML content
                let alertText = "";
                // First, try the _questionText property (most current user-entered text)
                if (targetCell._questionText) {
                  alertText = targetCell._questionText;
                }
                // If no _questionText, try _alertText
                else if (targetCell._alertText) {
                  alertText = targetCell._alertText;
                }
                // If no stored properties, try to extract from the HTML input field
                else if (targetCell.value) {
                  const temp = document.createElement("div");
                  temp.innerHTML = targetCell.value;
                  const input = temp.querySelector('input[type="text"]');
                  if (input) {
                    alertText = input.value || input.getAttribute('value') || "";
                  }
                }
                // Clean up the alert text (remove any HTML entities or extra whitespace)
                if (alertText) {
                  alertText = alertText.replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&quot;/g, '"')
                                    .replace(/&#39;/g, "'")
                                    .trim();
                }
                // Keep message empty at top level
                question.alertLogic.message = "";
                // Extract the option text
                let optionText = optionCell.value || "";
                // Clean HTML from option text
                if (optionText) {
                  const temp = document.createElement("div");
                  temp.innerHTML = optionText;
                  optionText = temp.textContent || temp.innerText || optionText;
                  optionText = optionText.trim();
                }
                question.alertLogic.conditions = [{
                  prevQuestion: String(cell._questionId || ""),
                  prevAnswer: optionText,
                  message: alertText || ""
                }];
                break; // Only process the first alert connection
              }
            }
          }
        }
      }
    }
    // --- END Alert Logic PATCH ---
    // --- PATCH: Add Currency Alert Logic ---
    if (questionType === "currency" && cell._currencyAlerts && Array.isArray(cell._currencyAlerts)) {
      const enabledAlerts = cell._currencyAlerts.filter(alert => alert && alert.enabled);
      if (enabledAlerts.length > 0) {
        question.alertLogic.enabled = true;
        if (!question.alertLogic.message) {
          question.alertLogic.message = "";
        }
        const existingConditions = Array.isArray(question.alertLogic.conditions)
          ? question.alertLogic.conditions
          : [];
        enabledAlerts.forEach(alert => {
          const amountNum = parseFloat(alert.amount);
          existingConditions.push({
            prevQuestion: String(cell._questionId || ""),
            operator: alert.operator || ">",
            amount: Number.isNaN(amountNum) ? alert.amount : amountNum,
            isCurrency: true,
            message: alert.title || "",
            statusRequirements: Array.isArray(alert.statusRequirements)
              ? alert.statusRequirements.slice()
              : []
          });
        });
        question.alertLogic.conditions = existingConditions;
      }
    }
    // --- END Currency Alert Logic PATCH ---
    // --- PATCH: Add Status detection ---
    // Check if this question is connected to a status node through its options
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const optionCell = edge.target;
        if (optionCell && isOptions(optionCell)) {
          // Check if this option leads to a status node
          const optionOutgoingEdges = graph.getOutgoingEdges(optionCell);
          if (optionOutgoingEdges) {
            for (const optionEdge of optionOutgoingEdges) {
              const targetCell = optionEdge.target;
              if (targetCell && isStatusNode(targetCell)) {
                // This question's option leads to a status node
                question.status.enabled = true;
                // Extract status text from the status node
                let statusText = "";
                // First, try the value property (most common)
                if (targetCell.value) {
                  statusText = targetCell.value;
                  // Clean HTML from status text if it's HTML
                  if (statusText && statusText.includes('<')) {
                    const temp = document.createElement("div");
                    temp.innerHTML = statusText;
                    statusText = temp.textContent || temp.innerText || statusText;
                  }
                  statusText = statusText.trim();
                }
                // Clean up the status text (remove any HTML entities or extra whitespace)
                if (statusText) {
                  statusText = statusText.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                }
                question.status.title = statusText || "Status";
                // Extract the option text
                let optionText = optionCell.value || "";
                // Clean HTML from option text
                if (optionText) {
                  const temp = document.createElement("div");
                  temp.innerHTML = optionText;
                  optionText = temp.textContent || temp.innerText || optionText;
                  optionText = optionText.trim();
                }
                question.status.trigger = optionText || "";
                break; // Only process the first status connection
              }
            }
          }
        }
      }
    }
    // --- END Status PATCH ---
    // --- PATCH: Add Hard Alert detection ---
    // Helper function to find hard alert nodes directly connected to an option (no traversal through other questions)
    const findHardAlertFromOption = (optionCell, visited = new Set()) => {
      if (!optionCell || visited.has(optionCell.id)) {
        return null;
      }
      visited.add(optionCell.id);
      
      // Check if this option directly leads to a hard alert node
      const optionOutgoingEdges = graph.getOutgoingEdges(optionCell);
      if (optionOutgoingEdges) {
        for (const optionEdge of optionOutgoingEdges) {
          const targetCell = optionEdge.target;
          if (targetCell) {
            // If it's directly a hard alert node, return it
            if (isHardAlertNode(targetCell)) {
              return targetCell;
            }
            // If it's another question, DON'T traverse through it - stop here
            // We only want hard alerts directly connected to this specific option
            if (isQuestion(targetCell)) {
              continue;
            }
            // If it's another option (maybe leading to a hard alert), check that
            // But only go one level deep to avoid false positives
            if (isOptions(targetCell) && !visited.has(targetCell.id)) {
              const nextOutgoingEdges = graph.getOutgoingEdges(targetCell);
              if (nextOutgoingEdges) {
                for (const nextEdge of nextOutgoingEdges) {
                  const nextTarget = nextEdge.target;
                  if (nextTarget && isHardAlertNode(nextTarget)) {
                    return nextTarget;
                  }
                }
              }
            }
          }
        }
      }
      
      return null;
    };
    
    // Check if this question is connected to a hard alert node through its options
    // Only check direct connections (option → hard alert or option → option → hard alert)
    // Don't traverse through other questions to avoid false positives
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const optionCell = edge.target;
        if (optionCell && isOptions(optionCell)) {
          // Find hard alert directly connected to this specific option
          const hardAlertNode = findHardAlertFromOption(optionCell, new Set());
          if (hardAlertNode) {
            // This question's option leads directly to a hard alert node
            question.hardAlert.enabled = true;
            // Extract hard alert text from the hard alert node's HTML content
            let hardAlertText = "";
            // First, try the _questionText property (most current user-entered text)
            if (hardAlertNode._questionText) {
              hardAlertText = hardAlertNode._questionText;
            }
            // If no _questionText, try _hardAlertText
            else if (hardAlertNode._hardAlertText) {
              hardAlertText = hardAlertNode._hardAlertText;
            }
            // If no stored properties, try to extract from the HTML input field
            else if (hardAlertNode.value) {
              const temp = document.createElement("div");
              temp.innerHTML = hardAlertNode.value;
              const input = temp.querySelector('input[type="text"]');
              if (input) {
                hardAlertText = input.value || input.getAttribute('value') || "";
              }
            }
            // Clean up the hard alert text (remove any HTML entities or extra whitespace)
            if (hardAlertText) {
              hardAlertText = hardAlertText.replace(/&amp;/g, '&')
                                .replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>')
                                .replace(/&quot;/g, '"')
                                .replace(/&#39;/g, "'")
                                .trim();
            }
            question.hardAlert.title = hardAlertText || "";
            // Extract the option text - this is the option that leads to the hard alert
            let optionText = optionCell.value || "";
            // Clean HTML from option text
            if (optionText) {
              const temp = document.createElement("div");
              temp.innerHTML = optionText;
              optionText = temp.textContent || temp.innerText || optionText;
              optionText = optionText.trim();
            }
            question.hardAlert.trigger = optionText || "";
            break; // Only process the first hard alert connection
          }
        }
      }
    }
    // --- END Hard Alert PATCH ---
    // --- PATCH: Add Subtitle detection ---
    // Check if this question is connected to a subtitle node
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        // Check for direct connection to subtitle node
        if (targetCell && typeof window.isSubtitleNode === 'function' && window.isSubtitleNode(targetCell)) {
          // This question is directly connected to a subtitle node
          question.subtitle.enabled = true;
          // Extract subtitle text from the subtitle node
          let subtitleText = "";
          // First, try the _subtitleText property (most current user-entered text)
          if (targetCell._subtitleText) {
            subtitleText = targetCell._subtitleText;
          }
          // If no _subtitleText, try to extract from the HTML content
          else if (targetCell.value) {
            const temp = document.createElement("div");
            temp.innerHTML = targetCell.value;
            subtitleText = temp.textContent || temp.innerText || targetCell.value;
            subtitleText = subtitleText.trim();
          }
          // Clean up the subtitle text (remove any HTML entities or extra whitespace)
          if (subtitleText) {
            subtitleText = subtitleText.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
          }
          question.subtitle.text = subtitleText || "Subtitle text";
          break; // Only process the first subtitle connection
        }
        // Check for connection through options
        if (targetCell && isOptions(targetCell)) {
          // Check if this option leads to a subtitle node
          const optionOutgoingEdges = graph.getOutgoingEdges(targetCell);
          if (optionOutgoingEdges) {
            for (const optionEdge of optionOutgoingEdges) {
              const subtitleCell = optionEdge.target;
              if (subtitleCell && typeof window.isSubtitleNode === 'function' && window.isSubtitleNode(subtitleCell)) {
                // This question's option leads to a subtitle node
                question.subtitle.enabled = true;
                // Extract subtitle text from the subtitle node
                let subtitleText = "";
                // First, try the _subtitleText property (most current user-entered text)
                if (subtitleCell._subtitleText) {
                  subtitleText = subtitleCell._subtitleText;
                }
                // If no _subtitleText, try to extract from the HTML content
                else if (subtitleCell.value) {
                  const temp = document.createElement("div");
                  temp.innerHTML = subtitleCell.value;
                  subtitleText = temp.textContent || temp.innerText || subtitleCell.value;
                  subtitleText = subtitleText.trim();
                }
                // Clean up the subtitle text (remove any HTML entities or extra whitespace)
                if (subtitleText) {
                  subtitleText = subtitleText.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                }
                question.subtitle.text = subtitleText || "Subtitle text";
                break; // Only process the first subtitle connection
              }
            }
          }
        }
      }
    }
    // --- END Subtitle PATCH ---
    sectionMap[section].questions.push(question);
  }
  
  // --- PATCH: Add File Node detection and export ---
  // Collect all file nodes that are connected through options
  const fileNodeMap = new Map(); // Map of fileNode -> { sourceQuestion, sourceOption, fileNode }
  for (const cell of questions) {
    const outgoingEdges = graph.getOutgoingEdges(cell);
    if (outgoingEdges) {
      for (const edge of outgoingEdges) {
        const optionCell = edge.target;
        if (optionCell && isOptions(optionCell)) {
          const optionOutgoingEdges = graph.getOutgoingEdges(optionCell);
          if (optionOutgoingEdges) {
            for (const optionEdge of optionOutgoingEdges) {
              const fileNode = optionEdge.target;
              if (fileNode && typeof window.isFileNode === 'function' && window.isFileNode(fileNode)) {
                // Extract option text
                let optionText = optionCell.value || "";
                if (optionText) {
                  const temp = document.createElement("div");
                  temp.innerHTML = optionText;
                  optionText = temp.textContent || temp.innerText || optionText;
                  optionText = optionText.trim();
                }
                // Store file node info
                if (!fileNodeMap.has(fileNode.id)) {
                  fileNodeMap.set(fileNode.id, {
                    fileNode: fileNode,
                    sourceQuestion: cell,
                    sourceOption: optionText
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Export file nodes as fileUpload questions
  for (const [fileNodeId, fileNodeInfo] of fileNodeMap) {
    const fileNode = fileNodeInfo.fileNode;
    const sourceQuestion = fileNodeInfo.sourceQuestion;
    const sourceOption = fileNodeInfo.sourceOption;
    
    // Get the source question's ID
    const sourceQuestionId = sourceQuestion._questionId || "";
    
    // Determine section for file node (use same section as source question, or default to 1)
    let fileNodeSection = getSection(sourceQuestion) || getSection(fileNode) || "1";
    const isFirstQuestion = questions.every(otherCell => 
      otherCell === fileNode || fileNode.geometry.y <= otherCell.geometry.y
    );
    if (isFirstQuestion && fileNodeSection !== "1") {
      fileNodeSection = "1";
    }
    
    // Ensure section exists
    if (!sectionMap[fileNodeSection]) {
      let sectionName = `Section ${fileNodeSection}`;
      if (currentSectionPrefs[fileNodeSection] && currentSectionPrefs[fileNodeSection].name) {
        sectionName = currentSectionPrefs[fileNodeSection].name;
        if (sectionName === "Enter section name" || sectionName === "Enter Name") {
          sectionName = `Section ${fileNodeSection}`;
        }
      }
      sectionMap[fileNodeSection] = {
        sectionId: parseInt(fileNodeSection),
        sectionName: sectionName,
        questions: []
      };
    }
    
    // Create fileUpload question
    // Use the file node's _questionId if available, otherwise use and increment questionCounter
    const fileUploadQuestionId = fileNode._questionId || questionCounter;
    if (!fileNode._questionId) {
      questionCounter++;
    }
    const fileUploadQuestion = {
      questionId: fileUploadQuestionId,
      text: "", // File upload questions have empty text
      type: "fileUpload",
      logic: {
        enabled: sourceQuestionId ? true : false,
        conditions: sourceQuestionId ? [{
          prevQuestion: sourceQuestionId.toString(),
          prevAnswer: sourceOption
        }] : []
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
      hiddenLogic: {
        enabled: false,
        configs: []
      },
      pdfLogic: {
        enabled: false,
        conditions: [],
        pdfs: []
      },
      alertLogic: {
        enabled: false,
        message: "",
        conditions: []
      },
      checklistLogic: {
        enabled: false,
        conditions: []
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
      pdfPreview: {
        enabled: false,
        trigger: "",
        title: "",
        file: "",
        priceId: "",
        attachment: "Preview Only",
        filename: ""
      },
      latexPreview: {
        enabled: false,
        trigger: "",
        title: "",
        filename: "",
        content: "",
        priceId: "",
        attachment: "Preview Only"
      },
      status: {
        enabled: false,
        trigger: "",
        title: ""
      },
      hardAlert: {
        enabled: false,
        trigger: "",
        title: ""
      },
      options: [],
      labels: [],
      uploadTitle: fileNode._pdfPreviewTitle || "",
      fileTitle: fileNode._pdfPreviewFilename || "",
      linking: {
        enabled: false,
        targetId: ""
      }
    };
    
    sectionMap[fileNodeSection].questions.push(fileUploadQuestion);
  }
  // --- END File Node PATCH ---
  
  // Create a map of questions by their clean names for calculation lookups
  const questionNameMap = new Map();
  questions.forEach(questionCell => {
    const cleanName = questionCell._questionText || questionCell.value || "";
    const nodeId = sanitizeNameId((typeof window.getNodeId === 'function' ? window.getNodeId(questionCell) : '') || questionCell._nameId || questionCell._questionText || questionCell.value || "unnamed");
    // Use the sanitized version of the clean name as the key to match calculation term processing
    const sanitizedCleanName = sanitizeNameId(cleanName);
    questionNameMap.set(sanitizedCleanName.toLowerCase().trim(), nodeId);
  });
  // Process calculation nodes and convert them to hidden fields
  const calculationNodes = vertices.filter(cell => typeof window.isCalculationNode === 'function' && window.isCalculationNode(cell));
  for (const cell of calculationNodes) {
    // Skip if this calculation node doesn't have the required properties
    if (!cell._calcTitle || !cell._calcTerms || cell._calcTerms.length === 0) {
      continue;
    }
    // Create hidden field for calculation node
    const hiddenField = {
      hiddenFieldId: hiddenFieldCounter.toString(),
      type: cell._calcFinalOutputType === "checkbox" ? "checkbox" : "text",
      name: cell._calcTitle,
      checked: cell._calcFinalCheckboxChecked || false,
      conditions: [],
      calculations: []
    };
    // Convert calculation terms to the expected format for both checkbox and text types
    const calculation = {
      terms: [],
      compareOperator: cell._calcOperator || "=",
      threshold: cell._calcThreshold || "0",
      fillValue: cell._calcFinalText || ""
    };
    // Process each calculation term
    console.log('[GUI JSON] Processing calculation terms for cell:', cell._calcTitle);
    for (let termIndex = 0; termIndex < cell._calcTerms.length; termIndex++) {
      const term = cell._calcTerms[termIndex];
      if (term.amountLabel) {
        console.log('[GUI JSON] Processing term', termIndex, ':', term.amountLabel, 'mathOperator:', term.mathOperator);
        let questionNameId = term.amountLabel;
        
        // Handle numbered_dropdown format: numbered_dropdown:questionName_amountName_#N:displayName
        if (term.amountLabel.startsWith('numbered_dropdown:')) {
          const parts = term.amountLabel.split(':');
          if (parts.length >= 3) {
            const storedValue = parts[1]; // e.g., "how_many_sources_of_income_do_you_have_amount_1"
            console.log('[GUI JSON] Found numbered_dropdown, storedValue:', storedValue);
            
            // Extract question ID, entry number, and amount name from storedValue
            // Format: questionName_amountName_#N
            // Need to find the question that matches this
            const storedParts = storedValue.split('_');
            // Find the question by matching the beginning of storedValue
            let matchedQuestion = null;
            let entryNumber = null;
            let amountName = null;
            
            // Search through questions to find the matching numberedDropdown
            for (const questionCell of questions) {
              const qType = getQuestionType(questionCell);
              if (qType === "multipleDropdownType") {
                const questionText = questionCell._questionText || questionCell.value || "";
                const cleanQuestionName = sanitizeNameId(questionText);
                // Check if storedValue starts with this question name
                if (storedValue.startsWith(cleanQuestionName + '_')) {
                  matchedQuestion = questionCell;
                  // Extract entry number and amount name
                  // storedValue format: cleanQuestionName_amountName_#N
                  const remainder = storedValue.substring(cleanQuestionName.length + 1); // Remove question name and _
                  // Find the last underscore which separates amount name from number
                  const lastUnderscoreIndex = remainder.lastIndexOf('_');
                  if (lastUnderscoreIndex !== -1) {
                    amountName = remainder.substring(0, lastUnderscoreIndex); // e.g., "amount"
                    entryNumber = remainder.substring(lastUnderscoreIndex + 1); // e.g., "1"
                    console.log('[GUI JSON] Extracted from storedValue:', { remainder, amountName, entryNumber, questionId: matchedQuestion._questionId });
                  }
                  break;
                }
              }
            }
            
            if (matchedQuestion && entryNumber && amountName) {
              // Get the actual nodeId from the matched question (includes _dupN suffixes)
              const actualNodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(matchedQuestion) : '') || 
                                   matchedQuestion._nameId || 
                                   sanitizeNameId(matchedQuestion._questionText || matchedQuestion.value || "");
              // Format: {nodeId}_{amountName}_{entryNumber}
              // e.g., "how_many_sources_of_income_do_you_have_income_value_1"
              // or "how_many_sources_of_income_do_you_have_dup2_income_value_1"
              questionNameId = `${actualNodeId}_${amountName}_${entryNumber}`;
              console.log('[GUI JSON] Converted numbered_dropdown to questionNameId:', questionNameId);
            } else {
              console.warn('[GUI JSON] Could not match numbered_dropdown storedValue:', storedValue);
              // Fallback: try to extract from storedValue directly
              // Look for pattern: ..._amountName_#N at the end
              const match = storedValue.match(/^(.+?)_([^_]+)_(\d+)$/);
              if (match) {
                const questionId = matchedQuestion ? (matchedQuestion._questionId || "") : "";
                if (questionId) {
                  questionNameId = `amount${questionId}_${match[3]}_${match[2]}`;
                  console.log('[GUI JSON] Fallback extraction:', questionNameId);
                }
              }
            }
          }
        } else if (term.amountLabel.startsWith('question_value:')) {
          // Handle question_value format: question_value:answer1:how_much (answer1)
          const parts = term.amountLabel.split(':');
          if (parts.length >= 3) {
            const displayPart = parts[2];
            // Remove the "(answer1)" part if it exists
            const cleanQuestionName = displayPart.replace(/\s*\([^)]*\)$/, '');
            questionNameId = parts[1]; // Use the actual answer ID (e.g., "answer1")
          }
        } else {
          // For regular labels, use as-is
          questionNameId = term.amountLabel;
        }
        
        // Determine operator: first term should have empty operator, others should default to "+" if not set
        let operator = term.mathOperator || "";
        if (termIndex > 0 && !operator) {
          operator = "+"; // Default to "+" for terms after the first
        }
        
        console.log('[GUI JSON] Final term:', { operator, questionNameId });
        calculation.terms.push({
          operator: operator,
          questionNameId: questionNameId
        });
      }
    }
    // Only add the calculation if it has terms
    if (calculation.terms.length > 0) {
      hiddenField.calculations.push(calculation);
      hiddenFields.push(hiddenField);
      hiddenFieldCounter++;
    }
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
  // Calculate the maximum question ID found
  let maxQuestionId = 0;
  for (const section of sections) {
    for (const question of section.questions) {
      const questionId = parseInt(question.questionId) || 0;
      if (questionId > maxQuestionId) {
        maxQuestionId = questionId;
      }
    }
  }
  // Update questionCounter to be the next available question ID
  questionCounter = maxQuestionId + 1;
  // Get default PDF properties
  const defaultPdfProps = typeof window.getDefaultPdfProperties === 'function' ? 
    window.getDefaultPdfProperties() : { pdfName: "", pdfFile: "", pdfPrice: "" };
  // Get form name
  const formName = document.getElementById('formNameInput')?.value || 'Example Form';
  // Process Linked Logic nodes for linkedFields
  const linkedFields = [];
  const linkedLogicNodes = vertices.filter(cell => 
    typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)
  );
  linkedLogicNodes.forEach((cell, index) => {
    if (cell._linkedLogicNodeId && cell._linkedFields && cell._linkedFields.length > 0) {
      // Process linked fields to convert spaces to underscores while preserving PDF prefix
      let processedFields = cell._linkedFields.map(field => {
        // Convert all spaces to underscores in the field name
        return field.replace(/\s+/g, '_');
      });
      
      // Extract the entry number from linkedFieldId (e.g., "income_value_1" -> "1", "income_value_2" -> "2")
      const linkedFieldId = cell._linkedLogicNodeId;
      const entryNumberMatch = linkedFieldId.match(/_(\d+)$/);
      if (entryNumberMatch) {
        const expectedEntryNumber = entryNumberMatch[1];
        // Correct any fields that have the wrong entry number
        processedFields = processedFields.map(field => {
          // Check if field ends with a number that doesn't match the expected entry number
          const fieldNumberMatch = field.match(/_(\d+)$/);
          if (fieldNumberMatch) {
            const fieldEntryNumber = fieldNumberMatch[1];
            // If the entry number doesn't match, replace it with the correct one
            if (fieldEntryNumber !== expectedEntryNumber) {
              return field.replace(/_(\d+)$/, `_${expectedEntryNumber}`);
            }
          }
          return field;
        });
      }
      
      const linkedFieldEntry = {
        id: `linkedField${index}`,
        linkedFieldId: cell._linkedLogicNodeId,
        fields: processedFields
      };
      linkedFields.push(linkedFieldEntry);
    } else {
    }
  });
  // Process linked checkbox nodes from flowchart editor
  const linkedCheckboxes = [];
  const linkedCheckboxNodes = vertices.filter(cell => 
    typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(cell)
  );
  
  // Build a map of all possible checkbox option nodeIds (with entry numbers) from numbered dropdown questions
  const checkboxOptionNodeIdMap = new Map();
  const numberedDropdownNodes = vertices.filter(cell => {
    return cell.style && cell.style.includes('nodeType=question') && 
           cell.style.includes('questionType=multipleDropdownType');
  });
  numberedDropdownNodes.forEach(node => {
    if (node._checkboxes && Array.isArray(node._checkboxes)) {
      const isNumberedDropdown = node.style && node.style.includes('questionType=multipleDropdownType');
      const firstNumber = isNumberedDropdown ? (parseInt(node._twoNumbers?.first) || 1) : null;
      const secondNumber = isNumberedDropdown ? (parseInt(node._twoNumbers?.second) || 1) : null;
      node._checkboxes.forEach(checkbox => {
        if (checkbox.options && Array.isArray(checkbox.options)) {
          checkbox.options.forEach(option => {
            if (option.nodeId) {
              if (isNumberedDropdown && firstNumber !== null && secondNumber !== null) {
                // Generate numbered versions
                for (let num = firstNumber; num <= secondNumber; num++) {
                  const numberedNodeId = `${option.nodeId}_${num}`;
                  // Store both the full nodeId and a version without "how_" prefix for lookup
                  checkboxOptionNodeIdMap.set(numberedNodeId, numberedNodeId);
                  // Also create a lookup key without "how_" if it starts with "how_"
                  if (numberedNodeId.startsWith('how_')) {
                    const withoutHow = numberedNodeId.substring(4); // Remove "how_"
                    checkboxOptionNodeIdMap.set(withoutHow, numberedNodeId);
                  }
                }
              }
            }
          });
        }
      });
    }
  });
  
  linkedCheckboxNodes.forEach((cell, index) => {
    if (cell._linkedCheckboxNodeId && cell._linkedCheckboxOptions && cell._linkedCheckboxOptions.length > 0) {
      // Fix stored checkbox option nodeIds that might be missing "how_" prefix
      const correctedCheckboxes = cell._linkedCheckboxOptions.map(storedValue => {
        // If the stored value exists in the map, use it
        if (checkboxOptionNodeIdMap.has(storedValue)) {
          return checkboxOptionNodeIdMap.get(storedValue);
        }
        // If the stored value doesn't exist but a version with "how_" prefix does, use that
        const withHowPrefix = `how_${storedValue}`;
        if (checkboxOptionNodeIdMap.has(withHowPrefix)) {
          return checkboxOptionNodeIdMap.get(withHowPrefix);
        }
        // Otherwise, return the stored value as-is
        return storedValue;
      });
      
      const linkedCheckboxEntry = {
        id: `linkedCheckbox${index}`,
        linkedCheckboxId: cell._linkedCheckboxNodeId,
        checkboxes: correctedCheckboxes
      };
      linkedCheckboxes.push(linkedCheckboxEntry);
    } else {
    }
  });
  // Process inverse checkbox nodes from flowchart editor
  const inverseCheckboxes = [];
  const inverseCheckboxNodes = vertices.filter(cell => 
    typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)
  );
  let inverseCheckboxCounter = 1; // Start at 1
  inverseCheckboxNodes.forEach((cell) => {
    if (cell._inverseCheckboxNodeId && cell._inverseCheckboxOption) {
      // Single entry with inverseCheckboxId and targetCheckboxId
      const inverseCheckboxEntry = {
        id: `inverseCheckbox${inverseCheckboxCounter}`,
        inverseCheckboxId: cell._inverseCheckboxNodeId,
        targetCheckboxId: cell._inverseCheckboxOption
      };
      inverseCheckboxes.push(inverseCheckboxEntry);
      inverseCheckboxCounter++;
    }
  });
  // Create final output object
  const output = {
    sections: sections,
    groups: getGroupsData(),
    hiddenFields: hiddenFields,
    sectionCounter: sectionCounter,
    questionCounter: questionCounter,
    hiddenFieldCounter: hiddenFieldCounter,
    groupCounter: 1,
    formName: formName,
    defaultPDFName: defaultPdfProps.pdfName || "",
    pdfOutputName: defaultPdfProps.pdfFile || "",
    stripePriceId: defaultPdfProps.pdfPrice || "",
    additionalPDFs: [],
    checklistItems: [],
    linkedFields: linkedFields,
    linkedCheckboxes: [
      // Linked checkboxes from GUI editor (window.linkedCheckboxesConfig)
      ...(window.linkedCheckboxesConfig || []).map(c => ({
        id: c.id,
        linkedCheckboxId: c.linkedCheckboxId,
        checkboxes: c.checkboxes
      })),
      // Linked checkboxes from flowchart editor (linkedCheckboxNodes)
      ...linkedCheckboxes
    ],
    inverseCheckboxes: inverseCheckboxes
  };
  // Convert to string and download
  const jsonStr = JSON.stringify(output, null, 2);
  // Copy to clipboard
  navigator.clipboard.writeText(jsonStr).then(() => {
    // Show user feedback
    const notification = document.createElement('div');
    notification.textContent = 'GUI JSON copied to clipboard!';
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
    document.body.appendChild(notification);
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }).catch(err => {
  });
  if (download) {
    downloadJson(jsonStr, "gui.json");
  }
  return jsonStr;
};
// Export both flowchart and GUI JSON in a combined format
window.exportBothJson = function() {
  try {
    // Automatically reset PDF inheritance and Node IDs before export
    // CORRECT ORDER: PDF inheritance first, then Node IDs (so Node IDs can use correct PDF names)
    // Reset PDF inheritance for all nodes FIRST
    if (typeof window.resetAllPdfInheritance === 'function') {
      window.resetAllPdfInheritance();
    }
    // Reset all Node IDs SECOND (after PDF inheritance is fixed)
    if (typeof resetAllNodeIds === 'function') {
      resetAllNodeIds();
    }
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
      if (cell._textboxes) {
        cellData._textboxes = JSON.parse(JSON.stringify(cell._textboxes));
      }
      if (cell._questionText) cellData._questionText = cell._questionText;
      if (cell._twoNumbers) cellData._twoNumbers = cell._twoNumbers;
      if (cell._dropdownTitle) cellData._dropdownTitle = cell._dropdownTitle;
      if (cell._nameId) cellData._nameId = cell._nameId;
      if (cell._placeholder) cellData._placeholder = cell._placeholder;
      if (cell._questionId) cellData._questionId = cell._questionId;
      // textbox properties
      if (cell._amountName) cellData._amountName = cell._amountName;
      if (cell._amountPlaceholder) cellData._amountPlaceholder = cell._amountPlaceholder;
      // image option
      if (cell._image) cellData._image = cell._image;
      // PDF node properties
      if (cell._pdfName !== undefined) cellData._pdfName = cell._pdfName;
      if (cell._pdfFile !== undefined) cellData._pdfFile = cell._pdfFile;
      if (cell._pdfPrice !== undefined) cellData._pdfPrice = cell._pdfPrice;
      // PDF preview node properties - always include if the node is a PDF preview node
      if ((typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) ||
          (typeof window.isLatexPdfPreviewNode === 'function' && window.isLatexPdfPreviewNode(cell))) {
        cellData._pdfPreviewTitle = cell._pdfPreviewTitle !== undefined ? cell._pdfPreviewTitle : "";
        cellData._pdfPreviewFile = cell._pdfPreviewFile !== undefined ? cell._pdfPreviewFile : "";
        // Include Filename, Price ID and Attachment for both PDF Preview and LaTeX Preview nodes
        cellData._pdfPreviewFilename = cell._pdfPreviewFilename !== undefined ? cell._pdfPreviewFilename : "";
        cellData._pdfPreviewPriceId = cell._pdfPreviewPriceId !== undefined ? cell._pdfPreviewPriceId : "";
        cellData._pdfPreviewAttachment = cell._pdfPreviewAttachment !== undefined ? cell._pdfPreviewAttachment : "Preview Only";
      } else if (cell._pdfPreviewTitle !== undefined) {
        // Include even if not a PDF preview node (for backward compatibility)
        cellData._pdfPreviewTitle = cell._pdfPreviewTitle;
      }
      if (cell._pdfPreviewFile !== undefined) {
        cellData._pdfPreviewFile = cell._pdfPreviewFile;
      }
      if (cell._pdfPreviewFilename !== undefined) {
        cellData._pdfPreviewFilename = cell._pdfPreviewFilename;
      }
      if (cell._pdfPreviewPriceId !== undefined) {
        cellData._pdfPreviewPriceId = cell._pdfPreviewPriceId;
      }
      if (cell._pdfPreviewAttachment !== undefined) {
        cellData._pdfPreviewAttachment = cell._pdfPreviewAttachment;
      }
      // Final verification for PDF preview nodes
      if (typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) {
      }
      if (cell._pdfLogicEnabled !== undefined) cellData._pdfLogicEnabled = cell._pdfLogicEnabled;
      if (cell._pdfTriggerLimit !== undefined) cellData._pdfTriggerLimit = cell._pdfTriggerLimit;
      if (cell._bigParagraphPdfName !== undefined) cellData._bigParagraphPdfName = cell._bigParagraphPdfName;
      if (cell._bigParagraphPdfFile !== undefined) cellData._bigParagraphPdfFile = cell._bigParagraphPdfFile;
      if (cell._bigParagraphPdfPrice !== undefined) cellData._bigParagraphPdfPrice = cell._bigParagraphPdfPrice;
      // calculation node properties
      if (cell._calcTitle !== undefined) cellData._calcTitle = cell._calcTitle;
      if (cell._calcAmountLabel !== undefined) cellData._calcAmountLabel = cell._calcAmountLabel;
      if (cell._calcOperator !== undefined) cellData._calcOperator = cell._calcOperator;
      if (cell._calcThreshold !== undefined) cellData._calcThreshold = cell._calcThreshold;
      if (cell._calcFinalText !== undefined) cellData._calcFinalText = cell._calcFinalText;
      if (cell._calcTerms !== undefined) cellData._calcTerms = JSON.parse(JSON.stringify(cell._calcTerms));
      if (cell._calcFinalOutputType !== undefined) cellData._calcFinalOutputType = cell._calcFinalOutputType;
      if (cell._calcFinalCheckboxChecked !== undefined) cellData._calcFinalCheckboxChecked = cell._calcFinalCheckboxChecked;
      // subtitle & info nodes
      if (cell._subtitleText !== undefined) cellData._subtitleText = cell._subtitleText;
      if (cell._infoText !== undefined) cellData._infoText = cell._infoText;
      // checkbox availability
      if (cell._checkboxAvailability !== undefined) cellData._checkboxAvailability = cell._checkboxAvailability;
      // big paragraph properties
      if (cell._lineLimit !== undefined) cellData._lineLimit = cell._lineLimit;
      if (cell._characterLimit !== undefined) cellData._characterLimit = cell._characterLimit;
      if (cell._paragraphLimit !== undefined) cellData._paragraphLimit = cell._paragraphLimit;
      // Hidden node properties
      if (cell._hiddenNodeId !== undefined) cellData._hiddenNodeId = cell._hiddenNodeId;
      if (cell._defaultText !== undefined) cellData._defaultText = cell._defaultText;
      // Linked logic node properties
      if (cell._linkedLogicNodeId !== undefined) {
        cellData._linkedLogicNodeId = cell._linkedLogicNodeId;
      } else if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
      }
      if (cell._linkedFields !== undefined) {
        cellData._linkedFields = cell._linkedFields;
      } else if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
      }
      if (cell._linkedCheckboxNodeId !== undefined) {
        cellData._linkedCheckboxNodeId = cell._linkedCheckboxNodeId;
      } else if (typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(cell)) {
      }
      if (cell._linkedCheckboxOptions !== undefined) {
        cellData._linkedCheckboxOptions = cell._linkedCheckboxOptions;
      } else if (typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(cell)) {
      }
      // Inverse checkbox node properties - always include for inverse checkbox nodes
      if (typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)) {
        cellData._inverseCheckboxNodeId = cell._inverseCheckboxNodeId !== undefined ? cell._inverseCheckboxNodeId : null;
        cellData._inverseCheckboxOption = cell._inverseCheckboxOption !== undefined ? cell._inverseCheckboxOption : null;
      } else if (cell._inverseCheckboxNodeId !== undefined) {
        cellData._inverseCheckboxNodeId = cell._inverseCheckboxNodeId;
      } else if (cell._inverseCheckboxOption !== undefined) {
        cellData._inverseCheckboxOption = cell._inverseCheckboxOption;
      }
      // mult dropdown location indicator
      if (cell._locationIndex !== undefined) cellData._locationIndex = cell._locationIndex;
      if (cell._locationTitle !== undefined) cellData._locationTitle = cell._locationTitle;
      // checkbox properties (including linked fields in options)
      if (cell._checkboxes) {
        cellData._checkboxes = JSON.parse(JSON.stringify(cell._checkboxes));
      }
      if (cell._itemOrder) {
        cellData._itemOrder = JSON.parse(JSON.stringify(cell._itemOrder));
      }
      if (cell._times) {
        cellData._times = JSON.parse(JSON.stringify(cell._times));
      }
      if (cell._dropdowns) {
        cellData._dropdowns = JSON.parse(JSON.stringify(cell._dropdowns));
      }
      return cellData;
    });
    // Get default PDF properties
    const defaultPdfProps = typeof window.getDefaultPdfProperties === 'function' ? 
      window.getDefaultPdfProperties() : { pdfName: "", pdfFile: "", pdfPrice: "" };
    // Get form name
    const formName = document.getElementById('formNameInput')?.value || '';
    const flowchartExportObj = {
      cells: simplifiedCells,
      sectionPrefs: sectionPrefs,
      groups: getGroupsData(),
      defaultPdfProperties: defaultPdfProps,
      formName: formName,
      edgeStyle: currentEdgeStyle
    };
    flowchartExportObj.cells.forEach((cell, index) => {
      if (cell.style && cell.style.includes('nodeType=pdfPreview')) {
      }
    });
    const flowchartJson = JSON.stringify(flowchartExportObj, null, 2);
    // Get GUI JSON (without downloading)
    const guiJson = exportGuiJson(false);
    // Combine both JSONs in the specified format
    const combinedText = `Okay great, here is my flowchart json: "${flowchartJson}" and here is the gui json produced: "${guiJson}"`;
    // Copy to clipboard
    navigator.clipboard.writeText(combinedText).then(() => {
      // Show user feedback
      const notification = document.createElement('div');
      notification.textContent = 'Both JSONs copied to clipboard!';
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
      document.body.appendChild(notification);
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    }).catch(err => {
    });
  } catch (error) {
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
  // Automatically reset PDF inheritance and Node IDs before saving
  // CORRECT ORDER: PDF inheritance first, then Node IDs (so Node IDs can use correct PDF names)
  // Check Linked Logic properties BEFORE reset
  const graph = window.graph;
  const parent = graph.getDefaultParent();
  const allCells = graph.getChildVertices(parent);
  allCells.forEach(cell => {
    if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
    }
  });
  // Reset PDF inheritance for all nodes FIRST
  if (typeof window.resetAllPdfInheritance === 'function') {
    window.resetAllPdfInheritance();
  }
  // Reset all Node IDs SECOND (after PDF inheritance is fixed)
  if (typeof resetAllNodeIds === 'function') {
    resetAllNodeIds();
  }
  // Check Linked Logic properties AFTER reset
  allCells.forEach(cell => {
    if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
    }
  });
  renumberQuestionIds();
  let flowchartName = currentFlowchartName;
  if (!flowchartName) {
    // Get form name from input field
    const formNameInput = document.getElementById('formNameInput');
    const formName = formNameInput ? formNameInput.value.trim() : '';
    if (formName) {
      flowchartName = formName;
    } else {
    flowchartName = prompt("Enter a name for this flowchart:");
    if (!flowchartName || !flowchartName.trim()) return;
    }
    currentFlowchartName = flowchartName;
    window.currentFlowchartName = flowchartName;
    console.log('[SAVE FLOWCHART] Set currentFlowchartName', flowchartName);
  }
  console.log('[EXPORT SAVEFLOWCHART] ========== SAVE FLOWCHART STARTED ==========');
  // Gather data and save
  const data = { cells: [] };
  const cells = graph.getModel().cells;
  console.log('[EXPORT SAVEFLOWCHART] Total cells in model:', Object.keys(cells).length);
  
  // Log all inverse checkbox nodes before export
  const allInverseCheckboxNodes = [];
  for (let id in cells) {
    if (id === "0" || id === "1") continue;
    const cell = cells[id];
    if (typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)) {
      allInverseCheckboxNodes.push({ id, cell });
    }
  }
  console.log('[EXPORT SAVEFLOWCHART] Found', allInverseCheckboxNodes.length, 'inverse checkbox nodes');
  allInverseCheckboxNodes.forEach(({ id, cell }, index) => {
    console.log(`[EXPORT SAVEFLOWCHART] Inverse Checkbox Node ${index + 1} (id: ${id}):`, {
      _inverseCheckboxNodeId: cell._inverseCheckboxNodeId,
      _inverseCheckboxOption: cell._inverseCheckboxOption,
      hasInverseCheckboxNodeId: cell._inverseCheckboxNodeId !== undefined,
      hasInverseCheckboxOption: cell._inverseCheckboxOption !== undefined
    });
  });
  
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
      // Save edge geometry (articulation points) if it exists
      edgeGeometry: cell.edge && cell.geometry && cell.geometry.points && cell.geometry.points.length > 0 ? {
        points: cell.geometry.points.map(point => ({
          x: point.x,
          y: point.y
        }))
      } : null,
      _textboxes: cell._textboxes||null, _questionText: cell._questionText||null,
      _twoNumbers: cell._twoNumbers||null, _dropdownTitle: cell._dropdownTitle||null, _fileName: cell._fileName||null, _nameId: cell._nameId||null, _currencyAlerts: cell._currencyAlerts||null,
      _placeholder: cell._placeholder||"", _questionId: cell._questionId||null,
      _image: cell._image||null,
      _notesText: cell._notesText||null, _notesBold: cell._notesBold||null, _notesFontSize: cell._notesFontSize||null,
      _checklistText: cell._checklistText||null, _alertText: cell._alertText||null, _pdfName: cell._pdfName||null, _pdfFile: cell._pdfFile||null, _pdfPrice: cell._pdfPrice||null, _pdfUrl: cell._pdfUrl||null, _priceId: cell._priceId||null, _pdfLogicEnabled: cell._pdfLogicEnabled||null, _pdfTriggerLimit: cell._pdfTriggerLimit||null, _bigParagraphPdfName: cell._bigParagraphPdfName||null, _bigParagraphPdfFile: cell._bigParagraphPdfFile||null, _bigParagraphPdfPrice: cell._bigParagraphPdfPrice||null,
      _pdfPreviewTitle: cell._pdfPreviewTitle !== undefined ? cell._pdfPreviewTitle : null,
      _pdfPreviewFile: cell._pdfPreviewFile !== undefined ? cell._pdfPreviewFile : null,
      _pdfPreviewFilename: cell._pdfPreviewFilename !== undefined ? cell._pdfPreviewFilename : null,
      _pdfPreviewPriceId: cell._pdfPreviewPriceId !== undefined ? cell._pdfPreviewPriceId : null,
      _pdfPreviewAttachment: cell._pdfPreviewAttachment !== undefined ? cell._pdfPreviewAttachment : null,
      _checkboxAvailability: cell._checkboxAvailability||null,
      _lineLimit: cell._lineLimit||null, _characterLimit: cell._characterLimit||null, _paragraphLimit: cell._paragraphLimit||null,
      _locationIndex: cell._locationIndex !== undefined ? cell._locationIndex : undefined,
      _locationTitle: cell._locationTitle !== undefined ? cell._locationTitle : undefined,
      _checkboxes: cell._checkboxes||null,
      _itemOrder: cell._itemOrder||null,
      _times: cell._times||null,
      _dropdowns: cell._dropdowns||null,
      _hiddenNodeId: cell._hiddenNodeId||null, _defaultText: cell._defaultText||null,
      _linkedLogicNodeId: cell._linkedLogicNodeId||null, _linkedFields: cell._linkedFields||null,
      _linkedCheckboxNodeId: cell._linkedCheckboxNodeId||null, _linkedCheckboxOptions: cell._linkedCheckboxOptions||null,
      _inverseCheckboxNodeId: (typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)) ? (cell._inverseCheckboxNodeId !== undefined ? cell._inverseCheckboxNodeId : null) : (cell._inverseCheckboxNodeId !== undefined ? cell._inverseCheckboxNodeId : null),
      _inverseCheckboxOption: (typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)) ? (cell._inverseCheckboxOption !== undefined ? cell._inverseCheckboxOption : null) : (cell._inverseCheckboxOption !== undefined ? cell._inverseCheckboxOption : null)
    };
    // Log inverse checkbox properties for this cell
    if (typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)) {
      console.log(`[EXPORT] Cell ${cell.id} is inverse checkbox:`, {
        cellId: cell.id,
        cellInverseCheckboxNodeId: cell._inverseCheckboxNodeId,
        cellInverseCheckboxOption: cell._inverseCheckboxOption,
        exportedInverseCheckboxNodeId: cellData._inverseCheckboxNodeId,
        exportedInverseCheckboxOption: cellData._inverseCheckboxOption
      });
    }
    // Debug logging for Linked Logic properties
    if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
    }
    if (isCalculationNode(cell)) {
      cellData._calcTitle = cell._calcTitle || null;
      cellData._calcAmountLabel = cell._calcAmountLabel || null;
      cellData._calcOperator = cell._calcOperator || null;
      cellData._calcThreshold = cell._calcThreshold || null;
      cellData._calcFinalText = cell._calcFinalText || null;
      cellData._calcTerms = cell._calcTerms || null;
      cellData._calcFinalOutputType = cell._calcFinalOutputType || null;
      cellData._calcFinalCheckboxChecked = cell._calcFinalCheckboxChecked || null;
    }
    data.cells.push(cellData);
  }
  // Get current section preferences using the proper function
  const currentSectionPrefs = window.getSectionPrefs ? window.getSectionPrefs() : (window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {});
  data.sectionPrefs = currentSectionPrefs;
  data.groups = getGroupsData();
  // Get default PDF properties
  const defaultPdfProps = typeof window.getDefaultPdfProperties === 'function' ? 
    window.getDefaultPdfProperties() : { pdfName: "", pdfFile: "", pdfPrice: "" };
  data.defaultPdfProperties = defaultPdfProps;
  // Get form name
  const formName = document.getElementById('formNameInput')?.value || '';
  data.formName = formName;
  // Get current edge style
  data.edgeStyle = currentEdgeStyle;
  // Remove undefined values before saving to Firebase (Firebase doesn't accept undefined)
  const cleanedData = removeUndefinedValues(data);
  db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(flowchartName).set({ 
    flowchart: cleanedData,
    lastUsed: Date.now()
  })
    .then(()=>{
      alert("Flowchart saved as: " + flowchartName);
      // Set the library flowchart name for autosave protocol
      window.currentFlowchartName = flowchartName;
      console.log('[SAVE FLOWCHART] Updated currentFlowchartName after save', flowchartName);
      // Trigger autosave to update the library flowchart name
      if (typeof autosaveFlowchartToLocalStorage === 'function') {
        autosaveFlowchartToLocalStorage();
      }
    })
    .catch(err=>alert("Error saving: " + err));
};
// Save flowchart as a new flowchart (Save As functionality)
window.saveAsFlowchart = function() {
  if (!window.currentUser || window.currentUser.isGuest) { 
    alert("Please log in with a real account to save flowcharts. Guest users cannot save."); 
    return;
  }  
  // Automatically reset PDF inheritance and Node IDs before saving
  // CORRECT ORDER: PDF inheritance first, then Node IDs (so Node IDs can use correct PDF names)
  // Check Linked Logic properties BEFORE reset
  const graph = window.graph;
  const parent = graph.getDefaultParent();
  const allCells = graph.getChildVertices(parent);
  allCells.forEach(cell => {
    if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
    }
  });
  // Reset PDF inheritance for all nodes FIRST
  if (typeof window.resetAllPdfInheritance === 'function') {
    window.resetAllPdfInheritance();
  }
  // Reset all Node IDs SECOND (after PDF inheritance is fixed)
  if (typeof resetAllNodeIds === 'function') {
    resetAllNodeIds();
  }
  // Check Linked Logic properties AFTER reset
  allCells.forEach(cell => {
    if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
    }
  });
  renumberQuestionIds();
  // Always prompt for a new name for "Save As"
  let flowchartName = prompt("Enter a name for this new flowchart:");
  if (!flowchartName || !flowchartName.trim()) return;
  // Update the current flowchart name to the new name
  currentFlowchartName = flowchartName;
  window.currentFlowchartName = flowchartName;
  console.log('[SAVE AS] Set currentFlowchartName', flowchartName);
  // Gather data and save (same logic as saveFlowchart)
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
      // Save edge geometry (articulation points) if it exists
      edgeGeometry: cell.edge && cell.geometry && cell.geometry.points && cell.geometry.points.length > 0 ? {
        points: cell.geometry.points.map(point => ({
          x: point.x,
          y: point.y
        }))
      } : null,
      _textboxes: cell._textboxes||null, _questionText: cell._questionText||null,
      _twoNumbers: cell._twoNumbers||null, _dropdownTitle: cell._dropdownTitle||null, _fileName: cell._fileName||null, _nameId: cell._nameId||null, _currencyAlerts: cell._currencyAlerts||null,
      _placeholder: cell._placeholder||"", _questionId: cell._questionId||null,
      _image: cell._image||null,
      _notesText: cell._notesText||null, _notesBold: cell._notesBold||null, _notesFontSize: cell._notesFontSize||null,
      _checklistText: cell._checklistText||null, _alertText: cell._alertText||null, _pdfName: cell._pdfName||null, _pdfFile: cell._pdfFile||null, _pdfPrice: cell._pdfPrice||null, _pdfUrl: cell._pdfUrl||null, _priceId: cell._priceId||null, _pdfLogicEnabled: cell._pdfLogicEnabled||null, _pdfTriggerLimit: cell._pdfTriggerLimit||null, _bigParagraphPdfName: cell._bigParagraphPdfName||null, _bigParagraphPdfFile: cell._bigParagraphPdfFile||null, _bigParagraphPdfPrice: cell._bigParagraphPdfPrice||null,
      _pdfPreviewTitle: cell._pdfPreviewTitle !== undefined ? cell._pdfPreviewTitle : null,
      _pdfPreviewFile: cell._pdfPreviewFile !== undefined ? cell._pdfPreviewFile : null,
      _pdfPreviewFilename: cell._pdfPreviewFilename !== undefined ? cell._pdfPreviewFilename : null,
      _pdfPreviewPriceId: cell._pdfPreviewPriceId !== undefined ? cell._pdfPreviewPriceId : null,
      _pdfPreviewAttachment: cell._pdfPreviewAttachment !== undefined ? cell._pdfPreviewAttachment : null,
      _checkboxAvailability: cell._checkboxAvailability||null,
      _lineLimit: cell._lineLimit||null, _characterLimit: cell._characterLimit||null, _paragraphLimit: cell._paragraphLimit||null,
      _locationIndex: cell._locationIndex !== undefined ? cell._locationIndex : undefined,
      _locationTitle: cell._locationTitle !== undefined ? cell._locationTitle : undefined,
      _checkboxes: cell._checkboxes||null,
      _itemOrder: cell._itemOrder||null,
      _times: cell._times||null,
      _dropdowns: cell._dropdowns||null,
      _hiddenNodeId: cell._hiddenNodeId||null, _defaultText: cell._defaultText||null,
      _linkedLogicNodeId: cell._linkedLogicNodeId||null, _linkedFields: cell._linkedFields||null,
      _linkedCheckboxNodeId: cell._linkedCheckboxNodeId||null, _linkedCheckboxOptions: cell._linkedCheckboxOptions||null,
      _inverseCheckboxNodeId: (typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)) ? (cell._inverseCheckboxNodeId !== undefined ? cell._inverseCheckboxNodeId : null) : (cell._inverseCheckboxNodeId !== undefined ? cell._inverseCheckboxNodeId : null),
      _inverseCheckboxOption: (typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)) ? (cell._inverseCheckboxOption !== undefined ? cell._inverseCheckboxOption : null) : (cell._inverseCheckboxOption !== undefined ? cell._inverseCheckboxOption : null)
    };
    // Log inverse checkbox properties for this cell
    if (typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)) {
      console.log(`[EXPORT] Cell ${cell.id} is inverse checkbox:`, {
        cellId: cell.id,
        cellInverseCheckboxNodeId: cell._inverseCheckboxNodeId,
        cellInverseCheckboxOption: cell._inverseCheckboxOption,
        exportedInverseCheckboxNodeId: cellData._inverseCheckboxNodeId,
        exportedInverseCheckboxOption: cellData._inverseCheckboxOption
      });
    }
    // Debug logging for Linked Logic properties
    if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
    }
    if (isCalculationNode(cell)) {
      cellData._calcTitle = cell._calcTitle || null;
      cellData._calcAmountLabel = cell._calcAmountLabel || null;
      cellData._calcOperator = cell._calcOperator || null;
      cellData._calcThreshold = cell._calcThreshold || null;
      cellData._calcFinalText = cell._calcFinalText || null;
      cellData._calcTerms = cell._calcTerms || null;
      cellData._calcFinalOutputType = cell._calcFinalOutputType || null;
      cellData._calcFinalCheckboxChecked = cell._calcFinalCheckboxChecked || null;
    }
    data.cells.push(cellData);
  }
  // Get current section preferences using the proper function
  const currentSectionPrefs = window.getSectionPrefs ? window.getSectionPrefs() : (window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {});
  data.sectionPrefs = currentSectionPrefs;
  data.groups = getGroupsData();
  // Get default PDF properties
  const defaultPdfProps = typeof window.getDefaultPdfProperties === 'function' ? 
    window.getDefaultPdfProperties() : { pdfName: "", pdfFile: "", pdfPrice: "" };
  data.defaultPdfProperties = defaultPdfProps;
  // Get form name
  const formName = document.getElementById('formNameInput')?.value || '';
  data.formName = formName;
  // Get current edge style
  data.edgeStyle = currentEdgeStyle;
  // Remove undefined values before saving to Firebase (Firebase doesn't accept undefined)
  const cleanedData = removeUndefinedValues(data);
  db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(flowchartName).set({ 
    flowchart: cleanedData,
    lastUsed: Date.now()
  })
    .then(()=>{
      alert("Flowchart saved as: " + flowchartName);
      // Set the library flowchart name for autosave protocol
      window.currentFlowchartName = flowchartName;
      console.log('[SAVE AS] Updated currentFlowchartName after save', flowchartName);
      // Trigger autosave to update the library flowchart name
      if (typeof autosaveFlowchartToLocalStorage === 'function') {
        autosaveFlowchartToLocalStorage();
      }
    })
    .catch(err=>alert("Error saving: " + err));
};
// View saved flowcharts
window.viewSavedFlowcharts = function() {
  if (!window.currentUser || window.currentUser.isGuest) { alert("Please log in with a real account to view saved flowcharts. Guest users cannot load."); return; }
  db.collection("users").doc(window.currentUser.uid).collection("flowcharts").get()
    .then(snapshot=>{
      let flowcharts = [];
      snapshot.forEach(doc=>{
        const name = doc.id;
        const data = doc.data();
        const lastUsed = data.lastUsed || 0;
        flowcharts.push({
          name: name,
          lastUsed: lastUsed,
          data: data
        });
      });
      // Sort by recently used (most recent first)
      flowcharts.sort((a, b) => b.lastUsed - a.lastUsed);
      // Store flowcharts for search functionality
      window.currentFlowcharts = flowcharts;
      // Display flowcharts
      displayFlowcharts(flowcharts);
      // Set up search functionality
      const searchInput = document.getElementById("flowchartSearchInput");
      if (searchInput) {
        searchInput.value = "";
        searchInput.oninput = function() {
          const searchTerm = this.value.toLowerCase();
          const filteredFlowcharts = flowcharts.filter(fc => 
            fc.name.toLowerCase().includes(searchTerm)
          );
          displayFlowcharts(filteredFlowcharts);
        };
      }
      document.getElementById("flowchartListOverlay").style.display = "flex";
    })
    .catch(err=>alert("Error fetching: " + err));
};
// Display flowcharts in the list
function displayFlowcharts(flowcharts) {
  let html = flowcharts.length === 0 ? "<p>No saved flowcharts.</p>" : "";
  flowcharts.forEach(fc => {
    const lastUsedText = fc.lastUsed ? new Date(fc.lastUsed).toLocaleDateString() : "Never used";
    html += `<div class="flowchart-item">
              <div style="flex: 1;">
                <strong ondblclick="renameFlowchart('${fc.name}', this)">${fc.name}</strong>
                <br><small style="color: #666;">Last used: ${lastUsedText}</small>
              </div>
              <div>
                <button onclick="openSavedFlowchart('${fc.name}')">Open</button>
                <button onclick="deleteSavedFlowchart('${fc.name}')">Delete</button>
              </div>
            </div>`;
  });
  document.getElementById("flowchartList").innerHTML = html;
}
window.openSavedFlowchart = function(name, onCompleteCallback) {
  if (!window.currentUser || window.currentUser.isGuest) { alert("Please log in with a real account to open saved flowcharts. Guest users cannot load."); return; }
  db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(name)
    .get().then(docSnap=>{
      if (!docSnap.exists) { alert("No flowchart named " + name); return; }
      currentFlowchartName = name;
      window.currentFlowchartName = name;
      loadFlowchartData(docSnap.data().flowchart, name, onCompleteCallback);
      // Update last used timestamp
      db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(name)
        .update({ lastUsed: Date.now() })
        .catch(err => {
          console.error("Error updating lastUsed timestamp:", err);
        });
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
        .then(()=>{ 
          docRef.delete(); 
          element.textContent=newName; 
          if(currentFlowchartName===oldName) {
            currentFlowchartName=newName;
            window.currentFlowchartName=newName;
          } 
          alert("Renamed to: " + newName);
          // Trigger autosave to update the library flowchart name
          if (typeof autosaveFlowchartToLocalStorage === 'function') {
            autosaveFlowchartToLocalStorage();
          }
        })
        .catch(err=>alert("Error renaming: " + err));
    }
  });
};
window.deleteSavedFlowchart = function(name) {
  if (!window.currentUser || window.currentUser.isGuest) { alert("Please log in with a real account to delete flowcharts. Guest users cannot delete."); return; }
  if (!confirm("Delete '"+name+"'?")) return;
  db.collection("users").doc(window.currentUser.uid).collection("flowcharts").doc(name).delete()
    .then(()=>{ alert("Deleted: " + name); if(currentFlowchartName===name) {
      currentFlowchartName=null;
      window.currentFlowchartName=null;
    } window.viewSavedFlowcharts(); })
    .catch(err=>alert("Error deleting: " + err));
};
/**************************************************
 *            FILE I/O OPERATIONS               *
 **************************************************/
/**
 * Recursively removes undefined values from an object (Firebase doesn't accept undefined)
 */
function removeUndefinedValues(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedValues(item));
  }
  const cleaned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
      // Skip undefined values entirely
    }
  }
  return cleaned;
}
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
 * Function to propagate PDF properties downstream through the flowchart
 */
function propagatePdfPropertiesDownstream(startCell, sourceCell, visited = new Set()) {
    if (!startCell || visited.has(startCell.id)) return;
    visited.add(startCell.id);
    const graph = window.graph;
    if (!graph) return;
    // Get all outgoing edges from the start cell
    const outgoingEdges = graph.getOutgoingEdges(startCell) || [];
    // Fallback: If getOutgoingEdges doesn't work, manually find edges
    if (outgoingEdges.length === 0) {
      const modelEdges = graph.getModel().getEdges();
      const childEdges = graph.getChildEdges(graph.getDefaultParent());
      const allEdges = childEdges.length > 0 ? childEdges : modelEdges;
      const manualOutgoingEdges = allEdges.filter(edge => 
        edge.source && edge.source.id === startCell.id
      );
      // Use manual edges if found
      if (manualOutgoingEdges.length > 0) {
        for (const edge of manualOutgoingEdges) {
          const targetCell = edge.target;
          if (targetCell && !visited.has(targetCell.id)) {
            // Check if target doesn't already have PDF properties
            if (!targetCell._pdfName && !targetCell._pdfFilename && !targetCell._pdfUrl && !targetCell._pdfFile && 
                !(typeof window.isPdfNode === 'function' && window.isPdfNode(targetCell))) {
              // Copy PDF properties from source to target
              if (sourceCell._pdfName) targetCell._pdfName = sourceCell._pdfName;
              if (sourceCell._pdfFilename) targetCell._pdfFilename = sourceCell._pdfFilename;
              if (sourceCell._pdfFile) targetCell._pdfFile = sourceCell._pdfFile;
              if (sourceCell._pdfPrice) targetCell._pdfPrice = sourceCell._pdfPrice;
              if (sourceCell._pdfUrl) targetCell._pdfUrl = sourceCell._pdfUrl;
              if (sourceCell._priceId) targetCell._priceId = sourceCell._priceId;
              if (sourceCell._characterLimit) targetCell._characterLimit = sourceCell._characterLimit;
              // Recursively propagate to further downstream nodes
              propagatePdfPropertiesDownstream(targetCell, sourceCell, visited);
            }
          }
        }
        return; // Exit early since we handled the manual edges
      }
    }
    for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (targetCell && !visited.has(targetCell.id)) {
            // Check if target doesn't already have PDF properties
            if (!targetCell._pdfName && !targetCell._pdfFilename && !targetCell._pdfUrl && !targetCell._pdfFile && 
                !(typeof window.isPdfNode === 'function' && window.isPdfNode(targetCell))) {
                // Copy PDF properties from source to target
                if (sourceCell._pdfName) targetCell._pdfName = sourceCell._pdfName;
                if (sourceCell._pdfFilename) targetCell._pdfFilename = sourceCell._pdfFilename;
                if (sourceCell._pdfFile) targetCell._pdfFile = sourceCell._pdfFile;
                if (sourceCell._pdfPrice) targetCell._pdfPrice = sourceCell._pdfPrice;
                if (sourceCell._pdfUrl) targetCell._pdfUrl = sourceCell._pdfUrl;
                if (sourceCell._priceId) targetCell._priceId = sourceCell._priceId;
                if (sourceCell._characterLimit) targetCell._characterLimit = sourceCell._characterLimit;
                // Recursively propagate to further downstream nodes
                propagatePdfPropertiesDownstream(targetCell, sourceCell, visited);
            }
        }
    }
}
/**
 * Propagate PDF properties through the flowchart after import
 */
function propagatePdfPropertiesAfterImport() {
  const graph = window.graph;
  if (!graph) return;
  // Force graph model to update and refresh
  graph.getModel().beginUpdate();
  graph.getModel().endUpdate();
  graph.refresh();
  // Get all cells in the graph
  const allCells = graph.getModel().cells;
  const cells = Object.values(allCells).filter(cell => cell && cell.vertex);
  // Find all PDF nodes
  const pdfNodes = cells.filter(cell => {
    return cell._pdfName || cell._pdfFilename || cell._pdfUrl || cell._pdfFile || 
           (typeof window.isPdfNode === 'function' && window.isPdfNode(cell));
  });
  // For each PDF node, propagate its properties to all downstream nodes
  pdfNodes.forEach(pdfNode => {
    // Check all edges in the graph using multiple methods
    const modelEdges = graph.getModel().getEdges();
    const childEdges = graph.getChildEdges(graph.getDefaultParent());
    // Use childEdges as the primary source since it's more reliable
    const allEdges = childEdges.length > 0 ? childEdges : modelEdges;
    // Check edges specifically connected to this PDF node
    const connectedEdges = allEdges.filter(edge => 
      (edge.source && edge.source.id === pdfNode.id) || 
      (edge.target && edge.target.id === pdfNode.id)
    );
    // Check if PDF node has incoming edges (should propagate to source)
    const incomingEdges = allEdges.filter(edge => 
      edge.target && edge.target.id === pdfNode.id
    );
    // Check if PDF node has outgoing edges (should propagate to targets)
    const outgoingEdges = allEdges.filter(edge => 
      edge.source && edge.source.id === pdfNode.id
    );
    // Try both directions: outgoing edges (PDF node as source) and incoming edges (PDF node as target)
    if (outgoingEdges.length > 0) {
      propagatePdfPropertiesDownstream(pdfNode, pdfNode, new Set());
    } else if (incomingEdges.length > 0) {
      // If PDF node has no outgoing edges, check if we should propagate to its source nodes
      const visited = new Set();
      for (const edge of incomingEdges) {
        const sourceCell = edge.source;
        if (sourceCell && !visited.has(sourceCell.id)) {
          visited.add(sourceCell.id);
          // Copy PDF properties to the source node first
          if (!sourceCell._pdfFile && !sourceCell._pdfUrl) {
            sourceCell._pdfName = pdfNode._pdfName;
            sourceCell._pdfFile = pdfNode._pdfFile;
            sourceCell._pdfPrice = pdfNode._pdfPrice;
            sourceCell._pdfUrl = pdfNode._pdfUrl;
            sourceCell._priceId = pdfNode._priceId;
            sourceCell._pdfFilename = pdfNode._pdfFilename;
            sourceCell._characterLimit = pdfNode._characterLimit;
          }
          // Then propagate from the source node downstream
          propagatePdfPropertiesDownstream(sourceCell, pdfNode, new Set());
        }
      }
    }
  });
}
/**
 * Validate and correct Node IDs to follow proper naming scheme after import
 * Naming convention: [pdf name if associated]-[parent node text]-[current node text]
 */
window.correctNodeIdsAfterImport = function() {
  const graph = window.graph;
  if (!graph) {
    return;
  }
  // Get all cells in the graph
  const allCells = graph.getModel().cells;
  const cells = Object.values(allCells).filter(cell => cell && cell.vertex);
  let validatedCount = 0;
  let correctedCount = 0;
  let invalidIds = [];
  // First pass: Validate all existing Node IDs
  cells.forEach(cell => {
    if (cell && cell.vertex) {
      validatedCount++;
      // Get current Node ID
      let currentId = '';
      if (cell.style) {
        const styleMatch = cell.style.match(/nodeId=([^;]+)/);
        if (styleMatch) {
          currentId = decodeURIComponent(styleMatch[1]);
        }
      }
      // If no Node ID exists, mark as invalid
      if (!currentId) {
        invalidIds.push({
          cell: cell,
          currentId: 'MISSING',
          reason: 'No Node ID found'
        });
        return;
      }
      // Generate what the correct Node ID should be
      const correctId = generateCorrectNodeId(cell);
      // Check if current ID matches the correct format
      if (currentId !== correctId) {
        invalidIds.push({
          cell: cell,
          currentId: currentId,
          correctId: correctId,
          reason: 'Does not follow naming convention'
        });
      }
    }
  });
  // Second pass: Correct all invalid Node IDs
  if (invalidIds.length > 0) {
    invalidIds.forEach(({ cell, currentId, correctId, reason }) => {
      if (typeof window.setNodeId === 'function') {
        try {
          // Clear the existing Node ID from the style to force regeneration
          let style = cell.style || '';
          style = style.replace(/nodeId=[^;]+/, '');
          graph.getModel().setStyle(cell, style);
          // Set the correct Node ID
          window.setNodeId(cell, correctId);
          correctedCount++;
        } catch (error) {
        }
      } else {
      }
    });
    // Refresh the graph to show the corrected Node IDs
    if (typeof window.refreshAllCells === 'function') {
      window.refreshAllCells();
    }
  } else {
  }
}
/**
 * Generate the correct Node ID for a cell based on the naming convention
 * Format: [pdf name if associated]-[parent node text]-[current node text]
 */
function generateCorrectNodeId(cell) {
  // Get PDF name if associated with this node
  const pdfName = getPdfNameForNode(cell);
  // Check if PDF name should be added to node ID based on user setting
  const shouldAddPdfName = (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId !== false) ? true : false;
  // Get parent node text (for option nodes)
  const parentText = getParentNodeText(cell);
  // Get current node text
  const currentText = getCurrentNodeText(cell);
  // Build the Node ID according to the convention
  let nodeId = '';
  // Add PDF name prefix if present and setting allows it
  if (pdfName && pdfName.trim() && shouldAddPdfName) {
    // Use sanitizeNameId if available, otherwise use similar logic that preserves underscores
    const cleanPdfName = typeof window.sanitizeNameId === 'function'
      ? window.sanitizeNameId(pdfName.trim())
      : pdfName.trim()
      .toLowerCase()
          .replace(/<[^>]+>/g, '') // Remove HTML tags
          .replace(/[^a-z0-9\s_]/g, '') // Remove special characters but preserve underscores
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    nodeId += cleanPdfName + '_';
  }
  // Add parent text if present (only for option nodes, not question nodes)
  if (parentText && parentText.trim() && isOptions(cell)) {
    // Use sanitizeNameId if available, otherwise use similar logic that preserves underscores
    const cleanParentText = typeof window.sanitizeNameId === 'function'
      ? window.sanitizeNameId(parentText.trim())
      : parentText.trim()
      .toLowerCase()
          .replace(/<[^>]+>/g, '') // Remove HTML tags
          .replace(/[^a-z0-9\s_]/g, '') // Remove special characters but preserve underscores
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    nodeId += cleanParentText + '_';
  }
  // Add current node text
  if (currentText && currentText.trim()) {
    // Use sanitizeNameId if available, otherwise use similar logic that preserves underscores
    const cleanCurrentText = typeof window.sanitizeNameId === 'function'
      ? window.sanitizeNameId(currentText.trim())
      : currentText.trim()
      .toLowerCase()
          .replace(/<[^>]+>/g, '') // Remove HTML tags
          .replace(/[^a-z0-9\s_]/g, '') // Remove special characters but preserve underscores
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    nodeId += cleanCurrentText;
  }
  // Clean up the final result
  nodeId = nodeId.replace(/_+/g, '_') // Replace multiple underscores with single
                 .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  // Fallback if no valid text found
  if (!nodeId) {
    nodeId = 'unnamed_node';
  }
  return nodeId;
}
/**
 * Get current PDF name from a PDF node's HTML input field (dynamic reading)
 */
window.getCurrentPdfNameFromHtml = function(pdfNode) {
  if (!pdfNode || !pdfNode.value) return null;
  try {
    // Parse the HTML to find the PDF Name input field
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pdfNode.value;
    // Look for the PDF Name input field
    const pdfNameInput = tempDiv.querySelector('input[type="text"]');
    if (pdfNameInput) {
      const currentValue = pdfNameInput.value || pdfNameInput.getAttribute('value') || '';
      if (currentValue.trim() && currentValue.trim() !== 'PDF Document') {
        return currentValue.trim();
      }
    }
  } catch (error) {
    }
    return null;
};
/**
 * Reset PDF inheritance by finding the connected PDF node and updating the inherited value
 */
window.resetPdfInheritance = function(cell) {
  const graph = window.graph;
  if (!graph) {
    return;
  }
  // Check if cell is valid
  if (!cell) {
    return;
  }
  // Recursive function to find the source PDF node by following the inheritance chain
  function findSourcePdfNode(currentCell, visited = new Set()) {
    // Check if currentCell is valid
    if (!currentCell || !currentCell.id) {
      return null;
    }
    if (visited.has(currentCell.id)) {
      return null; // Avoid infinite loops
    }
    visited.add(currentCell.id);
    // Check if this cell is a PDF node
    if (typeof window.isPdfNode === 'function' && window.isPdfNode(currentCell)) {
      return currentCell;
    }
    // Check outgoing edges for direct PDF node connections
    const outgoingEdges = graph.getOutgoingEdges(currentCell) || [];
    for (const edge of outgoingEdges) {
      const target = edge.target;
      if (target && typeof window.isPdfNode === 'function' && window.isPdfNode(target)) {
        return target;
      }
    }
    // Check incoming edges for PDF nodes or nodes with PDF inheritance
    const incomingEdges = graph.getIncomingEdges(currentCell) || [];
    for (const edge of incomingEdges) {
      const source = edge.source;
      if (source) {
        // Check if the source is a PDF node
        if (typeof window.isPdfNode === 'function' && window.isPdfNode(source)) {
          return source;
        }
        // Check if the source has PDF inheritance (recursive search)
        const sourcePdfName = window.getPdfNameForNode(source);
        if (sourcePdfName) {
          // Recursively search the source node
          const foundPdfNode = findSourcePdfNode(source, visited);
          if (foundPdfNode) {
            return foundPdfNode;
          }
        }
      }
    }
    return null;
  }
  // Find the connected PDF node using the recursive search
  const connectedPdfNode = findSourcePdfNode(cell);
  if (connectedPdfNode) {
    // Get the current PDF name from the PDF node's HTML input
    const currentPdfName = window.getCurrentPdfNameFromHtml(connectedPdfNode);
    if (currentPdfName) {
      // Update the cell's PDF properties to reflect the current value
      cell._pdfName = currentPdfName;
      // Refresh the properties popup to show the updated value
      if (window.__propertiesPopupOpen) {
        // Close and reopen the properties popup to refresh the display
        const closeButton = document.querySelector('#propertiesPopup .close-button');
        if (closeButton) {
          closeButton.click();
        }
        // Reopen after a short delay
        setTimeout(() => {
          window.showPropertiesPopup(cell);
        }, 100);
      }
      return currentPdfName;
    }
  }
  // Clear all PDF properties from the node since no PDF connection exists
  console.log('[PDF RESET] Clearing PDF inheritance for node', cell.id, {
    existingPdfName: cell._pdfName,
    existingCharacterLimit: cell._characterLimit
  });
  cell._pdfName = '';
  cell._pdfFilename = '';
  cell._pdfFile = '';
  cell._pdfUrl = '';
  cell._pdfPrice = '';
  cell._priceId = '';
  // Do NOT clear _characterLimit here; it belongs to the question (e.g., big paragraph) and must persist
  console.log('[PDF RESET] Preserved _characterLimit for node', cell.id, 'value:', cell._characterLimit);
  // Refresh the properties popup to remove PDF fields
  if (window.__propertiesPopupOpen) {
    // Close and reopen the properties popup to refresh the display
    const closeButton = document.querySelector('#propertiesPopup .close-button');
    if (closeButton) {
      closeButton.click();
    }
    // Reopen after a short delay
    setTimeout(() => {
      window.showPropertiesPopup(cell);
    }, 100);
  }
  return null;
};
/**
 * Reset PDF inheritance for all nodes in the flowchart
 */
window.resetAllPdfInheritance = function() {
  const graph = window.graph;
  if (!graph) {
    return;
  }
  // Get all cells in the graph
  const allCells = graph.getModel().cells;
  const cells = Object.values(allCells).filter(cell => cell && cell.vertex);
  let resetCount = 0;
  let totalCount = 0;
  // Process each cell
  cells.forEach(cell => {
    // Skip PDF nodes themselves (they don't need inheritance reset)
    if (typeof window.isPdfNode === 'function' && window.isPdfNode(cell)) {
      return;
    }
    // Skip hidden nodes - they should not be affected by PDF reset
    if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) {
      return; // Skip hidden checkbox nodes
    }
    if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
      return; // Skip hidden textbox nodes
    }
    if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
      return; // Skip linked logic nodes
    }
    // Check if this cell has PDF inheritance
    const currentPdfName = window.getPdfNameForNode(cell);
    if (currentPdfName) {
      // Reset the PDF inheritance for this cell
      window.resetPdfInheritance(cell);
    }
  });
  // User feedback removed - operation completes silently
  return { resetCount, totalCount };
};
/**
 * Get PDF name associated with a node (now reads dynamically from PDF nodes)
 */
function getPdfNameForNode(cell) {
  // Check for direct PDF properties first (fallback)
  if (cell._pdfName && cell._pdfName.trim() && cell._pdfName.trim() !== "PDF Document") {
    return cell._pdfName.trim();
  }
  if (cell._pdfFilename && cell._pdfFilename.trim()) {
    return cell._pdfFilename.trim();
  }
  if (cell._pdfFile && cell._pdfFile.trim()) {
    return cell._pdfFile.trim();
  }
  if (cell._pdfUrl && cell._pdfUrl.trim()) {
    // Extract filename from URL
    const urlParts = cell._pdfUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const result = filename.replace(/\.pdf$/i, '').trim();
    return result;
  }
  // Check if connected to a PDF node or inheriting PDF from connected nodes
  const graph = window.graph;
  if (graph) {
    // Helper function to extract PDF name from a cell (now reads from HTML inputs)
    const extractPdfName = (targetCell) => {
      // If it's a PDF node, read from HTML input field (dynamic)
      if (typeof window.isPdfNode === 'function' && window.isPdfNode(targetCell)) {
        const currentPdfName = window.getCurrentPdfNameFromHtml(targetCell);
        if (currentPdfName) return currentPdfName;
      }
      // Fallback to stored properties for non-PDF nodes
      if (targetCell._pdfName && targetCell._pdfName.trim() && targetCell._pdfName.trim() !== "PDF Document") return targetCell._pdfName.trim();
      if (targetCell._pdfFilename && targetCell._pdfFilename.trim()) return targetCell._pdfFilename.trim();
      if (targetCell._pdfFile && targetCell._pdfFile.trim()) return targetCell._pdfFile.trim();
      if (targetCell._pdfUrl && targetCell._pdfUrl.trim()) {
        const urlParts = targetCell._pdfUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        return filename.replace(/\.pdf$/i, '').trim();
      }
      return null;
    };
    // Check incoming edges for PDF nodes and PDF inheritance (downstream flow)
    const incomingEdges = graph.getIncomingEdges(cell) || [];
    for (const edge of incomingEdges) {
      const source = edge.source;
      if (source) {
        // Check if it's a PDF node
        if (typeof window.isPdfNode === 'function' && window.isPdfNode(source)) {
          const pdfName = extractPdfName(source);
          if (pdfName) return pdfName;
        }
        // Check for PDF inheritance from connected question nodes (downstream only)
        if ((source._pdfName && source._pdfName.trim() && source._pdfName.trim() !== "PDF Document") || 
            (source._pdfFilename && source._pdfFilename.trim()) || 
            (source._pdfFile && source._pdfFile.trim()) ||
            (source._pdfUrl && source._pdfUrl.trim())) {
          const pdfName = extractPdfName(source);
          if (pdfName) return pdfName;
        }
      }
    }
    // Check outgoing edges for PDF nodes (upstream flow - when this node points to a PDF node)
    const outgoingEdges = graph.getOutgoingEdges(cell) || [];
    for (const edge of outgoingEdges) {
      const target = edge.target;
      if (target) {
        // Check if it's a PDF node
        if (typeof window.isPdfNode === 'function' && window.isPdfNode(target)) {
          const pdfName = extractPdfName(target);
          if (pdfName) return pdfName;
        }
      }
    }
  }
  return null;
}
/**
 * Get parent node text (for option nodes)
 */
function getParentNodeText(cell) {
  const graph = window.graph;
  if (!graph) return null;
  // Check if this is an option node by looking for incoming edges from question nodes
  const incomingEdges = graph.getIncomingEdges(cell) || [];
  for (const edge of incomingEdges) {
    const source = edge.source;
    if (source && (typeof window.isQuestion === 'function' && window.isQuestion(source))) {
      return getCurrentNodeText(source);
    }
  }
  return null;
}
/**
 * Get current node text
 */
function getCurrentNodeText(cell) {
  // For question nodes, use _questionText if available
  if (typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
    if (cell._questionText && cell._questionText.trim()) {
      return cell._questionText.trim();
    }
  }
  // Extract text from cell value
  if (cell.value) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cell.value;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.trim();
  }
  return null;
}
/**
 * Manual Node ID validation function - can be called from console for debugging
 */
window.validateAllNodeIds = function() {
  if (typeof window.correctNodeIdsAfterImport === 'function') {
    window.correctNodeIdsAfterImport();
  } else {
  }
}
/**
 * Test function to verify edge style saving and loading functionality
 * Can be called from console: testEdgeStylePersistence()
 */
window.testEdgeStylePersistence = function() {
  // Test 1: Check current edge style
  // Test 2: Create a simple test flowchart with edges
  if (!window.graph) {
    return;
  }
  const parent = window.graph.getDefaultParent();
  // Clear existing content
  const existingCells = window.graph.getChildCells(parent, true, true);
  window.graph.removeCells(existingCells);
  // Create test nodes
  const node1 = window.graph.insertVertex(parent, null, 'Test Node 1', 100, 100, 100, 50);
  const node2 = window.graph.insertVertex(parent, null, 'Test Node 2', 300, 100, 100, 50);
  // Create test edge
  const edge = window.graph.insertEdge(parent, null, '', node1, node2);
  // Test 3: Export the flowchart and check if edgeStyle is included
  const exportData = window.exportFlowchartJson(false);
  const parsedData = JSON.parse(exportData);
  if (parsedData.edgeStyle) {
  } else {
  }
  // Test 4: Change edge style and test again
  const originalStyle = currentEdgeStyle;
  currentEdgeStyle = 'straight';
  if (typeof updateEdgeStyle === 'function') {
    updateEdgeStyle();
  }
  const exportData2 = window.exportFlowchartJson(false);
  const parsedData2 = JSON.parse(exportData2);
  if (parsedData2.edgeStyle === 'straight') {
  } else {
  }
  // Test 5: Load the data back and check if edge style is restored
  window.loadFlowchartData(parsedData2);
  setTimeout(() => {
    if (currentEdgeStyle === 'straight') {
    } else {
    }
    // Restore original style
    currentEdgeStyle = originalStyle;
    if (typeof updateEdgeStyle === 'function') {
      updateEdgeStyle();
    }
  }, 1000);
}
/**
 * Load a flowchart from JSON data.
 */
window.loadFlowchartData = function(data, libraryFlowchartName, onCompleteCallback) {
  // Store library flowchart name in a global variable for autosave to access
  window._loadingLibraryFlowchartName = libraryFlowchartName || null;
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
    // Store section renumbering map for use in setTimeout callbacks
    let sectionRenumberMap = null;
    if (data.sectionPrefs) {
      // Renumber sections sequentially (1, 2, 3, etc. without gaps)
      const originalSectionPrefs = data.sectionPrefs;
      const sectionNumbers = Object.keys(originalSectionPrefs)
        .map(num => parseInt(num))
        .filter(num => !isNaN(num))
        .sort((a, b) => a - b);
      // Create mapping from old section numbers to new sequential numbers
      sectionRenumberMap = {};
      sectionNumbers.forEach((oldNum, index) => {
        const newNum = (index + 1).toString();
        sectionRenumberMap[oldNum.toString()] = newNum;
      });
      // Create renumbered sectionPrefs
      const renumberedSectionPrefs = {};
      sectionNumbers.forEach((oldNum, index) => {
        const newNum = (index + 1).toString();
        renumberedSectionPrefs[newNum] = originalSectionPrefs[oldNum.toString()];
      });
      // Update section references in all cells before they're created
      if (data.cells && Array.isArray(data.cells)) {
        data.cells.forEach(cell => {
          if (cell.style) {
            // Update section= in style string
            cell.style = cell.style.replace(/section=([^;]+)/g, (match, sectionNum) => {
              const newSectionNum = sectionRenumberMap[sectionNum] || sectionNum;
              return `section=${newSectionNum}`;
            });
          }
        });
      }
      // Update section preferences through the proper accessor
      if (window.flowchartConfig && window.flowchartConfig.sectionPrefs) {
        window.flowchartConfig.sectionPrefs = renumberedSectionPrefs;
      } else {
        window.sectionPrefs = renumberedSectionPrefs;
      }
      // Test the getSectionPrefs function immediately after setting
      if (typeof getSectionPrefs === 'function') {
        const testResult = getSectionPrefs();
      }
      // updateSectionLegend is defined in legend.js
      // Add a small delay to ensure DOM is ready
      setTimeout(() => {
        // Check if section preferences have changed since we set them
        const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs;
        if (typeof updateSectionLegend === 'function') {
          updateSectionLegend();
        } else {
        }
      }, 50);
    } else {
      // No section preferences in import data, but we need to check if cells have sections
    }
    // After creating cells, check for missing section preferences and create them
    // Also ensure all cells have correct section numbers after renumbering
    setTimeout(() => {
      const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
      const usedSections = new Set();
      // Collect all sections used by cells
      const graph = window.graph;
      if (graph) {
        const allCells = graph.getChildVertices(graph.getDefaultParent());
        allCells.forEach(cell => {
        if (cell.style) {
          const sectionMatch = cell.style.match(/section=([^;]+)/);
          if (sectionMatch) {
              const sectionNum = sectionMatch[1];
              usedSections.add(sectionNum);
          }
        }
      });
      }
      // Create missing section preferences
      let needsUpdate = false;
      usedSections.forEach(sectionNum => {
        if (!currentSectionPrefs[sectionNum]) {
          currentSectionPrefs[sectionNum] = {
            borderColor: window.getDefaultSectionColor ? window.getDefaultSectionColor(parseInt(sectionNum)) : "#cccccc",
            name: `Section ${sectionNum}`
          };
          needsUpdate = true;
        }
      });
      if (needsUpdate) {
        // Update the section preferences
        if (window.flowchartConfig && window.flowchartConfig.sectionPrefs) {
          window.flowchartConfig.sectionPrefs = currentSectionPrefs;
        } else {
          window.sectionPrefs = currentSectionPrefs;
        }
        // Update the legend
        if (typeof updateSectionLegend === 'function') {
          updateSectionLegend();
        }
      }
    }, 100);
    // Convert text2 nodes to dropdown nodes before processing
    let text2ConversionCount = 0;
    data.cells.forEach(item => {
      if (item.vertex && item.style && item.style.includes('questionType=text2')) {
        // Replace text2 with dropdown in the style
        item.style = item.style.replace(/questionType=text2/g, 'questionType=dropdown');
        text2ConversionCount++;
      }
    });
    // Show conversion alert if any text2 nodes were converted
    if (text2ConversionCount > 0) {
      alert(`${text2ConversionCount} text2 nodes converted into dropdowns`);
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
        // Decode HTML entities in cell value to prevent double/triple encoding
        let cellValue = item.value;
        if (cellValue && typeof cellValue === 'string') {
          // Create a temporary div to decode HTML entities
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = cellValue;
          cellValue = tempDiv.textContent || tempDiv.innerText || cellValue;
        }
        const newCell = new mxCell(cellValue, geo, item.style);
        newCell.vertex = true;
        newCell.id = item.id;
        // Transfer all custom properties
        if (item._textboxes) {
          newCell._textboxes = JSON.parse(JSON.stringify(item._textboxes));
          // Initialize type property for old flowcharts that don't have it
          newCell._textboxes.forEach((tb, index) => {
            if (!tb.type) {
              // If type is missing, infer it from isAmountOption for backward compatibility
              tb.type = tb.isAmountOption ? 'amount' : 'label';
              console.log('[LIBRARY loadFlowchartData] Initialized missing type property', { 
                cellId: newCell.id, 
                index, 
                inferredType: tb.type, 
                isAmountOption: tb.isAmountOption 
              });
            }
          });
        }
        if (item._checkboxes) {
          newCell._checkboxes = JSON.parse(JSON.stringify(item._checkboxes));
        }
        if (item._itemOrder) {
          newCell._itemOrder = JSON.parse(JSON.stringify(item._itemOrder));
        }
        if (item._times) {
          newCell._times = JSON.parse(JSON.stringify(item._times));
        }
        if (item._dropdowns) {
          newCell._dropdowns = JSON.parse(JSON.stringify(item._dropdowns));
        }
        if (item._questionText) {
          // Decode HTML entities in _questionText as well
          let questionText = item._questionText;
          if (typeof questionText === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = questionText;
            questionText = tempDiv.textContent || tempDiv.innerText || questionText;
          }
          newCell._questionText = questionText;
        }
        if (item._twoNumbers) newCell._twoNumbers = item._twoNumbers;
        if (item._dropdownTitle) newCell._dropdownTitle = item._dropdownTitle;
        if (item._fileName) newCell._fileName = item._fileName;
        if (item._nameId) newCell._nameId = item._nameId;
        if (item._placeholder) newCell._placeholder = item._placeholder;
        if (item._questionId) newCell._questionId = item._questionId;
        if (item._locationIndex !== undefined && item._locationIndex !== null) newCell._locationIndex = item._locationIndex;
        if (item._locationTitle !== undefined && item._locationTitle !== null) newCell._locationTitle = item._locationTitle;
        // Amount option properties
        if (item._amountName) newCell._amountName = item._amountName;
        if (item._amountPlaceholder) newCell._amountPlaceholder = item._amountPlaceholder;
        // Image option
        if (item._image) newCell._image = item._image;
        // PDF node properties
        if (item._pdfName !== undefined) newCell._pdfName = item._pdfName;
        if (item._pdfFile !== undefined) newCell._pdfFile = item._pdfFile;
        if (item._pdfPrice !== undefined) newCell._pdfPrice = item._pdfPrice;
        if (item._pdfPreviewTitle !== undefined) newCell._pdfPreviewTitle = item._pdfPreviewTitle;
        if (item._pdfPreviewFile !== undefined) newCell._pdfPreviewFile = item._pdfPreviewFile;
        if (item._pdfPreviewFilename !== undefined) newCell._pdfPreviewFilename = item._pdfPreviewFilename;
        if (item._pdfPreviewPriceId !== undefined) newCell._pdfPreviewPriceId = item._pdfPreviewPriceId;
        if (item._pdfPreviewAttachment !== undefined) newCell._pdfPreviewAttachment = item._pdfPreviewAttachment;
        // Legacy PDF properties for backward compatibility
        if (item._pdfUrl !== undefined) newCell._pdfUrl = item._pdfUrl;
        if (item._priceId !== undefined) newCell._priceId = item._priceId;
        // Big Paragraph PDF Logic properties
        if (item._pdfLogicEnabled !== undefined) newCell._pdfLogicEnabled = item._pdfLogicEnabled;
        if (item._pdfTriggerLimit !== undefined) newCell._pdfTriggerLimit = item._pdfTriggerLimit;
        if (item._bigParagraphPdfName !== undefined) newCell._bigParagraphPdfName = item._bigParagraphPdfName;
        if (item._bigParagraphPdfFile !== undefined) newCell._bigParagraphPdfFile = item._bigParagraphPdfFile;
        if (item._bigParagraphPdfPrice !== undefined) newCell._bigParagraphPdfPrice = item._bigParagraphPdfPrice;
        if (item._characterLimit !== undefined) newCell._characterLimit = item._characterLimit;
        // Notes node properties
        if (item._notesText !== undefined) {
          let notesText = item._notesText;
          if (typeof notesText === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = notesText;
            notesText = tempDiv.textContent || tempDiv.innerText || notesText;
          }
          newCell._notesText = notesText;
        }
        if (item._notesBold !== undefined) newCell._notesBold = item._notesBold;
        if (item._notesFontSize !== undefined) newCell._notesFontSize = item._notesFontSize;
        // Checklist node properties
        if (item._checklistText !== undefined) {
          let checklistText = item._checklistText;
          if (typeof checklistText === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = checklistText;
            checklistText = tempDiv.textContent || tempDiv.innerText || checklistText;
          }
          newCell._checklistText = checklistText;
        }
        // Alert node properties
        if (item._alertText !== undefined) {
          let alertText = item._alertText;
          if (typeof alertText === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = alertText;
            alertText = tempDiv.textContent || tempDiv.innerText || alertText;
          }
          newCell._alertText = alertText;
        }
        // Currency node alert properties
        if (item._currencyAlerts) {
          newCell._currencyAlerts = JSON.parse(JSON.stringify(item._currencyAlerts));
        }
        // Hidden node properties
        if (item._hiddenNodeId !== undefined) newCell._hiddenNodeId = item._hiddenNodeId;
        if (item._defaultText !== undefined) {
          let defaultText = item._defaultText;
          if (typeof defaultText === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = defaultText;
            defaultText = tempDiv.textContent || tempDiv.innerText || defaultText;
          }
          newCell._defaultText = defaultText;
        } else {
        }
        // Linked logic node properties
        if (item._linkedLogicNodeId !== undefined) {
          newCell._linkedLogicNodeId = item._linkedLogicNodeId;
        }
        if (item._linkedFields !== undefined) {
          newCell._linkedFields = item._linkedFields;
        }
        if (item._linkedCheckboxNodeId !== undefined) {
          newCell._linkedCheckboxNodeId = item._linkedCheckboxNodeId;
        }
        if (item._linkedCheckboxOptions !== undefined) {
          newCell._linkedCheckboxOptions = item._linkedCheckboxOptions;
        }
        if (item._inverseCheckboxNodeId !== undefined) {
          newCell._inverseCheckboxNodeId = item._inverseCheckboxNodeId;
        }
        if (item._inverseCheckboxOption !== undefined) {
          newCell._inverseCheckboxOption = item._inverseCheckboxOption;
        }
        // Calculation properties
        if (item._calcTitle !== undefined) {
          let calcTitle = item._calcTitle;
          if (typeof calcTitle === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = calcTitle;
            calcTitle = tempDiv.textContent || tempDiv.innerText || calcTitle;
          }
          newCell._calcTitle = calcTitle;
        }
        if (item._calcAmountLabel !== undefined) {
          let calcAmountLabel = item._calcAmountLabel;
          if (typeof calcAmountLabel === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = calcAmountLabel;
            calcAmountLabel = tempDiv.textContent || tempDiv.innerText || calcAmountLabel;
          }
          newCell._calcAmountLabel = calcAmountLabel;
        }
        if (item._calcOperator !== undefined) newCell._calcOperator = item._calcOperator;
        if (item._calcThreshold !== undefined) newCell._calcThreshold = item._calcThreshold;
        if (item._calcFinalText !== undefined) {
          let calcFinalText = item._calcFinalText;
          if (typeof calcFinalText === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = calcFinalText;
            calcFinalText = tempDiv.textContent || tempDiv.innerText || calcFinalText;
          }
          newCell._calcFinalText = calcFinalText;
        }
        if (item._calcTerms !== undefined) newCell._calcTerms = JSON.parse(JSON.stringify(item._calcTerms));
        if (item._calcFinalOutputType !== undefined) newCell._calcFinalOutputType = item._calcFinalOutputType;
        if (item._calcFinalCheckboxChecked !== undefined) newCell._calcFinalCheckboxChecked = item._calcFinalCheckboxChecked;
        // Subtitle and info node properties - decode HTML entities
        if (item._subtitleText !== undefined) {
          let subtitleText = item._subtitleText;
          if (typeof subtitleText === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = subtitleText;
            subtitleText = tempDiv.textContent || tempDiv.innerText || subtitleText;
          }
          newCell._subtitleText = subtitleText;
        }
        if (item._infoText !== undefined) {
          let infoText = item._infoText;
          if (typeof infoText === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = infoText;
            infoText = tempDiv.textContent || tempDiv.innerText || infoText;
          }
          newCell._infoText = infoText;
        }
        // Checkbox availability
        if (item._checkboxAvailability !== undefined) newCell._checkboxAvailability = item._checkboxAvailability;
        // Big paragraph properties
        if (item._lineLimit !== undefined) newCell._lineLimit = item._lineLimit;
        if (item._characterLimit !== undefined) newCell._characterLimit = item._characterLimit;
        if (item._paragraphLimit !== undefined) newCell._paragraphLimit = item._paragraphLimit;
        graph.addCell(newCell, parent);
        createdCells[item.id] = newCell;
      }
    });
    // Handle duplicate node IDs after all cells are created
    resolveDuplicateNodeIds(Object.values(createdCells));
    // Second pass: Connect the edges
    let edgesCreated = 0;
    data.cells.forEach(item => {
      if (item.edge === true && item.source && item.target) {
        const source = createdCells[item.source];
        const target = createdCells[item.target];
        if (source && target) {
          const geo = new mxGeometry();
          // Restore edge geometry (articulation points) if it exists
          if (item.edgeGeometry && item.edgeGeometry.points && item.edgeGeometry.points.length > 0) {
            geo.points = item.edgeGeometry.points.map(point => new mxPoint(point.x, point.y));
          }
          const edge = new mxCell("", geo, item.style);
          edge.edge = true;
          edge.id = item.id;
          edge.source = source;
          edge.target = target;
          graph.addCell(edge, parent);
          edgesCreated++;
        } else {
        }
      } else {
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
        } else if (getQuestionType(cell) === 'notesNode') {
          updateNotesNodeCell(cell);
        } else if (getQuestionType(cell) === 'checklistNode') {
          updateChecklistNodeCell(cell);
        } else if (getQuestionType(cell) === 'alertNode') {
          updateAlertNodeCell(cell);
        } else if (isPdfNode(cell)) {
          updatePdfNodeCell(cell);
        } else if ((typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) ||
                   (typeof window.isLatexPdfPreviewNode === 'function' && window.isLatexPdfPreviewNode(cell))) {
          // Use the _pdfPreviewTitle property if available, otherwise use default
          if (!cell._pdfPreviewTitle && cell.value) {
            const cleanValue = cell.value.replace(/<[^>]+>/g, "").trim();
            const defaultTitle = (window.isLatexPdfPreviewNode && window.isLatexPdfPreviewNode(cell)) ? "Latex PDF Preview" : "PDF Preview";
            cell._pdfPreviewTitle = cleanValue || defaultTitle;
          }
          if (typeof window.updatePdfPreviewNodeCell === 'function') {
            window.updatePdfPreviewNodeCell(cell);
          }
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
    // Fourth pass: Ensure question nodes are editable
    Object.values(createdCells).forEach(cell => {
      if (isQuestion(cell)) {
        // Make sure question nodes are editable
        let style = cell.style || '';
        if (!style.includes('editable=1') && !style.includes('editable=0')) {
          style += ';editable=1;';
          graph.getModel().setStyle(cell, style);
        }
      }
    });
  } finally {
    graph.getModel().endUpdate();
  }
  refreshAllCells();
  // Call completion callback if provided (after main loading is done)
  if (typeof onCompleteCallback === 'function') {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      onCompleteCallback();
    });
  }
  // Load groups data if present (after sections are fully processed)
  if (data.groups) {
    loadGroupsFromData(data.groups);
  } else {
  }
  // Load default PDF properties if present, otherwise clear them
  if (data.defaultPdfProperties) {
    if (typeof window.setDefaultPdfProperties === 'function') {
      window.setDefaultPdfProperties(data.defaultPdfProperties);
    }
  } else {
    // Clear default PDF properties if the loaded flowchart doesn't have them
    if (typeof window.setDefaultPdfProperties === 'function') {
      window.setDefaultPdfProperties({ pdfName: "", pdfFile: "", pdfPrice: "" });
    }
  }
  // Load form name if present
  if (data.formName) {
    const formNameInput = document.getElementById('formNameInput');
    if (formNameInput) {
      formNameInput.value = data.formName;
    }
  }
  // Load edge style if present
  if (data.edgeStyle) {
    currentEdgeStyle = data.edgeStyle;
    // Update the settings UI if it exists
    const edgeStyleToggle = document.getElementById('edgeStyleToggle');
    if (edgeStyleToggle) {
      edgeStyleToggle.value = data.edgeStyle;
    }
    // Apply the edge style to the graph
    if (typeof updateEdgeStyle === 'function') {
      updateEdgeStyle();
    }
  } else {
  }
  // Propagate PDF properties through the flowchart after all cells and edges are loaded
  setTimeout(() => {
    propagatePdfPropertiesAfterImport();
  }, 500); // Increased delay to ensure all edges are fully processed in graph model
  // Validate and correct Node IDs after a 1-second delay to ensure everything is loaded
  setTimeout(() => {
    correctNodeIdsAfterImport();
  }, 1000);
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
};
/**
 * Resolves duplicate node IDs by adding numbering to duplicates
 */
function resolveDuplicateNodeIds(cells) {
  const nodeIdCounts = new Map();
  const nodeIdToCells = new Map();
  // First pass: collect all node IDs and their occurrences
  cells.forEach(cell => {
    const nodeId = (typeof window.getNodeId === 'function' ? window.getNodeId(cell) : '') || "";
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
// Export the generateCorrectNodeId function to window for use by other modules
window.generateCorrectNodeId = generateCorrectNodeId;
window.generateCorrectNodeId = generateCorrectNodeId;