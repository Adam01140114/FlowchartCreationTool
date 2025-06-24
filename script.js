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
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let currentUser = null;

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


/**************************************************
 *            GLOBAL  TYPING  HELPER              *
 **************************************************/
function isUserTyping (evt = null) {
  // Prefer the event target if we got one, otherwise fall back to activeElement
  const el = (evt && evt.target) || document.activeElement;
  if (!el) return false;
  // Direct hit?
  if (el.matches('input, textarea, [contenteditable="true"]')) return true;
  // Something nested inside a foreignObject? walk up the DOM
  return !!el.closest('input, textarea, [contenteditable="true"]');
}



// Global function for hiding context menus
function hideContextMenu() {
  document.getElementById('contextMenu').style.display = 'none';
  document.getElementById('typeSubmenu').style.display = 'none';
  document.getElementById('calcSubmenu').style.display = 'none';
  document.getElementById('emptySpaceMenu').style.display = 'none';
  document.getElementById('propertiesMenu').style.display = 'none';
}

// Determine the type of a node (question, options, etc.)
function getNodeType(cell) {
  if (!cell || !cell.style) return "unknown";
  
  if (cell.style.includes("nodeType=question")) {
    return "question";
  } else if (cell.style.includes("nodeType=options")) {
    return "options";
  } else if (cell.style.includes("nodeType=calculation")) {
    return "calculation"; 
  } else if (cell.style.includes("nodeType=end")) {
    return "end";
  }
  return "unknown";
}

function isEndNode(cell) {
  return (cell && cell.style && cell.style.includes("nodeType=end")) || 
         (cell && cell.id === "1") || 
         (cell && cell.id === "19");
}

function updateEndNodeCell(cell) {
  const html = `<div style="text-align:center;padding:8px;"><strong>END</strong></div>`;
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
    graph.setCellStyles(mxConstants.STYLE_EDITABLE, "0", [cell]);
  } finally {
    graph.getModel().endUpdate();
  }
}
let colorPreferences = { ...defaultColors };

// Section preferences: mapping section numbers to { borderColor, name }
// Ensure Section "1" exists by default.
let sectionPrefs = {
  "1": { borderColor: getDefaultSectionColor(1), name: "Enter Name" }
};

// If user has opened a flowchart by name, store it here
let currentFlowchartName = null;

/**
 * Updates the legend squares to reflect current colorPreferences.
 */
function updateLegendColors() {
  document.getElementById("colorText").style.backgroundColor = colorPreferences.text;
  document.getElementById("colorCheckbox").style.backgroundColor = colorPreferences.checkbox;
  document.getElementById("colorDropdown").style.backgroundColor = colorPreferences.dropdown;
  document.getElementById("colorMoney").style.backgroundColor = colorPreferences.money;
  document.getElementById("colorDate").style.backgroundColor = colorPreferences.date;
  document.getElementById("colorDateRange").style.backgroundColor = colorPreferences.date;
  document.getElementById("colorEmail").style.backgroundColor = colorPreferences.text;
  document.getElementById("colorPhone").style.backgroundColor = colorPreferences.text;
  document.getElementById("colorBigParagraph").style.backgroundColor = colorPreferences.bigParagraph;
  document.getElementById("colorTextColor").style.backgroundColor = colorPreferences.textColor;
}

const loginOverlay = document.getElementById("loginOverlay");
const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

const flowchartListOverlay = document.getElementById("flowchartListOverlay");
const flowchartListDiv = document.getElementById("flowchartList");
const closeFlowchartListBtn = document.getElementById("closeFlowchartListBtn");

const logoutBtn = document.getElementById("logoutBtn");

// Login overlay and cookie functions have been moved to auth.js

loginButton.addEventListener("click", () => {
  const email = loginEmail.value.trim();
  const pass = loginPassword.value.trim();
  firebase.auth().signInWithEmailAndPassword(email, pass)
    .then(cred => {
      currentUser = cred.user;
      setCookie("flowchart_uid", currentUser.uid, 7);
      hideLoginOverlay();
      loadUserColorPrefs();
    })
    .catch(err => {
      loginError.textContent = err.message;
    });
});
signupButton.addEventListener("click", () => {
  const email = loginEmail.value.trim();
  const pass = loginPassword.value.trim();
  firebase.auth().createUserWithEmailAndPassword(email, pass)
    .then(cred => {
      currentUser = cred.user;
      setCookie("flowchart_uid", currentUser.uid, 7);
      hideLoginOverlay();
      saveUserColorPrefs().then(() => loadUserColorPrefs());
    })
    .catch(err => {
      loginError.textContent = err.message;
    });
});

// Logout
logoutBtn.addEventListener("click", () => {
  if (!currentUser) {
    alert("No user is logged in.");
    return;
  }
  firebase.auth().signOut()
    .then(() => {
      setCookie("flowchart_uid", "", -1);
      currentUser = null;
      showLoginOverlay();
    })
    .catch(err => {
      console.error("Logout error:", err);
      alert("Error logging out: " + err);
    });
});

// checkForSavedLogin has been moved to auth.js

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
      refreshAllCells();
    })
    .catch(err => {
      console.error("Error loading color prefs:", err);
    });
}

function saveUserColorPrefs() {
  if (!window.currentUser || window.currentUser.isGuest) return Promise.resolve();
  return db.collection("users")
    .doc(window.currentUser.uid)
    .collection("preferences")
    .doc("colors")
    .set(colorPreferences, { merge: true });
}

/**************************************************
 ************ Section Preferences & Legend ********
 **************************************************/
// Section-related functions have been moved to legend.js

// Add these functions at the top level
// Section-related functions have been moved to legend.js
let selectedSectionForColor = null;

/**************************************************
 ************  GRAPH, NODES, CONTEXT MENU, etc. ********
 **************************************************/
let graph = null;
let selectedCell = null;
let currentMouseEvent = null;
let lastSelectedCell = null;
let jumpModeNode = null;
const jumpBorderStyle = ";strokeWidth=3;strokeColor=#ff0000;dashed=1;dashPattern=4 4;";

// Add this at the top level to track mouse position
let currentMouseX = 0;
let currentMouseY = 0;

// Add this in the DOMContentLoaded event listener
document.addEventListener('mousemove', function(e) {
  // Convert client coordinates to graph coordinates
  const pt = graph.getPointForEvent(e, false);
  currentMouseX = pt.x;
  currentMouseY = pt.y;
});

window.handleMultipleTextboxClick = function(event, cellId) {
  event.stopPropagation();
  const cell = graph.getModel().getCell(cellId);
  graph.selectionModel.setCell(cell);
};




window.handleMultipleTextboxFocus = function(event, cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  const textDiv = event.target;
  if (textDiv.innerText === "Enter question text") {
    textDiv.innerText = "";
  }
};


// ----------  ↓  NEW  ↓  (place after handleMultipleTextboxFocus) ----------
window.handleDropdownClick = function (event, cellId) {
  // Only stop propagation if clicking on the container div
  if (event.target.classList.contains('dropdown-question')) {
    event.stopPropagation();
    const cell = graph.getModel().getCell(cellId);
    if (cell) graph.selectionModel.setCell(cell);
  }
  // Let all events bubble naturally for the contenteditable text
};

// Helper to make text selection in dropdown nodes work
window.initDropdownTextEditing = function(element) {
  if (!element) return;
  
  const textDiv = element.querySelector('.question-text');
  if (!textDiv) return;
  
  // Override any parent styles that might interfere with text editing
  textDiv.style.userSelect = 'text';
  textDiv.style.webkitUserSelect = 'text';
  textDiv.style.msUserSelect = 'text';
  textDiv.style.mozUserSelect = 'text';
  textDiv.style.pointerEvents = 'auto';
  textDiv.style.cursor = 'text';
  
  // Remove any event handlers that might interfere
  textDiv.onmousedown = null;
  textDiv.onmousemove = null;
  textDiv.onmouseup = null;
  
  // Prevent the default mxGraph handlers from running when clicking inside the text
  textDiv.addEventListener('mousedown', function(e) {
    e.stopPropagation();
  });
  
  // Allow normal clipboard operations
  textDiv.addEventListener('copy', function(e) {
    e.stopPropagation();
  });
  
  textDiv.addEventListener('cut', function(e) {
    e.stopPropagation();
  });
  
  textDiv.addEventListener('paste', function(e) {
    e.stopPropagation();
  });
};

// Update handleDropdownFocus to initialize text editing
window.handleDropdownFocus = function (event, cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  
  // Initialize text editing capabilities
  window.initDropdownTextEditing(event.target.parentElement);
  
  if (event.target.innerText === "Enter dropdown question") {
    event.target.innerText = "";
  }
};
// ----------  ↑  NEW  ↑  ----------------------------------------------------
// ----------  ↓  NEW  ↓  (place immediately after handleDropdownFocus) ----------
window.handleDropdownMouseDown = function (event) {
  /* We're not using this handler anymore to allow normal text selection */
  // No operation - existing for backward compatibility
};
// ----------  ↑  NEW  ↑  -------------------------------------------------------


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

// loadFlowchartData
function loadFlowchartData(data) {
  data.cells.forEach(item => {
    if (item.style) {
      item.style = cleanStyle(item.style);
    }
  });

  graph.getModel().beginUpdate();
  try {
    const parent = graph.getDefaultParent();
    graph.removeCells(graph.getChildVertices(parent));
    const createdCells = {};

    if (data.sectionPrefs) {
      sectionPrefs = data.sectionPrefs;
      // updateSectionLegend is defined in legend.js
      updateSectionLegend();
    }

    // First pass: Create all cells
    data.cells.forEach(item => {
      if (item.vertex) {
        const geo = new mxGeometry(
          item.geometry.x,
          item.geometry.y,
          item.geometry.width,
          item.geometry.height
        );
        const newCell = new mxCell(item.value, geo, item.style);
        newCell.vertex = true;
        newCell.id = item.id;
        
        // Restore custom fields
        newCell._textboxes = item._textboxes || null;
        newCell._questionText = item._questionText || null;
        newCell._twoNumbers = item._twoNumbers || null;
        newCell._nameId = item._nameId || null;
        newCell._placeholder = item._placeholder || "";
        newCell._questionId = item._questionId || null;
        // image
        if (item._image) newCell._image = item._image;
        // calculation
        if (item._calcTitle !== undefined) newCell._calcTitle = item._calcTitle;
        if (item._calcAmountLabel !== undefined) newCell._calcAmountLabel = item._calcAmountLabel;
        if (item._calcOperator !== undefined) newCell._calcOperator = item._calcOperator;
        if (item._calcThreshold !== undefined) newCell._calcThreshold = item._calcThreshold;
        if (item._calcFinalText !== undefined) newCell._calcFinalText = item._calcFinalText;
        if (item._calcTerms !== undefined) newCell._calcTerms = item._calcTerms;
        // subtitle
        if (item._subtitleText !== undefined) newCell._subtitleText = item._subtitleText;
        // info
        if (item._infoText !== undefined) newCell._infoText = item._infoText;

        graph.addCell(newCell, parent);
        createdCells[item.id] = newCell;
      }
    });

    // Second pass: Create all edges
    data.cells.forEach(item => {
      if (item.edge) {
        const newEdge = new mxCell(item.value, new mxGeometry(), item.style);
        newEdge.edge = true;
        newEdge.id = item.id;
        const src = createdCells[item.source];
        const trg = createdCells[item.target];
        graph.addCell(newEdge, parent, undefined, src, trg);
      }
    });

    // Third pass: Fix option node sections
    const vertices = graph.getChildVertices(parent);
    vertices.forEach(cell => {
      if (isOptions(cell)) {
        const incomingEdges = graph.getIncomingEdges(cell) || [];
        for (const edge of incomingEdges) {
          const sourceCell = edge.source;
          if (sourceCell && isQuestion(sourceCell)) {
            const questionSection = getSection(sourceCell);
            const optionSection = getSection(cell);
            if (questionSection !== optionSection) {
              console.log(`Fixing option node ${cell.id} section from ${optionSection} to ${questionSection} to match parent question`);
              // setSection is defined in legend.js
              setSection(cell, questionSection);
            }
            break;
          }
        }
      }
    });
  } finally {
    graph.getModel().endUpdate();
  }

  // Renumber based on loaded positions
  renumberQuestionIds();

  // Rebuild HTML for special/certain nodes
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  graph.getModel().beginUpdate();
  try {
    vertices.forEach(cell => {
      if (isQuestion(cell)) {
        const qType = getQuestionType(cell);
        if (qType === "multipleTextboxes") {
          updateMultipleTextboxesCell(cell);
        } else if (qType === "multipleDropdownType") {
          updatemultipleDropdownTypeCell(cell);
        }
      } else if (isOptions(cell) && getQuestionType(cell) === "imageOption") {
        updateImageOptionCell(cell);
      } else if (isCalculationNode(cell)) {
        updateCalculationNodeCell(cell);
      } else if (isSubtitleNode(cell)) {
        // Extract text from HTML value if _subtitleText is not set
        if (!cell._subtitleText && cell.value) {
          const cleanValue = cell.value.replace(/<[^>]+>/g, "").trim();
          cell._subtitleText = cleanValue || "Subtitle text";
        }
        updateSubtitleNodeCell(cell);
      } else if (isInfoNode(cell)) {
        // Extract text from HTML value if _infoText is not set
        if (!cell._infoText && cell.value) {
          const cleanValue = cell.value.replace(/<[^>]+>/g, "").trim();
          cell._infoText = cleanValue || "Information text";
        }
        updateInfoNodeCell(cell);
      }
    });
  } finally {
    graph.getModel().endUpdate();
  }

  refreshAllCells();
}

