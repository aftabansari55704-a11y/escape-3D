// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 1600);
}

// ---------- splash: fake loading, then go to home ----------
function runSplash() {
  let p = 0;
  const timer = setInterval(() => {
    p = Math.min(100, p + Math.random() * 14 + 4);
    $('barFill').style.width = p + '%';
    if (p >= 100) {
      clearInterval(timer);
      $('loadText').textContent = 'Ready!';
      setTimeout(() => show('home'), 400);
    }
  }, 220);
}

// ---------- home ----------
let soundOn = store.get('sound', true);
function renderHome() {
  $('coinCount').textContent = store.get('coins', 0);
  $('soundBtn').classList.toggle('off', !soundOn);
  $('soundIcon').textContent = soundOn ? '\u{1F50A}' : '\u{1F507}';
}

const actions = {
  play:      () => toast('Starting Level 1...'),
  levels:    () => toast('Levels screen coming soon'),
  skins:     () => toast('Skins screen coming soon'),
  settings:  () => toast('Settings coming soon'),
  rate:      () => toast('Thanks for rating!'),
  removeads: () => toast('Remove Ads coming soon'),
  sound:     () => { soundOn = !soundOn; store.set('sound', soundOn); renderHome(); }
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b) actions[b.dataset.act]?.();
  if (e.target.closest('.plus')) toast('Coin shop coming soon');
});

renderHome();
runSplash();

// ================= GAME =================
const cv = $('cv'), cx = cv.getContext('2d');
let W, H, G = null, raf = 0, lastT = 0, cur = 1;
let maxLv = store.get('maxLevel', 1);
const held = { l: 0, r: 0 };
const F = 260;

function size() {
  const d = devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  cv.width = W * d; cv.height = H * d;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  cx.setTransform(d, 0, 0, d, 0, 0);
}
addEventListener('resize', size); size();

function buildGrid() {
  let h = '';
  for (let i = 1; i <= 10; i++) {
    const lock = i > maxLv;
    h += '<button class="lv' + (i === maxLv ? ' cur' : '') + (lock ? ' lock' : '') + '" data-lv="' + i + '">' + (lock ? '&#128274;' : i) + '</button>';
  }
  $('grid').innerHTML = h;
}

function startLevel(n) {
  cur = n;
  const gap = Math.max(70, 140 - n * 7), obs = [];
  const len = 2500 + n * 500;
  for (let z = 500; z < len - 300; z += gap + Math.random() * 60) obs.push({ z, x: Math.random() * 1.5 - 0.75 });
  G = { z: 0, bx: 0, state: 'run', len, obs };
  $('lvlTxt').textContent = 'Level ' + n;
  $('modal').classList.remove('show');
  show('game');
  cancelAnimationFrame(raf);
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
}

function modal(html) { $('modal').innerHTML = '<div class="card">' + html + '</div>'; $('modal').classList.add('show'); }
const btn = (c, a, t) => '<button class="btn ' + c + ' sm" data-act="' + a + '">' + t + '</button>';

function end(type) {
  G.state = type;
  held.l = held.r = 0;
  if (type === 'over') {
    modal('<h3>GAME OVER</h3><p>You Crashed!</p>' + btn('green', 'retry', 'RETRY') + btn('blue', 'home', 'HOME'));
  } else {
    store.set('coins', store.get('coins', 0) + 100);
    if (cur === maxLv && cur < 10) { maxLv++; store.set('maxLevel', maxLv); }
    modal('<div class="stars">&#9733;&#9733;&#9733;</div><h3>LEVEL COMPLETE!</h3><p>+100 coins</p>' +
      (cur < 10 ? btn('green', 'next', 'NEXT LEVEL') : '') + btn('blue', 'home', 'HOME'));
  }
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (G.state === 'run') {
    G.z += (280 + cur * 18) * dt;
    G.bx += (held.r - held.l) * 1.7 * dt;
    if (Math.abs(G.bx) > 1.05) end('over');
    else if (G.obs.some(o => Math.abs(o.z - G.z) < 14 && Math.abs(o.x - G.bx) < 0.3)) end('over');
    else if (G.z >= G.len) end('win');
  }
  draw();
  raf = requestAnimationFrame(loop);
}

