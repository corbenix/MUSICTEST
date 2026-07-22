// CAGED shape templates. Each is the OPEN-position major chord shape for that
// letter, expressed as {string, fret, isRoot} (string 0 = low E). Moving a
// shape to a new root = shift every fret by (targetRootIndex - baseRootIndex).
window.GuitarData = (function () {
    const MT = window.MusicTheory;

    const CAGED_SHAPES = {
        // Each array is indexed low-to-high (string 0 = low E ... string 5 =
        // high e), 'x' = muted. Matches the reference tool's shape templates
        // exactly: C:[x,3,2,0,1,0] A:[x,0,2,2,2,0] G:[3,2,0,0,0,3]
        // E:[0,2,2,1,0,0] D:[x,x,0,2,3,2].
        C: { baseRoot: 'C', frets: [
            { string: 0, fret: 0, muted: true },
            { string: 1, fret: 3, isRoot: true },
            { string: 2, fret: 2 },
            { string: 3, fret: 0 },
            { string: 4, fret: 1 },
            { string: 5, fret: 0 },
        ]},
        A: { baseRoot: 'A', frets: [
            { string: 0, fret: 0, muted: true },
            { string: 1, fret: 0, isRoot: true },
            { string: 2, fret: 2 },
            { string: 3, fret: 2 },
            { string: 4, fret: 2 },
            { string: 5, fret: 0 },
        ]},
        G: { baseRoot: 'G', frets: [
            { string: 0, fret: 3, isRoot: true },
            { string: 1, fret: 2 },
            { string: 2, fret: 0 },
            { string: 3, fret: 0 },
            { string: 4, fret: 0 },
            { string: 5, fret: 3 },
        ]},
        E: { baseRoot: 'E', frets: [
            { string: 0, fret: 0, isRoot: true },
            { string: 1, fret: 2 },
            { string: 2, fret: 2 },
            { string: 3, fret: 1 },
            { string: 4, fret: 0 },
            { string: 5, fret: 0 },
        ]},
        D: { baseRoot: 'D', frets: [
            { string: 0, fret: 0, muted: true },
            { string: 1, fret: 0, muted: true },
            { string: 2, fret: 0, isRoot: true },
            { string: 3, fret: 2 },
            { string: 4, fret: 3 },
            { string: 5, fret: 2 },
        ]},
    };

    // Returns dots for a given CAGED letter, transposed to targetRoot, plus a
    // usable flag (false if the shape would need negative frets to fit).
    function cagedShapeDots(letter, targetRoot) {
        const shape = CAGED_SHAPES[letter];
        const baseIdx = MT.noteIndex(shape.baseRoot);
        const targetIdx = MT.noteIndex(targetRoot);
        const shift = ((targetIdx - baseIdx) % 12 + 12) % 12;

        return shape.frets.map(f => ({
            string: f.string,
            fret: f.muted ? -1 : f.fret + shift,
            isRoot: !!f.isRoot,
            muted: !!f.muted,
            label: f.isRoot ? targetRoot : '',
        }));
    }

    // Returns dots for ALL FIVE CAGED shapes at once, transposed to targetRoot
    // — each shape's six fixed chord tones (its open-position fingering),
    // moved up the neck to land on the new root, exactly like the reference
    // CAGED System tool. Notes are skipped individually if they'd fall below
    // fret 1 or past numFrets (rather than dropping the whole shape), and a
    // shape counts as "shown" as long as at least one of its tones fits.
    function cagedAllShapeDots(targetRoot, numFrets = 15) {
        const targetIdx = MT.noteIndex(targetRoot);
        const dots = [];

        Object.keys(CAGED_SHAPES).forEach(letter => {
            const shape = CAGED_SHAPES[letter];
            const baseIdx = MT.noteIndex(shape.baseRoot);
            const shift = ((targetIdx - baseIdx) % 12 + 12) % 12;

            shape.frets.forEach(f => {
                if (f.muted) return;
                const fret = f.fret + shift;
                if (fret < 0 || fret > numFrets) return;
                dots.push({
                    string: f.string,
                    fret,
                    isRoot: !!f.isRoot,
                    muted: false,
                    label: targetRoot,
                    cagedLetter: letter,
                });
            });
        });

        return dots;
    }

    // Common open chord shapes (for the chord diagram library), independent of CAGED.
    const OPEN_CHORDS = {
        'C':  [{string:0,fret:0,muted:true},{string:1,fret:3,isRoot:true},{string:2,fret:2},{string:3,fret:0},{string:4,fret:1},{string:5,fret:0}],
        'A':  [{string:0,fret:0,muted:true},{string:1,fret:0,isRoot:true},{string:2,fret:2},{string:3,fret:2},{string:4,fret:2},{string:5,fret:0}],
        'G':  [{string:0,fret:3,isRoot:true},{string:1,fret:2},{string:2,fret:0},{string:3,fret:0},{string:4,fret:0},{string:5,fret:3}],
        'E':  [{string:0,fret:0,isRoot:true},{string:1,fret:2},{string:2,fret:2},{string:3,fret:1},{string:4,fret:0},{string:5,fret:0}],
        'D':  [{string:0,fret:0,muted:true},{string:1,fret:0,muted:true},{string:2,fret:0,isRoot:true},{string:3,fret:2},{string:4,fret:3},{string:5,fret:2}],
        'Am': [{string:0,fret:0,muted:true},{string:1,fret:0,isRoot:true},{string:2,fret:2},{string:3,fret:2},{string:4,fret:1},{string:5,fret:0}],
        'Em': [{string:0,fret:0,isRoot:true},{string:1,fret:2},{string:2,fret:2},{string:3,fret:0},{string:4,fret:0},{string:5,fret:0}],
        'Dm': [{string:0,fret:0,muted:true},{string:1,fret:0,muted:true},{string:2,fret:0,isRoot:true},{string:3,fret:2},{string:4,fret:3},{string:5,fret:1}],
    };

    // Standard movable barre-chord templates, verified against the
    // well-known OPEN E and OPEN A chord families (the same shapes every
    // chord chart uses). 'b' is the barre fret — the fret the shape's
    // root note lands on. String 0 = low E, string 1 = A ('x' = muted).
    // E-SHAPE: root on the low-E string (open E family: E,Em,E7,Emaj7,Em7).
    // A-SHAPE: root on the A string (open A family: A,Am,A7,Amaj7,Am7).
    const E_SHAPE = {
        'Major':      [0, 2, 2, 1, 0, 0],
        'Minor':      [0, 2, 2, 0, 0, 0],
        'Dominant 7': [0, 2, 0, 1, 0, 0],
        'Major 7':    [0, 2, 1, 1, 0, 0],
        'Minor 7':    [0, 2, 0, 0, 0, 0],
        '5th':        [0, 2, 2, 'x', 'x', 'x'],
        'Sus2':       [0, 2, 2, 'x', 0, 2],
        'Sus4':       [0, 0, 2, 2, 0, 0],
        'Diminished': [0, 1, 2, 0, 'x', 0],
        'Augmented':  [0, 3, 2, 1, 1, 0],
    };
    const A_SHAPE = {
        'Major':      ['x', 0, 2, 2, 2, 0],
        'Minor':      ['x', 0, 2, 2, 1, 0],
        'Dominant 7': ['x', 0, 2, 0, 2, 0],
        'Major 7':    ['x', 0, 2, 1, 2, 0],
        'Minor 7':    ['x', 0, 2, 0, 1, 0],
        '5th':        ['x', 0, 2, 2, 'x', 'x'],
        'Sus2':       ['x', 0, 2, 2, 0, 0],
        'Sus4':       ['x', 0, 0, 2, 3, 0],
        'Diminished': ['x', 0, 1, 2, 1, 'x'],
        'Augmented':  ['x', 0, 3, 2, 2, 1],
    };

    // D-SHAPE: root on the D string (open D family: D,Dm,D7,Dmaj7,Dm7,
    // Dsus2, Dsus4). Only the top 4 strings are used (low E and A muted).
    const D_SHAPE = {
        'Major':      ['x', 'x', 0, 2, 3, 2],
        'Minor':      ['x', 'x', 0, 2, 3, 1],
        'Dominant 7': ['x', 'x', 0, 2, 1, 2],
        'Major 7':    ['x', 'x', 0, 2, 2, 2],
        'Minor 7':    ['x', 'x', 0, 2, 1, 1],
        'Sus2':       ['x', 'x', 0, 2, 3, 0],
        'Sus4':       ['x', 'x', 0, 2, 3, 3],
    };

    const SHAPE_TEMPLATES = { E: E_SHAPE, A: A_SHAPE, D: D_SHAPE };
    const SHAPE_OPEN_NOTE = { E: 'E', A: 'A', D: 'D' };
    const SHAPE_ROOT_STRING = { E: 0, A: 1, D: 2 };

    // Transposes an E-shape or A-shape template so its root lands on
    // targetRoot, returning per-string {fret, isRoot, muted}, or null if
    // the barre would fall below the nut.
    function transposeShape(template, rootString, targetRootIdx) {
        const openIdx = rootString === 0 ? MT.noteIndex('E') : MT.noteIndex('A');
        const b = ((targetRootIdx - openIdx) % 12 + 12) % 12;
        return template.map((v, s) => {
            if (v === 'x') return { string: s, fret: -1, muted: true };
            return { string: s, fret: v + b, isRoot: s === rootString };
        });
    }

    // Builds every playable voicing for root+chordType across the neck:
    // the open-position shape (if one exists for this exact root, from
    // OPEN_CHORDS) plus the E-shape/A-shape/D-shape movable templates
    // transposed up the neck, deduped and sorted by fret position —
    // mirroring the reference tool's "Available Voicings" chip row.
    function chordVoicings(root, chordType, numFrets = 15) {
        const rootIdx = MT.noteIndex(root);
        const voicings = [];
        const seen = new Set();

        const openKey = chordType === 'Major' ? root : chordType === 'Minor' ? root + 'm' : null;
        if (openKey && OPEN_CHORDS[openKey]) {
            const frets = OPEN_CHORDS[openKey];
            const dots = frets.map(f => f.muted ? f : { ...f, isRoot: true });
            voicings.push({ label: 'Open', shape: 'Open', barreFret: 0, dots });
            seen.add(frets.map(f => f.muted ? 'x' : f.fret).join(','));
        }

        ['E', 'A', 'D'].forEach(letter => {
            const template = SHAPE_TEMPLATES[letter][chordType];
            if (!template) return;
            const rootString = SHAPE_ROOT_STRING[letter];
            const openIdx = MT.noteIndex(SHAPE_OPEN_NOTE[letter]);
            const barre = ((rootIdx - openIdx) % 12 + 12) % 12;
            const dots = template.map((v, s) => {
                if (v === 'x') return { string: s, fret: -1, muted: true };
                // Every fretted note is marked isRoot so the fretboard
                // renders it with the plain purple "active" highlight
                // (all dots the same color), rather than only the true
                // root note being purple and the rest defaulting gold.
                return { string: s, fret: v + barre, isRoot: true, label: s === rootString ? root : '' };
            });
            if (dots.some(d => !d.muted && d.fret > numFrets)) return;

            const sig = dots.map(d => d.muted ? 'x' : d.fret).join(',');
            if (seen.has(sig)) return;
            seen.add(sig);

            voicings.push({
                label: barre === 0 ? 'Open' : `Pos. ${barre}`,
                shape: letter,
                barreFret: barre,
                dots,
            });
        });

        voicings.sort((a, b) => a.barreFret - b.barreFret);
        return voicings;
    }

    // Picks whichever of the E-shape / A-shape templates lands the barre
    // closer to the nut (matching how real chord charts present the
    // lowest, most commonly-played position for a given root).
    function movableShapeFingering(root, chordType) {
        const eTemplate = E_SHAPE[chordType];
        const aTemplate = A_SHAPE[chordType];
        if (!eTemplate && !aTemplate) return null;
        const rootIdx = MT.noteIndex(root);

        const candidates = [];
        if (eTemplate) candidates.push({ shape: transposeShape(eTemplate, 0, rootIdx), barre: ((rootIdx - MT.noteIndex('E')) % 12 + 12) % 12 });
        if (aTemplate) candidates.push({ shape: transposeShape(aTemplate, 1, rootIdx), barre: ((rootIdx - MT.noteIndex('A')) % 12 + 12) % 12 });

        candidates.sort((a, b) => a.barre - b.barre);
        return candidates[0].shape;
    }

    // Builds ONE playable fingering for an arbitrary root + chord type —
    // used by the Chord Finder (Chord Library panel) so it lights up a
    // real, single hand position on the neck (like a chord diagram)
    // instead of every occurrence of each chord tone across the whole
    // fretboard. For Major/Minor/Dominant7/Major7/Minor7/5th, this uses
    // the standard movable E-shape/A-shape barre templates above (the
    // same shapes on every chord chart). For chord types without a
    // universal textbook shape (Sus2, Sus4, Diminished, Augmented),
    // it falls back to searching every 4-fret hand span (plus open
    // strings, only usable when the hand is actually at the nut), and
    // keeps the best-covering, lowest, fullest-sounding shape that
    // actually contains the root note.
    function chordFingering(root, chordType, tuning, numFrets) {
        const movable = movableShapeFingering(root, chordType);
        if (movable) return movable;
        return searchShapeFingering(root, chordType, tuning, numFrets);
    }

    function searchShapeFingering(root, chordType, tuning, numFrets) {
        const rootIdx = MT.noteIndex(root);
        const intervals = MT.CHORD_FORMULAS[chordType];
        if (rootIdx === -1 || !intervals) return null;

        const chordTones = Array.from(new Set(intervals.map(iv => ((rootIdx + iv) % 12 + 12) % 12)));
        const openIdx = tuning.map(n => MT.noteIndex(n));
        const numStrings = tuning.length;
        const maxStart = Math.max(0, numFrets - 3);

        function bestShape(minUsed) {
            let best = null;
            for (let start = 0; start <= maxStart; start++) {
                const lo = start;
                // Open strings (fret 0) need no hand position at all, so
                // they're only valid when the hand is actually down at the
                // nut. For any higher position, only frets within reach of
                // that one hand span are candidates — otherwise we'd produce
                // "shapes" that mix an open string with frets 7+ away, which
                // no hand can physically play.
                const candidateFrets = lo === 0 ? [0, 1, 2, 3] : [lo, lo + 1, lo + 2, lo + 3];
                const perString = [];
                for (let s = 0; s < numStrings; s++) {
                    let chosen = null;
                    for (const f of candidateFrets) {
                        if (f > numFrets) continue;
                        const pc = (openIdx[s] + f) % 12;
                        if (chordTones.includes(pc)) { chosen = { fret: f, pc }; break; }
                    }
                    perString.push(chosen);
                }
                const used = perString.filter(Boolean);
                if (used.length < minUsed || !used.some(u => u.pc === rootIdx)) continue;

                const coverage = new Set(used.map(u => u.pc)).size;
                const candidate = { coverage, usedCount: used.length, start, perString };
                if (!best
                    || candidate.coverage > best.coverage
                    || (candidate.coverage === best.coverage && candidate.usedCount > best.usedCount)
                    || (candidate.coverage === best.coverage && candidate.usedCount === best.usedCount && candidate.start < best.start)) {
                    best = candidate;
                }
            }
            return best;
        }

        const best = bestShape(4) || bestShape(3) || bestShape(1);
        if (!best) return null;

        return best.perString.map((c, s) => c
            ? { string: s, fret: c.fret, isRoot: c.pc === rootIdx }
            : { string: s, fret: -1, muted: true });
    }

    // ── Capo Explorer — full open-shape chord family per CAGED letter ──
    // Every CAGED open shape (C·A·G·E·D), fretted in its 10 common
    // qualities (major, minor, dom7, maj7, min7, sus4, power/5th, sus2,
    // dim, aug). Ported 1:1 from the reference app's shape-quality fret
    // tables so the Capo Explorer's 10-chord-per-shape grid is backed by
    // real, playable fingerings (not just a transposed root name). Fret
    // arrays are string-order low-to-high (0 = low E ... 5 = high e),
    // 'x' = muted, matching CAGED_SHAPES/OPEN_CHORDS above.
    const CAPO_ROOT_STRING = { C: 1, A: 1, G: 0, E: 0, D: 2 };
    const CAPO_CHORD_SHAPES = {
        C: { '': ['x',3,2,0,1,0], m: ['x',3,5,5,4,3], 7: ['x',3,2,3,1,0], maj7: ['x',3,2,0,0,0], m7: ['x',3,5,3,4,3], sus4: ['x',3,3,0,1,3], 5: ['x',3,5,5,'x','x'], sus2: ['x',3,0,0,1,3], dim: ['x',3,4,5,4,'x'], aug: ['x',3,2,1,1,'x'] },
        D: { '': ['x','x',0,2,3,2], m: ['x','x',0,2,3,1], 7: ['x','x',0,2,1,2], maj7: ['x','x',0,2,2,2], m7: ['x','x',0,2,1,1], sus4: ['x','x',0,2,3,3], 5: ['x','x',0,2,3,'x'], sus2: ['x','x',0,2,3,0], dim: ['x','x',0,1,3,1], aug: ['x','x',0,3,3,2] },
        E: { '': [0,2,2,1,0,0], m: [0,2,2,0,0,0], 7: [0,2,0,1,0,0], maj7: [0,2,1,1,0,0], m7: [0,2,2,0,3,0], sus4: [0,2,2,2,0,0], 5: [0,2,2,'x','x','x'], sus2: [0,2,2,4,0,0], dim: [0,1,2,0,2,0], aug: [0,3,2,1,1,0] },
        G: { '': [3,2,0,0,0,3], m: [3,5,5,3,3,3], 7: [3,2,0,0,0,1], maj7: [3,2,0,0,0,2], m7: [3,5,3,3,3,3], sus4: [3,3,0,0,1,3], 5: [3,5,5,'x','x','x'], sus2: [3,0,0,0,1,3], dim: [3,4,5,3,'x','x'], aug: [3,2,1,0,'x','x'] },
        A: { '': ['x',0,2,2,2,0], m: ['x',0,2,2,1,0], 7: ['x',0,2,0,2,0], maj7: ['x',0,2,1,2,0], m7: ['x',0,2,0,1,0], sus4: ['x',0,2,2,3,0], 5: ['x',0,2,2,'x','x'], sus2: ['x',0,2,2,0,0], dim: ['x',0,1,2,1,'x'], aug: ['x',0,3,2,2,1] },
    };

    // Builds fretboard dots for a given CAGED shape + quality, capo'd up
    // by capoFret frets (a capo acts as a movable nut: every fretted note
    // shifts up, and open strings become barred at the capo fret).
    // targetRoot is the real sounding root name (already transposed),
    // used only to label the root dot.
    function capoChordDots(shapeLetter, quality, capoFret, targetRoot) {
        const frets = (CAPO_CHORD_SHAPES[shapeLetter] || {})[quality];
        if (!frets) return [];
        const rootString = CAPO_ROOT_STRING[shapeLetter];
        return frets.map((f, string) => {
            if (f === 'x') return { string, fret: -1, muted: true };
            return {
                string,
                fret: f + capoFret,
                isRoot: string === rootString,
                muted: false,
                label: string === rootString ? targetRoot : '',
                cagedLetter: shapeLetter,
            };
        });
    }

    return { CAGED_SHAPES, cagedShapeDots, cagedAllShapeDots, OPEN_CHORDS, chordFingering, movableShapeFingering, searchShapeFingering, chordVoicings, CAPO_CHORD_SHAPES, CAPO_ROOT_STRING, capoChordDots };
})();
