// renderer/renderer.mjs

let currentSettings = null;

window.addEventListener("DOMContentLoaded", () => {
  const playButton1218 = document.getElementById("playButton1218");
  const playButton1214 = document.getElementById("playButton1214");
  const statusText = document.getElementById("statusText");
  const usernameInput = document.getElementById("usernameInput");

  const ramSlider = document.getElementById("ramSlider");
  const ramValue = document.getElementById("ramValue");
  const ramMaxLabel = document.getElementById("ramMaxLabel");

  const settingsButton = document.getElementById("settingsButton");
  const settingsModal = document.getElementById("settingsModal");
  const settingsCloseButton = document.getElementById("settingsCloseButton");
  const closeOnPlayCheckbox = document.getElementById("closeOnPlayCheckbox");

  const launcherVersionLabel = document.getElementById("launcherVersion");

  function setStatus(text, isError = false) {
    statusText.textContent = text;
    statusText.classList.toggle("error", !!isError);
  }

  function setBusy(isBusy) {
    playButton1218.disabled = isBusy;
    playButton1214.disabled = isBusy;
  }

  async function saveSettings(partial) {
    if (!currentSettings) currentSettings = {};
    currentSettings = { ...currentSettings, ...(partial || {}) };
    try {
      const saved = await window.electronAPI.saveSettings(currentSettings);
      currentSettings = saved;
    } catch (e) {
      console.error("Не вдалось зберегти налаштування:", e);
    }
  }

  async function init() {
    try {
      const [settings, sys, appVersion] = await Promise.all([
        window.electronAPI.getSettings(),
        window.electronAPI.getSystemRam(),
        window.electronAPI.getAppVersion().catch(() => null),
      ]);

      if (launcherVersionLabel) {
        launcherVersionLabel.textContent = appVersion || "?";
      }

      const totalMb = sys?.totalMb || 8192;
      const safeMax = Math.max(1024, totalMb - 1024);
      const sliderMax = Math.max(512, Math.floor(safeMax / 256) * 256);

      ramSlider.max = String(sliderMax);
      ramMaxLabel.textContent = sliderMax.toString();

      let ramFromSettings = settings.ramMb || 4096;
      ramFromSettings = Math.min(Math.max(ramFromSettings, 512), sliderMax);

      ramSlider.value = String(ramFromSettings);
      ramValue.textContent = ramFromSettings.toString();

      usernameInput.value = settings.lastUsername || "";
      closeOnPlayCheckbox.checked = !!settings.closeOnPlay;

      currentSettings = {
        ...settings,
        ramMb: ramFromSettings,
        closeOnPlay: !!settings.closeOnPlay,
      };

      // слухаємо статуси автооновлення
      window.electronAPI.onUpdateStatus((message) => {
        // не помилка, просто інфо
        setStatus(message, false);
      });
    } catch (e) {
      console.error("Init error:", e);
      setStatus("Помилка завантаження налаштувань.", true);
    }
  }

  // --- RAM слайдер ---
  ramSlider.addEventListener("input", () => {
    const value = Number(ramSlider.value || "0");
    ramValue.textContent = value.toString();
    saveSettings({ ramMb: value });
  });

  // --- нік ---
  usernameInput.addEventListener("blur", () => {
    const name = usernameInput.value.trim();
    saveSettings({ lastUsername: name });
  });

  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      playSelectedVersion("1.21.8"); // по Enter запускаємо основну версію
    }
  });

  async function playSelectedVersion(profile) {
    const username = usernameInput.value.trim();
    if (!username) {
      setStatus("Будь ласка, введіть нікнейм.", true);
      usernameInput.focus();
      return;
    }

    const label =
      profile === "1.21.8" ? "1.21.8 (Fabric 0.18.1)" : "1.21.4 (Fabric 0.17.3)";

    setStatus(`Запускаємо Minecraft ${label}…`, false);
    setBusy(true);
    await saveSettings({ lastUsername: username });

    try {
      const result = await window.electronAPI.play({ username, profile });
      if (result && result.ok) {
        setStatus(`Гра запускається (${label})…`, false);
      } else {
        const msg = result?.error || "Невідома помилка.";
        setStatus("Помилка запуску: " + msg, true);
      }
    } catch (e) {
      console.error(e);
      setStatus("Помилка запуску: " + (e.message || e), true);
    } finally {
      setBusy(false);
    }
  }

  // --- кнопки гри ---
  playButton1218.addEventListener("click", () => playSelectedVersion("1.21.8"));
  playButton1214.addEventListener("click", () => playSelectedVersion("1.21.4"));

  // --- налаштування ---
  function openSettings() {
    settingsModal.classList.remove("hidden");
  }
  function closeSettings() {
    settingsModal.classList.add("hidden");
  }

  settingsButton.addEventListener("click", openSettings);
  settingsCloseButton.addEventListener("click", closeSettings);
  settingsModal
    .querySelector(".modal-backdrop")
    .addEventListener("click", closeSettings);

  closeOnPlayCheckbox.addEventListener("change", () => {
    saveSettings({ closeOnPlay: closeOnPlayCheckbox.checked });
  });

  // старт
  init();
});
