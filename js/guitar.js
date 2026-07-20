(function () {
    const MT = window.MusicTheory;
    const GD = window.GuitarData;
    const TUNING = ['E', 'A', 'D', 'G', 'B', 'E']; // low to high
    // Real open-string octave for each string above, low to high (standard
    // tuning: E2 A2 D3 G3 B3 E4) — used to turn a fret position into a true
    // absolute pitch for scale playback, matching the pattern the Bass page
    // uses for its own OPEN_OCTAVE map.
    const OPEN_OCTAVES = [2, 2, 3, 3, 3, 4];

    document.documentElement.style.setProperty('--fret-accent-rgb', getComputedStyle(document.documentElement).getPropertyValue('--guitar-rgb'));

    const NATURALS = ['C','D','E','F','G','A','B'];

    // ── Audio — real guitar samples from audio/guitar, pitch-shifted (same
    // approach as the Bass/Keyboard pages) to cover every fretted note from
    // the nearest sampled one. Uses Web Audio's AudioBufferSourceNode so
    // playbackRate is reliably honored on every browser, including iOS
    // Safari. ─────────────────────────────────────────────────────────────
    const GUITAR_SAMPLES = [
        ['As', 2], ['As', 3], ['As', 4], ['As', 5],
        ['Cs', 2], ['Cs', 3], ['Cs', 4], ['Cs', 5], ['Cs', 6],
        ['E', 2], ['E', 3], ['E', 4], ['E', 5],
        ['G', 2], ['G', 3], ['G', 4], ['G', 5],
    ].map(([file, oct]) => {
        const sharpNote = { As: 'A#', Cs: 'C#', E: 'E', G: 'G' }[file];
        return { url: `audio/guitar/${file}${oct}.mp3`, abs: oct * 12 + MT.noteIndex(sharpNote) };
    });

    function nearestGuitarSample(targetAbs) {
        let best = GUITAR_SAMPLES[0];
        let bestDiff = Infinity;
        GUITAR_SAMPLES.forEach(s => {
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
    GUITAR_SAMPLES.forEach(s => loadBuffer(s.url));

    function playTone(noteName, octave) {
        try {
            const targetAbs = octave * 12 + MT.noteIndex(noteName);
            const { url, semitoneDiff } = nearestGuitarSample(targetAbs);
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
    const scaleRootPills = document.getElementById('scale-root-pills');
    const scaleType = document.getElementById('scale-type');
    const scaleChips = document.getElementById('scale-chips');
    const scaleBoard = document.getElementById('scale-fretboard');
    const scalePlayBtn = document.getElementById('scale-play-btn');
    const scaleSpeedToggle = document.getElementById('scale-speed-toggle');
    let scaleRootNote = 'C';

    Object.keys(MT.SCALES).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        scaleType.appendChild(opt);
    });

    // Root pills — same naturals + accidental-pill pattern as the CAGED
    // picker below (itself ported from the bass page's Scale Explorer),
    // just always keeping one root selected instead of allowing deselect.
    const scaleAccidentalPills = [];

    NATURALS.forEach(n => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'root-pill scale-root-pill';
        pill.textContent = n;
        pill.dataset.sharp = n;
        pill.classList.toggle('active', n === scaleRootNote);
        pill.addEventListener('click', () => selectScaleRoot(n));
        scaleRootPills.appendChild(pill);
    });

    const scaleSep = document.createElement('span');
    scaleSep.className = 'sf-sep';
    scaleRootPills.appendChild(scaleSep);

    MT.NOTES_SHARP.forEach((sharpVal, i) => {
        if (!sharpVal.includes('#')) return; // naturals already built above
        const flatVal = MT.NOTES_FLAT[i].replace('b', '♭');
        const sharpLabel = sharpVal.replace('#', '♯');
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'root-pill sf-acc-pill';
        pill.dataset.sharp = sharpVal;
        pill.addEventListener('click', () => selectScaleRoot(sharpVal));
        scaleAccidentalPills.push({ el: pill, sharp: sharpVal, sharpLabel: sharpLabel, flatLabel: flatVal });
        scaleRootPills.appendChild(pill);
    });

    function selectScaleRoot(note) {
        scaleRootNote = note;
        scaleRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === note));
        stopScalePlayback();
        renderScale();
    }

    // Sharp/flat spelling toggle for this card — shared across every
    // instrument page (see js/note-display.js), same as CAGED's toggle.
    let scaleNoteDisplayMode = window.NoteDisplay.getMode();
    const scaleNoteToggle = document.getElementById('scale-note-toggle');

    function refreshScaleAccidentalPills() {
        scaleAccidentalPills.forEach(p => {
            p.el.dataset.mode = scaleNoteDisplayMode;
            p.el.textContent = scaleNoteDisplayMode === 'sharp' ? p.sharpLabel : p.flatLabel;
        });
    }
    refreshScaleAccidentalPills();

    window.NoteDisplay.bindToggle(scaleNoteToggle, mode => {
        scaleNoteDisplayMode = mode;
        refreshScaleAccidentalPills();
        stopScalePlayback();
        renderScale();
    });

    // ── Play button — plays the currently selected scale as an ascending
    // run across the whole fretboard (every fretted match, low to high),
    // mirroring the Bass/Keyboard pages' Play buttons. ──────────────────
    let scalePlayTimeouts = [];
    function stopScalePlayback() {
        scalePlayTimeouts.forEach(id => clearTimeout(id));
        scalePlayTimeouts = [];
        if (scalePlayBtn) scalePlayBtn.classList.remove('is-playing');
    }

    // ── Playback speed — cycles .5x → .75x → 1x, same steps as the
    // Bass/Keyboard pages, dividing the per-note step delay (lower
    // multiplier = slower playback).
    const PLAY_SPEEDS = [0.5, 0.75, 1];
    let scalePlaySpeed = 1;
    if (scaleSpeedToggle) {
        scaleSpeedToggle.addEventListener('click', () => {
            const idx = (PLAY_SPEEDS.indexOf(scalePlaySpeed) + 1) % PLAY_SPEEDS.length;
            scalePlaySpeed = PLAY_SPEEDS[idx];
            scaleSpeedToggle.textContent = scalePlaySpeed + 'x';
            scaleSpeedToggle.classList.toggle('active', scalePlaySpeed !== 1);
        });
    }

    // Builds the note-by-note playback order: every fret across the whole
    // board whose pitch class is in the scale, deduped by real absolute
    // pitch and sorted low to high — so playback spans the entire neck
    // instead of looping back after one octave (same approach as the
    // Bass page's buildScaleTimeline).
    function buildScaleTimeline() {
        const preferFlats = scaleNoteDisplayMode === 'flat';
        const scaleSet = new Set(MT.scaleNotes(scaleRootNote, scaleType.value, preferFlats).map(n => MT.noteIndex(n)));
        const seen = new Set();
        const timeline = [];
        TUNING.forEach((openNote, i) => {
            const openIdx = MT.noteIndex(openNote);
            const openOctave = OPEN_OCTAVES[i];
            for (let f = 1; f <= 15; f++) {
                const abs = openOctave * 12 + openIdx + f;
                const pc = abs % 12;
                if (!scaleSet.has(pc) || seen.has(abs)) continue;
                seen.add(abs);
                timeline.push({ note: MT.noteName(pc, preferFlats), octave: Math.floor(abs / 12), abs });
            }
        });
        timeline.sort((a, b) => a.abs - b.abs);
        return timeline;
    }

    function playScale() {
        const timeline = buildScaleTimeline();
        if (!timeline.length) return;
        stopScalePlayback();
        const stepDelay = 230 / scalePlaySpeed;
        scalePlayBtn.classList.add('is-playing');
        timeline.forEach((item, i) => {
            const id = setTimeout(() => {
                playTone(item.note, item.octave);
                if (i === timeline.length - 1) {
                    const doneId = setTimeout(() => scalePlayBtn.classList.remove('is-playing'), 300);
                    scalePlayTimeouts.push(doneId);
                }
            }, i * stepDelay);
            scalePlayTimeouts.push(id);
        });
    }
    if (scalePlayBtn) scalePlayBtn.addEventListener('click', playScale);

    function renderScale() {
        const root = scaleRootNote;
        const type = scaleType.value;
        const preferFlats = scaleNoteDisplayMode === 'flat';
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
    scaleType.addEventListener('change', () => { stopScalePlayback(); renderScale(); });
    renderScale();

    // ── CAGED System ────────────────────────────────────────────────────
    // Pick a root to see all 5 CAGED shapes light up at once, wherever they
    // fall across the neck, each shape in its own color. No root picked =
    // no highlighting (matches the reference CAGED System tool exactly).
    const cagedRootPills = document.getElementById('caged-root-pills');
    const cagedAutoLabel = document.getElementById('caged-auto-label');
    const cagedLegend = document.getElementById('caged-legend');
    const cagedBoard = document.getElementById('caged-fretboard');
    const CAGED_LETTERS = ['C', 'A', 'G', 'E', 'D'];
    const CAGED_NUM_FRETS = 15;
    let cagedRootNote = '';

    const cagedAccidentalPills = [];

    NATURALS.forEach(n => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'root-pill caged-root-pill';
        pill.textContent = n;
        pill.setAttribute('aria-pressed', 'false');
        pill.addEventListener('click', () => selectCagedRoot(pill, n));
        cagedRootPills.appendChild(pill);
    });

    const cagedSep = document.createElement('span');
    cagedSep.className = 'sf-sep';
    cagedRootPills.appendChild(cagedSep);

    MT.NOTES_SHARP.forEach((sharpVal, i) => {
        if (!sharpVal.includes('#')) return; // naturals already built above
        const flatVal = MT.NOTES_FLAT[i].replace('b', '♭');
        const sharpLabel = sharpVal.replace('#', '♯');
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'root-pill caged-root-pill sf-acc-pill';
        pill.setAttribute('aria-pressed', 'false');
        pill.addEventListener('click', () => selectCagedRoot(pill, sharpVal));
        cagedAccidentalPills.push({ el: pill, sharp: sharpVal, sharpLabel: sharpLabel, flatLabel: flatVal });
        cagedRootPills.appendChild(pill);
    });

    function selectCagedRoot(pill, n) {
        // Clicking the already-active root deselects it, same as the
        // reference tool's root pills.
        cagedRootNote = cagedRootNote === n ? '' : n;
        cagedRootPills.querySelectorAll('.caged-root-pill').forEach(p =>
            p.setAttribute('aria-pressed', p === pill && cagedRootNote ? 'true' : 'false'));
        renderCaged();
    }

    // ── Sharp/flat spelling toggle — shared across every instrument page
    // (see js/note-display.js). Flips the accidental pills' labels here,
    // same as the bass page's Root Note pills. ──────────────────────────
    let cagedNoteDisplayMode = window.NoteDisplay.getMode();
    const cagedNoteToggle = document.getElementById('caged-note-toggle');

    function refreshCagedAccidentalPills() {
        cagedAccidentalPills.forEach(p => {
            p.el.dataset.mode = cagedNoteDisplayMode;
            p.el.textContent = cagedNoteDisplayMode === 'sharp' ? p.sharpLabel : p.flatLabel;
        });
    }
    refreshCagedAccidentalPills();

    window.NoteDisplay.bindToggle(cagedNoteToggle, mode => {
        cagedNoteDisplayMode = mode;
        refreshCagedAccidentalPills();
        renderCaged();
    });

    CAGED_LETTERS.forEach(letter => {
        const item = document.createElement('div');
        item.className = 'caged-legend-item';
        item.innerHTML = `<span class="caged-legend-swatch caged-${letter}"></span>${letter} Shape`;
        cagedLegend.appendChild(item);
    });
    const cagedFretRangeLabel = document.createElement('span');
    cagedFretRangeLabel.className = 'caged-fret-range-label';
    cagedFretRangeLabel.textContent = `Only shapes within frets 1–${CAGED_NUM_FRETS} shown`;
    cagedLegend.appendChild(cagedFretRangeLabel);
    const cagedLegendInfo = document.createElement('span');
    cagedLegendInfo.className = 'caged-legend-info';
    cagedLegendInfo.textContent = 'i';
    cagedLegend.appendChild(cagedLegendInfo);

    function renderCaged() {
        const preferFlats = cagedNoteDisplayMode === 'flat';
        if (!cagedRootNote) {
            cagedAutoLabel.textContent = '';
            cagedLegend.style.display = 'none';
            // No root picked yet — show a plain, note-labeled neck (same as
            // the Scale Explorer's default view) instead of diagram mode,
            // which only labels explicit shape dots and would otherwise
            // leave every fret blank.
            Fretboard.render(cagedBoard, { tuning: TUNING, numFrets: CAGED_NUM_FRETS, preferFlats });
            return;
        }

        const dots = GD.cagedAllShapeDots(cagedRootNote, CAGED_NUM_FRETS);
        const shapesShown = CAGED_LETTERS.filter(letter => dots.some(d => d.cagedLetter === letter));

        cagedAutoLabel.textContent = shapesShown.length > 0
            ? ''
            : `No CAGED shapes fit within frets 1–${CAGED_NUM_FRETS} for ${cagedRootNote}`;
        cagedAutoLabel.style.color = shapesShown.length > 0 ? 'var(--purple-l)' : 'var(--text3)';
        cagedLegend.style.display = 'flex';
        if (shapesShown.length > 0) {
            cagedLegendInfo.setAttribute('data-tooltip', `Showing ${shapesShown.length} shape${shapesShown.length > 1 ? 's' : ''} for ${cagedRootNote} major: ${shapesShown.join(' · ')}`);
        } else {
            cagedLegendInfo.removeAttribute('data-tooltip');
        }

        Fretboard.render(cagedBoard, { tuning: TUNING, numFrets: CAGED_NUM_FRETS, dots, preferFlats });
    }
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
            numFrets: CAGED_NUM_FRETS,
            dots: GD.OPEN_CHORDS[activeChordName],
            showOpenBadge: true,
        });
    }
    renderChordLib();

    // ── Capo Explorer ───────────────────────────────────────────────────
    const capoOpenChord = document.getElementById('capo-open-chord');
    const capoResults = document.getElementById('capo-results');
    const capoBoard = document.getElementById('capo-fretboard');
    let capoSelectedFret = 1;

    function renderCapoBoard() {
        const openChord = capoOpenChord.value;
        const shape = GD.OPEN_CHORDS[openChord];
        // Shift the open-position shape up by the capo fret — a capo acts
        // as a movable nut, so fretted notes move up and open strings
        // (fret 0) become barred at the capo fret instead of ringing open.
        const dots = shape.map(d => ({
            string: d.string,
            fret: d.muted ? -1 : d.fret + capoSelectedFret,
            isRoot: !!d.isRoot,
            muted: !!d.muted,
            label: d.isRoot ? MT.noteName(MT.noteIndex(openChord) + capoSelectedFret, false) : '',
            cagedLetter: openChord.replace('m', ''),
        }));
        Fretboard.render(capoBoard, { tuning: TUNING, numFrets: CAGED_NUM_FRETS, dots, capo: capoSelectedFret });
    }

    function renderCapo() {
        const openChord = capoOpenChord.value;
        const openIdx = MT.noteIndex(openChord);
        capoResults.innerHTML = '';
        for (let fret = 1; fret <= 7; fret++) {
            const soundingNote = MT.noteName(openIdx + fret, false);
            const cell = document.createElement('div');
            cell.className = 'capo-result';
            cell.setAttribute('aria-selected', fret === capoSelectedFret ? 'true' : 'false');
            cell.innerHTML = `<div class="capo-result-fret">Capo ${fret}</div><div class="capo-result-note">${soundingNote}</div>`;
            cell.addEventListener('click', () => {
                capoSelectedFret = fret;
                capoResults.querySelectorAll('.capo-result').forEach(c => c.setAttribute('aria-selected', 'false'));
                cell.setAttribute('aria-selected', 'true');
                renderCapoBoard();
            });
            capoResults.appendChild(cell);
        }
        renderCapoBoard();
    }
    capoOpenChord.addEventListener('change', () => { capoSelectedFret = 1; renderCapo(); });
    renderCapo();
})();
