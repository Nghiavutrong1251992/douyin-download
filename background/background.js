// Background Service Worker (Manifest V3)
// Core responsibility: Handle image downloading with correct headers,
// background post processing, DeepSeek translation, and cross-origin fetching

try {
  importScripts('../lib/db.js');
} catch (e) {
  console.warn('[Background] Cannot load db.js in worker:', e);
}

// Open the extension as a persistent browser side panel when its toolbar
// icon is clicked. Chrome/Edge lets the user choose whether panels sit on
// the left or right side of the browser window.
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.warn('[Douyin→FB] Cannot configure side panel:', error));
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['deepseekApiKey', 'deepseekModel', 'systemPromptTemplate'], (res) => {
    if (!res.deepseekModel) {
      chrome.storage.local.set({ deepseekModel: 'deepseek-chat' });
    }
    if (!res.systemPromptTemplate) {
      chrome.storage.local.set({
        systemPromptTemplate: `You are an expert social media manager for Facebook Travel and Lifestyle Fanpages.
Your task is to translate and creatively adapt this Chinese Douyin caption into an engaging English Facebook post.
Format the output as follows:
1. 🌟 Catchy Hook with emojis (Grab attention)
2. 📖 Engaging Story / Experience (Describing the destination, beauty, and emotional vibe)
3. 📍 Key Highlights / Location Info
4. ✈️ Call to Action (e.g. "Save for your next trip!", "Tag a travel buddy!")
5. 🏷️ 5-8 Viral English Hashtags (Replace all Chinese hashtags with relevant English travel hashtags).

Keep tone enthusiastic, inspiring, and authentic. Output ONLY the ready-to-publish Facebook post.`
      });
    }
  });
});

// ============ IN-MEMORY DIAGNOSTIC LOG BUFFER ============
globalThis.__DIAGNOSTIC_LOGS__ = globalThis.__DIAGNOSTIC_LOGS__ || [];

function addDiagLog(tag, message, details = null) {
  const time = new Date().toLocaleTimeString('vi-VN');
  const entry = { time, tag, message, details };
  globalThis.__DIAGNOSTIC_LOGS__.push(entry);
  if (globalThis.__DIAGNOSTIC_LOGS__.length > 80) {
    globalThis.__DIAGNOSTIC_LOGS__.shift();
  }
  if (details) {
    console.log(`[${time}][${tag}] ${message}`, details);
  } else {
    console.log(`[${time}][${tag}] ${message}`);
  }
}

// ============ IMAGE DOWNLOAD WITH CORRECT HEADERS ============
// Douyin CDN (douyinpic.com) and RedNote CDN (xhscdn.com)
// require correct Referer and headers or block hotlinks.
// We use fetch() from the background service worker with host_permissions.

