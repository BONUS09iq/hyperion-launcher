// settings.mjs
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";

const SETTINGS_DIR = path.join(os.homedir(), ".hyperion-launcher");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

const DEFAULT_SETTINGS = {
  ramMb: 4096,
  lastUsername: "",
  minecraftDirOverride: "",
  closeOnPlay: false
};

async function ensureDir() {
  if (!fsSync.existsSync(SETTINGS_DIR)) {
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
  }
}

export async function loadSettings() {
  try {
    await ensureDir();
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    const data = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...data };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  await ensureDir();
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
