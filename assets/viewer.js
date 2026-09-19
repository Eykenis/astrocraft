(() => {
  'use strict';
  const deck = JSON.parse(document.getElementById('deck-data').textContent);
  const app = document.getElementById('app');
  const shell = document.getElementById('stage-shell');
  const stage = document.getElementById('stage');
  const contents = document.getElementById('contents');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loopPreferences = new Map();
  const slideButtons = [];
  const pauseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
  const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
  let index = -1;
  let clips = [];
  let adjacentImages = [];
  let toastTimer;

  function notify(message) {
    const notice = document.getElementById('notice');
    notice.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { notice.textContent = ''; }, 4000);
  }

  function fitStage() {
    const style = getComputedStyle(shell);
    const width = shell.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = shell.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const fitted = Math.max(0, Math.min(width, height * deck.width / deck.height, 1920));
    stage.style.width = `${fitted}px`;
    stage.style.height = `${fitted * deck.height / deck.width}px`;
  }

  function getHashIndex() {
    const match = location.hash.match(/^#(?:slide-)?(\d+)$/);
    return match ? Math.max(0, Math.min(deck.slides.length - 1, Number(match[1]) - 1)) : 0;
  }

  function navigate(nextIndex) {
    const bounded = Math.max(0, Math.min(deck.slides.length - 1, nextIndex));
    if (bounded !== index) location.hash = `slide-${bounded + 1}`;
  }

  function cleanupMedia() {
    for (const { video } of clips) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    clips = [];
  }

  function addMedia(media) {
    const holder = document.createElement('div');
    holder.className = 'media-clip';
    holder.style.left = `${100 * media.x / deck.width}%`;
    holder.style.top = `${100 * media.y / deck.height}%`;
    holder.style.width = `${100 * media.width / deck.width}%`;
    holder.style.height = `${100 * media.height / deck.height}%`;
    const video = document.createElement('video');
    video.setAttribute('aria-label', media.label);
    video.setAttribute('playsinline', '');
    video.poster = media.poster;
    video.src = media.source;
    const clip = { video, media, holder };
    clips.push(clip);
    holder.append(video);
    stage.append(holder);

    video.addEventListener('error', () => {
      if (!video.getAttribute('src') || !holder.isConnected) return;
      if (holder.querySelector('.media-error')) return;
      const message = document.createElement('div');
      message.className = 'media-error';
      const label = document.createElement('span');
      label.textContent = '演示暂时无法播放';
      const link = document.createElement('a');
      link.textContent = '单独打开视频';
      link.href = media.source;
      link.target = '_blank';
      link.rel = 'noopener';
      message.append(label, link);
      holder.append(message);
    });

    if (media.kind === 'loop') {
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.preload = 'metadata';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'clip-toggle';
      holder.append(toggle);
      const update = () => {
        holder.classList.toggle('playback-paused', video.paused);
        toggle.innerHTML = video.paused ? playIcon : pauseIcon;
        toggle.setAttribute('aria-label', `${video.paused ? '播放' : '暂停'}动图：${media.label}`);
        toggle.title = video.paused ? '播放动图' : '暂停动图';
      };
      const togglePlayback = () => {
        const shouldPlay = video.paused;
        loopPreferences.set(media.id, shouldPlay);
        if (shouldPlay) video.play().catch(update);
        else video.pause();
      };
      toggle.addEventListener('click', togglePlayback);
      video.addEventListener('click', togglePlayback);
      video.addEventListener('play', update);
      video.addEventListener('pause', update);
      update();
      if ((loopPreferences.get(media.id) ?? !reducedMotion) && !document.hidden) {
        video.play().catch(update);
      }
    } else {
      video.controls = true;
      video.preload = 'none';
    }
  }

  function render(nextIndex) {
    if (nextIndex === index) return;
    cleanupMedia();
    index = nextIndex;
    const slide = deck.slides[index];
    const background = document.createElement('img');
    background.className = 'slide-image';
    background.src = slide.image;
    background.alt = '';
    background.draggable = false;
    background.decoding = 'async';
    background.fetchPriority = 'high';
    stage.replaceChildren(background);
    stage.setAttribute('aria-label', `第 ${index + 1} 页：${slide.title}`);
    slide.media.forEach(addMedia);
    document.getElementById('slide-title').textContent = slide.title;
    document.getElementById('current-page').textContent = String(index + 1).padStart(2, '0');
    document.getElementById('previous').disabled = index === 0;
    document.getElementById('next').disabled = index === deck.slides.length - 1;
    document.getElementById('progress-fill').style.width = `${100 * (index + 1) / deck.slides.length}%`;
    document.getElementById('transcript').textContent = slide.text;
    document.getElementById('announcement').textContent = `第 ${index + 1} 页，共 ${deck.slides.length} 页。${slide.title}`;
    document.title = `${slide.title} · Astrocraft`;
    slideButtons.forEach((button, n) => {
      if (n === index) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    adjacentImages = [index - 1, index + 1].filter(n => deck.slides[n]).map(n => {
      const image = new Image();
      image.src = deck.slides[n].image;
      return image;
    });
  }

  function buildContents() {
    const grid = document.getElementById('contents-grid');
    deck.slides.forEach((slide, n) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'contents-item';
      button.title = `${n + 1}. ${slide.title}`;
      const thumb = document.createElement('img');
      thumb.dataset.src = slide.thumbnail;
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.width = 384;
      thumb.height = 216;
      const caption = document.createElement('span');
      caption.className = 'contents-caption';
      const number = document.createElement('span');
      number.className = 'contents-number';
      number.textContent = String(n + 1).padStart(2, '0');
      const label = document.createElement('span');
      label.className = 'contents-label';
      label.textContent = slide.title;
      caption.append(number, label);
      button.append(thumb, caption);
      button.addEventListener('click', () => { contents.close(); navigate(n); });
      slideButtons.push(button);
      grid.append(button);
    });
  }

  function showContents() {
    for (const image of contents.querySelectorAll('img[data-src]')) {
      image.src = image.dataset.src;
      delete image.dataset.src;
    }
    contents.showModal();
    slideButtons[index].focus({ preventScroll: true });
    slideButtons[index].scrollIntoView({ block: 'center' });
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (app.requestFullscreen) await app.requestFullscreen();
      else notify('当前浏览器不支持网页全屏，可横屏查看。');
    } catch {
      notify('暂时无法进入全屏，可使用浏览器的全屏功能。');
    }
  }

  document.getElementById('previous').addEventListener('click', () => navigate(index - 1));
  document.getElementById('next').addEventListener('click', () => navigate(index + 1));
  document.getElementById('open-contents').addEventListener('click', showContents);
  document.getElementById('close-contents').addEventListener('click', () => contents.close());
  document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
  contents.addEventListener('click', event => {
    const rect = contents.getBoundingClientRect();
    if (event.target === contents && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) contents.close();
  });
  window.addEventListener('hashchange', () => render(getHashIndex()));
  document.addEventListener('fullscreenchange', () => {
    document.getElementById('fullscreen-label').textContent = document.fullscreenElement ? '退出全屏' : '全屏';
    document.getElementById('fullscreen').setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
    fitStage();
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || contents.open) return;
    if (event.target.closest('input,textarea,select,video,[contenteditable="true"]')) return;
    let handled = true;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': navigate(index + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': navigate(index - 1); break;
      case 'Home': navigate(0); break;
      case 'End': navigate(deck.slides.length - 1); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'g': case 'G': showContents(); break;
      case ' ':
        if (event.target.closest('button,a')) handled = false;
        else navigate(index + (event.shiftKey ? -1 : 1));
        break;
      default: handled = false;
    }
    if (handled) event.preventDefault();
  });

  let touchStart;
  stage.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 && !event.target.closest('.media-clip')
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchend', event => {
    if (!touchStart || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.7) navigate(index + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  stage.addEventListener('touchcancel', () => { touchStart = null; });
  document.addEventListener('visibilitychange', () => {
    for (const { video, media } of clips) {
      if (document.hidden) video.pause();
      else if (media.kind === 'loop' && (loopPreferences.get(media.id) ?? !reducedMotion)) video.play().catch(() => {});
    }
  });
  window.addEventListener('pagehide', () => clips.forEach(({ video }) => video.pause()));
  buildContents();
  render(getHashIndex());
  new ResizeObserver(fitStage).observe(shell);
  fitStage();
})();
