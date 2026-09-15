#!/usr/bin/env node
/**
 * Rule: Back goes back the way the filer came.
 *
 * Every other audit reads data - the interview, the answers, the PDFs - and
 * none of them presses a button. That is how this shipped: a filer who asked
 * only for an order not to abuse them went from DV-100 "Orders You Want" to
 * CLETS-001, pressed Back, and landed in DV-108 "Risk of Abduction" - a form
 * their answers had switched off, holding a required question. Back looked for
 * the nearest earlier section with a question on it, not the section the filer
 * had left. Next was right the whole time, so nothing that walks forward saw it.
 *
 * So this walks the published page in a real browser. For each fill path
 * (minimum, then maximum) it fills the form, starts at section 1, presses Next
 * until the last section, then presses Back until the first, and requires:
 *
 *   - Back visits exactly the sections Next visited, in reverse;
 *   - no section is visited twice going forward (a loop);
 *   - every section visited belongs to a form that is in the packet;
 *   - Next is never stuck on a section a completed fill left answered.
 *
 * The fill itself is the debug menu's own button, pressed with the menu open,
 * the way a person does it - and it is held to what a person sees:
 *
 *   - the button finishes within the budget (--fill-budget, 3000 ms);
 *   - nothing it wrote is gone three seconds later;
 *   - no section the walk passes has an empty field on a question it shows -
 *     empty as drawn, not as stored: a value painted transparent is empty;
 *   - the page after the button is the page after the worked-out fill (run in
 *     a tab of its own): every answer, and every element drawn the same way;
 *   - the same holds on a page that restored a saved draft first, eight
 *     seconds on - a returning filer's page, where the restore used to land
 *     over the fill and empty every repeating block;
 *   - the numbered steps show exactly the forms the answers need, numbered 1
 *     to n, on a fresh page and after the fill, and an idle page raises no
 *     storm of change events (--idle-events, 50 a second);
 *   - on a phone-sized screen (--phone-width, 375px) no section is wider than
 *     the screen: one fixed-width box lays the whole page out wider, and the
 *     phone shows every section zoomed out.
 *
 * Drawn, because the next defect after the slow button was on the screen and
 * nowhere else. The recorded fill wrote every date, and 46 date boxes still
 * showed their captions - a date box is marked as holding a date only by an
 * event, and the button writes without them. Every check read the values.
 *
 * Those came later, the day a fill that took a second when called from a
 * script took 45 with the menu open and left a restraining order's dates
 * empty. This audit had called fillMaximumPath from a script with the menu
 * shut, and only asked whether Next worked - so it passed.
 *
 * It drives the Chrome already on the machine through the DevTools protocol,
 * headless and with a throwaway profile, so nothing needs installing and the
 * answers a person has saved in their own browser are never touched. The dev
 * server must be running (npm start) and the site published
 * (the publish-live-site skill, or Save in the editor).
 *
 * Usage: node pipeline-nav-audit.js [--site dv-restraining-order-packet]
 *          [--server http://localhost:8080] [--modes section,question]
 *          [--paths minimum,maximum] [--fill-budget 3000] [--idle-events 50]
 *          [--phone-width 375] [--phone-only]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Firebase's SDK and the services a test-mode page reaches: blocked in every
// tab this audit opens (see inPage).
const FIREBASE_URLS = [
  '*gstatic.com/firebasejs/*',
  '*firestore.googleapis.com*',
  '*identitytoolkit.googleapis.com*',
  '*securetoken.googleapis.com*'
];

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const SITE = flag('site', 'dv-restraining-order-packet');
const SERVER = flag('server', 'http://localhost:8080').replace(/\/+$/, '');
// Question-at-a-time walks every question one press at a time, a few minutes
// per path; the section pages share the same Back code, so they are the default.
const MODES = flag('modes', 'section').split(',').map((s) => s.trim()).filter(Boolean);
// --phone-only runs the phone check alone, walking no fill path.
const PATHS = args.includes('--phone-only') ? []
  : flag('paths', 'minimum,maximum').split(',').map((s) => s.trim()).filter(Boolean);
const FILL_BUDGET_MS = Number(flag('fill-budget', '3000'));
// Change/input events an idle page may raise in one second - a few land just
// after load; the loop that got through raised about 7,600.
const IDLE_EVENT_LIMIT = Number(flag('idle-events', '50'));
// A phone's screen, in CSS pixels: nothing on a page may be wider, or the phone
// lays the whole page out wider and shows it zoomed out. 0 skips the check.
const PHONE_WIDTH = Number(flag('phone-width', '375'));
// A fixed window of the phone's width, not the phone's own zoom-out: that
// widens the page to fit what sticks out, and would hide it.
const PHONE_DEVICE = { width: PHONE_WIDTH, height: 812, deviceScaleFactor: 1, mobile: false };

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/** Start headless Chrome and hand back its DevTools websocket address. */
function launch(chrome) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-audit-'));
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  return new Promise((resolve, reject) => {
    let err = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not start: ' + err.slice(0, 300))), 20000);
    proc.stderr.on('data', (d) => {
      err += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
      if (m) { clearTimeout(timer); resolve({ proc, profile, ws: m[1] }); }
    });
    proc.on('exit', (code) => reject(new Error('Chrome exited (' + code + '): ' + err.slice(0, 300))));
  });
}

