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
            // Reference app displays the highest (thinnest) string as
            // lowercase "e" — a standard guitar-tab convention — while
            // still using the real (uppercase) note name for pitch/note
            // lookups everywhere else. Display-only, cosmetic.
            label.textContent = (s === numStrings - 1 && openNote === 'E') ? 'e' : openNote;
            row.appendChild(label);

            // Open string indicator (fret 0) — only rendered for callers
            // that opt in via showOpenBadge (Chord Library), where each
            // string's open/muted/fretted state is a real, meaningful
            // fact about a single fixed fingering. Everywhere else the
            // string legend sits directly next to the nut.
            if (showOpenBadge) {
                const badge = document.createElement('div');
                badge.className = 'gtr-open-note-badge';
                badge.dataset.string = s;
                if (openOctave !== null) badge.dataset.abs = openOctave * 12 + openIdx;
                if (isDiagram) {
                    const isMuted = dots.some(d => d.string === s && d.muted);
                    // A string "sounds open" for badge purposes either when
                    // it's a literal fret-0 dot (Chord Library, no capo) or
                    // when the capo itself is fretting it (capoChordDots
                    // stores those at fret === capoFret with viaCapo: true,
                    // not fret 0) — the capo bar presses the string just
                    // like a finger would, so its badge should show that
                    // note+octave the same way. Strings with a real finger
                    // planted somewhere else on the neck (a normal fretted
                    // dot, not viaCapo) are left as the blank placeholder
                    // here since that note is already shown at its own fret.
                    const openMatch = dots.find(d => d.string === s && !d.muted && (d.fret === 0 || d.viaCapo));
                    if (isMuted) { badge.classList.add('is-mute'); badge.textContent = 'X'; }
                    else if (openMatch && openMatch.viaCapo) {
                        // Sounding because the capo bars it, not because a
                        // finger presses it. The badge is a *source* legend
                        // ("Capo, fret 1"), not a pitch readout — it stays
                        // "C1" no matter what actual note that particular
                        // string rings out at that fret. No root ring here:
                        // that emphasis belongs to the fretboard note dots,
                        // not this legend.
                        badge.classList.add('is-open', 'is-capo');
                        badge.textContent = `C${capo}`;
                    }
                    else if (openMatch) {
                        // A genuinely open string with no capo involved —
                        // plain open-string indicator, no root ring.
                        badge.classList.add('is-open');
                        badge.textContent = 'O';
                    }
                    else { badge.classList.add('is-blank'); badge.textContent = '·'; }
                } else {
                    // Highlight mode (e.g. Scale Explorer): the open string
                    // always shows "O" (matching the reference app's
                    // unconditional badge label), and additionally lights
                    // up with the scale-match/root styling when its note
                    // is actually part of the current highlight.
                    const preferFlatsCell = highlight ? !!highlight.preferFlats : preferFlats;
                    const openNoteName = MT.noteName(openIdx, preferFlatsCell);
                    const isHighlighted = highlight && highlight.notes.includes(openNoteName);
                    const isRootNote = highlight && MT.noteIndex(highlight.root) === openIdx;
                    badge.textContent = 'O';
                    if (isHighlighted) {
                        badge.classList.add('is-open');
                        badge.classList.toggle('gtr-root-match', !!isRootNote);
                    } else {
                        badge.classList.add('is-open-neutral');
                    }

                }
                row.appendChild(badge);
            }

            const nut = document.createElement('div');
            nut.className = 'gtr-nut' + (isDiagram && capo > 0 ? ' gtr-capo-adjacent' : '');
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
                        if (showOpenBadge) { cell.dataset.string = s; cell.dataset.fret = f; }
                        const match = dots.find(d => d.string === s && d.fret === f && !d.muted);
                        const dot = document.createElement('div');
                        if (match && match.viaCapo) {
                            // This note sounds because the capo bars it, not
                            // because a finger is pressing it — draw it as
                            // part of the capo bar itself (flush, no
                            // "press me" affordance) instead of the raised
                            // finger-shape dot used elsewhere.
                            if (match.isRoot) cell.classList.add('active');
                            cell.classList.add('gtr-capo-sounded');
                            dot.className = 'gtr-fret-dot gtr-fret-dot--capo' + (match.cagedLetter ? ` caged-${match.cagedLetter}` : '');
                            dot.textContent = match.label ? MT.noteName(MT.noteIndex(match.label), preferFlats) : MT.noteName(noteIdx, preferFlats);
                        } else if (match) {
                            if (match.isRoot) cell.classList.add('active');
                            dot.className = 'gtr-fret-dot gtr-fret-dot--shape' + (match.cagedLetter ? ` caged-${match.cagedLetter}` : '');
                            // Labels are always a note name (e.g. the chord's
                            // root), baked in whatever spelling was current
                            // when the shape was built. Re-spell it through
                            // the *current* preferFlats every render so the
                            // sharp/flat toggle actually updates these dots
                            // instead of freezing them at their original text.
                            dot.textContent = match.label ? MT.noteName(MT.noteIndex(match.label), preferFlats) : MT.noteName(noteIdx, preferFlats);
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
