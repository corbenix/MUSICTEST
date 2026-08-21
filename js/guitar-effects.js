// Guitar effects pedalboard — amp, overdrive, chorus, delay, reverb.
// Builds one persistent Web Audio signal chain that guitar.js's playTone()
// routes through instead of connecting straight to ctx.destination.
// Each pedal can be bypassed (true dry passthrough) independently, and the
// UI (rendered only into panels that opt in — Chord Library + Capo
// Explorer) stays in sync with the shared state via renderPedalboard().
window.GuitarEffects = (function () {
    let chain = null; // built lazily once we have an AudioContext
    const listeners = [];

    const PEDALS = [
        {
            id: 'amp', label: 'Amp', icon: 'ti-speakerphone',
            params: [],
        },
        {
            id: 'overdrive', label: 'Overdrive', icon: 'ti-bolt', requires: 'amp',
            params: [
                { id: 'drive', label: 'Drive', min: 0, max: 100, default: 45 },
                { id: 'tone', label: 'Tone', min: 0, max: 100, default: 50 },
                { id: 'level', label: 'Level', min: 0, max: 100, default: 60 },
            ],
        },
        {
            id: 'chorus', label: 'Chorus', icon: 'ti-wave-sine',
            params: [
                { id: 'rate', label: 'Rate', min: 0, max: 100, default: 30 },
                { id: 'depth', label: 'Depth', min: 0, max: 100, default: 40 },
                { id: 'mix', label: 'Mix', min: 0, max: 100, default: 50 },
            ],
        },
        {
            id: 'delay', label: 'Delay', icon: 'ti-repeat',
            params: [
                { id: 'time', label: 'Time', min: 0, max: 100, default: 35 },
                { id: 'feedback', label: 'Feedback', min: 0, max: 100, default: 35 },
                { id: 'mix', label: 'Mix', min: 0, max: 100, default: 45 },
            ],
        },
        {
            id: 'reverb', label: 'Reverb', icon: 'ti-cloud',
            params: [
                { id: 'decay', label: 'Decay', min: 0, max: 100, default: 40 },
                { id: 'tone', label: 'Tone', min: 0, max: 100, default: 55 },
                { id: 'mix', label: 'Mix', min: 0, max: 100, default: 40 },
            ],
        },
    ];

    const state = {};
    PEDALS.forEach(p => {
        const values = {};
        p.params.forEach(prm => { values[prm.id] = prm.default; });
        state[p.id] = { on: false, values };
    });

    function pedalMeta(id) { return PEDALS.find(p => p.id === id); }

    function isEffectivelyOn(id) {
        const meta = pedalMeta(id);
        if (!state[id].on) return false;
        if (meta && meta.requires) return !!state[meta.requires].on;
        return true;
    }

    function makeDistortionCurve(amount) {
        const k = amount, n = 44100;
        const curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    function makeReverbImpulse(ctx, seconds, decay) {
        const rate = ctx.sampleRate;
        const length = Math.max(1, Math.floor(rate * seconds));
        const impulse = ctx.createBuffer(2, length, rate);
        for (let c = 0; c < 2; c++) {
            const data = impulse.getChannelData(c);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return impulse;
    }

    // A pedal is: input -> [dry gain] -> pedalOut
    //             input -> [wet effect chain] -> [wetMix gain] -> [wet gain] -> pedalOut
    // `dry`/`wet` crossfade on bypass (on/off). `wetMix` is the pedal's own
    // Level/Mix knob, always active whenever the pedal is on.
    function buildPedal(ctx, id) {
        const v = state[id].values;
        const input = ctx.createGain();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const wetMix = ctx.createGain();
        const output = ctx.createGain();
        input.connect(dry).connect(output);
        wetMix.connect(wet).connect(output);

        let nodes = {};
        if (id === 'overdrive') {
            const shaper = ctx.createWaveShaper();
            shaper.curve = makeDistortionCurve(v.drive);
            shaper.oversample = '4x';
            const tone = ctx.createBiquadFilter();
            tone.type = 'lowpass';
            tone.frequency.value = 800 + (v.tone / 100) * 6000;
            input.connect(shaper).connect(tone).connect(wetMix);
            nodes = { shaper, tone };
        } else if (id === 'amp') {
            input.connect(wetMix);
            nodes = {};
        } else if (id === 'chorus') {
            const delay = ctx.createDelay();
            delay.delayTime.value = 0.018;
            const lfo = ctx.createOscillator();
            lfo.frequency.value = 0.4 + (v.rate / 100) * 3.2;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.002 + (v.depth / 100) * 0.008;
            lfo.connect(lfoGain).connect(delay.delayTime);
            lfo.start();
            input.connect(delay).connect(wetMix);
            nodes = { delay, lfo, lfoGain };
        } else if (id === 'delay') {
            const delay = ctx.createDelay(2);
            delay.delayTime.value = 0.08 + (v.time / 100) * 0.55;
            const feedback = ctx.createGain();
            feedback.gain.value = (v.feedback / 100) * 0.75;
            const filt = ctx.createBiquadFilter();
            filt.type = 'lowpass';
            filt.frequency.value = 3200;
            input.connect(delay);
            delay.connect(filt).connect(feedback).connect(delay);
            delay.connect(wetMix);
            nodes = { delay, feedback, filt };
        } else if (id === 'reverb') {
            const convolver = ctx.createConvolver();
            convolver.buffer = makeReverbImpulse(ctx, 0.6 + (v.decay / 100) * 3, 2.5);
            const tone = ctx.createBiquadFilter();
            tone.type = 'lowpass';
            tone.frequency.value = 1000 + (v.tone / 100) * 6000;
            input.connect(convolver).connect(tone).connect(wetMix);
            nodes = { convolver, tone };
        }

        dry.gain.value = 1;
        wet.gain.value = 0;
        wetMix.gain.value = v.mix !== undefined ? v.mix / 100
            : v.level !== undefined ? v.level / 100
            : v.volume !== undefined ? v.volume / 100
            : 1;

        return { id, input, output, dry, wet, wetMix, nodes };
    }

    function buildChain(ctx) {
        const entry = ctx.createGain();
        const exit = ctx.createGain();
        let prev = entry;
        const pedals = {};
        PEDALS.forEach(p => {
            const pedal = buildPedal(ctx, p.id);
            prev.connect(pedal.input);
            pedals[p.id] = pedal;
            prev = pedal.output;
        });
        prev.connect(exit);
        exit.connect(ctx.destination);
        return { ctx, entry, exit, pedals };
    }

    function ensureChain(ctx) {
        if (!chain || chain.ctx !== ctx) chain = buildChain(ctx);
        return chain;
    }

    function applyBypass(id) {
        if (!chain) return;
        const pedal = chain.pedals[id];
        const on = isEffectivelyOn(id);
        const t = chain.ctx.currentTime;
        pedal.dry.gain.setTargetAtTime(on ? 0 : 1, t, 0.015);
        pedal.wet.gain.setTargetAtTime(on ? 1 : 0, t, 0.015);
    }

    // The "output-ish" knob (Level / Volume / Mix — whichever the pedal
    // defines) drives the wetMix gain directly; every other knob rebuilds
    // the node(s) it controls.
    const OUTPUT_PARAM = { overdrive: 'level', chorus: 'mix', delay: 'mix', reverb: 'mix' };

    function applyParam(id, paramId) {
        if (!chain) return;
        const pedal = chain.pedals[id];
        const v = state[id].values;

        if (paramId === OUTPUT_PARAM[id]) {
            pedal.wetMix.gain.setTargetAtTime(v[paramId] / 100, chain.ctx.currentTime, 0.02);
            return;
        }
        if (id === 'overdrive') {
            if (paramId === 'drive') pedal.nodes.shaper.curve = makeDistortionCurve(v.drive);
            if (paramId === 'tone') pedal.nodes.tone.frequency.value = 800 + (v.tone / 100) * 6000;
        } else if (id === 'chorus') {
            if (paramId === 'rate') pedal.nodes.lfo.frequency.value = 0.4 + (v.rate / 100) * 3.2;
            if (paramId === 'depth') pedal.nodes.lfoGain.gain.value = 0.002 + (v.depth / 100) * 0.008;
        } else if (id === 'delay') {
            if (paramId === 'time') pedal.nodes.delay.delayTime.value = 0.08 + (v.time / 100) * 0.55;
            if (paramId === 'feedback') pedal.nodes.feedback.gain.value = (v.feedback / 100) * 0.75;
        } else if (id === 'reverb') {
            if (paramId === 'decay') pedal.nodes.convolver.buffer = makeReverbImpulse(chain.ctx, 0.6 + (v.decay / 100) * 3, 2.5);
            if (paramId === 'tone') pedal.nodes.tone.frequency.value = 1000 + (v.tone / 100) * 6000;
        }
    }

    function dependents(id) { return PEDALS.filter(p => p.requires === id).map(p => p.id); }

    function setOn(id, on) {
        if (!state[id]) return;
        state[id].on = !!on;
        applyBypass(id);
        listeners.forEach(fn => fn(id));
        // If this pedal gates another (amp gates overdrive), the dependent's
        // effective on/off state just changed even though its own toggle
        // didn't move — re-sync its audio and its UI.
        dependents(id).forEach(depId => {
            applyBypass(depId);
            listeners.forEach(fn => fn(depId));
        });
    }
    function toggle(id) { setOn(id, !state[id].on); }
    function setParam(id, paramId, value) {
        if (!state[id] || !(paramId in state[id].values)) return;
        state[id].values[paramId] = Math.max(0, Math.min(100, value));
        applyParam(id, paramId);
        listeners.forEach(fn => fn(id));
    }
    function onChange(fn) { listeners.push(fn); }

    // Called by guitar.js right before connecting a note's gain node —
    // returns the node to connect into (the pedalboard's entry) instead of
    // ctx.destination directly, lazily building the chain on first use.
    function getInputNode(ctx) {
        return ensureChain(ctx).entry;
    }

    const COLORS = {
        amp:       { bg: '#3a3d4a', border: '#3a3d4a', text: '#f2f2f7', shadow: '#212330' },
        overdrive: { bg: '#d6432f', border: '#d6432f', text: '#fff0ea', shadow: '#8c2a1c' },
        chorus:    { bg: '#3457e0', border: '#3457e0', text: '#eaf0ff', shadow: '#1f378c' },
        delay:     { bg: '#0fae82', border: '#0fae82', text: '#e6fff8', shadow: '#0a7057' },
        reverb:    { bg: '#9b3fd6', border: '#9b3fd6', text: '#f6e8ff', shadow: '#652890' },
    };

    function renderPedalboard(container) {
        if (!container || container.dataset.pedalboardMounted) return;
        container.dataset.pedalboardMounted = 'true';
        container.classList.add('pedalboard');

        const grid = document.createElement('div');
        grid.className = 'pedalboard-grid';
        const params = document.createElement('div');
        params.className = 'pedalboard-params';
        container.appendChild(grid);
        container.appendChild(params);

        let selected = null;
        const boxes = {};

        function renderParams() {
            params.innerHTML = '';
            if (!selected) { params.hidden = true; return; }
            params.hidden = false;
            const meta = pedalMeta(selected);
            const accent = COLORS[selected].border;

            meta.params.forEach(prm => {
                const row = document.createElement('div');
                row.className = 'pedal-param-row';

                const label = document.createElement('span');
                label.className = 'pedal-param-label';
                label.textContent = prm.label;

                const slider = document.createElement('input');
                slider.type = 'range';
                slider.className = 'pedal-param-slider';
                slider.min = prm.min;
                slider.max = prm.max;
                slider.value = state[selected].values[prm.id];
                slider.style.setProperty('--accent', accent);

                const value = document.createElement('span');
                value.className = 'pedal-param-value';
                value.textContent = (state[selected].values[prm.id] / 100).toFixed(1);

                slider.addEventListener('input', () => {
                    setParam(selected, prm.id, Number(slider.value));
                    value.textContent = (Number(slider.value) / 100).toFixed(1);
                });

                row.appendChild(label);
                row.appendChild(slider);
                row.appendChild(value);
                params.appendChild(row);
            });
        }

        PEDALS.forEach(p => {
            const c = COLORS[p.id];
            const box = document.createElement('div');
            box.className = 'pedal-box';
            box.style.setProperty('--pedal-bg', c.bg);
            box.style.setProperty('--pedal-border', c.border);
            box.style.setProperty('--pedal-text', c.text);
            box.style.setProperty('--pedal-shadow', c.shadow);
            box.dataset.pedal = p.id;
            box.setAttribute('role', 'button');
            box.setAttribute('tabindex', '0');

            box.innerHTML = `
                <div class="pedal-box-label">${p.label}</div>
                <div class="pedal-box-body">
                    <i class="ti ${p.icon} pedal-box-icon" aria-hidden="true"></i>
                    <span class="pedal-box-led" aria-hidden="true"></span>
                    <button type="button" class="pedal-box-switch" aria-label="Toggle ${p.label}"></button>
                </div>`;
            const switchBtn = box.querySelector('.pedal-box-switch');

            function refresh() {
                const locked = p.requires && !state[p.requires].on;
                box.classList.toggle('pedal-box--on', isEffectivelyOn(p.id));
                box.classList.toggle('pedal-box--locked', !!locked);
                box.classList.toggle('pedal-box--selected', selected === p.id);
                box.title = locked
                    ? `Turn on ${pedalMeta(p.requires).label} first`
                    : p.params.length ? `Tap to view ${p.label} controls` : '';
                switchBtn.title = locked
                    ? `Turn on ${pedalMeta(p.requires).label} first`
                    : `${state[p.id].on ? 'Disable' : 'Enable'} ${p.label}`;
            }
            refresh();
            boxes[p.id] = { box, refresh };

            box.addEventListener('click', () => {
                const locked = p.requires && !state[p.requires].on;
                if (locked) return;
                if (p.params.length) {
                    selected = (selected === p.id) ? null : p.id;
                    renderParams();
                }
                Object.values(boxes).forEach(b => b.refresh());
            });
            switchBtn.addEventListener('click', e => {
                e.stopPropagation();
                const locked = p.requires && !state[p.requires].on;
                if (locked) return;
                toggle(p.id);
                switchBtn.classList.remove('pedal-box-switch--bump');
                void switchBtn.offsetWidth;
                switchBtn.classList.add('pedal-box-switch--bump');
                Object.values(boxes).forEach(b => b.refresh());
            });
            box.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); box.click(); }
            });

            grid.appendChild(box);

            onChange(id => {
                if (id !== p.id && p.requires !== id) return;
                refresh();
                if (selected === id) renderParams();
            });
        });

        renderParams();
    }

    return { getInputNode, setOn, toggle, setParam, onChange, renderPedalboard, PEDALS, state };
})();
