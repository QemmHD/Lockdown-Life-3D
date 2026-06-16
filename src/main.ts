import './style.css';
import { Game } from './core/Game';

// prevent page scroll / pinch-zoom of the page on touch devices while playing
document.addEventListener('touchmove', (e) => {
  if ((e.target as HTMLElement)?.closest('#panel, #alert-feed')) return;
  e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

function boot() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) {
    document.getElementById('ui-root')!.innerHTML = '<div style="color:#fff;padding:2rem;font-family:sans-serif">WebGL is required to run this game.</div>';
    return;
  }
  try { new Game(canvas); }
  catch (err) {
    console.error(err);
    const d = document.createElement('div');
    d.style.cssText = 'color:#f66;padding:1.5rem;font-family:monospace;white-space:pre-wrap';
    d.textContent = 'Failed to start:\n' + (err as Error)?.stack;
    document.getElementById('ui-root')!.appendChild(d);
  }
}
boot();
