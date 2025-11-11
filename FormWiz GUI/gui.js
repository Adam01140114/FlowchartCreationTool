/*********************************************
 * gui.js - Multiple OR-Conditions Version
 * WITHOUT embedded hidden-field features
 *********************************************/

// ============================================
// ===========  GLOBAL VARIABLES  =============
// ============================================
let sectionCounter = 1;
let questionCounter = 1;
let checklistItems = [];

// ============================================
// ===========  SECTION FUNCTIONS  ============
// ============================================
function addSection(sectionId = null) {
    const formBuilder = document.getElementById('formBuilder');
    
    // Check if this is the first section and add modules if needed
    const currentSectionId = sectionId || sectionCounter;
    if (currentSectionId === 1) {
        if (!document.getElementById('formNameContainer')) {
            addFormNameModule();
        }
        if (!document.getElementById('pdfConfigurationModule')) {
            createPdfConfigurationModule();
        }
    }
    
    const sectionBlock = document.createElement('div');

    sectionBlock.className = 'section-block';
    sectionBlock.id = `sectionBlock${currentSectionId}`;
    sectionBlock.innerHTML = `
        <h2 id="sectionLabel${currentSectionId}">Section ${currentSectionId}</h2>
        <label>Section Name: </label>
        <input type="text" id="sectionName${currentSectionId}" placeholder="Enter section name"
               value="Section ${currentSectionId}" oninput="updateSectionName(${currentSectionId})"><br><br>
        <div id="questionsSection${currentSectionId}"></div>
        <button type="button" onclick="addQuestion(${currentSectionId})">Add Question to Section</button>
        <button type="button" onclick="removeSection(${currentSectionId})">Remove Section</button>
        <button type="button" onclick="moveSectionUp(${currentSectionId})">Push Section Up</button>
        <button type="button" onclick="moveSectionDown(${currentSectionId})">Push Section Down</button>
        <hr>
    `;

    formBuilder.appendChild(sectionBlock);

    // Increment sectionCounter only if not loading from JSON
    if (!sectionId) {
        sectionCounter++;
    }
    
    // Update group section dropdowns when a new section is added
    if (typeof updateGroupSectionDropdowns === 'function') {
        updateGroupSectionDropdowns();
    }
}

function removeSection(sectionId) {
    const sectionBlock = document.getElementById(`sectionBlock${sectionId}`);
    if (sectionBlock) {
        sectionBlock.remove();
        updateSectionLabels();
        // Update group section dropdowns when a section is removed
        if (typeof updateGroupSectionDropdowns === 'function') {
            updateGroupSectionDropdowns();
        }
    }
}

function moveSectionUp(sectionId) {
    const sectionBlock = document.getElementById(`sectionBlock${sectionId}`);
    const previousSibling = sectionBlock.previousElementSibling;

    if (previousSibling && previousSibling.classList.contains('section-block')) {
        sectionBlock.parentNode.insertBefore(sectionBlock, previousSibling);
        updateSectionLabels();
    }
}

function moveSectionDown(sectionId) {
    const sectionBlock = document.getElementById(`sectionBlock${sectionId}`);
    const nextSibling = sectionBlock.nextElementSibling;

    if (nextSibling && nextSibling.classList.contains('section-block')) {
        sectionBlock.parentNode.insertBefore(nextSibling, sectionBlock);
        updateSectionLabels();
    }
}

// ============================================
// ===========  CHECKLIST FUNCTIONS  ===========
// ============================================
function addChecklist() {
    const checklistContainer = document.getElementById('checklistContainer');
    if (!checklistContainer) {
        // Create checklist container if it doesn't exist
        const formBuilder = document.getElementById('formBuilder');
        const checklistDiv = document.createElement('div');
        checklistDiv.id = 'checklistContainer';
        checklistDiv.innerHTML = `
            <h3>📋 Checklist Items</h3>
            <div id="checklistItems"></div>
            <button type="button" onclick="addChecklistItem()">Add Checklist Item</button>
            <hr>
        `;
        formBuilder.insertBefore(checklistDiv, formBuilder.firstChild);
    }
    
    addChecklistItem();
}

function addChecklistItem() {
    const checklistItemsContainer = document.getElementById('checklistItems');
    if (!checklistItemsContainer) return;
    
    const itemId = Date.now();
    const itemDiv = document.createElement('div');
    itemDiv.className = 'checklist-item';
    itemDiv.id = `checklistItem${itemId}`;
    itemDiv.innerHTML = `
        <input type="text" id="checklistText${itemId}" placeholder="Enter checklist item text" style="width: 60%; margin-right: 10px;">
        <button type="button" onclick="removeChecklistItem(${itemId})">Remove</button>
        <br><br>
    `;
    
    checklistItemsContainer.appendChild(itemDiv);
}

function removeChecklistItem(itemId) {
    const itemDiv = document.getElementById(`checklistItem${itemId}`);
    if (itemDiv) {
        itemDiv.remove();
    }
}

function addChecklistLogicCondition(questionId) {
    const checklistLogicContainer = document.getElementById(`checklistLogicContainer${questionId}`);
    if (!checklistLogicContainer) return;
    
    const numConditions = checklistLogicContainer.children.length + 1;
    const conditionDiv = document.createElement('div');
    conditionDiv.className = 'checklist-logic-condition-row';
    conditionDiv.id = `checklistLogicCondition${questionId}_${numConditions}`;
    conditionDiv.innerHTML = `
        <span>Condition ${numConditions}:</span><br>
        <input type="number" placeholder="Previous question number"
               id="checklistPrevQuestion${questionId}_${numConditions}"
               onchange="updateChecklistLogicAnswersForRow(${questionId}, ${numConditions})"><br>
        <select id="checklistPrevAnswer${questionId}_${numConditions}" style="display: block;">
            <option value="">-- Select an answer --</option>
        </select><br>
        <label>Checklist items to add (one per line):</label><br>
        <textarea id="checklistItemsToAdd${questionId}_${numConditions}" placeholder="Enter checklist items to add when condition is met" 
                  style="width: 100%; height: 80px; margin-top: 5px;"></textarea><br>
        <button type="button" onclick="removeChecklistLogicCondition(${questionId}, ${numConditions})">Remove Condition</button>
        <hr>
    `;
    
    checklistLogicContainer.appendChild(conditionDiv);
}

function removeChecklistLogicCondition(questionId, conditionIndex) {
    const row = document.getElementById(`checklistLogicCondition${questionId}_${conditionIndex}`);
    if (row) row.remove();
}

function updateChecklistLogicAnswersForRow(questionId, conditionIndex, callback) {
    const questionNumberInput = document.getElementById(`checklistPrevQuestion${questionId}_${conditionIndex}`);
    const answerSelect = document.getElementById(`checklistPrevAnswer${questionId}_${conditionIndex}`);
    if (!questionNumberInput || !answerSelect) {
        if (callback) callback();
        return;
    }

    const prevQNum = parseInt(questionNumberInput.value);
    if (!prevQNum) {
        answerSelect.innerHTML = '<option value="">-- Select an answer --</option>';
        if (callback) callback();
        return;
    }
    const targetQuestionBlock = document.getElementById(`questionBlock${prevQNum}`);
    if (!targetQuestionBlock) {
        answerSelect.innerHTML = '<option value="">-- (invalid question #) --</option>';
        if (callback) callback();
        return;
    }
    const questionType = targetQuestionBlock.querySelector(`#questionType${prevQNum}`)?.value;
    if (!questionType) {
        if (callback) callback();
        return;
    }

    answerSelect.innerHTML = '<option value="">-- Select an answer --</option>';

    if (questionType === 'radio') {
        answerSelect.innerHTML += `
            <option value="Yes">Yes</option>
            <option value="No">No</option>
        `;
        if (callback) callback();
    } else if (questionType === 'dropdown') {
        const dropOpts = targetQuestionBlock.querySelectorAll(`#dropdownOptions${prevQNum} input`);
        dropOpts.forEach(opt => {
            const val = opt.value.trim();
            if (val) {
                const optionEl = document.createElement('option');
                optionEl.value = val;
                optionEl.textContent = val;
                answerSelect.appendChild(optionEl);
            }
        });
        if (callback) callback();
    } else if (questionType === 'checkbox') {
        const checkOpts = targetQuestionBlock.querySelectorAll(`#checkboxOptions${prevQNum} [id^="checkboxOptionText"]`);
        checkOpts.forEach(optInput => {
            const val = optInput.value.trim();
            if (val) {
                const optionEl = document.createElement('option');
                optionEl.value = val;
                optionEl.textContent = val;
                answerSelect.appendChild(optionEl);
            }
        });
        const noneOfAbove = targetQuestionBlock.querySelector(`#noneOfTheAbove${prevQNum}`);
        if (noneOfAbove && noneOfAbove.checked) {
            const optionEl = document.createElement('option');
            optionEl.value = 'None of the above';
            optionEl.textContent = 'None of the above';
            answerSelect.appendChild(optionEl);
        }
        if (callback) callback();
    } else if (questionType === 'numberedDropdown') {
        // Get the min and max values from the range inputs
        const rangeStartEl = targetQuestionBlock.querySelector(`#numberRangeStart${prevQNum}`);
        const rangeEndEl = targetQuestionBlock.querySelector(`#numberRangeEnd${prevQNum}`);
        
        if (rangeStartEl && rangeEndEl) {
            const min = parseInt(rangeStartEl.value) || 1;
            const max = parseInt(rangeEndEl.value) || min;
            
            // Add each number in the range as an option
            for (let i = min; i <= max; i++) {
                const optionEl = document.createElement('option');
                optionEl.value = i.toString();
                optionEl.textContent = i.toString();
                answerSelect.appendChild(optionEl);
            }
        }
        if (callback) callback();
    } else {
        if (callback) callback();
    }
}

function toggleChecklistLogic(questionId) {
    const checklistLogicBlock = document.getElementById(`checklistLogicBlock${questionId}`);
    const checklistLogicCheckbox = document.getElementById(`checklistLogic${questionId}`);
    
    if (checklistLogicBlock && checklistLogicCheckbox) {
        checklistLogicBlock.style.display = checklistLogicCheckbox.checked ? 'block' : 'none';
    }
}

// Function to update all checklist logic dropdowns
function updateAllChecklistLogicDropdowns() {
    // Find all checklist logic containers
    const checklistLogicContainers = document.querySelectorAll('[id^="checklistLogicContainer"]');
    
    checklistLogicContainers.forEach(container => {
        const questionId = container.id.replace('checklistLogicContainer', '');
        const conditionRows = container.querySelectorAll('.checklist-logic-condition-row');
        
        conditionRows.forEach((row, index) => {
            const conditionIndex = index + 1;
            const prevQuestionInput = row.querySelector(`#checklistPrevQuestion${questionId}_${conditionIndex}`);
            const prevAnswerSelect = row.querySelector(`#checklistPrevAnswer${questionId}_${conditionIndex}`);
            
            if (prevQuestionInput && prevAnswerSelect) {
                const savedAnswer = prevAnswerSelect.value;
                updateChecklistLogicAnswersForRow(questionId, conditionIndex, () => {
                    // Restore the saved answer after updating dropdown options
                    if (savedAnswer) {
                        prevAnswerSelect.value = savedAnswer;
                    }
                });
            } else {
                updateChecklistLogicAnswersForRow(questionId, conditionIndex);
            }
        });
    });
}

// Function to update all conditional logic dropdowns
function updateAllConditionalLogicDropdowns() {
    // Find all conditional logic containers
    const logicContainers = document.querySelectorAll('[id^="logicConditions"]');
    
    logicContainers.forEach(container => {
        const questionId = container.id.replace('logicConditions', '');
        const conditionRows = container.querySelectorAll('.logic-condition-row');
        
        conditionRows.forEach((row, index) => {
            const conditionIndex = index + 1;
            const prevQuestionInput = row.querySelector(`#prevQuestion${questionId}_${conditionIndex}`);
            const prevAnswerSelect = row.querySelector(`#prevAnswer${questionId}_${conditionIndex}`);
            
            if (prevQuestionInput && prevAnswerSelect) {
                const savedAnswer = prevAnswerSelect.value;
                const savedQuestion = prevQuestionInput.value;
                
                // Only update if there's a question number entered
                if (savedQuestion) {
                    // Check if dropdown already has options (more than just "-- Select an answer --")
                    const currentOptions = prevAnswerSelect.querySelectorAll('option');
                    if (currentOptions.length <= 1) {
                        // Only update if dropdown doesn't have options yet
                        updateLogicAnswersForRow(questionId, conditionIndex);
                    }
                    // Restore the saved answer after updating dropdown options
                    if (savedAnswer) {
                        prevAnswerSelect.value = savedAnswer;
                    }
                }
            }
        });
    });
}

// Function to update all alert logic dropdowns
function updateAllAlertLogicDropdowns() {
    // Find all alert logic containers
    const alertLogicContainers = document.querySelectorAll('[id^="alertLogicConditions"]');
    
    alertLogicContainers.forEach(container => {
        const questionId = container.id.replace('alertLogicConditions', '');
        const conditionRows = container.querySelectorAll('.alert-logic-condition-row');
        
        conditionRows.forEach((row, index) => {
            const conditionIndex = index + 1;
            const prevQuestionInput = row.querySelector(`#alertPrevQuestion${questionId}_${conditionIndex}`);
            const prevAnswerSelect = row.querySelector(`#alertPrevAnswer${questionId}_${conditionIndex}`);
            
            if (prevQuestionInput && prevAnswerSelect) {
                const savedAnswer = prevAnswerSelect.value;
                updateAlertLogicAnswersForRow(questionId, conditionIndex);
                // Restore the saved answer after updating dropdown options
                if (savedAnswer) {
                    prevAnswerSelect.value = savedAnswer;
                }
            }
        });
    });
}

// Function to update all PDF logic dropdowns
function updateAllPdfLogicDropdowns() {
    // Find all PDF logic containers
    const pdfLogicContainers = document.querySelectorAll('[id^="pdfLogicConditions"]');
    
    pdfLogicContainers.forEach(container => {
        const questionId = container.id.replace('pdfLogicConditions', '');
        const conditionRows = container.querySelectorAll('.pdf-logic-condition-row');
        
        conditionRows.forEach((row, index) => {
            const conditionIndex = index + 1;
            const prevQuestionInput = row.querySelector(`#pdfPrevQuestion${questionId}_${conditionIndex}`);
            const prevAnswerSelect = row.querySelector(`#pdfPrevAnswer${questionId}_${conditionIndex}`);
            
            if (prevQuestionInput && prevAnswerSelect) {
                const savedAnswer = prevAnswerSelect.value;
                updatePdfLogicAnswersForRow(questionId, conditionIndex);
                // Restore the saved answer after updating dropdown options
                if (savedAnswer) {
                    prevAnswerSelect.value = savedAnswer;
                }
            }
        });
    });
}

function updateSectionName(sectionId) {
    const sectionNameInput = document.getElementById(`sectionName${sectionId}`);
    const sectionLabel = document.getElementById(`sectionLabel${sectionId}`);
    if (sectionLabel && sectionNameInput) {
        sectionLabel.textContent = sectionNameInput.value;
    }
    // Update group section dropdowns when section name changes
    if (typeof updateGroupSectionDropdowns === 'function') {
        updateGroupSectionDropdowns();
    }
}

/**
 * Re-label sections (and questions inside) after moves,
 * so that the GUI remains consistent.
 */
/**
 * Re-label sections after moves (visually), without reassigning
 * section-block IDs in the DOM. This prevents duplicated data.
 */
function updateSectionLabels() {
    const sections = document.querySelectorAll('.section-block');

    sections.forEach((block, index) => {
        // Only update the heading text to "Section X" 
        const h2Label = block.querySelector('h2');
        if (h2Label) {
            h2Label.textContent = `Section ${index + 1}`;
        }
        
        // Optionally also update the "Section Name" input's .value
        // but do NOT rename block.id or button onClick attributes
    });

    // Also fix question display text
    updateGlobalQuestionLabels();

    // Keep your counter up-to-date so new sections increment properly
    sectionCounter = sections.length + 1;
}



/**
 * Re-label questions across all sections
 */
/**
 * Re-label questions across all sections (visually),
 * WITHOUT reassigning their DOM IDs.
 */
function updateGlobalQuestionLabels() {
    const sections = document.querySelectorAll('.section-block');
    let globalQuestionIndex = 1;

    sections.forEach((section) => {
        const questionsInSection = section.querySelectorAll('.question-block');
        questionsInSection.forEach((questionBlock) => {
            // Only rename the visible label
            const label = questionBlock.querySelector('label');
            if (label) {
                label.textContent = `Question ${globalQuestionIndex}:`;
            }
            // DO NOT change questionBlock.id or child input IDs
            globalQuestionIndex++;
        });
    });

    questionCounter = globalQuestionIndex;
}



function addJumpCondition(questionId) {
    const jumpConditionsDiv = document.getElementById(`jumpConditions${questionId}`);
    if (!jumpConditionsDiv) return;
    
    // Find the next available condition ID
    const existingConditions = jumpConditionsDiv.querySelectorAll('.jump-condition');
    const conditionId = existingConditions.length + 1;
    
    // Check if this is a textbox or date question type
    const questionTypeSelect = document.getElementById(`questionType${questionId}`);
    const questionType = questionTypeSelect ? questionTypeSelect.value : '';
    const isTextboxQuestion = questionType === 'text' || questionType === 'bigParagraph' || questionType === 'money' || questionType === 'date' || questionType === 'dateRange';
    
    const conditionDiv = document.createElement('div');
    conditionDiv.className = 'jump-condition';
    conditionDiv.id = `jumpCondition${questionId}_${conditionId}`;
    
    if (isTextboxQuestion) {
        // For textbox questions, skip the "If selected" dropdown
        conditionDiv.innerHTML = `
            <label>Jump to:</label>
            <input type="text" id="jumpTo${questionId}_${conditionId}" placeholder="Section number or 'end'">
            <button type="button" onclick="removeJumpCondition(${questionId}, ${conditionId})">Remove</button>
            <hr>
        `;
    } else {
        // For other question types, keep the original structure
        conditionDiv.innerHTML = `
            <label>If selected:</label>
            <select id="jumpOption${questionId}_${conditionId}">
                <option value="" disabled selected>Select an option</option>
            </select>
            <label>Jump to:</label>
            <input type="text" id="jumpTo${questionId}_${conditionId}" placeholder="Section number or 'end'">
            <button type="button" onclick="removeJumpCondition(${questionId}, ${conditionId})">Remove</button>
            <hr>
        `;
    }
    
    jumpConditionsDiv.appendChild(conditionDiv);
    
    // Populate the jump options based on question type (skip for textbox questions)
    if (!isTextboxQuestion) {
        const questionTypeSelect = document.getElementById(`questionType${questionId}`);
        if (questionTypeSelect) {
            const questionType = questionTypeSelect.value;
            
            if (questionType === 'dropdown') {
                updateJumpOptions(questionId, conditionId);
            } else if (questionType === 'radio') {
                updateJumpOptionsForRadio(questionId, conditionId);
            } else if (questionType === 'checkbox') {
                updateJumpOptionsForCheckbox(questionId, conditionId);
            } else if (questionType === 'numberedDropdown') {
                updateJumpOptionsForNumberedDropdown(questionId, conditionId);
            }
        }
    }
}

function removeJumpCondition(questionId, conditionId) {
    const conditionDiv = document.getElementById(`jumpCondition${questionId}_${conditionId}`);
    if (conditionDiv) conditionDiv.remove();
}

// Update existing jump conditions to use simplified format for textbox and date questions
function updateJumpConditionsForTextbox(questionId) {
    const jumpConditions = document.querySelectorAll(`#jumpConditions${questionId} .jump-condition`);
    jumpConditions.forEach(condition => {
        const conditionId = condition.id.split('_')[1];
        const jumpToInput = document.getElementById(`jumpTo${questionId}_${conditionId}`);
        
        // If the condition has a dropdown (old format), convert it to simplified format
        const selectElement = condition.querySelector('select');
        if (selectElement) {
            // Get the current "Jump to" value
            const currentJumpTo = jumpToInput ? jumpToInput.value : '';
            
            // Replace the condition HTML with simplified format
            condition.innerHTML = `
                <label>Jump to:</label>
                <input type="text" id="jumpTo${questionId}_${conditionId}" placeholder="Section number or 'end'" value="${currentJumpTo}">
                <button type="button" onclick="removeJumpCondition(${questionId}, ${conditionId})">Remove</button>
                <hr>
            `;
        }
    });
}

// This is the CORRECT version—supports multiple conditions.
function updateJumpOptions(questionId, conditionId = null) {
    const selectElements = conditionId 
        ? [document.getElementById(`jumpOption${questionId}_${conditionId}`)]
        : document.querySelectorAll(`[id^="jumpOption${questionId}_"]`);

    selectElements.forEach(selectEl => {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="" disabled selected>Select an option</option>';
        
        const dropdownOptionsDiv = document.getElementById(`dropdownOptions${questionId}`);
        if (!dropdownOptionsDiv) return;

        const optionInputs = dropdownOptionsDiv.querySelectorAll('input[type="text"]');
        optionInputs.forEach(optionInput => {
            const val = optionInput.value.trim();
            if (val) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text = val;
                selectEl.appendChild(opt);
            }
        });
    });
}



// ============================================
// ===========  QUESTION FUNCTIONS  ===========
// ============================================
function addQuestion(sectionId, questionId = null) {
    const questionsSection = document.getElementById(`questionsSection${sectionId}`);
    const questionBlock = document.createElement('div');

    const currentQuestionId = questionId || questionCounter;

    questionBlock.className = 'question-block';
    questionBlock.id = `questionBlock${currentQuestionId}`;
    questionBlock.innerHTML = `
        <label>Question ${currentQuestionId}: </label>
        <input type="text" placeholder="Enter your question" id="question${currentQuestionId}"><br><br>

        <label>Question Type: </label>
        <center>
        <select id="questionType${currentQuestionId}" onchange="toggleOptions(${currentQuestionId})">
            <option value="text">Text</option>
            <option value="radio">Yes/No</option>
            <option value="dropdown">Dropdown</option>
            <option value="checkbox">Checkbox</option>
            <option value="numberedDropdown">Numbered Dropdown</option>
            <option value="multipleTextboxes">Multiple Textboxes</option>
            <option value="money">Money</option>
            <option value="date">Date</option>
            <option value="dateRange">Date Range</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="bigParagraph">Big Paragraph</option>
            <option value="location">Location</option>
        </select><br><br>

        <!-- Name/ID and Placeholder for Text, Big Paragraph, Money, etc. -->
        <div id="textboxOptions${currentQuestionId}" class="textbox-options" style="display: none;">
            <label>Name/ID: </label>
            <input type="text" id="textboxName${currentQuestionId}" placeholder="Enter field name"><br><br>
            <label>Placeholder: </label>
            <input type="text" id="textboxPlaceholder${currentQuestionId}" placeholder="Enter placeholder">
        </div>

        <!-- Line Limit for Big Paragraph -->
        <div id="lineLimitOptions${currentQuestionId}" class="line-limit-options" style="display: none;">
            <label>Line Limit: </label>
            <input type="number" id="lineLimit${currentQuestionId}" placeholder="Enter line limit" min="1" max="100"><br><br>
            <label>Max character limit: </label>
            <input type="number" id="maxCharacterLimit${currentQuestionId}" placeholder="Enter max character limit" min="1" max="10000"><br><br>
            <label>Paragraph limit: </label>
            <input type="number" id="paragraphLimit${currentQuestionId}" placeholder="Enter paragraph limit" min="1" max="10000">
        </div>

        <!-- Numbered Dropdown Options -->
        <div id="numberedDropdownBlock${currentQuestionId}" class="numbered-dropdown-options" style="display: none;">
            <label>Node Id: </label>
            <input type="text" id="nodeId${currentQuestionId}" placeholder="Enter node ID" style="width: 200px;"><br><br>
            
            <label>Number Range: </label>
            <input type="number" id="numberRangeStart${currentQuestionId}" placeholder="Start" min="1" style="width: 60px;" onchange="updateNumberedDropdownEvents(${currentQuestionId})">
            <input type="number" id="numberRangeEnd${currentQuestionId}" placeholder="End" min="1" style="width: 60px;" onchange="updateNumberedDropdownEvents(${currentQuestionId})"><br><br>
            
            <div style="text-align: center; margin: 15px 0;">
                <button type="button" onclick="addTextboxAmount(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #007bff; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Amount</button>
                <button type="button" onclick="addLocationFields(${currentQuestionId}, 'numberedDropdown')" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #4CAF50; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Location</button>
                <button type="button" onclick="addTextboxLabel(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #007bff; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Label</button>
                <button type="button" onclick="addCheckboxField(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #9C27B0; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Checkbox</button>
                <button type="button" onclick="addDateField(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #FF9800; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Date</button>
                <button type="button" onclick="addDropdownField(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #2196F3; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Dropdown</button>
            </div>
            
            <!-- Hidden containers for backward compatibility -->
            <div id="textboxLabels${currentQuestionId}" style="display: none;"></div>
            <div id="textboxAmounts${currentQuestionId}" style="display: none;"></div>
        </div><br>

        <!-- Shared Unified Fields Container (for both numberedDropdown and multipleTextboxes) -->
        <div id="unifiedFieldsContainer${currentQuestionId}" style="display: none;">
            <label>Fields (in creation order):</label>
            <div id="unifiedFields${currentQuestionId}"></div>
        </div><br>

        <!-- Dropdown Options -->
        <div id="optionsBlock${currentQuestionId}" class="dropdown-options" style="display: none;">
            <label>Options: </label>
            <div id="dropdownOptions${currentQuestionId}"></div>
            <button type="button" onclick="addDropdownOption(${currentQuestionId})">Add Option</button>
        </div><br>
		
		 <!-- ADD THIS IMAGE BLOCK -->
        <div id="dropdownImageBlock${currentQuestionId}" class="dropdown-image-options" style="display:none;">
            <button type="button" onclick="toggleDropdownImageFields(${currentQuestionId})">Add Image</button>
            <div id="dropdownImageFields${currentQuestionId}" style="display:none; margin-top:8px;">
                <label>Image URL:</label><br>
                <input type="text" id="dropdownImageURL${currentQuestionId}" placeholder="Enter image URL"><br><br>
                <label>Width:</label><br>
                <input type="number" id="dropdownImageWidth${currentQuestionId}" placeholder="Width"><br><br>
                <label>Height:</label><br>
                <input type="number" id="dropdownImageHeight${currentQuestionId}" placeholder="Height"><br><br>
                <button type="button" onclick="deleteDropdownImage(${currentQuestionId})">Delete Image</button>
            </div>
        </div><br>

        <!-- Dropdown Options -->
        <div id="checkboxOptionsBlock${currentQuestionId}" class="checkbox-options" style="display: none;">
            <label>Options: </label>
            <div id="checkboxOptions${currentQuestionId}"></div>
            <button type="button" onclick="addCheckboxOption(${currentQuestionId})">Add Option</button>
            
            <div id="noneOfTheAboveContainer${currentQuestionId}" style="margin-top:10px; margin-bottom:10px;">
                <label><input type="checkbox" id="noneOfTheAbove${currentQuestionId}">Include "None of the above" option</label>
            </div>
            
            <div id="markOnlyOneContainer${currentQuestionId}" style="margin-top:10px; margin-bottom:10px;">
                <label><input type="checkbox" id="markOnlyOne${currentQuestionId}">Mark only one</label>
            </div>
        </div><br>
        
        <!-- Multiple Textboxes Options -->
        <div id="multipleTextboxesOptionsBlock${currentQuestionId}" class="multiple-textboxes-options" style="display: none;">
            <label>Node ID: </label>
            <input type="text" id="multipleTextboxesNodeId${currentQuestionId}" placeholder="Enter custom node ID" oninput="updateMultipleTextboxesNodeId(${currentQuestionId})"><br><br>
            
            <div style="text-align: center; margin: 15px 0;">
                <button type="button" onclick="addTextboxAmount(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #007bff; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Amount</button>
                <button type="button" onclick="addLocationFields(${currentQuestionId}, 'multipleTextboxes')" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #4CAF50; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Location</button>
                <button type="button" onclick="addTextboxLabel(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #007bff; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Label</button>
                <button type="button" onclick="addCheckboxField(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #9C27B0; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Checkbox</button>
                <button type="button" onclick="addDateField(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #FF9800; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Date</button>
                <button type="button" onclick="addDropdownField(${currentQuestionId})" style="margin: 5px; padding: 8px 16px; border: none; border-radius: 8px; background-color: #2196F3; color: white; cursor: pointer; font-size: 14px; display: inline-block;">Add Dropdown</button>
            </div>
            
            <!-- Hidden containers for backward compatibility -->
            <div id="textboxLabels${currentQuestionId}" style="display: none;"></div>
            <div id="textboxAmounts${currentQuestionId}" style="display: none;"></div>
        </div><br>
        
        <!-- Linking Logic for Dropdown -->
        <div id="linkingLogicBlock${currentQuestionId}" class="linking-options" style="display: none;">
            <label>Enable Dropdown Linking: </label>
            <input type="checkbox" id="enableLinking${currentQuestionId}" onchange="toggleLinkingLogic(${currentQuestionId})">
            <div id="linkingBlock${currentQuestionId}" style="display:none; margin-top:10px;">
                <label>Link with question:</label>
                <select id="linkingTarget${currentQuestionId}">
                    <option value="">Select a question</option>
                </select>
            </div>
        </div><br>

        <!-- Subtitle Feature -->
        <label>Enable Subtitle: </label>
        <input type="checkbox" id="enableSubtitle${currentQuestionId}" onchange="toggleSubtitle(${currentQuestionId})">
        <div id="subtitleBlock${currentQuestionId}" style="display: none; margin-top: 10px;">
            <label>Subtitle Text:</label>
            <input type="text" id="subtitleText${currentQuestionId}" placeholder="Enter subtitle text">
        </div><br>

        <!-- Info Box Feature -->
        <label>Enable Info Box: </label>
        <input type="checkbox" id="enableInfoBox${currentQuestionId}" onchange="toggleInfoBox(${currentQuestionId})">
        <div id="infoBoxBlock${currentQuestionId}" style="display: none; margin-top: 10px;">
            <label>Information Text:</label>
            <textarea id="infoBoxText${currentQuestionId}" placeholder="Enter information for tooltip/popup" rows="3" style="width: 100%;"></textarea>
        </div><br>

        <!-- Conditional Logic -->
        <label>Enable Conditional Logic: </label>
        <input type="checkbox" id="logic${currentQuestionId}" onchange="toggleLogic(${currentQuestionId})">
        <div id="logicBlock${currentQuestionId}" style="display: none;">
            <label>Show this question if ANY of these conditions match:</label><br>
            <div id="logicConditions${currentQuestionId}"></div>
            <button type="button" onclick="addLogicCondition(${currentQuestionId})">+ Add OR Condition</button>
        </div><br>

        <!-- PDF Logic -->
        <label>Enable PDF Logic: </label>
        <input type="checkbox" id="pdfLogic${currentQuestionId}" onchange="togglePdfLogic(${currentQuestionId})">
        <div id="pdfLogicBlock${currentQuestionId}" style="display: none;">
            <label>Show this question if ANY of these conditions match:</label><br>
            <div id="pdfLogicConditions${currentQuestionId}"></div>
            <button type="button" onclick="addPdfLogicCondition(${currentQuestionId})">+ Add OR Condition</button>
            <br><br>
            
            <!-- Trigger Option for Numbered Dropdown -->
            <div id="triggerOptionBlock${currentQuestionId}" style="display: none;">
                <label>Trigger option:</label>
                <select id="pdfLogicTriggerOption${currentQuestionId}">
                    <option value="">Select trigger option</option>
                </select>
                <br><br>
            </div>
            
            <!-- Trigger Option for Number Questions -->
            <div id="numberTriggerBlock${currentQuestionId}" style="display: none;">
                <label>Trigger:</label>
                <select id="pdfLogicNumberTrigger${currentQuestionId}">
                    <option value="">Select trigger</option>
                    <option value="=">=</option>
                    <option value=">">></option>
                    <option value="<"><</option>
                </select>
                <br><br>
                <label>Number:</label>
                <input type="number" id="pdfLogicNumberValue${currentQuestionId}" placeholder="Enter number">
                <br><br>
            </div>
            
                <!-- PDF Details Container -->
                <div id="pdfDetailsContainer${currentQuestionId}">
                    <div class="pdf-detail-group" data-pdf-index="1" style="border: 2px solid #007bff; border-radius: 8px; padding: 15px; margin: 10px 0; background: #f8f9ff;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h4 style="margin: 0; color: #007bff;">PDF 1</h4>
                        </div>
                        
                        <label>PDF Name (for cart display):</label>
                        <input type="text" id="pdfLogicPdfDisplayName${currentQuestionId}_1" placeholder="Enter custom PDF name (e.g., Small Claims 500A)">
                        <br><br>
                        <label>Additional PDF to download:</label>
                        <input type="text" id="pdfLogicPdfName${currentQuestionId}_1" placeholder="Enter PDF name (e.g., additional_form.pdf)">
                        <br><br>
                        <label>Choose your Price ID:</label>
                        <input type="text" id="pdfLogicStripePriceId${currentQuestionId}_1" placeholder="Enter Stripe Price ID (e.g., price_12345)">
                        <br><br>
                        
                        <div style="text-align: center; margin-top: 15px;">
                            <button type="button" onclick="removePdf(${currentQuestionId}, 1)" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">Remove PDF</button>
                        </div>
                    </div>
                </div>
            
            <!-- Add Another PDF Button -->
            <button type="button" onclick="addAnotherPdf(${currentQuestionId})" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">+ Add Another PDF</button>
        </div><br>

        <!-- Alert Logic -->
        <label>Enable Alert Logic: </label>
        <input type="checkbox" id="alertLogic${currentQuestionId}" onchange="toggleAlertLogic(${currentQuestionId})">
        <div id="alertLogicBlock${currentQuestionId}" style="display: none;">
            <label>Show alert if ANY of these conditions match:</label><br>
            <div id="alertLogicConditions${currentQuestionId}"></div>
            <button type="button" onclick="addAlertLogicCondition(${currentQuestionId})">+ Add OR Condition</button>
            <br><br>
            <label>Alert Message:</label>
            <textarea id="alertLogicMessage${currentQuestionId}" placeholder="Enter alert message to display" rows="3" style="width: 100%;"></textarea>
        </div><br>

        <!-- Checklist Logic -->
        <label>Enable Checklist Logic: </label>
        <input type="checkbox" id="checklistLogic${currentQuestionId}" onchange="toggleChecklistLogic(${currentQuestionId})">
        <div id="checklistLogicBlock${currentQuestionId}" style="display: none;">
            <label>Add checklist items if ANY of these conditions match:</label><br>
            <div id="checklistLogicContainer${currentQuestionId}"></div>
            <button type="button" onclick="addChecklistLogicCondition(${currentQuestionId})">+ Add OR Condition</button>
        </div><br>

       <!-- Jump Logic -->
        <label>Enable Jump Logic: </label>
        <div id="jumpLogic${currentQuestionId}">
            <input type="checkbox" id="enableJump${currentQuestionId}" 
                onchange="toggleJumpLogic(${currentQuestionId})">
            <div id="jumpBlock${currentQuestionId}" style="display: none;">
                <div id="jumpConditions${currentQuestionId}"></div>
                <button type="button" onclick="addJumpCondition(${currentQuestionId})">
                    + Add Jump Option
                </button>
            </div>
        </div><br>

        <!-- Conditional PDF Logic -->
        <div id="conditionalPDFLogic${currentQuestionId}" style="display: none;">
            <label>Enable Conditional PDF: </label>
            <input type="checkbox" id="enableConditionalPDF${currentQuestionId}" onchange="toggleConditionalPDFLogic(${currentQuestionId})"><br><br>
            <div id="conditionalPDFBlock${currentQuestionId}" style="display: none;">
                <label>PDF Name:</label>
                <input type="text" id="conditionalPDFName${currentQuestionId}" placeholder="Enter PDF name"><br><br>
                <label>Attach PDF if the answer is:</label>
                <select id="conditionalPDFAnswer${currentQuestionId}">
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                </select><br>
            </div>
        </div><br>

        <!-- Hidden Logic -->
        <div id="hiddenLogic${currentQuestionId}" style="display: none;">
            <label>Enable Hidden Logic: </label>
            <input type="checkbox" id="enableHiddenLogic${currentQuestionId}" onchange="toggleHiddenLogic(${currentQuestionId})"><br><br>
            <div id="hiddenLogicBlock${currentQuestionId}" style="display: none;">
                <div id="hiddenLogicConfigs${currentQuestionId}">
                    <!-- First hidden logic configuration will be added here -->
                </div>
                <button type="button" onclick="addHiddenLogicConfig(${currentQuestionId})" style="margin-top: 10px;">+ Add Another</button>
            </div>
        </div><br>

        <!-- Conditional Alert Logic -->
        <div id="conditionalAlertLogic${currentQuestionId}" style="display: none;">
            <label>Enable Conditional Alert: </label>
            <input type="checkbox" id="enableConditionalAlert${currentQuestionId}" onchange="toggleConditionalAlertLogic(${currentQuestionId})">
            <div id="conditionalAlertBlock${currentQuestionId}" style="display: none;">
                <label>Trigger this alert if: </label><br>
                <input type="number" placeholder="Previous question number" id="alertPrevQuestion${currentQuestionId}"><br>
                <input type="text" placeholder="Answer value" id="alertPrevAnswer${currentQuestionId}"><br><br>
                <label>Alert Text:</label><br>
                <input type="text" id="alertText${currentQuestionId}" placeholder="Enter alert text"><br>
            </div>
        </div><br>

        <!-- Question Controls -->
        <button type="button" onclick="moveQuestionUp(${currentQuestionId}, ${sectionId})">Move Question Up</button>
        <button type="button" onclick="moveQuestionDown(${currentQuestionId}, ${sectionId})">Move Question Down</button>
        <button type="button" onclick="removeQuestion(${currentQuestionId})">Remove Question</button>
    `;

    questionsSection.appendChild(questionBlock);

    // Display the correct sub-block for the default question type
    toggleOptions(currentQuestionId);

    // If brand new question, increment questionCounter
    if (!questionId) {
        questionCounter++;
    }
    
    // Update all checklist logic dropdowns to include the new question
    updateAllChecklistLogicDropdowns();
}

