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

      // Publish time must be resolved independently because media extraction
      // may succeed before the DOM fallback runs.
      if (!result.createTimestamp) extractPublishTime(result);

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

    // Douyin uses different field names across page/API versions.
    setPublishTimestamp(result,
      item.create_time || item.createTime || item.create_timestamp ||
      item.publish_time || item.publishTime || item.aweme_create_time
    );

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
    if (!result.itemId) {
      const idMatch = location.pathname.match(/\/(?:video|note)\/(\d{15,22})/);
      if (idMatch) result.itemId = idMatch[1];
    }

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

  }

  function extractPublishTime(result) {
    // 1. Structured metadata is more reliable than visible text.
    const metaSelectors = [
      'meta[property="article:published_time"]',
      'meta[itemprop="datePublished"]',
      'meta[name="date"]',
      'time[datetime]'
    ];
    for (const selector of metaSelectors) {
      const element = document.querySelector(selector);
      const value = element?.getAttribute('content') || element?.getAttribute('datetime');
      if (setPublishTimestamp(result, value)) return;
    }

    // 2. JSON-LD may expose datePublished/uploadDate on some detail pages.
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const json = JSON.parse(script.textContent);
        const nodes = Array.isArray(json) ? json : [json, ...(json['@graph'] || [])];
        for (const node of nodes) {
          if (setPublishTimestamp(result, node?.datePublished || node?.uploadDate || node?.dateCreated)) return;
        }
      } catch (e) { /* ignore invalid structured data */ }
    }

    // 3. Only accept strings that look like a date/relative publish time.
    const priorityCandidates = document.querySelectorAll(
      'time, [data-e2e*="publish"], [data-e2e*="date"], [data-e2e="user-info"], ' +
      '[data-e2e="video-desc"], [class*="publishTime"], [class*="createTime"], [class*="date"], ' +
      '[class*="author"], [class*="Author"], [class*="account"]'
    );
    for (const element of priorityCandidates) {
      const text = (element.innerText || element.textContent || '').trim();
      const timestamp = parseVisiblePublishTime(text);
      if (timestamp && setPublishTimestamp(result, timestamp)) return;
    }

    // The current Douyin overlay places the publish date in an ordinary span
    // beside the author. Scan only short leaf-like text nodes to avoid dates
    // from unrelated navigation/recommended content.
    const looseCandidates = document.querySelectorAll('span, p, div');
    for (const element of looseCandidates) {
      if (element.children.length > 3) continue;
      const text = (element.innerText || element.textContent || '').trim();
      if (!text || text.length > 220 || !looksLikePublishDate(text)) continue;
      const timestamp = parseVisiblePublishTime(text);
      if (timestamp && setPublishTimestamp(result, timestamp)) return;
    }

    // 4. Douyin/TikTok numeric item IDs commonly encode Unix seconds in
    // their high 32 bits. Use only if it resolves to a plausible date.
    if (/^\d{15,22}$/.test(String(result.itemId || ''))) {
      try {
        const encodedSeconds = Number(BigInt(result.itemId) >> 32n);
        if (setPublishTimestamp(result, encodedSeconds)) return;
      } catch (e) { /* ignore non-Snowflake IDs */ }
    }

    result.createTime = 'Không xác định';
    result.createTimestamp = 0;
  }

  function setPublishTimestamp(result, rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '') return false;
    let milliseconds;
    if (typeof rawValue === 'number' || /^\d{10,13}$/.test(String(rawValue).trim())) {
      const numeric = Number(rawValue);
      milliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
    } else {
      milliseconds = Date.parse(String(rawValue));
    }

    const date = new Date(milliseconds);
    const earliest = new Date('2015-01-01T00:00:00Z').getTime();
    const latest = Date.now() + 24 * 60 * 60 * 1000;
    if (!Number.isFinite(milliseconds) || milliseconds < earliest || milliseconds > latest || Number.isNaN(date.getTime())) {
      return false;
    }

    result.createTimestamp = Math.floor(milliseconds / 1000);
    result.createTime = date.toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    return true;
  }

  function parseVisiblePublishTime(text) {
    text = String(text || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ');
    if (!text || /^\d{1,2}:\d{2}(\s*\/\s*\d{1,2}:\d{2})?$/.test(text)) return 0;
    const now = new Date();
    if (/刚刚|vừa xong/i.test(text)) return now.getTime();
    if (/昨天|hôm qua/i.test(text)) return now.getTime() - 24 * 60 * 60 * 1000;

    const relative = text.match(/(\d+)\s*(分钟|小时|天|周|个月|phút|giờ|ngày|tuần|tháng)前?/i);
    if (relative) {
      const amount = Number(relative[1]);
      const unit = relative[2].toLowerCase();
      const unitMs = unit.includes('分钟') || unit.includes('phút') ? 60000
        : unit.includes('小时') || unit.includes('giờ') ? 3600000
        : unit.includes('周') || unit.includes('tuần') ? 7 * 86400000
        : unit.includes('个月') || unit.includes('tháng') ? 30 * 86400000
        : 86400000;
      return now.getTime() - amount * unitMs;
    }

    const vietnameseDate = text.match(/ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(20\d{2})/i);
    if (vietnameseDate) {
      return new Date(Number(vietnameseDate[3]), Number(vietnameseDate[2]) - 1, Number(vietnameseDate[1])).getTime();
    }

    const fullDate = text.match(/(20\d{2})\s*[年\-\/.]\s*(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})\s*日?/);
    if (fullDate) return new Date(Number(fullDate[1]), Number(fullDate[2]) - 1, Number(fullDate[3])).getTime();

    const shortDate = text.match(/(?:^|\s)(\d{1,2})[月\-\/](\d{1,2})(?:日|\s|$)/);
    if (shortDate) {
      let date = new Date(now.getFullYear(), Number(shortDate[1]) - 1, Number(shortDate[2]));
      if (date.getTime() > now.getTime() + 86400000) date = new Date(now.getFullYear() - 1, Number(shortDate[1]) - 1, Number(shortDate[2]));
      return date.getTime();
    }
    return 0;
  }

  function looksLikePublishDate(text) {
    return /20\d{2}\s*[年\-\/.]\s*\d{1,2}\s*[月\-\/.]\s*\d{1,2}\s*日?/.test(text) ||
      /ngày\s*\d{1,2}\s*tháng\s*\d{1,2}\s*năm\s*20\d{2}/i.test(text) ||
      /(刚刚|昨天|\d+\s*(分钟|小时|天|周|个月)前)/.test(text);
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