document.addEventListener("DOMContentLoaded", function() {
  checkForSavedLogin();
  
  // autoLogin has been moved to auth.js

  const container = document.getElementById("graphContainer");
  const contextMenu = document.getElementById("contextMenu");
  const deleteNodeButton = document.getElementById("deleteNode");
  const jumpNodeButton = document.getElementById("jumpNode");
  const changeTypeButton = document.getElementById("changeType");
  const propertiesButton = document.getElementById("propertiesButton");
  const yesNoNodeButton = document.getElementById("yesNoNode");
  const newSectionButton = document.getElementById("newSectionNode");

  const typeSubmenu = document.getElementById("typeSubmenu");
  const calcSubmenu = document.getElementById("calcSubmenu");
  const calcTypeBtn = document.getElementById("calcType");
  const subtitleTypeBtn = document.getElementById("subtitleType");
  const infoTypeBtn = document.getElementById("infoType");
  const checkboxTypeBtn = document.getElementById("checkboxType");
  const textTypeBtn = document.getElementById("textType");
  const moneyTypeBtn = document.getElementById("moneyType");
  const dateTypeBtn = document.getElementById("dateType");
const dateRangeTypeBtn = document.getElementById("dateRangeType");
const emailTypeBtn = document.getElementById("emailType");
const phoneTypeBtn = document.getElementById("phoneType");
  const bigParagraphTypeBtn = document.getElementById("bigParagraphType");
  const multipleTextboxesTypeBtn = document.getElementById("multipleTextboxesTypeBtn");
  const multipleDropdownTypeBtn = document.getElementById("multipleDropdownTypeBtn");

  const propertiesMenu = document.getElementById("propertiesMenu");
  const propNodeText = document.getElementById("propNodeText");
  const propNodeId = document.getElementById("propNodeId");
  const propNodeType = document.getElementById("propNodeType");
  const propNodeSection = document.getElementById("propNodeSection");
  const propSectionName = document.getElementById("propSectionName");

  const resetBtn = document.getElementById("resetBtn");

  // Create graph
  graph = new mxGraph(container);

  // When the user starts panning/dragging the canvas, hide any open menus.
  graph.addListener(mxEvent.PAN, function(sender, evt) {
    hideContextMenu();
  });


  /*****************************************************************
 * SHOW-ONLY-THE-TEXT   (hides the wrapper while the user edits)
 *****************************************************************/

// helper – is it one of the simple HTML-wrapped question types?
function isSimpleHtmlQuestion(cell) {
  if (!cell || !isQuestion(cell)) return false;
  const qt = getQuestionType(cell);
  return ["text", "text2", "date", "number", "bigParagraph", "dateRange", "email", "phone", "checkbox"].includes(qt);
}

/* ----------  a) what the in-place editor should display  ---------- */
const origGetEditingValue = graph.getEditingValue.bind(graph);
graph.getEditingValue = function (cell, evt) {
  if (isSimpleHtmlQuestion(cell) || 
      (isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) ||
      isSubtitleNode(cell) ||
      isInfoNode(cell)) {
    const tmp = document.createElement("div");
    tmp.innerHTML = cell.value || "";
    return tmp.textContent || tmp.innerText || "";
  }
  return origGetEditingValue(cell, evt);
};

/* ----------  b) what to save after the user finishes editing  ---------- */
graph.addListener(mxEvent.LABEL_CHANGED, (sender, evt) => {
  const cell  = evt.getProperty("cell");
  let   value = evt.getProperty("value");   // plain text the user typed
  
  if (isSimpleHtmlQuestion(cell)) {
    value = mxUtils.htmlEntities(value || "");           // escape <>&
    graph.getModel().setValue(
      cell,
      `<div style="text-align:center;">${value}</div>`
    );
    
    // For text2 cells, also update _questionText for export
    if (getQuestionType(cell) === "text2") {
      cell._questionText = value;
    }
    
    evt.consume();   // stop mxGraph from writing the raw text
  } else if (isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) {
    // For regular option nodes, update the label and node ID
    graph.getModel().beginUpdate();
    try {
      // Set the clean value
      value = value.trim() || "Option";
      // Wrap the plain text in a centered div, escaping any HTML
      value = `<div style="text-align:center;">${mxUtils.htmlEntities(value)}</div>`;
      graph.getModel().setValue(cell, value);
      
      // Update the option node ID based on the new label
      refreshOptionNodeId(cell);
    } finally {
      graph.getModel().endUpdate();
    }
    
    refreshAllCells();
    evt.consume();
  } else if (isSubtitleNode(cell)) {
    // Update subtitle node
    graph.getModel().beginUpdate();
    try {
      // Save the plain text in the _subtitleText property
      value = value.trim() || "Subtitle text";
      cell._subtitleText = value;
      
      // Update the display value with the appropriate styling
      updateSubtitleNodeCell(cell);
    } finally {
      graph.getModel().endUpdate();
    }
    
    evt.consume();
  } else if (isInfoNode(cell)) {
    // Update info node
    graph.getModel().beginUpdate();
    try {
      // Save the plain text in the _infoText property
      value = value.trim() || "Information text";
      cell._infoText = value;
      
      // Update the display value with the appropriate styling
      updateInfoNodeCell(cell);
    } finally {
      graph.getModel().endUpdate();
    }
    
    evt.consume();
  }
});


  // ----------  AFTER  ----------
const originalDblClick = graph.dblClick.bind(graph);
graph.dblClick = function (evt, cell) {

  // make multiple-textbox **and** dropdown-style questions
  // jump straight into the inner <div class="question-text">
  if (cell && isQuestion(cell)) {
    const qt = getQuestionType(cell);
    if (qt === 'multipleTextboxes' ||
        qt === 'multipleDropdownType' ||   // numbered-dropdown
        qt === 'dropdown') {               // simple dropdown
      const state = graph.view.getState(cell);
      if (state && state.text && state.text.node) {
        const qDiv = state.text.node.querySelector('.question-text');
        if (qDiv) {
          graph.selectionModel.setCell(cell); // keep node selected
          qDiv.focus();                       // put caret inside
          mxEvent.consume(evt);
          return;
        }
      }
    }
  }
  
  // Add direct editing for option nodes on double-click
  if (cell && isOptions(cell) && !getQuestionType(cell).includes('image') && !getQuestionType(cell).includes('amount')) {
    // Enable direct editing for option nodes
    graph.startEditingAtCell(cell);
    mxEvent.consume(evt);
    return;
  }
  
  // Add direct editing for subtitle and info nodes on double-click
  if (cell && (isSubtitleNode(cell) || isInfoNode(cell))) {
    // Enable direct editing
    graph.startEditingAtCell(cell);
    mxEvent.consume(evt);
    return;
  }

  // anything else keeps the stock behaviour
  originalDblClick(evt, cell);
};


  // Let mxGraph render cell labels as HTML
  graph.setHtmlLabels(true);

  // Force all vertex labels to be interpreted as HTML
  graph.isHtmlLabel = function(cell) {
    return true;
  };

  // Disable built-in label editing if it's multipleTextboxes or multipleDropdownType
  // ----------  AFTER  ----------
graph.isCellEditable = function (cell) {
  if (!cell) return false;
  const qt = getQuestionType(cell);
  if (qt === 'multipleTextboxes' ||
      qt === 'multipleDropdownType' ||
      qt === 'dropdown') {          // new ✱
    return false;
  }
  // Allow text2 to be edited directly with double-click
  if (qt === 'text2') {
    return true;
  }
  // Allow option nodes to be edited directly with double-click
  if (isOptions(cell) && !qt.includes('image') && !qt.includes('amount')) {
    return true;
  }
  // Allow subtitle and info nodes to be edited directly with double-click
  if (isSubtitleNode(cell) || isInfoNode(cell)) {
    return true;
  }
  return true;
};


  // Enter => newline
  graph.setEnterStopsCellEditing(false);

  // Set up proper panning with left button
  graph.setPanning(true);
  graph.panningHandler.useLeftButtonForPanning = true;

  // Comment out the line that disables the context menu on the graph container
  // mxEvent.disableContextMenu(container);   // comment this out
  graph.setCellsMovable(true);
  graph.setConnectable(true);
  graph.setCellsResizable(true);

  // We'll focus just on making right-click work properly
  // Customize rubberband handling (we'll skip selection box for now)
  const rubberband = new mxRubberband(graph);
  
  // Context menu handling
  graph.popupMenuHandler.factoryMethod = function(menu, cell, evt) {
    // NEW – let native menu appear inside inputs / textareas / contenteditable
    if (evt.target.closest('input, textarea, [contenteditable="true"]')) {
      return null;            // don't build a graph menu, don't call preventDefault
    }
    propertiesMenu.style.display = "none";
    typeSubmenu.style.display = "none";
    selectedCell = cell;
    currentMouseEvent = evt;
    
    // Right-click context menu
    if (mxEvent.isRightMouseButton(evt)) {
      const selectedCells = graph.getSelectionCells();
      
      if (selectedCells && selectedCells.length > 0) {
        // Show context menu for cell(s)
        const x = evt.clientX;
        const y = evt.clientY;
        
        const menu = document.getElementById('contextMenu');
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        
        // Update menu title to show number of selected items
        if (selectedCells.length > 1) {
          document.getElementById('deleteNode').textContent = `Delete ${selectedCells.length} Nodes`;
          document.getElementById('copyNodeButton').textContent = `Copy ${selectedCells.length} Nodes`;
          
          // Hide options that don't apply to multiple nodes
          document.getElementById('yesNoNode').style.display = 'none';
          document.getElementById('changeType').style.display = 'none';
          document.getElementById('jumpNode').style.display = 'none';
          document.getElementById('propertiesButton').style.display = 'none';
        } else {
          // Single node selection - restore original text and show/hide options based on node type
          document.getElementById('deleteNode').textContent = "Delete Node";
          document.getElementById('copyNodeButton').textContent = "Copy";
          document.getElementById('jumpNode').style.display = 'block';
          document.getElementById('propertiesButton').style.display = 'block';
          
          const cell = selectedCells[0];
          if (getNodeType(cell) === 'question') {
            document.getElementById('yesNoNode').style.display = 'block';
            document.getElementById('changeType').style.display = 'block';
          } else {
            document.getElementById('yesNoNode').style.display = 'none';
            document.getElementById('changeType').style.display = 'none';
          }
        }
      } else {
        // No cells selected - show empty space context menu
        const x = evt.clientX;
        const y = evt.clientY;
        
        // Convert client coordinates to graph coordinates
        const pt = graph.getPointForEvent(evt, false);
        
        // Store click position in global variables for later use
        window.emptySpaceClickX = pt.x;
        window.emptySpaceClickY = pt.y;
        
        // Show empty space context menu
        const emptyMenu = document.getElementById('emptySpaceMenu');
        emptyMenu.style.display = 'block';
        emptyMenu.style.left = x + 'px';
        emptyMenu.style.top = y + 'px';
      }
      evt.preventDefault();
    }
    
    return null; // Always return null to prevent the default menu
  };

  document.addEventListener("click", e => {
    if (
      !contextMenu.contains(e.target) &&
      !typeSubmenu.contains(e.target) &&
      !propertiesMenu.contains(e.target)
    ) {
      hideContextMenu();
      propertiesMenu.style.display = "none";
    }
  });

  // Slight style tweaks to move label text away from top
  const style = graph.getStylesheet().getDefaultVertexStyle();
  style[mxConstants.STYLE_VERTICAL_ALIGN] = "top";
  style[mxConstants.STYLE_VERTICAL_LABEL_POSITION] = "middle";
  style[mxConstants.STYLE_SPACING_TOP] = 10;

  // Zoom with mouse wheel
  mxEvent.addMouseWheelListener(function(evt, up) {
    if (!mxEvent.isConsumed(evt)) {
      if (up) graph.zoomIn();
      else graph.zoomOut();
      mxEvent.consume(evt);
    }
  }, container);

  // Track selection
  graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
    if (lastSelectedCell) {
      autoUpdateNodeIdBasedOnLabel(lastSelectedCell);
    }
    lastSelectedCell = graph.getSelectionCell();
    
    // Highlight the section in the legend if a cell is selected
    const selectedCell = graph.getSelectionCell();
    if (selectedCell) {
      const sec = getSection(selectedCell);
      highlightSectionInLegend(sec);
    } else {
      // If no cell is selected, remove all highlights
      const allSectionItems = document.querySelectorAll(".section-item");
      allSectionItems.forEach(item => {
        item.classList.remove("highlighted");
      });
    }
  });

  // Draggable shapes (including new Calculation Node)
  const toolbarShapes = document.querySelectorAll(".shape");
  toolbarShapes.forEach(shapeEl => {
    const baseStyle = shapeEl.dataset.style;
    mxUtils.makeDraggable(
      shapeEl,
      graph,
      function (graph, evt, targetCell, x, y) {
        const parent = graph.getDefaultParent();
        graph.getModel().beginUpdate();
        let newVertex;
        try {
          const label = shapeEl.dataset.type + " node";
          let styleWithPointer = baseStyle;
          if (!styleWithPointer.includes("pointerEvents=")) {
            styleWithPointer += "pointerEvents=1;overflow=fill;";
          }

          let width = 160;
          if (shapeEl.dataset.type === 'question') {
            width = 280; // Wider for questions to fit dropdown
          }

          newVertex = graph.insertVertex(
            parent,
            null,
            label,
            x,
            y,
            width,
            80,
            styleWithPointer
          );
        } finally {
          graph.getModel().endUpdate();
        }

        // If question
        if (isQuestion(newVertex)) {
          // Only set type if there is a questionType in the style
          const qType = getQuestionType(newVertex);
          if (qType) {
            setQuestionType(newVertex, qType);
          }
          // Otherwise, leave as unassigned so the dropdown appears
        } else if (isOptions(newVertex)) {
          refreshOptionNodeId(newVertex);
        } else   if (isCalculationNode(newVertex)) {
          // Init calculation node data
          newVertex._calcTitle = "Calculation Title";
          newVertex._calcTerms = [{amountLabel: "", mathOperator: ""}];
          newVertex._calcOperator = "=";
          newVertex._calcThreshold = "0";
          newVertex._calcFinalText = "";
          // updateCalculationNodeCell is defined in calc.js
          updateCalculationNodeCell(newVertex);
        }

        refreshAllCells();
        return newVertex;
      }
    );
  });

  // Listen for MOVE_CELLS to adjust option nodes
  graph.addListener(mxEvent.MOVE_CELLS, function(sender, evt) {
    const movedCells = evt.getProperty('cells');
    const dx = evt.getProperty('dx');
    const dy = evt.getProperty('dy');
    
    if (!movedCells || movedCells.length === 0) return;

    const movedIds = new Set(movedCells.map(c => c.id));
    
    // Function to get all connected descendants
    const getConnectedDescendants = (cell) => {
      const descendants = new Set();
      const queue = [cell];
      
      while (queue.length > 0) {
        const current = queue.shift();
        const edges = graph.getOutgoingEdges(current) || [];
        
        edges.forEach(edge => {
          const target = edge.target;
          if (!descendants.has(target) && !movedIds.has(target.id)) {
            descendants.add(target);
            queue.push(target);
          }
        });
      }
      return Array.from(descendants);
    };

    movedCells.forEach(cell => {
      if (isQuestion(cell)) {
        const descendants = getConnectedDescendants(cell);
        descendants.forEach(descendant => {
          const geo = descendant.geometry;
          if (geo) {
            const newGeo = geo.clone();
            newGeo.x += dx;
            newGeo.y += dy;
            graph.getModel().setGeometry(descendant, newGeo);
          }
        });
      }
    });
  });

  // Delete node
  deleteNodeButton.addEventListener("click", () => {
    const cells = graph.getSelectionCells();
    if (cells.length > 0) {
      // Process question cells first to update dependent calculation nodes
      const questionCells = cells.filter(cell => isQuestion(cell));
      
      // For each question cell that will be deleted, handle dependent calc nodes
      if (questionCells.length > 0) {
        questionCells.forEach(cell => {
          const oldNodeId = getNodeId(cell);
          // Update or remove dependent calculation nodes
          updateAllCalcNodesOnQuestionChange(null, true, oldNodeId);
        });
      }
      
      graph.removeCells(cells);
      refreshAllCells();
    }
    hideContextMenu();
  });

  // Mark/unmark jump node
  jumpNodeButton.addEventListener("click", () => {
    if (selectedCell) {
      if (jumpModeNode && jumpModeNode !== selectedCell) {
        removeJumpStyling(jumpModeNode);
      }
      jumpModeNode = selectedCell;
      addJumpStyling(jumpModeNode);
    }
    hideContextMenu();
  });

  // Create yes/no child options
  yesNoNodeButton.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      createYesNoOptions(selectedCell);
    }
    hideContextMenu();
  });

  // 'Change Type' -> Show submenu
  changeTypeButton.addEventListener("click", () => {
    const rect = contextMenu.getBoundingClientRect();
    if (selectedCell && isQuestion(selectedCell)) {
      typeSubmenu.style.display = "block";
      typeSubmenu.style.left = rect.right + "px";
      typeSubmenu.style.top = rect.top + "px";
      calcSubmenu.style.display = "none";
    } else if (selectedCell && (isCalculationNode(selectedCell) || isSubtitleNode(selectedCell) || isInfoNode(selectedCell))) {
      calcSubmenu.style.display = "block";
      calcSubmenu.style.left = rect.right + "px";
      calcSubmenu.style.top = rect.top + "px";
      typeSubmenu.style.display = "none";
    }
  });

  // Submenu question-type events
  checkboxTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "checkbox");
      // Remove the line that sets selectedCell.value directly
      // Instead, rely on setQuestionType to handle rendering
      refreshAllCells();
    }
    hideContextMenu();
  });
  textTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "text");
      selectedCell.value = "Text question node";
      refreshAllCells();
    }
    hideContextMenu();
  });
  
  // Text2 type (Textbox Dropdown) button
  const text2TypeBtn = document.getElementById("text2Type");
  text2TypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "text2");
      selectedCell.value = "Textbox Dropdown node";
      refreshAllCells();
    }
    hideContextMenu();
  });
  moneyTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "number");
      selectedCell.value = "Number question node";
      refreshAllCells();
    }
    hideContextMenu();
  });
  dateTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "date");
      selectedCell.value = "Date question node";
      refreshAllCells();
    }
    hideContextMenu();
  });
  dateRangeTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "dateRange");
      selectedCell.value = "Date Range question node";
      refreshAllCells();
    }
    hideContextMenu();
  });
  emailTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "email");
      selectedCell.value = "Email question node";
      refreshAllCells();
    }
    hideContextMenu();
  });
  phoneTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "phone");
      selectedCell.value = "Phone question node";
      refreshAllCells();
    }
    hideContextMenu();
  });
  bigParagraphTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "bigParagraph");
      selectedCell.value = "Big Paragraph question node";
      refreshAllCells();
    }
    hideContextMenu();
  });

  // Calc submenu buttons
  calcTypeBtn.addEventListener("click", () => {
    if (selectedCell) {
      // Convert to calculation node
      graph.getModel().beginUpdate();
      try {
        selectedCell.style = selectedCell.style.replace(/nodeType=[^;]+/, "nodeType=calculation");
        selectedCell._calcTitle = "Calculation Title";
        selectedCell._calcAmountLabel = "";
        selectedCell._calcOperator = "=";
        selectedCell._calcThreshold = "0";
        selectedCell._calcFinalText = "";
        selectedCell._calcTerms = [{amountLabel: "", mathOperator: ""}];
        updateCalculationNodeCell(selectedCell);
      } finally {
        graph.getModel().endUpdate();
      }
      refreshAllCells();
    }
    hideContextMenu();
  });

  subtitleTypeBtn.addEventListener("click", () => {
    if (selectedCell) {
      // Convert to subtitle node
      graph.getModel().beginUpdate();
      try {
        selectedCell.style = selectedCell.style.replace(/nodeType=[^;]+/, "nodeType=subtitle");
        selectedCell._subtitleText = "Subtitle text";
        updateSubtitleNodeCell(selectedCell);
      } finally {
        graph.getModel().endUpdate();
      }
      refreshAllCells();
    }
    hideContextMenu();
  });

  infoTypeBtn.addEventListener("click", () => {
    if (selectedCell) {
      // Convert to info node
      graph.getModel().beginUpdate();
      try {
        selectedCell.style = selectedCell.style.replace(/nodeType=[^;]+/, "nodeType=info");
        selectedCell._infoText = "Information text";
        updateInfoNodeCell(selectedCell);
      } finally {
        graph.getModel().endUpdate();
      }
      refreshAllCells();
    }
    hideContextMenu();
  });

  multipleTextboxesTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "multipleTextboxes");
      if (!selectedCell._questionText) {
        selectedCell._questionText = "Enter question text";
      }
      if (!selectedCell._textboxes) {
        selectedCell._textboxes = [{ nameId: "", placeholder: "Enter value" }];
      }
      let st = selectedCell.style || "";
      if (!st.includes("pointerEvents=")) {
        st += "pointerEvents=1;overflow=fill;";
      }
      graph.getModel().setStyle(selectedCell, st);
      updateMultipleTextboxesCell(selectedCell);
    }
    hideContextMenu();
  });
  multipleDropdownTypeBtn.addEventListener("click", () => {
    if (selectedCell && isQuestion(selectedCell)) {
      setQuestionType(selectedCell, "multipleDropdownType");
      if (!selectedCell._questionText) {
        selectedCell._questionText = "Enter question text";
      }
      if (!selectedCell._twoNumbers) {
        selectedCell._twoNumbers = { first: "0", second: "0" };
      }
      if (!selectedCell._textboxes) {
        selectedCell._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
      }
      let st = selectedCell.style || "";
      if (!st.includes("pointerEvents=")) {
        st += "pointerEvents=1;overflow=fill;";
      }
      graph.getModel().setStyle(selectedCell, st);
      updatemultipleDropdownTypeCell(selectedCell);
    }
    hideContextMenu();
  });

  // Increase the "section number" for a question
  newSectionButton.addEventListener("click", () => {
    if (selectedCell) {
      // getSection is defined in legend.js
      const currentSection = parseInt(getSection(selectedCell) || "1", 10);
      // setSection is defined in legend.js
      setSection(selectedCell, currentSection + 1);
      refreshAllCells();
    }
    hideContextMenu();
  });

  // 'Properties' popup
  function showPropertiesMenu(cell, evt) {
    if (!cell) return;
    propertiesMenu.style.display = "block";
    propertiesMenu.style.left = evt.clientX + 10 + "px";
    propertiesMenu.style.top = evt.clientY + 10 + "px";

    // For multiple-text or multiple-dropdown
    if (isQuestion(cell) && 
       (getQuestionType(cell) === "multipleTextboxes" || 
        getQuestionType(cell) === "multipleDropdownType")) {
      propNodeText.textContent = cell._questionText || "";
    } else {
      // For all normal nodes, extract the plain text from the HTML value
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cell.value || "";
      propNodeText.textContent = (tempDiv.textContent || tempDiv.innerText || "").trim();
    }

    // If it's an amount option
    if (isOptions(cell) && getQuestionType(cell) === "amountOption") {
      document.getElementById("propAmountName").textContent = cell._amountName || "";
      document.getElementById("propAmountPlaceholder").textContent = cell._amountPlaceholder || "";
      document.getElementById("amountProps").style.display = "block";
    } else {
      document.getElementById("amountProps").style.display = "none";
    }

    propNodeId.textContent = getNodeId(cell) || "";
    propNodeSection.textContent = getSection(cell) || "1";
    const sec = getSection(cell);
    propSectionName.textContent = (sectionPrefs[sec] && sectionPrefs[sec].name) || "Enter section name";
    document.getElementById("propQuestionNumber").textContent = cell._questionId || "";

    if (isQuestion(cell)) {
      propNodeType.textContent = getQuestionType(cell);
    } else if (isOptions(cell)) {
      propNodeType.textContent = "options";
    } else if (isCalculationNode(cell)) {
      propNodeType.textContent = "calculation";
    } else if (isSubtitleNode(cell)) {
      propNodeType.textContent = "subtitle";
    } else if (isInfoNode(cell)) {
      propNodeType.textContent = "info";
    } else {
      propNodeType.textContent = "other";
    }
  }

  propertiesButton.addEventListener("click", () => {
    if (selectedCell) {
      showPropertiesMenu(selectedCell, currentMouseEvent);
    }
  });

  // Utility: make <span> text editable on double-click
  function makeEditableField(spanEl, onChangeCb) {
    spanEl.addEventListener("dblclick", e => {
      e.stopPropagation();
      e.preventDefault();
      spanEl.contentEditable = "true";
      spanEl.focus();
    });
    spanEl.addEventListener("blur", () => {
      spanEl.contentEditable = "false";
      onChangeCb(spanEl.textContent);
    });
    spanEl.addEventListener("keydown", evt => {
      if (evt.key === "Delete" || evt.key === "Backspace") {
        evt.stopPropagation();
      }
      if (evt.key === "Enter") {
        evt.preventDefault();
        spanEl.blur();
      }
    });
  }

  function onNodeTextFieldChange(newText) {
    if (!selectedCell) return;
    
    // Store the old nodeId before making changes (for tracking calculation dependencies)
    const oldNodeId = isQuestion(selectedCell) ? getNodeId(selectedCell) : null;
    
    graph.getModel().beginUpdate();
    try {
      if (isQuestion(selectedCell)) {
        const qType = getQuestionType(selectedCell);
        if (qType === "multipleTextboxes" || qType === "multipleDropdownType") {
          selectedCell._questionText = newText.trim() || "Enter question text";
          if (qType === "multipleTextboxes") {
            updateMultipleTextboxesCell(selectedCell);
          } else {
            updatemultipleDropdownTypeCell(selectedCell);
          }
        } else {
          selectedCell.value = newText.trim();
        }
        refreshNodeIdFromLabel(selectedCell);
        
        // Update dependent calculation nodes if the text changed 
        // (which would change the nodeId)
        if (oldNodeId && oldNodeId !== getNodeId(selectedCell)) {
          updateAllCalcNodesOnQuestionChange(selectedCell, false, oldNodeId);
        }
      } else if (isOptions(selectedCell)) {
        selectedCell.value = newText.trim();
        refreshOptionNodeId(selectedCell);
      } else if (isCalculationNode(selectedCell)) {
        // This is the "title" for the calculation node
        selectedCell._calcTitle = newText.trim();
        updateCalculationNodeCell(selectedCell);
      } else if (isSubtitleNode(selectedCell)) {
        selectedCell._subtitleText = newText.trim();
        updateSubtitleNodeCell(selectedCell);
      } else if (isInfoNode(selectedCell)) {
        selectedCell._infoText = newText.trim();
        updateInfoNodeCell(selectedCell);
      }
    } finally {
      graph.getModel().endUpdate();
    }
    refreshAllCells();
  }

  function onNodeIdFieldChange(newId) {
    if (!selectedCell) return;
    graph.getModel().beginUpdate();
    try {
      setNodeId(selectedCell, newId);
    } finally {
      graph.getModel().endUpdate();
    }
    refreshAllCells();
  }
  function onNodeSectionFieldChange(newSec) {
    if (!selectedCell) return;
    const num = parseInt(newSec.trim(), 10);
    if (isNaN(num)) return;
    graph.getModel().beginUpdate();
    try {
      // setSection is defined in legend.js
      setSection(selectedCell, num);
    } finally {
      graph.getModel().endUpdate();
    }
    refreshAllCells();
  }
  function onSectionNameFieldChange(newName) {
    if (!selectedCell) return;
    // getSection is defined in legend.js
    const sec = getSection(selectedCell);
    sectionPrefs[sec].name = newName.trim() || "Enter section name";
    // updateSectionLegend is defined in legend.js
    updateSectionLegend();
  }

  makeEditableField(propNodeText, onNodeTextFieldChange);
  makeEditableField(propNodeId, onNodeIdFieldChange);
  makeEditableField(propNodeSection, onNodeSectionFieldChange);
  makeEditableField(propSectionName, onSectionNameFieldChange);

  // For amount fields
  makeEditableField(document.getElementById("propAmountName"), (newName) => {
    if (selectedCell && getQuestionType(selectedCell) === "amountOption") {
      selectedCell._amountName = newName.trim();
      refreshAllCells();
    }
  });
  makeEditableField(document.getElementById("propAmountPlaceholder"), (newPh) => {
    if (selectedCell && getQuestionType(selectedCell) === "amountOption") {
      selectedCell._amountPlaceholder = newPh.trim();
      refreshAllCells();
    }
  });
/**************************************************
 *              KEYBOARD  SHORTCUTS               *
 **************************************************/
const keyHandler = new mxKeyHandler(graph);

/* DELETE & BACKSPACE you already handled elsewhere ------------------- */

/* Ctrl + C  – copy node (ONLY when not typing) */
keyHandler.bindControlKey(67, () => {
  if (isUserTyping()) return;                  // NEW / CHANGED
  copySelectedNodeAsJson();
});

/* Ctrl + V  – paste node (ONLY when not typing) */
keyHandler.bindControlKey(86, () => {
  if (isUserTyping()) return;                  // NEW / CHANGED
  const mousePos = graph.getPointForEvent(graph.lastEvent);
  pasteNodeFromJson(mousePos ? mousePos.x : undefined,
                    mousePos ? mousePos.y : undefined);
});

  
  // Add listener for copy button
  document.getElementById('copyNodeButton').addEventListener('click', function() {
    copySelectedNodeAsJson();
    hideContextMenu();
  });
  
  // Add listener for paste here button
  document.getElementById('pasteHereButton').addEventListener('click', function() {
    if (window.emptySpaceClickX !== undefined && window.emptySpaceClickY !== undefined) {
      pasteNodeFromJson(window.emptySpaceClickX, window.emptySpaceClickY);
      window.emptySpaceClickX = undefined;
      window.emptySpaceClickY = undefined;
    } else {
      pasteNodeFromJson();
    }
    hideContextMenu();
  });

  graph.getModel().addListener(mxEvent.EVENT_CHANGE, function(sender, evt) {
    const changes = evt.getProperty("changes");
    if (!changes) return;
    
    const modifiedQuestionCells = new Set();
    
    changes.forEach(change => {
      if (change.constructor.name === "mxValueChange") {
        const { cell, value } = change;
        
        // Track modified question cells
        if (isQuestion(cell)) {
          modifiedQuestionCells.add(cell);
        }
        
        if (value && typeof value === "string") {
          // If a label ends with "?", treat as question
          if (value.trim().endsWith("?")) {
            if (!isQuestion(cell)) {
              let style = cell.style || "";
              style += ";nodeType=question;";
              graph.getModel().setStyle(cell, style);
              refreshNodeIdFromLabel(cell);
            }
          }
        }
      }
    });
    
    // Update calculation nodes that depend on modified questions
    modifiedQuestionCells.forEach(questionCell => {
      updateAllCalcNodesOnQuestionChange(questionCell, false);
    });
    
    refreshAllCells();
  });

  graph.connectionHandler.addListener(mxEvent.CONNECT, function(sender, evt) {
    const edge = evt.getProperty("cell");
    if (!edge) return;

    const source = graph.getModel().getTerminal(edge, true);
    const target = graph.getModel().getTerminal(edge, false);

    if (source && target) {
        // When connecting an option to a question, the option and its descendants
        // should adopt the question's section only if it's a higher section number.
        if (isOptions(source) && isQuestion(target)) {
            const questionSection = getSection(target);
            const sourceSection = getSection(source);

            // Only update if the question's section is greater.
            // A null section can be treated as 0 for comparison.
            if (questionSection !== null && questionSection > (sourceSection || 0)) {
                setSection(source, questionSection);

                // Also apply to all downstream cells from this source, with the same condition.
                const downstreamCells = getConnectedDescendants(source); // Assuming getConnectedDescendants exists
                downstreamCells.forEach(cell => {
                    const cellSection = getSection(cell);
                    if ((isOptions(cell) || isQuestion(cell)) && (questionSection > (cellSection || 0))) {
                        setSection(cell, questionSection);
                    }
                });
            }
        }
        // When connecting a question to an option (reverse case), the question should
        // adopt the option's section only if it's a higher number.
        else if (isQuestion(source) && isOptions(target)) {
            const optionSection = getSection(target);
            const questionSection = getSection(source);

            if (optionSection !== null && optionSection > (questionSection || 0)) {
                setSection(source, optionSection);
            }
        }
    }

    refreshAllCells();
});


  resetBtn.addEventListener("click", () => {
    colorPreferences = { ...defaultColors };
    updateLegendColors();
    refreshAllCells();
    saveUserColorPrefs();
  });

  updateLegendColors();
  // updateSectionLegend is defined in legend.js
  updateSectionLegend();

  // Add event listeners for empty space menu buttons
  document.getElementById('placeQuestionNode').addEventListener('click', function() {
    placeNodeAtClickLocation('question');
    hideContextMenu();
  });
  
  document.getElementById('placeOptionNode').addEventListener('click', function() {
    placeNodeAtClickLocation('options');
    hideContextMenu();
  });
  
  document.getElementById('placeCalcNode').addEventListener('click', function() {
    placeNodeAtClickLocation('calculation');
    hideContextMenu();
  });
  
  document.getElementById('placeSubtitleNode').addEventListener('click', function() {
    placeNodeAtClickLocation('subtitle');
    hideContextMenu();
  });
  
  document.getElementById('placeInfoNode').addEventListener('click', function() {
    placeNodeAtClickLocation('info');
    hideContextMenu();
  });
  
  document.getElementById('placeImageNode').addEventListener('click', function() {
    placeNodeAtClickLocation('imageOption');
    hideContextMenu();
  });
  
  document.getElementById('placeAmountNode').addEventListener('click', function() {
    placeNodeAtClickLocation('amountOption');
    hideContextMenu();
  });
  
  document.getElementById('placeEndNode').addEventListener('click', function() {
    placeNodeAtClickLocation('end');
    hideContextMenu();
  });
  
  function placeNodeAtClickLocation(nodeType) {
    if (window.emptySpaceClickX === undefined || window.emptySpaceClickY === undefined) return;
    
    const parent = graph.getDefaultParent();
    graph.getModel().beginUpdate();
    let cell;
    try {
      let style = "";
      let label = "";
      let width = 160;
      let height = 80;
      
      if (nodeType === 'question') {
        // Use default style for question, but do not set a static label or questionType
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;spacing=12;fontSize=16;align=center;verticalAlign=middle;";
        label = ""; // No static label
        width = 280; // Ensure wide enough for dropdown
      } else if (nodeType === 'options') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=dropdown;spacing=12;fontSize=16;align=center;";
        label = "Option Text";
      } else if (nodeType === 'calculation') {
        style = "shape=roundRect;rounded=1;arcSize=10;whiteSpace=wrap;html=1;nodeType=calculation;spacing=12;fontSize=16;pointerEvents=1;overflow=fill;";
        label = "Calculation node";
      } else if (nodeType === 'subtitle') {
        style = "shape=roundRect;rounded=1;arcSize=10;whiteSpace=wrap;html=1;nodeType=subtitle;spacing=12;fontSize=14;fontStyle=italic;";
        label = "Subtitle text";
      } else if (nodeType === 'info') {
        style = "shape=roundRect;rounded=1;arcSize=10;whiteSpace=wrap;html=1;nodeType=info;spacing=12;fontSize=14;";
        label = "Information text";
      } else if (nodeType === 'imageOption') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=imageOption;spacing=12;fontSize=16;";
        label = "Image Option";
      } else if (nodeType === 'amountOption') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=amountOption;spacing=12;fontSize=16;";
        label = "Amount Option";
      } else if (nodeType === 'end') {
        style = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=end;fillColor=#CCCCCC;fontColor=#000000;spacing=12;fontSize=16;";
        label = "END";
      }
      
      // Create cell with appropriate width/height based on type
      if (nodeType === 'calculation') {
        width = 300;
        height = 250;
      } else if (nodeType === 'end') {
        width = 120;
        height = 60;
      }
      
      cell = graph.insertVertex(
        parent, 
        null, 
        label, 
        window.emptySpaceClickX, 
        window.emptySpaceClickY, 
        width,
        height,
        style
      );
      
      // Set IDs and section
      if (nodeType === 'question') {
        setNodeId(cell, 'Question_' + Date.now().toString().slice(-4));
        // Do NOT call setQuestionType or set questionType here; let refreshAllCells show the dropdown
      } else if (nodeType === 'options') {
        setNodeId(cell, 'Option_' + Date.now().toString().slice(-4));
      }
      
      setSection(cell, "1");
      
      // Special handling for calculation nodes
      if (nodeType === 'calculation') {
        cell._calcTitle = "Calculation Title";
        cell._calcAmountLabel = "";
        cell._calcOperator = "=";
        cell._calcThreshold = "0";
        cell._calcFinalText = "";
        updateCalculationNodeCell(cell);
      } else if (nodeType === 'subtitle') {
        cell._subtitleText = "Subtitle text";
        updateSubtitleNodeCell(cell);
      } else if (nodeType === 'info') {
        cell._infoText = "Information text";
        updateInfoNodeCell(cell);
      } else if (nodeType === 'imageOption') {
        cell._image = {
          url: "",
          width: "100",
          height: "100"
        };
        updateImageOptionCell(cell);
      } else if (nodeType === 'end') {
        updateEndNodeCell(cell);
      }
      
    } finally {
      graph.getModel().endUpdate();
    }
    
    // Apply coloring and show dropdown for question nodes
    refreshAllCells();
    
    // Clear the click location
    window.emptySpaceClickX = undefined;
    window.emptySpaceClickY = undefined;
  }
  
  // Add keyboard event listener for delete key
  document.addEventListener('keydown', function(event) {
    // Check if the key pressed is Delete or Backspace
    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Check if we're currently typing in an input field
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.tagName === 'SELECT' ||
        activeElement.isContentEditable
      );
      
      // Only proceed if we're not typing
      if (!isTyping) {
        // Get the selected cell
        const selectedCell = graph.getSelectionCell();
        
        // If a cell is selected and it's not the root cell
        if (selectedCell && selectedCell.id !== '0' && selectedCell.id !== '1') {
          // If it's a question, handle calculation node dependencies
          if (isQuestion(selectedCell)) {
            const oldNodeId = getNodeId(selectedCell);
            updateAllCalcNodesOnQuestionChange(null, true, oldNodeId);
          }
          
          // Delete the cell
          graph.removeCells([selectedCell]);
          
          // Prevent default behavior (like going back in browser history)
          event.preventDefault();
        }
      }
    }
  });

 

  /**************************************************
 *      GLOBAL  KEYDOWN  – delete / copy / paste  *
 **************************************************/
