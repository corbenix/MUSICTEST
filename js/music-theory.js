// Shared music theory data used by every instrument page.
window.MusicTheory = (function () {
    const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

    const SCALES = {
        'Major (Ionian)':        [0,2,4,5,7,9,11],
        'Natural Minor (Aeolian)': [0,2,3,5,7,8,10],
        'Dorian':                 [0,2,3,5,7,9,10],
        'Phrygian':                [0,1,3,5,7,8,10],
        'Lydian':                  [0,2,4,6,7,9,11],
        'Mixolydian':              [0,2,4,5,7,9,10],
        'Locrian':                 [0,1,3,5,6,8,10],
        'Major Pentatonic':        [0,2,4,7,9],
        'Minor Pentatonic':        [0,3,5,7,10],
        'Blues':                   [0,3,5,6,7,10],
        'Harmonic Minor':          [0,2,3,5,7,8,11],
        'Melodic Minor':           [0,2,3,5,7,9,11],
    };

    const CHORD_FORMULAS = {
        'Major':        [0,4,7],
        'Minor':        [0,3,7],
        'Diminished':   [0,3,6],
        'Augmented':    [0,4,8],
        'Sus2':         [0,2,7],
        'Sus4':         [0,5,7],
        'Major 7':      [0,4,7,11],
        'Minor 7':      [0,3,7,10],
        'Dominant 7':   [0,4,7,10],
        'Minor 7♭5':    [0,3,6,10],
        'Diminished 7': [0,3,6,9],
        'Add9':         [0,4,7,14],
        '5th':          [0,7],
    };

    function noteName(semitoneFromC, preferFlats) {
        const table = preferFlats ? NOTES_FLAT : NOTES_SHARP;
        return table[((semitoneFromC % 12) + 12) % 12];
    }

    function noteIndex(name) {
        let i = NOTES_SHARP.indexOf(name);
        if (i === -1) i = NOTES_FLAT.indexOf(name);
        return i;
    }

    function scaleNotes(root, scaleName, preferFlats) {
        const rootIdx = noteIndex(root);
        const intervals = SCALES[scaleName];
        if (rootIdx === -1 || !intervals) return [];
        return intervals.map(iv => noteName(rootIdx + iv, preferFlats));
    }

    function chordNotes(root, chordName, preferFlats) {
        const rootIdx = noteIndex(root);
        const intervals = CHORD_FORMULAS[chordName];
        if (rootIdx === -1 || !intervals) return [];
        return intervals.map(iv => noteName(rootIdx + iv, preferFlats));
    }

    const PREFERS_FLATS = new Set(['F','Bb','Eb','Ab','Db','Gb','Cb','Dm','Gm','Cm','Fm','Bbm','Ebm']);

    // Semitones-from-root -> scale degree label, used by the "Scale Notes"
    // pill card so every scale (not just major/minor) gets a correct number.
    const DEGREE_LABELS = ['1','♭2','2','♭3','3','4','♭5','5','♭6','6','♭7','7'];
    function degreeLabel(semitonesFromRoot) {
        return DEGREE_LABELS[((semitonesFromRoot % 12) + 12) % 12];
    }

    // Builds the {note, degree, isRoot} list the scale pill card needs,
    // straight from a scale's interval formula.
    function scaleDegrees(root, scaleName, preferFlats) {
        const rootIdx = noteIndex(root);
        const intervals = SCALES[scaleName];
        if (rootIdx === -1 || !intervals) return [];
        return intervals.map((iv, i) => ({
            note: noteName(rootIdx + iv, preferFlats),
            degree: degreeLabel(iv),
            isRoot: i === 0,
        }));
    }

    // Reverse of chordNotes(): given a set of currently-sounding note
    // names (any octave, duplicates/enharmonics fine), figures out which
    // root + chord-type formula they match, if any. Used to auto-detect
    // a chord from notes played on the piano (click or computer-keyboard
    // input) rather than picked explicitly in the Chord Finder.
    //
    // Matching is exact: the played pitch-classes (deduped) must equal a
    // formula's interval set exactly, for some root. Ties are resolved
    // by preferring whichever candidate root the lowest played note
    // actually belongs to (the bass note), then by formula order above.
    function detectChord(playedNotes, preferFlats) {
        if (!playedNotes || playedNotes.length < 2) return null;
        const pitchClasses = Array.from(new Set(playedNotes.map(n => noteIndex(n)))).filter(i => i !== -1);
        if (pitchClasses.length < 2) return null;

        const lowestIdx = noteIndex(playedNotes[0]);

        let candidates = [];
        for (let root = 0; root < 12; root++) {
            const relative = pitchClasses.map(pc => ((pc - root) + 12) % 12).sort((a, b) => a - b);
            for (const chordName in CHORD_FORMULAS) {
                const formula = CHORD_FORMULAS[chordName].map(iv => iv % 12).sort((a, b) => a - b);
                if (relative.length === formula.length && relative.every((v, i) => v === formula[i])) {
                    candidates.push({ root, chordName });
                }
            }
        }
        if (!candidates.length) return null;

        const bassMatch = candidates.find(c => c.root === lowestIdx);
        const chosen = bassMatch || candidates[0];
        return { root: noteName(chosen.root, preferFlats), chordName: chosen.chordName };
    }

    return {
        NOTES_SHARP, NOTES_FLAT, SCALES, CHORD_FORMULAS,
        noteName, noteIndex, scaleNotes, chordNotes, PREFERS_FLATS,
        degreeLabel, scaleDegrees, detectChord,
    };
})();
