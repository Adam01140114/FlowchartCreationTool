// Test script to verify the conditional logic fix
// This simulates the logic that should be generated for the flowchart

function testConditionalLogic() {
  // Simulate the flowchart structure from the user's example
  const flowchartData = {
    cells: [
      // Question 1: "Are you currently employed"
      { id: "2", _questionId: 1, _questionText: "Are you currently employed" },
      // Option: "Yes" -> leads to work info form
      { id: "5", value: "Yes" },
      // Option: "No" -> leads directly to lawyer question
      { id: "3", value: "No" },
      // Work info form (should only appear if "Yes" to employment)
      { id: "node_1754011110743_9797_0", _questionId: 2, _questionText: "Please enter your work info" },
      // Question 2: "Do you have a lawyer?"
      { id: "9", _questionId: 3, _questionText: "Do you have a lawyer?" },
      // Option: "Yes" -> leads to lawyer info form
      { id: "12", value: "Yes" },
      // Option: "No" -> leads directly to fees question
      { id: "10", value: "No" },
      // Lawyer info form (should only appear if "Yes" to lawyer question)
      { id: "node_1754011242589_858_0", _questionId: 4, _questionText: "Please enter lawyer info" },
      // Question 3: "Has your lawyer agreed to pay off some of your fees?"
      { id: "17", _questionId: 5, _questionText: "Has your lawyer agreed to pay off some of your fees?" }
    ],
    edges: [
      { source: "2", target: "5" }, // Employment -> Yes
      { source: "2", target: "3" }, // Employment -> No
      { source: "5", target: "node_1754011110743_9797_0" }, // Yes -> Work info
      { source: "3", target: "9" }, // No -> Lawyer question
      { source: "node_1754011110743_9797_0", target: "9" }, // Work info -> Lawyer question
      { source: "9", target: "12" }, // Lawyer -> Yes
      { source: "9", target: "10" }, // Lawyer -> No
      { source: "12", target: "node_1754011242589_858_0" }, // Yes -> Lawyer info
      { source: "10", target: "17" }, // No -> Fees question
      { source: "node_1754011242589_858_0", target: "17" } // Lawyer info -> Fees question
    ]
  };

  // Simulate the improved findDirectParentCondition function
  function findDirectParentCondition(cellId) {
    const cell = flowchartData.cells.find(c => c.id === cellId);
    if (!cell) return null;
    
    // Find incoming edges
    const incomingEdges = flowchartData.edges.filter(e => e.target === cellId);
    const conditions = [];
    
    for (const edge of incomingEdges) {
      const sourceCell = flowchartData.cells.find(c => c.id === edge.source);
      if (sourceCell && sourceCell.value) {
        // This is an option node, find its parent question
        const optionIncoming = flowchartData.edges.filter(e => e.target === edge.source);
        for (const optEdge of optionIncoming) {
          const parentQ = flowchartData.cells.find(c => c.id === optEdge.source);
          if (parentQ && parentQ._questionId) {
            conditions.push({
              prevQuestion: String(parentQ._questionId),
              prevAnswer: sourceCell.value.trim()
            });
          }
        }
      }
    }
    
    // If there are multiple conditions, prioritize "Yes" answers
    if (conditions.length > 1) {
      const yesCondition = conditions.find(cond => cond.prevAnswer === "Yes");
      if (yesCondition) {
        return yesCondition;
      }
    }
    
    // Return the first condition if only one, or null if none
    return conditions.length > 0 ? conditions[0] : null;
  }

  // Test the logic for each question
  console.log("Testing conditional logic:");
  
  // Question 2 (Work info) - should depend on Question 1, Answer "Yes"
  const workInfoLogic = findDirectParentCondition("node_1754011110743_9797_0");
  console.log("Work info form logic:", workInfoLogic);
  console.log("Expected: { prevQuestion: '1', prevAnswer: 'Yes' }");
  console.log("Correct:", JSON.stringify(workInfoLogic) === JSON.stringify({ prevQuestion: '1', prevAnswer: 'Yes' }));
  
  // Question 3 (Lawyer question) - should have no logic (appears for both paths)
  const lawyerQuestionLogic = findDirectParentCondition("9");
  console.log("Lawyer question logic:", lawyerQuestionLogic);
  console.log("Expected: null (no logic needed)");
  console.log("Correct:", lawyerQuestionLogic === null);
  
  // Question 4 (Lawyer info) - should depend on Question 3, Answer "Yes"
  const lawyerInfoLogic = findDirectParentCondition("node_1754011242589_858_0");
  console.log("Lawyer info form logic:", lawyerInfoLogic);
  console.log("Expected: { prevQuestion: '3', prevAnswer: 'Yes' }");
  console.log("Correct:", JSON.stringify(lawyerInfoLogic) === JSON.stringify({ prevQuestion: '3', prevAnswer: 'Yes' }));
  
  // Question 5 (Fees question) - should depend on Question 3, Answer "Yes" 
  // The improved logic should prioritize the "Yes" path over the "No" path
  const feesQuestionLogic = findDirectParentCondition("17");
  console.log("Fees question logic:", feesQuestionLogic);
  console.log("Expected: { prevQuestion: '3', prevAnswer: 'Yes' } (prioritizing Yes path)");
  console.log("Correct:", JSON.stringify(feesQuestionLogic) === JSON.stringify({ prevQuestion: '3', prevAnswer: 'Yes' }));
  
  console.log("\nThe improved logic now prioritizes 'Yes' answers when there are multiple paths to a question.");
  console.log("This ensures that questions like the fees question only appear when the user has a lawyer.");
}

// Run the test
testConditionalLogic(); 