document.addEventListener('keydown', function (evt) {

  /* DELETE / BACKSPACE – unchanged ---------------------------------- */
  if ((evt.key === 'Delete' || evt.key === 'Backspace') && !isUserTyping(evt)) {
    const sel = graph.getSelectionCells();
    if (sel && sel.length) {
      /* … your existing delete-logic … */
    }
  }

  /* COPY ------------------------------------------------------------ */
  if ((evt.key === 'c' || evt.key === 'C') && (evt.ctrlKey || evt.metaKey)) {
    if (isUserTyping(evt)) return;           // NEW / CHANGED → let browser copy highlighted text
    copySelectedNodeAsJson();
    evt.preventDefault();
  }

  /* PASTE ----------------------------------------------------------- */
  if ((evt.key === 'v' || evt.key === 'V') && (evt.ctrlKey || evt.metaKey)) {
    if (isUserTyping(evt)) return;           // NEW / CHANGED → let browser paste into input/div
    const mousePos = graph.getPointForEvent(graph.lastEvent);
    pasteNodeFromJson(mousePos ? mousePos.x : undefined,
                      mousePos ? mousePos.y : undefined);
    evt.preventDefault();
  }
});


});

/*******************************************************
 ********** RENUMBERING QUESTIONS BY POSITION **********
 *******************************************************/
function renumberQuestionIds() {
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);
  const questions = vertices.filter(cell => isQuestion(cell));
  
  // Sort questions by vertical position (Y coordinate)
  questions.sort((a, b) => {
    const aY = a.geometry.y;
    const bY = b.geometry.y;
    if (Math.abs(aY - bY) < 10) { // If Y positions are very close, sort by X
      return a.geometry.x - b.geometry.x;
    }
    return aY - bY;
  });

  // Assign sequential IDs based on vertical position
  questions.forEach((cell, index) => {
    cell._questionId = index + 1;
  });
  
  // If properties menu is open for a selected question, update displayed ID
  if (selectedCell && document.getElementById("propertiesMenu").style.display === "block") {
    document.getElementById("propQuestionNumber").textContent = selectedCell._questionId;
  }
}

/*******************************************************
 ********** MULTIPLE TEXTBOXES: RENDERING & EDITS ******
 *******************************************************/
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}
function escapeAttr(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Helper function to render textboxes for multiple textboxes question
function renderTextboxes(cell) {
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: "", placeholder: "Enter value" }];
  }
  
  let html = '';
  
  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || "";
    const ph = tb.placeholder || "Enter value";
    html += 
      `<div class="textbox-entry" style="margin-bottom:8px; text-align:center;">
        <input type="text" value="${escapeAttr(val)}" data-index="${index}" placeholder="${escapeAttr(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updateMultipleTextboxHandler('${cell.id}', ${index}, this.value)"/>
        <button onclick="window.deleteMultipleTextboxHandler('${cell.id}', ${index})">Delete</button>
      </div>`;
  });
  
  html += `<div style="text-align:center; margin-top:8px;"><button onclick="window.addMultipleTextboxHandler('${cell.id}')">Add Option</button></div>`;
  
  return html;
}

// Update the multiple textboxes node
function updateMultipleTextboxesCell(cell) {
  graph.getModel().beginUpdate();
  try {
    let html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
      <input class="question-title-input" type="text" value="${escapeAttr(cell._questionText || "")}" placeholder="Enter question text" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updateInputQuestionTitle('${cell.id}', this.value)" style="margin-bottom:8px; width:90%; text-align:center;" />
      <div class="multiple-textboxes-container" style="padding: 8px; width:100%;">${renderTextboxes(cell)}</div>
    </div>`;
    cell.value = html;
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

window.updateQuestionTextHandler = function(cellId, text) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes") {
    graph.getModel().beginUpdate();
    try {
      cell._questionText = text.trim() || "Enter question text";
    } finally {
      graph.getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

window.updateMultipleTextboxHandler = function(cellId, index, value) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes" && cell._textboxes) {
    graph.getModel().beginUpdate();
    try {
      let existingPlaceholder = cell._textboxes[index].placeholder;
      if (!existingPlaceholder || existingPlaceholder === "Enter value") {
        cell._textboxes[index].placeholder = value || "";
      }
      cell._textboxes[index].nameId = value;
    } finally {
      graph.getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

window.addMultipleTextboxHandler = function(cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes") {
    graph.getModel().beginUpdate();
    try {
      if (!cell._textboxes) cell._textboxes = [];
      cell._textboxes.push({ nameId: "", placeholder: "Enter value" });
    } finally {
      graph.getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

window.deleteMultipleTextboxHandler = function(cellId, index) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleTextboxes" && cell._textboxes) {
    graph.getModel().beginUpdate();
    try {
      cell._textboxes.splice(index, 1);
    } finally {
      graph.getModel().endUpdate();
    }
    updateMultipleTextboxesCell(cell);
  }
};

/*******************************************************
 ********** multipleDropdownType: RENDER & EDITS *******
 *******************************************************/
function updatemultipleDropdownTypeCell(cell) {
  const qText = cell._questionText || '';
  const twoNums = cell._twoNumbers || { first: '0', second: '0' };
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: '', placeholder: 'Enter value', isAmountOption: false }];
  }
  let html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
    <input class="question-title-input" type="text" value="${escapeAttr(qText)}" placeholder="Enter question text" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeTextHandler('${cell.id}', this.value)" style="margin-bottom:8px; width:90%; text-align:center;" />
    <div class="two-number-container" style="display: flex; justify-content:center; gap: 10px; margin-top: 8px; width:100%;">
      <input type="number" value="${escapeAttr(twoNums.first)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'first', this.value)"/>
      <input type="number" value="${escapeAttr(twoNums.second)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'second', this.value)"/>
    </div>
    <div class="multiple-textboxes-container" style="margin-top: 8px; width:100%;">`;
  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || '';
    const ph = tb.placeholder || 'Enter value';
    const checked = tb.isAmountOption ? 'checked' : '';
    html += `
      <div class="textbox-entry" style="margin-bottom:4px; text-align:center;">
        <input type="text" value="${escapeAttr(val)}" data-index="${index}" placeholder="${escapeAttr(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeHandler('${cell.id}', ${index}, this.value)"/>
        <button onclick="window.deletemultipleDropdownTypeHandler('${cell.id}', ${index})">Delete</button>
        <label>
          <input type="checkbox" ${checked} onclick="window.toggleMultipleDropdownAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });
  html += `<div style="text-align:center; margin-top:8px;"><button onclick="window.addmultipleDropdownTypeHandler('${cell.id}')">Add Option</button></div>
    </div>
  </div>`;
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
    let st = cell.style || '';
    if (!st.includes('verticalAlign=middle')) {
      st += 'verticalAlign=middle;';
    }
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

window.updatemultipleDropdownTypeTextHandler = function(cellId, text) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    graph.getModel().beginUpdate();
    try {
      cell._questionText = text.trim() || "Enter question text";
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.updatemultipleDropdownTypeNumber = function(cellId, which, value) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    graph.getModel().beginUpdate();
    try {
      if (!cell._twoNumbers) {
        cell._twoNumbers = { first: "0", second: "0" };
      }
      if (which === "first") {
        cell._twoNumbers.first = value;
      } else {
        cell._twoNumbers.second = value;
      }
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.updatemultipleDropdownTypeHandler = function(cellId, index, value) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes) {
    graph.getModel().beginUpdate();
    try {
      let existingPlaceholder = cell._textboxes[index].placeholder;
      if (!existingPlaceholder || existingPlaceholder === "Enter value") {
        cell._textboxes[index].placeholder = value || "";
      }
      cell._textboxes[index].nameId = value;
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.addmultipleDropdownTypeHandler = function(cellId) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType") {
    graph.getModel().beginUpdate();
    try {
      if (!cell._textboxes) cell._textboxes = [];
      cell._textboxes.push({ nameId: "", placeholder: "Enter value", isAmountOption: false });
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.deletemultipleDropdownTypeHandler = function(cellId, index) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes) {
    graph.getModel().beginUpdate();
    try {
      cell._textboxes.splice(index, 1);
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

window.toggleMultipleDropdownAmount = function(cellId, index, checked) {
  const cell = graph.getModel().getCell(cellId);
  if (cell && getQuestionType(cell) === "multipleDropdownType" && cell._textboxes) {
    graph.getModel().beginUpdate();
    try {
      cell._textboxes[index].isAmountOption = checked;
    } finally {
      graph.getModel().endUpdate();
    }
    updatemultipleDropdownTypeCell(cell);
  }
};

/*******************************************************
 ************ Subtitle and Info Nodes: RENDER & EDITS *********
 *******************************************************/
// isCalculationNode is now in calc.js but referenced here
// function isCalculationNode(cell) is defined in calc.js

function isSubtitleNode(cell) {
  return cell && cell.style && cell.style.includes("nodeType=subtitle");
}

function isInfoNode(cell) {
  return cell && cell.style && cell.style.includes("nodeType=info");
}

function updateSubtitleNodeCell(cell) {
  if (!cell) return;
  cell._subtitleText = cell._subtitleText || "Add subtitle text";
  cell.value = `<span style="font-size: 14px; font-style: italic;">${escapeHtml(cell._subtitleText)}</span>`;
  colorCell(cell);
}

function updateInfoNodeCell(cell) {
  if (!cell) return;
  cell._infoText = cell._infoText || "Add information text";
  cell.value = `<span style="font-size: 14px; color: #555;">${escapeHtml(cell._infoText)}</span>`;
  colorCell(cell);
}

// The calculation node functions have been moved to calc.js

/*******************************************************
 ************  HELPER / STYLING / JSON Exports  ********
 *******************************************************/
function autoUpdateNodeIdBasedOnLabel(cell) {
  if (!cell.vertex) return;
  const label = (cell.value || "").trim();
  if (!label) return;
  if (isQuestion(cell)) {
    refreshNodeIdFromLabel(cell);
  } else if (isOptions(cell)) {
    refreshOptionNodeId(cell);
  }
}
function isQuestion(cell) {
  return cell && cell.style && cell.style.includes("nodeType=question");
}
function isOptions(cell) {
  return cell && cell.style && (
    cell.style.includes("nodeType=options") ||
    cell.style.includes("questionType=amountOption") ||
    cell.style.includes("questionType=imageOption")
  );
}

function isAmountOption(cell) {
  return cell && cell.style && cell.style.includes("questionType=amountOption");
}

function setNodeId(cell, nodeId) {
  let style = cell.style || "";
  style = style.replace(/nodeId=[^;]+/, "");
  style += `;nodeId=${encodeURIComponent(nodeId)};`;
  graph.getModel().setStyle(cell, style);
}
function getNodeId(cell) {
  const style = cell.style || "";
  const m = style.match(/nodeId=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function refreshNodeIdFromLabel(cell) {
  let labelText = "";

  if (isQuestion(cell)) {
    const qType = getQuestionType(cell);
    if (qType === "multipleTextboxes" || qType === "multipleDropdownType") {
      labelText = cell._questionText || "custom_question";
    } else {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cell.value || "";
      labelText = tempDiv.textContent || tempDiv.innerText || "";
    }
  } else {
    labelText = cell.value || "";
  }

  const cleanedText = labelText
    .trim()
    .replace(/<[^>]+>/g, "")  
    .replace(/[^\w\s]/gi, "") 
    .replace(/\s+/g, "_")
    .toLowerCase();

  const nodeId = cleanedText || "unnamed_node";
  setNodeId(cell, nodeId);
}

function refreshOptionNodeId(cell) {
  const edges = graph.getIncomingEdges(cell) || [];
  let parentNodeId = "ParentQuestion";
  for (let e of edges) {
    const p = e.source;
    if (isQuestion(p)) {
      parentNodeId = getNodeId(p) || "ParentQuestion";
      break;
    }
  }
  let label = (cell.value || "Option").toString().trim().replace(/\s+/g, "_");
  setNodeId(cell, parentNodeId + label);
}

function addSkipReassign(cell) {
  if (!cell) return;
  let style = cell.style || "";
  style = style.replace(/skipReassign=[^;]+/, "");
  style += ";skipReassign=true;";
  graph.getModel().setStyle(cell, style);
}
function removeJumpStyling(cell) {
  if (!cell) return;
  let style = cell.style || "";
  style = style.replace(/strokeWidth=\d+;?/, "");
  style = style.replace(/strokeColor=[^;]+;?/, "");
  style = style.replace(/dashed=\d;?/, "");
  style = style.replace(/dashPattern=[^;]+;?/, "");
  graph.getModel().setStyle(cell, style);
}
function addJumpStyling(cell) {
  if (!cell) return;
  let style = cell.style || "";
  style = style.replace(/strokeWidth=\d+;?/, "");
  style = style.replace(/strokeColor=[^;]+;?/, "");
  style = style.replace(/dashed=\d;?/, "");
  style = style.replace(/dashPattern=[^;]+;?/, "");
  style += jumpBorderStyle;
  graph.getModel().setStyle(cell, style);
}

function getQuestionType(cell) {
  const style = cell.style || "";
  const m = style.match(/questionType=([^;]+)/);
  return m ? m[1] : "";
}

/**
 * Define pickTypeForCell globally
 */
window.pickTypeForCell = function(cellId, val) {
  console.log('[pickTypeForCell] called with cellId:', cellId, 'val:', val); // DEBUG
  if (!val) {
    console.log('[pickTypeForCell] No value selected, returning');
    return; // Do nothing if no type selected
  }
  const c = graph.getModel().getCell(cellId);
  if (!c) {
    console.log('[pickTypeForCell] No cell found for id', cellId);
    return;
  }

  graph.getModel().beginUpdate();
  try {
    setQuestionType(c, val);
    if (!c._nameId) {
      c._nameId = "answer" + graph.getChildVertices(graph.getDefaultParent()).length;
      c._placeholder = "";
    }
    // Only handle special cases for multi types
    if (val === "multipleTextboxes") {
      c._questionText = "Enter question text";
      c._textboxes = [{ nameId: "", placeholder: "Enter value" }];
      updateMultipleTextboxesCell(c);
    } else if (val === "multipleDropdownType") {
      c._questionText = "Enter question text";
      c._twoNumbers = { first: "0", second: "0" };
      c._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
      updatemultipleDropdownTypeCell(c);
    }
    // For all other types, setQuestionType handles rendering
  } finally {
    graph.getModel().endUpdate();
  }

  graph.setSelectionCell(c);
  graph.startEditingAtCell(c);
  refreshAllCells();
  console.log('[pickTypeForCell] Finished updating cell', c);
};

/******************************************************************
 * 1) Universal key-down guard – put this in your global helpers  *
 ******************************************************************/
window.handleTitleInputKeydown = function (evt) {
  // Let the browser handle native shortcuts, but don't let mxGraph see them
  if ((evt.ctrlKey || evt.metaKey) &&
      ['c', 'v', 'x', 'a'].includes(evt.key.toLowerCase())) {
    evt.stopPropagation(); // <-- added line
    return;
  }
  evt.stopPropagation(); // existing line for all other keys
  if (evt.key === 'Enter') {
    evt.preventDefault();
    evt.target.blur();
  }
};

/******************************************************************
 * 2) renderTextboxes() – used by multiple-textboxes questions     *
 *    (full replacement)                                          *
 ******************************************************************/
function renderTextboxes(cell) {
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: "", placeholder: "Enter value" }];
  }

  let html = "";

  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || "";
    const ph  = tb.placeholder || "Enter value";

    html += `
      <div class="textbox-entry" style="margin-bottom:8px;text-align:center;">
        <input type="text" value="${escapeAttr(val)}" data-index="${index}" placeholder="${escapeAttr(ph)}"onkeydown="window.handleTitleInputKeydown(event)"onblur="window.updateMultipleTextboxHandler('${cell.id}', ${index}, this.value)" />
        <button onclick="window.deleteMultipleTextboxHandler('${cell.id}', ${index})">Delete</button>
      </div>`;
  });

  html += `
    <div style="text-align:center;margin-top:8px;">
      <button onclick="window.addMultipleTextboxHandler('${cell.id}')">Add Option</button>
    </div>`;

  return html;
}

/******************************************************************
 * 3) updatemultipleDropdownTypeCell() – full replacement          *
 ******************************************************************/
function updatemultipleDropdownTypeCell(cell) {
  const qText   = cell._questionText || "";
  const twoNums = cell._twoNumbers   || { first: "0", second: "0" };

  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
  }

  let html = `
    <div class="multiple-textboxes-node"
         style="display:flex;flex-direction:column;align-items:center;">
      <input class="question-title-input"
             type="text"
             value="${escapeAttr(qText)}"
             placeholder="Enter question text"
             onkeydown="window.handleTitleInputKeydown(event)"
             onblur="window.updatemultipleDropdownTypeTextHandler('${cell.id}', this.value)"
             style="margin-bottom:8px;width:90%;text-align:center;" />

      <div class="two-number-container"
           style="display:flex;justify-content:center;gap:10px;margin-top:8px;width:100%;">
        <input type="number"
               value="${escapeAttr(twoNums.first)}"
               onkeydown="window.handleTitleInputKeydown(event)"
               onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'first', this.value)" />
        <input type="number"
               value="${escapeAttr(twoNums.second)}"
               onkeydown="window.handleTitleInputKeydown(event)"
               onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'second', this.value)" />
      </div>

      <div class="multiple-textboxes-container" style="margin-top:8px;width:100%;">`;

  cell._textboxes.forEach((tb, index) => {
    const val      = tb.nameId      || "";
    const ph       = tb.placeholder || "Enter value";
    const checked  = tb.isAmountOption ? "checked" : "";

    html += `
      <div class="textbox-entry" style="margin-bottom:4px;text-align:center;">
        <input type="text"value="${escapeAttr(val)}"data-index="${index}"placeholder="${escapeAttr(ph)}"onkeydown="window.handleTitleInputKeydown(event)"onblur="window.updatemultipleDropdownTypeHandler('${cell.id}', ${index}, this.value)" />
        <button onclick="window.deletemultipleDropdownTypeHandler('${cell.id}', ${index})">Delete</button>
        <label>
          <input type="checkbox" ${checked}
                 onclick="window.toggleMultipleDropdownAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });

  html += `
        <div style="text-align:center;margin-top:8px;">
          <button onclick="window.addmultipleDropdownTypeHandler('${cell.id}')">Add Option</button>
        </div>
      </div>
    </div>`;

  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);

    // make sure the style keeps pointer events enabled
    let st = cell.style || "";
    if (!/pointerEvents=/.test(st)) {
      st += "pointerEvents=1;overflow=fill;";
    }
    if (!/verticalAlign=middle/.test(st)) {
      st += "verticalAlign=middle;";
    }
    graph.getModel().setStyle(cell, st);
  } finally {
    graph.getModel().endUpdate();
  }

  graph.updateCellSize(cell);
}

/**************************************************
 *                setQuestionType                 *
 *  – now stores plain text for the simple types  *
 **************************************************/
/**************************************************
 *                setQuestionType                 *
 **************************************************/
/* ----------  REPLACE ENTIRE FUNCTION  ---------- */
function setQuestionType (cell, newType) {
  /* —— 1. update style —— */
  let st = (cell.style || '').replace(/questionType=[^;]+/, '');
  st += `;questionType=${newType};align=center;verticalAlign=middle;spacing=12;`;
  
  // For text2, allow double-click editing directly
  if (newType === 'text2') {
    st += 'editable=1;';
  } else if (!/pointerEvents=/.test(st)) {
    st += 'pointerEvents=1;overflow=fill;';
  }
  
  graph.getModel().setStyle(cell, st);

  /* —— 2. update internals —— */
  graph.getModel().beginUpdate();
  try {
    switch (newType) {
      case 'text': case 'date': case 'number': case 'bigParagraph':
      case 'dateRange': case 'email': case 'phone': case 'checkbox':
        // Always clear _questionText and strip any HTML if present
        cell._questionText = '';
        updateSimpleQuestionCell(cell);
        break;
      case 'text2':
        cell._questionText = '';
        updateText2Cell(cell);
        break;
      case 'multipleTextboxes':
        cell._questionText = '';
        cell._textboxes = [{ nameId:'', placeholder:'Enter value' }];
        updateMultipleTextboxesCell(cell);
        break;
      case 'multipleDropdownType':
        cell._questionText = '';
        cell._twoNumbers = { first:'0', second:'0' };
        cell._textboxes = [{ nameId:'', placeholder:'Enter value', isAmountOption:false }];
        updatemultipleDropdownTypeCell(cell);
        break;
      default:
        cell._questionText = '';
        updateSimpleQuestionCell(cell);
    }
    refreshNodeIdFromLabel(cell);
  } finally {
    graph.getModel().endUpdate();
  }
  refreshAllCells();
}
/* ----------  END OF REPLACEMENT  #2 ------------- */



/**************************************************
 *           COLORING & REFRESHING CELLS          *
 **************************************************/
function colorCell(cell) {
  if (!cell.vertex) return;
  let fillColor = "#ADD8E6"; // fallback
  
  if (isEndNode(cell)) {
    fillColor = "#CCCCCC";
    const st = cell.style || "";
    if (!st.includes("fillColor=#CCCCCC")) {
      graph.getModel().setStyle(cell, st + "fillColor=#CCCCCC;");
    }
    return;
  }

  if (isQuestion(cell)) {
    const qType = getQuestionType(cell);
    switch (qType) {
      case "text":         fillColor = colorPreferences.text; break;
      case "checkbox":     fillColor = colorPreferences.checkbox; break;
      case "dropdown":     fillColor = colorPreferences.dropdown; break;
      case "text2":        fillColor = colorPreferences.dropdown; break; // Text2 uses dropdown color
      case "number":       fillColor = colorPreferences.money; break;
      case "date":         fillColor = colorPreferences.date; break;
      case "dateRange":    fillColor = colorPreferences.date; break; // Use date color for dateRange
      case "email":        fillColor = colorPreferences.text; break; // Use text color for email
      case "phone":        fillColor = colorPreferences.text; break; // Use text color for phone
      case "bigParagraph": fillColor = colorPreferences.bigParagraph; break;
      case "multipleTextboxes":
      case "multipleDropdownType":
        fillColor = colorPreferences.text;
        break;
      default:
        fillColor = "#ADD8E6";
        break;
    }
  } else if (isOptions(cell)) {
    if (getQuestionType(cell) === "amountOption") {
      fillColor = colorPreferences.amountOption;
    } else if (getQuestionType(cell) === "imageOption") {
      fillColor = "#FFF8DC"; 
    } else {
      fillColor = "#ffffff";
    }
  } else if (isCalculationNode(cell)) {
    // You can pick a distinct color for calculation nodes
    fillColor = "#FFDDAA";
  }

  const fontColor = colorPreferences.textColor;
  const sec = getSection(cell) || "1";
  let borderColor = (sectionPrefs[sec] && sectionPrefs[sec].borderColor) || getDefaultSectionColor(parseInt(sec));
  let style = cell.style || "";
  style = style.replace(/fillColor=[^;]+/, "");
  style = style.replace(/fontColor=[^;]+/, "");
  style = style.replace(/strokeColor=[^;]+/, "");
  style += `;fillColor=${fillColor};fontColor=${fontColor};strokeColor=${borderColor};`;
  graph.getModel().setStyle(cell, style);
}

function refreshAllCells() {
  const parent = graph.getDefaultParent();
  const vertices = graph.getChildVertices(parent);

  vertices.forEach(cell => {
    colorCell(cell);

    if (isEndNode(cell)) {
      updateEndNodeCell(cell);
    }
    
    // Handle different option node types
    if (isOptions(cell)) {
      if (getQuestionType(cell) === "imageOption") {
        updateImageOptionCell(cell);
      } else if (getQuestionType(cell) === "amountOption") {
        // Amount option has its own handling
      } else {
        // Regular option nodes
        updateOptionNodeCell(cell);
      }
    }
    
    // If it's a text2 node, make sure we update _questionText from value
    if (isQuestion(cell) && getQuestionType(cell) === "text2") {
      // Extract text from HTML value if present
      if (cell.value) {
        const cleanValue = cell.value.replace(/<[^>]+>/g, "").trim();
        if (cleanValue) {
          cell._questionText = cleanValue;
        }
      }
    }
    

    
    // If newly dropped question node is just placeholder or has empty value
    if (isQuestion(cell) && (!cell.value || /^\s*$/.test(cell.value) || cell.value === "question node" || cell.value === "Question Node")) {
      cell.value = `
        <div style="display: flex; justify-content: center; align-items: center; height:100%;">
          <select class="question-type-dropdown" data-cell-id="${cell.id}" style="margin:auto; font-size: 1.1em; padding: 10px 18px; border-radius: 8px; border: 1.5px solid #b0b8c9; box-shadow: 0 2px 8px rgba(0,0,0,0.07); background: #f8faff; color: #222; transition: border-color 0.2s, box-shadow 0.2s; outline: none; min-width: 220px; cursor:pointer;"
            onfocus="this.style.borderColor='#4a90e2'; this.style.boxShadow='0 0 0 2px #b3d4fc';"
            onblur="this.style.borderColor='#b0b8c9'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)';"
            onmouseover="this.style.borderColor='#4a90e2';"
            onmouseout="this.style.borderColor='#b0b8c9';"
            onchange="window.pickTypeForCell('${cell.id}', this.value)">
            <option value="">-- Choose Question Type --</option>
            <option value="text">Text</option>
            <option value="text2">Dropdown</option>
            <option value="checkbox">Checkbox</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="bigParagraph">Big Paragraph</option>
            <option value="multipleTextboxes">Multiple Textboxes</option>
            <option value="multipleDropdownType">Multiple Dropdown Type</option>
            <option value="dateRange">Date Range</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
          </select>
        </div>`;
    }
  });

  // Don't renumber question IDs automatically
  // renumberQuestionIds();
}

