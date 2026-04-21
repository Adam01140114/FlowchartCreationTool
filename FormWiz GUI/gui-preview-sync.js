/**
 * Keeps #previewFrameInline in sync with generated form HTML (same source as modal Preview).
 * MutationObserver does NOT see typing in <input>/<textarea> (value is not a DOM mutation), so we
 * also listen for input/change across the app and debounce a refresh.
 *
 * Auto-refresh can be turned off in Form Settings (stored in localStorage). When off, only the
 * "Refresh" button in the preview panel updates the iframe.
 */
(function () {
    var DEBOUNCE_MS = 350;
    var STORAGE_KEY = 'fw_preview_auto_refresh';

    var pending = null;

    function isAutoRefreshEnabled() {
        try {
            var v = localStorage.getItem(STORAGE_KEY);
            if (v === null || v === '') return true;
            return v !== '0' && v !== 'false';
        } catch (e) {
            return true;
        }
    }

    function placeholderSrcdoc() {
        return (
            "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>" +
            "body{font:14px/1.5 Arial,Helvetica,sans-serif;background:#f0f2f5;color:#475569;margin:0;padding:20px}" +
            "</style></head><body><p style=\"margin:0\">This panel shows the same HTML as <strong>Preview</strong>. " +
            "Add a section and questions — the panel refreshes shortly after you type or change the form.</p></body></html>"
        );
    }

    function trySyncInline() {
        if (typeof getFormHTML !== 'function') return;
        var html;
        try {
            html = getFormHTML();
        } catch (e) {
            return;
        }
        if (!html || !html.includes('customForm') || !html.includes('question')) return;
        var inline = document.getElementById('previewFrameInline');
        if (inline) inline.srcdoc = html;
    }

    function scheduleSync() {
        if (!isAutoRefreshEnabled()) return;
        clearTimeout(pending);
        pending = setTimeout(function () {
            pending = null;
            trySyncInline();
        }, DEBOUNCE_MS);
    }

    /** Called after import / programmatic field updates (no input event). */
    window.fwSchedulePreviewSync = function () {
        if (!isAutoRefreshEnabled()) return;
        scheduleSync();
    };

    /** Run immediately (manual Refresh). */
    window.fwRefreshInlinePreview = function () {
        clearTimeout(pending);
        pending = null;
        trySyncInline();
    };

    window.fwSyncPreviewAutoRefreshToggleFromStorage = function () {
        var toggle = document.getElementById('fwPreviewAutoRefreshToggle');
        if (!toggle) return;
        toggle.checked = isAutoRefreshEnabled();
        window.fwApplyPreviewAutoRefreshUI();
    };

    window.fwApplyPreviewAutoRefreshUI = function () {
        var toggle = document.getElementById('fwPreviewAutoRefreshToggle');
        var btn = document.getElementById('fwPreviewManualRefreshBtn');
        var hint = document.querySelector('.fw-preview-head .fw-hint');
        var on = !toggle || toggle.checked;
        if (btn) {
            btn.style.display = on ? 'none' : 'inline-flex';
        }
        if (hint) {
            hint.innerHTML = on
                ? 'Same generated HTML as <strong>Preview</strong> / the modal. Refreshes shortly after you change the form. Drag the vertical divider to resize the panels.'
                : 'Auto-refresh is <strong>off</strong>. Click <strong>Refresh</strong> after edits to update the preview (reduces lag while editing large forms).';
        }
    };

    function isPreviewRelevantTarget(t) {
        if (!t || !t.closest) return false;
        if (t.closest('.fw-preview-pane') || t.id === 'previewFrameInline') return false;
        if (t.closest('#pasteJsonModal') || t.closest('#jsonLibraryModal') || t.closest('#previewModal')) {
            return false;
        }
        if (t.id === 'fwPreviewAutoRefreshToggle' || t.closest('.fw-settings-checkbox-panel')) {
            return false;
        }
        return !!t.closest('.gui-app');
    }

    window.addEventListener('load', function () {
        var inline = document.getElementById('previewFrameInline');
        if (inline) {
            try {
                inline.srcdoc = placeholderSrcdoc();
            } catch (e) {}
        }

        var refreshBtn = document.getElementById('fwPreviewManualRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                window.fwRefreshInlinePreview();
            });
        }

        var toggle = document.getElementById('fwPreviewAutoRefreshToggle');
        if (toggle) {
            toggle.checked = isAutoRefreshEnabled();
            toggle.addEventListener('change', function () {
                try {
                    localStorage.setItem(STORAGE_KEY, toggle.checked ? '1' : '0');
                } catch (e) { /* ignore */ }
                clearTimeout(pending);
                pending = null;
                window.fwApplyPreviewAutoRefreshUI();
                if (toggle.checked) {
                    scheduleSync();
                }
            });
        }
        window.fwApplyPreviewAutoRefreshUI();

        var app = document.querySelector('.gui-app');
        if (!app) return;

        app.addEventListener(
            'input',
            function (e) {
                if (isPreviewRelevantTarget(e.target)) scheduleSync();
            },
            true
        );
        app.addEventListener(
            'change',
            function (e) {
                if (e.target && e.target.id === 'fwPreviewAutoRefreshToggle') return;
                if (isPreviewRelevantTarget(e.target)) scheduleSync();
            },
            true
        );

        var fb = document.getElementById('formBuilder');
        if (fb) {
            var obsT;
            var obs = new MutationObserver(function () {
                if (!isAutoRefreshEnabled()) return;
                clearTimeout(obsT);
                obsT = setTimeout(scheduleSync, DEBOUNCE_MS);
            });
            obs.observe(fb, { childList: true, subtree: true, attributes: true, characterData: true });
        }

        if (isAutoRefreshEnabled()) {
            scheduleSync();
        } else {
            trySyncInline();
        }
    });
})();

