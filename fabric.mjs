// fabric.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ID версії Fabric, яка ВЖЕ має бути встановлена в клієнті
export const FABRIC_VERSION_ID = "fabric-loader-0.17.3-1.21.4";

/**
 * Просто перевіряємо, чи є json цієї версії у <mcDir>/versions
 */
export async function hasFabricInstalled(mcDir) {
  const jsonPath = path.join(
    mcDir,
    "versions",
    FABRIC_VERSION_ID,
    `${FABRIC_VERSION_ID}.json`
  );
  return fs.existsSync(jsonPath);
}

/**
 * Функція, яку викликає main.mjs.
 * Більше НЕ запускає інсталер, тільки перевіряє наявність.
 */
export async function ensureFabricInstalled(mcDir) {
  const has = await hasFabricInstalled(mcDir);
  if (!has) {
    throw new Error(
      `Fabric версія ${FABRIC_VERSION_ID} не знайдена в:\n` +
      path.join(mcDir, "versions", FABRIC_VERSION_ID) +
      `\n\nЦей лаунчер очікує, що Fabric вже встановлено в клієнті.`
    );
  }
}
