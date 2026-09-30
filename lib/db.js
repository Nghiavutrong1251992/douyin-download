// IndexedDB Helper for Douyin Offline Storage
// Handles storing posts and clean JPG blobs locally in browser
const DB_NAME = 'DouyinOfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'posts';
const SETTINGS_STORE_NAME = 'settings';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('author', 'author', { unique: false });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
        db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

const DouyinDB = {
  async savePost(post) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(post);
      request.onsuccess = () => resolve(post.id);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getPost(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getPostCount() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getPostsSummary() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const list = [];
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const p = cursor.value;
          // Strip heavy dataUrl (multi-megabyte strings) from in-memory summary list
          list.push({
            id: p.id,
            author: p.author || 'Tác giả',
            authorId: p.authorId || '',
            avatar: p.avatar || '',
            createTime: p.createTime || '',
            createTimestamp: p.createTimestamp || 0,
            publishDateManual: Boolean(p.publishDateManual),
            desc: p.desc || '',
            notes: p.notes || '',
            englishCaption: p.englishCaption || '',
            sourceUrl: p.sourceUrl || p.url || '',
            thumbUrl: p.thumbUrl || p.images?.[0]?.thumbnailDataUrl || (p.images?.[0]?.dataUrl ? p.images[0].dataUrl.slice(0, 100) : '') || '',
            status: p.status || 'pending',
            imageProcessed: Boolean(p.imageProcessed),
            savedAt: p.savedAt || 0,
            province: p.province || '',
            imageCount: (p.images || []).length,
            images: (p.images || []).map((img, idx) => ({
              filename: img.filename || `photo_${idx + 1}.jpg`,
              tags: img.tags || [],
              favorite: Boolean(img.favorite),
              thumbnailDataUrl: img.thumbnailDataUrl || img.dataUrl || '',
              downloadId: img.downloadId
            }))
          });
          cursor.continue();
        } else {
          list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
          resolve(list);
        }
      };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getAllPosts() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const list = request.result || [];
        // Sort descending by savedAt
        list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        resolve(list);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async updateStatus(id, status) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          data.status = status;
          store.put(data);
          resolve(true);
        } else {
          resolve(false);
        }
      };
      getReq.onerror = (e) => reject(e.target.error);
    });
  },

  async deletePost(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async clearAll() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async setSetting(key, value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
      const request = tx.objectStore(SETTINGS_STORE_NAME).put({ key, value });
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getSetting(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE_NAME, 'readonly');
      const request = tx.objectStore(SETTINGS_STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = (e) => reject(e.target.error);
    });
  }
};

if (typeof window !== 'undefined') {
  window.DouyinDB = DouyinDB;
}
