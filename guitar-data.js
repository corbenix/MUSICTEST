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
        'C':  [{string:4,fret:3,isRoot:true},{string:3,fret:2},{string:2,fret:0},{string:1,fret:1},{string:0,fret:0,muted:true},{string:5,fret:0}],
        'A':  [{string:4,fret:0,isRoot:true},{string:3,fret:2},{string:2,fret:2},{string:1,fret:2},{string:5,fret:0},{string:0,fret:0,muted:true}],
        'G':  [{string:0,fret:3,isRoot:true},{string:4,fret:2},{string:3,fret:0},{string:2,fret:0},{string:1,fret:0},{string:5,fret:3}],
        'E':  [{string:0,fret:0,isRoot:true},{string:4,fret:2},{string:3,fret:2},{string:2,fret:1},{string:1,fret:0},{string:5,fret:0}],
        'D':  [{string:3,fret:0,isRoot:true},{string:2,fret:2},{string:1,fret:3},{string:5,fret:2},{string:4,fret:0,muted:true},{string:0,fret:0,muted:true}],
        'Am': [{string:4,fret:0,isRoot:true},{string:3,fret:2},{string:2,fret:2},{string:1,fret:1},{string:5,fret:0},{string:0,fret:0,muted:true}],
        'Em': [{string:0,fret:0,isRoot:true},{string:4,fret:2},{string:3,fret:2},{string:2,fret:0},{string:1,fret:0},{string:5,fret:0}],
        'Dm': [{string:3,fret:0,isRoot:true},{string:2,fret:2},{string:1,fret:3},{string:5,fret:1},{string:4,fret:0,muted:true},{string:0,fret:0,muted:true}],
    };

    return { CAGED_SHAPES, cagedShapeDots, cagedAllShapeDots, OPEN_CHORDS };
})();
