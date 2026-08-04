// File: pages/api/widget/loader.js
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  const script = `/**
 * Loadbar widget loader
 * Self-contained, no dependencies. Loads asynchronously.
 *
 * Usage:
 *   <script
 *     src="https://loadapi.vercel.app/api/widget/loader.js"
 *     data-startup-id="YOUR_ID"
 *   ></script>
 *
 * The script reads data-startup-id from its own <script> tag,
 * fetches the startup profile + a promoted startup, injects the bar,
 * and tracks impressions + clicks.
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

  // Use new Vercel API URL
  var apiBase = 'https://loadapi.vercel.app';

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
      if (!data || !data.startup) return;
      renderBar(data.startup, data.promotion);
    })
    .catch(function (e) {
      console.warn('[Loadbar] Could not load bar:', e.message || e);
    });

  function renderBar(startup, promotion) {
    if (document.getElementById('loadbar-root')) return;

    var root = document.createElement('div');
    root.id = 'loadbar-root';
    root.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
      'font-size:13px;line-height:1.4;';

    var bar = document.createElement('div');
    bar.style.cssText =
      'display:flex;align-items:center;gap:10px;height:44px;width:100%;' +
      'padding:0 14px;background:rgba(255,255,255,0.92);' +
      'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
      'border-bottom:1px solid rgba(0,0,0,0.08);box-sizing:border-box;';

    var brand = document.createElement('div');
    brand.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
    var logo = document.createElement('span');
    logo.style.cssText =
      'width:14px;height:14px;border-radius:3px;display:inline-block;' +
      'background:' + gradient(startup) + ';';
    var brandText = document.createElement('span');
    brandText.textContent = 'Loadbar';
    brandText.style.cssText =
      'font-size:11px;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:0.05em;color:#6b7280;';
    brand.appendChild(logo);
    brand.appendChild(brandText);

    var divider = document.createElement('span');
    divider.style.cssText = 'width:1px;height:14px;background:rgba(0,0,0,0.1);flex-shrink:0;';

    var profile = document.createElement('div');
    profile.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;flex:1;';

    var avatar = document.createElement('span');
    avatar.textContent = (startup.name || '?')[0].toUpperCase();
    avatar.style.cssText =
      'width:22px;height:22px;border-radius:5px;display:flex;align-items:center;' +
      'justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0;' +
      'background:' + gradient(startup) + ';';

    var profileText = document.createElement('p');
    profileText.style.cssText =
      'margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4b5563;';
    var profileName = document.createElement('span');
    profileName.textContent = startup.name || '';
    profileName.style.cssText = 'font-weight:600;color:#111827;';
    var profileTag = document.createElement('span');
    profileTag.textContent = ' — ' + (startup.tagline || '');
    profileTag.style.cssText = 'color:#9ca3af;';
    profileText.appendChild(profileName);
    profileText.appendChild(profileTag);

    profile.appendChild(avatar);
    profile.appendChild(profileText);

    var promoWrap = null;
    if (promotion) {
      promoWrap = document.createElement('div');
      promoWrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';

      var promoBadge = document.createElement('span');
      promoBadge.textContent = 'AD';
      promoBadge.style.cssText =
        'font-size:9px;font-weight:700;color:#9ca3af;padding:1px 4px;' +
        'border-radius:3px;background:rgba(0,0,0,0.05);';

      var promoAvatar = document.createElement('span');
      promoAvatar.textContent = (promotion.name || '?')[0].toUpperCase();
      promoAvatar.style.cssText =
        'width:20px;height:20px;border-radius:5px;display:flex;align-items:center;' +
        'justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0;' +
        'background:' + gradient(promotion) + ';';

      var promoText = document.createElement('span');
      promoText.textContent = promotion.name + ' — ' + (promotion.tagline || '');
      promoText.style.cssText =
        'max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        'color:#4b5563;font-size:12px;';

      var promoVisit = document.createElement('a');
      promoVisit.href = promotion.url || '#';
      promoVisit.target = '_blank';
      promoVisit.rel = 'noopener noreferrer';
      promoVisit.textContent = 'Visit';
      promoVisit.style.cssText =
        'display:inline-flex;align-items:center;gap:4px;flex-shrink:0;' +
        'padding:4px 12px;border-radius:999px;font-size:11px;font-weight:500;' +
        'text-decoration:none;color:#111827;background:rgba(0,0,0,0.05);' +
        'transition:background 0.15s ease;cursor:pointer;';
      promoVisit.addEventListener('mouseenter', function () {
        promoVisit.style.background = 'rgba(0,0,0,0.1)';
      });
      promoVisit.addEventListener('mouseleave', function () {
        promoVisit.style.background = 'rgba(0,0,0,0.05)';
      });
      promoVisit.addEventListener('click', function () {
        track('click', {
          device: detectDevice(),
          referrer: window.location.hostname,
        });
      });

      promoWrap.appendChild(promoBadge);
      promoWrap.appendChild(promoAvatar);
      promoWrap.appendChild(promoText);
      promoWrap.appendChild(promoVisit);
    }

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\\u00d7';
    closeBtn.setAttribute('aria-label', 'Close bar');
    closeBtn.style.cssText =
      'flex-shrink:0;border:none;background:transparent;font-size:18px;' +
      'color:#9ca3af;cursor:pointer;padding:0 4px;line-height:1;';
    closeBtn.addEventListener('click', function () {
      root.style.display = 'none';
      restoreLayout();
    });

    bar.appendChild(brand);
    bar.appendChild(divider);
    bar.appendChild(profile);
    if (promoWrap) bar.appendChild(promoWrap);
    bar.appendChild(closeBtn);

    // --- overlap fix -----------------------------------------------------
    // A simple margin-top on <body> only pushes normal-flow content down.
    // It does NOT move the host site's own `position: fixed` / `sticky`
    // header, because fixed elements are positioned against the viewport,
    // not against body's box — so that header stays pinned at y:0 and
    // sits underneath our bar, causing the overlap seen on the site.
    //
    // Fix: move every existing body child into a wrapper <div>, then
    // apply a CSS transform to that wrapper. A transform on an ancestor
    // creates a new "containing block" for any `position: fixed`
    // descendants, so the site's fixed header (now inside the wrapper)
    // gets pushed down along with everything else. Our own bar is kept
    // OUTSIDE the wrapper (a direct child of body), so it stays truly
    // fixed to the real viewport top.
    var wrapper = document.getElementById('loadbar-page-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'loadbar-page-wrapper';
      var existing = [];
      for (var i = 0; i < document.body.childNodes.length; i++) {
        existing.push(document.body.childNodes[i]);
      }
      for (var j = 0; j < existing.length; j++) {
        wrapper.appendChild(existing[j]);
      }
      document.body.insertBefore(wrapper, document.body.firstChild);
    }

    root.appendChild(bar);
    document.body.appendChild(root);

    function pushPageDown() {
      var h = bar.getBoundingClientRect().height || 44;
      wrapper.style.setProperty('transform', 'translateY(' + h + 'px)', 'important');
      // Reclaim the blank strip the transform leaves at the bottom of
      // the page so total scroll height stays correct.
      wrapper.style.setProperty('margin-bottom', '-' + h + 'px', 'important');
    }

    function restoreLayout() {
      wrapper.style.removeProperty('transform');
      wrapper.style.removeProperty('margin-bottom');
    }

    pushPageDown();

    track('impression', {
      device: detectDevice(),
      referrer: window.location.hostname,
    });

    // Re-measure on resize in case the bar's height changes (e.g. text
    // wraps on narrower viewports), so the page never overlaps it.
    window.addEventListener('resize', pushPageDown);
  }
})();`;

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.send(script);
}
