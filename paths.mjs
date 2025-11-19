// paths.mjs
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPackaged = __dirname.includes("app.asar");

/**
 * Папка, яку лаунчер використовує як свій .minecraft
 */
export function getMinecraftDir() {
  if (isPackaged) {
    // ВСТАНОВЛЕНИЙ ЛАУНЧЕР:
    // C:\Users\rozen\AppData\Local\Programs\hyperion-launcher\resources\.minecraft
    return path.join(process.resourcesPath, ".minecraft");
  } else {
    // DEV (npm start): .minecraft поруч з кодом
    return path.join(__dirname, ".minecraft");
  }
}
