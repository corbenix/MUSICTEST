// Universal floating "Tools" button, bottom-right on every page. Replaces
// the old standalone metronome FAB — this single button opens a small menu
// with Metronome, Record, and Play Along, so the corner only ever has one
// icon instead of a growing stack of them.
(function () {
    'use strict';

    function fmtTime(seconds) {
        const s = Math.floor(seconds % 60);
        const m = Math.floor(seconds / 60);
        return m + ':' + String(s).padStart(2, '0');
    }

    function buildMarkup() {
        const fab = document.createElement('button');
        fab.type = 'button';
        fab.className = 'tfab-fab';
        fab.setAttribute('aria-label', 'Tools');
        fab.setAttribute('aria-expanded', 'false');
        fab.innerHTML =
            '<svg viewBox="0 0 24 24" class="tfab-icon"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6l-3 3-4.3-4.3C.6 7.1 1 10.1 3 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.4-.4.4-1.1 0-1.4z"/></svg>' +
            '<span class="tfab-fab-dot" aria-hidden="true"></span>';

        const menu = document.createElement('div');
        menu.className = 'tfab-menu';
        menu.hidden = true;
        menu.innerHTML = `
            <button type="button" class="tfab-item" id="tfab-metronome">
                <span class="tfab-item-icon">🥁</span>
                <span class="tfab-item-label">Metronome</span>
                <span class="tfab-item-status" id="tfab-metronome-status"></span>
            </button>
            <button type="button" class="tfab-item" id="tfab-record">
                <span class="tfab-item-icon tfab-record-dot" aria-hidden="true"></span>
                <span class="tfab-item-label">Record</span>
                <span class="tfab-item-status" id="tfab-record-status"></span>
            </button>
            <button type="button" class="tfab-item" id="tfab-download" hidden>
                <span class="tfab-item-icon">⬇</span>
                <span class="tfab-item-label">Download MP3</span>
            </button>
            <button type="button" class="tfab-item" id="tfab-playalong">
                <span class="tfab-item-icon">♪</span>
                <span class="tfab-item-label">Play Along</span>
            </button>
        `;

        document.body.appendChild(fab);
        document.body.appendChild(menu);
        return { fab, menu };
    }

    function init() {
        const { fab, menu } = buildMarkup();
        const metronomeBtn = menu.querySelector('#tfab-metronome');
        const metronomeStatus = menu.querySelector('#tfab-metronome-status');
        const recordBtn = menu.querySelector('#tfab-record');
        const recordStatus = menu.querySelector('#tfab-record-status');
        const downloadBtn = menu.querySelector('#tfab-download');
        const playAlongBtn = menu.querySelector('#tfab-playalong');

        // ── Open/close the popup menu ───────────────────────────────
        function setMenuOpen(open) {
            menu.hidden = !open;
            fab.setAttribute('aria-expanded', String(open));
            fab.classList.toggle('tfab-fab--open', open);
        }
        fab.addEventListener('click', () => setMenuOpen(menu.hidden));
        document.addEventListener('click', (e) => {
            if (!menu.hidden && !menu.contains(e.target) && !fab.contains(e.target)) setMenuOpen(false);
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenuOpen(false); });

        // ── Metronome row ────────────────────────────────────────────
        if (window.GlobalMetronome) {
            metronomeBtn.addEventListener('click', () => window.GlobalMetronome.toggle());
            window.GlobalMetronome.subscribe((evt) => {
                if (evt.type === 'tick') {
                    fab.classList.add('tfab-fab-dot--flash');
                    setTimeout(() => fab.classList.remove('tfab-fab-dot--flash'), 100);
                    return;
                }
                metronomeBtn.classList.toggle('tfab-item--active', evt.active);
                metronomeStatus.textContent = evt.active ? evt.bpm + ' bpm' : '';
            });
        } else {
            metronomeBtn.disabled = true;
        }

        // ── Record row ───────────────────────────────────────────────
        if (window.Recorder) {
            recordBtn.addEventListener('click', () => window.Recorder.toggle());
            window.Recorder.subscribe((evt) => {
                if (evt.type === 'start') {
                    recordBtn.classList.add('tfab-item--recording');
                    fab.classList.add('tfab-fab--recording');
                    recordStatus.textContent = '0:00';
                    downloadBtn.hidden = true;
                } else if (evt.type === 'tick') {
                    recordStatus.textContent = fmtTime(evt.seconds);
                } else if (evt.type === 'stop') {
                    recordBtn.classList.remove('tfab-item--recording');
                    fab.classList.remove('tfab-fab--recording');
                    recordStatus.textContent = 'Processing…';
                } else if (evt.type === 'processing') {
                    recordStatus.textContent = 'Processing…';
                } else if (evt.type === 'ready') {
                    recordStatus.textContent = 'Saved';
                    downloadBtn.hidden = false;
                } else if (evt.type === 'empty') {
                    recordStatus.textContent = 'No audio captured';
                    setTimeout(() => { recordStatus.textContent = ''; }, 2500);
                } else if (evt.type === 'error') {
                    recordStatus.textContent = 'Couldn\u2019t save recording';
                    setTimeout(() => { recordStatus.textContent = ''; }, 3000);
                }
            });
            downloadBtn.addEventListener('click', () => window.Recorder.download());
        } else {
            recordBtn.disabled = true;
        }

        // ── Play Along row ───────────────────────────────────────────
        if (window.MiniPlayer) {
            playAlongBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.MiniPlayer.toggle();
                setMenuOpen(false);
            });
        } else {
            playAlongBtn.disabled = true;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
