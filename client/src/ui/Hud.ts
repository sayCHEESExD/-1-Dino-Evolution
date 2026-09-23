import { formatAmount, formatWins, levelForXp, maxLevelFor } from '@dino/shared';
import { injectDinoStyles } from './dinoStyles.js';
import { ICON } from './icons.js';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, html = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (html) node.innerHTML = html;
  return node;
};

/** One tile of the left rail. */
export class Tile {
  readonly root: HTMLButtonElement;
  private readonly pct: HTMLSpanElement;

  constructor(parent: HTMLElement, variant: string, label: string, icon: string, hotkey: string | null, onClick: () => void) {
    this.root = el('button', `dn-tile dn-tile--${variant}`, icon);
    this.root.type = 'button';
    this.root.setAttribute('aria-label', hotkey ? `${label} (${hotkey})` : label);
    this.root.appendChild(el('span', 'dn-tile__label dn-font dn-outline', label));
    if (hotkey) this.root.appendChild(el('span', 'dn-tile__key dn-font', hotkey));
    this.root.appendChild(el('span', 'dn-tile__badge'));
    this.pct = el('span', 'dn-tile__pct dn-font dn-outline');
    this.root.appendChild(this.pct);
    this.root.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick();
    });
    parent.appendChild(this.root);
  }

  setReady(ready: boolean): void {
    this.root.classList.toggle('dn-tile--ready', ready);
  }

  setPercent(text: string): void {
    if (this.pct.textContent !== text) this.pct.textContent = text;
  }

  setOff(off: boolean): void {
    this.root.classList.toggle('dn-tile--off', off);
  }

  /** A toggle's state: lit and pulsing with a little ON tag when on, dimmed when off. */
  setOn(on: boolean): void {
    this.root.classList.toggle('dn-tile--on', on);
    this.root.setAttribute('aria-pressed', on ? 'true' : 'false');
    this.setOff(!on);
    this.setPercent(on ? 'ON' : '');
  }

  press(): void {
    this.root.click();
  }
}

export interface FocusView {
  readonly name: string;
  readonly value: number;
  readonly max: number;
  readonly boss: boolean;
  readonly lock: string;
  readonly dummy: boolean;
}

export interface HudStats {
  readonly strength: number;
  readonly xp: number;
  readonly rebirths: number;
  readonly multiplier: number;
  readonly speed: number;
  readonly wins: number;
  readonly damagePerAttack: number;
  readonly mount: string;
  readonly mountColor: string;
}

/**
 * THE HUD, laid out as the reference screenshots:
 *
 *   left-centre   Rebirth, Pets, Dinos, Items, Teleport (a grid of tiles)
 *   bottom-left   Wins and Rebirths
 *   bottom-centre the mount, Speed and Multiplier, DAMAGE, the level bar
 *                 (XP / XP to the next level), and health in a fight
 *   top-centre    the dinosaur (or dummy) being fought
 *
 * Presentation only: every figure is replicated server state.
 */
export class Hud {
  readonly rail: HTMLDivElement;
  private readonly root: HTMLElement;
  private readonly nodes: HTMLElement[] = [];
  private readonly wins: HTMLDivElement;
  private readonly rebirths: HTMLDivElement;
  private readonly mount: HTMLDivElement;
  private readonly speed: HTMLSpanElement;
  private readonly mult: HTMLSpanElement;
  private readonly damage: HTMLDivElement;
  private readonly damageValue: HTMLSpanElement;
  private readonly level: HTMLDivElement;
  private readonly levelFill: HTMLDivElement;
  private readonly levelName: HTMLDivElement;
  private readonly levelValue: HTMLDivElement;
  private readonly health: HTMLDivElement;
  private readonly healthFill: HTMLDivElement;
  private readonly healthText: HTMLDivElement;
  private readonly target: HTMLDivElement;
  private readonly targetInfo: HTMLDivElement;
  private readonly targetName: HTMLDivElement;
  private readonly targetBar: HTMLDivElement;
  private readonly targetFill: HTMLDivElement;
  private readonly targetText: HTMLDivElement;
  private readonly targetLock: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly toasts: HTMLDivElement;
  private readonly pops: HTMLDivElement;
  private readonly hurt: HTMLDivElement;
  private lastStrength = -1;
  private popTimer = 0;
  private hurtTimer = 0;
  private hintText = '';
  private lastToast = '';
  private lastToastAt = 0;

