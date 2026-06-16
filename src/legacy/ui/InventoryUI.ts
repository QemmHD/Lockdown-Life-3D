import { GameState } from '../game/GameState';
import { InventorySystem, MAX_SLOTS } from '../systems/InventorySystem';
import { AudioSystem } from '../systems/AudioSystem';
import { ITEMS } from '../data/items';

export class InventoryUI {
  open = false;
  private panel: HTMLDivElement;
  private stashId: string | null = null;
  toast?: (m: string, t?: string) => void;
  onClose?: () => void;

  constructor(private state: GameState, private inv: InventorySystem, private audio: AudioSystem) {
    this.panel = document.createElement('div');
    this.panel.id = 'inventory';
    this.panel.className = 'modal';
    this.panel.style.display = 'none';
    document.getElementById('ui-root')!.appendChild(this.panel);
  }

  toggle(stashId: string | null = null) {
    if (this.open) this.close(); else this.show(stashId);
  }

  show(stashId: string | null = null) {
    this.open = true;
    this.stashId = stashId;
    this.panel.style.display = 'flex';
    this.audio.play('click');
    this.render();
  }

  close() { this.open = false; this.panel.style.display = 'none'; this.onClose?.(); }

  private itemCell(itemId: string, qty: number, where: 'inv' | 'stash') {
    const it = ITEMS[itemId];
    const danger = it.contraband ? 'danger' : '';
    return `<div class="inv-cell ${danger}" data-id="${itemId}" data-where="${where}">
      <div class="inv-icon">${it.icon}</div>
      <div class="inv-name">${it.name}</div>
      <div class="inv-qty">x${qty}</div>
      ${it.contraband ? '<div class="inv-warn">⚠</div>' : ''}
    </div>`;
  }

  private render() {
    const stash = this.stashId ? this.inv.stashList(this.stashId) : null;
    let html = `<div class="inv-card"><div class="inv-header"><h2>🎒 Inventory <span class="inv-slots">${this.inv.slotsUsed()}/${MAX_SLOTS}</span></h2><button class="close-x" id="inv-close">✕</button></div>`;
    html += '<div class="inv-cols">';
    html += '<div class="inv-col"><h3>Pockets</h3><div class="inv-grid" id="inv-grid">';
    for (const i of this.state.inventory) html += this.itemCell(i.itemId, i.qty, 'inv');
    for (let i = this.state.inventory.length; i < MAX_SLOTS; i++) html += '<div class="inv-cell empty"></div>';
    html += '</div></div>';
    if (stash) {
      html += '<div class="inv-col"><h3>Stash</h3><div class="inv-grid" id="stash-grid">';
      for (const i of stash) html += this.itemCell(i.itemId, i.qty, 'stash');
      html += '</div></div>';
    }
    html += '</div>';
    html += '<div class="inv-detail" id="inv-detail">Select an item.</div>';
    html += '</div>';
    this.panel.innerHTML = html;

    (this.panel.querySelector('#inv-close') as HTMLElement).onclick = () => this.close();
    this.panel.querySelectorAll('.inv-cell[data-id]').forEach((c) => {
      (c as HTMLElement).onclick = () => this.select((c as HTMLElement).dataset.id!, (c as HTMLElement).dataset.where as any);
    });
  }

  private select(itemId: string, where: 'inv' | 'stash') {
    const it = ITEMS[itemId];
    const detail = this.panel.querySelector('#inv-detail') as HTMLElement;
    let btns = '';
    if (where === 'inv') {
      if (it.effect) btns += `<button data-act="use">Use</button>`;
      btns += `<button data-act="drop">Drop</button>`;
      if (this.stashId) btns += `<button data-act="tostash">→ Stash</button>`;
    } else {
      btns += `<button data-act="fromstash">Take</button>`;
    }
    detail.innerHTML = `
      <div class="detail-head">${it.icon} <b>${it.name}</b> ${it.contraband ? '<span class="tag-danger">CONTRABAND</span>' : ''}</div>
      <div class="detail-desc">${it.desc}</div>
      <div class="detail-stats">Type: ${it.type} · Value: $${it.value} · Risk: ${Math.round(it.risk * 100)}%${it.damage ? ' · DMG +' + it.damage : ''}</div>
      <div class="detail-btns">${btns}</div>`;
    detail.querySelectorAll('button').forEach((b) => {
      (b as HTMLElement).onclick = () => this.action((b as HTMLElement).dataset.act!, itemId);
    });
  }

  private action(act: string, itemId: string) {
    if (act === 'use') {
      const res = this.inv.use(itemId);
      if (res) { this.audio.play('eat'); this.toast?.('Used ' + ITEMS[itemId].name + ' (' + res + ')', 'good'); }
      else this.toast?.('Can\'t use that.', 'bad');
    } else if (act === 'drop') {
      this.inv.drop(itemId); this.toast?.('Dropped ' + ITEMS[itemId].name);
    } else if (act === 'tostash' && this.stashId) {
      this.inv.toStash(this.stashId, itemId); this.audio.play('pickup'); this.toast?.('Stashed ' + ITEMS[itemId].name, 'good');
    } else if (act === 'fromstash' && this.stashId) {
      if (this.inv.fromStash(this.stashId, itemId)) this.toast?.('Took ' + ITEMS[itemId].name, 'good');
      else this.toast?.('Pockets full!', 'bad');
    }
    this.render();
  }
}