/** A minimal DevTools client: one websocket, flattened page sessions. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify(Object.assign({ id: msgId, method, params }, sessionId ? { sessionId } : {})));
  });
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve({ ws, send });
    ws.onerror = () => reject(new Error('could not reach Chrome at ' + wsUrl));
  });
}

async function evaluate(send, sessionId, expression, timeoutMs) {
  const out = await send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true, timeout: timeoutMs || 600000
  }, sessionId);
  if (out.exceptionDetails) {
    throw new Error((out.exceptionDetails.exception && out.exceptionDetails.exception.description)
      || out.exceptionDetails.text);
  }
  return out.result.value;
}

/**
 * Runs inside the page. Fills, walks Next to the last section, walks Back to
 * the first, and reports both paths. Written as a plain function so it can be
 * sent as its own source text.
 */
function walkInPage(fillPath) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const formOf = (n) => {
    const f = (typeof formOwningSection === 'function') ? formOwningSection(Number(n)) : null;
    return f ? f.name : '';
  };
  const titleOf = (n) => {
    const sec = document.getElementById('section' + n);
    const h = sec && sec.querySelector('h2, h1, .section-title');
    return h ? h.textContent.trim().slice(0, 60) : '';
  };
  const describe = (n) => ({ section: n, form: formOf(n), title: titleOf(n) });
  const activeSection = () => {
    const sec = document.querySelector('.section.active');
    return sec ? Number(sec.id.slice(7)) : currentSectionNumber;
  };
  const arrow = (dir) => {
    const sec = document.querySelector('.section.active');
    return sec && sec.querySelector(dir > 0 ? '.question-next' : '.question-prev');
  };
  // The page's own test for a field Next waits on (isElementEligible in the
  // section nav): enabled, not hidden, laid out.
  const eligible = (el) => {
    if (!el || el.disabled || el.type === 'hidden' || el.closest('.hidden')) return false;
    for (let c = el; c && c !== document.body; c = c.parentElement) {
      if (getComputedStyle(c).display === 'none') return false;
    }
    return !(el.offsetParent === null && el.type !== 'radio' && el.type !== 'checkbox');
  };
  // Fields on screen that hold nothing: typed boxes, dropdowns, radio groups.
  // Ticking boxes is optional; a question marked optional is too.
  const emptyOnScreen = (n) => {
    const sec = document.getElementById('section' + n);
    const out = [];
    if (!sec) return out;
    sec.querySelectorAll('.question-container').forEach((q) => {
      if (q.classList.contains('hidden') || q.getAttribute('data-optional') === '1') return;
      const radios = {};
      q.querySelectorAll('select, textarea, input').forEach((el) => {
        if (!eligible(el) || el.readOnly || el.closest('[data-optional]')) return;
        if (typeof isComputedFillField === 'function' && isComputedFillField(el)) return;
        const t = (el.type || '').toLowerCase();
        if (t === 'checkbox' || t === 'file' || t === 'button' || t === 'submit') return;
        if (t === 'radio') { (radios[el.name || el.id] = radios[el.name || el.id] || []).push(el.checked); return; }
        // Empty as drawn, not as stored. A date box paints its date transparent
        // and its caption over it until the page marks it filled: the value was
        // there, and the filer saw "Date of the order".
        const style = getComputedStyle(el);
        const painted = !/^(transparent|rgba\(\s*0,\s*0,\s*0,\s*0\s*\))$/.test(style.color) && style.opacity !== '0';
        if (!String(el.value || '').trim() || !painted) out.push(el.id || el.name);
      });
      Object.keys(radios).forEach((g) => { if (!radios[g].some(Boolean)) out.push(g); });
    });
    return out;
  };
  // The numbered steps at the top, as drawn: each form's step, whether it is
  // shown, whether its form is on, and its number. The bar lists exactly the
  // forms the answers call for, numbered 1, 2, 3 - a form an answer brings in
  // is added when the answer is given, not when the filer next moves page.
  const stepperState = () => {
    const bar = document.getElementById('stepperProgressBar');
    if (!bar) return null;
    const forms = (typeof getProjectForms === 'function') ? getProjectForms() : [];
    return [...bar.querySelectorAll('.stepper-step')].map((s) => {
      const name = ((s.querySelector('.stepper-label') || {}).textContent || '').trim();
      const f = forms.find((x) => x && x.name === name);
      return {
        name,
        shown: getComputedStyle(s).display !== 'none',
        needed: !f || !!f.alwaysIncluded || (typeof isFormActivated === 'function' && isFormActivated(f)),
        number: ((s.querySelector('.stepper-circle') || {}).textContent || '').trim()
      };
    });
  };
  return (async () => {
    const stepperLoad = stepperState();
    // An idle page raises no events of its own. Two hidden questions once
    // reset each other's dropdowns without end - about 7,600 change events a
    // second while nobody touched the page - and every check here passed,
    // because none of them measured what the page does while it waits.
    let idleEvents = 0;
    const countIdle = () => { idleEvents++; };
    document.addEventListener('change', countIdle, true);
    document.addEventListener('input', countIdle, true);
    await wait(1000);
    document.removeEventListener('change', countIdle, true);
    document.removeEventListener('input', countIdle, true);
    // Press the button the way a person does: the debug menu open - it is
    // where the buttons are - and the clock running.
    const btnId = fillPath === 'minimum' ? 'fillMinimumPathBtn' : 'fillMaximumPathBtn';
    if (typeof showDebugMenu === 'function') showDebugMenu();
    await wait(500);
    const fillBtn = document.getElementById(btnId);
    if (!fillBtn) return { error: 'the page has no ' + btnId + ' button' };
    const t0 = performance.now();
    fillBtn.click();
    let fillMs = null;
    for (let i = 0; i < 1800; i++) {
      await wait(100);
      const text = fillBtn.textContent || '';
      if (/❌/.test(text)) return { error: 'the ' + fillPath + ' fill failed: ' + text.trim() };
      if (!window.__MAX_FILL_IN_PROGRESS__ && /✅/.test(text)) { fillMs = Math.round(performance.now() - t0); break; }
    }
    if (fillMs === null) return { error: 'the ' + fillPath + ' fill never finished' };
    if (typeof hideDebugMenu === 'function') hideDebugMenu();
    // The page answers a fill with deferred work of its own, which has emptied
    // repeating blocks before. What the fill recorded must still be there.
    await wait(3000);
    const recorded = window.__BAKED_FILLS__ && window.__BAKED_FILLS__[fillPath];
    const drift = (recorded && typeof bakedFillDifferences === 'function') ? bakedFillDifferences(recorded) : null;
    // How the page looks now, before the walk moves anything, to hold against
    // the worked-out fill: what is drawn, not only what is stored.
    const appearance = window.__fwAppearance ? window.__fwAppearance() : null;
    const stepperFilled = stepperState();

    if (typeof sectionStack !== 'undefined' && Array.isArray(sectionStack)) sectionStack.length = 0;
    navigateSection(1);
    await wait(600);

    // Is any section after this one open? Without sectionReachable (a page
    // built before it existed) fall back to "a later section has a question
    // showing".
    const laterOpen = (here) => [...document.querySelectorAll('.section')].some((s) => {
      const n = Number(s.id.slice(7));
      if (!(n > here)) return false;
      if (typeof sectionReachable === 'function') return sectionReachable(n);
      return [...s.querySelectorAll('.question-container')].some((q) => !q.classList.contains('hidden'));
    });
    const forward = [activeSection()];
    let stuck = null;
    const empty = {};
    for (let press = 0; press < 3000; press++) {
      const btn = arrow(1);
      const here = activeSection();
      // What is on screen now - in question mode, one question per press.
      emptyOnScreen(here).forEach((id) => {
        empty[here] = empty[here] || [];
        if (!empty[here].includes(id)) empty[here].push(id);
      });
      // Leaving the last open section finishes the form and builds the PDFs.
      // The walk ends on that section instead: it is where Back starts from.
      const leavesSection = !btn || btn.dataset.advanceMode !== 'question';
      if (leavesSection && !laterOpen(here)) break;
      if (btn && btn.dataset.advanceMode === 'submit') break;
      if (!btn || btn.disabled) {
        stuck = here;
        break;
      }
      const before = activeSection();
      btn.click();
      await wait(120);
      // Leaving a section can finish the form a moment later - the PDFs are
      // built first - so wait for the move to land before judging it.
      if (leavesSection) {
        for (let t = 0; t < 80 && activeSection() === before && currentSectionNumber !== 'end'; t++) await wait(100);
      }
      if (currentSectionNumber === 'end') break;
      const now = activeSection();
      if (now !== before) forward.push(now);
    }

    // Next may finish the form from the last section (a page built before
    // sectionReachable cannot say in advance which section is last). Finishing
    // is fine; the thank-you screen's own Back must then return to that section.
    let thankYouBack = null;
    if (currentSectionNumber === 'end') {
      const last = forward[forward.length - 1];
      await wait(1500);
      if (typeof backFromThankYou === 'function') backFromThankYou();
      await wait(600);
      thankYouBack = { expected: last, went: activeSection() };
    }

    const back = [activeSection()];
    for (let press = 0; press < 3000; press++) {
      const btn = arrow(-1);
      if (!btn || btn.disabled) break;
      const before = activeSection();
      btn.click();
      await wait(120);
      const now = activeSection();
      if (now !== before) back.push(now);
      else if (arrow(-1) === btn && btn.disabled) break;
    }

    const on = (typeof getProjectForms === 'function')
      ? getProjectForms().filter((f) => isFormActivated(f)).map((f) => f.name) : [];
    // Every form that is on is on for a reason the walk can name: a rule that
    // names it exactly and is unconditional, or whose answer was given in a
    // form that is itself on. DV-105(A)'s rule once switched on DV-105 and
    // "DV-105(A) (2)" as well, because their names start the same, and the
    // minimum path walked all three; a No left in a switched-off DV-105 kept
    // DV-105(A) on besides.
    const byName = {};
    ((typeof getProjectForms === 'function') ? getProjectForms() : []).forEach((f) => { byName[f.name] = f; });
    const activationRules = (typeof getFormActivations === 'function') ? getFormActivations() : [];
    const explained = (name, depth) => {
      const f = byName[name];
      if (!f || depth > 12) return false;
      if (f.alwaysIncluded) return true;
      return activationRules.some((r) => r && r.targetForm === name && (r.unconditional
        || (typeof isActivationOptionChosen === 'function' && isActivationOptionChosen(r)
          && (!r.fromForm || explained(r.fromForm, depth + 1)))));
    };
    return {
      fillMs,
      appearance,
      drift: drift && { differences: drift.differences, differ: drift.differ },
      empty: Object.keys(empty).map((n) => Object.assign(describe(Number(n)), { fields: empty[n] })),
      formsOn: on,
      formsUnexplained: on.filter((name) => !explained(name, 0)),
      stepperLoad,
      stepperFilled,
      idleEvents,
      thankYouBack: thankYouBack && { expected: describe(thankYouBack.expected), went: describe(thankYouBack.went) },
      stuck: stuck === null ? null : describe(stuck),
      forward: forward.map(describe),
      back: back.map(describe)
    };
  })();
}

