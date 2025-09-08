/**************************************************
 ************ Import/Export Functions *************
 **************************************************/

/**
 * Export the flowchart structure as JSON
 */
window.exportFlowchartJson = function () {
  if (!graph) {
    console.error('Graph not initialized');
    return;
  }
  
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
      
      // Save edge geometry (articulation points) if it exists
      if (cell.geometry && cell.geometry.points && cell.geometry.points.length > 0) {
        cellData.edgeGeometry = {
          points: cell.geometry.points.map(point => ({
            x: point.x,
            y: point.y
          }))
        };
      }
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
    
    // PDF node properties
    if (cell._pdfUrl !== undefined) cellData._pdfUrl = cell._pdfUrl;
    if (cell._priceId !== undefined) cellData._priceId = cell._priceId;
    if (cell._characterLimit !== undefined) cellData._characterLimit = cell._characterLimit;
    
    // Notes node properties
    if (cell._notesText !== undefined) cellData._notesText = cell._notesText;
    if (cell._notesBold !== undefined) cellData._notesBold = cell._notesBold;
    if (cell._notesFontSize !== undefined) cellData._notesFontSize = cell._notesFontSize;
    
    // Checklist node properties
    if (cell._checklistText !== undefined) cellData._checklistText = cell._checklistText;
    
    // Calculation node properties
    if (cell._calcTitle !== undefined) cellData._calcTitle = cell._calcTitle;
    if (cell._calcTerms !== undefined) cellData._calcTerms = cell._calcTerms;
    if (cell._calcOperator !== undefined) cellData._calcOperator = cell._calcOperator;
    if (cell._calcThreshold !== undefined) cellData._calcThreshold = cell._calcThreshold;
    if (cell._calcFinalText !== undefined) cellData._calcFinalText = cell._calcFinalText;
    
    return cellData;
  });

  // Collect all sections used by cells
  const usedSections = new Set();
  simplifiedCells.forEach(cell => {
    if (cell.style) {
      const sectionMatch = cell.style.match(/section=([^;]+)/);
      if (sectionMatch) {
        usedSections.add(sectionMatch[1]);
        console.log('🔍 [EXPORT DEBUG] Found section', sectionMatch[1], 'in cell style:', cell.style);
      }
    }
  });
  
  console.log('🔍 [EXPORT DEBUG] Sections found in cells:', Array.from(usedSections));
  console.log('🔍 [EXPORT DEBUG] Total cells processed:', simplifiedCells.length);
  
  // Debug section preferences
  console.log('🔍 [SECTION NAME DEBUG] Current section preferences from getSectionPrefs():', JSON.stringify(getSectionPrefs(), null, 2));
  console.log('🔍 [SECTION NAME DEBUG] Current section preferences from window.flowchartConfig:', JSON.stringify(window.flowchartConfig?.sectionPrefs, null, 2));
  console.log('🔍 [SECTION NAME DEBUG] Current section preferences from window.sectionPrefs:', JSON.stringify(window.sectionPrefs, null, 2));
  
  // Get current section preferences and filter to only include used sections
  const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
  console.log('🔍 [EXPORT DEBUG] Current section preferences:', JSON.stringify(currentSectionPrefs, null, 2));
  
  const exportedSectionPrefs = {};
  
  // Always include section 1 if it exists
  if (currentSectionPrefs["1"]) {
    exportedSectionPrefs["1"] = currentSectionPrefs["1"];
  }
  
  // Include all other sections that are actually used by cells
  usedSections.forEach(sectionNum => {
    console.log('🔍 [EXPORT DEBUG] Processing section', sectionNum);
    if (currentSectionPrefs[sectionNum]) {
      console.log('🔍 [EXPORT DEBUG] Section', sectionNum, 'exists in currentSectionPrefs, using it');
      exportedSectionPrefs[sectionNum] = currentSectionPrefs[sectionNum];
    } else {
      console.log('🔍 [EXPORT DEBUG] Section', sectionNum, 'not in currentSectionPrefs, creating default entry');
      // If a section is used by cells but not in sectionPrefs, create a default entry
      exportedSectionPrefs[sectionNum] = {
        borderColor: window.getDefaultSectionColor ? window.getDefaultSectionColor(parseInt(sectionNum)) : "#cccccc",
        name: `Section ${sectionNum}`
      };
    }
  });
  
  console.log('🔍 [EXPORT DEBUG] Exported section preferences:', JSON.stringify(exportedSectionPrefs, null, 2));

  // Create the export object
  const exportData = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    cells: simplifiedCells,
    sectionPrefs: exportedSectionPrefs,
    groups: window.getGroupsData ? window.getGroupsData() : {},
    metadata: {
      totalCells: simplifiedCells.length,
      questionNodes: simplifiedCells.filter(c => c.vertex && c.style && c.style.includes("nodeType=question")).length,
      optionNodes: simplifiedCells.filter(c => c.vertex && c.style && c.style.includes("nodeType=options")).length,
      calculationNodes: simplifiedCells.filter(c => c.vertex && c.style && c.style.includes("nodeType=calculation")).length
    }
  };

  // Convert to JSON string
  const jsonString = JSON.stringify(exportData, null, 2);
  
  // Download the file
  downloadJson(jsonString, `flowchart_export_${new Date().toISOString().split('T')[0]}.json`);
  
  // Copy to clipboard
  navigator.clipboard.writeText(jsonString).then(() => {
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
  
  return exportData;
};

/**
 * Import flowchart from JSON
 */
window.importFlowchartJson = function(jsonData) {
  if (!graph) {
    console.error('Graph not initialized');
    return false;
  }
  
  try {
    // Clear existing graph
    const parent = graph.getDefaultParent();
    graph.removeCells(graph.getChildCells(parent, true, true));
    
    // Parse JSON if it's a string
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    
    if (!data.cells || !Array.isArray(data.cells)) {
      throw new Error('Invalid flowchart data format');
    }
    
    // Import cells
    const importedCells = [];
    data.cells.forEach(cellData => {
      try {
        const cell = importCell(cellData);
        if (cell) {
          importedCells.push(cell);
        }
      } catch (error) {
        console.error('Error importing cell:', error, cellData);
      }
    });
    
    // Import edges after all vertices are created
    data.cells.forEach(cellData => {
      if (cellData.edge && cellData.source && cellData.target) {
        try {
          importEdge(cellData);
        } catch (error) {
          console.error('Error importing edge:', error, cellData);
        }
      }
    });
    
    console.log(`Successfully imported ${importedCells.length} cells`);
    return true;
    
  } catch (error) {
    console.error('Error importing flowchart:', error);
    alert('Error importing flowchart: ' + error.message);
    return false;
  }
};

/**
 * Import a single cell
 */
function importCell(cellData) {
  if (!graph) return null;
  
  const parent = graph.getDefaultParent();
  let cell = null;
  
  if (cellData.vertex) {
    const geometry = cellData.geometry || { x: 100, y: 100, width: 200, height: 100 };
    cell = graph.insertVertex(parent, cellData.id, cellData.value, 
      geometry.x, geometry.y, geometry.width, geometry.height, cellData.style);
  }
  
  if (cell) {
    // Restore custom properties
    Object.keys(cellData).forEach(key => {
      if (key.startsWith('_') && key !== 'id' && key !== 'vertex' && key !== 'edge') {
        cell[key] = cellData[key];
      }
    });
    
    // Update cell display
    if (window.updateCellDisplay) {
      window.updateCellDisplay(cell);
    }
  }
  
  return cell;
}

/**
 * Import an edge
 */
function importEdge(edgeData) {
  if (!graph) return null;
  
  const parent = graph.getDefaultParent();
  const source = graph.getModel().getCell(edgeData.source);
  const target = graph.getModel().getCell(edgeData.target);
  
  if (!source || !target) {
    console.warn('Source or target cell not found for edge:', edgeData);
    return null;
  }
  
  const edge = graph.insertEdge(parent, edgeData.id, edgeData.value, source, target, edgeData.style);
  
  // Restore edge geometry if it exists
  if (edgeData.edgeGeometry && edgeData.edgeGeometry.points) {
    const points = edgeData.edgeGeometry.points.map(point => new mxPoint(point.x, point.y));
    edge.geometry.points = points;
  }
  
  return edge;
}

/**
 * Clean style string by removing excessive semicolons
 */
function cleanStyle(style) {
  if (!style) return '';
  return style.replace(/;+/g, ';').replace(/^;|;$/g, '');
}

/**
 * Download JSON data as a file
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
 * Export flowchart as PNG image
 */
window.exportFlowchartPng = function() {
  if (!graph) {
    console.error('Graph not initialized');
    return;
  }
  
  try {
    // Get graph bounds
    const bounds = graph.getGraphBounds();
    const width = Math.ceil(bounds.width + 50);
    const height = Math.ceil(bounds.height + 50);
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Set background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Convert graph to image
    const imgData = graph.getImageData(0, 0, width, height, '#ffffff', true);
    
    // Draw image to canvas
    const img = new Image();
    img.onload = function() {
      ctx.drawImage(img, 0, 0);
      
      // Download the image
      const link = document.createElement('a');
      link.download = `flowchart_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    };
    img.src = imgData;
    
  } catch (error) {
    console.error('Error exporting PNG:', error);
    alert('Error exporting PNG: ' + error.message);
  }
};

/**
 * Export flowchart as SVG
 */
window.exportFlowchartSvg = function() {
  if (!graph) {
    console.error('Graph not initialized');
    return;
  }
  
  try {
    // Get graph bounds
    const bounds = graph.getGraphBounds();
    const width = Math.ceil(bounds.width + 50);
    const height = Math.ceil(bounds.height + 50);
    
    // Create SVG
    const svg = graph.getSvg(0, 0, width, height, '#ffffff');
    
    // Convert SVG to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    
    // Download the SVG
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `flowchart_${new Date().toISOString().split('T')[0]}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error exporting SVG:', error);
    alert('Error exporting SVG: ' + error.message);
  }
};

// Export utility functions
window.downloadJson = downloadJson;








