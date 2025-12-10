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
        //
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
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        // Show properties popup for PDF preview nodes
        if (typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) {
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        // Show properties popup for hidden checkbox nodes
        if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) {
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        // Show properties popup for hidden textbox nodes
        if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        // Show properties popup for linked logic nodes
        if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
          if (typeof window.showPropertiesPopup === 'function') {
            window.showPropertiesPopup(cell);
          }
          return;
        }
        // Show properties popup for linked checkbox nodes
        if (typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(cell)) {
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
    return;
  }
  const graph = window.graph;
  if (!graph) {
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
}
/**
 * Test function to verify node ID copying behavior and Enter key functionality
 * Can be called from console: testNodeIdCopying()
 */
window.testNodeIdCopying = function() {
  // Find a node to test with
  const graph = window.graph;
  if (!graph) {
    return;
  }
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  if (vertices.length === 0) {
    return;
  }
  const testNode = vertices[0];
  // Open properties popup
  if (typeof window.showPropertiesPopup === 'function') {
    window.showPropertiesPopup(testNode);
  } else {
  }
};
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
  popup._cell = cell; // Store cell reference for use in event handlers
  // Determine if this is a linked checkbox node (needs wider width)
  const isLinkedCheckbox = typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(cell);
  const initialWidth = isLinkedCheckbox ? '800px' : '600px';
  const minWidth = isLinkedCheckbox ? '600px' : '500px';
  const maxWidth = isLinkedCheckbox ? '1200px' : '800px';
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
    width: ${initialWidth};
    min-width: ${minWidth};
    max-width: ${maxWidth};
    height: 600px;
    min-height: 400px;
    max-height: 90vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: auto;
    opacity: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;
  // Force the popup to be visible by setting styles directly
  popup.style.pointerEvents = 'auto';
  popup.style.opacity = '1';
  popup.style.display = 'flex';
  popup.style.visibility = 'visible';
  // Create header
  const header = document.createElement('div');
  header.className = 'properties-popup-header';
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e0e0e0;
    min-height: 40px;
    cursor: move;
    flex-shrink: 0;
  `;
  const title = document.createElement('h3');
  // Use different title for different node types
  if (typeof window.isPdfNode === 'function' && window.isPdfNode(cell)) {
    title.textContent = 'PDF Node Properties';
  } else if (typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) {
    title.textContent = 'PDF Preview Node Properties';
  } else if (typeof window.isHiddenCheckbox === 'function' && window.isHiddenCheckbox(cell)) {
    title.textContent = 'Hidden Checkbox Properties';
  } else if (typeof window.isHiddenTextbox === 'function' && window.isHiddenTextbox(cell)) {
    title.textContent = 'Hidden Textbox Properties';
  } else if (typeof window.isLinkedLogicNode === 'function' && window.isLinkedLogicNode(cell)) {
    title.textContent = 'Linked Logic Properties';
  } else if (typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(cell)) {
    title.textContent = 'Linked Checkbox Properties';
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
  closeBtn.className = 'close-btn';
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
  content.className = 'properties-popup-content';
  content.style.cssText = `
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 8px;
    min-height: 200px;
    background: #f9f9f9;
    border-radius: 8px;
    padding: 15px;
    flex: 1;
    display: flex;
    flex-direction: column;
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
    const pdfNameValue = cell._pdfName || 'PDF Document';
    const pdfFileValue = cell._pdfFile || '';
    const pdfPriceValue = cell._pdfPrice || '';
    properties = [
      { label: 'PDF Name', value: pdfNameValue, id: 'propPdfName', editable: true },
      { label: 'PDF File', value: pdfFileValue, id: 'propPdfFile', editable: true },
      { label: 'PDF Price', value: pdfPriceValue, id: 'propPdfPrice', editable: true }
    ];
  } else if (typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) {
    const pdfPreviewTitleValue = cell._pdfPreviewTitle || 'PDF Preview';
    const pdfPreviewFileValue = cell._pdfPreviewFile || '';
    properties = [
      { label: 'Preview Title', value: pdfPreviewTitleValue, id: 'propPdfPreviewTitle', editable: true },
      { label: 'Preview File', value: pdfPreviewFileValue, id: 'propPdfPreviewFile', editable: true }
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
    properties = [
      { label: 'Node ID', value: cell._linkedLogicNodeId || 'linked_logic', id: 'propLinkedLogicNodeId', editable: true },
      { label: 'Linked Fields', value: 'linkedFields', id: 'propLinkedFields', editable: false, special: 'linkedFields' }
    ];
  } else if (typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(cell)) {
    // For linked checkbox nodes, show special properties with dropdowns
    properties = [
      { label: 'Node ID', value: cell._linkedCheckboxNodeId || 'linked_checkbox', id: 'propLinkedCheckboxNodeId', editable: true },
      { label: 'Linked Checkbox Options', value: 'linkedCheckboxOptions', id: 'propLinkedCheckboxOptions', editable: false, special: 'linkedCheckboxOptions' }
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
    // Add Copy ID button for Big Paragraph nodes
    properties.push({
      label: '',
      value: '',
      id: 'propCopyId',
      editable: false,
      isButton: true,
      buttonText: 'Copy ID',
      buttonAction: () => {
        const nodeId = cell._nodeId || cell.id || 'node';
        const copyText = `${nodeId}_overlimit`;
        navigator.clipboard.writeText(copyText).then(() => {
          // Show a brief success message
          const button = document.getElementById('propCopyId');
          if (button) {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.backgroundColor = '#4CAF50';
            setTimeout(() => {
              button.textContent = originalText;
              button.style.backgroundColor = '#1976d2';
            }, 1000);
          }
        }).catch(err => {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = copyText;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        });
      }
    });
    // Add Enable PDF Logic button for Big Paragraph nodes
    properties.push({
      label: '',
      value: '',
      id: 'propEnablePdfLogic',
      editable: false,
      isButton: true,
      buttonText: 'Enable PDF Logic',
      buttonAction: () => {
        // Toggle PDF Logic enabled state
        cell._pdfLogicEnabled = !cell._pdfLogicEnabled;
        // Close the current popup and reopen it to refresh the fields
        window.__propertiesPopupOpen = false;
        setTimeout(() => {
          window.showPropertiesPopup(cell);
        }, 100);
      }
    });
    // Add PDF Logic fields (only shown when enabled)
    if (cell._pdfLogicEnabled) {
      // Debug logging for PDF Logic values
      properties.push({
        label: 'PDF Trigger Limit',
        value: cell._pdfTriggerLimit || '',
        id: 'propPdfTriggerLimit',
        editable: true,
        inputType: 'number'
      });
      properties.push({
        label: 'PDF Name',
        value: cell._bigParagraphPdfName || '',
        id: 'propBigParagraphPdfName',
        editable: true,
        inputType: 'text'
      });
      properties.push({
        label: 'PDF Filename',
        value: cell._bigParagraphPdfFile || '',
        id: 'propBigParagraphPdfFile',
        editable: true,
        inputType: 'text'
      });
      properties.push({
        label: 'PDF Price',
        value: cell._bigParagraphPdfPrice || '',
        id: 'propBigParagraphPdfPrice',
        editable: true,
        inputType: 'text'
      });
      // Add Save button for PDF Logic
      properties.push({
        label: '',
        value: '',
        id: 'propSavePdfLogic',
        editable: false,
        isButton: true,
        buttonText: 'Save PDF Logic',
        buttonAction: () => {
          window.saveBigParagraphPdfLogic(cell);
        }
      });
    }
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
            } else if (nodeIdField.textContent) {
              baseId = nodeIdField.textContent.trim();
            } else if (nodeIdField.value !== undefined) {
              baseId = nodeIdField.value.trim();
            }
          }
          // Fallback: if we still don't have a baseId, try to get it from the cell's _nameId or use getNodeId
          if (!baseId || baseId === cell.id) {
            if (cell._nameId) {
              baseId = cell._nameId;
            } else if (typeof window.getNodeId === 'function') {
              baseId = window.getNodeId(cell);
            }
          }
          const suffix = selectedValue === 'start' ? '_1' : '_2';
          const fullId = baseId + suffix;
          navigator.clipboard.writeText(fullId).then(() => {
            window.showCopyFeedback(fullId);
          }).catch(err => {
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
        mainContainer.setAttribute('data-dropdown-container', 'true');
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
        linkMainContainer.setAttribute('data-dropdown-container', 'true');
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
      // Add Save button
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.style.cssText = `
        padding: 8px 16px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-top: 8px;
        width: 100%;
      `;
      saveBtn.onclick = () => {
        // Collect all current linked field values
        const newLinkedFields = [];
        const dropdownContainers = linkedFieldsContainer.querySelectorAll('[data-dropdown-container]');
        dropdownContainers.forEach((container, index) => {
          // Try multiple selectors to find the hidden select
          let hiddenSelect = container.querySelector('select[style*="display: none"]');
          if (!hiddenSelect) {
            hiddenSelect = container.querySelector('select[style*="display:none"]');
          }
          if (!hiddenSelect) {
            // Fallback: find any select element in the container
            hiddenSelect = container.querySelector('select');
          }
          if (hiddenSelect && hiddenSelect.value) {
            newLinkedFields.push(hiddenSelect.value);
          }
        });
        // Update the cell's linked fields
        cell._linkedFields = newLinkedFields;
        // Update the cell's linked logic node ID
        const nodeIdElement = document.getElementById('propLinkedLogicNodeId');
        if (nodeIdElement) {
          // Check if it's an input element or a span element
          let nodeIdValue;
          if (nodeIdElement.tagName === 'INPUT') {
            nodeIdValue = nodeIdElement.value;
          } else {
            // It's a span element, get the text content
            nodeIdValue = nodeIdElement.textContent || nodeIdElement.innerText;
          }
          cell._linkedLogicNodeId = nodeIdValue;
        } else {
        }
        // Show success message
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#45a049';
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.backgroundColor = '#4CAF50';
        }, 1000);
        // Verify the properties were actually set on the cell
      };
      linkedFieldsContainer.appendChild(saveBtn);
      fieldDiv.appendChild(label);
      fieldDiv.appendChild(linkedFieldsContainer);
      content.appendChild(fieldDiv);
      // Helper function to update linked fields
      function updateLinkedFields(cell) {
        const dropdowns = linkedFieldsContainer.querySelectorAll('select');
        const newLinkedFields = Array.from(dropdowns).map(dropdown => dropdown.value).filter(value => value);
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
    } else if (prop.special === 'linkedCheckboxOptions') {
      // Special handling for linked checkbox options (exact replica of linkedFields)
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
      const linkedCheckboxOptionsContainer = document.createElement('div');
      linkedCheckboxOptionsContainer.setAttribute('data-linked-checkbox-container', 'true');
      linkedCheckboxOptionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
      `;
      // Create initial dropdowns (minimum 2)
      const linkedCheckboxOptions = cell._linkedCheckboxOptions || [];
      const minDropdowns = Math.max(2, linkedCheckboxOptions.length);
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
        searchBar.placeholder = 'Search for a checkbox option...';
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
        dropdownDisplay.textContent = 'Select a checkbox option...';
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
        populateLinkedCheckboxOptionsCustomDropdown(optionsContainer, hiddenSelect, cell);
        // Set selected value if it exists
        if (linkedCheckboxOptions[i]) {
          const selectedOption = optionsContainer.querySelector(`[data-value="${linkedCheckboxOptions[i]}"]`);
          if (selectedOption) {
            dropdownDisplay.textContent = selectedOption.textContent;
            hiddenSelect.value = linkedCheckboxOptions[i];
          } else {
          }
        } else {
        }
        newDropdownContainer.appendChild(dropdownDisplay);
        newDropdownContainer.appendChild(hiddenSelect);
        // Setup search functionality
        setupLinkedCheckboxOptionsCustomSearch(optionsContainer, hiddenSelect, dropdownDisplay, searchBar);
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
          updateLinkedCheckboxOptions(cell);
        };
        // Create the main container for this dropdown
        const mainContainer = document.createElement('div');
        mainContainer.setAttribute('data-dropdown-container', 'true');
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
        controlsContainer.appendChild(newDropdownContainer);
        controlsContainer.appendChild(deleteBtn);
        // Add controls container to main container
        mainContainer.appendChild(controlsContainer);
        // Add main container to linked checkbox options container
        linkedCheckboxOptionsContainer.appendChild(mainContainer);
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
        searchBar.placeholder = 'Search for a checkbox option...';
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
        dropdownDisplay.textContent = 'Select a checkbox option...';
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
        populateLinkedCheckboxOptionsCustomDropdown(optionsContainer, hiddenSelect, cell);
        linkNewDropdownContainer.appendChild(dropdownDisplay);
        linkNewDropdownContainer.appendChild(hiddenSelect);
        // Setup search functionality
        setupLinkedCheckboxOptionsCustomSearch(optionsContainer, hiddenSelect, dropdownDisplay, searchBar);
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
          updateLinkedCheckboxOptions(cell);
        };
        // Create the main container for this dropdown
        const linkMainContainer = document.createElement('div');
        linkMainContainer.setAttribute('data-dropdown-container', 'true');
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
        // Add main container to linked checkbox options container
        linkedCheckboxOptionsContainer.insertBefore(linkMainContainer, linkAnotherBtn);
        updateLinkedCheckboxOptions(cell);
      };
      linkedCheckboxOptionsContainer.appendChild(linkAnotherBtn);
      // Add Save button
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.style.cssText = `
        padding: 8px 16px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-top: 8px;
        width: 100%;
      `;
      saveBtn.onclick = () => {
        // Collect all current linked checkbox option values
        const newLinkedCheckboxOptions = [];
        const dropdownContainers = linkedCheckboxOptionsContainer.querySelectorAll('[data-dropdown-container]');
        dropdownContainers.forEach((container, index) => {
          // Try multiple selectors to find the hidden select
          let hiddenSelect = container.querySelector('select[style*="display: none"]');
          if (!hiddenSelect) {
            hiddenSelect = container.querySelector('select[style*="display:none"]');
          }
          if (!hiddenSelect) {
            // Fallback: find any select element in the container
            hiddenSelect = container.querySelector('select');
          }
          if (hiddenSelect && hiddenSelect.value) {
            newLinkedCheckboxOptions.push(hiddenSelect.value);
          }
        });
        // Update the cell's linked checkbox options
        cell._linkedCheckboxOptions = newLinkedCheckboxOptions;
        // Update the cell's linked checkbox node ID
        const nodeIdElement = document.getElementById('propLinkedCheckboxNodeId');
        if (nodeIdElement) {
          // Check if it's an input element or a span element
          let nodeIdValue;
          if (nodeIdElement.tagName === 'INPUT') {
            nodeIdValue = nodeIdElement.value;
          } else {
            // It's a span element, get the text content
            nodeIdValue = nodeIdElement.textContent || nodeIdElement.innerText;
          }
          cell._linkedCheckboxNodeId = nodeIdValue;
        } else {
        }
        // Show success message
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.style.backgroundColor = '#45a049';
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.style.backgroundColor = '#4CAF50';
        }, 1000);
        // Verify the properties were actually set on the cell
      };
      linkedCheckboxOptionsContainer.appendChild(saveBtn);
      fieldDiv.appendChild(label);
      fieldDiv.appendChild(linkedCheckboxOptionsContainer);
      content.appendChild(fieldDiv);
      // Helper function to update linked checkbox options
      function updateLinkedCheckboxOptions(cell) {
        const dropdowns = linkedCheckboxOptionsContainer.querySelectorAll('select');
        const newLinkedCheckboxOptions = Array.from(dropdowns).map(dropdown => dropdown.value).filter(value => value);
        cell._linkedCheckboxOptions = newLinkedCheckboxOptions;
        // Trigger autosave
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      }
      // Add change listeners to all dropdowns
      linkedCheckboxOptionsContainer.addEventListener('change', (e) => {
        if (e.target.tagName === 'SELECT') {
          updateLinkedCheckboxOptions(cell);
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
        display: ${prop.initiallyHidden ? 'none' : 'inline-block'};
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
        fieldDiv.style.padding = '0';
        fieldDiv.style.margin = '0 0 16px 0';
        // Add left margin to center the 200px button
        button.style.marginLeft = 'calc(50% - 100px)';
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
        valueSpan.title = 'Click to copy to clipboard, double-click for green border effect, then click again to edit';
        // Handle double-click for green border effect and copy
        valueSpan.addEventListener('dblclick', async (e) => {
          e.preventDefault();
          // Don't show copy feedback during auto-focus
          if (window._autoFocusingNodeText) return;
          try {
            await navigator.clipboard.writeText(prop.value);
            // Show green border effect
            const originalBorder = valueSpan.style.border;
            const originalText = valueSpan.textContent;
            const originalBg = valueSpan.style.backgroundColor;
            const originalColor = valueSpan.style.color;
            valueSpan.style.border = '3px solid #4CAF50';
            valueSpan.style.borderRadius = '4px';
            valueSpan.textContent = 'Copied!';
            valueSpan.style.backgroundColor = '#e8f5e8';
            valueSpan.style.color = '#2e7d32';
            valueSpan.style.fontWeight = 'bold';
            setTimeout(() => {
              valueSpan.style.border = originalBorder;
              valueSpan.style.borderRadius = '';
              valueSpan.textContent = originalText;
              valueSpan.style.backgroundColor = originalBg;
              valueSpan.style.color = originalColor;
              valueSpan.style.fontWeight = 'normal';
            }, 1500);
          } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = prop.value;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            // Show green border effect for fallback
            const originalBorder = valueSpan.style.border;
            const originalText = valueSpan.textContent;
            const originalBg = valueSpan.style.backgroundColor;
            const originalColor = valueSpan.style.color;
            valueSpan.style.border = '3px solid #4CAF50';
            valueSpan.style.borderRadius = '4px';
            valueSpan.textContent = 'Copied!';
            valueSpan.style.backgroundColor = '#e8f5e8';
            valueSpan.style.color = '#2e7d32';
            valueSpan.style.fontWeight = 'bold';
            setTimeout(() => {
              valueSpan.style.border = originalBorder;
              valueSpan.style.borderRadius = '';
              valueSpan.textContent = originalText;
              valueSpan.style.backgroundColor = originalBg;
              valueSpan.style.color = originalColor;
              valueSpan.style.fontWeight = 'normal';
            }, 1500);
          }
        });
        // Handle click to copy
        valueSpan.addEventListener('click', async (e) => {
          // Only copy if the field is not already focused for editing
          // and we're not in the middle of auto-focusing the node text field
          if (document.activeElement !== valueSpan && !window._autoFocusingNodeText) {
            e.preventDefault();
            try {
              await navigator.clipboard.writeText(prop.value);
              // Show visual feedback
              const originalText = valueSpan.textContent;
              const originalBg = valueSpan.style.backgroundColor;
              const originalColor = valueSpan.style.color;
              valueSpan.textContent = 'Copied!';
              valueSpan.style.backgroundColor = '#e8f5e8';
              valueSpan.style.color = '#2e7d32';
              valueSpan.style.fontWeight = 'bold';
              setTimeout(() => {
                valueSpan.textContent = originalText;
                valueSpan.style.backgroundColor = originalBg;
                valueSpan.style.color = originalColor;
                valueSpan.style.fontWeight = 'normal';
              }, 1500);
            } catch (err) {
              // Fallback for older browsers
              const textArea = document.createElement('textarea');
              textArea.value = prop.value;
              document.body.appendChild(textArea);
              textArea.select();
              document.execCommand('copy');
              document.body.removeChild(textArea);
              // Show visual feedback for fallback
              const originalText = valueSpan.textContent;
              const originalBg = valueSpan.style.backgroundColor;
              const originalColor = valueSpan.style.color;
              valueSpan.textContent = 'Copied!';
              valueSpan.style.backgroundColor = '#e8f5e8';
              valueSpan.style.color = '#2e7d32';
              valueSpan.style.fontWeight = 'bold';
              setTimeout(() => {
                valueSpan.textContent = originalText;
                valueSpan.style.backgroundColor = originalBg;
                valueSpan.style.color = originalColor;
                valueSpan.style.fontWeight = 'normal';
              }, 1500);
            }
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
          display: none;
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
            window._isUpdatingProperties = false;
            return;
          }
          if (!correctNodeId) {
            window._isUpdatingProperties = false;
            return;
          }
          // Update the Node ID field display
          valueSpan.textContent = correctNodeId;
          // Update the actual cell's Node ID
          if (typeof window.setNodeId === 'function') {
            window.setNodeId(cell, correctNodeId);
          } else {
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
          input.id = prop.id + '_input'; // Set a unique ID on the input element
          // Debug logging for input creation
          // Special debugging for PDF properties
          if (prop.id === 'propPdfName' || prop.id === 'propPdfFile' || prop.id === 'propPdfPrice') {
          }
          // Special debugging for PDF preview properties
          if (prop.id === 'propPdfPreviewTitle' || prop.id === 'propPdfPreviewFile') {
          }
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
            // Special debugging for PDF properties
            if (prop.id === 'propPdfName' || prop.id === 'propPdfFile' || prop.id === 'propPdfPrice') {
            }
            // For PDF Logic fields and PDF Preview fields, keep the input element so it can be found by the save function
            const isPdfLogicField = prop.id && prop.id.startsWith('propPdf');
            const isPdfPreviewField = prop.id === 'propPdfPreviewTitle' || prop.id === 'propPdfPreviewFile';
            if (!isPdfLogicField && !isPdfPreviewField && input && input.parentNode) {
              input.remove();
            } else if (isPdfPreviewField) {
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
              case 'propBigParagraphPdfName':
                // Update the Big Paragraph PDF name property
                if (newValue !== '') {
                  cell._bigParagraphPdfName = newValue;
                }
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propBigParagraphPdfFile':
                // Update the Big Paragraph PDF file property
                if (newValue !== '') {
                  cell._bigParagraphPdfFile = newValue;
                }
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propBigParagraphPdfPrice':
                // Update the Big Paragraph PDF price property
                if (newValue !== '') {
                  cell._bigParagraphPdfPrice = newValue;
                }
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
              case 'propLinkedCheckboxNodeId':
                // Update the linked checkbox node ID property
                cell._linkedCheckboxNodeId = newValue;
                // Update the node text to match the Node ID for linked checkbox nodes
                if (typeof window.updateLinkedCheckboxNodeCell === 'function') {
                  window.updateLinkedCheckboxNodeCell(cell);
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
              case 'propPdfName':
                cell._pdfName = newValue;
                // Update PDF node display if function exists
                if (typeof window.updatePdfNodeCell === 'function') {
                  window.updatePdfNodeCell(cell);
                }
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propPdfFile':
                cell._pdfFile = newValue;
                // Update PDF node display if function exists
                if (typeof window.updatePdfNodeCell === 'function') {
                  window.updatePdfNodeCell(cell);
                }
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propPdfPrice':
                cell._pdfPrice = newValue;
                // Update PDF node display if function exists
                if (typeof window.updatePdfNodeCell === 'function') {
                  window.updatePdfNodeCell(cell);
                }
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propPdfPreviewTitle':
                cell._pdfPreviewTitle = newValue;
                // Update PDF preview node display if function exists
                if (typeof window.updatePdfPreviewNodeCell === 'function') {
                  window.updatePdfPreviewNodeCell(cell);
                }
                // Trigger autosave
                if (typeof window.requestAutosave === 'function') {
                  window.requestAutosave();
                }
                break;
              case 'propPdfPreviewFile':
                cell._pdfPreviewFile = newValue;
                // Update PDF preview node display if function exists
                if (typeof window.updatePdfPreviewNodeCell === 'function') {
                  window.updatePdfPreviewNodeCell(cell);
                }
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
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
    flex-shrink: 0;
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
  // Auto-focus on the node text input field
  setTimeout(() => {
    const nodeTextField = content.querySelector('[data-property="propNodeText"] .editable-field');
    if (nodeTextField) {
      // Set a flag to prevent copy feedback during auto-focus
      window._autoFocusingNodeText = true;
      // Simulate a click on the node text field to open the input
      nodeTextField.click();
      // Clear the flag after a short delay
      setTimeout(() => {
        window._autoFocusingNodeText = false;
      }, 200);
    }
  }, 100); // Small delay to ensure the popup is fully rendered
  // Add Enter key handler to close the popup
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      // Only close if not editing a text field
      const activeElement = document.activeElement;
      const isEditing = activeElement && (
        activeElement.contentEditable === 'true' || 
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA'
      );
      if (!isEditing) {
        e.preventDefault();
        newClosePopup();
      }
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  // Store the handler so we can remove it when closing
  popup._keyDownHandler = handleKeyDown;
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
  // Node ID copying is now handled by clicking on the input field
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
    // Save any PDF properties that might be in input fields but not yet saved
    if (typeof window.isPdfNode === 'function' && window.isPdfNode(cell)) {
      // Check for PDF Name input
      const pdfNameInput = document.getElementById('propPdfName_input');
      if (pdfNameInput) {
        const pdfNameValue = pdfNameInput.value.trim();
        if (pdfNameValue !== cell._pdfName) {
          cell._pdfName = pdfNameValue;
          if (typeof window.updatePdfNodeCell === 'function') {
            window.updatePdfNodeCell(cell);
          }
        }
      } else {
      }
      // Check for PDF File input
      const pdfFileInput = document.getElementById('propPdfFile_input');
      if (pdfFileInput) {
        const pdfFileValue = pdfFileInput.value.trim();
        if (pdfFileValue !== cell._pdfFile) {
          cell._pdfFile = pdfFileValue;
          if (typeof window.updatePdfNodeCell === 'function') {
            window.updatePdfNodeCell(cell);
          }
        }
      } else {
      }
      // Check for PDF Price input
      const pdfPriceInput = document.getElementById('propPdfPrice_input');
      if (pdfPriceInput) {
        const pdfPriceValue = pdfPriceInput.value.trim();
        if (pdfPriceValue !== cell._pdfPrice) {
          cell._pdfPrice = pdfPriceValue;
          if (typeof window.updatePdfNodeCell === 'function') {
            window.updatePdfNodeCell(cell);
          }
        }
      } else {
      }
      // Trigger autosave after saving PDF properties
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    }
    // Save any PDF preview properties that might be in input fields but not yet saved
    if (typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) {
      // Check for Preview Title input
      const pdfPreviewTitleInput = document.getElementById('propPdfPreviewTitle_input');
      if (pdfPreviewTitleInput) {
        const pdfPreviewTitleValue = pdfPreviewTitleInput.value.trim();
        if (pdfPreviewTitleValue !== cell._pdfPreviewTitle) {
          cell._pdfPreviewTitle = pdfPreviewTitleValue;
          if (typeof window.updatePdfPreviewNodeCell === 'function') {
            window.updatePdfPreviewNodeCell(cell);
          }
        }
      } else {
      }
      // Check for Preview File input
      const pdfPreviewFileInput = document.getElementById('propPdfPreviewFile_input');
      if (pdfPreviewFileInput) {
        const pdfPreviewFileValue = pdfPreviewFileInput.value.trim();
        if (pdfPreviewFileValue !== cell._pdfPreviewFile) {
          cell._pdfPreviewFile = pdfPreviewFileValue;
          if (typeof window.updatePdfPreviewNodeCell === 'function') {
            window.updatePdfPreviewNodeCell(cell);
          }
        }
      } else {
      }
      // Trigger autosave after saving PDF preview properties
      if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
      }
    }
    // Auto-save Big Paragraph PDF Logic if enabled
    if (cell._pdfLogicEnabled && typeof window.saveBigParagraphPdfLogic === 'function') {
      window.saveBigParagraphPdfLogic(cell);
    }
    // Auto-save Linked Checkbox Options if this is a linked checkbox node
    if (typeof window.isLinkedCheckboxNode === 'function' && window.isLinkedCheckboxNode(cell)) {
      const linkedCheckboxOptionsContainer = popup.querySelector('[data-linked-checkbox-container]');
      if (linkedCheckboxOptionsContainer) {
        const dropdowns = linkedCheckboxOptionsContainer.querySelectorAll('select[style*="display: none"], select[style*="display:none"]');
        const newLinkedCheckboxOptions = Array.from(dropdowns)
          .map(dropdown => dropdown.value)
          .filter(value => value && value.trim() !== '');
        cell._linkedCheckboxOptions = newLinkedCheckboxOptions;
        // Also update the linked checkbox node ID if it exists
        const nodeIdElement = document.getElementById('propLinkedCheckboxNodeId');
        if (nodeIdElement) {
          let nodeIdValue;
          if (nodeIdElement.tagName === 'INPUT') {
            nodeIdValue = nodeIdElement.value;
          } else {
            nodeIdValue = nodeIdElement.textContent || nodeIdElement.innerText;
          }
          if (nodeIdValue) {
            cell._linkedCheckboxNodeId = nodeIdValue;
          }
        }
        // Trigger autosave
        if (typeof window.requestAutosave === 'function') {
          window.requestAutosave();
        }
      } else {
      }
    }
    if (outsideClickHandler) {
      document.removeEventListener('click', outsideClickHandler, true);
      outsideClickHandler = null;
    }
    document.removeEventListener('keydown', handleEscape);
    // Remove the Enter key handler if it exists
    if (popup._keyDownHandler) {
      document.removeEventListener('keydown', popup._keyDownHandler);
      popup._keyDownHandler = null;
    }
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
  // Add CSS for close button hit area and resize handles
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
    .properties-modal .resize-handle {
      transition: background-color 0.2s ease;
    }
    .properties-modal .resize-handle:hover {
      background-color: rgba(25, 118, 210, 0.2);
    }
    .properties-modal .resize-handle:active {
      background-color: rgba(25, 118, 210, 0.4);
    }
  `;
  document.head.appendChild(style);
  // Make popup draggable
  if (typeof makePopupDraggable === 'function') {
    // Try to use the existing makePopupDraggable function, but it expects .location-ids-header
    // So we'll use our own implementation
    makePropertiesPopupDraggable(popup);
  } else {
    // Fallback: implement draggable functionality directly
    makePropertiesPopupDraggable(popup);
  }
}
/**
 * Make properties popup draggable and resizable
 */
function makePropertiesPopupDraggable(popup) {
  let isDragging = false;
  let isResizing = false;
  let resizeDirection = '';
  let startX, startY, initialX, initialY, initialWidth, initialHeight;
  const header = popup.querySelector('.properties-popup-header');
  if (!header) return;
  // Set initial centered position
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  // Create resize handles
  const resizeHandles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  resizeHandles.forEach(direction => {
    const handle = document.createElement('div');
    handle.className = `resize-handle resize-${direction}`;
    handle.style.cssText = `
      position: absolute;
      background: transparent;
      z-index: 10001;
    `;
    // Set position and size based on direction
    if (direction.includes('n')) {
      handle.style.top = '0';
      handle.style.height = '8px';
      handle.style.cursor = direction === 'n' ? 'ns-resize' : direction === 'ne' ? 'nesw-resize' : 'nwse-resize';
    }
    if (direction.includes('s')) {
      handle.style.bottom = '0';
      handle.style.height = '8px';
      handle.style.cursor = direction === 's' ? 'ns-resize' : direction === 'se' ? 'nwse-resize' : 'nesw-resize';
    }
    if (direction.includes('e')) {
      handle.style.right = '0';
      handle.style.width = '8px';
      if (!direction.includes('n') && !direction.includes('s')) {
        handle.style.cursor = 'ew-resize';
      }
    }
    if (direction.includes('w')) {
      handle.style.left = '0';
      handle.style.width = '8px';
      if (!direction.includes('n') && !direction.includes('s')) {
        handle.style.cursor = 'ew-resize';
      }
    }
    // Make corner handles larger
    if (direction.length === 2) {
      handle.style.width = '12px';
      handle.style.height = '12px';
    }
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      resizeDirection = direction;
      const rect = popup.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      initialWidth = rect.width;
      initialHeight = rect.height;
      startX = e.clientX;
      startY = e.clientY;
    });
    popup.appendChild(handle);
  });
  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  function dragStart(e) {
    // Don't drag when clicking close button or resize handles
    if (e.target.classList.contains('close-btn') || 
        e.target.closest('.close-btn') ||
        e.target.classList.contains('resize-handle') ||
        e.target.closest('.resize-handle')) return;
    isDragging = true;
    header.style.cursor = 'grabbing';
    // Get the current actual position of the popup
    const rect = popup.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    // Get the mouse position relative to the popup
    startX = e.clientX - initialX;
    startY = e.clientY - initialY;
    // Remove the centering transform and set absolute positioning
    popup.style.top = initialY + 'px';
    popup.style.left = initialX + 'px';
    popup.style.transform = 'none';
  }
  function handleMouseMove(e) {
    if (isResizing) {
      e.preventDefault();
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const rect = popup.getBoundingClientRect();
      const minWidth = parseInt(popup.style.minWidth) || 500;
      const minHeight = 300;
      let newWidth = initialWidth;
      let newHeight = initialHeight;
      let newLeft = initialX;
      let newTop = initialY;
      // Handle horizontal resizing
      if (resizeDirection.includes('e')) {
        newWidth = Math.max(minWidth, initialWidth + deltaX);
      }
      if (resizeDirection.includes('w')) {
        newWidth = Math.max(minWidth, initialWidth - deltaX);
        newLeft = initialX + (initialWidth - newWidth);
      }
      // Handle vertical resizing
      if (resizeDirection.includes('s')) {
        newHeight = Math.max(minHeight, initialHeight + deltaY);
      }
      if (resizeDirection.includes('n')) {
        newHeight = Math.max(minHeight, initialHeight - deltaY);
        newTop = initialY + (initialHeight - newHeight);
      }
      popup.style.width = newWidth + 'px';
      popup.style.height = newHeight + 'px';
      popup.style.left = newLeft + 'px';
      popup.style.top = newTop + 'px';
      popup.style.transform = 'none';
      // Force content to recalculate its available space
      // The flexbox layout will automatically adjust, but we need to ensure the popup height is set
      popup.style.display = 'flex';
    } else if (isDragging) {
      e.preventDefault();
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;
      popup.style.left = newX + 'px';
      popup.style.top = newY + 'px';
    }
  }
  function handleMouseUp(e) {
    isDragging = false;
    isResizing = false;
    resizeDirection = '';
    header.style.cursor = 'move';
  }
}
/**
 * Show popup for editing question node text
 */
