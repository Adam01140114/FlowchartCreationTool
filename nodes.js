/**************************************************
 ************ Node Creation & Management **********
 **************************************************/

/**
 * Create a new node of the specified type at the given coordinates
 */
window.createNode = function(nodeType, x, y) {
  if (!graph) {
    console.error('Graph not initialized');
    return null;
  }
  
  const parent = graph.getDefaultParent();
  let vertex = null;
  
  try {
    switch (nodeType) {
      case 'question':
        vertex = createQuestionNode(x, y);
        break;
      case 'options':
        vertex = createOptionsNode(x, y);
        break;
      case 'calculation':
        vertex = createCalculationNode(x, y);
        break;
      case 'notesNode':
        vertex = createNotesNode(x, y);
        break;
      case 'checklistNode':
        vertex = createChecklistNode(x, y);
        break;
      case 'subtitle':
        vertex = createSubtitleNode(x, y);
        break;
      case 'info':
        vertex = createInfoNode(x, y);
        break;
      case 'imageOption':
        vertex = createImageNode(x, y);
        break;
      case 'pdfNode':
        vertex = createPdfNode(x, y);
        break;
      case 'amountOption':
        vertex = createAmountNode(x, y);
        break;
      case 'end':
        vertex = createEndNode(x, y);
        break;
      case 'hiddenCheckbox':
        vertex = createHiddenCheckboxNode(x, y);
        break;
      case 'hiddenTextbox':
        vertex = createHiddenTextboxNode(x, y);
        break;
      case 'linkedLogic':
        vertex = createLinkedLogicNode(x, y);
        break;
      default:
        console.error('Unknown node type:', nodeType);
        return null;
    }
    
    if (vertex) {
      // Set default section
      setSection(vertex, "1");
      
      // Update the cell display
      if (window.updateCellDisplay) {
        window.updateCellDisplay(vertex);
      }
    }
    
    return vertex;
  } catch (error) {
    console.error('Error creating node:', error);
    return null;
  }
};

/**
 * Create a question node
 */
function createQuestionNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 200, 100, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=question;questionType=text;section=1;');
  
  // Set default properties
  vertex._questionText = "Enter question text";
  vertex._questionId = generateQuestionId();
  
  // Set default _nameId using naming convention
  vertex._nameId = "enter_question_text";
  
  // Set the Node ID in the style to ensure it's properly saved
  if (typeof window.setNodeId === 'function') {
    window.setNodeId(vertex, "enter_question_text");
  }
  
  return vertex;
}

/**
 * Create an options node
 */
function createOptionsNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 150, 80, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=options;section=1;');
  
  // Set default properties
  vertex.value = "Option";
  
  return vertex;
}

/**
 * Create a calculation node
 */
function createCalculationNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 400, 450, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=calculation;section=1;');
  
  // Set default properties
  vertex._calcTitle = "Calculation Title";
  vertex._calcTerms = [{amountLabel: "", mathOperator: ""}];
  vertex._calcOperator = "=";
  vertex._calcThreshold = "0";
  vertex._calcFinalText = "";
  
  return vertex;
}

/**
 * Create a notes node
 */
function createNotesNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 200, 100, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=notesNode;section=1;');
  
  // Set default properties
  vertex._notesText = "Enter notes here";
  vertex._notesBold = false;
  vertex._notesFontSize = "14";
  
  // Initialize the notes node with proper styling
  updateNotesNodeCell(vertex);
  
  return vertex;
}

/**
 * Create a checklist node
 */
function createChecklistNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 200, 120, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=checklistNode;section=1;');
  
  // Set default properties
  vertex._checklistText = "Checklist Item";
  
  return vertex;
}

/**
 * Create a subtitle node
 */
function createSubtitleNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 150, 40, 
    'rounded=0;whiteSpace=wrap;html=1;nodeType=subtitle;section=1;');
  
  // Set default properties
  vertex.value = "Subtitle";
  
  return vertex;
}

/**
 * Create an info node
 */
function createInfoNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 180, 80, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=info;section=1;');
  
  // Set default properties
  vertex.value = "Information";
  
  return vertex;
}

/**
 * Create an image node
 */
function createImageNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 120, 80, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=imageOption;section=1;');
  
  // Set default properties
  vertex._image = "";
  
  return vertex;
}

/**
 * Create a PDF node
 */
function createPdfNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 200, 100, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=pdfNode;section=1;');
  
  // Set default properties for the 3 required fields
  vertex._pdfName = "PDF Document";
  vertex._pdfFile = "";
  vertex._pdfPrice = "";
  
  return vertex;
}

/**
 * Create an amount node
 */
function createAmountNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 150, 80, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=amountOption;section=1;');
  
  // Set default properties
  vertex._amountName = "Amount";
  vertex._amountPlaceholder = "Enter amount";
  
  return vertex;
}

/**
 * Create an end node
 */
function createEndNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 80, 80, 
    'ellipse;whiteSpace=wrap;html=1;nodeType=end;section=1;');
  
  // Set default properties
  vertex.value = "END";
  
  return vertex;
}

/**
 * Create a hidden checkbox node
 */
function createHiddenCheckboxNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 150, 80, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=hiddenCheckbox;section=1;strokeWidth=3;strokeColor=#0066CC;strokeDasharray=5,5;');
  
  // Set default properties
  vertex.value = "Hidden Checkbox";
  vertex._hiddenNodeId = "hidden_checkbox";
  
  return vertex;
}

/**
 * Create a hidden textbox node
 */
function createHiddenTextboxNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 150, 80, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=hiddenTextbox;section=1;strokeWidth=3;strokeColor=#0066CC;strokeDasharray=5,5;');
  
  // Set default properties
  vertex.value = "Hidden Textbox";
  vertex._hiddenNodeId = "hidden_textbox";
  vertex._defaultText = "";
  
  return vertex;
}

function createLinkedLogicNode(x, y) {
  const parent = graph.getDefaultParent();
  const vertex = graph.insertVertex(parent, null, '', x, y, 150, 80, 
    'rounded=1;whiteSpace=wrap;html=1;nodeType=linkedLogic;section=1;fillColor=#DDA0DD;strokeColor=#9370DB;');
  
  // Set default properties
  vertex.value = "Linked Logic";
  vertex._linkedLogicNodeId = "linked_logic";
  vertex._linkedFields = []; // Array to store linked field IDs
  
  return vertex;
}

/**
 * Generate a unique question ID
 */
