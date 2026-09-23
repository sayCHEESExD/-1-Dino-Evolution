import type { ItemIcon } from '@dino/shared';

/**
 * THE HUD'S ICONS: the supplied images where there is one (rebirth, pets,
 * backpack, trophy, the speed shoe, the damage arm), and small inline SVGs for
 * the rest - a raptor's head for the Dinos menu, a compass, a speaker, an egg,
 * and one for every kill-drop item.
 */
const img = (src: string, alt: string): string => `<img class="dn-icon" src="${src}" alt="${alt}" draggable="false" />`;

const INK = '#1a1208';

export const ICON = {
  rebirth: img('/ui/rebirth.png', 'Rebirth'),
  pets: img('/ui/Pets.png', 'Pets'),
  backpack: img('/ui/inventory.png', 'Items'),
  trophy: img('/ui/trophy.png', 'Wins'),
  speed: img('/ui/shoe.png', 'Speed'),
  damage: img('/ui/energy.png', 'Damage'),
  dinos:
    `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#6ac83a" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M6 40c4-14 16-24 30-26 8-1 14 1 20 6l2 6-10 1-4 4 10 2-2 5c-6 2-14 2-20 0l-8 10H10l6-8c-5-1-8-2-10 0z"/>` +
    `<path fill="#ffffff" stroke="${INK}" stroke-width="2" d="M40 33l3 5 3-5zM34 34l3 5 2-5z"/><circle cx="44" cy="22" r="3.2" fill="#ffd23a" stroke="${INK}" stroke-width="1.6"/><path d="M43.5 19.5v5" stroke="${INK}" stroke-width="1.4"/>` +
    `<path fill="none" stroke="#3a7a24" stroke-width="2" d="M18 30c4-4 10-6 16-6"/></svg>`,
  teleport:
    `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="#e8dcc0" stroke="${INK}" stroke-width="3.5"/><circle cx="32" cy="32" r="20" fill="none" stroke="#a8905e" stroke-width="2"/>` +
    `<path fill="#e03a2a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" d="M32 8l7 24H25z"/><path fill="#ffffff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" d="M32 56l-7-24h14z"/><circle cx="32" cy="32" r="3.5" fill="${INK}"/></svg>`,
  sound:
    `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#fff4dc" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" d="M8 24h12l14-12v40L20 40H8z"/>` +
    `<path fill="none" stroke="#fff4dc" stroke-width="4.5" stroke-linecap="round" d="M42 22c5 6 5 14 0 20M49 15c9 10 9 24 0 34"/><path fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" d="M42 22c5 6 5 14 0 20M49 15c9 10 9 24 0 34"/></svg>`,
  egg:
    `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#f3ecd8" stroke="${INK}" stroke-width="3.5" d="M32 5c11 0 20 18 20 32 0 12-9 22-20 22S12 49 12 37C12 23 21 5 32 5z"/>` +
    `<circle cx="25" cy="26" r="3" fill="#8fa86a"/><circle cx="38" cy="36" r="4" fill="#8fa86a"/><circle cx="29" cy="46" r="2.5" fill="#8fa86a"/><circle cx="40" cy="20" r="2" fill="#8fa86a"/></svg>`,
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7"/></svg>',
  arrow:
    `<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#8ae05a" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M32 6 58 30H44v24H20V30H6z" transform="rotate(90 32 32)"/></svg>`,
  lock:
    `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="28" width="40" height="30" rx="5" fill="#c8a040" stroke="${INK}" stroke-width="3.5"/><path fill="none" stroke="${INK}" stroke-width="6" d="M20 28v-8a12 12 0 0 1 24 0v8"/><circle cx="32" cy="42" r="4" fill="${INK}"/></svg>`,
} as const;

