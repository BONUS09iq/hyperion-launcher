// renderer/renderer.mjs

let currentSettings = null;

window.addEventListener("DOMContentLoaded", () => {
  const play1218Button = document.getElementById("play1218");
  const play1214Button = document.getElementById("play1214");
  const statusText = document.getElementById("statusText");
  const usernameInput = document.getElementById("usernameInput");

  const ramSlider = document.getElementById("ramSlider");
  const ramValue = document.getElementById("ramValue");
  const ramMaxLabel = document.getElementById("ramMaxLabel");

  const settingsButton = document.getElementById("settingsButton");
  const settingsModal = document.getElementById("settingsModal");
  const settingsCloseButton = document.getElementById("settingsCloseButton");
  const closeOnPlayCheckbox = document.getElementById("closeOnPlayCheckbox");

  const launcherVersionSpan = document.getElementById("launcherVersion");

  function setStatus(text, isError = false) {
    if (!statusText) return;
    statusText.textContent = text;
    statusText.classList.toggle("error", !!isError);
  }

  function setBusy(isBusy) {
    if (play1218Button) play1218Button.disabled = isBusy;
    if (play1214Button) play1214Button.disabled = isBusy;
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
        window.electronAPI.getAppVersion(),
      ]);

      if (launcherVersionSpan) {
        launcherVersionSpan.textContent = appVersion || "?";
      }

      const totalMb = sys?.totalMb || 8192;
      const safeMax = Math.max(1024, totalMb - 1024);
      const sliderMax = Math.max(512, Math.floor(safeMax / 256) * 256);

      if (ramSlider && ramMaxLabel) {
        ramSlider.max = String(sliderMax);
        ramMaxLabel.textContent = sliderMax.toString();
      }

      let ramFromSettings = settings.ramMb || 4096;
      ramFromSettings = Math.min(Math.max(ramFromSettings, 512), sliderMax);

      if (ramSlider && ramValue) {
        ramSlider.value = String(ramFromSettings);
        ramValue.textContent = ramFromSettings.toString();
      }

      if (usernameInput) {
        usernameInput.value = settings.lastUsername || "";
      }
      if (closeOnPlayCheckbox) {
        closeOnPlayCheckbox.checked = !!settings.closeOnPlay;
      }

      currentSettings = {
        ...settings,
        ramMb: ramFromSettings,
        closeOnPlay: !!settings.closeOnPlay,
      };

      // статус автооновлення від main.mjs
      if (window.electronAPI.onUpdateStatus) {
        window.electronAPI.onUpdateStatus((msg) => {
          if (msg) setStatus(msg, false);
        });
      }
    } catch (e) {
      console.error("Init error:", e);
      setStatus("Помилка завантаження налаштувань.", true);
    }
  }

  // --- RAM у модалці ---

  if (ramSlider && ramValue) {
    ramSlider.addEventListener("input", () => {
      const value = Number(ramSlider.value || "0");
      ramValue.textContent = value.toString();
      saveSettings({ ramMb: value });
    });
  }

  if (usernameInput) {
    usernameInput.addEventListener("blur", () => {
      const name = usernameInput.value.trim();
      saveSettings({ lastUsername: name });
    });

    usernameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // За замовчуванням запускаємо модовий 1.21.4
        if (play1214Button) play1214Button.click();
      }
    });
  }

  async function startGame(profileVersion) {
    const username = (usernameInput?.value || "").trim();
    if (!username) {
      setStatus("Будь ласка, введіть нікнейм.", true);
      if (usernameInput) usernameInput.focus();
      return;
    }

    setStatus(`Запускаємо Minecraft ${profileVersion}…`, false);
    setBusy(true);
    await saveSettings({ lastUsername: username });

    try {
      const result = await window.electronAPI.play({
        username,
        profile: profileVersion, // "1.21.8" або "1.21.4"
      });
      if (result && result.ok) {
        setStatus("Гра запускається…", false);
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

  // Кнопки запуску
  if (play1218Button) {
    play1218Button.addEventListener("click", () => startGame("1.21.8"));
  }
  if (play1214Button) {
    play1214Button.addEventListener("click", () => startGame("1.21.4"));
  }

  // Налаштування
  function openSettings() {
    if (settingsModal) settingsModal.classList.remove("hidden");
  }
  function closeSettings() {
    if (settingsModal) settingsModal.classList.add("hidden");
  }

  if (settingsButton) {
    settingsButton.addEventListener("click", openSettings);
  }
  if (settingsCloseButton) {
    settingsCloseButton.addEventListener("click", closeSettings);
  }
  if (settingsModal) {
    const backdrop = settingsModal.querySelector(".modal-backdrop");
    if (backdrop) backdrop.addEventListener("click", closeSettings);
  }

  if (closeOnPlayCheckbox) {
    closeOnPlayCheckbox.addEventListener("change", () => {
      saveSettings({ closeOnPlay: closeOnPlayCheckbox.checked });
    });
  }

  // Старт
  init();
});
