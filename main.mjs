// main.mjs
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

// electron-updater — CommonJS, тому імпорт так:
import updaterPkg from "electron-updater";
const { autoUpdater } = updaterPkg;

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

// ------------ AUTOUPDATE + APP READY ------------

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.hyperion.launcher");
  }

  createWindow();

  // автооновлення працює ТІЛЬКИ в запакованому .exe, а не в `npm start`
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", () => {
      console.log("Hyperion: знайдено нове оновлення");
      if (mainWindow) {
        mainWindow.webContents.send(
          "update-status",
          "Знайдено нову версію лаунчера. Завантажую…"
        );
      }
    });

    autoUpdater.on("update-downloaded", () => {
      console.log("Hyperion: оновлення завантажено, буде встановлено при виході");
      if (mainWindow) {
        mainWindow.webContents.send(
          "update-status",
          "Оновлення лаунчера завантажено. Встановиться після закриття."
        );
      }
    });

    autoUpdater.on("error", (err) => {
      console.error("Помилка автооновлення:", err);
    });

    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (e) {
      console.error("Помилка перевірки оновлень:", e);
    }
  } else {
    console.log("Dev режим (npm start) — autoUpdater не працює.");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ------------ IPC НАЛАШТУВАННЯ ------------

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

ipcMain.handle("get-system-ram", async () => {
  const totalMb = Math.round(os.totalmem() / (1024 * 1024));
  return { totalMb };
});

// ------------ IPC ЗАПУСК ГРИ ------------

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
