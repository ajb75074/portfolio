// Optional cabin ambience: a low engine drone plus air-vent hiss, synthesized
// with Web Audio (no audio files). Always off until the visitor turns it on.
(() => {
  const button = document.querySelector('[data-cabin-sound]');
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!button) return;
  if (!AudioCtx) { button.closest('li')?.remove(); return; }

  let ctx, master, on = false;

  function noiseBuffer(context, seconds, brown) {
    const length = context.sampleRate * seconds;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) { last = (last + .02 * white) / 1.02; data[i] = last * 3.5; } else data[i] = white;
    }
    // Crossfade the ends so the loop point is inaudible.
    const fade = Math.floor(context.sampleRate * .25);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = data[i] * t + data[length - fade + i] * (1 - t);
    }
    return buffer;
  }

  function build() {
    ctx = new AudioCtx();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

    // Engine drone: brown noise through a low-pass.
    const drone = ctx.createBufferSource();
    drone.buffer = noiseBuffer(ctx, 6, true); drone.loop = true;
    const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 280;
    const droneGain = ctx.createGain(); droneGain.gain.value = .55;
    drone.connect(low).connect(droneGain).connect(master);

    // Air-vent hiss: white noise through a soft band-pass, much quieter.
    const hiss = ctx.createBufferSource();
    hiss.buffer = noiseBuffer(ctx, 4, false); hiss.loop = true;
    const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 1400; band.Q.value = .4;
    const hissGain = ctx.createGain(); hissGain.gain.value = .025;
    hiss.connect(band).connect(hissGain).connect(master);

    // Very slow swell, like engines settling at cruise.
    const lfo = ctx.createOscillator(); lfo.frequency.value = .07;
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = .08;
    lfo.connect(lfoDepth).connect(droneGain.gain);

    drone.start(); hiss.start(); lfo.start();
  }

  function set(next) {
    on = next;
    button.setAttribute('aria-pressed', String(on));
    button.title = on ? 'Mute cabin sound' : 'Play cabin sound';
    if (on && !ctx) build();
    if (!ctx) return;
    if (on) ctx.resume();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(on ? .35 : 0, now + (on ? 1.5 : .5));
    if (!on) setTimeout(() => { if (!on) ctx.suspend(); }, 600);
  }

  // The two-tone seatbelt chime, played when you sit down in 01A (sound on only).
  function ding() {
    if (!on || !ctx) return;
    const now = ctx.currentTime;
    [[988, 0], [784, .32]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(.18, now + delay + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + delay + 1.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay); osc.stop(now + delay + 1.5);
    });
  }
  window.avanieCabinSound = { ding };

  button.addEventListener('click', () => set(!on));
  // Don't keep droning in a background tab.
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    document.hidden ? ctx.suspend() : ctx.resume();
  });
})();
