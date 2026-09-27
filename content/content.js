// Content Script injected into douyin.com
// Responsible for: injecting MAIN world extractor, creating floating button,
// mediating between inject_main.js ↔ popup/background
(function () {
  'use strict';

  // ===== Inject MAIN world script (to access window._ROUTER_DATA) =====
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('content/inject_main.js');
    s.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.error('[Douyin→FB] Error injecting script:', e);
  }

  // ===== Floating Action Button =====
  function createFloatingBtn() {
    if (document.getElementById('dy-to-fb-floating-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'dy-to-fb-floating-btn';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
      <span>Lấy bài sang FB</span>
    `;

    btn.addEventListener('click', () => {
      const originalHTML = btn.innerHTML;
      btn.style.opacity = '0.6';
      btn.innerHTML = '<span>⏳ Đang trích xuất...</span>';

      window.postMessage({ type: 'REQ_EXTRACT_DOUYIN' }, '*');

      // Auto-restore button after 5s timeout
      setTimeout(() => {
        btn.style.opacity = '1';
        btn.innerHTML = originalHTML;
      }, 5000);
    });

    document.body.appendChild(btn);
  }

  // ===== Listen for response from inject_main.js =====
  let pendingResolve = null;

  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'RES_EXTRACT_DOUYIN') return;

    const data = event.data.payload;
    const btn = document.getElementById('dy-to-fb-floating-btn');

    // Restore floating button
    if (btn) {
      btn.style.opacity = '1';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        <span>Lấy bài sang FB</span>
      `;
    }

    // If there's a pending promise from popup, resolve it
    if (pendingResolve) {
      pendingResolve(data);
      pendingResolve = null;
      return;
    }

    // Otherwise this was triggered by the floating button
    if (data && data.success) {
      chrome.storage.local.set({
        currentExtractedData: data,
        lastExtractedAt: Date.now()
      }, () => {
        const mediaCount = data.images.length > 0
          ? `${data.images.length} ảnh HD`
          : (data.videoUrl ? '1 video' : 'dữ liệu');
        showToast(`✅ Đã trích xuất ${mediaCount}! Bấm vào icon Extension để xem & dịch.`);
      });
    } else {
      showToast('❌ Không tìm thấy dữ liệu. Hãy mở trang chi tiết bài viết Douyin.');
    }
  });

  // ===== Listen for requests from popup / background =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_CURRENT_PAGE_MEDIA') {
      // Request data from inject_main.js via postMessage
      window.postMessage({ type: 'REQ_EXTRACT_DOUYIN' }, '*');

      pendingResolve = (data) => {
        sendResponse(data);
      };

      // Timeout fallback
      setTimeout(() => {
        if (pendingResolve) {
          pendingResolve({ success: false, error: 'Timeout - inject script không phản hồi' });
          pendingResolve = null;
        }
      }, 8000);

      return true; // Keep message port open for async
    }
  });

  // ===== Toast notification =====
  function showToast(message) {
    let toast = document.getElementById('dy-fb-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dy-fb-toast';
      toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999999;
        background: rgba(15,17,26,0.92); backdrop-filter: blur(12px);
        color: #f3f4f6; padding: 14px 20px; border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px; line-height: 1.4;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.1);
        transform: translateX(120%); transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
        max-width: 380px;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.transform = 'translateX(0)';

    setTimeout(() => {
      toast.style.transform = 'translateX(120%)';
    }, 4000);
  }

  // ===== Init =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingBtn);
  } else {
    createFloatingBtn();
  }

  // Re-create button on SPA navigation
  const observer = new MutationObserver(() => {
    if (!document.getElementById('dy-to-fb-floating-btn')) {
      createFloatingBtn();
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });
})();
