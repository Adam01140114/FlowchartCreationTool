/**************************************************
 ************ Form Properties Module **************
 **************************************************/

/**
 * Form Properties Module
 * Handles PDF form name, output file name, and Stripe price ID
 * Integrates with both GUI and flowchart systems
 */

// Form properties data structure
let formProperties = {
  pdfFormName: '',
  outputFileName: '',
  stripePriceId: ''
};

// DOM elements
let formPropertiesContainer;
let pdfFormNameInput;
let outputFileNameInput;
let stripePriceIdInput;

/**
 * Initialize the Form Properties module
 */
function initializeFormProperties() {
  console.log('🔧 FORM PROPERTIES: Initializing module');
  
  // Load saved properties from localStorage
  loadFormPropertiesFromStorage();
  
  // Wait a bit for the DOM to be ready, then create the UI
  setTimeout(() => {
    createFormPropertiesUI();
    
    // Set up event listeners
    setupFormPropertiesEventListeners();
    
    console.log('🔧 FORM PROPERTIES: Module initialized successfully');
  }, 100);
}

/**
 * Create the Form Properties UI section
 */
function createFormPropertiesUI() {
  // Check if container already exists
  if (document.getElementById('formPropertiesContainer')) {
    return;
  }
  
  // Find the groups section to add after it
  const groupsSection = document.getElementById('groupsContainer');
  console.log('🔧 FORM PROPERTIES: Looking for groupsContainer:', groupsSection);
  if (!groupsSection) {
    console.error('🔧 FORM PROPERTIES: Groups section not found');
    // Try to find any section to add after
    const anySection = document.querySelector('.section');
    if (anySection) {
      console.log('🔧 FORM PROPERTIES: Found alternative section:', anySection);
      // Add after the last section
      const lastSection = document.querySelectorAll('.section');
      if (lastSection.length > 0) {
        const lastSectionElement = lastSection[lastSection.length - 1];
        console.log('🔧 FORM PROPERTIES: Adding after last section:', lastSectionElement);
        lastSectionElement.parentNode.insertBefore(formPropertiesContainer, lastSectionElement.nextSibling);
        return;
      }
    }
    return;
  }
  
  // Create the form properties container
  formPropertiesContainer = document.createElement('div');
  formPropertiesContainer.id = 'formPropertiesContainer';
  formPropertiesContainer.className = 'section';
  formPropertiesContainer.innerHTML = `
    <div class="section-header">
      <h3>Form Properties</h3>
      <button onclick="toggleFormPropertiesSection()" class="toggle-btn">−</button>
    </div>
    <div id="formPropertiesContent" class="section-content">
      <div class="form-group">
        <label for="pdfFormNameInput">PDF Form Name:</label>
        <input type="text" id="pdfFormNameInput" placeholder="Enter PDF form name (e.g., Additional Form)" 
               value="${formProperties.pdfFormName}">
      </div>
      <div class="form-group">
        <label for="outputFileNameInput">Output File Name:</label>
        <input type="text" id="outputFileNameInput" placeholder="Enter output file name (e.g., additional_form.pdf)" 
               value="${formProperties.outputFileName}">
      </div>
      <div class="form-group">
        <label for="stripePriceIdInput">Stripe Price ID:</label>
        <input type="text" id="stripePriceIdInput" placeholder="Enter Stripe Price ID (e.g., price_12345)" 
               value="${formProperties.stripePriceId}">
      </div>
      <div class="form-actions">
        <button onclick="saveFormProperties()" class="save-btn">Save Properties</button>
        <button onclick="resetFormProperties()" class="reset-btn">Reset</button>
      </div>
    </div>
  `;
  
  // Insert after groups section
  groupsSection.parentNode.insertBefore(formPropertiesContainer, groupsSection.nextSibling);
  
  // Get references to input elements
  pdfFormNameInput = document.getElementById('pdfFormNameInput');
  outputFileNameInput = document.getElementById('outputFileNameInput');
  stripePriceIdInput = document.getElementById('stripePriceIdInput');
  
  console.log('🔧 FORM PROPERTIES: UI created successfully');
}

/**
 * Set up event listeners for form properties
 */
function setupFormPropertiesEventListeners() {
  if (!pdfFormNameInput || !outputFileNameInput || !stripePriceIdInput) {
    console.error('🔧 FORM PROPERTIES: Input elements not found');
    return;
  }
  
  // Auto-save on input change
  [pdfFormNameInput, outputFileNameInput, stripePriceIdInput].forEach(input => {
    input.addEventListener('input', function() {
      updateFormProperties();
      saveFormPropertiesToStorage();
    });
  });
  
  // Auto-sync between PDF form name and output file name
  pdfFormNameInput.addEventListener('input', function() {
    if (pdfFormNameInput.value && !outputFileNameInput.value) {
      outputFileNameInput.value = pdfFormNameInput.value.toLowerCase().replace(/\s+/g, '_') + '.pdf';
    }
  });
  
  outputFileNameInput.addEventListener('input', function() {
    if (outputFileNameInput.value && !pdfFormNameInput.value) {
      const displayName = outputFileNameInput.value.replace(/\.pdf$/i, '').replace(/_/g, ' ');
      pdfFormNameInput.value = displayName.replace(/\b\w/g, l => l.toUpperCase());
    }
  });
  
  console.log('🔧 FORM PROPERTIES: Event listeners set up');
}

