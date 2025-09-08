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
    const sectionBlock = document.createElement('div');

    // Use provided sectionId or default to sectionCounter
    const currentSectionId = sectionId || sectionCounter;

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

        <!-- Numbered Dropdown Options -->
        <div id="numberedDropdownBlock${currentQuestionId}" class="numbered-dropdown-options" style="display: none;">
            <label>Number Range: </label>
            <input type="number" id="numberRangeStart${currentQuestionId}" placeholder="Start" min="1" style="width: 60px;" onchange="updateNumberedDropdownEvents(${currentQuestionId})">
            <input type="number" id="numberRangeEnd${currentQuestionId}" placeholder="End" min="1" style="width: 60px;" onchange="updateNumberedDropdownEvents(${currentQuestionId})"><br><br>

            <label>Textbox Labels:</label>
            <div id="textboxLabels${currentQuestionId}"></div>
            <button type="button" onclick="addTextboxLabel(${currentQuestionId})">Add Label</button>
            
            <br><br>
            
            <label>Amount Labels:</label>
            <div id="textboxAmounts${currentQuestionId}"></div>
            <button type="button" onclick="addTextboxAmount(${currentQuestionId})">Add Amount</button>
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
        </div><br>
        
        <!-- Multiple Textboxes Options -->
        <div id="multipleTextboxesOptionsBlock${currentQuestionId}" class="multiple-textboxes-options" style="display: none;">
            <label>Textboxes: </label>
            <div id="multipleTextboxesOptions${currentQuestionId}"></div>
            <button type="button" onclick="addMultipleTextboxOption(${currentQuestionId})">Add Textbox</button>
            <button type="button" onclick="addMultipleAmountOption(${currentQuestionId})">Add Amount</button>
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
            <label>Additional PDF to download:</label>
            <input type="text" id="pdfLogicPdfName${currentQuestionId}" placeholder="Enter PDF name (e.g., additional_form.pdf)">
            <br><br>
            <label>Choose your Price ID:</label>
            <input type="text" id="pdfLogicStripePriceId${currentQuestionId}" placeholder="Enter Stripe Price ID (e.g., price_12345)">
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
    const dropdownImageBlock = document.getElementById(`dropdownImageBlock${questionId}`);
    const linkingLogicBlock = document.getElementById(`linkingLogicBlock${questionId}`);

    // Reset all blocks
    textboxOptionsBlock.style.display = 'none';
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
        case 'bigParagraph':
        case 'date':
        case 'dateRange':
            textboxOptionsBlock.style.display = 'block';
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
            break;

        case 'numberedDropdown':
            numberedDropdownBlock.style.display = 'block';
            // Update jump options for numbered dropdown
            const jumpConditions = document.querySelectorAll(`#jumpConditions${questionId} .jump-condition`);
            jumpConditions.forEach(condition => {
                const conditionId = condition.id.split('_')[1];
                updateJumpOptionsForNumberedDropdown(questionId, conditionId);
            });
            break;

        case 'money':
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

// PDF Logic toggling
function togglePdfLogic(questionId) {
    const pdfLogicEnabled = document.getElementById(`pdfLogic${questionId}`).checked;
    const pdfLogicBlock = document.getElementById(`pdfLogicBlock${questionId}`);
    pdfLogicBlock.style.display = pdfLogicEnabled ? 'block' : 'none';
    
    // If enabling PDF logic for a Big Paragraph question, clear any existing conditions
    if (pdfLogicEnabled) {
        const questionBlock = document.getElementById(`questionBlock${questionId}`);
        const questionTypeSelect = questionBlock.querySelector(`#questionType${questionId}`);
        const questionType = questionTypeSelect ? questionTypeSelect.value : '';
        
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
    });

    // Update all existing jump conditions
    updateJumpOptions(questionId);
    
    // Update all checklist logic dropdowns
    updateAllChecklistLogicDropdowns();
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
    const textboxAmountsDiv = document.getElementById(`textboxAmounts${questionId}`);
    const amountCount = textboxAmountsDiv.children.length + 1;

    const amountDiv = document.createElement('div');
    amountDiv.className = `amount${amountCount}`;
    amountDiv.innerHTML = `
        <input type="text" id="amount${questionId}_${amountCount}" 
               placeholder="Amount ${amountCount} (placeholder text)">
        <button type="button" onclick="removeTextboxAmount(${questionId}, ${amountCount})">Remove</button>
    `;
    textboxAmountsDiv.appendChild(amountDiv);
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
}



function addTextboxLabel(questionId) {
    const textboxLabelsDiv = document.getElementById(`textboxLabels${questionId}`);
    const labelCount = textboxLabelsDiv.children.length + 1;

    const labelDiv = document.createElement('div');
    labelDiv.className = `label${labelCount}`;
    labelDiv.innerHTML = `
        <input type="text" id="label${questionId}_${labelCount}" placeholder="Label ${labelCount}">
        <button type="button" onclick="removeTextboxLabel(${questionId}, ${labelCount})">Remove</button>
    `;
    textboxLabelsDiv.appendChild(labelDiv);
}

function removeTextboxLabel(questionId, labelNumber) {
    const labelDiv = document.querySelector(`#textboxLabels${questionId} .label${labelNumber}`);
    if (labelDiv) {
        labelDiv.remove();
        const labels = document.querySelectorAll(`#textboxLabels${questionId} > div`);
        labels.forEach((lbl, idx) => {
            const newLabelNumber = idx + 1;
            lbl.className = `label${newLabelNumber}`;
            const inp = lbl.querySelector('input');
            inp.id = `label${questionId}_${newLabelNumber}`;
            inp.placeholder = `Label ${newLabelNumber}`;
            const btn = lbl.querySelector('button');
            btn.setAttribute('onclick', `removeTextboxLabel(${questionId}, ${newLabelNumber})`);
        });
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