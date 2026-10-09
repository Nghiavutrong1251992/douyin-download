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

  function addPhotoFromObj(photoObj, list) {
    if (!photoObj || typeof photoObj !== 'object') return;
    const u = getBestPhotoUrl(photoObj);
    if (u && !list.includes(u)) {
      list.push(u);
    }
  }

  // Deep search within a specific object for photo items
  function deepCollectPhotos(obj, results = [], depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 6) return;
    if (obj.sizes || obj.orig_photo || obj.w_src || obj.z_src || obj.y_src) {
      addPhotoFromObj(obj, results);
      return;
    }
    const values = Array.isArray(obj) ? obj : Object.values(obj);
    for (const v of values) {
      if (v && typeof v === 'object') {
        deepCollectPhotos(v, results, depth + 1);
      }
    }
  }

  function extractMainWorldVkData(reqPayload) {
    const result = {
      found: false,
      images: [],
      desc: '',
      photoId: '',
      author: '',
      date: '',
      listId: '',
      curPhotoUrl: ''
    };

    try {
      const cur = window.cur || {};
      const rawUrl = (reqPayload && reqPayload.url) || window.location.href || '';
      const decodedUrl = decodeURIComponent(rawUrl);
      const wallMatch = decodedUrl.match(/wall([-\d]+)_(\d+)/i);
      const targetWallId = wallMatch ? `wall${wallMatch[1]}_${wallMatch[2]}` : null;
      const targetWallRaw = wallMatch ? `${wallMatch[1]}_${wallMatch[2]}` : null;
      const targetPostIdOnly = wallMatch ? wallMatch[2] : null;

      // 1. Photoviewer modal or photo data in memory
      if (cur.pvCurPhoto || cur.pvData || cur.pvList || document.getElementById('pv_box')) {
        let targetListObj = null;

        if (cur.pvData && typeof cur.pvData === 'object') {
          // Priority A: Target wall ID from URL (e.g. wall74543688_55815)
          if (targetWallId && cur.pvData[targetWallId]) {
            targetListObj = cur.pvData[targetWallId];
            result.listId = targetWallId;
          }
          // Priority B: cur.pvListId
          else if (cur.pvListId && cur.pvData[cur.pvListId]) {
            targetListObj = cur.pvData[cur.pvListId];
            result.listId = cur.pvListId;
          }
          // Priority C: targetWallRaw (74543688_55815)
          else if (targetWallRaw && cur.pvData[targetWallRaw]) {
            targetListObj = cur.pvData[targetWallRaw];
            result.listId = targetWallRaw;
          }
          // Priority D: Partial key match in cur.pvData
          else if (targetWallRaw) {
            for (const key of Object.keys(cur.pvData)) {
              if (key.includes(targetWallRaw) || (targetWallId && key.includes(targetWallId))) {
                targetListObj = cur.pvData[key];
                result.listId = key;
                break;
              }
            }
          }
        }

        // If matched to a specific post's list container in cur.pvData:
        if (targetListObj) {
          deepCollectPhotos(targetListObj, result.images);
        }

        // Priority E: If no target container found by key, filter cur.pvData by target post attributes or cur.pvList
        if (result.images.length === 0 && cur.pvData && typeof cur.pvData === 'object') {
          // E1. Check if cur.pvList is an array of photo IDs for this modal
          if (Array.isArray(cur.pvList) && cur.pvList.length > 0) {
            const pvListSet = new Set(cur.pvList.map(item => {
              if (typeof item === 'string') return item.replace(/^photo/, '');
              if (item && item.id) return String(item.id).replace(/^photo/, '');
              return String(item);
            }));

            function collectMatchingPvList(obj, depth = 0) {
              if (!obj || typeof obj !== 'object' || depth > 6) return;
              if (obj.sizes || obj.orig_photo || obj.w_src || obj.z_src || obj.y_src || obj.src) {
                const objId = String(obj.id || obj.raw || '').replace(/^photo/, '');
                const rawCombo = `${obj.owner_id}_${obj.id}`;
                if (pvListSet.has(objId) || pvListSet.has(rawCombo) || pvListSet.has(String(obj.id))) {
                  addPhotoFromObj(obj, result.images);
                  return;
                }
              }
              const vals = Array.isArray(obj) ? obj : Object.values(obj);
              for (const v of vals) {
                if (v && typeof v === 'object') collectMatchingPvList(v, depth + 1);
              }
            }
            collectMatchingPvList(cur.pvData);
          }

          // E2. Filter cur.pvData by matching post_id / listId
          if (result.images.length === 0 && (targetWallId || targetPostIdOnly)) {
            function collectMatchingPost(obj, depth = 0) {
              if (!obj || typeof obj !== 'object' || depth > 6) return;
              if (obj.sizes || obj.orig_photo || obj.w_src || obj.z_src || obj.y_src) {
                const isMatch = (targetWallId && (obj.listId === targetWallId || obj.context === targetWallId)) ||
                                (targetPostIdOnly && (String(obj.post_id) === String(targetPostIdOnly)));
                if (isMatch) {
                  addPhotoFromObj(obj, result.images);
                  return;
                }
              }
              const vals = Array.isArray(obj) ? obj : Object.values(obj);
              for (const v of vals) {
                if (v && typeof v === 'object') collectMatchingPost(v, depth + 1);
              }
            }
            collectMatchingPost(cur.pvData);
          }

          // E3. If cur.pvData has only 1 key/group (no old posts cached), collect all
          if (result.images.length === 0) {
            const keys = Object.keys(cur.pvData);
            if (keys.length === 1) {
              deepCollectPhotos(cur.pvData[keys[0]], result.images);
              result.listId = keys[0];
            }
          }
        }

        // Active single photo in photoviewer (cur.pvCurPhoto)
        if (cur.pvCurPhoto && typeof cur.pvCurPhoto === 'object') {
          const curBest = getBestPhotoUrl(cur.pvCurPhoto);
          result.curPhotoUrl = curBest || '';
          if (curBest && !result.images.includes(curBest)) {
            // If result.images already has photos from the list, ensure curBest doesn't get lost
            if (result.images.length === 0) {
              result.images.push(curBest);
            }
          }
          result.desc = cur.pvCurPhoto.desc || '';
          result.photoId = cur.pvCurPhoto.id ? String(cur.pvCurPhoto.id) : '';
          result.author = cur.pvCurPhoto.author ? String(cur.pvCurPhoto.author) : '';
          result.date = cur.pvCurPhoto.date ? String(cur.pvCurPhoto.date) : '';
          if (!result.listId && cur.pvCurPhoto.listId) {
            result.listId = String(cur.pvCurPhoto.listId);
          }
        }
      }

      // 2. Feed / Wall post in memory (cur.wallData)
      if (result.images.length === 0 && cur.wallData && typeof cur.wallData === 'object') {
        if (targetWallRaw && cur.wallData[targetWallRaw]) {
          deepCollectPhotos(cur.wallData[targetWallRaw], result.images);
        } else if (targetWallId && cur.wallData[targetWallId]) {
          deepCollectPhotos(cur.wallData[targetWallId], result.images);
        }
      }

      if (result.images.length > 0) {
        result.found = true;
      }
    } catch (e) {
      console.warn('[Douyin→FB / VK Inject] Error inspecting window.cur:', e);
    }

    return result;
  }

  // Listen for request from isolated content script
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'REQ_EXTRACT_VK') return;

    const result = extractMainWorldVkData(event.data.payload);
    window.postMessage({
      type: 'RES_EXTRACT_VK',
      payload: result
    }, '*');
  });
})();
