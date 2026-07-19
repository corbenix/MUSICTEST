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
            const leftPct = (whiteIndex + 1) * whiteWidthPct - (whiteWidthPct * 0.40);
            el.style.left = leftPct + '%';
            el.style.width = (whiteWidthPct * 0.80) + '%';
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

    // ── Auto chord detection from played notes ─────────────────────────
    // Tracks whichever notes are currently held via the computer-
    // keyboard input (held while the physical key is down), keyed by
    // "note-octave" so the same pitch class in different octaves is
    // tracked separately. Direct piano clicks stay momentary (just play
    // + flash) and aren't tracked here. Whenever this set changes, the
    // chord-display card is refreshed to show whatever chord (if any)
    // those notes form — unless the Chord Finder has an explicit
    // selection active, which takes priority.
    const playedNotesMap = new Map();

    function notePitchAbs(note, octave) {
        return octave * 12 + MT.noteIndex(note);
    }

    function updatePlayedChordDisplay() {
        if (chordRootValue) return; // Chord Finder selection takes priority
        const chordDisplayName = document.querySelector('#chord-display .chord-display-name');
        const chordDisplayNotes = document.querySelector('#chord-display .chord-display-notes');
        if (!chordDisplayName || !chordDisplayNotes) return;

        const sorted = Array.from(playedNotesMap.values()).sort((a, b) => a.abs - b.abs);
        const noteNames = sorted.map(v => v.note);
        const preferFlats = noteDisplayMode === 'flat';

        if (!noteNames.length) {
            chordDisplayName.textContent = 'Select a chord';
            chordDisplayName.classList.remove('has-chord');
            chordDisplayNotes.textContent = '';
            return;
        }

        const detected = MT.detectChord(noteNames, preferFlats);
        if (detected) {
            const typeLabel = detected.chordName === 'Major' ? 'Major' : detected.chordName;
            chordDisplayName.textContent = `${toDisplayNote(detected.root)} ${typeLabel}`;
            chordDisplayName.classList.add('has-chord');
        } else {
            chordDisplayName.textContent = noteNames.length === 1 ? toDisplayNote(noteNames[0]) : 'No chord match';
            chordDisplayName.classList.remove('has-chord');
        }
        chordDisplayNotes.textContent = noteNames.join(' · ');
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
                label.textContent = el.classList.contains('pk--white') ? el.dataset.note + el.dataset.octave : toDisplayNote(el.dataset.note);
            }
        });
    }

    labelModeToggle.addEventListener('click', () => {
        labelMode = LABEL_MODES[(LABEL_MODES.indexOf(labelMode) + 1) % LABEL_MODES.length];
        labelModeToggle.textContent = LABEL_MODE_TEXT[labelMode];
        labelModeToggle.classList.toggle('active', labelMode !== 'notes');
        updateKeyLabels();
    });

    // ── Global sharp/flat display mode ────────────────────────────────
    // One switch for the whole *site*: which spelling (♯ or ♭) accidental
    // notes use everywhere — the keyboard's black-key labels, the root
    // pills in the Scale Explorer / Chord Finder, and the chord name
    // display. Backed by window.NoteDisplay (see js/note-display.js), so
    // the choice persists across the Keyboard, Bass, Guitar, and Chord
    // Builder pages instead of resetting per page.
    let noteDisplayMode = window.NoteDisplay.getMode();
    const noteDisplayToggle = document.getElementById('note-display-toggle');

    function toDisplayNote(sharpVal) {
        return window.NoteDisplay.toDisplayNote(sharpVal, noteDisplayMode);
    }

    window.NoteDisplay.bindToggle(noteDisplayToggle, mode => {
        noteDisplayMode = mode;
        updateKeyLabels();
        refreshScaleAccidentalPills();
        refreshChordAccidentalPills();
        renderChord();
        renderInversionCards();
    });

    // Tracks whichever notes are currently highlighted (scale or chord,
    // whichever was rendered most recently) so the Play button below
    // always knows exactly what to play back, without recomputing it.
    let activeNotes = null;
    let activeIsChord = false;

    // Lays a sequence of note names out across ascending octaves,
    // always starting from octave 4 (C4 — the standard reference
    // octave), climbing one octave every time a note's chromatic
    // index wraps back around (e.g. B → C), regardless of which
    // keyboard range (2/3/5 oct) is currently displayed. Used to pick
    // a single, real-sounding voicing for a chord — one instance of
    // each note — instead of every occurrence of that note name
    // across the whole keyboard. Also used by playback so what's
    // highlighted is exactly what gets played.
    function layOutAscending(notes) {
        let octave = 4;
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
            el.classList.remove('pk--highlight', 'pk--highlight-scale', 'pk--root', 'pk--chord-root');
            if (!notes) return;
            const keyIdx = MT.noteIndex(el.dataset.note);
            const isMatch = voicing
                ? voicing.some(v => MT.noteIndex(v.note) === keyIdx && v.octave === Number(el.dataset.octave))
                : notes.some(n => MT.noteIndex(n) === keyIdx);
            if (isMatch) {
                el.classList.add(isChord ? 'pk--highlight' : 'pk--highlight-scale');
                if (root && MT.noteIndex(root) === MT.noteIndex(el.dataset.note)) {
                    el.classList.add(isChord ? 'pk--chord-root' : 'pk--root');
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

    // ── Playback speed — cycles .5x → .75x → 1x, shared by scale and
    // chord playback. Divides the per-note step delay, so a lower
    // multiplier plays back slower (more time between notes).
    const PLAY_SPEEDS = [0.5, 0.75, 1];
    let playSpeed = 1;
    const keyboardSpeedToggle = document.getElementById('keyboard-speed-toggle');
    if (keyboardSpeedToggle) {
        keyboardSpeedToggle.addEventListener('click', () => {
            const idx = (PLAY_SPEEDS.indexOf(playSpeed) + 1) % PLAY_SPEEDS.length;
            playSpeed = PLAY_SPEEDS[idx];
            keyboardSpeedToggle.textContent = playSpeed + 'x';
            keyboardSpeedToggle.classList.toggle('active', playSpeed !== 1);
        });
    }

    // Builds the note-by-note playback order for a scale: every key
    // currently highlighted as part of the scale (i.e. across the
    // whole visible keyboard range, however many octaves that is),
    // sorted low to high — so playback always matches exactly what's
    // lit up on the keys, not just a single octave.
    function buildScaleTimeline() {
        return Array.from(pianoEl.querySelectorAll('.pk--highlight-scale'))
            .map(el => ({ note: el.dataset.note, octave: Number(el.dataset.octave) }))
            .sort((a, b) => (a.octave * 12 + MT.noteIndex(a.note)) - (b.octave * 12 + MT.noteIndex(b.note)));
    }

    function playActiveNotes() {
        if (!activeNotes || !activeNotes.length) return;
        stopScheduledPlayback();
        const timeline = activeIsChord ? layOutAscending(activeNotes) : buildScaleTimeline();
        if (!timeline.length) return;
        const stepDelay = (activeIsChord ? 45 : 230) / playSpeed;
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
        // applyHighlight() unconditionally clears every key's highlight
        // before re-applying its own, so calling renderScale() then
        // renderChord() unconditionally would let an inactive chord
        // (no root selected) wipe out an active scale highlight, or
        // vice versa. Re-render whichever one was actually driving the
        // keyboard's highlight last so it "wins" and survives the
        // rebuild, instead of always letting the chord render clear it.
        const wasChordActive = activeIsChord && !!activeNotes;
        buildPiano();
        if (wasChordActive) {
            renderScale();
            renderChord();
        } else {
            renderChord();
            renderScale();
        }
        resetComputerKeyboardInput();
    }
    octaveToggle2.addEventListener('click', () => setOctaveCount(2));
    octaveToggle3.addEventListener('click', () => setOctaveCount(3));
    octaveToggle5.addEventListener('click', () => setOctaveCount(5));
    octaveToggle5.classList.add('active');

    // ── Scale mode ──────────────────────────────────────────────────────
    // Root picker: naturals + accidental pills (C#/D♭ etc.), always
    // visible. Their spelling (sharp vs flat) is driven entirely by the
    // global note-display toggle in the piano toolbar.
    const scaleRootPills = document.getElementById('scale-root-pills');
    const scaleType = document.getElementById('scale-type');
    var scaleRootValue = '';

    Object.keys(MT.SCALES).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        scaleType.appendChild(opt);
    });

    const NATURALS = ['C','D','E','F','G','A','B'];
    const scaleRowState = { accidentalPills: [] };

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
            p.el.dataset.mode = noteDisplayMode;
            p.el.textContent = noteDisplayMode === 'sharp' ? p.sharpLabel : p.flatLabel;
        });
    }
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
    let chordInversionValue = 0;

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
        chordInversionValue = 0;
        chordTypePills.querySelectorAll('.type-pill-btn').forEach(p => p.classList.toggle('active', p.dataset.type === chordTypeValue));
        buildInversionPills();
        renderChord();
    }

    // ── Inversion picker — rebuilt every time the chord type changes,
    // since the number of usable inversions equals the chord's note
    // count (a triad gets Root/1st/2nd, a 7th chord also gets 3rd, a
    // power chord only gets Root/1st). Reordering the notes array so
    // it starts from the inversion tone is enough: layOutAscending()
    // already bumps any note lower than the previous one up an octave,
    // which is exactly what an inversion is.
    const chordInversionRow = document.getElementById('chord-inversion-row');
    const chordInversionPills = document.getElementById('chord-inversion-pills');
    const INVERSION_LABELS = ['Root', '1st', '2nd', '3rd'];

    function buildInversionPills() {
        if (!chordInversionPills) return;
        const count = (MT.CHORD_FORMULAS[chordTypeValue] || []).length;
        chordInversionPills.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'type-pill-btn';
            btn.textContent = INVERSION_LABELS[i] || `${i}th`;
            btn.dataset.inversion = String(i);
            btn.classList.toggle('active', i === chordInversionValue);
            btn.addEventListener('click', () => selectChordInversion(i));
            chordInversionPills.appendChild(btn);
        }
    }

    function selectChordInversion(i) {
        chordInversionValue = i;
        if (chordInversionPills) {
            chordInversionPills.querySelectorAll('.type-pill-btn').forEach(p => p.classList.toggle('active', Number(p.dataset.inversion) === chordInversionValue));
        }
        renderChord();
        // Auto-play only on an explicit inversion pick (pill or card
        // click) — not on the initial chord selection, which defaults
        // to root position silently. Picking root position again this
        // way still counts as an explicit pick, so it plays too.
        playActiveNotes();
    }
    buildInversionPills();

    // ── Chord Inversions panel — one card per usable inversion, each with
    // its own mini keyboard diagram (bass note lit lighter, other tones
    // lit darker) and the note order printed below it. Clicking a card
    // jumps the inversion picker above to match. ──────────────────────
    const inversionsPanel = document.getElementById('inversions-panel');
    const inversionCardsEl = document.getElementById('inversion-cards');
    const MINI_WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const MINI_BLACK_AFTER = { C: 'C#', D: 'D#', F: 'F#', G: 'G#', A: 'A#' };

    function buildMiniPiano(container) {
        container.innerHTML = '';
        const whiteWidthPct = 100 / MINI_WHITE_NOTES.length;
        MINI_WHITE_NOTES.forEach(note => {
            const el = document.createElement('div');
            el.className = 'mini-pk mini-pk--white';
            el.dataset.note = note;
            container.appendChild(el);
        });
        MINI_WHITE_NOTES.forEach((note, i) => {
            const blackNote = MINI_BLACK_AFTER[note];
            if (!blackNote) return;
            const el = document.createElement('div');
            el.className = 'mini-pk mini-pk--black';
            el.dataset.note = blackNote;
            el.style.left = ((i + 1) * whiteWidthPct - (whiteWidthPct * 0.28)) + '%';
            container.appendChild(el);
        });
    }

    function highlightMiniPiano(container, voicingNotes) {
        const bassIdx = voicingNotes.length ? MT.noteIndex(voicingNotes[0]) : -1;
        const toneIdxs = voicingNotes.slice(1).map(n => MT.noteIndex(n));
        container.querySelectorAll('.mini-pk').forEach(el => {
            el.classList.remove('mini-pk--highlight-bass', 'mini-pk--highlight-tone');
            const idx = MT.noteIndex(el.dataset.note);
            if (idx === bassIdx) el.classList.add('mini-pk--highlight-bass');
            else if (toneIdxs.includes(idx)) el.classList.add('mini-pk--highlight-tone');
        });
    }

    function renderInversionCards() {
        const root = chordRootValue;
        if (!root) { inversionsPanel.classList.remove('is-visible'); return; }
        const type = chordTypeValue;
        const preferFlats = MT.PREFERS_FLATS.has(root);
        const notes = MT.chordNotes(root, type, preferFlats);
        if (!notes || notes.length < 2) { inversionsPanel.classList.remove('is-visible'); return; }

        inversionsPanel.classList.add('is-visible');
        inversionCardsEl.innerHTML = '';
        const typeLabel = type === 'Major' ? 'Major' : type;
        const rootLabel = toDisplayNote(root);

        notes.forEach((_, i) => {
            const voicing = notes.slice(i).concat(notes.slice(0, i));
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'inversion-card';
            card.classList.toggle('active', i === chordInversionValue);

            const label = document.createElement('div');
            label.className = 'inversion-card-label';
            label.textContent = i === 0 ? 'Root Position' : `${INVERSION_LABELS[i] || i + 'th'} Inversion`;
            card.appendChild(label);

            const name = document.createElement('div');
            name.className = 'inversion-card-name';
            name.textContent = i === 0
                ? `${rootLabel} ${typeLabel}`
                : `${rootLabel} ${typeLabel} / ${toDisplayNote(voicing[0])} bass`;
            card.appendChild(name);

            const mini = document.createElement('div');
            mini.className = 'mini-piano';
            card.appendChild(mini);
            buildMiniPiano(mini);
            highlightMiniPiano(mini, voicing);

            const notesLine = document.createElement('div');
            notesLine.className = 'inversion-card-notes';
            notesLine.textContent = voicing.join(' · ');
            card.appendChild(notesLine);

            card.addEventListener('click', () => selectChordInversion(i));
            inversionCardsEl.appendChild(card);
        });
    }

    const sustainToggle = document.getElementById('sustain-toggle');
    function setSustain(on) {
        sustainOn = on;
        sustainToggle.classList.toggle('active', sustainOn);
    }
    sustainToggle.addEventListener('click', () => setSustain(!sustainOn));

    // Shift acts as a sustain-pedal shortcut: held down, it sustains
    // notes just like clicking the Sustain button, and lets go the
    // moment Shift is released. Doesn't require the computer-keyboard
    // note input to be enabled, since it also applies to mouse clicks.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Shift' || e.repeat || isTypingTarget(e)) return;
        setSustain(true);
    });
    document.addEventListener('keyup', (e) => {
        if (e.key !== 'Shift') return;
        setSustain(false);
    });
    window.addEventListener('blur', () => setSustain(false));

    const chordClearBtn = document.getElementById('chord-clear-btn');
    chordClearBtn.addEventListener('click', () => {
        scaleRootValue = '';
        scaleRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active'));
        chordRootValue = '';
        chordTypeValue = 'Major';
        chordInversionValue = 0;
        chordRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.remove('active'));
        chordTypePills.querySelectorAll('.type-pill-btn').forEach(p => p.classList.toggle('active', p.dataset.type === 'Major'));
        chordTypeRow.classList.remove('ps-visible');
        if (chordInversionRow) chordInversionRow.classList.remove('ps-visible');
        buildInversionPills();
        updateKeyLabels();
        renderScale();
        renderChord();
    });

    const chordRowState = { accidentalPills: [] };

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
        chordInversionValue = 0;
        chordRootPills.querySelectorAll('.root-pill').forEach(p => p.classList.toggle('active', p.dataset.sharp === chordRootValue));
        chordTypeRow.classList.toggle('ps-visible', !!chordRootValue);
        if (chordInversionRow) chordInversionRow.classList.toggle('ps-visible', !!chordRootValue);
        buildInversionPills();
        updateKeyLabels();
        renderChord();
    }

    function refreshChordAccidentalPills() {
        chordRowState.accidentalPills.forEach(p => {
            p.el.dataset.mode = noteDisplayMode;
            p.el.textContent = noteDisplayMode === 'sharp' ? p.sharpLabel : p.flatLabel;
        });
    }
    refreshChordAccidentalPills();

    function renderChord() {
        const root = chordRootValue;
        const type = chordTypeValue;
        if (!root) {
            applyHighlight(null, null, false);
            renderInversionCards();
            updatePlayedChordDisplay();
            return;
        }
        const chordDisplayName = document.querySelector('#chord-display .chord-display-name');
        const chordDisplayNotes = document.querySelector('#chord-display .chord-display-notes');
        const preferFlats = MT.PREFERS_FLATS.has(root);
        const notes = MT.chordNotes(root, type, preferFlats);
        // Apply the selected inversion by rotating the note order so it
        // starts from the inversion tone — layOutAscending() then bumps
        // any note lower than the previous one up an octave, which is
        // exactly what an inversion voicing is.
        const inv = ((chordInversionValue % notes.length) + notes.length) % notes.length;
        const voicingNotes = notes.slice(inv).concat(notes.slice(0, inv));
        const typeLabel = type === 'Major' ? 'Major' : type;
        const invLabel = inv === 0 ? '' : ` (${INVERSION_LABELS[inv] || inv + 'th'} inversion)`;
        chordDisplayName.textContent = `${toDisplayNote(root)} ${typeLabel}${invLabel}`;
        chordDisplayName.classList.add('has-chord');
        chordDisplayNotes.textContent = notes.join(' · ');
        applyHighlight(voicingNotes, root, true);
        renderInversionCards();
    }

    // ── Computer-keyboard input — ASDF... plays white keys, QWERTY...
    // plays the black keys above them, Z/X shifts the whole layout down
    // or up an octave. The layout always anchors on C4 (the 'A' key)
    // regardless of which visible range (2/3/5 oct) is selected, since
    // C4 is the piano-standard middle-C reference point; Z/X then shift
    // from there and get clamped to whatever range is actually
    // rendered. Semitone offsets from C4 for each physical key, laid
    // out one row lower than QWERTY, on the home row:
    //   row:  W  E     T  Y  U     O  P
    //   row: A  S  D  F  G  H  J  K  L  ;
    //   (A=white C, W=black C#, S=white D, E=black D#, D=white E, ...)
    const KEY_OFFSETS = {
        // white keys
        'a': 0, 's': 2, 'd': 4, 'f': 5, 'g': 7, 'h': 9, 'j': 11,
        'k': 12, 'l': 14, ';': 16,
        // black keys
        'w': 1, 'e': 3, 't': 6, 'y': 8, 'u': 10, 'o': 13, 'p': 15,
    };
    // Shift changes what some symbol keys report as e.key (';' becomes
    // ':', for example) — a different character, not just a different
    // case, so plain toLowerCase() doesn't undo it. Map the shifted
    // variant back to its base key so lookups stay consistent whether
    // or not Shift happens to be held (e.g. for the sustain shortcut).
    const SHIFTED_KEY_ALIASES = { ':': ';' };
    let computerOctaveShift = 0; // in octaves, adjusted by Z / X
    const heldComputerKeys = {}; // physical key -> the .pk element it's sounding
    let computerKeyboardEnabled = true; // toggled via the Keyboard: On/Off button, default on

    // Converts a semitone offset from C4 into an actual { note, octave }
    // pair using the same note-naming table every other instrument page
    // uses, so it lines up exactly with the .pk elements' data-note /
    // data-octave attributes.
    function noteFromC4Offset(offset) {
        const absolute = 4 * 12 + offset;
        const octave = Math.floor(absolute / 12);
        const semitone = ((absolute % 12) + 12) % 12;
        return { note: MT.noteName(semitone), octave };
    }

    function findPianoKeyEl(note, octave) {
        return pianoEl.querySelector(`.pk[data-note="${note}"][data-octave="${octave}"]`);
    }

    function normalizeComputerKey(e) {
        const key = e.key.toLowerCase();
        return SHIFTED_KEY_ALIASES[key] || key;
    }

    function isTypingTarget(e) {
        const el = e.target;
        if (!el) return false;
        const tag = (el.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || el.isContentEditable;
    }

    // Shifts the anchor octave with clamping to whatever range is
    // actually visible (2 / 3 / 5 oct), so Z / X never silently plays
    // nothing because the shifted keys landed off the rendered keybed.
    function shiftComputerOctave(dir) {
        const startOctave = START_OCTAVE[octaveCount];
        const minShift = startOctave - 4;
        const maxShift = (startOctave + octaveCount) - 4;
        computerOctaveShift = Math.min(maxShift, Math.max(minShift, computerOctaveShift + dir));
    }

    function pressComputerKey(key) {
        const totalOffset = computerOctaveShift * 12 + KEY_OFFSETS[key];
        const { note, octave } = noteFromC4Offset(totalOffset);
        const el = findPianoKeyEl(note, octave);
        if (!el) return null; // shifted/mapped note falls outside the visible range
        playTone(note, octave);
        el.classList.add('pk--pressed');
        playedNotesMap.set(note + octave, { note, octave, abs: notePitchAbs(note, octave) });
        updatePlayedChordDisplay();
        return el;
    }

    function releaseComputerKey(el) {
        el.classList.remove('pk--pressed');
        playedNotesMap.delete(el.dataset.note + el.dataset.octave);
        updatePlayedChordDisplay();
    }

    // On-key labels showing which computer key plays each visible piano
    // key, so the current Z/X octave position is visible right on the
    // keybed instead of only in the static hint line below it.
    function clearComputerKeyLabels() {
        pianoEl.querySelectorAll('[data-kbkey]').forEach(el => el.removeAttribute('data-kbkey'));
    }

    function applyComputerKeyLabels() {
        clearComputerKeyLabels();
        if (!computerKeyboardEnabled) return;
        Object.keys(KEY_OFFSETS).forEach(key => {
            const totalOffset = computerOctaveShift * 12 + KEY_OFFSETS[key];
            const { note, octave } = noteFromC4Offset(totalOffset);
            const el = findPianoKeyEl(note, octave);
            if (!el) return; // shifted/mapped note falls outside the visible range
            el.setAttribute('data-kbkey', key === ';' ? ';' : key.toUpperCase());
            el.title = 'Computer key: ' + (key === ';' ? ';' : key.toUpperCase());
        });
    }

    // Releases every currently-held computer-keyboard note without
    // touching anything else — used when the visible range changes
    // (2/3/5 oct toggle) so a note held through a range switch doesn't
    // get stuck lit with no way to release it.
    function resetComputerKeyboardInput() {
        Object.keys(heldComputerKeys).forEach(key => {
            releaseComputerKey(heldComputerKeys[key]);
            delete heldComputerKeys[key];
        });
        computerOctaveShift = 0;
        applyComputerKeyLabels();
    }

    document.addEventListener('keydown', (e) => {
        if (!computerKeyboardEnabled) return;
        if (e.repeat) return; // ignore OS auto-repeat
        if (e.metaKey || e.ctrlKey || e.altKey) return; // don't hijack browser shortcuts
        if (isTypingTarget(e)) return;

        const key = normalizeComputerKey(e);

        if (key === 'z' || key === 'x') {
            shiftComputerOctave(key === 'z' ? -1 : 1);
            applyComputerKeyLabels();
            e.preventDefault();
            return;
        }

        if (!(key in KEY_OFFSETS)) return;
        if (heldComputerKeys[key]) return; // already sounding

        const el = pressComputerKey(key);
        if (!el) return;
        e.preventDefault();
        heldComputerKeys[key] = el;
    });

    document.addEventListener('keyup', (e) => {
        const key = normalizeComputerKey(e);
        const el = heldComputerKeys[key];
        if (!el) return;
        delete heldComputerKeys[key];
        releaseComputerKey(el);
    });

    // If focus leaves the window mid-press (alt-tab, dev tools, etc.),
    // release everything so no key gets stuck lit with no keyup to
    // ever clear it.
    window.addEventListener('blur', resetComputerKeyboardInput);

    // On/off toggle for the whole computer-keyboard-piano feature.
    // Default on. Turning it off releases any held notes, clears the
    // on-key badges, and mutes the keydown/keyup listeners above without
    // removing them.
    const kbMidiToggle = document.getElementById('kb-midi-toggle');
    kbMidiToggle.addEventListener('click', () => {
        computerKeyboardEnabled = !computerKeyboardEnabled;
        kbMidiToggle.classList.toggle('active', computerKeyboardEnabled);
        kbMidiToggle.setAttribute('aria-pressed', String(computerKeyboardEnabled));
        kbMidiToggle.textContent = computerKeyboardEnabled ? '⌨ Keyboard: On' : '⌨ Keyboard: Off';
        if (!computerKeyboardEnabled) {
            resetComputerKeyboardInput(); // releases held notes; also reapplies (empty) labels
        } else {
            applyComputerKeyLabels();
        }
    });

    applyComputerKeyLabels();
    renderScale();
    renderChord();
})();
