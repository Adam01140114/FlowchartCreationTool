/**************************************************
 ************ URL Sharing Functionality ***********
 **************************************************/

/**
 * Generates a shareable URL with the current flowchart JSON embedded
 */
function generateShareableUrl() {
  try {
    // Export the flowchart JSON
    const flowchartJson = exportFlowchartJson(false); // false = don't download, just return the string
    
    if (!flowchartJson) {
      alert('Error: Could not generate flowchart data');
      return;
    }
    
    // Encode the JSON for URL transmission
    const encodedJson = encodeURIComponent(flowchartJson);
    
    // Create the shareable URL
    const currentUrl = window.location.origin + window.location.pathname;
    const shareableUrl = `${currentUrl}?flowchart=${encodedJson}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareableUrl).then(() => {
      // Show success message
      showShareUrlModal(shareableUrl);
    }).catch(() => {
      // Fallback if clipboard API fails
      showShareUrlModal(shareableUrl);
    });
    
  } catch (error) {
    console.error('Error generating shareable URL:', error);
    alert('Error generating shareable URL: ' + error.message);
  }
}

/**
 * Shows a modal with the shareable URL
 */
function showShareUrlModal(url) {
  // Create modal if it doesn't exist
  let modal = document.getElementById('shareUrlModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'shareUrlModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <span class="close" onclick="closeShareUrlModal()">&times;</span>
        <h3>Share Flowchart URL</h3>
        <p>Your flowchart has been copied to the clipboard! You can also copy the URL below:</p>
        <textarea id="shareUrlTextarea" readonly style="width: 100%; height: 100px; margin: 10px 0; padding: 8px; font-family: monospace; font-size: 12px; resize: vertical;"></textarea>
        <div style="text-align: center; margin-top: 15px;">
          <button onclick="copyShareUrl()" style="margin-right: 10px;">Copy URL</button>
          <button onclick="closeShareUrlModal()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  // Set the URL in the textarea
  const textarea = document.getElementById('shareUrlTextarea');
  if (textarea) {
    textarea.value = url;
  }
  
  // Show the modal
  modal.style.display = 'flex';
}

/**
 * Closes the share URL modal
 */
function closeShareUrlModal() {
  const modal = document.getElementById('shareUrlModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Copies the share URL to clipboard
 */
function copyShareUrl() {
  const textarea = document.getElementById('shareUrlTextarea');
  if (textarea) {
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices
    
    try {
      document.execCommand('copy');
      // Show brief success message
      const copyBtn = document.querySelector('#shareUrlModal button');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      // Fallback: select and show selection
      textarea.focus();
      textarea.select();
    }
  }
}

/**
 * Checks for flowchart parameter in URL and loads it if present
 */
function checkForSharedFlowchart() {
  const urlParams = new URLSearchParams(window.location.search);
  const flowchartParam = urlParams.get('flowchart');
  
  if (flowchartParam) {
    try {
      // Decode the flowchart JSON
      const decodedJson = decodeURIComponent(flowchartParam);
      
      // Parse the JSON
      const flowchartData = JSON.parse(decodedJson);
      
      // Load the flowchart
      loadFlowchartData(flowchartData);
      
      // Clear the URL parameter to prevent reloading on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Show a notification that the flowchart was loaded
      showFlowchartLoadedNotification();
      
      return true; // Successfully loaded from URL
    } catch (error) {
      console.error('Error loading shared flowchart:', error);
      alert('Error loading shared flowchart: ' + error.message);
      return false;
    }
  }
  return false; // No flowchart parameter found
}

/**
 * Shows a notification that the flowchart was loaded from URL
 */
function showFlowchartLoadedNotification() {
  // Create notification if it doesn't exist
  let notification = document.getElementById('flowchartLoadedNotification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'flowchartLoadedNotification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: 'Montserrat', sans-serif;
      font-size: 14px;
      max-width: 300px;
      word-wrap: break-word;
    `;
    document.body.appendChild(notification);
  }
  
  notification.textContent = '✅ Shared flowchart loaded successfully!';
  notification.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 5000);
}

/**
 * Exports flowchart JSON without downloading (returns the string)
 */
