// preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  getSystemRam: () => ipcRenderer.invoke("get-system-ram"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // запуск гри (тепер з профілем)
  play: (payload) => ipcRenderer.invoke("play", payload),

  // статуси автооновлення
  onUpdateStatus: (cb) => {
    ipcRenderer.on("update-status", (_event, msg) => cb(msg));
  },
});
