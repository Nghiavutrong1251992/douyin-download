// IndexedDB Helper for Douyin Offline Storage
// Handles storing posts and clean JPG blobs locally in browser
const DB_NAME = 'DouyinOfflineDB';
const DB_VERSION = 3;
const STORE_NAME = 'posts';
const SUMMARIES_STORE_NAME = 'summaries';
const SETTINGS_STORE_NAME = 'settings';

function createPostSummary(p) {
  return {
    id: String(p.id),
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
    savedAt: p.savedAt || Date.now(),
    province: p.province || '',
    folderName: p.folderName || '',
    imageCount: (p.images || []).length,
    images: (p.images || []).map((img, idx) => ({
      filename: img.filename || `photo_${idx + 1}.jpg`,
      tags: img.tags || [],
      favorite: Boolean(img.favorite),
      thumbnailDataUrl: img.thumbnailDataUrl || '', // Keep summary lightweight, do NOT duplicate heavy dataUrl!
      downloadId: img.downloadId
    }))
  };
}

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
      if (!db.objectStoreNames.contains(SUMMARIES_STORE_NAME)) {
        const sumStore = db.createObjectStore(SUMMARIES_STORE_NAME, { keyPath: 'id' });
        sumStore.createIndex('savedAt', 'savedAt', { unique: false });
        sumStore.createIndex('status', 'status', { unique: false });
        sumStore.createIndex('author', 'author', { unique: false });
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
      const tx = db.transaction([STORE_NAME, SUMMARIES_STORE_NAME], 'readwrite');
      const postsStore = tx.objectStore(STORE_NAME);
      const summariesStore = tx.objectStore(SUMMARIES_STORE_NAME);

      postsStore.put(post);
      summariesStore.put(createPostSummary(post));

      tx.oncomplete = () => resolve(post.id);
      tx.onerror = (e) => reject(e.target.error);
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
      const tx = db.transaction(SUMMARIES_STORE_NAME, 'readonly');
      const store = tx.objectStore(SUMMARIES_STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getPostsSummary() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SUMMARIES_STORE_NAME, 'readonly');
      const store = tx.objectStore(SUMMARIES_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = async () => {
        let list = request.result || [];
        if (list.length === 0) {
          list = await DouyinDB._migrateSummaries(db);
        }
        list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        resolve(list);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async _migrateSummaries(db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME, SUMMARIES_STORE_NAME], 'readwrite');
        const postsStore = tx.objectStore(STORE_NAME);
        const summariesStore = tx.objectStore(SUMMARIES_STORE_NAME);
        const list = [];
        const req = postsStore.openCursor();
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const summary = createPostSummary(cursor.value);
            summariesStore.put(summary);
            list.push(summary);
            cursor.continue();
          } else {
            resolve(list);
          }
        };
        req.onerror = () => resolve([]);
      } catch (_) {
        resolve([]);
      }
    });
  },

  async getAllPosts() {
    return this.getPostsSummary();
  },

  async updateProvince(id, province) {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME, SUMMARIES_STORE_NAME], 'readwrite');
        const sumStore = tx.objectStore(SUMMARIES_STORE_NAME);
        const req = sumStore.get(id);
        req.onsuccess = () => {
          if (req.result) {
            req.result.province = province;
            sumStore.put(req.result);
          }
        };
        const postsStore = tx.objectStore(STORE_NAME);
        const req2 = postsStore.get(id);
        req2.onsuccess = () => {
          if (req2.result) {
            req2.result.province = province;
            postsStore.put(req2.result);
          }
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  },

  async updateStatus(id, status) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, SUMMARIES_STORE_NAME], 'readwrite');
      const postsStore = tx.objectStore(STORE_NAME);
      const sumStore = tx.objectStore(SUMMARIES_STORE_NAME);

      const getReq = postsStore.get(id);
      getReq.onsuccess = () => {
        const data = getReq.result;
        if (data) {
          data.status = status;
          postsStore.put(data);
        }
      };

      const getSumReq = sumStore.get(id);
      getSumReq.onsuccess = () => {
        const data = getSumReq.result;
        if (data) {
          data.status = status;
          sumStore.put(data);
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async deletePost(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, SUMMARIES_STORE_NAME], 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.objectStore(SUMMARIES_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async clearAll() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, SUMMARIES_STORE_NAME], 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.objectStore(SUMMARIES_STORE_NAME).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
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
if (typeof self !== 'undefined') {
  self.DouyinDB = DouyinDB;
}
