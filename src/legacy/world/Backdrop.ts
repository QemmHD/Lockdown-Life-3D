import * as THREE from 'three';

export type BackdropMode = 'indoor' | 'outdoor';

// Manages the scene background + fog so each area "feels" different:
// indoors is a claustrophobic concrete gloom; the yard opens onto a bright sky
// with a distant city skyline — the free world beyond the walls.
export class Backdrop {
  private indoorTex: THREE.Texture;
  private outdoorTex: THREE.Texture;
  private lockdownTex: THREE.Texture;
  mode: BackdropMode | 'lockdown' | null = null;

  constructor() {
    this.indoorTex = this.makeIndoor();
    this.outdoorTex = this.makeOutdoor(false);
    this.lockdownTex = this.makeOutdoor(true);
  }

  private makeIndoor(): THREE.Texture {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#05060a');
    g.addColorStop(0.6, '#0d1018');
    g.addColorStop(1, '#171b24');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    // faint grime
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.1})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 30, 2 + Math.random() * 30);
    }
    return new THREE.CanvasTexture(c);
  }

  private makeOutdoor(lockdown: boolean): THREE.Texture {
    const W = 512, H = 512;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (lockdown) {
      g.addColorStop(0, '#2a0d12'); g.addColorStop(0.55, '#5a1d22'); g.addColorStop(1, '#8a3a2a');
    } else {
      g.addColorStop(0, '#1c3a66'); g.addColorStop(0.5, '#5a86bf'); g.addColorStop(0.78, '#bcd3e8'); g.addColorStop(1, '#e9d4a8');
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sun / haze glow
    const sx = 360, sy = 150;
    const sun = ctx.createRadialGradient(sx, sy, 5, sx, sy, 120);
    sun.addColorStop(0, lockdown ? 'rgba(255,180,120,0.9)' : 'rgba(255,244,210,0.95)');
    sun.addColorStop(1, 'rgba(255,244,210,0)');
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sx, sy, 120, 0, Math.PI * 2); ctx.fill();
    // clouds
    if (!lockdown) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 6; i++) {
        const cx = Math.random() * W, cy = 60 + Math.random() * 160;
        for (let j = 0; j < 5; j++) {
          ctx.beginPath(); ctx.ellipse(cx + j * 22 - 44, cy + Math.sin(j) * 6, 28, 14, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // distant city skyline (the free world) along the horizon
    const horizon = H * 0.74;
    const farColor = lockdown ? '#3a1518' : '#2c3e57';
    let x = 0;
    while (x < W) {
      const bw = 16 + Math.random() * 40;
      const bh = 30 + Math.random() * 150;
      ctx.fillStyle = farColor;
      ctx.fillRect(x, horizon - bh, bw, bh + (H - horizon));
      // lit windows
      ctx.fillStyle = lockdown ? 'rgba(255,140,90,0.5)' : 'rgba(255,236,170,0.55)';
      for (let wy = horizon - bh + 8; wy < horizon - 6; wy += 12) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 9) {
          if (Math.random() < 0.45) ctx.fillRect(wx, wy, 3, 5);
        }
      }
      x += bw + 3;
    }
    // ground haze
    const hz = ctx.createLinearGradient(0, horizon, 0, H);
    hz.addColorStop(0, lockdown ? 'rgba(90,40,30,0)' : 'rgba(120,140,160,0)');
    hz.addColorStop(1, lockdown ? 'rgba(50,20,15,0.7)' : 'rgba(90,110,130,0.7)');
    ctx.fillStyle = hz; ctx.fillRect(0, horizon, W, H - horizon);
    return new THREE.CanvasTexture(c);
  }

  apply(scene: THREE.Scene, mode: BackdropMode, lockdown: boolean) {
    const key = lockdown ? 'lockdown' : mode;
    if (this.mode === key) return;
    this.mode = key;
    if (lockdown && mode === 'outdoor') {
      scene.background = this.lockdownTex;
      scene.fog = new THREE.Fog(0x6a2a22, 70, 220);
    } else if (mode === 'outdoor') {
      scene.background = this.outdoorTex;
      scene.fog = new THREE.Fog(0xbcd0e6, 90, 240);
    } else {
      scene.background = this.indoorTex;
      scene.fog = new THREE.Fog(lockdown ? 0x1a0c0c : 0x0b0d10, 45, 130);
    }
  }
}
