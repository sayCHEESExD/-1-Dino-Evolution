import {
  DINOS,
  DINO_COUNT,
  HATCH_MULTI,
  ITEMS,
  ITEM_BAG_MAX,
  ITEM_EQUIP_MAX,
  ITEM_RARITY_COLORS,
  PET_EQUIP_MAX,
  PET_INVENTORY_MAX,
  PET_RARITY_COLORS,
  canRebirth,
  eggById,
  formatAmount,
  formatPercent,
  formatWins,
  itemById,
  levelForXp,
  maxLevelFor,
  ownsDino,
  petById,
  rebirthMultiplier,
  rebirthRequiredLevel,
  type ItemActionKind,
  type PetActionKind,
} from '@dino/shared';
import type { NetItemStack, NetPet } from '../net/netTypes.js';
import { injectDinoStyles } from './dinoStyles.js';
import { ICON, ITEM_ICON } from './icons.js';
import type { ModelPortraits } from './ModelPortraits.js';

/**
 * How many windows are open. The input layer polls this to suppress movement
 * while a window owns the screen. A COUNT, so two windows closing in the wrong
 * order can never leave the game stuck.
 */
let openCount = 0;
export const anyWindowOpen = (): boolean => openCount > 0;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, html = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (html) node.innerHTML = html;
  return node;
};

/** A modal window: a carved-wood header with its title, an optional search, a red close. */
class Window {
  protected readonly modal: HTMLDivElement;
  protected readonly window: HTMLDivElement;
  protected readonly main: HTMLDivElement;
  protected readonly body: HTMLDivElement;
  protected readonly title: HTMLSpanElement;
  protected readonly headIcon: HTMLDivElement;
  protected readonly search: HTMLInputElement | null;
  private open = false;
  onClose: (() => void) | null = null;

  constructor(parent: HTMLElement, icon: string, title: string, options: { small?: boolean; search?: boolean } = {}) {
    injectDinoStyles();
    this.modal = el('div', 'dn-modal dn-hidden');
    this.window = el('div', `dn-window${options.small ? ' dn-window--small' : ''}`);
    const head = el('div', 'dn-head');
    this.headIcon = el('div', 'dn-head__icon', icon);
    head.append(this.headIcon);
    this.title = el('span', 'dn-head__title dn-font dn-outline', title);
    head.append(this.title);
    if (options.search) {
      this.search = el('input', 'dn-head__search');
      this.search.type = 'text';
      this.search.placeholder = 'Search...';
      this.search.addEventListener('input', () => this.render());
      this.search.addEventListener('keydown', (event) => event.stopPropagation());
      head.append(this.search);
    } else {
      this.search = null;
      const spacer = el('div', '');
      spacer.style.flex = '1 1 auto';
      head.append(spacer);
    }
    const close = el('button', 'dn-close', '&#x2715;');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => this.setOpen(false));
    head.append(close);
    this.main = el('div', 'dn-main');
    this.body = el('div', 'dn-body dn-font');
    this.main.append(this.body);
    this.window.append(head, this.main);
    this.modal.append(this.window);
    this.modal.addEventListener('pointerdown', (event) => {
      if (event.target === this.modal) this.setOpen(false);
    });
    parent.appendChild(this.modal);
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    this.modal.classList.toggle('dn-hidden', !open);
    openCount = Math.max(0, openCount + (open ? 1 : -1));
    if (open) this.render();
    else this.onClose?.();
  }

  protected render(): void {
    /* subclasses */
  }

  protected query(): string {
    return (this.search?.value ?? '').trim().toLowerCase();
  }

  dispose(): void {
    this.setOpen(false);
    this.modal.remove();
  }
}

const button = (className: string, html: string, onClick: () => void, disabled = false): HTMLButtonElement => {
  const b = el('button', `dn-btn ${className}`, html);
  b.type = 'button';
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
};

// ------------------------------------------------------------ inventory

export type InventoryTab = 'dinos' | 'pets' | 'items';

export interface InventoryState {
  wins: number;
  rebirths: number;
  dinoSlot: number;
  ownedDinos: number;
  pets: readonly NetPet[];
  items: readonly NetItemStack[];
  equippedItems: readonly number[];
}

export interface InventoryActions {
  selectDino(slot: number): void;
  petAction(action: PetActionKind, uid?: number): void;
  itemAction(action: ItemActionKind, item?: number, slot?: number): void;
}

