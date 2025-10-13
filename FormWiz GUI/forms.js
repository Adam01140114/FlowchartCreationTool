// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDS-tSSn7fdLBgwzfHQ_1MPG1w8S_4qb04",
    authDomain: "formwiz-3f4fd.firebaseapp.com",
    projectId: "formwiz-3f4fd",
    storageBucket: "formwiz-3f4fd.firebasestorage.app",
    messagingSenderId: "404259212529",
    appId: "1:404259212529:web:15a33bce82383b21cfed50",
    measurementId: "G-P07YEN0HPD"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const welcomeMessage = document.getElementById('welcome-message');
const settingsButton = document.getElementById('settings-button');
const logoutButton = document.getElementById('logout-button');
const settingsModal = document.getElementById('settings-modal');
const userSettingsForm = document.getElementById('user-settings-form');
const settingsError = document.getElementById('settings-error');
const myFormsList = document.getElementById('my-forms-list');
const availableFormsList = document.getElementById('available-forms-list');
const noFormsMessage = document.getElementById('no-forms-message');
const removeSelectedButton = document.getElementById('remove-selected-button');
const signInBtn = document.getElementById('sign-in-btn');

// Keep track of selected forms
const selectedForms = new Set();

// Generate a unique portfolio ID for form sessions
function generatePortfolioId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 20; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Modal Functions
function openSettings() {
    settingsModal.style.display = 'block';
}

function closeSettings() {
    settingsModal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target == settingsModal) {
        closeSettings();
    }
    if (event.target == document.getElementById('duplicate-form-modal')) {
        closeDuplicateFormModal();
    }
    if (event.target == document.getElementById('county-modal')) {
        document.getElementById('county-modal').style.display = 'none';
        pendingCountyData = null;
        currentCounty = null;
    }
    if (event.target == document.getElementById('defendant-modal')) {
        document.getElementById('defendant-modal').style.display = 'none';
        pendingDefendantData = null;
    }
};

// Logout Function
logoutButton.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error('Sign Out Error', error);
    });
});

// Form Management Functions
function timeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (years > 0) return years + (years === 1 ? ' year ago' : ' years ago');
    if (months > 0) return months + (months === 1 ? ' month ago' : ' months ago');
    if (weeks > 0) return weeks + (weeks === 1 ? ' week ago' : ' weeks ago');
    if (days > 0) return days + (days === 1 ? ' day ago' : ' days ago');
    if (hours > 0) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    if (minutes > 0) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
    return 'Just now';
}

function showSavingOverlay(msg, isError) {
    const overlay = document.getElementById('saving-overlay');
    const modal = document.getElementById('saving-modal-text');
    if (modal) {
        modal.textContent = msg || 'Saving...';
        if (isError) {
            modal.classList.add('error');
        } else {
            modal.classList.remove('error');
        }
    }
    if (overlay) overlay.style.display = 'flex';
}
function hideSavingOverlay() {
    const overlay = document.getElementById('saving-overlay');
    if (overlay) overlay.style.display = 'none';
}

function renderMyForms(forms) {
    myFormsList.innerHTML = '';
    if (forms.length === 0) {
        noFormsMessage.style.display = 'block';
        removeSelectedButton.style.display = 'none';
    } else {
        noFormsMessage.style.display = 'none';
        // Sort forms: newest lastOpened first, never opened at the bottom
        forms.sort((a, b) => {
            if (!a.lastOpened && !b.lastOpened) return 0;
            if (!a.lastOpened) return 1;
            if (!b.lastOpened) return -1;
            const aDate = a.lastOpened?.toDate ? a.lastOpened.toDate() : new Date(a.lastOpened);
            const bDate = b.lastOpened?.toDate ? b.lastOpened.toDate() : new Date(b.lastOpened);
            return bDate - aDate;
        });
        forms.forEach((form) => {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            // Add last opened timestamp (top right)
            const lastOpenedDiv = document.createElement('div');
            lastOpenedDiv.className = 'last-opened';
            if (form.lastOpened) {
                const date = form.lastOpened.toDate ? form.lastOpened.toDate() : new Date(form.lastOpened);
                lastOpenedDiv.textContent = timeAgo(date);
            } else {
                lastOpenedDiv.textContent = 'Never opened';
            }
            li.appendChild(lastOpenedDiv);
            // Add checkbox for selection
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('form-checkbox');
            checkbox.dataset.formId = form.id;
            checkbox.style.position = 'absolute';
            checkbox.style.top = '20px';
            checkbox.style.left = '20px';
            checkbox.style.width = '24px';
            checkbox.style.height = '24px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.zIndex = '1';
            checkbox.addEventListener('change', function(e) {
                if (this.checked) {
                    selectedForms.add(form.id);
                } else {
                    selectedForms.delete(form.id);
                }
                updateRemoveSelectedButton();
                e.stopPropagation(); // Prevent li click
            });
            checkbox.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent li click
            });
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = form.name;
            a.style.display = 'block';
            a.style.textAlign = 'center';
            a.addEventListener('click', function(e) { e.preventDefault(); });
            // Add county name under form name if present
            let defendantDiv = null;
            if (form.defendantName) {
                let capName = form.defendantName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                defendantDiv = document.createElement('div');
                defendantDiv.className = 'form-county';
                defendantDiv.style.fontWeight = 'bold';
                defendantDiv.style.color = '#e74c3c';
                defendantDiv.textContent = 'Defendant: ' + capName;
            }
            let countyDiv = null;
            if (form.countyName) {
                countyDiv = document.createElement('div');
                countyDiv.className = 'form-county';
                let countyText = form.countyName.trim();
                if (!countyText.toLowerCase().endsWith('county')) {
                    countyText += ' County';
                }
                countyDiv.textContent = countyText;
            }
            // Create Open button (visual only, no click handler)
            const openButton = document.createElement('button');
            openButton.textContent = 'Open';
            openButton.classList.add('form-action-button');
            openButton.style.maxWidth = '220px';
            openButton.style.width = '100%';
            openButton.style.margin = '12px auto 0 auto';
            openButton.style.display = 'block';
            openButton.tabIndex = -1;
            openButton.addEventListener('click', function(e) { e.preventDefault(); });
            // Make the whole li clickable except for the checkbox
            li.addEventListener('click', async function(e) {
                if (e.target === checkbox) return;
                showSavingOverlay('Saving...', false);
                console.log('[FormWiz] Attempting to update lastOpened for', form.id);
                // Update lastOpened in Firestore, then navigate
                const userId = auth.currentUser.uid;
                const formRef = db.collection('users').doc(userId).collection('forms').doc(form.id);
                try {
                    await formRef.set({ lastOpened: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    console.log('[FormWiz] lastOpened updated for', form.id);
                    hideSavingOverlay();
                    // Append county and portfolioId to the URL for autosave separation
                    const separator = form.url.includes('?') ? '&' : '?';
                    // Fix URL path by removing Pages/ prefix if present
                    let correctedUrl = form.url;
                    if (correctedUrl.includes('Pages/Forms/')) {
                        correctedUrl = correctedUrl.replace('Pages/Forms/', '../Forms/');
                    }
                    let url = correctedUrl + separator + 'county=' + encodeURIComponent(form.countyName || '') + '&portfolioId=' + encodeURIComponent(form.id);
                    if (form.defendantName) url += '&defendantName=' + encodeURIComponent(form.defendantName);
                    window.location.href = url;
                } catch (err) {
                    console.error('[FormWiz] Failed to update lastOpened:', err);
                    hideSavingOverlay();
                    alert('Failed to save last opened timestamp. Please try again.');
                }
            });
            li.appendChild(checkbox);
            li.appendChild(a);
            if (defendantDiv) li.appendChild(defendantDiv);
            if (countyDiv) li.appendChild(countyDiv);
            li.appendChild(openButton);
            myFormsList.appendChild(li);
        });
    }
}

function updateRemoveSelectedButton() {
    if (selectedForms.size > 0) {
        removeSelectedButton.style.display = 'block';
    } else {
        removeSelectedButton.style.display = 'none';
    }
}

// Remove selected forms
removeSelectedButton.addEventListener('click', async () => {
    if (selectedForms.size === 0) return;
    
    const userId = auth.currentUser.uid;
    const batch = db.batch();
    
    selectedForms.forEach(formId => {
        const formRef = db.collection('users').doc(userId).collection('forms').doc(formId);
        batch.delete(formRef);
    });
    
    try {
        await batch.commit();
        selectedForms.clear();
        // No need to call fetchMyForms - the real-time listener will automatically update
    } catch (error) {
        console.error('Error removing selected forms:', error);
    }
});

