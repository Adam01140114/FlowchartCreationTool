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
// Main SVG download function
window.downloadFlowchartSvg = function() {
  try {
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
  } catch (error) {
    alert('Error downloading SVG: ' + error.message);
  }
};