/**
 * THE INVENTORY WINDOW, its tabs down the left: Dinos (every dinosaur, owned
 * in colour with the ridden one ticked, the locked ones shown too with their price),
 * Pets (equipped 4 max, Equip Best, Unequip All, Delete) and Items (three worn
 * slots in a triangle beside the bag, Equip Best, Unequip All, Delete). Every
 * button is a REQUEST the server checks.
 */
export class InventoryWindow extends Window {
  private tab: InventoryTab = 'dinos';
  private readonly tabs = new Map<InventoryTab, HTMLButtonElement>();
  private state: InventoryState = { wins: 0, rebirths: 0, dinoSlot: 1, ownedDinos: 1, pets: [], items: [], equippedItems: [0, 0, 0] };
  private selectedPet = -1;
  private selectedItem = -1;
  private signature = '';

  constructor(parent: HTMLElement, private readonly portraits: ModelPortraits, private readonly actions: InventoryActions) {
    super(parent, ICON.dinos, 'Dinos', { search: true });
    this.window.style.marginLeft = 'max(70px, calc(176 * var(--u)))';
    this.window.style.width = 'min(calc(96vw - max(70px, calc(176 * var(--u)))), calc(1060 * var(--u)))';
    const tabs = el('div', 'dn-tabs');
    const tab = (id: InventoryTab, label: string, icon: string): void => {
      const b = el('button', 'dn-tab dn-font', icon);
      b.type = 'button';
      b.append(el('span', 'dn-tab__label dn-outline', label));
      b.addEventListener('click', () => this.show(id));
      tabs.append(b);
      this.tabs.set(id, b);
    };
    tab('dinos', 'Dinos', ICON.dinos);
    tab('pets', 'Pets', ICON.pets);
    tab('items', 'Items', ICON.backpack);
    this.main.prepend(tabs);
  }

  show(tab: InventoryTab): void {
    this.tab = tab;
    this.title.textContent = tab === 'dinos' ? 'Dinos' : tab === 'pets' ? 'Pets' : 'Items';
    this.headIcon.innerHTML = tab === 'dinos' ? ICON.dinos : tab === 'pets' ? ICON.pets : ICON.backpack;
    if (this.search) this.search.value = '';
    this.signature = '';
    if (!this.isOpen) this.setOpen(true);
    else this.render();
  }

  get currentTab(): InventoryTab {
    return this.tab;
  }

  private signatureOf(s: InventoryState): string {
    const pets = s.pets.map((pet) => `${pet.uid}:${pet.petId}:${pet.equipped ? 1 : 0}`).join(',');
    const items = s.items.map((item) => `${item.itemId}:${item.count}`).join(',');
    return `${this.tab}|${Math.floor(s.wins)}|${s.rebirths}|${s.dinoSlot}|${s.ownedDinos}|${pets}|${items}|${s.equippedItems.join(',')}|${this.selectedPet}|${this.selectedItem}`;
  }

  setState(state: InventoryState): void {
    this.state = state;
    if (!this.isOpen) return;
    if (this.signatureOf(state) === this.signature) return;
    this.render();
  }

  protected override render(): void {
    this.signature = this.signatureOf(this.state);
    for (const [id, b] of this.tabs) b.classList.toggle('dn-tab--on', id === this.tab);
    this.body.replaceChildren();
    if (this.tab === 'dinos') this.renderDinos();
    else if (this.tab === 'pets') this.renderPets();
    else this.renderItems();
  }

  private card(image: string, name: string, meta: string, options: { locked?: boolean; check?: boolean; selected?: boolean; lockText?: string; icon?: string; count?: number; blob?: string } = {}): HTMLButtonElement {
    const card = el('button', `dn-card${options.locked ? ' dn-card--locked' : ''}${options.selected ? ' dn-card--selected' : ''}`);
    card.type = 'button';
    const blob = el('div', 'dn-card__blob');
    if (options.blob) blob.style.setProperty('--blob2', options.blob);
    card.append(blob);
    if (options.icon) card.append(el('div', 'dn-card__icon', options.icon));
    else if (image) {
      const img = el('img', 'dn-card__img');
      img.src = image;
      img.alt = name;
      img.draggable = false;
      card.append(img);
    }
    if (options.check) card.append(el('div', 'dn-card__check', ICON.check));
    if (options.count !== undefined && options.count > 1) card.append(el('div', 'dn-card__count dn-outline', `x${options.count}`));
    if (options.locked && options.lockText) card.append(el('div', 'dn-card__lock dn-outline', options.lockText));
    card.append(el('div', 'dn-card__name dn-outline', name));
    card.append(el('div', 'dn-card__meta dn-outline', meta));
    return card;
  }