/**
 * Updates linking targets for all dropdown questions in the form
 */
function updateAllLinkingTargets() {
    const questionBlocks = document.querySelectorAll('.question-block');
    questionBlocks.forEach(block => {
        const questionId = block.id.replace('questionBlock', '');
        const typeSelect = block.querySelector(`#questionType${questionId}`);
        
        if (typeSelect && typeSelect.value === 'dropdown') {
            updateLinkingTargets(questionId);
        }
    });
}

/**
 * Removes a question block entirely
 */
function removeQuestion(questionId) {
    const questionBlock = document.getElementById(`questionBlock${questionId}`);
    if (!questionBlock) return;
    const sectionId = questionBlock.closest('.section-block').id.replace('sectionBlock', '');
    questionBlock.remove();
    updateGlobalQuestionLabels();
    
    // Update linking targets in case this was a dropdown question
    updateAllLinkingTargets();
    
    // Update all checklist logic dropdowns after removing a question
    updateAllChecklistLogicDropdowns();
}

function toggleDropdownImageFields(questionId) {
    const fieldsDiv = document.getElementById(`dropdownImageFields${questionId}`);
    if (!fieldsDiv) return;
    if (fieldsDiv.style.display === 'none' || fieldsDiv.style.display === '') {
        fieldsDiv.style.display = 'block';
    } else {
        fieldsDiv.style.display = 'none';
    }
}

// ---------------------------------------
// --- Move question up/down in a section
// ---------------------------------------
function moveQuestionUp(questionId, sectionId) {
    const questionBlock = document.getElementById(`questionBlock${questionId}`);
    const previousSibling = questionBlock.previousElementSibling;
    if (previousSibling && previousSibling.classList.contains('question-block')) {
        questionBlock.parentNode.insertBefore(questionBlock, previousSibling);
        updateQuestionLabels(sectionId);
    }
}

function moveQuestionDown(questionId, sectionId) {
    const questionBlock = document.getElementById(`questionBlock${questionId}`);
    const nextSibling = questionBlock.nextElementSibling;
    if (nextSibling && nextSibling.classList.contains('question-block')) {
        questionBlock.parentNode.insertBefore(nextSibling, questionBlock);
        updateQuestionLabels(sectionId);
    }
}

function updateQuestionLabels(sectionId) {
    const questionsSection = document.getElementById(`questionsSection${sectionId}`);
    const questionBlocks = questionsSection.querySelectorAll('.question-block');
    questionBlocks.forEach((block, index) => {
        const questionLabel = block.querySelector('label');
        questionLabel.textContent = `Question ${index + 1}: `;
    });
}

function updateJumpOptionsForCheckbox(questionId, conditionId = null) {
    const selectElements = conditionId 
        ? [document.getElementById(`jumpOption${questionId}_${conditionId}`)]
        : document.querySelectorAll(`[id^="jumpOption${questionId}_"]`);

    selectElements.forEach(selectEl => {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="" disabled selected>Select an option</option>';
        
        const checkboxOptionsDiv = document.getElementById(`checkboxOptions${questionId}`);
        if (checkboxOptionsDiv) {
            const options = checkboxOptionsDiv.querySelectorAll(`input[id^="checkboxOptionText${questionId}_"]`);
            options.forEach(optionInput => {
                const val = optionInput.value.trim();
                if (val) {
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.text = val;
                    selectEl.appendChild(opt);
                }
            });
        }

        const noneOfTheAboveCheckbox = document.getElementById(`noneOfTheAbove${questionId}`);
        if (noneOfTheAboveCheckbox && noneOfTheAboveCheckbox.checked) {
            const opt = document.createElement('option');
            opt.value = 'None of the above';
            opt.text = 'None of the above';
            selectEl.appendChild(opt);
        }
    });
}
// ------------------------------------------------
// --- Show/hide sub-blocks depending on question type
// ------------------------------------------------
function toggleOptions(questionId) {
    const questionTypeSelect = document.getElementById(`questionType${questionId}`);
    if (!questionTypeSelect) return;
    let questionType = questionTypeSelect.value;
    const optionsBlock = document.getElementById(`optionsBlock${questionId}`);
    const checkboxBlock = document.getElementById(`checkboxOptionsBlock${questionId}`);
    const numberedDropdownBlock = document.getElementById(`numberedDropdownBlock${questionId}`);
    const multipleTextboxesBlock = document.getElementById(`multipleTextboxesOptionsBlock${questionId}`);
    const textboxOptionsBlock = document.getElementById(`textboxOptions${questionId}`);
    const lineLimitOptionsBlock = document.getElementById(`lineLimitOptions${questionId}`);
    const dropdownImageBlock = document.getElementById(`dropdownImageBlock${questionId}`);
    const linkingLogicBlock = document.getElementById(`linkingLogicBlock${questionId}`);

    // Reset all blocks
    textboxOptionsBlock.style.display = 'none';
    lineLimitOptionsBlock.style.display = 'none';
    optionsBlock.style.display = 'none';
    checkboxBlock.style.display = 'none';
    numberedDropdownBlock.style.display = 'none';
    multipleTextboxesBlock.style.display = 'none';
    dropdownImageBlock.style.display = 'none';
    linkingLogicBlock.style.display = 'none';

    // Handle location type: auto-populate as multipleTextboxes
    if (questionType === 'location') {
        // Switch to multipleTextboxes visually and in data
        questionTypeSelect.value = 'multipleTextboxes';
        questionType = 'multipleTextboxes';
        multipleTextboxesBlock.style.display = 'block';
        // Only add if not already present (avoid duplicates)
        const optionsDiv = document.getElementById(`multipleTextboxesOptions${questionId}`);
        if (optionsDiv && optionsDiv.children.length === 0) {
            // Add State, City, Street, Zip textboxes
            for (let i = 1; i <= 4; i++) {
                addMultipleTextboxOption(questionId);
            }
            // Set placeholders
            const placeholders = ['State', 'City', 'Street', 'Zip'];
            for (let i = 1; i <= 4; i++) {
                const phInput = document.getElementById(`multipleTextboxPlaceholder${questionId}_${i}`);
                if (phInput) phInput.value = placeholders[i-1];
            }
            // Do NOT add an amount field by default
        }
        return; // Don't run the rest of the switch, already handled
    }

    switch (questionType) {
        case 'text':
        case 'date':
        case 'dateRange':
            textboxOptionsBlock.style.display = 'block';
            // Update existing jump conditions to use simplified format for textbox and date questions
            updateJumpConditionsForTextbox(questionId);
            break;
        case 'bigParagraph':
            textboxOptionsBlock.style.display = 'block';
            lineLimitOptionsBlock.style.display = 'block';
            // Update existing jump conditions to use simplified format for textbox and date questions
            updateJumpConditionsForTextbox(questionId);
            break;
        case 'radio':
        case 'dropdown':
        case 'email':
        case 'phone':
            textboxOptionsBlock.style.display = 'block';
            if (questionType === 'radio' || questionType === 'dropdown') {
                if (questionType === 'dropdown') {
                    optionsBlock.style.display = 'block';
                    dropdownImageBlock.style.display = 'block';
                    linkingLogicBlock.style.display = 'block';
                    updateLinkingTargets(questionId);
                    // Update ALL jump conditions for this dropdown question
                    const jumpConditions = document.querySelectorAll(`#jumpConditions${questionId} .jump-condition`);
                    jumpConditions.forEach(condition => {
                        const conditionId = condition.id.split('_')[1];
                        updateJumpOptions(questionId, conditionId);
                    });
                }
                if (questionType === 'radio') {
                    const jumpConditions = document.querySelectorAll(`#jumpConditions${questionId} .jump-condition`);
                    jumpConditions.forEach(condition => {
                        const conditionId = condition.id.split('_')[1];
                        updateJumpOptionsForRadio(questionId, conditionId);
                    });
                }
            }
            break;

        case 'checkbox':
            checkboxBlock.style.display = 'block';
            document.querySelectorAll(`#jumpConditions${questionId} select`).forEach(select => {
                updateJumpOptionsForCheckbox(questionId);
            });
            break;

        case 'multipleTextboxes':
            multipleTextboxesBlock.style.display = 'block';
            // Show the shared unified fields container
            const unifiedFieldsContainerMultiple = document.getElementById(`unifiedFieldsContainer${questionId}`);
            if (unifiedFieldsContainerMultiple) {
                unifiedFieldsContainerMultiple.style.display = 'block';
            }
            break;

        case 'numberedDropdown':
            numberedDropdownBlock.style.display = 'block';
            // Show the shared unified fields container
            const unifiedFieldsContainerNumbered = document.getElementById(`unifiedFieldsContainer${questionId}`);
            if (unifiedFieldsContainerNumbered) {
                unifiedFieldsContainerNumbered.style.display = 'block';
            }
            // Update jump options for numbered dropdown
            const jumpConditions = document.querySelectorAll(`#jumpConditions${questionId} .jump-condition`);
            jumpConditions.forEach(condition => {
                const conditionId = condition.id.split('_')[1];
                updateJumpOptionsForNumberedDropdown(questionId, conditionId);
            });
            // Update PDF logic trigger options if PDF logic is enabled
            const pdfLogicEnabled = document.getElementById(`pdfLogic${questionId}`)?.checked;
            if (pdfLogicEnabled) {
                updatePdfLogicTriggerOptions(questionId);
            }
            break;

        case 'money':
            textboxOptionsBlock.style.display = 'block';
            // Update existing jump conditions to use simplified format for textbox questions
            updateJumpConditionsForTextbox(questionId);
            break;
            
        case 'number':
            textboxOptionsBlock.style.display = 'block';
            // Update existing jump conditions to use simplified format for textbox questions
            updateJumpConditionsForTextbox(questionId);
            break;
    }

    // Handle conditional PDF visibility
    const pdfBlock = document.getElementById(`conditionalPDFLogic${questionId}`);
    if (['radio', 'checkbox', 'dropdown'].includes(questionType)) {
        pdfBlock.style.display = 'block';
        if (questionType === 'checkbox') {
            updateConditionalPDFAnswersForCheckbox(questionId);
        } else if (questionType === 'radio') {
            updateConditionalPDFAnswersForRadio(questionId);
        }
    } else {
        pdfBlock.style.display = 'none';
    }

    // Handle hidden logic visibility - show for dropdown and numbered dropdown questions
    const hiddenLogicBlock = document.getElementById(`hiddenLogic${questionId}`);
    if (questionType === 'dropdown' || questionType === 'numberedDropdown') {
        hiddenLogicBlock.style.display = 'block';
        // Update hidden logic trigger options for numbered dropdown
        if (questionType === 'numberedDropdown') {
            updateHiddenLogicTriggerOptionsForNumberedDropdown(questionId);
        }
    } else {
        hiddenLogicBlock.style.display = 'none';
    }

    // Handle PDF Logic visibility - show for all question types
    const pdfLogicBlock = document.getElementById(`pdfLogicBlock${questionId}`);
    if (pdfLogicBlock) {
        pdfLogicBlock.style.display = 'none'; // Reset visibility
        // The actual visibility will be controlled by the checkbox toggle
        
        // If PDF Logic is currently enabled and we're switching to Big Paragraph, update the conditions
        const pdfLogicCheckbox = document.getElementById(`pdfLogic${questionId}`);
        if (pdfLogicCheckbox && pdfLogicCheckbox.checked && questionType === 'bigParagraph') {
            const pdfLogicConditionsDiv = document.getElementById(`pdfLogicConditions${questionId}`);
            if (pdfLogicConditionsDiv) {
                pdfLogicConditionsDiv.innerHTML = '';
                // Add a default character limit condition for Big Paragraph
                addPdfLogicCondition(questionId);
            }
        }
    }
    
    // Handle number trigger block visibility for PDF Logic
    const numberTriggerBlock = document.getElementById(`numberTriggerBlock${questionId}`);
    const triggerOptionBlock = document.getElementById(`triggerOptionBlock${questionId}`);
    if (numberTriggerBlock && triggerOptionBlock) {
        // Reset both blocks
        numberTriggerBlock.style.display = 'none';
        triggerOptionBlock.style.display = 'none';
        
        // Show appropriate block based on question type and PDF Logic status
        const pdfLogicEnabled = document.getElementById(`pdfLogic${questionId}`)?.checked;
        if (pdfLogicEnabled) {
            if (questionType === 'number') {
                numberTriggerBlock.style.display = 'block';
            } else if (questionType === 'numberedDropdown') {
                triggerOptionBlock.style.display = 'block';
                updatePdfLogicTriggerOptions(questionId);
            }
        }
    }
    
    // Update linking targets in case dropdown questions were added/changed
    updateAllLinkingTargets();
}


// --------------------------------------------------
// --- Additional logic blocks (jump, PDF, alerts)
// --------------------------------------------------
function toggleLogic(questionId) {
    const logicEnabled = document.getElementById(`logic${questionId}`).checked;
    const logicBlock = document.getElementById(`logicBlock${questionId}`);
    logicBlock.style.display = logicEnabled ? 'block' : 'none';

    // If just turned on and no conditions exist, add one
    if (logicEnabled) {
        const logicConditionsDiv = document.getElementById(`logicConditions${questionId}`);
        if (logicConditionsDiv.children.length === 0) {
            addLogicCondition(questionId);
        }
    }
}

/** Add a row to the multiple-OR logic block */
function addLogicCondition(questionId) {
    const logicConditionsDiv = document.getElementById(`logicConditions${questionId}`);
    const numConditions = logicConditionsDiv.children.length + 1;

    const conditionRow = document.createElement('div');
    conditionRow.className = 'logic-condition-row';
    conditionRow.id = `logicConditionRow${questionId}_${numConditions}`;
    conditionRow.innerHTML = `
        <span>Condition ${numConditions}:</span><br>
        <input type="number" placeholder="Previous question number"
               id="prevQuestion${questionId}_${numConditions}"
               onchange="updateLogicAnswersForRow(${questionId}, ${numConditions})"><br>
        <select id="prevAnswer${questionId}_${numConditions}" style="display: block;">
            <option value="">-- Select an answer --</option>
        </select><br>
        <button type="button" onclick="removeLogicCondition(${questionId}, ${numConditions})">Remove</button>
        <hr>
    `;
    logicConditionsDiv.appendChild(conditionRow);
}

function removeLogicCondition(questionId, conditionIndex) {
    const row = document.getElementById(`logicConditionRow${questionId}_${conditionIndex}`);
    if (row) row.remove();
}

/** Add a row to the alert logic block */
function addAlertLogicCondition(questionId) {
    const alertLogicConditionsDiv = document.getElementById(`alertLogicConditions${questionId}`);
    const numConditions = alertLogicConditionsDiv.children.length + 1;

    const conditionRow = document.createElement('div');
    conditionRow.className = 'alert-logic-condition-row';
    conditionRow.id = `alertLogicConditionRow${questionId}_${numConditions}`;
    conditionRow.innerHTML = `
        <span>Condition ${numConditions}:</span><br>
        <input type="number" placeholder="Previous question number"
               id="alertPrevQuestion${questionId}_${numConditions}"
               onchange="updateAlertLogicAnswersForRow(${questionId}, ${numConditions})"><br>
        <select id="alertPrevAnswer${questionId}_${numConditions}" style="display: block;">
            <option value="">-- Select an answer --</option>
        </select><br>
        <button type="button" onclick="removeAlertLogicCondition(${questionId}, ${numConditions})">Remove</button>
        <hr>
    `;
    alertLogicConditionsDiv.appendChild(conditionRow);
}

function removeAlertLogicCondition(questionId, conditionIndex) {
    const row = document.getElementById(`alertLogicConditionRow${questionId}_${conditionIndex}`);
    if (row) row.remove();
}

/** On picking a "previous question" for alert logic, populate possible answers. */
function updateAlertLogicAnswersForRow(questionId, conditionIndex) {
    const questionNumberInput = document.getElementById(`alertPrevQuestion${questionId}_${conditionIndex}`);
    const answerSelect = document.getElementById(`alertPrevAnswer${questionId}_${conditionIndex}`);
    if (!questionNumberInput || !answerSelect) return;

    const prevQNum = parseInt(questionNumberInput.value);
    if (!prevQNum) {
        answerSelect.innerHTML = '<option value="">-- Select an answer --</option>';
        return;
    }
    const targetQuestionBlock = document.getElementById(`questionBlock${prevQNum}`);
    if (!targetQuestionBlock) {
        answerSelect.innerHTML = '<option value="">-- (invalid question #) --</option>';
        return;
    }
    const questionType = targetQuestionBlock.querySelector(`#questionType${prevQNum}`)?.value;
    if (!questionType) return;

    answerSelect.innerHTML = '<option value="">-- Select an answer --</option>';

    if (questionType === 'radio') {
        answerSelect.innerHTML += `
            <option value="Yes">Yes</option>
            <option value="No">No</option>
        `;
    } else if (questionType === 'dropdown') {
        const dropOpts = targetQuestionBlock.querySelectorAll(`#dropdownOptions${prevQNum} input`);
        dropOpts.forEach(opt => {
            const val = opt.value.trim();
            if (val) {
                const optionEl = document.createElement('option');
                optionEl.value = val;
                optionEl.textContent = val;
                answerSelect.appendChild(optionEl);
            }
        });
    } else if (questionType === 'checkbox') {
        const checkOpts = targetQuestionBlock.querySelectorAll(`#checkboxOptions${prevQNum} [id^="checkboxOptionText"]`);
        checkOpts.forEach(optInput => {
            const val = optInput.value.trim();
            if (val) {
                const optionEl = document.createElement('option');
                optionEl.value = val;
                optionEl.textContent = val;
                answerSelect.appendChild(optionEl);
            }
        });
        const noneOfAbove = targetQuestionBlock.querySelector(`#noneOfTheAbove${prevQNum}`);
        if (noneOfAbove && noneOfAbove.checked) {
            const optionEl = document.createElement('option');
            optionEl.value = 'None of the above';
            optionEl.textContent = 'None of the above';
            answerSelect.appendChild(optionEl);
        }
    } else if (questionType === 'numberedDropdown') {
        // Get the min and max values from the range inputs
        const rangeStartEl = targetQuestionBlock.querySelector(`#numberRangeStart${prevQNum}`);
        const rangeEndEl = targetQuestionBlock.querySelector(`#numberRangeEnd${prevQNum}`);
        
        if (rangeStartEl && rangeEndEl) {
            const min = parseInt(rangeStartEl.value) || 1;
            const max = parseInt(rangeEndEl.value) || min;
            
            // Add each number in the range as an option
            for (let i = min; i <= max; i++) {
                const optionEl = document.createElement('option');
                optionEl.value = i.toString();
                optionEl.textContent = i.toString();
                answerSelect.appendChild(optionEl);
            }
        }
    }
}

/** Add a row to the PDF logic block */
function addPdfLogicCondition(questionId) {
    const pdfLogicConditionsDiv = document.getElementById(`pdfLogicConditions${questionId}`);
    const numConditions = pdfLogicConditionsDiv.children.length + 1;
    
    // Check if this is a Big Paragraph question
    const questionBlock = document.getElementById(`questionBlock${questionId}`);
    const questionTypeSelect = questionBlock.querySelector(`#questionType${questionId}`);
    const questionType = questionTypeSelect ? questionTypeSelect.value : '';
    
    let conditionRow;
    
    if (questionType === 'bigParagraph') {
        // For Big Paragraph, show character limit selector
        conditionRow = document.createElement('div');
        conditionRow.className = 'pdf-logic-condition-row';
        conditionRow.id = `pdfLogicConditionRow${questionId}_${numConditions}`;
        conditionRow.innerHTML = `
            <span>Condition ${numConditions}:</span><br>
            <label>Character Limit:</label><br>
            <select id="pdfCharacterLimit${questionId}_${numConditions}" style="display: block;">
                <option value="">-- Choose a character limit --</option>
                <option value="50">50 characters</option>
                <option value="100">100 characters</option>
                <option value="200">200 characters</option>
                <option value="300">300 characters</option>
                <option value="500">500 characters</option>
                <option value="750">750 characters</option>
                <option value="1000">1000 characters</option>
                <option value="1500">1500 characters</option>
                <option value="2000">2000 characters</option>
                <option value="custom">Custom limit</option>
            </select><br>
            <input type="number" id="pdfCustomCharacterLimit${questionId}_${numConditions}" 
                   placeholder="Enter custom character limit" 
                   style="display: none; margin-top: 5px;"
                   min="1" max="10000"><br>
            <button type="button" onclick="removePdfLogicCondition(${questionId}, ${numConditions})">Remove</button>
            <hr>
        `;
        
        // Add event listener for custom character limit
        setTimeout(() => {
            const limitSelect = document.getElementById(`pdfCharacterLimit${questionId}_${numConditions}`);
            const customInput = document.getElementById(`pdfCustomCharacterLimit${questionId}_${numConditions}`);
            
            if (limitSelect && customInput) {
                limitSelect.addEventListener('change', function() {
                    if (this.value === 'custom') {
                        customInput.style.display = 'block';
                        customInput.focus();
                    } else {
                        customInput.style.display = 'none';
                        customInput.value = '';
                    }
                });
            }
        }, 100);
    } else {
        // For other question types, show the original previous question logic
        conditionRow = document.createElement('div');
        conditionRow.className = 'pdf-logic-condition-row';
        conditionRow.id = `pdfLogicConditionRow${questionId}_${numConditions}`;
        conditionRow.innerHTML = `
            <span>Condition ${numConditions}:</span><br>
            <input type="number" placeholder="Previous question number"
                   id="pdfPrevQuestion${questionId}_${numConditions}"
                   onchange="updatePdfLogicAnswersForRow(${questionId}, ${numConditions})"><br>
            <select id="pdfPrevAnswer${questionId}_${numConditions}" style="display: block;">
                <option value="">-- Select an answer --</option>
            </select><br>
            <button type="button" onclick="removePdfLogicCondition(${questionId}, ${numConditions})">Remove</button>
            <hr>
        `;
    }
    
    pdfLogicConditionsDiv.appendChild(conditionRow);
}

function removePdfLogicCondition(questionId, conditionIndex) {
    const row = document.getElementById(`pdfLogicConditionRow${questionId}_${conditionIndex}`);
    if (row) row.remove();
}

/** On picking a "previous question" for PDF logic, populate possible answers. */
function updatePdfLogicAnswersForRow(questionId, conditionIndex) {
    const questionNumberInput = document.getElementById(`pdfPrevQuestion${questionId}_${conditionIndex}`);
    const answerSelect = document.getElementById(`pdfPrevAnswer${questionId}_${conditionIndex}`);
    if (!questionNumberInput || !answerSelect) return;

    const prevQNum = parseInt(questionNumberInput.value);
    if (!prevQNum) {
        answerSelect.innerHTML = '<option value="">-- Select an answer --</option>';
        return;
    }
    const targetQuestionBlock = document.getElementById(`questionBlock${prevQNum}`);
    if (!targetQuestionBlock) {
        answerSelect.innerHTML = '<option value="">-- (invalid question #) --</option>';
        return;
    }
    const questionType = targetQuestionBlock.querySelector(`#questionType${prevQNum}`)?.value;
    if (!questionType) return;

    answerSelect.innerHTML = '<option value="">-- Select an answer --</option>';

    if (questionType === 'radio') {
        answerSelect.innerHTML += `
            <option value="Yes">Yes</option>
            <option value="No">No</option>
        `;
    } else if (questionType === 'dropdown') {
        const dropOpts = targetQuestionBlock.querySelectorAll(`#dropdownOptions${prevQNum} input`);
        dropOpts.forEach(opt => {
            const val = opt.value.trim();
            if (val) {
                const optionEl = document.createElement('option');
                optionEl.value = val;
                optionEl.textContent = val;
                answerSelect.appendChild(optionEl);
            }
        });
    } else if (questionType === 'checkbox') {
        const checkOpts = targetQuestionBlock.querySelectorAll(`#checkboxOptions${prevQNum} [id^="checkboxOptionText"]`);
        checkOpts.forEach(optInput => {
            const val = optInput.value.trim();
            if (val) {
                const optionEl = document.createElement('option');
                optionEl.value = val;
                optionEl.textContent = val;
                answerSelect.appendChild(optionEl);
            }
        });
        const noneOfAbove = targetQuestionBlock.querySelector(`#noneOfTheAbove${prevQNum}`);
        if (noneOfAbove && noneOfAbove.checked) {
            const optionEl = document.createElement('option');
            optionEl.value = 'None of the above';
            optionEl.textContent = 'None of the above';
            answerSelect.appendChild(optionEl);
        }
    } else if (questionType === 'numberedDropdown') {
        // Get the min and max values from the range inputs
        const rangeStartEl = targetQuestionBlock.querySelector(`#numberRangeStart${prevQNum}`);
        const rangeEndEl = targetQuestionBlock.querySelector(`#numberRangeEnd${prevQNum}`);
        
        if (rangeStartEl && rangeEndEl) {
            const min = parseInt(rangeStartEl.value) || 1;
            const max = parseInt(rangeEndEl.value) || min;
            
            // Add each number in the range as an option
            for (let i = min; i <= max; i++) {
                const optionEl = document.createElement('option');
                optionEl.value = i.toString();
                optionEl.textContent = i.toString();
                answerSelect.appendChild(optionEl);
            }
        }
    }
}

/** On picking a "previous question" for logic, populate possible answers. */
function updateLogicAnswersForRow(questionId, conditionIndex) {
    const questionNumberInput = document.getElementById(`prevQuestion${questionId}_${conditionIndex}`);
    const answerSelect = document.getElementById(`prevAnswer${questionId}_${conditionIndex}`);
    if (!questionNumberInput || !answerSelect) return;

    const prevQNum = parseInt(questionNumberInput.value);
    if (!prevQNum) {
        answerSelect.innerHTML = '<option value="">-- Select an answer --</option>';
        return;
    }
    const targetQuestionBlock = document.getElementById(`questionBlock${prevQNum}`);
    if (!targetQuestionBlock) {
        answerSelect.innerHTML = '<option value="">-- (invalid question #) --</option>';
        return;
    }
    const questionType = targetQuestionBlock.querySelector(`#questionType${prevQNum}`)?.value;
    if (!questionType) return;

    // Reset the answer select to show it again (in case it was hidden for text questions)
    answerSelect.style.display = 'block';
    answerSelect.innerHTML = '<option value="">-- Select an answer --</option>';
    
    // Remove any existing condition labels and hidden inputs for text questions
    const existingLabel = document.getElementById(`conditionLabel${questionId}_${conditionIndex}`);
    const existingHiddenInput = document.getElementById(`hiddenAnswer${questionId}_${conditionIndex}`);
    if (existingLabel) existingLabel.remove();
    if (existingHiddenInput) existingHiddenInput.remove();

    if (questionType === 'radio') {
        answerSelect.innerHTML += `
            <option value="Yes">Yes</option>
            <option value="No">No</option>
        `;
    } else if (questionType === 'dropdown') {
        const dropOpts = targetQuestionBlock.querySelectorAll(`#dropdownOptions${prevQNum} input`);
        dropOpts.forEach(opt => {
            const val = opt.value.trim();
            if (val) {
                const optionEl = document.createElement('option');
                optionEl.value = val;
                optionEl.textContent = val;
                answerSelect.appendChild(optionEl);
            }
        });
    } else if (questionType === 'checkbox') {
        const checkOpts = targetQuestionBlock.querySelectorAll(`#checkboxOptions${prevQNum} [id^="checkboxOptionText"]`);
        checkOpts.forEach(optInput => {
            const val = optInput.value.trim();
            if (val) {
                const optionEl = document.createElement('option');
                optionEl.value = val;
                optionEl.textContent = val;
                answerSelect.appendChild(optionEl);
            }
        });
        const noneOfAbove = targetQuestionBlock.querySelector(`#noneOfTheAbove${prevQNum}`);
        if (noneOfAbove && noneOfAbove.checked) {
            const optionEl = document.createElement('option');
            optionEl.value = 'None of the above';
            optionEl.textContent = 'None of the above';
            answerSelect.appendChild(optionEl);
        }
    } else if (questionType === 'numberedDropdown') {
        // Get the min and max values from the range inputs
        const rangeStartEl = targetQuestionBlock.querySelector(`#numberRangeStart${prevQNum}`);
        const rangeEndEl = targetQuestionBlock.querySelector(`#numberRangeEnd${prevQNum}`);
        
        if (rangeStartEl && rangeEndEl) {
            const min = parseInt(rangeStartEl.value) || 1;
            const max = parseInt(rangeEndEl.value) || min;
            
            // Add each number in the range as an option
            for (let i = min; i <= max; i++) {
                const optionEl = document.createElement('option');
                optionEl.value = i.toString();
                optionEl.textContent = i.toString();
                answerSelect.appendChild(optionEl);
            }
        }
    } else if (questionType === 'text' || questionType === 'bigParagraph' || questionType === 'money' || questionType === 'date' || questionType === 'dateRange') {
        // For textbox, money, and date questions, hide the answer dropdown since they don't have predefined options
        answerSelect.style.display = 'none';
        
        // Add a hidden input to store the condition value
        let hiddenInput = document.getElementById(`hiddenAnswer${questionId}_${conditionIndex}`);
        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.id = `hiddenAnswer${questionId}_${conditionIndex}`;
            hiddenInput.value = 'Any Text'; // Default value for text questions
            answerSelect.parentNode.appendChild(hiddenInput);
        }
        
        // Add a label to indicate the condition
        let conditionLabel = document.getElementById(`conditionLabel${questionId}_${conditionIndex}`);
        if (!conditionLabel) {
            conditionLabel = document.createElement('div');
            conditionLabel.id = `conditionLabel${questionId}_${conditionIndex}`;
            conditionLabel.style.cssText = 'margin: 5px 0; padding: 5px; background: #e8f4fd; border-radius: 4px; color: #1976d2; font-size: 14px;';
            conditionLabel.textContent = 'Will trigger when any text is entered';
            answerSelect.parentNode.insertBefore(conditionLabel, answerSelect);
        }
    }
}

// Jump logic toggling
function toggleJumpLogic(questionId) {
    const jumpBlock = document.getElementById(`jumpBlock${questionId}`);
    const enabled = document.getElementById(`enableJump${questionId}`).checked;
    
    jumpBlock.style.display = enabled ? 'block' : 'none';
    if (enabled) {
        const jumpConditionsDiv = document.getElementById(`jumpConditions${questionId}`);
        // Get the question type to determine how to populate options
        const questionType = document.getElementById(`questionType${questionId}`).value;
        
        // If there are no conditions yet, add the first one
        if (jumpConditionsDiv && jumpConditionsDiv.children.length === 0) {
            addJumpCondition(questionId); // Add first condition automatically
            
            // Make sure options are populated based on question type (skip for textbox and date questions)
            const isTextboxQuestion = questionType === 'text' || questionType === 'bigParagraph' || questionType === 'money' || questionType === 'date' || questionType === 'dateRange';
            if (!isTextboxQuestion) {
                if (questionType === 'numberedDropdown') {
                    updateJumpOptionsForNumberedDropdown(questionId);
                } else if (questionType === 'dropdown') {
                    updateJumpOptions(questionId);
                } else if (questionType === 'radio') {
                    updateJumpOptionsForRadio(questionId);
                } else if (questionType === 'checkbox') {
                    updateJumpOptionsForCheckbox(questionId);
                }
            }
        } else if (questionType === 'numberedDropdown') {
            // If conditions already exist but we're re-enabling jump logic,
            // make sure numbered dropdown options are populated
            updateJumpOptionsForNumberedDropdown(questionId);
        }
    }
}

// PDF logic toggling
function toggleConditionalPDFLogic(questionId) {
    const conditionalPDFEnabled = document.getElementById(`enableConditionalPDF${questionId}`).checked;
    const conditionalPDFBlock = document.getElementById(`conditionalPDFBlock${questionId}`);
    conditionalPDFBlock.style.display = conditionalPDFEnabled ? 'block' : 'none';
}

// Hidden logic toggling
function toggleHiddenLogic(questionId) {
    console.log('🔧 [HIDDEN LOGIC DEBUG] toggleHiddenLogic called for question:', questionId);
    const hiddenLogicEnabled = document.getElementById(`enableHiddenLogic${questionId}`).checked;
    console.log('🔧 [HIDDEN LOGIC DEBUG] Hidden logic enabled:', hiddenLogicEnabled);
    
    const hiddenLogicBlock = document.getElementById(`hiddenLogicBlock${questionId}`);
    hiddenLogicBlock.style.display = hiddenLogicEnabled ? 'block' : 'none';
    
    // Create first configuration when enabling
    if (hiddenLogicEnabled) {
        const configsContainer = document.getElementById(`hiddenLogicConfigs${questionId}`);
        console.log('🔧 [HIDDEN LOGIC DEBUG] Configs container found:', !!configsContainer, 'Children count:', configsContainer ? configsContainer.children.length : 0);
        
        if (configsContainer && configsContainer.children.length === 0) {
            console.log('🔧 [HIDDEN LOGIC DEBUG] Adding first hidden logic config for question:', questionId);
            addHiddenLogicConfig(questionId);
        }
    }
    
    // Clear all configurations when disabling
    if (!hiddenLogicEnabled) {
        const configsContainer = document.getElementById(`hiddenLogicConfigs${questionId}`);
        if (configsContainer) {
            configsContainer.innerHTML = '';
        }
    }
}