function draw() {
  const hz = H * 0.34, gy = H * 0.8, RW = Math.min(W * 0.44, H * 0.42), mid = W / 2;
  const fs = dz => F / (F + dz), Y = dz => hz + (gy - hz) * fs(dz), HW = dz => RW * fs(dz);
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2f8fe8'); g.addColorStop(1, '#a9dcff');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  cx.fillStyle = 'rgba(255,255,255,.85)';
  [[.15,.12,70],[.7,.2,55],[.45,.07,40],[.9,.4,60]].forEach(c => {
    cx.beginPath(); cx.ellipse(c[0] * W, c[1] * H, c[2] * 1.6, c[2] * .5, 0, 0, 7); cx.fill();
  });

  const quad = (y1, w1, y2, w2, xo1, xo2, col) => {
    cx.fillStyle = col; cx.beginPath();
    cx.moveTo(mid + xo1 - w1, y1); cx.lineTo(mid + xo1 + w1, y1);
    cx.lineTo(mid + xo2 + w2, y2); cx.lineTo(mid + xo2 - w2, y2); cx.fill();
  };
  const base = -(G.z % 50) - 100;
  for (let k = 39; k >= 0; k--) {
    const a = base + k * 50, b = a + 50, idx = Math.floor((G.z + a) / 50);
    const yA = Y(a), yB = Y(b), wA = HW(a), wB = HW(b), e = idx % 2 === 0;
    quad(yA, wA, yB, wB, 0, 0, e ? '#c6cdd7' : '#b4bdc9');
    const ea = wA * 0.1, eb = wB * 0.1, ec = e ? '#ffc928' : '#222';
    [-1, 1].forEach(s => {
      cx.fillStyle = ec; cx.beginPath();
      cx.moveTo(mid + s * wA, yA); cx.lineTo(mid + s * (wA - ea), yA);
      cx.lineTo(mid + s * (wB - eb), yB); cx.lineTo(mid + s * wB, yB); cx.fill();
    });
  }
  const dzF = G.len - G.z;
  if (dzF > -50 && dzF < 2000) {
    quad(Y(dzF), HW(dzF), Y(dzF + 30), HW(dzF + 30), 0, 0, 'rgba(255,255,255,.85)');
    cx.strokeStyle = '#f5821f'; cx.lineWidth = Math.max(4, 22 * fs(dzF));
    cx.beginPath(); cx.arc(mid, Y(dzF), HW(dzF) * 0.9, Math.PI, 0); cx.stroke();
  }
  [...G.obs].sort((p, q) => q.z - p.z).forEach(o => {
    const dz = o.z - G.z;
    if (dz < -60 || dz > 1800) return;
    const s = fs(dz), x = mid + o.x * RW * s, y = Y(dz), sz = RW * s * 0.2;
    cx.fillStyle = '#a8683a'; cx.fillRect(x - sz, y - sz * 1.5, sz * 2, sz * 1.5);
    cx.fillStyle = '#d9955a'; cx.fillRect(x - sz, y - sz * 1.85, sz * 2, sz * 0.35);
    cx.strokeStyle = '#5a3516'; cx.lineWidth = Math.max(1, 2 * s);
    cx.strokeRect(x - sz, y - sz * 1.5, sz * 2, sz * 1.5);
  });
  const R = Math.min(W, H * 0.7) * 0.07, bx = mid + G.bx * RW, by = gy - R;
  cx.fillStyle = 'rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(bx, gy + 2, R * 0.9, R * 0.3, 0, 0, 7); cx.fill();
  const bg = cx.createRadialGradient(bx - R * .35, by - R * .4, R * .1, bx, by, R);
  bg.addColorStop(0, '#9fd8ff'); bg.addColorStop(.35, '#2a9bff'); bg.addColorStop(1, '#0a55c9');
  cx.fillStyle = bg; cx.beginPath(); cx.arc(bx, by, R, 0, 7); cx.fill();
  cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = R * 0.12;
  cx.beginPath(); cx.arc(bx, by, R * 0.7, G.z * 0.05, G.z * 0.05 + 1); cx.stroke();
}

