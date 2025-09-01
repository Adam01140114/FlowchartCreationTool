// Settings functionality extracted from script.js
let currentEdgeStyle = 'curved';

window.showSettingsMenu = function() {
  const settingsMenu = document.getElementById('settingsMenu');
  const edgeStyleToggle = document.getElementById('edgeStyleToggle');
  edgeStyleToggle.value = currentEdgeStyle;
  settingsMenu.classList.add('show');
};

function hideSettingsMenu() {
  const settingsMenu = document.getElementById('settingsMenu');
  settingsMenu.classList.remove('show');
}

function saveSettings() {
  const edgeStyleToggle = document.getElementById('edgeStyleToggle');
  const newEdgeStyle = edgeStyleToggle.value;
  if (newEdgeStyle !== currentEdgeStyle) {
    currentEdgeStyle = newEdgeStyle;
    updateEdgeStyle();
    saveSettingsToLocalStorage();
  }
  hideSettingsMenu();
}

function updateEdgeStyle() {
  if (currentEdgeStyle === 'curved') {
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ROUNDED] = true;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ORTHOGONAL_LOOP] = true;
  } else if (currentEdgeStyle === 'straight') {
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ROUNDED] = false;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ORTHOGONAL_LOOP] = true;
  } else if (currentEdgeStyle === 'direct') {
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_EDGE] = mxEdgeStyle.None;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ROUNDED] = false;
    graph.getStylesheet().getDefaultEdgeStyle()[mxConstants.STYLE_ORTHOGONAL_LOOP] = false;
  }

  const edges = graph.getChildEdges(graph.getDefaultParent());
  edges.forEach(edge => {
    const currentStyle = edge.style || "";
    let newStyle;
    if (currentEdgeStyle === 'curved') {
      newStyle = currentStyle.replace(/edgeStyle=[^;]+/g, 'edgeStyle=orthogonalEdgeStyle');
      newStyle = newStyle.replace(/rounded=0/g, 'rounded=1');
      if (!newStyle.includes('rounded=')) newStyle += ';rounded=1';
      if (!newStyle.includes('orthogonalLoop=')) newStyle += ';orthogonalLoop=1';
    } else if (currentEdgeStyle === 'straight') {
      newStyle = currentStyle.replace(/edgeStyle=[^;]+/g, 'edgeStyle=orthogonalEdgeStyle');
      newStyle = newStyle.replace(/rounded=1/g, 'rounded=0');
      if (!newStyle.includes('rounded=')) newStyle += ';rounded=0';
      if (!newStyle.includes('orthogonalLoop=')) newStyle += ';orthogonalLoop=1';
    } else if (currentEdgeStyle === 'direct') {
      newStyle = currentStyle.replace(/edgeStyle=[^;]+/g, 'edgeStyle=none');
      newStyle = newStyle.replace(/rounded=[^;]+/g, 'rounded=0');
      newStyle = newStyle.replace(/orthogonalLoop=[^;]+/g, 'orthogonalLoop=0');
      if (!newStyle.includes('rounded=')) newStyle += ';rounded=0';
      if (!newStyle.includes('orthogonalLoop=')) newStyle += ';orthogonalLoop=0';
    }
    graph.getModel().setStyle(edge, newStyle);
  });
  graph.refresh();
}

function saveSettingsToLocalStorage() {
  const settings = { edgeStyle: currentEdgeStyle };
  localStorage.setItem('flowchartSettings', JSON.stringify(settings));
}

function loadSettingsFromLocalStorage() {
  const settingsStr = localStorage.getItem('flowchartSettings');
  if (settingsStr) {
    try {
      const settings = JSON.parse(settingsStr);
      if (settings.edgeStyle) {
        currentEdgeStyle = settings.edgeStyle;
        updateEdgeStyle();
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }
}

// Wire settings menu buttons when DOM is ready, if script loads early
document.addEventListener('DOMContentLoaded', function() {
  const closeBtn = document.getElementById('closeSettingsBtn');
  const saveBtn = document.getElementById('saveSettingsBtn');
  const cancelBtn = document.getElementById('cancelSettingsBtn');
  if (closeBtn) closeBtn.addEventListener('click', hideSettingsMenu);
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  if (cancelBtn) cancelBtn.addEventListener('click', hideSettingsMenu);
});


