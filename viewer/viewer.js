// Studio Offline Viewer Logic — Full-page offline dashboard for Douyin posts
document.addEventListener('DOMContentLoaded', async () => {
  // ===== DOM References =====
  const postsListEl = document.getElementById('posts-list');
  const emptySidebarEl = document.getElementById('empty-sidebar');
  const searchInput = document.getElementById('search-input');
  const monthFilter = document.getElementById('month-filter');
  const imageProcessFilter = document.getElementById('image-process-filter');
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
  const btnEditPublishDate = document.getElementById('btn-edit-publish-date');
  const viewImgCount = document.getElementById('view-img-count');
  const viewOriginLink = document.getElementById('view-origin-link');
  const checkPublished = document.getElementById('check-published');
  const checkImagesProcessed = document.getElementById('check-images-processed');
  const btnExportZip = document.getElementById('btn-export-zip');
  const btnDeletePost = document.getElementById('btn-delete-post');

  const viewEngCaption = document.getElementById('view-eng-caption');
  const viewZhCaption = document.getElementById('view-zh-caption');
  const viewInternalNotes = document.getElementById('view-internal-notes');
  const fbCharCount = document.getElementById('fb-char-count');
  const btnCopyFb = document.getElementById('btn-copy-fb');
  const btnCopyZh = document.getElementById('btn-copy-zh');

  const viewImageGrid = document.getElementById('view-image-grid');
  const btnDownloadAllJpg = document.getElementById('btn-download-all-jpg');
  const imageTagSearch = document.getElementById('image-tag-search');
  const btnTagAllImages = document.getElementById('btn-tag-all-images');
  const btnSaveToFolder = document.getElementById('btn-save-to-folder');
  const selectedImagesCount = document.getElementById('selected-images-count');
  const btnSelectAllImages = document.getElementById('btn-select-all-images');
  const btnClearImageSelection = document.getElementById('btn-clear-image-selection');
  const btnTagSelectedImages = document.getElementById('btn-tag-selected-images');
  const btnRenameSelectedImages = document.getElementById('btn-rename-selected-images');
  const btnRotateLeftImages = document.getElementById('btn-rotate-left-images');
  const btnRotateRightImages = document.getElementById('btn-rotate-right-images');
  const btnOptimizeSelectedImages = document.getElementById('btn-optimize-selected-images');
  const btnDeleteSelectedImages = document.getElementById('btn-delete-selected-images');

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCounter = document.getElementById('lightbox-counter');
  const lightboxDlBtn = document.getElementById('lightbox-dl-btn');

  const toastEl = document.getElementById('toast');

  // ===== State =====
  let allPosts = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let imageTagQuery = '';
  let selectedMonth = 'all';
  let selectedImageProcess = 'all';
  let activePost = null;
  let activeLightboxIndex = 0;
  let galleryRenderGeneration = 0;
  let galleryImageObserver = null;
  let selectedImageIndexes = new Set();
  let lastSelectedImageIndex = null;
  let notesSaveTimer = null;

  // ===== INITIAL LOAD =====
  DouyinFiles.getDirectoryInfo().catch(() => {});
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
      populateMonthFilter();
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
      if (selectedMonth !== 'all' && getPostMonthKey(p) !== selectedMonth) return false;
      if (selectedImageProcess === 'processed' && !p.imageProcessed) return false;
      if (selectedImageProcess === 'unprocessed' && p.imageProcessed) return false;
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const authorMatch = (p.author || '').toLowerCase().includes(q);
        const titleMatch = (p.desc || '').toLowerCase().includes(q);
        const engMatch = (p.englishCaption || '').toLowerCase().includes(q);
        const tagMatch = (p.images || []).some(image => (image.tags || []).some(tag => tag.toLowerCase().includes(q)));
        if (!authorMatch && !titleMatch && !engMatch && !tagMatch) return false;
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

      const thumbUrl = (post.images && post.images.length > 0 && (post.images[0].thumbnailDataUrl || post.images[0].dataUrl)) ||
                       post.thumbUrl || post.avatar || '../icons/icon48.png';

      const isPub = post.status === 'published';

      card.innerHTML = `
        <img class="card-thumb" src="${thumbUrl}" alt="Thumbnail" loading="lazy" decoding="async" />
        <div class="card-details">
          <div class="card-title" title="${escapeHtml(post.desc || '')}">${escapeHtml(post.desc || '(Không có tiêu đề)')}</div>
          <div class="card-author">@${escapeHtml(post.author || 'Tác giả')}</div>
          <div class="card-date">📅 ${escapeHtml(formatPublishedDate(post))}</div>
          <div class="card-bottom-row">
            <div class="card-statuses">
              <span class="card-badge ${isPub ? 'published' : 'pending'}">${isPub ? 'Đã đăng' : 'Chưa đăng'}</span>
              <span class="card-badge ${post.imageProcessed ? 'processed' : 'unprocessed'}">${post.imageProcessed ? '✓ Đã xử lý' : 'Chưa xử lý'}</span>
            </div>
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
    selectedImageIndexes.clear();
    lastSelectedImageIndex = null;
    updateImageSelectionToolbar();
    emptyStateEl.classList.add('hidden');
    postViewEl.classList.remove('hidden');

    // Update active highlight in sidebar
    document.querySelectorAll('.post-card-item').forEach(el => el.classList.remove('active'));
    renderSidebarList();

    // Fill header
    viewAuthor.innerText = post.author ? `@${post.author}` : 'Tác giả Douyin';
    viewAvatar.src = post.avatar || '../icons/icon48.png';
    viewTime.innerText = `📅 Ngày tác giả đăng: ${formatPublishedDate(post)}${post.publishDateManual ? ' (thủ công)' : ''}`;
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
    checkImagesProcessed.checked = Boolean(post.imageProcessed);
    updateStatusBadge(isPub);

    // Captions
    viewEngCaption.value = post.englishCaption || '';
    viewZhCaption.value = post.desc || '';
    viewInternalNotes.value = post.notes || '';
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

  viewInternalNotes.addEventListener('input', () => {
    if (!activePost) return;
    activePost.notes = viewInternalNotes.value;
    clearTimeout(notesSaveTimer);
    const postToSave = activePost;
    notesSaveTimer = setTimeout(() => DouyinDB.savePost(postToSave), 500);
  });
  viewInternalNotes.addEventListener('change', () => {
    if (activePost) DouyinDB.savePost(activePost);
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

  checkImagesProcessed.addEventListener('change', async () => {
    if (!activePost) return;
    activePost.imageProcessed = checkImagesProcessed.checked;
    await DouyinDB.savePost(activePost);
    renderSidebarList();
    showToast(activePost.imageProcessed ? '✅ Đã đánh dấu bài này là ĐÃ XỬ LÝ ẢNH' : '↩ Đã chuyển về CHƯA XỬ LÝ ẢNH');
  });

  btnEditPublishDate.addEventListener('click', async () => {
    if (!activePost) return;
    const currentDate = getDateInputValue(activePost);
    const value = prompt(
      'Nhập ngày tác giả đăng theo định dạng DD/MM/YYYY hoặc YYYY-MM-DD:',
      currentDate
    );
    if (value === null) return;
    const date = parseManualPublishDate(value);
    if (!date) {
      showToast('❌ Ngày không hợp lệ. Ví dụ: 26/06/2025');
      return;
    }

    activePost.createTimestamp = Math.floor(date.getTime() / 1000);
    activePost.createTime = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
    activePost.publishDateManual = true;
    await DouyinDB.savePost(activePost);
    viewTime.innerText = `📅 Ngày tác giả đăng: ${formatPublishedDate(activePost)} (thủ công)`;
    populateMonthFilter();
    renderSidebarList();
    showToast('✅ Đã lưu ngày đăng thủ công');
  });

  // ===== RENDER CLEAN JPG IMAGES GRID =====
  function renderImagesGrid(images) {
    const renderGeneration = ++galleryRenderGeneration;
    if (galleryImageObserver) galleryImageObserver.disconnect();

    viewImageGrid.innerHTML = '';
    btnDownloadAllJpg.querySelector('span').innerText = `Tải ${images.length} ảnh`;
    btnDownloadAllJpg.disabled = images.length === 0;
    const visibleImages = images.map((image, originalIndex) => ({ image, originalIndex }))
      .filter(({ image }) => !imageTagQuery || (image.tags || []).some(tag => tag.toLowerCase().includes(imageTagQuery)));
    if (visibleImages.length === 0) {
      viewImageGrid.innerHTML = `<div class="gallery-no-results">${images.length ? 'Không có ảnh khớp với tag đang tìm.' : 'Bài viết không còn ảnh.'}</div>`;
      return;
    }

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
      const batchEnd = Math.min(nextIndex + 8, visibleImages.length);

      for (; nextIndex < batchEnd; nextIndex++) {
        const { image: imgObj, originalIndex: idx } = visibleImages[nextIndex];
        const imgSrc = imgObj.thumbnailDataUrl || imgObj.dataUrl;
        const card = document.createElement('div');
        card.className = `gallery-photo-card ${selectedImageIndexes.has(idx) ? 'selected' : ''}`;

        card.innerHTML = `
          <div class="photo-wrapper">
            <img class="photo-img" alt="Ảnh ${idx + 1}" loading="lazy" decoding="async" />
            <input class="image-select-checkbox" type="checkbox" ${selectedImageIndexes.has(idx) ? 'checked' : ''} aria-label="Chọn ảnh ${idx + 1}">
            <span class="photo-index-tag">#${idx + 1}</span>
            <div class="photo-tags">${renderTagChips(imgObj.tags)}</div>
            <div class="photo-actions-overlay">
              <button type="button" class="btn-photo-action view-img-btn" title="Xem ảnh lớn" aria-label="Xem ảnh lớn">👁</button>
              <button type="button" class="btn-photo-action tag-img-btn" title="Gắn tag" aria-label="Gắn tag">🏷</button>
              <button type="button" class="btn-photo-action copy-img-btn" title="Sao chép ảnh" aria-label="Sao chép ảnh">📋</button>
              <a class="btn-photo-action dl-img-btn" href="#" download="${imgObj.filename || `photo_${idx + 1}.jpg`}" title="Tải ảnh" aria-label="Tải ảnh">⬇</a>
              <button type="button" class="btn-photo-action delete-img-btn" title="Xóa ảnh" aria-label="Xóa ảnh">🗑</button>
            </div>
          </div>
          <div class="photo-file-name" title="${escapeHtml(imgObj.filename || `photo_${idx + 1}.jpg`)}">${escapeHtml(imgObj.filename || `photo_${idx + 1}.jpg`)}</div>
        `;

        const photo = card.querySelector('.photo-img');
        pendingSources.set(photo, imgSrc);
        galleryImageObserver.observe(photo);

        card.querySelector('.image-select-checkbox').addEventListener('click', (e) => {
          e.stopPropagation();
          setImageSelected(idx, e.currentTarget.checked, e.shiftKey);
          renderImagesGrid(activePost.images);
        });

        card.addEventListener('click', (e) => {
          if (e.target.closest('.photo-actions-overlay')) return;
          setImageSelected(idx, !selectedImageIndexes.has(idx), e.shiftKey);
          renderImagesGrid(activePost.images);
        });

        card.querySelector('.view-img-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          openLightbox(idx);
        });

        card.querySelector('.copy-img-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          await copyImageToClipboard(imgSrc);
        });

        card.querySelector('.tag-img-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          await editImageTags(idx);
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
      if (nextIndex < visibleImages.length) requestAnimationFrame(renderBatch);
    };

    renderBatch();
  }

  async function editImageTags(index) {
    const image = activePost?.images?.[index];
    if (!image) return;
    const current = (image.tags || []).map(tag => `#${tag}`).join(' ');
    const value = prompt(
      'Paste nguyên danh sách hashtag. Ứng dụng sẽ tự tách các từ bắt đầu bằng #, bỏ dấu # và loại tag trùng:',
      current
    );
    if (value === null) return;
    image.tags = parseImageTags(value).slice(0, 200);
    await DouyinDB.savePost(activePost);
    renderImagesGrid(activePost.images || []);
    renderSidebarList();
    showToast(`🏷️ Đã tự tách và lưu ${image.tags.length} tag`);
  }

  function parseImageTags(value) {
    const hashtagMatches = String(value || '').match(/#[\p{L}\p{N}_-]+/gu) || [];
    if (hashtagMatches.length > 0) {
      return [...new Set(hashtagMatches.map(tag => tag.slice(1).toLocaleLowerCase('vi-VN')))];
    }

    // Also accept a simple comma/newline list when the pasted text has no #.
    return [...new Set(String(value || '')
      .split(/[,;\n]+/)
      .map(tag => tag.replace(/^[\s`*\-–—•\d.)]+|[\s`*]+$/g, '').toLocaleLowerCase('vi-VN'))
      .filter(Boolean))];
  }

  btnTagAllImages.addEventListener('click', async () => {
    if (!activePost?.images?.length) {
      showToast('Bài viết chưa có ảnh để gắn tag');
      return;
    }
    const value = prompt(
      'Paste danh sách hashtag để gắn nhanh cho TẤT CẢ ảnh. Tag riêng đã có trên từng ảnh vẫn được giữ lại:',
      ''
    );
    if (value === null) return;
    const tags = parseImageTags(value).slice(0, 200);
    if (!tags.length) {
      showToast('❌ Không tìm thấy hashtag nào trong nội dung đã paste');
      return;
    }

    activePost.images.forEach(image => {
      image.tags = [...new Set([...(image.tags || []), ...tags])].slice(0, 200);
    });
    await DouyinDB.savePost(activePost);
    renderImagesGrid(activePost.images);
    renderSidebarList();
    showToast(`🏷️ Đã thêm ${tags.length} tag cho ${activePost.images.length} ảnh`);
  });

  btnSelectAllImages.addEventListener('click', () => {
    if (!activePost) return;
    selectedImageIndexes = new Set(activePost.images.map((_, index) => index));
    renderImagesGrid(activePost.images);
    updateImageSelectionToolbar();
  });

  btnClearImageSelection.addEventListener('click', () => {
    selectedImageIndexes.clear();
    if (activePost) renderImagesGrid(activePost.images || []);
    updateImageSelectionToolbar();
  });

  btnTagSelectedImages.addEventListener('click', async () => {
    const indexes = getSelectedImageIndexes();
    if (!indexes.length) return;
    const value = prompt(`Paste hashtag để gắn cho ${indexes.length} ảnh đã chọn:`, '');
    if (value === null) return;
    const tags = parseImageTags(value).slice(0, 200);
    if (!tags.length) {
      showToast('❌ Không tìm thấy hashtag nào');
      return;
    }
    indexes.forEach(index => {
      const image = activePost.images[index];
      image.tags = [...new Set([...(image.tags || []), ...tags])].slice(0, 200);
    });
    await DouyinDB.savePost(activePost);
    renderImagesGrid(activePost.images);
    renderSidebarList();
    showToast(`🏷️ Đã thêm ${tags.length} tag cho ${indexes.length} ảnh`);
  });

  btnRenameSelectedImages.addEventListener('click', async () => {
    const indexes = getSelectedImageIndexes();
    if (!indexes.length) return;
    const value = prompt(`Tên gốc cho ${indexes.length} ảnh. Ứng dụng tự thêm _01, _02...`, 'douyin_photo');
    if (value === null) return;
    const baseName = sanitizeImageFilename(value);
    if (!baseName) {
      showToast('❌ Tên ảnh không hợp lệ');
      return;
    }

    const selectedSet = new Set(indexes);
    const usedNames = new Set(activePost.images
      .filter((_, index) => !selectedSet.has(index))
      .map(image => (image.filename || '').toLowerCase()));
    indexes.forEach((imageIndex, order) => {
      let sequence = order + 1;
      let filename = `${baseName}_${String(sequence).padStart(2, '0')}.jpg`;
      while (usedNames.has(filename.toLowerCase())) {
        sequence++;
        filename = `${baseName}_${String(sequence).padStart(2, '0')}.jpg`;
      }
      activePost.images[imageIndex].filename = filename;
      usedNames.add(filename.toLowerCase());
    });
    await DouyinDB.savePost(activePost);
    renderImagesGrid(activePost.images);
    showToast(`✎ Đã đổi tên ${indexes.length} ảnh`);
  });

  btnRotateLeftImages.addEventListener('click', () => rotateSelectedImages(-90));
  btnRotateRightImages.addEventListener('click', () => rotateSelectedImages(90));

  async function rotateSelectedImages(degrees) {
    const indexes = getSelectedImageIndexes();
    if (!indexes.length) return;
    btnRotateLeftImages.disabled = true;
    btnRotateRightImages.disabled = true;
    try {
      for (let position = 0; position < indexes.length; position++) {
        showToast(`Đang xoay ảnh ${position + 1}/${indexes.length}...`);
        const image = activePost.images[indexes[position]];
        image.dataUrl = await rotateImageDataUrl(image.dataUrl, degrees, 1);
        image.thumbnailDataUrl = await createPreviewImage(image.dataUrl, 0.68, 480);
      }
      activePost.thumbUrl = activePost.images[0]?.thumbnailDataUrl || activePost.images[0]?.dataUrl || '';
      await DouyinDB.savePost(activePost);
      renderImagesGrid(activePost.images);
      renderSidebarList();
      showToast(`✅ Đã xoay ${indexes.length} ảnh ${degrees < 0 ? 'sang trái' : 'sang phải'}`);
    } catch (error) {
      showToast(`❌ Không thể xoay ảnh: ${error.message}`);
    } finally {
      updateImageSelectionToolbar();
    }
  }

  btnOptimizeSelectedImages.addEventListener('click', async () => {
    const indexes = getSelectedImageIndexes();
    if (!indexes.length) return;
    btnOptimizeSelectedImages.disabled = true;
    const originalText = btnOptimizeSelectedImages.innerText;
    try {
      for (let position = 0; position < indexes.length; position++) {
        btnOptimizeSelectedImages.innerText = `Đang tạo ${position + 1}/${indexes.length}`;
        const image = activePost.images[indexes[position]];
        image.thumbnailDataUrl = await createPreviewImage(image.dataUrl, 0.68, 480);
      }
      activePost.thumbUrl = activePost.images[0]?.thumbnailDataUrl || activePost.images[0]?.dataUrl || '';
      await DouyinDB.savePost(activePost);
      renderImagesGrid(activePost.images);
      renderSidebarList();
      showToast(`✅ Đã tạo ảnh xem nhẹ cho ${indexes.length} ảnh; ảnh gốc không thay đổi`);
    } catch (error) {
      showToast(`❌ Không thể tạo ảnh xem nhẹ: ${error.message}`);
    } finally {
      btnOptimizeSelectedImages.innerText = originalText;
      updateImageSelectionToolbar();
    }
  });

  btnDeleteSelectedImages.addEventListener('click', async () => {
    const indexes = getSelectedImageIndexes();
    if (!indexes.length) return;
    if (!confirm(`Xóa vĩnh viễn ${indexes.length} ảnh đã chọn khỏi bài viết Offline?`)) return;

    [...indexes].sort((a, b) => b - a).forEach(index => activePost.images.splice(index, 1));
    selectedImageIndexes.clear();
    activePost.thumbUrl = activePost.images[0]?.thumbnailDataUrl || activePost.images[0]?.dataUrl || '';
    await DouyinDB.savePost(activePost);
    lightbox.classList.remove('active');
    viewImgCount.innerText = `🖼️ ${activePost.images.length} ảnh JPG`;
    renderImagesGrid(activePost.images);
    renderSidebarList();
    updateImageSelectionToolbar();
    showToast(`🗑️ Đã xóa ${indexes.length} ảnh`);
  });

  function getSelectedImageIndexes() {
    return [...selectedImageIndexes]
      .filter(index => activePost?.images?.[index])
      .sort((a, b) => a - b);
  }

  function setImageSelected(index, selected, useRange = false) {
    if (useRange && lastSelectedImageIndex !== null) {
      const start = Math.min(lastSelectedImageIndex, index);
      const end = Math.max(lastSelectedImageIndex, index);
      for (let current = start; current <= end; current++) {
        if (selected) selectedImageIndexes.add(current);
        else selectedImageIndexes.delete(current);
      }
    } else if (selected) {
      selectedImageIndexes.add(index);
    } else {
      selectedImageIndexes.delete(index);
    }
    lastSelectedImageIndex = index;
    updateImageSelectionToolbar();
  }

  function updateImageSelectionToolbar() {
    const count = getSelectedImageIndexes().length;
    selectedImagesCount.innerText = count ? `Đã chọn ${count} ảnh` : 'Chưa chọn ảnh';
    btnTagSelectedImages.disabled = count === 0;
    btnRenameSelectedImages.disabled = count === 0;
    btnRotateLeftImages.disabled = count === 0;
    btnRotateRightImages.disabled = count === 0;
    btnOptimizeSelectedImages.disabled = count === 0;
    btnDeleteSelectedImages.disabled = count === 0;
  }

  function sanitizeImageFilename(value) {
    return String(value || '').trim()
      .replace(/\.jpe?g$/i, '')
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^[_ .]+|[_ .]+$/g, '')
      .slice(0, 60);
  }

  async function createPreviewImage(dataUrl, quality, maxDimension) {
    const image = new Image();
    image.src = dataUrl;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Không đọc được ảnh'));
    });
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Không thể xuất JPEG')), 'image/jpeg', quality);
    });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Không thể đọc ảnh xem nhẹ'));
      reader.readAsDataURL(blob);
    });
  }

  async function rotateImageDataUrl(dataUrl, degrees, quality) {
    const image = new Image();
    image.src = dataUrl;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Không đọc được ảnh'));
    });
    const swapSides = Math.abs(degrees) % 180 === 90;
    const canvas = document.createElement('canvas');
    canvas.width = swapSides ? image.naturalHeight : image.naturalWidth;
    canvas.height = swapSides ? image.naturalWidth : image.naturalHeight;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(degrees * Math.PI / 180);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('Không thể xuất ảnh đã xoay')), 'image/jpeg', quality);
    });
    return blobToDataUrlForViewer(blob);
  }

  function blobToDataUrlForViewer(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function renderTagChips(tags = []) {
    const visible = tags.slice(0, 4)
      .map(tag => `<span class="photo-tag">#${escapeHtml(tag)}</span>`)
      .join('');
    const remaining = tags.length > 4
      ? `<span class="photo-tag photo-tag-more" title="${escapeHtml(tags.map(tag => `#${tag}`).join(' '))}">+${tags.length - 4}</span>`
      : '';
    return visible + remaining;
  }

  async function deleteImage(index) {
    if (!activePost?.images?.[index]) return;
    if (!confirm(`Xóa ảnh #${index + 1} khỏi bài viết offline này?`)) return;

    activePost.images.splice(index, 1);
    selectedImageIndexes = new Set([...selectedImageIndexes]
      .filter(selectedIndex => selectedIndex !== index)
      .map(selectedIndex => selectedIndex > index ? selectedIndex - 1 : selectedIndex));
    activePost.thumbUrl = activePost.images[0]?.thumbnailDataUrl || activePost.images[0]?.dataUrl || '';
    await DouyinDB.savePost(activePost);

    lightbox.classList.remove('active');
    viewImgCount.innerText = `🖼️ ${activePost.images.length} ảnh JPG`;
    renderImagesGrid(activePost.images);
    updateImageSelectionToolbar();
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

  btnSaveToFolder.addEventListener('click', async () => {
    if (!activePost) return;
    btnSaveToFolder.disabled = true;
    try {
      const path = await DouyinFiles.savePost(activePost, { requestPermission: true });
      showToast(`✅ Đã lưu vào ${path}`);
    } catch (error) {
      showToast(`❌ ${error.message}`);
    } finally {
      btnSaveToFolder.disabled = false;
    }
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
    zip.file('notes.txt', post.notes || '');

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
    if (confirm(`XÓA TOÀN BỘ BÀI VIẾT?\n\n"${activePost.desc || activePost.author}"\n\nẢnh, caption và tag trong Offline Studio sẽ bị xóa.`)) {
      const postToDelete = activePost;
      await DouyinDB.deletePost(postToDelete.id);
      let folderDeleted = false;
      try {
        folderDeleted = await DouyinFiles.deletePostFolder(postToDelete);
      } catch (error) {
        console.warn('Không thể xóa thư mục bài:', error);
      }
      showToast(folderDeleted ? '🗑️ Đã xóa bài và thư mục lưu trên máy' : '🗑️ Đã xóa bài khỏi Offline Studio');
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

  monthFilter.addEventListener('change', () => {
    selectedMonth = monthFilter.value;
    renderSidebarList();
  });

  imageProcessFilter.addEventListener('change', () => {
    selectedImageProcess = imageProcessFilter.value;
    renderSidebarList();
  });

  imageTagSearch.addEventListener('input', () => {
    imageTagQuery = imageTagSearch.value.trim().toLowerCase();
    if (activePost) renderImagesGrid(activePost.images || []);
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
    const reliableTimestamp = getReliablePostTimestamp(post);
    if (reliableTimestamp) {
      const milliseconds = reliableTimestamp * 1000;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.getTime())) {
        if (post.publishDateManual) {
          return new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          }).format(date);
        }
        return new Intl.DateTimeFormat('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }).format(date);
      }
    }
    const fallback = String(post.createTime || '');
    return /^\d{1,2}:\d{2}(\s*\/\s*\d{1,2}:\d{2})?$/.test(fallback) ? 'Không xác định' : (fallback || 'Không xác định');
  }

  function populateMonthFilter() {
    const previous = selectedMonth;
    const months = [...new Set(allPosts.map(getPostMonthKey).filter(Boolean))].sort().reverse();
    monthFilter.innerHTML = '<option value="all">Tất cả tháng</option>' + months.map(key => {
      const [year, month] = key.split('-');
      return `<option value="${key}">Tháng ${month}/${year}</option>`;
    }).join('');
    selectedMonth = months.includes(previous) ? previous : 'all';
    monthFilter.value = selectedMonth;
  }

  function getPostMonthKey(post) {
    const timestamp = getReliablePostTimestamp(post);
    if (timestamp) {
      const date = new Date(timestamp * 1000);
      if (!Number.isNaN(date.getTime())) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    const text = String(post.createTime || '');
    const viDate = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (viDate) return `${viDate[3]}-${String(viDate[2]).padStart(2, '0')}`;
    return '';
  }

  function getReliablePostTimestamp(post) {
    const stored = Number(post.createTimestamp);
    const seconds = stored >= 1e12 ? Math.floor(stored / 1000) : stored;
    const earliest = Math.floor(new Date('2015-01-01T00:00:00Z').getTime() / 1000);
    const latest = Math.floor(Date.now() / 1000) + 86400;
    if (Number.isFinite(seconds) && seconds >= earliest && seconds <= latest) return seconds;

    if (/^\d{15,22}$/.test(String(post.id || ''))) {
      try {
        const embedded = Number(BigInt(post.id) >> 32n);
        if (embedded >= earliest && embedded <= latest) return embedded;
      } catch (error) { /* ignore non-Snowflake IDs */ }
    }
    return 0;
  }

  function parseManualPublishDate(value) {
    const text = String(value || '').trim();
    let year;
    let month;
    let day;
    let match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})$/);
    if (match) {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    } else {
      match = text.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);
      if (!match) return null;
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    }
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    if (year < 2015 || date.getTime() > Date.now() + 86400000) return null;
    return date;
  }

  function getDateInputValue(post) {
    const timestamp = getReliablePostTimestamp(post);
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }
});
