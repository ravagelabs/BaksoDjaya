import { ref, onMounted, onUnmounted } from "vue";

const API_URL = import.meta.env.VITE_API_URL || "";
const TYPES = ["kitchen:new", "bill:changed"];

// Satu koneksi SSE dipakai bersama oleh semua halaman yang sedang terbuka
export const liveConnected = ref(false);
let source = null;
let users = 0;
const handlers = new Set();

function connect() {
  source = new EventSource(`${API_URL}/events`, { withCredentials: true });
  source.addEventListener("ready", () => (liveConnected.value = true));
  source.onerror = () => (liveConnected.value = false); // EventSource menyambung ulang sendiri
  for (const type of TYPES) {
    source.addEventListener(type, (e) => {
      let data = {};
      try {
        data = JSON.parse(e.data);
      } catch {
        /* abaikan data rusak */
      }
      for (const fn of handlers) fn(type, data);
    });
  }
}

// Pakai di komponen: useLive((type, data) => { ... })
export function useLive(handler) {
  onMounted(() => {
    handlers.add(handler);
    if (users++ === 0) connect();
  });
  onUnmounted(() => {
    handlers.delete(handler);
    if (--users === 0) {
      source?.close();
      source = null;
      liveConnected.value = false;
    }
  });
  return { connected: liveConnected };
}

// ---- Bunyi notifikasi (Web Audio, tanpa file suara) ----
let audio = null;

// Browser (terutama Safari iPad) baru mengizinkan suara setelah ada ketukan di halaman
export function unlockSound() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audio = new Ctx();
  }
  if (audio.state === "suspended") audio.resume();
}

export const soundReady = () => Boolean(audio && audio.state === "running");

// Dua nada pendek "ding-dong"
export function chime() {
  if (!soundReady()) return;
  const now = audio.currentTime;
  for (const [i, freq] of [880, 660].entries()) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}