// Hidden logic type options toggling
function toggleHiddenLogicOptions(questionId, configIndex = 0) {
    const typeSelect = document.getElementById(`hiddenLogicType${questionId}_${configIndex}`);
    const optionsDiv = document.getElementById(`hiddenLogicOptions${questionId}_${configIndex}`);
    const textboxOptionsDiv = document.getElementById(`hiddenLogicTextboxOptions${questionId}_${configIndex}`);
    
    if (typeSelect && optionsDiv) {
        const selectedType = typeSelect.value;
        
        if (selectedType) {
            optionsDiv.style.display = 'block';
            
            // Show textbox options only if textbox is selected
            if (textboxOptionsDiv) {
                textboxOptionsDiv.style.display = selectedType === 'textbox' ? 'block' : 'none';
            }
        } else {
            optionsDiv.style.display = 'none';
            if (textboxOptionsDiv) textboxOptionsDiv.style.display = 'none';
        }
    }
}

// Update hidden logic trigger options from dropdown question options
function updateHiddenLogicTriggerOptions(questionId) {
    // Update all trigger selects for this question
    const triggerSelects = document.querySelectorAll(`[id^="hiddenLogicTrigger${questionId}_"]`);
    triggerSelects.forEach(triggerSelect => {
        // Clear existing options except the first one
        triggerSelect.innerHTML = '<option value="">Select Trigger</option>';
        
        // Get dropdown options from the question
        const dropdownOptionsDiv = document.getElementById(`dropdownOptions${questionId}`);
        if (!dropdownOptionsDiv) return;
        
        const optionInputs = dropdownOptionsDiv.querySelectorAll('input[type="text"]');
        optionInputs.forEach(optionInput => {
            const val = optionInput.value.trim();
            if (val) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.text = val;
                triggerSelect.appendChild(opt);
            }
        });
    });
}

// Update hidden logic trigger options for numbered dropdown questions
function updateHiddenLogicTriggerOptionsForNumberedDropdown(questionId) {
    console.log('🔧 [HIDDEN LOGIC DEBUG] updateHiddenLogicTriggerOptionsForNumberedDropdown called for question:', questionId);
    
    // Update all trigger selects for this question
    const triggerSelects = document.querySelectorAll(`[id^="hiddenLogicTrigger${questionId}_"]`);
    console.log('🔧 [HIDDEN LOGIC DEBUG] Found trigger selects:', triggerSelects.length);
    
    triggerSelects.forEach((triggerSelect, index) => {
        console.log('🔧 [HIDDEN LOGIC DEBUG] Processing trigger select', index, ':', triggerSelect.id);
        
        // Save current value
        const currentValue = triggerSelect.value;
        
        // Clear existing options except the first one
        triggerSelect.innerHTML = '<option value="">Select Trigger</option>';
        
        // Get the number range from the numbered dropdown
        const startInput = document.getElementById(`numberRangeStart${questionId}`);
        const endInput = document.getElementById(`numberRangeEnd${questionId}`);
        
        console.log('🔧 [HIDDEN LOGIC DEBUG] Start input found:', !!startInput, 'End input found:', !!endInput);
        
        if (startInput && endInput) {
            const start = parseInt(startInput.value) || 1;
            const end = parseInt(endInput.value) || 1;
            
            console.log('🔧 [HIDDEN LOGIC DEBUG] Range:', start, 'to', end);
            
            // Add options for each number in the range
            for (let i = start; i <= end; i++) {
                const opt = document.createElement('option');
                opt.value = i.toString();
                opt.textContent = i.toString();
                triggerSelect.appendChild(opt);
                console.log('🔧 [HIDDEN LOGIC DEBUG] Added option:', i);
            }
            
            // Restore the current value if it's still valid
            if (currentValue && parseInt(currentValue) >= start && parseInt(currentValue) <= end) {
                triggerSelect.value = currentValue;
                console.log('🔧 [HIDDEN LOGIC DEBUG] Restored value:', currentValue);
            }
        } else {
            console.log('🔧 [HIDDEN LOGIC DEBUG] Start or end input not found for question:', questionId);
        }
    });
}

// Add a new hidden logic configuration
function addHiddenLogicConfig(questionId) {
    console.log('🔧 [HIDDEN LOGIC DEBUG] addHiddenLogicConfig called for question:', questionId);
    const configsContainer = document.getElementById(`hiddenLogicConfigs${questionId}`);
    if (!configsContainer) {
        console.log('🔧 [HIDDEN LOGIC DEBUG] Configs container not found for question:', questionId);
        return;
    }
    
    // Get the next config index
    const existingConfigs = configsContainer.querySelectorAll('.hidden-logic-config');
    const configIndex = existingConfigs.length;
    console.log('🔧 [HIDDEN LOGIC DEBUG] Creating config with index:', configIndex);
    
    // Create the configuration HTML
    const configHtml = `
        <div class="hidden-logic-config" id="hiddenLogicConfig${questionId}_${configIndex}" style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong>Hidden Logic Configuration ${configIndex + 1}</strong>
                ${configIndex > 0 ? `<button type="button" onclick="removeHiddenLogicConfig(${questionId}, ${configIndex})" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Remove</button>` : ''}
            </div>
            <label>Trigger Condition:</label>
            <select id="hiddenLogicTrigger${questionId}_${configIndex}">
                <option value="">Select Trigger</option>
            </select><br><br>
            <label>Hidden Logic Type:</label>
            <select id="hiddenLogicType${questionId}_${configIndex}" onchange="toggleHiddenLogicOptions(${questionId}, ${configIndex})">
                <option value="">Select Type</option>
                <option value="checkbox">Checkbox</option>
                <option value="textbox">Textbox</option>
            </select><br><br>
            <div id="hiddenLogicOptions${questionId}_${configIndex}" style="display: none;">
                <label>Node ID:</label>
                <input type="text" id="hiddenLogicNodeId${questionId}_${configIndex}" placeholder="Enter node ID"><br><br>
                <div id="hiddenLogicTextboxOptions${questionId}_${configIndex}" style="display: none;">
                    <label>Textbox Text:</label>
                    <input type="text" id="hiddenLogicTextboxText${questionId}_${configIndex}" placeholder="Enter textbox text"><br><br>
                </div>
            </div>
        </div>
    `;
    
    // Add the configuration to the container
    configsContainer.insertAdjacentHTML('beforeend', configHtml);
    
    // Populate trigger options for the new configuration
    const questionType = document.getElementById(`questionType${questionId}`).value;
    console.log('🔧 [HIDDEN LOGIC DEBUG] Question type for trigger options:', questionType);
    
    if (questionType === 'numberedDropdown') {
        console.log('🔧 [HIDDEN LOGIC DEBUG] Calling updateHiddenLogicTriggerOptionsForNumberedDropdown');
        updateHiddenLogicTriggerOptionsForNumberedDropdown(questionId);
    } else {
        console.log('🔧 [HIDDEN LOGIC DEBUG] Calling updateHiddenLogicTriggerOptions');
        updateHiddenLogicTriggerOptions(questionId);
    }
}

// Remove a hidden logic configuration
function removeHiddenLogicConfig(questionId, configIndex) {
    const configElement = document.getElementById(`hiddenLogicConfig${questionId}_${configIndex}`);
    if (configElement) {
        configElement.remove();
        
        // Renumber remaining configurations
        renumberHiddenLogicConfigs(questionId);
    }
}

// Renumber hidden logic configurations after removal
function renumberHiddenLogicConfigs(questionId) {
    const configsContainer = document.getElementById(`hiddenLogicConfigs${questionId}`);
    if (!configsContainer) return;
    
    const configs = configsContainer.querySelectorAll('.hidden-logic-config');
    configs.forEach((config, newIndex) => {
        const oldId = config.id;
        const newId = `hiddenLogicConfig${questionId}_${newIndex}`;
        
        // Update the container ID
        config.id = newId;
        
        // Update the title
        const titleElement = config.querySelector('strong');
        if (titleElement) {
            titleElement.textContent = `Hidden Logic Configuration ${newIndex + 1}`;
        }
        
        // Update all input IDs and names
        const inputs = config.querySelectorAll('input, select');
        inputs.forEach(input => {
            const oldInputId = input.id;
            if (oldInputId) {
                const newInputId = oldInputId.replace(/_\d+$/, `_${newIndex}`);
                input.id = newInputId;
                
                // Update onchange handlers
                if (input.onchange) {
                    input.onchange = new Function(`toggleHiddenLogicOptions(${questionId}, ${newIndex})`);
                }
            }
        });
        
        // Update remove button
        const removeButton = config.querySelector('button[onclick*="removeHiddenLogicConfig"]');
        if (removeButton && newIndex > 0) {
            removeButton.onclick = new Function(`removeHiddenLogicConfig(${questionId}, ${newIndex})`);
        } else if (removeButton && newIndex === 0) {
            removeButton.remove();
        }
    });
}

// Add another PDF to the PDF logic
function addAnotherPdf(questionId) {
    const pdfDetailsContainer = document.getElementById(`pdfDetailsContainer${questionId}`);
    const existingPdfs = pdfDetailsContainer.querySelectorAll('.pdf-detail-group');
    const nextIndex = existingPdfs.length + 1;
    
    const newPdfGroup = document.createElement('div');
    newPdfGroup.className = 'pdf-detail-group';
    newPdfGroup.setAttribute('data-pdf-index', nextIndex);
    newPdfGroup.innerHTML = `
        <div style="border: 2px solid #007bff; border-radius: 8px; padding: 15px; margin: 10px 0; background: #f8f9ff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="margin: 0; color: #007bff;">PDF ${nextIndex}</h4>
            </div>
            
            <!-- Trigger Option for Numbered Dropdown -->
            <div id="triggerOptionBlock${questionId}_${nextIndex}" style="display: none;">
                <label>Trigger option:</label>
                <select id="pdfLogicTriggerOption${questionId}_${nextIndex}">
                    <option value="">Select trigger option</option>
                </select>
                <br><br>
            </div>
            
            <label>PDF Name (for cart display):</label>
            <input type="text" id="pdfLogicPdfDisplayName${questionId}_${nextIndex}" placeholder="Enter custom PDF name (e.g., Small Claims 500A)">
            <br><br>
            <label>Additional PDF to download:</label>
            <input type="text" id="pdfLogicPdfName${questionId}_${nextIndex}" placeholder="Enter PDF name (e.g., additional_form.pdf)">
            <br><br>
            <label>Choose your Price ID:</label>
            <input type="text" id="pdfLogicStripePriceId${questionId}_${nextIndex}" placeholder="Enter Stripe Price ID (e.g., price_12345)">
            <br><br>
            
            <div style="text-align: center; margin-top: 15px;">
                <button type="button" onclick="removePdf(${questionId}, ${nextIndex})" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">Remove PDF</button>
            </div>
        </div>
    `;
    
    pdfDetailsContainer.appendChild(newPdfGroup);
    
    // Update trigger options for the new PDF if it's a numbered dropdown
    const questionBlock = document.getElementById(`questionBlock${questionId}`);
    const questionTypeSelect = questionBlock.querySelector(`#questionType${questionId}`);
    const questionType = questionTypeSelect ? questionTypeSelect.value : '';
    
    if (questionType === 'numberedDropdown') {
        const triggerOptionBlock = newPdfGroup.querySelector(`#triggerOptionBlock${questionId}_${nextIndex}`);
        triggerOptionBlock.style.display = 'block';
        updatePdfLogicTriggerOptions(questionId);
    }
}

// Remove a PDF from the PDF logic
function removePdf(questionId, pdfIndex) {
    const pdfDetailsContainer = document.getElementById(`pdfDetailsContainer${questionId}`);
    const pdfGroup = pdfDetailsContainer.querySelector(`[data-pdf-index="${pdfIndex}"]`);
    if (pdfGroup) {
        pdfGroup.remove();
    }
}

// Add extra PDF inputs to an existing PDF group
function addExtraPdf(questionId, pdfIndex) {
    const pdfGroup = document.getElementById(`pdfDetailsContainer${questionId}`).querySelector(`[data-pdf-index="${pdfIndex}"]`);
    if (!pdfGroup) return;
    
    // Count existing extra PDFs in this group
    const existingExtraPdfs = pdfGroup.querySelectorAll('.extra-pdf-inputs');
    const extraPdfIndex = existingExtraPdfs.length + 1;
    
    // Create the extra PDF inputs container
    const extraPdfContainer = document.createElement('div');
    extraPdfContainer.className = 'extra-pdf-inputs';
    extraPdfContainer.style.cssText = 'border: 1px solid #28a745; border-radius: 6px; padding: 12px; margin: 10px 0; background: #f8fff8;';
    
    extraPdfContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h5 style="margin: 0; color: #28a745;">Extra PDF ${extraPdfIndex}</h5>
            <button type="button" onclick="removeExtraPdf(this)" style="background: #dc3545; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; font-size: 0.8em;">Remove</button>
        </div>
        
        <label>PDF Name (for cart display):</label>
        <input type="text" id="pdfLogicPdfDisplayName${questionId}_${pdfIndex}_extra${extraPdfIndex}" placeholder="Enter custom PDF name (e.g., Small Claims 500A)">
        <br><br>
        <label>Additional PDF to download:</label>
        <input type="text" id="pdfLogicPdfName${questionId}_${pdfIndex}_extra${extraPdfIndex}" placeholder="Enter PDF name (e.g., additional_form.pdf)">
        <br><br>
        <label>Choose your Price ID:</label>
        <input type="text" id="pdfLogicStripePriceId${questionId}_${pdfIndex}_extra${extraPdfIndex}" placeholder="Enter Stripe Price ID (e.g., price_12345)">
    `;
    
    // Insert the extra PDF container after the trigger option block (if it exists) or after the main PDF inputs
    const triggerOptionBlock = pdfGroup.querySelector(`#triggerOptionBlock${questionId}_${pdfIndex}`);
    if (triggerOptionBlock && triggerOptionBlock.style.display !== 'none') {
        triggerOptionBlock.insertAdjacentElement('afterend', extraPdfContainer);
    } else {
        // Find the last input in the main PDF group and insert after it
        const lastInput = pdfGroup.querySelector('input:last-of-type');
        if (lastInput) {
            lastInput.parentNode.insertBefore(extraPdfContainer, lastInput.nextSibling);
        } else {
            pdfGroup.appendChild(extraPdfContainer);
        }
    }
}

// Remove an extra PDF input container
function removeExtraPdf(button) {
    const extraPdfContainer = button.closest('.extra-pdf-inputs');
    if (extraPdfContainer) {
        extraPdfContainer.remove();
    }
}

// Update PDF Logic trigger options for numbered dropdown
function updatePdfLogicTriggerOptions(questionId) {
    const questionBlock = document.getElementById(`questionBlock${questionId}`);
    const questionTypeSelect = questionBlock.querySelector(`#questionType${questionId}`);
    const questionType = questionTypeSelect ? questionTypeSelect.value : '';
    
    if (questionType === 'numberedDropdown') {
        const rangeStartEl = questionBlock.querySelector(`#numberRangeStart${questionId}`);
        const rangeEndEl = questionBlock.querySelector(`#numberRangeEnd${questionId}`);
        
        if (rangeStartEl && rangeEndEl) {
            const min = parseInt(rangeStartEl.value) || 1;
            const max = parseInt(rangeEndEl.value) || min;
            
            // Update all trigger selects for all PDFs
            const allTriggerSelects = document.querySelectorAll(`[id^="pdfLogicTriggerOption${questionId}"]`);
            allTriggerSelects.forEach(triggerSelect => {
                // Save the currently selected value
                const currentValue = triggerSelect.value;
                
                // Clear existing options except the first one
                triggerSelect.innerHTML = '<option value="">Select trigger option</option>';
                
                // Add each number in the range as an option
                for (let i = min; i <= max; i++) {
                    const optionEl = document.createElement('option');
                    optionEl.value = i.toString();
                    optionEl.textContent = i.toString();
                    triggerSelect.appendChild(optionEl);
                }
                
                // Restore the selected value if it's still valid
                if (currentValue && parseInt(currentValue) >= min && parseInt(currentValue) <= max) {
                    triggerSelect.value = currentValue;
                }
            });
        }
    }
}

// PDF Logic toggling
function togglePdfLogic(questionId) {
    const pdfLogicEnabled = document.getElementById(`pdfLogic${questionId}`).checked;
    const pdfLogicBlock = document.getElementById(`pdfLogicBlock${questionId}`);
    pdfLogicBlock.style.display = pdfLogicEnabled ? 'block' : 'none';
    
    // Show/hide trigger option for numbered dropdown questions
    const questionBlock = document.getElementById(`questionBlock${questionId}`);
    const questionTypeSelect = questionBlock.querySelector(`#questionType${questionId}`);
    const questionType = questionTypeSelect ? questionTypeSelect.value : '';
    const triggerOptionBlock = document.getElementById(`triggerOptionBlock${questionId}`);
    const numberTriggerBlock = document.getElementById(`numberTriggerBlock${questionId}`);
    
    if (pdfLogicEnabled && questionType === 'numberedDropdown') {
        triggerOptionBlock.style.display = 'block';
        updatePdfLogicTriggerOptions(questionId);
        if (numberTriggerBlock) numberTriggerBlock.style.display = 'none';
    } else if (pdfLogicEnabled && questionType === 'number') {
        if (numberTriggerBlock) numberTriggerBlock.style.display = 'block';
        triggerOptionBlock.style.display = 'none';
    } else {
        triggerOptionBlock.style.display = 'none';
        if (numberTriggerBlock) numberTriggerBlock.style.display = 'none';
    }
    
    // If enabling PDF logic for a Big Paragraph question, clear any existing conditions
    if (pdfLogicEnabled) {
        if (questionType === 'bigParagraph') {
            const pdfLogicConditionsDiv = document.getElementById(`pdfLogicConditions${questionId}`);
            if (pdfLogicConditionsDiv) {
                pdfLogicConditionsDiv.innerHTML = '';
                // Add a default character limit condition for Big Paragraph
                addPdfLogicCondition(questionId);
            }
        }
    }
}

// Alert Logic toggling
function toggleAlertLogic(questionId) {
    const alertLogicEnabled = document.getElementById(`alertLogic${questionId}`).checked;
    const alertLogicBlock = document.getElementById(`alertLogicBlock${questionId}`);
    alertLogicBlock.style.display = alertLogicEnabled ? 'block' : 'none';
}

// Alert logic toggling
function toggleConditionalAlertLogic(questionId) {
    const conditionalAlertEnabled = document.getElementById(`enableConditionalAlert${questionId}`).checked;
    const conditionalAlertBlock = document.getElementById(`conditionalAlertBlock${questionId}`);
    conditionalAlertBlock.style.display = conditionalAlertEnabled ? 'block' : 'none';
}

// -------------------------------------------------------
// --- Extra logic for radio/checkbox PDF answers, jump
// -------------------------------------------------------
function updateConditionalPDFAnswersForRadio(questionId) {
    const selectEl = document.getElementById(`conditionalPDFAnswer${questionId}`);
    if (!selectEl) return;
    selectEl.innerHTML = '';
    ['Yes', 'No'].forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.text = opt;
        selectEl.appendChild(o);
    });
}

function updateConditionalPDFAnswersForCheckbox(questionId) {
    const selectEl = document.getElementById(`conditionalPDFAnswer${questionId}`);
    if (!selectEl) return;
    selectEl.innerHTML = '';

    const checkboxOptionsDiv = document.getElementById(`checkboxOptions${questionId}`);
    if (!checkboxOptionsDiv) return;

    const options = checkboxOptionsDiv.querySelectorAll(`input[id^="checkboxOptionText${questionId}_"]`);
    options.forEach(optionInput => {
        const val = optionInput.value.trim();
        if (val) {
            const o = document.createElement('option');
            o.value = val;
            o.text = val;
            selectEl.appendChild(o);
        }
    });

    const noneOfTheAboveCheckbox = document.getElementById(`noneOfTheAbove${questionId}`);
    if (noneOfTheAboveCheckbox && noneOfTheAboveCheckbox.checked) {
        const o = document.createElement('option');
        o.value = 'None of the above';
        o.text = 'None of the above';
        selectEl.appendChild(o);
    }
     updateJumpOptionsForCheckbox(questionId);
}

// Radio jump options
function updateJumpOptionsForRadio(questionId, conditionId = null) {
    const selectElements = conditionId 
        ? [document.getElementById(`jumpOption${questionId}_${conditionId}`)]
        : document.querySelectorAll(`[id^="jumpOption${questionId}_"]`);

    selectElements.forEach(selectEl => {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        ['Yes', 'No'].forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.text = val;
            selectEl.appendChild(opt);
        });
    });
}


// -------------------------------------------
// --- Functions to add various sub-options
// -------------------------------------------
function addDropdownOption(questionId) {
    const dropdownOptionsDiv = document.getElementById(`dropdownOptions${questionId}`);
    const optionCount = dropdownOptionsDiv.children.length + 1;

    const optionDiv = document.createElement('div');
    optionDiv.className = `option${optionCount}`;
    const optionId = `option${questionId}_${optionCount}`;
    optionDiv.innerHTML = `
        <input type="text" id="${optionId}" placeholder="Option ${optionCount}">
        <button type="button" onclick="removeDropdownOption(${questionId}, ${optionCount})">Remove</button>
    `;
    dropdownOptionsDiv.appendChild(optionDiv);

    const optionInput = optionDiv.querySelector('input[type="text"]');
    optionInput.addEventListener('input', () => {
        // Update all jump conditions for this question
        const jumpConditions = document.querySelectorAll(`#jumpConditions${questionId} .jump-condition`);
        jumpConditions.forEach(condition => {
            const conditionId = condition.id.split('_')[1];
            updateJumpOptions(questionId, conditionId);
        });
        
        // Update hidden logic trigger options
        updateHiddenLogicTriggerOptions(questionId);
    });

    // Update all existing jump conditions
    updateJumpOptions(questionId);
    
    // Update all checklist logic dropdowns
    updateAllChecklistLogicDropdowns();
    
    // Update hidden logic trigger options
    updateHiddenLogicTriggerOptions(questionId);
}

function removeDropdownOption(questionId, optionNumber) {
    const optionDiv = document.querySelector(`#dropdownOptions${questionId} .option${optionNumber}`);
    if (optionDiv) {
        optionDiv.remove();
        const options = document.querySelectorAll(`#dropdownOptions${questionId} > div`);
        options.forEach((option, index) => {
            option.className = `option${index + 1}`;
            const inputEl = option.querySelector('input[type="text"]');
            inputEl.id = `option${questionId}_${index + 1}`;
            // reattach remove button
            const btn = option.querySelector('button');
            btn.setAttribute('onclick', `removeDropdownOption(${questionId}, ${index + 1})`);
        });
    }
    updateJumpOptions(questionId);
    
    // Update all checklist logic dropdowns
    updateAllChecklistLogicDropdowns();
    
    // Update hidden logic trigger options
    updateHiddenLogicTriggerOptions(questionId);
}

function addCheckboxOption(questionId) {
    const checkboxOptionsDiv = document.getElementById(`checkboxOptions${questionId}`);
    const optionCount = checkboxOptionsDiv.children.length + 1;

    const optionDiv = document.createElement('div');
    optionDiv.className = `option${optionCount}`;
    optionDiv.innerHTML = `
        <label>Option ${optionCount} Text:</label>
        <input type="text" id="checkboxOptionText${questionId}_${optionCount}" placeholder="Enter option text"><br><br>
        <label>Name/ID:</label>
        <input type="text" id="checkboxOptionName${questionId}_${optionCount}" placeholder="Enter Name/ID"><br><br>
        <label>Value (optional):</label>
        <input type="text" id="checkboxOptionValue${questionId}_${optionCount}" placeholder="Enter Value"><br><br>
        <label>
            <input type="checkbox" id="checkboxOptionHasAmount${questionId}_${optionCount}" 
                   onchange="toggleAmountPlaceholder(${questionId}, ${optionCount})">
            Enable amount field
        </label>
        <div id="checkboxOptionAmountDetails${questionId}_${optionCount}" 
             style="display: none; margin-top: 8px;">
            <label>Amount Field Name:</label>
            <input type="text" id="checkboxOptionAmountName${questionId}_${optionCount}"
                   placeholder="Enter amount field name"><br><br>
            <label>Amount Placeholder:</label>
            <input type="text" id="checkboxOptionAmountPlaceholder${questionId}_${optionCount}"
                   placeholder="Enter amount placeholder"><br>
        </div>
        <button type="button" onclick="removeCheckboxOption(${questionId}, ${optionCount})">Remove</button>
        <hr>
    `;
    checkboxOptionsDiv.appendChild(optionDiv);

    // Add input listeners
    // 1. For jump conditions
    const optionTextInput = optionDiv.querySelector(`#checkboxOptionText${questionId}_${optionCount}`);
    if (optionTextInput) {
        optionTextInput.addEventListener('input', () => {
            updateJumpOptionsForCheckbox(questionId);
            // Also update calculation dropdowns if available
            if (typeof updateAllCalculationDropdowns === 'function') {
                setTimeout(updateAllCalculationDropdowns, 100);
            }
        });
    }
    
    // 2. For amount name changes
    const amountNameInput = optionDiv.querySelector(`#checkboxOptionAmountName${questionId}_${optionCount}`);
    if (amountNameInput) {
        amountNameInput.addEventListener('input', () => {
            // Update calculation dropdowns if available
            if (typeof updateAllCalculationDropdowns === 'function') {
                setTimeout(updateAllCalculationDropdowns, 100);
            }
        });
    }

    // Update all existing jump conditions
    updateJumpOptionsForCheckbox(questionId);
    
    // Update all checklist logic dropdowns
    updateAllChecklistLogicDropdowns();
}

function toggleAmountPlaceholder(questionId, optionNumber) {
    const hasAmount = document.getElementById(`checkboxOptionHasAmount${questionId}_${optionNumber}`).checked;
    const amountDetails = document.getElementById(`checkboxOptionAmountDetails${questionId}_${optionNumber}`);
    if (amountDetails) {
        amountDetails.style.display = hasAmount ? 'block' : 'none';
    }
    
    // Update all calculation dropdowns to reflect the new amount field
    if (typeof updateAllCalculationDropdowns === 'function') {
        setTimeout(updateAllCalculationDropdowns, 100);
    }
}

function removeCheckboxOption(questionId, optionNumber) {
    const optionDiv = document.querySelector(`#checkboxOptions${questionId} .option${optionNumber}`);
    if (optionDiv) {
        optionDiv.remove();
        const options = document.querySelectorAll(`#checkboxOptions${questionId} > div`);
        options.forEach((option, index) => {
            const newOptionNumber = index + 1;
            option.className = `option${newOptionNumber}`;
            option.querySelector('label').innerText = `Option ${newOptionNumber} Text:`;
            option.querySelector(`input[id^="checkboxOptionText"]`).id = `checkboxOptionText${questionId}_${newOptionNumber}`;
            option.querySelector(`input[id^="checkboxOptionName"]`).id = `checkboxOptionName${questionId}_${newOptionNumber}`;
            option.querySelector(`input[id^="checkboxOptionValue"]`).id = `checkboxOptionValue${questionId}_${newOptionNumber}`;
            option.querySelector(`input[id^="checkboxOptionHasAmount"]`).id = `checkboxOptionHasAmount${questionId}_${newOptionNumber}`;
            option.querySelector(`div[id^="checkboxOptionAmountDetails"]`).id = `checkboxOptionAmountDetails${questionId}_${newOptionNumber}`;
            option.querySelector(`input[id^="checkboxOptionAmountName"]`).id = `checkboxOptionAmountName${questionId}_${newOptionNumber}`;
            option.querySelector(`input[id^="checkboxOptionAmountPlaceholder"]`).id = `checkboxOptionAmountPlaceholder${questionId}_${newOptionNumber}`;
            option.querySelector('button').setAttribute('onclick', `removeCheckboxOption(${questionId}, ${newOptionNumber})`);
        });
    }
    updateConditionalPDFAnswersForCheckbox(questionId);
    updateJumpOptionsForCheckbox(questionId);
    
    // Update all checklist logic dropdowns
    updateAllChecklistLogicDropdowns();
}


function addTextboxAmount(questionId) {
    const unifiedDiv = getUnifiedContainer(questionId);
    
    // Remove placeholder if it exists
    const placeholder = unifiedDiv.querySelector('div[style*="font-style: italic"]');
    if (placeholder) {
        placeholder.remove();
    }
    
    const fieldCount = unifiedDiv.children.length + 1;

    const fieldDiv = document.createElement('div');
    fieldDiv.className = `unified-field field-${fieldCount}`;
    fieldDiv.setAttribute('data-type', 'amount');
    fieldDiv.setAttribute('data-order', fieldCount);
    fieldDiv.innerHTML = `
        <div style="margin: 10px 0; padding: 12px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-weight: bold; color: #333;">Amount: <span id="labelText${questionId}_${fieldCount}">Amount ${fieldCount}</span></div>
            <div style="font-size: 0.9em; color: #666;">Node ID: <span id="nodeIdText${questionId}_${fieldCount}">amount_${fieldCount}</span></div>
            <div style="font-size: 0.8em; color: #999; margin-top: 5px;">Type: <span id="typeText${questionId}_${fieldCount}">Amount</span> | Order: ${fieldCount}</div>
            <button type="button" onclick="removeUnifiedField(${questionId}, ${fieldCount})" style="margin-top: 5px; background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;">Remove</button>
        </div>
    `;
    unifiedDiv.appendChild(fieldDiv);
    console.log('🔧 [ADD AMOUNT DEBUG] Added field to unified container. New count:', unifiedDiv.children.length);
    console.log('🔧 [ADD AMOUNT DEBUG] Unified container dimensions:', unifiedDiv.offsetWidth, 'x', unifiedDiv.offsetHeight);
    console.log('🔧 [ADD AMOUNT DEBUG] Unified container display style:', window.getComputedStyle(unifiedDiv).display);
    console.log('🔧 [ADD AMOUNT DEBUG] Field div dimensions:', fieldDiv.offsetWidth, 'x', fieldDiv.offsetHeight);
    
    // Force the container to be visible and have dimensions
    unifiedDiv.style.minHeight = '50px';
    unifiedDiv.style.border = '1px solid #e0e0e0';
    unifiedDiv.style.borderRadius = '5px';
    unifiedDiv.style.padding = '10px';
    unifiedDiv.style.backgroundColor = '#fafafa';
    unifiedDiv.style.margin = '10px 0';
    unifiedDiv.style.width = '100%';
    unifiedDiv.style.display = 'block';
    unifiedDiv.style.position = 'relative';
    
    console.log('🔧 [ADD AMOUNT DEBUG] After styling - Unified container dimensions:', unifiedDiv.offsetWidth, 'x', unifiedDiv.offsetHeight);
    console.log('🔧 [ADD AMOUNT DEBUG] After styling - Field div dimensions:', fieldDiv.offsetWidth, 'x', fieldDiv.offsetHeight);
    
    // Add double-click event listener as backup
    const displayDiv = fieldDiv.querySelector('div');
    if (displayDiv) {
        // Remove any existing event listeners to prevent duplicates
        if (displayDiv._dblclickHandler) {
            displayDiv.removeEventListener('dblclick', displayDiv._dblclickHandler);
        }
        
        // Add event listener for double-click editing
        displayDiv._dblclickHandler = function() {
            editUnifiedField(questionId, fieldCount);
        };
        displayDiv.addEventListener('dblclick', displayDiv._dblclickHandler);
    }
    
    // Also add to hidden container for backward compatibility
    const textboxAmountsDiv = document.getElementById(`textboxAmounts${questionId}`);
    const amountCount = textboxAmountsDiv.children.length + 1;
    const hiddenAmountDiv = document.createElement('div');
    hiddenAmountDiv.className = `amount${amountCount}`;
    hiddenAmountDiv.innerHTML = `
        <input type="text" id="amount${questionId}_${amountCount}" 
               placeholder="Amount ${amountCount} (placeholder text)">
        <button type="button" onclick="removeTextboxAmount(${questionId}, ${amountCount})">Remove</button>
    `;
    textboxAmountsDiv.appendChild(hiddenAmountDiv);
}



function removeTextboxAmount(questionId, amountNumber) {
    const amountDiv = document.querySelector(`#textboxAmounts${questionId} .amount${amountNumber}`);
    if (amountDiv) {
        amountDiv.remove();
        const allAmounts = document.querySelectorAll(`#textboxAmounts${questionId} > div`);

        allAmounts.forEach((amt, idx) => {
            const newAmountNumber = idx + 1;
            amt.className = `amount${newAmountNumber}`;

            const inp = amt.querySelector('input[type="number"]');
            inp.id = `amount${questionId}_${newAmountNumber}`;
            inp.placeholder = `Amount ${newAmountNumber}`;

            const btn = amt.querySelector('button');
            btn.setAttribute('onclick', `removeTextboxAmount(${questionId}, ${newAmountNumber})`);
        });
    }
    
    // Note: updateUnifiedFieldsDisplay is not called here because we're already adding directly to unified container
}

function getUnifiedContainer(questionId) {
  // Get the unified container (should be in the correct position now)
  let container = document.getElementById(`unifiedFields${questionId}`);
  
  // If not found at all (corrupt DOM or old data), create it in the right place
  if (!container) {
    // Find the question block to place it at the end
    const qb = document.getElementById(`questionBlock${questionId}`);
    if (qb) {
      container = document.createElement('div');
      container.id = `unifiedFields${questionId}`;
      container.style.display = 'block';
      qb.appendChild(container);
    }
  }

  // Always ensure it's visible when we're going to write into it
  if (container && container.style.display === 'none') {
    container.style.display = 'block';
  }

  return container;
}

