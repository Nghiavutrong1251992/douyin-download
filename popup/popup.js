// Popup UI Logic — handles extraction, DeepSeek AI, and instant Offline Studio saving
document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM References =====
  const tabExtractBtn = document.getElementById('tab-extract-btn');
  const tabLibraryBtn = document.getElementById('tab-library-btn');
  const tabFanpagesBtn = document.getElementById('tab-fanpages-btn');
  const tabSettingsBtn = document.getElementById('tab-settings-btn');
  const tabExtract = document.getElementById('tab-extract');
  const tabLibrary = document.getElementById('tab-library');
  const tabFanpages = document.getElementById('tab-fanpages');
  const tabSettings = document.getElementById('tab-settings');

  const libraryCount = document.getElementById('library-count');
  const libraryList = document.getElementById('library-list');
  const libraryEmpty = document.getElementById('library-empty');
  const btnClearLibrary = document.getElementById('btn-clear-library');
  const btnOpenStudioTop = document.getElementById('btn-open-studio-top');

  const douyinInput = document.getElementById('douyin-input');
  const btnParseLink = document.getElementById('btn-parse-link');
  const btnGrabActiveTab = document.getElementById('btn-grab-active-tab');

  const statusBar = document.getElementById('status-bar');
  const statusText = document.getElementById('status-text');

  const reviewArea = document.getElementById('review-area');
  const metaAuthorAvatar = document.getElementById('meta-author-avatar');
  const metaAuthorName = document.getElementById('meta-author-name');
  const metaBadgeType = document.getElementById('meta-badge-type');
  const metaPostTime = document.getElementById('meta-post-time');

  const mediaCountLabel = document.getElementById('media-count-label');
  const imageGrid = document.getElementById('image-grid');
  const videoPreviewWrapper = document.getElementById('video-preview-wrapper');
  const videoPreview = document.getElementById('video-preview');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  const btnViewLogs = document.getElementById('btn-view-logs');
  const modalLogViewer = document.getElementById('modal-log-viewer');
  const logViewerContent = document.getElementById('log-viewer-content');
  const btnCloseLogModal = document.getElementById('btn-close-log-modal');
  const btnCopyDebugLogs = document.getElementById('btn-copy-debug-logs');
  const btnClearDebugLogs = document.getElementById('btn-clear-debug-logs');

  window.__POPUP_LOGS__ = window.__POPUP_LOGS__ || [];
  function logPopup(msg, details = null) {
    const time = new Date().toLocaleTimeString('vi-VN');
    const line = `[${time}][Popup] ${msg}${details ? ' ' + (typeof details === 'object' ? JSON.stringify(details) : details) : ''}`;
    window.__POPUP_LOGS__.push(line);
    if (window.__POPUP_LOGS__.length > 60) window.__POPUP_LOGS__.shift();
    if (details) console.log(`[Popup] ${msg}`, details);
    else console.log(`[Popup] ${msg}`);
  }

  const originalCaptionEl = document.getElementById('original-caption');
  const englishCaptionEl = document.getElementById('english-caption');
  const btnDeepseekTranslate = document.getElementById('btn-deepseek-translate');
  const btnCopyOriginal = document.getElementById('btn-copy-original');
  const btnCopyEnglish = document.getElementById('btn-copy-english');

  const btnSaveAndView = document.getElementById('btn-save-and-view');
  const btnOpenStudio = document.getElementById('btn-open-studio');
  const btnSaveOfflinePackage = document.getElementById('btn-save-offline-package');

  const settingDeepseekKey = document.getElementById('setting-deepseek-key');
  const settingDeepseekModel = document.getElementById('setting-deepseek-model');
  const settingSystemPrompt = document.getElementById('setting-system-prompt');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const saveStatus = document.getElementById('save-status');
  const settingFacebookWorker = document.getElementById('setting-facebook-worker');

  const btnConnectFacebook = document.getElementById('btn-connect-facebook');
  const btnRefreshFanpages = document.getElementById('btn-refresh-fanpages');
  const facebookConnectionStatus = document.getElementById('facebook-connection-status');
  const fanpageList = document.getElementById('fanpage-list');
  const fanpageEmpty = document.getElementById('fanpage-empty');
  const offlineFolderStatus = document.getElementById('offline-folder-status');
  const btnChooseOfflineFolder = document.getElementById('btn-choose-offline-folder');
  const btnSyncOfflineFolder = document.getElementById('btn-sync-offline-folder');
  const btnRestoreOfflineFolder = document.getElementById('btn-restore-offline-folder');

  // ===== State =====
  let currentMediaData = null;
  let selectedImageUrls = [];

  // ===== TABS =====
  tabExtractBtn.addEventListener('click', () => switchTab('tab-extract'));
  tabLibraryBtn.addEventListener('click', () => {
    switchTab('tab-library');
    loadLibrary();
  });
  tabFanpagesBtn.addEventListener('click', () => {
    switchTab('tab-fanpages');
    loadFanpages();
  });
  tabSettingsBtn.addEventListener('click', () => switchTab('tab-settings'));

  function switchTab(target) {
    tabExtractBtn.classList.toggle('active', target === 'tab-extract');
    tabLibraryBtn.classList.toggle('active', target === 'tab-library');
    tabFanpagesBtn.classList.toggle('active', target === 'tab-fanpages');
    tabSettingsBtn.classList.toggle('active', target === 'tab-settings');

    tabExtract.classList.toggle('active', target === 'tab-extract');
    tabLibrary.classList.toggle('active', target === 'tab-library');
    tabFanpages.classList.toggle('active', target === 'tab-fanpages');
    tabSettings.classList.toggle('active', target === 'tab-settings');
  }

  // Open full studio page
  btnOpenStudio.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer/viewer.html') });
  });
  btnOpenStudioTop.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer/viewer.html') });
  });

  // ===== SETTINGS & PERSISTENCE =====
  async function loadSettings() {
    chrome.storage.local.get(
      ['deepseekApiKey', 'deepseekModel', 'systemPromptTemplate', 'facebookWorkerUrl', 'currentExtractedData', 'lastExtractedAt'],
      (res) => {
        if (res.deepseekApiKey) settingDeepseekKey.value = res.deepseekApiKey;
        if (res.deepseekModel) settingDeepseekModel.value = res.deepseekModel;
        if (res.facebookWorkerUrl) settingFacebookWorker.value = res.facebookWorkerUrl;
        if (res.systemPromptTemplate) {
          settingSystemPrompt.value = res.systemPromptTemplate;
        } else {
          settingSystemPrompt.value = getDefaultPrompt();
        }

        // Auto-load recently extracted data (within last 10 min)
        if (res.currentExtractedData && res.currentExtractedData.success && res.lastExtractedAt) {
          const age = Date.now() - res.lastExtractedAt;
          if (age < 10 * 60 * 1000) {
            currentMediaData = res.currentExtractedData;
            displayExtractedData(res.currentExtractedData);
          }
        }
      }
    );

    // Update library count from IndexedDB
    try {
      const count = await DouyinDB.getPostCount();
      libraryCount.innerText = count;
    } catch (e) {}
  }
  loadSettings();
  refreshOfflineFolderStatus();

  function getDefaultPrompt() {
    return `You are an expert social media manager for Facebook Travel and Lifestyle Fanpages.
Translate and creatively adapt this Chinese Douyin caption into an engaging English Facebook post.
Format:
1. 🌟 Catchy Hook with emojis
2. 📖 Story & Scenic Highlights (descriptive, wanderlust vibe)
3. 📍 Key Location / Travel Tips
4. ✈️ Call to Action (e.g., Save this for your trip / Tag a friend)
5. 🏷️ 6-8 Viral English Hashtags (replace Chinese hashtags with high-volume English travel tags).
Keep it authentic and exciting. Output ONLY the ready-to-publish post.`;
  }

  btnSaveSettings.addEventListener('click', async () => {
    const workerUrl = normalizeWorkerUrl(settingFacebookWorker.value);
    if (workerUrl) {
      try {
        const granted = await chrome.permissions.request({ origins: [`${new URL(workerUrl).origin}/*`] });
        if (!granted) throw new Error('Bạn chưa cấp quyền kết nối đến Cloudflare Worker.');
      } catch (error) {
        saveStatus.innerText = `❌ ${error.message}`;
        return;
      }
    }

    chrome.storage.local.set({
      deepseekApiKey: settingDeepseekKey.value.trim(),
      deepseekModel: settingDeepseekModel.value,
      systemPromptTemplate: settingSystemPrompt.value.trim(),
      facebookWorkerUrl: workerUrl
    }, () => {
      saveStatus.innerText = '✅ Đã lưu cấu hình thành công!';
      setTimeout(() => { saveStatus.innerText = ''; }, 2500);
    });
  });

  // ===== MULTI-FANPAGE MANAGEMENT =====
  btnConnectFacebook.addEventListener('click', async () => {
    setFacebookBusy(true, 'Đang mở Facebook...');
    try {
      const redirectUrl = chrome.identity.getRedirectURL('facebook');
      const session = await facebookApi('/v1/facebook/connect-session', {
        method: 'POST',
        body: JSON.stringify({ redirectUrl })
      });

      await chrome.identity.launchWebAuthFlow({ url: session.authUrl, interactive: true });
      await loadFanpages();
    } catch (error) {
      setFacebookStatus('error', error.message || 'Không thể kết nối Facebook.');
    } finally {
      setFacebookBusy(false);
    }
  });

  btnRefreshFanpages.addEventListener('click', loadFanpages);

  async function loadFanpages() {
    fanpageList.innerHTML = '';
    setFacebookStatus('loading', 'Đang kiểm tra kết nối...');
    try {
      const result = await facebookApi('/v1/pages');
      const pages = result.pages || [];
      fanpageEmpty.classList.toggle('hidden', pages.length > 0);
      setFacebookStatus('connected', `Đã kết nối ${pages.length} Fanpage`);
      pages.forEach(renderFanpage);
    } catch (error) {
      fanpageEmpty.classList.remove('hidden');
      setFacebookStatus('error', error.message);
    }
  }

  function renderFanpage(page) {
    const item = document.createElement('div');
    item.className = `fanpage-item ${page.isDefault ? 'default' : ''}`;
    item.innerHTML = `
      <div class="fanpage-avatar">${page.pictureUrl ? `<img src="${escapeHtml(page.pictureUrl)}" alt="">` : 'f'}</div>
      <div class="fanpage-info">
        <div class="fanpage-name">${escapeHtml(page.name || 'Facebook Page')}</div>
        <div class="fanpage-meta">ID: ${escapeHtml(page.pageId)} · <span class="token-${escapeHtml(page.tokenStatus || 'active')}">${page.tokenStatus === 'active' ? 'Token hợp lệ' : 'Cần kết nối lại'}</span></div>
      </div>
      <div class="fanpage-actions">
        <button class="btn-sm-action set-default-page" ${page.isDefault ? 'disabled' : ''}>${page.isDefault ? '✓ Mặc định' : 'Đặt mặc định'}</button>
        <button class="btn-sm-action text-danger disconnect-page" title="Ngắt kết nối">×</button>
      </div>
    `;

    item.querySelector('.set-default-page').addEventListener('click', async () => {
      await facebookApi(`/v1/pages/${encodeURIComponent(page.pageId)}/default`, { method: 'PUT' });
      await loadFanpages();
    });
    item.querySelector('.disconnect-page').addEventListener('click', async () => {
      if (!confirm(`Ngắt kết nối Fanpage "${page.name}"?`)) return;
      await facebookApi(`/v1/pages/${encodeURIComponent(page.pageId)}`, { method: 'DELETE' });
      await loadFanpages();
    });
    fanpageList.appendChild(item);
  }

  async function facebookApi(path, options = {}) {
    const stored = await chrome.storage.local.get(['facebookWorkerUrl', 'facebookInstallationId', 'facebookInstallationSecret']);
    const workerUrl = normalizeWorkerUrl(stored.facebookWorkerUrl || settingFacebookWorker.value);
    if (!workerUrl) throw new Error('Hãy nhập và lưu Cloudflare Worker URL trong Cài đặt.');

    const origin = `${new URL(workerUrl).origin}/*`;
    if (!await chrome.permissions.contains({ origins: [origin] })) {
      throw new Error('Hãy lưu Cài đặt để cấp quyền truy cập Cloudflare Worker.');
    }

    const installationId = stored.facebookInstallationId || crypto.randomUUID();
    const installationSecret = stored.facebookInstallationSecret || randomSecret();
    if (!stored.facebookInstallationId || !stored.facebookInstallationSecret) {
      await chrome.storage.local.set({ facebookInstallationId: installationId, facebookInstallationSecret: installationSecret });
    }

    await fetch(`${workerUrl}/v1/installations/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installationId, installationSecret })
    }).then(assertApiResponse);

    return fetch(`${workerUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Install ${installationId}.${installationSecret}`,
        ...(options.headers || {})
      }
    }).then(assertApiResponse);
  }

  async function assertApiResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Cloudflare API lỗi ${response.status}`);
    return data;
  }

  function normalizeWorkerUrl(value) {
    const trimmed = (value || '').trim().replace(/\/+$/, '');
    if (!trimmed) return '';
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') throw new Error('Cloudflare Worker URL phải dùng HTTPS.');
    return url.origin + url.pathname.replace(/\/+$/, '');
  }

  function randomSecret() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function setFacebookBusy(busy, text) {
    btnConnectFacebook.disabled = busy;
    if (text) setFacebookStatus('loading', text);
  }

  function setFacebookStatus(type, text) {
    facebookConnectionStatus.className = `connection-status ${type}`;
    facebookConnectionStatus.querySelector('span:last-child').innerText = text;
  }

  // ===== OFFLINE FOLDER =====
  btnChooseOfflineFolder.addEventListener('click', async () => {
    try {
      const handle = await DouyinFiles.chooseDirectory();
      offlineFolderStatus.innerText = `✅ ${handle.name}/Douyin_Offline`;
    } catch (error) {
      if (error.name !== 'AbortError') offlineFolderStatus.innerText = `❌ ${error.message}`;
    }
  });

  btnSyncOfflineFolder.addEventListener('click', async () => {
    btnSyncOfflineFolder.disabled = true;
    offlineFolderStatus.innerText = '⏳ Đang đồng bộ toàn bộ kho...';
    try {
      const summaries = await DouyinDB.getPostsSummary();
      if (!summaries.length) throw new Error('Kho Offline chưa có bài viết.');
      for (let i = 0; i < summaries.length; i++) {
        offlineFolderStatus.innerText = `⏳ Đang đồng bộ bài ${i + 1}/${summaries.length}...`;
        const fullPost = await DouyinDB.getPost(summaries[i].id);
        if (fullPost) {
          await DouyinFiles.savePost(fullPost, { requestPermission: i === 0 });
        }
      }
      const info = await DouyinFiles.getDirectoryInfo();
      offlineFolderStatus.innerText = `✅ Đã đồng bộ ${summaries.length} bài vào ${info.name}/Douyin_Offline`;
    } catch (error) {
      offlineFolderStatus.innerText = `❌ ${error.message}`;
    } finally {
      btnSyncOfflineFolder.disabled = false;
    }
  });

  btnRestoreOfflineFolder.addEventListener('click', async () => {
    btnRestoreOfflineFolder.disabled = true;
    offlineFolderStatus.innerText = '⏳ Đang đọc và khôi phục kho từ thư mục...';
    try {
      // Call the picker immediately from the click gesture after reinstall,
      // because Chrome only permits directory selection during user action.
      if (!DouyinFiles._handle) await DouyinFiles.chooseDirectory();
      const posts = await DouyinFiles.importAll({ requestPermission: true });
      if (!posts.length) throw new Error('Không tìm thấy bài hợp lệ có metadata.json.');

      let restoredImages = 0;
      for (let postIndex = 0; postIndex < posts.length; postIndex++) {
        const post = posts[postIndex];
        offlineFolderStatus.innerText = `⏳ Đang khôi phục bài ${postIndex + 1}/${posts.length}...`;
        for (const image of post.images) {
          const blob = await (await fetch(image.dataUrl)).blob();
          const previewBlob = await convertBlobToCleanJpg(blob, 0.68, 480);
          image.thumbnailDataUrl = await blobToDataUrl(previewBlob);
          restoredImages++;
        }
        post.thumbUrl = post.images[0]?.thumbnailDataUrl || post.images[0]?.dataUrl || '';
        await DouyinDB.savePost(post);
      }

      libraryCount.innerText = String(await DouyinDB.getPostCount());
      const info = await DouyinFiles.getDirectoryInfo();
      offlineFolderStatus.innerText = `✅ Đã khôi phục ${posts.length} bài, ${restoredImages} ảnh từ ${info.name}`;
    } catch (error) {
      if (error.name !== 'AbortError') offlineFolderStatus.innerText = `❌ ${error.message}`;
    } finally {
      btnRestoreOfflineFolder.disabled = false;
    }
  });

  async function refreshOfflineFolderStatus() {
    try {
      const info = await DouyinFiles.getDirectoryInfo();
      if (!info.configured) return;
      offlineFolderStatus.innerText = info.permission === 'granted'
        ? `✅ ${info.name}/Douyin_Offline`
        : `⚠️ ${info.name} — cần cấp lại quyền ghi`;
    } catch (error) {
      offlineFolderStatus.innerText = `❌ ${error.message}`;
    }
  }

  // ===== STATUS BAR =====
  function showStatus(msg) {
    statusText.innerText = msg;
    statusBar.classList.remove('hidden');
  }
  function hideStatus() {
    statusBar.classList.add('hidden');
  }

  // ===== EXTRACT FROM ACTIVE TAB (DOUYIN / VK) =====
  btnGrabActiveTab.addEventListener('click', () => {
    showStatus('Đang quét nội dung từ tab hiện tại...');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const isDouyin = activeTab && activeTab.url && activeTab.url.includes('douyin.com');
      const isVk = activeTab && activeTab.url && (activeTab.url.includes('vk.com') || activeTab.url.includes('vk.ru'));
      const isXhs = activeTab && activeTab.url && (
        activeTab.url.includes('xiaohongshu.com') ||
        activeTab.url.includes('xhslink.com') ||
        activeTab.url.includes('rednote.com')
      );

      if (!activeTab || (!isDouyin && !isVk && !isXhs)) {
        hideStatus();
        alert('Tab hiện tại không phải trang douyin.com, vk.com hoặc xiaohongshu.com / rednote.com.\nHãy mở bài viết trên Douyin, VK hoặc RedNote trước!');
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { type: 'GET_CURRENT_PAGE_MEDIA' }, (res) => {
        hideStatus();
        if (chrome.runtime.lastError) {
          alert('Không thể kết nối với trang. Vui lòng F5 tải lại trang rồi bấm lại.');
          return;
        }
        if (res && res.success) {
          currentMediaData = res;
          chrome.storage.local.set({
            currentExtractedData: res,
            lastExtractedAt: Date.now()
          });
          displayExtractedData(res);
        } else {
          alert(res?.error || 'Không tìm thấy ảnh/video. Hãy mở đúng trang chi tiết bài viết (click vào bài note, ảnh hoặc video).');
        }
      });
    });
  });

  // ===== EXTRACT FROM PASTED LINK =====
  btnParseLink.addEventListener('click', () => {
    const input = douyinInput.value.trim();
    if (!input) {
      alert('Vui lòng dán link bài viết Douyin, VK hoặc RedNote.');
      return;
    }

    const urlMatch = input.match(/https?:\/\/\S+/);
    if (!urlMatch) {
      alert('Không tìm thấy liên kết hợp lệ trong nội dung đã dán.');
      return;
    }

    showStatus('Đang mở bài viết trên tab mới để trích xuất...');
    btnParseLink.disabled = true;

    chrome.tabs.create({ url: urlMatch[0], active: true }, (newTab) => {
      let retries = 0;
      const maxRetries = 10;

      const checkReady = () => {
        retries++;
        if (retries > maxRetries) {
          hideStatus();
          btnParseLink.disabled = false;
          alert('Trang tải quá lâu. Hãy chuyển sang tab vừa mở và bấm "Tab hiện tại".');
          return;
        }

        chrome.tabs.sendMessage(newTab.id, { type: 'GET_CURRENT_PAGE_MEDIA' }, (res) => {
          if (chrome.runtime.lastError || !res || !res.success) {
            setTimeout(checkReady, 2000);
          } else {
            hideStatus();
            btnParseLink.disabled = false;
            currentMediaData = res;
            chrome.storage.local.set({
              currentExtractedData: res,
              lastExtractedAt: Date.now()
            });
            displayExtractedData(res);
          }
        });
      };

      setTimeout(checkReady, 3000);
    });
  });

  // ===== RENDER EXTRACTED DATA =====
  function displayExtractedData(data) {
    reviewArea.classList.remove('hidden');

    // Author & metadata
    const isVk = data.platform === 'vk';
    const isXhs = data.platform === 'rednote' || data.platform === 'xhs';
    const authorPrefix = isVk ? 'Tác giả VK: ' : (isXhs ? 'Tác giả RedNote: ' : 'Kênh: ');
    const defaultAuthor = isVk ? 'Tác giả VK' : (isXhs ? 'Tác giả RedNote' : 'Tác giả Douyin');
    metaAuthorName.innerText = authorPrefix + (data.author || defaultAuthor);
    metaPostTime.innerText = '🕒 Đăng lúc: ' + (data.createTime || 'Hôm nay');
    metaBadgeType.innerText = isVk
      ? (data.type === 'video' ? 'VK Video' : 'VK Ảnh / Post')
      : isXhs
      ? (data.type === 'video' ? 'RedNote Video' : 'RedNote Ảnh / Note')
      : (data.type === 'note' ? '图集 / Note' : 'Video');
    if (data.avatar) {
      metaAuthorAvatar.src = data.avatar;
      metaAuthorAvatar.style.display = 'block';
    } else {
      metaAuthorAvatar.style.display = 'none';
    }

    // Captions
    originalCaptionEl.value = data.desc || data.title || '';
    englishCaptionEl.value = data.englishCaption || '';

    // Image grid
    imageGrid.innerHTML = '';
    selectedImageUrls = [];

    // Auto-clean any stale ci.xiaohongshu.com URLs
    if (data.images && Array.isArray(data.images)) {
      data.images = data.images.map(u => {
        if (typeof u === 'string' && u.includes('ci.xiaohongshu.com')) {
          const match = u.match(/ci\.xiaohongshu\.com\/([a-zA-Z0-9_-]+)/);
          if (match && match[1]) {
            return `https://sns-img-hw.xhscdn.com/${match[1]}`;
          }
        }
        return u;
      });
    }

    logPopup(`Hiển thị bài viết (${data.platform || 'douyin'}), số ảnh: ${data.images?.length || 0}`);

    if (data.images && data.images.length > 0) {
      const liveCount = (data.livePhotos || []).length;
      const liveSuffix = liveCount > 0 ? ` (gồm ${liveCount} ảnh Live 🎬)` : '';
      mediaCountLabel.innerText = `Danh sách ảnh HD (${data.images.length} ảnh${liveSuffix})`;
      videoPreviewWrapper.classList.add('hidden');
      imageGrid.parentElement.classList.remove('hidden');

      selectedImageUrls = [...data.images];

      data.images.forEach((imgUrl, idx) => {
        const item = document.createElement('div');
        item.className = 'image-item selected';

        const img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = `Ảnh ${idx + 1}`;
        img.src = imgUrl;

        let hasRetried = false;
        img.onerror = () => {
          logPopup(`⚠️ Thẻ <img> tải trực tiếp thất bại cho ảnh #${idx + 1}: ${imgUrl}`);
          if (!hasRetried) {
            hasRetried = true;
            logPopup(`Đang gọi Background Service Worker nạp base64 cho ảnh #${idx + 1}...`);
            chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_BASE64', url: imgUrl }, (res) => {
              if (res && res.success && res.base64) {
                logPopup(`✅ Background fetch thành công ảnh #${idx + 1} (${res.size} bytes)`);
                img.src = `data:${res.type || 'image/jpeg'};base64,${res.base64}`;
                img.style.opacity = '1';
                delete img.dataset.error;
                item.title = `Ảnh #${idx + 1} (Đã nạp sạch qua Service Worker)`;
              } else {
                const errReason = res?.error || 'Lỗi tải không xác định';
                logPopup(`❌ Background fetch thất bại ảnh #${idx + 1}: ${errReason}`);
                img.style.opacity = '0.3';
                img.alt = '⚠ Lỗi tải (Click xem log)';
                img.dataset.error = errReason;
                item.title = `Click vào ảnh để xem chi tiết lỗi: ${errReason}`;
                item.style.cursor = 'pointer';
              }
            });
          } else {
            img.style.opacity = '0.3';
            img.alt = '⚠ Lỗi tải (Click xem log)';
          }
        };

        // Click on failed image to inspect details
        item.addEventListener('click', (e) => {
          if (e.target.type === 'checkbox') return;
          if (img.dataset.error) {
            openLogModalWithHighlight(`Chi tiết ảnh #${idx + 1} tải lỗi:\n• URL: ${imgUrl}\n• Lỗi: ${img.dataset.error}`);
          }
        });

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'image-checkbox';
        chk.checked = true;

        const badge = document.createElement('span');
        badge.className = 'image-index';
        badge.innerText = `#${idx + 1}`;

        chk.addEventListener('change', () => {
          if (chk.checked) {
            item.classList.add('selected');
            if (!selectedImageUrls.includes(imgUrl)) selectedImageUrls.push(imgUrl);
          } else {
            item.classList.remove('selected');
            selectedImageUrls = selectedImageUrls.filter(u => u !== imgUrl);
          }
          const curLiveSuffix = liveCount > 0 ? ` (gồm ${liveCount} ảnh Live 🎬)` : '';
          mediaCountLabel.innerText = `Danh sách ảnh HD (Đã chọn ${selectedImageUrls.length}/${data.images.length}${curLiveSuffix})`;
        });

        item.appendChild(img);
        item.appendChild(chk);
        item.appendChild(badge);

        // Check if this image is a Live Photo with motion video clip
        const liveInfo = (data.livePhotos || []).find(lp => lp.imageUrl === imgUrl || lp.index === idx);
        if (liveInfo && liveInfo.videoUrl) {
          const liveBadge = document.createElement('span');
          liveBadge.className = 'live-photo-badge';
          liveBadge.innerHTML = '🎬 LIVE';
          liveBadge.title = 'Ảnh Live Photo. Bấm để tải video chuyển động (.mp4)';
          liveBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            liveBadge.innerText = '⏳ Tải...';
            chrome.runtime.sendMessage({
              type: 'DOWNLOAD_IMAGE',
              url: liveInfo.videoUrl,
              filename: `rednote_live_${idx + 1}.mp4`
            }, (res) => {
              liveBadge.innerHTML = '🎬 LIVE';
              if (res && res.success) {
                showStatus(`🎉 Đang tải video Live Photo #${idx + 1} (.mp4) về máy!`);
              } else {
                alert('Không thể tải video Live Photo: ' + (res?.error || 'Lỗi kết nối'));
              }
            });
          });
          item.appendChild(liveBadge);
        }

        imageGrid.appendChild(item);
      });
    } else if (data.videoUrl) {
      mediaCountLabel.innerText = 'Video không watermark';
      imageGrid.parentElement.classList.add('hidden');
      videoPreviewWrapper.classList.remove('hidden');
      videoPreview.src = data.videoUrl;
    }

    // Auto-trigger translation if API key is set and no English translation yet
    if (!englishCaptionEl.value) {
      chrome.storage.local.get(['deepseekApiKey'], (res) => {
        if (res.deepseekApiKey && originalCaptionEl.value) {
          btnDeepseekTranslate.click();
        }
      });
    }
  }

  // ===== SELECT / DESELECT ALL =====
  btnSelectAll.addEventListener('click', () => {
    document.querySelectorAll('.image-checkbox').forEach(c => {
      c.checked = true;
      c.closest('.image-item').classList.add('selected');
    });
    if (currentMediaData && currentMediaData.images) {
      selectedImageUrls = [...currentMediaData.images];
      mediaCountLabel.innerText = `Danh sách ảnh HD (${selectedImageUrls.length} ảnh)`;
    }
  });

  btnDeselectAll.addEventListener('click', () => {
    document.querySelectorAll('.image-checkbox').forEach(c => {
      c.checked = false;
      c.closest('.image-item').classList.remove('selected');
    });
    selectedImageUrls = [];
    mediaCountLabel.innerText = `Danh sách ảnh HD (Đã chọn 0)`;
  });

  // ===== DEEPSEEK TRANSLATION =====
  btnDeepseekTranslate.addEventListener('click', () => {
    const rawText = originalCaptionEl.value.trim();
    if (!rawText) { alert('Chưa có caption để dịch.'); return; }

    chrome.storage.local.get(['deepseekApiKey', 'deepseekModel', 'systemPromptTemplate'], (settings) => {
      if (!settings.deepseekApiKey) {
        alert('Vui lòng cấu hình DeepSeek API Key ở tab "Cài đặt API" trước!');
        switchTab('tab-settings');
        return;
      }

      showStatus('✨ DeepSeek AI đang sáng tạo bài đăng tiếng Anh...');
      btnDeepseekTranslate.disabled = true;

      chrome.runtime.sendMessage({
        type: 'CALL_DEEPSEEK_TRANSLATION',
        payload: {
          apiKey: settings.deepseekApiKey,
          model: settings.deepseekModel || 'deepseek-chat',
          systemPrompt: settings.systemPromptTemplate || getDefaultPrompt(),
          originalText: rawText
        }
      }, (res) => {
        btnDeepseekTranslate.disabled = false;
        hideStatus();

        if (res && res.success && res.translation) {
          englishCaptionEl.value = res.translation;
          if (currentMediaData) {
            currentMediaData.englishCaption = res.translation;
            chrome.storage.local.set({ currentExtractedData: currentMediaData });
          }
        } else {
          alert('Lỗi DeepSeek: ' + (res?.error || 'Không nhận được kết quả dịch.'));
        }
      });
    });
  });

  // ===== COPY BUTTONS =====
  btnCopyOriginal.addEventListener('click', () => {
    navigator.clipboard.writeText(originalCaptionEl.value);
    btnCopyOriginal.innerText = '✅ Đã copy!';
    setTimeout(() => { btnCopyOriginal.innerText = 'Copy'; }, 1500);
  });

  btnCopyEnglish.addEventListener('click', () => {
    navigator.clipboard.writeText(englishCaptionEl.value);
    btnCopyEnglish.innerText = '✅ Đã copy!';
    setTimeout(() => { btnCopyEnglish.innerText = 'Copy'; }, 1500);
  });

  // ===== HELPER: CONVERT BLOB TO CLEAN JPG VIA CANVAS =====
  // Strips all EXIF, tracking headers & Douyin watermark metadata
  function convertBlobToCleanJpg(blob, quality = 0.92, maxDimension = null) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const canvas = document.createElement('canvas');
          const sourceWidth = img.naturalWidth || img.width;
          const sourceHeight = img.naturalHeight || img.height;
          const scale = maxDimension ? Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight)) : 1;
          canvas.width = Math.max(1, Math.round(sourceWidth * scale));
          canvas.height = Math.max(1, Math.round(sourceHeight * scale));
          const ctx = canvas.getContext('2d', { alpha: false });
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((jpgBlob) => {
            canvas.width = 0;
            canvas.height = 0;
            img.src = '';
            if (jpgBlob) resolve(jpgBlob);
            else reject(new Error('Lỗi xuất canvas sang JPG'));
          }, 'image/jpeg', quality);
        } catch (err) {
          img.src = '';
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        img.src = '';
        reject(new Error('Lỗi nạp ảnh vào canvas'));
      };
      img.src = url;
    });
  }

  function base64ToBlob(base64, type = 'image/jpeg') {
    const binary = atob(base64);
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return new Blob([buffer], { type: type });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ===== CORE FUNCTION: CONVERT ALL IMAGES TO CLEAN JPG & SAVE TO INDEXEDDB =====
  async function processAndSavePost() {
    if (!currentMediaData) {
      throw new Error('Chưa có dữ liệu bài viết.');
    }
    if (currentMediaData.type === 'note' && selectedImageUrls.length === 0) {
      throw new Error('Vui lòng chọn ít nhất 1 ảnh.');
    }

    const postId = currentMediaData.itemId || String(Date.now());
    const cleanImages = [];

    // 1. Process selected images
    for (let i = 0; i < selectedImageUrls.length; i++) {
      const url = selectedImageUrls[i];
      showStatus(`Đang chuyển đổi ảnh ${i + 1}/${selectedImageUrls.length} sang JPG sạch...`);

      const res = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_BASE64', url: url }, (r) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else if (r && r.success) resolve(r);
          else reject(new Error(r?.error || 'Lỗi tải ảnh'));
        });
      });

      let rawBlob = base64ToBlob(res.base64, res.type);
      res.base64 = null; // free IPC string memory immediately

      const cleanJpgBlob = await convertBlobToCleanJpg(rawBlob, 0.92);
      rawBlob = null; // free rawBlob memory

      const cleanDataUrl = await blobToDataUrl(cleanJpgBlob);
      const thumbnailBlob = await convertBlobToCleanJpg(cleanJpgBlob, 0.68, 480);
      const thumbnailDataUrl = await blobToDataUrl(thumbnailBlob);

      cleanImages.push({
        filename: `photo_${String(i + 1).padStart(2, '0')}.jpg`,
        dataUrl: cleanDataUrl,
        thumbnailDataUrl: thumbnailDataUrl,
        tags: []
      });

      // Brief delay to allow garbage collection to run
      await new Promise(resolve => setTimeout(resolve, 25));
    }

    // 2. Process avatar if present
    let avatarDataUrl = '';
    if (currentMediaData.avatar) {
      try {
        const avatarRes = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_BASE64', url: currentMediaData.avatar }, (r) => {
            if (r && r.success) resolve(r);
            else reject(new Error('Avatar error'));
          });
        });
        const rawAvatarBlob = base64ToBlob(avatarRes.base64, avatarRes.type);
        const cleanAvatarBlob = await convertBlobToCleanJpg(rawAvatarBlob, 0.8, 512);
        avatarDataUrl = await blobToDataUrl(cleanAvatarBlob);
      } catch (e) {
        console.warn('Không tải được avatar:', e);
      }
    }

    // 3. Construct post object
    const postRecord = {
      id: postId,
      author: currentMediaData.author || 'Tác giả Douyin',
      authorId: currentMediaData.authorId || '',
      avatar: avatarDataUrl || currentMediaData.avatar || '',
      createTime: currentMediaData.createTime || 'Không xác định',
      createTimestamp: currentMediaData.createTimestamp || 0,
      desc: originalCaptionEl.value || currentMediaData.desc || '',
      notes: '',
      englishCaption: englishCaptionEl.value || currentMediaData.englishCaption || '',
      sourceUrl: currentMediaData.url || '',
      images: cleanImages,
      thumbUrl: cleanImages.length > 0 ? cleanImages[0].thumbnailDataUrl : '',
      status: 'pending',
      imageProcessed: false,
      savedAt: Date.now()
    };

    // 4. Save to IndexedDB
    showStatus('Đang lưu vào kho Offline...');
    await DouyinDB.savePost(postRecord);

    // If a folder is already authorized, mirror the post to disk without
    // interrupting the normal IndexedDB save flow.
    try {
      const directory = await DouyinFiles.getDirectoryHandle(false);
      if (directory) await DouyinFiles.savePost(postRecord);
    } catch (error) {
      console.warn('Không thể tự lưu bài vào thư mục Offline:', error);
    }

    libraryCount.innerText = await DouyinDB.getPostCount();

    return postRecord;
  }

  // ===== ACTION 1: SAVE & OPEN OFFLINE TAB DIRECTLY (BACKGROUND PROCESSING - TAB SAFE) =====
  btnSaveAndView.addEventListener('click', async () => {
    if (!currentMediaData) {
      alert('Chưa có dữ liệu bài viết.');
      return;
    }
    if (currentMediaData.type === 'note' && selectedImageUrls.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ảnh.');
      return;
    }

    btnSaveAndView.disabled = true;
    showStatus('🚀 Đang tải ảnh ở chế độ nền... Bạn có thể chuyển tab thoải mái mà không bị dừng!');

    chrome.runtime.sendMessage({
      type: 'START_BACKGROUND_SAVE_POST',
      payload: {
        mediaData: currentMediaData,
        selectedUrls: selectedImageUrls,
        desc: originalCaptionEl.value || currentMediaData.desc || '',
        englishCaption: englishCaptionEl.value || currentMediaData.englishCaption || '',
        openViewer: true
      }
    }, (res) => {
      btnSaveAndView.disabled = false;
      if (chrome.runtime.lastError) {
        console.warn('Lỗi background download, chuyển sang lưu trực tiếp:', chrome.runtime.lastError);
        processAndSavePost().then(saved => {
          hideStatus();
          chrome.tabs.create({ url: chrome.runtime.getURL(`viewer/viewer.html?id=${saved.id}`) });
        }).catch(err => {
          hideStatus();
          alert('Lỗi: ' + err.message);
        });
      } else if (res && res.success) {
        hideStatus();
        const saved = res.postRecord;
        if (saved && saved.id) {
          chrome.tabs.create({ url: chrome.runtime.getURL(`viewer/viewer.html?id=${saved.id}`) });
        }
      } else if (res && !res.success) {
        hideStatus();
        alert('Lỗi tải ảnh: ' + (res.error || 'Không xác định'));
      }
    });
  });

  // ===== ACTION 2: BACKUP ZIP DOWNLOAD (OPTIONAL) =====
  btnSaveOfflinePackage.addEventListener('click', async () => {
    if (!currentMediaData) {
      alert('Chưa có dữ liệu bài viết.');
      return;
    }
    btnSaveOfflinePackage.disabled = true;
    showStatus('Đang chuẩn bị gói ZIP tải về máy...');

    try {
      let saved = null;
      const existingId = currentMediaData.itemId || currentMediaData.id;
      if (existingId) {
        saved = await DouyinDB.getPost(existingId);
      }
      if (!saved || !saved.images || saved.images.length === 0) {
        showStatus('Đang nạp ảnh ở chế độ nền...');
        const res = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            type: 'START_BACKGROUND_SAVE_POST',
            payload: {
              mediaData: currentMediaData,
              selectedUrls: selectedImageUrls,
              desc: originalCaptionEl.value || currentMediaData.desc || '',
              englishCaption: englishCaptionEl.value || currentMediaData.englishCaption || '',
              openViewer: false
            }
          }, (r) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (r && r.success) resolve(r.postRecord);
            else reject(new Error(r?.error || 'Lỗi tải ảnh'));
          });
        });
        saved = res;
      }

      showStatus('Đang nén file ZIP...');
      const zip = new JSZip();
      const imgFolder = zip.folder('images');
      for (const item of (saved.images || [])) {
        if (item.dataUrl) {
          const base64Data = item.dataUrl.split(',')[1];
          imgFolder.file(item.filename, base64Data, { base64: true });
        }
      }

      const txt = [
        '========================================',
        '  FACEBOOK POST (ENGLISH)',
        '========================================',
        '',
        saved.englishCaption || '',
        '',
        '',
        '========================================',
        '  ORIGINAL CHINESE CAPTION',
        '========================================',
        '',
        saved.desc || '',
        '',
        `Kênh: ${saved.author}`,
        `Thời gian: ${saved.createTime}`,
        `Nguồn: ${saved.sourceUrl}`
      ].join('\n');
      zip.file('caption.txt', txt);

      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      const safeTitle = (saved.desc || 'douyin_post').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').slice(0, 30);
      a.download = `[Offline]_${safeTitle}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);

      hideStatus();
      btnSaveOfflinePackage.disabled = false;
      alert('✅ Đã tải file ZIP về máy thành công!');
    } catch (e) {
      hideStatus();
      btnSaveOfflinePackage.disabled = false;
      alert('Lỗi: ' + e.message);
    }
  });

  // ===== OFFLINE LIBRARY FUNCTIONS =====
  async function loadLibrary() {
    try {
      libraryCount.innerText = await DouyinDB.getPostCount();
      const posts = await DouyinDB.getPostsSummary();
      libraryList.innerHTML = '';

      if (posts.length === 0) {
        libraryEmpty.classList.remove('hidden');
        return;
      }

      libraryEmpty.classList.add('hidden');

      posts.forEach((post) => {
        const item = document.createElement('div');
        item.className = 'library-item';

        const thumbUrl = (post.images && post.images.length > 0 && (post.images[0].thumbnailDataUrl || post.images[0].dataUrl)) ||
                         post.thumbUrl || post.avatar || '../icons/icon48.png';

        item.innerHTML = `
          <img class="library-thumb" src="${thumbUrl}" alt="Thumbnail" />
          <div class="library-info">
            <div class="library-title" title="${escapeHtml(post.desc || '')}">${escapeHtml(post.desc || '(Không có tiêu đề)')}</div>
            <div class="library-meta">@${escapeHtml(post.author || 'Tác giả')} • 🕒 ${post.createTime || ''} • ${(post.images || []).length} ảnh</div>
            <div class="library-actions">
              <button class="btn-sm-action btn-open-item">🖥️ Mở xem</button>
              <button class="btn-sm-action text-danger btn-del-item">🗑️ Xóa</button>
            </div>
          </div>
        `;

        item.querySelector('.btn-open-item').addEventListener('click', () => {
          chrome.tabs.create({ url: chrome.runtime.getURL(`viewer/viewer.html?id=${post.id}`) });
        });

        item.querySelector('.btn-del-item').addEventListener('click', async () => {
          await DouyinDB.deletePost(post.id);
          loadLibrary();
        });

        libraryList.appendChild(item);
      });
    } catch (err) {
      console.error(err);
    }
  }

  btnClearLibrary.addEventListener('click', async () => {
    if (confirm('Bạn có chắc chắn muốn xóa tất cả các bài viết trong kho offline không?')) {
      await DouyinDB.clearAll();
      loadLibrary();
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  // Listen for background download progress & completion across tab switches
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'BACKGROUND_DOWNLOAD_PROGRESS') {
      const info = request.payload;
      showStatus(`⏳ Đang tải ảnh ${info.current}/${info.total} ở chế độ nền (chuyển tab vẫn tải)...`);
    } else if (request.type === 'BACKGROUND_DOWNLOAD_COMPLETE') {
      const post = request.payload?.postRecord;
      showStatus(`✅ Đã tải xong ${post?.images?.length || 0} ảnh và lưu vào kho Offline!`);
      btnSaveAndView.disabled = false;
      loadLibrary();
    }
  });

  // Restore current background download status if user switches back to popup
  chrome.storage.local.get(['backgroundDownload'], (res) => {
    const bg = res.backgroundDownload;
    const now = Date.now();
    const isStale = bg?.startedAt && (now - bg.startedAt > 90000);
    if (bg && bg.active && !isStale) {
      showStatus(`⏳ Đang tải ảnh ${bg.current || 0}/${bg.total || 0} ở chế độ nền... Bạn có thể chuyển tab thoải mái!`);
      btnSaveAndView.disabled = true;
    } else {
      if (bg && bg.active && isStale) {
        chrome.storage.local.set({ backgroundDownload: { active: false } });
      }
      btnSaveAndView.disabled = false;
    }
  });

  // Diagnostic Log Viewer Modal Handlers
  async function openLogModalWithHighlight(extraMsg = '') {
    if (!modalLogViewer) return;
    modalLogViewer.style.display = 'flex';
    modalLogViewer.classList.remove('hidden');

    let bgLogsText = '--- Đang lấy log từ Background Service Worker... ---';
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_DIAGNOSTIC_LOGS' }, (r) => resolve(r));
      });
      if (res && res.success && Array.isArray(res.logs) && res.logs.length > 0) {
        bgLogsText = res.logs.map(l => `[${l.time}][${l.tag}] ${l.message}`).join('\n');
      } else {
        bgLogsText = 'Chưa có nhật ký từ Background Service Worker (hoặc Worker vừa khởi động lại).';
      }
    } catch (e) {
      bgLogsText = 'Lỗi kết nối Background Service Worker: ' + e.message;
    }

    const popupLogsText = (window.__POPUP_LOGS__ || []).join('\n');
    let fullText = '';
    if (extraMsg) {
      fullText += `=== ⚠️ THÔNG TIN LỖI ẢNH ===\n${extraMsg}\n\n`;
    }
    fullText += `=== 📱 NHẬT KÝ POPUP ===\n${popupLogsText || 'Chưa có log từ Popup'}\n\n`;
    fullText += `=== ⚙️ NHẬT KÝ SERVICE WORKER ===\n${bgLogsText}`;

    if (logViewerContent) {
      logViewerContent.value = fullText;
      logViewerContent.scrollTop = 0;
    }
  }

  if (btnViewLogs) {
    btnViewLogs.addEventListener('click', () => openLogModalWithHighlight());
  }

  if (btnCloseLogModal) {
    btnCloseLogModal.addEventListener('click', () => {
      modalLogViewer.style.display = 'none';
      modalLogViewer.classList.add('hidden');
    });
  }

  if (modalLogViewer) {
    modalLogViewer.addEventListener('click', (e) => {
      if (e.target === modalLogViewer) {
        modalLogViewer.style.display = 'none';
        modalLogViewer.classList.add('hidden');
      }
    });
  }

  if (btnCopyDebugLogs) {
    btnCopyDebugLogs.addEventListener('click', () => {
      if (logViewerContent) {
        navigator.clipboard.writeText(logViewerContent.value).then(() => {
          btnCopyDebugLogs.innerText = '✅ Đã copy!';
          setTimeout(() => { btnCopyDebugLogs.innerText = '📋 Sao chép Log'; }, 2000);
        });
      }
    });
  }

  if (btnClearDebugLogs) {
    btnClearDebugLogs.addEventListener('click', () => {
      window.__POPUP_LOGS__ = [];
      chrome.runtime.sendMessage({ type: 'CLEAR_DIAGNOSTIC_LOGS' }, () => {
        if (logViewerContent) logViewerContent.value = 'Đã xóa toàn bộ nhật ký.';
      });
    });
  }
});
