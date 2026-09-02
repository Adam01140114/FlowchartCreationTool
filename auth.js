/**************************************************
 *            AUTHENTICATION & USER MANAGEMENT     *
 **************************************************/
const GUEST_UID = 'guest';
const GUEST_COOKIE = 'flowchart_guest';
const GUEST_COOKIE_DAYS = 365;
const GUEST_CHUNK_SIZE = 2800;
const GUEST_INDEX_COOKIE = 'fwg_i';
const GUEST_COLORS_COOKIE = 'fwg_c';
const GUEST_SETTINGS_COOKIE = 'fwg_s';
const GUEST_LS_PREFIX = 'fwg_ls_';
/**
 * Sets a cookie with the given name and value.
 */
function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/;SameSite=Lax";
}
/**
 * Gets a cookie by name.
 */
function getCookie(name) {
  const prefix = name + "=";
  const parts = document.cookie.split(';');
  for (let i = 0; i < parts.length; i++) {
    let c = parts[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(prefix) === 0) {
      return c.substring(prefix.length, c.length);
    }
  }
  return "";
}
function deleteCookie(name) {
  document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
}
function isGuestUser() {
  return !!(window.currentUser && window.currentUser.isGuest);
}
function isSavedGuestSession() {
  return getCookie(GUEST_COOKIE) === '1';
}
function deleteChunkedCookie(key) {
  const nRaw = getCookie(key + '_n');
  if (nRaw === 'ls') {
    try { localStorage.removeItem(GUEST_LS_PREFIX + key); } catch (e) {}
  } else {
    const n = parseInt(nRaw, 10) || 0;
    for (let i = 0; i < n; i++) {
      deleteCookie(key + '_' + i);
    }
  }
  deleteCookie(key + '_n');
}
function writeChunkedCookie(key, stringValue) {
  deleteChunkedCookie(key);
  const encoded = encodeURIComponent(stringValue || '');
  if (!encoded) {
    return true;
  }
  // Cookies are ~4KB each. Overflow to localStorage only when a flowchart
  // is too large for a reasonable number of cookie chunks.
  if (encoded.length > GUEST_CHUNK_SIZE * 40) {
    try {
      localStorage.setItem(GUEST_LS_PREFIX + key, stringValue);
      setCookie(key + '_n', 'ls', GUEST_COOKIE_DAYS);
      return true;
    } catch (e) {
      return false;
    }
  }
  const n = Math.ceil(encoded.length / GUEST_CHUNK_SIZE);
  for (let i = 0; i < n; i++) {
    setCookie(key + '_' + i, encoded.substring(i * GUEST_CHUNK_SIZE, (i + 1) * GUEST_CHUNK_SIZE), GUEST_COOKIE_DAYS);
  }
  setCookie(key + '_n', String(n), GUEST_COOKIE_DAYS);
  return true;
}
function readChunkedCookie(key) {
  const nRaw = getCookie(key + '_n');
  if (nRaw === 'ls') {
    try { return localStorage.getItem(GUEST_LS_PREFIX + key) || ''; } catch (e) { return ''; }
  }
  const n = parseInt(nRaw, 10);
  if (!n) return '';
  let encoded = '';
  for (let i = 0; i < n; i++) {
    encoded += getCookie(key + '_' + i);
  }
  try {
    return decodeURIComponent(encoded);
  } catch (e) {
    return encoded;
  }
}
function readGuestJsonCookie(name, fallback) {
  const raw = getCookie(name);
  if (!raw) return fallback;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch (e) {
    try {
      return JSON.parse(raw);
    } catch (e2) {
      return fallback;
    }
  }
}
function writeGuestJsonCookie(name, value) {
  setCookie(name, encodeURIComponent(JSON.stringify(value)), GUEST_COOKIE_DAYS);
}
function getGuestFlowchartIndex() {
  const index = readGuestJsonCookie(GUEST_INDEX_COOKIE, []);
  return Array.isArray(index) ? index : [];
}
function setGuestFlowchartIndex(index) {
  writeGuestJsonCookie(GUEST_INDEX_COOKIE, index);
}
function flowchartCookieKey(id) {
  return 'fwg_d_' + id;
}
const guestStorage = {
  saveFlowchart(name, payload) {
    return new Promise((resolve, reject) => {
      try {
        const index = getGuestFlowchartIndex();
        let entry = index.find(item => item.name === name);
        if (!entry) {
          entry = { id: String(Date.now()), name: name, lastUsed: payload.lastUsed || Date.now() };
          index.push(entry);
        } else {
          entry.lastUsed = payload.lastUsed || Date.now();
        }
        const ok = writeChunkedCookie(flowchartCookieKey(entry.id), JSON.stringify(payload));
        if (!ok) {
          reject(new Error('This flowchart is too large to save in cookies.'));
          return;
        }
        setGuestFlowchartIndex(index);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  },
  listFlowcharts() {
    return new Promise((resolve) => {
      const index = getGuestFlowchartIndex();
      const flowcharts = index.map(entry => {
        let data = {};
        try {
          const raw = readChunkedCookie(flowchartCookieKey(entry.id));
          data = raw ? JSON.parse(raw) : {};
        } catch (e) {
          data = {};
        }
        return {
          name: entry.name,
          lastUsed: entry.lastUsed || data.lastUsed || 0,
          data: data
        };
      });
      flowcharts.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
      resolve(flowcharts);
    });
  },
  getFlowchart(name) {
    return new Promise((resolve, reject) => {
      const entry = getGuestFlowchartIndex().find(item => item.name === name);
      if (!entry) {
        resolve(null);
        return;
      }
      try {
        const raw = readChunkedCookie(flowchartCookieKey(entry.id));
        resolve(raw ? JSON.parse(raw) : null);
      } catch (err) {
        reject(err);
      }
    });
  },
  updateLastUsed(name) {
    return new Promise((resolve) => {
      const index = getGuestFlowchartIndex();
      const entry = index.find(item => item.name === name);
      if (entry) {
        entry.lastUsed = Date.now();
        setGuestFlowchartIndex(index);
        guestStorage.getFlowchart(name).then(payload => {
          if (payload) {
            payload.lastUsed = entry.lastUsed;
            writeChunkedCookie(flowchartCookieKey(entry.id), JSON.stringify(payload));
          }
          resolve();
        }).catch(() => resolve());
        return;
      }
      resolve();
    });
  },
  renameFlowchart(oldName, newName) {
    return new Promise((resolve, reject) => {
      const index = getGuestFlowchartIndex();
      const entry = index.find(item => item.name === oldName);
      if (!entry) {
        reject(new Error('No flowchart named ' + oldName));
        return;
      }
      if (index.some(item => item.name === newName)) {
        reject(new Error('A flowchart named "' + newName + '" already exists.'));
        return;
      }
      entry.name = newName;
      setGuestFlowchartIndex(index);
      resolve(entry);
    });
  },
  deleteFlowchart(name) {
    return new Promise((resolve) => {
      const index = getGuestFlowchartIndex();
      const entry = index.find(item => item.name === name);
      const next = index.filter(item => item.name !== name);
      if (entry) {
        deleteChunkedCookie(flowchartCookieKey(entry.id));
      }
      setGuestFlowchartIndex(next);
      resolve();
    });
  },
  saveColors(colors) {
    writeGuestJsonCookie(GUEST_COLORS_COOKIE, colors || {});
    return Promise.resolve();
  },
  loadColors() {
    return Promise.resolve(readGuestJsonCookie(GUEST_COLORS_COOKIE, null));
  },
  saveSettings(settings) {
    const current = readGuestJsonCookie(GUEST_SETTINGS_COOKIE, {});
    writeGuestJsonCookie(GUEST_SETTINGS_COOKIE, Object.assign({}, current, settings || {}));
    return Promise.resolve();
  },
  loadSettings() {
    return Promise.resolve(readGuestJsonCookie(GUEST_SETTINGS_COOKIE, null));
  }
};
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
function activateGuestSession() {
  window.currentUser = {
    uid: GUEST_UID,
    isGuest: true,
    email: 'guest@local',
    displayName: 'Guest'
  };
  setCookie(GUEST_COOKIE, '1', GUEST_COOKIE_DAYS);
  setCookie("flowchart_uid", GUEST_UID, GUEST_COOKIE_DAYS);
  hideLoginOverlay();
  const loginError = document.getElementById("loginError");
  if (loginError) {
    loginError.textContent = "";
  }
  if (typeof loadUserColorPrefs === 'function') {
    loadUserColorPrefs();
  }
}
function loginAsGuest() {
  setCookie(GUEST_COOKIE, '1', GUEST_COOKIE_DAYS);
  setCookie("flowchart_uid", GUEST_UID, GUEST_COOKIE_DAYS);
  if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
    firebase.auth().signOut().catch(() => {
      activateGuestSession();
    });
    return;
  }
  activateGuestSession();
}
function logoutGuest() {
  deleteCookie(GUEST_COOKIE);
  setCookie("flowchart_uid", "", -1);
  window.currentUser = null;
  showLoginOverlay();
}
/**
 * Checks for saved login credentials and tries to log in.
 */
function checkForSavedLogin() {
  if (isSavedGuestSession()) {
    activateGuestSession();
    return;
  }
  const savedUid = getCookie("flowchart_uid");
  if (savedUid && savedUid !== GUEST_UID) {
    firebase.auth().onAuthStateChanged((user) => {
      if (user && user.uid === savedUid) {
        window.currentUser = user;
        hideLoginOverlay();
        if (typeof loadUserColorPrefs === 'function') {
          loadUserColorPrefs();
        }
      } else if (isGuestUser() || isSavedGuestSession()) {
        activateGuestSession();
      } else {
        setCookie("flowchart_uid", "", -1);
        showLoginOverlay();
      }
    });
  } else if (!window.currentUser) {
    showLoginOverlay();
  }
}
/**
 * Sets up event listeners for authentication.
 */
function setupAuthListeners() {
  const loginButton = document.getElementById("loginButton");
  const signupButton = document.getElementById("signupButton");
  const guestLoginBtn = document.getElementById("guestLoginBtn");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");
  if (loginButton && loginEmail && loginPassword && loginError) {
    loginButton.addEventListener("click", () => {
      const email = loginEmail.value.trim();
      const pass = loginPassword.value.trim();
      if (!email || !pass) {
        loginError.textContent = "Please enter both email and password.";
        return;
      }
      firebase.auth().signInWithEmailAndPassword(email, pass)
        .then(cred => {
          deleteCookie(GUEST_COOKIE);
          window.currentUser = cred.user;
          setCookie("flowchart_uid", window.currentUser.uid, 7);
          hideLoginOverlay();
          if (typeof loadUserColorPrefs === 'function') {
            loadUserColorPrefs();
          }
          loginError.textContent = "";
        })
        .catch(err => {
          loginError.textContent = err.message;
        });
    });
  }
  if (signupButton && loginEmail && loginPassword && loginError) {
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
          deleteCookie(GUEST_COOKIE);
          window.currentUser = cred.user;
          setCookie("flowchart_uid", window.currentUser.uid, 7);
          hideLoginOverlay();
          if (typeof saveUserColorPrefs === 'function' && typeof loadUserColorPrefs === 'function') {
            saveUserColorPrefs().then(() => loadUserColorPrefs());
          }
          loginError.textContent = "";
        })
        .catch(err => {
          loginError.textContent = err.message;
        });
    });
  }
  if (guestLoginBtn) {
    guestLoginBtn.addEventListener("click", () => {
      loginAsGuest();
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (!window.currentUser) {
        alert("No user is logged in.");
        return;
      }
      if (isGuestUser()) {
        logoutGuest();
        return;
      }
      firebase.auth().signOut()
        .then(() => {
          setCookie("flowchart_uid", "", -1);
          window.currentUser = null;
          showLoginOverlay();
        })
        .catch(err => {
          alert("Error logging out: " + err);
        });
    });
  }
  const closeLoginBtn = document.getElementById("closeLoginBtn");
  if (closeLoginBtn) {
    closeLoginBtn.addEventListener("click", () => {
      hideLoginOverlay();
    });
  }
}
function applyColorPrefs(data) {
  const colorPreferences = (window.flowchartConfig && window.flowchartConfig.colorPreferences) || window.colorPreferences;
  const defaultColors = (window.flowchartConfig && window.flowchartConfig.defaultColors) || window.defaultColors;
  if (!colorPreferences || !defaultColors || !data) return;
  for (let key in defaultColors) {
    if (data[key] !== undefined) {
      colorPreferences[key] = data[key];
    } else {
      colorPreferences[key] = defaultColors[key];
    }
  }
  if (typeof updateLegendColors === 'function') {
    updateLegendColors();
  }
  if (typeof refreshAllCells === 'function') {
    refreshAllCells();
  }
}
/**
 * Load user color preferences from Firebase or guest cookies.
 */
