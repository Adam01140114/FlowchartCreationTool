/**************************************************
 *            AUTHENTICATION & USER MANAGEMENT     *
 **************************************************/

// Import configuration from config.js
// Note: This assumes config.js is loaded before auth.js

/**
 * Sets a cookie with the given name and value.
 */
function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

/**
 * Gets a cookie by name.
 */
function getCookie(name) {
  const cname = name + "=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(cname) === 0) {
      return c.substring(cname.length, c.length);
    }
  }
  return "";
}

/**
 * Shows the login overlay.
 */
function showLoginOverlay() {
  const loginOverlay = document.getElementById("loginOverlay");
  if (loginOverlay) {
    loginOverlay.style.display = "flex";
  }
}

/**
 * Hides the login overlay.
 */
function hideLoginOverlay() {
  const loginOverlay = document.getElementById("loginOverlay");
  if (loginOverlay) {
    loginOverlay.style.display = "none";
  }
}

/**
 * Checks for saved login credentials and tries to log in.
 */
function checkForSavedLogin() {
  // Check for saved user ID in cookie
  const savedUid = getCookie("flowchart_uid");
  
  if (savedUid) {
    // Try to restore user session
    firebase.auth().onAuthStateChanged((user) => {
      if (user && user.uid === savedUid) {
        // User is already authenticated
        window.currentUser = user;
        hideLoginOverlay();
        
        // Load user preferences
        if (typeof loadUserColorPrefs === 'function') {
          loadUserColorPrefs();
        }
      } else {
        // Clear invalid cookie
        setCookie("flowchart_uid", "", -1);
        showLoginOverlay();
      }
    });
  } else {
    // No saved login, show login overlay
    showLoginOverlay();
  }
}

/**
 * Sets up event listeners for authentication.
 */
function setupAuthListeners() {
  // Get DOM elements
  const loginButton = document.getElementById("loginButton");
  const signupButton = document.getElementById("signupButton");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");

  if (!loginButton || !signupButton || !loginEmail || !loginPassword || !loginError || !logoutBtn) {
    console.warn("Some authentication elements not found");
    return;
  }

  // Login button event listener
  loginButton.addEventListener("click", () => {
    const email = loginEmail.value.trim();
    const pass = loginPassword.value.trim();
    
    if (!email || !pass) {
      loginError.textContent = "Please enter both email and password.";
      return;
    }

    firebase.auth().signInWithEmailAndPassword(email, pass)
      .then(cred => {
        window.currentUser = cred.user;
        setCookie("flowchart_uid", window.currentUser.uid, 7);
        hideLoginOverlay();
        
        // Load user color preferences
        if (typeof loadUserColorPrefs === 'function') {
          loadUserColorPrefs();
        }
        
        loginError.textContent = "";
      })
      .catch(err => {
        loginError.textContent = err.message;
      });
  });

  // Signup button event listener
  signupButton.addEventListener("click", () => {
    const email = loginEmail.value.trim();
    const pass = loginPassword.value.trim();
    
    if (!email || !pass) {
      loginError.textContent = "Please enter both email and password.";
      return;
    }

    if (pass.length < 6) {
      loginError.textContent = "Password must be at least 6 characters.";
      return;
    }

    firebase.auth().createUserWithEmailAndPassword(email, pass)
      .then(cred => {
        window.currentUser = cred.user;
        setCookie("flowchart_uid", window.currentUser.uid, 7);
        hideLoginOverlay();
        
        // Save and load user color preferences
        if (typeof saveUserColorPrefs === 'function' && typeof loadUserColorPrefs === 'function') {
          saveUserColorPrefs().then(() => loadUserColorPrefs());
        }
        
        loginError.textContent = "";
      })
      .catch(err => {
        loginError.textContent = err.message;
      });
  });

  // Logout button event listener
  logoutBtn.addEventListener("click", () => {
    if (!window.currentUser) {
      alert("No user is logged in.");
      return;
    }
    
    firebase.auth().signOut()
      .then(() => {
        setCookie("flowchart_uid", "", -1);
        window.currentUser = null;
        showLoginOverlay();
      })
      .catch(err => {
        // Logout error handled silently
        alert("Error logging out: " + err);
      });
  });

  // Close button for login overlay
  const closeLoginBtn = document.getElementById("closeLoginBtn");
  if (closeLoginBtn) {
    closeLoginBtn.addEventListener("click", () => {
      hideLoginOverlay();
    });
  }
}

