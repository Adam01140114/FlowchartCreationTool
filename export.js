
// Export functionality - SVG download and other export features
// This file handles all export-related functionality

// Helper function to create SVG content from cells
function createSvgContent(cells) {
  if (!cells || cells.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">No flowchart content</text></svg>';
  }
  
  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  cells.forEach(cell => {
    const geometry = cell.getGeometry();
    if (geometry) {
      minX = Math.min(minX, geometry.x);
      minY = Math.min(minY, geometry.y);
      maxX = Math.max(maxX, geometry.x + geometry.width);
      maxY = Math.max(maxY, geometry.y + geometry.height);
    }
  });
  
  const padding = 20;
  const width = maxX - minX + (padding * 2);
  const height = maxY - minY + (padding * 2);
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  
  // Add background
  svg += `<rect width="100%" height="100%" fill="white"/>`;
  
  // Add cells
  cells.forEach(cell => {
    const geometry = cell.getGeometry();
    if (geometry) {
      const x = geometry.x - minX + padding;
      const y = geometry.y - minY + padding;
      const width = geometry.width;
      const height = geometry.height;
      const value = cell.getValue() || '';
      
      // Parse style to get colors
      const style = cell.getStyle() || '';
      const fillColor = extractStyleValue(style, 'fillColor') || '#e1f5fe';
      const strokeColor = extractStyleValue(style, 'strokeColor') || '#01579b';
      const fontColor = extractStyleValue(style, 'fontColor') || '#000000';
      
      // Create rectangle
      svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" rx="10"/>`;
      
      // Add text
      const textX = x + width / 2;
      const textY = y + height / 2;
      svg += `<text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="12" fill="${fontColor}">${escapeXml(value)}</text>`;
    }
  });
  
  svg += '</svg>';
  return svg;
}

// Helper function to extract style values
function extractStyleValue(style, key) {
  const regex = new RegExp(`${key}=([^;]+)`);
  const match = style.match(regex);
  return match ? match[1] : null;
}

// Helper function to escape XML
function escapeXml(text) {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#39;');
}

