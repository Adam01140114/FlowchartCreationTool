/**
 * Compiles the W-9 reference schema into Flowchart Creation Tool JSON.
 *
 * This is the hand-written W-9 reference interview. For arbitrary schemas use
 * compile-form.js, which infers the interview generically. Both share the
 * layout + circuit-board router in flowchart-engine.js.
 *
 * Usage: node compile-form-schema.js [schema.txt] [out.json]
 */
const fs = require('fs');
const path = require('path');
const engine = require('./flowchart-engine.js');

const {
  Q_W, Q_H, O_W, O_H, CENTER_X,
  OPTION_GAP, BUS, TEXT_GAP, BRANCH_GAP, NODE_GAP,
  HUB_SIZE, MERGE_TRUNK, SPLIT_TRUNK, SPLIT_BUS, JOIN_TRUNK, OUT_SPLIT_MIN,
  SECTION_COLORS,
  fitBox, packRow, separateOverlappingNodes, countNodeOverlaps,
  routeCircuitBoard, isOptionCell, isQuestionCell, questionTypeOf,
  walkOutgoing, slug
} = engine;

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
    if (cell.vertex) {
      cell._pdfName = cell._pdfName ?? '';
      cell._pdfFile = cell._pdfFile ?? '';
      cell._pdfPrice = cell._pdfPrice ?? '';
    }
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
    type: 'dropdown',
    nameId: 'foreign_partners_checkbox',
    section: 2,
    y: foreignJoin.geometry.y + foreignJoin.geometry.height + JOIN_TRUNK
  });
  const foreignOpts = addOptions(foreignPartners, [
    { label: 'Yes', nameId: 'yes' },
    { label: 'No', nameId: 'no' }
  ], 'dropdown', 2);
  funnelInto([taxOpts[3], taxOpts[4], llcOpts[2]], foreignJoin);
  addEdge(foreignJoin.id, foreignPartners.id, 'trunk');

  const mergeHub = addHub(CENTER_X, below(...foreignOpts), 'exempt_merge_hub');
  const exemptGate = addQuestion({
    text: 'Do you have an exempt payee code?',
    type: 'dropdown',
    nameId: 'exempt_payee_provided',
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
  addEdge(mergeHub.id, exemptGate.id, 'trunk');
  const exemptGateOpts = addOptions(exemptGate, [
    { label: 'Yes', nameId: 'yes' },
    { label: 'No', nameId: 'no' }
  ], 'dropdown', 3);

  const exemptPayee = addQuestion({
    text: 'What is your exempt payee code?',
    type: 'text',
    nameId: 'exempt_payee_code',
    section: 3,
    x: centerUnder(exemptGateOpts[0], Q_W),
    y: below(...exemptGateOpts)
  });
  addEdge(exemptGateOpts[0].id, exemptPayee.id);

  const fatcaGate = addQuestion({
    text: 'Do you have a FATCA exemption code?',
    type: 'dropdown',
    nameId: 'fatca_provided',
    section: 3,
    y: below(exemptPayee, exemptGateOpts[1])
  });
  addEdge(exemptGateOpts[1].id, fatcaGate.id);
  addEdge(exemptPayee.id, fatcaGate.id);
  const fatcaGateOpts = addOptions(fatcaGate, [
    { label: 'Yes', nameId: 'yes' },
    { label: 'No', nameId: 'no' }
  ], 'dropdown', 3);

  const fatca = addQuestion({
    text: 'What is your FATCA exemption code?',
    type: 'text',
    nameId: 'fatca_code',
    section: 3,
    x: centerUnder(fatcaGateOpts[0], Q_W),
    y: below(...fatcaGateOpts)
  });
  addEdge(fatcaGateOpts[0].id, fatca.id);

  y = below(fatca, fatcaGateOpts[1]);
  const address = addQuestion({
    text: 'What is your street address?',
    type: 'text',
    nameId: 'address',
    section: 4,
    y
  });
  addEdge(fatcaGateOpts[1].id, address.id);
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

  const defaultPdfProperties = {
    pdfName: schema.defaultPdfProperties?.pdfName || schema.pdfDisplayName || 'W-9 Form',
    pdfFile: schema.defaultPdfProperties?.pdfFile || schema.pdfFile || 'W9.pdf',
    pdfPrice: String(schema.defaultPdfProperties?.pdfPrice ?? schema.pdfPrice ?? '0')
  };

  return {
    formName: schema.formTitle || 'Form',
    edgeStyle: 'curved',
    cells,
    sectionPrefs,
    groups: [],
    defaultPdfProperties
  };
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
