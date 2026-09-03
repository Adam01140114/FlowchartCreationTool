/**
 * Auto Form Creator — route registration.
 *
 * Mounts the Auto-Form-Creator frontend and its API on an existing Express app.
 * Ported from the FormWiz project's server.js; the handler modules in this
 * folder resolve their data paths from __dirname, which is why the frontend
 * lives at auto-form/public/Auto-Form-Creator (same shape as FormWiz).
 *
 * Missing API keys are non-fatal here: the page and every non-AI endpoint keep
 * working, and the AI generation endpoints report a clear error instead.
 */
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const {
  requireAiApproval, handleArm, handleDisarm, handleStatus
} = require('./ai-approval');

const BODY_LIMIT = '50mb';
const PUBLIC_DIR = path.join(__dirname, 'public');
const FRONTEND_DIR = path.join(PUBLIC_DIR, 'Auto-Form-Creator');

function registerAutoFormRoutes(app, options = {}) {
  const db = options.db || null;
  const openAiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // --- static frontend -------------------------------------------------
  // demo.html uses absolute /Auto-Form-Creator/... URLs, so mount there.
  app.use('/Auto-Form-Creator', express.static(FRONTEND_DIR));
  app.use('/Forms', express.static(path.join(PUBLIC_DIR, 'Forms')));

  // --- large bodies for the generation + publish endpoints --------------
  ['/api/auto-form', '/api/demo-hub', '/api/generate-field-config',
   '/api/generate-form-config', '/api/generate-form-html',
   '/api/generate-form-connections'].forEach((route) => {
    app.use(route, bodyParser.json({ limit: BODY_LIMIT }));
    app.use(route, bodyParser.urlencoded({ extended: true, limit: BODY_LIMIT }));
  });

  const {
    handleUnlockPdf, handlePreparePdfFields
  } = require('./unlock-pdf-handler');
  const {
    createHandleGenerateFieldConfig, createHandleFieldConfigPrompt
  } = require('./field-config-generator');
  const { createHandleFieldConfigPromptZip } = require('./field-config-prompt-zip');
  const {
    createHandleFormConnectionsPromptZip
  } = require('./form-connections-prompt-zip');
  const { handleSanitizePdf } = require('./pdf-field-sanitizer');
  const { createHandleGenerateFormConfig } = require('./form-config-generator');
  const { createHandleGenerateFormHtml } = require('./form-html-generator');
  const { enrichFormConfigAutopopulate } = require('./form-autopopulate');
  const {
    handleStoreAutoFormPdf, handleFillAutoFormPdf, handleDemoHubFillPdf, rehydratePdfStore
  } = require('./auto-form-pdf-handler');
  const { handleCreateEntry, handleUpdateEntry, handleDeleteEntry } = require('./demo-hub-admin');
  const { createHandlePublishAutoForm } = require('./auto-form-publish-handler');
  const { createHandleSaveCurrentData } = require('./auto-form-current-data');
  const { createHandleHelpAnswer } = require('./auto-form-help-handler');
  const {
    createHandleGenerateFormConnections, createHandleFormConnectionsPrompt
  } = require('./form-connections-generator');

  // openai-fetch sends every chat completion to Claude whenever ANTHROPIC_API_KEY
  // is set, ignoring the OpenAI URL and auth header, so either key satisfies
  // these routes. Prefer the Claude key when both are present.
  const aiKey = anthropicKey || openAiKey;

  // An AI route with no key must fail loudly on call, not crash the server on boot.
  const requiresKey = (name) => (_req, res) => res.status(503).json({
    success: false,
    error: `${name} needs ANTHROPIC_API_KEY (or OPENAI_API_KEY) in .env, then restart npm start.`
  });
  const ai = (name, factory) => (aiKey ? factory(aiKey) : requiresKey(name));

  // --- PDF pipeline (no API key needed) --------------------------------
  app.post('/api/unlock-pdf', handleUnlockPdf);
  app.post('/api/prepare-pdf-fields', handlePreparePdfFields);
  app.post('/api/sanitize-pdf', handleSanitizePdf);

  // --- approval gate ----------------------------------------------------
  // Nothing below spends money until the operator arms a run from the UI.
  app.post('/api/ai-approval', handleArm);
  app.delete('/api/ai-approval', handleDisarm);
  app.get('/api/ai-approval', handleStatus);

  // --- AI generation ----------------------------------------------------
  app.post('/api/generate-field-config', requireAiApproval,
    ai('generate-field-config', createHandleGenerateFieldConfig));
  app.post('/api/generate-form-config', requireAiApproval,
    ai('generate-form-config', createHandleGenerateFormConfig));
  app.post('/api/generate-form-html', requireAiApproval,
    ai('generate-form-html', createHandleGenerateFormHtml));
  app.post('/api/generate-form-connections', requireAiApproval,
    ai('generate-form-connections', createHandleGenerateFormConnections));
  app.post('/api/field-config-prompt', createHandleFieldConfigPrompt());
  app.post('/api/field-config-prompt-zip', createHandleFieldConfigPromptZip());
  app.post('/api/form-connections-prompt', createHandleFormConnectionsPrompt());
  app.post('/api/form-connections-prompt-zip', createHandleFormConnectionsPromptZip());
  app.post('/api/auto-form/help-answer', requireAiApproval,
    ai('help-answer', createHandleHelpAnswer));

  app.post('/api/enrich-autopopulate', (req, res) => {
    try {
      const { formConfig, fieldConfig, userProfile, displayMode } = req.body || {};
      if (!formConfig) {
        return res.status(400).json({ success: false, error: 'formConfig is required' });
      }
      res.json({
        success: true,
        formConfig: enrichFormConfigAutopopulate(
          formConfig, userProfile || {}, displayMode || 'all_at_once', fieldConfig || null
        )
      });
    } catch (error) {
      console.error('[enrich-autopopulate]', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- PDF store + demo hub --------------------------------------------
  app.post('/api/auto-form/store-pdf', handleStoreAutoFormPdf);
  app.post('/api/auto-form/fill-pdf/:pdfToken', handleFillAutoFormPdf);
  app.post('/api/demo-hub/fill-pdf/:slug', handleDemoHubFillPdf);
  app.post('/api/demo-hub/entries', handleCreateEntry);
  app.put('/api/demo-hub/entries/:slug', handleUpdateEntry);
  app.delete('/api/demo-hub/entries/:slug', handleDeleteEntry);

  // --- publish / current data ------------------------------------------
  app.post('/api/auto-form/publish', createHandlePublishAutoForm(db));
  app.post('/api/auto-form/save-current-data', createHandleSaveCurrentData());

  // --- admin form catalog (Firestore-backed; ported from FormWiz server.js) ---
  const needsFirestore = (res) => res.status(503).json({
    success: false,
    error: 'This endpoint writes to Firestore. Add the FIREBASE_* credentials to .env and pass a db instance to registerAutoFormRoutes.'
  });

  app.post('/api/admin-save-form', async (req, res) => {
    try {
      const { formId, formData } = req.body || {};
      if (!formId || !formData) {
        return res.status(400).json({ success: false, error: 'Form ID and form data are required' });
      }
      if (!db) return needsFirestore(res);
      const { id, ...dataToSave } = formData;
      await db.collection('forms').doc(formId).set(dataToSave);
      res.json({ success: true, message: 'Form saved successfully' });
    } catch (error) {
      console.error('[admin-save-form]', error);
      res.status(500).json({ success: false, error: 'Failed to save form' });
    }
  });

  app.delete('/api/admin-delete-form/:formId', async (req, res) => {
    try {
      const { formId } = req.params;
      if (!formId) return res.status(400).json({ success: false, error: 'Form ID is required' });
      if (!db) return needsFirestore(res);
      await db.collection('forms').doc(formId).delete();
      res.json({ success: true, message: 'Form deleted successfully' });
    } catch (error) {
      console.error('[admin-delete-form]', error);
      res.status(500).json({ success: false, error: 'Failed to delete form' });
    }
  });

  rehydratePdfStore();

  return {
    openAi: Boolean(openAiKey),
    anthropic: Boolean(anthropicKey),
    firestore: Boolean(db)
  };
}

module.exports = { registerAutoFormRoutes };