let formsUnsubscribe = null;
function listenToMyForms(userId) {
    if (formsUnsubscribe) formsUnsubscribe();
    formsUnsubscribe = db.collection('users').doc(userId).collection('forms')
        .onSnapshot((querySnapshot) => {
            const forms = [];
            querySnapshot.forEach((doc) => {
                forms.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            renderMyForms(forms);
            selectedForms.clear();
            updateRemoveSelectedButton();
        }, (error) => {
            console.error('Error listening to user forms:', error);
        });
}

// Load available forms from Firebase
async function loadAvailableForms() {
    try {
        const snapshot = await db.collection('forms').get();
        const forms = [];
        
        snapshot.forEach(doc => {
            const formData = doc.data();
            formData.id = doc.id;
            
            // Transform URLs to use the correct format with Forms/ prefix and include portfolio ID
            if (formData.url) {
                // Generate a unique portfolio ID for this form session
                const portfolioId = generatePortfolioId();
                
                if (formData.id === 'sc100') {
                    formData.url = `../Forms/sc-100.html?formId=sc100&portfolioId=${portfolioId}`;
                } else if (formData.id === 'sc120') {
                    formData.url = `../Forms/sc-120.html?formId=sc120&portfolioId=${portfolioId}`;
                } else if (formData.id === 'sc500') {
                    formData.url = `../Forms/sc-500.html?formId=sc500&portfolioId=${portfolioId}`;
                } else if (formData.id === 'fee-waiver') {
                    formData.url = `../Forms/fee-waiver.html?formId=fee-waiver&portfolioId=${portfolioId}`;
                }
            }
            
            forms.push(formData);
        });
        
        console.log('Loaded available forms from Firebase:', forms);
        return forms;
    } catch (error) {
        console.error('Error loading available forms from Firebase:', error);
        return [];
    }
}

let countyZipMap = null;
async function loadCountyZipMap() {
    if (countyZipMap) return countyZipMap;
    try {
        const response = await fetch('../JSON/county-zips.json');
        if (!response.ok) throw new Error('Failed to load county-zips.json');
        countyZipMap = await response.json();
        return countyZipMap;
    } catch (e) {
        console.error('Error loading county-zips.json:', e);
        return {};
    }
}

// Pagination logic for available forms
let availableFormsData = [];
let currentFormsPage = 0;
const FORMS_PER_PAGE = 5;

// Update renderAvailableForms to use county-based zip search
async function renderAvailableForms(page = 0, searchFilter = '', zipFilter = '') {
    try {
        if (!availableFormsData.length) {
            availableFormsData = await loadAvailableForms();
        }
        let forms = availableFormsData;
        if (searchFilter) {
            const searchTerm = searchFilter.toLowerCase();
            // Create a prioritized list: title matches first, then description matches
            const titleMatches = forms.filter(form => form.name.toLowerCase().includes(searchTerm));
            const descriptionMatches = forms.filter(form => 
                form.description && 
                form.description.toLowerCase().includes(searchTerm) && 
                !form.name.toLowerCase().includes(searchTerm) // Exclude already matched titles
            );
            // Combine with title matches first, then description matches
            forms = [...titleMatches, ...descriptionMatches];
        }
        if (zipFilter) {
            const countyZipMap = await loadCountyZipMap();
            // Find counties that contain this zip
            const matchingCounties = Object.entries(countyZipMap)
                .filter(([county, zips]) => zips.includes(zipFilter))
                .map(([county]) => county);
            // Show forms that have any of those counties
            forms = forms.filter(form => Array.isArray(form.counties) && form.counties.some(c => matchingCounties.includes(c)));
        }
        const totalPages = Math.ceil(forms.length / FORMS_PER_PAGE);
        if (page < 0) page = 0;
        if (page >= totalPages) page = totalPages - 1;
        currentFormsPage = page;
        const start = page * FORMS_PER_PAGE;
        const end = start + FORMS_PER_PAGE;
        const formsToShow = forms.slice(start, end);
        // Animate out
        availableFormsList.classList.remove('fade-in');
        availableFormsList.classList.add('fade-out');
        setTimeout(() => {
            availableFormsList.innerHTML = '';
            formsToShow.forEach(form => {
                const li = document.createElement('li');
                
                // Create form info container
                const formInfo = document.createElement('div');
                formInfo.style.display = 'flex';
                formInfo.style.flexDirection = 'column';
                formInfo.style.gap = '4px';
                formInfo.style.flex = '1';
                
                // Create form name anchor
                const anchor = document.createElement('a');
                anchor.href = '#';
                anchor.setAttribute('data-form-id', form.id);
                anchor.setAttribute('data-form-url', form.url);
                anchor.textContent = form.name;
                anchor.style.fontWeight = 'bold';
                anchor.style.fontSize = '1.1em';
                anchor.style.color = '#2c3e50';
                anchor.style.textDecoration = 'none';
                // Fix: Make anchor trigger addFormToPortfolio
                anchor.addEventListener('click', (e) => {
                    e.preventDefault();
                    addFormToPortfolio(form.id, form.url, form.name);
                });
                
                // Create form description
                const description = document.createElement('div');
                description.textContent = form.description || 'No description available';
                description.style.fontSize = '0.9em';
                description.style.color = '#7f8c8d';
                description.style.lineHeight = '1.4';
                description.style.marginTop = '0px';
                description.style.marginBottom = '10px';
                
                // Add description to form info
                formInfo.appendChild(anchor);
                formInfo.appendChild(description);
                
                // Create Click Here button
                const addButton = document.createElement('button');
                addButton.textContent = 'Click Here';
                addButton.classList.add('form-action-button');
                addButton.dataset.formId = form.id;
                addButton.dataset.formUrl = form.url;
                addButton.dataset.formName = form.name;
                addButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    addFormToPortfolio(form.id, form.url, form.name);
                });
                
                // Add elements to list item
                li.appendChild(formInfo);
                li.appendChild(addButton);
                availableFormsList.appendChild(li);
            });
            // Animate in
            availableFormsList.classList.remove('fade-out');
            availableFormsList.classList.add('fade-in');
        }, 180);
        // Update pagination buttons
        const prevBtn = document.getElementById('forms-prev-btn');
        const nextBtn = document.getElementById('forms-next-btn');
        prevBtn.disabled = (page === 0);
        nextBtn.disabled = (page >= totalPages - 1);
    } catch (error) {
        console.error('Error rendering available forms:', error);
    }
}

// Variables to store pending form data for duplicate confirmation
let pendingFormData = null;

async function addFormToPortfolio(formId, formUrl, formName) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = formUrl;
        return;
    }
    // Require zip code to be entered, or use user settings zip
    const zipInput = document.getElementById('available-forms-zip');
    let zipValue = zipInput ? zipInput.value.trim() : '';
    let userZip = '';
    let userCounty = '';
    let userData = null;
    if (!zipValue) {
        // Try to get zip from user settings
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                userData = userDoc.data();
                userZip = userData.address && userData.address.zip ? userData.address.zip.trim() : '';
                zipValue = userZip;
            }
        } catch (e) {
            // fallback: do nothing
        }
        if (!zipValue) {
            alert('Please enter a zip code above or add your zip code in your user settings.');
            return;
        }
    }
    // Find county for this zip
    const countyZipMap = await loadCountyZipMap();
    let foundCounty = null;
    for (const [county, zips] of Object.entries(countyZipMap)) {
        if (zips.includes(zipValue)) {
            foundCounty = county;
            break;
        }
    }
    if (!foundCounty) {
        alert('No county found for this zip code.');
        return;
    }
    // Check if form supports this county
    let formObj = null;
    if (!availableFormsData.length) {
        availableFormsData = await loadAvailableForms();
    }
    formObj = availableFormsData.find(f => f.id === formId);
    if (formObj && (!Array.isArray(formObj.counties) || !formObj.counties.includes(foundCounty))) {
        alert(`This form is not offered in ${foundCounty} please select another form or try a different zip code.`);
        return;
    }
    const userId = user.uid;
    
    // Check if user already has this form for this county
    try {
        // Query all forms to check for duplicates of the same form type in the same county
        const formsSnapshot = await db.collection('users').doc(userId).collection('forms').get();
        let duplicateFound = false;
        
        formsSnapshot.forEach(doc => {
            const formData = doc.data();
            // Check if this is the same form type (by formId or originalFormId) and same county
            if ((formData.originalFormId === formId || doc.id === formId) && formData.countyName === foundCounty) {
                duplicateFound = true;
            }
        });
        
        if (duplicateFound) {
            // Show duplicate confirmation modal
            showDuplicateFormModal(formName, foundCounty, formId, formUrl, foundCounty);
            return;
        }
        
        // No duplicate found, proceed with adding the form
        await addFormToPortfolioInternal(formId, formUrl, formName, foundCounty);
    } catch (error) {
        console.error('Error checking for duplicate form:', error);
    }
}




async function addFormToPortfolioInternal(formId, formUrl, formName, countyName, isDuplicate = false) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = formUrl;
        return;
    }
    
    const userId = user.uid;
    try {
        if (isDuplicate) {
            // For duplicates, always create a new document with a unique ID
            const newFormRef = db.collection('users').doc(userId).collection('forms').doc();
            await newFormRef.set({
                originalFormId: formId, // Keep reference to original form ID
                name: formName,
                url: formUrl,
                addedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastOpened: firebase.firestore.FieldValue.serverTimestamp(),
                countyName: countyName,
                isDuplicate: true
            });
            // No need to call fetchMyForms, real-time listener will update
            // Append county information to the URL for autosave separation
            const separator = formUrl.includes('?') ? '&' : '?';
            window.location.href = formUrl + separator + 'county=' + encodeURIComponent(countyName);
        } else {
            // For new forms, check if it already exists for the same county
            const formsSnapshot = await db.collection('users').doc(userId).collection('forms').get();
            let existingFormDoc = null;
            
            formsSnapshot.forEach(doc => {
                const formData = doc.data();
                // Check if this is the same form type and same county
                if ((formData.originalFormId === formId || doc.id === formId) && formData.countyName === countyName) {
                    existingFormDoc = doc;
                }
            });
            
            if (existingFormDoc) {
                // Update lastOpened in Firestore for the existing form
                await existingFormDoc.ref.update({
                    lastOpened: firebase.firestore.FieldValue.serverTimestamp(),
                    countyName: countyName
                });
                // Append county information to the URL for autosave separation
                const separator = formUrl.includes('?') ? '&' : '?';
                let url = formUrl + separator + 'county=' + encodeURIComponent(countyName);
                if (defendantName) url += '&defendantName=' + encodeURIComponent(defendantName);
                window.location.href = url;
            } else {
                // Create a new form document with auto-generated ID
                const newFormRef = db.collection('users').doc(userId).collection('forms').doc();
                await newFormRef.set({
                    originalFormId: formId, // Keep reference to original form ID
                    name: formName,
                    url: formUrl,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastOpened: firebase.firestore.FieldValue.serverTimestamp(),
                    countyName: countyName
                });
                // No need to call fetchMyForms, real-time listener will update
                // Append county information to the URL for autosave separation
                const separator = formUrl.includes('?') ? '&' : '?';
                let url = formUrl + separator + 'county=' + encodeURIComponent(countyName);
                if (defendantName) url += '&defendantName=' + encodeURIComponent(defendantName);
                window.location.href = url;
            }
        }
    } catch (error) {
        console.error('Error handling form:', error);
    }
}




























   // Patch addFormToPortfolio to show county modal first
   const originalAddFormToPortfolio = addFormToPortfolio;
