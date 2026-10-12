/**
 * Safe browser audio chime utility for real-time notification alerts
 * Uses Web Audio API oscillator synthesis (zero external files or network requests).
 */
export function playNotificationChime() {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Pleasant two-tone chime (F#5 -> A5)
    osc.frequency.setValueAtTime(739.99, ctx.currentTime);
    osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext blocked or not supported - silently ignore
  }
}
