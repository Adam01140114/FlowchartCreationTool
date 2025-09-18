// Test script to verify the checkbox nameId fix

function getNodeId(cell) {
  // Simulate the getNodeId function
  const style = cell.style || "";
  const m = style.match(/nodeId=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function testCheckboxNameId() {
  // Simulate the checkbox cell with nodeId
  const cell = {
    style: "shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;spacing=12;fontSize=16;align=center;verticalAlign=middle;section=1;questionType=checkbox;align=center;verticalAlign=middle;spacing=12;pointerEvents=1;overflow=fill;nodeId=are_you_okay;fillColor=#b3daff;fontColor=#070665;strokeColor=hsl(0, 100%, 80%)",
    _nameId: "answer1",
    _questionText: "Are you okay",
    value: "<div style=\"text-align:center;\">Are you okay</div>"
  };
  
  // Simulate the question object
  const question = {
    nameId: "answer1", // This would be set from cell._nameId
    options: [
      { text: "Yes" },
      { text: "No" }
    ]
  };
  
  // Apply the fix
  const baseNameId = getNodeId(cell) || question.nameId || "unnamed";
  
  // Convert options to checkbox format
  question.options = question.options.map(opt => {
    if (typeof opt.text === 'string') {
      const optionText = opt.text.trim();
      return {
        label: optionText,
        nameId: `${baseNameId}_${optionText.toLowerCase().replace(/\s+/g, '_')}`,
        value: "",
        hasAmount: false,
        amountName: "",
        amountPlaceholder: ""
      };
    }
    return {
      label: "",
      nameId: "",
      value: "",
      hasAmount: false,
      amountName: "",
      amountPlaceholder: ""
    };
  });
  
  console.log("Testing checkbox nameId fix:");
  console.log("Cell nodeId:", getNodeId(cell));
  console.log("Question nameId:", question.nameId);
  console.log("Base nameId used:", baseNameId);
  console.log("Expected base nameId: are_you_okay");
  console.log("Base nameId correct:", baseNameId === "are_you_okay");
  
  console.log("\nOptions:");
  question.options.forEach((opt, index) => {
    console.log(`Option ${index + 1}:`, opt);
  });
  
  console.log("\nExpected nameIds:");
  console.log("Option 1 nameId: are_you_okay_yes");
  console.log("Option 2 nameId: are_you_okay_no");
  
  console.log("Option 1 correct:", question.options[0].nameId === "are_you_okay_yes");
  console.log("Option 2 correct:", question.options[1].nameId === "are_you_okay_no");
}

// Run the test
testCheckboxNameId(); 