function addTextboxLabel(questionId) {
    const unifiedDiv = getUnifiedContainer(questionId);
    console.log('🔧 [ADD LABEL DEBUG] Looking for unified container:', `unifiedFields${questionId}`);
    console.log('🔧 [ADD LABEL DEBUG] Found unified container:', !!unifiedDiv);
    console.log('🔧 [ADD LABEL DEBUG] Unified container display style:', unifiedDiv ? window.getComputedStyle(unifiedDiv).display : 'N/A');
    console.log('🔧 [ADD LABEL DEBUG] Unified container visibility:', unifiedDiv ? window.getComputedStyle(unifiedDiv).visibility : 'N/A');
    
    // Check parent container
    if (unifiedDiv && unifiedDiv.parentElement) {
        console.log('🔧 [ADD LABEL DEBUG] Parent container:', unifiedDiv.parentElement.tagName, unifiedDiv.parentElement.id);
        console.log('🔧 [ADD LABEL DEBUG] Parent display style:', window.getComputedStyle(unifiedDiv.parentElement).display);
        console.log('🔧 [ADD LABEL DEBUG] Parent dimensions:', unifiedDiv.parentElement.offsetWidth, 'x', unifiedDiv.parentElement.offsetHeight);
    }
    
    if (!unifiedDiv) {
        console.error('🔧 [ADD LABEL DEBUG] Unified container not found!');
        return;
    }
    
    // Ensure the unified container is visible
    if (unifiedDiv.style.display === 'none') {
        console.log('🔧 [ADD LABEL DEBUG] Unified container was hidden, making it visible');
        unifiedDiv.style.display = 'block';
    }
    
    // Remove placeholder if it exists
    const placeholder = unifiedDiv.querySelector('div[style*="font-style: italic"]');
    if (placeholder) {
        placeholder.remove();
    }
    
    const fieldCount = unifiedDiv.children.length + 1;
    console.log('🔧 [ADD LABEL DEBUG] Current field count:', fieldCount);

    const fieldDiv = document.createElement('div');
    fieldDiv.className = `unified-field field-${fieldCount}`;
    fieldDiv.setAttribute('data-type', 'label');
    fieldDiv.setAttribute('data-order', fieldCount);
    fieldDiv.innerHTML = `
        <div style="margin: 10px 0; padding: 12px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-weight: bold; color: #333;">Label: <span id="labelText${questionId}_${fieldCount}">Label ${fieldCount}</span></div>
            <div style="font-size: 0.9em; color: #666;">Node ID: <span id="nodeIdText${questionId}_${fieldCount}">label_${fieldCount}</span></div>
            <div style="font-size: 0.8em; color: #999; margin-top: 5px;">Type: <span id="typeText${questionId}_${fieldCount}">Label</span> | Order: ${fieldCount}</div>
            <button type="button" onclick="removeUnifiedField(${questionId}, ${fieldCount})" style="margin-top: 5px; background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;">Remove</button>
        </div>
    `;
    unifiedDiv.appendChild(fieldDiv);
    console.log('🔧 [ADD LABEL DEBUG] Added field to unified container. New count:', unifiedDiv.children.length);
    console.log('🔧 [ADD LABEL DEBUG] Unified container dimensions:', unifiedDiv.offsetWidth, 'x', unifiedDiv.offsetHeight);
    console.log('🔧 [ADD LABEL DEBUG] Unified container display style:', window.getComputedStyle(unifiedDiv).display);
    console.log('🔧 [ADD LABEL DEBUG] Field div dimensions:', fieldDiv.offsetWidth, 'x', fieldDiv.offsetHeight);
    
    // Force a reflow and check if the container has any content
    unifiedDiv.offsetHeight; // Force reflow
    console.log('🔧 [ADD LABEL DEBUG] Container has children:', unifiedDiv.children.length);
    console.log('🔧 [ADD LABEL DEBUG] Container innerHTML length:', unifiedDiv.innerHTML.length);
    
    // Try adding a temporary visible element to force dimensions
    if (unifiedDiv.offsetWidth === 0 && unifiedDiv.offsetHeight === 0) {
        console.log('🔧 [ADD LABEL DEBUG] Container has zero dimensions, adding temporary content');
        const tempDiv = document.createElement('div');
        tempDiv.style.width = '100px';
        tempDiv.style.height = '20px';
        tempDiv.style.backgroundColor = 'red';
        tempDiv.style.position = 'absolute';
        tempDiv.style.top = '0';
        tempDiv.style.left = '0';
        tempDiv.textContent = 'TEMP';
        unifiedDiv.appendChild(tempDiv);
        
        console.log('🔧 [ADD LABEL DEBUG] After temp content - Container dimensions:', unifiedDiv.offsetWidth, 'x', unifiedDiv.offsetHeight);
    }
    
    // Force the container to be visible and have dimensions
    unifiedDiv.style.minHeight = '50px';
    unifiedDiv.style.border = '1px solid #e0e0e0';
    unifiedDiv.style.borderRadius = '5px';
    unifiedDiv.style.padding = '10px';
    unifiedDiv.style.backgroundColor = '#fafafa';
    unifiedDiv.style.margin = '10px 0';
    unifiedDiv.style.width = '100%';
    unifiedDiv.style.display = 'block';
    unifiedDiv.style.position = 'relative';
    
    console.log('🔧 [ADD LABEL DEBUG] After styling - Unified container dimensions:', unifiedDiv.offsetWidth, 'x', unifiedDiv.offsetHeight);
    console.log('🔧 [ADD LABEL DEBUG] After styling - Field div dimensions:', fieldDiv.offsetWidth, 'x', fieldDiv.offsetHeight);
    
    // Add double-click event listener as backup
    const displayDiv = fieldDiv.querySelector('div');
    if (displayDiv) {
        // Remove any existing event listeners to prevent duplicates
        if (displayDiv._dblclickHandler) {
            displayDiv.removeEventListener('dblclick', displayDiv._dblclickHandler);
        }
        
        // Add event listener for double-click editing
        displayDiv._dblclickHandler = function() {
            editUnifiedField(questionId, fieldCount);
        };
        displayDiv.addEventListener('dblclick', displayDiv._dblclickHandler);
    }
    
    // Also add to hidden container for backward compatibility
    const textboxLabelsDiv = document.getElementById(`textboxLabels${questionId}`);
    const labelCount = textboxLabelsDiv.children.length + 1;
    const hiddenLabelDiv = document.createElement('div');
    hiddenLabelDiv.className = `label${labelCount}`;
    hiddenLabelDiv.innerHTML = `
        <input type="text" id="label${questionId}_${labelCount}" placeholder="Label ${labelCount}">
        <br>
        <label style="font-size: 0.9em; color: #666;">Node ID: </label>
        <input type="text" id="labelNodeId${questionId}_${labelCount}" placeholder="Enter node ID for this label" style="width: 200px; margin-top: 5px;">
        <button type="button" onclick="removeTextboxLabel(${questionId}, ${labelCount})" style="margin-top: 5px;">Remove</button>
    `;
    textboxLabelsDiv.appendChild(hiddenLabelDiv);
}

function removeTextboxLabel(questionId, labelNumber) {
    const labelDiv = document.querySelector(`#textboxLabels${questionId} .label${labelNumber}`);
    if (labelDiv) {
        labelDiv.remove();
        const labels = document.querySelectorAll(`#textboxLabels${questionId} > div`);
        labels.forEach((lbl, idx) => {
            const newLabelNumber = idx + 1;
            lbl.className = `label${newLabelNumber}`;
            const inp = lbl.querySelector('input[type="text"]:first-of-type');
            inp.id = `label${questionId}_${newLabelNumber}`;
            inp.placeholder = `Label ${newLabelNumber}`;
            const nodeIdInp = lbl.querySelector('input[type="text"]:last-of-type');
            nodeIdInp.id = `labelNodeId${questionId}_${newLabelNumber}`;
            const btn = lbl.querySelector('button');
            btn.setAttribute('onclick', `removeTextboxLabel(${questionId}, ${newLabelNumber})`);
        });
    }
    
    // Note: updateUnifiedFieldsDisplay is not called here because we're already adding directly to unified container
}

function addCheckboxField(questionId) {
    const unifiedDiv = getUnifiedContainer(questionId);
    console.log('🔧 [ADD CHECKBOX DEBUG] Looking for unified container:', `unifiedFields${questionId}`);
    console.log('🔧 [ADD CHECKBOX DEBUG] Found unified container:', !!unifiedDiv);
    
    if (!unifiedDiv) {
        console.error('🔧 [ADD CHECKBOX DEBUG] Unified container not found!');
        return;
    }
    
    // Ensure the unified container is visible
    if (unifiedDiv.style.display === 'none') {
        console.log('🔧 [ADD CHECKBOX DEBUG] Unified container was hidden, making it visible');
        unifiedDiv.style.display = 'block';
    }
    
    // Remove placeholder if it exists
    const placeholder = unifiedDiv.querySelector('div[style*="font-style: italic"]');
    if (placeholder) {
        placeholder.remove();
    }
    
    const fieldCount = unifiedDiv.children.length + 1;
    console.log('🔧 [ADD CHECKBOX DEBUG] Current field count:', fieldCount);

    const fieldDiv = document.createElement('div');
    fieldDiv.className = `unified-field field-${fieldCount}`;
    fieldDiv.setAttribute('data-type', 'checkbox');
    fieldDiv.setAttribute('data-order', fieldCount);
    fieldDiv.innerHTML = `
        <div style="margin: 10px 0; padding: 12px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-weight: bold; color: #333; text-align: center; margin-bottom: 10px;">Field Name:</div>
            <div style="text-align: center; margin-bottom: 10px;">
                <input type="text" id="checkboxFieldName${questionId}_${fieldCount}" placeholder="Enter field name" style="width: 80%; max-width: 500px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;" onchange="updateCheckboxFieldName(${questionId}, ${fieldCount})">
            </div>
            <div style="font-weight: bold; color: #333; text-align: center; margin-bottom: 10px;">Selection Type:</div>
            <div style="text-align: center; margin-bottom: 10px;">
                <select id="checkboxSelectionType${questionId}_${fieldCount}" style="width: 80%; max-width: 500px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; margin: 0 auto; display: block;" onchange="updateCheckboxSelectionType(${questionId}, ${fieldCount})">
                    <option value="multiple">Mark all that apply</option>
                    <option value="single">Select only one</option>
                </select>
            </div>
            <div style="text-align: center; margin-top: 10px;">
                <button type="button" onclick="addCheckboxOption(${questionId}, ${fieldCount})" style="margin: 5px auto; padding: 6px 12px; border: none; border-radius: 6px; background-color: #9C27B0; color: white; cursor: pointer; font-size: 12px; display: block;">Add checkbox option</button>
            </div>
            <div id="checkboxOptions${questionId}_${fieldCount}" style="margin-top: 10px;">
                <!-- Checkbox options will be added here -->
            </div>
            <div style="font-size: 0.8em; color: #999; margin-top: 10px; text-align: center;">Type: <span id="typeText${questionId}_${fieldCount}">Checkbox</span> | Order: ${fieldCount}</div>
            <div style="text-align: center; margin-top: 10px;">
                <button type="button" onclick="removeUnifiedField(${questionId}, ${fieldCount})" style="background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;">Remove</button>
            </div>
        </div>
    `;
    unifiedDiv.appendChild(fieldDiv);
    console.log('🔧 [ADD CHECKBOX DEBUG] Added checkbox field to unified container. New count:', unifiedDiv.children.length);
    
    // Force the container to be visible and have dimensions
    unifiedDiv.style.minHeight = '50px';
    unifiedDiv.style.border = '1px solid #e0e0e0';
    unifiedDiv.style.borderRadius = '5px';
    unifiedDiv.style.padding = '10px';
    unifiedDiv.style.backgroundColor = '#fafafa';
    unifiedDiv.style.margin = '10px 0';
    unifiedDiv.style.width = '100%';
    unifiedDiv.style.display = 'block';
    unifiedDiv.style.position = 'relative';
    
    // Add double-click event listener as backup
    const displayDiv = fieldDiv.querySelector('div');
    if (displayDiv) {
        // Remove any existing event listeners to prevent duplicates
        if (displayDiv._dblclickHandler) {
            displayDiv.removeEventListener('dblclick', displayDiv._dblclickHandler);
        }
        
        // Add event listener for double-click editing
        displayDiv._dblclickHandler = function() {
            editUnifiedField(questionId, fieldCount);
        };
        displayDiv.addEventListener('dblclick', displayDiv._dblclickHandler);
    }
}

function addCheckboxOption(questionId, fieldCount) {
    const optionsContainer = document.getElementById(`checkboxOptions${questionId}_${fieldCount}`);
    if (!optionsContainer) return;
    
    const optionCount = optionsContainer.children.length + 1;
    
    const optionDiv = document.createElement('div');
    optionDiv.className = `checkbox-option-${optionCount}`;
    optionDiv.style.margin = '5px 0';
    optionDiv.style.padding = '8px';
    optionDiv.style.border = '1px solid #e0e0e0';
    optionDiv.style.borderRadius = '4px';
    optionDiv.style.backgroundColor = '#f5f5f5';
    optionDiv.innerHTML = `
        <div style="margin-bottom: 10px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Checkbox text:</label>
            <input type="text" id="checkboxText${questionId}_${fieldCount}_${optionCount}" placeholder="Enter checkbox text" style="width: 70%; max-width: 400px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateCheckboxOptionText(${questionId}, ${fieldCount}, ${optionCount})">
        </div>
        <div style="margin-bottom: 10px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Checkbox Node ID:</label>
            <input type="text" id="checkboxNodeId${questionId}_${fieldCount}_${optionCount}" placeholder="Enter checkbox node ID" style="width: 70%; max-width: 400px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateCheckboxOptionNodeId(${questionId}, ${fieldCount}, ${optionCount})">
        </div>
        <div style="text-align: center; margin-top: 10px;">
            <button type="button" onclick="removeCheckboxOption(${questionId}, ${fieldCount}, ${optionCount})" style="background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove Option</button>
        </div>
    `;
    
    optionsContainer.appendChild(optionDiv);
}

function removeCheckboxOption(questionId, fieldCount, optionCount) {
    const optionDiv = document.querySelector(`#checkboxOptions${questionId}_${fieldCount} .checkbox-option-${optionCount}`);
    if (optionDiv) {
        optionDiv.remove();
    }
}

function updateCheckboxFieldName(questionId, fieldCount) {
    const fieldNameInput = document.getElementById(`checkboxFieldName${questionId}_${fieldCount}`);
    if (fieldNameInput) {
        console.log('🔧 [CHECKBOX FIELD NAME] Updated field name:', fieldNameInput.value);
    }
}

function updateCheckboxSelectionType(questionId, fieldCount) {
    const selectionTypeSelect = document.getElementById(`checkboxSelectionType${questionId}_${fieldCount}`);
    if (selectionTypeSelect) {
        console.log('🔧 [CHECKBOX SELECTION TYPE] Updated selection type:', selectionTypeSelect.value);
    }
}

function updateCheckboxOptionText(questionId, fieldCount, optionCount) {
    const textInput = document.getElementById(`checkboxText${questionId}_${fieldCount}_${optionCount}`);
    if (textInput) {
        console.log('🔧 [CHECKBOX OPTION TEXT] Updated option text:', textInput.value);
    }
}

function updateCheckboxOptionNodeId(questionId, fieldCount, optionCount) {
    const nodeIdInput = document.getElementById(`checkboxNodeId${questionId}_${fieldCount}_${optionCount}`);
    if (nodeIdInput) {
        console.log('🔧 [CHECKBOX OPTION NODE ID] Updated option node ID:', nodeIdInput.value);
    }
}

function addDateField(questionId) {
    const unifiedDiv = getUnifiedContainer(questionId);
    console.log('🔧 [ADD DATE DEBUG] Looking for unified container:', `unifiedFields${questionId}`);
    console.log('🔧 [ADD DATE DEBUG] Found unified container:', !!unifiedDiv);
    
    if (!unifiedDiv) {
        console.error('🔧 [ADD DATE DEBUG] Unified container not found!');
        return;
    }
    
    // Ensure the unified container is visible
    if (unifiedDiv.style.display === 'none') {
        console.log('🔧 [ADD DATE DEBUG] Unified container was hidden, making it visible');
        unifiedDiv.style.display = 'block';
    }
    
    // Remove placeholder if it exists
    const placeholder = unifiedDiv.querySelector('div[style*="font-style: italic"]');
    if (placeholder) {
        placeholder.remove();
    }
    
    const fieldCount = unifiedDiv.children.length + 1;
    console.log('🔧 [ADD DATE DEBUG] Current field count:', fieldCount);

    const fieldDiv = document.createElement('div');
    fieldDiv.className = `unified-field field-${fieldCount}`;
    fieldDiv.setAttribute('data-type', 'date');
    fieldDiv.setAttribute('data-order', fieldCount);
    fieldDiv.innerHTML = `
        <div style="margin: 10px 0; padding: 12px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-weight: bold; color: #333;">Date: <span id="labelText${questionId}_${fieldCount}">Date ${fieldCount}</span></div>
            <div style="font-size: 0.9em; color: #666;">Node ID: <span id="nodeIdText${questionId}_${fieldCount}">date_${fieldCount}</span></div>
            <div style="font-size: 0.8em; color: #999; margin-top: 5px;">Type: <span id="typeText${questionId}_${fieldCount}">Date</span> | Order: ${fieldCount}</div>
            <button type="button" onclick="removeUnifiedField(${questionId}, ${fieldCount})" style="margin-top: 5px; background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;">Remove</button>
        </div>
    `;
    unifiedDiv.appendChild(fieldDiv);
    console.log('🔧 [ADD DATE DEBUG] Added date field to unified container. New count:', unifiedDiv.children.length);
    
    // Force the container to be visible and have dimensions
    unifiedDiv.style.minHeight = '50px';
    unifiedDiv.style.border = '1px solid #e0e0e0';
    unifiedDiv.style.borderRadius = '5px';
    unifiedDiv.style.padding = '10px';
    unifiedDiv.style.backgroundColor = '#fafafa';
    unifiedDiv.style.margin = '10px 0';
    unifiedDiv.style.width = '100%';
    unifiedDiv.style.display = 'block';
    unifiedDiv.style.position = 'relative';
    
    // Add double-click event listener as backup
    const displayDiv = fieldDiv.querySelector('div');
    if (displayDiv) {
        // Remove any existing event listeners to prevent duplicates
        if (displayDiv._dblclickHandler) {
            displayDiv.removeEventListener('dblclick', displayDiv._dblclickHandler);
        }
        
        // Add event listener for double-click editing
        displayDiv._dblclickHandler = function() {
            editUnifiedField(questionId, fieldCount);
        };
        displayDiv.addEventListener('dblclick', displayDiv._dblclickHandler);
    }
}

function addDropdownField(questionId) {
    const unifiedDiv = getUnifiedContainer(questionId);
    console.log('🔧 [ADD DROPDOWN DEBUG] Looking for unified container:', `unifiedFields${questionId}`);
    console.log('🔧 [ADD DROPDOWN DEBUG] Found unified container:', !!unifiedDiv);
    
    if (!unifiedDiv) {
        console.error('🔧 [ADD DROPDOWN DEBUG] Unified container not found!');
        return;
    }
    
    // Ensure the unified container is visible
    if (unifiedDiv.style.display === 'none') {
        console.log('🔧 [ADD DROPDOWN DEBUG] Unified container was hidden, making it visible');
        unifiedDiv.style.display = 'block';
    }
    
    // Remove placeholder if it exists
    const placeholder = unifiedDiv.querySelector('div[style*="font-style: italic"]');
    if (placeholder) {
        placeholder.remove();
    }
    
    const fieldCount = unifiedDiv.children.length + 1;
    console.log('🔧 [ADD DROPDOWN DEBUG] Current field count:', fieldCount);

    const fieldDiv = document.createElement('div');
    fieldDiv.className = `unified-field field-${fieldCount}`;
    fieldDiv.setAttribute('data-type', 'dropdown');
    fieldDiv.setAttribute('data-order', fieldCount);
    fieldDiv.innerHTML = `
        <div style="margin: 10px 0; padding: 12px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-weight: bold; color: #333; text-align: center; margin-bottom: 10px;">Dropdown Field</div>
            
            <!-- Field Name Section -->
            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; color: #333; text-align: center; margin-bottom: 10px;">Field Name:</div>
                <div style="text-align: center; margin-bottom: 10px;">
                    <input type="text" id="dropdownFieldName${questionId}_${fieldCount}" placeholder="Enter dropdown field name" style="width: 80%; max-width: 500px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;" onchange="updateDropdownFieldName(${questionId}, ${fieldCount})">
                </div>
            </div>
            
            <!-- Add Options Section -->
            <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; background: #f5f5f5;">
                <div style="font-weight: bold; color: #333; text-align: center; margin-bottom: 10px;">Add Options</div>
                <div style="text-align: center; margin-bottom: 10px;">
                    <button type="button" onclick="addDropdownOption(${questionId}, ${fieldCount})" style="margin: 5px; padding: 6px 12px; border: none; border-radius: 6px; background-color: #2196F3; color: white; cursor: pointer; font-size: 12px; display: inline-block;">Add dropdown option</button>
                </div>
                <div id="dropdownOptions${questionId}_${fieldCount}" style="margin-top: 10px;">
                    <!-- Dropdown options will be added here -->
                </div>
            </div>
            
            <!-- Conditional Logic Section -->
            <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; background: #f0f8ff;">
                <div style="font-weight: bold; color: #333; text-align: center; margin-bottom: 10px;">Conditional Logic</div>
                <div style="text-align: center; margin-bottom: 10px;">
                    <button type="button" onclick="addTriggerSequence(${questionId}, ${fieldCount})" style="margin: 5px; padding: 6px 12px; border: none; border-radius: 6px; background-color: #4CAF50; color: white; cursor: pointer; font-size: 12px; display: inline-block;">Add trigger</button>
                </div>
                <div id="triggerSequences${questionId}_${fieldCount}" style="margin-top: 10px;">
                    <!-- Trigger sequences will be added here -->
                </div>
            </div>
            
            <div style="font-size: 0.8em; color: #999; margin-top: 10px; text-align: center;">Type: <span id="typeText${questionId}_${fieldCount}">Dropdown</span> | Order: ${fieldCount}</div>
            <div style="text-align: center; margin-top: 10px;">
                <button type="button" onclick="removeUnifiedField(${questionId}, ${fieldCount})" style="background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;">Remove</button>
            </div>
        </div>
    `;
    unifiedDiv.appendChild(fieldDiv);
    console.log('🔧 [ADD DROPDOWN DEBUG] Added dropdown field to unified container. New count:', unifiedDiv.children.length);

    // Force the container to be visible and have dimensions
    unifiedDiv.style.minHeight = '50px';
    unifiedDiv.style.border = '1px solid #e0e0e0';
    unifiedDiv.style.borderRadius = '5px';
    unifiedDiv.style.padding = '10px';
    unifiedDiv.style.backgroundColor = '#fafafa';
    unifiedDiv.style.margin = '10px 0';
    unifiedDiv.style.width = '100%';
    unifiedDiv.style.display = 'block';
    unifiedDiv.style.position = 'relative';
    
    // Add double-click event listener as backup
    const displayDiv = fieldDiv.querySelector('div');
    if (displayDiv) {
        // Remove any existing event listeners to prevent duplicates
        if (displayDiv._dblclickHandler) {
            displayDiv.removeEventListener('dblclick', displayDiv._dblclickHandler);
        }
        
        // Add event listener for double-click editing
        displayDiv._dblclickHandler = function() {
            editUnifiedField(questionId, fieldCount);
        };
        displayDiv.addEventListener('dblclick', displayDiv._dblclickHandler);
    }
}

function addDropdownOption(questionId, fieldCount) {
    const optionsContainer = document.getElementById(`dropdownOptions${questionId}_${fieldCount}`);
    if (!optionsContainer) {
        console.error('🔧 [ADD DROPDOWN OPTION DEBUG] Options container not found!');
        return;
    }
    
    const optionCount = optionsContainer.children.length + 1;
    console.log('🔧 [ADD DROPDOWN OPTION DEBUG] Adding option', optionCount, 'for field', fieldCount);
    
    const optionDiv = document.createElement('div');
    optionDiv.className = `dropdown-option-${optionCount}`;
    optionDiv.style.margin = '5px 0';
    optionDiv.style.padding = '8px';
    optionDiv.style.border = '1px solid #e0e0e0';
    optionDiv.style.borderRadius = '4px';
    optionDiv.style.backgroundColor = '#f5f5f5';
    optionDiv.innerHTML = `
        <div style="margin-bottom: 10px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Option text:</label>
            <input type="text" id="dropdownOptionText${questionId}_${fieldCount}_${optionCount}" placeholder="Enter option text" style="width: 70%; max-width: 400px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateDropdownOptionText(${questionId}, ${fieldCount}, ${optionCount})">
        </div>
        <div style="margin-bottom: 10px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Option Node ID:</label>
            <input type="text" id="dropdownOptionNodeId${questionId}_${fieldCount}_${optionCount}" placeholder="Enter option node ID" style="width: 70%; max-width: 400px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateDropdownOptionNodeId(${questionId}, ${fieldCount}, ${optionCount})">
        </div>
        <div style="text-align: center; margin-top: 10px;">
            <button type="button" onclick="removeDropdownOption(${questionId}, ${fieldCount}, ${optionCount})" style="background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove Option</button>
        </div>
    `;
    optionsContainer.appendChild(optionDiv);
    console.log('🔧 [ADD DROPDOWN OPTION DEBUG] Added option to container. New count:', optionsContainer.children.length);
    
    // Update trigger condition options for all trigger sequences
    const triggerSequencesContainer = document.getElementById(`triggerSequences${questionId}_${fieldCount}`);
    if (triggerSequencesContainer) {
        const sequenceElements = triggerSequencesContainer.querySelectorAll('[class^="trigger-sequence-"]');
        sequenceElements.forEach((sequenceEl, sequenceIndex) => {
            updateTriggerConditionOptions(questionId, fieldCount, sequenceIndex + 1);
        });
    }
}

function updateDropdownFieldName(questionId, fieldCount) {
    const fieldNameInput = document.getElementById(`dropdownFieldName${questionId}_${fieldCount}`);
    if (fieldNameInput) {
        console.log('🔧 [DROPDOWN FIELD NAME] Updated field name:', fieldNameInput.value);
    }
}

function updateDropdownOptionText(questionId, fieldCount, optionCount) {
    const textInput = document.getElementById(`dropdownOptionText${questionId}_${fieldCount}_${optionCount}`);
    if (textInput) {
        console.log('🔧 [DROPDOWN OPTION TEXT] Updated option text:', textInput.value);
        
        // Update trigger condition options for all trigger sequences
        const triggerSequencesContainer = document.getElementById(`triggerSequences${questionId}_${fieldCount}`);
        if (triggerSequencesContainer) {
            const sequenceElements = triggerSequencesContainer.querySelectorAll('[class^="trigger-sequence-"]');
            sequenceElements.forEach((sequenceEl, sequenceIndex) => {
                updateTriggerConditionOptions(questionId, fieldCount, sequenceIndex + 1);
            });
        }
    }
}

function updateDropdownOptionNodeId(questionId, fieldCount, optionCount) {
    const nodeIdInput = document.getElementById(`dropdownOptionNodeId${questionId}_${fieldCount}_${optionCount}`);
    if (nodeIdInput) {
        console.log('🔧 [DROPDOWN OPTION NODE ID] Updated option node ID:', nodeIdInput.value);
    }
}

function removeDropdownOption(questionId, fieldCount, optionCount) {
    const optionDiv = document.querySelector(`.dropdown-option-${optionCount}`);
    if (optionDiv) {
        optionDiv.remove();
        console.log('🔧 [REMOVE DROPDOWN OPTION] Removed option', optionCount, 'from field', fieldCount);
    }
}

function addTriggerSequence(questionId, fieldCount) {
    const triggerSequencesContainer = document.getElementById(`triggerSequences${questionId}_${fieldCount}`);
    if (!triggerSequencesContainer) {
        console.error('🔧 [ADD TRIGGER SEQUENCE DEBUG] Trigger sequences container not found!');
        return;
    }
    
    const sequenceCount = triggerSequencesContainer.children.length + 1;
    console.log('🔧 [ADD TRIGGER SEQUENCE DEBUG] Adding trigger sequence', sequenceCount, 'for field', fieldCount);
    
    const sequenceDiv = document.createElement('div');
    sequenceDiv.className = `trigger-sequence-${sequenceCount}`;
    sequenceDiv.style.margin = '10px 0';
    sequenceDiv.style.padding = '12px';
    sequenceDiv.style.border = '1px solid #4CAF50';
    sequenceDiv.style.borderRadius = '8px';
    sequenceDiv.style.backgroundColor = '#f0f8f0';
    sequenceDiv.innerHTML = `
        <div style="font-weight: bold; color: #2E7D32; margin-bottom: 10px; text-align: center;">Trigger Sequence ${sequenceCount}</div>
        
        <!-- Trigger Title Input -->
        <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; color: #333; text-align: center; margin-bottom: 5px;">Trigger Title:</div>
            <div style="text-align: center;">
                <input type="text" id="triggerTitle${questionId}_${fieldCount}_${sequenceCount}" placeholder="Additional Information" value="Additional Information" style="width: 80%; max-width: 400px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; margin: 0 auto; display: block;" onchange="updateTriggerTitle(${questionId}, ${fieldCount}, ${sequenceCount})">
            </div>
        </div>
        
        <!-- Trigger Condition Dropdown -->
        <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; color: #333; text-align: center; margin-bottom: 5px;">Trigger Condition:</div>
            <div style="text-align: center;">
                <select id="triggerCondition${questionId}_${fieldCount}_${sequenceCount}" style="width: 80%; max-width: 400px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; margin: 0 auto; display: block;" onchange="updateTriggerCondition(${questionId}, ${fieldCount}, ${sequenceCount})">
                    <option value="">Select an option...</option>
                </select>
            </div>
        </div>
        
        <!-- Add Field Buttons -->
        <div style="margin-bottom: 15px; text-align: center;">
            <div style="font-weight: bold; color: #333; margin-bottom: 10px;">Add Fields for this trigger:</div>
            <button type="button" onclick="addTriggerLabel(${questionId}, ${fieldCount}, ${sequenceCount})" style="margin: 3px; padding: 6px 12px; border: none; border-radius: 6px; background-color: #007bff; color: white; cursor: pointer; font-size: 12px; display: inline-block;">Add Label</button>
            <button type="button" onclick="addTriggerCheckbox(${questionId}, ${fieldCount}, ${sequenceCount})" style="margin: 3px; padding: 6px 12px; border: none; border-radius: 6px; background-color: #9C27B0; color: white; cursor: pointer; font-size: 12px; display: inline-block;">Add Checkbox</button>
            <button type="button" onclick="addTriggerDropdown(${questionId}, ${fieldCount}, ${sequenceCount})" style="margin: 3px; padding: 6px 12px; border: none; border-radius: 6px; background-color: #17a2b8; color: white; cursor: pointer; font-size: 12px; display: inline-block;">Add Dropdown</button>
            <button type="button" onclick="addTriggerDate(${questionId}, ${fieldCount}, ${sequenceCount})" style="margin: 3px; padding: 6px 12px; border: none; border-radius: 6px; background-color: #FF9800; color: white; cursor: pointer; font-size: 12px; display: inline-block;">Add Date</button>
            <button type="button" onclick="addTriggerLocation(${questionId}, ${fieldCount}, ${sequenceCount})" style="margin: 3px; padding: 6px 12px; border: none; border-radius: 6px; background-color: #28a745; color: white; cursor: pointer; font-size: 12px; display: inline-block;">Add Location</button>
            <button type="button" onclick="addTriggerPdf(${questionId}, ${fieldCount}, ${sequenceCount})" style="margin: 3px; padding: 6px 12px; border: none; border-radius: 6px; background-color: #DC3545; color: white; cursor: pointer; font-size: 12px; display: inline-block;">Add PDF</button>
        </div>
        
        <!-- Trigger Fields Container -->
        <div id="triggerFields${questionId}_${fieldCount}_${sequenceCount}" style="margin-top: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: #fafafa;">
            <!-- Trigger fields will be added here -->
        </div>
        
        <!-- Remove Trigger Button -->
        <div style="text-align: center; margin-top: 10px;">
            <button type="button" onclick="removeTriggerSequence(${questionId}, ${fieldCount}, ${sequenceCount})" style="background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove Trigger</button>
        </div>
    `;
    
    triggerSequencesContainer.appendChild(sequenceDiv);
    console.log('🔧 [ADD TRIGGER SEQUENCE DEBUG] Added trigger sequence to container. New count:', triggerSequencesContainer.children.length);
    
    // Populate the trigger condition dropdown with available options
    updateTriggerConditionOptions(questionId, fieldCount, sequenceCount);
}

function updateTriggerConditionOptions(questionId, fieldCount, sequenceCount) {
    const triggerSelect = document.getElementById(`triggerCondition${questionId}_${fieldCount}_${sequenceCount}`);
    if (!triggerSelect) return;
    
    // Get all dropdown options for this field
    const optionsContainer = document.getElementById(`dropdownOptions${questionId}_${fieldCount}`);
    if (!optionsContainer) return;
    
    // Clear existing options (except the first placeholder)
    triggerSelect.innerHTML = '<option value="">Select an option...</option>';
    
    // Add options from the dropdown field
    const optionElements = optionsContainer.querySelectorAll('[class^="dropdown-option-"]');
    optionElements.forEach((optionEl, index) => {
        const textInput = optionEl.querySelector(`#dropdownOptionText${questionId}_${fieldCount}_${index + 1}`);
        if (textInput && textInput.value.trim()) {
            const option = document.createElement('option');
            option.value = textInput.value.trim();
            option.textContent = textInput.value.trim();
            triggerSelect.appendChild(option);
        }
    });
}

function updateTriggerCondition(questionId, fieldCount, sequenceCount) {
    const triggerSelect = document.getElementById(`triggerCondition${questionId}_${fieldCount}_${sequenceCount}`);
    if (triggerSelect) {
        console.log('🔧 [TRIGGER CONDITION] Updated trigger condition:', triggerSelect.value);
    }
}

function updateTriggerTitle(questionId, fieldCount, sequenceCount) {
    const triggerTitleInput = document.getElementById(`triggerTitle${questionId}_${fieldCount}_${sequenceCount}`);
    if (triggerTitleInput) {
        console.log('🔧 [TRIGGER TITLE] Updated trigger title:', triggerTitleInput.value);
    }
}

function removeTriggerSequence(questionId, fieldCount, sequenceCount) {
    const sequenceDiv = document.querySelector(`.trigger-sequence-${sequenceCount}`);
    if (sequenceDiv) {
        sequenceDiv.remove();
        console.log('🔧 [REMOVE TRIGGER SEQUENCE] Removed trigger sequence', sequenceCount, 'from field', fieldCount);
    }
}

