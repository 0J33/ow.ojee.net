/* Animated plus-grid backdrop — the same motif as ojee.net/ow.
   Static single frame on touch devices to save battery. */

const BASE_ALPHA = 0.05;
const MAX_ALPHA = 0.34;
const GLOW_RADIUS = 190;
const PULL = 5;
const SPACING = 46;
const PLUS_SIZE = 4;
const PLUS_THICK = 1;
const LERP = 0.14;

export function initGridBackground(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const isTouch = window.matchMedia('(hover: none)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };
  let cols = 0, rows = 0, points = [], raf = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(window.innerWidth / SPACING) + 1;
    rows = Math.ceil(window.innerHeight / SPACING) + 1;
    points = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        points.push({ bx: c * SPACING, by: r * SPACING, x: c * SPACING, y: r * SPACING });
  };

  const paintBackdrop = () => {
    const w = window.innerWidth, h = window.innerHeight;
    const grad = ctx.createLinearGradient(0, 0, w * 0.3, h);
    grad.addColorStop(0, '#04081a');
    grad.addColorStop(0.5, '#060e24');
    grad.addColorStop(1, '#030818');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
  };

  const drawStatic = () => {
    paintBackdrop();
    ctx.strokeStyle = `rgba(255,255,255,${BASE_ALPHA})`;
    ctx.lineWidth = PLUS_THICK;
    ctx.beginPath();
    for (const p of points) {
      ctx.moveTo(p.bx - PLUS_SIZE, p.by); ctx.lineTo(p.bx + PLUS_SIZE, p.by);
      ctx.moveTo(p.bx, p.by - PLUS_SIZE); ctx.lineTo(p.bx, p.by + PLUS_SIZE);
    }
    ctx.stroke();
  };

  const draw = () => {
    paintBackdrop();
    mouse.sx += (mouse.x - mouse.sx) * 0.12;
    mouse.sy += (mouse.y - mouse.sy) * 0.12;

    for (const p of points) {
      const dx = mouse.sx - p.bx, dy = mouse.sy - p.by;
      const dist = Math.hypot(dx, dy);
      let tx = p.bx, ty = p.by, alpha = BASE_ALPHA, lw = PLUS_THICK;

      if (dist < GLOW_RADIUS && dist > 1) {
        const ease = (1 - dist / GLOW_RADIUS) ** 3;
        alpha = BASE_ALPHA + (MAX_ALPHA - BASE_ALPHA) * ease;
        lw = PLUS_THICK + ease * 1.2;
        tx = p.bx - (dx / dist) * ease * PULL;
        ty = p.by - (dy / dist) * ease * PULL;
      }

      p.x += (tx - p.x) * LERP;
      p.y += (ty - p.y) * LERP;

      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(p.x - PLUS_SIZE, p.y); ctx.lineTo(p.x + PLUS_SIZE, p.y);
      ctx.moveTo(p.x, p.y - PLUS_SIZE); ctx.lineTo(p.x, p.y + PLUS_SIZE);
      ctx.stroke();
    }
    raf = requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', () => { resize(); if (isTouch || reduced) drawStatic(); });

  if (isTouch || reduced) {
    drawStatic();
  } else {
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    });
    draw();
  }
}
