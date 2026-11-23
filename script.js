const $ = (s) => document.querySelector(s);
const P = {
  play: '<path d="M8 5v14l11-7z"/>', pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
  next: '<path d="M6 6l9 6-9 6zM17 6h2v12h-2z"/>', prev: '<path d="M18 6l-9 6 9 6zM5 6h2v12H5z"/>',
  shuffle: '<path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c1.5 0 2.500-1 3.500-2.500M14 9.500C15 8 16 7 17 7h3M18 5l2 2-2 2M18 15l2 2-2 2"/>',
  repeat: '<path d="M4 11V9a3 3 0 013-3h12M16 3l3 3-3 3M20 13v2a3 3 0 01-3 3H5M8 21l-3-3 3-3"/>',
  heart: '<path d="M12 20s-7-4.500-7-10a4 4 0 017-2.500A4 4 0 0119 10c0 5.500-7 10-7 10z"/>',
  vol: '<path d="M4 10v4h4l5 4V6l-5 4zM16 9a4 4 0 010 6"/>', mute: '<path d="M4 10v4h4l5 4V6l-5 4zM17 9l4 6M21 9l-4 6"/>',
};
const FILLED = ['play', 'pause', 'next', 'prev'];
const icon = (n, size = 24, fill) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill || FILLED.includes(n) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const fmt = (s) => (isFinite(s) && s > 0 ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '0:00');


const SYNTH = [
  ['Slow tide', 'Arch Sessions', 'Chill', 74, 57, [0, 3, 5, 7, 10], 'triangle', 11, 0.5, 1],
  ['Rainy window', 'Arch Sessions', 'Chill', 82, 50, [0, 2, 3, 7, 9], 'sine', 4, 0.55, 1],
  ['Deep work', 'Loop Theory', 'Focus', 96, 52, [0, 2, 4, 7, 9], 'sine', 5, 0.4, 1],
  ['Quiet loop', 'Loop Theory', 'Focus', 88, 55, [0, 2, 3, 5, 7, 8, 10], 'triangle', 21, 0.35, 0],
  ['Night drive', 'Neon Parcel', 'Energy', 118, 48, [0, 3, 5, 7, 10], 'sawtooth', 8, 0.7, 2],
  ['Sprint', 'Neon Parcel', 'Energy', 132, 50, [0, 2, 4, 7, 9], 'square', 3, 0.75, 2],
  ['Glass hours', 'Still Water', 'Ambient', 60, 53, [0, 2, 4, 7, 11], 'sine', 14, 0.25, 0],
  ['Low horizon', 'Still Water', 'Ambient', 54, 45, [0, 3, 7, 10, 12], 'sine', 9, 0.2, 0],
];
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const tracks = SYNTH.map(([t, a, c, bpm, root, sc, wave, seed, dens, drums], i) => ({ id: 's' + i, kind: 'synth', t, a, c, bpm, root, sc, wave, seed, dens, drums, d: 120, hue: hue(t) }));
let fileN = 0, cat = 'All', query = '', cur = null, playing = false, shuffle = false, repeat1 = false, vol = 0.8, lastVol = 0.8;
let fav = new Set();
try { fav = new Set(JSON.parse(localStorage.getItem('mp:fav') || '[]')); } catch (e) {}
const saveFav = () => { try { localStorage.setItem('mp:fav', JSON.stringify([...fav])); } catch (e) {} };

const CATS = ['All', 'Chill', 'Focus', 'Energy', 'Ambient', 'My playlist', 'Uploads'];
const queue = () => tracks.filter((t) =>
  (cat === 'All' || (cat === 'My playlist' ? fav.has(t.id) : t.c === cat)) &&
  `${t.t} ${t.a} ${t.c}`.toLowerCase().includes(query.toLowerCase()));