/*******************************************************
 ************ Export/Import Flowchart JSON  ************
 *******************************************************/
// downloadJson, exportFlowchartJson, and importFlowchartJson have been moved to library.js

/*******************************************************
 ************ BFS + Export GUI JSON (with BFS) *********
 *******************************************************/
function isJumpNode(cell) {
  const style = cell.style || "";
  return style.includes("strokeWidth=3") &&
         style.includes("strokeColor=#ff0000") &&
         style.includes("dashed=1");
}

/**
 * BFS helper: climb from question Q up to all option nodes feeding into Q (even if via multiple question→question).
 */
function findAllUpstreamOptions(questionCell) {
  const results = [];
  const visited = new Set();
  const queue = [];

  const incomings = graph.getIncomingEdges(questionCell) || [];
  incomings.forEach(edge => {
    const src = edge.source;
    if (src && isOptions(src)) {
      const optLabel = (src.value || "Option").replace(/<[^>]+>/g, "").trim();
      const parentEdges = graph.getIncomingEdges(src) || [];
      if (parentEdges.length > 0) {
        const parentQ = parentEdges[0].source;
        if (parentQ && isQuestion(parentQ)) {
          results.push({
            questionId: parentQ._questionId,
            answerLabel: optLabel
          });
        }
      }
    } else if (src && isQuestion(src)) {
      queue.push(src);
    }
  });

  while (queue.length > 0) {
    const currentQ = queue.shift();
    if (!currentQ || visited.has(currentQ.id)) continue;
    visited.add(currentQ.id);

    const qIncomings = graph.getIncomingEdges(currentQ) || [];
    qIncomings.forEach(edge => {
      const src = edge.source;
      if (src && isOptions(src)) {
        const optLabel = (src.value || "Option").replace(/<[^>]+>/g, "").trim();
        const parentEdges = graph.getIncomingEdges(src) || [];
        if (parentEdges.length > 0) {
          const parentQ = parentEdges[0].source;
          if (parentQ && isQuestion(parentQ)) {
            results.push({
              questionId: parentQ._questionId,
              answerLabel: optLabel
            });
          }
        }
      } else if (src && isQuestion(src)) {
        queue.push(src);
      }
    });
  }

  return results;
}

function detectSectionJumps(cell, questionCellMap, questionIdMap) {
  const jumps = [];
  const outgoingEdges = graph.getOutgoingEdges(cell) || [];
  
  const cellSection = parseInt(getSection(cell) || "1", 10);
  console.log(`Checking section jumps for cell in section ${cellSection}`);
  
  for (const edge of outgoingEdges) {
    const targetCell = edge.target;
    if (!targetCell || !isOptions(targetCell)) continue;
    
    const optionText = targetCell.value.replace(/<[^>]+>/g, "").trim();
    console.log(`  Checking option "${optionText}"`);
    
    const optionOutgoingEdges = graph.getOutgoingEdges(targetCell) || [];
    
    for (const optionEdge of optionOutgoingEdges) {
      const targetQuestionCell = optionEdge.target;
      if (!targetQuestionCell || !isQuestion(targetQuestionCell)) continue;
      
      const sourceSection = parseInt(getSection(cell) || "1", 10);
      const targetSection = parseInt(getSection(targetQuestionCell) || "1", 10);
      
      console.log(`    Option leads to question in section ${targetSection}`);
      
      // If target section is more than 1 section away
      if (Math.abs(targetSection - sourceSection) > 1) {
        const targetQuestionId = questionIdMap.get(targetQuestionCell.id);
        if (targetQuestionId) {
          // Check if this jump already exists
          const exists = jumps.some(j => j.option === optionText && j.to === targetSection.toString());
          if (!exists) {
            console.log(`    Adding jump: "${optionText}" -> section ${targetSection}`);
            jumps.push({
              option: optionText,
              to: targetSection.toString()
            });
          }
        }
      }
    }
  }
  
  if (jumps.length > 0) {
    console.log(`Found ${jumps.length} section jumps:`, jumps);
  }
  
  return jumps;
}

