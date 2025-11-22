// paths.mjs
import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Папка з готовим .minecraft, який ти кладеш у корінь проєкту
// і який electron-builder копіює як extraResources
export function getMinecraftDir() {
  if (app.isPackaged) {
    // у встановленому .exe
    return path.join(process.resourcesPath, ".minecraft");
  }
  // у режимі npm start – .minecraft лежить поруч з main.mjs
  return path.join(__dirname, ".minecraft");
}
