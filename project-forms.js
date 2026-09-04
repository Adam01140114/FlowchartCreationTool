/**
 * Multi-form projects — several flowcharts in one project, switched like sheets
 * in a spreadsheet.
 *
 * The editor only ever holds one flowchart at a time, so switching means
 * capturing the live graph into the current slot and loading the target slot
 * back in. Everything the sidebar shows (form name, sections, groups, default
 * PDF properties) already round-trips through exportFlowchartJson /
 * loadFlowchartData, so a slot is just that JSON plus a display name.
 */
(function () {
  'use strict';

  const PROJECT_VERSION = 1;
  // Loading is asynchronous inside the editor; leave time before reading back.
  const LOAD_SETTLE_MS = 1200;

  /** @type {{name: string, flowchart: object}[]} */
  window.projectForms = window.projectForms || [];
  window.currentFormIndex = window.currentFormIndex || 0;

  function blankFlowchart() {
    return { formName: '', cells: [], sectionPrefs: {}, groups: [] };
  }

  function formNameInput() {
    return document.getElementById('formNameInput');
  }

  function currentFormName(flowchart) {
    const typed = formNameInput() ? formNameInput().value.trim() : '';
    return typed || (flowchart && flowchart.formName) || '';
  }

  /** Read the live graph back into its slot. Safe to call when empty. */
  function captureCurrentForm() {
    if (typeof window.exportFlowchartJson !== 'function') return;
    let flowchart;
    try {
      flowchart = JSON.parse(window.exportFlowchartJson(false));
    } catch (err) {
      console.warn('[project] Could not capture the current form:', err && err.message);
      return;
    }
    const name = currentFormName(flowchart);
    flowchart.formName = name;

    if (!window.projectForms.length) {
      window.projectForms.push({ name, flowchart });
      window.currentFormIndex = 0;
      return;
    }
    const slot = window.projectForms[window.currentFormIndex];
    if (slot) {
      slot.flowchart = flowchart;
      slot.name = name;
    }
  }

  function loadFormAt(index) {
    const slot = window.projectForms[index];
    if (!slot) return;
    window.currentFormIndex = index;
    window.loadFlowchartData(slot.flowchart || blankFlowchart());
    // loadFlowchartData drives the name field from the data, but a blank form
    // has nothing to drive it with.
    setTimeout(function () {
      // Assign unconditionally: a new blank form has no name, and skipping the
      // write would leave the previous form's name sitting in the field.
      if (formNameInput()) formNameInput().value = slot.name || '';
      updateFormNavUi();
    }, LOAD_SETTLE_MS);
    updateFormNavUi();
  }

  function switchToForm(index) {
    if (index < 0 || index >= window.projectForms.length) return;
    if (index === window.currentFormIndex) return;
    captureCurrentForm();
    loadFormAt(index);
  }

  function addForm() {
    captureCurrentForm();
    window.projectForms.push({ name: '', flowchart: blankFlowchart() });
    loadFormAt(window.projectForms.length - 1);
  }

  function prevForm() { switchToForm(window.currentFormIndex - 1); }
  function nextForm() { switchToForm(window.currentFormIndex + 1); }

  function updateFormNavUi() {
    const total = Math.max(1, window.projectForms.length);
    const position = Math.min(window.currentFormIndex + 1, total);

    const label = document.getElementById('formNavLabel');
    if (label) {
      const slot = window.projectForms[window.currentFormIndex];
      const name = slot && slot.name ? ' — ' + slot.name : '';
      label.textContent = 'Form ' + position + ' of ' + total + name;
    }
    const back = document.getElementById('prevFormBtn');
    const next = document.getElementById('nextFormBtn');
    if (back) back.disabled = window.currentFormIndex <= 0;
    if (next) next.disabled = window.currentFormIndex >= window.projectForms.length - 1;
  }

  /* ---------------------------------------------------------------- */
  /* project import / export                                           */
  /* ---------------------------------------------------------------- */

  function exportProjectJson() {
    captureCurrentForm();
    const payload = {
      type: 'flowchart-project',
      version: PROJECT_VERSION,
      exportedAt: new Date().toISOString(),
      currentFormIndex: window.currentFormIndex,
      forms: window.projectForms.map(function (f) {
        return { name: f.name || '', flowchart: f.flowchart || blankFlowchart() };
      })
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return text;
  }

  function applyProjectJson(jsonString) {
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch (err) {
      throw new Error('Invalid JSON: ' + err.message);
    }
    // A single flowchart is a valid project of one - accept it rather than
    // making the operator convert the file by hand.
    if (data && Array.isArray(data.cells) && !data.forms) {
      data = {
        type: 'flowchart-project',
        version: PROJECT_VERSION,
        currentFormIndex: 0,
        forms: [{ name: data.formName || '', flowchart: data }]
      };
    }
    if (!data || !Array.isArray(data.forms) || !data.forms.length) {
      throw new Error('Not a project file: expected a "forms" array.');
    }

    window.projectForms = data.forms.map(function (f, i) {
      const flowchart = f.flowchart || blankFlowchart();
      return { name: f.name || flowchart.formName || ('Form ' + (i + 1)), flowchart: flowchart };
    });
    const start = Number(data.currentFormIndex);
    window.currentFormIndex = (start >= 0 && start < window.projectForms.length) ? start : 0;
    loadFormAt(window.currentFormIndex);
    return window.projectForms.length;
  }

  function importProjectJson(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const count = applyProjectJson(e.target.result);
        console.log('[project] Imported ' + count + ' form(s)');
      } catch (err) {
        window.alert('Could not import project: ' + err.message);
      }
    };
    reader.onerror = function () { window.alert('Could not read that file.'); };
    reader.readAsText(file);
    event.target.value = '';
  }

  /* ---------------------------------------------------------------- */

  document.addEventListener('DOMContentLoaded', function () {
    // Seed the project with whatever the editor opened with, so form 1 is real.
    setTimeout(function () {
      if (!window.projectForms.length) {
        captureCurrentForm();
      }
      updateFormNavUi();
    }, LOAD_SETTLE_MS);
  });

  window.addProjectForm = addForm;
  window.prevProjectForm = prevForm;
  window.nextProjectForm = nextForm;
  window.switchToProjectForm = switchToForm;
  window.captureCurrentProjectForm = captureCurrentForm;
  window.exportProjectJson = exportProjectJson;
  window.applyProjectJson = applyProjectJson;
  window.importProjectJson = importProjectJson;
  window.updateFormNavUi = updateFormNavUi;
})();
