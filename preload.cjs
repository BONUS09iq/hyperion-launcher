// preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // налаштування
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),

  // системна RAM
  getSystemRam: () => ipcRenderer.invoke("get-system-ram"),

  // запуск гри
  play: (payload) => ipcRenderer.invoke("play", payload),

  // версія лаунчера
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // статус автооновлення (один канал "update-status")
  onUpdateStatus: (callback) => {
    // щоб не плодити слухачі при перезавантаженні UI
    ipcRenderer.removeAllListeners("update-status");
    ipcRenderer.on("update-status", (_event, message) => {
      if (typeof callback === "function") {
        callback(message);
      }
    });
  },
});