addFormToPortfolio = async function(formId, formUrl, formName) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = formUrl;
        return;
    }
    
    // Show county selection modal
    showCountyModal(formId, formUrl, formName);
};

// Patch addFormToPortfolioInternal to accept defendantName
const originalAddFormToPortfolioInternal = addFormToPortfolioInternal;
addFormToPortfolioInternal = async function(formId, formUrl, formName, countyName, isDuplicate = false, defendantName = null) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = formUrl;
        return;
    }
    const userId = user.uid;
    try {
        if (isDuplicate) {
            const newFormRef = db.collection('users').doc(userId).collection('forms').doc();
            await newFormRef.set({
                originalFormId: formId,
                name: formName,
                url: formUrl,
                addedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastOpened: firebase.firestore.FieldValue.serverTimestamp(),
                countyName: countyName,
                isDuplicate: true,
                defendantName: defendantName ? defendantName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : null,
                zipCode: (pendingCountyData && pendingCountyData.zipCode) || (pendingDefendantData && pendingDefendantData.zipCode) ? (pendingCountyData ? pendingCountyData.zipCode : pendingDefendantData.zipCode) : null
            });
            const separator = formUrl.includes('?') ? '&' : '?';
            let url = formUrl + separator + 'county=' + encodeURIComponent(countyName);
            if (defendantName) url += '&defendantName=' + encodeURIComponent(defendantName);
            // Include zip code in URL if available
            const zipCode = (pendingCountyData && pendingCountyData.zipCode) || (pendingDefendantData && pendingDefendantData.zipCode);
            if (zipCode) {
                url += '&zipCode=' + encodeURIComponent(zipCode);
            }
            window.location.href = url;
        } else {
            const formsSnapshot = await db.collection('users').doc(userId).collection('forms').get();
            let existingFormDoc = null;
            formsSnapshot.forEach(doc => {
                const formData = doc.data();
                if ((formData.originalFormId === formId || doc.id === formId) && formData.countyName === countyName) {
                    existingFormDoc = doc;
                }
            });
            if (existingFormDoc) {
                await existingFormDoc.ref.update({
                    lastOpened: firebase.firestore.FieldValue.serverTimestamp(),
                    countyName: countyName,
                    defendantName: defendantName ? defendantName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : null,
                    zipCode: (pendingCountyData && pendingCountyData.zipCode) || (pendingDefendantData && pendingDefendantData.zipCode) ? (pendingCountyData ? pendingCountyData.zipCode : pendingDefendantData.zipCode) : null
                });
                const separator = formUrl.includes('?') ? '&' : '?';
                let url = formUrl + separator + 'county=' + encodeURIComponent(countyName);
                if (defendantName) url += '&defendantName=' + encodeURIComponent(defendantName);
                // Include zip code in URL if available
                const zipCode = (pendingCountyData && pendingCountyData.zipCode) || (pendingDefendantData && pendingDefendantData.zipCode);
                if (zipCode) {
                    url += '&zipCode=' + encodeURIComponent(zipCode);
                }
                window.location.href = url;
            } else {
                const newFormRef = db.collection('users').doc(userId).collection('forms').doc();
                await newFormRef.set({
                    originalFormId: formId,
                    name: formName,
                    url: formUrl,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastOpened: firebase.firestore.FieldValue.serverTimestamp(),
                    countyName: countyName,
                    defendantName: defendantName ? defendantName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : null,
                    zipCode: (pendingCountyData && pendingCountyData.zipCode) || (pendingDefendantData && pendingDefendantData.zipCode) ? (pendingCountyData ? pendingCountyData.zipCode : pendingDefendantData.zipCode) : null
                });
                const separator = formUrl.includes('?') ? '&' : '?';
                let url = formUrl + separator + 'county=' + encodeURIComponent(countyName);
                if (defendantName) url += '&defendantName=' + encodeURIComponent(defendantName);
                // Include zip code in URL if available
                const zipCode = (pendingCountyData && pendingCountyData.zipCode) || (pendingDefendantData && pendingDefendantData.zipCode);
                if (zipCode) {
                    url += '&zipCode=' + encodeURIComponent(zipCode);
                }
                window.location.href = url;
            }
        }
    } catch (error) {
        console.error('Error handling form:', error);
    }
};

