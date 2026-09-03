const { PDFDocument, PDFName, PDFNumber, PDFString, PDFDict, PDFArray } = require('pdf-lib');

function findPageByRef(pdfDoc, pageRef) {
  if (!pageRef) return null;
  const target = pageRef.toString();
  for (const page of pdfDoc.getPages()) {
    if (page.ref && page.ref.toString() === target) return page;
  }
  return null;
}

function readRect(rectRef, context) {
  const rectObj = context.lookup(rectRef);
  const nums = rectObj.asArray().map((n) => n.asNumber());
  return {
    x: nums[0],
    y: nums[1],
    width: nums[2] - nums[0],
    height: nums[3] - nums[1],
  };
}

function makeUniqueCheckboxName(baseName, index, optionValue) {
  const safeOption = String(optionValue || '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const suffix = safeOption ? `${index + 1}_${safeOption}` : String(index + 1);
  return `${baseName}__${suffix}`;
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
    const kidsRef = entry.get(PDFName.of('Kids'));
    if (kidsRef) {
      const kidRemoved = removeFieldRefFromTree(context, kidsRef, targetRef);
      removed = removed || kidRemoved;
    }
  }

  return removed;
}

function removeAnnotFromPage(context, pageRef, annotRef) {
  const page = context.lookup(pageRef);
  if (!(page instanceof PDFDict)) return;

  const annotsRef = page.get(PDFName.of('Annots'));
  if (!annotsRef) return;

  const annots = context.lookup(annotsRef);
  if (!(annots instanceof PDFArray)) return;

  const target = annotRef.toString();
  for (let i = annots.size() - 1; i >= 0; i--) {
    if (annots.get(i).toString() === target) {
      annots.remove(i);
    }
  }
}

/**
 * Split PDF radio groups into individual checkbox fields with unique names.
 * Old radio widget annotations are removed from each page so extraction
 * only sees the new uniquely named checkboxes.
 */
async function deduplicatePdfFieldNames(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const form = pdfDoc.getForm();
  const context = pdfDoc.context;
  const acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));
  const acroForm = context.lookup(acroFormRef);
  const fieldsRef = acroForm.get(PDFName.of('Fields'));

  const radioFields = form.getFields().filter((f) => f.constructor.name === 'PDFRadioGroup');
  const renames = [];

  for (const radioField of radioFields) {
    const baseName = radioField.getName();
    const dict = radioField.acroField.dict;
    const kidsRef = dict.get(PDFName.of('Kids'));
    if (!kidsRef) continue;

    const kidsArr = context.lookup(kidsRef);
    const options = typeof radioField.getOptions === 'function' ? radioField.getOptions() : [];

    for (let i = 0; i < kidsArr.size(); i++) {
      const widgetRef = kidsArr.get(i);
      const widget = context.lookup(widgetRef);
      const rectRef = widget.get(PDFName.of('Rect'));
      const pageRef = widget.get(PDFName.of('P'));
      if (!rectRef || !pageRef) continue;

      const page = findPageByRef(pdfDoc, pageRef);
      if (!page) continue;

      const rect = readRect(rectRef, context);
      const optionValue = options[i] || `option_${i + 1}`;
      const newName = makeUniqueCheckboxName(baseName, i, optionValue);

      const checkbox = form.createCheckBox(newName);
      checkbox.addToPage(page, rect);
      removeAnnotFromPage(context, pageRef, widgetRef);

      renames.push({
        originalName: baseName,
        newName,
        option: optionValue,
        type: 'radio-split',
      });
    }

    removeFieldRefFromTree(context, fieldsRef, radioField.acroField.ref);
  }

  const saved = await pdfDoc.save();
  return {
    bytes: saved,
    renames,
    splitRadioGroups: radioFields.length,
  };
}

module.exports = { deduplicatePdfFieldNames, makeUniqueCheckboxName };
