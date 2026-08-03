(function () {
    const MT = window.MusicTheory;
    const CBD = window.ChordBuilderData;

    document.documentElement.style.setProperty('--fret-accent-rgb', getComputedStyle(document.documentElement).getPropertyValue('--chordbuilder-rgb'));

    // ── Audio — playback is delegated to the shared InstrumentSound module
    // (js/instrument-sound.js) so the guitar/keyboard toggle is shared with
    // the Chord Progression Builder instead of each widget having its own. ──
    const playChord = window.InstrumentSound.playChord;

    const keyRootPills = document.getElementById('key-root-pills');
    const keyModePills = document.getElementById('key-mode-pills');
    const keyNoteToggle = document.getElementById('key-note-toggle');
    const progressionPlayback = document.getElementById('progression-playback');

    const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    let keyRootValue = 'C';
    let keyModeValue = 'major';
    const keyAccidentalPills = [];

    function selectKeyRoot(note) {
        keyRootValue = note;
        keyRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === keyRootValue));
        renderDiatonic();
    }

    NATURALS.forEach(note => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'root-pill';
        btn.textContent = note;
        btn.dataset.sharp = note;
        btn.classList.toggle('active', note === keyRootValue);
        btn.addEventListener('click', () => selectKeyRoot(note));
        keyRootPills.appendChild(btn);
    });

    const keySep = document.createElement('span');
    keySep.className = 'sf-sep';
    keyRootPills.appendChild(keySep);

    MT.NOTES_SHARP.forEach((sharpVal, i) => {
        if (!sharpVal.includes('#')) return; // naturals already built above
        const flatVal = MT.NOTES_FLAT[i].replace('b', '♭');
        const sharpLabel = sharpVal.replace('#', '♯');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'root-pill sf-acc-pill';
        btn.dataset.sharp = sharpVal;
        btn.classList.toggle('active', sharpVal === keyRootValue);
        btn.addEventListener('click', () => selectKeyRoot(sharpVal));
        keyAccidentalPills.push({ el: btn, sharp: sharpVal, sharpLabel: sharpLabel, flatLabel: flatVal });
        keyRootPills.appendChild(btn);
    });

    let keyNoteDisplayMode = window.NoteDisplay.getMode();
    function refreshKeyAccidentalPills() {
        keyAccidentalPills.forEach(p => {
            p.el.dataset.mode = keyNoteDisplayMode;
            p.el.textContent = keyNoteDisplayMode === 'sharp' ? p.sharpLabel : p.flatLabel;
        });
    }
    refreshKeyAccidentalPills();
    window.NoteDisplay.bindToggle(keyNoteToggle, mode => {
        keyNoteDisplayMode = mode;
        refreshKeyAccidentalPills();
    });

    [['major', 'Major'], ['minor', 'Minor']].forEach(([value, label]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'type-pill-btn';
        btn.textContent = label;
        btn.dataset.mode = value;
        btn.classList.toggle('active', value === keyModeValue);
        btn.addEventListener('click', () => {
            keyModeValue = value;
            keyModePills.querySelectorAll('.type-pill-btn').forEach(p => p.classList.toggle('active', p.dataset.mode === keyModeValue));
            renderDiatonic();
        });
        keyModePills.appendChild(btn);
    });

    function diatonicChords() {
        const root = keyRootValue;
        const mode = keyModeValue; // 'major' | 'minor'
        const preferFlats = MT.PREFERS_FLATS.has(root);
        const scaleName = mode === 'major' ? 'Major (Ionian)' : 'Natural Minor (Aeolian)';
        const scale = MT.scaleNotes(root, scaleName, preferFlats);
        const table = mode === 'major' ? CBD.MAJOR_DIATONIC : CBD.MINOR_DIATONIC;

        return table.map(entry => {
            const chordRoot = scale[entry.degree];
            return {
                numeral: entry.numeral,
                quality: entry.quality,
                root: chordRoot,
                notes: MT.chordNotes(chordRoot, entry.quality, preferFlats),
            };
        });
    }

    function renderDiatonic() {
        const chords = diatonicChords();
        renderProgressions(chords);
    }

    const progressionSelect = document.getElementById('progression-select');
    const progressionDesc = document.getElementById('progression-desc');
    const progressionCards = document.getElementById('progression-cards');
    const progressionPlayBtn = document.getElementById('progression-play-btn');
    let progressionIndex = 0;

    function renderProgressions(chords) {
        const mode = keyModeValue;
        const progs = CBD.PROGRESSIONS[mode];
        if (progressionIndex >= progs.length) progressionIndex = 0;

        progressionSelect.innerHTML = '';
        progs.forEach((prog, i) => {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = `${prog.name} (${prog.tag})`;
            progressionSelect.appendChild(opt);
        });
        progressionSelect.value = String(progressionIndex);

        renderSelectedProgression(chords);
    }

    function renderSelectedProgression(chords) {
        const mode = keyModeValue;
        const prog = CBD.PROGRESSIONS[mode][progressionIndex];
        progressionDesc.textContent = prog.desc;

        progressionCards.innerHTML = '';
        prog.degrees.forEach(d => {
            const c = chords[d];
            const qClass = c.quality === 'Major' ? 'is-major' : (c.quality === 'Minor' ? 'is-minor' : 'is-dim');
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `diatonic-card ${qClass}`;
            card.innerHTML = `
                <div class="diatonic-numeral">${c.numeral}</div>
                <div class="diatonic-name">${c.root}${c.quality === 'Major' ? '' : (c.quality === 'Minor' ? 'm' : '°')}</div>
                <div class="diatonic-quality">${c.quality}</div>
            `;
            card.addEventListener('click', () => playChord(c.notes));
            progressionCards.appendChild(card);
        });
    }

    progressionSelect.addEventListener('change', () => {
        progressionIndex = Number(progressionSelect.value);
        renderSelectedProgression(diatonicChords());
    });

    progressionPlayBtn.addEventListener('click', () => {
        const mode = keyModeValue;
        const prog = CBD.PROGRESSIONS[mode][progressionIndex];
        const chords = diatonicChords();
        prog.degrees.forEach((d, i) => {
            setTimeout(() => playChord(chords[d].notes), i * 950);
        });
    });

    renderDiatonic();
})();
