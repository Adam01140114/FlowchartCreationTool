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
  console.log('[EXPORT] ========== EXPORT FLOWCHART JSON STARTED ==========');
  if (!graph) {
    console.error('[EXPORT] Graph is null!');
    return null;
  }
  // Respect "Add PDF name to node ID" setting (default OFF unless explicitly enabled)
  const shouldAddPdfName = !!(window.userSettings && window.userSettings.addPdfNameToNodeId);
  const stripPdfPrefix = (val, pdfName) => {
    if (shouldAddPdfName) return val;
    if (!val) return val;
    const sanitized = (pdfName && typeof window.sanitizePdfName === 'function')
      ? window.sanitizePdfName(pdfName)
      : '';
    if (sanitized && val.startsWith(sanitized + '_')) {
      return val.substring(sanitized.length + 1);
    }
    const firstSeg = val.split('_')[0] || '';
    if (/^sc[a-z0-9]+$/i.test(firstSeg)) {
      return val.substring(firstSeg.length + 1);
    }
    return val;
  };
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
  console.log('[EXPORT] Total cells to export:', cells.length);
  
  // Log all inverse checkbox nodes before export
  const inverseCheckboxNodes = cells.filter(cell => 
    typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)
  );
  console.log('[EXPORT] Found', inverseCheckboxNodes.length, 'inverse checkbox nodes');
  inverseCheckboxNodes.forEach((cell, index) => {
    console.log(`[EXPORT] Inverse Checkbox Node ${index + 1}:`, {
      id: cell.id,
      _inverseCheckboxNodeId: cell._inverseCheckboxNodeId,
      _inverseCheckboxOption: cell._inverseCheckboxOption,
      hasInverseCheckboxNodeId: cell._inverseCheckboxNodeId !== undefined,
      hasInverseCheckboxOption: cell._inverseCheckboxOption !== undefined,
      isInverseCheckboxNode: typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell)
    });
  });
  // Use the same serialization logic as the existing export function
  const simplifiedCells = cells.map(cell => {
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
      cellData._textboxes = JSON.parse(JSON.stringify(cell._textboxes));
    }
    if (cell._questionText) cellData._questionText = cell._questionText;
    if (cell._twoNumbers) cellData._twoNumbers = cell._twoNumbers;
    if (cell._dropdownTitle) cellData._dropdownTitle = cell._dropdownTitle;
    if (cell._fileName) cellData._fileName = cell._fileName;
    if (cell._nameId) cellData._nameId = cell._nameId;
    if (cell._placeholder) cellData._placeholder = cell._placeholder;
    if (cell._questionId) cellData._questionId = cell._questionId;
    if (cell._locationIndex !== undefined) cellData._locationIndex = cell._locationIndex;
    // checkbox properties
    if (cell._checkboxes) {
      cellData._checkboxes = JSON.parse(JSON.stringify(cell._checkboxes));
    }
        if (cell._itemOrder) {
          cellData._itemOrder = JSON.parse(JSON.stringify(cell._itemOrder));
        }
        if (cell._times) {
          cellData._times = JSON.parse(JSON.stringify(cell._times));
        }
        if (cell._dropdowns) {
          cellData._dropdowns = JSON.parse(JSON.stringify(cell._dropdowns));
          if (!shouldAddPdfName) {
            const pdfHint = cell._pdfFile || cell._pdfName || '';
            cellData._dropdowns.forEach(dd => {
              if (dd.triggerSequences && Array.isArray(dd.triggerSequences)) {
                dd.triggerSequences.forEach(seq => {
                  if (seq.labels && Array.isArray(seq.labels)) {
                    seq.labels.forEach(lbl => {
                      if (lbl.nodeId) lbl.nodeId = stripPdfPrefix(lbl.nodeId, pdfHint);
                    });
                  }
                  if (seq.times && Array.isArray(seq.times)) {
                    seq.times.forEach(t => {
                      if (t.nodeId) t.nodeId = stripPdfPrefix(t.nodeId, pdfHint);
                    });
                  }
                  if (seq.checkboxes && Array.isArray(seq.checkboxes)) {
                    seq.checkboxes.forEach(cb => {
                      if (cb.options && Array.isArray(cb.options)) {
                        cb.options.forEach(opt => {
                          if (opt.nodeId) opt.nodeId = stripPdfPrefix(opt.nodeId, pdfHint);
                          if (opt.linkedFields && Array.isArray(opt.linkedFields)) {
                            opt.linkedFields.forEach(lf => {
                              if (lf.nodeId) lf.nodeId = stripPdfPrefix(lf.nodeId, pdfHint);
                              if (lf.selectedNodeId) lf.selectedNodeId = stripPdfPrefix(lf.selectedNodeId, pdfHint);
                            });
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        }
    if (cell._amountName) cellData._amountName = cell._amountName;
    if (cell._amountPlaceholder) cellData._amountPlaceholder = cell._amountPlaceholder;
    if (cell._image) cellData._image = cell._image;
    // PDF node properties
    if (cell._pdfName !== undefined) cellData._pdfName = cell._pdfName;
    if (cell._pdfFile !== undefined) cellData._pdfFile = cell._pdfFile;
    if (cell._pdfPrice !== undefined) cellData._pdfPrice = cell._pdfPrice;
    // PDF preview node properties - always include if the node is a PDF preview node or Latex PDF preview node
    if ((typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) ||
        (typeof window.isLatexPdfPreviewNode === 'function' && window.isLatexPdfPreviewNode(cell))) {
      cellData._pdfPreviewTitle = cell._pdfPreviewTitle !== undefined ? cell._pdfPreviewTitle : "";
      cellData._pdfPreviewFile = cell._pdfPreviewFile !== undefined ? cell._pdfPreviewFile : "";
    } else if (cell._pdfPreviewTitle !== undefined) {
      // Include even if not a PDF preview node (for backward compatibility)
      cellData._pdfPreviewTitle = cell._pdfPreviewTitle;
    }
    if (cell._pdfPreviewFile !== undefined) {
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
    // Currency node alert properties
    if (cell._currencyAlerts) {
      cellData._currencyAlerts = JSON.parse(JSON.stringify(cell._currencyAlerts));
    }
    // Final verification for PDF preview nodes
    if (typeof window.isPdfPreviewNode === 'function' && window.isPdfPreviewNode(cell)) {
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
    // Inverse checkbox node properties - always include for inverse checkbox nodes
    const isInverseCheckbox = typeof window.isInverseCheckboxNode === 'function' && window.isInverseCheckboxNode(cell);
    if (isInverseCheckbox) {
      console.log(`[EXPORT] Processing inverse checkbox node ${cell.id}:`, {
        _inverseCheckboxNodeId: cell._inverseCheckboxNodeId,
        _inverseCheckboxOption: cell._inverseCheckboxOption,
        nodeIdUndefined: cell._inverseCheckboxNodeId === undefined,
        optionUndefined: cell._inverseCheckboxOption === undefined
      });
      cellData._inverseCheckboxNodeId = cell._inverseCheckboxNodeId !== undefined ? cell._inverseCheckboxNodeId : null;
      cellData._inverseCheckboxOption = cell._inverseCheckboxOption !== undefined ? cell._inverseCheckboxOption : null;
      console.log(`[EXPORT] Added to cellData for ${cell.id}:`, {
        _inverseCheckboxNodeId: cellData._inverseCheckboxNodeId,
        _inverseCheckboxOption: cellData._inverseCheckboxOption
      });
    } else if (cell._inverseCheckboxNodeId !== undefined) {
      cellData._inverseCheckboxNodeId = cell._inverseCheckboxNodeId;
    } else if (cell._inverseCheckboxOption !== undefined) {
      cellData._inverseCheckboxOption = cell._inverseCheckboxOption;
    }
    // mult dropdown location indicator
    if (cell._locationIndex !== undefined) cellData._locationIndex = cell._locationIndex;
    if (cell._locationTitle !== undefined) cellData._locationTitle = cell._locationTitle;
    return cellData;
  });
  // Get current section preferences using the proper function
  const currentSectionPrefs = window.getSectionPrefs ? window.getSectionPrefs() : (window.sectionPrefs || {});
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
  output.cells.forEach((cell, index) => {
    if (cell.style && cell.style.includes('nodeType=pdfPreview')) {
    }
  });
  const jsonStr = JSON.stringify(output, null, 2);
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
      // Show user feedback
      const notification = document.createElement('div');
      notification.textContent = 'Flowchart JSON copied to clipboard!';
      notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
      document.body.appendChild(notification);
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    }).catch(err => {
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

/**
 * Wrapper to sanitize GUI JSON after export (remove PDF prefixes when setting is off)
 * This avoids touching library.js; we post-process the JSON string here.
 */
(function(){
  const originalExportGuiJson = window.exportGuiJson;
  if (!originalExportGuiJson) return;

  function shouldKeepPdfPrefix() {
    return (typeof window.userSettings !== 'undefined' && window.userSettings.addPdfNameToNodeId === true);
  }

  function stripPdfPrefix(str) {
    if (shouldKeepPdfPrefix()) return str;
    if (typeof str !== 'string') return str;
    // remove leading sc..._ prefix if present
    return str.replace(/^sc[a-z0-9]+_/i, '');
  }

  // Normalize condition/node ids by stripping PDF prefix and redundant leading question slugs
  function normalizeId(str) {
    if (typeof str !== 'string') return str;
    let s = stripPdfPrefix(str);
    // Special case: move instance number before the answer for business checkbox links
    // "is_this_plaintiff_a_business_yes_2" -> "is_this_plaintiff_a_business_2_yes"
    const bizMatch = s.match(/^is_this_plaintiff_a_business_yes_(\d+)$/);
    if (bizMatch) {
      s = `is_this_plaintiff_a_business_${bizMatch[1]}_yes`;
    }
    // If the ID contains a more specific anchor, trim everything before it
    const anchors = [
      'are_they_a_business_or_public_entity_',
      'are_they_a_public_entity_',
      'have_you_filed_a_written_claim_against_them_',
      'when_did_you_file_the_written_claim'
    ];
    for (const anchor of anchors) {
      const idx = s.lastIndexOf(anchor);
      if (idx >= 0) {
        s = s.substring(idx);
        break;
      }
    }
    return s;
  }

  function sanitizeValue(val) {
    if (Array.isArray(val)) {
      return val.map(sanitizeValue);
    }
    if (val && typeof val === 'object') {
      Object.keys(val).forEach(k => {
        val[k] = sanitizeValue(val[k]);
      });
      return val;
    }
    if (typeof val === 'string') {
      return normalizeId(val);
    }
    return val;
  }

  window.exportGuiJson = function(download = true) {
    // call original without download to avoid double downloads
    const raw = originalExportGuiJson(false);
    try {
      const parsed = JSON.parse(raw);
      const sanitized = sanitizeValue(parsed);
      const outStr = JSON.stringify(sanitized, null, 2);
      if (download) {
        // download gui.json and copy to clipboard
        const blob = new Blob([outStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gui.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        navigator.clipboard.writeText(outStr).catch(() => {});
      }
      return outStr;
    } catch (e) {
      console.error('[EXPORT GUI] Sanitize failed, returning original', e);
      return raw;
    }
  };
})();