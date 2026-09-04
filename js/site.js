/* Braindump — progressive enhancements.
   Everything here is optional; the pages read fine without it. */
(function () {
  'use strict';

  var root = document.documentElement;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     Theme toggle
     --------------------------------------------------------------------- */
  (function () {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    function current() {
      return root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    function label() {
      var now = current();
      btn.textContent = now === 'dark' ? 'Light' : 'Dark';
      btn.setAttribute('aria-label', 'Switch to ' + (now === 'dark' ? 'light' : 'dark') + ' theme');
    }
    label();
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('bd-theme', next); } catch (e) {}
      label();
    });
  })();

  /* ---------------------------------------------------------------------
     Index filter  ("/" focuses the box from anywhere on the page)
     --------------------------------------------------------------------- */
  (function () {
    var box = document.querySelector('.note-search');
    var list = document.querySelector('.note-index');
    if (!box || !list) return;
    var empty = document.querySelector('.note-index-empty');
    var count = document.querySelector('.note-count');
    var items = Array.prototype.slice.call(list.children);
    var total = items.length;
    function apply() {
      var q = box.value.trim().toLowerCase();
      var shown = 0;
      items.forEach(function (li) {
        var hit = !q || li.textContent.toLowerCase().indexOf(q) !== -1;
        li.hidden = !hit;
        if (hit) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
      if (count) count.textContent = q ? shown + ' of ' + total + ' notes' : total + ' notes';
    }
    box.addEventListener('input', apply);
    if (box.value) apply();
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== box &&
          !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        box.focus();
        box.select();
      }
    });
  })();

  /* ---------------------------------------------------------------------
     Flashcards: click, Enter or Space reveals the back
     --------------------------------------------------------------------- */
  (function () {
    var cards = document.querySelectorAll('.anki-card');
    if (!cards.length) return;
    Array.prototype.forEach.call(cards, function (card) {
      var btn = card.querySelector('.anki-reveal');
      var revealed = false;
      function toggle() {
        revealed = !revealed;
        card.classList.toggle('is-revealed', revealed);
        Array.prototype.forEach.call(card.querySelectorAll('.anki-back, .anki-extra'), function (el) {
          el.hidden = !revealed;
        });
        if (btn) btn.textContent = revealed ? 'Hide' : 'Reveal';
      }
      if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        toggle();
      });
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  })();

  /* ---------------------------------------------------------------------
     Code blocks: copy button
     --------------------------------------------------------------------- */
  (function () {
    if (!navigator.clipboard) return;
    Array.prototype.forEach.call(document.querySelectorAll('pre.code'), function (pre) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code');
      btn.addEventListener('click', function () {
        var code = pre.querySelector('code') || pre;
        navigator.clipboard.writeText(code.textContent.replace(/\n$/, '')).then(function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
        });
      });
      pre.appendChild(btn);
    });
  })();

  /* ---------------------------------------------------------------------
     Heading anchors
     --------------------------------------------------------------------- */
  (function () {
    var heads = document.querySelectorAll('article.note h2[id], article.note h3[id]');
    Array.prototype.forEach.call(heads, function (h) {
      if (h.closest('.references') || h.querySelector('.anchor')) return;
      var a = document.createElement('a');
      a.className = 'anchor';
      a.href = '#' + h.id;
      a.textContent = '#';
      a.setAttribute('aria-label', 'Link to this section');
      h.appendChild(a);
    });
  })();

  /* ---------------------------------------------------------------------
     Rare dropcap colouring — 7% of page loads, as on turntrout.com
     --------------------------------------------------------------------- */
  (function () {
    var article = document.querySelector('article.note');
    if (!article || Math.random() >= 0.07) return;
    var palette = ['#9a3b1b', '#3b6e8f', '#5d7a3b', '#7a5a9a', '#b08a2a', '#8a4a6a'];
    article.style.setProperty('--dropcap-ornament', palette[Math.floor(Math.random() * palette.length)]);
  })();

  /* ---------------------------------------------------------------------
     Link previews for internal notes (pointer devices only)
     --------------------------------------------------------------------- */
  (function () {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var links = document.querySelectorAll('article a[href]');
    if (!links.length) return;

    var cache = {};
    var pop = document.createElement('div');
    pop.className = 'popover';
    pop.hidden = true;
    pop.setAttribute('role', 'tooltip');
    document.body.appendChild(pop);

    var timer = null, current = null;

    function internal(a) {
      if (a.origin !== location.origin) return false;
      if (!/\.html$/.test(a.pathname)) return false;
      if (a.pathname === location.pathname) return false;
      if (a.closest('.site-header, .footer, .popover, .references h3')) return false;
      return true;
    }

    function summarise(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var title = (doc.querySelector('h1.title') || {}).textContent || '';
      var meta = doc.querySelector('meta[name="description"]');
      var desc = meta ? meta.getAttribute('content') : '';
      var date = (doc.querySelector('.info') || {}).textContent || '';
      return { title: title.trim(), desc: (desc || '').trim(), date: date.trim() };
    }

    function load(url) {
      if (cache[url]) return cache[url];
      cache[url] = fetch(url, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
        .then(summarise);
      return cache[url];
    }

    function place(a) {
      var r = a.getBoundingClientRect();
      var w = pop.offsetWidth, h = pop.offsetHeight;
      var x = r.left + window.scrollX;
      var y = r.bottom + window.scrollY + 8;
      if (x + w > window.scrollX + document.documentElement.clientWidth - 12) {
        x = window.scrollX + document.documentElement.clientWidth - w - 12;
      }
      if (r.bottom + h + 16 > window.innerHeight) y = r.top + window.scrollY - h - 8;
      pop.style.left = Math.max(8, x) + 'px';
      pop.style.top = y + 'px';
    }

    function show(a) {
      var url = a.href.split('#')[0];
      load(url).then(function (d) {
        if (current !== a) return;
        pop.innerHTML = '';
        var t = document.createElement('div'); t.className = 'popover-title'; t.textContent = d.title;
        var m = document.createElement('div'); m.className = 'popover-meta'; m.textContent = d.date;
        var p = document.createElement('p'); p.textContent = d.desc;
        pop.appendChild(t);
        if (d.date) pop.appendChild(m);
        if (d.desc) pop.appendChild(p);
        pop.hidden = false;
        place(a);
      }).catch(function () { /* private or missing: no preview */ });
    }

    function hide() {
      clearTimeout(timer);
      current = null;
      pop.hidden = true;
    }

    Array.prototype.forEach.call(links, function (a) {
      if (!internal(a)) return;
      a.addEventListener('mouseenter', function () {
        clearTimeout(timer);
        current = a;
        timer = setTimeout(function () { show(a); }, 350);
      });
      a.addEventListener('mouseleave', function () {
        timer = setTimeout(hide, 200);
      });
      a.addEventListener('focus', function () { current = a; show(a); });
      a.addEventListener('blur', hide);
    });
    pop.addEventListener('mouseenter', function () { clearTimeout(timer); });
    pop.addEventListener('mouseleave', hide);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', function () { if (!pop.hidden) hide(); }, { passive: true });
  })();

  void prefersReducedMotion;
})();
