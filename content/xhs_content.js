// Content Script injected into xiaohongshu.com, rednote.com, and xhslink.com
// Responsible for: injecting MAIN world extractor, creating floating action button,
// DOM fallback extraction, and communicating with background / popup
(function () {
  'use strict';

  // ===== 1. Inject MAIN world script to access window.__INITIAL_STATE__ =====
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('content/xhs_inject.js');
    s.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn('[RedNote→FB] Error injecting MAIN script:', e);
  }

  // ===== 2. Floating Action Button for RedNote =====
  function createXhsFloatingBtn() {
    if (document.getElementById('xhs-to-fb-floating-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'xhs-to-fb-floating-btn';
    btn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 28px;
      z-index: 999999;
      background: linear-gradient(135deg, #ff2442 0%, #ff4761 100%);
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 30px;
      box-shadow: 0 8px 24px rgba(255, 36, 66, 0.45);
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
      <span>Lấy bài RedNote sang FB</span>
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-3px) scale(1.03)';
      btn.style.boxShadow = '0 12px 28px rgba(255, 36, 66, 0.65)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'none';
      btn.style.boxShadow = '0 8px 24px rgba(255, 36, 66, 0.45)';
    });

    btn.addEventListener('click', async () => {
      const originalHTML = btn.innerHTML;
      btn.style.opacity = '0.7';
      btn.innerHTML = '<span>⏳ Đang quét ảnh RedNote...</span>';

      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => {});

      try {
        const data = await extractXhsData();
        if (data && data.success && (data.images.length > 0 || data.videoUrl)) {
          chrome.storage.local.set({
            currentExtractedData: data,
            lastExtractedAt: Date.now()
          }, () => {
            const countStr = data.images.length > 0 ? `${data.images.length} ảnh HD` : '1 video';
            showToast(`✅ Đã trích xuất ${countStr} từ RedNote! Dữ liệu đã hiện trong sidebar.`);
          });
        } else {
          showToast(data?.error || '❌ Không tìm thấy ảnh. Hãy mở một bài viết hoặc ảnh trên RedNote.');
        }
      } catch (err) {
        showToast('❌ Lỗi trích xuất RedNote: ' + err.message);
      } finally {
        setTimeout(() => {
          btn.style.opacity = '1';
          btn.innerHTML = originalHTML;
        }, 1200);
      }
    });

    document.body.appendChild(btn);
  }

  // ===== 3. Toast notification =====
  function showToast(message) {
    let toast = document.getElementById('xhs-fb-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'xhs-fb-toast';
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

  // ===== 4. Listen for request from Main World (xhs_inject.js) =====
  function requestMainWorldData() {
    return new Promise((resolve) => {
      const handler = (event) => {
        if (!event.data || event.data.type !== 'RES_EXTRACT_XHS') return;
        window.removeEventListener('message', handler);
        clearTimeout(timer);
        resolve(event.data.payload);
      };
      window.addEventListener('message', handler);

      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 1500);

      window.postMessage({ type: 'REQ_EXTRACT_XHS' }, '*');
    });
  }

  // ===== 5. Helper: Clean up image URL from DOM =====
  function cleanDomImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let u = rawUrl.trim();
    if (u.startsWith('//')) u = 'https:' + u;
    if (!u.startsWith('http')) return '';
    u = u.replace(/^http:/, 'https:');

    // Filter out thumbnails, icons, avatars, emojis
    if (u.includes('avatar') || u.includes('icon') || u.includes('emoji') || u.includes('data:image')) {
      return '';
    }

    return u;
  }

  // ===== 6. Fallback extraction from DOM =====
  function extractFromDom() {
    // Find active note container or modal
    const noteContainer = document.querySelector('.note-container') ||
                          document.querySelector('[class*="note-container"]') ||
                          document.querySelector('.note-detail-mask') ||
                          document.querySelector('[role="dialog"]') ||
                          document.querySelector('.interaction-container')?.parentElement ||
                          document;

    const imgEls = noteContainer.querySelectorAll('img[src*="xhscdn"], img[src*="xiaohongshu"], .swiper-slide img');
    const images = [];

    for (const img of imgEls) {
      const src = img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src') || '';
      const clean = cleanDomImageUrl(src);
      if (clean && !images.includes(clean)) {
        images.push(clean);
      }
    }

    if (images.length === 0) {
      return {
        success: false,
        platform: 'rednote',
        error: 'Không tìm thấy ảnh trên trang RedNote hiện tại. Hãy mở một bài viết hoặc ảnh chi tiết.'
      };
    }

    // Extract Title & Description
    const titleEl = noteContainer.querySelector('#detail-title, .title, [class*="title"]');
    const descEl = noteContainer.querySelector('#detail-desc, .desc, [class*="desc"], .note-text, .note-content');
    const title = titleEl ? titleEl.innerText.trim() : '';
    const desc = descEl ? descEl.innerText.trim() : title;

    // Extract Author & Avatar
    const authorEl = noteContainer.querySelector('.author-wrapper .name, a.name, .username, [class*="author"] [class*="name"]');
    const avatarEl = noteContainer.querySelector('.author-wrapper img, img.avatar, [class*="author"] img');
    const author = authorEl ? authorEl.innerText.trim() : 'Tác giả RedNote';
    const avatar = avatarEl ? (avatarEl.currentSrc || avatarEl.src) : '';

    // Extract Date
    const dateEl = noteContainer.querySelector('.date, [class*="date"], .bottom-container .date');
    const dateText = dateEl ? dateEl.innerText.trim() : 'Gần đây';

    // Extract hashtags
    const hashtags = [];
    const tagsFromText = (desc + ' ' + title).match(/#[^\s#]+/g) || [];
    tagsFromText.forEach(t => {
      if (!hashtags.includes(t.trim())) hashtags.push(t.trim());
    });

    // Detect ID from URL
    const idMatch = window.location.href.match(/(?:explore|discovery\/item|search_result)\/([a-zA-Z0-9_-]{15,45})/i);
    const itemId = idMatch ? idMatch[1] : ('xhs_' + Date.now());

    return {
      success: true,
      platform: 'rednote',
      type: 'note',
      title: title || (desc.slice(0, 80) + '...'),
      desc: desc,
      images: images,
      videoUrl: '',
      author: author,
      avatar: avatar,
      itemId: itemId,
      url: window.location.href,
      createTime: dateText,
      hashtags: hashtags
    };
  }

  // ===== 7. Master Extractor =====
  async function extractXhsData() {
    // Priority 1: Main World extraction (reads window.__INITIAL_STATE__ & cached requests)
    try {
      const mainData = await requestMainWorldData();
      if (mainData && mainData.success && (mainData.images.length > 0 || mainData.videoUrl)) {
        return mainData;
      }
    } catch (e) {
      console.warn('[RedNote] Main world extraction warning:', e);
    }

    // Priority 2: DOM-based extraction fallback
    return extractFromDom();
  }

  // ===== 8. Listen for messages from Popup / Background =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'BACKGROUND_DOWNLOAD_PROGRESS') {
      const info = request.payload;
      showToast(`⏳ Đang tải ảnh RedNote ${info.current}/${info.total} ở chế độ nền... Bạn chuyển tab thoải mái!`);
      return;
    }

    if (request.type === 'BACKGROUND_DOWNLOAD_COMPLETE') {
      const post = request.payload?.postRecord;
      showToast(`🎉 Đã tải xong ${post?.images?.length || 0} ảnh RedNote vào kho Offline!`);
      return;
    }

    if (request.type === 'GET_CURRENT_PAGE_MEDIA') {
      extractXhsData()
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, platform: 'rednote', error: err.message }));
      return true; // Keep port open for async response
    }
  });

  // ===== 9. Init floating button =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createXhsFloatingBtn);
  } else {
    createXhsFloatingBtn();
  }

  // Re-create button on SPA navigation
  const observer = new MutationObserver(() => {
    if (!document.getElementById('xhs-to-fb-floating-btn')) {
      createXhsFloatingBtn();
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });
})();
