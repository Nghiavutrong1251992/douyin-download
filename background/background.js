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

// ============ IMAGE DOWNLOAD WITH CORRECT HEADERS ============
// This is the KEY function: Douyin CDN (douyinpic.com, byteimg.com)
// requires Referer: https://www.douyin.com/ or returns 403/empty HTML.
// We use fetch() from the background service worker which has host_permissions
// to bypass CORS, and we set the correct Referer header.

async function fetchImageAsBlob(imageUrl) {
  // Clean up the URL
  let url = imageUrl.trim();
  if (!url.startsWith('http')) {
    url = 'https:' + url;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Referer': 'https://www.douyin.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site'
    },
    mode: 'cors',
    credentials: 'omit'
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} khi tải ảnh: ${url.substring(0, 80)}...`);
  }

  const contentType = response.headers.get('Content-Type') || '';
  const blob = await response.blob();

  // Validate: real image should be > 1KB and have image content type
  if (blob.size < 1024) {
    // Might be an HTML error page — try to read it
    const text = await blob.text();
    if (text.includes('<html') || text.includes('<!DOCTYPE')) {
      throw new Error(`CDN trả về HTML thay vì ảnh (${blob.size} bytes). URL có thể đã hết hạn.`);
    }
  }

  return blob;
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
  const authorName = mediaData.author || 'Tác giả Douyin';
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
    fetchImageAsBase64(request.url)
      .then(result => sendResponse({
        success: true,
        base64: result.base64,
        size: result.size,
        type: result.type
      }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Download single image to disk
  if (request.type === 'DOWNLOAD_IMAGE') {
    downloadImageFile(request.url, request.filename || 'douyin_photo.jpg')
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
      .catch(err => {
        console.error('[Background] Download error:', err);
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
