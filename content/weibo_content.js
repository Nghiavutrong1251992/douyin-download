// Content Script injected into weibo.com and weibo.cn
// Responsible for: injecting MAIN world extractor, creating floating action button,
// DOM fallback extraction, PhotoSwipe detection, hashtag removal, and communicating with background / popup
(function () {
  'use strict';

  // ===== 1. Inject MAIN world script to access Weibo internal API & state =====
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('content/weibo_inject.js');
    s.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn('[Weibo→FB] Error injecting MAIN script:', e);
  }

  // ===== 2. Helper: Clean up & upgrade image URL to Original / Large HD =====
  function cleanDomImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let u = rawUrl.trim();
    if (u.startsWith('//')) u = 'https:' + u;
    if (!u.startsWith('http')) return '';
    u = u.replace(/^http:/, 'https:');

    // Filter out thumbnails, icons, avatars, emojis, base64 transparent gif
    if (u.includes('avatar') || u.includes('icon') || u.includes('emoji') ||
      u.includes('data:image') || u.includes('userhead') || u.includes('face_') ||
      u.includes('default_avatar')) {
      return '';
    }

    // Upgrade resolution to original or large if on sinaimg.cn or weibocdn.com
    if (u.includes('sinaimg.cn') || u.includes('weibocdn.com')) {
      u = u.replace(/\/(?:thumbnail|thumb150|thumb180|thumb300|small|square|bmiddle|mw690|mw1024|orj360|orj480|orj960|orj1080|oslarge|wap180|wap360|wap720)\//, '/original/');
    }

    return u;
  }

  // ===== 3. Helper: Strip Hashtags from DOM Text =====
  function stripHashtagsFromText(rawText) {
    if (!rawText || typeof rawText !== 'string') return { clean: '', hashtags: [] };

    const raw = rawText;
    const hashtags = [];

    // Match Weibo dual-hash topics: #topic#, ＃topic＃, #topic＃, ＃topic#
    const topicMatches = raw.match(/[#＃﹟][^\s#＃﹟\r\n](?:[^#＃﹟\r\n]{0,98}[^\s#＃﹟\r\n])?[#＃﹟]/gu) || [];
    topicMatches.forEach(tag => {
      const cleanTag = tag.replace(/^[#＃﹟]+|[#＃﹟]+$/g, '').trim();
      if (cleanTag && !hashtags.includes(cleanTag)) hashtags.push(cleanTag);
    });

    // Match single hashtags: #tag, ＃tag
    const singleHashMatches = raw.match(/[#＃﹟][\p{L}\p{N}_·・]+(?:[\.\-][\p{L}\p{N}_·・]+)*/gu) || [];
    singleHashMatches.forEach(tag => {
      const cleanTag = tag.replace(/^[#＃﹟]+/, '').trim();
      if (cleanTag && !hashtags.includes(cleanTag)) hashtags.push(cleanTag);
    });

    let cleaned = raw;

    // 1. Remove brackets wrapping hashtags: 【#tag#】, 【＃tag＃】, [#tag#], (#tag#), （＃tag＃）
    cleaned = cleaned.replace(/[【\[(（]\s*[#＃﹟][^#＃﹟\r\n]{1,100}[#＃﹟]\s*[】\])）]/gu, ' ');
    cleaned = cleaned.replace(/[【\[(（]\s*[#＃﹟][^#＃﹟\r\n【】\[\]()（）]{1,100}\s*[】\])）]/gu, ' ');

    // 2. Dual-hash topics (Weibo, XHS, etc.): #topic#, ＃topic＃, #topic＃, ＃topic#
    cleaned = cleaned.replace(/[#＃﹟][^\s#＃﹟\r\n](?:[^#＃﹟\r\n]{0,98}[^\s#＃﹟\r\n])?[#＃﹟]/gu, ' ');

    // 3. Super Topics (超话) & Weibo topic tags
    cleaned = cleaned.replace(/[【\[(（]\s*[^【\[(（\r\n\s]{1,50}超话\s*[】\])）]/gu, ' ');
    cleaned = cleaned.replace(/(?:^|[\s，,、。！？!?])[\p{L}\p{N}_·・\-]{1,20}超话(?=\s|$|[，,、。！？!?])/gu, ' ');
    cleaned = cleaned.replace(/\[(?:超话|话题|地点)\]/gu, '');

    // 4. Single-hash tags: #tag, ＃tag (Chinese, Unicode letters, numbers, hyphens, middle dot ·)
    cleaned = cleaned.replace(/[#＃﹟][\p{L}\p{N}_·・]+(?:[\.\-][\p{L}\p{N}_·・]+)*/gu, ' ');

    // 5. Stickers/Emoticons: [心], [doge], [偷笑], [微风]...
    cleaned = cleaned.replace(/\[[\p{L}\p{N}_]{1,20}\]/gu, '');

    // 6. User mentions: @username or ＠username
    cleaned = cleaned.replace(/[@＠][\p{L}\p{N}_-]+/gu, '');

    // 7. Video signatures (safe without greedy wiping)
    cleaned = cleaned.replace(/(?:L\s*)?[^\r\n\s]{1,30}的微博视频/gu, '');
    cleaned = cleaned.replace(/(?:L\s*)?微博视频/gu, '');

    // 8. Special links & boilerplate
    cleaned = cleaned
      .replace(/https?:\/\/t\.cn\/[a-zA-Z0-9]+/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/O\s*网页链接/g, '')
      .replace(/网页链接/g, '')
      .replace(/\s*(?:\.{2,}|…)?\s*(?:展开|全文|展开全文|展开全文c)\s*$/gu, '')
      .replace(/^[ \t]*[2📍📌]\s*[\p{L}\p{N}_·・\.\-]+\s*$/gmu, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    return { clean: cleaned, hashtags: hashtags };
  }

  // ===== 4. DOM-based extraction (Handles weibo.com, m.weibo.cn & PhotoSwipe) =====
  function extractFromDom() {
    const isPhotoSwipeActive = Boolean(
      document.querySelector('.pswp.pswp--open, .pswp:not([aria-hidden="true"])') ||
      (window.location.hash && window.location.hash.includes('gid='))
    );

    // Strategy 1: User is viewing an image in PhotoSwipe Lightbox (e.g. on m.weibo.cn)
    if (isPhotoSwipeActive) {
      const pswpImages = [];
      const pswpImgs = document.querySelectorAll('.pswp img, .pswp__img, .pswp__zoom-wrap img');
      for (const img of pswpImgs) {
        const src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
        const clean = cleanDomImageUrl(src);
        if (clean && !pswpImages.includes(clean)) {
          pswpImages.push(clean);
        }
      }

      // Try to find the active image PID
      let activePid = '';
      if (pswpImages.length > 0) {
        const m = pswpImages[0].match(/(?:sinaimg\.cn|weibocdn\.com)\/[^/]+\/([a-zA-Z0-9_-]+)/i);
        if (m) activePid = m[1].split('.')[0];
      }

      // Find the card on the page that owns this image
      const allCards = Array.from(document.querySelectorAll('.card-wrap, .card.card9, [class*="card_wrap"], article, [class*="Feed_wrap"]'));
      let targetCard = null;

      if (activePid) {
        targetCard = allCards.find(c => c.innerHTML.includes(activePid));
      }

      if (!targetCard && window.location.hash) {
        const gidMatch = window.location.hash.match(/[#&]gid=(\d+)/);
        if (gidMatch) {
          const gid = parseInt(gidMatch[1], 10);
          const postCards = allCards.filter(c => c.querySelector('.weibo-text, .m-img-box, .weibo-media, .text, [class*="text"]'));
          if (gid > 0 && postCards[gid - 1]) {
            targetCard = postCards[gid - 1];
          }
        }
      }

      if (targetCard) {
        // Collect all photos from this post card
        const cardImages = [];
        const cardImgEls = targetCard.querySelectorAll('img');
        for (const img of cardImgEls) {
          const src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
          const clean = cleanDomImageUrl(src);
          if (clean && !cardImages.includes(clean)) {
            cardImages.push(clean);
          }
        }

        // Merge PhotoSwipe images
        for (const u of pswpImages) {
          if (!cardImages.includes(u)) cardImages.unshift(u);
        }

        const textEl = targetCard.querySelector('.weibo-text, [class*="detail_wbtext"], [class*="wbpro-feed-content"], [class*="wbtext"], .text, .content');
        const rawDesc = textEl ? textEl.innerText.trim() : '';
        const { clean: descClean, hashtags } = stripHashtagsFromText(rawDesc);

        const authorEl = targetCard.querySelector('header h3, .m-text-box h3, [class*="head_name"] a, [class*="wbpro-feed-name"] a, .screen_name, .name');
        const avatarEl = targetCard.querySelector('header img, .m-avatar-box img, [class*="head_avatar"] img, [class*="woo-avatar-img"], img.avatar');
        const author = authorEl ? authorEl.innerText.trim() : 'Tác giả Weibo';
        let avatar = avatarEl ? (avatarEl.currentSrc || avatarEl.src) : '';
        if (avatar) avatar = cleanDomImageUrl(avatar);

        const dateEl = targetCard.querySelector('.time, [class*="head_time"], [class*="wbpro-feed-time"], time, .date');
        const dateText = dateEl ? dateEl.innerText.trim() : 'Gần đây';

        const idLink = targetCard.querySelector('a[href*="/detail/"], a[href*="/status/"]');
        let itemId = 'wb_' + Date.now();
        if (idLink && idLink.href) {
          const m = idLink.href.match(/(?:detail|status)\/([a-zA-Z0-9]+)/i);
          if (m) itemId = m[1];
        }

        return {
          success: cardImages.length > 0,
          platform: 'weibo',
          type: 'note',
          title: descClean ? (descClean.slice(0, 80) + '...') : 'Bài viết Weibo',
          desc: descClean,
          rawDesc: rawDesc,
          images: cardImages,
          livePhotos: [],
          videoUrl: '',
          author: author,
          avatar: avatar,
          itemId: itemId,
          url: window.location.href,
          createTime: dateText,
          hashtags: hashtags
        };
      }

      // If card not found, but we have images from PhotoSwipe
      if (pswpImages.length > 0) {
        return {
          success: true,
          platform: 'weibo',
          type: 'note',
          title: document.title ? document.title.replace(/_微博$/, '') : 'Ảnh Weibo',
          desc: document.title || 'Ảnh tải từ Weibo',
          rawDesc: '',
          images: pswpImages,
          livePhotos: [],
          videoUrl: '',
          author: 'Tác giả Weibo',
          avatar: '',
          itemId: 'wb_' + Date.now(),
          url: window.location.href,
          createTime: 'Gần đây',
          hashtags: []
        };
      }
    }

    // Strategy 2: Desktop modal popup on weibo.com
    const modal = document.querySelector('.woo-picture-popup, [class*="woo-modal"], [role="dialog"]');
    if (modal) {
      const modalImages = [];
      const imgEls = modal.querySelectorAll('img');
      for (const img of imgEls) {
        const src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
        const clean = cleanDomImageUrl(src);
        if (clean && !modalImages.includes(clean)) modalImages.push(clean);
      }
      if (modalImages.length > 0) {
        const textEl = modal.querySelector('[class*="detail_wbtext"], [class*="wbpro-feed-content"], [class*="wbtext"], .weibo-text, .text');
        const rawDesc = textEl ? textEl.innerText.trim() : '';
        const { clean: descClean, hashtags } = stripHashtagsFromText(rawDesc);
        const authorEl = modal.querySelector('[class*="head_name"] a, [class*="wbpro-feed-name"] a, .screen_name');
        const author = authorEl ? authorEl.innerText.trim() : 'Tác giả Weibo';

        return {
          success: true,
          platform: 'weibo',
          type: 'note',
          title: descClean ? (descClean.slice(0, 80) + '...') : 'Bài viết Weibo',
          desc: descClean,
          rawDesc: rawDesc,
          images: modalImages,
          livePhotos: [],
          videoUrl: '',
          author: author,
          avatar: '',
          itemId: 'wb_' + Date.now(),
          url: window.location.href,
          createTime: 'Gần đây',
          hashtags: hashtags
        };
      }
    }

    // Strategy 3: Standard post card in timeline or detail page
    const cards = Array.from(document.querySelectorAll('article, .card-wrap, .card.card9, [class*="Feed_wrap"], [class*="wbpro-feed-content"]'));
    let activeCard = null;

    if (cards.length === 1) {
      activeCard = cards[0];
    } else if (cards.length > 1) {
      // Find card currently closest to center of viewport
      const centerY = window.innerHeight / 2;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (r.top <= centerY && r.bottom >= 60) {
          activeCard = c;
          break;
        }
      }
      if (!activeCard) activeCard = cards[0];
    }

    const searchScope = activeCard || document;
    const imgEls = searchScope.querySelectorAll('img');
    const images = [];

    for (const img of imgEls) {
      const src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
      const clean = cleanDomImageUrl(src);
      if (clean && !images.includes(clean)) {
        images.push(clean);
      }
    }

    if (images.length === 0) {
      return {
        success: false,
        platform: 'weibo',
        error: 'Không tìm thấy ảnh trên trang Weibo hiện tại. Hãy mở một bài viết hoặc click xem chi tiết bài.'
      };
    }

    const textEl = searchScope.querySelector('[class*="detail_wbtext"], [class*="wbpro-feed-content"], [class*="wbtext"], .weibo-text, .text, .content');
    const rawDesc = textEl ? textEl.innerText.trim() : '';
    const { clean: descClean, hashtags } = stripHashtagsFromText(rawDesc);

    const authorEl = searchScope.querySelector('header h3, .m-text-box h3, [class*="head_name"] a, [class*="wbpro-feed-name"] a, .screen_name, header a[usercard], .name a');
    const avatarEl = searchScope.querySelector('header img, .m-avatar-box img, [class*="head_avatar"] img, [class*="woo-avatar-img"], img.avatar');
    const author = authorEl ? authorEl.innerText.trim() : 'Tác giả Weibo';
    let avatar = avatarEl ? (avatarEl.currentSrc || avatarEl.src) : '';
    if (avatar) avatar = cleanDomImageUrl(avatar);

    const dateEl = searchScope.querySelector('.time, [class*="head_time"], [class*="wbpro-feed-time"], time, .date');
    const dateText = dateEl ? dateEl.innerText.trim() : 'Gần đây';

    const idMatch = window.location.href.match(/(?:detail|status)\/([a-zA-Z0-9]+)/i) ||
      window.location.href.match(/weibo\.(?:com|cn)\/\d+\/([a-zA-Z0-9]+)/i);
    const itemId = idMatch ? idMatch[1] : ('wb_' + Date.now());

    return {
      success: true,
      platform: 'weibo',
      type: 'note',
      title: descClean ? (descClean.slice(0, 80) + '...') : 'Bài viết Weibo',
      desc: descClean,
      rawDesc: rawDesc,
      images: images,
      livePhotos: [],
      videoUrl: '',
      author: author,
      avatar: avatar,
      itemId: itemId,
      url: window.location.href,
      createTime: dateText,
      hashtags: hashtags
    };
  }

  // ===== 5. Floating Action Button for Weibo =====
  function createWeiboFloatingBtn() {
    if (document.getElementById('weibo-to-fb-floating-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'weibo-to-fb-floating-btn';
    btn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 28px;
      z-index: 999999;
      background: linear-gradient(135deg, #fa7d3c 0%, #ff8200 100%);
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 30px;
      box-shadow: 0 8px 24px rgba(250, 125, 60, 0.45);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(255, 255, 255, 0.25);
      user-select: none;
    `;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
      <span>Lấy ảnh Weibo sang FB</span>
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-3px) scale(1.03)';
      btn.style.boxShadow = '0 12px 28px rgba(250, 125, 60, 0.65)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'none';
      btn.style.boxShadow = '0 8px 24px rgba(250, 125, 60, 0.45)';
    });

    btn.addEventListener('click', async () => {
      const originalHTML = btn.innerHTML;
      btn.style.opacity = '0.7';
      btn.innerHTML = '<span>⏳ Đang quét ảnh Weibo...</span>';

      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => { });

      try {
        const data = await extractWeiboData();
        if (data && data.success && (data.images.length > 0 || data.videoUrl)) {
          chrome.storage.local.set({
            currentExtractedData: data,
            lastExtractedAt: Date.now()
          }, () => {
            const countStr = data.images.length > 0 ? `${data.images.length} ảnh HD` : '1 video';
            showToast(`✅ Đã trích xuất ${countStr} từ Weibo (đã lọc sạch hashtag)! Dữ liệu đã hiện trong sidebar.`);
          });
        } else {
          showToast(data?.error || '❌ Không tìm thấy ảnh. Hãy mở một bài viết hoặc click xem chi tiết bài trên Weibo.');
        }
      } catch (err) {
        showToast('❌ Lỗi trích xuất Weibo: ' + err.message);
      } finally {
        setTimeout(() => {
          btn.style.opacity = '1';
          btn.innerHTML = originalHTML;
        }, 1200);
      }
    });

    document.body.appendChild(btn);
  }

  // ===== 6. Toast Notification =====
  function showToast(message) {
    let toast = document.getElementById('weibo-fb-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'weibo-fb-toast';
      toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999999;
        background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(12px);
        color: #f8fafc; padding: 14px 20px; border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px; line-height: 1.4;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45);
        border: 1px solid rgba(255,255,255,0.15);
        transform: translateX(120%); transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
        max-width: 400px;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.transform = 'translateX(0)';

    setTimeout(() => {
      toast.style.transform = 'translateX(120%)';
    }, 4500);
  }

  // ===== 7. Listen for request from Main World (weibo_inject.js) =====
  function requestMainWorldData() {
    return new Promise((resolve) => {
      const handler = (event) => {
        if (!event.data || event.data.type !== 'RES_EXTRACT_WEIBO') return;
        window.removeEventListener('message', handler);
        clearTimeout(timer);
        resolve(event.data.payload);
      };
      window.addEventListener('message', handler);

      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 1500);

      window.postMessage({ type: 'REQ_EXTRACT_WEIBO' }, '*');
    });
  }

  // ===== 8. Master Extractor =====
  async function extractWeiboData() {
    // Priority 1: Main World extraction (reads cached API responses & fetches status JSON)
    try {
      const mainData = await requestMainWorldData();
      if (mainData && mainData.success && (mainData.images.length > 0 || mainData.videoUrl)) {
        return mainData;
      }
    } catch (e) {
      console.warn('[Weibo→FB] Main world extraction warning:', e);
    }

    // Priority 2: DOM-based extraction fallback (Robust PhotoSwipe + Card parser)
    return extractFromDom();
  }

  // ===== 9. Listen for messages from Popup / Background =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'BACKGROUND_DOWNLOAD_PROGRESS') {
      const info = request.payload;
      showToast(`⏳ Đang tải ảnh Weibo ${info.current}/${info.total} ở chế độ nền... Bạn chuyển tab thoải mái!`);
      return;
    }

    if (request.type === 'BACKGROUND_DOWNLOAD_COMPLETE') {
      const post = request.payload?.postRecord;
      showToast(`🎉 Đã tải xong ${post?.images?.length || 0} ảnh Weibo vào kho Offline!`);
      return;
    }

    if (request.type === 'GET_CURRENT_PAGE_MEDIA') {
      extractWeiboData()
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, platform: 'weibo', error: err.message }));
      return true; // Keep port open for async response
    }
  });

  // ===== 10. Init floating button =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWeiboFloatingBtn);
  } else {
    createWeiboFloatingBtn();
  }

  // Re-create button on SPA navigation
  const observer = new MutationObserver(() => {
    if (!document.getElementById('weibo-to-fb-floating-btn')) {
      createWeiboFloatingBtn();
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });
})();
