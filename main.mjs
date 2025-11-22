// main.mjs
import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

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

// опис профілів (на майбутнє, якщо захочеш додати ще)
const PROFILES = {
  "1.21.4": { id: "1.21.4", label: "Minecraft 1.21.4 (Fabric)" },
  "1.21.8": { id: "1.21.8", label: "Minecraft 1.21.8" },
};

function resolveProfile(profileId) {
  const p = PROFILES[profileId];
  if (!p) throw new Error(`Невідомий профіль версії: ${profileId}`);
  return p;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 600,
    resizable: false,
    title: "Hyperion Launcher",
    backgroundColor: "#050711",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  
  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ------------ APP READY + AUTOUPDATE ------------

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.hyperion.launcher");
  }

  createWindow();

  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => {
      mainWindow?.webContents.send(
        "update-status",
        "Перевірка оновлень лаунчера…"
      );
    });

    autoUpdater.on("update-available", (info) => {
      mainWindow?.webContents.send(
        "update-status",
        `Знайдено нове оновлення лаунчера ${info?.version}. Завантажую…`
      );
    });

    autoUpdater.on("update-not-available", () => {
      mainWindow?.webContents.send(
        "update-status",
        "Оновлень лаунчера не знайдено."
      );
    });

    autoUpdater.on("download-progress", (p) => {
      const percent = Math.round(p.percent || 0);
      mainWindow?.webContents.send(
        "update-status",
        `Завантаження оновлення лаунчера: ${percent}%`
      );
    });

    autoUpdater.on("update-downloaded", (info) => {
      mainWindow?.webContents.send(
        "update-status",
        `Оновлення ${info?.version} завантажено. Лаунчер зараз перезапуститься…`
      );

      setTimeout(() => {
        autoUpdater.quitAndInstall(false, true);
      }, 4000);
    });

    autoUpdater.on("error", (err) => {
      console.error("Помилка автооновлення:", err);
      mainWindow?.webContents.send(
        "update-status",
        "Помилка автооновлення лаунчера. Деталі в логах."
      );
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

ipcMain.handle("get-app-version", () => app.getVersion());

// ------------ IPC ЗАПУСК ГРИ ------------

ipcMain.handle("play", async (_event, { username, profile }) => {
  try {
    const settings = await loadSettings();
    const ramMb = settings.ramMb || 4096;

    const mcDir = getMinecraftDir();

    // ставимо саме той Fabric, що відповідає профілю
    await ensureFabricInstalled(mcDir, profile);

    // копіюємо правильний набір модів
    await syncMods(mcDir, profile);

    // запускаємо потрібний профіль
    await launchMinecraft({
      mcDir,
      username,
      ramMb,
      profile,
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
    const msg =
      (err && err.message) ||
      (typeof err === "string" ? err : JSON.stringify(err));
    return { ok: false, error: msg };
  }
});
