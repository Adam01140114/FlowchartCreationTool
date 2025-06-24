/**************************************************
 *            AUTHENTICATION & COOKIES             *
 **************************************************/

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
  document.getElementById("loginOverlay").style.display = "flex";
}

/**
 * Hides the login overlay.
 */
function hideLoginOverlay() {
  document.getElementById("loginOverlay").style.display = "none";
}

/**
 * Checks for saved login credentials and tries to log in.
 */
function checkForSavedLogin() {
  // Firebase configuration - This should be set in the main HTML file
  // Set up your Firebase config if not already done
  if (!firebase.apps.length) {
    try {
      const firebaseConfig = {
        apiKey: "AIzaSyC8YKJFyw1a_9-P996NrjXCLCPOGQC8SL8",
        authDomain: "flow-chart-50c82.firebaseapp.com",
        projectId: "flow-chart-50c82",
        storageBucket: "flow-chart-50c82.appspot.com",
        messagingSenderId: "607845271405",
        appId: "1:607845271405:web:ab396cde5c056f6cba193b"
      };
      firebase.initializeApp(firebaseConfig);
    } catch (err) {
      // Remove all console.log, console.error, and console.warn calls from this file
    }
  }

  // Check for saved credentials
  const savedEmail = getCookie("flowchart_email");
  const savedToken = getCookie("flowchart_token");

  if (savedEmail && savedToken) {
    firebase.auth().signInWithEmailAndPassword(savedEmail, savedToken)
      .then((userCredential) => {
        // User is signed in
        window.currentUser = userCredential.user;
        hideLoginOverlay();
        
        // Set up logout button
        document.getElementById("logoutBtn").addEventListener("click", () => {
          firebase.auth().signOut().then(() => {
            setCookie("flowchart_email", "", -1);
            setCookie("flowchart_token", "", -1);
            window.currentUser = null;
            showLoginOverlay();
          });
        });
      })
      .catch((error) => {
        if (error.code === 'auth/quota-exceeded') {
          // Sign in as guest
          window.currentUser = {
            uid: 'guest',
            email: 'guest@guest.com',
            displayName: 'Guest',
            isGuest: true
          };
          setCookie("flowchart_email", "", -1);
          setCookie("flowchart_token", "", -1);
          hideLoginOverlay();
        } else {
          // Clear invalid cookies
          setCookie("flowchart_email", "", -1);
          setCookie("flowchart_token", "", -1);
          showLoginOverlay();
        }
      });
  } else {
    showLoginOverlay();
  }

  setupAuthListeners();
}

/**
 * Sets up event listeners for login and signup buttons.
 */
function setupAuthListeners() {
  document.getElementById("loginButton").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");
    
    if (!email || !password) {
      errorDiv.textContent = "Please enter both email and password.";
      return;
    }
    
    firebase.auth().signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        setCookie("flowchart_email", email, 30);
        setCookie("flowchart_token", password, 30); // Note: storing passwords in cookies is not secure
        window.currentUser = userCredential.user;
        hideLoginOverlay();
        errorDiv.textContent = "";
      })
      .catch((error) => {
        if (error.code === 'auth/quota-exceeded') {
          // Sign in as guest
          window.currentUser = {
            uid: 'guest',
            email: 'guest@guest.com',
            displayName: 'Guest',
            isGuest: true
          };
          setCookie("flowchart_email", "", -1);
          setCookie("flowchart_token", "", -1);
          hideLoginOverlay();
          errorDiv.textContent = "Signed in as guest due to exceeded quota.";
        } else {
          errorDiv.textContent = error.message;
        }
      });
  });

  document.getElementById("signupButton").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    const errorDiv = document.getElementById("loginError");
    
    if (!email || !password) {
      errorDiv.textContent = "Please enter both email and password.";
      return;
    }
    
    if (password.length < 6) {
      errorDiv.textContent = "Password must be at least 6 characters.";
      return;
    }
    
    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        setCookie("flowchart_email", email, 30);
        setCookie("flowchart_token", password, 30);
        window.currentUser = userCredential.user;
        hideLoginOverlay();
        errorDiv.textContent = "";
      })
      .catch((error) => {
        if (error.code === 'auth/quota-exceeded') {
          // Sign in as guest
          window.currentUser = {
            uid: 'guest',
            email: 'guest@guest.com',
            displayName: 'Guest',
            isGuest: true
          };
          setCookie("flowchart_email", "", -1);
          setCookie("flowchart_token", "", -1);
          hideLoginOverlay();
          errorDiv.textContent = "Signed in as guest due to exceeded quota.";
        } else {
          errorDiv.textContent = error.message;
        }
      });
  });

  // Set up logout button
  document.getElementById("logoutBtn").addEventListener("click", () => {
    if (window.currentUser && window.currentUser.isGuest) {
      window.currentUser = null;
      showLoginOverlay();
      return;
    }
    firebase.auth().signOut().then(() => {
      setCookie("flowchart_email", "", -1);
      setCookie("flowchart_token", "", -1);
      window.currentUser = null;
      showLoginOverlay();
    });
  });
  
  // Auto-login function - uses hardcoded credentials
  autoLogin();
}

/**
 * Auto-fills login credentials and logs in automatically.
 */
function autoLogin() {
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginButton = document.getElementById("loginButton");
  
  if (loginEmail && loginPassword && loginButton) {
    loginEmail.value = "defaultemail0114@gmail.com";
    loginPassword.value = "adam0114";
    
    // Add a small delay to ensure the form is filled before clicking
    setTimeout(() => {
      loginButton.click();
    }, 500);
  }
}

// Initialize the authentication when the document is ready
document.addEventListener('DOMContentLoaded', () => {
  checkForSavedLogin();
}); 