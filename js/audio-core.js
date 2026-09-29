// Shared audio core, used by every instrument (keyboard.js, guitar.js +
// guitar-effects.js, bass.js, instrument-sound.js) instead of each keeping
// its own private AudioContext + sample cache + recorder-wiring boilerplate.
//
// Why this exists: those four files each used to create their own
// AudioContext. That meant playing keyboard and guitar "at the same time"
// was really two unrelated audio graphs, samples common to more than one
// instrument were fetched/decoded more than once, and js/recorder.js had to
// be wired into four separate connect-to-destination call sites by hand.
// One shared context fixes all three: a single audio graph (so a
// recording actually mixes whatever instruments you play in one take), one
// cache (fewer network/decode round-trips), and one place that knows how to
// hook a node into Recorder.
window.AudioCore = (function () {
    'use strict';

    // ── Context ──────────────────────────────────────────────────────────
    // Created lazily on first use, since most browsers require an
    // AudioContext to be created/resumed after a user gesture (a key
    // press, a fret click, etc.) rather than on page load.
    let ctx = null;
    function getContext() {
        if (!ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            ctx = new Ctx();
        }
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => { /* will retry resume on next call */ });
        }
        return ctx;
    }

    // ── Sample loading/cache ─────────────────────────────────────────────
    // Keyed by URL, shared across every instrument, so a sample referenced
    // by more than one (or preloaded twice by accident) is only ever
    // fetched and decoded once.
    const bufferCache = {};
    const bufferPromises = {};
    function loadBuffer(url, label) {
        if (bufferCache[url]) return Promise.resolve(bufferCache[url]);
        if (bufferPromises[url]) return bufferPromises[url];
        const c = getContext();
        bufferPromises[url] = fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
                return res.arrayBuffer();
            })
            .then(data => c.decodeAudioData(data))
            .then(buf => { bufferCache[url] = buf; return buf; })
            .catch(err => {
                // A 404 here means the file/path doesn't match; a generic
                // "Failed to fetch" almost always means the page was
                // opened as file:// (fetch() of local files is blocked)
                // rather than served over http(s).
                console.warn(`[audio${label ? ' · ' + label : ''}] could not load`, url, err);
                return null;
            });
        return bufferPromises[url];
    }

    // ── Recorder wiring ──────────────────────────────────────────────────
    // Connects `node` (a final-stage gain/output node — the raw per-note
    // gain for sample/synth voices, or the post-effects exit node for
    // guitar) to whatever js/recorder.js is currently capturing, if
    // anything. Safe to call on every single note: a WeakMap remembers
    // which recorder destination each node has already been wired to, so
    // repeat calls for a persistent node (guitar's effects-chain exit,
    // reused across every note) don't pile up duplicate connections —
    // which in the Web Audio API would otherwise sum the signal and make
    // the recording louder each time the same pair got connected again.
    const tappedTo = new WeakMap();
    function tapRecorder(node, audioCtx) {
        if (!window.Recorder) return;
        const rec = window.Recorder.tap(audioCtx || getContext());
        if (!rec) return;
        if (tappedTo.get(node) === rec) return; // already wired for this take
        node.connect(rec);
        tappedTo.set(node, rec);
    }

    return { getContext, loadBuffer, tapRecorder };
})();