  private renderDinos(): void {
    const s = this.state;
    const q = this.query();
    const owned = DINOS.filter((dino) => ownsDino(s.ownedDinos, dino.slot));
    this.body.append(el('div', 'dn-section dn-outline', `Owned ${owned.length}/${DINO_COUNT}`));
    const grid = el('div', 'dn-grid');
    for (const dino of DINOS) {
      if (q && !dino.name.toLowerCase().includes(q)) continue;
      const has = ownsDino(s.ownedDinos, dino.slot);
      const affordable = s.wins >= dino.cost;
      const meta = `<span style="color:#ffc23a">+${formatAmount(dino.damage)} Damage</span>`;
      const price = dino.cost === 0 ? 'FREE' : `${formatWins(dino.cost)} Wins`;
      const card = this.card(this.portraits.dino(dino.slot), dino.name, has ? meta : `${meta}<br><span style="color:${affordable ? '#8aff6a' : '#ff9a8a'}">${price}</span>`, {
        locked: !has,
        check: s.dinoSlot === dino.slot,
        lockText: affordable ? 'EVOLVE' : '',
      });
      card.addEventListener('click', () => this.actions.selectDino(dino.slot));
      card.title = has ? `Ride ${dino.name}` : `Evolve into ${dino.name} for ${formatWins(dino.cost)} Wins`;
      grid.append(card);
    }
    this.body.append(grid);
    const ridden = DINOS[s.dinoSlot - 1];
    if (ridden) {
      this.body.append(
        el('div', 'dn-detail dn-outline', `Riding <span style="color:${ridden.color}">${ridden.name}</span> - +${formatAmount(ridden.damage)} Damage per attack<small>Evolve here or on the paddock pads to the left of the spawn.</small>`),
      );
    }
  }

  private renderPets(): void {
    const s = this.state;
    const q = this.query();
    const equipped = s.pets.filter((pet) => pet.equipped).length;
    this.body.append(el('div', 'dn-section dn-outline', `Equipped ${equipped}/${PET_EQUIP_MAX}`));
    const row = el('div', 'dn-row');
    row.append(
      button('dn-btn--green', 'Equip Best', () => this.actions.petAction('equipBest'), s.pets.length === 0),
      button('dn-btn--red', 'Unequip All', () => this.actions.petAction('unequipAll'), equipped === 0),
      button('dn-btn--red', 'Delete', () => {
        const pet = s.pets.find((entry) => entry.uid === this.selectedPet);
        if (!pet) return;
        this.actions.petAction('delete', pet.uid);
        this.selectedPet = -1;
      }, !s.pets.some((pet) => pet.uid === this.selectedPet)),
    );
    this.body.append(row);
    if (s.pets.length === 0) {
      this.body.append(el('div', 'dn-empty dn-outline', 'No pets yet! Hatch an egg at the Hatchery, behind the Training Grounds.'));
      return;
    }
    const ranked = [...s.pets].sort(
      (a, b) => Number(b.equipped) - Number(a.equipped) || (petById(b.petId)?.bonus ?? 0) - (petById(a.petId)?.bonus ?? 0) || a.uid - b.uid,
    );
    const grid = el('div', 'dn-grid');
    grid.style.marginTop = 'calc(14 * var(--u))';
    for (const pet of ranked) {
      const kind = petById(pet.petId);
      if (!kind || (q && !kind.name.toLowerCase().includes(q))) continue;
      const color = PET_RARITY_COLORS[kind.rarity];
      const card = this.card(this.portraits.pet(pet.petId), kind.name, `<span style="color:${color}">${kind.rarity.toUpperCase()}</span><br><span style="color:#ffc23a">${formatPercent(kind.bonus)} Damage</span>`, {
        check: pet.equipped,
        selected: pet.uid === this.selectedPet,
        blob: color,
      });
      card.addEventListener('click', () => {
        this.selectedPet = pet.uid;
        this.actions.petAction(pet.equipped ? 'unequip' : 'equip', pet.uid);
      });
      grid.append(card);
    }
    this.body.append(grid);
    this.body.append(el('div', 'dn-detail dn-outline', `<small>${s.pets.length}/${PET_INVENTORY_MAX} pets. Click a pet to equip or unequip it (and select it for Delete).</small>`));
  }

