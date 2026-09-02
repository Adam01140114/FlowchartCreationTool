/**
 * Compiles a compact form schema into Flowchart Creation Tool JSON
 * with circuit-board orthogonal routing (wires stay in lanes and
 * go around nodes instead of through them).
 *
 * Usage: node compile-form-schema.js
 */
const fs = require('fs');
const path = require('path');

const SECTION_COLORS = [
  'hsl(0, 100%, 80%)',
  'hsl(30, 100%, 80%)',
  'hsl(120, 100%, 80%)',
  'hsl(180, 100%, 80%)',
  'hsl(240, 100%, 80%)',
  'hsl(280, 100%, 80%)',
  'hsl(320, 100%, 80%)'
];

const Q_W = 300;
const Q_H = 96;
const O_W = 168;
const O_H = 80;
const CENTER_X = 760;
const OPTION_GAP = 22;
const BUS = 80;
const TEXT_GAP = 170;
const BRANCH_GAP = 120;
const NODE_GAP = 56;
const HUB_SIZE = 10;
const MERGE_TRUNK = 80;
const SPLIT_TRUNK = 40;
const SPLIT_BUS = 56;
const JOIN_TRUNK = 48;
const OUT_SPLIT_MIN = 3;
const EDGE_STYLE = 'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0;';
const FUNNEL_STYLE = EDGE_STYLE + 'endArrow=none;startArrow=none;';
const GRID = 8;
const NODE_PAD = 6;
const CHANNEL_MARGIN = 112;
const WIRE_PENALTY = 28;
const TURN_PENALTY = 28;
const NEAR_NODE_PENALTY = 6;
const UP_PENALTY = 10;

function wrapLineCount(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const lines = [];
  let cur = '';
  words.forEach((word) => {
    if (word.length > maxChars) {
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      return;
    }
    const trial = cur ? `${cur} ${word}` : word;
    if (trial.length <= maxChars) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  });
  if (cur) lines.push(cur);
  return Math.max(1, lines.length);
}

function fitBox(text, { minW, minH, maxW }) {
  const charW = 10;
  const lineH = 24;
  const padX = 44;
  const padY = 48;
  const longest = String(text).split(/\s+/).reduce((m, w) => Math.max(m, w.length), 1);
  let width = Math.max(minW, Math.min(maxW, longest * charW + padX));
  let lines = wrapLineCount(text, Math.max(4, Math.floor((width - padX) / charW)));
  while (lines > 2 && width < maxW) {
    width = Math.min(maxW, width + 24);
    lines = wrapLineCount(text, Math.max(4, Math.floor((width - padX) / charW)));
  }
  return {
    width: Math.round(width),
    height: Math.round(Math.max(minH, padY + lines * lineH))
  };
}

function uniquePoints(points) {
  const out = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev.x - p.x) > 0.5 || Math.abs(prev.y - p.y) > 0.5) {
      out.push({ x: Math.round(p.x), y: Math.round(p.y) });
    }
  }
  return out;
}

function cornersOnly(points) {
  const cleaned = uniquePoints(points);
  if (cleaned.length < 3) return cleaned;
  const out = [cleaned[0]];
  for (let i = 1; i < cleaned.length - 1; i++) {
    const a = out[out.length - 1];
    const b = cleaned[i];
    const c = cleaned[i + 1];
    const col = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5;
    const row = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5;
    if (!col && !row) out.push(b);
  }
  out.push(cleaned[cleaned.length - 1]);
  return uniquePoints(out);
}

function segmentHitsRect(p, q, r) {
  const minX = Math.min(p.x, q.x);
  const maxX = Math.max(p.x, q.x);
  const minY = Math.min(p.y, q.y);
  const maxY = Math.max(p.y, q.y);
  return maxX >= r.x && minX <= r.x + r.w && maxY >= r.y && minY <= r.y + r.h;
}

function boxesOverlap(a, b, gap) {
  const g = gap == null ? 0 : gap;
  return a.x < b.x + b.width + g
    && a.x + a.width + g > b.x
    && a.y < b.y + b.height + g
    && a.y + a.height + g > b.y;
}

function packRow(preferredXs, widths, gap) {
  const xs = preferredXs.map((x) => x);
  for (let i = 1; i < xs.length; i++) {
    xs[i] = Math.max(xs[i], xs[i - 1] + widths[i - 1] + gap);
  }
  const prefMin = Math.min(...preferredXs);
  const prefMax = Math.max(...preferredXs.map((x, i) => x + widths[i]));
  const newMin = xs[0];
  const newMax = xs[xs.length - 1] + widths[widths.length - 1];
  const shift = (prefMin + prefMax) / 2 - (newMin + newMax) / 2;
  return xs.map((x) => Math.round(x + shift));
}

