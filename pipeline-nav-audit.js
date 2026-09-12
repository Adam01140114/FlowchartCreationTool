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
 * It drives the Chrome already on the machine through the DevTools protocol,
 * headless and with a throwaway profile, so nothing needs installing and the
 * answers a person has saved in their own browser are never touched. The dev
 * server must be running (npm start) and the site published
 * (the publish-live-site skill, or Save in the editor).
 *
 * Usage: node pipeline-nav-audit.js [--site dv-restraining-order-packet]
 *          [--server http://localhost:8080] [--modes section,question]
 *          [--paths minimum,maximum]
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
const PATHS = flag('paths', 'minimum,maximum').split(',').map((s) => s.trim()).filter(Boolean);

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
  return (async () => {
    window.__navFill = null;
    fillMaximumPath(fillPath === 'minimum' ? { markers: true, minimum: true } : {})
      .then(() => { window.__navFill = 'ok'; }, (e) => { window.__navFill = 'failed: ' + e; });
    for (let i = 0; i < 360 && !window.__navFill; i++) await wait(500);
    if (window.__navFill !== 'ok') return { error: 'the ' + fillPath + ' fill ' + (window.__navFill || 'never finished') };
    await wait(2500);

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
    for (let press = 0; press < 3000; press++) {
      const btn = arrow(1);
      const here = activeSection();
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
    return {
      formsOn: on,
      thankYouBack: thankYouBack && { expected: describe(thankYouBack.expected), went: describe(thankYouBack.went) },
      stuck: stuck === null ? null : describe(stuck),
      forward: forward.map(describe),
      back: back.map(describe)
    };
  })();
}

function check(result) {
  const problems = [];
  if (result.error) return [result.error];
  const fwd = result.forward.map((s) => s.section);
  const bwd = result.back.map((s) => s.section);
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
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
        await send('Runtime.enable', {}, sessionId);
        await send('Page.enable', {}, sessionId);
        await send('Page.navigate', { url }, sessionId);
        let ready = false;
        for (let i = 0; i < 120 && !ready; i++) {
          await new Promise((r) => setTimeout(r, 500));
          try {
            ready = await evaluate(send, sessionId,
              "document.readyState === 'complete' && typeof fillMaximumPath === 'function' && !!document.querySelector('.section.active')", 5000);
          } catch (e) { ready = false; }
        }
        const label = mode + ' page, ' + fillPath + ' path';
        if (!ready) {
          console.log('FAILS  ' + label + ': the page never finished loading');
          failed++;
        } else {
          await new Promise((r) => setTimeout(r, 2000));
          const result = await evaluate(send, sessionId, '(' + walkInPage.toString() + ')(' + JSON.stringify(fillPath) + ')');
          const problems = check(result);
          console.log((problems.length ? 'FAILS  ' : 'passes ') + label
            + (result.forward ? '   ' + result.forward.length + ' sections forward, ' + result.back.length + ' back' : ''));
          if (result.forward) {
            console.log('   Next: ' + result.forward.map((s) => s.section + ' ' + s.form).join(' > '));
            console.log('   Back: ' + result.back.map((s) => s.section + ' ' + s.form).join(' > '));
          }
          problems.forEach((p) => console.log('   - ' + p));
          if (problems.length) failed++;
        }
        await send('Target.closeTarget', { targetId });
      }
    }
  } finally {
    try { ws.close(); } catch (e) { /* closing */ }
    browser.proc.kill();
    setTimeout(() => { try { fs.rmSync(browser.profile, { recursive: true, force: true }); } catch (e) { /* locked by Chrome for a moment */ } }, 1500);
  }
  console.log(failed ? '\nNOT SHIPPABLE - Back does not retrace Next' : '\nBack retraces Next on every path walked');
  process.exitCode = failed ? 1 : 0;
})().catch((err) => { console.error(err); process.exit(1); });
