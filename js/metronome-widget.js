// Universal floating metronome button — play/stop only, in sync with the
// metronome panel on the Other Tools page via window.GlobalMetronome.
(function () {
    'use strict';

    function buildMarkup() {
        var fab = document.createElement('button');
        fab.className = 'gmw-fab';
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Start metronome');
        fab.innerHTML =
            '<svg class="gmw-icon-play" viewBox="0 0 24 24"><path d="M7 5l13 7-13 7V5z"/></svg>' +
            '<svg class="gmw-icon-stop" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>' +
            '<span class="gmw-fab-dot" aria-hidden="true"></span>';
        document.body.appendChild(fab);
        return fab;
    }

    function init() {
        if (!window.GlobalMetronome) return;
        var fab = buildMarkup();
        var fabDot = fab.querySelector('.gmw-fab-dot');

        fab.addEventListener('click', function () {
            window.GlobalMetronome.toggle();
        });

        window.GlobalMetronome.subscribe(function (evt) {
            if (evt.type === 'tick') {
                fabDot.classList.add('gmw-fab-dot--flash');
                setTimeout(function () { fabDot.classList.remove('gmw-fab-dot--flash'); }, 100);
                return;
            }
            var active = evt.active;
            fab.classList.toggle('gmw-fab--active', active);
            fab.setAttribute('aria-label', active ? 'Stop metronome' : 'Start metronome');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
