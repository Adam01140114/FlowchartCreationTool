/*********************************************
 * generate.js - with hidden checkbox & text
 *   multi-term calculations,
 *   plus $$placeholders$$ supporting expressions
 *   and a single <script> block for logic
 *********************************************/

/* global map: questionId  →  canonical slug */
const questionSlugMap = {};

/* global maps and arrays for form data */
const questionNameIds = {};
const questionTypesMap = {};
const conditionalPDFs = [];
const pdfLogicPDFs = [];
const alertLogics = [];
let checklistLogics = [];
const conditionalAlerts = [];
const jumpLogics = [];
const labelMap = {};
const amountMap = {}; // used for numberedDropdown with amounts
const linkedDropdowns = []; // For storing linked dropdown pairs
const hiddenLogicConfigs = []; // For storing hidden logic configurations
const linkedFields = []; // For storing linked field configurations

// Cart functions are now included in the generated HTML

/*------------------------------------------------------------------
 * HISTORY STACK for accurate "Back" navigation
 *-----------------------------------------------------------------*/
let sectionStack = [];          // push every section you LEAVE
let currentSectionNumber = 1;   // updated by navigateSection()



// We also create a buffer to store our conditional-logic code
// so we can insert it later in one <script> block.
let logicScriptBuffer = "";

/*───────────────────────────────*
 * canonical sanitiser – visible
 * to all build-time code
 *───────────────────────────────*/









/******************************************************************
 * helpers that the generator itself uses ( NOT inside formHTML! )
 ******************************************************************/

/* canonical sanitiser (unchanged) */
function sanitizeQuestionText (str){
    return String(str).toLowerCase()
                      .replace(/\W+/g, "_")
                      .replace(/^_+|_+$/g, "");
}


// Function to update hidden state fields when dropdown selection changes
function updateStateHiddenFields(dropdown, hiddenFullId, hiddenShortId) {
    
    const selectedState = dropdown.value;
    
    const fullField = document.getElementById(hiddenFullId);
    const shortField = document.getElementById(hiddenShortId);
    
    
    // State abbreviation mapping
    const stateAbbreviations = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO',
        'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
        'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
        'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
        'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
        'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
        'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
        'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
    };
    
    if (fullField && shortField) {
        if (selectedState) {
            const abbreviation = stateAbbreviations[selectedState] || '';
            fullField.value = selectedState;
            shortField.value = abbreviation;
        } else {
            fullField.value = '';
            shortField.value = '';
        }
    } else {
    }
}

/* slug‑aware prefix for any checkbox belonging to a question */
function getCbPrefix (qId){
    if (questionSlugMap[qId]) return questionSlugMap[qId] + '_';   // e.g. do_you_have_any_of_these_
    if (questionNameIds[qId]) return questionNameIds[qId] + '_';
    return 'answer' + qId + '_';
}

/* build the final <input>.id / name for a checkbox option */
function buildCheckboxName (questionId, rawNameId, labelText){
    // if the designer left the name blank, derive it from the label
    let namePart = (rawNameId || '').trim();
    if (!namePart){
        namePart = labelText.replace(/\W+/g, '_').toLowerCase();
    }

    // Return the name part directly without adding question prefix
    return namePart;
}




// Helper function to create styled address input
function createAddressInput(id, label, index, type = 'text') {
    const inputType = type === 'number' ? 'number' : 'text';
    const placeholder = label; // Remove the index number from placeholder
    
    return '<div class="address-field">' +
           '<input type="' + inputType + '" ' +
           'id="' + id + '" ' +
           'name="' + id + '" ' +
           'placeholder="' + placeholder + '" ' +
           'class="address-input">' +
           '</div>';
}

// Generate hidden address textboxes for numbered dropdown questions with location fields
function generateHiddenAddressTextboxes(questionId, count, allFieldsInOrder) {
    
    // Check if this question has location fields (Street, City, State, Zip)
    const hasLocationFields = allFieldsInOrder.some(field => 
        ['Street', 'City', 'State', 'Zip'].includes(field.label)
    );
    
    if (!hasLocationFields) {
        return;
    }
    
    // Get the base field name from the question
    const baseFieldName = questionNameIds[questionId] || 'answer' + questionId;
    
    // Remove existing hidden address textboxes for this question
    for (let i = 1; i <= 10; i++) { // Check up to 10 entries
        const existingAddress = document.getElementById(baseFieldName + '_address_' + i);
        if (existingAddress && existingAddress.type === 'text' && existingAddress.style.display === 'none') {
            existingAddress.remove();
        }
    }
    
    // Generate hidden address textboxes for the selected count
    for (let i = 1; i <= count; i++) {
        // For single-entry questions (like multipleTextboxes), don't add number suffix
        const addressId = count === 1 ? baseFieldName + '_address' : baseFieldName + '_address_' + i;
        const addressInput = document.createElement('input');
        addressInput.type = 'text';
        addressInput.id = addressId;
        addressInput.name = addressId;
        addressInput.style.display = 'none';
        
        // Add to hidden fields container
        const hiddenContainer = document.getElementById('hidden_pdf_fields');
        if (hiddenContainer) {
            hiddenContainer.appendChild(addressInput);
        }
        
        // Set up event listeners to update the address when location fields change
        // Delay this to ensure location fields are created first
        setTimeout(() => {
            setupAddressUpdateListeners(questionId, i, baseFieldName, allFieldsInOrder, count);
        }, 1000); // 1 second delay to ensure fields are created
    }
}

function setupAddressUpdateListeners(questionId, entryNumber, baseFieldName, allFieldsInOrder, count = 1) {
    // For single-entry questions (like multipleTextboxes), don't add number suffix
    const addressId = count === 1 ? baseFieldName + '_address' : baseFieldName + '_address_' + entryNumber;
    const addressInput = document.getElementById(addressId);
    
    if (!addressInput) return;
    
    // Function to update the address field
    const updateAddress = () => {
        // For single-entry questions, don't add number suffix to field IDs
        const streetFieldId = count === 1 ? baseFieldName + '_street' : baseFieldName + '_street_' + entryNumber;
        const cityFieldId = count === 1 ? baseFieldName + '_city' : baseFieldName + '_city_' + entryNumber;
        const stateFieldId = count === 1 ? baseFieldName + '_state' : baseFieldName + '_state_' + entryNumber;
        const zipFieldId = count === 1 ? baseFieldName + '_zip' : baseFieldName + '_zip_' + entryNumber;
        const stateShortFieldId = count === 1 ? baseFieldName + '_state_short' : baseFieldName + '_state_short_' + entryNumber;
        
        const streetField = document.getElementById(streetFieldId);
        const cityField = document.getElementById(cityFieldId);
        const stateField = document.getElementById(stateFieldId);
        const zipField = document.getElementById(zipFieldId);
        const stateShortField = document.getElementById(stateShortFieldId);
        
        // Debug: Log what fields we're looking for and what we found
        console.log('  - City field ID:', cityFieldId, 'Found:', !!cityField, 'Value:', cityField ? cityField.value : 'N/A');
        console.log('  - State field ID:', stateFieldId, 'Found:', !!stateField, 'Value:', stateField ? stateField.value : 'N/A');
        console.log('  - Zip field ID:', zipFieldId, 'Found:', !!zipField, 'Value:', zipField ? zipField.value : 'N/A');
        console.log('  - State Short field ID:', stateShortFieldId, 'Found:', !!stateShortField, 'Value:', stateShortField ? stateShortField.value : 'N/A');
        
        const street = streetField ? streetField.value.trim() : '';
        const city = cityField ? cityField.value.trim() : '';
        const state = stateShortField ? stateShortField.value.trim() : (stateField ? stateField.value.trim() : '');
        const zip = zipField ? zipField.value.trim() : '';
        
        // Build the full address
        const addressParts = [street, city, state, zip].filter(part => part !== '');
        const fullAddress = addressParts.join(', ');
        
        addressInput.value = fullAddress;
    };
    
    // Set up listeners for all location fields
    const locationFields = ['street', 'city', 'state', 'zip', 'state_short'];
    
    locationFields.forEach(fieldType => {
        // For single-entry questions, don't add number suffix to field IDs
        const fieldId = count === 1 ? baseFieldName + '_' + fieldType : baseFieldName + '_' + fieldType + '_' + entryNumber;
        const field = document.getElementById(fieldId);
        
        
        if (field) {
            // Listen for input changes
            field.addEventListener('input', updateAddress);
            field.addEventListener('change', updateAddress);
        } else {
            console.log('🔧 [HIDDEN ADDRESS DEBUG] Field not found:', fieldId);
        }
    });
    
    // Initial update with longer delay to ensure fields are created
    setTimeout(updateAddress, 500);
    
    // Also trigger update after autofill completes (additional safety)
    setTimeout(updateAddress, 2000);
}

// Global function to update all hidden address fields after autofill
function updateAllHiddenAddressFields() {
    console.log('🔧 [HIDDEN ADDRESS] Updating all hidden address fields after autofill');
    
    // Find all hidden address textboxes
    const hiddenAddressFields = document.querySelectorAll('input[type="text"][id*="_address_"][style*="display: none"]');
    
    hiddenAddressFields.forEach(addressField => {
        const addressId = addressField.id;
        console.log('🔧 [HIDDEN ADDRESS] Found hidden address field:', addressId);
        
        // Extract base field name and entry number from ID
        // Handle both numbered (_address_1) and single-entry (_address) patterns
        const numberedMatch = addressId.match(/^(.+)_address_(\d+)$/);
        const singleMatch = addressId.match(/^(.+)_address$/);
        
        let baseFieldName, entryNumber, isSingleEntry = false;
        
        if (numberedMatch) {
            baseFieldName = numberedMatch[1];
            entryNumber = numberedMatch[2];
        } else if (singleMatch) {
            baseFieldName = singleMatch[1];
            entryNumber = '1';
            isSingleEntry = true;
        } else {
            console.log('🔧 [HIDDEN ADDRESS] Could not parse address ID:', addressId);
            return;
        }
        
        console.log('🔧 [HIDDEN ADDRESS] Extracted baseFieldName:', baseFieldName, 'entryNumber:', entryNumber, 'isSingleEntry:', isSingleEntry);
        
        // Manually update this address field
        const streetFieldId = isSingleEntry ? baseFieldName + '_street' : baseFieldName + '_street_' + entryNumber;
        const cityFieldId = isSingleEntry ? baseFieldName + '_city' : baseFieldName + '_city_' + entryNumber;
        const stateFieldId = isSingleEntry ? baseFieldName + '_state' : baseFieldName + '_state_' + entryNumber;
        const zipFieldId = isSingleEntry ? baseFieldName + '_zip' : baseFieldName + '_zip_' + entryNumber;
        const stateShortFieldId = isSingleEntry ? baseFieldName + '_state_short' : baseFieldName + '_state_short_' + entryNumber;
            
            const streetField = document.getElementById(streetFieldId);
            const cityField = document.getElementById(cityFieldId);
            const stateField = document.getElementById(stateFieldId);
            const zipField = document.getElementById(zipFieldId);
            const stateShortField = document.getElementById(stateShortFieldId);
            
            console.log('🔧 [HIDDEN ADDRESS] Manual update - Looking for fields:');
            console.log('  - Street field ID:', streetFieldId, 'Found:', !!streetField, 'Value:', streetField ? streetField.value : 'N/A');
            console.log('  - City field ID:', cityFieldId, 'Found:', !!cityField, 'Value:', cityField ? cityField.value : 'N/A');
            console.log('  - State field ID:', stateFieldId, 'Found:', !!stateField, 'Value:', stateField ? stateField.value : 'N/A');
            console.log('  - Zip field ID:', zipFieldId, 'Found:', !!zipField, 'Value:', zipField ? zipField.value : 'N/A');
            console.log('  - State Short field ID:', stateShortFieldId, 'Found:', !!stateShortField, 'Value:', stateShortField ? stateShortField.value : 'N/A');
            
            const street = streetField ? streetField.value.trim() : '';
            const city = cityField ? cityField.value.trim() : '';
            const state = stateShortField ? stateShortField.value.trim() : (stateField ? stateField.value.trim() : '');
            const zip = zipField ? zipField.value.trim() : '';
            
            // Build the full address
            const addressParts = [street, city, state, zip].filter(part => part !== '');
            const fullAddress = addressParts.join(', ');
            
            addressField.value = fullAddress;
            console.log('🔧 [HIDDEN ADDRESS] Manual update - Updated address for', addressId, ':', fullAddress);
    });
}

function getFormHTML() {
	console.log('🔧 [FORM GENERATION DEBUG] getFormHTML() function called');
	
	try {
	// RESET all globals before building
Object.keys(questionSlugMap).forEach(key => delete questionSlugMap[key]);
Object.keys(questionNameIds).forEach(key => delete questionNameIds[key]);
Object.keys(questionTypesMap).forEach(key => delete questionTypesMap[key]);
conditionalPDFs.length = 0;
pdfLogicPDFs.length = 0;
alertLogics.length = 0;
checklistLogics.length = 0;
conditionalAlerts.length = 0;
jumpLogics.length = 0;
linkedDropdowns.length = 0;
labelMap.length = 0;
amountMap.length = 0;
hiddenLogicConfigs.length = 0;
linkedFields.length = 0;
logicScriptBuffer = "";

console.log('🔧 [HIDDEN LOGIC DEBUG] Starting form generation - hiddenLogicConfigs cleared');

// Check if test mode is enabled
const isTestMode = document.getElementById('testModeCheckbox') && document.getElementById('testModeCheckbox').checked;

// Get form name from the form name input field
const formNameEl = document.getElementById('formNameInput');
const formName = formNameEl && formNameEl.value.trim() ? formNameEl.value.trim() : 'Example Form';



  // Top HTML (head, body, header, etc.)
  let formHTML = [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '    <meta charset="UTF-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `    <title>${formName}</title>`,
    '    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet">',
    '    <link rel="stylesheet" href="generate.css">',
    '    <link rel="stylesheet" href="generate2.css">',
    '    <style>',
    '        .entry-container { border: 2px solid #2980b9 !important; border-radius: 12px; padding: 20px; margin: 10px 0; background-color: #f8f9ff; box-shadow: 0 4px 8px rgba(41, 128, 185, 0.15); transition: all 0.3s ease; display: block; width: 100%; box-sizing: border-box; }',
    '        .address-field { margin: 8px 0; }',
    '        .address-input, .address-select { width: 100%; max-width: 400px; padding: 12px 16px; border: 1px solid #e1e5e9 !important; border-radius: 8px; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #ffffff !important; transition: all 0.2s ease; box-sizing: border-box; text-align: center; }',
    '        .address-input:focus, .address-select:focus { outline: none; box-shadow: 0 0 0 3px rgba(41, 128, 185, 0.1); }',
    '        .address-input::placeholder { color: #6c757d; opacity: 1; }',
    '        .address-select { cursor: pointer; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: right 12px center; background-size: 16px; padding-right: 40px; appearance: none; text-align: center; }',
    '        .address-field:first-child { margin-top: 0; }',
    '        .address-field:last-child { margin-bottom: 0; }',
    '        .hidden { display: none !important; }',
    '    </style>',
    "</head>",
    "<body>",
    // Insert modal HTML right after <body> (only if not in test mode)
    ...(isTestMode ? [] : [
      '<div id="loginRequiredModal" class="custom-modal-overlay" style="display:none;">\n' +
      '  <div class="custom-modal">\n' +
      '    <h2>Account Required</h2>\n' +
      '    <p>You must create an account to continue filling out the form.</p>\n' +
      '    <div class="modal-buttons">\n' +
      '      <button class="modal-back" id="modalBackBtn" type="button">Back</button>\n' +
      '      <button class="modal-continue" id="modalContinueBtn" type="button">Continue</button>\n' +
      '    </div>\n' +
      '  </div>\n' +
      '</div>'
    ]),
    "<header>",
    '    <img src="logo.png" alt="FormWiz Logo" width="130" height="80" onclick="location.href=\'index.html\';">',
    "    <nav>",
    '        <a href="index.html">Home',
    '            <span class="nav-chevron"><svg viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
    "        </a>",
    '        <div class="nav-dropdown-wrapper" id="forms-dropdown-wrapper">',
    '            <a href="#" id="forms-nav-link">Forms',
    '                <span class="nav-chevron forms-chevron"><svg viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
    "            </a>",
    '            <div class="dropdown-menu" id="forms-dropdown-menu">',
    '                <a href="../Pages/forms.html">My Forms</a>',
    '                <a href="../Pages/FreeForm.html">Free Form</a>',
    '                <a href="../Pages/Family.html">Family</a>',
    '                <a href="../Pages/Property.html">Property</a>',
    '                <a href="../Pages/Immigration.html">Immigration</a>',
    '                <a href="../Pages/smallclaims.html">Small Claims</a>',
    '                <a href="../Pages/Other.html">Other</a>',
    "            </div>",
    "        </div>",
    '        <a href="../Pages/about.html">About Us',
    '            <span class="nav-chevron"><svg viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
    "        </a>",
    '        <a href="../Pages/contact.html">Contact Us',
    '            <span class="nav-chevron"><svg viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
    "        </a>",
    '        <a href="../Pages/FAQ.html">FAQ',
    '            <span class="nav-chevron"><svg viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>',
    "        </a>",
    "    </nav>",
    '    <div class="header-actions">',
    '        <a href="../Pages/account.html" class="sign-in-btn" id="sign-in-btn">Sign In</a>',
    '        <a href="#" class="sign-in-btn" id="logout-btn" style="display:none;">Log Out</a>',
    '        <a href="#" id="cart-icon-link" style="margin-left: -10px; display: inline-flex; align-items: center; text-decoration: none; position: relative;">',
    '            <span class="cart-circle">',
    '                <svg id="cart-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
    '                    <circle cx="10" cy="21" r="1.5"/>',
    '                    <circle cx="18" cy="21" r="1.5"/>',
    '                    <path d="M2.5 4H5l2.68 13.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L21.5 7H6.16"/>',
    "                </svg>",
    '                <span id="cart-count-badge" style="display: none; position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: #e74c3c; color: #fff; border-radius: 50%; font-size: 1em; font-weight: bold; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(44,62,80,0.13); z-index: 2; text-align: center;"></span>',
    "            </span>",
    "        </a>",
    "    </div>",
    "</header>",
    "",
    "    <!-- Sliding Cart Menu -->",
    '    <div class="cart-overlay" id="cart-overlay">',
    '        <div class="cart-side-menu" id="cart-side-menu">',
            "            <div class=\"cart-header\" style=\"background:#2c3e50;color:#fff;padding:20px 0 20px 20px;display:flex;justify-content:space-between;align-items:center;\">",
            "                <h2 style=\"margin:0;font-size:1.5em;font-weight:700;\">🛒 Cart</h2>",
            '                <button class="cart-close-btn" id="cart-close-btn" style="background:none;border:none;color:#fff;font-size:1.5em;cursor:pointer;padding:0;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background 0.2s;margin-right:8px;">&times;</button>',
            "            </div>",
                '            <div class="cart-content" id="cart-content">',
            '                <div class="cart-icon-large">🛒</div>',
            '                <div class="cart-message" id="cart-message">Create an account to start shopping!</div>',
            '                <div class="cart-description" id="cart-description">',
                                "                    To add forms to your cart and make purchases, you\\'ll need to create a FormWiz account. ",
            "                    Sign up now to access our complete library of legal forms and start simplifying your paperwork.",
            "                </div>",
            '                <a href="../Pages/account.html" class="cart-signup-btn" id="cart-signup-btn">Sign Up</a>',
            '                <div class="cart-items-list" id="cart-items-list" style="display:none;"></div>',
            '                <button class="cart-checkout-btn" id="cart-checkout-btn" style="display:none;margin-top:24px;background:#2980b9;color:#fff;padding:15px 40px;font-size:1.1em;font-weight:700;border:none;border-radius:8px;cursor:pointer;">Checkout</button>',
            "            </div>",
    "        </div>",
    "    </div>",
    "",
    '<div id="pdfPreview" style="display:none;">',
    '    <iframe id="pdfFrame" style="display:none"></iframe>',
    "</div>",
    "",
    "<!-- Firebase includes -->",
    '<script src="https://js.stripe.com/v3/"></script>',
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>',
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>',
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>',
    "",
    '<script>',
    '// Firebase Configuration',
    'const firebaseConfig = {',
    '    apiKey: "AIzaSyDS-tSSn7fdLBgwzfHQ_1MPG1w8S_4qb04",',
    '    authDomain: "formwiz-3f4fd.firebaseapp.com",',
    '    projectId: "formwiz-3f4fd",',
    '    storageBucket: "formwiz-3f4fd.firebasestorage.app",',
    '    messagingSenderId: "404259212529",',
    '    appId: "1:404259212529:web:15a33bce82383b21cfed50",',
    '    measurementId: "G-P07YEN0HPD"',
    '};',
    '',
    '// Initialize Firebase',
    'if (typeof firebase !== "undefined" && !firebase.apps.length) {',
    '    firebase.initializeApp(firebaseConfig);',
    '}',
    'const auth = firebase.auth();',
    '',
    '// Auth state management',
    'if (typeof firebase !== "undefined" && firebase.apps.length > 0) {',
    '    auth.onAuthStateChanged(function(user) {',
    '        isUserLoggedIn = !!user;',
    '        userId = user ? user.uid : null;',
    '        updateAuthButtons(user);',
    '        updateCartCountBadge();',
    '    });',
    '} else {',
    '    // Fallback for when Firebase is not available',
    '}',
    '',
    '// Function to update button display based on auth state',
    'function updateAuthButtons(user) {',
    '    const signInBtn = document.getElementById("sign-in-btn");',
    '    const logoutBtn = document.getElementById("logout-btn");',
    '    ',
    '    if (user) {',
    '        if (signInBtn) signInBtn.style.display = "none";',
    '        if (logoutBtn) logoutBtn.style.display = "inline-block";',
    '    } else {',
    '        if (signInBtn) signInBtn.style.display = "inline-block";',
    '        if (logoutBtn) logoutBtn.style.display = "none";',
    '    }',
    '}',
    '',
    '// Update cart count badge in header',
    'function updateCartCountBadge() {',
    '    const cartCountElement = document.getElementById("cart-count-badge");',
    '    if (cartCountElement) {',
    '        let count = 0;',
    '        ',
    '        // Try to get count from getCartCount function first',
    '        if (typeof getCartCount === "function") {',
    '            count = getCartCount();',
    '        } else {',
    '            // Fallback to localStorage',
    '            try {',
    '                const cartData = localStorage.getItem("formwiz_cart");',
    '                if (cartData) {',
    '                    const cart = JSON.parse(cartData);',
    '                    count = Array.isArray(cart) ? cart.length : 0;',
    '                }',
    '            } catch (e) {',
    '                count = 0;',
    '            }',
    '        }',
    '        ',
    '        // Always update the text content, even if count is 0',
    '        cartCountElement.textContent = count;',
    '        ',
    '        if (count > 0) {',
    '            cartCountElement.style.display = "flex";',
    '        } else {',
    '            cartCountElement.style.display = "none";',
    '        }',
    '    }',
    '}',
    '',
    '// Initialize cart count badge on page load',
    'document.addEventListener("DOMContentLoaded", function() {',
    '    updateCartCountBadge();',
    '    // Update cart count every 5 seconds',
    '    setInterval(updateCartCountBadge, 5000);',
    '});',
    '</script>',
    "",
    '<div style="width: 80%; max-width: 800px; margin: 20px auto; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; display: none;">',
    '    <h3 style="text-align: center; margin-bottom: 15px; color: #2c3e50;">Your Information</h3>',
    '    <div style="display: flex; gap: 15px; margin-bottom: 15px;">',
    '        <div style="flex: 1;">',
    '            <label for="user_firstname" style="display: block; margin-bottom: 5px; font-weight: bold;">First Name</label>',
    '            <input type="text" form="customForm" id="user_firstname" name="user_firstname" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">',
    '        </div>',
    '        <div style="flex: 1;">',
    '            <label for="user_lastname" style="display: block; margin-bottom: 5px; font-weight: bold;">Last Name</label>',
    '            <input type="text" form="customForm" id="user_lastname" name="user_lastname" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">',
    '        </div>',
    '    </div>',
    '    <div style="margin-bottom: 15px;">',
    '        <label for="user_email" style="display: block; margin-bottom: 5px; font-weight: bold;">Email Address</label>',
    '        <input type="email" form="customForm" id="user_email" name="user_email" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">',
    '    </div>',
    '    <div style="margin-bottom: 15px;">',
    '        <label for="user_phone" style="display: block; margin-bottom: 5px; font-weight: bold;">Phone Number</label>',
    '        <input type="tel" form="customForm" id="user_phone" name="user_phone" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">',
    '    </div>',
    '    <div style="margin-bottom: 15px;">',
    '        <label for="user_street" style="display: block; margin-bottom: 5px; font-weight: bold;">Street Address</label>',
    '        <input type="text" form="customForm" id="user_street" name="user_street" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">',
    '    </div>',
    '    <div style="display: flex; gap: 15px; margin-bottom: 15px;">',
    '        <div style="flex: 2;">',
    '            <label for="user_city" style="display: block; margin-bottom: 5px; font-weight: bold;">City</label>',
    '            <input type="text" form="customForm" id="user_city" name="user_city" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">',
    '        </div>',
    '        <div style="flex: 1;">',
    '            <label for="user_state" style="display: block; margin-bottom: 5px; font-weight: bold;">State</label>',
    '            <input type="text" form="customForm" id="user_state" name="user_state" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">',
    '        </div>',
    '        <div style="flex: 1;">',
    '            <label for="user_zip" style="display: block; margin-bottom: 5px; font-weight: bold;">ZIP</label>',
    '            <input type="text" form="customForm" id="user_zip" name="user_zip" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">',
    '        </div>',
    '    </div>',
    '</div>',
    '<div id="questions">',
    '    <div id="result"></div>',
    "    <section>",
    '    <div id="box">',
    '        <form id="customForm" onsubmit="return showThankYouMessage(event);">',
    '        <!-- Hidden fields for URL parameters -->',
    '        <input type="hidden" id="form_zip" name="form_zip" value="">',
    '        <input type="hidden" id="form_county" name="form_county" value="">',
    '        <input type="hidden" id="form_defendant" name="form_defendant" value="">',
    '        <input type="hidden" id="form_ID" name="form_ID" value="">',
    '        <input type="hidden" id="current_date" name="current_date" value="">',
  ].join("\n");

  // Get all PDF names
  const pdfFormNameInputEl = document.getElementById("formPDFName");
  const pdfFormName = pdfFormNameInputEl
    ? pdfFormNameInputEl.value.trim()
    : "test.pdf";
  const escapedPdfFormName = pdfFormName
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
    
  // Get the desired output file name
  const pdfOutputNameInputEl = document.getElementById("pdfOutputName");
  const pdfOutputName = pdfOutputNameInputEl && pdfOutputNameInputEl.value.trim() ? pdfOutputNameInputEl.value.trim() : "example.html";
  const escapedPdfOutputName = pdfOutputName.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');

  // Set window.formId to use the PDF name (without .pdf extension) for cart and form identification
  window.formId = pdfFormName.replace(/\.pdf$/i, '');

  // Get the Stripe Price ID
  const stripePriceIdInputEl = document.getElementById("stripePriceId");
  const stripePriceId = stripePriceIdInputEl && stripePriceIdInputEl.value.trim() ? stripePriceIdInputEl.value.trim() : "";
  const escapedStripePriceId = stripePriceId.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');

  // Get additional PDF names
  const additionalPdfNames = [];
  const additionalPdfInputs = document.querySelectorAll('[id^="additionalPdfName_"]');
  additionalPdfInputs.forEach(input => {
    if (input.value.trim()) {
      additionalPdfNames.push(input.value.trim());
    }
  });
  
  // Escape additional PDF names
  const escapedAdditionalPdfNames = additionalPdfNames.map(name => 
    name.replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
  );

  // Build group-to-section mapping and get group information
  const groupToSectionMap = {};
  const groupNames = {};
  const sectionToGroupMap = {};
  
  // Find all groups
  const groupBlocks = document.querySelectorAll('.group-block');
  groupBlocks.forEach(groupBlock => {
    const groupId = groupBlock.id.replace('groupBlock', '');
    const groupNameEl = document.getElementById(`groupName${groupId}`);
    const groupName = groupNameEl ? groupNameEl.value.trim() : `Group ${groupId}`;
    groupNames[groupId] = groupName;
    
    // Get sections in this group
    const groupSectionsDiv = document.getElementById(`groupSections${groupId}`);
    if (groupSectionsDiv) {
      const sectionItems = groupSectionsDiv.querySelectorAll('.group-section-item');
      const sectionsInGroup = [];
      sectionItems.forEach(sectionItem => {
        const select = sectionItem.querySelector('select');
        if (select && select.value.trim()) {
          sectionsInGroup.push(select.value.trim());
          sectionToGroupMap[select.value.trim()] = groupId;
        }
      });
      if (sectionsInGroup.length > 0) {
        groupToSectionMap[groupId] = sectionsInGroup;
      }
    }
  });
  
  // If no groups are defined, fall back to section-based progress bar
  const hasGroups = Object.keys(groupToSectionMap).length > 0;
  
  if (hasGroups) {
    // Insert stepper progress bar based on groups
    formHTML += `<div class="stepper-progress-bar" id="stepperProgressBar">`;
    const groupIds = Object.keys(groupToSectionMap).sort((a, b) => parseInt(a) - parseInt(b));
    
    groupIds.forEach((groupId, index) => {
      formHTML += `<div class="stepper-step" data-group="${groupId}" data-step="${index + 1}">`;
      formHTML += `<div class="stepper-circle">${index + 1}</div>`;
      formHTML += `<div class="stepper-label">${groupNames[groupId]}</div>`;
      formHTML += `</div>`;
      if (index < groupIds.length - 1) {
        formHTML += `<div class="stepper-line"></div>`;
      }
    });
    formHTML += `</div>`;
    
    // Store group mapping for progress bar logic
    formHTML += `<script>`;
    formHTML += `window.groupToSectionMap = ${JSON.stringify(groupToSectionMap)};`;
    formHTML += `window.sectionToGroupMap = ${JSON.stringify(sectionToGroupMap)};`;
    formHTML += `window.groupNames = ${JSON.stringify(groupNames)};`;
    formHTML += `</script>`;
  } else {
    // Fallback to section-based progress bar
    formHTML += `<div class="stepper-progress-bar" id="stepperProgressBar">`;
    for (let step = 1; step < sectionCounter; step++) {
      formHTML += `<div class="stepper-step" data-step="${step}">`;
      formHTML += `<div class="stepper-circle">${step}</div>`;
      const sectionNameEl = document.getElementById("sectionBlock" + step)?.querySelector("#sectionName" + step);
      const sectionName = sectionNameEl ? sectionNameEl.value : `Section ${step}`;
      formHTML += `<div class="stepper-label">${sectionName}</div>`;
      formHTML += `</div>`;
      if (step < sectionCounter - 1) {
        formHTML += `<div class="stepper-line"></div>`;
      }
    }
    formHTML += `</div>`;
  }

  // Build each Section & its questions
  for (let s = 1; s < sectionCounter; s++) {
    let sectionBlock = document.getElementById("sectionBlock" + s);
    if (!sectionBlock) continue;
    const sectionNameEl = sectionBlock.querySelector("#sectionName" + s);
    const sectionName = sectionNameEl ? sectionNameEl.value : "Section " + s;
    // Start the section
    formHTML += `<div id="section${s}" class="section${s === 1 ? " active" : ""}">`;
    // Only add the section title, not the stepper
    formHTML += `<center><h1 class="section-title">${sectionName}</h1>`;

    // Grab all questions in this section
    const questionsInSection = sectionBlock.querySelectorAll(".question-block");
    for (let qIdx = 0; qIdx < questionsInSection.length; qIdx++) {
      const qBlock = questionsInSection[qIdx];
      const questionId = qBlock.id.replace("questionBlock", "");

      const questionTextEl = qBlock.querySelector("#question" + questionId);
      const questionText = questionTextEl ? questionTextEl.value : "";
	  // ----------  ADD THIS  ----------
const slug = sanitizeQuestionText(questionText);
questionSlugMap[questionId] = slug;
// --------------------------------




      const questionTypeEl = qBlock.querySelector("#questionType" + questionId);
      const questionType = questionTypeEl ? questionTypeEl.value : "text";

      // store the question type
      questionTypesMap[questionId] = questionType;

      // logic
      const logicCheckbox = qBlock.querySelector("#logic" + questionId);
      const logicEnabled = logicCheckbox && logicCheckbox.checked;

      // jump logic (multi-condition version)
      const jumpEnabledEl = qBlock.querySelector("#enableJump" + questionId);
      const jumpEnabled = jumpEnabledEl && jumpEnabledEl.checked;
      if (jumpEnabled) {
        const jumpConditions = qBlock.querySelectorAll(".jump-condition");
        jumpConditions.forEach((condition) => {
          const jumpOptionEl = condition.querySelector("select");
          const jumpToEl = condition.querySelector('input[type="text"]');
          if (jumpOptionEl && jumpToEl && jumpToEl.value.trim()) {
            jumpLogics.push({
              questionId: questionId,
              questionType: questionType,
              jumpOption: jumpOptionEl.value.trim(),
              jumpTo: jumpToEl.value.trim(),
              section: s,
            });
          }
        });
      }

      // conditional PDF
      const pdfCheckEl = qBlock.querySelector(
        "#enableConditionalPDF" + questionId
      );
      const pdfEnabled = pdfCheckEl && pdfCheckEl.checked;

      const pdfNameEl = qBlock.querySelector("#conditionalPDFName" + questionId);
      const pdfAnsEl = qBlock.querySelector(
        "#conditionalPDFAnswer" + questionId
      );
      const pdfNameVal = pdfNameEl ? pdfNameEl.value : "";
      const pdfAnsVal = pdfAnsEl ? pdfAnsEl.value : "";

      // conditional Alert
      const alertCheckEl = qBlock.querySelector(
        "#enableConditionalAlert" + questionId
      );
      const alertEnabled = alertCheckEl && alertCheckEl.checked;
      const alertPrevQEl = qBlock.querySelector(
        "#alertPrevQuestion" + questionId
      );
      const alertPrevAEl = qBlock.querySelector("#alertPrevAnswer" + questionId);
      const alertTextEl = qBlock.querySelector("#alertText" + questionId);

      const alertPrevQ = alertPrevQEl ? alertPrevQEl.value : "";
      const alertPrevA = alertPrevAEl ? alertPrevAEl.value : "";
      const alertTxt = alertTextEl ? alertTextEl.value : "";
      if (alertEnabled && alertPrevQ && alertPrevA && alertTxt) {
        conditionalAlerts.push({
          questionId: questionId,
          prevQuestionId: alertPrevQ,
          prevAnswer: alertPrevA,
          alertText: alertTxt,
        });
      }

      // Start the question container
      formHTML += `<div id="question-container-${questionId}" class="question-container${
        logicEnabled ? ' hidden' : ""
      }">`;
      
      // Check if info box is enabled
      const infoBoxEnabled = qBlock.querySelector(`#enableInfoBox${questionId}`)?.checked || false;
      let infoBoxText = "";
      if (infoBoxEnabled) {
        infoBoxText = qBlock.querySelector(`#infoBoxText${questionId}`)?.value || "";
      }
      
      // Add question title with info icon if needed
      if (infoBoxEnabled && infoBoxText) {
        formHTML += `
          <div class="question-header">
            <label><h3>${questionText}</h3></label>
            <div class="info-icon" tabindex="0">
              <span>i</span>
              <div class="info-tooltip">${infoBoxText}</div>
            </div>
          </div>
        `;
      } else {
        formHTML += `<label><h3>${questionText}</h3></label>`;
      }

      // Add subtitle if enabled
      const subtitleEnabled = qBlock.querySelector(`#enableSubtitle${questionId}`)?.checked || false;
      if (subtitleEnabled) {
        const subtitleText = qBlock.querySelector(`#subtitleText${questionId}`)?.value || "";
        if (subtitleText) {
          formHTML += `<p class="question-subtitle" style="margin-top: -10px; font-size: 0.9em; color: #666;">${subtitleText}</p>`;
        }
      }

      // Render the question by type
      if (questionType === "text") {
        const nmEl = qBlock.querySelector("#textboxName" + questionId);
        const phEl = qBlock.querySelector("#textboxPlaceholder" + questionId);
        const nameId = nmEl && nmEl.value ? nmEl.value : "answer" + questionId;
        const placeholder = phEl && phEl.value ? phEl.value : "";
        questionNameIds[questionId] = nameId;
        formHTML += `<div class="text-input-container"><input type="text" id="${nameId}" name="${nameId}" placeholder="${placeholder}"></div>`;
      } else if (questionType === "bigParagraph") {
        const nmEl2 = qBlock.querySelector("#textboxName" + questionId);
        const phEl2 = qBlock.querySelector("#textboxPlaceholder" + questionId);
        const maxCharLimitEl = qBlock.querySelector("#maxCharacterLimit" + questionId);
        const lineLimitEl = qBlock.querySelector("#lineLimit" + questionId);
        const paragraphLimitEl = qBlock.querySelector("#paragraphLimit" + questionId);
        const nameId2 =
          nmEl2 && nmEl2.value ? nmEl2.value : "answer" + questionId;
        const ph2 = phEl2 && phEl2.value ? phEl2.value : "";
        const maxCharLimit = maxCharLimitEl && maxCharLimitEl.value ? parseInt(maxCharLimitEl.value) : null;
        const lineLimit = lineLimitEl && lineLimitEl.value ? parseInt(lineLimitEl.value) : null;
        const paragraphLimit = paragraphLimitEl && paragraphLimitEl.value ? parseInt(paragraphLimitEl.value) : null;
        questionNameIds[questionId] = nameId2;
        
        // Check if this Big Paragraph has PDF logic with character limits
        let hasPdfLogic = false;
        let characterLimits = [];
        if (pdfLogicPDFs && pdfLogicPDFs.length > 0) {
          const pdfLogic = pdfLogicPDFs.find(pdf => pdf.questionId === questionId && pdf.isBigParagraph);
          if (pdfLogic && pdfLogic.conditions.length > 0) {
            hasPdfLogic = true;
            characterLimits = pdfLogic.conditions.map(condition => condition.characterLimit).filter(limit => limit);
          }
        }
        
        if (hasPdfLogic && characterLimits.length > 0) {
          const maxLimit = Math.max(...characterLimits);
          const effectiveMaxLength = maxCharLimit ? Math.min(maxCharLimit, maxLimit * 2) : maxLimit * 2;
          const lineLimitAttr = lineLimit ? ` data-line-limit="${lineLimit}"` : '';
          const onInputHandler = lineLimit ? 
            ` oninput="updateCharacterCount('${nameId2}', ${JSON.stringify(characterLimits)}); handleLineSplitting('${nameId2}', ${lineLimit}); checkParagraphLimit('${nameId2}', ${paragraphLimit || 'null'});"` :
            ` oninput="updateCharacterCount('${nameId2}', ${JSON.stringify(characterLimits)}); checkParagraphLimit('${nameId2}', ${paragraphLimit || 'null'});"`;
          
          formHTML += `
            <div class="big-paragraph-container">
              <textarea id="${nameId2}" name="${nameId2}" rows="5" cols="50" placeholder="${ph2}" 
                        maxlength="${effectiveMaxLength}"${lineLimitAttr}${onInputHandler}></textarea>
              <div class="character-count" id="charCount_${nameId2}">
                <span class="current-count">0</span> / <span class="limit-display">${maxCharLimit || maxLimit}</span> characters
              </div>
            </div><br>
            <script>
              function updateCharacterCount(textareaId, limits) {
                const textarea = document.getElementById(textareaId);
                const countDisplay = document.getElementById('charCount_' + textareaId);
                const currentCount = textarea.value.length;
                const maxLimit = Math.max(...limits);
                
                if (countDisplay) {
                  countDisplay.querySelector('.current-count').textContent = currentCount;
                  countDisplay.querySelector('.limit-display').textContent = maxLimit;
                  
                  // Change color based on character count
                  if (currentCount > maxLimit) {
                    countDisplay.style.color = '#ff6b6b';
                    countDisplay.style.fontWeight = 'bold';
                  } else if (currentCount > maxLimit * 0.8) {
                    countDisplay.style.color = '#ffa726';
                  } else {
                    countDisplay.style.color = '#666';
                  }
                }
              }
              
              function handleLineSplitting(textareaId, lineLimit) {
                const textarea = document.getElementById(textareaId);
                const text = textarea.value;
                const totalChars = text.length;
                
                // Calculate how many lines we need
                const linesNeeded = Math.ceil(totalChars / lineLimit);
                
                // Create or update hidden textboxes for each line
                for (let i = 1; i <= linesNeeded; i++) {
                  const startIndex = (i - 1) * lineLimit;
                  const endIndex = Math.min(startIndex + lineLimit, totalChars);
                  const lineText = text.substring(startIndex, endIndex);
                  
                  const hiddenInputId = textareaId + '_line' + i;
                  let hiddenInput = document.getElementById(hiddenInputId);
                  
                  if (!hiddenInput) {
                    // Create new hidden input
                    hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.id = hiddenInputId;
                    hiddenInput.name = hiddenInputId;
                    textarea.parentNode.appendChild(hiddenInput);
                  }
                  
                  hiddenInput.value = lineText;
                }
                
                // Remove any extra hidden inputs that are no longer needed
                let lineNum = linesNeeded + 1;
                while (true) {
                  const extraInput = document.getElementById(textareaId + '_line' + lineNum);
                  if (extraInput) {
                    extraInput.remove();
                    lineNum++;
                  } else {
                    break;
                  }
                }
              }
            </script>
          `;
        } else {
          const maxLengthAttr = maxCharLimit ? ` maxlength="${maxCharLimit}"` : '';
          const lineLimitAttr = lineLimit ? ` data-line-limit="${lineLimit}"` : '';
          const onInputHandler = lineLimit ? ` oninput="handleLineSplitting('${nameId2}', ${lineLimit}); checkParagraphLimit('${nameId2}', ${paragraphLimit || 'null'});"` : ` oninput="checkParagraphLimit('${nameId2}', ${paragraphLimit || 'null'});"`;
          
          formHTML += `
            <div class="text-input-container">
              <textarea id="${nameId2}" name="${nameId2}" rows="5" cols="50" placeholder="${ph2}"${maxLengthAttr}${lineLimitAttr}${onInputHandler}></textarea>
            </div>
            <script>
              function handleLineSplitting(textareaId, lineLimit) {
                const textarea = document.getElementById(textareaId);
                const text = textarea.value;
                const totalChars = text.length;
                
                // Calculate how many lines we need
                const linesNeeded = Math.ceil(totalChars / lineLimit);
                
                // Create or update hidden textboxes for each line
                for (let i = 1; i <= linesNeeded; i++) {
                  const startIndex = (i - 1) * lineLimit;
                  const endIndex = Math.min(startIndex + lineLimit, totalChars);
                  const lineText = text.substring(startIndex, endIndex);
                  
                  const hiddenInputId = textareaId + '_line' + i;
                  let hiddenInput = document.getElementById(hiddenInputId);
                  
                  if (!hiddenInput) {
                    // Create new hidden input
                    hiddenInput = document.createElement('input');
                    hiddenInput.type = 'hidden';
                    hiddenInput.id = hiddenInputId;
                    hiddenInput.name = hiddenInputId;
                    textarea.parentNode.appendChild(hiddenInput);
                  }
                  
                  hiddenInput.value = lineText;
                }
                
                // Remove any extra hidden inputs that are no longer needed
                let lineNum = linesNeeded + 1;
                while (true) {
                  const extraInput = document.getElementById(textareaId + '_line' + lineNum);
                  if (extraInput) {
                    extraInput.remove();
                    lineNum++;
                  } else {
                    break;
                  }
                }
              }
            </script>
          `;
        }
      } else if (questionType === "money") {
        const mnNmEl = qBlock.querySelector("#textboxName" + questionId);
        const mnPhEl = qBlock.querySelector("#textboxPlaceholder" + questionId);
        const mnName =
          mnNmEl && mnNmEl.value ? mnNmEl.value : "answer" + questionId;
        const mnPh = mnPhEl && mnPhEl.value ? mnPhEl.value : "Enter amount";
        questionNameIds[questionId] = mnName;
        formHTML += `<div class="text-input-container"><input type="number" id="${mnName}" name="${mnName}" min="0" step="0.01" placeholder="${mnPh}"></div>`;
      } else if (questionType === "date") {
        const nmEl = qBlock.querySelector("#textboxName" + questionId);
        const nameId = nmEl && nmEl.value ? nmEl.value : "answer" + questionId;
        questionNameIds[questionId] = nameId;
        formHTML += `<div class="date-input-container" style="position: relative; cursor: pointer;" onclick="document.getElementById('${nameId}').showPicker()"><input type="date" id="${nameId}" name="${nameId}" style="width: 100%; padding: 12px 16px; border: 1px solid #e1e5e9; border-radius: 8px; font-size: 16px; cursor: pointer; background-color: #ffffff; transition: all 0.2s ease; box-sizing: border-box;"></div>`;
      } else if (questionType === "dateRange") {
        const nmEl = qBlock.querySelector("#textboxName" + questionId);
        const nameId = nmEl && nmEl.value ? nmEl.value : "answer" + questionId;
        questionNameIds[questionId] = nameId;
        
        // Create two date inputs with IDs based on the slug (nameId_1 and nameId_2)
        formHTML += `
          <div style="display: flex; gap: 20px; justify-content: center; align-items: center; margin: 8px auto; width: 80%; max-width: 400px;">
            <div class="date-input-container" style="flex: 1; position: relative; cursor: pointer;" onclick="document.getElementById('${nameId}_1').showPicker()">
              <label for="${nameId}_1" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Start Date</label>
              <input type="date" id="${nameId}_1" name="${nameId}_1" style="width: 100%; padding: 12px 16px; border: 1px solid #e1e5e9; border-radius: 8px; font-size: 16px; cursor: pointer; background-color: #ffffff; transition: all 0.2s ease; box-sizing: border-box;">
            </div>
            <div style="font-weight: 600; color: #666; margin: 0 10px;">to</div>
            <div class="date-input-container" style="flex: 1; position: relative; cursor: pointer;" onclick="document.getElementById('${nameId}_2').showPicker()">
              <label for="${nameId}_2" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">End Date</label>
              <input type="date" id="${nameId}_2" name="${nameId}_2" style="width: 100%; padding: 12px 16px; border: 1px solid #e1e5e9; border-radius: 8px; font-size: 16px; cursor: pointer; background-color: #ffffff; transition: all 0.2s ease; box-sizing: border-box;">
            </div>
          </div>
          <script>
            // Add validation for date range (end date >= start date)
            document.addEventListener('DOMContentLoaded', function() {
              const startDate = document.getElementById('${nameId}_1');
              const endDate = document.getElementById('${nameId}_2');
              
              if (startDate && endDate) {
                // Update min date for end date when start date changes
                startDate.addEventListener('change', function() {
                  if (startDate.value) {
                    endDate.min = startDate.value;
                    
                    // If end date is before start date, reset it
                    if (endDate.value && endDate.value < startDate.value) {
                      endDate.value = '';
                    }
                  }
                });
                
                // Set initial min value if start date has a value
                if (startDate.value) {
                  endDate.min = startDate.value;
                }
              }
            });
          </script>`;
      } else if (questionType === "email") {
        const nmEl = qBlock.querySelector("#textboxName" + questionId);
        const phEl = qBlock.querySelector("#textboxPlaceholder" + questionId);
        const nameId = nmEl && nmEl.value ? nmEl.value : "answer" + questionId;
        const placeholder = phEl && phEl.value ? phEl.value : "example@domain.com";
        questionNameIds[questionId] = nameId;
        formHTML += `<div class="text-input-container"><input type="email" id="${nameId}" name="${nameId}" placeholder="${placeholder}" pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"></div>`;
      } else if (questionType === "phone") {
        const nmEl = qBlock.querySelector("#textboxName" + questionId);
        const phEl = qBlock.querySelector("#textboxPlaceholder" + questionId);
        const nameId = nmEl && nmEl.value ? nmEl.value : "answer" + questionId;
        const placeholder = phEl && phEl.value ? phEl.value : "(123) 456-7890";
        questionNameIds[questionId] = nameId;
        formHTML += `<div class="text-input-container"><input type="tel" id="${nameId}" name="${nameId}" placeholder="${placeholder}" maxlength="14"></div>`;
      } else if (questionType === "radio") {
        const radNameEl = qBlock.querySelector("#textboxName" + questionId);
        const radName =
          radNameEl && radNameEl.value
            ? radNameEl.value
            : "answer" + questionId;
        questionNameIds[questionId] = radName;
        formHTML += `
          <select id="${radName}" name="${radName}">
            <option value="" disabled selected>Select an option</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select><br>`;
        if (pdfEnabled) {
          conditionalPDFs.push({
            questionId: questionId,
            questionNameId: radName,
            conditionalAnswer: pdfAnsVal,
            pdfName: pdfNameVal,
            questionType: questionType,
          });
        }
      } else if (questionType === "dropdown") {
        const ddNameEl = qBlock.querySelector("#textboxName" + questionId);
        const ddNm =
          ddNameEl && ddNameEl.value ? ddNameEl.value : "answer" + questionId;
        questionNameIds[questionId] = ddNm;

        // Check if linking logic is enabled
        const linkingEnabledEl = qBlock.querySelector("#enableLinking" + questionId);
        const linkingEnabled = linkingEnabledEl && linkingEnabledEl.checked;
        if (linkingEnabled) {
          const linkingTargetEl = qBlock.querySelector("#linkingTarget" + questionId);
          const linkingTargetId = linkingTargetEl ? linkingTargetEl.value : "";
		  
		  
		  const targetQuestionBlock = document.getElementById("questionBlock" + linkingTargetId);
const targetNameInput = targetQuestionBlock?.querySelector("#textboxName" + linkingTargetId);
const actualTargetNameId = targetNameInput?.value || "answer" + linkingTargetId;


          if (linkingTargetId) {
            linkedDropdowns.push({
  sourceId: questionId,
  sourceNameId: ddNm,
  targetId: linkingTargetId,
  targetNameId: actualTargetNameId
});
          }
        }

        // 1) Possibly grab user-entered image data
        const imgUrlEl = qBlock.querySelector("#dropdownImageURL" + questionId);
        const imgWidthEl = qBlock.querySelector(
          "#dropdownImageWidth" + questionId
        );
        const imgHeightEl = qBlock.querySelector(
          "#dropdownImageHeight" + questionId
        );

        let imageUrl = imgUrlEl ? imgUrlEl.value.trim() : "";
        let imageWidth = imgWidthEl ? parseInt(imgWidthEl.value, 10) : 0;
        let imageHeight = imgHeightEl ? parseInt(imgHeightEl.value, 10) : 0;

        // Insert <img> if user gave a URL
        if (imageUrl) {
          if (!imageWidth || imageWidth < 1) imageWidth = 300;
          if (!imageHeight || imageHeight < 1) imageHeight = 300;
          formHTML += `<br><img src="${imageUrl}" alt="Dropdown Image" width="${imageWidth}" height="${imageHeight}"><br>`;
        }

        // 2) The <select> itself
        formHTML += `<select id="${ddNm}" name="${ddNm}"
                      onchange="dropdownMirror(this, '${ddNm}'); updateHiddenLogic('${ddNm}', this.value); updateLinkedFields(); clearInactiveLinkedFields()">
                       <option value="" disabled selected>Select an option</option>`;
        const ddOps = qBlock.querySelectorAll(
          `#dropdownOptions${questionId} input`
        );
        for (let i = 0; i < ddOps.length; i++) {
          const val = ddOps[i].value.trim();
          if (val) {
            formHTML += `<option value="${val}">${val}</option>`;
          }
        }
        formHTML += `</select><br>
              <div id="dropdowntext_${ddNm}"></div>
              <input type="text" id="${ddNm}_dropdown" name="${ddNm}_dropdown"
                   readonly style="display:none;">`;
        // handle PDF logic
        if (pdfEnabled) {
          conditionalPDFs.push({
            questionId: questionId,
            questionNameId: ddNm,
            conditionalAnswer: pdfAnsVal,
            pdfName: pdfNameVal,
            questionType: questionType,
          });
        }

        // handle Hidden Logic
        const hiddenLogicEnabledEl = qBlock.querySelector(`#enableHiddenLogic${questionId}`);
        const hiddenLogicEnabled = hiddenLogicEnabledEl && hiddenLogicEnabledEl.checked;
        console.log('🔧 [HIDDEN LOGIC DEBUG] Question', questionId, 'hiddenLogicEnabled:', hiddenLogicEnabled);
        if (hiddenLogicEnabled) {
          // Get all hidden logic configurations
          const configElements = qBlock.querySelectorAll('.hidden-logic-config');
          console.log('🔧 [HIDDEN LOGIC DEBUG] Found', configElements.length, 'config elements for question', questionId);
          configElements.forEach((configElement, index) => {
            console.log('🔧 [HIDDEN LOGIC DEBUG] Processing config element', index, ':', configElement);
            const hiddenLogicTriggerEl = configElement.querySelector(`#hiddenLogicTrigger${questionId}_${index}`);
            const hiddenLogicTypeEl = configElement.querySelector(`#hiddenLogicType${questionId}_${index}`);
            const hiddenLogicNodeIdEl = configElement.querySelector(`#hiddenLogicNodeId${questionId}_${index}`);
            const hiddenLogicTextboxTextEl = configElement.querySelector(`#hiddenLogicTextboxText${questionId}_${index}`);
            
            console.log('🔧 [HIDDEN LOGIC DEBUG] Found elements - trigger:', !!hiddenLogicTriggerEl, 'type:', !!hiddenLogicTypeEl, 'nodeId:', !!hiddenLogicNodeIdEl);
            
            const hiddenLogicTrigger = hiddenLogicTriggerEl ? hiddenLogicTriggerEl.value : "";
            const hiddenLogicType = hiddenLogicTypeEl ? hiddenLogicTypeEl.value : "";
            const hiddenLogicNodeId = hiddenLogicNodeIdEl ? hiddenLogicNodeIdEl.value : "";
            const hiddenLogicTextboxText = hiddenLogicTextboxTextEl ? hiddenLogicTextboxTextEl.value : "";
            
            console.log('🔧 [HIDDEN LOGIC DEBUG] Config', index, 'trigger:', hiddenLogicTrigger, 'type:', hiddenLogicType, 'nodeId:', hiddenLogicNodeId);
            
            if (hiddenLogicTrigger && hiddenLogicType && hiddenLogicNodeId) {
              console.log('🔧 [HIDDEN LOGIC DEBUG] Adding config to hiddenLogicConfigs array');
              hiddenLogicConfigs.push({
                questionId: questionId,
                questionNameId: ddNm,
                trigger: hiddenLogicTrigger,
                type: hiddenLogicType,
                nodeId: hiddenLogicNodeId,
                textboxText: hiddenLogicTextboxText
              });
            } else {
              console.log('🔧 [HIDDEN LOGIC DEBUG] Skipping config - missing required fields');
            }
          });
        }

      } else if (questionType === "checkbox") {
       /* ---------- CHECKBOX QUESTION ---------- */
const cOptsDivs = qBlock.querySelectorAll(`#checkboxOptions${questionId} > div`);
const cboxOptions = [];

/* Use the slug as the base prefix (and store it for helpers) */
const qSlug = questionSlugMap[questionId] || ('answer' + questionId);
questionNameIds[questionId] = qSlug;      // so helpers know the base

/* ── check for "Mark only one" option ─────────────────────────── */
const markOnlyOneEl = qBlock.querySelector(`#markOnlyOne${questionId}`);
const markOnlyOne = markOnlyOneEl?.checked || false;

formHTML += `<div><center><div id="checkmark" class="checkbox-group-${questionId}">`;

/* ── render each checkbox option ───────────────────────────── */
for (let co = 0; co < cOptsDivs.length; co++){
    const optDiv        = cOptsDivs[co];
    const txtEl         = optDiv.querySelector(`#checkboxOptionText${questionId}_${co+1}`);
    const nameEl        = optDiv.querySelector(`#checkboxOptionName${questionId}_${co+1}`);
    const valEl         = optDiv.querySelector(`#checkboxOptionValue${questionId}_${co+1}`);
    const hasAmountEl   = optDiv.querySelector(`#checkboxOptionHasAmount${questionId}_${co+1}`);
    const amountNameEl  = optDiv.querySelector(`#checkboxOptionAmountName${questionId}_${co+1}`);
    const amountPhEl    = optDiv.querySelector(`#checkboxOptionAmountPlaceholder${questionId}_${co+1}`);

    const labelText         = txtEl?.value.trim() || ('Option ' + (co+1));
    const optionNameIdRaw   = nameEl?.value.trim() || '';
    const optionNameId      = buildCheckboxName(questionId, optionNameIdRaw, labelText);

    const optionValue       = valEl?.value.trim() || labelText;
    const hasAmount         = hasAmountEl?.checked;
    const amountName        = amountNameEl?.value.trim() || '';
    const amountPlaceholder = amountPhEl?.value.trim() || 'Amount';

    cboxOptions.push({
        labelText,
        optionNameId,
        optionValue,
        hasAmount,
        amountName,
        amountPlaceholder
    });

    /* actual input */
    const inputType = markOnlyOne ? 'radio' : 'checkbox';
    const inputName = markOnlyOne ? qSlug : optionNameId; // Radio buttons share the same name
    const onChangeHandler = markOnlyOne ? 
      `onchange="handleMarkOnlyOneSelection(this, ${questionId}); ${hasAmount ? `toggleAmountField('${optionNameId}_amount', this.checked);` : ''} updateCheckboxStyle(this);"` :
      `onchange="${hasAmount ? `toggleAmountField('${optionNameId}_amount', this.checked); toggleNoneOption(this, ${questionId});` : `toggleNoneOption(this, ${questionId});`} updateCheckboxStyle(this);"`;
    
    formHTML += `
      <span class="checkbox-inline" id="checkbox-container-${optionNameId}">
        <label class="checkbox-label">
          <input type="${inputType}" id="${optionNameId}" name="${inputName}" value="${optionValue}" 
                 ${onChangeHandler}>
          ${labelText}
        </label>
      </span>`;

    /* optional amount field */
    if (hasAmount){
        formHTML += `
          <input type="number" id="${optionNameId}_amount"
                 name="${amountName || optionNameId + '_amount'}"
                 placeholder="${amountPlaceholder}"
                 style="display:none; margin-top:5px; text-align:center; width:200px; padding:5px;">`;
    }
}

/* ── optional "None of the above" ─────────────────────────── */
const noneEl = qBlock.querySelector(`#noneOfTheAbove${questionId}`);
if (noneEl?.checked){
    const noneStr      = 'None of the above';
    // Ensure we use the designated pattern for the "none" option
    const noneNameId   = `${qSlug}_none`;

    cboxOptions.push({
        labelText: noneStr,
        optionNameId: noneNameId,
        optionValue: noneStr
    });

    const noneInputType = markOnlyOne ? 'radio' : 'checkbox';
    const noneInputName = markOnlyOne ? qSlug : noneNameId;
    const noneOnChangeHandler = markOnlyOne ? 
      `onchange="handleMarkOnlyOneSelection(this, ${questionId}); updateCheckboxStyle(this);"` :
      `onchange="handleNoneOfTheAboveToggle(this, ${questionId}); updateCheckboxStyle(this);"`;
    
    formHTML += `
      <span class="checkbox-inline" id="checkbox-container-${noneNameId}">
        <label class="checkbox-label">
          <input type="${noneInputType}" id="${noneNameId}" name="${noneInputName}" value="${noneStr}" 
                 ${noneOnChangeHandler}>
          ${noneStr}
        </label>
      </span>`;
}

formHTML += `</div><br></div>`;


        // If conditional PDF was enabled
        if (pdfEnabled) {
          for (let ck = 0; ck < cboxOptions.length; ck++) {
            if (cboxOptions[ck].labelText === pdfAnsVal) {
              conditionalPDFs.push({
                questionId: questionId,
                questionNameId: cboxOptions[ck].optionNameId,
                conditionalAnswer: cboxOptions[ck].optionValue,
                pdfName: pdfNameVal,
                questionType: questionType,
              });
              break;
            }
          }
        }
      } else if (questionType === "multipleTextboxes") {
        // Use the same unified fields system as numberedDropdown
        const unifiedFields = qBlock.querySelectorAll("#unifiedFields" + questionId + " .unified-field");
        const labelVals = [];
        const labelNodeIds = [];
        const amountVals = [];
        let allFieldsInOrder = []; // Declare here so it's available in the entire scope
        
        
        // If no unified fields found, try fallback to old containers
        if (unifiedFields.length === 0) {
          const lblInputs = qBlock.querySelectorAll("#textboxLabels" + questionId + " input[type='text']:first-of-type");
          const labelNodeIdInputs = qBlock.querySelectorAll("#textboxLabels" + questionId + " input[type='text']:last-of-type");
          const amtInputs = qBlock.querySelectorAll("#textboxAmounts" + questionId + " input[type='text']");
          
          
        for (let L = 0; L < lblInputs.length; L++) {
          labelVals.push(lblInputs[L].value.trim());
            labelNodeIds.push(labelNodeIdInputs[L] ? labelNodeIdInputs[L].value.trim() : "");
          }
        for (let A = 0; A < amtInputs.length; A++) {
          amountVals.push(amtInputs[A].value.trim());
        }
        
        // Create allFieldsInOrder from fallback data
        allFieldsInOrder = [
            ...labelVals.map((lbl, index) => ({
                type: 'label',
                label: lbl,
                nodeId: labelNodeIds[index] || "",
                order: index
            })),
            ...amountVals.map((amt, index) => ({
                type: 'amount',
                label: amt,
                nodeId: "",
                order: index
            }))
        ];
          } else {
          // Process unified fields
          unifiedFields.forEach((el) => {
            const fieldType = el.getAttribute('data-type');
            const fieldOrder = parseInt(el.getAttribute('data-order'));
            const labelTextEl = el.querySelector('#labelText' + questionId + '_' + fieldOrder);
            const nodeIdTextEl = el.querySelector('#nodeIdText' + questionId + '_' + fieldOrder);
            
            
            if (labelTextEl && nodeIdTextEl) {
              const fieldData = {
                type: fieldType,
                label: labelTextEl.textContent.trim(),
                nodeId: nodeIdTextEl.textContent.trim(),
                order: fieldOrder
              };
              allFieldsInOrder.push(fieldData);
            }
          });
          
          // Sort by data-order attribute (creation order)
          allFieldsInOrder.sort((a, b) => a.order - b.order);
        }
        
        
        // Store the unified fields data for use in showTextboxLabels
        window.unifiedFieldsMap = window.unifiedFieldsMap || {};
        window.unifiedFieldsMap[questionId] = allFieldsInOrder;
        
        // For multipleTextboxes, we need to generate the fields directly in the HTML
        // since there's no dropdown to trigger showTextboxLabels
        const nodeIdEl = qBlock.querySelector("#multipleTextboxesNodeId" + questionId);
        const questionNodeId = nodeIdEl ? nodeIdEl.value.trim() : "test";
        
        // Get the question text for sanitization
        const questionH3 = document.getElementById("question-container-" + questionId)?.querySelector("h3")?.textContent || ("answer" + questionId);
        const qSafe = sanitizeQuestionText(questionH3);
        
        // Set the questionNameIds for this question (same as numberedDropdown)
        questionNameIds[questionId] = questionNodeId;
        
        // Generate the fields directly in the HTML (similar to numberedDropdown but without dropdown)
        if (allFieldsInOrder.length > 0) {
          // Create a container for the multiple textboxes fields
          formHTML += `<div id="labelContainer${questionId}"></div>`;
          
          // Generate the fields for a default count of 1 (since multipleTextboxes doesn't have a dropdown)
          const count = 1;
          
          // Generate hidden address textboxes for location fields
          // For multipleTextboxes, we need to create the hidden address input in the HTML
          // since the DOM doesn't exist yet during HTML generation
          const hasLocationFields = allFieldsInOrder.some(field => 
              ['Street', 'City', 'State', 'Zip'].includes(field.label)
          );
          
          if (hasLocationFields) {
              const baseFieldName = questionNameIds[questionId] || 'answer' + questionId;
              const addressId = baseFieldName + '_address';
              // Add the hidden address input to the HTML string
              formHTML += `<input type="text" id="${addressId}" name="${addressId}" style="display: none;">`;
          }
          
          // Define location field names for visual separation
          const locationFields = ['Street', 'City', 'State', 'Zip'];

          for(let j = 1; j <= count; j++){
            let lastWasLocation = false;
            let firstField = true;
            
            // Create entry container div
            const entryContainer = document.createElement('div');
            entryContainer.className = 'entry-container';
            entryContainer.style.cssText = 'border: 2px solid #2980b9 !important; border-radius: 12px; padding: 20px; margin: 10px auto; background-color: #f8f9ff; box-shadow: 0 4px 8px rgba(41, 128, 185, 0.15); transition: all 0.3s ease; display: inline-block; width: auto; min-width: 450px; max-width: 100%; box-sizing: border-box;';
            
            // Process all fields in creation order
            for(let fieldIndex = 0; fieldIndex < allFieldsInOrder.length; fieldIndex++){
              const field = allFieldsInOrder[fieldIndex];
              const isLocationField = locationFields.includes(field.label);
              
              // Add <br> before first location field in each count
              if (isLocationField && !lastWasLocation && !firstField) {
                const br = document.createElement('br');
                entryContainer.appendChild(br);
              }
              
              if (field.type === 'label') {
                // For multipleTextboxes, use the base nodeId without numbering
                const fieldId = field.nodeId;
                if (field.label === 'State') {
                  // Use dropdown for State field
                  const dropdownDiv = document.createElement('div');
                  dropdownDiv.innerHTML = createStateDropdown(fieldId, j);
                  entryContainer.appendChild(dropdownDiv.firstElementChild);
                } else {
                  // Use regular input for other fields
                  const inputDiv = document.createElement('div');
                  inputDiv.innerHTML = createAddressInput(fieldId, field.label, j);
                  entryContainer.appendChild(inputDiv.firstElementChild);
                }
              } else if (field.type === 'amount') {
                // For multipleTextboxes, use the base nodeId without numbering
                const fieldId = field.nodeId;
                const inputDiv = document.createElement('div');
                inputDiv.innerHTML = createAddressInput(fieldId, field.label, j, 'number');
                entryContainer.appendChild(inputDiv.firstElementChild);
                
                // Add a <br> after the Zip input only if there are more fields after it
                const remainingFields = allFieldsInOrder.slice(fieldIndex + 1);
                if (remainingFields.length > 0) {
                  const brElement = document.createElement('br');
                  entryContainer.appendChild(brElement);
                }
              }
              
              lastWasLocation = isLocationField;
              firstField = false;
            }
            
            // Convert the entry container to HTML string and add to formHTML
            formHTML += entryContainer.outerHTML;
            
            // Add 1 <br> tag after each entry for better visual separation
            formHTML += "<br>";
          }
        }
      } else if (questionType === "numberedDropdown") {
        console.log('🔧 [FORM GENERATION DEBUG] Processing numbered dropdown question:', questionId);
        const stEl = qBlock.querySelector("#numberRangeStart" + questionId);
        const enEl = qBlock.querySelector("#numberRangeEnd" + questionId);
        const nodeIdEl = qBlock.querySelector("#nodeId" + questionId);
        const ddMin = stEl ? parseInt(stEl.value, 10) : 1;
        const ddMax = enEl ? parseInt(enEl.value, 10) : 1;
        const nodeId = nodeIdEl ? nodeIdEl.value.trim() : "";
          console.log('🔧 [FORM GENERATION DEBUG] Numbered dropdown params - ddMin:', ddMin, 'ddMax:', ddMax, 'nodeId:', nodeId);

        // gather unified field data from the new unified container
        console.log('🔧 [FORM GENERATION DEBUG] About to gather unified field data for question:', questionId);
        const unifiedFields = qBlock.querySelectorAll("#unifiedFields" + questionId + " .unified-field");
        const labelVals = [];
        const labelNodeIds = [];
        const amountVals = [];
        let allFieldsInOrder = []; // Declare here so it's available in the entire scope
        
        
        // If no unified fields found, try fallback to old containers
        if (unifiedFields.length === 0) {
          const lblInputs = qBlock.querySelectorAll("#textboxLabels" + questionId + " input[type='text']:first-of-type");
          const labelNodeIdInputs = qBlock.querySelectorAll("#textboxLabels" + questionId + " input[type='text']:last-of-type");
          const amtInputs = qBlock.querySelectorAll("#textboxAmounts" + questionId + " input[type='text']");
          
          
        for (let L = 0; L < lblInputs.length; L++) {
          labelVals.push(lblInputs[L].value.trim());
          labelNodeIds.push(labelNodeIdInputs[L] ? labelNodeIdInputs[L].value.trim() : "");
        }
        for (let A = 0; A < amtInputs.length; A++) {
          amountVals.push(amtInputs[A].value.trim());
        }
        
        // Create allFieldsInOrder from fallback data
        allFieldsInOrder = [
            ...labelVals.map((lbl, index) => ({
                type: 'label',
                label: lbl,
                nodeId: labelNodeIds[index] || "",
                order: index
            })),
            ...amountVals.map((amt, index) => ({
                type: 'amount',
                label: amt,
                nodeId: "",
                order: labelVals.length + index
            }))
        ];
        } else {
        
        // Process fields in their creation order
        const allElements = [];
        
        unifiedFields.forEach(field => {
          const fieldType = field.getAttribute('data-type');
          const fieldOrder = field.getAttribute('data-order');
          const labelTextEl = field.querySelector('#labelText' + questionId + '_' + fieldOrder);
          const nodeIdTextEl = field.querySelector('#nodeIdText' + questionId + '_' + fieldOrder);
          
          
          if (labelTextEl && nodeIdTextEl) {
            const labelText = labelTextEl.textContent.trim();
            const nodeIdText = nodeIdTextEl.textContent.trim();
            
            
            // Add to allFieldsInOrder for unified order
            allElements.push({
                type: fieldType,
                label: labelText,
                nodeId: nodeIdText,
                order: parseInt(fieldOrder)
            });
            
            if (fieldType === 'label') {
              labelVals.push(labelText);
              labelNodeIds.push(nodeIdText);
            } else if (fieldType === 'amount') {
              amountVals.push(labelText);
            }
          }
        });
        
        // Sort by data-order attribute (creation order)
        allElements.sort((a, b) => a.order - b.order);
        allFieldsInOrder = allElements;
        console.log('🔧 [FORM GENERATION DEBUG] Processed unified fields, allFieldsInOrder:', allFieldsInOrder);
        
        }
        
        labelMap[questionId] = labelVals;
        amountMap[questionId] = amountVals;
        // Store label node IDs for use in showTextboxLabels function
        window.labelNodeIdsMap = window.labelNodeIdsMap || {};
        window.labelNodeIdsMap[questionId] = labelNodeIds;

        // Store unified field data for use in showTextboxLabels function
        window.unifiedFieldsMap = window.unifiedFieldsMap || {};
        window.unifiedFieldsMap[questionId] = allFieldsInOrder;
        console.log('🔧 [FORM GENERATION DEBUG] Stored unified field data, about to continue numbered dropdown processing');
        
        // Add unifiedFieldsMap to the generated HTML
        console.log('🔧 [FORM GENERATION DEBUG] About to add unifiedFieldsMap to generated HTML');
        if (!window.unifiedFieldsMapDeclared) {
            window.unifiedFieldsMapDeclared = true;
            // This will be added to the HTML output
        }
        console.log('🔧 [FORM GENERATION DEBUG] Completed unifiedFieldsMap addition, about to continue numbered dropdown processing');

        // Then build the dropdown - use nodeId if provided, otherwise fallback to answer + questionId
        const dropdownId = nodeId || "answer" + questionId;
        questionNameIds[questionId] = dropdownId;
        console.log('🔧 [FORM GENERATION DEBUG] About to build dropdown HTML for question:', questionId, 'dropdownId:', dropdownId);
        formHTML += `<select id="${dropdownId}" name="${dropdownId}" data-question-id="${questionId}" onchange="showTextboxLabels(${questionId}, this.value); updateHiddenCheckboxes(${questionId}, this.value); updateHiddenLogic('${dropdownId}', this.value)">
                       <option value="" disabled selected>Select an option</option>`;
        for (let rnum = ddMin; rnum <= ddMax; rnum++) {
          formHTML += `<option value="${rnum}">${rnum}</option>`;
        }
        formHTML += `</select><br><div id="labelContainer${questionId}"></div>`;
        console.log('🔧 [FORM GENERATION DEBUG] Completed dropdown HTML building for question:', questionId);
        
        // Handle Hidden Logic for numbered dropdown
        console.log('🔧 [FORM GENERATION DEBUG] About to check hidden logic for numbered dropdown question:', questionId);
        const numberedHiddenLogicEnabledEl = qBlock.querySelector(`#enableHiddenLogic${questionId}`);
        const numberedHiddenLogicEnabled = numberedHiddenLogicEnabledEl && numberedHiddenLogicEnabledEl.checked;
        console.log('🔧 [HIDDEN LOGIC DEBUG] Numbered dropdown hidden logic enabled:', numberedHiddenLogicEnabled);
        
        if (numberedHiddenLogicEnabled) {
          console.log('🔧 [HIDDEN LOGIC DEBUG] Processing numbered dropdown hidden logic for question:', questionId);
          const configElements = qBlock.querySelectorAll(`#hiddenLogicConfigs${questionId} .hidden-logic-config`);
          console.log('🔧 [HIDDEN LOGIC DEBUG] Found', configElements.length, 'numbered dropdown config elements');
          
          configElements.forEach((configElement, index) => {
            const hiddenLogicTriggerEl = configElement.querySelector(`select[id^="hiddenLogicTrigger${questionId}"]`);
            const hiddenLogicTypeEl = configElement.querySelector(`select[id^="hiddenLogicType${questionId}"]`);
            const hiddenLogicNodeIdEl = configElement.querySelector(`input[id^="hiddenLogicNodeId${questionId}"]`);
            const hiddenLogicTextboxTextEl = configElement.querySelector(`input[id^="hiddenLogicTextboxText${questionId}"]`);
            
            const hiddenLogicTrigger = hiddenLogicTriggerEl ? hiddenLogicTriggerEl.value.trim() : '';
            const hiddenLogicType = hiddenLogicTypeEl ? hiddenLogicTypeEl.value.trim() : '';
            const hiddenLogicNodeId = hiddenLogicNodeIdEl ? hiddenLogicNodeIdEl.value.trim() : '';
            const hiddenLogicTextboxText = hiddenLogicTextboxTextEl ? hiddenLogicTextboxTextEl.value.trim() : '';
            
            console.log('🔧 [HIDDEN LOGIC DEBUG] Numbered dropdown config', index, 'trigger:', hiddenLogicTrigger, 'type:', hiddenLogicType, 'nodeId:', hiddenLogicNodeId);
            
            if (hiddenLogicTrigger && hiddenLogicType && hiddenLogicNodeId) {
              console.log('🔧 [HIDDEN LOGIC DEBUG] Adding numbered dropdown config to hiddenLogicConfigs array');
              hiddenLogicConfigs.push({
                questionNameId: dropdownId,
                trigger: hiddenLogicTrigger,
                type: hiddenLogicType,
                nodeId: hiddenLogicNodeId,
                textboxText: hiddenLogicTextboxText
              });
            } else {
              console.log('🔧 [HIDDEN LOGIC DEBUG] Skipping numbered dropdown config - missing required fields');
            }
          });
        }
        
        console.log('🔧 [FORM GENERATION DEBUG] Completed numbered dropdown processing for question:', questionId);
      }

      // end question container
      formHTML += "</div>";

      // If logic is enabled, gather "multiple-OR" conditions
      if (logicEnabled) {
        const logicRows = qBlock.querySelectorAll(".logic-condition-row");
        if (logicRows.length > 0) {
          logicScriptBuffer += `\n(function(){\n`;
          logicScriptBuffer += ` var thisQ=document.getElementById("question-container-${questionId}");\n`;
          logicScriptBuffer += ` function updateVisibility(){\n  var anyMatch=false;\n`;

          for (let lr = 0; lr < logicRows.length; lr++) {
            const row = logicRows[lr];
            const rowIndex = lr + 1;
            const pqEl = row.querySelector(
              "#prevQuestion" + questionId + "_" + rowIndex
            );
            const paEl = row.querySelector(
              "#prevAnswer" + questionId + "_" + rowIndex
            );

            if (!pqEl || !paEl) continue;
            const pqVal = pqEl.value.trim();
            const paVal = paEl.value.trim().toLowerCase();
            if (!pqVal || !paVal) continue;

            const pType = questionTypesMap[pqVal] || "text";

            logicScriptBuffer += `  (function(){\n`;
            logicScriptBuffer += `    var cPrevType="${pType}";\n`;
            logicScriptBuffer += `    var cPrevAns="${paVal.toLowerCase()}";\n`;
            logicScriptBuffer += `    var cPrevQNum="${pqVal}";\n`;
            logicScriptBuffer += `    if(cPrevType==="checkbox"){\n`;
            logicScriptBuffer += `      // For checkboxes, look for all checkboxes in the question container\n`;
            logicScriptBuffer += `      var questionContainer = document.getElementById('question-container-' + cPrevQNum);\n`;
            logicScriptBuffer += `      // Check if this is a markOnlyOne question (radio buttons) or regular checkboxes\n`;
            logicScriptBuffer += `      var cbs = questionContainer ? questionContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]') : [];\n`;
            logicScriptBuffer += `      console.log('🔧 [CONDITIONAL DEBUG] Question ` + pqVal + `: Found', cbs.length, 'inputs in container, looking for:', cPrevAns);\n`;
            logicScriptBuffer += `      var checkedVals=[];\n`;
            logicScriptBuffer += `      for(var cc=0; cc<cbs.length; cc++){ if(cbs[cc].checked) checkedVals.push(cbs[cc].value.trim().toLowerCase());}\n`;
            logicScriptBuffer += `      console.log('🔧 [CONDITIONAL DEBUG] Checked values:', checkedVals, 'Looking for:', cPrevAns);\n`;
            logicScriptBuffer += `      if(checkedVals.indexOf(cPrevAns)!==-1){ anyMatch=true; console.log('🔧 [CONDITIONAL DEBUG] ✅ MATCH FOUND!');}\n`;
            logicScriptBuffer += `    } else {\n`;
            logicScriptBuffer += `      var el2=document.getElementById(questionNameIds[cPrevQNum]) || document.getElementById("answer"+cPrevQNum);\n`;
            // Special case for special options that check for presence rather than exact value
            if (paVal.toLowerCase() === "any text" || paVal.toLowerCase() === "any amount" || paVal.toLowerCase() === "any date") {
              logicScriptBuffer += `      if(el2){ var val2= el2.value.trim(); if(val2 !== ""){ anyMatch=true;} }\n`;
            } else {
              logicScriptBuffer += `      if(el2){ var val2= el2.value.trim().toLowerCase(); if(val2===cPrevAns){ anyMatch=true;} }\n`;
            }
            logicScriptBuffer += `    }\n`;
            logicScriptBuffer += `  })();\n`;
          }

          logicScriptBuffer += ` if(anyMatch){ thisQ.classList.remove("hidden"); } else { thisQ.classList.add("hidden"); }\n`;
          logicScriptBuffer += `}\n`;

          // attach event listeners
          for (let lr2 = 0; lr2 < logicRows.length; lr2++) {
            const row2 = logicRows[lr2];
            const rowIndex2 = lr2 + 1;
            const pqEl2 = row2.querySelector(
              "#prevQuestion" + questionId + "_" + rowIndex2
            );
            if (!pqEl2) continue;
            const pqVal2 = pqEl2.value.trim();
            if (!pqVal2) continue;

            const pType2 = questionTypesMap[pqVal2] || "text";
            if (pType2 === "checkbox") {
              logicScriptBuffer += ` (function(){\n`;
              // Use explicit question ID value rather than relying on variable scope
              logicScriptBuffer += `   var checkQuestion = "${pqVal2}";\n`;
              logicScriptBuffer += `   var questionContainer = document.getElementById('question-container-' + checkQuestion);\n`;
              logicScriptBuffer += `   var cbs = questionContainer ? questionContainer.querySelectorAll('input[type="checkbox"], input[type="radio"]') : [];\n`;
              logicScriptBuffer += `   for(var i=0;i<cbs.length;i++){ cbs[i].addEventListener("change", function(){ updateVisibility();});}\n`;
              logicScriptBuffer += ` })();\n`;
            } else if (pType2 === "dropdown" || pType2 === "radio" || pType2 === "numberedDropdown") {
              // Use "change" event for select elements (dropdown, radio) instead of "input"
              logicScriptBuffer += ` (function(){\n`;
              // Use explicit question ID reference
              logicScriptBuffer += `   var selectQuestion = "${pqVal2}";\n`;
              // IMPORTANT: Try questionNameIds first, then fallback to default naming
              logicScriptBuffer += `   var el3= document.getElementById(questionNameIds[selectQuestion]) || document.getElementById("answer"+selectQuestion);\n`;
              logicScriptBuffer += `   if(el3){ el3.addEventListener("change", function(){ updateVisibility();});}\n`;
              logicScriptBuffer += ` })();\n`;
            } else {
              // Use "input" event for text fields
              logicScriptBuffer += ` (function(){\n`;
              // Use explicit question ID reference
              logicScriptBuffer += `   var textQuestion = "${pqVal2}";\n`;
              // IMPORTANT: Try questionNameIds first, then fallback to default naming
              logicScriptBuffer += `   var el3= document.getElementById(questionNameIds[textQuestion]) || document.getElementById("answer"+textQuestion);\n`;
              logicScriptBuffer += `   if(el3){ el3.addEventListener("input", function(){ updateVisibility();});}\n`;
              logicScriptBuffer += ` })();\n`;
            }
          }

          logicScriptBuffer += ` updateVisibility();\n`;
          logicScriptBuffer += `})();\n`;
        }
      }

      // If PDF Logic is enabled, gather "multiple-OR" conditions and collect PDF
      const pdfLogicCheckbox = qBlock.querySelector("#pdfLogic" + questionId);
      const pdfLogicEnabled = pdfLogicCheckbox && pdfLogicCheckbox.checked;
      
      if (pdfLogicEnabled) {
        const pdfLogicRows = qBlock.querySelectorAll(".pdf-logic-condition-row");
        
        // Process all PDF groups (including multiple PDFs)
        const pdfDetailsContainer = qBlock.querySelector("#pdfDetailsContainer" + questionId);
        if (pdfDetailsContainer) {
          const pdfGroups = pdfDetailsContainer.querySelectorAll(".pdf-detail-group");
          
          pdfGroups.forEach((pdfGroup, pdfIndex) => {
            const pdfIndexNum = pdfIndex + 1;
            const pdfLogicPdfNameEl = pdfGroup.querySelector("#pdfLogicPdfName" + questionId + "_" + pdfIndexNum);
        const pdfLogicPdfName = pdfLogicPdfNameEl ? pdfLogicPdfNameEl.value.trim() : "";
            const pdfLogicPdfDisplayNameEl = pdfGroup.querySelector("#pdfLogicPdfDisplayName" + questionId + "_" + pdfIndexNum);
        const pdfLogicPdfDisplayName = pdfLogicPdfDisplayNameEl ? pdfLogicPdfDisplayNameEl.value.trim() : "";
            const pdfLogicStripePriceIdEl = pdfGroup.querySelector("#pdfLogicStripePriceId" + questionId + "_" + pdfIndexNum);
        const pdfLogicStripePriceId = pdfLogicStripePriceIdEl ? pdfLogicStripePriceIdEl.value.trim() : "";
        
            // Get trigger option for numbered dropdown
            // For the first PDF, look for the main trigger option dropdown
            // For additional PDFs, look for the PDF-specific trigger option dropdown
            let triggerOptionEl = null;
            if (pdfIndexNum === 1) {
                // First PDF uses the main trigger option dropdown
                triggerOptionEl = qBlock.querySelector("#pdfLogicTriggerOption" + questionId);
            } else {
                // Additional PDFs use PDF-specific trigger option dropdowns
                triggerOptionEl = pdfGroup.querySelector("#pdfLogicTriggerOption" + questionId + "_" + pdfIndexNum);
            }
            const triggerOption = triggerOptionEl ? triggerOptionEl.value.trim() : "";
            
            // Debug logging for PDF logic generation
            console.log('🔧 [PDF LOGIC GENERATION] Question', questionId, 'PDF', pdfIndexNum);
            console.log('  - PDF Name:', pdfLogicPdfName);
            console.log('  - Trigger Option Element:', triggerOptionEl);
            console.log('  - Trigger Option Value:', triggerOption);
            
            // Get number trigger fields for number questions
            let numberTrigger = "";
            let numberValue = "";
            if (questionType === 'number') {
                const numberTriggerEl = qBlock.querySelector("#pdfLogicNumberTrigger" + questionId);
                const numberValueEl = qBlock.querySelector("#pdfLogicNumberValue" + questionId);
                numberTrigger = numberTriggerEl ? numberTriggerEl.value.trim() : "";
                numberValue = numberValueEl ? numberValueEl.value.trim() : "";
            }
            
            if (pdfLogicPdfName || numberTrigger || numberValue) {
          // Add to PDF Logic array for later processing
          const pdfData = {
            questionId: questionId,
            pdfName: pdfLogicPdfName,
            pdfDisplayName: pdfLogicPdfDisplayName || pdfLogicPdfName.replace(/\.pdf$/i, ''),
            stripePriceId: pdfLogicStripePriceId,
                triggerOption: triggerOption, // Add trigger option for numbered dropdown
            conditions: [],
            isBigParagraph: questionType === "bigParagraph"
          };
          
          // Add number trigger fields for number questions
          if (questionType === 'number') {
              pdfData.numberTrigger = numberTrigger;
              pdfData.numberValue = numberValue;
          }
          
          pdfLogicPDFs.push(pdfData);
          
          // Process conditions
          for (let lr = 0; lr < pdfLogicRows.length; lr++) {
            const row = pdfLogicRows[lr];
            const rowIndex = lr + 1;
            
            if (questionType === "bigParagraph") {
              // For Big Paragraph, process character limit
              const charLimitEl = row.querySelector(
                "#pdfCharacterLimit" + questionId + "_" + rowIndex
              );
              const customCharLimitEl = row.querySelector(
                "#pdfCustomCharacterLimit" + questionId + "_" + rowIndex
              );
              
              if (!charLimitEl) continue;
              
              let charLimit = charLimitEl.value.trim();
              if (charLimit === 'custom') {
                charLimit = customCharLimitEl ? customCharLimitEl.value.trim() : '';
              }
              
              if (!charLimit) continue;
              
              // Add character limit condition to the PDF Logic array
              const pdfLogicIndex = pdfLogicPDFs.length - 1;
              pdfLogicPDFs[pdfLogicIndex].conditions.push({
                characterLimit: parseInt(charLimit)
              });
            } else {
              // For other question types, process previous question logic
            const pqEl = row.querySelector(
              "#pdfPrevQuestion" + questionId + "_" + rowIndex
            );
            const paEl = row.querySelector(
              "#pdfPrevAnswer" + questionId + "_" + rowIndex
            );

            if (!pqEl || !paEl) {
              continue;
            }
            const pqVal = pqEl.value.trim();
            const paVal = paEl.value.trim();
            if (!pqVal || !paVal) {
              continue;
            }

            // Add condition to the PDF Logic array
            const pdfLogicIndex = pdfLogicPDFs.length - 1;
            pdfLogicPDFs[pdfLogicIndex].conditions.push({
              prevQuestion: pqVal,
              prevAnswer: paVal
            });
            }
          }
            }
          });
        }
      }

      // If Alert Logic is enabled, gather "multiple-OR" conditions and collect alert
      const alertLogicCheckbox = qBlock.querySelector("#alertLogic" + questionId);
      const alertLogicEnabled = alertLogicCheckbox && alertLogicCheckbox.checked;
      
      if (alertLogicEnabled) {
        const alertLogicRows = qBlock.querySelectorAll(".alert-logic-condition-row");
        const alertLogicMessageEl = qBlock.querySelector("#alertLogicMessage" + questionId);
        const alertLogicMessage = alertLogicMessageEl ? alertLogicMessageEl.value.trim() : "";
        
        if (alertLogicRows.length > 0 && alertLogicMessage) {
          // Add to Alert Logic array for later processing
          alertLogics.push({
            questionId: questionId,
            message: alertLogicMessage,
            conditions: []
          });
          
          // Process conditions
          for (let lr = 0; lr < alertLogicRows.length; lr++) {
            const row = alertLogicRows[lr];
            const rowIndex = lr + 1;
            const pqEl = row.querySelector(
              "#alertPrevQuestion" + questionId + "_" + rowIndex
            );
            const paEl = row.querySelector(
              "#alertPrevAnswer" + questionId + "_" + rowIndex
            );

            if (!pqEl || !paEl) continue;
            const pqVal = pqEl.value.trim();
            const paVal = paEl.value.trim();
            if (!pqVal || !paVal) continue;

            // Add condition to the Alert Logic array
            const alertLogicIndex = alertLogics.length - 1;
            alertLogics[alertLogicIndex].conditions.push({
              prevQuestion: pqVal,
              prevAnswer: paVal
            });
          }
        }
      }

      // If Checklist Logic is enabled, gather "multiple-OR" conditions and collect checklist items
      const checklistLogicCheckbox = qBlock.querySelector("#checklistLogic" + questionId);
      const checklistLogicEnabled = checklistLogicCheckbox && checklistLogicCheckbox.checked;
      
      if (checklistLogicEnabled) {
        const checklistLogicRows = qBlock.querySelectorAll(".checklist-logic-condition-row");
        
        if (checklistLogicRows.length > 0) {
          // Add to Checklist Logic array for later processing
          checklistLogics.push({
            questionId: questionId,
            conditions: []
          });
          
          // Process conditions
          for (let lr = 0; lr < checklistLogicRows.length; lr++) {
            const row = checklistLogicRows[lr];
            const conditionIndex = lr + 1;
            const pqEl = row.querySelector(
              "#checklistPrevQuestion" + questionId + "_" + conditionIndex
            );
            const paEl = row.querySelector(
              "#checklistPrevAnswer" + questionId + "_" + conditionIndex
            );
            const checklistItemsEl = row.querySelector(
              "#checklistItemsToAdd" + questionId + "_" + conditionIndex
            );

            if (!pqEl || !paEl || !checklistItemsEl) continue;
            const pqVal = pqEl.value.trim();
            const paVal = paEl.value.trim();
            const checklistItemsText = checklistItemsEl.value.trim();
            
            if (!pqVal || !paVal || !checklistItemsText) continue;

            // Split checklist items by newlines and filter out empty lines
            const checklistItemsArray = checklistItemsText.split('\n')
              .map(item => item.trim())
              .filter(item => item.length > 0);

            // Add condition to the Checklist Logic array
            const checklistLogicIndex = checklistLogics.length - 1;
            checklistLogics[checklistLogicIndex].conditions.push({
              prevQuestion: pqVal,
              prevAnswer: paVal,
              checklistItems: checklistItemsArray
            });
          }
        }
      }
    } // end each question



    // Section nav
    formHTML += '<br><br><div class="navigation-buttons">';
if (s > 1){
    /* OLD:  <button type="button" onclick="navigateSection('+ (s-1) +')">Back</button> */
    formHTML += '<button type="button" onclick="goBack()">Back</button>';
}

    if (s === sectionCounter - 1) {
      formHTML += `<button type="submit" class="next-button">Submit</button>`;
    } else {
      formHTML += `<button type="button" class="next-button" onclick="validateAndProceed(${s})" id="next-button-${s}">Next</button>`;
    }
    formHTML += "</div>";

    formHTML += "</div>"; // end this section
  }

  // Insert hidden fields (including multi-term calculations)
  const genHidden = generateHiddenPDFFields(formName);
  formHTML += genHidden.hiddenFieldsHTML;

  // Close the form & add the thank-you message
  formHTML += [
    "</form>",
    '<div id="thankYouMessage" class="thank-you-message" style="display: none;">Thank you for completing the survey<br><br><button onclick="downloadAllPdfs()" style="font-size: 1.2em;">Download PDF</button><br><br><div id="checklistDisplay" style="margin: 20px 0; padding: 20px; background: #f8faff; border: 2px solid #2980b9; border-radius: 10px; display: none;"><h3 style="color: #2c3e50; margin-bottom: 15px;">📋 Your Personalized Checklist</h3><div id="checklistItems"></div></div><button onclick="showCartModal()" style="font-size: 1.2em;">Continue</button><br><br><button onclick="goBackToForm()" style="font-size: 1.2em;">Back</button><br><br><button onclick="window.location.href=\'../Pages/forms.html\'" style="font-size: 1.2em;">Exit Survey</button></div>',
    "</div>",
    "</section>",
    "</div>",
    '<div class="pro-footer">',
    '        <div class="pro-footer-col address-col">',
    '            <div class="pro-footer-logo">',
    '                <img src="logo.png" alt="FormWiz Logo" style="max-width:120px;max-height:80px;">',
    '            </div>',
    '            <div class="pro-footer-title">FormWiz</div>',
    '            <div class="pro-footer-contact">',
    '                <a href="tel:18884108370">1-888-410-8370</a> &nbsp; ',
    '                <a href="mailto:info@rdr-gp.com">info@rdr-gp.com</a>',
    '            </div>',
    '        </div>',
    '        <div class="pro-footer-col nav-col">',
    '            <div class="pro-footer-title">Navigation</div>',
    '            <a href="../Pages/index.html">Home</a>',
    '            <a href="../Pages/FreeForm.html">Forms</a>',
    '            <a href="../Pages/FAQ.html">FAQ</a>',
    '            <a href="../Pages/about.html">About Us</a>',
    '            <a href="../Pages/contact.html">Contact Us</a>',
    '        </div>',
    '        <div class="pro-footer-col company-col">',
    '            <div class="pro-footer-title company-title">About FormWiz</div>',
    '            <div class="pro-footer-desc">FormWiz consists of a group of proven professionals with over 70 years of combined technical, operational and administrative service experience within the non-profit, private, and public sectors. We simplify legal paperwork for everyone.</div>',
    '        </div>',
    '    </div>',
    '    <footer>',
    '        &copy; 2024 FormWiz. All rights reserved.',
    '    </footer>',
  ].join("\n");

  // Add alert popup HTML and CSS
  formHTML += `
  <style>
  .alert-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(44, 62, 80, 0.45);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(3px);
  }
  
  .alert-popup {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(44,62,80,0.18);
    padding: 32px 28px 24px 28px;
    max-width: 480px;
    width: 90%;
    text-align: center;
    position: relative;
    animation: modalPopIn 0.35s cubic-bezier(.4,1.4,.6,1);
  }
  
  @keyframes modalPopIn {
    0% { transform: scale(0.85); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  
  
  .alert-message {
    margin-bottom: 28px;
    font-size: 1.08rem;
    line-height: 1.5;
    color: #2c3e50;
    font-weight: 600;
    padding: 20px;
    border: 2px solid #2980b9;
    border-radius: 10px;
    background: #e6f4ff;
    box-shadow: inset 0 2px 8px rgba(41, 128, 185, 0.1);
  }
  
  .alert-buttons {
    display: flex;
    gap: 18px;
    justify-content: center;
  }
  
  .alert-btn {
    padding: 8px 22px;
    border-radius: 6px;
    border: none;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    min-width: 100px;
  }
  
  .alert-btn-continue {
    background: linear-gradient(90deg, #4f8cff 0%, #38d39f 100%);
    color: #fff;
  }
  
  .alert-btn-continue:hover {
    background: linear-gradient(90deg, #38d39f 0%, #4f8cff 100%);
  }
  </style>
  
  <div id="alertOverlay" class="alert-overlay">
    <div class="alert-popup">
      <div id="alertMessage" class="alert-message"></div>
      <div class="alert-buttons">
        <button class="alert-btn alert-btn-continue" onclick="closeAlert()">Continue</button>
      </div>
    </div>
  </div>
  `;

  // Now we place ONE <script> block for everything:
  formHTML += "\n<script>\n";
  
  // Set window.formId to the PDF name (without .pdf extension) for cart and form identification
  formHTML += `window.formId = '${escapedPdfFormName.replace(/\.pdf$/i, '')}';\n`;
  
  // --- BEGIN: one-time helper injection ---
  formHTML += `
(function injectAddressHelpersOnce() {
  if (window.__addressHelpersInjected) return;
  window.__addressHelpersInjected = true;

  // Create stylized address <input>
  window.createAddressInput = function(id, label, index, type = 'text') {
    const inputType = (type === 'number') ? 'number' : 'text';
    const placeholder = label;
    return (
      '<div class="address-field">' +
      '<input type="' + inputType + '" ' +
      'id="' + id + '" ' +
      'name="' + id + '" ' +
      'placeholder="' + placeholder + '" ' +
      'class="address-input">' +
      '</div>'
    );
  };

  // Create US state dropdown + the two hidden fields (full name + short)
  window.createStateDropdown = function(id, index) {
    const states = [
      'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
      'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
      'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri',
      'Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York',
      'North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
      'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia',
      'Washington','West Virginia','Wisconsin','Wyoming'
    ];

    let options = '<option value="">Select State</option>';
    states.forEach(state => {
      options += '<option value="' + state + '">' + state + '</option>';
    });

    // Hidden full-state input id (always different from the <select> id)
    const hiddenFullId = id + '_hidden';

    // Hidden short-state input id:
    // transform "how_many_state_1" -> "how_many_state_short_1" (note the \d)
    let shortId;
    if (id.includes('_') && /\\d+$/.test(id)) {
      const match = id.match(/^(.+)_(\\d+)$/);
      if (match) {
        const basePart = match[1];
        const number = match[2];
        shortId = basePart + '_short_' + number;
      } else {
        shortId = id + '_short';
      }
    } else {
      shortId = id + '_short';
    }

    // Keep both text inputs hidden — they're for PDF mapping
    return (
      '<div class="address-field">' +
        '<select id="' + id + '" name="' + id + '" class="address-select" ' +
        'onchange="if (window.updateStateHiddenFields) updateStateHiddenFields(this, \\'' + hiddenFullId + '\\', \\'' + shortId + '\\');">' +
          options +
        '</select>' +
        '<input type="text" id="' + hiddenFullId + '" name="' + hiddenFullId + '" style="display:none" />' +
        '<input type="text" id="' + shortId + '" name="' + shortId + '" style="display:none" />' +
      '</div>'
    );
  };

  // Derive "..._short_N" from a base id like "how_many_state_N"
  window.toShortIdFromBase = function(baseId){
    const m = baseId.match(/^(.+)_(\\d+)$/);
    return m ? m[1] + '_short_' + m[2] : baseId + '_short';
  };

  // Keep these helpers global too (they may be called by onchange/autofill)
  window.updateStateHiddenFields = function(selectEl, fullId, shortId) {
    const fullField  = document.getElementById(fullId);
    const shortField = document.getElementById(shortId);
    if (!fullField || !shortField) return;

    const full = (selectEl.value || '').trim();
    // Map full -> short (two-letter)
    const map = {
      'Alabama': 'AL','Alaska': 'AK','Arizona': 'AZ','Arkansas': 'AR','California': 'CA','Colorado': 'CO',
      'Connecticut': 'CT','Delaware': 'DE','Florida': 'FL','Georgia': 'GA','Hawaii': 'HI','Idaho': 'ID',
      'Illinois': 'IL','Indiana': 'IN','Iowa': 'IA','Kansas': 'KS','Kentucky': 'KY','Louisiana': 'LA',
      'Maine': 'ME','Maryland': 'MD','Massachusetts': 'MA','Michigan': 'MI','Minnesota': 'MN','Mississippi': 'MS',
      'Missouri': 'MO','Montana': 'MT','Nebraska': 'NE','Nevada': 'NV','New Hampshire': 'NH','New Jersey': 'NJ',
      'New Mexico': 'NM','New York': 'NY','North Carolina': 'NC','North Dakota': 'ND','Ohio': 'OH','Oklahoma': 'OK',
      'Oregon': 'OR','Pennsylvania': 'PA','Rhode Island': 'RI','South Carolina': 'SC','South Dakota': 'SD',
      'Tennessee': 'TN','Texas': 'TX','Utah': 'UT','Vermont': 'VT','Virginia': 'VA','Washington': 'WA',
      'West Virginia': 'WV','Wisconsin': 'WI','Wyoming': 'WY'
    };
    const short = map[full] || '';
    fullField.value  = full;
    shortField.value = short;
  };
})();
`;
  
 formHTML += `
/*───────────────────────────────*
 * return the true checkbox prefix
 *───────────────────────────────*/
function getCbPrefix (qId){
    if (questionSlugMap[qId]) return questionSlugMap[qId] + '_';
    if (questionNameIds[qId]) return questionNameIds[qId] + '_';
    return 'answer' + qId + '_';
}

/*───────────────────────────────*
 * buildCheckboxName(questionId, rawNameId, labelText)
 *───────────────────────────────*/
function buildCheckboxName (questionId, rawNameId, labelText){
    let namePart = (rawNameId || '').trim();
    if (!namePart){
        namePart = labelText.replace(/\\W+/g, '_').toLowerCase();
    }
    // Return the name part directly without adding question prefix
    return namePart;
}
`;



  // 1) Firebase config and check (only if not in test mode)
  if (!isTestMode) {
    formHTML += `
      let isUserLoggedIn = false;
      const firebaseConfig = {
          apiKey: "AIzaSyDS-tSSn7fdLBgwzfHQ_1MPG1w8S_4qb04",
          authDomain: "formwiz-3f4fd.firebaseapp.com",
          projectId: "formwiz-3f4fd",
          storageBucket: "formwiz-3f4fd.firebasestorage.app",
          messagingSenderId: "404259212529",
          appId: "1:404259212529:web:15a33bce82383b21cfed50",
          measurementId: "G-P07YEN0HPD"
      };
      firebase.initializeApp(firebaseConfig);
      const db = firebase.firestore();
      const urlParams = new URLSearchParams(window.location.search);
      const formId = urlParams.get("formId") || window.formId || 'default';
      let userId = null;
      firebase.auth().onAuthStateChanged(async function(user){
          if(user){ 
              isUserLoggedIn = true;
              userId=user.uid;
              // Fetch user data and display welcome message
              try {
                  const userDoc = await db.collection('users').doc(user.uid).get();
                  if(userDoc.exists) {
                      const userData = userDoc.data();
                      document.getElementById('user_firstname').value = userData.firstName || '';
                      document.getElementById('user_lastname').value = userData.lastName || '';
                      document.getElementById('user_email').value = userData.email || '';
                      document.getElementById('user_phone').value = userData.phone || '';
                      
                      // Update full name and address fields with 2-second delay to ensure DOM is ready
                      setTimeout(() => {
                      updateUserFullName();
                      updateUserAddressFields();
                      }, 2000);
                      document.getElementById('user_street').value = userData.address?.street || '';
                      document.getElementById('user_city').value = userData.address?.city || '';
                      document.getElementById('user_state').value = userData.address?.state || '';
                      document.getElementById('user_zip').value = userData.address?.zip || '';
                  }
              } catch(error) {
                  console.error("Error fetching user data:", error);
              }
          } else {
              isUserLoggedIn = false;
              // Do NOT redirect. Just let the user fill the form.
          }
      });
    `;
  } else {
    // In test mode, set user as logged in by default
    formHTML += `
      let isUserLoggedIn = false;
      let userId = null;
      const urlParams = new URLSearchParams(window.location.search);
      const formId = urlParams.get("formId") || window.formId || 'default';
    `;
  }

  // Collect linked fields data from GUI
  if (window.linkedFieldsConfig && window.linkedFieldsConfig.length > 0) {
    window.linkedFieldsConfig.forEach(config => {
      linkedFields.push({
        linkedFieldId: config.linkedFieldId,
        fields: config.fields
      });
    });
  }

  // 2) Our global objects
  formHTML += `var questionSlugMap       = ${JSON.stringify(questionSlugMap || {})};\n`;
  formHTML += `var questionNameIds = ${JSON.stringify(questionNameIds || {})};\n`;
  formHTML += `var jumpLogics = ${JSON.stringify(jumpLogics || [])};\n`;
  formHTML += `var conditionalPDFs = ${JSON.stringify(conditionalPDFs || [])};\n`;
  formHTML += `var pdfLogicPDFs = ${JSON.stringify(pdfLogicPDFs || [])};\n`;
  formHTML += `var alertLogics = ${JSON.stringify(alertLogics || [])};\n`;
  formHTML += `var checklistLogics = ${JSON.stringify(checklistLogics || [])};\n`;
  formHTML += `var checklistItems = ${JSON.stringify(checklistItems || [])};\n`;
  formHTML += `var conditionalAlerts = ${JSON.stringify(conditionalAlerts || [])};\n`;
  formHTML += `var labelMap = ${JSON.stringify(labelMap || {})};\n`;
  formHTML += `var amountMap = ${JSON.stringify(amountMap || {})};\n`;
  formHTML += `var labelNodeIdsMap = ${JSON.stringify(window.labelNodeIdsMap || {})};\n`;
  formHTML += `var unifiedFieldsMap = ${JSON.stringify(window.unifiedFieldsMap || {})};\n`;
  formHTML += `var linkedDropdowns = ${JSON.stringify(linkedDropdowns || [])};\n`;
  formHTML += `var hiddenLogicConfigs = ${JSON.stringify(hiddenLogicConfigs || [])};\n`;
  formHTML += `var linkedFields = ${JSON.stringify(linkedFields || [])};\n`;
  formHTML += `var isHandlingLink = false;\n`;
  
  // Dynamic conditional logic for business type question to show county question
  formHTML += `
// Dynamic conditional logic for business type question to show county question
function setupBusinessTypeConditionalLogic() {
  
  // Use dynamic approach - find question 11's name from questionNameIds
  const businessTypeQuestionName = questionNameIds['11'] || 'what_are_you_doing_business_as';
  
  // Find all radio buttons for the business type question
  const businessTypeRadios = document.querySelectorAll('input[name="' + businessTypeQuestionName + '"]');
  
  businessTypeRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      if (this.checked) {
        // Show county question (question-container-16) when any business type is selected
        const countyQuestion = document.getElementById('question-container-16');
        if (countyQuestion) {
          countyQuestion.classList.remove('hidden');
        } else {
        }
      }
    });
  });
}

// Set up the conditional logic when the page loads
document.addEventListener('DOMContentLoaded', function() {
  setupBusinessTypeConditionalLogic();
});

// Also set it up immediately in case DOMContentLoaded already fired
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBusinessTypeConditionalLogic);
} else {
  setupBusinessTypeConditionalLogic();
}
`;
  
  // URL Parameter parsing and auto-population
  formHTML += '// Function to get URL parameters\n' +
'function getUrlParameter(name) {\n' +
'    const urlParams = new URLSearchParams(window.location.search);\n' +
'    return urlParams.get(name);\n' +
'}\n\n' +
'// Function to populate hidden fields from URL parameters\n' +
'function populateHiddenFieldsFromUrl() {\n' +
'    const zipCode = getUrlParameter("zipCode");\n' +
'    const county = getUrlParameter("county");\n' +
'    const defendant = getUrlParameter("defendant");\n' +
'    const formId = getUrlParameter("formId");\n' +
'    \n' +
'    if (zipCode) {\n' +
'        const zipField = document.getElementById("form_zip");\n' +
'        if (zipField) zipField.value = zipCode;\n' +
'    }\n' +
'    \n' +
'    if (county) {\n' +
'        const countyField = document.getElementById("form_county");\n' +
'        if (countyField) countyField.value = county;\n' +
'    }\n' +
'    \n' +
'    if (defendant) {\n' +
'        const defendantField = document.getElementById("form_defendant");\n' +
'        if (defendantField) defendantField.value = defendant;\n' +
'    }\n' +
'    \n' +
'    if (formId) {\n' +
'        const formIdField = document.getElementById("form_ID");\n' +
'        if (formIdField) formIdField.value = formId;\n' +
'    }\n' +
'    \n' +
'}\n\n' +
'// Auto-populate on page load\n' +
'document.addEventListener("DOMContentLoaded", function() {\n' +
'    populateHiddenFieldsFromUrl();\n' +
'    setupLinkedFields();\n' +
'});\n\n' +
'// Function to check paragraph limit and create hidden checkbox\n' +
'function checkParagraphLimit(textareaId, paragraphLimit) {\n' +
'    if (!paragraphLimit || paragraphLimit === "null") return;\n' +
'    \n' +
'    const textarea = document.getElementById(textareaId);\n' +
'    if (!textarea) return;\n' +
'    \n' +
'    const currentLength = textarea.value.length;\n' +
'    const checkboxId = textareaId + "_overlimit";\n' +
'    let checkbox = document.getElementById(checkboxId);\n' +
'    \n' +
'    if (currentLength > paragraphLimit) {\n' +
'        // Create checkbox if it doesn\'t exist\n' +
'        if (!checkbox) {\n' +
'            checkbox = document.createElement("input");\n' +
'            checkbox.type = "checkbox";\n' +
'            checkbox.id = checkboxId;\n' +
'            checkbox.name = checkboxId;\n' +
'            checkbox.style.display = "none"; // Hidden checkbox\n' +
'            checkbox.checked = true;\n' +
'            \n' +
'            // Insert after the textarea\n' +
'            textarea.parentNode.insertBefore(checkbox, textarea.nextSibling);\n' +
'            \n' +
'        } else {\n' +
'            // Check the existing checkbox\n' +
'            checkbox.checked = true;\n' +
'        }\n' +
'    } else {\n' +
'        // Remove checkbox if it exists and we\'re under the limit\n' +
'        if (checkbox) {\n' +
'            checkbox.remove();\n' +
'        }\n' +
'    }\n' +
'}\n';
  
  /*---------------------------------------------------------------
 * HISTORY STACK – must exist in the final HTML before functions
 *--------------------------------------------------------------*/
/*---------------------------------------------------------------
 * HISTORY STACK – must exist in the final HTML before functions
 *--------------------------------------------------------------*/
formHTML += `var sectionStack = [];\n`;      // pushes as you LEAVE a section
formHTML += `var currentSectionNumber = 1;\n`;  // updated by navigateSection()
formHTML += `var pdfFileName = "${escapedPdfFormName}";\n`;  // Main PDF name
formHTML += `var pdfOutputFileName = "${escapedPdfOutputName}";\n`; // Use PDF output name
formHTML += `var stripePriceId = "${escapedStripePriceId}";\n`; // Stripe Price ID
formHTML += `var additionalPdfFileNames = ${JSON.stringify(escapedAdditionalPdfNames)};\n`;  // Additional PDF names
formHTML += `var allPdfFileNames = ["${escapedPdfOutputName.replace(/\.pdf$/i, '')}", ${escapedAdditionalPdfNames.map(name => `"${name.replace(/\.pdf$/i, '')}"`).join(", ")}];\n`;  // All PDF names in an array (without .pdf extension)





  formHTML += `var hiddenCheckboxCalculations = ${JSON.stringify(
    genHidden.hiddenCheckboxCalculations || []
  )};\n`;
  formHTML += `var hiddenTextCalculations = ${JSON.stringify(
    genHidden.hiddenTextCalculations || []
  )};\n\n`;

  // 3) Append the logicScriptBuffer
  formHTML += logicScriptBuffer + "\n";
  
  // 4) Add the hidden checkbox functions for radio buttons
  formHTML += `
/*──────────────────────────────────────────────────────────────*
 * Handle "Mark only one" selection functionality
 *──────────────────────────────────────────────────────────────*/
function handleMarkOnlyOneSelection(selectedInput, questionId) {
    if (!selectedInput.checked) return;
    
    // Find all radio buttons in this question group
    const container = document.querySelector('.checkbox-group-' + questionId);
    if (!container) return;
    
    const allInputs = container.querySelectorAll('input[type="radio"]');
    allInputs.forEach(input => {
        if (input !== selectedInput) {
            input.checked = false;
            // Update styling for unchecked inputs
            updateCheckboxStyle(input);
            // Remove hidden checkbox for unchecked inputs
            removeHiddenCheckbox(input.id);
        }
    });
    
    // Update styling for the selected input
    updateCheckboxStyle(selectedInput);
    
    // Create hidden checkbox for the selected input
    createHiddenCheckboxForRadio(selectedInput.id, selectedInput.name, selectedInput.value);
}

/*──────────────────────────────────────────────────────────────*
 * Create hidden checkbox for radio button selection
 *──────────────────────────────────────────────────────────────*/
function createHiddenCheckboxForRadio(radioId, radioName, radioValue) {
    // Remove any existing hidden checkbox with the same ID
    removeHiddenCheckbox(radioId);
    
    // Find the hidden fields container
    let hiddenContainer = document.getElementById('hidden_pdf_fields');
    if (!hiddenContainer) {
        // Create the hidden fields container if it doesn't exist
        hiddenContainer = document.createElement('div');
        hiddenContainer.id = 'hidden_pdf_fields';
        hiddenContainer.style.display = 'none';
        
        // Find the form and append the hidden container
        const form = document.querySelector('form') || document.body;
        form.appendChild(hiddenContainer);
    }
    
    // Create the hidden checkbox
    const hiddenCheckbox = document.createElement('input');
    hiddenCheckbox.type = 'checkbox';
    hiddenCheckbox.id = radioId;
    hiddenCheckbox.name = radioId; // Use the same name as the radio button ID
    hiddenCheckbox.value = radioValue;
    hiddenCheckbox.checked = true;
    hiddenCheckbox.style.display = 'none';
    
    // Add to hidden container
    hiddenContainer.appendChild(hiddenCheckbox);
    
    console.log('🔧 [HIDDEN CHECKBOX] Created hidden checkbox:', radioId, 'for radio:', radioId);
}

/*──────────────────────────────────────────────────────────────*
 * Remove hidden checkbox for radio button
 *──────────────────────────────────────────────────────────────*/
function removeHiddenCheckbox(radioId) {
    const hiddenCheckbox = document.getElementById(radioId);
    if (hiddenCheckbox && hiddenCheckbox.type === 'checkbox' && hiddenCheckbox.style.display === 'none') {
        hiddenCheckbox.remove();
        console.log('🔧 [HIDDEN CHECKBOX] Removed hidden checkbox:', radioId);
    }
}
`;

  // Add alert functions (always available for validation popups)
  formHTML += `
// Alert Logic Functions
// Track page load time to prevent alerts in first 3 seconds
const pageLoadTime = Date.now();
const ALERT_DELAY_MS = 3000; // 3 seconds

function showAlert(message) {
    // Check if 3 seconds have passed since page load
    const currentTime = Date.now();
    const timeSinceLoad = currentTime - pageLoadTime;
    
    if (timeSinceLoad < ALERT_DELAY_MS) {
        // If less than 3 seconds have passed, don't show the alert
        return;
    }
    
    const alertOverlay = document.getElementById('alertOverlay');
    const alertMessage = document.getElementById('alertMessage');
    
    if (alertOverlay && alertMessage) {
        // Check if this is a validation popup (HTML content) or regular alert (text)
        if (message.includes('<div')) {
            // This is HTML content (validation popup)
            alertMessage.innerHTML = message;
        } else {
            // This is a regular text alert
            alertMessage.textContent = message;
        }
        alertOverlay.style.display = 'flex';
    }
}

function closeAlert() {
    const alertOverlay = document.getElementById('alertOverlay');
    if (alertOverlay) {
        alertOverlay.style.display = 'none';
    }
}


// Show validation popup when user tries to proceed without answering all questions
function showValidationPopup() {
    const validationMessage = 
        '<div style="text-align: center;">' +
            '<div style="font-size: 2em; margin-bottom: 15px;">⚠️</div>' +
            '<div style="font-weight: 700; margin-bottom: 10px; color: #e74c3c;">Please Complete All Questions</div>' +
            '<div>You need to fill in all the questions on this page before you can proceed to the next section.</div>' +
        '</div>';
    showAlert(validationMessage);
}
`;

  // Add alert logic functions only if alert logics are enabled
  if (alertLogics.length > 0) {
    formHTML += `
function checkAlertLogic(changedElement) {
    if (!alertLogics || alertLogics.length === 0) return;
    
    // Get the question ID from the changed element
    let changedQuestionId = null;
    if (changedElement) {
        const elementId = changedElement.id;
        // Try to extract question ID from element ID
        for (const [qId, nameId] of Object.entries(questionNameIds)) {
            if (elementId === nameId || elementId === 'answer' + qId) {
                changedQuestionId = qId;
                break;
            }
        }
    }
    
    // If we can't determine which question changed, don't check any alerts
    // This prevents alerts from triggering on unrelated form elements
    if (!changedQuestionId) return;
    
    for (const alertLogic of alertLogics) {
        if (!alertLogic.conditions || alertLogic.conditions.length === 0) continue;
        
        // Only check this alert logic if it's related to the changed element
        let shouldCheckThisAlert = false;
        // Check if any condition in this alert logic references the changed question
        for (const condition of alertLogic.conditions) {
            if (condition.prevQuestion === changedQuestionId) {
                shouldCheckThisAlert = true;
                break;
            }
        }
        
        if (!shouldCheckThisAlert) continue;
        
        let shouldShowAlert = false;
        
        // Check if ANY of the conditions match (OR logic)
        for (const condition of alertLogic.conditions) {
            const prevQuestionId = condition.prevQuestion;
            const prevAnswer = condition.prevAnswer;
            
            // Get the previous question's value
            const prevQuestionElement = document.getElementById(questionNameIds[prevQuestionId]) || 
                                      document.getElementById('answer' + prevQuestionId);
            
            if (prevQuestionElement) {
                let prevValue = '';
                
                if (prevQuestionElement.type === 'checkbox') {
                    prevValue = prevQuestionElement.checked ? prevQuestionElement.value : '';
                } else {
                    prevValue = prevQuestionElement.value;
                }
                
                // Check if the condition matches
                if (prevValue.toString().toLowerCase() === prevAnswer.toLowerCase()) {
                    shouldShowAlert = true;
                    break; // Found a match, no need to check other conditions
                }
            }
        }
        
        // Show alert if conditions are met
        if (shouldShowAlert && alertLogic.message) {
            showAlert(alertLogic.message);
            return; // Show only the first matching alert
        }
    }
}

// Add event listeners for alert logic
document.addEventListener('DOMContentLoaded', function() {
    const formElements = document.querySelectorAll('input, select, textarea');
    formElements.forEach(element => {
        element.addEventListener('change', function() { checkAlertLogic(this); });
        element.addEventListener('input', function() { checkAlertLogic(this); });
    });
    
    // Initialize checkbox styling for beautiful blue borders
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        updateCheckboxStyle(checkbox);
    });
});
`;
  }

  // Always add cart functions (they're needed for the Continue button)
  formHTML += `
// Helper function to deduplicate PDFs based on comprehensive unique key
function deduplicatePdfs(pdfArray) {
  const seen = new Set();
  const deduplicated = [];
  
  for (const pdf of pdfArray) {
    // Create a comprehensive unique key using formId + priceId + portfolioId
    const key = (pdf.formId || pdf.pdfName || pdf.title) + '_' + pdf.priceId + '_' + (pdf.portfolioId || 'default');
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(pdf);
    } else {
      console.log('🛒 [CART DEBUG] Skipping duplicate PDF:', key, 'Original:', pdf.title);
    }
  }
  
  return deduplicated;
}

// Always-available Cart Modal (global)
window.showCartModal = function () {
  console.log('🛒 [CART DEBUG] showCartModal called');
  
  // Calculate all PDFs that will be added to cart
  const allPdfsToAdd = [];
  
  // Add main form
  const mainFormPriceId = window.stripePriceId || stripePriceId || '123';
  allPdfsToAdd.push({
    formId: (window.pdfOutputFileName || 'sc500.pdf').replace(/.pdf$/i, '').toLowerCase(),
    title: window.pdfFileName || 'Form',
    priceId: mainFormPriceId,
    pdfName: window.pdfFileName || ''
  });
  
  // Add conditional PDFs based on current form state
  if (Array.isArray(window.pdfLogicPDFs) && window.pdfLogicPDFs.length > 0) {
    console.log('🛒 [CART DEBUG] Found', window.pdfLogicPDFs.length, 'PDF logic items');
    
    for (const pdfLogic of window.pdfLogicPDFs) {
      if (!pdfLogic || !pdfLogic.pdfName || !pdfLogic.stripePriceId) continue;
      
      console.log('🛒 [CART DEBUG] Checking PDF logic for:', pdfLogic.pdfDisplayName || pdfLogic.pdfName);
      console.log('🛒 [CART DEBUG] PDF Logic details:', {
        questionId: pdfLogic.questionId,
        pdfName: pdfLogic.pdfName,
        isBigParagraph: pdfLogic.isBigParagraph,
        conditions: pdfLogic.conditions,
        triggerOption: pdfLogic.triggerOption,
        numberTrigger: pdfLogic.numberTrigger,
        numberValue: pdfLogic.numberValue
      });

      let matched = false;
      
      // Check if this is a bigParagraph with character limit
      if (pdfLogic.isBigParagraph) {
        // For Big Paragraph questions, check character limit
        const el = document.getElementById((window.questionNameIds || {})[pdfLogic.questionId]) ||
                   document.getElementById('answer' + pdfLogic.questionId);
        
        console.log('🔧 [PDF LOGIC DEBUG] Checking bigParagraph character limit:');
        console.log('  - Question ID:', pdfLogic.questionId);
        console.log('  - Element found:', el);
        console.log('  - Conditions:', pdfLogic.conditions);
        
        if (el) {
          const questionValue = el.value || '';
          console.log('🔧 [PDF LOGIC DEBUG] BigParagraph question', pdfLogic.questionId, 'value length:', questionValue.length);
          
          // Check each character limit condition
          for (const condition of pdfLogic.conditions) {
            if (condition.characterLimit) {
              console.log('🔧 [PDF LOGIC DEBUG] Checking character limit:', condition.characterLimit, 'against value length:', questionValue.length);
              if (questionValue.length > condition.characterLimit) {
                matched = true;
                console.log('🔧 [PDF LOGIC DEBUG] ✅ PDF logic matched for bigParagraph character limit:', pdfLogic.pdfDisplayName);
                break; // Exit the loop once we find a match
              }
            }
          }
          
          if (!matched) {
            console.log('🔧 [PDF LOGIC DEBUG] ❌ PDF logic NOT matched - character limit not exceeded');
          }
        } else {
          console.log('🔧 [PDF LOGIC DEBUG] ❌ Element not found for bigParagraph question', pdfLogic.questionId);
        }
      } else if (pdfLogic.triggerOption) {
        // For numbered dropdown with trigger option, check if the selected value matches the trigger
        const el = document.getElementById((window.questionNameIds || {})[pdfLogic.questionId]) ||
                   document.getElementById('answer' + pdfLogic.questionId);
        
        console.log('🔧 [PDF LOGIC DEBUG] Checking numbered dropdown trigger:');
        console.log('  - Question ID:', pdfLogic.questionId);
        console.log('  - Trigger Option:', pdfLogic.triggerOption);
        console.log('  - Element found:', el);
        console.log('  - Question Name IDs:', window.questionNameIds);
        
        if (el) {
          const val = el.value || '';
          console.log('🔧 [PDF LOGIC DEBUG] Numbered dropdown question', pdfLogic.questionId, 'value:', val, 'trigger:', pdfLogic.triggerOption);
          
          if (val === pdfLogic.triggerOption) {
            matched = true;
            console.log('🔧 [PDF LOGIC DEBUG] ✅ PDF logic matched for numbered dropdown:', pdfLogic.pdfDisplayName);
          } else {
            console.log('🔧 [PDF LOGIC DEBUG] ❌ PDF logic NOT matched - value:', val, 'expected:', pdfLogic.triggerOption);
          }
        } else {
          console.log('🔧 [PDF LOGIC DEBUG] ❌ Element not found for numbered dropdown question', pdfLogic.questionId);
        }
      } else if (pdfLogic.numberTrigger && pdfLogic.numberValue) {
        // For number questions with trigger conditions, check if the number meets the condition
        const el = document.getElementById((window.questionNameIds || {})[pdfLogic.questionId]) ||
                   document.getElementById('answer' + pdfLogic.questionId);
        
        console.log('🔧 [PDF LOGIC DEBUG] Checking number trigger:');
        console.log('  - Question ID:', pdfLogic.questionId);
        console.log('  - Number Trigger:', pdfLogic.numberTrigger);
        console.log('  - Number Value:', pdfLogic.numberValue);
        console.log('  - Element found:', el);
        
        if (el) {
          const val = parseFloat(el.value) || 0;
          const triggerValue = parseFloat(pdfLogic.numberValue) || 0;
          console.log('🔧 [PDF LOGIC DEBUG] Number question', pdfLogic.questionId, 'value:', val, 'trigger:', pdfLogic.numberTrigger, 'triggerValue:', triggerValue);
          
          let conditionMet = false;
          if (pdfLogic.numberTrigger === '=') {
            conditionMet = val === triggerValue;
          } else if (pdfLogic.numberTrigger === '>') {
            conditionMet = val > triggerValue;
          } else if (pdfLogic.numberTrigger === '<') {
            conditionMet = val < triggerValue;
          }
          
          if (conditionMet) {
            matched = true;
            console.log('🔧 [PDF LOGIC DEBUG] ✅ PDF logic matched for number trigger:', pdfLogic.pdfDisplayName);
          } else {
            console.log('🔧 [PDF LOGIC DEBUG] ❌ PDF logic NOT matched - number condition not met');
          }
        } else {
          console.log('🔧 [PDF LOGIC DEBUG] ❌ Element not found for number question', pdfLogic.questionId);
        }
      } else {
        // For regular conditions, check previous question logic
        const conds = Array.isArray(pdfLogic.conditions) ? pdfLogic.conditions : [];
        for (const c of conds) {
          const prevId = c?.prevQuestion;
          const expect = (c?.prevAnswer ?? '').toString().toLowerCase();
          if (!prevId) continue;

          const el = document.getElementById((window.questionNameIds || {})[prevId]) ||
                     document.getElementById('answer' + prevId);
          if (!el) {
            console.log('🛒 [CART DEBUG] Element not found for question', prevId);
            continue;
          }

          let val = '';
          if (el.type === 'checkbox') { val = el.checked ? (el.value || 'true') : ''; }
          else                        { val = el.value || ''; }

          console.log('🛒 [CART DEBUG] Question', prevId, 'value:', val, 'expected:', expect);

          if (val.toString().toLowerCase() === expect) {
            matched = true; // any condition match includes the PDF
            console.log('🛒 [CART DEBUG] ✅ PDF logic matched for:', pdfLogic.pdfDisplayName);
            }
          }
        }
      
      if (matched) {
        // Format the display name properly (e.g., "sc103" -> "SC-103")
        let displayTitle;
        if (pdfLogic.pdfDisplayName && pdfLogic.pdfDisplayName.trim() !== '') {
          const baseName = pdfLogic.pdfDisplayName.trim();
          displayTitle = baseName.toUpperCase().replace(/([A-Z])(\d+)/g, '$1-$2');
        } else {
          displayTitle = pdfLogic.pdfName.replace(/.pdf$/i, '');
        }
        
        allPdfsToAdd.push({
          formId: pdfLogic.pdfName.replace(/.pdf$/i, '').toLowerCase(),
          title: displayTitle,
          priceId: pdfLogic.stripePriceId,
          pdfName: pdfLogic.pdfName
        });
        console.log('🛒 [CART DEBUG] Added PDF logic item to showCartModal:', displayTitle);
      } else {
        console.log('🛒 [CART DEBUG] ❌ PDF logic not matched for:', pdfLogic.pdfDisplayName || pdfLogic.pdfName);
      }
    }
  }
  
  // Deduplicate PDFs to prevent multiple requests for the same PDF
  const originalCount = allPdfsToAdd.length;
  const deduplicatedPdfs = deduplicatePdfs(allPdfsToAdd);
  console.log('🛒 [CART DEBUG] Deduplication: Original count:', originalCount, 'After deduplication:', deduplicatedPdfs.length);
  
  console.log('🛒 [CART DEBUG] Total PDFs to add:', deduplicatedPdfs.length, deduplicatedPdfs);

  // Fetch prices for all PDFs
  async function fetchAllPrices() {
    const prices = [];
    for (const pdf of deduplicatedPdfs) {
      try {
        const r = await fetch('/stripe-price/' + pdf.priceId);
        if (r.ok) {
          const data = await r.json();
          const price = data && data.unit_amount != null ? (data.unit_amount / 100).toFixed(2) : '0.00';
          prices.push(parseFloat(price));
          console.log('🛒 [CART DEBUG] Price for', pdf.title, ':', price);
        } else {
          prices.push(0);
        }
      } catch (e) {
        console.error('🛒 [CART DEBUG] Error fetching price for', pdf.title, ':', e);
        prices.push(0);
      }
    }
    return prices;
  }

  fetchAllPrices().then((prices) => {
    const totalPrice = prices.reduce((sum, price) => sum + price, 0);
    const priceDisplay = totalPrice > 0 ? '$' + totalPrice.toFixed(2) : '...';
    
    console.log('🛒 [CART DEBUG] Total price:', priceDisplay);
    
    const modal = document.createElement('div');
    modal.id = 'cart-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(44,62,80,.45);display:flex;align-items:center;justify-content:center;z-index:99999;';
    modal.innerHTML = \`
      <div style="background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(44,62,80,.18);padding:32px 28px 24px;max-width:470px;width:90%;text-align:center;position:relative;">
        <h2>Checkout</h2>
        <p>Your form has been completed! Add it to your cart to download.</p>
        <p style="font-size:0.9em;color:#666;margin:10px 0;">\${deduplicatedPdfs.length} PDF(s) will be added to cart</p>
        <button id="addToCartBtn" style="background:linear-gradient(90deg,#4f8cff 0%,#38d39f 100%);color:#fff;border:none;border-radius:6px;padding:10px 28px;font-size:1.1em;font-weight:600;cursor:pointer;">
          Add to Cart - \${priceDisplay}
        </button>
        <br><br>
        <button id="viewCartBtn" style="background:#e0e7ef;color:#2c3e50;border:none;border-radius:6px;padding:8px 22px;font-size:1em;font-weight:600;cursor:pointer;">
          View Cart
        </button>
        <br><br>
        <button id="cancelCartBtn" style="background:#e74c3c;color:#fff;border:none;border-radius:6px;padding:8px 22px;font-size:1em;font-weight:600;cursor:pointer;">
          Cancel
        </button>
      </div>
    \`;
    document.body.appendChild(modal);

    document.getElementById('cancelCartBtn').onclick = () => modal.remove();
    document.getElementById('viewCartBtn').onclick   = () => { modal.remove(); window.location.href = '../Pages/cart.html'; };
    document.getElementById('addToCartBtn').onclick   = () => {
      console.log('🛒 [CART DEBUG] Add to cart button clicked');
      window.addFormToCart(mainFormPriceId);
      modal.remove();
    };
  });
};

// --- Cart helpers (new) ---
function clearCartState() {
  try { localStorage.removeItem('formwiz_cart'); } catch {}
  // expire cookie immediately
  document.cookie = 'formwiz_cart=;path=/;max-age=0';
}

function writeCartCookie(cart) {
  try { document.cookie = 'formwiz_cart=' + encodeURIComponent(JSON.stringify(cart)) + ';path=/;max-age=2592000'; } catch {}
}

function getUrlParam(name) {
  const u = new URLSearchParams(window.location.search);
  return u.get(name) || '';
}

// Add to cart helper (global, no Firebase required)
window.addFormToCart = function (priceId) {
  console.log('🛒 [CART DEBUG] addFormToCart called with priceId:', priceId);
  
  // 1) Fresh start each submission (prevents dupes/stale items across re-submits)
  clearCartState();

  // 2) Collect form data
  console.log('🔍 [CART DEBUG] Starting form data collection...');
  
  // First, ensure all dynamic fields are up-to-date
  console.log('🔍 [CART DEBUG] Updating dynamic fields...');
  if (typeof updateUserFullName === 'function') {
    console.log('🔍 [CART DEBUG] Calling updateUserFullName()...');
    updateUserFullName();
    
    // Check if user_fullname was updated
    const fullNameField = document.getElementById('user_fullname');
    if (fullNameField) {
      console.log('🔍 [CART DEBUG] user_fullname field value after updateUserFullName():', fullNameField.value);
    } else {
      console.log('🔍 [CART DEBUG] user_fullname field not found in DOM');
    }
  } else {
    console.log('🔍 [CART DEBUG] updateUserFullName function not available');
  }
  
  if (typeof updateUserAddressFields === 'function') {
    console.log('🔍 [CART DEBUG] Calling updateUserAddressFields()...');
    updateUserAddressFields();
  } else {
    console.log('🔍 [CART DEBUG] updateUserAddressFields function not available');
  }
  
  const form = document.getElementById('customForm');
  console.log('🔍 [CART DEBUG] Form element found:', !!form);
  
  const formData = {};
  if (form) {
    // Include both elements inside the form AND elements with form="customForm" attribute
    const formElements = Array.from(form.elements);
    const externalFormElements = Array.from(document.querySelectorAll('input[form="customForm"], textarea[form="customForm"], select[form="customForm"]'));
    const allFormElements = [...formElements, ...externalFormElements];
    
    console.log('🔍 [CART DEBUG] Form elements found:');
    console.log('  - Elements inside form:', formElements.length);
    console.log('  - External elements with form="customForm":', externalFormElements.length);
    console.log('  - Total elements to process:', allFormElements.length);
    
    // Log all elements we're about to process
    console.log('🔍 [CART DEBUG] All form elements:');
    allFormElements.forEach((el, index) => {
      console.log('  ' + (index + 1) + '. ' + el.tagName + ' - id: "' + el.id + '" - name: "' + el.name + '" - type: "' + el.type + '" - value: "' + el.value + '" - disabled: ' + el.disabled);
    });
    
    for (const el of allFormElements) {
      if (!el.name || el.disabled) {
        console.log('🔍 [CART DEBUG] Skipping element - id: "' + el.id + '" - name: "' + el.name + '" - disabled: ' + el.disabled);
        continue;
      }
      if (!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) {
        console.log('🔍 [CART DEBUG] Skipping non-form element - tagName: "' + el.tagName + '"');
        continue;
      }
      if (['button','submit','reset'].includes(el.type)) {
        console.log('🔍 [CART DEBUG] Skipping ' + el.type + ' element - id: "' + el.id + '"');
        continue;
      }
      
      // For hidden fields, include them if they have values
      if (el.type === 'hidden') {
        if (el.value && el.value.trim() !== '') {
          formData[el.name] = el.value;
          console.log('🔍 [CART DEBUG] Added hidden field - name: "' + el.name + '" - value: "' + el.value + '"');
        } else {
          console.log('🔍 [CART DEBUG] Skipping empty hidden field - name: "' + el.name + '" - value: "' + el.value + '"');
        }
        continue;
      }
      
      // For checkboxes and radios, only include if checked
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) {
          formData[el.name] = 'on'; // Send 'on' for checked checkboxes (standard HTML form behavior)
          console.log('🔍 [CART DEBUG] Added checked ' + el.type + ' - name: "' + el.name + '" - value: "on"');
        } else {
          console.log('🔍 [CART DEBUG] Skipping unchecked ' + el.type + ' - name: "' + el.name + '"');
        }
        // Skip unchecked checkboxes entirely - don't send them to server
      } else {
        let value = el.value;
        
        // Format date inputs to mm/dd/yyyy (same as manual download)
        if (el.type === 'date' && value) {
          const originalValue = value;
          value = formatDateForServer(value);
          console.log('🔍 [CART DEBUG] Formatted date - name: "' + el.name + '" - original: "' + originalValue + '" - formatted: "' + value + '"');
        }
        
        formData[el.name] = value;
        console.log('🔍 [CART DEBUG] Added field - name: "' + el.name + '" - value: "' + value + '"');
      }
    }
  }
  
  console.log('🔍 [CART DEBUG] Final form data collected:');
  console.log('🔍 [CART DEBUG] Total fields:', Object.keys(formData).length);
  Object.keys(formData).forEach(key => {
    console.log('🔍 [CART DEBUG]   ' + key + ': "' + formData[key] + '"');
  });

  console.log('🛒 [CART DEBUG] Form data collected:', Object.keys(formData).length, 'fields');

  // 3) Uniform metadata for every cart line
  const originalFormId = (window.pdfOutputFileName || 'sc500.pdf').replace(/.pdf$/i, '').toLowerCase();
  const formTitle      = window.pdfFileName || (typeof pdfFileName !== 'undefined' ? pdfFileName : 'Form');
  const countyName     = getUrlParam('county');
  const defendantName  = getUrlParam('defendantName');
  const portfolioId    = getUrlParam('portfolioId');
  const nowTs          = Date.now();

  // 4) Compute all PDF-logic matches (OR logic across conditions)
  const pdfLogicItems = [];
  let deduplicatedPdfLogicItems = []; // Declare outside try-catch to ensure it's always defined
  console.log('🛒 [CART DEBUG] Computing PDF logic items...');
  
  try {
    if (Array.isArray(window.pdfLogicPDFs) && window.pdfLogicPDFs.length > 0) {
      console.log('🛒 [CART DEBUG] Found', window.pdfLogicPDFs.length, 'PDF logic items to check');
      
      for (const pdfLogic of window.pdfLogicPDFs) {
        if (!pdfLogic || !pdfLogic.pdfName || !pdfLogic.stripePriceId) {
          console.log('🛒 [CART DEBUG] Skipping invalid PDF logic:', pdfLogic);
          continue;
        }
        
        console.log('🛒 [CART DEBUG] Checking PDF logic for:', pdfLogic.pdfDisplayName || pdfLogic.pdfName);
        console.log('🛒 [CART DEBUG] PDF Logic details:', {
          questionId: pdfLogic.questionId,
          pdfName: pdfLogic.pdfName,
          isBigParagraph: pdfLogic.isBigParagraph,
          conditions: pdfLogic.conditions,
          triggerOption: pdfLogic.triggerOption,
          numberTrigger: pdfLogic.numberTrigger,
          numberValue: pdfLogic.numberValue
        });

        let matched = false;
        
        // Check if this is a bigParagraph with character limit
        if (pdfLogic.isBigParagraph) {
          // For Big Paragraph questions, check character limit
          const el = document.getElementById((window.questionNameIds || {})[pdfLogic.questionId]) ||
                     document.getElementById('answer' + pdfLogic.questionId);
          
          console.log('🔧 [PDF LOGIC DEBUG] Checking bigParagraph character limit:');
          console.log('  - Question ID:', pdfLogic.questionId);
          console.log('  - Element found:', el);
          console.log('  - Conditions:', pdfLogic.conditions);
          
          if (el) {
            const questionValue = el.value || '';
            console.log('🔧 [PDF LOGIC DEBUG] BigParagraph question', pdfLogic.questionId, 'value length:', questionValue.length);
            
            // Check each character limit condition
            for (const condition of pdfLogic.conditions) {
              if (condition.characterLimit) {
                console.log('🔧 [PDF LOGIC DEBUG] Checking character limit:', condition.characterLimit, 'against value length:', questionValue.length);
                if (questionValue.length > condition.characterLimit) {
                  matched = true;
                  console.log('🔧 [PDF LOGIC DEBUG] ✅ PDF logic matched for bigParagraph character limit:', pdfLogic.pdfDisplayName);
                  break; // Exit the loop once we find a match
                }
              }
            }
            
            if (!matched) {
              console.log('🔧 [PDF LOGIC DEBUG] ❌ PDF logic NOT matched - character limit not exceeded');
            }
          } else {
            console.log('🔧 [PDF LOGIC DEBUG] ❌ Element not found for bigParagraph question', pdfLogic.questionId);
          }
        } else if (pdfLogic.triggerOption) {
          // For numbered dropdown with trigger option, check if the selected value matches the trigger
          const el = document.getElementById((window.questionNameIds || {})[pdfLogic.questionId]) ||
                     document.getElementById('answer' + pdfLogic.questionId);
          
          console.log('🔧 [PDF LOGIC DEBUG] Checking numbered dropdown trigger:');
          console.log('  - Question ID:', pdfLogic.questionId);
          console.log('  - Trigger Option:', pdfLogic.triggerOption);
          console.log('  - Element found:', el);
          console.log('  - Question Name IDs:', window.questionNameIds);
          
          if (el) {
            const val = el.value || '';
            console.log('🔧 [PDF LOGIC DEBUG] Numbered dropdown question', pdfLogic.questionId, 'value:', val, 'trigger:', pdfLogic.triggerOption);
            
            if (val === pdfLogic.triggerOption) {
              matched = true;
              console.log('🔧 [PDF LOGIC DEBUG] ✅ PDF logic matched for numbered dropdown:', pdfLogic.pdfDisplayName);
            } else {
              console.log('🔧 [PDF LOGIC DEBUG] ❌ PDF logic NOT matched - value:', val, 'expected:', pdfLogic.triggerOption);
            }
          } else {
            console.log('🔧 [PDF LOGIC DEBUG] ❌ Element not found for numbered dropdown question', pdfLogic.questionId);
          }
        } else if (pdfLogic.numberTrigger && pdfLogic.numberValue) {
          // For number questions with trigger conditions, check if the number meets the condition
          const el = document.getElementById((window.questionNameIds || {})[pdfLogic.questionId]) ||
                     document.getElementById('answer' + pdfLogic.questionId);
          
          console.log('🔧 [PDF LOGIC DEBUG] Checking number trigger:');
          console.log('  - Question ID:', pdfLogic.questionId);
          console.log('  - Number Trigger:', pdfLogic.numberTrigger);
          console.log('  - Number Value:', pdfLogic.numberValue);
          console.log('  - Element found:', el);
          
          if (el) {
            const val = parseFloat(el.value) || 0;
            const triggerValue = parseFloat(pdfLogic.numberValue) || 0;
            console.log('🔧 [PDF LOGIC DEBUG] Number question', pdfLogic.questionId, 'value:', val, 'trigger:', pdfLogic.numberTrigger, 'triggerValue:', triggerValue);
            
            let conditionMet = false;
            if (pdfLogic.numberTrigger === '=') {
              conditionMet = val === triggerValue;
            } else if (pdfLogic.numberTrigger === '>') {
              conditionMet = val > triggerValue;
            } else if (pdfLogic.numberTrigger === '<') {
              conditionMet = val < triggerValue;
            }
            
            if (conditionMet) {
              matched = true;
              console.log('🔧 [PDF LOGIC DEBUG] ✅ PDF logic matched for number question:', pdfLogic.pdfDisplayName);
            } else {
              console.log('🔧 [PDF LOGIC DEBUG] ❌ PDF logic NOT matched - value:', val, 'condition:', pdfLogic.numberTrigger, 'triggerValue:', triggerValue);
            }
          } else {
            console.log('🔧 [PDF LOGIC DEBUG] ❌ Element not found for number question', pdfLogic.questionId);
          }
        } else {
          // For regular conditions, check previous question logic
        const conds = Array.isArray(pdfLogic.conditions) ? pdfLogic.conditions : [];
        for (const c of conds) {
          const prevId = c?.prevQuestion;
          const expect = (c?.prevAnswer ?? '').toString().toLowerCase();
          if (!prevId) continue;

          const el = document.getElementById((window.questionNameIds || {})[prevId]) ||
                     document.getElementById('answer' + prevId);
          if (!el) {
            console.log('🛒 [CART DEBUG] Element not found for question', prevId);
            continue;
          }

          let val = '';
          if (el.type === 'checkbox') { val = el.checked ? (el.value || 'true') : ''; }
          else                        { val = el.value || ''; }

          console.log('🛒 [CART DEBUG] Question', prevId, 'value:', val, 'expected:', expect);

          if (val.toString().toLowerCase() === expect) {
            matched = true; // any condition match includes the PDF
            console.log('🛒 [CART DEBUG] ✅ PDF logic matched for:', pdfLogic.pdfDisplayName);
            }
          }
        }

        if (matched) {
          // Create a proper display name for the PDF logic item
          let displayTitle;
          
          // If there's a custom PDF display name from the PDF logic, use it
          if (pdfLogic.pdfDisplayName && pdfLogic.pdfDisplayName.trim() !== '') {
            // Format the display name properly (e.g., "sc103" -> "SC-103")
            const baseName = pdfLogic.pdfDisplayName.trim();
            // Convert to uppercase and add dashes for better formatting
            displayTitle = baseName.toUpperCase().replace(/([A-Z])(\d+)/g, '$1-$2');
          } else {
            // Create a title based on the main form name + PDF name
            const mainFormName = window.pdfFileName || 'Form';
            const pdfBaseName = pdfLogic.pdfName.replace(/\.pdf$/i, '').toUpperCase();
            displayTitle = mainFormName + ' ' + pdfBaseName;
          }
          
          const item = {
            formId: pdfLogic.pdfName.replace(/\.pdf$/i, '').toLowerCase(),
            title: displayTitle,
            priceId: pdfLogic.stripePriceId,
            pdfName: pdfLogic.pdfName,
            originalFormId: originalFormId,
            portfolioId: portfolioId,
            formData: formData,
            countyName: countyName,
            defendantName: defendantName,
            timestamp: nowTs
          };
          pdfLogicItems.push(item);
          console.log('🛒 [CART DEBUG] Added PDF logic item to cart:', item.title, 'with priceId:', item.priceId, 'portfolioId:', item.portfolioId);
        } else {
          console.log('🛒 [CART DEBUG] ❌ PDF logic not matched for:', pdfLogic.pdfDisplayName || pdfLogic.pdfName);
        }
      }
    } else {
      console.log('🛒 [CART DEBUG] No PDF logic items found');
    }
    
    // Deduplicate PDF logic items to prevent multiple requests for the same PDF
    const originalPdfLogicCount = pdfLogicItems.length;
    deduplicatedPdfLogicItems = deduplicatePdfs(pdfLogicItems);
    console.log('🛒 [CART DEBUG] PDF Logic Deduplication: Original count:', originalPdfLogicCount, 'After deduplication:', deduplicatedPdfLogicItems.length);
    
    console.log('🛒 [CART DEBUG] Final PDF logic items:', deduplicatedPdfLogicItems.length, deduplicatedPdfLogicItems);
  } catch (e) {
    console.warn('[PDF LOGIC] error computing matches:', e);
    // Ensure deduplicatedPdfLogicItems is always an array even if there's an error
    deduplicatedPdfLogicItems = [];
  }

  // 5) Preferred path: site cart manager
  if (typeof window.addToCart === 'function') {
    console.log('🛒 [CART DEBUG] Firebase addToCart function available');
    
    // Create a batch of all items to add
    const allItems = [];
    
    // Add main item
    const mainItem = {
      formId: originalFormId,
      title: formTitle,
      priceId: priceId,
      formData: { ...formData, originalFormId, portfolioId, pdfName: (window.pdfFileName || '') },
      countyName: countyName,
      defendantName: defendantName
    };
    allItems.push(mainItem);
    console.log('🛒 [CART DEBUG] Main item:', mainItem.title, 'with priceId:', mainItem.priceId);
    
    // Add all matched PDF logic items
    for (const item of deduplicatedPdfLogicItems) {
      const pdfItem = {
        formId: item.formId.toLowerCase(),
        title: item.title,
        priceId: item.priceId,
        formData: { ...item.formData, originalFormId: item.originalFormId, portfolioId: item.portfolioId, pdfName: item.pdfName },
        countyName: item.countyName,
        defendantName: item.defendantName
      };
      allItems.push(pdfItem);
      console.log('🛒 [CART DEBUG] PDF logic item:', pdfItem.title, 'with priceId:', pdfItem.priceId);
    }
    
    console.log('🛒 [CART DEBUG] Total items to add to Firebase:', allItems.length, allItems);
    
    // Add all items to cart with a small delay between each to prevent race conditions
    let addedCount = 0;
    allItems.forEach((item, index) => {
      setTimeout(() => {
        console.log('🛒 [CART DEBUG] Adding item', index + 1, 'of', allItems.length, ':', item.title);
        
        // Ensure formData includes portfolio ID for proper grouping
        const enhancedFormData = {
          ...item.formData,
          originalFormId: item.originalFormId,
          portfolioId: item.portfolioId,
          pdfName: item.pdfName
        };
        
        window.addToCart(
          item.formId, item.title, item.priceId, enhancedFormData,
          item.countyName, item.defendantName, item.pdfName
        );
        addedCount++;
        
        // Check if all items have been added
        if (addedCount === allItems.length) {
          console.log('🛒 [CART DEBUG] All', allItems.length, 'items added to Firebase cart successfully');
          const itemList = allItems.map(item => {
            let itemInfo = '- ' + item.title + ' (' + item.formId + ') - PriceId: ' + item.priceId + ' - PortfolioId: ' + (item.portfolioId || 'N/A');
            if (item.defendantName && item.defendantName.trim() !== '') {
              itemInfo += ' - Defendant: ' + item.defendantName;
            }
            return itemInfo;
          }).join('\\n');
          console.log('✅ Cart Debug: Successfully added ' + allItems.length + ' items to cart:\\n' + itemList);
          
          // Show debugging alert with cart data
          const debugInfo = 'Cart Debug: Successfully added ' + allItems.length + ' items to cart:\\n\\n' + itemList;
          alert(debugInfo);
          
          // Show cart page requested alert
          alert('Cart page requested');
        }
      }, index * 200); // 200ms delay between each item
    });

    // Don't redirect automatically - let the alert handle it
    return;
  }

  // 6) Fallback: localStorage + cookie (fresh array due to clearCartState)
  console.log('🛒 [CART DEBUG] Firebase not available, using fallback localStorage/cookie');
  
  let cart = [];
  const mainCartItem = {
    formId: originalFormId, title: formTitle, priceId,
    pdfName: (window.pdfFileName || ''),
    originalFormId, portfolioId, formData, countyName, defendantName, timestamp: nowTs
  };
  cart.push(mainCartItem);
  console.log('🛒 [CART DEBUG] Main cart item:', mainCartItem.title, 'with priceId:', mainCartItem.priceId);
  
  for (const item of deduplicatedPdfLogicItems) {
    cart.push(item);
    console.log('🛒 [CART DEBUG] PDF logic cart item:', item.title, 'with priceId:', item.priceId);
  }

  // Final deduplication of the entire cart to prevent any duplicates
  const originalCartCount = cart.length;
  cart = deduplicatePdfs(cart);
  console.log('🛒 [CART DEBUG] Final cart deduplication: Original count:', originalCartCount, 'After deduplication:', cart.length);

  console.log('🛒 [CART DEBUG] Total items in fallback cart:', cart.length, cart);

  try { localStorage.setItem('formwiz_cart', JSON.stringify(cart)); } catch {}
  writeCartCookie(cart);

  const itemList = cart.map(item => {
    let itemInfo = '- ' + item.title + ' (' + item.formId + ') - PriceId: ' + item.priceId + ' - PortfolioId: ' + (item.portfolioId || 'N/A');
    if (item.defendantName && item.defendantName.trim() !== '') {
      itemInfo += ' - Defendant: ' + item.defendantName;
    }
    return itemInfo;
  }).join('\\n');
  console.log('✅ Cart Debug: Added ' + cart.length + ' items to local storage:\\n' + itemList);
  
  // Show debugging alert with cart data
  const debugInfo = 'Cart Debug: Added ' + cart.length + ' items to local storage:\\n\\n' + itemList;
  alert(debugInfo);
  
  // Show cart page requested alert
  alert('Cart page requested');
};


// Fallback cart count function (global, no Firebase required)
window.getCartCount = function() {
  try {
    const cartData = localStorage.getItem('formwiz_cart');
    if (cartData) {
      const cart = JSON.parse(cartData);
      return Array.isArray(cart) ? cart.length : 0;
    }
  } catch (e) {
    console.error('Error getting cart count:', e);
  }
  return 0;
};
`;



  // Always define checklist variables (needed for showThankYouMessage function)
  formHTML += `
// Checklist Variables (always defined)
let userChecklist = [];
let staticChecklistItems = [];
`;

  // Add checklist functionality if any checklist logic is enabled
  if (checklistLogics.length > 0) {
    formHTML += `
// Checklist Logic Functions
function checkChecklistLogic(changedElement) {
    if (!checklistLogics || checklistLogics.length === 0) return;
    
    // Get the question ID from the changed element
    let changedQuestionId = null;
    if (changedElement) {
        const elementId = changedElement.id;
        // Try to extract question ID from element ID
        for (const [qId, nameId] of Object.entries(questionNameIds)) {
            if (elementId === nameId || elementId === 'answer' + qId) {
                changedQuestionId = qId;
                break;
            }
        }
    }
    
    for (const checklistLogic of checklistLogics) {
        if (!checklistLogic.conditions || checklistLogic.conditions.length === 0) continue;
        
        // Only check this checklist logic if it's related to the changed element
        let shouldCheckThisLogic = false;
        if (changedQuestionId) {
            // Check if any condition in this checklist logic references the changed question
            for (const condition of checklistLogic.conditions) {
                if (condition.prevQuestion === changedQuestionId) {
                    shouldCheckThisLogic = true;
                    break;
                }
            }
        } else {
            // If we can't determine which question changed, check all logic (fallback)
            shouldCheckThisLogic = true;
        }
        
        if (!shouldCheckThisLogic) continue;
        
        // Check if ANY of the conditions match (OR logic)
        for (const condition of checklistLogic.conditions) {
            const prevQuestionId = condition.prevQuestion;
            const prevAnswer = condition.prevAnswer;
            
            // Get the previous question's value
            const prevQuestionElement = document.getElementById(questionNameIds[prevQuestionId]) || 
                                      document.getElementById('answer' + prevQuestionId);
            
            if (prevQuestionElement) {
                let prevValue = '';
                
                if (prevQuestionElement.type === 'checkbox') {
                    prevValue = prevQuestionElement.checked ? prevQuestionElement.value : '';
                } else {
                    prevValue = prevQuestionElement.value;
                }
                
                // Check if the condition matches
                if (prevValue.toString().toLowerCase() === prevAnswer.toLowerCase()) {
                    // Add checklist items to user's checklist
                    if (condition.checklistItems && condition.checklistItems.length > 0) {
                        condition.checklistItems.forEach(item => {
                            if (!userChecklist.includes(item)) {
                                userChecklist.push(item);
                            }
                        });
                    }
                    break; // Found a match, no need to check other conditions
                }
            }
        }
    }
}

// Add event listeners for checklist logic
document.addEventListener('DOMContentLoaded', function() {
    const formElements = document.querySelectorAll('input, select, textarea');
    formElements.forEach(element => {
        element.addEventListener('change', function() { checkChecklistLogic(this); });
        element.addEventListener('input', function() { checkChecklistLogic(this); });
    });
    
    // Initialize static checklist items
    staticChecklistItems = ${JSON.stringify(checklistItems || [])};
});
`;
  }

  // 4) The rest of the main JS code
  formHTML += `
  
  
  function sanitizeQuestionText (str){
    return String(str)
       .toLowerCase()
        .replace(/\\W+/g, "_")
        .replace(/^_+|_+$/g, "");
}

// Phone number formatter function
function formatPhoneNumber(value) {
  if (!value) return value;
  
  const phoneNumber = value.replace(/\\D/g, '');
  const phoneNumberLength = phoneNumber.length;
  
  if (phoneNumberLength < 4) {
    return phoneNumberLength > 0 ? '(' + phoneNumber : '';
  } else if (phoneNumberLength < 7) {
    return '(' + phoneNumber.substring(0, 3) + ') ' + phoneNumber.substring(3);
  } else {
    return '(' + phoneNumber.substring(0, 3) + ') ' + 
           phoneNumber.substring(3, 6) + '-' + 
           phoneNumber.substring(6, 10);
  }
}

// Initialize all phone inputs on the page
document.addEventListener('DOMContentLoaded', function() {
  const phoneInputs = document.querySelectorAll('.phone-input');
  
  phoneInputs.forEach(phoneInput => {
    // Format existing value if any
    if (phoneInput.value) {
      phoneInput.value = formatPhoneNumber(phoneInput.value);
    }
    
    // Set up event listener for input
    phoneInput.addEventListener('input', function(e) {
      const input = e.target;
      const value = input.value.replace(/\\D/g, '').substring(0, 10); // Strip non-digits and limit to 10 digits
      input.value = formatPhoneNumber(value);
    });
  });
});


function toggleAmountField(amountFieldId, show) {
    const amountField = document.getElementById(amountFieldId);
    if (amountField) {
        amountField.style.display = show ? 'block' : 'none';
        if (!show) amountField.value = '';
    }
}

/*──────────────────────────────────────────────────────────────*
 * Extract question ID from onchange attribute
 *──────────────────────────────────────────────────────────────*/
function extractQuestionIdFromOnchange(fn) {
    if (!fn) return null;
    const s = fn.toString();
    const m = s.match(/showTextboxLabels\\s*\\(\\s*(\\d+)\\s*,/);
    return m ? m[1] : null;
}

/*──────────────────────────────────────────────────────────────*
 * Handle "Mark only one" selection functionality
 *──────────────────────────────────────────────────────────────*/
function handleMarkOnlyOneSelection(selectedInput, questionId) {
    if (!selectedInput.checked) return;
    
    // Find all radio buttons in this question group
    const container = document.querySelector('.checkbox-group-' + questionId);
    if (!container) return;
    
    const allInputs = container.querySelectorAll('input[type="radio"]');
    allInputs.forEach(input => {
        if (input !== selectedInput) {
            input.checked = false;
            // Update styling for unchecked inputs
            updateCheckboxStyle(input);
            // Remove hidden checkbox for unchecked inputs
            removeHiddenCheckbox(input.id);
        }
    });
    
    // Update styling for the selected input
    updateCheckboxStyle(selectedInput);
    
    // Create hidden checkbox for the selected input
    createHiddenCheckboxForRadio(selectedInput.id, selectedInput.name, selectedInput.value);
}

/*──────────────────────────────────────────────────────────────*
 * Create hidden checkbox for radio button selection
 *──────────────────────────────────────────────────────────────*/
function createHiddenCheckboxForRadio(radioId, radioName, radioValue) {
    // Remove any existing hidden checkbox with the same ID
    removeHiddenCheckbox(radioId);
    
    // Find the hidden fields container
    let hiddenContainer = document.getElementById('hidden_pdf_fields');
    if (!hiddenContainer) {
        // Create the hidden fields container if it doesn't exist
        hiddenContainer = document.createElement('div');
        hiddenContainer.id = 'hidden_pdf_fields';
        hiddenContainer.style.display = 'none';
        
        // Find the form and append the hidden container
        const form = document.querySelector('form') || document.body;
        form.appendChild(hiddenContainer);
    }
    
    // Create the hidden checkbox
    const hiddenCheckbox = document.createElement('input');
    hiddenCheckbox.type = 'checkbox';
    hiddenCheckbox.id = radioId;
    hiddenCheckbox.name = radioId; // Use the same name as the radio button ID
    hiddenCheckbox.value = radioValue;
    hiddenCheckbox.checked = true;
    hiddenCheckbox.style.display = 'none';
    
    // Add to hidden container
    hiddenContainer.appendChild(hiddenCheckbox);
    
    console.log('🔧 [HIDDEN CHECKBOX] Created hidden checkbox:', radioId, 'for radio:', radioId);
}

/*──────────────────────────────────────────────────────────────*
 * Remove hidden checkbox for radio button
 *──────────────────────────────────────────────────────────────*/
function removeHiddenCheckbox(radioId) {
    const hiddenCheckbox = document.getElementById(radioId);
    if (hiddenCheckbox && hiddenCheckbox.type === 'checkbox' && hiddenCheckbox.style.display === 'none') {
        hiddenCheckbox.remove();
        console.log('🔧 [HIDDEN CHECKBOX] Removed hidden checkbox:', radioId);
    }
}

/*──────────────────────────────────────────────────────────────*
 * Handle "None of the above" checkbox functionality
 *──────────────────────────────────────────────────────────────*/
function toggleNoneOption(checkbox, questionId) {
    if (!checkbox.checked) return;

    // Find the "None of the above" checkbox using more robust selectors
    const cbPrefix = getCbPrefix(questionId);
    const noneCheckbox = document.querySelector('input[id="' + cbPrefix + 'none"]') || 
                         document.querySelector('input[id^="' + cbPrefix + '"][id$="_none"]');
                         
    if (noneCheckbox && noneCheckbox.checked) {
        // Uncheck the "None of the above" option when any other option is checked
        noneCheckbox.checked = false;
    }
}

function handleNoneOfTheAboveToggle(noneCheckbox, questionId) {
    if (!noneCheckbox.checked) return;
    
    // When "None of the above" is checked, uncheck all other options
    const container = document.querySelector('.checkbox-group-' + questionId);
    if (!container) return;
    
    const allCheckboxes = container.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
        // Skip the "None" checkbox itself
        const isNoneCheckbox = checkbox.id.endsWith('_none') || checkbox.id.endsWith('none');
        if (checkbox !== noneCheckbox && !isNoneCheckbox) {
            checkbox.checked = false;
            
            // If this checkbox has an amount field, hide it
            const amountId = checkbox.id + '_amount';
            toggleAmountField(amountId, false);
        }
    });
    
    // Update styling for all checkboxes
    allCheckboxes.forEach(checkbox => {
        updateCheckboxStyle(checkbox);
    });
}

/*──────────────────────────────────────────────────────────────*
 * Update checkbox styling for beautiful blue border
 *──────────────────────────────────────────────────────────────*/
function updateCheckboxStyle(checkbox) {
    const container = document.getElementById('checkbox-container-' + checkbox.id);
    if (container) {
        if (checkbox.checked) {
            container.classList.add('checked');
        } else {
            container.classList.remove('checked');
        }
    }
}

/*──────────────────────────────────────────────────────────────*
 * Form validation functions
 *──────────────────────────────────────────────────────────────*/
function validateAndProceed(sectionNumber) {
    if (validateCurrentSection(sectionNumber)) {
        handleNext(sectionNumber);
    } else {
        // Show validation popup when validation fails
        showValidationPopup();
    }
}

// Show validation popup when user tries to proceed without answering all questions
function showValidationPopup() {
    const validationMessage = 
        '<div style="text-align: center;">' +
            '<div style="font-size: 2em; margin-bottom: 15px;">⚠️</div>' +
            '<div style="font-weight: 700; margin-bottom: 10px; color: #e74c3c;">Please Complete All Questions</div>' +
            '<div>You need to fill in all the questions on this page before you can proceed to the next section.</div>' +
        '</div>';
    showAlert(validationMessage);
}

// Global function to trigger visibility updates for dependent questions
function triggerVisibilityUpdates() {
    
    // Find all question containers and trigger their visibility logic
    const questionContainers = document.querySelectorAll('[id^="question-container-"]');
    
    questionContainers.forEach(container => {
        const questionId = container.id.replace('question-container-', '');
        
        // Try to find and call the updateVisibility function for this question
        // The conditional logic creates functions in the global scope, so we need to call them
        try {
            // Look for the updateVisibility function that was created for this question
            // The function is created in a closure, so we need to trigger it via the event listeners
        const questionElement = document.getElementById(questionNameIds[questionId]) || 
                              document.getElementById('answer' + questionId);
        
        if (questionElement) {
            // Trigger change event to update visibility
            const event = new Event('change', { bubbles: true });
            questionElement.dispatchEvent(event);
            } else {
            }
        } catch (error) {
        }
    });
}

// Fallback function to manually check and update visibility without relying on generated scripts
function triggerVisibilityUpdatesFallback() {
    
    // Find all question containers
    const questionContainers = document.querySelectorAll('[id^="question-container-"]');
    
    questionContainers.forEach(container => {
        const questionId = container.id.replace('question-container-', '');
        
        // Check if this question has conditional logic by looking for data attributes or other indicators
        // For now, we'll manually check common conditional logic patterns
        
        // Check if this question should be visible based on other question values
        // This is a simplified version of the conditional logic
        let shouldBeVisible = true;
        
        // Look for any dropdown or input that might control this question's visibility
        const allInputs = document.querySelectorAll('input, select, textarea');
        allInputs.forEach(input => {
            if (input.id && input.id !== container.id) {
                // Check if this input's value should affect the visibility of the current question
                // This is a simplified check - in a real implementation, you'd need to parse the actual conditional logic
                if (input.value && input.value.trim() !== '') {
                    // For now, we'll just log this - the actual conditional logic would be more complex
                }
            }
        });
        
        // For debugging, let's just make sure all questions are visible initially
        // In a real implementation, you'd implement the actual conditional logic here
        if (shouldBeVisible) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    });
}

function validateCurrentSection(sectionNumber) {
    const section = document.getElementById('section' + sectionNumber);
    if (!section) return true;
    
    // Only validate visible questions (not hidden ones)
    const questions = section.querySelectorAll('.question-container:not(.hidden)');
    let isValid = true;
    
    questions.forEach(question => {
        const questionId = question.id.replace('question-container-', '');
        const questionType = getQuestionTypeFromContainer(question);
        
        if (!validateQuestion(question, questionType, questionId)) {
            isValid = false;
        }
    });
    
    // Update next button state
    const nextButton = document.getElementById('next-button-' + sectionNumber);
    if (nextButton) {
        nextButton.disabled = !isValid;
    }
    
    return isValid;
}

function getQuestionTypeFromContainer(questionContainer) {
    // Check for different input types to determine question type
    if (questionContainer.querySelector('input[type="checkbox"]')) {
        return 'checkbox';
    } else if (questionContainer.querySelector('select')) {
        return 'dropdown';
    } else if (questionContainer.querySelector('input[type="text"]')) {
        return 'text';
    } else if (questionContainer.querySelector('input[type="email"]')) {
        return 'email';
    } else if (questionContainer.querySelector('input[type="tel"]')) {
        return 'phone';
    } else if (questionContainer.querySelector('input[type="number"]')) {
        return 'number';
    } else if (questionContainer.querySelector('input[type="date"]')) {
        return 'date';
    } else if (questionContainer.querySelector('textarea')) {
        return 'bigParagraph';
    }
    return 'text'; // default
}

function validateQuestion(questionContainer, questionType, questionId) {
    let isValid = true;
    
    switch (questionType) {
        case 'checkbox':
            isValid = validateCheckboxQuestion(questionContainer);
            break;
        case 'dropdown':
            isValid = validateDropdownQuestion(questionContainer);
            break;
        case 'text':
        case 'email':
        case 'phone':
        case 'number':
        case 'date':
        case 'bigParagraph':
            isValid = validateTextQuestion(questionContainer);
            break;
        default:
            isValid = true;
    }
    
    // Add visual feedback
    if (!isValid) {
        questionContainer.classList.add('form-field-required');
        showValidationError(questionContainer, 'This field is required.');
    } else {
        questionContainer.classList.remove('form-field-required');
        hideValidationError(questionContainer);
    }
    
    return isValid;
}

function validateCheckboxQuestion(questionContainer) {
    const checkboxes = questionContainer.querySelectorAll('input[type="checkbox"]');
    const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked);
    return checkedBoxes.length > 0;
}

function validateDropdownQuestion(questionContainer) {
    const select = questionContainer.querySelector('select');
    if (!select) return true;
    
    // Check if the dropdown has a value and it's not the default empty/disabled option
    const isValid = select.value && select.value.trim() !== '' && select.value !== 'Select an option';
    return isValid;
}

function validateTextQuestion(questionContainer) {
    const inputs = questionContainer.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="date"], textarea');
    if (inputs.length === 0) return true;
    
    for (let input of inputs) {
        if (!input.value || input.value.trim() === '') {
            return false;
        }
    }
    return true;
}

function showValidationError(container, message) {
    let errorDiv = container.querySelector('.validation-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'validation-error';
        container.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function hideValidationError(container) {
    const errorDiv = container.querySelector('.validation-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// Add validation listeners to all form fields
function addValidationListeners() {
    const currentSection = document.querySelector('.section.active');
    if (!currentSection) return;
    
    const sectionNumber = currentSection.id.replace('section', '');
    const formFields = currentSection.querySelectorAll('input, select, textarea');
    
    formFields.forEach(field => {
        // Remove existing listeners to prevent duplicates
        field.removeEventListener('change', field._validationHandler);
        field.removeEventListener('input', field._validationHandler);
        
        // Create new handler
        field._validationHandler = () => validateCurrentSection(sectionNumber);
        
        // Add listeners
        field.addEventListener('change', field._validationHandler);
        field.addEventListener('input', field._validationHandler);
    });
    
    // Initial validation
    validateCurrentSection(sectionNumber);
}

// Initialize validation when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    addValidationListeners();
    
    // Trigger visibility updates on DOM load to show dependent questions
    setTimeout(() => {
        if (typeof triggerVisibilityUpdates === 'function') {
            triggerVisibilityUpdates();
        }
    }, 300);
    
    // Re-add listeners when sections change
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (mutation.target.classList.contains('section')) {
                    setTimeout(addValidationListeners, 100);
                }
            }
        });
    });
    
    observer.observe(document.body, {
        attributes: true,
        subtree: true
    });
});

// 🔧 NEW: Global flag to prevent duplicate function calls
let isCreatingFields = false;

function showTextboxLabels(questionId, count){
    
    // 🔧 NEW: Check if we're already creating fields
    if (isCreatingFields) {
        return;
    }
    
    const container = document.getElementById("labelContainer" + questionId);
    if(!container) {
        return;
    }

    // 🔧 NEW: Check if we already have fields with values (more flexible than exact count match)
    const existingFields = container.querySelectorAll('input, select, textarea');
    const expectedCount = parseInt(count) || 0;
    
    // Check if we have the correct number of fields already
    if (existingFields.length > 0) {
        const currentCount = existingFields.length / (labelMap[questionId]?.length || 1); // Calculate how many entries we currently have
        
        // Only skip if we have the exact right number of fields AND they have values
        if (currentCount === expectedCount) {
            let hasValues = false;
            existingFields.forEach(field => {
                if (field.value && field.value.trim() !== '') {
                    hasValues = true;
                }
            });
            
            // If we have the right count and values, only skip during initial autofill
            if (hasValues && window.isInitialAutofill) {
                return;
            }
        }
        
        // 🔧 NEW: If fields exist but have no values, check if we're in the middle of autofill
        
        // Check if autofill is currently running
        if (window.isInitialAutofill) {
            return;
        }
        
        // Check if there are any pending autofill operations
        const autofillInProgress = document.querySelector('[data-autofill-pending]');
        if (autofillInProgress) {
            return;
        }
    }

    container.innerHTML = "";
    
    // Try to get unified fields first, fallback to old arrays
    const qBlock = document.querySelector('#question-container-' + questionId)?.closest('.question-block') || 
                   document.querySelector('[id*="' + questionId + '"]')?.closest('.question-block');
    
    let allFieldsInOrder = [];
    
    if (qBlock) {
        const unifiedFields = Array.from(qBlock.querySelectorAll('#unifiedFields' + questionId + ' .unified-field'));
        
        if (unifiedFields.length > 0) {
            // Use unified container data
            const allElements = [];
            
            unifiedFields.forEach((el) => {
                const fieldType = el.getAttribute('data-type');
                const fieldOrder = parseInt(el.getAttribute('data-order'));
                const labelTextEl = el.querySelector('#labelText' + questionId + '_' + fieldOrder);
                const nodeIdTextEl = el.querySelector('#nodeIdText' + questionId + '_' + fieldOrder);
                
                if (labelTextEl && nodeIdTextEl) {
                    allElements.push({
                        type: fieldType,
                        label: labelTextEl.textContent.trim(),
                        nodeId: nodeIdTextEl.textContent.trim(),
                        order: fieldOrder
                    });
                }
            });
            
            // Sort by data-order attribute (creation order)
            allElements.sort((a, b) => a.order - b.order);
            allFieldsInOrder = allElements;
        }
    }
    
    // Fallback to unified fields map or old arrays if no unified fields found
    if (allFieldsInOrder.length === 0) {
        // Try unified fields map first
        if (window.unifiedFieldsMap && window.unifiedFieldsMap[questionId]) {
            allFieldsInOrder = window.unifiedFieldsMap[questionId];
        } else {
            // Fallback to old arrays
            const theseLabels = labelMap[questionId] || [];
            const theseAmounts = amountMap[questionId] || [];
            
            allFieldsInOrder = [
                ...theseLabels.map((lbl, index) => ({
                    type: 'label',
                    label: lbl,
                    nodeId: (window.labelNodeIdsMap && window.labelNodeIdsMap[questionId] ? window.labelNodeIdsMap[questionId] : [])[index] || "",
                    order: index
                })),
                ...theseAmounts.map((amt, index) => ({
                    type: 'amount',
                    label: amt,
                    nodeId: "",
                    order: index
                }))
            ];
        }
    }

    /* get and sanitise the question's visible text exactly once */
    const questionH3   = document
        .getElementById("question-container-" + questionId)
        ?.querySelector("h3")?.textContent || ("answer" + questionId);
    const qSafe = sanitizeQuestionText(questionH3);

    // Generate hidden checkboxes for the selected count
    generateHiddenCheckboxes(questionId, qSafe, count);

    // Generate hidden address textboxes for location fields
    generateHiddenAddressTextboxes(questionId, count, allFieldsInOrder);

    // Define location field names for visual separation
    const locationFields = ['Street', 'City', 'State', 'Zip'];

    for(let j = 1; j <= count; j++){
        let lastWasLocation = false;
        let firstField = true;
        
        // Create entry container div
        const entryContainer = document.createElement('div');
        entryContainer.className = 'entry-container';
        entryContainer.style.cssText = 'border: 2px solid #2980b9 !important; border-radius: 12px; padding: 20px; margin: 20px auto; background-color: #f8f9ff; box-shadow: 0 4px 8px rgba(41, 128, 185, 0.15); transition: all 0.3s ease; display: inline-block; width: auto; min-width: 450px; max-width: 100%; box-sizing: border-box;';
        
        // Process all fields in creation order
        for(let fieldIndex = 0; fieldIndex < allFieldsInOrder.length; fieldIndex++){
            const field = allFieldsInOrder[fieldIndex];
            const isLocationField = locationFields.includes(field.label);
            
            // Add <br> before first location field in each count
            if (isLocationField && !lastWasLocation && !firstField) {
                const br = document.createElement('br');
                entryContainer.appendChild(br);
            }
            
            if (field.type === 'label') {
                const fieldId = field.nodeId + "_" + j;
                if (field.label === 'State') {
                    // Use dropdown for State field
                    const dropdownDiv = document.createElement('div');
                    dropdownDiv.innerHTML = createStateDropdown(fieldId, j);
                    entryContainer.appendChild(dropdownDiv.firstElementChild);
                } else {
                    // Use regular input for other fields
                    const inputDiv = document.createElement('div');
                    inputDiv.innerHTML = createAddressInput(fieldId, field.label, j);
                    entryContainer.appendChild(inputDiv.firstElementChild);
                }
            } else if (field.type === 'amount') {
                const fieldId = field.nodeId + "_" + j;
                const inputDiv = document.createElement('div');
                inputDiv.innerHTML = createAddressInput(fieldId, field.label, j, 'number');
                entryContainer.appendChild(inputDiv.firstElementChild);
                
                // Add a <br> after the Zip input only if there are more fields after it
                const remainingFields = allFieldsInOrder.slice(fieldIndex + 1);
                if (remainingFields.length > 0) {
                  const brElement = document.createElement('br');
                  entryContainer.appendChild(brElement);
                }
            }
            
            lastWasLocation = isLocationField;
            firstField = false;
        }
        
        // Append the entry container to the main container
        container.appendChild(entryContainer);
        
        // Add 1 <br> tag after each entry for better visual separation
        const br = document.createElement('br');
        container.appendChild(br);
    }
    attachCalculationListeners();   // keep this
    
    // Update linked fields after creating new textboxes
    updateLinkedFields();
    
    // Attach autosave listeners to newly generated textbox inputs
    const newInputs = container.querySelectorAll('input[type="text"], input[type="number"]');
    newInputs.forEach(input => {
        input.addEventListener('input', function() {
            // Add a small delay to ensure the value is properly set before saving
            setTimeout(() => {
                if (typeof isUserLoggedIn !== 'undefined' && isUserLoggedIn) {
                    if (typeof saveAnswers === 'function') {
                        saveAnswers();
                    }
                } else {
                    if (typeof saveAnswersToLocalStorage === 'function') {
                        saveAnswersToLocalStorage();
                    }
                }
            }, 100); // 100ms delay to ensure value is set
        });
        input.addEventListener('change', function() {
            // Add a small delay to ensure the value is properly set before saving
            setTimeout(() => {
                if (typeof isUserLoggedIn !== 'undefined' && isUserLoggedIn) {
                    if (typeof saveAnswers === 'function') {
                        saveAnswers();
                    }
                } else {
                    if (typeof saveAnswersToLocalStorage === 'function') {
                        saveAnswersToLocalStorage();
                    }
                }
            }, 100); // 100ms delay to ensure value is set
        });
    });
    
    // 🔧 NEW: Clear flag after function completes
    isCreatingFields = false;
}

// Generate hidden checkboxes for numbered dropdown questions
function generateHiddenCheckboxes(questionId, questionSafe, selectedCount) {
    // Get the dropdown element to find the range
    const dropdown = document.getElementById("answer" + questionId);
    if (!dropdown) return;
    
    // Find the maximum possible value from the dropdown options
    let maxRange = 0;
    for (let i = 0; i < dropdown.options.length; i++) {
        const optionValue = parseInt(dropdown.options[i].value);
        if (!isNaN(optionValue) && optionValue > maxRange) {
            maxRange = optionValue;
        }
    }
    
    // Remove any existing hidden checkboxes for this question
    const existingCheckboxes = document.querySelectorAll('input[type="checkbox"][id^="' + questionSafe + '_"]');
    existingCheckboxes.forEach(checkbox => checkbox.remove());
    
    // Generate hidden checkboxes for the full range
    for (let i = 1; i <= maxRange; i++) {
        const checkboxId = questionSafe + "_" + i;
        const checkboxName = questionSafe + "_" + i;
        
        // Create hidden checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.name = checkboxName;
        checkbox.style.display = 'none'; // Hidden
        checkbox.checked = i <= selectedCount; // Check if this number is within the selected range
        
        // Add to the form (find the form element or add to body)
        const form = document.querySelector('form') || document.body;
        form.appendChild(checkbox);
    }
}


// Helper function to get fields in order for a question
function getFieldsInOrderForQuestion(questionId) {
    // Try to get unified fields first, fallback to old arrays
    const qBlock = document.querySelector('#question-container-' + questionId)?.closest('.question-block') || 
                   document.querySelector('[id*="' + questionId + '"]')?.closest('.question-block');
    
    let allFieldsInOrder = [];
    
    if (qBlock) {
        const unifiedFields = Array.from(qBlock.querySelectorAll('#unifiedFields' + questionId + ' .unified-field'));
        
        if (unifiedFields.length > 0) {
            // Use unified container data
            const allElements = [];
            
            unifiedFields.forEach((el) => {
                const fieldType = el.getAttribute('data-type');
                const fieldOrder = parseInt(el.getAttribute('data-order'));
                const labelTextEl = el.querySelector('#labelText' + questionId + '_' + fieldOrder);
                const nodeIdTextEl = el.querySelector('#nodeIdText' + questionId + '_' + fieldOrder);
                
                if (labelTextEl && nodeIdTextEl) {
                    allElements.push({
                        type: fieldType,
                        label: labelTextEl.textContent.trim(),
                        nodeId: nodeIdTextEl.textContent.trim(),
                        order: fieldOrder
                    });
                }
            });
            
            // Sort by data-order attribute (creation order)
            allElements.sort((a, b) => a.order - b.order);
            allFieldsInOrder = allElements;
        }
    }
    
    // Fallback to unified fields map or old arrays if no unified fields found
    if (allFieldsInOrder.length === 0) {
        // Try unified fields map first
        if (window.unifiedFieldsMap && window.unifiedFieldsMap[questionId]) {
            allFieldsInOrder = window.unifiedFieldsMap[questionId];
        } else {
            // Fallback to old arrays
            const theseLabels = labelMap[questionId] || [];
            const theseAmounts = amountMap[questionId] || [];
            
            allFieldsInOrder = [
                ...theseLabels.map((lbl, index) => ({
                    type: 'label',
                    label: lbl,
                    nodeId: (window.labelNodeIdsMap && window.labelNodeIdsMap[questionId] ? window.labelNodeIdsMap[questionId] : [])[index] || "",
                    order: index
                })),
                ...theseAmounts.map((amt, index) => ({
                    type: 'amount',
                    label: amt,
                    nodeId: "",
                    order: index
                }))
            ];
        }
    }
    
    return allFieldsInOrder;
}

// Update hidden checkboxes when dropdown selection changes
function updateHiddenCheckboxes(questionId, selectedCount) {
    // Get the question's safe name
    const questionH3 = document
        .getElementById("question-container-" + questionId)
        ?.querySelector("h3")?.textContent || ("answer" + questionId);
    const qSafe = sanitizeQuestionText(questionH3);
    
    // Get the dropdown element to find the range
    const dropdown = document.getElementById("answer" + questionId);
    if (!dropdown) return;
    
    // Find the maximum possible value from the dropdown options
    let maxRange = 0;
    for (let i = 0; i < dropdown.options.length; i++) {
        const optionValue = parseInt(dropdown.options[i].value);
        if (!isNaN(optionValue) && optionValue > maxRange) {
            maxRange = optionValue;
        }
    }
    
    // Update existing checkboxes or create new ones if they don't exist
    for (let i = 1; i <= maxRange; i++) {
        const checkboxId = qSafe + "_" + i;
        let checkbox = document.getElementById(checkboxId);
        
        if (!checkbox) {
            // Create new checkbox if it doesn't exist
            checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.name = qSafe + "_" + i;
            checkbox.style.display = 'none'; // Hidden
            
            // Add to the form
            const form = document.querySelector('form') || document.body;
            form.appendChild(checkbox);
        }
        
        // Update the checked state based on the selected count
        checkbox.checked = i <= selectedCount;
    }
    
    // Also update hidden address textboxes if this question has location fields
    const questionContainer = document.getElementById('question-container-' + questionId);
    if (questionContainer) {
        const allFieldsInOrder = getFieldsInOrderForQuestion(questionId);
        if (allFieldsInOrder && allFieldsInOrder.length > 0) {
            generateHiddenAddressTextboxes(questionId, selectedCount, allFieldsInOrder);
        }
    }
}

// Handle linked dropdown logic
function handleLinkedDropdowns(sourceName, selectedValue) {
    if (typeof linkedDropdowns === 'undefined' || !linkedDropdowns || linkedDropdowns.length === 0 || typeof isHandlingLink !== 'undefined' && isHandlingLink) return;
    
    try {
        isHandlingLink = true;  // Set flag before handling links
        
        linkedDropdowns.forEach(linkPair => {
            if (linkPair.sourceNameId === sourceName) {
                const targetDropdown = document.getElementById(linkPair.targetNameId);
                if (targetDropdown && targetDropdown.value !== selectedValue) {  // Only if value is different
                    let optionExists = false;
                    for (let i = 0; i < targetDropdown.options.length; i++) {
                        if (targetDropdown.options[i].value === selectedValue) {
                            optionExists = true;
                            targetDropdown.value = selectedValue;
                            // Trigger change event only if value actually changed
                            const event = new Event('change');
                            targetDropdown.dispatchEvent(event);
                            break;
                        }
                    }
                    
                    if (!optionExists && selectedValue) {
                        console.warn("Option '" + selectedValue + "' does not exist in linked dropdown " + linkPair.targetNameId);
                    }
                }
            }
            else if (linkPair.targetNameId === sourceName) {
                const sourceDropdown = document.getElementById(linkPair.sourceNameId);
                if (sourceDropdown && sourceDropdown.value !== selectedValue) {  // Only if value is different
                    let optionExists = false;
                    for (let i = 0; i < sourceDropdown.options.length; i++) {
                        if (sourceDropdown.options[i].value === selectedValue) {
                            optionExists = true;
                            sourceDropdown.value = selectedValue;
                            // Trigger change event only if value actually changed
                            const event = new Event('change');
                            sourceDropdown.dispatchEvent(event);
                            break;
                        }
                    }
                    
                    if (!optionExists && selectedValue) {
                        console.warn("Option '" + selectedValue + "' does not exist in linked dropdown " + linkPair.sourceNameId);
                    }
                }
            }
        });
    } finally {
        isHandlingLink = false;  // Always reset flag when done
    }
}

/*──────── mirror a dropdown → textbox and checkbox ────────*/
function dropdownMirror(selectEl, baseName){
    const wrap = document.getElementById("dropdowntext_"+baseName);
    if(!wrap) return;

    const val = selectEl.value.trim();
    if(!val) {
        wrap.innerHTML = "";
        return;
    }

    const textId = baseName + "_dropdown";
    const textField = document.getElementById(textId);
    
    if(textField) {
        textField.value = val;
        textField.style.display = "none";
    }

    const existingCheckboxes = wrap.querySelectorAll("div");
    existingCheckboxes.forEach(div => div.remove());

    const idSuffix = val.replace(/\\W+/g, "_").toLowerCase();
    const checkboxId = baseName + "_" + idSuffix;
    
    const checkboxDiv = document.createElement("div");
    checkboxDiv.style.display = "none";
    checkboxDiv.innerHTML = "<input type='checkbox' id='" + checkboxId + "' name='" + checkboxId + "' checked>" +
                     "<label for='" + checkboxId + "'> " + baseName + "_" + idSuffix + "</label>";
    
    wrap.appendChild(checkboxDiv);
    handleLinkedDropdowns(baseName, val);
}

// Function to handle hidden logic for dropdowns
function updateHiddenLogic(dropdownName, selectedValue) {
    console.log('🔧 [HIDDEN LOGIC DEBUG] updateHiddenLogic called with dropdownName:', dropdownName, 'selectedValue:', selectedValue);
    console.log('🔧 [HIDDEN LOGIC DEBUG] hiddenLogicConfigs:', hiddenLogicConfigs);
    
    // Find ALL hidden logic configurations for this dropdown
    const matchingConfigs = hiddenLogicConfigs.filter(c => c.questionNameId === dropdownName);
    console.log('🔧 [HIDDEN LOGIC DEBUG] Found matching configs:', matchingConfigs);
    
    if (matchingConfigs.length === 0) {
        console.log('🔧 [HIDDEN LOGIC DEBUG] No matching configs found for dropdown:', dropdownName);
        return;
    }
    
    // Group configurations by nodeId to handle multiple triggers for the same element
    const configsByNodeId = {};
    matchingConfigs.forEach(config => {
        if (!configsByNodeId[config.nodeId]) {
            configsByNodeId[config.nodeId] = [];
        }
        configsByNodeId[config.nodeId].push(config);
    });
    
    console.log('🔧 [HIDDEN LOGIC DEBUG] Configs grouped by nodeId:', configsByNodeId);
    
    // Process each nodeId
    Object.keys(configsByNodeId).forEach(nodeId => {
        const configsForNode = configsByNodeId[nodeId];
        console.log('🔧 [HIDDEN LOGIC DEBUG] Processing nodeId:', nodeId, 'with configs:', configsForNode);
        
        // Check if ANY config for this nodeId matches the selected value
        const matchingConfig = configsForNode.find(config => config.trigger === selectedValue);
        
        if (matchingConfig) {
            console.log('🔧 [HIDDEN LOGIC DEBUG] Found matching config for nodeId:', nodeId, 'config:', matchingConfig);
    
            // Check if the hidden element already exists
            let hiddenElement = document.getElementById(nodeId);
            console.log('🔧 [HIDDEN LOGIC DEBUG] Hidden element exists for', nodeId, ':', !!hiddenElement);
            
            if (!hiddenElement) {
                console.log('🔧 [HIDDEN LOGIC DEBUG] Creating hidden element of type:', matchingConfig.type, 'with nodeId:', nodeId);
                // Create the hidden element based on type
                if (matchingConfig.type === 'checkbox') {
                    hiddenElement = document.createElement('input');
                    hiddenElement.type = 'checkbox';
                    hiddenElement.id = nodeId;
                    hiddenElement.name = nodeId;
                    hiddenElement.checked = true;
                    hiddenElement.style.display = 'none';
                    console.log('🔧 [HIDDEN LOGIC DEBUG] Created checkbox element:', hiddenElement);
                } else if (matchingConfig.type === 'textbox') {
                    hiddenElement = document.createElement('input');
                    hiddenElement.type = 'text';
                    hiddenElement.id = nodeId;
                    hiddenElement.name = nodeId;
                    hiddenElement.value = matchingConfig.textboxText || '';
                    hiddenElement.style.display = 'none';
                    console.log('🔧 [HIDDEN LOGIC DEBUG] Created textbox element:', hiddenElement);
                }
                
                // Add the hidden element to the form
                const form = document.getElementById('customForm');
                if (form) {
                    form.appendChild(hiddenElement);
                    console.log('🔧 [HIDDEN LOGIC DEBUG] Added hidden element to form');
                } else {
                    document.body.appendChild(hiddenElement);
                    console.log('🔧 [HIDDEN LOGIC DEBUG] Added hidden element to body');
                }
            } else {
                console.log('🔧 [HIDDEN LOGIC DEBUG] Updating existing hidden element for', nodeId);
                // Update existing element
                if (matchingConfig.type === 'checkbox') {
                    hiddenElement.checked = true;
                } else if (matchingConfig.type === 'textbox') {
                    hiddenElement.value = matchingConfig.textboxText || '';
                }
            }
        } else {
            console.log('🔧 [HIDDEN LOGIC DEBUG] No matching config found for nodeId:', nodeId, 'with selectedValue:', selectedValue);
            // No matching config found, uncheck/clear the existing element
            const existingElement = document.getElementById(nodeId);
            if (existingElement) {
                console.log('🔧 [HIDDEN LOGIC DEBUG] Unchecking/clearing existing hidden element:', nodeId);
                if (configsForNode[0].type === 'checkbox') {
                    existingElement.checked = false;
                } else if (configsForNode[0].type === 'textbox') {
                    existingElement.value = '';
                }
            }
        }
    }); // End of forEach loop for nodeIds
}

// Function to show/hide questions based on conditional logic
function updateQuestionVisibility(questionId, shouldShow) {
    const questionContainer = document.getElementById('question-container-' + questionId);
    if (questionContainer) {
        if (shouldShow) {
            questionContainer.classList.remove('hidden');
        } else {
            questionContainer.classList.add('hidden');
        }
    } else {
    }
}

// Function to handle business type selection and show county question
function handleBusinessTypeSelection() {
    // Show the county question (question-container-16) when any business type is selected
    updateQuestionVisibility(16, true);
}

// Function to handle linked fields synchronization
function updateLinkedFields() {
    if (!linkedFields || linkedFields.length === 0) return;
    
    linkedFields.forEach(linkedField => {
        const { linkedFieldId, fields } = linkedField;
        
        // Find the hidden textbox for this linked field
        let hiddenField = document.getElementById(linkedFieldId);
        if (!hiddenField) {
            // Create the hidden textbox if it doesn't exist
            hiddenField = document.createElement('input');
            hiddenField.type = 'text';
            hiddenField.id = linkedFieldId;
            hiddenField.name = linkedFieldId;
            hiddenField.style.display = 'none';
            // Append to the form instead of document.body so it gets submitted
            const form = document.getElementById('customForm');
            if (form) {
                form.appendChild(hiddenField);
            } else {
                document.body.appendChild(hiddenField);
            }
        }
        
        // Get all the linked textboxes
        const linkedTextboxes = fields.map(fieldId => document.getElementById(fieldId)).filter(el => el);
        
        if (linkedTextboxes.length === 0) return;
        
        // Find which textbox has content
        const textboxesWithContent = linkedTextboxes.filter(tb => tb.value.trim() !== '');
        
        if (textboxesWithContent.length === 0) {
            // No textboxes have content, clear the hidden field
            hiddenField.value = '';
        } else if (textboxesWithContent.length === 1) {
            // Only one textbox has content, use its value
            hiddenField.value = textboxesWithContent[0].value;
        } else {
            // Multiple textboxes have content, use the one with the longest text
            const longestTextbox = textboxesWithContent.reduce((longest, current) => 
                current.value.length > longest.value.length ? current : longest
            );
            hiddenField.value = longestTextbox.value;
        }
    });
}

// Function to clear inactive linked textboxes (with delay to avoid interfering with typing)
function clearInactiveLinkedFields() {
    if (!linkedFields || linkedFields.length === 0) return;
    
    // Use setTimeout to avoid interfering with user typing
    setTimeout(() => {
        linkedFields.forEach(linkedField => {
            const { fields } = linkedField;
            
            // Get all the linked textboxes
            const linkedTextboxes = fields.map(fieldId => document.getElementById(fieldId)).filter(el => el);
            
            if (linkedTextboxes.length === 0) return;
            
            // Find which textboxes are currently visible (not hidden by conditional logic)
            const visibleTextboxes = linkedTextboxes.filter(tb => {
                const container = tb.closest('.question-container');
                return container && !container.classList.contains('hidden');
            });
            
            // Find which textboxes have content
            const textboxesWithContent = linkedTextboxes.filter(tb => tb.value.trim() !== '');
            
            // Clear all hidden textboxes that have content
            linkedTextboxes.forEach(tb => {
                const container = tb.closest('.question-container');
                if (container && container.classList.contains('hidden') && tb.value.trim() !== '') {
                    tb.value = '';
                }
            });
            
            // If multiple visible textboxes have content, keep only the longest one
            const visibleTextboxesWithContent = visibleTextboxes.filter(tb => tb.value.trim() !== '');
            if (visibleTextboxesWithContent.length > 1) {
                const longestTextbox = visibleTextboxesWithContent.reduce((longest, current) => 
                    current.value.length > longest.value.length ? current : longest
                );
                
                // Clear all other visible textboxes that aren't the longest
                visibleTextboxes.forEach(tb => {
                    if (tb !== longestTextbox && tb.value.trim() !== '') {
                        tb.value = '';
                    }
                });
            }
        });
    }, 100); // 100ms delay to avoid interfering with typing
}

// Function to set up linked fields event listeners
function setupLinkedFields() {
    if (!linkedFields || linkedFields.length === 0) return;
    
    // Use event delegation to handle dynamically created textboxes
    document.addEventListener('input', function(event) {
        if (event.target.tagName === 'INPUT' && event.target.type === 'text') {
            // Check if this input is part of any linked field
            const fieldId = event.target.id;
            const isLinkedField = linkedFields.some(linkedField => 
                linkedField.fields.includes(fieldId)
            );
            
            if (isLinkedField) {
                updateLinkedFields();
            }
        }
    });
    
    document.addEventListener('change', function(event) {
        if (event.target.tagName === 'INPUT' && event.target.type === 'text') {
            // Check if this input is part of any linked field
            const fieldId = event.target.id;
            const isLinkedField = linkedFields.some(linkedField => 
                linkedField.fields.includes(fieldId)
            );
            
            if (isLinkedField) {
                updateLinkedFields();
            }
        }
    });
    
    // Initial update
    updateLinkedFields();
}

function getQuestionInputs (questionId, type = null) {
  /* 1️⃣ First look inside the question container, if it exists */
  const container = document.getElementById('question-container-' + questionId);
  if (container) {
    return container.querySelectorAll(
      type ? 'input[type="' + type + '"]' : 'input, select, textarea'
    );
  }

  /* 2️⃣ Fallback to the old prefix‑style that your generator sometimes uses */
  const prefix = 'input[id^="' + getCbPrefix(questionId) + '"]';

  return document.querySelectorAll(
    type ? prefix + '[type="' + type + '"]' : prefix + ', select[id^="answer' + questionId + '"]'
  );
}

/*------------------------------------------------------------------
 *  handleNext(currentSection)
 *  – pushes the section you are leaving and works out where to go
 *-----------------------------------------------------------------*/
function handleNext(currentSection){
    runAllHiddenCheckboxCalculations();
    runAllHiddenTextCalculations();

    /* remember the place we're leaving */
    sectionStack.push(currentSection);

    let nextSection = currentSection + 1;

    /* ---------- evaluate jump rules ---------- */
    const relevantJumps = jumpLogics.filter(jl => jl.section === currentSection);
    for (const jl of relevantJumps){
        const nmId = questionNameIds[jl.questionId] || ('answer'+jl.questionId);

        if (['radio','dropdown','numberedDropdown'].includes(jl.questionType)){
            const el = document.getElementById(nmId);
            if (el && el.value.trim().toLowerCase() === jl.jumpOption.trim().toLowerCase()){
                nextSection = jl.jumpTo.toLowerCase();
                break;
            }
        } else if (jl.questionType === 'checkbox'){
            const cbs = getQuestionInputs(jl.questionId, 'checkbox');
            const chosen = Array.from(cbs).filter(cb=>cb.checked)
                                .map(cb=>cb.value.trim().toLowerCase());
            if (chosen.includes(jl.jumpOption.trim().toLowerCase())){
                nextSection = jl.jumpTo.toLowerCase();
                break;
            }
        }
    }

    /* ---------- special "end" shortcut ---------- */
    if (nextSection === 'end'){
        processAllPdfs().then(()=>navigateSection('end'));
        return;
    }

    nextSection = parseInt(nextSection,10);
    if (isNaN(nextSection)) nextSection = currentSection + 1;
    navigateSection(nextSection);

    /* recalc hidden fields after navigation */
    runAllHiddenCheckboxCalculations();
    runAllHiddenTextCalculations();
}


/*------------------------------------------------------------------
 *  resetHiddenQuestionsToDefaults(sectionNumber)
 *  – resets hidden questions in the current section to their default values
 *    This prevents Firebase autosave from keeping values for questions
 *    that are hidden due to conditional logic
 *-----------------------------------------------------------------*/
function resetHiddenQuestionsToDefaults(sectionNumber) {
    // Get the current section
    const currentSection = document.getElementById('section' + sectionNumber);
    if (!currentSection) {
        console.log('Reset function: Section not found for section', sectionNumber);
        return;
    }
    
    // Find all hidden question containers in this section
    const hiddenQuestions = currentSection.querySelectorAll('.question-container.hidden');
    
    if (hiddenQuestions.length === 0) {
        console.log('Reset function: No hidden questions found in section', sectionNumber);
        return;
    }
    
    console.log('Reset function: Found', hiddenQuestions.length, 'hidden questions in section', sectionNumber);
    
    hiddenQuestions.forEach((questionContainer, index) => {
        // Get all form elements within this hidden question
        const formElements = questionContainer.querySelectorAll('input, select, textarea');
        
        formElements.forEach(element => {
            const elementName = element.name || element.id || 'unnamed';
            const oldValue = element.value || element.checked;
            
            if (element.tagName === 'SELECT') {
                // Reset dropdown to default "Select an option"
                element.value = '';
                // Find the default option and set it as selected
                const defaultOption = element.querySelector('option[disabled][selected]');
                if (defaultOption) {
                    defaultOption.selected = true;
                }
                console.log('Reset function: Reset dropdown', elementName, 'from', oldValue, 'to default');
            } else if (element.type === 'checkbox' || element.type === 'radio') {
                // Reset checkboxes and radio buttons to unchecked
                element.checked = false;
                console.log('Reset function: Reset', element.type, elementName, 'from', oldValue, 'to false');
            } else if (element.type === 'text' || element.type === 'email' || element.type === 'tel' || 
                      element.type === 'number' || element.type === 'date' || element.tagName === 'TEXTAREA') {
                // Reset text inputs to empty
                element.value = '';
                console.log('Reset function: Reset', element.type || 'textarea', elementName, 'from', oldValue, 'to empty');
            }
        });
    });
}

/*------------------------------------------------------------------
 *  navigateSection(sectionNumber)
 *  – shows exactly one section (or Thank‑you) and records history
 *-----------------------------------------------------------------*/



function navigateSection(sectionNumber){
    const sections  = document.querySelectorAll('.section');
    const form      = document.getElementById('customForm');
    const thankYou  = document.getElementById('thankYouMessage');

    /* hide everything first */
    sections.forEach(sec => sec.classList.remove('active'));
    thankYou.style.display = 'none';
    form.style.display     = 'block';

    if (sectionNumber === 'end'){
        form.style.display   = 'none';
        thankYou.style.display = 'block';
        currentSectionNumber = 'end';
        updateProgressBar();
        return;
    }

    /* ── corrected bounds check ────────────────────────────── */
    const maxSection = sections.length;   // 1‑based section numbers
    if (sectionNumber < 1)           sectionNumber = 1;
    if (sectionNumber > maxSection)  sectionNumber = maxSection;

    /* show the requested section */
    const target = document.getElementById('section' + sectionNumber);
    (target || sections[maxSection - 1]).classList.add('active');

    currentSectionNumber = sectionNumber;
    
    // Reset hidden questions to default values after Firebase autosave
    // BUT NOT during initial autofill to preserve autofilled values
    if (!window.isInitialAutofill) {
    resetHiddenQuestionsToDefaults(sectionNumber);
    }
    
    updateProgressBar();
}



/*------------------------------------------------------------------
 *  goBack()
 *  – pops the history stack; falls back to numeric −1 if empty
 *-----------------------------------------------------------------*/
function goBack(){
    if (sectionStack.length > 0){
        const prev = sectionStack.pop();
        navigateSection(prev);
    }else if (typeof currentSectionNumber === 'number' && currentSectionNumber > 1){
        navigateSection(currentSectionNumber - 1);
    }
    updateProgressBar();
}


/*──────────────── helpers ───────────────*/
function setCurrentDate () {
    const t = new Date();
    const month = String(t.getMonth() + 1).padStart(2, '0');
    const day = String(t.getDate()).padStart(2, '0');
    const year = t.getFullYear();
    const currentDateElement = document.getElementById('current_date');
    if (currentDateElement) {
        // Format as dd/mm/yyyy for server
        currentDateElement.value = day + '/' + month + '/' + year;
        // Mark this field as protected from autofill
        currentDateElement.setAttribute('data-protected', 'true');
    }
}

// Helper function to format date from yyyy-mm-dd to mm/dd/yyyy
function formatDateForServer(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return parts[1] + '/' + parts[2] + '/' + parts[0];
    }
    return dateString;
}





window.onload=function(){
    setCurrentDate();
    attachCalculationListeners();
    
    // Trigger visibility updates on page load to show dependent questions
    setTimeout(() => {
        if (typeof triggerVisibilityUpdates === 'function') {
            triggerVisibilityUpdates();
        }
    }, 200);
};

function handleConditionalAlerts(){
    for(var i=0; i<conditionalAlerts.length; i++){
        var obj = conditionalAlerts[i];
        var prevQEl= document.getElementById("answer"+obj.prevQuestionId);
        if(prevQEl){
            if(prevQEl.value.trim().toLowerCase() === obj.prevAnswer.trim().toLowerCase()){
                alert(obj.alertText);
            }
        } else {
            var cbs= document.querySelectorAll('[name^="answer'+obj.prevQuestionId+'_"]');
            for(var x=0; x<cbs.length; x++){
                if(cbs[x].checked && cbs[x].value.trim().toLowerCase()=== obj.prevAnswer.trim().toLowerCase()){
                    alert(obj.alertText);
                }
            }
        }
    }
}

/*──── main submit handler ────*/
function showThankYouMessage (event) {
    // Safely prevent default if an event was provided
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    
    // Show thank you message immediately (no PDF processing)
    document.getElementById('customForm').style.display = 'none';
    document.getElementById('thankYouMessage').style.display = 'block';
    
    // Display checklist if there are items
    const checklistDisplay = document.getElementById('checklistDisplay');
    const checklistItemsContainer = document.getElementById('checklistItems');
    
    // Combine static and dynamic checklist items
    const allChecklistItems = [...(checklistItems || []), ...(userChecklist || [])];
    
    if (checklistDisplay && checklistItemsContainer && allChecklistItems.length > 0) {
        checklistDisplay.style.display = 'block';
        
        // Create checklist items HTML
        let checklistHTML = '';
        allChecklistItems.forEach((item, index) => {
            checklistHTML += '<div style="margin: 8px 0; padding: 10px; background: white; border-radius: 8px; border-left: 4px solid #2980b9; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">' +
                '<input type="checkbox" id="checklistItem' + index + '" style="margin-right: 10px;">' +
                '<label for="checklistItem' + index + '" style="color: #2c3e50; font-weight: 500; cursor: pointer;">' + item + '</label>' +
            '</div>';
        });
        
        checklistItemsContainer.innerHTML = checklistHTML;
    }
    
    return false;                       // prevent page reload
}

// Form submission is now handled by the inline onsubmit attribute

/*──── process all PDFs sequentially ────*/
async function processAllPdfs() {
    
    // Track processed PDFs to prevent duplicates
    const processedPdfs = new Set();
    
    // Process main PDFs - use the actual PDF filename, not the form name
    if (pdfOutputFileName) {
        // Remove .pdf extension if present since server adds it automatically
        const baseName = pdfOutputFileName.replace(/\.pdf$/i, '');
        if (!processedPdfs.has(baseName)) {
            processedPdfs.add(baseName);
        await editAndDownloadPDF(baseName);
        } else {
        }
    }
    
    // Process Conditional PDFs
    if (conditionalPDFs && conditionalPDFs.length > 0) {
        for (const conditionalPDF of conditionalPDFs) {
            if (conditionalPDF.pdfName) {
                // Check if conditions are met
                let shouldDownload = false;
                
                // Get the question element
                const questionElement = document.getElementById(questionNameIds[conditionalPDF.questionId]) || 
                                      document.getElementById('answer' + conditionalPDF.questionId);
                
                if (questionElement) {
                    let questionValue = '';
                    
                    if (questionElement.type === 'checkbox') {
                        questionValue = questionElement.checked ? questionElement.value : '';
                    } else {
                        questionValue = questionElement.value;
                    }
                    
                    // Check if the condition matches
                    if (questionValue.toString().toLowerCase() === conditionalPDF.conditionalAnswer.toLowerCase()) {
                        shouldDownload = true;
                    }
                }
                
                // Download PDF if conditions are met
                if (shouldDownload) {
                    const baseName = conditionalPDF.pdfName.replace(/\.pdf$/i, '');
                    if (!processedPdfs.has(baseName)) {
                        processedPdfs.add(baseName);
                        await editAndDownloadPDF(baseName);
                    } else {
                    }
                }
            }
        }
    }
    
    // Process PDF Logic PDFs
    console.log('🔧 [PDF DOWNLOAD DEBUG] Processing PDF Logic PDFs:', pdfLogicPDFs);
    if (pdfLogicPDFs && pdfLogicPDFs.length > 0) {
        for (const pdfLogic of pdfLogicPDFs) {
            console.log('🔧 [PDF DOWNLOAD DEBUG] Processing PDF Logic:', pdfLogic);
            if (pdfLogic.pdfName) {
                // Check if conditions are met
                let shouldDownload = false;
                
                if (pdfLogic.isBigParagraph) {
                    // For Big Paragraph questions, check character limit
                    pdfLogic.conditions.forEach(condition => {
                        if (condition.characterLimit) {
                            // Get the Big Paragraph question's value
                            const questionElement = document.getElementById(questionNameIds[pdfLogic.questionId]) || 
                                                  document.getElementById('answer' + pdfLogic.questionId);
                            
                            if (questionElement) {
                                const questionValue = questionElement.value || '';
                                
                                // Check if the text length exceeds the character limit
                                if (questionValue.length > condition.characterLimit) {
                                    shouldDownload = true;
                                }
                            }
                        }
                    });
                } else {
                    // For other question types, check previous question conditions
                // First check if this is a numbered dropdown with trigger option
                if (pdfLogic.triggerOption) {
                    // For numbered dropdown with trigger option, check if the selected value matches the trigger
                    const questionElement = document.getElementById(questionNameIds[pdfLogic.questionId]) || 
                                          document.getElementById('answer' + pdfLogic.questionId);
                    
                    console.log('🔧 [PDF DOWNLOAD DEBUG] Checking trigger option:');
                    console.log('  - Question ID:', pdfLogic.questionId);
                    console.log('  - Trigger Option:', pdfLogic.triggerOption);
                    console.log('  - Question Element:', questionElement);
                    console.log('  - Question Name IDs:', questionNameIds);
                    
                    if (questionElement) {
                        const selectedValue = questionElement.value;
                        console.log('  - Selected Value:', selectedValue);
                        
                        // Check if the selected value matches the trigger option
                        if (selectedValue === pdfLogic.triggerOption) {
                            shouldDownload = true;
                            console.log('🔧 [PDF DOWNLOAD DEBUG] ✅ Trigger option matched - will download PDF');
                        } else {
                            console.log('🔧 [PDF DOWNLOAD DEBUG] ❌ Trigger option NOT matched');
                        }
                    } else {
                        console.log('🔧 [PDF DOWNLOAD DEBUG] ❌ Question element not found');
                    }
                } else if (pdfLogic.numberTrigger && pdfLogic.numberValue) {
                    // For number questions with trigger conditions, check if the number meets the condition
                    const questionElement = document.getElementById(questionNameIds[pdfLogic.questionId]) || 
                                          document.getElementById('answer' + pdfLogic.questionId);
                    
                    console.log('🔧 [PDF DOWNLOAD DEBUG] Checking number trigger:');
                    console.log('  - Question ID:', pdfLogic.questionId);
                    console.log('  - Number Trigger:', pdfLogic.numberTrigger);
                    console.log('  - Number Value:', pdfLogic.numberValue);
                    console.log('  - Question Element:', questionElement);
                    
                    if (questionElement) {
                        const selectedValue = parseFloat(questionElement.value) || 0;
                        const triggerValue = parseFloat(pdfLogic.numberValue) || 0;
                        console.log('  - Selected Value:', selectedValue);
                        console.log('  - Trigger Value:', triggerValue);
                        
                        let conditionMet = false;
                        if (pdfLogic.numberTrigger === '=') {
                            conditionMet = selectedValue === triggerValue;
                        } else if (pdfLogic.numberTrigger === '>') {
                            conditionMet = selectedValue > triggerValue;
                        } else if (pdfLogic.numberTrigger === '<') {
                            conditionMet = selectedValue < triggerValue;
                        }
                        
                        if (conditionMet) {
                            shouldDownload = true;
                            console.log('🔧 [PDF DOWNLOAD DEBUG] ✅ Number trigger matched - will download PDF');
                        } else {
                            console.log('🔧 [PDF DOWNLOAD DEBUG] ❌ Number trigger NOT matched');
                        }
                    } else {
                        console.log('🔧 [PDF DOWNLOAD DEBUG] ❌ Question element not found');
                    }
                } else {
                        // For regular conditions, check previous question logic
                pdfLogic.conditions.forEach(condition => {
                    const prevQuestionId = condition.prevQuestion;
                    const prevAnswer = condition.prevAnswer;
                    
                    // Get the previous question's value
                    const prevQuestionElement = document.getElementById(questionNameIds[prevQuestionId]) || 
                                              document.getElementById('answer' + prevQuestionId);
                    
                    if (prevQuestionElement) {
                        let prevValue = '';
                        
                        if (prevQuestionElement.type === 'checkbox') {
                            prevValue = prevQuestionElement.checked ? prevQuestionElement.value : '';
                        } else {
                            prevValue = prevQuestionElement.value;
                        }
                        
                        // Check if the condition matches
                        if (prevValue.toString().toLowerCase() === prevAnswer.toLowerCase()) {
                            shouldDownload = true;
                        }
                    }
                });
                    }
                }
                
                // Download PDF if conditions are met
                if (shouldDownload) {
                    const baseName = pdfLogic.pdfName.replace(/\.pdf$/i, '');
                    if (!processedPdfs.has(baseName)) {
                        processedPdfs.add(baseName);
                        await editAndDownloadPDF(baseName);
                    } else {
                    }
                }
            }
        }
    }
}

// Function to go back to the form from the thank you screen
function goBackToForm() {
    
    // Hide the thank you message
    const thankYouMessage = document.getElementById('thankYouMessage');
    if (thankYouMessage) {
        thankYouMessage.style.display = 'none';
    }
    
    // Show the form again
    const formContainer = document.querySelector('form');
    if (formContainer) {
        formContainer.style.display = 'block';
    }
    
    // Scroll back to the top of the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Manual PDF download function (called when user clicks "Download PDF" button)
async function downloadAllPdfs() {
    try {
        // Show loading state
        const downloadButton = document.querySelector('button[onclick="downloadAllPdfs()"]');
        if (downloadButton) {
            downloadButton.textContent = 'Processing...';
            downloadButton.disabled = true;
        }
        
        await processAllPdfs();
        
        // Reset button
        if (downloadButton) {
            downloadButton.textContent = 'Download PDF';
            downloadButton.disabled = false;
        }
    } catch (error) {
        console.error('🔧 [PDF DEBUG] Error downloading PDFs:', error);
        // Reset button on error
        const downloadButton = document.querySelector('button[onclick="downloadAllPdfs()"]');
        if (downloadButton) {
            downloadButton.textContent = 'Download PDF';
            downloadButton.disabled = false;
        }
    }
}

/*──── build FormData with **everything inside the form** ────*/
async function editAndDownloadPDF (pdfName) {
    try {
        console.log('🔍 [MANUAL DOWNLOAD DEBUG] Starting manual PDF download for:', pdfName);
        
        /* this grabs every control that belongs to <form id="customForm">,
           including those specified with form="customForm" attributes   */
        const form = document.getElementById('customForm');
        const fd = new FormData();
        
        console.log('🔍 [MANUAL DOWNLOAD DEBUG] Form element found:', !!form);
        
        // Manually collect form data to format dates
        // Include both elements inside the form AND elements with form="customForm" attribute
        const formElements = form.querySelectorAll('input, textarea, select');
        const externalFormElements = document.querySelectorAll('input[form="customForm"], textarea[form="customForm"], select[form="customForm"]');
        const allFormElements = [...formElements, ...externalFormElements];
        
        console.log('🔍 [MANUAL DOWNLOAD DEBUG] Form elements found:');
        console.log('  - Elements inside form:', formElements.length);
        console.log('  - External elements with form="customForm":', externalFormElements.length);
        console.log('  - Total elements to process:', allFormElements.length);
        
        // Log all elements we're about to process
        console.log('🔍 [MANUAL DOWNLOAD DEBUG] All form elements:');
        allFormElements.forEach((element, index) => {
            console.log('  ' + (index + 1) + '. ' + element.tagName + ' - id: "' + element.id + '" - name: "' + element.name + '" - type: "' + element.type + '" - value: "' + element.value + '" - disabled: ' + element.disabled);
        });
        
        allFormElements.forEach(element => {
            if (element.name && !element.disabled) {
                // For checkboxes and radios, only include if checked
                if (element.type === 'checkbox' || element.type === 'radio') {
                    if (element.checked) {
                        fd.append(element.name, 'on'); // Send 'on' for checked checkboxes (standard HTML form behavior)
                        console.log('🔍 [MANUAL DOWNLOAD DEBUG] Added checked ' + element.type + ' - name: "' + element.name + '" - value: "on"');
                    } else {
                        console.log('🔍 [MANUAL DOWNLOAD DEBUG] Skipping unchecked ' + element.type + ' - name: "' + element.name + '"');
                    }
                    // Skip unchecked checkboxes entirely - don't send them to server
                } else {
                    let value = element.value;
                    
                    // Format date inputs to mm/dd/yyyy
                    if (element.type === 'date' && value) {
                        const originalValue = value;
                        value = formatDateForServer(value);
                        console.log('🔍 [MANUAL DOWNLOAD DEBUG] Formatted date - name: "' + element.name + '" - original: "' + originalValue + '" - formatted: "' + value + '"');
                    }
                    
                    // Include ALL fields with values, including hidden ones
                    if (value && value.trim() !== '') {
                        fd.append(element.name, value);
                        console.log('🔍 [MANUAL DOWNLOAD DEBUG] Added field - name: "' + element.name + '" - value: "' + value + '" - type: "' + element.type + '"');
                    } else {
                        console.log('🔍 [MANUAL DOWNLOAD DEBUG] Skipping empty field - name: "' + element.name + '" - value: "' + value + '" - type: "' + element.type + '"');
                    }
                }
            } else {
                console.log('🔍 [MANUAL DOWNLOAD DEBUG] Skipping element - id: "' + element.id + '" - name: "' + element.name + '" - disabled: ' + element.disabled);
            }
        });
        
        console.log('🔍 [MANUAL DOWNLOAD DEBUG] Manual download form data collection complete');

        // Use the /edit_pdf endpoint with the PDF name as a query parameter
        // Remove the .pdf extension if present since server adds it automatically
        const baseName = pdfName.replace(/\.pdf$/i, '');
        const endpoint = '/edit_pdf?pdf=' + encodeURIComponent(baseName);
        
        const res = await fetch(endpoint, { 
            method: 'POST', 
            body: fd 
        });
        
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error("HTTP error! status: " + res.status + " - " + errorText);
        }
        
        const blob = await res.blob();
        
        if (blob.size === 0) {
            throw new Error("Received empty PDF blob from server");
        }
        
        const url = URL.createObjectURL(blob);

        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Edited_' + pdfName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up the object URL after a delay
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        // inline preview - only show the last one
        const frame = document.getElementById('pdfFrame');
        if (frame) {
            frame.src = url;
            frame.style.display = 'block';
        }
        const preview = document.getElementById('pdfPreview');
        if (preview) {
            preview.style.display = 'none';
        }
        
        console.log("Successfully processed PDF: " + pdfName);
    } catch (error) {
        console.error("Error processing PDF " + pdfName + ":", error);
        throw error; // Re-throw to be handled by the caller
    }
}


/***********************************************
 * Hidden Checkbox Calculations
 ***********************************************/
function runAllHiddenCheckboxCalculations(){
    if(!hiddenCheckboxCalculations || hiddenCheckboxCalculations.length===0) return;
    for(var i=0; i<hiddenCheckboxCalculations.length; i++){
        runSingleHiddenCheckboxCalculation(hiddenCheckboxCalculations[i]);
    }
}

function runSingleHiddenCheckboxCalculation(calcObj){
    var cbox = document.getElementById(calcObj.hiddenFieldName);
    if(!cbox) return;  // hidden field not found

    var finalState = false;  // start with unchecked, only check if calculation conditions are met
    console.log('🔧 [CALC DEBUG] Running calculation for checkbox:', calcObj.hiddenFieldName);

    // Evaluate each multi-term condition in 'calculations'
    for(var c=0; c<calcObj.calculations.length; c++){
        var oneCalc = calcObj.calculations[c];
        var val = 0;

        // Sum up the terms
        if(oneCalc.terms && oneCalc.terms.length>0){
            val = parseFloat( getMoneyValue(oneCalc.terms[0].questionNameId) )||0;
            console.log('🔧 [CALC DEBUG] First term value for', oneCalc.terms[0].questionNameId, ':', val);
            for(var t=1; t<oneCalc.terms.length; t++){
                var term = oneCalc.terms[t];
                var op   = term.operator||'';
                var nextVal = parseFloat(getMoneyValue(term.questionNameId))||0;

                if(op==='+') val += nextVal;
                else if(op==='-') val -= nextVal;
                else if(op==='x') val *= nextVal;
                else if(op==='/'){
                    if(nextVal!==0) val /= nextVal;
                    else val=0;
                }
            }
        }

        // Compare val to threshold
        var thr = parseFloat(oneCalc.threshold)||0;
        var matched = false;
        if(oneCalc.compareOperator==='=') matched = (val===thr);
        else if(oneCalc.compareOperator==='<') matched = (val<thr);
        else if(oneCalc.compareOperator==='>') matched = (val>thr);

        console.log('🔧 [CALC DEBUG] Comparison:', val, oneCalc.compareOperator, thr, '=', matched);

        // If matched, set final state
        if(matched){
            finalState = (oneCalc.result==='checked');
            console.log('🔧 [CALC DEBUG] Condition matched, setting finalState to:', finalState);
        }
    }

    // Set the hidden checkbox state
    cbox.checked = finalState;
    console.log('🔧 [CALC DEBUG] Final result for', calcObj.hiddenFieldName, ':', finalState);
    
    // Handle mutually exclusive checkboxes for suing amount
    if(calcObj.hiddenFieldName === 'suing_over_2500' && finalState) {
        // If suing_over_2500 is checked, ensure suing_under_2500 is unchecked
        var underCheckbox = document.getElementById('suing_under_2500');
        if(underCheckbox) {
            underCheckbox.checked = false;
            console.log('🔧 [CALC DEBUG] Unchecked suing_under_2500 because suing_over_2500 is checked');
        }
    } else if(calcObj.hiddenFieldName === 'suing_under_2500' && finalState) {
        // If suing_under_2500 is checked, ensure suing_over_2500 is unchecked
        var overCheckbox = document.getElementById('suing_over_2500');
        if(overCheckbox) {
            overCheckbox.checked = false;
            console.log('🔧 [CALC DEBUG] Unchecked suing_over_2500 because suing_under_2500 is checked');
        }
    }
}


/***********************************************
 * Hidden Text Calculations (with placeholders)
 ***********************************************/
function runAllHiddenTextCalculations(){
    if(!hiddenTextCalculations || hiddenTextCalculations.length===0) return;
    for(var i=0; i<hiddenTextCalculations.length; i++){
        runSingleHiddenTextCalculation(hiddenTextCalculations[i]);
    }
}

/**
 * Evaluate each multi-term calculation and set the hidden text field.
 * If fillValue format is "##fieldName##", we store the numeric sum of the terms
 * using the field's own name (or any other field name).
 */
function runSingleHiddenTextCalculation(calcObj) {
    const textField = document.getElementById(calcObj.hiddenFieldName);
    if (!textField) return;

    // We'll assume that the last matched condition takes precedence
    let finalValue = "";

    calcObj.calculations.forEach(function(oneCalc) {
        let val = 0;
        
        // Calculate the sum of all terms
        if (oneCalc.terms && oneCalc.terms.length > 0) {
            // Get the first term's value
            const firstTerm = oneCalc.terms[0];
            val = parseFloat(getMoneyValue(firstTerm.questionNameId)) || 0;

            // Process remaining terms
            for (let t = 1; t < oneCalc.terms.length; t++) {
                const term = oneCalc.terms[t];
                const termVal = parseFloat(getMoneyValue(term.questionNameId)) || 0;

                switch(term.operator) {
                    case '+': val += termVal; break;
                    case '-': val -= termVal; break;
                    case 'x': val *= termVal; break;
                    case '/': val = termVal !== 0 ? val / termVal : 0; break;
                }
            }
        }

        // Compare to threshold
        const threshold = parseFloat(oneCalc.threshold) || 0;
        let matched = false;

        switch(oneCalc.compareOperator) {
            case '>': matched = val > threshold; break;
            case '<': matched = val < threshold; break;
            case '=': matched = Math.abs(val - threshold) < 0.000001; break; // Use epsilon for float comparison
        }

        if (matched) {
            // Handle special fillValue formats
            if (oneCalc.fillValue === "##total##" || oneCalc.fillValue.match(/^##(.+)##$/)) {
                finalValue = val.toFixed(2); // Format money values with 2 decimal places
            } else {
                finalValue = oneCalc.fillValue;
            }
        }
    });

    // Update the text field
    textField.value = finalValue;
}

function replacePlaceholderTokens (str){
    /* note the doubled back-slashes in the delimiters \$\$ */
    return str.replace(/\\$\\$(.*?)\\$\\$/g, function (_match, innerExpr){
        return evaluatePlaceholderExpression(innerExpr);
    });
}

function evaluatePlaceholderExpression (exprString){
    /* split on +  -  x  /   (all kept as separate tokens) */
    var tokens = exprString.split(/([+\-x\/])/);          // ← every \ is **doubled**
    if (!tokens.length) return '0';

    var currentVal = parseTokenValue(tokens[0]);
    for (var i = 1; i < tokens.length; i += 2){
        var op   = tokens[i];
        var next = parseTokenValue(tokens[i + 1] || '0');

        if      (op === '+') currentVal += next;
        else if (op === '-') currentVal -= next;
        else if (op === 'x') currentVal *= next;
        else if (op === '/') currentVal  = next !== 0 ? currentVal / next : 0;
    }
    return currentVal.toString();
}

function parseTokenValue(token){
    token = token.trim();
    if(!token) return 0;
    var el= document.getElementById(token);
    if(!el) return 0;
    var val= parseFloat(el.value);
    return isNaN(val) ? 0 : val;
}

/*───────────────────────────────────────────────────────────────*
 * 3.  getMoneyValue(qId)
 *     – tiny regex fix so legacy "amountX_Y_Z" can still resolve
 *       (note the escaped \\d+ instead of stray 'd').
 *───────────────────────────────────────────────────────────────*/
function getMoneyValue(qId) {
    /* direct hit first */
    const el = document.getElementById(qId);
    if (el) {
        if (el.type === "checkbox") {
            const amt = document.getElementById(el.id + "_amount");
            if (amt && el.checked) return parseFloat(amt.value) || 0;
            return el.checked ? 1 : 0;
        }
        return parseFloat(el.value) || 0;
    }

    /* legacy builder‑shorthand amountX_Y_Z */
    if (/^amount\d+_\d+_.+/.test(qId)) {
        const el2 = document.getElementById(normaliseDesignerFieldRef(qId));
        if (el2) return parseFloat(el2.value) || 0;
    }

    /* name‑attribute fallback */
    const byName = document.getElementsByName(qId);
    if (byName.length) return parseFloat(byName[0].value) || 0;

    return 0;
}




function attachCalculationListeners() {
    // Universal function to attach listeners in a consistent way
    function attachListenersToCalculationTerms(calculations, runCalculationFunction) {
        for (let i = 0; i < calculations.length; i++) {
            const calcObj = calculations[i];
            for (let c = 0; c < calcObj.calculations.length; c++) {
                const oneCalc = calcObj.calculations[c];
                const terms = oneCalc.terms || [];
                
                for (let t = 0; t < terms.length; t++) {
                    const qNameId = terms[t].questionNameId;
                    
                    // 1. Try direct element
                    const el = document.getElementById(qNameId);
                    if (el) {
                        el.addEventListener('change', runCalculationFunction);
                        el.addEventListener('input', runCalculationFunction);
                        
                        // If it's a checkbox, also listen to its amount field
                        if (el.type === 'checkbox') {
                            const amountField = document.getElementById(el.id + '_amount');
                            if (amountField) {
                                amountField.addEventListener('input', runCalculationFunction);
                            }
                        }
                        continue; // Found and attached, go to next term
                    }
                    
                    // 2. Try elements with this name
                    const namedElements = document.getElementsByName(qNameId);
                    if (namedElements.length > 0) {
                        for (let n = 0; n < namedElements.length; n++) {
                            namedElements[n].addEventListener('change', runCalculationFunction);
                            namedElements[n].addEventListener('input', runCalculationFunction);
                        }
                        continue;
                    }
                    
                    // 3. Look for prefixed IDs like "answerX_qId"
                    const prefixPattern = new RegExp('.*_' + qNameId + '$');
                    const allInputs = document.querySelectorAll('input, select, textarea');
                    
                    for (let inp = 0; inp < allInputs.length; inp++) {
                        const input = allInputs[inp];
                        if (prefixPattern.test(input.id)) {
                            input.addEventListener('change', runCalculationFunction);
                            input.addEventListener('input', runCalculationFunction);
                            
                            // If it's a checkbox with amount field
                            if (input.type === 'checkbox') {
                                const amountField = document.getElementById(input.id + '_amount');
                                if (amountField) {
                                    amountField.addEventListener('input', runCalculationFunction);
                                }
                            }
                        }
                    }
                    
                    // 4. Look specifically for amount fields with this name
                    const amountElements = document.querySelectorAll('input[name="' + qNameId + '"]');
                    for (let a = 0; a < amountElements.length; a++) {
                        amountElements[a].addEventListener('input', runCalculationFunction);
                        
                        // Also find and attach to the controlling checkbox
                        if (amountElements[a].id.includes('_amount')) {
                            const checkboxId = amountElements[a].id.replace('_amount', '');
                            const checkbox = document.getElementById(checkboxId);
                            if (checkbox) {
                                checkbox.addEventListener('change', runCalculationFunction);
                            }
                        }
                    }
                    
                    // 5. Try direct amount field
                    const directAmountField = document.getElementById(qNameId + '_amount');
                    if (directAmountField) {
                        directAmountField.addEventListener('input', runCalculationFunction);
                        
                        // Find the checkbox controlling this amount field
                        const checkboxSelector = 'input[type="checkbox"][onchange*="' + directAmountField.id + '"]';
                        const checkbox = document.querySelector(checkboxSelector);
                        if (checkbox) {
                            checkbox.addEventListener('change', runCalculationFunction);
                        }
                    }
                }
            }
        }
    }
    
    // For hidden checkbox calculations
    if (hiddenCheckboxCalculations && hiddenCheckboxCalculations.length > 0) {
        const runAllCheckboxCalcs = function() {
            runAllHiddenCheckboxCalculations();
        };
        attachListenersToCalculationTerms(hiddenCheckboxCalculations, runAllCheckboxCalcs);
    }
    
    // For hidden text calculations
    if (hiddenTextCalculations && hiddenTextCalculations.length > 0) {
        const runAllTextCalcs = function() {
            runAllHiddenTextCalculations();
        };
        attachListenersToCalculationTerms(hiddenTextCalculations, runAllTextCalcs);
    }
    
    // Run calculations once on page load to set initial values
    runAllHiddenCheckboxCalculations();
    runAllHiddenTextCalculations();
}

// Progress Bar Logic
function updateProgressBar() {
  // Stepper logic
  const stepper = document.getElementById('stepperProgressBar');
  if (!stepper) return;
  const steps = stepper.querySelectorAll('.stepper-step');
  
  // Check if we're using group-based progress
  if (window.groupToSectionMap && window.sectionToGroupMap) {
    // Group-based progress bar
    let activeGroupStep = 1;
    
    if (typeof currentSectionNumber === 'number') {
      // Find which section we're currently on
      const currentSectionEl = document.querySelector('#section' + currentSectionNumber);
      if (currentSectionEl) {
        const sectionTitleEl = currentSectionEl.querySelector('.section-title');
        if (sectionTitleEl) {
          const currentSectionName = sectionTitleEl.textContent.trim();
          const currentGroupId = window.sectionToGroupMap[currentSectionName];
          if (currentGroupId) {
            // Find the step number for this group
            const groupIds = Object.keys(window.groupToSectionMap).sort((a, b) => parseInt(a) - parseInt(b));
            activeGroupStep = groupIds.indexOf(currentGroupId) + 1;
          }
        }
      }
    } else if (currentSectionNumber === 'end') {
      activeGroupStep = steps.length;
    }
    
    steps.forEach((step, idx) => {
      step.classList.remove('active', 'completed');
      if (idx + 1 < activeGroupStep) {
        step.classList.add('completed');
      } else if (idx + 1 === activeGroupStep) {
        step.classList.add('active');
      }
    });
    
    // Animate lines between completed steps
    const lines = stepper.querySelectorAll('.stepper-line');
    lines.forEach((line, idx) => {
      if (idx < activeGroupStep - 1) {
        line.classList.add('filled');
      } else {
        line.classList.remove('filled');
      }
    });
  } else {
    // Section-based progress bar (fallback)
    let activeStep = 1;
    if (typeof currentSectionNumber === 'number') {
      activeStep = currentSectionNumber;
    } else if (currentSectionNumber === 'end') {
      activeStep = steps.length;
    }
    steps.forEach((step, idx) => {
      step.classList.remove('active', 'completed');
      if (idx + 1 < activeStep) {
        step.classList.add('completed');
      } else if (idx + 1 === activeStep) {
        step.classList.add('active');
      }
    });
    // Animate lines between completed steps
    const lines = stepper.querySelectorAll('.stepper-line');
    lines.forEach((line, idx) => {
      if (idx < activeStep - 1) {
        line.classList.add('filled');
      } else {
        line.classList.remove('filled');
      }
    });
  }
}

// Animate the progress bar fill width smoothly
function animateProgressBarFill(fillEl, targetPercent) {
  if (!fillEl) return;
  // Cancel any previous animation
  if (fillEl._progressAnimFrame) {
    cancelAnimationFrame(fillEl._progressAnimFrame);
    fillEl._progressAnimFrame = null;
  }
  const currentWidth = parseFloat(fillEl.style.width) || 0;
  const start = currentWidth;
  const end = targetPercent;
  const duration = 500; // ms, should match CSS transition
  const startTime = performance.now();

  function animate(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    // Use easeInOutCubic for a nice effect
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const newWidth = start + (end - start) * ease;
    fillEl.style.width = newWidth + '%';
    if (t < 1) {
      fillEl._progressAnimFrame = requestAnimationFrame(animate);
    } else {
      fillEl.style.width = end + '%';
      fillEl._progressAnimFrame = null;
    }
  }
  requestAnimationFrame(animate);
}

document.addEventListener('DOMContentLoaded', function() {
  updateProgressBar();
});

// Modal logic
function showLoginRequiredModal() {
  document.getElementById('loginRequiredModal').style.display = 'flex';
}
function hideLoginRequiredModal() {
  document.getElementById('loginRequiredModal').style.display = 'none';
}
document.addEventListener('DOMContentLoaded', function() {
  var backBtn = document.getElementById('modalBackBtn');
  var contBtn = document.getElementById('modalContinueBtn');
  if (backBtn) backBtn.onclick = hideLoginRequiredModal;
  if (contBtn) contBtn.onclick = function() {
    window.location.href = '../Pages/account.html';
  };
});

// Patch handleNext to check login before advancing
if (typeof handleNext === 'function') {
  var originalHandleNext = handleNext;
  window.handleNext = function(currentSection) {
    if (!isUserLoggedIn) {
      showLoginRequiredModal();
      return;
    }
    originalHandleNext(currentSection);
  };
}

// AUTOSAVE, RESTORE, AND WIPE LOGIC FOR ALL GENERATED FORMS
(function() {
    // Wait for Firebase and DOM
    function onReady(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }
    onReady(function() {
        if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
        const db = firebase.firestore();
        const urlParams = new URLSearchParams(window.location.search);
        const baseFormId = urlParams.get('formId') || window.formId || 'default';
        const county = urlParams.get('county') || '';
        const portfolioId = urlParams.get('portfolioId') || '';
        // Create a unique form ID that includes county and portfolio information for autosave separation
        let formId = baseFormId;
        if (county) formId += '_' + county.replace(/\s+/g, '_');
        if (portfolioId) formId += '_' + portfolioId;
        let userId = null;
        let isUserLoggedIn = false;



        // Helper: get all form fields to save
        function getFormFields() {
            const form = document.getElementById('customForm');
            if (!form) {
                return [];
            }
            // Include both elements inside the form AND elements with form="customForm" attribute
            const formElements = Array.from(form.elements);
            const externalFormElements = Array.from(document.querySelectorAll('input[form="customForm"], textarea[form="customForm"], select[form="customForm"]'));
            const allFormElements = [...formElements, ...externalFormElements];
            
            const fields = allFormElements.filter(el =>
                el.name &&
                !el.disabled &&
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) &&
                !['button', 'submit', 'reset'].includes(el.type) &&
                // Include hidden fields except for specific ones we don't want to send
                (el.type !== 'hidden' || el.id === 'current_date' || el.id === 'form_zip' || el.id === 'form_county' || el.id === 'form_defendant' || el.id === 'form_ID')
            );
            return fields;
        }

        // Helper: save answers
        async function saveAnswers() {
            if (!isUserLoggedIn || !userId) return;
            const fields = getFormFields();
            const answers = {};
            fields.forEach(el => {
                if (el.type === 'checkbox') {
                    // For checkboxes, save true/false
                    answers[el.name] = el.checked;
                } else if (el.type === 'radio') {
                    // For radio buttons, save the selected value or null if none selected
                    const selectedRadio = document.querySelector('input[name="' + el.name + '"]:checked');
                    answers[el.name] = selectedRadio ? selectedRadio.value : null;
                } else {
                    // For other fields, save the value
                    answers[el.name] = el.value;
                }
            });
            
   
            
            await db.collection('users').doc(userId).collection('formAnswers').doc(formId).set(answers, { merge: true });
            
            
        }

        // Helper function to check paragraph limits for autofilled textareas
        function triggerParagraphLimitCheckForAutofilledTextareas() {
            
            // Find all textareas and check if they need paragraph limit checking
            const textareas = document.querySelectorAll('textarea');
            textareas.forEach(textarea => {
                if (textarea.value && textarea.value.length > 0) {
                    // Check if this textarea has a paragraph limit by looking for the checkParagraphLimit function
                    // We'll trigger the oninput event which will call checkParagraphLimit if it's set up
                    const event = new Event('input', { bubbles: true });
                    textarea.dispatchEvent(event);
                }
            });
        }

        // Helper function to trigger line splitting for autofilled textareas
        function triggerLineSplittingForAutofilledTextareas() {
            
            // Find all textareas that have a line limit data attribute
            const textareas = document.querySelectorAll('textarea[data-line-limit]');
            textareas.forEach(textarea => {
                const lineLimit = parseInt(textarea.getAttribute('data-line-limit'));
                if (lineLimit && textarea.value && textarea.value.length > 0) {
                    
                    // Call the handleLineSplitting function if it exists
                    if (typeof handleLineSplitting === 'function') {
                        handleLineSplitting(textarea.id, lineLimit);
                    } else {
                        // Fallback: manually trigger the line splitting logic
                        const text = textarea.value;
                        const totalChars = text.length;
                        const linesNeeded = Math.ceil(totalChars / lineLimit);
                        
                        
                        // Create or update hidden textboxes for each line
                        for (let i = 1; i <= linesNeeded; i++) {
                            const startIndex = (i - 1) * lineLimit;
                            const endIndex = Math.min(startIndex + lineLimit, totalChars);
                            const lineText = text.substring(startIndex, endIndex);
                            
                            const hiddenInputId = textarea.id + '_line' + i;
                            let hiddenInput = document.getElementById(hiddenInputId);
                            
                            if (!hiddenInput) {
                                // Create new hidden input
                                hiddenInput = document.createElement('input');
                                hiddenInput.type = 'hidden';
                                hiddenInput.id = hiddenInputId;
                                hiddenInput.name = hiddenInputId;
                                textarea.parentNode.appendChild(hiddenInput);
                            }
                            
                            hiddenInput.value = lineText;
                        }
                        
                        // Remove any extra hidden inputs that are no longer needed
                        let lineNum = linesNeeded + 1;
                        while (true) {
                            const extraInput = document.getElementById(textarea.id + '_line' + lineNum);
                            if (extraInput) {
                                extraInput.remove();
                                lineNum++;
                            } else {
                                break;
                            }
                        }
                    }
                }
            });
        }

        // Helper: load answers
        async function loadAnswers() {
            if (!isUserLoggedIn || !userId) {
                return;
            }
            try {
                // First, try to load user profile data from a user profile document
                const userProfileDoc = await db.collection('users').doc(userId).get();
                
                let userProfileData = {};
                if (userProfileDoc.exists) {
                    userProfileData = userProfileDoc.data();
                }
                
                // Then, try to load form-specific data
                const doc = await db.collection('users').doc(userId).collection('formAnswers').doc(formId).get();
                
                let formData = {};
                if (doc.exists) {
                    formData = doc.data();
                }
                
                // Combine user profile data with form data
                const data = { ...userProfileData, ...formData };
                
                // Helper function to map Firebase data to form field names
                function mapFirebaseDataToFormFields(firebaseData) {
                    const mappedData = { ...firebaseData };
                    
                    // Map user info fields from Firebase structure to form field names
                    if (firebaseData.firstName) mappedData.user_firstname = firebaseData.firstName;
                    if (firebaseData.lastName) mappedData.user_lastname = firebaseData.lastName;
                    if (firebaseData.email) mappedData.user_email = firebaseData.email;
                    if (firebaseData.phone) mappedData.user_phone = firebaseData.phone;
                    
                    // Map address fields
                    if (firebaseData.address) {
                        if (firebaseData.address.street) mappedData.user_street = firebaseData.address.street;
                        if (firebaseData.address.city) mappedData.user_city = firebaseData.address.city;
                        if (firebaseData.address.state) mappedData.user_state = firebaseData.address.state;
                        if (firebaseData.address.zip) mappedData.user_zip = firebaseData.address.zip;
                    }
                    
                    return mappedData;
                }
                
                const mappedData = mapFirebaseDataToFormFields(data);
                
                // 🔧 NEW: Debug all radio buttons in the form
                const allRadioButtons = document.querySelectorAll('input[type="radio"]');
                
                // 🔧 NEW: Add flag to prevent autosave during initial load
                window.isInitialAutofill = true;
                
                    const fields = getFormFields();
                    fields.forEach(el => {
                    // Check both by name and by ID for autofill
                    let autofillValue = null;
                    if (mappedData.hasOwnProperty(el.name)) {
                        autofillValue = mappedData[el.name];
                    } else if (el.id && mappedData.hasOwnProperty(el.id)) {
                        autofillValue = mappedData[el.id];
                    }
                    
                    if (autofillValue !== null) {
                            // Skip current_date field - it should be set dynamically
                            if (el.id === 'current_date' || el.name === 'current_date') {
                                console.log('Skipping autofill for current_date - should be set dynamically');
                                return;
                            }
                            
                            // Check if this answer would trigger a jump to the end
                        if (wouldTriggerJumpToEnd(el, autofillValue)) {
                                // Don't autofill this answer - keep it as default
                                console.log('Skipping autofill for ' + el.name + ' as it would trigger jump to end');
                                return;
                            }
                            
                            if (el.type === 'checkbox' || el.type === 'radio') {
                            if (el.type === 'radio') {
                                // For radio buttons, we need to check if this specific radio button should be selected
                                if (el.value === autofillValue) {
                                    el.checked = true;
                            } else {
                                    el.checked = false;
                                }
                            } else {
                                // For checkboxes, use the boolean value
                                el.checked = !!autofillValue;
                            }
                        } else {
                            el.value = autofillValue;
                            }
                        }
                    });
                    
                    // After autofilling, trigger visibility updates for dependent questions
                    // Use a longer delay to ensure conditional logic scripts are fully loaded and executed
                    setTimeout(() => {
                        // Trigger change events on all autofilled elements to ensure conditional logic runs
                        fields.forEach(el => {
                            if (el.value || el.checked) {
                                const event = new Event('change', { bubbles: true });
                                el.dispatchEvent(event);
                            }
                        });
                        
                        // Also call the global visibility updates function
                        if (typeof triggerVisibilityUpdates === 'function') {
                            triggerVisibilityUpdates();
                        }
                    }, 2000);
                    
                    // Trigger numbered dropdown textbox generation for any numbered dropdowns that were autofilled
                    fields.forEach(el => {
                    if (el.tagName === 'SELECT' && (el.id.startsWith('answer') || el.id.startsWith('how_many')) && el.value) {
                        let questionId;
                        // First, try to get questionId from data attribute
                        if (el.dataset && el.dataset.questionId) {
                            questionId = el.dataset.questionId;
                        } else if (el.id.startsWith('answer')) {
                            questionId = el.id.replace('answer', '');
                        } else if (el.id.startsWith('how_many')) {
                            // For how_many dropdowns, use the helper function to extract from onchange
                            const dropdownElement = document.getElementById(el.id);
                            const qFromOnchange = extractQuestionIdFromOnchange(dropdownElement && dropdownElement.onchange);
                            if (qFromOnchange) {
                                questionId = qFromOnchange;
                            } else {
                                // Final fallback: try to find the container by checking which labelContainer exists
                                for (let i = 1; i <= 10; i++) {
                                    if (document.getElementById('labelContainer' + i)) {
                                        questionId = i.toString();
                                        break;
                                    }
                                }
                            }
                        }
                            if (typeof showTextboxLabels === 'function') {
                                showTextboxLabels(questionId, el.value);
                            }
                            if (typeof updateHiddenCheckboxes === 'function') {
                                updateHiddenCheckboxes(questionId, el.value);
                            }
                        }
                    });
                
                // Trigger state hidden field updates for any state dropdowns that were autofilled
                fields.forEach(el => {
                    if (el.tagName === 'SELECT' && el.id && el.value && el.classList.contains('address-select')) {
                        // This is a state dropdown that was autofilled
                        const hiddenFullId = el.id + '_hidden'; // Add _hidden suffix to avoid conflict with dropdown
                        const hiddenShortId = window.toShortIdFromBase(el.id);
                        if (typeof updateStateHiddenFields === 'function') {
                            updateStateHiddenFields(el, hiddenFullId, hiddenShortId);
                            }
                        }
                    });
                    
                    // Trigger hidden checkbox generation for any regular dropdowns that were autofilled
                    fields.forEach(el => {
                        if (el.tagName === 'SELECT' && el.id && !el.id.startsWith('answer') && el.value) {
                            if (typeof dropdownMirror === 'function') {
                                dropdownMirror(el, el.id);
                            }
                        // Trigger hidden logic for autofilled dropdowns
                        if (typeof updateHiddenLogic === 'function') {
                            updateHiddenLogic(el.id, el.value);
                            }
                        }
                    });
                    
                    // Create hidden checkboxes for all autofilled dropdowns
                    if (typeof createHiddenCheckboxesForAutofilledDropdowns === 'function') {
                        createHiddenCheckboxesForAutofilledDropdowns();
                    }
                
                // Trigger line splitting for autofilled textareas
                triggerLineSplittingForAutofilledTextareas();
                
                // Trigger paragraph limit checking for autofilled textareas
                triggerParagraphLimitCheckForAutofilledTextareas();
                    
                    // Second autofill pass for dynamically generated textbox inputs
                    // Use a longer delay to ensure textbox inputs are fully generated
                    setTimeout(() => {
                        const allFields = getFormFields();
                        
                        // Also try to find fields by ID directly as a fallback
                        const fieldsById = {};
                        allFields.forEach(el => {
                            if (el.id) {
                                fieldsById[el.id] = el;
                            }
                        });
                        
                        allFields.forEach(el => {
                            if (mappedData.hasOwnProperty(el.name)) {
                                // Skip current_date field - it should be set dynamically
                                if (el.id === 'current_date' || el.name === 'current_date') {
                                    return;
                                }
                                
                                if (el.type === 'checkbox') {
                                    el.checked = !!mappedData[el.name];
                                } else if (el.type === 'radio') {
                                    // For radio buttons, only check the one that matches the value
                                    if (el.value === mappedData[el.name]) {
                                        el.checked = true;
                                    } else {
                                        el.checked = false;
                                    }
                                } else {
                                    el.value = mappedData[el.name];
                                }
                            }
                        });
                        
                        // Additional pass: try to autofill by ID for any fields that might have been missed
                        Object.keys(mappedData).forEach(fieldName => {
                            // Skip current_date field - it should be set dynamically
                            if (fieldName === 'current_date') {
                                return;
                            }
                            
                            const fieldById = fieldsById[fieldName];
                            if (fieldById && mappedData[fieldName]) {
                                // Check if field needs autofilling (different logic for different field types)
                                const needsAutofill = (fieldById.type === 'checkbox' || fieldById.type === 'radio') 
                                    ? !fieldById.checked 
                                    : !fieldById.value;
                                
                                if (needsAutofill) {
                                if (fieldById.type === 'checkbox' || fieldById.type === 'radio') {
                                        if (fieldById.type === 'radio') {
                                            // For radio buttons, check if this specific radio should be selected
                                            if (fieldById.value === mappedData[fieldName]) {
                                                fieldById.checked = true;
                                            } else {
                                                fieldById.checked = false;
                                            }
                                        } else {
                                            // For checkboxes, use boolean value
                                    fieldById.checked = !!mappedData[fieldName];
                                        }
                                } else {
                                    fieldById.value = mappedData[fieldName];
                                    }
                                }
                            }
                        });
                        
                        // Trigger line splitting again after the second autofill pass
                        triggerLineSplittingForAutofilledTextareas();
                        
                        // Trigger paragraph limit checking again after the second autofill pass
                        triggerParagraphLimitCheckForAutofilledTextareas();
                        
                        // Trigger numbered dropdown textbox generation for any numbered dropdowns that were autofilled in second pass
                        allFields.forEach(el => {
                            if (el.tagName === 'SELECT' && (el.id.startsWith('answer') || el.id.startsWith('how_many')) && el.value) {
                                let questionId;
                                // First, try to get questionId from data attribute
                                if (el.dataset && el.dataset.questionId) {
                                    questionId = el.dataset.questionId;
                                } else if (el.id.startsWith('answer')) {
                                    questionId = el.id.replace('answer', '');
                                } else if (el.id.startsWith('how_many')) {
                                    // For how_many dropdowns, use the helper function to extract from onchange
                                    const dropdownElement = document.getElementById(el.id);
                                    const qFromOnchange = extractQuestionIdFromOnchange(dropdownElement && dropdownElement.onchange);
                                    if (qFromOnchange) {
                                        questionId = qFromOnchange;
                                    } else {
                                        // Final fallback: try to find the container by checking which labelContainer exists
                                        for (let i = 1; i <= 10; i++) {
                                            if (document.getElementById('labelContainer' + i)) {
                                                questionId = i.toString();
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (typeof showTextboxLabels === 'function') {
                                    showTextboxLabels(questionId, el.value);
                                    
                                    // After creating numbered fields, autofill them with Firebase data
                                    setTimeout(() => {
                                        const count = parseInt(el.value);
                                        if (count > 0) {
                                            // Get the base field name from the dropdown
                                            const baseFieldName = el.id;
                                            
                                            
                                            // Try to autofill numbered fields for each count
                                            for (let i = 1; i <= count; i++) {
                                                // Common field patterns to check - using the actual Firebase naming pattern
                                                const fieldPatterns = [
                                                    'name', 
                                                    'phone_number', 
                                                    'mailing_address',
                                                    'street',
                                                    'city', 
                                                    'state', 
                                                    'zip'
                                                ];
                                                
                                                fieldPatterns.forEach(pattern => {
                                                    // Try both naming patterns: sc100_how_many_people_are_suing_with_you_1_name and how_many_people_are_suing_with_you_name_1
                                                    const fieldId1 = 'sc100_' + baseFieldName + '_' + i + '_' + pattern;
                                                    const fieldId2 = baseFieldName + '_' + pattern + '_' + i;
                                                    
                                                    
                                                    // Check first pattern
                                                    let fieldElement = document.getElementById(fieldId1);
                                                    if (fieldElement && mappedData[fieldId1]) {
                                                        fieldElement.value = mappedData[fieldId1];
                                                    }
                                                    
                                                    // Check second pattern
                                                    fieldElement = document.getElementById(fieldId2);
                                                    if (fieldElement && mappedData[fieldId2]) {
                                                        fieldElement.value = mappedData[fieldId2];
                                                    }
                                                });
                                            }
                                        } else {
                                        }
                                    }, 500); // Increased delay to ensure fields are created and DOM is updated
                                }
                                if (typeof updateHiddenCheckboxes === 'function') {
                                    updateHiddenCheckboxes(questionId, el.value);
                                }
                            }
                        });
                        
                        // Trigger state hidden field updates for any state dropdowns that were autofilled in second pass
                        allFields.forEach(el => {
                            if (el.tagName === 'SELECT' && el.id && el.value && el.classList.contains('address-select')) {
                                // This is a state dropdown that was autofilled
                                const hiddenFullId = el.id + '_hidden'; // Add _hidden suffix to avoid conflict with dropdown
                                const hiddenShortId = window.toShortIdFromBase(el.id);
                                if (typeof updateStateHiddenFields === 'function') {
                                    updateStateHiddenFields(el, hiddenFullId, hiddenShortId);
                                }
                            }
                        });
                    }, 1500);
                    
                        // Reset hidden questions to defaults after autofill and visibility updates
                        // BUT NOT during initial autofill to preserve autofilled values
                        if (typeof currentSectionNumber === 'number' && !window.isInitialAutofill) {
                            resetHiddenQuestionsToDefaults(currentSectionNumber);
                }
                
                // 🔧 NEW: Additional fallback for numbered dropdown autofill - try again after a longer delay
                setTimeout(() => {
                    const numberedDropdowns = document.querySelectorAll('select[id*="how_many"], select[id*="answer"]');
                    numberedDropdowns.forEach(dropdown => {
                        if (dropdown.value && parseInt(dropdown.value) > 0) {
                            // Trigger the autofill logic again for any missed dropdowns
                            const questionId = dropdown.dataset.questionId || dropdown.id.replace(/^(answer|how_many)/, '');
                            if (typeof showTextboxLabels === 'function') {
                                showTextboxLabels(questionId, dropdown.value);
                                
                                // 🔧 NEW: Add the missing autofill logic for numbered fields
                                setTimeout(() => {
                                    const count = parseInt(dropdown.value);
                                    if (count > 0) {
                                        // Get the base field name from the dropdown
                                        const baseFieldName = dropdown.id;
                                        
                                        
                                        // Try to autofill numbered fields for each count
                                        for (let i = 1; i <= count; i++) {
                                            // Common field patterns to check - using the actual Firebase naming pattern
                                            const fieldPatterns = [
                                                'name', 
                                                'phone_number', 
                                                'mailing_address',
                                                'street',
                                                'city', 
                                                'state',
                                                'zip',
                                                'zip_code',
                                                'email',
                                                'address'
                                            ];
                                            
                                            fieldPatterns.forEach(pattern => {
                                                // Try both naming patterns: sc100_how_many_people_are_suing_with_you_1_name and how_many_people_are_suing_with_you_name_1
                                                const fieldId1 = 'sc100_' + baseFieldName + '_' + i + '_' + pattern;
                                                const fieldId2 = baseFieldName + '_' + pattern + '_' + i;
                                                
                                                
                                                // Check first pattern
                                                let fieldElement = document.getElementById(fieldId1);
                                                if (fieldElement && mappedData[fieldId1]) {
                                                    fieldElement.value = mappedData[fieldId1];
                                                }
                                                
                                                // Check second pattern
                                                fieldElement = document.getElementById(fieldId2);
                                                if (fieldElement && mappedData[fieldId2]) {
                                                    fieldElement.value = mappedData[fieldId2];
                                                }
                                            });
                                        }
                                    } else {
                                    }
                                }, 500); // 500ms delay to ensure fields are created
                            }
                        }
                    });
                }, 1000); // 1 second delay for fallback
                
        // 🔧 NEW: Clear autofill flag after fallback autofill is complete
        setTimeout(() => {
            window.isInitialAutofill = false;
            
            // 🔧 NEW: Update all hidden address fields after autofill completes
            if (typeof updateAllHiddenAddressFields === 'function') {
                updateAllHiddenAddressFields();
            }
        }, 2000); // 2 second delay to ensure fallback autofill completes
                
            } catch (e) {
                console.log('Error loading answers:', e);
            }
        }
        

        
        // Helper: check if an answer would trigger a jump to the end
        function wouldTriggerJumpToEnd(element, answerValue) {
            if (!jumpLogics || jumpLogics.length === 0) return false;
            
            // Find the question ID for this element
            let questionId = null;
            for (const [qId, nameId] of Object.entries(questionNameIds)) {
                if (element.name === nameId || element.id === nameId) {
                    questionId = qId;
                    break;
                }
            }
            
            if (!questionId) return false;
            
            // Check if there's a jump logic for this question that would go to 'end'
            const relevantJumps = jumpLogics.filter(jl => jl.questionId === questionId);
            for (const jl of relevantJumps) {
                if (jl.jumpTo.toLowerCase() === 'end') {
                    // Check if the answer matches the jump condition
                    if (jl.questionType === 'dropdown' || jl.questionType === 'radio' || jl.questionType === 'numberedDropdown') {
                        if (answerValue.toString().toLowerCase() === jl.jumpOption.trim().toLowerCase()) {
                            return true;
                        }
                    } else if (jl.questionType === 'checkbox') {
                        if (answerValue.toString().toLowerCase() === jl.jumpOption.trim().toLowerCase()) {
                            return true;
                        }
                    }
                }
            }
            
            return false;
        }

        // Helper: wipe answers
        function wipeAnswers() {
            if (!isUserLoggedIn || !userId) return;
            db.collection('users').doc(userId).collection('formAnswers').doc(formId).delete();
        }

        // Attach listeners to all fields
        function attachAutosaveListeners() {
            const fields = getFormFields();
            fields.forEach(el => {
                el.addEventListener('input', function() {
                    if (isUserLoggedIn) {
                        saveAnswers();
                    } else {
                        saveAnswersToLocalStorage();
                    }
                    
                    // Update full name if first or last name changed
                    if (el.id === 'user_firstname' || el.id === 'user_lastname') {
                        if (typeof updateUserFullName === 'function') {
                            updateUserFullName();
                        }
                    }
                    
                    // Update address fields if any address field changed
                    if (el.id === 'user_street' || el.id === 'user_city' || el.id === 'user_state' || el.id === 'user_zip') {
                        if (typeof updateUserAddressFields === 'function') {
                            updateUserAddressFields();
                        }
                    }
                });
                el.addEventListener('change', function() {
                    if (isUserLoggedIn) {
                        saveAnswers();
                    } else {
                        saveAnswersToLocalStorage();
                    }
                    
                    // Update full name if first or last name changed
                    if (el.id === 'user_firstname' || el.id === 'user_lastname') {
                        if (typeof updateUserFullName === 'function') {
                            updateUserFullName();
                        }
                    }
                    
                    // Update address fields if any address field changed
                    if (el.id === 'user_street' || el.id === 'user_city' || el.id === 'user_state' || el.id === 'user_zip') {
                        if (typeof updateUserAddressFields === 'function') {
                            updateUserAddressFields();
                        }
                    }
                });
            });
            
            // Set up periodic autosave every 1 second
            setInterval(() => {
                if (isUserLoggedIn) {
                    saveAnswers();
                } else {
                    saveAnswersToLocalStorage();
                }
            }, 1000);
        }
        

























        
        // Cart Modal Logic - now handled by global functions outside Firebase IIFE

        // Helper: save answers to localStorage for non-logged-in users
        function saveAnswersToLocalStorage() {
            try {
                const fields = getFormFields();
                const answers = {};
                fields.forEach(el => {
                    if (el.type === 'checkbox') {
                        // For checkboxes, save true/false
                        answers[el.name] = el.checked;
                    } else if (el.type === 'radio') {
                        // For radio buttons, save the selected value or null if none selected
                        const selectedRadio = document.querySelector('input[name="' + el.name + '"]:checked');
                        answers[el.name] = selectedRadio ? selectedRadio.value : null;
                    } else {
                        // For other fields, save the value
                        answers[el.name] = el.value;
                    }
                });
                
                localStorage.setItem('formData_' + formId, JSON.stringify(answers));
            } catch (e) {
                console.log('Error saving to localStorage:', e);
            }
        }

        // Helper: load answers from localStorage for non-logged-in users
        function loadAnswersFromLocalStorage() {
            try {
                const savedData = localStorage.getItem('formData_' + formId);
                if (savedData) {
                    const data = JSON.parse(savedData);
                    const fields = getFormFields();
                    fields.forEach(el => {
                        if (data.hasOwnProperty(el.name)) {
                            if (el.type === 'checkbox') {
                                el.checked = !!data[el.name];
                            } else if (el.type === 'radio') {
                                // For radio buttons, set the value and check the matching radio button
                                if (data[el.name] && el.value === data[el.name]) {
                                    el.checked = true;
                            } else {
                                    el.checked = false;
                                }
                            } else {
                                // Skip current_date field and any field marked as protected - they should be set dynamically
                                if (el.id !== 'current_date' && el.name !== 'current_date' && !el.hasAttribute('data-protected')) {
                                el.value = data[el.name];
                                }
                            }
                        }
                    });
                    
                    // Update full name and address fields after autofilling with delay to ensure DOM is ready
                    setTimeout(() => {
                        if (typeof updateUserFullName === 'function') {
                            updateUserFullName();
                        }
                        if (typeof updateUserAddressFields === 'function') {
                            updateUserAddressFields();
                        }
                        // Always set current_date to today's date after autofill
                        if (typeof setCurrentDate === 'function') {
                            setCurrentDate();
                        }
                    }, 2000);
                    
                    // Trigger visibility updates for dependent questions
                    setTimeout(() => {
                        
                        // Trigger change events on all autofilled elements to ensure conditional logic runs
                        const fields = getFormFields();
                        fields.forEach(el => {
                            if (el.value || el.checked) {
                                const event = new Event('change', { bubbles: true });
                                el.dispatchEvent(event);
                            }
                        });
                        
                        // Also call the global visibility updates function
                        if (typeof triggerVisibilityUpdates === 'function') {
                            triggerVisibilityUpdates();
                        }
                        
                        // Trigger numbered dropdown textbox generation for any numbered dropdowns that were autofilled
                        fields.forEach(el => {
                            if (el.tagName === 'SELECT' && el.id.startsWith('answer') && el.value) {
                                const questionId = el.id.replace('answer', '');
                                if (typeof showTextboxLabels === 'function') {
                                    showTextboxLabels(questionId, el.value);
                                }
                                if (typeof updateHiddenCheckboxes === 'function') {
                                    updateHiddenCheckboxes(questionId, el.value);
                                }
                            }
                        });
                        
                        // Trigger state hidden field updates for any state dropdowns that were autofilled
                        fields.forEach(el => {
                            if (el.tagName === 'SELECT' && el.id && el.value && el.classList.contains('address-select')) {
                                // This is a state dropdown that was autofilled
                                const hiddenFullId = el.id + '_hidden'; // Add _hidden suffix to avoid conflict with dropdown
                                const hiddenShortId = window.toShortIdFromBase(el.id);
                                if (typeof updateStateHiddenFields === 'function') {
                                    updateStateHiddenFields(el, hiddenFullId, hiddenShortId);
                                }
                            }
                        });
                        
                        // Trigger hidden checkbox generation for any regular dropdowns that were autofilled
                        fields.forEach(el => {
                            if (el.tagName === 'SELECT' && el.id && !el.id.startsWith('answer') && el.value) {
                                if (typeof dropdownMirror === 'function') {
                                    dropdownMirror(el, el.id);
                                }
                                // Trigger hidden logic for autofilled dropdowns
                                if (typeof updateHiddenLogic === 'function') {
                                    updateHiddenLogic(el.id, el.value);
                                }
                            }
                        });
                        
                        // Create hidden checkboxes for all autofilled dropdowns
                        if (typeof createHiddenCheckboxesForAutofilledDropdowns === 'function') {
                            createHiddenCheckboxesForAutofilledDropdowns();
                        }
                        
                        // Trigger line splitting for autofilled textareas
                        triggerLineSplittingForAutofilledTextareas();
                        
                        // Trigger paragraph limit checking for autofilled textareas
                        triggerParagraphLimitCheckForAutofilledTextareas();
                        
                        // Second autofill pass for dynamically generated textbox inputs
                        // Use a longer delay to ensure textbox inputs are fully generated
                        setTimeout(() => {
                            const allFields = getFormFields();
                            
                            // Also try to find fields by ID directly as a fallback
                            const fieldsById = {};
                            allFields.forEach(el => {
                                if (el.id) {
                                    fieldsById[el.id] = el;
                                }
                            });
                            
                            allFields.forEach(el => {
                                if (data.hasOwnProperty(el.name)) {
                                    if (el.type === 'checkbox' || el.type === 'radio') {
                                        el.checked = !!data[el.name];
                                    } else {
                                        // Skip current_date field and any field marked as protected - they should be set dynamically
                                        if (el.id !== 'current_date' && el.name !== 'current_date' && !el.hasAttribute('data-protected')) {
                                        el.value = data[el.name];
                                        }
                                    }
                                }
                            });
                            
                            // Additional pass: try to autofill by ID for any fields that might have been missed
                            Object.keys(data).forEach(fieldName => {
                                const fieldById = fieldsById[fieldName];
                                if (fieldById && !fieldById.value && data[fieldName]) {
                                    if (fieldById.type === 'checkbox' || fieldById.type === 'radio') {
                                        fieldById.checked = !!data[fieldName];
                                    } else {
                                        fieldById.value = data[fieldName];
                                    }
                                }
                            });
                            
                            // Trigger line splitting again after the second autofill pass
                            triggerLineSplittingForAutofilledTextareas();
                            
                            // Trigger paragraph limit checking again after the second autofill pass
                            triggerParagraphLimitCheckForAutofilledTextareas();
                            
                            // Trigger state hidden field updates for any state dropdowns that were autofilled in second pass
                            allFields.forEach(el => {
                                if (el.tagName === 'SELECT' && el.id && el.value && el.classList.contains('address-select')) {
                                    // This is a state dropdown that was autofilled
                                    const hiddenFullId = el.id + '_hidden'; // Add _hidden suffix to avoid conflict with dropdown
                                    const hiddenShortId = window.toShortIdFromBase(el.id);
                                    if (typeof updateStateHiddenFields === 'function') {
                                        updateStateHiddenFields(el, hiddenFullId, hiddenShortId);
                                    }
                                }
                            });
                            
                            // Always set current_date to today's date after second autofill pass
                            if (typeof setCurrentDate === 'function') {
                                setCurrentDate();
                            }
                        }, 1500);
                    }, 2000);
                }
            } catch (e) {
                console.log('No localStorage data found or error loading:', e);
            }
        }

        // On auth state change
        firebase.auth().onAuthStateChanged(function(user) {
            isUserLoggedIn = !!user;
            userId = user ? user.uid : null;
            if (isUserLoggedIn) {
                const params = new URLSearchParams(window.location.search);
                if (params.get('payment') === 'success') {
                    console.log('Payment successful! Processing PDF...');
                    loadAnswers().then(() => {
                        processAllPdfs().then(() => {
                            wipeAnswers();
                            window.history.replaceState({}, document.title, "/" + pdfOutputFileName);
                            navigateSection('end');
                        });
                    });
                } else {
                    loadAnswers().then(attachAutosaveListeners);
                }
            } else {
                // For non-logged-in users, try to load from localStorage
                loadAnswersFromLocalStorage();
                attachAutosaveListeners();
            }
        });

        // Form submission now shows thank you message first, then user can continue to cart

        // Update cart count
        function updateCartCount() {
            const cartCountElement = document.getElementById('cart-count');
            if (cartCountElement && typeof getCartCount === 'function') {
                const count = getCartCount();
                cartCountElement.textContent = count;
                cartCountElement.style.display = count > 0 ? 'inline' : 'none';
            }
        }

        // Update cart count on page load and periodically
        document.addEventListener('DOMContentLoaded', function() {
            updateCartCount();
            // Update cart count every 5 seconds
            setInterval(updateCartCount, 5000);
        });
    });
})();

    // Header functionality
    document.addEventListener('DOMContentLoaded', function() {
        // Use existing Firebase instance instead of creating a new one
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            const auth = firebase.auth();
            const db = firebase.firestore();

            // Function to update button display based on auth state
            function updateAuthButtons(user) {
                const signInBtn = document.getElementById('sign-in-btn');
                const logoutBtn = document.getElementById('logout-btn');
                
                if (user) {
                    // User is signed in
                    if (signInBtn) signInBtn.style.display = 'none';
                    if (logoutBtn) logoutBtn.style.display = 'inline-block';
                } else {
                    // User is signed out
                    if (signInBtn) signInBtn.style.display = 'inline-block';
                    if (logoutBtn) logoutBtn.style.display = 'none';
                }
            }

            // Authentication state observer
            auth.onAuthStateChanged(function(user) {
                updateAuthButtons(user);
            });

            // Check current auth state immediately with a small delay to ensure Firebase is ready
            setTimeout(function() {
                const currentUser = auth.currentUser;
                updateAuthButtons(currentUser);
            }, 200);

            // Logout functionality
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    auth.signOut().then(function() {
                        window.location.href = '../Pages/index.html';
                    }).catch(function(error) {
                        console.error('Error signing out:', error);
                    });
                });
            }

            // Dropdown for Forms nav
            const formsWrapper = document.getElementById('forms-dropdown-wrapper');
            const formsLink = document.getElementById('forms-nav-link');
            const dropdownMenu = document.getElementById('forms-dropdown-menu');
            let dropdownOpen = false;

            function openDropdown() {
                formsWrapper.classList.add('open');
                dropdownOpen = true;
            }
            function closeDropdown() {
                formsWrapper.classList.remove('open');
                dropdownOpen = false;
            }
            if (formsLink) {
                formsLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    dropdownOpen ? closeDropdown() : openDropdown();
                });
            }
            document.addEventListener('mousedown', function(e) {
                if (formsWrapper && !formsWrapper.contains(e.target)) {
                    closeDropdown();
                }
            });
            // Keyboard accessibility
            if (formsLink) {
                formsLink.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        dropdownOpen ? closeDropdown() : openDropdown();
                    }
                });
            }

            // Update cart count badge in header
            function updateCartCountBadge() {
                const cartCountElement = document.getElementById('cart-count-badge');
                if (cartCountElement) {
                    let count = 0;
                    
                    // Try to get count from getCartCount function first
                    if (typeof getCartCount === 'function') {
                        count = getCartCount();
                    } else {
                        // Fallback to localStorage
                        try {
                            const cartData = localStorage.getItem('formwiz_cart');
                            if (cartData) {
                                const cart = JSON.parse(cartData);
                                count = Array.isArray(cart) ? cart.length : 0;
                            }
                        } catch (e) {
                            count = 0;
                        }
                    }
                    
                    // Always update the text content, even if count is 0
                    cartCountElement.textContent = count;
                    
                    if (count > 0) {
                        cartCountElement.style.display = 'flex';
                    } else {
                        cartCountElement.style.display = 'none';
                    }
                }
            }

            // Also update auth buttons when cart count updates
            function updateAuthButtonsAndCart() {
                const currentUser = auth.currentUser;
                updateAuthButtons(currentUser);
                updateCartCountBadge();
            }

            // Initialize auth buttons and cart count badge with a small delay to ensure DOM is ready
            setTimeout(updateAuthButtonsAndCart, 100);
            // Update more frequently to ensure cart count is always current
            setInterval(updateAuthButtonsAndCart, 2000);
            // Also update cart count immediately when page loads
            setTimeout(updateCartCountBadge, 500);

            // Sliding Cart Menu
            const cartIconLink = document.getElementById('cart-icon-link');
            const cartOverlay = document.getElementById('cart-overlay');
            const cartSideMenu = document.getElementById('cart-side-menu');
            const cartCloseBtn = document.getElementById('cart-close-btn');

            function openCart() {
                console.log('🛒 [CART MENU DEBUG] openCart called');
                cartOverlay.classList.add('active');
                cartSideMenu.classList.add('active');
                document.body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
                
                // Update cart content based on auth state
                updateCartContent();
            }

            function closeCart() {
                cartOverlay.classList.remove('active');
                cartSideMenu.classList.remove('active');
                document.body.style.overflow = ''; // Restore scrolling
            }

            if (cartIconLink) {
                cartIconLink.addEventListener('click', function(e) {
                    e.preventDefault();
                    console.log('🛒 [CART MENU DEBUG] Cart icon clicked');
                    openCart();
                });
            }

            if (cartCloseBtn) {
                cartCloseBtn.addEventListener('click', closeCart);
            }
            if (cartOverlay) {
                cartOverlay.addEventListener('click', function(e) {
                    if (e.target === cartOverlay) {
                        closeCart();
                    }
                });
            }

            // Update cart content based on authentication state
            function updateCartContent() {
                console.log('🛒 [CART MENU DEBUG] updateCartContent called');
                const cartMessage = document.getElementById('cart-message');
                const cartDescription = document.getElementById('cart-description');
                const cartSignupBtn = document.getElementById('cart-signup-btn');
                const cartItemsList = document.getElementById('cart-items-list');
                const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
                const cartIconLarge = document.querySelector('.cart-icon-large');
                
                console.log('🛒 [CART MENU DEBUG] auth.currentUser:', auth.currentUser);
                
                if (auth.currentUser) {
                    // User is signed in - show cart items
                    console.log('🛒 [CART MENU DEBUG] User is signed in, loading cart items');
                    if (cartMessage) cartMessage.textContent = 'Your Cart';
                    if (cartDescription) cartDescription.textContent = 'Review your selected forms and proceed to checkout.';
                    if (cartSignupBtn) cartSignupBtn.style.display = 'none';
                    if (cartIconLarge) cartIconLarge.textContent = '🛒';
                    
                    // Load and display cart items
                    loadCartItems();
                } else {
                    // User is not signed in - show signup message
                    console.log('🛒 [CART MENU DEBUG] User is not signed in, showing signup message');
                    if (cartMessage) cartMessage.textContent = 'Create an account to start shopping!';
                    if (cartDescription) cartDescription.textContent = 'To add forms to your cart and make purchases, you\\'ll need to create a FormWiz account. Sign up now to access our complete library of legal forms and start simplifying your paperwork.';
                    if (cartSignupBtn) cartSignupBtn.style.display = 'inline-block';
                    if (cartItemsList) cartItemsList.style.display = 'none';
                    if (cartCheckoutBtn) cartCheckoutBtn.style.display = 'none';
                    if (cartIconLarge) cartIconLarge.textContent = '🛒';
                }
            }
            
            // Load cart items for logged-in users
            async function loadCartItems() {
                console.log('🛒 [CART MENU DEBUG] loadCartItems called');
                const cartItemsList = document.getElementById('cart-items-list');
                const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
                
                if (!cartItemsList || !auth.currentUser) {
                    console.log('🛒 [CART MENU DEBUG] Missing cartItemsList or user not authenticated');
                    return;
                }
                
                try {
                    // Get cart data from cookies or localStorage
                    function getCookie(name) {
                        const value = '; ' + document.cookie;
                        const parts = value.split('; ' + name + '=');
                        if (parts.length === 2) return parts.pop().split(';').shift();
                        return null;
                    }
                    
                    const cartData = getCookie('formwiz_cart') || localStorage.getItem('formwiz_cart');
                    console.log('🛒 [CART MENU DEBUG] Raw cart data:', cartData);
                    let cart = [];
                    
                    if (cartData) {
                        try {
                            // Decode URL-encoded cart data if it comes from cookie
                            let decodedCartData = cartData;
                            if (cartData.startsWith('%')) {
                                decodedCartData = decodeURIComponent(cartData);
                                console.log('🛒 [CART MENU DEBUG] Decoded cart data:', decodedCartData);
                            }
                            cart = JSON.parse(decodedCartData);
                            console.log('🛒 [CART MENU DEBUG] Parsed cart:', cart);
                        } catch (e) {
                            console.error('Error parsing cart data:', e);
                        }
                    }
                    
                    if (cart.length === 0) {
                        console.log('🛒 [CART MENU DEBUG] Cart is empty, showing empty message');
                        cartItemsList.innerHTML = '<p style="color:#7f8c8d;font-style:italic;">Your cart is empty</p>';
                        cartItemsList.style.display = 'block';
                        if (cartCheckoutBtn) cartCheckoutBtn.style.display = 'none';
                        return;
                    }
                    
                    // Fetch Stripe prices for cart items
                    async function fetchStripePrice(priceId) {
                        try {
                            const response = await fetch('/stripe-price/' + priceId);
                            if (!response.ok) return null;
                            const data = await response.json();
                            return data && data.unit_amount != null ? (data.unit_amount / 100).toFixed(2) : null;
                        } catch (e) {
                            console.error('Error fetching Stripe price:', e);
                            return null;
                        }
                    }
                    
                    // Render cart items
                    let total = 0;
                    let itemsHtml = '';
                    let itemIndex = 0;
                    for (const item of cart) {
                        const price = await fetchStripePrice(item.priceId);
                        const itemPrice = price ? parseFloat(price) : 0;
                        total += itemPrice;
                        // Defendant and county fields
                        let defendantHtml = '';
                        let countyHtml = '';
                        if (item.defendantName) {
                            const capName = String(item.defendantName)
                              .split(/\s+/)
                              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                              .join(' ');
                            defendantHtml = '<div style=\\"color:#e74c3c;font-weight:600;\\">Defendant: ' + capName + '</div>';
                        }
                        if (item.countyName) {
                            const countyDisplay = item.countyName.toLowerCase().includes('county') ? item.countyName : item.countyName + ' County';
                            countyHtml = '<div style="color:#7f8c8d;">' + countyDisplay + '</div>';
                        }
                        // Use the proper display name instead of the filename
                        let displayTitle = item.title || 'Form';
                        if (item.formId === 'sc120' || item.formId === 'SC-120') {
                            displayTitle = 'SC-120';
                        } else if (item.formId === 'sc500' || item.formId === 'SC-500') {
                            displayTitle = 'SC-500';
                        }
                        
                        itemsHtml +=
     '<div class="cart-item">' +
       '<div class="cart-item-info">' +
         '<div class="cart-item-title">' + displayTitle + '</div>' +
         defendantHtml +
         countyHtml +
       '</div>' +
       '<div class="cart-item-price" style="margin-right: 12px;">$' + itemPrice.toFixed(2) + '</div>' +
       '<button class="remove-item" title="Remove" data-cart-index="' + itemIndex + '">' +
         '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M5 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path></svg>' +
       '</button>' +
     '</div>';
                        itemIndex++;
                    }
                    cartItemsList.innerHTML = itemsHtml;
                    cartItemsList.style.display = 'block';
                    // Remove item event listeners
                    const removeButtons = cartItemsList.querySelectorAll('.remove-item');
                    removeButtons.forEach(btn => {
                      btn.addEventListener('click', function(e) {
                        e.preventDefault();
                        const idx = parseInt(btn.getAttribute('data-cart-index'));
                        if (!isNaN(idx)) {
                          cart.splice(idx, 1);
                          // Save updated cart
                          document.cookie = 'formwiz_cart=' + encodeURIComponent(JSON.stringify(cart)) + ';path=/;max-age=2592000';
                          localStorage.setItem('formwiz_cart', JSON.stringify(cart));
                          loadCartItems();
                        }
                      });
                    });
                    if (cartCheckoutBtn) {
                        cartCheckoutBtn.textContent = 'Checkout - $' + total.toFixed(2);
                        cartCheckoutBtn.style.display = 'block';
                        cartCheckoutBtn.onclick = function() {
                            window.location.href = '../Pages/cart.html';
                        };
                    }
                } catch (error) {
                    console.error('Error loading cart items:', error);
                    cartItemsList.innerHTML = '<p style="color:#e74c3c;">Error loading cart items</p>';
                    cartItemsList.style.display = 'block';
                }
            }

            // Keyboard accessibility for cart menu
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    closeCart();
                }
            });
        }
    });

// Helper function to create styled address input
function createAddressInput(id, label, index, type = 'text') {
    const inputType = type === 'number' ? 'number' : 'text';
    const placeholder = label; // Remove the index number from placeholder
    
    return '<div class="address-field">' +
           '<input type="' + inputType + '" ' +
           'id="' + id + '" ' +
           'name="' + id + '" ' +
           'placeholder="' + placeholder + '" ' +
           'class="address-input">' +
           '</div>';
}

</script>

<!-- Debug Menu -->
<div id="debugMenu" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 99999; font-family: 'Montserrat', sans-serif;">
  <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); width: 90%; max-width: 800px; max-height: 80%; overflow: hidden; display: flex; flex-direction: column;">
    <!-- Header -->
    <div style="background: linear-gradient(90deg, #4f8cff 0%, #38d39f 100%); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; position: relative;">
      <h2 style="margin: 0; font-size: 1.5em; font-weight: 700;">🔍 Form Debug Menu</h2>
      <button id="closeDebugMenu" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: white; font-size: 1.5em; cursor: pointer; padding: 5px; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center;">&times;</button>
    </div>
    
    <!-- Search Bar -->
    <div style="padding: 20px; border-bottom: 1px solid #eee;">
      <input type="text" id="debugSearch" placeholder="Search inputs by name, ID, or value... (supports partial word matching)" style="width: 100%; padding: 12px 16px; border: 2px solid #e0e7ef; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
      
      <!-- Filter Controls -->
      <div style="display: flex; gap: 15px; margin-top: 15px; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <label for="debugTypeFilter" style="display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; font-size: 14px;">Filter by Type:</label>
          <select id="debugTypeFilter" style="width: 100%; padding: 10px 12px; border: 2px solid #e0e7ef; border-radius: 8px; font-size: 14px; background: white; cursor: pointer;">
            <option value="">All Types</option>
            <option value="text">📝 Text Inputs</option>
            <option value="email">📧 Email Inputs</option>
            <option value="tel">📞 Phone Inputs</option>
            <option value="number">🔢 Number Inputs</option>
            <option value="date">📅 Date Inputs</option>
            <option value="textarea">📄 Text Areas</option>
            <option value="checkbox">☑️ Checkboxes</option>
            <option value="radio">🔘 Radio Buttons</option>
            <option value="hidden">🔒 Hidden Fields</option>
          </select>
        </div>
        <div style="flex-shrink: 0;">
        <button id="exportNamesIdsBtn" style="background: linear-gradient(90deg, #4f8cff 0%, #38d39f 100%); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(79, 140, 255, 0.3);">
          📋 Export Names/IDs
        </button>
        </div>
      </div>
    </div>
    
    <!-- Content -->
    <div id="debugContent" style="flex: 1; overflow-y: auto; padding: 20px;">
      <!-- Content will be populated by JavaScript -->
    </div>
  </div>
</div>

<script>
// Debug Menu Functionality
let debugMenuVisible = false;

// Show debug menu on Ctrl+Shift
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && !debugMenuVisible) {
    e.preventDefault();
    showDebugMenu();
  }
});

// Close debug menu
document.getElementById('closeDebugMenu').addEventListener('click', hideDebugMenu);

// Click-outside-to-close functionality
document.addEventListener('click', function(event) {
  const debugMenu = document.getElementById('debugMenu');
  
  // If debug menu is visible
  if (debugMenuVisible) {
    // Check if click is on the overlay background (not on the content area)
    if (event.target === debugMenu) {
      hideDebugMenu();
    }
  }
});

// Close on escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && debugMenuVisible) {
    hideDebugMenu();
  }
});

// Tab key navigation - automatically press next button, submit, or download PDFs
document.addEventListener('keydown', function(e) {
  if (e.key === 'Tab') {
    e.preventDefault(); // Prevent default tab behavior
    
    // Check if we're on the thank you screen
    const thankYouMessage = document.getElementById('thankYouMessage');
    if (thankYouMessage && thankYouMessage.style.display !== 'none') {
      // On thank you screen, press download PDFs button
      const downloadButton = document.querySelector('button[onclick="downloadAllPdfs()"]');
      if (downloadButton) {
        downloadButton.click();
        return;
      }
    }
    
    // Look for the next button in the current section
    const nextButton = document.querySelector('.next-button:not([style*="display: none"])');
    if (nextButton) {
      nextButton.click();
      return;
    }
    
    // Look for submit button
    const submitButton = document.querySelector('button[type="submit"]:not([style*="display: none"])');
    if (submitButton) {
      submitButton.click();
      return;
    }
    
    // Look for any button with "submit" in its text or onclick
    const submitButtons = document.querySelectorAll('button');
    for (let button of submitButtons) {
      if (button.style.display !== 'none' && 
          (button.textContent.toLowerCase().includes('submit') || 
           button.onclick && button.onclick.toString().includes('submit'))) {
        button.click();
        return;
      }
    }
    
    // If no submit button found, look for download PDFs button
    const downloadPdfButton = document.querySelector('button[onclick*="downloadAllPdfs"]');
    if (downloadPdfButton) {
      downloadPdfButton.click();
      return;
    }
    
  }
});

// Removed click-outside-to-close functionality - user must use X button

function showDebugMenu() {
  debugMenuVisible = true;
  document.getElementById('debugMenu').style.display = 'block';
  populateDebugContent();
  document.getElementById('debugSearch').focus();
}

function hideDebugMenu() {
  debugMenuVisible = false;
  document.getElementById('debugMenu').style.display = 'none';
}

// Add virtual checkbox entries for dropdown questions
function addVirtualDropdownCheckboxes(inputData) {
  // Find all dropdown/select elements
  const dropdowns = document.querySelectorAll('select');
  
  dropdowns.forEach(dropdown => {
    if (!dropdown.id) return;
    
    // Skip debug-related dropdowns
    if (dropdown.id.startsWith('debug')) return;
    
    // Check if this is a numbered dropdown
    const isNumberedDropdown = dropdown.id.startsWith('answer') && dropdown.querySelector('option[value="1"]');
    
    if (isNumberedDropdown) {
      // Handle numbered dropdown - generate all possible textbox label combinations
      addNumberedDropdownVirtualEntries(inputData, dropdown);
    } else {
      // Handle regular dropdown - generate checkbox combinations
      addRegularDropdownVirtualEntries(inputData, dropdown);
    }
  });
}

// Create a hidden checkbox in the DOM for virtual checkboxes that should be checked
function createHiddenCheckbox(checkboxId, checkboxName, baseName) {
  // Find the dropdown wrapper or create a container
  let wrap = document.getElementById("dropdowntext_" + baseName);
  if (!wrap) {
    // If no wrapper exists, create one
    wrap = document.createElement("div");
    wrap.id = "dropdowntext_" + baseName;
    wrap.style.display = "none";
    
    // Find the dropdown element and insert the wrapper after it
    const dropdown = document.getElementById(baseName);
    if (dropdown && dropdown.parentNode) {
      dropdown.parentNode.insertBefore(wrap, dropdown.nextSibling);
    } else {
      // Fallback: append to body
      document.body.appendChild(wrap);
    }
  }
  
  // Create the hidden checkbox
  const checkboxDiv = document.createElement("div");
  checkboxDiv.style.display = "none";
  checkboxDiv.innerHTML = "<input type='checkbox' id='" + checkboxId + "' name='" + checkboxName + "' checked>" +
                   "<label for='" + checkboxId + "'> " + checkboxName + "</label>";
  
  wrap.appendChild(checkboxDiv);
}

// Create real hidden checkboxes for all autofilled dropdowns
function createHiddenCheckboxesForAutofilledDropdowns() {
  
  // Find all dropdown/select elements
  const dropdowns = document.querySelectorAll('select');
  
  dropdowns.forEach(dropdown => {
    if (!dropdown.id || dropdown.id.startsWith('answer')) return; // Skip numbered dropdowns
    
    const baseName = dropdown.id;
    const selectedValue = dropdown.value.trim();
    
    if (selectedValue) {
      // Generate checkbox ID using the same pattern as dropdownMirror
      const idSuffix = selectedValue.replace(/\W+/g, "_").toLowerCase();
      const checkboxId = baseName + "_" + idSuffix;
      const checkboxName = baseName + "_" + idSuffix;
      
      // Check if this checkbox already exists
      const existingCheckbox = document.getElementById(checkboxId);
      if (!existingCheckbox) {
        createHiddenCheckbox(checkboxId, checkboxName, baseName);
      }
      
      // Handle custom hidden logic for this dropdown
      updateHiddenLogic(baseName, selectedValue);
    }
  });
}

// Add virtual entries for regular dropdowns (checkbox combinations)
function addRegularDropdownVirtualEntries(inputData, dropdown) {
  const baseName = dropdown.id;
  const options = dropdown.querySelectorAll('option[value]:not([value=""])');
  
  options.forEach(option => {
    const optionValue = option.value.trim();
    if (!optionValue) return;
    
    // Generate checkbox ID using the same pattern as dropdownMirror
    const idSuffix = optionValue.replace(/\W+/g, "_").toLowerCase();
    const checkboxId = baseName + "_" + idSuffix;
    const checkboxName = baseName + "_" + idSuffix;
    
    // Check if this virtual checkbox already exists in inputData
    const exists = inputData.some(item => item.id === checkboxId);
    
    if (!exists) {
      // Check if this checkbox actually exists in the DOM (user selected this option)
      const actualCheckbox = document.getElementById(checkboxId);
      // Also check if the dropdown value matches this option (for autofilled dropdowns)
      const isChecked = actualCheckbox ? actualCheckbox.checked : (dropdown.value === optionValue);
      
      // If the virtual checkbox should be checked, create the actual hidden checkbox in the DOM
      if (isChecked && !actualCheckbox) {
        createHiddenCheckbox(checkboxId, checkboxName, baseName);
      }
      
      // Add virtual checkbox entry
      inputData.push({
        id: checkboxId,
        name: checkboxName,
        value: isChecked,
        type: 'input',
        inputType: 'checkbox',
        placeholder: '',
        required: false,
        isVirtual: !actualCheckbox, // Only virtual if it doesn't exist in DOM
        dropdownSource: dropdown.id,
        optionValue: optionValue
      });
    }
  });
}

// Add virtual entries for numbered dropdowns (textbox label combinations)
function addNumberedDropdownVirtualEntries(inputData, dropdown) {
  // Extract question ID from dropdown ID (e.g., "answer123" -> "123")
  const questionId = dropdown.id.replace('answer', '');
  
  // Get the question's Node ID from the question text (this is the base we should use)
  const questionH3 = document.getElementById("question-container-" + questionId)?.querySelector("h3")?.textContent;
  const questionNodeId = questionH3 ? sanitizeQuestionText(questionH3) : dropdown.id;
  
  // Get the range from the dropdown options
  const options = dropdown.querySelectorAll('option[value]:not([value=""])');
  let maxRange = 0;
  options.forEach(option => {
    const value = parseInt(option.value);
    if (!isNaN(value) && value > maxRange) {
      maxRange = value;
    }
  });
  
  // Get label information from the global maps
  const labelVals = labelMap[questionId] || [];
  const labelNodeIds = window.labelNodeIdsMap && window.labelNodeIdsMap[questionId] ? window.labelNodeIdsMap[questionId] : [];
  
  
  // Generate all possible combinations
  for (let j = 1; j <= maxRange; j++) {
    // Add textbox label combinations
    for (let lblIndex = 0; lblIndex < labelVals.length; lblIndex++) {
      const lbl = labelVals[lblIndex];
      const labelNodeId = labelNodeIds[lblIndex] || "";
      
      // Use label node ID if provided, otherwise use question Node ID + label + number
      const id = labelNodeId ? 
        labelNodeId + "_" + j : 
        questionNodeId + "_" + j + "_" + sanitizeQuestionText(lbl);
      
      // Check if this virtual input already exists in inputData
      const exists = inputData.some(item => item.id === id);
      
      if (!exists) {
        // Check if this input actually exists in the DOM
        const actualInput = document.getElementById(id);
        const value = actualInput ? actualInput.value : '';
        
        // Add virtual input entry
        inputData.push({
          id: id,
          name: id,
          value: value,
          type: 'input',
          inputType: 'text',
          placeholder: lbl + ' ' + j,
          required: false,
          isVirtual: true,
          dropdownSource: dropdown.id,
          optionValue: j.toString(),
          labelText: lbl
        });
      }
    }
    
    // Add hidden checkbox combinations (for the numbered dropdown hidden checkboxes)
    const checkboxId = questionNodeId + "_" + j;
    const checkboxExists = inputData.some(item => item.id === checkboxId);
    
    if (!checkboxExists) {
      // Check if this checkbox actually exists in the DOM
      const actualCheckbox = document.getElementById(checkboxId);
      const isChecked = actualCheckbox ? actualCheckbox.checked : false;
      
      // Add virtual checkbox entry
      inputData.push({
        id: checkboxId,
        name: checkboxId,
        value: isChecked,
        type: 'input',
        inputType: 'checkbox',
        placeholder: '',
        required: false,
        isVirtual: true,
        dropdownSource: dropdown.id,
        optionValue: j.toString(),
        labelText: 'Hidden checkbox for option ' + j
      });
    }
  }
}

function populateDebugContent() {
  const content = document.getElementById('debugContent');
  const searchTerm = document.getElementById('debugSearch').value.toLowerCase();
  const typeFilter = document.getElementById('debugTypeFilter').value;
  
  // Get all form inputs
  const inputs = document.querySelectorAll('input, select, textarea');
  const inputData = [];
  
  inputs.forEach(input => {
    // Include all inputs that have either an ID or a name (or both)
    // Exclude debugTypeFilter_* fields
    if ((input.id || input.name) && !input.id.startsWith('debugTypeFilter_')) {
      const value = input.type === 'checkbox' ? input.checked : input.value;
      const type = input.tagName.toLowerCase();
      const inputType = input.type || 'text';
      
      inputData.push({
        id: input.id || '',
        name: input.name || '',
        value: value,
        type: type,
        inputType: inputType,
        placeholder: input.placeholder || '',
        required: input.required
      });
    }
  });
  
  // Add virtual checkbox entries for dropdown questions
  addVirtualDropdownCheckboxes(inputData);
  
  // After potentially creating real checkboxes from virtual ones, re-scan the DOM to include them
  const updatedInputs = document.querySelectorAll('input, select, textarea');
  updatedInputs.forEach(input => {
    // Include all inputs that have either an ID or a name (or both)
    // Exclude debugTypeFilter_* fields
    if ((input.id || input.name) && !input.id.startsWith('debugTypeFilter_')) {
      // Check if this input is already in inputData
      const exists = inputData.some(item => item.id === input.id && item.name === input.name);
      if (!exists) {
        const value = input.type === 'checkbox' ? input.checked : input.value;
        const type = input.tagName.toLowerCase();
        const inputType = input.type || 'text';
        
        inputData.push({
          id: input.id || '',
          name: input.name || '',
          value: value,
          type: type,
          inputType: inputType,
          placeholder: input.placeholder || '',
          required: input.required
        });
      }
    }
  });
  
  // Filter by search term and type
  
  const filteredData = inputData.filter(item => {
    // First check type filter
    if (typeFilter) {
      let itemType = '';
      if (item.inputType === 'text' || item.inputType === 'email' || item.inputType === 'tel' || item.inputType === 'number' || item.inputType === 'date') {
        itemType = item.inputType;
      } else if (item.type === 'select') {
        itemType = 'text'; // Classify dropdowns as text inputs
      } else if (item.type === 'textarea') {
        itemType = 'textarea';
      } else if (item.inputType === 'checkbox') {
        itemType = 'checkbox';
      } else if (item.inputType === 'radio') {
        itemType = 'radio';
      } else if (item.inputType === 'hidden') {
        // Check if this is a state-related hidden field that should be grouped with text inputs
        if (item.id && (item.id.includes('_state') || item.id.includes('_state_short') || item.id.includes('_short_'))) {
          itemType = 'text'; // Classify state-related hidden fields as text inputs
        } else {
          itemType = 'hidden';
        }
      } else {
        itemType = 'text'; // Classify other inputs as text inputs
      }
      
      if (itemType !== typeFilter) {
        return false;
      }
    }
    
    // If no search term, return true (type filter already applied)
    if (!searchTerm) {
      return true;
    }
    
    // Helper function to check if all search words are found in text (partial word matching)
    function matchesPartialWords(searchWords, text) {
      if (!text || !searchWords.length) return false;
      
      const normalizedText = text.toLowerCase().replace(/[_\s]/g, ' ');
      const originalText = text.toLowerCase();
      
      return searchWords.every(word => {
        const normalizedWord = word.toLowerCase().replace(/[_\s]/g, ' ');
        // Check both normalized text (spaces) and original text (underscores)
        return normalizedText.includes(normalizedWord) || originalText.includes(word.toLowerCase());
      });
    }
    
    // Split search term into individual words for partial matching
    const searchWords = searchTerm.trim().split(/\s+/).filter(word => word.length > 0);
    
    // Get all text fields to search in
    const searchableTexts = [
      item.id,
      item.name,
      String(item.value),
      item.placeholder
    ].filter(text => text && text.length > 0);
    
    // Check if all search words are found in any of the searchable texts
    return searchableTexts.some(text => matchesPartialWords(searchWords, text));
  });
  
  // Group by type
  const grouped = {
    text: [],
    email: [],
    tel: [],
    number: [],
    date: [],
    select: [],
    textarea: [],
    checkbox: [],
    radio: [],
    hidden: [],
    other: []
  };
  
  // First pass: collect all visible field names to identify duplicates
  const visibleFieldNames = new Set();
  filteredData.forEach(item => {
    if (item.inputType !== 'hidden' && item.type !== 'hidden') {
      visibleFieldNames.add(item.name);
    }
  });

  filteredData.forEach(item => {
    // Skip hidden fields that have a corresponding visible field with the same name
    if (item.inputType === 'hidden' && visibleFieldNames.has(item.name)) {
      return; // Skip this hidden field
    }
    
    // Use the same logic as the filtering to determine the final itemType
    let itemType = '';
    if (item.inputType === 'text' || item.inputType === 'email' || item.inputType === 'tel' || item.inputType === 'number' || item.inputType === 'date') {
      itemType = item.inputType;
    } else if (item.type === 'select') {
      itemType = 'text'; // Classify dropdowns as text inputs
    } else if (item.type === 'textarea') {
      itemType = 'textarea';
    } else if (item.inputType === 'checkbox') {
      itemType = 'checkbox';
    } else if (item.inputType === 'radio') {
      itemType = 'radio';
    } else if (item.inputType === 'hidden') {
      // Check if this is a state-related hidden field that should be grouped with text inputs
      if (item.id && (item.id.includes('_state') || item.id.includes('_state_short'))) {
        itemType = 'text'; // Classify state-related hidden fields as text inputs
    } else {
        itemType = 'hidden';
      }
    } else {
      itemType = 'text'; // Classify other inputs as text inputs
    }
    
    // Group by the final itemType
    grouped[itemType].push(item);
  });
  
  // Generate HTML
  let html = '';
  
  const typeLabels = {
    text: '📝 Text Inputs',
    email: '📧 Email Inputs', 
    tel: '📞 Phone Inputs',
    number: '🔢 Number Inputs',
    date: '📅 Date Inputs',
    select: '📝 Text Inputs',
    textarea: '📄 Text Areas',
    checkbox: '☑️ Checkboxes',
    radio: '🔘 Radio Buttons',
    hidden: '🔒 Hidden Fields',
    other: '📝 Text Inputs'
  };
  
  Object.keys(grouped).forEach(type => {
    if (grouped[type].length > 0) {
      html += '<div style="margin-bottom: 30px;">';
      html += '<h3 style="color: #2c3e50; margin-bottom: 15px; font-size: 1.2em; border-bottom: 2px solid #e0e7ef; padding-bottom: 8px;">' + typeLabels[type] + ' (' + grouped[type].length + ')</h3>';
      
      grouped[type].forEach(item => {
        const valueDisplay = item.value === '' ? '<em style="color: #999;">(empty)</em>' : 
                           item.value === true ? '<span style="color: #38d39f;">✓ checked</span>' :
                           item.value === false ? '<span style="color: #e74c3c;">✗ unchecked</span>' :
                           '<span style="color: #2c3e50;">' + String(item.value).substring(0, 100) + (String(item.value).length > 100 ? '...' : '') + '</span>';
        
        const requiredBadge = item.required ? '<span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-left: 8px;">REQUIRED</span>' : '';
        const virtualBadge = item.isVirtual ? '<span style="background: #4f8cff; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-left: 8px;">VIRTUAL</span>' : '';
        
        // Determine the primary identifier (ID if available, otherwise name)
        const primaryId = item.id || item.name || 'unnamed';
        const displayId = item.id || '<em style="color: #999;">(no ID)</em>';
        const displayName = item.name || '<em style="color: #999;">(no name)</em>';
        
        html += '<div class="debug-entry" data-id="' + primaryId + '" style="background: #f8faff; border: 1px solid #e0e7ef; border-radius: 8px; padding: 15px; margin-bottom: 10px; transition: all 0.3s ease; cursor: pointer; position: relative;">' +
          '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">' +
            '<div style="flex: 1; min-width: 0;">' +
              '<strong style="color: #2c3e50; font-size: 1.1em; word-break: break-all; line-height: 1.3; display: block;">' + displayId + '</strong>' +
              requiredBadge + virtualBadge +
            '</div>' +
            '<span style="background: #e0e7ef; color: #2c3e50; padding: 4px 8px; border-radius: 4px; font-size: 0.9em; flex-shrink: 0; white-space: nowrap;">' + item.inputType + '</span>' +
          '</div>' +
          '<div style="margin-bottom: 5px;">' +
            '<span style="color: #666; font-size: 0.9em;">Name: </span>' +
            '<code style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; word-break: break-all; display: inline-block; max-width: 100%;">' + displayName + '</code>' +
          '</div>' +
          (item.placeholder ? '<div style="margin-bottom: 5px;"><span style="color: #666; font-size: 0.9em;">Placeholder: </span><span style="color: #999;">' + item.placeholder + '</span></div>' : '') +
          (item.isVirtual && item.dropdownSource ? '<div style="margin-bottom: 5px;"><span style="color: #666; font-size: 0.9em;">From Dropdown: </span><span style="color: #4f8cff; font-weight: bold;">' + item.dropdownSource + '</span> → <span style="color: #2c3e50;">' + item.optionValue + '</span></div>' : '') +
          '<div>' +
            '<span style="color: #666; font-size: 0.9em;">Value: </span>' +
            valueDisplay +
          '</div>' +
          '<div class="copy-indicator" style="position: absolute; top: 10px; right: 10px; background: #38d39f; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; opacity: 0; transform: scale(0.8); transition: all 0.3s ease;">COPIED!</div>' +
        '</div>';
      });
      
      html += '</div>';
    }
  });
  
  if (html === '') {
    html = '<div style="text-align: center; color: #666; padding: 40px;"><p>No inputs found matching your search.</p></div>';
  }
  
  content.innerHTML = html;
  
  // Add click event listeners to debug entries
  const debugEntries = content.querySelectorAll('.debug-entry');
  debugEntries.forEach(entry => {
    entry.addEventListener('click', function() {
      const id = this.getAttribute('data-id');
      copyToClipboard(id, this);
    });
    
    // Add hover effects
    entry.addEventListener('mouseenter', function() {
      this.style.background = '#f0f8ff';
      this.style.borderColor = '#4f8cff';
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 4px 12px rgba(79, 140, 255, 0.15)';
    });
    
    entry.addEventListener('mouseleave', function() {
      this.style.background = '#f8faff';
      this.style.borderColor = '#e0e7ef';
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = 'none';
    });
  });
}

// Copy to clipboard function
function copyToClipboard(text, element) {
  // Remove any existing copy highlights
  const allEntries = document.querySelectorAll('.debug-entry');
  allEntries.forEach(entry => {
    entry.style.background = '#f8faff';
    entry.style.borderColor = '#e0e7ef';
    entry.style.borderWidth = '1px';
    const indicator = entry.querySelector('.copy-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
      indicator.style.transform = 'scale(0.8)';
    }
  });
  
  // Highlight the clicked entry
  element.style.background = '#e8f5e8';
  element.style.borderColor = '#38d39f';
  element.style.borderWidth = '2px';
  
  // Show copy indicator
  const copyIndicator = element.querySelector('.copy-indicator');
  if (copyIndicator) {
    copyIndicator.style.opacity = '1';
    copyIndicator.style.transform = 'scale(1)';
  }
  
  // Copy to clipboard
  if (navigator.clipboard && window.isSecureContext) {
    // Use modern clipboard API
    navigator.clipboard.writeText(text).then(() => {
      console.log('Copied to clipboard:', text);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      fallbackCopyToClipboard(text);
    });
  } else {
    // Fallback for older browsers
    fallbackCopyToClipboard(text);
  }
  
  // Reset highlight after 2 seconds
  setTimeout(() => {
    element.style.background = '#f8faff';
    element.style.borderColor = '#e0e7ef';
    element.style.borderWidth = '1px';
    if (copyIndicator) {
      copyIndicator.style.opacity = '0';
      copyIndicator.style.transform = 'scale(0.8)';
    }
  }, 2000);
}

// Fallback copy function for older browsers
function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    console.log('Copied to clipboard (fallback):', text);
  } catch (err) {
    console.error('Fallback copy failed: ', err);
  }
  
  document.body.removeChild(textArea);
}

// Export Names/IDs function
function exportNamesAndIds() {
  // Get form name from the form name input field
  const formNameEl = document.getElementById('formNameInput');
  const formName = formNameEl && formNameEl.value.trim() ? formNameEl.value.trim() : 'Example Form';
  
  const formData = {
    exportDate: new Date().toISOString(),
    formName: formName,
    formTitle: document.title || 'Form Data',
    inputs: []
  };
  
  // Get all form inputs
  const inputs = document.querySelectorAll('input, select, textarea');
  
  inputs.forEach((input, index) => {
    // Only include inputs that have an ID
    if (input.id) {
      const inputData = {
        id: input.id
      };
      formData.inputs.push(inputData);
    }
  });
  
  // Create and download JSON file
  const jsonString = JSON.stringify(formData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'form-names-ids-' + new Date().toISOString().split('T')[0] + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // Show success message
  const button = document.getElementById('exportNamesIdsBtn');
  const originalText = button.textContent;
  button.textContent = '✅ Exported!';
  button.style.background = 'linear-gradient(90deg, #38d39f 0%, #4f8cff 100%)';
  
  setTimeout(() => {
    button.textContent = originalText;
    button.style.background = 'linear-gradient(90deg, #4f8cff 0%, #38d39f 100%)';
  }, 2000);
}

// Search functionality
document.getElementById('debugSearch').addEventListener('input', populateDebugContent);

// Type filter functionality
document.getElementById('debugTypeFilter').addEventListener('change', populateDebugContent);

// Export Names/IDs functionality
document.getElementById('exportNamesIdsBtn').addEventListener('click', exportNamesAndIds);

// Function to create Form Name input field (to be called from the form editor interface)
function createFormNameInput() {
  const formNameContainer = document.createElement('div');
  formNameContainer.id = 'formNameContainer';
  formNameContainer.style.cssText = 
    'background: #fff; ' +
    'border: 2px solid #2980b9; ' +
    'border-radius: 10px; ' +
    'padding: 20px; ' +
    'margin: 20px auto; ' +
    'max-width: 600px; ' +
    'box-shadow: 0 4px 12px rgba(0,0,0,0.1);';
  
  formNameContainer.innerHTML = 
    '<h3 style="text-align: center; margin-bottom: 15px; color: #2c3e50; font-size: 1.3em;">Form Name</h3>' +
    '<div style="text-align: center;">' +
      '<label for="formNameInput" style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">Form Name:</label>' +
      '<input type="text" id="formNameInput" name="formNameInput" ' +
             'placeholder="Enter your form name (e.g., Customer Survey, Job Application)" ' +
             'style="width: 100%; max-width: 400px; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; text-align: center;" ' +
             'value="Example Form">' +
      '<p style="margin-top: 8px; font-size: 0.9em; color: #666; font-style: italic;">' +
        'This name will appear in the browser title and be used for the default checkbox.' +
      '</p>' +
    '</div>';
  
  return formNameContainer;
}

// Function to insert Form Name input above the first section
function insertFormNameInput() {
  // Check if form name input already exists
  if (document.getElementById('formNameContainer')) {
    return; // Already exists
  }
  
  // Find the first section or a suitable insertion point
  const firstSection = document.querySelector('[id^="sectionBlock"]');
  const formNameInput = createFormNameInput();
  
  if (firstSection) {
    firstSection.parentNode.insertBefore(formNameInput, firstSection);
  } else {
    // If no sections found, append to body or a container
    const container = document.querySelector('#formEditor') || document.body;
    container.insertBefore(formNameInput, container.firstChild);
  }
}

// Update content when form values change
document.addEventListener('input', function() {
  if (debugMenuVisible) {
    populateDebugContent();
  }
});

document.addEventListener('change', function() {
  if (debugMenuVisible) {
    populateDebugContent();
  }
});

// Function to update hidden state fields when dropdown selection changes
function updateStateHiddenFields(dropdown, hiddenFullId, hiddenShortId) {
    
    const selectedState = dropdown.value;
    
    const fullField = document.getElementById(hiddenFullId);
    const shortField = document.getElementById(hiddenShortId);
    
    
    // State abbreviation mapping
    const stateAbbreviations = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO',
        'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
        'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
        'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
        'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
        'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
        'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
        'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
    };
    
    if (fullField && shortField) {
        if (selectedState) {
            const abbreviation = stateAbbreviations[selectedState] || '';
            fullField.value = selectedState;
            shortField.value = abbreviation;
        } else {
            fullField.value = '';
            shortField.value = '';
        }
    } else {
    }
}

// Function to update user full name
function updateUserFullName() {
  console.log('🔍 [UPDATE FULL NAME DEBUG] updateUserFullName() called');
  
  const firstNameField = document.getElementById('user_firstname');
  const lastNameField = document.getElementById('user_lastname');
  const fullNameField = document.getElementById('user_fullname');
  
  console.log('🔍 [UPDATE FULL NAME DEBUG] Field elements found:');
  console.log('  - firstNameField:', !!firstNameField, firstNameField ? 'value: "' + firstNameField.value + '"' : 'not found');
  console.log('  - lastNameField:', !!lastNameField, lastNameField ? 'value: "' + lastNameField.value + '"' : 'not found');
  console.log('  - fullNameField:', !!fullNameField, fullNameField ? 'current value: "' + fullNameField.value + '"' : 'not found');
  
  const firstName = firstNameField?.value || '';
  const lastName = lastNameField?.value || '';
  
  console.log('🔍 [UPDATE FULL NAME DEBUG] Extracted values:');
  console.log('  - firstName:', '"' + firstName + '"');
  console.log('  - lastName:', '"' + lastName + '"');
  
  if (fullNameField) {
    // Simply combine first and last name with a space
    const fullName = (firstName + ' ' + lastName).trim();
    console.log('🔍 [UPDATE FULL NAME DEBUG] Setting fullName to:', '"' + fullName + '"');
    fullNameField.value = fullName;
    
    // Verify the value was set
    console.log('🔍 [UPDATE FULL NAME DEBUG] fullNameField.value after setting:', '"' + fullNameField.value + '"');
  } else {
    console.log('🔍 [UPDATE FULL NAME DEBUG] fullNameField not found - cannot update');
  }
}

// Function to update user address fields
function updateUserAddressFields() {
  const street = document.getElementById('user_street')?.value || '';
  const city = document.getElementById('user_city')?.value || '';
  const state = document.getElementById('user_state')?.value || '';
  const zip = document.getElementById('user_zip')?.value || '';
  
  const streetHidden = document.getElementById('user_street_hidden');
  const cityHidden = document.getElementById('user_city_hidden');
  const stateHidden = document.getElementById('user_state_hidden');
  const zipHidden = document.getElementById('user_zip_hidden');
  
  if (streetHidden) streetHidden.value = street;
  if (cityHidden) cityHidden.value = city;
  if (stateHidden) stateHidden.value = state;
  if (zipHidden) zipHidden.value = zip;
}

// Add event listeners for first and last name fields
document.addEventListener('DOMContentLoaded', function() {
  const firstNameField = document.getElementById('user_firstname');
  const lastNameField = document.getElementById('user_lastname');
  
  if (firstNameField) {
    firstNameField.addEventListener('input', updateUserFullName);
    firstNameField.addEventListener('change', updateUserFullName);
  }
  
  if (lastNameField) {
    lastNameField.addEventListener('input', updateUserFullName);
    lastNameField.addEventListener('change', updateUserFullName);
  }
  
  // Add event listeners for address fields
  const streetField = document.getElementById('user_street');
  const cityField = document.getElementById('user_city');
  const stateField = document.getElementById('user_state');
  const zipField = document.getElementById('user_zip');
  
  if (streetField) {
    streetField.addEventListener('input', updateUserAddressFields);
    streetField.addEventListener('change', updateUserAddressFields);
  }
  
  if (cityField) {
    cityField.addEventListener('input', updateUserAddressFields);
    cityField.addEventListener('change', updateUserAddressFields);
  }
  
  if (stateField) {
    stateField.addEventListener('input', updateUserAddressFields);
    stateField.addEventListener('change', updateUserAddressFields);
  }
  
  if (zipField) {
    zipField.addEventListener('input', updateUserAddressFields);
    zipField.addEventListener('change', updateUserAddressFields);
  }
  
  // Set user_fullname and address fields 2 seconds after page loads to ensure all autopopulation is complete
  setTimeout(() => {
    updateUserFullName();
    updateUserAddressFields();
  }, 2000);
});
           
</script>

</body>
</html>
`;

  // Add script to set up address listeners for multipleTextboxes after DOM loads
  formHTML += `
  <script>
  // Include the generateHiddenAddressTextboxes function and helpers in the runtime
  function generateHiddenAddressTextboxes(questionId, count, allFieldsInOrder) {
      console.log('🔧 [HIDDEN ADDRESS DEBUG] generateHiddenAddressTextboxes called with questionId:', questionId, 'count:', count);
      console.log('🔧 [HIDDEN ADDRESS DEBUG] allFieldsInOrder:', allFieldsInOrder);
      
      // Check if this question has location fields (Street, City, State, Zip)
      const hasLocationFields = allFieldsInOrder.some(field => 
          ['Street', 'City', 'State', 'Zip'].includes(field.label)
      );
      
      console.log('🔧 [HIDDEN ADDRESS DEBUG] hasLocationFields:', hasLocationFields);
      
      if (!hasLocationFields) {
          console.log('🔧 [HIDDEN ADDRESS] No location fields found for question', questionId);
          return;
      }
      
      // Get the base field name from the question
      const baseFieldName = questionNameIds[questionId] || 'answer' + questionId;
      
      // Remove existing hidden address textboxes for this question
      for (let i = 1; i <= 10; i++) { // Check up to 10 entries
          const existingAddress = document.getElementById(baseFieldName + '_address_' + i);
          if (existingAddress && existingAddress.type === 'text' && existingAddress.style.display === 'none') {
              existingAddress.remove();
          }
      }
      
      // Generate hidden address textboxes for the selected count
      for (let i = 1; i <= count; i++) {
          // For single-entry questions (like multipleTextboxes), don't add number suffix
          const addressId = count === 1 ? baseFieldName + '_address' : baseFieldName + '_address_' + i;
          const addressInput = document.createElement('input');
          addressInput.type = 'text';
          addressInput.id = addressId;
          addressInput.name = addressId;
          addressInput.style.display = 'none';
          
          // Add to hidden fields container
          const hiddenContainer = document.getElementById('hidden_pdf_fields');
          if (hiddenContainer) {
              hiddenContainer.appendChild(addressInput);
          }
          
          // Set up event listeners to update the address when location fields change
          // Delay this to ensure location fields are created first
          setTimeout(() => {
              setupAddressUpdateListeners(questionId, i, baseFieldName, allFieldsInOrder, count);
          }, 1000); // 1 second delay to ensure fields are created
      }
  }

  function setupAddressUpdateListeners(questionId, entryNumber, baseFieldName, allFieldsInOrder, count = 1) {
      // For single-entry questions (like multipleTextboxes), don't add number suffix
      const addressId = count === 1 ? baseFieldName + '_address' : baseFieldName + '_address_' + entryNumber;
      const addressInput = document.getElementById(addressId);
      
      if (!addressInput) return;
      
      // Function to update the address field
      const updateAddress = () => {
          // For single-entry questions, don't add number suffix to field IDs
          const streetFieldId = count === 1 ? baseFieldName + '_street' : baseFieldName + '_street_' + entryNumber;
          const cityFieldId = count === 1 ? baseFieldName + '_city' : baseFieldName + '_city_' + entryNumber;
          const stateFieldId = count === 1 ? baseFieldName + '_state' : baseFieldName + '_state_' + entryNumber;
          const zipFieldId = count === 1 ? baseFieldName + '_zip' : baseFieldName + '_zip_' + entryNumber;
          const stateShortFieldId = count === 1 ? baseFieldName + '_state_short' : baseFieldName + '_state_short_' + entryNumber;
          
          const streetField = document.getElementById(streetFieldId);
          const cityField = document.getElementById(cityFieldId);
          const stateField = document.getElementById(stateFieldId);
          const zipField = document.getElementById(zipFieldId);
          const stateShortField = document.getElementById(stateShortFieldId);
          
          // Debug: Log what fields we're looking for and what we found
          console.log('🔧 [HIDDEN ADDRESS DEBUG] Looking for fields:');
          console.log('  - Street field ID:', streetFieldId, 'Found:', !!streetField, 'Value:', streetField ? streetField.value : 'N/A');
          console.log('  - City field ID:', cityFieldId, 'Found:', !!cityField, 'Value:', cityField ? cityField.value : 'N/A');
          console.log('  - State field ID:', stateFieldId, 'Found:', !!stateField, 'Value:', stateField ? stateField.value : 'N/A');
          console.log('  - Zip field ID:', zipFieldId, 'Found:', !!zipField, 'Value:', zipField ? zipField.value : 'N/A');
          console.log('  - State Short field ID:', stateShortFieldId, 'Found:', !!stateShortField, 'Value:', stateShortField ? stateShortField.value : 'N/A');
          
          const street = streetField ? streetField.value.trim() : '';
          const city = cityField ? cityField.value.trim() : '';
          const state = stateShortField ? stateShortField.value.trim() : (stateField ? stateField.value.trim() : '');
          const zip = zipField ? zipField.value.trim() : '';
          
          // Build the full address
          const addressParts = [street, city, state, zip].filter(part => part !== '');
          const fullAddress = addressParts.join(', ');
          
          addressInput.value = fullAddress;
      };
      
      // Set up listeners for all location fields
      const locationFields = ['street', 'city', 'state', 'zip', 'state_short'];
      
      locationFields.forEach(fieldType => {
          // For single-entry questions, don't add number suffix to field IDs
          const fieldId = count === 1 ? baseFieldName + '_' + fieldType : baseFieldName + '_' + fieldType + '_' + entryNumber;
          const field = document.getElementById(fieldId);
          
          
          if (field) {
              // Listen for input changes
              field.addEventListener('input', updateAddress);
              field.addEventListener('change', updateAddress);
          } else {
              console.log('🔧 [HIDDEN ADDRESS DEBUG] Field not found:', fieldId);
          }
      });
      
      // Initial update with longer delay to ensure fields are created
      setTimeout(updateAddress, 500);
      
      // Also trigger update after autofill completes (additional safety)
      setTimeout(updateAddress, 2000);
  }

  // Set up number input listeners for PDF logic after DOM loads
  document.addEventListener('DOMContentLoaded', function() {
    // Find all number input fields and add PDF logic listeners
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
      input.addEventListener('input', function() {
        // Trigger PDF logic check when number input changes
        if (typeof window.pdfLogicPDFs !== 'undefined' && window.pdfLogicPDFs.length > 0) {
          // Find the question ID for this input
          const questionId = input.id.replace(/^answer/, '');
          const matchingPdfLogic = window.pdfLogicPDFs.find(pdf => pdf.questionId === questionId);
          
          if (matchingPdfLogic && matchingPdfLogic.numberTrigger && matchingPdfLogic.numberValue) {
            // Trigger cart update to check PDF logic
            if (typeof updateCartCountBadge === 'function') {
              updateCartCountBadge();
            }
          }
        }
      });
      
      input.addEventListener('change', function() {
        // Also trigger on change event
        if (typeof window.pdfLogicPDFs !== 'undefined' && window.pdfLogicPDFs.length > 0) {
          const questionId = input.id.replace(/^answer/, '');
          const matchingPdfLogic = window.pdfLogicPDFs.find(pdf => pdf.questionId === questionId);
          
          if (matchingPdfLogic && matchingPdfLogic.numberTrigger && matchingPdfLogic.numberValue) {
            if (typeof updateCartCountBadge === 'function') {
              updateCartCountBadge();
            }
          }
        }
      });
    });
  });

  // Set up address listeners for multipleTextboxes questions after DOM loads
  document.addEventListener('DOMContentLoaded', function() {
    // Find all multipleTextboxes questions with location fields
    const multipleTextboxesQuestions = document.querySelectorAll('[id*="labelContainer"]');
    multipleTextboxesQuestions.forEach(container => {
      const questionId = container.id.replace('labelContainer', '');
      const baseFieldName = questionNameIds[questionId] || 'answer' + questionId;
      const addressField = document.getElementById(baseFieldName + '_address');
      
      if (addressField) {
        console.log('🔧 [HIDDEN ADDRESS] Setting up listeners for multipleTextboxes question:', questionId);
        
        // Set up listeners for location fields
        const locationFields = ['street', 'city', 'state', 'zip', 'state_short'];
        locationFields.forEach(fieldType => {
          const fieldId = baseFieldName + '_' + fieldType;
          const field = document.getElementById(fieldId);
          
          if (field) {
            const updateAddress = () => {
              const streetField = document.getElementById(baseFieldName + '_street');
              const cityField = document.getElementById(baseFieldName + '_city');
              const stateField = document.getElementById(baseFieldName + '_state');
              const zipField = document.getElementById(baseFieldName + '_zip');
              const stateShortField = document.getElementById(baseFieldName + '_state_short');
              
              console.log('🔧 [HIDDEN ADDRESS DEBUG] Looking for fields:');
              console.log('  - Street field ID:', baseFieldName + '_street', 'Found:', !!streetField, 'Value:', streetField ? streetField.value : 'N/A');
              console.log('  - City field ID:', baseFieldName + '_city', 'Found:', !!cityField, 'Value:', cityField ? cityField.value : 'N/A');
              console.log('  - State field ID:', baseFieldName + '_state', 'Found:', !!stateField, 'Value:', stateField ? stateField.value : 'N/A');
              console.log('  - Zip field ID:', baseFieldName + '_zip', 'Found:', !!zipField, 'Value:', zipField ? zipField.value : 'N/A');
              console.log('  - State Short field ID:', baseFieldName + '_state_short', 'Found:', !!stateShortField, 'Value:', stateShortField ? stateShortField.value : 'N/A');
              
              const street = streetField ? streetField.value.trim() : '';
              const city = cityField ? cityField.value.trim() : '';
              const state = stateShortField ? stateShortField.value.trim() : (stateField ? stateField.value.trim() : '');
              const zip = zipField ? zipField.value.trim() : '';
              
              const addressParts = [street, city, state, zip].filter(part => part !== '');
              const fullAddress = addressParts.join(', ');
              
              addressField.value = fullAddress;
              console.log('🔧 [HIDDEN ADDRESS] Updated address for', baseFieldName + '_address', ':', fullAddress);
            };
            
            field.addEventListener('input', updateAddress);
            field.addEventListener('change', updateAddress);
          } else {
            console.log('🔧 [HIDDEN ADDRESS DEBUG] Field not found:', fieldId);
          }
        });
        
        // Initial update
        setTimeout(() => {
          const streetField = document.getElementById(baseFieldName + '_street');
          const cityField = document.getElementById(baseFieldName + '_city');
          const stateField = document.getElementById(baseFieldName + '_state');
          const zipField = document.getElementById(baseFieldName + '_zip');
          const stateShortField = document.getElementById(baseFieldName + '_state_short');
          
          const street = streetField ? streetField.value.trim() : '';
          const city = cityField ? cityField.value.trim() : '';
          const state = stateShortField ? stateShortField.value.trim() : (stateField ? stateField.value.trim() : '');
          const zip = zipField ? zipField.value.trim() : '';
          
          const addressParts = [street, city, state, zip].filter(part => part !== '');
          const fullAddress = addressParts.join(', ');
          
          addressField.value = fullAddress;
          console.log('🔧 [HIDDEN ADDRESS] Initial address update for', baseFieldName + '_address', ':', fullAddress);
        }, 1000);
      }
    });
  });
  </script>`;

  // Finally, return the assembled HTML
  console.log('🔧 [HIDDEN LOGIC DEBUG] Final hiddenLogicConfigs array:', hiddenLogicConfigs);
  return formHTML;
  
  } catch (error) {
    console.error('🔧 [FORM GENERATION DEBUG] Error in getFormHTML():', error);
    throw error;
  }
}



/*───────────────────────────────────────────────────────────────*
 * 1.  normaliseDesignerFieldRef(raw)
 *     – unchanged except for two tiny regex tweaks (see comments)
 *───────────────────────────────────────────────────────────────*/
function normaliseDesignerFieldRef(raw) {
    raw = String(raw || "").trim();

    /* ① already a real element in the live DOM? */
    if (document.getElementById(raw)) return raw;

    /* ② looks like a finished slug already? */
    const mSlug = raw.match(/^([a-z0-9]+_[a-z0-9_]+?)_(\d+)_(.+)$/);
    if (mSlug && !/^amount\d+$/.test(mSlug[1]) && !/^answer\d+$/.test(mSlug[1]))
        return raw;

    /* ③ builder shorthand (amountX_Y_field  OR  answerX_Y_field) */
    const mShort =
        raw.match(/^amount(\d+)_(\d+)_(.+)$/) ||
        raw.match(/^answer(\d+)_(\d+)_(.+)$/);
    if (mShort) {
        const [, qId, idx, field] = mShort;
        const slug = questionSlugMap[qId] || ("answer" + qId);
        return `${slug}_${idx}_${sanitizeQuestionText(field)}`;
    }

    /* ④ catch‑all fallback */
    const mGeneric = raw.match(/^(.*)_(\d+)_(.+)$/);
    if (!mGeneric) return sanitizeQuestionText(raw);

    const [, qText, idx, field] = mGeneric;
    return `${sanitizeQuestionText(qText)}_${idx}_${sanitizeQuestionText(field)}`;
}



/*───────────────────────────────────────────────────────────────*
 * 2.  generateHiddenPDFFields()
 *     – now funnels every designer reference through
 *       normaliseDesignerFieldRef() so shorthand is fixed.
 *───────────────────────────────────────────────────────────────*/
function generateHiddenPDFFields(formName) {
    // Fallback if formName is not provided
    if (!formName) {
        formName = 'Example Form';
    }
    
    let hiddenFieldsHTML = '<div id="hidden_pdf_fields">';

    /* profile fields … (unchanged) */
    hiddenFieldsHTML += `
<input type="hidden" id="user_firstname_hidden" name="user_firstname_hidden">
<input type="hidden" id="user_lastname_hidden"  name="user_lastname_hidden">
<input type="hidden" id="user_fullname"         name="user_fullname">
<input type="hidden" id="user_email_hidden"     name="user_email_hidden">
<input type="hidden" id="user_phone_hidden"     name="user_phone_hidden">
<input type="hidden" id="user_street_hidden"    name="user_street_hidden">
<input type="hidden" id="user_city_hidden"      name="user_city_hidden">
<input type="hidden" id="user_state_hidden"     name="user_state_hidden">
<input type="hidden" id="user_zip_hidden"       name="user_zip_hidden">`;

    const hiddenCheckboxCalculations = [];
    const hiddenTextCalculations     = [];

    const container = document.getElementById("hiddenFieldsContainer");
    if (!container)
        return { hiddenFieldsHTML: hiddenFieldsHTML + "</div>",
                 hiddenCheckboxCalculations,
                 hiddenTextCalculations };

    /* ── walk every hidden‑field block ────────────────────────── */
    container.querySelectorAll(".hidden-field-block").forEach(block => {
        const hid   = block.id.replace("hiddenFieldBlock", "");
        const fType = block.querySelector("#hiddenFieldType" + hid)?.value || "text";
        const fName = block.querySelector("#hiddenFieldName" + hid)?.value.trim();
        if (!fName) return;

        /* TEXT hidden field ......................................*/
        if (fType === "text") {
			
			//hide fields here
            hiddenFieldsHTML += `\n<input type="text" id="${fName}" name="${fName}" style="display:none;">`;

            const rows = block.querySelectorAll(`[id^="textCalculationRow${hid}_"]`);
            if (rows.length) {
                const calcArr = [];

                rows.forEach(row => {
                    const oneCalc = { terms: [], compareOperator: "=", threshold: "0", fillValue: "" };

                    /* grab terms */
                    row.querySelectorAll(".equation-term-text").forEach((termDiv, tIdx) => {
                        const qSel = termDiv.querySelector('[id^="textTermQuestion"]');
                        if (!qSel) return;

                        const qId   = qSel.value.trim();
                        const rawId = questionNameIds[qId] || qId;            // fallback
                        const isAmt = questionTypesMap[qId] === "checkbox" &&
                                      termDiv.querySelector('[id^="textTermIsAmount"]')?.checked;
                        const base  = isAmt ? rawId + "_amount" : rawId;

                        oneCalc.terms.push({
                            operator: tIdx ? termDiv.querySelector('[id^="textTermOperator"]').value : "",
                            /* HERE is the important line: */
                            questionNameId: normaliseDesignerFieldRef(base)
                        });
                    });

                    if (oneCalc.terms.length) {
                        oneCalc.compareOperator = row.querySelector('[id^="textCompareOperator"]').value || "=";
                        oneCalc.threshold       = row.querySelector('[id^="textThreshold"]').value.trim() || "0";
                        oneCalc.fillValue       = row.querySelector('[id^="textFillValue"]').value.trim() || "";
                        calcArr.push(oneCalc);
                    }
                });

                if (calcArr.length)
                    hiddenTextCalculations.push({ hiddenFieldName: fName, calculations: calcArr });
            }
        }

        /* CHECKBOX hidden field ..................................*/
        if (fType === "checkbox") {
            const checked = block.querySelector("#hiddenFieldChecked" + hid)?.checked;
            hiddenFieldsHTML += `\n<div style="display:none;"><input type="checkbox" id="${fName}" name="${fName}" ${checked ? "checked" : ""}></div>`;

            const rows = block.querySelectorAll(`[id^="calculationRow${hid}_"]`);
            if (rows.length) {
                const calcArr = [];

                rows.forEach(row => {
                    const oneCalc = { terms: [], compareOperator: "=", threshold: "0", result: "checked" };

                    row.querySelectorAll(".equation-term-cb").forEach((termDiv, tIdx) => {
                        const qSel = termDiv.querySelector('[id^="calcTermQuestion"]');
                        if (!qSel) return;

                        const qId   = qSel.value.trim();
                        const rawId = questionNameIds[qId] || qId;
                        const isAmt = questionTypesMap[qId] === "checkbox" &&
                                      termDiv.querySelector('[id^="calcTermIsAmount"]')?.checked;
                        const base  = isAmt ? rawId + "_amount" : rawId;

                        oneCalc.terms.push({
                            operator: tIdx ? termDiv.querySelector('[id^="calcTermOperator"]').value : "",
                            questionNameId: normaliseDesignerFieldRef(base)
                        });
                    });

                    if (oneCalc.terms.length) {
                        oneCalc.compareOperator = row.querySelector('[id^="calcCompareOperator"]').value || "=";
                        oneCalc.threshold       = row.querySelector('[id^="calcThreshold"]').value.trim() || "0";
                        oneCalc.result          = row.querySelector('[id^="calcResult"]').value || "checked";
                        calcArr.push(oneCalc);
                    }
                });

                if (calcArr.length)
                    hiddenCheckboxCalculations.push({ hiddenFieldName: fName, calculations: calcArr });
            }
        }
    });

    // Add default checkbox based on form name inside the hidden fields div
    const formNameSafe = formName.replace(/\W+/g, '_').toLowerCase();
    hiddenFieldsHTML += `\n<input type="checkbox" id="${formNameSafe}_default_checkbox" name="${formNameSafe}_default_checkbox" checked style="display: none;">`;

    hiddenFieldsHTML += "\n</div>";
    return { hiddenFieldsHTML, hiddenCheckboxCalculations, hiddenTextCalculations };
}




