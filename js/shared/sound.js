(function () {
  const STORAGE_KEY = 'arcadeSoundVolume';
  const defaultVolume = 0.55;
  let audioContext;
  let volume = Number(localStorage.getItem(STORAGE_KEY));
  if (!Number.isFinite(volume)) volume = defaultVolume;

  function context() {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function play(kind = 'click') {
    if (volume <= 0) return;
    const settings = {
      click: [520, 0.045, 'sine', 0.18],
      flip: [420, 0.1, 'triangle', 0.25],
      move: [300, 0.09, 'square', 0.16],
      merge: [620, 0.16, 'sine', 0.24],
      light: [760, 0.13, 'sine', 0.22],
      target: [880, 0.1, 'triangle', 0.24],
      drop: [330, 0.12, 'triangle', 0.22],
      success: [740, 0.24, 'sine', 0.28],
      win: [660, 0.42, 'sine', 0.3],
      error: [170, 0.18, 'sawtooth', 0.18]
    }[kind] || [520, 0.05, 'sine', 0.18];
    const [frequency, duration, wave, level] = settings;
    const now = context().currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level * volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function setVolume(value) {
    volume = Math.max(0, Math.min(1, Number(value)));
    localStorage.setItem(STORAGE_KEY, String(volume));
    const output = document.getElementById('soundVolumeValue');
    if (output) output.textContent = `${Math.round(volume * 100)}%`;
  }

  function openSettings() {
    document.getElementById('soundSettings')?.classList.add('open');
    document.getElementById('soundVolume')?.focus();
  }

  function closeSettings() {
    document.getElementById('soundSettings')?.classList.remove('open');
  }

  function addSettingsMenu() {
    if (document.getElementById('soundSettings')) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <button class="sound-settings-trigger" type="button" aria-label="Open sound settings">Settings</button>
      <div class="sound-settings" id="soundSettings" role="dialog" aria-label="Sound settings">
        <div class="sound-settings-heading"><strong>Sound FX</strong><button class="sound-settings-close" type="button" aria-label="Close sound settings">&times;</button></div>
        <label for="soundVolume">Volume <output id="soundVolumeValue">${Math.round(volume * 100)}%</output></label>
        <input id="soundVolume" type="range" min="0" max="1" step="0.01" value="${volume}" aria-label="Sound effects volume">
      </div>`;
    document.body.appendChild(wrapper);
    wrapper.querySelector('.sound-settings-trigger').addEventListener('click', openSettings);
    wrapper.querySelector('.sound-settings-close').addEventListener('click', closeSettings);
    wrapper.querySelector('#soundVolume').addEventListener('input', event => setVolume(event.target.value));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeSettings(); });
  }

  window.ArcadeSound = { play, setVolume, openSettings };
  document.addEventListener('DOMContentLoaded', addSettingsMenu);
  document.addEventListener('click', event => {
    const target = event.target.closest('button, select');
    const isBoardAction = target?.matches('[role="gridcell"], .hole, [data-direction]');
    if (target && !isBoardAction && !target.closest('#soundSettings') && !target.classList.contains('sound-settings-trigger')) play('click');
  });
})();