// Patch renderMyForms to show defendant name if present
const originalRenderMyForms = renderMyForms;
renderMyForms = function(forms) {
    myFormsList.innerHTML = '';
    if (forms.length === 0) {
        noFormsMessage.style.display = 'block';
        removeSelectedButton.style.display = 'none';
    } else {
        noFormsMessage.style.display = 'none';
        forms.sort((a, b) => {
            if (!a.lastOpened && !b.lastOpened) return 0;
            if (!a.lastOpened) return 1;
            if (!b.lastOpened) return -1;
            const aDate = a.lastOpened?.toDate ? a.lastOpened.toDate() : new Date(a.lastOpened);
            const bDate = b.lastOpened?.toDate ? b.lastOpened.toDate() : new Date(b.lastOpened);
            return bDate - aDate;
        });
        forms.forEach((form) => {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            const lastOpenedDiv = document.createElement('div');
            lastOpenedDiv.className = 'last-opened';
            if (form.lastOpened) {
                const date = form.lastOpened.toDate ? form.lastOpened.toDate() : new Date(form.lastOpened);
                lastOpenedDiv.textContent = timeAgo(date);
            } else {
                lastOpenedDiv.textContent = 'Never opened';
            }
            li.appendChild(lastOpenedDiv);
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('form-checkbox');
            checkbox.dataset.formId = form.id;
            checkbox.style.position = 'absolute';
            checkbox.style.top = '20px';
            checkbox.style.left = '20px';
            checkbox.style.width = '24px';
            checkbox.style.height = '24px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.zIndex = '1';
            checkbox.addEventListener('change', function(e) {
                if (this.checked) {
                    selectedForms.add(form.id);
                } else {
                    selectedForms.delete(form.id);
                }
                updateRemoveSelectedButton();
                e.stopPropagation();
            });
            checkbox.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = form.name;
            a.style.display = 'block';
            a.style.textAlign = 'center';
            a.addEventListener('click', function(e) { e.preventDefault(); });
            let defendantDiv = null;
            if (form.defendantName) {
                let capName = form.defendantName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                defendantDiv = document.createElement('div');
                defendantDiv.className = 'form-county';
                defendantDiv.style.fontWeight = 'bold';
                defendantDiv.style.color = '#e74c3c';
                defendantDiv.textContent = 'Defendant: ' + capName;
            }
            let countyDiv = null;
            if (form.countyName) {
                countyDiv = document.createElement('div');
                countyDiv.className = 'form-county';
                let countyText = form.countyName.trim();
                if (!countyText.toLowerCase().endsWith('county')) {
                    countyText += ' County';
                }
                countyDiv.textContent = countyText;
            }
            const openButton = document.createElement('button');
            openButton.textContent = 'Open';
            openButton.classList.add('form-action-button');
            openButton.style.maxWidth = '220px';
            openButton.style.width = '100%';
            openButton.style.margin = '12px auto 0 auto';
            openButton.style.display = 'block';
            openButton.tabIndex = -1;
            openButton.addEventListener('click', function(e) { e.preventDefault(); });
            li.addEventListener('click', async function(e) {
                if (e.target === checkbox) return;
                showSavingOverlay('Saving...', false);
                const userId = auth.currentUser.uid;
                const formRef = db.collection('users').doc(userId).collection('forms').doc(form.id);
                try {
                    await formRef.set({ lastOpened: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    // Always fetch the latest data
                    const doc = await formRef.get();
                    let defendantName = '';
                    if (doc.exists) {
                        defendantName = doc.data().defendantName;
                    }
                    hideSavingOverlay();
                    const separator = form.url.includes('?') ? '&' : '?';
                    // Fix URL path by removing Pages/ prefix if present
                    let correctedUrl = form.url;
                    if (correctedUrl.includes('Pages/Forms/')) {
                        correctedUrl = correctedUrl.replace('Pages/Forms/', '../Forms/');
                    }
                    let url = correctedUrl + separator + 'county=' + encodeURIComponent(form.countyName || '') + '&portfolioId=' + encodeURIComponent(form.id);
                    if (defendantName) url += '&defendantName=' + encodeURIComponent(defendantName);
                    // Include zip code in URL if available
                    if (form.zipCode) {
                        url += '&zipCode=' + encodeURIComponent(form.zipCode);
                    }
                    window.location.href = url;
                } catch (err) {
                    hideSavingOverlay();
                    alert('Failed to save last opened timestamp. Please try again.');
                }
            });
            li.appendChild(checkbox);
            li.appendChild(a);
            if (defendantDiv) li.appendChild(defendantDiv);
            if (countyDiv) li.appendChild(countyDiv);
            li.appendChild(openButton);
            myFormsList.appendChild(li);
        });
    }
};

function showDuplicateFormModal(formName, countyName, formId, formUrl, newCountyName) {
    const modal = document.getElementById('duplicate-form-modal');
    const message = document.getElementById('duplicate-form-message');
    const yesBtn = document.getElementById('duplicate-form-yes-btn');
    const cancelBtn = document.getElementById('duplicate-form-cancel-btn');
    
    // Set the message
    message.textContent = `You already have a ${formName} form for ${countyName} County in your portfolio, would you like to add another?`;
    
    // Store the pending form data
    pendingFormData = {
        formId: formId,
        formUrl: formUrl,
        formName: formName,
        countyName: newCountyName
    };
    
    // Show the modal
    modal.style.display = 'block';
    
    // Add event listeners for the buttons
    yesBtn.onclick = async function() {
        closeDuplicateFormModal();
        if (pendingFormData) {
            // Check if the form requires a defendant
            let formObj = null;
            if (!availableFormsData.length) {
                availableFormsData = await loadAvailableForms();
            }
            formObj = availableFormsData.find(f => f.id === pendingFormData.formId);
            
            if (formObj && formObj.defendant && formObj.defendant.toUpperCase() === 'YES') {
                // Show defendant modal for duplicate
                showDefendantModal(formObj, pendingFormData.formId, pendingFormData.formUrl, pendingFormData.formName, pendingFormData.countyName, true);
            } else {
                // No defendant required, add directly
                await addFormToPortfolioInternal(pendingFormData.formId, pendingFormData.formUrl, pendingFormData.formName, pendingFormData.countyName, true);
            }
            pendingFormData = null;
        }
    };
    
    cancelBtn.onclick = function() {
        closeDuplicateFormModal();
        pendingFormData = null;
    };
}

function closeDuplicateFormModal() {
    const modal = document.getElementById('duplicate-form-modal');
    modal.style.display = 'none';
}

// Available Forms Click Handler - Keep existing functionality
availableFormsList.addEventListener('click', async (e) => {
    e.preventDefault();
    if (e.target.tagName === 'A') {
        const formId = e.target.getAttribute('data-form-id');
        const formUrl = e.target.getAttribute('data-form-url');
        const formName = e.target.textContent;
        
        addFormToPortfolio(formId, formUrl, formName);
    }
});

// User Settings Form Handler
userSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isSettingsChanged()) {
        closeSettings();
        return;
    }
    settingsError.textContent = '';
    const userId = auth.currentUser.uid;
    const updatedData = {
        firstName: document.getElementById('settings-first-name').value.trim(),
        lastName: document.getElementById('settings-last-name').value.trim(),
        email: document.getElementById('settings-email').value.trim(),
        phone: document.getElementById('settings-phone').value.trim(),
        address: {
            street: document.getElementById('settings-street').value.trim(),
            city: document.getElementById('settings-city').value.trim(),
            state: document.getElementById('settings-state').value,
            zip: document.getElementById('settings-zip').value.trim()
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        // Update user document (create if doesn't exist)
        await db.collection('users').doc(userId).set(updatedData, { merge: true });
        // Update welcome message if it exists
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome ${updatedData.firstName} ${updatedData.lastName}`;
        }
        // Update portfolio welcome message if it exists
        const portfolioWelcome = document.getElementById('portfolio-welcome-message');
        if (portfolioWelcome) {
            portfolioWelcome.textContent = `Welcome, ${updatedData.firstName} ${updatedData.lastName}`;
        }
        // Update auth email if changed
        if (auth.currentUser.email !== updatedData.email) {
            await auth.currentUser.updateEmail(updatedData.email);
        }
        closeSettings();
    } catch (error) {
        settingsError.textContent = error.message;
        console.error('Error updating profile:', error);
    }
});

// Phone number auto-formatting for xxx-xxx-xxxx
const phoneInput = document.getElementById('settings-phone');
if (phoneInput) {
    phoneInput.addEventListener('input', function(e) {
        let value = phoneInput.value.replace(/\D/g, '');
        if (value.length > 3 && value.length <= 6) {
            value = value.replace(/(\d{3})(\d+)/, '$1-$2');
        } else if (value.length > 6) {
            value = value.replace(/(\d{3})(\d{3})(\d+)/, '$1-$2-$3');
        }
        phoneInput.value = value;
    });
}

// Update the auth state listener in forms.html
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const portfolioSection = document.getElementById('portfolio-section');
        if (portfolioSection) portfolioSection.style.display = 'block';
        if (settingsButton) settingsButton.style.display = 'inline-block';
        if (logoutButton) logoutButton.style.display = 'block';
        if (signInBtn) signInBtn.style.display = 'none';
        try {
            // Get user document from Firestore with retry logic for new users
            let userDoc = await db.collection('users').doc(user.uid).get();
            let retryCount = 0;
            const maxRetries = 3;
            
            // If user document doesn't exist, wait a bit and retry (for new users)
            while (!userDoc.exists && retryCount < maxRetries) {
                console.log(`User document not found, retrying... (${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                userDoc = await db.collection('users').doc(user.uid).get();
                retryCount++;
            }
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                // Update welcome message with actual name
                if (welcomeMessage) welcomeMessage.textContent = `${userData.firstName} ${userData.lastName}`;
                const portfolioWelcome = document.getElementById('portfolio-welcome-message');
                if (portfolioWelcome) portfolioWelcome.textContent = `Welcome, ${userData.firstName} ${userData.lastName}`;
                // Pre-populate settings form
                document.getElementById('settings-first-name').value = userData.firstName || '';
                document.getElementById('settings-last-name').value = userData.lastName || '';
                document.getElementById('settings-email').value = userData.email || user.email || '';
                document.getElementById('settings-phone').value = userData.phone || '';
                document.getElementById('settings-street').value = userData.address?.street || '';
                document.getElementById('settings-city').value = userData.address?.city || '';
                document.getElementById('settings-state').value = userData.address?.state || '';
                document.getElementById('settings-zip').value = userData.address?.zip || '';
                // Load user's forms
                listenToMyForms(user.uid);
                // Render available forms with buttons
                await renderAvailableForms();
            } else {
                // Create user document if it doesn't exist (fallback for users who somehow don't have data)
                const newUserData = {
                    firstName: '',
                    lastName: '',
                    email: user.email,
                    phone: '',
                    address: {
                        street: '',
                        city: '',
                        state: '',
                        zip: ''
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('users').doc(user.uid).set(newUserData);
                if (welcomeMessage) welcomeMessage.textContent = `Welcome User`;
                // Render available forms with buttons
                await renderAvailableForms();
                listenToMyForms(user.uid);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            if (welcomeMessage) welcomeMessage.textContent = 'Welcome User';
            listenToMyForms(user.uid);
        }
        if (settingsButton) settingsButton.addEventListener('click', openSettings);
        // Listen to My Documents
        listenToMyDocuments(user.uid);
    } else {
        const portfolioSection = document.getElementById('portfolio-section');
        if (portfolioSection) portfolioSection.style.display = 'none';
        if (settingsButton) settingsButton.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'none';
        if (signInBtn) signInBtn.style.display = 'inline-block';
        if (formsUnsubscribe) formsUnsubscribe();
        if (documentsUnsubscribe) documentsUnsubscribe();
    }
});

// Dropdown for Forms nav (copied from index.html)
document.addEventListener('DOMContentLoaded', function() {
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
    formsLink.addEventListener('click', function(e) {
        e.preventDefault();
        dropdownOpen ? closeDropdown() : openDropdown();
    });
    document.addEventListener('mousedown', function(e) {
        if (!formsWrapper.contains(e.target)) {
            closeDropdown();
        }
    });
    formsLink.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dropdownOpen ? closeDropdown() : openDropdown();
        }
    });
});

// Ensure sign-in button only shows when not logged in
document.addEventListener('DOMContentLoaded', function() {
    const signInBtn = document.querySelector('.sign-in-btn');
    const auth = firebase.auth();
    auth.onAuthStateChanged(function(user) {
        if (user) {
            if (signInBtn) signInBtn.style.display = 'none';
        } else {
            if (signInBtn) signInBtn.style.display = 'block';
        }
    });
});

