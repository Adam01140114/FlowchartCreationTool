/**************************************************
 ************ Groups & Organization ***************
 **************************************************/

/**
 * Groups & Organization Module
 * Handles group management, section grouping, and group UI functionality
 */

// Use shared dependency accessors from dependencies.js module

/**
 * Adds a new group to the groups container
 */
function addGroup(groupId = null) {
  const groupsContainer = document.getElementById('groupsContainer');
  if (!groupsContainer) return;

  const groupCounter = getGroupCounter();
  const groups = getGroups();
  const currentGroupId = groupId || groupCounter;
  
  const block = document.createElement('div');
  block.className = 'group-block';
  block.id = 'groupBlock' + currentGroupId;

  block.innerHTML = `
    <h3>Group ${currentGroupId}</h3>
    <label>Group Name: </label>
    <input type="text" id="groupName${currentGroupId}" placeholder="Enter group name" 
           value="Group ${currentGroupId}" oninput="updateGroupName(${currentGroupId})"><br><br>
    <div id="groupSections${currentGroupId}">
      <label>Sections in this group:</label><br>
    </div>
    <button type="button" onclick="addSectionToGroup(${currentGroupId})">Add Section to Group</button>
    <button type="button" onclick="removeGroup(${currentGroupId})">Remove Group</button>
  `;
  groupsContainer.appendChild(block);

  // Increment groupCounter only if not loading from JSON
  if (!groupId) {
    if (window.flowchartConfig) {
      window.flowchartConfig.groupCounter++;
    } else {
      window.groupCounter++;
    }
  }
  
  // Update in-memory model and trigger autosave
  if (!groups[currentGroupId]) groups[currentGroupId] = { name: 'Group ' + currentGroupId, sections: [] };
  const requestAutosave = getRequestAutosave();
  if (requestAutosave) {
    requestAutosave();
  }
}

/**
 * Removes a group block by ID
 */
function removeGroup(groupId) {
  const groups = getGroups();
  const block = document.getElementById('groupBlock' + groupId);
  if (block) block.remove();
  delete groups[groupId];
  
  const requestAutosave = getRequestAutosave();
  if (requestAutosave) {
    requestAutosave();
  }
}

/**
 * Updates the group name display
 */
function updateGroupName(groupId) {
  const groupNameInput = document.getElementById('groupName' + groupId);
  const groupHeader = document.getElementById('groupBlock' + groupId).querySelector('h3');
  if (groupHeader && groupNameInput) {
    groupHeader.textContent = groupNameInput.value;
  }
}

/**
 * Adds a section to a group
 */
