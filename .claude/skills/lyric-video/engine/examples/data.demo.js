// Style demo: the title phrase shown in each world (no song lyrics).
(() => {
  const beats = [], onsets = [];
  for (let t = .3; t < 40; t += .625) { beats.push(+t.toFixed(3)); onsets.push(+t.toFixed(3), +(t + .3125).toFixed(3)); }
  window.LYRICS = {
    lines: [
      { t: 8.6, text: 'הטוב הרע ועודיה', label: 'פזמון' },
      { t: 11.1, text: 'הטוב', label: 'A' },
      { t: 12.35, text: 'הרע', label: 'B' },
      { t: 13.6, text: 'ועודיה', label: 'פזמון' },
      { t: 15.5, text: 'הטוב הרע ועודיה', label: 'C' },
      { t: 17.4, text: 'הטוב הרע ועודיה', label: 'D' },
    ],
    end: 19.6,
    worlds: { A: 'yellow', B: 'red', C: 'wall', D: 'night' },
    audio: { bpm: 96, beats, onsets, duration: 22.6 },
  };
})();