window.exportFlowchartJson = function(download = true) {
  if (!graph) return null;
  
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
  
  const parent = graph.getDefaultParent();
  const cells = graph.getChildCells(parent, true, true);
  
  // Use the same serialization logic as the existing export function
  console.log('🔍 [URL.JS EXPORT DEBUG] Starting export, total cells:', cells.length);
  const simplifiedCells = cells.map(cell => {
    console.log('🔍 [URL.JS EXPORT DEBUG] Processing cell:', cell.id, 'vertex:', cell.vertex, 'edge:', cell.edge);
    
    const cellData = {
      id: cell.id,
      vertex: cell.vertex,
      edge: cell.edge,
      value: cell.value,
      style: cell.style,
    };

    if (cell.geometry) {
      cellData.geometry = {
        x: cell.geometry.x,
        y: cell.geometry.y,
        width: cell.geometry.width,
        height: cell.geometry.height,
      };
    }

    if (cell.edge && cell.source && cell.target) {
      cellData.source = cell.source.id;
      cellData.target = cell.target.id;
      
      if (cell.geometry && cell.geometry.points && cell.geometry.points.length > 0) {
        cellData.edgeGeometry = {
          points: cell.geometry.points.map(point => ({
            x: point.x,
            y: point.y
          }))
        };
      }
    }

    // Custom fields
    if (cell._textboxes) {
      console.log('🔧 [EXPORT DEBUG] Exporting _textboxes for cell', cell.id, ':', cell._textboxes);
      cellData._textboxes = JSON.parse(JSON.stringify(cell._textboxes));
      console.log('🔧 [EXPORT DEBUG] Exported _textboxes data:', cellData._textboxes);
    }
    if (cell._questionText) cellData._questionText = cell._questionText;
    if (cell._twoNumbers) cellData._twoNumbers = cell._twoNumbers;
    if (cell._nameId) cellData._nameId = cell._nameId;
    if (cell._placeholder) cellData._placeholder = cell._placeholder;
    if (cell._questionId) cellData._questionId = cell._questionId;
    if (cell._locationIndex !== undefined) cellData._locationIndex = cell._locationIndex;
    
    // checkbox properties
    if (cell._checkboxes) {
      console.log('🔧 [EXPORT DEBUG] Exporting _checkboxes for cell', cell.id, ':', cell._checkboxes);
      cellData._checkboxes = JSON.parse(JSON.stringify(cell._checkboxes));
      console.log('🔧 [EXPORT DEBUG] Exported _checkboxes data:', cellData._checkboxes);
    }
        if (cell._itemOrder) {
          console.log('🔧 [EXPORT DEBUG] Exporting _itemOrder for cell', cell.id, ':', cell._itemOrder);
          cellData._itemOrder = JSON.parse(JSON.stringify(cell._itemOrder));
          console.log('🔧 [EXPORT DEBUG] Exported _itemOrder data:', cellData._itemOrder);
        }
        if (cell._times) {
          console.log('🔧 [EXPORT DEBUG] Exporting _times for cell', cell.id, ':', cell._times);
          cellData._times = JSON.parse(JSON.stringify(cell._times));
          console.log('🔧 [EXPORT DEBUG] Exported _times data:', cellData._times);
        }
        if (cell._dropdowns) {
          console.log('🔧 [EXPORT DEBUG] Exporting _dropdowns for cell', cell.id, ':', cell._dropdowns);
          cellData._dropdowns = JSON.parse(JSON.stringify(cell._dropdowns));
          console.log('🔧 [EXPORT DEBUG] Exported _dropdowns data:', cellData._dropdowns);
        }
    
    if (cell._amountName) cellData._amountName = cell._amountName;
    if (cell._amountPlaceholder) cellData._amountPlaceholder = cell._amountPlaceholder;
    if (cell._image) cellData._image = cell._image;
    
    // PDF node properties
    if (cell._pdfName !== undefined) cellData._pdfName = cell._pdfName;
    if (cell._pdfFile !== undefined) cellData._pdfFile = cell._pdfFile;
    if (cell._pdfPrice !== undefined) cellData._pdfPrice = cell._pdfPrice;
    // PDF preview node properties - always include if the node is a PDF preview node
    if (typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) {
      console.log('🔍 [URL.JS EXPORT DEBUG] PDF Preview Node found:', cell.id);
      console.log('🔍 [URL.JS EXPORT DEBUG] _pdfPreviewTitle value:', cell._pdfPreviewTitle);
      console.log('🔍 [URL.JS EXPORT DEBUG] _pdfPreviewTitle type:', typeof cell._pdfPreviewTitle);
      console.log('🔍 [URL.JS EXPORT DEBUG] _pdfPreviewFile value:', cell._pdfPreviewFile);
      console.log('🔍 [URL.JS EXPORT DEBUG] _pdfPreviewFile type:', typeof cell._pdfPreviewFile);
      console.log('🔍 [URL.JS EXPORT DEBUG] All cell properties:', Object.keys(cell).filter(k => k.startsWith('_')));
      
      cellData._pdfPreviewTitle = cell._pdfPreviewTitle !== undefined ? cell._pdfPreviewTitle : "";
      cellData._pdfPreviewFile = cell._pdfPreviewFile !== undefined ? cell._pdfPreviewFile : "";
      
      console.log('🔍 [URL.JS EXPORT DEBUG] Exported _pdfPreviewTitle:', cellData._pdfPreviewTitle);
      console.log('🔍 [URL.JS EXPORT DEBUG] Exported _pdfPreviewFile:', cellData._pdfPreviewFile);
    } else if (cell._pdfPreviewTitle !== undefined) {
      // Include even if not a PDF preview node (for backward compatibility)
      console.log('🔍 [URL.JS EXPORT DEBUG] PDF Preview properties found on non-preview node:', cell.id);
      cellData._pdfPreviewTitle = cell._pdfPreviewTitle;
    }
    if (cell._pdfPreviewFile !== undefined) {
      console.log('🔍 [URL.JS EXPORT DEBUG] _pdfPreviewFile found on non-preview node:', cell.id, cell._pdfPreviewFile);
      cellData._pdfPreviewFile = cell._pdfPreviewFile;
    }
    // Legacy PDF properties for backward compatibility
    if (cell._pdfUrl) cellData._pdfUrl = cell._pdfUrl;
    if (cell._priceId) cellData._priceId = cell._priceId;
    if (cell._notesText) cellData._notesText = cell._notesText;
    if (cell._notesBold) cellData._notesBold = cell._notesBold;
    if (cell._notesFontSize) cellData._notesFontSize = cell._notesFontSize;
    
    // checkbox availability
    if (cell._checkboxAvailability !== undefined) cellData._checkboxAvailability = cell._checkboxAvailability;
    
    // big paragraph properties
    if (cell._lineLimit !== undefined) cellData._lineLimit = cell._lineLimit;
    if (cell._characterLimit !== undefined) cellData._characterLimit = cell._characterLimit;
    if (cell._paragraphLimit !== undefined) cellData._paragraphLimit = cell._paragraphLimit;
    
    // Big Paragraph PDF Logic properties
    if (cell._pdfLogicEnabled !== undefined) cellData._pdfLogicEnabled = cell._pdfLogicEnabled;
    if (cell._pdfTriggerLimit !== undefined) cellData._pdfTriggerLimit = cell._pdfTriggerLimit;
    if (cell._bigParagraphPdfName !== undefined) cellData._bigParagraphPdfName = cell._bigParagraphPdfName;
    if (cell._bigParagraphPdfFile !== undefined) cellData._bigParagraphPdfFile = cell._bigParagraphPdfFile;
    if (cell._bigParagraphPdfPrice !== undefined) cellData._bigParagraphPdfPrice = cell._bigParagraphPdfPrice;
    // Final verification for PDF preview nodes
    if (typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) {
      console.log('🔍 [URL.JS EXPORT DEBUG] Final check for PDF Preview Node:', cell.id);
      console.log('🔍 [URL.JS EXPORT DEBUG] Final cellData._pdfPreviewTitle:', cellData._pdfPreviewTitle);
      console.log('🔍 [URL.JS EXPORT DEBUG] Final cellData._pdfPreviewFile:', cellData._pdfPreviewFile);
      console.log('🔍 [URL.JS EXPORT DEBUG] Final cell._pdfPreviewTitle:', cell._pdfPreviewTitle);
      console.log('🔍 [URL.JS EXPORT DEBUG] Final cell._pdfPreviewFile:', cell._pdfPreviewFile);
    }
    
    if (cell._checklistText) cellData._checklistText = cell._checklistText;
    if (cell._alertText) cellData._alertText = cell._alertText;
    if (cell._calcTitle) cellData._calcTitle = cell._calcTitle;
    if (cell._calcTerms) cellData._calcTerms = cell._calcTerms;
    if (cell._calcOperator) cellData._calcOperator = cell._calcOperator;
    if (cell._calcThreshold) cellData._calcThreshold = cell._calcThreshold;
    if (cell._calcFinalText) cellData._calcFinalText = cell._calcFinalText;
    if (cell._characterLimit) cellData._characterLimit = cell._characterLimit;
    if (cell._paragraphLimit) cellData._paragraphLimit = cell._paragraphLimit;
    
    // Hidden node properties
    if (cell._hiddenNodeId !== undefined) cellData._hiddenNodeId = cell._hiddenNodeId;
    if (cell._defaultText !== undefined) cellData._defaultText = cell._defaultText;
    
    // Linked logic node properties
    if (cell._linkedLogicNodeId !== undefined) cellData._linkedLogicNodeId = cell._linkedLogicNodeId;
    if (cell._linkedFields !== undefined) cellData._linkedFields = cell._linkedFields;
    
    // Linked checkbox node properties
    if (cell._linkedCheckboxNodeId !== undefined) cellData._linkedCheckboxNodeId = cell._linkedCheckboxNodeId;
    if (cell._linkedCheckboxOptions !== undefined) cellData._linkedCheckboxOptions = cell._linkedCheckboxOptions;
    
    // mult dropdown location indicator
    if (cell._locationIndex !== undefined) cellData._locationIndex = cell._locationIndex;
    if (cell._locationTitle !== undefined) cellData._locationTitle = cell._locationTitle;

    return cellData;
  });

  // Get current section preferences using the proper function
  const currentSectionPrefs = window.getSectionPrefs ? window.getSectionPrefs() : (window.sectionPrefs || {});
  
  console.log('🔍 [URL.JS EXPORT DEBUG] Current section preferences:', JSON.stringify(currentSectionPrefs, null, 2));
  
  // Get default PDF properties
  const defaultPdfProps = typeof window.getDefaultPdfProperties === 'function' ? 
    window.getDefaultPdfProperties() : { pdfName: "", pdfFile: "", pdfPrice: "" };
  
  // Get form name
  const formName = document.getElementById('formNameInput')?.value || '';
  
  const output = {
    cells: simplifiedCells,
    sectionPrefs: JSON.parse(JSON.stringify(currentSectionPrefs)),
    groups: JSON.parse(JSON.stringify(groups)),
    defaultPdfProperties: defaultPdfProps,
    formName: formName,
    edgeStyle: currentEdgeStyle
  };
  
  console.log('🔍 [URL.JS EXPORT DEBUG] Final output structure:');
  console.log('🔍 [URL.JS EXPORT DEBUG] Total cells in export:', output.cells.length);
  output.cells.forEach((cell, index) => {
    if (cell.style && cell.style.includes('nodeType=pdfPreview')) {
      console.log(`🔍 [URL.JS EXPORT DEBUG] Cell ${index} (${cell.id}) is PDF Preview Node:`);
      console.log('🔍 [URL.JS EXPORT DEBUG]   _pdfPreviewTitle:', cell._pdfPreviewTitle);
      console.log('🔍 [URL.JS EXPORT DEBUG]   _pdfPreviewFile:', cell._pdfPreviewFile);
      console.log('🔍 [URL.JS EXPORT DEBUG]   Full cell data:', JSON.stringify(cell, null, 2));
    }
  });

  const jsonStr = JSON.stringify(output, null, 2);
  console.log('🔍 [URL.JS EXPORT DEBUG] Final JSON length:', jsonStr.length);
  
  if (download) {
    // Download the file
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flowchart.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Copy to clipboard
    navigator.clipboard.writeText(jsonStr).then(() => {
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
  }
  
  return jsonStr;
}

// Initialize URL sharing functionality when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Check for shared flowchart in URL
  checkForSharedFlowchart();
});

// Make functions globally available
window.generateShareableUrl = generateShareableUrl;
window.closeShareUrlModal = closeShareUrlModal;
window.copyShareUrl = copyShareUrl;
