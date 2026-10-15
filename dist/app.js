import { createMusicBox } from "./audio.js";
import { createFirstPersonController } from "./player.js";
import { getEasterEggYouTubeUrl } from "./config.js";
import { TEXT } from "./content.js";

const $ = (id) => document.getElementById(id);
const isTouch = () =>
  matchMedia("(pointer:coarse)").matches || innerWidth <= 760;
const music = createMusicBox();
const dialogs = [
  "pause-dialog",
  "help-dialog",
  "wish-dialog",
  "letter",
  "easter-dialog",
]
  .map($)
  .filter(Boolean);

// mode, hareket ve pencere durumunun tek kaynağıdır.
let mode = "intro";
let garden;
let player;
let target = null;
let ready = false;
let failed = false;
let disposed = false;
let wasLocked = false;
let candlesLit = true;
let musicEnabled = true;
let musicStarting = false;
let musicRequest = 0;
let stickPointer = null;
let toastTimer;
let celebrationTimer;
let guideTimer;

// HTML'deki data-text / data-label / data-title değerleri content.js'ye bağlanır.
function applyContent() {
  const getText = (key) =>
    key.split(".").reduce((value, part) => value?.[part], TEXT);
  for (const [attribute, destination] of [
    ["data-text", "textContent"],
    ["data-label", "aria-label"],
    ["data-title", "title"],
  ]) {
    document.querySelectorAll(`[${attribute}]`).forEach((element) => {
      const value = getText(element.getAttribute(attribute));
      if (typeof value !== "string") return;
      if (destination === "textContent") element.textContent = value;
      else element.setAttribute(destination, value);
    });
  }
  document.title = TEXT.page.title;
  document.querySelector('meta[name="description"]').content =
    TEXT.page.description;
  $("world").setAttribute("aria-label", TEXT.page.worldLabel);
  const paragraphs = TEXT.letter.paragraphs.map((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    return paragraph;
  });
  $("letter-paragraphs").replaceChildren(...paragraphs);
}

function setMode(nextMode) {
  mode = nextMode;
  document.body.dataset.mode = nextMode;
}

function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 4200);
}

function syncMusic() {
  const label = music.playing ? TEXT.controls.musicOff : TEXT.controls.musicOn;
  $("music").setAttribute("aria-pressed", String(music.playing));
  $("music").setAttribute("aria-label", label);
  $("pause-music").textContent = label;
}

async function playMusic() {
  if (musicStarting || music.playing) return;
  const request = ++musicRequest;
  musicStarting = true;
  try {
    await music.play();
  } catch {
    if (request === musicRequest) toast(TEXT.messages.musicError);
  } finally {
    if (request === musicRequest) musicStarting = false;
    syncMusic();
  }
}

function pauseMusic() {
  // Bekleyen AudioContext açılışı da iptal edilir.
  musicRequest++;
  musicStarting = false;
  music.pause();
  syncMusic();
}

function toggleMusic() {
  if (music.playing || musicStarting) {
    musicEnabled = false;
    pauseMusic();
  } else {
    musicEnabled = true;
    void playMusic();
  }
}

function showTarget(nextTarget) {
  target = nextTarget;
  const visible = mode === "playing" && Boolean(target);
  $("target-prompt").hidden = !visible;
  $("crosshair").classList.toggle("active", visible);
  if (!target) return;
  const copy = TEXT.objects[target.id];
  $("target-name").textContent = copy?.label || target.label;
  $("target-action").textContent =
    target.id === "cake" && !candlesLit
      ? TEXT.objects.relight
      : copy?.action || target.action;
}

