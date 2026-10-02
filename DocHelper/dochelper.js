/* DocHelper chat page. Talks to /api/dochelper (DocHelper/server/routes.js) and
 * walks the interview with InterviewWalk (interview-walk.js), which the server
 * uses too, so the page and the filler always agree on what was asked. */
(function () {
  'use strict';

  var API = '/api/dochelper';
  var chat = document.getElementById('chat');
  var composer = document.getElementById('composer');
  var responseInput = document.getElementById('responseInput');
  var progressBar = document.getElementById('progressBar');
  var modePill = document.getElementById('modePill');
  var startOverBtn = document.getElementById('startOver');

  var state = {
    status: null,        // { mode, model, qpdf }
    session: null,       // server's view of the session
    interview: null,     // { title, forms: [...] }
    answers: {},
    files: [],           // PDFs picked on the landing screen
    note: '',
    notice: '',
    busy: false,
    fillError: '',
    checking: null,      // id of the question whose answer is being measured
    tooLong: null,       // { qid, answer, result } while the person decides
    limits: {},          // qid -> { slot: characters } once a box's limit is known
    pollTimer: null,
  };

  /* ---------------------------------------------------------------- */
  /* small helpers                                                     */
  /* ---------------------------------------------------------------- */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { add(el, c); }); return; }
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  function store(key, value) {
    try {
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage unavailable: the page still works, it just will not resume */ }
  }
  function recall(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function sizeOf(bytes) {
    return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }
  function api(path, opts) {
    return fetch(API + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var err = new Error(data.error || ('Request failed (' + res.status + ')')); err.data = data; throw err; }
        return data;
      });
    });
  }
  function icon(name) {
    var paths = {
      doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
      check: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="m9 15 2 2 4-4"/>',
      upload: '<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/>',
      download: '<path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',
      send: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    };
    var span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.style.display = 'inline-flex';
    span.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
    return span;
  }

  function bot() {
    var content = Array.prototype.slice.call(arguments);
    return h('div', { class: 'row bot' },
      h('div', { class: 'avatar', 'aria-hidden': 'true' }, icon('check')),
      h('div', { class: 'bubble' }, content));
  }
  function user(content, onEdit) {
    return h('div', { class: 'row user' },
      onEdit ? h('button', { class: 'edit', type: 'button', onclick: onEdit, title: 'Change this answer' }, 'Change') : null,
      h('div', { class: 'bubble' }, content));
  }
  function divider(form, section) {
    return h('div', { class: 'divider' }, h('span', null, h('span', { class: 'form', text: form }), section ? ' · ' + section : ''));
  }
  function scrollDown() {
    requestAnimationFrame(function () { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); });
  }
  function setProgress(fraction) {
    if (fraction == null) { progressBar.hidden = true; return; }
    progressBar.hidden = false;
    progressBar.firstElementChild.style.width = Math.round(Math.max(0, Math.min(1, fraction)) * 100) + '%';
  }

  /* ---------------------------------------------------------------- */
  /* session lifecycle                                                 */
  /* ---------------------------------------------------------------- */

  function setSession(id) {
    var url = new URL(location.href);
    if (id) url.searchParams.set('session', id); else url.searchParams.delete('session');
    history.replaceState(null, '', url);
    store('dochelper:last', id || undefined);
  }

  function startOver() {
    stopPolling();
    setSession(null);
    state.session = null; state.interview = null; state.answers = {};
    state.files = []; state.note = ''; state.notice = ''; state.fillError = '';
    render();
  }

  function stopPolling() { if (state.pollTimer) { clearTimeout(state.pollTimer); state.pollTimer = null; } }

  function poll() {
    stopPolling();
    if (!state.session) return;
    var stage = state.session.stage;
    var every = stage === 'waiting' ? 3000 : 900;
    if (['reading', 'designing', 'building', 'waiting'].indexOf(stage) < 0) return;
    state.pollTimer = setTimeout(function () {
      api('/sessions/' + state.session.id).then(function (s) {
        var before = JSON.stringify([state.session.stage, state.session.progress.length, state.session.error]);
        state.session = s;
        if (s.stage === 'ready' && !state.interview) return loadInterview();
        if (JSON.stringify([s.stage, s.progress.length, s.error]) !== before) render();
        poll();
      }).catch(function () { poll(); });
    }, every);
  }

  function loadInterview() {
    return api('/sessions/' + state.session.id + '/interview').then(function (iv) {
      state.interview = iv;
      state.answers = recall('dochelper:answers:' + state.session.id) || {};
      render();
    });
  }

  function resume(id) {
    return api('/sessions/' + id).then(function (s) {
      state.session = s;
      setSession(s.id);
      if (s.stage === 'ready' || s.stage === 'filled') return loadInterview();
      render(); poll();
    }).catch(function () { setSession(null); render(); });
  }

  function submitFiles() {
    if (!state.files.length || state.busy) return;
    state.busy = true;
    var fd = new FormData();
    fd.append('note', state.note);
    state.files.forEach(function (f) { fd.append('pdfs', f, f.name); });
    render();
    api('/sessions', { method: 'POST', body: fd }).then(function (s) {
      state.busy = false;
      state.notice = '';
      state.session = s;
      state.answers = {};
      setSession(s.id);
      render(); poll();
    }).catch(function (err) {
      state.busy = false;
      state.notice = err.message;
      render();
    });
  }

  function uploadResponse(file) {
    if (!file || !state.session) return;
    var fd = new FormData();
    fd.append('response', file, file.name);
    state.notice = '';
    state.session.stage = 'building';
    state.session.progress = state.session.progress.concat(['Reading ' + file.name]);
    render();
    api('/sessions/' + state.session.id + '/response', { method: 'POST', body: fd }).then(function (s) {
      state.session = s;
      if (s.stage === 'ready') return loadInterview();
      render(); poll();
    }).catch(function (err) {
      if (err.data && err.data.stage) state.session = err.data;
      else state.session.stage = 'waiting';
      state.notice = err.message;
      render(); poll();
    });
  }

  function fillForms() {
    state.busy = true; state.fillError = '';
    render();
    api('/sessions/' + state.session.id + '/fill', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: state.answers }),
    }).then(function (s) {
      state.busy = false; state.session = s; render();
    }).catch(function (err) {
      state.busy = false; state.fillError = err.message; render();
    });
  }

  /* ---------------------------------------------------------------- */
  /* answers                                                           */
  /* ---------------------------------------------------------------- */

  function saveAnswers() { store('dochelper:answers:' + state.session.id, state.answers); }

  /**
   * Send a typed answer: first ask the server whether it fits the boxes it goes
   * in. If not, the chat says so and offers a version that fits (or the person
   * writes their own). Choices and dates always fit and skip the check.
   */
  var NEEDS_CHECK = { text: 1, textarea: 1, phone: 1, email: 1, number: 1, money: 1, boxes: 1, repeat: 1 };
  function submit(q, value) {
    if (!NEEDS_CHECK[q.type] || value === '' || state.checking) { answer(q, value); return; }
    state.checking = q.id;
    drafts[q.id] = value;
    render();
    api('/sessions/' + state.session.id + '/check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, answer: value, answers: state.answers }),
    }).then(function (result) {
      state.checking = null;
      if (result.fits) { answer(q, value); return; }
      state.tooLong = { qid: q.id, answer: value, result: result };
      render();
    }).catch(function () {
      // A failed check must not stop the person; the fill still reports a box that overflows.
      state.checking = null;
      answer(q, value);
    });
  }

  function answer(q, value) {
    state.tooLong = null;
    state.answers[q.id] = value;
    if (state.session.stage === 'filled') state.session.stage = 'ready';
    saveAnswers();
    render();
  }

  // Reopening a question keeps what was there, so going back over a long
  // statement does not throw it away.
  var drafts = {};
  function unanswer(id) {
    state.tooLong = null;
    if (state.answers.hasOwnProperty(id)) drafts[id] = state.answers[id];
    delete state.answers[id];
    if (state.session.stage === 'filled') state.session.stage = 'ready';
    saveAnswers();
    render();
  }

  function labelOf(options, value) {
    var o = (options || []).filter(function (x) { return x.value === value; })[0];
    return o ? o.label : value;
  }

  function formatDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
    if (!m) return v;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function display(q, a) {
    if (a === '' || a == null) return h('span', { class: 'skipped' }, 'Skipped');
    switch (q.type) {
      case 'choice': return labelOf(q.options, a);
      case 'multi': return a.length ? a.map(function (v) { return labelOf(q.options, v); }).join('\n') : h('span', { class: 'skipped' }, 'None of these');
      case 'date': return formatDate(a);
      case 'money': return '$' + a;
      case 'boxes':
        return (q.boxes || []).map(function (b) {
          var v = a[b.key];
          if (!v) return null;
          return b.label + ': ' + (b.type === 'choice' ? labelOf(b.options, v) : b.type === 'date' ? formatDate(v) : v);
        }).filter(Boolean).join('\n') || h('span', { class: 'skipped' }, 'Skipped');
      case 'repeat':
        var n = (a.entries || []).length;
        if (!n) return 'None';
        return (a.entries || []).map(function (e, i) {
          var first = (q.repeat.fields || []).map(function (f) {
            var v = e[f.key];
            return f.type === 'choice' ? labelOf(f.options, v) : f.type === 'date' ? formatDate(v) : v;
          }).filter(Boolean).slice(0, 2).join(', ');
          return (q.repeat.entryTitle || 'Entry') + ' ' + (i + 1) + (first ? ': ' + first : '');
        }).join('\n');
      default: return String(a);
    }
  }

  /* ---------------------------------------------------------------- */
  /* question widgets                                                  */
  /* ---------------------------------------------------------------- */

  function inputFor(type, value, attrs) {
    attrs = attrs || {};
    if (type === 'textarea') return h('textarea', Object.assign({ class: 'textarea' }, attrs), value || '');
    var t = { date: 'date', email: 'email', phone: 'tel', number: 'text', money: 'text' }[type] || 'text';
    var inp = h('input', Object.assign({ class: 'input', type: t, value: value || '' }, attrs));
    if (type === 'number' || type === 'money') inp.setAttribute('inputmode', 'decimal');
    if (type === 'phone') inp.setAttribute('autocomplete', 'tel');
    if (type === 'email') inp.setAttribute('autocomplete', 'email');
    return type === 'money' ? h('div', { class: 'money' }, inp) : inp;
  }
  function valueOf(el) {
    var inp = el.matches('input, textarea, select') ? el : el.querySelector('input, textarea, select');
    return inp ? String(inp.value || '').trim() : '';
  }
  function problemWith(type, value) {
    if (!value) return '';
    if (type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return 'That does not look like an email address.';
    if ((type === 'number' || type === 'money') && !/^-?[\d,]*\.?\d+$/.test(value.replace(/^\$/, ''))) return 'Please enter a number.';
    if (type === 'phone' && value.replace(/\D/g, '').length < 7) return 'That phone number looks too short.';
    return '';
  }

  /** "312 / 400 characters" under a box whose limit is known, red when over. */
  function counterFor(q, slot, control) {
    var limit = state.limits[q.id] && state.limits[q.id][slot];
    if (!limit) return null;
    var inp = control.matches('input, textarea') ? control : control.querySelector('input, textarea');
    if (!inp) return null;
    var el = h('div', { class: 'counter', 'aria-live': 'polite' });
    var update = function () {
      var n = inp.value.trim().length;
      el.textContent = n + ' / ' + limit + ' characters' + (n > limit ? ' - about ' + (n - limit) + ' too many' : '');
      el.classList.toggle('over', n > limit);
    };
    inp.addEventListener('input', update);
    update();
    return el;
  }

  function tools(q, extra) {
    var path = state.walk.path;
    var last = null;
    for (var i = path.length - 1; i >= 0; i--) if (path[i].answered) { last = path[i].question.id; break; }
    return h('div', { class: 'tools' },
      h('div', null,
        last ? h('button', { class: 'linkish', type: 'button', onclick: function () { unanswer(last); } }, '← Back') : null,
        q && q.optional ? h('button', { class: 'linkish', type: 'button', onclick: function () { answer(q, q.type === 'multi' ? [] : ''); } }, 'Skip') : null),
      extra || null);
  }

  function widget(q) {
    var err = h('div', { class: 'err', role: 'alert' });
    var prior = drafts.hasOwnProperty(q.id) ? drafts[q.id] : null;

    if (q.type === 'choice') {
      var opts = q.options || [];
      if (opts.length > 12) {
        var sel = h('select', { class: 'input', 'aria-label': q.text },
          h('option', { value: '' }, 'Choose one…'),
          opts.map(function (o) { return h('option', { value: o.value, selected: prior === o.value }, o.label); }));
        return h('div', { class: 'box' },
          h('div', { class: 'line' }, h('div', { class: 'field' }, sel),
            h('button', { class: 'btn primary', type: 'button', onclick: function () {
              if (!sel.value) { err.textContent = 'Please choose one.'; return; }
              answer(q, sel.value);
            } }, 'Send', icon('send'))),
          err, tools(q));
      }
      return h('div', { class: 'box' },
        h('div', { class: 'chips', role: 'group', 'aria-label': q.text },
          opts.map(function (o) {
            return h('button', { class: 'chip', type: 'button', onclick: function () { answer(q, o.value); } }, o.label);
          })),
        tools(q));
    }

    if (q.type === 'multi') {
      var picked = Array.isArray(prior) ? prior : [];
      var boxes = (q.options || []).map(function (o) {
        var cb = h('input', { type: 'checkbox', value: o.value, checked: picked.indexOf(o.value) >= 0 });
        return h('label', { class: 'check' }, cb, h('span', null, o.label));
      });
      return h('div', { class: 'box' },
        h('div', { class: 'label' }, 'Choose all that apply'),
        h('div', { class: 'checks scroll' }, boxes),
        err,
        tools(q, h('button', { class: 'btn primary', type: 'button', onclick: function () {
          var vals = boxes.map(function (l) { return l.querySelector('input'); }).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
          if (!vals.length && !q.optional) { err.textContent = 'Choose at least one.'; return; }
          answer(q, vals);
        } }, 'Continue', icon('send'))));
    }

    if (q.type === 'boxes') {
      var cur = (prior && typeof prior === 'object') ? prior : {};
      var cells = (q.boxes || []).map(function (b) {
        var control = b.type === 'choice'
          ? h('select', { class: 'input' }, h('option', { value: '' }, b.optional ? '(none)' : 'Choose…'),
            (b.options || []).map(function (o) { return h('option', { value: o.value, selected: cur[b.key] === o.value }, o.label); }))
          : inputFor(b.type, cur[b.key], { placeholder: b.optional ? 'Leave blank if none' : '' });
        return { b: b, el: h('label', null, h('span', { class: 'label' }, b.label), control, counterFor(q, b.key, control)) };
      });
      var send = function () {
        var out = {}; var bad = '';
        cells.forEach(function (c) {
          var v = valueOf(c.el);
          if (!v && !c.b.optional && !q.optional) bad = bad || ('Please fill in ' + c.b.label.toLowerCase() + '.');
          bad = bad || problemWith(c.b.type, v);
          if (v) out[c.b.key] = v;
        });
        if (bad) { err.textContent = bad; return; }
        submit(q, Object.keys(out).length ? out : '');
      };
      var wrap = h('div', { class: 'box' },
        h('div', { class: 'grid2 scroll' }, cells.map(function (c) { return c.el; })),
        err, tools(q, h('button', { class: 'btn primary', type: 'button', onclick: send }, 'Send', icon('send'))));
      wrap.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); send(); } });
      return wrap;
    }

    if (q.type === 'repeat') {
      var r = q.repeat;
      var existing = (prior && prior.entries) || [];
      var count = Math.max(r.min || 0, Math.min(r.max || 20, existing.length || r.min || 1));
      var holder = h('div', { class: 'scroll' });
      var out = h('output', null, String(count));
      var entryEls = [];
      var drawEntries = function () {
        var keep = entryEls.map(function (rows) {
          var o = {}; rows.forEach(function (x) { o[x.f.key] = valueOf(x.el); }); return o;
        });
        holder.innerHTML = '';
        entryEls = [];
        for (var i = 0; i < count; i++) {
          var data = keep[i] || existing[i] || {};
          var rows = (r.fields || []).map(function (f) {
            var control = f.type === 'choice'
              ? h('select', { class: 'input' }, h('option', { value: '' }, 'Choose…'),
                (f.options || []).map(function (o) { return h('option', { value: o.value, selected: data[f.key] === o.value }, o.label); }))
              : inputFor(f.type, data[f.key]);
            return { f: f, el: h('label', null, h('span', { class: 'label' }, f.label), control) };
          });
          entryEls.push(rows);
          holder.appendChild(h('div', { class: 'entry' },
            h('h5', null, (r.entryTitle || 'Entry') + ' ' + (i + 1)),
            h('div', { class: 'grid2' }, rows.map(function (x) { return x.el; }))));
        }
        out.textContent = String(count);
      };
      var step = function (d) { count = Math.max(r.min || 0, Math.min(r.max || 20, count + d)); drawEntries(); };
      drawEntries();
      return h('div', { class: 'box' },
        h('div', { class: 'count' },
          h('span', { class: 'label', style: 'margin:0' }, 'How many'),
          h('button', { type: 'button', 'aria-label': 'One fewer', onclick: function () { step(-1); } }, '−'),
          out,
          h('button', { type: 'button', 'aria-label': 'One more', onclick: function () { step(1); } }, '+'),
          r.max ? h('span', { class: 'label', style: 'margin:0' }, 'up to ' + r.max) : null),
        holder, err,
        tools(q, h('button', { class: 'btn primary', type: 'button', onclick: function () {
          var bad = '';
          var entries = entryEls.map(function (rows) {
            var o = {};
            rows.forEach(function (x) {
              var v = valueOf(x.el);
              if (!v && !x.f.optional) bad = bad || ('Please fill in ' + x.f.label.toLowerCase() + ' for every entry.');
              bad = bad || problemWith(x.f.type, v);
              if (v) o[x.f.key] = v;
            });
            return o;
          });
          if (bad) { err.textContent = bad; return; }
          submit(q, { count: entries.length, entries: entries });
        } }, 'Send', icon('send'))));
    }

    // A single value.
    var control = inputFor(q.type, typeof prior === 'string' ? prior : '', {
      'aria-label': q.text,
      placeholder: q.type === 'textarea' ? 'Type your answer…' : (q.type === 'date' ? '' : 'Type your answer'),
    });
    var sendValue = function () {
      var v = valueOf(control);
      if (!v && !q.optional) { err.textContent = 'Please answer, or go back.'; return; }
      var bad = problemWith(q.type, v);
      if (bad) { err.textContent = bad; return; }
      submit(q, q.type === 'money' ? v.replace(/^\$/, '') : v);
    };
    control.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (q.type !== 'textarea' || e.ctrlKey || e.metaKey)) { e.preventDefault(); sendValue(); }
    });
    return h('div', { class: 'box' },
      h('div', { class: 'line' }, h('div', { class: 'field' }, control),
        h('button', { class: 'btn primary', type: 'button', onclick: sendValue, 'aria-label': 'Send answer' }, 'Send', icon('send'))),
      counterFor(q, '', control),
      q.type === 'textarea' ? h('div', { class: 'label', style: 'margin:6px 2px 0' }, 'Ctrl+Enter to send') : null,
      err, tools(q));
  }

  /* ---------------------------------------------------------------- */
  /* screens                                                           */
  /* ---------------------------------------------------------------- */

  function addFiles(list) {
    var rejected = [];
    Array.prototype.forEach.call(list, function (f) {
      var isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
      if (!isPdf) { rejected.push(f.name); return; }
      if (state.files.some(function (x) { return x.name === f.name && x.size === f.size; })) return;
      state.files.push(f);
    });
    state.notice = rejected.length ? 'Only PDF files can be added. Left out: ' + rejected.join(', ') : '';
    render();
  }

  function dropZone() {
    var picker = h('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: true, hidden: true,
      onchange: function () { addFiles(picker.files); picker.value = ''; } });
    var zone = h('div', { class: 'drop', role: 'button', tabindex: '0', 'aria-label': 'Add PDF forms',
      onclick: function () { picker.click(); },
      onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); } } },
      icon('upload'),
      h('strong', null, 'Drop your PDF forms here'),
      h('small', null, 'or click to choose them · PDF only'),
      picker);
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('over'); });
    });
    zone.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
    return zone;
  }

  function landing() {
    chat.appendChild(bot(
      h('p', null, h('strong', null, 'Welcome to DocHelper.')),
      h('p', null, 'I help you fill out paperwork. You give me the forms, I ask you plain questions one at a time, and you get your forms back filled in, ready to print and sign.')));
    chat.appendChild(bot(
      h('p', { class: 'q' }, 'What kind of documents are you trying to fill out today?'),
      h('p', { class: 'sub' }, 'Tell me in a few words below, and drop in the PDF forms you were given.'),
      dropZone(),
      state.files.length ? h('ul', { class: 'files' }, state.files.map(function (f, i) {
        return h('li', null, icon('doc'), h('span', { class: 'name', text: f.name }), h('span', { class: 'size', text: sizeOf(f.size) }),
          h('button', { type: 'button', 'aria-label': 'Remove ' + f.name, onclick: function () { state.files.splice(i, 1); render(); } }, '×'));
      })) : null,
      state.notice ? h('div', { class: 'notice' }, state.notice) : null,
      state.status && !state.status.qpdf ? h('div', { class: 'notice' },
        'qpdf is not installed, so encrypted court forms cannot be read. Install it with: winget install QPDF.QPDF') : null));

    var note = h('input', { class: 'input', type: 'text', value: state.note, maxlength: '300',
      placeholder: 'For example: a restraining order, a fingerprint request…', 'aria-label': 'What are you filling out?',
      oninput: function () { state.note = note.value; },
      onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); submitFiles(); } } });
    var n = state.files.length;
    composer.appendChild(h('div', { class: 'panel' }, h('div', { class: 'box' },
      h('div', { class: 'line' }, h('div', { class: 'field' }, note),
        h('button', { class: 'btn primary', type: 'button', disabled: !n || state.busy, onclick: submitFiles },
          state.busy ? 'Sending…' : (n ? 'Submit ' + n + ' PDF' + (n === 1 ? '' : 's') : 'Submit'), icon('send'))),
      h('div', { class: 'label', style: 'margin:8px 2px 0' }, n ? 'Add every form you need filled, then press Submit.' : 'Add at least one PDF to continue.'))));
  }

  function uploadedSummary(s) {
    var names = s.forms.map(function (f) { return f.name; });
    chat.appendChild(user([
      s.userNote ? h('div', null, s.userNote) : null,
      h('div', { style: s.userNote ? 'opacity:.85;margin-top:4px;font-size:.9rem' : '' },
        '📎 ' + names.length + ' PDF' + (names.length === 1 ? '' : 's') + ': ' + names.join(', ')),
    ]));
  }

  function progressList(s, working) {
    var items = s.progress.filter(function (m) { return !/^Stopped:/.test(m); });
    return h('ul', { class: 'steps' }, items.map(function (m, i) {
      var now = working && i === items.length - 1;
      return h('li', { class: now ? 'now' : 'done' }, h('span', { class: 'dot', 'aria-hidden': 'true' }, now ? '' : '✓'), h('span', null, m));
    }));
  }

  function analyzing(s) {
    var working = ['reading', 'designing', 'building'].indexOf(s.stage) >= 0;
    var headline = s.stage === 'designing' ? 'Designing your questions, please wait…'
      : s.stage === 'building' ? 'Putting your interview together…'
      : 'Analyzing forms, please wait…';
    if (working) {
      chat.appendChild(bot(
        h('p', { class: 'q' }, headline),
        progressList(s, true),
        h('div', { class: 'typing', 'aria-label': 'Working' }, h('i'), h('i'), h('i'))));
    } else if (s.stage === 'waiting' || s.stage === 'ready' || s.stage === 'filled') {
      chat.appendChild(bot(
        h('p', { class: 'q' }, 'I read your forms.'),
        h('details', { class: 'tech', style: 'margin-top:4px' }, h('summary', null, 'What I did'), progressList(s, false))));
    }
  }

  function waiting(s) {
    var fields = s.forms.reduce(function (n, f) { return n + (f.fields || 0); }, 0);
    var pages = s.forms.reduce(function (n, f) { return n + (f.pages || 0); }, 0);
    chat.appendChild(bot(
      h('p', null, 'I found ' + fields + ' boxes to fill across ' + pages + ' page' + (pages === 1 ? '' : 's') + '. '
        + 'The next step designs the questions I will ask you, and that needs Claude. There is no API key set up yet, so pick one of these:'),
      h('div', { class: 'ways' },
        h('div', { class: 'way' },
          h('h4', null, 'Ask Claude Code on this computer'),
          h('p', null, 'In Claude Code, say ', h('code', null, 'process the DocHelper inbox'), '. I will notice when it is done and carry on by myself.'),
          h('div', { class: 'waiting-line' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), 'Watching for Claude’s answer…')),
        h('div', { class: 'way' },
          h('h4', null, 'Or hand the package to Claude yourself'),
          h('p', null, 'Download the package, give it to Claude and ask for ', h('code', null, 'prompt_package_output.zip'), ', then upload what it gives you.'),
          h('div', { class: 'btns' },
            h('a', { class: 'btn secondary small', href: API + '/sessions/' + s.id + '/package', download: 'prompt_package_input.zip' },
              icon('download'), 'Download package'),
            h('button', { class: 'btn primary small', type: 'button', onclick: function () { responseInput.click(); } },
              icon('upload'), 'Upload response')))),
      (state.notice || s.error) ? h('div', { class: 'notice bad' }, state.notice || s.error) : null,
      problemsBlock(s)));
  }

  function problemsBlock(s) {
    if (!s.problems || !s.problems.length) return null;
    return h('details', { class: 'tech' },
      h('summary', null, 'Technical details (' + s.problems.length + ')'),
      h('ul', null, s.problems.map(function (p) { return h('li', null, p); })));
  }

  function failed(s) {
    chat.appendChild(bot(
      h('p', { class: 'q' }, 'Something went wrong.'),
      h('div', { class: 'notice bad' }, s.error || 'Unknown error'),
      h('p', { class: 'sub' }, 'You can upload a corrected response, or start over with your PDFs.'),
      h('div', { class: 'btns', style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' },
        h('button', { class: 'btn primary small', type: 'button', onclick: function () { responseInput.click(); } }, icon('upload'), 'Upload response'),
        h('button', { class: 'btn secondary small', type: 'button', onclick: startOver }, 'Start over'))));
  }

  function interviewIntro(s, iv) {
    var titles = iv.forms.map(function (f) { return f.title; });
    chat.appendChild(bot(
      h('p', null, 'All set. I have ' + titles.length + ' form' + (titles.length === 1 ? '' : 's') + ' ready:'),
      h('ul', { style: 'margin:0 0 8px;padding-left:18px' }, titles.map(function (t, i) {
        var f = iv.forms[i];
        return h('li', null, t, f.includeWhen ? h('span', { class: 'sub' }, ' (only if your answers call for it)') : null);
      })),
      h('p', null, 'I will ask one question at a time. You can go back or change any answer.'),
      s.notes ? h('details', { class: 'tech' }, h('summary', null, 'Notes about these forms'), h('div', { style: 'white-space:pre-wrap;margin-top:6px' }, s.notes)) : null,
      problemsBlock(s)));
  }

  function conversation(s, iv) {
    var w = state.walk = InterviewWalk.walk(iv.forms, state.answers);
    var lastForm = null; var lastSection = null;
    w.path.forEach(function (p) {
      var q = p.question;
      if (q.form !== lastForm || q.section !== lastSection) {
        chat.appendChild(divider(q.formTitle, q.section));
        lastForm = q.form; lastSection = q.section;
      }
      chat.appendChild(bot(
        h('p', { class: 'q' }, q.text),
        q.subtitle ? h('div', { class: 'sub' }, q.subtitle) : null));
      if (p.answered) {
        chat.appendChild(user(display(q, state.answers[q.id]), function () { unanswer(q.id); }));
      }
    });

    // progress: answered questions against the top-level questions of forms known to be in
    var answered = w.path.filter(function (p) { return p.answered; }).length;
    var total = 0;
    iv.forms.forEach(function (f) { if (w.activeForms.indexOf(f.form) >= 0) total += f.interview.questions.length; });
    setProgress(w.done ? 1 : answered / Math.max(answered + 1, total));

    if (!w.done && state.checking === w.current.id) {
      chat.appendChild(user(display(w.current, drafts[w.current.id])));
      chat.appendChild(bot(h('p', { class: 'sub', style: 'margin:0' }, 'Checking it fits on the form…'),
        h('div', { class: 'typing', 'aria-label': 'Checking' }, h('i'), h('i'), h('i'))));
      return;
    }
    if (!w.done && state.tooLong && state.tooLong.qid === w.current.id) {
      tooLong(w.current, state.tooLong);
      return;
    }
    if (!w.done) {
      composer.appendChild(h('div', { class: 'panel' }, widget(w.current)));
      var focusable = composer.querySelector('input:not([type=checkbox]), textarea, select, .chip');
      // At once, not on a timer: a fast typist's next keystrokes land here.
      if (focusable && window.matchMedia('(pointer: fine)').matches) focusable.focus({ preventScroll: true });
      return;
    }

    if (s.stage !== 'filled') {
      chat.appendChild(bot(
        h('p', { class: 'q' }, 'That is everything I need.'),
        h('p', null, 'I will fill in ' + w.activeForms.length + ' form' + (w.activeForms.length === 1 ? '' : 's') + ' with your answers. You can still scroll up and change anything first.'),
        state.fillError ? h('div', { class: 'notice bad' }, state.fillError) : null));
      composer.appendChild(h('div', { class: 'panel' }, h('div', { class: 'box' },
        h('div', { class: 'line' },
          h('button', { class: 'btn primary', type: 'button', style: 'flex:1', disabled: state.busy, onclick: fillForms },
            state.busy ? 'Filling your forms…' : 'Fill my forms', icon('check'))),
        tools(null))));
      return;
    }
    results(s);
  }

  /**
   * The answer is longer than its box. Say so, with the limit, and offer a
   * version that fits; the person takes it or writes their own.
   */
  function tooLong(q, t) {
    var r = t.result;
    var forms = r.issues.length ? r.issues[0].forms : (r.forms || []);
    var where = forms.length ? forms.join(' and ') : 'the form';
    chat.appendChild(user(display(q, t.answer)));

    var writeOwn = function () {
      var limits = {};
      r.issues.forEach(function (i) { limits[i.slot] = i.limit; });
      state.limits[q.id] = limits;
      drafts[q.id] = t.answer;
      state.tooLong = null;
      render();
    };

    if (!r.issues.length) {
      chat.appendChild(bot(
        h('p', { class: 'q' }, 'That is too long to fit on ' + where + '.'),
        h('p', null, 'It shares a box with answers you gave earlier, and together they do not fit. Please make it shorter.')));
      composer.appendChild(h('div', { class: 'panel' }, h('div', { class: 'box' },
        h('div', { class: 'line' }, h('button', { class: 'btn primary', type: 'button', style: 'flex:1', onclick: writeOwn }, 'Write a shorter answer')),
        tools(q))));
      return;
    }

    var one = r.issues.length === 1 && !r.issues[0].label;
    var all = function (how) { return r.issues.every(function (i) { return i.source === how; }); };
    var parts = [
      h('p', { class: 'q' }, 'That is too long to fit on ' + where + '.'),
    ];
    r.issues.forEach(function (i) {
      parts.push(h('p', null,
        (one ? 'The box' : 'The box for ' + i.label.toLowerCase()) + ' holds about ' + i.limit.toLocaleString()
        + ' characters (roughly ' + i.words + ' words), and ' + (one ? 'your answer' : 'yours') + ' is '
        + i.length.toLocaleString() + '.'));
    });
    parts.push(h('p', null, all('rewritten')
      ? 'Here is a shorter version that keeps the important details:'
      : all('sentences')
        ? 'Here is a version that fits. It keeps your own words up to the last full sentence that fits, so check that nothing important was left out:'
        : 'Here is a version that fits. It keeps as much of your answer as the box holds, so check that nothing important was left out:'));
    r.issues.forEach(function (i) {
      parts.push(h('blockquote', { class: 'suggestion' },
        one ? null : h('div', { class: 'label', style: 'margin:0 0 4px' }, i.label),
        i.suggestion || h('span', { class: 'skipped' }, '(nothing fits in this box)')));
    });
    chat.appendChild(bot(parts));

    composer.appendChild(h('div', { class: 'panel' }, h('div', { class: 'box' },
      h('div', { class: 'line two' },
        h('button', { class: 'btn primary', type: 'button', onclick: function () { answer(q, r.suggested); } }, 'Use this version'),
        h('button', { class: 'btn secondary', type: 'button', onclick: writeOwn }, 'Write my own')),
      tools(q))));
  }

  function results(s) {
    var files = s.filled || [];
    chat.appendChild(bot(
      h('p', { class: 'q' }, 'Here are your filled forms.'),
      h('div', { class: 'results' }, files.map(function (f) {
        var url = API + '/sessions/' + s.id + '/files/' + encodeURIComponent(f.file);
        return h('div', { class: 'result' },
          h('div', { class: 'icon' }, icon('check')),
          h('div', { class: 'meta' }, h('strong', null, f.title),
            h('small', null, f.valuesSent + ' answers filled in' + (f.didNotFit.length ? ' · ' + f.didNotFit.length + ' too long for its box' : ''))),
          h('div', { class: 'btns' },
            h('a', { class: 'btn secondary small', href: url, target: '_blank', rel: 'noopener' }, 'View'),
            h('a', { class: 'btn primary small', href: url + '?download=1', download: f.file }, icon('download'), 'Download')));
      })),
      files.length > 1 ? h('p', { style: 'margin-top:10px' },
        h('a', { class: 'btn secondary small', href: API + '/sessions/' + s.id + '/download-all' }, icon('download'), 'Download all (zip)')) : null,
      h('p', { class: 'sub', style: 'margin-top:12px' },
        'Read every page before you file. Sign by hand where the form asks for a signature.')));
    composer.appendChild(h('div', { class: 'panel' }, h('div', { class: 'box' },
      h('div', { class: 'tools', style: 'margin:0' },
        tools(null),
        h('button', { class: 'btn secondary small', type: 'button', onclick: startOver }, 'Fill out different forms')))));
  }

  /* ---------------------------------------------------------------- */
  /* render                                                            */
  /* ---------------------------------------------------------------- */

  function render() {
    chat.innerHTML = '';
    composer.innerHTML = '';
    setProgress(null);
    var s = state.session;
    startOverBtn.hidden = !s;
    if (state.status) {
      modePill.hidden = false;
      modePill.textContent = state.status.mode === 'api' ? 'Claude API' : 'Prompt package mode';
      modePill.title = state.status.mode === 'api'
        ? 'Designing interviews with ' + state.status.model
        : 'No API key yet: interviews are designed by handing a package to Claude';
    }
    if (!s) { landing(); scrollDown(); return; }

    uploadedSummary(s);
    analyzing(s);
    if (s.stage === 'waiting') waiting(s);
    else if (s.stage === 'error') failed(s);
    else if ((s.stage === 'ready' || s.stage === 'filled') && state.interview) {
      interviewIntro(s, state.interview);
      conversation(s, state.interview);
    }
    scrollDown();
  }

  responseInput.addEventListener('change', function () {
    var f = responseInput.files[0];
    responseInput.value = '';
    uploadResponse(f);
  });
  startOverBtn.addEventListener('click', startOver);

  api('/status').then(function (st) { state.status = st; }).catch(function () { /* shown as no pill */ }).then(function () {
    var id = new URL(location.href).searchParams.get('session') || recall('dochelper:last');
    if (id) resume(id); else render();
  });
}());