  constructor(parent: HTMLElement) {
    injectDinoStyles();
    this.root = parent;
    this.hurt = this.add(el('div', 'dn-hurt'));
    this.rail = this.add(el('div', 'dn-rail'));

    const counters = this.add(el('div', 'dn-counters dn-font'));
    const counter = (kind: string, icon: string): HTMLDivElement => {
      const row = el('div', `dn-counter dn-counter--${kind}`);
      row.append(el('div', 'dn-counter__icon', icon));
      const value = el('div', 'dn-counter__value dn-outline', '0');
      row.append(value);
      counters.append(row);
      return value;
    };
    this.wins = counter('wins', ICON.trophy);
    this.rebirths = counter('rebirth', ICON.rebirth);

    const status = this.add(el('div', 'dn-status dn-font'));
    this.mount = el('div', 'dn-mount dn-outline');
    const row1 = el('div', 'dn-row1');
    const speed = el('div', 'dn-speed dn-outline', ICON.speed);
    this.speed = el('span', '', 'Speed: 16');
    speed.append(this.speed);
    const mult = el('div', 'dn-mult dn-outline');
    this.mult = el('span', '', 'Multiplier: 1x');
    mult.append(this.mult);
    this.damage = el('div', 'dn-damage');
    this.damage.innerHTML = ICON.damage;
    this.damageValue = el('span', 'dn-damage__value dn-outline', '0');
    this.damage.append(this.damageValue, el('span', 'dn-damage__label dn-outline', 'DAMAGE'));
    row1.append(speed, this.damage, mult);
    this.health = el('div', 'dn-health');
    this.healthFill = el('div', 'dn-health__fill');
    this.healthText = el('div', 'dn-health__text dn-outline');
    this.health.append(this.healthFill, this.healthText);
    this.level = el('div', 'dn-level');
    this.levelFill = el('div', 'dn-level__fill');
    this.levelName = el('div', 'dn-level__name dn-outline', 'LEVEL 1');
    this.levelValue = el('div', 'dn-level__value dn-outline', '0/50');
    this.level.append(this.levelFill, this.levelName, this.levelValue);
    status.append(this.mount, row1, this.health, this.level);

    this.target = this.add(el('div', 'dn-target dn-font dn-hidden'));
    this.targetInfo = el('div', 'dn-stageinfo dn-outline');
    this.targetName = el('div', 'dn-target__name dn-outline');
    this.targetBar = el('div', 'dn-target__bar');
    this.targetFill = el('div', 'dn-target__fill');
    this.targetText = el('div', 'dn-target__text dn-outline');
    this.targetBar.append(this.targetFill, this.targetText);
    this.targetLock = el('div', 'dn-target__lock dn-outline');
    this.target.append(this.targetInfo, this.targetName, this.targetBar, this.targetLock);

    this.hint = this.add(el('div', 'dn-hint dn-font dn-outline dn-hidden'));
    this.toasts = this.add(el('div', 'dn-toasts dn-font'));
    this.pops = this.add(el('div', 'dn-pops dn-font'));
  }

  private add<T extends HTMLElement>(node: T): T {
    this.root.appendChild(node);
    this.nodes.push(node);
    return node;
  }

  setStats(s: HudStats): void {
    const progress = levelForXp(s.xp, s.rebirths);
    this.damageValue.textContent = formatAmount(s.strength);
    if (this.lastStrength >= 0 && s.strength > this.lastStrength) {
      this.damage.classList.remove('dn-damage--pop');
      void this.damage.offsetWidth;
      this.damage.classList.add('dn-damage--pop');
      window.clearTimeout(this.popTimer);
      this.popTimer = window.setTimeout(() => this.damage.classList.remove('dn-damage--pop'), 280);
    }
    this.lastStrength = s.strength;
    const mult = Math.round(s.multiplier * 100) / 100;
    this.mult.textContent = `Multiplier: ${mult < 1000 ? mult : formatAmount(mult)}x`;
    this.speed.textContent = `Speed: ${Math.round(s.speed)}`;
    this.mount.textContent = `${s.mount}  +${formatAmount(s.damagePerAttack)} per attack`;
    this.mount.style.color = s.mountColor;
    this.levelName.textContent = `LEVEL ${progress.level}`;
    this.level.classList.toggle('dn-level--max', progress.capped);
    this.levelValue.textContent = progress.capped ? `MAX ${maxLevelFor(s.rebirths)}` : `${formatAmount(progress.into)}/${formatAmount(progress.need)}`;
    this.levelFill.style.width = `${(progress.fraction * 100).toFixed(1)}%`;
    this.wins.textContent = formatWins(s.wins);
    this.rebirths.textContent = formatWins(s.rebirths);
  }