function showDialog(id) {
  if (mode !== "playing" && id !== "letter") return;
  const dialog = $(id);
  if (!dialog) {
    if (id === "easter-dialog") toast(TEXT.messages.found);
    return;
  }
  // Modu önce değiştir: fare kilidinin açılması ikinci bir menü açmasın.
  setMode(
    id === "letter" ? "letter" : id === "wish-dialog" ? "wish" : "paused",
  );
  player?.setEnabled(false);
  player?.unlock();
  releaseStick();
  showTarget(null);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function resume(fromGesture = true) {
  dialogs.forEach((dialog) => {
    if (dialog.open) dialog.close();
  });
  if (!ready || failed) {
    setMode("intro");
    return;
  }
  setMode("playing");
  player.setEnabled(true);
  if (fromGesture) {
    if (!isTouch()) player.requestLock();
    if (musicEnabled && !music.playing) void playMusic();
  }
  $("free-look").hidden = isTouch() || player.locked;
}

function closeDialog(id, fromGesture = true) {
  $(id)?.close();
  resume(fromGesture);
}

function interact(id) {
  if (mode !== "playing") return;
  if (id === "note") showDialog("letter");
  if (id === "takodachi") {
    const link = getEasterEggYouTubeUrl();
    if (!link) return showDialog("easter-dialog");
    setMode("leaving");
    player.setEnabled(false);
    pauseMusic();
    location.assign(link);
  }
  if (id === "cake") {
    if (candlesLit) return showDialog("wish-dialog");
    candlesLit = true;
    garden.setLit(true);
    showTarget(target);
    toast(TEXT.messages.relit);
  }
}

function start() {
  if (!ready || failed) return;
  $("intro").classList.add("departing");
  $("intro").inert = true;
  $("hud").hidden = false;
  // Tek ve sabit parça, ilk kullanıcı tıklamasıyla başlar.
  resume(true);
  clearTimeout(guideTimer);
  guideTimer = setTimeout(
    () => $("control-guide").classList.add("quiet"),
    16000,
  );
}

function resetWalk() {
  player.reset();
  garden.reset();
  candlesLit = true;
  $("celebration-message").hidden = true;
  clearTimeout(celebrationTimer);
  resume(true);
  toast(TEXT.messages.reset);
}

function blowCandles() {
  candlesLit = false;
  garden.setLit(false);
  garden.celebrate();
  closeDialog("wish-dialog");
  clearTimeout(celebrationTimer);
  $("celebration-message").hidden = true;
  requestAnimationFrame(() => {
    $("celebration-message").hidden = false;
    celebrationTimer = setTimeout(
      () => ($("celebration-message").hidden = true),
      6200,
    );
  });
}

// Mobil hareket çubuğu. Menü açıldığında hareket mutlaka sıfırlanır.
const joystick = $("joystick");
const knob = $("joystick-knob");
function moveStick(event) {
  if (stickPointer !== event.pointerId) return;
  const bounds = joystick.getBoundingClientRect();
  let x = event.clientX - bounds.left - bounds.width / 2;
  let y = event.clientY - bounds.top - bounds.height / 2;
  const limit = bounds.width * 0.3;
  const length = Math.hypot(x, y);
  if (length > limit) {
    x *= limit / length;
    y *= limit / length;
  }
  knob.style.transform = `translate(${x}px,${y}px)`;
  player?.setMove(x / limit, -y / limit);
}

function releaseStick(event) {
  if (event && event.pointerId !== stickPointer) return;
  const releasedPointer = stickPointer;
  stickPointer = null;
  if (releasedPointer !== null && joystick.hasPointerCapture(releasedPointer)) {
    joystick.releasePointerCapture(releasedPointer);
  }
  knob.style.transform = "";
  player?.setMove(0, 0);
}

function bindEvents() {
  $("start").addEventListener("click", () =>
    failed ? location.reload() : start(),
  );
  $("fallback-letter").addEventListener("click", () => showDialog("letter"));
  $("music").addEventListener("click", toggleMusic);
  $("pause-music").addEventListener("click", toggleMusic);
  $("pause").addEventListener("click", () => showDialog("pause-dialog"));
  $("help").addEventListener("click", () => showDialog("help-dialog"));
  $("resume").addEventListener("click", () => resume(true));
  for (const [button, dialog] of [
    ["close-help", "help-dialog"],
    ["close-wish", "wish-dialog"],
    ["close-easter", "easter-dialog"],
    ["close-letter", "letter"],
    ["letter-return", "letter"],
  ])
    $(button)?.addEventListener("click", () => closeDialog(dialog));
  $("reset").addEventListener("click", resetWalk);
  $("blow").addEventListener("click", blowCandles);
  $("interact").addEventListener("click", () => {
    if (target) interact(target.id);
  });
  $("free-look").addEventListener("click", () => player?.requestLock());

  dialogs.forEach((dialog) => {
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeDialog(dialog.id, false);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (outside) closeDialog(dialog.id);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.repeat ||
      event.target instanceof HTMLInputElement ||
      event.target.isContentEditable
    )
      return;
    if (event.code === "KeyM" && mode !== "intro") {
      event.preventDefault();
      toggleMusic();
    }
    if (event.code === "KeyH" && mode === "playing") {
      event.preventDefault();
      showDialog("help-dialog");
    }
    if (event.code === "Escape" && mode === "playing") {
      event.preventDefault();
      showDialog("pause-dialog");
    }
  });

  // Sekme gizlenirse ses ve hareket durur. Devam et aynı müziği sürdürür.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseMusic();
      if (mode === "playing") showDialog("pause-dialog");
    }
    syncMusic();
  });
  window.addEventListener("blur", () => {
    if (mode === "playing") showDialog("pause-dialog");
  });
  joystick.addEventListener("pointerdown", (event) => {
    if (mode !== "playing") return;
    event.preventDefault();
    stickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  joystick.addEventListener("pointermove", moveStick);
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    joystick.addEventListener(event, releaseStick);
  }
}