  private renderItems(): void {
    const s = this.state;
    const worn = s.equippedItems.filter((id) => id > 0).length;
    this.body.append(el('div', 'dn-section dn-outline', `Equipped ${worn}/${ITEM_EQUIP_MAX}`));
    const layout = el('div', 'dn-items');
    // The three worn slots, in a triangle.
    const left = el('div', '');
    const slots = el('div', 'dn-slots');
    for (let i = 0; i < ITEM_EQUIP_MAX; i += 1) {
      const id = s.equippedItems[i] ?? 0;
      const item = itemById(id);
      const slot = el('button', `dn-slot${item ? ' dn-slot--filled' : ''}`, item ? ITEM_ICON[item.icon] : '');
      slot.type = 'button';
      slot.append(item ? item.name : 'Empty');
      slot.title = item ? `Unequip ${item.name}` : 'Empty slot';
      slot.addEventListener('click', () => {
        if (item) this.actions.itemAction('unequip', undefined, i);
      });
      slots.append(slot);
    }
    left.append(slots);
    const buttons = el('div', 'dn-row');
    buttons.append(
      button('dn-btn--green', 'Equip Best', () => this.actions.itemAction('equipBest'), s.items.length === 0),
      button('dn-btn--red', 'Unequip All', () => this.actions.itemAction('unequipAll'), worn === 0),
      button('dn-btn--red', 'Delete', () => {
        if (this.selectedItem > 0) this.actions.itemAction('delete', this.selectedItem);
      }, !s.items.some((stack) => stack.itemId === this.selectedItem)),
    );
    left.append(buttons);
    layout.append(left);

    const right = el('div', '');
    if (s.items.length === 0) {
      right.append(el('div', 'dn-empty dn-outline', 'No items yet! Defeated stage dinosaurs drop Rocks, Coconuts, Bones, Fossils and rarer finds.'));
    } else {
      const grid = el('div', 'dn-grid');
      const sorted = [...s.items].sort((a, b) => (itemById(b.itemId)?.bonus ?? 0) - (itemById(a.itemId)?.bonus ?? 0));
      for (const stack of sorted) {
        const item = itemById(stack.itemId);
        if (!item) continue;
        const wearing = s.equippedItems.filter((id) => id === item.id).length;
        const color = ITEM_RARITY_COLORS[item.rarity];
        const card = this.card('', item.name, `<span style="color:${color}">${item.rarity.toUpperCase()}</span><br><span style="color:#ffc23a">${formatPercent(item.bonus)} Damage</span>`, {
          icon: ITEM_ICON[item.icon],
          count: stack.count,
          check: wearing > 0,
          selected: this.selectedItem === item.id,
          blob: color,
        });
        card.addEventListener('click', () => {
          this.selectedItem = item.id;
          if (wearing < stack.count) this.actions.itemAction('equip', item.id);
          else this.render();
        });
        grid.append(card);
      }
      right.append(grid);
    }
    const total = s.items.reduce((sum, stack) => sum + stack.count, 0);
    right.append(el('div', 'dn-detail dn-outline', `<small>${total}/${ITEM_BAG_MAX} items. Click an item to wear a copy; click a worn slot to take it off. Each worn item adds its % to every attack.</small>`));
    layout.append(right);
    this.body.append(layout);
    void ITEMS;
  }
}

// -------------------------------------------------------------- rebirth

/**
 * THE REBIRTH WINDOW, as the reference: Rebirth N (xN Damage, MAX Level) ->
 * Rebirth N+1, the level bar toward the max level, and the button. The warning
 * says exactly what a rebirth takes: Damage, Level and Wins - only those.
 */
export class RebirthWindow extends Window {
  private readonly beforeTitle: HTMLDivElement;
  private readonly afterTitle: HTMLDivElement;
  private readonly beforeDamage: HTMLSpanElement;
  private readonly afterDamage: HTMLSpanElement;
  private readonly beforeLevel: HTMLSpanElement;
  private readonly afterLevel: HTMLSpanElement;
  private readonly fill: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private eligible = false;
  private level = 1;
  private rebirths = 0;

