/**************************************************
 ************ Settings & Preferences **************
 **************************************************/

// Global settings object
var userSettings = userSettings || {
  autoSave: true,
  autoSaveInterval: 30000, // 30 seconds
  defaultNodeSize: { width: 200, height: 100 },
  gridSnap: true,
  gridSize: 20,
  showGrid: true,
  theme: 'light',
  language: 'en',
  zoomSensitivity: 0.01 // Default zoom sensitivity (0.001 = very sensitive, 0.1 = less sensitive)
};

// Color preferences
var colorPreferences = colorPreferences || {
  text: '#000000',
  checkbox: '#4CAF50',
  dropdown: '#2196F3',
  money: '#FF9800',
  date: '#9C27B0',
  bigParagraph: '#607D8B',
  textColor: '#FFFFFF'
};

// Section preferences
var sectionPrefs = sectionPrefs || {};

/**
 * Load settings from localStorage
 */
window.loadSettingsFromLocalStorage = function() {
  try {
    console.log('🔧 [ZOOM SENSITIVITY] loadSettingsFromLocalStorage called');
    
    // Load user settings
    const savedSettings = localStorage.getItem('flowchart_user_settings');
    console.log('🔧 [ZOOM SENSITIVITY] Saved settings from localStorage:', savedSettings);
    
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      console.log('🔧 [ZOOM SENSITIVITY] Parsed settings:', parsedSettings);
      userSettings = { ...userSettings, ...parsedSettings };
      console.log('🔧 [ZOOM SENSITIVITY] Final userSettings after merge:', userSettings);
    } else {
      console.log('🔧 [ZOOM SENSITIVITY] No saved settings found, using defaults');
    }
    
    // Also try to load from Firebase
    loadZoomSensitivityFromFirebase();
    
    // Load color preferences
    const savedColors = localStorage.getItem('flowchart_color_preferences');
    if (savedColors) {
      colorPreferences = { ...colorPreferences, ...JSON.parse(savedColors) };
    }
    
    // Load section preferences - but don't override if they've already been set by import
    const savedSections = localStorage.getItem('flowchart_section_preferences');
    if (savedSections) {
      console.log('🔍 [SETTINGS DEBUG] Loading section preferences from localStorage:', savedSections);
      const parsedSections = JSON.parse(savedSections);
      console.log('🔍 [SETTINGS DEBUG] Parsed section preferences:', JSON.stringify(parsedSections, null, 2));
      
      // Check if section preferences have already been set by import
      const existingSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
      console.log('🔍 [SETTINGS DEBUG] Existing section preferences:', JSON.stringify(existingSectionPrefs, null, 2));
      
      // Only merge if we don't have existing section preferences or if they're just the default
      const hasOnlyDefaultSection = Object.keys(existingSectionPrefs).length === 1 && 
                                   existingSectionPrefs["1"] && 
                                   existingSectionPrefs["1"].name === "Enter Name";
      
      if (Object.keys(existingSectionPrefs).length === 0 || hasOnlyDefaultSection) {
        console.log('🔍 [SETTINGS DEBUG] No existing section preferences or only default, loading from localStorage');
        sectionPrefs = { ...sectionPrefs, ...parsedSections };
        console.log('🔍 [SETTINGS DEBUG] Final sectionPrefs after merge:', JSON.stringify(sectionPrefs, null, 2));
      } else {
        console.log('🔍 [SETTINGS DEBUG] Existing section preferences found, not overriding with localStorage data');
        sectionPrefs = existingSectionPrefs;
      }
    } else {
      console.log('🔍 [SETTINGS DEBUG] No saved section preferences found in localStorage');
    }
    
    // Apply settings
    applySettings();
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
};

/**
 * Save settings to localStorage
 */
window.saveSettings = function() {
  try {
    console.log('🔧 [ZOOM SENSITIVITY] saveSettings called, userSettings:', userSettings);
    console.log('🔧 [ZOOM SENSITIVITY] zoomSensitivity being saved:', userSettings.zoomSensitivity);
    
    // Save user settings
    localStorage.setItem('flowchart_user_settings', JSON.stringify(userSettings));
    
    // Save color preferences
    localStorage.setItem('flowchart_color_preferences', JSON.stringify(colorPreferences));
    
    // Save section preferences
    localStorage.setItem('flowchart_section_preferences', JSON.stringify(sectionPrefs));
    
    console.log('🔧 [ZOOM SENSITIVITY] Settings saved successfully to localStorage');
    
    // Hide settings menu
    if (window.hideSettingsMenu) {
      window.hideSettingsMenu();
    }
    
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Error saving settings: ' + error.message);
  }
};