/**
 * Runs inside the page: every answer, and how every element in the form is
 * drawn - its classes, and whether it is switched off by style or hidden.
 * Elements without an id are named by the nearest one that has one. Which
 * sections the filer can reach is kept too; what lies in a section they cannot
 * reach - a form the answers left off - is marked, because nobody sees it and
 * no PDF is made from it.
 */
function appearanceInPage() {
  const values = {};
  const classes = {};
  const off = {};
  const plumbing = {};
  const undrawn = {};
  const reach = {};
  const counters = {};
  const sectionOpen = (sec) => {
    if (!(sec.id in reach)) {
      const n = Number(String(sec.id).replace(/^section/, ''));
      reach[sec.id] = !n || typeof sectionReachable !== 'function' || !!sectionReachable(n);
    }
    return reach[sec.id];
  };
  document.querySelectorAll('#customForm *').forEach((el) => {
    let key;
    if (el.id) key = '#' + el.id;
    else {
      const a = el.parentElement && el.parentElement.closest('[id]');
      const base = (a ? '#' + a.id : '') + '>' + el.tagName;
      counters[base] = (counters[base] || 0) + 1;
      key = base + counters[base];
    }
    // question-step-hidden is where a question-at-a-time section's pointer
    // stopped, not what the answers show: two fills can leave it on different
    // questions of a section nobody is looking at, and the walk below checks
    // the navigation itself.
    classes[key] = ((typeof el.className === 'string' ? el.className.replace(/\bquestion-step-hidden\b/g, '') : '')
      + (el.style && el.style.display === 'none' ? ' [display:none]' : '')
      + (el.hidden ? ' [hidden]' : '')).replace(/\s+/g, ' ').trim();
    const sec = el.closest('.section');
    if (sec && !sectionOpen(sec)) off[key] = true;
    // Plumbing: an element outside every section that the page never draws -
    // the hidden boxes a fill adds to carry an answer to the PDF. Its value is
    // still compared; whether it exists is not, since an unticked box and no
    // box print the same and nobody sees either.
    if (!sec && getComputedStyle(el).display === 'none') plumbing[key] = true;
    // Hidden fields too: the page derives them from what is typed (the ZIP the
    // county lookup reads), they reach the PDF, and a fill that writes without
    // keystrokes can leave them empty where the worked-out fill does not.
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.id && el.type !== 'file') {
      values[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : String(el.value || '');
    }
    // Drawn at all? An element on one page only that draws nothing - a
    // validation message the worked-out fill left behind, display:none - is
    // not a difference anyone sees.
    if (getComputedStyle(el).display === 'none') undrawn[key] = true;
  });
  return { values, classes, off, plumbing, undrawn, reach };
}