let ctx, master, analyser, bus, timer, noise, t0 = 0, step = 0, pat = [];
const audio = new Audio();
const rng = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function init() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = vol;
  analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.8;
  master.connect(analyser); analyser.connect(ctx.destination);
  ctx.createMediaElementSource(audio).connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  noise.getChannelData(0).forEach((_, i, d) => { d[i] = Math.random() * 2 - 1; });
}
const stepDur = () => 60 / cur.bpm / 4;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function tone(time, midi, len, type, gain, attack = 0.01) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = hz(midi);
  g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(gain, time + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, time + len);
  o.connect(g); g.connect(bus); o.start(time); o.stop(time + len + 0.05);
}
function kick(time) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(130, time); o.frequency.exponentialRampToValueAtTime(40, time + 0.12);
  g.gain.setValueAtTime(0.5, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  o.connect(g); g.connect(bus); o.start(time); o.stop(time + 0.25);
}
function hat(time) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000;
  g.gain.setValueAtTime(0.07, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
  s.connect(f); f.connect(g); g.connect(bus); s.start(time);
}
function schedule(n, time) {
  const i = n % 64, bar = Math.floor(i / 16) % 4, sd = stepDur(), sc = cur.sc, L = sc.length;
  const note = (d) => cur.root + 12 + 12 * Math.floor(d / L) + sc[d % L];
  if (pat[i] >= 0) tone(time, note(pat[i]), sd * 1.8, cur.wave, 0.1);
  if (i % 4 === 0) tone(time, cur.root - 12 + sc[[0, 2, 1, 3][bar] % L], sd * 3.5, 'sine', 0.24);
  if (i % 16 === 0 && cur.drums < 2) [0, 2, 4].forEach((k) => tone(time, cur.root + sc[(bar * 2 + k) % L], sd * 15, 'sine', 0.05, 0.9));
  if (cur.drums && i % 4 === 0) kick(time);
  if (cur.drums === 2 && i % 2 === 1) hat(time);
}
function tick() {
  while (cur && cur.kind === 'synth' && t0 + step * stepDur() < ctx.currentTime + 0.15) { schedule(step, t0 + step * stepDur()); step++; }
}
function stopEngine() {
  clearInterval(timer);
  if (bus) { const b = bus; b.gain.setTargetAtTime(0, ctx.currentTime, 0.03); setTimeout(() => b.disconnect(), 400); bus = null; }
  audio.pause();
}
function startSynth(pos) {
  stopEngine();
  bus = ctx.createGain(); bus.connect(master);
  const r = rng(cur.seed);
  pat = Array.from({ length: 64 }, () => (r() < cur.dens ? Math.floor(r() * cur.sc.length * 2) : -1));
  t0 = ctx.currentTime + 0.05 - pos; step = Math.ceil(pos / stepDur());
  timer = setInterval(tick, 40);
}
const position = () => !cur ? 0 : cur.kind === 'file' ? audio.currentTime : Math.max(0, ctx.currentTime - t0);
const duration = () => !cur ? 0 : cur.kind === 'file' ? audio.duration || 0 : cur.d;

function play(tr, pos = 0) {
  init(); cur = tr; playing = true;
  if (tr.kind === 'file') { stopEngine(); audio.src = tr.url; audio.currentTime = pos; audio.play(); }
  else startSynth(pos);
  ctx.resume(); sync(); renderList();
}
function toggle() {
  if (!cur) { const q = queue(); if (q.length) play(q[0]); return; }
  if (playing) { cur.kind === 'file' ? audio.pause() : ctx.suspend(); }
  else { ctx.resume(); if (cur.kind === 'file') audio.play(); }
  playing = !playing; sync(); renderList();
}
function skip(dir, auto) {
  if (auto && repeat1) return play(cur);
  const q = queue(); if (!q.length) return;
  let n = (q.indexOf(cur) + dir + q.length) % q.length;
  if (shuffle && q.length > 1) do { n = Math.floor(Math.random() * q.length); } while (q[n] === cur);
  play(q[n]);
}
function seekTo(p) {
  if (!cur) return;
  if (cur.kind === 'file') audio.currentTime = p;
  else { init(); startSynth(p); if (!playing) ctx.suspend(); else ctx.resume(); }
}
function setVol(v) { vol = v; if (master) master.gain.value = v; $('#vol').value = v; fill($('#vol')); $('#mute').innerHTML = icon(v ? 'vol' : 'mute'); $('#mute').setAttribute('aria-label', v ? 'Mute' : 'Unmute'); }
audio.addEventListener('ended', () => skip(1, true));
audio.addEventListener('loadedmetadata', () => { if (cur && cur.kind === 'file') { cur.d = audio.duration; renderList(); } });


