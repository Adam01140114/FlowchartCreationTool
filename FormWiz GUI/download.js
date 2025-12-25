/********************************************
 * download.js - MULTIPLE OR CONDITIONS
 *   WITH multi-term hidden-field calculations
 *   export/import logic (for both checkbox and text)
 ********************************************/
/**
 * Helper function to find checkbox options for a given question ID
 */
function findCheckboxOptionsByQuestionId(questionId) {
    // Get all sections
    for (let s = 1; s < sectionCounter; s++) {
        const sectionBlock = document.getElementById(`sectionBlock${s}`);
        if (!sectionBlock) continue;
        // Get all questions in this section
        const questionsSection = sectionBlock.querySelectorAll('.question-block');
        for (const questionBlock of questionsSection) {
            const qId = parseInt(questionBlock.id.replace('questionBlock', ''), 10);
            if (qId !== parseInt(questionId, 10)) continue;
            const qType = questionBlock.querySelector(`#questionType${qId}`).value;
            if (qType !== 'checkbox') return null;
            // Found the checkbox question, extract options
            const options = [];
            const optionsDivs = questionBlock.querySelectorAll(`#checkboxOptions${qId} > div`);
            optionsDivs.forEach((optionDiv, index) => {
                const optTextEl = optionDiv.querySelector(`#checkboxOptionText${qId}_${index + 1}`);
                const optNameEl = optionDiv.querySelector(`#checkboxOptionName${qId}_${index + 1}`);
                const hasAmountEl = optionDiv.querySelector(`#checkboxOptionHasAmount${qId}_${index + 1}`);
                const amountNameEl = optionDiv.querySelector(`#checkboxOptionAmountName${qId}_${index + 1}`);
                const optText = optTextEl ? optTextEl.value.trim() : `Option ${index + 1}`;
                const optNameId = optNameEl ? optNameEl.value.trim() : `answer${qId}_${index + 1}`;
                const hasAmount = hasAmountEl ? hasAmountEl.checked : false;
                // For the amount field, use the nameId directly or generate it based on the label
                let amountName = '';
                if (hasAmount) {
                    if (amountNameEl && amountNameEl.value.trim()) {
                        amountName = amountNameEl.value.trim();
                    } else {
                        // The default format if no amount name is specified
                        amountName = `${optNameId}_amount`;
                    }
                }
                options.push({
                    label: optText,
                    nameId: optNameId,
                    hasAmount: hasAmount,
                    amountName: amountName
                });
            });
            return options;
        }
    }
    return null;
}
function generateAndDownloadForm() {

    try {

    const formHTML = getFormHTML();

    navigator.clipboard.writeText(formHTML).then(() => {
        alert("HTML code has been copied to the clipboard.");
    });
    downloadHTML(formHTML, "custom_form.html");
    } catch (error) {

        alert('Error generating form: ' + error.message);
    }
}
function showPreview() {

    // Check if the getFormHTML function exists
    if (typeof getFormHTML !== 'function') {

        alert("Preview function not available in this context. Please try again from the form editor.");
        return;
    }

    let formHTML;
    try {

        formHTML = getFormHTML();

    } catch (error) {

        alert('Error generating form HTML: ' + error.message);
        return;
    }
    if (!formHTML || formHTML.trim() === '') {

        alert('No form content to preview. Please add some questions first.');
        return;
    }
    // Check if the HTML contains actual form content (not just the basic structure)
    if (!formHTML.includes('customForm') || !formHTML.includes('question')) {

        alert('Form appears to be empty. Please add some questions first.');
        return;
    }
    // Copy HTML to clipboard automatically when previewing
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(formHTML).then(() => {
            // Show a brief notification that it was copied
            const previewButton = document.getElementById('previewButton');
            if (previewButton) {
                const originalText = previewButton.textContent;
                previewButton.textContent = 'Copied to clipboard!';
                previewButton.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    previewButton.textContent = originalText;
                    previewButton.style.backgroundColor = '';
                }, 2000);
            }
        }).catch(err => {

        });
    }

    const previewModal = document.getElementById('previewModal');
    const previewFrame = document.getElementById('previewFrame');

    if (!previewModal || !previewFrame) {

        alert('Preview modal elements not found. Please refresh the page and try again.');
        return;
    }

    previewFrame.srcdoc = formHTML;
    previewModal.style.display = 'flex';
    previewModal.style.zIndex = '9999';

    // Force a reflow to ensure the modal is visible
    previewModal.offsetHeight;
}
function downloadHTML(content, filename) {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
// ============================================
// ===========  IMPORT / EXPORT  =============
// ============================================
function loadFormData(formData) {
    // 1) Clear the entire "formBuilder" container
    document.getElementById('formBuilder').innerHTML = '';
    // 2) Reset counters based on what's stored in the JSON
    sectionCounter = formData.sectionCounter || 1;
    questionCounter = formData.questionCounter || 1;
    hiddenFieldCounter = formData.hiddenFieldCounter || 1;
    groupCounter = formData.groupCounter || 1;
    // 3) Set form name and other form settings
    if (formData.formName) {
        // Ensure the form name module exists
        if (!document.getElementById('formNameContainer')) {
            if (typeof addFormNameModule === 'function') {
                addFormNameModule();
            }
        }
        const formNameInput = document.getElementById('formNameInput');
        if (formNameInput) {
            formNameInput.value = formData.formName;
        }
    }
    // Ensure the PDF configuration module exists
    if (!document.getElementById('pdfConfigurationModule')) {
        if (typeof createPdfConfigurationModule === 'function') {
            createPdfConfigurationModule();
        }
    }
    // Set PDF name
    if (formData.defaultPDFName) {
        const formPDFNameInput = document.getElementById('formPDFName');
        if (formPDFNameInput) {
            formPDFNameInput.value = formData.defaultPDFName;
        }
    }
    // Set PDF output name
    if (formData.pdfOutputName) {
        const pdfOutputNameInput = document.getElementById('pdfOutputName');
        if (pdfOutputNameInput) {
            pdfOutputNameInput.value = formData.pdfOutputName;
        }
    }
    // Set Stripe Price ID
    if (formData.stripePriceId) {
        const stripePriceIdInput = document.getElementById('stripePriceId');
        if (stripePriceIdInput) {
            stripePriceIdInput.value = formData.stripePriceId;
        }
    }
    // 3.1) Load additional PDFs if present
    if (formData.additionalPDFs && formData.additionalPDFs.length > 0) {
        // Clear existing additional PDF inputs first (except the main one)
        const pdfContainer = document.getElementById('pdfContainer');
        const existingPdfGroups = pdfContainer.querySelectorAll('.pdf-input-group');
        for (let i = 1; i < existingPdfGroups.length; i++) {
            existingPdfGroups[i].remove();
        }
        // Add PDF inputs for each additional PDF
        formData.additionalPDFs.forEach((pdfName, index) => {
            const pdfId = index + 1; // Start from 1 since 0 is the main PDF
            const pdfGroup = document.createElement('div');
            pdfGroup.className = 'pdf-input-group';
            pdfGroup.id = `pdfGroup_${pdfId}`;
            pdfGroup.innerHTML = `
                <label>Additional PDF File:</label>
                <input type="text" id="additionalPdfName_${pdfId}" value="${pdfName}" placeholder="Enter PDF form name (e.g., sc100.pdf)">
                <button type="button" onclick="removePdfInput(${pdfId})">Delete</button>
            `;
            pdfContainer.appendChild(pdfGroup);
        });
    }
    // 4) Initialize hidden-fields module (if your GUI uses it)
    initializeHiddenPDFFieldsModule();
    // Create a mapping of question text to question ID for reference transformations
    const questionTextToIdMap = {};
    // 5) Build out sections and questions
    if (formData.sections) {
        formData.sections.forEach(section => {
            // A) Create the section in the UI
            addSection(section.sectionId);
            // B) Set the name of the section
            const sectionNameInput = document.getElementById(`sectionName${section.sectionId}`);
            if (sectionNameInput) {
                sectionNameInput.value = section.sectionName || `Section ${section.sectionId}`;
                updateSectionName(section.sectionId);
            }
            // C) Add questions inside this section
            (section.questions || []).forEach(question => {
                // Store mapping of question text to ID
                questionTextToIdMap[question.text] = question.questionId;
                // Create the question in the GUI
                addQuestion(section.sectionId, question.questionId);
                const questionBlock = document.getElementById(`questionBlock${question.questionId}`);
                if (!questionBlock) return;
                // -- Set question text and type --
                const questionInput = questionBlock.querySelector(`#question${question.questionId}`);
                if (questionInput) {
                    questionInput.value = question.text;
                }
                const questionTypeSelect = questionBlock.querySelector(`#questionType${question.questionId}`);
                if (questionTypeSelect) {
                    questionTypeSelect.value = question.type;
                    toggleOptions(question.questionId);
                }
                // -- Restore subtitle if present --
                if (question.subtitle && question.subtitle.enabled) {
                    const subtitleCheckbox = questionBlock.querySelector(`#enableSubtitle${question.questionId}`);
                    const subtitleTextInput = questionBlock.querySelector(`#subtitleText${question.questionId}`);
                    if (subtitleCheckbox) {
                        subtitleCheckbox.checked = true;
                        toggleSubtitle(question.questionId);
                        if (subtitleTextInput && question.subtitle.text) {
                            subtitleTextInput.value = question.subtitle.text;
                        }
                    }
                }
                // -- Restore info box if present --
                if (question.infoBox && question.infoBox.enabled) {
                    const infoBoxCheckbox = questionBlock.querySelector(`#enableInfoBox${question.questionId}`);
                    const infoBoxTextArea = questionBlock.querySelector(`#infoBoxText${question.questionId}`);
                    if (infoBoxCheckbox) {
                        infoBoxCheckbox.checked = true;
                        toggleInfoBox(question.questionId);
                        if (infoBoxTextArea && question.infoBox.text) {
                            infoBoxTextArea.value = question.infoBox.text;
                        }
                    }
                }
                // -----------------------------
                // Question-type-specific rebuild
                // -----------------------------
                // In the checkbox section of loadFormData()
                if (question.type === 'checkbox') {
                    // Rebuild checkbox options
                    const checkboxOptionsDiv = questionBlock.querySelector(`#checkboxOptions${question.questionId}`);
                    if (checkboxOptionsDiv) {
                        checkboxOptionsDiv.innerHTML = '';
                        // Check if we have a "None of the above" option that needs special handling
                        let hasNoneOption = false;
                        let noneOfTheAboveOption = null;
                        for (const optData of (question.options || [])) {
                            if (optData.label === "None of the above" || optData.nameId.endsWith("_none")) {
                                hasNoneOption = true;
                                noneOfTheAboveOption = optData;
                                break;
                            }
                        }
                        // Add regular options (excluding "None of the above")
                        let regularOptions = question.options || [];
                        if (hasNoneOption) {
                            regularOptions = regularOptions.filter(opt => 
                                opt.label !== "None of the above" && !opt.nameId.endsWith("_none"));
                        }
                        regularOptions.forEach((optData, idx) => {
                            const optionDiv = document.createElement('div');
                            optionDiv.className = `option${idx + 1}`;
                            optionDiv.innerHTML = `
                                <label>Option ${idx + 1} Text:</label>
                                <input type="text" id="checkboxOptionText${question.questionId}_${idx + 1}"
                                       value="${optData.label}" placeholder="Enter option text"><br><br>
                                <label>Name/ID:</label>
                                <input type="text" id="checkboxOptionName${question.questionId}_${idx + 1}"
                                       value="${optData.nameId}" placeholder="Enter Name/ID"><br><br>
                                <label>Value (optional):</label>
                                <input type="text" id="checkboxOptionValue${question.questionId}_${idx + 1}"
                                       value="${optData.value || ''}" placeholder="Enter Value"><br><br>
                                <label>
                                    <input type="checkbox" id="checkboxOptionHasAmount${question.questionId}_${idx + 1}" 
                                           ${optData.hasAmount ? 'checked' : ''}
                                           onchange="toggleAmountPlaceholder(${question.questionId}, ${idx + 1})">
                                    Enable amount field
                                </label>
                                <div id="checkboxOptionAmountDetails${question.questionId}_${idx + 1}" 
                                     style="display:${optData.hasAmount ? 'block' : 'none'}; margin-top:8px;">
                                    <label>Amount Field Name:</label>
                                    <input type="text" id="checkboxOptionAmountName${question.questionId}_${idx + 1}"
                                           value="${optData.amountName || ''}" placeholder="Enter amount field name"><br><br>
                                    <label>Amount Placeholder:</label>
                                    <input type="text" id="checkboxOptionAmountPlaceholder${question.questionId}_${idx + 1}"
                                           value="${optData.amountPlaceholder || ''}" placeholder="Enter amount placeholder"><br>
                                </div>
                                <button type="button"
                                        onclick="removeCheckboxOption(${question.questionId}, ${idx + 1})">
                                    Remove
                                </button>
                                <hr>
                            `;
                            checkboxOptionsDiv.appendChild(optionDiv);
                        });
                        // Restore required/optional select (defaults to required)
                        const requiredSelect = questionBlock.querySelector(`[id^="checkboxRequired${question.questionId}_"]`);
                        if (requiredSelect) {
                            const isOptional = (question.required === false) || (question.required === 'optional');
                            requiredSelect.value = isOptional ? 'optional' : 'required';
                        }
                        // Add the "None of the above" checkbox if it exists in the data
                        if (hasNoneOption) {
                            // Find the container for the "None of the above" option
                            let noneContainer = document.createElement('div');
                            noneContainer.id = `noneOfTheAboveContainer${question.questionId}`;
                            noneContainer.style.marginTop = '10px';
                            noneContainer.style.marginBottom = '10px';
                            noneContainer.innerHTML = `
                                <label>
                                    <input type="checkbox" id="noneOfTheAbove${question.questionId}" checked>
                                    Include "None of the above" option
                                </label>
                            `;
                            // Add it right after the options div
                            if (checkboxOptionsDiv.nextSibling) {
                                checkboxOptionsDiv.parentNode.insertBefore(noneContainer, checkboxOptionsDiv.nextSibling);
                            } else {
                                checkboxOptionsDiv.parentNode.appendChild(noneContainer);
                            }
                        }
                        // Add the "Mark only one" checkbox if it exists in the data
                        if (question.markOnlyOne) {
                            // Find the container for the "Mark only one" option
                            let markOnlyOneContainer = document.createElement('div');
                            markOnlyOneContainer.id = `markOnlyOneContainer${question.questionId}`;
                            markOnlyOneContainer.style.marginTop = '10px';
                            markOnlyOneContainer.style.marginBottom = '10px';
                            markOnlyOneContainer.innerHTML = `
                                <label>
                                    <input type="checkbox" id="markOnlyOne${question.questionId}" checked>
                                    Mark only one
                                </label>
                            `;
                            // Add it right after the options div (or after the "None of the above" container if it exists)
                            const insertAfter = hasNoneOption ? 
                                document.getElementById(`noneOfTheAboveContainer${question.questionId}`) :
                                checkboxOptionsDiv;
                            if (insertAfter.nextSibling) {
                                insertAfter.parentNode.insertBefore(markOnlyOneContainer, insertAfter.nextSibling);
                            } else {
                                insertAfter.parentNode.appendChild(markOnlyOneContainer);
                            }
                        }
                        // Update conditional PDF answers for checkbox
                        updateConditionalPDFAnswersForCheckbox(question.questionId);
                    }
                }
                else if (question.type === 'dropdown') {
                    // Rebuild dropdown options
                    const dropdownOptionsDiv = questionBlock.querySelector(`#dropdownOptions${question.questionId}`);
                    if (dropdownOptionsDiv) {
                        dropdownOptionsDiv.innerHTML = '';
                        (question.options || []).forEach((optText, idx) => {
                            const optionDiv = document.createElement('div');
                            optionDiv.className = `option${idx + 1}`;
                            const optionId = `option${question.questionId}_${idx + 1}`;
                            optionDiv.innerHTML = `
                                <input type="text" id="${optionId}" value="${optText}" placeholder="Option ${idx + 1}">
                                <button type="button"
                                        onclick="removeDropdownOption(${question.questionId}, ${idx + 1})">
                                    Remove
                                </button>
                            `;
                            dropdownOptionsDiv.appendChild(optionDiv);
                            // Whenever user edits these, re-update jump logic
                            const optionInput = optionDiv.querySelector('input[type="text"]');
                            optionInput.addEventListener('input', () => {
                                updateJumpOptions(question.questionId);
                            });
                        });
                        updateJumpOptions(question.questionId);
                        // Update checklist logic dropdowns after dropdown options are loaded
                        if (typeof updateAllChecklistLogicDropdowns === 'function') {
                            setTimeout(updateAllChecklistLogicDropdowns, 100);
                        }
                        // -- Restore PDF preview if present (AFTER options are added to DOM) --
                        if (question.pdfPreview && question.pdfPreview.enabled) {
                            const pdfPreviewCheckbox = questionBlock.querySelector(`#enablePdfPreview${question.questionId}`);
                            const pdfPreviewTriggerSelect = questionBlock.querySelector(`#pdfPreviewTrigger${question.questionId}`);
                            const pdfPreviewTitleInput = questionBlock.querySelector(`#pdfPreviewTitle${question.questionId}`);
                            const pdfPreviewFileInput = questionBlock.querySelector(`#pdfPreviewFile${question.questionId}`);
                            if (pdfPreviewCheckbox) {
                                pdfPreviewCheckbox.checked = true;
                                togglePdfPreview(question.questionId); // This populates the trigger dropdown with options from DOM
                                // Set the trigger value after the dropdown is populated
                                if (pdfPreviewTriggerSelect && question.pdfPreview.trigger) {
                                    pdfPreviewTriggerSelect.value = question.pdfPreview.trigger;
                                }
                                if (pdfPreviewTitleInput && question.pdfPreview.title) {
                                    pdfPreviewTitleInput.value = question.pdfPreview.title;
                                }
                                if (pdfPreviewFileInput && question.pdfPreview.file) {
                                    pdfPreviewFileInput.value = question.pdfPreview.file;
                                }
                            }
                        }
                    }
                    // Also restore Name/ID and Placeholder
                    const nameInput = questionBlock.querySelector(`#textboxName${question.questionId}`);
                    const placeholderInput = questionBlock.querySelector(`#textboxPlaceholder${question.questionId}`);
                    if (nameInput) {
                        nameInput.value = question.nameId || '';
                    }
                    if (placeholderInput) {
                        placeholderInput.value = question.placeholder || '';
                    }
                    // ********** Restore Image Data ********** 
                    if (question.image) {
                        const urlEl = questionBlock.querySelector(`#dropdownImageURL${question.questionId}`);
                        const wEl = questionBlock.querySelector(`#dropdownImageWidth${question.questionId}`);
                        const hEl = questionBlock.querySelector(`#dropdownImageHeight${question.questionId}`);
                        const imageFields = questionBlock.querySelector(`#dropdownImageFields${question.questionId}`);
                        if (urlEl) urlEl.value = question.image.url || '';
                        if (wEl) wEl.value = question.image.width || 0;
                        if (hEl) hEl.value = question.image.height || 0;
                        // Automatically display the image fields if there's image data
                        if (imageFields && question.image.url) {
                            imageFields.style.display = 'block';
                        }
                    }
                    // Restore linking logic
                    if (question.linking && question.linking.enabled) {
                        const linkingCheckbox = questionBlock.querySelector(`#enableLinking${question.questionId}`);
                        if (linkingCheckbox) {
                            linkingCheckbox.checked = true;
                            toggleLinkingLogic(question.questionId);
                            // Wait for targets to be populated before setting value
                            setTimeout(() => {
                                const linkingTargetSelect = questionBlock.querySelector(`#linkingTarget${question.questionId}`);
                                if (linkingTargetSelect && question.linking.targetId) {
                                    linkingTargetSelect.value = question.linking.targetId;
                                }
                            }, 100);
                        }
                    }
                }
                else if (question.type === 'multipleTextboxes') {
                    // Load custom Node ID if it exists
                    const nodeIdInput = questionBlock.querySelector(`#multipleTextboxesNodeId${question.questionId}`);
                    if (nodeIdInput && question.nodeId) {
                        nodeIdInput.value = question.nodeId;
                    }
                    // Ensure the unified fields container is visible
                    const unifiedFieldsContainer = questionBlock.querySelector(`#unifiedFieldsContainer${question.questionId}`);
                    if (unifiedFieldsContainer) {
                        unifiedFieldsContainer.style.display = 'block';
                    }
                    // Check if we have unified fields data (new format)
                    if (question.allFieldsInOrder && question.allFieldsInOrder.length > 0) {

                        // Rebuild unified fields from exported data
                        const unifiedFieldsDiv = questionBlock.querySelector(`#unifiedFields${question.questionId}`);
                        if (unifiedFieldsDiv) {
                            unifiedFieldsDiv.innerHTML = '';
                            question.allFieldsInOrder.forEach((field, index) => {
                                if (field.type === 'label') {
                                    // Add a label field
                                    addTextboxLabel(question.questionId);
                                    // Set the field values
                                    const lastField = unifiedFieldsDiv.lastElementChild;
                                    if (lastField) {
                                        const fieldOrder = lastField.getAttribute('data-order');
                                        const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                        const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                        if (labelTextEl) labelTextEl.textContent = field.label;
                                        if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                        // Set prefill value (always set it, even if empty, to ensure it's preserved)
                                        if (field.prefill !== undefined) {
                                            lastField.setAttribute('data-prefill', field.prefill || '');

                                        } else {

                                        }
                                        // Set conditional prefills if they exist
                                        if (field.conditionalPrefills && field.conditionalPrefills.length > 0) {
                                            lastField.setAttribute('data-conditional-prefills', JSON.stringify(field.conditionalPrefills));

                                        }
                                    }
                                } else if (field.type === 'amount') {
                                    // Add an amount field
                                    addTextboxAmount(question.questionId);
                                    // Set the field values
                                    const lastField = unifiedFieldsDiv.lastElementChild;
                                    if (lastField) {
                                        const fieldOrder = lastField.getAttribute('data-order');
                                        const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                        const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                        if (labelTextEl) labelTextEl.textContent = field.label;
                                        if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                        // Set conditional prefills if they exist
                                        if (field.conditionalPrefills && field.conditionalPrefills.length > 0) {
                                            lastField.setAttribute('data-conditional-prefills', JSON.stringify(field.conditionalPrefills));

                                        }
                                    }
                                } else if (field.type === 'phone') {
                                    // Add a phone field (reuse label UI and mark as phone)
                                    addTextboxLabel(question.questionId);
                                    const lastField = unifiedFieldsDiv.lastElementChild;
                                    if (lastField) {
                                        const fieldOrder = lastField.getAttribute('data-order');
                                        // Mark the unified field as phone
                                        lastField.setAttribute('data-type', 'phone');
                                        const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                        const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                        if (labelTextEl) labelTextEl.textContent = field.label;
                                        if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                    }
                                } else if (field.type === 'checkbox') {
                                    // Add a checkbox field
                                    addCheckboxField(question.questionId);
                                    // Set the field values
                                    const lastField = unifiedFieldsDiv.lastElementChild;
                                    if (lastField) {
                                        const fieldOrder = lastField.getAttribute('data-order');
                                        const fieldNameEl = lastField.querySelector('#checkboxFieldName' + question.questionId + '_' + fieldOrder);
                                        const selectionTypeEl = lastField.querySelector('#checkboxSelectionType' + question.questionId + '_' + fieldOrder);
                                        const requiredEl = lastField.querySelector('#checkboxRequired' + question.questionId + '_' + fieldOrder);
                                        if (fieldNameEl && field.fieldName) {
                                            fieldNameEl.value = field.fieldName;
                                        }
                                        if (selectionTypeEl && field.selectionType) {
                                            selectionTypeEl.value = field.selectionType;
                                        }
                                        if (requiredEl) {
                                            const requiredValue = (field.required === false || field.required === 'optional') ? 'optional' : 'required';
                                            requiredEl.value = requiredValue;
                                        }
                                        // Add checkbox options
                                        if (field.options && field.options.length > 0) {
                                            field.options.forEach((option, optionIndex) => {
                                                addCheckboxOption(question.questionId, fieldOrder);
                                                // Set the option values
                                                const optionTextEl = document.getElementById('checkboxText' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                                const optionNodeIdEl = document.getElementById('checkboxNodeId' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                                if (optionTextEl) optionTextEl.value = option.text;
                                                if (optionNodeIdEl) optionNodeIdEl.value = option.nodeId;
                                                // Restore linked fields if they exist
                                                if (option.linkedFields && option.linkedFields.length > 0) {
                                                    option.linkedFields.forEach((linkedField) => {
                                                        // Handle both old format (string) and new format (object with nodeId and title)
                                                        const linkedFieldNodeId = typeof linkedField === 'string' ? linkedField : linkedField.nodeId;
                                                        const linkedFieldTitle = typeof linkedField === 'object' && linkedField.title ? linkedField.title : '';
                                                        // Add a linked field dropdown
                                                        if (typeof addLinkedField === 'function') {
                                                            addLinkedField(question.questionId, fieldOrder, optionIndex + 1);
                                                            // Find the last added linked field and set its values
                                                            const linkedFieldsContainer = document.getElementById('linkedFields' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                                            if (linkedFieldsContainer) {
                                                                const lastLinkedFieldDiv = linkedFieldsContainer.querySelector('[class^="linked-field-"]:last-of-type');
                                                                if (lastLinkedFieldDiv) {
                                                                    const lastSelect = lastLinkedFieldDiv.querySelector('select[id^="linkedField"]');
                                                                    const lastTitleInput = lastLinkedFieldDiv.querySelector('input[id^="linkedFieldTitle"]');
                                                                    if (lastSelect) {
                                                                        lastSelect.value = linkedFieldNodeId;
                                                                    }
                                                                    if (lastTitleInput && linkedFieldTitle) {
                                                                        lastTitleInput.value = linkedFieldTitle;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    });
                                                }
                                                // Restore PDF entries if they exist
                                                if (option.pdfEntries && option.pdfEntries.length > 0) {
                                                    option.pdfEntries.forEach((pdfEntry) => {
                                                        // Add a PDF entry
                                                        if (typeof addPdfEntry === 'function') {
                                                            addPdfEntry(question.questionId, fieldOrder, optionIndex + 1);
                                                            // Find the last added PDF entry and set its values
                                                            const pdfEntriesContainer = document.getElementById('pdfEntries' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                                            if (pdfEntriesContainer) {
                                                                const lastPdfEntryDiv = pdfEntriesContainer.querySelector('[class^="pdf-entry-"]:last-of-type');
                                                                if (lastPdfEntryDiv) {
                                                                    const triggerNumberInput = lastPdfEntryDiv.querySelector('input[id^="pdfEntryTriggerNumber"]');
                                                                    const pdfNameInput = lastPdfEntryDiv.querySelector('input[id^="pdfEntryPdfName"]');
                                                                    const pdfFileInput = lastPdfEntryDiv.querySelector('input[id^="pdfEntryPdfFile"]');
                                                                    const priceIdInput = lastPdfEntryDiv.querySelector('input[id^="pdfEntryPriceId"]');
                                                                    if (triggerNumberInput && pdfEntry.triggerNumber) {
                                                                        triggerNumberInput.value = pdfEntry.triggerNumber;
                                                                    }
                                                                    if (pdfNameInput && pdfEntry.pdfName) {
                                                                        pdfNameInput.value = pdfEntry.pdfName;
                                                                    }
                                                                    if (pdfFileInput && pdfEntry.pdfFile) {
                                                                        pdfFileInput.value = pdfEntry.pdfFile;
                                                                    }
                                                                    if (priceIdInput && pdfEntry.priceId) {
                                                                        priceIdInput.value = pdfEntry.priceId;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    }
                                } else if (field.type === 'date') {
                                    // Add a date field
                                    addDateField(question.questionId);
                                    // Set the field values
                                    const lastField = unifiedFieldsDiv.lastElementChild;
                                    if (lastField) {
                                        const fieldOrder = lastField.getAttribute('data-order');
                                        const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                        const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                        if (labelTextEl) labelTextEl.textContent = field.label;
                                        if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                    }
                                } else if (field.type === 'location') {
                                    // Add a main location unified field and set title
                                    addLocationFields(question.questionId, 'multipleTextboxes');
                                    const lastField = unifiedFieldsDiv.lastElementChild;
                                    if (lastField) {
                                        const fieldOrder = lastField.getAttribute('data-order');
                                        const titleEl = lastField.querySelector('#locationTitle' + question.questionId + '_' + fieldOrder);
                                        if (titleEl && field.fieldName) titleEl.value = field.fieldName;
                                    }
                                } else if (field.type === 'dropdown') {

                                    // Check if addDropdownField function is available
                                    if (typeof addDropdownField !== 'function') {

                                        return;
                                    }
                                    // Add a dropdown field
                                    addDropdownField(question.questionId);
                                    // Set the field values
                                    const lastField = unifiedFieldsDiv.lastElementChild;
                                    if (lastField) {

                                        const fieldOrder = lastField.getAttribute('data-order');
                                        const fieldNameEl = lastField.querySelector('#dropdownFieldName' + question.questionId + '_' + fieldOrder);
                                        if (fieldNameEl && field.fieldName) {
                                            fieldNameEl.value = field.fieldName;
                                        }
                                        // Add dropdown options
                                        if (field.options && field.options.length > 0) {

                                            if (typeof addDropdownOption !== 'function') {

                                            } else {
                                                field.options.forEach((option, optionIndex) => {

                                                    // Add the dropdown option (this will create option with number = current count + 1)
                                                    addDropdownOption(question.questionId, fieldOrder);
                                                    // Get the actual option number that was just created
                                                    // The option number is based on the container's children length
                                                    const optionsContainer = document.getElementById('dropdownOptions' + question.questionId + '_' + fieldOrder);
                                                    const actualOptionNumber = optionsContainer ? optionsContainer.children.length : (optionIndex + 1);
                                                    // Set the option values using the actual option number
                                                    const optionTextEl = document.getElementById('dropdownOptionText' + question.questionId + '_' + fieldOrder + '_' + actualOptionNumber);
                                                    const optionNodeIdEl = document.getElementById('dropdownOptionNodeId' + question.questionId + '_' + fieldOrder + '_' + actualOptionNumber);

                                                    if (optionTextEl) {
                                                        optionTextEl.value = option.text || '';
                                                        // Trigger change event to update any dependent fields
                                                        optionTextEl.dispatchEvent(new Event('change'));
                                                    }
                                                    if (optionNodeIdEl) {
                                                        optionNodeIdEl.value = option.nodeId || '';
                                                        // Trigger change event to update any dependent fields
                                                        optionNodeIdEl.dispatchEvent(new Event('change'));
                                                    }
                                                });
                                            }
                                        }
                                        // Update trigger condition options after adding dropdown options
                                        if (field.triggerSequences && field.triggerSequences.length > 0) {

                                            // Check if addTriggerSequence function is available
                                            if (typeof addTriggerSequence !== 'function') {

                                                return;
                                            }
                                            // First add all trigger sequences
                                            field.triggerSequences.forEach((sequence, sequenceIndex) => {

                                                addTriggerSequence(question.questionId, fieldOrder);
                                            });
                                            // Then update trigger condition options for all sequences
                                            field.triggerSequences.forEach((sequence, sequenceIndex) => {
                                                updateTriggerConditionOptions(question.questionId, fieldOrder, sequenceIndex + 1);
                                                // Set the trigger condition
                                                const triggerConditionEl = document.getElementById('triggerCondition' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1));
                                                if (triggerConditionEl && sequence.condition) {
                                                    triggerConditionEl.value = sequence.condition;
                                                }
                                                // Set the trigger title
                                                const triggerTitleEl = document.getElementById('triggerTitle' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1));
                                                if (triggerTitleEl && sequence.title) {
                                                    triggerTitleEl.value = sequence.title;
                                                }
                                                // Add trigger fields
                                                if (sequence.fields && sequence.fields.length > 0) {

                                                    sequence.fields.forEach((triggerField, triggerFieldIndex) => {

                                                        if (triggerField.type === 'label') {
                                                            if (typeof addTriggerLabel !== 'function') {

                                                                return;
                                                            }
                                                            addTriggerLabel(question.questionId, fieldOrder, sequenceIndex + 1);
                                                            // Set the trigger field values
                                                            const triggerLabelTextEl = document.getElementById('triggerLabelText' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1));
                                                            const triggerLabelNodeIdEl = document.getElementById('triggerLabelNodeId' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1));
                                                            if (triggerLabelTextEl) triggerLabelTextEl.value = triggerField.label;
                                                            if (triggerLabelNodeIdEl) triggerLabelNodeIdEl.value = triggerField.nodeId;
                                                            // Restore amount checkbox if enabled
                                                            if (triggerField.isAmountOption) {
                                                                const triggerFieldCount = triggerFieldIndex + 1;
                                                                const amountCheckbox = document.getElementById(`triggerLabelAmount${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`);
                                                                if (amountCheckbox) {
                                                                    amountCheckbox.checked = true;
                                                                }
                                                            }
                                                            // Restore conditional logic if enabled
                                                            if (triggerField.conditionalLogic && triggerField.conditionalLogic.enabled) {
                                                                const triggerFieldCount = triggerFieldIndex + 1;
                                                                const key = `${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`;
                                                                if (!window.triggerLabelConditionalLogic) {
                                                                    window.triggerLabelConditionalLogic = {};
                                                                }
                                                                window.triggerLabelConditionalLogic[key] = {
                                                                    enabled: true,
                                                                    conditions: [...(triggerField.conditionalLogic.conditions || [])]
                                                                };
                                                                setTimeout(() => {
                                                                    const enableConditionalLogicCheckbox = document.getElementById(`enableConditionalLogicLabel${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`);
                                                                    if (enableConditionalLogicCheckbox) {
                                                                        enableConditionalLogicCheckbox.checked = true;
                                                                        const event = new Event('change');
                                                                        enableConditionalLogicCheckbox.dispatchEvent(event);
                                                                        setTimeout(() => {
                                                                            if (triggerField.conditionalLogic.conditions && triggerField.conditionalLogic.conditions.length > 0) {
                                                                                if (typeof updateTriggerLabelConditionalLogicUI === 'function') {
                                                                                    updateTriggerLabelConditionalLogicUI(question.questionId, fieldOrder, sequenceIndex + 1, triggerFieldCount);
                                                                                    setTimeout(() => {
                                                                                        triggerField.conditionalLogic.conditions.forEach((condition, condIndex) => {
                                                                                            if (condIndex > 0) {
                                                                                                const addConditionBtn = document.querySelector(`#conditionalLogicUILabel${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} button`);
                                                                                                if (addConditionBtn && addConditionBtn.textContent === 'Add Another Condition') {
                                                                                                    addConditionBtn.click();
                                                                                                }
                                                                                            }
                                                                                            setTimeout(() => {
                                                                                                const conditionDropdown = document.querySelector(`#conditionalLogicUILabel${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                                if (conditionDropdown) {
                                                                                                    conditionDropdown.value = condition;
                                                                                                    conditionDropdown.dispatchEvent(new Event('change'));
                                                                                                }
                                                                                            }, 150 * (condIndex + 1));
                                                                                        });
                                                                                    }, 300);
                                                                                }
                                                                            }
                                                                        }, 400);
                                                                    }
                                                                }, 200);
                                                            }
                                                        } else if (triggerField.type === 'checkbox') {
                                                            if (typeof addTriggerCheckbox !== 'function') {

                                                                return;
                                                            }
                                                            addTriggerCheckbox(question.questionId, fieldOrder, sequenceIndex + 1);
                                                            // Set the trigger checkbox field values
                                                            const triggerCheckboxFieldNameEl = document.getElementById('triggerCheckboxFieldName' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1));
                                                            if (triggerCheckboxFieldNameEl) triggerCheckboxFieldNameEl.value = triggerField.fieldName;
                                                            // Add trigger checkbox options
                                                            if (triggerField.options && triggerField.options.length > 0) {
                                                                triggerField.options.forEach((option, optionIndex) => {
                                                                    addTriggerCheckboxOption(question.questionId, fieldOrder, sequenceIndex + 1, triggerFieldIndex + 1);
                                                                    // Set the trigger option values
                                                                    const triggerOptionTextEl = document.getElementById('triggerCheckboxOptionText' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1) + '_' + (optionIndex + 1));
                                                                    const triggerOptionNodeIdEl = document.getElementById('triggerCheckboxOptionNodeId' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1) + '_' + (optionIndex + 1));
                                                                    if (triggerOptionTextEl) triggerOptionTextEl.value = option.text;
                                                                    if (triggerOptionNodeIdEl) triggerOptionNodeIdEl.value = option.nodeId;
                                                                });
                                                            }
                                                            // Set the selection type
                                                            const triggerCheckboxSelectionTypeEl = document.getElementById('triggerCheckboxSelectionType' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1));
                                                            if (triggerCheckboxSelectionTypeEl && triggerField.selectionType) {
                                                                triggerCheckboxSelectionTypeEl.value = triggerField.selectionType;
                                                            }
                                                            // Restore conditional logic if enabled
                                                            if (triggerField.conditionalLogic && triggerField.conditionalLogic.enabled) {
                                                                const triggerFieldCount = triggerFieldIndex + 1;
                                                                const key = `${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`;
                                                                if (!window.triggerCheckboxConditionalLogic) {
                                                                    window.triggerCheckboxConditionalLogic = {};
                                                                }
                                                                window.triggerCheckboxConditionalLogic[key] = {
                                                                    enabled: true,
                                                                    conditions: [...(triggerField.conditionalLogic.conditions || [])]
                                                                };
                                                                setTimeout(() => {
                                                                    const enableConditionalLogicCheckbox = document.getElementById(`enableConditionalLogicCheckbox${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`);
                                                                    if (enableConditionalLogicCheckbox) {
                                                                        enableConditionalLogicCheckbox.checked = true;
                                                                        const event = new Event('change');
                                                                        enableConditionalLogicCheckbox.dispatchEvent(event);
                                                                        setTimeout(() => {
                                                                            if (triggerField.conditionalLogic.conditions && triggerField.conditionalLogic.conditions.length > 0) {
                                                                                if (typeof updateTriggerCheckboxConditionalLogicUI === 'function') {
                                                                                    updateTriggerCheckboxConditionalLogicUI(question.questionId, fieldOrder, sequenceIndex + 1, triggerFieldCount);
                                                                                    setTimeout(() => {
                                                                                        triggerField.conditionalLogic.conditions.forEach((condition, condIndex) => {
                                                                                            if (condIndex > 0) {
                                                                                                const addConditionBtn = document.querySelector(`#conditionalLogicUICheckbox${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} button`);
                                                                                                if (addConditionBtn && addConditionBtn.textContent === 'Add Another Condition') {
                                                                                                    addConditionBtn.click();
                                                                                                }
                                                                                            }
                                                                                            setTimeout(() => {
                                                                                                const conditionDropdown = document.querySelector(`#conditionalLogicUICheckbox${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                                if (conditionDropdown) {
                                                                                                    conditionDropdown.value = condition;
                                                                                                    conditionDropdown.dispatchEvent(new Event('change'));
                                                                                                }
                                                                                            }, 150 * (condIndex + 1));
                                                                                        });
                                                                                    }, 300);
                                                                                }
                                                                            }
                                                                        }, 400);
                                                                    }
                                                                }, 200);
                                                            }
                                                        } else if (triggerField.type === 'dropdown') {
                                                            if (typeof addTriggerDropdown !== 'function') {

                                                                return;
                                                            }
                                                            addTriggerDropdown(question.questionId, fieldOrder, sequenceIndex + 1);
                                                            // Get the actual field count from the container (more reliable than using index)
                                                            const triggerFieldsContainer = document.getElementById(`triggerFields${question.questionId}_${fieldOrder}_${sequenceIndex + 1}`);
                                                            const actualFieldCount = triggerFieldsContainer ? triggerFieldsContainer.children.length : (triggerFieldIndex + 1);
                                                            // Set the trigger dropdown field values
                                                            const triggerDropdownFieldNameEl = document.getElementById('triggerDropdownFieldName' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + actualFieldCount);
                                                            if (triggerDropdownFieldNameEl) triggerDropdownFieldNameEl.value = triggerField.fieldName;
                                                            // Add trigger dropdown options
                                                            if (triggerField.options && triggerField.options.length > 0) {
                                                                triggerField.options.forEach((option, optionIndex) => {
                                                                    addTriggerDropdownOption(question.questionId, fieldOrder, sequenceIndex + 1, actualFieldCount);
                                                                    // Set the trigger option values
                                                                    const triggerOptionTextEl = document.getElementById('triggerDropdownOptionText' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + actualFieldCount + '_' + (optionIndex + 1));
                                                                    if (triggerOptionTextEl) triggerOptionTextEl.value = option.text;
                                                                });
                                                            }
                                                            // Restore conditional logic if enabled (after options are added)
                                                            if (triggerField.conditionalLogic && triggerField.conditionalLogic.enabled) {

                                                                // Initialize the data structure first (use actualFieldCount)
                                                                const key = `${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount}`;
                                                                if (!window.triggerDropdownConditionalLogic) {
                                                                    window.triggerDropdownConditionalLogic = {};
                                                                }
                                                                window.triggerDropdownConditionalLogic[key] = {
                                                                    enabled: true,
                                                                    conditions: [...(triggerField.conditionalLogic.conditions || [])]
                                                                };

                                                                // Wait for options to be added before restoring conditional logic
                                                                setTimeout(() => {
                                                                    const enableConditionalLogicCheckbox = document.getElementById(`enableConditionalLogicDropdown${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount}`);

                                                                    if (enableConditionalLogicCheckbox) {
                                                                        enableConditionalLogicCheckbox.checked = true;

                                                                        // Manually trigger the change event to update the UI
                                                                        const event = new Event('change');
                                                                        enableConditionalLogicCheckbox.dispatchEvent(event);
                                                                        // Set the conditions after a delay to ensure UI is ready
                                                                        setTimeout(() => {
                                                                            if (triggerField.conditionalLogic.conditions && triggerField.conditionalLogic.conditions.length > 0) {

                                                                                // Update the UI with the conditions
                                                                                if (typeof updateTriggerDropdownConditionalLogicUI === 'function') {
                                                                                    updateTriggerDropdownConditionalLogicUI(question.questionId, fieldOrder, sequenceIndex + 1, actualFieldCount);
                                                                                    // Set the condition values after UI is updated
                                                                                    setTimeout(() => {

                                                                                        triggerField.conditionalLogic.conditions.forEach((condition, condIndex) => {

                                                                                            // Add condition if needed
                                                                                            if (condIndex > 0) {
                                                                                                const addConditionBtn = document.querySelector(`#conditionalLogicUIDropdown${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount} button`);
                                                                                                if (addConditionBtn && addConditionBtn.textContent === 'Add Another Condition') {

                                                                                                    addConditionBtn.click();
                                                                                                    // Wait a bit for the new dropdown to be created
                                                                                                    setTimeout(() => {
                                                                                                        const conditionDropdown = document.querySelector(`#conditionalLogicUIDropdown${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                                        if (conditionDropdown) {
                                                                                                            conditionDropdown.value = condition;
                                                                                                            conditionDropdown.dispatchEvent(new Event('change'));

                                                                                                        } else {

                                                                                                        }
                                                                                                    }, 100);
                                                                                                    return;
                                                                                                }
                                                                                            }
                                                                                            // Set the condition value for the first condition or after adding
                                                                                            setTimeout(() => {
                                                                                                const conditionDropdown = document.querySelector(`#conditionalLogicUIDropdown${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                                if (conditionDropdown) {
                                                                                                    conditionDropdown.value = condition;
                                                                                                    conditionDropdown.dispatchEvent(new Event('change'));

                                                                                                } else {

                                                                                                }
                                                                                            }, 150 * (condIndex + 1));
                                                                                        });
                                                                                    }, 300);
                                                                                } else {

                                                                                }
                                                                            }
                                                                        }, 400);
                                                                    } else {

                                                                    }
                                                                }, 200);
                                                            }
                                                        } else if (triggerField.type === 'date') {
                                                            if (typeof addTriggerDate !== 'function') {

                                                                return;
                                                            }
                                                            addTriggerDate(question.questionId, fieldOrder, sequenceIndex + 1);
                                                            // Calculate the correct triggerFieldCount by finding the date field we just created
                                                            // The field count is based on the number of fields in the container
                                                            const triggerFieldsContainer = document.getElementById(`triggerFields${question.questionId}_${fieldOrder}_${sequenceIndex + 1}`);
                                                            let triggerFieldCount = triggerFieldIndex + 1;
                                                            // Try to find the actual field count by matching the nodeId
                                                            if (triggerFieldsContainer) {
                                                                const allFields = triggerFieldsContainer.querySelectorAll('[class*="trigger-field-"]');
                                                                for (let i = 0; i < allFields.length; i++) {
                                                                    const fieldEl = allFields[i];
                                                                    const nodeIdInput = fieldEl.querySelector(`#triggerDateNodeId${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${i + 1}`);
                                                                    if (nodeIdInput && nodeIdInput.value === triggerField.nodeId) {
                                                                        triggerFieldCount = i + 1;

                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                            // Set the trigger date field values
                                                            const triggerDateLabelEl = document.getElementById('triggerDateLabel' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + triggerFieldCount);
                                                            const triggerDateNodeIdEl = document.getElementById('triggerDateNodeId' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + triggerFieldCount);
                                                            if (triggerDateLabelEl) triggerDateLabelEl.value = triggerField.label;
                                                            if (triggerDateNodeIdEl) triggerDateNodeIdEl.value = triggerField.nodeId;
                                                            // Restore conditional logic if enabled

                                                            if (triggerField.conditionalLogic && triggerField.conditionalLogic.enabled) {

                                                                // Initialize the data structure first
                                                                const key = `${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`;
                                                                if (!window.triggerDateConditionalLogic) {
                                                                    window.triggerDateConditionalLogic = {};
                                                                }
                                                                window.triggerDateConditionalLogic[key] = {
                                                                    enabled: true,
                                                                    conditions: [...(triggerField.conditionalLogic.conditions || [])]
                                                                };

                                                                setTimeout(() => {
                                                                    const enableConditionalLogicCheckbox = document.getElementById(`enableConditionalLogic${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`);

                                                                    if (enableConditionalLogicCheckbox) {
                                                                        enableConditionalLogicCheckbox.checked = true;

                                                                        // Manually trigger the change event to update the UI
                                                                        const event = new Event('change');
                                                                        enableConditionalLogicCheckbox.dispatchEvent(event);
                                                                        // Set the conditions after a delay to ensure UI is ready
                                                                        setTimeout(() => {
                                                                            if (triggerField.conditionalLogic.conditions && triggerField.conditionalLogic.conditions.length > 0) {

                                                                                // Update the UI with the conditions
                                                                                if (typeof updateTriggerDateConditionalLogicUI === 'function') {
                                                                                    updateTriggerDateConditionalLogicUI(question.questionId, fieldOrder, sequenceIndex + 1, triggerFieldCount);
                                                                                    // Set the condition values after UI is updated
                                                                                    setTimeout(() => {

                                                                                        triggerField.conditionalLogic.conditions.forEach((condition, condIndex) => {

                                                                                            // Add condition if needed
                                                                                            if (condIndex > 0) {
                                                                                                const addConditionBtn = document.querySelector(`#conditionalLogicUI${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} button`);
                                                                                                if (addConditionBtn && addConditionBtn.textContent === 'Add Another Condition') {

                                                                                                    addConditionBtn.click();
                                                                                                    // Wait a bit for the new dropdown to be created
                                                                                                    setTimeout(() => {
                                                                                                        const conditionDropdown = document.querySelector(`#conditionalLogicUI${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                                        if (conditionDropdown) {
                                                                                                            conditionDropdown.value = condition;
                                                                                                            conditionDropdown.dispatchEvent(new Event('change'));

                                                                                                        } else {

                                                                                                        }
                                                                                                    }, 100);
                                                                                                    return;
                                                                                                }
                                                                                            }
                                                                                            // Set the condition value for the first condition or after adding
                                                                                            setTimeout(() => {
                                                                                                const conditionDropdown = document.querySelector(`#conditionalLogicUI${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                                if (conditionDropdown) {
                                                                                                    conditionDropdown.value = condition;
                                                                                                    conditionDropdown.dispatchEvent(new Event('change'));

                                                                                                } else {

                                                                                                }
                                                                                            }, 150 * (condIndex + 1));
                                                                                        });
                                                                                    }, 300);
                                                                                } else {

                                                                                }
                                                                            }
                                                                        }, 400);
                                                                    } else {

                                                                    }
                                                                }, 200);
                                                            } else {

                                                            }
                                                        } else if (triggerField.type === 'location') {
                                                            // Handle simplified location field format ("Location Data Added")
                                                            if (typeof addTriggerLocation !== 'function') {

                                                                return;
                                                            }
                                                            addTriggerLocation(question.questionId, fieldOrder, sequenceIndex + 1);
                                                            // Set the location title if provided
                                                            setTimeout(() => {
                                                                const locationTitleEl = document.getElementById(`triggerLocationTitle${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldIndex + 1}`);
                                                                if (locationTitleEl && triggerField.fieldName) {
                                                                    locationTitleEl.value = triggerField.fieldName;
                                                                }
                                                            }, 100);
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    }
                                } else if (field.type === 'time') {
                                    // Add a time field
                                    addTimeField(question.questionId);
                                    // Set the field values
                                    const lastField = unifiedFieldsDiv.lastElementChild;
                                    if (lastField) {
                                        const fieldOrder = lastField.getAttribute('data-order');
                                        const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                        const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                        if (labelTextEl) labelTextEl.textContent = field.label;
                                        if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                    }
                                }
                            });
                            // Update hidden containers to keep them in sync
                            updateHiddenContainers(question.questionId);
                        }
                    } else {
                        // Fallback to old format

                    const multipleTextboxesBlock = questionBlock.querySelector(`#multipleTextboxesOptions${question.questionId}`);
                    if (multipleTextboxesBlock) {
                        multipleTextboxesBlock.innerHTML = '';
                        (question.textboxes || []).forEach((tb, idx) => {
                            // Add a textbox slot
                            addMultipleTextboxOption(question.questionId);
                            // Fill in the values
                            const labelInput = questionBlock.querySelector(
                                `#multipleTextboxLabel${question.questionId}_${idx + 1}`
                            );
                            const nameIdInput = questionBlock.querySelector(
                                `#multipleTextboxName${question.questionId}_${idx + 1}`
                            );
                            const placeholderInput = questionBlock.querySelector(
                                `#multipleTextboxPlaceholder${question.questionId}_${idx + 1}`
                            );
                            if (labelInput)        labelInput.value = tb.label || '';
                            if (nameIdInput)       nameIdInput.value = tb.nameId || '';
                            if (placeholderInput)  placeholderInput.value = tb.placeholder || '';
                        });
                        (question.amounts || []).forEach((amt, idx) => {
                            addMultipleAmountOption(question.questionId);
                            const labelInput = questionBlock.querySelector(
                                `#multipleAmountLabel${question.questionId}_${idx + 1}`
                            );
                            const nameIdInput = questionBlock.querySelector(
                                `#multipleAmountName${question.questionId}_${idx + 1}`
                            );
                            const placeholderInput = questionBlock.querySelector(
                                `#multipleAmountPlaceholder${question.questionId}_${idx + 1}`
                            );
                            if (labelInput)        labelInput.value = amt.label || '';
                            if (nameIdInput)       nameIdInput.value = amt.nameId || '';
                            if (placeholderInput)  placeholderInput.value = amt.placeholder || '';
                        });
                        }
                    }
                }
               // In the numbered dropdown section of loadFormData()
                else if (question.type === 'numberedDropdown') {
                    // Numbered dropdown
                    const rangeStartEl = questionBlock.querySelector(`#numberRangeStart${question.questionId}`);
                    const rangeEndEl = questionBlock.querySelector(`#numberRangeEnd${question.questionId}`);
                    if (rangeStartEl) rangeStartEl.value = question.min || '';
                    if (rangeEndEl) rangeEndEl.value = question.max || '';
                    // Restore main Node ID if it exists
                    const nodeIdEl = questionBlock.querySelector(`#nodeId${question.questionId}`);
                    if (nodeIdEl && question.nodeId) {
                        nodeIdEl.value = question.nodeId;
                    }
                    // Restore entry title if it exists
                    const entryTitleEl = questionBlock.querySelector(`#entryTitle${question.questionId}`);
                    if (entryTitleEl && question.entryTitle) {
                        entryTitleEl.value = question.entryTitle;
                    }
                    // Rebuild unified fields from exported data
                    const unifiedFieldsDiv = questionBlock.querySelector(`#unifiedFields${question.questionId}`);
                    if (unifiedFieldsDiv) {
                        unifiedFieldsDiv.innerHTML = '';
                        // Use the new allFieldsInOrder format if available, otherwise fallback to old format
                        let allFields = [];
                        if (question.allFieldsInOrder && Array.isArray(question.allFieldsInOrder)) {
                            // New format: fields are already in correct order
                            allFields = question.allFieldsInOrder;
                        } else {
                            // Fallback to old format for backward compatibility
                            const labels = question.labels || [];
                            const labelNodeIds = question.labelNodeIds || [];
                            const amounts = question.amounts || [];
                            // Add labels first (they were exported first)
                            labels.forEach((labelValue, ldx) => {
                                allFields.push({
                                    type: 'label',
                                    label: labelValue,
                                    nodeId: labelNodeIds[ldx] || '',
                                    order: ldx + 1
                                });
                            });
                            // Add amounts after labels
                            amounts.forEach((amountValue, index) => {
                                allFields.push({
                                    type: 'amount',
                                    label: amountValue,
                                    nodeId: '',
                                    order: labels.length + index + 1
                                });
                            });
                        }
                        // Rebuild fields in the unified container
                        allFields.forEach((field, index) => {
                            if (field.type === 'label') {
                                // Add a label field
                                addTextboxLabel(question.questionId);
                                // Set the field values
                                const lastField = unifiedFieldsDiv.lastElementChild;
                                if (lastField) {
                                    const fieldOrder = lastField.getAttribute('data-order');
                                    const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                    const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                    if (labelTextEl) labelTextEl.textContent = field.label;
                                    if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                    // Set prefill value (always set it, even if empty, to ensure it's preserved)
                                    if (field.prefill !== undefined) {
                                        lastField.setAttribute('data-prefill', field.prefill || '');

                                    } else {

                                    }
                                    // Set conditional prefills if they exist
                                    if (field.conditionalPrefills && field.conditionalPrefills.length > 0) {
                                        lastField.setAttribute('data-conditional-prefills', JSON.stringify(field.conditionalPrefills));

                                    }
                                }
                            } else if (field.type === 'amount') {
                                // Add an amount field
                                addTextboxAmount(question.questionId);
                                // Set the field values
                                const lastField = unifiedFieldsDiv.lastElementChild;
                                if (lastField) {
                                    const fieldOrder = lastField.getAttribute('data-order');
                                    const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                    const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                    if (labelTextEl) labelTextEl.textContent = field.label;
                                    if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                    // Set conditional prefills if they exist
                                    if (field.conditionalPrefills && field.conditionalPrefills.length > 0) {
                                        lastField.setAttribute('data-conditional-prefills', JSON.stringify(field.conditionalPrefills));

                                    }
                                }
                            } else if (field.type === 'phone') {
                                // Add a label field and then mark it as phone
                                addTextboxLabel(question.questionId);
                                const lastField = unifiedFieldsDiv.lastElementChild;
                                if (lastField) {
                                    const fieldOrder = lastField.getAttribute('data-order');
                                    const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                    const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                    if (labelTextEl) labelTextEl.textContent = field.label;
                                    if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                    // Mark this unified field as phone for display and data
                                    lastField.setAttribute('data-type', 'phone');
                                    const typeTextEl = lastField.querySelector('#typeText' + question.questionId + '_' + fieldOrder);
                                    if (typeTextEl) typeTextEl.textContent = 'Phone';
                                    // Prefill
                                    if (field.prefill !== undefined) {
                                        lastField.setAttribute('data-prefill', field.prefill || '');
                                    }
                                    // Conditional prefills
                                    if (field.conditionalPrefills && field.conditionalPrefills.length > 0) {
                                        lastField.setAttribute('data-conditional-prefills', JSON.stringify(field.conditionalPrefills));
                                    }
                                }
                            } else if (field.type === 'checkbox') {
                                // Add a checkbox field
                                addCheckboxField(question.questionId);
                                // Set the field values
                                const lastField = unifiedFieldsDiv.lastElementChild;
                                if (lastField) {
                                    const fieldOrder = lastField.getAttribute('data-order');
                                    const fieldNameEl = lastField.querySelector('#checkboxFieldName' + question.questionId + '_' + fieldOrder);
                                    const selectionTypeEl = lastField.querySelector('#checkboxSelectionType' + question.questionId + '_' + fieldOrder);
                                    const requiredEl = lastField.querySelector('#checkboxRequired' + question.questionId + '_' + fieldOrder);
                                    if (fieldNameEl && field.fieldName) {
                                        fieldNameEl.value = field.fieldName;
                                    }
                                    if (selectionTypeEl && field.selectionType) {
                                        selectionTypeEl.value = field.selectionType;
                                    }
                                    if (requiredEl) {
                                        const requiredValue = (field.required === false || field.required === 'optional') ? 'optional' : 'required';
                                        requiredEl.value = requiredValue;
                                    }
                                    // Add checkbox options
                                    if (field.options && field.options.length > 0) {
                                        field.options.forEach((option, optionIndex) => {
                                            addCheckboxOption(question.questionId, fieldOrder);
                                            // Set the option values
                                            const optionTextEl = document.getElementById('checkboxText' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                            const optionNodeIdEl = document.getElementById('checkboxNodeId' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                            if (optionTextEl) optionTextEl.value = option.text;
                                            if (optionNodeIdEl) optionNodeIdEl.value = option.nodeId;
                                            // Restore linked fields if they exist
                                            if (option.linkedFields && option.linkedFields.length > 0) {
                                                option.linkedFields.forEach((linkedField) => {
                                                    // Handle both old format (string) and new format (object with nodeId and title)
                                                    const linkedFieldNodeId = typeof linkedField === 'string' ? linkedField : linkedField.nodeId;
                                                    const linkedFieldTitle = typeof linkedField === 'object' && linkedField.title ? linkedField.title : '';
                                                    // Add a linked field dropdown
                                                    if (typeof addLinkedField === 'function') {
                                                        addLinkedField(question.questionId, fieldOrder, optionIndex + 1);
                                                        // Find the last added linked field and set its values
                                                        const linkedFieldsContainer = document.getElementById('linkedFields' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                                        if (linkedFieldsContainer) {
                                                            const lastLinkedFieldDiv = linkedFieldsContainer.querySelector('[class^="linked-field-"]:last-of-type');
                                                            if (lastLinkedFieldDiv) {
                                                                const lastSelect = lastLinkedFieldDiv.querySelector('select[id^="linkedField"]');
                                                                const lastTitleInput = lastLinkedFieldDiv.querySelector('input[id^="linkedFieldTitle"]');
                                                                if (lastSelect) {
                                                                    lastSelect.value = linkedFieldNodeId;
                                                                }
                                                                if (lastTitleInput && linkedFieldTitle) {
                                                                    lastTitleInput.value = linkedFieldTitle;
                                                                }
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                            // Restore PDF entries if they exist
                                            if (option.pdfEntries && option.pdfEntries.length > 0) {
                                                option.pdfEntries.forEach((pdfEntry) => {
                                                    // Add a PDF entry
                                                    if (typeof addPdfEntry === 'function') {
                                                        addPdfEntry(question.questionId, fieldOrder, optionIndex + 1);
                                                        // Find the last added PDF entry and set its values
                                                        const pdfEntriesContainer = document.getElementById('pdfEntries' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                                        if (pdfEntriesContainer) {
                                                            const lastPdfEntryDiv = pdfEntriesContainer.querySelector('[class^="pdf-entry-"]:last-of-type');
                                                            if (lastPdfEntryDiv) {
                                                                const triggerNumberInput = lastPdfEntryDiv.querySelector('input[id^="pdfEntryTriggerNumber"]');
                                                                const pdfNameInput = lastPdfEntryDiv.querySelector('input[id^="pdfEntryPdfName"]');
                                                                const pdfFileInput = lastPdfEntryDiv.querySelector('input[id^="pdfEntryPdfFile"]');
                                                                const priceIdInput = lastPdfEntryDiv.querySelector('input[id^="pdfEntryPriceId"]');
                                                                if (triggerNumberInput && pdfEntry.triggerNumber) {
                                                                    triggerNumberInput.value = pdfEntry.triggerNumber;
                                                                }
                                                                if (pdfNameInput && pdfEntry.pdfName) {
                                                                    pdfNameInput.value = pdfEntry.pdfName;
                                                                }
                                                                if (pdfFileInput && pdfEntry.pdfFile) {
                                                                    pdfFileInput.value = pdfEntry.pdfFile;
                                                                }
                                                                if (priceIdInput && pdfEntry.priceId) {
                                                                    priceIdInput.value = pdfEntry.priceId;
                                                                }
                                                            }
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                    }
                                }
                                } else if (field.type === 'date') {
                                // Add a date field
                                addDateField(question.questionId);
                                // Set the field values
                                const lastField = unifiedFieldsDiv.lastElementChild;
                                if (lastField) {
                                    const fieldOrder = lastField.getAttribute('data-order');
                                    const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                    const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                    if (labelTextEl) labelTextEl.textContent = field.label;
                                    if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                }
                            } else if (field.type === 'time') {
                                // Add a time field
                                addTimeField(question.questionId);
                                // Set the field values
                                const lastField = unifiedFieldsDiv.lastElementChild;
                                if (lastField) {
                                    const fieldOrder = lastField.getAttribute('data-order');
                                    const labelTextEl = lastField.querySelector('#labelText' + question.questionId + '_' + fieldOrder);
                                    const nodeIdTextEl = lastField.querySelector('#nodeIdText' + question.questionId + '_' + fieldOrder);
                                    if (labelTextEl) labelTextEl.textContent = field.label;
                                    if (nodeIdTextEl) nodeIdTextEl.textContent = field.nodeId;
                                }
                                } else if (field.type === 'location') {
                                    // Add a main location unified field and set title
                                    addLocationFields(question.questionId, 'multipleTextboxes');
                                    const lastField = unifiedFieldsDiv.lastElementChild;
                                    if (lastField) {
                                        const fieldOrder = lastField.getAttribute('data-order');
                                        const titleEl = lastField.querySelector('#locationTitle' + question.questionId + '_' + fieldOrder);
                                        if (titleEl && field.fieldName) titleEl.value = field.fieldName;
                                    }
                                } else if (field.type === 'dropdown') {

                                // Check if addDropdownField function is available
                                if (typeof addDropdownField !== 'function') {

                                    return;
                                }
                                // Add a dropdown field
                                addDropdownField(question.questionId);
                                // Set the field values
                                const lastField = unifiedFieldsDiv.lastElementChild;
                                if (lastField) {

                                    const fieldOrder = lastField.getAttribute('data-order');
                                    const fieldNameEl = lastField.querySelector('#dropdownFieldName' + question.questionId + '_' + fieldOrder);
                                    if (fieldNameEl && field.fieldName) {
                                        fieldNameEl.value = field.fieldName;
                                    }
                                    // Add dropdown options
                                    if (field.options && field.options.length > 0) {

                                        field.options.forEach((option, optionIndex) => {

                                        if (typeof addDropdownOption !== 'function') {

                                                return;
                                            }
                                        addDropdownOption(question.questionId, fieldOrder);
                                            // Set the option values
                                            const optionTextEl = document.getElementById('dropdownOptionText' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                            const optionNodeIdEl = document.getElementById('dropdownOptionNodeId' + question.questionId + '_' + fieldOrder + '_' + (optionIndex + 1));

                                            if (optionTextEl) optionTextEl.value = option.text;
                                            if (optionNodeIdEl) optionNodeIdEl.value = option.nodeId;
                                        });
                                    }
                                    // Update trigger condition options after adding dropdown options
                                    if (field.triggerSequences && field.triggerSequences.length > 0) {

                                        // Check if addTriggerSequence function is available
                                        if (typeof addTriggerSequence !== 'function') {

                                            return;
                                        }
                                        // First add all trigger sequences
                                        field.triggerSequences.forEach((sequence, sequenceIndex) => {

                                            addTriggerSequence(question.questionId, fieldOrder);
                                        });
                                        // Then update trigger condition options for all sequences
                                        field.triggerSequences.forEach((sequence, sequenceIndex) => {
                                            updateTriggerConditionOptions(question.questionId, fieldOrder, sequenceIndex + 1);
                                            // Set the trigger condition
                                            const triggerConditionEl = document.getElementById('triggerCondition' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1));
                                            if (triggerConditionEl && sequence.condition) {
                                                triggerConditionEl.value = sequence.condition;
                                            }
                                            // Set the trigger title
                                            const triggerTitleEl = document.getElementById('triggerTitle' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1));
                                            if (triggerTitleEl && sequence.title) {
                                                triggerTitleEl.value = sequence.title;
                                            }
                                            // Add trigger fields
                                            if (sequence.fields && sequence.fields.length > 0) {

                                                sequence.fields.forEach((triggerField, triggerFieldIndex) => {

                                                    if (triggerField.type === 'label') {
                                                        if (typeof addTriggerLabel !== 'function') {

                                                            return;
                                                        }
                                                        addTriggerLabel(question.questionId, fieldOrder, sequenceIndex + 1);
                                                        // Set the trigger field values
                                                        const triggerLabelTextEl = document.getElementById('triggerLabelText' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1));
                                                        const triggerLabelNodeIdEl = document.getElementById('triggerLabelNodeId' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1));
                                                        if (triggerLabelTextEl) triggerLabelTextEl.value = triggerField.label;
                                                        if (triggerLabelNodeIdEl) triggerLabelNodeIdEl.value = triggerField.nodeId;
                                                        // Restore amount checkbox if enabled
                                                        if (triggerField.isAmountOption) {
                                                            const triggerFieldCountForAmount = triggerFieldIndex + 1;
                                                            const amountCheckbox = document.getElementById(`triggerLabelAmount${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCountForAmount}`);
                                                            if (amountCheckbox) {
                                                                amountCheckbox.checked = true;
                                                            }
                                                        }
                                                        // Restore conditional logic if enabled
                                                        if (triggerField.conditionalLogic && triggerField.conditionalLogic.enabled) {
                                                            const triggerFieldCount = triggerFieldIndex + 1;
                                                            const key = `${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`;
                                                            if (!window.triggerLabelConditionalLogic) {
                                                                window.triggerLabelConditionalLogic = {};
                                                            }
                                                            window.triggerLabelConditionalLogic[key] = {
                                                                enabled: true,
                                                                conditions: [...(triggerField.conditionalLogic.conditions || [])]
                                                            };
                                                            setTimeout(() => {
                                                                const enableConditionalLogicCheckbox = document.getElementById(`enableConditionalLogicLabel${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`);
                                                                if (enableConditionalLogicCheckbox) {
                                                                    enableConditionalLogicCheckbox.checked = true;
                                                                    const event = new Event('change');
                                                                    enableConditionalLogicCheckbox.dispatchEvent(event);
                                                                    setTimeout(() => {
                                                                        if (triggerField.conditionalLogic.conditions && triggerField.conditionalLogic.conditions.length > 0) {
                                                                            if (typeof updateTriggerLabelConditionalLogicUI === 'function') {
                                                                                updateTriggerLabelConditionalLogicUI(question.questionId, fieldOrder, sequenceIndex + 1, triggerFieldCount);
                                                                                setTimeout(() => {
                                                                                    triggerField.conditionalLogic.conditions.forEach((condition, condIndex) => {
                                                                                        if (condIndex > 0) {
                                                                                            const addConditionBtn = document.querySelector(`#conditionalLogicUILabel${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} button`);
                                                                                            if (addConditionBtn && addConditionBtn.textContent === 'Add Another Condition') {
                                                                                                addConditionBtn.click();
                                                                                            }
                                                                                        }
                                                                                        setTimeout(() => {
                                                                                            const conditionDropdown = document.querySelector(`#conditionalLogicUILabel${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                            if (conditionDropdown) {
                                                                                                conditionDropdown.value = condition;
                                                                                                conditionDropdown.dispatchEvent(new Event('change'));
                                                                                            }
                                                                                        }, 150 * (condIndex + 1));
                                                                                    });
                                                                                }, 300);
                                                                            }
                                                                        }
                                                                    }, 400);
                                                                }
                                                            }, 200);
                                                        }
                                                    } else if (triggerField.type === 'checkbox') {
                                                        if (typeof addTriggerCheckbox !== 'function') {

                                                            return;
                                                        }
                                                        addTriggerCheckbox(question.questionId, fieldOrder, sequenceIndex + 1);
                                                        // Set the trigger checkbox field values
                                                        const triggerCheckboxFieldNameEl = document.getElementById('triggerCheckboxFieldName' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1));
                                                        if (triggerCheckboxFieldNameEl) triggerCheckboxFieldNameEl.value = triggerField.fieldName;
                                                        // Set the selection type
                                                        const triggerCheckboxSelectionTypeEl = document.getElementById('triggerCheckboxSelectionType' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1));
                                                        if (triggerCheckboxSelectionTypeEl && triggerField.selectionType) {
                                                            triggerCheckboxSelectionTypeEl.value = triggerField.selectionType;
                                                        }
                                                        // Add trigger checkbox options
                                                        if (triggerField.options && triggerField.options.length > 0) {
                                                            triggerField.options.forEach((option, optionIndex) => {
                                                                addTriggerCheckboxOption(question.questionId, fieldOrder, sequenceIndex + 1, triggerFieldIndex + 1);
                                                                // Set the trigger option values
                                                                const triggerOptionTextEl = document.getElementById('triggerCheckboxOptionText' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1) + '_' + (optionIndex + 1));
                                                                const triggerOptionNodeIdEl = document.getElementById('triggerCheckboxOptionNodeId' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (triggerFieldIndex + 1) + '_' + (optionIndex + 1));
                                                                if (triggerOptionTextEl) triggerOptionTextEl.value = option.text;
                                                                if (triggerOptionNodeIdEl) triggerOptionNodeIdEl.value = option.nodeId;
                                                            });
                                                        }
                                                        // Restore conditional logic if enabled
                                                        if (triggerField.conditionalLogic && triggerField.conditionalLogic.enabled) {
                                                            const triggerFieldCount = triggerFieldIndex + 1;
                                                            const key = `${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`;
                                                            if (!window.triggerCheckboxConditionalLogic) {
                                                                window.triggerCheckboxConditionalLogic = {};
                                                            }
                                                            window.triggerCheckboxConditionalLogic[key] = {
                                                                enabled: true,
                                                                conditions: [...(triggerField.conditionalLogic.conditions || [])]
                                                            };
                                                            setTimeout(() => {
                                                                const enableConditionalLogicCheckbox = document.getElementById(`enableConditionalLogicCheckbox${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`);
                                                                if (enableConditionalLogicCheckbox) {
                                                                    enableConditionalLogicCheckbox.checked = true;
                                                                    const event = new Event('change');
                                                                    enableConditionalLogicCheckbox.dispatchEvent(event);
                                                                    setTimeout(() => {
                                                                        if (triggerField.conditionalLogic.conditions && triggerField.conditionalLogic.conditions.length > 0) {
                                                                            if (typeof updateTriggerCheckboxConditionalLogicUI === 'function') {
                                                                                updateTriggerCheckboxConditionalLogicUI(question.questionId, fieldOrder, sequenceIndex + 1, triggerFieldCount);
                                                                                setTimeout(() => {
                                                                                    triggerField.conditionalLogic.conditions.forEach((condition, condIndex) => {
                                                                                        if (condIndex > 0) {
                                                                                            const addConditionBtn = document.querySelector(`#conditionalLogicUICheckbox${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} button`);
                                                                                            if (addConditionBtn && addConditionBtn.textContent === 'Add Another Condition') {
                                                                                                addConditionBtn.click();
                                                                                            }
                                                                                        }
                                                                                        setTimeout(() => {
                                                                                            const conditionDropdown = document.querySelector(`#conditionalLogicUICheckbox${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                            if (conditionDropdown) {
                                                                                                conditionDropdown.value = condition;
                                                                                                conditionDropdown.dispatchEvent(new Event('change'));
                                                                                            }
                                                                                        }, 150 * (condIndex + 1));
                                                                                    });
                                                                                }, 300);
                                                                            }
                                                                        }
                                                                    }, 400);
                                                                }
                                                            }, 200);
                                                        }
                                                        } else if (triggerField.type === 'dropdown') {
                                                            if (typeof addTriggerDropdown !== 'function') {

                                                                return;
                                                            }
                                                            addTriggerDropdown(question.questionId, fieldOrder, sequenceIndex + 1);
                                                            // Get the actual field count from the container (more reliable than using index)
                                                            const triggerFieldsContainer = document.getElementById(`triggerFields${question.questionId}_${fieldOrder}_${sequenceIndex + 1}`);
                                                            const actualFieldCount = triggerFieldsContainer ? triggerFieldsContainer.children.length : (triggerFieldIndex + 1);
                                                            // Set the trigger dropdown field values
                                                            const triggerDropdownFieldNameEl = document.getElementById('triggerDropdownFieldName' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + actualFieldCount);
                                                            if (triggerDropdownFieldNameEl) triggerDropdownFieldNameEl.value = triggerField.fieldName;
                                                            // Add trigger dropdown options
                                                            if (triggerField.options && triggerField.options.length > 0) {
                                                                triggerField.options.forEach((option, optionIndex) => {
                                                                    addTriggerDropdownOption(question.questionId, fieldOrder, sequenceIndex + 1, actualFieldCount);
                                                                    // Set the trigger option values
                                                                    const triggerOptionTextEl = document.getElementById('triggerDropdownOptionText' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + actualFieldCount + '_' + (optionIndex + 1));
                                                                    if (triggerOptionTextEl) triggerOptionTextEl.value = option.text;
                                                                });
                                                            }
                                                            // Restore conditional logic if enabled (after options are added)
                                                            if (triggerField.conditionalLogic && triggerField.conditionalLogic.enabled) {

                                                            // Initialize the data structure first (use actualFieldCount)
                                                            const key = `${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount}`;
                                                            if (!window.triggerDropdownConditionalLogic) {
                                                                window.triggerDropdownConditionalLogic = {};
                                                            }
                                                            window.triggerDropdownConditionalLogic[key] = {
                                                                enabled: true,
                                                                conditions: [...(triggerField.conditionalLogic.conditions || [])]
                                                            };

                                                            // Wait for options to be added before restoring conditional logic
                                                            setTimeout(() => {
                                                                const enableConditionalLogicCheckbox = document.getElementById(`enableConditionalLogicDropdown${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount}`);

                                                                if (enableConditionalLogicCheckbox) {
                                                                    enableConditionalLogicCheckbox.checked = true;

                                                                    // Manually trigger the change event to update the UI
                                                                    const event = new Event('change');
                                                                    enableConditionalLogicCheckbox.dispatchEvent(event);
                                                                    // Set the conditions after a delay to ensure UI is ready
                                                                    setTimeout(() => {
                                                                        if (triggerField.conditionalLogic.conditions && triggerField.conditionalLogic.conditions.length > 0) {

                                                                            // Update the UI with the conditions
                                                                            if (typeof updateTriggerDropdownConditionalLogicUI === 'function') {
                                                                                updateTriggerDropdownConditionalLogicUI(question.questionId, fieldOrder, sequenceIndex + 1, actualFieldCount);
                                                                                // Set the condition values after UI is updated
                                                                                setTimeout(() => {

                                                                                    triggerField.conditionalLogic.conditions.forEach((condition, condIndex) => {

                                                                                        // Add condition if needed
                                                                                        if (condIndex > 0) {
                                                                                            const addConditionBtn = document.querySelector(`#conditionalLogicUIDropdown${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount} button`);
                                                                                            if (addConditionBtn && addConditionBtn.textContent === 'Add Another Condition') {

                                                                                                addConditionBtn.click();
                                                                                                // Wait a bit for the new dropdown to be created
                                                                                                setTimeout(() => {
                                                                                                    const conditionDropdown = document.querySelector(`#conditionalLogicUIDropdown${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                                    if (conditionDropdown) {
                                                                                                        conditionDropdown.value = condition;
                                                                                                        conditionDropdown.dispatchEvent(new Event('change'));

                                                                                                    } else {

                                                                                                    }
                                                                                                }, 100);
                                                                                                return;
                                                                                            }
                                                                                        }
                                                                                        // Set the condition value for the first condition or after adding
                                                                                        setTimeout(() => {
                                                                                            const conditionDropdown = document.querySelector(`#conditionalLogicUIDropdown${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${actualFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                            if (conditionDropdown) {
                                                                                                conditionDropdown.value = condition;
                                                                                                conditionDropdown.dispatchEvent(new Event('change'));

                                                                                            } else {

                                                                                            }
                                                                                        }, 150 * (condIndex + 1));
                                                                                    });
                                                                                }, 300);
                                                                            } else {

                                                                            }
                                                                        }
                                                                    }, 400);
                                                                } else {

                                                                }
                                                            }, 200);
                                                        }
                                                    } else if (triggerField.type === 'date') {

                                                        if (typeof addTriggerDate !== 'function') {

                                                            return;
                                                        }
                                                        addTriggerDate(question.questionId, fieldOrder, sequenceIndex + 1);
                                                        // Calculate the correct triggerFieldCount by finding the date field we just created
                                                        // The field count is based on the number of fields in the container
                                                        const triggerFieldsContainer = document.getElementById(`triggerFields${question.questionId}_${fieldOrder}_${sequenceIndex + 1}`);
                                                        let triggerFieldCount = triggerFieldIndex + 1;

                                                        // Try to find the actual field count by matching the nodeId
                                                        if (triggerFieldsContainer) {
                                                            const allFields = triggerFieldsContainer.querySelectorAll('[class*="trigger-field-"]');

                                                            for (let i = 0; i < allFields.length; i++) {
                                                                const fieldEl = allFields[i];
                                                                const nodeIdInput = fieldEl.querySelector(`#triggerDateNodeId${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${i + 1}`);

                                                                if (nodeIdInput && nodeIdInput.value === triggerField.nodeId) {
                                                                    triggerFieldCount = i + 1;

                                                                    break;
                                                                }
                                                            }
                                                        }
                                                        // Set the trigger date field values
                                                        const triggerDateLabelEl = document.getElementById('triggerDateLabel' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + triggerFieldCount);
                                                        const triggerDateNodeIdEl = document.getElementById('triggerDateNodeId' + question.questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + triggerFieldCount);

                                                        if (triggerDateLabelEl) triggerDateLabelEl.value = triggerField.label;
                                                        if (triggerDateNodeIdEl) triggerDateNodeIdEl.value = triggerField.nodeId;
                                                        // Restore conditional logic if enabled

                                                        if (triggerField.conditionalLogic && triggerField.conditionalLogic.enabled) {

                                                            // Initialize the data structure first
                                                            const key = `${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`;
                                                            if (!window.triggerDateConditionalLogic) {
                                                                window.triggerDateConditionalLogic = {};
                                                            }
                                                            window.triggerDateConditionalLogic[key] = {
                                                                enabled: true,
                                                                conditions: [...(triggerField.conditionalLogic.conditions || [])]
                                                            };

                                                            setTimeout(() => {
                                                                const checkboxId = `enableConditionalLogic${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount}`;

                                                                const enableConditionalLogicCheckbox = document.getElementById(checkboxId);

                                                                if (enableConditionalLogicCheckbox) {

                                                                    enableConditionalLogicCheckbox.checked = true;

                                                                    // Manually trigger the change event to update the UI
                                                                    const event = new Event('change');
                                                                    enableConditionalLogicCheckbox.dispatchEvent(event);

                                                                    // Set the conditions after a delay to ensure UI is ready
                                                                    setTimeout(() => {
                                                                        if (triggerField.conditionalLogic.conditions && triggerField.conditionalLogic.conditions.length > 0) {

                                                                            // Update the UI with the conditions
                                                                            if (typeof updateTriggerDateConditionalLogicUI === 'function') {

                                                                                updateTriggerDateConditionalLogicUI(question.questionId, fieldOrder, sequenceIndex + 1, triggerFieldCount);
                                                                                // Set the condition values after UI is updated
                                                                                setTimeout(() => {

                                                                                    triggerField.conditionalLogic.conditions.forEach((condition, condIndex) => {

                                                                                        // Add condition if needed
                                                                                        if (condIndex > 0) {
                                                                                            const addConditionBtn = document.querySelector(`#conditionalLogicUI${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} button`);

                                                                                            if (addConditionBtn && addConditionBtn.textContent === 'Add Another Condition') {

                                                                                                addConditionBtn.click();
                                                                                                // Wait a bit for the new dropdown to be created
                                                                                                setTimeout(() => {
                                                                                                    const conditionDropdown = document.querySelector(`#conditionalLogicUI${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} select:nth-of-type(${condIndex + 1})`);
                                                                                                    if (conditionDropdown) {
                                                                                                        conditionDropdown.value = condition;
                                                                                                        conditionDropdown.dispatchEvent(new Event('change'));

                                                                                                    } else {

                                                                                                    }
                                                                                                }, 150);
                                                                                                return;
                                                                                            }
                                                                                        }
                                                                                        // Set the condition value for the first condition or after adding
                                                                                        setTimeout(() => {
                                                                                            const conditionDropdown = document.querySelector(`#conditionalLogicUI${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldCount} select:nth-of-type(${condIndex + 1})`);

                                                                                            if (conditionDropdown) {
                                                                                                conditionDropdown.value = condition;
                                                                                                conditionDropdown.dispatchEvent(new Event('change'));

                                                                                            } else {

                                                                                            }
                                                                                        }, 200 * (condIndex + 1));
                                                                                    });
                                                                                }, 400);
                                                                            } else {

                                                                            }
                                                                        }
                                                                    }, 500);
                                                                } else {

                                                                    // Try to find all checkboxes with similar IDs for debugging
                                                                    const allCheckboxes = document.querySelectorAll(`input[id^="enableConditionalLogic${question.questionId}_${fieldOrder}_${sequenceIndex + 1}"]`);

                                                                    allCheckboxes.forEach((cb, idx) => {

                                                                    });
                                                                }
                                                            }, 300);
                                                        } else {

                                                        }
                                                    } else if (triggerField.type === 'pdf') {
                                                        if (typeof addTriggerPdf !== 'function') {

                                                            return;
                                                        }
                                                        addTriggerPdf(question.questionId, fieldOrder, sequenceIndex + 1);
                                                        // Set the PDF field values
                                                        setTimeout(() => {
                                                            const pdfNumberEl = document.getElementById(`triggerPdfNumber${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldIndex + 1}`);
                                                            const pdfTitleEl = document.getElementById(`triggerPdfTitle${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldIndex + 1}`);
                                                            const pdfNameEl = document.getElementById(`triggerPdfName${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldIndex + 1}`);
                                                            const pdfPriceIdEl = document.getElementById(`triggerPdfPriceId${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldIndex + 1}`);
                                                            if (pdfNumberEl && triggerField.number) {
                                                                pdfNumberEl.value = triggerField.number;
                                                            }
                                                            if (pdfTitleEl && triggerField.pdfTitle) {
                                                                pdfTitleEl.value = triggerField.pdfTitle;
                                                            }
                                                            if (pdfNameEl && triggerField.pdfName) {
                                                                pdfNameEl.value = triggerField.pdfName;
                                                            }
                                                            if (pdfPriceIdEl && triggerField.priceId) {
                                                                pdfPriceIdEl.value = triggerField.priceId;
                                                            }
                                                        }, 100);
                                                    } else if (triggerField.type === 'location') {
                                                        // Handle simplified location field format ("Location Data Added")
                                                        if (typeof addTriggerLocation !== 'function') {

                                                            return;
                                                        }
                                                        addTriggerLocation(question.questionId, fieldOrder, sequenceIndex + 1);
                                                        // Set the location title if provided
                                                        setTimeout(() => {
                                                            const locationTitleEl = document.getElementById(`triggerLocationTitle${question.questionId}_${fieldOrder}_${sequenceIndex + 1}_${triggerFieldIndex + 1}`);
                                                            if (locationTitleEl && triggerField.fieldName) {
                                                                locationTitleEl.value = triggerField.fieldName;
                                                            }
                                                        }, 100);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                }
                            }
                        });
                        // Also rebuild hidden containers for backward compatibility
                        updateHiddenContainers(question.questionId);
                    }
                    // After setting min/max values, update any jump logic dropdowns
                    // This ensures the number range options are populated correctly
                    if (question.jump && question.jump.enabled) {
                        updateJumpOptionsForNumberedDropdown(question.questionId);
                    }
                }
                else if (
                    // Text-like question types
                    question.type === 'text' ||
                    question.type === 'radio' ||
                    question.type === 'money' ||
                    question.type === 'currency' ||
                    question.type === 'date' ||
                    question.type === 'email' ||
                    question.type === 'phone' ||
                    question.type === 'dateRange'
                ) {
                    const nameInput = questionBlock.querySelector(`#textboxName${question.questionId}`);
                    const placeholderInput = questionBlock.querySelector(`#textboxPlaceholder${question.questionId}`);
                    if (nameInput) {
                        nameInput.value = question.nameId || '';
                    }
                    if (placeholderInput) {
                        placeholderInput.value = question.placeholder || '';
                    }
                }
                else if (question.type === 'bigParagraph') {
                    const nameInput = questionBlock.querySelector(`#textboxName${question.questionId}`);
                    const placeholderInput = questionBlock.querySelector(`#textboxPlaceholder${question.questionId}`);
                    const lineLimitInput = questionBlock.querySelector(`#lineLimit${question.questionId}`);
                    const maxCharacterLimitInput = questionBlock.querySelector(`#maxCharacterLimit${question.questionId}`);
                    const paragraphLimitInput = questionBlock.querySelector(`#paragraphLimit${question.questionId}`);
                    if (nameInput) {
                        nameInput.value = question.nameId || '';
                    }
                    if (placeholderInput) {
                        placeholderInput.value = question.placeholder || '';
                    }
                    if (lineLimitInput && question.lineLimit) {
                        lineLimitInput.value = question.lineLimit;
                    }
                    if (maxCharacterLimitInput && question.maxCharacterLimit) {
                        maxCharacterLimitInput.value = question.maxCharacterLimit;
                    }
                    if (paragraphLimitInput && question.paragraphLimit) {
                        paragraphLimitInput.value = question.paragraphLimit;
                    }
                }
                // ============== MULTIPLE OR logic ==============
                if (question.logic && question.logic.enabled) {
                    const logicCbox = questionBlock.querySelector(`#logic${question.questionId}`);
                    if (logicCbox) {
                        logicCbox.checked = true;
                        toggleLogic(question.questionId);
                    }
                    const logicConditionsDiv = questionBlock.querySelector(`#logicConditions${question.questionId}`);
                    (question.logic.conditions || []).forEach((cond, idx) => {
                        addLogicCondition(question.questionId);
                        const rowId = idx + 1;
                        const pq = questionBlock.querySelector(`#prevQuestion${question.questionId}_${rowId}`);
                        const pa = questionBlock.querySelector(`#prevAnswer${question.questionId}_${rowId}`);
                        if (pq) pq.value = cond.prevQuestion;
                        updateLogicAnswersForRow(question.questionId, rowId);
                        // Handle text questions with hidden inputs
                        if (pa && pa.style.display === 'none') {
                            // For text questions, set the hidden input value
                            const hiddenInput = document.getElementById(`hiddenAnswer${question.questionId}_${rowId}`);
                            if (hiddenInput) {
                                hiddenInput.value = cond.prevAnswer || "Any Text";
                            }
                        } else if (pa) {
                            // For other question types, set the select value
                            pa.value = cond.prevAnswer;
                        }
                    });
                }
              // ===== Updated Jump Logic Import =====
                if (question.jump && question.jump.enabled) {
                    const jumpCbox = questionBlock.querySelector(`#enableJump${question.questionId}`);
                    if (jumpCbox) {
                        jumpCbox.checked = true;
                        toggleJumpLogic(question.questionId);
                    }
                    // Clear any existing conditions
                    const jumpConditionsDiv = questionBlock.querySelector(`#jumpConditions${question.questionId}`);
                    if (jumpConditionsDiv) jumpConditionsDiv.innerHTML = '';
                    // For numbered dropdown, populate options based on min/max first
                    if (question.type === 'numberedDropdown') {
                        updateJumpOptionsForNumberedDropdown(question.questionId);
                    }
                    // Add all conditions from import
                    (question.jump.conditions || []).forEach((cond, index) => {
                        addJumpCondition(question.questionId);
                        const conditionId = index + 1;
                        // Update options for the dropdown based on question type (skip for textbox and date questions)
                        const isTextboxQuestion = question.type === 'text' || question.type === 'bigParagraph' || question.type === 'money' || question.type === 'currency' || question.type === 'date' || question.type === 'dateRange';
                        if (!isTextboxQuestion) {
                            if (question.type === 'dropdown') {
                                updateJumpOptions(question.questionId, conditionId);
                            } else if (question.type === 'radio') {
                                updateJumpOptionsForRadio(question.questionId, conditionId);
                            } else if (question.type === 'checkbox') {
                                updateJumpOptionsForCheckbox(question.questionId, conditionId);
                            } else if (question.type === 'numberedDropdown') {
                                updateJumpOptionsForNumberedDropdown(question.questionId, conditionId);
                            }
                        }
                        // Set the values based on question type
                        const jumpOptionSelect = questionBlock.querySelector(`#jumpOption${question.questionId}_${conditionId}`);
                        const jumpToInput = questionBlock.querySelector(`#jumpTo${question.questionId}_${conditionId}`);
                        if (!isTextboxQuestion && jumpOptionSelect) {
                            jumpOptionSelect.value = cond.option;
                        }
                        if (jumpToInput) {
                            jumpToInput.value = cond.to;
                        }
                    });
                }
                // ============== Conditional PDF ==============
                if (question.conditionalPDF && question.conditionalPDF.enabled) {
                    const pdfCbox = questionBlock.querySelector(`#enableConditionalPDF${question.questionId}`);
                    if (pdfCbox) {
                        pdfCbox.checked = true;
                        toggleConditionalPDFLogic(question.questionId);
                    }
                    const pdfNameInput = questionBlock.querySelector(`#conditionalPDFName${question.questionId}`);
                    const pdfAnswerSelect = questionBlock.querySelector(`#conditionalPDFAnswer${question.questionId}`);
                    if (pdfNameInput) {
                        pdfNameInput.value = question.conditionalPDF.pdfName;
                    }
                    if (pdfAnswerSelect) {
                        pdfAnswerSelect.value = question.conditionalPDF.answer;
                    }
                }
                // ============== Hidden Logic ==============
                if (question.hiddenLogic && question.hiddenLogic.enabled) {
                    const hiddenLogicCbox = questionBlock.querySelector(`#enableHiddenLogic${question.questionId}`);
                    if (hiddenLogicCbox) {
                        hiddenLogicCbox.checked = true;
                        toggleHiddenLogic(question.questionId);
                        // Update hidden logic trigger options for numbered dropdown
                        if (question.type === 'numberedDropdown') {

                            setTimeout(() => {

                                updateHiddenLogicTriggerOptionsForNumberedDropdown(question.questionId);
                            }, 100);
                        }
                    }
                    // Clear existing configurations
                    const configsContainer = questionBlock.querySelector(`#hiddenLogicConfigs${question.questionId}`);
                    if (configsContainer) {
                        configsContainer.innerHTML = '';
                    }
                    // Restore configurations
                    if (question.hiddenLogic.configs && question.hiddenLogic.configs.length > 0) {
                        question.hiddenLogic.configs.forEach((config, index) => {
                            // Add configuration
                            addHiddenLogicConfig(question.questionId);
                            // Wait for DOM to update, then set values
                            setTimeout(() => {
                                const triggerSelect = questionBlock.querySelector(`#hiddenLogicTrigger${question.questionId}_${index}`);
                                const typeSelect = questionBlock.querySelector(`#hiddenLogicType${question.questionId}_${index}`);
                                const nodeIdInput = questionBlock.querySelector(`#hiddenLogicNodeId${question.questionId}_${index}`);
                                const textboxTextInput = questionBlock.querySelector(`#hiddenLogicTextboxText${question.questionId}_${index}`);
                                if (triggerSelect) {
                                    triggerSelect.value = config.trigger;
                                }
                                if (typeSelect) {
                                    typeSelect.value = config.type;
                                    toggleHiddenLogicOptions(question.questionId, index);
                                }
                                if (nodeIdInput) {
                                    nodeIdInput.value = config.nodeId;
                                }
                                if (textboxTextInput) {
                                    textboxTextInput.value = config.textboxText;
                                }
                            }, 50); // Increased timeout to ensure DOM is ready
                        });
                    }
                    // Update hidden logic trigger options for numbered dropdown
                    if (question.type === 'numberedDropdown') {

                        setTimeout(() => {

                            updateHiddenLogicTriggerOptionsForNumberedDropdown(question.questionId);
                        }, 50);
                    }
                }
                // ============== PDF Logic ==============
                if (question.pdfLogic && question.pdfLogic.enabled) {
                    const pdfLogicCbox = questionBlock.querySelector(`#pdfLogic${question.questionId}`);
                    if (pdfLogicCbox) {
                        pdfLogicCbox.checked = true;
                        togglePdfLogic(question.questionId);
                    }
                    // Load multiple PDFs with trigger options
                    if (question.pdfLogic.pdfs && question.pdfLogic.pdfs.length > 0) {
                        const pdfDetailsContainer = questionBlock.querySelector(`#pdfDetailsContainer${question.questionId}`);
                        if (pdfDetailsContainer) {
                            // Clear existing PDF groups except the first one
                            const existingPdfGroups = pdfDetailsContainer.querySelectorAll('.pdf-detail-group');
                            for (let i = 1; i < existingPdfGroups.length; i++) {
                                existingPdfGroups[i].remove();
                            }
                            // Load each PDF
                            question.pdfLogic.pdfs.forEach((pdf, pdfIndex) => {
                                const pdfIndexNum = pdfIndex + 1;
                                if (pdfIndexNum === 1) {
                                    // Update the first PDF group
                                    const pdfLogicPdfNameInput = questionBlock.querySelector(`#pdfLogicPdfName${question.questionId}_1`);
                    if (pdfLogicPdfNameInput) {
                                        pdfLogicPdfNameInput.value = pdf.pdfName || "";
                                    }
                                    const pdfLogicPdfDisplayNameInput = questionBlock.querySelector(`#pdfLogicPdfDisplayName${question.questionId}_1`);
                                    if (pdfLogicPdfDisplayNameInput) {
                                        pdfLogicPdfDisplayNameInput.value = pdf.pdfDisplayName || "";
                                    }
                                    const pdfLogicStripePriceIdInput = questionBlock.querySelector(`#pdfLogicStripePriceId${question.questionId}_1`);
                                    if (pdfLogicStripePriceIdInput) {
                                        pdfLogicStripePriceIdInput.value = pdf.stripePriceId || "";
                                    }
                                const triggerOptionSelect = questionBlock.querySelector(`#pdfLogicTriggerOption${question.questionId}`);
                                if (triggerOptionSelect && pdf.triggerOption) {
                                    triggerOptionSelect.value = pdf.triggerOption;
                                }
                                // Load number trigger fields for number questions
                                if (question.type === 'number') {
                                    const numberTriggerSelect = questionBlock.querySelector(`#pdfLogicNumberTrigger${question.questionId}`);
                                    const numberValueInput = questionBlock.querySelector(`#pdfLogicNumberValue${question.questionId}`);
                                    if (numberTriggerSelect && pdf.numberTrigger) {
                                        numberTriggerSelect.value = pdf.numberTrigger;
                                    }
                                    if (numberValueInput && pdf.numberValue) {
                                        numberValueInput.value = pdf.numberValue;
                                    }
                                }
                                // Load extra PDFs for this PDF group
                                // Note: We'll need to handle this differently since extra PDFs are added dynamically
                                // For now, we'll store them and add them after the main PDF is loaded
                                } else {
                                    // Add additional PDF groups
                                    addAnotherPdf(question.questionId);
                                    // Set the values for the new PDF group
                                    setTimeout(() => {
                                        const pdfLogicPdfNameInput = questionBlock.querySelector(`#pdfLogicPdfName${question.questionId}_${pdfIndexNum}`);
                                        if (pdfLogicPdfNameInput) {
                                            pdfLogicPdfNameInput.value = pdf.pdfName || "";
                                        }
                                        const pdfLogicPdfDisplayNameInput = questionBlock.querySelector(`#pdfLogicPdfDisplayName${question.questionId}_${pdfIndexNum}`);
                                        if (pdfLogicPdfDisplayNameInput) {
                                            pdfLogicPdfDisplayNameInput.value = pdf.pdfDisplayName || "";
                                        }
                                        const pdfLogicStripePriceIdInput = questionBlock.querySelector(`#pdfLogicStripePriceId${question.questionId}_${pdfIndexNum}`);
                                        if (pdfLogicStripePriceIdInput) {
                                            pdfLogicStripePriceIdInput.value = pdf.stripePriceId || "";
                                        }
                                        const triggerOptionSelect = questionBlock.querySelector(`#pdfLogicTriggerOption${question.questionId}_${pdfIndexNum}`);
                                        if (triggerOptionSelect && pdf.triggerOption) {
                                            triggerOptionSelect.value = pdf.triggerOption;
                                        }
                                        // Load number trigger fields for number questions (additional PDFs)
                                        if (question.type === 'number') {
                                            const numberTriggerSelect = questionBlock.querySelector(`#pdfLogicNumberTrigger${question.questionId}`);
                                            const numberValueInput = questionBlock.querySelector(`#pdfLogicNumberValue${question.questionId}`);
                                            if (numberTriggerSelect && pdf.numberTrigger) {
                                                numberTriggerSelect.value = pdf.numberTrigger;
                                            }
                                            if (numberValueInput && pdf.numberValue) {
                                                numberValueInput.value = pdf.numberValue;
                                            }
                                        }
                                    }, 100);
                                }
                            });
                        }
                    } else {
                        // Handle legacy single PDF structure
                        const pdfLogicPdfNameInput = questionBlock.querySelector(`#pdfLogicPdfName${question.questionId}_1`);
                        if (pdfLogicPdfNameInput && question.pdfLogic.pdfName) {
                        pdfLogicPdfNameInput.value = question.pdfLogic.pdfName;
                    }
                        const pdfLogicPdfDisplayNameInput = questionBlock.querySelector(`#pdfLogicPdfDisplayName${question.questionId}_1`);
                    if (pdfLogicPdfDisplayNameInput && question.pdfLogic.pdfDisplayName) {
                        pdfLogicPdfDisplayNameInput.value = question.pdfLogic.pdfDisplayName;
                    }
                        const pdfLogicStripePriceIdInput = questionBlock.querySelector(`#pdfLogicStripePriceId${question.questionId}_1`);
                        if (pdfLogicStripePriceIdInput && question.pdfLogic.stripePriceId) {
                            pdfLogicStripePriceIdInput.value = question.pdfLogic.stripePriceId;
                        }
                    }
                    // Load PDF Logic conditions
                    if (question.pdfLogic.conditions && question.pdfLogic.conditions.length > 0) {
                        question.pdfLogic.conditions.forEach((condition, index) => {
                            addPdfLogicCondition(question.questionId);
                            const conditionIndex = index + 1;
                            // Check if this is a Big Paragraph question with character limit logic
                            if (question.type === 'bigParagraph' && condition.characterLimit) {
                                const charLimitSelect = questionBlock.querySelector(`#pdfCharacterLimit${question.questionId}_${conditionIndex}`);
                                const customCharLimitInput = questionBlock.querySelector(`#pdfCustomCharacterLimit${question.questionId}_${conditionIndex}`);
                                if (charLimitSelect) {
                                    // Check if the character limit matches a preset option
                                    const presetLimits = ['50', '100', '200', '300', '500', '750', '1000', '1500', '2000'];
                                    if (presetLimits.includes(condition.characterLimit.toString())) {
                                        charLimitSelect.value = condition.characterLimit.toString();
                                        if (customCharLimitInput) {
                                            customCharLimitInput.style.display = 'none';
                                        }
                                    } else {
                                        // Set to custom and show the custom input
                                        charLimitSelect.value = 'custom';
                                        if (customCharLimitInput) {
                                            customCharLimitInput.style.display = 'block';
                                            customCharLimitInput.value = condition.characterLimit.toString();
                                        }
                                    }
                                }
                            } else if (condition.prevQuestion && condition.prevAnswer) {
                                // For other question types, use previous question logic
                                const prevQuestionInput = questionBlock.querySelector(`#pdfPrevQuestion${question.questionId}_${conditionIndex}`);
                                const prevAnswerSelect = questionBlock.querySelector(`#pdfPrevAnswer${question.questionId}_${conditionIndex}`);
                                if (prevQuestionInput) {
                                    prevQuestionInput.value = condition.prevQuestion;
                                    updatePdfLogicAnswersForRow(question.questionId, conditionIndex);
                                }
                                if (prevAnswerSelect) {
                                    prevAnswerSelect.value = condition.prevAnswer;
                                }
                            }
                        });
                    }
                }
                // ============== Alert Logic ==============
                if (question.alertLogic && question.alertLogic.enabled) {
                    const alertLogicCbox = questionBlock.querySelector(`#alertLogic${question.questionId}`);
                    if (alertLogicCbox) {
                        alertLogicCbox.checked = true;
                        toggleAlertLogic(question.questionId);
                    }
                    const alertLogicMessageInput = questionBlock.querySelector(`#alertLogicMessage${question.questionId}`);
                    if (alertLogicMessageInput) {
                        alertLogicMessageInput.value = question.alertLogic.message;
                    }
                    // Load Alert Logic conditions
                    if (question.alertLogic.conditions && question.alertLogic.conditions.length > 0) {
                        question.alertLogic.conditions.forEach((condition, index) => {
                            addAlertLogicCondition(question.questionId);
                            const conditionIndex = index + 1;
                            const prevQuestionInput = questionBlock.querySelector(`#alertPrevQuestion${question.questionId}_${conditionIndex}`);
                            const prevAnswerSelect = questionBlock.querySelector(`#alertPrevAnswer${question.questionId}_${conditionIndex}`);
                            if (prevQuestionInput) {
                                prevQuestionInput.value = condition.prevQuestion;
                                updateAlertLogicAnswersForRow(question.questionId, conditionIndex);
                            }
                            if (prevAnswerSelect) {
                                prevAnswerSelect.value = condition.prevAnswer;
                            }
                        });
                    }
                }
                // ============== Checklist Logic ==============
                if (question.checklistLogic && question.checklistLogic.enabled) {
                    const checklistLogicCbox = questionBlock.querySelector(`#checklistLogic${question.questionId}`);
                    if (checklistLogicCbox) {
                        checklistLogicCbox.checked = true;
                        toggleChecklistLogic(question.questionId);
                    }
                    // Load Checklist Logic conditions
                    if (question.checklistLogic.conditions && question.checklistLogic.conditions.length > 0) {
                        question.checklistLogic.conditions.forEach((condition, index) => {
                            addChecklistLogicCondition(question.questionId);
                            const conditionIndex = index + 1;
                            const prevQuestionInput = questionBlock.querySelector(`#checklistPrevQuestion${question.questionId}_${conditionIndex}`);
                            const prevAnswerSelect = questionBlock.querySelector(`#checklistPrevAnswer${question.questionId}_${conditionIndex}`);
                            const checklistItemsTextarea = questionBlock.querySelector(`#checklistItemsToAdd${question.questionId}_${conditionIndex}`);
                            if (prevQuestionInput) {
                                prevQuestionInput.value = condition.prevQuestion;
                                updateChecklistLogicAnswersForRow(question.questionId, conditionIndex, () => {
                                    // Set the answer value after dropdown is populated
                                    const prevAnswerSelect = questionBlock.querySelector(`#checklistPrevAnswer${question.questionId}_${conditionIndex}`);
                                    if (prevAnswerSelect && condition.prevAnswer) {
                                        prevAnswerSelect.value = condition.prevAnswer;
                                    }
                                });
                            }
                            if (checklistItemsTextarea && condition.checklistItems) {
                                checklistItemsTextarea.value = condition.checklistItems.join('\n');
                            }
                        });
                    }
                }
                // ============== Conditional Alert ==============
                if (question.conditionalAlert && question.conditionalAlert.enabled) {
                    const alertCbox = questionBlock.querySelector(`#enableConditionalAlert${question.questionId}`);
                    if (alertCbox) {
                        alertCbox.checked = true;
                        toggleConditionalAlertLogic(question.questionId);
                    }
                    const alertPrevQ = questionBlock.querySelector(`#alertPrevQuestion${question.questionId}`);
                    const alertPrevA = questionBlock.querySelector(`#alertPrevAnswer${question.questionId}`);
                    const alertT     = questionBlock.querySelector(`#alertText${question.questionId}`);
                    if (alertPrevQ) alertPrevQ.value = question.conditionalAlert.prevQuestion;
                    if (alertPrevA) alertPrevA.value = question.conditionalAlert.prevAnswer;
                    if (alertT)     alertT.value     = question.conditionalAlert.text;
                }
            });
        });
    }
    // 6) Load checklist items if present
    if (formData.checklistItems && formData.checklistItems.length > 0) {
        // Create checklist container if it doesn't exist
        addChecklist();
        // Load checklist items
        formData.checklistItems.forEach((itemText, index) => {
            addChecklistItem();
            const checklistItemsContainer = document.getElementById('checklistItems');
            if (checklistItemsContainer) {
                const lastItem = checklistItemsContainer.lastElementChild;
                if (lastItem) {
                    const itemId = lastItem.id.replace('checklistItem', '');
                    const itemInput = document.getElementById(`checklistText${itemId}`);
                    if (itemInput) {
                        itemInput.value = itemText;
                    }
                }
            }
        });
    }
    // Load linked fields
    if (formData.linkedFields && formData.linkedFields.length > 0) {
        // Initialize linked fields configuration
        window.linkedFieldsConfig = [];
        linkedFieldCounter = 0;
        formData.linkedFields.forEach(linkedField => {
            // Create the linked field display
            createLinkedFieldDisplayFromImport(linkedField);
        });
    }
    // Load linked checkboxes
    if (formData.linkedCheckboxes && formData.linkedCheckboxes.length > 0) {
        // Initialize linked checkboxes configuration
        window.linkedCheckboxesConfig = [];
        linkedCheckboxCounter = 0;
        formData.linkedCheckboxes.forEach(linkedCheckbox => {
            // Create the linked checkbox display
            createLinkedCheckboxDisplayFromImport(linkedCheckbox);
        });
    }
    // Load inverse checkboxes
    if (formData.inverseCheckboxes && formData.inverseCheckboxes.length > 0) {
        // Initialize inverse checkboxes configuration
        window.inverseCheckboxesConfig = [];
        window.inverseCheckboxCounter = 0;
        formData.inverseCheckboxes.forEach(inverseCheckbox => {
            // Create the inverse checkbox display
            createInverseCheckboxDisplay(inverseCheckbox.targetCheckboxId, inverseCheckbox.inverseCheckboxId);
        });
    }
    // 7) Build groups from JSON
    if (formData.groups && formData.groups.length > 0) {
        // Debug log
        formData.groups.forEach(group => {
            addGroupWithData(group);
        });
    } else {
        // Debug log
    }
    // 8) Build hidden fields from JSON (including multi-term calculations)
    if (formData.hiddenFields && formData.hiddenFields.length > 0) {
        formData.hiddenFields.forEach(hiddenField => {
            // Before adding the hidden field, convert any question text references back to IDs
            if (hiddenField.calculations) {
                hiddenField.calculations.forEach(calc => {
                    if (calc.terms) {
                        calc.terms.forEach(term => {
                            if (term.questionNameId) {
                                // Look for pattern like "How many cars do you have_1_car_value"
                                const textMatch = term.questionNameId.match(/^(.+?)_(\d+)_(.+)$/);
                                if (textMatch) {
                                    const questionText = textMatch[1];
                                    const numValue = textMatch[2];
                                    const fieldValue = textMatch[3];
                                    // If we have this question text mapped to an ID, convert the reference
                                    if (questionTextToIdMap[questionText]) {
                                        term.questionNameId = `amount${questionTextToIdMap[questionText]}_${numValue}_${fieldValue}`;
                                    }
                                }
                            }
                        });
                    }
                });
            }
            addHiddenFieldWithData(hiddenField);
        });
    }
    // 9) Finally, re-run references (e.g. auto-fill dropdowns in hidden fields)
    updateFormAfterImport();
}
function exportForm() {
    const formData = {
        sections: [],
        groups: [],
        hiddenFields: [],
        sectionCounter: sectionCounter,
        questionCounter: questionCounter,
        hiddenFieldCounter: hiddenFieldCounter,
        groupCounter: groupCounter,
        formName: document.getElementById('formNameInput')
            ? document.getElementById('formNameInput').value.trim()
            : '',
        defaultPDFName: document.getElementById('formPDFName')
            ? document.getElementById('formPDFName').value.trim()
            : '',
        pdfOutputName: document.getElementById('pdfOutputName')
            ? document.getElementById('pdfOutputName').value.trim()
            : '',
        stripePriceId: document.getElementById('stripePriceId')
            ? document.getElementById('stripePriceId').value.trim()
            : '',
        additionalPDFs: [], // New field for additional PDFs
        checklistItems: [], // New field for checklist items
        linkedFields: [] // New field for linked fields
    };
    // Collect all additional PDF names
    const pdfGroups = document.querySelectorAll('.pdf-input-group');
    pdfGroups.forEach((group, index) => {
        if (index > 0) { // Skip the main PDF input (it's already in defaultPDFName)
            const input = group.querySelector('input');
            if (input && input.value.trim()) {
                formData.additionalPDFs.push(input.value.trim());
            }
        }
    });
    // Collect all checklist items
    const checklistItemsContainer = document.getElementById('checklistItems');
    if (checklistItemsContainer) {
        const checklistItemDivs = checklistItemsContainer.querySelectorAll('.checklist-item');
        checklistItemDivs.forEach(itemDiv => {
            const itemId = itemDiv.id.replace('checklistItem', '');
            const itemText = document.getElementById(`checklistText${itemId}`)?.value.trim();
            if (itemText) {
                formData.checklistItems.push(itemText);
            }
        });
    }
    // Collect all linked fields
    if (window.linkedFieldsConfig && window.linkedFieldsConfig.length > 0) {
        formData.linkedFields = window.linkedFieldsConfig.map(config => ({
            id: config.id,
            linkedFieldId: config.linkedFieldId,
            fields: config.fields
        }));
    }
    // Collect all linked checkboxes
    if (window.linkedCheckboxesConfig && window.linkedCheckboxesConfig.length > 0) {
        formData.linkedCheckboxes = window.linkedCheckboxesConfig.map(config => ({
            id: config.id,
            linkedCheckboxId: config.linkedCheckboxId,
            checkboxes: config.checkboxes
        }));
    } else {
        formData.linkedCheckboxes = [];
    }
    // Collect all inverse checkboxes
    if (window.inverseCheckboxesConfig && window.inverseCheckboxesConfig.length > 0) {
        formData.inverseCheckboxes = window.inverseCheckboxesConfig.map(config => ({
            id: config.id,
            inverseCheckboxId: config.inverseCheckboxId,
            targetCheckboxId: config.targetCheckboxId
        }));
    } else {
        formData.inverseCheckboxes = [];
    }
    // Create a map of questionId to question text for easy lookup
    const questionTextMap = {};
    // ========== Export sections and questions ==========
    for (let s = 1; s < sectionCounter; s++) {
        const sectionBlock = document.getElementById(`sectionBlock${s}`);
        if (!sectionBlock) continue;
        const sectionData = {
            sectionId: s,
            sectionName: document.getElementById(`sectionName${s}`).value || `Section ${s}`,
            questions: []
        };
        const questionsSection = sectionBlock.querySelectorAll('.question-block');
        questionsSection.forEach((questionBlock) => {
            const questionId = parseInt(questionBlock.id.replace('questionBlock', ''), 10);
            const questionText = questionBlock.querySelector(`#question${questionId}`).value;
            const questionType = questionBlock.querySelector(`#questionType${questionId}`).value;
            // Store the question text for each ID
            questionTextMap[questionId] = questionText;
            // ---------- Gather multiple OR logic ----------
            const logicEnabled = questionBlock.querySelector(`#logic${questionId}`)?.checked || false;
            const logicConditionsDiv = questionBlock.querySelector(`#logicConditions${questionId}`);
            const logicRows = logicConditionsDiv ? logicConditionsDiv.querySelectorAll('.logic-condition-row') : [];
            const conditionsArray = [];
            if (logicEnabled) {
                logicRows.forEach((row, idx) => {
                    const rowIndex = idx + 1;
                    const pqVal = row.querySelector(`#prevQuestion${questionId}_${rowIndex}`)?.value.trim() || "";
                    // Check if this is a text question (answer select is hidden)
                    const answerSelect = row.querySelector(`#prevAnswer${questionId}_${rowIndex}`);
                    let paVal = "";
                    if (answerSelect && answerSelect.style.display === 'none') {
                        // For text questions, get the value from the hidden input
                        const hiddenInput = document.getElementById(`hiddenAnswer${questionId}_${rowIndex}`);
                        paVal = hiddenInput ? hiddenInput.value.trim() : "Any Text";
                    } else {
                        // For other question types, get the value from the select dropdown
                        paVal = answerSelect?.value.trim() || "";
                    }
                    if (pqVal && paVal) {
                        conditionsArray.push({ prevQuestion: pqVal, prevAnswer: paVal });
                    }
                });
            }
            // ---------- Jump logic ----------
            const jumpEnabled = questionBlock.querySelector(`#enableJump${questionId}`)?.checked || false;
            const jumpConditions = [];
            if (jumpEnabled) {
                const jumpConditionDivs = questionBlock.querySelectorAll('.jump-condition');
                jumpConditionDivs.forEach(condDiv => {
                    const conditionId = condDiv.id.split('_')[1];
                    const jumpOption = condDiv.querySelector(`#jumpOption${questionId}_${conditionId}`)?.value || '';
                    const jumpTo = condDiv.querySelector(`#jumpTo${questionId}_${conditionId}`)?.value || '';
                    // For textbox and date questions, we only need the jumpTo field (no dropdown)
                    const isTextboxQuestion = questionType === 'text' || questionType === 'bigParagraph' || questionType === 'money' || questionType === 'currency' || questionType === 'date' || questionType === 'dateRange';
                    if (isTextboxQuestion && jumpTo) {
                        // For textbox and date questions, use "Any Text" as the option
                        jumpConditions.push({
                            option: "Any Text",
                            to: jumpTo
                        });
                    } else if (!isTextboxQuestion && jumpOption && jumpTo) {
                        // For other question types, require both option and jumpTo
                        jumpConditions.push({
                            option: jumpOption,
                            to: jumpTo
                        });
                    }
                });
            }
            // ---------- Conditional PDF logic ----------
            const condPDFEnabled = questionBlock.querySelector(`#enableConditionalPDF${questionId}`)?.checked || false;
            const condPDFName = questionBlock.querySelector(`#conditionalPDFName${questionId}`)?.value || "";
            const condPDFAnswer = questionBlock.querySelector(`#conditionalPDFAnswer${questionId}`)?.value || "";
            // ---------- Hidden Logic ----------
            const hiddenLogicEnabled = questionBlock.querySelector(`#enableHiddenLogic${questionId}`)?.checked || false;
            const hiddenLogicConfigs = [];
            if (hiddenLogicEnabled) {
                // Get all hidden logic configurations
                const configElements = questionBlock.querySelectorAll('.hidden-logic-config');
                configElements.forEach((configElement, index) => {
                    const trigger = configElement.querySelector(`#hiddenLogicTrigger${questionId}_${index}`)?.value || "";
                    const type = configElement.querySelector(`#hiddenLogicType${questionId}_${index}`)?.value || "";
                    const nodeId = configElement.querySelector(`#hiddenLogicNodeId${questionId}_${index}`)?.value || "";
                    const textboxText = configElement.querySelector(`#hiddenLogicTextboxText${questionId}_${index}`)?.value || "";
                    if (trigger && type && nodeId) {
                        hiddenLogicConfigs.push({
                            trigger: trigger,
                            type: type,
                            nodeId: nodeId,
                            textboxText: textboxText
                        });
                    }
                });
            }
            // ---------- PDF Logic ----------
            const pdfLogicEnabled = questionBlock.querySelector(`#pdfLogic${questionId}`)?.checked || false;
            // Debug logging for PDF logic

            // Collect PDF Logic conditions
            const pdfLogicConditionsArray = [];
            if (pdfLogicEnabled) {
                const pdfLogicConditionsDiv = questionBlock.querySelector(`#pdfLogicConditions${questionId}`);
                if (pdfLogicConditionsDiv) {
                    const pdfLogicConditionRows = pdfLogicConditionsDiv.querySelectorAll('.pdf-logic-condition-row');
                    pdfLogicConditionRows.forEach((row, index) => {
                        const conditionIndex = index + 1;
                        // Check if this is a Big Paragraph question with character limit logic
                        if (questionType === 'bigParagraph') {
                            const charLimitSelect = row.querySelector(`#pdfCharacterLimit${questionId}_${conditionIndex}`);
                            const customCharLimitInput = row.querySelector(`#pdfCustomCharacterLimit${questionId}_${conditionIndex}`);
                            if (charLimitSelect) {
                                let charLimit = charLimitSelect.value;
                                if (charLimit === 'custom' && customCharLimitInput) {
                                    charLimit = customCharLimitInput.value;
                                }
                                if (charLimit && charLimit !== '') {
                                    pdfLogicConditionsArray.push({
                                        characterLimit: parseInt(charLimit)
                                    });
                                }
                            }
                        } else {
                            // For other question types, use previous question logic
                            const prevQuestion = row.querySelector(`#pdfPrevQuestion${questionId}_${conditionIndex}`)?.value || "";
                            const prevAnswer = row.querySelector(`#pdfPrevAnswer${questionId}_${conditionIndex}`)?.value || "";
                            if (prevQuestion && prevAnswer) {
                                pdfLogicConditionsArray.push({
                                    prevQuestion: prevQuestion,
                                    prevAnswer: prevAnswer
                                });
                            }
                        }
                    });
                }
            }
            // Collect multiple PDFs with trigger options
            const pdfLogicPdfs = [];
            if (pdfLogicEnabled) {
                const pdfDetailsContainer = questionBlock.querySelector(`#pdfDetailsContainer${questionId}`);
                if (pdfDetailsContainer) {
                    const pdfGroups = pdfDetailsContainer.querySelectorAll('.pdf-detail-group');

                    pdfGroups.forEach((pdfGroup, pdfIndex) => {
                        const pdfIndexNum = pdfIndex + 1;
                        const pdfLogicPdfName = pdfGroup.querySelector(`#pdfLogicPdfName${questionId}_${pdfIndexNum}`)?.value || "";
                        const pdfLogicPdfDisplayName = pdfGroup.querySelector(`#pdfLogicPdfDisplayName${questionId}_${pdfIndexNum}`)?.value || "";
                        const pdfLogicStripePriceId = pdfGroup.querySelector(`#pdfLogicStripePriceId${questionId}_${pdfIndexNum}`)?.value || "";
                        // For the first PDF, look for the main trigger option dropdown
                        // For additional PDFs, look for the PDF-specific trigger option dropdown
                        let triggerOption = "";
                        if (pdfIndexNum === 1) {
                            // First PDF uses the main trigger option dropdown
                            const mainTriggerSelect = questionBlock.querySelector(`#pdfLogicTriggerOption${questionId}`);
                            triggerOption = mainTriggerSelect?.value || "";
                        } else {
                            // Additional PDFs use PDF-specific trigger option dropdowns
                            const pdfTriggerSelect = pdfGroup.querySelector(`#pdfLogicTriggerOption${questionId}_${pdfIndexNum}`);
                            triggerOption = pdfTriggerSelect?.value || "";
                        }
                        // Debug logging

                        if (pdfIndexNum === 1) {

                        } else {

                        }

                        // Check if trigger option block is visible
                        let triggerOptionBlock = null;
                        if (pdfIndexNum === 1) {
                            triggerOptionBlock = questionBlock.querySelector(`#triggerOptionBlock${questionId}`);
                        } else {
                            triggerOptionBlock = pdfGroup.querySelector(`#triggerOptionBlock${questionId}_${pdfIndexNum}`);
                        }
                        if (triggerOptionBlock) {

                        } else {

                        }
                        // Check if this is a numbered dropdown and trigger options should be available
                        if (questionType === 'numberedDropdown') {

                        } else {

                        }
                        // Check if the trigger option dropdown has options
                        let triggerSelect = null;
                        if (pdfIndexNum === 1) {
                            triggerSelect = questionBlock.querySelector(`#pdfLogicTriggerOption${questionId}`);
                        } else {
                            triggerSelect = pdfGroup.querySelector(`#pdfLogicTriggerOption${questionId}_${pdfIndexNum}`);
                        }
                        if (triggerSelect) {

                            for (let i = 0; i < triggerSelect.options.length; i++) {

                            }

                        }
                        // Get number trigger fields for number questions
                        let numberTrigger = "";
                        let numberValue = "";
                        if (questionType === 'number') {
                            const numberTriggerSelect = questionBlock.querySelector(`#pdfLogicNumberTrigger${questionId}`);
                            const numberValueInput = questionBlock.querySelector(`#pdfLogicNumberValue${questionId}`);
                            numberTrigger = numberTriggerSelect?.value || "";
                            numberValue = numberValueInput?.value || "";
                        }
                        if (pdfLogicPdfName || numberTrigger || numberValue) {
                            const pdfData = {
                                pdfName: pdfLogicPdfName,
                                pdfDisplayName: pdfLogicPdfDisplayName,
                                stripePriceId: pdfLogicStripePriceId,
                                triggerOption: triggerOption
                            };
                            // Add number trigger fields for number questions
                            if (questionType === 'number') {
                                pdfData.numberTrigger = numberTrigger;
                                pdfData.numberValue = numberValue;
                            }
                            pdfLogicPdfs.push(pdfData);
                        }
                        // Collect extra PDFs for this PDF group
                        const extraPdfContainers = pdfGroup.querySelectorAll('.extra-pdf-inputs');
                        extraPdfContainers.forEach((extraContainer, extraIndex) => {
                            const extraPdfIndex = extraIndex + 1;
                            const extraPdfName = extraContainer.querySelector(`#pdfLogicPdfName${questionId}_${pdfIndexNum}_extra${extraPdfIndex}`)?.value || "";
                            const extraPdfDisplayName = extraContainer.querySelector(`#pdfLogicPdfDisplayName${questionId}_${pdfIndexNum}_extra${extraPdfIndex}`)?.value || "";
                            const extraStripePriceId = extraContainer.querySelector(`#pdfLogicStripePriceId${questionId}_${pdfIndexNum}_extra${extraPdfIndex}`)?.value || "";
                            if (extraPdfName) {
                                pdfLogicPdfs.push({
                                    pdfName: extraPdfName,
                                    pdfDisplayName: extraPdfDisplayName,
                                    stripePriceId: extraStripePriceId,
                                    triggerOption: triggerOption // Same trigger option as the main PDF
                                });
                            }
                        });
                    });
                }
            }
            // ---------- Alert Logic ----------
            const alertLogicEnabled = questionBlock.querySelector(`#alertLogic${questionId}`)?.checked || false;
            const alertLogicMessage = questionBlock.querySelector(`#alertLogicMessage${questionId}`)?.value || "";
            // Collect Alert Logic conditions
            const alertLogicConditionsArray = [];
            if (alertLogicEnabled) {
                const alertLogicConditionsDiv = questionBlock.querySelector(`#alertLogicConditions${questionId}`);
                if (alertLogicConditionsDiv) {
                    const alertLogicConditionRows = alertLogicConditionsDiv.querySelectorAll('.alert-logic-condition-row');
                    alertLogicConditionRows.forEach((row, index) => {
                        const conditionIndex = index + 1;
                        const prevQuestion = row.querySelector(`#alertPrevQuestion${questionId}_${conditionIndex}`)?.value || "";
                        const prevAnswer = row.querySelector(`#alertPrevAnswer${questionId}_${conditionIndex}`)?.value || "";
                        if (prevQuestion && prevAnswer) {
                            alertLogicConditionsArray.push({
                                prevQuestion: prevQuestion,
                                prevAnswer: prevAnswer
                            });
                        }
                    });
                }
            }
            // ---------- Checklist Logic ----------
            const checklistLogicEnabled = questionBlock.querySelector(`#checklistLogic${questionId}`)?.checked || false;
            // Collect Checklist Logic conditions
            const checklistLogicConditionsArray = [];
            if (checklistLogicEnabled) {
                const checklistLogicContainer = questionBlock.querySelector(`#checklistLogicContainer${questionId}`);
                if (checklistLogicContainer) {
                    const checklistLogicConditionRows = checklistLogicContainer.querySelectorAll('.checklist-logic-condition-row');
                    checklistLogicConditionRows.forEach((row, index) => {
                        const conditionIndex = index + 1;
                        const prevQuestion = row.querySelector(`#checklistPrevQuestion${questionId}_${conditionIndex}`)?.value || "";
                        const prevAnswer = row.querySelector(`#checklistPrevAnswer${questionId}_${conditionIndex}`)?.value || "";
                        const checklistItems = row.querySelector(`#checklistItemsToAdd${questionId}_${conditionIndex}`)?.value || "";
                        if (prevQuestion && prevAnswer && checklistItems) {
                            // Split checklist items by newlines and filter out empty lines
                            const itemsArray = checklistItems.split('\n')
                                .map(item => item.trim())
                                .filter(item => item.length > 0);
                            checklistLogicConditionsArray.push({
                                prevQuestion: prevQuestion,
                                prevAnswer: prevAnswer,
                                checklistItems: itemsArray
                            });
                        }
                    });
                }
            }
            // ---------- Conditional Alert logic ----------
            const alertEnabled = questionBlock.querySelector(`#enableConditionalAlert${questionId}`)?.checked || false;
            const alertPrevQ = questionBlock.querySelector(`#alertPrevQuestion${questionId}`)?.value || "";
            const alertPrevA = questionBlock.querySelector(`#alertPrevAnswer${questionId}`)?.value || "";
            const alertText = questionBlock.querySelector(`#alertText${questionId}`)?.value || "";
            // Build the bare question object first
            const questionData = {
                questionId: questionId,
                text: questionText,
                type: questionType,
                logic: {
                    enabled: logicEnabled,
                    conditions: conditionsArray
                },
                jump: {
                    enabled: jumpEnabled,
                    conditions: jumpConditions
                },
                conditionalPDF: {
                    enabled: condPDFEnabled,
                    pdfName: condPDFName,
                    answer: condPDFAnswer
                },
                hiddenLogic: {
                    enabled: hiddenLogicEnabled,
                    configs: hiddenLogicConfigs
                },
                pdfLogic: {
                    enabled: pdfLogicEnabled,
                    conditions: pdfLogicConditionsArray,
                    pdfs: pdfLogicPdfs
                },
                alertLogic: {
                    enabled: alertLogicEnabled,
                    message: alertLogicMessage,
                    conditions: alertLogicConditionsArray
                },
                checklistLogic: {
                    enabled: checklistLogicEnabled,
                    conditions: checklistLogicConditionsArray
                },
                conditionalAlert: {
                    enabled: alertEnabled,
                    prevQuestion: alertPrevQ,
                    prevAnswer: alertPrevA,
                    text: alertText
                },
                subtitle: {
                    enabled: questionBlock.querySelector(`#enableSubtitle${questionId}`)?.checked || false,
                    text: questionBlock.querySelector(`#subtitleText${questionId}`)?.value || ""
                },
                infoBox: {
                    enabled: questionBlock.querySelector(`#enableInfoBox${questionId}`)?.checked || false,
                    text: questionBlock.querySelector(`#infoBoxText${questionId}`)?.value || ""
                },
                pdfPreview: {
                    enabled: questionBlock.querySelector(`#enablePdfPreview${questionId}`)?.checked || false,
                    trigger: questionBlock.querySelector(`#pdfPreviewTrigger${questionId}`)?.value || "",
                    title: questionBlock.querySelector(`#pdfPreviewTitle${questionId}`)?.value || "",
                    file: questionBlock.querySelector(`#pdfPreviewFile${questionId}`)?.value || ""
                },
                options: [],
                labels: []
            };
            // ========== Collect question-specific options ==========
            if (questionType === 'checkbox') {
                const optionsDivs = questionBlock.querySelectorAll(`#checkboxOptions${questionId} > div`);
                optionsDivs.forEach((optionDiv, index) => {
                    const optTextEl = optionDiv.querySelector(`#checkboxOptionText${questionId}_${index + 1}`);
                    const optNameEl = optionDiv.querySelector(`#checkboxOptionName${questionId}_${index + 1}`);
                    const optValueEl = optionDiv.querySelector(`#checkboxOptionValue${questionId}_${index + 1}`);
                    const hasAmountEl = optionDiv.querySelector(`#checkboxOptionHasAmount${questionId}_${index + 1}`);
                    const amountNameEl = optionDiv.querySelector(`#checkboxOptionAmountName${questionId}_${index + 1}`);
                    const amountPhEl = optionDiv.querySelector(`#checkboxOptionAmountPlaceholder${questionId}_${index + 1}`);
                    const optText = optTextEl ? optTextEl.value.trim() : `Option ${index + 1}`;
                    let optNameId = optNameEl ? optNameEl.value.trim() : '';
                    // If blank, generate a default nameId using the questionId and sanitized label
                    if (!optNameId) {
                        const sanitizedLabel = optText.replace(/\W+/g, '_').toLowerCase();
                        optNameId = `answer${questionId}_${sanitizedLabel}`;
                    }
                    const optValue = optValueEl ? optValueEl.value.trim() : optText;
                    const hasAmount = hasAmountEl ? hasAmountEl.checked : false;
                    const amountName = amountNameEl ? amountNameEl.value.trim() : '';
                    const amountPlaceholder = amountPhEl ? amountPhEl.value.trim() : '';
                    questionData.options.push({
                        label: optText,
                        nameId: optNameId,
                        value: optValue,
                        hasAmount: hasAmount,
                        amountName: amountName,
                        amountPlaceholder: amountPlaceholder
                    });
                });
                // Required/optional flag (defaults to required)
                const requiredSelect = questionBlock.querySelector(`[id^="checkboxRequired${questionId}_"]`);
                questionData.required = !(requiredSelect && requiredSelect.value === 'optional');
                // Check if user included "None of the above"
                const noneOfTheAboveCheckbox = questionBlock.querySelector(`#noneOfTheAbove${questionId}`);
                if (noneOfTheAboveCheckbox && noneOfTheAboveCheckbox.checked) {
                    const slug = questionSlugMap[questionId] || ('answer' + questionId);
                    const noneNameId = `${slug}_none`;
                    questionData.options.push({
                        label: "None of the above",
                        nameId: noneNameId,
                        value: "None of the above",
                        hasAmount: false
                    });
                }
                // Check if user enabled "Mark only one"
                const markOnlyOneCheckbox = questionBlock.querySelector(`#markOnlyOne${questionId}`);
                questionData.markOnlyOne = markOnlyOneCheckbox ? markOnlyOneCheckbox.checked : false;
            }
            else if (questionType === 'dropdown') {
                const dropdownOptionEls = questionBlock.querySelectorAll(`#dropdownOptions${questionId} input`);
                dropdownOptionEls.forEach(optionEl => {
                    const val = optionEl.value.trim() || "Option";
                    questionData.options.push(val);
                });
                // Also include Name/ID and Placeholder
                const nameId = questionBlock.querySelector(`#textboxName${questionId}`)?.value.trim() || `answer${questionId}`;
                const placeholder = questionBlock.querySelector(`#textboxPlaceholder${questionId}`)?.value.trim() || '';
                questionData.nameId = nameId;
                questionData.placeholder = placeholder;
                // Include linking logic data
                const linkingEnabledEl = questionBlock.querySelector(`#enableLinking${questionId}`);
                const linkingEnabled = linkingEnabledEl?.checked || false;
                if (linkingEnabled) {
                    const linkingTargetEl = questionBlock.querySelector(`#linkingTarget${questionId}`);
                    const linkingTargetId = linkingTargetEl?.value || '';
                    questionData.linking = {
                        enabled: linkingEnabled,
                        targetId: linkingTargetId
                    };
                } else {
                    questionData.linking = {
                        enabled: false,
                        targetId: ''
                    };
                }
                // ********** Collect Image Data **********
                const imgUrlEl = questionBlock.querySelector(`#dropdownImageURL${questionId}`);
                const imgWidthEl = questionBlock.querySelector(`#dropdownImageWidth${questionId}`);
                const imgHeightEl = questionBlock.querySelector(`#dropdownImageHeight${questionId}`);
                const imageUrl = imgUrlEl ? imgUrlEl.value.trim() : '';
                const imageWidth = imgWidthEl ? parseInt(imgWidthEl.value, 10) || 0 : 0;
                const imageHeight = imgHeightEl ? parseInt(imgHeightEl.value, 10) || 0 : 0;
                questionData.image = {
                    url: imageUrl,
                    width: imageWidth,
                    height: imageHeight
                };
            }
            else if (questionType === 'numberedDropdown') {
                const rangeStart = questionBlock.querySelector(`#numberRangeStart${questionId}`)?.value || '';
                const rangeEnd = questionBlock.querySelector(`#numberRangeEnd${questionId}`)?.value || '';
                // Export main Node ID if it exists
                const nodeIdInput = questionBlock.querySelector(`#nodeId${questionId}`);
                if (nodeIdInput && nodeIdInput.value.trim()) {
                    questionData.nodeId = nodeIdInput.value.trim();
                }
                // Export entry title if it exists
                const entryTitleInput = questionBlock.querySelector(`#entryTitle${questionId}`);
                if (entryTitleInput && entryTitleInput.value.trim()) {
                    questionData.entryTitle = entryTitleInput.value.trim();
                }
                // Collect unified field data in true creation order
                const unifiedContainer = questionBlock.querySelector(`#unifiedFields${questionId}`);

                if (unifiedContainer) {

                }
                const unifiedFields = questionBlock.querySelectorAll(`#unifiedFields${questionId} .unified-field`);

                // Also try a more direct approach
                const directUnifiedFields = document.querySelectorAll(`#unifiedFields${questionId} .unified-field`);

                // Use the direct query if the questionBlock query didn't work
                const fieldsToProcess = unifiedFields.length > 0 ? unifiedFields : directUnifiedFields;

                const allFieldsInOrder = [];
                // Process fields in their creation order
                fieldsToProcess.forEach((field, index) => {
                    const fieldType = field.getAttribute('data-type');
                    const fieldOrder = field.getAttribute('data-order');
                    const labelTextEl = field.querySelector('#labelText' + questionId + '_' + fieldOrder);
                    const nodeIdTextEl = field.querySelector('#nodeIdText' + questionId + '_' + fieldOrder);

                    if (fieldType === 'checkbox') {
                        // Handle checkbox fields
                        const fieldNameEl = field.querySelector('#checkboxFieldName' + questionId + '_' + fieldOrder);
                        const selectionTypeEl = field.querySelector('#checkboxSelectionType' + questionId + '_' + fieldOrder);
                        const requiredEl = field.querySelector('#checkboxRequired' + questionId + '_' + fieldOrder);
                        const optionsContainer = field.querySelector('#checkboxOptions' + questionId + '_' + fieldOrder);
                        if (fieldNameEl) {
                            const checkboxOptions = [];
                            if (optionsContainer) {
                                const optionElements = optionsContainer.querySelectorAll('[class^="checkbox-option-"]');
                                optionElements.forEach((optionEl, optionIndex) => {
                                    const textEl = optionEl.querySelector('#checkboxText' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                    const nodeIdEl = optionEl.querySelector('#checkboxNodeId' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                    if (textEl && nodeIdEl) {
                                        // Collect linked fields for this option
                                        const linkedFields = [];
                                        const linkedFieldsContainer = optionEl.querySelector('#linkedFields' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                        if (linkedFieldsContainer) {
                                            const linkedFieldDivs = linkedFieldsContainer.querySelectorAll('[class^="linked-field-"]');
                                            linkedFieldDivs.forEach((linkedFieldDiv) => {
                                                const select = linkedFieldDiv.querySelector('select[id^="linkedField"]');
                                                const titleInput = linkedFieldDiv.querySelector('input[id^="linkedFieldTitle"]');
                                                if (select && select.value && select.value.trim()) {
                                                    linkedFields.push({
                                                        nodeId: select.value.trim(),
                                                        title: titleInput ? titleInput.value.trim() : ''
                                                    });
                                                }
                                            });
                                        }
                                        // Collect PDF entries for this option
                                        const pdfEntries = [];
                                        const pdfEntriesContainer = optionEl.querySelector('#pdfEntries' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                        if (pdfEntriesContainer) {
                                            const pdfEntryDivs = pdfEntriesContainer.querySelectorAll('[class^="pdf-entry-"]');
                                            pdfEntryDivs.forEach((pdfEntryDiv) => {
                                                const triggerNumberInput = pdfEntryDiv.querySelector('input[id^="pdfEntryTriggerNumber"]');
                                                const pdfNameInput = pdfEntryDiv.querySelector('input[id^="pdfEntryPdfName"]');
                                                const pdfFileInput = pdfEntryDiv.querySelector('input[id^="pdfEntryPdfFile"]');
                                                const priceIdInput = pdfEntryDiv.querySelector('input[id^="pdfEntryPriceId"]');
                                                pdfEntries.push({
                                                    triggerNumber: triggerNumberInput ? triggerNumberInput.value.trim() : '',
                                                    pdfName: pdfNameInput ? pdfNameInput.value.trim() : '',
                                                    pdfFile: pdfFileInput ? pdfFileInput.value.trim() : '',
                                                    priceId: priceIdInput ? priceIdInput.value.trim() : ''
                                                });
                                            });
                                        }
                                        checkboxOptions.push({
                                            text: textEl.value.trim(),
                                            nodeId: nodeIdEl.value.trim(),
                                            linkedFields: linkedFields,
                                            pdfEntries: pdfEntries
                                        });
                                    }
                                });
                            }
                            const requiredValue = requiredEl ? requiredEl.value : 'required';
                            allFieldsInOrder.push({
                                type: fieldType,
                                fieldName: fieldNameEl.value.trim(),
                                selectionType: selectionTypeEl ? selectionTypeEl.value : 'multiple',
                                required: requiredValue,
                                options: checkboxOptions,
                                order: parseInt(fieldOrder)
                            });
                        }
                    } else if (fieldType === 'dropdown') {
                        // Handle dropdown fields

                        const fieldNameEl = field.querySelector('#dropdownFieldName' + questionId + '_' + fieldOrder);

                        const optionsContainer = field.querySelector('#dropdownOptions' + questionId + '_' + fieldOrder);

                        const triggerSequencesContainer = field.querySelector('#triggerSequences' + questionId + '_' + fieldOrder);

                        if (triggerSequencesContainer) {

                        }
                        if (fieldNameEl) {
                            const dropdownOptions = [];
                            if (optionsContainer) {
                                const optionElements = optionsContainer.querySelectorAll('[class^="dropdown-option-"]');
                                optionElements.forEach((optionEl, optionIndex) => {
                                    const textEl = optionEl.querySelector('#dropdownOptionText' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                    const nodeIdEl = optionEl.querySelector('#dropdownOptionNodeId' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                    if (textEl && nodeIdEl) {
                                        dropdownOptions.push({
                                            text: textEl.value.trim(),
                                            nodeId: nodeIdEl.value.trim()
                                        });
                                    }
                                });
                            }
                            // Collect trigger sequences
                            const triggerSequences = [];
                            if (triggerSequencesContainer) {

                                const sequenceElements = triggerSequencesContainer.querySelectorAll('[class^="trigger-sequence-"]');

                                sequenceElements.forEach((sequenceEl, sequenceIndex) => {

                                    const triggerConditionEl = sequenceEl.querySelector('#triggerCondition' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1));
                                    const triggerTitleEl = sequenceEl.querySelector('#triggerTitle' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1));
                                    const triggerFieldsContainer = sequenceEl.querySelector('#triggerFields' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1));
                                    const triggerFields = [];

                                    if (triggerFieldsContainer) {
                                        const fieldElements = triggerFieldsContainer.querySelectorAll('[class^="trigger-field-"]');

                                        fieldElements.forEach((fieldEl, fieldIndex) => {

                                            const fieldType = fieldEl.className.includes('trigger-field-') ? 'trigger-field' : 'unknown';
                                            // Check for different field types within trigger
                                            const labelTextEl = fieldEl.querySelector('#triggerLabelText' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                            const labelNodeIdEl = fieldEl.querySelector('#triggerLabelNodeId' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                            const checkboxFieldNameEl = fieldEl.querySelector('#triggerCheckboxFieldName' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                            const checkboxOptionsContainer = fieldEl.querySelector('#triggerCheckboxOptions' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                            const dropdownFieldNameEl = fieldEl.querySelector('#triggerDropdownFieldName' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                            const dropdownOptionsContainer = fieldEl.querySelector('#triggerDropdownOptions' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                            const dateLabelEl = fieldEl.querySelector('#triggerDateLabel' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                            const dateNodeIdEl = fieldEl.querySelector('#triggerDateNodeId' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                            if (labelTextEl && labelNodeIdEl) {
                                                // Trigger label field
                                                const labelField = {
                                                    type: 'label',
                                                    label: labelTextEl.value.trim(),
                                                    nodeId: labelNodeIdEl.value.trim()
                                                };
                                                // Check for amount checkbox
                                                const amountCheckboxEl = fieldEl.querySelector(`#triggerLabelAmount${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                if (amountCheckboxEl && amountCheckboxEl.checked) {
                                                    labelField.isAmountOption = true;
                                                }
                                                // Check for conditional logic
                                                const enableConditionalLogicCheckbox = fieldEl.querySelector(`#enableConditionalLogicLabel${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                const conditionalLogicEnabled = enableConditionalLogicCheckbox && enableConditionalLogicCheckbox.checked;
                                                // Include conditional logic if enabled
                                                if (conditionalLogicEnabled) {
                                                    // Get conditions from the conditional logic UI
                                                    const conditionalLogicContainer = fieldEl.querySelector(`#conditionalLogicUILabel${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                    const conditions = [];
                                                    if (conditionalLogicContainer) {
                                                        const conditionDropdowns = conditionalLogicContainer.querySelectorAll('select');
                                                        conditionDropdowns.forEach(dropdown => {
                                                            const value = dropdown.value.trim();
                                                            if (value) {
                                                                conditions.push(value);
                                                            }
                                                        });
                                                    }
                                                    // Also check window.triggerLabelConditionalLogic for the data
                                                    const key = `${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`;
                                                    if (window.triggerLabelConditionalLogic && window.triggerLabelConditionalLogic[key]) {
                                                        const storedConditions = window.triggerLabelConditionalLogic[key].conditions || [];
                                                        // Use stored conditions if available, otherwise use dropdown values
                                                        if (storedConditions.length > 0) {
                                                            labelField.conditionalLogic = {
                                                                enabled: true,
                                                                conditions: storedConditions.filter(c => c && c.trim() !== '')
                                                            };
                                                        } else if (conditions.length > 0) {
                                                            labelField.conditionalLogic = {
                                                                enabled: true,
                                                                conditions: conditions
                                                            };
                                                        }
                                                    } else if (conditions.length > 0) {
                                                        labelField.conditionalLogic = {
                                                            enabled: true,
                                                            conditions: conditions
                                                        };
                                                    }
                                                }
                                                triggerFields.push(labelField);
                                            } else if (checkboxFieldNameEl) {
                                                // Trigger checkbox field
                                                const checkboxOptions = [];
                                                if (checkboxOptionsContainer) {
                                                    const checkboxOptionElements = checkboxOptionsContainer.querySelectorAll('[class^="trigger-checkbox-option-"]');
                                                    checkboxOptionElements.forEach((optionEl, optionIndex) => {
                                                        const textEl = optionEl.querySelector('#triggerCheckboxOptionText' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1) + '_' + (optionIndex + 1));
                                                        const nodeIdEl = optionEl.querySelector('#triggerCheckboxOptionNodeId' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1) + '_' + (optionIndex + 1));
                                                        if (textEl && nodeIdEl) {
                                                            checkboxOptions.push({
                                                                text: textEl.value.trim(),
                                                                nodeId: nodeIdEl.value.trim()
                                                            });
                                                        }
                                                    });
                                                }
                                                // Get selection type
                                                const selectionTypeEl = document.getElementById('triggerCheckboxSelectionType' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                                const selectionType = selectionTypeEl ? selectionTypeEl.value : 'multiple';
                                                const checkboxField = {
                                                    type: 'checkbox',
                                                    fieldName: checkboxFieldNameEl.value.trim(),
                                                    selectionType: selectionType,
                                                    options: checkboxOptions
                                                };
                                                // Check for conditional logic
                                                const enableConditionalLogicCheckbox = fieldEl.querySelector(`#enableConditionalLogicCheckbox${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                const conditionalLogicEnabled = enableConditionalLogicCheckbox && enableConditionalLogicCheckbox.checked;
                                                // Include conditional logic if enabled
                                                if (conditionalLogicEnabled) {
                                                    // Get conditions from the conditional logic UI
                                                    const conditionalLogicContainer = fieldEl.querySelector(`#conditionalLogicUICheckbox${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                    const conditions = [];
                                                    if (conditionalLogicContainer) {
                                                        const conditionDropdowns = conditionalLogicContainer.querySelectorAll('select');
                                                        conditionDropdowns.forEach(dropdown => {
                                                            const value = dropdown.value.trim();
                                                            if (value) {
                                                                conditions.push(value);
                                                            }
                                                        });
                                                    }
                                                    // Also check window.triggerCheckboxConditionalLogic for the data
                                                    const key = `${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`;
                                                    if (window.triggerCheckboxConditionalLogic && window.triggerCheckboxConditionalLogic[key]) {
                                                        const storedConditions = window.triggerCheckboxConditionalLogic[key].conditions || [];
                                                        // Use stored conditions if available, otherwise use dropdown values
                                                        if (storedConditions.length > 0) {
                                                            checkboxField.conditionalLogic = {
                                                                enabled: true,
                                                                conditions: storedConditions.filter(c => c && c.trim() !== '')
                                                            };
                                                        } else if (conditions.length > 0) {
                                                            checkboxField.conditionalLogic = {
                                                                enabled: true,
                                                                conditions: conditions
                                                            };
                                                        }
                                                    } else if (conditions.length > 0) {
                                                        checkboxField.conditionalLogic = {
                                                            enabled: true,
                                                            conditions: conditions
                                                        };
                                                    }
                                                }
                                                triggerFields.push(checkboxField);
                                            } else if (dropdownFieldNameEl) {
                                                // Trigger dropdown field
                                                const dropdownOptions = [];
                                                if (dropdownOptionsContainer) {
                                                    const dropdownOptionElements = dropdownOptionsContainer.querySelectorAll('[class^="trigger-dropdown-option-"]');
                                                    dropdownOptionElements.forEach((optionEl, optionIndex) => {
                                                        const textEl = optionEl.querySelector('#triggerDropdownOptionText' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1) + '_' + (optionIndex + 1));
                                                        if (textEl && textEl.value.trim()) {
                                                            dropdownOptions.push({
                                                                text: textEl.value.trim()
                                                            });
                                                        }
                                                    });
                                                }
                                                const dropdownField = {
                                                    type: 'dropdown',
                                                    fieldName: dropdownFieldNameEl.value.trim(),
                                                    options: dropdownOptions
                                                };
                                                // Check for conditional logic - check window object first (most reliable)
                                                const key = `${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`;
                                                let conditionalLogicEnabled = false;
                                                let storedConditions = [];
                                                if (window.triggerDropdownConditionalLogic && window.triggerDropdownConditionalLogic[key]) {
                                                    const storedLogic = window.triggerDropdownConditionalLogic[key];
                                                    conditionalLogicEnabled = storedLogic.enabled || false;
                                                    storedConditions = storedLogic.conditions || [];
                                                }
                                                // Also check checkbox state as fallback
                                                if (!conditionalLogicEnabled) {
                                                    const enableConditionalLogicCheckbox = fieldEl.querySelector(`#enableConditionalLogicDropdown${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                    conditionalLogicEnabled = enableConditionalLogicCheckbox && enableConditionalLogicCheckbox.checked;
                                                }
                                                // Include conditional logic if enabled
                                                if (conditionalLogicEnabled) {
                                                    // Get conditions from the conditional logic UI (as fallback if window object doesn't have them)
                                                    const conditionalLogicContainer = fieldEl.querySelector(`#conditionalLogicUIDropdown${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                    const conditions = [];
                                                    if (conditionalLogicContainer) {
                                                        const conditionDropdowns = conditionalLogicContainer.querySelectorAll('select');
                                                        conditionDropdowns.forEach(dropdown => {
                                                            const value = dropdown.value.trim();
                                                            if (value) {
                                                                conditions.push(value);
                                                            }
                                                        });
                                                    }
                                                    // Use stored conditions if available, otherwise use dropdown values
                                                    if (storedConditions.length > 0) {
                                                        dropdownField.conditionalLogic = {
                                                            enabled: true,
                                                            conditions: storedConditions.filter(c => c && c.trim() !== '')
                                                        };
                                                    } else if (conditions.length > 0) {
                                                        dropdownField.conditionalLogic = {
                                                            enabled: true,
                                                            conditions: conditions
                                                        };
                                                    }
                                                }
                                                triggerFields.push(dropdownField);
                                            } else if (dateLabelEl && dateNodeIdEl) {
                                                // Trigger date field

                                                // Check for conditional logic
                                                const enableConditionalLogicCheckbox = fieldEl.querySelector(`#enableConditionalLogic${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                const conditionalLogicEnabled = enableConditionalLogicCheckbox && enableConditionalLogicCheckbox.checked;
                                                const dateField = {
                                                    type: 'date',
                                                    label: dateLabelEl.value.trim(),
                                                    nodeId: dateNodeIdEl.value.trim()
                                                };
                                                // Include conditional logic if enabled
                                                if (conditionalLogicEnabled) {
                                                    // Get conditions from the conditional logic UI
                                                    const conditionalLogicContainer = fieldEl.querySelector(`#conditionalLogicUI${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                    const conditions = [];
                                                    if (conditionalLogicContainer) {
                                                        const conditionDropdowns = conditionalLogicContainer.querySelectorAll('select');
                                                        conditionDropdowns.forEach(dropdown => {
                                                            const value = dropdown.value.trim();
                                                            if (value) {
                                                                conditions.push(value);
                                                            }
                                                        });
                                                    }
                                                    // Also check window.triggerDateConditionalLogic for the data
                                                    const key = `${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`;
                                                    if (window.triggerDateConditionalLogic && window.triggerDateConditionalLogic[key]) {
                                                        const storedConditions = window.triggerDateConditionalLogic[key].conditions || [];
                                                        // Use stored conditions if available, otherwise use dropdown values
                                                        if (storedConditions.length > 0) {
                                                            dateField.conditionalLogic = {
                                                                enabled: true,
                                                                conditions: storedConditions.filter(c => c && c.trim() !== '')
                                                            };
                                                        } else if (conditions.length > 0) {
                                                            dateField.conditionalLogic = {
                                                                enabled: true,
                                                                conditions: conditions
                                                            };
                                                        }
                                                    } else if (conditions.length > 0) {
                                                        dateField.conditionalLogic = {
                                                            enabled: true,
                                                            conditions: conditions
                                                        };
                                                    }
                                                }
                                                triggerFields.push(dateField);
                                            } else {
                                                // Check for trigger PDF field by looking for "Trigger PDF" text
                                                const pdfTitleEl = fieldEl.querySelector('div[style*="color: #DC3545"]');
                                                const isPdfField = pdfTitleEl && pdfTitleEl.textContent && pdfTitleEl.textContent.trim().includes('Trigger PDF');

                                                const pdfNumberEl = fieldEl.querySelector('input[id*="triggerPdfNumber"]');
                                                const pdfTitleInputEl = fieldEl.querySelector('input[id*="triggerPdfTitle"]');
                                                const pdfNameEl = fieldEl.querySelector('input[id*="triggerPdfName"]');
                                                const pdfPriceIdEl = fieldEl.querySelector('input[id*="triggerPdfPriceId"]');

                                                if (isPdfField && pdfNumberEl && pdfNameEl) {
                                                    // This is a trigger PDF field

                                                    triggerFields.push({
                                                        type: 'pdf',
                                                        number: pdfNumberEl.value.trim(),
                                                        pdfTitle: pdfTitleInputEl ? pdfTitleInputEl.value.trim() : '',
                                                        pdfName: pdfNameEl.value.trim(),
                                                        priceId: pdfPriceIdEl ? pdfPriceIdEl.value.trim() : ''
                                                    });
                                                } else if (pdfNumberEl && pdfNameEl) {
                                                    // Fallback: try to detect PDF even if title check failed

                                                    triggerFields.push({
                                                        type: 'pdf',
                                                        number: pdfNumberEl.value.trim(),
                                                        pdfTitle: pdfTitleInputEl ? pdfTitleInputEl.value.trim() : '',
                                                        pdfName: pdfNameEl.value.trim(),
                                                        priceId: pdfPriceIdEl ? pdfPriceIdEl.value.trim() : ''
                                                    });
                                                } else {
                                                    // Check for trigger location field (simplified "Location Data Added" format)
                                                    // Look for the "Location Data Added" text in the field
                                                    const locationTextEl = fieldEl.querySelector('div[style*="color: #28a745"]');
                                                    if (locationTextEl && locationTextEl.textContent.trim() === 'Location Data Added') {
                                                        // This is a trigger location field

                                                        // Get the location title from the input field
                                                        const locationTitleEl = fieldEl.querySelector('input[id*="triggerLocationTitle"]');
                                                        const locationTitle = locationTitleEl ? locationTitleEl.value.trim() : 'Location Data';

                                                        triggerFields.push({
                                                            type: 'location',
                                                            fieldName: locationTitle || 'Location Data',
                                                            nodeId: 'location_data'
                                                        });
                                                    } else {
                                                        // Check for trigger PDF field
                                                        const pdfTitleEl = fieldEl.querySelector('div[style*="color: #DC3545"]');
                                                        const isPdfField = pdfTitleEl && pdfTitleEl.textContent && pdfTitleEl.textContent.trim().includes('Trigger PDF');
                                                        const pdfNumberEl = fieldEl.querySelector('input[id*="triggerPdfNumber"]');
                                                        const pdfTitleInputEl = fieldEl.querySelector('input[id*="triggerPdfTitle"]');
                                                        const pdfNameEl = fieldEl.querySelector('input[id*="triggerPdfName"]');
                                                        const pdfPriceIdEl = fieldEl.querySelector('input[id*="triggerPdfPriceId"]');
                                                        if (isPdfField && pdfNumberEl && pdfNameEl) {
                                                            // This is a trigger PDF field

                                                            triggerFields.push({
                                                                type: 'pdf',
                                                                number: pdfNumberEl.value.trim(),
                                                                pdfTitle: pdfTitleInputEl ? pdfTitleInputEl.value.trim() : '',
                                                                pdfName: pdfNameEl.value.trim(),
                                                                priceId: pdfPriceIdEl ? pdfPriceIdEl.value.trim() : ''
                                                            });
                                                        } else if (pdfNumberEl && pdfNameEl) {
                                                            // Fallback: try to detect PDF even if title check failed

                                                            triggerFields.push({
                                                                type: 'pdf',
                                                                number: pdfNumberEl.value.trim(),
                                                                pdfTitle: pdfTitleInputEl ? pdfTitleInputEl.value.trim() : '',
                                                                pdfName: pdfNameEl.value.trim(),
                                                                priceId: pdfPriceIdEl ? pdfPriceIdEl.value.trim() : ''
                                                            });
                                                        } else {

                                                        }

                                                    }
                                                }
                                            }
                                        });
                                    }

                                    triggerSequences.push({
                                        condition: triggerConditionEl ? triggerConditionEl.value.trim() : '',
                                        title: triggerTitleEl ? (triggerTitleEl.value.trim() || 'Additional Information') : 'Additional Information',
                                        fields: triggerFields
                                    });

                                });

                            } else {

                            }
                            allFieldsInOrder.push({
                                type: fieldType,
                                fieldName: fieldNameEl.value.trim(),
                                options: dropdownOptions,
                                triggerSequences: triggerSequences,
                                order: parseInt(fieldOrder)
                            });
                        }
                    } else if (fieldType === 'location') {
                        // Handle main location unified field
                        const titleEl = field.querySelector('#locationTitle' + questionId + '_' + fieldOrder);
                        const title = titleEl ? titleEl.value.trim() : 'Location Data';
                        allFieldsInOrder.push({
                            type: 'location',
                            fieldName: title || 'Location Data',
                            nodeId: 'location_data',
                            order: parseInt(fieldOrder)
                        });
                    } else if (fieldType === 'time') {
                            // Handle time fields - use same structure as label fields
                    if (labelTextEl && nodeIdTextEl) {
                        const labelText = labelTextEl.textContent.trim();
                        const nodeIdText = nodeIdTextEl.textContent.trim();
                        allFieldsInOrder.push({
                            type: fieldType,
                            label: labelText,
                            nodeId: nodeIdText,
                            order: parseInt(fieldOrder)
                        });
                    }
                        } else if (fieldType === 'location') {
                            // Handle main location field
                            const titleEl = field.querySelector('#locationTitle' + questionId + '_' + fieldOrder);
                            const title = titleEl ? titleEl.value.trim() : 'Location Data';
                            allFieldsInOrder.push({
                                type: 'location',
                                fieldName: title || 'Location Data',
                                nodeId: 'location_data',
                                order: parseInt(fieldOrder)
                            });
                        } else if (labelTextEl && nodeIdTextEl) {
                            // Handle regular fields (label, amount, etc.)
                        const labelText = labelTextEl.textContent.trim();
                        const nodeIdText = nodeIdTextEl.textContent.trim();
                        const prefillValue = field.getAttribute('data-prefill') || '';

                        const fieldData = {
                            type: fieldType,
                            label: labelText,
                            nodeId: nodeIdText,
                            order: parseInt(fieldOrder)
                        };
                        // Always include prefill for label type fields (even if empty)
                        if (fieldType === 'label') {
                            fieldData.prefill = prefillValue;
                        }
                        // Export conditional prefills for both label and amount fields
                        if (fieldType === 'label' || fieldType === 'amount' || fieldType === 'phone') {
                            const conditionalPrefillsData = field.getAttribute('data-conditional-prefills');

                            if (conditionalPrefillsData) {

                                try {
                                    fieldData.conditionalPrefills = JSON.parse(conditionalPrefillsData);

                                } catch (e) {

                                }
                            } else {

                            }
                        }
                        if (fieldType === 'label') {

                        }
                        allFieldsInOrder.push(fieldData);
                    }
                });
                // Sort by order to ensure correct sequence
                allFieldsInOrder.sort((a, b) => a.order - b.order);

                questionData.min = rangeStart;
                questionData.max = rangeEnd;
                questionData.allFieldsInOrder = allFieldsInOrder;
                // Fallback to old format if no unified fields found
                if (allFieldsInOrder.length === 0) {

                    // Try to get data from the old hidden containers
                    const textboxLabelsDiv = questionBlock.querySelector(`#textboxLabels${questionId}`);
                    const textboxAmountsDiv = questionBlock.querySelector(`#textboxAmounts${questionId}`);
                    const labels = [];
                    const labelNodeIds = [];
                    const amounts = [];
                    if (textboxLabelsDiv) {
                        const labelDivs = textboxLabelsDiv.querySelectorAll('.label');
                        labelDivs.forEach((labelDiv, index) => {
                            const labelInput = labelDiv.querySelector('input[type="text"]');
                            const nodeIdInput = labelDiv.querySelector('input[type="text"]:last-of-type');
                            if (labelInput) {
                                labels.push(labelInput.value.trim());
                                labelNodeIds.push(nodeIdInput ? nodeIdInput.value.trim() : '');
                            }
                        });
                    }
                    if (textboxAmountsDiv) {
                        const amountDivs = textboxAmountsDiv.querySelectorAll('.amount');
                        amountDivs.forEach((amountDiv) => {
                            const amountInput = amountDiv.querySelector('input[type="text"]');
                            if (amountInput) {
                                amounts.push(amountInput.value.trim());
                            }
                        });
                    }
                questionData.labels = labels;
                    questionData.labelNodeIds = labelNodeIds;
                questionData.amounts = amounts;

                }
            }
            else if (questionType === 'multipleTextboxes') {
                // Export custom Node ID if it exists
                const nodeIdInput = questionBlock.querySelector(`#multipleTextboxesNodeId${questionId}`);
                if (nodeIdInput && nodeIdInput.value.trim()) {
                    questionData.nodeId = nodeIdInput.value.trim();
                }
                // Use the same unified fields system as numberedDropdown
                const unifiedContainer = questionBlock.querySelector(`#unifiedFields${questionId}`);

                if (unifiedContainer) {

                }
                const unifiedFields = questionBlock.querySelectorAll(`#unifiedFields${questionId} .unified-field`);

                if (unifiedFields.length > 0) {
                    // Use unified fields data
                    const allFieldsInOrder = [];
                    unifiedFields.forEach((el) => {
                        const fieldType = el.getAttribute('data-type');
                        const fieldOrder = parseInt(el.getAttribute('data-order'));
                        const labelTextEl = el.querySelector('#labelText' + questionId + '_' + fieldOrder);
                        const nodeIdTextEl = el.querySelector('#nodeIdText' + questionId + '_' + fieldOrder);

                        if (fieldType === 'checkbox') {
                            // Handle checkbox fields
                            const fieldNameEl = el.querySelector('#checkboxFieldName' + questionId + '_' + fieldOrder);
                            const selectionTypeEl = el.querySelector('#checkboxSelectionType' + questionId + '_' + fieldOrder);
                            const requiredEl = el.querySelector('#checkboxRequired' + questionId + '_' + fieldOrder);
                            const optionsContainer = el.querySelector('#checkboxOptions' + questionId + '_' + fieldOrder);
                            if (fieldNameEl) {
                                const checkboxOptions = [];
                                if (optionsContainer) {
                                    const optionElements = optionsContainer.querySelectorAll('[class^="checkbox-option-"]');
                                    optionElements.forEach((optionEl, optionIndex) => {
                                        const textEl = optionEl.querySelector('#checkboxText' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                        const nodeIdEl = optionEl.querySelector('#checkboxNodeId' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                        if (textEl && nodeIdEl) {
                                            // Collect linked fields for this option
                                            const linkedFields = [];
                                            const linkedFieldsContainer = optionEl.querySelector('#linkedFields' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                            if (linkedFieldsContainer) {
                                                const linkedFieldDivs = linkedFieldsContainer.querySelectorAll('[class^="linked-field-"]');
                                                linkedFieldDivs.forEach((linkedFieldDiv) => {
                                                    const select = linkedFieldDiv.querySelector('select[id^="linkedField"]');
                                                    const titleInput = linkedFieldDiv.querySelector('input[id^="linkedFieldTitle"]');
                                                    if (select && select.value && select.value.trim()) {
                                                        linkedFields.push({
                                                            nodeId: select.value.trim(),
                                                            title: titleInput ? titleInput.value.trim() : ''
                                                        });
                                                    }
                                                });
                                            }
                                            // Collect PDF entries for this option
                                            const pdfEntries = [];
                                            const pdfEntriesContainer = optionEl.querySelector('#pdfEntries' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                            if (pdfEntriesContainer) {
                                                const pdfEntryDivs = pdfEntriesContainer.querySelectorAll('[class^="pdf-entry-"]');
                                                pdfEntryDivs.forEach((pdfEntryDiv) => {
                                                    const triggerNumberInput = pdfEntryDiv.querySelector('input[id^="pdfEntryTriggerNumber"]');
                                                    const pdfNameInput = pdfEntryDiv.querySelector('input[id^="pdfEntryPdfName"]');
                                                    const pdfFileInput = pdfEntryDiv.querySelector('input[id^="pdfEntryPdfFile"]');
                                                    const priceIdInput = pdfEntryDiv.querySelector('input[id^="pdfEntryPriceId"]');
                                                    pdfEntries.push({
                                                        triggerNumber: triggerNumberInput ? triggerNumberInput.value.trim() : '',
                                                        pdfName: pdfNameInput ? pdfNameInput.value.trim() : '',
                                                        pdfFile: pdfFileInput ? pdfFileInput.value.trim() : '',
                                                        priceId: priceIdInput ? priceIdInput.value.trim() : ''
                                                    });
                                                });
                                            }
                                            checkboxOptions.push({
                                                text: textEl.value.trim(),
                                                nodeId: nodeIdEl.value.trim(),
                                                linkedFields: linkedFields,
                                                pdfEntries: pdfEntries
                                            });
                                        }
                                    });
                                }
                                const requiredValue = requiredEl ? requiredEl.value : 'required';
                                const fieldData = {
                                    type: fieldType,
                                    fieldName: fieldNameEl.value.trim(),
                                    selectionType: selectionTypeEl ? selectionTypeEl.value : 'multiple',
                                    required: requiredValue,
                                    options: checkboxOptions,
                                    order: fieldOrder
                                };

                                allFieldsInOrder.push(fieldData);
                            }
                        } else if (fieldType === 'dropdown') {
                            // Handle dropdown fields

                            const fieldNameEl = el.querySelector('#dropdownFieldName' + questionId + '_' + fieldOrder);

                            const optionsContainer = el.querySelector('#dropdownOptions' + questionId + '_' + fieldOrder);

                            const triggerSequencesContainer = el.querySelector('#triggerSequences' + questionId + '_' + fieldOrder);

                            if (!triggerSequencesContainer) {

                                const allContainers = document.querySelectorAll('[id*="triggerSequences"]');

                                allContainers.forEach((container, idx) => {

                                });
                            }
                            if (fieldNameEl) {
                                const dropdownOptions = [];
                                if (optionsContainer) {
                                    const optionElements = optionsContainer.querySelectorAll('[class^="dropdown-option-"]');
                                    optionElements.forEach((optionEl, optionIndex) => {
                                        const textEl = optionEl.querySelector('#dropdownOptionText' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                        const nodeIdEl = optionEl.querySelector('#dropdownOptionNodeId' + questionId + '_' + fieldOrder + '_' + (optionIndex + 1));
                                        if (textEl && nodeIdEl) {
                                            dropdownOptions.push({
                                                text: textEl.value.trim(),
                                                nodeId: nodeIdEl.value.trim()
                                            });
                                        }
                                    });
                                }
                                // Collect trigger sequences
                                const triggerSequences = [];

                                if (triggerSequencesContainer) {

                                    const sequenceElements = triggerSequencesContainer.querySelectorAll('[class^="trigger-sequence-"]');

                                    sequenceElements.forEach((sequenceEl, sequenceIndex) => {

                                        const triggerConditionEl = sequenceEl.querySelector('#triggerCondition' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1));

                                        const triggerFieldsContainer = sequenceEl.querySelector('#triggerFields' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1));

                                        // Initialize triggerFields array before the if block so it's always available
                                        const triggerFields = [];
                                        if (triggerFieldsContainer) {

                                            const fieldElements = triggerFieldsContainer.querySelectorAll('[class^="trigger-field-"]');

                                            fieldElements.forEach((fieldEl, fieldIndex) => {

                                                // Check for different field types within trigger
                                                const labelTextEl = fieldEl.querySelector('#triggerLabelText' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                                const labelNodeIdEl = fieldEl.querySelector('#triggerLabelNodeId' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));

                                                const checkboxFieldNameEl = fieldEl.querySelector('#triggerCheckboxFieldName' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                                const checkboxOptionsContainer = fieldEl.querySelector('#triggerCheckboxOptions' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));

                                                const dropdownFieldNameEl = fieldEl.querySelector('#triggerDropdownFieldName' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                                const dropdownOptionsContainer = fieldEl.querySelector('#triggerDropdownOptions' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));

                                                const dateLabelEl = fieldEl.querySelector('#triggerDateLabel' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));
                                                const dateNodeIdEl = fieldEl.querySelector('#triggerDateNodeId' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1));

                                                // Check for trigger PDF field by looking for "Trigger PDF" text (similar to location detection)
                                                const pdfTitleEl = fieldEl.querySelector('div[style*="color: #DC3545"]');

                                                if (pdfTitleEl) {

                                                }
                                                const isPdfField = pdfTitleEl && pdfTitleEl.textContent && pdfTitleEl.textContent.trim().includes('Trigger PDF');

                                                const pdfNumberEl = isPdfField ? fieldEl.querySelector('input[id*="triggerPdfNumber"]') : null;
                                                const pdfTitleInputEl = isPdfField ? fieldEl.querySelector('input[id*="triggerPdfTitle"]') : null;
                                                const pdfNameEl = isPdfField ? fieldEl.querySelector('input[id*="triggerPdfName"]') : null;
                                                const pdfPriceIdEl = isPdfField ? fieldEl.querySelector('input[id*="triggerPdfPriceId"]') : null;

                                                // Also try to find PDF inputs without the isPdfField check
                                                const allPdfNumberInputs = fieldEl.querySelectorAll('input[id*="triggerPdfNumber"]');
                                                const allPdfTitleInputs = fieldEl.querySelectorAll('input[id*="triggerPdfTitle"]');
                                                const allPdfNameInputs = fieldEl.querySelectorAll('input[id*="triggerPdfName"]');
                                                const allPdfPriceIdInputs = fieldEl.querySelectorAll('input[id*="triggerPdfPriceId"]');

                                                if (allPdfNumberInputs.length > 0) {
                                                    allPdfNumberInputs.forEach((el, idx) => {

                                                    });
                                                }
                                                if (allPdfTitleInputs.length > 0) {
                                                    allPdfTitleInputs.forEach((el, idx) => {

                                                    });
                                                }
                                                if (allPdfNameInputs.length > 0) {
                                                    allPdfNameInputs.forEach((el, idx) => {

                                                    });
                                                }
                                                if (labelTextEl && labelNodeIdEl) {
                                                    // Trigger label field

                                                    const labelField = {
                                                        type: 'label',
                                                        label: labelTextEl.value.trim(),
                                                        nodeId: labelNodeIdEl.value.trim()
                                                    };
                                                    // Check for amount checkbox
                                                    const amountCheckboxEl = fieldEl.querySelector(`#triggerLabelAmount${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                    if (amountCheckboxEl && amountCheckboxEl.checked) {
                                                        labelField.isAmountOption = true;
                                                    }
                                                    triggerFields.push(labelField);
                                                } else if (checkboxFieldNameEl) {
                                                    // Trigger checkbox field

                                                    const checkboxOptions = [];
                                                    if (checkboxOptionsContainer) {
                                                        const checkboxOptionElements = checkboxOptionsContainer.querySelectorAll('[class^="trigger-checkbox-option-"]');
                                                        checkboxOptionElements.forEach((optionEl, optionIndex) => {
                                                            const textEl = optionEl.querySelector('#triggerCheckboxOptionText' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1) + '_' + (optionIndex + 1));
                                                            const nodeIdEl = optionEl.querySelector('#triggerCheckboxOptionNodeId' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1) + '_' + (optionIndex + 1));
                                                            if (textEl && nodeIdEl) {
                                                                checkboxOptions.push({
                                                                    text: textEl.value.trim(),
                                                                    nodeId: nodeIdEl.value.trim()
                                                                });
                                                            }
                                                        });
                                                    }
                                                    triggerFields.push({
                                                        type: 'checkbox',
                                                        fieldName: checkboxFieldNameEl.value.trim(),
                                                        options: checkboxOptions
                                                    });
                                                } else if (dropdownFieldNameEl) {
                                                    // Trigger dropdown field

                                                    const dropdownOptions = [];
                                                    if (dropdownOptionsContainer) {
                                                        const dropdownOptionElements = dropdownOptionsContainer.querySelectorAll('[class^="trigger-dropdown-option-"]');
                                                        dropdownOptionElements.forEach((optionEl, optionIndex) => {
                                                            const textEl = optionEl.querySelector('#triggerDropdownOptionText' + questionId + '_' + fieldOrder + '_' + (sequenceIndex + 1) + '_' + (fieldIndex + 1) + '_' + (optionIndex + 1));
                                                            if (textEl && textEl.value.trim()) {
                                                                dropdownOptions.push({
                                                                    text: textEl.value.trim()
                                                                });
                                                            }
                                                        });
                                                    }
                                                    const dropdownField = {
                                                        type: 'dropdown',
                                                        fieldName: dropdownFieldNameEl.value.trim(),
                                                        options: dropdownOptions
                                                    };
                                                    // Check for conditional logic - check window object first (most reliable)
                                                    const key = `${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`;
                                                    let conditionalLogicEnabled = false;
                                                    let storedConditions = [];
                                                    if (window.triggerDropdownConditionalLogic && window.triggerDropdownConditionalLogic[key]) {
                                                        const storedLogic = window.triggerDropdownConditionalLogic[key];
                                                        conditionalLogicEnabled = storedLogic.enabled || false;
                                                        storedConditions = storedLogic.conditions || [];
                                                    }
                                                    // Also check checkbox state as fallback
                                                    if (!conditionalLogicEnabled) {
                                                        const enableConditionalLogicCheckbox = fieldEl.querySelector(`#enableConditionalLogicDropdown${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                        conditionalLogicEnabled = enableConditionalLogicCheckbox && enableConditionalLogicCheckbox.checked;
                                                    }
                                                    // Include conditional logic if enabled
                                                    if (conditionalLogicEnabled) {
                                                        // Get conditions from the conditional logic UI (as fallback if window object doesn't have them)
                                                        const conditionalLogicContainer = fieldEl.querySelector(`#conditionalLogicUIDropdown${questionId}_${fieldOrder}_${sequenceIndex + 1}_${fieldIndex + 1}`);
                                                        const conditions = [];
                                                        if (conditionalLogicContainer) {
                                                            const conditionDropdowns = conditionalLogicContainer.querySelectorAll('select');
                                                            conditionDropdowns.forEach(dropdown => {
                                                                const value = dropdown.value.trim();
                                                                if (value) {
                                                                    conditions.push(value);
                                                                }
                                                            });
                                                        }
                                                        // Use stored conditions if available, otherwise use dropdown values
                                                        if (storedConditions.length > 0) {
                                                            dropdownField.conditionalLogic = {
                                                                enabled: true,
                                                                conditions: storedConditions.filter(c => c && c.trim() !== '')
                                                            };
                                                        } else if (conditions.length > 0) {
                                                            dropdownField.conditionalLogic = {
                                                                enabled: true,
                                                                conditions: conditions
                                                            };
                                                        }
                                                    }
                                                    triggerFields.push(dropdownField);
                                                } else if (dateLabelEl && dateNodeIdEl) {
                                                    // Trigger date field

                                                    triggerFields.push({
                                                        type: 'date',
                                                        label: dateLabelEl.value.trim(),
                                                        nodeId: dateNodeIdEl.value.trim()
                                                    });
                                                } else if (isPdfField && pdfNumberEl && pdfNameEl) {
                                                    // This is a trigger PDF field

                                                    triggerFields.push({
                                                        type: 'pdf',
                                                        number: pdfNumberEl.value.trim(),
                                                        pdfTitle: pdfTitleInputEl ? pdfTitleInputEl.value.trim() : '',
                                                        pdfName: pdfNameEl.value.trim(),
                                                        priceId: pdfPriceIdEl ? pdfPriceIdEl.value.trim() : ''
                                                    });
                                                } else if (allPdfNumberInputs.length > 0 && allPdfNameInputs.length > 0) {
                                                    // Fallback: try to detect PDF even if title check failed

                                                    const fallbackPdfNumber = allPdfNumberInputs[0];
                                                    const fallbackPdfTitle = allPdfTitleInputs.length > 0 ? allPdfTitleInputs[0] : null;
                                                    const fallbackPdfName = allPdfNameInputs[0];
                                                    const fallbackPdfPriceId = allPdfPriceIdInputs.length > 0 ? allPdfPriceIdInputs[0] : null;

                                                    triggerFields.push({
                                                        type: 'pdf',
                                                        number: fallbackPdfNumber.value.trim(),
                                                        pdfTitle: fallbackPdfTitle ? fallbackPdfTitle.value.trim() : '',
                                                        pdfName: fallbackPdfName.value.trim(),
                                                        priceId: fallbackPdfPriceId ? fallbackPdfPriceId.value.trim() : ''
                                                    });
                                                } else {
                                                    // Check for trigger location field (simplified "Location Data Added" format)
                                                    // Look for the "Location Data Added" text in the field
                                                    const locationTextEl = fieldEl.querySelector('div[style*="color: #28a745"]');
                                                    if (locationTextEl && locationTextEl.textContent.trim() === 'Location Data Added') {
                                                        // This is a trigger location field

                                                        // Get the location title from the input field
                                                        const locationTitleEl = fieldEl.querySelector('input[id*="triggerLocationTitle"]');
                                                        const locationTitle = locationTitleEl ? locationTitleEl.value.trim() : 'Location Data';
                                                        triggerFields.push({
                                                            type: 'location',
                                                            fieldName: locationTitle || 'Location Data',
                                                            nodeId: 'location_data'
                                                        });
                                                    } else {
                                                        // Check for trigger PDF field
                                                        const pdfTitleEl = fieldEl.querySelector('div[style*="color: #DC3545"]');
                                                        const isPdfField = pdfTitleEl && pdfTitleEl.textContent && pdfTitleEl.textContent.trim().includes('Trigger PDF');
                                                        const pdfNumberEl = fieldEl.querySelector('input[id*="triggerPdfNumber"]');
                                                        const pdfTitleInputEl = fieldEl.querySelector('input[id*="triggerPdfTitle"]');
                                                        const pdfNameEl = fieldEl.querySelector('input[id*="triggerPdfName"]');
                                                        const pdfPriceIdEl = fieldEl.querySelector('input[id*="triggerPdfPriceId"]');
                                                        if (isPdfField && pdfNumberEl && pdfNameEl) {
                                                            // This is a trigger PDF field

                                                            triggerFields.push({
                                                                type: 'pdf',
                                                                number: pdfNumberEl.value.trim(),
                                                                pdfTitle: pdfTitleInputEl ? pdfTitleInputEl.value.trim() : '',
                                                                pdfName: pdfNameEl.value.trim(),
                                                                priceId: pdfPriceIdEl ? pdfPriceIdEl.value.trim() : ''
                                                            });
                                                        } else if (pdfNumberEl && pdfNameEl) {
                                                            // Fallback: try to detect PDF even if title check failed

                                                            triggerFields.push({
                                                                type: 'pdf',
                                                                number: pdfNumberEl.value.trim(),
                                                                pdfTitle: pdfTitleInputEl ? pdfTitleInputEl.value.trim() : '',
                                                                pdfName: pdfNameEl.value.trim(),
                                                                priceId: pdfPriceIdEl ? pdfPriceIdEl.value.trim() : ''
                                                            });
                                                        } else {

                                                        }

                                                        for (let i = 0; i < fieldEl.children.length; i++) {
                                                            const child = fieldEl.children[i];

                                                        }
                                                    }
                                                }
                                            });

                                        } else {

                                        }

                                        triggerSequences.push({
                                            condition: triggerConditionEl ? triggerConditionEl.value.trim() : '',
                                            fields: triggerFields
                                        });

                                    });
                                } else {

                                    const alternativeContainer = document.querySelector('#triggerSequences' + questionId + '_' + fieldOrder);

                                    if (alternativeContainer) {

                                    }
                                }
                                const fieldData = {
                                    type: fieldType,
                                    fieldName: fieldNameEl.value.trim(),
                                    options: dropdownOptions,
                                    triggerSequences: triggerSequences,
                                    order: fieldOrder
                                };

                                allFieldsInOrder.push(fieldData);
                            }
                        } else if (fieldType === 'location') {
                            // Handle main location unified field
                            const titleEl = el.querySelector('#locationTitle' + questionId + '_' + fieldOrder);
                            const title = titleEl ? titleEl.value.trim() : 'Location Data';
                            const fieldData = {
                                type: 'location',
                                fieldName: title || 'Location Data',
                                nodeId: 'location_data',
                                order: fieldOrder
                            };

                            allFieldsInOrder.push(fieldData);
                        } else if (fieldType === 'time') {
                            // Handle time fields - use same structure as label fields
                        if (labelTextEl && nodeIdTextEl) {
                            const fieldData = {
                                type: fieldType,
                                label: labelTextEl.textContent.trim(),
                                nodeId: nodeIdTextEl.textContent.trim(),
                                order: fieldOrder
                            };

                                allFieldsInOrder.push(fieldData);
                            }
                        } else if (labelTextEl && nodeIdTextEl) {
                            // Handle regular fields (label, amount, etc.)
                            const labelText = labelTextEl.textContent.trim();
                            const nodeIdText = nodeIdTextEl.textContent.trim();
                            const prefillValue = el.getAttribute('data-prefill') || '';
                            const fieldData = {
                                type: fieldType,
                                label: labelText,
                                nodeId: nodeIdText,
                                order: fieldOrder
                            };
                            // Always include prefill for label type fields (even if empty)
                            if (fieldType === 'label') {
                                fieldData.prefill = prefillValue;
                            }
                            // Export conditional prefills for both label and amount fields
                            if (fieldType === 'label' || fieldType === 'amount' || fieldType === 'phone') {
                                const conditionalPrefillsData = el.getAttribute('data-conditional-prefills');
                                if (conditionalPrefillsData) {
                                    try {
                                        fieldData.conditionalPrefills = JSON.parse(conditionalPrefillsData);
                                    } catch (e) {

                                    }
                                }
                            }

                            allFieldsInOrder.push(fieldData);
                        }
                    });
                    // Sort by data-order attribute (creation order)
                    allFieldsInOrder.sort((a, b) => a.order - b.order);
                    // Store in the same format as numberedDropdown
                    questionData.allFieldsInOrder = allFieldsInOrder;

                } else {
                    // Fallback to old format if no unified fields found

                const multiBlocks = questionBlock.querySelectorAll(`#multipleTextboxesOptions${questionId} > div`);
                questionData.textboxes = [];
                questionData.amounts = [];
                multiBlocks.forEach((optionDiv, index) => {
                    // Check if this is a textbox or amount block
                    if (optionDiv.classList.contains('amount-block')) {
                        const labelInput = optionDiv.querySelector(`#multipleAmountLabel${questionId}_${index + 1}`);
                        const nameIdInput = optionDiv.querySelector(`#multipleAmountName${questionId}_${index + 1}`);
                        const placeholderInput = optionDiv.querySelector(`#multipleAmountPlaceholder${questionId}_${index + 1}`);
                        let labelText = labelInput ? (labelInput.value === '' ? '' : labelInput.value.trim()) : `Amount ${index + 1}`;
                        let nameId = (!nameIdInput || nameIdInput.value.trim() === '') ? `amount${questionId}_${index + 1}` : nameIdInput.value.trim();
                        let placeholder = placeholderInput ? (placeholderInput.value === '' ? '' : placeholderInput.value.trim()) : '';
                        questionData.amounts.push({
                            label: labelText,
                            nameId: nameId,
                            placeholder: placeholder
                        });
                    } else {
                        const labelInput = optionDiv.querySelector(`#multipleTextboxLabel${questionId}_${index + 1}`);
                        const nameIdInput = optionDiv.querySelector(`#multipleTextboxName${questionId}_${index + 1}`);
                        const placeholderInput = optionDiv.querySelector(`#multipleTextboxPlaceholder${questionId}_${index + 1}`);
                        let labelText = labelInput ? (labelInput.value === '' ? '' : labelInput.value.trim()) : `Textbox ${index + 1}`;
                        let nameId = (!nameIdInput || nameIdInput.value.trim() === '') ? `answer${questionId}_${index + 1}` : nameIdInput.value.trim();
                        let placeholder = placeholderInput ? (placeholderInput.value === '' ? '' : placeholderInput.value.trim()) : '';
                        questionData.textboxes.push({
                            label: labelText,
                            nameId: nameId,
                            placeholder: placeholder
                        });
                    }
                });
                }
            }
            else if (
                questionType === 'text' ||
                questionType === 'radio' ||
                questionType === 'money' ||
                questionType === 'currency' ||
                questionType === 'date' ||
                questionType === 'email' ||
                questionType === 'phone' ||
                questionType === 'dateRange'
            ) {
                const nameId = questionBlock.querySelector(`#textboxName${questionId}`)?.value.trim() || `answer${questionId}`;
                const placeholder = questionBlock.querySelector(`#textboxPlaceholder${questionId}`)?.value.trim() || '';
                questionData.nameId = nameId;
                questionData.placeholder = placeholder;
            }
            else if (questionType === 'bigParagraph') {
                const nameId = questionBlock.querySelector(`#textboxName${questionId}`)?.value.trim() || `answer${questionId}`;
                const placeholder = questionBlock.querySelector(`#textboxPlaceholder${questionId}`)?.value.trim() || '';
                const lineLimit = questionBlock.querySelector(`#lineLimit${questionId}`)?.value.trim() || '';
                const maxCharacterLimit = questionBlock.querySelector(`#maxCharacterLimit${questionId}`)?.value.trim() || '';
                const paragraphLimit = questionBlock.querySelector(`#paragraphLimit${questionId}`)?.value.trim() || '';
                questionData.nameId = nameId;
                questionData.placeholder = placeholder;
                if (lineLimit) {
                    questionData.lineLimit = parseInt(lineLimit);
                }
                if (maxCharacterLimit) {
                    questionData.maxCharacterLimit = parseInt(maxCharacterLimit);
                }
                if (paragraphLimit) {
                    questionData.paragraphLimit = parseInt(paragraphLimit);
                }
            }
            // -- Push questionData once (after we finish building it!) --
            sectionData.questions.push(questionData);
        });
        formData.sections.push(sectionData);
    }
    // ========== Export groups ==========
    formData.groups = [];
    const groupBlocks = document.querySelectorAll('.group-block');
    // Debug log
    groupBlocks.forEach((groupBlock) => {
        const groupId = parseInt(groupBlock.id.replace('groupBlock', ''), 10);
        const groupName = document.getElementById(`groupName${groupId}`).value || `Group ${groupId}`;
        const groupData = {
            groupId: groupId,
            name: groupName,
            sections: []
        };
        // Collect sections in this group
        const groupSectionsDiv = document.getElementById(`groupSections${groupId}`);
        if (groupSectionsDiv) {
            const sectionItems = groupSectionsDiv.querySelectorAll('.group-section-item');
            // Debug log
            sectionItems.forEach((sectionItem) => {
                const select = sectionItem.querySelector('select');
                if (select && select.value.trim()) {
                    groupData.sections.push(select.value.trim());
                    // Debug log
                }
            });
        }
        formData.groups.push(groupData);
        // Debug log
    });
    // ========== Export hidden fields with multi-term calculations ==========
    const hiddenFieldsContainer = document.getElementById('hiddenFieldsContainer');
    if (hiddenFieldsContainer) {
        const hiddenFieldBlocks = hiddenFieldsContainer.querySelectorAll('.hidden-field-block');
        hiddenFieldBlocks.forEach(fieldBlock => {
            const hiddenFieldId = fieldBlock.id.replace('hiddenFieldBlock', '');
            const fieldType = document.getElementById(`hiddenFieldType${hiddenFieldId}`).value;
            const fieldName = document.getElementById(`hiddenFieldName${hiddenFieldId}`)?.value.trim() || '';
            const isChecked = document.getElementById(`hiddenFieldChecked${hiddenFieldId}`)?.checked || false;
            const hiddenFieldData = {
                hiddenFieldId: hiddenFieldId,
                type: fieldType,
                name: fieldName,
                checked: isChecked,
                conditions: [],
                calculations: []
            };
            // If type=checkbox => parse conditions + multi-term calc
            // If type=text => parse conditions + multi-term calc for text 
            if (fieldType === 'checkbox') {
                // conditions
                const conditionalDiv = document.getElementById(`conditionalAutofillForCheckbox${hiddenFieldId}`);
                if (conditionalDiv) {
                    const conditionDivs = conditionalDiv.querySelectorAll('div[class^="condition"]');
                    conditionDivs.forEach((condDiv, index) => {
                        const cid = index + 1;
                        const qId = condDiv.querySelector(`#conditionQuestion${hiddenFieldId}_${cid}`)?.value || '';
                        const aVal = condDiv.querySelector(`#conditionAnswer${hiddenFieldId}_${cid}`)?.value || '';
                        const fillVal = condDiv.querySelector(`#conditionValue${hiddenFieldId}_${cid}`)?.value || '';
                        if (qId && aVal && fillVal) {
                            hiddenFieldData.conditions.push({
                                questionId: qId,
                                answerValue: aVal,
                                autofillValue: fillVal
                            });
                        }
                    });
                }
                // MULTI-TERM calculations for checkbox
                const calculationBlock = fieldBlock.querySelector(`#calculationBlock${hiddenFieldId}`);
                if (calculationBlock) {
                    const calcRows = calculationBlock.querySelectorAll(`div[id^="calculationRow${hiddenFieldId}_"]`);
                    calcRows.forEach(row => {
                        const rowIdParts = row.id.split('_');
                        const calcIndex = rowIdParts[1];
                        const eqContainer = row.querySelector(`#equationContainer${hiddenFieldId}_${calcIndex}`);
                        const termsArr = [];
                        if (eqContainer) {
                            // each .equation-term-cb
                            const termDivs = eqContainer.querySelectorAll('.equation-term-cb');
                            termDivs.forEach((termDiv, idx) => {
                                const termNumber = idx + 1;
                                let operatorVal = '';
                                if (termNumber > 1) {
                                    const opSel = termDiv.querySelector(`#calcTermOperator${hiddenFieldId}_${calcIndex}_${termNumber}`);
                                    if (opSel) operatorVal = opSel.value;
                                }
                                const qSel = termDiv.querySelector(`#calcTermQuestion${hiddenFieldId}_${calcIndex}_${termNumber}`);
                                let questionNameIdVal = qSel ? qSel.value.trim() : '';
                                if (questionNameIdVal) {
                                    // For checkboxes with amounts, always use the real nameId (not amount_*)
                                    // If this is a checkbox with an amount, resolve to the nameId
                                    let resolvedNameId = questionNameIdVal;
                                    // Try to resolve if it's an amount_* reference for a checkbox
                                    let amountCheckboxMatch = questionNameIdVal.match(/^amount_(.+?)_(\d+)_(\d+)$/);
                                    if (amountCheckboxMatch) {
                                        // Find the checkbox question and option
                                        const baseLabel = amountCheckboxMatch[1];
                                        const questionNum = amountCheckboxMatch[2];
                                        const optionNum = amountCheckboxMatch[3];
                                        // Find the checkbox option with this label
                                        const options = findCheckboxOptionsByQuestionId(questionNum);
                                        if (options && options.length > 0) {
                                            const idx = parseInt(optionNum, 10) - 1;
                                            if (idx >= 0 && idx < options.length) {
                                                resolvedNameId = options[idx].nameId;
                                            }
                                        }
                                    }
                                    // Otherwise, keep as is (for money, numberedDropdown, etc)
                                    termsArr.push({
                                        operator: (termNumber===1 ? '' : operatorVal),
                                        questionNameId: resolvedNameId
                                    });
                                }
                            });
                        }
                        const cmpOpSel = row.querySelector(`#calcCompareOperator${hiddenFieldId}_${calcIndex}`);
                        const compareOperatorVal = cmpOpSel ? cmpOpSel.value : '=';
                        const thrEl = row.querySelector(`#calcThreshold${hiddenFieldId}_${calcIndex}`);
                        const thresholdVal = thrEl ? thrEl.value.trim() : '0';
                        const resEl = row.querySelector(`#calcResult${hiddenFieldId}_${calcIndex}`);
                        const resultVal = resEl ? resEl.value.trim() : 'checked';
                        if (termsArr.length>0) {
                            hiddenFieldData.calculations.push({
                                terms: termsArr,
                                compareOperator: compareOperatorVal,
                                threshold: thresholdVal,
                                result: resultVal
                            });
                        }
                    });
                }
            }
            else if (fieldType === 'text') {
                // conditions
                const textConditionalDiv = document.getElementById(`conditionalAutofill${hiddenFieldId}`);
                if (textConditionalDiv) {
                    const conditionDivs = textConditionalDiv.querySelectorAll('div[class^="condition"]');
                    conditionDivs.forEach((condDiv, index) => {
                        const cid = index + 1;
                        const qId = condDiv.querySelector(`#conditionQuestion${hiddenFieldId}_${cid}`)?.value || '';
                        const aVal = condDiv.querySelector(`#conditionAnswer${hiddenFieldId}_${cid}`)?.value || '';
                        const fillVal = condDiv.querySelector(`#conditionValue${hiddenFieldId}_${cid}`)?.value || '';
                        if (qId && aVal && fillVal) {
                            hiddenFieldData.conditions.push({
                                questionId: qId,
                                answerValue: aVal,
                                autofillValue: fillVal
                            });
                        }
                    });
                }
                // MULTI-TERM calculations for text
                const textCalcBlock = fieldBlock.querySelector(`#textCalculationBlock${hiddenFieldId}`);
                if (textCalcBlock) {
                    const calcRows = textCalcBlock.querySelectorAll(`div[id^="textCalculationRow${hiddenFieldId}_"]`);
                    calcRows.forEach(row => {
                        const rowIdParts = row.id.split('_');
                        const calcIndex = rowIdParts[1];
                        const eqContainer = row.querySelector(`#textEquationContainer${hiddenFieldId}_${calcIndex}`);
                        const termsArr = [];
                        if (eqContainer) {
                            const termDivs = eqContainer.querySelectorAll('.equation-term-text');
                            termDivs.forEach((termDiv, idx) => {
                                const termNumber = idx + 1;
                                let operatorVal = '';
                                if (termNumber>1) {
                                    const opSel = termDiv.querySelector(`#textTermOperator${hiddenFieldId}_${calcIndex}_${termNumber}`);
                                    if (opSel) operatorVal = opSel.value;
                                }
                                const qSel = termDiv.querySelector(`#textTermQuestion${hiddenFieldId}_${calcIndex}_${termNumber}`);
                                let questionNameIdVal = qSel ? qSel.value.trim() : '';
                                if (questionNameIdVal) {
                                    // For checkboxes with amounts, always use the real nameId (not amount_*)
                                    let resolvedNameId = questionNameIdVal;
                                    let amountCheckboxMatch = questionNameIdVal.match(/^amount_(.+?)_(\d+)_(\d+)$/);
                                    if (amountCheckboxMatch) {
                                        const baseLabel = amountCheckboxMatch[1];
                                        const questionNum = amountCheckboxMatch[2];
                                        const optionNum = amountCheckboxMatch[3];
                                        const options = findCheckboxOptionsByQuestionId(questionNum);
                                        if (options && options.length > 0) {
                                            const idx = parseInt(optionNum, 10) - 1;
                                            if (idx >= 0 && idx < options.length) {
                                                resolvedNameId = options[idx].nameId;
                                            }
                                        }
                                    }
                                    termsArr.push({
                                        operator: (termNumber===1 ? '' : operatorVal),
                                        questionNameId: resolvedNameId
                                    });
                                }
                            });
                        }
                        const cmpOpSel = row.querySelector(`#textCompareOperator${hiddenFieldId}_${calcIndex}`);
                        const compareOperatorVal = cmpOpSel ? cmpOpSel.value : '=';
                        const thrEl = row.querySelector(`#textThreshold${hiddenFieldId}_${calcIndex}`);
                        const thresholdVal = thrEl ? thrEl.value.trim() : '0';
                        const fillValEl = row.querySelector(`#textFillValue${hiddenFieldId}_${calcIndex}`);
                        const fillValueStr = fillValEl ? fillValEl.value.trim() : '';
                        if (termsArr.length>0) {
                            hiddenFieldData.calculations.push({
                                terms: termsArr,
                                compareOperator: compareOperatorVal,
                                threshold: thresholdVal,
                                fillValue: fillValueStr
                            });
                        }
                    });
                }
            }
            formData.hiddenFields.push(hiddenFieldData);
        });
    }
    const jsonString = JSON.stringify(formData, null, 2);
    downloadJSON(jsonString, "form_data.json");
    // Also copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonString).then(() => {
            // Show a brief notification that it was copied
            const exportButton = document.querySelector('button[onclick="exportForm()"]');
            if (exportButton) {
                const originalText = exportButton.textContent;
                exportButton.textContent = 'Copied to clipboard!';
                exportButton.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    exportButton.textContent = originalText;
                    exportButton.style.backgroundColor = '';
                }, 2000);
            }
        }).catch(err => {

        });
    }
}
function downloadJSON(content, filename) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
function importForm(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const jsonData = JSON.parse(e.target.result);
            loadFormData(jsonData);
            // Additional call in case the first one happens too early
            setTimeout(updateFormAfterImport, 300);
        };
        reader.readAsText(file);
    }
}
/**
 * If your GUI supports adding hidden fields,
 * we use this to create them from loaded JSON
 */
function addHiddenFieldWithData(hiddenField) {
    const hiddenFieldsContainer = document.getElementById('hiddenFieldsContainer');
    const hiddenFieldBlock = document.createElement('div');
    const currentHiddenFieldId = hiddenField.hiddenFieldId;
    hiddenFieldBlock.className = 'hidden-field-block';
    hiddenFieldBlock.id = `hiddenFieldBlock${currentHiddenFieldId}`;
    hiddenFieldBlock.innerHTML = `
        <label>Hidden Field ${currentHiddenFieldId}: </label>
        <select id="hiddenFieldType${currentHiddenFieldId}" onchange="toggleHiddenFieldOptions(${currentHiddenFieldId})">
            <option value="text" ${hiddenField.type === 'text' ? 'selected' : ''}>Textbox</option>
            <option value="checkbox" ${hiddenField.type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
        </select><br><br>
        <div id="hiddenFieldOptions${currentHiddenFieldId}">
            <!-- Options will be populated based on the type -->
        </div>
        <button type="button" onclick="removeHiddenField(${currentHiddenFieldId})">Remove Hidden Field</button>
        <hr>
    `;
    hiddenFieldsContainer.appendChild(hiddenFieldBlock);
    // Toggle the correct suboptions
    toggleHiddenFieldOptions(currentHiddenFieldId);
    // Fill the name
    document.getElementById(`hiddenFieldName${currentHiddenFieldId}`).value = hiddenField.name || '';
    if (hiddenField.type === 'checkbox') {
        document.getElementById(`hiddenFieldChecked${currentHiddenFieldId}`).checked = !!hiddenField.checked;
        // Rebuild conditions
        if (hiddenField.conditions && hiddenField.conditions.length > 0) {
            hiddenField.conditions.forEach((condition, index) => {
                addConditionalAutofillForCheckbox(currentHiddenFieldId);
                const condRow = index + 1;
                document.getElementById(`conditionQuestion${currentHiddenFieldId}_${condRow}`).value = condition.questionId;
                updateConditionAnswers(currentHiddenFieldId, condRow);
                document.getElementById(`conditionAnswer${currentHiddenFieldId}_${condRow}`).value = condition.answerValue;
                document.getElementById(`conditionValue${currentHiddenFieldId}_${condRow}`).value = condition.autofillValue;
            });
        }
        // Rebuild multi-term calculations (like "If eq => checked/unchecked")
        if (hiddenField.calculations && hiddenField.calculations.length > 0) {
            hiddenField.calculations.forEach((calcObj, index) => {
                addCalculationForCheckbox(currentHiddenFieldId);
                const calcIndex = index + 1;
                // remove default single term
                const eqContainer = document.getElementById(`equationContainer${currentHiddenFieldId}_${calcIndex}`);
                eqContainer.innerHTML = '';
                calcObj.terms.forEach((termObj, tindex) => {
                    addEquationTermCheckbox(currentHiddenFieldId, calcIndex);
                    const termNumber = tindex + 1;
                    if (termNumber>1) {
                        const opSel = document.getElementById(`calcTermOperator${currentHiddenFieldId}_${calcIndex}_${termNumber}`);
                        if (opSel) opSel.value = termObj.operator || '';
                    }
                    const qSel = document.getElementById(`calcTermQuestion${currentHiddenFieldId}_${calcIndex}_${termNumber}`);
                    if (qSel) {
                        // Check if this is a direct checkbox reference rather than an amount field
                        // We need to handle both formats - direct checkbox references or amount field references
                        let questionNameId = termObj.questionNameId || '';
                        // If it looks like a direct checkbox reference (not starting with "amount_")
                        if (questionNameId && !questionNameId.startsWith('amount_') && !questionNameId.match(/^amount\d+_/)) {
                            // Try to select it directly if it exists in the dropdown
                            qSel.value = questionNameId;
                            // If direct selection fails, search for a matching amount field to convert
                            if (qSel.value !== questionNameId) {
                                // This is a direct checkbox reference, but we need to find its corresponding amount field
                                // for backward compatibility with the dropdown which may show amount fields
                                const options = Array.from(qSel.options);
                                // Look for any amount field option that contains this checkbox name
                                for (const option of options) {
                                    if (option.value.includes(questionNameId) || 
                                        (option.text && option.text.toLowerCase().includes(questionNameId.replace(/_/g, ' ')))) {
                                        qSel.value = option.value;
                                        break;
                                    }
                                }
                            }
                        } else {
                            // Standard amount field reference
                            qSel.value = questionNameId;
                        }
                    }
                });
                const cmpSel = document.getElementById(`calcCompareOperator${currentHiddenFieldId}_${calcIndex}`);
                if (cmpSel) cmpSel.value = calcObj.compareOperator || '=';
                const thrEl = document.getElementById(`calcThreshold${currentHiddenFieldId}_${calcIndex}`);
                if (thrEl) thrEl.value = calcObj.threshold || '0';
                const resEl = document.getElementById(`calcResult${currentHiddenFieldId}_${calcIndex}`);
                if (resEl) resEl.value = calcObj.result || 'checked';
            });
        }
    }
    else if (hiddenField.type === 'text') {
        // If we had an 'autofillQuestionId', we set it here if needed
        if (hiddenField.autofillQuestionId) {
            const autofillSelect = document.getElementById(`hiddenFieldAutofill${currentHiddenFieldId}`);
            if (autofillSelect) autofillSelect.value = hiddenField.autofillQuestionId;
        }
        // Rebuild conditions (like "If question X => autofill = ...")
        if (hiddenField.conditions && hiddenField.conditions.length > 0) {
            hiddenField.conditions.forEach((condition, index) => {
                addConditionalAutofill(currentHiddenFieldId);
                const condRow = index + 1;
                document.getElementById(`conditionQuestion${currentHiddenFieldId}_${condRow}`).value = condition.questionId;
                updateConditionAnswers(currentHiddenFieldId, condRow);
                document.getElementById(`conditionAnswer${currentHiddenFieldId}_${condRow}`).value = condition.answerValue;
                document.getElementById(`conditionValue${currentHiddenFieldId}_${condRow}`).value = condition.autofillValue;
            });
        }
        // Rebuild multi-term calculations for text (like "If eq => fillValue")
        if (hiddenField.calculations && hiddenField.calculations.length > 0) {
            hiddenField.calculations.forEach((calcObj, index) => {
                addCalculationForText(currentHiddenFieldId);
                const calcIndex = index + 1;
                // remove default single term
                const eqCont = document.getElementById(`textEquationContainer${currentHiddenFieldId}_${calcIndex}`);
                eqCont.innerHTML='';
                calcObj.terms.forEach((termObj, tindex) => {
                    addEquationTermText(currentHiddenFieldId, calcIndex);
                    const termNumber = tindex + 1;
                    if (termNumber>1) {
                        const opSel = document.getElementById(`textTermOperator${currentHiddenFieldId}_${calcIndex}_${termNumber}`);
                        if (opSel) opSel.value = termObj.operator || '';
                    }
                    const qSel = document.getElementById(`textTermQuestion${currentHiddenFieldId}_${calcIndex}_${termNumber}`);
                    if (qSel) {
                        // Check if this is a direct checkbox reference rather than an amount field
                        // We need to handle both formats - direct checkbox references or amount field references
                        let questionNameId = termObj.questionNameId || '';
                        // If it looks like a direct checkbox reference (not starting with "amount_")
                        if (questionNameId && !questionNameId.startsWith('amount_') && !questionNameId.match(/^amount\d+_/)) {
                            // Try to select it directly if it exists in the dropdown
                            qSel.value = questionNameId;
                            // If direct selection fails, search for a matching amount field to convert
                            if (qSel.value !== questionNameId) {
                                // This is a direct checkbox reference, but we need to find its corresponding amount field
                                // for backward compatibility with the dropdown which may show amount fields
                                const options = Array.from(qSel.options);
                                // Look for any amount field option that contains this checkbox name
                                for (const option of options) {
                                    if (option.value.includes(questionNameId) || 
                                        (option.text && option.text.toLowerCase().includes(questionNameId.replace(/_/g, ' ')))) {
                                        qSel.value = option.value;
                                        break;
                                    }
                                }
                            }
                        } else {
                            // Standard amount field reference
                            qSel.value = questionNameId;
                        }
                    }
                });
                const cmpSel = document.getElementById(`textCompareOperator${currentHiddenFieldId}_${calcIndex}`);
                if (cmpSel) cmpSel.value = calcObj.compareOperator || '=';
                const thrEl = document.getElementById(`textThreshold${currentHiddenFieldId}_${calcIndex}`);
                if (thrEl) thrEl.value = calcObj.threshold || '0';
                const fillValEl = document.getElementById(`textFillValue${currentHiddenFieldId}_${calcIndex}`);
                if (fillValEl) fillValEl.value = calcObj.fillValue || '';
            });
        }
    }
}
/**
 * Update trigger condition options for a dropdown field
 */
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
function updateFormAfterImport() {
    // Update autofill options in hidden fields
    if (typeof updateAutofillOptions === 'function') {
        updateAutofillOptions();
    }
    // Update calculation dropdowns in hidden fields
    if (typeof updateAllCalculationDropdowns === 'function') {
        // Run this with a slight delay to ensure DOM is ready
        setTimeout(updateAllCalculationDropdowns, 100);
    }
    // Update group section dropdowns
    if (typeof updateGroupSectionDropdowns === 'function') {
        // Run this with a slight delay to ensure DOM is ready
        setTimeout(updateGroupSectionDropdowns, 100);
    }
    // Update checklist logic dropdowns
    if (typeof updateAllChecklistLogicDropdowns === 'function') {
        // Run this with a slight delay to ensure DOM is ready
        setTimeout(updateAllChecklistLogicDropdowns, 100);
    }
    // Update conditional logic dropdowns
    if (typeof updateAllConditionalLogicDropdowns === 'function') {
        // Run this with a much longer delay to ensure DOM is ready
        setTimeout(updateAllConditionalLogicDropdowns, 1000);
    }
    // Update alert logic dropdowns
    if (typeof updateAllAlertLogicDropdowns === 'function') {
        // Run this with a slight delay to ensure DOM is ready
        setTimeout(updateAllAlertLogicDropdowns, 100);
    }
    // Update PDF logic dropdowns
    if (typeof updateAllPdfLogicDropdowns === 'function') {
        // Run this with a slight delay to ensure DOM is ready
        setTimeout(updateAllPdfLogicDropdowns, 100);
    }
}
function updateConditionAnswers(hiddenFieldId, condId) {
    const questionSelect = document.getElementById(`conditionQuestion${hiddenFieldId}_${condId}`);
    if (!questionSelect) return;
    const questionId = questionSelect.value;
    if (!questionId) return;
    // Find the question block
    const questionBlock = document.getElementById(`questionBlock${questionId}`);
    if (!questionBlock) return;
    const questionType = questionBlock.querySelector(`#questionType${questionId}`).value;
    const answerSelect = document.getElementById(`conditionAnswer${hiddenFieldId}_${condId}`);
    if (!answerSelect) return;
    // Clear existing options
    answerSelect.innerHTML = '<option value="">Select an answer</option>';
    if (questionType === 'checkbox') {
        const optionsDiv = questionBlock.querySelector(`#checkboxOptions${questionId}`);
        if (optionsDiv) {
            const optionDivs = optionsDiv.querySelectorAll('div');
            optionDivs.forEach((optDiv, index) => {
                const textInput = optDiv.querySelector(`#checkboxOptionText${questionId}_${index + 1}`);
                if (textInput) {
                    const optionText = textInput.value.trim();
                    if (optionText) {
                        const option = document.createElement('option');
                        option.value = optionText.toLowerCase();
                        option.textContent = optionText;
                        answerSelect.appendChild(option);
                    }
                }
            });
            // Check if "None of the above" option is enabled
            const noneCheckbox = document.querySelector(`#noneOfTheAbove${questionId}`);
            if (noneCheckbox && noneCheckbox.checked) {
                const noneOption = document.createElement('option');
                noneOption.value = 'none of the above';
                noneOption.textContent = 'None of the above';
                answerSelect.appendChild(noneOption);
            }
        }
    }
    // Other question types handling...
}