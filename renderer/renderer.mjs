// renderer/renderer.js

let currentSettings = null;

window.addEventListener("DOMContentLoaded", () => {
  const playButton = document.getElementById("playButton");
  const statusText = document.getElementById("statusText");
  const usernameInput = document.getElementById("usernameInput");

  const ramSlider = document.getElementById("ramSlider");
  const ramValue = document.getElementById("ramValue");
  const ramMaxLabel = document.getElementById("ramMaxLabel");

  const settingsButton = document.getElementById("settingsButton");
  const settingsModal = document.getElementById("settingsModal");
  const settingsCloseButton = document.getElementById("settingsCloseButton");
  const closeOnPlayCheckbox = document.getElementById("closeOnPlayCheckbox");

  function setStatus(text, isError = false) {
    statusText.textContent = text;
    statusText.classList.toggle("error", !!isError);
  }

  function setBusy(isBusy) {
    playButton.disabled = isBusy;
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
      const [settings, sys] = await Promise.all([
        window.electronAPI.getSettings(),
        window.electronAPI.getSystemRam(),
      ]);

      const totalMb = sys?.totalMb || 8192;
      // залишаємо хоча б 1 ГБ системі
      const safeMax = Math.max(1024, totalMb - 1024);
      const sliderMax =
        Math.max(512, Math.floor(safeMax / 256) * 256); // кратно 256

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
    } catch (e) {
      console.error("Init error:", e);
      setStatus("Помилка завантаження налаштувань.", true);
    }
  }

  // --- обробники UI ---

  ramSlider.addEventListener("input", () => {
    const value = Number(ramSlider.value || "0");
    ramValue.textContent = value.toString();
    saveSettings({ ramMb: value });
  });

  usernameInput.addEventListener("blur", () => {
    const name = usernameInput.value.trim();
    saveSettings({ lastUsername: name });
  });

  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      playButton.click();
    }
  });

  playButton.addEventListener("click", async () => {
    const username = usernameInput.value.trim();
    if (!username) {
      setStatus("Будь ласка, введіть нікнейм.", true);
      usernameInput.focus();
      return;
    }

    setStatus("Запускаємо гру...", false);
    setBusy(true);
    await saveSettings({ lastUsername: username });

    try {
      const result = await window.electronAPI.play({ username });
      if (result && result.ok) {
        setStatus("Гра запускається...", false);
        // Якщо встановлено "закривати", вікно закриється з боку main процесу
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
  });

  // Налаштування
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

  // Старт
  init();
});
