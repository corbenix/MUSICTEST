// Key Analyzer (Practice Tools): type a chord progression and get the most
// likely key, a secondary key, and a Roman-numeral breakdown of every chord.
(function () {
    'use strict';

    const input = document.getElementById('key-input');
    if (!input) return; // panel not present

    const chipsEl = document.getElementById('key-chips');
    const resultsEl = document.getElementById('key-results');
    const clearBtn = document.getElementById('key-clear');
    const examplesEl = document.getElementById('key-examples');

    const NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const KEY_MAJ = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const KEY_MIN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
    const FLAT_MAJ = new Set([1, 3, 5, 8, 10]);
    const FLAT_MIN = new Set([0, 2, 3, 5, 7, 10]);

    const SCALE_MAJ = [0, 2, 4, 5, 7, 9, 11];
    const SCALE_MIN = [0, 2, 3, 5, 7, 8, 10];
    const MAJ = new Set(SCALE_MAJ);
    const MIN_NAT = new Set(SCALE_MIN);
    const MIN_ALLOWED = new Set([0, 2, 3, 5, 7, 8, 10, 11]); // natural minor + raised 7th (harmonic)

    // How much a chord on each scale degree says "this is the key".
    const W_MAJ = { 0: 2.0, 7: 1.6, 5: 1.3, 9: 1.0, 2: 1.0, 4: 0.7, 11: 0.5 };
    const W_MIN = { 0: 2.0, 7: 1.5, 5: 1.2, 8: 1.0, 3: 1.0, 10: 1.0, 2: 0.5, 11: 0.5 };

    const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    // [pattern for text after the root, intervals, kind, numeral suffix]
    const QUALITIES = [
        [/^(?:m|min|mi|-)(?:maj7|M7|maj9|M9)$/, [0, 3, 7, 11], 'min', 'maj7'],
        [/^(?:maj|M|Δ|△)(?:7|9|11|13)/, [0, 4, 7, 11], 'maj', 'maj7'],
        [/^(?:maj|M|Δ|△)?$/, [0, 4, 7], 'maj', ''],
        [/^(?:m7b5|min7b5|mi7b5|m7♭5|-7b5|ø7?)$/, [0, 3, 6, 10], 'hdim', 'ø7'],
        [/^(?:dim7|°7|o7)$/, [0, 3, 6, 9], 'dim', '°7'],
        [/^(?:dim|°|o)$/, [0, 3, 6], 'dim', '°'],
        [/^(?:aug|\+)7?$/, [0, 4, 8], 'aug', '+'],
        [/^(?:m|min|mi|-)(?:7|9|11|13)/, [0, 3, 7, 10], 'min', '7'],
        [/^(?:m|min|mi|-)6$/, [0, 3, 7, 9], 'min', '6'],
        [/^(?:m|min|mi|-)(?:add9)?$/, [0, 3, 7], 'min', ''],
        [/^7sus4?$/, [0, 5, 7, 10], 'sus', '7sus'],
        [/^sus4?$/, [0, 5, 7], 'sus', 'sus4'],
        [/^sus2$/, [0, 2, 7], 'sus', 'sus2'],
        [/^(?:6|69)$/, [0, 4, 7, 9], 'maj', '6'],
        [/^(?:7|9|11|13)/, [0, 4, 7, 10], 'dom', '7'],
        [/^(?:add9|add2|2)$/, [0, 4, 7], 'maj', ''],
        [/^5$/, [0, 7], 'pow', '']
    ];

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function tokenize(str) {
        return str
            .replace(/[→>|]/g, ' ')
            .replace(/\s[-–—]+\s/g, ' ')
            .replace(/[–—]/g, ' ')
            .replace(/-(?=[A-G])/g, ' ')
            .split(/[\s,;]+/)
            .filter(Boolean);
    }

    function parseChord(tok) {
        const t = tok.replace(/6\/9/g, '69');
        const m = t.match(/^([A-Ga-g])([#♯b♭]?)(.*)$/);
        if (!m) return null;
        const letter = m[1].toUpperCase();
        const acc = m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2];
        let rest = m[3].replace(/[()]/g, '');
        let slash = '';
        const si = rest.indexOf('/');
        if (si >= 0) { slash = rest.slice(si); rest = rest.slice(0, si); }
        let q = null;
        for (const row of QUALITIES) { if (row[0].test(rest)) { q = row; break; } }
        if (!q) return null;
        const root = (ROOTS[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
        return {
            name: letter + acc + rest + slash,
            root,
            kind: q[2],
            sfx: q[3],
            pcs: q[1].map(i => (root + i) % 12)
        };
    }

    const rel = (p, t) => (((p - t) % 12) + 12) % 12;

    function evalChord(ch, key) {
        const allowed = key.mode === 'maj' ? MAJ : MIN_ALLOWED;
        const relPcs = ch.pcs.map(p => rel(p, key.t));
        const out = relPcs.filter(x => !allowed.has(x)).length;
        const d = rel(ch.root, key.t);
        if (out === 0) {
            let w = (key.mode === 'maj' ? W_MAJ : W_MIN)[d];
            if (w == null) w = 0.5;
            if (key.mode === 'min' && d === 7 && ch.kind === 'min') w = 0.7;
            return { type: 'diatonic', score: w, d };
        }
        if ((ch.kind === 'dom' || (ch.kind === 'maj' && ch.sfx === '')) && out <= 1) {
            const target = rel(ch.root + 5, key.t);
            const targets = key.mode === 'maj' ? [2, 4, 5, 7, 9] : [2, 3, 5, 7, 8, 10];
            if (targets.includes(target)) return { type: 'secdom', score: 0.3, d, target };
        }
        const parallel = key.mode === 'maj' ? MIN_NAT : MAJ;
        if (relPcs.every(x => parallel.has(x))) return { type: 'borrowed', score: -0.3, d };
        return { type: 'outside', score: -Math.min(2, out), d };
    }

    function scoreKey(chords, key) {
        const ev = chords.map(c => evalChord(c, key));
        let s = ev.reduce((a, e) => a + e.score, 0);
        const n = ev.length;
        if (ev[0].type === 'diatonic' && ev[0].d === 0) s += 1.4;
        if (ev[n - 1].type === 'diatonic' && ev[n - 1].d === 0) s += 1.0;
        for (let i = 0; i < n - 1; i++) {
            const a = ev[i], b = ev[i + 1];
            if (a.type === 'diatonic' && b.type === 'diatonic' && b.d === 0) {
                if (a.d === 7) s += 0.8;
                else if (a.d === 5) s += 0.3;
            }
        }
        return { key, score: s, ev, fit: ev.filter(e => e.type === 'diatonic').length };
    }

    function rankKeys(chords) {
        const out = [];
        for (let t = 0; t < 12; t++) {
            out.push(scoreKey(chords, { t, mode: 'maj' }));
            out.push(scoreKey(chords, { t, mode: 'min' }));
        }
        out.sort((a, b) => (b.score - a.score) || (b.fit - a.fit) || (a.key.t - b.key.t));
        return out;
    }

    const keyName = k => (k.mode === 'maj' ? KEY_MAJ[k.t] + ' major' : KEY_MIN[k.t] + ' minor');
    const keyShort = k => (k.mode === 'maj' ? KEY_MAJ[k.t] : KEY_MIN[k.t] + 'm');

    function scaleNotes(k) {
        const flats = k.mode === 'maj' ? FLAT_MAJ.has(k.t) : FLAT_MIN.has(k.t);
        const names = flats ? NAMES_FLAT : NAMES_SHARP;
        return (k.mode === 'maj' ? SCALE_MAJ : SCALE_MIN).map(i => names[(k.t + i) % 12]).join('  ');
    }

    function relation(p, s) {
        if (p.mode === 'maj' && s.mode === 'min' && s.t === (p.t + 9) % 12) return 'Relative minor';
        if (p.mode === 'min' && s.mode === 'maj' && s.t === (p.t + 3) % 12) return 'Relative major';
        if (p.t === s.t && p.mode !== s.mode) return p.mode === 'maj' ? 'Parallel minor' : 'Parallel major';
        if (p.mode === s.mode && s.t === (p.t + 7) % 12) return 'Dominant key (a fifth up)';
        if (p.mode === s.mode && s.t === (p.t + 5) % 12) return 'Subdominant key (a fourth up)';
        return 'Also fits well';
    }

    const NUM_MAJ = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];
    const NUM_MIN = ['I', '♭II', 'II', 'III', '♯III', 'IV', '♭V', 'V', 'VI', '♮VI', 'VII', '♮VII'];

    function romanOf(interval, minorQuality, mode) {
        const raw = (mode === 'maj' ? NUM_MAJ : NUM_MIN)[interval];
        const m = raw.match(/^([♭♯♮]?)(.*)$/);
        return m[1] + (minorQuality ? m[2].toLowerCase() : m[2]);
    }

    function numeral(ch, key, ev) {
        const minorQ = ch.kind === 'min' || ch.kind === 'dim' || ch.kind === 'hdim';
        if (ev.type === 'secdom') {
            const tMinor = key.mode === 'maj' ? [2, 4, 9].includes(ev.target) : [2, 5, 7].includes(ev.target);
            const tTxt = romanOf(ev.target, tMinor, key.mode) + (key.mode === 'min' && ev.target === 2 ? '°' : '');
            return (ch.kind === 'dom' ? 'V7' : 'V') + '/' + tTxt;
        }
        return romanOf(ev.d, minorQ, key.mode) + ch.sfx;
    }

    const TAGS = { secdom: 'secondary dominant', borrowed: 'borrowed chord', outside: 'outside key' };

    function render(chords, bad) {
        if (!chords.length) { resultsEl.hidden = true; resultsEl.innerHTML = ''; return; }
        const ranked = rankKeys(chords);
        const best = ranked[0], second = ranked[1];
        const top = Math.max(best.score, 0.01);
        const pct = r => Math.max(4, Math.min(100, Math.round((Math.max(r.score, 0) / top) * 100)));
        const n = chords.length;

        const card = (r, label, sub, main) =>
            '<div class="key-card' + (main ? ' key-card--main' : '') + '">' +
            '<div class="key-card-label">' + label + '</div>' +
            '<div class="key-card-name">' + escapeHtml(keyName(r.key)) + '</div>' +
            '<div class="key-card-sub">' + escapeHtml(sub) + ' · ' + r.fit + ' of ' + n + ' chord' + (n === 1 ? '' : 's') + ' in key</div>' +
            '<div class="key-bar" aria-hidden="true"><span style="width:' + pct(r) + '%"></span></div>' +
            '<div class="key-card-notes">' + escapeHtml(scaleNotes(r.key)) + '</div>' +
            '</div>';

        let html = '<div class="key-cards">' +
            card(best, 'Most likely key', n < 3 ? 'Very approximate with so few chords' : 'Best overall fit', true) +
            card(second, 'Secondary key', relation(best.key, second.key), false) +
            '</div>';

        const others = ranked.slice(2, 5);
        html += '<div class="key-others"><span class="key-others-label">Other possibilities</span>' +
            others.map(r => '<span>' + escapeHtml(keyName(r.key)) + ' <em>' + r.fit + '/' + n + '</em></span>').join('') +
            '</div>';

        html += '<div class="key-analysis-title">Chord analysis</div><div class="key-analysis">' +
            chords.map((ch, i) => {
                const e1 = best.ev[i], e2 = second.ev[i];
                const tag = TAGS[e1.type] || '';
                return '<div class="key-ch key-ch--' + e1.type + '">' +
                    '<div class="key-ch-name">' + escapeHtml(ch.name) + '</div>' +
                    '<div class="key-ch-num">' + escapeHtml(numeral(ch, best.key, e1)) + '</div>' +
                    '<div class="key-ch-num2">' + escapeHtml(keyShort(second.key)) + ': ' + escapeHtml(numeral(ch, second.key, e2)) + '</div>' +
                    (tag ? '<div class="key-ch-tag">' + tag + '</div>' : '') +
                    '</div>';
            }).join('') + '</div>';

        html += '<p class="key-note">Numerals show each chord’s role in the most likely key; the smaller line shows the secondary key. ' +
            'Short progressions can fit several keys, so treat this as a guide.</p>';
        resultsEl.innerHTML = html;
        resultsEl.hidden = false;
    }

    function update() {
        const tokens = tokenize(input.value);
        clearBtn.hidden = !tokens.length;
        const parsed = tokens.map(tok => ({ tok, ch: parseChord(tok) }));
        chipsEl.innerHTML = parsed.map((p, i) =>
            '<span class="key-chip' + (p.ch ? '' : ' key-chip--bad') + '"' + (p.ch ? '' : ' title="Not recognized"') + '>' +
            escapeHtml(p.ch ? p.ch.name : p.tok) +
            '<button type="button" data-i="' + i + '" aria-label="Remove ' + escapeHtml(p.tok) + '">×</button></span>'
        ).join('');
        render(parsed.filter(p => p.ch).map(p => p.ch), parsed.filter(p => !p.ch));
    }

    input.addEventListener('input', update);
    clearBtn.addEventListener('click', () => { input.value = ''; update(); input.focus(); });
    chipsEl.addEventListener('click', e => {
        const b = e.target.closest('button[data-i]');
        if (!b) return;
        const tokens = tokenize(input.value);
        tokens.splice(Number(b.dataset.i), 1);
        input.value = tokens.join(' ');
        update();
    });
    examplesEl.addEventListener('click', e => {
        const b = e.target.closest('button[data-chords]');
        if (!b) return;
        input.value = b.dataset.chords;
        update();
    });

    update();
})();