function fail(error) {
  if (failed || disposed) return;
  failed = true;
  ready = false;
  player?.setEnabled(false);
  pauseMusic();
  dialogs.forEach((dialog) => dialog.close());
  setMode("intro");
  $("intro").classList.remove("departing");
  $("intro").inert = false;
  $("hud").hidden = true;
  $("loader").hidden = true;
  $("start-arrow").hidden = false;
  $("start-label").textContent = TEXT.intro.retry;
  $("start").disabled = false;
  $("loading-status").textContent = TEXT.intro.error;
  $("fallback-letter").hidden = false;
  console.warn("Bahçe kullanılamadı:", error?.message || error);
}

async function initializeGarden() {
  try {
    const { createGarden } = await import("./garden.js");
    garden = await createGarden($("world"), {
      reducedMotion: matchMedia("(prefers-reduced-motion:reduce)").matches,
      onError: fail,
    });
    if (failed) return;
    garden.canvas.setAttribute("aria-label", TEXT.page.worldLabel);
    player = createFirstPersonController({
      camera: garden.camera,
      element: garden.canvas,
      colliders: garden.colliders,
      bounds: garden.bounds,
      interactables: garden.interactables,
      onTargetChange: showTarget,
      onInteract: interact,
      onLockError: () => {
        if (mode !== "playing") return;
        $("free-look").hidden = false;
        toast(TEXT.messages.freeLook);
      },
      onLockChange: (locked) => {
        const lostLock = wasLocked && !locked;
        wasLocked = locked;
        $("free-look").hidden = locked || isTouch();
        if (lostLock && mode === "playing") showDialog("pause-dialog");
      },
    });
    garden.setFrameHandler((delta) => {
      if (mode === "playing") player.update(delta);
    });
    ready = true;
    $("loader").hidden = true;
    $("start-arrow").hidden = false;
    $("start-label").textContent = TEXT.intro.start;
    $("start").disabled = false;
    $("loading-status").textContent = isTouch()
      ? TEXT.intro.touchHint
      : TEXT.intro.desktopHint;
  } catch (error) {
    fail(error);
  }
}

function dispose() {
  if (disposed) return;
  disposed = true;
  clearTimeout(toastTimer);
  clearTimeout(celebrationTimer);
  clearTimeout(guideTimer);
  music.dispose();
  player?.dispose();
  garden?.dispose();
}

window.addEventListener("pagehide", (event) => {
  pauseMusic();
  releaseStick();
  if (!event.persisted) dispose();
});

applyContent();
bindEvents();
void initializeGarden();
