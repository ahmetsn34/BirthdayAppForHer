// An original 24-second music-box phrase. Audio starts only through play().
export function createMusicBox() {
  const beat = 0.75;
  const melody = [
    [0, 74],
    [1, 78],
    [2, 81],
    [3, 78],
    [4, 76],
    [5, 78],
    [6, 81, 1.5],
    [7.5, 83, 0.5],
    [8, 85],
    [9.5, 83, 0.5],
    [10, 81],
    [11, 78],
    [12, 76],
    [13, 74],
    [14, 73, 1.5],
    [16, 74],
    [17, 78],
    [18, 81],
    [19, 86],
    [20, 85, 1.5],
    [21.5, 83, 0.5],
    [22, 81],
    [23, 78],
    [24, 79],
    [25, 78],
    [26, 76],
    [27, 73],
    [28, 74, 2],
    [30, 81],
    [31, 78],
  ];
  const bass = [
    [0, 50],
    [4, 47],
    [8, 55],
    [12, 57],
    [16, 50],
    [20, 47],
    [24, 55],
    [28, 50],
  ];
  const notes = [
    ...melody.map(([at, midi, length = 1]) => ({
      at,
      midi,
      length,
      volume: 0.055,
    })),
    ...bass.map(([at, midi]) => ({ at, midi, length: 3, volume: 0.035 })),
  ].sort((a, b) => a.at - b.at);
  const loopDuration = 32 * beat;
  const attack = 0.012;
  const silence = 0.0001;
  const masterVolume = 0.55;
  const page = globalThis.document;
  const voices = new Set();
  let context, master, timer, suspendTimer, pending;
  let active = false,
    disposed = false,
    epoch = 0;
  // playhead is the elapsed score time, independent of the audio context clock.
  // Pausing saves it; resuming moves the clock anchor without restarting the tune.
  let playhead = 0,
    anchorTime = 0,
    cycle = 0,
    noteIndex = 0;

  const noteDuration = (note) => Math.min(3.4, 1.8 + note.length * 0.45);

  function chime(note, time, elapsed = 0) {
    const envelope = context.createGain();
    envelope.connect(master);
    const duration = noteDuration(note);
    // Rebuild a paused note at its remaining decay, without striking it again.
    const level =
      elapsed < attack
        ? silence * (note.volume / silence) ** (elapsed / attack)
        : note.volume *
          (silence / note.volume) ** ((elapsed - attack) / (duration - attack));
    envelope.gain.setValueAtTime(level, time);
    if (elapsed < attack) {
      envelope.gain.exponentialRampToValueAtTime(
        note.volume,
        time + attack - elapsed,
      );
    }
    envelope.gain.exponentialRampToValueAtTime(
      silence,
      time + duration - elapsed,
    );
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    const oscillators = [1, 2, 3].map((harmonic, index) => {
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * harmonic;
      partial.gain.value = [0.8, 0.16, 0.04][index];
      oscillator.connect(partial).connect(envelope);
      oscillator.start(time);
      oscillator.stop(time + duration - elapsed + 0.03);
      return { oscillator, partial };
    });
    const voice = { envelope, oscillators };
    voices.add(voice);
    oscillators[0].oscillator.onended = () => {
      for (const { oscillator, partial } of oscillators) {
        oscillator.disconnect();
        partial.disconnect();
      }
      envelope.disconnect();
      voices.delete(voice);
    };
  }

  function seek(position) {
    cycle = Math.floor(position / loopDuration);
    const withinLoop = position - cycle * loopDuration;
    noteIndex = notes.findIndex((note) => note.at * beat >= withinLoop);
    if (noteIndex < 0) {
      noteIndex = 0;
      cycle++;
    }
  }

  const nextNoteTime = () =>
    anchorTime + cycle * loopDuration + notes[noteIndex].at * beat;

  function schedule() {
    if (!active || context.state !== "running") return;
    const now = context.currentTime;
    // Skip missed notes after a stalled frame while preserving the score position.
    if (nextNoteTime() < now - 0.04) seek(Math.max(0, now - anchorTime));
    while (nextNoteTime() < now + 0.2) {
      chime(notes[noteIndex], Math.max(now, nextNoteTime()));
      if (++noteIndex === notes.length) {
        noteIndex = 0;
        cycle++;
      }
    }
  }

  function pause() {
    const stoppedEpoch = ++epoch;
    if (active && context)
      playhead = Math.max(0, context.currentTime - anchorTime);
    active = false;
    pending = null;
    clearInterval(timer);
    clearTimeout(suspendTimer);
    timer = undefined;
    if (!context || context.state === "closed") return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.04);
    for (const { oscillators } of voices) {
      for (const { oscillator } of oscillators) {
        try {
          oscillator.stop(now + 0.05);
        } catch {
          /* Already ended. */
        }
      }
    }
    suspendTimer = setTimeout(() => {
      if (!active && epoch === stoppedEpoch && context.state === "running") {
        context.suspend().catch(() => {});
      }
    }, 70);
  }

  const onVisibility = () => {
    if (page.hidden) pause();
  };
  const onStateChange = () => {
    if (active && context.state !== "running") pause();
  };
  page?.addEventListener("visibilitychange", onVisibility);

  return {
    async play() {
      if (disposed)
        throw new Error("Müzik kutusu kapatıldı. Sayfayı yenileyebilirsin.");
      if (active) return;
      if (pending) return pending;
      if (page?.hidden) return;
      const thisEpoch = ++epoch;
      clearTimeout(suspendTimer);
      const operation = (async () => {
        const AudioContext =
          globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext)
          throw new Error(
            "Bu tarayıcı sesi desteklemiyor. Güncel bir tarayıcı deneyebilirsin.",
          );
        try {
          if (!context) {
            context = new AudioContext({ latencyHint: "playback" });
            master = context.createGain();
            master.gain.value = 0;
            master.connect(context.destination);
            context.addEventListener("statechange", onStateChange);
          }
          await context.resume();
        } catch {
          throw new Error(
            "Müzik başlatılamadı. Ses düğmesine yeniden dokunabilirsin.",
          );
        }
        if (disposed || thisEpoch !== epoch) return;
        if (page?.hidden) {
          pause();
          return;
        }
        if (context.state !== "running")
          throw new Error(
            "Tarayıcı sesi duraklattı. Ses düğmesine yeniden dokunabilirsin.",
          );
        active = true;
        const startTime = context.currentTime + 0.08;
        anchorTime = startTime - playhead;
        seek(playhead);
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(0, context.currentTime);
        master.gain.linearRampToValueAtTime(
          masterVolume,
          context.currentTime + 0.3,
        );
        for (const note of notes) {
          const at = note.at * beat;
          const previousCycle = Math.ceil((playhead - at) / loopDuration) - 1;
          const previousOnset = previousCycle * loopDuration + at;
          const elapsed = playhead - previousOnset;
          if (
            previousOnset >= 0 &&
            elapsed > 0 &&
            elapsed < noteDuration(note)
          ) {
            chime(note, startTime, elapsed);
          }
        }
        schedule();
        timer = setInterval(schedule, 70);
      })();
      pending = operation;
      try {
        await operation;
      } finally {
        if (pending === operation) pending = null;
      }
    },
    pause,
    get playing() {
      return active;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pause();
      clearTimeout(suspendTimer);
      page?.removeEventListener("visibilitychange", onVisibility);
      context?.removeEventListener("statechange", onStateChange);
      if (context && context.state !== "closed")
        context.close().catch(() => {});
    },
  };
}
