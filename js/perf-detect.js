// ── Device performance tiering ───────────────────────────────────────────
// Adds `perf-low` to <html> on devices that are likely to struggle with
// the site's animations (blur, keyframe pulses/spins, transitions), so
// css/perf-low.css (loaded on every page) can simplify or drop them.
//
// Two layers, both best-effort — neither is reliable alone:
//   1. Instant heuristics (hardwareConcurrency, deviceMemory,
//      prefers-reduced-motion) — synchronous, applied before first paint
//      to avoid a flash of full animation that then gets stripped away.
//      deviceMemory is Chrome/Android-only; iOS Safari exposes neither
//      that nor a reliable core count, so this layer alone under-detects
//      slow iPhones.
//   2. A short real-world frame-time sample taken right after load —
//      catches actual sustained low frame rates regardless of platform
//      or which APIs it exposes, at the cost of a brief delay before the
//      class can be applied (progressive: only removes animation that's
//      already playing, doesn't prevent it from starting once).
//
// Result is cached in sessionStorage so returning to another page in the
// same visit doesn't re-run the benchmark.
(function () {
    var root = document.documentElement;
    var CACHE_KEY = 'cn-perf-tier';

    function applyLow() { root.classList.add('perf-low'); }

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) { applyLow(); return; } // strongest, explicit signal — done

    var cached = null;
    try { cached = sessionStorage.getItem(CACHE_KEY); } catch (e) { /* private mode etc. */ }
    if (cached === 'low') { applyLow(); return; }
    if (cached === 'high') { return; }

    // Everything below is specifically about phones/tablets — a modest
    // desktop (e.g. an older budget PC with 4 cores/4GB RAM) isn't the
    // concern here and has plenty of headroom for these animations, so
    // don't let it get mistaken for a slow phone.
    var isTouch = window.matchMedia &&
        window.matchMedia('(pointer: coarse)').matches;
    if (!isTouch) return;

    // Layer 1: instant heuristics (Chrome/Android only; silently skipped
    // elsewhere since the properties are simply undefined there).
    var cores = navigator.hardwareConcurrency;
    var mem = navigator.deviceMemory;
    var looksLowByHeuristic = (typeof cores === 'number' && cores <= 4) &&
        (typeof mem === 'number' && mem <= 4);
    if (looksLowByHeuristic) {
        applyLow();
        try { sessionStorage.setItem(CACHE_KEY, 'low'); } catch (e) {}
        return; // skip the benchmark — already decided
    }

    // Layer 2: short real-world frame-time sample.

    var frames = 0;
    var start = null;
    var SAMPLE_FRAMES = 24;

    function tick(t) {
        if (start === null) start = t;
        frames++;
        if (frames < SAMPLE_FRAMES) {
            requestAnimationFrame(tick);
            return;
        }
        var elapsed = t - start;
        var fps = (frames / elapsed) * 1000;
        var tier = fps < 45 ? 'low' : 'high';
        if (tier === 'low') applyLow();
        try { sessionStorage.setItem(CACHE_KEY, tier); } catch (e) {}
    }
    requestAnimationFrame(tick);
})();
