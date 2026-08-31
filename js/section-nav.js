// Drives the sliding active-tab indicator in the top .section-nav-card
// (Guitar / Bass / Keyboard / Chord Builder / Practice Tools). The pill's
// position and color (--c-rgb, set per-link in shared.css) are computed
// here rather than in CSS alone, since CSS can't measure a sibling's
// rendered width/offset to slide a separate element to it.
//
// SPA MERGE UPDATE: this component is now shared chrome (one copy) in
// app.html instead of being duplicated per page, and its links call
// window.AppShowSection(id) instead of doing a real navigation — which
// means the pill now genuinely slides via live DOM animation on every
// click, the way it was always meant to. The old View Transitions CSS
// workaround (see css/shared.css's @view-transition block) is no longer
// needed for this component now that there's no cross-document
// navigation to smooth over, though it's left in place harmlessly for
// any other browser-level page transitions.
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

        function setActive(btn) {
            btns.forEach((b) => {
                if (b === btn) b.setAttribute('aria-current', 'page');
                else b.removeAttribute('aria-current');
            });
            movePill(btn);
        }

        (function setInitialColor() {
            const btn = currentBtn();
            if (!btn) return;
            const cRgb = getComputedStyle(btn).getPropertyValue('--c-rgb').trim();
            if (cRgb) pill.style.setProperty('--c-rgb', cRgb);
        })();

        // Reveal the pill only once it has a real position, avoiding a
        // flash at the top-left corner before layout is measured.
        requestAnimationFrame(function () {
            movePill(currentBtn());
            nav.classList.add('js-ready');
        });

        window.addEventListener('resize', function () {
            movePill(currentBtn());
        });

        // Clicking a link now switches sections in place (see app.html's
        // showSection) instead of triggering a real page navigation, and
        // the pill slides to match immediately.
        btns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.sectionLink;
                if (!id) return; // no SPA target wired up — let it navigate normally
                e.preventDefault();
                setActive(btn);
                if (window.AppShowSection) window.AppShowSection(id);
            });
        });

        // If some other control also changes the active section (e.g. a
        // hub card on Home, or the top nclg-nav), keep this pill in sync.
        window.addEventListener('app:sectionchange', (e) => {
            const btn = nav.querySelector('.section-nav-btn[data-section-link="' + e.detail + '"]');
            if (btn) setActive(btn);
        });
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
