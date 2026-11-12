(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const app = $('#app'), screen = $('#phoneContent'), viewport = $('#viewport');
const topBar = $('#topBar'), sheet = $('.sheet');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LABEL = {start:'Конверт', dark:'Затемнение', open:'Раскрытие', gift:'Подарок', cert:'Сертификат'};
let timers = [], queuedFrame = 0;

function fit(){
  const nav = $('.proto');
  const style = getComputedStyle(nav);
  const insets = 2 * parseFloat(style.getPropertyValue('--layout-inset'));
  const navOnTop = style.flexDirection === 'row';
  const reservedWidth = navOnTop ? insets : insets + nav.offsetWidth + parseFloat(style.marginRight);
  const scale = Math.min(1, Math.max(1, innerWidth - reservedWidth) / app.offsetWidth, innerHeight / app.offsetHeight);
  document.documentElement.style.setProperty('--phone-scale', scale);
  sizeDust();
}
addEventListener('resize', fit);

const touchCursor = document.createElement('div');
touchCursor.className = 'touch-cursor';
touchCursor.hidden = true;
touchCursor.setAttribute('aria-hidden', 'true');
document.body.append(touchCursor);

let cursorPressedUntil = 0, cursorReleaseTimer;
function showTouchCursor(event){
  if (event.pointerType !== 'mouse') return;
  touchCursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  touchCursor.hidden = false;
  app.classList.add('has-touch-cursor');
}
function hideTouchCursor(event){
  if (event.pointerType && event.pointerType !== 'mouse') return;
  clearTimeout(cursorReleaseTimer);
  touchCursor.hidden = true;
  touchCursor.classList.remove('is-pressed');
  app.classList.remove('has-touch-cursor');
}
app.addEventListener('pointerenter', showTouchCursor);
app.addEventListener('pointermove', showTouchCursor);
app.addEventListener('pointerleave', hideTouchCursor);
app.addEventListener('pointercancel', hideTouchCursor);
window.addEventListener('blur', hideTouchCursor);
app.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  showTouchCursor(event);
  clearTimeout(cursorReleaseTimer);
  cursorPressedUntil = performance.now() + 120;
  touchCursor.classList.add('is-pressed');
});
window.addEventListener('pointerup', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0 || !touchCursor.classList.contains('is-pressed')) return;
  cursorReleaseTimer = setTimeout(
    () => touchCursor.classList.remove('is-pressed'),
    Math.max(0, cursorPressedUntil - performance.now())
  );
});

function updateTopBar(){
  topBar.classList.toggle('is-over-sheet', app.dataset.scr === 'cert' &&
    sheet.getBoundingClientRect().top < topBar.getBoundingClientRect().bottom);
}
screen.addEventListener('scroll', updateTopBar, {passive:true});

const qrTrigger = $('#qrTrigger'), qrModal = $('#qrModal'), qrSheet = $('#qrSheet'), qrClose = $('#qrClose');
let qrDrag = null;

function openQrSheet(){
  if (app.dataset.scr !== 'cert' || !qrModal.inert) return;
  $('#qrNumber').textContent = $('[data-num]').textContent;
  $('#qrBalance').textContent = $('[data-balance]').textContent;
  screen.inert = topBar.inert = true;
  qrModal.inert = false;
  qrModal.classList.add('is-open');
  qrClose.focus({preventScroll:true});
}

function clearQrDrag(){
  if (!qrDrag) return;
  const {id} = qrDrag;
  qrDrag = null;
  qrSheet.classList.remove('is-dragging');
  qrSheet.style.removeProperty('--qr-drag-y');
  if (qrSheet.hasPointerCapture(id)) qrSheet.releasePointerCapture(id);
}

function closeQrSheet(restoreFocus = true){
  if (qrModal.inert) return;
  clearQrDrag();
  qrModal.classList.remove('is-open');
  qrModal.inert = true;
  screen.inert = topBar.inert = false;
  if (restoreFocus) qrTrigger.focus({preventScroll:true});
}