async function fetchImageAsBlob(imageUrl) {
  let url = (imageUrl || '').trim();
  if (url.startsWith('//')) url = 'https:' + url;
  if (!url.startsWith('http')) url = 'https:' + url;
  url = url.replace(/^http:/, 'https:');

  const isVk = url.includes('userapi.com') ||
               url.includes('vkuserphoto.ru') ||
               url.includes('vk.com') ||
               url.includes('vk.ru') ||
               url.includes('mycdn.me') ||
               url.includes('okcdn.ru');

  const isXhs = url.includes('xhscdn.com') ||
                url.includes('rednotecdn.com') ||
                url.includes('xiaohongshu.com') ||
                url.includes('xhslink.com') ||
                url.includes('rednote.com');

  addDiagLog('Fetch', `Bắt đầu nạp ảnh: ${url.substring(0, 75)} (Platform: ${isXhs ? 'RedNote' : isVk ? 'VK' : 'Douyin'})`);

  // Build list of candidate URLs
  const candidates = [];
  if (isXhs) {
    // Priority 1: The original signed URL (vital for rednotecdn.com / xhscdn token verification)
    if (!url.includes('ci.xiaohongshu.com') && !url.includes('sns-img-hw.xhscdn.com/1040g')) {
      if (!candidates.includes(url)) candidates.push(url);
      const cleanRaw = url.split('!')[0];
      if (cleanRaw !== url && !candidates.includes(cleanRaw)) candidates.push(cleanRaw);
    }

    // Priority 2: Direct CDN nodes if traceId exists
    const traceMatch = url.match(/(1040g[0-9a-zA-Z]+)/) || url.match(/\/([a-zA-Z0-9_-]{24,50})(?:!|\?|$)/);
    const traceId = traceMatch ? traceMatch[1] : '';
    if (traceId) {
      const hw = `https://sns-img-hw.xhscdn.com/${traceId}`;
      const bd = `https://sns-img-bd.xhscdn.com/${traceId}`;
      const qc = `https://sns-img-qc.xhscdn.com/${traceId}`;
      if (!candidates.includes(hw)) candidates.push(hw);
      if (!candidates.includes(bd)) candidates.push(bd);
      if (!candidates.includes(qc)) candidates.push(qc);
    }
  } else {
    candidates.push(url);
  }

  addDiagLog('Fetch', `Danh sách ${candidates.length} candidate URLs: ${candidates.map(c => c.split('?')[0].slice(-30)).join(' | ')}`);

  let lastError = null;
  const attempts = [];

  for (let i = 0; i < candidates.length; i++) {
    const targetUrl = candidates[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      addDiagLog('Fetch-Try', `Thử candidate #${i + 1}/${candidates.length}: ${targetUrl.substring(0, 65)}`);
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        },
        signal: controller.signal,
        credentials: 'omit'
      });
      clearTimeout(timeoutId);

      const contentType = response.headers.get('Content-Type') || '';
      if (response.ok) {
        const blob = await response.blob();
        attempts.push(`[#${i + 1}] HTTP ${response.status} (${blob.size}B, ${contentType}) - OK`);
        if (blob.size >= 1024) {
          addDiagLog('Fetch-Success', `✅ Tải thành công từ candidate #${i + 1}: ${targetUrl.substring(0, 60)} (${blob.size} bytes)`);
          return blob;
        } else {
          addDiagLog('Fetch-Warn', `⚠️ Candidate #${i + 1} trả về file quá nhỏ (<1KB): ${blob.size}B`);
        }
      } else {
        attempts.push(`[#${i + 1}] HTTP ${response.status} (${contentType})`);
        addDiagLog('Fetch-Fail', `❌ Candidate #${i + 1} thất bại -> HTTP ${response.status}`);
        lastError = new Error(`HTTP ${response.status} khi tải từ ${targetUrl.substring(0, 60)}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const errMsg = err.name === 'AbortError' ? 'Timeout 12s' : err.message;
      attempts.push(`[#${i + 1}] Lỗi mạng: ${errMsg}`);
      addDiagLog('Fetch-Error', `❌ Candidate #${i + 1} lỗi mạng: ${errMsg}`);
      lastError = err;
    }
  }

  const finalMsg = `Không tải được ảnh sau ${candidates.length} lần thử. Chi tiết: ${attempts.join('; ')}`;
  addDiagLog('Fetch-Fatal', `⛔ ${finalMsg}`);
  throw new Error(finalMsg);
}

// Convert Blob to Data URL safely in Worker without DOM FileReader dependency
async function blobToDataUrlWorker(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
  }
  const base64 = btoa(binary);
  return `data:${blob.type || 'image/jpeg'};base64,${base64}`;
}

// Convert image blob to clean, metadata-stripped JPG using OffscreenCanvas (Manifest V3 native)
async function convertBlobToCleanJpgWorker(blob, quality = 0.92, maxDimension = null) {
  try {
    const imageBitmap = await createImageBitmap(blob);
    const sourceWidth = imageBitmap.width;
    const sourceHeight = imageBitmap.height;
    const scale = maxDimension ? Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight)) : 1;
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
    imageBitmap.close();

    const cleanBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    return cleanBlob;
  } catch (err) {
    console.warn('[Background] OffscreenCanvas conversion fallback:', err);
    return blob;
  }
}

async function fetchImageAsBase64(imageUrl) {
  const blob = await fetchImageAsBlob(imageUrl);
  const dataUrl = await blobToDataUrlWorker(blob);
  const base64 = dataUrl.split(',')[1];
  return {
    base64: base64,
    size: blob.size,
    type: blob.type
  };
}

// ============ DOWNLOAD SINGLE IMAGE VIA chrome.downloads ============
async function downloadImageFile(imageUrl, filename) {
  const blob = await fetchImageAsBlob(imageUrl);
  const dataUrl = await blobToDataUrlWorker(blob);

  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
    });
  });
}

