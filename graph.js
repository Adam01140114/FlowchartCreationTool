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
      console.log('Cell selected:', selection[0]);
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
  
  // Add click listener to detect double-clicks
  graph.addListener(mxEvent.CLICK, function(sender, evt) {
    const cell = evt.getProperty('cell');
    const domEvent = evt.getProperty('event'); // Get the original DOM event
    
    // Only process left clicks (button 0), ignore right clicks (button 2)
    if (domEvent && domEvent.button !== 0) {
      return;
    }
    
    if (cell && cell.vertex) {
      const currentTime = Date.now();
      
      // Check if this is a double-click on the same cell
      if (lastClickedCell === cell && (currentTime - lastClickTime) <= DOUBLE_CLICK_DELAY) {
        //console.log("🎯 DOUBLE CLICK DETECTED manually!");
        //alert("double click detected");
        
        // Show question text popup for question nodes
        if (typeof isQuestion === 'function' && isQuestion(cell)) {
          console.log("🎯 Question node detected, showing popup");
          showQuestionTextPopup(cell);
          return;
        }
        
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
  
  // Also keep the original dblClick override for compatibility
  // Override the graph's dblClick method
  const originalDblClick = graph.dblClick;
  graph.dblClick = function (evt, cell) {
    
    // Only process left clicks, ignore right clicks
    if (evt && evt.button !== undefined && evt.button !== 0) {
      return;
    }
    
    // Show question text popup for question nodes
    if (cell && cell.vertex) {
      if (typeof isQuestion === 'function' && isQuestion(cell)) {
        showQuestionTextPopup(cell);
        mxEvent.consume(evt);
        return;
      }
    }
    
    // Ensure the cell is selected before editing
    if (cell && !graph.isCellSelected(cell)) {
      graph.setSelectionCell(cell);
    }
    
    // Handle question nodes with a popup for text editing
    if (cell && typeof isQuestion === 'function' && isQuestion(cell)) {
      if (typeof showQuestionTextPopup === 'function') {
        showQuestionTextPopup(cell);
        mxEvent.consume(evt);
        return;
      }
    } else if (cell && typeof window.isQuestion === 'function' && window.isQuestion(cell)) {
      if (typeof window.showQuestionTextPopup === 'function') {
        window.showQuestionTextPopup(cell);
        mxEvent.consume(evt);
        return;
      }
    }
    
    // Add direct editing for option nodes on double-click
    if (cell && isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) {
      graph.startEditingAtCell(cell);
      mxEvent.consume(evt);
      return;
    }
    
    // Add direct editing for subtitle and info nodes on double-click
    if (cell && (isSubtitleNode(cell) || isInfoNode(cell))) {
      graph.startEditingAtCell(cell);
      mxEvent.consume(evt);
      return;
    }
    
    // Handle alert nodes - focus on the input field instead of editing the whole cell
    if (cell && isAlertNode(cell)) {
      const state = graph.view.getState(cell);
      if (state && state.text && state.text.node) {
        const inputField = state.text.node.querySelector('input[type="text"]');
        if (inputField) {
          graph.selectionModel.setCell(cell);
          inputField.focus();
          inputField.select();
          mxEvent.consume(evt);
          return;
        }
      }
    }

    // For all other nodes, enable general text editing
    if (cell && cell.vertex && !cell.edge) {
      try {
        graph.startEditingAtCell(cell);
        mxEvent.consume(evt);
        return;
      } catch (error) {
        originalDblClick(evt, cell);
        return;
      }
    }

    // anything else keeps the stock behaviour
    originalDblClick(evt, cell);
  };
  
}

/**
 * Show the Properties popup for any node
 */
function showPropertiesPopup(cell) {
  // Prevent multiple popups
  if (window.__propertiesPopupOpen) {
    return;
  }
  window.__propertiesPopupOpen = true;
  
  // Clean up any existing popups
  document.querySelectorAll('.properties-modal').forEach(n => n.remove());
  
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
  title.textContent = 'Node Properties';
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
  `;
  
  // Get cell properties
  const nodeText = cell._questionText || (() => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cell.value || "";
    return (tempDiv.textContent || tempDiv.innerText || "").trim();
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
  if (typeof window.getNodeId === 'function') {
    nodeId = window.getNodeId(cell) || 'N/A';
  } else {
    // Fallback logic if window.getNodeId is not available
    if (cell.style) {
      const styleMatch = cell.style.match(/nodeId=([^;]+)/);
      if (styleMatch) {
        nodeId = decodeURIComponent(styleMatch[1]);
      } else {
        nodeId = generateDefaultNodeId(nodeText) || cell.id || 'N/A';
      }
    } else {
      nodeId = generateDefaultNodeId(nodeText) || cell.id || 'N/A';
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
    
    // Function to find PDF properties by traversing the graph
    const findPdfProperties = (startCell, visited = new Set()) => {
      // Avoid infinite loops
      if (visited.has(startCell.id)) return null;
      visited.add(startCell.id);
      
      // If this is an option node, check if it connects directly to a PDF
      if (typeof window.isOptions === 'function' && window.isOptions(startCell)) {
        const outgoingEdges = graph.getOutgoingEdges(startCell) || [];
        const pdfNode = outgoingEdges.find(edge => {
          const target = edge.target;
          return typeof window.isPdfNode === 'function' && window.isPdfNode(target);
        });
        
        if (pdfNode) {
          const targetCell = pdfNode.target;
          return {
            nodeId: targetCell.id,
            filename: targetCell._pdfUrl || "",
            pdfUrl: targetCell._pdfUrl || "",
            priceId: targetCell._priceId || ""
          };
        }
      }
      
      // If this is a question node, check all incoming option nodes
      if (typeof window.isQuestion === 'function' && window.isQuestion(startCell)) {
        const incomingEdges = graph.getIncomingEdges(startCell) || [];
        for (const edge of incomingEdges) {
          const sourceCell = edge.source;
          if (sourceCell && typeof window.isOptions === 'function' && window.isOptions(sourceCell)) {
            const pdfProps = findPdfProperties(sourceCell, visited);
            if (pdfProps) return pdfProps;
          }
        }
      }
      
      // If this is an option node, check the question it came from
      if (typeof window.isOptions === 'function' && window.isOptions(startCell)) {
        const incomingEdges = graph.getIncomingEdges(startCell) || [];
        for (const edge of incomingEdges) {
          const sourceCell = edge.source;
          if (sourceCell && typeof window.isQuestion === 'function' && window.isQuestion(sourceCell)) {
            const pdfProps = findPdfProperties(sourceCell, visited);
            if (pdfProps) return pdfProps;
          }
        }
      }
      
      return null;
    };
    
    return findPdfProperties(cell);
  })();
  
  // Create property fields
  const properties = [
    { label: 'Node Text', value: nodeText, id: 'propNodeText', editable: true },
    { label: 'Node ID', value: nodeId, id: 'propNodeId', editable: true },
    { 
      label: 'Node Type', 
      value: nodeType, 
      id: 'propNodeType', 
      editable: false,
      isQuestionTypeDropdown: typeof window.isQuestion === 'function' && window.isQuestion(cell)
    },
    { label: 'Section', value: section, id: 'propNodeSection', editable: true },
    { label: 'Section Name', value: sectionName, id: 'propSectionName', editable: true },
    { label: 'Question Number', value: questionNumber, id: 'propQuestionNumber', editable: true }
  ];
  
  // Add PDF properties if this is an option node connected to a PDF
  if (pdfProperties) {
    // Use the actual PDF filename directly from _pdfUrl
    const pdfName = pdfProperties.filename || 'PDF Document';
    
    properties.push(
      { label: 'PDF Name', value: pdfName, id: 'propPdfName', editable: false }
    );
  }
  
  properties.forEach(prop => {
    const fieldDiv = document.createElement('div');
    fieldDiv.style.cssText = `
      margin-bottom: 16px;
      display: flex;
      align-items: center;
    `;
    
    const label = document.createElement('label');
    label.textContent = prop.label + ':';
    label.style.cssText = `
      font-weight: 600;
      color: #333;
      min-width: 120px;
      margin-right: 12px;
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
    
    const valueSpan = document.createElement('span');
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
    `;
    
    if (prop.editable) {
      // Special handling for Node ID field - copy to clipboard on click
      if (prop.id === 'propNodeId') {
        valueSpan.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(prop.value);
            console.log('Node ID copied to clipboard:', prop.value);
            
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
        
        // Add cursor pointer to indicate it's clickable
        valueSpan.style.cursor = 'pointer';
        valueSpan.title = 'Click to copy to clipboard';
      } else {
        // Regular editable field behavior for other fields
        valueSpan.addEventListener('click', () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = prop.value;
          input.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 2px solid #1976d2;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
          `;
          
          valueSpan.style.display = 'none';
          valueSpan.parentNode.insertBefore(input, valueSpan);
          input.focus();
          input.select();
          
          const saveValue = () => {
            const newValue = input.value.trim();
            valueSpan.textContent = newValue;
            valueSpan.style.display = 'block';
            input.remove();
            
            // Update cell property
            switch(prop.id) {
              case 'propNodeText':
                cell._questionText = newValue;
                cell.value = newValue;
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
              input.remove();
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
    fieldDiv.appendChild(valueSpan);
    content.appendChild(fieldDiv);
  });
  
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
  
  // Focus management
  let focusTimeout = null;
  let isClosing = false;
  
  const closePopup = () => {
    if (isClosing) return;
    isClosing = true;
    
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
      isClosing = false;
    }, 0);
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
  
  // Handle clicking outside popup
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      newClosePopup();
    }
  });
  
  // Handle Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePopup();
    }
  };
  
  document.addEventListener('keydown', handleEscape);
  
  // Clean up escape listener when popup closes
  const originalClosePopup = closePopup;
  const newClosePopup = () => {
    document.removeEventListener('keydown', handleEscape);
    originalClosePopup();
  };
  
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

        // Update the _nameId based on the new question text
        if (typeof window.refreshNodeIdFromLabel === 'function') {
          window.refreshNodeIdFromLabel(cell);
        }
        
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
          copySelectedCells(graph);
          evt.preventDefault();
        }
        break;
        
      case 'v':
        if (ctrl) {
          pasteCells(graph);
          evt.preventDefault();
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
    console.log('Container focused for keyboard input');
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
      
      // Reduced zoom sensitivity - smaller delta values
      const delta = evt.deltaY > 0 ? 0.95 : 1.05;
      const scale = graph.view.scale * delta;
      
      // Limit zoom range
      if (scale >= 0.1 && scale <= 3.0) {
        graph.view.setScale(scale);
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
    graph.copyCells(cells);
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

