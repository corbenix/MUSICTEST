// Site-wide background atmosphere: injects a few pulsing color orbs and
// drifting glow music notes behind the page content. Used to be inlined
// in index.html only; now shared across every page since the whole site
// uses the same lively background, not just the landing page.
(function () {
    const layer = document.createElement('div');
    layer.className = 'home-fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    const orbColors = ['rgba(56,189,248,.35)', 'rgba(124,111,224,.35)', 'rgba(155,120,240,.3)'];
    const orbPositions = [{ t: '-10%', l: '15%' }, { t: '50%', l: '85%' }, { t: '75%', l: '10%' }];
    orbPositions.forEach((p, i) => {
        const o = document.createElement('span');
        o.className = 'home-fx-orb';
        const size = 90 + Math.random() * 60;
        o.style.width = size + 'px';
        o.style.height = size + 'px';
        o.style.top = p.t;
        o.style.left = p.l;
        o.style.background = orbColors[i % orbColors.length];
        o.style.animationDuration = (5 + Math.random() * 3) + 's';
        layer.appendChild(o);
    });

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
