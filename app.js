(() => {
  const slides = (window.SLIDES || []).slice();
  const img = document.getElementById('slide');
  const bar = document.querySelector('#progress span');
  const counter = document.getElementById('counter');
  const pauseBtn = document.getElementById('pause');
  const params = new URLSearchParams(location.search);
  const seconds = Math.max(5, Number(params.get('seconds')) || 18);
  const shuffle = params.get('shuffle') === '1';
  const loadTimeoutMs = Math.min(60000, Math.max(2000, Number(params.get('loadms')) || 20000));
  const reloadHours = Math.min(168, Math.max(1, Number(params.get('reload')) || 4));
  document.documentElement.style.setProperty('--seconds', seconds + 's');

  if (shuffle) {
    for (let n = slides.length - 1; n > 0; n--) {
      const j = Math.floor(Math.random() * (n + 1));
      const swap = slides[n];
      slides[n] = slides[j];
      slides[j] = swap;
    }
  }

  // One in-flight load and one outstanding id per timer. Moving to another slide
  // drops the previous load, so a TV left on for days does not accumulate images or timers.
  const ABORT_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  let currentLoad = null;
  let index = 0;
  let paused = false;
  let generation = 0;
  let dwellTimer = 0;
  let retryTimer = 0;
  let loadTimer = 0;
  let reloadTimer = 0;
  let rafId = 0;
  let wakeLock = null;
  let shownSrc = '';

  function clearTimer(id) {
    if (id) clearTimeout(id);
    return 0;
  }

  function releasePreloader(abort) {
    const previous = currentLoad;
    currentLoad = null;
    if (!previous) return;
    previous.onload = null;
    previous.onerror = null;
    // A finished load is dropped so it can be collected. An in-flight load is
    // pointed at a 1px image so the poster download stops, including a hung one.
    if (abort) previous.src = ABORT_SRC;
  }

  function showLoaded(gen, src) {
    if (gen !== generation) return;
    loadTimer = clearTimer(loadTimer);
    shownSrc = src;
    img.src = src;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (gen !== generation) return;
      img.classList.remove('out');
    });
    counter.textContent = (index + 1) + ' / ' + slides.length;
    releasePreloader(false);
    resetProgress();
    schedule();
  }

  function cancelFade() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function resetProgress() {
    bar.classList.remove('run');
    void bar.offsetWidth;
    if (!paused && slides.length) bar.classList.add('run');
  }

  function schedule() {
    dwellTimer = clearTimer(dwellTimer);
    if (paused || !slides.length) return;
    dwellTimer = setTimeout(() => show(index + 1, 1), seconds * 1000);
  }

  function showEmpty() {
    dwellTimer = clearTimer(dwellTimer);
    retryTimer = clearTimer(retryTimer);
    loadTimer = clearTimer(loadTimer);
    cancelFade();
    releasePreloader(true);
    counter.textContent = '0 / 0';
    bar.classList.remove('run');
  }

  function dropAndContinue(gen, step) {
    if (gen !== generation) return;
    generation += 1;
    dwellTimer = clearTimer(dwellTimer);
    loadTimer = clearTimer(loadTimer);
    releasePreloader(true);
    if (!slides.length) {
      showEmpty();
      return;
    }
    slides.splice(index, 1);
    if (!slides.length) {
      index = 0;
      showEmpty();
      return;
    }
    if (step < 0) index = (index - 1 + slides.length) % slides.length;
    else if (index >= slides.length) index = 0;
    retryTimer = clearTimer(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      show(index, step);
    }, 0);
  }

  function show(n, step) {
    const direction = step < 0 ? -1 : 1;
    dwellTimer = clearTimer(dwellTimer);
    retryTimer = clearTimer(retryTimer);
    loadTimer = clearTimer(loadTimer);
    cancelFade();
    const gen = ++generation;
    releasePreloader(true);
    if (!slides.length) {
      showEmpty();
      return;
    }
    index = ((n % slides.length) + slides.length) % slides.length;
    const src = slides[index];
    img.classList.add('out');

    // Same poster again (a one-slide deck): assigning the same src does not refire onload.
    if (shownSrc === src && img.complete && img.naturalWidth > 0) {
      showLoaded(gen, src);
      return;
    }

    const loader = new Image();
    currentLoad = loader;
    loader.onload = () => {
      if (gen !== generation || currentLoad !== loader) return;
      showLoaded(gen, src);
    };
    loader.onerror = () => {
      if (gen !== generation || currentLoad !== loader) return;
      dropAndContinue(gen, direction);
    };
    loadTimer = setTimeout(() => {
      loadTimer = 0;
      if (gen !== generation || currentLoad !== loader) return;
      dropAndContinue(gen, direction);
    }, loadTimeoutMs);
    loader.src = src;
  }

  function togglePause() {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : 'Ⅱ';
    pauseBtn.setAttribute('aria-label', paused ? 'Resume slideshow' : 'Pause slideshow');
    resetProgress();
    if (paused) dwellTimer = clearTimer(dwellTimer);
    else schedule();
  }

  document.getElementById('next').onclick = () => show(index + 1, 1);
  document.getElementById('prev').onclick = () => show(index - 1, -1);
  pauseBtn.onclick = togglePause;
  document.getElementById('full').onclick = () => {
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    if (request && request.catch) request.catch(() => {});
  };
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      show(index + 1, 1);
    } else if (e.key === 'ArrowLeft') show(index - 1, -1);
    else if (e.key.toLowerCase() === 'p') togglePause();
    else if (e.key.toLowerCase() === 'f') document.getElementById('full').click();
  });

  async function wake() {
    if (!('wakeLock' in navigator) || document.hidden) return;
    try {
      if (wakeLock && !wakeLock.released) return;
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {}
  }
  wake();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) wake();
  });

  // Tick once a minute instead of one multi-hour timeout. Some TV browsers drop long timers.
  const reloadAt = Date.now() + reloadHours * 3600 * 1000;
  function watchReload() {
    if (Date.now() >= reloadAt) {
      location.reload();
      return;
    }
    reloadTimer = setTimeout(watchReload, 60 * 1000);
  }
  watchReload();

  show(0, 1);
})();
