/**************************************************
 ************ Settings & Preferences **************
 **************************************************/

// Global settings object
let userSettings = {
  autoSave: true,
  autoSaveInterval: 30000, // 30 seconds
  defaultNodeSize: { width: 200, height: 100 },
  gridSnap: true,
  gridSize: 20,
  showGrid: true,
  theme: 'light',
  language: 'en'
};

// Color preferences
let colorPreferences = {
  text: '#000000',
  checkbox: '#4CAF50',
  dropdown: '#2196F3',
  money: '#FF9800',
  date: '#9C27B0',
  bigParagraph: '#607D8B',
  textColor: '#FFFFFF'
};

// Section preferences
let sectionPrefs = {};

/**
 * Load settings from localStorage
 */
window.loadSettingsFromLocalStorage = function() {
  try {
    // Load user settings
    const savedSettings = localStorage.getItem('flowchart_user_settings');
    if (savedSettings) {
      userSettings = { ...userSettings, ...JSON.parse(savedSettings) };
    }
    
    // Load color preferences
    const savedColors = localStorage.getItem('flowchart_color_preferences');
    if (savedColors) {
      colorPreferences = { ...colorPreferences, ...JSON.parse(savedColors) };
    }
    
    // Load section preferences
    const savedSections = localStorage.getItem('flowchart_section_preferences');
    if (savedSections) {
      sectionPrefs = { ...sectionPrefs, ...JSON.parse(savedSections) };
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
    // Save user settings
    localStorage.setItem('flowchart_user_settings', JSON.stringify(userSettings));
    
    // Save color preferences
    localStorage.setItem('flowchart_color_preferences', JSON.stringify(colorPreferences));
    
    // Save section preferences
    localStorage.setItem('flowchart_section_preferences', JSON.stringify(sectionPrefs));
    
    console.log('Settings saved successfully');
    
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
      language: 'en'
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

// Export settings for use in other modules
window.userSettings = userSettings;
window.colorPreferences = colorPreferences;
window.sectionPrefs = sectionPrefs;
