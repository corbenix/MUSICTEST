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

    // Chords borrowed from outside the 7 diatonic chords of the key — e.g.
    // ♭VII and ♭VI borrowed into a Major key from the parallel Aeolian/minor
    // scale (common in math rock and alt-rock). Expressed as a semitone
    // offset from the key's tonic, since these aren't scale-degree indices
    // into MAJOR_DIATONIC/MINOR_DIATONIC like ordinary progression steps.
    const BORROWED_CHORDS = {
        'bIII': { semitone: 3,  quality: 'Major' },
        'bVI':  { semitone: 8,  quality: 'Major' },
        'bVII': { semitone: 10, quality: 'Major' },
    };

    // Common progressions expressed as scale-degree indices (0-indexed, into
    // the 7 diatonic chords above). A string key instead of a number (e.g.
    // 'bVII') looks up a borrowed chord in BORROWED_CHORDS instead.
    const PROGRESSIONS = {
        'major': [
            { name: 'I – V – vi – IV',   degrees: [0, 4, 5, 3], tag: 'Pop / Rock Classic', genre: 'Pop', desc: 'The most popular progression in modern music.' },
            { name: 'I – IV – V',        degrees: [0, 3, 4],    tag: 'Rock / Blues Staple', genre: 'Rock / Blues', desc: 'The three-chord backbone of rock, blues, and folk.' },
            { name: 'ii – V – I',        degrees: [1, 4, 0],    tag: 'Jazz Standard',       genre: 'Jazz', desc: 'The essential jazz cadence, found in countless standards.' },
            { name: 'vi – IV – I – V',   degrees: [5, 3, 0, 4], tag: 'Emotional Pop',       genre: 'Pop', desc: 'A wistful variant of the classic loop, big in 2000s pop.' },
            { name: 'I – vi – IV – V',   degrees: [0, 5, 3, 4], tag: '50s Doo-Wop',         genre: 'Pop', desc: 'The doo-wop progression behind countless oldies.' },
            { name: 'I – IV – vi – V',   degrees: [0, 3, 5, 4], tag: 'Uplifting Pop',       genre: 'Pop', desc: 'A brighter reordering of the I–vi–IV–V loop.' },
            { name: 'I – V – IV',        degrees: [0, 4, 3],    tag: 'Anthemic Rock',       genre: 'Rock / Blues', desc: 'A driving three-chord loop heard across arena rock.' },
            { name: 'I – iii – IV – V',  degrees: [0, 2, 3, 4], tag: 'Classic Pop',         genre: 'Pop', desc: 'A stepwise climb that adds a wistful lift before resolving.' },
            { name: 'vi – V – IV – V',   degrees: [5, 4, 3, 4], tag: 'Ballad',              genre: 'Pop', desc: 'A gently rocking progression common in slow ballads.' },
            { name: 'I – IV – I – V',    degrees: [0, 3, 0, 4], tag: 'Folk / Campfire',     genre: 'Folk / Country', desc: 'A simple, singable loop built on the two strongest chords.' },
            { name: 'I – ii – IV – V',   degrees: [0, 1, 3, 4], tag: 'Bright Pop',          genre: 'Pop', desc: 'A cheerful climb that passes through the supertonic on the way up.' },
            { name: 'I – vi – ii – V',   degrees: [0, 5, 1, 4], tag: 'Jazz-Pop Turnaround', genre: 'Jazz', desc: 'A smooth turnaround that cycles back to the tonic every four bars.' },
            { name: 'I – V – vi – iii – IV', degrees: [0, 4, 5, 2, 3], tag: "Pachelbel's Canon", genre: 'Classical', desc: "The descending-bass loop behind Pachelbel's Canon in D." },
            { name: 'IV – V – iii – vi', degrees: [3, 4, 2, 5], tag: 'Anime / J-Pop',       genre: 'Anime / J-Pop', desc: 'The quintessential anime and J-pop emotional progression.' },
            { name: 'I – V – vi – iii – IV – I – IV – V', degrees: [0, 4, 5, 2, 3, 0, 3, 4], tag: 'Anime Buildup', genre: 'Anime / J-Pop', desc: 'An extended eight-chord buildup loop popular in anime scores.' },
            { name: 'I – iii – IV – I',  degrees: [0, 2, 3, 0], tag: 'Indie Rock',          genre: 'Indie / Alt', desc: 'A stepwise indie-rock staple that keeps circling back to the tonic.' },
            { name: 'I – iii – vi – IV', degrees: [0, 2, 5, 3], tag: 'Dreamy Indie',        genre: 'Indie / Alt', desc: 'A wistful, drifting loop common in dream-pop and indie.' },
            { name: 'I – V – IV – V',    degrees: [0, 4, 3, 4], tag: 'Country Turnaround',  genre: 'Folk / Country', desc: 'A back-and-forth turnaround common in country and Americana.' },
            { name: 'I – ♭VII – IV – I', degrees: [0, 'bVII', 3, 0], tag: 'Math Rock / Alt', genre: 'Math Rock', desc: 'A ♭VII borrowed from the parallel minor gives this loop its edgy, off-kilter pull.' },
            { name: 'ii – IV – ♭VII – I', degrees: [1, 3, 'bVII', 0], tag: 'Math Rock',       genre: 'Math Rock', desc: 'A more complex math-rock loop that resolves through a borrowed ♭VII.' },
            { name: 'I – ♭VII – ♭VI – ♭VII', degrees: [0, 'bVII', 'bVI', 'bVII'], tag: 'Hypnotic Math Rock', genre: 'Math Rock', desc: 'A hypnotic, riff-like loop built almost entirely from borrowed chords.' },
        ],
        'minor': [
            { name: 'i – VI – III – VII', degrees: [0, 5, 2, 6], tag: 'Epic / Cinematic', genre: 'Cinematic', desc: 'A dramatic, driving loop common in rock and film scores.' },
            { name: 'i – iv – v',         degrees: [0, 3, 4],    tag: 'Minor Blues',      genre: 'Rock / Blues', desc: 'The minor-key counterpart to the classic I–IV–V.' },
            { name: 'i – VII – VI',       degrees: [0, 6, 5],    tag: 'Andalusian-lite',  genre: 'Rock / Blues', desc: 'A descending, moody progression common in rock.' },
            { name: 'i – iv – VII – III', degrees: [0, 3, 6, 2], tag: 'Folk / Ballad',    genre: 'Folk / Country', desc: 'A gentle, circular progression found in folk and ballads.' },
            { name: 'i – VI – VII',       degrees: [0, 5, 6],    tag: 'Anthemic Minor',   genre: 'Rock / Blues', desc: 'A rising, hopeful loop that still stays rooted in minor.' },
            { name: 'i – v – VI – IV',    degrees: [0, 4, 5, 3], tag: 'Cinematic Pop',    genre: 'Cinematic', desc: 'A moody, atmospheric progression popular in film and pop.' },
            { name: 'i – III – VII – VI', degrees: [0, 2, 6, 5], tag: 'Alt / Indie',      genre: 'Indie / Alt', desc: 'A wandering, wistful loop favored in indie and alt-rock.' },
            { name: 'i – iv – i – V',     degrees: [0, 3, 0, 4], tag: 'Minor Cadence',    genre: 'Classical', desc: 'A simple loop that resolves with a strong dominant pull.' },
            { name: 'i – VII – VI – VII', degrees: [0, 6, 5, 6], tag: 'Rock Anthem',      genre: 'Rock / Blues', desc: 'A descending-then-rising loop common in minor-key rock anthems.' },
            { name: 'i – VI – VII – i',   degrees: [0, 5, 6, 0], tag: 'Aeolian Power',    genre: 'Anime / J-Pop', desc: 'A driving natural-minor loop that resolves firmly back to the tonic.' },
            { name: 'ii° – v – i',        degrees: [1, 4, 0],    tag: 'Minor Jazz Cadence', genre: 'Jazz', desc: "The minor-key counterpart to jazz's ii–V–I turnaround." },
            { name: 'i – v – VI – VII',   degrees: [0, 4, 5, 6], tag: 'Ascending Minor',  genre: 'Rock / Blues', desc: 'A steadily climbing loop that builds tension toward the VII.' },
            { name: 'i – VII – VI – v',   degrees: [0, 6, 5, 4], tag: 'Andalusian Cadence', genre: 'Classical', desc: 'The classic descending Andalusian cadence, resolving on the v.' },
            { name: 'i – VI – III – VI',  degrees: [0, 5, 2, 5], tag: 'Circular Minor',   genre: 'Indie / Alt', desc: 'A circular loop that keeps returning to the VI.' },
            { name: 'i – iv – i – VII',   degrees: [0, 3, 0, 6], tag: 'Metal Riff',       genre: 'Metal', desc: 'A heavy, riff-driven loop common in classic metal.' },
            { name: 'i – III – iv – VII', degrees: [0, 2, 3, 6], tag: 'Math Rock Minor',  genre: 'Math Rock', desc: 'An angular minor-key loop favored in math rock.' },
        ],
    };

    return { MAJOR_DIATONIC, MINOR_DIATONIC, PROGRESSIONS, BORROWED_CHORDS };
})();
