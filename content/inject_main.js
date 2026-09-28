// Injected into MAIN world to access window objects directly
// Strategy based on GitHub open-source Douyin downloaders (Evil0ctal / jiji262 / DouYinX)
(function() {
  'use strict';

  function extractCurrentDouyinData() {
    const result = {
      success: false,
      type: 'unknown',
      title: '',
      desc: '',
      images: [],
      videoUrl: '',
      author: '',
      avatar: '',
      itemId: '',
      hashtags: []
    };

    try {
      // ===== STRATEGY 1: window._ROUTER_DATA (SSR data) =====
      if (window._ROUTER_DATA && window._ROUTER_DATA.loaderData) {
        const loader = window._ROUTER_DATA.loaderData;
        for (const key of Object.keys(loader)) {
          const val = loader[key];
          if (!val || typeof val !== 'object') continue;

          let item = null;

          // Path A: videoInfoRes.item_list[0]
          if (val.videoInfoRes && Array.isArray(val.videoInfoRes.item_list) && val.videoInfoRes.item_list[0]) {
            item = val.videoInfoRes.item_list[0];
          }
          // Path B: itemInfo.itemStruct
          if (!item && val.itemInfo && val.itemInfo.itemStruct) {
            item = val.itemInfo.itemStruct;
          }
          // Path C: awemeDetail
          if (!item && val.awemeDetail) {
            item = val.awemeDetail;
          }

          if (item) {
            populateFromItem(result, item);
            if (result.success) break;
          }
        }
      }

      // ===== STRATEGY 2: window.RENDER_DATA (URL-encoded SSR) =====
      if (!result.success && window.RENDER_DATA) {
        try {
          for (const key of Object.keys(window.RENDER_DATA)) {
            const decoded = typeof window.RENDER_DATA[key] === 'string'
              ? JSON.parse(decodeURIComponent(window.RENDER_DATA[key]))
              : window.RENDER_DATA[key];
            if (decoded && typeof decoded === 'object') {
              const item = decoded.awemeDetail || decoded.itemInfo?.itemStruct || null;
              if (item) {
                populateFromItem(result, item);
                if (result.success) break;
              }
            }
          }
        } catch (e) { /* ignore parse errors */ }
      }

      // ===== STRATEGY 3: Intercept XHR/Fetch cached responses =====
      if (!result.success && window.__DOUYIN_CACHED_DATA__) {
        try {
          const item = window.__DOUYIN_CACHED_DATA__;
          populateFromItem(result, item);
        } catch(e) { /* ignore */ }
      }

      // ===== STRATEGY 4: DOM-based fallback =====
      if (!result.success || (result.images.length === 0 && !result.videoUrl)) {
        extractFromDOM(result);
      }

      // Extract hashtags from description
      if (result.desc) {
        const tags = result.desc.match(/#[^\s#]+/g);
        if (tags) result.hashtags = tags;
      }

    } catch (e) {
      result.error = e.message;
    }

    return result;
  }

  function populateFromItem(result, item) {
    result.itemId = item.aweme_id || item.awemeId || item.id || '';
    result.desc = item.desc || '';
    result.title = item.desc || '';

    // Create time
    if (item.create_time) {
      try {
        const d = new Date(item.create_time * 1000);
        result.createTime = d.toLocaleString('vi-VN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
        result.createTimestamp = item.create_time;
      } catch (e) {
        result.createTime = String(item.create_time);
      }
    }

    // Author info
    if (item.author) {
      result.author = item.author.nickname || item.author.nick_name || '';
      result.authorId = item.author.unique_id || item.author.short_id || item.author.sec_uid || '';
      const avatarThumb = item.author.avatar_thumb || item.author.avatarThumb ||
                          item.author.avatar_medium || item.author.avatar_larger || {};
      const avatarUrls = avatarThumb.url_list || avatarThumb.urlList || [];
      result.avatar = avatarUrls[0] || '';
    }

    // Detect type: images (note/tuwen) vs video
    const imageList = item.images || item.image_post_info?.images || [];
    if (Array.isArray(imageList) && imageList.length > 0) {
      result.type = 'note';
      const extractedUrls = [];

      for (const img of imageList) {
        if (!img) continue;

        // GitHub pattern (Evil0ctal / jiji262 / DouYinX):
        // 1. download_url_list (highest quality watermark-free)
        // 2. url_list (standard web display)
        // 3. display_image.url_list
        const list = (Array.isArray(img.download_url_list) && img.download_url_list.length > 0 ? img.download_url_list : null) ||
                     (Array.isArray(img.downloadUrlList) && img.downloadUrlList.length > 0 ? img.downloadUrlList : null) ||
                     (Array.isArray(img.url_list) && img.url_list.length > 0 ? img.url_list : null) ||
                     (Array.isArray(img.urlList) && img.urlList.length > 0 ? img.urlList : null) ||
                     (img.display_image && Array.isArray(img.display_image.url_list) && img.display_image.url_list.length > 0 ? img.display_image.url_list : null) ||
                     [];

        let url = list[0] || (typeof img === 'string' ? img : '');
        url = cleanImageUrl(url);
        if (url) {
          extractedUrls.push(url);
        }
      }

      result.images = deduplicateImages(extractedUrls);
      result.success = result.images.length > 0;
    } else if (item.video) {
      result.type = 'video';
      // Prefer no-watermark sources
      const sources = [
        item.video.play_addr?.url_list,
        item.video.play_addr_h264?.url_list,
        item.video.play_addr_265?.url_list,
        item.video.download_addr?.url_list,
      ];
      for (const list of sources) {
        if (list && list.length > 0) {
          result.videoUrl = list[0].replace(/playwm/g, 'play');
          result.success = true;
          break;
        }
      }
    }
  }

  // Follows GitHub standard: ONLY clean unicode escapes and protocol.
  // NEVER strip ~tplv or query parameters from signed Douyin URLs,
  // as the HMAC signature (x-signature) requires the exact URI path and query string.
  function cleanImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    url = url.replace(/\\u002F/g, '/').replace(/\\u0026/g, '&');
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    return url.trim();
  }

  function deduplicateImages(urls) {
    const seen = new Set();
    const result = [];
    for (const u of urls) {
      if (!u) continue;
      // Deduplicate by media ID (e.g. tos-cn-i-0813/xyz)
      const match = u.match(/(tos-[a-zA-Z0-9-]+\/[a-zA-Z0-9]+)/);
      const key = match ? match[1] : u;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(u);
      }
    }
    return result;
  }

  function extractFromDOM(result) {
    const noteContainers = [
      '.note-content img',
      '.swiper-slide img',
      '[class*="slide"] img',
      '.xg-slides img',
      '[data-e2e="note-slide"] img',
      '.image-list img',
      '[class*="imageList"] img',
      '[class*="image-container"] img',
      '[class*="ImgContainer"] img',
      '.slider-image img',
    ];

    let collectedUrls = [];

    for (const selector of noteContainers) {
      try {
        const imgs = document.querySelectorAll(selector);
        imgs.forEach(img => {
          const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
          if (isValidMediaUrl(src)) {
            collectedUrls.push(cleanImageUrl(src));
          }
          const srcset = img.srcset || '';
          if (srcset) {
            const highest = srcset.split(',').pop().trim().split(' ')[0];
            if (isValidMediaUrl(highest)) {
              collectedUrls.push(cleanImageUrl(highest));
            }
          }
        });
      } catch(e) {}
    }

    if (collectedUrls.length === 0) {
      const allImgs = document.querySelectorAll('img');
      allImgs.forEach(img => {
        const src = img.src || '';
        if (isValidMediaUrl(src) && (img.naturalWidth > 200 || img.width > 200)) {
          collectedUrls.push(cleanImageUrl(src));
        }
      });
    }

    if (collectedUrls.length > 0) {
      result.type = 'note';
      result.images = deduplicateImages(collectedUrls);
      result.success = true;
    }

    // Check for video element
    const videoEl = document.querySelector('video[src], video source[src]');
    if (videoEl) {
      const vSrc = videoEl.src || videoEl.querySelector('source')?.src || '';
      if (vSrc && !vSrc.startsWith('blob:')) {
        result.videoUrl = vSrc;
        if (result.images.length === 0) result.type = 'video';
        result.success = true;
      }
    }

    // Get description from DOM
    if (!result.desc) {
      const descSelectors = [
        '[data-e2e="video-desc"]',
        '[class*="desc"]',
        '[class*="title"]',
        'h1',
        '.title',
      ];
      for (const sel of descSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.trim().length > 5) {
          result.desc = el.innerText.trim();
          break;
        }
      }
    }

    // Get author from DOM
    if (!result.author) {
      const authorSelectors = [
        '[data-e2e="user-info"] a',
        '.account-name',
        '.author-info',
        '[class*="author"] [class*="name"]',
        '[class*="authorName"]'
      ];
      for (const sel of authorSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText) {
          result.author = el.innerText.trim();
          break;
        }
      }
    }

    // Get post time from DOM
    if (!result.createTime) {
      const timeSelectors = [
        '[class*="time"]',
        '[data-e2e="video-time"]',
        'time',
        '.date'
      ];
      for (const sel of timeSelectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.match(/\d/)) {
          result.createTime = el.innerText.trim();
          break;
        }
      }
      if (!result.createTime) {
        // Do not use the current time here: that would incorrectly present
        // the extraction time as the author's publish time.
        result.createTime = 'Không xác định';
      }
    }
  }

  function isValidMediaUrl(url) {
    if (!url || url.length < 30) return false;
    const cdnDomains = ['douyinpic.com', 'byteimg.com', 'bytegoofy.com', 'pstatp.com', 'tiktokcdn.com', 'ibyteimg.com'];
    return cdnDomains.some(d => url.includes(d)) &&
           !url.includes('avatar') &&
           !url.includes('icon') &&
           !url.includes('emoji') &&
           !url.includes('placeholder');
  }

  // ===== XHR/Fetch interceptor: cache API responses for later extraction =====
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      if (this._url && (this._url.includes('/aweme/detail') || this._url.includes('/aweme/v1'))) {
        try {
          const json = JSON.parse(this.responseText);
          if (json.aweme_detail) {
            window.__DOUYIN_CACHED_DATA__ = json.aweme_detail;
          }
        } catch(e) {}
      }
    });
    return origSend.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function() {
    const url = arguments[0];
    const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : '');

    return origFetch.apply(this, arguments).then(response => {
      if (urlStr.includes('/aweme/detail') || urlStr.includes('/aweme/v1')) {
        response.clone().text().then(text => {
          try {
            const json = JSON.parse(text);
            if (json.aweme_detail) {
              window.__DOUYIN_CACHED_DATA__ = json.aweme_detail;
            }
          } catch(e) {}
        });
      }
      return response;
    });
  };

  // Listen for request from content script
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'REQ_EXTRACT_DOUYIN') {
      const data = extractCurrentDouyinData();
      window.postMessage({
        type: 'RES_EXTRACT_DOUYIN',
        payload: data
      }, '*');
    }
  });
})();