qrTrigger.addEventListener('click', openQrSheet);
qrClose.addEventListener('click', () => closeQrSheet());
qrModal.addEventListener('click', event => {
  if (event.target === qrModal) closeQrSheet();
});
qrSheet.addEventListener('keydown', event => {
  if (event.key === 'Escape'){
    event.preventDefault();
    closeQrSheet();
  } else if (event.key === 'Tab'){
    event.preventDefault();
    (document.activeElement === qrClose ? qrSheet.querySelector('[data-copy]') : qrClose).focus();
  }
});
qrSheet.addEventListener('pointerdown', event => {
  if (qrModal.inert || qrDrag || !event.isPrimary || event.button !== 0) return;
  qrDrag = {
    id:event.pointerId,
    x:event.clientX,
    y:event.clientY,
    time:event.timeStamp,
    scale:qrSheet.getBoundingClientRect().width / qrSheet.offsetWidth
  };
});
window.addEventListener('pointermove', event => {
  if (qrDrag?.id !== event.pointerId) return;
  const distance = event.clientY - qrDrag.y;
  if (!qrSheet.classList.contains('is-dragging')){
    if (distance < 6 * qrDrag.scale || distance < .8 * Math.abs(event.clientX - qrDrag.x)) return;
    qrSheet.setPointerCapture(event.pointerId);
    qrSheet.classList.add('is-dragging');
  }
  qrSheet.style.setProperty('--qr-drag-y', `${Math.max(0, distance) / qrDrag.scale}px`);
});
window.addEventListener('pointerup', event => {
  if (qrDrag?.id !== event.pointerId) return;
  const distance = event.clientY - qrDrag.y;
  const threshold = event.timeStamp - qrDrag.time <= 180 ? 16 : 32;
  const dismiss = distance >= threshold * qrDrag.scale && distance >= .8 * Math.abs(event.clientX - qrDrag.x);
  clearQrDrag();
  if (dismiss) closeQrSheet();
});
window.addEventListener('pointercancel', event => {
  if (qrDrag?.id === event.pointerId) clearQrDrag();
});
qrSheet.addEventListener('lostpointercapture', event => {
  if (event.target === qrSheet && qrDrag?.id === event.pointerId) clearQrDrag();
});

