// Piano key layout data — 2 octaves, C to C.
window.KeyboardData = (function () {
    // Each white key in order, with the black key that follows it (or null).
    const OCTAVE_PATTERN = [
        { note: 'C',  hasSharp: true  },
        { note: 'D',  hasSharp: true  },
        { note: 'E',  hasSharp: false },
        { note: 'F',  hasSharp: true  },
        { note: 'G',  hasSharp: true  },
        { note: 'A',  hasSharp: true  },
        { note: 'B',  hasSharp: false },
    ];

    const SHARP_OF = { C: 'C#', D: 'D#', F: 'F#', G: 'G#', A: 'A#' };

    // Builds a flat list of keys across `octaves` octaves starting at C.
    function buildKeys(octaves = 2) {
        const keys = [];
        for (let o = 0; o < octaves; o++) {
            OCTAVE_PATTERN.forEach(({ note, hasSharp }) => {
                keys.push({ note, octave: o, type: 'white' });
                if (hasSharp) {
                    keys.push({ note: SHARP_OF[note], octave: o, type: 'black' });
                }
            });
        }
        keys.push({ note: 'C', octave: octaves, type: 'white' }); // trailing C
        return keys;
    }

    return { buildKeys };
})();
