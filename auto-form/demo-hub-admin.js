/**
 * Demo Form Hub admin: add / edit / delete hub entries (PDF + HTML uploads).
 */
const fs = require('fs');
const path = require('path');

const HUB_DIR = path.join(__dirname, 'public', 'Auto-Form-Creator', 'Demo_form_hub');
const FORMS_DIR = path.join(HUB_DIR, 'forms');
const MANIFEST_PATH = path.join(HUB_DIR, 'manifest.json');

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {
      title: 'Demo Form Hub',
      subtitle: 'Stamp-approved AI pipeline outputs — frozen review copies',
      updatedAt: new Date().toISOString(),
      forms: [],
    };
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function writeManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();
  if (!Array.isArray(manifest.forms)) manifest.forms = [];
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}

function slugify(input) {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base || `form-${Date.now()}`;
}

function uniqueSlug(desired, existingIds) {
  let slug = slugify(desired);
  if (!existingIds.has(slug)) return slug;
  let n = 2;
  while (existingIds.has(`${slug}-${n}`)) n += 1;
  return `${slug}-${n}`;
}

function getUploadedFile(files, key) {
  if (!files || !files[key]) return null;
  const file = Array.isArray(files[key]) ? files[key][0] : files[key];
  return file && file.data && file.data.length ? file : null;
}

function assertExtension(file, allowed, label) {
  const name = String(file.name || '').toLowerCase();
  const ok = allowed.some((ext) => name.endsWith(ext));
  if (!ok) {
    throw new Error(`${label} must be one of: ${allowed.join(', ')}`);
  }
}

async function saveUpload(file, destPath) {
  await file.mv(destPath);
}

function formDir(slug) {
  return path.join(FORMS_DIR, slug);
}

function buildEntry(slug, {
  title,
  description = '',
  hasPdf,
  hasHtmlAll,
  hasHtmlOne,
  sections = 0,
  questions = 0,
  approvedAt,
  hasFieldMap,
  hasFormConfig,
}) {
  return {
    id: slug,
    title: title || slug,
    description: description || '',
    sections: Number(sections) || 0,
    questions: Number(questions) || 0,
    approvedAt: approvedAt || new Date().toISOString().slice(0, 10),
    sourcePdf: hasPdf ? `forms/${slug}/source.pdf` : null,
    formHtml: hasHtmlAll ? `forms/${slug}/form-all-at-once.html` : null,
    formHtmlOneAtATime: hasHtmlOne ? `forms/${slug}/form-one-at-a-time.html` : null,
    formConfig: hasFormConfig ? `forms/${slug}/form_config.json` : null,
    fieldMap: hasFieldMap ? `forms/${slug}/field_map.json` : null,
  };
}

function entryFromDisk(slug, title, description, prev = {}) {
  const dir = formDir(slug);
  const hasPdf = fs.existsSync(path.join(dir, 'source.pdf'));
  const hasHtmlAll = fs.existsSync(path.join(dir, 'form-all-at-once.html'));
  const hasHtmlOne = fs.existsSync(path.join(dir, 'form-one-at-a-time.html'));
  const hasFieldMap = fs.existsSync(path.join(dir, 'field_map.json'));
  const hasFormConfig = fs.existsSync(path.join(dir, 'form_config.json'));
  return buildEntry(slug, {
    title: title || prev.title || slug,
    description: description != null ? description : (prev.description || ''),
    hasPdf,
    hasHtmlAll,
    hasHtmlOne,
    sections: prev.sections || 0,
    questions: prev.questions || 0,
    approvedAt: prev.approvedAt,
    hasFieldMap,
    hasFormConfig,
  });
}

function rmDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