/**
 * Apply current settings to the application
 */
function applySettings() {
  // Apply theme
  applyTheme(userSettings.theme);
  
  // Apply grid settings
  applyGridSettings();
  
  // Apply auto-save if enabled
  if (userSettings.autoSave) {
    setupAutoSave();
  }
  
  // Update UI elements to reflect current settings
  updateSettingsUI();
}

/**
 * Apply theme to the application
 */
function applyTheme(theme) {
  const body = document.body;
  body.className = body.className.replace(/theme-\w+/g, '');
  body.classList.add(`theme-${theme}`);
  
  // Update CSS variables if needed
  if (theme === 'dark') {
    document.documentElement.style.setProperty('--bg-color', '#1a1a1a');
    document.documentElement.style.setProperty('--text-color', '#ffffff');
  } else {
    document.documentElement.style.setProperty('--bg-color', '#ffffff');
    document.documentElement.style.setProperty('--text-color', '#000000');
  }
}

/**
 * Apply grid settings
 */
function applyGridSettings() {
  if (!graph) return;
  
  if (userSettings.showGrid) {
    graph.setGridEnabled(true);
    graph.setGridSize(userSettings.gridSize);
  } else {
    graph.setGridEnabled(false);
  }
  
  if (userSettings.gridSnap) {
    graph.setSnap(true);
  } else {
    graph.setSnap(false);
  }
}

/**
 * Setup auto-save functionality
 */
function setupAutoSave() {
  if (window.autoSaveInterval) {
    clearInterval(window.autoSaveInterval);
  }
  
  window.autoSaveInterval = setInterval(() => {
    if (graph && userSettings.autoSave) {
      autoSaveFlowchart();
    }
  }, userSettings.autoSaveInterval);
}

/**
 * Auto-save the current flowchart
 */
function autoSaveFlowchart() {
  try {
    if (!graph) return;
    
    const parent = graph.getDefaultParent();
    const cells = graph.getChildCells(parent, true, true);
    
    if (cells.length === 0) return; // Don't save empty flowcharts
    
    const autoSaveData = {
      timestamp: new Date().toISOString(),
      cells: cells.map(cell => serializeCellForAutoSave(cell))
    };
    
    localStorage.setItem('flowchart_autosave', JSON.stringify(autoSaveData));
    console.log('Auto-save completed');
    
  } catch (error) {
    console.error('Auto-save error:', error);
  }
}

/**
 * Serialize a cell for auto-save (simplified version)
 */
function serializeCellForAutoSave(cell) {
  const cellData = {
    id: cell.id,
    vertex: cell.vertex,
    edge: cell.edge,
    value: cell.value,
    style: cell.style
  };
  
  if (cell.geometry) {
    cellData.geometry = {
      x: cell.geometry.x,
      y: cell.geometry.y,
      width: cell.geometry.width,
      height: cell.geometry.height
    };
  }
  
  // Add essential custom properties
  Object.keys(cell).forEach(key => {
    if (key.startsWith('_') && typeof cell[key] !== 'function') {
      cellData[key] = cell[key];
    }
  });
  
  return cellData;
}

/**
 * Load auto-saved flowchart
 */
window.loadAutoSavedFlowchart = function() {
  try {
    const autoSaveData = localStorage.getItem('flowchart_autosave');
    if (!autoSaveData) {
      console.log('No auto-saved flowchart found');
      return false;
    }
    
    const data = JSON.parse(autoSaveData);
    const lastSave = new Date(data.timestamp);
    const now = new Date();
    const hoursSinceSave = (now - lastSave) / (1000 * 60 * 60);
    
    // Only load if auto-save is less than 24 hours old
    if (hoursSinceSave > 24) {
      console.log('Auto-saved flowchart is too old, removing');
      localStorage.removeItem('flowchart_autosave');
      return false;
    }
    
    // Ask user if they want to restore
    const shouldRestore = confirm(
      `Found an auto-saved flowchart from ${lastSave.toLocaleString()}. Would you like to restore it?`
    );
    
    if (shouldRestore) {
      return window.importFlowchartJson(data);
    }
    
    return false;
    
  } catch (error) {
    console.error('Error loading auto-saved flowchart:', error);
    return false;
  }
};

