const { indexedDB } = require('fake-indexeddb');

// Test with Uint8Array instead of ArrayBuffer
const req = indexedDB.open('test-u8', 1);
req.onupgradeneeded = () => {
  const db = req.result;
  db.createObjectStore('s', { keyPath: 'resourceId' });
};
req.onsuccess = async () => {
  const db = req.result;
  const tx = db.transaction('s', 'readwrite');
  const store = tx.objectStore('s');
  const blob = new ArrayBuffer(8);
  new Uint8Array(blob).set([1, 2, 3, 4, 5, 6, 7, 8]);
  // Store as Uint8Array view
  store.put({ resourceId: 1, compilerVersion: 1, termCount: 1, blob: new Uint8Array(blob) });
  await new Promise((r) => { tx.oncomplete = r; });
  const tx2 = db.transaction('s', 'readonly');
  const req2 = tx2.objectStore('s').get(1);
  req2.onsuccess = () => {
    const result = req2.result;
    console.log('u8 blob type:', result.blob.constructor.name);
    console.log('u8 blob length:', result.blob.length);
    console.log('u8 blob instanceof Uint8Array:', result.blob instanceof Uint8Array);
    // Try converting back
    if (result.blob instanceof Uint8Array) {
      console.log('buffer:', result.blob.buffer.byteLength);
    }
  };
};
