// renderer/renderer.mjs

let currentSettings = null;

window.addEventListener("DOMContentLoaded", () => {
  // --------- Базові елементи ----------
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

  // --------- Скіни: елементи ----------
  const skinsButton = document.getElementById("skinsButton");
  const skinsModal = document.getElementById("skinsModal");
  const skinsCloseButton = document.getElementById("skinsCloseButton");
  const skinCanvas = document.getElementById("skinCanvas");
  const skinsGrid = document.getElementById("skinsGrid");
  const addSkinButton = document.getElementById("addSkinButton");
  const skinFileInput = document.getElementById("skinFileInput");

  // --------- Статуси / допоміжне ----------
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

  // --------- INIT (налаштування + версія лаунчера) ----------
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

      if (usernameInput) usernameInput.value = settings.lastUsername || "";
      if (closeOnPlayCheckbox)
        closeOnPlayCheckbox.checked = !!settings.closeOnPlay;

      currentSettings = {
        ...settings,
        ramMb: ramFromSettings,
        closeOnPlay: !!settings.closeOnPlay,
      };

      // статуси автооновлення
      if (window.electronAPI.onUpdateStatus) {
        window.electronAPI.onUpdateStatus((msg) => {
          if (msg) setStatus(msg, false);
        });
      }

      // завантажити скіни
      loadSkinsFromStorage();
      if (skins.length > 0) {
        setActiveSkin(skins[0].id);
      } else {
        renderEmptySkinCanvas();
        rebuildSkinsGrid();
      }
    } catch (e) {
      console.error("Init error:", e);
      setStatus("Помилка завантаження налаштувань.", true);
    }
  }

  // --------- RAM ----------
  if (ramSlider) {
    ramSlider.addEventListener("input", () => {
      const value = Number(ramSlider.value || "0");
      if (ramValue) ramValue.textContent = value.toString();
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
        // За замовчуванням – модовий сервер 1.21.4
        startGame("1.21.4");
      }
    });
  }

  // --------- Запуск гри ----------
  async function startGame(profile) {
    const username = (usernameInput?.value || "").trim();
    if (!username) {
      setStatus("Будь ласка, введіть нікнейм.", true);
      usernameInput?.focus();
      return;
    }

    setStatus(`Запускаємо Minecraft ${profile}…`, false);
    setBusy(true);
    await saveSettings({ lastUsername: username });

    try {
      const result = await window.electronAPI.play({ username, profile });
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

  if (play1218Button) {
    play1218Button.addEventListener("click", () => startGame("1.21.8"));
  }
  if (play1214Button) {
    play1214Button.addEventListener("click", () => startGame("1.21.4"));
  }

  // --------- Модалка налаштувань ----------
  function openSettings() {
    settingsModal?.classList.remove("hidden");
  }
  function closeSettings() {
    settingsModal?.classList.add("hidden");
  }

  settingsButton?.addEventListener("click", openSettings);
  settingsCloseButton?.addEventListener("click", closeSettings);
  settingsModal
    ?.querySelector(".modal-backdrop")
    ?.addEventListener("click", closeSettings);

  closeOnPlayCheckbox?.addEventListener("change", () => {
    saveSettings({ closeOnPlay: !!closeOnPlayCheckbox.checked });
  });

  // =========================================================
  //                  БЛОК РОБОТИ З СКІНАМИ
  // =========================================================

  /**
   * Структура скіна:
   * { id: string, name: string, dataUrl: string }
   */
  let skins = [];
  let currentSkinId = null;
  let currentSkinImage = null;
  let skinZoom = 1.7; // ще використовується в 2D fallback

  // --- 3D Viewer (skinview3d) ---
  let skinViewer = null;
  let skinOrbitControls = null;

  const SKINS_KEY = "hyperion_skins_v1";

  function loadSkinsFromStorage() {
    try {
      const raw = localStorage.getItem(SKINS_KEY);
      if (!raw) {
        skins = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) skins = parsed;
      else skins = [];
    } catch (e) {
      console.warn("Не вдалось прочитати скіни з localStorage:", e);
      skins = [];
    }
  }

  function saveSkinsToStorage() {
    try {
      localStorage.setItem(SKINS_KEY, JSON.stringify(skins));
    } catch (e) {
      console.warn("Не вдалось зберегти скіни:", e);
    }
  }

  function disposeSkinViewer() {
    if (skinViewer) {
      try {
        skinViewer.dispose();
      } catch (e) {
        console.warn("Помилка dispose SkinViewer:", e);
      }
      skinViewer = null;
      skinOrbitControls = null;
    }
  }

  function renderEmptySkinCanvas() {
    if (!skinCanvas) return;

    // якщо був 3D viewer – прибираємо
    disposeSkinViewer();

    const ctx = skinCanvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = skinCanvas;
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createRadialGradient(
      width / 2,
      height * 0.2,
      10,
      width / 2,
      height / 2,
      width * 0.8
    );
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#020617");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#64748b";
    ctx.font = "13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Скін не обрано", width / 2, height / 2);
  }

  function rebuildSkinsGrid() {
    if (!skinsGrid) return;
    skinsGrid.innerHTML = "";

    if (skins.length === 0) {
      const empty = document.createElement("div");
      empty.className = "skins-empty";
      empty.textContent = "Скінів поки немає. Додайте новий.";
      skinsGrid.appendChild(empty);
      return;
    }

    for (const skin of skins) {
      const card = document.createElement("div");
      card.className = "skin-card";
      if (skin.id === currentSkinId) card.classList.add("active");

      const img = document.createElement("img");
      img.className = "skin-img";
      img.src = skin.dataUrl;
      img.alt = skin.name || "skin";

      const name = document.createElement("div");
      name.className = "skin-name";
      name.textContent = skin.name || "Скін";

      const removeBtn = document.createElement("button");
      removeBtn.className = "skin-remove-btn";
      removeBtn.textContent = "✕";

      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = skins.findIndex((s) => s.id === skin.id);
        if (idx !== -1) {
          skins.splice(idx, 1);
          if (currentSkinId === skin.id) {
            currentSkinId = skins[0]?.id ?? null;
            if (currentSkinId) {
              loadImageForSkin(currentSkinId);
            } else {
              currentSkinImage = null;
              renderEmptySkinCanvas();
            }
          }
          saveSkinsToStorage();
          rebuildSkinsGrid();
        }
      });

      card.addEventListener("click", () => {
        setActiveSkin(skin.id);
      });

      card.appendChild(img);
      card.appendChild(name);
      card.appendChild(removeBtn);
      skinsGrid.appendChild(card);
    }
  }

  function setActiveSkin(id) {
    if (!id) return;
    currentSkinId = id;
    loadImageForSkin(id);
    rebuildSkinsGrid();
  }

  function loadImageForSkin(id) {
    const skin = skins.find((s) => s.id === id);
    if (!skin || !skin.dataUrl) {
      currentSkinImage = null;
      renderEmptySkinCanvas();
      return;
    }

    const img = new Image();
    img.onload = () => {
      currentSkinImage = img;
      renderCurrentSkin();
    };
    img.onerror = () => {
      console.warn("Не вдалось завантажити зображення скіна");
      currentSkinImage = null;
      renderEmptySkinCanvas();
    };
    img.src = skin.dataUrl;
  }

  // ---------- 3D рендер через skinview3d ----------

  function initSkinViewerIfNeeded() {
    if (!skinCanvas) return null;
    if (!window.skinview3d) {
      console.warn("skinview3d не завантажений – використовую 2D рендер.");
      return null;
    }

    // якщо вже створений — просто повертаємо, не змінюємо розмір
    if (skinViewer) {
      return skinViewer;
    }

    const { SkinViewer, createOrbitControls } = window.skinview3d;

    const width =
      skinCanvas.width || skinCanvas.clientWidth || 260;
    const height =
      skinCanvas.height || skinCanvas.clientHeight || 360;

    skinViewer = new SkinViewer({
      canvas: skinCanvas,
      width,
      height,
    });

    // Трохи камеру підкрутимо, щоб модель була по центру
    skinViewer.zoom = 0.9;

    skinOrbitControls = createOrbitControls(skinViewer);
    skinOrbitControls.enableZoom = true;
    skinOrbitControls.enablePan = false;

    return skinViewer;
  }

  function renderSkin3D() {
    const viewer = initSkinViewerIfNeeded();
    if (!viewer) {
      // fallback
      renderSkin2D();
      return;
    }

    const skin = skins.find((s) => s.id === currentSkinId);
    if (!skin) {
      renderEmptySkinCanvas();
      return;
    }

    // просто перезавантажуємо скін, розмір viewer не чіпаємо
    viewer.loadSkin(skin.dataUrl);
  }

  // ---------- Старий 2D рендер (fallback, якщо нема skinview3d) ----------

  function renderSkin2D() {
    if (!skinCanvas) return;
    const ctx = skinCanvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;

    const { width, height } = skinCanvas;
    ctx.clearRect(0, 0, width, height);

    // фон
    const gradient = ctx.createRadialGradient(
      width / 2,
      height * 0.25,
      10,
      width / 2,
      height / 2,
      width * 0.9
    );
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#000000");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (!currentSkinImage) return;

    const img = currentSkinImage;

    // Висота моделі: 32 пікселя (голова + торс + ноги)
    const baseScale = Math.floor((height * 0.8) / 32);
    const scale = baseScale * skinZoom;

    const modelPixelWidth = 16; // 4 (рука) + 8 (торс) + 4 (рука)
    const modelPixelHeight = 32;

    const drawWidth = modelPixelWidth * scale;
    const drawHeight = modelPixelHeight * scale;

    const baseX = Math.round((width - drawWidth) / 2);
    const baseY = Math.round((height - drawHeight) / 2);

    function drawPart(sx, sy, sw, sh, dx, dy) {
      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        baseX + dx * scale,
        baseY + dy * scale,
        sw * scale,
        sh * scale
      );
    }

    // ----- Базовий шар -----
    // голова
    drawPart(8, 8, 8, 8, 4, 0); // head front

    // торс
    drawPart(20, 20, 8, 12, 4, 8); // body front

    // права рука (з точки зору глядача – зліва)
    drawPart(44, 20, 4, 12, 0, 8); // right arm front

    // ліва рука (використовуємо її реальні координати, якщо скіни асиметричні)
    drawPart(36, 52, 4, 12, 12, 8); // left arm front

    // права нога
    drawPart(4, 20, 4, 12, 4, 20); // right leg front

    // ліва нога – її власний шмат
    drawPart(20, 52, 4, 12, 8, 20); // left leg front

    // ----- Зовнішні шари (капюшон, куртка, рукави, штани) -----

    // шапка/капюшон (helmet layer)
    drawPart(40, 8, 8, 8, 4, 0);

    // куртка / друга шкіра торса
    drawPart(20, 36, 8, 12, 4, 8);

    // рукави (правий і лівий окремо)
    drawPart(44, 36, 4, 12, 0, 8); // права
    drawPart(52, 52, 4, 12, 12, 8); // ліва overlay

    // верхній шар штанів
    drawPart(4, 36, 4, 12, 4, 20); // права
    drawPart(4, 52, 4, 12, 8, 20); // ліва
  }

  // ---------- Загальна функція рендеру ----------
  function renderCurrentSkin() {
    if (!currentSkinImage && !window.skinview3d) {
      renderEmptySkinCanvas();
      return;
    }

    if (skinCanvas && window.skinview3d) {
      renderSkin3D();
    } else {
      renderSkin2D();
    }
  }

  // Зум колесиком миші — тільки для 2D fallback
  if (skinCanvas) {
    skinCanvas.addEventListener(
      "wheel",
      (e) => {
        if (!currentSkinImage) return;

        // якщо працює 3D viewer – не чіпаємо колесо, ним керує OrbitControls
        if (window.skinview3d && skinViewer) {
          return;
        }

        e.preventDefault();
        const dir = Math.sign(e.deltaY);
        skinZoom += dir < 0 ? 0.15 : -0.15;
        if (skinZoom < 0.8) skinZoom = 0.8;
        if (skinZoom > 3.0) skinZoom = 3.0;
        renderCurrentSkin();
      },
      { passive: false }
    );
  }

  // --------- Відкриття/закриття модалки скінів ----------
  function openSkinsModal() {
    skinsModal?.classList.remove("hidden");
  }
  function closeSkinsModal() {
    skinsModal?.classList.add("hidden");
  }

  skinsButton?.addEventListener("click", openSkinsModal);
  skinsCloseButton?.addEventListener("click", closeSkinsModal);
  skinsModal
    ?.querySelector(".modal-backdrop")
    ?.addEventListener("click", closeSkinsModal);

  // --------- Додавання нового скіна ----------
  addSkinButton?.addEventListener("click", () => {
    skinFileInput?.click();
  });

  skinFileInput?.addEventListener("change", () => {
    const file = skinFileInput.files?.[0];
    if (!file) return;

    if (!file.type.includes("png")) {
      alert("Будь ласка, виберіть PNG-файл зі скіною.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const name = file.name;

      skins.push({ id, name, dataUrl });
      saveSkinsToStorage();
      setActiveSkin(id);
    };
    reader.readAsDataURL(file);
  });

  // --------- Старт ----------
  init();
});