// Show/hide User Settings button based on auth state
const userSettingsBtn = document.getElementById('user-settings-btn');
auth.onAuthStateChanged(function(user) {
    if (user) {
        if (userSettingsBtn) userSettingsBtn.style.display = 'block';
    } else {
        if (userSettingsBtn) userSettingsBtn.style.display = 'none';
    }
});

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
// Open settings modal on click, always autofill with latest user data
if (userSettingsBtn) {
    userSettingsBtn.addEventListener('click', async function() {
        const user = auth.currentUser;
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    document.getElementById('settings-first-name').value = userData.firstName || '';
                    document.getElementById('settings-last-name').value = userData.lastName || '';
                    document.getElementById('settings-email').value = userData.email || user.email || '';
                    document.getElementById('settings-phone').value = userData.phone || '';
                    document.getElementById('settings-street').value = userData.address?.street || '';
                    document.getElementById('settings-city').value = userData.address?.city || '';
                    document.getElementById('settings-state').value = userData.address?.state || '';
                    document.getElementById('settings-zip').value = userData.address?.zip || '';
                }
            } catch (error) {
                // fallback: do nothing
            }
        }
        openSettings();
    });
}

// Add search functionality for available forms
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('available-forms-search');
    const availableFormsList = document.getElementById('available-forms-list');
    if (searchInput && availableFormsList) {
        searchInput.addEventListener('input', function() {
            const filter = searchInput.value.trim().toLowerCase();
            const formItems = availableFormsList.querySelectorAll('li');
            formItems.forEach(li => {
                const anchor = li.querySelector('a');
                if (anchor) {
                    const formName = anchor.textContent.toLowerCase();
                    if (formName.includes(filter)) {
                        li.style.display = '';
                    } else {
                        li.style.display = 'none';
                    }
                }
            });
        });
    }
    
    // Load available forms for all users
    renderAvailableForms(0);
});

// Update cart count badge in header
function updateCartCountBadge() {
    const cartCountElement = document.getElementById('cart-count-badge');
    if (cartCountElement) {
        let count = 0;
        
        // Try getCartCount function first
        if (typeof getCartCount === 'function') {
            count = getCartCount();
        } else {
            // Fallback to checking both cookie and localStorage
            try {
                // Check cookie first
                function getCookie(name) {
                    const eq = name + '=';
                    const parts = document.cookie.split(';');
                    for (let c of parts) {
                        while (c.charAt(0) === ' ') c = c.slice(1);
                        if (c.indexOf(eq) === 0) return c.slice(eq.length);
                    }
                    return null;
                }
                
                let cartData = getCookie('formwiz_cart');
                if (!cartData) {
                    cartData = localStorage.getItem('formwiz_cart');
                }
                
                if (cartData) {
                    const decodedData = cartData.startsWith('%') ? decodeURIComponent(cartData) : cartData;
                    const cart = JSON.parse(decodedData);
                    count = Array.isArray(cart) ? cart.length : 0;
                }
            } catch (e) {
                console.error('Error getting cart count:', e);
                count = 0;
            }
        }
        
        cartCountElement.textContent = count;
        if (count > 0) {
            cartCountElement.style.display = 'flex';
        } else {
            cartCountElement.style.display = 'none';
        }
    }
}
document.addEventListener('DOMContentLoaded', function() {
    updateCartCountBadge();
    setInterval(updateCartCountBadge, 5000);
});

document.addEventListener('DOMContentLoaded', function() {
    const prevBtn = document.getElementById('forms-prev-btn');
    const nextBtn = document.getElementById('forms-next-btn');
    const searchInput = document.getElementById('available-forms-search');
    const zipInput = document.getElementById('available-forms-zip');
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            renderAvailableForms(currentFormsPage - 1, searchInput.value.trim(), zipInput.value.trim());
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', function() {
            renderAvailableForms(currentFormsPage + 1, searchInput.value.trim(), zipInput.value.trim());
        });
    }
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderAvailableForms(0, searchInput.value.trim(), zipInput.value.trim());
        });
    }
    if (zipInput) {
        zipInput.addEventListener('input', function(e) {
            // Only allow numbers, max 5 digits
            let val = zipInput.value.replace(/\D/g, '');
            if (val.length > 5) val = val.slice(0, 5);
            zipInput.value = val;
            renderAvailableForms(0, searchInput.value.trim(), zipInput.value.trim());
        });
    }
    // Initial render
    renderAvailableForms(0);
});

document.addEventListener('DOMContentLoaded', function() {
    // Scroll to Available Forms
    const newFormBtn = document.getElementById('new-form-btn');
    if (newFormBtn) {
        newFormBtn.addEventListener('click', function() {
            const availableSection = document.querySelector('.main-forms-wrapper .forms-card:nth-of-type(2)');
            if (availableSection) {
                const rect = availableSection.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const sectionMiddle = rect.top + scrollTop + rect.height / 2;
                const viewportMiddle = window.innerHeight / 2;
                window.scrollTo({
                    top: sectionMiddle - viewportMiddle,
                    behavior: 'smooth'
                });
            }
        });
    }
    // Scroll to My Forms
    const myFormsBtn = document.getElementById('my-forms-btn');
    if (myFormsBtn) {
        myFormsBtn.addEventListener('click', function() {
            const portfolioSection = document.getElementById('portfolio-section');
            if (portfolioSection) {
                portfolioSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
    // Scroll to My Documents
    const documentsBtn = document.getElementById('documents-btn');
    if (documentsBtn) {
        documentsBtn.addEventListener('click', function() {
            const documentsSection = document.getElementById('documents-section');
            if (documentsSection) {
                documentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
    // Open Settings Modal
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            openSettings();
        });
    }
});

// Settings modal logout button
const settingsLogoutBtn = document.getElementById('settings-logout-btn');
if (settingsLogoutBtn) {
    settingsLogoutBtn.addEventListener('click', function() {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        }).catch((error) => {
            alert('Sign Out Error: ' + error.message);
        });
    });
}

// New logic for settings modal buttons
const settingsSaveBtn = document.getElementById('settings-save-btn');
let originalSettings = {};
function getSettingsFormData() {
    return {
        firstName: document.getElementById('settings-first-name').value.trim(),
        lastName: document.getElementById('settings-last-name').value.trim(),
        email: document.getElementById('settings-email').value.trim(),
        phone: document.getElementById('settings-phone').value.trim(),
        street: document.getElementById('settings-street').value.trim(),
        city: document.getElementById('settings-city').value.trim(),
        state: document.getElementById('settings-state').value,
        zip: document.getElementById('settings-zip').value.trim()
    };
}
function isSettingsChanged() {
    const data = getSettingsFormData();
    return (
        data.firstName !== (originalSettings.firstName || '') ||
        data.lastName !== (originalSettings.lastName || '') ||
        data.email !== (originalSettings.email || '') ||
        data.phone !== (originalSettings.phone || '') ||
        data.street !== (originalSettings.street || '') ||
        data.city !== (originalSettings.city || '') ||
        data.state !== (originalSettings.state || '') ||
        data.zip !== (originalSettings.zip || '')
    );
}
function updateSettingsSaveBtn() {
    if (isSettingsChanged()) {
        settingsSaveBtn.textContent = 'Save Changes';
        settingsSaveBtn.disabled = false;
    } else {
        settingsSaveBtn.textContent = 'Back';
        settingsSaveBtn.disabled = false;
    }
}
// On modal open, store original values
function storeOriginalSettings() {
    originalSettings = getSettingsFormData();
    updateSettingsSaveBtn();
}
// Attach to modal open logic
if (userSettingsBtn) {
    userSettingsBtn.addEventListener('click', async function() {
        storeOriginalSettings();
    });
}
// Also attach to openSettings()
function openSettings() {
    settingsModal.style.display = 'block';
    storeOriginalSettings();
}
// Listen for changes
['settings-first-name','settings-last-name','settings-email','settings-phone','settings-street','settings-city','settings-state','settings-zip'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', updateSettingsSaveBtn);
        el.addEventListener('change', updateSettingsSaveBtn);
    }
});

document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && auth.currentUser) {
        listenToMyForms(auth.currentUser.uid);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    // Delete Account button logic
    const deleteBtn = document.getElementById('settings-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
            const user = auth.currentUser;
            if (!user) return;
            try {
                // Delete user Firestore data
                await db.collection('users').doc(user.uid).delete();
                // Delete all forms subcollection
                const formsSnap = await db.collection('users').doc(user.uid).collection('forms').get();
                const batch = db.batch();
                formsSnap.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                // Delete all formAnswers subcollection
                const answersSnap = await db.collection('users').doc(user.uid).collection('formAnswers').get();
                const batch2 = db.batch();
                answersSnap.forEach(doc => batch2.delete(doc.ref));
                await batch2.commit();
                // Delete the auth user
                await user.delete();
                window.location.href = 'index.html';
            } catch (err) {
                alert('Failed to delete account: ' + (err && err.message ? err.message : err));
            }
        });
    }
});

// --- My Documents Section Logic ---
const myDocumentsList = document.getElementById('my-documents-list');
const noDocumentsMessage = document.getElementById('no-documents-message');
// Track selected documents
const selectedDocuments = new Set();
// Add Delete Documents button
let deleteDocumentsBtn = document.getElementById('delete-documents-button');
if (!deleteDocumentsBtn) {
    deleteDocumentsBtn = document.createElement('button');
    deleteDocumentsBtn.id = 'delete-documents-button';
    deleteDocumentsBtn.className = 'remove-button';
    deleteDocumentsBtn.textContent = 'Delete Documents';
    deleteDocumentsBtn.style.display = 'none';
    deleteDocumentsBtn.style.background = '#e74c3c';
    deleteDocumentsBtn.style.color = '#fff';
    deleteDocumentsBtn.style.maxWidth = '180px';
    deleteDocumentsBtn.style.width = '100%';
    deleteDocumentsBtn.style.margin = '32px auto 0 auto';
    deleteDocumentsBtn.style.display = 'block';
    myDocumentsList.parentNode.insertBefore(deleteDocumentsBtn, myDocumentsList.nextSibling);
}

