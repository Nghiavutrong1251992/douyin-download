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
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted' && requestPermission) {
      permission = await handle.requestPermission({ mode: 'readwrite' });
    }
    return permission === 'granted' ? handle : null;
  },

  async getDirectoryInfo() {
    const handle = this._handle || await DouyinDB.getSetting(this.SETTING_KEY);
    if (!handle) return { configured: false, name: '', permission: 'prompt' };
    this._handle = handle;
    return { configured: true, name: handle.name, permission: await handle.queryPermission({ mode: 'readwrite' }) };
  },

  async savePost(post, options = {}) {
    const root = await this.getDirectoryHandle(Boolean(options.requestPermission));
    if (!root) throw new Error('Chưa chọn thư mục hoặc Chrome cần bạn cấp lại quyền ghi.');
    const libraryDir = await root.getDirectoryHandle('Douyin_Offline', { create: true });
    const folderName = await this.findPostFolderName(libraryDir, post) || this.getPostFolderName(post);
    const postDir = await libraryDir.getDirectoryHandle(folderName, { create: true });
    const imagesDir = await postDir.getDirectoryHandle('images', { create: true });
    const expectedFiles = new Set((post.images || []).map((image, index) =>
      this.safeName(image.filename || `photo_${String(index + 1).padStart(2, '0')}.jpg`, 80)
    ));

    // Keep the managed folder consistent after an image is deleted in Studio.
    for await (const [name, handle] of imagesDir.entries()) {
      if (handle.kind === 'file' && !expectedFiles.has(name)) await imagesDir.removeEntry(name);
    }

    for (let index = 0; index < (post.images || []).length; index++) {
      const image = post.images[index];
      const fileName = this.safeName(image.filename || `photo_${String(index + 1).padStart(2, '0')}.jpg`, 80);
      await this.writeDataUrl(imagesDir, fileName, image.dataUrl);
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
      exportedAt: new Date().toISOString(),
      images: (post.images || []).map((image, index) => ({
        filename: image.filename || `photo_${String(index + 1).padStart(2, '0')}.jpg`,
        tags: image.tags || []
      }))
    }, null, 2));
    return `${root.name}/Douyin_Offline/${folderName}`;
  },

  async syncAll(posts, options = {}) {
    const paths = [];
    for (const post of posts) paths.push(await this.savePost(post, options));
    return paths;
  },

  async importAll(options = {}) {
    const root = await this.getDirectoryHandle(Boolean(options.requestPermission));
    if (!root) throw new Error('Hãy chọn lại thư mục cha chứa Douyin_Offline.');

    let libraryDir;
    try {
      libraryDir = await root.getDirectoryHandle('Douyin_Offline');
    } catch (error) {
      throw new Error(`Không tìm thấy thư mục Douyin_Offline bên trong ${root.name}.`);
    }

    const posts = [];
    for await (const [folderName, handle] of libraryDir.entries()) {
      if (handle.kind !== 'directory') continue;
      try {
        const metadata = JSON.parse(await this.readText(handle, 'metadata.json'));
        const imagesDir = await handle.getDirectoryHandle('images');
        const images = [];
        for (const imageInfo of metadata.images || []) {
          try {
            images.push({
              filename: imageInfo.filename,
              dataUrl: await this.readDataUrl(imagesDir, imageInfo.filename),
              tags: Array.isArray(imageInfo.tags) ? imageInfo.tags : []
            });
          } catch (error) {
            console.warn('Bỏ qua ảnh không đọc được:', imageInfo.filename, error);
          }
        }

        posts.push({
          id: String(metadata.id || folderName),
          author: metadata.author || 'Tác giả Douyin',
          authorId: metadata.authorId || '',
          avatar: '',
          createTime: metadata.publishedAt || 'Không xác định',
          createTimestamp: metadata.publishedTimestamp || 0,
          publishDateManual: Boolean(metadata.publishDateManual),
          desc: await this.readText(handle, 'caption_original.txt', true),
          notes: await this.readText(handle, 'notes.txt', true) || metadata.notes || '',
          englishCaption: await this.readText(handle, 'caption_facebook.txt', true),
          sourceUrl: metadata.sourceUrl || '',
          images,
          thumbUrl: '',
          status: metadata.status || 'pending',
          imageProcessed: Boolean(metadata.imageProcessed),
          savedAt: Date.parse(metadata.exportedAt || '') || Date.now()
        });
      } catch (error) {
        console.warn('Bỏ qua thư mục bài không hợp lệ:', folderName, error);
      }
    }
    return posts;
  },

  async deletePostFolder(post, options = {}) {
    const root = await this.getDirectoryHandle(Boolean(options.requestPermission));
    if (!root) return false;
    try {
      const libraryDir = await root.getDirectoryHandle('Douyin_Offline');
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
    const response = await fetch(dataUrl);
    const file = await directory.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(await response.blob());
    await writable.close();
  },

  async writeText(directory, name, text) {
    const file = await directory.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    await writable.write(text);
    await writable.close();
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
    const date = this.formatDate(post.createTimestamp || post.savedAt);
    return this.safeName(`${date}_${post.author || 'douyin'}_${post.id}`, 90);
  },

  async findPostFolderName(libraryDir, post) {
    const expected = this.getPostFolderName(post);
    const idSuffix = `_${this.safeName(post.id, 90)}`;
    for await (const [name, handle] of libraryDir.entries()) {
      if (handle.kind === 'directory' && (name === expected || name.endsWith(idSuffix))) return name;
    }
    return null;
  },

  formatDate(timestamp) {
    const numeric = Number(timestamp);
    const millis = numeric > 0 ? (numeric < 1e12 ? numeric * 1000 : numeric) : Date.now();
    const date = new Date(millis);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
};

if (typeof window !== 'undefined') window.DouyinFiles = DouyinFiles;
