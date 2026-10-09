// Injected into MAIN world on vk.com / vk.ru to access window.cur and VK page context
(function () {
  'use strict';

  function getBestPhotoUrl(photoObj) {
    if (!photoObj || typeof photoObj !== 'object') return '';

    // Original photo
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

    // sizes array: standard VK size codes [base, w (2560), z (1280), y (807), x (604), m (130), s (75)]
    if (Array.isArray(photoObj.sizes) && photoObj.sizes.length > 0) {
      const priority = ['base', 'w', 'z', 'y', 'x', 'm', 's'];
      for (const p of priority) {
        const found = photoObj.sizes.find(s => {
          if (!s) return false;
          const type = s.type || s[0];
          return type === p;
        });
        if (found) {
          const url = found.url || found.src || found[1];
          if (url) return url;
        }
      }

      // Fallback: pick item with largest dimensions
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

  // Deep search in nested objects for any photo items
  function deepFindPhotos(obj, results = [], depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 5) return;

    if (obj.sizes || obj.orig_photo || obj.w_src || obj.z_src) {
      const u = getBestPhotoUrl(obj);
      if (u && !results.includes(u)) {
        results.push(u);
      }
      return;
    }

    const values = Array.isArray(obj) ? obj : Object.values(obj);
    for (const v of values) {
      if (v && typeof v === 'object') {
        deepFindPhotos(v, results, depth + 1);
      }
    }
  }

  function extractMainWorldVkData() {
    const data = {
      found: false,
      images: [],
      desc: '',
      author: '',
      avatar: '',
      date: '',
      photoId: '',
      wallId: ''
    };

    try {
      const cur = window.cur || {};

      // 1. Check Photoview (modal)
      if (cur.pvData || cur.pvCurPhoto || document.getElementById('pv_box')) {
        let currentPhotoObj = null;

        if (cur.pvCurPhoto && typeof cur.pvCurPhoto === 'object') {
          currentPhotoObj = cur.pvCurPhoto;
        }

        // Deep search cur.pvData for all photos (handles nesting by listId / albumId)
        if (cur.pvData) {
          deepFindPhotos(cur.pvData, data.images);
        }

        if (currentPhotoObj) {
          const bestCur = getBestPhotoUrl(currentPhotoObj);
          if (bestCur && !data.images.includes(bestCur)) {
            data.images.unshift(bestCur);
          }
          if (currentPhotoObj.desc) data.desc = currentPhotoObj.desc;
          if (currentPhotoObj.id) data.photoId = String(currentPhotoObj.id);
          if (currentPhotoObj.author) data.author = String(currentPhotoObj.author);
          if (currentPhotoObj.date) data.date = String(currentPhotoObj.date);
        }

        if (data.images.length > 0) {
          data.found = true;
        }
      }

      // 2. Check cur.wallData or active post
      if (cur.wallData) {
        deepFindPhotos(cur.wallData, data.images);
        if (data.images.length > 0) data.found = true;
      }
    } catch (e) {
      console.warn('[Douyin→FB / VK Inject] Error inspecting window.cur:', e);
    }

    return data;
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