// Download flowchart as SVG with padding
window.downloadFlowchartSvg = function() {
    try {
      // Get all cells in the graph
  const parent = graph.getDefaultParent();
  const cells = graph.getChildCells(parent, true, true);

      if (cells.length === 0) {
        alert("No flowchart content to export");
        return;
      }
      
      // Calculate the bounding box of all cells
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      cells.forEach(cell => {
    if (cell.geometry) {
          minX = Math.min(minX, cell.geometry.x);
          minY = Math.min(minY, cell.geometry.y);
          maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
          maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
        }
      });
      
      // Add 100px padding around all sides
      const padding = 100;
      const width = maxX - minX + (padding * 2);
      const height = maxY - minY + (padding * 2);
      
      // Create SVG content manually
      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="0 0 
${width} ${height}">
        <rect width="${width}" height="${height}" fill="white"/>
        <defs>
          <style>
            .text { font-family: Arial, sans-serif; font-size: 14px; text-anchor: middle; dominant-baseline: middle; }
            .edge { stroke: #424242; stroke-width: 2; fill: none; }
          </style>
        </defs>`;
      
      // Helper function to parse style string and extract properties
      function parseStyle(styleString) {
        const style = {};
        if (!styleString) return style;
        
        const parts = styleString.split(';');
        parts.forEach(part => {
          const [key, value] = part.split('=');
          if (key && value) {
            style[key.trim()] = value.trim();
          }
        });
        return style;
      }
      
      // Helper function to get exact node styling
      function getNodeStyling(cell) {
        const style = parseStyle(cell.style);
        const styling = {
          fillColor: '#e1f5fe',
          strokeColor: '#01579b',
          strokeWidth: 2,
          fontSize: 14,
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          verticalAlign: 'middle',
          rounded: 10,
          dashed: false,
          strokeDasharray: null
        };
        
        // Get fill color based on node type and preferences
        if (cell.style && cell.style.includes('nodeType=question')) {
          const questionType = getQuestionType(cell);
          if (questionType === 'checkbox') styling.fillColor = colorPreferences.checkbox;
          else if (questionType === 'dropdown' || questionType === 'text2') styling.fillColor = colorPreferences.dropdown;
          else if (questionType === 'money' || questionType === 'number') styling.fillColor = colorPreferences.money;
          else if (questionType === 'date' || questionType === 'dateRange') styling.fillColor = colorPreferences.date;
          else if (questionType === 'bigParagraph') styling.fillColor = colorPreferences.bigParagraph;
          else styling.fillColor = colorPreferences.text;
        } else if (cell.style && cell.style.includes('nodeType=options')) {
          styling.fillColor = '#ffffff';
        } else if (cell.style && cell.style.includes('nodeType=end')) {
          styling.fillColor = '#CCCCCC';
        } else if (cell.style && cell.style.includes('nodeType=calculation')) {
          styling.fillColor = '#e1f5fe';
        }
        
        // Get border color from section preferences
        const section = getSection(cell);
        const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
        if (section && currentSectionPrefs[section] && currentSectionPrefs[section].borderColor) {
          styling.strokeColor = currentSectionPrefs[section].borderColor;
        }
        
        // Apply style overrides from cell style
        if (style.fillColor) styling.fillColor = style.fillColor;
        if (style.strokeColor) styling.strokeColor = style.strokeColor;
        if (style.strokeWidth) styling.strokeWidth = parseInt(style.strokeWidth);
        if (style.fontSize) styling.fontSize = parseInt(style.fontSize);
        if (style.fontFamily) styling.fontFamily = style.fontFamily;
        if (style.arcSize) styling.rounded = parseInt(style.arcSize);
        if (style.dashed === '1') styling.dashed = true;
        if (style.strokeDasharray) styling.strokeDasharray = style.strokeDasharray;
        
        return styling;
      }
      
      // Helper function to get exact edge styling
      function getEdgeStyling(cell) {
        const style = parseStyle(cell.style);
        const styling = {
          strokeColor: '#424242',
          strokeWidth: 2,
          edgeStyle: 'orthogonalEdgeStyle',
          rounded: 1,
          orthogonalLoop: 1
        };
        
        // Apply style overrides from cell style
        if (style.strokeColor) styling.strokeColor = style.strokeColor;
        if (style.strokeWidth) styling.strokeWidth = parseInt(style.strokeWidth);
        if (style.edgeStyle) styling.edgeStyle = style.edgeStyle;
        if (style.rounded !== undefined) styling.rounded = parseInt(style.rounded);
        if (style.orthogonalLoop !== undefined) styling.orthogonalLoop = parseInt(style.orthogonalLoop);
        
        return styling;
      }
      
      // Helper function to create edge path based on style
      function createEdgePath(source, target, edgeStyle, edgeGeometry) {
        const x1 = source.geometry.x - minX + padding + source.geometry.width / 2;
        const y1 = source.geometry.y - minY + padding + source.geometry.height / 2;
        const x2 = target.geometry.x - minX + padding + target.geometry.width / 2;
        const y2 = target.geometry.y - minY + padding + target.geometry.height / 2;
        
        // If edge has custom geometry points, use them
        if (edgeGeometry && edgeGeometry.points && edgeGeometry.points.length > 0) {
          let path = `M ${x1} ${y1}`;
          edgeGeometry.points.forEach(point => {
            const px = point.x - minX + padding;
            const py = point.y - minY + padding;
            path += ` L ${px} ${py}`;
          });
          path += ` L ${x2} ${y2}`;
          return path;
        }
        
        // Otherwise create path based on edge style
        if (edgeStyle === 'orthogonalEdgeStyle') {
          if (edgeStyle.rounded === 1) {
            // Curved orthogonal
            const dx = x2 - x1;
            const dy = y2 - y1;
            const midX = x1 + dx / 2;
            const midY = y1 + dy / 2;
            const controlOffset = Math.min(Math.abs(dx), Math.abs(dy)) * 0.3;
            return `M ${x1} ${y1} Q ${midX} ${midY - controlOffset} ${x2} ${y2}`;
          } else {
            // Straight orthogonal
            const dx = x2 - x1;
            const dy = y2 - y1;
            const midX = x1 + dx / 2;
            const midY = y1 + dy / 2;
            return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
          }
        } else if (edgeStyle === 'none') {
          // Direct line
          return `M ${x1} ${y1} L ${x2} ${y2}`;
        }
        
        // Default to orthogonal
        const dx = x2 - x1;
        const dy = y2 - y1;
        const midX = x1 + dx / 2;
        const midY = y1 + dy / 2;
        return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
      }
      
      // Add edges first (so they appear behind nodes)
      cells.forEach(cell => {
        if (cell.edge && cell.source && cell.target) {
          const source = cell.source;
          const target = cell.target;
          
          if (source.geometry && target.geometry) {
            const edgeStyling = getEdgeStyling(cell);
            const pathData = createEdgePath(source, target, edgeStyling.edgeStyle, cell.geometry);
            
            // Create arrow marker
            const markerId = `arrow-${cell.id}`;
            svgContent += `<defs>
              <marker id="${markerId}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" 
markerUnits="strokeWidth">
                <polygon points="0,0 0,6 9,3" fill="${edgeStyling.strokeColor}"/>
              </marker>
            </defs>`;
            
            // Create edge path
            const strokeDasharray = edgeStyling.strokeDasharray || 'none';
            svgContent += `<path d="${pathData}" stroke="${edgeStyling.strokeColor}" stroke-width="${edgeStyling.strokeWidth}" 
fill="none" marker-end="url(#${markerId})" stroke-dasharray="${strokeDasharray}"/>`;
      }
    }
  });
  
      // Add nodes (so they appear on top of edges)
      cells.forEach(cell => {
        if (cell.vertex) {
          const x = cell.geometry.x - minX + padding;
          const y = cell.geometry.y - minY + padding;
          const w = cell.geometry.width;
          const h = cell.geometry.height;
          
          const styling = getNodeStyling(cell);
          
          // Create rectangle for the node
          const strokeDasharray = styling.dashed ? '5,5' : 'none';
          svgContent += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${styling.rounded}" ry="${styling.rounded}" 
fill="${styling.fillColor}" stroke="${styling.strokeColor}" stroke-width="${styling.strokeWidth}" 
stroke-dasharray="${strokeDasharray}"/>`;
          
          // Add text
          let text = "";
          if (cell.value) {
            // Extract text from HTML if present
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cell.value;
            text = tempDiv.textContent || tempDiv.innerText || "";
          }
          
          if (text) {
            const textX = x + w / 2;
            const textY = y + h / 2;
            const textAlign = styling.textAlign === 'center' ? 'middle' : styling.textAlign;
            const dominantBaseline = styling.verticalAlign === 'middle' ? 'middle' : styling.verticalAlign;
            
            svgContent += `<text x="${textX}" y="${textY}" font-family="${styling.fontFamily}" font-size="${styling.fontSize}" 
text-anchor="${textAlign}" dominant-baseline="${dominantBaseline}" fill="black">${text.replace(/</g, '&lt;').replace(/>/g, 
'&gt;')}</text>`;
          }
        }
      });
      
      svgContent += '</svg>';
      
      // Download the SVG
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'flowchart.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Show success notification
    const notification = document.createElement('div');
      notification.textContent = 'SVG downloaded successfully!';
    notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
    document.body.appendChild(notification);
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
    
  } catch (error) {
    console.error('Error downloading SVG:', error);
    alert('Error downloading SVG: ' + error.message);
  }
};

