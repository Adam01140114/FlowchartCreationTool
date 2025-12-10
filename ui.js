/**************************************************
 ************ UI Interactions & Menus *************
 **************************************************/

// Global variables for UI state
let contextMenuVisible = false;
let settingsMenuVisible = false;

/**
 * Show the context menu at the specified coordinates
 */
window.showContextMenu = function(x, y, cell) {
  const contextMenu = document.getElementById('contextMenu');
  if (!contextMenu) return;

  // Position the menu
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.style.display = 'block';
  contextMenuVisible = true;

  // Store the target cell
  window.contextMenuTarget = cell;

  // Update menu items based on cell type
  updateContextMenuItems(cell);
};

/**
 * Hide the context menu - now handled by context-menus.js
 * This function is kept for backward compatibility but delegates to the main function
 */
window.hideContextMenu = function() {
  // Delegate to the main hideContextMenu function in context-menus.js
  if (typeof window.hideContextMenuMain === 'function') {
    window.hideContextMenuMain();
  }
};

/**
 * Show the notes context menu
 */
window.showNotesContextMenu = function(x, y, cell) {
  const menu = document.getElementById('notesContextMenu');
  if (!menu) return;

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
  window.contextMenuTarget = cell;
};

/**
 * Hide the notes context menu
 */
function hideNotesContextMenu() {
  const menu = document.getElementById('notesContextMenu');
  if (menu) menu.style.display = 'none';
}

/**
 * Show the edge context menu
 */
window.showEdgeContextMenu = function(x, y, cell) {
  const menu = document.getElementById('edgeContextMenu');
  if (!menu) return;

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
  window.contextMenuTarget = cell;
};

/**
 * Hide the edge context menu
 */
function hideEdgeContextMenu() {
  const menu = document.getElementById('edgeContextMenu');
  if (menu) menu.style.display = 'none';
}

/**
 * Show the empty space context menu
 */
window.showEmptySpaceMenu = function(x, y) {
  const menu = document.getElementById('emptySpaceMenu');
  if (!menu) return;

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
  window.contextMenuTarget = null;
};

/**
 * Hide the empty space context menu
 */
function hideEmptySpaceMenu() {
  const menu = document.getElementById('emptySpaceMenu');
  if (menu) menu.style.display = 'none';
}

/**
 * Show the properties menu
 */
window.showPropertiesMenu = function(x, y, cell) {
  const menu = document.getElementById('propertiesMenu');
  if (!menu) return;

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.style.display = 'block';
  window.contextMenuTarget = cell;

  // Update properties based on cell type
  updatePropertiesPanel(cell);
};

/**
 * Hide the properties menu
 */
function hidePropertiesMenu() {
  const menu = document.getElementById('propertiesMenu');
  if (menu) menu.style.display = 'none';
}

/**
 * Show the settings menu
 */
window.showSettingsMenu = function() {
  const menu = document.getElementById('settingsMenu');
  if (!menu) return;

  menu.style.display = 'block';
  settingsMenuVisible = true;

  // Set current edge style value
  const edgeStyleToggle = document.getElementById('edgeStyleToggle');
  if (edgeStyleToggle && typeof currentEdgeStyle !== 'undefined') {
    edgeStyleToggle.value = currentEdgeStyle;
  }

  // Load current settings
  if (typeof loadSettingsFromLocalStorage === 'function') {
    loadSettingsFromLocalStorage();
  }

  // The slider should work with the oninput attribute in HTML

  // Add click-outside-to-close functionality
  setTimeout(() => {
    document.addEventListener('click', handleSettingsClickOutside);
  }, 100);
};

/**
 * Hide the settings menu
 */
window.hideSettingsMenu = function() {
  const menu = document.getElementById('settingsMenu');
  if (!menu) return;

  menu.style.display = 'none';
  settingsMenuVisible = false;

  // Remove click-outside-to-close functionality
  document.removeEventListener('click', handleSettingsClickOutside);
};

/**
 * Handle clicks outside the settings menu
 */
function handleSettingsClickOutside(event) {
  const settingsMenu = document.getElementById('settingsMenu');
  if (settingsMenu && !settingsMenu.contains(event.target) && settingsMenuVisible) {
    window.hideSettingsMenu();
  }
}

/**
 * Update context menu items based on cell type
 */
