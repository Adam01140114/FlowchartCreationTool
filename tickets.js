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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const ticketForm = document.getElementById('ticket-form');
const ticketTitle = document.getElementById('ticket-title');
const ticketDescription = document.getElementById('ticket-description');
const ticketPriority = document.getElementById('ticket-priority');
const ticketDifficulty = document.getElementById('ticket-difficulty');
const difficultyValue = document.getElementById('difficulty-value');
const ticketCategory = document.getElementById('ticket-category');
const formError = document.getElementById('form-error');
const formSuccess = document.getElementById('form-success');
const ticketsContainer = document.getElementById('tickets-container');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const categoryList = document.getElementById('category-list');
const newCategoryInput = document.getElementById('new-category-input');
const addCategoryBtn = document.getElementById('add-category-btn');
const settingsError = document.getElementById('settings-error');

let currentUser = null;
let categories = [];

// Update difficulty value display
ticketDifficulty.addEventListener('input', (e) => {
  difficultyValue.textContent = e.target.value;
});

// Check authentication status
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await loadCategories();
    await loadTickets();
  } else {
    // Redirect to login if not authenticated
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/login.html?redirect=${redirect}`;
  }
});

// Load categories from Firebase
async function loadCategories() {
  try {
    const userCategoriesRef = db.collection('users').doc(currentUser.uid)
      .collection('ticketCategories');
    
    const snapshot = await userCategoriesRef.get();
    categories = [];
    
    if (snapshot.empty) {
      // No categories yet - initialize with empty array
      categories = [];
    } else {
      snapshot.forEach(doc => {
        categories.push({
          id: doc.id,
          name: doc.data().name
        });
      });
    }
    
    updateCategoryDropdown();
    updateCategoryList();
  } catch (error) {
    console.error('Error loading categories:', error);
    formError.textContent = 'Error loading categories. Please refresh the page.';
  }
}

// Update category dropdown
function updateCategoryDropdown() {
  ticketCategory.innerHTML = '<option value="">No category</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    ticketCategory.appendChild(option);
  });
}

// Update category list in settings modal
function updateCategoryList() {
  if (categories.length === 0) {
    categoryList.innerHTML = '<div class="empty-state"><p>No categories yet. Add your first category below.</p></div>';
    return;
  }
  
  categoryList.innerHTML = '';
  categories.forEach(category => {
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.innerHTML = `
      <span class="category-name">${category.name}</span>
      <button type="button" class="btn btn-small btn-danger" data-category-id="${category.id}">Delete</button>
    `;
    
    const deleteBtn = categoryItem.querySelector('button');
    deleteBtn.addEventListener('click', () => deleteCategory(category.id));
    
    categoryList.appendChild(categoryItem);
  });
}

// Add category
addCategoryBtn.addEventListener('click', async () => {
  const categoryName = newCategoryInput.value.trim();
  
  if (!categoryName) {
    settingsError.textContent = 'Please enter a category name.';
    return;
  }
  
  // Check if category already exists
  if (categories.some(cat => cat.name.toLowerCase() === categoryName.toLowerCase())) {
    settingsError.textContent = 'This category already exists.';
    return;
  }
  
  try {
    settingsError.textContent = '';
    const userCategoriesRef = db.collection('users').doc(currentUser.uid)
      .collection('ticketCategories');
    
    const docRef = await userCategoriesRef.add({
      name: categoryName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    categories.push({
      id: docRef.id,
      name: categoryName
    });
    
    newCategoryInput.value = '';
    updateCategoryDropdown();
    updateCategoryList();
  } catch (error) {
    console.error('Error adding category:', error);
    settingsError.textContent = 'Error adding category. Please try again.';
  }
});

// Delete category
async function deleteCategory(categoryId) {
  if (!confirm('Are you sure you want to delete this category? Tickets with this category will keep their category ID but the category name will be unavailable.')) {
    return;
  }
  
  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('ticketCategories')
      .doc(categoryId)
      .delete();
    
    categories = categories.filter(cat => cat.id !== categoryId);
    updateCategoryDropdown();
    updateCategoryList();
  } catch (error) {
    console.error('Error deleting category:', error);
    settingsError.textContent = 'Error deleting category. Please try again.';
  }
}

// Submit ticket form
ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  formSuccess.textContent = '';
  
  const title = ticketTitle.value.trim();
  const description = ticketDescription.value.trim();
  const priority = ticketPriority.value;
  const difficulty = parseInt(ticketDifficulty.value);
  const categoryId = ticketCategory.value;
  
  if (!title || !priority || !difficulty) {
    formError.textContent = 'Please fill in all required fields.';
    return;
  }
  
  try {
    const ticketsRef = db.collection('users').doc(currentUser.uid)
      .collection('tickets');
    
    const ticketData = {
      title,
      description,
      priority,
      difficulty,
      categoryId: categoryId || null,
      status: 'open',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await ticketsRef.add(ticketData);
    
    // Reset form
    ticketForm.reset();
    difficultyValue.textContent = '5';
    ticketDifficulty.value = 5;
    
    formSuccess.textContent = 'Ticket submitted successfully!';
    setTimeout(() => {
      formSuccess.textContent = '';
    }, 3000);
    
    // Reload tickets
    await loadTickets();
  } catch (error) {
    console.error('Error submitting ticket:', error);
    formError.textContent = 'Error submitting ticket. Please try again.';
  }
});

// Load tickets from Firebase
async function loadTickets() {
  try {
    const ticketsRef = db.collection('users').doc(currentUser.uid)
      .collection('tickets')
      .orderBy('createdAt', 'desc');
    
    const snapshot = await ticketsRef.get();
    
    if (snapshot.empty) {
      ticketsContainer.innerHTML = '<div class="empty-state"><p>No tickets submitted yet.</p></div>';
      return;
    }
    
    ticketsContainer.innerHTML = '';
    
    snapshot.forEach(doc => {
      const ticket = doc.data();
      const ticketItem = createTicketElement(doc.id, ticket);
      ticketsContainer.appendChild(ticketItem);
    });
  } catch (error) {
    console.error('Error loading tickets:', error);
    ticketsContainer.innerHTML = '<div class="empty-state"><p>Error loading tickets. Please refresh the page.</p></div>';
  }
}

// Create ticket element
function createTicketElement(ticketId, ticket) {
  const ticketItem = document.createElement('div');
  ticketItem.className = 'ticket-item';
  
  const categoryName = ticket.categoryId 
    ? categories.find(cat => cat.id === ticket.categoryId)?.name || 'Unknown Category'
    : null;
  
  const priorityClass = `priority-${ticket.priority}`;
  
  ticketItem.innerHTML = `
    <div class="ticket-header">
      <div class="ticket-title">${escapeHtml(ticket.title)}</div>
    </div>
    ${ticket.description ? `<div class="ticket-description">${escapeHtml(ticket.description)}</div>` : ''}
    <div class="ticket-meta">
      <span class="ticket-badge ${priorityClass}">Priority: ${ticket.priority.toUpperCase()}</span>
      <span class="ticket-badge difficulty-badge">Difficulty: ${ticket.difficulty}/10</span>
      ${categoryName ? `<span class="ticket-badge category-badge">${escapeHtml(categoryName)}</span>` : ''}
      <span class="ticket-badge" style="background-color: #e7f3ff; color: #2980b9;">
        ${ticket.createdAt ? formatDate(ticket.createdAt.toDate()) : 'Date unknown'}
      </span>
    </div>
  `;
  
  return ticketItem;
}

// Format date
function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Settings modal controls
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('active');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('active');
  settingsError.textContent = '';
});

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('active');
    settingsError.textContent = '';
  }
});

// Allow Enter key to add category
newCategoryInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCategoryBtn.click();
  }
});