  setHealth(health: number, max: number, show: boolean): void {
    this.health.classList.toggle('dn-hidden', !show);
    if (!show) return;
    const fraction = max > 0 ? Math.min(1, Math.max(0, health / max)) : 1;
    this.healthFill.style.width = `${(fraction * 100).toFixed(1)}%`;
    this.health.classList.toggle('dn-health--low', fraction < 0.3);
    this.healthText.textContent = `${formatAmount(Math.ceil(health))} / ${formatAmount(max)}`;
  }

  /** The screen edges flush red as the mount takes a blow. */
  hurtFlash(strength = 1): void {
    this.hurt.style.opacity = String(Math.min(1, 0.45 + strength * 0.5));
    window.clearTimeout(this.hurtTimer);
    this.hurtTimer = window.setTimeout(() => {
      this.hurt.style.opacity = '0';
    }, 160);
  }

  setFocus(focus: FocusView | null, stageInfo: string): void {
    const show = focus !== null || stageInfo.length > 0;
    this.target.classList.toggle('dn-hidden', !show);
    if (!show) return;
    this.targetInfo.textContent = stageInfo;
    this.targetInfo.classList.toggle('dn-hidden', stageInfo.length === 0);
    const hasFocus = focus !== null;
    this.targetName.classList.toggle('dn-hidden', !hasFocus);
    this.targetBar.classList.toggle('dn-hidden', !hasFocus || focus.dummy);
    this.targetLock.classList.toggle('dn-hidden', !hasFocus || focus.lock.length === 0);
    if (!focus) return;
    this.target.classList.toggle('dn-target--boss', focus.boss);
    this.targetName.textContent = focus.boss ? `BOSS: ${focus.name}` : focus.name;
    this.targetLock.textContent = focus.lock;
    const fraction = focus.max > 0 ? Math.min(1, Math.max(0, focus.value / focus.max)) : 0;
    this.targetFill.style.width = `${(fraction * 100).toFixed(1)}%`;
    this.targetText.textContent = `${formatAmount(focus.value)} / ${formatAmount(focus.max)}`;
  }

  setHint(text: string): void {
    if (text === this.hintText) return;
    this.hintText = text;
    this.hint.textContent = text;
    this.hint.classList.toggle('dn-hidden', text.length === 0);
  }

  toast(text: string, tone: 'good' | 'bad' | 'gold' | 'pink' = 'good'): void {
    const now = performance.now();
    if (text === this.lastToast && now - this.lastToastAt < 1500) return;
    this.lastToast = text;
    this.lastToastAt = now;
    const toast = el('div', `dn-toast dn-toast--${tone} dn-outline`);
    toast.textContent = text;
    this.toasts.appendChild(toast);
    while (this.toasts.childElementCount > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => toast.remove(), 2450);
  }

  /** A floating "+N" with the damage arm, at a screen point (or scattered round the centre). */
  pop(text: string, kind: 'gain' | 'loot', x?: number, y?: number, icon: string = ICON.damage): void {
    if (this.pops.childElementCount > 14) this.pops.firstElementChild?.remove();
    const node = el('div', `dn-pop ${kind === 'loot' ? 'dn-pop--loot' : ''} dn-outline`);
    node.innerHTML = icon;
    node.append(text);
    const px = x ?? window.innerWidth * (0.5 + (Math.random() - 0.5) * 0.24);
    const py = y ?? window.innerHeight * (0.56 + (Math.random() - 0.5) * 0.12);
    node.style.left = `${px}px`;
    node.style.top = `${py}px`;
    this.pops.appendChild(node);
    window.setTimeout(() => node.remove(), 900);
  }

  levelUp(from: number, to: number, speed: number): void {
    const node = el('div', 'dn-levelup dn-font');
    node.innerHTML = '<div class="dn-levelup__title dn-outline">LEVEL UP!</div>';
    const line = el('div', 'dn-levelup__line dn-outline');
    line.textContent = `Level ${from} > Level ${to}   Speed ${Math.round(speed)}`;
    node.append(line);
    this.root.appendChild(node);
    window.setTimeout(() => node.remove(), 2700);
  }

  /** The mount went down: said once, big, in the middle. */
  defeated(by: string): void {
    const node = el('div', 'dn-dead dn-font');
    node.innerHTML = '<div class="dn-dead__title dn-outline">YOUR DINOSAUR FELL!</div>';
    const line = el('div', 'dn-dead__line dn-outline');
    line.textContent = by;
    node.append(line);
    this.root.appendChild(node);
    window.setTimeout(() => node.remove(), 3000);
  }

  dispose(): void {
    window.clearTimeout(this.popTimer);
    window.clearTimeout(this.hurtTimer);
    for (const node of this.nodes) node.remove();
  }
}
