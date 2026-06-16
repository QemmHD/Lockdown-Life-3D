import './style.css';
import { Game } from './game/Game';

// Prevent page scroll / pull-to-refresh on touch while playing
document.addEventListener('touchmove', (e) => {
  if ((e.target as HTMLElement)?.closest('.scroll, .inv-detail, .menu-panel')) return;
  e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

function boot() {
  try {
    // WebGL support check
    const test = document.createElement('canvas');
    const gl = test.getContext('webgl2') || test.getContext('webgl');
    if (!gl) {
      document.getElementById('ui-root')!.innerHTML =
        '<div style="color:#fff;padding:2rem;font-family:sans-serif">Your browser/device does not support WebGL, which this 3D game requires.</div>';
      return;
    }
    new Game(canvas);
  } catch (err) {
    console.error(err);
    const div = document.createElement('div');
    div.style.cssText = 'color:#f55;padding:2rem;font-family:monospace;white-space:pre-wrap';
    div.textContent = 'Failed to start Lockdown Life 3D:\n' + (err as Error)?.stack;
    document.getElementById('ui-root')!.appendChild(div);
  }
}

boot();