/** Runs inside the page: the worked-out fill, then how the page looks after it. */
function workedOutInPage(fillPath) {
  return (async () => {
    await fillMaximumPath(fillPath === 'minimum'
      ? { markers: true, minimum: true, solve: true } : { markers: true, solve: true });
    await new Promise((r) => setTimeout(r, 3000));
    return window.__fwAppearance();
  })();
}

/**
 * Runs inside a page that restored a saved draft: press the button, then wait
 * past every restore timer and check nothing the fill wrote was undone.
 */
function draftFillInPage(fillPath) {
  return (async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const btnId = fillPath === 'minimum' ? 'fillMinimumPathBtn' : 'fillMaximumPathBtn';
    if (typeof showDebugMenu === 'function') showDebugMenu();
    await wait(300);
    const btn = document.getElementById(btnId);
    if (!btn) return { error: 'the page has no ' + btnId + ' button' };
    const t0 = performance.now();
    btn.click();
    let fillMs = null;
    for (let i = 0; i < 1800; i++) {
      await wait(100);
      const text = btn.textContent || '';
      if (!window.__MAX_FILL_IN_PROGRESS__ && /✅|❌/.test(text)) { fillMs = Math.round(performance.now() - t0); break; }
    }
    if (fillMs === null) return { error: 'the fill never finished' };
    if (typeof hideDebugMenu === 'function') hideDebugMenu();
    // The restore's passes run on timers up to four seconds after load and
    // replay the draft after that; eight seconds is past all of them.
    await wait(8000);
    const recorded = window.__BAKED_FILLS__ && window.__BAKED_FILLS__[fillPath];
    const drift = (recorded && typeof bakedFillDifferences === 'function') ? bakedFillDifferences(recorded) : null;
    return { fillMs, drift: drift && { differences: drift.differences, differ: drift.differ } };
  })();
}

/**
 * Where two pages differ: "value <id>: ..." and "drawn <element>: ...".
 *
 * A box left unticked, an empty box and a box that is not there say the same
 * thing, to the filer and to the PDF. So do two pages that differ only inside
 * a form neither of them switched on. Which forms are on is compared on its
 * own: a section open after one fill and shut after the other is reported.
 */
