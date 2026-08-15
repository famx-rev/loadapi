// File: pages/api/widget/loader.js
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  const script = `/**
 * Loadbar widget loader - Full Bar Click Navigation & Brand Redirect (Batch Prefetching)
 * Upgraded: Smart DOM Shifting & Layout Protection (Sticky Elements Ignored)
 */
(function () {
  'use strict';

  if (window.__loadbar_active) return;
  window.__loadbar_active = true;

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

  var currentPromoId = null;
  var currentPromoUrl = '#';
  var rotationTimer = null;

  var promoQueue = [];
  var isFetching = false;
  var trackedHoverPromoId = null;

  var elProfileName, elProfileTag, elFaviconImg, elAvatarContainer, elVisitBtn;
  var handleRoute, handleVisibility;

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

  function shiftFixedElement(el, root) {
    try {
      if (isDismissed || !el || el.nodeType !== 1) return;
      
      if (el.hasAttribute('data-loadbar-ignore')) return; 
      if (el === root || (root && root.contains && root.contains(el))) return;
      
      var cs = window.getComputedStyle(el);
      if (cs.position !== 'fixed') return;

      var topRaw = cs.top;
      if (!topRaw || topRaw === 'auto') return;

      if (el.dataset && el.dataset.loadbarShifted === '1') {
        if (el.style.top === (BAR_HEIGHT + 'px') || parseFloat(topRaw) >= BAR_HEIGHT) return;
      }

      var originalPx = parseFloat(topRaw);
      if (isNaN(originalPx)) return;

      if (typeof el.dataset.loadbarOriginalTop === 'undefined') {
        el.dataset.loadbarOriginalTop = el.style.top || '';
      }
      if (typeof el.dataset.loadbarOriginalTransition === 'undefined') {
        el.dataset.loadbarOriginalTransition = el.style.transition || '';
      }
      
      var heightRaw = cs.height;
      if (heightRaw === window.innerHeight + 'px' || el.style.height === '100vh' || el.style.height === '100%') {
          if (typeof el.dataset.loadbarOriginalHeight === 'undefined') {
              el.dataset.loadbarOriginalHeight = el.style.height || '';
          }
          el.style.height = 'calc(100vh - ' + BAR_HEIGHT + 'px)';
      }
      
      el.style.transition = el.dataset.loadbarOriginalTransition ? el.dataset.loadbarOriginalTransition + ', top 0.4s ease, height 0.4s ease' : 'top 0.4s ease, height 0.4s ease';
      el.style.top = (originalPx + BAR_HEIGHT) + 'px';
      el.dataset.loadbarShifted = '1';
    } catch (e) {}
  }

  function sweepFixedElements(root) {
    if (isDismissed) return;
    try {
      var nodes = document.querySelectorAll('header, nav, div, section, [style*="fixed"]');
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
        
        if (typeof el.dataset.loadbarOriginalHeight !== 'undefined') {
            el.style.height = el.dataset.loadbarOriginalHeight;
            delete el.dataset.loadbarOriginalHeight;
        }

        delete el.dataset.loadbarOriginalTop;
        delete el.dataset.loadbarOriginalTransition;
        delete el.dataset.loadbarShifted;
      }
    } catch (e) {}
  }

  var serveUrl = apiBase + '/api/serve?startup_id=' + encodeURIComponent(startupId);

  function rotateAd() {
    if (isDismissed) return;

    if (promoQueue.length > 0) {
      var promoToShow = promoQueue.shift(); 
      
      if (!document.getElementById('loadbar-root')) {
        buildBarDOM();
      }
      
      updateBarContent(promoToShow);

      if (promoQueue.length === 0) {
        fetchBatch(false); 
      }
    } else {
      fetchBatch(true);
    }
  }

  function fetchBatch(andRotateImmediately) {
    if (isDismissed || isFetching) return;
    isFetching = true;
    
    var bustCacheUrl = serveUrl + '&_cb=' + new Date().getTime();
    
    fetch(bustCacheUrl)
      .then(function (r) {
        if (!r.ok) throw new Error('serve failed');
        return r.json();
      })
      .then(function (data) {
        isFetching = false;
        if (!data) return;
        
        var list = data.promotions || (data.promotion ? [data.promotion] : []);
        
        if (list.length > 0) {
          promoQueue = promoQueue.concat(list);
          if (andRotateImmediately) {
            rotateAd();
          }
        }
      })
      .catch(function (e) {
        isFetching = false;
        console.warn('[Loadbar] Could not fetch batch:', e.message || e);
      });
  }

  fetchBatch(true);

  function startRotation() {
    if (isDismissed || rotationTimer) return;
    rotationTimer = setInterval(rotateAd, 8000);
  }

  function stopRotation() {
    if (rotationTimer) {
      clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }

  if (!document.hidden) {
    startRotation();
  }
  
  handleVisibility = function() {
    if (isDismissed) return;
    if (document.hidden) {
      stopRotation();
    } else {
      startRotation();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  function updateBarContent(promotion) {
    var newPromoId = promotion.id || promotion._id || promotion.startup_id || null;
    
    if (currentPromoId === newPromoId) return;

    currentPromoId = newPromoId;
    currentPromoUrl = promotion.url || '#';

    if (elProfileName) elProfileName.textContent = promotion.name || '';
    if (elProfileTag) elProfileTag.textContent = promotion.tagline ? ' — ' + promotion.tagline : '';
    if (elVisitBtn) elVisitBtn.href = currentPromoUrl;

    if (elFaviconImg && elAvatarContainer) {
      var cleanTargetUrl = cleanUrl(promotion.url, promotion.domain);
      var faviconUrl = 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=' + cleanTargetUrl + '&size=128';
      
      elFaviconImg.src = faviconUrl;
      elFaviconImg.style.display = 'block';
      
      elFaviconImg.onerror = function () {
        elFaviconImg.style.display = 'none';
        elAvatarContainer.innerHTML = '';
        var initialSpan = document.createElement('span');
        initialSpan.textContent = (promotion.name || '?')[0].toUpperCase();
        initialSpan.style.cssText = 'font-size:10px;font-weight:700;color:#fff;';
        elAvatarContainer.style.background = gradient(promotion);
        elAvatarContainer.appendChild(initialSpan);
      };
    }

    track('impression', {
      device: detectDevice(),
      promoted_id: currentPromoId
    });
  }

  function buildBarDOM() {
    var currentTheme = detectTheme();
    var html = document.documentElement;
    var body = document.body;

    var originalBodyPaddingTop = body ? body.style.paddingTop || '' : '';
    var originalScrollPaddingTop = html ? html.style.scrollPaddingTop || '' : '';
    var originalBodyTransition = body ? body.style.transition || '' : '';
    var originalHtmlTransition = html ? html.style.transition || '' : '';

    if (html) {
      html.style.setProperty('--loadbar-height', BAR_HEIGHT + 'px');
    }

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
    
    elAvatarContainer = document.createElement('span');
    elFaviconImg = document.createElement('img');
    elProfileName = document.createElement('span');
    elProfileTag = document.createElement('span');
    elVisitBtn = document.createElement('a');

    function applyThemeStyles(isDark) {
      bar.style.cssText =
        'display:flex;align-items:center;gap:10px;height:' + BAR_HEIGHT + 'px;width:100%;' +
        'padding:0 14px;box-sizing:border-box;cursor:pointer;' +
        'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:background 0.3s ease;' +
        (isDark
          ? 'background:rgba(24,24,27,0.92);border-bottom:1px solid rgba(255,255,255,0.1);color:#f3f4f6;'
          : 'background:rgba(255,255,255,0.92);border-bottom:1px solid rgba(0,0,0,0.08);color:#111827;');

      if (elAvatarContainer) elAvatarContainer.style.background = 'transparent';

      if (elFaviconImg) {
        elFaviconImg.style.cssText =
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

    function handlePromoVisit(e) {
      if (currentPromoUrl !== '#') window.open(currentPromoUrl, '_blank', 'noopener,noreferrer');
      track('click', { device: detectDevice(), promoted_id: currentPromoId });
    }

    bar.addEventListener('click', handlePromoVisit);

    bar.addEventListener('mouseenter', function () {
      if (trackedHoverPromoId !== currentPromoId) {
        trackedHoverPromoId = currentPromoId;
        track('hover', { device: detectDevice(), promoted_id: currentPromoId, hovered: true });
      }
    });

    var brand = document.createElement('div');
    brand.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

    var infoBtn = document.createElement('button');
    infoBtn.textContent = 'i';
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
    brandLink.textContent = 'Loadbar';
    brandLink.style.cssText =
      'font-size:11px;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:0.05em;opacity:0.6;color:currentColor;text-decoration:none;cursor:pointer;';
    brandLink.addEventListener('click', function(e) { e.stopPropagation(); });

    brand.appendChild(infoBtn);
    brand.appendChild(brandLink);

    popover.innerHTML =
      '<div style="font-weight:700;font-size:13px;margin-bottom:6px;">Founder-to-founder growth</div>' +
      '<div style="opacity:0.85;margin-bottom:10px;">This bar shows startups from the Loadbar network &mdash; founders who display each startup&#39;s products for free mutual traffic. No ads, no cost.</div>' +
      '<a href="https://loadbar.vercel.app" target="_blank" rel="noopener noreferrer" style="color:#10b981;font-weight:600;text-decoration:none;display:inline-block;">Have a startup? Join free \u2192</a>';

    popover.addEventListener('click', function(e) { e.stopPropagation(); });

    // Handle internal Shadow DOM clicks for popover dismissal
    shadow.addEventListener('click', function(e) {
      if (popover.style.display === 'block' && !popover.contains(e.target) && e.target !== infoBtn) {
        popover.style.display = 'none';
      }
    });

    var divider = document.createElement('span');
    divider.style.cssText = 'width:1px;height:14px;background:currentColor;opacity:0.15;flex-shrink:0;';

    var profile = document.createElement('div');
    profile.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;flex:1;';

    elAvatarContainer.style.cssText =
      'width:22px;height:22px;border-radius:5px;display:flex;align-items:center;' +
      'justify-content:center;overflow:hidden;flex-shrink:0;background:transparent;';
    elAvatarContainer.appendChild(elFaviconImg);

    applyThemeStyles(currentTheme === 'dark');

    var profileText = document.createElement('p');
    profileText.style.cssText = 'margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    
    elProfileName.style.cssText = 'font-weight:600;';
    elProfileTag.style.cssText = 'opacity:0.6;';
    
    profileText.appendChild(elProfileName);
    profileText.appendChild(elProfileTag);

    profile.appendChild(elAvatarContainer);
    profile.appendChild(profileText);

    elVisitBtn.target = '_blank';
    elVisitBtn.textContent = 'Visit \u2192'; 
    elVisitBtn.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;flex-shrink:0;' +
      'padding:4px 12px;border-radius:999px;font-size:11px;font-weight:500;' +
      'text-decoration:none;color:currentColor;background:rgba(125,125,125,0.12);' +
      'transition:background 0.15s ease;cursor:pointer;margin-right:4px;';
    
    elVisitBtn.addEventListener('mouseenter', function () { elVisitBtn.style.background = 'rgba(125,125,125,0.22)'; });
    elVisitBtn.addEventListener('mouseleave', function () { elVisitBtn.style.background = 'rgba(125,125,125,0.12)'; });
    elVisitBtn.addEventListener('click', function (e) {
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
      
      stopRotation();
      
      if (layoutObserver) {
        layoutObserver.disconnect();
        layoutObserver = null;
      }

      window.removeEventListener('popstate', handleRoute);
      window.removeEventListener('hashchange', handleRoute);
      document.removeEventListener('visibilitychange', handleVisibility);

      root.remove();
      
      if (html) html.style.removeProperty('--loadbar-height');

      if (body) {
        var currentPad = parseInt(window.getComputedStyle(body).paddingTop) || 0;
        body.style.paddingTop = Math.max(0, currentPad - BAR_HEIGHT) + 'px';
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
    bar.appendChild(elVisitBtn);
    bar.appendChild(closeBtn);

    container.appendChild(bar);
    container.appendChild(popover);
    shadow.appendChild(container);
    body.appendChild(root);

    if (body) {
      var existingPad = parseInt(window.getComputedStyle(body).paddingTop) || 0;
      body.style.transition = body.style.transition ? body.style.transition + ', padding-top 0.4s ease' : 'padding-top 0.4s ease';
      body.style.paddingTop = (existingPad + BAR_HEIGHT) + 'px';
    }
    if (html) {
      html.style.transition = html.style.transition ? html.style.transition + ', scroll-padding-top 0.4s ease' : 'scroll-padding-top 0.4s ease';
      html.style.scrollPaddingTop = BAR_HEIGHT + 'px';
    }

    void root.offsetWidth; 
    root.style.transform = 'translateY(0)'; 

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
          childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-theme']
        });
      }
    } catch (e) {}

    handleRoute = function() {
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