// Helper function to find PDF name for a question node
  function findPdfNameForQuestion(cell) {
    if (!cell) return null;
    
    const graph = getGraph();
  if (!graph) return null;
  
    // Use the same logic as getPdfName function in nodes.js for consistency
    const findPdfProperties = (startCell) => {
      // Check if this node has direct PDF properties
      if (startCell._pdfName || startCell._pdfFilename || startCell._pdfUrl) {
        return {
          nodeId: startCell.id,
          filename: startCell._pdfUrl || startCell._pdfFilename || startCell._pdfName || "",
          pdfUrl: startCell._pdfUrl || "",
          priceId: startCell._priceId || ""
        };
      }
      
      // Check if this is a PDF node
      if (typeof window.isPdfNode === 'function' && window.isPdfNode(startCell)) {
        return {
          nodeId: startCell.id,
          filename: startCell._pdfUrl || "",
          pdfUrl: startCell._pdfUrl || "",
          priceId: startCell._priceId || ""
        };
      }
      
      // Check direct outgoing connections to PDF nodes
      const outgoingEdges = graph.getOutgoingEdges(startCell) || [];
      const pdfNode = outgoingEdges.find(edge => {
        const target = edge.target;
        return typeof window.isPdfNode === 'function' && window.isPdfNode(target);
      });

      if (pdfNode) {
        return {
          nodeId: startCell.id,
          filename: pdfNode.target._pdfUrl || "",
          pdfUrl: pdfNode.target._pdfUrl || "",
          priceId: pdfNode.target._priceId || ""
        };
      }
      
    return null;
  }
  
    // Get all cells in the graph
    const cells = graph.getChildCells(graph.getDefaultParent(), true, true);
    
    // Filter to only include vertex cells (nodes)
    const vertexCells = cells.filter(cell => cell.vertex && !cell.edge);
    
      // Create SVG content
      let svgContent = createSvgContent(vertexCells);
      
      // Create and download the file
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'flowchart.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Show success notification
      const notification = document.createElement('div');
      notification.textContent = 'SVG downloaded successfully!';
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
      document.body.appendChild(notification);
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
};
