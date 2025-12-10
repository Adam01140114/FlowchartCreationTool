/**************************************************
 ************ Firebase Config & Basic Auth ********
 **************************************************/
const firebaseConfig = {
  apiKey: "AIzaSyBlxFmFD-rz1V_Q9_oV0DkLsENbmyJ1k-U",
  authDomain: "flowchart-1eb90.firebaseapp.com",
  projectId: "flowchart-1eb90",
  storageBucket: "flowchart-1eb90.firebasestorage.app",
  messagingSenderId: "546103281533",
  appId: "1:546103281533:web:ae719cdbde727dcd94ee14",
  measurementId: "G-8VSXRFREY9"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// Global user state
let currentUser = null;
/**************************************************
 ************ Default Colors & Preferences ********
 **************************************************/
// For "Reset" button (question colors)
const defaultColors = {
  amountOption: "#e3f2fd", // very light blue
  text: "#e3f2fd",        // Textbox
  checkbox: "#bbdefb",    // Checkbox
  dropdown: "#90caf9",    // Dropdown
  money: "#64b5f6",       // Number
  date: "#42a5f5",        // Date
  bigParagraph: "#2196f3",// Big Paragraph
  textColor: "#1976d2"    // Text Color
};
// User color preferences (can be overridden by user settings)
var colorPreferences = colorPreferences || { ...defaultColors };
/**************************************************
 ************ Global Constants & Settings ********
 **************************************************/
// Autosave constants
const AUTOSAVE_KEY = 'flowchart_autosave_json';
const FLOWCHART_CLIPBOARD_KEY = 'flowchart_clipboard_data';
const FLOWCHART_CLIPBOARD_TIMESTAMP_KEY = 'flowchart_clipboard_timestamp';
// Autosave settings - optimized for large flowcharts
let autosaveTimeout = null;
let autosaveThrottleDelay = 5000; // 5 seconds for better performance with large flowcharts
let lastAutosaveTime = 0;
let autosaveMinInterval = 2000; // Minimum 2 seconds between autosaves
// Edge style settings
let currentEdgeStyle = 'curved'; // Default to curved
// Jump mode styling
const jumpBorderStyle = ";strokeWidth=3;strokeColor=#ff0000;dashed=1;dashPattern=4 4;";
// Performance optimization settings
let refreshAllCellsTimeout = null;
let isRefreshing = false;
// Search functionality settings
let searchTimeout = null;
// Groups functionality
let groupCounter = 1;
let groups = {};
// Cache for autosave data to avoid unnecessary processing
let lastAutosaveData = null;
let autosaveDataHash = null;
// Clipboard functionality
let flowchartClipboard = null;
// Cell text cache for performance
const cellTextCache = new Map();
let lastCacheClear = Date.now();
// Performance monitoring
let performanceMetrics = {
  refreshCount: 0,
  lastRefreshTime: 0,
  averageRefreshTime: 0,
  cellCount: 0
};
/**************************************************
 ************ Utility Functions *******************
 **************************************************/
/**
 * Get default section color based on section number
 */
function getDefaultSectionColor(sectionNumber) {
  const colors = [
    '#1976d2', // Blue
    '#388e3c', // Green
    '#d32f2f', // Red
    '#f57c00', // Orange
    '#7b1fa2', // Purple
    '#00796b', // Teal
    '#c2185b', // Pink
    '#5d4037', // Brown
    '#455a64', // Blue Grey
    '#ff6f00'  // Amber
  ];
  return colors[(sectionNumber - 1) % colors.length];
}
/**
 * Clean up redundant semicolons in style string
 */
function cleanStyle(style) {
  if (!style) return "";
  return style
    .replace(/;+$/, "")     // Remove trailing semicolons
    .replace(/;+;/g, ";")   // Replace double semicolons
    .replace(/;{2,}/g, ";") // Replace multiple semicolons with a single one
    .replace(/;+$/, "");    // Clean trailing semicolons again (in case the previous operation created them)
}
/**
 * Updates the legend squares to reflect current colorPreferences.
 */
function updateLegendColors() {
  const elements = {
    "colorText": colorPreferences.text,
    "colorCheckbox": colorPreferences.checkbox,
    "colorDropdown": colorPreferences.dropdown,
    "colorMoney": colorPreferences.money,
    "colorDate": colorPreferences.date,
    "colorDateRange": colorPreferences.date,
    "colorEmail": colorPreferences.text,
    "colorPhone": colorPreferences.text,
    "colorBigParagraph": colorPreferences.bigParagraph,
    "colorTextColor": colorPreferences.textColor
  };
  Object.entries(elements).forEach(([id, color]) => {
    const element = document.getElementById(id);
    if (element) {
      element.style.backgroundColor = color;
    }
  });
}
/**
 * Load user color preferences from Firebase
 */
function loadUserColorPrefs() {
  if (!window.currentUser || window.currentUser.isGuest) return;
  db.collection("users")
    .doc(window.currentUser.uid)
    .collection("preferences")
    .doc("colors")
    .get()
    .then(docSnap => {
      if (docSnap.exists) {
        const data = docSnap.data();
        for (let key in defaultColors) {
          if (data[key] !== undefined) {
            colorPreferences[key] = data[key];
          } else {
            colorPreferences[key] = defaultColors[key];
          }
        }
      }
      updateLegendColors();
      if (typeof refreshAllCells === 'function') {
        refreshAllCells();
      }
    })
    .catch(err => {
      // Error loading color preferences handled silently
    });
}
/**
 * Save user color preferences to Firebase
 */
function saveUserColorPrefs() {
  if (!window.currentUser || window.currentUser.isGuest) return Promise.resolve();
  return db.collection("users")
    .doc(window.currentUser.uid)
    .collection("preferences")
    .doc("colors")
    .set(colorPreferences, { merge: true });
}
/**
 * Reset colors to default values
 */
function resetColorsToDefault() {
  colorPreferences = { ...defaultColors };
  updateLegendColors();
  if (typeof refreshAllCells === 'function') {
    refreshAllCells();
  }
  saveUserColorPrefs();
}
/**
 * Save settings to localStorage
 */
function saveSettingsToLocalStorage() {
  const settings = {
    edgeStyle: currentEdgeStyle
  };
  localStorage.setItem('flowchartSettings', JSON.stringify(settings));
}
/**
 * Load settings from localStorage
 */
function loadSettingsFromLocalStorage() {
  const settingsStr = localStorage.getItem('flowchartSettings');
  if (settingsStr) {
    try {
      const settings = JSON.parse(settingsStr);
      if (settings.edgeStyle) {
        currentEdgeStyle = settings.edgeStyle;
        if (typeof updateEdgeStyle === 'function') {
          updateEdgeStyle();
        }
      }
    } catch (e) {
    }
  }
}
/**
 * Clear cell text cache periodically to prevent memory leaks
 */
function clearCellTextCache() {
  const now = Date.now();
  if (now - lastCacheClear > 30000) { // Clear every 30 seconds
    cellTextCache.clear();
    lastCacheClear = now;
  }
}
/**
 * Get performance metrics for debugging
 */
function getPerformanceMetrics() {
  return {
    ...performanceMetrics,
    cacheSize: cellTextCache.size,
    autosaveDelay: autosaveThrottleDelay,
    refreshThrottle: 150
  };
}
/**************************************************
 ************ Section Preferences & Legend ********
 **************************************************/
// Section preferences: mapping section numbers to { borderColor, name }
// Initialize after getDefaultSectionColor is defined
var sectionPrefs = sectionPrefs || {};
// If user has opened a flowchart by name, store it here
let currentFlowchartName = null;
/**
 * Initialize section preferences with default values
 */
function initializeSectionPrefs() {
  sectionPrefs = {
    "1": { borderColor: getDefaultSectionColor(1), name: "Enter Name" }
  };
}
// Initialize section preferences
initializeSectionPrefs();
/**************************************************
 ************ Export Configuration ****************
 **************************************************/
// Export all configuration variables and functions
window.flowchartConfig = {
  // Firebase
  firebaseConfig,
  db,
  currentUser,
  // Colors
  defaultColors,
  colorPreferences,
  // Sections
  sectionPrefs,
  currentFlowchartName,
  // Constants
  AUTOSAVE_KEY,
  FLOWCHART_CLIPBOARD_KEY,
  FLOWCHART_CLIPBOARD_TIMESTAMP_KEY,
  // Settings
  autosaveTimeout,
  autosaveThrottleDelay,
  lastAutosaveTime,
  autosaveMinInterval,
  currentEdgeStyle,
  jumpBorderStyle,
  refreshAllCellsTimeout,
  isRefreshing,
  searchTimeout,
  groupCounter,
  groups,
  lastAutosaveData,
  autosaveDataHash,
  flowchartClipboard,
  cellTextCache,
  lastCacheClear,
  performanceMetrics,
  // Functions
  getDefaultSectionColor,
  cleanStyle,
  updateLegendColors,
  loadUserColorPrefs,
  saveUserColorPrefs,
  resetColorsToDefault,
  saveSettingsToLocalStorage,
  loadSettingsFromLocalStorage,
  clearCellTextCache,
  initializeSectionPrefs,
  getPerformanceMetrics
};
// Also export individual items for backward compatibility
Object.entries(window.flowchartConfig).forEach(([key, value]) => {
  if (typeof value !== 'function') {
    window[key] = value;
  }
});
// Export functions globally
window.getDefaultSectionColor = getDefaultSectionColor;
window.cleanStyle = cleanStyle;
window.updateLegendColors = updateLegendColors;
window.loadUserColorPrefs = loadUserColorPrefs;
window.saveUserColorPrefs = saveUserColorPrefs;
window.resetColorsToDefault = resetColorsToDefault;
window.saveSettingsToLocalStorage = saveSettingsToLocalStorage;
window.loadSettingsFromLocalStorage = loadSettingsFromLocalStorage;
window.clearCellTextCache = clearCellTextCache;
window.initializeSectionPrefs = initializeSectionPrefs;
window.getPerformanceMetrics = getPerformanceMetrics;