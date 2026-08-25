// Floating mini-player, loaded on every page. Lets you paste a YouTube
// link or upload an MP3 and play along while you practice, without
// taking up space in any page's own layout. Not a persistent player
// across navigation (this isn't a single-page app, so a real page
// change always resets JS state) — but the last YouTube link you used
// is remembered via localStorage so picking it back up on another page
// is fast.
(function () {
    const STORAGE_KEY = 'miniPlayerLastYouTubeUrl';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mp-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Play along');
    toggle.textContent = '\u266A';

    const panel = document.createElement('div');
    panel.className = 'mp-panel';
    panel.hidden = true;
    panel.innerHTML = `
        <p class="mp-panel-title">Play Along</p>
        <div class="mp-source-row">
            <input type="url" class="mp-input" id="mp-yt-input" placeholder="Paste a YouTube link…" aria-label="YouTube link" />
            <button type="button" class="mp-load-btn" id="mp-yt-load">Load</button>
        </div>
        <div class="mp-divider"><span>or</span></div>
        <div class="mp-upload-row">
            <label class="mp-upload-btn" for="mp-file-input">Upload MP3</label>
            <input type="file" id="mp-file-input" accept="audio/*" hidden />
            <span class="mp-file-name" id="mp-file-name">No file selected</span>
        </div>
        <div class="mp-yt-wrap" id="mp-yt-wrap" hidden>
            <div class="mp-yt-embed" id="mp-yt-embed"></div>
        </div>
        <audio class="mp-audio" id="mp-audio" controls hidden></audio>
        <div class="mp-error" id="mp-error" hidden></div>
    `;

    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(toggle);
        document.body.appendChild(panel);
        init();
    });

    function init() {
        const ytInput = panel.querySelector('#mp-yt-input');
        const ytLoad = panel.querySelector('#mp-yt-load');
        const ytWrap = panel.querySelector('#mp-yt-wrap');
        const ytEmbed = panel.querySelector('#mp-yt-embed');
        const fileInput = panel.querySelector('#mp-file-input');
        const fileName = panel.querySelector('#mp-file-name');
        const audio = panel.querySelector('#mp-audio');
        const errorEl = panel.querySelector('#mp-error');
        let objectUrl = null;

        toggle.addEventListener('click', () => {
            const open = panel.hidden;
            panel.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
        });

        function showError(msg) {
            errorEl.textContent = msg;
            errorEl.hidden = false;
        }
        function clearError() {
            errorEl.hidden = true;
            errorEl.textContent = '';
        }
        function resetOtherSource(exclude) {
            if (exclude !== 'yt') {
                ytWrap.hidden = true;
                ytEmbed.innerHTML = '';
            }
            if (exclude !== 'file') {
                audio.pause();
                audio.removeAttribute('src');
                audio.hidden = true;
                fileName.textContent = 'No file selected';
                if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
            }
        }

        function extractYouTubeId(url) {
            try {
                const u = new URL(url.trim());
                if (u.hostname === 'youtu.be') return u.pathname.slice(1);
                if (u.hostname.includes('youtube.com')) {
                    if (u.pathname === '/watch') return u.searchParams.get('v');
                    if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2];
                    if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
                }
            } catch (e) { /* not a valid URL */ }
            return null;
        }

        function loadYouTube(url, opts) {
            clearError();
            const id = extractYouTubeId(url);
            if (!id) {
                if (!(opts && opts.silent)) {
                    showError('That doesn\u2019t look like a valid YouTube link.');
                }
                return;
            }
            resetOtherSource('yt');
            ytEmbed.innerHTML =
                '<iframe src="https://www.youtube.com/embed/' + id + (opts && opts.autoplay ? '?autoplay=1' : '') + '" ' +
                'title="YouTube player" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
            ytWrap.hidden = false;
            try { localStorage.setItem(STORAGE_KEY, url.trim()); } catch (e) { /* storage unavailable */ }
        }

        ytLoad.addEventListener('click', () => loadYouTube(ytInput.value));
        ytInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadYouTube(ytInput.value); });

        fileInput.addEventListener('change', () => {
            clearError();
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (!file.type.startsWith('audio/')) {
                showError('Please choose an audio file (MP3, WAV, etc.).');
                fileInput.value = '';
                return;
            }
            resetOtherSource('file');
            objectUrl = URL.createObjectURL(file);
            audio.src = objectUrl;
            audio.hidden = false;
            fileName.textContent = file.name;
        });

        // Pre-fill (but don't auto-load/autoplay) the last YouTube link
        // used on any page, so re-opening the player elsewhere is quick
        // without surprising the user with sound on page load.
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) ytInput.value = saved;
        } catch (e) { /* storage unavailable */ }
    }
})();
