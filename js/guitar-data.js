// CAGED shape templates. Each is the OPEN-position major chord shape for that
// letter, expressed as {string, fret, isRoot} (string 0 = low E). Moving a
// shape to a new root = shift every fret by (targetRootIndex - baseRootIndex).
window.GuitarData = (function () {
    const MT = window.MusicTheory;

    const CAGED_SHAPES = {
        C: { baseRoot: 'C', frets: [
            { string: 4, fret: 3, isRoot: true },  // A string
            { string: 3, fret: 2 },                // D string
            { string: 2, fret: 0 },                // G string
            { string: 1, fret: 1 },                // B string
            { string: 0, fret: 0, muted: true },    // low E muted
            { string: 5, fret: 0 },                 // high e
        ]},
        A: { baseRoot: 'A', frets: [
            { string: 4, fret: 0, isRoot: true },
            { string: 3, fret: 2 },
            { string: 2, fret: 2 },
            { string: 1, fret: 2 },
            { string: 5, fret: 0 },
            { string: 0, fret: 0, muted: true },
        ]},
        G: { baseRoot: 'G', frets: [
            { string: 0, fret: 3, isRoot: true },
            { string: 4, fret: 2 },
            { string: 3, fret: 0 },
            { string: 2, fret: 0 },
            { string: 1, fret: 0 },
            { string: 5, fret: 3 },
        ]},
        E: { baseRoot: 'E', frets: [
            { string: 0, fret: 0, isRoot: true },
            { string: 4, fret: 2 },
            { string: 3, fret: 2 },
            { string: 2, fret: 1 },
            { string: 1, fret: 0 },
            { string: 5, fret: 0 },
        ]},
        D: { baseRoot: 'D', frets: [
            { string: 3, fret: 0, isRoot: true },
            { string: 2, fret: 2 },
            { string: 1, fret: 3 },
            { string: 5, fret: 2 },
            { string: 4, fret: 0, muted: true },
            { string: 0, fret: 0, muted: true },
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

    // Common open chord shapes (for the chord diagram library), independent of CAGED.
    const OPEN_CHORDS = {
        'C':  [{string:4,fret:3,isRoot:true},{string:3,fret:2},{string:2,fret:0},{string:1,fret:1},{string:0,fret:0,muted:true},{string:5,fret:0}],
        'A':  [{string:4,fret:0,isRoot:true},{string:3,fret:2},{string:2,fret:2},{string:1,fret:2},{string:5,fret:0},{string:0,fret:0,muted:true}],
        'G':  [{string:0,fret:3,isRoot:true},{string:4,fret:2},{string:3,fret:0},{string:2,fret:0},{string:1,fret:0},{string:5,fret:3}],
        'E':  [{string:0,fret:0,isRoot:true},{string:4,fret:2},{string:3,fret:2},{string:2,fret:1},{string:1,fret:0},{string:5,fret:0}],
        'D':  [{string:3,fret:0,isRoot:true},{string:2,fret:2},{string:1,fret:3},{string:5,fret:2},{string:4,fret:0,muted:true},{string:0,fret:0,muted:true}],
        'Am': [{string:4,fret:0,isRoot:true},{string:3,fret:2},{string:2,fret:2},{string:1,fret:1},{string:5,fret:0},{string:0,fret:0,muted:true}],
        'Em': [{string:0,fret:0,isRoot:true},{string:4,fret:2},{string:3,fret:2},{string:2,fret:0},{string:1,fret:0},{string:5,fret:0}],
        'Dm': [{string:3,fret:0,isRoot:true},{string:2,fret:2},{string:1,fret:3},{string:5,fret:1},{string:4,fret:0,muted:true},{string:0,fret:0,muted:true}],
    };

    return { CAGED_SHAPES, cagedShapeDots, OPEN_CHORDS };
})();
