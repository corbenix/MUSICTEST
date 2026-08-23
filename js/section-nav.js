// Drives the sliding active-tab indicator in the top .section-nav-card
// (Guitar / Bass / Keyboard / Chord Builder / Practice Tools). The pill's
// position and color (--c-rgb, set per-link in shared.css) are computed
// here rather than in CSS alone, since CSS can't measure a sibling's
// rendered width/offset to slide a separate element to it.
(function () {
    'use strict';

    function initSectionNav(nav) {
        const btns = Array.prototype.slice.call(nav.querySelectorAll('.section-nav-btn'));
        if (!btns.length) return;

        const pill = document.createElement('div');
        pill.className = 'section-nav-pill';
        pill.setAttribute('aria-hidden', 'true');
        nav.insertBefore(pill, nav.firstChild);

        function movePill(btn) {
            if (!btn) return;
            const navRect = nav.getBoundingClientRect();
            const r = btn.getBoundingClientRect();
            pill.style.left = (r.left - navRect.left) + 'px';
            pill.style.width = r.width + 'px';
            const cRgb = getComputedStyle(btn).getPropertyValue('--c-rgb').trim();
            if (cRgb) pill.style.setProperty('--c-rgb', cRgb);
        }

        function currentBtn() {
            return nav.querySelector('.section-nav-btn[aria-current="page"]') || btns[0];
        }

        // Reveal the pill only once it has a real position, avoiding a
        // flash at the top-left corner before layout is measured.
        requestAnimationFrame(function () {
            movePill(currentBtn());
            nav.classList.add('js-ready');
        });

        window.addEventListener('resize', function () {
            movePill(currentBtn());
        });

        // Reference app has each tool as a full page navigation rather
        // than an in-page tab switch, so there's no click-to-switch state
        // here — the pill simply reflects whichever link the server/HTML
        // has marked aria-current="page" on load.
    }

    function init() {
        document.querySelectorAll('.section-nav-card').forEach(initSectionNav);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
