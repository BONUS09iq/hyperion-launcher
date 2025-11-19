// main.mjs
import { app, BrowserWindow, ipcMain } from "electron";
import pkg from "electron-updater";           // <-- зміна
const { autoUpdater } = pkg;                  // <-- дістаємо autoUpdater

import path from "path";
import { fileURLToPath } from "url";
import os from "os";

import { loadSettings, saveSettings } from "./settings.mjs";
import { getMinecraftDir } from "./paths.mjs";
import { ensureFabricInstalled } from "./fabric.mjs";
import { syncMods } from "./mods.mjs";
import { launchMinecraft } from "./launcher.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 600,
    resizable: false,
    title: "Hyperion Launcher",
    backgroundColor: "#050711",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// налаштування автоапдейтера + події
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", () => {
    if (mainWindow) {
      mainWindow.webContents.send("update-available");
    }
  });

  autoUpdater.on("update-downloaded", () => {
    if (mainWindow) {
      mainWindow.webContents.send("update-downloaded");
    }
  });

  autoUpdater.on("error", (err) => {
    if (mainWindow) {
      mainWindow.webContents.send("update-error", String(err));
    }
  });
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.hyperion.launcher");
  }

  createWindow();
  setupAutoUpdater();

  try {
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.error("Помилка перевірки оновлень:", e);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------- IPC ----------

ipcMain.handle("get-settings", async () => {
  const settings = await loadSettings();
  return settings;
});

ipcMain.handle("save-settings", async (_event, partial) => {
  const current = await loadSettings();
  const merged = { ...current, ...(partial || {}) };
  const saved = await saveSettings(merged);
  return saved;
});

// системна RAM для слайдера
ipcMain.handle("get-system-ram", async () => {
  const totalMb = Math.round(os.totalmem() / (1024 * 1024));
  return { totalMb };
});

// перезапуск для встановлення оновлення
ipcMain.handle("restart-to-update", () => {
  autoUpdater.quitAndInstall();
});

// Play
ipcMain.handle("play", async (_event, { username }) => {
  try {
    const settings = await loadSettings();
    const ramMb = settings.ramMb || 4096;

    const mcDir = getMinecraftDir();

    await ensureFabricInstalled(mcDir);
    await syncMods(mcDir);

    await launchMinecraft({
      mcDir,
      username,
      ramMb,
    });

    const updated = {
      ...settings,
      lastUsername: username,
    };
    await saveSettings(updated);

    if (settings.closeOnPlay && mainWindow) {
      mainWindow.close();
    }

    return { ok: true };
  } catch (err) {
    console.error("Помилка запуску:", err);
    return { ok: false, error: String(err.message || err) };
  }
});