function appearanceDifferences(a, b) {
  const out = [];
  const norm = (v) => (v === false || v === undefined || v === null) ? '' : String(v);
  const off = (k) => !!((a.off && a.off[k]) || (b.off && b.off[k]));
  new Set([...Object.keys(a.reach || {}), ...Object.keys(b.reach || {})]).forEach((id) => {
    const x = !!(a.reach && a.reach[id]);
    const y = !!(b.reach && b.reach[id]);
    if (x !== y) out.push('drawn #' + id + ': reachable only after the ' + (x ? 'worked-out fill' : 'button'));
  });
  new Set([...Object.keys(a.values), ...Object.keys(b.values)]).forEach((id) => {
    if (off('#' + id)) return;
    const x = norm(a.values[id]);
    const y = norm(b.values[id]);
    if (x !== y) out.push('value ' + id + ': worked out ' + JSON.stringify(x) + ', button ' + JSON.stringify(y));
  });
  new Set([...Object.keys(a.classes), ...Object.keys(b.classes)]).forEach((k) => {
    if (off(k)) return;
    // On one page only, and plumbing there, or not drawn there: its value was
    // compared above, and nobody sees it.
    if (!(k in a.classes) && b.plumbing && (b.plumbing[k] || (b.undrawn && b.undrawn[k]))) return;
    if (!(k in b.classes) && a.plumbing && (a.plumbing[k] || (a.undrawn && a.undrawn[k]))) return;
    if (!(k in a.classes)) { out.push('drawn ' + k + ': only after the button'); return; }
    if (!(k in b.classes)) { out.push('drawn ' + k + ': only after the worked-out fill'); return; }
    if (a.classes[k] === b.classes[k]) return;
    const ta = new Set(a.classes[k].split(/\s+/).filter(Boolean));
    const tb = new Set(b.classes[k].split(/\s+/).filter(Boolean));
    const lost = [...ta].filter((t) => !tb.has(t));
    const gained = [...tb].filter((t) => !ta.has(t));
    out.push('drawn ' + k + ':' + (lost.length ? ' missing ' + lost.join(' ') : '') + (gained.length ? ' extra ' + gained.join(' ') : ''));
  });
  return out;
}

/**
 * Runs inside a phone-sized page: fill the maximum path - the most questions
 * and entry blocks on screen - then show every section in turn and list what
 * sticks out past the screen's right edge. One box wider than a phone lays the
 * whole page out wider, and the phone shows every section zoomed out: a 585px
 * entry block once laid a 375px phone out at 759px.
 */
