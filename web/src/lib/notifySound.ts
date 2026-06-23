// A short, pleasant two-note chime for new-message alerts, synthesized with the
// Web Audio API so there is no audio file to ship and it works offline. Browsers
// block audio until the user has interacted with the page, so armAudio() resumes
// the context on the first gesture; playMessageChime() is then free to fire from
// a background poll.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try { ctx = new AC(); } catch { return null; }
  }
  return ctx;
}

// Resume the audio context on the first user gesture so later programmatic plays
// are allowed. Safe to call repeatedly; listeners remove themselves.
export function armAudio() {
  if (typeof window === "undefined") return;
  const unlock = () => {
    const c = getCtx();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export function playMessageChime() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;
  // A5 then E6: a clean rising "ding-dong" that reads as an arrival.
  const notes: [number, number][] = [
    [880.0, 0],
    [1318.5, 0.13],
  ];
  for (const [freq, t] of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + t;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.42);
  }
}
