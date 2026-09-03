const { PDFDocument, PDFName, PDFString, PDFDict, PDFArray } = require('pdf-lib');

function readPartialName(dict) {
  if (!(dict instanceof PDFDict)) return null;
  const t = dict.get(PDFName.of('T'));
  return t ? t.decodeText() : null;
}

function removeFieldRefFromTree(context, fieldsArrayRef, targetRef) {
  if (!fieldsArrayRef) return false;
  const fieldsArray = context.lookup(fieldsArrayRef);
  let removed = false;

  for (let i = fieldsArray.size() - 1; i >= 0; i--) {
    const entryRef = fieldsArray.get(i);
    if (entryRef.toString() === targetRef.toString()) {
      fieldsArray.remove(i);
      removed = true;
      continue;
    }

    const entry = context.lookup(entryRef);
    if (entry instanceof PDFDict) {
      const kidsRef = entry.get(PDFName.of('Kids'));
      if (kidsRef) {
        const kidRemoved = removeFieldRefFromTree(context, kidsRef, targetRef);
        removed = removed || kidRemoved;
      }
    }
  }

  return removed;
}

function detachFieldHierarchy(context, dict, isRoot = true) {
  if (!(dict instanceof PDFDict)) return;
  if (isRoot) {
    dict.delete(PDFName.of('Parent'));
  }
  const kidsRef = dict.get(PDFName.of('Kids'));
  if (!kidsRef) return;
  const kids = context.lookup(kidsRef);
  for (let i = 0; i < kids.size(); i++) {
    detachFieldHierarchy(context, context.lookup(kids.get(i)), false);
  }
}

function resolveWidgetFieldName(context, widgetDict) {
  const parts = [];
  let current = widgetDict;
  let depth = 0;
  while (current instanceof PDFDict && depth < 20) {
    const t = readPartialName(current);
    if (t) parts.unshift(t);
    const parentRef = current.get(PDFName.of('Parent'));
    if (!parentRef) break;
    current = context.lookup(parentRef);
    depth += 1;
  }
  if (parts.length === 1) return parts[0];
  return parts.join('.');
}

function ensureWidgetOnPage(context, pageNode, widgetRef) {
  let annotsRef = pageNode.get(PDFName.of('Annots'));
  let annots;
  if (annotsRef) {
    annots = context.lookup(annotsRef);
  } else {
    annots = PDFArray.withContext(context);
    pageNode.set(PDFName.of('Annots'), context.register(annots));
  }

  const target = widgetRef.toString();
  for (let i = 0; i < annots.size(); i++) {
    if (annots.get(i).toString() === target) return;
  }
  annots.push(widgetRef);
}

function syncCheckboxWidgets(context, pdfDoc, fieldRef, fieldName) {
  const fieldDict = context.lookup(fieldRef);
  const kidsRef = fieldDict.get(PDFName.of('Kids'));
  if (!kidsRef) return;

  const kids = context.lookup(kidsRef);
  for (let i = 0; i < kids.size(); i++) {
    const widgetRef = kids.get(i);
    const widgetDict = context.lookup(widgetRef);
    widgetDict.delete(PDFName.of('T'));
    widgetDict.set(PDFName.of('Parent'), fieldRef);

    const pageRef = widgetDict.get(PDFName.of('P'));
    if (!pageRef) continue;

    for (const page of pdfDoc.getPages()) {
      if (page.ref && page.ref.toString() === pageRef.toString()) {
        ensureWidgetOnPage(context, page.node, widgetRef);
        break;
      }
    }
  }
}

function ensureTopLevelField(context, acroFormFieldsRef, fieldRef) {
  removeFieldRefFromTree(context, acroFormFieldsRef, fieldRef);

  const fieldsArray = context.lookup(acroFormFieldsRef);
  fieldsArray.push(fieldRef);

  detachFieldHierarchy(context, context.lookup(fieldRef), true);
}

