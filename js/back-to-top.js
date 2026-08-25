// Floating "back to top" button, loaded on every page. Sits directly
// above the metronome widget (same right: 20px column) and only appears
// once you've scrolled down a bit, so it doesn't clutter the corner
// when there's nothing to scroll back up to.
(function () {
    const SHOW_AFTER_PX = 400;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btt-fab';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '&#8593;';

    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(btn);

        function updateVisibility() {
            const shouldShow = window.scrollY > SHOW_AFTER_PX;
            btn.classList.toggle('btt-fab--visible', shouldShow);
        }

        window.addEventListener('scroll', updateVisibility, { passive: true });
        updateVisibility();

        btn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
})();