function generateQuestionId() {
  return 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Check if a cell is a question node
 */
window.isQuestion = function(cell) {
  return cell && cell.style && cell.style.includes("nodeType=question");
};

/**
 * Check if a cell is an options node
 */
window.isOptions = function(cell) {
  return cell && cell.style && cell.style.includes("nodeType=options");
};

/**
 * Check if a cell is a calculation node
 */
window.isCalculationNode = function(cell) {
  return cell && cell.style && cell.style.includes("nodeType=calculation");
};

/**
 * Check if a cell is an amount option
 */
window.isAmountOption = function(cell) {
  return cell && cell.style && cell.style.includes("nodeType=amountOption");
};

/**
 * Check if a cell is a hidden checkbox node
 */
window.isHiddenCheckbox = function(cell) {
  return cell && cell.style && cell.style.includes("nodeType=hiddenCheckbox");
};

/**
 * Check if a cell is a hidden textbox node
 */
window.isHiddenTextbox = function(cell) {
  return cell && cell.style && cell.style.includes("nodeType=hiddenTextbox");
};

/**
 * Check if a cell is a linked logic node
 */
window.isLinkedLogicNode = function(cell) {
  return cell && cell.style && cell.style.includes("nodeType=linkedLogic");
};

/**
 * Update linked logic node cell display
 */
window.updateLinkedLogicNodeCell = function(cell) {
  if (!cell) return;
  
  // Update the display value with the Node ID
  const nodeId = cell._linkedLogicNodeId || 'linked_logic';
  cell.value = nodeId;
  
  // Update the graph display
  if (window.graph) {
    window.graph.refresh(cell);
  }
};

/**
 * Update hidden checkbox node cell display
 */
window.updateHiddenCheckboxNodeCell = function(cell) {
  if (!cell) return;
  
  const text = cell._hiddenNodeId || "Hidden Checkbox";
  const html = `<div style="text-align:center;padding:8px;">${text}</div>`;
  cell.value = html;
  
  // Update the graph display
  if (window.graph) {
    window.graph.refresh(cell);
  }
};

/**
 * Update hidden textbox node cell display
 */
window.updateHiddenTextboxNodeCell = function(cell) {
  if (!cell) return;
  
  const text = cell._hiddenNodeId || "Hidden Textbox";
  const html = `<div style="text-align:center;padding:8px;">${text}</div>`;
  cell.value = html;
  
  // Update the graph display
  if (window.graph) {
    window.graph.refresh(cell);
  }
};

/**
 * Get the question type from a cell
 */
window.getQuestionType = function(cell) {
  if (!isQuestion(cell)) return null;
  
  const style = cell.style || "";
  const match = style.match(/questionType=([^;]+)/);
  return match ? match[1] : "text";
};

/**
 * Get the node ID from a cell
 */
window.getNodeId = function(cell) {
  // Debug mode - set to true only when debugging node ID issues
  const DEBUG_NODE_ID = false;
  
  if (DEBUG_NODE_ID) {
    console.log("🌐 WINDOW GET NODE ID DEBUG START");
    console.log("Cell:", cell);
    console.log("Cell._nameId:", cell._nameId);
    console.log("Cell.style:", cell.style);
    console.log("Cell.id:", cell.id);
  }
  
  // PRIORITY 1: Return existing Node ID from style if it exists (most reliable)
  if (cell.style) {
    const styleMatch = cell.style.match(/nodeId=([^;]+)/);
    if (styleMatch) {
      const existingNodeId = decodeURIComponent(styleMatch[1]);
      // Only return existing Node ID if it's not a temporary/default one
      if (existingNodeId && 
          existingNodeId !== 'new_question' && 
          !existingNodeId.startsWith('Option_') &&
          existingNodeId !== 'unnamed_node' &&
          existingNodeId !== 'N/A') {
        return existingNodeId;
      }
    }
  }
  
  // PRIORITY 2: Return _nameId if it exists and is not temporary/default
  if (cell._nameId && 
      cell._nameId !== 'new_question' && 
      !cell._nameId.startsWith('Option_') &&
      cell._nameId !== 'unnamed_node' &&
      cell._nameId !== 'N/A') {
    return cell._nameId;
  }
  
  // PRIORITY 3: Return cell.id if it's not temporary/default
  if (cell.id && 
      cell.id !== 'new_question' && 
      !cell.id.startsWith('Option_') &&
      cell.id !== 'unnamed_node' &&
      cell.id !== 'N/A') {
    return cell.id;
  }
  
  // If this Node ID has been manually edited, return the existing Node ID without modification
  if (cell._manuallyEditedNodeId) {
    // Return the existing Node ID from style or _nameId without applying PDF naming convention
    if (cell.style) {
      const styleMatch = cell.style.match(/nodeId=([^;]+)/);
      if (styleMatch) {
        return decodeURIComponent(styleMatch[1]);
      }
    }
    if (cell._nameId) {
      return cell._nameId;
    }
    return cell.id || '';
  }
  
  // Use the global function for reading PDF names from HTML inputs

  // Helper function to get PDF name from cell (now reads dynamically from PDF nodes)
  const getPdfName = (cell, visited = new Set()) => {
    if (DEBUG_NODE_ID) {
      console.log("🔍 GET PDF NAME DEBUG START for cell:", cell.id);
    }
    // Check for PDF properties in various formats - only if they're not empty and not default values
    if (cell._pdfName && cell._pdfName.trim() && cell._pdfName.trim() !== "PDF Document") return cell._pdfName.trim();
    if (cell._pdfFilename && cell._pdfFilename.trim()) return cell._pdfFilename.trim();
    if (cell._pdfFile && cell._pdfFile.trim()) return cell._pdfFile.trim();
    if (cell._pdfUrl && cell._pdfUrl.trim()) {
      // Extract filename from URL
      const urlParts = cell._pdfUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      const cleanFilename = filename.replace(/\.pdf$/i, '').trim(); // Remove .pdf extension
      return cleanFilename || null; // Return null if filename is empty after cleaning
    }
    
    // Check if this node is connected to a PDF node (either directly or through flow path)
    const graph = window.graph;
    if (graph) {
      // Helper function to extract PDF name from a cell (now reads dynamically from HTML inputs)
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
          const cleanFilename = filename.replace(/\.pdf$/i, '').trim(); // Remove .pdf extension
          return cleanFilename || null; // Return null if filename is empty after cleaning
        }
        
        return null;
      };
      
      // Check direct connections first - look for PDF nodes
      const outgoingEdges = graph.getOutgoingEdges(cell) || [];
      let pdfNode = outgoingEdges.find(edge => {
        const target = edge.target;
        return typeof window.isPdfNode === 'function' && window.isPdfNode(target);
      });
      
      if (pdfNode) {
        const pdfName = extractPdfName(pdfNode.target);
        if (pdfName) return pdfName;
      }
      
      // PDF inheritance flows both ways: from incoming edges (downstream) and to outgoing edges (upstream)
      
      // Check incoming edges for PDF properties (nodes that point to this node)
      const incomingEdges = graph.getIncomingEdges(cell) || [];
      if (DEBUG_NODE_ID) {
        console.log("🔍 Checking incoming edges for cell:", cell.id, "incoming edges:", incomingEdges.length);
      }
      for (const edge of incomingEdges) {
        const sourceCell = edge.source;
        if (sourceCell && !visited.has(sourceCell.id)) {
          visited.add(sourceCell.id);
          
          if (DEBUG_NODE_ID) {
            console.log("🔍 Checking source cell:", sourceCell.id, "for PDF properties");
            console.log("🔍 Source cell PDF properties:", {
              _pdfName: sourceCell._pdfName,
              _pdfFilename: sourceCell._pdfFilename,
              _pdfUrl: sourceCell._pdfUrl,
              isPdfNode: typeof window.isPdfNode === 'function' ? window.isPdfNode(sourceCell) : 'function not available'
            });
            
            // Also check if the source cell has outgoing edges to PDF nodes
            const sourceOutgoingEdges = graph.getOutgoingEdges(sourceCell) || [];
            console.log("🔍 Source cell outgoing edges:", sourceOutgoingEdges.length);
            for (const edge of sourceOutgoingEdges) {
              const target = edge.target;
              if (target && typeof window.isPdfNode === 'function' && window.isPdfNode(target)) {
                console.log("🔍 Source cell connects to PDF node:", target.id);
                const pdfName = extractPdfName(target);
                if (pdfName) {
                  console.log("🔍 Found PDF name from source cell's PDF connection:", pdfName);
                  return pdfName;
                }
              }
            }
          }
          
          // Check if the source node has PDF properties (PDF inheritance)
          if ((sourceCell._pdfName && sourceCell._pdfName.trim() && sourceCell._pdfName.trim() !== "PDF Document") || 
              (sourceCell._pdfFilename && sourceCell._pdfFilename.trim()) || 
              (sourceCell._pdfFile && sourceCell._pdfFile.trim()) ||
              (sourceCell._pdfUrl && sourceCell._pdfUrl.trim())) {
            const pdfName = extractPdfName(sourceCell);
            if (pdfName) {
              if (DEBUG_NODE_ID) {
                console.log("🔍 Found PDF inheritance from source cell:", pdfName);
              }
              return pdfName;
            }
          }
          
          // Check if the source node is a PDF node
          if (typeof window.isPdfNode === 'function' && window.isPdfNode(sourceCell)) {
            const pdfName = extractPdfName(sourceCell);
            if (pdfName) {
              if (DEBUG_NODE_ID) {
                console.log("🔍 Found PDF name from source cell isPdfNode:", pdfName);
              }
              return pdfName;
            }
          }
        }
      }
      
      // PDF inheritance only flows downstream (from incoming edges), not upstream (outgoing edges)
    }
    
    return null;
  };
  
  // Get the base node ID
  let baseNodeId = '';
  
  // PRIORITY 1: Check for nodeId in the style string (set by setNodeId function)
  // This should take precedence over _nameId since it's the most current value
  if (cell.style) {
    const styleMatch = cell.style.match(/nodeId=([^;]+)/);
    if (DEBUG_NODE_ID) {
      console.log("Style match:", styleMatch);
    }
    if (styleMatch) {
      let styleNodeId = decodeURIComponent(styleMatch[1]);
      
      // Remove any existing PDF prefix from the style nodeId to get the base ID
      // This prevents double-prefixing when the style already contains a PDF prefix
      const pdfPrefixMatch = styleNodeId.match(/^([^_]+)_(.+)$/);
      if (pdfPrefixMatch) {
        // Check if the first part looks like a PDF name (common patterns)
        const potentialPdfName = pdfPrefixMatch[1];
        if (potentialPdfName.match(/^(form|sc|pdf|document)\d*$/i)) {
          baseNodeId = pdfPrefixMatch[2]; // Use the part after the PDF prefix
          if (DEBUG_NODE_ID) {
            console.log("Removed PDF prefix from style nodeId:", potentialPdfName, "-> base:", baseNodeId);
          }
        } else {
          baseNodeId = styleNodeId; // No PDF prefix detected, use as-is
        }
      } else {
        baseNodeId = styleNodeId; // No underscore found, use as-is
      }
      
      if (DEBUG_NODE_ID) {
        console.log("Base nodeId from style (after PDF prefix removal):", baseNodeId);
      }
    }
  }
  
  // PRIORITY 2: For question nodes, use _nameId as fallback
  if (!baseNodeId && cell._nameId) {
    baseNodeId = cell._nameId;
    if (DEBUG_NODE_ID) {
      console.log("Base nodeId from _nameId:", baseNodeId);
    }
  }
  
  // PRIORITY 3: Generate base Node ID from node text if we don't have a good one
  if (!baseNodeId || baseNodeId.match(/^\d+$/)) {
    // Extract text from the node
    let nodeText = '';
    if (cell._questionText) {
      nodeText = cell._questionText;
    } else if (cell.value) {
      // Clean HTML from cell value
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cell.value;
      nodeText = tempDiv.textContent || tempDiv.innerText || '';
    }
    
    if (nodeText) {
      baseNodeId = nodeText.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        ; // No length limit
      
      if (DEBUG_NODE_ID) {
        console.log("Generated base nodeId from text:", baseNodeId);
      }
    }
  }
  
  // PRIORITY 4: Fallback to cell.id
  if (!baseNodeId) {
    baseNodeId = cell.id || "";
    if (DEBUG_NODE_ID) {
      console.log("Base nodeId from cell.id:", baseNodeId);
    }
  }
  
  // DISABLED: PDF naming convention application has been completely disabled
  // Node IDs will only be set when manually edited or reset using the button
  // Users will set all Node IDs at the end when the structure is complete
  
  let finalNodeId = baseNodeId;
  
  // DISABLED: PDF naming convention application
  // All PDF naming convention logic has been disabled
  // Node IDs will only be set when manually edited or reset using the button
  finalNodeId = baseNodeId;
  
  if (DEBUG_NODE_ID) {
    console.log("Returning final nodeId:", finalNodeId);
    console.log("🌐 WINDOW GET NODE ID DEBUG END");
  }
  return finalNodeId;
};

/**
 * Sanitize a name ID for use in JSON export
 */
window.sanitizeNameId = function(name) {
  if (!name) return "";
  return name.toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
};

// Export utility functions for use in other modules
window.setSection = function(cell, sectionNum) {
  if (window.setSection) {
    window.setSection(cell, sectionNum);
  }
};




