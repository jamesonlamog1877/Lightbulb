// ---------- Elements ----------
const body      = document.body;
const switchBtn = document.getElementById("switch");
const statusTxt = document.getElementById("status");
const soundBtn  = document.getElementById("sound");

// ---------- State ----------
let isOn    = false;
let soundOn = true;

// ---------- Optional: use your own sound files ----------
// Put .mp3/.wav files in a "sounds" folder and write their paths here.
// Leave as "" to use the built-in generated sounds.
const SOUND_FILES = {
  on:  "",   // e.g. "sounds/switch-on.mp3"
  off: ""    // e.g. "sounds/switch-off.mp3"
};

// ---------- Built-in sounds (Web Audio, no files needed) ----------
let audioCtx = null;
let humNodes = null;

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// A short "click-clack" like a real switch
function playClick(turningOn) {
  const ctx = getAudio();
  const t = ctx.currentTime;

  // 1) sharp click: a tiny burst of filtered noise
  const length = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = turningOn ? 2600 : 1800;   // "on" is a little brighter
  filter.Q.value = 1.2;

  noise.connect(filter).connect(ctx.destination);
  noise.start(t);

  // 2) low thunk: the body of the switch
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(turningOn ? 190 : 140, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
  oscGain.gain.setValueAtTime(0.5, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(oscGain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.12);

  // 3) tiny "tink" of the filament when the bulb turns on
  if (turningOn) {
    const tink = ctx.createOscillator();
    const tinkGain = ctx.createGain();
    tink.type = "sine";
    tink.frequency.value = 1900;
    tinkGain.gain.setValueAtTime(0.0001, t + 0.03);
    tinkGain.gain.exponentialRampToValueAtTime(0.06, t + 0.04);
    tinkGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    tink.connect(tinkGain).connect(ctx.destination);
    tink.start(t + 0.03);
    tink.stop(t + 0.4);
  }
}

// A very quiet electrical hum while the bulb is on
function startHum() {
  if (humNodes) return;
  const ctx = getAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 120;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 400;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 0.4);
  osc.connect(lowpass).connect(gain).connect(ctx.destination);
  osc.start();
  humNodes = { osc, gain };
}

function stopHum() {
  if (!humNodes) return;
  const ctx = getAudio();
  const { osc, gain } = humNodes;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
  osc.stop(ctx.currentTime + 0.2);
  humNodes = null;
}

function playSound(turningOn) {
  if (!soundOn) return;
  const file = turningOn ? SOUND_FILES.on : SOUND_FILES.off;
  if (file) {
    new Audio(file).play().catch(() => {});
  } else {
    playClick(turningOn);
  }
  if (!file) turningOn ? startHum() : stopHum();
}

// ---------- Switch logic ----------
function setLight(on) {
  isOn = on;

  body.classList.toggle("on", isOn);
  switchBtn.setAttribute("aria-checked", String(isOn));
  statusTxt.textContent = isOn ? "The light is on" : "The light is off";

  // flicker only when turning on
  body.classList.remove("flicker");
  if (isOn) {
    void body.offsetWidth;          // restart the animation
    body.classList.add("flicker");
  }

  playSound(isOn);
}

switchBtn.addEventListener("click", () => setLight(!isOn));

// ---------- Sound on / off button ----------
soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
  soundBtn.setAttribute("aria-pressed", String(soundOn));
  if (!soundOn) stopHum();
  else if (isOn) startHum();
});