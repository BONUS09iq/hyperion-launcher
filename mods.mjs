// mods.mjs
// Тимчасова заглушка: нічого не качаємо, просто пишемо в лог.
// Пізніше сюди повернемо код з маніфестом модпаку.

export async function syncMods(mcDir) {
  console.log("[MODS] syncMods skipped. Авто-підкачка модів поки вимкнена.");
  // Якщо хочеш хоча б створювати папку mods:
  // const fs = await import("fs/promises");
  // const path = await import("path");
  // await fs.mkdir(path.join(mcDir, "mods"), { recursive: true });
}
