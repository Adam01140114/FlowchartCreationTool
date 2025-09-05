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
  const vertex = graph.insertVertex(parent, null, '', x, y, 250, 120, 
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
  
  // Set default properties
  vertex._pdfUrl = "";
  vertex._priceId = "";
  vertex._characterLimit = 1000;
  
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
  console.log("🌐 WINDOW GET NODE ID DEBUG START");
  console.log("Cell:", cell);
  console.log("Cell._nameId:", cell._nameId);
  console.log("Cell.style:", cell.style);
  console.log("Cell.id:", cell.id);
  
  // Helper function to get PDF name from cell
  const getPdfName = (cell) => {
    // Check for PDF properties in various formats
    if (cell._pdfName) return cell._pdfName;
    if (cell._pdfFilename) return cell._pdfFilename;
    if (cell._pdfUrl) {
      // Extract filename from URL
      const urlParts = cell._pdfUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      return filename.replace(/\.pdf$/i, ''); // Remove .pdf extension
    }
    
    // Check if this node is connected to a PDF node (either directly or through flow path)
    const graph = window.graph;
    if (graph) {
      // Helper function to extract PDF name from a cell
      const extractPdfName = (targetCell) => {
        if (targetCell._pdfName) return targetCell._pdfName;
        if (targetCell._pdfFilename) return targetCell._pdfFilename;
        if (targetCell._pdfUrl) {
          const urlParts = targetCell._pdfUrl.split('/');
          const filename = urlParts[urlParts.length - 1];
          return filename.replace(/\.pdf$/i, ''); // Remove .pdf extension
        }
        // Try to extract from the PDF node's value
        if (targetCell.value) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = targetCell.value || "";
          const pdfText = (tempDiv.textContent || tempDiv.innerText || "").trim();
          return pdfText.replace(/\.pdf$/i, ''); // Remove .pdf extension
        }
        return null;
      };
      
      // Check direct connections first
      const outgoingEdges = graph.getOutgoingEdges(cell) || [];
      let pdfNode = outgoingEdges.find(edge => {
        const target = edge.target;
        return typeof window.isPdfNode === 'function' && window.isPdfNode(target);
      });
      
      if (pdfNode) {
        const pdfName = extractPdfName(pdfNode.target);
        if (pdfName) return pdfName;
      }
      
      // Check incoming edges for direct PDF connections
      const incomingEdges = graph.getIncomingEdges(cell) || [];
      pdfNode = incomingEdges.find(edge => {
        const source = edge.source;
        return typeof window.isPdfNode === 'function' && window.isPdfNode(source);
      });
      
      if (pdfNode) {
        const pdfName = extractPdfName(pdfNode.source);
        if (pdfName) return pdfName;
      }
      
      // If no direct connection, trace the flow path to find PDF nodes
      // This handles cases where a question node should inherit PDF name from the flow
      console.log("🔍 Starting flow path tracing for PDF detection");
      const visited = new Set();
      const queue = [...incomingEdges.map(edge => edge.source)];
      console.log("🔍 Initial queue:", queue.map(node => ({ id: node.id, type: node.style?.includes('nodeType=') ? 'node' : 'unknown' })));
      
      while (queue.length > 0) {
        const currentNode = queue.shift();
        if (!currentNode || visited.has(currentNode.id)) continue;
        visited.add(currentNode.id);
        
        console.log("🔍 Checking node:", { id: currentNode.id, style: currentNode.style, _pdfUrl: currentNode._pdfUrl });
        
        // Check if this node is a PDF node
        if (typeof window.isPdfNode === 'function' && window.isPdfNode(currentNode)) {
          console.log("🔍 Found PDF node via isPdfNode function");
          const pdfName = extractPdfName(currentNode);
          if (pdfName) {
            console.log("🔍 Extracted PDF name:", pdfName);
            return pdfName;
          }
        }
        
        // Check if this node has PDF properties
        if (currentNode._pdfName || currentNode._pdfFilename || currentNode._pdfUrl) {
          console.log("🔍 Found node with PDF properties:", { _pdfName: currentNode._pdfName, _pdfFilename: currentNode._pdfFilename, _pdfUrl: currentNode._pdfUrl });
          const pdfName = extractPdfName(currentNode);
          if (pdfName) {
            console.log("🔍 Extracted PDF name from properties:", pdfName);
            return pdfName;
          }
        }
        
        // Add incoming edges to continue tracing backwards
        const nodeIncomingEdges = graph.getIncomingEdges(currentNode) || [];
        console.log("🔍 Node", currentNode.id, "has", nodeIncomingEdges.length, "incoming edges");
        for (const edge of nodeIncomingEdges) {
          if (edge.source && !visited.has(edge.source.id)) {
            queue.push(edge.source);
            console.log("🔍 Added to queue (incoming):", edge.source.id);
          }
        }
        
        // Also check outgoing edges to find PDF nodes connected to option nodes
        const nodeOutgoingEdges = graph.getOutgoingEdges(currentNode) || [];
        console.log("🔍 Node", currentNode.id, "has", nodeOutgoingEdges.length, "outgoing edges");
        for (const edge of nodeOutgoingEdges) {
          if (edge.target && !visited.has(edge.target.id)) {
            // Check if this outgoing edge leads to a PDF node
            if (typeof window.isPdfNode === 'function' && window.isPdfNode(edge.target)) {
              console.log("🔍 Found PDF node via outgoing edge:", edge.target.id);
              const pdfName = extractPdfName(edge.target);
              if (pdfName) {
                console.log("🔍 Extracted PDF name from outgoing edge:", pdfName);
                return pdfName;
              }
            }
            // Check if this outgoing edge leads to a node with PDF properties
            if (edge.target._pdfName || edge.target._pdfFilename || edge.target._pdfUrl) {
              console.log("🔍 Found node with PDF properties via outgoing edge:", { id: edge.target.id, _pdfUrl: edge.target._pdfUrl });
              const pdfName = extractPdfName(edge.target);
              if (pdfName) {
                console.log("🔍 Extracted PDF name from outgoing edge properties:", pdfName);
                return pdfName;
              }
            }
            // Add to queue for further tracing
            queue.push(edge.target);
            console.log("🔍 Added to queue (outgoing):", edge.target.id);
          }
        }
      }
      console.log("🔍 Flow path tracing completed, no PDF found");
    }
    
    return null;
  };
  
  // Get the base node ID
  let baseNodeId = '';
  
  // PRIORITY 1: Check for nodeId in the style string (set by setNodeId function)
  // This should take precedence over _nameId since it's the most current value
  if (cell.style) {
    const styleMatch = cell.style.match(/nodeId=([^;]+)/);
    console.log("Style match:", styleMatch);
    if (styleMatch) {
      baseNodeId = decodeURIComponent(styleMatch[1]);
      console.log("Base nodeId from style:", baseNodeId);
    }
  }
  
  // PRIORITY 2: For question nodes, use _nameId as fallback
  if (!baseNodeId && cell._nameId) {
    baseNodeId = cell._nameId;
    console.log("Base nodeId from _nameId:", baseNodeId);
  }
  
  // PRIORITY 3: Fallback to cell.id
  if (!baseNodeId) {
    baseNodeId = cell.id || "";
    console.log("Base nodeId from cell.id:", baseNodeId);
  }
  
  // Check for PDF name and prepend it if found
  const pdfName = getPdfName(cell);
  console.log("PDF name found:", pdfName);
  
  let finalNodeId = baseNodeId;
  if (pdfName && pdfName.trim()) {
    // Sanitize PDF name (remove .pdf extension and clean up)
    const cleanPdfName = pdfName.replace(/\.pdf$/i, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    finalNodeId = `${cleanPdfName}_${baseNodeId}`;
    console.log("Final nodeId with PDF prefix:", finalNodeId);
  }
  
  console.log("Returning final nodeId:", finalNodeId);
  console.log("🌐 WINDOW GET NODE ID DEBUG END");
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




