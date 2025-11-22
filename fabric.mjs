// fabric.mjs
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Налаштування для профілів
// ОБИДВА Fabric
const FABRIC_CONFIG = {
  "1.21.8": {
    mcVersion: "1.21.8",
    loaderVersion: "0.17.3", // за потреби заміниш
  },
  "1.21.4": {
    mcVersion: "1.21.4",
    loaderVersion: "0.17.3",
  },
};

function resolveInstallerJar() {
  // продакшн (після збірки)
  const prod = path.join(process.resourcesPath || "", "fabric-installer.jar");
  // dev варіант (коли npm start)
  const dev1 = path.join(__dirname, "fabric-installer.jar");
  const dev2 = path.join(__dirname, "resources", "fabric-installer.jar");

  if (existsSync(prod)) return prod;
  if (existsSync(dev1)) return dev1;
  return dev2;
}

/**
 * Встановити Fabric, якщо його ще нема.
 * @param {string} mcDir - шлях до .minecraft
 * @param {"1.21.8"|"1.21.4"} profile
 * @returns {Promise<string>} versionId (типу "fabric-loader-0.17.3-1.21.4")
 */
export async function ensureFabricInstalled(mcDir, profile) {
  const cfg = FABRIC_CONFIG[profile];
  if (!cfg) throw new Error(`Невідомий профіль Fabric: ${profile}`);

  const { mcVersion, loaderVersion } = cfg;
  const versionId = `fabric-loader-${loaderVersion}-${mcVersion}`;
  const versionDir = path.join(mcDir, "versions", versionId);

  // вже встановлено
  if (existsSync(versionDir)) {
    console.log(`Fabric ${versionId} вже встановлено.`);
    return versionId;
  }

  await mkdir(mcDir, { recursive: true });

  const jarPath = resolveInstallerJar();
  console.log("Hyperion: запускаю Fabric installer:", jarPath);

  return new Promise((resolve, reject) => {
    const javaCmd = process.platform === "win32" ? "java" : "java";

    const child = spawn(
      javaCmd,
      [
        "-jar",
        jarPath,
        "client",
        "-dir",
        mcDir,
        "-mcversion",
        mcVersion,
        "-loader",
        loaderVersion,
        "-noprofile",
      ],
      { stdio: "inherit" }
    );

    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`Fabric installer успішно встановив ${versionId}`);
        resolve(versionId);
      } else {
        reject(new Error(`Fabric installer завершився з кодом ${code}`));
      }
    });

    child.on("error", (err) => reject(err));
  });
}
