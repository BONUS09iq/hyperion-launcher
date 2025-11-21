// fabric.mjs
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ШЛЯХ ДО ІНСТАЛЯТОРА FABRIC У ТВОЄМУ ПРОЄКТІ
const INSTALLER_JAR = path.join(__dirname, "resources", "fabric-installer.jar");

/**
 * Описуємо два профілі:
 *  - 1.21.4 + loader 0.17.3
 *  - 1.21.8 + loader 0.18.1
 */
const FABRIC_PROFILES = {
  "1.21.4": {
    mcVersion: "1.21.4",
    loaderVersion: "0.17.3",
  },
  "1.21.8": {
    mcVersion: "1.21.8",
    loaderVersion: "0.18.1",
  },
};

/**
 * Повертає рядок версії Fabric:
 *   fabric-loader-0.17.3-1.21.4
 *   fabric-loader-0.18.1-1.21.8
 */
export function getFabricVersionId(profile = "1.21.4") {
  const cfg = FABRIC_PROFILES[profile] || FABRIC_PROFILES["1.21.4"];
  return `fabric-loader-${cfg.loaderVersion}-${cfg.mcVersion}`;
}

/**
 * Перевіряє, чи вже встановлений вказаний fabricVersionId,
 * і якщо ні — запускає fabric-installer.jar.
 *
 * mcDir           – шлях до .minecraft
 * fabricVersionId – рядок типу fabric-loader-0.17.3-1.21.4
 */
export async function ensureFabricInstalled(mcDir, fabricVersionId) {
  const versionsDir = path.join(mcDir, "versions");
  const targetDir = path.join(versionsDir, fabricVersionId);
  const jsonPath = path.join(targetDir, `${fabricVersionId}.json`);

  // Уже є – нічого не робимо
  if (fs.existsSync(jsonPath)) {
    console.log(`[Fabric] ${fabricVersionId} вже встановлено`);
    return;
  }

  await fs.promises.mkdir(versionsDir, { recursive: true });

  // Парсимо fabric-loader-<loader>-<mc>
  const parts = (fabricVersionId || "").split("-");
  // ["fabric","loader","0.17.3","1.21.4"]
  const loaderVersion = parts[2];
  const mcVersion = parts[3];

  if (!loaderVersion || !mcVersion) {
    throw new Error(
      `Некоректний fabricVersionId: "${fabricVersionId}". Очікується fabric-loader-x.y.z-1.21.x`
    );
  }

  const javaCmd = process.platform === "win32" ? "javaw" : "java";

  const args = [
    "-jar",
    INSTALLER_JAR,
    "client",
    "-dir",
    mcDir,
    "-mcversion",
    mcVersion,
    "-loader",
    loaderVersion,
    "-noprofile",
  ];

  console.log("[Fabric] Встановлення:", javaCmd, args.join(" "));

  await new Promise((resolve, reject) => {
    const child = spawn(javaCmd, args, { stdio: "inherit" });

    child.on("exit", (code) => {
      if (code === 0) {
        console.log("[Fabric] Успішно встановлено", fabricVersionId);
        resolve();
      } else {
        reject(
          new Error(`Fabric installer exited with code ${code || "unknown"}`)
        );
      }
    });

    child.on("error", (err) => reject(err));
  });

  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `Після інсталяції не знайдено версію Fabric: ${fabricVersionId}`
    );
  }
}
