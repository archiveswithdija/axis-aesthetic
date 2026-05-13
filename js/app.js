<script>
const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");
const eqListEl = document.getElementById("eq-list");
const zoomSlider = document.getElementById("zoom");
const coordEl = document.getElementById("coords");
const historyEl = document.getElementById("history-list");

let equations = [{ id: 1, text: 'a * sin(x + b) + c', color: null }];
let params = { a: 1, b: 0, c: 0 };
let activeInput = null;
let history = JSON.parse(localStorage.getItem('curvo-history') || '[]');
let currentTheme = 'theme-normal';

let pacman = {
  x: 100,
  y: canvas.height / 2,
  size: 25,
  angle: 0,
  mouthOpen: 0,
  direction: 1,
  speed: 2,
  targetY: canvas.height / 2
};

function setTheme(t) { 
  currentTheme = t;
  document.body.className = t; 
  render(); 
}

function updateParam(p, val) {
  params[p] = parseFloat(val);
  document.getElementById(`val-${p}`).innerText = val;
  addToHistory(`${p} = ${val}`);
  render();
}

function getThemeColor(index) {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue(`--line-color-${(index % 5) + 1}`).trim();
}

function newEquation() {
  equations.push({ id: Date.now(), text: '', color: null });
  updateUI();
}

function updateUI() {
  eqListEl.innerHTML = '';
  equations.forEach((eq, idx) => {
    const defaultColor = getThemeColor(idx);
    const actualColor = eq.color || defaultColor;
    const row = document.createElement('div');
    row.className = 'eq-row';
    row.style.borderLeftColor = actualColor;
    row.innerHTML = `
      <span style="opacity:0.5">f(x)=</span>
      <input type="text" value="${eq.text}" onfocus="activeInput=this" oninput="updateEq(${eq.id}, this.value)">
      <input type="color" class="color-picker" value="${actualColor}" onchange="updateColor(${eq.id}, this.value)" title="Change color">
      <span onclick="deleteEq(${eq.id})" style="cursor:pointer; padding: 0 5px; font-size: 1.2rem;">×</span>
    `;
    eqListEl.appendChild(row);
  });
}

function updateEq(id, text) {
  const eq = equations.find(e => e.id === id);
  if(eq) { eq.text = text; addToHistory(`f(x) = ${text}`); }
  render();
}

function updateColor(id, color) {
  const eq = equations.find(e => e.id === id);
  if(eq) eq.color = color;
  updateUI(); render();
}

function deleteEq(id) {
  equations = equations.filter(e => e.id !== id);
  updateUI(); render();
}

function addChar(c) {
  if(!activeInput) return;
  const start = activeInput.selectionStart;
  activeInput.value = activeInput.value.slice(0, start) + c + activeInput.value.slice(start);
  activeInput.focus();
  activeInput.dispatchEvent(new Event('input'));
}

function addToHistory(item) {
  const timestamp = new Date().toLocaleTimeString();
  history.unshift(`[${timestamp}] ${item}`);
  if(history.length > 20) history = history.slice(0, 20);
  localStorage.setItem('curvo-history', JSON.stringify(history));
  updateHistory();
}

function updateHistory() {
  historyEl.innerHTML = '';
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.textContent = item;
    historyEl.appendChild(div);
  });
}

function clearHistory() { history = []; localStorage.removeItem('curvo-history'); updateHistory(); }

function drawGrid(zoom) {
  const cx = canvas.width/2; const cy = canvas.height/2;
  const axisColor = getComputedStyle(document.body).getPropertyValue('--axis-color').trim();
  const gridAlpha = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-weight'));
  ctx.strokeStyle = axisColor; ctx.lineWidth = 0.5; ctx.globalAlpha = gridAlpha;
  for(let x = cx % zoom; x < canvas.width; x += zoom) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for(let y = cy % zoom; y < canvas.height; y += zoom) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  ctx.globalAlpha = 0.8; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
  ctx.globalAlpha = 1; ctx.fillStyle = axisColor; ctx.font = `bold 12px ${getComputedStyle(document.body).fontFamily}`; ctx.textAlign = "center";
  for (let i = 1; i * zoom < canvas.width/2; i++) {
      ctx.fillText(i, cx + i * zoom, cy + 20); ctx.fillText(-i, cx - i * zoom, cy + 20);
      ctx.fillText(i, cx - 15, cy - i * zoom + 5); ctx.fillText(-i, cx - 15, cy + i * zoom + 5);
  }
}

function drawPacman() {
  if(currentTheme !== 'theme-surprise') return;
  pacman.mouthOpen += 0.1;
  const mouthAngle = Math.abs(Math.sin(pacman.mouthOpen)) * 0.3;
  pacman.x += pacman.speed * pacman.direction;
  if(pacman.x > canvas.width + 50) { pacman.x = -50; pacman.targetY = Math.random() * canvas.height; }
  if(Math.abs(pacman.y - pacman.targetY) > 2) { pacman.y += (pacman.targetY - pacman.y) * 0.02; }
  ctx.save(); ctx.translate(pacman.x, pacman.y);
  ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(0, 0, pacman.size, mouthAngle, Math.PI * 2 - mouthAngle); ctx.lineTo(0, 0); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(8, -10, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // --- ADDED GHOSTS ---
  equations.forEach((eq, idx) => {
    if(!eq.text) return;
    try {
      const node = math.compile(eq.text);
      const x = (pacman.x - canvas.width/2) / parseFloat(zoomSlider.value);
      const y = node.evaluate({ x, a: params.a, b: params.b, c: params.c });
      const py = canvas.height/2 - (y * parseFloat(zoomSlider.value));
      if(!isNaN(py) && Math.abs(py) < canvas.height) {
        const color = eq.color || getThemeColor(idx);
        const gSize = 12;
        ctx.save(); ctx.translate(pacman.x, py);
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -gSize/2, gSize, Math.PI, 0); ctx.lineTo(gSize, gSize);
        for (let i = 0; i <= 3; i++) { ctx.lineTo(gSize - (i * (gSize*2/3)), gSize + (i % 2 === 0 ? 3 : -3)); }
        ctx.lineTo(-gSize, gSize); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(-4, -gSize/2, 3, 0, Math.PI * 2); ctx.arc(4, -gSize/2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "blue"; ctx.beginPath(); ctx.arc(-3, -gSize/2, 1.5, 0, Math.PI * 2); ctx.arc(5, -gSize/2, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } catch(e) {}
  });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const zoom = parseFloat(zoomSlider.value);
  const cx = canvas.width/2; const cy = canvas.height/2;
  drawGrid(zoom);
  equations.forEach((eq, idx) => {
    if(!eq.text) return;
    try {
      const node = math.compile(eq.text);
      const color = eq.color || getThemeColor(idx);
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.shadowBlur = 15; ctx.shadowColor = color;
      let first = true;
      for(let px = 0; px < canvas.width; px++) {
        const x = (px - cx) / zoom;
        const y = node.evaluate({ x, a: params.a, b: params.b, c: params.c });
        const py = cy - (y * zoom);
        if(isNaN(py) || Math.abs(py) > canvas.height * 2) { first = true; continue; }
        if(first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
    } catch(e) {}
  });
  drawPacman();
}

function animate() { render(); requestAnimationFrame(animate); }

canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const zoom = parseFloat(zoomSlider.value);
    coordEl.innerText = `${((px - canvas.width/2) / zoom).toFixed(2)}, ${((canvas.height/2 - py) / zoom).toFixed(2)}`;
};

zoomSlider.oninput = render;
updateUI();
updateHistory();
animate();
</script>
