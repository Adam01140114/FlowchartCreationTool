const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef } = require('pdf-lib');
const { deduplicatePdfFieldNames } = require('./pdf-field-deduplicator');

const execAsync = promisify(exec);

/**
 * Count AcroForm fields, returning null if the form tree cannot be walked.
 *
 * getFields() throws on a PDF whose field refs do not resolve, so callers that
 * only want a sanity-check count must not treat that as a fatal error.
 */
async function countFormFields(bytes) {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return doc.getForm().getFields().length;
  } catch (_) {
    return null;
  }
}

/**
 * Drop field refs that do not resolve to a dictionary.
 *
 * A damaged cross-reference table leaves the AcroForm Fields array pointing at
 * objects pdf-lib could not parse. Those refs look up as undefined and make
 * getFields() throw, so prune them before saving. Returns the number removed.
 */
function pruneDanglingFieldRefs(context, arrayRef, seen = new Set()) {
  if (!arrayRef) return 0;
  const array = context.lookup(arrayRef);
  if (!(array instanceof PDFArray)) return 0;

  let pruned = 0;
  for (let i = array.size() - 1; i >= 0; i--) {
    const entryRef = array.get(i);
    const entry = context.lookup(entryRef);
    if (!(entry instanceof PDFDict)) {
      array.remove(i);
      pruned += 1;
      continue;
    }

    // Kids can loop back up the tree on malformed files; only walk each once.
    if (entryRef instanceof PDFRef) {
      const key = entryRef.toString();
      if (seen.has(key)) continue;
      seen.add(key);
    }

    pruned += pruneDanglingFieldRefs(context, entry.get(PDFName.of('Kids')), seen);
  }

  return pruned;
}

/**
 * Strip the XFA entry from the AcroForm dictionary so AcroForm fields are used.
 */
async function unlockWithPdfLib(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));
  let prunedRefs = 0;
  if (acroFormRef) {
    const acroForm = pdfDoc.context.lookup(acroFormRef);
    if (acroForm instanceof PDFDict) {
      acroForm.delete(PDFName.of('XFA'));
      prunedRefs = pruneDanglingFieldRefs(pdfDoc.context, acroForm.get(PDFName.of('Fields')));
    }
  }

  const saved = await pdfDoc.save();
  const fieldCount = await countFormFields(saved);

  return { bytes: saved, fieldCount: fieldCount || 0, method: 'pdf-lib-drop-xfa', prunedRefs };
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
  const fieldCount = await countFormFields(bytes);
  return { bytes, fieldCount: fieldCount || 0, method: 'pdftk-drop-xfa' };
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
  const fieldCount = await countFormFields(bytes);
  return { bytes, fieldCount: fieldCount || 0, method: 'ghostscript-pdfwrite' };
}

let qpdfPathPromise = null;

/**
 * Locate the qpdf binary: QPDF_PATH, then PATH, then the default install dirs.
 *
 * The Windows installer drops qpdf under a versioned directory it does not add
 * to PATH, so fall back to scanning the usual Program Files locations.
 */
function resolveQpdfPath() {
  if (qpdfPathPromise) return qpdfPathPromise;

  qpdfPathPromise = (async () => {
    if (process.env.QPDF_PATH && fs.existsSync(process.env.QPDF_PATH)) {
      return process.env.QPDF_PATH;
    }
    if (await commandExists('qpdf')) return 'qpdf';

    for (const dir of ['C:/Program Files', 'C:/Program Files (x86)']) {
      let entries;
      try {
        entries = fs.readdirSync(dir);
      } catch (_) {
        continue;
      }
      for (const entry of entries) {
        if (!/^qpdf/i.test(entry)) continue;
        const candidate = path.join(dir, entry, 'bin', 'qpdf.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
    return null;
  })();

  return qpdfPathPromise;
}

async function isEncryptedPdf(bytes) {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return doc.isEncrypted;
  } catch (_) {
    return false;
  }
}

/**
 * Decrypt a PDF with qpdf.
 *
 * pdf-lib cannot read encrypted PDFs at all - ignoreEncryption only suppresses
 * the error and leaves every stream undecipherable, so the catalog, page tree
 * and AcroForm all resolve to undefined. Decrypting first is the only way the
 * rest of the pipeline can see the form.
 */
async function decryptWithQpdf(pdfBytes) {
  const qpdf = await resolveQpdfPath();
  if (!qpdf) {
    throw new Error(
      'PDF is encrypted and qpdf was not found. Install it with ' +
      '"winget install qpdf.qpdf", or set QPDF_PATH to the qpdf executable.'
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qpdf-decrypt-'));
  const inputPath = path.join(tempDir, 'input.pdf');
  const outputPath = path.join(tempDir, 'output.pdf');

  try {
    fs.writeFileSync(inputPath, pdfBytes);
    // An empty user password covers the usual "permissions only" encryption
    // that government forms ship with.
    try {
      await runCommand(`"${qpdf}" --decrypt --password= "${inputPath}" "${outputPath}"`);
    } catch (err) {
      // qpdf exits 3 on recoverable warnings but still writes a usable file.
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw err;
    }
    return fs.readFileSync(outputPath);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {
      // ignore cleanup errors
    }
  }
}

/**
 * Unlock an XFA/hybrid PDF to a standard AcroForm PDF.
 * @param {Buffer|Uint8Array} pdfBytes
 * @returns {Promise<{ bytes: Uint8Array, fieldCount: number, method: string }>}
 */
async function unlockPdf(pdfBytes) {
  let input = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
  const errors = [];
  let decrypted = false;
  let pdfLibFallback = null;
  let unlockMethod = 'pdf-lib-drop-xfa';
  let unlockedBytes = null;
  let prunedRefs = 0;

  // Must run before anything else: every later step needs readable objects.
  if (await isEncryptedPdf(input)) {
    console.log('[unlock-pdf] Encrypted PDF detected, decrypting with qpdf');
    input = await decryptWithQpdf(input);
    decrypted = true;
  }

  try {
    const result = await unlockWithPdfLib(input);
    prunedRefs = result.prunedRefs;
    if (result.prunedRefs > 0) {
      console.warn(`[unlock-pdf] Pruned ${result.prunedRefs} unresolvable field ref(s) from a damaged xref table`);
    }
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

  // Deduplication walks the whole field tree; on a file that is still partly
  // malformed, keep the unlocked bytes rather than failing the whole request.
  let deduped;
  try {
    deduped = await deduplicatePdfFieldNames(unlockedBytes);
  } catch (err) {
    console.warn('[unlock-pdf] Skipping field dedupe:', err.message);
    deduped = { bytes: unlockedBytes, renames: [], splitRadioGroups: 0 };
  }

  const fieldCount = await countFormFields(deduped.bytes);

  return {
    bytes: deduped.bytes,
    fieldCount: fieldCount || 0,
    method: unlockMethod,
    decrypted,
    prunedRefs,
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
      'X-Pruned-Refs': String(result.prunedRefs || 0),
      'X-Decrypted': String(!!result.decrypted),
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
