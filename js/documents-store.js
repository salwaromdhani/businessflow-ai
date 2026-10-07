(() => {
  const DATABASE = "businessflow-documents";
  const STORE = "documents";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB could not be opened."));
      request.onblocked = () => reject(new Error("Close another BusinessFlow tab to finish the document database upgrade."));
    });
  }

  async function transaction(mode, run) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, mode);
      const result = run(tx.objectStore(STORE));
      tx.oncomplete = () => {
        database.close();
        resolve(result?.result);
      };
      tx.onerror = () => {
        database.close();
        reject(tx.error || result?.error || new Error("Document storage transaction failed."));
      };
      tx.onabort = () => {
        database.close();
        reject(tx.error || new Error("Document storage transaction was aborted."));
      };
    });
  }

  async function list() {
    const documents = await transaction("readonly", (store) => store.getAll());
    return documents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function get(id) {
    return transaction("readonly", (store) => store.get(id));
  }

  async function save(document) {
    return transaction("readwrite", (store) => store.put(document));
  }

  async function remove(id) {
    return transaction("readwrite", (store) => store.delete(id));
  }

  window.BusinessFlowDocuments = { list, get, save, remove };
})();
