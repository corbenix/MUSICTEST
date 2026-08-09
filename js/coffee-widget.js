// Universal "Buy me a coffee" button — injected on every page, bottom-left.
// Hover reveals a tooltip; click opens the GCash QR code in a modal.
(function () {
    'use strict';

    var QR_SRC = 'assets/img/gcash.jpg';

    function buildMarkup() {
        var fab = document.createElement('button');
        fab.className = 'gcw-fab';
        fab.type = 'button';
        fab.setAttribute('aria-label', 'Buy me a coffee');
        fab.innerHTML = '<span class="gcw-fab-icon" aria-hidden="true">\u2615</span>';

        var tooltip = document.createElement('div');
        tooltip.className = 'gcw-tooltip';
        tooltip.textContent = 'Buy me a coffee \u2764\uFE0F';

        var overlay = document.createElement('div');
        overlay.className = 'gcw-overlay';
        overlay.innerHTML =
            '<div class="gcw-modal" role="dialog" aria-label="Buy me a coffee">' +
                '<div class="gcw-modal-title">Buy me a coffee \u2764\uFE0F</div>' +
                '<div class="gcw-modal-sub">Scan the QR code to send a tip via GCash</div>' +
                '<img class="gcw-qr" src="' + QR_SRC + '" alt="GCash QR code" />' +
                '<button class="gcw-close" type="button">Close</button>' +
            '</div>';

        document.body.appendChild(fab);
        document.body.appendChild(tooltip);
        document.body.appendChild(overlay);
        return { fab: fab, tooltip: tooltip, overlay: overlay };
    }

    function init() {
        var el = buildMarkup();
        var fab = el.fab, tooltip = el.tooltip, overlay = el.overlay;
        var closeBtn = overlay.querySelector('.gcw-close');

        function showTooltip() { tooltip.classList.add('gcw-tooltip--visible'); }
        function hideTooltip() { tooltip.classList.remove('gcw-tooltip--visible'); }

        fab.addEventListener('mouseenter', showTooltip);
        fab.addEventListener('mouseleave', hideTooltip);
        fab.addEventListener('focus', showTooltip);
        fab.addEventListener('blur', hideTooltip);

        function openModal() {
            hideTooltip();
            overlay.classList.add('gcw-overlay--open');
        }
        function closeModal() {
            overlay.classList.remove('gcw-overlay--open');
        }

        fab.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
