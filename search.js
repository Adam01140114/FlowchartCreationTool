// Node Search Functionality extracted from script.js
let searchTimeout = null;

function initializeSearch() {
  const searchBox = document.getElementById('nodeSearchBox');
  const clearBtn = document.getElementById('clearSearchBtn');

  if (searchBox) {
    searchBox.addEventListener('input', function() {
      const searchTerm = this.value.trim().toLowerCase();
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { performNodeSearch(searchTerm); }, 200);
      if (searchTerm.length > 0) {
        clearBtn.classList.add('show');
      } else {
        clearBtn.classList.remove('show');
        clearSearch();
      }
    });

    searchBox.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length > 0) selectFirstSearchResult(searchTerm);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      searchBox.value = '';
      clearSearch();
      clearBtn.classList.remove('show');
      searchBox.focus();
    });
  }
}

const cellTextCache = new Map();
let lastCacheClear = Date.now();

function clearCellTextCache() {
  const now = Date.now();
  if (now - lastCacheClear > 30000) {
    cellTextCache.clear();
    lastCacheClear = now;
  }
}

function getCellText(cell) {
  const cacheKey = `${cell.id}_${cell.value}_${cell._questionText}_${cell._subtitleText}_${cell._infoText}_${cell._notesText}_${cell._checklistText}_${cell._alertText}_${cell._calcTitle}`;
  if (cellTextCache.has(cacheKey)) return cellTextCache.get(cacheKey);
  let cellText = '';
  if (isQuestion(cell)) {
    cellText = cell._questionText || cell.value || '';
  } else if (isOptions(cell)) {
    cellText = cell.value || '';
  } else if (isSubtitleNode(cell)) {
    cellText = cell._subtitleText || cell.value || '';
  } else if (isInfoNode(cell)) {
    cellText = cell._infoText || cell.value || '';
  } else if (isNotesNode(cell)) {
    cellText = cell._notesText || cell.value || '';
  } else if (isChecklistNode(cell)) {
    cellText = cell._checklistText || cell.value || '';
  } else if (isAlertNode(cell)) {
    cellText = cell._alertText || cell.value || '';
  } else if (isCalculationNode(cell)) {
    cellText = cell._calcTitle || cell.value || '';
  } else {
    cellText = cell.value || '';
  }
  if (cellText.includes('<')) {
    const temp = document.createElement('div');
    temp.innerHTML = cellText;
    cellText = temp.textContent || temp.innerText || cellText;
  }
  cellTextCache.set(cacheKey, cellText);
  return cellText;
}

function performNodeSearch(searchTerm) {
  if (!searchTerm || searchTerm.length === 0) { clearSearch(); return; }
  clearCellTextCache();
  const vertices = graph.getChildVertices(graph.getDefaultParent());
  const matchingCells = [];
  const searchTermLower = searchTerm.toLowerCase();
  for (const cell of vertices) {
    const cellText = getCellText(cell);
    if (cellText.toLowerCase().includes(searchTermLower)) matchingCells.push(cell);
  }
  highlightSearchResults(matchingCells, searchTerm);
}

function highlightSearchResults(matchingCells, searchTerm) {
  graph.clearSelection();
  if (matchingCells.length === 0) return;
  graph.addSelectionCells(matchingCells);
  showSearchResultsCount(matchingCells.length);
  if (matchingCells.length > 0) centerOnCell(matchingCells[0]);
}

function clearSearch() {
  graph.clearSelection();
  hideSearchResultsCount();
}

function showSearchResultsCount(count) {
  let countElement = document.getElementById('searchResultsCount');
  if (!countElement) {
    countElement = document.createElement('div');
    countElement.id = 'searchResultsCount';
    countElement.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #007bff; color: white; padding: 8px 12px; border-radius: 4px; font-size: 14px; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
    document.body.appendChild(countElement);
  }
  countElement.textContent = `${count} result${count !== 1 ? 's' : ''} found`;
  countElement.style.display = 'block';
}

function hideSearchResultsCount() {
  const countElement = document.getElementById('searchResultsCount');
  if (countElement) countElement.style.display = 'none';
}

function centerOnCell(cell) {
  if (!cell || !cell.geometry) return;
  const centerX = cell.geometry.x + cell.geometry.width / 2;
  const centerY = cell.geometry.y + cell.geometry.height / 2;
  const containerWidth = graph.container.clientWidth;
  const containerHeight = graph.container.clientHeight;
  const scale = graph.view.scale;
  const tx = (containerWidth / 2 - centerX * scale);
  const ty = (containerHeight / 2 - centerY * scale);
  graph.view.setTranslate(tx / scale, ty / scale);
  requestAnimationFrame(() => { graph.view.refresh(); });
}

function selectFirstSearchResult(searchTerm) {
  const vertices = graph.getChildVertices(graph.getDefaultParent());
  const matchingCells = [];
  const searchTermLower = searchTerm.toLowerCase();
  for (const cell of vertices) {
    const cellText = getCellText(cell);
    if (cellText.toLowerCase().includes(searchTermLower)) matchingCells.push(cell);
  }
  if (matchingCells.length > 0) {
    graph.getSelectionModel().setCell(matchingCells[0]);
    centerOnCell(matchingCells[0]);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initializeSearch();
});


