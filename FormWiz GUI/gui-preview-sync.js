/**
 * Keeps #previewFrameInline in sync with generated form HTML (same source as modal Preview).
 * MutationObserver does NOT see typing in <input>/<textarea> (value is not a DOM mutation), so we
 * also listen for input/change across the app and debounce a refresh.
 */
(function () {
    var DEBOUNCE_MS = 350;

    var pending = null;

    function placeholderSrcdoc() {
        return (
            "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>" +
            "body{font:14px/1.5 Arial,Helvetica,sans-serif;background:#f0f2f5;color:#475569;margin:0;padding:20px}" +
            "</style></head><body><p style=\"margin:0\">This panel shows the same HTML as <strong>Preview</strong>. " +
            "Add a section and questions — the panel refreshes shortly after you type or change the form.</p></body></html>"
        );
    }

    function trySyncInline() {
        if (typeof getFormHTML !== "function") return;
        var html;
        try {
            html = getFormHTML();
        } catch (e) {
            return;
        }
        if (!html || !html.includes("customForm") || !html.includes("question")) return;
        var inline = document.getElementById("previewFrameInline");
        if (inline) inline.srcdoc = html;
    }

    function scheduleSync() {
        clearTimeout(pending);
        pending = setTimeout(function () {
            pending = null;
            trySyncInline();
        }, DEBOUNCE_MS);
    }

    /** Called after import / programmatic field updates (no input event). */
    window.fwSchedulePreviewSync = scheduleSync;

    function isPreviewRelevantTarget(t) {
        if (!t || !t.closest) return false;
        if (t.closest(".fw-preview-pane") || t.id === "previewFrameInline") return false;
        // Typing in these dialogs does not change the built form HTML
        if (t.closest("#pasteJsonModal") || t.closest("#jsonLibraryModal") || t.closest("#previewModal")) {
            return false;
        }
        return !!t.closest(".gui-app");
    }

    window.addEventListener("load", function () {
        var inline = document.getElementById("previewFrameInline");
        if (inline) {
            try {
                inline.srcdoc = placeholderSrcdoc();
            } catch (e) {}
        }

        var app = document.querySelector(".gui-app");
        if (!app) return;

        app.addEventListener(
            "input",
            function (e) {
                if (isPreviewRelevantTarget(e.target)) scheduleSync();
            },
            true
        );
        app.addEventListener(
            "change",
            function (e) {
                if (isPreviewRelevantTarget(e.target)) scheduleSync();
            },
            true
        );

        var fb = document.getElementById("formBuilder");
        if (fb) {
            var obsT;
            var obs = new MutationObserver(function () {
                clearTimeout(obsT);
                obsT = setTimeout(scheduleSync, DEBOUNCE_MS);
            });
            obs.observe(fb, { childList: true, subtree: true, attributes: true, characterData: true });
        }

        scheduleSync();
    });
})();
