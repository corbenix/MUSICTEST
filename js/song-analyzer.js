(function () {
    const fileInput = document.getElementById('analyzer-file');
    const dropzone = document.getElementById('analyzer-dropzone');
    const dropzoneText = document.getElementById('analyzer-dropzone-text');
    const startBtn = document.getElementById('analyzer-start');
    const progressWrap = document.getElementById('analyzer-progress');
    const statusEl = document.getElementById('analyzer-status');
    const resultsWrap = document.getElementById('analyzer-results');
    const bpmEl = document.getElementById('analyzer-bpm');
    const keyEl = document.getElementById('analyzer-key');
    const errorEl = document.getElementById('analyzer-error');
    const chordsWrap = document.getElementById('analyzer-chords');
    const chordsList = document.getElementById('analyzer-chords-list');
    const stemsBtn = document.getElementById('analyzer-stems-btn');
    const stemsProgress = document.getElementById('analyzer-stems-progress');
    const stemsResults = document.getElementById('analyzer-stems-results');
    const stemsError = document.getElementById('analyzer-stems-error');
    const stemInstrumentalAudio = document.getElementById('analyzer-stem-instrumental');
    const stemCenterAudio = document.getElementById('analyzer-stem-center');
    const stemInstrumentalDl = document.getElementById('analyzer-stem-instrumental-dl');
    const stemCenterDl = document.getElementById('analyzer-stem-center-dl');

    if (!fileInput || !startBtn) return; // panel not present on this page

    let selectedFile = null;

    function resetOutputs() {
        resultsWrap.hidden = true;
        errorEl.hidden = true;
        errorEl.textContent = '';
        chordsWrap.hidden = true;
        chordsList.innerHTML = '';
        stemsBtn.hidden = true;
        stemsResults.hidden = true;
        stemsProgress.hidden = true;
        stemsError.hidden = true;
        stemsError.textContent = '';
    }

    fileInput.addEventListener('change', () => {
        selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        dropzoneText.textContent = selectedFile ? selectedFile.name : 'Click or drop an audio file';
        startBtn.disabled = !selectedFile;
        resetOutputs();
    });

    ['dragover', 'dragenter'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.add('analyzer-dropzone--drag');
        });
    });
    ['dragleave', 'dragend'].forEach(evt => {
        dropzone.addEventListener(evt, () => dropzone.classList.remove('analyzer-dropzone--drag'));
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('analyzer-dropzone--drag');
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files;
            selectedFile = file;
            dropzoneText.textContent = file.name;
            startBtn.disabled = false;
            resetOutputs();
        }
    });

    startBtn.addEventListener('click', () => {
        if (!selectedFile) return;
        analyze(selectedFile);
    });

    // ── Analysis pipeline ───────────────────────────────────────────────
    async function analyze(file) {
        resetOutputs();
        startBtn.disabled = true;
        progressWrap.hidden = false;
        statusEl.textContent = 'Decoding audio…';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const DecodeCtx = window.AudioContext || window.webkitAudioContext;
            const decodeCtx = new DecodeCtx();
            const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
            decodeCtx.close && decodeCtx.close();

            statusEl.textContent = 'Preparing signal…';
            const targetRate = 11025;
            const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            const offlineCtx = new OfflineCtx(1, Math.ceil(audioBuffer.duration * targetRate), targetRate);
            const src = offlineCtx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(offlineCtx.destination);
            src.start(0);
            const rendered = await offlineCtx.startRendering();
            const mono = rendered.getChannelData(0);
            const sampleRate = rendered.sampleRate;

            statusEl.textContent = 'Detecting tempo…';
            await nextFrame();
            const bpm = detectBpm(mono, sampleRate);

            statusEl.textContent = 'Detecting key…';
            await nextFrame();
            const key = detectKey(mono, sampleRate);

            statusEl.textContent = 'Building chord chart…';
            await nextFrame();
            const chordChart = computeChordChart(mono, sampleRate);

            statusEl.textContent = 'Done';
            progressWrap.hidden = true;
            bpmEl.textContent = bpm ? Math.round(bpm) : '—';
            keyEl.textContent = key || '—';
            resultsWrap.hidden = false;
            renderChordChart(chordChart);
            stemsBtn.hidden = false;
        } catch (err) {
            progressWrap.hidden = true;
            errorEl.hidden = false;
            errorEl.textContent = 'Could not analyze this file. Try a different audio file (MP3, WAV, or M4A).';
            console.error('Song analyzer error:', err);
        } finally {
            startBtn.disabled = !selectedFile;
        }
    }

    function nextFrame() {
        return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    }

    // ── BPM detection (onset envelope autocorrelation / tempogram) ─────
    function detectBpm(data, sampleRate) {
        const windowSize = Math.max(1, Math.round(sampleRate * 0.01)); // ~10ms frames
        const numWindows = Math.floor(data.length / windowSize);
        if (numWindows < 32) return null;

        // 1. Short-time energy envelope
        const envelope = new Float32Array(numWindows);
        for (let i = 0; i < numWindows; i++) {
            let sum = 0;
            const start = i * windowSize;
            for (let j = 0; j < windowSize; j++) {
                const s = data[start + j];
                sum += s * s;
            }
            envelope[i] = Math.sqrt(sum / windowSize);
        }

        // 2. Onset strength = half-wave rectified derivative of energy
        const flux = new Float32Array(numWindows);
        for (let i = 1; i < numWindows; i++) {
            const d = envelope[i] - envelope[i - 1];
            flux[i] = d > 0 ? d : 0;
        }

        // 3. Light smoothing to reduce jitter
        const smooth = new Float32Array(numWindows);
        for (let i = 0; i < numWindows; i++) {
            let sum = 0, count = 0;
            for (let k = -1; k <= 1; k++) {
                const idx = i + k;
                if (idx >= 0 && idx < numWindows) { sum += flux[idx]; count++; }
            }
            smooth[i] = sum / count;
        }

        // 4. Detrend (zero-mean) so autocorrelation isn't dominated by DC offset
        let mean = 0;
        for (let i = 0; i < numWindows; i++) mean += smooth[i];
        mean /= numWindows;
        const oe = new Float64Array(numWindows);
        for (let i = 0; i < numWindows; i++) oe[i] = smooth[i] - mean;

        const secPerFrame = windowSize / sampleRate;
        const minBpm = 50, maxBpm = 220;
        const minLag = Math.max(1, Math.floor((60 / maxBpm) / secPerFrame));
        const maxLag = Math.min(numWindows - 1, Math.ceil((60 / minBpm) / secPerFrame));
        if (maxLag <= minLag) return null;

        // 5. Autocorrelation of the onset envelope across plausible beat lags,
        //    normalized per-lag so shorter lags (more overlapping terms) aren't favored.
        //    A mild log-normal prior around common song tempos helps break
        //    octave ties (i.e. mistaking BPM for its double or half).
        const ac = new Float64Array(maxLag + 1);
        for (let lag = minLag; lag <= maxLag; lag++) {
            let sum = 0;
            const n = numWindows - lag;
            for (let i = 0; i < n; i++) sum += oe[i] * oe[i + lag];
            ac[lag] = sum / n; // normalize so shorter lags (more overlap terms) aren't favored
        }

        let globalMax = -Infinity;
        for (let lag = minLag; lag <= maxLag; lag++) {
            if (ac[lag] > globalMax) globalMax = ac[lag];
        }
        if (globalMax <= 0) return null;

        // 6. Octave-ambiguity resolution: a perfectly periodic beat produces
        //    near-equal autocorrelation peaks at the true period *and* its
        //    integer multiples (2x, 3x period = half, third tempo, etc).
        //    The correct convention is to pick the fundamental (shortest lag,
        //    i.e. fastest tempo) among those near-equal peaks, rather than
        //    forcing the result toward an arbitrary "typical" tempo range.
        const peakThreshold = 0.82 * globalMax;
        let bestLag = -1;
        for (let lag = minLag; lag <= maxLag; lag++) {
            const isLocalPeak = ac[lag] >= (ac[lag - 1] || -Infinity) && ac[lag] >= (ac[lag + 1] || -Infinity);
            if (isLocalPeak && ac[lag] >= peakThreshold) { bestLag = lag; break; }
        }
        if (bestLag === -1) {
            for (let lag = minLag; lag <= maxLag; lag++) {
                if (ac[lag] === globalMax) { bestLag = lag; break; }
            }
        }

        // 7. Parabolic interpolation around the peak for sub-frame precision
        let refinedLag = bestLag;
        if (bestLag > minLag && bestLag < maxLag) {
            const y0 = ac[bestLag - 1], y1 = ac[bestLag], y2 = ac[bestLag + 1];
            const denom = (y0 - 2 * y1 + y2);
            if (denom !== 0) {
                const offset = 0.5 * (y0 - y2) / denom;
                if (offset > -1 && offset < 1) refinedLag = bestLag + offset;
            }
        }

        return 60 / (refinedLag * secPerFrame);
    }

    // ── Key detection (chroma + Krumhansl-Schmuckler profiles) ─────────
    const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

    function detectKey(data, sampleRate) {
        const fftSize = 4096;
        const hop = 2048;
        const maxFrames = 500;
        const totalFrames = Math.max(1, Math.floor((data.length - fftSize) / hop));
        const frameStep = Math.max(1, Math.floor(totalFrames / maxFrames));

        const window_ = hannWindow(fftSize);
        const chroma = new Float64Array(12);

        const minFreq = 65;    // ~C2
        const maxFreq = 2100;  // ~C7

        const re = new Float64Array(fftSize);
        const im = new Float64Array(fftSize);

        for (let start = 0, frameIdx = 0; start + fftSize < data.length; start += hop, frameIdx++) {
            if (frameIdx % frameStep !== 0) continue;
            for (let i = 0; i < fftSize; i++) {
                re[i] = data[start + i] * window_[i];
                im[i] = 0;
            }
            fft(re, im);

            const binHz = sampleRate / fftSize;
            const minBin = Math.max(1, Math.floor(minFreq / binHz));
            const maxBin = Math.min(fftSize / 2 - 1, Math.ceil(maxFreq / binHz));
            for (let b = minBin; b <= maxBin; b++) {
                const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
                const freq = b * binHz;
                const midi = 69 + 12 * Math.log2(freq / 440);
                const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
                chroma[pitchClass] += mag;
            }
        }

        const sum = chroma.reduce((a, b) => a + b, 0);
        if (sum <= 0) return null;
        for (let i = 0; i < 12; i++) chroma[i] /= sum;

        let best = { corr: -Infinity, tonic: 0, mode: 'Major' };
        for (let tonic = 0; tonic < 12; tonic++) {
            const majCorr = correlate(chroma, rotate(MAJOR_PROFILE, tonic));
            if (majCorr > best.corr) best = { corr: majCorr, tonic, mode: 'Major' };
            const minCorr = correlate(chroma, rotate(MINOR_PROFILE, tonic));
            if (minCorr > best.corr) best = { corr: minCorr, tonic, mode: 'Minor' };
        }

        return `${NOTE_NAMES[best.tonic]} ${best.mode}`;
    }

    // ── Chord chart (per-second chroma template matching) ──────────────
    const CHORD_TYPES = [
        { suffix: '', intervals: [0, 4, 7] },
        { suffix: 'm', intervals: [0, 3, 7] },
        { suffix: '7', intervals: [0, 4, 7, 10] },
        { suffix: 'maj7', intervals: [0, 4, 7, 11] },
        { suffix: 'm7', intervals: [0, 3, 7, 10] },
        { suffix: 'dim', intervals: [0, 3, 6] },
        { suffix: 'sus4', intervals: [0, 5, 7] },
    ];

    function cosineSim(a, b) {
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
        const denom = Math.sqrt(na) * Math.sqrt(nb);
        return denom === 0 ? 0 : dot / denom;
    }

    function classifyChord(chroma) {
        const sum = chroma.reduce((a, b) => a + b, 0);
        if (sum <= 0) return 'N.C.';
        let best = { sim: -Infinity, label: 'N.C.' };
        for (let root = 0; root < 12; root++) {
            for (const type of CHORD_TYPES) {
                const template = new Array(12).fill(0);
                for (const iv of type.intervals) template[(root + iv) % 12] = 1;
                const sim = cosineSim(chroma, template);
                if (sim > best.sim) best = { sim, label: NOTE_NAMES[root] + type.suffix };
            }
        }
        return best.label;
    }

    function computeChordChart(data, sampleRate) {
        const fftSize = 4096;
        const hop = 2048;
        const segmentSeconds = 1.0;
        const duration = data.length / sampleRate;
        const numSegments = Math.max(1, Math.ceil(duration / segmentSeconds));
        const segChroma = Array.from({ length: numSegments }, () => new Float64Array(12));

        const window_ = hannWindow(fftSize);
        const re = new Float64Array(fftSize), im = new Float64Array(fftSize);
        const minFreq = 65, maxFreq = 2100;
        const binHz = sampleRate / fftSize;
        const minBin = Math.max(1, Math.floor(minFreq / binHz));
        const maxBin = Math.min(fftSize / 2 - 1, Math.ceil(maxFreq / binHz));

        for (let start = 0; start + fftSize < data.length; start += hop) {
            for (let i = 0; i < fftSize; i++) { re[i] = data[start + i] * window_[i]; im[i] = 0; }
            fft(re, im);
            const frameTime = start / sampleRate;
            const segIdx = Math.min(numSegments - 1, Math.floor(frameTime / segmentSeconds));
            for (let b = minBin; b <= maxBin; b++) {
                const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
                const freq = b * binHz;
                const midi = 69 + 12 * Math.log2(freq / 440);
                const pc = ((Math.round(midi) % 12) + 12) % 12;
                segChroma[segIdx][pc] += mag;
            }
        }

        const labels = segChroma.map(c => classifyChord(c));

        // Smooth isolated single-segment blips surrounded by the same chord
        for (let i = 1; i < labels.length - 1; i++) {
            if (labels[i] !== labels[i - 1] && labels[i] !== labels[i + 1] && labels[i - 1] === labels[i + 1]) {
                labels[i] = labels[i - 1];
            }
        }

        // Collapse consecutive identical labels into spans
        const spans = [];
        for (let i = 0; i < labels.length; i++) {
            if (i === 0 || labels[i] !== labels[i - 1]) {
                spans.push({ startSec: i * segmentSeconds, chord: labels[i] });
            }
        }
        return spans;
    }

    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function renderChordChart(spans) {
        chordsList.innerHTML = '';
        const shown = spans.filter(s => s.chord !== 'N.C.');
        if (shown.length === 0) {
            chordsWrap.hidden = true;
            return;
        }
        for (const span of shown) {
            const chip = document.createElement('div');
            chip.className = 'analyzer-chord-chip';
            const name = document.createElement('div');
            name.className = 'analyzer-chord-chip-name';
            name.textContent = span.chord;
            const time = document.createElement('div');
            time.className = 'analyzer-chord-chip-time';
            time.textContent = formatTime(span.startSec);
            chip.appendChild(name);
            chip.appendChild(time);
            chordsList.appendChild(chip);
        }
        chordsWrap.hidden = false;
    }

    // ── Stem split (Beta): phase-cancellation center-channel extraction ─
    stemsBtn.addEventListener('click', () => {
        if (selectedFile) generateStems(selectedFile);
    });

    async function generateStems(file) {
        stemsBtn.disabled = true;
        stemsProgress.hidden = false;
        stemsResults.hidden = true;
        stemsError.hidden = true;
        stemsError.textContent = '';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const DecodeCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new DecodeCtx();
            const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
            ctx.close && ctx.close();

            if (buffer.numberOfChannels < 2) {
                throw new Error('This file is mono, so there is no left/right difference to work with. Stem splitting needs a stereo track.');
            }

            const L = buffer.getChannelData(0);
            const R = buffer.getChannelData(1);
            const len = L.length;
            const instrumental = new Float32Array(len);
            const center = new Float32Array(len);
            for (let i = 0; i < len; i++) {
                instrumental[i] = (L[i] - R[i]) * 0.9;
                center[i] = (L[i] + R[i]) * 0.5;
            }

            const instrumentalBlob = encodeWav(instrumental, buffer.sampleRate);
            const centerBlob = encodeWav(center, buffer.sampleRate);
            const instrumentalUrl = URL.createObjectURL(instrumentalBlob);
            const centerUrl = URL.createObjectURL(centerBlob);

            stemInstrumentalAudio.src = instrumentalUrl;
            stemCenterAudio.src = centerUrl;
            stemInstrumentalDl.href = instrumentalUrl;
            stemCenterDl.href = centerUrl;

            stemsResults.hidden = false;
        } catch (err) {
            stemsError.hidden = false;
            stemsError.textContent = err.message || 'Could not generate stems for this file.';
            console.error('Stem split error:', err);
        } finally {
            stemsProgress.hidden = true;
            stemsBtn.disabled = false;
        }
    }

    function encodeWav(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        function writeString(offset, str) {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        }
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true); // mono output
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, samples.length * 2, true);
        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            offset += 2;
        }
        return new Blob([buffer], { type: 'audio/wav' });
    }

    function rotate(profile, n) {
        const out = new Array(12);
        for (let i = 0; i < 12; i++) out[i] = profile[(i - n + 12) % 12];
        return out;
    }

    function correlate(a, b) {
        const n = a.length;
        let meanA = 0, meanB = 0;
        for (let i = 0; i < n; i++) { meanA += a[i]; meanB += b[i]; }
        meanA /= n; meanB /= n;
        let num = 0, denA = 0, denB = 0;
        for (let i = 0; i < n; i++) {
            const da = a[i] - meanA, db = b[i] - meanB;
            num += da * db;
            denA += da * da;
            denB += db * db;
        }
        const den = Math.sqrt(denA * denB);
        return den === 0 ? 0 : num / den;
    }

    function hannWindow(size) {
        const w = new Float64Array(size);
        for (let i = 0; i < size; i++) {
            w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
        }
        return w;
    }

    // In-place iterative radix-2 Cooley-Tukey FFT. re/im length must be a power of 2.
    function fft(re, im) {
        const n = re.length;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                let tr = re[i]; re[i] = re[j]; re[j] = tr;
                let ti = im[i]; im[i] = im[j]; im[j] = ti;
            }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const ang = (-2 * Math.PI) / len;
            const wr = Math.cos(ang), wi = Math.sin(ang);
            for (let i = 0; i < n; i += len) {
                let curWr = 1, curWi = 0;
                for (let k = 0; k < len / 2; k++) {
                    const uRe = re[i + k], uIm = im[i + k];
                    const vRe = re[i + k + len / 2] * curWr - im[i + k + len / 2] * curWi;
                    const vIm = re[i + k + len / 2] * curWi + im[i + k + len / 2] * curWr;
                    re[i + k] = uRe + vRe;
                    im[i + k] = uIm + vIm;
                    re[i + k + len / 2] = uRe - vRe;
                    im[i + k + len / 2] = uIm - vIm;
                    const nextWr = curWr * wr - curWi * wi;
                    const nextWi = curWr * wi + curWi * wr;
                    curWr = nextWr; curWi = nextWi;
                }
            }
        }
    }
})();
