// Studio Offline Viewer Logic — Full-page offline dashboard for Douyin posts
document.addEventListener('DOMContentLoaded', async () => {
  // ===== DOM References =====
  const postsListEl = document.getElementById('posts-list');
  const emptySidebarEl = document.getElementById('empty-sidebar');
  const searchInput = document.getElementById('search-input');
  const filterChips = document.querySelectorAll('.filter-chip');
  const countAllEl = document.getElementById('count-all');
  const countPendingEl = document.getElementById('count-pending');
  const countPublishedEl = document.getElementById('count-published');
  const btnClearAll = document.getElementById('btn-clear-all');

  const emptyStateEl = document.getElementById('empty-state');
  const postViewEl = document.getElementById('post-view');

  const viewAvatar = document.getElementById('view-avatar');
  const viewAuthor = document.getElementById('view-author');
  const viewBadgeStatus = document.getElementById('view-badge-status');
  const viewTime = document.getElementById('view-time');
  const viewImgCount = document.getElementById('view-img-count');
  const viewOriginLink = document.getElementById('view-origin-link');
  const checkPublished = document.getElementById('check-published');
  const btnExportZip = document.getElementById('btn-export-zip');
  const btnDeletePost = document.getElementById('btn-delete-post');

  const viewEngCaption = document.getElementById('view-eng-caption');
  const viewZhCaption = document.getElementById('view-zh-caption');
  const fbCharCount = document.getElementById('fb-char-count');
  const btnCopyFb = document.getElementById('btn-copy-fb');
  const btnCopyZh = document.getElementById('btn-copy-zh');

  const viewImageGrid = document.getElementById('view-image-grid');
  const btnDownloadAllJpg = document.getElementById('btn-download-all-jpg');

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCounter = document.getElementById('lightbox-counter');
  const lightboxDlBtn = document.getElementById('lightbox-dl-btn');

  const toastEl = document.getElementById('toast');

  // ===== State =====
  let allPosts = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let activePost = null;
  let activeLightboxIndex = 0;
  let galleryRenderGeneration = 0;
  let galleryImageObserver = null;

  // ===== INITIAL LOAD =====
  await refreshPostsList();

  // Check URL param ?id=...
  const urlParams = new URLSearchParams(window.location.search);
  const requestedId = urlParams.get('id');
  if (requestedId) {
    const target = allPosts.find(p => p.id === requestedId);
    if (target) {
      selectPost(target);
    } else if (allPosts.length > 0) {
      selectPost(allPosts[0]);
    }
  } else if (allPosts.length > 0) {
    selectPost(allPosts[0]);
  }

  // ===== REFRESH POSTS LIST =====
  async function refreshPostsList() {
    try {
      allPosts = await DouyinDB.getAllPosts();
      updateFilterCounts();
      renderSidebarList();
    } catch (err) {
      console.error('Failed to load posts from IndexedDB:', err);
    }
  }

  function updateFilterCounts() {
    countAllEl.innerText = allPosts.length;
    const pendingCount = allPosts.filter(p => p.status !== 'published').length;
    const publishedCount = allPosts.filter(p => p.status === 'published').length;
    countPendingEl.innerText = pendingCount;
    countPublishedEl.innerText = publishedCount;
  }

  // ===== RENDER SIDEBAR =====
  function renderSidebarList() {
    postsListEl.innerHTML = '';

    const filtered = allPosts.filter(p => {
      // Filter status
      if (currentFilter === 'pending' && p.status === 'published') return false;
      if (currentFilter === 'published' && p.status !== 'published') return false;
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const authorMatch = (p.author || '').toLowerCase().includes(q);
        const titleMatch = (p.desc || '').toLowerCase().includes(q);
        const engMatch = (p.englishCaption || '').toLowerCase().includes(q);
        if (!authorMatch && !titleMatch && !engMatch) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      emptySidebarEl.classList.remove('hidden');
    } else {
      emptySidebarEl.classList.add('hidden');
    }

    filtered.forEach(post => {
      const card = document.createElement('div');
      card.className = `post-card-item ${activePost && activePost.id === post.id ? 'active' : ''}`;

      const thumbUrl = (post.images && post.images.length > 0 && post.images[0].dataUrl) ||
                       post.thumbUrl || post.avatar || '../icons/icon48.png';

      const isPub = post.status === 'published';

      card.innerHTML = `
        <img class="card-thumb" src="${thumbUrl}" alt="Thumbnail" loading="lazy" decoding="async" />
        <div class="card-details">
          <div class="card-title" title="${escapeHtml(post.desc || '')}">${escapeHtml(post.desc || '(Không có tiêu đề)')}</div>
          <div class="card-author">@${escapeHtml(post.author || 'Tác giả')}</div>
          <div class="card-date">📅 ${escapeHtml(formatPublishedDate(post))}</div>
          <div class="card-bottom-row">
            <span class="card-badge ${isPub ? 'published' : 'pending'}">${isPub ? 'Đã đăng' : 'Chưa đăng'}</span>
            <span class="card-count">${(post.images || []).length} ảnh</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => selectPost(post));
      postsListEl.appendChild(card);
    });
  }

  // ===== SELECT AND DISPLAY POST =====
  function selectPost(post) {
    activePost = post;
    emptyStateEl.classList.add('hidden');
    postViewEl.classList.remove('hidden');

    // Update active highlight in sidebar
    document.querySelectorAll('.post-card-item').forEach(el => el.classList.remove('active'));
    renderSidebarList();

    // Fill header
    viewAuthor.innerText = post.author ? `@${post.author}` : 'Tác giả Douyin';
    viewAvatar.src = post.avatar || '../icons/icon48.png';
    viewTime.innerText = `📅 Ngày tác giả đăng: ${formatPublishedDate(post)}`;
    viewImgCount.innerText = `🖼️ ${(post.images || []).length} ảnh JPG`;

    if (post.sourceUrl || post.url) {
      viewOriginLink.href = post.sourceUrl || post.url;
      viewOriginLink.style.display = 'inline-block';
    } else {
      viewOriginLink.style.display = 'none';
    }

    // Status
    const isPub = post.status === 'published';
    checkPublished.checked = isPub;
    updateStatusBadge(isPub);

    // Captions
    viewEngCaption.value = post.englishCaption || '';
    viewZhCaption.value = post.desc || '';
    updateCharCount();

    // Images
    renderImagesGrid(post.images || []);
  }

  function updateStatusBadge(isPub) {
    if (isPub) {
      viewBadgeStatus.innerText = '✅ Đã đăng FB';
      viewBadgeStatus.className = 'badge-status status-published';
    } else {
      viewBadgeStatus.innerText = '⏳ Chưa đăng FB';
      viewBadgeStatus.className = 'badge-status status-pending';
    }
  }

  function updateCharCount() {
    const len = viewEngCaption.value.length;
    fbCharCount.innerText = `${len} ký tự`;
  }

  viewEngCaption.addEventListener('input', () => {
    updateCharCount();
    if (activePost) {
      activePost.englishCaption = viewEngCaption.value;
      DouyinDB.savePost(activePost);
    }
  });

  // Toggle status
  checkPublished.addEventListener('change', async () => {
    if (!activePost) return;
    const isPub = checkPublished.checked;
    activePost.status = isPub ? 'published' : 'pending';
    await DouyinDB.updateStatus(activePost.id, activePost.status);
    updateStatusBadge(isPub);
    updateFilterCounts();
    renderSidebarList();
    showToast(isPub ? '✅ Đã đánh dấu bài này là ĐÃ ĐĂNG' : '⏳ Đã đánh dấu bài này là CHƯA ĐĂNG');
  });

  // ===== RENDER CLEAN JPG IMAGES GRID =====
  function renderImagesGrid(images) {
    const renderGeneration = ++galleryRenderGeneration;
    if (galleryImageObserver) galleryImageObserver.disconnect();

    viewImageGrid.innerHTML = '';
    btnDownloadAllJpg.querySelector('span').innerText = `Tải tất cả ${images.length} ảnh JPG`;
    btnDownloadAllJpg.disabled = images.length === 0;

    // Data URLs can be several MB each. Keep them out of <img src> until the
    // card is close to the viewport so the browser does not decode everything
    // at once and freeze the Offline Studio.
    const pendingSources = new WeakMap();
    galleryImageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const image = entry.target;
        const source = pendingSources.get(image);
        if (source) image.src = source;
        pendingSources.delete(image);
        observer.unobserve(image);
      });
    }, { rootMargin: '500px 0px' });

    let nextIndex = 0;
    const renderBatch = () => {
      if (renderGeneration !== galleryRenderGeneration) return;

      const fragment = document.createDocumentFragment();
      const batchEnd = Math.min(nextIndex + 8, images.length);

      for (; nextIndex < batchEnd; nextIndex++) {
        const idx = nextIndex;
        const imgObj = images[idx];
        const imgSrc = imgObj.dataUrl;
        const card = document.createElement('div');
        card.className = 'gallery-photo-card';

        card.innerHTML = `
          <div class="photo-wrapper">
            <img class="photo-img" alt="Ảnh ${idx + 1}" loading="lazy" decoding="async" />
            <span class="photo-index-tag">#${idx + 1}</span>
            <div class="photo-actions-overlay">
              <button type="button" class="btn-photo-action copy-img-btn" title="Sao chép ảnh này">📋 Copy</button>
              <a class="btn-photo-action dl-img-btn" href="#" download="${imgObj.filename || `photo_${idx + 1}.jpg`}" title="Tải ảnh JPG này">⬇ Tải</a>
              <button type="button" class="btn-photo-action delete-img-btn" title="Xóa ảnh này khỏi bài">🗑 Xóa</button>
            </div>
          </div>
        `;

        const photo = card.querySelector('.photo-img');
        pendingSources.set(photo, imgSrc);
        galleryImageObserver.observe(photo);

        card.addEventListener('click', (e) => {
          if (!e.target.closest('.photo-actions-overlay')) openLightbox(idx);
        });

        card.querySelector('.copy-img-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          await copyImageToClipboard(imgSrc);
        });

        card.querySelector('.dl-img-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          e.currentTarget.href = imgSrc;
        });

        card.querySelector('.delete-img-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          await deleteImage(idx);
        });

        fragment.appendChild(card);
      }

      viewImageGrid.appendChild(fragment);
      if (nextIndex < images.length) requestAnimationFrame(renderBatch);
    };

    renderBatch();
  }

  async function deleteImage(index) {
    if (!activePost?.images?.[index]) return;
    if (!confirm(`Xóa ảnh #${index + 1} khỏi bài viết offline này?`)) return;

    activePost.images.splice(index, 1);
    activePost.thumbUrl = activePost.images[0]?.dataUrl || '';
    await DouyinDB.savePost(activePost);

    lightbox.classList.remove('active');
    viewImgCount.innerText = `🖼️ ${activePost.images.length} ảnh JPG`;
    renderImagesGrid(activePost.images);
    renderSidebarList();
    showToast('🗑️ Đã xóa ảnh khỏi bài viết offline');
  }

  // ===== LIGHTBOX =====
  function openLightbox(index) {
    if (!activePost || !activePost.images || activePost.images.length === 0) return;
    activeLightboxIndex = index;
    const current = activePost.images[activeLightboxIndex];
    lightboxImg.src = current.dataUrl;
    lightboxCounter.innerText = `${activeLightboxIndex + 1} / ${activePost.images.length}`;
    lightboxDlBtn.href = current.dataUrl;
    lightboxDlBtn.download = current.filename || `photo_${activeLightboxIndex + 1}.jpg`;
    lightbox.classList.add('active');
  }

  window.closeLightbox = function() {
    lightbox.classList.remove('active');
  };

  window.changeLightbox = function(dir) {
    if (!activePost || !activePost.images) return;
    const total = activePost.images.length;
    activeLightboxIndex = (activeLightboxIndex + dir + total) % total;
    const current = activePost.images[activeLightboxIndex];
    lightboxImg.src = current.dataUrl;
    lightboxCounter.innerText = `${activeLightboxIndex + 1} / ${total}`;
    lightboxDlBtn.href = current.dataUrl;
    lightboxDlBtn.download = current.filename || `photo_${activeLightboxIndex + 1}.jpg`;
  };

  window.copyCurrentLightboxImage = async function() {
    if (!activePost || !activePost.images) return;
    const current = activePost.images[activeLightboxIndex];
    await copyImageToClipboard(current.dataUrl);
  };

  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') changeLightbox(-1);
    if (e.key === 'ArrowRight') changeLightbox(1);
  });

  // ===== COPY TEXT BUTTONS =====
  btnCopyFb.addEventListener('click', () => {
    const text = viewEngCaption.value.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Đã copy bài đăng Facebook vào bộ nhớ tạm!');
      btnCopyFb.querySelector('span').innerText = '✅ Đã copy xong!';
      setTimeout(() => {
        btnCopyFb.querySelector('span').innerText = '📋 Copy bài đăng Facebook';
      }, 1500);
    });
  });

  btnCopyZh.addEventListener('click', () => {
    const text = viewZhCaption.value.trim();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Đã copy caption tiếng Trung!');
      btnCopyZh.innerText = '✅ Đã copy!';
      setTimeout(() => { btnCopyZh.innerText = 'Copy gốc'; }, 1500);
    });
  });

  // ===== COPY IMAGE TO SYSTEM CLIPBOARD =====
  async function copyImageToClipboard(dataUrl) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      // Convert to PNG for clipboard compatibility if needed
      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => img.onload = r);

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(async (pngBlob) => {
        if (!pngBlob) {
          showToast('❌ Không thể sao chép ảnh này');
          return;
        }
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        showToast('🖼️ Đã sao chép ảnh! Bạn có thể nhấn Ctrl+V để dán trực tiếp lên Facebook.');
      }, 'image/png');
    } catch (err) {
      console.error('Lỗi copy ảnh:', err);
      showToast('❌ Trình duyệt chặn sao chép ảnh trực tiếp.');
    }
  }

  // ===== DOWNLOAD ALL JPG AS ZIP =====
  btnDownloadAllJpg.addEventListener('click', async () => {
    if (!activePost || !activePost.images || activePost.images.length === 0) return;
    await exportPostZip(activePost);
  });

  btnExportZip.addEventListener('click', async () => {
    if (!activePost) return;
    await exportPostZip(activePost);
  });

  async function exportPostZip(post) {
    showToast('📦 Đang nén toàn bộ ảnh JPG và nội dung thành ZIP...');
    const zip = new JSZip();
    const imgFolder = zip.folder('images');

    // Add images
    for (let i = 0; i < (post.images || []).length; i++) {
      const item = post.images[i];
      const base64Data = item.dataUrl.split(',')[1];
      imgFolder.file(item.filename || `photo_${i + 1}.jpg`, base64Data, { base64: true });
    }

    // Add caption txt
    const txt = [
      '========================================',
      '  FACEBOOK POST (ENGLISH)',
      '========================================',
      '',
      post.englishCaption || '',
      '',
      '',
      '========================================',
      '  CHINESE CAPTION',
      '========================================',
      '',
      post.desc || '',
      '',
      `Kênh: ${post.author || 'N/A'}`,
      `Thời gian: ${post.createTime || 'N/A'}`,
      `Nguồn: ${post.sourceUrl || post.url || ''}`
    ].join('\n');
    zip.file('post_facebook.txt', txt);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (post.desc || 'douyin_post').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').slice(0, 30);
    a.download = `[Offline]_${safeTitle}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('✅ Đã tải xong file ZIP!');
  }

  // ===== DELETE POST =====
  btnDeletePost.addEventListener('click', async () => {
    if (!activePost) return;
    if (confirm(`Bạn có chắc chắn muốn xóa bài viết này không?\n\n"${activePost.desc || activePost.author}"`)) {
      await DouyinDB.deletePost(activePost.id);
      showToast('🗑️ Đã xóa bài viết');
      activePost = null;
      await refreshPostsList();
      if (allPosts.length > 0) {
        selectPost(allPosts[0]);
      } else {
        emptyStateEl.classList.remove('hidden');
        postViewEl.classList.add('hidden');
      }
    }
  });

  // ===== CLEAR ALL POSTS =====
  btnClearAll.addEventListener('click', async () => {
    if (confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa TẤT CẢ các bài viết trong kho lưu trữ không?')) {
      await DouyinDB.clearAll();
      showToast('🗑️ Đã xóa sạch toàn bộ kho lưu trữ');
      activePost = null;
      await refreshPostsList();
      emptyStateEl.classList.remove('hidden');
      postViewEl.classList.add('hidden');
    }
  });

  // ===== SEARCH & FILTERS =====
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    renderSidebarList();
  });

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderSidebarList();
    });
  });

  // ===== TOAST UTILITY =====
  let toastTimer = null;
  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.innerText = msg;
    toastEl.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  function formatPublishedDate(post) {
    const rawTimestamp = Number(post.createTimestamp);
    if (Number.isFinite(rawTimestamp) && rawTimestamp > 0) {
      const milliseconds = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }).format(date);
      }
    }
    return String(post.createTime || 'Không xác định');
  }
});