function updateContextMenuItems(cell) {
  if (!cell) return;

  // Show/hide menu items based on cell type
  const menuItems = {
    'deleteNode': true,
    'editNode': true,
    'copyNode': true,
    'duplicateNode': true
  };

  // Update visibility based on cell type
  Object.keys(menuItems).forEach(itemId => {
    const item = document.getElementById(itemId);
    if (item) {
      item.style.display = menuItems[itemId] ? 'block' : 'none';
    }
  });
}

/**
 * Update properties panel with cell information
 */
window.updatePropertiesPanel = function(cell) {
  if (!cell) return;

  // Implementation depends on your properties panel structure
  // This is a placeholder for the actual implementation

};

/**
 * Initialize search functionality
 */
window.initializeSearch = function() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    if (searchTerm.length > 2) {
      performSearch(searchTerm);
    } else {
      clearSearchResults();
    }
  });
};

/**
 * Perform search across all nodes
 */
function performSearch(searchTerm) {
  if (!graph) return;

  const parent = graph.getDefaultParent();
  const cells = graph.getChildCells(parent, true, true);
  const results = [];

  cells.forEach(cell => {
    if (cell.vertex) {
      const text = getCellText(cell);
      if (text.toLowerCase().includes(searchTerm)) {
        results.push(cell);
      }
    }
  });

  displaySearchResults(results);
}

/**
 * Get text content from a cell
 */
function getCellText(cell) {
  if (cell.value) return cell.value.toString();
  if (cell._questionText) return cell._questionText;
  if (cell._notesText) return cell._notesText;
  if (cell._checklistText) return cell._checklistText;
  return '';
}

/**
 * Display search results
 */
function displaySearchResults(results) {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = '';

  if (results.length === 0) {
    resultsContainer.innerHTML = '<p>No results found</p>';
    return;
  }

  results.forEach(cell => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    resultItem.textContent = getCellText(cell);
    resultItem.addEventListener('click', () => {
      selectCellInGraph(cell);
    });
    resultsContainer.appendChild(resultItem);
  });
}

/**
 * Clear search results
 */
function clearSearchResults() {
  const resultsContainer = document.getElementById('searchResults');
  if (resultsContainer) {
    resultsContainer.innerHTML = '';
  }
}

/**
 * Select a cell in the graph (for search results)
 */
function selectCellInGraph(cell) {
  if (!graph) return;

  graph.setSelectionCell(cell);

  // Center the view on the selected cell
  const geometry = cell.geometry;
  if (geometry) {
    const view = graph.view;
    const scale = view.scale;
    const x = geometry.x * scale;
    const y = geometry.y * scale;

    view.setTranslate(-x + view.container.clientWidth / 2, -y + view.container.clientHeight / 2);
  }
}

/**
 * Check if user is currently typing in an input field
 */
window.isUserTyping = function() {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || activeElement.contentEditable === 'true';
};

/**
 * Copy selected node as JSON - handled by script.js
 * Removed duplicate function to prevent conflicts
 */

// Paste function is now handled by script.js - no duplicate function needed

/**
 * Serialize a cell to JSON
 */
function serializeCell(cell) {
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

  // Add custom properties
  Object.keys(cell).forEach(key => {
    if (key.startsWith('_') && typeof cell[key] !== 'function') {
      cellData[key] = cell[key];
    }
  });

  return cellData;
}

/**
 * Deserialize a cell from JSON
 */
function deserializeCell(cellData, x, y) {
  if (!graph) return null;

  const parent = graph.getDefaultParent();
  let cell;

  if (cellData.vertex) {
    const geometry = cellData.geometry || { x: x, y: y, width: 200, height: 100 };
    cell = graph.insertVertex(parent, cellData.id, cellData.value, 
      geometry.x, geometry.y, geometry.width, geometry.height, cellData.style);
  } else if (cellData.edge) {
    // Handle edge creation if needed
    return null;
  }

  // Restore custom properties
  if (cell) {
    Object.keys(cellData).forEach(key => {
      if (key.startsWith('_') && key !== 'id' && key !== 'vertex' && key !== 'edge') {
        cell[key] = cellData[key];
      }
    });
  }

  return cell;
}

// Export functions for use in other modules
window.showContextMenu = showContextMenu;
window.hideContextMenu = hideContextMenu;
window.showEmptySpaceMenu = showEmptySpaceMenu;
window.showPropertiesMenu = showPropertiesMenu;
window.showSettingsMenu = showSettingsMenu;
window.hideSettingsMenu = hideSettingsMenu;