/**
 * Update form properties from input values
 */
function updateFormProperties() {
  formProperties.pdfFormName = pdfFormNameInput ? pdfFormNameInput.value.trim() : '';
  formProperties.outputFileName = outputFileNameInput ? outputFileNameInput.value.trim() : '';
  formProperties.stripePriceId = stripePriceIdInput ? stripePriceIdInput.value.trim() : '';
  
  console.log('🔧 FORM PROPERTIES: Updated properties:', formProperties);
  
  // Sync with PDF nodes if graph is available
  if (typeof graph !== 'undefined' && graph) {
    syncFormPropertiesToPdfNodes();
  }
}

/**
 * Sync form properties to all PDF nodes in the flowchart
 */
function syncFormPropertiesToPdfNodes() {
  if (!graph) return;
  
  const parent = graph.getDefaultParent();
  const cells = graph.getChildCells(parent, true, true);
  
  cells.forEach(cell => {
    if (cell.style && cell.style.includes("nodeType=pdfNode")) {
      // Update PDF node properties with form properties
      if (formProperties.pdfFormName && !cell._pdfDisplayName) {
        cell._pdfDisplayName = formProperties.pdfFormName;
      }
      if (formProperties.outputFileName && !cell._pdfFilename) {
        cell._pdfFilename = formProperties.outputFileName;
      }
      if (formProperties.stripePriceId && !cell._priceId) {
        cell._priceId = formProperties.stripePriceId;
      }
      
      // Update the cell display
      if (typeof updatePdfNodeCell === 'function') {
        updatePdfNodeCell(cell);
      }
    }
  });
  
  // Trigger autosave
  if (typeof requestAutosave === 'function') {
    requestAutosave();
  }
}

/**
 * Save form properties to localStorage
 */
function saveFormPropertiesToStorage() {
  try {
    localStorage.setItem('formProperties', JSON.stringify(formProperties));
    console.log('🔧 FORM PROPERTIES: Saved to localStorage');
  } catch (error) {
    console.error('🔧 FORM PROPERTIES: Error saving to localStorage:', error);
  }
}

/**
 * Load form properties from localStorage
 */
function loadFormPropertiesFromStorage() {
  try {
    const saved = localStorage.getItem('formProperties');
    if (saved) {
      formProperties = { ...formProperties, ...JSON.parse(saved) };
      console.log('🔧 FORM PROPERTIES: Loaded from localStorage:', formProperties);
    }
  } catch (error) {
    console.error('🔧 FORM PROPERTIES: Error loading from localStorage:', error);
  }
}

/**
 * Save form properties (manual save button)
 */
window.saveFormProperties = function() {
  updateFormProperties();
  saveFormPropertiesToStorage();
  
  // Show success message
  const saveBtn = document.querySelector('#formPropertiesContainer .save-btn');
  if (saveBtn) {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    saveBtn.style.backgroundColor = '#28a745';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.backgroundColor = '';
    }, 2000);
  }
  
  console.log('🔧 FORM PROPERTIES: Properties saved manually');
};

/**
 * Reset form properties to defaults
 */
window.resetFormProperties = function() {
  if (confirm('Are you sure you want to reset all form properties?')) {
    formProperties = {
      pdfFormName: '',
      outputFileName: '',
      stripePriceId: ''
    };
    
    if (pdfFormNameInput) pdfFormNameInput.value = '';
    if (outputFileNameInput) outputFileNameInput.value = '';
    if (stripePriceIdInput) stripePriceIdInput.value = '';
    
    saveFormPropertiesToStorage();
    console.log('🔧 FORM PROPERTIES: Properties reset');
  }
};

/**
 * Toggle form properties section visibility
 */
window.toggleFormPropertiesSection = function() {
  const content = document.getElementById('formPropertiesContent');
  const toggleBtn = document.querySelector('#formPropertiesContainer .toggle-btn');
  
  if (content && toggleBtn) {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggleBtn.textContent = '−';
    } else {
      content.style.display = 'none';
      toggleBtn.textContent = '+';
    }
  }
};

/**
 * Get current form properties
 */
window.getFormProperties = function() {
  updateFormProperties();
  return { ...formProperties };
};

/**
 * Set form properties (for import/load operations)
 */
window.setFormProperties = function(properties) {
  if (properties) {
    formProperties = { ...formProperties, ...properties };
    
    if (pdfFormNameInput) pdfFormNameInput.value = formProperties.pdfFormName || '';
    if (outputFileNameInput) outputFileNameInput.value = formProperties.outputFileName || '';
    if (stripePriceIdInput) stripePriceIdInput.value = formProperties.stripePriceId || '';
    
    saveFormPropertiesToStorage();
    console.log('🔧 FORM PROPERTIES: Properties set from external source:', formProperties);
  }
};

/**
 * Export form properties for flowchart JSON
 */
window.exportFormProperties = function() {
  updateFormProperties();
  return {
    formProperties: { ...formProperties }
  };
};

/**
 * Import form properties from flowchart JSON
 */
window.importFormProperties = function(data) {
  if (data && data.formProperties) {
    setFormProperties(data.formProperties);
    console.log('🔧 FORM PROPERTIES: Imported from flowchart JSON');
  }
};

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFormProperties);
} else {
  initializeFormProperties();
}

console.log('🔧 FORM PROPERTIES: Module loaded');
