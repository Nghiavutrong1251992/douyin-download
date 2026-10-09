// Content Script injected into vk.com and vk.ru
// Responsible for: injecting MAIN world VK extractor, creating floating button,
// extracting ALL HD images & captions from VK photo viewer and wall posts
(function () {
  'use strict';

  // ===== 1. Inject MAIN world script to access window.cur =====
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('content/vk_inject.js');
    s.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn('[Douyin→FB / VK] Error injecting script:', e);
  }

  // ===== 2. Floating Action Button for VK =====
  function createVkFloatingBtn() {
    if (document.getElementById('vk-to-fb-floating-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'vk-to-fb-floating-btn';
    btn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 28px;
      z-index: 999999;
      background: linear-gradient(135deg, #0077ff 0%, #0056cc 100%);
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 30px;
      box-shadow: 0 8px 24px rgba(0, 119, 255, 0.45);
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
      <span>Lấy bài VK sang FB</span>
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-3px) scale(1.03)';
      btn.style.boxShadow = '0 12px 28px rgba(0, 119, 255, 0.6)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'none';
      btn.style.boxShadow = '0 8px 24px rgba(0, 119, 255, 0.45)';
    });

    btn.addEventListener('click', async () => {
      const originalHTML = btn.innerHTML;
      btn.style.opacity = '0.7';
      btn.innerHTML = '<span>⏳ Đang quét tất cả ảnh VK...</span>';

      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => {});

      try {
        const data = await extractVkData();
        if (data && data.success && data.images.length > 0) {
          chrome.storage.local.set({
            currentExtractedData: data,
            lastExtractedAt: Date.now()
          }, () => {
            showToast(`✅ Đã trích xuất ${data.images.length} ảnh HD từ bài đăng VK! Dữ liệu đã hiện trong sidebar.`);
          });
        } else {
          showToast(data?.error || '❌ Không tìm thấy ảnh. Hãy mở ảnh hoặc bài viết trên VK.');
        }
      } catch (err) {
        showToast('❌ Lỗi trích xuất VK: ' + err.message);
      } finally {
        setTimeout(() => {
          btn.style.opacity = '1';
          btn.innerHTML = originalHTML;
        }, 1500);
      }
    });

    document.body.appendChild(btn);
  }

  // ===== 3. Toast notification =====
  function showToast(message) {
    let toast = document.getElementById('vk-fb-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'vk-fb-toast';
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

  // ===== 4. Listen for request from Main World (vk_inject.js) =====
  function requestMainWorldData() {
    return new Promise((resolve) => {
      const handler = (event) => {
        if (!event.data || event.data.type !== 'RES_EXTRACT_VK') return;
        window.removeEventListener('message', handler);
        clearTimeout(timer);
        resolve(event.data.payload);
      };
      window.addEventListener('message', handler);

      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(null);
      }, 1000);

      window.postMessage({ type: 'REQ_EXTRACT_VK' }, '*');
    });
  }

  // ===== 5. Helper: parse High-Res URL from a single VK photo object =====
  function getBestVkPhotoUrl(photoObj) {
    if (!photoObj || typeof photoObj !== 'object') return '';

    // Original base photo
    if (photoObj.orig_photo && photoObj.orig_photo.url) {
      return photoObj.orig_photo.url;
    }

    // Direct attributes
    if (photoObj.w_src) return photoObj.w_src;
    if (photoObj.z_src) return photoObj.z_src;
    if (photoObj.y_src) return photoObj.y_src;
    if (photoObj.x_src) return photoObj.x_src;

    // sizes array: prioritize base, w, z, y, x
    if (Array.isArray(photoObj.sizes) && photoObj.sizes.length > 0) {
      const priority = ['base', 'w', 'z', 'y', 'x', 'm', 's'];
      for (const p of priority) {
        const found = photoObj.sizes.find(s => s && (s.type === p || s[0] === p));
        if (found) {
          const u = found.url || found.src || found[1];
          if (u) return u;
        }
      }

      // Maximum pixel area
      let maxArea = 0;
      let bestUrl = '';
      for (const s of photoObj.sizes) {
        if (!s) continue;
        const w = s.width || s.w || s[2] || 0;
        const h = s.height || s.h || s[3] || 0;
        const area = w * h;
        const u = s.url || s.src || s[1];
        if (area > maxArea && u) {
          maxArea = area;
          bestUrl = u;
        }
      }
      if (bestUrl) return bestUrl;

      const last = photoObj.sizes[photoObj.sizes.length - 1];
      if (last && (last.url || last.src)) return last.url || last.src;
    }

    return photoObj.url || photoObj.src || '';
  }

  // ===== 6. Helper: parse data-exec JSON (VK PostContentContainer) =====
  function extractFromDataExecString(dataExecStr) {
    try {
      const jsonStr = dataExecStr.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      const data = JSON.parse(jsonStr);
      const init = data['PostContentContainer/init'] || Object.values(data)[0] || {};
      const item = init.item || init.post || {};
      const attachments = item.attachments || [];
      const photos = [];

      for (const att of attachments) {
        if (att && att.type === 'photo' && att.photo) {
          const url = getBestVkPhotoUrl(att.photo);
          if (url && !photos.includes(url)) photos.push(url);
        }
      }

      let caption = item.text || '';
      let author = '';
      let avatar = '';

      if (Array.isArray(init.profiles) && init.profiles.length > 0) {
        const p = init.profiles[0];
        author = `${p.first_name_nom || ''} ${p.last_name_nom || ''}`.trim() || p.screen_name || '';
        avatar = p.photo_200 || p.photo_100 || p.photo_50 || '';
      } else if (Array.isArray(init.groups) && init.groups.length > 0) {
        const g = init.groups[0];
        author = g.name || '';
        avatar = g.photo_200 || g.photo_100 || g.photo_50 || '';
      }

      return {
        success: photos.length > 0,
        photos,
        caption,
        author,
        avatar,
        date: item.date ? String(item.date) : ''
      };
    } catch (e) {
      return null;
    }
  }

  // ===== 7. Helper: parse High-Res URLs from VK onclick / styles =====
  function extractUrlsFromVkElement(el) {
    const urls = [];
    if (!el) return urls;

    // Check onclick attribute (VK passes temp object with high-res sizes in showPhoto)
    const onclickStr = el.getAttribute('onclick') || '';
    if (onclickStr) {
      const srcMatches = onclickStr.matchAll(/(?:w_src|z_src|y_src|x_src)\s*:\s*["']([^"']+)["']/g);
      for (const m of srcMatches) {
        if (m[1] && m[1].startsWith('http')) urls.push(m[1].replace(/\\/g, ''));
      }

      const arrayMatches = onclickStr.matchAll(/["'](?:w_|z_|y_|x_)["']\s*:\s*\[\s*["']([^"']+)["']/g);
      for (const m of arrayMatches) {
        if (m[1] && m[1].startsWith('http')) urls.push(m[1].replace(/\\/g, ''));
      }

      const directMatches = onclickStr.matchAll(/https?:\/\/[a-zA-Z0-9.\-_]*userapi\.com\/[^\s"',\)\}\]]+/g);
      for (const m of directMatches) {
        if (m[0]) urls.push(m[0].replace(/\\/g, ''));
      }
    }

    // Check style background-image
    const bg = el.style.backgroundImage || (window.getComputedStyle(el).backgroundImage);
    if (bg && bg !== 'none') {
      const bgMatch = bg.match(/url\(['"]?(https?:\/\/[^'"]+)['"]?\)/);
      if (bgMatch && bgMatch[1]) urls.push(bgMatch[1]);
    }

    // Check data attributes
    const dataSrc = el.getAttribute('data-src') || el.getAttribute('data-image') || el.getAttribute('data-cover');
    if (dataSrc && dataSrc.startsWith('http')) urls.push(dataSrc);

    // Check child <img>
    const imgChild = el.querySelector('img');
    if (imgChild) {
      const src = imgChild.currentSrc || imgChild.src || imgChild.getAttribute('data-src');
      if (src && src.startsWith('http')) urls.push(src);
    }

    if (el.tagName === 'IMG') {
      const src = el.currentSrc || el.src || el.getAttribute('data-src');
      if (src && src.startsWith('http')) urls.push(src);
    }

    return urls;
  }

  function cleanVkImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let clean = url.trim().replace(/&amp;/g, '&');
    if (clean.startsWith('//')) clean = 'https:' + clean;
    if (!clean.startsWith('http')) return '';

    if (clean.includes('/avatar') || clean.includes('/camera_') || clean.includes('/deactivated_')) return '';
    return clean;
  }

  // ===== 8. Core VK Extractor =====
  async function extractVkData() {
    let allImages = [];
    let caption = '';
    let authorName = '';
    let avatarUrl = '';
    let createTime = '';
    let itemId = '';
    let postType = 'note';

    // Parse URL metadata
    const currentUrl = window.location.href;
    const photoMatch = currentUrl.match(/z=photo([-\d]+)_(\d+)/i) || currentUrl.match(/\/photo([-\d]+)_(\d+)/i);
    const wallMatch = currentUrl.match(/wall([-\d]+)_(\d+)/i);

    if (photoMatch) {
      itemId = `photo${photoMatch[1]}_${photoMatch[2]}`;
    }
    if (wallMatch) {
      itemId = `wall${wallMatch[1]}_${wallMatch[2]}`;
    }

    // ========================================================
    // STRATEGY 1: IF URL / PAGE CONTAINS A WALL POST (e.g. wall74543688_55815)
    // ========================================================
    if (wallMatch) {
      const targetWallRaw = `${wallMatch[1]}_${wallMatch[2]}`;

      // A. Check if the post's data-exec container is already in the current DOM
      const execContainers = Array.from(document.querySelectorAll('[data-exec]'));
      for (const el of execContainers) {
        const rawAttr = el.getAttribute('data-exec') || '';
        if (rawAttr.includes(targetWallRaw) || rawAttr.includes('PostContentContainer')) {
          const parsed = extractFromDataExecString(rawAttr);
          if (parsed && parsed.photos.length > 0) {
            allImages.push(...parsed.photos);
            if (parsed.caption) caption = parsed.caption;
            if (parsed.author) authorName = parsed.author;
            if (parsed.avatar) avatarUrl = parsed.avatar;
            if (parsed.date) createTime = parsed.date;
            break;
          }
        }
      }

      // B. If not in current DOM (e.g. user is in search or opened modal), fetch the wall post directly!
      if (allImages.length === 0) {
        try {
          const wallResp = await fetch(`/wall${targetWallRaw}`, {
            headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
            credentials: 'same-origin'
          });

          if (wallResp.ok) {
            const html = await wallResp.text();
            const dataExecMatches = html.matchAll(/data-exec="([^"]+)"/g);
            for (const m of dataExecMatches) {
              if (m[1].includes(targetWallRaw) || m[1].includes('PostContentContainer')) {
                const parsed = extractFromDataExecString(m[1]);
                if (parsed && parsed.photos.length > 0) {
                  allImages.push(...parsed.photos);
                  if (parsed.caption && !caption) caption = parsed.caption;
                  if (parsed.author && !authorName) authorName = parsed.author;
                  if (parsed.avatar && !avatarUrl) avatarUrl = parsed.avatar;
                  if (parsed.date && !createTime) createTime = parsed.date;
                  break;
                }
              }
            }
          }
        } catch (fetchErr) {
          console.warn('[Douyin→FB / VK] Fetch wall post error:', fetchErr);
        }
      }
    }

    // ========================================================
    // STRATEGY 2: MAIN WORLD EXTRACTION (cur.pvData deep search)
    // ========================================================
    const mainWorldData = await requestMainWorldData();
    if (mainWorldData && Array.isArray(mainWorldData.images) && mainWorldData.images.length > 0) {
      allImages.push(...mainWorldData.images);
      if (!caption && mainWorldData.desc) caption = mainWorldData.desc;
      if (!authorName && mainWorldData.author) authorName = mainWorldData.author;
      if (!createTime && mainWorldData.date) createTime = mainWorldData.date;
      if (!itemId && mainWorldData.photoId) itemId = mainWorldData.photoId;
    }

    // ========================================================
    // STRATEGY 3: PHOTO VIEWER MODAL IN DOM (ACTIVE PHOTO)
    // ========================================================
    const pvBox = document.getElementById('pv_box') || document.querySelector('.pv_cur_photo, #layer, #pv_photo');
    if (pvBox) {
      const originalLink = document.querySelector(
        'a.pv_actions_more_href[href*="userapi.com"], #pv_more_acts a[href*="userapi.com"], a[href*="as=1"], a[href*="open=1"], #pv_open_original'
      );
      if (originalLink && originalLink.href) {
        allImages.unshift(originalLink.href);
      }

      const pvImg = document.querySelector('#pv_photo img, .pv_cur_img, .pv_photo_wrap img, #pv_box img');
      if (pvImg) {
        const src = pvImg.currentSrc || pvImg.src || pvImg.getAttribute('data-src');
        if (src) allImages.push(src);
      }

      if (!caption) {
        const descEl = document.querySelector('.pv_desc, #pv_desc, .pv_post_text, #pv_post_text');
        if (descEl) caption = descEl.innerText.trim();
      }
      if (!authorName) {
        const authorEl = document.querySelector('.pv_author_name, #pv_author_name, .pv_owner, #pv_owner a');
        if (authorEl) authorName = authorEl.innerText.trim();
      }
      if (!avatarUrl) {
        const avEl = document.querySelector('.pv_author_thumb img, #pv_author_thumb img, .pv_author_img');
        if (avEl) avatarUrl = avEl.src || '';
      }
      if (!createTime) {
        const dateEl = document.querySelector('.pv_date, #pv_date');
        if (dateEl) createTime = dateEl.innerText.trim();
      }
    }

    // ========================================================
    // STRATEGY 4: DOM POST SCAN (THUMBNAILS & ONCLICK SHOWPHOTO)
    // ========================================================
    const postContainers = Array.from(document.querySelectorAll('.post, .wall_item, div[id^="post"]'));
    let targetPost = null;
    if (wallMatch) {
      targetPost = document.getElementById(`post${wallMatch[1]}_${wallMatch[2]}`) ||
                   document.querySelector(`[data-post-id="${wallMatch[1]}_${wallMatch[2]}"]`);
    }
    if (!targetPost && postContainers.length > 0) {
      targetPost = postContainers.find(p => {
        const rect = p.getBoundingClientRect();
        return rect.top >= -100 && rect.bottom > 100;
      }) || postContainers[0];
    }

    if (targetPost) {
      if (!caption) {
        const textEl = targetPost.querySelector('.wall_post_text, .wall_text, .PostText');
        if (textEl) caption = textEl.innerText.trim();
      }
      if (!authorName) {
        const authEl = targetPost.querySelector('.post_author .author, .PostHeaderTitle, .author');
        if (authEl) authorName = authEl.innerText.trim();
      }
      if (!avatarUrl) {
        const avEl = targetPost.querySelector('.post_image img, .PostHeaderTitle__avatar img, .post_author img');
        if (avEl) avatarUrl = avEl.src || '';
      }
      if (!createTime) {
        const timeEl = targetPost.querySelector('.post_date, .PostHeaderSubtitle, .rel_date');
        if (timeEl) createTime = timeEl.innerText.trim();
      }

      const thumbs = targetPost.querySelectorAll(
        '.page_post_sized_thumbs a, a.page_post_thumb_wrap, div.image_cover, [data-photo-id], .page_post_sized_thumbs img'
      );
      for (const thumb of thumbs) {
        const urls = extractUrlsFromVkElement(thumb);
        allImages.push(...urls);
      }
    }

    // ========================================================
    // CLEAN, VALIDATE AND DEDUPLICATE ALL IMAGES
    // ========================================================
    const cleanedImages = [];
    const seen = new Set();

    for (const rawUrl of allImages) {
      const clean = cleanVkImageUrl(rawUrl);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        cleanedImages.push(clean);
      }
    }

    // Extract hashtags from caption
    const hashtagMatches = (caption || '').match(/#[a-zA-Z0-9_\u0400-\u04FF]+/g) || [];
    const hashtags = Array.from(new Set(hashtagMatches));

    if (cleanedImages.length === 0) {
      return {
        success: false,
        platform: 'vk',
        error: 'Không tìm thấy ảnh trên trang VK hiện tại. Hãy mở ảnh hoặc bài viết.'
      };
    }

    return {
      success: true,
      platform: 'vk',
      type: postType,
      title: (caption || 'Bài viết VKontakte').slice(0, 100),
      desc: caption,
      images: cleanedImages,
      videoUrl: '',
      author: authorName || 'Tác giả VKontakte',
      avatar: avatarUrl || '',
      itemId: itemId || ('vk_' + Date.now()),
      url: currentUrl,
      createTime: createTime || 'Gần đây',
      hashtags: hashtags
    };
  }

  // ===== 9. Listen for messages from Popup / Background =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'BACKGROUND_DOWNLOAD_PROGRESS') {
      const info = request.payload;
      showToast(`⏳ Đang tải ảnh VK ${info.current}/${info.total} ở chế độ nền... Bạn chuyển tab thoải mái!`);
      return;
    }

    if (request.type === 'BACKGROUND_DOWNLOAD_COMPLETE') {
      const post = request.payload?.postRecord;
      showToast(`🎉 Đã tải xong ${post?.images?.length || 0} ảnh VK vào kho Offline!`);
      return;
    }

    if (request.type === 'GET_CURRENT_PAGE_MEDIA') {
      extractVkData()
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, platform: 'vk', error: err.message }));
      return true; // Keep port open for async response
    }
  });

  // ===== 10. Init floating button =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createVkFloatingBtn);
  } else {
    createVkFloatingBtn();
  }

  // Re-create button on VK SPA navigation
  const observer = new MutationObserver(() => {
    if (!document.getElementById('vk-to-fb-floating-btn')) {
      createVkFloatingBtn();
    }
  });
  observer.observe(document.body, { childList: true, subtree: false });
})();
