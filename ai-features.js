// AI Features - Upload Flowchart Details and Upload Document PDF
// This file handles all AI-related functionality
// Load AI config - using embedded config to avoid CORS issues
function loadAIConfig() {
  // Try to get API key from environment or use fallback
  const apiKey = window.OPENAI_API_KEY || 'YOUR_API_KEY_HERE';
  if (apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('OpenAI API key not configured. Please set window.OPENAI_API_KEY or update the config.');
  }
  return {
    apiKey: apiKey,
    model: 'gpt-4o-mini', // Use a more capable model for flowchart generation
    maxTokens: 8000,
    temperature: 0.3
  };
}
// Generate flowchart from description using ChatGPT
async function generateFlowchartFromDescription(description) {
  try {
    const aiConfig = loadAIConfig();
    const systemPrompt = `You are a flowchart generator. Based on the user's description, generate a valid flowchart JSON that can be imported into a flowchart creation tool.
CRITICAL: You must generate EXACTLY the correct JSON structure with ALL required nodes and connections. Here's the precise format:
{
  "cells": [
    {
      "id": "unique_id",
      "value": "Node text",
      "geometry": {"x": x_position, "y": y_position, "width": 200, "height": 80},
      "style": "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;spacing=12;fontSize=16;questionType=dropdown;nodeId=question_name;section=1;fillColor=#80bfff;fontColor=#070665;strokeColor=hsl(0, 100%, 80%)",
      "vertex": true,
      "edge": false,
      "source": null,
      "target": null,
      "_textboxes": null,
      "_questionText": "Node text",
      "_questionId": "1",
      "_nameId": "question_name"
    }
  ],
  "sectionPrefs": {
    "1": {
      "borderColor": "hsl(0, 100%, 80%)",
      "name": "Section Name"
    }
  }
}
MANDATORY REQUIREMENTS - YOU MUST INCLUDE ALL OF THESE:
1. QUESTION NODES (questions that have options):
   - Style: "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;spacing=12;fontSize=16;questionType=dropdown;nodeId=question_name;section=1;fillColor=#80bfff;fontColor=#070665;strokeColor=hsl(0, 100%, 80%)"
   - Geometry: {"x": x, "y": y, "width": 200, "height": 80}
   - Include: _textboxes: null, _questionText: "question text", _questionId: "1", _nameId: "question_name"
2. OPTION NODES (answers/choices) - CREATE ONE FOR EACH OPTION:
   - Style: "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=dropdown;spacing=12;fontSize=16;section=1;fillColor=#ffffff;fontColor=#070665;strokeColor=hsl(0, 100%, 80%)"
   - Geometry: {"x": x, "y": y, "width": 120, "height": 60}
   - Include: _nameId: "option_name"
3. END NODES:
   - Style: "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=end;fillColor=#CCCCCC;fontColor=#000000;spacing=12;fontSize=16;"
   - Geometry: {"x": x, "y": y, "width": 120, "height": 60}
4. EDGES (connections between nodes) - CREATE EDGES FOR ALL CONNECTIONS:
   - Style: ""
   - Geometry: {"x": 0, "y": 0, "width": 0, "height": 0}
   - vertex: false, edge: true
   - source: "source_node_id", target: "target_node_id"
CONNECTION RULES - YOU MUST CREATE THESE EDGES:
- Connect each question to ALL its option nodes
- Connect each option to the next question (if any) or to the end node
- For dropdown questions: connect the question to each option, then connect each option to the next question
- For text questions: connect directly to the next question or end node
QUESTION TYPES:
- dropdown: for multiple choice questions
- checkbox: for multiple selection questions  
- text: for text input questions
- number: for numeric input questions
- money: for currency input questions
POSITIONING RULES - CRITICAL FOR CLEAN LAYOUTS:
1. QUESTIONS:
   - Width: 200px, Height: 80px
   - Start at x=380, y=100
   - Center horizontally in the layout
2. OPTION NODES - SPREAD HORIZONTALLY IN SINGLE ROW:
   - Width: 120px, Height: 60px
   - ALL options on the SAME Y level (same row)
   - Horizontal spacing: 140px between option centers
   - Position options below question with 110px vertical spacing
   - Center the entire row of options under the question
   - For 4 options: positions should be x=220, x=360, x=500, x=640 (all at same y)
   - For 3 options: positions should be x=300, x=440, x=580 (all at same y)
   - For 2 options: positions should be x=380, x=520 (all at same y)
3. NEXT QUESTION:
   - Width: 200px, Height: 80px
   - Position 120px below the option row
   - Center horizontally (x=380)
4. END NODE:
   - Width: 120px, Height: 60px
   - Position 140px below the last question
   - Center horizontally (x=420)
LAYOUT EXAMPLES:
- 4 options: x=220, x=360, x=500, x=640 (all at y=210)
- 3 options: x=300, x=440, x=580 (all at y=210)
- 2 options: x=380, x=520 (all at y=210)
SECTIONS:
- Each section gets a unique number (1, 2, 3, etc.)
- Include sectionPrefs with borderColor and name for each section
- Use different strokeColor for each section: hsl(0, 100%, 80%), hsl(120, 100%, 80%), hsl(240, 100%, 80%), etc.
EXAMPLE LAYOUT FOR 4-OPTION DROPDOWN:
1. Question 1 at x=380, y=100
2. Option 1 at x=220, y=210
3. Option 2 at x=360, y=210  
4. Option 3 at x=500, y=210
5. Option 4 at x=640, y=210
6. Question 2 at x=380, y=330
7. End node at x=420, y=470
EDGES TO CREATE:
1. Edge: question 1 → option 1
2. Edge: question 1 → option 2
3. Edge: question 1 → option 3
4. Edge: question 1 → option 4
5. Edge: option 1 → question 2
6. Edge: option 2 → question 2
7. Edge: option 3 → question 2
8. Edge: option 4 → question 2
9. Edge: question 2 → end
NOTE: All 4 options are on the SAME Y level (y=210) with proper horizontal spacing!
Also set each edge style to edgeStyle=none; rounded=0; orthogonalLoop=0;
CRITICAL: Generate the COMPLETE JSON structure. Do not truncate or cut off the response. Include ALL questions, options, connections, and styling. The JSON must be complete and valid.`;
    const userPrompt = `Create a flowchart based on this description: ${description}`;
    // Call ChatGPT API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: aiConfig.maxTokens,
        temperature: 0.3
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
    }
    const data = await response.json();
    const generatedContent = data.choices[0].message.content;
    // Extract JSON from the response (it might be wrapped in markdown code blocks)
    let jsonString = generatedContent;
    if (jsonString.includes('```json')) {
      jsonString = jsonString.split('```json')[1].split('```')[0].trim();
    } else if (jsonString.includes('```')) {
      jsonString = jsonString.split('```')[1].split('```')[0].trim();
    }
    // Parse and validate the JSON
    let flowchartData;
    try {
      flowchartData = JSON.parse(jsonString);
    } catch (parseError) {
      // Store the raw response for debugging
      window.lastFailedChatResponse = generatedContent;
      window.lastFailedJsonString = jsonString;
      // Create a downloadable file with the raw response
      const blob = new Blob([generatedContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chatgpt-raw-response.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      throw new Error('Failed to parse generated JSON: ' + parseError.message + '. Raw response downloaded for debugging.');
    }
    // Validate the structure
    if (!flowchartData.cells || !Array.isArray(flowchartData.cells)) {
      throw new Error('Invalid flowchart structure: missing cells array');
    }
    // Apply user's edge style preference to all edges in the generated data
    const userEdgeStyle = window.currentEdgeStyle || 'direct'; // Default to direct if not logged in
    flowchartData.cells.forEach(cell => {
      if (cell.edge && cell.vertex === false) {
        // Apply the user's edge style preference
        let edgeStyle;
        if (userEdgeStyle === 'curved') {
          edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
        } else if (userEdgeStyle === 'straight') {
          edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;";
        } else if (userEdgeStyle === 'direct') {
          edgeStyle = "edgeStyle=none;rounded=0;orthogonalLoop=0;jettySize=auto;html=1;";
        } else {
          edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
        }
        cell.style = edgeStyle;
      }
    });
    // Clear current flowchart and load the new one
    if (window.graph) {
      window.graph.getModel().beginUpdate();
      try {
        // Clear all cells
        const cells = window.graph.getChildCells(window.graph.getDefaultParent(), true, true);
        window.graph.removeCells(cells);
        // Set default edge style to match user preference
        const defaultEdgeStyle = window.graph.getStylesheet().getDefaultEdgeStyle();
        if (userEdgeStyle === 'curved') {
          defaultEdgeStyle.edgeStyle = 'orthogonalEdgeStyle';
          defaultEdgeStyle.rounded = '1';
          defaultEdgeStyle.orthogonalLoop = '1';
        } else if (userEdgeStyle === 'straight') {
          defaultEdgeStyle.edgeStyle = 'orthogonalEdgeStyle';
          defaultEdgeStyle.rounded = '0';
          defaultEdgeStyle.orthogonalLoop = '1';
        } else if (userEdgeStyle === 'direct') {
          defaultEdgeStyle.edgeStyle = 'none';
          defaultEdgeStyle.rounded = '0';
          defaultEdgeStyle.orthogonalLoop = '0';
        }
        // Load the new flowchart data
        if (typeof loadFlowchartData === 'function') {
          loadFlowchartData(flowchartData);
        } else {
          throw new Error('loadFlowchartData function not available');
        }
      } finally {
        window.graph.getModel().endUpdate();
      }
    }
    // Store the generated JSON for download
    window.lastGeneratedFlowchartJSON = JSON.stringify(flowchartData, null, 2);
    // Show the download button
    document.getElementById('downloadGeneratedJsonBtn').style.display = 'inline-block';
    // Force update all edge styles after loading to ensure they match user preference
    setTimeout(() => {
      if (typeof updateEdgeStyle === 'function') {
        updateEdgeStyle();
      } else {
        // Fallback: manually update all edges
        const allCells = window.graph.getChildCells(window.graph.getDefaultParent(), true, true);
        allCells.forEach(cell => {
          if (cell.edge && !cell.vertex) {
            let edgeStyle;
            if (userEdgeStyle === 'curved') {
              edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
            } else if (userEdgeStyle === 'straight') {
              edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;";
            } else if (userEdgeStyle === 'direct') {
              edgeStyle = "edgeStyle=none;rounded=0;orthogonalLoop=0;jettySize=auto;html=1;";
            } else {
              edgeStyle = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;";
            }
            window.graph.getModel().setStyle(cell, edgeStyle);
          }
        });
      }
      window.graph.refresh();
    }, 100);
    return flowchartData;
  } catch (error) {
    throw error;
  }
}
// Show flowchart details modal
function showFlowchartDetailsModal() {
  document.getElementById('flowchartDetailsModal').style.display = 'block';
}
// Hide flowchart details modal
function hideFlowchartDetailsModal() {
  document.getElementById('flowchartDetailsModal').style.display = 'none';
}
// Download generated JSON
function downloadGeneratedJSON() {
  if (window.lastGeneratedFlowchartJSON) {
    const blob = new Blob([window.lastGeneratedFlowchartJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-flowchart.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
// Show document PDF modal
function showDocumentPdfModal() {
  document.getElementById('documentPdfModal').style.display = 'block';
}
// Hide document PDF modal
function hideDocumentPdfModal() {
  document.getElementById('documentPdfModal').style.display = 'none';
}
// Process PDF file
async function processPdfFile() {
  const fileInput = document.getElementById('pdfFileInput');
  if (!fileInput.files[0]) {
    fileInput.click(); // Trigger file input if no file selected
    return;
  }
  const file = fileInput.files[0];
  const statusDiv = document.getElementById('pdfProcessingStatus');
  const previewDiv = document.getElementById('pdfPreview');
  const imagesContainer = document.getElementById('pdfImagesContainer');
  try {
    // Show processing status
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<p>Processing PDF...</p>';
    // Load PDF.js
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library not loaded');
    }
    // Set PDF.js worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const imageDataUrls = [];
    const imagesContainer = document.getElementById('pdfImagesContainer');
    imagesContainer.innerHTML = ''; // Clear previous images
    // Convert each page to image
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      const imageDataUrl = canvas.toDataURL('image/png');
      imageDataUrls.push(imageDataUrl);
      // Add to preview
      const img = document.createElement('img');
      img.src = imageDataUrl;
      img.style.maxWidth = '100%';
      img.style.marginBottom = '10px';
      img.style.border = '1px solid #ccc';
      imagesContainer.appendChild(img);
    }
    // Show preview
    previewDiv.style.display = 'block';
    // Combine all images into one
    const combinedImageDataUrl = await combineImages(imageDataUrls);
    // Analyze with ChatGPT
    statusDiv.innerHTML = '<p>Analyzing document with AI...</p>';
    const analysis = await analyzePdfWithChatGPT(combinedImageDataUrl);
     // Store the analysis
     window.lastPdfAnalysis = analysis;
     // Convert analysis to structured JSON using ChatGPT
     statusDiv.innerHTML = '<p>Converting analysis to structured JSON...</p>';
     const structuredData = await convertAnalysisToJSON(analysis);
     window.lastPdfAnalysisJSON = structuredData;
     // Show success and download buttons
     statusDiv.innerHTML = '<p style="color: green;">Analysis complete! Click "Download Analysis" to get the text output, or "Download JSON" for structured data.</p>';
     document.getElementById('downloadPdfAnalysisBtn').style.display = 'inline-block';
     document.getElementById('downloadPdfAnalysisJsonBtn').style.display = 'inline-block';
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
  }
}
// Combine multiple images into one
async function combineImages(imageDataUrls) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // Load all images
    const images = [];
    let loadedCount = 0;
    let totalHeight = 0;
    let maxWidth = 0;
    imageDataUrls.forEach((dataUrl, index) => {
      const img = new Image();
      img.onload = () => {
        images[index] = img;
        totalHeight += img.height;
        maxWidth = Math.max(maxWidth, img.width);
        loadedCount++;
        if (loadedCount === imageDataUrls.length) {
          // All images loaded, combine them
          canvas.width = maxWidth;
          canvas.height = totalHeight;
          let currentY = 0;
          images.forEach(img => {
            ctx.drawImage(img, 0, currentY);
            currentY += img.height;
          });
          resolve(canvas.toDataURL('image/png'));
        }
      };
      img.src = dataUrl;
    });
  });
}
// Analyze PDF with ChatGPT (vision model)
async function analyzePdfWithChatGPT(imageDataUrl) {
  const aiConfig = loadAIConfig();
  const systemPrompt = `You are an expert at analyzing forms and documents to extract their structure. 
Your task is to analyze the provided document image and break it down into a structured format that can be used to create a flowchart.
For each section you identify, provide:
1. Section name
2. Questions within that section (written as natural language questions)
3. Question types (dropdown, checkbox, textbox, big paragraph, date, date range, mult dropdown, mult textbox, number, email, phone, etc.)
4. Options for each question (if applicable)
IMPORTANT: Write questions as natural language questions that a person would ask, not as field labels. For example:
- Instead of "Name" write "What is your full name?"
- Instead of "Street or mailing address" write "What is your street or mailing address?"
- Instead of "Phone" write "What is your phone number?"
QUESTION TYPE CLARIFICATIONS:
**mult textbox**: Use ONLY for questions that require multiple related textboxes that together form ONE complete answer and you know the exact number of fields needed.
- Example: "What is your address?" with individual textboxes for: Street, City, State, Zip
- Example: "What is your name?" with individual textboxes for: First Name, Last Name
- Format: Include the main question title, then list each individual textbox needed
**mult dropdown**: Use for questions where you don't know "how many" of something the user has, or when asking about multiple instances of the same type of information.
- Look for patterns like: "List...", "What are your...", "What... do you have/own/get", "Who else...", "What other..."
- When you see multiple textboxes that represent multiple instances of the same type of information
- ALWAYS phrase as "How many..." questions - this is MANDATORY
- Convert "List any..." to "How many... do you have"
- Convert "What are your..." to "How many... do you have"
- Example: "How many sources of income do you have?" with range "1-4" and individual textboxes for: Income Source, Amount
- Example: "How many cars, boats, and other vehicles do you own?" with range "1-3" and individual textboxes for: Make/Year, Fair Market Value, How Much You Still Owe
- Example: "How many other people in your household have income?" with range "1-5" and individual textboxes for: Name, Age, Relationship, Income
- Example: "How many other monthly expenses do you have?" with range "1-3" and individual textboxes for: Paid to, How Much
- Format: Include the "How many..." question title, specify the range (e.g., "1-4", "1-3", "2-5"), then list the individual textboxes for each item
**Other types**:
- dropdown: Single choice from predefined options
- checkbox: Multiple selections from predefined options (specify if amount type)
- checkbox (amount): Multiple selections where each option has an amount field
- textbox: Single text input
- big paragraph: Large text area for longer responses
- date: Date picker
- date range: Start and end date pickers
- number: Numeric input
- email: Email address input
- phone: Phone number input
SPECIFIC EXAMPLES FROM TYPICAL FORMS:
**mult dropdown examples** (these should be mult dropdown, not mult textbox):
- "How many sources of income do you have each month?" → mult dropdown (range 1-4, textboxes: Income Source, Amount)
- "How many cars, boats, and other vehicles do you own?" → mult dropdown (range 1-3, textboxes: Make/Year, Fair Market Value, How Much You Still Owe)
- "How many real estate properties do you own?" → mult dropdown (range 1-2, textboxes: Address, Fair Market Value, How Much You Still Owe)
- "How many financial accounts do you have?" → mult dropdown (range 1-3, textboxes: Bank Name, Amount)
- "How many other people in your household have income?" → mult dropdown (range 1-5, textboxes: Name, Age, Relationship, Income)
- "How many monthly expenses do you have?" → mult dropdown (range 1-4, textboxes: Description, Amount)
- "How many other monthly expenses do you have?" → mult dropdown (range 1-3, textboxes: Paid to, How Much)
**MANDATORY CONVERSIONS for mult dropdown**:
- "List any other monthly expenses" → "How many other monthly expenses do you have?"
- "What are your financial accounts?" → "How many financial accounts do you have?"
- "List any cars you own" → "How many cars do you own?"
**mult textbox examples** (these should be mult textbox, not mult dropdown):
- "What is your address?" → mult textbox (Street, City, State, Zip)
- "What is your full name?" → mult textbox (First Name, Last Name)
**checkbox (amount) examples** (combine multiple number questions into one checkbox with amounts):
- Multiple expense questions like "What is your rent?", "What are your food expenses?", etc. → "Do you have any of the following expenses? (checkbox with amounts)" with options: Rent or house payment (amount), Food and household supplies (amount), Utilities and telephone (amount), etc.
- Multiple income questions → "Do you receive any of the following types of income? (checkbox with amounts)" with options: Salary (amount), Freelance work (amount), Investments (amount), etc.
**When to use checkbox (amount) vs individual number questions**:
- Use checkbox (amount) when you have 3+ related number questions that are all asking about amounts for different categories
- Use individual number questions when there are only 1-2 number questions or they are unrelated
Format your response as structured text that clearly identifies:
- Section names
- Question text (as natural language questions)
- Question types (with proper mult textbox/mult dropdown formatting)
- Available options for each question
- For mult dropdown: include the range and individual textbox labels
Be thorough and identify all form elements, fields, and interactive components in the document.`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o', // Use the vision-capable model
      messages: [
        { 
          role: 'system', 
          content: systemPrompt 
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this document and break it down into sections, questions, question types, and options as described.'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      max_tokens: 8000,
      temperature: 0.3
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}
// Convert analysis text to structured JSON using ChatGPT
async function convertAnalysisToJSON(analysisText) {
  const aiConfig = loadAIConfig();
  const systemPrompt = `You are a data conversion expert. Your task is to convert the provided form analysis text into a structured JSON format.
Convert the analysis text into this EXACT JSON structure:
{
  "documentType": "form",
  "analysisDate": "ISO_DATE_STRING",
  "sections": [
    {
      "id": 1,
      "name": "Section Name",
      "questions": [
        {
          "id": 1,
          "text": "Question text as natural language",
          "type": "question_type",
          "options": ["option1", "option2", "option3"],
          "textboxes": ["textbox1", "textbox2"],
          "range": "1-4"
        }
      ]
    }
  ],
  "summary": {
    "totalSections": 0,
    "totalQuestions": 0,
    "questionTypes": ["type1", "type2", "type3"]
  }
}
RULES:
1. Extract section names from "Section X: Name" format
2. Extract question text from numbered list items
3. Extract question types from "- Question Type: type" lines
4. For checkbox questions: extract options from the list under "- Options:"
5. For mult textbox/mult dropdown: extract textboxes from "- Textboxes: a, b, c" format
6. For mult dropdown: extract range from "- Range: X-Y" format
7. Count total sections and questions for summary
8. List all unique question types for summary
9. Use current ISO date for analysisDate
10. Return ONLY the JSON, no other text or markdown formatting
QUESTION TYPES TO RECOGNIZE:
- mult textbox: multiple related textboxes for one answer
- mult dropdown: variable number of items with range and textboxes
- checkbox: multiple selection options
- checkbox (amount): multiple selection with amount fields
- textbox: single text input
- phone: phone number input
- number: numeric input
- date: date picker
- date range: start and end date pickers
- big paragraph: large text area
Convert the provided analysis text now.`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        { 
          role: 'system', 
          content: systemPrompt 
        },
        {
          role: 'user',
          content: `Convert this analysis text to JSON:\n\n${analysisText}`
        }
      ],
      max_tokens: 4000,
      temperature: 0.1
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JSON conversion failed: ${response.status} ${response.statusText}. Details: ${errorText}`);
  }
  const data = await response.json();
  const jsonString = data.choices[0].message.content;
  // Clean up the response (remove any markdown formatting)
  let cleanJson = jsonString.trim();
  if (cleanJson.includes('```json')) {
    cleanJson = cleanJson.split('```json')[1].split('```')[0].trim();
  } else if (cleanJson.includes('```')) {
    cleanJson = cleanJson.split('```')[1].split('```')[0].trim();
  }
  try {
    return JSON.parse(cleanJson);
  } catch (parseError) {
    throw new Error('Failed to parse converted JSON: ' + parseError.message);
  }
}
// Parse analysis text into structured JSON (legacy function - keeping for fallback)
function parseAnalysisToJSON(analysisText) {
  const sections = [];
  const lines = analysisText.split('\n');
  let currentSection = null;
  let currentQuestion = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Check for section header
    if (line.startsWith('### Section')) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        id: sections.length + 1,
        name: line.replace('### Section', '').replace(/^\d+:\s*/, '').trim(),
        questions: []
      };
      currentQuestion = null;
    }
    // Check for question number
    else if (line.match(/^\d+\.\s*\*\*.*\*\*$/)) {
      if (currentSection) {
        const questionText = line.replace(/^\d+\.\s*\*\*/, '').replace(/\*\*$/, '').trim();
        currentQuestion = {
          id: currentSection.questions.length + 1,
          text: questionText,
          type: null,
          options: [],
          textboxes: [],
          range: null
        };
        currentSection.questions.push(currentQuestion);
      }
    }
    // Check for type
    else if (line.startsWith('- Type:')) {
      if (currentQuestion) {
        currentQuestion.type = line.replace('- Type:', '').trim();
      }
    }
    // Check for options
    else if (line.startsWith('- Options:')) {
      // Options will be on subsequent lines
      continue;
    }
    // Check for individual option
    else if (line.startsWith('- ') && currentQuestion && currentQuestion.type === 'checkbox') {
      const option = line.replace('- ', '').trim();
      if (option && !option.startsWith('Type:') && !option.startsWith('Range:') && !option.startsWith('Textboxes:')) {
        currentQuestion.options.push(option);
      }
    }
    // Check for range (for mult dropdown)
    else if (line.startsWith('- Range:')) {
      if (currentQuestion) {
        currentQuestion.range = line.replace('- Range:', '').trim();
      }
    }
    // Check for textboxes
    else if (line.startsWith('- Textboxes:')) {
      if (currentQuestion) {
        const textboxesText = line.replace('- Textboxes:', '').trim();
        currentQuestion.textboxes = textboxesText.split(',').map(tb => tb.trim());
      }
    }
  }
  // Add the last section
  if (currentSection) {
    sections.push(currentSection);
  }
  return {
    documentType: 'form',
    analysisDate: new Date().toISOString(),
    sections: sections,
    summary: {
      totalSections: sections.length,
      totalQuestions: sections.reduce((sum, section) => sum + section.questions.length, 0),
      questionTypes: [...new Set(sections.flatMap(section => section.questions.map(q => q.type)))]
    }
  };
}
// Download PDF analysis (text)
function downloadPdfAnalysis() {
  if (window.lastPdfAnalysis) {
    const blob = new Blob([window.lastPdfAnalysis], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pdf-analysis.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
// Download PDF analysis (JSON)
function downloadPdfAnalysisJSON() {
  if (window.lastPdfAnalysisJSON) {
    const blob = new Blob([JSON.stringify(window.lastPdfAnalysisJSON, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pdf-analysis.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
// Initialize AI features event listeners
function initializeAIFeatures() {
  // Flowchart Details Modal event listeners
  const uploadFlowchartBtn = document.getElementById('uploadFlowchartDetailsBtn');
  if (uploadFlowchartBtn) {
    uploadFlowchartBtn.addEventListener('click', showFlowchartDetailsModal);
  }
  const closeFlowchartModal = document.getElementById('closeFlowchartDetailsModal');
  if (closeFlowchartModal) {
    closeFlowchartModal.addEventListener('click', hideFlowchartDetailsModal);
  }
  const generateBtn = document.getElementById('generateFlowchartBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', async () => {
    const descriptionInput = document.getElementById('flowchartDetailsInput');
    if (!descriptionInput) {
      return;
    }
    const description = descriptionInput.value;
    if (!description.trim()) {
      alert('Please enter a flowchart description');
      return;
    }
     try {
       // Show loading state
       const generateBtn = document.getElementById('generateFlowchartBtn');
       const originalText = generateBtn.textContent;
       generateBtn.textContent = 'Generating...';
       generateBtn.disabled = true;
       // Add loading indicator to modal
       const modal = document.getElementById('flowchartDetailsModal');
       const loadingDiv = document.createElement('div');
       loadingDiv.id = 'flowchartLoadingIndicator';
       loadingDiv.innerHTML = '<div style="text-align: center; padding: 20px; background: #f0f0f0; margin: 10px 0; border-radius: 5px;"><div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div><br><span>Generating flowchart...</span></div>';
       loadingDiv.style.cssText = 'position: relative; z-index: 1000;';
       modal.querySelector('.modal-body').appendChild(loadingDiv);
       // Add CSS animation for spinner
       if (!document.getElementById('spinnerCSS')) {
         const style = document.createElement('style');
         style.id = 'spinnerCSS';
         style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
         document.head.appendChild(style);
       }
       await generateFlowchartFromDescription(description);
       // Show success message
       const successDiv = document.createElement('div');
       successDiv.textContent = 'Flowchart generated successfully!';
       successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; z-index: 10000; font-family: Arial, sans-serif;';
       document.body.appendChild(successDiv);
       setTimeout(() => {
         document.body.removeChild(successDiv);
       }, 3000);
     } catch (error) {
       alert('Error generating flowchart: ' + error.message);
     } finally {
       // Reset button state
       const generateBtn = document.getElementById('generateFlowchartBtn');
       generateBtn.textContent = 'Generate Flowchart';
       generateBtn.disabled = false;
       // Remove loading indicator
       const loadingIndicator = document.getElementById('flowchartLoadingIndicator');
       if (loadingIndicator) {
         loadingIndicator.remove();
       }
     }
    });
  }
  // Download generated JSON when clicking Download button
  const downloadJsonBtn = document.getElementById('downloadGeneratedJsonBtn');
  if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener('click', downloadGeneratedJSON);
  }
  // PDF Modal event listeners
  const uploadPdfBtn = document.getElementById('uploadDocumentPdfBtn');
  if (uploadPdfBtn) {
    uploadPdfBtn.addEventListener('click', showDocumentPdfModal);
  }
  const closePdfModal = document.getElementById('closeDocumentPdfModal');
  if (closePdfModal) {
    closePdfModal.addEventListener('click', hideDocumentPdfModal);
  }
  const processPdfBtn = document.getElementById('processPdfBtn');
  if (processPdfBtn) {
    processPdfBtn.addEventListener('click', processPdfFile);
  }
   const downloadPdfBtn = document.getElementById('downloadPdfAnalysisBtn');
   if (downloadPdfBtn) {
     downloadPdfBtn.addEventListener('click', downloadPdfAnalysis);
   }
   const downloadPdfJsonBtn = document.getElementById('downloadPdfAnalysisJsonBtn');
   if (downloadPdfJsonBtn) {
     downloadPdfJsonBtn.addEventListener('click', downloadPdfAnalysisJSON);
   }
  const cancelPdfBtn = document.getElementById('cancelDocumentPdfBtn');
  if (cancelPdfBtn) {
    cancelPdfBtn.addEventListener('click', hideDocumentPdfModal);
  }
  // File input change event
  const pdfFileInput = document.getElementById('pdfFileInput');
  if (pdfFileInput) {
    pdfFileInput.addEventListener('change', processPdfFile);
  }
}
// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAIFeatures);
} else {
  initializeAIFeatures();
}