  constructor(parent: HTMLElement, onRebirth: () => void) {
    super(parent, ICON.rebirth, 'Rebirth', { small: true });
    const grid = el('div', 'dn-rb');
    const column = (): [HTMLDivElement, HTMLDivElement, HTMLSpanElement, HTMLSpanElement] => {
      const col = el('div', 'dn-rb__col');
      const title = el('div', 'dn-rb__title dn-outline');
      const damage = el('div', 'dn-rb__card dn-outline', ICON.damage);
      const damageValue = el('span', '', 'X1 Damage');
      damage.append(damageValue);
      const level = el('div', 'dn-rb__card dn-outline', '&#11088;');
      const levelValue = el('span', '', 'MAX Level 10');
      level.append(levelValue);
      col.append(title, damage, level);
      return [col, title, damageValue, levelValue];
    };
    const [before, beforeTitle, beforeDamage, beforeLevel] = column();
    const [after, afterTitle, afterDamage, afterLevel] = column();
    this.beforeTitle = beforeTitle;
    this.afterTitle = afterTitle;
    this.beforeDamage = beforeDamage;
    this.afterDamage = afterDamage;
    this.beforeLevel = beforeLevel;
    this.afterLevel = afterLevel;
    grid.append(before, el('div', 'dn-rb__arrow', ICON.arrow), after);

    const bar = el('div', 'dn-rb__bar');
    this.fill = el('div', 'dn-rb__fill');
    this.label = el('div', 'dn-rb__label dn-outline');
    bar.append(this.fill, this.label);
    const warn = el('div', 'dn-rb__warn dn-outline', 'Rebirth resets your Damage, Level, Wins ONLY!');
    const keep = el('div', 'dn-rb__keep dn-outline', 'You keep every dinosaur, pet and item.');
    const row = el('div', 'dn-row');
    this.button = button('dn-btn--green', `${ICON.rebirth}<span>REBIRTH</span>`, () => {
      if (!this.eligible) return;
      onRebirth();
      this.setOpen(false);
    });
    row.append(this.button);
    this.body.append(grid, el('div', '', '<br>'), bar, warn, keep, row);
    this.setProgress(0, 0);
  }

  get isEligible(): boolean {
    return this.eligible;
  }

  /** 0..1 progress toward the next rebirth, for the rail tile. */
  get progress(): number {
    return Math.min(1, this.level / rebirthRequiredLevel(this.rebirths));
  }

  setProgress(xp: number, rebirths: number): void {
    const level = levelForXp(xp, rebirths).level;
    this.level = level;
    this.rebirths = rebirths;
    const required = rebirthRequiredLevel(rebirths);
    this.eligible = canRebirth(level, rebirths);
    this.beforeTitle.textContent = `Rebirth ${rebirths}:`;
    this.afterTitle.textContent = `Rebirth ${rebirths + 1}:`;
    this.beforeDamage.textContent = `X${rebirthMultiplier(rebirths)} Damage`;
    this.afterDamage.textContent = `X${rebirthMultiplier(rebirths + 1)} Damage`;
    this.beforeLevel.textContent = `MAX Level ${maxLevelFor(rebirths)}`;
    this.afterLevel.textContent = `MAX Level ${maxLevelFor(rebirths + 1)}`;
    const shown = Math.min(level, required);
    this.fill.style.width = `${Math.min(100, (shown / required) * 100).toFixed(1)}%`;
    this.label.textContent = `Level ${shown} / Level ${required}`;
    this.button.disabled = !this.eligible;
    this.button.lastElementChild!.textContent = this.eligible ? 'REBIRTH' : `Reach Level ${required}`;
  }
}

// ------------------------------------------------------------------ eggs

/**
 * THE EGG WINDOW: opens on an egg's pad. What the egg holds and the exact odds,
 * and Hatch (E) / Hatch x3 (R) - requests the server rolls.
 */
export class EggWindow extends Window {
  private egg = 0;
  private wins = 0;
  private inventory = 0;

