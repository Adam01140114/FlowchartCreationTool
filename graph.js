/**************************************************
 *              GRAPH MANAGEMENT MODULE            *
 **************************************************/

// Import configuration from config.js
// Note: This assumes config.js is loaded before graph.js

/**
 * Initialize the mxGraph with all necessary configuration and event handlers
 */
function initializeGraph() {
  // Create the graph inside the specified container
  const container = document.getElementById('graphContainer');
  if (!container) {
    console.error('Graph container not found');
    return null;
  }
  
  const graph = new mxGraph(container);
  
  // Performance optimizations
  graph.setAllowLoops(false);
  graph.setAllowDanglingEdges(false);
  // Note: setAllowParallelEdges doesn't exist in mxGraph
  graph.setConnectable(true);
  graph.setCellsEditable(true);
  graph.setCellsResizable(true);
  graph.setCellsMovable(true);
  // Note: Some of these methods don't exist in this version of mxGraph
  // graph.setCellsBendable(true);
  // graph.setCellsCloneable(true);
  // graph.setCellsDisconnectable(true);
  // graph.setCellsSelectable(true);
  // graph.setCellsDeletable(true);
  // graph.setCellsConnectable(true);
  graph.setDropEnabled(false);
  graph.setSplitEnabled(false);
  // Note: setDisconnectOnMove doesn't exist in this version of mxGraph
  // graph.setDisconnectOnMove(false);
  
  // Set default edge style
  const defaultEdgeStyle = graph.getStylesheet().getDefaultEdgeStyle();
  defaultEdgeStyle[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
  defaultEdgeStyle[mxConstants.STYLE_ROUNDED] = true;
  defaultEdgeStyle[mxConstants.STYLE_ORTHOGONAL_LOOP] = true;
  defaultEdgeStyle[mxConstants.STYLE_JETTY_SIZE] = 'auto';
  
  // Optimize rendering for better performance
  graph.setHtmlLabels(true);
  graph.setTooltips(true);
  
  // Set up event handlers
  setupGraphEventHandlers(graph);
  
  // Set up custom editing behavior
  setupCustomGraphEditing(graph);
  
  // Set up custom double-click behavior
  setupCustomDoubleClickBehavior(graph);
  
  // Set up keyboard navigation
  setupKeyboardNavigation(graph);
  
  // Set up panning and zooming
  setupPanningAndZooming(graph);
  
  return graph;
}

/**
 * Set up all graph event handlers
 */
function setupGraphEventHandlers(graph) {
  // Cell selection change
  graph.getSelectionModel().addListener(mxEvent.CHANGE, function(sender, evt) {
    const selection = graph.getSelectionCells();
    if (selection.length > 0) {
      // Properties panel update is handled in script.js
    }
  });
  
  // Mouse event handling is done in script.js
  // Removed mouse event handlers to avoid calling non-existent functions
  
  // Graph model change
  graph.getModel().addListener(mxEvent.CHANGE, function(sender, evt) {
    const changes = evt.getProperty('edit').changes;
    changes.forEach(change => {
      if (change instanceof mxValueChange) {
        // Cell display updates are handled in script.js
      }
    });
  });
}

/**
 * Set up custom editing behavior for specific node types
 */
function setupCustomGraphEditing(graph) {
  // Override getEditingValue for specific node types
  const origGetEditingValue = graph.getEditingValue.bind(graph);
  graph.getEditingValue = function (cell, evt) {
    if (isSimpleHtmlQuestion(cell) || 
        (isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) ||
        isSubtitleNode(cell) ||
        isInfoNode(cell)) {
      const tmp = document.createElement("div");
      tmp.innerHTML = cell.value || "";
      return tmp.textContent || tmp.innerText || "";
    }
    return origGetEditingValue(cell, evt);
  };
  
  // Handle label changes for specific node types
  graph.addListener(mxEvent.LABEL_CHANGED, (sender, evt) => {
    const cell = evt.getProperty("cell");
    let value = evt.getProperty("value");   // plain text the user typed
    
    if (isSimpleHtmlQuestion(cell)) {
      value = mxUtils.htmlEntities(value || "");           // escape <>&
      graph.getModel().setValue(
        cell,
        `<div style="text-align:center;">${value}</div>`
      );
      
      // For text2 cells, also update _questionText for export
      if (getQuestionType(cell) === "text2") {
        cell._questionText = value;
      }
      
      evt.consume();   // stop mxGraph from writing the raw text
    } else if (isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) {
      // For regular option nodes, update the label and node ID
      graph.getModel().beginUpdate();
      try {
        // Set the clean value
        value = value.trim() || "Option";
        // Wrap the plain text in a centered div, escaping any HTML
        value = `<div style="text-align:center;">${mxUtils.htmlEntities(value)}</div>`;
        graph.getModel().setValue(cell, value);
        
        // Update the option node ID based on the new label
        if (window.refreshOptionNodeId) {
          window.refreshOptionNodeId(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      if (window.refreshAllCells) {
        window.refreshAllCells();
      }
      evt.consume();
    } else if (isSubtitleNode(cell)) {
      // Update subtitle node
      graph.getModel().beginUpdate();
      try {
        // Save the plain text in the _subtitleText property
        value = value.trim() || "Subtitle text";
        cell._subtitleText = value;
        
        // Update the display value with the appropriate styling
        if (window.updateSubtitleNodeCell) {
          window.updateSubtitleNodeCell(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      evt.consume();
    } else if (isInfoNode(cell)) {
      // Update info node
      graph.getModel().beginUpdate();
      try {
        // Save the plain text in the _infoText property
        value = value.trim() || "Information text";
        cell._infoText = value;
        
        // Update the display value with the appropriate styling
        if (window.updateInfoNodeCell) {
          window.updateInfoNodeCell(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      evt.consume();
    } else if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) {
      // Update hidden checkbox node - sync text with node ID
      graph.getModel().beginUpdate();
      try {
        // Save the plain text and sync with node ID
        value = value.trim() || "Hidden Checkbox";
        cell._hiddenNodeId = value;
        
        // Update the display value with the appropriate styling
        if (window.updateHiddenCheckboxNodeCell) {
          window.updateHiddenCheckboxNodeCell(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      evt.consume();
    } else if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
      // Update hidden textbox node - sync text with node ID
      graph.getModel().beginUpdate();
      try {
        // Save the plain text and sync with node ID
        value = value.trim() || "Hidden Textbox";
        cell._hiddenNodeId = value;
        
        // Update the display value with the appropriate styling
        if (window.updateHiddenTextboxNodeCell) {
          window.updateHiddenTextboxNodeCell(cell);
        }
      } finally {
        graph.getModel().endUpdate();
      }
      
      evt.consume();
    }
  });
}

/**
 * Set up custom double-click behavior for specific node types
 */
function setupCustomDoubleClickBehavior(graph) {
  

  

  
  // Track clicks to detect double-clicks manually
  let lastClickTime = 0;
  let lastClickedCell = null;
  const DOUBLE_CLICK_DELAY = 250; // 250ms = quarter of a second
  
  // Track the currently selected cell for click-out detection
  let currentlySelectedCell = null;
  let clickOutTimeout = null;
  
  // Add click listener to detect double-clicks and click-out
  graph.addListener(mxEvent.CLICK, function(sender, evt) {
    const cell = evt.getProperty('cell');
    const domEvent = evt.getProperty('event'); // Get the original DOM event
    
    // Only process left clicks (button 0), ignore right clicks (button 2)
    if (domEvent && domEvent.button !== 0) {
      return;
    }
    
    // Clear any pending click-out reset
    if (clickOutTimeout) {
      clearTimeout(clickOutTimeout);
      clickOutTimeout = null;
    }
    
    // Handle click-out: if we had a selected cell and now clicking on empty space or different cell
    if (currentlySelectedCell && currentlySelectedCell !== cell) {
      // Debounce the reset operations to improve performance on large graphs
      clickOutTimeout = setTimeout(() => {
        // Reset PDF and ID for the previously selected cell
        if (typeof window.resetPdfInheritance === 'function' && currentlySelectedCell) {
          window.resetPdfInheritance(currentlySelectedCell);
        }
        
        // Reset node ID by clearing any custom ID properties
        if (currentlySelectedCell && currentlySelectedCell._nameId) {
          currentlySelectedCell._nameId = '';
        }
        if (currentlySelectedCell && currentlySelectedCell._customId) {
          currentlySelectedCell._customId = '';
        }
        clickOutTimeout = null;
      }, 100); // Small delay to batch operations
    }
    
    // Update currently selected cell
    currentlySelectedCell = cell;
    
    if (cell && cell.vertex) {
      const currentTime = Date.now();
      
      // Check if this is a double-click on the same cell
      if (lastClickedCell === cell && (currentTime - lastClickTime) <= DOUBLE_CLICK_DELAY) {
        //console.log("🎯 DOUBLE CLICK DETECTED manually!");
        //alert("double click detected");
        
        // Clear any pending click-out reset since we're handling a double-click
        if (clickOutTimeout) {
          clearTimeout(clickOutTimeout);
          clickOutTimeout = null;
        }
        
        // Reset PDF and ID for the node on double-click
        if (typeof window.resetPdfInheritance === 'function') {
          window.resetPdfInheritance(cell);
        }
        
        // Reset node ID by clearing any custom ID properties
        if (cell._nameId) {
          cell._nameId = '';
        }
        if (cell._customId) {
          cell._customId = '';
        }
        
        // Show properties popup for question nodes
        if (typeof isQuestion === 'function' && isQuestion(cell)) {
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        
        // Show properties popup for PDF nodes
        if (typeof window.isPdfNode === 'function' && window.isPdfNode(cell)) {
          console.log("🎯 PDF node detected, showing properties popup");
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        
        // Show properties popup for hidden checkbox nodes
        if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) {
          console.log("🎯 Hidden checkbox node detected, showing properties popup");
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        
        // Show properties popup for hidden textbox nodes
        if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
          console.log("🎯 Hidden textbox node detected, showing properties popup");
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        
        // Show properties popup for linked logic nodes
        if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
          console.log("🎯 Linked logic node detected, showing properties popup");
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        
        // For all other nodes, do nothing on double-click
        
        // Reset the tracking
        lastClickTime = 0;
        lastClickedCell = null;
      } else {
        // Update tracking for next potential double-click
        lastClickTime = currentTime;
        lastClickedCell = cell;
      }
    }
  });
  
  // Double-click behavior is now handled in events.js module
  
}

/**
 * Zoom into a specific node
 */
function zoomIntoNode(cell) {
  if (!cell || !cell.geometry) {
    console.warn('Cannot zoom: cell or geometry not available');
    return;
  }
  
  const graph = window.graph;
  if (!graph) {
    console.warn('Cannot zoom: graph not available');
    return;
  }
  
  // Get the cell's center position
  const cellX = cell.geometry.x + (cell.geometry.width / 2);
  const cellY = cell.geometry.y + (cell.geometry.height / 2);
  
  // Set a zoom level that makes the node clearly visible
  const targetScale = 1.5; // Zoom to 150%
  
  // Get current view state
  const currentScale = graph.view.scale;
  const currentTranslate = graph.view.translate;
  
  // Calculate the new translation to center the node
  const container = graph.container;
  const containerRect = container.getBoundingClientRect();
  const containerCenterX = containerRect.width / 2;
  const containerCenterY = containerRect.height / 2;
  
  // Calculate where the cell center should be in screen coordinates
  const newTranslateX = (containerCenterX / targetScale) - cellX;
  const newTranslateY = (containerCenterY / targetScale) - cellY;
  
  // Apply the zoom and translation
  graph.view.setScale(targetScale);
  graph.view.setTranslate(newTranslateX, newTranslateY);
  
  // Refresh the graph to show the changes
  graph.view.refresh();
  
  console.log(`🔍 [ZOOM] Zoomed into node at (${cellX}, ${cellY}) with scale ${targetScale}`);
}

/**
 * Show the Properties popup for any node
 */
function showPropertiesPopup(cell) {
  // Prevent multiple popups or opening while closing
  if (window.__propertiesPopupOpen || window.__propertiesPopupClosing) {
    return;
  }
  window.__propertiesPopupOpen = true;
  
  // Clean up any existing popups
  const existingPopups = document.querySelectorAll('.properties-modal');
  existingPopups.forEach(n => n.remove());
  
  // Hide any old properties menu that might be showing
  const oldPropertiesMenu = document.getElementById('propertiesMenu');
  if (oldPropertiesMenu) {
    oldPropertiesMenu.style.display = 'none';
  }
  
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'properties-modal';
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
    min-width: 500px;
    max-width: 600px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: auto;
    opacity: 1;
  `;
  
  // Force the popup to be visible by setting styles directly
  popup.style.pointerEvents = 'auto';
  popup.style.opacity = '1';
  popup.style.display = 'block';
  popup.style.visibility = 'visible';
  
  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e0e0e0;
    min-height: 40px;
  `;
  
  const title = document.createElement('h3');
  // Use different title for different node types
  if (typeof window.isPdfNode === 'function' && window.isPdfNode(cell)) {
    title.textContent = 'PDF Node Properties';
  } else if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) {
    title.textContent = 'Hidden Checkbox Properties';
  } else if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
    title.textContent = 'Hidden Textbox Properties';
  } else if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
    title.textContent = 'Linked Logic Properties';
  } else {
    title.textContent = 'Node Properties';
  }
  title.style.cssText = `
    margin: 0;
    color: #1976d2;
    font-size: 18px;
    font-weight: 600;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.id = 'closePropertiesPopup';
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
    transition: all 0.2s ease;
  `;
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Create content area
  const content = document.createElement('div');
  content.style.cssText = `
    max-height: 400px;
    overflow-y: auto;
    padding-right: 8px;
    min-height: 200px;
    background: #f9f9f9;
    border-radius: 8px;
    padding: 15px;
  `;
  
  // Get cell properties with improved text extraction
  const nodeText = (() => {
    // First try to get the text from _questionText property
    if (cell._questionText && cell._questionText.trim()) {
      return cell._questionText.trim();
    }
    
    // If _questionText is empty, try to extract from cell.value
    if (cell.value) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cell.value;
      const extractedText = (tempDiv.textContent || tempDiv.innerText || "").trim();
      
      // If the extracted text looks like question type options, it's probably the dropdown HTML
      if (extractedText.includes('-- Choose Question Type --') || 
          extractedText.includes('Text Dropdown Checkbox Number Date Big Paragraph')) {
        // This is the dropdown HTML, not the actual text
        return '';
      }
      
      return extractedText;
    }
    
    return '';
  })();
  
  
  // Generate default Node ID based on question text if _nameId is not set
  const generateDefaultNodeId = (text) => {
    if (!text) return 'N/A';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  };
  
  // Use the correct window.getNodeId function (same as the old properties menu)
  let nodeId = 'N/A';
  
  // Special handling for hidden nodes - use _hiddenNodeId directly to preserve underscores
  if ((typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) ||
      (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell))) {
    if (cell._hiddenNodeId) {
      nodeId = cell._hiddenNodeId;
    } else {
      nodeId = 'N/A';
    }
  } else {
    // Regular nodes use getNodeId function
    if (typeof window.getNodeId === 'function') {
      nodeId = window.getNodeId(cell) || 'N/A';
    } else {
      // Fallback logic if window.getNodeId is not available
      // PRIORITY 1: Check if we have a saved Node ID in the style
      if (cell.style) {
        const styleMatch = cell.style.match(/nodeId=([^;]+)/);
        if (styleMatch) {
          nodeId = decodeURIComponent(styleMatch[1]);
        }
      }
      
      // PRIORITY 2: Check _nameId property
      if (nodeId === 'N/A' && cell._nameId) {
        nodeId = cell._nameId;
      }
      
      // PRIORITY 3: Generate default Node ID
      if (nodeId === 'N/A') {
        nodeId = generateDefaultNodeId(nodeText) || cell.id || 'N/A';
      }
    }
  }
  
  // Get actual node type name instead of style string
  const nodeType = (() => {
    if (!cell.style) return 'Unknown';
    
    // Check for specific node types
    if (cell.style.includes('nodeType=question')) {
      // For question nodes, get the specific question type
      if (typeof window.getQuestionType === 'function') {
        const questionType = window.getQuestionType(cell);
        switch(questionType) {
          case 'text': return 'Textbox';
          case 'text2': return 'Dropdown';
          case 'checkbox': return 'Checkbox';
          case 'number': return 'Number';
          case 'date': return 'Date';
          case 'bigParagraph': return 'Big Paragraph';
          case 'multipleTextboxes': return 'Multiple Textboxes';
          case 'multipleDropdownType': return 'Multiple Dropdown';
          case 'dateRange': return 'Date Range';
          case 'email': return 'Email';
          case 'phone': return 'Phone';
          default: return 'Question';
        }
      }
      return 'Question';
    } else if (cell.style.includes('nodeType=options')) {
      return 'Option Node';
    } else if (cell.style.includes('nodeType=end')) {
      return 'End Node';
    } else if (cell.style.includes('nodeType=amountOption')) {
      return 'Amount Option';
    } else if (cell.style.includes('nodeType=alert')) {
      return 'Alert Node';
    } else if (cell.style.includes('nodeType=checklist')) {
      return 'Checklist Node';
    } else if (cell.style.includes('nodeType=image')) {
      return 'Image Node';
    } else if (cell.style.includes('nodeType=pdfNode')) {
      return 'PDF Node';
    } else if (cell.style.includes('nodeType=calculation')) {
      return 'Calculation Node';
    } else if (cell.style.includes('nodeType=notes')) {
      return 'Notes Node';
    } else if (cell.style.includes('nodeType=subtitle')) {
      return 'Subtitle Node';
    } else if (cell.style.includes('nodeType=info')) {
      return 'Info Node';
    } else if (cell.style.includes('nodeType=imageOption')) {
      return 'Image Option';
    }
    
    // Fallback to first style property
    return cell.style.split(';')[0] || 'Unknown';
  })();
  
  // Get section information using the proper functions
  const section = (() => {
    if (typeof window.getSection === 'function') {
      return window.getSection(cell) || '1';
    }
    // Fallback: extract from style
    const style = cell.style || "";
    const match = style.match(/section=([^;]+)/);
    return match ? match[1] : '1';
  })();
  
  // Get section name from section preferences
  const sectionName = (() => {
    const sectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
    return (sectionPrefs[section] && sectionPrefs[section].name) || 'Enter section name';
  })();
  
  // Get all available section names for dropdown
  const availableSections = (() => {
    const sectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
    const sections = [];
    
    // Add all existing sections
    Object.keys(sectionPrefs).forEach(sectionNum => {
      const sectionData = sectionPrefs[sectionNum];
      const name = sectionData.name || `Section ${sectionNum}`;
      sections.push({
        value: sectionNum,
        text: `${sectionNum}: ${name}`
      });
    });
    
    // Sort by section number
    sections.sort((a, b) => parseInt(a.value) - parseInt(b.value));
    
    return sections;
  })();
  
  // Get question number - try multiple sources
  const questionNumber = (() => {
    if (cell._questionId) return cell._questionId;
    if (cell._questionNumber) return cell._questionNumber;
    // For question nodes, try to get from the question counter or position
    if (typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
      // Try to find the question's position in the graph
      const graph = window.graph;
      if (graph) {
        const questions = graph.getChildVertices(graph.getDefaultParent()).filter(c => 
          typeof window.isQuestion === 'function' && window.isQuestion(c)
        );
        const index = questions.findIndex(c => c.id === cell.id);
        return index >= 0 ? (index + 1).toString() : 'N/A';
      }
    }
    return 'N/A';
  })();
  
  // Get PDF properties for option nodes and cascade through connected nodes
  const pdfProperties = (() => {
    const graph = window.graph;
    if (!graph) return null;
    
    // Function to find PDF properties - check both direct and incoming connections
    const findPdfProperties = (startCell) => {
      // Check if this is a PDF node
      if (typeof window.isPdfNode === 'function' && window.isPdfNode(startCell)) {
        return {
          nodeId: startCell.id,
          filename: startCell._pdfFile || startCell._pdfName || "",
          pdfUrl: startCell._pdfFile || "",
          priceId: startCell._pdfPrice || ""
        };
      }
      
      // Only check for direct PDF properties if the cell is actually connected to a PDF node
      // This prevents showing PDF properties on cells that just have leftover PDF data
      
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
          filename: targetCell._pdfFile || targetCell._pdfName || "",
          pdfUrl: targetCell._pdfFile || "",
          priceId: targetCell._pdfPrice || ""
        };
      }
      
      // Check incoming edges for PDF properties (nodes that point to this node)
      const incomingEdges = graph.getIncomingEdges(startCell) || [];
      for (const edge of incomingEdges) {
        const sourceCell = edge.source;
        if (sourceCell) {
          // Check if the source node is actually a PDF node
          if (typeof window.isPdfNode === 'function' && window.isPdfNode(sourceCell)) {
            return {
              nodeId: sourceCell.id,
              filename: sourceCell._pdfFile || sourceCell._pdfName || "",
              pdfUrl: sourceCell._pdfFile || "",
              priceId: sourceCell._pdfPrice || ""
            };
          }
          
          // Check if the source node connects to PDF nodes
          const sourceOutgoingEdges = graph.getOutgoingEdges(sourceCell) || [];
          for (const sourceEdge of sourceOutgoingEdges) {
            const sourceTarget = sourceEdge.target;
            if (sourceTarget && typeof window.isPdfNode === 'function' && window.isPdfNode(sourceTarget)) {
              return {
                nodeId: sourceTarget.id,
                filename: sourceTarget._pdfFile || sourceTarget._pdfName || "",
                pdfUrl: sourceTarget._pdfFile || "",
                priceId: sourceTarget._pdfPrice || ""
              };
            }
          }
        }
      }
      
      return null;
    };
    
    return findPdfProperties(cell);
  })();
  
  // Create property fields - different for PDF nodes vs other nodes
  let properties = [];
  
  // For PDF nodes, only show the 3 required fields
  if (typeof window.isPdfNode === 'function' && window.isPdfNode(cell)) {
    properties = [
      { label: 'PDF Name', value: cell._pdfName || 'PDF Document', id: 'propPdfName', editable: true },
      { label: 'PDF File', value: cell._pdfFile || '', id: 'propPdfFile', editable: true },
      { label: 'PDF Price', value: cell._pdfPrice || '', id: 'propPdfPrice', editable: true }
    ];
  } else if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) {
    // For hidden checkbox nodes, only show Node ID
    properties = [
      { label: 'Node ID', value: cell._hiddenNodeId || 'hidden_checkbox', id: 'propHiddenNodeId', editable: true }
    ];
  } else if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
    // For hidden textbox nodes, show Node ID and Default Text
    properties = [
      { label: 'Node ID', value: cell._hiddenNodeId || 'hidden_textbox', id: 'propHiddenNodeId', editable: true },
      { label: 'Default Text', value: cell._defaultText || '', id: 'propDefaultText', editable: true }
    ];
  } else if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
    // For linked logic nodes, show special properties with dropdowns
    console.log('🔍 [PROPERTIES] Loading Linked Logic properties for cell:', cell.id);
    console.log('🔍 [PROPERTIES] _linkedLogicNodeId:', cell._linkedLogicNodeId);
    console.log('🔍 [PROPERTIES] _linkedFields:', cell._linkedFields);
    properties = [
      { label: 'Node ID', value: cell._linkedLogicNodeId || 'linked_logic', id: 'propLinkedLogicNodeId', editable: true },
      { label: 'Linked Fields', value: 'linkedFields', id: 'propLinkedFields', editable: false, special: 'linkedFields' }
    ];
  } else {
    // For all other nodes, show the standard properties
    properties = [
      { label: 'Node Text', value: nodeText, id: 'propNodeText', editable: true },
      { label: 'Node ID', value: nodeId, id: 'propNodeId', editable: true },
      { 
        label: 'Node Type', 
        value: nodeType, 
        id: 'propNodeType', 
        editable: false,
        isQuestionTypeDropdown: typeof window.isQuestion === 'function' && window.isQuestion(cell)
      },
      { 
        label: 'Section Name', 
        value: section, 
        id: 'propSectionName', 
        editable: true,
        isSectionNameDropdown: true,
        dropdownOptions: availableSections,
        dropdownChange: (selectedSection) => {
          // Reassign the node to the selected section
          if (typeof window.setSection === 'function') {
            window.setSection(cell, selectedSection);
          }
        }
      }
    ];
  }
  
  // Add Question Number field only for question nodes
  if (typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
    properties.push({
      label: 'Question Number', 
      value: questionNumber, 
      id: 'propQuestionNumber', 
      editable: true
    });
  }
  
  // Add Checkbox Availability dropdown for checkbox questions
  if (typeof window.isQuestion === 'function' && window.isQuestion(cell) && 
      typeof window.getQuestionType === 'function' && window.getQuestionType(cell) === 'checkbox') {
    properties.push({
      label: 'Checkbox Availability',
      value: cell._checkboxAvailability || 'markAll',
      id: 'propCheckboxAvailability',
      editable: false,
      isCheckboxAvailabilityDropdown: true
    });
  }
  
  // Add Max Line Limit and Max Character Limit for big paragraph questions
  if (typeof window.isQuestion === 'function' && window.isQuestion(cell) && 
      typeof window.getQuestionType === 'function' && window.getQuestionType(cell) === 'bigParagraph') {
    properties.push({
      label: 'Max Line Limit',
      value: cell._lineLimit || '',
      id: 'propLineLimit',
      editable: true,
      inputType: 'number'
    });
    
    properties.push({
      label: 'Max Character Limit',
      value: cell._characterLimit || '',
      id: 'propCharacterLimit',
      editable: true,
      inputType: 'number'
    });
    
    properties.push({
      label: 'Paragraph Limit',
      value: cell._paragraphLimit || '',
      id: 'propParagraphLimit',
      editable: true,
      inputType: 'number'
    });
  }
  
  // PDF Name field will be added later in the unified section
  
  // Add Copy ID dropdown and button for date range nodes
  if (typeof window.getQuestionType === 'function' && window.getQuestionType(cell) === 'dateRange') {
    properties.push({
      label: '',
      value: '',
      id: 'propCopyIdType',
      editable: false,
      isDropdown: true,
      dropdownOptions: [
        { value: '', text: 'Select Start or Finish...' },
        { value: 'start', text: 'Start' },
        { value: 'finish', text: 'Finish' }
      ],
      dropdownChange: (selectedValue) => {
        const copyButton = document.getElementById('propCopyIdButton');
        if (copyButton) {
          copyButton.style.display = selectedValue ? 'block' : 'none';
        }
      }
    });
    
    properties.push({
      label: '',
      value: '',
      id: 'propCopyIdButton',
      editable: false,
      isButton: true,
      buttonText: 'Copy ID',
      buttonAction: () => {
        const dropdown = document.getElementById('propCopyIdType');
        const selectedValue = dropdown ? dropdown.value : '';
        if (selectedValue) {
          // Use the actual node ID from the properties, not the cell ID
          const nodeIdField = document.getElementById('propNodeId');
          let baseId = cell.id; // fallback to cell.id
          
          
          if (nodeIdField) {
            // Check if there's an active input field (user is editing)
            const activeInput = nodeIdField.parentNode.querySelector('input[type="text"]');
            
            if (activeInput) {
              baseId = activeInput.value.trim();
              console.log('🔧 [COPY ID DEBUG] Using activeInput value:', baseId);
            } else if (nodeIdField.textContent) {
              baseId = nodeIdField.textContent.trim();
              console.log('🔧 [COPY ID DEBUG] Using textContent:', baseId);
            } else if (nodeIdField.value !== undefined) {
              baseId = nodeIdField.value.trim();
              console.log('🔧 [COPY ID DEBUG] Using value property:', baseId);
            }
          }
          
          // Fallback: if we still don't have a baseId, try to get it from the cell's _nameId or use getNodeId
          if (!baseId || baseId === cell.id) {
            if (cell._nameId) {
              baseId = cell._nameId;
              console.log('🔧 [COPY ID DEBUG] Using cell._nameId:', baseId);
            } else if (typeof window.getNodeId === 'function') {
              baseId = window.getNodeId(cell);
              console.log('🔧 [COPY ID DEBUG] Using window.getNodeId:', baseId);
            }
          }
          
          console.log('🔧 [COPY ID DEBUG] Final baseId:', baseId);
          const suffix = selectedValue === 'start' ? '_1' : '_2';
          const fullId = baseId + suffix;
          
          navigator.clipboard.writeText(fullId).then(() => {
            window.showCopyFeedback(fullId);
          }).catch(err => {
            console.error('Failed to copy ID:', err);
            alert('Failed to copy ID to clipboard');
          });
        }
      },
      initiallyHidden: true
    });
  }
  
  // Add unified PDF Name field for non-PDF nodes that have PDF properties
  if (!(typeof window.isPdfNode === 'function' && window.isPdfNode(cell))) {
    // Use the same source as the inherited field for consistency
    let pdfName = '';
    let isInherited = false;
    
    // First try to get PDF name from the unified function
    if (typeof window.getPdfNameForNode === 'function') {
      const inheritedPdfName = window.getPdfNameForNode(cell);
      if (inheritedPdfName && inheritedPdfName.trim()) {
        pdfName = inheritedPdfName;
        isInherited = true;
      }
    }
    
    // Fallback to pdfProperties if no inherited name found
    if (!pdfName && pdfProperties) {
      pdfName = pdfProperties.filename || '';
    }
    
    // Only add PDF Name field if it has a meaningful value
    if (pdfName && pdfName.trim() !== '' && pdfName !== 'PDF Document') {
      properties.push({
        label: 'PDF Name',
        value: pdfName,
        id: 'propPdfName',
        editable: !isInherited, // Make inherited fields read-only
        isInherited: isInherited
      });
      
      // Add Reset PDF button for inherited fields
      if (isInherited) {
        properties.push({
          label: '',
          value: '',
          id: 'propResetPdf',
          editable: false,
          isButton: true,
          buttonText: 'Reset PDF',
          buttonAction: () => {
            const newPdfName = window.resetPdfInheritance(cell);
            if (newPdfName) {
              // Update the input field value immediately
              const pdfNameInput = document.getElementById('propPdfName');
              if (pdfNameInput) {
                pdfNameInput.value = newPdfName;
              }
            }
          }
        });
      }
    }
  }
  
  
  properties.forEach((prop, index) => {
    // Special handling for linked logic fields
    if (prop.special === 'linkedFields') {
      const fieldDiv = document.createElement('div');
      fieldDiv.style.cssText = `
        margin-bottom: 16px;
        display: flex;
        align-items: center;
      `;
      
      const label = document.createElement('label');
      label.textContent = prop.label ? prop.label + (prop.isInherited ? ' (inherited):' : ':') : '';
      label.style.cssText = `
        font-weight: 600;
        color: #333;
        min-width: 120px;
        margin-right: 12px;
        ${prop.isInherited ? 'color: #4caf50;' : ''}
      `;
      
      const linkedFieldsContainer = document.createElement('div');
      linkedFieldsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
      `;
      
      // Create initial dropdowns (minimum 2)
      const linkedFields = cell._linkedFields || [];
      const minDropdowns = Math.max(2, linkedFields.length);
      
      for (let i = 0; i < minDropdowns; i++) {
        const dropdownContainer = document.createElement('div');
        dropdownContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 8px;
        `;
        
        // Create search bar
        const searchBar = document.createElement('input');
        searchBar.type = 'text';
        searchBar.placeholder = 'Search for a field...';
        searchBar.style.cssText = `
          width: 100%;
          padding: 6px 8px;
          margin-bottom: 4px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          background-color: #f9f9f9;
        `;
        
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
        `;
        
        // Create custom dropdown container
        const newDropdownContainer = document.createElement('div');
        newDropdownContainer.style.cssText = `
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
        `;
        
        // Create the visible dropdown display
        const dropdownDisplay = document.createElement('div');
        dropdownDisplay.style.cssText = `
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          background-color: white;
          cursor: pointer;
          min-height: 20px;
          display: flex;
          align-items: center;
        `;
        dropdownDisplay.textContent = 'Select a textbox question...';
        
        // Create the options container (initially hidden)
        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = `
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-top: none;
          border-radius: 0 0 4px 4px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 1000;
          display: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        
        // Create hidden select for form compatibility
        const hiddenSelect = document.createElement('select');
        hiddenSelect.style.display = 'none';
        
        // Populate options
        populateLinkedLogicCustomDropdown(optionsContainer, hiddenSelect, cell);
        
        // Set selected value if it exists
        if (linkedFields[i]) {
          const selectedOption = optionsContainer.querySelector(`[data-value="${linkedFields[i]}"]`);
          if (selectedOption) {
            dropdownDisplay.textContent = selectedOption.textContent;
            hiddenSelect.value = linkedFields[i];
          }
        }
        
        dropdownContainer.appendChild(dropdownDisplay);
        dropdownContainer.appendChild(hiddenSelect);
        
        // Setup search functionality
        setupLinkedLogicCustomSearch(optionsContainer, hiddenSelect, dropdownDisplay, searchBar);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.cssText = `
          padding: 4px 8px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        `;
        deleteBtn.onclick = () => {
          mainContainer.remove();
          updateLinkedFields(cell);
        };
        
        // Create the main container for this dropdown
        const mainContainer = document.createElement('div');
        mainContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 8px;
          position: relative;
        `;
        
        // Add search bar to main container
        mainContainer.appendChild(searchBar);
        
        // Add options container to main container (positioned relative to search bar)
        mainContainer.appendChild(optionsContainer);
        
        // Add dropdown and delete button to controls container
        controlsContainer.appendChild(dropdownContainer);
        controlsContainer.appendChild(deleteBtn);
        
        // Add controls container to main container
        mainContainer.appendChild(controlsContainer);
        
        // Add main container to linked fields container
        linkedFieldsContainer.appendChild(mainContainer);
      }
      
      // Add "Link Another" button
      const linkAnotherBtn = document.createElement('button');
      linkAnotherBtn.textContent = 'Link Another';
      linkAnotherBtn.style.cssText = `
        padding: 8px 16px;
        background-color: #2196f3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-top: 8px;
      `;
      linkAnotherBtn.onclick = () => {
        const linkDropdownContainer = document.createElement('div');
        linkDropdownContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 8px;
        `;
        
        // Create search bar
        const searchBar = document.createElement('input');
        searchBar.type = 'text';
        searchBar.placeholder = 'Search for a field...';
        searchBar.style.cssText = `
          width: 100%;
          padding: 6px 8px;
          margin-bottom: 4px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          background-color: #f9f9f9;
        `;
        
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
        `;
        
        // Create custom dropdown container
        const linkNewDropdownContainer = document.createElement('div');
        linkNewDropdownContainer.style.cssText = `
          flex: 1;
          position: relative;
          display: flex;
          flex-direction: column;
        `;
        
        // Create the visible dropdown display
        const dropdownDisplay = document.createElement('div');
        dropdownDisplay.style.cssText = `
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          background-color: white;
          cursor: pointer;
          min-height: 20px;
          display: flex;
          align-items: center;
        `;
        dropdownDisplay.textContent = 'Select a textbox question...';
        
        // Create the options container (initially hidden)
        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = `
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-top: none;
          border-radius: 0 0 4px 4px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 1000;
          display: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        
        // Create hidden select for form compatibility
        const hiddenSelect = document.createElement('select');
        hiddenSelect.style.display = 'none';
        
        // Populate options
        populateLinkedLogicCustomDropdown(optionsContainer, hiddenSelect, cell);
        
        linkNewDropdownContainer.appendChild(dropdownDisplay);
        linkNewDropdownContainer.appendChild(hiddenSelect);
        
        // Setup search functionality
        setupLinkedLogicCustomSearch(optionsContainer, hiddenSelect, dropdownDisplay, searchBar);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.cssText = `
          padding: 4px 8px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        `;
        deleteBtn.onclick = () => {
          linkMainContainer.remove();
          updateLinkedFields(cell);
        };
        
        // Create the main container for this dropdown
        const linkMainContainer = document.createElement('div');
        linkMainContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 8px;
          position: relative;
        `;
        
        // Add search bar to main container
        linkMainContainer.appendChild(searchBar);
        
        // Add options container to main container (positioned relative to search bar)
        linkMainContainer.appendChild(optionsContainer);
        
        // Add dropdown and delete button to controls container
        controlsContainer.appendChild(linkNewDropdownContainer);
        controlsContainer.appendChild(deleteBtn);
        
        // Add controls container to main container
        linkMainContainer.appendChild(controlsContainer);
        
        // Add main container to linked fields container
        linkedFieldsContainer.insertBefore(linkMainContainer, linkAnotherBtn);
        updateLinkedFields(cell);
      };
      
      linkedFieldsContainer.appendChild(linkAnotherBtn);
      
      fieldDiv.appendChild(label);
      fieldDiv.appendChild(linkedFieldsContainer);
      content.appendChild(fieldDiv);
      
      // Helper function to update linked fields
      function updateLinkedFields(cell) {
        const dropdowns = linkedFieldsContainer.querySelectorAll('select');
        const newLinkedFields = Array.from(dropdowns).map(dropdown => dropdown.value).filter(value => value);
        console.log('💾 [UPDATE LINKED FIELDS] Updating _linkedFields from', cell._linkedFields, 'to', newLinkedFields);
        cell._linkedFields = newLinkedFields;
        
        // Trigger autosave
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      }
      
      // Add change listeners to all dropdowns
      linkedFieldsContainer.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
          updateLinkedFields(cell);
        }
      });
      
      return; // Skip the normal property creation
    }
    
    const fieldDiv = document.createElement('div');
    fieldDiv.style.cssText = `
      margin-bottom: 16px;
      display: flex;
      align-items: center;
    `;
    
    const label = document.createElement('label');
    label.textContent = prop.label ? prop.label + (prop.isInherited ? ' (inherited):' : ':') : '';
    label.style.cssText = `
      font-weight: 600;
      color: #333;
      min-width: 120px;
      margin-right: 12px;
      ${prop.isInherited ? 'color: #4caf50;' : ''}
    `;
    
    // Special handling for question type dropdown
    if (prop.isQuestionTypeDropdown) {
      const dropdown = document.createElement('select');
      dropdown.id = prop.id;
      dropdown.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #f9f9f9;
        color: #333;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      
      // Question type options
      const questionTypes = [
        { value: 'text', label: 'Textbox' },
        { value: 'text2', label: 'Dropdown' },
        { value: 'checkbox', label: 'Checkbox' },
        { value: 'number', label: 'Number' },
        { value: 'date', label: 'Date' },
        { value: 'bigParagraph', label: 'Big Paragraph' },
        { value: 'multipleTextboxes', label: 'Multiple Textboxes' },
        { value: 'multipleDropdownType', label: 'Multiple Dropdown' },
        { value: 'dateRange', label: 'Date Range' },
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone' }
      ];
      
      // Add options to dropdown
      questionTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.value;
        option.textContent = type.label;
        dropdown.appendChild(option);
      });
      
      // Set current value
      const currentQuestionType = typeof window.getQuestionType === 'function' ? window.getQuestionType(cell) : 'text';
      dropdown.value = currentQuestionType;
      
      // Handle change event
      dropdown.addEventListener('change', () => {
        const newType = dropdown.value;
        console.log("Question type changed to:", newType);
        
        // Update the cell's question type
        if (typeof window.setQuestionType === 'function') {
          window.setQuestionType(cell, newType);
        } else {
          // Fallback: update the style directly
          let style = cell.style || "";
          style = style.replace(/questionType=[^;]+/, "");
          style += `;questionType=${newType};`;
          cell.style = style;
        }
        
        // Refresh the cell display
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.updateSimpleQuestionCell(cell);
        }
        if (window.graph) {
          window.graph.refresh(cell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      });
      
      fieldDiv.appendChild(label);
      fieldDiv.appendChild(dropdown);
      content.appendChild(fieldDiv);
      return; // Skip the normal field creation
    }
    
    // Special handling for section name dropdown
    if (prop.isSectionNameDropdown) {
      const dropdown = document.createElement('select');
      dropdown.id = prop.id;
      dropdown.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
        color: #333;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      
      // Add options
      if (prop.dropdownOptions) {
        prop.dropdownOptions.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.text;
          dropdown.appendChild(optionElement);
        });
      }
      
      // Set initial value
      if (prop.value) {
        dropdown.value = prop.value;
      }
      
      // Add change listener
      dropdown.addEventListener('change', () => {
        if (prop.dropdownChange) {
          prop.dropdownChange(dropdown.value);
        }
      });
      
      fieldDiv.appendChild(label);
      fieldDiv.appendChild(dropdown);
      content.appendChild(fieldDiv);
      return; // Skip the normal field creation
    }
    
    // Special handling for checkbox availability dropdown
    if (prop.isCheckboxAvailabilityDropdown) {
      const dropdown = document.createElement('select');
      dropdown.id = prop.id;
      dropdown.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
        color: #333;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      
      // Checkbox availability options
      const availabilityOptions = [
        { value: 'markAll', text: 'Mark all that apply' },
        { value: 'markOne', text: 'Mark only one' }
      ];
      
      // Add options to dropdown
      availabilityOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        dropdown.appendChild(optionElement);
      });
      
      // Set current value
      dropdown.value = prop.value || 'markAll';
      
      // Handle change event
      dropdown.addEventListener('change', () => {
        const newAvailability = dropdown.value;
        console.log("Checkbox availability changed to:", newAvailability);
        
        // Update the cell's checkbox availability
        cell._checkboxAvailability = newAvailability;
        
        // Refresh the cell display
        if (typeof window.updateSimpleQuestionCell === 'function') {
          window.updateSimpleQuestionCell(cell);
        }
        if (window.graph) {
          window.graph.refresh(cell);
        }
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      });
      
      fieldDiv.appendChild(label);
      fieldDiv.appendChild(dropdown);
      content.appendChild(fieldDiv);
      return; // Skip the normal field creation
    }
    
    // Only create valueSpan for regular input fields, not for dropdowns or buttons
    let valueSpan = null;
    if (!prop.isDropdown && !prop.isButton) {
      valueSpan = document.createElement('span');
      valueSpan.id = prop.id;
      valueSpan.textContent = prop.value;
      valueSpan.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: ${prop.editable ? '#f9f9f9' : '#f5f5f5'};
        color: ${prop.editable ? '#333' : '#666'};
        cursor: ${prop.editable ? 'text' : 'default'};
        transition: all 0.2s ease;
        ${prop.isInherited ? 'border-left: 4px solid #4caf50; font-style: italic;' : ''}
      `;
    }
    
    if (prop.isDropdown) {
      // Handle dropdown fields
      const dropdown = document.createElement('select');
      dropdown.id = prop.id;
      dropdown.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
        color: #333;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
      `;
      
      // Add options
      if (prop.dropdownOptions) {
        prop.dropdownOptions.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.text;
          dropdown.appendChild(optionElement);
        });
      }
      
      // Set initial value
      if (prop.value) {
        dropdown.value = prop.value;
      }
      
      // Add change listener
      dropdown.addEventListener('change', () => {
        if (prop.dropdownChange) {
          prop.dropdownChange(dropdown.value);
        }
      });
      
      // For dropdowns, use the same horizontal layout as other fields
      if (!prop.label) {
        fieldDiv.style.justifyContent = 'center';
        fieldDiv.style.width = '100%';
        fieldDiv.appendChild(dropdown);
      } else {
        // Use standard horizontal layout like Node Type dropdown
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(dropdown);
      }
    } else if (prop.isButton) {
      // Handle button fields
      const button = document.createElement('button');
      button.id = prop.id;
      button.textContent = prop.buttonText || 'Button';
      button.style.cssText = `
        flex: 0 0 auto;
        width: 200px;
        padding: 8px 12px;
        border: 1px solid #1976d2;
        border-radius: 6px;
        background: #1976d2;
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: ${prop.initiallyHidden ? 'none' : 'block'};
      `;
      
      button.addEventListener('click', () => {
        if (prop.buttonAction) {
          prop.buttonAction();
        }
      });
      
      button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#1565c0';
      });
      
      button.addEventListener('mouseout', () => {
        button.style.backgroundColor = '#1976d2';
      });
      
      // Center the button if no label
      if (!prop.label) {
        fieldDiv.style.justifyContent = 'center';
        fieldDiv.style.width = '100%';
        fieldDiv.appendChild(button);
      } else {
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(button);
      }
    } else if (prop.editable) {
      // Special handling for Node ID field - make it editable with copy functionality
      if (prop.id === 'propNodeId') {
        // Make it contenteditable for editing
        valueSpan.contentEditable = 'true';
        valueSpan.style.cursor = 'text';
        valueSpan.title = 'Click to edit, double-click to copy to clipboard';
        
        // Handle double-click to copy
        valueSpan.addEventListener('dblclick', async (e) => {
          e.preventDefault();
          try {
            await navigator.clipboard.writeText(prop.value);
            
            // Show visual feedback
            const originalText = valueSpan.textContent;
            valueSpan.textContent = 'Copied!';
            valueSpan.style.backgroundColor = '#e8f5e8';
            valueSpan.style.color = '#2e7d32';
            
            setTimeout(() => {
              valueSpan.textContent = originalText;
              valueSpan.style.backgroundColor = '#f9f9f9';
              valueSpan.style.color = '#333';
            }, 1000);
          } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = prop.value;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            // Show visual feedback
            const originalText = valueSpan.textContent;
            valueSpan.textContent = 'Copied!';
            valueSpan.style.backgroundColor = '#e8f5e8';
            valueSpan.style.color = '#2e7d32';
            
            setTimeout(() => {
              valueSpan.textContent = originalText;
              valueSpan.style.backgroundColor = '#f9f9f9';
              valueSpan.style.color = '#333';
            }, 1000);
          }
        });
        
        // Handle blur to save changes
        valueSpan.addEventListener('blur', () => {
          const newValue = valueSpan.textContent.trim();
          if (newValue !== prop.value && newValue !== '') {
            
            // Mark this Node ID as manually edited to prevent automatic regeneration
            cell._manuallyEditedNodeId = true;
            
            // Update the cell's node ID using the proper method
            if (typeof window.setNodeId === 'function') {
              window.setNodeId(cell, newValue);
            } else {
              // Fallback: update the style directly
              let style = cell.style || '';
              style = style.replace(/nodeId=[^;]+/, '');
              style += `nodeId=${encodeURIComponent(newValue)};`;
              graph.getModel().setStyle(cell, style);
            }
            
            // Also update the _nameId property if it exists
            if (cell._nameId !== undefined) {
              cell._nameId = newValue;
            }
            
            // Update the cell's ID directly (mxGraph doesn't have setId method)
            cell.id = newValue;
            
            // Force a refresh of all cells to update the display
            if (typeof window.refreshAllCells === 'function') {
              window.refreshAllCells();
            }
            
            // Force a model change event to ensure the change is persisted
            graph.getModel().beginUpdate();
            graph.getModel().endUpdate();
            
          }
        });
        
        // Create reset button for Node ID
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset';
        resetButton.title = 'Reset Node ID to match naming convention';
        resetButton.style.cssText = `
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 3px;
          padding: 4px 8px;
          font-size: 11px;
          color: #495057;
          cursor: pointer;
          margin-left: 8px;
          vertical-align: middle;
          transition: all 0.2s;
        `;
        
        // Add hover effects
        resetButton.addEventListener('mouseover', () => {
          resetButton.style.backgroundColor = '#e9ecef';
          resetButton.style.borderColor = '#adb5bd';
        });
        
        resetButton.addEventListener('mouseout', () => {
          resetButton.style.backgroundColor = '#f8f9fa';
          resetButton.style.borderColor = '#dee2e6';
        });
        
        // Add click handler for reset functionality
        resetButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Set flag to prevent automatic Node ID regeneration during this update
          window._isUpdatingProperties = true;
          
          // Generate the correct Node ID using the naming convention
          let correctNodeId = '';
          if (typeof window.generateCorrectNodeId === 'function') {
            correctNodeId = window.generateCorrectNodeId(cell);
          } else {
            console.warn("generateCorrectNodeId function not available");
            window._isUpdatingProperties = false;
            return;
          }
          
          if (!correctNodeId) {
            console.warn("Could not generate correct Node ID");
            window._isUpdatingProperties = false;
            return;
          }
          
          // Update the Node ID field display
          valueSpan.textContent = correctNodeId;
          
          // Update the actual cell's Node ID
          if (typeof window.setNodeId === 'function') {
            window.setNodeId(cell, correctNodeId);
          } else {
            console.warn("setNodeId function not available");
            window._isUpdatingProperties = false;
            return;
          }
          
          // Mark this Node ID as manually edited to prevent future automatic regeneration
          cell._manuallyEditedNodeId = true;
          
          // Clear the updating flag after a short delay
          setTimeout(() => {
            window._isUpdatingProperties = false;
          }, 100);
          
          // Refresh all cells to update the display
          if (typeof window.refreshAllCells === 'function') {
            window.refreshAllCells();
          }
          
          // Trigger autosave
          if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
          }
          
          console.log("Node ID reset to:", correctNodeId);
        });
        
        // Add the valueSpan and reset button to the fieldDiv for Node ID field
        fieldDiv.appendChild(label);
        fieldDiv.appendChild(valueSpan);
        fieldDiv.appendChild(resetButton);
        content.appendChild(fieldDiv);
        return; // Skip the normal field creation
      } else {
        // Regular editable field behavior for other fields
        valueSpan.addEventListener('click', () => {
          // For Node Text field, use textarea to maintain size
          const isNodeText = prop.id === 'propNodeText';
          const input = document.createElement(isNodeText ? 'textarea' : 'input');
          if (!isNodeText) {
            input.type = prop.inputType || 'text';
          }
          input.value = prop.value;
          
          if (isNodeText) {
            input.style.cssText = `
              width: 100%;
              min-height: 80px;
              padding: 8px 12px;
              border: 2px solid #1976d2;
              border-radius: 6px;
              font-size: 14px;
              outline: none;
              resize: vertical;
              font-family: inherit;
              line-height: 1.4;
            `;
          } else {
            input.style.cssText = `
              width: 100%;
              padding: 8px 12px;
              border: 2px solid #1976d2;
              border-radius: 6px;
              font-size: 14px;
              outline: none;
            `;
          }
          
          valueSpan.style.display = 'none';
          valueSpan.parentNode.insertBefore(input, valueSpan);
          input.focus();
          input.select();
          
          const saveValue = () => {
            const newValue = input.value.trim();
            valueSpan.textContent = newValue;
            valueSpan.style.display = 'block';
            
            // Safely remove input element if it still exists
            if (input && input.parentNode) {
              input.remove();
            }
            
            // Update cell property
            switch(prop.id) {
              case 'propNodeText':
                cell._questionText = newValue;
                cell.value = newValue;
                
                // DO NOT auto-update node ID when editing node text
                // Node IDs should only change when manually edited or reset using the button
                break;
              case 'propNodeSection':
                // Update section using the proper setSection function
                if (typeof window.setSection === 'function') {
                  window.setSection(cell, newValue);
                } else {
                  // Fallback: update style directly
                  let style = cell.style || "";
                  style = style.replace(/section=[^;]+/, "");
                  style += `;section=${newValue};`;
                  cell.style = style;
                }
                break;
              case 'propSectionName':
                // Update section name in section preferences
                const sectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
                if (!sectionPrefs[section]) {
                  sectionPrefs[section] = { name: newValue, borderColor: '#cccccc' };
                } else {
                  sectionPrefs[section].name = newValue;
                }
                // Update the global sectionPrefs
                if (window.flowchartConfig) {
                  window.flowchartConfig.sectionPrefs = sectionPrefs;
                } else {
                  window.sectionPrefs = sectionPrefs;
                }
                // Refresh the section legend if the function exists
                if (typeof window.updateSectionLegend === 'function') {
                  window.updateSectionLegend();
                }
                break;
              case 'propQuestionNumber':
                cell._questionId = newValue;
                break;
              case 'propLineLimit':
                cell._lineLimit = newValue;
                break;
              case 'propCharacterLimit':
                cell._characterLimit = newValue;
                break;
              case 'propParagraphLimit':
                cell._paragraphLimit = newValue;
                break;
              case 'propNodeId':
                // Update the _nameId property
                cell._nameId = newValue;
                // Also update the style-based nodeId if it exists
                if (cell.style) {
                  let style = cell.style;
                  if (style.includes('nodeId=')) {
                    style = style.replace(/nodeId=[^;]+/, `nodeId=${encodeURIComponent(newValue)}`);
                  } else {
                    style += `;nodeId=${encodeURIComponent(newValue)};`;
                  }
                  cell.style = style;
                }
                
                // Update the display in the properties popup
                const nodeIdField = document.getElementById('propNodeId');
                if (nodeIdField) {
                  const nodeIdSpan = nodeIdField.querySelector('span');
                  if (nodeIdSpan) {
                    nodeIdSpan.textContent = newValue;
                  }
                }
                break;
              case 'propPdfName':
                // Update the PDF name property
                const oldPdfName = cell._pdfName;
                cell._pdfName = newValue;
                
                // Update all Node IDs that use this PDF name
                if (oldPdfName && oldPdfName !== newValue && typeof window.updateAllNodeIdsForPdfChange === 'function') {
                  window.updateAllNodeIdsForPdfChange(oldPdfName, newValue);
                }
                
                // Apply PDF naming convention to the current Node ID
                if (typeof window.setNodeId === 'function') {
                  // Get the current Node ID without PDF prefix
                  const currentNodeId = document.getElementById('propNodeId');
                  const baseNodeId = currentNodeId ? currentNodeId.textContent.trim() : cell._nameId || cell.id;
                  
                  // Remove any existing PDF prefix from the base Node ID
                  const cleanNodeId = baseNodeId.replace(/^[^_]+_/, '');
                  
                  // Apply the PDF naming convention
                  window.setNodeId(cell, cleanNodeId);
                  
                  // Update the Node ID field in the popup to show the new ID with PDF prefix
                  if (currentNodeId) {
                    const nodeIdSpan = currentNodeId.querySelector('span');
                    if (nodeIdSpan) {
                      const newNodeId = window.getNodeId ? window.getNodeId(cell) : cleanNodeId;
                      nodeIdSpan.textContent = newNodeId;
                    }
                  }
                }
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propPdfFile':
                // Update the PDF file property
                cell._pdfFile = newValue;
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propPdfPrice':
                // Update the PDF price property
                cell._pdfPrice = newValue;
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propHiddenNodeId':
                // Update the hidden node ID property
                cell._hiddenNodeId = newValue;
                
                // Update the node text to match the Node ID for hidden nodes
                if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) {
                  // Update hidden checkbox node display
                  if (typeof window.updateHiddenCheckboxNodeCell === 'function') {
                    window.updateHiddenCheckboxNodeCell(cell);
                  }
                } else if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
                  // Update hidden textbox node display
                  if (typeof window.updateHiddenTextboxNodeCell === 'function') {
                    window.updateHiddenTextboxNodeCell(cell);
                  }
                }
                
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propLinkedLogicNodeId':
                // Update the linked logic node ID property
                console.log('💾 [SAVE VALUE] Updating _linkedLogicNodeId from', cell._linkedLogicNodeId, 'to', newValue);
                cell._linkedLogicNodeId = newValue;
                
                // Update the node text to match the Node ID for linked logic nodes
                if (typeof window.updateLinkedLogicNodeCell === 'function') {
                  window.updateLinkedLogicNodeCell(cell);
                }
                
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propDefaultText':
                // Update the default text property for hidden textbox
                cell._defaultText = newValue;
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
            }
            
            // Refresh the graph
            if (window.graph) {
              window.graph.refresh(cell);
              if (window.refreshAllCells) {
                window.refreshAllCells();
              }
            }
          };
          
          input.addEventListener('blur', saveValue);
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveValue();
            } else if (e.key === 'Escape') {
              valueSpan.style.display = 'block';
              // Safely remove input element if it still exists
              if (input && input.parentNode) {
                input.remove();
              }
            }
          });
        });
      }
      
      valueSpan.addEventListener('mouseenter', () => {
        valueSpan.style.borderColor = '#1976d2';
        valueSpan.style.backgroundColor = '#f0f8ff';
      });
      
      valueSpan.addEventListener('mouseleave', () => {
        valueSpan.style.borderColor = '#ddd';
        valueSpan.style.backgroundColor = '#f9f9f9';
      });
    }
    
    fieldDiv.appendChild(label);
    if (valueSpan) {
      fieldDiv.appendChild(valueSpan);
    }
    content.appendChild(fieldDiv);
  });
  
  
  // Ensure content has some content even if properties array was empty
  if (content.children.length === 0) {
    const fallbackDiv = document.createElement('div');
    fallbackDiv.innerHTML = `
      <div style="margin-bottom: 15px;">
        <strong>Node ID:</strong> <span>${cell.id || 'Unknown'}</span>
      </div>
      <div style="margin-bottom: 15px;">
        <strong>Node Type:</strong> <span>${cell.style?.includes('nodeType=question') ? 'Question' : 'Other'}</span>
      </div>
      <div style="margin-bottom: 15px;">
        <strong>Node Value:</strong> <span>${cell.value ? 'Has content' : 'No content'}</span>
      </div>
      <div style="margin-bottom: 15px;">
        <strong>Style:</strong> <span>${cell.style ? 'Has style' : 'No style'}</span>
      </div>
    `;
    content.appendChild(fallbackDiv);
  }
  
  // Create buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
  `;
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Close';
  cancelBtn.style.cssText = `
    padding: 10px 20px;
    background: #f5f5f5;
    color: #666;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  `;
  
  buttonContainer.appendChild(cancelBtn);
  
  // Assemble popup
  popup.appendChild(header);
  popup.appendChild(content);
  popup.appendChild(buttonContainer);
  document.body.appendChild(popup);
  
  // Verify popup is actually in the DOM
  const popupInDOM = document.querySelector('.properties-modal');
  
  // Check popup dimensions immediately after adding to DOM
  const initialRect = popup.getBoundingClientRect();
  
  // Check for any conflicting CSS rules
  const allStyles = document.styleSheets;
  let conflictingRules = [];
  for (let i = 0; i < allStyles.length; i++) {
    try {
      const sheet = allStyles[i];
      if (sheet.cssRules) {
        for (let j = 0; j < sheet.cssRules.length; j++) {
          const rule = sheet.cssRules[j];
          if (rule.selectorText && rule.selectorText.includes('properties-modal')) {
            conflictingRules.push({
              selector: rule.selectorText,
              styles: rule.style.cssText
            });
          }
        }
      }
    } catch (e) {
      // Skip stylesheets that can't be accessed (CORS issues)
    }
  }
  
  
  // Popup should now be visible
  
  // Temporary alert to confirm popup creation
  setTimeout(() => {
    // Check if popup still exists after 100ms
    const popupStillExists = document.querySelector('.properties-modal');
    if (popupStillExists) {
      const rect = popupStillExists.getBoundingClientRect();
      //alert("Properties popup created successfully! You should see the properties dialog in the center of the screen. Dimensions: " + rect.width + "x" + rect.height);
    } else {
      //alert("ERROR: Properties popup was created but disappeared after 100ms! Something is removing it.");
    }
  }, 100);
  
  // Auto-copy node ID to clipboard when popup opens
  if (nodeId && nodeId.trim()) {
    navigator.clipboard.writeText(nodeId).then(() => {
      console.log('Node ID copied to clipboard:', nodeId);
    }).catch(err => {
      // Clipboard access failed, ignore
    });
  }
  
  // Focus management
  let focusTimeout = null;
  let isClosing = false;
  
  const closePopup = () => {
    if (isClosing) return;
    isClosing = true;
    
    // Set a global flag to prevent reopening
    window.__propertiesPopupClosing = true;
    
    if (focusTimeout) {
      clearTimeout(focusTimeout);
      focusTimeout = null;
    }
    
    popup.style.display = 'none';
    popup.style.pointerEvents = 'none';
    popup.style.opacity = '0';
    
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
      window.__propertiesPopupOpen = false;
      window.__propertiesPopupClosing = false;
      isClosing = false;
    }, 100); // Slightly longer delay to ensure cleanup
  };
  
  const killFocusTimer = () => {
    if (focusTimeout) {
      clearTimeout(focusTimeout);
      focusTimeout = null;
    }
  };
  
  // Event listeners
  closeBtn.addEventListener('pointerdown', killFocusTimer);
  cancelBtn.addEventListener('pointerdown', killFocusTimer);
  
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    newClosePopup();
  });
  
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    newClosePopup();
  });
  
  // Handle clicking outside popup (optimized version)
  let outsideClickHandler = null;
  
  const handleOutsideClick = (e) => {
    // Only handle if popup still exists and is visible
    if (!popup || popup.style.display === 'none' || isClosing) {
      return;
    }
    
    // Check if the click is outside the popup
    if (!popup.contains(e.target)) {
      // Simple check: if click is not on the popup, close it
      // No expensive cell detection - just close on any outside click
      newClosePopup();
    }
  };
  
  // Add event listener with a reasonable delay to avoid interfering with double-click
  setTimeout(() => {
    outsideClickHandler = handleOutsideClick;
    document.addEventListener('click', outsideClickHandler, true);
  }, 300); // 300ms delay - longer than double-click detection (250ms)
  
  // Clean up event listeners when popup closes
  const originalClosePopup = closePopup;
  const newClosePopup = () => {
    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler, true);
      outsideClickHandler = null;
    }
    document.removeEventListener('keydown', handleEscape);
    originalClosePopup();
  };
  
  // Handle Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
    }
  };
  
  document.addEventListener('keydown', handleEscape);
  
  // Add hover effects for close button
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.backgroundColor = '#f0f0f0';
    closeBtn.style.color = '#333';
  });
  
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.color = '#666';
  });
  
  // Add hover effects for cancel button
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = '#e0e0e0';
    cancelBtn.style.borderColor = '#bbb';
  });
  
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = '#f5f5f5';
    cancelBtn.style.borderColor = '#ddd';
  });
  
  // Add CSS for close button hit area
  const style = document.createElement('style');
  style.textContent = `
    #closePropertiesPopup::before {
      content: '';
      position: absolute;
      top: -8px;
      left: -8px;
      right: -8px;
      bottom: -8px;
      z-index: -1;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Show popup for editing question node text
 */
function showQuestionTextPopup(cell) {
  // --- prevent duplicate popups ---
  if (window.__questionTextPopupOpen) {
    console.log("Popup already open; skipping duplicate");
    return;
  }
  window.__questionTextPopupOpen = true;

  // (optional: clean any zombie instances)
  document.querySelectorAll('.question-text-modal').forEach(n => n.remove());

  console.log("=== SHOW QUESTION TEXT POPUP DEBUG ===");
  console.log("showQuestionTextPopup called with cell:", cell);
  console.log("Cell ID:", cell.id);
  console.log("Cell style:", cell.style);
  console.log("Cell _questionText:", cell._questionText);
  console.log("Cell value:", cell.value);
  
  // Get current text from the cell
  let currentText = "";
  if (cell._questionText) {
    currentText = cell._questionText;
  } else if (cell.value) {
    // Extract text from HTML value
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cell.value;
    currentText = (tempDiv.textContent || tempDiv.innerText || "").trim();
  }
  
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'question-text-modal';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 2px solid #1976d2;
    border-radius: 12px;
    padding: 30px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    z-index: 10000;
    min-width: 500px;
    max-width: 500px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Create popup content
  popup.innerHTML = `
    <div style="position: relative; margin-bottom: 20px;">
      <h3 style="margin: 0; color: #1976d2; font-size: 20px; font-weight: 600; text-align: center;">Edit Question Text</h3>
      <button id="closeQuestionText" type="button" style="position: absolute; top: -10px; right: -10px; background: #f44336; color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 18px; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); z-index: 1;">×</button>
    </div>
    <textarea 
      id="questionTextInput" 
      placeholder="Enter question text here..."
      style="
        width: 400px;
        min-height: 120px;
        padding: 15px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 16px;
        font-family: inherit;
        resize: vertical;
        margin-bottom: 20px;
        line-height: 1.5;
        transition: all 0.2s ease;
        outline: none;
      "
    >${currentText}</textarea>
    <div style="text-align: center;">
      <button id="submitQuestionText" type="button" style="
        background: #1976d2;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        margin-bottom: 12px;
        display: block;
        width: 100%;
        transition: background-color 0.2s ease;
      ">Submit</button>
      <button id="cancelQuestionText" type="button" style="
        background: #1976d2;
        color: white;
        border: 1px solid #1976d2;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      ">Cancel</button>
    </div>
  `;
  
  // Add popup to page
  console.log("Adding popup to document body");
  document.body.appendChild(popup);
  console.log("Popup added to DOM");
  
  // Add CSS for enlarged hit area on close button
  const style = document.createElement('style');
  style.textContent = `
    #closeQuestionText::before {
      content: "";
      position: absolute;
      inset: -8px;
      z-index: -1;
    }
  `;
  document.head.appendChild(style);
  
  // Get all DOM elements first
  const textarea = popup.querySelector('#questionTextInput');
  const submitBtn = popup.querySelector('#submitQuestionText');
  const cancelBtn = popup.querySelector('#cancelQuestionText');
  const closeBtn = popup.querySelector('#closeQuestionText');
  
  console.log("Textarea element found:", textarea);
  console.log("Submit button found:", submitBtn);
  console.log("Cancel button found:", cancelBtn);
  console.log("Close button found:", closeBtn);
  
  // 🔧 1) Declare BEFORE closePopup to avoid TDZ on first submit
  let focusTimeout = null;
  let isClosing = false;
  
  // kill the delayed refocus before it can steal the click
  const killFocusTimer = () => {
    if (focusTimeout) {
      clearTimeout(focusTimeout);
      focusTimeout = null;
    }
  };

  // Close fast on pointerdown; click remains as a fallback
  const safeClose = (e) => { e.preventDefault(); e.stopPropagation(); killFocusTimer(); closePopup(); };
  const safeSubmit = (e) => { e.preventDefault(); e.stopPropagation(); killFocusTimer(); submitQuestionText(); };
  
  // Create a dedicated close function to ensure consistent behavior
  function closePopup() {
    if (isClosing) return;
    isClosing = true;

    // Kill any pending focus work
    if (focusTimeout) {
      clearTimeout(focusTimeout);
      focusTimeout = null;
    }

    // Immediately hide so the user sees it go away on the first click
    popup.style.display = 'none';
    popup.style.pointerEvents = 'none';
    popup.style.opacity = '0';

    // Remove on the next tick (avoids races with bubbling/focus)
    setTimeout(() => {
      try { 
        if (popup && popup.parentNode) {
          popup.remove();
        }
      } catch {
        try { 
          if (popup && popup.parentNode) {
            document.body.removeChild(popup);
          }
        } catch {}
      }
      window.__questionTextPopupOpen = false;  // <-- clear the guard here
    }, 0);
  }
  
  // Now define the function, all elements are available in scope
  function submitQuestionText() {
    if (isClosing) return; // avoid double-submit re-entrancy
    console.log("=== SUBMIT FUNCTION CALLED ===");

    try {
      const newText = textarea.value.trim();
      console.log("New text from textarea:", newText);

      // Always close the popup first to avoid it hanging open
      closePopup();

      if (newText) {
        console.log("New text is valid, updating cell...");

        cell._questionText = newText;

        if (cell.value && typeof cell.value === 'string' && cell.value.includes('<div')) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = cell.value;
          const textElement = tempDiv.querySelector('.question-text, .question-title-input, div');
          if (textElement) {
            textElement.textContent = newText;
            cell.value = tempDiv.innerHTML;
          } else {
            cell.value = `<div style="text-align:center;">${newText}</div>`;
          }
        } else {
          cell.value = newText;
        }

        const qt = getQuestionType(cell);
        if (qt === 'multipleTextboxes' || qt === 'multipleDropdownType') {
          if (typeof window.updateMultipleTextboxHandler === 'function') {
            window.updateMultipleTextboxHandler(cell);
          }
        } else {
          if (typeof window.updateSimpleQuestionCell === 'function') {
            window.updateSimpleQuestionCell(cell);
          }
        }

        try {
          graph.refresh(cell);
        } catch (error) {
          console.log("Graph.refresh(cell) failed:", error);
        }

        try {
          graph.getModel().beginUpdate();
          graph.getModel().setValue(cell, cell.value);
          graph.getModel().endUpdate();
        } catch (error) {
          console.log("Graph model update failed:", error);
        }

        // DISABLED: Automatic Node ID generation when submitting question text
        // Node IDs will only change when manually edited or reset using the button
        
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      } else {
        console.log("New text is empty, not updating cell.");
      }
    } catch (error) {
      console.error("Error in submit function:", error);
    }
  }
  
  // Add hover and focus effects to textarea
  textarea.addEventListener('focus', () => {
    textarea.style.borderColor = '#1976d2';
    textarea.style.boxShadow = '0 0 0 3px rgba(25, 118, 210, 0.1)';
  });
  
  // Ensure textarea is immediately ready for typing
  textarea.addEventListener('click', () => {
    // If no text is selected, position cursor at end
    if (textarea.selectionStart === textarea.selectionEnd) {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  });
  
  textarea.addEventListener('blur', () => {
    textarea.style.borderColor = '#e0e0e0';
    textarea.style.boxShadow = 'none';
  });
  
  textarea.addEventListener('mouseenter', () => {
    if (document.activeElement !== textarea) {
      textarea.style.borderColor = '#bdbdbd';
    }
  });
  
  textarea.addEventListener('mouseleave', () => {
    if (document.activeElement !== textarea) {
      textarea.style.borderColor = '#e0e0e0';
    }
  });
  
  // Ensure proper focus and text selection with multiple attempts
  requestAnimationFrame(() => {
    // First attempt: focus and select all text
    textarea.focus();
    textarea.select();
    console.log("First attempt: textarea focused and text selected");
    
    // Second attempt: ensure all text is selected (0 to end)
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
      console.log("Second attempt: all text selected from 0 to", textarea.value.length);
    }, 10);
    
    // Third attempt: final focus and select after a longer delay
    focusTimeout = setTimeout(() => {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      console.log("Final attempt: textarea focused and all text selected");
    }, 50);
  });
  
  // Add hover effects to submit button
  submitBtn.addEventListener('mouseenter', () => {
    submitBtn.style.background = '#1565c0';
  });
  
  submitBtn.addEventListener('mouseleave', () => {
    submitBtn.style.background = '#1976d2';
  });
  
  // Make the X and buttons cancel the focus timer before click
  closeBtn.addEventListener('pointerdown', safeClose);
  submitBtn.addEventListener('pointerdown', safeSubmit);
  cancelBtn.addEventListener('pointerdown', safeClose);
  
  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    submitQuestionText();
  });
  
  // Add hover effects to cancel button
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = '#1565c0';
    cancelBtn.style.borderColor = '#1565c0';
  });
  
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = '#1976d2';
    cancelBtn.style.borderColor = '#1976d2';
  });
  
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePopup();
  });
  
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePopup();
  });

  
  // Handle Enter key in textarea
  textarea.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      submitQuestionText();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
    }
  });
  
  // Handle clicking outside popup to close
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      closePopup();
    }
  });
}

/**
 * Set up keyboard navigation controls
 */
function setupKeyboardNavigation(graph) {
  // Add keyboard event listener to the graph container
  const container = document.getElementById('graphContainer');
  
  if (!container) {
    console.error('graphContainer not found for keyboard navigation');
    return;
  }
  
  console.log('Setting up keyboard navigation for container:', container);
  
  container.addEventListener('keydown', function(evt) {
    const key = evt.key;
    const ctrl = evt.ctrlKey;
    const shift = evt.shiftKey;
    
    switch(key) {
      case 'Delete':
        if (graph.isSelectionEmpty()) break;
        deleteSelectedCells(graph);
        evt.preventDefault();
        break;
        
      case 'c':
        if (ctrl) {
          // Copy handling moved to script.js to avoid duplicate calls
          // copySelectedCells(graph);
          // evt.preventDefault();
        }
        break;
        
      case 'v':
        if (ctrl) {
          // Paste handling moved to script.js to avoid duplicate calls
          // pasteCells(graph);
          // evt.preventDefault();
        }
        break;
        
      case 'x':
        if (ctrl) {
          cutSelectedCells(graph);
          evt.preventDefault();
        }
        break;
        
      case 'a':
        if (ctrl) {
          selectAllCells(graph);
          evt.preventDefault();
        }
        break;
        
      case 'z':
        if (ctrl) {
          if (shift) {
            redo(graph);
          } else {
            undo(graph);
          }
          evt.preventDefault();
        }
        break;
        
      case 'Escape':
        graph.clearSelection();
        evt.preventDefault();
        break;
    }
  });
  
  // Make the container focusable
  container.setAttribute('tabindex', '0');
  
  // Ensure container gets focus when clicked
  container.addEventListener('click', function() {
    container.focus();
  });
  
  // Also focus on mousedown to ensure immediate focus
  container.addEventListener('mousedown', function() {
    container.focus();
  });
}

/**
 * Set up panning and zooming functionality
 */
function setupPanningAndZooming(graph) {
  // Enable panning
  graph.setPanning(true);
  
  // Add mouse wheel zoom
  const container = document.getElementById('graphContainer');
  
  container.addEventListener('wheel', function(evt) {
    if (evt.ctrlKey) {
      evt.preventDefault();
      
      // Get zoom sensitivity from settings (default to 0.01 if not set)
      const sensitivity = window.userSettings?.zoomSensitivity || 0.01;
      
      // Calculate zoom delta based on sensitivity
      // Much smaller zoom increments for better control
      const baseDelta = evt.deltaY > 0 ? 0.99 : 1.01; // Very small base change
      const sensitivityFactor = sensitivity * 10; // Scale up the sensitivity value
      const delta = evt.deltaY > 0 ? 
        (1 - (1 - baseDelta) * sensitivityFactor) : 
        (1 + (baseDelta - 1) * sensitivityFactor);
      
      const scale = graph.view.scale * delta;
      
      // Limit zoom range
      if (scale >= 0.1 && scale <= 3.0) {
        // Get mouse position relative to the container
        const rect = container.getBoundingClientRect();
        const mouseX = evt.clientX - rect.left;
        const mouseY = evt.clientY - rect.top;
        
        // Get current view state
        const currentTranslate = graph.view.translate;
        const currentScale = graph.view.scale;
        
        // Calculate the point in graph coordinates that the mouse is over
        const graphX = (mouseX / currentScale) - currentTranslate.x;
        const graphY = (mouseY / currentScale) - currentTranslate.y;
        
        // Set the new scale
        graph.view.setScale(scale);
        
        // Calculate the new translation to keep the mouse point in the same screen position
        const newTranslateX = (mouseX / scale) - graphX;
        const newTranslateY = (mouseY / scale) - graphY;
        
        // Apply the new translation
        graph.view.setTranslate(newTranslateX, newTranslateY);
      }
    }
  });
  
  // Add panning with middle mouse button
  let isPanning = false;
  let lastX, lastY;
  
  container.addEventListener('mousedown', function(evt) {
    if (evt.button === 1) { // Middle mouse button
      isPanning = true;
      lastX = evt.clientX;
      lastY = evt.clientY;
      evt.preventDefault();
    }
  });
  
  container.addEventListener('mousemove', function(evt) {
    if (isPanning) {
      const deltaX = evt.clientX - lastX;
      const deltaY = evt.clientY - lastY;
      
      graph.view.setTranslate(
        graph.view.translate.x + deltaX / graph.view.scale,
        graph.view.translate.y + deltaY / graph.view.scale
      );
      
      lastX = evt.clientX;
      lastY = evt.clientY;
    }
  });
  
  container.addEventListener('mouseup', function(evt) {
    if (evt.button === 1) {
      isPanning = false;
    }
  });
}

/**
 * Update the properties panel when a cell is selected
 */
function updatePropertiesPanel(cell) {
  if (!cell) return;
  
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.updatePropertiesPanel to avoid infinite recursion
  console.log('updatePropertiesPanel called for cell:', cell);
}

/**
 * Edit a cell (double-click behavior)
 */
function editCell(cell) {
  if (!cell) return;
  
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.editCell to avoid infinite recursion
  console.log('editCell called for cell:', cell);
}

/**
 * Update cell display after changes
 */
function updateCellDisplay(cell) {
  if (!cell) return;
  
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.updateCellDisplay to avoid infinite recursion
  console.log('updateCellDisplay called for cell:', cell);
}

/**
 * Show context menu for a cell
 */
function showContextMenu(x, y, cell) {
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.showContextMenu to avoid infinite recursion
  console.log('showContextMenu called for cell:', cell, 'at', x, y);
}

/**
 * Show empty space context menu
 */
function showEmptySpaceMenu(x, y) {
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.showEmptySpaceMenu to avoid infinite recursion
  console.log('showEmptySpaceMenu called at', x, y);
}

/**
 * Delete selected cells
 */
function deleteSelectedCells(graph) {
  const cells = graph.getSelectionCells();
  if (cells.length > 0) {
    graph.removeCells(cells);
  }
}

/**
 * Copy selected cells
 */
function copySelectedCells(graph) {
  const cells = graph.getSelectionCells();
  if (cells.length > 0) {
    // Use the custom copy function that handles JSON serialization
    if (typeof window.copySelectedNodeAsJson === 'function') {
      window.copySelectedNodeAsJson();
    } else {
      console.warn('copySelectedNodeAsJson function not available');
    }
  }
}

/**
 * Cut selected cells
 */
function cutSelectedCells(graph) {
  const cells = graph.getSelectionCells();
  if (cells.length > 0) {
    graph.cutCells(cells);
  }
}

/**
 * Paste cells from clipboard
 */
function pasteCells(graph) {
  // Use the existing paste functionality from script.js
  if (typeof window.pasteNodeFromJson === 'function') {
    const mousePos = graph.getPointForEvent(graph.lastEvent);
    window.pasteNodeFromJson(mousePos ? mousePos.x : undefined, mousePos ? mousePos.y : undefined);
  }
}

/**
 * Select all cells
 */
function selectAllCells(graph) {
  graph.selectAll();
}

/**
 * Undo last action
 */
function undo(graph) {
  if (graph.undoManager && graph.undoManager.canUndo()) {
    graph.undoManager.undo();
  }
}

/**
 * Redo last action
 */
function redo(graph) {
  if (graph.undoManager && graph.undoManager.canRedo()) {
    graph.undoManager.redo();
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeGraph,
    setupGraphEventHandlers,
    setupCustomGraphEditing,
    setupCustomDoubleClickBehavior,
    setupKeyboardNavigation,
    setupPanningAndZooming,
    updatePropertiesPanel,
    editCell,
    updateCellDisplay,
    showContextMenu,
    showEmptySpaceMenu,
    deleteSelectedCells,
    copySelectedCells,
    cutSelectedCells,
    pasteCells,
    selectAllCells,
    undo,
    redo
  };
}

// Make functions globally accessible for browser use
window.initializeGraph = initializeGraph;
window.setupGraphEventHandlers = setupGraphEventHandlers;
window.setupCustomGraphEditing = setupCustomGraphEditing;
window.setupCustomDoubleClickBehavior = setupCustomDoubleClickBehavior;
window.setupKeyboardNavigation = setupKeyboardNavigation;
window.setupPanningAndZooming = setupPanningAndZooming;
window.showQuestionTextPopup = showQuestionTextPopup;
window.showPropertiesPopup = showPropertiesPopup;
window.zoomIntoNode = zoomIntoNode;

// Test function for debugging properties popup
window.testPropertiesPopup = function() {
  console.log("🔧 [TEST] Testing properties popup...");
  const graph = window.graph;
  if (!graph) {
    console.log("🔧 [TEST] No graph available");
    return;
  }
  
  const selectedCells = graph.getSelectionCells();
  if (selectedCells.length === 0) {
    console.log("🔧 [TEST] No cells selected, selecting first available cell");
    const vertices = graph.getChildVertices(graph.getDefaultParent());
    if (vertices.length > 0) {
      graph.setSelectionCell(vertices[0]);
      console.log("🔧 [TEST] Selected cell:", vertices[0]);
      showPropertiesPopup(vertices[0]);
    } else {
      console.log("🔧 [TEST] No vertices available");
    }
  } else {
    console.log("🔧 [TEST] Using selected cell:", selectedCells[0]);
    showPropertiesPopup(selectedCells[0]);
  }
};

/**
 * Populate custom dropdown with textbox question Node IDs from flowchart
 */
function populateLinkedLogicCustomDropdown(optionsContainer, hiddenSelect, cell) {
  // Clear existing options
  optionsContainer.innerHTML = '';
  hiddenSelect.innerHTML = '';
  
  // Add default option
  const defaultOption = document.createElement('div');
  defaultOption.textContent = 'Select a textbox question...';
  defaultOption.style.cssText = `
    padding: 8px;
    color: #666;
    cursor: pointer;
  `;
  defaultOption.setAttribute('data-value', '');
  optionsContainer.appendChild(defaultOption);
  
  const defaultSelectOption = document.createElement('option');
  defaultSelectOption.value = '';
  defaultSelectOption.textContent = 'Select a textbox question...';
  hiddenSelect.appendChild(defaultSelectOption);
  
  // Get all cells in the graph
  const graph = window.graph;
  if (!graph) return;
  
  const allCells = graph.getChildVertices(graph.getDefaultParent());
  
  // Find all textbox question nodes and multiple dropdown question labels
  const textboxNodes = allCells.filter(cell => {
    // Check if it's a question node with textbox type
    if (cell.style && cell.style.includes('nodeType=question')) {
      // Check if it has textbox question type (exclude dropdown types)
      const isTextbox = cell.style.includes('questionType=text') || 
                       cell.style.includes('questionType=multipleTextboxes');
      
      // Make sure it's NOT a dropdown question (including text2 which is dropdown type)
      const isDropdown = cell.style.includes('questionType=dropdown') ||
                        cell.style.includes('questionType=text2') ||
                        cell.style.includes('questionType=yesNo') ||
                        cell.style.includes('questionType=multipleChoice') ||
                        cell.style.includes('questionType=multipleDropdownType');
      
      return isTextbox && !isDropdown;
    }
    return false;
  });
  
  // Find all multiple dropdown question nodes to extract their labels
  const multipleDropdownNodes = allCells.filter(cell => {
    return cell.style && cell.style.includes('nodeType=question') && 
           cell.style.includes('questionType=multipleDropdownType');
  });
  
  // Add options for each textbox question
  textboxNodes.forEach(node => {
    // Check if it's a multiple textbox question
    if (node.style && node.style.includes('questionType=multipleTextboxes') && 
        node._textboxes && Array.isArray(node._textboxes)) {
      // Add individual textbox entries
      const baseNodeId = window.getNodeId ? window.getNodeId(node) : node.id;
      
      node._textboxes.forEach((textbox, index) => {
        if (textbox.nameId) {
          const option = document.createElement('div');
          // Convert nameId to lowercase to match the Copy ID format
          const lowercaseNameId = textbox.nameId.toLowerCase();
          const labelId = `${baseNodeId}_${lowercaseNameId}`;
          option.textContent = labelId;
          option.style.cssText = `
            padding: 8px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
          `;
          option.setAttribute('data-value', labelId);
          optionsContainer.appendChild(option);
          
          const selectOption = document.createElement('option');
          selectOption.value = labelId;
          selectOption.textContent = labelId;
          hiddenSelect.appendChild(selectOption);
        }
      });
      
      // Add location data options if location index is set
      if (node._locationIndex !== undefined) {
        const locationFields = ['street', 'city', 'state', 'zip'];
        
        locationFields.forEach(locationField => {
          const option = document.createElement('div');
          const labelId = `${baseNodeId}_${locationField}`;
          option.textContent = labelId;
          option.style.cssText = `
            padding: 8px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
          `;
          option.setAttribute('data-value', labelId);
          optionsContainer.appendChild(option);
          
          const selectOption = document.createElement('option');
          selectOption.value = labelId;
          selectOption.textContent = labelId;
          hiddenSelect.appendChild(selectOption);
          
          // Add short state field for state location field
          if (locationField === 'state') {
            const shortOption = document.createElement('div');
            const shortLabelId = `${baseNodeId}_${locationField}_short`;
            shortOption.textContent = shortLabelId;
            shortOption.style.cssText = `
              padding: 8px;
              cursor: pointer;
              border-bottom: 1px solid #eee;
            `;
            shortOption.setAttribute('data-value', shortLabelId);
            optionsContainer.appendChild(shortOption);
            
            const shortSelectOption = document.createElement('option');
            shortSelectOption.value = shortLabelId;
            shortSelectOption.textContent = shortLabelId;
            hiddenSelect.appendChild(shortSelectOption);
          }
        });
      }
    } else {
      // Regular textbox question - add the base node ID
      const option = document.createElement('div');
      const nodeId = window.getNodeId ? window.getNodeId(node) : node.id;
      option.textContent = nodeId || `Node ${node.id}`;
      option.style.cssText = `
        padding: 8px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
      `;
      option.setAttribute('data-value', nodeId);
      optionsContainer.appendChild(option);
      
      const selectOption = document.createElement('option');
      selectOption.value = nodeId;
      selectOption.textContent = nodeId || `Node ${node.id}`;
      hiddenSelect.appendChild(selectOption);
    }
  });
  
  // Add options for each multiple dropdown question label
  multipleDropdownNodes.forEach(node => {
    if (node._textboxes && Array.isArray(node._textboxes)) {
      const baseNodeId = window.getNodeId ? window.getNodeId(node) : node.id;
      
      // Get the number range from _twoNumbers
      const firstNumber = parseInt(node._twoNumbers?.first) || 1;
      const secondNumber = parseInt(node._twoNumbers?.second) || 1;
      
      node._textboxes.forEach((textbox, index) => {
        if (textbox.nameId) {
          const lowercaseNameId = textbox.nameId.toLowerCase();
          
          // Generate options for each number in the range
          for (let num = firstNumber; num <= secondNumber; num++) {
            const option = document.createElement('div');
            const labelId = `${baseNodeId}_${lowercaseNameId}_${num}`;
            option.textContent = labelId;
            option.style.cssText = `
              padding: 8px;
              cursor: pointer;
              border-bottom: 1px solid #eee;
            `;
            option.setAttribute('data-value', labelId);
            optionsContainer.appendChild(option);
            
            const selectOption = document.createElement('option');
            selectOption.value = labelId;
            selectOption.textContent = labelId;
            hiddenSelect.appendChild(selectOption);
          }
        }
      });
      
      // Add location data options if location index is set
      if (node._locationIndex !== undefined) {
        const locationFields = ['street', 'city', 'state', 'zip'];
        
        locationFields.forEach(locationField => {
          // Generate options for each number in the range for each location field
          for (let num = firstNumber; num <= secondNumber; num++) {
            const option = document.createElement('div');
            const labelId = `${baseNodeId}_${locationField}_${num}`;
            option.textContent = labelId;
            option.style.cssText = `
              padding: 8px;
              cursor: pointer;
              border-bottom: 1px solid #eee;
            `;
            option.setAttribute('data-value', labelId);
            optionsContainer.appendChild(option);
            
            const selectOption = document.createElement('option');
            selectOption.value = labelId;
            selectOption.textContent = labelId;
            hiddenSelect.appendChild(selectOption);
            
            // Add short state field for state location field
            if (locationField === 'state') {
              const shortOption = document.createElement('div');
              const shortLabelId = `${baseNodeId}_${locationField}_short_${num}`;
              shortOption.textContent = shortLabelId;
              shortOption.style.cssText = `
                padding: 8px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
              `;
              shortOption.setAttribute('data-value', shortLabelId);
              optionsContainer.appendChild(shortOption);
              
              const shortSelectOption = document.createElement('option');
              shortSelectOption.value = shortLabelId;
              shortSelectOption.textContent = shortLabelId;
              hiddenSelect.appendChild(shortSelectOption);
            }
          }
        });
      }
    }
  });
  
  // If no questions found, add a placeholder
  if (textboxNodes.length === 0 && multipleDropdownNodes.length === 0) {
    const noOptions = document.createElement('div');
    noOptions.textContent = 'No textbox questions found';
    noOptions.style.cssText = `
      padding: 8px;
      color: #666;
      font-style: italic;
    `;
    optionsContainer.appendChild(noOptions);
  }
}

/**
 * Setup custom search functionality for Linked Logic dropdowns
 */
function setupLinkedLogicCustomSearch(optionsContainer, hiddenSelect, dropdownDisplay, searchBar) {
  // Store original options for filtering
  let originalOptions = Array.from(optionsContainer.children);
  
  // Function to normalize search terms (handle spaces and underscores)
  const normalizeSearchTerm = (term) => {
    return term.toLowerCase().replace(/[\s_]+/g, '');
  };
  
  // Function to normalize option text for comparison
  const normalizeOptionText = (text) => {
    return text.toLowerCase().replace(/[\s_]+/g, '');
  };
  
  // Function to filter and update options
  const updateOptions = (searchTerm) => {
    // Clear options
    optionsContainer.innerHTML = '';
    
    if (searchTerm.length === 0) {
      // Show all options when search is empty
      originalOptions.forEach(option => {
        const newOption = option.cloneNode(true);
        optionsContainer.appendChild(newOption);
      });
    } else {
      // Filter and add matching options
      const normalizedSearch = normalizeSearchTerm(searchTerm);
      const filteredOptions = originalOptions.filter(option => {
        const text = option.textContent;
        const normalizedText = normalizeOptionText(text);
        return normalizedText.includes(normalizedSearch);
      });
      
      console.log('🔍 [SEARCH DEBUG] Filtered options:', filteredOptions.length);
      
      filteredOptions.forEach(option => {
        const newOption = option.cloneNode(true);
        optionsContainer.appendChild(newOption);
      });
      
      // If no results, show a message
      if (filteredOptions.length === 0) {
        const noResultsOption = document.createElement('div');
        noResultsOption.textContent = 'No matching fields found';
        noResultsOption.style.cssText = `
          padding: 8px;
          color: #666;
          font-style: italic;
        `;
        optionsContainer.appendChild(noResultsOption);
      }
    }
  };
  
  // Add search functionality
  searchBar.addEventListener('input', function() {
    const searchTerm = this.value;
    console.log('🔍 [SEARCH DEBUG] Searching for:', searchTerm);
    updateOptions(searchTerm);
    optionsContainer.style.display = 'block'; // Show options when typing
  });
  
  // Show options when search bar is focused
  searchBar.addEventListener('focus', function() {
    this.style.borderColor = '#2196f3';
    this.style.backgroundColor = 'white';
    updateOptions(this.value);
    optionsContainer.style.display = 'block';
  });
  
  // Handle option selection
  optionsContainer.addEventListener('click', function(e) {
    const option = e.target;
    if (option.getAttribute('data-value') !== null) {
      const value = option.getAttribute('data-value');
      const text = option.textContent;
      
      if (value) {
        dropdownDisplay.textContent = text;
        hiddenSelect.value = value;
        searchBar.value = ''; // Clear search
        optionsContainer.style.display = 'none'; // Hide options
      }
    }
  });
  
  // Hide options when search bar loses focus
  searchBar.addEventListener('blur', function() {
    this.style.borderColor = '#ddd';
    this.style.backgroundColor = '#f9f9f9';
    
    // Hide options after a short delay to allow for selection
    setTimeout(() => {
      optionsContainer.style.display = 'none';
    }, 200);
  });
}

/**
 * Setup search functionality for Linked Logic dropdowns
 */
function setupLinkedLogicSearch(dropdown, searchBar) {
  // Store original options for filtering - wait for dropdown to be populated
  let originalOptions = [];
  
  // Function to update original options
  const updateOriginalOptions = () => {
    originalOptions = Array.from(dropdown.options);
    console.log('🔍 [SEARCH DEBUG] Original options stored:', originalOptions.length);
  };
  
  // Wait a bit for dropdown to be populated, then store options
  setTimeout(updateOriginalOptions, 100);
  
  // Function to normalize search terms (handle spaces and underscores)
  const normalizeSearchTerm = (term) => {
    return term.toLowerCase().replace(/[\s_]+/g, '');
  };
  
  // Function to normalize option text for comparison
  const normalizeOptionText = (text) => {
    return text.toLowerCase().replace(/[\s_]+/g, '');
  };
  
  // Function to filter and update dropdown
  const updateDropdown = (searchTerm) => {
    // Clear dropdown
    dropdown.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a textbox question...';
    dropdown.appendChild(defaultOption);
    
    if (searchTerm.length === 0) {
      // Show all options when search is empty
      originalOptions.forEach(option => {
        if (option.value) {
          const newOption = document.createElement('option');
          newOption.value = option.value;
          newOption.textContent = option.textContent;
          dropdown.appendChild(newOption);
        }
      });
    } else {
      // Filter and add matching options
      const normalizedSearch = normalizeSearchTerm(searchTerm);
      const filteredOptions = originalOptions.filter(option => {
        if (!option.value) return false;
        const normalizedText = normalizeOptionText(option.textContent);
        return normalizedText.includes(normalizedSearch);
      });
      
      console.log('🔍 [SEARCH DEBUG] Filtered options:', filteredOptions.length);
      
      filteredOptions.forEach(option => {
        const newOption = document.createElement('option');
        newOption.value = option.value;
        newOption.textContent = option.textContent;
        dropdown.appendChild(newOption);
      });
      
      // If no results, show a message
      if (filteredOptions.length === 0) {
        const noResultsOption = document.createElement('option');
        noResultsOption.value = '';
        noResultsOption.textContent = 'No matching fields found';
        noResultsOption.disabled = true;
        dropdown.appendChild(noResultsOption);
      }
    }
    
    // Force dropdown to stay open by setting size attribute and multiple attribute
    const optionCount = dropdown.options.length;
    dropdown.size = Math.min(optionCount, 8); // Show up to 8 options
    dropdown.multiple = true; // This forces the dropdown to stay open
    dropdown.style.height = 'auto';
    dropdown.style.minHeight = '120px'; // Ensure minimum height
  };
  
  // Add search functionality
  searchBar.addEventListener('input', function() {
    const searchTerm = this.value;
    console.log('🔍 [SEARCH DEBUG] Searching for:', searchTerm);
    
    // Update original options if not set yet
    if (originalOptions.length === 0) {
      updateOriginalOptions();
    }
    
    updateDropdown(searchTerm);
  });
  
  // Keep dropdown open when search bar is focused
  searchBar.addEventListener('focus', function() {
    this.style.borderColor = '#2196f3';
    this.style.backgroundColor = 'white';
    updateDropdown(this.value);
  });
  
  // Auto-select when user clicks a filtered option
  dropdown.addEventListener('change', function() {
    // Get the selected option (for multiple select, get the first selected)
    const selectedOptions = Array.from(this.selectedOptions);
    if (selectedOptions.length > 0) {
      const selectedValue = selectedOptions[0].value;
      if (selectedValue) {
        searchBar.value = ''; // Clear search
        // Restore all options
        updateDropdown('');
        dropdown.value = selectedValue; // Set selected value
        dropdown.size = 1; // Close dropdown
        dropdown.multiple = false; // Reset to single select
      }
    }
  });
  
  // Handle search bar blur - close dropdown after a delay
  searchBar.addEventListener('blur', function() {
    this.style.borderColor = '#ddd';
    this.style.backgroundColor = '#f9f9f9';
    
    // Close dropdown after a short delay to allow for selection
    setTimeout(() => {
      dropdown.size = 1;
      dropdown.multiple = false; // Reset to single select
    }, 200);
  });
}

/**
 * Populate dropdown with textbox question Node IDs from flowchart
 */
function populateLinkedLogicDropdown(dropdown, cell) {
  // Clear existing options
  dropdown.innerHTML = '';
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a textbox question...';
  dropdown.appendChild(defaultOption);
  
  // Get all cells in the graph
  const graph = window.graph;
  if (!graph) return;
  
  const allCells = graph.getChildVertices(graph.getDefaultParent());
  
  // Find all textbox question nodes and multiple dropdown question labels
  const textboxNodes = allCells.filter(cell => {
    // Check if it's a question node with textbox type
    if (cell.style && cell.style.includes('nodeType=question')) {
      // Check if it has textbox question type (exclude dropdown types)
      const isTextbox = cell.style.includes('questionType=text') || 
                       cell.style.includes('questionType=multipleTextboxes');
      
      // Make sure it's NOT a dropdown question (including text2 which is dropdown type)
      const isDropdown = cell.style.includes('questionType=dropdown') ||
                        cell.style.includes('questionType=text2') ||
                        cell.style.includes('questionType=yesNo') ||
                        cell.style.includes('questionType=multipleChoice') ||
                        cell.style.includes('questionType=multipleDropdownType');
      
      return isTextbox && !isDropdown;
    }
    return false;
  });
  
  // Find all multiple dropdown question nodes to extract their labels
  const multipleDropdownNodes = allCells.filter(cell => {
    return cell.style && cell.style.includes('nodeType=question') && 
           cell.style.includes('questionType=multipleDropdownType');
  });
  
  // Add options for each textbox question
  textboxNodes.forEach(node => {
    // Check if it's a multiple textbox question
    if (node.style && node.style.includes('questionType=multipleTextboxes') && 
        node._textboxes && Array.isArray(node._textboxes)) {
      // Add individual textbox entries
      const baseNodeId = window.getNodeId ? window.getNodeId(node) : node.id;
      
      node._textboxes.forEach((textbox, index) => {
        if (textbox.nameId) {
          const option = document.createElement('option');
          // Convert nameId to lowercase to match the Copy ID format
          const lowercaseNameId = textbox.nameId.toLowerCase();
          const labelId = `${baseNodeId}_${lowercaseNameId}`;
          option.value = labelId;
          option.textContent = labelId;
          dropdown.appendChild(option);
        }
      });
      
      // Add location data options if location index is set
      if (node._locationIndex !== undefined) {
        const locationFields = ['street', 'city', 'state', 'zip'];
        
        locationFields.forEach(locationField => {
          const option = document.createElement('option');
          const labelId = `${baseNodeId}_${locationField}`;
          option.value = labelId;
          option.textContent = labelId;
          dropdown.appendChild(option);
          
          // Add short state field for state location field
          if (locationField === 'state') {
            const shortOption = document.createElement('option');
            const shortLabelId = `${baseNodeId}_${locationField}_short`;
            shortOption.value = shortLabelId;
            shortOption.textContent = shortLabelId;
            dropdown.appendChild(shortOption);
          }
        });
      }
    } else {
      // Regular textbox question - add the base node ID
      const option = document.createElement('option');
      const nodeId = window.getNodeId ? window.getNodeId(node) : node.id;
      option.value = nodeId;
      option.textContent = nodeId || `Node ${node.id}`;
      dropdown.appendChild(option);
    }
  });
  
  // Add options for each multiple dropdown question label
  multipleDropdownNodes.forEach(node => {
    if (node._textboxes && Array.isArray(node._textboxes)) {
      const baseNodeId = window.getNodeId ? window.getNodeId(node) : node.id;
      
      // Get the number range from _twoNumbers
      const firstNumber = parseInt(node._twoNumbers?.first) || 1;
      const secondNumber = parseInt(node._twoNumbers?.second) || 1;
      
      node._textboxes.forEach((textbox, index) => {
        if (textbox.nameId) {
          const lowercaseNameId = textbox.nameId.toLowerCase();
          
          // Generate options for each number in the range
          for (let num = firstNumber; num <= secondNumber; num++) {
            const option = document.createElement('option');
            const labelId = `${baseNodeId}_${lowercaseNameId}_${num}`;
            option.value = labelId;
            option.textContent = labelId;
            dropdown.appendChild(option);
          }
        }
      });
      
      // Add location data options if location index is set
      if (node._locationIndex !== undefined) {
        const locationFields = ['street', 'city', 'state', 'zip'];
        
        locationFields.forEach(locationField => {
          // Generate options for each number in the range for each location field
          for (let num = firstNumber; num <= secondNumber; num++) {
            const option = document.createElement('option');
            const labelId = `${baseNodeId}_${locationField}_${num}`;
            option.value = labelId;
            option.textContent = labelId;
            dropdown.appendChild(option);
            
            // Add short state field for state location field
            if (locationField === 'state') {
              const shortOption = document.createElement('option');
              const shortLabelId = `${baseNodeId}_${locationField}_short_${num}`;
              shortOption.value = shortLabelId;
              shortOption.textContent = shortLabelId;
              dropdown.appendChild(shortOption);
            }
          }
        });
      }
    }
  });
  
  // If no questions found, add a placeholder
  if (textboxNodes.length === 0 && multipleDropdownNodes.length === 0) {
    const noOptions = document.createElement('option');
    noOptions.value = '';
    noOptions.textContent = 'No textbox questions found';
    noOptions.disabled = true;
    dropdown.appendChild(noOptions);
  }
}

