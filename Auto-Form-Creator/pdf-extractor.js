/**
 * PDF form field extractor — structured per-field context for AI pipeline.
 */
(function (global) {
    'use strict';

    const LINE_THRESHOLD = 10;
    const WORD_SPACING_THRESHOLD = 1;

    const BOILERPLATE_RE = [
        /page\s*\d+\s*of\s*\d+/gi,
        /state\s+of\s+\w+/gi,
        /department\s+of\s+justice/gi,
        /request\s+for\s+live\s+scan\s+service/gi,
        /bcia\s*\d+/gi,
        /\(rev\.\s*[\d/]+\)/gi,
        /applicant\s+submission/gi,
    ];

    const SECTION_HEADER_RE = [
        /^contributing\s+agency/i,
        /^applicant\s+submission/i,
        /^applicant\s+information/i,
        /^employer\b/i,
        /^live\s+scan\s+transaction\s+completed/i,
        /^agency\b/i,
        /^authorized\s+agency/i,
        /^service\s+level/i,
    ];

    function ensurePdfWorker() {
        if (global.pdfjsLib && !global.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            global.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }

    function isFillableCheckboxField(annotation) {
        return annotation.fieldType === 'Btn' && annotation.checkBox === true;
    }

    function isFillableDropdownField(annotation) {
        return annotation.fieldType === 'Ch';
    }

    function isExtractableFormField(annotation) {
        return annotation.fieldType === 'Tx'
            || isFillableCheckboxField(annotation)
            || isFillableDropdownField(annotation);
    }

    function sanitizeLabelText(raw) {
        let text = String(raw || '').trim();
        for (const re of BOILERPLATE_RE) {
            text = text.replace(re, ' ');
        }
        text = text.replace(/\[\[[^\]]+\]\]/g, ' ').replace(/\{\{[^}]+\}\}/g, ' ');
        text = text.replace(/\s+/g, ' ').trim();
        text = text.replace(/[:;,.]+$/, '').trim();
        if (text.length > 60) {
            const words = text.split(/\s+/);
            text = words.slice(-6).join(' ');
        }
        return text;
    }

    function isGarbageLabel(text) {
        const t = String(text || '').trim();
        if (!t || t.length > 80) return true;
        return /page\s*\d|department\s+of\s+justice|state\s+of\s+|request\s+for\s+|bcia\s*\d/i.test(t);
    }

    function normalizeSectionHint(raw) {
        const text = String(raw || '').trim().replace(/:+$/, '');
        if (!text) return 'General';
        if (/contributing\s+agency|agency\s+authorized|applicant\s+submission/i.test(text)) return 'Agency';
        if (/applicant\s+information/i.test(text)) return 'Applicant';
        if (/employer/i.test(text)) return 'Employer';
        if (/live\s+scan\s+transaction\s+completed|operator|transmitting\s+agency|lsid|amount\s+collected/i.test(text)) return 'Operator';
        if (/service\s+level|level\s+of\s+service/i.test(text)) return 'Service';
        if (/signature|privacy/i.test(text)) return 'Legal';
        const short = text.split(/\s+/).slice(0, 3).join(' ');
        if (/^transaction$/i.test(short)) return 'General';
        return short || 'General';
    }

    function sectionHintForField(fieldY, pageSectionHeaders) {
        if (!pageSectionHeaders.length) return 'General';
        for (const header of pageSectionHeaders) {
            if (fieldY <= header.y + LINE_THRESHOLD * 2) {
                return header.hint;
            }
        }
        return pageSectionHeaders[pageSectionHeaders.length - 1].hint;
    }

    function isSectionHeaderText(text) {
        const line = String(text || '').trim();
        if (!line || line.length > 80) return false;
        if (/:$/.test(line) && line.length < 60) return true;
        return SECTION_HEADER_RE.some((re) => re.test(line));
    }

    function findNearestLabel(field, lines) {
        const fieldX = field.xStart;
        const fieldY = field.centerY;
        let best = '';
        let bestDist = Infinity;

        for (const line of lines) {
            const yDist = Math.abs(line.y - fieldY);
            const sameRow = yDist <= LINE_THRESHOLD;
            if (yDist > LINE_THRESHOLD * 2) continue;

            const lineText = line.items
                .filter((item) => item.type === 'text')
                .map((item) => item.text)
                .join(' ')
                .trim();
            if (isSectionHeaderText(lineText)) continue;

            const textParts = line.items
                .filter((item) => item.type === 'text')
                .sort((a, b) => a.xStart - b.xStart);

            for (const item of textParts) {
                if (item.xEnd > fieldX + 5) continue;
                const gap = fieldX - item.xEnd;
                if (gap < -20 || gap > 250) continue;
                const yWeight = sameRow ? 1 : 40;
                const dist = yDist * yWeight + Math.abs(gap);
                const candidate = item.text.trim();
                if (dist < bestDist && candidate && !isSectionHeaderText(candidate)) {
                    bestDist = dist;
                    best = candidate;
                }
            }
        }

        if (!best) {
            const sameLine = lines.find((ln) => Math.abs(ln.y - fieldY) < LINE_THRESHOLD);
            if (sameLine) {
                const lineText = sameLine.items
                    .filter((item) => item.type === 'text')
                    .map((item) => item.text)
                    .join(' ')
                    .trim();
                if (!isSectionHeaderText(lineText)) {
                    const beforeField = sameLine.items
                        .filter((item) => item.type === 'text' && item.xEnd <= fieldX + 5)
                        .sort((a, b) => a.xStart - b.xStart);
                    if (beforeField.length) {
                        best = beforeField.map((item) => item.text).join(' ').trim();
                    }
                }
            }
        }

        const sanitized = sanitizeLabelText(best);
        return isGarbageLabel(sanitized) || isSectionHeaderText(sanitized) ? '' : sanitized;
    }

  /**
     * Extract form fields and document layout from a PDF ArrayBuffer.
     * @returns {Promise<{
     *   fullContentHtml: string,
     *   extractedDocumentContent: string,
     *   textFields: Array,
     *   checkboxFields: Array,
     *   structuredFields: Array
     * }>}
     */
    async function extractPdfFormFields(arrayBuffer) {
        ensurePdfWorker();

        const originalPdfBytes = new Uint8Array(arrayBuffer);
        const pdf = await global.pdfjsLib.getDocument({ data: originalPdfBytes }).promise;

        const textFields = [];
        const checkboxFields = [];
        const structuredFields = [];
        const allPagesContent = [];
        const plainTextPages = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const annotations = await page.getAnnotations();

            const textItems = textContent.items.map(item => ({
                type: 'text',
                text: item.str,
                xStart: item.transform[4],
                xEnd: item.transform[4] + (item.str.length * 0.6 * Math.abs(item.transform[0])),
                y: item.transform[5]
            }));

            textItems.sort((a, b) => b.y - a.y || a.xStart - b.xStart);

            const lines = [];
            let currentLine = { y: null, items: [] };

            textItems.forEach(ti => {
                if (!currentLine.y || Math.abs(currentLine.y - ti.y) < LINE_THRESHOLD) {
                    currentLine.items.push(ti);
                    currentLine.y = currentLine.y || ti.y;
                } else {
                    lines.push(currentLine);
                    currentLine = { y: ti.y, items: [ti] };
                }
            });
            if (currentLine.items.length) lines.push(currentLine);

            const pageSectionHeaders = [];
            for (const line of lines) {
                const lineText = line.items
                    .filter((item) => item.type === 'text')
                    .map((item) => item.text)
                    .join(' ')
                    .trim();
                if (isSectionHeaderText(lineText)) {
                    pageSectionHeaders.push({
                        y: line.y,
                        hint: normalizeSectionHint(lineText),
                    });
                }
            }
            pageSectionHeaders.sort((a, b) => b.y - a.y);

            const pageFields = annotations
                .filter(isExtractableFormField)
                .map(a => ({
                    name: a.fieldName || 'Unnamed Field',
                    type: 'field',
                    fieldType: a.fieldType,
                    isCheckbox: isFillableCheckboxField(a),
                    isDropdown: isFillableDropdownField(a),
                    xStart: (a.rect[0] + a.rect[2]) / 2,
                    xEnd: (a.rect[0] + a.rect[2]) / 2,
                    centerY: (a.rect[1] + a.rect[3]) / 2,
                    page: pageNum,
                }));

            pageFields.sort((a, b) => b.centerY - a.centerY || a.xStart - b.xStart);

            pageFields.forEach(field => {
                const closestLine = lines.reduce((closest, ln) =>
                    Math.abs(ln.y - field.centerY) < Math.abs(closest.y - field.centerY) ? ln : closest
                , lines[0] || { y: field.centerY, items: [] });

                field.text = field.isCheckbox ? `{{${field.name}}}` : `[[${field.name}]]`;
                const nearestLabel = findNearestLabel(field, lines)
                    || (field.isDropdown ? 'State' : '');
                const sectionHint = sectionHintForField(field.centerY, pageSectionHeaders);

                const structuredEntry = {
                    id: field.name,
                    name: field.name,
                    type: field.isCheckbox ? 'checkbox' : (field.isDropdown ? 'dropdown' : 'text'),
                    page: pageNum,
                    position: { x: Math.round(field.xStart), y: Math.round(field.centerY) },
                    nearestLabel: nearestLabel || null,
                    sanitizedLabel: nearestLabel || null,
                    sectionHint,
                };
                structuredFields.push(structuredEntry);

                const enriched = {
                    name: field.name,
                    marker: field.text,
                    page: pageNum,
                    nearestLabel,
                    sectionHint,
                };

                if (field.isCheckbox) {
                    checkboxFields.push(enriched);
                } else if (field.isDropdown) {
                    textFields.push({ ...enriched, fieldType: 'dropdown' });
                } else {
                    textFields.push(enriched);
                }

                closestLine.items.push(field);
            });

            const pageContent = lines.map(ln => {
                ln.items.sort((a, b) => a.xStart - b.xStart);
                const lineParts = [];
                const plainParts = [];

                ln.items.forEach((item, i) => {
                    if (item.type === 'field') {
                        const className = item.isCheckbox ? 'checkbox-highlight' : 'field-highlight';
                        lineParts.push(`<span class="${className}">${item.text}</span>`);
                        plainParts.push(` ${item.text} `);
                    } else {
                        const prev = ln.items[i - 1];
                        const gap = prev ? item.xStart - prev.xEnd : 0;
                        const spacer = gap > WORD_SPACING_THRESHOLD ? ' ' : '';
                        lineParts.push(spacer + item.text);
                        plainParts.push(spacer + item.text);
                    }
                });

                return {
                    html: `<div class="text-line">${lineParts.join('')}</div>`,
                    plain: plainParts.join('').replace(/\s+/g, ' ').trim(),
                };
            });

            allPagesContent.push(pageContent.map((line) => line.html).join(''));
            plainTextPages.push(
                pageContent
                    .map((line) => line.plain)
                    .filter(Boolean)
                    .join('\n')
            );
        }

        const extractedDocumentContent = plainTextPages
            .map((pageText, idx) => `--- PAGE ${idx + 1} ---\n${pageText}`)
            .join('\n\n');

        return {
            fullContentHtml: allPagesContent.join('<div class="page-break"></div>'),
            extractedDocumentContent,
            textFields,
            checkboxFields,
            structuredFields,
        };
    }

    global.PdfFieldExtractor = { extract: extractPdfFormFields };
})(typeof window !== 'undefined' ? window : globalThis);
