import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ATTACK_SECONDS, DinoAnimator, createMotion, type DinoMotion } from '../dinos/DinoAnimator.js';
import { LOOKS } from '../dinos/DinoLooks.js';
import { createDino, type DinoInstance } from '../dinos/DinoModel.js';

/**
 * DEV ONLY (not in the production build): every dinosaur look, built and
 * animated, for inspecting anatomy, skins and animation. Open /dinolab.html.
 */
const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color('#9cc8e8');
scene.fog = new Fog('#9cc8e8', 80, 260);
scene.add(new HemisphereLight(0xcfe8ff, 0x6a5a40, 1.1));
scene.add(new AmbientLight(0xffffff, 0.35));
const sun = new DirectionalLight(0xfff0d8, 2.2);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 });
scene.add(sun);

const ground = new Mesh(new PlaneGeometry(600, 600), new MeshStandardMaterial({ color: '#7a9a4a', roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(14, 8, 18);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, 0);

interface Specimen {
  readonly dino: DinoInstance;
  readonly animator: DinoAnimator;
  readonly motion: DinoMotion;
}
let specimens: Specimen[] = [];
let mode = 'idle';
let clock = 0;

const ui = document.getElementById('ui')!;
const info = document.getElementById('info')!;
const select = document.createElement('select');
const all = document.createElement('option');
all.value = '*rideable';
all.textContent = 'ALL: rideable 13';
select.append(all);
for (const group of ['*wild', '*pets', '*dummies']) {
  const option = document.createElement('option');
  option.value = group;
  option.textContent = `ALL: ${group.slice(1)}`;
  select.append(option);
}
for (const id of Object.keys(LOOKS)) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = id;
  select.append(option);
}
ui.append(select);
for (const m of ['idle', 'walk', 'run', 'attack', 'jump', 'death', 'hit', 'roar']) {
  const b = document.createElement('button');
  b.textContent = m;
  b.onclick = () => {
    mode = m;
    clock = 0;
    for (const s of specimens) s.animator.reset();
  };
  ui.append(b);
}

const RIDEABLE = ['compy', 'blue', 'gallimimus', 'parasaurolophus', 'pyroraptor', 'triceratops', 'therizinosaurus', 'spinosaurus', 'allosaurus', 'ceratosaurus', 'tyrannosaurus', 'indoraptor', 'indominus'];

const populate = (): void => {
  for (const s of specimens) s.dino.dispose();
  specimens = [];
  const value = select.value;
  let ids: string[];
  if (value === '*rideable') ids = RIDEABLE;
  else if (value === '*pets') ids = Object.keys(LOOKS).filter((id) => id.startsWith('pet-'));
  else if (value === '*dummies') ids = Object.keys(LOOKS).filter((id) => id.startsWith('dummy-'));
  else if (value === '*wild') ids = Object.keys(LOOKS).filter((id) => !id.startsWith('pet-') && !id.startsWith('dummy-') && !RIDEABLE.includes(id));
  else ids = [value];
  let x = 0;
  const started = performance.now();
  let verts = 0;
  for (const id of ids) {
    const dino = createDino(id, 'high');
    const width = Math.max(2, dino.asset.hip * 1.4);
    x += width;
    dino.root.position.set(x, 0, 0);
    dino.root.rotation.y = -Math.PI / 2 + 0.5;
    x += width;
    scene.add(dino.root);
    const animator = new DinoAnimator(dino);
    specimens.push({ dino, animator, motion: createMotion() });
    verts += dino.asset.geometry.getAttribute('position').count;
  }
  const mid = x / 2;
  controls.target.set(mid, 3, 0);
  camera.position.set(mid, 10, Math.max(20, x * 0.6));
  info.textContent = `${ids.length} built in ${Math.round(performance.now() - started)} ms, ${verts} verts`;
};
select.onchange = populate;
populate();

let last = performance.now();
const frame = (now: number): void => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  for (const s of specimens) {
    const m = s.motion;
    m.speed = mode === 'walk' ? s.dino.asset.hip * 2.2 : mode === 'run' ? 30 : 0;
    m.grounded = true;
    m.landed = false;
    m.verticalVelocity = 0;
    m.attackTime = -1;
    m.deathTime = -1;
    m.hitTime = -1;
    m.roarTime = -1;
    if (mode === 'attack') {
      const t = clock % 0.9;
      m.attackTime = t < ATTACK_SECONDS ? t : -1;
      if (t < dt) m.attackVariant += 1;
    }
    if (mode === 'jump') {
      const t = clock % 1.6;
      const air = t > 0.1 && t < 1.0;
      m.grounded = !air;
      m.verticalVelocity = air ? 24 - (t - 0.1) * 53 : 0;
      m.landed = t >= 1.0 && t < 1.0 + dt;
      s.dino.root.position.y = air ? Math.max(0, 24 * (t - 0.1) - 26.5 * (t - 0.1) ** 2) : 0;
    } else {
      s.dino.root.position.y = 0;
    }
    if (mode === 'death') m.deathTime = clock % 4;
    if (mode === 'hit') m.hitTime = clock % 0.8;
    if (mode === 'roar') m.roarTime = clock % 2;
    s.animator.update(dt, m);
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
/** Frame one look close up: `lab.show('blue', 1, 0.8)`. */
const show = (look: string, distance = 1, yaw = 0.8): void => {
  select.value = look;
  populate();
  const dino = specimens[0]!.dino;
  const p = dino.root.position;
  const h = dino.asset.height;
  const radius = Math.max(h * 1.4, dino.asset.length * 0.85) * distance;
  controls.target.set(p.x, h * 0.45, p.z);
  camera.position.set(p.x + Math.sin(yaw) * radius, h * 0.75, p.z + Math.cos(yaw) * radius);
  controls.update();
};
(window as unknown as { lab: unknown }).lab = { scene, camera, controls, specimens: () => specimens, show };
