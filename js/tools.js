(function () {
    const MT = window.MusicTheory;

    document.documentElement.style.setProperty('--fret-accent-rgb', getComputedStyle(document.documentElement).getPropertyValue('--tools-rgb'));

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

    // ── Tuner ───────────────────────────────────────────────────────────
    const tunerStartBtn = document.getElementById('tuner-start');
    const tunerNote = document.getElementById('tuner-note');
    const tunerCents = document.getElementById('tuner-cents');
    const tunerNeedle = document.getElementById('tuner-needle');
    const tunerStatus = document.getElementById('tuner-status');
    let tunerActive = false;
    let audioCtx, analyser, mediaStream, rafId;

    function freqToNote(freq) {
        const A4 = 440;
        const semitonesFromA4 = 12 * Math.log2(freq / A4);
        const rounded = Math.round(semitonesFromA4);
        const cents = Math.round((semitonesFromA4 - rounded) * 100);
        const noteIdx = ((9 + rounded) % 12 + 12) % 12; // A is index 9
        const octave = 4 + Math.floor((9 + rounded) / 12);
        return { note: MT.NOTES_SHARP[noteIdx], octave, cents };
    }

    function autoCorrelate(buf, sampleRate) {
        const SIZE = buf.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1;

        let r1 = 0, r2 = SIZE - 1;
        const thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) > thres) { r1 = i; break; }
        for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) > thres) { r2 = SIZE - i; break; }
        const trimmed = buf.slice(r1, r2);
        const n = trimmed.length;

        const c = new Array(n).fill(0);
        for (let lag = 0; lag < n; lag++) {
            for (let i = 0; i < n - lag; i++) c[lag] += trimmed[i] * trimmed[i + lag];
        }
        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxVal = -1, maxPos = -1;
        for (let i = d; i < n; i++) { if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; } }
        if (maxPos <= 0) return -1;
        return sampleRate / maxPos;
    }

    function tunerLoop() {
        if (!tunerActive) return;
        const buf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buf);
        const freq = autoCorrelate(buf, audioCtx.sampleRate);
        if (freq !== -1 && freq > 40 && freq < 2000) {
            const { note, octave, cents } = freqToNote(freq);
            tunerNote.textContent = note + octave;
            tunerCents.textContent = (cents > 0 ? '+' : '') + cents + ' cents';
            tunerNeedle.style.transform = `rotate(${Math.max(-45, Math.min(45, cents * 0.9))}deg)`;
            tunerStatus.textContent = Math.abs(cents) < 6 ? 'In tune' : (cents > 0 ? 'Sharp — tune down' : 'Flat — tune up');
        }
        rafId = requestAnimationFrame(tunerLoop);
    }

    tunerStartBtn.addEventListener('click', async () => {
        if (tunerActive) {
            tunerActive = false;
            cancelAnimationFrame(rafId);
            if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
            tunerStartBtn.textContent = 'Start Tuner';
            tunerStatus.textContent = 'Microphone stopped';
            return;
        }
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            const source = audioCtx.createMediaStreamSource(mediaStream);
            source.connect(analyser);
            tunerActive = true;
            tunerStartBtn.textContent = 'Stop Tuner';
            tunerStatus.textContent = 'Listening…';
            tunerLoop();
        } catch (e) {
            tunerStatus.textContent = 'Microphone access denied or unavailable.';
        }
    });

    // ── Metronome ───────────────────────────────────────────────────────
    const bpmDisplay = document.getElementById('metro-bpm');
    const bpmMinus = document.getElementById('metro-minus');
    const bpmPlus = document.getElementById('metro-plus');
    const metroToggle = document.getElementById('metro-toggle');
    const metroDot = document.getElementById('metro-dot');
    let bpm = 100;
    let metroActive = false;
    let metroTimer = null;
    let metroAudioCtx = null;

    function clickSound() {
        metroAudioCtx = metroAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const osc = metroAudioCtx.createOscillator();
        const gain = metroAudioCtx.createGain();
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.2, metroAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, metroAudioCtx.currentTime + 0.06);
        osc.connect(gain).connect(metroAudioCtx.destination);
        osc.start();
        osc.stop(metroAudioCtx.currentTime + 0.06);
    }

    function tick() {
        clickSound();
        metroDot.classList.add('metro-dot--flash');
        setTimeout(() => metroDot.classList.remove('metro-dot--flash'), 100);
    }

    function updateBpmDisplay() { bpmDisplay.textContent = bpm; }

    bpmMinus.addEventListener('click', () => { bpm = Math.max(30, bpm - 5); updateBpmDisplay(); if (metroActive) restartMetro(); });
    bpmPlus.addEventListener('click', () => { bpm = Math.min(300, bpm + 5); updateBpmDisplay(); if (metroActive) restartMetro(); });

    function restartMetro() {
        clearInterval(metroTimer);
        metroTimer = setInterval(tick, 60000 / bpm);
    }

    metroToggle.addEventListener('click', () => {
        metroActive = !metroActive;
        metroToggle.textContent = metroActive ? 'Stop' : 'Start';
        if (metroActive) { tick(); restartMetro(); }
        else clearInterval(metroTimer);
    });

    updateBpmDisplay();
})();
