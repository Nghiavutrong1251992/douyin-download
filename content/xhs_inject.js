// Injected into MAIN world on xiaohongshu.com / rednote.com / xhslink.com
// Responsible for: reading window.__INITIAL_STATE__, caching dynamic API responses,
// and providing full watermark-free HD images and note details
(function () {
  'use strict';

  // Cache of note details intercepted from fetch / XMLHttpRequest
  window.__XHS_NOTE_CACHE__ = window.__XHS_NOTE_CACHE__ || {};
  window.__XHS_LAST_ACTIVE_NOTE_ID__ = window.__XHS_LAST_ACTIVE_NOTE_ID__ || '';

  // ===== 1. Helper: Extract traceId from Xiaohongshu image URL =====
  function extractTraceId(url) {
    if (!url || typeof url !== 'string') return '';
    const traceMatch = url.match(/(1040g[0-9a-zA-Z]+)/);
    if (traceMatch) {
      return traceMatch[1];
    }
    const match = url.match(/\/([a-zA-Z0-9_-]{24,50})(?:!|\?|$)/);
    if (match && match[1]) {
      return match[1];
    }
    return '';
  }

  // ===== 2. Helper: Convert image item to valid signed high-res URL =====
  function getCleanXhsImageUrl(imgItem) {
    if (!imgItem) return '';

    // If imgItem is directly a string URL
    if (typeof imgItem === 'string') {
      let u = imgItem.trim();
      if (u.startsWith('//')) u = 'https:' + u;
      if (!u.startsWith('http')) u = 'https:' + u;
      return u.replace(/^http:/, 'https:');
    }

    if (typeof imgItem !== 'object') return '';

    // Priority 1: Check infoList for highest resolution scene
    if (Array.isArray(imgItem.infoList) && imgItem.infoList.length > 0) {
      // Prioritize WB_DFT (Web Default HD), CR_DFT, WB_PRV or first valid url
      const best = imgItem.infoList.find(i => i && (i.imageScene === 'WB_DFT' || i.imageScene === 'CR_DFT' || i.imageScene === 'CR_PRV')) || imgItem.infoList[0];
      if (best && best.url) {
        let u = best.url.trim().replace(/^http:/, 'https:');
        if (u.startsWith('//')) u = 'https:' + u;
        return u;
      }
    }

    // Priority 2: Use urlDefault or url
    const rawUrl = imgItem.urlDefault || imgItem.url || imgItem.urlPre || '';
    if (rawUrl) {
      let u = rawUrl.trim().replace(/^http:/, 'https:');
      if (u.startsWith('//')) u = 'https:' + u;
      return u;
    }

    // Priority 3: Fallback only if no real URL was provided
    const traceId = imgItem.traceId || imgItem.fileId || '';
    if (traceId && traceId.startsWith('1040g')) {
      return `https://sns-img-hw.xhscdn.com/${traceId}`;
    }

    return '';
  }

  // ===== 3. Helper: Recursively find note objects from any JSON payload =====
  function harvestNotesFromPayload(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 8) return;

    if (obj.id && (obj.title !== undefined || obj.desc !== undefined) && (obj.imageList || obj.images || obj.user)) {
      window.__XHS_NOTE_CACHE__[obj.id] = obj;
      window.__XHS_LAST_ACTIVE_NOTE_ID__ = obj.id;
      return;
    }

    if (obj.noteCard && obj.noteCard.id) {
      window.__XHS_NOTE_CACHE__[obj.noteCard.id] = obj.noteCard;
      window.__XHS_LAST_ACTIVE_NOTE_ID__ = obj.noteCard.id;
    }

    if (obj.note && obj.note.id) {
      window.__XHS_NOTE_CACHE__[obj.note.id] = obj.note;
      window.__XHS_LAST_ACTIVE_NOTE_ID__ = obj.note.id;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        harvestNotesFromPayload(item, depth + 1);
      }
    } else {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          harvestNotesFromPayload(obj[key], depth + 1);
        }
      }
    }
  }

  // ===== 4. Intercept XMLHttpRequest & fetch to cache notes dynamically =====
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
          if (this._url && (this._url.includes('/api/sns/') || this._url.includes('/note') || this._url.includes('/feed'))) {
            const data = JSON.parse(this.responseText);
            harvestNotesFromPayload(data);
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
          if (urlStr && (urlStr.includes('/api/sns/') || urlStr.includes('/note') || urlStr.includes('/feed'))) {
            response.clone().text().then(text => {
              try {
                const data = JSON.parse(text);
                harvestNotesFromPayload(data);
              } catch (e) {}
            }).catch(() => {});
          }
        } catch (e) {}
        return response;
      });
    };
  } catch (err) {
    console.warn('[RedNote] Interceptor error:', err);
  }

  // ===== 5. Helper: Format publish time =====
  function formatPublishTime(timestampRaw) {
    if (!timestampRaw) return 'Gần đây';
    let ms = Number(timestampRaw);
    if (!Number.isFinite(ms) || ms <= 0) return 'Gần đây';
    if (ms < 1e12) ms = ms * 1000;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return 'Gần đây';
    return date.toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // ===== Helper: Extract Live Photo Video Stream URL =====
  function extractLivePhotoVideoUrl(imgItem) {
    if (!imgItem || typeof imgItem !== 'object') return '';

    const stream = imgItem.livePhoto?.media?.stream ||
                   imgItem.stream ||
                   imgItem.video?.media?.stream ||
                   imgItem.livePhotoVideo?.media?.stream;

    if (stream) {
      const list = stream.h264 || stream.h265 || stream.av1;
      if (Array.isArray(list) && list.length > 0) {
        const best = list[0];
        const vUrl = best.masterUrl || (best.backupUrls && best.backupUrls[0]) || '';
        if (vUrl) return vUrl;
      }
    }

    if (typeof imgItem.livePhoto === 'string' && imgItem.livePhoto.startsWith('http')) {
      return imgItem.livePhoto;
    }
    if (imgItem.livePhoto?.url) return imgItem.livePhoto.url;
    if (imgItem.livePhotoUrl) return imgItem.livePhotoUrl;
    if (imgItem.live_photo_url) return imgItem.live_photo_url;
    if (typeof imgItem.livePhotoVideo === 'string' && imgItem.livePhotoVideo.startsWith('http')) {
      return imgItem.livePhotoVideo;
    }
    if (imgItem.livePhotoVideo?.url) return imgItem.livePhotoVideo.url;

    return '';
  }

  // ===== 6. Build standardized result object from a Note structure =====
  function buildResultFromNote(note, targetId = '') {
    if (!note || typeof note !== 'object') return null;

    const id = note.id || note.noteId || note.note_id || targetId || window.__XHS_LAST_ACTIVE_NOTE_ID__ || ('xhs_' + Date.now());
    const title = (note.title || note.displayTitle || '').trim();
    let desc = (note.desc || note.content || title || '').trim();

    // If province/location is given and not in desc, append nicely
    const location = note.ipLocation || note.ip_location || note.location || '';
    if (location && !desc.includes(location)) {
      desc = `${desc}\n\n📍 ${location}`;
    }

    const user = note.user || note.author || {};
    const author = (user.nickname || user.name || user.nick_name || 'Tác giả RedNote').trim();
    const avatar = user.avatar || user.image || user.avatar_url || '';

    // Collect images & Live Photo motion clips
    const rawImages = note.imageList || note.images || [];
    const images = [];
    const livePhotos = [];

    for (let idx = 0; idx < rawImages.length; idx++) {
      const item = rawImages[idx];
      const cleanUrl = getCleanXhsImageUrl(item);
      if (cleanUrl) {
        if (!images.includes(cleanUrl)) {
          images.push(cleanUrl);
        }
        const imgIndex = images.indexOf(cleanUrl);
        const liveVideoUrl = extractLivePhotoVideoUrl(item);
        if (liveVideoUrl) {
          livePhotos.push({
            index: imgIndex,
            imageUrl: cleanUrl,
            videoUrl: liveVideoUrl
          });
        }
      }
    }

    // Video support if available
    let videoUrl = '';
    const isVideo = note.type === 'video' || Boolean(note.video);
    if (isVideo && note.video) {
      videoUrl = note.video.media?.stream?.h264?.[0]?.masterUrl ||
                 note.video.url ||
                 note.video.media?.stream?.av1?.[0]?.masterUrl || '';
    }

    // Cover image fallback if no imageList but cover exists
    if (images.length === 0 && (note.cover || note.image)) {
      const coverUrl = getCleanXhsImageUrl(note.cover || note.image);
      if (coverUrl && !images.includes(coverUrl)) images.push(coverUrl);
    }

    // Hashtags
    const hashtags = [];
    const tagsFromText = (desc + ' ' + title).match(/#[^\s#]+/g) || [];
    tagsFromText.forEach(t => {
      const cleanTag = t.trim();
      if (!hashtags.includes(cleanTag)) hashtags.push(cleanTag);
    });

    if (Array.isArray(note.tagList)) {
      note.tagList.forEach(t => {
        const tagName = t?.name ? `#${t.name}` : '';
        if (tagName && !hashtags.includes(tagName)) hashtags.push(tagName);
      });
    }

    const timestamp = note.time || note.createTime || note.timestamp || 0;
    const createTime = formatPublishTime(timestamp);

    return {
      success: images.length > 0 || Boolean(videoUrl),
      platform: 'rednote',
      type: isVideo ? 'video' : 'note',
      title: title || (desc.slice(0, 80) + '...'),
      desc: desc,
      images: images,
      livePhotos: livePhotos,
      videoUrl: videoUrl,
      author: author,
      avatar: avatar,
      itemId: id,
      url: window.location.href,
      createTime: createTime,
      createTimestamp: timestamp < 1e12 ? timestamp : Math.floor(timestamp / 1000),
      province: location,
      hashtags: hashtags
    };
  }

  // ===== 7. Main extraction routine =====
  function extractCurrentXhsData() {
    const currentUrl = window.location.href;

    // Detect note ID from URL
    const idMatch = currentUrl.match(/(?:explore|discovery\/item|search_result)\/([a-zA-Z0-9_-]{15,45})/i) ||
                    currentUrl.match(/[?&](?:noteId|targetId)=([a-zA-Z0-9_-]+)/i);
    const targetId = idMatch ? idMatch[1] : '';

    // STRATEGY 1: Check cached API responses
    if (targetId && window.__XHS_NOTE_CACHE__[targetId]) {
      const res = buildResultFromNote(window.__XHS_NOTE_CACHE__[targetId], targetId);
      if (res && res.success) return res;
    }

    // STRATEGY 2: Check window.__INITIAL_STATE__
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note) {
      const noteState = window.__INITIAL_STATE__.note;

      // Path A: noteDetailMap[targetId]
      if (targetId && noteState.noteDetailMap && noteState.noteDetailMap[targetId]) {
        const entry = noteState.noteDetailMap[targetId];
        const noteObj = entry.note || entry;
        const res = buildResultFromNote(noteObj, targetId);
        if (res && res.success) return res;
      }

      // Path B: firstNoteId
      const firstId = typeof noteState.firstNoteId === 'object'
        ? noteState.firstNoteId?.value
        : noteState.firstNoteId;

      if (firstId && noteState.noteDetailMap && noteState.noteDetailMap[firstId]) {
        const entry = noteState.noteDetailMap[firstId];
        const noteObj = entry.note || entry;
        const res = buildResultFromNote(noteObj, firstId);
        if (res && res.success) return res;
      }

      // Path C: direct note in noteState
      if (noteState.note) {
        const res = buildResultFromNote(noteState.note, targetId);
        if (res && res.success) return res;
      }

      // Path D: Any entry in noteDetailMap
      if (noteState.noteDetailMap) {
        for (const k of Object.keys(noteState.noteDetailMap)) {
          const entry = noteState.noteDetailMap[k];
          const noteObj = entry?.note || entry;
          if (noteObj && (noteObj.imageList || noteObj.images)) {
            const res = buildResultFromNote(noteObj, k);
            if (res && res.success) return res;
          }
        }
      }
    }

    // STRATEGY 3: Check most recently active note in cache
    if (window.__XHS_LAST_ACTIVE_NOTE_ID__ && window.__XHS_NOTE_CACHE__[window.__XHS_LAST_ACTIVE_NOTE_ID__]) {
      const res = buildResultFromNote(window.__XHS_NOTE_CACHE__[window.__XHS_LAST_ACTIVE_NOTE_ID__], window.__XHS_LAST_ACTIVE_NOTE_ID__);
      if (res && res.success) return res;
    }

    // STRATEGY 4: Check any cached note in __XHS_NOTE_CACHE__
    const cachedKeys = Object.keys(window.__XHS_NOTE_CACHE__);
    if (cachedKeys.length > 0) {
      const latestKey = cachedKeys[cachedKeys.length - 1];
      const res = buildResultFromNote(window.__XHS_NOTE_CACHE__[latestKey], latestKey);
      if (res && res.success) return res;
    }

    // If nothing in state, return failure so content script runs DOM fallback
    return {
      success: false,
      platform: 'rednote',
      error: 'Không tìm thấy dữ liệu RedNote trong state.'
    };
  }

  // ===== 8. Listen for postMessage from xhs_content.js =====
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'REQ_EXTRACT_XHS') return;

    try {
      const data = extractCurrentXhsData();
      window.postMessage({ type: 'RES_EXTRACT_XHS', payload: data }, '*');
    } catch (err) {
      window.postMessage({
        type: 'RES_EXTRACT_XHS',
        payload: { success: false, platform: 'rednote', error: err.message }
      }, '*');
    }
  });

})();