/**
 * Update settings UI to reflect current values
 */
function updateSettingsUI() {
  // Update checkboxes
  const autoSaveCheckbox = document.getElementById('autoSaveCheckbox');
  if (autoSaveCheckbox) {
    autoSaveCheckbox.checked = userSettings.autoSave;
  }
  
  const gridSnapCheckbox = document.getElementById('gridSnapCheckbox');
  if (gridSnapCheckbox) {
    gridSnapCheckbox.checked = userSettings.gridSnap;
  }
  
  const showGridCheckbox = document.getElementById('showGridCheckbox');
  if (showGridCheckbox) {
    showGridCheckbox.checked = userSettings.showGrid;
  }
  
  // Update number inputs
  const autoSaveIntervalInput = document.getElementById('autoSaveIntervalInput');
  if (autoSaveIntervalInput) {
    autoSaveIntervalInput.value = userSettings.autoSaveInterval / 1000; // Convert to seconds
  }
  
  const gridSizeInput = document.getElementById('gridSizeInput');
  if (gridSizeInput) {
    gridSizeInput.value = userSettings.gridSize;
  }
  
  // Update zoom sensitivity input
  const zoomSensitivityInput = document.getElementById('zoomSensitivityInput');
  if (zoomSensitivityInput) {
    zoomSensitivityInput.value = userSettings.zoomSensitivity;
  }
  
  // Update select dropdowns
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = userSettings.theme;
  }
  
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.value = userSettings.language;
  }
}

/**
 * Reset settings to defaults
 */
window.resetSettingsToDefault = function() {
  if (confirm('Are you sure you want to reset all settings to default values?')) {
    // Reset to default values
    userSettings = {
      autoSave: true,
      autoSaveInterval: 30000,
      defaultNodeSize: { width: 200, height: 100 },
      gridSnap: true,
      gridSize: 20,
      showGrid: true,
      theme: 'light',
      language: 'en',
      zoomSensitivity: 0.01
    };
    
    colorPreferences = {
      text: '#000000',
      checkbox: '#4CAF50',
      dropdown: '#2196F3',
      money: '#FF9800',
      date: '#9C27B0',
      bigParagraph: '#607D8B',
      textColor: '#FFFFFF'
    };
    
    // Apply and save
    applySettings();
    saveSettings();
    
    alert('Settings reset to defaults');
  }
};

/**
 * Reset colors to default values
 */
window.resetColorsToDefault = function() {
  colorPreferences = {
    text: '#000000',
    checkbox: '#4CAF50',
    dropdown: '#2196F3',
    money: '#FF9800',
    date: '#9C27B0',
    bigParagraph: '#607D8B',
    textColor: '#FFFFFF'
  };
  
  // Update legend colors
  if (window.updateLegendColors) {
    window.updateLegendColors();
  }
  
  // Refresh all cells
  if (window.refreshAllCells) {
    window.refreshAllCells();
  }
  
  // Save preferences
  saveSettings();
};

/**
 * Save user color preferences
 */
window.saveUserColorPrefs = function() {
  try {
    localStorage.setItem('flowchart_color_preferences', JSON.stringify(colorPreferences));
    console.log('Color preferences saved');
  } catch (error) {
    console.error('Error saving color preferences:', error);
  }
};

/**
 * Load user color preferences
 */
window.loadUserColorPrefs = function() {
  try {
    const savedColors = localStorage.getItem('flowchart_color_preferences');
    if (savedColors) {
      colorPreferences = { ...colorPreferences, ...JSON.parse(savedColors) };
    }
    
    // Update legend colors
    if (window.updateLegendColors) {
      window.updateLegendColors();
    }
    
  } catch (error) {
    console.error('Error loading color preferences:', error);
  }
};

/**
 * Update zoom sensitivity setting
 */