function separateOverlappingNodes(cells) {
  const verts = cells.filter((c) => c.vertex);
  let moved = 0;
  for (let iter = 0; iter < 80; iter++) {
    let changed = false;
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        const gap = requiredGap(verts[i], verts[j]);
        const A = verts[i].geometry;
        const B = verts[j].geometry;
        if (!boxesOverlap(A, B, gap)) continue;
        const overlapY = Math.min(A.y + A.height, B.y + B.height) - Math.max(A.y, B.y);
        const overlapX = Math.min(A.x + A.width, B.x + B.width) - Math.max(A.x, B.x);
        const sameRow = overlapY >= Math.min(A.height, B.height) * 0.45;
        if (sameRow || overlapY >= overlapX) {
          const left = A.x <= B.x ? A : B;
          const right = left === A ? B : A;
          const need = left.x + left.width + gap - right.x;
          if (need > 0) {
            right.x = Math.round(right.x + need);
            changed = true;
            moved += 1;
          }
        } else {
          const top = A.y <= B.y ? A : B;
          const bot = top === A ? B : A;
          const need = top.y + top.height + gap - bot.y;
          if (need > 0) {
            bot.y = Math.round(bot.y + need);
            changed = true;
            moved += 1;
          }
        }
      }
    }
    if (!changed) break;
  }
  return moved;
}

function nodeKind(cell) {
  const style = cell.style || '';
  if (style.indexOf('nodeType=question') !== -1) return 'question';
  if (style.indexOf('nodeType=options') !== -1) return 'option';
  if (style.indexOf('nodeType=end') !== -1) return 'end';
  if (style.indexOf('nodeType=mergeHub') !== -1) return 'hub';
  return 'other';
}

function requiredGap(a, b) {
  const ka = nodeKind(a);
  const kb = nodeKind(b);
  if (ka === 'option' && kb === 'option') return 16;
  if (ka === 'hub' || kb === 'hub') return 20;
  return NODE_GAP;
}

function countNodeOverlaps(cells, gap) {
  const verts = cells.filter((c) => c.vertex);
  const hits = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (boxesOverlap(verts[i].geometry, verts[j].geometry, gap)) {
        hits.push([verts[i]._nameId || verts[i].value, verts[j]._nameId || verts[j].value]);
      }
    }
  }
  return hits;
}

