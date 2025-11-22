// mods.mjs
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";

async function copyDir(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// profile тут — "1.21.4" або "1.21.8"
export async function syncMods(mcDir, profile) {
  const version = profile === "1.21.8" ? "1.21.8" : "1.21.4";

  // Можливі місця, де лежать "еталонні" моди:
  // 1) Зібраний .exe (process.resourcesPath/.minecraft/mods-<ver>)
  // 2) Dev режим (папка .minecraft поряд з проектом)
  const candidateSources = [
    path.join(process.resourcesPath || "", ".minecraft", `mods-${version}`),
    path.join(process.cwd(), ".minecraft", `mods-${version}`),
  ];

  let srcDir = null;
  for (const p of candidateSources) {
    if (p && existsSync(p)) {
      srcDir = p;
      break;
    }
  }

  if (!srcDir) {
    console.warn(
      `Hyperion: папка з модами для ${version} не знайдена, пропускаю syncMods.`
    );
    return;
  }

  const destDir = path.join(mcDir, "mods");
  console.log(
    `Hyperion: синхронізую моди (${version}) з ${srcDir} → ${destDir}`
  );

  await copyDir(srcDir, destDir);
}