function phoneWidthInPage() {
  return (async () => {
    await fillMaximumPath({ markers: true, solve: true });
    await new Promise((r) => setTimeout(r, 1500));
    const root = document.documentElement;
    const screenWidth = root.clientWidth;
    const inFixedBox = (el) => {
      for (let c = el; c && c !== document.body; c = c.parentElement) {
        if (getComputedStyle(c).position === 'fixed') return true;
      }
      return false;
    };
    const describeEl = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
      + (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')
      + (el.getAttribute('for') ? '[for=' + el.getAttribute('for') + ']' : '')
      + (!el.id && el.getAttribute('name') ? '[name=' + el.getAttribute('name') + ']' : '')
      + (!el.id && !el.children.length && el.textContent.trim() ? ' "' + el.textContent.trim().slice(0, 40) + '"' : '');
    // The box to name is the one whose own width does it - a min-width, a
    // dropdown's longest option, a label that may not wrap. Every box around it
    // grows to hold it (a flex item grows to its widest child) and every block
    // inside a grown box stretches with it, so neither width nor position tells
    // them apart. What the page grows to is what its content needs at its
    // narrowest (the white box grew past the screen with its content), so lay
    // the box it sits in out at its own narrowest and see who is
    // still too wide: a stretched box, or one sized in percent (a text box at
    // 100%), shrinks with it; a min-width, a row that cannot wrap and a long
    // dropdown option do not. Forcing the box itself to min-content is wrong
    // (a text box reports its default columns), and so is squeezing the box it
    // sits in to nothing (a row whose items fit one by one is never named).
    // A wrapper that draws no box of its own (inline, contents) is passed over.
    // The box's siblings are hidden while it is measured: a box is never
    // narrower than its widest child, so one 585px block beside it would make
    // every sibling read 585px.
    const tooWide = (el) => el.getBoundingClientRect().width > screenWidth + 1;
    const narrowest = (el) => {
      let p = el.parentElement;
      while (p && p !== document.body && /^(inline|contents)$/.test(getComputedStyle(p).display)) p = p.parentElement;
      if (!p || p === document.body) return el.getBoundingClientRect().width;
      const saved = [];
      const set = (node, prop, value) => {
        saved.push([node, node.getAttribute('style')]);
        node.style.setProperty(prop, value, 'important');
      };
      for (let c = el; c !== p; c = c.parentElement) {
        Array.from(c.parentElement.children).forEach((s) => { if (s !== c) set(s, 'display', 'none'); });
      }
      set(p, 'width', 'min-content');
      set(p, 'min-width', '0px');
      set(p, 'max-width', 'none');
      const w = el.getBoundingClientRect().width;
      for (let i = saved.length - 1; i >= 0; i--) {
        const [node, style] = saved[i];
        if (style === null) node.removeAttribute('style'); else node.setAttribute('style', style);
      }
      return w;
    };
    const widest = (scope) => {
      const setters = [];
      [scope].concat(Array.from(scope.querySelectorAll('*'))).forEach((el) => {
        if (!tooWide(el) || inFixedBox(el)) return;
        if (narrowest(el) > screenWidth + 1) setters.push(el);
      });
      // The innermost: a box holding one that cannot shrink only grows with it.
      return setters.filter((el) => !setters.some((o) => o !== el && el.contains(o))).slice(0, 3).map((el) => {
        const minWidth = getComputedStyle(el).minWidth;
        // When nothing inside it is too wide on its own, its padding around its
        // widest part is: name that part too.
        let part = null;
        Array.from(el.children).forEach((c) => {
          if (!c.getBoundingClientRect().width || inFixedBox(c)) return;
          const w = narrowest(c);
          if (!part || w > part.w) part = { el: c, w };
        });
        return { element: describeEl(el), narrowest: Math.round(narrowest(el)),
          minWidth: /px$/.test(minWidth) && parseFloat(minWidth) > screenWidth ? minWidth : '',
          part: part ? describeEl(part.el) + ' ' + Math.round(part.w) + 'px' : '' };
      });
    };
    // Nothing too wide, and the page still is: something is pushed past the
    // right edge (a margin, an offset, a transform). The boxes that reach past
    // it while the box around them does not.
    const stickingOut = (scope) => {
      const out = [];
      scope.querySelectorAll('*').forEach((el) => {
        if (out.length >= 3) return;
        const r = el.getBoundingClientRect();
        if (!r.width || r.right <= screenWidth + 1) return;
        const p = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
        if (p && p.right > screenWidth + 1) return;
        if (inFixedBox(el)) return;
        const cs = getComputedStyle(el);
        out.push({ element: describeEl(el), right: Math.round(r.right), width: Math.round(r.width),
          how: [cs.position !== 'static' ? 'position ' + cs.position + ' left ' + cs.left : '',
            cs.marginLeft !== '0px' ? 'margin-left ' + cs.marginLeft : '',
            cs.transform !== 'none' ? 'transform ' + cs.transform : ''].filter(Boolean).join(', ') });
      });
      return out;
    };
    const titleOf = (sec) => {
      const h = sec.querySelector('h2, h1, .section-title');
      return h ? h.textContent.trim().slice(0, 60) : '';
    };
    const sections = Array.from(document.querySelectorAll('.section'));
    const results = [];
    // Outside every section first: the header, the numbered steps, the footer.
    sections.forEach((s) => s.classList.remove('active'));
    const outsideTooWide = root.scrollWidth > screenWidth + 1;
    if (outsideTooWide) {
      results.push({ section: 0, form: '', title: '', pageWidth: root.scrollWidth, wide: widest(document.body) });
    }
    for (const sec of sections) {
      sections.forEach((s) => s.classList.toggle('active', s === sec));
      // Question-at-a-time shows one question of a section; lay them all out.
      sec.querySelectorAll('.question-step-hidden').forEach((q) => q.classList.remove('question-step-hidden'));
      if (root.scrollWidth <= screenWidth + 1) continue;
      const wide = widest(sec);
      if (!wide.length && outsideTooWide) continue;
      const n = Number(sec.id.slice(7));
      const f = (typeof formOwningSection === 'function') ? formOwningSection(n) : null;
      results.push({ section: n, form: f ? f.name : '', title: titleOf(sec), pageWidth: root.scrollWidth, wide,
        stickOut: wide.length ? [] : stickingOut(document.body) });
    }
    return { screenWidth, sections: sections.length, results };
  })();
}

/**
 * Open the page in a fresh tab with empty storage - the page saves its answers
 * as it fills, and one tab's must not come back in the next - run one
 * expression in it, and close it. Null when the page never loads.
 */
async function inPage(send, url, expression, beforeReload, device) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  try {
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    // A test-mode page carries no Firebase. Blocked here as well, so that an
    // audit can never sign in or write its fills to a database even if a page
    // that does is ever published.
    await send('Network.enable', {}, sessionId);
    await send('Network.setBlockedURLs', { urls: FIREBASE_URLS }, sessionId);
    await send('Storage.clearDataForOrigin', { origin: new URL(url).origin, storageTypes: 'all' }, sessionId);
    // A phone-sized window (PHONE_DEVICE), with scrollbars that take no room,
    // as on a phone.
    if (device) {
      await send('Emulation.setDeviceMetricsOverride', device, sessionId);
      await send('Emulation.setScrollbarsHidden', { hidden: true }, sessionId);
    }
    await send('Page.navigate', { url }, sessionId);
    const waitReady = async () => {
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          if (await evaluate(send, sessionId,
            "document.readyState === 'complete' && typeof fillMaximumPath === 'function'"
            + " && !!document.querySelector('.section.active') && !window.__navBeforeReload", 5000)) return true;
        } catch (e) { /* mid-navigation */ }
      }
      return false;
    };
    if (!(await waitReady())) return null;
    // A page loaded with a saved draft: the setup puts the draft in storage,
    // and the page is loaded again so it restores it the way a returning
    // filer's does. The button is pressed soon after, while the restore's
    // timers are still running - which is when a restore used to land over it.
    if (beforeReload) {
      await evaluate(send, sessionId, beforeReload);
      await send('Page.reload', {}, sessionId);
      if (!(await waitReady())) return null;
    }
    await new Promise((r) => setTimeout(r, beforeReload ? 500 : 2000));
    await evaluate(send, sessionId, 'window.__fwAppearance = ' + appearanceInPage.toString());
    return await evaluate(send, sessionId, expression);
  } finally {
    await send('Target.closeTarget', { targetId });
  }
}

