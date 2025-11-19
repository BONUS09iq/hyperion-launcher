// launcher.mjs
import os from "os";
import { Client } from "minecraft-launcher-core";
import { FABRIC_VERSION_ID } from "./fabric.mjs";

const launcher = new Client();

/**
 * Параметри:
 *   mcDir   – папка .minecraft
 *   username – нік з лаунчера
 *   ramMb    – МБ RAM
 */
export async function launchMinecraft({ mcDir, username, ramMb }) {
  const name = username && username.trim() ? username.trim() : "Player";
  const maxRam = String(ramMb || 4096);
  const minRam = String(Math.min(ramMb || 4096, 2048));

  // Простий офлайн-профіль (тільки для одиночки / offline-mode серверів)
  const authorization = {
    access_token: "0",
    client_token: "0",
    uuid: "0",
    name,
    user_properties: "{}"
  };

  const osName =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
      ? "osx"
      : "linux";

  // ГОЛОВНЕ: javaPath = "javaw" на Windows, щоб не відкривалась консоль
  const javaPath =
    process.platform === "win32" ? "javaw" : "java";

  const opts = {
    root: mcDir,
    os: osName,
    authorization,
    javaPath, // <-- тут ми передаємо javaPath
    version: {
      number: "1.21.4",
      type: "release",
      custom: FABRIC_VERSION_ID // "fabric-loader-0.16.9-1.21.4"
    },
    memory: {
      max: maxRam,
      min: minRam
    }
  };

  launcher.removeAllListeners();
  launcher.on("debug", (e) => console.log("[MCLC DEBUG]", e));
  launcher.on("data", (e) => console.log("[GAME]", e));
  launcher.on("close", (code) =>
    console.log("[GAME EXIT CODE]", code)
  );

  console.log("=== Launching Minecraft with options ===");
  console.log(JSON.stringify(opts, null, 2));

  const child = await launcher.launch(opts);
  console.log("Minecraft process PID:", child && child.pid);
}