function compile(schema) {
  let nextId = 2;
  let questionCounter = 1;
  const cells = [];
  const sectionPrefs = {};
  const pendingEdges = [];

  function id() {
    let assigned = nextId++;
    while (assigned === 1 || assigned === 19) {
      assigned = nextId++;
    }
    return String(assigned);
  }

  function sectionStyle(section) {
    if (!sectionPrefs[String(section)]) {
      sectionPrefs[String(section)] = {
        borderColor: SECTION_COLORS[(section - 1) % SECTION_COLORS.length],
        name: `Section ${section}`
      };
    }
    return sectionPrefs[String(section)].borderColor;
  }

  function nameSection(num, name) {
    sectionStyle(num);
    sectionPrefs[String(num)].name = name;
  }

  function questionStyle(type, nameId, section) {
    const stroke = sectionStyle(section);
    return `shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=question;spacing=16;fontSize=16;align=center;verticalAlign=middle;questionType=${type};nodeId=${nameId};section=${section};fillColor=#80bfff;fontColor=#070665;strokeColor=${stroke}`;
  }

  function optionStyle(type, section) {
    const stroke = sectionStyle(section);
    return `shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=options;questionType=${type};spacing=16;fontSize=16;align=center;verticalAlign=middle;section=${section};fillColor=#ffffff;fontColor=#070665;strokeColor=${stroke}`;
  }

  function addVertex(cell) {
    cells.push(cell);
    return cell;
  }

  function addEdge(source, target, kind) {
    pendingEdges.push({ source, target, kind: kind || 'normal' });
  }

  function addHub(cx, y, nameId) {
    return addVertex({
      id: id(),
      value: '',
      geometry: { x: Math.round(cx - HUB_SIZE / 2), y, width: HUB_SIZE, height: HUB_SIZE },
      style: 'ellipse;whiteSpace=wrap;html=1;nodeType=mergeHub;fillColor=#4a6fa5;strokeColor=#4a6fa5;',
      vertex: true,
      edge: false,
      source: null,
      target: null,
      _nameId: nameId || 'merge_hub'
    });
  }

  function funnelInto(sources, target) {
    sources.forEach((src) => addEdge(src.id, target.id, 'funnel'));
  }

  function addQuestion({ text, type, nameId, section, x, y }) {
    const box = fitBox(text, { minW: Q_W, minH: Q_H, maxW: Q_W });
    const qid = id();
    return addVertex({
      id: qid,
      value: text,
      geometry: { x: x ?? (CENTER_X - box.width / 2), y, width: box.width, height: box.height },
      style: questionStyle(type, nameId, section),
      vertex: true,
      edge: false,
      source: null,
      target: null,
      _textboxes: null,
      _questionText: text,
      _questionId: String(questionCounter++),
      _nameId: nameId,
      _placeholder: ''
    });
  }

  function addOptions(question, options, type, section) {
    const boxes = options.map((opt) => {
      const label = typeof opt === 'string' ? opt : opt.label;
      return {
        label,
        nameId: typeof opt === 'string' ? slug(opt) : opt.nameId,
        ...fitBox(label, { minW: O_W, minH: O_H, maxW: 260 })
      };
    });
    const rowH = Math.max(...boxes.map((b) => b.height));
    const total = boxes.reduce((sum, b) => sum + b.width, 0) + (boxes.length - 1) * OPTION_GAP;
    const qg = question.geometry;
    const qcx = qg.x + qg.width / 2;
    const useSplit = options.length >= OUT_SPLIT_MIN;
    let sourceId = question.id;
    let y;
    if (useSplit) {
      const hubY = qg.y + qg.height + SPLIT_TRUNK;
      const hub = addHub(qcx, hubY, `${question._nameId || 'q'}_split_hub`);
      addEdge(question.id, hub.id, 'trunk');
      sourceId = hub.id;
      y = hubY + HUB_SIZE + SPLIT_BUS;
    } else {
      y = qg.y + qg.height + BUS;
    }
    let startX = qcx - total / 2;
    const created = [];
    boxes.forEach((box) => {
      const oid = id();
      created.push(addVertex({
        id: oid,
        value: box.label,
        geometry: { x: Math.round(startX), y, width: box.width, height: rowH },
        style: optionStyle(type, section),
        vertex: true,
        edge: false,
        source: null,
        target: null,
        _nameId: box.nameId
      }));
      addEdge(sourceId, oid, 'fanout');
      startX += box.width + OPTION_GAP;
    });
    return created;
  }

  function below(...nodes) {
    return Math.max(...nodes.map((n) => n.geometry.y + n.geometry.height)) + BRANCH_GAP;
  }

  function centerUnder(node, width) {
    return node.geometry.x + node.geometry.width / 2 - width / 2;
  }

  // --- W-9 flowchart from field_config.txt ---
  nameSection(1, 'Identification');
  nameSection(2, 'Federal tax classification');
  nameSection(3, 'Exemptions');
  nameSection(4, 'Address');
  nameSection(5, 'Optional information');
  nameSection(6, 'Taxpayer identification number');

  let y = 60;

  const taxpayerName = addQuestion({
    text: 'What is your name?',
    type: 'text',
    nameId: 'taxpayer_name',
    section: 1,
    y
  });
  y += TEXT_GAP;

  const hasBusiness = addQuestion({
    text: 'Is your business name different from the name above?',
    type: 'dropdown',
    nameId: 'has_business_name',
    section: 1,
    y
  });
  addEdge(taxpayerName.id, hasBusiness.id);
  const hasBusinessOpts = addOptions(hasBusiness, [
    { label: 'Yes', nameId: 'yes' },
    { label: 'No', nameId: 'no' }
  ], 'dropdown', 1);

  const businessName = addQuestion({
    text: 'What is your business name?',
    type: 'text',
    nameId: 'business_name',
    section: 1,
    x: centerUnder(hasBusinessOpts[0], Q_W),
    y: below(...hasBusinessOpts)
  });
  addEdge(hasBusinessOpts[0].id, businessName.id);

  const taxJoin = addHub(CENTER_X, below(businessName, hasBusinessOpts[1]), 'tax_classification_join');
  const taxClass = addQuestion({
    text: 'What is your federal tax classification?',
    type: 'dropdown',
    nameId: 'tax_classification',
    section: 2,
    y: taxJoin.geometry.y + taxJoin.geometry.height + JOIN_TRUNK
  });
  funnelInto([hasBusinessOpts[1], businessName], taxJoin);
  addEdge(taxJoin.id, taxClass.id, 'trunk');
  const taxOpts = addOptions(taxClass, [
    { label: 'Individual/sole proprietor', nameId: 'tax_classification_individual' },
    { label: 'C corporation', nameId: 'tax_classification_corporation' },
    { label: 'S corporation', nameId: 'tax_classification_s_corporation' },
    { label: 'Partnership', nameId: 'tax_classification_partnership' },
    { label: 'Trust/estate', nameId: 'tax_classification_trust_estate' },
    { label: 'LLC', nameId: 'tax_classification_llc' },
    { label: 'Other', nameId: 'tax_classification_other_checkbox' }
  ], 'dropdown', 2);

  const branchY = below(...taxOpts);
  const [llcX, otherX] = packRow(
    [centerUnder(taxOpts[5], Q_W), centerUnder(taxOpts[6], Q_W)],
    [Q_W, Q_W],
    NODE_GAP
  );

  const llcCode = addQuestion({
    text: 'What is the LLC tax classification code?',
    type: 'dropdown',
    nameId: 'tax_classification_code',
    section: 2,
    x: llcX,
    y: branchY
  });
  addEdge(taxOpts[5].id, llcCode.id);
  const llcOpts = addOptions(llcCode, [
    { label: 'C (C corporation)', nameId: 'llc_c' },
    { label: 'S (S corporation)', nameId: 'llc_s' },
    { label: 'P (Partnership)', nameId: 'llc_p' }
  ], 'dropdown', 2);

  const otherClass = addQuestion({
    text: 'What is the other tax classification?',
    type: 'text',
    nameId: 'tax_classification_other',
    section: 2,
    x: otherX,
    y: branchY
  });
  addEdge(taxOpts[6].id, otherClass.id);

  const foreignJoin = addHub(CENTER_X, below(...llcOpts, otherClass), 'foreign_partners_join');
  const foreignPartners = addQuestion({
    text: 'Does this entity have foreign partners, owners, or beneficiaries?',
    type: 'checkbox',
    nameId: 'foreign_partners_checkbox',
    section: 2,
    y: foreignJoin.geometry.y + foreignJoin.geometry.height + JOIN_TRUNK
  });
  const foreignOpts = addOptions(foreignPartners, [
    { label: 'Yes', nameId: 'yes' },
    { label: 'No', nameId: 'no' }
  ], 'checkbox', 2);
  funnelInto([taxOpts[3], taxOpts[4], llcOpts[2]], foreignJoin);
  addEdge(foreignJoin.id, foreignPartners.id, 'trunk');

  const mergeHub = addHub(CENTER_X, below(...foreignOpts), 'exempt_merge_hub');
  const exemptPayee = addQuestion({
    text: 'What is your exempt payee code, if any?',
    type: 'text',
    nameId: 'exempt_payee_code',
    section: 3,
    y: mergeHub.geometry.y + mergeHub.geometry.height + MERGE_TRUNK
  });
  funnelInto([
    taxOpts[0],
    taxOpts[1],
    taxOpts[2],
    llcOpts[0],
    llcOpts[1],
    otherClass,
    ...foreignOpts
  ], mergeHub);
  addEdge(mergeHub.id, exemptPayee.id, 'trunk');

  y = below(exemptPayee);
  const fatca = addQuestion({
    text: 'What is your FATCA exemption code, if any?',
    type: 'text',
    nameId: 'fatca_code',
    section: 3,
    y
  });
  addEdge(exemptPayee.id, fatca.id);

  y = below(fatca);
  const address = addQuestion({
    text: 'What is your street address?',
    type: 'text',
    nameId: 'address',
    section: 4,
    y
  });
  addEdge(fatca.id, address.id);

  y = below(address);
  const cityStateZip = addQuestion({
    text: 'What is your city, state, and ZIP code?',
    type: 'text',
    nameId: 'city_state_zip',
    section: 4,
    y
  });
  addEdge(address.id, cityStateZip.id);

  y = below(cityStateZip);
  const requesterGate = addQuestion({
    text: "Do you want to provide the requester's name and address?",
    type: 'dropdown',
    nameId: 'requester_name_provided',
    section: 5,
    y
  });
  addEdge(cityStateZip.id, requesterGate.id);
  const requesterOpts = addOptions(requesterGate, [
    { label: 'Yes', nameId: 'yes' },
    { label: 'No', nameId: 'no' }
  ], 'dropdown', 5);

  const requesterName = addQuestion({
    text: "What is the requester's name and address?",
    type: 'text',
    nameId: 'optional_requester_name',
    section: 5,
    x: centerUnder(requesterOpts[0], Q_W),
    y: below(...requesterOpts)
  });
  addEdge(requesterOpts[0].id, requesterName.id);

  const accountGate = addQuestion({
    text: 'Do you want to provide an account number?',
    type: 'dropdown',
    nameId: 'account_number_provided',
    section: 5,
    y: below(requesterName, requesterOpts[1])
  });
  addEdge(requesterOpts[1].id, accountGate.id);
  addEdge(requesterName.id, accountGate.id);
  const accountOpts = addOptions(accountGate, [
    { label: 'Yes', nameId: 'yes' },
    { label: 'No', nameId: 'no' }
  ], 'dropdown', 5);

  const accountNumber = addQuestion({
    text: 'What is the account number?',
    type: 'text',
    nameId: 'account_number',
    section: 5,
    x: centerUnder(accountOpts[0], Q_W),
    y: below(...accountOpts)
  });
  addEdge(accountOpts[0].id, accountNumber.id);

  const tinType = addQuestion({
    text: 'Will you provide a Social Security Number or an Employer Identification Number?',
    type: 'dropdown',
    nameId: 'tin_type',
    section: 6,
    y: below(accountNumber, accountOpts[1])
  });
  addEdge(accountOpts[1].id, tinType.id);
  addEdge(accountNumber.id, tinType.id);
  const tinOpts = addOptions(tinType, [
    { label: 'Social Security Number', nameId: 'ssn' },
    { label: 'Employer Identification Number', nameId: 'ein' }
  ], 'dropdown', 6);

  const tinRowY = below(...tinOpts);
  const [ssnX, einX] = packRow(
    [centerUnder(tinOpts[0], Q_W), centerUnder(tinOpts[1], Q_W)],
    [Q_W, Q_W],
    NODE_GAP
  );
  const tinSsn = addQuestion({
    text: 'What is your Social Security Number?',
    type: 'text',
    nameId: 'tin_ssn',
    section: 6,
    x: ssnX,
    y: tinRowY
  });
  addEdge(tinOpts[0].id, tinSsn.id);

  const tinEin = addQuestion({
    text: 'What is your Employer Identification Number?',
    type: 'text',
    nameId: 'tin_ein',
    section: 6,
    x: einX,
    y: tinRowY
  });
  addEdge(tinOpts[1].id, tinEin.id);

  const nameRowY = below(tinSsn, tinEin);
  const nameForSsn = addQuestion({
    text: 'What name should be used for the SSN?',
    type: 'text',
    nameId: 'name_for_ssn',
    section: 6,
    x: tinSsn.geometry.x,
    y: nameRowY
  });
  addEdge(tinSsn.id, nameForSsn.id);

  const nameForEin = addQuestion({
    text: 'What name should be used for the EIN?',
    type: 'text',
    nameId: 'name_for_ein',
    section: 6,
    x: tinEin.geometry.x,
    y: nameRowY
  });
  addEdge(tinEin.id, nameForEin.id);

  const additionalName = addQuestion({
    text: 'Is there any additional name information to include?',
    type: 'text',
    nameId: 'additional_name_info',
    section: 6,
    y: below(nameForSsn, nameForEin)
  });
  addEdge(nameForSsn.id, additionalName.id);
  addEdge(nameForEin.id, additionalName.id);

  const endNode = addVertex({
    id: id(),
    value: 'End',
    geometry: { x: CENTER_X - 60, y: below(additionalName), width: 120, height: 60 },
    style: 'shape=roundRect;rounded=1;arcSize=20;whiteSpace=wrap;html=1;nodeType=end;fillColor=#CCCCCC;fontColor=#000000;spacing=12;fontSize=16;',
    vertex: true,
    edge: false,
    source: null,
    target: null
  });
  addEdge(additionalName.id, endNode.id);

  const nudged = separateOverlappingNodes(cells);
  const leftover = countNodeOverlaps(cells, 0);
  console.log('node gap nudges', nudged, 'remaining overlaps', leftover.length);
  if (leftover.length) {
    leftover.forEach((pair) => console.warn('overlap', pair[0], pair[1]));
  }

  routeCircuitBoard(cells, pendingEdges);

  return {
    formName: schema.formTitle || 'Form',
    edgeStyle: 'curved',
    cells,
    sectionPrefs,
    groups: {}
  };
}

