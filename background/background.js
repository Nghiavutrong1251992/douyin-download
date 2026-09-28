// Background Service Worker (Manifest V3)
// Core responsibility: Handle image downloading with correct headers,
// DeepSeek translation, and cross-origin fetching

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

async function fetchImageAsBase64(imageUrl) {
  const blob = await fetchImageAsBlob(imageUrl);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve({
        base64: base64,
        size: blob.size,
        type: blob.type
      });
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file blob'));
    reader.readAsDataURL(blob);
  });
}

// ============ DOWNLOAD SINGLE IMAGE VIA chrome.downloads ============
async function downloadImageFile(imageUrl, filename) {
  const blob = await fetchImageAsBlob(imageUrl);
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    });
  });
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
});
