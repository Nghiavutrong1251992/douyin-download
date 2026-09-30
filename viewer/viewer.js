// Studio Offline Viewer Logic — Full-page offline dashboard for Douyin posts
document.addEventListener('DOMContentLoaded', async () => {
  // ===== DOM References =====
  const postsListEl = document.getElementById('posts-list');
  const emptySidebarEl = document.getElementById('empty-sidebar');
  const searchInput = document.getElementById('search-input');
  const provinceFilter = document.getElementById('province-filter');
  const monthFilter = document.getElementById('month-filter');
  const imageProcessFilter = document.getElementById('image-process-filter');
  const filterChips = document.querySelectorAll('.filter-chip');
  const countAllEl = document.getElementById('count-all');
  const countPendingEl = document.getElementById('count-pending');
  const countPublishedEl = document.getElementById('count-published');
  const btnClearAll = document.getElementById('btn-clear-all');

  const emptyStateEl = document.getElementById('empty-state');
  const postViewEl = document.getElementById('post-view');
  const mainContentEl = document.querySelector('.main-content');

  const viewAvatar = document.getElementById('view-avatar');
  const viewAuthor = document.getElementById('view-author');
  const viewBadgeStatus = document.getElementById('view-badge-status');
  const viewProvinceBadge = document.getElementById('view-province-badge');
  const btnEditProvince = document.getElementById('btn-edit-province');
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
  const btnOpenFolderLocation = document.getElementById('btn-open-folder-location');
  const btnOptimizeSelectedImages = document.getElementById('btn-optimize-selected-images');
  const btnDeleteSelectedImages = document.getElementById('btn-delete-selected-images');

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCounter = document.getElementById('lightbox-counter');
  const lightboxDlBtn = document.getElementById('lightbox-dl-btn');
  const lightboxCloseBtn = document.getElementById('lightbox-close');
  const lightboxPrevBtn = document.getElementById('lightbox-prev');
  const lightboxNextBtn = document.getElementById('lightbox-next');
  const lightboxBody = document.getElementById('lightbox-body');
  const lightboxCopyBtn = document.getElementById('lightbox-copy-btn');
  const lightboxFavBtn = document.getElementById('lightbox-fav-btn');
  const lightboxOpenLocationBtn = document.getElementById('lightbox-open-location-btn');
  const lightboxFilename = document.getElementById('lightbox-filename');
  const imageContextMenu = document.getElementById('image-context-menu');

  // ===== TAB NAVIGATION DOM REFERENCES =====
  const tabBtnPosts = document.getElementById('tab-btn-posts');
  const tabBtnGlobalPhotos = document.getElementById('tab-btn-global-photos');
  const navCountPosts = document.getElementById('nav-count-posts');
  const navCountGlobalPhotos = document.getElementById('nav-count-global-photos');
  const viewPostsPane = document.getElementById('view-posts-pane');
  const viewGlobalPhotosPane = document.getElementById('view-global-photos-pane');

  // ===== GLOBAL PHOTOS GALLERY DOM REFERENCES =====
  const globalSearchInput = document.getElementById('global-search-input');
  const btnClearGlobalSearch = document.getElementById('btn-clear-global-search');
  const globalChips = document.querySelectorAll('.global-chip');
  const globalCountAll = document.getElementById('global-count-all');
  const globalCountFav = document.getElementById('global-count-fav');
  const globalCountTagged = document.getElementById('global-count-tagged');
  const globalCountUntagged = document.getElementById('global-count-untagged');
  const globalPostFilter = document.getElementById('global-post-filter');
  const globalSortSelect = document.getElementById('global-sort-select');

  // Province Big Tag Elements
  const btnResetProvinceFilter = document.getElementById('btn-reset-province-filter');
  const activeProvinceNameEl = document.getElementById('active-province-name');
  const provinceCloudStats = document.getElementById('province-cloud-stats');
  const globalProvinceCloud = document.getElementById('global-province-cloud');

  const btnResetTagFilter = document.getElementById('btn-reset-tag-filter');
  const activeTagNameEl = document.getElementById('active-tag-name');
  const tagCloudStats = document.getElementById('tag-cloud-stats');
  const globalTagCloudList = document.getElementById('global-tag-cloud-list');

  const globalVisibleCount = document.getElementById('global-visible-count');
  const globalSelectedCount = document.getElementById('global-selected-count');
  const btnGlobalSelectAll = document.getElementById('btn-global-select-all');
  const btnGlobalDeselect = document.getElementById('btn-global-deselect');
  const btnGlobalBatchFav = document.getElementById('btn-global-batch-fav');
  const btnGlobalBatchProvince = document.getElementById('btn-global-batch-province');
  const btnGlobalBatchTag = document.getElementById('btn-global-batch-tag');
  const btnGlobalBatchRotLeft = document.getElementById('btn-global-batch-rot-left');
  const btnGlobalBatchRotRight = document.getElementById('btn-global-batch-rot-right');
  const btnGlobalBatchOpenLocation = document.getElementById('btn-global-batch-open-location');
  const btnGlobalBatchZip = document.getElementById('btn-global-batch-zip');
  const btnGlobalBatchDelete = document.getElementById('btn-global-batch-delete');
  const globalPhotoGrid = document.getElementById('global-photo-grid');
  const globalEmptyState = document.getElementById('global-empty-state');
  const globalEmptyMsg = document.getElementById('global-empty-msg');
  const btnResetGlobalFilters = document.getElementById('btn-reset-global-filters');

  const toastEl = document.getElementById('toast');

  // ===== State =====
  let allPosts = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let imageTagQuery = '';
  let selectedProvince = 'all';
  let selectedMonth = 'all';
  let selectedImageProcess = 'all';
  let activePost = null;
  let activeLightboxIndex = 0;
  let galleryRenderGeneration = 0;
  let galleryImageObserver = null;
  let selectedImageIndexes = new Set();
  let lastSelectedImageIndex = null;
  let notesSaveTimer = null;
  let contextImageIndex = null;

  // ===== Global Photo Gallery State (Hướng A, B, C) =====
  let currentAppTab = 'posts'; // 'posts' | 'photos'
  let globalSearchQuery = '';
  let globalFilter = 'all'; // 'all' | 'favorites' | 'has-tags' | 'no-tags'
  let globalSelectedPostId = 'all';
  let globalSort = 'newest';
  let globalActiveProvince = ''; // filter by Big Tag (Tỉnh thành)
  let globalActiveTag = '';
  let selectedGlobalKeys = new Set(); // Set of `${postId}__${imgIndex}`
  let globalRenderGeneration = 0;
  let globalImageObserver = null;

  // ===== INITIAL LOAD =====
  DouyinFiles.getDirectoryInfo().catch(() => {});
  await refreshPostsList();

  // Check URL param ?id=... and ?tab=...
  const urlParams = new URLSearchParams(window.location.search);
  const requestedId = urlParams.get('id');
  const requestedTab = urlParams.get('tab');
  if (requestedId) {
    const target = allPosts.find(p => p.id === requestedId);
    if (target) {
      await selectPost(target);
    } else if (allPosts.length > 0) {
      await selectPost(allPosts[0]);
    }
  } else if (allPosts.length > 0) {
    await selectPost(allPosts[0]);
  }

  if (requestedTab === 'photos') {
    switchAppTab('photos');
  }

  // ===== REFRESH POSTS LIST =====
  async function refreshPostsList() {
    try {
      allPosts = await DouyinDB.getPostsSummary();
      // Tự động nhận diện Tỉnh thành cho bài chưa gắn thẻ to
      allPosts.forEach(p => {
        if (!p.province) {
          const detected = detectProvinceFromText(p.desc + ' ' + (p.englishCaption || ''));
          if (detected) {
            p.province = detected;
            DouyinDB.getPost(p.id).then(full => {
              if (full) {
                full.province = detected;
                DouyinDB.savePost(full).catch(() => {});
              }
            }).catch(() => {});
          }
        }
      });
      updateFilterCounts();
      updateGlobalCounts();
      populateProvinceFilter();
      populateMonthFilter();
      populateGlobalPostFilter();
      renderSidebarList();
      renderGlobalProvinceCloud();
      renderGlobalTagCloud();
      if (currentAppTab === 'photos') {
        renderGlobalPhotoGrid();
      }
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
      if (selectedProvince !== 'all') {
        if (selectedProvince === '__none__' && p.province) return false;
        if (selectedProvince !== '__none__' && (p.province || '').toLowerCase() !== selectedProvince.toLowerCase()) return false;
      }
      if (selectedMonth !== 'all' && getPostMonthKey(p) !== selectedMonth) return false;
      if (selectedImageProcess === 'processed' && !p.imageProcessed) return false;
      if (selectedImageProcess === 'unprocessed' && p.imageProcessed) return false;
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const authorMatch = (p.author || '').toLowerCase().includes(q);
        const titleMatch = (p.desc || '').toLowerCase().includes(q);
        const engMatch = (p.englishCaption || '').toLowerCase().includes(q);
        const provinceMatch = (p.province || '').toLowerCase().includes(q);
        const tagMatch = (p.images || []).some(image => (image.tags || []).some(tag => tag.toLowerCase().includes(q)));
        if (!authorMatch && !titleMatch && !engMatch && !tagMatch && !provinceMatch) return false;
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
              ${post.province ? `<span class="card-badge province" title="Tỉnh thành">📍 ${escapeHtml(post.province)}</span>` : ''}
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
  async function selectPost(post) {
    if (!post) return;
    if (post.id && (!post.images || !post.images[0] || !post.images[0].dataUrl)) {
      try {
        const full = await DouyinDB.getPost(post.id);
        if (full) post = full;
      } catch (err) {
        console.warn('Lỗi nạp chi tiết bài viết:', err);
      }
    }
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
    updateProvinceBadge();

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

    const previousScrollTop = mainContentEl.scrollTop;
    const previousGridHeight = viewImageGrid.offsetHeight;
    if (previousGridHeight) viewImageGrid.style.minHeight = `${previousGridHeight}px`;
    viewImageGrid.innerHTML = '';
    btnDownloadAllJpg.querySelector('span').innerText = `Tải ${images.length} ảnh`;
    btnDownloadAllJpg.disabled = images.length === 0;
    const visibleImages = images.map((image, originalIndex) => ({ image, originalIndex }))
      .filter(({ image }) => !imageTagQuery || (image.tags || []).some(tag => tag.toLowerCase().includes(imageTagQuery)));
    if (visibleImages.length === 0) {
      viewImageGrid.innerHTML = `<div class="gallery-no-results">${images.length ? 'Không có ảnh khớp với tag đang tìm.' : 'Bài viết không còn ảnh.'}</div>`;
      finishGalleryRender(previousScrollTop);
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
        card.dataset.imageIndex = String(idx);

        card.innerHTML = `
          <div class="photo-wrapper">
            <img class="photo-img" alt="Ảnh ${idx + 1}" loading="lazy" decoding="async" />
            <input class="image-select-checkbox" type="checkbox" ${selectedImageIndexes.has(idx) ? 'checked' : ''} aria-label="Chọn ảnh ${idx + 1}">
            <span class="photo-index-tag">#${idx + 1}</span>
            <div class="photo-tags">${renderTagChips(imgObj.tags)}</div>
            <div class="photo-actions-overlay">
              <button type="button" class="btn-photo-action fav-img-btn ${imgObj.favorite ? 'favorited' : ''}" title="${imgObj.favorite ? 'Bỏ yêu thích' : 'Yêu thích'}" aria-label="Yêu thích">⭐</button>
              <button type="button" class="btn-photo-action view-img-btn" title="Xem ảnh lớn" aria-label="Xem ảnh lớn">👁</button>
              <button type="button" class="btn-photo-action tag-img-btn" title="Gắn tag" aria-label="Gắn tag">🏷</button>
              <button type="button" class="btn-photo-action copy-img-btn" title="Sao chép ảnh" aria-label="Sao chép ảnh">📋</button>
              <button type="button" class="btn-photo-action open-loc-img-btn" title="Mở vị trí file trong thư mục" aria-label="Mở vị trí file">📂</button>
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
          syncImageSelectionUi();
        });

        card.addEventListener('click', (e) => {
          if (e.target.closest('.photo-actions-overlay')) return;
          setImageSelected(idx, !selectedImageIndexes.has(idx), e.shiftKey);
          syncImageSelectionUi();
        });

        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (!selectedImageIndexes.has(idx)) {
            selectedImageIndexes.add(idx);
            lastSelectedImageIndex = idx;
            updateImageSelectionToolbar();
            syncImageSelectionUi();
          }
          openImageContextMenu(e.clientX, e.clientY, idx);
        });

        card.querySelector('.fav-img-btn')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleImageFavorite(activePost.id, idx);
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

        card.querySelector('.open-loc-img-btn')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          await openImageInFolderLocation(imgObj, activePost, idx);
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
      else finishGalleryRender(previousScrollTop);
    };

    renderBatch();
  }

  function finishGalleryRender(scrollTop) {
    viewImageGrid.style.minHeight = '';
    requestAnimationFrame(() => { mainContentEl.scrollTop = scrollTop; });
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
    syncImageSelectionUi();
    updateImageSelectionToolbar();
  });

  btnClearImageSelection.addEventListener('click', () => {
    selectedImageIndexes.clear();
    syncImageSelectionUi();
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
  btnOpenFolderLocation?.addEventListener('click', openSelectedImagesInFolder);

  function getDownloadPathForImage(imageInfo, post, fallbackIndex = 0) {
    let folderName = 'Douyin_Photos';
    if (post) {
      if (typeof DouyinFiles !== 'undefined' && typeof DouyinFiles.getPostFolderName === 'function') {
        folderName = DouyinFiles.getPostFolderName(post);
      } else {
        const date = new Date().toISOString().slice(0, 10);
        folderName = `${date}_${post.author || 'douyin'}_${post.id || ''}`.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
      }
    }
    let cleanFilename = sanitizeImageFilename(imageInfo?.filename || `photo_${String(fallbackIndex + 1).padStart(2, '0')}.jpg`);
    if (!/\.(jpe?g|png|webp|gif)$/i.test(cleanFilename)) {
      cleanFilename += '.jpg';
    }
    return `Douyin_Photos/${folderName}/${cleanFilename}`;
  }

  function waitForDownloadComplete(downloadId, timeoutMs = 8000) {
    return new Promise((resolve) => {
      let resolved = false;
      let timer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (chrome?.downloads?.onChanged) {
          try {
            chrome.downloads.onChanged.removeListener(onChanged);
          } catch (_) {}
        }
      };

      const done = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(true);
      };

      const onChanged = (delta) => {
        if (delta.id === downloadId) {
          if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
            done();
          }
        }
      };

      if (chrome?.downloads?.onChanged) {
        chrome.downloads.onChanged.addListener(onChanged);
      }

      if (chrome?.downloads?.search) {
        chrome.downloads.search({ id: downloadId }, (items) => {
          if (items && items[0] && items[0].state === 'complete') {
            done();
          }
        });
      }

      timer = setTimeout(done, timeoutMs);
    });
  }

  async function openImageInFolderLocation(imageInfo, post, fallbackIndex = 0) {
    if (!imageInfo) return null;
    const relativePath = getDownloadPathForImage(imageInfo, post, fallbackIndex);
    const fileNameOnly = relativePath.split('/').pop();

    try {
      // 1. If downloadId exists, check if file is still there
      if (imageInfo.downloadId && chrome?.downloads?.search) {
        const items = await new Promise(res => chrome.downloads.search({ id: imageInfo.downloadId }, res));
        if (items && items.length > 0 && items[0].state === 'complete' && items[0].exists) {
          chrome.downloads.show(imageInfo.downloadId);
          showToast(`📂 Đã mở thư mục chứa ${fileNameOnly}`);
          return imageInfo.downloadId;
        }
      }

      // 2. Check if a downloaded file matching this path exists
      if (chrome?.downloads?.search) {
        const escaped = fileNameOnly.replace(/[/\\+?*()^$]/g, '\\$&');
        const items = await new Promise(res => chrome.downloads.search({ filenameRegex: escaped + '$', state: 'complete' }, res));
        const match = (items || []).find(item => item.exists && (item.filename.includes(fileNameOnly)));
        if (match) {
          chrome.downloads.show(match.id);
          imageInfo.downloadId = match.id;
          showToast(`📂 Đã mở thư mục chứa ${fileNameOnly}`);
          return match.id;
        }
      }

      // 3. Otherwise, save the image file to disk using chrome.downloads, then reveal it in folder
      let dataUrl = imageInfo.dataUrl;
      if (!dataUrl && post?.id) {
        const full = await DouyinDB.getPost(post.id);
        if (full?.images?.[index]?.dataUrl) {
          dataUrl = full.images[index].dataUrl;
          imageInfo.dataUrl = dataUrl;
        }
      }
      if (!dataUrl) dataUrl = imageInfo.thumbnailDataUrl;
      if (!dataUrl) throw new Error('Không có dữ liệu ảnh để lưu và mở thư mục.');

      let downloadUrl;
      let needRevoke = false;
      if (dataUrl.startsWith('data:')) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        downloadUrl = URL.createObjectURL(blob);
        needRevoke = true;
      } else {
        downloadUrl = dataUrl;
      }

      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: downloadUrl,
          filename: relativePath,
          saveAs: false,
          conflictAction: 'overwrite'
        }, (id) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(id);
          }
        });
      });

      if (needRevoke) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
      }

      if (!downloadId) throw new Error('Không thể tải file.');

      await waitForDownloadComplete(downloadId);
      chrome.downloads.show(downloadId);
      imageInfo.downloadId = downloadId;
      showToast(`📂 Đã mở thư mục chứa ${fileNameOnly}`);
      return downloadId;
    } catch (err) {
      console.error('Mở thư mục chứa file thất bại:', err);
      if (chrome?.downloads?.showDefaultFolder) {
        chrome.downloads.showDefaultFolder();
        showToast('📂 Đã mở thư mục tải về của trình duyệt');
      } else {
        showToast(`❌ Không thể mở thư mục: ${err.message || 'Lỗi không xác định'}`);
      }
      return null;
    }
  }

  async function openSelectedImagesInFolder() {
    const indexes = getSelectedImageIndexes();
    if (!indexes.length || !activePost) return;
    const originalText = btnOpenFolderLocation ? btnOpenFolderLocation.innerText : '';
    if (btnOpenFolderLocation) {
      btnOpenFolderLocation.disabled = true;
      btnOpenFolderLocation.innerText = `Đang mở 0/${indexes.length}`;
    }

    try {
      let firstDownloadId = null;
      for (let pos = 0; pos < indexes.length; pos++) {
        const idx = indexes[pos];
        const imageInfo = activePost.images[idx];
        if (btnOpenFolderLocation) btnOpenFolderLocation.innerText = `Đang mở ${pos + 1}/${indexes.length}`;
        const id = await openImageInFolderLocation(imageInfo, activePost, idx);
        if (!firstDownloadId && id) firstDownloadId = id;
      }
      if (firstDownloadId && chrome?.downloads?.show) {
        chrome.downloads.show(firstDownloadId);
      }
      showToast(`📂 Đã mở thư mục chứa ${indexes.length} ảnh`);
    } catch (error) {
      console.error('Mở thư mục ảnh chọn thất bại:', error);
      showToast(`❌ Không thể mở thư mục: ${error.message}`);
    } finally {
      if (btnOpenFolderLocation) btnOpenFolderLocation.innerText = originalText;
      updateImageSelectionToolbar();
    }
  }

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
    const folderSync = await syncPostFolderAfterImageDeletion();
    lightbox.classList.remove('active');
    viewImgCount.innerText = `🖼️ ${activePost.images.length} ảnh JPG`;
    renderImagesGrid(activePost.images);
    renderSidebarList();
    updateImageSelectionToolbar();
    showToast(folderSync === 'synced'
      ? `🗑️ Đã xóa ${indexes.length} ảnh khỏi kho và thư mục trên máy`
      : folderSync === 'failed'
        ? `⚠️ Đã xóa ${indexes.length} ảnh khỏi kho; chưa xóa được file trong thư mục máy`
        : `🗑️ Đã xóa ${indexes.length} ảnh khỏi kho offline`);
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

  function syncImageSelectionUi() {
    viewImageGrid.querySelectorAll('.gallery-photo-card[data-image-index]').forEach(card => {
      const index = Number(card.dataset.imageIndex);
      const selected = selectedImageIndexes.has(index);
      card.classList.toggle('selected', selected);
      const checkbox = card.querySelector('.image-select-checkbox');
      if (checkbox) checkbox.checked = selected;
    });
  }

  let contextGlobalKey = null;

  function openImageContextMenu(x, y, imageIndex, globalKey = null) {
    contextImageIndex = imageIndex;
    contextGlobalKey = globalKey;
    imageContextMenu.classList.remove('hidden');
    const width = imageContextMenu.offsetWidth;
    const height = imageContextMenu.offsetHeight;
    imageContextMenu.style.left = `${Math.min(x, window.innerWidth - width - 8)}px`;
    imageContextMenu.style.top = `${Math.min(y, window.innerHeight - height - 8)}px`;
  }

  function closeImageContextMenu() {
    imageContextMenu.classList.add('hidden');
    contextImageIndex = null;
    contextGlobalKey = null;
  }

  imageContextMenu.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || (contextImageIndex === null && !contextGlobalKey)) return;
    const action = button.dataset.action;
    const imageIndex = contextImageIndex;
    const globalKey = contextGlobalKey;
    closeImageContextMenu();

    if (globalKey || currentAppTab === 'photos') {
      const activeKey = globalKey || (selectedGlobalKeys.size ? [...selectedGlobalKeys][0] : null);
      if (action === 'view') {
        const idx = currentFilteredGlobalImages.findIndex(i => i.key === activeKey);
        if (idx !== -1) openLightbox(idx, currentFilteredGlobalImages);
      } else if (action === 'fav') {
        if (activeKey) {
          const [postId, idxStr] = activeKey.split('__');
          await toggleImageFavorite(postId, Number(idxStr));
        }
      } else if (action === 'province') {
        await setBatchProvinceForSelected();
      } else if (action === 'tag') {
        btnGlobalBatchTag.click();
      } else if (action === 'rename') {
        await renameSelectedGlobalImages();
      } else if (action === 'rotate-left') {
        await rotateSelectedGlobalImages(-90);
      } else if (action === 'rotate-right') {
        await rotateSelectedGlobalImages(90);
      } else if (action === 'open-location') {
        if (activeKey) {
          const [postId, idxStr] = activeKey.split('__');
          const p = allPosts.find(item => item.id === postId);
          const img = p?.images?.[Number(idxStr)];
          if (img) await openImageInFolderLocation(img, p, Number(idxStr));
        } else if (selectedGlobalKeys.size) {
          await openSelectedGlobalImagesInFolder();
        }
      } else if (action === 'delete') {
        btnGlobalBatchDelete.click();
      } else if (action === 'copy') {
        if (activeKey) {
          const [postId, idxStr] = activeKey.split('__');
          const p = allPosts.find(item => item.id === postId);
          const img = p?.images?.[Number(idxStr)];
          if (img?.dataUrl) await copyImageToClipboard(img.dataUrl);
        }
      }
      return;
    }

    if (action === 'view') openLightbox(imageIndex);
    else if (action === 'fav') {
      if (activePost?.id) await toggleImageFavorite(activePost.id, imageIndex);
    }
    else if (action === 'province') {
      if (activePost) await editPostProvince(activePost);
    }
    else if (action === 'tag') btnTagSelectedImages.click();
    else if (action === 'rename') btnRenameSelectedImages.click();
    else if (action === 'rotate-left') btnRotateLeftImages.click();
    else if (action === 'rotate-right') btnRotateRightImages.click();
    else if (action === 'open-location') {
      if (selectedImageIndexes.size > 1) {
        await openSelectedImagesInFolder();
      } else if (activePost?.images?.[imageIndex]) {
        await openImageInFolderLocation(activePost.images[imageIndex], activePost, imageIndex);
      }
    }
    else if (action === 'delete') btnDeleteSelectedImages.click();
    else if (action === 'copy') await copyImageToClipboard(activePost.images[imageIndex].dataUrl);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#image-context-menu')) closeImageContextMenu();
  });
  document.addEventListener('scroll', closeImageContextMenu, true);

  function updateImageSelectionToolbar() {
    const count = getSelectedImageIndexes().length;
    selectedImagesCount.innerText = count ? `Đã chọn ${count} ảnh` : 'Chưa chọn ảnh';
    btnTagSelectedImages.disabled = count === 0;
    btnRenameSelectedImages.disabled = count === 0;
    btnRotateLeftImages.disabled = count === 0;
    btnRotateRightImages.disabled = count === 0;
    if (btnOpenFolderLocation) btnOpenFolderLocation.disabled = count === 0;
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

  async function createPreviewImage(dataUrl, quality = 0.68, maxDimension = 480) {
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
    canvas.width = 0;
    canvas.height = 0;
    image.src = '';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Không thể đọc ảnh xem nhẹ'));
      reader.readAsDataURL(blob);
    });
  }

  async function rotateImageDataUrl(dataUrl, degrees, quality = 0.92) {
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
    canvas.width = 0;
    canvas.height = 0;
    image.src = '';
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
    const folderSync = await syncPostFolderAfterImageDeletion();

    lightbox.classList.remove('active');
    viewImgCount.innerText = `🖼️ ${activePost.images.length} ảnh JPG`;
    renderImagesGrid(activePost.images);
    updateImageSelectionToolbar();
    renderSidebarList();
    showToast(folderSync === 'synced'
      ? '🗑️ Đã xóa ảnh khỏi kho và thư mục trên máy'
      : folderSync === 'failed'
        ? '⚠️ Đã xóa khỏi kho; chưa xóa được file trong thư mục máy'
        : '🗑️ Đã xóa ảnh khỏi bài viết offline');
  }

  async function syncPostFolderAfterImageDeletion() {
    try {
      const directoryInfo = await DouyinFiles.getDirectoryInfo();
      if (!directoryInfo.configured) return 'not-configured';
      await DouyinFiles.savePost(activePost, { requestPermission: true });
      return 'synced';
    } catch (error) {
      console.warn('Không thể đồng bộ thao tác xóa vào thư mục offline:', error);
      return 'failed';
    }
  }

  // ===== LIGHTBOX =====
  let currentLightboxList = null;

  function openLightbox(index, customList = null) {
    currentLightboxList = customList;
    const list = currentLightboxList || activePost?.images || [];
    if (!list.length) return;
    activeLightboxIndex = Math.max(0, Math.min(index, list.length - 1));
    updateLightboxContent();
    lightbox.classList.add('active');
  }

  async function updateLightboxContent() {
    const list = currentLightboxList || activePost?.images || [];
    if (!list.length) return;
    const current = list[activeLightboxIndex];
    let dataUrl = current.dataUrl || (current.image && current.image.dataUrl) || '';
    const filename = current.filename || (current.image && current.image.filename) || `photo_${activeLightboxIndex + 1}.jpg`;
    const thumbUrl = current.thumbnailDataUrl || (current.image && current.image.thumbnailDataUrl) || dataUrl;

    lightboxImg.src = dataUrl || thumbUrl;
    lightboxCounter.innerText = `${activeLightboxIndex + 1} / ${list.length}`;
    if (lightboxFilename) {
      lightboxFilename.innerText = filename ? `— ${filename}` : '';
    }
    lightboxDlBtn.href = dataUrl || thumbUrl;
    lightboxDlBtn.download = filename;

    if (lightboxFavBtn) {
      const isFav = Boolean(current.favorite || (current.image && current.image.favorite));
      lightboxFavBtn.className = `btn-lightbox btn-lightbox-star ${isFav ? 'favorited' : ''}`;
      lightboxFavBtn.innerText = isFav ? '⭐ Đã thích' : '⭐ Yêu thích';
    }

    // Lazy load full dataUrl if opened from summary
    if (!dataUrl && current.postId) {
      const p = await DouyinDB.getPost(current.postId);
      if (p && p.images && p.images[current.imageIndex]) {
        const fullData = p.images[current.imageIndex].dataUrl;
        if (fullData) {
          if (current.image) current.image.dataUrl = fullData;
          if (activeLightboxIndex === list.indexOf(current)) {
            lightboxImg.src = fullData;
            lightboxDlBtn.href = fullData;
          }
        }
      }
    }
  }

  window.closeLightbox = function() {
    lightbox.classList.remove('active');
  };

  window.changeLightbox = function(dir) {
    const list = currentLightboxList || activePost?.images || [];
    if (!list.length) return;
    const total = list.length;
    activeLightboxIndex = (activeLightboxIndex + dir + total) % total;
    updateLightboxContent();
  };

  window.copyCurrentLightboxImage = async function() {
    const list = currentLightboxList || activePost?.images || [];
    if (!list.length) return;
    const current = list[activeLightboxIndex];
    const dataUrl = current.dataUrl || (current.image && current.image.dataUrl);
    if (dataUrl) await copyImageToClipboard(dataUrl);
  };

  lightboxFavBtn?.addEventListener('click', async () => {
    const list = currentLightboxList || activePost?.images || [];
    if (!list.length) return;
    const item = list[activeLightboxIndex];
    const postId = item.postId || activePost?.id;
    const imgIdx = item.imageIndex !== undefined ? item.imageIndex : activeLightboxIndex;
    if (!postId) return;
    await toggleImageFavorite(postId, imgIdx);
    updateLightboxContent();
  });

  lightboxCloseBtn.addEventListener('click', window.closeLightbox);
  lightboxPrevBtn.addEventListener('click', () => window.changeLightbox(-1));
  lightboxNextBtn.addEventListener('click', () => window.changeLightbox(1));
  lightboxCopyBtn.addEventListener('click', window.copyCurrentLightboxImage);
  lightboxOpenLocationBtn?.addEventListener('click', async () => {
    const list = currentLightboxList || activePost?.images || [];
    if (!list.length) return;
    const item = list[activeLightboxIndex];
    if (!item) return;
    const postId = item.postId || activePost?.id;
    const imgIdx = item.imageIndex !== undefined ? item.imageIndex : activeLightboxIndex;
    const post = postId ? allPosts.find(p => p.id === postId) : activePost;
    const imageInfo = item.image || item;
    await openImageInFolderLocation(imageInfo, post, imgIdx);
  });
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) window.closeLightbox();
  });
  lightboxBody.addEventListener('click', event => event.stopPropagation());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeImageContextMenu();
      if (lightbox.classList.contains('active')) window.closeLightbox();
      return;
    }
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'ArrowLeft') window.changeLightbox(-1);
    if (e.key === 'ArrowRight') window.changeLightbox(1);
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
    if (!post) return;
    if (!post.images?.[0]?.dataUrl) {
      post = await DouyinDB.getPost(post.id) || post;
    }
    showToast('📦 Đang nén toàn bộ ảnh JPG và nội dung thành ZIP...');
    const zip = new JSZip();
    const imgFolder = zip.folder('images');

    // Add images
    for (let i = 0; i < (post.images || []).length; i++) {
      const item = post.images[i];
      if (item.dataUrl) {
        const base64Data = item.dataUrl.split(',')[1];
        imgFolder.file(item.filename || `photo_${i + 1}.jpg`, base64Data, { base64: true });
      }
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

    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (post.desc || 'douyin_post').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_').slice(0, 30);
    a.download = `[Offline]_${safeTitle}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
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

  // =========================================================================
  // ===== HƯỚNG A, B, C: KHO ẢNH TOÀN CỤC & TÌM KIẾM NHANH (GLOBAL GALLERY) =====
  // =========================================================================

  // ===== TAB SWITCHING =====
  function switchAppTab(tab) {
    currentAppTab = tab;
    if (tab === 'posts') {
      tabBtnPosts.classList.add('active');
      tabBtnGlobalPhotos.classList.remove('active');
      viewPostsPane.classList.remove('hidden');
      viewGlobalPhotosPane.classList.add('hidden');
    } else {
      tabBtnPosts.classList.remove('active');
      tabBtnGlobalPhotos.classList.add('active');
      viewPostsPane.classList.add('hidden');
      viewGlobalPhotosPane.classList.remove('hidden');
      renderGlobalTagCloud();
      renderGlobalPhotoGrid();
    }
  }

  tabBtnPosts.addEventListener('click', () => switchAppTab('posts'));
  tabBtnGlobalPhotos.addEventListener('click', () => switchAppTab('photos'));

  // ===== UPDATE GLOBAL COUNTS =====
  function updateGlobalCounts() {
    navCountPosts.innerText = allPosts.length;
    let totalPhotos = 0;
    let totalFav = 0;
    let totalTagged = 0;
    let totalUntagged = 0;

    allPosts.forEach(post => {
      (post.images || []).forEach(img => {
        totalPhotos++;
        if (img.favorite) totalFav++;
        if ((img.tags || []).length > 0) totalTagged++;
        else totalUntagged++;
      });
    });

    navCountGlobalPhotos.innerText = totalPhotos;
    globalCountAll.innerText = totalPhotos;
    globalCountFav.innerText = totalFav;
    globalCountTagged.innerText = totalTagged;
    globalCountUntagged.innerText = totalUntagged;
  }

  // ===== POPULATE GLOBAL POST FILTER =====
  function populateGlobalPostFilter() {
    const previous = globalSelectedPostId;
    let html = `<option value="all">Tất cả bài viết (${allPosts.length})</option>`;
    allPosts.forEach(post => {
      const title = (post.desc || post.author || 'Bài viết').replace(/\s+/g, ' ').slice(0, 32);
      const imgCount = (post.images || []).length;
      html += `<option value="${post.id}">@${escapeHtml(post.author || 'Tác giả')}: ${escapeHtml(title)} (${imgCount} ảnh)</option>`;
    });
    globalPostFilter.innerHTML = html;
    if (allPosts.some(p => p.id === previous)) {
      globalSelectedPostId = previous;
      globalPostFilter.value = previous;
    } else {
      globalSelectedPostId = 'all';
      globalPostFilter.value = 'all';
    }
  }

  // ===== HƯỚNG B: ĐÁM MÂY THẺ (TAG CLOUD & 1-CLICK FILTER) =====
  function renderGlobalTagCloud() {
    const tagCounts = new Map();
    let totalUsage = 0;

    allPosts.forEach(post => {
      (post.images || []).forEach(img => {
        (img.tags || []).forEach(tag => {
          const clean = String(tag || '').trim().toLowerCase();
          if (clean) {
            tagCounts.set(clean, (tagCounts.get(clean) || 0) + 1);
            totalUsage++;
          }
        });
      });
    });

    const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    tagCloudStats.innerText = `${sortedTags.length} tag (${totalUsage} lượt)`;

    if (globalActiveTag) {
      btnResetTagFilter.classList.remove('hidden');
      activeTagNameEl.innerText = `#${globalActiveTag}`;
    } else {
      btnResetTagFilter.classList.add('hidden');
    }

    if (sortedTags.length === 0) {
      globalTagCloudList.innerHTML = `<span style="font-size:11px;color:var(--text-muted);padding:4px 0">Chưa có tag nào trong kho. Hãy bấm vào từng ảnh hoặc dùng nút "🏷 Tag tất cả" để gắn hashtag!</span>`;
      return;
    }

    globalTagCloudList.innerHTML = sortedTags.map(([tag, count]) => {
      const isActive = globalActiveTag && globalActiveTag.toLowerCase() === tag.toLowerCase();
      return `
        <button type="button" class="cloud-tag-chip ${isActive ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
          #${escapeHtml(tag)} <span class="cloud-tag-count">(${count})</span>
        </button>
      `;
    }).join('');

    globalTagCloudList.querySelectorAll('.cloud-tag-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (globalActiveTag === tag) {
          globalActiveTag = '';
        } else {
          globalActiveTag = tag;
        }
        renderGlobalTagCloud();
        renderGlobalPhotoGrid();
      });
    });
  }

  btnResetTagFilter.addEventListener('click', () => {
    globalActiveTag = '';
    renderGlobalTagCloud();
    renderGlobalPhotoGrid();
  });

  // ===== HƯỚNG A: GET FILTERED GLOBAL IMAGES =====
  function getFilteredGlobalImages() {
    const list = [];
    allPosts.forEach(post => {
      const postProv = post.province || detectProvinceFromText((post.desc || '') + ' ' + (post.englishCaption || ''));
      (post.images || []).forEach((img, idx) => {
        list.push({
          postId: post.id,
          province: postProv,
          postAuthor: post.author || 'Tác giả',
          postTitle: post.desc || '',
          postAvatar: post.avatar || '../icons/icon48.png',
          postDate: formatPublishedDate(post),
          postTimestamp: getReliablePostTimestamp(post) || (post.savedAt ? Math.floor(post.savedAt / 1000) : 0),
          imageIndex: idx,
          image: img,
          key: `${post.id}__${idx}`
        });
      });
    });

    let filtered = list;

    // Filter by post
    if (globalSelectedPostId !== 'all') {
      filtered = filtered.filter(item => item.postId === globalSelectedPostId);
    }

    // Filter active province from Province Cloud (Thẻ tag to)
    if (globalActiveProvince) {
      if (globalActiveProvince === '__none__') {
        filtered = filtered.filter(item => !item.province);
      } else {
        const targetProv = globalActiveProvince.toLowerCase();
        filtered = filtered.filter(item => (item.province || '').toLowerCase() === targetProv);
      }
    }

    // Filter chips
    if (globalFilter === 'favorites') {
      filtered = filtered.filter(item => Boolean(item.image.favorite));
    } else if (globalFilter === 'has-tags') {
      filtered = filtered.filter(item => (item.image.tags || []).length > 0);
    } else if (globalFilter === 'no-tags') {
      filtered = filtered.filter(item => !(item.image.tags || []).length);
    }

    // Filter active tag from Tag Cloud
    if (globalActiveTag) {
      const targetTag = globalActiveTag.toLowerCase();
      filtered = filtered.filter(item => (item.image.tags || []).some(t => t.toLowerCase() === targetTag));
    }

    // Search query
    if (globalSearchQuery) {
      const q = globalSearchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const matchFile = (item.image.filename || '').toLowerCase().includes(q);
        const matchTags = (item.image.tags || []).some(t => t.toLowerCase().includes(q));
        const matchAuthor = (item.postAuthor || '').toLowerCase().includes(q);
        const matchTitle = (item.postTitle || '').toLowerCase().includes(q);
        const matchProv = (item.province || '').toLowerCase().includes(q);
        return matchFile || matchTags || matchAuthor || matchTitle || matchProv;
      });
    }

    // Sort
    if (globalSort === 'newest') {
      filtered.sort((a, b) => b.postTimestamp - a.postTimestamp || a.imageIndex - b.imageIndex);
    } else if (globalSort === 'oldest') {
      filtered.sort((a, b) => a.postTimestamp - b.postTimestamp || a.imageIndex - b.imageIndex);
    } else if (globalSort === 'favorite-first') {
      filtered.sort((a, b) => (b.image.favorite ? 1 : 0) - (a.image.favorite ? 1 : 0) || b.postTimestamp - a.postTimestamp);
    } else if (globalSort === 'most-tags') {
      filtered.sort((a, b) => ((b.image.tags || []).length) - ((a.image.tags || []).length));
    } else if (globalSort === 'name-asc') {
      filtered.sort((a, b) => (a.image.filename || '').localeCompare(b.image.filename || ''));
    }

    return filtered;
  }

  // ===== HƯỚNG A: RENDER GLOBAL PHOTO GRID =====
  let currentFilteredGlobalImages = [];

  function renderGlobalPhotoGrid() {
    const renderGen = ++globalRenderGeneration;
    if (globalImageObserver) globalImageObserver.disconnect();

    currentFilteredGlobalImages = getFilteredGlobalImages();
    const totalCount = currentFilteredGlobalImages.length;
    const uniquePostsCount = new Set(currentFilteredGlobalImages.map(item => item.postId)).size;

    globalVisibleCount.innerText = `Hiển thị ${totalCount} ảnh (từ ${uniquePostsCount} bài viết)`;

    if (totalCount === 0) {
      globalPhotoGrid.innerHTML = '';
      globalEmptyState.classList.remove('hidden');
      if (globalSearchQuery || globalActiveTag || globalFilter !== 'all' || globalSelectedPostId !== 'all') {
        globalEmptyMsg.innerText = 'Không có bức ảnh nào khớp với bộ lọc đang chọn. Thử bấm đặt lại bộ lọc bên dưới.';
      } else {
        globalEmptyMsg.innerText = 'Kho ảnh đang trống. Hãy dùng tiện ích để bóc tách và lưu các bài viết từ Douyin.';
      }
      syncGlobalBatchToolbar();
      return;
    }

    globalEmptyState.classList.add('hidden');
    globalPhotoGrid.innerHTML = '';

    const pendingSources = new WeakMap();
    globalImageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        const source = pendingSources.get(img);
        if (source) img.src = source;
        pendingSources.delete(img);
        observer.unobserve(img);
      });
    }, { rootMargin: '600px 0px' });

    let nextIndex = 0;
    const renderBatch = () => {
      if (renderGen !== globalRenderGeneration) return;

      const fragment = document.createDocumentFragment();
      const batchEnd = Math.min(nextIndex + 12, totalCount);

      for (; nextIndex < batchEnd; nextIndex++) {
        const item = currentFilteredGlobalImages[nextIndex];
        const { postId, imageIndex, image: imgObj, key } = item;
        const imgSrc = imgObj.thumbnailDataUrl || imgObj.dataUrl;
        const isSelected = selectedGlobalKeys.has(key);
        const isFav = Boolean(imgObj.favorite);

        const card = document.createElement('div');
        card.className = `global-photo-card ${isSelected ? 'selected' : ''}`;
        card.dataset.key = key;

        card.innerHTML = `
          <div class="global-card-thumb-wrap">
            <input type="checkbox" class="global-card-checkbox" ${isSelected ? 'checked' : ''} aria-label="Chọn ảnh">
            <button type="button" class="favorite-star-btn ${isFav ? 'favorited' : ''}" title="${isFav ? 'Bỏ yêu thích' : '⭐ Thêm vào ảnh yêu thích'}" aria-label="Yêu thích">⭐</button>
            ${item.province ? `<span class="global-card-province-badge" title="Lọc theo tỉnh thành: ${escapeHtml(item.province)}" data-province="${escapeHtml(item.province)}">📍 ${escapeHtml(item.province)}</span>` : ''}
            <img class="global-card-thumb" alt="${escapeHtml(imgObj.filename || `photo_${imageIndex + 1}.jpg`)}" loading="lazy" decoding="async" />
            <div class="global-card-actions-overlay">
              <button type="button" class="btn-card-action view-btn" title="Xem ảnh lớn">👁</button>
              <button type="button" class="btn-card-action tag-btn" title="Gắn tag">🏷</button>
              <button type="button" class="btn-card-action copy-btn" title="Sao chép ảnh">📋</button>
              <button type="button" class="btn-card-action open-loc-btn" title="Mở vị trí file trong thư mục">📂</button>
              <a class="btn-card-action dl-btn" href="#" download="${escapeHtml(imgObj.filename || `photo_${imageIndex + 1}.jpg`)}" title="Tải ảnh">⬇</a>
            </div>
          </div>
          <div class="global-card-tags">
            ${(imgObj.tags || []).slice(0, 3).map(t => `<span class="global-card-tag" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}
            ${(imgObj.tags || []).length > 3 ? `<span class="global-card-tag" title="${escapeHtml((imgObj.tags || []).map(t => `#${t}`).join(' '))}">+${imgObj.tags.length - 3}</span>` : ''}
          </div>
          <div class="global-card-meta">
            <div class="global-card-filename" title="${escapeHtml(imgObj.filename || `photo_${imageIndex + 1}.jpg`)}">${escapeHtml(imgObj.filename || `photo_${imageIndex + 1}.jpg`)}</div>
            <div class="global-card-source-row">
              <div class="global-card-author-info">
                <img class="global-card-avatar" src="${item.postAvatar}" alt="Avatar">
                <span class="global-card-author" title="@${escapeHtml(item.postAuthor)}: ${escapeHtml(item.postTitle)}">@${escapeHtml(item.postAuthor)}</span>
              </div>
              <button type="button" class="btn-jump-post" title="Chuyển sang Quản lý bài viết và mở bài này">🔗 Đến bài</button>
            </div>
          </div>
        `;

        const photo = card.querySelector('.global-card-thumb');
        pendingSources.set(photo, imgSrc);
        globalImageObserver.observe(photo);

        // Checkbox toggle
        const checkbox = card.querySelector('.global-card-checkbox');
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          setGlobalImageSelected(key, e.currentTarget.checked);
        });

        // Click on thumbnail toggle select or preview
        card.querySelector('.global-card-thumb-wrap').addEventListener('click', (e) => {
          if (e.target.closest('.favorite-star-btn') || e.target.closest('.global-card-actions-overlay') || e.target.closest('.global-card-checkbox') || e.target.closest('.global-card-province-badge')) return;
          const currentFilteredIdx = currentFilteredGlobalImages.findIndex(i => i.key === key);
          if (currentFilteredIdx !== -1) {
            openLightbox(currentFilteredIdx, currentFilteredGlobalImages);
          }
        });

        // Click on province badge -> filter by province
        const provBadge = card.querySelector('.global-card-province-badge');
        if (provBadge) {
          provBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            globalActiveProvince = item.province;
            renderGlobalProvinceCloud();
            renderGlobalPhotoGrid();
          });
        }

        // Star Favorite Button (Hướng C)
        const starBtn = card.querySelector('.favorite-star-btn');
        starBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleImageFavorite(postId, imageIndex);
        });

        // Overlay actions
        card.querySelector('.view-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          const currentFilteredIdx = currentFilteredGlobalImages.findIndex(i => i.key === key);
          if (currentFilteredIdx !== -1) {
            openLightbox(currentFilteredIdx, currentFilteredGlobalImages);
          }
        });

        card.querySelector('.tag-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          await editGlobalImageTags(postId, imageIndex);
        });

        card.querySelector('.copy-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          await copyImageToClipboard(imgSrc);
        });

        card.querySelector('.open-loc-btn')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          const post = allPosts.find(p => p.id === postId);
          await openImageInFolderLocation(imgObj, post, imageIndex);
        });

        card.querySelector('.dl-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          e.currentTarget.href = imgSrc;
        });

        // Context Menu on right click (Menu chuột phải)
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (!selectedGlobalKeys.has(key)) {
            setGlobalImageSelected(key, true);
          }
          openImageContextMenu(e.clientX, e.clientY, imageIndex, key);
        });

        // Tag click in card -> fast filter by tag (Hướng B)
        card.querySelectorAll('.global-card-tag[data-tag]').forEach(tagEl => {
          tagEl.addEventListener('click', (e) => {
            e.stopPropagation();
            globalActiveTag = tagEl.dataset.tag;
            renderGlobalTagCloud();
            renderGlobalPhotoGrid();
          });
        });

        // Jump to source post
        card.querySelector('.btn-jump-post').addEventListener('click', (e) => {
          e.stopPropagation();
          jumpToPost(postId);
        });

        fragment.appendChild(card);
      }

      globalPhotoGrid.appendChild(fragment);
      if (nextIndex < totalCount) requestAnimationFrame(renderBatch);
      else syncGlobalBatchToolbar();
    };

    renderBatch();
  }

  // ===== HƯỚNG C: TOGGLE FAVORITE =====
  async function toggleImageFavorite(postId, imageIndex) {
    const full = await DouyinDB.getPost(postId);
    if (!full || !full.images || !full.images[imageIndex]) return;

    const img = full.images[imageIndex];
    img.favorite = !img.favorite;

    await DouyinDB.savePost(full);

    const summaryPost = allPosts.find(p => p.id === postId);
    if (summaryPost && summaryPost.images && summaryPost.images[imageIndex]) {
      summaryPost.images[imageIndex].favorite = img.favorite;
    }

    if (activePost && activePost.id === postId) {
      activePost = full;
      renderImagesGrid(activePost.images || []);
    }

    updateGlobalCounts();

    if (currentAppTab === 'photos') {
      renderGlobalPhotoGrid();
    }

    showToast(img.favorite ? '⭐ Đã thêm vào ảnh yêu thích' : 'Đã bỏ yêu thích');
  }

  // ===== JUMP TO POST =====
  function jumpToPost(postId) {
    const targetPost = allPosts.find(p => p.id === postId);
    if (!targetPost) return;
    switchAppTab('posts');
    selectPost(targetPost);
    showToast(`📑 Đã mở bài viết của @${targetPost.author || 'Tác giả'}`);
  }

  // ===== EDIT TAGS FOR GLOBAL IMAGE =====
  async function editGlobalImageTags(postId, imageIndex) {
    const full = await DouyinDB.getPost(postId);
    if (!full || !full.images || !full.images[imageIndex]) return;
    const img = full.images[imageIndex];
    const current = (img.tags || []).map(t => `#${t}`).join(' ');
    const value = prompt('Paste danh sách hashtag cho bức ảnh này (bắt đầu bằng #):', current);
    if (value === null) return;
    img.tags = parseImageTags(value).slice(0, 200);
    await DouyinDB.savePost(full);

    const summaryPost = allPosts.find(p => p.id === postId);
    if (summaryPost && summaryPost.images && summaryPost.images[imageIndex]) {
      summaryPost.images[imageIndex].tags = img.tags;
    }

    if (activePost && activePost.id === postId) {
      activePost = full;
      renderImagesGrid(activePost.images || []);
    }
    renderGlobalTagCloud();
    renderGlobalPhotoGrid();
    renderSidebarList();
    showToast(`🏷️ Đã lưu ${img.tags.length} tag cho ảnh`);
  }

  // ===== GLOBAL SELECTION & BATCH ACTIONS (HƯỚNG C) =====
  function setGlobalImageSelected(key, isSelected) {
    if (isSelected) selectedGlobalKeys.add(key);
    else selectedGlobalKeys.delete(key);
    syncGlobalBatchToolbar();
    const card = globalPhotoGrid.querySelector(`.global-photo-card[data-key="${key}"]`);
    if (card) {
      card.classList.toggle('selected', isSelected);
      const cb = card.querySelector('.global-card-checkbox');
      if (cb) cb.checked = isSelected;
    }
  }

  function syncGlobalBatchToolbar() {
    const count = selectedGlobalKeys.size;
    globalSelectedCount.innerText = count ? `Đã chọn ${count} ảnh` : 'Chưa chọn ảnh';
    if (btnGlobalBatchFav) btnGlobalBatchFav.disabled = count === 0;
    if (btnGlobalBatchTag) btnGlobalBatchTag.disabled = count === 0;
    if (btnGlobalBatchRotLeft) btnGlobalBatchRotLeft.disabled = count === 0;
    if (btnGlobalBatchRotRight) btnGlobalBatchRotRight.disabled = count === 0;
    if (btnGlobalBatchOpenLocation) btnGlobalBatchOpenLocation.disabled = count === 0;
    if (btnGlobalBatchZip) btnGlobalBatchZip.disabled = count === 0;
    if (btnGlobalBatchDelete) btnGlobalBatchDelete.disabled = count === 0;
  }

  // ===== XOAY ẢNH TRONG KHO TOÀN CỤC =====
  async function rotateSelectedGlobalImages(degrees) {
    if (!selectedGlobalKeys.size) return;
    const count = selectedGlobalKeys.size;
    if (btnGlobalBatchRotLeft) btnGlobalBatchRotLeft.disabled = true;
    if (btnGlobalBatchRotRight) btnGlobalBatchRotRight.disabled = true;
    showToast(`Đang xoay ${count} ảnh ${degrees < 0 ? 'sang trái' : 'sang phải'}...`);

    try {
      const affectedPostMap = new Map();
      let currentIdx = 0;

      for (const key of selectedGlobalKeys) {
        currentIdx++;
        showToast(`Đang xoay ảnh ${currentIdx}/${count}...`);
        const [postId, idxStr] = key.split('__');
        const idx = Number(idxStr);
        if (!affectedPostMap.has(postId)) {
          const full = await DouyinDB.getPost(postId);
          if (full) affectedPostMap.set(postId, full);
        }
        const fullPost = affectedPostMap.get(postId);
        if (fullPost && fullPost.images && fullPost.images[idx]) {
          const img = fullPost.images[idx];
          img.dataUrl = await rotateImageDataUrl(img.dataUrl, degrees, 0.92);
          img.thumbnailDataUrl = await createPreviewImage(img.dataUrl, 0.68, 480);
        }
      }

      for (const [pid, fullPost] of affectedPostMap.entries()) {
        fullPost.thumbUrl = fullPost.images[0]?.thumbnailDataUrl || fullPost.images[0]?.dataUrl || '';
        await DouyinDB.savePost(fullPost);

        const summary = allPosts.find(item => item.id === pid);
        if (summary) {
          summary.thumbUrl = fullPost.thumbUrl;
          summary.images = (fullPost.images || []).map(im => ({
            filename: im.filename,
            tags: im.tags,
            favorite: im.favorite,
            thumbnailDataUrl: im.thumbnailDataUrl
          }));
        }
      }

      if (activePost && affectedPostMap.has(activePost.id)) {
        activePost = affectedPostMap.get(activePost.id);
        renderImagesGrid(activePost.images || []);
      }

      renderGlobalPhotoGrid();
      renderSidebarList();
      showToast(`✅ Đã xoay ${count} ảnh ${degrees < 0 ? 'sang trái' : 'sang phải'}`);
    } catch (error) {
      console.error('Lỗi xoay ảnh toàn cục:', error);
      showToast(`❌ Không thể xoay ảnh: ${error.message}`);
    } finally {
      syncGlobalBatchToolbar();
    }
  }

  // Đổi tên ảnh chọn trong kho toàn cục
  async function renameSelectedGlobalImages() {
    if (!selectedGlobalKeys.size) return;
    const value = prompt(`Tên gốc cho ${selectedGlobalKeys.size} ảnh. Ứng dụng tự thêm _01, _02...`, 'douyin_photo');
    if (value === null) return;
    const baseName = sanitizeImageFilename(value);
    if (!baseName) {
      showToast('❌ Tên ảnh không hợp lệ');
      return;
    }
    const modifiedPostIds = new Set();
    let order = 0;
    for (const key of selectedGlobalKeys) {
      order++;
      const [postId, idxStr] = key.split('__');
      const idx = Number(idxStr);
      const post = allPosts.find(p => p.id === postId);
      if (post && post.images && post.images[idx]) {
        post.images[idx].filename = `${baseName}_${String(order).padStart(2, '0')}.jpg`;
        modifiedPostIds.add(postId);
      }
    }
    for (const pid of modifiedPostIds) {
      const full = await DouyinDB.getPost(pid);
      const summary = allPosts.find(item => item.id === pid);
      if (full && summary) {
        (summary.images || []).forEach((sImg, sIdx) => {
          if (full.images?.[sIdx]) full.images[sIdx].filename = sImg.filename;
        });
        await DouyinDB.savePost(full);
      }
    }
    renderGlobalPhotoGrid();
    showToast(`✎ Đã đổi tên ${selectedGlobalKeys.size} ảnh`);
  }

  // Mở vị trí các ảnh chọn trong kho toàn cục
  async function openSelectedGlobalImagesInFolder() {
    if (!selectedGlobalKeys.size) return;
    const count = selectedGlobalKeys.size;
    const originalText = btnGlobalBatchOpenLocation ? btnGlobalBatchOpenLocation.innerText : '';
    if (btnGlobalBatchOpenLocation) {
      btnGlobalBatchOpenLocation.disabled = true;
      btnGlobalBatchOpenLocation.innerText = `Đang mở 0/${count}`;
    }
    try {
      let firstDownloadId = null;
      let pos = 0;
      for (const key of selectedGlobalKeys) {
        pos++;
        const [postId, idxStr] = key.split('__');
        const idx = Number(idxStr);
        const post = allPosts.find(p => p.id === postId);
        if (post && post.images && post.images[idx]) {
          const imageInfo = post.images[idx];
          if (btnGlobalBatchOpenLocation) btnGlobalBatchOpenLocation.innerText = `Đang mở ${pos}/${count}`;
          const id = await openImageInFolderLocation(imageInfo, post, idx);
          if (!firstDownloadId && id) firstDownloadId = id;
        }
      }
      if (firstDownloadId && chrome?.downloads?.show) {
        chrome.downloads.show(firstDownloadId);
      }
      showToast(`📂 Đã mở thư mục chứa ${count} ảnh`);
    } catch (error) {
      console.error('Mở thư mục ảnh chọn thất bại:', error);
      showToast(`❌ Không thể mở thư mục: ${error.message}`);
    } finally {
      if (btnGlobalBatchOpenLocation) btnGlobalBatchOpenLocation.innerText = originalText;
      syncGlobalBatchToolbar();
    }
  }

  btnGlobalBatchRotLeft?.addEventListener('click', () => rotateSelectedGlobalImages(-90));
  btnGlobalBatchRotRight?.addEventListener('click', () => rotateSelectedGlobalImages(90));
  btnGlobalBatchOpenLocation?.addEventListener('click', openSelectedGlobalImagesInFolder);

  btnGlobalSelectAll.addEventListener('click', () => {
    currentFilteredGlobalImages.forEach(item => selectedGlobalKeys.add(item.key));
    globalPhotoGrid.querySelectorAll('.global-photo-card').forEach(card => {
      card.classList.add('selected');
      const cb = card.querySelector('.global-card-checkbox');
      if (cb) cb.checked = true;
    });
    syncGlobalBatchToolbar();
  });

  btnGlobalDeselect.addEventListener('click', () => {
    selectedGlobalKeys.clear();
    globalPhotoGrid.querySelectorAll('.global-photo-card').forEach(card => {
      card.classList.remove('selected');
      const cb = card.querySelector('.global-card-checkbox');
      if (cb) cb.checked = false;
    });
    syncGlobalBatchToolbar();
  });

  // Batch Favorite
  btnGlobalBatchFav.addEventListener('click', async () => {
    if (!selectedGlobalKeys.size) return;
    const modifiedPostIds = new Set();

    selectedGlobalKeys.forEach(key => {
      const [postId, idxStr] = key.split('__');
      const idx = Number(idxStr);
      const post = allPosts.find(p => p.id === postId);
      if (post && post.images && post.images[idx]) {
        post.images[idx].favorite = true;
        modifiedPostIds.add(postId);
      }
    });

    for (const pid of modifiedPostIds) {
      const full = await DouyinDB.getPost(pid);
      const summary = allPosts.find(item => item.id === pid);
      if (full && summary) {
        (summary.images || []).forEach((sImg, sIdx) => {
          if (full.images?.[sIdx]) full.images[sIdx].favorite = sImg.favorite;
        });
        await DouyinDB.savePost(full);
      }
    }

    updateGlobalCounts();
    renderGlobalPhotoGrid();
    showToast(`⭐ Đã gắn yêu thích cho ${selectedGlobalKeys.size} ảnh`);
  });

  // Batch Tag
  btnGlobalBatchTag.addEventListener('click', async () => {
    if (!selectedGlobalKeys.size) return;
    const value = prompt(`Paste hashtag để gắn cho ${selectedGlobalKeys.size} ảnh đã chọn:`, '');
    if (value === null) return;
    const tags = parseImageTags(value).slice(0, 200);
    if (!tags.length) {
      showToast('❌ Không tìm thấy hashtag nào');
      return;
    }

    const modifiedPostIds = new Set();
    selectedGlobalKeys.forEach(key => {
      const [postId, idxStr] = key.split('__');
      const idx = Number(idxStr);
      const post = allPosts.find(p => p.id === postId);
      if (post && post.images && post.images[idx]) {
        post.images[idx].tags = [...new Set([...(post.images[idx].tags || []), ...tags])].slice(0, 200);
        modifiedPostIds.add(postId);
      }
    });

    for (const pid of modifiedPostIds) {
      const full = await DouyinDB.getPost(pid);
      const summary = allPosts.find(item => item.id === pid);
      if (full && summary) {
        (summary.images || []).forEach((sImg, sIdx) => {
          if (full.images?.[sIdx]) full.images[sIdx].tags = sImg.tags;
        });
        await DouyinDB.savePost(full);
      }
    }

    updateGlobalCounts();
    renderGlobalTagCloud();
    renderGlobalPhotoGrid();
    renderSidebarList();
    showToast(`🏷️ Đã gắn ${tags.length} tag cho ${selectedGlobalKeys.size} ảnh`);
  });

  // Batch ZIP Download
  btnGlobalBatchZip.addEventListener('click', async () => {
    if (!selectedGlobalKeys.size) return;
    showToast(`📦 Đang nén ${selectedGlobalKeys.size} ảnh đã chọn thành file ZIP...`);
    const zip = new JSZip();
    let count = 0;
    const postCache = new Map();

    for (const key of selectedGlobalKeys) {
      const [postId, idxStr] = key.split('__');
      const idx = Number(idxStr);
      if (!postCache.has(postId)) {
        const full = await DouyinDB.getPost(postId);
        if (full) postCache.set(postId, full);
      }
      const post = postCache.get(postId);
      if (post && post.images && post.images[idx]) {
        const imgObj = post.images[idx];
        const base64Data = (imgObj.dataUrl || '').split(',')[1];
        if (base64Data) {
          const filename = imgObj.filename || `photo_${count + 1}.jpg`;
          zip.file(filename, base64Data, { base64: true });
          count++;
        }
      }
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `[Douyin_Selected_${count}_Photos].zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast(`✅ Đã tải xong ZIP chứa ${count} ảnh!`);
  });

  // Batch Delete
  btnGlobalBatchDelete.addEventListener('click', async () => {
    if (!selectedGlobalKeys.size) return;
    if (!confirm(`XÓA ${selectedGlobalKeys.size} ẢNH ĐÃ CHỌN?\n\nẢnh sẽ bị gỡ bỏ khỏi các bài viết tương ứng trong kho offline.`)) return;

    // Group indexes by postId in descending order so splicing works properly
    const postMap = new Map();
    selectedGlobalKeys.forEach(key => {
      const [postId, idxStr] = key.split('__');
      const idx = Number(idxStr);
      if (!postMap.has(postId)) postMap.set(postId, []);
      postMap.get(postId).push(idx);
    });

    for (const [postId, indexes] of postMap.entries()) {
      const full = await DouyinDB.getPost(postId);
      if (full && full.images) {
        indexes.sort((a, b) => b - a).forEach(idx => {
          full.images.splice(idx, 1);
        });
        full.thumbUrl = full.images[0]?.thumbnailDataUrl || full.images[0]?.dataUrl || '';
        await DouyinDB.savePost(full);
      }
    }

    selectedGlobalKeys.clear();
    await refreshPostsList();
    if (activePost) {
      const updated = allPosts.find(p => p.id === activePost.id);
      if (updated) selectPost(updated);
    }
    showToast('🗑️ Đã xóa các ảnh được chọn khỏi kho');
  });

  // ===== FILTER & SEARCH LISTENERS =====
  provinceFilter?.addEventListener('change', () => {
    selectedProvince = provinceFilter.value;
    renderSidebarList();
  });

  btnEditProvince?.addEventListener('click', () => {
    if (activePost) editPostProvince(activePost);
  });

  btnGlobalBatchProvince?.addEventListener('click', async () => {
    await setBatchProvinceForSelected();
  });

  globalSearchInput.addEventListener('input', () => {
    globalSearchQuery = globalSearchInput.value.trim();
    btnClearGlobalSearch.classList.toggle('hidden', !globalSearchQuery);
    renderGlobalPhotoGrid();
  });

  btnClearGlobalSearch.addEventListener('click', () => {
    globalSearchInput.value = '';
    globalSearchQuery = '';
    btnClearGlobalSearch.classList.add('hidden');
    renderGlobalPhotoGrid();
  });

  globalChips.forEach(chip => {
    chip.addEventListener('click', () => {
      globalChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      globalFilter = chip.dataset.filter;
      renderGlobalPhotoGrid();
    });
  });

  globalPostFilter.addEventListener('change', () => {
    globalSelectedPostId = globalPostFilter.value;
    renderGlobalPhotoGrid();
  });

  globalSortSelect.addEventListener('change', () => {
    globalSort = globalSortSelect.value;
    renderGlobalPhotoGrid();
  });

  btnResetGlobalFilters.addEventListener('click', () => {
    globalSearchInput.value = '';
    globalSearchQuery = '';
    btnClearGlobalSearch.classList.add('hidden');
    globalActiveProvince = '';
    globalActiveTag = '';
    globalFilter = 'all';
    globalChips.forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
    globalSelectedPostId = 'all';
    globalPostFilter.value = 'all';
    globalSort = 'newest';
    globalSortSelect.value = 'newest';
    renderGlobalProvinceCloud();
    renderGlobalTagCloud();
    renderGlobalPhotoGrid();
  });

  // =========================================================================
  // ===== THẺ TAG TO: LOGIC PHÂN LOẠI TỈNH THÀNH / KHU VỰC =====
  // =========================================================================
  const POPULAR_PROVINCES = [
    'Phú Quốc', 'Đà Nẵng', 'Đà Lạt', 'Nha Trang', 'Hạ Long',
    'Sapa', 'Hội An', 'Ninh Bình', 'Hà Giang', 'Quy Nhơn',
    'Vũng Tàu', 'Phan Thiết', 'Huế', 'Cát Bà', 'Hà Nội',
    'TP. Hồ Chí Minh', 'Miền Tây', 'Tây Bắc', 'Quốc tế'
  ];

  function detectProvinceFromText(text) {
    if (!text) return '';
    const lower = text.toLowerCase();
    const map = [
      { key: 'Phú Quốc', patterns: ['phú quốc', 'phu quoc', '富国', 'hòn thơm', 'an thới', 'bãi sao', 'hàm ninh', 'sunset town', 'cáp treo hòn thơm'] },
      { key: 'Kiên Giang', patterns: ['kiên giang', 'kien giang', 'nam du', 'rạch giá', 'hà tiên'] },
      { key: 'Đà Lạt', patterns: ['đà lạt', 'da lat', 'dalat', '大叻', 'lâm đồng', 'tuyền lâm', 'langbiang'] },
      { key: 'Đà Nẵng', patterns: ['đà nẵng', 'da nang', 'danang', '岘港', 'bà nà', 'bana hills', 'cầu vàng', 'sơn trà', 'ngũ hành sơn'] },
      { key: 'Nha Trang', patterns: ['nha trang', 'nhatrang', '芽庄', 'khánh hòa', 'hòn tằm', 'bình hưng', 'bình ba', 'cam ranh'] },
      { key: 'Sapa', patterns: ['sapa', 'sa pa', '沙坝', 'fansipan', 'fansipang', 'lào cai', 'ô quy hồ', 'mù cang chải'] },
      { key: 'Hạ Long', patterns: ['hạ long', 'ha long', 'halong', '下龙', 'quảng ninh', 'bái đính', 'vân đồn', 'cô tô'] },
      { key: 'Hội An', patterns: ['hội an', 'hoi an', 'hoian', '会安', 'quảng nam', 'chùa cầu', 'cù lao chàm'] },
      { key: 'Ninh Bình', patterns: ['ninh bình', 'ninh binh', 'tràng an', 'tam cốc', 'bích động', 'hang múa', 'bái đính', '宁平'] },
      { key: 'Hà Giang', patterns: ['hà giang', 'ha giang', 'mã pí lèng', 'đồng văn', 'lũng cú', 'sông nho quế', 'hoàng su phì', '河江'] },
      { key: 'Quy Nhơn', patterns: ['quy nhơn', 'quy nhon', 'bình định', 'kỳ co', 'eo gió', 'cù lao xanh', '归仁'] },
      { key: 'Vũng Tàu', patterns: ['vũng tàu', 'vung tau', 'bà rịa', 'côn đảo', 'hồ tràm', 'long hải', '头顿'] },
      { key: 'Phan Thiết', patterns: ['phan thiết', 'mũi né', 'mui ne', 'bình thuận', 'đồi cát bay', 'bàu trắng', '潘切', '美奈'] },
      { key: 'Huế', patterns: ['huế', 'thừa thiên', 'đại nội', 'sông hương', 'lăng khải định', 'lăng cô', '顺化'] },
      { key: 'Cát Bà', patterns: ['cát bà', 'cat ba', 'lan hạ', 'hải phòng', '吉婆', '海防'] },
      { key: 'Hà Nội', patterns: ['hà nội', 'ha noi', 'hanoi', 'hồ gươm', 'phố cổ', 'ba đình', 'tây hồ', '河内'] },
      { key: 'TP. Hồ Chí Minh', patterns: ['hồ chí minh', 'sài gòn', 'saigon', 'hcm', 'quận 1', 'thủ đức', 'bến thành', '胡志明'] },
      { key: 'Miền Tây', patterns: ['cần thơ', 'bến tre', 'an giang', 'châu đốc', 'đồng tháp', 'tiền giang', 'cà mau', 'miền tây'] },
      { key: 'Tây Bắc', patterns: ['mộc châu', 'sơn la', 'điện biên', 'lai châu', 'yên bái', 'tây bắc'] },
      { key: 'Quốc tế', patterns: ['trung quốc', 'thái lan', 'băng cốc', 'hàn quốc', 'nhật bản', 'singapore', 'bali', 'malaysia', 'dubai', 'china', 'thailand', 'japan', 'korea'] }
    ];
    for (const item of map) {
      if (item.patterns.some(p => lower.includes(p))) return item.key;
    }
    return '';
  }

  function updateProvinceBadge() {
    if (!activePost || !viewProvinceBadge) return;
    const prov = activePost.province || '';
    viewProvinceBadge.innerText = prov ? `📍 ${prov}` : '📍 Chưa gắn tỉnh';
  }

  function populateProvinceFilter() {
    if (!provinceFilter) return;
    const previous = selectedProvince;
    const provinces = new Map();

    allPosts.forEach(post => {
      const p = post.province || detectProvinceFromText(post.desc + ' ' + (post.englishCaption || ''));
      if (p) provinces.set(p, (provinces.get(p) || 0) + 1);
    });

    let html = `<option value="all">📍 Tất cả tỉnh thành (${allPosts.length})</option>`;
    [...provinces.entries()].sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
      html += `<option value="${escapeHtml(name)}">📍 ${escapeHtml(name)} (${count} bài)</option>`;
    });
    html += `<option value="__none__">📍 Chưa phân loại</option>`;

    provinceFilter.innerHTML = html;
    if (provinces.has(previous) || previous === '__none__') {
      selectedProvince = previous;
      provinceFilter.value = previous;
    } else {
      selectedProvince = 'all';
      provinceFilter.value = 'all';
    }
  }

  function renderGlobalProvinceCloud() {
    const provCounts = new Map();
    let unassignedCount = 0;

    allPosts.forEach(post => {
      const pName = post.province || detectProvinceFromText(post.desc + ' ' + (post.englishCaption || ''));
      const imgLen = (post.images || []).length;
      if (pName) {
        provCounts.set(pName, (provCounts.get(pName) || 0) + imgLen);
      } else {
        unassignedCount += imgLen;
      }
    });

    const sorted = [...provCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (unassignedCount > 0) {
      sorted.push(['Chưa phân loại', unassignedCount]);
    }

    if (provinceCloudStats) {
      provinceCloudStats.innerText = `${provCounts.size} tỉnh thành`;
    }

    if (globalActiveProvince) {
      btnResetProvinceFilter?.classList.remove('hidden');
      if (activeProvinceNameEl) {
        activeProvinceNameEl.innerText = globalActiveProvince === '__none__' ? 'Chưa phân loại' : globalActiveProvince;
      }
    } else {
      btnResetProvinceFilter?.classList.add('hidden');
    }

    if (!globalProvinceCloud) return;

    if (sorted.length === 0) {
      globalProvinceCloud.innerHTML = `<span style="font-size:11px;color:var(--text-muted);padding:4px 0">Chưa có tỉnh thành nào. Bấm "📍 Gắn tỉnh thành" để phân loại khu vực dễ dàng!</span>`;
      return;
    }

    globalProvinceCloud.innerHTML = sorted.map(([name, count]) => {
      const isNone = name === 'Chưa phân loại';
      const isActive = globalActiveProvince && (isNone ? globalActiveProvince === '__none__' : globalActiveProvince.toLowerCase() === name.toLowerCase());
      return `
        <button type="button" class="cloud-province-chip ${isActive ? 'active' : ''}" data-province="${escapeHtml(isNone ? '__none__' : name)}">
          📍 ${escapeHtml(name)} <span class="cloud-province-count">${count} ảnh</span>
        </button>
      `;
    }).join('');

    globalProvinceCloud.querySelectorAll('.cloud-province-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const prov = btn.dataset.province;
        if (globalActiveProvince === prov) {
          globalActiveProvince = '';
        } else {
          globalActiveProvince = prov;
        }
        renderGlobalProvinceCloud();
        renderGlobalPhotoGrid();
      });
    });
  }

  btnResetProvinceFilter?.addEventListener('click', () => {
    globalActiveProvince = '';
    renderGlobalProvinceCloud();
    renderGlobalPhotoGrid();
  });

  async function editPostProvince(post) {
    if (!post) return;
    const detected = detectProvinceFromText(post.desc + ' ' + (post.englishCaption || ''));
    const current = post.province || detected;
    const promptMsg = `Nhập Tỉnh thành / Khu vực cho bài viết này:\nGợi ý: ${POPULAR_PROVINCES.slice(0, 10).join(', ')}...`;
    const value = prompt(promptMsg, current || '');
    if (value === null) return;
    const clean = value.trim();
    post.province = clean;
    const full = await DouyinDB.getPost(post.id);
    if (full) {
      full.province = clean;
      await DouyinDB.savePost(full);
    }
    updateProvinceBadge();
    populateProvinceFilter();
    renderGlobalProvinceCloud();
    renderSidebarList();
    if (currentAppTab === 'photos') renderGlobalPhotoGrid();
    showToast(clean ? `📍 Đã gán tỉnh thành: ${clean}` : 'Đã xóa thẻ tỉnh thành');
  }

  async function setBatchProvinceForSelected(provinceName = null) {
    if (!selectedGlobalKeys.size) return;
    let target = provinceName;
    if (target === null) {
      const promptMsg = `Nhập Tỉnh thành / Khu vực cho ${selectedGlobalKeys.size} ảnh đã chọn:\nGợi ý: ${POPULAR_PROVINCES.slice(0, 10).join(', ')}...`;
      const input = prompt(promptMsg, '');
      if (input === null) return;
      target = input.trim();
    }

    const affectedPostIds = new Set();
    selectedGlobalKeys.forEach(key => {
      const [postId] = key.split('__');
      affectedPostIds.add(postId);
    });

    for (const pid of affectedPostIds) {
      const post = allPosts.find(p => p.id === pid);
      if (post) post.province = target;
      const full = await DouyinDB.getPost(pid);
      if (full) {
        full.province = target;
        await DouyinDB.savePost(full);
      }
    }

    if (activePost && affectedPostIds.has(activePost.id)) {
      activePost.province = target;
      updateProvinceBadge();
    }

    populateProvinceFilter();
    renderGlobalProvinceCloud();
    renderSidebarList();
    renderGlobalPhotoGrid();
    showToast(target ? `📍 Đã gán "${target}" cho các bài viết đã chọn` : 'Đã xóa thẻ tỉnh thành');
  }
});
