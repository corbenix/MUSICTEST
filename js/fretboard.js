// Guitar-only fretboard renderer (used by guitar.html's Scale Explorer,
// CAGED, and Chord Library panels). Fully independent from js/bass.js /
// css/bass.css — every class this file writes is namespaced "gtr-" so
// nothing here can collide with, or be affected by, the Bass page.
//
// Visual design ported from css/bass.css's hand-built board: a wood/blue
// neck with a string label + nut per row, a real fret-dot on every
// fret, and a fret-inlay marker row underneath.
window.Fretboard = (function () {
    const MT = window.MusicTheory;
    const FRET_MARKERS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
    const DOUBLE_MARKERS = new Set([12, 24]);

    // tuning: array of open-string note names, LOW to HIGH (e.g. ['E','A','D','G','B','E'])
    // numFrets: how many frets to draw
    // highlight: { notes: [...], root: 'C', preferFlats: bool } — "explorer" mode:
    //            every fret gets a note-labeled dot, lit up when it matches.
    // dots: explicit shape markers [{string, fret, label, isRoot, muted, cagedLetter}] —
    //       "diagram" mode: only the given frets get a dot, everything else stays bare wood.
    // openOctaves: optional array (same length/order as tuning) giving each open string's
    //              real octave (e.g. [2,2,3,3,3,4] for standard guitar tuning). When given,
    //              every cell is stamped with its true absolute pitch in data-abs, so a
    //              caller can wire up click-to-play without recomputing string/fret math.
    function render(container, { tuning, numFrets = 15, highlight = null, dots = null, capo = 0, preferFlats = false, showOpenBadge = false, openOctaves = null }) {
        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'gtr-fretboard-wrap' + (showOpenBadge ? ' gtr-has-badge' : '');
        const isDiagram = !!dots;

        // ── Header row (fret numbers) ────────────────────────────────
        const headerRow = document.createElement('div');
        headerRow.className = 'gtr-fret-header-row';
        const spacer = document.createElement('div');
        spacer.className = 'gtr-fret-header-spacer';
        headerRow.appendChild(spacer);

        const headerCells = document.createElement('div');
        headerCells.className = 'gtr-fret-header-cells';
        for (let f = 1; f <= numFrets; f++) {
            const cell = document.createElement('div');
            cell.className = 'gtr-fret-num' + ((FRET_MARKERS.has(f) || DOUBLE_MARKERS.has(f)) ? ' marker' : '');
            cell.textContent = f;
            headerCells.appendChild(cell);
        }
        headerRow.appendChild(headerCells);
        wrap.appendChild(headerRow);

        // ── String rows ───────────────────────────────────────────────
        const numStrings = tuning.length;
        for (let s = numStrings - 1; s >= 0; s--) {
            const openNote = tuning[s];
            const openIdx = MT.noteIndex(openNote);
            const openOctave = openOctaves ? openOctaves[s] : null;

            const row = document.createElement('div');
            row.className = 'gtr-string-row';

            const label = document.createElement('div');
            label.className = 'gtr-string-label';
            label.textContent = openNote;
            row.appendChild(label);

            // Open string indicator (fret 0) — only rendered for callers
            // that opt in via showOpenBadge (Chord Library), where each
            // string's open/muted/fretted state is a real, meaningful
            // fact about a single fixed fingering. Everywhere else the
            // string legend sits directly next to the nut.
            if (showOpenBadge) {
                const badge = document.createElement('div');
                badge.className = 'gtr-open-note-badge';
                if (isDiagram) {
                    const isMuted = dots.some(d => d.string === s && d.muted);
                    const isOpen = dots.some(d => d.string === s && d.fret === 0 && !d.muted);
                    if (isMuted) { badge.classList.add('is-mute'); badge.textContent = '×'; }
                    else if (isOpen) { badge.classList.add('is-open'); badge.textContent = 'O'; }
                    else { badge.classList.add('is-blank'); }
                } else {
                    badge.classList.add('is-open');
                    badge.textContent = 'O';
                }
                row.appendChild(badge);
            }

            const nut = document.createElement('div');
            nut.className = 'gtr-nut';
            row.appendChild(nut);

            const fretsRow = document.createElement('div');
            fretsRow.className = 'gtr-frets-row';

            for (let f = 1; f <= numFrets; f++) {
                const cell = document.createElement('div');
                cell.className = 'gtr-fret-cell';
                const noteIdx = (openIdx + f) % 12;
                if (openOctave !== null) cell.dataset.abs = openOctave * 12 + openIdx + f;

                if (isDiagram && capo > 0 && f === capo) cell.classList.add('gtr-capo-active');

                if (f >= capo) {
                    if (isDiagram) {
                        const match = dots.find(d => d.string === s && d.fret === f && !d.muted);
                        const dot = document.createElement('div');
                        if (match) {
                            if (match.isRoot) cell.classList.add('active');
                            dot.className = 'gtr-fret-dot gtr-fret-dot--shape' + (match.cagedLetter ? ` caged-${match.cagedLetter}` : '');
                            dot.textContent = match.label || MT.noteName(noteIdx, preferFlats);
                        } else {
                            dot.className = 'gtr-fret-dot';
                            dot.textContent = MT.noteName(noteIdx, preferFlats);
                        }
                        cell.appendChild(dot);
                    } else {
                        const preferFlatsCell = highlight ? !!highlight.preferFlats : preferFlats;
                        const noteName = MT.noteName(noteIdx, preferFlatsCell);
                        const isHighlighted = highlight && highlight.notes.includes(noteName);
                        const isRoot = highlight && MT.noteIndex(highlight.root) === noteIdx;

                        cell.classList.toggle('gtr-scale-match', !!isHighlighted);
                        cell.classList.toggle('gtr-root-match', !!isRoot);

                        const dot = document.createElement('div');
                        dot.className = 'gtr-fret-dot';
                        dot.textContent = noteName;
                        cell.appendChild(dot);
                    }
                }
                fretsRow.appendChild(cell);
            }
            row.appendChild(fretsRow);
            wrap.appendChild(row);
        }

        // ── Fret-inlay marker row (dots under the board) — matches the
        // Bass page's board so both instruments read the same way. ────
        const markerRow = document.createElement('div');
        markerRow.className = 'gtr-marker-row';
        const markerSpacer = document.createElement('div');
        markerSpacer.className = 'gtr-marker-spacer';
        markerRow.appendChild(markerSpacer);

        const markerCells = document.createElement('div');
        markerCells.style.display = 'flex';
        markerCells.style.flex = '1';
        for (let f = 1; f <= numFrets; f++) {
            const dotWrap = document.createElement('div');
            dotWrap.className = 'gtr-fret-marker-dot';
            dotWrap.textContent = DOUBLE_MARKERS.has(f) ? '◆◆' : (FRET_MARKERS.has(f) ? '◆' : '');
            markerCells.appendChild(dotWrap);
        }
        markerRow.appendChild(markerCells);
        wrap.appendChild(markerRow);

        container.appendChild(wrap);

        // ── Mobile swipe hint (hidden ≥900px via CSS) ──────────────────
        const hint = document.createElement('span');
        hint.className = 'gtr-scroll-hint';
        hint.textContent = 'Swipe horizontally to navigate frets →';
        container.appendChild(hint);
    }

    return { render };
})();