function check(result, fillPath) {
  const problems = [];
  if (result.error) return [result.error];
  const fwd = result.forward.map((s) => s.section);
  const bwd = result.back.map((s) => s.section);
  if (result.fillMs > FILL_BUDGET_MS) {
    problems.push('Pressing Fill ' + fillPath + ' path took ' + (result.fillMs / 1000).toFixed(1)
      + ' s - the budget is ' + (FILL_BUDGET_MS / 1000).toFixed(1) + ' s');
  }
  if (result.drift && result.drift.differences) {
    problems.push(result.drift.differences + ' answers the fill wrote were gone 3 s later (e.g. '
      + result.drift.differ.slice(0, 5).join(', ') + ')');
  }
  // The numbered steps list exactly the forms the answers call for, numbered
  // 1, 2, 3 - on a fresh page, and after the fill has brought forms in.
  const stepperProblems = (when, steps) => {
    if (!steps) return;
    const wrong = steps.filter((s) => s.shown !== s.needed);
    if (wrong.length) {
      problems.push('The numbered steps ' + when + ' ' + wrong.map((s) => (s.shown ? 'show ' : 'leave out ') + s.name).join(', ')
        + ' - they should list exactly the forms the answers call for');
    }
    const numbers = steps.filter((s) => s.shown).map((s) => s.number);
    if (numbers.some((n, i) => n !== String(i + 1))) {
      problems.push('The numbered steps ' + when + ' read ' + numbers.join(', ') + ', not 1 to ' + numbers.length);
    }
  };
  stepperProblems('on a fresh page', result.stepperLoad);
  stepperProblems('after pressing Fill ' + fillPath + ' path', result.stepperFilled);
  if (result.idleEvents > IDLE_EVENT_LIMIT) {
    problems.push('An idle page raised ' + result.idleEvents + ' change/input events in 1 s - something re-raises'
      + ' events in a loop (the limit is ' + IDLE_EVENT_LIMIT + ')');
  }
  (result.empty || []).forEach((s) => {
    problems.push('section ' + s.section + ' (' + s.form + ' "' + s.title + '") shows ' + s.fields.length
      + ' empty field' + (s.fields.length === 1 ? '' : 's') + ' after the fill: '
      + s.fields.slice(0, 6).join(', ') + (s.fields.length > 6 ? ', ...' : ''));
  });
  if (result.withDraft) {
    const w = result.withDraft;
    if (w.error) problems.push('With a saved draft: ' + w.error);
    if (w.fillMs > FILL_BUDGET_MS) {
      problems.push('With a saved draft, pressing Fill ' + fillPath + ' path took ' + (w.fillMs / 1000).toFixed(1)
        + ' s - the budget is ' + (FILL_BUDGET_MS / 1000).toFixed(1) + ' s');
    }
    if (w.drift && w.drift.differences) {
      problems.push('With a saved draft, ' + w.drift.differences + ' answers the fill wrote were gone 8 s later (e.g. '
        + w.drift.differ.slice(0, 5).join(', ') + ') - the draft\'s restore landed over the fill');
    }
  } else {
    problems.push('The run with a saved draft never finished loading');
  }
  const diffs = result.appearanceDifferences || [];
  const answers = diffs.filter((d) => d.indexOf('value ') === 0);
  if (answers.length) {
    problems.push(answers.length + ' answer' + (answers.length === 1 ? '' : 's')
      + ' after pressing the button differ from the worked-out fill: '
      + answers.slice(0, 4).join('; ') + (answers.length > 4 ? '; ...' : ''));
  }
  const kinds = {};
  diffs.filter((d) => d.indexOf('drawn ') === 0).forEach((d) => {
    const colon = d.indexOf(':');
    const kind = d.slice(colon + 1).trim();
    (kinds[kind] = kinds[kind] || []).push(d.slice(6, colon));
  });
  Object.keys(kinds).forEach((kind) => {
    const els = kinds[kind];
    problems.push(els.length + ' element' + (els.length === 1 ? '' : 's')
      + ' drawn differently after pressing the button than after the worked-out fill (' + kind + '), e.g. '
      + els.slice(0, 3).join(', '));
  });
  if (result.stuck) {
    problems.push('Next is disabled on section ' + result.stuck.section + ' (' + result.stuck.form
      + ' "' + result.stuck.title + '") although the fill answered it and later sections are open');
  }
  if (result.thankYouBack && result.thankYouBack.went.section !== result.thankYouBack.expected.section) {
    problems.push('Back on the thank-you screen went to section ' + result.thankYouBack.went.section
      + ' (' + result.thankYouBack.went.form + ' "' + result.thankYouBack.went.title + '") - it should have gone to section '
      + result.thankYouBack.expected.section);
  }
  const seen = new Set();
  fwd.forEach((n) => {
    if (seen.has(n)) problems.push('Next visits section ' + n + ' twice - the walk loops');
    seen.add(n);
  });
  (result.formsUnexplained || []).forEach((name) => {
    problems.push(name + ' is switched on, and no rule naming it is unconditional or answered in a form'
      + ' that is itself on - nothing the filer chose puts it in the packet');
  });
  result.forward.concat(result.back).forEach((s) => {
    if (s.form && result.formsOn.length && !result.formsOn.includes(s.form)) {
      problems.push('section ' + s.section + ' "' + s.title + '" belongs to ' + s.form
        + ', which is not in the packet');
    }
  });
  const expected = fwd.slice().reverse();
  if (expected.join(',') !== bwd.join(',')) {
    const at = expected.findIndex((n, i) => bwd[i] !== n);
    const from = result.back[at - 1] || result.forward[result.forward.length - 1];
    const went = result.back[at];
    problems.push('Back from section ' + (from ? from.section + ' (' + from.form + ' "' + from.title + '")' : '?')
      + ' went to ' + (went ? 'section ' + went.section + ' (' + went.form + ' "' + went.title + '")' : 'nowhere')
      + ' - it should have gone to section ' + expected[at]);
  }
  return [...new Set(problems)];
}

