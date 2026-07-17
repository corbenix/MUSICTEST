(function () {
    const MT = window.MusicTheory;
    const GD = window.GuitarData;
    const TUNING = ['E', 'A', 'D', 'G', 'B', 'E']; // low to high

    document.documentElement.style.setProperty('--fret-accent-rgb', getComputedStyle(document.documentElement).getPropertyValue('--guitar-rgb'));

    // ── Tabs ────────────────────────────────────────────────────────────
    const tabs = document.querySelectorAll('.tool-tab');
    const panels = document.querySelectorAll('.tool-panel');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
            panels.forEach(p => p.setAttribute('hidden', ''));
            tab.setAttribute('aria-selected', 'true');
            document.getElementById(tab.dataset.panel).removeAttribute('hidden');
        });
    });

    // ── Scale Explorer ─────────────────────────────────────────────────
    const scaleRoot = document.getElementById('scale-root');
    const scaleType = document.getElementById('scale-type');
    const scaleChips = document.getElementById('scale-chips');
    const scaleBoard = document.getElementById('scale-fretboard');

    Object.keys(MT.SCALES).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        scaleType.appendChild(opt);
    });
    MT.NOTES_SHARP.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        scaleRoot.appendChild(opt);
    });

    function renderScale() {
        const root = scaleRoot.value;
        const type = scaleType.value;
        const preferFlats = MT.PREFERS_FLATS.has(root);
        const notes = MT.scaleNotes(root, type, preferFlats);
        const degrees = MT.scaleDegrees(root, type, preferFlats);

        scaleChips.innerHTML = '';
        degrees.forEach(d => {
            const pill = document.createElement('div');
            pill.className = 'scale-pill' + (d.isRoot ? ' scale-pill--root' : '');
            pill.innerHTML =
                '<span class="scale-pill-degree">' + d.degree + '</span>' +
                '<span class="scale-pill-note">' + d.note + '</span>';
            scaleChips.appendChild(pill);
        });

        Fretboard.render(scaleBoard, {
            tuning: TUNING,
            numFrets: 15,
            highlight: { notes, root, preferFlats },
        });
    }
    scaleRoot.addEventListener('change', renderScale);
    scaleType.addEventListener('change', renderScale);
    scaleRoot.value = 'C';
    renderScale();

    // ── CAGED System ────────────────────────────────────────────────────
    const cagedRoot = document.getElementById('caged-root');
    const cagedPicker = document.getElementById('caged-picker');
    const cagedBoard = document.getElementById('caged-fretboard');
    const cagedNote = document.getElementById('tool-note');
    let activeCagedLetter = 'C';

    MT.NOTES_SHARP.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        cagedRoot.appendChild(opt);
    });
    cagedRoot.value = 'G';

    ['C', 'A', 'G', 'E', 'D'].forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'caged-btn';
        btn.type = 'button';
        btn.textContent = letter;
        btn.setAttribute('aria-pressed', letter === activeCagedLetter ? 'true' : 'false');
        btn.addEventListener('click', () => {
            activeCagedLetter = letter;
            cagedPicker.querySelectorAll('.caged-btn').forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
            renderCaged();
        });
        cagedPicker.appendChild(btn);
    });

    function renderCaged() {
        const root = cagedRoot.value;
        const dots = GD.cagedShapeDots(activeCagedLetter, root);
        const usable = dots.every(d => d.muted || d.fret >= 0);

        if (!usable) {
            cagedNote.textContent = `The ${activeCagedLetter}-shape for ${root} needs a fret below the nut to fit as an open-position shape — try a different letter, or picture it as a barre chord further up the neck.`;
            Fretboard.render(cagedBoard, { tuning: TUNING, numFrets: 15 });
            return;
        }
        cagedNote.textContent = `${root} major, ${activeCagedLetter}-shape. This is the open ${activeCagedLetter} chord shape moved up the neck so its root lands on ${root}.`;
        Fretboard.render(cagedBoard, { tuning: TUNING, numFrets: 15, dots });
    }
    cagedRoot.addEventListener('change', renderCaged);
    renderCaged();

    // ── Chord Library ───────────────────────────────────────────────────
    const chordLibGrid = document.getElementById('chord-lib-grid');
    const chordLibBoard = document.getElementById('chord-lib-fretboard');
    let activeChordName = 'C';

    Object.keys(GD.OPEN_CHORDS).forEach(name => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'chord-lib-card';
        card.setAttribute('aria-selected', name === activeChordName ? 'true' : 'false');
        card.innerHTML = `<div class="chord-lib-card-name">${name}</div>`;
        card.addEventListener('click', () => {
            activeChordName = name;
            chordLibGrid.querySelectorAll('.chord-lib-card').forEach(c => c.setAttribute('aria-selected', c === card ? 'true' : 'false'));
            renderChordLib();
        });
        chordLibGrid.appendChild(card);
    });

    function renderChordLib() {
        Fretboard.render(chordLibBoard, {
            tuning: TUNING,
            numFrets: 4,
            dots: GD.OPEN_CHORDS[activeChordName],
        });
    }
    renderChordLib();

    // ── Capo Explorer ───────────────────────────────────────────────────
    const capoOpenChord = document.getElementById('capo-open-chord');
    const capoResults = document.getElementById('capo-results');

    function renderCapo() {
        const openChord = capoOpenChord.value;
        const openIdx = MT.noteIndex(openChord);
        capoResults.innerHTML = '';
        for (let fret = 1; fret <= 7; fret++) {
            const soundingNote = MT.noteName(openIdx + fret, false);
            const cell = document.createElement('div');
            cell.className = 'capo-result';
            cell.innerHTML = `<div class="capo-result-fret">Capo ${fret}</div><div class="capo-result-note">${soundingNote}</div>`;
            capoResults.appendChild(cell);
        }
    }
    capoOpenChord.addEventListener('change', renderCapo);
    renderCapo();
})();
