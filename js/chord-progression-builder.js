// Chord Progression Builder — free-form sequencer.
// Pick any root + quality, add it to a sequence (up to 8 chords), then
// play the sequence back at a chosen BPM / beats-per-chord. Independent
// of the diatonic "Key" card above it on the same page.
(function () {
    const MT = window.MusicTheory;

    const MAX_CHORDS = 8;
    const QUALITIES = ['Major', 'Minor', 'Diminished', 'Augmented', 'Sus2', 'Sus4', 'Major 6', 'Minor 6', 'Major 7', 'Minor 7', 'Dominant 7', '7sus4', 'Add9', 'Major 9', 'Minor 9', 'Dominant 9'];
    const QUALITY_SUFFIX = {
        'Major': '', 'Minor': 'm', 'Diminished': '°', 'Augmented': '+',
        'Sus2': 'sus2', 'Sus4': 'sus4', 'Major 6': '6', 'Minor 6': 'm6', 'Major 7': 'maj7', 'Minor 7': 'm7', 'Dominant 7': '7', '7sus4': '7sus4', 'Add9': 'add9',
        'Major 9': 'maj9', 'Minor 9': 'm9', 'Dominant 9': '9',
    };

    const rootPillsEl = document.getElementById('cpb-root-pills');
    const qualityPillsEl = document.getElementById('cpb-quality-pills');
    const addBtn = document.getElementById('cpb-add-btn');
    const sequenceEl = document.getElementById('cpb-sequence');
    const seqCountEl = document.getElementById('cpb-seq-count');
    const playBtn = document.getElementById('cpb-play-btn');
    const stopBtn = document.getElementById('cpb-stop-btn');
    const clearBtn = document.getElementById('cpb-clear-btn');
    const copyBtn = document.getElementById('cpb-copy-btn');
    const bpmInput = document.getElementById('cpb-bpm');
    const beatsPillsEl = document.getElementById('cpb-beats-pills');
    const noteToggle = document.getElementById('cpb-note-toggle');

    if (!rootPillsEl) return; // section not present on this page load

    const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    let rootValue = 'C';
    let qualityValue = 'Major';
    let beatsPerChord = 2;
    let sequence = []; // { root, quality, notes }
    let playIndex = -1;
    let playTimer = null;

    // ── Persistence — the sequence survives a refresh/return visit to
    // this page via localStorage. Saved every time renderSequence() runs
    // (i.e. after every add/remove/clear), and restored once on load
    // before the first render. Page-scoped only, same as everything
    // else on this non-SPA site — visiting a different instrument page
    // and coming back to Chord Builder still finds it here, but it
    // doesn't carry between different pages. ──
    const SEQUENCE_STORAGE_KEY = 'cpb-sequence';
    function saveSequence() {
        try {
            localStorage.setItem(SEQUENCE_STORAGE_KEY, JSON.stringify(sequence));
        } catch (e) { /* storage unavailable/full — fail silently */ }
    }
    function restoreSequence() {
        try {
            const raw = localStorage.getItem(SEQUENCE_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) sequence = parsed;
        } catch (e) { /* corrupted/old data — start fresh */ }
    }
    restoreSequence();

    // ── Audio — delegated to the shared InstrumentSound module
    // (js/instrument-sound.js), which also backs the Chords by Key
    // section above, so both share one guitar/keyboard toggle. ──
    const playChordNotes = window.InstrumentSound.playChord;

    // ── Root pills (C..B naturals + sharp/flat accidentals) ──
    const accidentalPills = [];
    function selectRoot(note) {
        rootValue = note;
        rootPillsEl.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === rootValue));
    }
    NATURALS.forEach(note => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'root-pill';
        btn.textContent = note;
        btn.dataset.sharp = note;
        btn.classList.toggle('active', note === rootValue);
        btn.addEventListener('click', () => selectRoot(note));
        rootPillsEl.appendChild(btn);
    });
    const sep = document.createElement('span');
    sep.className = 'sf-sep';
    rootPillsEl.appendChild(sep);
    MT.NOTES_SHARP.forEach((sharpVal, i) => {
        if (!sharpVal.includes('#')) return;
        const flatVal = MT.NOTES_FLAT[i].replace('b', '♭');
        const sharpLabel = sharpVal.replace('#', '♯');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'root-pill sf-acc-pill';
        btn.dataset.sharp = sharpVal;
        btn.addEventListener('click', () => selectRoot(sharpVal));
        accidentalPills.push({ el: btn, sharp: sharpVal, sharpLabel, flatLabel: flatVal });
        rootPillsEl.appendChild(btn);
    });
    let noteDisplayMode = window.NoteDisplay ? window.NoteDisplay.getMode() : 'sharp';
    function refreshAccidentalPills() {
        accidentalPills.forEach(p => {
            p.el.dataset.mode = noteDisplayMode;
            p.el.textContent = noteDisplayMode === 'sharp' ? p.sharpLabel : p.flatLabel;
        });
    }
    refreshAccidentalPills();
    if (window.NoteDisplay && noteToggle) {
        window.NoteDisplay.bindToggle(noteToggle, mode => {
            noteDisplayMode = mode;
            refreshAccidentalPills();
            renderSequence();
        });
    }

    // ── Quality pills ──
    QUALITIES.forEach(q => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'type-pill-btn';
        btn.textContent = q;
        btn.dataset.quality = q;
        btn.classList.toggle('active', q === qualityValue);
        btn.addEventListener('click', () => {
            qualityValue = q;
            qualityPillsEl.querySelectorAll('.type-pill-btn').forEach(p => p.classList.toggle('active', p.dataset.quality === qualityValue));
        });
        qualityPillsEl.appendChild(btn);
    });

    // ── Beats-per-chord pills (1 / 2 / 4) — rendered as a single
    // grouped segmented control, matching the Keyboard page's octave
    // selector (.pill-group / .pill-btn) rather than separate pills. ──
    [1, 2, 4].forEach(n => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pill-btn';
        btn.textContent = String(n);
        btn.dataset.beats = String(n);
        btn.classList.toggle('active', n === beatsPerChord);
        btn.addEventListener('click', () => {
            beatsPerChord = n;
            beatsPillsEl.querySelectorAll('.pill-btn').forEach(p => p.classList.toggle('active', Number(p.dataset.beats) === beatsPerChord));
        });
        beatsPillsEl.appendChild(btn);
    });

    // ── Sequence rendering ──
    function chordLabel(root, quality) {
        return `${root}${QUALITY_SUFFIX[quality] !== undefined ? QUALITY_SUFFIX[quality] : ' ' + quality}`;
    }

    function renderSequence() {
        saveSequence();
        seqCountEl.textContent = `${sequence.length} / ${MAX_CHORDS} chords`;
        addBtn.disabled = sequence.length >= MAX_CHORDS;
        sequenceEl.innerHTML = '';
        if (!sequence.length) {
            const empty = document.createElement('div');
            empty.className = 'cpb-seq-empty';
            empty.textContent = '↑ Pick a root and quality above, then hit Add';
            sequenceEl.appendChild(empty);
            return;
        }
        sequence.forEach((c, i) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cpb-chip';
            chip.classList.toggle('cpb-chip--playing', i === playIndex);
            chip.dataset.index = String(i);
            chip.innerHTML = `
                <span class="cpb-chip-index">${i + 1}</span>
                <span>${chordLabel(c.root, c.quality)}</span>
                <span class="cpb-chip-remove" title="Remove">✕</span>
            `;
            chip.addEventListener('click', (e) => {
                if (e.target.closest('.cpb-chip-remove')) {
                    sequence.splice(i, 1);
                    renderSequence();
                    return;
                }
                playChordNotes(c.notes);
            });
            sequenceEl.appendChild(chip);
        });
    }

    addBtn.addEventListener('click', () => {
        if (sequence.length >= MAX_CHORDS) return;
        const preferFlats = MT.PREFERS_FLATS.has(rootValue) || noteDisplayMode === 'flat';
        const notes = MT.chordNotes(rootValue, qualityValue, preferFlats);
        sequence.push({ root: rootValue, quality: qualityValue, notes });
        renderSequence();
        playChordNotes(notes);
    });

    clearBtn.addEventListener('click', () => {
        stopPlayback();
        sequence = [];
        renderSequence();
    });

    copyBtn.addEventListener('click', () => {
        if (!sequence.length) return;
        const text = sequence.map(c => chordLabel(c.root, c.quality)).join(' – ');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => flashCopyBtn()).catch(() => {});
        } else {
            flashCopyBtn();
        }
    });
    function flashCopyBtn() {
        const original = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => { copyBtn.textContent = original; }, 1200);
    }

    function stopPlayback() {
        if (playTimer) { clearTimeout(playTimer); playTimer = null; }
        playIndex = -1;
        renderSequence();
    }
    stopBtn.addEventListener('click', stopPlayback);

    playBtn.addEventListener('click', () => {
        if (!sequence.length) return;
        stopPlayback();
        const bpm = Math.max(40, Math.min(240, Number(bpmInput.value) || 80));
        const msPerBeat = 60000 / bpm;
        const stepMs = msPerBeat * beatsPerChord;

        let i = 0;
        const step = () => {
            if (i >= sequence.length) { stopPlayback(); return; }
            playIndex = i;
            renderSequence();
            playChordNotes(sequence[i].notes);
            i += 1;
            playTimer = setTimeout(step, stepMs);
        };
        step();
    });

    bpmInput.addEventListener('change', () => {
        const v = Math.max(40, Math.min(240, Number(bpmInput.value) || 80));
        bpmInput.value = String(v);
    });

    renderSequence();

    // ── Show/Hide toggle for both cards on this page ──
    function setupCollapse(cardId, headerToggleId, btnId, bodyOuterId, storageKey, label) {
        const card = document.getElementById(cardId);
        const headerToggle = document.getElementById(headerToggleId);
        const btn = document.getElementById(btnId);
        const bodyOuter = document.getElementById(bodyOuterId);
        if (!card || !headerToggle || !btn || !bodyOuter) return;

        let collapsed = false;
        try { collapsed = localStorage.getItem(storageKey) === 'true'; } catch (e) {}

        function apply() {
            card.classList.toggle('is-collapsed', collapsed);
            bodyOuter.classList.toggle('collapsed', collapsed);
            btn.classList.toggle('is-collapsed', collapsed);
            btn.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${label}`);
        }
        apply();

        function toggle() {
            collapsed = !collapsed;
            try { localStorage.setItem(storageKey, String(collapsed)); } catch (e) {}
            apply();
        }
        btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
        headerToggle.addEventListener('click', (e) => {
            if (e.target.closest('#' + btnId) || e.target.closest('.chordlib-note-toggle')) return;
            toggle();
        });
    }

    setupCollapse('cpb-card', 'cpb-header-toggle', 'cpb-collapse-btn', 'cpb-body-outer', 'cpb-collapsed', 'Chord Progression Builder');
    setupCollapse('cbk-card', 'cbk-header-toggle', 'cbk-collapse-btn', 'cbk-body-outer', 'cbk-collapsed', 'Chords by Key');
})();
