const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),
  getSystemRam: () => ipcRenderer.invoke("get-system-ram"),
  play: (payload) => ipcRenderer.invoke("play", payload),

  onUpdateAvailable: (cb) => ipcRenderer.on("update-available", cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on("update-downloaded", cb),
  onUpdateError: (cb) => ipcRenderer.on("update-error", cb),
  restartToUpdate: () => ipcRenderer.invoke("restart-to-update"),
});
