(function () {
    const MT = window.MusicTheory;
    const KD = window.KeyboardData;
    // Starting octave per range: 2 oct → C4, 3 oct → C3, 5 oct → C2.
    const START_OCTAVE = { 2: 4, 3: 3, 5: 2 };
    let octaveCount = 5;
    let keys = KD.buildKeys(octaveCount);

    // ── Audio — real piano samples from audio/piano, pitch-shifted to
    // cover every key from the nearest sampled note. ────────────────────
    //
    // NOTE: this uses the Web Audio API (AudioBufferSourceNode.playbackRate)
    // rather than HTMLAudioElement.playbackRate. The <audio> element's
    // playbackRate is unreliable across browsers (notably ignored/clamped
    // on iOS Safari), which made many nearby keys silently fall back to a
    // sample's original pitch and sound identical. Web Audio's
    // playbackRate is reliably honored everywhere, so every key gets its
    // own distinct pitch.
    let sustainOn = false;
    const PIANO_SAMPLES = [
        ['A', 2], ['A', 3], ['A', 4], ['A', 5], ['A', 6],
        ['C', 2], ['C', 3], ['C', 4], ['C', 5], ['C', 6], ['C', 7],
        ['Ds', 2], ['Ds', 3], ['Ds', 4], ['Ds', 5], ['Ds', 6],
        ['Fs', 2], ['Fs', 3], ['Fs', 4], ['Fs', 5], ['Fs', 6],
    ].map(([file, oct]) => {
        const sharpNote = { A: 'A', C: 'C', Ds: 'D#', Fs: 'F#' }[file];
        return { url: `audio/piano/${file}${oct}.mp3`, abs: oct * 12 + MT.noteIndex(sharpNote) };
    });

    function nearestPianoSample(targetAbs) {
        let best = PIANO_SAMPLES[0];
        let bestDiff = Infinity;
        PIANO_SAMPLES.forEach(s => {
            const diff = Math.abs(targetAbs - s.abs);
            if (diff < bestDiff) { bestDiff = diff; best = s; }
        });
        return { url: best.url, semitoneDiff: targetAbs - best.abs };
    }

    // Lazily-created AudioContext (must be created/resumed after a user
    // gesture in most browsers, so we create it on first key press).
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

    // Decoded-buffer cache, keyed by sample URL. Each sample is fetched
    // and decoded once, then reused (via new AudioBufferSourceNodes) for
    // every key that maps to it.
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

    // Preload every sample up front so the first note played on any key
    // isn't delayed by a network fetch + decode.
    PIANO_SAMPLES.forEach(s => loadBuffer(s.url));

    function playTone(noteName, octave) {
        try {
            const targetAbs = octave * 12 + MT.noteIndex(noteName);
            const { url, semitoneDiff } = nearestPianoSample(targetAbs);
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

                if (!sustainOn) {
                    const stopAt = ctx.currentTime + 0.9;
                    // Short fade-out avoids an audible click when cutting
                    // the sample off early.
                    gain.gain.setValueAtTime(0.85, Math.max(ctx.currentTime, stopAt - 0.05));
                    gain.gain.linearRampToValueAtTime(0, stopAt);
                    source.stop(stopAt);
                }
            });
        } catch (e) { /* audio unavailable, fail silently */ }
    }

    // ── Rendering ───────────────────────────────────────────────────────
    const pianoEl = document.getElementById('piano');
    const pianoFeltEl = document.querySelector('.piano-felt');

    function buildPiano() {
        keys = KD.buildKeys(octaveCount);
        const startOctave = START_OCTAVE[octaveCount];
        pianoEl.dataset.octaves = String(octaveCount);
        if (pianoFeltEl) pianoFeltEl.dataset.octaves = String(octaveCount);
        pianoEl.innerHTML = '';
        const whiteKeys = keys.filter(k => k.type === 'white');
        const whiteWidthPct = 100 / whiteKeys.length;

        whiteKeys.forEach((k) => {
            const displayOctave = startOctave + k.octave;
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'pk pk--white';
            el.dataset.note = k.note;
            el.dataset.octave = displayOctave;
            el.style.width = whiteWidthPct + '%';
            el.innerHTML = `<span class="pk-label"></span>`;
            el.addEventListener('click', () => { playTone(k.note, displayOctave); flash(el); });
            pianoEl.appendChild(el);
        });

        let whiteIndex = -1;
        keys.forEach((k) => {
            if (k.type === 'white') { whiteIndex++; return; }
            const displayOctave = startOctave + k.octave;
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'pk pk--black';
            el.dataset.note = k.note;
            el.dataset.octave = displayOctave;
            const leftPct = (whiteIndex + 1) * whiteWidthPct - (whiteWidthPct * 0.28);
            el.style.left = leftPct + '%';
            el.style.width = (whiteWidthPct * 0.56) + '%';
            el.innerHTML = `<span class="pk-label"></span>`;
            el.addEventListener('click', () => { playTone(k.note, displayOctave); flash(el); });
            pianoEl.appendChild(el);
        });

        updateKeyLabels();
    }

    function flash(el) {
        el.classList.add('pk--pressed');
        setTimeout(() => el.classList.remove('pk--pressed'), 180);
    }

    // ── Key-label mode toggle — cycles Notes → Intervals → Off. Intervals
    // are shown relative to whichever root is currently active (Chord
    // Finder takes priority over Scale Explorer), falling back to C so
    // the mode always renders something meaningful. Declared before the
    // first buildPiano() call, and chordRootValue/scaleRootValue below
    // are declared with `var` so they're safely hoisted (not TDZ'd) by
    // the time updateKeyLabels() first runs.
    const LABEL_MODES = ['notes', 'intervals', 'off'];
    const LABEL_MODE_TEXT = { notes: 'Notes', intervals: 'Intervals', off: 'Off' };
    let labelMode = 'notes';
    const labelModeToggle = document.getElementById('label-mode-toggle');

    function getActiveRoot() {
        return chordRootValue || scaleRootValue || 'C';
    }

    function updateKeyLabels() {
        const rootIdx = MT.noteIndex(getActiveRoot());
        pianoEl.querySelectorAll('.pk').forEach(el => {
            const label = el.querySelector('.pk-label');
            if (!label) return;
            if (labelMode === 'off') {
                label.textContent = '';
            } else if (labelMode === 'intervals') {
                label.textContent = MT.degreeLabel(MT.noteIndex(el.dataset.note) - rootIdx);
            } else {
                label.textContent = el.classList.contains('pk--white') ? el.dataset.note + el.dataset.octave : el.dataset.note;
            }
        });
    }

    labelModeToggle.addEventListener('click', () => {
        labelMode = LABEL_MODES[(LABEL_MODES.indexOf(labelMode) + 1) % LABEL_MODES.length];
        labelModeToggle.textContent = LABEL_MODE_TEXT[labelMode];
        labelModeToggle.classList.toggle('active', labelMode !== 'notes');
        updateKeyLabels();
    });

    // Tracks whichever notes are currently highlighted (scale or chord,
    // whichever was rendered most recently) so the Play button below
    // always knows exactly what to play back, without recomputing it.
    let activeNotes = null;
    let activeIsChord = false;

    // Lays a sequence of note names out across ascending octaves,
    // starting from the current range's base octave, climbing one
    // octave every time a note's chromatic index wraps back around
    // (e.g. B → C). Used to pick a single, real-sounding voicing for a
    // chord — one instance of each note — instead of every occurrence
    // of that note name across the whole keyboard. Also used by
    // playback so what's highlighted is exactly what gets played.
    function layOutAscending(notes) {
        const startOctave = START_OCTAVE[octaveCount];
        let octave = startOctave;
        let prevIdx = -1;
        return notes.map(note => {
            const idx = MT.noteIndex(note);
            if (idx < prevIdx) octave++;
            prevIdx = idx;
            return { note, octave };
        });
    }

    function applyHighlight(notes, root, isChord) {
        // Chords: highlight only a single voicing (one occurrence of
        // each note, climbing octaves as needed) so the keyboard stays
        // legible enough for an eventual inversion display. Scales
        // still highlight every occurrence across the whole range.
        const voicing = (isChord && notes && notes.length) ? layOutAscending(notes) : null;
        pianoEl.querySelectorAll('.pk').forEach(el => {
            el.classList.remove('pk--highlight', 'pk--root');
            if (!notes) return;
            const isMatch = voicing
                ? voicing.some(v => v.note === el.dataset.note && v.octave === Number(el.dataset.octave))
                : notes.includes(el.dataset.note);
            if (isMatch) {
                el.classList.add('pk--highlight');
                if (root && MT.noteIndex(root) === MT.noteIndex(el.dataset.note)) {
                    el.classList.add('pk--root');
                }
            }
        });
        activeNotes = notes && notes.length ? notes : null;
        activeIsChord = !!isChord;
        if (keyboardPlayBtn) keyboardPlayBtn.disabled = !activeNotes;
        if (!activeNotes) stopScheduledPlayback();
    }

    // ── Play button — replays whatever scale or chord is currently
    // highlighted, using the same real-piano playTone() the keys use.
    // A scale plays as an ascending run; a chord plays as a near-
    // simultaneous strum. Octaves climb automatically whenever a note's
    // chromatic index wraps back around (e.g. B → C), so multi-octave
    // scales still play as one continuous rise rather than bouncing
    // back down to the starting octave on every note.
    const keyboardPlayBtn = document.getElementById('keyboard-play-btn');
    let playTimeouts = [];
    function stopScheduledPlayback() {
        playTimeouts.forEach(id => clearTimeout(id));
        playTimeouts = [];
        if (keyboardPlayBtn) keyboardPlayBtn.classList.remove('is-playing');
    }
    function playActiveNotes() {
        if (!activeNotes || !activeNotes.length) return;
        stopScheduledPlayback();
        const timeline = layOutAscending(activeNotes);
        const stepDelay = activeIsChord ? 45 : 230;
        keyboardPlayBtn.classList.add('is-playing');
        timeline.forEach((item, i) => {
            const id = setTimeout(() => {
                playTone(item.note, item.octave);
                const keyEl = pianoEl.querySelector(`.pk[data-note="${item.note}"][data-octave="${item.octave}"]`);
                if (keyEl) flash(keyEl);
                if (i === timeline.length - 1) {
                    const doneId = setTimeout(() => keyboardPlayBtn.classList.remove('is-playing'), 300);
                    playTimeouts.push(doneId);
                }
            }, i * stepDelay);
            playTimeouts.push(id);
        });
    }
    if (keyboardPlayBtn) keyboardPlayBtn.addEventListener('click', playActiveNotes);

    buildPiano();

    // ── Octave toggle ───────────────────────────────────────────────────
    // 2 / 3 / 5 octave range, mirroring the bass page's fret-count
    // pill-group toggle. Rebuilds the keybed then reapplies whichever
    // scale or chord is currently selected.
    const octaveToggle2 = document.getElementById('octave-toggle-2');
    const octaveToggle3 = document.getElementById('octave-toggle-3');
    const octaveToggle5 = document.getElementById('octave-toggle-5');
    function setOctaveCount(n) {
        octaveCount = n;
        [octaveToggle2, octaveToggle3, octaveToggle5].forEach(b => b.classList.remove('active'));
        ({ 2: octaveToggle2, 3: octaveToggle3, 5: octaveToggle5 })[n].classList.add('active');
        buildPiano();
        renderScale();
        renderChord();
    }
    octaveToggle2.addEventListener('click', () => setOctaveCount(2));
    octaveToggle3.addEventListener('click', () => setOctaveCount(3));
    octaveToggle5.addEventListener('click', () => setOctaveCount(5));
    octaveToggle5.classList.add('active');

    // ── Scale mode ──────────────────────────────────────────────────────
    // Root picker ported 100% from the Bass page's Scale Visualizer:
    // naturals + a ♮/♯/♭ toggle that reveals the accidental pills
    // (C#/D♭ etc.), independent of the Chord Finder's picker below.
    const scaleRootPills = document.getElementById('scale-root-pills');
    const scaleType = document.getElementById('scale-type');
    var scaleRootValue = '';

    Object.keys(MT.SCALES).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        scaleType.appendChild(opt);
    });

    const NATURALS = ['C','D','E','F','G','A','B'];
    const scaleRowState = { mode: 'natural', accidentalPills: [] };

    NATURALS.forEach(note => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'root-pill';
        btn.textContent = note;
        btn.dataset.sharp = note;
        btn.addEventListener('click', () => selectScaleRoot(note));
        scaleRootPills.appendChild(btn);
    });

    const scaleSfSep = document.createElement('span');
    scaleSfSep.className = 'sf-sep';
    scaleRootPills.appendChild(scaleSfSep);

    const scaleSfToggle = document.createElement('button');
    scaleSfToggle.type = 'button';
    scaleSfToggle.className = 'sf-toggle';
    scaleSfToggle.addEventListener('click', () => {
        scaleRowState.mode = scaleRowState.mode === 'natural' ? 'sharp' : scaleRowState.mode === 'sharp' ? 'flat' : 'natural';
        updateScaleToggleLabel();
        refreshScaleAccidentalPills();
    });
    scaleRootPills.appendChild(scaleSfToggle);

    MT.NOTES_SHARP.forEach((sharpVal, i) => {
        if (!sharpVal.includes('#')) return; // naturals already built above
        const flatVal = MT.NOTES_FLAT[i].replace('b', '♭');
        const sharpLabel = sharpVal.replace('#', '♯');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'root-pill sf-acc-pill';
        btn.dataset.sharp = sharpVal;
        btn.addEventListener('click', () => selectScaleRoot(sharpVal));
        scaleRowState.accidentalPills.push({ el: btn, sharp: sharpVal, sharpLabel: sharpLabel, flatLabel: flatVal });
        scaleRootPills.appendChild(btn);
    });

    function selectScaleRoot(sharpVal) {
        scaleRootValue = scaleRootValue === sharpVal ? '' : sharpVal;
        scaleRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === scaleRootValue));
        updateKeyLabels();
        renderScale();
    }

    function refreshScaleAccidentalPills() {
        scaleRowState.accidentalPills.forEach(p => {
            if (scaleRowState.mode === 'natural') {
                p.el.dataset.hidden = '1';
                p.el.dataset.mode = 'natural';
                p.el.textContent = p.sharpLabel;
            } else if (scaleRowState.mode === 'sharp') {
                p.el.dataset.hidden = '0';
                p.el.dataset.mode = 'sharp';
                p.el.textContent = p.sharpLabel;
            } else {
                p.el.dataset.hidden = '0';
                p.el.dataset.mode = 'flat';
                p.el.textContent = p.flatLabel;
            }
        });
        // Deselect a hidden accidental root so the keyboard doesn't keep
        // highlighting a note this picker no longer shows as active.
        if (scaleRowState.mode === 'natural' && scaleRootValue && !NATURALS.includes(scaleRootValue)) {
            scaleRootValue = '';
            scaleRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active'));
            updateKeyLabels();
            renderScale();
        }
    }

    function updateScaleToggleLabel() {
        let label, title;
        if (scaleRowState.mode === 'natural') { label = '♮'; title = 'Showing natural notes — click for Sharp (#)'; }
        else if (scaleRowState.mode === 'sharp') { label = '#'; title = 'Showing sharps — click for Flat (♭)'; }
        else { label = '♭'; title = 'Showing flats — click for Natural (♮)'; }
        scaleSfToggle.textContent = label;
        scaleSfToggle.title = title;
        scaleSfToggle.dataset.mode = scaleRowState.mode;
    }
    updateScaleToggleLabel();
    refreshScaleAccidentalPills();

    function renderScale() {
        const root = scaleRootValue;
        const type = scaleType.value;
        const preferFlats = root && MT.PREFERS_FLATS.has(root);
        if (!root) { applyHighlight(null, null, false); return; }
        const notes = MT.scaleNotes(root, type, preferFlats);
        applyHighlight(notes, root, false);
    }
    scaleType.addEventListener('change', renderScale);

    // ── Chord mode ──────────────────────────────────────────────────────
    // Root picker ported 100% from the Scale Explorer's picker above
    // (itself ported from the Bass page's Scale Visualizer): naturals +
    // a ♮/♯/♭ toggle that reveals the accidental pills, tracked
    // independently of the Scale Explorer's own root/mode state.
    const chordRootPills = document.getElementById('chord-root-pills');
    const chordTypeRow = document.getElementById('chord-type-row');
    const chordTypePills = document.getElementById('chord-type-pills');
    var chordRootValue = '';
    let chordTypeValue = 'Major';

    const CHORD_TYPE_GROUPS = [
        [['Major','Maj'], ['Minor','Min'], ['Sus2','Sus2'], ['Sus4','Sus4'], ['Diminished','Dim'], ['Augmented','Aug']],
        [['Dominant 7','Dom7'], ['Major 7','Maj7'], ['Minor 7','Min7']],
        [['5th','5th']],
    ];

    CHORD_TYPE_GROUPS.forEach((group, gi) => {
        if (gi > 0) {
            const sep = document.createElement('div');
            sep.className = 'pill-sep' + (gi === 1 ? ' pill-sep-break' : '');
            chordTypePills.appendChild(sep);
        }
        group.forEach(([name, label]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'type-pill-btn';
            btn.textContent = label;
            btn.dataset.type = name;
            btn.classList.toggle('active', name === chordTypeValue);
            btn.addEventListener('click', () => selectChordType(name));
            chordTypePills.appendChild(btn);
        });
    });

    function selectChordType(name) {
        chordTypeValue = name;
        chordTypePills.querySelectorAll('.type-pill-btn').forEach(p => p.classList.toggle('active', p.dataset.type === chordTypeValue));
        renderChord();
    }

    const sustainToggle = document.getElementById('sustain-toggle');
    sustainToggle.addEventListener('click', () => {
        sustainOn = !sustainOn;
        sustainToggle.classList.toggle('active', sustainOn);
    });

    const chordClearBtn = document.getElementById('chord-clear-btn');
    chordClearBtn.addEventListener('click', () => {
        chordRootValue = '';
        chordTypeValue = 'Major';
        chordRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active'));
        chordTypePills.querySelectorAll('.type-pill-btn').forEach(p => p.classList.toggle('active', p.dataset.type === 'Major'));
        chordTypeRow.classList.remove('ps-visible');
        updateKeyLabels();
        renderChord();
    });

    const chordRowState = { mode: 'natural', accidentalPills: [] };

    NATURALS.forEach(note => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'root-pill';
        btn.textContent = note;
        btn.dataset.sharp = note;
        btn.addEventListener('click', () => selectChordRoot(note));
        chordRootPills.appendChild(btn);
    });

    const chordSfSep = document.createElement('span');
    chordSfSep.className = 'sf-sep';
    chordRootPills.appendChild(chordSfSep);

    const chordSfToggle = document.createElement('button');
    chordSfToggle.type = 'button';
    chordSfToggle.className = 'sf-toggle';
    chordSfToggle.addEventListener('click', () => {
        chordRowState.mode = chordRowState.mode === 'natural' ? 'sharp' : chordRowState.mode === 'sharp' ? 'flat' : 'natural';
        updateChordToggleLabel();
        refreshChordAccidentalPills();
    });
    chordRootPills.appendChild(chordSfToggle);

    MT.NOTES_SHARP.forEach((sharpVal, i) => {
        if (!sharpVal.includes('#')) return; // naturals already built above
        const flatVal = MT.NOTES_FLAT[i].replace('b', '♭');
        const sharpLabel = sharpVal.replace('#', '♯');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'root-pill sf-acc-pill';
        btn.dataset.sharp = sharpVal;
        btn.addEventListener('click', () => selectChordRoot(sharpVal));
        chordRowState.accidentalPills.push({ el: btn, sharp: sharpVal, sharpLabel: sharpLabel, flatLabel: flatVal });
        chordRootPills.appendChild(btn);
    });

    function selectChordRoot(sharpVal) {
        chordRootValue = chordRootValue === sharpVal ? '' : sharpVal;
        chordRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === chordRootValue));
        chordTypeRow.classList.toggle('ps-visible', !!chordRootValue);
        updateKeyLabels();
        renderChord();
    }

    function refreshChordAccidentalPills() {
        chordRowState.accidentalPills.forEach(p => {
            if (chordRowState.mode === 'natural') {
                p.el.dataset.hidden = '1';
                p.el.dataset.mode = 'natural';
                p.el.textContent = p.sharpLabel;
            } else if (chordRowState.mode === 'sharp') {
                p.el.dataset.hidden = '0';
                p.el.dataset.mode = 'sharp';
                p.el.textContent = p.sharpLabel;
            } else {
                p.el.dataset.hidden = '0';
                p.el.dataset.mode = 'flat';
                p.el.textContent = p.flatLabel;
            }
        });
        // Deselect a hidden accidental root so the keyboard doesn't keep
        // highlighting a note this picker no longer shows as active.
        if (chordRowState.mode === 'natural' && chordRootValue && !NATURALS.includes(chordRootValue)) {
            chordRootValue = '';
            chordRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active'));
            updateKeyLabels();
            renderChord();
        }
    }

    function updateChordToggleLabel() {
        let label, title;
        if (chordRowState.mode === 'natural') { label = '♮'; title = 'Showing natural notes — click for Sharp (#)'; }
        else if (chordRowState.mode === 'sharp') { label = '#'; title = 'Showing sharps — click for Flat (♭)'; }
        else { label = '♭'; title = 'Showing flats — click for Natural (♮)'; }
        chordSfToggle.textContent = label;
        chordSfToggle.title = title;
        chordSfToggle.dataset.mode = chordRowState.mode;
    }
    updateChordToggleLabel();
    refreshChordAccidentalPills();

    function renderChord() {
        const root = chordRootValue;
        const type = chordTypeValue;
        const chordDisplayName = document.querySelector('#chord-display .chord-display-name');
        const chordDisplayNotes = document.querySelector('#chord-display .chord-display-notes');
        if (!root) {
            chordDisplayName.textContent = 'Select a chord';
            chordDisplayName.classList.remove('has-chord');
            chordDisplayNotes.textContent = '';
            applyHighlight(null, null, false);
            return;
        }
        const preferFlats = MT.PREFERS_FLATS.has(root);
        const notes = MT.chordNotes(root, type, preferFlats);
        const typeLabel = type === 'Major' ? 'Major' : type;
        chordDisplayName.textContent = `${root.replace('#', '♯')} ${typeLabel}`;
        chordDisplayName.classList.add('has-chord');
        chordDisplayNotes.textContent = notes.join(' · ');
        applyHighlight(notes, root, true);
    }

    renderScale();
    renderChord();
})();
