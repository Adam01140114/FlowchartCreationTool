const { PDFDocument, StandardFonts } = require('pdf-lib');

function shouldCheck(v) {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  const s = String(v).trim().toLowerCase();
  return s === 'on' || s === 'true' || s === 'yes' || s === '1' || s === 'checked';
}

function mapRadioValue(field, value) {
  try {
    const options = field.getOptions();
    const valueStr = String(value).trim();

    if (options.includes(valueStr)) {
      return valueStr;
    }

    if (valueStr === 'on' || valueStr === 'true' || valueStr === '1') {
      const yesOption = options.find((opt) =>
        opt.toLowerCase().includes('yes')
        || opt.toLowerCase().includes('true')
        || opt.toLowerCase().includes('1')
      );
      if (yesOption) return yesOption;
      if (options.length > 0) return options[0];
    }

    if (valueStr === 'off' || valueStr === 'false' || valueStr === '0') {
      const noOption = options.find((opt) =>
        opt.toLowerCase().includes('no')
        || opt.toLowerCase().includes('false')
        || opt.toLowerCase().includes('0')
      );
      if (noOption) return noOption;
    }

    if (valueStr.includes(',')) {
      const parts = valueStr.split(',').map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        const mapped = mapRadioValue(field, part);
        if (mapped) return mapped;
      }
    }

    const lowerValue = valueStr.toLowerCase();
    const match = options.find((opt) => opt.toLowerCase() === lowerValue);
    if (match) return match;

    return null;
  } catch (error) {
    console.warn(`mapRadioValue failed for ${field.getName()}:`, error.message);
    return null;
  }
}

async function fillPdfForm(pdfBytes, formBody) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

  form.getFields().forEach((field) => {
    const key = field.getName();
    const value = formBody[key];

    if (value === undefined) return;

    try {
      switch (field.constructor.name) {
        case 'PDFCheckBox':
          shouldCheck(value) ? field.check() : field.uncheck();
          break;

        case 'PDFRadioGroup': {
          const radioValue = mapRadioValue(field, value);
          if (radioValue) field.select(radioValue);
          break;
        }

        case 'PDFDropdown':
          field.select(String(value));
          break;

        case 'PDFTextField':
          field.setText(String(value));
          field.updateAppearances(helv);
          break;

        case 'PDFSignature':
          break;

        default:
          if (typeof field.setText === 'function') {
            field.setText(String(value));
            if (typeof field.updateAppearances === 'function') {
              field.updateAppearances(helv);
            }
          }
          break;
      }
    } catch (error) {
      console.error(`Error processing field ${key}:`, error.message);
    }
  });

  return pdfDoc.save();
}

module.exports = {
  fillPdfForm,
  shouldCheck,
  mapRadioValue,
};