window.updateZoomSensitivity = function(value) {
  console.log('🔧 [ZOOM SENSITIVITY] updateZoomSensitivity called with value:', value);
  
  userSettings.zoomSensitivity = parseFloat(value);
  console.log('🔧 [ZOOM SENSITIVITY] Updated userSettings.zoomSensitivity to:', userSettings.zoomSensitivity);
  
  // Update the display value
  const valueDisplay = document.getElementById('zoomSensitivityValue');
  if (valueDisplay) {
    valueDisplay.textContent = value;
    console.log('🔧 [ZOOM SENSITIVITY] Updated display value to:', value);
  } else {
    console.error('🔧 [ZOOM SENSITIVITY] Could not find zoomSensitivityValue element');
  }
  
  // Save the setting immediately
  console.log('🔧 [ZOOM SENSITIVITY] Calling saveSettings...');
  window.saveSettings();
  
  // Save to Firebase if available
  saveZoomSensitivityToFirebase(value);
  
  // Apply the new zoom sensitivity immediately
  console.log('🔧 [ZOOM SENSITIVITY] Calling applyZoomSensitivity...');
  applyZoomSensitivity();
};

// Also create a global function for direct access
function updateZoomSensitivity(value) {
  return window.updateZoomSensitivity(value);
}



/**
 * Save zoom sensitivity to Firebase
 */
async function saveZoomSensitivityToFirebase(value) {
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();
      
      console.log('🔧 [ZOOM SENSITIVITY] Saving to Firebase for user:', user.uid);
      
      await db.collection('userSettings').doc(user.uid).set({
        zoomSensitivity: parseFloat(value),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log('🔧 [ZOOM SENSITIVITY] Successfully saved to Firebase');
    } else {
      console.log('🔧 [ZOOM SENSITIVITY] Firebase not available or user not logged in');
    }
  } catch (error) {
    // Handle Firebase permissions errors gracefully
    if (error.code === 'permission-denied') {
      console.log('🔧 [ZOOM SENSITIVITY] Firebase permissions not available - settings saved locally only');
    } else {
      console.warn('🔧 [ZOOM SENSITIVITY] Firebase save failed:', error.message);
    }
  }
}

/**
 * Load zoom sensitivity from Firebase
 */
async function loadZoomSensitivityFromFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();
      
      console.log('🔧 [ZOOM SENSITIVITY] Loading from Firebase for user:', user.uid);
      
      const doc = await db.collection('userSettings').doc(user.uid).get();
      
      if (doc.exists) {
        const data = doc.data();
        if (data.zoomSensitivity !== undefined) {
          console.log('🔧 [ZOOM SENSITIVITY] Loaded from Firebase:', data.zoomSensitivity);
          
          // Update local settings
          userSettings.zoomSensitivity = data.zoomSensitivity;
          
          // Update UI
          const input = document.getElementById('zoomSensitivityInput');
          
          if (input) {
            input.value = data.zoomSensitivity;
            console.log('🔧 [ZOOM SENSITIVITY] Updated input value to:', data.zoomSensitivity);
          }
          
          // Apply the setting
          applyZoomSensitivity();
        }
      } else {
        console.log('🔧 [ZOOM SENSITIVITY] No Firebase settings found, using defaults');
      }
    } else {
      console.log('🔧 [ZOOM SENSITIVITY] Firebase not available or user not logged in');
    }
  } catch (error) {
    console.error('🔧 [ZOOM SENSITIVITY] Error loading from Firebase:', error);
  }
}

/**
 * Apply zoom sensitivity to the graph
 */
function applyZoomSensitivity() {
  console.log('🔧 [ZOOM SENSITIVITY] applyZoomSensitivity called');
  console.log('🔧 [ZOOM SENSITIVITY] window.graph exists:', !!window.graph);
  console.log('🔧 [ZOOM SENSITIVITY] userSettings.zoomSensitivity:', userSettings.zoomSensitivity);
  
  if (!window.graph) {
    console.warn('🔧 [ZOOM SENSITIVITY] No graph available, cannot apply zoom sensitivity');
    return;
  }
  
  // The zoom sensitivity will be applied in the mouse wheel event handlers
  // This function is called when the setting changes
  console.log('🔧 [ZOOM SENSITIVITY] Zoom sensitivity updated to:', userSettings.zoomSensitivity);
  console.log('🔧 [ZOOM SENSITIVITY] Setting applied successfully');
}

// The slider uses oninput attribute in HTML for simplicity

// Export settings for use in other modules
window.userSettings = userSettings;
window.colorPreferences = colorPreferences;
window.sectionPrefs = sectionPrefs;










