// Mobile header nav: toggles the off-canvas link drawer opened via the
// hamburger button. Desktop ignores this (button is hidden by CSS).
(function () {
    const toggle = document.querySelector('.nclg-nav-toggle');
    const links = document.querySelector('.nclg-nav-links');
    const scrim = document.querySelector('.nclg-nav-scrim');
    if (!toggle || !links || !scrim) return;

    function openNav() {
        links.classList.add('is-open');
        scrim.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('nav-open');
    }

    function closeNav() {
        links.classList.remove('is-open');
        scrim.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-open');
    }

    toggle.addEventListener('click', function () {
        const isOpen = links.classList.contains('is-open');
        if (isOpen) {
            closeNav();
        } else {
            openNav();
        }
    });

    scrim.addEventListener('click', closeNav);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeNav();
    });

    // Close automatically if the viewport is resized past the mobile
    // breakpoint (e.g. rotating a tablet to landscape).
    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) closeNav();
    });
})();