/** An SVG badge for each kill-drop item. */
export const ITEM_ICON: Readonly<Record<ItemIcon, string>> = {
  rock:
    `<svg viewBox="0 0 64 64"><path fill="#8a8478" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M8 44l6-18 14-10 18 4 10 16-4 12-20 4z"/><path fill="#aaa498" d="M16 28l12-8 6 2-10 10z"/></svg>`,
  coconut:
    `<svg viewBox="0 0 64 64"><circle cx="32" cy="34" r="22" fill="#6a4020" stroke="${INK}" stroke-width="3"/><path d="M18 22c6-6 22-6 28 0" fill="none" stroke="#8a5a30" stroke-width="3"/><circle cx="26" cy="22" r="2.5" fill="${INK}"/><circle cx="32" cy="19" r="2.5" fill="${INK}"/><circle cx="38" cy="22" r="2.5" fill="${INK}"/></svg>`,
  fishbone:
    `<svg viewBox="0 0 64 64"><path fill="none" stroke="#efe6cf" stroke-width="5" stroke-linecap="round" d="M10 32h40M18 22l6 10-6 10M28 20l6 12-6 12M38 22l6 10-6 10"/><path fill="#efe6cf" stroke="${INK}" stroke-width="2.5" d="M48 24l10 8-10 8z"/><circle cx="9" cy="32" r="5" fill="#efe6cf" stroke="${INK}" stroke-width="2.5"/></svg>`,
  bone:
    `<svg viewBox="0 0 64 64"><path fill="#f0e8d4" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M18 14a6 6 0 0 0-8 8 6 6 0 0 0 4 10l22 22a6 6 0 0 0 10 4 6 6 0 0 0 8-8 6 6 0 0 0-4-10L28 18a6 6 0 0 0-10-4z"/></svg>`,
  fossil:
    `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#b8a888" stroke="${INK}" stroke-width="3"/><path fill="none" stroke="#6a5a3a" stroke-width="3.5" d="M32 32m-3 0a3 3 0 1 1 6 0 7 7 0 1 1-14 0 11 11 0 1 1 22 0 15 15 0 1 1-30 0"/></svg>`,
  claw:
    `<svg viewBox="0 0 64 64"><path fill="#3a2e28" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" d="M14 54C18 30 34 12 54 8c-12 10-20 24-22 40z"/><path fill="#6a5a4a" d="M22 46c4-14 14-26 26-32-8 8-14 18-18 30z"/></svg>`,
  amber:
    `<svg viewBox="0 0 64 64"><path fill="#ffae2a" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M32 6l20 14v24L32 58 12 44V20z"/><path fill="#ffd87a" d="M32 12l14 10-14 6-14-6z" opacity=".8"/><path fill="#5a3a10" d="M29 34c2-3 6-3 7 0-1 4-6 4-7 0z"/><path stroke="#5a3a10" stroke-width="1.5" d="M26 32l4 2M40 32l-4 2M27 38l3-2M39 38l-3-2"/></svg>`,
  tooth:
    `<svg viewBox="0 0 64 64"><path fill="#f4ecd8" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M18 10h28c0 16-4 30-14 46C22 40 18 26 18 10z"/><path stroke="#c8b898" stroke-width="2" d="M24 14c0 12 3 24 8 34"/></svg>`,
  eggfossil:
    `<svg viewBox="0 0 64 64"><path fill="#9a8e7a" stroke="${INK}" stroke-width="3" d="M32 6c11 0 19 17 19 30 0 12-8 22-19 22S13 48 13 36C13 23 21 6 32 6z"/><path fill="none" stroke="#5a4e3a" stroke-width="2.5" d="M20 30l8 4 6-6 8 6M18 42l10-2 6 6 10-4"/></svg>`,
  meteorite:
    `<svg viewBox="0 0 64 64"><path fill="#3a3a3a" stroke="${INK}" stroke-width="3" stroke-linejoin="round" d="M14 40l6-18 16-8 16 8 4 16-10 14-22 2z"/><path fill="#4aff7a" d="M26 30l6-4 4 6-6 4zM36 40l6-2 2 5-5 2z"/></svg>`,
};