function isPushButtonWidget(dict) {
  const ft = dict.get(PDFName.of('FT'));
  if (!ft || ft.toString() !== '/Btn') return false;
  const ff = dict.get(PDFName.of('Ff'));
  if (!ff) return false;
  return (ff.asNumber() & (1 << 16)) !== 0;
}

function cleanupPageWidgets(pdfDoc, keptNames) {
  const context = pdfDoc.context;

  for (const page of pdfDoc.getPages()) {
    const annotsRef = page.node.get(PDFName.of('Annots'));
    if (!annotsRef) continue;

    const annots = context.lookup(annotsRef);
    for (let i = annots.size() - 1; i >= 0; i--) {
      const dict = context.lookup(annots.get(i));
      const subtype = dict.get(PDFName.of('Subtype'));
      if (!subtype || subtype.toString() !== '/Widget') continue;

      if (isPushButtonWidget(dict)) {
        annots.remove(i);
        continue;
      }

      const fieldName = resolveWidgetFieldName(context, dict);
      const partialName = readPartialName(dict);

      if ((partialName && keptNames.has(partialName)) || (fieldName && keptNames.has(fieldName))) {
        if (partialName && keptNames.has(partialName)) {
          dict.delete(PDFName.of('Parent'));
        }
        continue;
      }

      // Drop orphaned legacy widgets (dropdowns, signature, etc.) left from XFA hierarchy.
      annots.remove(i);
    }

    if (annots.size() === 0) {
      page.node.delete(PDFName.of('Annots'));
    }
  }
}

function stripXfaFromAcroForm(acroForm) {
  if (acroForm instanceof PDFDict && acroForm.has(PDFName.of('XFA'))) {
    acroForm.delete(PDFName.of('XFA'));
  }
}

function rebuildAcroFormFields(context, acroForm, keptFieldRefs) {
  const newFields = PDFArray.withContext(context);
  const seen = new Set();

  for (const ref of keptFieldRefs) {
    const key = ref.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    newFields.push(ref);
    detachFieldHierarchy(context, context.lookup(ref), true);
  }

  acroForm.set(PDFName.of('Fields'), context.register(newFields));
}

/**
 * Rename AcroForm fields using field_config.json and flatten to top-level /T names.
 * Removes legacy XFA hierarchy containers so Adobe Acrobat shows clean field names.
 */
