const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib');
const { deduplicatePdfFieldNames } = require('./pdf-field-deduplicator');

const execAsync = promisify(exec);

/**
 * Strip the XFA entry from the AcroForm dictionary so AcroForm fields are used.
 */
async function unlockWithPdfLib(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));
  if (acroFormRef) {
    const acroForm = pdfDoc.context.lookup(acroFormRef);
    if (acroForm instanceof PDFDict) {
      acroForm.delete(PDFName.of('XFA'));
    }
  }

  const saved = await pdfDoc.save();
  const verifyDoc = await PDFDocument.load(saved, { ignoreEncryption: true });
  const fieldCount = verifyDoc.getForm().getFields().length;

  return { bytes: saved, fieldCount, method: 'pdf-lib-drop-xfa' };
}

async function runCommand(command) {
  const { stdout, stderr } = await execAsync(command, {
    timeout: 60000,
    maxBuffer: 1024 * 1024 * 20,
  });
  return { stdout, stderr };
}

function commandExists(cmd) {
  const check = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
  return execAsync(check, { timeout: 5000 }).then(() => true).catch(() => false);
}

async function unlockWithPdftk(inputPath, outputPath) {
  const pdftkCmd = process.platform === 'win32' ? 'pdftk' : 'pdftk';
  if (!(await commandExists(pdftkCmd))) {
    throw new Error('pdftk not installed');
  }
  await runCommand(`pdftk "${inputPath}" output "${outputPath}" drop_xfa`);
  const bytes = fs.readFileSync(outputPath);
  const verifyDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const fieldCount = verifyDoc.getForm().getFields().length;
  return { bytes, fieldCount, method: 'pdftk-drop-xfa' };
}

async function unlockWithGhostscript(inputPath, outputPath) {
  const gsCmd = process.platform === 'win32' ? 'gswin64c' : 'gs';
  if (!(await commandExists(gsCmd))) {
    throw new Error('ghostscript not installed');
  }
  await runCommand(
    `"${gsCmd}" -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dNOPAUSE -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`
  );
  const bytes = fs.readFileSync(outputPath);
  const verifyDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const fieldCount = verifyDoc.getForm().getFields().length;
  return { bytes, fieldCount, method: 'ghostscript-pdfwrite' };
}

/**
 * Unlock an XFA/hybrid PDF to a standard AcroForm PDF.
 * @param {Buffer|Uint8Array} pdfBytes
 * @returns {Promise<{ bytes: Uint8Array, fieldCount: number, method: string }>}
 */
async function unlockPdf(pdfBytes) {
  const input = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
  const errors = [];
  let pdfLibFallback = null;
  let unlockMethod = 'pdf-lib-drop-xfa';
  let unlockedBytes = null;

  try {
    const result = await unlockWithPdfLib(input);
    if (result.fieldCount > 0) {
      unlockedBytes = result.bytes;
      unlockMethod = result.method;
    } else {
      pdfLibFallback = result;
      errors.push(`pdf-lib: stripped XFA but pdf-lib detected ${result.fieldCount} fields`);
    }
  } catch (err) {
    errors.push(`pdf-lib: ${err.message}`);
  }

  if (!unlockedBytes) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unlock-pdf-'));
    const inputPath = path.join(tempDir, 'input.pdf');
    const outputPath = path.join(tempDir, 'output.pdf');

    try {
      fs.writeFileSync(inputPath, input);

      try {
        const result = await unlockWithPdftk(inputPath, outputPath);
        if (result.fieldCount > 0) {
          unlockedBytes = result.bytes;
          unlockMethod = result.method;
        } else {
          errors.push(`pdftk: unlocked but found ${result.fieldCount} fields`);
        }
      } catch (err) {
        errors.push(`pdftk: ${err.message}`);
      }

      if (!unlockedBytes) {
        try {
          const result = await unlockWithGhostscript(inputPath, outputPath);
          if (result.fieldCount > 0) {
            unlockedBytes = result.bytes;
            unlockMethod = result.method;
          } else {
            errors.push(`ghostscript: unlocked but found ${result.fieldCount} fields`);
          }
        } catch (err) {
          errors.push(`ghostscript: ${err.message}`);
        }
      }

      if (!unlockedBytes && pdfLibFallback) {
        unlockedBytes = pdfLibFallback.bytes;
        unlockMethod = pdfLibFallback.method;
      }

      if (!unlockedBytes) {
        throw new Error('Could not unlock PDF. ' + errors.join('; '));
      }
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {
        // ignore cleanup errors
      }
    }
  }

  const deduped = await deduplicatePdfFieldNames(unlockedBytes);
  const verifyDoc = await PDFDocument.load(deduped.bytes, { ignoreEncryption: true });
  const fieldCount = verifyDoc.getForm().getFields().length;

  return {
    bytes: deduped.bytes,
    fieldCount,
    method: unlockMethod,
    fieldRenames: deduped.renames,
    splitRadioGroups: deduped.splitRadioGroups,
  };
}

async function handleUnlockPdf(req, res) {
  try {
    if (!req.files || !req.files.pdf) {
      return res.status(400).json({ success: false, error: 'PDF file is required (field name: pdf)' });
    }

    const originalName = req.files.pdf.name || 'document.pdf';
    const result = await unlockPdf(req.files.pdf.data);

    const baseName = path.basename(originalName, path.extname(originalName));
    const outName = `${baseName}_unlocked.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${outName}"`,
      'X-Unlock-Method': result.method,
      'X-Field-Count': String(result.fieldCount),
      'X-Field-Renames': String(result.fieldRenames?.length || 0),
      'X-Split-Radio-Groups': String(result.splitRadioGroups || 0),
    });
    res.send(Buffer.from(result.bytes));
  } catch (error) {
    console.error('[unlock-pdf] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to unlock PDF',
    });
  }
}

async function handlePreparePdfFields(req, res) {
  try {
    if (!req.files || !req.files.pdf) {
      return res.status(400).json({ success: false, error: 'PDF file is required (field name: pdf)' });
    }

    const originalName = req.files.pdf.name || 'document.pdf';
    const deduped = await deduplicatePdfFieldNames(req.files.pdf.data);
    const verifyDoc = await PDFDocument.load(deduped.bytes, { ignoreEncryption: true });
    const fieldCount = verifyDoc.getForm().getFields().length;

    const baseName = path.basename(originalName, path.extname(originalName));
    const outName = `${baseName}_prepared.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${outName}"`,
      'X-Field-Count': String(fieldCount),
      'X-Field-Renames': String(deduped.renames?.length || 0),
      'X-Split-Radio-Groups': String(deduped.splitRadioGroups || 0),
    });
    res.send(Buffer.from(deduped.bytes));
  } catch (error) {
    console.error('[prepare-pdf-fields] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to prepare PDF fields',
    });
  }
}

module.exports = { unlockPdf, handleUnlockPdf, handlePreparePdfFields };
