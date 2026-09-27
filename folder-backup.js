"use strict";

/* A pasta só é solicitada por um clique. Alterações posteriores usam exclusivamente uma permissão já concedida. */
const SPNFolderBackup = (() => {
  const dbName = "supernatural-guia-backup-v1";
  const store = "preferences";
  let folder = null;
  let loaded = false;
  let retrieving = null;
  let queue = Promise.resolve();
  const supported = () => typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function retrieve() {
    if (loaded) return folder;
    if (retrieving) return retrieving;
    retrieving = (async () => {
      let stored = null;
      if (supported()) {
        try {
          const db = await openDatabase();
          stored = await new Promise((resolve, reject) => {
            const request = db.transaction(store, "readonly").objectStore(store).get("folder");
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
          });
          db.close();
        } catch (_) { /* O seletor continua opcional. */ }
      }
      if (!loaded) { folder = stored; loaded = true; }
      return folder;
    })();
    return retrieving;
  }
  async function remember(handle) {
    const db = await openDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(store, "readwrite");
        transaction.objectStore(store).put(handle, "folder");
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }
  function filename(backup) {
    const local = new Date();
    const date = [local.getFullYear(), String(local.getMonth() + 1).padStart(2, "0"), String(local.getDate()).padStart(2, "0")].join("-");
    const safeUser = backup.username.replace(/[^A-Za-z0-9_.-]/g, "_");
    return `Supernatural_${safeUser}_${date}.json`;
  }
  async function write(backup, handle) {
    const destination = await handle.getDirectoryHandle("Guia de Episódios Supernatural", {create: true});
    const file = await destination.getFileHandle(filename(backup), {create: true});
    const writable = await file.createWritable();
    try {
      await writable.write(JSON.stringify(backup, null, 2) + "\n");
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      throw error;
    }
  }
  function enqueue(backup, handle) {
    const next = queue.catch(() => {}).then(() => write(backup, handle));
    queue = next;
    return next;
  }
  function autoSave(backup) {
    const next = queue.catch(() => {}).then(async () => {
      const handle = await retrieve();
      if (!handle || typeof handle.queryPermission !== "function") return "unavailable";
      try {
        if (await handle.queryPermission({mode: "readwrite"}) !== "granted") return "denied";
        await write(backup, handle);
        return "saved";
      } catch (_) { return "error"; }
    });
    queue = next;
    return next;
  }
  function saveByClick(backup) {
    if (!supported()) return Promise.resolve("unsupported");
    // Ao não haver pasta, o seletor é chamado antes de qualquer await: navegadores exigem gesto do usuário.
    if (!folder) return chooseFolder().then(async (selection) => selection === "selected" ? enqueue(backup, folder).then(() => "saved", () => "error") : selection);
    return folder.queryPermission({mode: "readwrite"}).then(
      (permission) => permission === "granted" ? enqueue(backup, folder).then(() => "saved", () => "error") : "needs-choice",
      () => "needs-choice"
    );
  }
  async function chooseFolder() {
    if (!supported()) return "unsupported";
    let chosen;
    try {
      chosen = await window.showDirectoryPicker({id: "supernatural-backups", startIn: "documents", mode: "readwrite"});
    } catch (error) {
      return error?.name === "AbortError" || error?.name === "NotAllowedError" || error?.name === "SecurityError" ? "denied" : "error";
    }
    if (!chosen) return "denied";
    try {
      let permission = await chosen.queryPermission({mode: "readwrite"});
      if (permission !== "granted" && typeof chosen.requestPermission === "function") {
        permission = await chosen.requestPermission({mode: "readwrite"});
      }
      if (permission !== "granted") return "denied";
      folder = chosen;
      loaded = true;
      await remember(chosen);
      return "selected";
    } catch (_) { return "error"; }
  }
  async function status() {
    const handle = await retrieve();
    if (!handle) return supported() ? "unselected" : "unsupported";
    try { return await handle.queryPermission({mode: "readwrite"}) === "granted" ? "connected" : "permission-needed"; }
    catch (_) { return "permission-needed"; }
  }
  return {supported, filename, chooseFolder, saveByClick, autoSave, status};
})();

if (typeof module !== "undefined" && module.exports) module.exports = SPNFolderBackup;
