// launcher.mjs
import mclc from "minecraft-launcher-core";

const { Client, Authenticator } = mclc;

const launcher = new Client();

// Одна версія Fabric для обох
const FABRIC_LOADER = "0.17.3";

const PROFILES = {
  "1.21.8": {
    mcVersion: "1.21.8",
    fabricId: `fabric-loader-${FABRIC_LOADER}-1.21.8`,
  },
  "1.21.4": {
    mcVersion: "1.21.4",
    fabricId: `fabric-loader-${FABRIC_LOADER}-1.21.4`,
  },
};

export async function launchMinecraft({ mcDir, username, ramMb, profile }) {
  const cfg = PROFILES[profile];
  if (!cfg) {
    throw new Error(`Невідомий профіль: ${profile}`);
  }

  const { mcVersion, fabricId } = cfg;

  console.log(
    `Hyperion: запускаю профіль ${profile} (Fabric ${fabricId}) в директорії ${mcDir}`
  );

  const auth = Authenticator.getAuth(username || "Player");

  // чистимо старі лістерни, щоб не плодились
  launcher.removeAllListeners();
  launcher.on("debug", (line) => console.log("[MC DEBUG]", line));
  launcher.on("data", (line) => console.log("[MC DATA]", line));
  launcher.on("close", (code) =>
    console.log("[MC CLOSE] гра завершилась, код:", code)
  );
  launcher.on("error", (err) => console.error("[MC ERROR event]", err));

  const opts = {
    root: mcDir,
    authorization: auth,
    version: {
      number: mcVersion,          // базова версія MC
      type: "release",
      custom: fabricId,           // custom-версія Fabric, яку створює інсталер
    },
    memory: {
      max: `${ramMb || 4096}M`,
      min: "512M",
    },
  };

  // launcher.launch може кинути синхронну помилку – ловимо її
  try {
    launcher.launch(opts);
  } catch (err) {
    console.error("[MC LAUNCH ERROR sync]", err);
    const msg =
      (err && err.message) ||
      (err && err.error && err.error.message) ||
      (typeof err === "string" ? err : JSON.stringify(err));
    throw new Error("Помилка запуску Minecraft: " + msg);
  }
}
