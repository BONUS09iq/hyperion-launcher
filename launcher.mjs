// launcher.mjs
import { Client } from "minecraft-launcher-core";

const launcher = new Client();

/**
 * Параметри:
 *   mcDir     – папка .minecraft
 *   username  – нік з лаунчера
 *   ramMb     – МБ RAM
 *   versionId – рядок типу fabric-loader-0.17.3-1.21.4
 */
export async function launchMinecraft({ mcDir, username, ramMb, versionId }) {
  const name = username && username.trim() ? username.trim() : "Player";

  const maxRam = String(ramMb || 4096);
  const minRam = String(Math.min(ramMb || 4096, 2048));

  // офлайн-профіль
  const authorization = {
    access_token: "0",
    client_token: "0",
    uuid: "0",
    name,
    user_properties: "{}",
  };

  const osName =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
      ? "osx"
      : "linux";

  const javaPath = process.platform === "win32" ? "javaw" : "java";

  const vid =
    typeof versionId === "string" && versionId.length > 0
      ? versionId
      : "fabric-loader-0.17.3-1.21.4";

  // Отримаємо версію Minecraft із рядка fabric-loader-x.y.z-<mc>
  const parts = vid.split("-");
  const mcVersion = parts[parts.length - 1] || "1.21.4";

  const opts = {
    root: mcDir,
    os: osName,
    authorization,
    javaPath,
    version: {
      number: mcVersion, // 1.21.4 / 1.21.8
      type: "release",
      custom: vid, // fabric-loader-...
    },
    memory: {
      max: maxRam,
      min: minRam,
    },
  };

  launcher.removeAllListeners();
  launcher.on("debug", (e) => console.log("[MCLC DEBUG]", e));
  launcher.on("data", (e) => console.log("[GAME]", e));
  launcher.on("close", (code) => console.log("[GAME EXIT CODE]", code));

  console.log("=== Launching Minecraft with options ===");
  console.log(JSON.stringify(opts, null, 2));

  const child = await launcher.launch(opts);
  console.log("Minecraft process PID:", child && child.pid);
}