/**
 * Load user color preferences from Firebase.
 */
function loadUserColorPrefs() {
  if (!window.currentUser || window.currentUser.isGuest) return;
  
  // Access db from config
  if (typeof window.flowchartConfig !== 'undefined' && window.flowchartConfig.db) {
    const db = window.flowchartConfig.db;
    const colorPreferences = window.flowchartConfig.colorPreferences;
    const defaultColors = window.flowchartConfig.defaultColors;
    
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
        
        // Update legend colors
        if (typeof updateLegendColors === 'function') {
          updateLegendColors();
        }
        
        // Refresh all cells
        if (typeof refreshAllCells === 'function') {
          refreshAllCells();
        }
      })
      .catch(err => {
        // Error loading color preferences handled silently
      });
  }
}

/**
 * Save user color preferences to Firebase.
 */
function saveUserColorPrefs() {
  if (!window.currentUser || window.currentUser.isGuest) return Promise.resolve();
  
  // Access db from config
  if (typeof window.flowchartConfig !== 'undefined' && window.flowchartConfig.db) {
    const db = window.flowchartConfig.db;
    const colorPreferences = window.flowchartConfig.colorPreferences;
    
    return db.collection("users")
      .doc(window.currentUser.uid)
      .collection("preferences")
      .doc("colors")
      .set(colorPreferences, { merge: true });
  }
  
  return Promise.resolve();
}

/**
 * Auto-login function for development/testing.
 */
function autoLogin() {
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginButton = document.getElementById("loginButton");
  
  if (loginEmail && loginPassword && loginButton) {
    // Set default credentials (can be customized)
    loginEmail.value = "defaultemail0114@gmail.com";
    loginPassword.value = "adam0114";
    
    // Add a small delay to ensure the form is filled before clicking
    setTimeout(() => {
      loginButton.click();
    }, 500);
  }
}

/**
 * Initialize authentication system.
 */
function initializeAuth() {
  // Set up authentication state listener
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // User is signed in
      window.currentUser = user;
      hideLoginOverlay();
      
      // Load user preferences
      loadUserColorPrefs();
    } else {
      // User is signed out
      window.currentUser = null;
      showLoginOverlay();
    }
  });

  // Set up event listeners
  setupAuthListeners();
  
  // Check for saved login
  checkForSavedLogin();
}

/**************************************************
 ************ Export Authentication ****************
 **************************************************/
// Export all authentication functions
window.auth = {
  // Functions
  setCookie,
  getCookie,
  showLoginOverlay,
  hideLoginOverlay,
  checkForSavedLogin,
  setupAuthListeners,
  loadUserColorPrefs,
  saveUserColorPrefs,
  autoLogin,
  initializeAuth,
  
  // State
  currentUser: null
};

// Also export individual functions for backward compatibility
window.setCookie = setCookie;
window.getCookie = getCookie;
window.showLoginOverlay = showLoginOverlay;
window.hideLoginOverlay = hideLoginOverlay;
window.checkForSavedLogin = checkForSavedLogin;
window.setupAuthListeners = setupAuthListeners;
window.loadUserColorPrefs = loadUserColorPrefs;
window.saveUserColorPrefs = saveUserColorPrefs;
window.autoLogin = autoLogin;
window.initializeAuth = initializeAuth;

// Initialize authentication when the document is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for config.js to load
  setTimeout(() => {
    initializeAuth();
  }, 100);
}); 