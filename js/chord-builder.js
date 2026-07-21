(function () {
    const MT = window.MusicTheory;
    const CBD = window.ChordBuilderData;

    document.documentElement.style.setProperty('--fret-accent-rgb', getComputedStyle(document.documentElement).getPropertyValue('--chordbuilder-rgb'));

    let audioCtx = null;
    function playChord(notes) {
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            notes.forEach((n, i) => {
                const semitone = MT.noteIndex(n);
                const freq = 261.63 * Math.pow(2, semitone / 12);
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.9);
                osc.connect(gain).connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.9);
            });
        } catch (e) { /* audio unavailable */ }
    }

    const keyRoot = document.getElementById('key-root');
    const keyMode = document.getElementById('key-mode');
    const diatonicGrid = document.getElementById('diatonic-grid');
    const progressionList = document.getElementById('progression-list');
    const progressionPlayback = document.getElementById('progression-playback');

    MT.NOTES_SHARP.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        keyRoot.appendChild(opt);
    });
    keyRoot.value = 'C';

    function diatonicChords() {
        const root = keyRoot.value;
        const mode = keyMode.value; // 'major' | 'minor'
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
        diatonicGrid.innerHTML = '';
        chords.forEach(c => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'diatonic-card';
            card.innerHTML = `
                <div class="diatonic-numeral">${c.numeral}</div>
                <div class="diatonic-name">${c.root} ${c.quality === 'Major' ? '' : c.quality}</div>
                <div class="diatonic-notes">${c.notes.join(' · ')}</div>
            `;
            card.addEventListener('click', () => playChord(c.notes));
            diatonicGrid.appendChild(card);
        });
        renderProgressions(chords);
    }

    function renderProgressions(chords) {
        const mode = keyMode.value;
        progressionList.innerHTML = '';
        CBD.PROGRESSIONS[mode].forEach(prog => {
            const row = document.createElement('div');
            row.className = 'progression-row';

            const label = document.createElement('div');
            label.className = 'progression-label';
            label.textContent = prog.name;
            row.appendChild(label);

            const chordsWrap = document.createElement('div');
            chordsWrap.className = 'progression-chords';
            prog.degrees.forEach(d => {
                const c = chords[d];
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'progression-chip';
                btn.textContent = `${c.root}${c.quality === 'Major' ? '' : (c.quality === 'Minor' ? 'm' : ' ' + c.quality)}`;
                btn.addEventListener('click', () => playChord(c.notes));
                chordsWrap.appendChild(btn);
            });
            row.appendChild(chordsWrap);

            const playBtn = document.createElement('button');
            playBtn.type = 'button';
            playBtn.className = 'progression-play-btn';
            playBtn.textContent = '▶ Play';
            playBtn.addEventListener('click', () => {
                prog.degrees.forEach((d, i) => {
                    setTimeout(() => playChord(chords[d].notes), i * 950);
                });
            });
            row.appendChild(playBtn);

            progressionList.appendChild(row);
        });
    }

    keyRoot.addEventListener('change', renderDiatonic);
    keyMode.addEventListener('change', renderDiatonic);
    renderDiatonic();
})();