async function sanitizePdfFields(pdfBytes, fieldConfig) {
  if (!fieldConfig?.fields?.length) {
    throw new Error('fieldConfig.fields is required');
  }

  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const form = pdfDoc.getForm();
  const context = pdfDoc.context;
  const acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));
  const acroForm = context.lookup(acroFormRef);
  const fieldsRef = acroForm.get(PDFName.of('Fields'));

  const renamed = [];
  const skipped = [];
  const failed = [];
  const oldIds = new Set();
  const keptFieldRefs = [];
  const keptNames = new Set();

  // Resolve all field refs before mutating the AcroForm tree. XFA-style PDFs (e.g. IRS W-9)
  // use deep parent/Kids hierarchies; ensureTopLevelField breaks form.getField() for siblings
  // still addressed by their original hierarchical names.
  // Duplicate AcroForm names (multi-widget fields) appear once in pdf-lib — keep first mapping.
  const fieldRefById = new Map();
  const processedIds = new Set();
  for (const mapping of fieldConfig.fields) {
    const { id } = mapping;
    if (!id || fieldRefById.has(id)) continue;
    try {
      fieldRefById.set(id, form.getField(id).acroField.ref);
    } catch (err) {
      failed.push({ id, reason: err.message });
    }
  }

  for (const mapping of fieldConfig.fields) {
    const { id, newName } = mapping;
    if (!id || !newName) {
      failed.push({ id: id || '(missing)', reason: 'missing id or newName' });
      continue;
    }
    if (processedIds.has(id)) {
      skipped.push(id);
      continue;
    }
    processedIds.add(id);

    if (failed.some((entry) => entry.id === id)) {
      continue;
    }

    // Only treat as a "legacy" name when we actually rename away from it.
    if (id !== newName) {
      oldIds.add(id);
    }
    keptNames.add(newName);

    try {
      const fieldRef = fieldRefById.get(id);
      if (!fieldRef) {
        throw new Error(`Field not found: ${id}`);
      }
      const dict = context.lookup(fieldRef);

      ensureTopLevelField(context, fieldsRef, fieldRef);

      if (id !== newName) {
        dict.set(PDFName.of('T'), PDFString.of(newName));
        renamed.push({ from: id, to: newName });
      } else {
        skipped.push(id);
      }

      keptFieldRefs.push(fieldRef);
    } catch (err) {
      failed.push({ id, reason: err.message });
    }
  }

  for (const ref of keptFieldRefs) {
    const dict = context.lookup(ref);
    const fieldName = readPartialName(dict);
    if (fieldName && dict.get(PDFName.of('Kids'))) {
      syncCheckboxWidgets(context, pdfDoc, ref, fieldName);
    }
  }

  stripXfaFromAcroForm(acroForm);
  rebuildAcroFormFields(context, acroForm, keptFieldRefs);
  cleanupPageWidgets(pdfDoc, keptNames);

  acroForm.set(PDFName.of('NeedAppearances'), PDFName.of('true'));

  try {
    form.updateFieldAppearances();
  } catch (_) {
    // best-effort — rich-text fields throw here on some government PDFs
  }

  // Skip appearance refresh on save: pdf-lib throws on rich-text widgets (e.g. Live Scan ORI).
  const saved = await pdfDoc.save({ updateFieldAppearances: false });
  const verifyDoc = await PDFDocument.load(saved, { ignoreEncryption: true });
  const verifyForm = verifyDoc.getForm();
  const verifyNames = verifyForm.getFields().map((f) => f.getName());
  const verifySet = new Set(verifyNames);

  for (const entry of renamed) {
    if (!verifySet.has(entry.to)) {
      throw new Error(`Rename verification failed for ${entry.to}`);
    }
    if (verifySet.has(entry.from)) {
      throw new Error(`Old field name still present after rename: ${entry.from}`);
    }
  }

  const legacyLeft = verifyNames.filter((name) => oldIds.has(name) && !keptNames.has(name));
  if (legacyLeft.length > 0) {
    throw new Error(
      `Sanitized PDF still contains ${legacyLeft.length} original field name(s), e.g. ${legacyLeft[0]}`
    );
  }

  const hierarchicalLeft = verifyNames.filter((name) => name.includes('form1[0]') || name.includes('#subform'));
  if (hierarchicalLeft.length > 0) {
    throw new Error(
      `Sanitized PDF still contains hierarchical field name(s), e.g. ${hierarchicalLeft[0]}`
    );
  }

  return {
    bytes: saved,
    renamedCount: renamed.length,
    skippedCount: skipped.length,
    failed,
    renamed,
    fieldNames: verifyNames,
  };
}

async function handleSanitizePdf(req, res) {
  try {
    if (!req.files || !req.files.pdf) {
      return res.status(400).json({ success: false, error: 'PDF file is required (field name: pdf)' });
    }

    let fieldConfig;
    try {
      fieldConfig = typeof req.body.fieldConfig === 'string'
        ? JSON.parse(req.body.fieldConfig)
        : req.body.fieldConfig;
    } catch (_) {
      return res.status(400).json({ success: false, error: 'Invalid fieldConfig JSON' });
    }

    const result = await sanitizePdfFields(req.files.pdf.data, fieldConfig);

    if (result.failed.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Failed to rename ${result.failed.length} field(s)`,
        failed: result.failed,
      });
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="sanitized.pdf"',
      'X-Renamed-Count': String(result.renamedCount),
      'X-Skipped-Count': String(result.skippedCount),
      'X-Field-Count': String(result.fieldNames.length),
    });
    res.send(Buffer.from(result.bytes));
  } catch (error) {
    console.error('[sanitize-pdf] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sanitize PDF',
    });
  }
}

module.exports = { sanitizePdfFields, handleSanitizePdf };