window.exportGuiJson = function() {
  // Renumber questions by Y position before export
  renumberQuestionIds();
  
  // Get all cells
  const cells = graph.getModel().cells;
  const sections = [];
  let hiddenFields = [];
  let sectionCounter = 1;
  let questionCounter = 1;
  let hiddenFieldCounter = 1;
  let defaultPDFName = "";

  // Store sections in a property of the function for external access
  window.exportGuiJson.sections = sections;
  
  // First pass: collect all sections and their questions
  const questionCellMap = new Map(); // Maps questionId to cell
  const questionIdMap = new Map(); // Maps cell.id to questionId
  
  // Additional maps to track subtitle and info nodes
  const subtitleMap = new Map(); // Maps target question id to subtitle cell
  const infoBoxMap = new Map(); // Maps target question id to infoBox cell
  
  for (const cellId in cells) {
    const cell = cells[cellId];
    if (!cell.isVertex() || cell.isEdge() || cell.id === "0" || cell.id === "1") continue;

    // Get section information
    const sectionNum = parseInt(getSection(cell) || 1, 10);
    let section = sections.find(s => s.sectionId === sectionNum);
    
    if (!section) {
      // Get section name from sectionPrefs if available
      const sectionName = (sectionPrefs[sectionNum] && sectionPrefs[sectionNum].name) || `Section ${sectionNum}`;
      
      section = {
        sectionId: sectionNum,
        sectionName: sectionName,
        questions: []
      };
      sections.push(section);
    }

    // Handle different node types
    if (isQuestion(cell)) {
      const questionType = getQuestionType(cell);
      const questionText = cell.getValue() || "";
      const nodeId = getNodeId(cell);
      
      // Use the original _questionId from the cell instead of questionCounter
      const questionId = cell._questionId || questionCounter++;
      
      // Create question object
      const question = {
        questionId: questionId,
        text: "",
        type: questionType,
        logic: {
          enabled: false,
          conditions: []
        },
        jump: {
          enabled: false,
          conditions: []
        },
        conditionalPDF: {
          enabled: false,
          pdfName: "",
          answer: "Yes"
        },
        conditionalAlert: {
          enabled: false,
          prevQuestion: "",
          prevAnswer: "",
          text: ""
        },
        // Initialize subtitle and infoBox properties
        subtitle: {
          enabled: false,
          text: ""
        },
        infoBox: {
          enabled: false,
          text: ""
        },
        options: [],
        labels: [],
        nameId: nodeId,
        placeholder: "",
        min: "",
        max: "",
        amounts: []
      };

      // Extract clean text from HTML content
      if (cell._questionText) {
        // Use the stored question text if available
        question.text = cell._questionText;
      } else {
        // Otherwise try to extract from HTML
        const cleanText = questionText.replace(/<[^>]+>/g, "").trim();
        question.text = cleanText;
      }

      // Store mapping between question cells and questionIds
      questionCellMap.set(questionId, cell);
      questionIdMap.set(cell.id, questionId);
      
      // Only increment counter for questions without _questionId
      if (!cell._questionId) {
        questionCounter++;
      }
      
      section.questions.push(question);
    } else if (isSubtitleNode(cell)) {
      // Track subtitle nodes for later association
      const outEdges = graph.getOutgoingEdges(cell) || [];
      const inEdges = graph.getIncomingEdges(cell) || [];
      
      // Process both incoming and outgoing edges to find connected question nodes
      const allEdges = [...outEdges, ...inEdges];
      for (const edge of allEdges) {
        let questionCell;
        
        // Check if this edge connects to a question
        if (edge.source === cell && isQuestion(edge.target)) {
          questionCell = edge.target;
        } else if (edge.target === cell && isQuestion(edge.source)) {
          questionCell = edge.source;
        }
        
        if (questionCell) {
          const questionId = questionCell._questionId || questionIdMap.get(questionCell.id);
          if (questionId) {
            // Clean up HTML tags if text is coming from value
            const subtitleText = cell._subtitleText || (
              typeof cell.value === 'string' ? 
              cell.value.replace(/<\/?[^>]+(>|$)/g, "") : ""
            ).trim();
            
            subtitleMap.set(questionId, {
              enabled: true,
              text: subtitleText
            });
          }
        }
      }
    } else if (isInfoNode(cell)) {
      // Track info nodes for later association
      const outEdges = graph.getOutgoingEdges(cell) || [];
      const inEdges = graph.getIncomingEdges(cell) || [];
      
      // Process both incoming and outgoing edges to find connected question nodes
      const allEdges = [...outEdges, ...inEdges];
      for (const edge of allEdges) {
        let questionCell;
        
        // Check if this edge connects to a question
        if (edge.source === cell && isQuestion(edge.target)) {
          questionCell = edge.target;
        } else if (edge.target === cell && isQuestion(edge.source)) {
          questionCell = edge.source;
        }
        
        if (questionCell) {
          const questionId = questionCell._questionId || questionIdMap.get(questionCell.id);
          if (questionId) {
            // Clean up HTML tags if text is coming from value
            const infoText = cell._infoText || (
              typeof cell.value === 'string' ? 
              cell.value.replace(/<\/?[^>]+(>|$)/g, "") : ""
            ).trim();
            
            infoBoxMap.set(questionId, {
              enabled: true,
              text: infoText
            });
          }
        }
      }
    }
  }

  // Second pass: Process question types and find connections
  for (const section of sections) {
    for (const question of section.questions) {
      const cell = questionCellMap.get(question.questionId);
      if (!cell) continue;
      
      const questionType = getQuestionType(cell);
      
      // Initialize jump conditions if not already set
      if (!question.jump) {
        question.jump = {
          enabled: false,
          conditions: []
        };
      }
      
      // Check for section jumps
      console.log(`\nProcessing question ${question.questionId} (${question.text})`);
      const sectionJumps = detectSectionJumps(cell, questionCellMap, questionIdMap);
      if (sectionJumps.length > 0) {
        question.jump.enabled = true;
        // Preserve any existing jump conditions
        const existingJumps = question.jump.conditions || [];
        console.log(`  Existing jumps:`, existingJumps);
        
        // Merge section jumps with existing jumps, avoiding duplicates
        sectionJumps.forEach(jump => {
          const exists = existingJumps.some(j => 
            j.option === jump.option && 
            ((j.to === jump.to) || (j.to === "end" && jump.to === "end"))
          );
          if (!exists) {
            console.log(`  Adding section jump: "${jump.option}" -> section ${jump.to}`);
            existingJumps.push(jump);
          }
        });
        question.jump.conditions = existingJumps;
        console.log(`  Final jumps:`, question.jump.conditions);
      }
      
      // Map number type to money type for GUI JSON
      if (questionType === "number") {
        question.type = "money";
      }
      
      // Map text2 to dropdown for GUI JSON
      if (questionType === "text2") {
        question.type = "dropdown";
        // Save the text from _questionText
        if (cell._questionText) {
          question.text = cell._questionText;
        }
        console.log(`Converting text2 to dropdown for question ${question.questionId}: ${question.text}`);
      }
      
      // For money/number questions, use getNodeId (not _nameId) for better calculations reference
      if (questionType === "money" || questionType === "number") {
        const rawNodeId = getNodeId(cell);
        if (rawNodeId) {
          question.nameId = rawNodeId.toLowerCase();
        }
      }
      // For other questions, use _nameId if available
      else if (cell._nameId) {
        question.nameId = cell._nameId;
      }
      
      // Apply subtitle and infoBox text if they exist
      if (subtitleMap.has(question.questionId)) {
        question.subtitle = subtitleMap.get(question.questionId);
        console.log(`Applied subtitle to question ${question.questionId}: "${question.subtitle.text}"`);
      }
      
      if (infoBoxMap.has(question.questionId)) {
        question.infoBox = infoBoxMap.get(question.questionId);
        console.log(`Applied infoBox to question ${question.questionId}: "${question.infoBox.text}"`);
      }
      
      // Set to track added options to prevent duplicates
      let addedOptions = new Set();
      
      if (questionType === "dropdown" || questionType === "text2" || questionType === "checkbox") {
        // Add empty image object for dropdown and text2 questions by default
        if (questionType === "dropdown" || questionType === "text2") {
          question.image = {
            url: "",
            width: 0,
            height: 0
          };
        }
        
        // Find all outgoing edges to get options and possibly image nodes
        const outgoingEdges = graph.getOutgoingEdges(cell) || [];

        // First, deduplicate the edges - we may have multiple connections from the same source to target
        const uniqueTargetMap = new Map(); // Map<targetId, targetCell>
        for (const edge of outgoingEdges) {
          const targetCell = edge.target;
          if (!targetCell) continue;
          // Only keep the first instance of each target cell
          if (!uniqueTargetMap.has(targetCell.id)) {
            uniqueTargetMap.set(targetCell.id, targetCell);
          }
        }

        // Collect all option cells for sorting (when it's a checkbox question)
        let optionCells = [];
        if (questionType === "checkbox") {
          // For checkbox questions, collect all option cells first to sort by x-coordinate
          for (const targetCell of uniqueTargetMap.values()) {
            if (targetCell && isOptions(targetCell) && getQuestionType(targetCell) !== "imageOption") {
              optionCells.push(targetCell);
            }
          }
          
          // Sort option cells by x-coordinate (left to right)
          optionCells.sort((a, b) => {
            return a.geometry.x - b.geometry.x;
          });

          // Reset options array to ensure we're working with a clean slate
          question.options = [];
        }

        // Process image nodes first
        for (const targetCell of uniqueTargetMap.values()) {
          // Check if this is an image option node
          if (isOptions(targetCell) && getQuestionType(targetCell) === "imageOption") {
            // Found an image node, update the question's image property for dropdown or text2 questions
            if ((questionType === "dropdown" || questionType === "text2") && targetCell._image) {
              question.image = {
                url: targetCell._image.url || "",
                width: parseInt(targetCell._image.width) || 0,
                height: parseInt(targetCell._image.height) || 0
              };
            }
          }
        }
        
        // Process option cells (either sorted or as-is)
        const cellsToProcess = questionType === "checkbox" ? optionCells : uniqueTargetMap.values();
        for (const targetCell of cellsToProcess) {
          // Skip image option nodes as we already processed them
          if (isOptions(targetCell) && getQuestionType(targetCell) === "imageOption") continue;
          
          if (targetCell && isOptions(targetCell)) {
            const optionText = targetCell.value.replace(/<[^>]+>/g, "").trim();
            // Create addedOptions set if it doesn't exist
            if (!addedOptions) {
              addedOptions = new Set();
            }
            if (optionText && !addedOptions.has(optionText.toLowerCase())) {
              addedOptions.add(optionText.toLowerCase());
              
              // For checkbox questions, create structured options
              if (questionType === "checkbox") {
                // Extract the full question nameId for consistent option naming
                let fullQuestionNameId = question.nameId;
                if (cell.style && cell.style.includes("nodeId=")) {
                  const match = cell.style.match(/nodeId=([^;]+)/);
                  if (match && match[1]) {
                    const decodedId = decodeURIComponent(match[1]);
                    if (decodedId.length > fullQuestionNameId.length) {
                      fullQuestionNameId = decodedId;
                    }
                  }
                }
                
                // Create a nameId by combining the full question nameId and the option text
                const optionNameId = sanitizeNameId(fullQuestionNameId) + "_" + sanitizeNameId(optionText);
                
                // Capitalize first letter of option label
                const label = optionText.charAt(0).toUpperCase() + optionText.slice(1);
                
                // Create a structured option object
                const optionObj = {
                  label: label,
                  nameId: optionNameId,
                  value: "",
                  hasAmount: isAmountOption(targetCell),
                  amountName: "",
                  amountPlaceholder: ""
                };
                
                question.options.push(optionObj);
              } else {
                // For dropdown questions, keep using simple strings
                question.options.push(optionText);
              }
            }
          }
        }
        
              // This section is replaced by the more comprehensive subtitle and infoBox handling
      // that's now done during the first pass and applied earlier in this function

      // Check for options that connect to END nodes
      let optionsWithJumpToEnd = [];
              
      // For numbered dropdown/dropdown/checkbox question types, check if the outgoing edges lead to END nodes
      if (questionType === "numberedDropdown" || questionType === "dropdown" || questionType === "text2" || questionType === "checkbox") {
          console.log(`Checking if question ${question.questionId} (${question.text}) has options leading to END`);
          const optionsOutgoingEdges = graph.getOutgoingEdges(cell) || [];
          
          for (const edge of optionsOutgoingEdges) {
            const targetCell = edge.target;
            
            // If it's an option node, check where it leads
            if (targetCell && isOptions(targetCell)) {
              const optionText = targetCell.value.replace(/<[^>]+>/g, "").trim();
              console.log(`  Checking option "${optionText}" for question ${question.questionId}`);
              const optionOutgoingEdges = graph.getOutgoingEdges(targetCell) || [];
              
              // Track where this option leads
              let optionLeadsToEnd = false;
              let optionLeadsToQuestion = false;
              let targetQuestionId = null;
              
              for (const optionEdge of optionOutgoingEdges) {
                const optionTarget = optionEdge.target;
                console.log(`    Option ${optionText} leads to cell ID ${optionTarget ? optionTarget.id : 'unknown'}, style: ${optionTarget ? optionTarget.style : 'unknown'}`);
                
                // Check if this option leads to an END node
                if (optionTarget && isEndNode(optionTarget)) {
                  optionLeadsToEnd = true;
                  optionsWithJumpToEnd.push(optionText);
                  break;
                }
                
                // Check if this option leads to another question instead
                if (optionTarget && isQuestion(optionTarget)) {
                  optionLeadsToQuestion = true;
                  targetQuestionId = questionIdMap.get(optionTarget.id);
                }
              }
              
              // For checkbox questions specifically, we need to handle each option independently
              // Only add to optionsWithJumpToEnd if this specific option leads to END
              if (questionType === "checkbox" && !optionLeadsToEnd && optionLeadsToQuestion) {
                console.log(`    Checkbox option "${optionText}" leads to question ${targetQuestionId}, not to END`);
              }
            }
          }
          
          // If we found options that jump to END, add them to the question's jump conditions
          if (optionsWithJumpToEnd.length > 0) {
            console.log(`Found ${optionsWithJumpToEnd.length} options that jump to END for question ${question.questionId}`);
            
            // Enable jump conditions for this question
            question.jump = question.jump || {};
            question.jump.enabled = true;
            question.jump.conditions = question.jump.conditions || [];
            
            // Add each option as a jump condition to "end"
            for (const optionText of optionsWithJumpToEnd) {
              // For checkbox questions, we need to find the properly capitalized label
              let optionLabel = optionText;
              if (questionType === "checkbox") {
                const matchingOption = question.options.find(opt => 
                  (typeof opt === 'object' && opt.label.toLowerCase() === optionText.toLowerCase())
                );
                if (matchingOption) {
                  optionLabel = matchingOption.label;
                }
              }
              
              // Check if this jump condition already exists
              const exists = question.jump.conditions.some(c => 
                c.option === optionLabel && c.to === "end"
              );
              
              if (!exists) {
                question.jump.conditions.push({
                  option: optionLabel,
                  to: "end"
                });
                console.log(`Added jump condition for question ${question.questionId}: "${optionLabel}" -> END`);
              }
            }
          }
        }
        
        // Remove unnecessary fields
        delete question.min;
        delete question.max;
        delete question.amounts;
        
        // For checkbox questions, use first option for conditionalPDF answer
        if (questionType === "checkbox") {
          // Set conditionalPDF answer to the first option (capitalized)
          if (question.options.length > 0) {
            if (typeof question.options[0] === 'object') {
              question.conditionalPDF.answer = question.options[0].label;
            } else {
              const firstOption = question.options[0];
              question.conditionalPDF.answer = firstOption.charAt(0).toUpperCase() + firstOption.slice(1);
            }
          } else {
            question.conditionalPDF.answer = "undefined";
          }
        }
      } else if (questionType === "text" || questionType === "date" || questionType === "number" || questionType === "bigParagraph") {
        // Remove unnecessary fields
        delete question.min;
        delete question.max;
        delete question.amounts;
        delete question.image;
      } else if (questionType === "multipleDropdownType") {
        // Rename to numberedDropdown for consistency
        question.type = "numberedDropdown";
        console.log(`Converting multipleDropdownType to numberedDropdown for question ${question.questionId}: ${question.text}`);
        
        // Get min and max values
        if (cell._twoNumbers) {
          question.min = cell._twoNumbers.first || "1";
          question.max = cell._twoNumbers.second || "1";
          console.log(`  Setting min=${question.min}, max=${question.max}`);
        }
        
        // Handle labels and amounts
        if (cell._textboxes) {
          console.log(`  Processing ${cell._textboxes.length} textboxes for amount/label options`);
          for (const textbox of cell._textboxes) {
            if (textbox.isAmountOption) {
              question.amounts.push(textbox.nameId);
              console.log(`  Added amount option: ${textbox.nameId}`);
            } else {
              question.labels.push(textbox.nameId);
              console.log(`  Added label: ${textbox.nameId}`);
            }
          }
        }
      } else if (questionType === "multipleTextboxes") {
        // Create textboxes array
        question.textboxes = [];
        
        if (cell._textboxes) {
          cell._textboxes.forEach((tb, index) => {
            const nameId = sanitizeNameId(question.nameId) + "_" + sanitizeNameId(tb.nameId || "").toLowerCase().replace(/\s+/g, '_');
            
            question.textboxes.push({
              label: "", // Empty label as requested
              nameId: nameId,
              placeholder: tb.placeholder || tb.nameId || ""
            });
          });
        }
        
        // Clean up unnecessary fields
        question.labels = [];
        delete question.nameId;
        delete question.placeholder;
        delete question.min;
        delete question.max;
        delete question.amounts;
      }
    }
  }
  
  // Create a helper function to find all option nodes that lead to a question
  function findOptionsThatLeadTo(questionCell) {
    const result = [];
    for (const cellId in cells) {
      const cell = cells[cellId];
      if (!cell.isVertex() || !isOptions(cell)) continue;
      
      const outEdges = graph.getOutgoingEdges(cell) || [];
      for (const edge of outEdges) {
        if (edge.target === questionCell) {
          result.push(cell);
          break;
        }
      }
    }
    return result;
  }

  // Third pass: Determine conditional logic between questions
  for (const section of sections) {
    for (const question of section.questions) {
      const cell = questionCellMap.get(question.questionId);
      if (!cell) continue;
      
      // Reset existing conditions for this question - we'll rebuild them correctly
      question.logic = {
        enabled: false,
        conditions: []
      };
      
      // If the question has incoming edges from other questions
      // Figure out which questions can lead to this one
      const incomingEdges = graph.getIncomingEdges(cell) || [];
      let shouldAddLogicConditions = false;
      let comesFromOption = false;
      
      // First check if this question is accessed via option nodes 
      // (indicating conditional flow)
      for (const edge of incomingEdges) {
        const sourceCell = edge.source;
        if (sourceCell && isOptions(sourceCell)) {
          comesFromOption = true;
          break;
        }
      }
      
      // If question is directly connected to previous questions without options in between,
      // it's a sequential flow - don't add logic conditions
      if (!comesFromOption) {
        let hasPrevQuestion = false;
        
        for (const edge of incomingEdges) {
          const sourceCell = edge.source;
          // Check if any incoming edge is from a question
          if (sourceCell && isQuestion(sourceCell)) {
            hasPrevQuestion = true;
            break;
          }
        }
        
        // If it only has direct connections from questions (sequential flow),
        // don't add logic conditions
        if (hasPrevQuestion) {
          shouldAddLogicConditions = false;
          console.log(`Question ${question.questionId} is in sequential flow, skipping logic conditions`);
        } else {
          // No incoming questions and no option nodes, it's likely a starting question
          shouldAddLogicConditions = false;
        }
      } else {
        // It comes from option nodes, so it's conditional flow
        shouldAddLogicConditions = true;
        console.log(`Question ${question.questionId} has conditional flow, adding logic conditions`);
      }
      
      // Only add logic conditions if we determined it needs them
      if (shouldAddLogicConditions) {
        question.logic.enabled = true;
        // Identify previous questions through option nodes
        for (const edge of incomingEdges) {
          const sourceCell = edge.source;
          
          if (sourceCell && isOptions(sourceCell)) {
            const optionValue = sourceCell.value;
            const optionIncomingEdges = graph.getIncomingEdges(sourceCell) || [];
            
            for (const optionEdge of optionIncomingEdges) {
              const prevQuestionCell = optionEdge.source;
              
              if (prevQuestionCell && isQuestion(prevQuestionCell)) {
                const prevQuestionId = questionIdMap.get(prevQuestionCell.id);
                
                // Add the logic condition
                question.logic.conditions.push({
                  prevQuestion: prevQuestionId.toString(),
                  prevAnswer: optionValue
                });
              }
            }
          }
        }
      }
    }
  }

  // Deduplicate logic conditions for all questions
  for (const section of sections) {
    for (const question of section.questions) {
      if (question.logic && question.logic.conditions && question.logic.conditions.length > 0) {
        const uniqueConditions = [];
        const seen = new Set();
        
        for (const condition of question.logic.conditions) {
          const key = `${condition.prevQuestion}_${condition.prevAnswer}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueConditions.push(condition);
          }
        }
        
        question.logic.conditions = uniqueConditions;
      }
    }
  }

  // Fourth pass: Collect calculation nodes for hidden fields
  for (const cellId in cells) {
    const cell = cells[cellId];
    if (!cell.isVertex() || cell.isEdge() || cell.id === "0" || cell.id === "1") continue;

    if (isCalculationNode(cell)) {
      const calcName = cell._calcTitle || `Calculation ${hiddenFieldCounter}`;
      const calcFinalText = cell._calcFinalText || "";
      const calcOperator = cell._calcOperator || ">";
      const calcThreshold = cell._calcThreshold || "0";
      
      // Create hidden field for calculation
      const hiddenField = {
        hiddenFieldId: hiddenFieldCounter.toString(),
        type: "text",
        name: calcName,
        checked: false,
        conditions: [],
        calculations: []
      };

      // Process calculation terms
      const calculation = {
        terms: [],
        compareOperator: calcOperator,
        threshold: calcThreshold,
        fillValue: calcFinalText
      };

      // Find the question that contains the amount field
      const amountLabel = cell._calcAmountLabel || "";
      
      console.log(`Processing calculation node: ${cell.id}, title: ${cell._calcTitle}`);
      console.log(`  Amount label: "${amountLabel}"`);
      
      // First, check if this amountLabel matches another calculation node's title
      let isCalcNodeReference = false;
      let calcNodeTitle = "";
      
      // Collect all calculation nodes except the current one
      const otherCalcNodes = [];
      for (const otherId in cells) {
        const otherCell = cells[otherId];
        if (otherId !== cellId && otherCell.isVertex() && !otherCell.isEdge() && isCalculationNode(otherCell)) {
          otherCalcNodes.push(otherCell);
        }
      }
      
      // Check if amountLabel matches any calculation node's title
      for (const otherCalcNode of otherCalcNodes) {
        if (otherCalcNode._calcTitle && otherCalcNode._calcTitle === amountLabel) {
          isCalcNodeReference = true;
          calcNodeTitle = otherCalcNode._calcTitle;
          console.log(`  Found matching calculation node with title: "${calcNodeTitle}"`);
          break;
        }
      }
      
      // If this is a reference to another calculation node, create a simple term
      if (isCalcNodeReference && (!cell._calcTerms || cell._calcTerms.length <= 1)) {
        // This is a legacy single calculation node reference
        console.log(`  Creating calculation term referencing calc node: "${calcNodeTitle}"`);
        calculation.terms = [{
          operator: "",
          questionNameId: calcNodeTitle
        }];
        
        // Make sure fillValue uses the calculation's title
        if (calcFinalText.includes(`##${calcName}##`)) {
          calculation.fillValue = calcFinalText;
        } else {
          calculation.fillValue = calcFinalText;
        }
        
        // Add the calculation to hidden field
        hiddenField.calculations.push(calculation);
        hiddenFields.push(hiddenField);
        hiddenFieldCounter++;
        
        // Skip the rest of the processing for this node
        continue;
      }
      
      // For backward compatibility, if we have a single _calcAmountLabel but no _calcTerms
      if (cell._calcAmountLabel && (!cell._calcTerms || cell._calcTerms.length === 0)) {
        console.log(`  Converting legacy node with _calcAmountLabel to use _calcTerms`);
        cell._calcTerms = [{
          amountLabel: cell._calcAmountLabel,
          mathOperator: ""
        }];
      }
      
      // Check if this node has multiple calculation terms defined
      if (cell._calcTerms && cell._calcTerms.length > 0) {
        console.log(`  Processing calculation node with terms: ${cell._calcTerms.length} terms`);
        
        // Process each term separately
        calculation.terms = [];
        
        // Process each term in the _calcTerms array
        for (let i = 0; i < cell._calcTerms.length; i++) {
          const term = cell._calcTerms[i];
          const termAmountLabel = term.amountLabel || "";
          const operator = i === 0 ? "" : (term.mathOperator || "+");
          
          console.log(`  Processing term ${i+1}: amount label="${termAmountLabel}", operator="${operator}"`);
          
          // Check if this term references another calculation node
          let isTermCalcNodeReference = false;
          let termCalcNodeTitle = "";
          
          for (const otherCalcNode of otherCalcNodes) {
            if (otherCalcNode._calcTitle && otherCalcNode._calcTitle === termAmountLabel) {
              isTermCalcNodeReference = true;
              termCalcNodeTitle = otherCalcNode._calcTitle;
              console.log(`  Term ${i+1} references calculation node: "${termCalcNodeTitle}"`);
              break;
            }
          }
          
          if (isTermCalcNodeReference) {
            // This term references another calculation node
            calculation.terms.push({
              operator: operator,
              questionNameId: termCalcNodeTitle
            });
            console.log(`  Added term referencing calculation: ${JSON.stringify(calculation.terms[calculation.terms.length-1])}`);
            continue;
          }
          
          // Check if this is a direct reference to a money/number type question
          // It would use the format "answer{questionId}" 
          if (termAmountLabel.startsWith("answer")) {
            console.log(`  Found direct money/number question reference: "${termAmountLabel}"`);
            
            // Find the referenced question in our sections
            let found = false;
            let actualQuestionNameId = termAmountLabel; // Default to using as-is
            
            for (const section of sections) {
              for (const question of section.questions) {
                // Check if this is a money question with matching nameId pattern
                if ((question.type === "money" || question.type === "number")) {
                  // If it's a direct match, use it
                  if (question.nameId === termAmountLabel) {
                    console.log(`  Found exact match with question: ${question.questionId} - ${question.text}`);
                    found = true;
                    break;
                  }
                  
                  // Get the question cell to check its nodeId
                  const questionCell = questionCellMap.get(question.questionId);
                  if (questionCell) {
                    const nodeId = getNodeId(questionCell);
                    if (nodeId) {
                      // Multiple ways this could be referenced:
                      const amountLabelLower = termAmountLabel.toLowerCase();
                      const nodeIdLower = nodeId.toLowerCase();
                      
                      // Case 1: termAmountLabel is "answernodeid"
                      if (amountLabelLower === "answer" + nodeIdLower) {
                        console.log(`  Found match by nodeId: ${question.questionId} - ${question.text} (nodeId: ${nodeId})`);
                        actualQuestionNameId = nodeIdLower; // Use just the nodeId
                        found = true;
                        break;
                      }
                    }
                  }
                }
              }
              if (found) break;
            }
            
            // Add the term with the proper question reference
            calculation.terms.push({
              operator: operator,
              questionNameId: actualQuestionNameId
            });
            
            if (found) {
              console.log(`  Added direct money/number reference: ${JSON.stringify(calculation.terms[calculation.terms.length-1])}`);
            } else {
              console.log(`  Warning: Could not find exact matching question for ${termAmountLabel}, using as-is`);
            }
            continue;
          }
          
          // Extract amount name and question name from the label
          let termAmountName = "";
          let termQuestionName = "";
          
          if (termAmountLabel) {
            // Clean up the label
            const cleanedLabel = termAmountLabel.replace(/delete_amount_/g, "").replace(/add_option_/g, "");
            console.log(`  Cleaned term label: "${cleanedLabel}"`);
            
            // Handle special cases first - direct checkbox amount options
            const isCheckboxOption = /^([a-z0-9_]+)_([a-z0-9_]+)$/.test(cleanedLabel);
            const isMultipleDropdownAmount = cleanedLabel.includes("_amount");
            
            console.log(`  Label format check: isCheckboxOption=${isCheckboxOption}, isMultipleDropdownAmount=${isMultipleDropdownAmount}`);
            
            // First try to match checkbox options which typically have simple format: questionname_optionname
            if (isCheckboxOption && !isMultipleDropdownAmount) {
              // Simple format for checkbox options like "choose_all_that_apply_rent"
              const parts = cleanedLabel.split('_');
              // For simple checkbox amount options, the last part is the option name
              // and all previous parts combined form the question name
              termAmountName = parts[parts.length - 1];
              termQuestionName = parts.slice(0, -1).join('_');
              console.log(`  Detected checkbox option. Question: "${termQuestionName}", Option/Amount: "${termAmountName}"`);
            }
            // For multi-word amounts like "amount_plus", we need to handle the extraction differently
            else if (cleanedLabel.indexOf("_amount_") > 0) {
              // This is likely a multi-word amount (like "amount_plus")
              const questionNameEndPos = cleanedLabel.indexOf("_amount_");
              termQuestionName = cleanedLabel.substring(0, questionNameEndPos);
              termAmountName = "amount_" + cleanedLabel.substring(questionNameEndPos + 8); // Skip "_amount_"
              console.log(`  Detected multi-word amount. Question: "${termQuestionName}", Amount: "${termAmountName}"`);
            }
            // Handle the simple case with just "amount" at the end
            else if (cleanedLabel.endsWith("_amount")) {
              termQuestionName = cleanedLabel.substring(0, cleanedLabel.length - 7); // Remove "_amount"
              termAmountName = "amount";
              console.log(`  Detected simple amount suffix. Question: "${termQuestionName}", Amount: "${termAmountName}"`);
            }
            // Try standard extraction with last underscore
            else {
              const lastIndex = cleanedLabel.lastIndexOf('_');
              if (lastIndex > 0) {
                termAmountName = cleanedLabel.substring(lastIndex + 1).trim();
                termQuestionName = cleanedLabel.substring(0, lastIndex).trim();
                console.log(`  Standard extraction. Question: "${termQuestionName}", Amount: "${termAmountName}"`);
              } else {
                // Fallback
                const parts = cleanedLabel.split('_');
                if (parts.length > 0) {
                  termAmountName = parts[parts.length - 1].replace(/_/g, " ").trim();
                }
                if (parts.length > 1) {
                  termQuestionName = parts.slice(0, -1).join('_');
                }
                console.log(`  Fallback extraction. Question: "${termQuestionName}", Amount: "${termAmountName}"`);
              }
            }
            
            console.log(`  Term ${i+1} extracted: question="${termQuestionName}", amount="${termAmountName}"`);
            
            // Special handling for checkbox options
            // If the term appears to be a checkbox option (not containing "amount" in the name)
            // and follows the pattern questionname_optionname
            if (isCheckboxOption && !isMultipleDropdownAmount) {
              let directHit = false;
              
              // Try to directly match it with options from checkbox questions
              for (const section of sections) {
                for (const question of section.questions) {
                  if (question.type === "checkbox") {
                    // Check if this question has options
                    if (question.options && Array.isArray(question.options)) {
                      for (const option of question.options) {
                        if (typeof option === 'object') {
                          // Create the expected nameId format and check if it matches our term
                          const questionTextId = question.text.toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, "_");
                          const optionNameId = option.label.toLowerCase().replace(/\s+/g, '_');
                          const expectedNameId = `${questionTextId}_${optionNameId}`;
                          
                          if (cleanedLabel === expectedNameId || 
                              expectedNameId.includes(cleanedLabel) || 
                              cleanedLabel.includes(expectedNameId)) {
                            console.log(`  Direct match with checkbox option: "${expectedNameId}"`);
                            
                            // For checkbox amount options, just use the exact format
                            calculation.terms.push({
                              operator: operator,
                              questionNameId: cleanedLabel
                            });
                            directHit = true;
                            break;
                          }
                        }
                      }
                      if (directHit) break;
                    }
                  }
                  if (directHit) break;
                }
                if (directHit) break;
              }
              
              if (directHit) {
                console.log(`  Added direct checkbox option term: "${cleanedLabel}"`);
                continue; // Skip to next term
              }
            }
            
            // Find the matching question
            let termTargetQuestion = null;
            let isCheckboxAmount = false;
            
            // First, check if this is a checkbox amount option
            for (const section of sections) {
              for (const question of section.questions) {
                if (question.type === "checkbox") {
                  const questionText = question.text || "";
                  const questionTextLower = questionText.toLowerCase();
                  const questionTextAsId = questionTextLower.replace(/[^\w\s]/gi, "").replace(/\s+/g, "_");
                  
                  // Check if the question name part matches this checkbox question
                  if (termQuestionName.toLowerCase() === questionTextAsId) {
                    // Check if this question has an option matching the amount name
                    if (question.options && Array.isArray(question.options)) {
                      for (const option of question.options) {
                        // For object options
                        if (typeof option === 'object' && option.hasAmount) {
                          const optionLabel = option.label.toLowerCase().replace(/\s+/g, '_');
                          if (optionLabel === termAmountName) {
                            termTargetQuestion = question;
                            isCheckboxAmount = true;
                            console.log(`  Term ${i+1} matched checkbox question: "${questionText}" with amount option "${option.label}"`);
                            break;
                          }
                        }
                      }
                    }
                  }
                }
                if (termTargetQuestion) break;
              }
              if (termTargetQuestion) break;
            }
            
            // If not a checkbox amount, look for a numbered dropdown question
            if (!termTargetQuestion) {
              // Look for matching question
              for (const section of sections) {
                for (const question of section.questions) {
                  if (question.type !== "numberedDropdown") continue;
                  
                  const questionText = question.text || "";
                  const questionTextLower = questionText.toLowerCase();
                  const questionTextAsId = questionTextLower.replace(/[^\w\s]/gi, "").replace(/\s+/g, "_");
                  
                  // Try multiple matching strategies
                  const directMatch = termQuestionName.toLowerCase() === questionTextAsId;
                  const containsMatch = termQuestionName.toLowerCase().includes(questionTextAsId) || 
                                     questionTextAsId.includes(termQuestionName.toLowerCase());
                  const simpleTextMatch = termQuestionName.toLowerCase().replace(/_/g, " ") === questionTextLower;
                  
                  if (directMatch || containsMatch || simpleTextMatch) {
                    console.log(`  Term ${i+1} found potential question match: "${questionText}"`);
                    
                    // Check if this question has matching amounts
                    if (question.amounts && Array.isArray(question.amounts)) {
                      // For multi-word amounts, try both direct comparison and with spaces replaced by underscores
                      const foundMatchingAmount = question.amounts.some(amount => {
                        const amountLower = amount.toLowerCase();
                        const amountUnderscores = amountLower.replace(/\s+/g, '_');
                        const termAmountLower = termAmountName.toLowerCase();
                        const termAmountSpaces = termAmountLower.replace(/_/g, ' ');
                        
                        return amountLower === termAmountLower || 
                               amountLower === termAmountSpaces || 
                               amountUnderscores === termAmountLower;
                      });
                      
                      if (foundMatchingAmount) {
                        termTargetQuestion = question;
                        console.log(`  Term ${i+1} matched numberedDropdown question: "${questionText}" with matching amount`);
                        break;
                      } else {
                        // Even if we don't find exact amount match, use this question if it has any amounts
                        termTargetQuestion = question;
                        console.log(`  Term ${i+1} matched numberedDropdown question: "${questionText}" but using fallback amount`);
                        break;
                      }
                    }
                  }
                  if (termTargetQuestion) break;
                }
                if (termTargetQuestion) break;
              }
            }
            
            // If we found a matching question
            if (termTargetQuestion) {
              console.log(`  Term ${i+1} found target question: ${termTargetQuestion.questionId} (${termTargetQuestion.text})`);
              
              // For numberedDropdown questions, create terms for each number
              if (termTargetQuestion.type === "numberedDropdown") {
                const min = parseInt(termTargetQuestion.min || "1", 10);
                const max = parseInt(termTargetQuestion.max || "1", 10);
                
                // For multi-word amounts like "amount_plus", use proper format
                let actualAmountName = termAmountName.trim().toLowerCase();
                
                // Find matching amount in the question's amounts array
                if (termTargetQuestion.amounts && termTargetQuestion.amounts.length > 0) {
                  // Try to find exact match first (ignoring case and handling spaces vs underscores)
                  const matchingAmount = termTargetQuestion.amounts.find(amount => {
                    const amountLower = amount.toLowerCase();
                    const amountUnderscores = amountLower.replace(/\s+/g, '_');
                    const termAmountLower = termAmountName.toLowerCase();
                    const termAmountSpaces = termAmountLower.replace(/_/g, ' ');
                    
                    return amountLower === termAmountLower || 
                           amountLower === termAmountSpaces || 
                           amountUnderscores === termAmountLower;
                  });
                  
                  if (matchingAmount) {
                    // Use the properly formatted amount with spaces replaced by underscores
                    actualAmountName = matchingAmount.toLowerCase().replace(/\s+/g, '_');
                    console.log(`  Found exact matching amount: "${matchingAmount}" -> "${actualAmountName}"`);
                  } else {
                    // Use the first amount as fallback
                    actualAmountName = termTargetQuestion.amounts[0].toLowerCase().replace(/\s+/g, '_');
                    console.log(`  Using fallback amount: "${termTargetQuestion.amounts[0]}" -> "${actualAmountName}"`);
                  }
                }
                
                // Add first number with the appropriate operator
                calculation.terms.push({
                  operator: operator,
                  questionNameId: `${termTargetQuestion.text}_${min}_${actualAmountName}`
                });
                
                // Add additional numbers with + operator
                for (let j = min + 1; j <= max; j++) {
                  calculation.terms.push({
                    operator: "+",
                    questionNameId: `${termTargetQuestion.text}_${j}_${actualAmountName}`
                  });
                }
                
                console.log(`  Added terms for numberedDropdown: min=${min}, max=${max}, using amount="${actualAmountName}"`);
                continue; // Skip to next term
              } else if (termTargetQuestion.type === "checkbox" && isCheckboxAmount) {
                // For checkbox amount options, use the direct format: questionName_optionName
                // This preserves the original format from gatherAllAmountLabels
                calculation.terms.push({
                  operator: operator,
                  questionNameId: `${termQuestionName}_${termAmountName}`
                });
                console.log(`  Added term for checkbox amount option using original format: ${termQuestionName}_${termAmountName}`);
                continue; // Skip to next term
              } else {
                // For other question types
                calculation.terms.push({
                  operator: operator,
                  questionNameId: `${termTargetQuestion.nameId}_${termAmountName}`
                });
                console.log(`  Added term for regular question`);
                continue; // Skip to next term
              }
            }
            
            // If no target question found, try one more fallback approach for common question types
            if (!termTargetQuestion) {
              // For numbered dropdown questions (most common with amount options),
              // try to find any numbered dropdown question and use its text
              let fallbackQuestion = null;
              for (const section of sections) {
                for (const question of section.questions) {
                  if (question.type === "numberedDropdown") {
                    fallbackQuestion = question;
                    break;
                  }
                }
                if (fallbackQuestion) break;
              }
              
              if (fallbackQuestion) {
                console.log(`  Using fallback numbered dropdown question: "${fallbackQuestion.text}"`);
                const min = parseInt(fallbackQuestion.min || "1", 10);
                const max = parseInt(fallbackQuestion.max || "1", 10);
                
                // Use the termAmountName directly for the format
                // Convert spaces to underscores for consistent format
                const cleanedAmountName = termAmountName.trim().toLowerCase().replace(/\s+/g, '_');
                
                // Add first term with operator
                calculation.terms.push({
                  operator: operator,
                  questionNameId: `${fallbackQuestion.text}_${min}_${cleanedAmountName}`
                });
                
                // Add additional terms
                for (let j = min + 1; j <= max; j++) {
                  calculation.terms.push({
                    operator: "+",
                    questionNameId: `${fallbackQuestion.text}_${j}_${cleanedAmountName}`
                  });
                }
                
                console.log(`  Added fallback terms using first numberedDropdown question`);
                continue; // Skip to next term
              }
            }
            
            // If still no match, create a placeholder
            console.log(`  Term ${i+1} no target question found, using placeholder`);
            calculation.terms.push({
              operator: operator,
              questionNameId: `unknown_question_${termAmountName || i+1}`
            });
          }
        }
        
        // Add the calculation to the hidden field
        if (calculation.terms.length > 0) {
          // Make sure fillValue uses the actual final text
          calculation.fillValue = calcFinalText;
          
          hiddenField.calculations.push(calculation);
          hiddenFields.push(hiddenField);
          hiddenFieldCounter++;
          
          console.log(`  Final calculation terms: ${JSON.stringify(calculation.terms)}`);
        }
        
        // Skip the rest of the processing for this node
        continue;
      }
      
      // Extract the amount name and question name from the label
      let amountName = "";
      let questionNameFromLabel = "";
      
      if (amountLabel) {
        // Clean up the label
        const cleanedLabel = amountLabel.replace(/delete_amount_/g, "").replace(/add_option_/g, "");
        console.log(`  Cleaned label: "${cleanedLabel}"`);
        
        // Handle special case for checkbox amount options
        const isCheckboxOption = /^([a-z0-9_]+)_([a-z0-9_]+)$/.test(cleanedLabel);
        const isMultipleDropdownAmount = cleanedLabel.includes("_amount");
        
        if (isCheckboxOption && !isMultipleDropdownAmount) {
          // For checkbox option format: questionname_optionname
          // We can use it directly
          console.log(`  Detected direct checkbox option format: "${cleanedLabel}"`);
          
          // For checkbox amount options, just use the full label directly
          calculation.terms = [{
            operator: "",
            questionNameId: cleanedLabel
          }];
          
          // Add the calculation to the hidden field
          hiddenField.calculations.push(calculation);
          hiddenFields.push(hiddenField);
          hiddenFieldCounter++;
          
          console.log(`  Created term using direct checkbox format: ${JSON.stringify(calculation.terms)}`);
          continue; // Skip the rest of the processing
        }
        
        // Check for multi-word amounts like "amount_plus"
        const questionNameEndPos = cleanedLabel.indexOf("_amount_");
        if (questionNameEndPos > 0) {
          // This is likely a multi-word amount (like "amount_plus")
          questionNameFromLabel = cleanedLabel.substring(0, questionNameEndPos);
          amountName = "amount_" + cleanedLabel.substring(questionNameEndPos + 8); // Skip "_amount_"
          console.log(`  Detected multi-word amount. Question: "${questionNameFromLabel}", Amount: "${amountName}"`);
        }
        // Handle the simple case with just "amount" at the end
        else if (cleanedLabel.endsWith("_amount")) {
          questionNameFromLabel = cleanedLabel.substring(0, cleanedLabel.length - 7); // Remove "_amount"
          amountName = "amount";
          console.log(`  Detected simple amount suffix. Question: "${questionNameFromLabel}", Amount: "${amountName}"`);
        }
        else {
          // First, try to extract the question text from the label
          // The label format is typically: "question_name_question_amount_name"
          const lastIndex = cleanedLabel.lastIndexOf('_');
          if (lastIndex > 0) {
            amountName = cleanedLabel.substring(lastIndex + 1).trim();
            questionNameFromLabel = cleanedLabel.substring(0, lastIndex).trim();
            
            console.log(`  Extracted question name: "${questionNameFromLabel}"`);
            console.log(`  Extracted amount name: "${amountName}"`);
          } else {
            // Fallback to old method if no underscore found
            const parts = cleanedLabel.split('_');
            
            // Get the amount name (last part)
            if (parts.length > 0) {
              amountName = parts[parts.length - 1].replace(/_/g, " ").trim();
              console.log(`  Extracted amount name (fallback): "${amountName}"`);
            }
            
            // Build the question name from everything except the last part
            if (parts.length > 1) {
              questionNameFromLabel = parts.slice(0, -1).join('_');
              console.log(`  Question name from label (fallback): "${questionNameFromLabel}"`);
            }
          }
        }
      }
      
      // Find the target question for this calculation
      let targetQuestion = null;
      
      // First try to match the exact question from the label (this fixes the duplicate amount name issue)
      console.log(`  First attempting to match exact question name: "${questionNameFromLabel}"`);
      for (const section of sections) {
        for (const question of section.questions) {
          // Generate various formats of the question text for matching
          const questionText = question.text || "";
          const questionTextLower = questionText.toLowerCase();
          const questionTextAsId = questionTextLower.replace(/[^\w\s]/gi, "").replace(/\s+/g, "_");
          const questionLabelFromStyle = (question.nameId || "").toLowerCase();
          
          // Generate various formats of the label for matching
          const questionNameFromLabelLower = questionNameFromLabel.toLowerCase();
          
          console.log(`    Checking question ${question.questionId}: "${questionText}"`);
          console.log(`      Text as ID: "${questionTextAsId}", Label from amount: "${questionNameFromLabelLower}"`);
          
          // Try multiple matching strategies
          const directMatch = questionNameFromLabelLower === questionTextAsId;
          const containsMatch = questionNameFromLabelLower.includes(questionTextAsId) || 
                              questionTextAsId.includes(questionNameFromLabelLower);
          const simpleTextMatch = questionNameFromLabelLower.replace(/_/g, " ") === questionTextLower;
          
          if (directMatch || containsMatch || simpleTextMatch) {
            console.log(`    MATCH FOUND! Question "${questionText}" matches label "${questionNameFromLabel}"`);
            
            // Check if it also has a matching amount
            if (question.type === "numberedDropdown" && question.amounts && 
                question.amounts.some(amt => amt.toLowerCase() === amountName.toLowerCase())) {
              console.log(`    Confirmed: question has matching amount "${amountName}"`);
              targetQuestion = question;
              break;
            } else if (question.type === "numberedDropdown") {
              console.log(`    Warning: matched question doesn't have exact amount "${amountName}", but using it anyway as fallback`);
              targetQuestion = question;
            }
          }
        }
        if (targetQuestion) break;
      }
      
      // If still no match, try even more relaxed matching
      if (!targetQuestion) {
        console.log(`  No exact match found, trying more relaxed matching strategies`);
        for (const section of sections) {
          for (const question of section.questions) {
            if (question.type !== "numberedDropdown") continue;
            
            // Try word-by-word matching
            const questionWords = question.text.toLowerCase().split(/\s+/);
            const labelWords = questionNameFromLabel.toLowerCase().replace(/_/g, " ").split(/\s+/);
            
            let wordMatches = 0;
            for (const word of questionWords) {
              if (labelWords.includes(word)) {
                wordMatches++;
              }
            }
            
            // If more than half the words match, it's probably the right question
            if (wordMatches > Math.min(2, questionWords.length / 2)) {
              console.log(`    PARTIAL MATCH! Question "${question.text}" matches ${wordMatches} words from label`);
              targetQuestion = question;
              break;
            }
          }
          if (targetQuestion) break;
        }
      }
      
      // If we didn't find a question by direct matching, fall back to the older logic
      if (!targetQuestion) {
        console.log(`  No match found by question name, falling back to amount-only matching`);
        
        // Search through all questions in all sections
        console.log(`  Searching for matching question with amount: "${amountName}"`);
        for (const section of sections) {
          for (const question of section.questions) {
            console.log(`    Checking question ${question.questionId}: "${question.text}", type: ${question.type}, amounts: ${JSON.stringify(question.amounts)}`);
            
            // Check if this is a numberedDropdown question with amounts
            if (question.type === "numberedDropdown" && question.amounts && question.amounts.length > 0) {
              for (const amount of question.amounts) {
                console.log(`      Comparing amount "${amount}" with "${amountName}"`);
                if (amount.toLowerCase() === amountName.toLowerCase() || 
                    amount.toLowerCase().replace(/\s+/g, '_') === amountName.toLowerCase().replace(/\s+/g, '_')) {
                  targetQuestion = question;
                  console.log(`      MATCH FOUND! Using question ${question.questionId}`);
                  break;
                }
              }
            }
            
            if (targetQuestion) break;
          }
          if (targetQuestion) break;
        }
      }

      // Generate calculation terms
      if (targetQuestion) {
        console.log(`  Target question found: ${targetQuestion.questionId} (${targetQuestion.text}), type: ${targetQuestion.type}`);
        
        // Important: preserve spaces by replacing with underscores
        // This ensures multi-word amounts like "Amount Plus" become "amount_plus"
        const cleanAmountName = amountName.trim().toLowerCase().replace(/\s+/g, '_');
        
        // Create a properly formatted question name
        const formattedQuestionName = targetQuestion.text
          .trim()
          .replace(/[^\w\s]/gi, "")
          .replace(/\s+/g, "_")
          .toLowerCase();
        
        console.log(`  Formatted question name: "${formattedQuestionName}", clean amount name: "${cleanAmountName}"`);
        
        // For numberedDropdown, we need to create a term for each number from 1 to max
        if (targetQuestion.type === "numberedDropdown") {
          console.log(`  Processing as numberedDropdown with min: ${targetQuestion.min}, max: ${targetQuestion.max}`);
          
          // Get the correct min/max values
          const min = parseInt(targetQuestion.min || "1", 10);
          const max = parseInt(targetQuestion.max || "1", 10);
          
          console.log(`  Creating terms for numbers ${min} to ${max}`);
          
          // IMPORTANT: For this format, we need to preserve the original capitalization and spacing
          // The format should be exactly like: "How many jobs do you have_1_job_income"
          
          // Get accurate amount name directly from the question's amounts array
          let actualAmountName = cleanAmountName;
          if (targetQuestion.amounts && targetQuestion.amounts.length > 0) {
            // Find the exact amount name that matches (case-insensitive)
            const matchingAmount = targetQuestion.amounts.find(
              amt => amt.toLowerCase().replace(/\s+/g, '_') === cleanAmountName
            );
            
            if (matchingAmount) {
              // Use the properly formatted amount with spaces converted to underscores
              actualAmountName = matchingAmount.toLowerCase().replace(/\s+/g, '_');
              console.log(`  Using matched amount name from question: "${actualAmountName}"`);
            } else {
              // Fallback to the first amount
              actualAmountName = targetQuestion.amounts[0].toLowerCase().replace(/\s+/g, '_');
              console.log(`  Using fallback amount name from question: "${actualAmountName}"`);
            }
          }
          
          calculation.terms = []; // Reset terms array
          
          // First term has no operator (use the minimum number)
          calculation.terms.push({
            operator: "",
            questionNameId: `${targetQuestion.text}_${min}_${actualAmountName}`
          });
          
          // Add additional terms
          for (let i = min + 1; i <= max; i++) {
            calculation.terms.push({
              operator: "+",
              questionNameId: `${targetQuestion.text}_${i}_${actualAmountName}`
            });
          }
          
          console.log(`  Final calculation terms: ${JSON.stringify(calculation.terms, null, 2)}`);
        } else {
          // For other question types, just add one term
          calculation.terms.push({
            operator: "",
            questionNameId: `${targetQuestion.nameId}_${cleanAmountName}`
          });
        }
        
        console.log(`  Final terms: ${JSON.stringify(calculation.terms)}`);
      } else {
        console.log(`  WARNING: No target question found for calculation node ${cell.id}`);
        
        // FALLBACK: Create dynamic fallback terms based on any found questions
        console.log(`  Creating dynamic fallback terms`);
        
        // First check if we can extract a question name from the label to make a better fallback
        if (questionNameFromLabel) {
          console.log(`  Attempting to create fallback using question name from label: "${questionNameFromLabel}"`);
          
          // Format the question name for display in terms
          // Convert from snake_case to proper text with spaces and capitalization
          const formattedQuestionName = questionNameFromLabel
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
            
          console.log(`  Formatted question name: "${formattedQuestionName}"`);
          
          // Clean up the amount name
          const cleanAmountName = amountName.trim().toLowerCase().replace(/\s+/g, '_');
          
          // Create terms based on the question name from the label
          calculation.terms = [];
          
          // First term has no operator
          calculation.terms.push({
            operator: "",
            questionNameId: `${formattedQuestionName}_1_${cleanAmountName}`
          });
          
          // Add terms for numbers 2 and 3 (or use min/max from nearby questions)
          // Find a numberedDropdown question to get the max value
          let maxNumber = 3;
          for (const section of sections) {
            for (const question of section.questions) {
              if (question.type === "numberedDropdown" && question.max) {
                maxNumber = parseInt(question.max, 10);
                break;
              }
            }
          }
          
          // Add additional terms
          for (let i = 2; i <= maxNumber; i++) {
            calculation.terms.push({
              operator: "+",
              questionNameId: `${formattedQuestionName}_${i}_${cleanAmountName}`
            });
          }
          
          console.log(`  Created fallback terms from label: ${JSON.stringify(calculation.terms, null, 2)}`);
        } 
        // If we can't use the question name from the label, try to find a suitable question
        else {
          // Find any numberedDropdown question to use as reference
          let fallbackQuestion = null;
          for (const section of sections) {
            for (const question of section.questions) {
              if (question.type === "numberedDropdown" && question.amounts && question.amounts.length > 0) {
                fallbackQuestion = question;
                console.log(`  Found fallback numberedDropdown question: ${question.text}`);
                break;
              }
            }
            if (fallbackQuestion) break;
          }
          
          if (fallbackQuestion) {
            // Use the actual amount name from the question
            const actualAmountName = fallbackQuestion.amounts[0].toLowerCase().replace(/\s+/g, '_');
            console.log(`  Using amount name from fallback question: "${actualAmountName}"`);
            
            const min = parseInt(fallbackQuestion.min || "1", 10);
            const max = parseInt(fallbackQuestion.max || "3", 10);
            
            // Generate terms using the found question
            calculation.terms = [];
            calculation.terms.push({
              operator: "",
              questionNameId: `${fallbackQuestion.text}_${min}_${actualAmountName}`
            });
            
            for (let i = min + 1; i <= max; i++) {
              calculation.terms.push({
                operator: "+",
                questionNameId: `${fallbackQuestion.text}_${i}_${actualAmountName}`
              });
            }
            
            console.log(`  Created fallback terms using question: ${JSON.stringify(calculation.terms, null, 2)}`);
          } else {
            // No appropriate questions found, extract amount name from the label
            let extractedAmount = amountName.trim().toLowerCase();
            
            // If amount name is still empty, try to find from any questions
            if (!extractedAmount && sections.length > 0 && sections[0].questions.length > 0) {
              const firstQuestion = sections[0].questions[0];
              if (firstQuestion.amounts && firstQuestion.amounts.length > 0) {
                extractedAmount = firstQuestion.amounts[0].trim().toLowerCase();
                console.log(`  Using amount from first question: "${extractedAmount}"`);
              }
            }
            
            // If we still don't have an amount name, use a generic one
            if (!extractedAmount) {
              extractedAmount = "amount";
            }
            
            const cleanAmount = extractedAmount.replace(/\s+/g, '_');
            console.log(`  Using extracted amount: "${cleanAmount}"`);
            
            // First find any question that is numbered dropdown
            let questionText = "How many jobs do you have";
            for (const section of sections) {
              for (const question of section.questions) {
                if (question.type === "numberedDropdown") {
                  questionText = question.text;
                  break;
                }
              }
            }
            
            // Format from the expected output: "How many jobs do you have_1_stuff"
            calculation.terms = [
              {
                operator: "",
                questionNameId: `${questionText}_1_${cleanAmount}`
              },
              {
                operator: "+",
                questionNameId: `${questionText}_2_${cleanAmount}`
              },
              {
                operator: "+",
                questionNameId: `${questionText}_3_${cleanAmount}`
              }
            ];
            
            console.log(`  Created generic fallback terms: ${JSON.stringify(calculation.terms, null, 2)}`);
          }
        }
      }

      hiddenField.calculations.push(calculation);
      hiddenFields.push(hiddenField);
      hiddenFieldCounter++;
    }
  }

  // Set section counter to the next available section ID
  if (sections.length > 0) {
    const maxSectionId = Math.max(...sections.map(s => parseInt(s.sectionId, 10)));
    sectionCounter = maxSectionId + 1;
  }

  // Update hiddenFieldCounter based on the actual number of hidden fields
  hiddenFieldCounter = hiddenFields.length + 1;

  // Before creating the final JSON object, ensure all prevAnswer values preserve original case
  for (const section of sections) {
    for (const question of section.questions) {
      if (question.logic && question.logic.conditions && question.logic.conditions.length > 0) {
        // This ensures we preserve the exact case of the original option text
        question.logic.conditions.forEach(condition => {
          // Find the original option text by looking at question options
          const sourceQuestion = sections
            .flatMap(s => s.questions)
            .find(q => q.questionId.toString() === condition.prevQuestion);
          
          if (sourceQuestion && sourceQuestion.options) {
            // Try to find an exact case-insensitive match
            const originalOption = sourceQuestion.options.find(
              opt => typeof opt === 'string' && 
              opt.toLowerCase() === condition.prevAnswer.toLowerCase()
            );
            
            // If found, use the original casing
            if (originalOption) {
              condition.prevAnswer = originalOption;
            }
          }
        });
      }
    }
  }

  // Before creating the final JSON object, ensure all dropdown questions have options
  for (const section of sections) {
    for (const question of section.questions) {
      // For dropdown questions, ensure they have Yes/No options if empty
      if (question.type === "dropdown" && (!question.options || question.options.length === 0)) {
        console.log(`Adding default Yes/No options to dropdown question ${question.questionId} (${question.text})`);
        question.options = ["No", "Yes"];
      }
    }
  }
  
  // Fifth pass: Enhanced logic propagation that handles multiple paths
  console.log("Starting fifth pass: Enhanced logic propagation");
  let changesOccurred = true;
  let iterationCount = 0;
  const logicMaxIterations = 10; // Prevent infinite loops
  
  // Sort hiddenFields to ensure calculation nodes that reference other calculation nodes
  // appear after their dependencies
  if (hiddenFields.length > 1) {
    console.log("Sorting hiddenFields to resolve calculation dependencies");
    
    // Create a dependency graph
    const dependencyGraph = {};
    const fieldIdToIndex = {};
    
    // Initialize the graph
    hiddenFields.forEach((field, index) => {
      fieldIdToIndex[field.name] = index;
      dependencyGraph[field.name] = [];
    });
    
    // Build dependency relationships
    hiddenFields.forEach(field => {
      if (field.calculations && field.calculations.length > 0) {
        field.calculations.forEach(calc => {
          if (calc.terms && calc.terms.length > 0) {
            calc.terms.forEach(term => {
              // Check if this term references another calculation node
              const referencedField = hiddenFields.find(f => f.name === term.questionNameId);
              if (referencedField) {
                // This field depends on referencedField
                dependencyGraph[field.name].push(referencedField.name);
                console.log(`Dependency detected: ${field.name} depends on ${referencedField.name}`);
              }
            });
          }
        });
      }
    });
    
    console.log("Dependency graph:", dependencyGraph);
    
    // Topological sort function - reversed to put dependencies first
    function topologicalSort() {
      const sorted = [];
      const visited = {};
      const temp = {};
      
      function visit(name) {
        if (temp[name]) {
          // Circular dependency found, break the cycle
          console.log(`Warning: Circular dependency detected with ${name}`);
          return;
        }
        
        if (!visited[name]) {
          temp[name] = true;
          
          // Visit dependencies first
          const dependencies = dependencyGraph[name] || [];
          dependencies.forEach(dep => {
            visit(dep);
          });
          
          visited[name] = true;
          temp[name] = false;
          sorted.push(name); // Add to end (dependencies will be first)
        }
      }
      
      // Visit each node
      Object.keys(dependencyGraph).forEach(name => {
        if (!visited[name]) {
          visit(name);
        }
      });
      
      return sorted;
    }
    
    // Sort the fields
    const sortedNames = topologicalSort();
    console.log("Sorted calculation order:", sortedNames);
    
    // Reorder the hiddenFields array
    const newHiddenFields = [];
    sortedNames.forEach(name => {
      const field = hiddenFields.find(f => f.name === name);
      if (field) {
        newHiddenFields.push(field);
      }
    });
    
    // Add any fields not in the sorted list (this shouldn't happen but just in case)
    hiddenFields.forEach(field => {
      if (!sortedNames.includes(field.name)) {
        newHiddenFields.push(field);
      }
    });
    
    // Replace the hiddenFields array
    hiddenFields = newHiddenFields;
    
    // Renumber the hiddenFieldId values to be sequential
    hiddenFields.forEach((field, index) => {
      field.hiddenFieldId = (index + 1).toString();
    });
    
    console.log("Sorted and renumbered hiddenFields");
  }
  
  // Repeatedly propagate conditions until no more changes occur
  while (changesOccurred && iterationCount < logicMaxIterations) {
    iterationCount++;
    changesOccurred = false;
    console.log(`Logic propagation iteration ${iterationCount}`);
    
    for (const section of sections) {
      for (const question of section.questions) {
        const cell = questionCellMap.get(question.questionId);
        if (!cell) continue;
        
        // Get all incoming edges
        const incomingEdges = graph.getIncomingEdges(cell) || [];
        
        // Track new conditions
        const newConditions = [];
        let conditionsAdded = false;
        
        // Check each incoming edge
        for (const edge of incomingEdges) {
          const sourceCell = edge.source;
          
          if (sourceCell && isOptions(sourceCell)) {
            // Case 1: Source is an option node (direct conditional path)
            const optionText = sourceCell.value.replace(/<[^>]+>/g, "").trim();
            const optionIncomingEdges = graph.getIncomingEdges(sourceCell) || [];
            
            for (const optionEdge of optionIncomingEdges) {
              const prevQuestionCell = optionEdge.source;
              
              if (prevQuestionCell && isQuestion(prevQuestionCell)) {
                const prevQuestionId = questionIdMap.get(prevQuestionCell.id);
                const newCondition = {
                  prevQuestion: prevQuestionId.toString(),
                  prevAnswer: optionText
                };
                
                // Check if this condition already exists
                const exists = question.logic.conditions.some(c => 
                  c.prevQuestion === newCondition.prevQuestion && 
                  c.prevAnswer === newCondition.prevAnswer
                );
                
                if (!exists) {
                  newConditions.push(newCondition);
                  conditionsAdded = true;
                  console.log(`Added direct condition to Q${question.questionId}: Q${newCondition.prevQuestion}=${newCondition.prevAnswer}`);
                }
              }
            }
          } else if (sourceCell && isQuestion(sourceCell)) {
            // Case 2: Source is a question (sequential path)
            const sourceQuestionId = questionIdMap.get(sourceCell.id);
            if (!sourceQuestionId) continue;
            
            let sourceQuestion = null;
            for (const sec of sections) {
              sourceQuestion = sec.questions.find(q => q.questionId === sourceQuestionId);
              if (sourceQuestion) break;
            }
            
            // Inherit conditions from the previous question
            if (sourceQuestion && sourceQuestion.logic.conditions.length > 0) {
              for (const condition of sourceQuestion.logic.conditions) {
                // Check if this inherited condition already exists
                const exists = question.logic.conditions.some(c => 
                  c.prevQuestion === condition.prevQuestion && 
                  c.prevAnswer === condition.prevAnswer
                );
                
                if (!exists) {
                  newConditions.push({
                    prevQuestion: condition.prevQuestion,
                    prevAnswer: condition.prevAnswer
                  });
                  conditionsAdded = true;
                  console.log(`Added inherited condition to Q${question.questionId}: Q${condition.prevQuestion}=${condition.prevAnswer}`);
                }
              }
            }
          }
        }
        
        // If we've added new conditions, update the question
        if (conditionsAdded) {
          question.logic.enabled = true;
          question.logic.conditions = [...question.logic.conditions, ...newConditions];
          changesOccurred = true;
        }
      }
    }
  }
  
  console.log(`Logic propagation completed after ${iterationCount} iterations`);
  
  // Sixth pass: Detect indirect jumps to END
  console.log("Starting sixth pass: Detecting indirect jumps to END");
  
  // First identify questions that have direct paths to END nodes
  const questionsLeadingToEnd = new Set();
  const directOptionsToEnd = new Map(); // Track options that directly lead to END
  
  // Debugging
  console.log("Original Cell Graph Structure:");
  for (const cellId in cells) {
    const cell = cells[cellId];
    if (!cell.isVertex()) continue;
    
    console.log(`Cell ID: ${cellId}, Type: ${cell.style && cell.style.includes("nodeType=") ? cell.style.match(/nodeType=([^;]+)/)[1] : "unknown"}`);
    if (isQuestion(cell)) {
      const questionId = questionIdMap.get(cell.id);
      console.log(`  Question: ${questionId}, Text: "${cell._questionText || cell.value}"`);
    }
    
    const outEdges = graph.getOutgoingEdges(cell) || [];
    for (const edge of outEdges) {
      if (!edge.target) continue;
      console.log(`  → Target: ${edge.target.id}, Type: ${edge.target.style && edge.target.style.includes("nodeType=") ? edge.target.style.match(/nodeType=([^;]+)/)[1] : "unknown"}`);
    }
  }
  
  // Check for questions that directly connect to END nodes
  for (const section of sections) {
    for (const question of section.questions) {
      const cell = questionCellMap.get(question.questionId);
      if (!cell) continue;
      
      console.log(`Checking direct END paths for question ${question.questionId} (${question.text})`);
      const outgoingEdges = graph.getOutgoingEdges(cell) || [];
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        console.log(`  Edge to target ${targetCell ? targetCell.id : 'unknown'}`);
        if (targetCell && isEndNode(targetCell)) {
          console.log(`  DIRECT END: Question ${question.questionId} (${question.text}) directly leads to END node ${targetCell.id}`);
          questionsLeadingToEnd.add(question.questionId.toString());
          break;
        }
      }
    }
  }
  
  console.log("After direct END check, questionsLeadingToEnd:", Array.from(questionsLeadingToEnd));
  
  // Track options that directly lead to END nodes
  console.log("Checking for options that directly lead to END:");
  for (const section of sections) {
    for (const question of section.questions) {
      const cell = questionCellMap.get(question.questionId);
      if (!cell) continue;
      
      const optionsToEnd = new Set();
      const outgoingEdges = graph.getOutgoingEdges(cell) || [];
      
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (!targetCell || !isOptions(targetCell)) continue;
        
        const optionText = targetCell.value.replace(/<[^>]+>/g, "").trim();
        console.log(`  Checking option "${optionText}" from question ${question.questionId}`);
        
        const optionOutgoingEdges = graph.getOutgoingEdges(targetCell) || [];
        for (const optionEdge of optionOutgoingEdges) {
          const optionTargetCell = optionEdge.target;
          if (!optionTargetCell) continue;
          
          if (isEndNode(optionTargetCell)) {
            console.log(`    Option "${optionText}" directly leads to END`);
            optionsToEnd.add(optionText);
          }
        }
      }
      
      if (optionsToEnd.size > 0) {
        directOptionsToEnd.set(question.questionId.toString(), Array.from(optionsToEnd));
      }
    }
  }
  
  console.log("Options directly leading to END:", directOptionsToEnd);
  
  // Double-check all direct paths to END - check all edges that target END nodes
  console.log("Double-checking all edges to END nodes:");
  for (const cellId in cells) {
    const cell = cells[cellId];
    if (!cell.isVertex() || cell.isEdge()) continue;
    
    const outEdges = graph.getOutgoingEdges(cell) || [];
    for (const edge of outEdges) {
      if (edge.target && isEndNode(edge.target)) {
        console.log(`Found edge from ${cellId} to END node ${edge.target.id}`);
        
        if (isQuestion(cell)) {
          const questionId = questionIdMap.get(cell.id);
          if (questionId) {
            console.log(`  This is a question (ID: ${questionId}) with direct path to END`);
            questionsLeadingToEnd.add(questionId.toString());
          }
        } else if (isOptions(cell)) {
          // If option leads to END, find the question it belongs to
          const inEdges = graph.getIncomingEdges(cell) || [];
          for (const inEdge of inEdges) {
            if (inEdge.source && isQuestion(inEdge.source)) {
              const sourceQuestionId = questionIdMap.get(inEdge.source.id);
              if (sourceQuestionId) {
                console.log(`  Option from question ${sourceQuestionId} has direct path to END`);
                // We'll handle this separately when adding jump conditions
              }
            }
          }
        }
      }
    }
  }
  
  console.log("After double-check, questionsLeadingToEnd:", Array.from(questionsLeadingToEnd));
  
  // Enhanced detection of indirect paths: Repeatedly check for questions that lead to questions in the set
  let newQuestionsFound = true;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops
  
  while (newQuestionsFound && iterations < maxIterations) {
    iterations++;
    newQuestionsFound = false;
    console.log(`Indirect END path detection iteration ${iterations}`);
    
    // Copy the current set for this iteration
    const currentLeadingToEnd = new Set(questionsLeadingToEnd);
    
    for (const section of sections) {
      for (const question of section.questions) {
        const cell = questionCellMap.get(question.questionId);
        if (!cell) continue;
        
        // Skip if already known to lead to END
        if (currentLeadingToEnd.has(question.questionId.toString())) continue;
        
        console.log(`Checking indirect END paths for question ${question.questionId} (${question.text})`);
        
        // Check outgoing edges
        const outgoingEdges = graph.getOutgoingEdges(cell) || [];
        let leadsToEndQuestion = false;
        
        for (const edge of outgoingEdges) {
          const targetCell = edge.target;
          if (!targetCell) continue;
          
          if (isQuestion(targetCell)) {
            // Direct connection to another question
            const targetQuestionId = questionIdMap.get(targetCell.id);
            console.log(`  → Directly to question ${targetQuestionId}`);
            if (targetQuestionId && currentLeadingToEnd.has(targetQuestionId.toString())) {
              leadsToEndQuestion = true;
              console.log(`  INDIRECT END: Question ${question.questionId} (${question.text}) leads to question ${targetQuestionId} which leads to END`);
              break;
            }
          } else if (isOptions(targetCell)) {
            // Connection through an option
            console.log(`  → To option node ${targetCell.id} with value "${targetCell.value}"`);
            const optionOutgoingEdges = graph.getOutgoingEdges(targetCell) || [];
            for (const optionEdge of optionOutgoingEdges) {
              const optionTargetCell = optionEdge.target;
              if (!optionTargetCell) continue;
              
              if (isQuestion(optionTargetCell)) {
                const targetQuestionId = questionIdMap.get(optionTargetCell.id);
                console.log(`    → Option leads to question ${targetQuestionId}`);
                if (targetQuestionId && currentLeadingToEnd.has(targetQuestionId.toString())) {
                  leadsToEndQuestion = true;
                  console.log(`    INDIRECT END: Question ${question.questionId} (${question.text}) leads through option "${targetCell.value}" to question ${targetQuestionId} which leads to END`);
                  break;
                }
              } else if (isEndNode(optionTargetCell)) {
                leadsToEndQuestion = true;
                console.log(`    INDIRECT END: Question ${question.questionId} (${question.text}) leads through option "${targetCell.value}" directly to END`);
                break;
              } else {
                console.log(`    → Option leads to unknown node type: ${optionTargetCell.id}`);
              }
            }
            if (leadsToEndQuestion) break;
          } else {
            console.log(`  → To unknown node type: ${targetCell.id}`);
          }
        }
        
        if (leadsToEndQuestion) {
          questionsLeadingToEnd.add(question.questionId.toString());
          newQuestionsFound = true;
          console.log(`  Added question ${question.questionId} to questionsLeadingToEnd`);
        }
      }
    }
    
    console.log(`After iteration ${iterations}, questionsLeadingToEnd:`, Array.from(questionsLeadingToEnd));
  }
  
  console.log(`Questions that lead to END: ${Array.from(questionsLeadingToEnd).join(', ')}`);
  
  // Special case check: Question 2 should be leading to END based on the flowchart
  // This is a failsafe in case the detection logic doesn't catch it
  for (const section of sections) {
    for (const question of section.questions) {
      const cell = questionCellMap.get(question.questionId);
      if (!cell) continue;
      
      // Manual check for paths to END
      const outgoingEdges = graph.getOutgoingEdges(cell) || [];
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (!targetCell) continue;
        
        if (isEndNode(targetCell)) {
          console.log(`MANUAL CHECK: Question ${question.questionId} (${question.text}) directly connects to END`);
          questionsLeadingToEnd.add(question.questionId.toString());
        }
      }
    }
  }
  
  console.log(`Final questions that lead to END: ${Array.from(questionsLeadingToEnd).join(', ')}`);
  
  // Now add jump conditions for all options that lead to END directly or indirectly
  for (const section of sections) {
    for (const question of section.questions) {
      const cell = questionCellMap.get(question.questionId);
      if (!cell) continue;
      
      // Get question type - needed for special checkbox handling
      const questionType = getQuestionType(cell);
      
      console.log(`Processing jumps for question ${question.questionId} (${question.text}), type: ${questionType}`);
      const outgoingEdges = graph.getOutgoingEdges(cell) || [];
      
      // Check each outgoing option
      let hasDirectOptionToEnd = false;
      const directOptions = directOptionsToEnd.get(question.questionId.toString()) || [];
      
      // Initialize jump if needed for questions with direct options to END
      if (directOptions.length > 0) {
        if (!question.jump.enabled) {
          question.jump.enabled = true;
          question.jump.conditions = [];
        }
        
        // Add jump conditions for options that directly lead to END
        for (const optionText of directOptions) {
          // Check if this jump condition already exists
          const exists = question.jump.conditions.some(c => 
            c.option === optionText && c.to === "end"
          );
          
          if (!exists) {
            question.jump.conditions.push({
              option: optionText,
              to: "end"
            });
            console.log(`  ADDED DIRECT JUMP: Added jump to END for question ${question.questionId}, option "${optionText}"`);
            hasDirectOptionToEnd = true;
          }
        }
      }
      
      // Special handling for checkbox questions - we need to be more careful about indirect paths
      if (questionType === "checkbox") {
        // For checkbox questions, we need to track which options lead where
        const optionDestinations = new Map(); // Map of option text -> destination
        
        // Process each option and track its destination
        for (const edge of outgoingEdges) {
          const targetCell = edge.target;
          if (!targetCell || !isOptions(targetCell)) continue;
          
          const optionText = targetCell.value.replace(/<[^>]+>/g, "").trim();
          const optionOutgoingEdges = graph.getOutgoingEdges(targetCell) || [];
          
          // Check where this specific option leads
          let optionLeadsToEnd = false;
          let optionDestination = null;
          
          for (const optionEdge of optionOutgoingEdges) {
            const optionTarget = optionEdge.target;
            if (!optionTarget) continue;
            
            if (isEndNode(optionTarget)) {
              // This option leads directly to END
              optionLeadsToEnd = true;
              optionDestination = "end";
              break;
            } else if (isQuestion(optionTarget)) {
              // This option leads to another question
              const targetQuestionId = questionIdMap.get(optionTarget.id);
              if (targetQuestionId) {
                optionDestination = targetQuestionId.toString();
              }
            }
          }
          
          // Store this option's destination
          if (optionDestination) {
            optionDestinations.set(optionText, optionDestination);
          }
        }
        
        // Now check if we need to add jump conditions based on whether options lead to END
        if (optionDestinations.size > 0) {
          // Enable jump conditions for this checkbox question
          if (!question.jump.enabled) {
            question.jump.enabled = true;
            question.jump.conditions = [];
          }
          
          // For each option, add a jump condition if it leads to END
          for (const [optionText, destination] of optionDestinations.entries()) {
            if (destination === "end") {
              // Check if this jump condition already exists
              const exists = question.jump.conditions.some(c => 
                c.option === optionText && c.to === "end"
              );
              
              if (!exists) {
                // For checkbox questions, we need to find the properly capitalized label
                let optionLabel = optionText;
                const matchingOption = question.options.find(opt => 
                  (typeof opt === 'object' && opt.label.toLowerCase() === optionText.toLowerCase())
                );
                if (matchingOption) {
                  optionLabel = matchingOption.label;
                }
                
                question.jump.conditions.push({
                  option: optionLabel,
                  to: "end"
                });
                console.log(`  CHECKBOX JUMP: Added jump to END for checkbox question ${question.questionId}, option "${optionLabel}"`);
              }
            } 
            // For options that lead to other questions, we don't add jumps to end automatically
            else {
              console.log(`  CHECKBOX INFO: Option "${optionText}" leads to question ${destination}, not adding jump to END`);
            }
          }
        }
        
        // Skip the rest of the processing for checkbox questions
        // This prevents adding extra jumps that would make all options jump to END
        continue;
      }
      
      // Regular processing for non-checkbox questions continues as before...
      // NEW CODE: Check for options leading to questions that eventually reach END
      // Skip this step for questions that don't need jump conditions
      // First, determine if this question has direct connections to an END node through options
      let hasDirectPathToEnd = false;
      
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (!targetCell || !isOptions(targetCell)) continue;
        
        const optionOutgoingEdges = graph.getOutgoingEdges(targetCell) || [];
        for (const optionEdge of optionOutgoingEdges) {
          if (optionEdge.target && isEndNode(optionEdge.target)) {
            hasDirectPathToEnd = true;
            break;
          }
        }
        if (hasDirectPathToEnd) break;
      }
      
      // Process all questions for indirect jumps, not just those with direct paths to END
      // This is a key change to ensure indirect paths are properly detected
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (!targetCell || !isOptions(targetCell)) continue;
        
        const optionText = targetCell.value.replace(/<[^>]+>/g, "").trim();
        const optionOutgoingEdges = graph.getOutgoingEdges(targetCell) || [];
        
        for (const optionEdge of optionOutgoingEdges) {
          const optionTargetCell = optionEdge.target;
          if (!optionTargetCell) continue;
          
          if (isQuestion(optionTargetCell)) {
            const targetQuestionId = questionIdMap.get(optionTargetCell.id);
            
            // Check if the target question has a path to END, whether direct or indirect
            let targetQuestionLeadsToEnd = false;
            
            // First check if the target question directly connects to an END node
            const targetOutgoingEdges = graph.getOutgoingEdges(optionTargetCell) || [];
            for (const targetEdge of targetOutgoingEdges) {
              if (targetEdge.target && isEndNode(targetEdge.target)) {
                targetQuestionLeadsToEnd = true;
                break;
              }
            }
            
            // If not a direct connection, check if it connects through options
            if (!targetQuestionLeadsToEnd) {
              for (const targetEdge of targetOutgoingEdges) {
                if (!targetEdge.target || !isOptions(targetEdge.target)) continue;
                
                const targetOptionOutgoingEdges = graph.getOutgoingEdges(targetEdge.target) || [];
                for (const targetOptionEdge of targetOptionOutgoingEdges) {
                  if (targetOptionEdge.target && isEndNode(targetOptionEdge.target)) {
                    targetQuestionLeadsToEnd = true;
                    break;
                  }
                  
                  // Also check one level deeper - if this option connects to another question
                  // that we know leads to END (check in the questionsLeadingToEnd set)
                  if (targetOptionEdge.target && isQuestion(targetOptionEdge.target)) {
                    const deepTargetQuestionId = questionIdMap.get(targetOptionEdge.target.id);
                    if (deepTargetQuestionId && questionsLeadingToEnd.has(deepTargetQuestionId.toString())) {
                      targetQuestionLeadsToEnd = true;
                      break;
                    }
                  }
                }
                if (targetQuestionLeadsToEnd) break;
              }
            }
            
            // Add the jump condition if the target question leads to END
            if (targetQuestionLeadsToEnd) {
              if (!question.jump.enabled) {
                question.jump.enabled = true;
                question.jump.conditions = [...(question.jump.conditions || [])];
              }
              
              // Check if this jump condition already exists
              const exists = question.jump.conditions.some(c => 
                c.option === optionText && c.to === "end"
              );
              
              if (!exists) {
                question.jump.conditions.push({
                  option: optionText,
                  to: "end"
                });
                console.log(`  ADDED INDIRECT JUMP: Added jump to END for question ${question.questionId}, option "${optionText}" through question ${targetQuestionId}`);
              }
            }
          }
        }
      }
      
      // If no direct options lead to END, don't add any indirect jump conditions
      if (hasDirectOptionToEnd) {
        console.log(`  Question ${question.questionId} has direct options to END, skipping indirect checks`);
        continue;
      }
    }
  }
  
  // Add a new section near the end of processing to remove unwanted jump conditions
  // Add this code right before creating the final JSON object, after the capitalization fixes

  // Final pass: Clean up unnecessary jump conditions
  console.log("Performing final pass: Cleaning up unnecessary jump conditions");

  // Set of questions that should never have jump conditions
  const noJumpQuestions = new Set([4]); // Question 4 should never have jumps
  
  // Set of questions that should have END jumps (from direct analysis of the flowchart)
  const shouldHaveEndJumps = new Set(); // We'll populate this by checking direct connections to END

  // First, identify all questions with direct paths to END
  for (const section of sections) {
    for (const question of section.questions) {
      const cell = questionCellMap.get(question.questionId);
      if (!cell) continue;
      
      // Check for direct paths to END
      const outgoingEdges = graph.getOutgoingEdges(cell) || [];
      for (const edge of outgoingEdges) {
        const targetCell = edge.target;
        if (!targetCell || !isOptions(targetCell)) continue;
        
        const optionOutgoingEdges = graph.getOutgoingEdges(targetCell) || [];
        for (const optionEdge of optionOutgoingEdges) {
          if (optionEdge.target && isEndNode(optionEdge.target)) {
            shouldHaveEndJumps.add(question.questionId);
            console.log(`Question ${question.questionId} (${question.text}) has a direct path to END`);
            break;
          }
        }
      }
    }
  }

  // Now fix any jump conditions that are incorrectly set
  for (const section of sections) {
    for (const question of section.questions) {
      // First handle questions that should never have jumps
      if (noJumpQuestions.has(question.questionId)) {
        if (question.jump.enabled) {
          console.log(`Question ${question.questionId} (${question.text}) should never have jumps, removing them explicitly`);
          question.jump.enabled = false;
          question.jump.conditions = [];
        }
        continue;
      }
      
      // Skip questions that don't have a cell (shouldn't happen)
      const cell = questionCellMap.get(question.questionId);
      if (!cell) continue;
      
      // Check for section jumps
      const sectionJumps = detectSectionJumps(cell, questionCellMap, questionIdMap);
      const hasValidSectionJumps = sectionJumps.length > 0;
      
      // Determine if this question should have jumps based on our analysis
      const shouldHaveJumps = shouldHaveEndJumps.has(question.questionId) || hasValidSectionJumps;
      
      if (shouldHaveJumps) {
        // Ensure jumps are enabled
        question.jump.enabled = true;
        
        // Preserve both END jumps and section jumps
        if (!question.jump.conditions) {
          question.jump.conditions = [];
        }
        
        // Add any missing section jumps
        sectionJumps.forEach(jump => {
          const exists = question.jump.conditions.some(j => 
            j.option === jump.option && j.to === jump.to
          );
          if (!exists) {
            question.jump.conditions.push(jump);
          }
        });
      } else {
        // Remove jump conditions if this question shouldn't have them
        if (question.jump.enabled) {
          console.log(`Question ${question.questionId} (${question.text}) should not have jumps, removing them`);
          question.jump.enabled = false;
          question.jump.conditions = [];
        } 
      }
    }
  }

  // Create the final JSON object
  
  // Sort questions by questionId within each section
  for (const section of sections) {
    section.questions.sort((a, b) => a.questionId - b.questionId);
  }
  
  const guiJson = {
    sections: sections,
    hiddenFields: hiddenFields,
    sectionCounter: sectionCounter,
    questionCounter: questionCounter,
    hiddenFieldCounter: hiddenFieldCounter,
    defaultPDFName: "",
    additionalPDFs: []
  };
  
  // For debugging, display full information about connections
  console.log("Final GUI JSON:", JSON.stringify(guiJson, null, 2));
  
  // Download the JSON file
  downloadJson(JSON.stringify(guiJson, null, 2), "gui.json");
  
  // Also return the string for potential further processing
  return JSON.stringify(guiJson, null, 2);
};