  constructor(parent: HTMLElement, private readonly portraits: ModelPortraits, private readonly onHatch: (egg: number, count: number) => void) {
    super(parent, ICON.egg, 'Egg', { small: true });
    window.addEventListener('keydown', this.onKey);
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.isOpen || event.repeat) return;
    const egg = eggById(this.egg);
    if (!egg) return;
    if (event.code === 'KeyE' && this.wins >= egg.cost) this.onHatch(egg.id, 1);
    if (event.code === 'KeyR' && this.wins >= egg.cost * HATCH_MULTI) this.onHatch(egg.id, HATCH_MULTI);
  };

  openEgg(egg: number): void {
    this.egg = egg;
    if (!this.isOpen) this.setOpen(true);
    else this.render();
  }

  setState(wins: number, inventory: number): void {
    const changed = Math.floor(wins) !== Math.floor(this.wins) || inventory !== this.inventory;
    this.wins = wins;
    this.inventory = inventory;
    if (changed && this.isOpen) this.render();
  }

  protected override render(): void {
    const egg = eggById(this.egg);
    this.body.replaceChildren();
    if (!egg) return;
    this.title.textContent = egg.name;
    this.body.append(el('div', 'dn-section dn-outline', `${formatWins(egg.cost)} Wins each`));
    const grid = el('div', 'dn-egg__odds');
    for (const [petId, chance] of egg.pool) {
      const pet = petById(petId);
      if (!pet) continue;
      const card = el('div', 'dn-card');
      const blob = el('div', 'dn-card__blob');
      blob.style.setProperty('--blob2', PET_RARITY_COLORS[pet.rarity]);
      card.append(blob);
      const img = el('img', 'dn-card__img');
      img.src = this.portraits.pet(petId);
      img.alt = pet.name;
      card.append(img);
      card.append(el('div', 'dn-card__name dn-outline', pet.name));
      card.append(el('div', 'dn-card__meta dn-outline', `<span style="color:${PET_RARITY_COLORS[pet.rarity]}">${chance}%</span> <span style="color:#ffc23a">${formatPercent(pet.bonus)}</span>`));
      grid.append(card);
    }
    this.body.append(grid);
    const row = el('div', 'dn-row');
    row.append(
      button('dn-btn--green', `<span>E  Hatch</span>${ICON.trophy}<span>${formatWins(egg.cost)}</span>`, () => this.onHatch(egg.id, 1), this.wins < egg.cost),
      button('', `<span>R  Hatch x${HATCH_MULTI}</span>${ICON.trophy}<span>${formatWins(egg.cost * HATCH_MULTI)}</span>`, () => this.onHatch(egg.id, HATCH_MULTI), this.wins < egg.cost * HATCH_MULTI),
    );
    this.body.append(row);
    this.body.append(el('div', 'dn-detail dn-outline', `<small>${this.inventory}/${PET_INVENTORY_MAX} pets. Every equipped pet adds its % to every attack (up to ${PET_EQUIP_MAX}).</small>`));
  }

  override dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    super.dispose();
  }
}

// -------------------------------------------------------------- teleport

export interface Place {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
}

/** THE TELEPORT WINDOW: straight to a part of the park. */
export class TeleportWindow extends Window {
  constructor(parent: HTMLElement, private readonly places: readonly Place[], private readonly onGo: (id: string) => void) {
    super(parent, ICON.teleport, 'Teleport', { small: true });
  }

  protected override render(): void {
    this.body.replaceChildren();
    const grid = el('div', 'dn-places');
    for (const place of this.places) {
      const b = button('dn-btn--green', `<span>${place.name}<br><small style="font-size:0.6em;opacity:0.85">${place.detail}</small></span>`, () => {
        this.onGo(place.id);
        this.setOpen(false);
      });
      grid.append(b);
    }
    this.body.append(grid);
  }
}

/** The hatch reveal: the new pets, big, for a moment. */
export const showHatch = (parent: HTMLElement, portraits: ModelPortraits, petIds: readonly number[]): void => {
  const overlay = el('div', 'dn-hatch dn-font');
  const box = el('div', 'dn-hatch__box');
  for (const id of petIds) {
    const pet = petById(id);
    if (!pet) continue;
    const item = el('div', 'dn-hatch__pet');
    const img = el('img', '');
    img.src = portraits.pet(id);
    img.alt = pet.name;
    item.append(img, el('div', 'dn-hatch__name dn-outline', pet.name));
    const rarity = el('div', 'dn-hatch__rarity dn-outline', pet.rarity.toUpperCase());
    rarity.style.color = PET_RARITY_COLORS[pet.rarity];
    item.append(rarity);
    box.append(item);
  }
  overlay.append(box);
  const close = (): void => overlay.remove();
  overlay.addEventListener('pointerdown', close);
  parent.appendChild(overlay);
  window.setTimeout(close, 2800);
};
