// Content Script injected into vk.com and vk.ru
// Responsible for: strictly isolated extraction of individual VK posts
// Prevents merging photos across multiple posts
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
      btn.innerHTML = '<span>⏳ Đang quét ảnh bài này...</span>';

      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => {});

      try {
        const data = await extractVkData();
        if (data && data.success && data.images.length > 0) {
          chrome.storage.local.set({
            currentExtractedData: data,
            lastExtractedAt: Date.now()
          }, () => {
            showToast(`✅ Đã trích xuất ${data.images.length} ảnh từ bài viết này! Dữ liệu đã hiện trong sidebar.`);
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
        }, 1200);
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
  function requestMainWorldData(payload = {}) {
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

      window.postMessage({ type: 'REQ_EXTRACT_VK', payload }, '*');
    });
  }

  // ===== 5. Helper: parse High-Res URL from a single VK photo object =====
  function getBestVkPhotoUrl(photoObj) {
    if (!photoObj || typeof photoObj !== 'object') return '';

    // 1. Original base photo
    if (photoObj.orig_photo && photoObj.orig_photo.url) {
      return photoObj.orig_photo.url;
    }

    // 2. Direct high-res attributes
    if (photoObj.w_src) return photoObj.w_src;
    if (photoObj.z_src) return photoObj.z_src;
    if (photoObj.y_src) return photoObj.y_src;
    if (photoObj.x_src) return photoObj.x_src;

    // 3. sizes array: prioritize base, w (2560), z (1280), y (807), x (604)
    if (Array.isArray(photoObj.sizes) && photoObj.sizes.length > 0) {
      const priority = ['base', 'w', 'z', 'y', 'x', 'm', 's'];
      for (const p of priority) {
        const found = photoObj.sizes.find(s => s && (s.type === p || s[0] === p));
        if (found) {
          const u = found.url || found.src || found[1];
          if (u) return u;
        }
      }

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

  // ===== 6. Helper: parse data-exec JSON strictly for an expected post ID =====
  function extractFromDataExecString(dataExecStr, expectedPostRaw = null) {
    try {
      const jsonStr = dataExecStr.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      const data = JSON.parse(jsonStr);
      const init = data['PostContentContainer/init'] || Object.values(data)[0] || {};
      const item = init.item || init.post || {};

      // If an expected post ID is provided, verify it strictly matches!
      if (expectedPostRaw) {
        const cleanExpected = String(expectedPostRaw).replace(/^wall/, '');
        const actualPostId = String(item.id || item.post_id || '');
        const actualRawId = `${item.owner_id}_${item.id}`;
        const isMatch = actualPostId === cleanExpected ||
                        actualRawId === cleanExpected ||
                        cleanExpected.endsWith('_' + actualPostId);
        if (!isMatch) {
          return null; // Reject: belongs to a different post!
        }
      }

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
        postId: item.id ? `${item.owner_id || ''}_${item.id}` : '',
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

      const directMatches = onclickStr.matchAll(/https?:\/\/[a-zA-Z0-9.\-_]*(?:userapi\.com|vkuserphoto\.ru)\/[^\s"',\)\}\]]+/g);
      for (const m of directMatches) {
        if (m[0]) urls.push(m[0].replace(/\\/g, ''));
      }
    }

    const bg = el.style.backgroundImage || (window.getComputedStyle(el).backgroundImage);
    if (bg && bg !== 'none') {
      const bgMatch = bg.match(/url\(['"]?(https?:\/\/[^'"]+)['"]?\)/);
      if (bgMatch && bgMatch[1]) urls.push(bgMatch[1]);
    }

    const dataSrc = el.getAttribute('data-src') || el.getAttribute('data-image') || el.getAttribute('data-cover');
    if (dataSrc && dataSrc.startsWith('http')) urls.push(dataSrc);

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

  // Helper to build standardized single-post result
  function buildResult({ itemId, images, caption, author, avatar, createTime }) {
    const cleanedImages = [];
    const seen = new Set();
    for (const u of (images || [])) {
      const clean = cleanVkImageUrl(u);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        cleanedImages.push(clean);
      }
    }

    const hashtagMatches = (caption || '').match(/#[a-zA-Z0-9_\u0400-\u04FF]+/g) || [];
    const hashtags = Array.from(new Set(hashtagMatches));

    return {
      success: cleanedImages.length > 0,
      platform: 'vk',
      type: 'note',
      title: (caption || 'Bài viết VKontakte').slice(0, 100),
      desc: caption || '',
      images: cleanedImages,
      videoUrl: '',
      author: author || 'Tác giả VKontakte',
      avatar: avatar || '',
      itemId: itemId || ('vk_' + Date.now()),
      url: window.location.href,
      createTime: createTime || 'Gần đây',
      hashtags: hashtags
    };
  }

  // ===== 8. Core VK Extractor (Strictly isolated by post) =====
  async function extractVkData() {
    const currentUrl = window.location.href;
    const decodedUrl = decodeURIComponent(currentUrl);
    const photoMatch = decodedUrl.match(/z=photo([-\d]+)_(\d+)/i) || decodedUrl.match(/\/photo([-\d]+)_(\d+)/i);
    const wallMatch = decodedUrl.match(/wall([-\d]+)_(\d+)/i);

    const activePostId = wallMatch
      ? `wall${wallMatch[1]}_${wallMatch[2]}`
      : (photoMatch ? `photo${photoMatch[1]}_${photoMatch[2]}` : '');

    // ========================================================
    // PRIORITY 1: REQUEST MAIN WORLD MEMORY (window.cur)
    // MAIN world holds full original resolution photos of the current post
    // ========================================================
    const mainData = await requestMainWorldData({ url: currentUrl });
    if (mainData && mainData.found && Array.isArray(mainData.images) && mainData.images.length > 0) {
      const descEl = document.querySelector('.pv_desc, #pv_desc, .pv_post_text, #pv_post_text, .wall_post_text');
      const authorEl = document.querySelector('.pv_author_name, #pv_author_name, .pv_owner, #pv_owner a, .post_author .author');
      const avatarEl = document.querySelector('.pv_author_thumb img, #pv_author_thumb img, .post_image img');
      const dateEl = document.querySelector('.pv_date, #pv_date, .rel_date, .post_date');

      let targetItemId = activePostId;
      if (!targetItemId && mainData.listId) {
        targetItemId = mainData.listId.startsWith('wall') ? mainData.listId : (`wall${mainData.listId}`);
      }
      if (!targetItemId && mainData.photoId) {
        targetItemId = `photo${mainData.photoId}`;
      }

      return buildResult({
        itemId: targetItemId || ('vk_' + Date.now()),
        images: mainData.images,
        caption: (descEl ? descEl.innerText.trim() : '') || mainData.desc || '',
        author: (authorEl ? authorEl.innerText.trim() : '') || mainData.author || '',
        avatar: (avatarEl ? avatarEl.src : '') || '',
        createTime: (dateEl ? dateEl.innerText.trim() : '') || mainData.date || ''
      });
    }

    // ========================================================
    // PRIORITY 2: WALL POST IN CURRENT DOM
    // ========================================================
    if (wallMatch) {
      const targetWallRaw = `${wallMatch[1]}_${wallMatch[2]}`;
      const targetPostIdOnly = wallMatch[2];

      // A. Check in current DOM for data-exec matching this exact post
      const execContainers = Array.from(document.querySelectorAll('[data-exec]'));
      for (const el of execContainers) {
        const rawAttr = el.getAttribute('data-exec') || '';
        if (rawAttr.includes(targetWallRaw) || rawAttr.includes(`"id":${targetPostIdOnly}`) || rawAttr.includes(`"postId":"${targetWallRaw}"`)) {
          const parsed = extractFromDataExecString(rawAttr, targetWallRaw);
          if (parsed && parsed.photos.length > 0) {
            return buildResult({
              itemId: `wall${targetWallRaw}`,
              images: parsed.photos,
              caption: parsed.caption,
              author: parsed.author,
              avatar: parsed.avatar,
              createTime: parsed.date
            });
          }
        }
      }

      // B. Check for target post element in DOM: #post74543688_55815 or .post[data-post-id]
      const targetPostEl = document.getElementById(`post${targetWallRaw}`) ||
                           document.getElementById(`post${wallMatch[1]}_${wallMatch[2]}`) ||
                           document.querySelector(`[data-post-id="${targetWallRaw}"]`) ||
                           document.querySelector(`div[id*="${targetPostIdOnly}"]`);
      if (targetPostEl) {
        const thumbs = targetPostEl.querySelectorAll(
          '.page_post_sized_thumbs a, a.page_post_thumb_wrap, div.image_cover, [data-photo-id], .page_post_sized_thumbs img'
        );
        const postPhotos = [];
        for (const thumb of thumbs) {
          const urls = extractUrlsFromVkElement(thumb);
          for (const u of urls) {
            const clean = cleanVkImageUrl(u);
            if (clean && !postPhotos.includes(clean)) postPhotos.push(clean);
          }
        }
        if (postPhotos.length > 0) {
          const textEl = targetPostEl.querySelector('.wall_post_text, .wall_text, .PostText');
          const authEl = targetPostEl.querySelector('.post_author .author, .PostHeaderTitle, .author');
          const avEl = targetPostEl.querySelector('.post_image img, .PostHeaderTitle__avatar img, .post_author img');
          const timeEl = targetPostEl.querySelector('.post_date, .PostHeaderSubtitle, .rel_date');

          return buildResult({
            itemId: `wall${targetWallRaw}`,
            images: postPhotos,
            caption: textEl ? textEl.innerText.trim() : '',
            author: authEl ? authEl.innerText.trim() : '',
            avatar: avEl ? avEl.src : '',
            createTime: timeEl ? timeEl.innerText.trim() : ''
          });
        }
      }
    }

    // ========================================================
    // PRIORITY 3: PHOTO VIEWER MODAL IN DOM (FALLBACK)
    // ========================================================
    const pvBox = document.getElementById('pv_box') || document.querySelector('.pv_cur_photo, #layer, #pv_photo');
    if (pvBox && (pvBox.offsetWidth > 0 || pvBox.offsetHeight > 0 || document.getElementById('pv_photo'))) {
      const modalPhotos = [];

      // Check original link in modal
      const originalLink = document.querySelector(
        'a.pv_actions_more_href[href*="userapi.com"], a.pv_actions_more_href[href*="vkuserphoto.ru"], #pv_more_acts a[href*="userapi.com"], #pv_more_acts a[href*="vkuserphoto.ru"], a[href*="as=1"], a[href*="open=1"], #pv_open_original'
      );
      if (originalLink && originalLink.href) {
        modalPhotos.push(cleanVkImageUrl(originalLink.href));
      }

      // Check current photo in viewer
      const pvImg = document.querySelector('#pv_photo img, .pv_cur_img, .pv_photo_wrap img, #pv_box img');
      if (pvImg) {
        const src = pvImg.currentSrc || pvImg.src || pvImg.getAttribute('data-src');
        if (src) modalPhotos.push(cleanVkImageUrl(src));
      }

      // Check thumbnail strip in modal
      const pvThumbs = pvBox.querySelectorAll('.pv_thumb, .pv_bottom_info img, a.pv_thumb_item');
      for (const pt of pvThumbs) {
        const urls = extractUrlsFromVkElement(pt);
        for (const u of urls) {
          const clean = cleanVkImageUrl(u);
          if (clean && !modalPhotos.includes(clean)) modalPhotos.push(clean);
        }
      }

      const descEl = document.querySelector('.pv_desc, #pv_desc, .pv_post_text, #pv_post_text');
      const authorEl = document.querySelector('.pv_author_name, #pv_author_name, .pv_owner, #pv_owner a');
      const avatarEl = document.querySelector('.pv_author_thumb img, #pv_author_thumb img');
      const dateEl = document.querySelector('.pv_date, #pv_date');

      const validModalPhotos = modalPhotos.filter(Boolean);
      if (validModalPhotos.length > 0) {
        return buildResult({
          itemId: activePostId || ('vk_' + Date.now()),
          images: validModalPhotos,
          caption: descEl ? descEl.innerText.trim() : (mainData?.desc || ''),
          author: authorEl ? authorEl.innerText.trim() : '',
          avatar: avatarEl ? avatarEl.src : '',
          createTime: dateEl ? dateEl.innerText.trim() : ''
        });
      }
    }

    // ========================================================
    // SCENARIO 3: BROWSING FEED / WALL (No modal open)
    // Find the single post in viewport and extract ONLY its photos
    // ========================================================
    const postContainers = Array.from(document.querySelectorAll('.post, .wall_item, div[id^="post"]'));
    if (postContainers.length > 0) {
      const targetPost = postContainers.find(p => {
        const rect = p.getBoundingClientRect();
        return rect.top >= -50 && rect.bottom > 150;
      }) || postContainers[0];

      if (targetPost) {
        const postExec = targetPost.querySelector('[data-exec]') || targetPost.getAttribute('data-exec');
        if (postExec) {
          const rawAttr = typeof postExec === 'string' ? postExec : postExec.getAttribute('data-exec');
          const parsed = extractFromDataExecString(rawAttr);
          if (parsed && parsed.photos.length > 0) {
            return buildResult({
              itemId: parsed.postId ? `wall${parsed.postId}` : (targetPost.id || 'vk_' + Date.now()),
              images: parsed.photos,
              caption: parsed.caption,
              author: parsed.author,
              avatar: parsed.avatar,
              createTime: parsed.date
            });
          }
        }

        // Thumb fallback for this single targetPost ONLY
        const thumbs = targetPost.querySelectorAll(
          '.page_post_sized_thumbs a, a.page_post_thumb_wrap, div.image_cover, [data-photo-id], .page_post_sized_thumbs img'
        );
        const postPhotos = [];
        for (const thumb of thumbs) {
          const urls = extractUrlsFromVkElement(thumb);
          for (const u of urls) {
            const clean = cleanVkImageUrl(u);
            if (clean && !postPhotos.includes(clean)) postPhotos.push(clean);
          }
        }

        if (postPhotos.length > 0) {
          const textEl = targetPost.querySelector('.wall_post_text, .wall_text, .PostText');
          const authEl = targetPost.querySelector('.post_author .author, .PostHeaderTitle, .author');
          const avEl = targetPost.querySelector('.post_image img, .PostHeaderTitle__avatar img, .post_author img');
          const timeEl = targetPost.querySelector('.post_date, .PostHeaderSubtitle, .rel_date');

          return buildResult({
            itemId: targetPost.id ? `wall${targetPost.id.replace('post', '')}` : ('vk_' + Date.now()),
            images: postPhotos,
            caption: textEl ? textEl.innerText.trim() : '',
            author: authEl ? authEl.innerText.trim() : '',
            avatar: avEl ? avEl.src : '',
            createTime: timeEl ? timeEl.innerText.trim() : ''
          });
        }
      }
    }

    return {
      success: false,
      platform: 'vk',
      error: 'Không tìm thấy ảnh trên trang VK hiện tại. Hãy mở ảnh hoặc bài viết.'
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