// ============ PERSISTENT BACKGROUND POST DOWNLOAD & SAVE ENGINE ============
// Runs in Background Service Worker: Switching tabs will NEVER stop or interrupt download!
async function backgroundProcessAndSavePost(payload) {
  const mediaData = payload.mediaData || {};
  const selectedUrls = payload.selectedUrls || mediaData.images || [];
  if (!selectedUrls.length) {
    throw new Error('Không có ảnh nào để tải.');
  }

  const postId = payload.postId || mediaData.itemId || String(Date.now());
  const authorName = mediaData.author || (mediaData.platform === 'vk' ? 'Tác giả VK' : (mediaData.platform === 'rednote' || mediaData.platform === 'xhs' ? 'Tác giả RedNote' : 'Tác giả Douyin'));
  const total = selectedUrls.length;

  let backgroundState = {
    active: true,
    postId,
    author: authorName,
    total,
    current: 0,
    statusText: `Bắt đầu tải ${total} ảnh từ @${authorName}...`,
    startedAt: Date.now()
  };

  await chrome.storage.local.set({ backgroundDownload: backgroundState });
  if (chrome.action?.setBadgeText) {
    chrome.action.setBadgeText({ text: '⏳' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
  }

  const cleanImages = [];

  for (let i = 0; i < selectedUrls.length; i++) {
    const url = selectedUrls[i];
    const statusText = `Đang tải ảnh ${i + 1}/${total} ở chế độ nền (chuyển tab vẫn tải)...`;
    backgroundState.current = i + 1;
    backgroundState.statusText = statusText;

    await chrome.storage.local.set({ backgroundDownload: backgroundState });
    if (chrome.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: `${i + 1}/${total}` });
    }
    chrome.runtime.sendMessage({
      type: 'BACKGROUND_DOWNLOAD_PROGRESS',
      payload: { ...backgroundState }
    }).catch(() => {});

    try {
      const rawBlob = await fetchImageAsBlob(url);
      const cleanJpgBlob = await convertBlobToCleanJpgWorker(rawBlob, 0.92);
      const cleanDataUrl = await blobToDataUrlWorker(cleanJpgBlob);
      const thumbnailBlob = await convertBlobToCleanJpgWorker(cleanJpgBlob, 0.68, 480);
      const thumbnailDataUrl = await blobToDataUrlWorker(thumbnailBlob);

      cleanImages.push({
        filename: `photo_${String(i + 1).padStart(2, '0')}.jpg`,
        dataUrl: cleanDataUrl,
        thumbnailDataUrl: thumbnailDataUrl,
        tags: []
      });
    } catch (imgErr) {
      console.warn(`[Background] Lỗi tải ảnh ${i + 1}:`, imgErr);
    }
  }

  let avatarDataUrl = '';
  if (mediaData.avatar) {
    try {
      const rawAvatar = await fetchImageAsBlob(mediaData.avatar);
      const cleanAvatar = await convertBlobToCleanJpgWorker(rawAvatar, 0.8, 512);
      avatarDataUrl = await blobToDataUrlWorker(cleanAvatar);
    } catch (avErr) {
      console.warn('[Background] Lỗi tải avatar:', avErr);
    }
  }

  const postRecord = {
    id: postId,
    author: authorName,
    authorId: mediaData.authorId || '',
    avatar: avatarDataUrl || mediaData.avatar || '',
    createTime: mediaData.createTime || 'Không xác định',
    createTimestamp: mediaData.createTimestamp || 0,
    desc: payload.desc || mediaData.desc || '',
    notes: payload.notes || '',
    englishCaption: payload.englishCaption || mediaData.englishCaption || '',
    sourceUrl: mediaData.url || '',
    images: cleanImages,
    thumbUrl: cleanImages.length > 0 ? cleanImages[0].thumbnailDataUrl : '',
    status: 'pending',
    imageProcessed: false,
    savedAt: Date.now()
  };

  if (typeof DouyinDB !== 'undefined') {
    await DouyinDB.savePost(postRecord);
  }

  backgroundState = {
    active: false,
    complete: true,
    savedPostId: postRecord.id,
    author: authorName,
    total,
    current: cleanImages.length,
    statusText: `✅ Đã tải xong ${cleanImages.length}/${total} ảnh!`,
    finishedAt: Date.now()
  };

  await chrome.storage.local.set({ backgroundDownload: backgroundState });
  if (chrome.action?.setBadgeText) {
    chrome.action.setBadgeText({ text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
  }

  chrome.runtime.sendMessage({
    type: 'BACKGROUND_DOWNLOAD_COMPLETE',
    payload: { postRecord }
  }).catch(() => {});

  if (chrome.notifications?.create) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Tải ảnh Douyin hoàn tất!',
      message: `Đã tải xong ${cleanImages.length} ảnh của @${authorName}. Dữ liệu đã sẵn sàng trong Offline Studio!`
    });
  }

  if (payload.openViewer) {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`viewer/viewer.html?id=${postRecord.id}`)
    });
  }

  return postRecord;
}

