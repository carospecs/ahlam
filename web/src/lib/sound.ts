// Synthesized "sonar ping" played when the AI scan finishes processing. No audio
// asset — it's generated with the Web Audio API, so it adds zero bytes, needs no
// network, and works offline. Audio is a nicety: every failure path is swallowed
// so it can never break the scan flow.
export function playSonarPing() {
  try {
    if (typeof window === "undefined") return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Autoplay policy: if the context starts suspended, resume it. The scan is
    // kicked off by a user click ("Run AI analysis"), so a gesture exists in the
    // session and resume() is allowed by the time results land.
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    // One "ring" = two sine pings: a base note and a fifth above it a beat later,
    // each with a sharp attack, a downward glide, and a long exponential tail —
    // the classic sonar feel.
    const ping = (freq: number, start: number, gain: number) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.86, now + start + 0.5);
      amp.gain.setValueAtTime(0.0001, now + start);
      amp.gain.exponentialRampToValueAtTime(gain, now + start + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.9);
      osc.connect(amp).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + 1.0);
    };

    ping(880, 0, 0.22);
    ping(1320, 0.16, 0.12);

    // Release the audio context after the tail so we don't leak one per scan.
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    /* audio is optional — never let it surface an error */
  }
}
