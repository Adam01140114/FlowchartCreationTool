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
  return cell.id || "";
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