function renderMyDocuments(docs) {
    myDocumentsList.innerHTML = '';
    if (docs.length === 0) {
        noDocumentsMessage.style.display = 'block';
        deleteDocumentsBtn.style.display = 'none';
    } else {
        noDocumentsMessage.style.display = 'none';
        // Sort by purchaseDate descending
        docs.sort((a, b) => {
            if (!a.purchaseDate && !b.purchaseDate) return 0;
            if (!a.purchaseDate) return 1;
            if (!b.purchaseDate) return -1;
            const aDate = a.purchaseDate?.toDate ? a.purchaseDate.toDate() : new Date(a.purchaseDate);
            const bDate = b.purchaseDate?.toDate ? b.purchaseDate.toDate() : new Date(b.purchaseDate);
            return bDate - aDate;
        });
        
        // Group documents by their base form ID and purchase date (within 1 minute)
        const documentGroups = groupDocumentsByFormAndTime(docs);
        
        // Render each group
        documentGroups.forEach((group, groupIndex) => {
            if (group.length === 1) {
                // Single document - render normally
                renderSingleDocument(group[0]);
            } else {
                // Multiple documents - render as a group
                renderDocumentGroup(group, groupIndex);
            }
        });
        
        updateDeleteDocumentsButton();
    }
}

function groupDocumentsByFormAndTime(docs) {
    const groups = [];
    const processed = new Set();
    
    docs.forEach((doc, index) => {
        if (processed.has(index)) return;
        
        const group = [doc];
        processed.add(index);
        
        // Find related documents (same portfolio ID, or same original form ID and similar purchase time)
        const portfolioId = doc.portfolioId;
        const originalFormId = doc.originalFormId || doc.formId;
        const docTime = doc.purchaseDate?.toDate ? doc.purchaseDate.toDate() : new Date(doc.purchaseDate || 0);
        
        docs.forEach((otherDoc, otherIndex) => {
            if (processed.has(otherIndex) || otherIndex === index) return;
            
            const otherPortfolioId = otherDoc.portfolioId;
            const otherOriginalFormId = otherDoc.originalFormId || otherDoc.formId;
            const otherTime = otherDoc.purchaseDate?.toDate ? otherDoc.purchaseDate.toDate() : new Date(otherDoc.purchaseDate || 0);
            
            // Primary grouping: same portfolio ID
            // Secondary grouping: same original form and within 1 minute
            const samePortfolio = portfolioId && otherPortfolioId && portfolioId === otherPortfolioId;
            const sameFormAndTime = originalFormId && otherOriginalFormId && originalFormId === otherOriginalFormId && 
                                  Math.abs(docTime - otherTime) < 60000; // 1 minute in milliseconds
            
            if (samePortfolio || sameFormAndTime) {
                group.push(otherDoc);
                processed.add(otherIndex);
            }
        });
        
        groups.push(group);
    });
    
    return groups;
}

function renderSingleDocument(doc) {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            // Match My Form Portfolio card width and style
            li.style.width = '90%';
            li.style.maxWidth = '600px';
            li.style.minWidth = '600px';
            li.style.padding = '18px 32px 14px 32px';
            li.style.borderRadius = '18px';
            li.style.boxShadow = '0 2px 16px rgba(44,62,80,0.10)';
            li.style.margin = '0 auto';
            li.style.height = 'auto';
            li.style.display = 'flex';
            li.style.flexDirection = 'column';
            li.style.alignItems = 'center';
            // Add checkbox for selection (top left)
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('form-checkbox');
            checkbox.dataset.docId = doc.id;
            checkbox.style.position = 'absolute';
            checkbox.style.top = '20px';
            checkbox.style.left = '20px';
            checkbox.style.width = '24px';
            checkbox.style.height = '24px';
            checkbox.style.cursor = 'pointer';
            checkbox.style.zIndex = '1';
            checkbox.addEventListener('change', function(e) {
                if (this.checked) {
                    selectedDocuments.add(doc.id);
                } else {
                    selectedDocuments.delete(doc.id);
                }
                updateDeleteDocumentsButton();
                e.stopPropagation();
            });
            checkbox.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            // Add purchase date timestamp (top right) using same class as portfolio
            const purchaseDateDiv = document.createElement('div');
            purchaseDateDiv.className = 'last-opened';
            // No inline style overrides here, let CSS handle it
            if (doc.purchaseDate) {
                const date = doc.purchaseDate.toDate ? doc.purchaseDate.toDate() : new Date(doc.purchaseDate);
                purchaseDateDiv.textContent = timeAgo(date);
            } else {
                purchaseDateDiv.textContent = 'Unknown date';
            }
            li.style.position = 'relative';
            li.appendChild(checkbox);
            li.appendChild(purchaseDateDiv);
            // Add document name as a link (styled like portfolio)
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = doc.name || doc.title || 'Document';
            a.style.display = 'block';
            a.style.textAlign = 'center';
            a.addEventListener('click', function(e) { e.preventDefault(); });
    // Add defendant name under document name if present (styled like portfolio)
    let defendantDiv = null;
    if (doc.defendantName) {
        let capName = doc.defendantName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        defendantDiv = document.createElement('div');
        defendantDiv.className = 'form-county';
        defendantDiv.style.fontWeight = 'bold';
        defendantDiv.style.color = '#e74c3c';
        defendantDiv.textContent = 'Defendant: ' + capName;
    }
            // Add county name under document name if present
            let countyDiv = null;
            if (doc.countyName) {
                countyDiv = document.createElement('div');
                countyDiv.className = 'form-county';
                let countyText = doc.countyName.trim();
                if (!countyText.toLowerCase().endsWith('county')) {
                    countyText += ' County';
                }
                countyDiv.textContent = countyText;
            }
            // Download button (styled like Open button)
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Download';
            downloadBtn.classList.add('form-action-button');
            downloadBtn.style.maxWidth = '220px';
            downloadBtn.style.width = '100%';
            downloadBtn.style.margin = '12px auto 0 auto';
            downloadBtn.style.display = 'block';
            downloadBtn.tabIndex = -1;
            downloadBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (doc.downloadUrl) {
                    window.open(doc.downloadUrl, '_blank');
                } else {
                    alert('No download available for this document.');
                }
            });
            // Make the whole li clickable except for the button
            li.addEventListener('click', function(e) {
                if (e.target === downloadBtn || e.target === checkbox) return;
                if (doc.downloadUrl) {
                    window.open(doc.downloadUrl, '_blank');
                }
            });
            li.appendChild(a);
    if (defendantDiv) li.appendChild(defendantDiv);
            if (countyDiv) li.appendChild(countyDiv);
            li.appendChild(downloadBtn);
            myDocumentsList.appendChild(li);
}

function getFormDisplayName(formId) {
    // Convert form ID to display name
    const formNameMap = {
        'sc100': 'SC-100',
        'sc500': 'SC-500',
        'sc120': 'SC-120',
        'custom-form': 'Custom Form'
    };
    return formNameMap[formId] || formId.toUpperCase();
}