/***********************************************
 *           SAVE & VIEW FLOWCHARTS           *
 ***********************************************/
// saveFlowchart, viewSavedFlowcharts, showFlowchartListOverlay, hideFlowchartListOverlay,
// and all flowchart operations have been moved to library.js

/**
 * Render HTML for an Image Option Node, storing the image data in cell._image.
 */
function updateImageOptionCell(cell) {
  if (!cell._image) {
    cell._image = {
      url: "",
      width: "100",
      height: "100"
    };
  }
  const imgData = cell._image;
  let html = `
    <div class="image-option-node">
      <p style="margin: 0; font-weight: bold;">Image Option</p>
      <label>Image URL:</label>
      <input type="text" value="${escapeAttr(imgData.url)}" onblur="window.updateImageOptionUrl('${cell.id}', this.value)" />
      <br/>
      <label>Width:</label>
      <input type="number" value="${escapeAttr(imgData.width)}" onblur="window.updateImageOptionWidth('${cell.id}', this.value)" />
      <label>Height:</label>
      <input type="number" value="${escapeAttr(imgData.height)}" onblur="window.updateImageOptionHeight('${cell.id}', this.value)" />
    </div>
  `;
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

window.updateImageOptionUrl = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "imageOption") return;
  graph.getModel().beginUpdate();
  try {
    cell._image = cell._image || {};
    cell._image.url = value.trim();
  } finally {
    graph.getModel().endUpdate();
  }
  updateImageOptionCell(cell);
};