function routeCircuitBoard(cells, pendingEdges) {
  const vertices = cells.filter((c) => c.vertex);
  const byId = Object.fromEntries(vertices.map((v) => [v.id, v]));
  const rects = vertices.map((c) => {
    const g = c.geometry;
    return {
      id: c.id,
      x: g.x,
      y: g.y,
      w: g.width,
      h: g.height,
      l: g.x - NODE_PAD,
      r: g.x + g.width + NODE_PAD,
      t: g.y - NODE_PAD,
      b: g.y + g.height + NODE_PAD,
      cx: g.x + g.width / 2
    };
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  rects.forEach((r) => {
    minX = Math.min(minX, r.l);
    maxX = Math.max(maxX, r.r);
    minY = Math.min(minY, r.t);
    maxY = Math.max(maxY, r.b);
  });
  minX -= CHANNEL_MARGIN;
  maxX += CHANNEL_MARGIN;
  minY -= GRID * 4;
  maxY += GRID * 4;

  const originX = Math.floor(minX / GRID) * GRID;
  const originY = Math.floor(minY / GRID) * GRID;
  const cols = Math.ceil((maxX - originX) / GRID) + 2;
  const rows = Math.ceil((maxY - originY) / GRID) + 2;
  const wireHeat = new Uint16Array(cols * rows);
  const nearNode = new Uint8Array(cols * rows);

  function at(gx, gy) {
    return gy * cols + gx;
  }

  function toGrid(x, y) {
    return [
      Math.max(0, Math.min(cols - 1, Math.round((x - originX) / GRID))),
      Math.max(0, Math.min(rows - 1, Math.round((y - originY) / GRID)))
    ];
  }

  function toWorld(gx, gy) {
    return { x: originX + gx * GRID, y: originY + gy * GRID };
  }

  function insidePadded(x, y, r) {
    return x >= r.l && x <= r.r && y >= r.t && y <= r.b;
  }

  rects.forEach((r) => {
    const x0 = Math.floor((r.l - GRID - originX) / GRID);
    const x1 = Math.ceil((r.r + GRID - originX) / GRID);
    const y0 = Math.floor((r.t - GRID - originY) / GRID);
    const y1 = Math.ceil((r.b + GRID - originY) / GRID);
    for (let gy = y0; gy <= y1; gy++) {
      if (gy < 0 || gy >= rows) continue;
      for (let gx = x0; gx <= x1; gx++) {
        if (gx < 0 || gx >= cols) continue;
        const p = toWorld(gx, gy);
        if (!insidePadded(p.x, p.y, r)) nearNode[at(gx, gy)] = 1;
      }
    }
  });

  function blocked(gx, gy, ignore) {
    const p = toWorld(gx, gy);
    const half = GRID / 2 + 1;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (ignore.has(r.id)) continue;
      if (p.x + half >= r.l && p.x - half <= r.r && p.y + half >= r.t && p.y - half <= r.b) {
        return true;
      }
    }
    return false;
  }

  function findOpen(gx, gy, ignore) {
    if (!blocked(gx, gy, ignore)) return [gx, gy];
    for (let rad = 1; rad <= 12; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.abs(dx) !== rad && Math.abs(dy) !== rad) continue;
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (!blocked(nx, ny, ignore)) return [nx, ny];
        }
      }
    }
    return [gx, gy];
  }

  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  function astar(sx, sy, tx, ty, ignore) {
    let [sgx, sgy] = findOpen(...toGrid(sx, sy), ignore);
    let [tgx, tgy] = findOpen(...toGrid(tx, ty), ignore);
    const startKey = sgy * cols + sgx;
    const goalKey = tgy * cols + tgx;
    const gScore = new Float64Array(cols * rows);
    gScore.fill(Infinity);
    gScore[startKey] = 0;
    const parent = new Int32Array(cols * rows);
    parent.fill(-1);
    const cameDir = new Int8Array(cols * rows);
    cameDir.fill(-1);

    const heap = [];
    function hPush(key, f, dir) {
      heap.push(key, f, dir);
      let i = heap.length - 3;
      while (i > 0) {
        const p = Math.floor((i / 3 - 1)) * 3;
        if (heap[p + 1] <= heap[i + 1]) break;
        const k = heap[i];
        const fv = heap[i + 1];
        const d = heap[i + 2];
        heap[i] = heap[p];
        heap[i + 1] = heap[p + 1];
        heap[i + 2] = heap[p + 2];
        heap[p] = k;
        heap[p + 1] = fv;
        heap[p + 2] = d;
        i = p;
      }
    }
    function hPop() {
      const key = heap[0];
      const dir = heap[2];
      const last = heap.length - 3;
      heap[0] = heap[last];
      heap[1] = heap[last + 1];
      heap[2] = heap[last + 2];
      heap.length = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 3;
        const r = l + 3;
        if (l >= heap.length) break;
        let s = l;
        if (r < heap.length && heap[r + 1] < heap[l + 1]) s = r;
        if (heap[i + 1] <= heap[s + 1]) break;
        const k = heap[i];
        const fv = heap[i + 1];
        const d = heap[i + 2];
        heap[i] = heap[s];
        heap[i + 1] = heap[s + 1];
        heap[i + 2] = heap[s + 2];
        heap[s] = k;
        heap[s + 1] = fv;
        heap[s + 2] = d;
        i = s;
      }
      return [key, dir];
    }

    const heur = (gx, gy) => (Math.abs(gx - tgx) + Math.abs(gy - tgy)) * GRID;
    hPush(startKey, heur(sgx, sgy), -1);
    const maxIters = cols * rows * 4;
    const closed = new Uint8Array(cols * rows);
    let iters = 0;
    let found = false;

    while (heap.length && iters++ < maxIters) {
      const [key, dir] = hPop();
      if (closed[key]) continue;
      closed[key] = 1;
      if (key === goalKey) {
        found = true;
        break;
      }
      const gx = key % cols;
      const gy = (key / cols) | 0;
      const currentG = gScore[key];
      for (let d = 0; d < 4; d++) {
        const nx = gx + DIRS[d][0];
        const ny = gy + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (blocked(nx, ny, ignore)) continue;
        const nkey = at(nx, ny);
        let step = GRID + wireHeat[nkey] * WIRE_PENALTY;
        if (nearNode[nkey]) step += NEAR_NODE_PENALTY;
        if (dir !== -1 && dir !== d) step += TURN_PENALTY;
        if (d === 3) step += UP_PENALTY;
        const tentative = currentG + step;
        if (tentative >= gScore[nkey]) continue;
        gScore[nkey] = tentative;
        parent[nkey] = key;
        cameDir[nkey] = d;
        hPush(nkey, tentative + heur(nx, ny), d);
      }
    }

    if (!found) return null;

    const cellsPath = [];
    let cursor = goalKey;
    const guard = cols * rows;
    let hops = 0;
    while (cursor !== -1 && hops++ < guard) {
      cellsPath.push(cursor);
      if (cursor === startKey) break;
      cursor = parent[cursor];
    }
    cellsPath.reverse();
    const pts = cellsPath.map((k) => toWorld(k % cols, (k / cols) | 0));
    pts[0] = { x: Math.round(sx), y: pts[0].y };
    pts[pts.length - 1] = { x: Math.round(tx), y: pts[pts.length - 1].y };
    const smoothed = smoothOrthogonal(cornersOnly(pts), ignore);
    return { points: smoothed, cellsPath: rasterize(smoothed, [sgx, sgy], [tgx, tgy]) };
  }

  function sampleClear(a, b, ignore, heatLimit) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    const n = Math.max(1, Math.round(dist / GRID));
    for (let i = 0; i <= n; i++) {
      const x = a.x + (dx * i) / n;
      const y = a.y + (dy * i) / n;
      const [gx, gy] = toGrid(x, y);
      if (blocked(gx, gy, ignore)) return false;
      if (wireHeat[at(gx, gy)] > heatLimit) return false;
    }
    return true;
  }

  function manhattanVia(a, b, ignore) {
    const hv = { x: b.x, y: a.y };
    const vh = { x: a.x, y: b.y };
    if (sampleClear(a, hv, ignore, 8) && sampleClear(hv, b, ignore, 8)) return [hv];
    if (sampleClear(a, vh, ignore, 8) && sampleClear(vh, b, ignore, 8)) return [vh];
    return null;
  }

  function smoothOrthogonal(points, ignore) {
    if (points.length < 2) return points;
    const out = [];
    let i = 0;
    while (i < points.length) {
      out.push(points[i]);
      if (i === points.length - 1) break;
      let best = i + 1;
      let via = null;
      for (let j = points.length - 1; j > i + 1; j--) {
        const candidate = manhattanVia(points[i], points[j], ignore);
        if (candidate) {
          best = j;
          via = candidate;
          break;
        }
      }
      if (via && via.length && (Math.abs(via[0].x - points[i].x) > 0.5 || Math.abs(via[0].y - points[i].y) > 0.5)) {
        if (Math.abs(via[0].x - points[best].x) > 0.5 || Math.abs(via[0].y - points[best].y) > 0.5) {
          out.push(via[0]);
        }
      }
      i = best;
    }
    return cornersOnly(out);
  }

  function rasterize(points, startG, goalG) {
    const keys = [at(startG[0], startG[1])];
    function walk(a, b) {
      let [gx, gy] = toGrid(a.x, a.y);
      const [tx, ty] = toGrid(b.x, b.y);
      keys.push(at(gx, gy));
      while (gx !== tx || gy !== ty) {
        if (gx !== tx) gx += tx > gx ? 1 : -1;
        else if (gy !== ty) gy += ty > gy ? 1 : -1;
        keys.push(at(gx, gy));
      }
    }
    for (let i = 0; i < points.length - 1; i++) walk(points[i], points[i + 1]);
    keys.push(at(goalG[0], goalG[1]));
    return keys;
  }

  function markWire(cellsPath) {
    cellsPath.forEach((key) => {
      wireHeat[key] = Math.min(65000, wireHeat[key] + 3);
      const gx = key % cols;
      const gy = (key / cols) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = gx + DIRS[d][0];
        const ny = gy + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const nkey = at(nx, ny);
        wireHeat[nkey] = Math.min(65000, wireHeat[nkey] + 1);
      }
    });
  }

  function fallbackChannel(src, tgt, sx, sy, tx, ty) {
    const leftX = originX + GRID * 2;
    const rightX = originX + (cols - 3) * GRID;
    const useLeft = sx <= CENTER_X;
    const channelX = useLeft ? leftX : rightX;
    const exitY = sy + GRID * 2;
    const entryY = ty - GRID * 2;
    return cornersOnly([
      { x: sx, y: exitY },
      { x: channelX, y: exitY },
      { x: channelX, y: entryY },
      { x: tx, y: entryY }
    ]);
  }

  function vClear(x, y1, y2, ignore) {
    const a = Math.min(y1, y2);
    const b = Math.max(y1, y2);
    return !vertices.some((v) => {
      if (ignore.has(v.id)) return false;
      const g = v.geometry;
      return x >= g.x - NODE_PAD
        && x <= g.x + g.width + NODE_PAD
        && a < g.y + g.height + NODE_PAD
        && b > g.y - NODE_PAD;
    });
  }

  function hClear(y, x1, x2, ignore) {
    const a = Math.min(x1, x2);
    const b = Math.max(x1, x2);
    return !vertices.some((v) => {
      if (ignore.has(v.id)) return false;
      const g = v.geometry;
      return y >= g.y - NODE_PAD
        && y <= g.y + g.height + NODE_PAD
        && a < g.x + g.width + NODE_PAD
        && b > g.x - NODE_PAD;
    });
  }

  function findDropX(sx, sy, busY, ignore) {
    const candidates = [sx];
    for (let d = GRID; d <= 240; d += GRID) {
      candidates.push(sx - d, sx + d);
    }
    for (let i = 0; i < candidates.length; i++) {
      const x = candidates[i];
      if (vClear(x, sy + GRID, busY, ignore) && hClear(busY, x, sx, ignore)) return x;
    }
    return sx;
  }

  function fanoutPoints(sx, sy, tx, ty) {
    const raw = sy + GRID * 2;
    const busY = Math.round(Math.min(raw, ty - GRID * 2) / GRID) * GRID;
    return cornersOnly([
      { x: sx, y: busY },
      { x: tx, y: busY }
    ]);
  }

  function funnelPoints(sx, sy, tx, ty, ignore) {
    const busY = Math.round((ty - GRID * 2) / GRID) * GRID;
    const dropX = findDropX(sx, sy, busY, ignore);
    return cornersOnly([
      { x: dropX, y: Math.min(sy + GRID * 2, busY) },
      { x: dropX, y: busY },
      { x: tx, y: busY }
    ]);
  }

  const ranked = pendingEdges.slice().sort((a, b) => {
    const order = (k) => (k === 'fanout' ? 1 : k === 'funnel' ? 1 : k === 'trunk' ? 2 : 0);
    const kindDelta = order(a.kind) - order(b.kind);
    if (kindDelta) return kindDelta;
    const sa = byId[a.source];
    const ta = byId[a.target];
    const sb = byId[b.source];
    const tb = byId[b.target];
    if (!sa || !ta || !sb || !tb) return 0;
    const da = Math.abs((sa.geometry.x + sa.geometry.width / 2) - (ta.geometry.x + ta.geometry.width / 2))
      + Math.abs((sa.geometry.y + sa.geometry.height) - ta.geometry.y);
    const db = Math.abs((sb.geometry.x + sb.geometry.width / 2) - (tb.geometry.x + tb.geometry.width / 2))
      + Math.abs((sb.geometry.y + sb.geometry.height) - tb.geometry.y);
    return da - db;
  });

  let routed = 0;
  let failed = 0;
  ranked.forEach(({ source, target, kind }) => {
    const sCell = byId[source];
    const tCell = byId[target];
    if (!sCell || !tCell) return;
    const src = sCell.geometry;
    const tgt = tCell.geometry;
    const sx = src.x + src.width / 2;
    const sy = src.y + src.height;
    const tx = tgt.x + tgt.width / 2;
    const ty = tgt.y;
    const ignore = new Set([source, target]);
    let points = [];
    let style = EDGE_STYLE;

    if (kind === 'funnel') {
      points = funnelPoints(sx, sy, tx, ty, ignore);
      style = FUNNEL_STYLE;
      routed += 1;
    } else if (kind === 'fanout') {
      points = fanoutPoints(sx, sy, tx, ty);
      routed += 1;
    } else if (kind === 'trunk') {
      points = [];
      routed += 1;
    } else {
      const result = astar(sx, sy + GRID, tx, ty - GRID, ignore);
      if (result) {
        points = result.points;
        markWire(result.cellsPath);
        routed += 1;
      } else {
        points = fallbackChannel(src, tgt, sx, sy, tx, ty);
        failed += 1;
      }
    }

    const full = [{ x: sx, y: sy }, ...points, { x: tx, y: ty }];
    const hits = vertices.some((v) => {
      if (v.id === source || v.id === target) return false;
      const g = v.geometry;
      const r = { x: g.x + 2, y: g.y + 2, w: g.width - 4, h: g.height - 4 };
      for (let i = 0; i < full.length - 1; i++) {
        if (segmentHitsRect(full[i], full[i + 1], r)) return true;
      }
      return false;
    });
    if (hits) failed += 1;

    cells.push({
      id: idFromEdge(cells),
      value: '',
      geometry: { x: 0, y: 0, width: 0, height: 0 },
      style,
      vertex: false,
      edge: true,
      source,
      target,
      edgeGeometry: points.length ? { points } : undefined
    });
  });

  console.log('astar routed', routed, 'fallback/collision', failed);
}