function scr(s){
  closeQrSheet(false);
  app.dataset.scr = s;
  if (s === 'start') app.classList.remove('dark');
  if (s === 'gift' || s === 'cert') app.classList.add('dark');
  $('#openBtn').disabled = s !== 'start';
  $('#mcol').inert = s !== 'cert';
  updateTopBar();
  $$('#pSteps button').forEach(button => {
    if (button.dataset.s === s) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}
function g(n){ app.dataset.g = n; }
function clear(){
  timers.forEach(clearTimeout);
  timers = [];
  cancelAnimationFrame(queuedFrame);
}
function afterPaint(fn){
  queuedFrame = requestAnimationFrame(() => {
    queuedFrame = requestAnimationFrame(fn);
  });
}
function at(ms, fn){ timers.push(setTimeout(fn, reduce ? 0 : ms)); }
function burst(){ ['#sdSmall','#sdBig'].forEach(s => { const e = $(s); e.classList.remove('run'); void e.offsetWidth; e.classList.add('run'); }); }


/* line: draws across, rests, runs off forward, short pause, repeats; on «Открыть» it runs away */
const linePath = $('.line path'); const L = Math.ceil(linePath.getTotalLength()); linePath.style.setProperty('--L', L);
let lineAnim = null;
function lineLoop(){
  if (lineAnim) lineAnim.cancel();
  if (reduce){ linePath.style.strokeDashoffset = 0; return; }
  lineAnim = linePath.animate([
    {strokeDashoffset: L, offset: 0, easing: 'cubic-bezier(.45,0,.2,1)'},
    {strokeDashoffset: 0, offset: .38},
    {strokeDashoffset: 0, offset: .62, easing: 'cubic-bezier(.6,0,.4,1)'},
    {strokeDashoffset: -L, offset: .9},
    {strokeDashoffset: -L, offset: 1}
  ], {duration: 6200, iterations: Infinity});
}
function lineRunAway(){
  if (!lineAnim) return;
  const cur = parseFloat(getComputedStyle(linePath).strokeDashoffset) || 0;
  lineAnim.cancel();
  lineAnim = linePath.animate([{strokeDashoffset: cur}, {strokeDashoffset: -L}], {duration: reduce ? 1 : 700, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards'});
}

/* «Открыть»: the night spreads out from the centre (1.3s), then the envelope opens */
function play(){
  if (app.dataset.scr !== 'start') return;
  clear(); g('0'); lineRunAway(); settleJig(); scr('dark');
  at(1300, () => app.classList.add('dark'));
  at(1050, openSeq);
}
/* Gift-animation 0 → 4 with overlapping, eased steps; screen 4 → 5 starts soon after the scene settles */
function settleJig(){
  const j = $('.jig'); const m = getComputedStyle(j).transform;
  j.style.animation = 'none'; j.style.transform = (m && m !== 'none') ? m : 'rotate(0deg)'; void j.offsetWidth;
  j.style.transition = 'transform .4s ease-out'; j.style.transform = 'rotate(0deg)';
}
function freeJig(){ const j = $('.jig'); j.style.animation = ''; j.style.transform = ''; j.style.transition = ''; }
function openSeq(){
  settleJig();
  scr('open'); g('0'); burst(); sizeDust();
  at(450, spawnDust);
  at(400, () => app.classList.add('dark'));
  at(450, () => g('1'));
  at(1150, () => g('2'));
  at(1650, () => g('3'));
  at(2100, () => g('4'));
  at(3000, () => scr('gift'));
  at(3600, () => toCert());
}
function toCert(){ clear(); g('4'); scr('cert'); clearDust(); screen.scrollTop = 0; }
function jump(s){
  clear(); screen.scrollTop = 0; $$('.sd').forEach(e => e.classList.remove('run'));
  if (s === 'start'){ freeJig(); clearDust(); g('0'); scr('start'); lineLoop(); return; }
  if (s === 'dark'){ freeJig(); clearDust(); g('0'); scr('start'); lineLoop(); afterPaint(play); return; }
  if (s === 'open'){ clearDust(); g('0'); lineRunAway(); scr('dark'); afterPaint(openSeq); return; }
  lineRunAway();
  if (s === 'gift'){
    if (!flakes.length && !spawnQ.length) spawnDust();
    g('4'); scr('gift'); at(900, toCert); return;
  }
  toCert();
}
$('#openBtn').onclick = play;
$('#pSteps').innerHTML = Object.entries(LABEL).map(([step, label], index) =>
  `<button type="button" data-s="${step}" aria-label="${index+1}. ${label}" title="${label}">${index+1}<span class="pl">. ${label}</span></button>`
).join('');
$('#pSteps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) jump(b.dataset.s); });
$('#pReset').onclick = () => jump('start');

/* Fallen stars keep the original burst, gravity, bounce and shimmer. */
const dust = $('#dust'), dc = dust.getContext('2d');
let flakes = [], spawnQ = [], last = performance.now();
function sizeDust(){
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.round(dust.clientWidth * dpr);
  const height = Math.round(dust.clientHeight * dpr);
  if (dust.width === width && dust.height === height) return;
  dust.width = width;
  dust.height = height;
  dc.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function spawnDust(){
  flakes = []; spawnQ = [];
  const vr = dust.getBoundingClientRect(), br = $('#box').getBoundingClientRect();
  const scale = vr.width / dust.clientWidth;
  const ox = (br.left + br.width * .5 - vr.left) / scale;
  const oy = (br.top + br.height * .36 - vr.top) / scale;
  const k = br.width / scale / 880;
  for (let i=0;i<140;i++){
    const big = Math.random() < .1;
    spawnQ.push({t: performance.now() + Math.random()*700, f:{
      x: ox + (Math.random()-.5)*180*k, y: oy + (Math.random()-.5)*40*k,
      vx: (Math.random()-.5)*1300*k, vy: -(250 + Math.random()*750)*k,
      s: (big ? 10 + Math.random()*8 : 2.5 + Math.random()*5) * Math.max(.75, k),
      rot: Math.random()*6.28, vr: (Math.random()-.5)*6, ph: Math.random()*6.28,
      lift: Math.random()*34, rest:false, a:0 }});
  }
  spawnQ.sort((a,b) => a.t - b.t);
}
function clearDust(){ flakes = []; spawnQ = []; }
function sparkle(x, y, s, rot){
  dc.save(); dc.translate(x, y); dc.rotate(rot); dc.beginPath();
  dc.moveTo(0,-s); dc.quadraticCurveTo(s*.16,-s*.16, s,0); dc.quadraticCurveTo(s*.16,s*.16, 0,s); dc.quadraticCurveTo(-s*.16,s*.16, -s,0); dc.quadraticCurveTo(-s*.16,-s*.16, 0,-s);
  dc.fill(); dc.restore();
}
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(.033, (now - last)/1000); last = now;
  if (app.dataset.scr === 'cert') return;
  while (spawnQ.length && spawnQ[0].t <= now){ flakes.push(spawnQ.shift().f); }
  const W = dust.clientWidth, H = dust.clientHeight, G = 1500;
  dc.clearRect(0,0,W,H);
  if (flakes.length){
    dc.save();
    dc.fillStyle = '#fff'; dc.shadowColor = 'rgba(255,255,255,.9)';
    for (const f of flakes){
      const floor = H - 6 - f.lift - f.s*.5;
      if (!f.rest){
        f.vy += G*dt; f.x += f.vx*dt; f.y += f.vy*dt; f.rot += f.vr*dt;
        if (f.x < 4){ f.x = 4; f.vx = Math.abs(f.vx)*.5; } if (f.x > W-4){ f.x = W-4; f.vx = -Math.abs(f.vx)*.5; }
        if (f.y >= floor){ f.y = floor; if (Math.abs(f.vy) > 90){ f.vy *= -.32; f.vx *= .6; f.vr *= .5; } else { f.vy = 0; f.rest = true; } }
        f.vx *= f.rest ? .8 : .995;
      } else { f.y = floor; f.vx *= .85; f.x += f.vx*dt; f.vr *= .9; f.rot += f.vr*dt; }
      f.a = Math.min(1, f.a + dt*4);
      const tw = .55 + .45*Math.abs(Math.sin(now/700*(.6+f.s*.05) + f.ph));
      dc.globalAlpha = f.a * (f.rest ? tw : 1);
      dc.shadowBlur = f.s * 1.6;
      sparkle(f.x, f.y, f.s, f.rot);
    }
    dc.restore();
  }
}
new ResizeObserver(() => {
  sizeDust();
  updateTopBar();
}).observe(viewport);
requestAnimationFrame(frame);

const toastEl = $('#toast'); let tt;
function toast(m){ toastEl.textContent = m; toastEl.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('on'), 2400); }
document.addEventListener('dragstart', event => event.preventDefault());
document.addEventListener('click', async e => {
  const c = e.target.closest('[data-copy]');
  if (c){
    const value = c.closest('.card-value').querySelector('span').textContent.replace(/\s/g,'');
    try {
      await navigator.clipboard.writeText(value);
      const message = c.dataset.copy === 'pin' ? 'Пин-код скопирован' : 'Номер карты скопирован';
      toast(message + ' — для демонстрации');
    } catch {
      toast('Скопируйте вручную: ' + value);
    }
    return;
  }
  if (e.target.closest('[data-pdf]')) return toast('Здесь скачается PDF сертификата — в прототипе не подключено');
  if (e.target.closest('[data-shop]')) return toast('Переход в каталог сайта — в прототипе не подключено');
  if (e.target.closest('[data-close]')) return toast('Здесь пользователь уйдет на Главную – в прототипе не подключено');
});
scr('start'); fit(); lineLoop();
})();