async function handleCreateEntry(req, res) {
  try {
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const pdf = getUploadedFile(req.files, 'pdf');
    const htmlAll = getUploadedFile(req.files, 'htmlAll');
    const htmlOne = getUploadedFile(req.files, 'htmlOne');

    if (!pdf) {
      return res.status(400).json({ success: false, error: 'PDF upload is required' });
    }
    if (!htmlAll && !htmlOne) {
      return res.status(400).json({
        success: false,
        error: 'Upload at least one HTML file (all-at-once and/or one-at-a-time)',
      });
    }

    assertExtension(pdf, ['.pdf'], 'PDF');
    if (htmlAll) assertExtension(htmlAll, ['.html', '.htm'], 'All-at-once HTML');
    if (htmlOne) assertExtension(htmlOne, ['.html', '.htm'], 'One-at-a-time HTML');

    const manifest = readManifest();
    const existingIds = new Set((manifest.forms || []).map((f) => f.id));
    const slug = uniqueSlug(req.body?.id || title, existingIds);
    const dir = formDir(slug);
    fs.mkdirSync(dir, { recursive: true });

    await saveUpload(pdf, path.join(dir, 'source.pdf'));
    if (htmlAll) await saveUpload(htmlAll, path.join(dir, 'form-all-at-once.html'));
    if (htmlOne) await saveUpload(htmlOne, path.join(dir, 'form-one-at-a-time.html'));

    const entry = entryFromDisk(slug, title, description, {
      approvedAt: new Date().toISOString().slice(0, 10),
    });
    manifest.forms = Array.isArray(manifest.forms) ? manifest.forms : [];
    manifest.forms.push(entry);
    writeManifest(manifest);

    res.json({ success: true, entry, manifest });
  } catch (error) {
    console.error('[demo-hub/create]', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create hub entry' });
  }
}

async function handleUpdateEntry(req, res) {
  try {
    const slug = String(req.params.slug || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Form id is required' });
    }

    const manifest = readManifest();
    const idx = (manifest.forms || []).findIndex((f) => f.id === slug);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: `No hub entry "${slug}"` });
    }

    const dir = formDir(slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const prev = manifest.forms[idx];
    const title = req.body?.title != null ? String(req.body.title).trim() : prev.title;
    const description = req.body?.description != null
      ? String(req.body.description).trim()
      : prev.description;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const pdf = getUploadedFile(req.files, 'pdf');
    const htmlAll = getUploadedFile(req.files, 'htmlAll');
    const htmlOne = getUploadedFile(req.files, 'htmlOne');

    if (pdf) {
      assertExtension(pdf, ['.pdf'], 'PDF');
      await saveUpload(pdf, path.join(dir, 'source.pdf'));
    }
    if (htmlAll) {
      assertExtension(htmlAll, ['.html', '.htm'], 'All-at-once HTML');
      await saveUpload(htmlAll, path.join(dir, 'form-all-at-once.html'));
    }
    if (htmlOne) {
      assertExtension(htmlOne, ['.html', '.htm'], 'One-at-a-time HTML');
      await saveUpload(htmlOne, path.join(dir, 'form-one-at-a-time.html'));
    }

    // Optional: clear a missing HTML variant when explicitly requested
    if (String(req.body?.clearHtmlAll || '') === '1') {
      const p = path.join(dir, 'form-all-at-once.html');
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (String(req.body?.clearHtmlOne || '') === '1') {
      const p = path.join(dir, 'form-one-at-a-time.html');
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    const entry = entryFromDisk(slug, title, description, prev);
    if (!entry.formHtml && !entry.formHtmlOneAtATime) {
      return res.status(400).json({
        success: false,
        error: 'Entry must keep at least one HTML version',
      });
    }
    if (!entry.sourcePdf) {
      return res.status(400).json({ success: false, error: 'Entry must keep a PDF' });
    }

    manifest.forms[idx] = entry;
    writeManifest(manifest);
    res.json({ success: true, entry, manifest });
  } catch (error) {
    console.error('[demo-hub/update]', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update hub entry' });
  }
}

function handleDeleteEntry(req, res) {
  try {
    const slug = String(req.params.slug || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Form id is required' });
    }

    const manifest = readManifest();
    const before = (manifest.forms || []).length;
    manifest.forms = (manifest.forms || []).filter((f) => f.id !== slug);
    if (manifest.forms.length === before) {
      return res.status(404).json({ success: false, error: `No hub entry "${slug}"` });
    }

    rmDirRecursive(formDir(slug));
    writeManifest(manifest);
    res.json({ success: true, manifest });
  } catch (error) {
    console.error('[demo-hub/delete]', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete hub entry' });
  }
}

module.exports = {
  handleCreateEntry,
  handleUpdateEntry,
  handleDeleteEntry,
  readManifest,
};
