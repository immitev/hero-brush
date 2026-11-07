import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

/** Draws a spider-web line pattern on a canvas (our own drawing, no logos). */
export function webTexture(base: string, line: string, repeat = 2): THREE.CanvasTexture {
  const key = `${base}|${line}|${repeat}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  if (g) {
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = line;
    g.lineWidth = 3;
    g.lineCap = 'round';
    const cx = size / 2;
    const cy = size / 2;
    const spokes = 10;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size);
      g.stroke();
    }
    for (let r = 18; r < size * 0.8; r += 22) {
      g.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a0 = (i / spokes) * Math.PI * 2;
        const a1 = ((i + 0.5) / spokes) * Math.PI * 2;
        const x0 = cx + Math.cos(a0) * r;
        const y0 = cy + Math.sin(a0) * r;
        const x1 = cx + Math.cos(a1) * r * 0.9;
        const y1 = cy + Math.sin(a1) * r * 0.9;
        if (i === 0) g.moveTo(x0, y0);
        else g.lineTo(x0, y0);
        g.lineTo(x1, y1);
      }
      g.stroke();
    }
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}