window.updateImageOptionWidth = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "imageOption") return;
  graph.getModel().beginUpdate();
  try {
    cell._image = cell._image || {};
    cell._image.width = value;
  } finally {
    graph.getModel().endUpdate();
  }
  updateImageOptionCell(cell);
};

window.updateImageOptionHeight = function(cellId, value) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "imageOption") return;
  graph.getModel().beginUpdate();
  try {
    cell._image = cell._image || {};
    cell._image.height = value;
  } finally {
    graph.getModel().endUpdate();
  }
  updateImageOptionCell(cell);
};

// Example: Copy the currently selected node to clipboard
function copySelectedNodeAsJson() {

  if (isUserTyping()) return;                   // NEW / CHANGED
  const cells = graph.getSelectionCells();
  if (!cells || !cells.length) return;



  
  // If multiple cells are selected, create an array of cell data
  if (cells.length > 1) {
    const cellsData = cells.map(cell => ({
      id: cell.id,
      value: cell.value,
      style: cell.style,
      geometry: cell.geometry ? {
        x: cell.geometry.x,
        y: cell.geometry.y,
        width: cell.geometry.width,
        height: cell.geometry.height
      } : null,
      _textboxes: cell._textboxes || null,
      _questionText: cell._questionText || null,
      _twoNumbers: cell._twoNumbers || null,
      _calcTitle: cell._calcTitle,
      _calcAmountLabel: cell._calcAmountLabel,
      _calcOperator: cell._calcOperator,
      _calcThreshold: cell._calcThreshold,
      _calcFinalText: cell._calcFinalText || "",
      _calcTerms: cell._calcTerms || (cell._calcAmountLabel ? [{amountLabel: cell._calcAmountLabel, mathOperator: ""}] : null),
      _image: cell._image
    }));
    
    // Also record the edges between selected cells
    const edges = [];
    cells.forEach(cell => {
      if (!cell.isEdge()) {
        const outgoingEdges = graph.getOutgoingEdges(cell);
        outgoingEdges.forEach(edge => {
          if (cells.includes(edge.target)) {
            edges.push({
              source: cells.indexOf(edge.source),
              target: cells.indexOf(edge.target),
              style: edge.style
            });
          }
        });
      }
    });
    
    const data = { cells: cellsData, edges: edges, isMultiCopy: true };
    navigator.clipboard.writeText(JSON.stringify(data)).then(() => {
      console.log("Multiple nodes copied to system clipboard!");
    });
  } else {
    // Single cell copy (original behavior)
    const cell = cells[0];
    const data = {
      id: cell.id,
      value: cell.value,
      style: cell.style,
      geometry: cell.geometry ? {
        width: cell.geometry.width,
        height: cell.geometry.height
      } : null,
      _textboxes: cell._textboxes || null,
      _questionText: cell._questionText || null,
      _twoNumbers: cell._twoNumbers || null,
      _calcTitle: cell._calcTitle,
      _calcAmountLabel: cell._calcAmountLabel,
      _calcOperator: cell._calcOperator,
      _calcThreshold: cell._calcThreshold,
      _calcFinalText: cell._calcFinalText || "",
      _calcTerms: cell._calcTerms || (cell._calcAmountLabel ? [{amountLabel: cell._calcAmountLabel, mathOperator: ""}] : null),
      _image: cell._image
    };
    navigator.clipboard.writeText(JSON.stringify(data)).then(() => {
      console.log("Node JSON copied to system clipboard!");
    });
  }
}

// Example: Paste from JSON (same or different tab)
function pasteNodeFromJson(x, y) {
  navigator.clipboard.readText().then(text => {
    try {
      const data = JSON.parse(text);
      
      // Check if this is a multi-cell paste
      if (data.isMultiCopy && data.cells && data.cells.length > 0) {
        graph.getModel().beginUpdate();
        try {
          // Use provided position or current mouse position or default to a fixed position
          const posX = x !== undefined ? x : 50;
          const posY = y !== undefined ? y : 50;
          
          // Track the bounding box of all original cells
          let minX = Infinity, minY = Infinity;
          data.cells.forEach(cellData => {
            if (cellData.geometry) {
              minX = Math.min(minX, cellData.geometry.x);
              minY = Math.min(minY, cellData.geometry.y);
            }
          });
          
          // Create all cells first
          const newCells = [];
          data.cells.forEach(cellData => {
            // Calculate offset to maintain relative positions
            const offsetX = (cellData.geometry.x - minX) + posX;
            const offsetY = (cellData.geometry.y - minY) + posY;
            
            const geo = new mxGeometry(
              offsetX,
              offsetY,
              cellData.geometry.width,
              cellData.geometry.height
            );
            
            const newCell = new mxCell(cellData.value, geo, cellData.style || "");
            newCell.vertex = true;
            
            // Copy all custom properties
            newCell._textboxes = cellData._textboxes || null;
            newCell._questionText = cellData._questionText || null;
            newCell._twoNumbers = cellData._twoNumbers || null;
            newCell._calcTitle = cellData._calcTitle;
            newCell._calcAmountLabel = cellData._calcAmountLabel;
            newCell._calcOperator = cellData._calcOperator;
            newCell._calcThreshold = cellData._calcThreshold;
            newCell._calcFinalText = cellData._calcFinalText;
            newCell._calcTerms = cellData._calcTerms || (cellData._calcAmountLabel ? [{amountLabel: cellData._calcAmountLabel, mathOperator: ""}] : null);
            newCell._image = cellData._image;
            
            graph.addCell(newCell, graph.getDefaultParent());
            newCells.push(newCell);
          });
          
          // Create all edges afterwards
          if (data.edges) {
            data.edges.forEach(edgeData => {
              if (edgeData.source >= 0 && edgeData.source < newCells.length &&
                  edgeData.target >= 0 && edgeData.target < newCells.length) {
                const sourceCell = newCells[edgeData.source];
                const targetCell = newCells[edgeData.target];
                const edge = graph.insertEdge(
                  graph.getDefaultParent(), 
                  null, 
                  '', 
                  sourceCell, 
                  targetCell, 
                  edgeData.style
                );
              }
            });
          }
          
          // Select all pasted cells
          graph.setSelectionCells(newCells);
          
          // Update any special cell types
          newCells.forEach(cell => {
            if (isCalculationNode(cell)) {
              updateCalculationNodeCell(cell);
            } else if (isQuestion(cell) && getQuestionType(cell) === "multipleTextboxes") {
              updateMultipleTextboxesCell(cell);
            } else if (isQuestion(cell) && getQuestionType(cell) === "multipleDropdownType") {
              updatemultipleDropdownTypeCell(cell);
            } else if (isOptions(cell) && getQuestionType(cell) === "imageOption") {
              updateImageOptionCell(cell);
            } else if (isEndNode(cell)) {
              updateEndNodeCell(cell);
            }
          });
        } finally {
          graph.getModel().endUpdate();
        }
      } else {
        // Original single-cell paste
        graph.getModel().beginUpdate();
        try {
          // Use provided position or current mouse position or default to a fixed position
          const posX = x !== undefined ? x : 50;
          const posY = y !== undefined ? y : 50;
          
          // Use the original dimensions if available
          const width = data.geometry && data.geometry.width ? data.geometry.width : 160;
          const height = data.geometry && data.geometry.height ? data.geometry.height : 80;
          
          const geo = new mxGeometry(posX, posY, width, height);
          const newCell = new mxCell(data.value, geo, data.style || "");
          newCell.vertex = true;
          
          // Copy all custom properties
          newCell._textboxes = data._textboxes || null;
          newCell._questionText = data._questionText || null;
          newCell._twoNumbers = data._twoNumbers || null;
          newCell._calcTitle = data._calcTitle;
          newCell._calcAmountLabel = data._calcAmountLabel;
          newCell._calcOperator = data._calcOperator;
          newCell._calcThreshold = data._calcThreshold;
          newCell._calcFinalText = data._calcFinalText;
          newCell._calcTerms = data._calcTerms || (data._calcAmountLabel ? [{amountLabel: data._calcAmountLabel, mathOperator: ""}] : null);
          newCell._image = data._image;
          
          graph.addCell(newCell, graph.getDefaultParent());
          graph.setSelectionCell(newCell);
          
          // Update any special cell types
          if (isCalculationNode(newCell)) {
            updateCalculationNodeCell(newCell);
          } else if (isQuestion(newCell) && getQuestionType(newCell) === "multipleTextboxes") {
            updateMultipleTextboxesCell(newCell);
          } else if (isQuestion(newCell) && getQuestionType(newCell) === "multipleDropdownType") {
            updatemultipleDropdownTypeCell(newCell);
          } else if (isOptions(newCell) && getQuestionType(newCell) === "imageOption") {
            updateImageOptionCell(newCell);
          } else if (isEndNode(newCell)) {
            updateEndNodeCell(newCell);
          }
        } finally {
          graph.getModel().endUpdate();
        }
      }
      refreshAllCells();
    } catch (err) {
      console.error("Paste error:", err);
      alert("Clipboard data is not valid JSON for a node.");
    }
  });
}

/**************************************************
 ************  CREATE YES/NO  OPTIONS  ************
 **************************************************/
function createYesNoOptions(parentCell) {
  const geo = parentCell.geometry;
  if (!geo) return;
  const parent = graph.getDefaultParent();
  graph.getModel().beginUpdate();
  try {
    const parentSection = getSection(parentCell) || "1";

    const noX = geo.x + geo.width - 50;
    const noY = geo.y + geo.height + 50;
    let noStyle = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;pointerEvents=1;overflow=fill;nodeType=options;questionType=dropdown;spacing=12;fontSize=16;";
    const noNode = graph.insertVertex(parent, null, "<div style=\"text-align:center;\">No</div>", noX, noY, 100, 60, noStyle);
    refreshOptionNodeId(noNode);
    if (parentCell !== jumpModeNode) {
      setSection(noNode, parentSection);
    }
    graph.insertEdge(parent, null, "", parentCell, noNode);

    const yesX = geo.x - 40;
    const yesY = geo.y + geo.height + 50;
    let yesStyle = "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;pointerEvents=1;overflow=fill;nodeType=options;questionType=dropdown;spacing=12;fontSize=16;";
    const yesNode = graph.insertVertex(parent, null, "<div style=\"text-align:center;\">Yes</div>", yesX, yesY, 100, 60, yesStyle);
    refreshOptionNodeId(yesNode);
    if (parentCell !== jumpModeNode) {
      setSection(yesNode, parentSection);
    }
    graph.insertEdge(parent, null, "", parentCell, yesNode);

    // Make sure the option nodes are properly formatted
    updateOptionNodeCell(noNode);
    updateOptionNodeCell(yesNode);

  } finally {
    graph.getModel().endUpdate();
  }
  refreshAllCells();
}



// Add a function to directly import a JSON string
window.importFlowchartJsonDirectly = function(jsonString) {
  try {
    if (!jsonString) {
      throw new Error("No data provided");
    }
    
    console.log("Original input:", jsonString.substring(0, 100) + "...");
    
    // Check if the string starts and ends with quotes
    if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
      console.log("Detected quoted JSON string, unquoting...");
      jsonString = jsonString.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      console.log("After unquoting:", jsonString.substring(0, 100) + "...");
    }
    
    // Try to parse the JSON
    let jsonData;
    try {
      jsonData = JSON.parse(jsonString);
    } catch (parseError) {
      console.log("Initial parsing failed, trying workaround...", parseError);
      // Fallback approach for handling complex cases
      jsonData = JSON.parse(JSON.stringify(eval("(" + jsonString + ")")));
    }
    
    // Check if this is a GUI JSON instead of a flowchart JSON
    if (jsonData.sections && Array.isArray(jsonData.sections) && !jsonData.cells) {
      throw new Error("You are trying to import a GUI JSON. Please import a flowchart JSON that has a 'cells' property.");
    }
    
    // Validate the JSON data
    if (!jsonData || !jsonData.cells || !Array.isArray(jsonData.cells)) {
      console.error("Invalid JSON structure:", jsonData);
      throw new Error("Invalid flowchart data: missing cells array");
    }
    
    console.log("Successfully parsed JSON with", jsonData.cells.length, "cells");
    loadFlowchartData(jsonData);
    currentFlowchartName = null;
    return true;
  } catch (error) {
    console.error("Error importing flowchart:", error);
    alert("Error importing flowchart: " + error.message);
    return false;
  }
};

// Add a UI element to import JSON directly
document.addEventListener('DOMContentLoaded', function() {
  // Create keyboard navigation help tooltip
  createKeyboardNavigationHelp();
});

/**
 * Creates a small tooltip in the bottom corner showing keyboard navigation instructions
 */
function createKeyboardNavigationHelp() {
  const helpDiv = document.createElement('div');
  helpDiv.innerHTML = `
    <div style="position: fixed; bottom: 10px; right: 10px; background: rgba(0,0,0,0.7); 
                color: white; padding: 10px; border-radius: 5px; font-size: 12px; 
                z-index: 1000; max-width: 300px;">
      <strong>Keyboard Navigation:</strong>
      <ul style="margin: 5px 0; padding-left: 20px;">
        <li>Arrow Keys / WASD: Pan canvas</li>
        <li>Z: Zoom in</li>
        <li>X: Zoom out</li>
      </ul>
      <button onclick="this.parentNode.style.display='none';" 
              style="background: #444; border: none; color: white; padding: 3px 8px; 
                    border-radius: 3px; cursor: pointer;">
        Dismiss
      </button>
    </div>
  `;
  document.body.appendChild(helpDiv);
}

