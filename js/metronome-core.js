// Shared metronome controller — single source of truth for bpm/play state,
// used by both the universal floating widget and the Practice Tools page
// metronome panel, so toggling or changing tempo in either place keeps
// both in sync. No DOM here; pure state + Web Audio ticking.
window.GlobalMetronome = (function () {
    'use strict';

    var STORAGE_KEY = 'gmw-bpm';
    var MIN_BPM = 30, MAX_BPM = 300;

    var bpm = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    if (!bpm || isNaN(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) bpm = 100;

    var active = false;
    var timer = null;
    var audioCtx = null;
    var listeners = [];

    function getCtx() {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        return audioCtx;
    }

    function click() {
        var ctx = getCtx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.06);
        listeners.forEach(function (fn) { fn({ type: 'tick' }); });
    }

    function notify() {
        listeners.forEach(function (fn) { fn({ type: 'state', bpm: bpm, active: active }); });
    }

    function restart() {
        clearInterval(timer);
        timer = setInterval(click, 60000 / bpm);
    }

    function setBpm(next) {
        next = Math.min(MAX_BPM, Math.max(MIN_BPM, next));
        bpm = next;
        localStorage.setItem(STORAGE_KEY, String(bpm));
        if (active) restart();
        notify();
    }

    function setActive(next) {
        active = next;
        if (active) { click(); restart(); }
        else clearInterval(timer);
        notify();
    }

    return {
        MIN_BPM: MIN_BPM,
        MAX_BPM: MAX_BPM,
        getBpm: function () { return bpm; },
        getActive: function () { return active; },
        setBpm: setBpm,
        setActive: setActive,
        toggle: function () { setActive(!active); },
        // Calls fn immediately with current state, then on every change/tick.
        subscribe: function (fn) {
            listeners.push(fn);
            fn({ type: 'state', bpm: bpm, active: active });
        }
    };
})();