function idFromEdge(cells) {
  let max = 1;
  cells.forEach((c) => {
    const n = parseInt(c.id, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  });
  return String(max + 1);
}

function isHubCell(cell) {
  return (cell.style || '').indexOf('nodeType=mergeHub') !== -1;
}

function isQuestionCell(cell) {
  return (cell.style || '').indexOf('nodeType=question') !== -1;
}

function isOptionCell(cell) {
  return (cell.style || '').indexOf('nodeType=options') !== -1;
}

function questionTypeOf(cell) {
  const m = (cell.style || '').match(/questionType=([^;]+)/);
  return m ? m[1] : '';
}

function walkOutgoing(flowchart, startId) {
  const verts = flowchart.cells.filter((c) => c.vertex);
  const edges = flowchart.cells.filter((c) => c.edge);
  const byId = Object.fromEntries(verts.map((v) => [v.id, v]));
  const out = [];
  const seen = new Set();
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift();
    edges.forEach((e) => {
      if (e.source !== cur) return;
      const t = byId[e.target];
      if (!t || seen.has(t.id)) return;
      seen.add(t.id);
      if (isHubCell(t)) queue.push(t.id);
      else out.push(t);
    });
  }
  return out;
}

function auditForm(flowchart) {
  const questions = flowchart.cells.filter((c) => c.vertex && isQuestionCell(c));
  const issues = [];
  console.log('--- form audit (hubs are transparent) ---');
  questions.forEach((q) => {
    const type = questionTypeOf(q);
    const kids = walkOutgoing(flowchart, q.id);
    const opts = kids.filter(isOptionCell).map((o) => o.value);
    const name = q._nameId || q.value;
    console.log(name, type, opts.length ? opts.join(' | ') : '(no options)');
    if ((type === 'dropdown' || type === 'checkbox') && opts.length === 0) {
      issues.push(`${name}: ${type} has no option nodes; Preview Form would fill Yes/No`);
    }
    if (name === 'tax_classification' && opts.length !== 7) {
      issues.push(`tax_classification should have 7 options, got ${opts.length}`);
    }
    if (name === 'tax_classification_code' && opts.length !== 3) {
      issues.push(`tax_classification_code should have C/S/P, got ${opts.length}`);
    }
  });
  if (issues.length) {
    console.warn('FORM AUDIT FAILED');
    issues.forEach((i) => console.warn(' -', i));
  } else {
    console.log('form audit ok');
  }
  return issues;
}

const schemaPath = process.argv[2] || path.join(
  __dirname,
  '_w9_payload',
  'IRS_Form_W-9_Request_for_Taxpayer_Identification_Number_and_Cert',
  'field_config.txt'
);
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const flowchart = compile(schema);
auditForm(flowchart);
const outPath = process.argv[3] || path.join(__dirname, 'w9-flowchart.json');
fs.writeFileSync(outPath, JSON.stringify(flowchart, null, 2));
fs.writeFileSync(path.join(__dirname, '..', 'w9-flowchart.json'), JSON.stringify(flowchart, null, 2));
console.log('Wrote', outPath);
console.log('cells', flowchart.cells.length);
console.log('vertices', flowchart.cells.filter((c) => c.vertex).length);
console.log('edges', flowchart.cells.filter((c) => c.edge).length);
console.log('routed', flowchart.cells.filter((c) => c.edge && c.edgeGeometry && c.edgeGeometry.points).length);
