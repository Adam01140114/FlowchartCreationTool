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
    const formHTML = getFormHTML();
    navigator.clipboard.writeText(formHTML).then(() => {
        alert("HTML code has been copied to the clipboard.");
    });
    downloadHTML(formHTML, "custom_form.html");
}

function showPreview() {
    // Check if the getFormHTML function exists
    if (typeof getFormHTML !== 'function') {
        alert("Preview function not available in this context. Please try again from the form editor.");
        return;
    }
    
    const formHTML = getFormHTML();
    
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
            console.error('Failed to copy to clipboard:', err);
        });
    }
    
    const previewModal = document.getElementById('previewModal');
    const previewFrame = document.getElementById('previewFrame');
    previewFrame.srcdoc = formHTML;
    previewModal.style.display = 'flex';
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
                    
                    // Rebuild multiple textboxes
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
                            const fieldOrder = field.order || (index + 1);
                            const fieldDiv = document.createElement('div');
                            fieldDiv.className = `unified-field field-${fieldOrder}`;
                            fieldDiv.setAttribute('data-type', field.type);
                            fieldDiv.setAttribute('data-order', fieldOrder);
                            
                            const fieldTypeLabel = field.type === 'label' ? 'Label' : 'Amount';
                            fieldDiv.innerHTML = `
                                <div style="margin: 10px 0; padding: 12px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9f9; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                    <div style="font-weight: bold; color: #333;">${fieldTypeLabel}: <span id="labelText${question.questionId}_${fieldOrder}">${field.label}</span></div>
                                    <div style="font-size: 0.9em; color: #666;">Node ID: <span id="nodeIdText${question.questionId}_${fieldOrder}">${field.nodeId}</span></div>
                                    <div style="font-size: 0.8em; color: #999; margin-top: 5px;">Type: <span id="typeText${question.questionId}_${fieldOrder}">${fieldTypeLabel}</span> | Order: ${fieldOrder}</div>
                                    <button type="button" onclick="removeUnifiedField(${question.questionId}, ${fieldOrder})" style="margin-top: 5px; background: #ff4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;">Remove</button>
                                </div>
                            `;
                            unifiedFieldsDiv.appendChild(fieldDiv);
                            
                            // Add double-click event listener as backup
                            const displayDiv = fieldDiv.querySelector('div');
                            if (displayDiv) {
                                // Remove any existing event listeners to prevent duplicates
                                if (displayDiv._dblclickHandler) {
                                    displayDiv.removeEventListener('dblclick', displayDiv._dblclickHandler);
                                }
                                
                                // Add event listener for double-click editing
                                displayDiv._dblclickHandler = function() {
                                    editUnifiedField(question.questionId, fieldOrder);
                                };
                                displayDiv.addEventListener('dblclick', displayDiv._dblclickHandler);
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
                        const isTextboxQuestion = question.type === 'text' || question.type === 'bigParagraph' || question.type === 'money' || question.type === 'date' || question.type === 'dateRange';
                        
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

                // ============== PDF Logic ==============
                if (question.pdfLogic && question.pdfLogic.enabled) {
                    const pdfLogicCbox = questionBlock.querySelector(`#pdfLogic${question.questionId}`);
                    if (pdfLogicCbox) {
                        pdfLogicCbox.checked = true;
                        togglePdfLogic(question.questionId);
                    }
                    const pdfLogicPdfNameInput = questionBlock.querySelector(`#pdfLogicPdfName${question.questionId}`);
                    if (pdfLogicPdfNameInput) {
                        pdfLogicPdfNameInput.value = question.pdfLogic.pdfName;
                    }
                    const pdfLogicPdfDisplayNameInput = questionBlock.querySelector(`#pdfLogicPdfDisplayName${question.questionId}`);
                    if (pdfLogicPdfDisplayNameInput && question.pdfLogic.pdfDisplayName) {
                        pdfLogicPdfDisplayNameInput.value = question.pdfLogic.pdfDisplayName;
                    }
                    const pdfLogicStripePriceIdInput = questionBlock.querySelector(`#pdfLogicStripePriceId${question.questionId}`);
                    if (pdfLogicStripePriceIdInput) {
                        pdfLogicStripePriceIdInput.value = question.pdfLogic.stripePriceId || "";
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

    // 7) Build groups from JSON
    if (formData.groups && formData.groups.length > 0) {
        console.log('Importing groups:', formData.groups); // Debug log
        formData.groups.forEach(group => {
            addGroupWithData(group);
        });
    } else {
        console.log('No groups found in import data'); // Debug log
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
        checklistItems: [] // New field for checklist items
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
                    const isTextboxQuestion = questionType === 'text' || questionType === 'bigParagraph' || questionType === 'money' || questionType === 'date' || questionType === 'dateRange';
                    
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

            // ---------- PDF Logic ----------
            const pdfLogicEnabled = questionBlock.querySelector(`#pdfLogic${questionId}`)?.checked || false;
            const pdfLogicPdfName = questionBlock.querySelector(`#pdfLogicPdfName${questionId}`)?.value || "";
            const pdfLogicPdfDisplayName = questionBlock.querySelector(`#pdfLogicPdfDisplayName${questionId}`)?.value || "";
            const pdfLogicStripePriceId = questionBlock.querySelector(`#pdfLogicStripePriceId${questionId}`)?.value || "";
            
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
                pdfLogic: {
                    enabled: pdfLogicEnabled,
                    pdfName: pdfLogicPdfName,
                    pdfDisplayName: pdfLogicPdfDisplayName,
                    stripePriceId: pdfLogicStripePriceId,
                    conditions: pdfLogicConditionsArray
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
                
                // Collect unified field data in true creation order
                const unifiedContainer = questionBlock.querySelector(`#unifiedFields${questionId}`);
                console.log('🔧 [EXPORT DEBUG] Looking for unified container:', `#unifiedFields${questionId}`);
                console.log('🔧 [EXPORT DEBUG] Found unified container:', !!unifiedContainer);
                
                if (unifiedContainer) {
                    console.log('🔧 [EXPORT DEBUG] Unified container children count:', unifiedContainer.children.length);
                    console.log('🔧 [EXPORT DEBUG] Unified container innerHTML length:', unifiedContainer.innerHTML.length);
                    console.log('🔧 [EXPORT DEBUG] Unified container innerHTML preview:', unifiedContainer.innerHTML.substring(0, 200));
                }
                
                const unifiedFields = questionBlock.querySelectorAll(`#unifiedFields${questionId} .unified-field`);
                console.log('🔧 [EXPORT DEBUG] Found', unifiedFields.length, 'unified fields');
                
                // Also try a more direct approach
                const directUnifiedFields = document.querySelectorAll(`#unifiedFields${questionId} .unified-field`);
                console.log('🔧 [EXPORT DEBUG] Direct query found', directUnifiedFields.length, 'unified fields');
                
                // Use the direct query if the questionBlock query didn't work
                const fieldsToProcess = unifiedFields.length > 0 ? unifiedFields : directUnifiedFields;
                console.log('🔧 [EXPORT DEBUG] Using', fieldsToProcess.length, 'fields for processing');
                
                const allFieldsInOrder = [];
                
                // Process fields in their creation order
                fieldsToProcess.forEach((field, index) => {
                    const fieldType = field.getAttribute('data-type');
                    const fieldOrder = field.getAttribute('data-order');
                    const labelTextEl = field.querySelector('#labelText' + questionId + '_' + fieldOrder);
                    const nodeIdTextEl = field.querySelector('#nodeIdText' + questionId + '_' + fieldOrder);
                    
                    console.log('🔧 [EXPORT DEBUG] Processing field', index, ':', {
                        fieldType,
                        fieldOrder,
                        hasLabelText: !!labelTextEl,
                        hasNodeIdText: !!nodeIdTextEl,
                        labelText: labelTextEl ? labelTextEl.textContent.trim() : 'N/A',
                        nodeIdText: nodeIdTextEl ? nodeIdTextEl.textContent.trim() : 'N/A'
                    });
                    
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
                });
                
                // Sort by order to ensure correct sequence
                allFieldsInOrder.sort((a, b) => a.order - b.order);
                console.log('🔧 [EXPORT DEBUG] Final allFieldsInOrder:', allFieldsInOrder);

                questionData.min = rangeStart;
                questionData.max = rangeEnd;
                questionData.allFieldsInOrder = allFieldsInOrder;
                
                // Fallback to old format if no unified fields found
                if (allFieldsInOrder.length === 0) {
                    console.log('🔧 [EXPORT DEBUG] No unified fields found, falling back to old format');
                    
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
                    
                    console.log('🔧 [EXPORT DEBUG] Fallback data:', { labels, labelNodeIds, amounts });
                }
            }
            else if (questionType === 'multipleTextboxes') {
                // Export custom Node ID if it exists
                const nodeIdInput = questionBlock.querySelector(`#multipleTextboxesNodeId${questionId}`);
                if (nodeIdInput && nodeIdInput.value.trim()) {
                    questionData.nodeId = nodeIdInput.value.trim();
                }
                
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
            else if (
                questionType === 'text' ||
                questionType === 'radio' ||
                questionType === 'money' ||
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
                questionData.nameId = nameId;
                questionData.placeholder = placeholder;
                if (lineLimit) {
                    questionData.lineLimit = parseInt(lineLimit);
                }
                if (maxCharacterLimit) {
                    questionData.maxCharacterLimit = parseInt(maxCharacterLimit);
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
    console.log('Found group blocks:', groupBlocks.length); // Debug log
    
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
            console.log(`Group ${groupId} has ${sectionItems.length} sections`); // Debug log
            sectionItems.forEach((sectionItem) => {
                const select = sectionItem.querySelector('select');
                if (select && select.value.trim()) {
                    groupData.sections.push(select.value.trim());
                    console.log(`Added section "${select.value.trim()}" to group ${groupId}`); // Debug log
                }
            });
        }
        
        formData.groups.push(groupData);
        console.log('Exported group data:', groupData); // Debug log
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
            console.error('Failed to copy to clipboard:', err);
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