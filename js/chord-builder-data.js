// Diatonic chord qualities for major/minor keys, and common progression templates.
window.ChordBuilderData = (function () {
    // Roman numeral -> {scaleDegree (0-indexed), quality}
    const MAJOR_DIATONIC = [
        { numeral: 'I',   degree: 0, quality: 'Major' },
        { numeral: 'ii',  degree: 1, quality: 'Minor' },
        { numeral: 'iii', degree: 2, quality: 'Minor' },
        { numeral: 'IV',  degree: 3, quality: 'Major' },
        { numeral: 'V',   degree: 4, quality: 'Major' },
        { numeral: 'vi',  degree: 5, quality: 'Minor' },
        { numeral: 'vii°',degree: 6, quality: 'Diminished' },
    ];

    const MINOR_DIATONIC = [
        { numeral: 'i',    degree: 0, quality: 'Minor' },
        { numeral: 'ii°',  degree: 1, quality: 'Diminished' },
        { numeral: 'III',  degree: 2, quality: 'Major' },
        { numeral: 'iv',   degree: 3, quality: 'Minor' },
        { numeral: 'v',    degree: 4, quality: 'Minor' },
        { numeral: 'VI',   degree: 5, quality: 'Major' },
        { numeral: 'VII',  degree: 6, quality: 'Major' },
    ];

    // Common progressions expressed as scale-degree indices (0-indexed, into
    // the 7 diatonic chords above).
    const PROGRESSIONS = {
        'major': [
            { name: 'I – V – vi – IV',   degrees: [0, 4, 5, 3] },
            { name: 'I – IV – V',        degrees: [0, 3, 4] },
            { name: 'ii – V – I',        degrees: [1, 4, 0] },
            { name: 'vi – IV – I – V',   degrees: [5, 3, 0, 4] },
            { name: 'I – vi – IV – V',   degrees: [0, 5, 3, 4] },
        ],
        'minor': [
            { name: 'i – VI – III – VII', degrees: [0, 5, 2, 6] },
            { name: 'i – iv – v',         degrees: [0, 3, 4] },
            { name: 'i – VII – VI',       degrees: [0, 6, 5] },
            { name: 'i – iv – VII – III', degrees: [0, 3, 6, 2] },
        ],
    };

    return { MAJOR_DIATONIC, MINOR_DIATONIC, PROGRESSIONS };
})();
