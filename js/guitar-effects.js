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
        { id: 'overdrive', label: 'Overdrive', icon: 'ti-bolt', knob: { label: 'Drive', min: 0, max: 100, default: 45 } },
        { id: 'amp',       label: 'Amp',       icon: 'ti-speakerphone', knob: { label: 'Tone', min: 0, max: 100, default: 55 } },
        { id: 'chorus',    label: 'Chorus',    icon: 'ti-wave-sine', knob: { label: 'Depth', min: 0, max: 100, default: 40 } },
        { id: 'delay',     label: 'Delay',     icon: 'ti-repeat', knob: { label: 'Time', min: 0, max: 100, default: 35 } },
        { id: 'reverb',    label: 'Reverb',    icon: 'ti-cloud', knob: { label: 'Mix', min: 0, max: 100, default: 30 } },
    ];

    const state = {};
    PEDALS.forEach(p => { state[p.id] = { on: false, value: p.knob.default }; });

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
    //             input -> [wet chain] -> [wet gain] -> pedalOut
    // Bypass just crossfades dry/wet gains to 0/1 or 1/0, so toggling never
    // clicks or breaks the chain.
    function buildPedal(ctx, id) {
        const input = ctx.createGain();
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        const output = ctx.createGain();
        input.connect(dry).connect(output);

        let nodes = {};
        if (id === 'overdrive') {
            const shaper = ctx.createWaveShaper();
            shaper.curve = makeDistortionCurve(state.overdrive.value);
            shaper.oversample = '4x';
            const post = ctx.createGain();
            post.gain.value = 0.5;
            input.connect(shaper).connect(post).connect(wet);
            nodes = { shaper, post };
        } else if (id === 'amp') {
            const drive = ctx.createWaveShaper();
            drive.curve = makeDistortionCurve(12);
            drive.oversample = '2x';
            const tone = ctx.createBiquadFilter();
            tone.type = 'lowpass';
            tone.frequency.value = 1800 + (state.amp.value / 100) * 4000;
            const post = ctx.createGain();
            post.gain.value = 0.9;
            input.connect(drive).connect(tone).connect(post).connect(wet);
            nodes = { drive, tone, post };
        } else if (id === 'chorus') {
            const delay = ctx.createDelay();
            delay.delayTime.value = 0.018;
            const lfo = ctx.createOscillator();
            lfo.frequency.value = 1.3;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.006 * (state.chorus.value / 100);
            lfo.connect(lfoGain).connect(delay.delayTime);
            lfo.start();
            input.connect(delay).connect(wet);
            input.connect(wet); // blend a little dry into the wet path so it stays chorus, not flange
            nodes = { delay, lfo, lfoGain };
        } else if (id === 'delay') {
            const delay = ctx.createDelay(2);
            delay.delayTime.value = 0.12 + (state.delay.value / 100) * 0.38;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.32;
            const filt = ctx.createBiquadFilter();
            filt.type = 'lowpass';
            filt.frequency.value = 3200;
            input.connect(delay);
            delay.connect(filt).connect(feedback).connect(delay);
            delay.connect(wet);
            nodes = { delay, feedback, filt };
        } else if (id === 'reverb') {
            const convolver = ctx.createConvolver();
            convolver.buffer = makeReverbImpulse(ctx, 2.2, 2.5);
            input.connect(convolver).connect(wet);
            nodes = { convolver };
        }

        dry.gain.value = 1;
        wet.gain.value = 0;
        wet.connect(output);

        return { id, input, output, dry, wet, nodes };
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
        const on = state[id].on;
        const t = chain.ctx.currentTime;
        pedal.dry.gain.setTargetAtTime(on ? 0 : 1, t, 0.015);
        pedal.wet.gain.setTargetAtTime(on ? 1 : 0, t, 0.015);
    }

    function applyKnob(id) {
        if (!chain) return;
        const pedal = chain.pedals[id];
        const v = state[id].value;
        if (id === 'overdrive') pedal.nodes.shaper.curve = makeDistortionCurve(v);
        if (id === 'amp') pedal.nodes.tone.frequency.value = 1800 + (v / 100) * 4000;
        if (id === 'chorus') pedal.nodes.lfoGain.gain.value = 0.006 * (v / 100);
        if (id === 'delay') pedal.nodes.delay.delayTime.value = 0.12 + (v / 100) * 0.38;
        if (id === 'reverb') pedal.nodes.convolver.buffer = makeReverbImpulse(chain.ctx, 1.2 + (v / 100) * 2.5, 2.5);
    }

    function setOn(id, on) {
        if (!state[id]) return;
        state[id].on = !!on;
        applyBypass(id);
        listeners.forEach(fn => fn(id));
    }
    function toggle(id) { setOn(id, !state[id].on); }
    function setValue(id, value) {
        if (!state[id]) return;
        state[id].value = Math.max(0, Math.min(100, value));
        applyKnob(id);
        listeners.forEach(fn => fn(id));
    }
    function onChange(fn) { listeners.push(fn); }

    // Called by guitar.js right before connecting a note's gain node —
    // returns the node to connect into (the pedalboard's entry) instead of
    // ctx.destination directly, lazily building the chain on first use.
    function getInputNode(ctx) {
        return ensureChain(ctx).entry;
    }

    function renderPedalboard(container) {
        if (!container || container.dataset.pedalboardMounted) return;
        container.dataset.pedalboardMounted = 'true';
        container.classList.add('pedalboard');
        PEDALS.forEach(p => {
            const pedal = document.createElement('div');
            pedal.className = 'pedal';
            pedal.dataset.pedal = p.id;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pedal-switch';
            btn.setAttribute('aria-pressed', state[p.id].on ? 'true' : 'false');
            btn.title = `${state[p.id].on ? 'Disable' : 'Enable'} ${p.label}`;
            btn.innerHTML = `<span class="pedal-led" aria-hidden="true"></span><i class="ti ${p.icon} pedal-icon" aria-hidden="true"></i><span class="pedal-label">${p.label}</span>`;
            btn.addEventListener('click', () => toggle(p.id));

            const knobRow = document.createElement('label');
            knobRow.className = 'pedal-knob-row';
            knobRow.innerHTML = `<span class="pedal-knob-label">${p.knob.label}</span>`;
            const knob = document.createElement('input');
            knob.type = 'range';
            knob.className = 'pedal-knob';
            knob.min = p.knob.min;
            knob.max = p.knob.max;
            knob.value = state[p.id].value;
            knob.addEventListener('input', () => setValue(p.id, Number(knob.value)));
            knobRow.appendChild(knob);

            pedal.appendChild(btn);
            pedal.appendChild(knobRow);
            container.appendChild(pedal);

            onChange(id => {
                if (id !== p.id) return;
                btn.setAttribute('aria-pressed', state[p.id].on ? 'true' : 'false');
                btn.title = `${state[p.id].on ? 'Disable' : 'Enable'} ${p.label}`;
                knob.value = state[p.id].value;
            });
        });
    }

    return { getInputNode, setOn, toggle, setValue, onChange, renderPedalboard, PEDALS, state };
})();
