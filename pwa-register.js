if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(() => {});
  });
}

let deferredInstallPrompt = null;

function currentPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  if (/android/i.test(platform) || /android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(platform) || /iphone|ipad|ipod/i.test(userAgent) || (/mac/i.test(platform) && navigator.maxTouchPoints > 1)) return "ios";
  if (/win/i.test(platform)) return "windows";
  if (/mac/i.test(platform)) return "mac";
  return "";
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

const installInstructions = {
  ios: {
    title: "Install Clocky on iOS",
    html: `<ol><li>Open Clocky in Safari.</li><li>Tap the Share button.</li><li>Tap <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>.</li></ol>`
  },
  android: {
    title: "Install Clocky on Android",
    html: `<p>If an automatic install prompt is unavailable:</p><ol><li>Open Clocky in Chrome.</li><li>Open the browser menu.</li><li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm the installation.</li></ol>`
  },
  windows: {
    title: "Install Clocky on Windows",
    html: `<ol><li>Open Clocky in Chrome or Microsoft Edge.</li><li>Select the install icon in the address bar, or open the browser menu.</li><li>Choose <strong>Install Clocky</strong> or <strong>Install app</strong>.</li><li>Confirm to add Clocky to your installed-app list.</li></ol>`
  },
  mac: {
    title: "Install Clocky on Mac",
    html: `<h3>Safari</h3><p>Open Clocky, then choose <strong>File → Add to Dock</strong>.</p><h3>Chrome or Edge</h3><p>Select the install icon in the address bar, or use the browser menu and choose <strong>Install Clocky</strong>.</p>`
  }
};

function closeInstallModal() {
  const modal = document.getElementById("installModal");
  if (modal) modal.hidden = true;
}

function showInstallInstructions(platform) {
  const instructions = installInstructions[platform];
  const modal = document.getElementById("installModal");
  if (!instructions || !modal) return;
  document.getElementById("installModalTitle").textContent = instructions.title;
  document.getElementById("installModalContent").innerHTML = `${isInstalled() && platform === currentPlatform() ? "<p><strong>Clocky is already open as an installed app.</strong></p>" : ""}${instructions.html}`;
  modal.hidden = false;
  document.getElementById("closeInstallModal").focus();
}

async function handleInstallChoice(platform) {
  if (platform !== "ios" && platform === currentPlatform() && deferredInstallPrompt && !isInstalled()) {
    const installPrompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome !== "accepted") showInstallInstructions(platform);
    return;
  }
  showInstallInstructions(platform);
}

function initializeInstallSection() {
  const platform = currentPlatform();
  document.querySelectorAll("[data-install-platform]").forEach(button => {
    button.classList.toggle("is-current", button.dataset.installPlatform === platform);
    button.addEventListener("click", () => handleInstallChoice(button.dataset.installPlatform));
  });
  document.getElementById("closeInstallModal")?.addEventListener("click", closeInstallModal);
  document.getElementById("dismissInstallModal")?.addEventListener("click", closeInstallModal);
  document.getElementById("installModal")?.addEventListener("click", event => {
    if (event.target.id === "installModal") closeInstallModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !document.getElementById("installModal")?.hidden) closeInstallModal();
  });
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});
window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; });

initializeInstallSection();
