// Injected into MAIN world on vk.com / vk.ru to access window.cur
(function () {
  'use strict';

  function getBestPhotoUrl(photoObj) {
    if (!photoObj || typeof photoObj !== 'object') return '';

    // Original base photo
    if (photoObj.orig_photo && photoObj.orig_photo.url) {
      return photoObj.orig_photo.url;
    }

    // Direct resolution attributes (from largest to smallest)
    if (photoObj.w_src) return photoObj.w_src;
    if (photoObj.z_src) return photoObj.z_src;
    if (photoObj.y_src) return photoObj.y_src;
    if (photoObj.x_src) return photoObj.x_src;
    if (photoObj.m_src) return photoObj.m_src;
    if (photoObj.src) return photoObj.src;

    // sizes array: prioritize base, w (2560), z (1280), y (807), x (604)
    if (Array.isArray(photoObj.sizes) && photoObj.sizes.length > 0) {
      const priority = ['base', 'w', 'z', 'y', 'x', 'm', 's'];
      for (const p of priority) {
        const found = photoObj.sizes.find(s => s && (s.type === p || s[0] === p));
        if (found) {
          const url = found.url || found.src || found[1];
          if (url) return url;
        }
      }

      let bestItem = null;
      let maxArea = 0;
      for (const s of photoObj.sizes) {
        if (!s) continue;
        const w = s.width || s.w || s[2] || 0;
        const h = s.height || s.h || s[3] || 0;
        const area = w * h;
        if (area > maxArea) {
          maxArea = area;
          bestItem = s;
        }
      }
      if (bestItem) {
        return bestItem.url || bestItem.src || bestItem[1] || '';
      }
    }

    return photoObj.url || photoObj.src || '';
  }

  function extractMainWorldVkData() {
    try {
      const cur = window.cur || {};

      // Only inspect the currently active photo in photoview to avoid pulling old cached search photos
      if (cur.pvCurPhoto && typeof cur.pvCurPhoto === 'object') {
        const bestCur = getBestPhotoUrl(cur.pvCurPhoto);
        return {
          found: !!bestCur,
          curPhotoUrl: bestCur || '',
          desc: cur.pvCurPhoto.desc || '',
          photoId: cur.pvCurPhoto.id ? String(cur.pvCurPhoto.id) : '',
          author: cur.pvCurPhoto.author ? String(cur.pvCurPhoto.author) : '',
          date: cur.pvCurPhoto.date ? String(cur.pvCurPhoto.date) : ''
        };
      }
    } catch (e) {
      console.warn('[Douyin→FB / VK Inject] Error inspecting window.cur:', e);
    }

    return { found: false };
  }

  // Listen for request from isolated content script
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'REQ_EXTRACT_VK') return;

    const result = extractMainWorldVkData();
    window.postMessage({
      type: 'RES_EXTRACT_VK',
      payload: result
    }, '*');
  });
})();