function addSectionToGroup(groupId, sectionName = '') {
  const groupSectionsDiv = document.getElementById('groupSections' + groupId);
  if (!groupSectionsDiv) return;

  const sectionCount = groupSectionsDiv.querySelectorAll('.group-section-item').length + 1;
  const sectionItem = document.createElement('div');
  sectionItem.className = 'group-section-item';
  sectionItem.id = 'groupSection' + groupId + '_' + sectionCount;

  // Get ALL section names from sectionPrefs
  const sectionPrefs = window.getSectionPrefs ? window.getSectionPrefs() : (window.flowchartConfig?.sectionPrefs || window.sectionPrefs);
  const allSections = [];
  const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
  Object.keys(currentSectionPrefs).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(sectionId => {
    const sectionName = (currentSectionPrefs[sectionId] && currentSectionPrefs[sectionId].name) ? currentSectionPrefs[sectionId].name : '';
    // Only filter out if it is truly the default placeholder
    if (sectionName.trim() !== '' && sectionName.trim().toLowerCase() !== 'enter section name') {
      allSections.push(sectionName.trim());
    }
  });
  
  // Get currently selected sections to filter them out
  const selectedSections = getSelectedSections();
  
  let dropdownOptions = '<option value="">-- Select a section --</option>';
  allSections.forEach(section => {
    // Only include sections that are not already selected in other groups
    // or if this is the section we're pre-selecting
    if (!selectedSections.has(section) || section === sectionName) {
      const selected = (section === sectionName) ? 'selected' : '';
      dropdownOptions += `<option value="${section}" ${selected}>${section}</option>`;
    }
  });

  sectionItem.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; margin: 5px 0;">
      <select id="groupSectionName${groupId}_${sectionCount}" 
              onchange="handleGroupSectionChange()" 
              style="flex: 1; padding: 5px;">
        ${dropdownOptions}
      </select>
      <button type="button" onclick="removeSectionFromGroup(${groupId}, ${sectionCount})" 
              style="padding: 5px 10px;">Remove</button>
    </div>
  `;
  groupSectionsDiv.appendChild(sectionItem);

  // Set the dropdown value if sectionName was provided
  if (sectionName) {
    const select = sectionItem.querySelector('select');
    if (select) {
      select.value = sectionName;
    }
  }
  
  // Reflect in-memory groups and autosave
  updateGroupsObject();
  const requestAutosave = getRequestAutosave();
  if (requestAutosave) {
    requestAutosave();
  }
}

/**
 * Removes a section from a group
 */
function removeSectionFromGroup(groupId, sectionNumber) {
  const sectionItem = document.getElementById('groupSection' + groupId + '_' + sectionNumber);
  if (sectionItem) {
    sectionItem.remove();
    // Reindex remaining sections
    updateGroupSectionNumbers(groupId);
    updateGroupsObject();
    
    // Refresh all group dropdowns to make removed section available again
    updateGroupDropdowns();
    
    const requestAutosave = getRequestAutosave();
    if (requestAutosave) {
      requestAutosave();
    }
  }
}

/**
 * Updates section numbers after removal
 */
function updateGroupSectionNumbers(groupId) {
  const groupSectionsDiv = document.getElementById('groupSections' + groupId);
  if (!groupSectionsDiv) return;

  const sectionItems = groupSectionsDiv.querySelectorAll('.group-section-item');
  sectionItems.forEach((item, index) => {
    const newNumber = index + 1;
    item.id = 'groupSection' + groupId + '_' + newNumber;
    
    const select = item.querySelector('select');
    if (select) {
      select.id = 'groupSectionName' + groupId + '_' + newNumber;
    }
    
    const button = item.querySelector('button');
    if (button) {
      button.setAttribute('onclick', `removeSectionFromGroup(${groupId}, ${newNumber})`);
    }
  });
}

/**
 * Gets all currently selected sections across all groups
 */
function getSelectedSections() {
  const selectedSections = new Set();
  const groupBlocks = document.querySelectorAll('.group-block');
  
  groupBlocks.forEach(groupBlock => {
    const groupId = groupBlock.id.replace('groupBlock', '');
    const groupSectionsDiv = document.getElementById('groupSections' + groupId);
    
    if (groupSectionsDiv) {
      const sectionItems = groupSectionsDiv.querySelectorAll('.group-section-item');
      sectionItems.forEach(sectionItem => {
        const select = sectionItem.querySelector('select');
        if (select && select.value.trim()) {
          selectedSections.add(select.value.trim());
        }
      });
    }
  });
  
  return selectedSections;
}

/**
 * Handles changes to group section dropdowns
 */
function handleGroupSectionChange() {
  // Update groups object with current selections
  updateGroupsObject();
  
  // Refresh all group dropdowns to update available options
  updateGroupDropdowns();
  
  const requestAutosave = getRequestAutosave();
  if (requestAutosave) {
    requestAutosave();
  }
}

/**
 * Updates the groups object with current selections
 */
function updateGroupsObject() {
  const groups = getGroups();
  // Clear existing groups by setting properties to empty
  Object.keys(groups).forEach(key => delete groups[key]);
  
  const groupBlocks = document.querySelectorAll('.group-block');
  
  groupBlocks.forEach(groupBlock => {
    const groupId = groupBlock.id.replace('groupBlock', '');
    const groupNameEl = document.getElementById('groupName' + groupId);
    const groupName = groupNameEl ? groupNameEl.value.trim() : 'Group ' + groupId;
    
    groups[groupId] = {
      name: groupName,
      sections: []
    };
    
    // Get sections in this group
    const groupSectionsDiv = document.getElementById('groupSections' + groupId);
    if (groupSectionsDiv) {
      const sectionItems = groupSectionsDiv.querySelectorAll('.group-section-item');
      sectionItems.forEach(sectionItem => {
        const select = sectionItem.querySelector('select');
        if (select && select.value.trim()) {
          groups[groupId].sections.push(select.value.trim());
        }
      });
    }
  });
}

/**
 * Loads groups from JSON data
 */
function loadGroupsFromData(groupsData) {
  console.log('loadGroupsFromData called with:', groupsData);
  if (!groupsData || !Array.isArray(groupsData)) {
    console.log('loadGroupsFromData: invalid data, returning');
    return;
  }
  console.log('loadGroupsFromData: groupsData is valid array with length:', groupsData.length);
  
  // Clear existing groups
  const groupsContainer = document.getElementById('groupsContainer');
  if (groupsContainer) {
    const existingGroups = groupsContainer.querySelectorAll('.group-block');
    existingGroups.forEach(group => group.remove());
  }
  
  // Reset counter and groups
  if (window.flowchartConfig) {
    window.flowchartConfig.groupCounter = 1;
    window.flowchartConfig.groups = {};
  } else {
    window.groupCounter = 1;
    window.groups = {};
  }
  
  // Load groups
  groupsData.forEach(group => {
    console.log('Loading group:', group);
    addGroup(group.groupId);
    console.log(`Created group block for groupId ${group.groupId}`);
    
    // Set group name
    const groupNameInput = document.getElementById('groupName' + group.groupId);
    if (groupNameInput && group.name) {
      groupNameInput.value = group.name;
      updateGroupName(group.groupId);
      console.log(`Set group name to "${group.name}" for groupId ${group.groupId}`);
    } else {
      console.log(`Could not find groupName input for groupId ${group.groupId} or name is empty`);
    }
    
    // Add sections to group
    if (group.sections && group.sections.length > 0) {
      group.sections.forEach(sectionName => {
        console.log(`Adding section "${sectionName}" to group ${group.groupId}`);
        addSectionToGroup(group.groupId, sectionName);
      });
    } else {
      console.log(`No sections to add for group ${group.groupId}`);
    }
    
    // Update counter
    const groupCounter = getGroupCounter();
    if (group.groupId >= groupCounter) {
      if (window.flowchartConfig) {
        window.flowchartConfig.groupCounter = group.groupId + 1;
      } else {
        window.groupCounter = group.groupId + 1;
      }
    }
  });
  
  // Update groups object
  updateGroupsObject();
}

/**
 * Gets groups data for export
 */
function getGroupsData() {
  updateGroupsObject();
  const groups = getGroups();
  const groupsArray = [];
  
  Object.keys(groups).forEach(groupId => {
    // Export all groups, even if they have no sections
    groupsArray.push({
      groupId: parseInt(groupId),
      name: groups[groupId].name,
      sections: groups[groupId].sections || []
    });
  });
  
  return groupsArray;
}

/**
 * Updates all group dropdowns with current section names
 */
function updateGroupDropdowns() {
  const groupBlocks = document.querySelectorAll('.group-block');
  
  groupBlocks.forEach(groupBlock => {
    const groupId = groupBlock.id.replace('groupBlock', '');
    const groupSectionsDiv = document.getElementById('groupSections' + groupId);
    
    if (groupSectionsDiv) {
      const sectionItems = groupSectionsDiv.querySelectorAll('.group-section-item');
      sectionItems.forEach(sectionItem => {
        const select = sectionItem.querySelector('select');
        if (select) {
          const currentValue = select.value;
          
          // Get updated section names
          const sectionPrefs = window.getSectionPrefs ? window.getSectionPrefs() : (window.flowchartConfig?.sectionPrefs || window.sectionPrefs);
          const allSections = [];
          const currentSectionPrefs = window.flowchartConfig?.sectionPrefs || window.sectionPrefs || {};
          Object.keys(currentSectionPrefs).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(sectionId => {
            const sectionName = (currentSectionPrefs[sectionId] && currentSectionPrefs[sectionId].name) ? currentSectionPrefs[sectionId].name : '';
            if (sectionName.trim() !== '' && sectionName.trim().toLowerCase() !== 'enter section name') {
              allSections.push(sectionName.trim());
            }
          });
          
          // Get currently selected sections to filter them out
          const selectedSections = getSelectedSections();
          
          // Update dropdown options
          let dropdownOptions = '<option value="">-- Select a section --</option>';
          allSections.forEach(section => {
            // Only include sections that are not already selected in other groups
            // or if this is the currently selected section for this dropdown
            if (!selectedSections.has(section) || section === currentValue) {
              const selected = (section === currentValue) ? 'selected' : '';
              dropdownOptions += `<option value="${section}" ${selected}>${section}</option>`;
            }
          });
          
          select.innerHTML = dropdownOptions;
        }
      });
    }
  });
}

/**************************************************
 ************ Module Exports **********************
 **************************************************/

// Export all functions to window object for global access
window.groups = {
  addGroup,
  removeGroup,
  updateGroupName,
  addSectionToGroup,
  removeSectionFromGroup,
  updateGroupSectionNumbers,
  handleGroupSectionChange,
  updateGroupsObject,
  loadGroupsFromData,
  getGroupsData,
  updateGroupDropdowns
};

// Export individual functions for backward compatibility
window.addGroup = addGroup;
window.removeGroup = removeGroup;
window.updateGroupName = updateGroupName;
window.addSectionToGroup = addSectionToGroup;
window.removeSectionFromGroup = removeSectionFromGroup;
window.updateGroupSectionNumbers = updateGroupSectionNumbers;
window.handleGroupSectionChange = handleGroupSectionChange;
window.updateGroupsObject = updateGroupsObject;
window.loadGroupsFromData = loadGroupsFromData;
window.getGroupsData = getGroupsData;
window.updateGroupDropdowns = updateGroupDropdowns;

/**************************************************
 ************ Default PDF Properties **************
 **************************************************/

// Default PDF Properties object
let defaultPdfProperties = {
  pdfName: "",
  pdfFile: "",
  pdfPrice: ""
};

/**
 * Initialize Default PDF Properties
 */
function initializeDefaultPdfProperties() {
  // Always start with blank properties
  defaultPdfProperties = {
    pdfName: "",
    pdfFile: "",
    pdfPrice: ""
  };
  
  // Update UI with blank values
  updateDefaultPdfPropertiesUI();
}

/**
 * Update Default PDF Properties UI with current values
 */
function updateDefaultPdfPropertiesUI() {
  const nameInput = document.getElementById('defaultPdfNameInput');
  const fileInput = document.getElementById('defaultPdfFileInput');
  const priceInput = document.getElementById('defaultPdfPriceInput');
  
  if (nameInput) nameInput.value = defaultPdfProperties.pdfName || "";
  if (fileInput) fileInput.value = defaultPdfProperties.pdfFile || "";
  if (priceInput) priceInput.value = defaultPdfProperties.pdfPrice || "";
}

/**
 * Update Default PDF Properties from UI inputs
 */
function updateDefaultPdfProperties() {
  const nameInput = document.getElementById('defaultPdfNameInput');
  const fileInput = document.getElementById('defaultPdfFileInput');
  const priceInput = document.getElementById('defaultPdfPriceInput');
  
  if (nameInput) defaultPdfProperties.pdfName = nameInput.value.trim();
  if (fileInput) defaultPdfProperties.pdfFile = fileInput.value.trim();
  if (priceInput) defaultPdfProperties.pdfPrice = priceInput.value.trim();
  
  // Save to localStorage
  localStorage.setItem('defaultPdfProperties', JSON.stringify(defaultPdfProperties));
  
  // Trigger autosave
  const requestAutosave = getRequestAutosave();
  if (requestAutosave) {
    requestAutosave();
  }
}

/**
 * Get Default PDF Properties
 */
function getDefaultPdfProperties() {
  return { ...defaultPdfProperties };
}

/**
 * Set Default PDF Properties
 */
function setDefaultPdfProperties(properties) {
  defaultPdfProperties = { ...properties };
  updateDefaultPdfPropertiesUI();
  
  // Save to localStorage
  localStorage.setItem('defaultPdfProperties', JSON.stringify(defaultPdfProperties));
  
  // Trigger autosave
  const requestAutosave = getRequestAutosave();
  if (requestAutosave) {
    requestAutosave();
  }
}

// Export functions
window.initializeDefaultPdfProperties = initializeDefaultPdfProperties;
window.updateDefaultPdfProperties = updateDefaultPdfProperties;
window.getDefaultPdfProperties = getDefaultPdfProperties;
window.setDefaultPdfProperties = setDefaultPdfProperties;

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDefaultPdfProperties);
} else {
  initializeDefaultPdfProperties();
}
