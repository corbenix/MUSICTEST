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
            { name: 'I – V – vi – IV',   degrees: [0, 4, 5, 3], tag: 'Pop / Rock Classic', desc: 'The most popular progression in modern music.' },
            { name: 'I – IV – V',        degrees: [0, 3, 4],    tag: 'Rock / Blues Staple', desc: 'The three-chord backbone of rock, blues, and folk.' },
            { name: 'ii – V – I',        degrees: [1, 4, 0],    tag: 'Jazz Standard',       desc: 'The essential jazz cadence, found in countless standards.' },
            { name: 'vi – IV – I – V',   degrees: [5, 3, 0, 4], tag: 'Emotional Pop',       desc: 'A wistful variant of the classic loop, big in 2000s pop.' },
            { name: 'I – vi – IV – V',   degrees: [0, 5, 3, 4], tag: '50s Doo-Wop',         desc: 'The doo-wop progression behind countless oldies.' },
        ],
        'minor': [
            { name: 'i – VI – III – VII', degrees: [0, 5, 2, 6], tag: 'Epic / Cinematic', desc: 'A dramatic, driving loop common in rock and film scores.' },
            { name: 'i – iv – v',         degrees: [0, 3, 4],    tag: 'Minor Blues',      desc: 'The minor-key counterpart to the classic I–IV–V.' },
            { name: 'i – VII – VI',       degrees: [0, 6, 5],    tag: 'Andalusian-lite',  desc: 'A descending, moody progression common in rock.' },
            { name: 'i – iv – VII – III', degrees: [0, 3, 6, 2], tag: 'Folk / Ballad',    desc: 'A gentle, circular progression found in folk and ballads.' },
        ],
    };

    return { MAJOR_DIATONIC, MINOR_DIATONIC, PROGRESSIONS };
})();
