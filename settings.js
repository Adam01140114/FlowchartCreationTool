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
  zoomSensitivity: 0.67, // Default zoom sensitivity (0.001 = very sensitive, 0.1 = less sensitive)
  wasdSpeed: 2 // Default WASD movement speed (pixels per frame)
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
    // Load user settings
    const savedSettings = localStorage.getItem('flowchart_user_settings');
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      const oldZoomSensitivity = userSettings.zoomSensitivity;
      // Update settings
      Object.assign(userSettings, parsedSettings);
      // Load from Firebase if available
      if (typeof loadZoomSensitivityFromFirebase === 'function') {
        await loadZoomSensitivityFromFirebase();
      }
      // Load WASD speed from Firebase if available
      if (typeof loadWasdSpeedFromFirebase === 'function') {
        await loadWasdSpeedFromFirebase();
      }
    }
    // Update window reference
    if (window.userSettings) {
      window.userSettings.zoomSensitivity = userSettings.zoomSensitivity;
      window.userSettings.wasdSpeed = userSettings.wasdSpeed;
    }
    // Update UI
    updateSettingsUI();
    // Apply WASD speed to movement system
    applyWasdSpeed();
  } catch (error) {
  }
};
/**
 * Save settings to localStorage
 */
window.saveSettings = function() {
  try {
    localStorage.setItem('flowchart_user_settings', JSON.stringify(userSettings));
    // Save to Firebase if available
    if (typeof saveZoomSensitivityToFirebase === 'function') {
      saveZoomSensitivityToFirebase(userSettings.zoomSensitivity);
    }
    // Save WASD speed to Firebase if available
    if (typeof saveWasdSpeedToFirebase === 'function') {
      saveWasdSpeedToFirebase(userSettings.wasdSpeed);
    }
  } catch (error) {
  }
};
/**
 * Update settings UI elements
 */
function updateSettingsUI() {
  const zoomSensitivityInput = document.getElementById('zoomSensitivityInput');
  const zoomSensitivityValue = document.getElementById('zoomSensitivityValue');
  if (zoomSensitivityInput) {
    zoomSensitivityInput.value = userSettings.zoomSensitivity;
  }
  if (zoomSensitivityValue) {
    zoomSensitivityValue.textContent = userSettings.zoomSensitivity;
  }
  const wasdSpeedInput = document.getElementById('wasdSpeedInput');
  const wasdSpeedValue = document.getElementById('wasdSpeedValue');
  if (wasdSpeedInput) {
    wasdSpeedInput.value = userSettings.wasdSpeed;
  }
  if (wasdSpeedValue) {
    wasdSpeedValue.textContent = userSettings.wasdSpeed;
  }
}
/**
 * Update zoom sensitivity
 */
window.updateZoomSensitivity = function(value) {
  userSettings.zoomSensitivity = parseFloat(value);
  if (window.userSettings) {
    window.userSettings.zoomSensitivity = userSettings.zoomSensitivity;
  }
  // Update display
  const displaySpan = document.getElementById('zoomSensitivityValue');
  if (displaySpan) {
    displaySpan.textContent = value;
  }
  // Save settings
  saveSettings();
  // Apply to graph
  applyZoomSensitivity();
}
/**
 * Save zoom sensitivity to Firebase
 */
window.saveZoomSensitivityToFirebase = async function(value) {
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();
      await db.collection('userSettings').doc(user.uid).set({
        zoomSensitivity: parseFloat(value),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
  }
};
/**
 * Load zoom sensitivity from Firebase
 */
window.loadZoomSensitivityFromFirebase = async function() {
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();
      const doc = await db.collection('userSettings').doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (data.zoomSensitivity !== undefined) {
          userSettings.zoomSensitivity = data.zoomSensitivity;
          // Update UI elements
          const input = document.getElementById('zoomSensitivityInput');
          const displaySpan = document.getElementById('zoomSensitivityValue');
          if (input) {
            input.value = data.zoomSensitivity;
          }
          if (displaySpan) {
            displaySpan.textContent = data.zoomSensitivity;
          }
          // Apply to graph
          applyZoomSensitivity();
        }
      }
    }
  } catch (error) {
  }
};
/**
 * Apply zoom sensitivity to the current graph
 */
function applyZoomSensitivity() {
  if (window.graph) {
    window.graph.zoomSensitivity = userSettings.zoomSensitivity;
  }
}
/**
 * Set up zoom sensitivity for a new graph instance
 * This should be called whenever a new graph is created
 */
window.setupZoomSensitivityForGraph = function(graph) {
  if (!graph) {
    return;
  }
  // Store the zoom sensitivity in the graph's user data for persistence
  graph.zoomSensitivity = userSettings.zoomSensitivity;
  // Apply the zoom sensitivity to the graph's mouse wheel handler
  if (graph.mouseWheelHandler) {
    graph.mouseWheelHandler.zoomSensitivity = userSettings.zoomSensitivity;
  }
};
/**
 * Update WASD movement speed
 */
window.updateWasdSpeed = function(value) {
  userSettings.wasdSpeed = parseFloat(value);
  if (window.userSettings) {
    window.userSettings.wasdSpeed = userSettings.wasdSpeed;
  }
  // Update display
  const displaySpan = document.getElementById('wasdSpeedValue');
  if (displaySpan) {
    displaySpan.textContent = value;
  }
  // Save settings
  saveSettings();
  // Apply to movement
  applyWasdSpeed();
};
/**
 * Save WASD speed to Firebase
 */
window.saveWasdSpeedToFirebase = async function(value) {
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();
      await db.collection('userSettings').doc(user.uid).set({
        wasdSpeed: parseFloat(value),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
  }
};
/**
 * Load WASD speed from Firebase
 */
window.loadWasdSpeedFromFirebase = async function() {
  try {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      const user = firebase.auth().currentUser;
      const db = firebase.firestore();
      const doc = await db.collection('userSettings').doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (data.wasdSpeed !== undefined) {
          userSettings.wasdSpeed = data.wasdSpeed;
          // Update UI elements
          const input = document.getElementById('wasdSpeedInput');
          const displaySpan = document.getElementById('wasdSpeedValue');
          if (input) {
            input.value = data.wasdSpeed;
          }
          if (displaySpan) {
            displaySpan.textContent = data.wasdSpeed;
          }
          // Apply to movement
          applyWasdSpeed();
          // Update window reference
          if (window.userSettings) {
            window.userSettings.wasdSpeed = userSettings.wasdSpeed;
          }
        }
      }
    }
  } catch (error) {
  }
};
/**
 * Apply WASD speed to the movement system
 */
function applyWasdSpeed() {
  // Update the global MOVEMENT_SPEED variable if it exists
  if (typeof window.updateMovementSpeed === 'function') {
    window.updateMovementSpeed(userSettings.wasdSpeed);
  }
}
// The slider uses oninput attribute in HTML for simplicity
// Export settings for use in other modules
window.userSettings = userSettings;