function addTriggerLabel(questionId, fieldCount, sequenceCount) {
    const triggerFieldsContainer = document.getElementById(`triggerFields${questionId}_${fieldCount}_${sequenceCount}`);
    if (!triggerFieldsContainer) {
        console.error('🔧 [ADD TRIGGER LABEL DEBUG] Trigger fields container not found!');
        return;
    }
    
    const triggerFieldCount = triggerFieldsContainer.children.length + 1;
    console.log('🔧 [ADD TRIGGER LABEL DEBUG] Adding trigger label', triggerFieldCount, 'for sequence', sequenceCount);
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = `trigger-field-${triggerFieldCount}`;
    fieldDiv.style.margin = '5px 0';
    fieldDiv.style.padding = '8px';
    fieldDiv.style.border = '1px solid #007bff';
    fieldDiv.style.borderRadius = '4px';
    fieldDiv.style.backgroundColor = '#f0f8ff';
    // Conditional logic UI elements
    const conditionalLogicContainerId = `conditionalLogicUILabel${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    const enableConditionalLogicCheckboxId = `enableConditionalLogicLabel${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    
    fieldDiv.innerHTML = `
        <div style="font-weight: bold; color: #007bff; margin-bottom: 8px; text-align: center;">Trigger Label ${triggerFieldCount}</div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Label:</label>
            <input type="text" id="triggerLabelText${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter label text" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerLabelText(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Node ID:</label>
            <input type="text" id="triggerLabelNodeId${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter node ID" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerLabelNodeId(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label for="${enableConditionalLogicCheckboxId}" style="display: block; font-weight: bold; color: #333; font-size: 12px; margin-bottom: 8px; cursor: pointer;">Enable Conditional Logic</label>
            <div style="display: flex; justify-content: center;">
                <input type="checkbox" id="${enableConditionalLogicCheckboxId}" onchange="toggleTriggerLabelConditionalLogic(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="cursor: pointer;">
            </div>
            <div id="${conditionalLogicContainerId}" style="margin-top: 8px; display: none;">
                <!-- Conditional logic UI will be populated here -->
            </div>
        </div>
        <div style="text-align: center; margin-top: 8px;">
            <button type="button" onclick="removeTriggerField(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Remove</button>
        </div>
    `;
    triggerFieldsContainer.appendChild(fieldDiv);
}

function addTriggerCheckbox(questionId, fieldCount, sequenceCount) {
    const triggerFieldsContainer = document.getElementById(`triggerFields${questionId}_${fieldCount}_${sequenceCount}`);
    if (!triggerFieldsContainer) {
        console.error('🔧 [ADD TRIGGER CHECKBOX DEBUG] Trigger fields container not found!');
        return;
    }
    
    const triggerFieldCount = triggerFieldsContainer.children.length + 1;
    console.log('🔧 [ADD TRIGGER CHECKBOX DEBUG] Adding trigger checkbox', triggerFieldCount, 'for sequence', sequenceCount);
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = `trigger-field-${triggerFieldCount}`;
    fieldDiv.style.margin = '5px 0';
    fieldDiv.style.padding = '8px';
    fieldDiv.style.border = '1px solid #9C27B0';
    fieldDiv.style.borderRadius = '4px';
    fieldDiv.style.backgroundColor = '#faf0ff';
        // Conditional logic UI elements
        const conditionalLogicContainerId = `conditionalLogicUICheckbox${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
        const enableConditionalLogicCheckboxId = `enableConditionalLogicCheckbox${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
        
        fieldDiv.innerHTML = `
            <div style="font-weight: bold; color: #9C27B0; margin-bottom: 8px; text-align: center;">Trigger Checkbox ${triggerFieldCount}</div>
            <div style="margin-bottom: 8px; text-align: center;">
                <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Field Name:</label>
                <input type="text" id="triggerCheckboxFieldName${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter field name" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerCheckboxFieldName(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
            </div>
            <div style="margin-bottom: 8px; text-align: center;">
                <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Selection Type:</label>
                <select id="triggerCheckboxSelectionType${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; margin: 0 auto; display: block;" onchange="updateTriggerCheckboxSelectionType(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
                    <option value="multiple">Mark all that apply</option>
                    <option value="single">Mark only one</option>
                </select>
            </div>
            <div style="text-align: center; margin-bottom: 8px;">
                <button type="button" onclick="addTriggerCheckboxOption(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="margin: 3px; padding: 4px 8px; border: none; border-radius: 4px; background-color: #9C27B0; color: white; cursor: pointer; font-size: 11px; display: inline-block;">Add option</button>
            </div>
            <div id="triggerCheckboxOptions${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" style="margin-top: 8px;">
                <!-- Trigger checkbox options will be added here -->
            </div>
            <div style="margin-bottom: 8px; text-align: center;">
                <label for="${enableConditionalLogicCheckboxId}" style="display: block; font-weight: bold; color: #333; font-size: 12px; margin-bottom: 8px; cursor: pointer;">Enable Conditional Logic</label>
                <div style="display: flex; justify-content: center;">
                    <input type="checkbox" id="${enableConditionalLogicCheckboxId}" onchange="toggleTriggerCheckboxConditionalLogic(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="cursor: pointer;">
                </div>
                <div id="${conditionalLogicContainerId}" style="margin-top: 8px; display: none;">
                    <!-- Conditional logic UI will be populated here -->
                </div>
            </div>
            <div style="text-align: center; margin-top: 8px;">
                <button type="button" onclick="removeTriggerField(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Remove</button>
            </div>
        `;
    triggerFieldsContainer.appendChild(fieldDiv);
}

function addTriggerDropdown(questionId, fieldCount, sequenceCount) {
    const triggerFieldsContainer = document.getElementById(`triggerFields${questionId}_${fieldCount}_${sequenceCount}`);
    if (!triggerFieldsContainer) {
        console.error('🔧 [ADD TRIGGER DROPDOWN DEBUG] Trigger fields container not found!');
        return;
    }
    
    const triggerFieldCount = triggerFieldsContainer.children.length + 1;
    console.log('🔧 [ADD TRIGGER DROPDOWN DEBUG] Adding trigger dropdown', triggerFieldCount, 'for sequence', sequenceCount);
    
    // Create a unique ID for the conditional logic container
    const conditionalLogicContainerId = `conditionalLogicUIDropdown${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    const enableConditionalLogicCheckboxId = `enableConditionalLogicDropdown${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = `trigger-field-${triggerFieldCount}`;
    fieldDiv.style.margin = '5px 0';
    fieldDiv.style.padding = '8px';
    fieldDiv.style.border = '1px solid #17a2b8';
    fieldDiv.style.borderRadius = '4px';
    fieldDiv.style.backgroundColor = '#f0f8ff';
    fieldDiv.innerHTML = `
        <div style="font-weight: bold; color: #17a2b8; margin-bottom: 8px; text-align: center;">Trigger Dropdown ${triggerFieldCount}</div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Question Title:</label>
            <input type="text" id="triggerDropdownFieldName${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter question title" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerDropdownFieldName(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="text-align: center; margin-bottom: 8px;">
            <button type="button" onclick="addTriggerDropdownOption(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="margin: 3px; padding: 4px 8px; border: none; border-radius: 4px; background-color: #17a2b8; color: white; cursor: pointer; font-size: 11px; display: inline-block;">Add option</button>
        </div>
        <div id="triggerDropdownOptions${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" style="margin-top: 8px;">
            <!-- Trigger dropdown options will be added here -->
        </div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label for="${enableConditionalLogicCheckboxId}" style="display: block; font-weight: bold; color: #333; font-size: 12px; margin-bottom: 8px; cursor: pointer;">Enable Conditional Logic</label>
            <div style="display: flex; justify-content: center;">
                <input type="checkbox" id="${enableConditionalLogicCheckboxId}" onchange="toggleTriggerDropdownConditionalLogic(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="cursor: pointer;">
            </div>
            <div id="${conditionalLogicContainerId}" style="margin-top: 8px; display: none;">
                <!-- Conditional logic UI will be populated here -->
            </div>
        </div>
        <div style="text-align: center; margin-top: 8px;">
            <button type="button" onclick="removeTriggerField(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Remove</button>
        </div>
    `;
    triggerFieldsContainer.appendChild(fieldDiv);
    
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Dropdown field created, checkbox ID:', enableConditionalLogicCheckboxId, 'container ID:', conditionalLogicContainerId);
}

function addTriggerDate(questionId, fieldCount, sequenceCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] addTriggerDate called for questionId:', questionId, 'fieldCount:', fieldCount, 'sequenceCount:', sequenceCount);
    
    const triggerFieldsContainer = document.getElementById(`triggerFields${questionId}_${fieldCount}_${sequenceCount}`);
    if (!triggerFieldsContainer) {
        console.error('🔧 [ADD TRIGGER DATE DEBUG] Trigger fields container not found!');
        return;
    }
    
    const triggerFieldCount = triggerFieldsContainer.children.length + 1;
    console.log('🔧 [ADD TRIGGER DATE DEBUG] Adding trigger date', triggerFieldCount, 'for sequence', sequenceCount);
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = `trigger-field-${triggerFieldCount}`;
    fieldDiv.style.margin = '5px 0';
    fieldDiv.style.padding = '8px';
    fieldDiv.style.border = '1px solid #FF9800';
    fieldDiv.style.borderRadius = '4px';
    fieldDiv.style.backgroundColor = '#fff8f0';
    
    // Create a unique ID for the conditional logic container
    const conditionalLogicContainerId = `conditionalLogicUI${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    const enableConditionalLogicCheckboxId = `enableConditionalLogic${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    
    fieldDiv.innerHTML = `
        <div style="font-weight: bold; color: #FF9800; margin-bottom: 8px; text-align: center;">Trigger Date ${triggerFieldCount}</div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Label:</label>
            <input type="text" id="triggerDateLabel${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter date label" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerDateLabel(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Node ID:</label>
            <input type="text" id="triggerDateNodeId${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter node ID" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerDateNodeId(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label for="${enableConditionalLogicCheckboxId}" style="display: block; font-weight: bold; color: #333; font-size: 12px; margin-bottom: 8px; cursor: pointer;">Enable Conditional Logic</label>
            <div style="display: flex; justify-content: center;">
                <input type="checkbox" id="${enableConditionalLogicCheckboxId}" onchange="toggleTriggerDateConditionalLogic(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="cursor: pointer;">
            </div>
            <div id="${conditionalLogicContainerId}" style="margin-top: 8px; display: none;">
                <!-- Conditional logic UI will be populated here -->
            </div>
        </div>
        <div style="text-align: center; margin-top: 8px;">
            <button type="button" onclick="removeTriggerField(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Remove</button>
        </div>
    `;
    triggerFieldsContainer.appendChild(fieldDiv);
    
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Date field created, checkbox ID:', enableConditionalLogicCheckboxId, 'container ID:', conditionalLogicContainerId);
}

function addTriggerLocation(questionId, fieldCount, sequenceCount) {
    const triggerFieldsContainer = document.getElementById(`triggerFields${questionId}_${fieldCount}_${sequenceCount}`);
    if (!triggerFieldsContainer) {
        console.error('🔧 [ADD TRIGGER LOCATION DEBUG] Trigger fields container not found!');
        return;
    }
    
    const triggerFieldCount = triggerFieldsContainer.children.length + 1;
    console.log('🔧 [ADD TRIGGER LOCATION DEBUG] Adding trigger location field', triggerFieldCount, 'for sequence', sequenceCount);
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = `trigger-field-${triggerFieldCount}`;
    fieldDiv.style.margin = '5px 0';
    fieldDiv.style.padding = '12px';
    fieldDiv.style.border = '1px solid #28a745';
    fieldDiv.style.borderRadius = '6px';
    fieldDiv.style.backgroundColor = '#f0fff0';
    fieldDiv.innerHTML = `
        <div style="font-weight: bold; color: #28a745; margin-bottom: 8px; text-align: center; font-size: 14px;">Location Data Added</div>
        <div style="margin: 10px 0; text-align: center;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #28a745; font-size: 12px;">Location Title Field:</label>
            <input type="text" id="triggerLocationTitle${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter location title (e.g., Address, Location, etc.)" style="width: 200px; padding: 6px; border: 1px solid #28a745; border-radius: 4px; font-size: 12px; text-align: center;" onchange="updateTriggerLocationTitle(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="text-align: center; margin-top: 8px;">
            <button type="button" onclick="removeTriggerField(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
        </div>
    `;
    triggerFieldsContainer.appendChild(fieldDiv);
}

function addTriggerPdf(questionId, fieldCount, sequenceCount) {
    const triggerFieldsContainer = document.getElementById(`triggerFields${questionId}_${fieldCount}_${sequenceCount}`);
    if (!triggerFieldsContainer) {
        console.error('🔧 [ADD TRIGGER PDF DEBUG] Trigger fields container not found!');
        return;
    }
    
    const triggerFieldCount = triggerFieldsContainer.children.length + 1;
    console.log('🔧 [ADD TRIGGER PDF DEBUG] Adding trigger PDF', triggerFieldCount, 'for sequence', sequenceCount);
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = `trigger-field-${triggerFieldCount}`;
    fieldDiv.style.margin = '5px 0';
    fieldDiv.style.padding = '8px';
    fieldDiv.style.border = '1px solid #DC3545';
    fieldDiv.style.borderRadius = '4px';
    fieldDiv.style.backgroundColor = '#fff0f0';
    fieldDiv.innerHTML = `
        <div style="font-weight: bold; color: #DC3545; margin-bottom: 8px; text-align: center;">Trigger PDF ${triggerFieldCount}</div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Number:</label>
            <input type="number" id="triggerPdfNumber${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter number" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerPdfNumber(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">PDF Title:</label>
            <input type="text" id="triggerPdfTitle${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter PDF title" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerPdfTitle(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">PDF File Name:</label>
            <input type="text" id="triggerPdfName${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter PDF file name" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerPdfName(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="margin-bottom: 8px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 5px;">Price ID:</label>
            <input type="text" id="triggerPdfPriceId${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}" placeholder="Enter price ID" style="width: 70%; max-width: 300px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px;" onchange="updateTriggerPdfPriceId(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})">
        </div>
        <div style="text-align: center; margin-top: 8px;">
            <button type="button" onclick="removeTriggerField(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount})" style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Remove</button>
        </div>
    `;
    triggerFieldsContainer.appendChild(fieldDiv);
}

// Placeholder update functions for PDF fields (for future use)
function updateTriggerPdfNumber(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    // Placeholder - can be implemented later if needed
}

function updateTriggerPdfTitle(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    // Placeholder - can be implemented later if needed
}

function updateTriggerPdfName(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    // Placeholder - can be implemented later if needed
}

function updateTriggerPdfPriceId(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    // Placeholder - can be implemented later if needed
}

function updateTriggerLocationTitle(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const titleInput = document.getElementById(`triggerLocationTitle${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (titleInput) {
        console.log('🔧 [UPDATE TRIGGER LOCATION TITLE DEBUG] Location title updated:', titleInput.value);
    }
}

function addTriggerCheckboxOption(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const optionsContainer = document.getElementById(`triggerCheckboxOptions${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (!optionsContainer) {
        console.error('🔧 [ADD TRIGGER CHECKBOX OPTION DEBUG] Options container not found!');
        return;
    }
    
    const optionCount = optionsContainer.children.length + 1;
    console.log('🔧 [ADD TRIGGER CHECKBOX OPTION DEBUG] Adding option', optionCount, 'for trigger field', triggerFieldCount);
    
    const optionDiv = document.createElement('div');
    optionDiv.className = `trigger-checkbox-option-${optionCount}`;
    optionDiv.style.margin = '3px 0';
    optionDiv.style.padding = '6px';
    optionDiv.style.border = '1px solid #e0e0e0';
    optionDiv.style.borderRadius = '3px';
    optionDiv.style.backgroundColor = '#f5f5f5';
    optionDiv.innerHTML = `
        <div style="margin-bottom: 6px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 3px; font-size: 12px;">Option text:</label>
            <input type="text" id="triggerCheckboxOptionText${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}_${optionCount}" placeholder="Enter option text" style="width: 60%; max-width: 200px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;" onchange="updateTriggerCheckboxOptionText(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount}, ${optionCount})">
        </div>
        <div style="margin-bottom: 6px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 3px; font-size: 12px;">Node ID:</label>
            <input type="text" id="triggerCheckboxOptionNodeId${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}_${optionCount}" placeholder="Enter node ID" style="width: 60%; max-width: 200px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;" onchange="updateTriggerCheckboxOptionNodeId(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount}, ${optionCount})">
        </div>
        <div style="text-align: center; margin-top: 6px;">
            <button type="button" onclick="removeTriggerCheckboxOption(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount}, ${optionCount})" style="background: #ff4444; color: white; border: none; padding: 3px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">Remove</button>
        </div>
    `;
    optionsContainer.appendChild(optionDiv);
}

function removeTriggerField(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const fieldDiv = document.querySelector(`.trigger-field-${triggerFieldCount}`);
    if (fieldDiv) {
        fieldDiv.remove();
        console.log('🔧 [REMOVE TRIGGER FIELD] Removed trigger field', triggerFieldCount, 'from sequence', sequenceCount);
    }
}

function removeTriggerCheckboxOption(questionId, fieldCount, sequenceCount, triggerFieldCount, optionCount) {
    const optionDiv = document.querySelector(`.trigger-checkbox-option-${optionCount}`);
    if (optionDiv) {
        optionDiv.remove();
        console.log('🔧 [REMOVE TRIGGER CHECKBOX OPTION] Removed option', optionCount, 'from trigger field', triggerFieldCount);
    }
}

function addTriggerDropdownOption(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const optionsContainer = document.getElementById(`triggerDropdownOptions${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (!optionsContainer) {
        console.error('🔧 [ADD TRIGGER DROPDOWN OPTION DEBUG] Options container not found!');
        return;
    }
    
    const optionCount = optionsContainer.children.length + 1;
    console.log('🔧 [ADD TRIGGER DROPDOWN OPTION DEBUG] Adding option', optionCount, 'for trigger field', triggerFieldCount);
    
    const optionDiv = document.createElement('div');
    optionDiv.className = `trigger-dropdown-option-${optionCount}`;
    optionDiv.style.margin = '3px 0';
    optionDiv.style.padding = '6px';
    optionDiv.style.border = '1px solid #e0e0e0';
    optionDiv.style.borderRadius = '3px';
    optionDiv.style.backgroundColor = '#f5f5f5';
    optionDiv.innerHTML = `
        <div style="margin-bottom: 6px; text-align: center;">
            <label style="font-weight: bold; color: #333; display: block; margin-bottom: 3px; font-size: 12px;">Option text:</label>
            <input type="text" id="triggerDropdownOptionText${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}_${optionCount}" placeholder="Enter option text" style="width: 60%; max-width: 200px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;" onchange="updateTriggerDropdownOptionText(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount}, ${optionCount})">
        </div>
        <div style="text-align: center; margin-top: 6px;">
            <button type="button" onclick="removeTriggerDropdownOption(${questionId}, ${fieldCount}, ${sequenceCount}, ${triggerFieldCount}, ${optionCount})" style="background: #ff4444; color: white; border: none; padding: 3px 6px; border-radius: 3px; cursor: pointer; font-size: 10px;">Remove</button>
        </div>
    `;
    optionsContainer.appendChild(optionDiv);
}

function removeTriggerDropdownOption(questionId, fieldCount, sequenceCount, triggerFieldCount, optionCount) {
    const optionDiv = document.querySelector(`.trigger-dropdown-option-${optionCount}`);
    if (optionDiv) {
        optionDiv.remove();
        console.log('🔧 [REMOVE TRIGGER DROPDOWN OPTION] Removed option', optionCount, 'from trigger field', triggerFieldCount);
    }
}

function updateTriggerDropdownFieldName(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const fieldNameInput = document.getElementById(`triggerDropdownFieldName${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (fieldNameInput) {
        console.log('🔧 [TRIGGER DROPDOWN FIELD NAME] Updated:', fieldNameInput.value);
    }
}

function updateTriggerDropdownOptionText(questionId, fieldCount, sequenceCount, triggerFieldCount, optionCount) {
    const textInput = document.getElementById(`triggerDropdownOptionText${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}_${optionCount}`);
    if (textInput) {
        console.log('🔧 [TRIGGER DROPDOWN OPTION TEXT] Updated:', textInput.value);
    }
}

// Update functions for trigger fields
function updateTriggerLabelText(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const textInput = document.getElementById(`triggerLabelText${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (textInput) {
        console.log('🔧 [TRIGGER LABEL TEXT] Updated:', textInput.value);
    }
}

function updateTriggerLabelNodeId(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const nodeIdInput = document.getElementById(`triggerLabelNodeId${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (nodeIdInput) {
        console.log('🔧 [TRIGGER LABEL NODE ID] Updated:', nodeIdInput.value);
    }
}

function updateTriggerCheckboxFieldName(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const fieldNameInput = document.getElementById(`triggerCheckboxFieldName${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (fieldNameInput) {
        console.log('🔧 [TRIGGER CHECKBOX FIELD NAME] Updated:', fieldNameInput.value);
    }
}

function updateTriggerCheckboxSelectionType(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const selectionTypeSelect = document.getElementById(`triggerCheckboxSelectionType${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (selectionTypeSelect) {
        console.log('🔧 [TRIGGER CHECKBOX SELECTION TYPE] Updated:', selectionTypeSelect.value);
    }
}

function updateTriggerCheckboxOptionText(questionId, fieldCount, sequenceCount, triggerFieldCount, optionCount) {
    const textInput = document.getElementById(`triggerCheckboxOptionText${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}_${optionCount}`);
    if (textInput) {
        console.log('🔧 [TRIGGER CHECKBOX OPTION TEXT] Updated:', textInput.value);
    }
}

function updateTriggerCheckboxOptionNodeId(questionId, fieldCount, sequenceCount, triggerFieldCount, optionCount) {
    const nodeIdInput = document.getElementById(`triggerCheckboxOptionNodeId${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}_${optionCount}`);
    if (nodeIdInput) {
        console.log('🔧 [TRIGGER CHECKBOX OPTION NODE ID] Updated:', nodeIdInput.value);
    }
}

function updateTriggerDateLabel(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const labelInput = document.getElementById(`triggerDateLabel${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (labelInput) {
        console.log('🔧 [TRIGGER DATE LABEL] Updated:', labelInput.value);
    }
}

function updateTriggerDateNodeId(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    const nodeIdInput = document.getElementById(`triggerDateNodeId${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (nodeIdInput) {
        console.log('🔧 [TRIGGER DATE NODE ID] Updated:', nodeIdInput.value);
    }
}

// Helper function to get checkbox option node IDs from a trigger sequence
function getCheckboxOptionNodeIdsFromTriggerSequence(questionId, fieldCount, sequenceCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Getting checkbox option node IDs for questionId:', questionId, 'fieldCount:', fieldCount, 'sequenceCount:', sequenceCount);
    
    const checkboxNodeIds = [];
    const triggerFieldsContainer = document.getElementById(`triggerFields${questionId}_${fieldCount}_${sequenceCount}`);
    
    if (!triggerFieldsContainer) {
        console.log('🔍 [CONDITIONAL LOGIC DEBUG] Trigger fields container not found');
        return checkboxNodeIds;
    }
    
    // Find all checkbox option node ID inputs in this trigger sequence
    // The IDs follow the pattern: triggerCheckboxOptionNodeId${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}_${optionCount}
    const nodeIdInputs = triggerFieldsContainer.querySelectorAll('input[id^="triggerCheckboxOptionNodeId"]');
    nodeIdInputs.forEach(input => {
        const nodeId = input.value.trim();
        if (nodeId && !checkboxNodeIds.includes(nodeId)) {
            checkboxNodeIds.push(nodeId);
            console.log('🔍 [CONDITIONAL LOGIC DEBUG] Found checkbox option node ID:', nodeId);
        }
    });
    
    // Also find dropdown fields in this trigger sequence and generate their hidden checkbox IDs
    // Get the numbered dropdown's nodeId
    const questionBlock = document.getElementById(`questionBlock${questionId}`);
    if (questionBlock) {
        const nodeIdInput = questionBlock.querySelector(`#nodeId${questionId}`);
        const questionNodeId = nodeIdInput ? nodeIdInput.value.trim() : `answer${questionId}`;
        
        // Find all dropdown fields in this trigger sequence
        const triggerFieldElements = triggerFieldsContainer.querySelectorAll('[class^="trigger-field-"]');
        triggerFieldElements.forEach((triggerFieldEl, triggerFieldIndex) => {
            // Check if this is a dropdown field
            const triggerDropdownFieldNameEl = triggerFieldEl.querySelector(`#triggerDropdownFieldName${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldIndex + 1}`);
            
            if (triggerDropdownFieldNameEl) {
                const triggerDropdownFieldName = triggerDropdownFieldNameEl.value.trim();
                
                if (triggerDropdownFieldName) {
                    // Sanitize trigger dropdown field name
                    const sanitizedTriggerFieldName = triggerDropdownFieldName
                        .toLowerCase()
                        .replace(/[?]/g, '')
                        .replace(/[^a-z0-9_]+/g, '_')
                        .replace(/^_+|_+$/g, '');
                    
                    // Get all dropdown options for this trigger dropdown
                    const triggerDropdownOptionsContainer = triggerFieldEl.querySelector(`#triggerDropdownOptions${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldIndex + 1}`);
                    if (triggerDropdownOptionsContainer) {
                        const triggerOptionInputs = triggerDropdownOptionsContainer.querySelectorAll('input[type="text"]');
                        
                        triggerOptionInputs.forEach((triggerOptionInput) => {
                            const triggerOptionValue = triggerOptionInput.value.trim();
                            if (triggerOptionValue) {
                                // Sanitize option value: replace non-word chars with underscore, convert to lowercase
                                const sanitizedTriggerOptionValue = triggerOptionValue
                                    .replace(/[^A-Za-z0-9_]+/g, "_")
                                    .toLowerCase()
                                    .replace(/^_+|_+$/g, '');
                                
                                // Generate a single checkbox ID using just field name and option value (matching checkbox option behavior)
                                // Format: {dropdownFieldName}_{optionValue}
                                // This matches the pattern used for checkbox options which don't include entry numbers
                                const checkboxId = `${sanitizedTriggerFieldName}_${sanitizedTriggerOptionValue}`;
                                if (!checkboxNodeIds.includes(checkboxId)) {
                                    checkboxNodeIds.push(checkboxId);
                                    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Found dropdown hidden checkbox ID:', checkboxId);
                                }
                            }
                        });
                    }
                }
            }
        });
    }
    
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Found checkbox option node IDs:', checkboxNodeIds);
    return checkboxNodeIds;
}

// Function to toggle conditional logic UI and update it
function toggleTriggerDateConditionalLogic(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] toggleTriggerDateConditionalLogic called');
    
    const checkbox = document.getElementById(`enableConditionalLogic${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    const container = document.getElementById(`conditionalLogicUI${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    
    if (!checkbox || !container) {
        console.error('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox or container not found');
        return;
    }
    
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox checked:', checkbox.checked);
    container.style.display = checkbox.checked ? 'block' : 'none';
    
    // Initialize or update the data structure
    if (!window.triggerDateConditionalLogic) {
        window.triggerDateConditionalLogic = {};
    }
    const key = `${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    if (!window.triggerDateConditionalLogic[key]) {
        window.triggerDateConditionalLogic[key] = { enabled: false, conditions: [''] };
    }
    
    // Update enabled state
    window.triggerDateConditionalLogic[key].enabled = checkbox.checked;
    
    if (checkbox.checked) {
        updateTriggerDateConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
    } else {
        // Clear conditions when disabled
        window.triggerDateConditionalLogic[key].conditions = [];
    }
}

// Function to update the conditional logic UI with checkbox option dropdowns
function updateTriggerDateConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] updateTriggerDateConditionalLogicUI called');
    
    const container = document.getElementById(`conditionalLogicUI${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (!container) {
        console.error('🔍 [CONDITIONAL LOGIC DEBUG] Container not found');
        return;
    }
    
    // Get checkbox option node IDs from the trigger sequence
    const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(questionId, fieldCount, sequenceCount);
    
    // Initialize conditions array if it doesn't exist
    if (!window.triggerDateConditionalLogic) {
        window.triggerDateConditionalLogic = {};
    }
    const key = `${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    if (!window.triggerDateConditionalLogic[key]) {
        window.triggerDateConditionalLogic[key] = { enabled: false, conditions: [''] };
    }
    
    // Clear existing UI
    container.innerHTML = '';
    
    // Create condition rows
    window.triggerDateConditionalLogic[key].conditions.forEach((condition, conditionIndex) => {
        const conditionRow = document.createElement('div');
        conditionRow.style.cssText = 'margin-bottom: 8px; display: flex; gap: 8px; align-items: center; justify-content: center; width: 100%;';
        
        const conditionDropdown = document.createElement('select');
        conditionDropdown.style.cssText = 'width: 70%; max-width: 300px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px; flex-shrink: 1;';
        
        // Add placeholder option
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Select checkbox option...';
        conditionDropdown.appendChild(placeholderOption);
        
        // Add checkbox option node IDs
        checkboxNodeIds.forEach(nodeId => {
            const option = document.createElement('option');
            option.value = nodeId;
            option.textContent = nodeId;
            if (condition === nodeId) {
                option.selected = true;
            }
            conditionDropdown.appendChild(option);
        });
        
        conditionDropdown.value = condition || '';
        conditionDropdown.onchange = () => {
            if (!window.triggerDateConditionalLogic[key]) {
                window.triggerDateConditionalLogic[key] = { enabled: true, conditions: [] };
            }
            window.triggerDateConditionalLogic[key].conditions[conditionIndex] = conditionDropdown.value;
            console.log('🔍 [CONDITIONAL LOGIC DEBUG] Condition updated:', window.triggerDateConditionalLogic[key].conditions);
        };
        
        const removeConditionBtn = document.createElement('button');
        removeConditionBtn.textContent = '×';
        removeConditionBtn.style.cssText = 'background: #f44336; color: white; border: none; width: 24px; height: 24px; min-width: 24px; max-width: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1;';
        removeConditionBtn.onclick = () => {
            if (!window.triggerDateConditionalLogic[key]) {
                window.triggerDateConditionalLogic[key] = { enabled: true, conditions: [] };
            }
            if (window.triggerDateConditionalLogic[key].conditions.length > 1) {
                window.triggerDateConditionalLogic[key].conditions.splice(conditionIndex, 1);
                updateTriggerDateConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
            }
        };
        
        conditionRow.appendChild(conditionDropdown);
        conditionRow.appendChild(removeConditionBtn);
        container.appendChild(conditionRow);
    });
    
    // Add Another Condition button
    const addConditionBtn = document.createElement('button');
    addConditionBtn.textContent = 'Add Another Condition';
    addConditionBtn.style.cssText = 'background: #2196F3; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; width: 100%; margin-top: 4px;';
    addConditionBtn.onclick = () => {
        if (!window.triggerDateConditionalLogic[key]) {
            window.triggerDateConditionalLogic[key] = { enabled: true, conditions: [''] };
        }
        if (!window.triggerDateConditionalLogic[key].conditions) {
            window.triggerDateConditionalLogic[key].conditions = [''];
        }
        window.triggerDateConditionalLogic[key].conditions.push('');
        updateTriggerDateConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
    };
    container.appendChild(addConditionBtn);
    
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Conditional logic UI updated');
}

// Function to toggle conditional logic UI for dropdown fields and update it
function toggleTriggerDropdownConditionalLogic(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] toggleTriggerDropdownConditionalLogic called');
    
    const checkbox = document.getElementById(`enableConditionalLogicDropdown${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    const container = document.getElementById(`conditionalLogicUIDropdown${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    
    if (!checkbox || !container) {
        console.error('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox or container not found');
        return;
    }
    
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox checked:', checkbox.checked);
    container.style.display = checkbox.checked ? 'block' : 'none';
    
    // Initialize or update the data structure
    if (!window.triggerDropdownConditionalLogic) {
        window.triggerDropdownConditionalLogic = {};
    }
    const key = `${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    if (!window.triggerDropdownConditionalLogic[key]) {
        window.triggerDropdownConditionalLogic[key] = { enabled: false, conditions: [''] };
    }
    
    // Update enabled state
    window.triggerDropdownConditionalLogic[key].enabled = checkbox.checked;
    
    if (checkbox.checked) {
        updateTriggerDropdownConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
    } else {
        // Clear conditions when disabled
        window.triggerDropdownConditionalLogic[key].conditions = [];
    }
    
    // Trigger autosave to persist the changes
    if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
    }
}

// Function to update the conditional logic UI for dropdown fields with checkbox option dropdowns
function updateTriggerDropdownConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] updateTriggerDropdownConditionalLogicUI called for dropdown');
    
    const container = document.getElementById(`conditionalLogicUIDropdown${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (!container) {
        console.error('🔍 [CONDITIONAL LOGIC DEBUG] Container not found');
        return;
    }
    
    // Get checkbox option node IDs from the trigger sequence
    const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(questionId, fieldCount, sequenceCount);
    
    // Initialize conditions array if it doesn't exist
    if (!window.triggerDropdownConditionalLogic) {
        window.triggerDropdownConditionalLogic = {};
    }
    const key = `${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    if (!window.triggerDropdownConditionalLogic[key]) {
        window.triggerDropdownConditionalLogic[key] = { enabled: false, conditions: [''] };
    }
    
    // Clear existing UI
    container.innerHTML = '';
    
    // Create condition rows
    window.triggerDropdownConditionalLogic[key].conditions.forEach((condition, conditionIndex) => {
        const conditionRow = document.createElement('div');
        conditionRow.style.cssText = 'margin-bottom: 8px; display: flex; gap: 8px; align-items: center; justify-content: center; width: 100%;';
        
        const conditionDropdown = document.createElement('select');
        conditionDropdown.style.cssText = 'width: 70%; max-width: 300px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px; flex-shrink: 1;';
        
        // Add placeholder option
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Select checkbox option...';
        conditionDropdown.appendChild(placeholderOption);
        
        // Add checkbox option node IDs
        checkboxNodeIds.forEach(nodeId => {
            const option = document.createElement('option');
            option.value = nodeId;
            option.textContent = nodeId;
            if (condition === nodeId) {
                option.selected = true;
            }
            conditionDropdown.appendChild(option);
        });
        
        conditionDropdown.value = condition || '';
        conditionDropdown.onchange = () => {
            if (!window.triggerDropdownConditionalLogic[key]) {
                window.triggerDropdownConditionalLogic[key] = { enabled: true, conditions: [] };
            }
            window.triggerDropdownConditionalLogic[key].conditions[conditionIndex] = conditionDropdown.value;
            console.log('🔍 [CONDITIONAL LOGIC DEBUG] Dropdown condition updated:', window.triggerDropdownConditionalLogic[key].conditions);
            // Trigger autosave to persist the changes
            if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
            }
        };
        
        const removeConditionBtn = document.createElement('button');
        removeConditionBtn.textContent = '×';
        removeConditionBtn.style.cssText = 'background: #f44336; color: white; border: none; width: 24px; height: 24px; min-width: 24px; max-width: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1;';
        removeConditionBtn.onclick = () => {
            if (!window.triggerDropdownConditionalLogic[key]) {
                window.triggerDropdownConditionalLogic[key] = { enabled: true, conditions: [] };
            }
            if (window.triggerDropdownConditionalLogic[key].conditions.length > 1) {
                window.triggerDropdownConditionalLogic[key].conditions.splice(conditionIndex, 1);
                updateTriggerDropdownConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
                // Trigger autosave to persist the changes
                if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                }
            }
        };
        
        conditionRow.appendChild(conditionDropdown);
        conditionRow.appendChild(removeConditionBtn);
        container.appendChild(conditionRow);
    });
    
    // Add Another Condition button
    const addConditionBtn = document.createElement('button');
    addConditionBtn.textContent = 'Add Another Condition';
    addConditionBtn.style.cssText = 'background: #2196F3; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; width: 100%; margin-top: 4px;';
    addConditionBtn.onclick = () => {
        if (!window.triggerDropdownConditionalLogic[key]) {
            window.triggerDropdownConditionalLogic[key] = { enabled: true, conditions: [''] };
        }
        if (!window.triggerDropdownConditionalLogic[key].conditions) {
            window.triggerDropdownConditionalLogic[key].conditions = [''];
        }
        window.triggerDropdownConditionalLogic[key].conditions.push('');
        updateTriggerDropdownConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
        // Trigger autosave to persist the changes
        if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
        }
    };
    container.appendChild(addConditionBtn);
    
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Dropdown conditional logic UI updated');
}

// Function to toggle conditional logic UI for label fields and update it
function toggleTriggerLabelConditionalLogic(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] toggleTriggerLabelConditionalLogic called');
    const checkbox = document.getElementById(`enableConditionalLogicLabel${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    const container = document.getElementById(`conditionalLogicUILabel${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (!checkbox || !container) {
        console.error('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox or container not found');
        return;
    }
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox checked:', checkbox.checked);
    container.style.display = checkbox.checked ? 'block' : 'none';
    if (!window.triggerLabelConditionalLogic) {
        window.triggerLabelConditionalLogic = {};
    }
    const key = `${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    if (!window.triggerLabelConditionalLogic[key]) {
        window.triggerLabelConditionalLogic[key] = { enabled: false, conditions: [''] };
    }
    window.triggerLabelConditionalLogic[key].enabled = checkbox.checked;
    if (checkbox.checked) {
        updateTriggerLabelConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
    } else {
        window.triggerLabelConditionalLogic[key].conditions = [];
    }
    // Trigger autosave to persist the changes
    if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
    }
}

// Function to update the conditional logic UI for label fields with checkbox option dropdowns
function updateTriggerLabelConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] updateTriggerLabelConditionalLogicUI called for label');
    const container = document.getElementById(`conditionalLogicUILabel${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (!container) {
        console.error('🔍 [CONDITIONAL LOGIC DEBUG] Container not found');
        return;
    }
    const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(questionId, fieldCount, sequenceCount);
    if (!window.triggerLabelConditionalLogic) {
        window.triggerLabelConditionalLogic = {};
    }
    const key = `${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    if (!window.triggerLabelConditionalLogic[key]) {
        window.triggerLabelConditionalLogic[key] = { enabled: false, conditions: [''] };
    }
    container.innerHTML = '';
    window.triggerLabelConditionalLogic[key].conditions.forEach((condition, conditionIndex) => {
        const conditionRow = document.createElement('div');
        conditionRow.style.cssText = 'margin-bottom: 8px; display: flex; gap: 8px; align-items: center; justify-content: center; width: 100%;';
        const conditionDropdown = document.createElement('select');
        conditionDropdown.style.cssText = 'width: 70%; max-width: 300px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px; flex-shrink: 1;';
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Select checkbox option...';
        conditionDropdown.appendChild(placeholderOption);
        checkboxNodeIds.forEach(nodeId => {
            const option = document.createElement('option');
            option.value = nodeId;
            option.textContent = nodeId;
            if (condition === nodeId) {
                option.selected = true;
            }
            conditionDropdown.appendChild(option);
        });
        conditionDropdown.value = condition || '';
        conditionDropdown.onchange = () => {
            if (!window.triggerLabelConditionalLogic[key]) {
                window.triggerLabelConditionalLogic[key] = { enabled: true, conditions: [] };
            }
            window.triggerLabelConditionalLogic[key].conditions[conditionIndex] = conditionDropdown.value;
            console.log('🔍 [CONDITIONAL LOGIC DEBUG] Label condition updated:', window.triggerLabelConditionalLogic[key].conditions);
            // Trigger autosave to persist the changes
            if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
            }
        };
        const removeConditionBtn = document.createElement('button');
        removeConditionBtn.textContent = '×';
        removeConditionBtn.style.cssText = 'background: #f44336; color: white; border: none; width: 24px; height: 24px; min-width: 24px; max-width: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1;';
        removeConditionBtn.onclick = () => {
            if (!window.triggerLabelConditionalLogic[key]) {
                window.triggerLabelConditionalLogic[key] = { enabled: true, conditions: [] };
            }
            if (window.triggerLabelConditionalLogic[key].conditions.length > 1) {
                window.triggerLabelConditionalLogic[key].conditions.splice(conditionIndex, 1);
                updateTriggerLabelConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
                // Trigger autosave to persist the changes
                if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                }
            }
        };
        conditionRow.appendChild(conditionDropdown);
        conditionRow.appendChild(removeConditionBtn);
        container.appendChild(conditionRow);
    });
    const addConditionBtn = document.createElement('button');
    addConditionBtn.textContent = 'Add Another Condition';
    addConditionBtn.style.cssText = 'background: #2196F3; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; width: 100%; margin-top: 4px;';
    addConditionBtn.onclick = () => {
        if (!window.triggerLabelConditionalLogic[key]) {
            window.triggerLabelConditionalLogic[key] = { enabled: true, conditions: [''] };
        }
        if (!window.triggerLabelConditionalLogic[key].conditions) {
            window.triggerLabelConditionalLogic[key].conditions = [''];
        }
        window.triggerLabelConditionalLogic[key].conditions.push('');
        updateTriggerLabelConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
        // Trigger autosave to persist the changes
        if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
        }
    };
    container.appendChild(addConditionBtn);
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Label conditional logic UI updated');
}

// Function to toggle conditional logic UI for checkbox fields and update it
function toggleTriggerCheckboxConditionalLogic(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] toggleTriggerCheckboxConditionalLogic called');
    const checkbox = document.getElementById(`enableConditionalLogicCheckbox${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    const container = document.getElementById(`conditionalLogicUICheckbox${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (!checkbox || !container) {
        console.error('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox or container not found');
        return;
    }
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox checked:', checkbox.checked);
    container.style.display = checkbox.checked ? 'block' : 'none';
    if (!window.triggerCheckboxConditionalLogic) {
        window.triggerCheckboxConditionalLogic = {};
    }
    const key = `${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    if (!window.triggerCheckboxConditionalLogic[key]) {
        window.triggerCheckboxConditionalLogic[key] = { enabled: false, conditions: [''] };
    }
    window.triggerCheckboxConditionalLogic[key].enabled = checkbox.checked;
    if (checkbox.checked) {
        updateTriggerCheckboxConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
    } else {
        window.triggerCheckboxConditionalLogic[key].conditions = [];
    }
    // Trigger autosave to persist the changes
    if (typeof window.requestAutosave === 'function') {
        window.requestAutosave();
    }
}

// Function to update the conditional logic UI for checkbox fields with checkbox option dropdowns
function updateTriggerCheckboxConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount) {
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] updateTriggerCheckboxConditionalLogicUI called for checkbox');
    const container = document.getElementById(`conditionalLogicUICheckbox${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`);
    if (!container) {
        console.error('🔍 [CONDITIONAL LOGIC DEBUG] Container not found');
        return;
    }
    const checkboxNodeIds = getCheckboxOptionNodeIdsFromTriggerSequence(questionId, fieldCount, sequenceCount);
    if (!window.triggerCheckboxConditionalLogic) {
        window.triggerCheckboxConditionalLogic = {};
    }
    const key = `${questionId}_${fieldCount}_${sequenceCount}_${triggerFieldCount}`;
    if (!window.triggerCheckboxConditionalLogic[key]) {
        window.triggerCheckboxConditionalLogic[key] = { enabled: false, conditions: [''] };
    }
    container.innerHTML = '';
    window.triggerCheckboxConditionalLogic[key].conditions.forEach((condition, conditionIndex) => {
        const conditionRow = document.createElement('div');
        conditionRow.style.cssText = 'margin-bottom: 8px; display: flex; gap: 8px; align-items: center; justify-content: center; width: 100%;';
        const conditionDropdown = document.createElement('select');
        conditionDropdown.style.cssText = 'width: 70%; max-width: 300px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px; flex-shrink: 1;';
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Select checkbox option...';
        conditionDropdown.appendChild(placeholderOption);
        checkboxNodeIds.forEach(nodeId => {
            const option = document.createElement('option');
            option.value = nodeId;
            option.textContent = nodeId;
            if (condition === nodeId) {
                option.selected = true;
            }
            conditionDropdown.appendChild(option);
        });
        conditionDropdown.value = condition || '';
        conditionDropdown.onchange = () => {
            if (!window.triggerCheckboxConditionalLogic[key]) {
                window.triggerCheckboxConditionalLogic[key] = { enabled: true, conditions: [] };
            }
            window.triggerCheckboxConditionalLogic[key].conditions[conditionIndex] = conditionDropdown.value;
            console.log('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox condition updated:', window.triggerCheckboxConditionalLogic[key].conditions);
            // Trigger autosave to persist the changes
            if (typeof window.requestAutosave === 'function') {
                window.requestAutosave();
            }
        };
        const removeConditionBtn = document.createElement('button');
        removeConditionBtn.textContent = '×';
        removeConditionBtn.style.cssText = 'background: #f44336; color: white; border: none; width: 24px; height: 24px; min-width: 24px; max-width: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1;';
        removeConditionBtn.onclick = () => {
            if (!window.triggerCheckboxConditionalLogic[key]) {
                window.triggerCheckboxConditionalLogic[key] = { enabled: true, conditions: [] };
            }
            if (window.triggerCheckboxConditionalLogic[key].conditions.length > 1) {
                window.triggerCheckboxConditionalLogic[key].conditions.splice(conditionIndex, 1);
                updateTriggerCheckboxConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
                // Trigger autosave to persist the changes
                if (typeof window.requestAutosave === 'function') {
                    window.requestAutosave();
                }
            }
        };
        conditionRow.appendChild(conditionDropdown);
        conditionRow.appendChild(removeConditionBtn);
        container.appendChild(conditionRow);
    });
    const addConditionBtn = document.createElement('button');
    addConditionBtn.textContent = 'Add Another Condition';
    addConditionBtn.style.cssText = 'background: #2196F3; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; width: 100%; margin-top: 4px;';
    addConditionBtn.onclick = () => {
        if (!window.triggerCheckboxConditionalLogic[key]) {
            window.triggerCheckboxConditionalLogic[key] = { enabled: true, conditions: [''] };
        }
        if (!window.triggerCheckboxConditionalLogic[key].conditions) {
            window.triggerCheckboxConditionalLogic[key].conditions = [''];
        }
        window.triggerCheckboxConditionalLogic[key].conditions.push('');
        updateTriggerCheckboxConditionalLogicUI(questionId, fieldCount, sequenceCount, triggerFieldCount);
        // Trigger autosave to persist the changes
        if (typeof window.requestAutosave === 'function') {
            window.requestAutosave();
        }
    };
    container.appendChild(addConditionBtn);
    console.log('🔍 [CONDITIONAL LOGIC DEBUG] Checkbox conditional logic UI updated');
}


function addTimeField(questionId) {
    const unifiedDiv = getUnifiedContainer(questionId);
    console.log('🔧 [ADD TIME DEBUG] Looking for unified container:', `unifiedFields${questionId}`);
    console.log('🔧 [ADD TIME DEBUG] Found unified container:', !!unifiedDiv);
    
    if (!unifiedDiv) {
        console.error('🔧 [ADD TIME DEBUG] Unified container not found!');
        return;
    }
    
    // Ensure the unified container is visible
    if (unifiedDiv.style.display === 'none') {
        console.log('🔧 [ADD TIME DEBUG] Unified container was hidden, making it visible');
        unifiedDiv.style.display = 'block';
    }
    
    // Remove placeholder if it exists
    const placeholder = unifiedDiv.querySelector('div[style*="font-style: italic"]');
    if (placeholder) {
        placeholder.remove();
    }
    
    const fieldCount = unifiedDiv.children.length + 1;
    console.log('🔧 [ADD TIME DEBUG] Current field count:', fieldCount);

    const fieldDiv = document.createElement('div');
    fieldDiv.className = `unified-field field-${fieldCount}`;
    fieldDiv.setAttribute('data-type', 'time');
    fieldDiv.setAttribute('data-order', fieldCount);
    fieldDiv.innerHTML = `
        <div style="margin: 10px 0; padding: 12px; border: 1px solid #ddd; border-radius: 10px; background: #fff3e0; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="font-weight: bold; color: #e65100;">Time: <span id="labelText${questionId}_${fieldCount}">Time ${fieldCount}</span></div>
            <div style="font-size: 0.9em; color: #bf360c;">Node ID: <span id="nodeIdText${questionId}_${fieldCount}">time_${fieldCount}</span></div>
            <div style="font-size: 0.8em; color: #d84315; margin-top: 5px;">Type: <span id="typeText${questionId}_${fieldCount}">Time</span> | Order: ${fieldCount}</div>
            <button type="button" onclick="removeUnifiedField(${questionId}, ${fieldCount})" style="margin-top: 5px; background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;">Remove</button>
        </div>
    `;
    unifiedDiv.appendChild(fieldDiv);
    console.log('🔧 [ADD TIME DEBUG] Added time field to unified container. New count:', unifiedDiv.children.length);
    
    // Force the container to be visible and have dimensions
    unifiedDiv.style.minHeight = '50px';
    unifiedDiv.style.border = '1px solid #e0e0e0';
    unifiedDiv.style.borderRadius = '5px';
    unifiedDiv.style.padding = '10px';
    unifiedDiv.style.backgroundColor = '#fafafa';
    unifiedDiv.style.margin = '10px 0';
    unifiedDiv.style.width = '100%';
    unifiedDiv.style.display = 'block';
    unifiedDiv.style.position = 'relative';
    
    // Add double-click event listener as backup
    const displayDiv = fieldDiv.querySelector('div');
    if (displayDiv) {
        // Remove any existing event listeners to prevent duplicates
        if (displayDiv._dblclickHandler) {
            displayDiv.removeEventListener('dblclick', displayDiv._dblclickHandler);
        }
        
        // Add event listener for double-click editing
        displayDiv._dblclickHandler = function() {
            editUnifiedField(questionId, fieldCount);
        };
        displayDiv.addEventListener('dblclick', displayDiv._dblclickHandler);
    }
}

function addMultipleTextboxOption(questionId) {
    const multipleTextboxesOptionsDiv = document.getElementById(`multipleTextboxesOptions${questionId}`);
    const optionCount = multipleTextboxesOptionsDiv.children.length + 1;

    const optionDiv = document.createElement('div');
    optionDiv.className = `option${optionCount}`;
    optionDiv.innerHTML = `
        <h4>Textbox ${optionCount}</h4>
        <label>Label:</label>
        <input type="text" id="multipleTextboxLabel${questionId}_${optionCount}" placeholder="Label ${optionCount}"><br><br>
        <label>Name/ID:</label>
        <input type="text" id="multipleTextboxName${questionId}_${optionCount}" placeholder="Name/ID ${optionCount}"><br><br>
        <label>Placeholder:</label>
        <input type="text" id="multipleTextboxPlaceholder${questionId}_${optionCount}" placeholder="Placeholder ${optionCount}">
        <button type="button" onclick="removeMultipleTextboxOption(${questionId}, ${optionCount})">Remove Textbox</button>
        <hr>
    `;
    multipleTextboxesOptionsDiv.appendChild(optionDiv);
    
    // Update the Name/ID field with the custom Node ID if it exists
    updateMultipleTextboxesNodeId(questionId);
}

// Function to update all textbox Name/ID fields with the custom Node ID
function updateMultipleTextboxesNodeId(questionId) {
    const nodeIdInput = document.getElementById(`multipleTextboxesNodeId${questionId}`);
    if (!nodeIdInput) return;
    
    const customNodeId = nodeIdInput.value.trim();
    if (!customNodeId) return;
    
    // Update all existing textbox Name/ID fields
    const textboxOptions = document.querySelectorAll(`#multipleTextboxesOptions${questionId} > div`);
    textboxOptions.forEach((option, index) => {
        const nameInput = option.querySelector(`input[id^="multipleTextboxName"]`);
        if (nameInput && !nameInput.value.trim()) {
            // Only update if the field is empty
            nameInput.value = customNodeId;
        }
    });
}

function removeMultipleTextboxOption(questionId, optionNumber) {
    const optionDiv = document.querySelector(`#multipleTextboxesOptions${questionId} .option${optionNumber}`);
    if (optionDiv) {
        optionDiv.remove();
        const options = document.querySelectorAll(`#multipleTextboxesOptions${questionId} > div`);
        options.forEach((option, index) => {
            option.className = `option${index + 1}`;
            option.querySelector('h4').innerText = `Textbox ${index + 1}`;
            option.querySelector(`input[id^="multipleTextboxLabel"]`).id = `multipleTextboxLabel${questionId}_${index + 1}`;
            option.querySelector(`input[id^="multipleTextboxName"]`).id = `multipleTextboxName${questionId}_${index + 1}`;
            option.querySelector(`input[id^="multipleTextboxPlaceholder"]`).id = `multipleTextboxPlaceholder${questionId}_${index + 1}`;
            option.querySelector('button').setAttribute('onclick', `removeMultipleTextboxOption(${questionId}, ${index + 1})`);
        });
    }
}

// This function populates the jump options for numbered dropdown questions
function updateJumpOptionsForNumberedDropdown(questionId, conditionId = null) {
    const selectElements = conditionId 
        ? [document.getElementById(`jumpOption${questionId}_${conditionId}`)]
        : document.querySelectorAll(`[id^="jumpOption${questionId}_"]`);

    selectElements.forEach(selectEl => {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="" disabled selected>Select an option</option>';
        
        // Get the min and max values from the range inputs
        const rangeStartEl = document.getElementById(`numberRangeStart${questionId}`);
        const rangeEndEl = document.getElementById(`numberRangeEnd${questionId}`);
        
        if (!rangeStartEl || !rangeEndEl) return;
        
        const min = parseInt(rangeStartEl.value) || 1;
        const max = parseInt(rangeEndEl.value) || min;
        
        // Add each number in the range as an option
        for (let i = min; i <= max; i++) {
            const opt = document.createElement('option');
            opt.value = i.toString();
            opt.text = i.toString();
            selectEl.appendChild(opt);
        }
    });
}

/**
 * Updates jump options and conditional logic options for numbered dropdown when range values change
 */
function updateNumberedDropdownEvents(questionId) {
    // Get the current question type to confirm it's still a numbered dropdown
    const questionType = document.getElementById(`questionType${questionId}`).value;
    if (questionType === 'numberedDropdown') {
        // 1. Update all existing jump conditions for this question
        const jumpConditions = document.querySelectorAll(`#jumpConditions${questionId} .jump-condition`);
        if (jumpConditions.length > 0) {
            updateJumpOptionsForNumberedDropdown(questionId);
        } else {
            // If there are no jump conditions but jump logic is enabled,
            // we should still update the options in case they add one later
            const jumpEnabled = document.getElementById(`enableJump${questionId}`)?.checked || false;
            if (jumpEnabled) {
                updateJumpOptionsForNumberedDropdown(questionId);
            }
        }
        
        // 2. Update conditional logic in other questions that reference this question
        const allLogicRows = document.querySelectorAll('.logic-condition-row');
        allLogicRows.forEach(row => {
            const rowParts = row.id.match(/logicConditionRow(\d+)_(\d+)/);
            if (rowParts && rowParts.length === 3) {
                const targetQuestionId = rowParts[1];
                const conditionIndex = rowParts[2];
                
                // Check if this logic row references our question
                const prevQuestionInput = row.querySelector(`#prevQuestion${targetQuestionId}_${conditionIndex}`);
                if (prevQuestionInput && prevQuestionInput.value == questionId) {
                    // Update the answer options for this row
                    updateLogicAnswersForRow(targetQuestionId, conditionIndex);
                }
            }
        });
        
        // 3. Update any hidden field conditional logic that might reference this question
        updateHiddenFieldConditionsForNumberedDropdown(questionId);
        
        // 4. Update PDF logic trigger options if PDF logic is enabled
        const pdfLogicEnabled = document.getElementById(`pdfLogic${questionId}`)?.checked;
        if (pdfLogicEnabled) {
            updatePdfLogicTriggerOptions(questionId);
        }
        
        // 5. Update hidden logic trigger options if hidden logic is enabled
        const hiddenLogicEnabled = document.getElementById(`enableHiddenLogic${questionId}`)?.checked;
        if (hiddenLogicEnabled) {
            updateHiddenLogicTriggerOptionsForNumberedDropdown(questionId);
        }
    }
}

/**
 * Updates hidden field conditions referencing a numbered dropdown question
 */
function updateHiddenFieldConditionsForNumberedDropdown(questionId) {
    // Look through all hidden field condition rows for references to this question
    const hiddenFieldBlocks = document.querySelectorAll('.hidden-field-block');
    
    hiddenFieldBlocks.forEach(block => {
        const hiddenFieldId = block.id.replace('hiddenFieldBlock', '');
        
        // Check text hidden fields
        const textConditions = block.querySelectorAll('#conditionalAutofill' + hiddenFieldId + ' [id^="condition' + hiddenFieldId + '_"]');
        textConditions.forEach(condition => {
            const conditionId = condition.id.split('_')[1];
            const prevQuestionEl = condition.querySelector(`#conditionQuestion${hiddenFieldId}_${conditionId}`);
            
            if (prevQuestionEl && prevQuestionEl.value === questionId) {
                updateConditionAnswers(hiddenFieldId, conditionId);
            }
        });
        
        // Check checkbox hidden fields
        const checkboxConditions = block.querySelectorAll('#conditionalAutofillForCheckbox' + hiddenFieldId + ' [id^="condition' + hiddenFieldId + '_"]');
        checkboxConditions.forEach(condition => {
            const conditionId = condition.id.split('_')[1];
            const prevQuestionEl = condition.querySelector(`#conditionQuestion${hiddenFieldId}_${conditionId}`);
            
            if (prevQuestionEl && prevQuestionEl.value === questionId) {
                updateConditionAnswers(hiddenFieldId, conditionId);
            }
        });
    });
}

function generateAllQuestionOptions() {
    var optionsHTML='';
    var qBlocks= document.querySelectorAll('.question-block');
    qBlocks.forEach(function(qBlock){
        var qId= qBlock.id.replace('questionBlock','');
        var txtEl= qBlock.querySelector('input[type="text"]');
        var questionText= txtEl? txtEl.value:('Question '+qId);
        var selEl= qBlock.querySelector('select');
        var qType= selEl? selEl.value:'text';

        if(['dropdown','radio','checkbox','numberedDropdown'].indexOf(qType)!==-1){
            optionsHTML+='<option value="'+qId+'">Question '+qId+': '+questionText+'</option>';
        }
    });
    return optionsHTML;
}

// ------------------------------------------------
// --- Linking Logic functions
// ------------------------------------------------
function toggleLinkingLogic(questionId) {
    const linkingEnabled = document.getElementById(`enableLinking${questionId}`).checked;
    const linkingFields = document.getElementById(`linkingBlock${questionId}`);
    linkingFields.style.display = linkingEnabled ? 'block' : 'none';
    
    if (linkingEnabled) {
        updateLinkingTargets(questionId);
    }
}

function updateLinkingTargets(questionId) {
    const targetDropdown = document.getElementById(`linkingTarget${questionId}`);
    if (!targetDropdown) return;
    
    // Clear existing options except the first placeholder
    const defaultOption = targetDropdown.options[0];
    targetDropdown.innerHTML = '';
    targetDropdown.appendChild(defaultOption);
    
    // Find all dropdown questions except this one
    const questionBlocks = document.querySelectorAll('.question-block');
    questionBlocks.forEach(block => {
        const blockId = block.id.replace('questionBlock', '');
        if (blockId === questionId.toString()) return; // Skip current question
        
        const typeSelect = block.querySelector(`#questionType${blockId}`);
        if (!typeSelect || typeSelect.value !== 'dropdown') return; // Only include dropdown questions
        
        const questionTextInput = block.querySelector(`input[id="question${blockId}"]`);
        const questionText = questionTextInput ? questionTextInput.value.trim() : `Question ${blockId}`;
        
        const option = document.createElement('option');
        option.value = blockId;
        option.textContent = questionText;
        targetDropdown.appendChild(option);
    });
}

function toggleSubtitle(questionId) {
    const subtitleEnabled = document.getElementById(`enableSubtitle${questionId}`).checked;
    const subtitleBlock = document.getElementById(`subtitleBlock${questionId}`);
    subtitleBlock.style.display = subtitleEnabled ? 'block' : 'none';
}

// New function for Info Box feature
function toggleInfoBox(questionId) {
    const infoBoxEnabled = document.getElementById(`enableInfoBox${questionId}`).checked;
    const infoBoxBlock = document.getElementById(`infoBoxBlock${questionId}`);
    infoBoxBlock.style.display = infoBoxEnabled ? 'block' : 'none';
}

function deleteDropdownImage(questionId) {
    const urlInput = document.getElementById(`dropdownImageURL${questionId}`);
    const widthInput = document.getElementById(`dropdownImageWidth${questionId}`);
    const heightInput = document.getElementById(`dropdownImageHeight${questionId}`);
    
    if (urlInput) urlInput.value = '';
    if (widthInput) widthInput.value = '';
    if (heightInput) heightInput.value = '';
    
    alert('Image deleted successfully');
}

function addMultipleAmountOption(questionId) {
    const multipleTextboxesOptionsDiv = document.getElementById(`multipleTextboxesOptions${questionId}`);
    const amountCount = multipleTextboxesOptionsDiv.querySelectorAll('.amount-block').length + 1;

    const amountDiv = document.createElement('div');
    amountDiv.className = `amount-block amount${amountCount}`;
    amountDiv.innerHTML = `
        <h4>Amount ${amountCount}</h4>
        <label>Label:</label>
        <input type="text" id="multipleAmountLabel${questionId}_${amountCount}" placeholder="Label ${amountCount}"><br><br>
        <label>Name/ID:</label>
        <input type="text" id="multipleAmountName${questionId}_${amountCount}" placeholder="Name/ID ${amountCount}"><br><br>
        <label>Placeholder:</label>
        <input type="text" id="multipleAmountPlaceholder${questionId}_${amountCount}" placeholder="Placeholder ${amountCount}">
        <button type="button" onclick="removeMultipleAmountOption(${questionId}, ${amountCount})">Remove Amount</button>
        <hr>
    `;
    multipleTextboxesOptionsDiv.appendChild(amountDiv);
}

function removeMultipleAmountOption(questionId, amountNumber) {
    const amountDiv = document.querySelector(`#multipleTextboxesOptions${questionId} .amount${amountNumber}`);
    if (amountDiv) {
        amountDiv.remove();
        const amounts = document.querySelectorAll(`#multipleTextboxesOptions${questionId} .amount-block`);
        amounts.forEach((amt, idx) => {
            const newAmountNumber = idx + 1;
            amt.className = `amount-block amount${newAmountNumber}`;
            amt.querySelector('h4').innerText = `Amount ${newAmountNumber}`;
            amt.querySelector(`input[id^="multipleAmountLabel"]`).id = `multipleAmountLabel${questionId}_${newAmountNumber}`;
            amt.querySelector(`input[id^="multipleAmountName"]`).id = `multipleAmountName${questionId}_${newAmountNumber}`;
            amt.querySelector(`input[id^="multipleAmountPlaceholder"]`).id = `multipleAmountPlaceholder${questionId}_${newAmountNumber}`;
            amt.querySelector('button').setAttribute('onclick', `removeMultipleAmountOption(${questionId}, ${newAmountNumber})`);
        });
    }
}

// ============================================
// ===========  FORM NAME MODULE  =============
// ============================================
function addFormNameModule() {
    // Check if Form Name module already exists
    if (document.getElementById('formNameContainer')) {
        return;
    }
    
    const formNameContainer = document.createElement('div');
    formNameContainer.id = 'formNameContainer';
    formNameContainer.className = 'form-name-module';
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
    
    // Insert above the PDF configuration
    const pdfContainer = document.getElementById('pdfContainer');
    if (pdfContainer) {
        pdfContainer.parentNode.insertBefore(formNameContainer, pdfContainer);
    } else {
        // Fallback: insert at the beginning of the container
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(formNameContainer, container.firstChild);
        }
    }
}

// ============================================
// ===========  PDF CONFIGURATION MODULE  =====
// ============================================
function createPdfConfigurationModule() {
    // Check if PDF configuration module already exists
    if (document.getElementById('pdfConfigurationModule')) {
        return;
    }
    
    const pdfConfigContainer = document.createElement('div');
    pdfConfigContainer.id = 'pdfConfigurationModule';
    pdfConfigContainer.className = 'pdf-configuration-module';
    pdfConfigContainer.style.cssText = 
        'background: #fff; ' +
        'border: 2px solid #2980b9; ' +
        'border-radius: 10px; ' +
        'padding: 20px; ' +
        'margin: 20px auto; ' +
        'max-width: 600px; ' +
        'box-shadow: 0 4px 12px rgba(0,0,0,0.1);';
    
    pdfConfigContainer.innerHTML = 
        '<h3 style="text-align: center; margin-bottom: 15px; color: #2c3e50; font-size: 1.3em;">PDF Configuration</h3>' +
        '<div style="text-align: center;">' +
          '<div style="margin-bottom: 15px;">' +
            '<label for="formPDFName" style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Choose Form PDF:</label>' +
            '<input type="text" id="formPDFName" placeholder="Enter PDF form name (e.g., sc100.pdf)" ' +
                   'style="width: 100%; max-width: 400px; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; text-align: center;">' +
          '</div>' +
          '<div style="margin-bottom: 15px;">' +
            '<label for="pdfOutputName" style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Choose your PDF Name:</label>' +
            '<input type="text" id="pdfOutputName" placeholder="Enter output file name (e.g., adam.html)" ' +
                   'style="width: 100%; max-width: 400px; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; text-align: center;">' +
          '</div>' +
          '<div style="margin-bottom: 15px;">' +
            '<label for="stripePriceId" style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Choose your Price ID:</label>' +
            '<input type="text" id="stripePriceId" placeholder="Enter Stripe Price ID (e.g., price_12345)" ' +
                   'style="width: 100%; max-width: 400px; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; text-align: center;">' +
          '</div>' +
          '<p style="margin-top: 8px; font-size: 0.9em; color: #666; font-style: italic;">' +
            'Configure the PDF form name, output file name, and Stripe price ID for your form.' +
          '</p>' +
        '</div>';
    
    // Insert after the Form Name module
    const formNameContainer = document.getElementById('formNameContainer');
    if (formNameContainer) {
        formNameContainer.parentNode.insertBefore(pdfConfigContainer, formNameContainer.nextSibling);
    } else {
        // Fallback: insert at the beginning of the container
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(pdfConfigContainer, container.firstChild);
        }
    }
}

// ============================================
// ===========  ADD LOCATION FIELDS  =========
// ============================================
function addLocationFields(questionId, questionType) {
    // New simplified single entry with title, same as trigger location UI
            const unifiedDiv = getUnifiedContainer(questionId);
    if (!unifiedDiv) return;

    const fieldCount = unifiedDiv.children.length + 1;
    const fieldDiv = document.createElement('div');
    fieldDiv.className = `unified-field field-${fieldCount}`;
    fieldDiv.setAttribute('data-type', 'location');
    fieldDiv.setAttribute('data-order', fieldCount);
    fieldDiv.innerHTML = `
        <div style="margin: 10px 0; padding: 12px; border: 1px solid #28a745; border-radius: 10px; background: #f0fff0; cursor: default; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-weight: bold; color: #28a745; text-align: center;">Location Data Added</div>
            <div style="margin: 10px 0; text-align: center;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;color:#28a745;font-size:12px;">Location Title Field:</label>
                <input type="text" id="locationTitle${questionId}_${fieldCount}" placeholder="Enter location title (e.g., Address, Location, etc.)" style="width: 220px; padding: 6px; border: 1px solid #28a745; border-radius: 4px; font-size: 12px; text-align: center;">
            </div>
            <div style="text-align: center; margin-top: 8px;">
                <button type="button" onclick="removeUnifiedField(${questionId}, ${fieldCount})" style="background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;">Remove</button>
            </div>
        </div>
    `;
    unifiedDiv.appendChild(fieldDiv);
}

// ============================================
// ===========  UNIFIED FIELD REMOVAL  =======
// ============================================
function removeUnifiedField(questionId, fieldOrder) {
    const unifiedDiv = document.getElementById(`unifiedFields${questionId}`);
    const fieldToRemove = unifiedDiv.querySelector(`[data-order="${fieldOrder}"]`);
    
    if (fieldToRemove) {
        const fieldType = fieldToRemove.getAttribute('data-type');
        fieldToRemove.remove();
        
        // Update order numbers for remaining fields
        const remainingFields = unifiedDiv.querySelectorAll('.unified-field');
        remainingFields.forEach((field, index) => {
            const newOrder = index + 1;
            field.setAttribute('data-order', newOrder);
            field.className = `unified-field field-${newOrder}`;
            
            // Update the order display - find the div that contains "Order:"
            const orderDisplay = field.querySelector('div[style*="font-size: 0.8em"]');
            if (orderDisplay && orderDisplay.textContent.includes('Order:')) {
                orderDisplay.textContent = orderDisplay.textContent.replace(/Order: \d+/, `Order: ${newOrder}`);
            }
            
            // Update button onclick
            const removeButton = field.querySelector('button');
            if (removeButton) {
                removeButton.setAttribute('onclick', `removeUnifiedField(${questionId}, ${newOrder})`);
            }
            
            // Update double-click event - find the container div with cursor pointer
            const displayDiv = field.querySelector('div[style*="cursor: pointer"]');
            if (displayDiv) {
                // Remove any existing event listeners to prevent duplicates
                if (displayDiv._dblclickHandler) {
                    displayDiv.removeEventListener('dblclick', displayDiv._dblclickHandler);
                }
                
                // Add event listener for double-click editing
                displayDiv._dblclickHandler = function() {
                    editUnifiedField(questionId, newOrder);
                };
                displayDiv.addEventListener('dblclick', displayDiv._dblclickHandler);
            }
        });
        
        // Also remove from hidden containers for backward compatibility
        if (fieldType === 'label') {
            const hiddenLabelDiv = document.querySelector(`#textboxLabels${questionId} .label${fieldOrder}`);
            if (hiddenLabelDiv) hiddenLabelDiv.remove();
        } else if (fieldType === 'amount') {
            const hiddenAmountDiv = document.querySelector(`#textboxAmounts${questionId} .amount${fieldOrder}`);
            if (hiddenAmountDiv) hiddenAmountDiv.remove();
        }
    }
}

// ============================================
// ===========  UNIFIED FIELD EDITING  =======
// ============================================
function editUnifiedField(questionId, fieldOrder) {
    const unifiedDiv = document.getElementById(`unifiedFields${questionId}`);
    const fieldDiv = unifiedDiv.querySelector(`[data-order="${fieldOrder}"]`);
    
    if (!fieldDiv) {
        return;
    }
    
    const currentType = fieldDiv.getAttribute('data-type');
    const labelTextEl = document.getElementById('labelText' + questionId + '_' + fieldOrder);
    const nodeIdTextEl = document.getElementById('nodeIdText' + questionId + '_' + fieldOrder);
    
    if (!labelTextEl || !nodeIdTextEl) {
        return;
    }
    
    const labelText = labelTextEl.textContent;
    const nodeIdText = nodeIdTextEl.textContent;
    
    // Create edit form
    const editForm = document.createElement('div');
    editForm.style.cssText = 'margin: 10px 0; padding: 20px; border: 2px solid #007bff; border-radius: 12px; background: #f0f8ff; box-shadow: 0 2px 8px rgba(0,123,255,0.1);';
    editForm.innerHTML = `
        <h4 style="margin-top: 0; color: #007bff;">Edit Field</h4>
        <div style="margin-bottom: 10px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Field Name:</label>
            <input type="text" id="editLabel${questionId}_${fieldOrder}" value="${labelText}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px;">
        </div>
        <div style="margin-bottom: 10px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Node ID:</label>
            <input type="text" id="editNodeId${questionId}_${fieldOrder}" value="${nodeIdText}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px;">
        </div>
        <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Type:</label>
            <select id="editType${questionId}_${fieldOrder}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px;">
                <option value="label" ${currentType === 'label' ? 'selected' : ''}>Label</option>
                <option value="amount" ${currentType === 'amount' ? 'selected' : ''}>Amount</option>
                <option value="date" ${currentType === 'date' ? 'selected' : ''}>Date</option>
            </select>
        </div>
        <div style="text-align: center; margin-top: 15px;">
            <button type="button" onclick="saveUnifiedField(${questionId}, ${fieldOrder})" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin: 0 10px; font-size: 14px; font-weight: 500; display: inline-block;">Save</button>
            <button type="button" onclick="cancelEditUnifiedField(${questionId}, ${fieldOrder})" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin: 0 10px; font-size: 14px; font-weight: 500; display: inline-block;">Cancel</button>
        </div>
    `;
    
    // Replace the field with the edit form
    fieldDiv.style.display = 'none';
    fieldDiv.parentNode.insertBefore(editForm, fieldDiv.nextSibling);
}

function saveUnifiedField(questionId, fieldOrder) {
    const newLabel = document.getElementById(`editLabel${questionId}_${fieldOrder}`).value.trim();
    const newNodeId = document.getElementById(`editNodeId${questionId}_${fieldOrder}`).value.trim();
    const newType = document.getElementById(`editType${questionId}_${fieldOrder}`).value;
    
    
    if (!newLabel) {
        alert('Field name cannot be empty');
        return;
    }
    
    // Update the field data
    const unifiedDiv = document.getElementById(`unifiedFields${questionId}`);
    const fieldDiv = unifiedDiv.querySelector(`[data-order="${fieldOrder}"]`);
    const editForm = fieldDiv.nextSibling;
    
    // Update field attributes
    fieldDiv.setAttribute('data-type', newType);
    
    // Update display elements
    const labelTextEl = document.getElementById('labelText' + questionId + '_' + fieldOrder);
    const nodeIdTextEl = document.getElementById('nodeIdText' + questionId + '_' + fieldOrder);
    const typeTextEl = document.getElementById('typeText' + questionId + '_' + fieldOrder);
    
    labelTextEl.textContent = newLabel;
    nodeIdTextEl.textContent = newNodeId;
    typeTextEl.textContent = newType;
    
    // Update the display text based on type
    const displayDiv = fieldDiv.querySelector('div');
    if (newType === 'label') {
        displayDiv.querySelector('div:first-child').innerHTML = 'Label: <span id="labelText' + questionId + '_' + fieldOrder + '">' + newLabel + '</span>';
    } else if (newType === 'amount') {
        displayDiv.querySelector('div:first-child').innerHTML = 'Amount: <span id="labelText' + questionId + '_' + fieldOrder + '">' + newLabel + '</span>';
    } else if (newType === 'date') {
        displayDiv.querySelector('div:first-child').innerHTML = 'Date: <span id="labelText' + questionId + '_' + fieldOrder + '">' + newLabel + '</span>';
    }
    
    // Remove any existing event listeners to prevent duplicates
    if (displayDiv._dblclickHandler) {
        displayDiv.removeEventListener('dblclick', displayDiv._dblclickHandler);
    }
    
    // Add event listener for double-click editing
    displayDiv._dblclickHandler = function() {
        editUnifiedField(questionId, fieldOrder);
    };
    displayDiv.addEventListener('dblclick', displayDiv._dblclickHandler);
    
    // Remove edit form and show field
    editForm.remove();
    fieldDiv.style.display = 'block';
    
    // Update hidden containers for backward compatibility (but don't interfere with the unified structure)
    setTimeout(() => {
        updateHiddenContainers(questionId);
    }, 100);
}

function cancelEditUnifiedField(questionId, fieldOrder) {
    const unifiedDiv = document.getElementById(`unifiedFields${questionId}`);
    const fieldDiv = unifiedDiv.querySelector(`[data-order="${fieldOrder}"]`);
    const editForm = fieldDiv.nextSibling;
    
    editForm.remove();
    fieldDiv.style.display = 'block';
}

function updateHiddenContainers(questionId) {
    // Clear hidden containers
    const textboxLabelsDiv = document.getElementById(`textboxLabels${questionId}`);
    const textboxAmountsDiv = document.getElementById(`textboxAmounts${questionId}`);
    textboxLabelsDiv.innerHTML = '';
    textboxAmountsDiv.innerHTML = '';
    
    // Rebuild hidden containers from unified data
    const unifiedDiv = document.getElementById(`unifiedFields${questionId}`);
    const fields = unifiedDiv.querySelectorAll('.unified-field');
    
    let labelCount = 1;
    let amountCount = 1;
    
    fields.forEach(field => {
        const fieldType = field.getAttribute('data-type');
        const fieldOrder = field.getAttribute('data-order');
        const labelTextEl = document.getElementById('labelText' + questionId + '_' + fieldOrder);
        const nodeIdTextEl = document.getElementById('nodeIdText' + questionId + '_' + fieldOrder);
        
        // Skip if elements don't exist (e.g., duplicate order numbers)
        if (!labelTextEl || !nodeIdTextEl) {
            console.warn(`Skipping field with order ${fieldOrder} - elements not found`);
            return;
        }
        
        const labelText = labelTextEl.textContent;
        const nodeIdText = nodeIdTextEl.textContent;
        
        if (fieldType === 'label') {
            const hiddenLabelDiv = document.createElement('div');
            hiddenLabelDiv.className = `label${labelCount}`;
            hiddenLabelDiv.innerHTML = `
                <input type="text" id="label${questionId}_${labelCount}" value="${labelText}">
                <br>
                <label style="font-size: 0.9em; color: #666;">Node ID: </label>
                <input type="text" id="labelNodeId${questionId}_${labelCount}" value="${nodeIdText}" style="width: 200px; margin-top: 5px;">
                <button type="button" onclick="removeTextboxLabel(${questionId}, ${labelCount})" style="margin-top: 5px;">Remove</button>
            `;
            textboxLabelsDiv.appendChild(hiddenLabelDiv);
            labelCount++;
        } else if (fieldType === 'amount') {
            const hiddenAmountDiv = document.createElement('div');
            hiddenAmountDiv.className = `amount${amountCount}`;
            hiddenAmountDiv.innerHTML = `
                <input type="text" id="amount${questionId}_${amountCount}" value="${labelText}">
                <button type="button" onclick="removeTextboxAmount(${questionId}, ${amountCount})">Remove</button>
            `;
            textboxAmountsDiv.appendChild(hiddenAmountDiv);
            amountCount++;
        }
    });
}

// ============================================
// ===========  UNIFIED FIELDS DISPLAY  =====
// ============================================
function updateUnifiedFieldsDisplay(questionId) {
    const unifiedDiv = document.getElementById('unifiedFields' + questionId);
    if (!unifiedDiv) return;
    
    // Get all elements from both containers
    const labelElements = Array.from(document.querySelectorAll('#textboxLabels' + questionId + ' > div'));
    const amountElements = Array.from(document.querySelectorAll('#textboxAmounts' + questionId + ' > div'));
    
    // Create a combined array with position information
    const allElements = [];
    
    labelElements.forEach((el) => {
        const labelInput = el.querySelector('input[type="text"]:first-of-type');
        const nodeIdInput = el.querySelector('input[type="text"]:last-of-type');
        allElements.push({
            type: 'label',
            label: labelInput ? labelInput.value.trim() : "",
            nodeId: nodeIdInput ? nodeIdInput.value.trim() : "",
            element: el,
            position: el.getBoundingClientRect().top
        });
    });
    
    amountElements.forEach((el) => {
        const amountInput = el.querySelector('input[type="text"]');
        allElements.push({
            type: 'amount',
            label: amountInput ? amountInput.value.trim() : "",
            nodeId: "",
            element: el,
            position: el.getBoundingClientRect().top
        });
    });
    
    // Sort by position in the document (creation order)
    allElements.sort((a, b) => a.position - b.position);
    
    // Clear and rebuild the unified display
    unifiedDiv.innerHTML = '';
    
    allElements.forEach((field, index) => {
        const fieldDiv = document.createElement('div');
        fieldDiv.style.cssText = 'margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; background: #f9f9f9;';
        
        if (field.type === 'label') {
            fieldDiv.innerHTML = `
                <div style="font-weight: bold; color: #333;">Label: ${field.label}</div>
                <div style="font-size: 0.9em; color: #666;">Node ID: ${field.nodeId}</div>
                <div style="font-size: 0.8em; color: #999; margin-top: 5px;">Type: Label | Order: ${index + 1}</div>
            `;
        } else if (field.type === 'amount') {
            fieldDiv.innerHTML = `
                <div style="font-weight: bold; color: #333;">Amount: ${field.label}</div>
                <div style="font-size: 0.8em; color: #999; margin-top: 5px;">Type: Amount | Order: ${index + 1}</div>
            `;
        }
        
        unifiedDiv.appendChild(fieldDiv);
    });
}

// ============================================
// ===========  LINKED FIELDS FUNCTIONALITY  =====
// ============================================

// Global variables for linked fields
let linkedFieldCounter = 0;
let currentLinkedFieldConfig = [];
// Linked Checkbox globals
let linkedCheckboxCounter = 0;
window.linkedCheckboxCounter = linkedCheckboxCounter;
let currentLinkedCheckboxConfig = [];

// Open the linked field modal
function openLinkedFieldModal() {
    console.log('🔍 [DEBUG] openLinkedFieldModal called');
    
    // Create modal if it doesn't exist
    if (!document.getElementById('linkedFieldModal')) {
        console.log('🔍 [DEBUG] Creating linked field modal');
        createLinkedFieldModal();
    }
    
    // Reset current configuration
    currentLinkedFieldConfig = [];
    
    // Show modal
    document.getElementById('linkedFieldModal').style.display = 'block';
    console.log('🔍 [DEBUG] Modal displayed');
    
    // Check if we have a stored configuration to restore
    if (window.lastLinkedFieldConfig && !window.editingLinkedFieldId) {
        console.log('🔍 [DEBUG] Restoring last configuration:', window.lastLinkedFieldConfig);
        
        // Restore the linked field ID
        const linkedFieldIdInput = document.getElementById('linkedFieldIdInput');
        if (linkedFieldIdInput) {
            linkedFieldIdInput.value = window.lastLinkedFieldConfig.linkedFieldId || '';
        }
        
        // Create dropdowns for each stored field
        window.lastLinkedFieldConfig.selectedFields.forEach(fieldId => {
            addLinkedFieldDropdown();
            const dropdownIndex = currentLinkedFieldConfig.length - 1;
            const select = document.getElementById(`linkedFieldSelect${dropdownIndex}`);
            const searchInput = document.getElementById(`linkedFieldSearch${dropdownIndex}`);
            
            if (select) {
                select.value = fieldId;
                currentLinkedFieldConfig[dropdownIndex].selectedValue = fieldId;
                
                // Also update the search input field with the selected option text
                if (searchInput) {
                    const selectedOption = select.querySelector(`option[value="${fieldId}"]`);
                    if (selectedOption) {
                        searchInput.value = selectedOption.textContent;
                    }
                }
            }
        });
    } else {
        // Initialize with two dropdowns (default behavior)
        addLinkedFieldDropdown();
        addLinkedFieldDropdown();
    }
}

// Create the linked field modal
function createLinkedFieldModal() {
    const modal = document.createElement('div');
    modal.id = 'linkedFieldModal';
    modal.style.cssText = `
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
    `;
    
    modal.innerHTML = `
        <div style="
            background-color: #fff;
            margin: 5% auto;
            padding: 20px;
            border-radius: 10px;
            width: 80%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        " onclick="event.stopPropagation()">
            <h3 style="text-align: center; margin-bottom: 20px; color: #2c3e50;">Configure Linked Fields</h3>
            <div id="linkedFieldDropdowns" style="margin-bottom: 20px;">
                <!-- Dropdowns will be added here -->
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Linked Field ID:</label>
                <input type="text" id="linkedFieldIdInput" placeholder="Enter linked field ID (e.g., linked_name_address)" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <button type="button" onclick="addLinkedFieldDropdown()" style="background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                    Link Another
                </button>
                <button type="button" onclick="finalizeLinkedField()" style="background: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                    Done
                </button>
                <button type="button" onclick="closeLinkedFieldModal()" style="background: #e74c3c; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners for modal functionality
    modal.addEventListener('click', function(event) {
        // Close modal when clicking on the backdrop (outside the modal content)
        if (event.target === modal) {
            closeLinkedFieldModal();
        }
    });
    
    // Add Enter key functionality
    document.addEventListener('keydown', function(event) {
        if (modal.style.display === 'block' && event.key === 'Enter') {
            event.preventDefault();
            finalizeLinkedField();
        }
    });
}

// ============================================
// ======= LINKED CHECKBOX FUNCTIONALITY ======
// ============================================

function openLinkedCheckboxModal() {
    if (!document.getElementById('linkedCheckboxModal')) {
        createLinkedCheckboxModal();
    }
    // Clear editing flag when opening for new entry
    window.editingLinkedCheckboxId = null;
    currentLinkedCheckboxConfig = [];
    document.getElementById('linkedCheckboxModal').style.display = 'block';
    const container = document.getElementById('linkedCheckboxDropdowns');
    container.innerHTML = '';
    // Clear linked checkbox ID input
    const linkedCheckboxIdInput = document.getElementById('linkedCheckboxIdInput');
    if (linkedCheckboxIdInput) {
        linkedCheckboxIdInput.value = '';
    }
    addLinkedCheckboxDropdown();
    addLinkedCheckboxDropdown();
}

function createLinkedCheckboxModal() {
    const modal = document.createElement('div');
    modal.id = 'linkedCheckboxModal';
    modal.style.cssText = 'display:none;position:fixed;z-index:1000;left:0;top:0;width:100%;height:100%;background-color:rgba(0,0,0,0.5)';
    modal.addEventListener('click', () => modal.style.display = 'none');
    modal.innerHTML = `
      <div style="background:#fff;margin:5% auto;padding:20px;border-radius:10px;width:90%;max-width:1200px;max-height:80vh;overflow:auto;" onclick="event.stopPropagation()">
        <h3 style="text-align:center;margin-bottom:20px;color:#2c3e50;">Configure Linked Checkbox</h3>
        <div id="linkedCheckboxDropdowns" style="margin-bottom:20px;"></div>
        <div style="margin-bottom:20px;">
          <label style="display:block;margin-bottom:5px;font-weight:bold;">Linked Checkbox ID:</label>
          <input type="text" id="linkedCheckboxIdInput" placeholder="Enter linked Checkbox ID (e.g., linked_checkbox)" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;">
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:10px;">
          <button type="button" onclick="addLinkedCheckboxDropdown()" style="background:#3498db;color:#fff;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;">Link Another</button>
          <button type="button" onclick="finalizeLinkedCheckbox()" style="background:#27ae60;color:#fff;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;">Done</button>
          <button type="button" onclick="closeLinkedCheckboxModal()" style="background:#e74c3c;color:#fff;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
}

function addLinkedCheckboxDropdown() {
    const container = document.getElementById('linkedCheckboxDropdowns');
    const idx = currentLinkedCheckboxConfig.length;
    const div = document.createElement('div');
    div.id = `linkedCheckboxDropdown${idx}`;
    div.style.cssText = 'display:flex;align-items:center;margin-bottom:15px;padding:10px;border:1px solid #ddd;border-radius:5px;background:#f9f9f9;';
    div.innerHTML = `
      <div style="flex:1;margin-right:10px;">
        <label style="display:block;margin-bottom:5px;font-weight:bold;">Checkbox Option ${idx+1}:</label>
        <div style="position:relative;">
          <input type="text" id="linkedCheckboxSearch${idx}" placeholder="Search for a Checkbox Option..." style="width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;"
            onkeyup="filterLinkedCheckboxOptions(${idx})" onfocus="showLinkedCheckboxOptions(${idx})" onblur="hideLinkedCheckboxOptions(${idx})">
          <div id="linkedCheckboxOptions${idx}" style="display:none;position:absolute;top:100%;left:0;min-width:400px;background:#fff;border:1px solid #ccc;border-top:none;border-radius:0 0 4px 4px;max-height:200px;overflow-y:auto;z-index:1000;box-shadow:0 4px 8px rgba(0,0,0,0.1);"></div>
        </div>
        <select id="linkedCheckboxSelect${idx}" style="display:none;"></select>
      </div>
      <button type="button" onclick="removeLinkedCheckboxDropdown(${idx})" style="background:#e74c3c;color:#fff;border:none;padding:8px 12px;border-radius:4px;cursor:pointer;margin-left:10px;">Delete</button>`;
    container.appendChild(div);
    populateLinkedCheckboxDropdown(idx);
    currentLinkedCheckboxConfig.push({ index: idx, selectedValue: '' });
}

function populateLinkedCheckboxDropdown(idx) {
    const select = document.getElementById(`linkedCheckboxSelect${idx}`);
    if (!select) return;
    select.innerHTML = '<option value="">Select a checkbox option...</option>';

    const options = [];
    const blocks = document.querySelectorAll('[id^="questionBlock"]');
    blocks.forEach(block => {
        const qId = block.id.replace('questionBlock','');
        const typeSel = block.querySelector(`#questionType${qId}`);
        if (!typeSel) return;

        if (typeSel.value === 'checkbox') {
            // Basic checkbox question options
            const nameInputs = block.querySelectorAll(`#checkboxOptions${qId} input[id^="checkboxOptionName${qId}_"]`);
            const textInputs = block.querySelectorAll(`#checkboxOptions${qId} input[id^="checkboxOptionText${qId}_"]`);
            nameInputs.forEach((nameInput, i) => {
                const nodeId = nameInput.value.trim();
                const labelText = (textInputs[i]?.value || '').trim();
                if (nodeId) options.push({ nodeId, label: labelText || nodeId });
            });
        }

        // Unified checkbox options (checkboxNodeId*)
        const unifiedNodes = block.querySelectorAll(`input[id^="checkboxNodeId${qId}_"]`);
        const unifiedTexts = block.querySelectorAll(`input[id^="checkboxText${qId}_"]`);
        unifiedNodes.forEach((nodeInput, i) => {
            const nodeId = nodeInput.value.trim();
            const labelText = (unifiedTexts[i]?.value || '').trim();
            if (nodeId) options.push({ nodeId, label: labelText || nodeId });
        });

        // Hidden dropdown checkboxes - generate IDs for dropdown options
        if (typeSel.value === 'dropdown') {
            // Get the dropdown's nameId (similar to how textbox gets its nameId)
            const nameIdInput = block.querySelector(`#textboxName${qId}`);
            const nameId = nameIdInput ? nameIdInput.value.trim() : '';
            
            // Get dropdown question text for better labeling
            const questionTextEl = block.querySelector(`#question${qId}`);
            const questionText = questionTextEl ? questionTextEl.value.trim() : `Question ${qId}`;
            
            // Get all dropdown options
            const dropdownOptionInputs = block.querySelectorAll(`#dropdownOptions${qId} input`);
            dropdownOptionInputs.forEach((optionInput) => {
                const optionValue = optionInput.value.trim();
                if (optionValue) {
                    // Generate checkbox ID using same pattern as dropdownMirror
                    // Sanitize: replace non-word chars with underscore, convert to lowercase
                    // Use character class [^A-Za-z0-9_] instead of \W to avoid backslash escaping issues
                    const sanitizedValue = optionValue.replace(/[^A-Za-z0-9_]+/g, "_").toLowerCase().replace(/^_+|_+$/g, '');
                    const dropdownNameId = nameId || `answer${qId}`;
                    const checkboxId = `${dropdownNameId}_${sanitizedValue}`;
                    
                    // Create label: "Question Text - Option Value (checkboxId)"
                    const label = `${questionText} - ${optionValue} (${checkboxId})`;
                    
                    options.push({ nodeId: checkboxId, label: label });
                }
            });
        }

        // Hidden dropdown checkboxes from numbered dropdown questions
        if (typeSel.value === 'numberedDropdown') {
            // Get the numbered dropdown's min and max range
            const minInput = block.querySelector(`#numberRangeStart${qId}`);
            const maxInput = block.querySelector(`#numberRangeEnd${qId}`);
            const minValue = minInput ? parseInt(minInput.value) || 1 : 1;
            const maxValue = maxInput ? parseInt(maxInput.value) || 1 : 1;
            
            // Get numbered dropdown question text for better labeling
            const questionTextEl = block.querySelector(`#question${qId}`);
            const questionText = questionTextEl ? questionTextEl.value.trim() : `Question ${qId}`;
            
            // Find all dropdown fields within this numbered dropdown
            const unifiedFieldsContainer = block.querySelector(`#unifiedFields${qId}`);
            if (unifiedFieldsContainer) {
                const dropdownFields = unifiedFieldsContainer.querySelectorAll('[data-type="dropdown"]');
                
                dropdownFields.forEach((dropdownField) => {
                    // Get the dropdown field name
                    const fieldCount = dropdownField.getAttribute('data-order');
                    const fieldNameInput = block.querySelector(`#dropdownFieldName${qId}_${fieldCount}`);
                    const fieldName = fieldNameInput ? fieldNameInput.value.trim() : '';
                    
                    if (fieldName) {
                        // Sanitize field name: lowercase, remove question marks, replace spaces with underscores
                        const sanitizedFieldName = fieldName
                            .toLowerCase()
                            .replace(/[?]/g, '')
                            .replace(/[^a-z0-9_]+/g, '_')
                            .replace(/^_+|_+$/g, '');
                        
                        // Get all dropdown options for this field
                        const dropdownOptionsContainer = block.querySelector(`#dropdownOptions${qId}_${fieldCount}`);
                        if (dropdownOptionsContainer) {
                            const optionInputs = dropdownOptionsContainer.querySelectorAll('input[type="text"]');
                            
                            optionInputs.forEach((optionInput) => {
                                const optionValue = optionInput.value.trim();
                                if (optionValue) {
                                    // Sanitize option value: replace non-word chars with underscore, convert to lowercase
                                    // Use character class [^A-Za-z0-9_] instead of \W to avoid backslash escaping issues
                                    const sanitizedOptionValue = optionValue.replace(/[^A-Za-z0-9_]+/g, "_").toLowerCase().replace(/^_+|_+$/g, '');
                                    
                                    // Generate checkbox IDs for each entry number (1 to max)
                                    for (let entryNum = minValue; entryNum <= maxValue; entryNum++) {
                                        const checkboxId = `${sanitizedFieldName}_${entryNum}_${sanitizedOptionValue}`;
                                        const label = `${questionText} - ${fieldName} (${entryNum}) - ${optionValue} (${checkboxId})`;
                                        options.push({ nodeId: checkboxId, label: label });
                                    }
                                }
                            });
                        }
                    }
                });
            }
            
            // Hidden dropdown checkboxes from dropdowns inside trigger sequences
            // Get the numbered dropdown's nodeId (question nodeId)
            // For numbered dropdowns, nodeId is stored in #nodeId${qId}, not #textboxName${qId}
            const nodeIdInput = block.querySelector(`#nodeId${qId}`);
            const questionNodeId = nodeIdInput ? nodeIdInput.value.trim() : `answer${qId}`;
            
            // Find all dropdown fields within this numbered dropdown
            const unifiedFieldsContainerForTriggers = block.querySelector(`#unifiedFields${qId}`);
            if (unifiedFieldsContainerForTriggers) {
                const dropdownFields = unifiedFieldsContainerForTriggers.querySelectorAll('[data-type="dropdown"]');
                
                dropdownFields.forEach((dropdownField) => {
                    // Get the dropdown field name
                    const fieldCount = dropdownField.getAttribute('data-order');
                    const fieldNameInput = block.querySelector(`#dropdownFieldName${qId}_${fieldCount}`);
                    const fieldName = fieldNameInput ? fieldNameInput.value.trim() : '';
                    
                    if (fieldName) {
                        // Find all trigger sequences for this dropdown
                        const triggerSequencesContainer = block.querySelector(`#triggerSequences${qId}_${fieldCount}`);
                        if (triggerSequencesContainer) {
                            const sequenceElements = triggerSequencesContainer.querySelectorAll('[class^="trigger-sequence-"]');
                            
                            sequenceElements.forEach((sequenceEl, sequenceIndex) => {
                                // Find all dropdown fields within this trigger sequence
                                const triggerFieldsContainer = sequenceEl.querySelector(`#triggerFields${qId}_${fieldCount}_${sequenceIndex + 1}`);
                                if (triggerFieldsContainer) {
                                    const triggerFieldElements = triggerFieldsContainer.querySelectorAll('[class^="trigger-field-"]');
                                    
                                    triggerFieldElements.forEach((triggerFieldEl, triggerFieldIndex) => {
                                        // Check if this is a dropdown field
                                        const triggerDropdownFieldNameEl = triggerFieldEl.querySelector(`#triggerDropdownFieldName${qId}_${fieldCount}_${sequenceIndex + 1}_${triggerFieldIndex + 1}`);
                                        
                                        if (triggerDropdownFieldNameEl) {
                                            const triggerDropdownFieldName = triggerDropdownFieldNameEl.value.trim();
                                            
                                            if (triggerDropdownFieldName) {
                                                // Get the parent dropdown's nodeId (trigger title) from the dropdown field's options
                                                // The parent dropdown is the one that contains this trigger sequence
                                                let parentDropdownNodeId = questionNodeId; // Fallback to question nodeId
                                                
                                                // Get the dropdown field's options to extract the parent nodeId
                                                const dropdownOptionsContainer = block.querySelector(`#dropdownOptions${qId}_${fieldCount}`);
                                                if (dropdownOptionsContainer) {
                                                    const dropdownOptionNodeIdInputs = dropdownOptionsContainer.querySelectorAll('input[id^="dropdownOptionNodeId"]');
                                                    if (dropdownOptionNodeIdInputs.length > 0) {
                                                        // Get the first option's nodeId and extract the base (e.g., "is_this_plaintiff_a_business_yes" -> "is_this_plaintiff_a_business")
                                                        const firstOptionNodeId = dropdownOptionNodeIdInputs[0].value.trim();
                                                        if (firstOptionNodeId) {
                                                            const lastUnderscoreIndex = firstOptionNodeId.lastIndexOf('_');
                                                            if (lastUnderscoreIndex > 0) {
                                                                parentDropdownNodeId = firstOptionNodeId.substring(0, lastUnderscoreIndex);
                                                            } else {
                                                                parentDropdownNodeId = firstOptionNodeId;
                                                            }
                                                        }
                                                    }
                                                }
                                                
                                                // Sanitize trigger dropdown field name
                                                const sanitizedTriggerFieldName = triggerDropdownFieldName
                                                    .toLowerCase()
                                                    .replace(/[?]/g, '')
                                                    .replace(/[^a-z0-9_]+/g, '_')
                                                    .replace(/^_+|_+$/g, '');
                                                
                                                // Get all dropdown options for this trigger dropdown
                                                const triggerDropdownOptionsContainer = triggerFieldEl.querySelector(`#triggerDropdownOptions${qId}_${fieldCount}_${sequenceIndex + 1}_${triggerFieldIndex + 1}`);
                                                if (triggerDropdownOptionsContainer) {
                                                    const triggerOptionInputs = triggerDropdownOptionsContainer.querySelectorAll('input[type="text"]');
                                                    
                                                    triggerOptionInputs.forEach((triggerOptionInput) => {
                                                        const triggerOptionValue = triggerOptionInput.value.trim();
                                                        if (triggerOptionValue) {
                                                            // Sanitize option value: replace non-word chars with underscore, convert to lowercase
                                                            const sanitizedTriggerOptionValue = triggerOptionValue
                                                                .replace(/[^A-Za-z0-9_]+/g, "_")
                                                                .toLowerCase()
                                                                .replace(/^_+|_+$/g, '');
                                                            
                                                            // Generate checkbox IDs for each entry number (minValue to maxValue)
                                                            // Format: {parentDropdownNodeId}_{dropdownFieldName}_{optionValue}_{entryNumber}
                                                            for (let entryNum = minValue; entryNum <= maxValue; entryNum++) {
                                                                const checkboxId = `${parentDropdownNodeId}_${sanitizedTriggerFieldName}_${sanitizedTriggerOptionValue}_${entryNum}`;
                                                                const label = `${questionText} - ${fieldName} [Trigger] - ${triggerDropdownFieldName} (${entryNum}) - ${triggerOptionValue} (${checkboxId})`;
                                                                options.push({ nodeId: checkboxId, label: label });
                                                            }
                                                        }
                                                    });
                                                }
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            }
        }

        // Hidden checkboxes from hidden logic configurations
        const enableHiddenLogicCheckbox = block.querySelector(`#enableHiddenLogic${qId}`);
        if (enableHiddenLogicCheckbox && enableHiddenLogicCheckbox.checked) {
            const configsContainer = block.querySelector(`#hiddenLogicConfigs${qId}`);
            if (configsContainer) {
                const configElements = configsContainer.querySelectorAll('.hidden-logic-config');
                
                configElements.forEach((configElement, configIndex) => {
                    const typeSelect = configElement.querySelector(`#hiddenLogicType${qId}_${configIndex}`);
                    const nodeIdInput = configElement.querySelector(`#hiddenLogicNodeId${qId}_${configIndex}`);
                    
                    // Only include checkbox type hidden logic
                    if (typeSelect && typeSelect.value === 'checkbox' && nodeIdInput) {
                        const nodeId = nodeIdInput.value.trim();
                        if (nodeId) {
                            // Get question text for better labeling
                            const questionTextEl = block.querySelector(`#question${qId}`);
                            const questionText = questionTextEl ? questionTextEl.value.trim() : `Question ${qId}`;
                            
                            // Get trigger value for context
                            const triggerSelect = configElement.querySelector(`#hiddenLogicTrigger${qId}_${configIndex}`);
                            const triggerValue = triggerSelect ? triggerSelect.value.trim() : '';
                            
                            // Create label: "Question Text - Hidden Logic (nodeId) [Trigger: value]"
                            const label = triggerValue 
                                ? `${questionText} - Hidden Logic (${nodeId}) [Trigger: ${triggerValue}]`
                                : `${questionText} - Hidden Logic (${nodeId})`;
                            
                            options.push({ nodeId: nodeId, label: label });
                        }
                    }
                });
            }
        }
    });

    // Build options list and searchable overlay
    const overlay = document.getElementById(`linkedCheckboxOptions${idx}`);
    overlay.innerHTML = '';
    options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.nodeId;
        o.textContent = `${opt.label} (${opt.nodeId})`;
        select.appendChild(o);

        const row = document.createElement('div');
        const displayText = `${opt.label} (${opt.nodeId})`;
        row.textContent = displayText;
        row.style.cssText = 'padding:6px 8px;cursor:pointer;';
        
        // Add mousedown handler to prevent blur event from firing
        row.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent input blur
            console.log('🔵 [LINKED CHECKBOX DEBUG] mousedown on option row, preventing default');
        });
        
        row.onclick = (e) => {
            e.stopPropagation(); // Prevent event bubbling
            console.log('🔵 [LINKED CHECKBOX DEBUG] Option clicked in dropdown:', {
                idx: idx,
                nodeId: opt.nodeId,
                label: opt.label,
                displayText: displayText
            });
            
            const searchInput = document.getElementById(`linkedCheckboxSearch${idx}`);
            if (!searchInput) {
                console.error('❌ [LINKED CHECKBOX DEBUG] Search input not found for idx:', idx);
                return;
            }
            
            const selectElement = document.getElementById(`linkedCheckboxSelect${idx}`);
            if (!selectElement) {
                console.error('❌ [LINKED CHECKBOX DEBUG] Select element not found for idx:', idx);
                return;
            }
            
            console.log('🔵 [LINKED CHECKBOX DEBUG] Before update:', {
                searchInputValue: searchInput.value,
                selectValue: selectElement.value,
                configValue: currentLinkedCheckboxConfig[idx]?.selectedValue
            });
            
            // Set search input to the full display text (not just nodeId)
            searchInput.value = displayText;
            console.log('✅ [LINKED CHECKBOX DEBUG] Updated search input to:', displayText);
            
            // Verify the value was set
            const verifySearchValue = searchInput.value;
            console.log('🔵 [LINKED CHECKBOX DEBUG] Verified search input value after setting:', verifySearchValue);
            
            // Set select value to nodeId
            selectElement.value = opt.nodeId;
            console.log('✅ [LINKED CHECKBOX DEBUG] Updated select value to:', opt.nodeId);
            
            // Verify the select value was set
            const verifySelectValue = selectElement.value;
            console.log('🔵 [LINKED CHECKBOX DEBUG] Verified select value after setting:', verifySelectValue);
            
            // Update config
            if (currentLinkedCheckboxConfig[idx]) {
            currentLinkedCheckboxConfig[idx].selectedValue = opt.nodeId;
                console.log('✅ [LINKED CHECKBOX DEBUG] Updated config selectedValue to:', opt.nodeId);
            } else {
                console.error('❌ [LINKED CHECKBOX DEBUG] Config entry not found for idx:', idx);
            }
            
            // Hide overlay immediately
            overlay.style.display = 'none';
            console.log('✅ [LINKED CHECKBOX DEBUG] Hidden overlay');
            
            // Re-focus the search input to prevent blur issues
            setTimeout(() => {
                searchInput.focus();
                // Blur it again so it doesn't stay focused
                setTimeout(() => searchInput.blur(), 10);
            }, 10);
            
            console.log('🔵 [LINKED CHECKBOX DEBUG] After update:', {
                searchInputValue: searchInput.value,
                selectValue: selectElement.value,
                configValue: currentLinkedCheckboxConfig[idx]?.selectedValue,
                overlayDisplay: overlay.style.display
            });
        };
        overlay.appendChild(row);
    });
}

function filterLinkedCheckboxOptions(idx){
    const term = document.getElementById(`linkedCheckboxSearch${idx}`).value.toLowerCase();
    const overlay = document.getElementById(`linkedCheckboxOptions${idx}`);
    Array.from(overlay.children).forEach(child => {
        child.style.display = child.textContent.toLowerCase().includes(term) ? 'block' : 'none';
    });
}
function showLinkedCheckboxOptions(idx){
    document.getElementById(`linkedCheckboxOptions${idx}`).style.display = 'block';
}
function hideLinkedCheckboxOptions(idx){
    console.log('🔵 [LINKED CHECKBOX DEBUG] hideLinkedCheckboxOptions called for idx:', idx);
    const overlay = document.getElementById(`linkedCheckboxOptions${idx}`);
    if (!overlay) {
        console.error('❌ [LINKED CHECKBOX DEBUG] Overlay not found for idx:', idx);
        return;
    }
    
    // Use a longer delay to allow clicks to register
    setTimeout(() => {
        // Check if overlay is still visible (might have been clicked)
        if (overlay.style.display !== 'none') {
            console.log('🔵 [LINKED CHECKBOX DEBUG] Hiding overlay after delay');
            overlay.style.display = 'none';
        } else {
            console.log('🔵 [LINKED CHECKBOX DEBUG] Overlay already hidden, skipping');
        }
    }, 200);
}

function removeLinkedCheckboxDropdown(idx){
    const div = document.getElementById(`linkedCheckboxDropdown${idx}`);
    if (div) div.remove();
    currentLinkedCheckboxConfig = currentLinkedCheckboxConfig.filter(c => c.index !== idx);
}

function finalizeLinkedCheckbox(){
    const selected = currentLinkedCheckboxConfig.filter(c => c.selectedValue);
    if (selected.length < 2) { alert('Please select at least 2 checkbox options to link.'); return; }
    const idInput = document.getElementById('linkedCheckboxIdInput');
    const linkedId = idInput ? idInput.value.trim() : '';
    if (!linkedId) { alert('Please enter a Linked Checkbox ID.'); return; }

    // If editing, remove the old entry first
    if (window.editingLinkedCheckboxId) {
        const oldDiv = document.getElementById(window.editingLinkedCheckboxId);
        if (oldDiv) {
            oldDiv.remove();
        }
        removeLinkedCheckboxConfig(window.editingLinkedCheckboxId);
        window.editingLinkedCheckboxId = null;
    }

    createLinkedCheckboxDisplay(selected, linkedId);
    closeLinkedCheckboxModal();
}

// Remove linked checkbox from config
function removeLinkedCheckboxConfig(displayId) {
    if (window.linkedCheckboxesConfig) {
        window.linkedCheckboxesConfig = window.linkedCheckboxesConfig.filter(c => c.id !== displayId);
    }
}

// Close the linked checkbox modal
function closeLinkedCheckboxModal() {
    const modal = document.getElementById('linkedCheckboxModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Clear current configuration
    currentLinkedCheckboxConfig = [];
    
    // Clear dropdowns
    const dropdownsContainer = document.getElementById('linkedCheckboxDropdowns');
    if (dropdownsContainer) {
        dropdownsContainer.innerHTML = '';
    }
    
    // Clear linked checkbox ID input
    const linkedCheckboxIdInput = document.getElementById('linkedCheckboxIdInput');
    if (linkedCheckboxIdInput) {
        linkedCheckboxIdInput.value = '';
    }
    
    // Clear the editing flag
    window.editingLinkedCheckboxId = null;
}

// Edit a linked checkbox display
function editLinkedCheckboxDisplay(displayId) {
    // Find the configuration for this display
    const config = (window.linkedCheckboxesConfig || []).find(c => c.id === displayId);
    if (!config) {
        console.log('❌ [DEBUG] Configuration not found for displayId:', displayId);
        return;
    }
    
    console.log('✅ [DEBUG] Found configuration:', config);
    
    // Store the display ID we're editing
    window.editingLinkedCheckboxId = displayId;
    
    // Create modal if it doesn't exist
    if (!document.getElementById('linkedCheckboxModal')) {
        createLinkedCheckboxModal();
    }
    
    // Reset current configuration
    currentLinkedCheckboxConfig = [];
    
    // Pre-populate the modal with existing data
    const linkedCheckboxIdInput = document.getElementById('linkedCheckboxIdInput');
    if (linkedCheckboxIdInput) {
        linkedCheckboxIdInput.value = config.linkedCheckboxId || '';
    }
    
    // Clear dropdowns first
    const dropdownsContainer = document.getElementById('linkedCheckboxDropdowns');
    if (dropdownsContainer) {
        dropdownsContainer.innerHTML = '';
    }
    
    // Create dropdowns for each checkbox
    config.checkboxes.forEach((checkboxId, index) => {
        addLinkedCheckboxDropdown();
        const dropdownIndex = currentLinkedCheckboxConfig.length - 1;
        
        // Populate dropdown first, then set value
        populateLinkedCheckboxDropdown(dropdownIndex);
        
        // Use setTimeout to ensure dropdown is populated before setting value
        setTimeout(() => {
            const select = document.getElementById(`linkedCheckboxSelect${dropdownIndex}`);
            const searchInput = document.getElementById(`linkedCheckboxSearch${dropdownIndex}`);
            
            if (select) {
                select.value = checkboxId;
                currentLinkedCheckboxConfig[dropdownIndex].selectedValue = checkboxId;
                
                // Also update the search input field with the selected option text
                if (searchInput) {
                    const selectedOption = select.querySelector(`option[value="${checkboxId}"]`);
                    if (selectedOption) {
                        searchInput.value = selectedOption.textContent;
                    }
                }
            }
        }, 50 * (index + 1)); // Stagger the timeouts slightly to avoid race conditions
    });
    
    // Show modal
    document.getElementById('linkedCheckboxModal').style.display = 'block';
    console.log('🔍 [DEBUG] Modal displayed for editing');
}

function createLinkedCheckboxDisplay(selectedOptions, linkedId){
    const displayId = `linkedCheckbox${linkedCheckboxCounter++}`;
    window.linkedCheckboxCounter = linkedCheckboxCounter;
    
    // Create container for linked fields/checkboxes if it doesn't exist
    let linkedFieldsContainer = document.getElementById('linkedFieldsContainer');
    if (!linkedFieldsContainer) {
        linkedFieldsContainer = document.createElement('div');
        linkedFieldsContainer.id = 'linkedFieldsContainer';
        linkedFieldsContainer.style.cssText = `
            background: #fff;
            border: 2px solid #27ae60;
            border-radius: 10px;
            padding: 20px;
            margin: 20px auto;
            max-width: 600px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;
        
        // Insert before the Form Editor section
        const formBuilder = document.getElementById('formBuilder');
        if (formBuilder) {
            formBuilder.insertBefore(linkedFieldsContainer, formBuilder.firstChild);
        }
    }
    const div = document.createElement('div');
    div.id = displayId;
    div.style.cssText = 'border:1px solid #ddd;border-radius:8px;padding:10px;margin:10px 0;background:#f9f9f9;transition: all 0.3s ease;';
    
    // Add hover effect
    div.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#f0f0f0';
        this.style.borderColor = '#bbb';
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
    
    div.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '#f9f9f9';
        this.style.borderColor = '#ddd';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
    });
    
    // Add double-click handler
    div.addEventListener('dblclick', function() {
        editLinkedCheckboxDisplay(displayId);
    });
    
    const names = selectedOptions.map(s=>s.selectedValue).join(' ↔ ');
    div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
        <div onclick="editLinkedCheckboxDisplay('${displayId}')" style="flex:1;cursor:pointer;"><h4 style="margin:0 0 5px 0;color:#2c3e50;">Linked Checkbox (${linkedId})</h4><p style="margin:0;color:#666;font-size:.9em;">${names}</p></div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          <button type="button" onclick="editLinkedCheckboxDisplay('${displayId}')" style="background:#3498db;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;">Edit</button>
          <button type="button" onclick="document.getElementById('${displayId}').remove(); removeLinkedCheckboxConfig('${displayId}')" style="background:#e74c3c;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;">Remove</button>
        </div>
      </div>`;
    linkedFieldsContainer.appendChild(div);
    window.linkedCheckboxesConfig = window.linkedCheckboxesConfig || [];
    window.linkedCheckboxesConfig.push({ id: displayId, linkedCheckboxId: linkedId, checkboxes: selectedOptions.map(s=>s.selectedValue) });
}

function createLinkedCheckboxDisplayFromImport(linkedCheckboxData) {
    const displayId = `linkedCheckbox${linkedCheckboxCounter++}`;
    window.linkedCheckboxCounter = linkedCheckboxCounter;
    const linkedCheckboxId = linkedCheckboxData.linkedCheckboxId || linkedCheckboxData.id;
    
    // Create container for linked fields/checkboxes if it doesn't exist
    let linkedFieldsContainer = document.getElementById('linkedFieldsContainer');
    if (!linkedFieldsContainer) {
        linkedFieldsContainer = document.createElement('div');
        linkedFieldsContainer.id = 'linkedFieldsContainer';
        linkedFieldsContainer.style.cssText = `
            background: #fff;
            border: 2px solid #27ae60;
            border-radius: 10px;
            padding: 20px;
            margin: 20px auto;
            max-width: 600px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;
        
        // Insert before the Form Editor section
        const formBuilder = document.getElementById('formBuilder');
        if (formBuilder) {
            formBuilder.insertBefore(linkedFieldsContainer, formBuilder.firstChild);
        }
    }
    
    const linkedCheckboxDiv = document.createElement('div');
    linkedCheckboxDiv.id = displayId;
    linkedCheckboxDiv.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin: 10px 0; background: #f9f9f9; transition: all 0.3s ease;';
    
    linkedCheckboxDiv.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#f0f0f0';
        this.style.borderColor = '#bbb';
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
    
    linkedCheckboxDiv.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '#f9f9f9';
        this.style.borderColor = '#ddd';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
    });
    
    // Add double-click handler
    linkedCheckboxDiv.addEventListener('dblclick', function() {
        editLinkedCheckboxDisplay(displayId);
    });
    
    const checkboxNames = linkedCheckboxData.checkboxes.join(' ↔ ');
    
    linkedCheckboxDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div onclick="editLinkedCheckboxDisplay('${displayId}')" style="flex: 1; cursor: pointer;">
                <h4 style="margin: 0 0 5px 0; color: #2c3e50;">Linked Checkbox (${linkedCheckboxId})</h4>
                <p style="margin: 0; color: #666; font-size: 0.9em;">${checkboxNames}</p>
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              <button type="button" onclick="editLinkedCheckboxDisplay('${displayId}')" style="background:#3498db;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;">Edit</button>
              <button type="button" onclick="document.getElementById('${displayId}').remove(); removeLinkedCheckboxConfig('${displayId}')" style="background:#e74c3c;color:#fff;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;">Remove</button>
            </div>
        </div>
    `;
    
    linkedFieldsContainer.appendChild(linkedCheckboxDiv);
    
    // Store the configuration
    window.linkedCheckboxesConfig = window.linkedCheckboxesConfig || [];
    window.linkedCheckboxesConfig.push({
        id: displayId,
        linkedCheckboxId: linkedCheckboxId,
        checkboxes: linkedCheckboxData.checkboxes
    });
}

// Add a dropdown to the linked field configuration
function addLinkedFieldDropdown() {
    console.log('🔍 [DEBUG] addLinkedFieldDropdown called');
    
    const dropdownsContainer = document.getElementById('linkedFieldDropdowns');
    const dropdownIndex = currentLinkedFieldConfig.length;
    
    console.log('🔍 [DEBUG] dropdownsContainer:', dropdownsContainer);
    console.log('🔍 [DEBUG] dropdownIndex:', dropdownIndex);
    
    const dropdownDiv = document.createElement('div');
    dropdownDiv.id = `linkedFieldDropdown${dropdownIndex}`;
    dropdownDiv.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 15px;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 5px;
        background-color: #f9f9f9;
    `;
    
    dropdownDiv.innerHTML = `
        <div style="flex: 1; margin-right: 10px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Text Question ${dropdownIndex + 1}:</label>
            <div style="position: relative;">
                <input type="text" id="linkedFieldSearch${dropdownIndex}" placeholder="Search for a text question..." 
                       style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;"
                       onkeyup="filterLinkedFieldOptions(${dropdownIndex})" 
                       onfocus="showLinkedFieldOptions(${dropdownIndex})"
                       onblur="hideLinkedFieldOptions(${dropdownIndex})">
                <div id="linkedFieldOptions${dropdownIndex}" style="display: none; position: absolute; top: 100%; left: 0; min-width: 400px; background: white; border: 1px solid #ccc; border-top: none; border-radius: 0 0 4px 4px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"></div>
            </div>
            <!-- Hidden select for form submission -->
            <select id="linkedFieldSelect${dropdownIndex}" style="display: none;">
                <option value="">Select a text question...</option>
            </select>
        </div>
        <button type="button" onclick="removeLinkedFieldDropdown(${dropdownIndex})" style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-left: 10px;">
            Delete
        </button>
    `;
    
    dropdownsContainer.appendChild(dropdownDiv);
    
    // Populate dropdown with text questions
    populateLinkedFieldDropdown(dropdownIndex);
    
    // Add to current configuration
    currentLinkedFieldConfig.push({
        index: dropdownIndex,
        selectedValue: ''
    });
}

// Populate a linked field dropdown with text questions
function populateLinkedFieldDropdown(dropdownIndex) {
    console.log('🔍 [DEBUG] populateLinkedFieldDropdown called with dropdownIndex:', dropdownIndex);
    
    const select = document.getElementById(`linkedFieldSelect${dropdownIndex}`);
    if (!select) {
        console.log('❌ [DEBUG] Select element not found for dropdownIndex:', dropdownIndex);
        return;
    }
    
    console.log('✅ [DEBUG] Found select element:', select);
    
    // Clear existing options
    select.innerHTML = '<option value="">Select a text question...</option>';
    
    // Find all text questions and numbered dropdown fields
    const textQuestions = [];
    const questionBlocks = document.querySelectorAll('[id^="questionBlock"]');
    
    console.log('🔍 [DEBUG] Found question blocks:', questionBlocks.length);
    
    questionBlocks.forEach((block, blockIndex) => {
        const questionId = block.id.replace('questionBlock', '');
        console.log(`🔍 [DEBUG] Processing block ${blockIndex}: questionId=${questionId}, block.id=${block.id}`);
        
        const questionTypeSelect = block.querySelector(`#questionType${questionId}`);
        const questionNameInput = block.querySelector(`#textboxName${questionId}`);
        
        console.log(`🔍 [DEBUG] Block ${blockIndex} - questionTypeSelect:`, questionTypeSelect);
        console.log(`🔍 [DEBUG] Block ${blockIndex} - questionNameInput:`, questionNameInput);
        
        if (questionTypeSelect) {
            console.log(`🔍 [DEBUG] Block ${blockIndex} - questionType:`, questionTypeSelect.value);
        }
        
        // Handle regular text questions
        if (questionTypeSelect && (questionTypeSelect.value === 'textbox' || questionTypeSelect.value === 'text') && questionNameInput) {
            const nodeId = questionNameInput.value.trim() || `answer${questionId}`;
            const questionText = block.querySelector(`#questionText${questionId}`)?.value || `Question ${questionId}`;
            
            console.log(`✅ [DEBUG] Found text question: ${questionText} (${nodeId})`);
            
            textQuestions.push({
                questionId: questionId,
                nodeId: nodeId,
                questionText: questionText
            });
        }
        
        // Handle numbered dropdown questions
        if (questionTypeSelect && questionTypeSelect.value === 'numberedDropdown') {
            console.log(`🔍 [DEBUG] Found numberedDropdown question ${questionId}`);
            
            const questionText = block.querySelector(`#questionText${questionId}`)?.value || `Question ${questionId}`;
            const nodeId = block.querySelector(`#nodeId${questionId}`)?.value || `answer${questionId}`;
            const minValue = parseInt(block.querySelector(`#numberRangeStart${questionId}`)?.value || '1');
            const maxValue = parseInt(block.querySelector(`#numberRangeEnd${questionId}`)?.value || '1');
            
            console.log(`🔍 [DEBUG] NumberedDropdown ${questionId} - questionText:`, questionText);
            console.log(`🔍 [DEBUG] NumberedDropdown ${questionId} - nodeId:`, nodeId);
            console.log(`🔍 [DEBUG] NumberedDropdown ${questionId} - minValue:`, minValue);
            console.log(`🔍 [DEBUG] NumberedDropdown ${questionId} - maxValue:`, maxValue);
            
            // Get all fields from the numbered dropdown using the unified fields container
            const unifiedFieldsContainer = block.querySelector(`#unifiedFields${questionId}`);
            console.log(`🔍 [DEBUG] NumberedDropdown ${questionId} - unifiedFieldsContainer:`, unifiedFieldsContainer);
            
            if (unifiedFieldsContainer) {
                const fieldContainers = unifiedFieldsContainer.querySelectorAll('.unified-field');
                console.log(`🔍 [DEBUG] NumberedDropdown ${questionId} - fieldContainers found:`, fieldContainers.length);
                
                fieldContainers.forEach((fieldContainer, fieldIndex) => {
                    console.log(`🔍 [DEBUG] Processing field container ${fieldIndex} for question ${questionId}`);
                    
                    const fieldType = fieldContainer.getAttribute('data-type');
                    const fieldOrder = fieldContainer.getAttribute('data-order');
                    
                    console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldType:`, fieldType);
                    console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldOrder:`, fieldOrder);
                    
                    if (fieldType && (fieldType === 'label' || fieldType === 'amount')) {
                        // Get the field data from the spans
                        const fieldLabelSpan = fieldContainer.querySelector(`#labelText${questionId}_${fieldOrder}`);
                        const fieldNodeIdSpan = fieldContainer.querySelector(`#nodeIdText${questionId}_${fieldOrder}`);
                        
                        console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldLabelSpan:`, fieldLabelSpan);
                        console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldNodeIdSpan:`, fieldNodeIdSpan);
                        
                        if (fieldLabelSpan && fieldNodeIdSpan) {
                            const fieldLabel = fieldLabelSpan.textContent.trim();
                            const fieldNodeId = fieldNodeIdSpan.textContent.trim();
                            
                            console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldLabel:`, fieldLabel);
                            console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldNodeId:`, fieldNodeId);
                            
                            if (fieldLabel && fieldNodeId) {
                                console.log(`✅ [DEBUG] Valid field found: ${fieldLabel} (${fieldNodeId})`);
                                
                                // Generate numbered options for each field
                                for (let i = minValue; i <= maxValue; i++) {
                                    const numberedNodeId = `${fieldNodeId}_${i}`;
                                    const questionTextWithNumber = `${questionText} - ${fieldLabel} ${i}`;
                                    
                                    console.log(`✅ [DEBUG] Adding numbered field: ${questionTextWithNumber} (${numberedNodeId})`);
                                    
                                    textQuestions.push({
                                        questionId: questionId,
                                        nodeId: numberedNodeId,
                                        questionText: questionTextWithNumber
                                    });
                                    
                                    // For state fields, also add the short version
                                    if (fieldLabel.toLowerCase() === 'state') {
                                        const shortNodeId = `${fieldNodeId}_short_${i}`;
                                        const questionTextWithShort = `${questionText} - ${fieldLabel} Short ${i}`;
                                        
                                        console.log(`✅ [DEBUG] Adding short state field: ${questionTextWithShort} (${shortNodeId})`);
                                        
                                        textQuestions.push({
                                            questionId: questionId,
                                            nodeId: shortNodeId,
                                            questionText: questionTextWithShort
                                        });
                                    }
                                }
                            }
                        } else {
                            console.log(`❌ [DEBUG] Field ${fieldIndex} missing spans - fieldLabelSpan: ${!!fieldLabelSpan}, fieldNodeIdSpan: ${!!fieldNodeIdSpan}`);
                        }
                    } else {
                        console.log(`❌ [DEBUG] Field ${fieldIndex} doesn't meet criteria - fieldType: ${fieldType}`);
                    }
                });
            } else {
                console.log(`❌ [DEBUG] No unifiedFieldsContainer found for question ${questionId}`);
            }
        }
        
        // Handle multiple textboxes questions
        if (questionTypeSelect && questionTypeSelect.value === 'multipleTextboxes') {
            console.log(`🔍 [DEBUG] Found multipleTextboxes question ${questionId}`);
            
            const questionText = block.querySelector(`#questionText${questionId}`)?.value || `Question ${questionId}`;
            const nodeId = block.querySelector(`#nodeId${questionId}`)?.value || `answer${questionId}`;
            
            console.log(`🔍 [DEBUG] MultipleTextboxes ${questionId} - questionText:`, questionText);
            console.log(`🔍 [DEBUG] MultipleTextboxes ${questionId} - nodeId:`, nodeId);
            
            // Get all fields from the multiple textboxes using the unified fields container
            const unifiedFieldsContainer = block.querySelector(`#unifiedFields${questionId}`);
            console.log(`🔍 [DEBUG] MultipleTextboxes ${questionId} - unifiedFieldsContainer:`, unifiedFieldsContainer);
            
            if (unifiedFieldsContainer) {
                const fieldContainers = unifiedFieldsContainer.querySelectorAll('.unified-field');
                console.log(`🔍 [DEBUG] MultipleTextboxes ${questionId} - fieldContainers found:`, fieldContainers.length);
                
                fieldContainers.forEach((fieldContainer, fieldIndex) => {
                    console.log(`🔍 [DEBUG] Processing field container ${fieldIndex} for question ${questionId}`);
                    
                    const fieldType = fieldContainer.getAttribute('data-type');
                    const fieldOrder = fieldContainer.getAttribute('data-order');
                    
                    console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldType:`, fieldType);
                    console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldOrder:`, fieldOrder);
                    
                    if (fieldType && (fieldType === 'label' || fieldType === 'amount')) {
                        // Get the field data from the spans
                        const fieldLabelSpan = fieldContainer.querySelector(`#labelText${questionId}_${fieldOrder}`);
                        const fieldNodeIdSpan = fieldContainer.querySelector(`#nodeIdText${questionId}_${fieldOrder}`);
                        
                        console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldLabelSpan:`, fieldLabelSpan);
                        console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldNodeIdSpan:`, fieldNodeIdSpan);
                        
                        if (fieldLabelSpan && fieldNodeIdSpan) {
                            const fieldLabel = fieldLabelSpan.textContent.trim();
                            const fieldNodeId = fieldNodeIdSpan.textContent.trim();
                            
                            console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldLabel:`, fieldLabel);
                            console.log(`🔍 [DEBUG] Field ${fieldIndex} - fieldNodeId:`, fieldNodeId);
                            
                            if (fieldLabel && fieldNodeId) {
                                console.log(`✅ [DEBUG] Valid field found: ${fieldLabel} (${fieldNodeId})`);
                                
                                // For multipleTextboxes, use the base nodeId without numbering
                                // because the actual generated fields use the base nodeId
                                const questionTextWithField = `${questionText} - ${fieldLabel}`;
                                
                                console.log(`✅ [DEBUG] Adding multiple textbox field: ${questionTextWithField} (${fieldNodeId})`);
                                
                                textQuestions.push({
                                    questionId: questionId,
                                    nodeId: fieldNodeId,
                                    questionText: questionTextWithField
                                });
                                
                                // For state fields, also add the short version
                                if (fieldLabel.toLowerCase() === 'state') {
                                    const shortNodeId = `${fieldNodeId}_short`;
                                    const questionTextWithShort = `${questionText} - ${fieldLabel} Short`;
                                    
                                    console.log(`✅ [DEBUG] Adding short state field: ${questionTextWithShort} (${shortNodeId})`);
                                    
                                    textQuestions.push({
                                        questionId: questionId,
                                        nodeId: shortNodeId,
                                        questionText: questionTextWithShort
                                    });
                                }
                            }
                        } else {
                            console.log(`❌ [DEBUG] Field ${fieldIndex} missing spans - fieldLabelSpan: ${!!fieldLabelSpan}, fieldNodeIdSpan: ${!!fieldNodeIdSpan}`);
                        }
                    } else {
                        console.log(`❌ [DEBUG] Field ${fieldIndex} doesn't meet criteria - fieldType: ${fieldType}`);
                    }
                });
            } else {
                console.log(`❌ [DEBUG] No unifiedFieldsContainer found for question ${questionId}`);
            }
        }
    });
    
    console.log('🔍 [DEBUG] Final textQuestions array:', textQuestions);
    
    // Add options to dropdown
    textQuestions.forEach(question => {
        const option = document.createElement('option');
        option.value = question.nodeId;
        // Remove "Question X -" prefix and just show the field name
        const displayText = question.questionText.replace(/^Question \d+ - /, '');
        option.textContent = `${displayText} (${question.nodeId})`;
        select.appendChild(option);
        console.log(`✅ [DEBUG] Added option: ${option.textContent}`);
    });
    
    console.log(`✅ [DEBUG] Total options added: ${textQuestions.length}`);
    
    // Add change event listener
    select.addEventListener('change', function() {
        currentLinkedFieldConfig[dropdownIndex].selectedValue = this.value;
    });
    
    // Initialize search functionality
    initializeLinkedFieldSearch(dropdownIndex);
}

// Remove a linked field dropdown
function removeLinkedFieldDropdown(dropdownIndex) {
    const dropdownDiv = document.getElementById(`linkedFieldDropdown${dropdownIndex}`);
    if (dropdownDiv) {
        dropdownDiv.remove();
        
        // Remove from current configuration
        currentLinkedFieldConfig = currentLinkedFieldConfig.filter(config => config.index !== dropdownIndex);
        
        // Renumber remaining dropdowns
        renumberLinkedFieldDropdowns();
    }
}

// Renumber linked field dropdowns after removal
function renumberLinkedFieldDropdowns() {
    const dropdownsContainer = document.getElementById('linkedFieldDropdowns');
    const dropdowns = dropdownsContainer.querySelectorAll('[id^="linkedFieldDropdown"]');
    
    dropdowns.forEach((dropdown, newIndex) => {
        const oldId = dropdown.id;
        const newId = `linkedFieldDropdown${newIndex}`;
        
        // Update ID
        dropdown.id = newId;
        
        // Update label
        const label = dropdown.querySelector('label');
        if (label) {
            label.textContent = `Text Question ${newIndex + 1}:`;
        }
        
        // Update select ID and event listener
        const select = dropdown.querySelector('select');
        if (select) {
            const oldSelectId = select.id;
            const newSelectId = `linkedFieldSelect${newIndex}`;
            select.id = newSelectId;
            
            // Remove old event listener and add new one
            select.removeEventListener('change', select._changeHandler);
            select._changeHandler = function() {
                currentLinkedFieldConfig[newIndex].selectedValue = this.value;
            };
            select.addEventListener('change', select._changeHandler);
        }
        
        // Update delete button
        const deleteButton = dropdown.querySelector('button');
        if (deleteButton) {
            deleteButton.onclick = new Function(`removeLinkedFieldDropdown(${newIndex})`);
        }
        
        // Update configuration index
        const configIndex = currentLinkedFieldConfig.findIndex(config => config.index === parseInt(oldId.replace('linkedFieldDropdown', '')));
        if (configIndex !== -1) {
            currentLinkedFieldConfig[configIndex].index = newIndex;
        }
    });
}

// Finalize the linked field configuration
function finalizeLinkedField() {
    // Validate that at least 2 fields are selected
    const selectedFields = currentLinkedFieldConfig.filter(config => config.selectedValue);
    if (selectedFields.length < 2) {
        alert('Please select at least 2 text questions to link.');
        return;
    }
    
    // Get the linked field ID
    const linkedFieldIdInput = document.getElementById('linkedFieldIdInput');
    const linkedFieldId = linkedFieldIdInput ? linkedFieldIdInput.value.trim() : '';
    
    if (!linkedFieldId) {
        alert('Please enter a Linked Field ID.');
        return;
    }
    
    // Check if we're editing an existing linked field
    if (window.editingLinkedFieldId) {
        console.log('🔍 [DEBUG] Editing existing linked field:', window.editingLinkedFieldId);
        
        // Remove the old display
        removeLinkedFieldDisplay(window.editingLinkedFieldId);
        
        // Create the new linked field display
        createLinkedFieldDisplay(selectedFields, linkedFieldId);
        
        // Clear the editing flag
        window.editingLinkedFieldId = null;
    } else {
        console.log('🔍 [DEBUG] Creating new linked field');
        
        // Create the linked field display
        createLinkedFieldDisplay(selectedFields, linkedFieldId);
    }
    
    // Store the configuration for future autofill
    window.lastLinkedFieldConfig = {
        linkedFieldId: linkedFieldId,
        selectedFields: selectedFields.map(field => field.selectedValue)
    };
    
    // Close modal
    closeLinkedFieldModal();
}

// Create the linked field display
function createLinkedFieldDisplay(selectedFields, linkedFieldId) {
    const displayId = `linkedField${linkedFieldCounter++}`;
    
    // Create container for linked fields if it doesn't exist
    let linkedFieldsContainer = document.getElementById('linkedFieldsContainer');
    if (!linkedFieldsContainer) {
        linkedFieldsContainer = document.createElement('div');
        linkedFieldsContainer.id = 'linkedFieldsContainer';
        linkedFieldsContainer.style.cssText = `
            background: #fff;
            border: 2px solid #27ae60;
            border-radius: 10px;
            padding: 20px;
            margin: 20px auto;
            max-width: 600px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;
        
        // Insert before the Form Editor section
        const formBuilder = document.getElementById('formBuilder');
        if (formBuilder) {
            formBuilder.insertBefore(linkedFieldsContainer, formBuilder.firstChild);
        }
    }
    
    // Create linked field display
    const linkedFieldDiv = document.createElement('div');
    linkedFieldDiv.id = displayId;
    linkedFieldDiv.style.cssText = `
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 15px;
        margin-bottom: 15px;
        background-color: #f9f9f9;
        transition: all 0.2s ease;
    `;
    
    // Add hover effect
    linkedFieldDiv.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#f0f0f0';
        this.style.borderColor = '#27ae60';
        this.style.transform = 'translateY(-1px)';
        this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
    
    linkedFieldDiv.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '#f9f9f9';
        this.style.borderColor = '#ddd';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
    });
    
    const fieldNames = selectedFields.map(config => config.selectedValue).join(' ↔ ');
    
    linkedFieldDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div onclick="editLinkedFieldDisplay('${displayId}')" style="cursor: pointer; flex: 1;">
                <h4 style="margin: 0 0 5px 0; color: #2c3e50;">Linked Fields (${linkedFieldId})</h4>
                <p style="margin: 0; color: #666; font-size: 0.9em;">${fieldNames}</p>
            </div>
            <button type="button" onclick="removeLinkedFieldDisplay('${displayId}')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                Remove
            </button>
        </div>
    `;
    
    linkedFieldsContainer.appendChild(linkedFieldDiv);
    
    // Store the configuration
    window.linkedFieldsConfig = window.linkedFieldsConfig || [];
    window.linkedFieldsConfig.push({
        id: displayId,
        linkedFieldId: linkedFieldId,
        fields: selectedFields.map(config => config.selectedValue)
    });
}

// Remove a linked field display
function removeLinkedFieldDisplay(linkedFieldId) {
    const linkedFieldDiv = document.getElementById(linkedFieldId);
    if (linkedFieldDiv) {
        linkedFieldDiv.remove();
        
        // Remove from configuration
        if (window.linkedFieldsConfig) {
            window.linkedFieldsConfig = window.linkedFieldsConfig.filter(config => config.id !== linkedFieldId);
        }
        
        // If no more linked fields, remove the container
        const linkedFieldsContainer = document.getElementById('linkedFieldsContainer');
        if (linkedFieldsContainer && linkedFieldsContainer.children.length === 0) {
            linkedFieldsContainer.remove();
        }
    }
}

// Edit a linked field display
function editLinkedFieldDisplay(displayId) {
    console.log('🔍 [DEBUG] editLinkedFieldDisplay called with displayId:', displayId);
    
    // Find the configuration for this display
    const config = window.linkedFieldsConfig.find(c => c.id === displayId);
    if (!config) {
        console.log('❌ [DEBUG] Configuration not found for displayId:', displayId);
        return;
    }
    
    console.log('✅ [DEBUG] Found configuration:', config);
    
    // Store the display ID we're editing
    window.editingLinkedFieldId = displayId;
    
    // Clear any stored configuration since we're editing
    window.lastLinkedFieldConfig = null;
    
    // Create modal if it doesn't exist
    if (!document.getElementById('linkedFieldModal')) {
        console.log('🔍 [DEBUG] Creating linked field modal');
        createLinkedFieldModal();
    }
    
    // Reset current configuration
    currentLinkedFieldConfig = [];
    
    // Pre-populate the modal with existing data
    const linkedFieldIdInput = document.getElementById('linkedFieldIdInput');
    if (linkedFieldIdInput) {
        linkedFieldIdInput.value = config.linkedFieldId || '';
    }
    
    // Create dropdowns for each field
    config.fields.forEach(fieldId => {
        addLinkedFieldDropdown();
        const dropdownIndex = currentLinkedFieldConfig.length - 1;
        const select = document.getElementById(`linkedFieldSelect${dropdownIndex}`);
        const searchInput = document.getElementById(`linkedFieldSearch${dropdownIndex}`);
        
        if (select) {
            select.value = fieldId;
            currentLinkedFieldConfig[dropdownIndex].selectedValue = fieldId;
            
            // Also update the search input field with the selected option text
            if (searchInput) {
                const selectedOption = select.querySelector(`option[value="${fieldId}"]`);
                if (selectedOption) {
                    searchInput.value = selectedOption.textContent;
                }
            }
        }
    });
    
    // Show modal
    document.getElementById('linkedFieldModal').style.display = 'block';
    console.log('🔍 [DEBUG] Modal displayed for editing');
}

// Close the linked field modal
function closeLinkedFieldModal() {
    document.getElementById('linkedFieldModal').style.display = 'none';
    
    // Clear current configuration
    currentLinkedFieldConfig = [];
    
    // Clear dropdowns
    const dropdownsContainer = document.getElementById('linkedFieldDropdowns');
    if (dropdownsContainer) {
        dropdownsContainer.innerHTML = '';
    }
    
    // Clear linked field ID input
    const linkedFieldIdInput = document.getElementById('linkedFieldIdInput');
    if (linkedFieldIdInput) {
        linkedFieldIdInput.value = '';
    }
    
    // Clear the editing flag
    window.editingLinkedFieldId = null;
}

// Create linked field display from import data
function createLinkedFieldDisplayFromImport(linkedFieldData) {
    const displayId = `linkedField${linkedFieldCounter++}`;
    const linkedFieldId = linkedFieldData.linkedFieldId || 'Unknown';
    
    // Create container for linked fields if it doesn't exist
    let linkedFieldsContainer = document.getElementById('linkedFieldsContainer');
    if (!linkedFieldsContainer) {
        linkedFieldsContainer = document.createElement('div');
        linkedFieldsContainer.id = 'linkedFieldsContainer';
        linkedFieldsContainer.style.cssText = `
            background: #fff;
            border: 2px solid #27ae60;
            border-radius: 10px;
            padding: 20px;
            margin: 20px auto;
            max-width: 600px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;
        
        // Insert before the Form Editor section
        const formBuilder = document.getElementById('formBuilder');
        if (formBuilder) {
            formBuilder.insertBefore(linkedFieldsContainer, formBuilder.firstChild);
        }
    }
    
    // Create linked field display
    const linkedFieldDiv = document.createElement('div');
    linkedFieldDiv.id = displayId;
    linkedFieldDiv.style.cssText = `
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 15px;
        margin-bottom: 15px;
        background-color: #f9f9f9;
        transition: all 0.2s ease;
    `;
    
    // Add hover effect
    linkedFieldDiv.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#f0f0f0';
        this.style.borderColor = '#27ae60';
        this.style.transform = 'translateY(-1px)';
        this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
    
    linkedFieldDiv.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '#f9f9f9';
        this.style.borderColor = '#ddd';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
    });
    
    const fieldNames = linkedFieldData.fields.join(' ↔ ');
    
    linkedFieldDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div onclick="editLinkedFieldDisplay('${displayId}')" style="cursor: pointer; flex: 1;">
                <h4 style="margin: 0 0 5px 0; color: #2c3e50;">Linked Fields (${linkedFieldId})</h4>
                <p style="margin: 0; color: #666; font-size: 0.9em;">${fieldNames}</p>
            </div>
            <button type="button" onclick="removeLinkedFieldDisplay('${displayId}')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                Remove
            </button>
        </div>
    `;
    
    linkedFieldsContainer.appendChild(linkedFieldDiv);
    
    // Store the configuration
    window.linkedFieldsConfig = window.linkedFieldsConfig || [];
    window.linkedFieldsConfig.push({
        id: displayId,
        linkedFieldId: linkedFieldId,
        fields: linkedFieldData.fields
    });
}

// Search functionality for linked field dropdowns
function filterLinkedFieldOptions(dropdownIndex) {
    const searchInput = document.getElementById(`linkedFieldSearch${dropdownIndex}`);
    const optionsContainer = document.getElementById(`linkedFieldOptions${dropdownIndex}`);
    const selectElement = document.getElementById(`linkedFieldSelect${dropdownIndex}`);
    const searchTerm = searchInput.value.toLowerCase();
    
    // Clear previous options
    optionsContainer.innerHTML = '';
    
    // Get all options from the select element
    const options = Array.from(selectElement.options).filter(option => option.value !== '');
    
    // Smart search function that converts natural language to snake_case for matching
    function smartSearch(searchTerm, optionText) {
        const lowerOptionText = optionText.toLowerCase();
        
        // Direct text match
        if (lowerOptionText.includes(searchTerm)) {
            return true;
        }
        
        // Convert search term to snake_case pattern
        const snakeCasePattern = searchTerm.replace(/\s+/g, '_');
        if (lowerOptionText.includes(snakeCasePattern)) {
            return true;
        }
        
        // Convert search term to camelCase pattern
        const camelCasePattern = searchTerm.replace(/\s+(\w)/g, (match, letter) => letter.toUpperCase());
        if (lowerOptionText.includes(camelCasePattern)) {
            return true;
        }
        
        // Split search term into words and check if all words appear
        const searchWords = searchTerm.split(/\s+/);
        const allWordsMatch = searchWords.every(word => 
            lowerOptionText.includes(word) || 
            lowerOptionText.includes(word.replace(/\s+/g, '_'))
        );
        
        return allWordsMatch;
    }
    
    // Filter options based on smart search
    const filteredOptions = options.filter(option => 
        smartSearch(searchTerm, option.textContent)
    );
    
    // Display filtered options
    if (filteredOptions.length > 0) {
        optionsContainer.style.display = 'block';
        filteredOptions.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'linked-field-option';
            optionDiv.style.cssText = 'padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background-color 0.2s; white-space: nowrap; overflow: visible;';
            optionDiv.textContent = option.textContent;
            optionDiv.onmouseover = function() { this.style.backgroundColor = '#f8f9fa'; };
            optionDiv.onmouseout = function() { this.style.backgroundColor = 'white'; };
            optionDiv.onclick = function() {
                selectLinkedFieldOption(dropdownIndex, option.value, option.textContent);
            };
            optionsContainer.appendChild(optionDiv);
        });
    } else {
        optionsContainer.style.display = 'none';
    }
}

function showLinkedFieldOptions(dropdownIndex) {
    const optionsContainer = document.getElementById(`linkedFieldOptions${dropdownIndex}`);
    const searchInput = document.getElementById(`linkedFieldSearch${dropdownIndex}`);
    
    // If search input is empty, show all options
    if (searchInput.value === '') {
        filterLinkedFieldOptions(dropdownIndex);
    }
}

function hideLinkedFieldOptions(dropdownIndex) {
    // Add a small delay to allow clicks on options to register
    setTimeout(() => {
        const optionsContainer = document.getElementById(`linkedFieldOptions${dropdownIndex}`);
        optionsContainer.style.display = 'none';
    }, 200);
}

function selectLinkedFieldOption(dropdownIndex, value, text) {
    const searchInput = document.getElementById(`linkedFieldSearch${dropdownIndex}`);
    const selectElement = document.getElementById(`linkedFieldSelect${dropdownIndex}`);
    const optionsContainer = document.getElementById(`linkedFieldOptions${dropdownIndex}`);
    
    // Update search input with selected text
    searchInput.value = text;
    
    // Update hidden select element
    selectElement.value = value;
    
    // Hide options
    optionsContainer.style.display = 'none';
    
    // Update the current configuration
    if (currentLinkedFieldConfig[dropdownIndex]) {
        currentLinkedFieldConfig[dropdownIndex].selectedValue = value;
    }
    
    console.log(`🔍 [DEBUG] Selected linked field option: ${text} (${value}) for dropdown ${dropdownIndex}`);
}

// Initialize search functionality for a linked field dropdown
function initializeLinkedFieldSearch(dropdownIndex) {
    const searchInput = document.getElementById(`linkedFieldSearch${dropdownIndex}`);
    if (!searchInput) return;
    
    // Add keyboard navigation support
    searchInput.addEventListener('keydown', function(e) {
        const optionsContainer = document.getElementById(`linkedFieldOptions${dropdownIndex}`);
        const options = optionsContainer.querySelectorAll('.linked-field-option');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const currentActive = optionsContainer.querySelector('.linked-field-option.active');
            if (currentActive) {
                currentActive.classList.remove('active');
                const next = currentActive.nextElementSibling;
                if (next) {
                    next.classList.add('active');
                    next.scrollIntoView({ block: 'nearest' });
                }
            } else if (options.length > 0) {
                options[0].classList.add('active');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentActive = optionsContainer.querySelector('.linked-field-option.active');
            if (currentActive) {
                currentActive.classList.remove('active');
                const prev = currentActive.previousElementSibling;
                if (prev) {
                    prev.classList.add('active');
                    prev.scrollIntoView({ block: 'nearest' });
                }
            } else if (options.length > 0) {
                options[options.length - 1].classList.add('active');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const activeOption = optionsContainer.querySelector('.linked-field-option.active');
            if (activeOption) {
                activeOption.click();
            }
        } else if (e.key === 'Escape') {
            optionsContainer.style.display = 'none';
            searchInput.blur();
        }
    });
}