function loadUserColorPrefs() {
  if (!window.currentUser) return;
  if (isGuestUser()) {
    guestStorage.loadColors().then(data => {
      if (data) applyColorPrefs(data);
    });
    return;
  }
  if (typeof window.flowchartConfig !== 'undefined' && window.flowchartConfig.db) {
    const db = window.flowchartConfig.db;
    db.collection("users")
      .doc(window.currentUser.uid)
      .collection("preferences")
      .doc("colors")
      .get()
      .then(docSnap => {
        if (docSnap.exists) {
          applyColorPrefs(docSnap.data());
        }
      })
      .catch(err => {
      });
  }
}
/**
 * Save user color preferences to Firebase or guest cookies.
 */
function saveUserColorPrefs() {
  if (!window.currentUser) return Promise.resolve();
  const colorPreferences = (window.flowchartConfig && window.flowchartConfig.colorPreferences) || window.colorPreferences;
  if (isGuestUser()) {
    return guestStorage.saveColors(colorPreferences);
  }
  if (typeof window.flowchartConfig !== 'undefined' && window.flowchartConfig.db) {
    const db = window.flowchartConfig.db;
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
  if (loginEmail && loginPassword && loginButton && loginEmail.value && loginPassword.value) {
    setTimeout(() => {
      loginButton.click();
    }, 500);
  }
}
/**
 * Initialize authentication system.
 */
function initializeAuth() {
  setupAuthListeners();
  if (isSavedGuestSession()) {
    activateGuestSession();
  }
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      deleteCookie(GUEST_COOKIE);
      window.currentUser = user;
      hideLoginOverlay();
      loadUserColorPrefs();
      return;
    }
    if (isSavedGuestSession() || isGuestUser()) {
      activateGuestSession();
      return;
    }
    window.currentUser = null;
    showLoginOverlay();
  });
}
/**************************************************
 ************ Export Authentication ****************
 **************************************************/
window.auth = {
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
  loginAsGuest,
  isGuestUser,
  guestStorage,
  currentUser: null
};
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
window.loginAsGuest = loginAsGuest;
window.isGuestUser = isGuestUser;
window.guestStorage = guestStorage;
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initializeAuth();
  }, 100);
});
