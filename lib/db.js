// IndexedDB Helper for Douyin Offline Storage
// Handles storing posts and clean JPG blobs locally in browser
const DB_NAME = 'DouyinOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'posts';

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
  }
};

if (typeof window !== 'undefined') {
  window.DouyinDB = DouyinDB;
}
