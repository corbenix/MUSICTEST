(function () {
    const MT = window.MusicTheory;
    const MARKER_FRETS = new Set([3,5,7,9,15,17,19,21]);
    const DOUBLE_MARKER_FRETS = new Set([12,24]);

    const TUNINGS = {
        4: ['G','D','A','E'],   // high to low, for display top-to-bottom
        5: ['G','D','A','E','B'],
    };

    let stringCount = 4;
    let fretCount = 12;
    let scaleVisRoot = '';
    let bassRootNote = '';
    let activeScale = '';

    // ── DOM refs ────────────────────────────────────────────────────────
    const fretHeader = document.getElementById('b-fret-header');
    const stringsContainer = document.getElementById('b-strings-container');
    const markerCells = document.getElementById('b-marker-cells');
    const fretToggle12 = document.getElementById('fret-toggle-b-12');
    const fretToggle15 = document.getElementById('fret-toggle-b-15');
    const fretToggle24 = document.getElementById('fret-toggle-b-24');
    const string4Btn = document.getElementById('bass-4-btn');
    const string5Btn = document.getElementById('bass-5-btn');
    const clearBtn = document.getElementById('bass-clear-btn');
    const scalevisPillRow = document.getElementById('bass-scalevis-root-pills');
    const bassRootPillRow = document.getElementById('bass-root-pills');
    const rootPillRows = [scalevisPillRow, bassRootPillRow];
    const scaleSelect = document.getElementById('bass-scale-select');

    // Scale Notes card removed — the Circle of Fifths widget above now
    // serves as the at-a-glance scale reference for the selected root.

    // ── Build root pills (naturals + ♮/♯/♭ toggle + accidental pills).
    // Built once per row (Scale Visualizer + Bass Root Note) — each row
    // tracks its own root AND its own accidental display mode
    // independently of the other. ─────────────────────────────────────
    const NATURALS = ['C','D','E','F','G','A','B'];
    const rowState = new Map(); // row element -> { mode: 'natural'|'sharp'|'flat', accidentalPills: [] }

    rootPillRows.forEach(row => {
        const isScaleVis = row === scalevisPillRow;
        const state = { mode: 'natural', accidentalPills: [] };
        rowState.set(row, state);

        NATURALS.forEach(note => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'root-pill';
            btn.textContent = note;
            btn.dataset.sharp = note;
            btn.addEventListener('click', () => selectRoot(isScaleVis, note));
            row.appendChild(btn);
        });

        const sep = document.createElement('span');
        sep.className = 'sf-sep';
        row.appendChild(sep);

        const sfToggle = document.createElement('button');
        sfToggle.type = 'button';
        sfToggle.className = 'sf-toggle';
        sfToggle.addEventListener('click', () => {
            state.mode = state.mode === 'natural' ? 'sharp' : state.mode === 'sharp' ? 'flat' : 'natural';
            updateToggleLabel(row, sfToggle);
            refreshAccidentalPills(row);
        });
        row.appendChild(sfToggle);

        MT.NOTES_SHARP.forEach((sharpVal, i) => {
            if (!sharpVal.includes('#')) return; // naturals already built above
            const flatVal = MT.NOTES_FLAT[i].replace('b', '♭');
            const sharpLabel = sharpVal.replace('#', '♯');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'root-pill sf-acc-pill';
            btn.dataset.sharp = sharpVal;
            btn.addEventListener('click', () => selectRoot(isScaleVis, sharpVal));
            state.accidentalPills.push({ el: btn, sharp: sharpVal, sharpLabel: sharpLabel, flatLabel: flatVal });
            row.appendChild(btn);
        });
    });

    function selectRoot(isScaleVis, sharpVal) {
        if (isScaleVis) {
            scaleVisRoot = scaleVisRoot === sharpVal ? '' : sharpVal;
            scalevisPillRow.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === scaleVisRoot));
        } else {
            bassRootNote = bassRootNote === sharpVal ? '' : sharpVal;
            bassRootPillRow.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === bassRootNote));
        }
        repaint();
    }

    function refreshAccidentalPills(row) {
        const state = rowState.get(row);
        const isScaleVis = row === scalevisPillRow;
        state.accidentalPills.forEach(p => {
            if (state.mode === 'natural') {
                p.el.dataset.hidden = '1';
                p.el.dataset.mode = 'natural';
                p.el.textContent = p.sharpLabel;
            } else if (state.mode === 'sharp') {
                p.el.dataset.hidden = '0';
                p.el.dataset.mode = 'sharp';
                p.el.textContent = p.sharpLabel;
            } else {
                p.el.dataset.hidden = '0';
                p.el.dataset.mode = 'flat';
                p.el.textContent = p.flatLabel;
            }
        });
        // Deselect a hidden accidental root so the board doesn't keep
        // highlighting a note this row's picker no longer shows as active.
        if (state.mode === 'natural') {
            if (isScaleVis && scaleVisRoot && !NATURALS.includes(scaleVisRoot)) {
                scaleVisRoot = '';
                row.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active'));
                repaint();
            } else if (!isScaleVis && bassRootNote && !NATURALS.includes(bassRootNote)) {
                bassRootNote = '';
                row.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active'));
                repaint();
            }
        }
    }

    function updateToggleLabel(row, toggleEl) {
        const state = rowState.get(row);
        let label, title;
        if (state.mode === 'natural') { label = '♮'; title = 'Showing natural notes — click for Sharp (#)'; }
        else if (state.mode === 'sharp') { label = '#'; title = 'Showing sharps — click for Flat (♭)'; }
        else { label = '♭'; title = 'Showing flats — click for Natural (♮)'; }
        toggleEl.textContent = label;
        toggleEl.title = title;
        toggleEl.dataset.mode = state.mode;
    }

    rootPillRows.forEach(row => {
        const toggleEl = row.querySelector('.sf-toggle');
        updateToggleLabel(row, toggleEl);
        refreshAccidentalPills(row);
    });

    // ── Build scale select ──────────────────────────────────────────────
    Object.keys(MT.SCALES).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        scaleSelect.appendChild(opt);
    });
    activeScale = scaleSelect.value;
    scaleSelect.addEventListener('change', () => { activeScale = scaleSelect.value; repaint(); });

    // ── Fret count / string count toggles ──────────────────────────────
    function setFretCount(n) {
        fretCount = n;
        [fretToggle12, fretToggle15, fretToggle24].forEach(b => b.classList.remove('active'));
        ({ 12: fretToggle12, 15: fretToggle15, 24: fretToggle24 })[n].classList.add('active');
        buildBoard();
    }
    fretToggle12.addEventListener('click', () => setFretCount(12));
    fretToggle15.addEventListener('click', () => setFretCount(15));
    fretToggle24.addEventListener('click', () => setFretCount(24));

    function setStringCount(n) {
        stringCount = n;
        string4Btn.classList.toggle('active', n === 4);
        string5Btn.classList.toggle('active', n === 5);
        buildBoard();
    }
    string4Btn.addEventListener('click', () => setStringCount(4));
    string5Btn.addEventListener('click', () => setStringCount(5));

    clearBtn.addEventListener('click', () => {
        scaleVisRoot = '';
        bassRootNote = '';
        rootPillRows.forEach(row => row.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active')));
        document.querySelectorAll('.fret-cell.active').forEach(c => c.classList.remove('active'));
        repaint();
    });

    // ── Board building ──────────────────────────────────────────────────
    function buildBoard() {
        const tuning = TUNINGS[stringCount];

        fretHeader.innerHTML = '';
        for (let f = 1; f <= fretCount; f++) {
            const cell = document.createElement('div');
            cell.className = 'fret-num' + (MARKER_FRETS.has(f) || DOUBLE_MARKER_FRETS.has(f) ? ' marker' : '');
            cell.textContent = f;
            fretHeader.appendChild(cell);
        }

        stringsContainer.innerHTML = '';
        tuning.forEach(openNote => {
            const row = document.createElement('div');
            row.className = 'string-row';

            const label = document.createElement('div');
            label.className = 'string-label';
            label.textContent = openNote;
            row.appendChild(label);

            // Open string indicator — purely visual (no mute/audio behavior
            // to toggle here), marking fret 0 the way the reference app does.
            const openNote0 = document.createElement('div');
            openNote0.className = 'open-note-badge';
            openNote0.textContent = 'O';
            row.appendChild(openNote0);

            const nut = document.createElement('div');
            nut.className = 'nut';
            row.appendChild(nut);

            const fretsRow = document.createElement('div');
            fretsRow.className = 'frets-row';
            const openIdx = MT.noteIndex(openNote);

            for (let f = 1; f <= fretCount; f++) {
                const cell = document.createElement('div');
                cell.className = 'fret-cell';
                cell.dataset.fret = f;

                const dot = document.createElement('div');
                dot.className = 'fret-dot';
                const noteIdx = (openIdx + f) % 12;
                dot.dataset.pc = noteIdx;
                cell.appendChild(dot);
                fretsRow.appendChild(cell);
            }
            row.appendChild(fretsRow);
            stringsContainer.appendChild(row);
        });

        markerCells.innerHTML = '';
        for (let f = 1; f <= fretCount; f++) {
            const wrap = document.createElement('div');
            wrap.className = 'fret-marker-dot' + (DOUBLE_MARKER_FRETS.has(f) ? ' is-double' : '');
            if (MARKER_FRETS.has(f) || DOUBLE_MARKER_FRETS.has(f)) wrap.innerHTML = '<span></span>';
            markerCells.appendChild(wrap);
        }

        repaint();
    }

    // Manual note finder: clicking any fret cell toggles its own
    // highlight, independent of the Scale Visualizer / Bass Root Note
    // pickers. Delegated on the container so it survives buildBoard()
    // rebuilding the cells on fret/string count changes.
    stringsContainer.addEventListener('click', e => {
        const cell = e.target.closest('.fret-cell');
        if (!cell) return;
        cell.classList.toggle('active');
    });

    function repaint() {
        const scalePreferFlats = scaleVisRoot && MT.PREFERS_FLATS.has(scaleVisRoot);
        const rootPreferFlats = bassRootNote && MT.PREFERS_FLATS.has(bassRootNote);
        const scaleNotesSet = activeScale && scaleVisRoot
            ? new Set(MT.scaleNotes(scaleVisRoot, activeScale, scalePreferFlats).map(n => MT.noteIndex(n)))
            : null;
        const rootIdx = bassRootNote ? MT.noteIndex(bassRootNote) : null;
        const scaleRootIdx = scaleVisRoot ? MT.noteIndex(scaleVisRoot) : null;

        document.querySelectorAll('.fret-cell').forEach(cell => {
            const dot = cell.querySelector('.fret-dot');
            const pc = Number(dot.dataset.pc);
            const isScaleMatch = scaleNotesSet && scaleNotesSet.has(pc);
            const isRootMatch = rootIdx !== null && pc === rootIdx;
            const isScaleRoot = isScaleMatch && scaleRootIdx !== null && pc === scaleRootIdx;

            cell.classList.toggle('bass-scale-match', !!isScaleMatch);
            cell.classList.toggle('bass-root-match', !!isRootMatch);
            cell.classList.toggle('scale-root-ring', !!isScaleRoot);

            dot.textContent = isRootMatch
                ? MT.noteName(pc, rootPreferFlats)
                : (isScaleMatch ? MT.noteName(pc, scalePreferFlats) : MT.noteName(pc, false));
        });
    }

    setFretCount(12);
    setStringCount(4);
})();
