/**
 * Saving a project republishes its live site.
 *
 * The live site was built by hand - export the GUI JSON, open the form builder,
 * run the skill - so the link handed out showed whatever was last built, not
 * what was last saved, and nothing on the page said which. Now Save does it:
 * the project is merged into one interview, the form builder generates its
 * pages unseen in a hidden frame, and the dev server writes them to the folder
 * that belongs to this project's id (live-sites/<name>/section.html and
 * question.html). The same project always lands on the same link.
 *
 * Every page's tab is titled with the project's short name and the moment the
 * save was made - "DV Packet 9/11/26 2:00pm" - so an open tab says at a glance
 * whether it is the newest version. Reload it after a save to see the new one.
 */
(function () {
  'use strict';

  const BUILDER_URL = 'FormWiz GUI/gui.html';
  let running = null;
  let queued = false;

  /** "9/11/26 2:00pm", in this computer's own clock. */
  function stampOf(d) {
    const h = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(-2)
      + ' ' + ((h % 12) || 12) + ':' + mm + (h < 12 ? 'am' : 'pm');
  }

  /**
   * The name a tab has room for. A long project name is cut to its first and
   * last words - "DV Restraining Order Packet" is "DV Packet" - because a tab
   * shows a dozen characters before the date would be pushed out of sight.
   */
  function tabNameOf(projectName) {
    const words = String(projectName || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'Project';
    return words.length > 2 ? words[0] + ' ' + words[words.length - 1] : words.join(' ');
  }

  function status(text, link, state) {
    let box = document.getElementById('liveSitePublishStatus');
    if (!box) {
      box = document.createElement('div');
      box.id = 'liveSitePublishStatus';
      box.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:10050;max-width:420px;'
        + 'padding:12px 16px;border-radius:8px;font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;'
        + 'box-shadow:0 6px 24px rgba(15,23,42,.25);color:#fff;';
      document.body.appendChild(box);
    }
    box.style.background = state === 'error' ? '#b3261e' : (state === 'done' ? '#1f6f43' : '#1f3a5f');
    box.textContent = '';
    const line = document.createElement('div');
    line.textContent = text;
    box.appendChild(line);
    if (link) {
      const a = document.createElement('a');
      a.href = link;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = link;
      a.style.cssText = 'color:#fff;text-decoration:underline;word-break:break-all;display:block;margin-top:4px;';
      box.appendChild(a);
    }
    clearTimeout(box._hide);
    if (state === 'done') box._hide = setTimeout(() => box.remove(), 20000);
    if (state === 'error') box._hide = setTimeout(() => box.remove(), 30000);
  }

  /** The form builder, loaded in a frame nobody sees. */
  function openBuilder() {
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      // Off screen rather than display:none: the builder lays its blocks out
      // before it generates from them.
      frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:1280px;height:900px;border:0;visibility:hidden;';
      frame.onload = () => resolve(frame);
      frame.onerror = () => reject(new Error('The form builder did not load'));
      frame.src = BUILDER_URL + '?liveSiteBuild=' + Date.now();
      document.body.appendChild(frame);
    });
  }

  function loadScriptInto(win, src) {
    return new Promise((resolve, reject) => {
      const s = win.document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load ' + src));
      win.document.head.appendChild(s);
    });
  }

  async function publishOnce() {
    const nameBox = document.getElementById('projectNameInput');
    const projectName = (nameBox && nameBox.value.trim()) || 'Project';
    const tabTitle = tabNameOf(projectName) + ' ' + stampOf(new Date());
    status('Updating the live site for "' + projectName + '"…');

    const gui = JSON.parse(await window.exportProjectGuiJson(false));
    const frame = await openBuilder();
    try {
      const win = frame.contentWindow;
      win.__isPreviewImport = true;
      await loadScriptInto(win, '/live-site-builder.js?t=' + Date.now());
      const out = await win.buildLiveSite({
        json: gui,
        title: projectName,
        folder: projectName,
        projectId: gui.projectId || (window.currentProjectId ? window.currentProjectId(true) : ''),
        tabTitle: tabTitle
      });
      // The link to hand out names the project id, so it keeps working after a
      // rename and does not depend on which folder the site landed in.
      const link = (out.formLinks && (out.formLinks.section || out.formLinks.question))
        || (out.pages && (out.pages.section || out.pages.question))
        || (location.origin + '/' + out.folder + '/section.html');
      status('Live site updated: ' + tabTitle + '. Reload its tab to see it.', link, 'done');
      console.log('[live site] ' + tabTitle + ' -> ' + link, out);
      return out;
    } finally {
      frame.remove();
    }
  }

  /**
   * One build at a time. A save made while one is running is not lost: it
   * queues a single rebuild after it, which picks up everything saved since.
   */
  window.publishProjectLiveSite = function () {
    if (running) { queued = true; return running; }
    running = (async function loop() {
      let last;
      do {
        queued = false;
        try {
          last = await publishOnce();
        } catch (err) {
          console.error('[live site] Publish failed:', err);
          status('The project was saved, but the live site could not be updated: '
            + (err && err.message ? err.message : err), null, 'error');
        }
      } while (queued);
      return last;
    })().finally(() => { running = null; });
    return running;
  };
  window.liveSiteTabTitleFor = function (projectName, when) {
    return tabNameOf(projectName) + ' ' + stampOf(when || new Date());
  };

  /**
   * "Open Form Link": this project's live site, one section at a time.
   *
   * The tab is opened at the click, before anything is looked up - a tab opened
   * after an await is a popup, and browsers block it. It is pointed at the
   * project's section page once the server says where that is; a project that
   * has never been published is published first, the way Save would.
   */
  window.openFormLink = async function () {
    const tab = window.open('', '_blank');
    const say = (text) => {
      try { if (tab && tab.document) tab.document.body.textContent = text; } catch (e) { /* cross-origin once it loads */ }
    };
    say('Opening the form…');
    try {
      const projectId = typeof window.currentProjectId === 'function' ? window.currentProjectId(true) : '';
      let published = false;
      if (projectId) {
        const res = await fetch('/api/live-site?projectId=' + encodeURIComponent(projectId));
        published = res.ok;
      }
      let out = null;
      if (!published) {
        say('This project has no live site yet - building it…');
        out = await window.publishProjectLiveSite();
        if (!out) throw new Error('The live site could not be built');
      }
      // The link carries the project id: /form/<id>/section.html. The server
      // finds whichever folder holds that project's site, so the same link works
      // for any flowchart with an id, before and after a rename.
      const id = projectId || (out && out.projectId) || '';
      const link = id
        ? '/form/' + encodeURIComponent(id) + '/section.html'
        : (out && out.pages && (out.pages.section || out.pages.question));
      if (!link) throw new Error('The live site could not be built');
      const url = new URL(link, location.origin).href;
      if (tab && !tab.closed) tab.location.href = url;
      else window.open(url, '_blank');
    } catch (err) {
      console.error('[live site] Open Form Link failed:', err);
      say('The form link could not be opened: ' + (err && err.message ? err.message : err));
      status('The form link could not be opened: ' + (err && err.message ? err.message : err), null, 'error');
    }
  };
})();
