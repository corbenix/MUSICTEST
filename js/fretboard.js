// Shared fretting-instrument fretboard renderer (guitar + bass both use this).
window.Fretboard = (function () {
    const MT = window.MusicTheory;

    // tuning: array of open-string note names, LOW to HIGH (e.g. ['E','A','D','G','B','E'])
    // numFrets: how many frets to draw
    // highlight: { notes: [...], root: 'C', preferFlats: bool } or null
    // dots: optional explicit shape markers [{string, fret, label, isRoot, muted}]
    function render(container, { tuning, numFrets = 15, highlight = null, dots = null, capo = 0 }) {
        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'fb-wrap';

        const numStrings = tuning.length;
        const fretMarkers = new Set([3,5,7,9,15,17,19,21]);
        const doubleMarkers = new Set([12,24]);

        const grid = document.createElement('div');
        grid.className = 'fb-grid';
        grid.style.setProperty('--fb-frets', numFrets);
        grid.style.setProperty('--fb-strings', numStrings);

        const nutRow = document.createElement('div');
        nutRow.className = 'fb-fretnums';
        for (let f = 0; f <= numFrets; f++) {
            const cell = document.createElement('div');
            cell.className = 'fb-fretnum';
            if (f > 0 && (fretMarkers.has(f) || doubleMarkers.has(f))) cell.textContent = f;
            nutRow.appendChild(cell);
        }
        grid.appendChild(nutRow);

        for (let s = numStrings - 1; s >= 0; s--) {
            const row = document.createElement('div');
            row.className = 'fb-string-row';
            const openNote = tuning[s];
            const openIdx = MT.noteIndex(openNote);

            for (let f = 0; f <= numFrets; f++) {
                const cell = document.createElement('div');
                cell.className = 'fb-cell' + (f === 0 ? ' fb-cell--nut' : '');

                if (f >= capo) {
                    const noteIdx = (openIdx + f) % 12;
                    const isHighlighted = highlight && highlight.notes.includes(MT.noteName(noteIdx, highlight.preferFlats));
                    const isRoot = highlight && MT.noteIndex(highlight.root) === noteIdx;

                    if (isHighlighted) {
                        const dot = document.createElement('span');
                        dot.className = 'fb-dot' + (isRoot ? ' fb-dot--root' : '');
                        dot.textContent = MT.noteName(noteIdx, highlight.preferFlats);
                        cell.appendChild(dot);
                    }
                }
                row.appendChild(cell);
            }
            grid.appendChild(row);
        }

        if (dots) {
            dots.forEach(d => {
                if (d.muted || d.fret < 0) return;
                const rowIndex = numStrings - 1 - d.string;
                const row = grid.children[rowIndex + 1];
                if (!row) return;
                const cell = row.children[d.fret];
                if (!cell) return;
                const dot = document.createElement('span');
                dot.className = 'fb-dot fb-dot--shape' + (d.isRoot ? ' fb-dot--root' : '');
                dot.textContent = d.label || '';
                cell.appendChild(dot);
            });
        }

        const openRow = document.createElement('div');
        openRow.className = 'fb-openrow';
        for (let s = numStrings - 1; s >= 0; s--) {
            const marker = document.createElement('div');
            marker.className = 'fb-openmark';
            if (dots) {
                const m = dots.find(x => x.string === s && x.muted);
                const d = dots.find(x => x.string === s && x.fret === 0 && !x.muted);
                if (m) marker.textContent = '×';
                else if (d) marker.textContent = 'O';
            }
            openRow.appendChild(marker);
        }

        wrap.appendChild(openRow);
        wrap.appendChild(grid);
        container.appendChild(wrap);
    }

    return { render };
})();
