import * as THREE from 'three';
import { GameState, clamp } from './GameState';
import { CameraController } from './CameraController';
import { Input } from './Input';
import { MobileControls } from './MobileControls';
import { SaveSystem } from './SaveSystem';
import { CollisionWorld } from '../world/Collision';
import { PrisonMap, Interactable } from '../world/PrisonMap';
import { roomAt, ROOM_MAP } from '../data/rooms';
import { Player } from '../entities/Player';
import { NPC } from '../entities/NPC';
import { NPCS, NPC_MAP } from '../data/npcs';
import { AudioSystem } from '../systems/AudioSystem';
import { ScheduleSystem } from '../systems/ScheduleSystem';
import { HeatSystem } from '../systems/HeatSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { CombatSystem } from '../systems/CombatSystem';
import { DialogueSystem } from '../systems/DialogueSystem';
import { EventSystem } from '../systems/EventSystem';
import { JobSystem } from '../systems/JobSystem';
import { TrainingSystem } from '../systems/TrainingSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { HUD } from '../ui/HUD';
import { Menus } from '../ui/Menus';
import { InventoryUI } from '../ui/InventoryUI';

type Mode = 'menu' | 'playing' | 'paused' | 'dialogue' | 'inventory' | 'event' | 'activity';

const VERSION = '1.0.0';
const INTERACT_RANGE = 2.4;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: CameraController;
  private collision = new CollisionWorld();
  private map: PrisonMap;
  private clock = new THREE.Clock();
  private dirLight!: THREE.DirectionalLight;

  state = new GameState();
  private input = new Input();
  private mobile = new MobileControls();
  private audio: AudioSystem;
  private schedule: ScheduleSystem;
  private heat: HeatSystem;
  private inv: InventorySystem;
  private combat: CombatSystem;
  private dialogue: DialogueSystem;
  private events: EventSystem;
  private jobs: JobSystem;
  private training: TrainingSystem;
  private fx: EffectsSystem;
  private hud: HUD;
  private menus: Menus;
  private invUI: InventoryUI;

  private player: Player;
  private npcs: NPC[] = [];

  private mode: Mode = 'menu';
  private menuOrbit = 0;
  private alarmTimer = 0;
  private alarm = { x: 0, z: 0 };
  private nearInteractable: Interactable | null = null;
  private nearNPC: NPC | null = null;
  private activity: { time: number; dur: number; label: string; cb: () => void } | null = null;
  private activityEl: HTMLDivElement;
  private dayEarned = { money: 0, rep: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x0b0d10);
    this.scene.fog = new THREE.Fog(0x0b0d10, 80, 160);

    this.cam = new CameraController();
    this.setupLights();

    this.map = new PrisonMap(this.scene, this.collision);
    this.map.build();

    // systems
    this.audio = new AudioSystem(this.state.settings);
    this.schedule = new ScheduleSystem(this.state);
    this.heat = new HeatSystem(this.state);
    this.inv = new InventorySystem(this.state);
    this.fx = new EffectsSystem(this.scene, this.cam.camera);
    this.combat = new CombatSystem(this.state, this.fx, this.audio, this.inv);
    this.dialogue = new DialogueSystem(this.state, this.inv, this.audio);
    this.jobs = new JobSystem(this.state);
    this.training = new TrainingSystem(this.state);

    // player + npcs
    this.player = new Player(this.state, this.collision);
    this.scene.add(this.player.rig.group);
    this.spawnNPCs();
    this.combat.setRefs(this.player, this.npcs, this.cam);

    // UI
    this.hud = new HUD(this.state, this.schedule, this.heat);
    this.invUI = new InventoryUI(this.state, this.inv, this.audio);
    this.events = new EventSystem(this.state, this.inv, this.audio, {
      toast: (m, t) => this.hud.toast(m, t),
      forceLockdown: () => this.forceLockdown(),
      spawnHostile: () => this.spawnHostileNear(),
      startEscapeThread: () => this.startEscapeThread(),
      notify: (a, b) => this.hud.notify(a, b)
    });
    this.menus = new Menus(this.state, this.schedule, {
      onNewGame: () => this.newGame(),
      onContinue: () => this.continueGame(),
      onResume: () => this.resume(),
      onSave: () => this.saveGame(),
      onQuitToMenu: () => this.toMenu(),
      onSettingsChange: (s) => this.applySettings(),
      hasSave: () => SaveSystem.hasSave(),
      playerPos: () => ({ x: this.player.x, z: this.player.z }),
      targetRoom: () => this.schedule.requiredRoom(),
      version: VERSION
    });

    this.activityEl = document.createElement('div');
    this.activityEl.id = 'activity';
    this.activityEl.style.display = 'none';
    document.getElementById('ui-root')!.appendChild(this.activityEl);

    this.wireSystems();
    this.wireUI();

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('pointerdown', () => this.audio.init(), { once: false });

    this.hud.hide();
    this.menus.mainMenu();
    this.player.setPos(this.map.spawnPoint().x, this.map.spawnPoint().z);
    this.cam.snapTo(this.player.x, this.player.z);
    this.loop();
  }

  private setupLights() {
    const amb = new THREE.AmbientLight(0x9aa0b0, 0.65);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xfff0d8, 0.95);
    dir.position.set(40, 70, 30);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const d = 80;
    dir.shadow.camera.left = -d; dir.shadow.camera.right = d;
    dir.shadow.camera.top = d; dir.shadow.camera.bottom = -d;
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 200;
    dir.shadow.bias = -0.0004;
    this.scene.add(dir);
    this.dirLight = dir;
    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a3a30, 0.3);
    this.scene.add(hemi);
  }

  private spawnNPCs() {
    for (const def of NPCS) {
      const npc = new NPC(def, this.collision);
      const r = ROOM_MAP[def.spawnRoom];
      npc.setPos(r.x + (Math.random() - 0.5) * (r.w - 3), r.z + (Math.random() - 0.5) * (r.d - 3));
      this.scene.add(npc.rig.group);
      this.npcs.push(npc);
    }
  }

  private wireSystems() {
    this.schedule.onPhaseChange = (phase, prev) => {
      this.hud.notify(phase.name, phase.announce);
      this.audio.play(phase.id === 'lockdown' ? 'siren' : 'daybreak');
      if (phase.restricted) { this.map.setDoorsOpen(false); this.audio.play('cell_slam'); this.cam.shake(0.4); }
      else this.map.setDoorsOpen(true);
      this.events.onPhaseChange(phase.id);
      // heat for missing required room
      const req = phase.requiredRoom;
      if (req && this.state.currentRoom !== req && ['rollcall', 'lockdown'].includes(phase.id)) {
        this.heat.add(12); this.hud.toast('You missed ' + phase.name + '! Heat rising.', 'bad');
      }
    };

    this.heat.onPunish = (reason) => this.sendToSolitary(reason);

    this.combat.onKO = (npc) => {
      const s = this.state.stats;
      s.respect += 3 + Math.round(npc.def.base.respect * 6);
      s.reputation += 2;
      s.fear += 5;
      this.state.changeFactionRep(npc.def.faction, -15);
      this.dayEarned.rep += 2;
      if (npc.isGuard) { this.heat.add(45); this.hud.toast('You downed a guard! Massive heat!', 'bad'); }
      else this.hud.toast(`You beat ${npc.def.name}. Respect up.`, 'good');
    };
    this.combat.onPlayerKO = () => this.handlePlayerKO();
    this.combat.onHostile = (npc) => { if (npc.isGuard) this.triggerAlarm(npc.x, npc.z); };
    this.combat.onFightSeen = (x, z, byGuardOnly) => {
      const guardNear = byGuardOnly || this.npcs.some((n) => n.isGuard && !n.ko && n.distTo(x, z) < 13);
      if (guardNear) { this.heat.add(byGuardOnly ? 18 : 12); this.triggerAlarm(x, z); this.audio.play('whistle'); }
      else this.heat.add(3);
    };

    this.dialogue.onChallenge = (npc) => { npc.ai = 'fight'; npc.combatTarget = 'player'; npc.hostile = true; this.hud.toast(`${npc.def.name} squares up!`, 'bad'); };
    this.dialogue.toast = (m, t) => this.hud.toast(m, t);
    this.dialogue.onClose = () => { if (this.mode === 'dialogue') this.mode = 'playing'; };

    this.invUI.toast = (m, t) => this.hud.toast(m, t);
    this.invUI.onClose = () => { if (this.mode === 'inventory') this.mode = 'playing'; };
  }

  private wireUI() {
    this.hud.onButton = (id) => {
      if (id === 'inventory') this.openInventory();
      else if (id === 'pause') this.pause();
      else if (id === 'map') { this.pause(); this.menus.map(); }
      else if (id === 'stats') { this.pause(); this.menus.stats(); }
      else if (id === 'factions') { this.pause(); this.menus.factions(); }
      else if (id === 'relationships') { this.pause(); this.menus.relationships(); }
    };
    this.mobile.setOpacity(this.state.settings.controlOpacity);
  }

  // ---------------- Mode transitions ----------------
  private newGame() {
    this.state.reset();
    this.resetEntities();
    SaveSystem.clear();
    this.startPlaying();
    this.hud.toast('New game started. Survive your sentence.', 'event');
  }

  private continueGame() {
    const data = SaveSystem.load();
    if (!data) { this.newGame(); return; }
    SaveSystem.apply(this.state, data);
    this.player.setPos(data.player.x, data.player.z);
    for (const ns of Object.values(data.npcState)) {
      const npc = this.npcs.find((n) => n.def.id === ns.id);
      if (npc) { npc.setPos(ns.x, ns.z); npc.health = ns.health; if (ns.ko) npc.knockout(ns.koTimer); }
    }
    this.applySettings();
    this.startPlaying();
    this.hud.toast('Game loaded.', 'good');
  }

  private resetEntities() {
    this.player.setPos(this.map.spawnPoint().x, this.map.spawnPoint().z);
    this.player.koTimer = 0;
    for (const npc of this.npcs) {
      const r = ROOM_MAP[npc.def.spawnRoom];
      npc.setPos(r.x + (Math.random() - 0.5) * (r.w - 3), r.z + (Math.random() - 0.5) * (r.d - 3));
      npc.health = npc.maxHealth; npc.koTimer = 0; npc.ai = 'schedule'; npc.combatTarget = null; npc.hostile = false;
    }
  }

  private startPlaying() {
    this.applySettings();
    this.menus.hide();
    this.hud.show();
    this.mode = 'playing';
    this.cam.snapTo(this.player.x, this.player.z);
    this.audio.init();
  }

  private pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.menus.pause();
  }
  private resume() { this.menus.hide(); this.mode = 'playing'; this.clock.getDelta(); }
  private toMenu() { this.menus.hide(); this.hud.hide(); this.mode = 'menu'; this.menus.mainMenu(); }

  private openInventory() {
    const stashId = this.nearInteractable?.type === 'stash' ? this.nearInteractable.id : null;
    this.mode = 'inventory';
    this.invUI.show(stashId);
  }

  private applySettings() {
    this.audio.applySettings();
    this.cam.setShakeEnabled(this.state.settings.cameraShake);
    this.mobile.setOpacity(this.state.settings.controlOpacity);
    const hi = this.state.settings.quality === 'high';
    this.renderer.shadowMap.enabled = hi;
    this.dirLight.castShadow = hi;
  }

  private saveGame() {
    const ok = SaveSystem.save(this.state, this.player, this.npcs);
    this.hud.toast(ok ? '💾 Game saved' : 'Save failed', ok ? 'good' : 'bad');
  }

  // ---------------- Gameplay helpers ----------------
  private triggerAlarm(x: number, z: number) { this.alarmTimer = 12; this.alarm = { x, z }; }

  private forceLockdown() {
    this.state.lockdown = true;
    this.map.setDoorsOpen(false);
    this.audio.play('siren');
    this.cam.shake(0.6);
    this.hud.toast('🚨 LOCKDOWN — get to the cell block!', 'bad');
  }

  private spawnHostileNear() {
    // pick a nearby non-ko inmate and make them hostile
    const candidates = this.npcs.filter((n) => !n.ko && !n.isGuard && !n.isStaff && n.distTo(this.player.x, this.player.z) < 30);
    if (candidates.length === 0) return;
    const n = candidates[Math.floor(Math.random() * candidates.length)];
    // move them close-ish
    const ang = Math.random() * Math.PI * 2;
    n.setPos(this.player.x + Math.sin(ang) * 6, this.player.z + Math.cos(ang) * 6);
    n.ai = 'fight'; n.combatTarget = 'player'; n.hostile = true;
    this.hud.toast(`${n.def.name} comes at you!`, 'bad');
  }

  private handlePlayerKO() {
    this.audio.play('whistle');
    this.cam.shake(0.8);
    this.hud.toast('You were knocked out...', 'bad');
    // clear hostiles
    for (const n of this.npcs) { if (n.combatTarget === 'player') { n.combatTarget = null; n.ai = 'schedule'; n.hostile = false; } }
    setTimeout(() => {
      const s = this.state.stats;
      const highHeat = s.heat > 60;
      if (highHeat) { this.sendToSolitary('You were knocked out and dragged to solitary.'); }
      else {
        const me = ROOM_MAP['medical'];
        this.player.setPos(me.x - 2, me.z - 1.5);
        s.health = clamp(s.maxHealth * 0.5, 1, s.maxHealth);
        s.injury = clamp(s.injury + 20, 0, 100);
        this.player.koTimer = 0;
        this.player.rig.setState('idle');
        this.cam.snapTo(this.player.x, this.player.z);
        this.hud.toast('You wake up in medical. Patched up, but sore.', 'event');
      }
    }, 2600);
  }

  private sendToSolitary(reason: string) {
    const so = ROOM_MAP['solitary'];
    this.player.setPos(so.x, so.z + 1);
    this.player.koTimer = 0;
    this.player.rig.setState('idle');
    const s = this.state.stats;
    s.mood = clamp(s.mood - 25, 0, 100);
    s.heat = clamp(s.heat * 0.3, 0, 100);
    this.state.timeOfDay = Math.min(23.9, this.state.timeOfDay + 3);
    this.cam.snapTo(this.player.x, this.player.z);
    this.audio.play('cell_slam');
    this.hud.toast('🔒 SOLITARY: ' + reason, 'bad');
    for (const n of this.npcs) { if (n.combatTarget === 'player') { n.combatTarget = null; n.ai = 'schedule'; n.hostile = false; } }
  }

  private startEscapeThread() {
    this.state.flags['escape_thread'] = 1;
    this.hud.notify('Escape Plan', 'Find a FILE and a KEYCARD, then reach the maintenance stash during Lights Out.');
  }

  private startActivity(dur: number, label: string, cb: () => void) {
    this.activity = { time: 0, dur, label, cb };
    this.mode = 'activity';
    this.activityEl.style.display = 'block';
  }

  private finishActivity() {
    this.activityEl.style.display = 'none';
    const cb = this.activity?.cb;
    this.activity = null;
    this.mode = 'playing';
    cb?.();
  }

  private sleep() {
    const s = this.state.stats;
    // overnight changes
    s.stamina = s.maxStamina;
    s.health = clamp(s.health + 20, 0, s.maxHealth);
    s.injury = clamp(s.injury - 15, 0, 100);
    s.hunger = clamp(s.hunger - 25, 0, 100);
    s.mood = clamp(s.mood + (s.hunger > 30 ? 8 : -5), 0, 100);
    s.fatigue = 0;
    this.heat.add(-10);
    // relationships drift slightly toward neutral
    for (const id in this.state.npcMemory) {
      const m = this.state.npcMemory[id];
      m.relationship *= 0.96;
    }
    this.schedule.advanceDay();
    this.resetNPCPositions();
    this.saveGame();

    if (this.state.sentenceDays <= 0) { this.endGameSurvived(); return; }
    this.menus.daySummary(this.dayEarned, () => { this.mode = 'playing'; this.dayEarned = { money: 0, rep: 0 }; });
    this.mode = 'paused';
  }

  private resetNPCPositions() {
    for (const npc of this.npcs) {
      if (npc.ko) { npc.koTimer = 0; npc.health = npc.maxHealth; npc.rig.setState('idle'); }
      npc.ai = 'schedule'; npc.combatTarget = null; npc.hostile = false;
    }
  }

  private endGameSurvived() {
    const s = this.state.stats;
    let title = '🌅 Released!';
    let body = `You served your time and walked out alive. Final reputation: ${Math.round(s.reputation)}, respect: ${Math.round(s.respect)}.`;
    if (s.respect > 70 && s.influence > 50) { title = '👑 Prison Kingpin'; body = 'You didn\'t just survive — you RAN the place. They\'ll tell stories about you for years.'; }
    else if (this.state.playerFaction) { body += ` You leave as a respected member of the ${this.state.playerFaction.replace('_', ' ')}.`; }
    this.audio.play('rep');
    this.menus.ending(title, body, () => this.toMenu());
    this.mode = 'paused';
    SaveSystem.clear();
  }

  private tryEscape(): boolean {
    if (!this.state.flags['escape_thread']) return false;
    if (this.inv.count('file') > 0 && this.inv.count('keycard') > 0 && (this.state.phase === 'sleep' || this.state.phase === 'lockdown')) {
      this.menus.ending('🏃 ESCAPE!', 'Under cover of Lights Out, you file through the maintenance grate, badge through the last door, and vanish into the night. You\'re free.', () => this.toMenu());
      this.mode = 'paused';
      SaveSystem.clear();
      return true;
    }
    return false;
  }

  // ---------------- Interactions ----------------
  private doInteract() {
    const it = this.nearInteractable;
    if (!it) return;
    this.player.rig.setState('interact');
    switch (it.type) {
      case 'bed':
        if (this.state.phase === 'sleep' || this.state.phase === 'lockdown' || this.state.timeOfDay >= 21 || this.schedule.needsSleep) this.sleep();
        else this.hud.toast('Too early to sleep. Wait for Lights Out.', 'info');
        break;
      case 'stash': this.openInventory(); break;
      case 'serving': case 'table':
        if (this.inv.count('food_tray') > 0) { this.inv.use('food_tray'); this.player.rig.setState('eat'); this.audio.play('eat'); this.fx.floatText(this.player.x, 2, this.player.z, '+hunger', '#e67e22'); }
        else if (this.inv.add('food_tray')) { this.audio.play('pickup'); this.hud.toast('Grabbed a food tray.', 'good'); }
        break;
      case 'toilet': this.state.stats.mood = clamp(this.state.stats.mood + 2, 0, 100); this.hud.toast('Relief.', 'info'); break;
      case 'shower': this.startActivity(2.5, 'Showering', () => { this.state.stats.mood = clamp(this.state.stats.mood + 14, 0, 100); this.hud.toast('Clean. Mood up.', 'good'); }); break;
      case 'phone': this.startActivity(2.5, 'On the phone', () => { const r = this.training.complete('mood'); this.hud.toast(r.msg, 'good'); }); break;
      case 'books': this.startActivity(2.8, 'Reading', () => { const r = this.training.complete('intelligence'); this.hud.toast(r.msg, r.gain ? 'good' : 'info'); this.audio.play(r.gain ? 'levelup' : 'click'); }); break;
      case 'weights': case 'pullup': this.trainStation(it.payload || 'strength'); break;
      case 'bag': this.trainStation('combat'); break;
      case 'track': this.trainStation('agility'); break;
      case 'medbed': this.startActivity(3, 'Resting', () => { const r = this.training.complete('rest'); this.hud.toast(r.msg, 'good'); }); break;
      case 'kitchenstation': case 'workbench': case 'cleanstation': case 'laundrystation':
        this.startJob(it.payload); break;
      case 'desk':
        this.heat.add(10); this.hud.toast('Snooping the guard desk! Heat rising.', 'bad');
        if (Math.random() < 0.3) { this.inv.add('guard_note'); this.hud.toast('You swiped a guard roster note!', 'good'); }
        break;
    }
  }

  private trainStation(kind: string) {
    this.startActivity(this.training.duration(kind), 'Training: ' + kind, () => {
      const r = this.training.complete(kind);
      this.player.rig.setState('train');
      this.audio.play(r.gain ? 'levelup' : 'workout' as any);
      this.fx.sweat(this.player.x, this.player.z);
      this.hud.toast(r.msg, r.ok ? (r.gain ? 'good' : 'info') : 'bad');
    });
  }

  private startJob(jobId: string) {
    if (this.state.stats.stamina < 12) { this.hud.toast('Too tired to work.', 'bad'); return; }
    this.startActivity(this.jobs.duration(jobId), 'Working: ' + this.jobs.name(jobId), () => {
      const r = this.jobs.complete(jobId);
      this.audio.play(r.money > 0 ? 'money' : 'fail');
      this.hud.toast(r.msg, r.money > 0 ? 'good' : 'bad');
      if (r.money) this.dayEarned.money += r.money;
      if (r.stole) {
        if (Math.random() < 0.5) { this.inv.add(r.stole); this.hud.toast(`You pocketed a ${r.stole}!`, 'event'); }
        else { this.heat.add(10); this.hud.toast('Caught taking materials! Heat up.', 'bad'); }
      }
    });
  }

  // ---------------- Main loop ----------------
  private loop = () => {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    if (this.mode === 'menu') this.updateMenu(dt, t);
    else if (this.mode === 'playing') this.updatePlaying(dt, t);
    else if (this.mode === 'activity') this.updateActivity(dt, t);
    // paused/dialogue/inventory/event: world frozen but still render + light fx
    if (this.mode !== 'playing' && this.mode !== 'menu' && this.mode !== 'activity') {
      this.fx.update(dt);
      this.map.update(dt, t, this.state.lockdown);
    }

    this.renderer.render(this.scene, this.cam.camera);
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  };

  private updateMenu(dt: number, t: number) {
    this.menuOrbit += dt * 0.15;
    const cx = Math.sin(this.menuOrbit) * 10;
    const cz = Math.cos(this.menuOrbit) * 10;
    this.cam.update(cx, cz, dt);
    // light npc animation for ambiance
    const ctx = this.npcCtx(dt, t);
    for (const n of this.npcs) n.update(ctx);
    this.map.update(dt, t, false);
    this.fx.update(dt);
    this.player.rig.update(dt, 0);
  }

  private npcCtx(dt: number, t: number) {
    return {
      px: this.player.x, pz: this.player.z, dt, time: t,
      lockdown: this.state.lockdown,
      requiredRoom: this.schedule.requiredRoom(),
      alarm: this.alarmTimer > 0,
      alarmX: this.alarm.x, alarmZ: this.alarm.z
    };
  }

  private updateActivity(dt: number, t: number) {
    if (!this.activity) { this.mode = 'playing'; return; }
    this.activity.time += dt;
    const frac = Math.min(1, this.activity.time / this.activity.dur);
    this.activityEl.innerHTML = `<div class="act-label">${this.activity.label}</div><div class="act-bar"><div class="act-fill" style="width:${frac * 100}%"></div></div><div class="act-hint">working...</div>`;
    // still animate world subtly
    this.map.update(dt, t, this.state.lockdown);
    this.fx.update(dt);
    this.player.rig.update(dt, 0);
    this.cam.update(this.player.x, this.player.z, dt);
    if (frac >= 1) this.finishActivity();
  }

  private updatePlaying(dt: number, t: number) {
    // --- input actions (edge) ---
    if (this.input.consumePressed('escape') || this.input.consumePressed('p')) { this.pause(); return; }
    if (this.input.consumePressed('i') || this.input.consumePressed('tab') || this.mobile.consume('inventory')) { this.openInventory(); return; }
    if (this.input.consumePressed('m')) { this.pause(); this.menus.map(); return; }
    if (this.input.consumePressed('=') || this.input.consumePressed('+')) this.cam.setZoom(-3);
    if (this.input.consumePressed('-')) this.cam.setZoom(3);

    const interactPressed = this.input.consumePressed('e') || this.input.consumePressed(' ') || this.mobile.consume('interact');
    const talkPressed = this.mobile.consume('talk') || this.input.consumePressed('t');
    const attackPressed = this.input.consumePressed('f') || this.input.mouseAttack || this.mobile.consume('attack');
    const shovePressed = this.input.consumePressed('q') || this.mobile.consume('shove');

    // block (held)
    this.player.blocking = this.input.blockHeld || this.input.down('r') || this.mobile.blockHeld;

    // movement
    const km = this.input.moveVector();
    const jm = this.mobile.getMove();
    let mx = km.x + jm.x, mz = km.z + jm.z;
    const sprint = this.input.sprint() || this.mobile.sprintHeld;
    this.player.update(dt, mx, mz, sprint);

    // combat
    if (attackPressed) this.combat.playerAttack(false);
    if (shovePressed) this.combat.playerAttack(true);
    this.combat.update(dt);

    // interactions / talk
    this.findNearby();
    if (talkPressed && this.nearNPC) { this.openDialogue(this.nearNPC); return; }
    if (interactPressed) {
      if (this.nearInteractable) this.doInteract();
      else if (this.nearNPC) this.openDialogue(this.nearNPC);
    }
    // escape attempt at maintenance stash
    if (interactPressed && this.nearInteractable?.id === 'stash_maint') this.tryEscape();

    // NPCs
    const ctx = this.npcCtx(dt, t);
    for (const n of this.npcs) n.update(ctx);
    if (this.alarmTimer > 0) this.alarmTimer -= dt;

    // schedule / time
    this.schedule.update(dt);
    this.events.tick(dt);
    if (this.schedule.needsSleep) {
      this.hud.setPrompt('🛏️ <b>Lights out.</b> Return to your bunk and sleep (interact on bed).');
    }

    // current room + heat
    const room = roomAt(this.player.x, this.player.z);
    this.state.currentRoom = room.id;
    const guardNear = this.npcs.some((n) => n.isGuard && !n.ko && n.distTo(this.player.x, this.player.z) < 9);
    this.heat.update(dt, room.id, guardNear);

    // needs decay
    this.decayNeeds(dt);

    // footstep audio
    if (Math.hypot(this.player.vx, this.player.vz) > 1.5) this.audio.play('footstep');

    // effects + world + camera + hud
    this.fx.update(dt);
    this.map.update(dt, t, this.state.lockdown);
    this.cam.update(this.player.x, this.player.z, dt);
    this.hud.update();
    this.updatePromptUI();
    this.updateRoomLabels();
  }

  private _lblV = new THREE.Vector3();
  private updateRoomLabels() {
    for (const l of this.map.labels) {
      const d = Math.hypot(l.x - this.player.x, l.z - this.player.z);
      const show = d < 16;
      l.el.classList.toggle('visible', show);
      if (!show) continue;
      this._lblV.set(l.x, 3.2, l.z).project(this.cam.camera);
      l.el.style.left = (this._lblV.x * 0.5 + 0.5) * window.innerWidth + 'px';
      l.el.style.top = (-this._lblV.y * 0.5 + 0.5) * window.innerHeight + 'px';
    }
  }

  private decayNeeds(dt: number) {
    const s = this.state.stats;
    s.hunger = clamp(s.hunger - dt * 0.35, 0, 100);
    // stamina regen depends on hunger & not sprinting
    const moving = Math.hypot(this.player.vx, this.player.vz) > 1.5;
    if (!moving && !this.player.blocking) {
      const regen = s.hunger > 30 ? 9 : 4;
      s.stamina = clamp(s.stamina + dt * regen, 0, s.maxStamina);
    }
    if (s.hunger < 10) s.health = clamp(s.health - dt * 0.5, 1, s.maxHealth);
    if (s.mood < 20) s.mood = clamp(s.mood + dt * 0.2, 0, 100); // slow self-recover
    s.injury = clamp(s.injury - dt * 0.2, 0, 100);
    this.state.clampStats();
  }

  private findNearby() {
    // nearest interactable
    let bestI: Interactable | null = null, bd = INTERACT_RANGE;
    for (const it of this.map.interactables) {
      const d = Math.hypot(it.x - this.player.x, it.z - this.player.z);
      if (d < bd) { bd = d; bestI = it; }
    }
    this.nearInteractable = bestI;
    // nearest NPC
    let bestN: NPC | null = null, bn = 2.8;
    for (const n of this.npcs) {
      if (n.ko || n.isStaff && false) {}
      const d = n.distTo(this.player.x, this.player.z);
      if (d < bn && !n.ko) { bn = d; bestN = n; }
    }
    this.nearNPC = bestN;
    // exclamation marks for hostile npcs / event givers
    for (const n of this.npcs) n.rig.showExclaim(this.scene, n.hostile && !n.ko);
  }

  private updatePromptUI() {
    if (this.schedule.needsSleep) return; // handled
    const parts: string[] = [];
    if (this.nearInteractable) parts.push(`<b>E</b> ${this.nearInteractable.label}`);
    if (this.nearNPC) parts.push(`<b>Talk</b> ${this.nearNPC.def.name} ${this.nearNPC.hostile ? '⚠' : ''}`);
    this.hud.setPrompt(parts.length ? parts.join(' &nbsp;·&nbsp; ') : null);
  }

  private openDialogue(npc: NPC) {
    if (npc.hostile) { this.hud.toast(`${npc.def.name} is too angry to talk!`, 'bad'); return; }
    this.mode = 'dialogue';
    this.dialogue.open(npc);
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cam.resize();
  }
}
