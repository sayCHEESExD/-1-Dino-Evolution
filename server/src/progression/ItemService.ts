import { randomInt } from 'node:crypto';
import {
  ITEM_BAG_MAX,
  ITEM_EQUIP_MAX,
  itemById,
  rollDrop,
  type EnemyDef,
  type ItemActionKind,
  type ItemDef,
} from '@dino/shared';
import { ItemStack, type PlayerState } from '../rooms/state/PlayerState.js';
import type { ProgressionService } from './ProgressionService.js';

export type ItemResult =
  | { readonly ok: true; readonly action: ItemActionKind; readonly item?: ItemDef }
  | { readonly ok: false; readonly reason: 'unknown' | 'slots-full' | 'none-left' | 'nothing' };

export interface DropResult {
  readonly item: ItemDef;
  /** False when the bag was full and the drop was lost. */
  readonly kept: boolean;
}

const random01 = (): number => randomInt(0, 1_000_000) / 1_000_000;

/**
 * Server authority over kill-drop items: the bag, the three worn slots, and
 * the drops themselves.
 *
 * A drop is ROLLED here, with the server's own randomness, only for a kill the
 * combat service validated. Wearing is by item id; a stack can fill as many
 * slots as it holds copies. Every change re-derives damage per attack.
 */
export class ItemService {
  /** Roll and bank a defeated dinosaur's drop. Null when it dropped nothing. */
  dropFor(player: PlayerState, def: EnemyDef): DropResult | null {
    const item = rollDrop(def.stage, def.boss, random01(), random01(), random01());
    if (!item) return null;
    if (this.total(player) >= ITEM_BAG_MAX) return { item, kept: false };
    const stack = this.stack(player, item.id);
    if (stack) stack.count += 1;
    else {
      const fresh = new ItemStack();
      fresh.itemId = item.id;
      fresh.count = 1;
      player.items.push(fresh);
    }
    return { item, kept: true };
  }

  act(player: PlayerState, actionRaw: unknown, itemRaw: unknown, slotRaw: unknown, progression: ProgressionService): ItemResult {
    const action = String(actionRaw) as ItemActionKind;
    let result: ItemResult;
    switch (action) {
      case 'equip': {
        const item = itemById(Number(itemRaw));
        if (!item) return { ok: false, reason: 'unknown' };
        const worn = this.wornCount(player, item.id);
        if (worn >= this.countOf(player, item.id)) return { ok: false, reason: 'none-left' };
        const free = this.freeSlot(player);
        if (free < 0) return { ok: false, reason: 'slots-full' };
        player.equippedItems[free] = item.id;
        result = { ok: true, action, item };
        break;
      }
      case 'unequip': {
        const slot = Math.floor(Number(slotRaw));
        if (slot >= 0 && slot < ITEM_EQUIP_MAX && (player.equippedItems[slot] ?? 0) !== 0) {
          const item = itemById(player.equippedItems[slot] ?? 0);
          player.equippedItems[slot] = 0;
          result = { ok: true, action, item };
          break;
        }
        // Or by item id: take off one worn copy of it.
        const id = Math.floor(Number(itemRaw));
        const at = [...player.equippedItems].findIndex((entry) => entry === id);
        if (at < 0) return { ok: false, reason: 'nothing' };
        player.equippedItems[at] = 0;
        result = { ok: true, action, item: itemById(id) };
        break;
      }
      case 'delete': {
        const item = itemById(Number(itemRaw));
        const stack = item ? this.stack(player, item.id) : undefined;
        if (!item || !stack) return { ok: false, reason: 'unknown' };
        stack.count -= 1;
        if (stack.count <= 0) player.items.splice(player.items.indexOf(stack), 1);
        // A worn copy that no longer exists comes off.
        this.trimWorn(player);
        result = { ok: true, action, item };
        break;
      }
      case 'equipBest': {
        if (player.items.length === 0) return { ok: false, reason: 'nothing' };
        const copies: number[] = [];
        for (const stack of player.items) for (let i = 0; i < stack.count && i < ITEM_EQUIP_MAX; i += 1) copies.push(stack.itemId);
        copies.sort((a, b) => (itemById(b)?.bonus ?? 0) - (itemById(a)?.bonus ?? 0) || a - b);
        for (let slot = 0; slot < ITEM_EQUIP_MAX; slot += 1) player.equippedItems[slot] = copies[slot] ?? 0;
        result = { ok: true, action };
        break;
      }
      case 'unequipAll': {
        for (let slot = 0; slot < ITEM_EQUIP_MAX; slot += 1) player.equippedItems[slot] = 0;
        result = { ok: true, action };
        break;
      }
      default:
        return { ok: false, reason: 'unknown' };
    }
    progression.syncDerived(player);
    return result;
  }

  /** A restored profile keeps only worn items it actually holds. */
  normalise(player: PlayerState): void {
    this.trimWorn(player);
  }

  total(player: PlayerState): number {
    let sum = 0;
    for (const stack of player.items) sum += stack.count;
    return sum;
  }

  private trimWorn(player: PlayerState): void {
    const left = new Map<number, number>();
    for (const stack of player.items) left.set(stack.itemId, stack.count);
    for (let slot = 0; slot < ITEM_EQUIP_MAX; slot += 1) {
      const id = player.equippedItems[slot] ?? 0;
      if (id === 0) continue;
      const remaining = left.get(id) ?? 0;
      if (remaining <= 0 || !itemById(id)) player.equippedItems[slot] = 0;
      else left.set(id, remaining - 1);
    }
  }

  private stack(player: PlayerState, itemId: number): ItemStack | undefined {
    return player.items.find((entry) => entry.itemId === itemId);
  }

  private countOf(player: PlayerState, itemId: number): number {
    return this.stack(player, itemId)?.count ?? 0;
  }

  private wornCount(player: PlayerState, itemId: number): number {
    let count = 0;
    for (const id of player.equippedItems) if (id === itemId) count += 1;
    return count;
  }

  private freeSlot(player: PlayerState): number {
    for (let slot = 0; slot < ITEM_EQUIP_MAX; slot += 1) if ((player.equippedItems[slot] ?? 0) === 0) return slot;
    return -1;
  }
}
