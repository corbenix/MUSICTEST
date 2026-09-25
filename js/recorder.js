// Universal "record while playing" module — loaded globally alongside the
// instrument scripts (keyboard.js, guitar.js, bass.js, instrument-sound.js).
// Those files each own a private AudioContext; rather than merge them into
// one shared context (a much bigger refactor), Recorder.tap(ctx) is called
// from every place a note's gain node connects to ctx.destination. The
// *first* context that produces a tap after Record is pressed becomes the
// one this take captures — covering the overwhelmingly common case (the
// user records themselves on the instrument/page they're currently on)
// without requiring every instrument to share audio infrastructure.
window.Recorder = (function () {
    'use strict';

    let recording = false;
    let mediaRecorder = null;
    let chunks = [];
    let recCtx = null;       // the AudioContext this take is capturing
    let destNode = null;     // MediaStreamAudioDestinationNode on recCtx
    let startedAt = 0;
    let elapsedTimer = null;
    let lastBlobUrl = null;
    const listeners = [];

    function emit(evt) { listeners.forEach(fn => { try { fn(evt); } catch (e) { /* listener error, ignore */ } }); }
    function subscribe(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; }

    function isRecording() { return recording; }
    function elapsedSeconds() { return recording ? (Date.now() - startedAt) / 1000 : 0; }

    function start() {
        if (recording) return;
        recording = true;
        recCtx = null;
        destNode = null;
        mediaRecorder = null;
        chunks = [];
        startedAt = Date.now();
        emit({ type: 'start' });
        elapsedTimer = setInterval(() => emit({ type: 'tick', seconds: elapsedSeconds() }), 250);
    }

    // Called from every instrument's playback path right before it connects
    // a note's gain node to ctx.destination. Returns a node to ALSO connect
    // that gain to, or null when there's nothing to do (not recording, or
    // this ctx isn't the one being captured this take). Safe to call on
    // every note — cheap no-op when not recording.
    function tap(ctx) {
        if (!recording || !ctx) return null;
        if (!recCtx) {
            recCtx = ctx;
            try {
                destNode = ctx.createMediaStreamDestination();
                mediaRecorder = new MediaRecorder(destNode.stream);
                mediaRecorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
                mediaRecorder.start();
            } catch (e) {
                console.error('Recorder: could not start MediaRecorder', e);
                mediaRecorder = null;
                destNode = null;
            }
        }
        if (ctx !== recCtx) return null;
        return destNode;
    }

    function stop() {
        if (!recording) return;
        recording = false;
        clearInterval(elapsedTimer);
        emit({ type: 'stop' });
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.onstop = finish;
            mediaRecorder.stop();
        } else {
            finish();
        }
    }

    function toggle() { recording ? stop() : start(); }

    function finish() {
        if (!chunks.length) {
            emit({ type: 'empty' });
            return;
        }
        const takeBlob = new Blob(chunks, { type: (chunks[0] && chunks[0].type) || 'audio/webm' });
        emit({ type: 'processing' });
        encodeToMp3(takeBlob).then(mp3Blob => {
            if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
            lastBlobUrl = URL.createObjectURL(mp3Blob);
            emit({ type: 'ready', url: lastBlobUrl, blob: mp3Blob });
        }).catch(err => {
            console.error('Recorder: MP3 encoding failed', err);
            emit({ type: 'error', error: err });
        });
    }

    function download(filename) {
        if (!lastBlobUrl) return;
        const a = document.createElement('a');
        a.href = lastBlobUrl;
        a.download = filename || ('chord-nexus-recording-' + Date.now() + '.mp3');
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // Decodes the captured take (webm/opus, whatever MediaRecorder gave us)
    // back into raw PCM via a throwaway AudioContext, then encodes that PCM
    // to a real MP3 file with lamejs (loaded from index.html) — this is
    // what makes the download an actual portable .mp3 instead of the
    // browser-only webm/ogg container MediaRecorder produces natively.
    async function encodeToMp3(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const DecodeCtx = window.AudioContext || window.webkitAudioContext;
        const decodeCtx = new DecodeCtx();
        let audioBuffer;
        try {
            audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
        } finally {
            decodeCtx.close();
        }

        if (!window.lamejs) throw new Error('lamejs is not loaded — cannot encode MP3');

        const channels = Math.min(audioBuffer.numberOfChannels, 2);
        const sampleRate = audioBuffer.sampleRate;
        const left = floatTo16(audioBuffer.getChannelData(0));
        const right = channels > 1 ? floatTo16(audioBuffer.getChannelData(1)) : null;

        const encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, 128);
        const blockSize = 1152;
        const mp3Chunks = [];
        for (let i = 0; i < left.length; i += blockSize) {
            const lChunk = left.subarray(i, i + blockSize);
            const rChunk = right ? right.subarray(i, i + blockSize) : null;
            const buf = rChunk ? encoder.encodeBuffer(lChunk, rChunk) : encoder.encodeBuffer(lChunk);
            if (buf.length) mp3Chunks.push(buf);
        }
        const tail = encoder.flush();
        if (tail.length) mp3Chunks.push(tail);
        return new Blob(mp3Chunks, { type: 'audio/mp3' });
    }

    function floatTo16(float32) {
        const out = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return out;
    }

    return { start, stop, toggle, isRecording, elapsedSeconds, tap, subscribe, download };
})();