const fill = (el) => el.style.setProperty('--fill', (100 * (el.value - el.min) / (el.max - el.min || 1)) + '%');
function sync() {
  $('#title').textContent = cur ? cur.t : 'Pick a track';
  $('#artist').textContent = cur ? cur.a + ' (' + cur.c + ')' : 'Choose from the playlist to start';
  $('#play').innerHTML = icon(playing ? 'pause' : 'play', 28);
  $('#play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
}
function renderChips() {
  $('#chips').innerHTML = CATS.map((c) => `<button class="chip" data-c="${c}" aria-pressed="${c === cat}">${c}</button>`).join('');
}
function renderList() {
  const q = queue();
  $('#list').innerHTML = q.length ? q.map((t) => `<li class="row ${t === cur ? 'on' : ''}">
    <button class="pick" data-id="${t.id}" aria-label="Play ${t.t}">
      <span class="sw" style="background:linear-gradient(135deg,hsl(${t.hue || 200} 70% 55%),hsl(${((t.hue || 200) + 50) % 360} 70% 38%))">${t === cur && playing ? icon('pause', 16) : icon('play', 16)}</span>
      <span class="t"><b>${t.t}</b><small>${t.a}, ${t.c}</small></span><span class="dur">${t.kind === 'file' && !t.d ? '' : fmt(t.d)}</span></button>
    <button class="ic fav" data-fav="${t.id}" aria-label="${fav.has(t.id) ? 'Remove from' : 'Add to'} my playlist" aria-pressed="${fav.has(t.id)}">${icon('heart', 20, fav.has(t.id))}</button></li>`).join('')
    : '<li class="empty">No tracks match. Try another search, or add your own audio files.</li>';
}

$('#list').addEventListener('click', (e) => {
  const pick = e.target.closest('[data-id]'), f = e.target.closest('[data-fav]');
  if (pick) { const t = tracks.find((x) => x.id === pick.dataset.id); t === cur ? toggle() : play(t); }
  if (f) { const id = f.dataset.fav; fav.has(id) ? fav.delete(id) : fav.add(id); saveFav(); renderList(); }
});
$('#chips').addEventListener('click', (e) => { const c = e.target.closest('[data-c]'); if (c) { cat = c.dataset.c; renderChips(); renderList(); } });
$('#q').addEventListener('input', (e) => { query = e.target.value; renderList(); });
$('#files').addEventListener('change', (e) => {
  [...e.target.files].forEach((f) => tracks.push({ id: 'f' + fileN++, kind: 'file', t: f.name.replace(/\.[^.]+$/, ''), a: 'Local file', c: 'Uploads', url: URL.createObjectURL(f), d: 0, hue: hue(f.name) }));
  cat = 'Uploads'; renderChips(); renderList(); e.target.value = '';
});
$('#play').onclick = toggle;
$('#next').onclick = () => skip(1);
$('#prev').onclick = () => (position() > 3 ? seekTo(0) : skip(-1));
$('#shuffle').onclick = (e) => { shuffle = !shuffle; e.currentTarget.setAttribute('aria-pressed', shuffle); };
$('#repeat').onclick = (e) => { repeat1 = !repeat1; e.currentTarget.setAttribute('aria-pressed', repeat1); };
$('#mute').onclick = () => { if (vol) { lastVol = vol; setVol(0); } else setVol(lastVol || 0.8); };
$('#vol').addEventListener('input', (e) => setVol(+e.target.value));
let dragging = false;
$('#seek').addEventListener('pointerdown', () => { dragging = true; });
$('#seek').addEventListener('input', (e) => { fill(e.target); $('#pos').textContent = fmt(+e.target.value); });
$('#seek').addEventListener('change', (e) => { dragging = false; seekTo(+e.target.value); });
document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
  if (e.target.tagName === 'BUTTON' && e.code === 'Space') return;
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.key === 'n') skip(1);
  if (e.key === 'p') skip(-1);
});

const cv = $('#viz'), g = cv.getContext('2d'), bins = new Uint8Array(128);
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
let ang = 0, dpr = 1;
function size() { dpr = devicePixelRatio || 1; cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; }
addEventListener('resize', size);
function draw() {
  const S = cv.width, c = S / 2, r0 = S * 0.27, css = getComputedStyle(document.documentElement);
  g.clearRect(0, 0, S, S);
  if (playing && analyser) analyser.getByteFrequencyData(bins); else bins.fill(0);
  g.lineCap = 'round'; g.lineWidth = S * 0.012; g.strokeStyle = css.getPropertyValue('--accent');
  for (let i = 0; i < 72; i++) {
    const k = i < 36 ? i : 71 - i, v = bins[Math.floor(k * 1.6)] / 255, a = (i / 72) * Math.PI * 2 - Math.PI / 2;
    const r1 = r0 + S * 0.05, r2 = r1 + S * 0.015 + v * S * 0.17;
    g.beginPath(); g.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); g.stroke();
  }
  g.save(); g.translate(c, c); g.rotate(ang);
  g.fillStyle = '#0B1420'; g.beginPath(); g.arc(0, 0, r0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1 * dpr;
  for (let r = r0 * 0.5; r < r0 - 4; r += S * 0.012) { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); }
  const h = cur ? cur.hue : 350; g.fillStyle = `hsl(${h} 70% 58%)`;
  g.beginPath(); g.arc(0, 0, r0 * 0.38, 0, 7); g.fill();
  g.fillStyle = '#0B1420'; g.beginPath(); g.arc(0, 0, r0 * 0.05, 0, 7); g.fill();
  g.fillStyle = css.getPropertyValue('--mint'); g.beginPath(); g.arc(r0 * 0.78, 0, r0 * 0.05, 0, 7); g.fill();
  g.restore();
  if (playing && !calm) ang += 0.012;
}
function frame() {
  draw();
  const d = duration(), p = position(), s = $('#seek');
  if (!dragging) { s.max = d || 1; s.value = Math.min(p, d || 1); fill(s); $('#pos').textContent = fmt(p); }
  $('#dur').textContent = fmt(d);
  if (playing && cur && cur.kind === 'synth' && p >= d) skip(1, true);
  requestAnimationFrame(frame);
}

$('#shuffle').innerHTML = icon('shuffle'); $('#prev').innerHTML = icon('prev'); $('#next').innerHTML = icon('next');
$('#repeat').innerHTML = icon('repeat'); $('#play').innerHTML = icon('play', 28);
setVol(vol); renderChips(); renderList(); size(); frame();
