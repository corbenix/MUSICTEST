// Shared sharp/flat display preference — one setting for the whole site.
// Persisted in localStorage so a single user's choice (sharp vs flat)
// follows them across the Keyboard, Bass, Guitar, and Chord Builder
// pages, rather than being picked separately on each one.
window.NoteDisplay = (function () {
    const STORAGE_KEY = 'cn-note-display-mode';

    // Every button bound via bindToggle() on THIS page registers a
    // listener here, so that flipping one toggle immediately repaints
    // every other toggle/section on the same page too. The native
    // 'storage' event only fires in *other* tabs, never in the tab that
    // made the change, so it can't be relied on for in-page sync.
    const listeners = [];

    function getMode() {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'flat' ? 'flat' : 'sharp';
        } catch (e) {
            return 'sharp';
        }
    }

    function setMode(mode) {
        try {
            localStorage.setItem(STORAGE_KEY, mode === 'flat' ? 'flat' : 'sharp');
        } catch (e) { /* storage unavailable (private browsing etc.) — fail silently */ }
    }

    function toggle() {
        const next = getMode() === 'sharp' ? 'flat' : 'sharp';
        setMode(next);
        return next;
    }

    // Converts a canonical sharp-spelled note (e.g. "C#") into display
    // text for the given (or current) mode. Naturals pass through
    // unchanged. Relies on window.MusicTheory's NOTES_SHARP/NOTES_FLAT
    // tables, so music-theory.js must be loaded first.
    function toDisplayNote(sharpVal, mode) {
        if (!sharpVal || !sharpVal.includes('#')) return sharpVal;
        const m = mode || getMode();
        if (m === 'sharp') return sharpVal.replace('#', '♯');
        const MT = window.MusicTheory;
        const idx = MT.NOTES_SHARP.indexOf(sharpVal);
        return idx === -1 ? sharpVal : MT.NOTES_FLAT[idx].replace('b', '♭');
    }

    // Wires up a page's ♯/♭ toolbar button: paints its current state,
    // flips + persists the mode on click, and calls onChange(mode) so the
    // page can re-render whatever depends on note spelling. Also listens
    // for the mode changing in another tab/page (via the storage event)
    // so multiple open tabs stay in sync.
    function bindToggle(buttonEl, onChange) {
        if (!buttonEl) return;
        function paint() {
            const mode = getMode();
            buttonEl.textContent = mode === 'sharp' ? '♯' : '♭';
            buttonEl.title = mode === 'sharp'
                ? 'Showing sharps — click for flats (♭)'
                : 'Showing flats — click for sharps (♯)';
            buttonEl.dataset.mode = mode;
        }
        paint();
        // Register so this button/section gets repainted whenever ANY
        // toggle on the page (this one or another) changes the mode.
        listeners.push({ paint, onChange });

        buttonEl.addEventListener('click', () => {
            toggle();
            notifyAll();
        });
        window.addEventListener('storage', e => {
            if (e.key === STORAGE_KEY) notifyAll();
        });
    }

    function notifyAll() {
        const mode = getMode();
        listeners.forEach(l => {
            l.paint();
            if (l.onChange) l.onChange(mode);
        });
    }

    return { STORAGE_KEY, getMode, setMode, toggle, toDisplayNote, bindToggle };
})();
