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
    const bassPlayBtn = document.getElementById('bass-play-btn');
    const scalevisPillRow = document.getElementById('bass-scalevis-root-pills');
    const bassRootPillRow = document.getElementById('bass-root-pills');
    const rootPillRows = [scalevisPillRow, bassRootPillRow];
    const scaleSelect = document.getElementById('bass-scale-select');

    // Scale Notes card removed — the Circle of Fifths widget above now
    // serves as the at-a-glance scale reference for the selected root.

    // ── Audio — real bass samples from audio/bass, pitch-shifted (same
    // approach as the Keyboard page) to cover every note from the
    // nearest sampled one. Uses Web Audio's AudioBufferSourceNode so
    // playbackRate is reliably honored on every browser, including iOS
    // Safari. ─────────────────────────────────────────────────────────
    const BASS_SAMPLES = [
        ['As', 1], ['As', 2], ['As', 3], ['As', 4],
        ['Cs', 1], ['Cs', 2], ['Cs', 3], ['Cs', 4], ['Cs', 5],
        ['E', 1], ['E', 2], ['E', 3], ['E', 4],
        ['G', 1], ['G', 2], ['G', 3], ['G', 4],
    ].map(([file, oct]) => {
        const sharpNote = { As: 'A#', Cs: 'C#', E: 'E', G: 'G' }[file];
        return { url: `audio/bass/${file}${oct}.mp3`, abs: oct * 12 + MT.noteIndex(sharpNote) };
    });

    function nearestBassSample(targetAbs) {
        let best = BASS_SAMPLES[0];
        let bestDiff = Infinity;
        BASS_SAMPLES.forEach(s => {
            const diff = Math.abs(targetAbs - s.abs);
            if (diff < bestDiff) { bestDiff = diff; best = s; }
        });
        return { url: best.url, semitoneDiff: targetAbs - best.abs };
    }

    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            audioCtx = new Ctx();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    const bufferCache = {};
    const bufferPromises = {};
    function loadBuffer(url) {
        if (bufferCache[url]) return Promise.resolve(bufferCache[url]);
        if (bufferPromises[url]) return bufferPromises[url];
        const ctx = getAudioContext();
        bufferPromises[url] = fetch(url)
            .then(res => res.arrayBuffer())
            .then(data => ctx.decodeAudioData(data))
            .then(buf => { bufferCache[url] = buf; return buf; })
            .catch(() => null);
        return bufferPromises[url];
    }
    BASS_SAMPLES.forEach(s => loadBuffer(s.url));

    function playTone(noteName, octave) {
        try {
            const targetAbs = octave * 12 + MT.noteIndex(noteName);
            const { url, semitoneDiff } = nearestBassSample(targetAbs);
            loadBuffer(url).then(buffer => {
                if (!buffer) return;
                const ctx = getAudioContext();
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.playbackRate.value = Math.pow(2, semitoneDiff / 12);

                const gain = ctx.createGain();
                gain.gain.value = 0.85;
                source.connect(gain);
                gain.connect(ctx.destination);

                source.start(0);
                const stopAt = ctx.currentTime + 0.9;
                gain.gain.setValueAtTime(0.85, Math.max(ctx.currentTime, stopAt - 0.05));
                gain.gain.linearRampToValueAtTime(0, stopAt);
                source.stop(stopAt);
            });
        } catch (e) { /* audio unavailable, fail silently */ }
    }

    // ── Build root pills (naturals + accidental pills, always visible).
    // Built once per row (Scale Visualizer + Bass Root Note) — each row
    // tracks its own selected root, but the sharp/flat spelling of the
    // accidental pills is driven by the single global toggle in the
    // toolbar (window.NoteDisplay), shared across every instrument page. ─
    const NATURALS = ['C','D','E','F','G','A','B'];
    const rowState = new Map(); // row element -> { accidentalPills: [] }

    rootPillRows.forEach(row => {
        const isScaleVis = row === scalevisPillRow;
        const state = { accidentalPills: [] };
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

    // ── Global sharp/flat display mode ──────────────────────────────────
    // One switch for the whole *site* (see js/note-display.js): flips the
    // spelling of every accidental pill on this page and persists across
    // the Keyboard/Guitar/Chord Builder pages too.
    let noteDisplayMode = window.NoteDisplay.getMode();
    const noteDisplayToggle = document.getElementById('note-display-toggle');

    function refreshAccidentalPills() {
        rowState.forEach(state => {
            state.accidentalPills.forEach(p => {
                p.el.dataset.mode = noteDisplayMode;
                p.el.textContent = noteDisplayMode === 'sharp' ? p.sharpLabel : p.flatLabel;
            });
        });
    }
    refreshAccidentalPills();

    window.NoteDisplay.bindToggle(noteDisplayToggle, mode => {
        noteDisplayMode = mode;
        refreshAccidentalPills();
        repaint();
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

    // ── Play button — replays whatever's currently selected: the Scale
    // Visualizer's scale (as an ascending run) if a root+scale is picked,
    // otherwise the single Bass Root Note if one is picked. Mirrors the
    // Keyboard page's Play button, laid out starting from a low bass
    // register (octave 2) since that's a bass, not a piano.
    let playTimeouts = [];
    function stopScheduledPlayback() {
        playTimeouts.forEach(id => clearTimeout(id));
        playTimeouts = [];
        if (bassPlayBtn) bassPlayBtn.classList.remove('is-playing');
    }

    function getActiveNotes() {
        if (scaleVisRoot && activeScale) {
            const preferFlats = noteDisplayMode === 'flat';
            return MT.scaleNotes(scaleVisRoot, activeScale, preferFlats);
        }
        if (bassRootNote) return [bassRootNote];
        return null;
    }

    function layOutAscending(notes) {
        let octave = 2;
        let prevIdx = -1;
        return notes.map(note => {
            const idx = MT.noteIndex(note);
            if (idx < prevIdx) octave++;
            prevIdx = idx;
            return { note, octave };
        });
    }

    function updatePlayButtonState() {
        if (!bassPlayBtn) return;
        const notes = getActiveNotes();
        bassPlayBtn.disabled = !notes || !notes.length;
        if (!notes) stopScheduledPlayback();
    }

    function playActiveNotes() {
        const notes = getActiveNotes();
        if (!notes || !notes.length) return;
        stopScheduledPlayback();
        const timeline = layOutAscending(notes);
        bassPlayBtn.classList.add('is-playing');
        timeline.forEach((item, i) => {
            const id = setTimeout(() => {
                playTone(item.note, item.octave);
                if (i === timeline.length - 1) {
                    const doneId = setTimeout(() => bassPlayBtn.classList.remove('is-playing'), 300);
                    playTimeouts.push(doneId);
                }
            }, i * 230);
            playTimeouts.push(id);
        });
    }
    if (bassPlayBtn) bassPlayBtn.addEventListener('click', playActiveNotes);

    function repaint() {
        const preferFlats = noteDisplayMode === 'flat';
        const scaleNotesSet = activeScale && scaleVisRoot
            ? new Set(MT.scaleNotes(scaleVisRoot, activeScale, preferFlats).map(n => MT.noteIndex(n)))
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

            dot.textContent = MT.noteName(pc, preferFlats);
        });

        updatePlayButtonState();
    }

    setFretCount(12);
    setStringCount(4);
})();