// ============ DEEPSEEK API TRANSLATION ============
async function translateWithDeepSeek(apiKey, model, systemPrompt, originalText) {
  if (!apiKey) {
    throw new Error('Chưa cấu hình DeepSeek API Key. Vui lòng vào Cài đặt để nhập API Key.');
  }

  const endpoint = 'https://api.deepseek.com/chat/completions';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Original Chinese Caption:\n"""${originalText}"""\n\nPlease translate and rewrite it into an engaging English Facebook post.` }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Lỗi DeepSeek API (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const output = result.choices?.[0]?.message?.content || '';
  return output.trim();
}

// ============ MESSAGE LISTENER ============
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // The on-page Douyin button requests the panel during its user gesture.
  if (request.type === 'OPEN_SIDE_PANEL') {
    if (!chrome.sidePanel?.open || !sender.tab?.windowId) {
      sendResponse({ success: false, error: 'Trình duyệt chưa hỗ trợ Side Panel.' });
      return false;
    }

    chrome.sidePanel.open({ windowId: sender.tab.windowId })
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Fetch image as base64 (for ZIP packaging)
  if (request.type === 'FETCH_IMAGE_BASE64') {
    addDiagLog('IPC', `Nhận yêu cầu FETCH_IMAGE_BASE64: ${request.url ? request.url.substring(0, 70) : 'n/a'}`);
    fetchImageAsBase64(request.url)
      .then(result => {
        addDiagLog('IPC', `✅ Trả kết quả FETCH_IMAGE_BASE64 thành công (${result.size} bytes)`);
        sendResponse({
          success: true,
          base64: result.base64,
          size: result.size,
          type: result.type
        });
      })
      .catch(err => {
        addDiagLog('IPC', `❌ Thất bại FETCH_IMAGE_BASE64: ${err.message}`);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  // Diagnostic Logs for debug modal
  if (request.type === 'GET_DIAGNOSTIC_LOGS') {
    sendResponse({
      success: true,
      logs: globalThis.__DIAGNOSTIC_LOGS__ || []
    });
    return true;
  }

  if (request.type === 'CLEAR_DIAGNOSTIC_LOGS') {
    globalThis.__DIAGNOSTIC_LOGS__ = [];
    sendResponse({ success: true });
    return true;
  }

  // Download single image to disk
  if (request.type === 'DOWNLOAD_IMAGE') {
    const isVk = request.url && (request.url.includes('userapi.com') || request.url.includes('vk.com') || request.url.includes('vk.ru'));
    const isXhs = request.url && (request.url.includes('xhscdn.com') || request.url.includes('xiaohongshu.com') || request.url.includes('rednote.com') || request.url.includes('xhslink.com'));
    const defaultFilename = isVk ? 'vk_photo.jpg' : (isXhs ? 'rednote_photo.jpg' : 'douyin_photo.jpg');
    downloadImageFile(request.url, request.filename || defaultFilename)
      .then(id => sendResponse({ success: true, downloadId: id }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // DeepSeek translation
  if (request.type === 'CALL_DEEPSEEK_TRANSLATION') {
    const { apiKey, model, systemPrompt, originalText } = request.payload;
    translateWithDeepSeek(apiKey, model, systemPrompt, originalText)
      .then(translation => sendResponse({ success: true, translation }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Verify a single image URL can be fetched (size check)
  if (request.type === 'VERIFY_IMAGE_URL') {
    fetchImageAsBlob(request.url)
      .then(blob => sendResponse({
        success: true,
        size: blob.size,
        type: blob.type
      }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Start background post downloading & saving (runs in Service Worker even when tabs switch!)
  if (request.type === 'START_BACKGROUND_SAVE_POST') {
    backgroundProcessAndSavePost(request.payload || {})
      .then(postRecord => sendResponse({ success: true, postRecord }))
      .catch(async (err) => {
        console.error('[Background] Download error:', err);
        await chrome.storage.local.set({
          backgroundDownload: { active: false, complete: false, error: err.message }
        });
        if (chrome.action?.setBadgeText) {
          chrome.action.setBadgeText({ text: '!' });
          chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
          setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
        }
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  // Check background download status
  if (request.type === 'GET_BACKGROUND_DOWNLOAD_STATUS') {
    chrome.storage.local.get(['backgroundDownload'], (res) => {
      sendResponse({ success: true, status: res.backgroundDownload || null });
    });
    return true;
  }
});
