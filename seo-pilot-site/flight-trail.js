/* ==========================================================================
   Flight Trail — scroll-guided animation engine for TheSEOPilot
   Adds a paper plane that tracks scroll, a runway progress bar,
   word-by-word hero reveal, counter animations, and altitude badge.
   ========================================================================== */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --------------------------------------------------------------
     1. Mount the chrome (progress bar, plane trail, altitude badge)
     -------------------------------------------------------------- */

  function mountChrome() {
    if (document.querySelector(".fp-progress")) return;

    // top progress bar
    const progress = document.createElement("div");
    progress.className = "fp-progress";
    progress.innerHTML = '<div class="fp-progress__bar"></div>';
    document.body.appendChild(progress);

    // paper plane trail (right edge)
    const trail = document.createElement("div");
    trail.className = "fp-trail";
    trail.setAttribute("aria-hidden", "true");
    trail.innerHTML = `
      <div class="fp-trail__path"></div>
      <div class="fp-plane">
        <div class="fp-plane__pulse"></div>
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 2 L2 14 L13 17 L16 28 Z"
                fill="currentColor"
                stroke="#1a1f36"
                stroke-width="1.2"
                stroke-linejoin="round"/>
          <path d="M13 17 L18 12"
                stroke="#1a1f36"
                stroke-width="1.2"
                stroke-linecap="round"/>
        </svg>
      </div>
    `;
    document.body.appendChild(trail);

    // altitude readout
    const alt = document.createElement("div");
    alt.className = "fp-altitude";
    alt.innerHTML = '<span class="fp-altitude__icon"></span><span class="fp-altitude__label">Pre-flight</span>';
    document.body.appendChild(alt);
  }

  /* --------------------------------------------------------------
     2. Scroll progress → CSS vars + plane position + tilt
     -------------------------------------------------------------- */

  let lastScrollY = 0;
  let lastTime = performance.now();
  let smoothedTilt = 0;
  let rafPending = false;

  function updateProgress() {
    rafPending = false;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const docH = Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      1
    );
    const progress = Math.min(Math.max(scrollY / docH, 0), 1);

    // tilt based on instantaneous velocity (px/ms)
    const now = performance.now();
    const dy = scrollY - lastScrollY;
    const dt = Math.max(now - lastTime, 1);
    const velocity = dy / dt; // px/ms — typical fast scroll ~ 2-4
    // map velocity to -25deg..+25deg, ease toward zero when idle
    const targetTilt = Math.max(-25, Math.min(25, velocity * 6));
    smoothedTilt += (targetTilt - smoothedTilt) * 0.35;

    // plane vertical position (relative to its starting top)
    const trail = document.querySelector(".fp-trail");
    const planeYRange = trail ? trail.clientHeight - 160 : window.innerHeight - 160;
    const planeY = progress * planeYRange;

    const root = document.documentElement;
    root.style.setProperty("--fp-progress", progress.toFixed(4));
    root.style.setProperty("--fp-plane-y", planeY.toFixed(1) + "px");
    if (!reduceMotion) {
      root.style.setProperty("--fp-plane-tilt", smoothedTilt.toFixed(2) + "deg");
    }

    lastScrollY = scrollY;
    lastTime = now;
  }

  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(updateProgress);
  }

  /* --------------------------------------------------------------
     3. Altitude badge — show section label as it enters viewport
     -------------------------------------------------------------- */

  const SECTION_LABELS = {
    "audience":  "Fold 1 · Who",
    "problem":   "Fold 2 · Problem",
    "services":  "Fold 3 · Services",
    "plans":     "Fold 4 · Plans",
    "compare":   "Fold 5 · Edge",
    "proof":     "Fold 6 · Results",
    "faq":       "Fold 7 · FAQ",
    "contact":   "Fold 8 · Contact",
  };

  function setupAltitudeBadge() {
    const badge = document.querySelector(".fp-altitude");
    if (!badge) return;
    const label = badge.querySelector(".fp-altitude__label");
    const sections = document.querySelectorAll("section[id]");
    if (!sections.length) return;

    const obs = new IntersectionObserver((entries) => {
      // pick the section most in view
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const id = visible.target.id;
        const text = SECTION_LABELS[id] || id;
        if (label.textContent !== text) {
          label.textContent = text;
        }
        badge.classList.add("fp-altitude--visible");
      }
    }, {
      threshold: [0.25, 0.5, 0.75],
      rootMargin: "-15% 0px -35% 0px",
    });

    sections.forEach((s) => obs.observe(s));

    // hide while in the hero
    const hero = document.querySelector(".hero");
    if (hero) {
      const heroObs = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.intersectionRatio > 0.4) {
            badge.classList.remove("fp-altitude--visible");
          }
        });
      }, { threshold: [0, 0.4, 0.7] });
      heroObs.observe(hero);
    }
  }

  /* --------------------------------------------------------------
     4. Staggered children — add per-child --fp-i delay var
     -------------------------------------------------------------- */

  function setupStaggers() {
    document.querySelectorAll("[data-fp-stagger]").forEach((parent) => {
      const children = parent.children;
      for (let i = 0; i < children.length; i++) {
        children[i].style.setProperty("--fp-i", i);
      }
    });
  }

  /* --------------------------------------------------------------
     5. Count-up numbers for .fp-counter
     -------------------------------------------------------------- */

  function animateCounter(el) {
    const target = parseFloat(el.dataset.fpTo);
    const suffix = el.dataset.fpSuffix || "";
    const prefix = el.dataset.fpPrefix || "";
    const duration = parseInt(el.dataset.fpDuration || "1400", 10);
    const decimals = parseInt(el.dataset.fpDecimals || "0", 10);

    if (isNaN(target)) return;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = (target * eased).toFixed(decimals);
      el.textContent = prefix + value + suffix;
      if (t < 1) requestAnimationFrame(tick);
      else el.classList.add("fp-counter--done");
    }
    requestAnimationFrame(tick);
  }

  function setupCounters() {
    const counters = document.querySelectorAll(".fp-counter");
    if (!counters.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !e.target.dataset.fpDone) {
          e.target.dataset.fpDone = "1";
          if (reduceMotion) {
            const v = parseFloat(e.target.dataset.fpTo);
            e.target.textContent =
              (e.target.dataset.fpPrefix || "") +
              v.toFixed(parseInt(e.target.dataset.fpDecimals || "0", 10)) +
              (e.target.dataset.fpSuffix || "");
            e.target.classList.add("fp-counter--done");
          } else {
            animateCounter(e.target);
          }
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach((c) => obs.observe(c));
  }

  /* --------------------------------------------------------------
     6. Hero headline — split into words for staggered reveal
     -------------------------------------------------------------- */

  function setupHeroLaunch() {
    const headline = document.querySelector(".hero-headline");
    if (!headline || headline.dataset.fpLaunched) return;
    headline.dataset.fpLaunched = "1";
    headline.classList.add("fp-launch");

    // capture the original text (single text node preferred)
    const text = headline.textContent.trim();
    headline.textContent = "";

    // pick an accent word to highlight (longest meaningful word > 5 chars)
    const words = text.split(/\s+/);
    let accentIdx = -1;
    let accentLen = 0;
    const accentCandidates = ["revenue", "ai", "visibility", "growth", "results", "seo"];
    words.forEach((w, i) => {
      const clean = w.replace(/[^a-zA-Z]/g, "").toLowerCase();
      if (accentCandidates.includes(clean)) {
        accentIdx = i;
      } else if (accentIdx === -1 && clean.length > accentLen) {
        accentLen = clean.length;
        accentIdx = i;
      }
    });

    words.forEach((w, i) => {
      const span = document.createElement("span");
      span.className = "fp-word" + (i === accentIdx ? " fp-word--accent" : "");
      span.textContent = w;
      span.style.animationDelay = (0.1 + i * 0.09) + "s";
      headline.appendChild(span);
      // ensure a trailing space is preserved between words
      headline.appendChild(document.createTextNode(" "));
    });
  }

  /* --------------------------------------------------------------
     7. Cockpit gauge + runway lights — inject into hero
     -------------------------------------------------------------- */

  function setupHeroChrome() {
    const hero = document.querySelector(".hero");
    if (!hero || hero.dataset.fpChrome) return;
    hero.dataset.fpChrome = "1";

    // cockpit gauge
    const cockpit = document.createElement("div");
    cockpit.className = "fp-cockpit";
    cockpit.setAttribute("aria-hidden", "true");
    cockpit.innerHTML = `
      <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="fpGaugeBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#0e1226"/>
            <stop offset="100%" stop-color="#1a1f36"/>
          </radialGradient>
        </defs>
        <!-- outer ring -->
        <circle cx="60" cy="60" r="56" fill="url(#fpGaugeBg)" stroke="rgba(246,201,92,0.45)" stroke-width="1.5"/>
        <!-- minor ticks -->
        ${Array.from({length: 36}).map((_, i) => {
          const ang = (i / 36) * Math.PI * 2;
          const x1 = 60 + Math.cos(ang) * 48;
          const y1 = 60 + Math.sin(ang) * 48;
          const x2 = 60 + Math.cos(ang) * (i % 3 === 0 ? 42 : 45);
          const y2 = 60 + Math.sin(ang) * (i % 3 === 0 ? 42 : 45);
          return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="rgba(255,255,255,0.45)" stroke-width="${i % 3 === 0 ? 1.4 : 0.8}"/>`;
        }).join("")}
        <!-- radar sweep -->
        <g class="fp-cockpit__sweep">
          <path d="M60 60 L60 8 A52 52 0 0 1 100 38 Z" fill="rgba(246,201,92,0.18)"/>
        </g>
        <!-- needle -->
        <g class="fp-cockpit__needle">
          <line x1="60" y1="60" x2="60" y2="14" stroke="#f6c95c" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="60" cy="14" r="3" fill="#f6c95c"/>
        </g>
        <!-- center hub -->
        <circle cx="60" cy="60" r="5" fill="#f6c95c" stroke="#1a1f36" stroke-width="1.4"/>
        <!-- label -->
        <text x="60" y="92" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-family="DM Sans, sans-serif" font-size="8" letter-spacing="1.5">VISIBILITY</text>
      </svg>
    `;
    hero.appendChild(cockpit);

    // runway lights
    const lights = document.createElement("div");
    lights.className = "fp-runway-lights";
    lights.setAttribute("aria-hidden", "true");
    hero.appendChild(lights);

    // scroll cue
    const cue = document.createElement("div");
    cue.className = "fp-scroll-cue";
    cue.setAttribute("aria-hidden", "true");
    cue.innerHTML = `
      <span>Begin Descent</span>
      <span class="fp-scroll-cue__line"></span>
    `;
    hero.appendChild(cue);
  }

  /* --------------------------------------------------------------
     8. Mark trust stats as counters automatically
     -------------------------------------------------------------- */

  function setupHeroTrustCounters() {
    const trust = document.querySelector(".hero-trust");
    if (!trust) return;
    trust.querySelectorAll("strong").forEach((el) => {
      if (el.dataset.fpDone || el.classList.contains("fp-counter")) return;
      const raw = el.textContent.trim();
      const m = raw.match(/^(\D*)(\d+(?:\.\d+)?)(\D*)$/);
      if (!m) return;
      const prefix = m[1];
      const num = parseFloat(m[2]);
      const suffix = m[3];
      el.classList.add("fp-counter");
      el.dataset.fpTo = String(num);
      el.dataset.fpPrefix = prefix;
      el.dataset.fpSuffix = suffix;
      el.dataset.fpDuration = "1400";
      el.dataset.fpDecimals = num % 1 === 0 ? "0" : "1";
      el.textContent = prefix + "0" + suffix;
    });
  }

  /* --------------------------------------------------------------
     Boot
     -------------------------------------------------------------- */

  function boot() {
    mountChrome();
    setupHeroChrome();
    setupHeroLaunch();
    setupHeroTrustCounters();
    setupStaggers();
    setupCounters();
    setupAltitudeBadge();

    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
