// Site-wide background atmosphere: injects a few drifting glow music notes
// behind the page content. The two pulsing color orbs were removed in
// favor of baking a single, larger, much softer glow directly into the
// body::before aurora background (see css/shared.css) instead.
(function () {
    const layer = document.createElement('div');
    layer.className = 'home-fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    const noteGlyphs = ['\u266A', '\u266B', '\u2669'];
    const noteColors = ['#38bdf8', '#7c6fe0', '#9b7ce0'];
    for (let i = 0; i < 6; i++) {
        const n = document.createElement('span');
        n.className = 'home-fx-note';
        n.textContent = noteGlyphs[Math.floor(Math.random() * noteGlyphs.length)];
        n.style.left = (Math.random() * 100) + '%';
        n.style.fontSize = (12 + Math.random() * 10) + 'px';
        n.style.color = noteColors[Math.floor(Math.random() * noteColors.length)];
        n.style.animationDuration = (7 + Math.random() * 6) + 's';
        n.style.animationDelay = (Math.random() * 6) + 's';
        layer.appendChild(n);
    }
})();
