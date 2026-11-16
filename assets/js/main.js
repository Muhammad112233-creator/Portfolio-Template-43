/* =========================================================
   NOCTURNE — interaction engine
   Lenis smooth scroll · GSAP/ScrollTrigger · Swiper · Three.js
   Vanilla, no build step.
   ========================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isNarrow = window.matchMedia('(max-width: 781px)').matches;

  function qs(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var hasGsap = typeof window.gsap !== 'undefined';
  var gsap = window.gsap;
  var ScrollTrigger = null;
  if (hasGsap && window.ScrollTrigger) {
    ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ─────────────────────────────────────────────────────────
     1 · SMOOTH SCROLL
     ───────────────────────────────────────────────────────── */
  var lenis = null;
  function initLenis() {
    if (!window.Lenis || reduced) return;
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    window.__lenis = lenis;
    if (ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function raf(t) { lenis.raf(t); requestAnimationFrame(raf); });
    }
  }
  function scrollLock(on) {
    doc.body.classList.toggle('modal-open', !!on);
    if (!lenis) return;
    if (on) { lenis.stop(); } else { lenis.start(); }
  }

  /* ─────────────────────────────────────────────────────────
     2 · SOUND — tiny synthesised sample engine
     ───────────────────────────────────────────────────────── */
  var Sound = (function () {
    var ctx = null, master = null, enabled = false;
    var buffers = {};

    function audio() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return ctx;
    }

    /* procedural noise buffers — no external files needed */
    function noiseBuffer(kind) {
      if (buffers[kind]) return buffers[kind];
      var c = audio(); if (!c) return null;
      var dur = kind === 'wind' ? 6 : kind === 'clock' ? 1.2 : 1.4;
      var len = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(2, len, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var data = buf.getChannelData(ch);
        var last = 0;
        for (var i = 0; i < len; i++) {
          var white = Math.random() * 2 - 1;
          if (kind === 'wind') {
            last = (last + 0.02 * white) / 1.02;
            data[i] = last * 3.2 * (0.55 + 0.45 * Math.sin(i / len * Math.PI * 2));
          } else if (kind === 'shimmer') {
            data[i] = white * Math.pow(1 - i / len, 2.2) * 0.5;
          } else {
            data[i] = white * Math.pow(1 - i / len, 3);
          }
        }
      }
      buffers[kind] = buf;
      return buf;
    }

    function oneShot(name, level, fade) {
      if (!enabled) return;
      var c = audio(); if (!c) return;
      if (c.state === 'suspended') c.resume();
      var buf = noiseBuffer(name === 'wind' ? 'wind' : name === 'shimmer' ? 'shimmer' : 'hit');
      if (!buf) return;
      var src = c.createBufferSource();
      src.buffer = buf;
      var g = c.createGain();
      var filter = c.createBiquadFilter();
      var now = c.currentTime;
      var vol = level || 0.5;
      g.gain.setValueAtTime(0.0001, now);
      if (name === 'gavel' || name === 'chest' || name === 'descent') {
        filter.type = 'lowpass'; filter.frequency.value = name === 'gavel' ? 420 : 700; filter.Q.value = 1.1;
        g.gain.exponentialRampToValueAtTime(vol * 0.9, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + (fade || 0.9));
      } else if (name === 'steps') {
        filter.type = 'bandpass'; filter.frequency.value = 900; filter.Q.value = 0.8;
        g.gain.exponentialRampToValueAtTime(vol * 0.5, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + (fade || 0.35));
      } else if (name === 'shimmer') {
        filter.type = 'highpass'; filter.frequency.value = 2400;
        g.gain.exponentialRampToValueAtTime(vol * 0.35, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + (fade || 0.5));
      } else if (name === 'whoosh') {
        filter.type = 'bandpass'; filter.frequency.setValueAtTime(320, now);
        filter.frequency.exponentialRampToValueAtTime(2600, now + 0.5);
        filter.Q.value = 0.7;
        g.gain.exponentialRampToValueAtTime(vol * 0.55, now + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, now + (fade || 0.7));
      } else { /* clock / eating */
        filter.type = 'highpass'; filter.frequency.value = 1400;
        g.gain.exponentialRampToValueAtTime(vol * 0.3, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + (fade || 0.18));
      }
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start(0, Math.random() * Math.max(0, (buf.duration || 1) - 1.2));
    }

    var wind = null;
    function startWind() {
      if (!enabled) return;
      var c = audio(); if (!c || wind) return;
      if (c.state === 'suspended') c.resume();
      var buf = noiseBuffer('wind');
      var src = c.createBufferSource();
      src.buffer = buf; src.loop = true;
      var filter = c.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 640; filter.Q.value = 0.4;
      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 2.2);
      src.connect(filter); filter.connect(g); g.connect(master);
      src.start(0, Math.random() * buf.duration);
      wind = { src: src, gain: g };
    }
    function stopWind() {
      if (!wind || !ctx) { wind = null; return; }
      var w = wind; wind = null;
      w.gain.gain.cancelScheduledValues(ctx.currentTime);
      w.gain.gain.setValueAtTime(Math.max(w.gain.gain.value, 0.0001), ctx.currentTime);
      w.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
      setTimeout(function () { try { w.src.stop(); } catch (e) {} }, 1400);
    }

    return {
      isOn: function () { return enabled; },
      toggle: function () {
        enabled = !enabled;
        if (enabled) { audio(); if (ctx && ctx.state === 'suspended') ctx.resume(); startWind(); oneShot('shimmer', 0.4); }
        else { stopWind(); }
        return enabled;
      },
      play: function (name, level, fade) { oneShot(name, level, fade); },
      windOn: function (on) { if (on) startWind(); else stopWind(); }
    };
  })();

  function initSoundUI() {
    var btn = qs('.sound-toggle');
    var hint = qs('.sound-hint');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var on = Sound.toggle();
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (hint) hint.classList.remove('is-shown');
    });
    if (hint && !isNarrow) {
      setTimeout(function () { hint.classList.add('is-shown'); }, 4200);
      setTimeout(function () { hint.classList.remove('is-shown'); }, 11000);
    }
    doc.addEventListener('nocturne:sfx', function (e) {
      if (!Sound.isOn()) return;
      var map = { whoosh: ['whoosh', 0.6, 0.7], chest: ['chest', 0.6, 0.9], gavel: ['gavel', 0.7, 0.8], shimmer: ['shimmer', 0.4, 0.5], wind: ['wind', 0.5, 1.4], descent: ['descent', 0.5, 1.2], steps: ['steps', 0.4, 0.3], clock: ['clock', 0.25, 0.16], eating: ['eating', 0.3, 0.4] };
      var m = map[e.detail] || null;
      if (m) Sound.play(m[0], m[1], m[2]);
    });
  }

  /* ─────────────────────────────────────────────────────────
     3 · PRELOADER
     ───────────────────────────────────────────────────────── */
  function initPreloader() {
    var el = qs('.home-preloader');
    if (!el) return;
    var counter = qs('[data-preloader-count]', el);
    var title = qs('.block-hero__title');
    var original = title ? { html: title.innerHTML, data: title.getAttribute('data-title') } : null;
    var heroReady = false, forced = false, done = false, shown = 0;
    var start = performance.now();

    function scrambleWord(src, from, to) {
      return src.replace(new RegExp('\\b' + from + '\\b', 'i'), to);
    }
    if (title && original) {
      title.innerHTML = scrambleWord(title.innerHTML, 'Wear', 'Wearing');
      if (original.data) title.setAttribute('data-title', scrambleWord(original.data, 'Wear', 'Wearing'));
    }

    function tick() {
      if (done) return;
      var t = (performance.now() - start) / 2600;
      var eased = 1 - Math.pow(1 - Math.min(1, t), 3);
      var target = forced ? 100 : Math.min(92, Math.round(92 * eased));
      if (target > shown) {
        shown = forced ? Math.min(100, shown + 4) : target;
        if (counter) counter.textContent = String(shown);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function restoreTitle(instant) {
      if (!original || !title) return;
      if (instant) { title.innerHTML = original.html; if (original.data) title.setAttribute('data-title', original.data); return; }
      var marker = title.innerHTML.replace(/\b(Wearing)\b/i, '<span data-descramble>$1</span>');
      var real = original.html.match(/\bWear\b/i);
      var span = qs('[data-descramble]', title);
      if (marker !== title.innerHTML && real && span) {
        title.innerHTML = marker;
        scrambleText(qs('[data-descramble]', title), real[0], 900, function () {
          title.innerHTML = original.html;
          if (original.data) title.setAttribute('data-title', original.data);
        });
      } else {
        title.innerHTML = original.html;
        if (original.data) title.setAttribute('data-title', original.data);
      }
    }

    function scrambleText(node, finalText, dur, cb) {
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      var t0 = performance.now(), from = node.textContent;
      (function step() {
        var p = Math.min(1, (performance.now() - t0) / dur);
        var out = '';
        for (var i = 0; i < finalText.length; i++) {
          if (i < finalText.length * p) out += finalText[i];
          else out += chars[Math.floor(Math.random() * chars.length)];
        }
        node.textContent = out;
        if (p < 1) requestAnimationFrame(step); else { node.textContent = finalText; if (cb) cb(); }
      })();
    }

    function finish(skip) {
      if (done) return;
      done = true;
      forced = true;
      shown = 100;
      if (counter) counter.textContent = '100';
      restoreTitle(skip);
      root.classList.remove('home-loading');
      if (skip) { el.remove(); return; }
      el.classList.add('is-lifting');
      setTimeout(function () { el.remove(); }, 1000);
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }

    var scrolled = function () { return window.scrollY > window.innerHeight * 0.5; };
    if (scrolled()) return finish(true);
    window.addEventListener('scroll', function onScroll() {
      if (scrolled()) { window.removeEventListener('scroll', onScroll); finish(true); }
    }, { passive: true });
    doc.addEventListener('nocturne:hero-ready', function () {
      heroReady = true;
      setTimeout(function () { finish(false); }, 450);
    }, { once: true });
    setTimeout(function () { finish(false); }, 7000);
  }

  /* ─────────────────────────────────────────────────────────
     4 · CURSOR RING
     ───────────────────────────────────────────────────────── */
  function initCursor() {
    if (!finePointer || reduced) return;
    var ring = qs('.cursor-ring');
    if (!ring) return;
    var label = qs('.cursor-ring__label', ring);
    root.classList.add('has-cursor');
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var cx = mx, cy = my, shownOnce = false;

    doc.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!shownOnce) { shownOnce = true; ring.classList.add('is-on'); }
    }, { passive: true });

    (function raf() {
      cx = lerp(cx, mx, 0.22);
      cy = lerp(cy, my, 0.22);
      ring.style.translate = cx + 'px ' + cy + 'px';
      requestAnimationFrame(raf);
    })();

    doc.addEventListener('pointerdown', function () { ring.classList.add('is-down'); });
    doc.addEventListener('pointerup', function () { ring.classList.remove('is-down'); });

    var hoverables = 'a, button, .trend__media, .tsneak__row, .lreborn__row, input, .rfc-switch, .menu-toggle';
    doc.addEventListener('pointerover', function (e) {
      var t = e.target.closest && e.target.closest(hoverables);
      ring.classList.toggle('is-hover', !!t);
      var labelled = e.target.closest && e.target.closest('[data-cursor]');
      if (labelled) {
        if (label) label.textContent = labelled.getAttribute('data-cursor') || '';
        ring.classList.add('is-label');
        ring.classList.remove('is-hover');
      } else {
        ring.classList.remove('is-label');
      }
    }, { passive: true });
    doc.addEventListener('pointerout', function (e) {
      if (!e.relatedTarget) { ring.classList.remove('is-hover', 'is-label', 'is-on'); shownOnce = false; }
    });
  }

  /* ─────────────────────────────────────────────────────────
     5 · HERO 3D (three.js displacement plane)
     ───────────────────────────────────────────────────────── */
  function initHero3D() {
    var img = qs('[data-hero-3d]');
    if (!img || !window.THREE) { doc.dispatchEvent(new CustomEvent('nocturne:hero-ready')); return; }
    var canvasTest = doc.createElement('canvas');
    var gl = canvasTest.getContext('webgl') || canvasTest.getContext('experimental-webgl');
    if (!gl) { doc.dispatchEvent(new CustomEvent('nocturne:hero-ready')); return; }

    var host = img.parentElement;
    var canvas = doc.createElement('canvas');
    canvas.className = 'clouds-mesh';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'absolute', inset: '0', height: '100%', width: '100%',
      pointerEvents: 'none', mixBlendMode: 'lighten', opacity: '0',
      transition: 'opacity 0.8s ease'
    });
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(canvas);

    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (e) { canvas.remove(); doc.dispatchEvent(new CustomEvent('nocturne:hero-ready')); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    var uniforms = {
      uTex: { value: null },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uMotion: { value: reduced ? 0 : 1 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uAspect: { value: 1 }
    };

    var material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: [
        'uniform float uTime;',
        'uniform float uReveal;',
        'uniform float uMotion;',
        'uniform vec2 uPointer;',
        'varying vec2 vUv;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
        'float noise(vec2 p){',
        '  vec2 i = floor(p), f = fract(p);',
        '  vec2 u = f*f*(3.0-2.0*f);',
        '  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);',
        '}',
        'void main(){',
        '  vUv = uv;',
        '  vec3 p = position;',
        '  float rev = clamp(uReveal, 0.0, 1.0);',
        '  p.y -= (1.0 - rev) * 0.34;',
        '  float drift = noise(p.xy * 1.4 + uTime * 0.12) - 0.5;',
        '  p.z += drift * 0.16 * uMotion * rev;',
        '  p.x += sin(p.y * 1.6 + uTime * 0.24) * 0.03 * uMotion * rev;',
        '  p.x += uPointer.x * 0.06 * rev;',
        '  p.y += uPointer.y * 0.04 * rev;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uTex;',
        'uniform float uReveal;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec4 c = texture2D(uTex, vUv);',
        '  float fx = smoothstep(0.0, 0.09, vUv.x) * smoothstep(0.0, 0.09, 1.0 - vUv.x);',
        '  float fy = smoothstep(0.0, 0.09, vUv.y) * smoothstep(0.0, 0.09, 1.0 - vUv.y);',
        '  c.a *= fx * fy * clamp(uReveal, 0.0, 1.0);',
        '  if (c.a < 0.02) discard;',
        '  gl_FragColor = c;',
        '}'
      ].join('\n')
    });

    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 180, 120), material);
    scene.add(mesh);

    var loader = new THREE.TextureLoader();
    loader.load(img.currentSrc || img.src, function (tex) {
      tex.colorSpace = THREE.NoColorSpace;
      tex.flipY = false;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      uniforms.uTex.value = tex;

      var image = tex.image;
      var aspect = image.width / image.height;
      var dist = 6, fov = 22 * Math.PI / 180;
      var vh = 2 * Math.tan(fov / 2) * dist;
      uniforms.uAspect.value = aspect;

      function resize() {
        var w = host.clientWidth, h = host.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
        var vhh = 2 * Math.tan(fov / 2) * dist;
        var vww = vhh * camera.aspect;
        /* match the CSS art sizing: 74.06vw on desktop, 150vw on phones */
        var widthFactor = window.innerWidth <= 781 ? 1.5 : 0.7406;
        var planeW = vww * widthFactor;
        var planeH = planeW / aspect;
        mesh.scale.set(planeW, planeH, 1);
        if (window.innerWidth <= 781) {
          mesh.position.set(vww * 0.0, -vhh * 0.03, 0);
        } else {
          mesh.position.set(-vww * 0.0172, vhh * 0.5 - planeH * 0.5, 0);
        }
      }
      resize();
      window.addEventListener('resize', resize);
      canvas.style.opacity = '1';
      img.style.opacity = '0';

      if (gsap) {
        gsap.to(uniforms.uReveal, { value: 1, duration: 2.2, ease: 'power2.out', delay: 0.15 });
      } else { uniforms.uReveal.value = 1; }

      doc.dispatchEvent(new CustomEvent('nocturne:hero-ready'));

      var pointer = { x: 0, y: 0 };
      window.addEventListener('pointermove', function (e) {
        pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.y = -(e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });

      var clock = new THREE.Clock();
      (function render() {
        uniforms.uTime.value = clock.getElapsedTime();
        uniforms.uPointer.value.x = lerp(uniforms.uPointer.value.x, pointer.x, 0.04);
        uniforms.uPointer.value.y = lerp(uniforms.uPointer.value.y, pointer.y, 0.04);
        renderer.render(scene, camera);
        requestAnimationFrame(render);
      })();
    }, undefined, function () {
      img.style.opacity = '1';
      canvas.remove();
      doc.dispatchEvent(new CustomEvent('nocturne:hero-ready'));
    });
  }

  /* ─────────────────────────────────────────────────────────
     6 · MANIFESTO — horizontal pin
     ───────────────────────────────────────────────────────── */
  function initManifesto() {
    if (!gsap || !ScrollTrigger) return;
    var section = qs('.manifesto');
    if (!section) return;
    var track = qs('.manifesto__track', section);
    if (!track) return;
    var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    gsap.to(track, {
      x: function () { return -distance(); },
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: function () { return '+=' + distance(); },
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true
      }
    });
  }

  /* ─────────────────────────────────────────────────────────
     7 · MYSTERY VAULT — pinned unzip
     ───────────────────────────────────────────────────────── */
  function initMysteryBox() {
    if (!gsap || !ScrollTrigger) return;
    var section = qs('.mystery-box');
    if (!section) return;
    var zip = qs('.mystery-box__zip', section);
    var chain = qs('.mystery-box__zip-chain', section);
    var slider = qs('.mystery-box__zip-slider', section);
    var top = qs('.mystery-box__cover--top', section);
    var bottom = qs('.mystery-box__cover--bottom', section);
    if (!(zip && chain && slider && top && bottom)) return;
    zip.tabIndex = -1; zip.style.pointerEvents = 'none';

    var canWhoosh = true, last = 0;
    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: '+=150%',
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var inZone = self.progress > 0.4 && self.progress < 0.75;
          if (canWhoosh && self.direction > 0 && inZone) {
            var now = performance.now();
            if (now - last > 1500) {
              last = now;
              var ev = new CustomEvent('nocturne:sfx', { detail: 'whoosh', cancelable: true });
              doc.dispatchEvent(ev);
              if (ev.defaultPrevented) canWhoosh = false;
            }
          } else if (!canWhoosh && self.progress < 0.35) { canWhoosh = true; }
        }
      }
    });
    tl.fromTo(chain, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 101% 0% 0%)', ease: 'none', duration: 0.4 }, 0);
    tl.to(slider, { xPercent: -101, ease: 'none', duration: 0.4 }, 0);
    tl.to(top, { yPercent: -89, ease: 'power1.in', duration: 0.4 }, 0.4);
    tl.to(bottom, { yPercent: 89, ease: 'power1.in', duration: 0.4 }, 0.4);
    tl.to(zip, { autoAlpha: 0, duration: 0.06 }, 0.4);
    tl.to({}, { duration: 0.2 }, 0.8);
  }

  /* ─────────────────────────────────────────────────────────
     8 · TYPEWRITER
     ───────────────────────────────────────────────────────── */
  function initTypewriter() {
    qsa('[data-typewriter]').forEach(function (bar) {
      var target = qs('[data-type-target]', bar);
      var items = [];
      try { items = JSON.parse(bar.dataset.typewriter); } catch (e) { return; }
      if (!target || items.length < 2 || reduced) return;
      var index = 0, active = true, outTimer = null, pending = null;

      function schedule(fn, ms) {
        clearTimeout(outTimer);
        outTimer = setTimeout(function () { if (active) fn(); else pending = fn; }, ms);
      }
      function type(str, pos, dir) {
        target.textContent = str.slice(0, pos);
        if (dir > 0 && pos === str.length) schedule(function () { type(str, pos, -1); }, 2200);
        else if (dir < 0 && pos === 0) {
          index = (index + 1) % items.length;
          schedule(function () { type(items[index], 0, 1); }, 350);
        } else schedule(function () { type(str, pos + dir, dir); }, dir > 0 ? 65 : 32);
      }
      function setActive(on) {
        active = on && !document.hidden;
        if (active && pending) { var fn = pending; pending = null; fn(); }
      }
      if ('IntersectionObserver' in window) {
        active = false;
        new IntersectionObserver(function (entries) {
          var visible = entries.some(function (e) { return e.isIntersecting; });
          setActive(visible);
        }, { rootMargin: '150px' }).observe(bar);
        doc.addEventListener('visibilitychange', function () { setActive(!document.hidden); });
      }
      schedule(function () { type(items[0], items[0].length, -1); }, 2600);
    });
  }

  /* ─────────────────────────────────────────────────────────
     9 · HOVER-SWAP LISTS (relics + atelier)
     ───────────────────────────────────────────────────────── */
  function buildSwipeButtons(section, rows, indexFn, after) {
    if (rows.length < 2) return;
    function make(kind, aria) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'home-swipe home-swipe--' + kind;
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', function () {
        var i = indexFn();
        var next = kind === 'next' ? i + 1 : i - 1;
        if (next >= 0 && next < rows.length) { rows[next](); after && after(); }
      });
      return b;
    }
    var prev = make('prev', 'Previous'), next = make('next', 'Next');
    var mq = window.matchMedia('(max-width: 1023px)');
    function sync() {
      if (mq.matches) { section.appendChild(prev); section.appendChild(next); update(); }
      else { prev.remove(); next.remove(); }
    }
    function update() {
      var i = indexFn();
      prev.disabled = i <= 0;
      next.disabled = i >= rows.length - 1;
    }
    sync();
    mq.addEventListener && mq.addEventListener('change', sync);
    return update;
  }

  function initHoverSwap() {
    var swipe = '(max-width: 1023px)';
    function bind(section, rowSel, imgSel, numSel, hasReveal, figureSel) {
      var img = qs(imgSel, section);
      var num = numSel ? qs(numSel, section) : null;
      var rows = qsa(rowSel, section);
      if (!img || !rows.length) return;
      var list = rows[0].closest('ol, ul');
      var activators = [];

      function apply(row) {
        var src = row.getAttribute('data-ts-img') || row.getAttribute('data-lr-img');
        if (src) img.src = src;
        if (num) num.textContent = row.getAttribute('data-ts-num') || num.textContent;
      }
      rows.forEach(function (row) {
        function activate() {
          rows.forEach(function (r) { r.classList.toggle('is-active', r === row); });
          if (hasReveal) {
            var fig = qs(figureSel, section);
            if (fig) {
              fig.classList.add('is-instant');
              section.classList.remove('is-revealed');
              apply(row);
              void fig.offsetWidth;
              fig.classList.remove('is-instant');
              section.classList.add('is-revealed');
            } else { apply(row); }
          } else { apply(row); }
        }
        row.addEventListener('mouseenter', activate);
        row.addEventListener('focus', activate);
        activators.push(activate);
      });
      if (hasReveal && list) {
        list.addEventListener('mouseleave', function () { section.classList.remove('is-revealed'); });
        list.addEventListener('focusout', function (e) {
          if (!list.contains(e.relatedTarget)) section.classList.remove('is-revealed');
        });
      }
      function index() {
        var i = rows.findIndex(function (r) { return r.classList.contains('is-active'); });
        return i === -1 ? 0 : i;
      }
      var fig = qs(figureSel, section);
      var update = buildSwipeButtons(hasReveal ? fig || section : section, activators, index);

      /* pointer drag on the figure (mobile) */
      if (fig && rows.length > 1) {
        var startX = 0, startY = 0, dragging = false, decided = false;
        fig.addEventListener('pointerdown', function (e) {
          if (!window.matchMedia(swipe).matches) return;
          dragging = true; decided = false; startX = e.clientX; startY = e.clientY;
        });
        fig.addEventListener('pointermove', function (e) {
          if (!dragging || decided) return;
          var dx = e.clientX - startX, dy = e.clientY - startY;
          if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }
          if (Math.abs(dx) < 36) return;
          decided = true;
          var i = index();
          var target = clamp(i + (dx < 0 ? 1 : -1), 0, rows.length - 1);
          if (target !== i) { activators[target](); update && update(); }
        }, { passive: true });
        ['pointerup', 'pointercancel'].forEach(function (ev) { fig.addEventListener(ev, function () { dragging = false; }); });
        qsa('img', fig).forEach(function (im) { im.draggable = false; });
      }
      return update;
    }
    qsa('[data-top-sneakers]').forEach(function (s) {
      bind(s, '.tsneak__row', '[data-ts-image]', '[data-ts-number]', true, '.tsneak__figure');
    });
    qsa('[data-latest-reborn]').forEach(function (s) {
      bind(s, '.lreborn__row', '[data-lr-image]', null, false, '.lreborn__figure');
    });
  }

  /* ─────────────────────────────────────────────────────────
     10 · TRENDING SWIPER
     ───────────────────────────────────────────────────────── */
  function initTrendSlider() {
    if (!window.Swiper) return;
    qsa('[data-trend-slider]').forEach(function (el) {
      var offset = function () { return Math.max(0, (window.innerWidth - Math.min(0.89 * window.innerWidth, 1710)) / 2); };
      var swiper = new window.Swiper(el, {
        a11y: { slideRole: 'listitem' },
        keyboard: { enabled: true, onlyInViewport: true },
        slidesPerView: 1,
        spaceBetween: 24,
        watchOverflow: true,
        slidesOffsetBefore: offset(),
        slidesOffsetAfter: offset(),
        grabCursor: true,
        rewind: true,
        autoplay: { delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true, enabled: false },
        navigation: {
          prevEl: el.querySelector('[data-trend-prev]'),
          nextEl: el.querySelector('[data-trend-next]')
        },
        breakpoints: {
          768: { slidesPerView: 1.4, spaceBetween: 96 },
          1200: { slidesPerView: 2.8, spaceBetween: 96 }
        },
        on: {
          resize: function (s) {
            s.params.slidesOffsetBefore = offset();
            s.params.slidesOffsetAfter = offset();
            s.update();
          },
          afterInit: function (s) {
            if (!('IntersectionObserver' in window)) return;
            new IntersectionObserver(function (entries) {
              if (entries[0].isIntersecting) s.autoplay.start(); else s.autoplay.stop();
            }, { threshold: 0.35 }).observe(s.el);
          },
          slideChange: function (s) {
            var last = s.slides.length - 1;
            if (s.activeIndex === last - 1 && s.previousIndex < s.activeIndex && !s.isEnd) {
              var gap = Math.abs(s.maxTranslate() - s.translate);
              var step = s.slidesSizesGrid[last] + (s.params.spaceBetween || 0);
              if (gap < 0.6 * step) s.slideTo(last);
            }
          }
        }
      });
      return swiper;
    });
  }

  /* ─────────────────────────────────────────────────────────
     11 · AUCTION TIMERS
     ───────────────────────────────────────────────────────── */
  function initTimers() {
    var cards = qsa('[data-auction-id]');
    if (!cards.length) return;
    cards.forEach(function (card) {
      var ends = parseInt(card.getAttribute('data-ends-at'), 10) || 0;
      if (!ends || ends < Date.now() / 1000) {
        var base = 12 * 3600 + 14 * 60 + 2;
        card.setAttribute('data-ends-at', String(Math.floor(Date.now() / 1000) + base + Math.floor(Math.random() * 600)));
      }
    });
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function seg(n, unit) {
      return '<span class="js-timer__seg"><b>' + n + '</b><i>' + unit + '</i></span>';
    }
    function fmt(secs) {
      if (secs <= 0) return '<span class="trend__ended">Ended</span>';
      var d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600),
          m = Math.floor((secs % 3600) / 60), s = secs % 60;
      return (d ? seg(d, 'D') : '') + seg(pad2(h), 'H') + seg(pad2(m), 'M') + seg(pad2(s), 'S');
    }
    function tick() {
      var now = Math.floor(Date.now() / 1000);
      qsa('.js-timer').forEach(function (t) {
        var card = t.closest('[data-auction-id]');
        var ends = card ? parseInt(card.getAttribute('data-ends-at'), 10) : 0;
        if (!ends) return;
        var left = ends - now;
        var html = fmt(left);
        if (t.dataset.last !== String(left)) { t.innerHTML = html; t.dataset.last = String(left); }
        t.classList.toggle('is-closing', left > 0 && left < 3600);
      });
    }
    tick();
    setInterval(tick, 1000);

    /* clock tick sound while hovering a timer */
    var lastHover = 0;
    doc.addEventListener('pointerover', function (e) {
      if (!e.target.closest || !e.target.closest('.js-timer')) return;
      if (e.relatedTarget && e.target.closest('.js-timer').contains(e.relatedTarget)) return;
      if (!Sound.isOn()) return;
      var now = performance.now();
      if (now - lastHover < 700) return;
      lastHover = now;
      Sound.play('clock', 0.2, 0.12);
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────────────────
     12 · BID MODAL
     ───────────────────────────────────────────────────────── */
  function initBidModal() {
    var modal = qs('.bid-modal');
    if (!modal) return;
    var lot = qs('.js-modal-lot', modal), min = qs('.js-modal-min', modal);
    var cancel = qs('.bid-modal__cancel', modal);
    var backdrop = qs('.bid-modal__backdrop', modal);
    var lastFocus = null;

    function open(id, minimum) {
      if (lot) lot.textContent = '#' + id;
      if (min) min.textContent = Number(minimum || 0).toFixed(2) + ' €';
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      lastFocus = doc.activeElement;
      scrollLock(true);
      doc.dispatchEvent(new CustomEvent('nocturne:sfx', { detail: 'gavel' }));
      setTimeout(function () { cancel && cancel.focus(); }, 120);
    }
    function close() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      scrollLock(false);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    qsa('[data-bid-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        open(btn.getAttribute('data-bid-open'), btn.getAttribute('data-min'));
      });
    });
    cancel && cancel.addEventListener('click', close);
    backdrop && backdrop.addEventListener('click', close);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });
    var confirm = qs('.bid-modal__confirm', modal);
    confirm && confirm.addEventListener('click', function (e) {
      e.preventDefault();
      close();
      showWhisper('Bid registered', 'An archivist will confirm your standing by email before the hammer falls.');
    });
  }

  /* ─────────────────────────────────────────────────────────
     13 · MENU
     ───────────────────────────────────────────────────────── */
  function initMenu() {
    var btn = qs('.menu-toggle');
    var menu = qs('#site-menu');
    if (!btn || !menu) return;
    var links = qsa('a', menu);
    function setOpen(on) {
      root.classList.toggle('menu-open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      scrollLock(on);
      if (on) {
        setTimeout(function () { menu.setAttribute('tabindex', '-1'); menu.focus({ preventScroll: true }); }, 320);
      }
    }
    btn.addEventListener('click', function () {
      var on = !root.classList.contains('menu-open');
      setOpen(on);
      doc.dispatchEvent(new CustomEvent('nocturne:sfx', { detail: 'wind' }));
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) { setOpen(false); btn.focus(); }
    });

    /* hover sounds tuned per link, like the reference */
    var map = { vaults: 'chest', footwear: 'steps', auctions: 'gavel', source: 'shimmer', atelier: 'steps', journal: 'shimmer' };
    links.forEach(function (a) {
      a.addEventListener('pointerenter', function () {
        var key = (a.getAttribute('href') || '').replace('#', '');
        var s = map[key] || 'shimmer';
        doc.dispatchEvent(new CustomEvent('nocturne:sfx', { detail: s }));
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
     14 · WHISPER TOAST
     ───────────────────────────────────────────────────────── */
  var whisperTimers = [];
  function showWhisper(title, line, sticky) {
    var box = qs('.whisper');
    if (!box) return;
    var t = qs('.whisper__title', box), l = qs('.whisper__line', box);
    if (t) t.textContent = title;
    if (l) l.textContent = line;
    box.classList.add('is-shown');
    whisperTimers.forEach(clearTimeout); whisperTimers = [];
    if (!sticky) whisperTimers.push(setTimeout(function () { box.classList.remove('is-shown'); }, 6000));
  }
  function initWhisper() {
    var box = qs('.whisper');
    if (!box) return;
    var close = qs('.whisper__close', box);
    close && close.addEventListener('click', function () { box.classList.remove('is-shown'); });
    var lines = [
      'What the ordinary call obsession, the house calls devotion.',
      'Every relic here has outlived the hype that made it.',
      'The night does not negotiate. Neither does the archive.',
      'Restraint is the rarest silhouette.'
    ];
    setTimeout(function () {
      showWhisper('House Whisper', lines[Math.floor(Math.random() * lines.length)]);
    }, 5200);
  }

  /* ─────────────────────────────────────────────────────────
     15 · COOKIE CONSENT
     ───────────────────────────────────────────────────────── */
  function initCookies() {
    var bar = qs('.rfc-consent'), backdrop = qs('.rfc-backdrop'), modal = qs('.rfc-modal');
    var floating = qsa('[data-cookie-settings]');
    if (!bar) return;
    var KEY = 'nocturne-consent';
    function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
    function hideBar() { bar.hidden = true; if (backdrop) backdrop.hidden = true; }
    function showBar() { bar.hidden = false; if (backdrop) backdrop.hidden = true; }

    if (get()) hideBar();
    else setTimeout(showBar, 1400);

    qsa('.rfc-accept-all').forEach(function (b) {
      b.addEventListener('click', function () { set('all'); hideBar(); modal && (modal.hidden = true); });
    });
    qsa('.rfc-reject-all').forEach(function (b) {
      b.addEventListener('click', function () { set('essential'); hideBar(); modal && (modal.hidden = true); });
    });
    qsa('.rfc-customize').forEach(function (b) {
      b.addEventListener('click', function () { modal && (modal.hidden = false); });
    });
    var save = qs('.rfc-save');
    save && save.addEventListener('click', function (e) {
      e.preventDefault();
      set('custom'); hideBar(); if (modal) modal.hidden = true;
    });
    qsa('.rfc-close, .rfc-close-modal, .rfc-modal-backdrop').forEach(function (el) {
      el.addEventListener('click', function () { if (modal) modal.hidden = true; });
    });
    var barClose = qs('.rfc-close', bar);
    barClose && barClose.addEventListener('click', function () { set('dismissed'); hideBar(); });
    floating.forEach(function (f) {
      f.addEventListener('click', function () { if (modal) modal.hidden = false; });
    });
    if (backdrop) backdrop.addEventListener('click', hideBar);
  }

  /* ─────────────────────────────────────────────────────────
     16 · FOOTER CLOUDS (CSS parallax + pointer)
     ───────────────────────────────────────────────────────── */
  function initFooterClouds() {
    var host = qs('[data-clouds-3d]');
    if (!host) return;
    var back = doc.createElement('div'); back.className = 'clouds-parallax__back';
    var front = doc.createElement('div'); front.className = 'clouds-parallax__front';
    var wrap = doc.createElement('div'); wrap.className = 'clouds-parallax';
    var bImg = new Image(); bImg.src = host.getAttribute('data-tex-back'); bImg.alt = '';
    var fImg = new Image(); fImg.src = host.getAttribute('data-tex-front'); fImg.alt = '';
    bImg.className = 'clouds-parallax__back'; fImg.className = 'clouds-parallax__front';
    wrap.appendChild(bImg); wrap.appendChild(fImg);
    host.appendChild(wrap);

    if (!gsap || !ScrollTrigger || reduced) return;
    gsap.fromTo(bImg, { y: 70, scale: 1.06 }, {
      y: -30, scale: 1.02, ease: 'none',
      scrollTrigger: { trigger: host, start: 'top bottom', end: 'bottom bottom', scrub: true }
    });
    gsap.fromTo(fImg, { y: 110, scale: 1.1 }, {
      y: -10, scale: 1.04, ease: 'none',
      scrollTrigger: { trigger: host, start: 'top bottom', end: 'bottom bottom', scrub: true }
    });

    if (!finePointer) return;
    var tx = 0, ty = 0, cx = 0, cy = 0, inside = false;
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!inside) { inside = true; if (Sound.isOn()) Sound.windOn(true); }
    }, { passive: true });
    host.addEventListener('pointerleave', function () {
      inside = false; tx = 0; ty = 0;
    });
    (function raf() {
      cx = lerp(cx, tx, 0.06); cy = lerp(cy, ty, 0.06);
      bImg.style.setProperty('--px', (cx * -14).toFixed(2) + 'px');
      bImg.style.setProperty('--py', (cy * -8).toFixed(2) + 'px');
      fImg.style.setProperty('--px', (cx * -26).toFixed(2) + 'px');
      fImg.style.setProperty('--py', (cy * -14).toFixed(2) + 'px');
      bImg.style.translate = (cx * -14).toFixed(2) + 'px ' + (cy * -8).toFixed(2) + 'px';
      fImg.style.translate = (cx * -26).toFixed(2) + 'px ' + (cy * -14).toFixed(2) + 'px';
      requestAnimationFrame(raf);
    })();
  }

  /* ─────────────────────────────────────────────────────────
     17 · NEWSLETTER
     ───────────────────────────────────────────────────────── */
  function initNewsletter() {
    var form = qs('.night-form');
    if (!form) return;
    var input = qs('input[type=email]', form);
    var note = qs('.night-form__note', form);
    var btn = qs('.wpforms-submit', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = (input.value || '').trim();
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
      if (!ok) {
        note.textContent = 'That address will not open the door. Try again.';
        note.classList.add('is-error');
        input.focus();
        doc.dispatchEvent(new CustomEvent('nocturne:sfx', { detail: 'descent' }));
        return;
      }
      note.classList.remove('is-error');
      note.textContent = 'You are on the list. Watch the night for the first drop.';
      if (btn) { btn.textContent = 'Welcome in'; btn.disabled = true; }
      input.value = '';
      doc.dispatchEvent(new CustomEvent('nocturne:sfx', { detail: 'shimmer' }));
      showWhisper('Welcome to the night list', 'First refusal on vault drops lands in your inbox before it lands anywhere else.');
    });
  }

  /* ─────────────────────────────────────────────────────────
     18 · REVEALS / COUNTERS
     ───────────────────────────────────────────────────────── */
  function initReveals() {
    if (!gsap || !ScrollTrigger || reduced) return;
    qsa('[data-reveal]').forEach(function (el) {
      gsap.from(el, {
        y: 40, opacity: 0, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      });
    });
    qsa('[data-count]').forEach(function (el) {
      var match = el.textContent.trim().match(/^([^0-9]*)([0-9][0-9.,\s]*?)([^0-9.,\s]*)$/);
      if (!match) return;
      var value = parseFloat(match[2].replace(/[.,\s]/g, ''));
      if (!isFinite(value)) return;
      var obj = { n: 0 };
      el.style.fontVariantNumeric = 'tabular-nums';
      gsap.to(obj, {
        n: value, duration: 2, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: function () { el.textContent = match[1] + Math.round(obj.n) + match[3]; }
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
     19 · ANCHORS
     ───────────────────────────────────────────────────────── */
  function initAnchors() {
    qsa('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#' || id.length < 2) return;
        var target = doc.getElementById(id.slice(1));
        if (!target) return;
        e.preventDefault();
        if (root.classList.contains('menu-open')) {
          root.classList.remove('menu-open');
          var btn = qs('.menu-toggle');
          btn && btn.setAttribute('aria-expanded', 'false');
          scrollLock(false);
        }
        if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
        else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
        history.replaceState(null, '', id);
      });
    });
  }

  /* ─────────────────────────────────────────────────────────
     20 · RITUAL (type the word)
     ───────────────────────────────────────────────────────── */
  function initRitual() {
    console.log('%cNOCTURNE%c\n\nDecode the night. Built by hand, after midnight.\n\nYou read consoles. Good. Type the name of the house anywhere on the page.',
      'font-size:28px;font-style:italic;letter-spacing:0.3em;color:#ad6646;',
      'font-size:12px;color:#999;');
    var word = 'nocturne', typed = 0;
    doc.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      var ch = (e.key || '').toLowerCase();
      if (ch === word[typed]) {
        typed++;
        if (typed === word.length) {
          typed = 0;
          var ring = qs('.cursor-ring');
          ring && ring.classList.add('is-blessed');
          try { localStorage.setItem('nocturne-blessed', '1'); } catch (err) {}
          doc.dispatchEvent(new CustomEvent('nocturne:sfx', { detail: 'wind' }));
          showWhisper('You looked closer.', 'The house marks you. From now on the cursor keeps a gilded edge.');
        }
      } else { typed = ch === word[0] ? 1 : 0; }
    });
    try {
      if (localStorage.getItem('nocturne-blessed') === '1') {
        var ring = qs('.cursor-ring');
        ring && ring.classList.add('is-blessed');
      }
    } catch (err) {}
  }

  /* ─────────────────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────────────────── */
  function boot() {
    initLenis();
    initMenu();
    initCursor();
    initHero3D();
    initManifesto();
    initMysteryBox();
    initTypewriter();
    initHoverSwap();
    initTrendSlider();
    initTimers();
    initBidModal();
    initReveals();
    initFooterClouds();
    initNewsletter();
    initAnchors();
    initSoundUI();
    initWhisper();
    initCookies();
    initRitual();
    initPreloader();

    window.addEventListener('load', function () {
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
    window.addEventListener('resize', function () {
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