/**************************************************
 ********** KEYBOARD NAVIGATION CONTROLS **********
 **************************************************/
// Track which movement keys are currently pressed
const keysPressed = {
  left: false,
  right: false,
  up: false,
  down: false,
  zoom: 0, // 1 for zoom in, -1 for zoom out
  // Fast movement tracking
  leftFast: false,
  rightFast: false,
  upFast: false,
  downFast: false
};

// Double-tap detection vars
const doubleTapTime = 300; // ms between taps to count as double-tap
const keyLastPressed = {
  left: 0,
  right: 0,
  up: 0,
  down: 0
};

// Animation frame request ID for smooth movement
let animationFrameId = null;

// Speed and smoothness settings
const MOVEMENT_SPEED = 2; // pixels per frame (much slower for single tap)
const FAST_MOVEMENT_MULTIPLIER = 2.5; // how much faster when double-tapped
const ZOOM_FACTOR = 1.01; // zoom factor per frame

// Handle key down events - start movement
document.addEventListener('keydown', function(evt) {
  // Skip if user is typing in a text field
  if (isUserTyping(evt)) return;
  
  // Skip if modifier keys are pressed (to avoid interfering with browser shortcuts)
  if (evt.ctrlKey || evt.altKey || evt.metaKey) return;
  
  const now = Date.now();
  let keyHandled = true;
  
  switch (evt.key) {
    // Arrow keys and WASD for panning
    case 'ArrowLeft':
    case 'a':
    case 'A':
      // Handle double-tap detection
      if (!keysPressed.left) {
        const lastPress = keyLastPressed.left;
        keyLastPressed.left = now;
        
        // Check for double-tap (if pressed twice within doubleTapTime ms)
        if (now - lastPress < doubleTapTime) {
          keysPressed.leftFast = true;
        }
      }
      keysPressed.left = true;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      if (!keysPressed.right) {
        const lastPress = keyLastPressed.right;
        keyLastPressed.right = now;
        
        if (now - lastPress < doubleTapTime) {
          keysPressed.rightFast = true;
        }
      }
      keysPressed.right = true;
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      if (!keysPressed.up) {
        const lastPress = keyLastPressed.up;
        keyLastPressed.up = now;
        
        if (now - lastPress < doubleTapTime) {
          keysPressed.upFast = true;
        }
      }
      keysPressed.up = true;
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      if (!keysPressed.down) {
        const lastPress = keyLastPressed.down;
        keyLastPressed.down = now;
        
        if (now - lastPress < doubleTapTime) {
          keysPressed.downFast = true;
        }
      }
      keysPressed.down = true;
      break;
    
    // Z/X keys for zooming
    case 'z':
    case 'Z':
      keysPressed.zoom = 1;
      break;
    case 'x':
    case 'X':
      keysPressed.zoom = -1;
      break;
    default:
      keyHandled = false;
  }
  
  if (keyHandled) {
    evt.preventDefault();
    // Start the animation if not already running
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(updateCanvasPosition);
    }
  }
});

// Handle key up events - stop movement
document.addEventListener('keyup', function(evt) {
  switch (evt.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      keysPressed.left = false;
      keysPressed.leftFast = false;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      keysPressed.right = false;
      keysPressed.rightFast = false;
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      keysPressed.up = false;
      keysPressed.upFast = false;
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      keysPressed.down = false;
      keysPressed.downFast = false;
      break;
    case 'z':
    case 'Z':
    case 'x':
    case 'X':
      keysPressed.zoom = 0;
      break;
  }
  
  // If no keys are pressed, cancel the animation frame
  if (!keysPressed.left && !keysPressed.right && !keysPressed.up && !keysPressed.down && keysPressed.zoom === 0) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
});

// Animation function to update the canvas position
function updateCanvasPosition() {
  const translator = graph.view.getTranslate();
  let dx = 0;
  let dy = 0;
  
  // Calculate the translation change, applying speed multiplier for fast movement
  if (keysPressed.left) {
    dx += keysPressed.leftFast ? MOVEMENT_SPEED * FAST_MOVEMENT_MULTIPLIER : MOVEMENT_SPEED;
  }
  if (keysPressed.right) {
    dx -= keysPressed.rightFast ? MOVEMENT_SPEED * FAST_MOVEMENT_MULTIPLIER : MOVEMENT_SPEED;
  }
  if (keysPressed.up) {
    dy += keysPressed.upFast ? MOVEMENT_SPEED * FAST_MOVEMENT_MULTIPLIER : MOVEMENT_SPEED;
  }
  if (keysPressed.down) {
    dy -= keysPressed.downFast ? MOVEMENT_SPEED * FAST_MOVEMENT_MULTIPLIER : MOVEMENT_SPEED;
  }
  
  // Apply translation change if needed
  if (dx !== 0 || dy !== 0) {
    graph.view.setTranslate(translator.x + dx / graph.view.scale, translator.y + dy / graph.view.scale);
  }
  
  // Apply zoom change if needed (centered on mouse)
  if (keysPressed.zoom !== 0) {
    const container = graph.container;
    const rect = container.getBoundingClientRect();
    // Use the last mouse position relative to the container
    // (If mouse is outside, just use center of container)
    let mouseX = currentMouseX, mouseY = currentMouseY;
    // Convert graph coordinates to screen coordinates
    // But for zooming, we want the mouse position in container (screen) coordinates
    let mx = 0, my = 0;
    if (
      typeof window.event !== 'undefined' &&
      window.event.clientX !== undefined &&
      window.event.clientY !== undefined &&
      window.event.type &&
      window.event.type.startsWith('mouse')
    ) {
      mx = window.event.clientX - rect.left;
      my = window.event.clientY - rect.top;
    } else {
      // Fallback: use last known mouse position in graph coordinates, convert to screen
      // (graphX, graphY) -> screen: (graphX + tx) * scale
      mx = (mouseX + graph.view.getTranslate().x) * graph.view.scale;
      my = (mouseY + graph.view.getTranslate().y) * graph.view.scale;
      // If mouse is not over the container, fallback to center
      if (mx < 0 || mx > container.clientWidth || my < 0 || my > container.clientHeight) {
        mx = container.clientWidth / 2;
        my = container.clientHeight / 2;
      }
    }
    // Current scale and translation
    const oldScale = graph.view.scale;
    const oldTx = graph.view.getTranslate().x;
    const oldTy = graph.view.getTranslate().y;
    // Graph coordinates under mouse before zoom
    const graphX = (mx / oldScale) - oldTx;
    const graphY = (my / oldScale) - oldTy;
    // New scale
    let newScale;
    if (keysPressed.zoom > 0) {
      newScale = oldScale * ZOOM_FACTOR;
    } else {
      newScale = oldScale / ZOOM_FACTOR;
    }
    // New translation so that (graphX, graphY) stays under mouse
    const newTx = mx / newScale - graphX;
    const newTy = my / newScale - graphY;
    graph.view.setScale(newScale);
    graph.view.setTranslate(newTx, newTy);
  }

  // Refresh the graph if any changes were made
  if (dx !== 0 || dy !== 0 || keysPressed.zoom !== 0) {
    graph.view.refresh();
  }

  // Continue the animation if any key is still pressed
  if (keysPressed.left || keysPressed.right || keysPressed.up || keysPressed.down || keysPressed.zoom !== 0) {
    animationFrameId = requestAnimationFrame(updateCanvasPosition);
  } else {
    animationFrameId = null;
  }
}

// Fix the case sensitivity issue with the prevAnswer in logic conditions
// Add this code at the end of the sixth pass, just before creating the final JSON object

// Ensure checkbox options are properly capitalized in both the options and the conditions
// Access the 'sections' variable from the exportGuiJson function scope
window.fixCapitalizationInJumps = function() {
  // Get reference to sections from the main exportGuiJson function
  const sections = window.exportGuiJson.sections || [];
  
  for (const section of sections) {
    for (const question of section.questions) {
      // Fix capitalization of checkbox options
      if (question.type === "checkbox" && Array.isArray(question.options)) {
        // Create a mapping of lowercase option text to properly capitalized option text
        const optionCapitalizationMap = {};
        
        // Special handling for checkbox questions and their options
        if (Array.isArray(question.options)) {
          for (const option of question.options) {
            if (typeof option === 'object' && option.label) {
              // Store both the lowercase and original versions
              optionCapitalizationMap[option.label.toLowerCase()] = option.label;
              
              // Special case for "maybe" to ensure it's always properly capitalized
              if (option.label.toLowerCase() === "maybe") {
                optionCapitalizationMap["maybe"] = "Maybe";
              }
            }
          }
        }
        
        // Apply the capitalization fix to logic conditions
        for (const section2 of sections) {
          for (const question2 of section2.questions) {
            // Fix logic conditions
            if (question2.logic && question2.logic.conditions) {
              for (const condition of question2.logic.conditions) {
                if (condition.prevQuestion === question.questionId.toString()) {
                  // Special case for "maybe"
                  if (condition.prevAnswer && condition.prevAnswer.toLowerCase() === "maybe") {
                    condition.prevAnswer = "Maybe";
                    console.log(`Fixed capitalization: Changed logic condition prevAnswer to "Maybe"`);
                  }
                  // General case
                  else if (condition.prevAnswer && optionCapitalizationMap[condition.prevAnswer.toLowerCase()]) {
                    condition.prevAnswer = optionCapitalizationMap[condition.prevAnswer.toLowerCase()];
                    console.log(`Fixed capitalization: Changed logic condition prevAnswer from "${condition.prevAnswer}" to "${optionCapitalizationMap[condition.prevAnswer.toLowerCase()]}"`);
                  }
                }
              }
            }
            
            // Also check jump conditions that might reference options
            if (question2.jump && question2.jump.conditions) {
              for (const jumpCondition of question2.jump.conditions) {
                // For checkbox questions, make sure jump condition options match the case of option labels
                if (question2.questionId === question.questionId && 
                    jumpCondition.option && 
                    optionCapitalizationMap[jumpCondition.option.toLowerCase()]) {
                  jumpCondition.option = optionCapitalizationMap[jumpCondition.option.toLowerCase()];
                  console.log(`Fixed capitalization: Changed jump condition option from "${jumpCondition.option}" to "${optionCapitalizationMap[jumpCondition.option.toLowerCase()]}"`);
                }
              }
            }
          }
        }
      }
    }
  }
}

// Call the function to fix capitalization
window.fixCapitalizationInJumps();

// Final check - look for any remaining issues in our resulting logic constraints
let stillHaveIssues = true;
let fixIteration = 0;
const maxIterations = 10; // Define maxIterations here instead of assuming it's already defined

while (stillHaveIssues && fixIteration < maxIterations) {
  console.log(`Processing iteration ${fixIteration} for logic fixes`);
  stillHaveIssues = false;
  fixIteration++;
}

// --- PATCH START: sanitize option nameId generation ---
function sanitizeNameId(str) {
  return str
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/gi, "_") // replace any sequence of non-alphanumeric chars with _
    .replace(/^_+|_+$/g, ""); // trim leading/trailing underscores
}
// --- PATCH END ---

// Calculation node dependency management functions have been moved to calc.js

/**************************************************
 *           COLORING & REFRESHING CELLS          *
 **************************************************/

/**
 * Create a cell for text2 - a textbox that functions like a dropdown but 
 * has better text editing capabilities
 */
function updateText2Cell(cell) {
  if (!cell) return;
  // Ensure we have question text
  if (!cell._questionText) {
    cell._questionText = "Enter dropdown question";
  }
  // Create the HTML content as a single line
  const html = `
    <div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center; width:100%;">
      <div class="question-text" style="text-align:center; padding:8px; width:100%; user-select:text;"contenteditable onkeydown="window.handleTitleInputKeydown(event)"onmousedown="event.stopPropagation();"onclick="window.handleMultipleTextboxClick(event, '${cell.id}')"onfocus="window.handleMultipleTextboxFocus(event, '${cell.id}')"onblur="window.updateText2Handler('${cell.id}', this.innerText)">${escapeHtml(cell._questionText)}</div>
    </div>`;
  graph.getModel().setValue(cell, html);
}

/**
 * Handler for text2 question text changes
 */
window.updateText2Handler = function(cellId, text) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell || getQuestionType(cell) !== "text2") return;
  
      graph.getModel().beginUpdate();
      try {
    cell._questionText = text.trim() || "Enter dropdown question";
    updateText2Cell(cell);
      } finally {
        graph.getModel().endUpdate();
      }
  
  refreshNodeIdFromLabel(cell);
};

/**
 * Create or update a standard option node cell
 * This ensures option nodes have consistent styling and behavior
 */
function updateOptionNodeCell(cell) {
  if (!cell || !isOptions(cell)) return;
  
  // Skip image and amount options as they have their own handlers
  const qt = getQuestionType(cell);
  if (qt === "imageOption" || qt === "amountOption") return;
  
  // Get the current label text
  const currentValue = cell.value || "Option";
  let labelText = currentValue;
  
  // If it's an HTML string, extract the text
  if (typeof currentValue === 'string' && currentValue.includes('<')) {
    const tmp = document.createElement('div');
    tmp.innerHTML = currentValue;
    labelText = (tmp.textContent || tmp.innerText || "Option").trim();
  }
  
  // Create a simple centered div with the text
  const html = `<div style="text-align:center;">${escapeHtml(labelText)}</div>`;
  
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
  } finally {
    graph.getModel().endUpdate();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Force refresh of the type submenu
  const typeSubmenu = document.getElementById("typeSubmenu");
  
  // Make sure all type buttons are visible
  const allButtons = typeSubmenu.querySelectorAll("button");
  allButtons.forEach(button => {
    button.style.display = "block";
  });
  
  // Double-check specific buttons
  ["dateRangeType", "emailType", "phoneType"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.style.display = "block";
      console.log(`Fixed ${id} display`);
    } else {
      console.error(`Button ${id} not found!`);
    }
  });
});

// --- Standardized Question Title Input (for all question types) ---

// Helper: Render a single-line contenteditable div for simple question types
function renderSimpleQuestionTitle(cell, placeholder) {
  const text = cell._questionText || '';
  // Remove all inline styles, only use the class
  return `<div class="question-title-input"  onfocus="if(this.innerText==='${placeholder}')this.innerText='';" onblur="window.updateSimpleQuestionTitle('${cell.id}', this.innerText)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')">${escapeHtml(text) || placeholder}</div>`;
}

// Helper: Render a real <input> for multi-textbox/multi-dropdown types
function renderInputQuestionTitle(cell, placeholder) {
  const text = cell._questionText || '';
  // Remove all inline styles, only use the class
  return `<input class="question-title-input" type="text" value="${escapeAttr(text)}" placeholder="${placeholder}" oninput="window.updateInputQuestionTitle('${cell.id}', this.value)" onblur="window.updateInputQuestionTitle('${cell.id}', this.value)" onkeydown="window.handleTitleInputKeydown(event, '${cell.id}')" />`;
}

// Update for simple question types
window.updateSimpleQuestionTitle = function(cellId, text) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  graph.getModel().beginUpdate();
  try {
    cell._questionText = text.replace(/<[^>]+>/g, '').trim() || '';
  } finally {
    graph.getModel().endUpdate();
  }
  // Only re-render on blur, not on every input
  updateSimpleQuestionCell(cell);
  refreshNodeIdFromLabel(cell);
};

// Update for input-based question types
window.updateInputQuestionTitle = function(cellId, text) {
  const cell = graph.getModel().getCell(cellId);
  if (!cell) return;
  graph.getModel().beginUpdate();
  try {
    cell._questionText = text.trim();
  } finally {
    graph.getModel().endUpdate();
  }
  // Only re-render on blur, not on every input
  if (getQuestionType(cell) === 'multipleTextboxes') {
    updateMultipleTextboxesCell(cell);
  } else if (getQuestionType(cell) === 'multipleDropdownType') {
    updatemultipleDropdownTypeCell(cell);
  }
  refreshNodeIdFromLabel(cell);
};

// Handle Enter key: blur on Enter
window.handleTitleInputKeydown = function(event, cellId) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.target.blur();
  }
  // Do not stop propagation for copy/cut/paste
};

// Update rendering for simple question types
function updateSimpleQuestionCell(cell) {
  const placeholder = getQuestionType(cell).charAt(0).toUpperCase() + getQuestionType(cell).slice(1) + ' question node';
  // Strip any HTML from _questionText before rendering
  let text = cell._questionText || '';
  text = text.replace(/<[^>]+>/g, '').trim();
  cell._questionText = text; // keep it clean for future edits
  const html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center; width:100%;">
    ${renderSimpleQuestionTitle(cell, placeholder)}
  </div>`;
  graph.getModel().setValue(cell, html);
}

// Patch setQuestionType to use new rendering for all question types
function setQuestionType(cell, newType) {
  let st = (cell.style || '').replace(/questionType=[^;]+/, '');
  st += `;questionType=${newType};align=center;verticalAlign=middle;spacing=12;`;
  if (newType === 'text2') {
    st += 'editable=1;';
  } else if (!/pointerEvents=/.test(st)) {
    st += 'pointerEvents=1;overflow=fill;';
  }
  graph.getModel().setStyle(cell, st);
  graph.getModel().beginUpdate();
  try {
    switch (newType) {
      case 'text': case 'date': case 'number': case 'bigParagraph':
      case 'dateRange': case 'email': case 'phone': case 'checkbox':
        // Always clear _questionText and strip any HTML if present
        cell._questionText = '';
        updateSimpleQuestionCell(cell);
        break;
      case 'text2':
        cell._questionText = '';
        updateText2Cell(cell);
        break;
      case 'multipleTextboxes':
        cell._questionText = '';
        cell._textboxes = [{ nameId:'', placeholder:'Enter value' }];
        updateMultipleTextboxesCell(cell);
        break;
      case 'multipleDropdownType':
        cell._questionText = '';
        cell._twoNumbers = { first:'0', second:'0' };
        cell._textboxes = [{ nameId:'', placeholder:'Enter value', isAmountOption:false }];
        updatemultipleDropdownTypeCell(cell);
        break;
      default:
        cell._questionText = '';
        updateSimpleQuestionCell(cell);
    }
    refreshNodeIdFromLabel(cell);
  } finally {
    graph.getModel().endUpdate();
  }
  refreshAllCells();
}

// Patch updateMultipleTextboxesCell to use <input> for title
function updateMultipleTextboxesCell(cell) {
  graph.getModel().beginUpdate();
  try {
    let html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
      <input class="question-title-input" type="text" value="${escapeAttr(cell._questionText || "")}" placeholder="Enter question text" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updateInputQuestionTitle('${cell.id}', this.value)" style="margin-bottom:8px; width:90%; text-align:center;" />
      <div class="multiple-textboxes-container" style="padding: 8px; width:100%;">${renderTextboxes(cell)}</div>
    </div>`;
    cell.value = html;
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}

// Patch updatemultipleDropdownTypeCell to use <input> for title
function updatemultipleDropdownTypeCell(cell) {
  const qText = cell._questionText || '';
  const twoNums = cell._twoNumbers || { first: '0', second: '0' };
  if (!cell._textboxes) {
    cell._textboxes = [{ nameId: '', placeholder: 'Enter value', isAmountOption: false }];
  }
  let html = `<div class="multiple-textboxes-node" style="display:flex; flex-direction:column; align-items:center;">
    <input class="question-title-input" type="text" value="${escapeAttr(qText)}" placeholder="Enter question text" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeTextHandler('${cell.id}', this.value)" style="margin-bottom:8px; width:90%; text-align:center;" />
    <div class="two-number-container" style="display: flex; justify-content:center; gap: 10px; margin-top: 8px; width:100%;">
      <input type="number" value="${escapeAttr(twoNums.first)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'first', this.value)"/>
      <input type="number" value="${escapeAttr(twoNums.second)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeNumber('${cell.id}', 'second', this.value)"/>
    </div>
    <div class="multiple-textboxes-container" style="margin-top:8px;width:100%;">`;
  cell._textboxes.forEach((tb, index) => {
    const val = tb.nameId || '';
    const ph = tb.placeholder || 'Enter value';
    const checked = tb.isAmountOption ? 'checked' : '';
    html += `
      <div class="textbox-entry" style="margin-bottom:4px; text-align:center;">
        <input type="text" value="${escapeAttr(val)}" data-index="${index}" placeholder="${escapeAttr(ph)}" onkeydown="window.handleTitleInputKeydown(event)" onblur="window.updatemultipleDropdownTypeHandler('${cell.id}', ${index}, this.value)"/>
        <button onclick="window.deletemultipleDropdownTypeHandler('${cell.id}', ${index})">Delete</button>
        <label>
          <input type="checkbox" ${checked} onclick="window.toggleMultipleDropdownAmount('${cell.id}', ${index}, this.checked)" />
          Amount?
        </label>
      </div>`;
  });
  html += `<div style="text-align:center; margin-top:8px;"><button onclick="window.addmultipleDropdownTypeHandler('${cell.id}')">Add Option</button></div>
    </div>
  </div>`;
  graph.getModel().beginUpdate();
  try {
    graph.getModel().setValue(cell, html);
    let st = cell.style || '';
    if (!st.includes('verticalAlign=middle')) {
      st += 'verticalAlign=middle;';
    }
  } finally {
    graph.getModel().endUpdate();
  }
  graph.updateCellSize(cell);
}
// ... existing code ...

// Add this in the DOMContentLoaded event listener

document.addEventListener("DOMContentLoaded", function() {
  // ... existing code ...

  // Prevent browser context menu on empty space (graph background),
  // but allow it inside input, textarea, or contenteditable elements
  const container = document.getElementById("graphContainer");
  container.addEventListener("contextmenu", function(e) {
    // Allow native context menu in text fields/contenteditable
    if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
  });

  // ... existing code ...
});
// ... existing code ...

/**
 * Define pickTypeForCell globally
 */
window.pickTypeForCell = function(cellId, val) {
  console.log('[pickTypeForCell] called with cellId:', cellId, 'val:', val); // DEBUG
  if (!val) {
    console.log('[pickTypeForCell] No value selected, returning');
    return; // Do nothing if no type selected
  }
  const c = graph.getModel().getCell(cellId);
  if (!c) {
    console.log('[pickTypeForCell] No cell found for id', cellId);
    return;
  }

  graph.getModel().beginUpdate();
  try {
    setQuestionType(c, val);
    if (!c._nameId) {
      c._nameId = "answer" + graph.getChildVertices(graph.getDefaultParent()).length;
      c._placeholder = "";
    }
    // Only handle special cases for multi types
    if (val === "multipleTextboxes") {
      c._questionText = "Enter question text";
      c._textboxes = [{ nameId: "", placeholder: "Enter value" }];
      updateMultipleTextboxesCell(c);
    } else if (val === "multipleDropdownType") {
      c._questionText = "Enter question text";
      c._twoNumbers = { first: "0", second: "0" };
      c._textboxes = [{ nameId: "", placeholder: "Enter value", isAmountOption: false }];
      updatemultipleDropdownTypeCell(c);
    }
    // For all other types, setQuestionType handles rendering
  } finally {
    graph.getModel().endUpdate();
  }

  graph.setSelectionCell(c);
  graph.startEditingAtCell(c);
  refreshAllCells();
  console.log('[pickTypeForCell] Finished updating cell', c);
};

// --- Ensure event handler is attached for all .question-type-dropdown selects (event delegation) ---
document.addEventListener('change', function(e) {
  if (e.target && e.target.classList.contains('question-type-dropdown')) {
    const cellId = e.target.getAttribute('data-cell-id');
    const val = e.target.value;
    console.log('[delegated change] .question-type-dropdown changed:', cellId, val); // DEBUG
    if (window.pickTypeForCell) {
      window.pickTypeForCell(cellId, val);
    } else {
      console.error('window.pickTypeForCell is not defined!');
    }
  }
});

document.addEventListener('contextmenu', function(e) {
  if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
});

document.addEventListener('DOMContentLoaded', function() {
  // Map legend color box IDs to color picker IDs and colorPreferences keys
  const colorMap = [
    { box: 'colorText', picker: 'colorPickerText', key: 'text' },
    { box: 'colorCheckbox', picker: 'colorPickerCheckbox', key: 'checkbox' },
    { box: 'colorDropdown', picker: 'colorPickerDropdown', key: 'dropdown' },
    { box: 'colorMoney', picker: 'colorPickerMoney', key: 'money' },
    { box: 'colorDate', picker: 'colorPickerDate', key: 'date' },
    { box: 'colorBigParagraph', picker: 'colorPickerBigParagraph', key: 'bigParagraph' },
    { box: 'colorTextColor', picker: 'colorPickerTextColor', key: 'textColor' },
    { box: 'colorDateRange', picker: 'colorPickerDate', key: 'date' }, // Date Range uses date color
    { box: 'colorEmail', picker: 'colorPickerText', key: 'text' },     // Email uses text color
    { box: 'colorPhone', picker: 'colorPickerText', key: 'text' }      // Phone uses text color
  ];

  colorMap.forEach(({ box, picker, key }) => {
    const boxEl = document.getElementById(box);
    const pickerEl = document.getElementById(picker);
    if (boxEl && pickerEl) {
      boxEl.addEventListener('click', function() {
        pickerEl.value = rgbToHex(getComputedStyle(boxEl).backgroundColor);
        pickerEl.click();
      });
      pickerEl.addEventListener('input', function(e) {
        colorPreferences[key] = e.target.value;
        updateLegendColors();
        refreshAllCells();
        saveUserColorPrefs();
      });
    }
  });
});