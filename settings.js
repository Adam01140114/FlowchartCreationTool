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
  zoomSensitivity: 0.67 // Default zoom sensitivity (0.001 = very sensitive, 0.1 = less sensitive)
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
window.loadSettingsFromLocalStorage = async function() {
  try {
    console.log('🔧 [ZOOM SENSITIVITY] ========== LOAD SETTINGS START ==========');
    console.log('🔧 [ZOOM SENSITIVITY] loadSettingsFromLocalStorage called');
    console.log('🔧 [ZOOM SENSITIVITY] Initial userSettings.zoomSensitivity:', userSettings.zoomSensitivity);
    console.log('🔧 [ZOOM SENSITIVITY] Function is async:', typeof loadSettingsFromLocalStorage === 'function');
    console.log('🔧 [ZOOM SENSITIVITY] This function is being called!');
    
    // Load user settings
    const savedSettings = localStorage.getItem('flowchart_user_settings');
    console.log('🔧 [ZOOM SENSITIVITY] Raw localStorage data:', savedSettings);
    
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      console.log('🔧 [ZOOM SENSITIVITY] Parsed localStorage settings:', parsedSettings);
      console.log('🔧 [ZOOM SENSITIVITY] Parsed zoomSensitivity from localStorage:', parsedSettings.zoomSensitivity);
      
      const oldZoomSensitivity = userSettings.zoomSensitivity;
      userSettings = { ...userSettings, ...parsedSettings };
      console.log('🔧 [ZOOM SENSITIVITY] userSettings.zoomSensitivity before Firebase:', userSettings.zoomSensitivity);
      console.log('🔧 [ZOOM SENSITIVITY] Changed from localStorage?', oldZoomSensitivity !== userSettings.zoomSensitivity);
    } else {
      console.log('🔧 [ZOOM SENSITIVITY] No saved settings found, using defaults');
    }
    
    // Also try to load from Firebase
    console.log('🔧 [ZOOM SENSITIVITY] About to call loadZoomSensitivityFromFirebase...');
    console.log('🔧 [ZOOM SENSITIVITY] Firebase function exists:', typeof loadZoomSensitivityFromFirebase);
    console.log('🔧 [ZOOM SENSITIVITY] About to call Firebase function...');
    console.log('🔧 [ZOOM SENSITIVITY] Firebase function exists check:', typeof loadZoomSensitivityFromFirebase === 'function');
    
    try {
      // Add a timeout to Firebase loading
      const firebasePromise = loadZoomSensitivityFromFirebase();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase load timeout')), 5000)
      );
      
      console.log('🔧 [ZOOM SENSITIVITY] About to await Firebase promise...');
      await Promise.race([firebasePromise, timeoutPromise]);
      console.log('🔧 [ZOOM SENSITIVITY] After Firebase load, userSettings.zoomSensitivity:', userSettings.zoomSensitivity);
    } catch (error) {
      console.error('🔧 [ZOOM SENSITIVITY] Error in Firebase load:', error);
      console.log('🔧 [ZOOM SENSITIVITY] Continuing with localStorage value:', userSettings.zoomSensitivity);
    }
    
    // Update the global window.userSettings object that script.js uses
    if (window.userSettings) {
      window.userSettings.zoomSensitivity = userSettings.zoomSensitivity;
      console.log('🔧 [ZOOM SENSITIVITY] Updated window.userSettings.zoomSensitivity to:', window.userSettings.zoomSensitivity);
    }
    
    // Update UI after all settings are loaded
    console.log('🔧 [ZOOM SENSITIVITY] About to call updateSettingsUI...');
    updateSettingsUI();
    console.log('🔧 [ZOOM SENSITIVITY] After updateSettingsUI, checking UI elements...');
    
    // Check what the UI actually shows
    const input = document.getElementById('zoomSensitivityInput');
    const displaySpan = document.getElementById('zoomSensitivityValue');
    console.log('🔧 [ZOOM SENSITIVITY] Input element found:', !!input);
    console.log('🔧 [ZOOM SENSITIVITY] Display span found:', !!displaySpan);
    if (input) console.log('🔧 [ZOOM SENSITIVITY] Input value after updateSettingsUI:', input.value);
    if (displaySpan) console.log('🔧 [ZOOM SENSITIVITY] Display span text after updateSettingsUI:', displaySpan.textContent);
    
    console.log('🔧 [ZOOM SENSITIVITY] ========== LOAD SETTINGS END ==========');
    
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
  console.log('🔧 [ZOOM SENSITIVITY] updateSettingsUI - zoomSensitivityInput found:', !!zoomSensitivityInput);
  console.log('🔧 [ZOOM SENSITIVITY] updateSettingsUI - userSettings.zoomSensitivity:', userSettings.zoomSensitivity);
  if (zoomSensitivityInput) {
    console.log('🔧 [ZOOM SENSITIVITY] updateSettingsUI - Input value before update:', zoomSensitivityInput.value);
    zoomSensitivityInput.value = userSettings.zoomSensitivity;
    console.log('🔧 [ZOOM SENSITIVITY] updateSettingsUI - Input value after update:', zoomSensitivityInput.value);
  }
  
  // Also update the display span
  const zoomSensitivityValue = document.getElementById('zoomSensitivityValue');
  console.log('🔧 [ZOOM SENSITIVITY] updateSettingsUI - zoomSensitivityValue found:', !!zoomSensitivityValue);
  if (zoomSensitivityValue) {
    console.log('🔧 [ZOOM SENSITIVITY] updateSettingsUI - Display span text before update:', zoomSensitivityValue.textContent);
    zoomSensitivityValue.textContent = userSettings.zoomSensitivity;
    console.log('🔧 [ZOOM SENSITIVITY] updateSettingsUI - Display span text after update:', zoomSensitivityValue.textContent);
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
      zoomSensitivity: 0.67
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
  
  // Update the global window.userSettings object that script.js uses
  if (window.userSettings) {
    window.userSettings.zoomSensitivity = parseFloat(value);
    console.log('🔧 [ZOOM SENSITIVITY] Updated window.userSettings.zoomSensitivity to:', window.userSettings.zoomSensitivity);
  }
  
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
      
      console.log('🔧 [ZOOM SENSITIVITY] ========== FIREBASE SAVE START ==========');
      console.log('🔧 [ZOOM SENSITIVITY] Saving value to Firebase:', value);
      console.log('🔧 [ZOOM SENSITIVITY] Parsed value:', parseFloat(value));
      console.log('🔧 [ZOOM SENSITIVITY] Saving to Firebase for user:', user.uid);
      console.log('🔧 [ZOOM SENSITIVITY] Data being saved:', { 
        zoomSensitivity: parseFloat(value),
        lastUpdated: 'serverTimestamp'
      });
      
      await db.collection('userSettings').doc(user.uid).set({
        zoomSensitivity: parseFloat(value),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log('🔧 [ZOOM SENSITIVITY] Successfully saved to Firebase');
      
      // Verify the save by reading it back
      const doc = await db.collection('userSettings').doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        console.log('🔧 [ZOOM SENSITIVITY] Verification - Firebase doc data after save:', data);
        console.log('🔧 [ZOOM SENSITIVITY] Verification - Saved zoomSensitivity:', data.zoomSensitivity);
      }
      console.log('🔧 [ZOOM SENSITIVITY] ========== FIREBASE SAVE END ==========');
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
    console.log('🔧 [ZOOM SENSITIVITY] ========== FIREBASE LOAD START ==========');
    console.log('🔧 [ZOOM SENSITIVITY] Firebase available:', typeof firebase !== 'undefined');
    console.log('🔧 [ZOOM SENSITIVITY] Firebase auth available:', typeof firebase !== 'undefined' && firebase.auth);
    console.log('🔧 [ZOOM SENSITIVITY] Current user:', firebase.auth ? firebase.auth().currentUser : 'N/A');
    console.log('🔧 [ZOOM SENSITIVITY] Firebase auth currentUser:', firebase.auth ? firebase.auth().currentUser : 'N/A');
    console.log('🔧 [ZOOM SENSITIVITY] Firebase auth currentUser uid:', firebase.auth && firebase.auth().currentUser ? firebase.auth().currentUser.uid : 'N/A');
    console.log('🔧 [ZOOM SENSITIVITY] Firebase function called successfully!');
    
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();
      
      console.log('🔧 [ZOOM SENSITIVITY] Loading from Firebase for user:', user.uid);
      console.log('🔧 [ZOOM SENSITIVITY] userSettings.zoomSensitivity before Firebase:', userSettings.zoomSensitivity);
      
      const doc = await db.collection('userSettings').doc(user.uid).get();
      console.log('🔧 [ZOOM SENSITIVITY] Firebase doc exists:', doc.exists);
      
      if (doc.exists) {
        const data = doc.data();
        console.log('🔧 [ZOOM SENSITIVITY] Firebase doc data:', data);
        console.log('🔧 [ZOOM SENSITIVITY] Firebase zoomSensitivity:', data.zoomSensitivity);
        console.log('🔧 [ZOOM SENSITIVITY] zoomSensitivity undefined?', data.zoomSensitivity === undefined);
        
        if (data.zoomSensitivity !== undefined) {
          console.log('🔧 [ZOOM SENSITIVITY] Loaded from Firebase:', data.zoomSensitivity);
          console.log('🔧 [ZOOM SENSITIVITY] Current userSettings.zoomSensitivity:', userSettings.zoomSensitivity);
          
          // Update local settings
          const oldValue = userSettings.zoomSensitivity;
          userSettings.zoomSensitivity = data.zoomSensitivity;
          console.log('🔧 [ZOOM SENSITIVITY] Updated userSettings.zoomSensitivity from', oldValue, 'to', userSettings.zoomSensitivity);
          
          // Update UI
          const input = document.getElementById('zoomSensitivityInput');
          const displaySpan = document.getElementById('zoomSensitivityValue');
          
          console.log('🔧 [ZOOM SENSITIVITY] Input element found:', !!input);
          console.log('🔧 [ZOOM SENSITIVITY] Display span found:', !!displaySpan);
          
          if (input) {
            console.log('🔧 [ZOOM SENSITIVITY] Input value before update:', input.value);
            input.value = data.zoomSensitivity;
            console.log('🔧 [ZOOM SENSITIVITY] Input value after update:', input.value);
          }
          
          if (displaySpan) {
            console.log('🔧 [ZOOM SENSITIVITY] Display span text before update:', displaySpan.textContent);
            displaySpan.textContent = data.zoomSensitivity;
            console.log('🔧 [ZOOM SENSITIVITY] Display span text after update:', displaySpan.textContent);
          }
          
          // Apply the setting
          console.log('🔧 [ZOOM SENSITIVITY] About to call applyZoomSensitivity...');
          applyZoomSensitivity();
        } else {
          console.log('🔧 [ZOOM SENSITIVITY] No zoomSensitivity in Firebase data');
        }
      } else {
        console.log('🔧 [ZOOM SENSITIVITY] No Firebase settings found, using defaults');
      }
    } else {
      console.log('🔧 [ZOOM SENSITIVITY] Firebase not available or user not logged in');
    }
    console.log('🔧 [ZOOM SENSITIVITY] ========== FIREBASE LOAD END ==========');
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

/**
 * Set up zoom sensitivity for a new graph instance
 * This should be called whenever a new graph is created
 */
window.setupZoomSensitivityForGraph = function(graph) {
  console.log('🔧 [ZOOM SENSITIVITY] setupZoomSensitivityForGraph called');
  console.log('🔧 [ZOOM SENSITIVITY] Graph provided:', !!graph);
  console.log('🔧 [ZOOM SENSITIVITY] Current userSettings.zoomSensitivity:', userSettings.zoomSensitivity);
  
  if (!graph) {
    console.warn('🔧 [ZOOM SENSITIVITY] No graph provided to setupZoomSensitivityForGraph');
    return;
  }
  
  // Store the zoom sensitivity in the graph's user data for persistence
  graph.zoomSensitivity = userSettings.zoomSensitivity;
  console.log('🔧 [ZOOM SENSITIVITY] Set graph.zoomSensitivity to:', graph.zoomSensitivity);
  
  // Apply the zoom sensitivity to the graph's mouse wheel handler
  if (graph.mouseWheelHandler) {
    console.log('🔧 [ZOOM SENSITIVITY] Updating existing mouseWheelHandler');
    graph.mouseWheelHandler.zoomSensitivity = userSettings.zoomSensitivity;
  }
  
  console.log('🔧 [ZOOM SENSITIVITY] Zoom sensitivity setup complete for graph');
};

// The slider uses oninput attribute in HTML for simplicity

// Export settings for use in other modules
window.userSettings = userSettings;
window.colorPreferences = colorPreferences;
window.sectionPrefs = sectionPrefs;










