// File: pages/api/widget/loader.js
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  const script = `/**
 * Loadbar widget loader - Full Bar Click Navigation & Brand Redirect
 */
(function () {
  'use strict';

  // FIX 2: Better Script Tag Detection (Resilient against async loading)
  var thisScript = document.currentScript || document.querySelector('script[data-startup-id]');

  var startupId = thisScript ? thisScript.getAttribute('data-startup-id') : null;
  if (!startupId) {
    console.warn('[Loadbar] Missing data-startup-id attribute');
    return;
  }

  var apiBase = 'https://loadapi.vercel.app';
  var BAR_HEIGHT = 44;
  var layoutObserver = null;
  var isDismissed = false;

  // FIX 1: Debounce function for the MutationObserver
  function debounce(func, wait) {
    var timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(func, wait);
    };
  }

  function detectTheme() {
    var dataTheme = thisScript.getAttribute('data-theme');
    if (dataTheme === 'dark' || dataTheme === 'light') return dataTheme;

    var roots = [document.documentElement, document.body];
    for (var i = 0; i < roots.length; i++) {
      var el = roots[i];
      if (!el) continue;
      var attrs = ['data-theme', 'data-color-scheme', 'data-mode', 'color-scheme'];
      for (var j = 0; j < attrs.length; j++) {
        var val = el.getAttribute(attrs[j]);
        if (val && val.toLowerCase().indexOf('dark') !== -1) return 'dark';
        if (val && val.toLowerCase().indexOf('light') !== -1) return 'light';
      }
      if (el.classList && el.classList.contains('dark')) return 'dark';
      if (el.classList && el.classList.contains('light')) return 'light';
    }

    try {
      var bg = window.getComputedStyle(document.body).backgroundColor;
      var rgb = bg.match(/\\d+/g);
      if (rgb && rgb.length >= 3) {
        var luminance = (0.299 * parseInt(rgb[0]) + 0.587 * parseInt(rgb[1]) + 0.114 * parseInt(rgb[2])) / 255;
        if (luminance < 0.5) return 'dark';
        if (luminance > 0.5) return 'light';
      }
    } catch (e) {}

    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }

  function cleanUrl(rawUrl, rawDomain) {
    var target = rawUrl || rawDomain || '';
    if (!target) return '';
    try {
      if (!/^https?:\\/\\//i.test(target)) {
        target = 'https://' + target;
      }
      var parsed = new URL(target);
      return parsed.origin;
    } catch (e) {
      return target;
    }
  }

  function gradient(s) {
    var from = (s && s.accent_from) || '#3dd79e';
    var to = (s && s.accent_to) || '#0b9a6c';
    return 'linear-gradient(135deg, ' + from + ', ' + to + ')';
  }

  // --- UPDATED TRACKING FUNCTION ---
  // Now matches the rich JSON style from the analytics script
  function track(eventName, extra) {
    var payload = {
      startup_id: startupId,
      eventName: eventName,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenResolution: window.screen.width + 'x' + window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      language: navigator.language
    };

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
      }).catch(function (err) {
        console.warn('[Loadbar] Track error:', err);
      });
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
      var promoToShow = data.promotion || data.startup;
      if (!promoToShow) return;
      
      renderBar(promoToShow);
    })
    .catch(function (e) {
      console.warn('[Loadbar] Could not load bar:', e.message || e);
    });

  function shiftFixedElement(el, root) {
    try {
      if (isDismissed || !el || el.nodeType !== 1) return;
      if (el === root || (root && root.contains && root.contains(el))) return;
      
      var cs = window.getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') return;

      var topRaw = cs.top;
      if (!topRaw || topRaw === 'auto') return;

      if (el.dataset && el.dataset.loadbarShifted === '1') {
        if (el.style.top === (BAR_HEIGHT + 'px') || parseFloat(topRaw) >= BAR_HEIGHT) return;
      }

      var originalPx = parseFloat(topRaw);
      if (isNaN(originalPx)) return;

      // FIX 4: CLS - Save original transitions and apply smooth layout shifting
      if (typeof el.dataset.loadbarOriginalTop === 'undefined') {
        el.dataset.loadbarOriginalTop = el.style.top || '';
      }
      if (typeof el.dataset.loadbarOriginalTransition === 'undefined') {
        el.dataset.loadbarOriginalTransition = el.style.transition || '';
      }
      
      el.style.transition = el.dataset.loadbarOriginalTransition ? el.dataset.loadbarOriginalTransition + ', top 0.4s ease' : 'top 0.4s ease';
      el.style.top = (originalPx + BAR_HEIGHT) + 'px';
      el.dataset.loadbarShifted = '1';
    } catch (e) {}
  }

  function sweepFixedElements(root) {
    if (isDismissed) return;
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
        el.style.transition = el.dataset.loadbarOriginalTransition || '';
        delete el.dataset.loadbarOriginalTop;
        delete el.dataset.loadbarOriginalTransition;
        delete el.dataset.loadbarShifted;
      }
    } catch (e) {}
  }

  function renderBar(promotion) {
    if (document.getElementById('loadbar-root')) return;

    var currentTheme = detectTheme();
    var html = document.documentElement;
    var body = document.body;

    var originalBodyPaddingTop = body ? body.style.paddingTop || '' : '';
    var originalScrollPaddingTop = html ? html.style.scrollPaddingTop || '' : '';
    var originalBodyTransition = body ? body.style.transition || '' : '';
    var originalHtmlTransition = html ? html.style.transition || '' : '';

    // FIX 3: CSS Encapsulation (all:initial + Shadow DOM wall)
    // FIX 4: CLS (translateY(-100%) to start hidden before sliding in smoothly)
    var root = document.createElement('div');
    root.id = 'loadbar-root';
    root.style.cssText =
      'all:initial;display:block;position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
      'transform:translateY(-100%);transition:transform 0.4s ease;';

    var shadow = root.attachShadow ? root.attachShadow({ mode: 'closed' }) : root;
    
    var container = document.createElement('div');
    container.style.cssText = 
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
      'font-size:13px;line-height:1.4;box-sizing:border-box;width:100%;';

    var bar = document.createElement('div');
    var popover = document.createElement('div');
    var avatarContainer = document.createElement('span');
    var faviconImg = document.createElement('img');

    function applyThemeStyles(isDark) {
      bar.style.cssText =
        'display:flex;align-items:center;gap:10px;height:' + BAR_HEIGHT + 'px;width:100%;' +
        'padding:0 14px;box-sizing:border-box;cursor:pointer;' +
        'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
        (isDark
          ? 'background:rgba(24,24,27,0.92);border-bottom:1px solid rgba(255,255,255,0.1);color:#f3f4f6;'
          : 'background:rgba(255,255,255,0.92);border-bottom:1px solid rgba(0,0,0,0.08);color:#111827;');

      if (avatarContainer) {
        avatarContainer.style.background = 'transparent';
      }

      if (faviconImg) {
        faviconImg.style.cssText =
          'width:100%;height:100%;object-fit:contain;display:block;background:transparent;' +
          (isDark ? 'mix-blend-mode:lighten;' : 'mix-blend-mode:multiply;');
      }

      if (popover) {
        popover.style.cssText =
          'display:none;position:absolute;top:48px;left:14px;width:280px;padding:12px;border-radius:8px;' +
          'box-shadow:0 10px 25px -5px rgba(0,0,0,0.15),0 8px 10px -6px rgba(0,0,0,0.1);z-index:2147483647;' +
          'font-size:12px;line-height:1.5;cursor:default;' +
          (isDark
            ? 'background:#18181b;color:#e4e4e7;border:1px solid rgba(255,255,255,0.15);'
            : 'background:#ffffff;color:#374151;border:1px solid rgba(0,0,0,0.1);');
      }
    }

    var promoId = promotion.id || promotion._id || promotion.startup_id || null;

    function handlePromoVisit(e) {
      var target = promotion.url || '#';
      if (target !== '#') {
        window.open(target, '_blank', 'noopener,noreferrer');
      }
      
      // Updated Click Track Call
      track('click', {
        device: detectDevice(),
        promoted_id: promoId
      });
    }

    bar.addEventListener('click', handlePromoVisit);

    bar.addEventListener('mouseenter', function () {
      // Updated Impression Track Call
      track('impression', {
        device: detectDevice(),
        promoted_id: promoId
      });
    });

    var brand = document.createElement('div');
    brand.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

    var infoBtn = document.createElement('button');
    infoBtn.textContent = 'i';
    infoBtn.setAttribute('aria-label', 'About Loadbar');
    infoBtn.style.cssText =
      'width:15px;height:15px;border-radius:50%;border:1px solid currentColor;' +
      'background:transparent;color:currentColor;font-size:10px;font-weight:700;' +
      'font-family:serif;font-style:italic;display:inline-flex;align-items:center;' +
      'justify-content:center;cursor:pointer;opacity:0.6;padding:0;line-height:1;margin-right:2px;flex-shrink:0;';

    infoBtn.addEventListener('mouseenter', function() { infoBtn.style.opacity = '1'; });
    infoBtn.addEventListener('mouseleave', function() { infoBtn.style.opacity = '0.6'; });
    infoBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      popover.style.display = popover.style.display === 'none' ? 'block' : 'none';
    });

    var brandLink = document.createElement('a');
    brandLink.href = 'https://loadbar.vercel.app';
    brandLink.target = '_blank';
    brandLink.rel = 'noopener noreferrer';
    brandLink.textContent = 'Loadbar';
    brandLink.style.cssText =
      'font-size:11px;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:0.05em;opacity:0.6;color:currentColor;text-decoration:none;cursor:pointer;';
    brandLink.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    brand.appendChild(infoBtn);
    brand.appendChild(brandLink);

    popover.innerHTML =
      '<div style="font-weight:700;font-size:13px;margin-bottom:6px;">Founder-to-founder growth</div>' +
      '<div style="opacity:0.85;margin-bottom:10px;">This bar shows startups from the Loadbar network &mdash; founders who display each startup&#39;s products for free mutual traffic. No ads, no cost.</div>' +
      '<a href="https://loadbar.vercel.app" target="_blank" rel="noopener noreferrer" style="color:#10b981;font-weight:600;text-decoration:none;display:inline-block;">Have a startup? Join free &rarr;</a>';

    popover.addEventListener('click', function(e) {
      e.stopPropagation();
    });

    document.addEventListener('click', function(e) {
      if (popover.style.display === 'block' && !popover.contains(e.target) && e.target !== infoBtn) {
        popover.style.display = 'none';
      }
    });

    var divider = document.createElement('span');
    divider.style.cssText = 'width:1px;height:14px;background:currentColor;opacity:0.15;flex-shrink:0;';

    var profile = document.createElement('div');
    profile.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;flex:1;';

    var cleanTargetUrl = cleanUrl(promotion.url, promotion.domain);
    var faviconUrl = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=' + cleanTargetUrl + '&size=128';

    avatarContainer.style.cssText =
      'width:22px;height:22px;border-radius:5px;display:flex;align-items:center;' +
      'justify-content:center;overflow:hidden;flex-shrink:0;background:transparent;';

    faviconImg.src = faviconUrl;

    faviconImg.onerror = function () {
      avatarContainer.innerHTML = '';
      var initialSpan = document.createElement('span');
      initialSpan.textContent = (promotion.name || '?')[0].toUpperCase();
      initialSpan.style.cssText = 'font-size:10px;font-weight:700;color:#fff;';
      avatarContainer.style.background = gradient(promotion);
      avatarContainer.appendChild(initialSpan);
    };

    avatarContainer.appendChild(faviconImg);

    applyThemeStyles(currentTheme === 'dark');

    var profileText = document.createElement('p');
    profileText.style.cssText =
      'margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    var profileName = document.createElement('span');
    profileName.textContent = promotion.name || '';
    profileName.style.cssText = 'font-weight:600;';
    var profileTag = document.createElement('span');
    profileTag.textContent = promotion.tagline ? ' — ' + promotion.tagline : '';
    profileTag.style.cssText = 'opacity:0.6;';
    profileText.appendChild(profileName);
    profileText.appendChild(profileTag);

    profile.appendChild(avatarContainer);
    profile.appendChild(profileText);

    var visitBtn = document.createElement('a');
    visitBtn.href = promotion.url || '#';
    visitBtn.target = '_blank';
    visitBtn.rel = 'noopener noreferrer';
    visitBtn.textContent = 'Visit →';
    visitBtn.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;flex-shrink:0;' +
      'padding:4px 12px;border-radius:999px;font-size:11px;font-weight:500;' +
      'text-decoration:none;color:currentColor;background:rgba(125,125,125,0.12);' +
      'transition:background 0.15s ease;cursor:pointer;margin-right:4px;';
    visitBtn.addEventListener('mouseenter', function () {
      visitBtn.style.background = 'rgba(125,125,125,0.22)';
    });
    visitBtn.addEventListener('mouseleave', function () {
      visitBtn.style.background = 'rgba(125,125,125,0.12)';
    });
    visitBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      handlePromoVisit(e);
    });

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Close bar');
    closeBtn.style.cssText =
      'flex-shrink:0;border:none;background:transparent;font-size:18px;' +
      'color:currentColor;opacity:0.6;cursor:pointer;padding:0 4px;line-height:1;';
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      isDismissed = true;
      if (layoutObserver) {
        layoutObserver.disconnect();
        layoutObserver = null;
      }
      root.remove();
      if (body) {
        body.style.paddingTop = originalBodyPaddingTop;
        body.style.transition = originalBodyTransition;
      }
      if (html) {
        html.style.scrollPaddingTop = originalScrollPaddingTop;
        html.style.transition = originalHtmlTransition;
      }
      unshiftFixedElements();
    });

    bar.appendChild(brand);
    bar.appendChild(divider);
    bar.appendChild(profile);
    bar.appendChild(visitBtn);
    bar.appendChild(closeBtn);

    container.appendChild(bar);
    container.appendChild(popover);
    shadow.appendChild(container);
    body.appendChild(root);

    // FIX 4: CLS - Smooth layout adjustments for the host page
    if (body) {
      var existingPad = parseInt(window.getComputedStyle(body).paddingTop) || 0;
      body.style.transition = body.style.transition ? body.style.transition + ', padding-top 0.4s ease' : 'padding-top 0.4s ease';
      body.style.paddingTop = (existingPad + BAR_HEIGHT) + 'px';
    }
    if (html) {
      html.style.transition = html.style.transition ? html.style.transition + ', scroll-padding-top 0.4s ease' : 'scroll-padding-top 0.4s ease';
      html.style.scrollPaddingTop = BAR_HEIGHT + 'px';
    }

    // Force a DOM reflow, then apply the transform to slide the bar in smoothly
    void root.offsetWidth;
    root.style.transform = 'translateY(0)';

    // FIX 1: Wrapping the MutationObserver callback in the debounce function
    try {
      layoutObserver = new MutationObserver(debounce(function () {
        if (isDismissed) return;
        sweepFixedElements(root);
        
        var newTheme = detectTheme();
        if (newTheme !== currentTheme) {
          currentTheme = newTheme;
          applyThemeStyles(newTheme === 'dark');
        }
      }, 150));

      var targetNode = body || html;
      if (targetNode) {
        layoutObserver.observe(targetNode, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'data-theme']
        });
      }
    } catch (e) {}

    var handleRoute = function() {
      if (!isDismissed) sweepFixedElements(root);
    };
    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', handleRoute);

    sweepFixedElements(root);
  }
})();`;

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.send(script);
}
