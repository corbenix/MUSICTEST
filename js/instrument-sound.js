// Shared instrument sound engine for chord-builder.html — one guitar/keyboard
// toggle drives playback for BOTH the Chord Progression Builder and the
// Chords by Key sections, instead of each widget having its own state.
window.InstrumentSound = (function () {
    try {
        return buildInstrumentSound();
    } catch (e) {
        // Something unexpected failed during setup (missing dependency,
        // restricted environment, etc). Fall back to a safe no-op API so
        // every page that depends on window.InstrumentSound.playChord
        // keeps working — just silently, without sound.
        console.error('InstrumentSound failed to initialize, falling back to silent mode:', e);
        let soundValue = 'keyboard';
        const listeners = [];
        return {
            playTone() {},
            playChord() {},
            getValue: () => soundValue,
            setValue(v) {
                if (v !== 'guitar' && v !== 'keyboard') return;
                soundValue = v;
                listeners.forEach(fn => fn(soundValue));
            },
            onChange: fn => listeners.push(fn),
            renderPills(container) {
                [['guitar', '🎸 Guitar'], ['keyboard', '🎹 Keyboard']].forEach(([value, label]) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'type-pill-btn';
                    btn.textContent = label;
                    btn.dataset.sound = value;
                    btn.classList.toggle('active', value === soundValue);
                    btn.addEventListener('click', () => this.setValue(value));
                    this.onChange(v => btn.classList.toggle('active', v === value));
                    container.appendChild(btn);
                });
            },
        };
    }

    function buildInstrumentSound() {
    const MT = window.MusicTheory;

    const INSTRUMENT_SAMPLES = {
        guitar: [
            ['B', 2], ['B', 3], ['B', 4],
            ['D', 2], ['D', 3], ['D', 4],
            ['F', 2], ['F', 3], ['F', 4],
            ['Gs', 2], ['Gs', 3], ['Gs', 4],
        ].map(([file, oct]) => {
            const sharpNote = { B: 'B', D: 'D', F: 'F', Gs: 'G#' }[file];
            return { url: `audio/guitar/${file}${oct}.mp3`, abs: oct * 12 + MT.noteIndex(sharpNote) };
        }),
        keyboard: [
            ['A', 2], ['A', 3], ['A', 4], ['A', 5], ['A', 6],
            ['C', 2], ['C', 3], ['C', 4], ['C', 5], ['C', 6], ['C', 7],
            ['Ds', 2], ['Ds', 3], ['Ds', 4], ['Ds', 5], ['Ds', 6],
            ['Fs', 2], ['Fs', 3], ['Fs', 4], ['Fs', 5], ['Fs', 6],
        ].map(([file, oct]) => {
            const sharpNote = { A: 'A', C: 'C', Ds: 'D#', Fs: 'F#' }[file];
            return { url: `audio/piano/${file}${oct}.mp3`, abs: oct * 12 + MT.noteIndex(sharpNote) };
        }),
    };

    let soundValue = 'keyboard';
    const listeners = [];

    function nearestSample(instrument, targetAbs) {
        const samples = INSTRUMENT_SAMPLES[instrument];
        let best = samples[0];
        let bestDiff = Infinity;
        samples.forEach(s => {
            const diff = Math.abs(targetAbs - s.abs);
            if (diff < bestDiff) { bestDiff = diff; best = s; }
        });
        return { url: best.url, semitoneDiff: targetAbs - best.abs };
    }

    let audioCtx = null;
    let audioUnavailable = false;
    function getAudioContext() {
        if (audioUnavailable) return null;
        if (!audioCtx) {
            try {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) { audioUnavailable = true; return null; }
                audioCtx = new Ctx();
            } catch (e) {
                audioUnavailable = true;
                return null;
            }
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
        try {
            const ctx = getAudioContext();
            if (!ctx) return Promise.resolve(null);
            bufferPromises[url] = fetch(url)
                .then(res => res.arrayBuffer())
                .then(data => ctx.decodeAudioData(data))
                .then(buf => { bufferCache[url] = buf; return buf; })
                .catch(() => null);
            return bufferPromises[url];
        } catch (e) {
            return Promise.resolve(null);
        }
    }
    // Eager preload — best effort only. Wrapped so that any failure here
    // (unavailable Web Audio API, blocked fetch, restricted iframe, etc.)
    // can never prevent this module from initializing; playback will just
    // stay silent instead, and the guitar/keyboard toggle keeps working.
    try {
        Object.values(INSTRUMENT_SAMPLES).forEach(list => list.forEach(s => loadBuffer(s.url)));
    } catch (e) { /* audio preload unavailable, continue without it */ }

    function playTone(noteName, octave) {
        try {
            const targetAbs = octave * 12 + MT.noteIndex(noteName);
            const { url, semitoneDiff } = nearestSample(soundValue, targetAbs);
            loadBuffer(url).then(buffer => {
                if (!buffer) return;
                const ctx = getAudioContext();
                if (!ctx) return;
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

    function playChord(notes, octave) {
        notes.forEach(n => playTone(n, octave || 4));
    }

    function getValue() { return soundValue; }
    function setValue(v) {
        if (v !== 'guitar' && v !== 'keyboard') return;
        soundValue = v;
        listeners.forEach(fn => fn(soundValue));
    }
    function onChange(fn) { listeners.push(fn); }

    // Renders the guitar/keyboard pill toggle into `container`, wired to the
    // shared state. Call this once per container; all instances stay in sync.
    function renderPills(container) {
        [['guitar', '🎸 Guitar'], ['keyboard', '🎹 Keyboard']].forEach(([value, label]) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'type-pill-btn';
            btn.textContent = label;
            btn.dataset.sound = value;
            btn.classList.toggle('active', value === soundValue);
            btn.addEventListener('click', () => setValue(value));
            onChange(v => btn.classList.toggle('active', v === value));
            container.appendChild(btn);
        });
    }

    // Auto-mount into #global-sound-pills if present on the page, so pages
    // using this module don't need a separate inline <script> call (which
    // can be blocked by a strict Content-Security-Policy).
    function mount() {
        const container = document.getElementById('global-sound-pills');
        if (container && !container.dataset.mounted) {
            container.dataset.mounted = 'true';
            renderPills(container);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }

    return { playTone, playChord, getValue, setValue, onChange, renderPills };
    }
})();
