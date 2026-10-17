// Persistent user-selected folder support using the File System Access API.
const DouyinFiles = {
  SETTING_KEY: 'offlineDirectoryHandle',
  _handle: null,

  async chooseDirectory() {
    if (!window.showDirectoryPicker) {
      throw new Error('Trình duyệt chưa hỗ trợ chọn thư mục. Hãy dùng Chrome hoặc Edge mới nhất.');
    }
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'douyin-offline-library' });
    await DouyinDB.setSetting(this.SETTING_KEY, handle);
    this._handle = handle;
    return handle;
  },

  async getDirectoryHandle(requestPermission = false) {
    const handle = this._handle || await DouyinDB.getSetting(this.SETTING_KEY);
    if (!handle) return null;
    this._handle = handle;
    try {
      let permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted' && requestPermission) {
        permission = await handle.requestPermission({ mode: 'readwrite' });
      }
      return permission === 'granted' ? handle : null;
    } catch (err) {
      // Catch SecurityError if requestPermission called without user gesture
      return null;
    }
  },

  async getDirectoryInfo() {
    const handle = this._handle || await DouyinDB.getSetting(this.SETTING_KEY);
    if (!handle) return { configured: false, name: '', permission: 'prompt' };
    this._handle = handle;
    return { configured: true, name: handle.name, permission: await handle.queryPermission({ mode: 'readwrite' }) };
  },

  async getLibraryDir(root, create = false) {
    if (!root) return null;
    if (root.name && root.name.toLowerCase() === 'douyin_offline') {
      return root;
    }
    try {
      return await root.getDirectoryHandle('Douyin_Offline', { create });
    } catch (err) {
      if (create) throw err;
      return null;
    }
  },

  async savePost(post, options = {}) {
    const root = await this.getDirectoryHandle(Boolean(options.requestPermission));
    if (!root) throw new Error('Chưa chọn thư mục hoặc Chrome cần bạn cấp lại quyền ghi.');
    const libraryDir = await this.getLibraryDir(root, true);
    const folderName = await this.findPostFolderName(libraryDir, post) || this.getPostFolderName(post);
    const postDir = await libraryDir.getDirectoryHandle(folderName, { create: true });
    const imagesDir = await postDir.getDirectoryHandle('images', { create: true });
    const expectedFiles = new Set((post.images || []).map((image, index) =>
      this.safeName(image.filename || `photo_${String(index + 1).padStart(2, '0')}.jpg`, 80)
    ));

    // Keep the managed folder consistent after an image is deleted in Studio.
    const toDelete = [];
    for await (const [name, handle] of imagesDir.entries()) {
      if (handle.kind === 'file' && !expectedFiles.has(name) && /\.(jpe?g|png|webp|heic)$/i.test(name)) {
        toDelete.push(name);
      }
    }
    for (const name of toDelete) {
      try {
        await imagesDir.removeEntry(name);
      } catch (err) {
        console.warn(`Không thể xóa file ${name} trên đĩa:`, err?.name ? `${err.name}: ${err.message}` : (err?.message || err));
      }
    }

    for (let index = 0; index < (post.images || []).length; index++) {
      const image = post.images[index];
      const fileName = this.safeName(image.filename || `photo_${String(index + 1).padStart(2, '0')}.jpg`, 80);
      if (image.dataUrl && (image.dataUrl.startsWith('data:') || image.dataUrl.startsWith('blob:'))) {
        await this.writeDataUrl(imagesDir, fileName, image.dataUrl);
      }
    }
    await this.writeText(postDir, 'caption_facebook.txt', post.englishCaption || '');
    await this.writeText(postDir, 'caption_original.txt', post.desc || '');
    await this.writeText(postDir, 'notes.txt', post.notes || '');
    await this.writeText(postDir, 'metadata.json', JSON.stringify({
      id: post.id,
      author: post.author || '',
      publishedAt: post.createTime || '',
      publishedTimestamp: post.createTimestamp || 0,
      publishDateManual: Boolean(post.publishDateManual),
      sourceUrl: post.sourceUrl || post.url || '',
      notes: post.notes || '',
      status: post.status || 'pending',
      imageProcessed: Boolean(post.imageProcessed),
      folderName: post.folderName || folderName,
      exportedAt: new Date().toISOString(),
      images: (post.images || []).map((image, index) => ({
        filename: image.filename || `photo_${String(index + 1).padStart(2, '0')}.jpg`,
        tags: image.tags || []
      }))
    }, null, 2));
    const prefix = root.name.toLowerCase() === 'douyin_offline' ? root.name : `${root.name}/Douyin_Offline`;
    return `${prefix}/${folderName}`;
  },

  async syncAll(posts, options = {}) {
    const paths = [];
    for (const post of posts) paths.push(await this.savePost(post, options));
    return paths;
  },

  async collectPostDirectories(root, libraryDir) {
    const postDirs = [];
    const seenNames = new Set();

    const scanDir = async (dirHandle, isLibrary = true) => {
      if (!dirHandle) return;
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind !== 'directory') continue;
        if (name.toLowerCase() === 'douyin_offline') {
          // Nested Douyin_Offline folder -> traverse inside recursively
          await scanDir(handle, true);
          continue;
        }
        if (seenNames.has(name)) continue;

        let isPost = false;
        try {
          await handle.getFileHandle('metadata.json');
          isPost = true;
        } catch (_) {
          try {
            await handle.getDirectoryHandle('images');
            isPost = true;
          } catch (_) {
            for await (const [fileName, fileHandle] of handle.entries()) {
              if (fileHandle.kind === 'file' && /\.(jpe?g|png|webp|heic)$/i.test(fileName)) {
                isPost = true;
                break;
              }
            }
          }
        }

        if (isPost) {
          seenNames.add(name);
          postDirs.push({ folderName: name, handle });
        }
      }
    };

    if (libraryDir) {
      await scanDir(libraryDir, true);
    }
    if (root && root !== libraryDir) {
      await scanDir(root, false);
    }

    return postDirs;
  },

  async readPostFromDirectory(handle, folderName) {
    let metadata = null;
    try {
      const metaText = await this.readText(handle, 'metadata.json');
      metadata = JSON.parse(metaText);
    } catch (_) {
      metadata = null;
    }

    let imagesDir = null;
    try {
      imagesDir = await handle.getDirectoryHandle('images');
    } catch (_) {
      imagesDir = handle;
    }

    const images = [];
    const processedFiles = new Set();

    if (metadata && Array.isArray(metadata.images)) {
      for (const imageInfo of metadata.images) {
        if (!imageInfo || !imageInfo.filename) continue;
        try {
          const dataUrl = await this.readDataUrl(imagesDir, imageInfo.filename);
          images.push({
            filename: imageInfo.filename,
            dataUrl,
            tags: Array.isArray(imageInfo.tags) ? imageInfo.tags : []
          });
          processedFiles.add(imageInfo.filename.toLowerCase());
        } catch (error) {
          if (error.name !== 'NotFoundError') {
            console.warn('Bỏ qua ảnh không đọc được trong metadata:', imageInfo.filename, error?.message || error);
          }
        }
      }
    }

    try {
      const diskImages = [];
      for await (const [fileName, fileHandle] of imagesDir.entries()) {
        if (fileHandle.kind === 'file' && /\.(jpe?g|png|webp|heic)$/i.test(fileName)) {
          if (!processedFiles.has(fileName.toLowerCase())) {
            diskImages.push(fileName);
          }
        }
      }
      diskImages.sort();
      for (const fileName of diskImages) {
        try {
          const dataUrl = await this.readDataUrl(imagesDir, fileName);
          images.push({
            filename: fileName,
            dataUrl,
            tags: []
          });
          processedFiles.add(fileName.toLowerCase());
        } catch (err) {
          console.warn('Bỏ qua file ảnh lỗi:', fileName, err);
        }
      }
    } catch (err) {
      console.warn('Lỗi đọc danh sách file ảnh:', folderName, err);
    }

    if (images.length === 0) {
      return null;
    }

    let fallbackDate = '';
    let fallbackTimestamp = 0;
    let fallbackAuthor = 'Tác giả';
    let fallbackId = folderName;

    const folderMatch = folderName.match(/^(\d{4}-\d{2}-\d{2})_(@?[^_]+)_(.+)$/);
    if (folderMatch) {
      fallbackDate = folderMatch[1];
      fallbackTimestamp = Date.parse(folderMatch[1]) || 0;
      fallbackAuthor = folderMatch[2];
      fallbackId = folderMatch[3];
    } else {
      fallbackAuthor = folderName.replace(/[-_]/g, ' ');
    }

    const coverThumb = images[0] ? await this.createThumbnail(images[0].dataUrl, 360, 0.65) : '';
    if (images[0] && coverThumb) {
      images[0].thumbnailDataUrl = coverThumb;
    }

    return {
      id: String(metadata?.id || fallbackId || folderName),
      author: metadata?.author || fallbackAuthor,
      authorId: metadata?.authorId || '',
      avatar: '',
      createTime: metadata?.publishedAt || fallbackDate || 'Không xác định',
      createTimestamp: metadata?.publishedTimestamp || fallbackTimestamp || 0,
      publishDateManual: Boolean(metadata?.publishDateManual),
      desc: (await this.readText(handle, 'caption_original.txt', true)) || (metadata?.desc || folderName),
      notes: (await this.readText(handle, 'notes.txt', true)) || metadata?.notes || '',
      englishCaption: (await this.readText(handle, 'caption_facebook.txt', true)) || '',
      sourceUrl: metadata?.sourceUrl || '',
      folderName: metadata?.folderName || folderName,
      images,
      thumbUrl: coverThumb || '',
      status: metadata?.status || 'pending',
      imageProcessed: Boolean(metadata?.imageProcessed),
      savedAt: Date.parse(metadata?.exportedAt || '') || Date.now()
    };
  },

  async createThumbnail(dataUrl, maxDimension = 360, quality = 0.65) {
    if (!dataUrl || typeof Image === 'undefined') return '';
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const sw = img.naturalWidth || img.width;
          const sh = img.naturalHeight || img.height;
          const scale = Math.min(1, maxDimension / Math.max(sw, sh));
          canvas.width = Math.max(1, Math.round(sw * scale));
          canvas.height = Math.max(1, Math.round(sh * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL('image/jpeg', quality);
          canvas.width = 0;
          canvas.height = 0;
          img.src = '';
          resolve(thumb);
        } catch (_) {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = dataUrl;
    });
  },

  async importAllStreaming(options = {}) {
    const root = await this.getDirectoryHandle(Boolean(options.requestPermission));
    if (!root) throw new Error('Hãy chọn lại thư mục chứa ảnh hoặc Douyin_Offline.');

    const libraryDir = await this.getLibraryDir(root, false);
    const postDirs = await this.collectPostDirectories(root, libraryDir);
    const total = postDirs.length;
    let successCount = 0;
    let imageCount = 0;

    for (let i = 0; i < postDirs.length; i++) {
      const { folderName, handle } = postDirs[i];
      if (options.onProgress) {
        options.onProgress({
          stage: 'reading',
          current: i + 1,
          total,
          folderName,
          successCount,
          imageCount
        });
      }

      try {
        let post = await this.readPostFromDirectory(handle, folderName);
        if (post && post.images && post.images.length > 0) {
          if (options.onPost) {
            await options.onPost(post, i + 1, total);
          }
          successCount++;
          imageCount += post.images.length;
        }
        post = null;
      } catch (err) {
        console.warn(`Bỏ qua thư mục ${folderName}:`, err);
      }

      // Allow browser UI paint & garbage collection
      await new Promise(resolve => setTimeout(resolve, 25));
    }

    return { total, successCount, imageCount };
  },

  async importAll(options = {}) {
    const posts = [];
    await this.importAllStreaming({
      ...options,
      onPost: async (post) => {
        posts.push(post);
      }
    });
    return posts;
  },

  async deletePostFolder(post, options = {}) {
    const root = await this.getDirectoryHandle(Boolean(options.requestPermission));
    if (!root) return false;
    try {
      const libraryDir = await this.getLibraryDir(root, false) || root;
      const folderName = await this.findPostFolderName(libraryDir, post);
      if (!folderName) return false;
      await libraryDir.removeEntry(folderName, { recursive: true });
      return true;
    } catch (error) {
      if (error.name === 'NotFoundError') return false;
      throw error;
    }
  },

  async writeDataUrl(directory, name, dataUrl) {
    if (!dataUrl) return;
    try {
      const response = await fetch(dataUrl);
      const file = await directory.getFileHandle(name, { create: true });
      const writable = await file.createWritable();
      await writable.write(await response.blob());
      await writable.close();
    } catch (err) {
      console.warn(`Lỗi ghi file ảnh ${name}:`, err?.message || err);
    }
  },

  async writeText(directory, name, text) {
    try {
      const file = await directory.getFileHandle(name, { create: true });
      const writable = await file.createWritable();
      await writable.write(text);
      await writable.close();
    } catch (err) {
      console.warn(`Lỗi ghi file ${name}:`, err?.name ? `${err.name}: ${err.message}` : (err?.message || err));
    }
  },

  async readText(directory, name, optional = false) {
    try {
      const handle = await directory.getFileHandle(name);
      return await (await handle.getFile()).text();
    } catch (error) {
      if (optional) return '';
      throw error;
    }
  },

  async readDataUrl(directory, name) {
    const handle = await directory.getFileHandle(name);
    const file = await handle.getFile();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  safeName(value, maxLength) {
    return String(value || 'untitled').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/[. ]+$/g, '').replace(/\s+/g, '_').slice(0, maxLength) || 'untitled';
  },

  getPostFolderName(post) {
    if (post && post.folderName) return this.safeName(post.folderName, 90);
    const date = this.formatDate(post?.createTimestamp || post?.savedAt);
    return this.safeName(`${date}_${post?.author || 'douyin'}_${post?.id || ''}`, 90);
  },

  async findPostFolderName(libraryDir, post) {
    if (!post || !libraryDir) return null;
    const expected = this.getPostFolderName(post);
    const cleanId = String(post.id || '').replace(/^wb_/, '');
    const idSuffix = post?.id ? `_${this.safeName(post.id, 90)}` : null;
    const customExpected = post?.folderName ? this.safeName(post.folderName, 90) : null;
    for await (const [name, handle] of libraryDir.entries()) {
      if (handle.kind === 'directory') {
        if (name === expected || (customExpected && name === customExpected)) {
          return name;
        }
        if (idSuffix && name.endsWith(idSuffix)) {
          return name;
        }
        if (post.id && (name.includes(post.id) || (cleanId && name.includes(cleanId)))) {
          return name;
        }
      }
    }
    return null;
  },

  async renamePostFolder(post, newFolderName, options = {}) {
    const root = await this.getDirectoryHandle(Boolean(options.requestPermission));
    if (!root) return false;
    try {
      const libraryDir = await this.getLibraryDir(root, true);
      const oldFolderName = await this.findPostFolderName(libraryDir, post);
      const safeNewName = this.safeName(newFolderName, 90);
      if (!safeNewName) throw new Error('Tên thư mục không hợp lệ');

      if (oldFolderName && oldFolderName !== safeNewName) {
        // Save post under new folder name
        const updatedPost = { ...post, folderName: safeNewName };
        await this.savePost(updatedPost, options);
        // Remove old folder entry
        try {
          await libraryDir.removeEntry(oldFolderName, { recursive: true });
        } catch (rmErr) {
          console.warn('Không thể xóa thư mục cũ sau khi đổi tên:', oldFolderName, rmErr);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Lỗi đổi tên thư mục trên đĩa:', error);
      return false;
    }
  },

  formatDate(timestamp) {
    const numeric = Number(timestamp);
    const millis = numeric > 0 ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.now();
    const date = new Date(millis);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
};

if (typeof window !== 'undefined') window.DouyinFiles = DouyinFiles;
