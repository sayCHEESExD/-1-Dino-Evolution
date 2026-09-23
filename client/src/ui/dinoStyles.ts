import { injectHudStyles } from './hudStyles.js';

/**
 * THE DINO EVOLUTION HUD'S STYLESHEET, injected once.
 *
 * An expedition's kit rather than a toy box: carved amber-wood headers, dark
 * jungle-green glass for window bodies, fern and resin buttons, bone-white type
 * with a heavy dark rim so it reads over a bright sky and a dark swamp alike.
 *
 * RESPONSIVE BY ONE UNIT. Every size is a multiple of `--u` (from `hudStyles`):
 * one pixel of a 1920x1080 design, fitted to the viewport and clamped. Text
 * keeps a small px floor via max() so it stays readable, and the rail tiles are
 * also CAPPED in px, so on a narrow phone the left buttons stay thumb-sized and
 * never balloon over the view.
 *
 * NO BACKTICKS IN THE CSS: it is a template literal.
 */
let injected = false;

export const injectDinoStyles = (): void => {
  if (injected) return;
  injected = true;
  injectHudStyles();
  const style = document.createElement('style');
  style.textContent = `
:root {
  --dn-ink: #1a1208;
  --dn-font: "Fredoka", "Baloo 2", "Nunito", "Segoe UI", system-ui, sans-serif;
  --dn-tile: clamp(46px, calc(94 * var(--u)), 118px);
  --dn-amber: #f0a83a;
  --dn-amber-dark: #b8641a;
  --dn-fern: #6ac83a;
  --dn-fern-dark: #2f8a24;
  --dn-panel: rgba(18, 34, 22, 0.78);
}
.dn-font { font-family: var(--dn-font); font-weight: 700; letter-spacing: 0.01em; }
.dn-outline {
  color: #fff8e8;
  text-shadow:
    2px 0 0 var(--dn-ink), -2px 0 0 var(--dn-ink), 0 2px 0 var(--dn-ink), 0 -2px 0 var(--dn-ink),
    2px 2px 0 var(--dn-ink), -2px 2px 0 var(--dn-ink), 2px -2px 0 var(--dn-ink), -2px -2px 0 var(--dn-ink),
    0 3px 6px rgba(0, 0, 0, 0.4);
}
.dn-hidden { display: none !important; }

/* ---- Left rail: tiles in two columns, anchored left + vertical centre ---- */
.dn-rail {
  position: fixed;
  left: max(8px, calc(22 * var(--u)), env(safe-area-inset-left, 0px));
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  grid-template-columns: repeat(2, var(--dn-tile));
  gap: calc(24 * var(--u)) calc(12 * var(--u));
  z-index: 21;
  user-select: none;
}
.dn-tile {
  position: relative;
  width: var(--dn-tile);
  height: var(--dn-tile);
  padding: 0;
  border: max(2px, calc(4 * var(--u))) solid var(--dn-ink);
  border-radius: calc(16 * var(--u));
  background:
    repeating-linear-gradient(100deg, rgba(255,255,255,0.05) 0 3px, transparent 3px 9px),
    linear-gradient(180deg, var(--a, #6ac83a), var(--b, #2f8a24));
  box-shadow: 0 calc(6 * var(--u)) 0 rgba(0, 0, 0, 0.35), inset 0 calc(4 * var(--u)) 0 rgba(255, 255, 255, 0.3);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 110ms ease;
}
.dn-tile:hover { transform: scale(1.06); }
.dn-tile:active { transform: translateY(calc(3 * var(--u))); }
.dn-tile svg, .dn-tile img { width: 68%; height: 68%; pointer-events: none; filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.4)); object-fit: contain; }
.dn-tile__label {
  position: absolute; left: 50%; bottom: calc(-14 * var(--u)); transform: translateX(-50%);
  font-size: clamp(10px, calc(21 * var(--u)), 24px); line-height: 1; white-space: nowrap; pointer-events: none;
}
.dn-tile__key {
  position: absolute; right: calc(-6 * var(--u)); top: calc(-6 * var(--u));
  min-width: max(14px, calc(22 * var(--u))); height: max(14px, calc(22 * var(--u)));
  border: max(1px, calc(2 * var(--u))) solid var(--dn-ink); border-radius: calc(7 * var(--u));
  background: #fff4dc; color: var(--dn-ink); font-size: max(9px, calc(12 * var(--u)));
  display: grid; place-items: center; line-height: 1; pointer-events: none;
}
body.aoe-touch-mode .dn-tile__key { display: none; }
.dn-tile__badge {
  position: absolute; left: calc(-8 * var(--u)); top: calc(-8 * var(--u));
  width: max(12px, calc(24 * var(--u))); height: max(12px, calc(24 * var(--u)));
  border: max(2px, calc(3 * var(--u))) solid var(--dn-ink); border-radius: 50%;
  background: #ff3a2a; display: none; animation: dn-pip 1.4s ease-in-out infinite;
}
.dn-tile--ready .dn-tile__badge { display: block; }
.dn-tile__pct { position: absolute; right: calc(4 * var(--u)); bottom: calc(10 * var(--u)); font-size: max(10px, calc(18 * var(--u))); pointer-events: none; }
.dn-tile--rebirth { --a: #d86aff; --b: #7a2ac8; }
.dn-tile--pets { --a: #ffb84a; --b: #d8701a; }
.dn-tile--dinos { --a: #7ad84a; --b: #2f8a24; }
.dn-tile--items { --a: #e8d8b0; --b: #a8905e; }
.dn-tile--teleport { --a: #4ad8d0; --b: #1a8a9a; }
.dn-tile--music { --a: #7ad84a; --b: #2f8a24; }
.dn-tile--off { filter: saturate(0.25) brightness(0.75); }
.dn-tile--bite { --a: #ff9a4a; --b: #c0421a; }
.dn-tile--bite.dn-tile--on { animation: dn-bite-on 0.9s ease-in-out infinite; }
@keyframes dn-bite-on { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 210, 58, 0.9); } 50% { box-shadow: 0 0 0 calc(5 * var(--u)) rgba(255, 210, 58, 0); } }
@keyframes dn-pip { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }

/* ---- Music toggle, top right under the account chip ---- */
.dn-corner {
  position: fixed;
  right: max(8px, calc(18 * var(--u)), env(safe-area-inset-right, 0px));
  top: max(64px, calc(96 * var(--u)));
  z-index: 21;
}
.dn-corner .dn-tile { width: clamp(38px, calc(62 * var(--u)), 76px); height: clamp(38px, calc(62 * var(--u)), 76px); }

/* ---- Bottom-left counters: Wins and Rebirths ---- */
.dn-counters {
  position: fixed;
  left: max(8px, calc(26 * var(--u)), env(safe-area-inset-left, 0px));
  bottom: max(8px, calc(24 * var(--u)), env(safe-area-inset-bottom, 0px));
  display: flex; flex-direction: column; gap: calc(8 * var(--u));
  z-index: 20; pointer-events: none;
}
.dn-counter { display: flex; align-items: center; gap: calc(12 * var(--u)); }
.dn-counter__icon { width: max(24px, calc(50 * var(--u))); height: max(24px, calc(50 * var(--u))); display: grid; place-items: center; }
.dn-counter__icon svg, .dn-counter__icon img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.35)); }
.dn-counter__value { font-size: max(15px, calc(40 * var(--u))); line-height: 1; }
.dn-counter--wins .dn-counter__value { color: #ffd23a; }
.dn-counter--rebirth .dn-counter__value { color: #e0a8ff; }
body.aoe-touch-mode .dn-counters { bottom: auto; top: max(8px, calc(20 * var(--u)), env(safe-area-inset-top, 0px)); flex-direction: row; gap: calc(24 * var(--u)); }

/* ---- Bottom centre: the mount, speed, multiplier, DAMAGE, level bar, health ---- */
.dn-status {
  position: fixed;
  left: 50%;
  bottom: max(10px, calc(26 * var(--u)), env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: min(82vw, calc(600 * var(--u)));
  display: flex; flex-direction: column; align-items: stretch; gap: calc(6 * var(--u));
  z-index: 20; pointer-events: none;
}
@media (orientation: portrait) {
  body.aoe-touch-mode { --aoe-controls-lift: 124px; }
  body.aoe-touch-mode .dn-status { width: min(92vw, calc(560 * var(--u))); bottom: calc(env(safe-area-inset-bottom, 0px) + 10px); }
}
@media (orientation: landscape) {
  body.aoe-touch-mode .dn-status { width: min(calc(100vw - 460px), calc(540 * var(--u))); min-width: 200px; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); }
}
.dn-row1 { display: flex; align-items: flex-end; justify-content: space-between; gap: calc(10 * var(--u)); }
.dn-speed, .dn-mult { display: flex; align-items: center; gap: calc(6 * var(--u)); font-size: max(11px, calc(26 * var(--u))); line-height: 1; white-space: nowrap; }
.dn-speed img, .dn-speed svg { width: max(16px, calc(36 * var(--u))); height: max(16px, calc(36 * var(--u))); object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
.dn-speed { color: #7fd8ff; }
.dn-mult { color: #ffd23a; }
.dn-damage { display: flex; align-items: center; justify-content: center; gap: calc(10 * var(--u)); }
.dn-damage img, .dn-damage svg { width: max(22px, calc(50 * var(--u))); height: max(22px, calc(50 * var(--u))); object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.35)); }
.dn-damage__value { font-size: max(20px, calc(50 * var(--u))); color: #ffb23a; line-height: 1; }
.dn-damage__label { font-size: max(12px, calc(26 * var(--u))); color: #ffe0a0; line-height: 1; align-self: flex-end; padding-bottom: calc(6 * var(--u)); }
.dn-damage--pop .dn-damage__value { animation: dn-pop 260ms ease-out; }
.dn-mount { text-align: center; font-size: max(10px, calc(20 * var(--u))); color: #cfe8b0; line-height: 1; }
.dn-level {
  position: relative; height: max(24px, calc(56 * var(--u)));
  border: max(2px, calc(4 * var(--u))) solid var(--dn-ink); border-radius: calc(10 * var(--u));
  background: #3a3226; overflow: hidden; display: flex;
  box-shadow: 0 calc(4 * var(--u)) 0 rgba(0, 0, 0, 0.3);
}
.dn-level__fill {
  position: absolute; left: 0; top: 0; bottom: 0; width: 0%;
  background: linear-gradient(180deg, #ffc84a 0%, #e86a1a 100%);
  transition: width 180ms ease-out;
}
.dn-level__fill::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 40%; background: rgba(255, 255, 255, 0.25); }
.dn-level--max .dn-level__fill { background: linear-gradient(180deg, #d88aff 0%, #8a3ad8 100%); }
.dn-level__name, .dn-level__value { position: relative; z-index: 1; display: flex; align-items: center; font-size: max(13px, calc(32 * var(--u))); padding: 0 calc(16 * var(--u)); line-height: 1; white-space: nowrap; }
.dn-level__name { flex: 1 1 auto; }
.dn-level__value { border-left: max(2px, calc(4 * var(--u))) solid var(--dn-ink); background: rgba(20, 16, 10, 0.5); }
.dn-health {
  position: relative; height: max(10px, calc(18 * var(--u)));
  border: max(2px, calc(3 * var(--u))) solid var(--dn-ink); border-radius: calc(6 * var(--u));
  background: #3a1a14; overflow: hidden;
}
.dn-health__fill { position: absolute; inset: 0 auto 0 0; width: 100%; background: linear-gradient(180deg, #8aff6a, #2fb83a); transition: width 120ms linear; }
.dn-health--low .dn-health__fill { background: linear-gradient(180deg, #ff7a6a, #d8201a); }
.dn-health__text { position: absolute; inset: 0; display: grid; place-items: center; font-size: max(9px, calc(14 * var(--u))); line-height: 1; }
@keyframes dn-pop { 0% { transform: scale(1); } 40% { transform: scale(1.2); } 100% { transform: scale(1); } }

/* ---- Top centre: the dinosaur being fought ---- */
.dn-target {
  position: fixed; left: 50%; top: max(10px, calc(20 * var(--u)), env(safe-area-inset-top, 0px));
  transform: translateX(-50%); width: min(70vw, calc(540 * var(--u)));
  z-index: 20; pointer-events: none; text-align: center;
}
.dn-target__name { font-size: max(13px, calc(30 * var(--u))); line-height: 1.1; }
.dn-target__bar {
  position: relative; margin-top: calc(4 * var(--u)); height: max(14px, calc(28 * var(--u)));
  border: max(2px, calc(4 * var(--u))) solid var(--dn-ink); border-radius: calc(8 * var(--u)); background: #3a302a; overflow: hidden;
}
.dn-target__fill { position: absolute; inset: 0 auto 0 0; width: 100%; background: linear-gradient(180deg, #ff7a5a, #c8301a); transition: width 120ms linear; }
.dn-target--boss .dn-target__fill { background: linear-gradient(180deg, #ffb03a, #c8601a); }
.dn-target__text { position: absolute; inset: 0; display: grid; place-items: center; font-size: max(10px, calc(18 * var(--u))); }
.dn-target__lock { font-size: max(11px, calc(20 * var(--u))); color: #ffb09a; margin-top: calc(4 * var(--u)); }
.dn-stageinfo { font-size: max(11px, calc(22 * var(--u))); color: #d8f0c0; margin-bottom: calc(6 * var(--u)); }

/* ---- Hint, toasts, popups, hurt vignette ---- */
.dn-hint {
  position: fixed; left: 50%; top: max(70px, calc(120 * var(--u))); transform: translateX(-50%);
  max-width: 80vw; padding: calc(10 * var(--u)) calc(26 * var(--u));
  border: max(2px, calc(4 * var(--u))) solid var(--dn-ink); border-radius: calc(16 * var(--u));
  background: linear-gradient(180deg, #5a8a3a, #2f5a22);
  font-size: max(12px, calc(26 * var(--u))); text-align: center; z-index: 19; pointer-events: none;
  box-shadow: 0 calc(5 * var(--u)) 0 rgba(0,0,0,0.3);
}
.dn-toasts { position: fixed; left: 50%; top: 32%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: calc(8 * var(--u)); z-index: 40; pointer-events: none; }
.dn-toast { font-size: max(14px, calc(34 * var(--u))); animation: dn-toast 2.4s ease-out forwards; white-space: nowrap; }
.dn-toast--good { color: #8aff6a; }
.dn-toast--bad { color: #ff8a7a; }
.dn-toast--gold { color: #ffd23a; }
.dn-toast--pink { color: #e0a8ff; }
@keyframes dn-toast { 0% { opacity: 0; transform: translateY(12px) scale(0.9); } 10% { opacity: 1; transform: translateY(0) scale(1.05); } 20% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-16px); } }
.dn-pops { position: fixed; inset: 0; pointer-events: none; z-index: 18; overflow: hidden; }
.dn-pop { position: absolute; font-size: max(14px, calc(34 * var(--u))); color: #ffc23a; animation: dn-rise 0.9s ease-out forwards; white-space: nowrap; }
.dn-pop img, .dn-pop svg { width: max(16px, calc(40 * var(--u))); height: max(16px, calc(40 * var(--u))); margin-right: calc(6 * var(--u)); vertical-align: middle; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.35)); }
.dn-pop--loot { color: #8affc8; }
@keyframes dn-rise { 0% { opacity: 0; transform: translate(-50%, 8px) scale(0.7); } 15% { opacity: 1; transform: translate(-50%, 0) scale(1.12); } 100% { opacity: 0; transform: translate(-50%, -76px) scale(1); } }
.dn-levelup { position: fixed; left: 50%; top: 22%; transform: translateX(-50%); text-align: center; z-index: 41; pointer-events: none; animation: dn-levelup 2.6s ease-out forwards; }
.dn-levelup__title { font-size: max(24px, calc(70 * var(--u))); color: #ffd23a; }
.dn-levelup__line { font-size: max(14px, calc(32 * var(--u))); color: #9fe8ff; }
@keyframes dn-levelup { 0% { opacity: 0; transform: translateX(-50%) scale(0.6); } 12% { opacity: 1; transform: translateX(-50%) scale(1.12); } 20% { transform: translateX(-50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) translateY(-20px); } }
.dn-hurt { position: fixed; inset: 0; pointer-events: none; z-index: 17; opacity: 0; transition: opacity 90ms linear; background: radial-gradient(ellipse at center, transparent 55%, rgba(200, 20, 10, 0.55) 100%); }
.dn-dead { position: fixed; left: 50%; top: 40%; transform: translate(-50%, -50%); z-index: 42; pointer-events: none; text-align: center; animation: dn-toast 3s ease-out forwards; }
.dn-dead__title { font-size: max(26px, calc(76 * var(--u))); color: #ff6a4a; }
.dn-dead__line { font-size: max(13px, calc(30 * var(--u))); }

/* ---- Windows: dinos, pets, items, rebirth, eggs, teleport ---- */
.dn-modal { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(8, 16, 8, 0.32); }
.dn-window { position: relative; width: min(94vw, calc(1180 * var(--u))); max-height: min(88vh, calc(760 * var(--u))); display: flex; flex-direction: column; }
.dn-window--small { width: min(92vw, calc(780 * var(--u))); }
.dn-head {
  display: flex; align-items: center; gap: calc(18 * var(--u));
  height: max(48px, calc(90 * var(--u)));
  padding: 0 calc(12 * var(--u)) 0 calc(20 * var(--u));
  border: max(3px, calc(6 * var(--u))) solid var(--dn-ink); border-radius: calc(12 * var(--u)) calc(12 * var(--u)) 0 0;
  background:
    repeating-linear-gradient(92deg, rgba(90, 40, 10, 0.16) 0 2px, transparent 2px 11px),
    repeating-linear-gradient(88deg, rgba(255, 230, 170, 0.08) 0 1px, transparent 1px 17px),
    linear-gradient(180deg, #f0b04a, #c8741e);
  box-shadow: inset 0 calc(4 * var(--u)) 0 rgba(255,240,200,0.35);
}
.dn-head__icon { width: max(34px, calc(74 * var(--u))); height: max(34px, calc(74 * var(--u))); display: grid; place-items: center; margin-top: calc(-14 * var(--u)); }
.dn-head__icon svg, .dn-head__icon img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 3px 2px rgba(0,0,0,0.45)); }
.dn-head__title { font-size: max(20px, calc(54 * var(--u))); line-height: 1; flex: 0 0 auto; }
.dn-head__search {
  flex: 1 1 auto; min-width: 0; height: 58%; margin-left: calc(20 * var(--u));
  border: max(2px, calc(4 * var(--u))) solid #6a3a10; border-radius: calc(8 * var(--u));
  background: rgba(60, 30, 8, 0.45); color: #fff4dc; padding: 0 calc(14 * var(--u));
  font-family: var(--dn-font); font-weight: 700; font-size: max(12px, calc(28 * var(--u))); outline: none;
}
.dn-head__search::placeholder { color: rgba(255,240,210,0.7); }
.dn-close {
  flex: 0 0 auto; width: max(38px, calc(70 * var(--u))); height: max(38px, calc(70 * var(--u)));
  border: max(3px, calc(5 * var(--u))) solid var(--dn-ink); border-radius: calc(6 * var(--u));
  background: linear-gradient(180deg, #ff5a3a, #c8201a); color: #fff; cursor: pointer;
  font-family: var(--dn-font); font-weight: 700; font-size: max(18px, calc(44 * var(--u))); line-height: 1; display: grid; place-items: center;
}
.dn-close:hover { filter: brightness(1.1); }
.dn-main { position: relative; display: flex; min-height: 0; flex: 1 1 auto; }
.dn-tabs { position: absolute; right: 100%; top: calc(-8 * var(--u)); display: flex; flex-direction: column; gap: calc(12 * var(--u)); padding-right: calc(4 * var(--u)); }
.dn-tab {
  position: relative; width: max(64px, calc(176 * var(--u))); height: max(40px, calc(74 * var(--u)));
  border: max(2px, calc(5 * var(--u))) solid var(--dn-ink); border-radius: calc(8 * var(--u)) 0 0 calc(8 * var(--u));
  background: linear-gradient(180deg, #4a7a2e, #2a4a1a); cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: calc(4 * var(--u));
}
.dn-tab--on { background: linear-gradient(180deg, #7ac84a, #3a8a24); transform: translateX(calc(8 * var(--u))); }
.dn-tab svg, .dn-tab img { position: absolute; top: calc(-10 * var(--u)); width: max(26px, calc(54 * var(--u))); height: max(26px, calc(54 * var(--u))); object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.4)); }
.dn-tab__label { font-size: max(10px, calc(24 * var(--u))); line-height: 1; position: relative; }
.dn-body {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  border: max(3px, calc(6 * var(--u))) solid var(--dn-ink); border-top: none; border-radius: 0 0 calc(12 * var(--u)) calc(12 * var(--u));
  background:
    radial-gradient(ellipse at 20% 0%, rgba(120, 200, 80, 0.12), transparent 60%),
    repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 14px),
    var(--dn-panel);
  backdrop-filter: blur(5px);
  padding: calc(18 * var(--u)) calc(26 * var(--u)) calc(26 * var(--u));
}
.dn-section { font-size: max(14px, calc(34 * var(--u))); text-align: center; margin: calc(6 * var(--u)) 0 calc(14 * var(--u)); display: flex; align-items: center; gap: calc(16 * var(--u)); }
.dn-section::before, .dn-section::after { content: ''; flex: 1 1 auto; height: calc(4 * var(--u)); background: linear-gradient(90deg, transparent, rgba(255,220,150,0.45), transparent); }
.dn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(84px, calc(158 * var(--u))), 1fr)); gap: calc(14 * var(--u)); }
.dn-card { position: relative; aspect-ratio: 1 / 1.12; cursor: pointer; border: none; background: none; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.dn-card__blob {
  position: absolute; inset: 4% 4% 16%;
  border-radius: calc(14 * var(--u));
  border: max(2px, calc(4 * var(--u))) solid var(--dn-ink);
  background: radial-gradient(circle at 50% 40%, var(--blob, #e8dcc0), var(--blob2, #b8a47a));
  box-shadow: 0 calc(4 * var(--u)) 0 rgba(0,0,0,0.3);
}
.dn-card--locked .dn-card__blob { --blob: #3a3a34; --blob2: #22221e; }
.dn-card--selected .dn-card__blob { --blob: #fff4c0; --blob2: #e8c060; }
.dn-card__img { position: relative; width: 84%; height: 74%; object-fit: contain; }
.dn-card__icon { position: relative; width: 58%; height: 58%; display: grid; place-items: center; }
.dn-card__icon svg { width: 100%; height: 100%; }
.dn-card__name { position: relative; font-size: max(10px, calc(19 * var(--u))); line-height: 1; margin-top: calc(-2 * var(--u)); text-align: center; }
.dn-card__meta { position: relative; font-size: max(9px, calc(17 * var(--u))); line-height: 1.12; text-align: center; }
.dn-card__count { position: absolute; right: 10%; top: 8%; font-size: max(11px, calc(22 * var(--u))); }
.dn-card__check {
  position: absolute; right: 8%; top: 6%; width: 26%; height: 22%; border-radius: 50%;
  border: max(2px, calc(3 * var(--u))) solid #fff; background: radial-gradient(circle, #6ae04a, #2aa03a);
  display: grid; place-items: center; box-shadow: 0 0 0 max(1px, calc(2 * var(--u))) var(--dn-ink);
}
.dn-card__check svg { width: 70%; height: 70%; }
.dn-card__lock { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); font-size: max(11px, calc(24 * var(--u))); text-align: center; line-height: 1.05; }
.dn-card:hover .dn-card__blob { filter: brightness(1.12); }
.dn-row { display: flex; flex-wrap: wrap; gap: calc(14 * var(--u)); justify-content: center; margin-top: calc(16 * var(--u)); }
.dn-btn {
  cursor: pointer; border: max(2px, calc(5 * var(--u))) solid var(--dn-ink); border-radius: calc(12 * var(--u));
  padding: calc(10 * var(--u)) calc(26 * var(--u)); min-height: max(36px, calc(64 * var(--u)));
  font-family: var(--dn-font); font-weight: 700; font-size: max(13px, calc(30 * var(--u))); color: #fff8e8;
  background: linear-gradient(180deg, #f0b04a, #c8741e);
  box-shadow: 0 calc(5 * var(--u)) 0 rgba(0,0,0,0.3), inset 0 calc(3 * var(--u)) 0 rgba(255,255,255,0.3);
  display: inline-flex; align-items: center; gap: calc(10 * var(--u));
  text-shadow: 0 2px 0 rgba(0,0,0,0.45);
}
.dn-btn:disabled { filter: saturate(0.2) brightness(0.8); cursor: default; }
.dn-btn:not(:disabled):hover { filter: brightness(1.08); }
.dn-btn--green { background: linear-gradient(180deg, #7ad84a, #2f8a24); }
.dn-btn--red { background: linear-gradient(180deg, #ff6a4a, #c8201a); }
.dn-btn--rainbow { background: linear-gradient(90deg, #ff5a5a, #ffc23a, #7ad84a, #4ac8ff, #b86aff); }
.dn-btn svg, .dn-btn img { width: max(18px, calc(36 * var(--u))); height: max(18px, calc(36 * var(--u))); object-fit: contain; }
.dn-detail { margin-top: calc(14 * var(--u)); padding: calc(12 * var(--u)) calc(18 * var(--u)); border-radius: calc(10 * var(--u)); background: rgba(0,0,0,0.3); text-align: center; font-size: max(12px, calc(26 * var(--u))); }
.dn-detail small { display: block; font-size: max(10px, calc(20 * var(--u))); color: #d8f0c0; }
.dn-empty { text-align: center; font-size: max(12px, calc(26 * var(--u))); color: #e0ecd0; padding: calc(30 * var(--u)) 0; }

/* Items: three worn slots in a triangle, the bag beside them */
.dn-items { display: grid; grid-template-columns: minmax(max(170px, calc(330 * var(--u))), auto) 1fr; gap: calc(20 * var(--u)); align-items: start; }
@media (max-width: 640px) { .dn-items { grid-template-columns: 1fr; } }
.dn-slots { position: relative; width: 100%; aspect-ratio: 1 / 0.92; }
.dn-slots::before { content: ''; position: absolute; inset: 14%; border: max(2px, calc(4 * var(--u))) solid rgba(255,230,180,0.35); border-radius: 50%; }
.dn-slot {
  position: absolute; width: 38%; aspect-ratio: 1; transform: translate(-50%, -50%);
  border: max(3px, calc(5 * var(--u))) solid #e8a83a; border-radius: calc(12 * var(--u));
  background: rgba(255, 248, 230, 0.92); cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: var(--dn-font); font-weight: 700; color: #5a4a3a; font-size: max(10px, calc(20 * var(--u)));
}
.dn-slot svg { width: 58%; height: 58%; }
.dn-slot:nth-child(1) { left: 50%; top: 22%; }
.dn-slot:nth-child(2) { left: 22%; top: 76%; }
.dn-slot:nth-child(3) { left: 78%; top: 76%; }
.dn-slot--filled { background: radial-gradient(circle, #fff4dc, #e8d0a0); }

/* Rebirth window */
.dn-rb { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: calc(18 * var(--u)); }
.dn-rb__col { display: flex; flex-direction: column; align-items: stretch; gap: calc(10 * var(--u)); }
.dn-rb__title { font-size: max(14px, calc(34 * var(--u))); text-align: center; }
.dn-rb__card {
  display: flex; align-items: center; justify-content: center; gap: calc(12 * var(--u)); padding: calc(10 * var(--u)) calc(16 * var(--u));
  border: max(2px, calc(5 * var(--u))) solid var(--dn-ink); border-radius: calc(10 * var(--u));
  background: linear-gradient(180deg, #ffd24a, #e8901a); font-size: max(15px, calc(38 * var(--u)));
}
.dn-rb__card img, .dn-rb__card svg { width: max(24px, calc(50 * var(--u))); height: max(24px, calc(50 * var(--u))); object-fit: contain; }
.dn-rb__arrow svg { width: max(40px, calc(96 * var(--u))); height: max(40px, calc(96 * var(--u))); }
.dn-rb__warn { text-align: center; font-size: max(12px, calc(28 * var(--u))); color: #ff5a3a; margin: calc(16 * var(--u)) 0 calc(4 * var(--u)); }
.dn-rb__keep { text-align: center; font-size: max(10px, calc(20 * var(--u))); color: #cfe8b0; margin-bottom: calc(10 * var(--u)); }
.dn-rb__bar { position: relative; height: max(28px, calc(62 * var(--u))); border: max(2px, calc(5 * var(--u))) solid var(--dn-ink); border-radius: calc(10 * var(--u)); background: #4a4234; overflow: hidden; }
.dn-rb__fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(180deg, #ffd24a, #e8901a); }
.dn-rb__label { position: absolute; inset: 0; display: grid; place-items: center; font-size: max(13px, calc(32 * var(--u))); }

/* Egg window */
.dn-egg__odds { display: grid; grid-template-columns: repeat(3, 1fr); gap: calc(12 * var(--u)); }
.dn-hatch { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: rgba(8,16,8,0.5); pointer-events: auto; }
.dn-hatch__box { display: flex; gap: calc(24 * var(--u)); flex-wrap: wrap; justify-content: center; animation: dn-hatchin 480ms ease-out; }
.dn-hatch__pet { display: flex; flex-direction: column; align-items: center; gap: calc(6 * var(--u)); width: max(110px, calc(230 * var(--u))); }
.dn-hatch__pet img { width: 100%; aspect-ratio: 1; object-fit: contain; filter: drop-shadow(0 6px 6px rgba(0,0,0,0.45)); }
.dn-hatch__name { font-size: max(14px, calc(34 * var(--u))); }
.dn-hatch__rarity { font-size: max(12px, calc(26 * var(--u))); }
@keyframes dn-hatchin { 0% { transform: scale(0.3) rotate(-8deg); opacity: 0; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); } }

/* Teleport window */
.dn-places { display: grid; grid-template-columns: repeat(auto-fill, minmax(max(120px, calc(240 * var(--u))), 1fr)); gap: calc(14 * var(--u)); }

/* Damage numbers floating off what was hit (projected from the world each frame). */
.ke-dmg-layer { position: fixed; inset: 0; pointer-events: none; z-index: 18; overflow: hidden; }
.ke-dmg { position: absolute; left: 0; top: 0; font-family: var(--dn-font); font-weight: 700; font-size: max(14px, calc(34 * var(--u))); color: #fff4dc; white-space: nowrap; will-change: transform; }
.ke-dmg--kill { color: #ff6a4a; font-size: max(16px, calc(44 * var(--u))); }
.ke-outline {
  text-shadow: 2px 0 0 var(--dn-ink), -2px 0 0 var(--dn-ink), 0 2px 0 var(--dn-ink), 0 -2px 0 var(--dn-ink),
    2px 2px 0 var(--dn-ink), -2px 2px 0 var(--dn-ink), 2px -2px 0 var(--dn-ink), -2px -2px 0 var(--dn-ink);
}

@media (max-height: 520px) {
  .dn-window { max-height: 94vh; }
  .dn-tabs { top: 0; gap: calc(6 * var(--u)); }
  .dn-rail { gap: calc(16 * var(--u)) calc(10 * var(--u)); }
}
`;
  document.head.appendChild(style);
};
