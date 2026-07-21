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
        ['B', 2], ['B', 3], ['B', 4],
        ['D', 2], ['D', 3], ['D', 4],
        ['F', 2], ['F', 3], ['F', 4],
        ['Gs', 2], ['Gs', 3], ['Gs', 4],
    ].map(([file, oct]) => {
        const sharpNote = { B: 'B', D: 'D', F: 'F', Gs: 'G#' }[file];
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
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
                return res.arrayBuffer();
            })
            .then(data => ctx.decodeAudioData(data))
            .then(buf => { bufferCache[url] = buf; return buf; })
            .catch(err => {
                // Surfaced instead of swallowed — a 404 here means the
                // file/path doesn't match, and a generic "Failed to
                // fetch" almost always means the page was opened as
                // file:// (fetch() of local files is blocked by the
                // browser) rather than served over http(s).
                console.warn('[guitar audio] could not load', url, err);
                return null;
            });
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
    const scaleFretToggle12 = document.getElementById('scale-fret-toggle-12');
    const scaleFretToggle15 = document.getElementById('scale-fret-toggle-15');
    const scaleFretToggle24 = document.getElementById('scale-fret-toggle-24');
    const scaleClearBtn = document.getElementById('scale-clear-btn');
    let scaleRootNote = '';
    let scaleFretCount = 12;

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
        // Clicking the already-active root deselects it, same as the
        // CAGED picker below.
        scaleRootNote = scaleRootNote === note ? '' : note;
        scaleRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === scaleRootNote));
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
            for (let f = 1; f <= scaleFretCount; f++) {
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

    function updateScalePlayButtonState() {
        if (!scalePlayBtn) return;
        scalePlayBtn.disabled = !scaleRootNote;
        if (!scaleRootNote) stopScalePlayback();
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

        scaleChips.innerHTML = '';

        if (!root) {
            // No root picked yet — plain, note-labeled neck with nothing
            // lit up (matches the CAGED panel's own empty state below).
            Fretboard.render(scaleBoard, {
                tuning: TUNING,
                numFrets: scaleFretCount,
                preferFlats,
                openOctaves: OPEN_OCTAVES,
                showOpenBadge: true,
            });
            updateScalePlayButtonState();
            return;
        }

        const notes = MT.scaleNotes(root, type, preferFlats);
        const degrees = MT.scaleDegrees(root, type, preferFlats);

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
            numFrets: scaleFretCount,
            highlight: { notes, root, preferFlats },
            openOctaves: OPEN_OCTAVES,
            showOpenBadge: true,
        });
        updateScalePlayButtonState();
    }
    scaleType.addEventListener('change', () => { stopScalePlayback(); renderScale(); });

    // ── Fret-count selector (12/15/24) — same segmented-toggle pattern
    // as the Bass page's own fret-count control. ────────────────────────
    function setScaleFretCount(n) {
        scaleFretCount = n;
        [scaleFretToggle12, scaleFretToggle15, scaleFretToggle24].forEach(b => b && b.classList.remove('active'));
        ({ 12: scaleFretToggle12, 15: scaleFretToggle15, 24: scaleFretToggle24 })[n].classList.add('active');
        stopScalePlayback();
        renderScale();
    }
    if (scaleFretToggle12) scaleFretToggle12.addEventListener('click', () => setScaleFretCount(12));
    if (scaleFretToggle15) scaleFretToggle15.addEventListener('click', () => setScaleFretCount(15));
    if (scaleFretToggle24) scaleFretToggle24.addEventListener('click', () => setScaleFretCount(24));

    // ── Clear Fretboard — deselects the root (clearing the auto-highlight)
    // and wipes any manually-clicked frets, same as the Bass page's Clear
    // button. Re-render already rebuilds the board from scratch (wiping
    // any gtr-user-picked toggles), so the extra classList cleanup here
    // is just belt-and-suspenders. ───────────────────────────────────────
    if (scaleClearBtn) {
        scaleClearBtn.addEventListener('click', () => {
            scaleRootNote = '';
            scaleRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active'));
            scaleBoard.querySelectorAll('.gtr-fret-cell.gtr-user-picked, .gtr-open-note-badge.gtr-user-picked').forEach(c => c.classList.remove('gtr-user-picked'));
            stopScalePlayback();
            renderScale();
        });
    }

    renderScale();

    // Click any fret to toggle its own highlight and hear that fret's
    // real pitch, independent of the auto-highlighted scale — same
    // "manual note finder" behavior as the Bass page's fretboard.
    // Delegated on the container (not the cells themselves) so it keeps
    // working after renderScale() rebuilds the board on every change.
    scaleBoard.addEventListener('click', e => {
        const badge = e.target.closest('.gtr-open-note-badge');
        const cell = badge ? null : e.target.closest('.gtr-fret-cell');
        const target = badge || cell;
        if (!target || target.dataset.abs === undefined) return;
        target.classList.toggle('gtr-user-picked');
        const abs = Number(target.dataset.abs);
        const preferFlats = scaleNoteDisplayMode === 'flat';
        playTone(MT.noteName(abs % 12, preferFlats), Math.floor(abs / 12));
    });

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
    const chordLibBoard = document.getElementById('chord-lib-fretboard');

    // No chord picked yet — plain, note-labeled neck with nothing lit up
    // (matches the Scale Explorer's and CAGED panel's own empty state),
    // instead of always defaulting to showing the C chord.
    function renderChordLib() {
        Fretboard.render(chordLibBoard, { tuning: TUNING, numFrets: CAGED_NUM_FRETS });
    }
    renderChordLib();

    // ── Chord Finder — ported from the Keyboard page's Chord Finder
    // (root pill + type pill + chord-name/notes banner), themed after
    // the original "Guitar Chord Viewer" workspace (violet root pills,
    // bubblegum-purple type pills, purple banner — see .gcv-* rules in
    // guitar.css). Unlike the preset grid above, this picks ANY root +
    // chord type and highlights its tones across the whole neck (the
    // same highlight mechanic the Scale Explorer uses), rather than a
    // single fixed open-position shape. ─────────────────────────────────
    const chordLibRootPills = document.getElementById('chordlib-root-pills');
    const chordLibTypeRow = document.getElementById('chordlib-type-row');
    const chordLibTypePills = document.getElementById('chordlib-type-pills');
    const chordLibNoteToggle = document.getElementById('chordlib-note-toggle');
    let chordLibRootValue = '';
    let chordLibTypeValue = 'Major';
    let chordLibVoicings = [];
    let chordLibVoicingIndex = -1;
    // Editable working copy of the currently-shown voicing's dots. Starts
    // as a clone of whichever preset voicing is selected, but the user can
    // click individual strings/frets on the board to add, move, or remove
    // notes — letting them dial in fingerings/voicings that aren't in the
    // preset list. null = nothing selected yet (board isn't editable).
    let chordLibCustomDots = null;

    const VOICING_SHAPE_COLOR = { E: '#a99ef5', A: '#a99ef5', D: '#a99ef5', Open: '#a99ef5' };

    // Builds a small 6-string fret-diagram SVG (mute/open markers on top,
    // fretted dots below) for a single voicing chip, windowed to the
    // 4-fret span the shape is actually played in.
    function voicingChipSvg(dots) {
        const perString = [0, 1, 2, 3, 4, 5].map(s => {
            const d = dots.find(x => x.string === s);
            if (!d) return 'x';
            return d.muted ? 'x' : d.fret;
        });
        const fretted = perString.filter(f => typeof f === 'number' && f > 0);
        const minFret = fretted.length ? Math.min(...fretted) : 0;
        const start = Math.max(1, minFret);
        const rowH = 12;
        let svg = '<svg width="52" height="58" viewBox="0 0 52 58" xmlns="http://www.w3.org/2000/svg">';
        svg += '<line x1="6" y1="14" x2="46" y2="14" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>';
        for (let r = 1; r <= 4; r++) {
            svg += `<line x1="6" y1="${14 + r * rowH}" x2="46" y2="${14 + r * rowH}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
        }
        for (let s = 0; s < 6; s++) {
            const x = 6 + s * 8;
            svg += `<line x1="${x}" y1="14" x2="${x}" y2="${14 + 4 * rowH}" stroke="rgba(255,255,255,0.3)" stroke-width="0.8"/>`;
            const f = perString[s];
            if (f === 'x') svg += `<text x="${x}" y="9" text-anchor="middle" font-size="8" font-weight="700" fill="#f07070">×</text>`;
            else if (f === 0) svg += `<circle cx="${x}" cy="9" r="2.8" fill="none" stroke="#4dd4a8" stroke-width="1.1"/>`;
        }
        perString.forEach((f, s) => {
            if (typeof f !== 'number' || f === 0) return;
            if (f < start || f > start + 3) return;
            const x = 6 + s * 8;
            const y = 14 + (f - start + 0.5) * rowH;
            svg += `<circle cx="${x}" cy="${y}" r="4" fill="#7c6fe0" stroke="#a99ef5" stroke-width="1"/>`;
        });
        svg += '</svg>';
        return svg;
    }

    const CHORD_FINDER_TYPE_GROUPS = [
        [['Major', 'Maj'], ['Minor', 'Min'], ['Sus2', 'Sus2'], ['Sus4', 'Sus4'], ['Diminished', 'Dim'], ['Augmented', 'Aug']],
        [['Dominant 7', 'Dom7'], ['Major 7', 'Maj7'], ['Minor 7', 'Min7']],
        [['5th', '5th']],
    ];

    const chordLibAccidentalPills = [];

    NATURALS.forEach(note => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'root-pill';
        pill.textContent = note;
        pill.dataset.sharp = note;
        pill.addEventListener('click', () => selectChordLibRoot(note));
        chordLibRootPills.appendChild(pill);
    });

    const chordLibSep = document.createElement('span');
    chordLibSep.className = 'sf-sep';
    chordLibRootPills.appendChild(chordLibSep);

    MT.NOTES_SHARP.forEach((sharpVal, i) => {
        if (!sharpVal.includes('#')) return;
        const flatVal = MT.NOTES_FLAT[i].replace('b', '♭');
        const sharpLabel = sharpVal.replace('#', '♯');
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'root-pill sf-acc-pill';
        pill.dataset.sharp = sharpVal;
        pill.addEventListener('click', () => selectChordLibRoot(sharpVal));
        chordLibAccidentalPills.push({ el: pill, sharp: sharpVal, sharpLabel: sharpLabel, flatLabel: flatVal });
        chordLibRootPills.appendChild(pill);
    });

    CHORD_FINDER_TYPE_GROUPS.forEach((group, gi) => {
        if (gi > 0) {
            const sep = document.createElement('div');
            sep.className = 'pill-sep' + (gi === 1 ? ' pill-sep-break' : '');
            chordLibTypePills.appendChild(sep);
        }
        group.forEach(([name, label]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'type-pill-btn';
            btn.textContent = label;
            btn.dataset.type = name;
            btn.classList.toggle('active', name === chordLibTypeValue);
            btn.addEventListener('click', () => selectChordLibType(name));
            chordLibTypePills.appendChild(btn);
        });
    });

    let chordLibNoteDisplayMode = window.NoteDisplay.getMode();
    function refreshChordLibAccidentalPills() {
        chordLibAccidentalPills.forEach(p => {
            p.el.dataset.mode = chordLibNoteDisplayMode;
            p.el.textContent = chordLibNoteDisplayMode === 'sharp' ? p.sharpLabel : p.flatLabel;
        });
    }
    refreshChordLibAccidentalPills();
    window.NoteDisplay.bindToggle(chordLibNoteToggle, mode => {
        chordLibNoteDisplayMode = mode;
        refreshChordLibAccidentalPills();
        renderChordFinder();
    });

    function selectChordLibRoot(note) {
        chordLibRootValue = chordLibRootValue === note ? '' : note;
        chordLibRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === chordLibRootValue));
        chordLibTypeRow.classList.toggle('ps-visible', !!chordLibRootValue);
        renderChordFinder();
    }

    function selectChordLibType(name) {
        chordLibTypeValue = name;
        chordLibTypePills.querySelectorAll('.type-pill-btn').forEach(p => p.classList.toggle('active', p.dataset.type === chordLibTypeValue));
        renderChordFinder();
    }

    const chordLibVoicingsSection = document.getElementById('chordlib-voicings-section');
    const chordLibVoicingsRow = document.getElementById('chordlib-voicings-row');
    const chordLibPlayBtn = document.getElementById('chordlib-play-btn');
    const chordLibClearBtn = document.getElementById('chordlib-clear-btn');

    // ── Play button — strums the currently displayed voicing's actual
    // fretted/open notes, low string to high, mirroring the Scale
    // Explorer's Play button (same is-playing pulse, same disabled state
    // when nothing is selected). ─────────────────────────────────────────
    let chordLibPlayTimeouts = [];
    function stopChordLibPlayback() {
        chordLibPlayTimeouts.forEach(id => clearTimeout(id));
        chordLibPlayTimeouts = [];
        if (chordLibPlayBtn) chordLibPlayBtn.classList.remove('is-playing');
    }

    function playChordVoicing() {
        if (!chordLibCustomDots) return;
        const dots = chordLibCustomDots;
        const notes = dots
            .filter(d => !d.muted)
            .sort((a, b) => a.string - b.string)
            .map(d => ({ note: MT.noteName(MT.noteIndex(TUNING[d.string]) + d.fret, false), octave: Math.floor((OPEN_OCTAVES[d.string] * 12 + MT.noteIndex(TUNING[d.string]) + d.fret) / 12) }));
        if (!notes.length) return;
        stopChordLibPlayback();
        const strumDelay = 45;
        chordLibPlayBtn.classList.add('is-playing');
        notes.forEach((item, i) => {
            const id = setTimeout(() => {
                playTone(item.note, item.octave);
                if (i === notes.length - 1) {
                    const doneId = setTimeout(() => chordLibPlayBtn.classList.remove('is-playing'), 500);
                    chordLibPlayTimeouts.push(doneId);
                }
            }, i * strumDelay);
            chordLibPlayTimeouts.push(id);
        });
    }
    if (chordLibPlayBtn) chordLibPlayBtn.addEventListener('click', playChordVoicing);

    if (chordLibClearBtn) {
        chordLibClearBtn.addEventListener('click', () => {
            stopChordLibPlayback();
            resetChordFinder();
        });
    }

    function renderVoicingChips() {
        chordLibVoicingsRow.innerHTML = '';
        if (chordLibVoicings.length === 0) {
            chordLibVoicingsSection.hidden = true;
            return;
        }
        chordLibVoicingsSection.hidden = false;
        chordLibVoicings.forEach((v, i) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'gcv-voicing-chip' + (i === chordLibVoicingIndex ? ' active' : '');
            const color = VOICING_SHAPE_COLOR[v.shape] || '#7c6fe0';
            chip.innerHTML = `${voicingChipSvg(v.dots)}<span class="gcv-voicing-chip-label">${v.label}</span>` +
                `<span class="gcv-shape-badge" style="background:${color}22;color:${color};border:1px solid ${color}66;">${v.shape}-shape</span>`;
            chip.addEventListener('click', () => selectVoicing(i));
            chordLibVoicingsRow.appendChild(chip);
        });
    }

    function renderChordLibBoard() {
        const preferFlats = chordLibNoteDisplayMode === 'flat';
        Fretboard.render(chordLibBoard, {
            tuning: TUNING,
            numFrets: CAGED_NUM_FRETS,
            dots: chordLibCustomDots,
            preferFlats,
            showOpenBadge: true,
        });
        if (chordLibPlayBtn) chordLibPlayBtn.disabled = !chordLibCustomDots.some(d => !d.muted);
    }

    function selectVoicing(i) {
        if (i < 0 || i >= chordLibVoicings.length) return;
        chordLibVoicingIndex = i;
        stopChordLibPlayback();
        // Clone so edits never mutate the original preset — switching
        // voicing chips always restores that chip's untouched shape.
        chordLibCustomDots = chordLibVoicings[i].dots.map(d => ({ ...d }));
        renderChordLibBoard();
        renderVoicingChips();
    }

    function resetChordFinder() {
        chordLibRootValue = '';
        chordLibTypeValue = 'Major';
        chordLibVoicings = [];
        chordLibVoicingIndex = -1;
        chordLibCustomDots = null;
        stopChordLibPlayback();
        if (chordLibPlayBtn) chordLibPlayBtn.disabled = true;
        chordLibRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active'));
        chordLibTypePills.querySelectorAll('.type-pill-btn').forEach(p => p.classList.toggle('active', p.dataset.type === 'Major'));
        chordLibTypeRow.classList.remove('ps-visible');
        const displayName = document.querySelector('#chordlib-display .chord-display-name');
        const displayNotes = document.querySelector('#chordlib-display .chord-display-notes');
        displayName.textContent = 'Select a chord';
        displayName.classList.remove('has-chord');
        displayNotes.textContent = '';
        renderVoicingChips();
        renderChordLib();
    }

    function renderChordFinder() {
        const root = chordLibRootValue;
        const displayName = document.querySelector('#chordlib-display .chord-display-name');
        const displayNotes = document.querySelector('#chordlib-display .chord-display-notes');
        if (!root) {
            displayName.textContent = 'Select a chord';
            displayName.classList.remove('has-chord');
            displayNotes.textContent = '';
            chordLibVoicings = [];
            chordLibVoicingIndex = -1;
            chordLibCustomDots = null;
            renderVoicingChips();
            renderChordLib();
            return;
        }
        const type = chordLibTypeValue;
        const preferFlats = chordLibNoteDisplayMode === 'flat';
        const notes = MT.chordNotes(root, type, preferFlats);
        const typeLabel = type === 'Major' ? 'Major' : type;
        displayName.textContent = `${MT.noteName(MT.noteIndex(root), preferFlats)} ${typeLabel}`;
        displayName.classList.add('has-chord');
        displayNotes.textContent = notes.join(' · ');
        chordLibVoicings = GD.chordVoicings(root, type, CAGED_NUM_FRETS);
        if (chordLibVoicings.length === 0) {
            const fallback = (GD.chordFingering(root, type, TUNING, CAGED_NUM_FRETS) || []).map(d => d.muted ? d : { ...d, isRoot: true });
            chordLibVoicings = [{ label: 'Shape', shape: 'Open', barreFret: 0, dots: fallback }];
        }
        selectVoicing(0);
    }

    // Click any fretted note to add/move/remove it, or click a string's
    // open-string badge to cycle open → muted → unused. This lets the
    // player build fingerings/voicings of their own that aren't in the
    // preset chip list, starting from whichever preset they last picked.
    // Delegated on the container so it survives every re-render.
    function playChordLibNote(s, f) {
        const preferFlats = chordLibNoteDisplayMode === 'flat';
        const noteIdx = (MT.noteIndex(TUNING[s]) + f) % 12;
        const octave = Math.floor((OPEN_OCTAVES[s] * 12 + MT.noteIndex(TUNING[s]) + f) / 12);
        playTone(MT.noteName(noteIdx, preferFlats), octave);
    }

    chordLibBoard.addEventListener('click', e => {
        if (!chordLibCustomDots) return;

        const badge = e.target.closest('.gtr-open-note-badge');
        if (badge && badge.dataset.string !== undefined) {
            const s = Number(badge.dataset.string);
            const idx = chordLibCustomDots.findIndex(d => d.string === s);
            if (idx < 0) {
                // blank string -> open
                chordLibCustomDots.push({ string: s, fret: 0, isRoot: true });
                playChordLibNote(s, 0);
            } else if (chordLibCustomDots[idx].fret === 0 && !chordLibCustomDots[idx].muted) {
                // open -> muted
                chordLibCustomDots[idx] = { string: s, fret: 0, muted: true };
            } else if (chordLibCustomDots[idx].muted) {
                // muted -> blank
                chordLibCustomDots.splice(idx, 1);
            } else {
                // fretted -> open
                chordLibCustomDots[idx] = { string: s, fret: 0, isRoot: true };
                playChordLibNote(s, 0);
            }
            renderChordLibBoard();
            return;
        }

        const cell = e.target.closest('.gtr-fret-cell');
        if (!cell || cell.dataset.string === undefined) return;
        const s = Number(cell.dataset.string);
        const f = Number(cell.dataset.fret);
        const idx = chordLibCustomDots.findIndex(d => d.string === s && !d.muted);
        if (idx >= 0 && chordLibCustomDots[idx].fret === f) {
            // clicking the already-selected note removes it (string unused)
            chordLibCustomDots.splice(idx, 1);
        } else {
            if (idx >= 0) chordLibCustomDots.splice(idx, 1);
            const mutedIdx = chordLibCustomDots.findIndex(d => d.string === s && d.muted);
            if (mutedIdx >= 0) chordLibCustomDots.splice(mutedIdx, 1);
            chordLibCustomDots.push({ string: s, fret: f, isRoot: true });
            playChordLibNote(s, f);
        }
        renderChordLibBoard();
    });

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
