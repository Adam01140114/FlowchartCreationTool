/**************************************************
 ************ SHARED DEPENDENCIES MODULE ********
 **************************************************/
// This module provides shared dependency accessors for all other modules
// to prevent duplicate function declarations
// Graph accessor
function getGraph() {
  return window.graph || null;
}
// Autosave accessor
function getRequestAutosave() {
  return window.requestAutosave || (() => {});
}
// Refresh cells accessor
function getRefreshAllCells() {
  return window.refreshAllCells || (() => {});
}
// Escape functions accessors
function getEscapeAttr() {
  return window.escapeAttr || ((str) => str ? str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '');
}
function getEscapeHtml() {
  return window.escapeHtml || ((str) => str ? str.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '');
}
// Section preferences accessor
function getSectionPrefs() {
  const result = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
  return result;
}
// Groups accessors
function getGroups() {
  return window.flowchartConfig?.groups || window.groups || {};
}
function getGroupCounter() {
  return window.flowchartConfig?.groupCounter || window.groupCounter || 1;
}
// Export all dependency accessors
window.dependencies = {
  getGraph,
  getRequestAutosave,
  getRefreshAllCells,
  getEscapeAttr,
  getEscapeHtml,
  getSectionPrefs,
  getGroups,
  getGroupCounter
};
// Also export individually for backward compatibility
Object.assign(window, {
  getGraph,
  getRequestAutosave,
  getRefreshAllCells,
  getEscapeAttr,
  getEscapeHtml,
  getSectionPrefs,
  getGroups,
  getGroupCounter
});