// ---------- controls ----------
const hold = (id, k) => {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); held[k] = 1; });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, () => held[k] = 0));
};
hold('bl', 'l'); hold('br', 'r');
addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') held.l = 1;
  if (e.key === 'ArrowRight' || e.key === 'd') held.r = 1;
});
addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') held.l = 0;
  if (e.key === 'ArrowRight' || e.key === 'd') held.r = 0;
});
$('pauseBtn').addEventListener('click', () => {
  if (G && G.state === 'run') {
    G.state = 'pause'; held.l = held.r = 0;
    modal('<h3>PAUSED</h3>' + btn('green', 'resume', 'RESUME') + btn('blue', 'retry', 'RETRY') + btn('grey', 'home', 'HOME'));
  }
});

// ---------- hook into menu ----------
actions.play = () => startLevel(maxLv);
actions.levels = () => { buildGrid(); show('levels'); };
actions.resume = () => { G.state = 'run'; $('modal').classList.remove('show'); };
actions.retry = () => startLevel(cur);
actions.next = () => startLevel(Math.min(cur + 1, 10));
actions.home = () => { cancelAnimationFrame(raf); renderHome(); show('home'); };
document.addEventListener('click', e => {
  const b = e.target.closest('.lv:not(.lock)');
  if (b) startLevel(+b.dataset.lv);
});

// ================= SKINS + SOUND =================
const SK = [
  ['Blue', 0, ['#9fd8ff', '#2a9bff', '#0a55c9']],
  ['Red', 100, ['#ffb0b0', '#ff3b3b', '#a30f0f']],
  ['Green', 200, ['#c4ffb0', '#3fd13f', '#0d7a1a']],
  ['Purple', 300, ['#e0b8ff', '#9b4dff', '#4a14a0']],
  ['Gold', 400, ['#fff3a8', '#ffc928', '#b87000']],
  ['Pink', 500, ['#ffd0ec', '#ff5fb8', '#a8185f']]
];
let owned = store.get('skinsOwned', [0]), skin = store.get('skin', 0);

function buildSkins() {
  $('skCoins').textContent = store.get('coins', 0);
  $('skinGrid').innerHTML = SK.map((s, i) =>
    '<button class="sk' + (i === skin ? ' on' : '') + '" data-sk="' + i + '">' +
    '<i style="background:radial-gradient(circle at 35% 30%,' + s[2][0] + ',' + s[2][1] + ' 40%,' + s[2][2] + ')"></i>' +
    s[0] + '<span>' + (i === skin ? 'Equipped' : owned.includes(i) ? 'Use' : s[1] + ' coins') + '</span></button>'
  ).join('');
}
actions.skins = () => { buildSkins(); show('skins'); };

document.addEventListener('click', e => {
  const b = e.target.closest('.sk');
  if (!b) return;
  const i = +b.dataset.sk, coins = store.get('coins', 0);
  if (!owned.includes(i)) {
    if (coins < SK[i][1]) { toast('Not enough coins'); return; }
    store.set('coins', coins - SK[i][1]);
    owned.push(i); store.set('skinsOwned', owned);
  }
  skin = i; store.set('skin', i);
  buildSkins();
});

// ball ko chuni hui skin me dobara draw karo
const _draw = draw;
draw = function () {
  _draw();
  if (skin === 0) return;
  const c = SK[skin][2], RW = Math.min(W * 0.44, H * 0.42);
  const R = Math.min(W, H * 0.7) * 0.07, bx = W / 2 + G.bx * RW, by = H * 0.8 - R;
  const bg = cx.createRadialGradient(bx - R * .35, by - R * .4, R * .1, bx, by, R);
  bg.addColorStop(0, c[0]); bg.addColorStop(.35, c[1]); bg.addColorStop(1, c[2]);
  cx.fillStyle = bg; cx.beginPath(); cx.arc(bx, by, R, 0, 7); cx.fill();
  cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = R * 0.12;
  cx.beginPath(); cx.arc(bx, by, R * 0.7, G.z * 0.05, G.z * 0.05 + 1); cx.stroke();
};

// ---------- sound ----------
let ac;
function beep(f, d, type, vol) {
  if (!soundOn) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = f; g.gain.value = vol || 0.15;
    o.connect(g); g.connect(ac.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d);
    o.stop(ac.currentTime + d);
  } catch (e) {}
}
document.addEventListener('click', () => beep(600, 0.06, 'square', 0.05));
const _end = end;
end = function (t) {
  _end(t);
  if (t === 'over') beep(160, 0.4, 'sawtooth', 0.2);
  else [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.25), i * 150));
};
