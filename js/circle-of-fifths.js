// Shared Circle of Fifths widget. Injects itself into #circle-of-fifths-mount
// on any page that includes this script (after music-theory.js).
(function () {
    const MT = window.MusicTheory;
    if (!MT) return;
    const mount = document.getElementById('circle-of-fifths-mount');
    if (!mount) return;

    const CIRCLE_MAJOR = ['C','G','D','A','E','B','F#','C#','G#','D#','A#','F'];
    const CIRCLE_MINOR = ['Am','Em','Bm','F#m','C#m','G#m','D#m','A#m','Fm','Cm','Gm','Dm'];

    const MAJOR_DIATONIC = [
        { numeral: 'I',    degree: 0, quality: 'Major' },
        { numeral: 'ii',   degree: 1, quality: 'Minor' },
        { numeral: 'iii',  degree: 2, quality: 'Minor' },
        { numeral: 'IV',   degree: 3, quality: 'Major' },
        { numeral: 'V',    degree: 4, quality: 'Major' },
        { numeral: 'vi',   degree: 5, quality: 'Minor' },
        { numeral: 'vii°', degree: 6, quality: 'Diminished' },
    ];

    const STORAGE_ROOT_KEY = 'cof-selected-root';
    const STORAGE_COLLAPSED_KEY = 'cof-collapsed';

    // Sharp → flat spelling for the circle's own display toggle. This is
    // purely cosmetic (which glyph is shown for the same 12 positions) and
    // is intentionally separate from the root-picker's ♮/♯/♭ pill logic
    // elsewhere on the site — it does not touch note selection, storage,
    // or scale/chord computation.
    const COF_FLAT_EQUIV = { 'F#': 'Gb', 'C#': 'Db', 'G#': 'Ab', 'D#': 'Eb', 'A#': 'Bb' };
    let cofUseFlats = false;

    function cofDisplayName(name) {
        if (!cofUseFlats) return name;
        const m = name.match(/^([A-G]#)(.*)$/);
        if (!m) return name;
        return (COF_FLAT_EQUIV[m[1]] || m[1]) + m[2];
    }

    function loadRoot() {
        // Always land on C by default when the page loads; the selected
        // key still updates live as the user clicks around the circle,
        // it just isn't restored/persisted across visits.
        return 'C';
    }
    function saveRoot(root) { /* intentionally not persisted — always start on C */ }
    function loadCollapsed() {
        try {
            const saved = localStorage.getItem(STORAGE_COLLAPSED_KEY);
            return saved === null ? true : saved === 'true'; // collapsed by default
        } catch (e) { return true; }
    }
    function saveCollapsed(val) {
        try { localStorage.setItem(STORAGE_COLLAPSED_KEY, String(val)); } catch (e) { /* storage unavailable */ }
    }

    let collapsed = loadCollapsed();
    let activeRoot = loadRoot();

    mount.innerHTML = `
        <section class="circle-section${collapsed ? ' is-collapsed' : ''}" id="cof-section">
            <div class="circle-header" id="cof-header-toggle">
                <div class="circle-header-title">
                    <h3>🎼 Circle of Fifths</h3>
                    <p>Click a key to explore its diatonic chords.</p>
                </div>
                <div class="circle-header-actions">
                    <button type="button" class="circle-toggle-btn${collapsed ? ' is-collapsed' : ''}" id="cof-toggle-btn" aria-label="${collapsed ? 'Expand' : 'Collapse'} Circle of Fifths">▾</button>
                </div>
            </div>
            <div class="circle-body-outer${collapsed ? ' collapsed' : ''}" id="cof-body-outer">
                <div class="circle-body">
                    <div class="circle-container">
                        <svg class="circle-svg" id="cof-svg" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"></svg>
                        <div class="circle-center-hub">
                            <div class="circle-center-label">Key of</div>
                            <div class="circle-center-value" id="cof-center-value">C Major</div>
                        </div>
                    </div>
                    <div class="circle-legend-panel">
                        <div class="circle-title-block">
                            <div class="circle-title-text">
                                <h3 id="cof-legend-title">C Major Diatonic Chords</h3>
                                <p>The 7 chords built from the C Major scale.</p>
                            </div>
                            <button type="button" class="cof-sf-toggle" id="cof-sf-toggle" data-mode="sharp" aria-label="Show flat spellings on the circle">♯</button>
                        </div>
                        <div class="diatonic-grid-top" id="cof-diatonic-top"></div>
                        <div class="diatonic-grid-bottom" id="cof-diatonic-bottom"></div>
                        <div class="scale-info-row">
                            <span class="scale-info-icon">ⓘ</span>
                            <span class="scale-info-text">These chords belong to the <span id="cof-scale-name">C Major</span> scale:<br/>
                            <span class="scale-info-notes" id="cof-scale-notes"></span></span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;

    const svg = mount.querySelector('#cof-svg');
    const toggleBtn = mount.querySelector('#cof-toggle-btn');
    const sfToggleBtn = mount.querySelector('#cof-sf-toggle');
    const headerToggle = mount.querySelector('#cof-header-toggle');
    const sectionEl = mount.querySelector('#cof-section');
    const bodyOuter = mount.querySelector('#cof-body-outer');
    const centerValue = mount.querySelector('#cof-center-value');
    const legendTitle = mount.querySelector('#cof-legend-title');
    const diatonicTop = mount.querySelector('#cof-diatonic-top');
    const diatonicBottom = mount.querySelector('#cof-diatonic-bottom');
    const scaleName = mount.querySelector('#cof-scale-name');
    const scaleNotes = mount.querySelector('#cof-scale-notes');

    function buildWheel() {
        const S = 150, rOuter = 142, rInner = 78;
        let markup = '';

        for (let i = 0; i < 12; i++) {
            const startDeg = i * 30;
            const endDeg = (i + 1) * 30;
            const startRad = Math.PI * startDeg / 180;
            const endRad = Math.PI * endDeg / 180;

            const x1 = S + rInner * Math.cos(startRad);
            const y1 = S + rInner * Math.sin(startRad);
            const x2 = S + rOuter * Math.cos(startRad);
            const y2 = S + rOuter * Math.sin(startRad);
            const x3 = S + rOuter * Math.cos(endRad);
            const y3 = S + rOuter * Math.sin(endRad);
            const x4 = S + rInner * Math.cos(endRad);
            const y4 = S + rInner * Math.sin(endRad);

            const d = `M ${x1} ${y1} L ${x2} ${y2} A ${rOuter} ${rOuter} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${rInner} ${rInner} 0 0 0 ${x1} ${y1} Z`;

            const midDeg = startDeg + 15;
            const midRad = Math.PI * midDeg / 180;
            const majorX = S + (rOuter - 20) * Math.cos(midRad);
            const majorY = S + (rOuter - 20) * Math.sin(midRad) + 5;
            const minorX = S + (rInner + 16) * Math.cos(midRad);
            const minorY = S + (rInner + 16) * Math.sin(midRad) + 4;

            markup += `
                <g>
                    <path class="circle-sector" data-major="${CIRCLE_MAJOR[i]}" data-minor="${CIRCLE_MINOR[i]}" id="slice-${i}" d="${d}"></path>
                    <text class="circle-text" x="${majorX}" y="${majorY}" text-anchor="middle">${cofDisplayName(CIRCLE_MAJOR[i])}</text>
                    <text class="circle-text-minor" x="${minorX}" y="${minorY}" text-anchor="middle">${cofDisplayName(CIRCLE_MINOR[i])}</text>
                </g>
            `;
        }
        svg.innerHTML = markup;

        svg.querySelectorAll('.circle-sector').forEach(sector => {
            sector.addEventListener('click', () => selectRoot(sector.dataset.major));
        });
    }

    function selectRoot(root) {
        activeRoot = root;
        saveRoot(root);
        svg.querySelectorAll('.circle-sector').forEach(s => {
            s.classList.toggle('active-root', s.dataset.major === root);
        });
        renderDiatonic(root);
    }

    function renderDiatonic(root) {
        const preferFlats = MT.PREFERS_FLATS.has(root);
        const scale = MT.scaleNotes(root, 'Major (Ionian)', preferFlats);

        centerValue.textContent = cofDisplayName(root) + ' Major';
        legendTitle.textContent = cofDisplayName(root) + ' Major Diatonic Chords';
        scaleName.textContent = cofDisplayName(root) + ' Major';
        scaleNotes.textContent = scale.map(cofDisplayName).join(' - ') + ' - ' + cofDisplayName(scale[0]);

        const chords = MAJOR_DIATONIC.map(entry => {
            const chordRoot = cofDisplayName(scale[entry.degree]);
            return {
                numeral: entry.numeral,
                quality: entry.quality,
                root: chordRoot,
                display: entry.quality === 'Diminished' ? chordRoot + 'dim' : (entry.quality === 'Minor' ? chordRoot + 'm' : chordRoot),
            };
        });

        function cardHtml(c, index) {
            const qClass = c.quality === 'Major' ? 'is-major' : (c.quality === 'Minor' ? 'is-minor' : 'is-dim');
            const tonicClass = index === 0 ? ' tonic-card' : '';
            return `
                <div class="diatonic-card ${qClass}${tonicClass}">
                    <div class="roman">${c.numeral}</div>
                    <div class="chord-name">${c.display}</div>
                    <div class="chord-quality">${c.quality}</div>
                </div>
            `;
        }

        diatonicTop.innerHTML = chords.slice(0, 3).map((c, i) => cardHtml(c, i)).join('');
        diatonicBottom.innerHTML = chords.slice(3, 7).map((c, i) => cardHtml(c, i + 3)).join('');
    }

    function toggleCollapse() {
        collapsed = !collapsed;
        saveCollapsed(collapsed);
        sectionEl.classList.toggle('is-collapsed', collapsed);
        bodyOuter.classList.toggle('collapsed', collapsed);
        toggleBtn.classList.toggle('is-collapsed', collapsed);
        toggleBtn.setAttribute('aria-label', collapsed ? 'Expand Circle of Fifths' : 'Collapse Circle of Fifths');
    }
    toggleBtn.addEventListener('click', e => { e.stopPropagation(); toggleCollapse(); });
    headerToggle.addEventListener('click', toggleCollapse);

    sfToggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        cofUseFlats = !cofUseFlats;
        sfToggleBtn.dataset.mode = cofUseFlats ? 'flat' : 'sharp';
        sfToggleBtn.textContent = cofUseFlats ? '♭' : '♯';
        sfToggleBtn.setAttribute('aria-label', cofUseFlats ? 'Show sharp spellings' : 'Show flat spellings');
        buildWheel();
        selectRoot(activeRoot);
    });

    buildWheel();
    selectRoot(activeRoot);
})();
