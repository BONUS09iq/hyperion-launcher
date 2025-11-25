// preload.cjs
const { contextBridge, ipcRenderer } = require("electron");
const skinview3d = require("skinview3d"); // <<< ДОДАЛИ

contextBridge.exposeInMainWorld("electronAPI", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  getSystemRam: () => ipcRenderer.invoke("get-system-ram"),
  play: (payload) => ipcRenderer.invoke("play", payload),

  onUpdateStatus: (cb) => ipcRenderer.on("update-status", (_e, msg) => cb(msg)),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // ---- НОВЕ ДЛЯ СКІНІВ ----
  pickSkinFile: () => ipcRenderer.invoke("pick-skin-file"),
  getSkins: () => ipcRenderer.invoke("get-skins"),
  addSkin: (payload) => ipcRenderer.invoke("add-skin", payload),
  setCurrentSkin: (id) => ipcRenderer.invoke("set-current-skin", { id }),
  removeSkin: (id) => ipcRenderer.invoke("remove-skin", { id }),
});

// skinview3d у вікні (для renderer.mjs)
contextBridge.exposeInMainWorld("skinview3d", skinview3d);