function renderDocumentGroup(docs, groupIndex) {
    // Create a single portfolio-style entry for the group
    const li = document.createElement('li');
    li.style.cursor = 'pointer';
    // Match My Form Portfolio card width and style exactly
    li.style.width = '90%';
    li.style.maxWidth = '600px';
    li.style.minWidth = '600px';
    li.style.padding = '18px 32px 14px 32px';
    li.style.borderRadius = '18px';
    li.style.boxShadow = '0 2px 16px rgba(44,62,80,0.10)';
    li.style.margin = '0 auto';
    li.style.height = 'auto';
    li.style.display = 'flex';
    li.style.flexDirection = 'column';
    li.style.alignItems = 'center';
    li.style.position = 'relative';
    
    // Add checkbox for selection (top left) - same as portfolio
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('form-checkbox');
    // Store all document IDs for this group
    docs.forEach(doc => {
        checkbox.dataset.docId = doc.id;
    });
    checkbox.style.position = 'absolute';
    checkbox.style.top = '20px';
    checkbox.style.left = '20px';
    checkbox.style.width = '24px';
    checkbox.style.height = '24px';
    checkbox.style.cursor = 'pointer';
    checkbox.style.zIndex = '1';
    checkbox.addEventListener('change', function(e) {
        const isChecked = this.checked;
        docs.forEach(doc => {
            if (isChecked) {
                selectedDocuments.add(doc.id);
            } else {
                selectedDocuments.delete(doc.id);
            }
        });
        updateDeleteDocumentsButton();
        e.stopPropagation();
    });
    checkbox.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // Add purchase date timestamp (top right) - same as portfolio
    const purchaseDateDiv = document.createElement('div');
    purchaseDateDiv.className = 'last-opened';
    // Use the most recent purchase date from the group
    const mostRecentDate = docs.reduce((latest, doc) => {
        const docDate = doc.purchaseDate?.toDate ? doc.purchaseDate.toDate() : new Date(doc.purchaseDate || 0);
        return docDate > latest ? docDate : latest;
    }, new Date(0));
    purchaseDateDiv.textContent = timeAgo(mostRecentDate);
    
    // Get the original form name from the first document
    const originalFormId = docs[0].originalFormId || docs[0].formId;
    const originalFormName = getFormDisplayName(originalFormId);
    
    // Add document name as a link (styled like portfolio)
    const a = document.createElement('a');
    a.href = '#';
            a.textContent = originalFormName;
    a.style.display = 'block';
    a.style.textAlign = 'center';
    a.style.fontWeight = 'bold';
    a.style.fontSize = '18px';
    a.style.color = '#2980b9';
    a.addEventListener('click', function(e) { e.preventDefault(); });
    
    // Add county info if available (from first document)
    let countyDiv = null;
    if (docs[0].countyName) {
        countyDiv = document.createElement('div');
        countyDiv.className = 'form-county';
        countyDiv.style.fontSize = '14px';
        countyDiv.style.color = '#153a5b';
        countyDiv.style.marginTop = '4px';
        let countyText = docs[0].countyName.trim();
        if (!countyText.toLowerCase().endsWith('county')) {
            countyText += ' County';
        }
        countyDiv.textContent = countyText;
    }
    
    // Download All button (styled like portfolio Open button)
    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.textContent = 'Download All';
    downloadAllBtn.classList.add('form-action-button');
    downloadAllBtn.style.maxWidth = '220px';
    downloadAllBtn.style.width = '100%';
    downloadAllBtn.style.margin = '12px auto 0 auto';
    downloadAllBtn.style.display = 'block';
    downloadAllBtn.tabIndex = -1;
    downloadAllBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        // Download all documents in the group
        docs.forEach((doc, index) => {
            setTimeout(() => {
                if (doc.downloadUrl) {
                    window.open(doc.downloadUrl, '_blank');
                }
            }, index * 500); // Stagger downloads by 500ms
        });
    });
    
    // Make the whole li clickable except for the button
    li.addEventListener('click', function(e) {
        if (e.target === downloadAllBtn || e.target === checkbox) return;
        // Download all documents when clicking the card
        docs.forEach((doc, index) => {
            setTimeout(() => {
                if (doc.downloadUrl) {
                    window.open(doc.downloadUrl, '_blank');
                }
            }, index * 500);
        });
    });
    
    li.appendChild(checkbox);
    li.appendChild(purchaseDateDiv);
    li.appendChild(a);
    if (countyDiv) li.appendChild(countyDiv);
    li.appendChild(downloadAllBtn);
    
    myDocumentsList.appendChild(li);
}
function updateDeleteDocumentsButton() {
    if (selectedDocuments.size > 0) {
        deleteDocumentsBtn.style.display = 'block';
    } else {
        deleteDocumentsBtn.style.display = 'none';
    }
}
// Delete selected documents
deleteDocumentsBtn.addEventListener('click', async () => {
    if (selectedDocuments.size === 0) return;
    if (!confirm('Are you sure you want to delete the selected documents? This cannot be undone.')) return;
    const userId = auth.currentUser.uid;
    const db = firebase.firestore();
    const storage = firebase.storage();
    for (const docId of selectedDocuments) {
        // Delete from Firestore
        await db.collection('users').doc(userId).collection('documents').doc(docId).delete();
        // Delete from Storage
        try {
            const storageRef = storage.ref().child(`users/${userId}/documents/${docId}.pdf`);
            await storageRef.delete();
        } catch (e) {
            // Ignore if not found
        }
    }
    selectedDocuments.clear();
    updateDeleteDocumentsButton();
});

let documentsUnsubscribe = null;
function listenToMyDocuments(userId) {
    if (documentsUnsubscribe) documentsUnsubscribe();
    documentsUnsubscribe = db.collection('users').doc(userId).collection('documents')
        .onSnapshot((querySnapshot) => {
            const docs = [];
            querySnapshot.forEach((doc) => {
                docs.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            renderMyDocuments(docs);
        }, (error) => {
            console.error('Error listening to user documents:', error);
        });
}

/* ---------- smooth scroll helper ---------- */
function scrollToSection(sectionEl, offset = 50) {
    const y = sectionEl.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: y, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', function () {
    /* NEW FORM → Available Forms card */
    const newFormBtn      = document.getElementById('new-form-btn');
    const availableCard   = document.querySelector('.main-forms-wrapper .forms-card:nth-of-type(3)'); // the "Available Forms" card
    if (newFormBtn && availableCard) {
        newFormBtn.addEventListener('click', () => scrollToSection(availableCard));
    }

    /* MY FORMS → My Form Portfolio card */
    const myFormsBtn      = document.getElementById('my-forms-btn');
    const portfolioCard   = document.getElementById('portfolio-section');
    if (myFormsBtn && portfolioCard) {
        myFormsBtn.addEventListener('click', () => scrollToSection(portfolioCard));
    }

    /* MY DOCUMENTS → My Documents card */
    const documentsBtn    = document.getElementById('documents-btn');
    const documentsCard   = document.getElementById('documents-section');
    if (documentsBtn && documentsCard) {
        documentsBtn.addEventListener('click', () => scrollToSection(documentsCard));
    }
});

document.addEventListener('DOMContentLoaded', function() {
  // ... existing code ...
  // Enforce numeric-only input for ZIP code in settings
  var settingsZipInput = document.getElementById('settings-zip');
  if (settingsZipInput) {
    settingsZipInput.addEventListener('input', function() {
      let val = settingsZipInput.value.replace(/\D/g, '');
      if (val.length > 5) val = val.slice(0, 5);
      settingsZipInput.value = val;
    });
  }
});

// --- CART SIDE MENU LOGIC ---
function openCartSideMenu() {
    const cartOverlay = document.getElementById('cart-overlay');
    const cartSideMenu = document.getElementById('cart-side-menu');
    cartOverlay.classList.add('active');
    cartSideMenu.classList.add('active');
    cartOverlay.style.opacity = '1';
    cartOverlay.style.visibility = 'visible';
    document.body.style.overflow = 'hidden';
}
function closeCartSideMenu() {
    const cartOverlay = document.getElementById('cart-overlay');
    const cartSideMenu = document.getElementById('cart-side-menu');
    cartOverlay.classList.remove('active');
    cartSideMenu.classList.remove('active');
    cartOverlay.style.opacity = '0';
    cartOverlay.style.visibility = 'hidden';
    document.body.style.overflow = '';
}
// Cart icon click handler
document.addEventListener('DOMContentLoaded', function() {
    const cartIconLink = document.getElementById('cart-icon-link');
    const cartOverlay = document.getElementById('cart-overlay');
    const cartSideMenu = document.getElementById('cart-side-menu');
    const cartCloseBtn = document.getElementById('cart-close-btn');
    const cartContent = document.getElementById('cart-content');
    const cartMessage = document.getElementById('cart-message');
    const cartDescription = document.getElementById('cart-description');
    const cartSignupBtn = document.getElementById('cart-signup-btn');
    const cartItemsList = document.getElementById('cart-items-list');
    const cartCheckoutBtn = document.getElementById('cart-checkout-btn');
    if (cartIconLink) {
        cartIconLink.addEventListener('click', async function(e) {
            e.preventDefault();
            if (auth.currentUser) {
                openCartSideMenu();
                cartMessage.style.display = 'none';
                cartDescription.style.display = 'none';
                cartSignupBtn.style.display = 'none';
                cartItemsList.style.display = 'block';
                cartCheckoutBtn.style.display = 'none';
                cartItemsList.innerHTML = '';
                // --- Use formwiz_cart cookie for cart data (like cart.html) ---
                function getCookie(name) {
                    const eq = name + '=';
                    const parts = document.cookie.split(';');
                    for (let c of parts) {
                        while (c.charAt(0) === ' ') c = c.slice(1);
                        if (c.indexOf(eq) === 0) return c.slice(eq.length);
                    }
                    return null;
                }
                let cart = [];
                try {
                    // Try cookie first, then localStorage as fallback
                    let cartData = getCookie('formwiz_cart');
                    if (!cartData) {
                        cartData = localStorage.getItem('formwiz_cart');
                    }
                    if (cartData) {
                        // Decode URL-encoded data if needed
                        const decodedData = cartData.startsWith('%') ? decodeURIComponent(cartData) : cartData;
                        cart = JSON.parse(decodedData);
                    }
                } catch (e) { 
                    console.error('Error parsing cart data:', e);
                    cart = []; 
                }
                if (!Array.isArray(cart) || cart.length === 0) {
                    cartItemsList.innerHTML = '<div style="color:#7f8c8d;font-size:1.1em;margin-top:18px;">Your cart is empty.</div>';
                    cartCheckoutBtn.style.display = 'none';
                    return;
                }
                let total = 0;
                // Fetch prices for all items (simulate fetchStripePrice)
                async function fetchStripePrice(priceId) {
                    try {
                        const res = await fetch(`/stripe-price/${priceId}`, { mode: 'cors' });
                        if (!res.ok) return null;
                        const data = await res.json();
                        return data;
                    } catch {
                        return null;
                    }
                }
                // Render cart items with price fetch
                cartItemsList.innerHTML = '<div style="color:#7f8c8d;font-size:1.1em;margin-top:18px;">Loading cart...</div>';
                let html = '';
                let totalAmount = 0;
                let itemCount = 0;
                for (const item of cart) {
                    const priceInfo = await fetchStripePrice(item.priceId);
                    let display = '...';
                    let priceVal = 0;
                    if (priceInfo && priceInfo.unit_amount != null) {
                        display = `$${(priceInfo.unit_amount / 100).toFixed(2)}`;
                        priceVal = priceInfo.unit_amount / 100;
                        totalAmount += priceVal;
                    }
                    // Capitalize defendant's name if present
                    let defendantDisplay = '';
                    if (item.defendantName) {
                        const capName = String(item.defendantName)
                          .split(/\s+/)
                          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                          .join(' ');
                        defendantDisplay = `<div style='font-weight:bold;color:#e74c3c;'>Defendant: ${capName}</div>`;
                    }
                    html += `
                        <div class="cart-item">
                            <div class="cart-item-info">
                                <div class="cart-item-title">${item.title || 'Form'}</div>
                                ${defendantDisplay}
                                ${item.countyName ? `<div class='cart-item-county' style='font-size:0.98em;color:#153a5b;margin-bottom:2px;'>${item.countyName}${item.countyName.toLowerCase().includes('county') ? '' : ' County'}</div>` : ''}
                                <div class="cart-item-price">${display}</div>
                            </div>
                            <button class="remove-item" title="Remove" onclick="(function(){const cart=JSON.parse(decodeURIComponent(document.cookie.split('; ').find(row=>row.startsWith('formwiz_cart='))?.split('=')[1]||'[]'));cart.splice(${itemCount},1);document.cookie='formwiz_cart='+encodeURIComponent(JSON.stringify(cart))+';path=/;max-age=2592000';window.location.reload();})()">
                                <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 20 20' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='3 6 5 6 21 6'></polyline><path d='M19 6l-2 14H7L5 6'></path><path d='M10 11v6'></path><path d='M14 11v6'></path><path d='M5 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2'></path></svg>
                            </button>
                        </div>
                    `;
                    itemCount++;
                }
                // Total and checkout
                html += `<div class="cart-summary">
                    <div class="summary-label">Total:</div>
                    <div class="total-amount">$${totalAmount.toFixed(2)}</div>
                </div>`;
                cartItemsList.innerHTML = html;
                cartCheckoutBtn.style.display = 'block';
            } else {
                openCartSideMenu();
                cartMessage.style.display = 'block';
                cartDescription.style.display = 'block';
                cartSignupBtn.style.display = 'inline-block';
                cartItemsList.style.display = 'none';
                cartCheckoutBtn.style.display = 'none';
            }
        });
    }
    if (cartCloseBtn) {
        cartCloseBtn.addEventListener('click', closeCartSideMenu);
    }
    if (cartOverlay) {
        cartOverlay.addEventListener('click', function(e) {
            if (e.target === cartOverlay) closeCartSideMenu();
        });
    }
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeCartSideMenu();
    });
    if (cartCheckoutBtn) {
        cartCheckoutBtn.addEventListener('click', function() {
            window.location.href = 'cart.html';
        });
    }
});

