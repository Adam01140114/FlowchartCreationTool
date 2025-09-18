# Section Cleanup Functionality Test

## Overview
When all nodes in a section are deleted, the section is automatically removed from the legend and all remaining sections are reassigned new numbers.

## How it works

1. **Detection**: The system monitors all node deletion events through:
   - Context menu "Delete Node" button
   - Keyboard Delete/Backspace keys
   - Model change events (mxRemoveChange)
   - Calculation node removal in calc.js

2. **Cleanup Process**: When nodes are deleted, `checkAndCleanupEmptySections()` is called which:
   - Scans all remaining nodes to find which sections still have nodes
   - Identifies sections that exist in `sectionPrefs` but have no nodes
   - Removes empty sections from `sectionPrefs`
   - Reassigns section numbers starting from 1 for remaining sections
   - Updates all node styles to use the new section numbers
   - Refreshes the legend and graph display

## Example Scenario

**Initial State:**
- Section 1 (Name): Contains "What's your name?" question
- Section 2 (Hunger): Contains "Are you hungry?" question

**After deleting "What's your name?" question:**
- Section 1 is empty and gets deleted
- Section 2 (Hunger) becomes Section 1
- All nodes in the former Section 2 are updated to use section=1
- The legend is updated to show only Section 1

## Test Steps

1. Create a flowchart with multiple sections
2. Add questions to different sections
3. Delete all nodes in one section
4. Verify the section is removed from the legend
5. Verify remaining sections are renumbered starting from 1
6. Verify all nodes in remaining sections have updated section numbers

## Files Modified

- `legend.js`: Added `checkAndCleanupEmptySections()` function
- `script.js`: Added cleanup calls to delete node handlers
- `calc.js`: Added cleanup call when calculation nodes are removed

## Safety Features

- Function existence checks to prevent errors if legend.js isn't loaded
- setTimeout to ensure deletion is complete before cleanup
- Model update transactions to prevent UI glitches 