(async () => {
  const chrome = findChrome();
  if (!chrome) {
    console.error('No Chrome found. Set CHROME_PATH to a Chrome or Edge executable.');
    process.exit(2);
  }
  try {
    const res = await fetch(SERVER + '/live-sites/' + SITE + '/section.html', { method: 'HEAD' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (e) {
    console.error('The published site is not reachable at ' + SERVER + '/live-sites/' + SITE
      + '/ (' + e.message + '). Start the dev server and publish the site first.');
    process.exit(2);
  }

  const browser = await launch(chrome);
  const { ws, send } = await connect(browser.ws);
  let failed = 0;
  try {
    for (const mode of MODES) {
      for (const fillPath of PATHS) {
        const url = SERVER + '/live-sites/' + SITE + '/' + mode + '.html';
        const label = mode + ' page, ' + fillPath + ' path';
        // What the button has to leave on the page: the worked-out fill, in a
        // tab of its own.
        const workedOut = () => inPage(send, url, '(' + workedOutInPage.toString() + ')(' + JSON.stringify(fillPath) + ')');
        const reference = await workedOut();
        const result = await inPage(send, url, '(' + walkInPage.toString() + ')(' + JSON.stringify(fillPath) + ')');
        if (!result) {
          console.log('FAILS  ' + label + ': the page never finished loading');
          failed++;
          continue;
        }
        if (reference && result.appearance) {
          let differences = appearanceDifferences(reference, result.appearance);
          // The worked-out fill races the page now and then - it once left the
          // animals' entries empty - so a difference counts only when a second
          // worked-out run shows it too.
          if (differences.length) {
            const again = await workedOut();
            if (again) {
              const second = new Set(appearanceDifferences(again, result.appearance));
              differences = differences.filter((d) => second.has(d));
            }
          }
          result.appearanceDifferences = differences;
        }
        // The same button on a page that restored a saved draft first, the way
        // a returning filer meets it. The draft is the other path's answers.
        // Every other run starts with empty storage, and never saw a restore
        // that landed after the fill and emptied 180 fields.
        const other = fillPath === 'minimum' ? 'maximum' : 'minimum';
        const seedDraft = "(function(){var b=window.__BAKED_FILLS__;var o=b&&b['" + other + "'];"
          + "if(o){localStorage.setItem('formData_'+window.formId,JSON.stringify(o.values));}"
          + "window.__navBeforeReload=true;return !!o;})()";
        result.withDraft = await inPage(send, url,
          '(' + draftFillInPage.toString() + ')(' + JSON.stringify(fillPath) + ')', seedDraft);
        const problems = check(result, fillPath);
        console.log((problems.length ? 'FAILS  ' : 'passes ') + label
          + (result.fillMs ? '   fill ' + (result.fillMs / 1000).toFixed(1) + ' s,' : '')
          + (result.withDraft && result.withDraft.fillMs ? ' ' + (result.withDraft.fillMs / 1000).toFixed(1) + ' s with a draft,' : '')
          + (result.forward ? '   ' + result.forward.length + ' sections forward, ' + result.back.length + ' back' : ''));
        if (result.forward) {
          console.log('   Next: ' + result.forward.map((s) => s.section + ' ' + s.form).join(' > '));
          console.log('   Back: ' + result.back.map((s) => s.section + ' ' + s.form).join(' > '));
        }
        problems.forEach((p) => console.log('   - ' + p));
        if (problems.length) failed++;
      }
      // The same page on a phone-sized screen: every section, filled to the
      // maximum, must fit it.
      if (PHONE_WIDTH > 0) {
        const url = SERVER + '/live-sites/' + SITE + '/' + mode + '.html';
        const label = mode + ' page, ' + PHONE_WIDTH + 'px phone screen';
        const phone = await inPage(send, url, '(' + phoneWidthInPage.toString() + ')()', null, PHONE_DEVICE);
        if (!phone) {
          console.log('FAILS  ' + label + ': the page never finished loading');
          failed++;
        } else {
          const problems = phone.results.map((r) => (r.section
            ? 'section ' + r.section + ' (' + r.form + ' "' + r.title + '")' : 'outside every section, the page')
            + ' is ' + r.pageWidth + 'px wide on a ' + phone.screenWidth + 'px screen, so a phone shows it zoomed out: '
            + (r.wide.length
              ? r.wide.map((w) => w.element + ' cannot be narrower than ' + w.narrowest + 'px'
                + (w.minWidth ? ' (min-width ' + w.minWidth + ')' : '')
                + (w.part ? ', around ' + w.part : '')).join('; ')
              : (r.stickOut || []).length
                ? 'nothing is too wide, but ' + r.stickOut.map((s) => s.element + ' (' + s.width + 'px) reaches '
                  + s.right + 'px' + (s.how ? ' - ' + s.how : '')).join('; ')
                : 'no single box found'));
          console.log((problems.length ? 'FAILS  ' : 'passes ') + label + '   ' + phone.sections + ' sections laid out');
          problems.forEach((p) => console.log('   - ' + p));
          if (problems.length) failed++;
        }
      }
    }
  } finally {
    try { ws.close(); } catch (e) { /* closing */ }
    browser.proc.kill();
    setTimeout(() => { try { fs.rmSync(browser.profile, { recursive: true, force: true }); } catch (e) { /* locked by Chrome for a moment */ } }, 1500);
  }
  console.log(failed
    ? '\nNOT SHIPPABLE - ' + failed + ' path' + (failed === 1 ? '' : 's') + ' failed (above)'
    : '\nThe fill buttons are quick and complete, and Back retraces Next on every path walked');
  process.exitCode = failed ? 1 : 0;
})().catch((err) => { console.error(err); process.exit(1); });
