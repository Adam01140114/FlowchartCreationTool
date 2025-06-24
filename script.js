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

function previewForm() {
  // Generate the GUI JSON string (do not download)
  let guiJsonStr = "";
  if (typeof window.exportGuiJson === "function") {
    // exportGuiJson returns the JSON string if called directly
    guiJsonStr = window.exportGuiJson(false);
    if (typeof guiJsonStr !== "string") {
      // If it returned an object, convert to string
      guiJsonStr = JSON.stringify(guiJsonStr, null, 2);
    }
  }
  if (guiJsonStr) {
    navigator.clipboard.writeText(guiJsonStr).then(() => {
      // Optionally, show a message: copied!
    });
  }
  // Open the GUI preview in a new tab
  window.open('FormWiz%20GUI/gui.html', '_blank');
}

// AUTOSAVE FLOWCHART TO COOKIES FEATURE
// --- AUTOSAVE CONSTANTS ---
const AUTOSAVE_KEY = 'flowchart_autosave_json';

// --- AUTOSAVE CORE FUNCTIONS (localStorage version) ---
function autosaveFlowchartToLocalStorage() {
  try {
    if (!graph) return;
    const parent = graph.getDefaultParent();
    const cells = graph.getChildCells(parent, true, true);
    const sectionPrefsCopy = JSON.parse(JSON.stringify(sectionPrefs));
    const data = { cells: [], sectionPrefs: sectionPrefsCopy };
    cells.forEach(cell => {
      const cellData = {};
      for (let key in cell) {
        if (Object.prototype.hasOwnProperty.call(cell, key)) {
          cellData[key] = cell[key];
        }
      }
      // Remove graph/model references
      delete cellData.parent;
      delete cellData.children;
      data.cells.push(cellData);
    });
    const json = JSON.stringify(data);
    localStorage.setItem(AUTOSAVE_KEY, json);
    console.log('[AUTOSAVE][localStorage] Flowchart autosaved. Length:', json.length);
  } catch (e) {
    console.log('[AUTOSAVE][localStorage] Error during autosave:', e);
  }
}

function clearAutosaveLocalStorage() {
  localStorage.removeItem(AUTOSAVE_KEY);
  console.log('[AUTOSAVE][localStorage] Cleared autosave.');
}

function getAutosaveFlowchartFromLocalStorage() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  console.log('[AUTOSAVE][localStorage][get] Raw value:', raw ? raw.substring(0, 100) : raw);
  if (!raw) {
    console.log('[AUTOSAVE][localStorage] No autosave found.');
    return null;
  }
  try {
    const data = JSON.parse(raw);
    console.log('[AUTOSAVE][localStorage] Loaded autosave JSON. Length:', raw.length);
    return data;
  } catch (e) {
    console.log('[AUTOSAVE][localStorage] Error parsing autosave:', e);
    return null;
  }
}

// --- AUTOSAVE HOOKS ---
function setupAutosaveHooks() {
  if (!graph) return;
  // Save after any model change
  graph.getModel().addListener(mxEvent.CHANGE, function() {
    autosaveFlowchartToLocalStorage();
  });
  // Save after refreshAllCells (in case of programmatic changes)
  const origRefreshAllCells = window.refreshAllCells;
  window.refreshAllCells = function() {
    origRefreshAllCells.apply(this, arguments);
    autosaveFlowchartToLocalStorage();
  };
  // Save after loadFlowchartData
  const origLoadFlowchartData = window.loadFlowchartData;
  window.loadFlowchartData = function(data) {
    origLoadFlowchartData.apply(this, arguments);
    autosaveFlowchartToLocalStorage();
  };
  console.log('[AUTOSAVE][localStorage] Autosave hooks set up.');
}

// --- AUTOSAVE RESTORE PROMPT ---
function showAutosaveRestorePrompt() {
  let modal = document.createElement('div');
  modal.id = 'autosaveRestoreModal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = 'rgba(0,0,0,0.5)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';

  let box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '32px 40px';
  box.style.borderRadius = '12px';
  box.style.boxShadow = '0 4px 32px rgba(0,0,0,0.18)';
  box.style.textAlign = 'center';
  box.innerHTML = `<h2>Pick up where you left off?</h2><p>We found an autosaved flowchart. Would you like to continue editing it?</p>`;

  let yesBtn = document.createElement('button');
  yesBtn.textContent = 'Yes';
  yesBtn.style.margin = '12px 24px 0 0';
  yesBtn.style.padding = '10px 28px';
  yesBtn.style.fontSize = '1.1em';
  yesBtn.style.borderRadius = '6px';
  yesBtn.style.background = '#1976d2';
  yesBtn.style.color = '#fff';
  yesBtn.style.border = 'none';
  yesBtn.style.cursor = 'pointer';

  let noBtn = document.createElement('button');
  noBtn.textContent = 'No';
  noBtn.style.margin = '12px 0 0 0';
  noBtn.style.padding = '10px 28px';
  noBtn.style.fontSize = '1.1em';
  noBtn.style.borderRadius = '6px';
  noBtn.style.background = '#bbb';
  noBtn.style.color = '#222';
  noBtn.style.border = 'none';
  noBtn.style.cursor = 'pointer';

  yesBtn.onclick = function() {
    modal.remove();
    const data = getAutosaveFlowchartFromLocalStorage();
    if (data) {
      window.loadFlowchartData(data);
      console.log('[AUTOSAVE][localStorage] User chose YES: loaded autosaved flowchart.');
    }
    setTimeout(safeSetupAutosaveHooks, 500);
  };
  noBtn.onclick = function() {
    modal.remove();
    clearAutosaveLocalStorage();
    window.location.reload();
    console.log('[AUTOSAVE][localStorage] User chose NO: cleared autosave and reloaded.');
  };

  box.appendChild(yesBtn);
  box.appendChild(noBtn);
  modal.appendChild(box);
  document.body.appendChild(modal);
  console.log('[AUTOSAVE][localStorage] Restore prompt shown.');
}

// --- INIT AUTOSAVE ON PAGE LOAD ---
let autosaveHooksSetup = false;
function safeSetupAutosaveHooks() {
  if (!autosaveHooksSetup) {
    setupAutosaveHooks();
    autosaveHooksSetup = true;
  }
}
document.addEventListener('DOMContentLoaded', function() {
  const autosaveData = getAutosaveFlowchartFromLocalStorage();
  if (autosaveData && autosaveData.cells && autosaveData.cells.length > 0) {
    showAutosaveRestorePrompt();
  } else {
    setTimeout(safeSetupAutosaveHooks, 1000);
  }
});