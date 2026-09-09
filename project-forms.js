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

  /**
   * The project's own name for itself, and the reason it needs one.
   *
   * Everything downstream of the editor - the GUI export, the generated form,
   * the filled PDFs, the published page images - belongs to one project, and
   * until now nothing said which. Two projects open in two tabs wrote over the
   * same output folder and the second one to run won.
   *
   * So a project carries an id from the moment it is first exported, and every
   * step after that passes it along rather than inventing its own. It survives
   * import and export because it is read from the file when there is one and
   * only minted when there is not - a project that has been through the loop
   * once keeps the same id for the life of the file, which is what makes the
   * View PDF Output link stable.
   */
  function newProjectId() {
    const stamp = Date.now().toString(36);
    const salt = Math.random().toString(36).slice(2, 8);
    return 'p_' + stamp + salt;
  }

  const PROJECT_ID_KEY = 'flowchart.projectId';

  /**
   * Remember it across reloads.
   *
   * The editor restores its last project on load, and a payload saved before
   * ids existed carries none - so every reload minted a new one, the View PDF
   * Output link changed under the operator, and it pointed at a folder no run
   * had ever written. An id that changes by itself is not an id.
   *
   * The order is: what the file says, then what this browser last used, then a
   * new one. A file with an id always wins, so opening someone else's project
   * does not quietly adopt yours.
   */
  function rememberedProjectId() {
    try { return window.localStorage.getItem(PROJECT_ID_KEY) || ''; }
    catch (e) { return ''; }
  }

  function rememberProjectId(id) {
    if (!id) return id;
    window.projectId = id;
    try { window.localStorage.setItem(PROJECT_ID_KEY, id); } catch (e) { /* private mode */ }
    return id;
  }

  function currentProjectId(create) {
    if (window.projectId) return window.projectId;
    const remembered = rememberedProjectId();
    if (remembered) return rememberProjectId(remembered);
    if (create === false) return '';
    return rememberProjectId(newProjectId());
  }
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
      // The canvas is the authority on cells and sections, and on nothing
      // else. A compiled flowchart also carries what the questions cannot say
      // - the continuation lines, the always-shown declarations, the computed
      // fields - and rebuilding the slot from the canvas quietly threw all of
      // it away the first time the project was walked. Keep whatever the slot
      // had that the canvas does not produce.
      const kept = slot.flowchart || {};
      Object.keys(kept).forEach(function (key) {
        if (!(key in flowchart)) flowchart[key] = kept[key];
      });
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

  function exportProjectJson(download) {
    captureCurrentForm();
    const payload = {
      type: 'flowchart-project',
      version: PROJECT_VERSION,
      projectId: currentProjectId(true),
      exportedAt: new Date().toISOString(),
      currentFormIndex: window.currentFormIndex,
      forms: window.projectForms.map(function (f) {
        return { name: f.name || '', flowchart: f.flowchart || blankFlowchart() };
      })
    };
    const text = JSON.stringify(payload, null, 2);
    // The export dialog wants the text without a file landing in Downloads, so
    // this only saves when it is asked to.
    if (download !== false) {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return text;
  }

  /* The project's own entry points into the shared export/import dialogs. */

  function showExportProjectJsonDialog() {
    window.showExportDialog({
      title: 'Export JSON',
      description: 'The whole project - every form and its flowchart. '
        + 'Copy it, or download it as a file.',
      filename: 'project.json',
      text: function () { return exportProjectJson(false); }
    });
  }

  function showImportProjectJsonDialog() {
    window.showImportDialog({
      title: 'Import JSON',
      description: 'Paste project JSON, or choose a .json file. A single '
        + 'flowchart is accepted too, and becomes a project of one form.',
      placeholder: '{"type": "flowchart-project", "forms": [...]}',
      apply: function (text) {
        const count = applyProjectJson(text);
        console.log('[project] Imported ' + count + ' form(s)');
      }
    });
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

    // The file first, then whatever this browser was last working on.
    rememberProjectId(String(data.projectId || '').trim() || currentProjectId(true));
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
  /* persistence — autosave and the Firebase library                   */
  /* ---------------------------------------------------------------- */

  function projectNameInput() {
    return document.getElementById('projectNameInput');
  }

  /**
   * Add the whole project to a payload that otherwise describes only the
   * open form. Both autosave and the library save one flowchart; without
   * this the other forms are silently dropped.
   */
  function attachProjectToPayload(data) {
    if (!data) return data;
    captureCurrentForm();
    data.projectForms = window.projectForms.map(function (f) {
      return { name: f.name || '', flowchart: f.flowchart || blankFlowchart() };
    });
    data.currentFormIndex = window.currentFormIndex;
    data.projectId = currentProjectId(true);
    data.projectName = projectNameInput() ? projectNameInput().value.trim() : '';
    return data;
  }

  /**
   * Adopt a project out of a saved payload and hand back the form that should
   * actually be shown. Returns null when the payload holds no project, so
   * callers can fall back to their existing single-form path.
   */
  function adoptProjectFromPayload(data) {
    if (!data || !Array.isArray(data.projectForms) || !data.projectForms.length) return null;
    window.projectForms = data.projectForms.map(function (f, i) {
      const flowchart = f.flowchart || blankFlowchart();
      return { name: f.name || flowchart.formName || ('Form ' + (i + 1)), flowchart: flowchart };
    });
    rememberProjectId(String(data.projectId || '').trim() || currentProjectId(true));
    const idx = Number(data.currentFormIndex);
    window.currentFormIndex = (idx >= 0 && idx < window.projectForms.length) ? idx : 0;
    if (projectNameInput() && data.projectName) projectNameInput().value = data.projectName;
    updateFormNavUi();
    return window.projectForms[window.currentFormIndex].flowchart;
  }

  /**
   * Restoring a save goes through loadFlowchartData, so intercepting it covers
   * both "pick up where you left off" and opening from the library. A payload
   * carrying a project loads its active form; anything else passes straight
   * through, including the per-slot loads this module itself performs.
   */
  function installLoadHook() {
    if (typeof window.loadFlowchartData !== 'function' || window.loadFlowchartData.__projectAware) return false;
    const original = window.loadFlowchartData;
    const wrapped = function (data, libraryFlowchartName, onComplete) {
      const active = adoptProjectFromPayload(data);
      return original.call(this, active || data, libraryFlowchartName, onComplete);
    };
    wrapped.__projectAware = true;
    window.loadFlowchartData = wrapped;
    return true;
  }

  /** Every library save funnels through here, so one wrapper covers them all. */
  function installSaveHook() {
    if (typeof window.persistFlowchartRecord !== 'function' || window.persistFlowchartRecord.__projectAware) return false;
    const original = window.persistFlowchartRecord;
    const wrapped = function (name, data) {
      try {
        attachProjectToPayload(data);
      } catch (err) {
        console.warn('[project] Could not attach the project to this save:', err && err.message);
      }
      return original.apply(this, [name, data].concat([].slice.call(arguments, 2)));
    };
    wrapped.__projectAware = true;
    window.persistFlowchartRecord = wrapped;
    return true;
  }

  // Both targets are defined by other modules, and loadFlowchartData is
  // reassigned by more than one of them, so a wrapper installed too early can
  // be replaced later. Keep checking and re-wrap whenever the marker is gone,
  // and evaluate the two hooks independently - one failing must not stop the
  // other from being installed.
  (function keepHooksInstalled() {
    installLoadHook();
    installSaveHook();
    setTimeout(keepHooksInstalled, 1000);
  })();

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

  /**
   * Start over: one empty form, no sections, no groups, no project name.
   *
   * Reloading the page did this, which also loses the autosave and takes the
   * editor back through a full restore. This clears in place, and because it
   * captures nothing on the way out, the autosave that follows records the
   * empty project rather than restoring what was just cleared.
   */
  function clearProject() {
    const forms = window.projectForms || [];
    const hasWork = forms.length > 1
      || (forms[0] && ((forms[0].flowchart || {}).cells || []).length > 0);
    if (hasWork && !window.confirm(
      'Clear the whole project and start over? This cannot be undone.')) return;

    window.projectForms = [{ name: '', flowchart: blankFlowchart() }];
    window.currentFormIndex = 0;
    window.loadFlowchartData(blankFlowchart());
    setTimeout(function () {
      if (formNameInput()) formNameInput().value = '';
      if (projectNameInput()) projectNameInput().value = '';
      updateFormNavUi();
    }, LOAD_SETTLE_MS);
    updateFormNavUi();
  }

  window.clearProject = clearProject;
  window.addProjectForm = addForm;
  window.prevProjectForm = prevForm;
  window.nextProjectForm = nextForm;
  window.switchToProjectForm = switchToForm;
  window.captureCurrentProjectForm = captureCurrentForm;
  window.currentProjectId = currentProjectId;

  /**
   * Open the page images for THIS project.
   *
   * The link carries the project's id, so importing a different project and
   * pressing the button again lands on that project's output rather than on
   * whatever ran last.
   */
  window.viewPdfOutput = function () {
    const id = currentProjectId(true);
    window.open('form-output-dashboard.html' + (id ? '?project=' + encodeURIComponent(id) : ''),
      '_blank');
  };
  window.exportProjectJson = exportProjectJson;
  window.showExportProjectJsonDialog = showExportProjectJsonDialog;
  window.showImportProjectJsonDialog = showImportProjectJsonDialog;
  window.applyProjectJson = applyProjectJson;
  window.importProjectJson = importProjectJson;
  window.updateFormNavUi = updateFormNavUi;
  window.attachProjectToPayload = attachProjectToPayload;
  window.adoptProjectFromPayload = adoptProjectFromPayload;
})();