// County Selection Modal
let pendingCountyData = null;
let currentCounty = null;

function showCountyModal(formId, formUrl, formName) {
    const modal = document.getElementById('county-modal');
    const closeBtn = document.getElementById('county-modal-close');
    const submitBtn = document.getElementById('county-modal-submit');
    const cancelBtn = document.getElementById('county-modal-cancel');
    const zipInput = document.getElementById('county-zip-input');
    const errorDiv = document.getElementById('county-modal-error');
    const title = document.getElementById('county-modal-title');
    const message = document.getElementById('county-modal-message');
    const buttons = document.getElementById('county-modal-buttons');
    
    // Reset modal to initial state
    title.textContent = 'Which county are you filing in?';
    message.textContent = 'Enter your zip code below to determine your county.';
    zipInput.style.display = 'block';
    zipInput.value = '';
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    submitBtn.textContent = 'Submit';
    submitBtn.style.display = 'block';
    cancelBtn.style.display = 'block';
    modal.style.display = 'block';
    
    pendingCountyData = { formId, formUrl, formName };
    currentCounty = null;
    
    function closeModal() {
        modal.style.display = 'none';
        pendingCountyData = null;
        currentCounty = null;
    }
    
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    
    window.onclick = function(event) {
        if (event.target == modal) closeModal();
    };
    
    // Handle zip code input - only allow numbers
    zipInput.addEventListener('input', function() {
        let val = zipInput.value.replace(/\D/g, '');
        if (val.length > 5) val = val.slice(0, 5);
        zipInput.value = val;
    });
    
    submitBtn.onclick = async function() {
        if (!currentCounty) {
            // First step: validate zip code and find county
            const zipValue = zipInput.value.trim();
            if (!zipValue || zipValue.length !== 5) {
                errorDiv.textContent = 'Please enter a valid 5-digit zip code.';
                errorDiv.style.display = 'block';
                return;
            }
            
            // Find county for this zip
            const countyZipMap = await loadCountyZipMap();
            let foundCounty = null;
            for (const [county, zips] of Object.entries(countyZipMap)) {
                if (zips.includes(zipValue)) {
                    foundCounty = county;
                    break;
                }
            }
            
            if (!foundCounty) {
                errorDiv.textContent = 'No county found for this zip code.';
                errorDiv.style.display = 'block';
                return;
            }
            
            // Check if form supports this county
            let formObj = null;
            if (!availableFormsData.length) {
                availableFormsData = await loadAvailableForms();
            }
            formObj = availableFormsData.find(f => f.id === formId);
            if (formObj && (!Array.isArray(formObj.counties) || !formObj.counties.includes(foundCounty))) {
                errorDiv.textContent = `This form is not offered in ${foundCounty} County. Please try a different zip code.`;
                errorDiv.style.display = 'block';
                return;
            }
            
            // Show confirmation step
            currentCounty = foundCounty;
            // Store the zip code for later use
            if (pendingCountyData) {
                pendingCountyData.zipCode = zipValue;
            }
            title.textContent = 'Confirm County';
            message.textContent = `Great, you're filing in ${foundCounty} County right?`;
            zipInput.style.display = 'none';
            errorDiv.style.display = 'none';
            submitBtn.textContent = 'Yes';
            cancelBtn.textContent = 'No';
            
        } else {
            // Second step: user confirmed county, proceed with form addition
            modal.style.display = 'none';
            
            if (pendingCountyData) {
                // Check for duplicates
                const userId = auth.currentUser.uid;
                try {
                    const formsSnapshot = await db.collection('users').doc(userId).collection('forms').get();
                    let duplicateFound = false;
                    
                    formsSnapshot.forEach(doc => {
                        const formData = doc.data();
                        if ((formData.originalFormId === formId || doc.id === formId) && formData.countyName === currentCounty) {
                            duplicateFound = true;
                        }
                    });
                    
                    if (duplicateFound) {
                        showDuplicateFormModal(pendingCountyData.formName, currentCounty, pendingCountyData.formId, pendingCountyData.formUrl, currentCounty);
                    } else {
                        // Check if form requires defendant
                        let formObj = null;
                        if (!availableFormsData.length) {
                            availableFormsData = await loadAvailableForms();
                        }
                        formObj = availableFormsData.find(f => f.id === pendingCountyData.formId);
                        
                        if (formObj && formObj.defendant && formObj.defendant.toUpperCase() === 'YES') {
                            showDefendantModal(formObj, pendingCountyData.formId, pendingCountyData.formUrl, pendingCountyData.formName, currentCounty);
                        } else {
                            await addFormToPortfolioInternal(pendingCountyData.formId, pendingCountyData.formUrl, pendingCountyData.formName, currentCounty);
                        }
                    }
                } catch (error) {
                    console.error('Error checking for duplicate form:', error);
                }
                
                pendingCountyData = null;
                currentCounty = null;
            }
        }
    };
    
    // Handle "No" button - go back to zip code input
    cancelBtn.onclick = function() {
        if (currentCounty) {
            // Go back to zip code input
            title.textContent = 'Which county are you filing in?';
            message.textContent = 'Enter your zip code below to determine your county.';
            zipInput.style.display = 'block';
            zipInput.value = '';
            errorDiv.style.display = 'none';
            errorDiv.textContent = '';
            submitBtn.textContent = 'Submit';
            cancelBtn.textContent = 'Cancel';
            currentCounty = null;
        } else {
            closeModal();
        }
    };
}

// Defendant Name Modal
let pendingDefendantData = null;

function showDefendantModal(formObj, formId, formUrl, formName, countyName, isDuplicate = false) {
    const modal = document.getElementById('defendant-modal');
    const closeBtn = document.getElementById('defendant-modal-close');
    const submitBtn = document.getElementById('defendant-modal-submit');
    const cancelBtn = document.getElementById('defendant-modal-cancel');
    const input = document.getElementById('defendant-name-input');
    const errorDiv = document.getElementById('defendant-modal-error');
    input.value = '';
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    modal.style.display = 'block';
    pendingDefendantData = { formObj, formId, formUrl, formName, countyName, isDuplicate, zipCode: pendingCountyData ? pendingCountyData.zipCode : null };
    function closeModal() {
        modal.style.display = 'none';
        pendingDefendantData = null;
    }
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    window.onclick = function(event) {
        if (event.target == modal) closeModal();
    };
    submitBtn.onclick = async function() {
        const defendantName = input.value.trim();
        if (!defendantName) {
            errorDiv.textContent = 'Please enter the defendant\'s name.';
            errorDiv.style.display = 'block';
            return;
        }
        modal.style.display = 'none';
        if (pendingDefendantData) {
            await addFormToPortfolioInternal(
                pendingDefendantData.formId,
                pendingDefendantData.formUrl,
                pendingDefendantData.formName,
                pendingDefendantData.countyName,
                pendingDefendantData.isDuplicate,
                defendantName
            );
            pendingDefendantData = null;
        }
    };
}