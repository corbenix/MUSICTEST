// Ambient cursor trail — desktop only, respects reduced-motion.
(function () {
    var isDesktop = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isDesktop || reduceMotion) return;

    var container = document.querySelector('.cn-bg');
    if (!container) return;

    var lastX = null, lastY = null;
    var lastSpawn = 0;
    var minDist = 18;
    var minInterval = 40;

    function spawnDot(x, y) {
        var dot = document.createElement('span');
        dot.className = 'cn-trail-dot';
        var size = 4 + Math.random() * 4;
        dot.style.width = size + 'px';
        dot.style.height = size + 'px';
        dot.style.left = x + 'px';
        dot.style.top = y + 'px';
        container.appendChild(dot);
        requestAnimationFrame(function () {
            dot.classList.add('cn-trail-dot--fade');
        });
        setTimeout(function () {
            dot.remove();
        }, 900);
    }

    window.addEventListener('mousemove', function (e) {
        var now = performance.now();
        if (lastX !== null) {
            var dx = e.clientX - lastX, dy = e.clientY - lastY;
            if (Math.sqrt(dx * dx + dy * dy) < minDist) return;
        }
        if (now - lastSpawn < minInterval) return;
        lastSpawn = now;
        lastX = e.clientX;
        lastY = e.clientY;
        spawnDot(e.clientX, e.clientY);
    }, { passive: true });
})();

document.addEventListener('DOMContentLoaded', function () {
    var y = document.getElementById('footer-year');
    if (y) y.textContent = new Date().getFullYear();
});
