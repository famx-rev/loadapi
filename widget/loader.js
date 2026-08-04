// File: pages/api/widget/loader.js
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  const script = `/**
 * Loadbar widget loader
 */
(function () {
  'use strict';

  var thisScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  var startupId = thisScript.getAttribute('data-startup-id');
  if (!startupId) {
    console.warn('[Loadbar] Missing data-startup-id attribute');
    return;
  }

  var apiBase = 'https://loadapi.vercel.app';
  var BAR_HEIGHT = 44;

  function gradient(s) {
    var from = (s && s.accent_from) || '#3dd79e';
    var to = (s && s.accent_to) || '#0b9a6c';
    return 'linear-gradient(135deg, ' + from + ', ' + to + ')';
  }

  function track(kind, extra) {
    var payload = { startup_id: startupId, kind: kind };
    if (extra) {
      for (var k in extra) {
        if (extra.hasOwnProperty(k)) payload[k] = extra[k];
      }
    }
    try {
      fetch(apiBase + '/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function detectDevice() {
    var ua = navigator.userAgent || '';
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  var serveUrl = apiBase + '/api/serve?startup_id=' + encodeURIComponent(startupId);

  fetch(serveUrl)
    .then(function (r) {
      if (!r.ok) throw new Error('serve failed');
      return r.json();
    })
    .then(function (data) {
      if (!data) return;
      // Show ONLY the promotion. Fallback to startup if no promotion is available.
      var promoToShow = data.promotion || data.startup;
      if (!promoToShow) return;
      
      renderBar(promoToShow);
    })
    .catch(function (e) {
      console.warn('[Loadbar] Could not load bar:', e.message || e);
    });

  function shiftFixedElement(el, root) {
    try {
      if (!el || el.nodeType !== 1) return;
      if (el === root || (root && root.contains && root.contains(el))) return;
      if (el.dataset && el.dataset.loadbarShifted === '1') return;

      var cs = window.getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') return;

      var topRaw = cs.top;
      if (!topRaw || topRaw === 'auto') return;
      if (!/px$/.test(topRaw)) return;

      var originalPx = parseFloat(topRaw);
      if (isNaN(originalPx)) return;

      el.dataset.loadbarOriginalTop = el.style.top || '';
      el.style.top = (originalPx + BAR_HEIGHT) + 'px';
      el.dataset.loadbarShifted = '1';
    } catch (e) {}
  }

  function sweepFixedElements(root) {
    try {
      var nodes = document.querySelectorAll('*');
      for (var i = 0; i < nodes.length; i++) {
        shiftFixedElement(nodes[i], root);
      }
    } catch (e) {}
  }

  function unshiftFixedElements() {
    try {
      var nodes = document.querySelectorAll('[data-loadbar-shifted="1"]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        el.style.top = el.dataset.loadbarOriginalTop || '';
        delete el.dataset.loadbarOriginalTop;
        delete el.dataset.loadbarShifted;
      }
    } catch (e) {}
  }

  function renderBar(promotion) {
    if (document.getElementById('loadbar-root')) return;

    var html = document.documentElement;
    var body = document.body;

    var originalBodyPaddingTop = body ? body.style.paddingTop || '' : '';
    var originalScrollPaddingTop = html ? html.style.scrollPaddingTop || '' : '';

    var root = document.createElement('div');
    root.id = 'loadbar-root';
    root.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
      'font-size:13px;line-height:1.4;';

    var bar = document.createElement('div');
    bar.style.cssText =
      'display:flex;align-items:center;gap:10px;height:' + BAR_HEIGHT + 'px;width:100%;' +
      'padding:0 14px;background:rgba(255,255,255,0.92);' +
      'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
      'border-bottom:1px solid rgba(0,0,0,0.08);box-sizing:border-box;';

    // Brand Logo/Label
    var brand = document.createElement('div');
    brand.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
    var logo = document.createElement('span');
    logo.style.cssText =
      'width:14px;height:14px;border-radius:3px;display:inline-block;' +
      'background:' + gradient(promotion) + ';';
    var brandText = document.createElement('span');
    brandText.textContent = 'Loadbar';
    brandText.style.cssText =
      'font-size:11px;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:0.05em;color:#6b7280;';
    brand.appendChild(logo);
    brand.appendChild(brandText);

    var divider = document.createElement('span');
    divider.style.cssText = 'width:1px;height:14px;background:rgba(0,0,0,0.1);flex-shrink:0;';

    // Promoted Startup Content
    var profile = document.createElement('div');
    profile.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;flex:1;';

    var avatar = document.createElement('span');
    avatar.textContent = (promotion.name || '?')[0].toUpperCase();
    avatar.style.cssText =
      'width:22px;height:22px;border-radius:5px;display:flex;align-items:center;' +
      'justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;' +
      'background:' + gradient(promotion) + ';';

    var profileText = document.createElement('p');
    profileText.style.cssText =
      'margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4b5563;';
    var profileName = document.createElement('span');
    profileName.textContent = promotion.name || '';
    profileName.style.cssText = 'font-weight:600;color:#111827;';
    var profileTag = document.createElement('span');
    profileTag.textContent = promotion.tagline ? ' — ' + promotion.tagline : '';
    profileTag.style.cssText = 'color:#9ca3af;';
    profileText.appendChild(profileName);
    profileText.appendChild(profileTag);

    profile.appendChild(avatar);
    profile.appendChild(profileText);

    // "Visit" Action Link
    var visitBtn = document.createElement('a');
    visitBtn.href = promotion.url || '#';
    visitBtn.target = '_blank';
    visitBtn.rel = 'noopener noreferrer';
    visitBtn.textContent = 'Visit →';
    visitBtn.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;flex-shrink:0;' +
      'padding:4px 12px;border-radius:999px;font-size:11px;font-weight:500;' +
      'text-decoration:none;color:#111827;background:rgba(0,0,0,0.05);' +
      'transition:background 0.15s ease;cursor:pointer;margin-right:4px;';
    visitBtn.addEventListener('mouseenter', function () {
      visitBtn.style.background = 'rgba(0,0,0,0.1)';
    });
    visitBtn.addEventListener('mouseleave', function () {
      visitBtn.style.background = 'rgba(0,0,0,0.05)';
    });
    visitBtn.addEventListener('click', function () {
      track('click', {
        device: detectDevice(),
        referrer: window.location.hostname,
        promoted_id: promotion.id,
      });
    });

    // Close Button
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\\u00d7';
    closeBtn.setAttribute('aria-label', 'Close bar');
    closeBtn.style.cssText =
      'flex-shrink:0;border:none;background:transparent;font-size:18px;' +
      'color:#9ca3af;cursor:pointer;padding:0 4px;line-height:1;';
    closeBtn.addEventListener('click', function () {
      root.remove();
      if (body) body.style.paddingTop = originalBodyPaddingTop;
      if (html) html.style.scrollPaddingTop = originalScrollPaddingTop;
      unshiftFixedElements();
    });

    bar.appendChild(brand);
    bar.appendChild(divider);
    bar.appendChild(profile);
    bar.appendChild(visitBtn);
    bar.appendChild(closeBtn);

    root.appendChild(bar);
    body.appendChild(root);

    // Adjust Page Offset
    if (body) {
      var existingPad = parseInt(window.getComputedStyle(body).paddingTop) || 0;
      body.style.paddingTop = (existingPad + BAR_HEIGHT) + 'px';
    }
    if (html) {
      html.style.scrollPaddingTop = BAR_HEIGHT + 'px';
    }

    // Adjust Fixed/Sticky Navigation Elements
    sweepFixedElements(root);
    setTimeout(function () { sweepFixedElements(root); }, 250);
    setTimeout(function () { sweepFixedElements(root); }, 800);

    track('impression', {
      device: detectDevice(),
      referrer: window.location.hostname,
      promoted_id: promotion.id,
    });
  }
})();`;

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.send(script);
}