function showQuestionTextPopup(cell) {
  // --- prevent duplicate popups ---
  if (window.__questionTextPopupOpen) {
    return;
  }
  window.__questionTextPopupOpen = true;
  // (optional: clean any zombie instances)
  document.querySelectorAll('.question-text-modal').forEach(n => n.remove());
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
  document.body.appendChild(popup);
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
    try {
      const newText = textarea.value.trim();
      // Always close the popup first to avoid it hanging open
      closePopup();
      if (newText) {
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
        }
        try {
          graph.getModel().beginUpdate();
          graph.getModel().setValue(cell, cell.value);
          graph.getModel().endUpdate();
        } catch (error) {
        }
        // DISABLED: Automatic Node ID generation when submitting question text
        // Node IDs will only change when manually edited or reset using the button
        if (typeof window.refreshAllCells === 'function') {
          window.refreshAllCells();
        }
      } else {
      }
    } catch (error) {
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
    // Second attempt: ensure all text is selected (0 to end)
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    }, 10);
    // Third attempt: final focus and select after a longer delay
    focusTimeout = setTimeout(() => {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
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
    return;
  }
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
      // Limit zoom range - maximum range for better usability
      if (scale >= 0.01 && scale <= 20.0) {
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
}
/**
 * Edit a cell (double-click behavior)
 */
function editCell(cell) {
  if (!cell) return;
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.editCell to avoid infinite recursion
}
/**
 * Update cell display after changes
 */
function updateCellDisplay(cell) {
  if (!cell) return;
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.updateCellDisplay to avoid infinite recursion
}
/**
 * Show context menu for a cell
 */
function showContextMenu(x, y, cell) {
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.showContextMenu to avoid infinite recursion
}
/**
 * Show empty space context menu
 */
function showEmptySpaceMenu(x, y) {
  // This function is a placeholder - actual implementation should be in script.js
  // Don't call window.showEmptySpaceMenu to avoid infinite recursion
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
// Save Big Paragraph PDF Logic function
window.saveBigParagraphPdfLogic = function(cell) {
  // Try multiple approaches to find the input elements
  let triggerLimitInput = document.getElementById('propPdfTriggerLimit_input');
  let pdfNameInput = document.getElementById('propBigParagraphPdfName_input');
  let pdfFileInput = document.getElementById('propBigParagraphPdfFile_input');
  let pdfPriceInput = document.getElementById('propBigParagraphPdfPrice_input');
  // If not found by ID, try to find by looking for input elements near the spans
  if (!triggerLimitInput) {
    const triggerLimitSpan = document.getElementById('propPdfTriggerLimit');
    if (triggerLimitSpan) {
      triggerLimitInput = triggerLimitSpan.parentNode.querySelector('input');
    }
  }
  if (!pdfNameInput) {
    const pdfNameSpan = document.getElementById('propBigParagraphPdfName');
    if (pdfNameSpan) {
      pdfNameInput = pdfNameSpan.parentNode.querySelector('input');
    }
  }
  if (!pdfFileInput) {
    const pdfFileSpan = document.getElementById('propBigParagraphPdfFile');
    if (pdfFileSpan) {
      pdfFileInput = pdfFileSpan.parentNode.querySelector('input');
    }
  }
  if (!pdfPriceInput) {
    const pdfPriceSpan = document.getElementById('propBigParagraphPdfPrice');
    if (pdfPriceSpan) {
      pdfPriceInput = pdfPriceSpan.parentNode.querySelector('input');
    }
  }
  // Debug logging - check if elements exist
  // Debug logging - check values
  // Also check if there are any input elements with these IDs in the DOM
  // Check for input elements with the new IDs
  // Save values to cell properties
  if (triggerLimitInput) {
    cell._pdfTriggerLimit = triggerLimitInput.value;
  }
  if (pdfNameInput) {
    cell._bigParagraphPdfName = pdfNameInput.value;
  }
  if (pdfFileInput) {
    cell._bigParagraphPdfFile = pdfFileInput.value;
  }
  if (pdfPriceInput) {
    cell._bigParagraphPdfPrice = pdfPriceInput.value;
  }
  // Debug: Check all cell properties after saving
  // Show success message
  const saveButton = document.getElementById('propSavePdfLogic');
  if (saveButton) {
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Saved!';
    saveButton.style.backgroundColor = '#4CAF50';
    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.style.backgroundColor = '#1976d2';
    }, 1000);
  }
  // Trigger autosave
  if (typeof window.requestAutosave === 'function') {
    window.requestAutosave();
  }
};
// Test function for debugging properties popup
window.testPropertiesPopup = function() {
  const graph = window.graph;
  if (!graph) {
    return;
  }
  const selectedCells = graph.getSelectionCells();
  if (selectedCells.length === 0) {
    const vertices = graph.getChildVertices(graph.getDefaultParent());
    if (vertices.length > 0) {
      graph.setSelectionCell(vertices[0]);
      showPropertiesPopup(vertices[0]);
    } else {
    }
  } else {
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
  // Find all numbered dropdown and multiple textbox questions to extract linked fields from checkbox options
  const numberedDropdownNodes = allCells.filter(cell => {
    return cell.style && cell.style.includes('nodeType=question') && 
           (cell.style.includes('questionType=multipleDropdownType') ||
            cell.style.includes('questionType=multipleTextboxes'));
  });
  // Helper function to add option if not already present
  const addOptionIfNotExists = (nodeId) => {
    // Check if option already exists
    const existingOption = Array.from(optionsContainer.children).find(
      opt => opt.getAttribute('data-value') === nodeId
    );
    if (!existingOption) {
      const option = document.createElement('div');
      option.textContent = nodeId;
      option.style.cssText = `
        padding: 8px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
      `;
      option.setAttribute('data-value', nodeId);
      optionsContainer.appendChild(option);
      const selectOption = document.createElement('option');
      selectOption.value = nodeId;
      selectOption.textContent = nodeId;
      hiddenSelect.appendChild(selectOption);
    }
  };
  // Extract linked fields from checkbox options in numbered dropdown/multiple textbox questions
  numberedDropdownNodes.forEach(node => {
    if (node._checkboxes && Array.isArray(node._checkboxes)) {
      const isNumberedDropdown = node.style && node.style.includes('questionType=multipleDropdownType');
      // Get the number range from _twoNumbers (only for numbered dropdowns)
      const firstNumber = isNumberedDropdown ? (parseInt(node._twoNumbers?.first) || 1) : null;
      const secondNumber = isNumberedDropdown ? (parseInt(node._twoNumbers?.second) || 1) : null;
      node._checkboxes.forEach(checkbox => {
        if (checkbox.options && Array.isArray(checkbox.options)) {
          checkbox.options.forEach(option => {
            if (option.linkedFields && Array.isArray(option.linkedFields)) {
              option.linkedFields.forEach(linkedField => {
                // Use the auto-generated title as the base ID
                const baseLinkedFieldId = linkedField.title || '';
                if (baseLinkedFieldId) {
                  if (isNumberedDropdown && firstNumber !== null && secondNumber !== null) {
                    // Generate numbered versions based on the parent question's range
                    for (let num = firstNumber; num <= secondNumber; num++) {
                      const numberedLinkedFieldId = `${baseLinkedFieldId}_${num}`;
                      addOptionIfNotExists(numberedLinkedFieldId);
                    }
                  } else {
                    // For multiple textbox questions, just add the base ID without numbers
                    addOptionIfNotExists(baseLinkedFieldId);
                  }
                }
              });
            }
          });
        }
      });
    }
  });
  // If no questions found, add a placeholder
  if (textboxNodes.length === 0 && multipleDropdownNodes.length === 0 && numberedDropdownNodes.length === 0) {
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
  // Function to extract keywords from search term
  const extractKeywords = (term) => {
    return term.toLowerCase()
      .split(/[\s_]+/)  // Split on spaces and underscores
      .filter(keyword => keyword.length > 0);  // Remove empty strings
  };
  // Function to normalize option text for comparison
  const normalizeOptionText = (text) => {
    return text.toLowerCase().replace(/[\s_]+/g, ' ');
  };
  // Function to check if option matches all keywords
  const matchesAllKeywords = (optionText, keywords) => {
    const normalizedText = normalizeOptionText(optionText);
    return keywords.every(keyword => normalizedText.includes(keyword));
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
      // Extract keywords from search term
      const keywords = extractKeywords(searchTerm);
      // Filter and add matching options
      const filteredOptions = originalOptions.filter(option => {
        const text = option.textContent;
        return matchesAllKeywords(text, keywords);
      });
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
  };
  // Wait a bit for dropdown to be populated, then store options
  setTimeout(updateOriginalOptions, 100);
  // Function to extract keywords from search term
  const extractKeywords = (term) => {
    return term.toLowerCase()
      .split(/[\s_]+/)  // Split on spaces and underscores
      .filter(keyword => keyword.length > 0);  // Remove empty strings
  };
  // Function to normalize option text for comparison
  const normalizeOptionText = (text) => {
    return text.toLowerCase().replace(/[\s_]+/g, ' ');
  };
  // Function to check if option matches all keywords
  const matchesAllKeywords = (optionText, keywords) => {
    const normalizedText = normalizeOptionText(optionText);
    return keywords.every(keyword => normalizedText.includes(keyword));
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
      // Extract keywords from search term
      const keywords = extractKeywords(searchTerm);
      // Filter and add matching options
      const filteredOptions = originalOptions.filter(option => {
        if (!option.value) return false;
        const text = option.textContent;
        return matchesAllKeywords(text, keywords);
      });
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
 * Populate custom dropdown with checkbox option Node IDs from flowchart (for linked checkbox nodes)
 */
function populateLinkedCheckboxOptionsCustomDropdown(optionsContainer, hiddenSelect, cell) {
  // Clear existing options
  optionsContainer.innerHTML = '';
  hiddenSelect.innerHTML = '';
  // Add default option
  const defaultOption = document.createElement('div');
  defaultOption.textContent = 'Select a checkbox option...';
  defaultOption.style.cssText = `
    padding: 8px;
    color: #666;
    cursor: pointer;
  `;
  defaultOption.setAttribute('data-value', '');
  optionsContainer.appendChild(defaultOption);
  const defaultSelectOption = document.createElement('option');
  defaultSelectOption.value = '';
  defaultSelectOption.textContent = 'Select a checkbox option...';
  hiddenSelect.appendChild(defaultSelectOption);
  // Get all cells in the graph
  const graph = window.graph;
  if (!graph) return;
  const allCells = graph.getChildVertices(graph.getDefaultParent());
  // Find all checkbox question nodes
  const checkboxNodes = allCells.filter(cell => {
    if (cell.style && cell.style.includes('nodeType=question')) {
      return cell.style.includes('questionType=checkbox');
    }
    return false;
  });
  // Find all dropdown question nodes (for hidden dropdown checkboxes)
  const dropdownNodes = allCells.filter(cell => {
    if (cell.style && cell.style.includes('nodeType=question')) {
      return cell.style.includes('questionType=dropdown') || cell.style.includes('questionType=text2');
    }
    return false;
  });
  // Find all numbered dropdown question nodes that have checkboxes
  const numberedDropdownNodes = allCells.filter(cell => {
    return cell.style && cell.style.includes('nodeType=question') && 
           cell.style.includes('questionType=multipleDropdownType');
  });
  // Find all hidden checkbox nodes (for hidden logic checkboxes)
  const hiddenCheckboxNodes = allCells.filter(cell => {
    return cell.style && cell.style.includes('nodeType=hiddenCheckbox');
  });
  // Helper function to add option if not already present
  function addOptionIfNotExists(nodeId, label) {
    const existingOption = Array.from(optionsContainer.children).find(
      opt => opt.getAttribute('data-value') === nodeId
    );
    if (!existingOption) {
      const optionDiv = document.createElement('div');
      optionDiv.textContent = label || nodeId;
      optionDiv.style.cssText = `
        padding: 8px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
      `;
      optionDiv.setAttribute('data-value', nodeId);
      optionsContainer.appendChild(optionDiv);
      const selectOption = document.createElement('option');
      selectOption.value = nodeId;
      selectOption.textContent = label || nodeId;
      hiddenSelect.appendChild(selectOption);
    }
  }
  // 1. Add options from checkbox questions (regular checkbox questions with option nodes)
  checkboxNodes.forEach(node => {
    // For regular checkbox questions, find option nodes connected via edges
    const outgoingEdges = graph.getOutgoingEdges(node);
    if (outgoingEdges && outgoingEdges.length > 0) {
      outgoingEdges.forEach(edge => {
        const targetCell = edge.target;
        if (targetCell && targetCell.style && targetCell.style.includes('nodeType=options')) {
          let optionNodeId = null;
          if (typeof window.getNodeId === 'function') {
            optionNodeId = window.getNodeId(targetCell);
          }
          if (!optionNodeId) {
            const nodeIdMatch = targetCell.style.match(/nodeId=([^;]+)/);
            if (nodeIdMatch && nodeIdMatch[1]) {
              optionNodeId = nodeIdMatch[1];
            }
          }
          if (optionNodeId) {
            addOptionIfNotExists(optionNodeId, optionNodeId);
          }
        }
      });
    }
    // Also check for _checkboxes property (for numbered dropdown checkboxes)
    if (node._checkboxes && Array.isArray(node._checkboxes)) {
      node._checkboxes.forEach(checkbox => {
        if (checkbox.options && Array.isArray(checkbox.options)) {
          checkbox.options.forEach(option => {
            if (option.nodeId) {
              addOptionIfNotExists(option.nodeId, option.nodeId);
            }
          });
        }
      });
    }
  });
  // 2. Add hidden dropdown checkboxes from regular dropdown questions
  dropdownNodes.forEach(node => {
    // Get the dropdown's nodeId (nameId)
    let dropdownNameId = null;
    if (typeof window.getNodeId === 'function') {
      dropdownNameId = window.getNodeId(node);
    }
    if (!dropdownNameId) {
      const nodeIdMatch = node.style.match(/nodeId=([^;]+)/);
      if (nodeIdMatch && nodeIdMatch[1]) {
        dropdownNameId = nodeIdMatch[1];
      }
    }
    // Fallback to questionId-based name
    if (!dropdownNameId && node._questionId) {
      dropdownNameId = `answer${node._questionId}`;
    }
    // Get dropdown question text for better labeling
    const questionText = node._questionText || node.value || `Question ${node._questionId || ''}`;
    // Get dropdown options from the graph (connected option nodes)
    const outgoingEdges = graph.getOutgoingEdges(node);
    if (outgoingEdges && outgoingEdges.length > 0) {
      outgoingEdges.forEach(edge => {
        const targetCell = edge.target;
        if (targetCell && targetCell.style && targetCell.style.includes('nodeType=options')) {
          // Get the option text from the cell value
          const optionText = (targetCell.value || '').replace(/<[^>]*>/g, '').trim();
          if (optionText && dropdownNameId) {
            // Sanitize option value: replace non-word chars with underscore, convert to lowercase
            const sanitizedValue = optionText.replace(/\W+/g, "_").toLowerCase();
            const checkboxId = `${dropdownNameId}_${sanitizedValue}`;
            const label = `${questionText} - ${optionText} (${checkboxId})`;
            addOptionIfNotExists(checkboxId, label);
          }
        }
      });
    }
  });
  // 3. Add hidden checkboxes from hidden logic nodes
  hiddenCheckboxNodes.forEach(node => {
    if (node._hiddenNodeId) {
      const nodeId = node._hiddenNodeId.trim();
      if (nodeId) {
        // Get node text for better labeling
        const nodeText = (node.value || '').replace(/<[^>]*>/g, '').trim() || nodeId;
        const label = `Hidden Logic: ${nodeText} (${nodeId})`;
        addOptionIfNotExists(nodeId, label);
      }
    }
  });
  // 4. Add options from numbered dropdown questions (main checkboxes and trigger sequence checkboxes)
  numberedDropdownNodes.forEach(node => {
    // Main checkboxes
    if (node._checkboxes && Array.isArray(node._checkboxes)) {
      node._checkboxes.forEach(checkbox => {
        if (checkbox.options && Array.isArray(checkbox.options)) {
          checkbox.options.forEach(option => {
            if (option.nodeId) {
              addOptionIfNotExists(option.nodeId, option.nodeId);
            }
          });
        }
      });
    }
    // Get numbered dropdown question text, nodeId, and range
    const questionText = node._questionText || node.value || `Question ${node._questionId || ''}`;
    const minValue = node._twoNumbers ? (parseInt(node._twoNumbers.first) || 1) : 1;
    const maxValue = node._twoNumbers ? (parseInt(node._twoNumbers.second) || 1) : 1;
    // Get the question nodeId for this numbered dropdown
    let questionNodeId = '';
    if (typeof window.getNodeId === 'function') {
      questionNodeId = window.getNodeId(node);
    }
    if (!questionNodeId) {
      const nodeIdMatch = node.style.match(/nodeId=([^;]+)/);
      if (nodeIdMatch && nodeIdMatch[1]) {
        questionNodeId = nodeIdMatch[1];
      }
    }
    if (!questionNodeId) {
      questionNodeId = `answer${node._questionId || ''}`;
    }
    // 5. Add hidden dropdown checkboxes from dropdowns inside numbered dropdown questions
    if (node._dropdowns && Array.isArray(node._dropdowns)) {
      node._dropdowns.forEach(dropdownItem => {
        const fieldName = dropdownItem.name || '';
        if (fieldName) {
          // Sanitize field name: lowercase, remove question marks, replace spaces with underscores
          const sanitizedFieldName = fieldName
            .toLowerCase()
            .replace(/[?]/g, '')
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '');
          // Get all dropdown options
          if (dropdownItem.options && Array.isArray(dropdownItem.options)) {
            dropdownItem.options.forEach(option => {
              const optionValue = option.text || option.value || '';
              if (optionValue) {
                // Sanitize option value
                const sanitizedOptionValue = optionValue.replace(/\W+/g, "_").toLowerCase();
                // Generate checkbox IDs for each entry number (1 to max)
                // Format: fieldName_optionValue_entryNumber (entry number last)
                for (let entryNum = minValue; entryNum <= maxValue; entryNum++) {
                  const checkboxId = `${sanitizedFieldName}_${sanitizedOptionValue}_${entryNum}`;
                  const label = `${questionText} - ${fieldName} (${entryNum}) - ${optionValue} (${checkboxId})`;
                  addOptionIfNotExists(checkboxId, label);
                }
              }
            });
          }
        }
        // Trigger sequence checkboxes and dropdowns
        if (dropdownItem.triggerSequences && Array.isArray(dropdownItem.triggerSequences)) {
          // Get the parent dropdown's nodeId (trigger title) from the dropdown field's options
          // Extract base nodeId from first option's nodeId (e.g., "is_this_plaintiff_a_business_yes" -> "is_this_plaintiff_a_business")
          // Use sanitizeNameId to preserve forward slashes
          let parentDropdownNodeId = questionNodeId; // Fallback to question nodeId
          if (dropdownItem.options && Array.isArray(dropdownItem.options) && dropdownItem.options.length > 0) {
            const firstOption = dropdownItem.options[0];
            if (firstOption.nodeId) {
              const firstOptionNodeId = firstOption.nodeId;
              const lastUnderscoreIndex = firstOptionNodeId.lastIndexOf('_');
              if (lastUnderscoreIndex > 0) {
                parentDropdownNodeId = firstOptionNodeId.substring(0, lastUnderscoreIndex);
              } else {
                parentDropdownNodeId = firstOptionNodeId;
              }
            } else if (dropdownItem.name) {
              // If no nodeId in options, generate from dropdown name using sanitizeNameId
              if (typeof window.sanitizeNameId === 'function') {
                parentDropdownNodeId = window.sanitizeNameId(dropdownItem.name);
              } else {
                parentDropdownNodeId = (dropdownItem.name || '').toLowerCase().replace(/[?]/g, '').replace(/[^a-z0-9\s\/]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
              }
            }
          } else if (dropdownItem.name) {
            // If no options, generate from dropdown name using sanitizeNameId
            if (typeof window.sanitizeNameId === 'function') {
              parentDropdownNodeId = window.sanitizeNameId(dropdownItem.name);
            } else {
              parentDropdownNodeId = (dropdownItem.name || '').toLowerCase().replace(/[?]/g, '').replace(/[^a-z0-9\s\/]+/g, '').replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
            }
          }
          dropdownItem.triggerSequences.forEach(trigger => {
            // Handle checkboxes in trigger sequences
            if (trigger.checkboxes && Array.isArray(trigger.checkboxes)) {
              trigger.checkboxes.forEach(checkbox => {
                if (checkbox.options && Array.isArray(checkbox.options)) {
                  checkbox.options.forEach(option => {
                    if (option.nodeId) {
                      addOptionIfNotExists(option.nodeId, option.nodeId);
                    }
                  });
                }
              });
            }
            // Handle dropdowns in trigger sequences
            if (trigger.dropdowns && Array.isArray(trigger.dropdowns)) {
              trigger.dropdowns.forEach(triggerDropdown => {
                const triggerDropdownFieldName = triggerDropdown.fieldName || '';
                if (triggerDropdownFieldName) {
                  // Sanitize trigger dropdown field name - use sanitizeNameId to preserve forward slashes
                  let sanitizedTriggerFieldName;
                  if (typeof window.sanitizeNameId === 'function') {
                    sanitizedTriggerFieldName = window.sanitizeNameId(triggerDropdownFieldName);
                  } else {
                    sanitizedTriggerFieldName = triggerDropdownFieldName
                      .toLowerCase()
                      .replace(/[?]/g, '')
                      .replace(/[^a-z0-9\s\/]+/g, '')
                      .replace(/\s+/g, '_')
                      .replace(/^_+|_+$/g, '');
                  }
                  // Get all dropdown options
                  if (triggerDropdown.options && Array.isArray(triggerDropdown.options)) {
                    triggerDropdown.options.forEach(option => {
                      const optionValue = option.text || '';
                      if (optionValue) {
                        // Sanitize option value - use sanitizeNameId to preserve forward slashes
                        let sanitizedOptionValue;
                        if (typeof window.sanitizeNameId === 'function') {
                          sanitizedOptionValue = window.sanitizeNameId(optionValue);
                        } else {
                          sanitizedOptionValue = optionValue.replace(/[^A-Za-z0-9\/]+/g, "_").toLowerCase().replace(/^_+|_+$/g, '');
                        }
                        // Generate checkbox IDs for each entry number (minValue to maxValue)
                        // Format: {parentDropdownNodeId}_{dropdownFieldName}_{optionValue}_{entryNumber}
                        for (let entryNum = minValue; entryNum <= maxValue; entryNum++) {
                          const checkboxId = `${parentDropdownNodeId}_${sanitizedTriggerFieldName}_${sanitizedOptionValue}_${entryNum}`;
                          const label = `${questionText} - ${fieldName} [Trigger] - ${triggerDropdownFieldName} (${entryNum}) - ${optionValue} (${checkboxId})`;
                          addOptionIfNotExists(checkboxId, label);
                        }
                      }
                    });
                  }
                }
              });
            }
          });
        }
      });
    }
  });
  // If no checkbox options found, add a placeholder
  if (optionsContainer.children.length === 1) { // Only the default option
    const noOptions = document.createElement('div');
    noOptions.textContent = 'No checkbox options found';
    noOptions.style.cssText = `
      padding: 8px;
      color: #666;
      font-style: italic;
    `;
    optionsContainer.appendChild(noOptions);
  }
}
/**
 * Setup search functionality for linked checkbox options custom dropdown
 */
function setupLinkedCheckboxOptionsCustomSearch(optionsContainer, hiddenSelect, dropdownDisplay, searchBar) {
  // Store original options for filtering
  let originalOptions = Array.from(optionsContainer.children);
  // Function to extract keywords from search term
  const extractKeywords = (term) => {
    return term.toLowerCase()
      .split(/[\s_]+/)  // Split on spaces and underscores
      .filter(keyword => keyword.length > 0);  // Remove empty strings
  };
  // Function to normalize option text for comparison
  const normalizeOptionText = (text) => {
    return text.toLowerCase().replace(/[\s_]+/g, ' ');
  };
  // Function to check if option matches all keywords
  const matchesAllKeywords = (optionText, keywords) => {
    const normalizedText = normalizeOptionText(optionText);
    return keywords.every(keyword => normalizedText.includes(keyword));
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
      // Extract keywords from search term
      const keywords = extractKeywords(searchTerm);
      // Filter and add matching options
      const filteredOptions = originalOptions.filter(option => {
        const text = option.textContent;
        return matchesAllKeywords(text, keywords);
      });
      filteredOptions.forEach(option => {
        const newOption = option.cloneNode(true);
        optionsContainer.appendChild(newOption);
      });
      // If no results, show a message
      if (filteredOptions.length === 0) {
        const noResultsOption = document.createElement('div');
        noResultsOption.textContent = 'No matching options found';
        noResultsOption.style.cssText = `
          padding: 8px;
          color: #666;
          font-style: italic;
        `;
        optionsContainer.appendChild(noResultsOption);
      }
    }
  };
  // Add click handler for option selection
  optionsContainer.addEventListener('click', function(e) {
    const clickedOption = e.target.closest('[data-value]');
    if (clickedOption) {
      const value = clickedOption.getAttribute('data-value');
      const text = clickedOption.textContent;
      if (value) {
        hiddenSelect.value = value;
        dropdownDisplay.textContent = text;
        optionsContainer.style.display = 'none';
        searchBar.value = ''; // Clear search
        updateOptions(''); // Restore all options
        // Find the cell from the popup context
        const popup = optionsContainer.closest('.properties-modal');
        if (popup && popup._cell) {
          const cell = popup._cell;
          // Immediately update the cell's linked checkbox options
          const linkedCheckboxOptionsContainer = optionsContainer.closest('[data-linked-checkbox-container]') || 
                                                 document.querySelector('[data-linked-checkbox-container]');
          if (linkedCheckboxOptionsContainer) {
            const dropdowns = linkedCheckboxOptionsContainer.querySelectorAll('select[style*="display: none"], select[style*="display:none"]');
            const newLinkedCheckboxOptions = Array.from(dropdowns)
              .map(dropdown => dropdown.value)
              .filter(value => value && value.trim() !== '');
            cell._linkedCheckboxOptions = newLinkedCheckboxOptions;
            // Trigger autosave
            if (typeof window.requestAutosave === 'function') {
              window.requestAutosave();
            }
          } else {
          }
        } else {
        }
      }
    }
  });
  // Add hover effect for options
  optionsContainer.addEventListener('mouseover', function(e) {
    const option = e.target.closest('[data-value]');
    if (option) {
      option.style.backgroundColor = '#f0f0f0';
    }
  });
  optionsContainer.addEventListener('mouseout', function(e) {
    const option = e.target.closest('[data-value]');
    if (option) {
      option.style.backgroundColor = '';
    }
  });
  // Add search functionality
  searchBar.addEventListener('input', function() {
    const searchTerm = this.value;
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
  // Close dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (!searchBar.contains(e.target) && !optionsContainer.contains(e.target) && !dropdownDisplay.contains(e.target)) {
      optionsContainer.style.display = 'none';
      searchBar.style.borderColor = '#ddd';
      searchBar.style.backgroundColor = '#f9f9f9';
    }
  });
  // Show/hide dropdown when clicking dropdown display
  dropdownDisplay.addEventListener('click', function() {
    if (optionsContainer.style.display === 'none' || !optionsContainer.style.display) {
      searchBar.focus();
      optionsContainer.style.display = 'block';
      updateOptions(searchBar.value);
    } else {
      optionsContainer.style.display = 'none';
    }
  });
  // Handle search bar blur - close dropdown after a delay
  searchBar.addEventListener('blur', function() {
    this.style.borderColor = '#ddd';
    this.style.backgroundColor = '#f9f9f9';
    // Close dropdown after a short delay to allow for selection
    setTimeout(() => {
      optionsContainer.style.display = 'none';
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
/**
 * Populate dropdown with checkbox option Node IDs from flowchart
 */
function populateLinkedCheckboxOptionsDropdown(dropdown, cell) {
  // Clear existing options
  dropdown.innerHTML = '';
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a checkbox option...';
  dropdown.appendChild(defaultOption);
  // Get all cells in the graph
  const graph = window.graph;
  if (!graph) return;
  const allCells = graph.getChildVertices(graph.getDefaultParent());
  // Find all checkbox question nodes
  const checkboxNodes = allCells.filter(cell => {
    // Check if it's a question node with checkbox type
    if (cell.style && cell.style.includes('nodeType=question')) {
      return cell.style.includes('questionType=checkbox');
    }
    return false;
  });
  // Find all numbered dropdown question nodes that have checkboxes
  const numberedDropdownNodes = allCells.filter(cell => {
    return cell.style && cell.style.includes('nodeType=question') && 
           cell.style.includes('questionType=multipleDropdownType');
  });
  // Add options from checkbox questions
  checkboxNodes.forEach(node => {
    const baseNodeId = window.getNodeId ? window.getNodeId(node) : node.id;
    // First, check if this checkbox question has options stored in _checkboxes (for numbered dropdown checkboxes)
    if (node._checkboxes && Array.isArray(node._checkboxes)) {
      node._checkboxes.forEach(checkbox => {
        if (checkbox.options && Array.isArray(checkbox.options)) {
          checkbox.options.forEach(option => {
            if (option.nodeId) {
              const optionElement = document.createElement('option');
              optionElement.value = option.nodeId;
              optionElement.textContent = option.nodeId;
              dropdown.appendChild(optionElement);
            }
          });
        }
      });
    }
    // For regular checkbox questions, find option nodes connected via edges
    // Get all outgoing edges from this checkbox question
    const outgoingEdges = graph.getOutgoingEdges(node);
    if (outgoingEdges && outgoingEdges.length > 0) {
      outgoingEdges.forEach(edge => {
        const targetCell = edge.target;
        // Check if the target is an option node (nodeType=options)
        if (targetCell && targetCell.style && targetCell.style.includes('nodeType=options')) {
          // Try to get nodeId using helper function first, then fall back to parsing style
          let optionNodeId = null;
          if (typeof window.getNodeId === 'function') {
            optionNodeId = window.getNodeId(targetCell);
          }
          // If helper function didn't work, parse from style
          if (!optionNodeId) {
            const nodeIdMatch = targetCell.style.match(/nodeId=([^;]+)/);
            if (nodeIdMatch && nodeIdMatch[1]) {
              optionNodeId = nodeIdMatch[1];
            }
          }
          if (optionNodeId) {
            // Check if this option node ID is not already in the dropdown
            const existingOption = Array.from(dropdown.options).find(opt => opt.value === optionNodeId);
            if (!existingOption) {
              const optionElement = document.createElement('option');
              optionElement.value = optionNodeId;
              optionElement.textContent = optionNodeId;
              dropdown.appendChild(optionElement);
            }
          }
        }
      });
    }
  });
  // Add options from numbered dropdown questions (main checkboxes and trigger sequence checkboxes)
  numberedDropdownNodes.forEach(node => {
    // Main checkboxes
    if (node._checkboxes && Array.isArray(node._checkboxes)) {
      node._checkboxes.forEach(checkbox => {
        if (checkbox.options && Array.isArray(checkbox.options)) {
          checkbox.options.forEach(option => {
            if (option.nodeId) {
              const optionElement = document.createElement('option');
              optionElement.value = option.nodeId;
              optionElement.textContent = option.nodeId;
              dropdown.appendChild(optionElement);
            }
          });
        }
      });
    }
    // Trigger sequence checkboxes
    if (node._dropdowns && Array.isArray(node._dropdowns)) {
      node._dropdowns.forEach(dropdownItem => {
        if (dropdownItem.triggerSequences && Array.isArray(dropdownItem.triggerSequences)) {
          dropdownItem.triggerSequences.forEach(trigger => {
            if (trigger.checkboxes && Array.isArray(trigger.checkboxes)) {
              trigger.checkboxes.forEach(checkbox => {
                if (checkbox.options && Array.isArray(checkbox.options)) {
                  checkbox.options.forEach(option => {
                    if (option.nodeId) {
                      const optionElement = document.createElement('option');
                      optionElement.value = option.nodeId;
                      optionElement.textContent = option.nodeId;
                      dropdown.appendChild(optionElement);
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
  // If no checkbox options found, add a placeholder
  if (checkboxNodes.length === 0 && numberedDropdownNodes.length === 0) {
    const noOptions = document.createElement('option');
    noOptions.value = '';
    noOptions.textContent = 'No checkbox options found';
    noOptions.disabled = true;
    dropdown.appendChild(noOptions);
  }
}