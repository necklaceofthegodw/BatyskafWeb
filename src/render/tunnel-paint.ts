import { seeded } from '../game/math';

// Outer trim, painted stripe and centre highlight, in campaign order.
const guideStripes = [
  ['#467e92', '#7bbad1', '#c5e7ef'],
  ['#566d46', '#92ae73', '#c9d9a1'],
  ['#965f58', '#d89483', '#f5c3ac'],
  ['#795e41', '#bc986b', '#e2c69c'],
  ['#40265b', '#8054ab', '#aa82c8'],
];

// The atlas spans a full circumference and four lengths of pressure panels.
export function paintTunnel(
  ctx: CanvasRenderingContext2D,
  panel: HTMLCanvasElement,
  stage: number,
) {
  const rng = seeded(473 + stage);
  const size = 512;
  const dot = (x: number, y: number, w: number, h: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      ctx.save();
      ctx.translate(col * size, row * size);
      ctx.drawImage(panel, 0, 0);
      if (stage >= 3) {
        ctx.fillStyle = stage === 3 ? 'rgba(64,50,42,.35)' : 'rgba(34,65,79,.50)';
        ctx.fillRect(0, 0, size, size);
      }
      const [trim, stripe, highlight] = guideStripes[stage];
      ctx.fillStyle = trim;
      ctx.fillRect(0, 0, 26, size);
      ctx.fillStyle = stripe;
      ctx.fillRect(4, 0, 18, size);
      ctx.fillStyle = highlight;
      ctx.fillRect(8, 0, 9, size);
      for (const offset of [0, 256]) {
        ctx.beginPath();
        ctx.moveTo(208, offset + 160);
        ctx.lineTo(256, offset + 116);
        ctx.lineTo(304, offset + 160);
        ctx.lineWidth = 10;
        ctx.strokeStyle = trim;
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.strokeStyle = stripe;
        ctx.stroke();
      }
      const x = 70 + rng() * 330;
      const y = 250;
      if (stage === 0 && col >= 2) {
        for (let i = 0; i < 19; i++) {
          const start = x + rng() * 66,
            reach = 12 + rng() * 95;
          ctx.strokeStyle = i % 3 ? '#707d43' : '#98a060';
          ctx.lineWidth = 1 + rng() * 3;
          ctx.beginPath();
          ctx.moveTo(start, y + rng() * 5);
          ctx.bezierCurveTo(
            start - 8,
            y - reach * 0.4,
            start + 17,
            y - reach * 0.7,
            start + 12,
            y - reach,
          );
          ctx.stroke();
        }
      } else if (stage === 1) {
        const start = row % 2 ? 52 : 390;
        for (let i = 0; i < 260; i++) {
          const t = rng(),
            spread = Math.sin(t * Math.PI);
          const px = start + t * 80,
            py = y + (rng() - 0.5) * 54 * spread + Math.sin(t * 9) * 6;
          dot(px, py, 3 + rng() * 7, 3 + rng() * 5, ['#304736', '#475e3e', '#63794b'][i % 3]);
          dot(px - 1, py - 2, 2, 1.4, '#90a46a');
        }
      } else if (stage === 2 && (col === 0 || col === 2) && (row + col) % 3 === 0) {
        const branch = (px: number, py: number, angle: number, length: number, depth: number) => {
          const endX = px + Math.sin(angle) * length,
            endY = py - Math.cos(angle) * length;
          ctx.strokeStyle = ['#ffc29a', '#ed987e', '#cd7868', '#a55d57', '#8c5350'][depth];
          ctx.lineCap = 'round';
          ctx.lineWidth = 1.5 + depth * 1.7;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          if (depth)
            for (const side of [-1, 1])
              branch(
                endX,
                endY,
                angle + side * (0.15 + rng() * 0.35),
                length * (0.61 + rng() * 0.19),
                depth - 1,
              );
        };
        for (let i = -2; i <= 2; i++) branch(x, y, i * 0.44, 25 + rng() * 16, 4);
      } else if (stage === 3) {
        for (const bolt of [53, 474]) {
          for (let i = 0; i < 18; i++) {
            const offset = (rng() - 0.5) * 24;
            ctx.fillStyle = 'rgba(130,66,39,.36)';
            ctx.fillRect(bolt + offset, 36, 2 + rng() * 4, rng() * 85);
          }
        }
        ctx.font = 'bold 26px monospace';
        ctx.fillStyle = '#797468';
        if (col === 0 && row === 1) ctx.fillText('SERW. 04-18', 70, y - 4);
        for (let i = 0; i < 120; i++)
          dot(
            45 + rng() * 420,
            y - rng() ** 3 * 20,
            1 + rng() * 6,
            1 + rng() * 3,
            i % 4 ? '#c9c3ab' : '#817c70',
          );
      } else if (stage === 4) {
        for (let i = 0; i < 14; i++) {
          const px = x + rng() * 64,
            py = y + rng() * 6;
          dot(px, py, 5, 4, 'rgba(53,175,167,.22)');
          dot(px, py, 1 + rng() * 2, 1.7, '#8ee3d3');
        }
      }
      ctx.restore();
    }
  }
}
