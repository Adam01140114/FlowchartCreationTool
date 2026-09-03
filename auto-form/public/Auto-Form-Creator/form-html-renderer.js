/**
 * Builds standalone HTML forms from form_config.json + FormStar template shell.
 * Default template: form-template.html (derived from example.html).
 */
(function (global) {
  'use strict';

  const PLACEHOLDER_BODY = '__AUTO_FORM_BODY__';
  const PLACEHOLDER_TITLE = '__FORM_TITLE__';
  const PLACEHOLDER_RUNTIME = '__AUTO_FORM_RUNTIME_SCRIPTS__';
  const DEFAULT_TEMPLATE_URL = '/Auto-Form-Creator/form-template.html';

  let cachedDefaultTemplate = null;

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** US states + DC — option values are 2-letter codes (PDF AcroForm dropdowns). */
  const US_STATE_OPTIONS = [
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'DC', label: 'District of Columbia' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
  ];

  function isUsStateField(field) {
    if (!field) return false;
    const nameId = String(field.nameId || '').trim().toLowerCase();
    const label = String(field.label || '').trim().toLowerCase();
    const placeholder = String(field.placeholder || '').trim().toLowerCase();
    const combinePart = String(field.combinePart || '').trim().toLowerCase();
    if (combinePart === 'state') return true;
    if (nameId === 'state' || /(?:^|_)state$/.test(nameId)) return true;
    if (label === 'state' || placeholder === 'state') return true;
    return false;
  }

  function renderUsStateSelectHtml({ id, nameAttr, value, extraAttrs }) {
    const selected = String(value || '').trim().toUpperCase();
    const opts = US_STATE_OPTIONS.map((s) => {
      const isSel = selected === s.value ? ' selected' : '';
      return `<option value="${esc(s.value)}"${isSel}>${esc(s.label)}</option>`;
    }).join('');
    const idAttr = id ? ` id="${esc(id)}"` : '';
    return `<select class="address-select address-select-state"${idAttr}${nameAttr || ''} data-field-label="State" required${extraAttrs || ''}><option value="" disabled${selected ? '' : ' selected'}>Choose a state</option>${opts}</select>`;
  }

  function stripQuestionNumber(text) {
    return String(text ?? '').replace(/^\s*\d+[\.\)\:\-]\s*/, '');
  }

  function isLinkedMirrorQuestion(question) {
    if (!question) return false;
    if (question.linkedFieldRole === 'mirror') return true;
    if (question.linkedToNameId) return true;
    const tbs = question.textboxes || [];
    if (tbs.length > 0 && tbs.every((tb) => tb.linkedToNameId)) return true;
    const opts = question.options || [];
    if (opts.length > 0 && opts.every((opt) => opt.linkedToNameId)) return true;
    return false;
  }

  function buildLinkedFieldMapFromConfig(formConfig) {
    const map = {};
    for (const section of formConfig?.sections || []) {
      for (const question of section.questions || []) {
        if (question.linkedToNameId && question.nameId) {
          if (!map[question.linkedToNameId]) map[question.linkedToNameId] = [];
          if (!map[question.linkedToNameId].includes(question.nameId)) {
            map[question.linkedToNameId].push(question.nameId);
          }
        }
        for (const opt of question.options || []) {
          if (opt?.linkedToNameId && opt.nameId) {
            if (!map[opt.linkedToNameId]) map[opt.linkedToNameId] = [];
            if (!map[opt.linkedToNameId].includes(opt.nameId)) {
              map[opt.linkedToNameId].push(opt.nameId);
            }
          }
        }
        for (const tb of question.textboxes || []) {
          if (tb?.linkedToNameId && tb.nameId) {
            if (!map[tb.linkedToNameId]) map[tb.linkedToNameId] = [];
            if (!map[tb.linkedToNameId].includes(tb.nameId)) {
              map[tb.linkedToNameId].push(tb.nameId);
            }
          }
        }
      }
    }
    return map;
  }

  function linkedAttr(primaryId) {
    return ` data-linked-to="${esc(primaryId)}" class="linked-mirror-input"`;
  }

  function renderMirrorInput(question) {
    const type = question.type;
    const defaultPrimary = question.linkedToNameId || '';

    if (type === 'checkbox') {
      return (question.options || []).map((opt) => {
        const optName = opt.nameId || question.nameId;
        const primaryRef = opt.linkedToNameId || defaultPrimary;
        return `<input type="checkbox" name="${esc(optName)}" id="${esc(optName)}" value="${esc(opt.value || opt.label)}"${linkedAttr(primaryRef)} style="display:none">`;
      }).join('');
    }
    if (type === 'multipleTextboxes') {
      return (question.textboxes || []).map((tb) => {
        if (!tb.nameId) return '';
        const primaryRef = tb.linkedToNameId || defaultPrimary;
        return `<input type="hidden" name="${esc(tb.nameId)}" id="${esc(tb.nameId)}"${linkedAttr(primaryRef)}>`;
      }).join('');
    }
    const nameId = question.nameId;
    return `<input type="hidden" name="${esc(nameId)}" id="${esc(nameId)}"${linkedAttr(defaultPrimary)}>`;
  }

  function autopopulateBadgeHtml(block, devMode) {
    if (!devMode || !block?.autopopulate?.enabled) return '';
    const badge = block.autopopulate.availableInProfile ? 'autofill-ready' : 'autofill-learn';
    const badgeText = block.autopopulate.availableInProfile ? 'Autofill available' : 'Will save to profile';
    return `<div class="autopopulate-badge ${badge}" style="margin-top:10px;font-size:0.78rem;font-weight:700;padding:4px 10px;border-radius:999px;display:inline-block;background:${badge === 'autofill-ready' ? '#d1fae5' : '#fef3c7'};color:${badge === 'autofill-ready' ? '#065f46' : '#92400e'};">${badgeText}</div>`;
  }

  function getAutofillValue(block, userProfile) {
    if (!block?.autopopulate?.enabled) return '';
    if (block.autopopulate.availableInProfile && block.autopopulate.currentProfileValue != null) {
      return block.autopopulate.currentProfileValue;
    }
    const keys = [block.autopopulate.profileKey, block.nameId].filter(Boolean);
    for (const key of keys) {
      if (userProfile && userProfile[key] != null && String(userProfile[key]).trim() !== '') {
        return userProfile[key];
      }
    }
    return '';
  }

  function inferCheckboxSelectionMode(question) {
    const mode = String(question?.checkboxSelectionMode || '').toLowerCase();
    if (mode === 'single' || mode === 'multiple') return mode;
    const blob = `${question?.text || ''} ${(question?.options || []).map((o) => o.label || o.nameId || '').join(' ')}`.toLowerCase();
    if (/sex|gender|male|female|nonbinary/.test(blob)) return 'single';
    return 'multiple';
  }

  function renderInput(question, userProfile, devMode) {
    const type = question.type;
    const nameId = question.nameId;
    const val = esc(getAutofillValue(question, userProfile));
    const ap = question.autopopulate?.enabled ? ' data-autopopulate="true"' : '';
    const pk = question.autopopulate?.profileKey ? ` data-profile-key="${esc(question.autopopulate.profileKey)}"` : '';
    const pd = question.autopopulate?.profileDescription
      ? ` data-profile-description="${esc(question.autopopulate.profileDescription)}"`
      : '';
    const qid = question.questionId != null ? ` data-question-id="${esc(question.questionId)}"` : '';

    if (type === 'bigParagraph') {
      return `<textarea class="address-input" id="${esc(nameId)}" name="${esc(nameId)}" rows="4" placeholder="${esc(question.placeholder || '')}"${ap}${pk}${pd}${qid} style="width:80%;max-width:400px;height:auto;">${val}</textarea>`;
    }
    if (type === 'date') {
      return `<input type="date" class="address-input" id="${esc(nameId)}" name="${esc(nameId)}" value="${val}"${ap}${pk}${pd}${qid}>`;
    }
    if (type === 'phone') {
      return `<input type="tel" class="address-input" id="${esc(nameId)}" name="${esc(nameId)}" value="${val}" placeholder="${esc(question.placeholder || '')}"${ap}${pk}${pd}${qid}>`;
    }
    if (type === 'money') {
      return `<input type="number" step="0.01" class="address-input" id="${esc(nameId)}" name="${esc(nameId)}" value="${val}" placeholder="${esc(question.placeholder || '')}"${ap}${pk}${pd}${qid}>`;
    }
    if (type === 'dropdown' || (type === 'text' && isUsStateField(question))) {
      if (isUsStateField(question)) {
        const stateId = nameId || `state_${question.questionId}`;
        const nameAttr = nameId ? ` name="${esc(nameId)}"` : '';
        return renderUsStateSelectHtml({
          id: stateId,
          nameAttr,
          value: val,
          extraAttrs: `${ap}${pk}${pd}${qid}`,
        });
      }
      const gateId = nameId || `logic_gate_${question.questionId}`;
      const nameAttr = nameId ? ` name="${esc(nameId)}"` : '';
      const gateClass = nameId ? '' : ' logic-gate-select';
      const gateData = nameId
        ? ''
        : ` data-is-logic-gate="true" data-gate-question-id="${esc(question.questionId)}"`;
      const opts = (question.options || []).map((o) => {
        const v = typeof o === 'string' ? o : o.value || o.label;
        const label = typeof o === 'string' ? o : o.label || o.value;
        const selected = String(val).toLowerCase() === String(v).toLowerCase() ? ' selected' : '';
        return `<option value="${esc(v)}"${selected}>${esc(label)}</option>`;
      }).join('');
      return `<select class="address-select${gateClass}" id="${esc(gateId)}"${nameAttr}${gateData}${ap}${pk}${pd}${qid}><option value="" disabled${val ? '' : ' selected'}>Select an option</option>${opts}</select>`;
    }
    if (type === 'checkbox' || type === 'radio') {
      const inputType = type === 'radio' && !(question.options || []).every((opt) => opt.nameId)
        ? 'radio'
        : 'checkbox';
      const groupName = inputType === 'radio' ? esc(nameId || `q${question.questionId}_radio`) : null;
      return (question.options || []).map((opt) => {
        const optName = opt.nameId || nameId || groupName;
        const optVal = getAutofillValue(opt, userProfile);
        const expected = String(opt.value || opt.label).toLowerCase();
        const isChecked = optVal != null && String(optVal).trim() !== ''
          && (String(optVal).toLowerCase() === expected
            || (optVal === true || optVal === 'on' || optVal === '1'));
        const checked = isChecked ? ' checked' : '';
        const optAp = opt.autopopulate?.enabled ? ' data-autopopulate="true"' : ap;
        const optPk = opt.autopopulate?.profileKey ? ` data-profile-key="${esc(opt.autopopulate.profileKey)}"` : pk;
        const optPd = opt.autopopulate?.profileDescription
          ? ` data-profile-description="${esc(opt.autopopulate.profileDescription)}"`
          : pd;
        const nameAttr = inputType === 'radio' && !opt.nameId
          ? ` name="${groupName}"`
          : ` name="${esc(optName)}"`;
        return `<label class="checkbox-option" style="display:block;margin:8px 0;"><input type="${inputType}"${nameAttr} value="${esc(opt.value || opt.label)}"${checked}${optAp}${optPk}${optPd}> ${esc(opt.label)}</label>`;
      }).join('');
    }
    if (type === 'multipleTextboxes') {
      return (question.textboxes || []).map((tb) => {
        const tbVal = esc(getAutofillValue(tb, userProfile));
        const tbAp = tb.autopopulate?.enabled ? ' data-autopopulate="true"' : '';
        const tbPk = tb.autopopulate?.profileKey ? ` data-profile-key="${esc(tb.autopopulate.profileKey)}"` : '';
        const tbPd = tb.autopopulate?.profileDescription
          ? ` data-profile-description="${esc(tb.autopopulate.profileDescription)}"`
          : '';
        const tbBadge = autopopulateBadgeHtml(tb, devMode);
        const placeholder = String(tb.placeholder || '').trim();
        const labelHtml = placeholder
          ? ''
          : `<label for="${esc(tb.nameId || 'field')}">${esc(tb.label || tb.nameId)}</label>`;
        const combinePart = tb.combinePart || '';
        const combineInto = tb.pdfCombineInto
          ? ` data-pdf-combine-into="${esc(tb.pdfCombineInto)}" data-combine-part="${esc(combinePart)}" data-combine-order="${esc(tb.combineOrder ?? 0)}" data-combine-label="${esc(tb.label || placeholder || combinePart)}"`
          : '';
        const partSlug = combinePart || String(tb.label || placeholder || 'part').toLowerCase().replace(/\s+/g, '_');
        const fieldId = tb.nameId || `q${question.questionId}_${partSlug}`;
        const nameAttr = tb.nameId
          ? ` id="${esc(tb.nameId)}" name="${esc(tb.nameId)}"`
          : ` id="${esc(fieldId)}"`;
        if (isUsStateField(tb)) {
          const stateSelect = renderUsStateSelectHtml({
            id: tb.nameId || fieldId,
            nameAttr: tb.nameId ? ` name="${esc(tb.nameId)}"` : '',
            value: tbVal,
            extraAttrs: `${combineInto}${tbAp}${tbPk}${tbPd}`,
          });
          return `<div class="address-field textbox-group">${labelHtml}${stateSelect}${tbBadge}</div>`;
        }
        return `<div class="address-field textbox-group">${labelHtml}<input type="text" class="address-input"${nameAttr} value="${tbVal}" placeholder="${esc(placeholder)}"${combineInto}${tbAp}${tbPk}${tbPd}>${tbBadge}</div>`;
      }).join('');
    }
    if (question.pdfCombineInto) {
      const combineId = question.nameId || `${question.pdfCombineInto}_${question.combinePart || question.questionId}`;
      const combineAttr = ` data-pdf-combine-into="${esc(question.pdfCombineInto)}" data-combine-part="${esc(question.combinePart || '')}" data-combine-order="${esc(question.combineOrder ?? 0)}"`;
      const nameAttr = question.nameId ? ` name="${esc(question.nameId)}"` : '';
      if (isUsStateField(question)) {
        return renderUsStateSelectHtml({
          id: combineId,
          nameAttr,
          value: val,
          extraAttrs: `${combineAttr}${ap}${pk}${pd}${qid}`,
        });
      }
      return `<input type="text" class="address-input" id="${esc(combineId)}"${nameAttr} value="${val}" placeholder="${esc(question.placeholder || '')}"${combineAttr}${ap}${pk}${pd}${qid}>`;
    }
    if (isUsStateField(question)) {
      return renderUsStateSelectHtml({
        id: nameId,
        nameAttr: ` name="${esc(nameId)}"`,
        value: val,
        extraAttrs: `${ap}${pk}${pd}${qid}`,
      });
    }
    return `<input type="text" class="address-input" id="${esc(nameId)}" name="${esc(nameId)}" value="${val}" placeholder="${esc(question.placeholder || '')}"${ap}${pk}${pd}${qid}>`;
  }

  function buildStepperStylesHtml() {
    return `<style id="auto-form-stepper-styles">
.stepper-progress-bar{display:flex;align-items:center;justify-content:center;margin:12px auto 0;width:100%;max-width:700px;background:none;gap:0}
.stepper-step{display:flex;flex-direction:column;align-items:center;position:relative;z-index:2;min-width:90px;flex-shrink:0}
.stepper-circle{width:32px;height:32px;border-radius:50%;background:#e0e7ef;color:#2c3e50;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;border:2px solid #4f8cff;transition:background .3s,color .3s,border .3s}
.stepper-step.active .stepper-circle,.stepper-step.completed .stepper-circle{background:linear-gradient(90deg,#4f8cff 0%,#38d39f 100%);color:#fff;border:2px solid #38d39f}
.stepper-label{margin-top:8px;font-size:15px;color:#2c3e50;font-weight:600;text-align:center;min-width:80px}
.stepper-step.completed .stepper-label{color:#38d39f}
.stepper-step.active .stepper-label{color:#4f8cff}
.stepper-line{flex:1 1 40px;min-width:24px;height:4px;background:#e0e7ef;margin:0;position:relative;z-index:1;align-self:flex-start;margin-top:14px;transition:background .5s cubic-bezier(.4,1.4,.6,1)}
.stepper-line.filled{background:linear-gradient(90deg,#4f8cff 0%,#38d39f 100%)}
.section{display:none}
.section.active{display:block}
.form-all-at-once-layout .section{display:block!important;margin:0 auto 36px;max-width:760px;padding:28px 24px 32px;background:#fff;border-radius:16px;border:1px solid #e5e7eb;box-shadow:0 8px 28px rgba(44,62,80,.07)}
.form-all-at-once-layout .section-title{margin-top:0;padding-bottom:12px;border-bottom:2px solid #e8eef5;margin-bottom:24px;font-size:1.45rem;color:#1f3a60}
.form-all-at-once-layout .question-container{margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #f0f3f8}
.form-all-at-once-layout .question-container:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
.form-all-at-once-layout .question-nav{display:none!important}
.form-all-at-once-layout .stepper-progress-bar{position:sticky;top:0;z-index:30;background:#f7fafd;padding:12px 0 16px;margin-bottom:8px}
.all-at-once-submit-bar{position:sticky;bottom:0;z-index:40;display:flex;justify-content:center;padding:18px 16px 24px;background:linear-gradient(180deg,rgba(247,250,253,0) 0%,#f7fafd 35%,#f7fafd 100%)}
.all-at-once-submit-bar .next-button{min-width:220px;padding:14px 28px;font-size:1.05rem;border-radius:999px;border:none;background:linear-gradient(135deg,#0acffe,#495aff);color:#fff;font-weight:700;cursor:pointer;box-shadow:0 10px 24px rgba(9,132,227,.35)}
.question-header{display:flex;align-items:flex-start;justify-content:center;gap:10px;margin-bottom:8px}
.question-header .question-text{margin:0;flex:1;text-align:center}
.question-info-wrap{position:relative;flex-shrink:0;margin-top:2px}
.question-info-wrap::after{content:'';position:absolute;left:-10px;right:-10px;top:100%;height:18px}
.question-info-btn{width:22px;height:22px;border-radius:50%;border:1.5px solid #4f8cff;background:#eef4ff;color:#1d4ed8;font-size:13px;font-weight:800;line-height:1;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;font-family:Georgia,serif}
.question-info-btn:hover,.question-info-btn:focus{background:#4f8cff;color:#fff;outline:none}
.question-info-tooltip{display:none;position:absolute;left:50%;transform:translateX(-50%);top:calc(100% + 8px);min-width:240px;max-width:340px;padding:12px 14px;background:#1f2937;color:#f9fafb;border-radius:10px;font-size:13px;line-height:1.45;font-weight:500;text-align:left;box-shadow:0 8px 24px rgba(15,23,42,.22);z-index:20;pointer-events:auto}
.question-info-tooltip::before{content:'';position:absolute;top:-6px;left:50%;transform:translateX(-50%);border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:6px solid #1f2937}
.question-info-wrap.open .question-info-tooltip{display:block}
.question-info-tooltip-text{margin:0 0 0 0}
.question-info-tooltip .question-help-btn{display:flex;width:100%;margin-top:10px;padding:8px 12px;border-radius:8px;border:1.5px solid #93c5fd;background:#0f172a;color:#e0f2fe;font-size:12px;font-weight:700;cursor:pointer;justify-content:center;transition:background .2s,color .2s,border-color .2s}
.question-info-tooltip .question-help-btn:hover,.question-info-tooltip .question-help-btn:focus{background:#4f8cff;color:#fff;border-color:#4f8cff;outline:none}
.checkbox-group-label{display:block;margin:0 0 12px;font-weight:600;color:#1f3a60;text-align:center}
.auto-form-help-modal{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px}
.auto-form-help-modal[hidden]{display:none!important}
.auto-form-help-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55)}
.auto-form-help-panel{position:relative;width:100%;max-width:520px;max-height:min(88vh,720px);background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden;text-align:left}
.auto-form-help-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #e5e7eb;background:linear-gradient(90deg,#eef4ff,#f8fafc)}
.auto-form-help-header h2{margin:0;font-size:17px;color:#1f3a60;text-align:left;flex:1;min-width:0}
.auto-form-help-close{flex-shrink:0;width:32px!important;height:32px!important;min-width:32px!important;padding:0!important;margin:0!important;border:none!important;border-radius:50%!important;background:#e5e7eb!important;color:#374151!important;font-size:20px!important;line-height:1!important;cursor:pointer;display:inline-flex!important;align-items:center;justify-content:center;box-shadow:none!important}
.auto-form-help-close:hover{background:#d1d5db!important}
.auto-form-help-question{padding:12px 18px;background:#f8fafc;border-bottom:1px solid #e5e7eb;font-size:13px;color:#334155;line-height:1.45;max-height:88px;overflow:auto;text-align:left}
.auto-form-help-messages{flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px;min-height:180px;background:#fff;text-align:left}
.auto-form-help-msg{max-width:92%;padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.45;word-break:break-word;text-align:left}
.auto-form-help-msg.user{align-self:flex-end;background:#4f8cff;color:#fff;border-bottom-right-radius:4px}
.auto-form-help-msg.assistant{align-self:flex-start;background:#f1f5f9;color:#1e293b;border-bottom-left-radius:4px}
.auto-form-help-msg.loading{align-self:flex-start;background:#f8fafc;color:#64748b;font-style:italic}
.auto-form-help-autofill-row{padding:0 18px 8px;display:flex;justify-content:center}
.auto-form-help-autofill-row[hidden]{display:none!important}
.auto-form-help-autofill-btn{padding:10px 22px;border:none;border-radius:999px;background:linear-gradient(90deg,#38d39f,#4f8cff);color:#fff;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 6px 16px rgba(56,211,159,.35)}
.auto-form-help-autofill-btn:hover{filter:brightness(1.05)}
.auto-form-help-input-row{display:flex;gap:8px;padding:12px 18px 16px;border-top:1px solid #e5e7eb;background:#fafbfc}
.auto-form-help-input-row textarea{flex:1;resize:none;border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;min-height:44px}
.auto-form-help-input-row textarea:focus{outline:none;border-color:#4f8cff;box-shadow:0 0 0 3px rgba(79,140,255,.15)}
.auto-form-help-send-btn{padding:0 18px!important;margin:0!important;width:auto!important;border:none!important;border-radius:10px!important;background:#4f8cff!important;color:#fff!important;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap;display:inline-flex!important;align-items:center;justify-content:center;box-shadow:none!important}
.auto-form-help-send-btn:disabled{background:#cbd5e1!important;cursor:not-allowed}
.auto-form-help-autofill-btn{margin:0!important;width:auto!important}
.auto-form-thank-you{text-align:center;width:100%;max-width:737px;margin:0 auto;box-sizing:border-box;padding:8px 0 24px}
.auto-form-thank-you-title{margin:0 0 20px;font-size:1.6rem;color:#2c3e50;line-height:1.3}
.auto-form-view-pdf-btn{display:block;margin:0 auto 20px;font-size:1.2em;background:#2980b9;color:#fff;border:none;border-radius:8px;padding:12px 28px;cursor:pointer;font-weight:700}
.auto-form-view-pdf-btn:hover{background:#1f6fa3}
.thank-you-pdf-preview-wrap{width:100%;max-width:100%;margin:0 auto 24px;box-sizing:border-box}
.thank-you-pdf-preview-wrap iframe,#filled-pdf-preview{width:100%;max-width:100%;min-height:2880px;border:1px solid #bcd8ff;border-radius:12px;background:#fff;display:block}
.auto-form-thank-you-back{font-size:1.2em;margin-top:8px}
</style>`;
  }

  function buildStepperHtml(sections) {
    if (!sections || sections.length < 2) return '';
    const steps = sections.map((section, idx) => {
      const stepNum = section.sectionId != null ? section.sectionId : idx + 1;
      const label = esc(section.sectionName || `Section ${stepNum}`);
      const stepHtml = `<div class="stepper-step" data-step="${stepNum}"><div class="stepper-circle">${stepNum}</div><div class="stepper-label">${label}</div></div>`;
      if (idx < sections.length - 1) {
        return stepHtml + '<div class="stepper-line"></div>';
      }
      return stepHtml;
    }).join('');
    return `<div class="stepper-progress-bar" id="stepperProgressBar">${steps}</div>`;
  }

  function buildQuestionHeaderHtml(question, questionText) {
    const needsExplanation = question.needsExplanation && String(question.explanation || '').trim();
    let html = '<div class="question-header">';
    html += `<h3 class="question-text">${esc(questionText)}</h3>`;
    if (needsExplanation) {
      const tip = esc(question.explanation);
      html += `<div class="question-info-wrap">`;
      html += `<button type="button" class="question-info-btn" aria-label="More information about this question" aria-describedby="question-info-${esc(question.questionId)}">i</button>`;
      html += `<div class="question-info-tooltip" id="question-info-${esc(question.questionId)}" role="tooltip">`;
      html += `<p class="question-info-tooltip-text">${tip}</p>`;
      html += `<button type="button" class="question-help-btn" data-help-question-id="${esc(question.questionId)}" aria-label="Get AI help answering this question">Help Me Answer</button>`;
      html += `</div>`;
      html += `</div>`;
    }
    html += '</div>';
    return html;
  }

  function buildQuestionContainer(question, globalIndex, sectionId, questionIndexInSection, userProfile, devMode, oneAtATime) {
    const questionId = question.questionId != null ? question.questionId : globalIndex;
    const questionText = devMode ? question.text : stripQuestionNumber(question.text);
    const isMirror = isLinkedMirrorQuestion(question);
    const visibilityClasses = [];
    if (isMirror) {
      visibilityClasses.push('linked-field-mirror');
      if (!devMode) visibilityClasses.push('hidden');
    }
    if (question.logic?.enabled && question.logic.prevQuestion && !isMirror) {
      visibilityClasses.push('hidden');
      visibilityClasses.push('logic-gated');
    }
    if (question.autoTodayDate && !isMirror) {
      if (!devMode) visibilityClasses.push('hidden');
      visibilityClasses.push('auto-today-date');
    }
    if (oneAtATime && questionIndexInSection > 1 && !isMirror) {
      visibilityClasses.push('question-step-hidden');
    }
    const hiddenClass = visibilityClasses.length ? ' ' + visibilityClasses.join(' ') : '';
    const needsExplanation = question.needsExplanation && String(question.explanation || '').trim();
    const linkedDataAttr = isMirror && question.linkedToNameId
      ? ` data-linked-to="${esc(question.linkedToNameId)}"`
      : '';
    const logicDataAttr = question.logic?.enabled && question.logic.prevQuestion
      ? ` data-logic-prev-question="${esc(question.logic.prevQuestion)}" data-logic-prev-answer="${esc(question.logic.prevAnswer || 'Yes')}"`
      : '';
    const ariaHidden = isMirror && !devMode ? ' aria-hidden="true"' : '';

    let html = `<div id="question-container-${globalIndex}" data-question-id="${esc(questionId)}" class="question-container question-item${hiddenClass}" data-section="${esc(sectionId)}" data-question-index="${questionIndexInSection}"${linkedDataAttr}${logicDataAttr}${ariaHidden}>`;
    if (!isMirror || devMode) {
      html += buildQuestionHeaderHtml(question, questionText);
      if (isMirror && devMode) {
        html += `<p class="linked-field-dev-note" style="font-size:0.78rem;color:#64748b;margin:4px 0 8px;text-align:center;">Linked mirror → ${esc(question.linkedToNameId || 'primary')}</p>`;
      }
    }
    if (isMirror) {
      html += renderMirrorInput(question);
    } else {
      if (question.type === 'checkbox' && (question.options || []).length > 1) {
        const selectionMode = inferCheckboxSelectionMode(question);
        const exclusiveClass = selectionMode === 'single' ? ' checkbox-group-exclusive' : '';
        html += `<div class="checkbox-group checkbox-group-${esc(questionId)}${exclusiveClass}" data-checkbox-selection="${esc(selectionMode)}">`;
      }
      html += renderInput(question, userProfile, devMode);
      if (question.type === 'checkbox' && (question.options || []).length > 1) {
        html += '</div>';
      }
      if (devMode && question.autopopulate?.enabled && question.type !== 'multipleTextboxes') {
        html += autopopulateBadgeHtml(question, devMode);
      }
    }
    html += '</div>';
    return html;
  }

  function buildHelpChatModalHtml() {
    return `<div id="autoFormHelpModal" class="auto-form-help-modal" hidden aria-hidden="true">
  <div class="auto-form-help-backdrop" data-help-close="true"></div>
  <div class="auto-form-help-panel" role="dialog" aria-modal="true" aria-labelledby="autoFormHelpTitle">
    <div class="auto-form-help-header">
      <h2 id="autoFormHelpTitle">Help Me Answer</h2>
      <button type="button" class="auto-form-help-close" data-help-close="true" aria-label="Close chat">&times;</button>
    </div>
    <div class="auto-form-help-question" id="autoFormHelpQuestion"></div>
    <div class="auto-form-help-messages" id="autoFormHelpMessages"></div>
    <div class="auto-form-help-autofill-row" id="autoFormHelpAutofillRow" hidden>
      <button type="button" class="auto-form-help-autofill-btn" id="autoFormHelpAutofillBtn">Autofill</button>
    </div>
    <div class="auto-form-help-input-row">
      <textarea id="autoFormHelpInput" rows="2" placeholder="Ask about this question..." aria-label="Chat message"></textarea>
      <button type="button" class="auto-form-help-send-btn" id="autoFormHelpSendBtn">Send</button>
    </div>
  </div>
</div>`;
  }

  function buildSectionsHtml(formConfig, userProfile, devMode) {
    const sections = formConfig.sections || [];
    const oneAtATime = formConfig.displayMode === 'one_at_a_time';
    let globalIndex = 0;
    let html = buildStepperStylesHtml() + buildStepperHtml(sections);

    if (!oneAtATime) {
      html += '<div class="form-all-at-once-layout">';
    }

    sections.forEach((section, sectionIdx) => {
      const sectionId = section.sectionId != null ? section.sectionId : sectionIdx + 1;
      const sectionActive = oneAtATime && sectionIdx === 0 ? ' active' : '';
      const sectionName = esc(section.sectionName || `Section ${sectionId}`);
      const questions = section.questions || [];
      const isLastSection = sectionIdx === sections.length - 1;

      html += `<div id="section${sectionId}" class="section${sectionActive}" data-section-id="${sectionId}">`;
      html += `<h1 class="section-title">${sectionName}</h1>`;

      questions.forEach((question, qIdx) => {
        globalIndex += 1;
        html += buildQuestionContainer(
          question,
          globalIndex,
          sectionId,
          qIdx + 1,
          userProfile,
          devMode,
          oneAtATime
        );
      });

      if (oneAtATime) {
        html += `<div class="question-nav" data-section-index="${sectionId}">`;
        html += `<button type="button" class="question-nav-btn question-prev" aria-label="Previous question" data-section="${sectionId}">&larr;</button>`;
        html += `<button type="button" class="question-nav-btn question-next" aria-label="Next question" data-section="${sectionId}">&rarr;</button>`;
        html += '</div>';
        html += '<br><br>';
        html += '<div class="navigation-buttons" style="display:none;">';
        if (isLastSection) {
          html += '<button type="submit" class="next-button">Submit</button>';
        } else {
          html += '<button type="button" onclick="goBack()">Back</button>';
        }
        html += '</div>';
      }

      html += '</div>';
    });

    if (!oneAtATime) {
      html += '<div class="all-at-once-submit-bar"><button type="submit" class="next-button">Submit Form</button></div>';
      html += '</div>';
    }

    html += buildHelpChatModalHtml();
    return html;
  }

  function buildRuntimeScripts(firebaseConfig, devMode, pdfToken, userProfile, displayMode, formConfig, fieldConfig, extractedDocumentContent) {
    const configJson = firebaseConfig ? JSON.stringify(firebaseConfig) : 'null';
    const profileJson = JSON.stringify(userProfile || {});
    const tokenJson = JSON.stringify(pdfToken || null);
    const devModeLiteral = devMode ? 'true' : 'false';
    const displayModeLiteral = JSON.stringify(displayMode || 'all_at_once');
    const formConfigJson = JSON.stringify(formConfig || {}).replace(/</g, '\\u003c');
    const linkedFieldMapJson = JSON.stringify(buildLinkedFieldMapFromConfig(formConfig || {})).replace(/</g, '\\u003c');
    const fieldConfigJson = JSON.stringify(fieldConfig || null).replace(/</g, '\\u003c');
    const extractedDocJson = JSON.stringify(extractedDocumentContent || '').replace(/</g, '\\u003c');

    return `
<script>
(function(){
  var userProfile = ${profileJson};
  var firebaseConfig = ${configJson};
  var devMode = ${devModeLiteral};
  var pdfToken = ${tokenJson};
  var displayMode = ${displayModeLiteral};
  var linkedFieldMap = ${linkedFieldMapJson};
  var formConfig = ${formConfigJson};
  var fieldConfig = ${fieldConfigJson};
  var extractedDocumentContent = ${extractedDocJson};

  function formatDateForServer(dateString) {
    if (!dateString) return '';
    var parts = dateString.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return parts[1] + '/' + parts[2] + '/' + parts[0];
    }
    return dateString;
  }

  function findPrimaryElement(primaryId) {
    if (!primaryId) return null;
    var byId = document.getElementById(primaryId);
    if (byId && !byId.hasAttribute('data-linked-to')) return byId;
    var selector = 'input[name="' + primaryId + '"]:not([data-linked-to]), select[name="' + primaryId + '"]:not([data-linked-to]), textarea[name="' + primaryId + '"]:not([data-linked-to])';
    var byName = document.querySelector(selector);
    return byName || (byId && !byId.hasAttribute('data-linked-to') ? byId : null);
  }

  function syncLinkedMirror(mirror) {
    var primaryId = mirror.getAttribute('data-linked-to');
    if (!primaryId) return;
    var primary = findPrimaryElement(primaryId);
    if (!primary) return;
    if (mirror.type === 'checkbox') {
      mirror.checked = primary.checked;
    } else if (primary.type === 'date' && primary.value) {
      mirror.value = formatDateForServer(primary.value);
    } else if (primary.tagName === 'SELECT') {
      mirror.value = primary.value;
    } else {
      mirror.value = primary.value;
    }
  }

  function syncAllLinkedFields() {
    document.querySelectorAll('[data-linked-to]').forEach(syncLinkedMirror);
  }

  function wireLinkedFields() {
    if (window.__linkedFieldsWired) {
      syncAllLinkedFields();
      return;
    }
    window.__linkedFieldsWired = true;
    var wired = new Set();
    Object.keys(linkedFieldMap || {}).forEach(function(primaryId) {
      var primary = findPrimaryElement(primaryId);
      if (!primary || wired.has(primaryId)) return;
      wired.add(primaryId);
      function onPrimaryChange() {
        document.querySelectorAll('[data-linked-to="' + primaryId + '"]').forEach(syncLinkedMirror);
      }
      primary.addEventListener('input', onPrimaryChange);
      primary.addEventListener('change', onPrimaryChange);
      onPrimaryChange();
    });
    document.querySelectorAll('[data-linked-to]').forEach(function(mirror) {
      var primaryId = mirror.getAttribute('data-linked-to');
      if (!primaryId || wired.has('mirror:' + mirror.name)) return;
      wired.add('mirror:' + mirror.name);
      syncLinkedMirror(mirror);
    });
  }

  window.__syncAllLinkedFields = syncAllLinkedFields;

  function fieldValue(el) {
    if (el.type === 'checkbox') return el.checked ? el.value : '';
    return el.value;
  }

  function updateAutofillBadge(el) {
    if (!devMode || !el.hasAttribute('data-autopopulate')) return;
    var val = fieldValue(el);
    var container = el.closest('.textbox-group') || el.closest('.question-container');
    if (!container) return;
    var badge = container.querySelector('.autopopulate-badge');
    if (!badge) return;
    if (String(val).trim() !== '') {
      badge.textContent = 'Autofill available';
      badge.classList.remove('autofill-learn');
      badge.classList.add('autofill-ready');
      badge.style.background = '#d1fae5';
      badge.style.color = '#065f46';
    }
  }

  function applyProfileToForm() {
    document.querySelectorAll('[data-profile-key]').forEach(function(el) {
      var key = el.getAttribute('data-profile-key');
      if (!key || userProfile[key] == null) return;
      var val = userProfile[key];
      if (el.type === 'checkbox') {
        el.checked = String(val).toLowerCase() === String(el.value).toLowerCase();
      } else {
        el.value = val;
      }
      updateAutofillBadge(el);
    });
  }

  function syncProfileFromInput(el, persist) {
    var key = el.getAttribute('data-profile-key');
    if (!key) return;
    var desc = el.getAttribute('data-profile-description') || key;
    var val = fieldValue(el);
    updateAutofillBadge(el);
    if (val === '') return;
    userProfile[key] = val;
    if (!userProfile[key + '_description']) userProfile[key + '_description'] = desc;
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'formstar-profile-update', key: key, value: val, description: desc }, '*');
    }
    if (persist && typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
      var user = firebase.auth().currentUser;
      if (!user) return;
      var updates = {};
      updates[key] = val;
      updates[key + '_description'] = userProfile[key + '_description'] || desc;
      firebase.firestore().collection('users').doc(user.uid).set(updates, { merge: true }).catch(function(err) {
        console.error('Profile save error:', err);
      });
    }
  }

  document.querySelectorAll('[data-autopopulate]').forEach(function(el) {
    el.addEventListener('input', function(){ updateAutofillBadge(el); });
    el.addEventListener('change', function(){ syncProfileFromInput(el, true); });
    el.addEventListener('blur', function(){ syncProfileFromInput(el, true); });
  });

  if (firebaseConfig && typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function(user) {
      if (!user || !firebase.firestore) return;
      firebase.firestore().collection('users').doc(user.uid).get().then(function(doc) {
        if (doc.exists) {
          userProfile = Object.assign({}, userProfile, doc.data() || {});
          applyProfileToForm();
          restoreFormAnswersFromCookies();
          syncAllLinkedFields();
          refreshAllQuestionNav();
        }
      });
    });
  }
  applyProfileToForm();
  wireLinkedFields();

  var FORM_COOKIE_PREFIX = 'afc_frm_';
  var FORM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
  var saveFormAnswersTimer = null;

  function getFormPersistId() {
    var id = (formConfig && (formConfig.formId || formConfig.formFolderName)) || 'default';
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }

  function setFormCookie(name, value, maxAge) {
    document.cookie = name + '=' + value + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
  }

  function getFormCookie(name) {
    var prefix = name + '=';
    var parts = document.cookie.split(';');
    for (var i = 0; i < parts.length; i += 1) {
      var part = parts[i].trim();
      if (part.indexOf(prefix) === 0) {
        return decodeURIComponent(part.substring(prefix.length));
      }
    }
    return '';
  }

  function clearFormAnswerCookies() {
    var id = getFormPersistId();
    var prefix = FORM_COOKIE_PREFIX + id + '_';
    document.cookie.split(';').forEach(function(part) {
      var cookieName = part.split('=')[0].trim();
      if (cookieName === FORM_COOKIE_PREFIX + id + '_n' || cookieName.indexOf(prefix) === 0) {
        setFormCookie(cookieName, '', 0);
      }
    });
  }

  function saveFormAnswersToCookies() {
    var id = getFormPersistId();
    var prefix = FORM_COOKIE_PREFIX + id + '_';
    var data = collectCurrentAnswers();
    var json = JSON.stringify(data);
    if (!json || json === '{}') {
      clearFormAnswerCookies();
      return;
    }
    var encoded = encodeURIComponent(json);
    var chunkSize = 3200;
    var numChunks = Math.ceil(encoded.length / chunkSize);
    clearFormAnswerCookies();
    setFormCookie(FORM_COOKIE_PREFIX + id + '_n', String(numChunks), FORM_COOKIE_MAX_AGE);
    for (var ci = 0; ci < numChunks; ci += 1) {
      setFormCookie(prefix + ci, encoded.slice(ci * chunkSize, (ci + 1) * chunkSize), FORM_COOKIE_MAX_AGE);
    }
  }

  function scheduleSaveFormAnswers() {
    if (saveFormAnswersTimer) clearTimeout(saveFormAnswersTimer);
    saveFormAnswersTimer = setTimeout(saveFormAnswersToCookies, 250);
  }

  function loadFormAnswersFromCookies() {
    var id = getFormPersistId();
    var num = parseInt(getFormCookie(FORM_COOKIE_PREFIX + id + '_n'), 10);
    if (!num || num < 1) return null;
    var prefix = FORM_COOKIE_PREFIX + id + '_';
    var encoded = '';
    for (var ci = 0; ci < num; ci += 1) {
      encoded += getFormCookie(prefix + ci);
    }
    if (!encoded) return null;
    try {
      return JSON.parse(decodeURIComponent(encoded));
    } catch (err) {
      return null;
    }
  }

  function restoreFormAnswersFromCookies() {
    var saved = loadFormAnswersFromCookies();
    if (!saved) return;
    var form = document.getElementById('customForm');
    if (!form) return;
    Object.keys(saved).forEach(function(name) {
      var val = saved[name];
      var control = form.elements[name];
      if (!control) return;
      var fields = control.length && control.type !== 'select-one' && control.type !== 'select-multiple'
        ? Array.prototype.slice.call(control)
        : [control];
      fields.forEach(function(el) {
        if (el.hasAttribute('data-linked-to')) return;
        if (el.type === 'checkbox') {
          el.checked = val !== '' && val !== false
            && String(val).toLowerCase() === String(el.value || 'on').toLowerCase();
        } else if (el.type === 'radio') {
          el.checked = String(el.value) === String(val);
        } else {
          el.value = val;
        }
        updateAutofillBadge(el);
      });
    });
    syncAllLinkedFields();
  }

  function refreshAllQuestionNav() {
    wireExclusiveCheckboxGroups();
    if (!window.questionNavControllers) return;
    Object.keys(window.questionNavControllers).forEach(function(sectionId) {
      var controller = window.questionNavControllers[sectionId];
      if (typeof controller === 'function') {
        controller();
      }
    });
  }

  window.refreshAllQuestionNav = refreshAllQuestionNav;

  function wireExclusiveCheckboxGroups() {
    document.querySelectorAll('.checkbox-group-exclusive').forEach(function(group) {
      if (group.dataset.exclusiveWired === 'true') return;
      group.dataset.exclusiveWired = 'true';
      group.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
        cb.addEventListener('change', function() {
          if (!this.checked) return;
          group.querySelectorAll('input[type="checkbox"]').forEach(function(other) {
            if (other !== cb) other.checked = false;
          });
          scheduleSaveFormAnswers();
          refreshAllQuestionNav();
        });
      });
    });
  }

  function wireFormAnswerPersistence() {
    var form = document.getElementById('customForm');
    if (!form || form.dataset.answerPersistWired === 'true') return;
    form.dataset.answerPersistWired = 'true';
    form.querySelectorAll('input, textarea, select').forEach(function(el) {
      el.addEventListener('input', scheduleSaveFormAnswers);
      el.addEventListener('change', scheduleSaveFormAnswers);
    });
  }

  function mergeStateZipParts(state, zip) {
    state = String(state || '').trim();
    zip = String(zip || '').trim();
    if (state && zip) return state + ' ' + zip;
    return state || zip;
  }

  function collectFormData() {
    syncAllLinkedFields();
    var form = document.getElementById('customForm');
    var fd = new FormData();
    if (!form) return fd;
    var values = {};

    form.querySelectorAll('input, textarea, select').forEach(function(el) {
      if (el.disabled || el.type === 'file') return;
      if (el.type === 'checkbox') {
        if (el.checked && el.name) values[el.name] = 'on';
        return;
      }
      if (el.type === 'radio') {
        if (el.checked && el.name) values[el.name] = el.value;
        return;
      }
      if (!el.name) return;
      var value = el.value;
      if (el.type === 'date' && value) value = formatDateForServer(value);
      values[el.name] = value;
    });

    var combineGroups = {};
    form.querySelectorAll('[data-pdf-combine-into]').forEach(function(el) {
      var target = el.getAttribute('data-pdf-combine-into');
      if (!target) return;
      if (!combineGroups[target]) combineGroups[target] = [];
      combineGroups[target].push({
        el: el,
        value: fieldValue(el),
        order: parseInt(el.getAttribute('data-combine-order') || '0', 10) || 0,
        part: el.getAttribute('data-combine-part') || '',
        ownsTarget: el.name === target
      });
    });

    Object.keys(combineGroups).forEach(function(target) {
      var parts = combineGroups[target]
        .sort(function(a, b) { return a.order - b.order; })
        .map(function(item) { return String(item.value || '').trim(); })
        .filter(Boolean);
      if (!parts.length) return;

      var hasTargetPart = combineGroups[target].some(function(item) { return item.ownsTarget; });
      var merged = '';
      if (hasTargetPart) {
        merged = parts.join(' ').replace(/\s+/g, ' ').trim();
      } else {
        var existingPart = values[target] != null ? String(values[target]) : '';
        merged = mergeStateZipParts(parts.join(' '), existingPart);
      }
      if (merged !== '') values[target] = merged;
    });

    Object.keys(values).forEach(function(key) {
      var value = values[key];
      if (value != null && String(value).trim() !== '') fd.append(key, value);
    });

    return fd;
  }

  function updateStepperProgress() {
    var stepper = document.getElementById('stepperProgressBar');
    if (!stepper) return;
    var activeSection = document.querySelector('.section.active');
    var activeStep = 1;
    if (activeSection && activeSection.id) {
      var m = activeSection.id.match(/^section(\\d+)$/);
      if (m) activeStep = parseInt(m[1], 10);
    }
    stepper.querySelectorAll('.stepper-step').forEach(function(step, idx) {
      step.classList.remove('active', 'completed');
      if (idx + 1 < activeStep) step.classList.add('completed');
      else if (idx + 1 === activeStep) step.classList.add('active');
    });
    stepper.querySelectorAll('.stepper-line').forEach(function(line, idx) {
      if (idx < activeStep - 1) line.classList.add('filled');
      else line.classList.remove('filled');
    });
  }

  function wireStepperClicks() {
    var stepper = document.getElementById('stepperProgressBar');
    if (!stepper) return;
    stepper.querySelectorAll('.stepper-step').forEach(function(step) {
      step.style.cursor = 'pointer';
      step.addEventListener('click', function() {
        var stepNum = step.getAttribute('data-step');
        if (!stepNum) return;
        if (typeof window.navigateSection === 'function') {
          window.navigateSection(parseInt(stepNum, 10));
        } else {
          document.querySelectorAll('.section').forEach(function(sec) { sec.classList.remove('active'); });
          var target = document.getElementById('section' + stepNum);
          if (target) target.classList.add('active');
          updateStepperProgress();
        }
      });
    });
  }

  window.currentSectionNumber = 1;
  window.sectionStack = [];

  window.updateProgressBar = updateStepperProgress;

  window.navigateSection = function(sectionNumber, isBackNavigation) {
    var sections = document.querySelectorAll('.section');
    var thankYou = document.getElementById('thankYouMessage');
    var form = document.getElementById('customForm');
    sections.forEach(function(sec) { sec.classList.remove('active'); });
    if (thankYou) thankYou.style.display = 'none';
    if (form) form.style.display = 'block';
    if (sectionNumber === 'end') {
      if (form) form.style.display = 'none';
      if (thankYou) thankYou.style.display = 'block';
      window.currentSectionNumber = 'end';
      updateStepperProgress();
      return;
    }
    var num = parseInt(sectionNumber, 10);
    if (isNaN(num)) return;
    var maxSection = sections.length;
    if (num < 1) num = 1;
    if (num > maxSection) num = maxSection;
    if (!isBackNavigation && typeof window.currentSectionNumber === 'number' && window.currentSectionNumber !== num) {
      window.sectionStack.push(window.currentSectionNumber);
    }
    var target = document.getElementById('section' + num);
    if (target) target.classList.add('active');
    else if (sections[num - 1]) sections[num - 1].classList.add('active');
    window.currentSectionNumber = num;
    updateStepperProgress();
    var sectionId = 'section' + num;
    if (window.questionNavControllers && typeof window.questionNavControllers[sectionId] === 'function') {
      window.questionNavControllers[sectionId](0);
    }
  };

  window.goBack = function() {
    if (window.sectionStack.length > 0) {
      var prev = window.sectionStack.pop();
      var prevNum = typeof prev === 'string' ? parseInt(prev, 10) : prev;
      if (!isNaN(prevNum) && prevNum >= 1) {
        window.navigateSection(prevNum, true);
        return;
      }
    }
    if (typeof window.currentSectionNumber === 'number' && window.currentSectionNumber > 1) {
      window.navigateSection(window.currentSectionNumber - 1, true);
    }
  };

  window.validateAndProceed = function() {
    return false;
  };

  function wireQuestionInfoIcons() {
    document.querySelectorAll('.question-info-wrap').forEach(function(wrap) {
      if (wrap.dataset.infoWired === 'true') return;
      wrap.dataset.infoWired = 'true';
      var btn = wrap.querySelector('.question-info-btn');
      var hideTimer = null;

      function openWrap() {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        wrap.classList.add('open');
      }

      function scheduleClose() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(function() {
          if (!wrap.matches(':hover')) wrap.classList.remove('open');
        }, 250);
      }

      wrap.addEventListener('mouseenter', openWrap);
      wrap.addEventListener('mouseleave', scheduleClose);

      if (btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var isOpen = wrap.classList.contains('open');
          document.querySelectorAll('.question-info-wrap.open').forEach(function(el) {
            if (el !== wrap) el.classList.remove('open');
          });
          if (!isOpen) openWrap();
        });
      }

      var tooltip = wrap.querySelector('.question-info-tooltip');
      if (tooltip) {
        tooltip.addEventListener('mouseenter', openWrap);
        tooltip.addEventListener('mouseleave', scheduleClose);
      }

      var helpBtn = wrap.querySelector('.question-help-btn');
      if (helpBtn) {
        helpBtn.addEventListener('mousedown', function(e) {
          e.stopPropagation();
          openWrap();
        });
      }
    });

    document.addEventListener('click', function(e) {
      if (e.target.closest('.question-info-wrap')) return;
      if (e.target.closest('.auto-form-help-modal')) return;
      document.querySelectorAll('.question-info-wrap.open').forEach(function(el) { el.classList.remove('open'); });
    });
  }

  function findQuestionById(questionId) {
    var targetId = String(questionId);
    var sections = (formConfig && formConfig.sections) || [];
    for (var si = 0; si < sections.length; si += 1) {
      var questions = sections[si].questions || [];
      for (var qi = 0; qi < questions.length; qi += 1) {
        if (String(questions[qi].questionId) === targetId) return questions[qi];
      }
    }
    return null;
  }

  function collectCurrentAnswers() {
    syncAllLinkedFields();
    var answers = {};
    var form = document.getElementById('customForm');
    if (!form) return answers;
    form.querySelectorAll('input, textarea, select').forEach(function(el) {
      if (!el.name || el.disabled || el.type === 'file') return;
      if (el.type === 'checkbox') {
        answers[el.name] = el.checked ? (el.value || 'on') : '';
      } else if (el.type === 'radio') {
        if (el.checked) answers[el.name] = el.value;
      } else if (el.value != null && String(el.value).trim() !== '') {
        answers[el.name] = el.value;
      }
    });
    return answers;
  }

  function triggerFieldEvents(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    updateAutofillBadge(el);
    if (el.hasAttribute('data-autopopulate')) {
      syncProfileFromInput(el, true);
    }
    syncAllLinkedFields();
    scheduleSaveFormAnswers();
  }

  function findFieldElement(nameId) {
    return findPrimaryElement(nameId);
  }

  function applyAutofillItem(item) {
    if (!item || !item.nameId) return false;
    var nameId = item.nameId;
    if (item.checked !== undefined) {
      var cb = findFieldElement(nameId);
      if (cb && cb.type === 'checkbox') {
        cb.checked = Boolean(item.checked);
        triggerFieldEvents(cb);
        return true;
      }
      return false;
    }
    if (item.value === undefined) return false;
    var value = item.value;
    var direct = findFieldElement(nameId);
    if (direct) {
      if (direct.type === 'checkbox' || direct.type === 'radio') {
        var group = document.querySelectorAll('[name="' + nameId.replace(/"/g, '') + '"]:not([data-linked-to])');
        if (group.length > 1) {
          var matched = false;
          group.forEach(function(el) {
            var isMatch = String(el.value).toLowerCase() === String(value).toLowerCase();
            if (el.type === 'radio') {
              el.checked = isMatch;
              if (isMatch) matched = true;
              triggerFieldEvents(el);
            } else if (el.type === 'checkbox') {
              el.checked = isMatch;
              if (isMatch) matched = true;
              triggerFieldEvents(el);
            }
          });
          return matched;
        }
        direct.checked = String(direct.value).toLowerCase() === String(value).toLowerCase();
        triggerFieldEvents(direct);
        return true;
      }
      direct.value = value;
      triggerFieldEvents(direct);
      return true;
    }
    return false;
  }

  function applyAutofillSuggestion(autofill) {
    if (!autofill) return 0;
    var items = Array.isArray(autofill) ? autofill : [autofill];
    var applied = 0;
    items.forEach(function(item) {
      if (applyAutofillItem(item)) applied += 1;
    });
    if (applied > 0) scheduleSaveFormAnswers();
    return applied;
  }

  var helpChatState = {
    question: null,
    history: [],
    pendingAutofill: null,
    loading: false
  };

  function appendHelpMessage(role, text) {
    var container = document.getElementById('autoFormHelpMessages');
    if (!container) return null;
    var div = document.createElement('div');
    div.className = 'auto-form-help-msg ' + role;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function setHelpAutofillVisible(show, autofill) {
    var row = document.getElementById('autoFormHelpAutofillRow');
    helpChatState.pendingAutofill = show ? autofill : null;
    if (row) row.hidden = !show;
  }

  function setHelpLoading(loading) {
    helpChatState.loading = loading;
    var sendBtn = document.getElementById('autoFormHelpSendBtn');
    var input = document.getElementById('autoFormHelpInput');
    if (sendBtn) sendBtn.disabled = loading;
    if (input) input.disabled = loading;
  }

  function closeHelpModal() {
    var modal = document.getElementById('autoFormHelpModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    helpChatState.question = null;
    helpChatState.history = [];
    helpChatState.pendingAutofill = null;
    helpChatState.loading = false;
    var messages = document.getElementById('autoFormHelpMessages');
    if (messages) messages.innerHTML = '';
    setHelpAutofillVisible(false, null);
    setHelpLoading(false);
  }

  function findFieldConfigLabel(nameId) {
    if (!nameId || !fieldConfig || !Array.isArray(fieldConfig.fields)) return '';
    for (var fi = 0; fi < fieldConfig.fields.length; fi += 1) {
      var field = fieldConfig.fields[fi];
      if (field && field.newName === nameId && field.label) return field.label;
    }
    return '';
  }

  function findFieldConfigEntry(nameId) {
    if (!nameId || !fieldConfig || !Array.isArray(fieldConfig.fields)) return null;
    for (var fi = 0; fi < fieldConfig.fields.length; fi += 1) {
      var field = fieldConfig.fields[fi];
      if (field && field.newName === nameId) return field;
    }
    return null;
  }

  function ensureFieldMapPopupStyles() {
    if (document.getElementById('autoFormFieldMapPopupStyles')) return;
    var style = document.createElement('style');
    style.id = 'autoFormFieldMapPopupStyles';
    style.textContent = [
      '#autoFormFieldMapPopup{position:fixed;z-index:10080;min-width:240px;max-width:min(420px,92vw);padding:12px 14px;border:1px solid #c9d4e4;border-radius:12px;background:#fff;box-shadow:0 14px 40px rgba(20,32,51,.22);font:500 13px/1.45 system-ui,sans-serif;color:#142033}',
      '#autoFormFieldMapPopup[hidden]{display:none!important}',
      '#autoFormFieldMapPopup .af-map-title{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#3d4f6a}',
      '#autoFormFieldMapPopup .af-map-row{display:grid;gap:2px;margin:0 0 10px}',
      '#autoFormFieldMapPopup .af-map-row:last-child{margin-bottom:0}',
      '#autoFormFieldMapPopup .af-map-label{font-size:11px;font-weight:600;color:#6b7c93}',
      '#autoFormFieldMapPopup .af-map-value{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;color:#142033}',
      '#autoFormFieldMapPopup .af-map-hint{margin:10px 0 0;font-size:11px;color:#6b7c93}'
    ].join('');
    document.head.appendChild(style);
  }

  function getOrCreateFieldMapPopup() {
    ensureFieldMapPopupStyles();
    var popup = document.getElementById('autoFormFieldMapPopup');
    if (popup) return popup;
    popup = document.createElement('div');
    popup.id = 'autoFormFieldMapPopup';
    popup.hidden = true;
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Field mapping');
    document.body.appendChild(popup);
    return popup;
  }

  function hideFieldMapPopup() {
    var popup = document.getElementById('autoFormFieldMapPopup');
    if (popup) popup.hidden = true;
  }

  function resolveHtmlFieldName(el) {
    if (!el) return '';
    if (el.getAttribute('data-combine-label')) return el.getAttribute('data-combine-label');
    if (el.getAttribute('data-field-label')) return el.getAttribute('data-field-label');
    if (el.getAttribute('placeholder')) return el.getAttribute('placeholder');
    return el.getAttribute('name') || el.id || '';
  }

  function resolvePdfTargetNameId(el) {
    if (!el) return '';
    var combine = el.getAttribute('data-pdf-combine-into');
    if (combine) return combine;
    return el.getAttribute('name') || el.id || '';
  }

  function showFieldMapPopup(el, clientX, clientY) {
    if (!el) return;
    var combine = el.getAttribute('data-pdf-combine-into');
    var combinePart = el.getAttribute('data-combine-part') || '';
    var htmlName = resolveHtmlFieldName(el);
    var pdfNameId = resolvePdfTargetNameId(el);
    var entry = pdfNameId ? findFieldConfigEntry(pdfNameId) : null;
    var pdfFieldName = (entry && entry.newName) || pdfNameId || '(unknown)';
    var originalPdfId = entry && entry.id && entry.id !== pdfFieldName ? entry.id : '';
    var pdfLabel = entry && entry.label ? entry.label : '';
    var combineNote = combine
      ? 'Merges with other parts into PDF field "' + combine + '"' + (combinePart ? ' (this part: ' + combinePart + ')' : '')
      : '';

    var popup = getOrCreateFieldMapPopup();
    popup.innerHTML =
      '<div class="af-map-title">Field mapping</div>' +
      '<div class="af-map-row"><div class="af-map-label">HTML field</div><div class="af-map-value">' +
        String(htmlName || '(unnamed)').replace(/</g, '&lt;') + '</div></div>' +
      '<div class="af-map-row"><div class="af-map-label">PDF field</div><div class="af-map-value">' +
        String(pdfFieldName).replace(/</g, '&lt;') + '</div></div>' +
      (pdfLabel
        ? '<div class="af-map-row"><div class="af-map-label">PDF label</div><div class="af-map-value">' +
          String(pdfLabel).replace(/</g, '&lt;') + '</div></div>'
        : '') +
      (originalPdfId
        ? '<div class="af-map-row"><div class="af-map-label">Original AcroForm id</div><div class="af-map-value">' +
          String(originalPdfId).replace(/</g, '&lt;') + '</div></div>'
        : '') +
      (combineNote
        ? '<div class="af-map-hint">' + String(combineNote).replace(/</g, '&lt;') + '</div>'
        : '') +
      '<div class="af-map-hint">Double-click a field to inspect its mapping. Click elsewhere to close.</div>';

    popup.hidden = false;
    var pad = 12;
    var left = Math.max(pad, Math.min(clientX + 8, window.innerWidth - popup.offsetWidth - pad));
    var top = Math.max(pad, Math.min(clientY + 8, window.innerHeight - popup.offsetHeight - pad));
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
  }

  function wireFieldMappingPopup() {
    if (window.__fieldMapPopupWired) return;
    window.__fieldMapPopupWired = true;

    document.addEventListener('dblclick', function(event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var field = target.closest('input, textarea, select');
      if (!field) return;
      if (field.type === 'hidden' || field.type === 'submit' || field.type === 'button') return;
      if (!field.closest('#customForm, .question-container, form')) return;
      event.preventDefault();
      showFieldMapPopup(field, event.clientX, event.clientY);
    }, true);

    document.addEventListener('click', function(event) {
      var popup = document.getElementById('autoFormFieldMapPopup');
      if (!popup || popup.hidden) return;
      if (popup.contains(event.target)) return;
      hideFieldMapPopup();
    }, true);

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') hideFieldMapPopup();
    }, true);
  }

  function openHelpModal(question) {
    var modal = document.getElementById('autoFormHelpModal');
    var titleEl = document.getElementById('autoFormHelpQuestion');
    var messages = document.getElementById('autoFormHelpMessages');
    var input = document.getElementById('autoFormHelpInput');
    if (!modal || !question) return;
    helpChatState.question = question;
    helpChatState.history = [];
    helpChatState.pendingAutofill = null;
    if (messages) messages.innerHTML = '';
    if (titleEl) {
      var label = question.text || 'This question';
      var pdfLabel = findFieldConfigLabel(question.nameId);
      if (pdfLabel && pdfLabel.toLowerCase() !== String(label).toLowerCase()) {
        label += ' (PDF label: ' + pdfLabel + ')';
      }
      if (question.explanation) label += ' — ' + question.explanation;
      titleEl.textContent = label;
    }
    setHelpAutofillVisible(false, null);
    appendHelpMessage('assistant', 'Hi! I can help you answer this question. Tell me about your situation or ask what this field means.');
    if (input) {
      input.value = '';
      setTimeout(function() { input.focus(); }, 100);
    }
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }

  function isAffirmativeReply(text) {
    return /^(yes|yeah|yep|yup|sure|ok|okay|please|please do|go ahead|autofill|fill it|fill it in|do it)\.?$/i.test(String(text || '').trim());
  }

  async function sendHelpMessage(userText) {
    if (!userText || !String(userText).trim() || helpChatState.loading || !helpChatState.question) return;
    var trimmed = String(userText).trim();
    if (isAffirmativeReply(trimmed) && helpChatState.pendingAutofill) {
      appendHelpMessage('user', trimmed);
      helpChatState.history.push({ role: 'user', content: trimmed });
      var count = applyAutofillSuggestion(helpChatState.pendingAutofill);
      setHelpAutofillVisible(false, null);
      var confirmMsg = count > 0
        ? 'Done! I filled in the answer for you. You can review it on the form.'
        : 'I could not find the field to autofill. Please enter the answer manually.';
      appendHelpMessage('assistant', confirmMsg);
      helpChatState.history.push({ role: 'assistant', content: confirmMsg });
      return;
    }
    appendHelpMessage('user', trimmed);
    helpChatState.history.push({ role: 'user', content: trimmed });
    setHelpLoading(true);
    setHelpAutofillVisible(false, null);
    var loadingEl = appendHelpMessage('loading', 'Thinking...');
    try {
      var res = await fetch('/api/auto-form/help-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question: helpChatState.question,
          formConfig: formConfig,
          fieldConfig: fieldConfig,
          extractedDocumentContent: extractedDocumentContent,
          pdfToken: pdfToken,
          currentAnswers: collectCurrentAnswers(),
          chatHistory: helpChatState.history.slice(0, -1),
          userMessage: trimmed
        })
      });
      if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
      var data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || ('HTTP ' + res.status));
      }
      var reply = data.reply || 'Sorry, I could not generate a response.';
      appendHelpMessage('assistant', reply);
      helpChatState.history.push({ role: 'assistant', content: reply });
      if (data.suggestAutofill && data.autofill) {
        setHelpAutofillVisible(true, data.autofill);
      }
    } catch (err) {
      if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
      appendHelpMessage('assistant', err.message || 'Something went wrong. Please try again.');
    } finally {
      setHelpLoading(false);
    }
  }

  function wireHelpMeAnswer() {
    document.querySelectorAll('.question-help-btn').forEach(function(btn) {
      if (btn.dataset.helpWired === 'true') return;
      btn.dataset.helpWired = 'true';
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var qid = btn.getAttribute('data-help-question-id');
        var question = findQuestionById(qid);
        if (!question) return;
        openHelpModal(question);
      });
    });

    var modal = document.getElementById('autoFormHelpModal');
    if (!modal || modal.dataset.helpWired === 'true') return;
    modal.dataset.helpWired = 'true';

    modal.querySelectorAll('[data-help-close="true"]').forEach(function(el) {
      el.addEventListener('click', closeHelpModal);
    });

    var sendBtn = document.getElementById('autoFormHelpSendBtn');
    var input = document.getElementById('autoFormHelpInput');
    var autofillBtn = document.getElementById('autoFormHelpAutofillBtn');

    if (sendBtn && input) {
      sendBtn.addEventListener('click', function() {
        var text = input.value;
        input.value = '';
        sendHelpMessage(text);
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          var text = input.value;
          input.value = '';
          sendHelpMessage(text);
        }
      });
    }

    if (autofillBtn) {
      autofillBtn.addEventListener('click', function() {
        if (!helpChatState.pendingAutofill) return;
        var count = applyAutofillSuggestion(helpChatState.pendingAutofill);
        setHelpAutofillVisible(false, null);
        if (count > 0) {
          appendHelpMessage('assistant', 'Done! I filled in the answer for you. You can review it on the form.');
          helpChatState.history.push({ role: 'assistant', content: 'Autofilled the answer on the form.' });
        } else {
          appendHelpMessage('assistant', 'I could not find the field to autofill. Please enter the answer manually.');
        }
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal && !modal.hidden) closeHelpModal();
    });
  }

  window.goBackToForm = function() {
    var thankYou = document.getElementById('thankYouMessage');
    var questions = document.getElementById('questions');
    var form = document.getElementById('customForm');
    if (thankYou) thankYou.style.display = 'none';
    if (questions) questions.style.display = '';
    if (form) form.style.display = 'block';
    var previewWrap = document.getElementById('thank-you-pdf-preview-wrap');
    var previewFrame = document.getElementById('filled-pdf-preview');
    if (previewWrap) previewWrap.hidden = true;
    if (previewFrame) previewFrame.removeAttribute('src');
    if (typeof window.navigateSection === 'function') {
      var sections = document.querySelectorAll('.section');
      var lastNum = sections.length || 1;
      window.navigateSection(lastNum, true);
    }
  };

  window.__autoFormRequestSubmit = function() {
    var formEl = document.getElementById('customForm');
    if (!formEl) return;
    if (typeof formEl.requestSubmit === 'function') {
      formEl.requestSubmit();
    } else if (typeof window.__autoFormHandleSubmit === 'function') {
      window.__autoFormHandleSubmit({ preventDefault: function() {} });
    }
  };

  function findGateElementByQuestionId(questionId) {
    var qid = String(questionId || '');
    if (!qid) return null;
    return document.querySelector('.question-container[data-question-id="' + qid.replace(/"/g, '') + '"]');
  }

  function getGateAnswerFromContainer(container) {
    if (!container) return '';
    var select = container.querySelector('select.logic-gate-select, select[data-is-logic-gate="true"], select');
    if (select) return getControlAnswerValue(select);
    var checked = container.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked');
    if (checked.length) {
      return Array.from(checked).map(function(el) {
        return (el.value || el.parentElement?.textContent || 'Yes').trim();
      }).join('|');
    }
    return '';
  }

  function getControlAnswerValue(el) {
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked ? (el.value || 'Yes') : '';
    if (el.type === 'radio') return el.checked ? el.value : '';
    return el.value || '';
  }

  function evaluateConditionalVisibility() {
    document.querySelectorAll('.logic-gated').forEach(function(container) {
      var prevQ = container.getAttribute('data-logic-prev-question');
      var expect = (container.getAttribute('data-logic-prev-answer') || 'Yes').toLowerCase();
      var gateContainer = findGateElementByQuestionId(prevQ);
      var val = getGateAnswerFromContainer(gateContainer).toString().toLowerCase();
      var answers = val.split('|').filter(Boolean);
      var show = (expect === '*' && answers.length > 0)
        || answers.some(function(answer) { return answer === expect || answer.indexOf(expect) >= 0; });
      if (show) container.classList.remove('hidden');
      else container.classList.add('hidden');
    });
    if (typeof window.refreshAllQuestionNav === 'function') {
      window.refreshAllQuestionNav();
    }
  }

  function wireConditionalLogic() {
    if (window.__conditionalLogicWired) {
      evaluateConditionalVisibility();
      return;
    }
    window.__conditionalLogicWired = true;
    document.querySelectorAll('.logic-gate-select, select[data-is-logic-gate="true"]').forEach(function(el) {
      el.addEventListener('change', evaluateConditionalVisibility);
      el.addEventListener('input', evaluateConditionalVisibility);
    });
    document.querySelectorAll('.question-container input[type="checkbox"], .question-container input[type="radio"]').forEach(function(el) {
      el.addEventListener('change', evaluateConditionalVisibility);
    });
    evaluateConditionalVisibility();
  }

  function applyAutoTodayDates() {
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    var iso = yyyy + '-' + mm + '-' + dd;
    var us = mm + '/' + dd + '/' + yyyy;

    document.querySelectorAll('.auto-today-date').forEach(function(container) {
      var dateInput = container.querySelector('input[type="date"]');
      var textInput = container.querySelector('input[type="text"]');
      if (dateInput) dateInput.value = iso;
      if (textInput) textInput.value = us;
    });

    var currentDateHidden = document.getElementById('current_date');
    if (currentDateHidden) currentDateHidden.value = us;
  }

  function demoValueForField(el) {
    var name = String(el.name || el.id || '').toLowerCase();
    var type = String(el.type || '').toLowerCase();
    var tag = String(el.tagName || '').toLowerCase();
    var placeholder = String(el.placeholder || '').toLowerCase();
    var blob = name + ' ' + placeholder;

    if (type === 'date') return '1990-06-15';
    if (type === 'tel' || /phone|telephone/.test(blob)) return '(555) 123-4567';
    if (type === 'email' || /email/.test(blob)) return 'demo.user@example.com';
    if (type === 'number' || /amount|money|fee/.test(blob)) return '25.00';
    if (tag === 'textarea') return '123 Demo Street, Suite 100';

    if (/ori/.test(blob)) return 'CA0349400';
    if (/mail.?code/.test(blob)) return '12345';
    if (/billing/.test(blob)) return 'BILL-90876';
    if (/oca|your_number|your number/.test(blob)) return 'OCA-445566';
    if (/ati/.test(blob)) return 'A1234567890';
    if (/ssn|social.?security/.test(blob)) return '123-45-6789';
    if (/ein|employer.?identification|tin_ein/.test(blob)) return '12-3456789';
    if (/tin|taxpayer.?identification|tin_ssn/.test(blob)) return '123-45-6789';
    if (/driver|dl.?number|license.?number/.test(blob)) return 'D1234567';
    if (/zip/.test(blob)) return '94105';
    if (/state/.test(blob) && !/statement/.test(blob)) return 'CA';
    if (/city/.test(blob)) return 'San Francisco';
    if (/street|address|p.?o.?\\s*box/.test(blob)) return '123 Market Street';
    if (/first.?name|firstname/.test(blob)) return 'Jordan';
    if (/last.?name|lastname/.test(blob)) return 'Lee';
    if (/middle/.test(blob)) return 'A';
    if (/suffix/.test(blob)) return 'Jr';
    if (/contact.?name|agency.?authorized/.test(blob)) return 'Alex Rivera';
    if (/employer.?name|emplname/.test(blob)) return 'Acme Services LLC';
    if (/business.?name|taxpayer.?name|name.?of.?entity|name.?as.?shown/.test(blob)) return 'Jordan Lee';
    if (/requester|name.?for/.test(blob)) return 'Alex Rivera';
    if (/account.?number/.test(blob)) return 'ACC-778899';
    if (/exempt.?payee/.test(blob)) return '';
    if (/fatca/.test(blob)) return '';
    if (/height/.test(blob)) return '5 ft 10 in';
    if (/weight/.test(blob)) return '170';
    if (/eye/.test(blob)) return 'BRO';
    if (/hair/.test(blob)) return 'BLK';
    if (/place.?of.?birth|pob/.test(blob)) return 'CA';
    if (/misc/.test(blob)) return 'N/A';
    if (/authorized.?applicant|applicant.?type/.test(blob)) return 'VOLUNTEER';
    if (/type.?of.?license|working.?title|license/.test(blob)) return 'Teacher';
    if (/classif.*code|llc.*code|tax_classification_code/.test(blob)) return 'C';
    if (/other.?tax.?classif|tax_classification_other/.test(blob)) return 'Non-profit organization';
    if (/dob|birth|date/.test(blob)) return '06/15/1990';
    if (/phone|telephone/.test(blob)) return '(555) 123-4567';

    return 'Demo Value';
  }

  function setControlValue(el, value) {
    if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = Boolean(value);
    } else if (el.tagName === 'SELECT') {
      el.value = value;
      if (!el.value && el.options && el.options.length) {
        for (var i = 0; i < el.options.length; i += 1) {
          if (el.options[i].value) {
            el.value = el.options[i].value;
            break;
          }
        }
      }
    } else {
      el.value = value == null ? '' : String(value);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillAllDemoFields() {
    var filled = 0;

    // Show logic-gated questions by answering Yes/selected parent options first
    document.querySelectorAll('select.logic-gate-select, select[data-is-logic-gate="true"]').forEach(function(sel) {
      var yesOpt = Array.from(sel.options || []).find(function(o) {
        return String(o.value || '').toLowerCase() === 'yes';
      });
      setControlValue(sel, yesOpt ? yesOpt.value : (sel.options[1] && sel.options[1].value) || 'Yes');
      filled += 1;
    });

    // Prefer a sensible single checkbox in multi-option groups
    var checkboxGroups = {};
    document.querySelectorAll('.question-container input[type="checkbox"]').forEach(function(cb) {
      var container = cb.closest('.question-container');
      var qid = container ? container.getAttribute('data-question-id') : cb.name;
      if (!checkboxGroups[qid]) checkboxGroups[qid] = [];
      checkboxGroups[qid].push(cb);
    });
    Object.keys(checkboxGroups).forEach(function(qid) {
      var boxes = checkboxGroups[qid];
      var prefer = boxes.find(function(cb) {
        var label = String(cb.value || cb.parentElement && cb.parentElement.textContent || '').toLowerCase();
        var name = String(cb.name || '').toLowerCase();
        return /individual|sole|male(?!vol)|c corporation|^yes$/.test(label)
          || /individual|_male$|_doj$/.test(name);
      }) || boxes[0];
      boxes.forEach(function(cb) {
        setControlValue(cb, cb === prefer);
        filled += 1;
      });
    });

    document.querySelectorAll('.question-container select:not(.logic-gate-select):not([data-is-logic-gate="true"])').forEach(function(sel) {
      if (sel.hasAttribute('data-linked-to')) return;
      var yesOpt = Array.from(sel.options || []).find(function(o) {
        return String(o.value || '').toLowerCase() === 'yes';
      });
      setControlValue(sel, yesOpt ? yesOpt.value : null);
      filled += 1;
    });

    document.querySelectorAll('.question-container input[type="text"], .question-container input[type="tel"], .question-container input[type="email"], .question-container input[type="number"], .question-container input[type="date"], .question-container textarea').forEach(function(el) {
      if (el.hasAttribute('data-linked-to')) return;
      if (el.closest('.auto-today-date')) return;
      var val = demoValueForField(el);
      if (val === '') return;
      setControlValue(el, val);
      filled += 1;
    });

    applyAutoTodayDates();
    if (typeof syncAllLinkedFields === 'function') syncAllLinkedFields();
    if (typeof evaluateConditionalVisibility === 'function') evaluateConditionalVisibility();
    if (typeof refreshAllQuestionNav === 'function') refreshAllQuestionNav();

    if (window.__demoFillToastTimer) clearTimeout(window.__demoFillToastTimer);
    var toast = document.getElementById('demoFillToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'demoFillToast';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10060;background:#111827;color:#fff;padding:12px 18px;border-radius:999px;font:600 14px/1.2 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);';
      document.body.appendChild(toast);
    }
    toast.textContent = 'Demo fill applied (' + filled + ' fields)';
    toast.style.display = 'block';
    window.__demoFillToastTimer = setTimeout(function() {
      toast.style.display = 'none';
    }, 2200);
  }

  function wireDemoFillShortcut() {
    if (window.__demoFillShortcutWired) return;
    window.__demoFillShortcutWired = true;
    document.addEventListener('keydown', function(e) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      // Ctrl/Cmd + Shift alone (second modifier keydown), not Ctrl+Shift+Letter
      if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Meta') return;
      if (e.repeat) return;
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        // Still allow from focused fields for demo convenience
      }
      e.preventDefault();
      fillAllDemoFields();
    });
    window.__autoFormFillDemo = fillAllDemoFields;
  }

  function showAutoFormThankYou(previewUrl) {
    window.__lastFilledPdfUrl = previewUrl;
    var questions = document.getElementById('questions');
    var form = document.getElementById('customForm');
    var thankYou = document.getElementById('thankYouMessage');

    document.querySelectorAll('.section').forEach(function(sec) { sec.classList.remove('active'); });

    if (form) form.style.display = 'none';
    if (questions) questions.style.display = '';

    if (thankYou) {
      thankYou.style.setProperty('display', 'block', 'important');
      thankYou.setAttribute('aria-hidden', 'false');

      var previewWrap = document.getElementById('thank-you-pdf-preview-wrap');
      var previewFrame = document.getElementById('filled-pdf-preview');
      if (previewFrame && previewUrl) {
        previewFrame.src = previewUrl;
      }
      if (previewWrap) {
        previewWrap.hidden = false;
        previewWrap.style.display = 'block';
      }

      var viewBtn = document.getElementById('autoFormViewPdfBtn');
      if (viewBtn && !viewBtn.dataset.autoFormWired) {
        viewBtn.dataset.autoFormWired = 'true';
        viewBtn.addEventListener('click', function() {
          if (previewFrame && window.__lastFilledPdfUrl) {
            previewFrame.src = window.__lastFilledPdfUrl;
          }
          if (previewWrap) {
            previewWrap.hidden = false;
            previewWrap.style.display = 'block';
            previewWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }

      thankYou.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.currentSectionNumber = 'end';
    if (typeof window.updateProgressBar === 'function') window.updateProgressBar();
  }

  document.addEventListener('DOMContentLoaded', function() {
    applyProfileToForm();
    applyAutoTodayDates();
    restoreFormAnswersFromCookies();
    wireLinkedFields();
    wireConditionalLogic();
    wireDemoFillShortcut();
    wireFieldMappingPopup();
    refreshAllQuestionNav();
    wireQuestionInfoIcons();
    wireHelpMeAnswer();
    wireFormAnswerPersistence();
    updateStepperProgress();
    wireStepperClicks();
    var observer = new MutationObserver(updateStepperProgress);
    document.querySelectorAll('.section').forEach(function(sec) {
      observer.observe(sec, { attributes: true, attributeFilter: ['class'] });
    });
    if (displayMode === 'all_at_once') {
      setTimeout(function() {
        document.querySelectorAll('.question-container.question-item').forEach(function(el) {
          el.classList.remove('question-step-hidden');
        });
        document.querySelectorAll('.section').forEach(function(sec) {
          sec.classList.add('active');
        });
        document.querySelectorAll('.question-nav').forEach(function(nav) {
          nav.style.display = 'none';
        });
      }, 150);
    }
  });

  window.__autoFormHandleSubmit = async function(event) {
    if (event) event.preventDefault();
    if (!pdfToken) {
      alert('PDF template not available. Re-run Step 5 in the Auto-Form Creator demo.');
      return false;
    }
    try {
      var fd = collectFormData();
      var res = await fetch('/api/auto-form/fill-pdf/' + encodeURIComponent(pdfToken), {
        method: 'POST',
        body: fd,
        credentials: 'include'
      });
      if (!res.ok) {
        var errText = await res.text();
        var errMsg = 'HTTP ' + res.status;
        try { var errJson = JSON.parse(errText); if (errJson.error) errMsg = errJson.error; } catch (ignore) { if (errText) errMsg = errText; }
        throw new Error(errMsg);
      }
      var blob = await res.blob();
      if (!blob.size) throw new Error('Received empty PDF');
      var previewUrl = URL.createObjectURL(blob);
      showAutoFormThankYou(previewUrl);
    } catch (err) {
      console.error('Submit error:', err);
      alert(err.message || 'Failed to generate PDF preview');
    }
    return false;
  };
})();
<\/script>`;
  }

  function applyTemplate(templateHtml, replacements) {
    let html = templateHtml;
    Object.keys(replacements).forEach((key) => {
      html = html.split(key).join(replacements[key]);
    });
    return html;
  }

  function resolveTemplate(options) {
    const templateHtml = options.templateHtml || cachedDefaultTemplate;
    if (!templateHtml) {
      throw new Error('Form template not loaded. Wait for the default template to load or upload a custom template.');
    }
    if (!templateHtml.includes(PLACEHOLDER_BODY)) {
      throw new Error('Template must contain the placeholder ' + PLACEHOLDER_BODY);
    }
    return templateHtml;
  }

  function hideAuthChromeForNormalMode(html) {
    const hideCss = [
      '<style>',
      'body.html-mode-normal .header-actions,',
      'body.html-mode-normal #sign-in-btn,',
      'body.html-mode-normal #logout-btn,',
      'body.html-mode-normal #signinRequiredModal { display: none !important; }',
      '</style>',
    ].join('\n');
    if (html.includes('</head>')) {
      return html.replace('</head>', `${hideCss}\n</head>`).replace('<body', '<body class="html-mode-normal"');
    }
    return hideCss + html;
  }

  function buildFormHtml(formConfig, userProfile, options) {
    options = options || {};
    const firebaseConfig = options.firebaseConfig || null;
    const htmlMode = options.htmlMode || formConfig.htmlMode || 'dev';
    const devMode = htmlMode !== 'normal';
    const pdfToken = options.pdfToken || formConfig.pdfToken || null;
    const fieldConfig = options.fieldConfig || formConfig.fieldConfig || null;
    const extractedDocumentContent = options.extractedDocumentContent || formConfig.extractedDocumentContent || '';
    const title = esc(formConfig.formTitle || 'Generated Form');
    const templateHtml = resolveTemplate(options);

    const bodyHtml = buildSectionsHtml(formConfig, userProfile || {}, devMode);
    const runtimeScripts = buildRuntimeScripts(
      firebaseConfig,
      devMode,
      pdfToken,
      userProfile,
      formConfig.displayMode,
      formConfig,
      fieldConfig,
      extractedDocumentContent
    );

    let html = applyTemplate(templateHtml, {
      [PLACEHOLDER_TITLE]: title,
      [PLACEHOLDER_BODY]: bodyHtml,
      [PLACEHOLDER_RUNTIME]: runtimeScripts
    });
    if (!devMode) {
      html = hideAuthChromeForNormalMode(html);
    }
    return html;
  }

  function preloadDefaultTemplate(url) {
    url = url || DEFAULT_TEMPLATE_URL;
    return fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load form template (' + res.status + ')');
        return res.text();
      })
      .then((text) => {
        cachedDefaultTemplate = text;
        return text;
      });
  }

  function setDefaultTemplate(html) {
    cachedDefaultTemplate = html;
  }

  global.FormHtmlRenderer = {
    build: buildFormHtml,
    preloadDefaultTemplate,
    setDefaultTemplate,
    PLACEHOLDER_BODY,
    DEFAULT_TEMPLATE_URL
  };
})(typeof window !== 'undefined' ? window : globalThis);
