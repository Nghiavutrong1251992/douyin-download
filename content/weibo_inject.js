// Injected into MAIN world on weibo.com / weibo.cn / m.weibo.cn
// Responsible for: intercepting Weibo API responses, caching HD images,
// fetching full un-truncated post data, and removing hashtags from captions
(function () {
  'use strict';

  window.__WEIBO_POST_CACHE__ = window.__WEIBO_POST_CACHE__ || {};
  window.__WEIBO_LAST_ACTIVE_POST_ID__ = window.__WEIBO_LAST_ACTIVE_POST_ID__ || '';

  // ===== 1. Helper: Clean & Upgrade Weibo Image URL to Highest HD Resolution =====
  function getCleanWeiboImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let u = rawUrl.trim();
    if (u.startsWith('//')) u = 'https:' + u;
    if (!u.startsWith('http')) u = 'https:' + u;
    u = u.replace(/^http:/, 'https:');

    // Upgrade resolution to original or large if on sinaimg.cn or weibocdn.com
    if (u.includes('sinaimg.cn') || u.includes('weibocdn.com')) {
      u = u.replace(/\/(?:thumbnail|thumb150|thumb180|thumb300|small|square|bmiddle|mw690|mw1024|orj360|orj480|orj960|orj1080|oslarge|wap180|wap360|wap720)\//, '/original/');
    }

    return u;
  }

  // ===== 2. Helper: Remove / Strip Weibo Hashtags & Boilerplate =====
  function cleanAndStripWeiboHashtags(text) {
    if (!text || typeof text !== 'string') return { clean: '', hashtags: [] };

    const raw = text;
    const hashtags = [];

    // Match Weibo hashtag pattern: #话题内容#
    const topicMatches = raw.match(/#[^#\r\n]{1,80}#/g) || [];
    topicMatches.forEach(tag => {
      const cleanTag = tag.trim();
      if (!hashtags.includes(cleanTag)) hashtags.push(cleanTag);
    });

    // Match standard hashtags: #tag
    const singleHashMatches = raw.match(/#[a-zA-Z0-9_\u4e00-\u9fa5]{1,50}/g) || [];
    singleHashMatches.forEach(tag => {
      const cleanTag = tag.trim();
      if (!hashtags.includes(cleanTag)) hashtags.push(cleanTag);
    });

    // Strip #topic#
    let cleaned = raw.replace(/#[^#\r\n]{1,80}#/g, ' ');

    // Strip remaining #tag
    cleaned = cleaned.replace(/#[a-zA-Z0-9_\u4e00-\u9fa5]{1,50}/g, ' ');

    // Strip Weibo emoticons: [doge], [心], [偷笑]...
    cleaned = cleaned.replace(/\[[\u4e00-\u9fa5a-zA-Z0-9_]{1,15}\]/g, '');

    // Strip Weibo user mentions: @username
    cleaned = cleaned.replace(/@[\u4e00-\u9fa5a-zA-Z0-9_-]{1,30}/g, '');

    // Strip Weibo video signatures
    cleaned = cleaned.replace(/L.*?的微博视频/g, '');
    cleaned = cleaned.replace(/.*?的微博视频/g, '');
    cleaned = cleaned.replace(/微博视频/g, '');

    // Strip Weibo special links & boilerplate
    cleaned = cleaned
      .replace(/https?:\/\/t\.cn\/[a-zA-Z0-9]+/g, '')
      .replace(/O网页链接/g, '')
      .replace(/网页链接/g, '')
      .replace(/【[^】]{1,80}超话】/g, '')
      .replace(/\s*…?\s*全文\s*$/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    return {
      clean: cleaned,
      hashtags: hashtags
    };
  }

  // ===== 3. Helper: Recursively harvest Weibo post / status objects =====
  function harvestWeiboPostsFromPayload(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 8) return;

    // Direct post object check
    const hasPostFields = (obj.id || obj.idstr || obj.mid || obj.mblogid) &&
      (obj.text || obj.text_raw || obj.pic_ids || obj.pic_infos || obj.pics || obj.user);

    if (hasPostFields) {
      const key = String(obj.mblogid || obj.idstr || obj.id || obj.mid);
      if (key) {
        window.__WEIBO_POST_CACHE__[key] = obj;
        if (obj.id) window.__WEIBO_POST_CACHE__[String(obj.id)] = obj;
        if (obj.idstr) window.__WEIBO_POST_CACHE__[String(obj.idstr)] = obj;
        if (obj.mblogid) window.__WEIBO_POST_CACHE__[String(obj.mblogid)] = obj;
      }
    }

    // Check statuses array
    if (Array.isArray(obj.statuses)) {
      for (const item of obj.statuses) {
        harvestWeiboPostsFromPayload(item, depth + 1);
      }
    }

    // Check cards array (Mobile Weibo m.weibo.cn format)
    if (Array.isArray(obj.cards)) {
      for (const card of obj.cards) {
        if (card.mblog) harvestWeiboPostsFromPayload(card.mblog, depth + 1);
        if (Array.isArray(card.card_group)) {
          for (const sub of card.card_group) {
            if (sub.mblog) harvestWeiboPostsFromPayload(sub.mblog, depth + 1);
          }
        }
      }
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        harvestWeiboPostsFromPayload(item, depth + 1);
      }
    } else {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          harvestWeiboPostsFromPayload(obj[key], depth + 1);
        }
      }
    }
  }

  // Harvest immediate global objects if available (SSR rendered on m.weibo.cn)
  try {
    if (window.$render_data) harvestWeiboPostsFromPayload(window.$render_data);
    if (window.__INITIAL_STATE__) harvestWeiboPostsFromPayload(window.__INITIAL_STATE__);
  } catch (e) {}

  // Scan inline script tags for $render_data
  try {
    const scripts = document.querySelectorAll('script:not([src])');
    for (const s of scripts) {
      const text = s.textContent || '';
      if (text.includes('$render_data') || text.includes('render_data')) {
        const match = text.match(/var\s+\$render_data\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/) ||
                      text.match(/var\s+\$render_data\s*=\s*(\{[\s\S]*?\});/) ||
                      text.match(/\$render_data\s*=\s*(\[[\s\S]*?\]);/) ||
                      text.match(/\$render_data\s*=\s*(\{[\s\S]*?\});/);
        if (match && match[1]) {
          try {
            const data = JSON.parse(match[1]);
            harvestWeiboPostsFromPayload(data);
          } catch (err) {}
        }
      }
    }
  } catch (e) {}

  // ===== 4. Intercept XMLHttpRequest & fetch =====
  try {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this._url = url;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
      this.addEventListener('load', function() {
        try {
          if (this._url && (
            this._url.includes('statuses') ||
            this._url.includes('feed') ||
            this._url.includes('getIndex') ||
            this._url.includes('hotflow') ||
            this._url.includes('comments') ||
            this._url.includes('weibo')
          )) {
            const data = JSON.parse(this.responseText);
            harvestWeiboPostsFromPayload(data);
          }
        } catch (e) {}
      });
      return origSend.apply(this, arguments);
    };

    const origFetch = window.fetch;
    window.fetch = function() {
      const urlArg = arguments[0];
      const urlStr = typeof urlArg === 'string' ? urlArg : (urlArg && urlArg.url ? urlArg.url : '');

      return origFetch.apply(this, arguments).then(response => {
        try {
          if (urlStr && (
            urlStr.includes('statuses') ||
            urlStr.includes('feed') ||
            urlStr.includes('getIndex') ||
            urlStr.includes('hotflow') ||
            urlStr.includes('comments') ||
            urlStr.includes('weibo')
          )) {
            response.clone().text().then(text => {
              try {
                const data = JSON.parse(text);
                harvestWeiboPostsFromPayload(data);
              } catch (e) {}
            }).catch(() => {});
          }
        } catch (e) {}
        return response;
      });
    };
  } catch (err) {
    console.warn('[Weibo→FB] Interceptor error:', err);
  }

  // Track hover/click/touch on Weibo post elements to know which post user is viewing
  window.__WEIBO_LAST_CLICKED_PID__ = '';

  function handleInteraction(target) {
    if (!target || typeof target.closest !== 'function') return;
    const postEl = target.closest('article, [class*="Feed_wrap"], [class*="wbpro-feed-content"], .card-wrap, .card.card9, .card');
    if (postEl) {
      const link = postEl.querySelector('a[href*="/detail/"], a[href*="/status/"], a[href^="/"]');
      if (link && link.href) {
        const m = link.href.match(/(?:detail|status)\/([a-zA-Z0-9]+)/i) ||
                  link.href.match(/weibo\.(?:com|cn)\/\d+\/([a-zA-Z0-9]+)/i);
        if (m && m[1]) {
          window.__WEIBO_LAST_ACTIVE_POST_ID__ = m[1];
        }
      }
      const img = target.tagName === 'IMG' ? target : target.querySelector('img');
      if (img) {
        const src = img.currentSrc || img.src || img.getAttribute('src') || '';
        const m = src.match(/(?:sinaimg\.cn|weibocdn\.com)\/[^/]+\/([a-zA-Z0-9_-]+)/i);
        if (m && m[1]) {
          window.__WEIBO_LAST_CLICKED_PID__ = m[1].split('.')[0];
        }
      }
    }
  }

  document.addEventListener('click', (e) => handleInteraction(e.target), true);
  document.addEventListener('touchstart', (e) => handleInteraction(e.target), true);
  document.addEventListener('mouseover', (e) => handleInteraction(e.target), { passive: true });

  // ===== 5. Helper: Format Weibo Created Time =====
  function formatWeiboDate(dateStr) {
    if (!dateStr) return 'Gần đây';
    try {
      const d = new Date(dateStr);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('vi-VN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
      }
    } catch (e) {}
    return String(dateStr);
  }

  // ===== 6. Build Standard Post Object from Weibo Data =====
  function buildResultFromWeiboPost(post) {
    if (!post || typeof post !== 'object') return null;

    const id = post.mblogid || post.idstr || post.id || ('wb_' + Date.now());
    const rawText = (post.text_raw || post.text || post.raw_text || '').trim();

    // Strip HTML tags if text contains markup
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawText;
    const plainText = (tempDiv.textContent || tempDiv.innerText || rawText).trim();

    // Remove hashtags & clean text
    const { clean: cleanCaption, hashtags } = cleanAndStripWeiboHashtags(plainText);

    // Extract Author & Avatar
    const user = post.user || {};
    const author = (user.screen_name || user.name || user.nick_name || 'Tác giả Weibo').trim();
    let avatar = user.avatar_large || user.profile_image_url || user.avatar_hd || '';
    if (avatar) avatar = getCleanWeiboImageUrl(avatar);

    // Extract Region / Location
    const region = post.region_name || post.status_city || '';
    let finalDesc = cleanCaption;
    if (region && !finalDesc.includes(region)) {
      finalDesc = `${finalDesc}\n\n📍 ${region}`;
    }

    // Extract Images
    const images = [];
    const livePhotos = [];

    // Method 1: Check pic_infos (modern weibo.com)
    if (post.pic_infos && typeof post.pic_infos === 'object') {
      const pids = post.pic_ids || Object.keys(post.pic_infos);
      pids.forEach((pid) => {
        const info = post.pic_infos[pid];
        if (info) {
          const bestUrl = info.original?.url ||
                          info.mw2000?.url ||
                          info.large?.url ||
                          info.bmiddle?.url ||
                          info.thumbnail?.url || '';

          const cleanBest = getCleanWeiboImageUrl(bestUrl);
          if (cleanBest && !images.includes(cleanBest)) {
            images.push(cleanBest);
          }

          const liveUrl = info.video || (info.type === 'livephoto' && (info.video_url || info.media?.url));
          if (liveUrl) {
            livePhotos.push({
              index: images.indexOf(cleanBest),
              imageUrl: cleanBest,
              videoUrl: liveUrl
            });
          }
        }
      });
    }

    // Method 2: Check pics array (mobile weibo / older API)
    if (images.length === 0 && Array.isArray(post.pics)) {
      post.pics.forEach((p) => {
        const u = p.large?.url || p.url || (p.pid ? `https://wx1.sinaimg.cn/original/${p.pid}.jpg` : '');
        const clean = getCleanWeiboImageUrl(u);
        if (clean && !images.includes(clean)) {
          images.push(clean);
        }
      });
    }

    // Method 3: Fallback from pic_ids
    if (images.length === 0 && Array.isArray(post.pic_ids)) {
      post.pic_ids.forEach(pid => {
        const u = `https://wx1.sinaimg.cn/original/${pid}.jpg`;
        if (!images.includes(u)) images.push(u);
      });
    }

    // Method 4: Video
    let videoUrl = '';
    const pageInfo = post.page_info;
    if (pageInfo) {
      videoUrl = pageInfo.media_info?.stream_url ||
                 pageInfo.media_info?.stream_url_hd ||
                 pageInfo.media_info?.playback_list?.[0]?.play_info?.url ||
                 pageInfo.media_info?.mp4_hd_url ||
                 pageInfo.media_info?.mp4_720p_mp4 || '';
    }

    const timestamp = post.created_at ? new Date(post.created_at).getTime() : Date.now();
    const createTime = formatWeiboDate(post.created_at);

    return {
      success: images.length > 0 || Boolean(videoUrl),
      platform: 'weibo',
      type: videoUrl ? 'video' : 'note',
      title: finalDesc ? (finalDesc.slice(0, 80) + '...') : 'Bài viết Weibo',
      desc: finalDesc,
      rawDesc: plainText,
      images: images,
      livePhotos: livePhotos,
      videoUrl: videoUrl,
      author: author,
      avatar: avatar,
      itemId: String(id),
      url: window.location.href,
      createTime: createTime,
      createTimestamp: Math.floor(timestamp / 1000),
      province: region,
      hashtags: hashtags
    };
  }

  // ===== 7. Extract Current Weibo Data =====
  async function extractCurrentWeiboData() {
    const currentUrl = window.location.href;

    const isPhotoSwipeActive = Boolean(
      document.querySelector('.pswp.pswp--open, .pswp:not([aria-hidden="true"])') ||
      (window.location.hash && window.location.hash.includes('gid='))
    );

    // Check if PhotoSwipe is active: scan ALL slides and images for PIDs
    try {
      const pswpImgs = Array.from(document.querySelectorAll('.pswp img, .pswp__img, .pswp__zoom-wrap img'));
      const foundPids = [];
      for (const img of pswpImgs) {
        const src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
        const m = src.match(/(?:sinaimg\.cn|weibocdn\.com)\/[^/]+\/([a-zA-Z0-9_-]+)/i);
        if (m) {
          const pid = m[1].split('.')[0];
          if (pid && !foundPids.includes(pid)) foundPids.push(pid);
        }
      }
      if (window.__WEIBO_LAST_CLICKED_PID__ && !foundPids.includes(window.__WEIBO_LAST_CLICKED_PID__)) {
        foundPids.push(window.__WEIBO_LAST_CLICKED_PID__);
      }

      for (const pid of foundPids) {
        for (const key of Object.keys(window.__WEIBO_POST_CACHE__)) {
          const p = window.__WEIBO_POST_CACHE__[key];
          if (!p) continue;
          const hasPid = (Array.isArray(p.pic_ids) && p.pic_ids.includes(pid)) ||
                         (Array.isArray(p.pics) && p.pics.some(x => x.pid === pid || (x.url && x.url.includes(pid)))) ||
                         (p.pic_infos && p.pic_infos[pid]);
          if (hasPid) {
            const res = buildResultFromWeiboPost(p);
            if (res && res.success) return res;
          }
        }
      }

      if (isPhotoSwipeActive) {
        return {
          success: false,
          platform: 'weibo',
          error: 'PhotoSwipe đang mở, chuyển sang quét card trên DOM.'
        };
      }
    } catch (e) {}

    // Detect post ID from URL
    const idMatch = currentUrl.match(/(?:detail|status)\/([a-zA-Z0-9]+)/i) ||
                    currentUrl.match(/weibo\.(?:com|cn)\/\d+\/([a-zA-Z0-9]+)/i) ||
                    currentUrl.match(/[?&]id=([a-zA-Z0-9]+)/i);

    const targetId = idMatch ? idMatch[1] : '';

    // Check cache first
    if (targetId && window.__WEIBO_POST_CACHE__[targetId]) {
      const cached = window.__WEIBO_POST_CACHE__[targetId];
      if (cached.isLongText && !cached.longTextFetched && window.fetch) {
        try {
          const res = await window.fetch(`/ajax/statuses/longtext?id=${cached.mblogid || cached.id}`, { credentials: 'include' });
          if (res.ok) {
            const json = await res.json();
            if (json.data?.longTextContent) {
              cached.text_raw = json.data.longTextContent;
              cached.longTextFetched = true;
            }
          }
        } catch (e) {}
      }
      const result = buildResultFromWeiboPost(cached);
      if (result && result.success) return result;
    }

    // If on detail page but not yet in cache, fetch directly from Weibo API
    if (targetId && window.fetch && window.location.hostname.includes('weibo.com')) {
      try {
        const res = await window.fetch(`/ajax/statuses/show?id=${encodeURIComponent(targetId)}`, { credentials: 'include' });
        if (res.ok) {
          const postData = await res.json();
          if (postData && (postData.id || postData.mblogid)) {
            if (postData.isLongText) {
              try {
                const ltRes = await window.fetch(`/ajax/statuses/longtext?id=${postData.mblogid || postData.id}`, { credentials: 'include' });
                if (ltRes.ok) {
                  const ltJson = await ltRes.json();
                  if (ltJson.data?.longTextContent) {
                    postData.text_raw = ltJson.data.longTextContent;
                  }
                }
              } catch (e) {}
            }
            window.__WEIBO_POST_CACHE__[targetId] = postData;
            const result = buildResultFromWeiboPost(postData);
            if (result && result.success) return result;
          }
        }
      } catch (e) {}
    }

    // Check last active post ID
    if (window.__WEIBO_LAST_ACTIVE_POST_ID__ && window.__WEIBO_POST_CACHE__[window.__WEIBO_LAST_ACTIVE_POST_ID__]) {
      const result = buildResultFromWeiboPost(window.__WEIBO_POST_CACHE__[window.__WEIBO_LAST_ACTIVE_POST_ID__]);
      if (result && result.success) return result;
    }

    return {
      success: false,
      platform: 'weibo',
      error: 'Chưa có trong cache API. Chuyển sang quét DOM.'
    };
  }

  // ===== 8. Listen for postMessage from weibo_content.js =====
  window.addEventListener('message', async function (event) {
    if (!event.data || event.data.type !== 'REQ_EXTRACT_WEIBO') return;

    try {
      const data = await extractCurrentWeiboData();
      window.postMessage({ type: 'RES_EXTRACT_WEIBO', payload: data }, '*');
    } catch (err) {
      window.postMessage({
        type: 'RES_EXTRACT_WEIBO',
        payload: { success: false, platform: 'weibo', error: err.message }
      }, '*');
    }
  });

})();
