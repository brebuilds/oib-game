import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Constants ───────────────────────────────────────────────────────
const MAP_W = 60;
const MAP_H = 40;
const TILE = { SAND: 0, ROAD: 1, OCEAN: 2, BEACH: 3, PIER: 4, GRASS: 5, BUILDING: 10 };

// ─── Renderer ────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.insertBefore(renderer.domElement, document.getElementById('ui'));

// ─── Scene ───────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a7abf');

// ─── Orthographic Camera ─────────────────────────────────────────────
const frustumSize = 30;
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -frustumSize * aspect / 2, frustumSize * aspect / 2,
  frustumSize / 2, -frustumSize / 2,
  0.1, 200
);
camera.position.set(30, 20, 45);
camera.lookAt(30, 0, 25);

// ─── Lights ──────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xfff8e7, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.left = -40;
dirLight.shadow.camera.right = 40;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = -40;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 100;
scene.add(dirLight);

// ─── CSS2D Label Renderer ────────────────────────────────────────────
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.insertBefore(labelRenderer.domElement, document.getElementById('ui'));

// ─── Resize Handler ─────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const a = window.innerWidth / window.innerHeight;
  camera.left = -frustumSize * a / 2;
  camera.right = frustumSize * a / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ═══════════════════════════════════════════════════════════════════════
//  TASK 2 — Tile Map & Ground Rendering
// ═══════════════════════════════════════════════════════════════════════

const map = new Array(MAP_H).fill(null).map(() => new Array(MAP_W).fill(TILE.GRASS));

// Helper to fill a rect
function fillRect(type, r0, r1, c0, c1) {
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      map[r][c] = type;
}

// Ocean (rows 0-6)
fillRect(TILE.OCEAN, 0, 6, 0, MAP_W - 1);

// Beach (rows 7-10)
fillRect(TILE.BEACH, 7, 10, 0, MAP_W - 1);

// Pier tiles (cols 29-30, rows 0-10)
fillRect(TILE.PIER, 0, 10, 29, 30);

// Main east-west road (rows 11-12)
fillRect(TILE.ROAD, 11, 12, 0, MAP_W - 1);

// Roundabout at center (~cols 27-33, rows 11-14)
fillRect(TILE.ROAD, 13, 14, 27, 33);
// hollow center
fillRect(TILE.GRASS, 12, 13, 29, 31);

// Grass rows 13-19 (already default)

// Secondary road / park (rows 20-21)
fillRect(TILE.ROAD, 20, 21, 10, 50);

// Causeway Drive vertical road (cols 28-30, rows 13-34)
fillRect(TILE.ROAD, 13, 34, 28, 30);

// ICW water (rows 35-39)
fillRect(TILE.OCEAN, 35, 39, 0, MAP_W - 1);

// ─── Render Ground Tiles ─────────────────────────────────────────────
const tileGeo = new THREE.PlaneGeometry(1, 1);
tileGeo.rotateX(-Math.PI / 2);

const tileColors = {
  [TILE.GRASS]:  ['#c8b560', '#d4c270'],
  [TILE.BEACH]:  ['#e8d9a0', '#f0e4b0'],
  [TILE.SAND]:   ['#e8d9a0', '#f0e4b0'],
  [TILE.ROAD]:   ['#888070', '#888070'],
  [TILE.PIER]:   ['#8b6040', '#8b6040'],
};

// Collect tiles per visual type (skip OCEAN — water shader covers it)
const tileBuckets = {};
for (let r = 0; r < MAP_H; r++) {
  for (let c = 0; c < MAP_W; c++) {
    let type = map[r][c];
    if (type === TILE.OCEAN) continue;        // water shader
    if (type === TILE.BUILDING) type = TILE.GRASS; // buildings rendered separately
    const colorIdx = (r + c) % 2;             // checkerboard
    const key = `${type}_${colorIdx}`;
    if (!tileBuckets[key]) tileBuckets[key] = { type, colorIdx, positions: [] };
    tileBuckets[key].positions.push([c + 0.5, 0, r + 0.5]);
  }
}

for (const key of Object.keys(tileBuckets)) {
  const { type, colorIdx, positions } = tileBuckets[key];
  const colors = tileColors[type] || tileColors[TILE.GRASS];
  const mat = new THREE.MeshStandardMaterial({ color: colors[colorIdx] });
  const mesh = new THREE.InstancedMesh(tileGeo, mat, positions.length);
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  positions.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(mesh);
}

// ─── Road Yellow Dashes (main road) ──────────────────────────────────
const dashGeo = new THREE.PlaneGeometry(0.6, 0.08);
dashGeo.rotateX(-Math.PI / 2);
const dashMat = new THREE.MeshStandardMaterial({ color: '#e8c840' });
for (let c = 0; c < MAP_W; c += 2) {
  const dash = new THREE.Mesh(dashGeo, dashMat);
  dash.position.set(c + 0.5, 0.01, 11.5);
  scene.add(dash);
}
// Secondary road dashes
for (let c = 10; c <= 50; c += 2) {
  const dash = new THREE.Mesh(dashGeo, dashMat);
  dash.position.set(c + 0.5, 0.01, 20.5);
  scene.add(dash);
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 3 — Water Shader (Ocean + ICW)
// ═══════════════════════════════════════════════════════════════════════

const waterUniforms = {
  uTime: { value: 0 },
  uBaseColor: { value: new THREE.Color('#1a7abf') },
  uFoam: { value: 1.0 },
};

const waterVert = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.y += sin(uTime * 1.2 + pos.x * 0.5 + pos.z * 0.3) * 0.15;
    pos.y += sin(uTime * 0.8 + pos.x * 0.3 - pos.z * 0.5) * 0.1;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const waterFrag = /* glsl */`
  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform float uFoam;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vec3 col = uBaseColor;
    // Wave crest highlights
    float wave = sin(uTime * 1.2 + vWorldPos.x * 0.5 + vWorldPos.z * 0.3);
    col += vec3(0.08, 0.12, 0.15) * smoothstep(0.5, 1.0, wave);
    // Foam at beach edge (z ~ 7)
    float foamLine = 1.0 - smoothstep(6.0, 7.5, vWorldPos.z);
    float foamPattern = sin(vWorldPos.x * 3.0 + uTime * 2.0) * 0.5 + 0.5;
    col = mix(col, vec3(0.85, 0.92, 0.95), foamLine * foamPattern * 0.6 * uFoam);
    // Sparkle dots
    float sparkle = sin(vWorldPos.x * 8.0 + uTime * 3.0) * sin(vWorldPos.z * 6.0 - uTime * 2.0);
    col += vec3(0.15) * smoothstep(0.92, 1.0, sparkle);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Ocean plane — covers rows 0-7 and extends far north
const oceanGeo = new THREE.PlaneGeometry(MAP_W + 40, 80, 80, 80);
oceanGeo.rotateX(-Math.PI / 2);
const oceanMat = new THREE.ShaderMaterial({
  uniforms: waterUniforms,
  vertexShader: waterVert,
  fragmentShader: waterFrag,
});
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.position.set(MAP_W / 2, -0.05, -33); // center of 80-unit depth ending at z≈7
scene.add(ocean);

// ICW plane (rows 35-39) — calmer, darker
const icwUniforms = {
  uTime: { value: 0 },
  uBaseColor: { value: new THREE.Color('#0d5a9a') },
  uFoam: { value: 0.0 },
};

const icwVert = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.y += sin(uTime * 0.6 + pos.x * 0.3 + pos.z * 0.2) * 0.05;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const icwMat = new THREE.ShaderMaterial({
  uniforms: icwUniforms,
  vertexShader: icwVert,
  fragmentShader: waterFrag,
});
const icwGeo = new THREE.PlaneGeometry(MAP_W + 20, 5, 40, 20);
icwGeo.rotateX(-Math.PI / 2);
const icw = new THREE.Mesh(icwGeo, icwMat);
icw.position.set(MAP_W / 2, -0.05, 37.5);
scene.add(icw);

// ═══════════════════════════════════════════════════════════════════════
//  TASK 7 — Billboard Sprite System
// ═══════════════════════════════════════════════════════════════════════

function makeCharTexture(bodyColor, hairColor, legOffset = 0) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Hair
  ctx.fillStyle = hairColor;
  ctx.fillRect(11, 2, 10, 4);

  // Head (skin)
  ctx.fillStyle = '#f0c8a0';
  ctx.fillRect(11, 5, 10, 8);

  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(13, 8, 2, 2);
  ctx.fillRect(18, 8, 2, 2);
  // Eye highlights
  ctx.fillStyle = '#fff';
  ctx.fillRect(13, 8, 1, 1);
  ctx.fillRect(18, 8, 1, 1);

  // Body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(10, 13, 12, 10);

  // Legs (darker variant of body)
  const legDark = '#443322';
  if (legOffset === 0) {
    // Standing: two legs side by side
    ctx.fillStyle = legDark;
    ctx.fillRect(11, 23, 4, 7);
    ctx.fillRect(17, 23, 4, 7);
  } else {
    // Walking: legs shifted
    ctx.fillStyle = legDark;
    ctx.fillRect(10, 23, 4, 7);
    ctx.fillRect(18, 23, 4, 7);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function makeBillboardSprite(bodyColor, hairColor) {
  const texStand = makeCharTexture(bodyColor, hairColor, 0);
  const texWalk = makeCharTexture(bodyColor, hairColor, 1);
  const geo = new THREE.PlaneGeometry(0.8, 1.2);
  const mat = new THREE.MeshBasicMaterial({ map: texStand, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.texStand = texStand;
  mesh.userData.texWalk = texWalk;
  mesh.userData.animFrame = 0;
  return mesh;
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 4 — Player Movement & Camera Follow
// ═══════════════════════════════════════════════════════════════════════

// Player with billboard sprite
const playerGroup = new THREE.Group();
const playerSprite = makeBillboardSprite('#2288cc', '#3a2a1a');
playerSprite.position.y = 0.6;
playerGroup.add(playerSprite);

// Golden diamond bobbing above
const diamondGeo = new THREE.OctahedronGeometry(0.15);
const diamondMat = new THREE.MeshStandardMaterial({ color: '#ffd700', emissive: '#aa8800', emissiveIntensity: 0.4 });
const diamond = new THREE.Mesh(diamondGeo, diamondMat);
diamond.position.y = 1.6;
playerGroup.add(diamond);

playerGroup.position.set(30, 0, 25);
scene.add(playerGroup);

// Input state
const keys = {};
let dialogActive = false;
let menuIndex = 0;
let currentDialog = null;

window.addEventListener('keydown', e => {
  keys[e.code] = true;

  if (dialogActive) {
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      menuIndex = Math.max(0, menuIndex - 1);
      renderDialogOptions();
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      menuIndex = Math.min((currentDialog?.options?.length || 1) - 1, menuIndex + 1);
      renderDialogOptions();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      selectDialogOption();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      closeDialog();
    }
    return;
  }

  // Interaction trigger
  if (e.code === 'Space' || e.code === 'KeyE') {
    e.preventDefault();
    tryInteract();
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

const SPEED = 0.08;

function getTile(x, z) {
  const col = Math.floor(x);
  const row = Math.floor(z);
  if (col < 0 || col >= MAP_W || row < 0 || row >= MAP_H) return TILE.OCEAN;
  return map[row][col];
}

function isWalkable(type) {
  return type !== TILE.OCEAN && type !== TILE.BUILDING;
}

function updatePlayer() {
  let dx = 0, dz = 0;
  if (!dialogActive) {
    if (keys['KeyW'] || keys['ArrowUp'])    dz = -1;
    if (keys['KeyS'] || keys['ArrowDown'])  dz =  1;
    if (keys['KeyA'] || keys['ArrowLeft'])  dx = -1;
    if (keys['KeyD'] || keys['ArrowRight']) dx =  1;
  }

  // Normalize diagonal
  if (dx !== 0 && dz !== 0) {
    const inv = 1 / Math.SQRT2;
    dx *= inv;
    dz *= inv;
  }

  const newX = playerGroup.position.x + dx * SPEED;
  const newZ = playerGroup.position.z + dz * SPEED;

  // Wall sliding: check X and Z independently
  if (isWalkable(getTile(newX, playerGroup.position.z))) {
    playerGroup.position.x = newX;
  }
  if (isWalkable(getTile(playerGroup.position.x, newZ))) {
    playerGroup.position.z = newZ;
  }

  // Clamp to map bounds
  playerGroup.position.x = Math.max(0.4, Math.min(MAP_W - 0.4, playerGroup.position.x));
  playerGroup.position.z = Math.max(0.4, Math.min(MAP_H - 0.4, playerGroup.position.z));

  // Walk animation
  const isMoving = dx !== 0 || dz !== 0;
  if (isMoving) {
    playerSprite.userData.animFrame++;
    if (playerSprite.userData.animFrame % 10 === 0) {
      const useWalk = (Math.floor(playerSprite.userData.animFrame / 10) % 2) === 1;
      playerSprite.material.map = useWalk ? playerSprite.userData.texWalk : playerSprite.userData.texStand;
      playerSprite.material.needsUpdate = true;
    }
  } else {
    playerSprite.material.map = playerSprite.userData.texStand;
    playerSprite.material.needsUpdate = true;
    playerSprite.userData.animFrame = 0;
  }
}

function updateCamera() {
  camera.position.x += (playerGroup.position.x - camera.position.x) * 0.05;
  camera.position.z += (playerGroup.position.z + 20 - camera.position.z) * 0.05;
  camera.position.y += (20 - camera.position.y) * 0.05;
  camera.lookAt(playerGroup.position.x, 0, playerGroup.position.z);
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 9 — Interaction & Dialog System
// ═══════════════════════════════════════════════════════════════════════

const dialogEl = document.getElementById('dialog');
const dialogBackdrop = document.getElementById('dialog-backdrop');
const dialogTextEl = document.getElementById('dialog-text');
const dialogOptionsEl = document.getElementById('dialog-options');
const messagesEl = document.getElementById('messages');

// ─── Message notification system ────────────────────────────────────
function addMsg(text) {
  const el = document.createElement('div');
  el.className = 'msg-toast';
  el.textContent = text;
  messagesEl.appendChild(el);
  // Max 3 messages
  while (messagesEl.children.length > 3) {
    messagesEl.removeChild(messagesEl.firstChild);
  }
  setTimeout(() => el.classList.add('fade'), 2400);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 10 — Discovery Journal & Location Labels
// ═══════════════════════════════════════════════════════════════════════

const spots = [
  { id: 'pier', name: 'OIB Pier', desc: 'The iconic Ocean Isle Beach fishing pier \u2014 extending into the Atlantic since 1959.', icon: '\ud83c\udfa3' },
  { id: 'minigolf', name: 'Pirate Mini Golf', desc: 'Pirate-themed mini golf near the roundabout. 18 holes of swashbuckling fun!', icon: '\u26f3' },
  { id: 'museum', name: 'Museum of Coastal Carolina', desc: 'Learn about the natural history of the Brunswick County coast.', icon: '\ud83c\udfdb' },
  { id: 'drift', name: 'Drift Coffee & Kitchen', desc: 'Local coffee shop with ocean vibes and great breakfast.', icon: '\u2615' },
  { id: 'park', name: 'The Park', desc: 'Green space in the heart of the island. Perfect for a quiet moment.', icon: '\ud83c\udf33' },
  { id: '59causeway', name: '59 Causeway', desc: 'Dining right on the causeway, attached to Sharky\'s.', icon: '\ud83c\udf7d' },
  { id: 'sharkys', name: 'Sharky\'s Restaurant', desc: 'Tucked near the bridge on the ICW. Fresh seafood and waterfront views.', icon: '\ud83e\udd9e' },
  { id: 'sheffields', name: 'Sheffield\'s Seafood & Grocery', desc: 'The island\'s go-to for gas, bait, frozen seafood, and beach snacks.', icon: '\ud83c\udfea' },
  { id: 'fishco', name: 'OIB Fish Company', desc: 'Fishing center on Causeway Drive. Charters, gear, and local knowledge.', icon: '\ud83c\udfa3' },
];

const discovered = new Set();
const journalHeaderEl = document.getElementById('journal-header');
const journalListEl = document.getElementById('journal-list');
const locationLabelEl = document.getElementById('location-label');

function discover(spotId) {
  if (discovered.has(spotId)) return;
  const spot = spots.find(s => s.id === spotId);
  if (!spot) return;
  discovered.add(spotId);
  addMsg(`\u2728 Discovered: ${spot.icon} ${spot.name}!`);
  updateJournal();
}

let allDiscoveredCelebrated = false;

function updateJournal() {
  const headerBase = `\ud83d\udcd6 Discovery Journal \u2014 ${discovered.size}/${spots.length}`;
  journalHeaderEl.textContent = discovered.size === spots.length ? headerBase + ' \u2728' : headerBase;
  while (journalListEl.firstChild) journalListEl.removeChild(journalListEl.firstChild);
  for (const spot of spots) {
    const entry = document.createElement('div');
    entry.className = 'journal-entry' + (discovered.has(spot.id) ? ' found' : '');
    entry.textContent = discovered.has(spot.id) ? `${spot.icon} ${spot.name}` : '??? Unknown';
    if (discovered.has(spot.id)) {
      const tooltip = document.createElement('div');
      tooltip.className = 'journal-tooltip';
      tooltip.textContent = spot.desc;
      entry.appendChild(tooltip);
    }
    journalListEl.appendChild(entry);
  }

  // Celebration when all spots discovered
  if (discovered.size === spots.length && !allDiscoveredCelebrated) {
    allDiscoveredCelebrated = true;
    setTimeout(() => addMsg('\ud83c\udf89 You\'ve discovered all of Ocean Isle Beach!'), 500);
  }
}

// Initialize journal
updateJournal();

// ─── Location name display ──────────────────────────────────────────
let lastArea = '';
let locationTimeout = null;

function getAreaName(row, col) {
  if (row >= 33 && row <= 35) return 'The Waterfront';
  if (row >= 22 && row <= 34 && col >= 25 && col <= 35) return 'Causeway Drive';
  if (row >= 18 && row <= 22 && col >= 15 && col <= 45) return 'The Park';
  if (row >= 11 && row <= 13 && col >= 27 && col <= 33) return 'The Roundabout';
  if (row >= 11 && row <= 12) return 'Main Street';
  if (row >= 7 && row <= 10) return 'The Beach';
  if (row >= 0 && row <= 6) return 'The Ocean';
  return '';
}

function updateLocationLabel() {
  const row = Math.floor(playerGroup.position.z);
  const col = Math.floor(playerGroup.position.x);
  const area = getAreaName(row, col);
  if (area && area !== lastArea) {
    lastArea = area;
    locationLabelEl.textContent = area;
    locationLabelEl.classList.add('visible');
    if (locationTimeout) clearTimeout(locationTimeout);
    locationTimeout = setTimeout(() => locationLabelEl.classList.remove('visible'), 2500);
  } else if (!area && lastArea) {
    lastArea = '';
    locationLabelEl.classList.remove('visible');
  }
}

// ─── Zone-based discovery triggers ──────────────────────────────────
function checkZoneDiscoveries() {
  const row = Math.floor(playerGroup.position.z);
  const col = Math.floor(playerGroup.position.x);
  const tile = getTile(playerGroup.position.x, playerGroup.position.z);

  // Pier discovery when stepping on PIER tile
  if (tile === TILE.PIER) discover('pier');

  // Park discovery when in park zone on grass
  if (row >= 18 && row <= 22 && col >= 15 && col <= 45 && tile === TILE.GRASS) {
    discover('park');
  }
}

// ─── Dialog content ─────────────────────────────────────────────────
const dialogs = {
  pier_pete: {
    text: '"Mornin\'! I\'m Old Pete. Been fishin\'\nthis pier for 40 years."',
    options: [
      { text: '\ud83c\udfa3 Any good catches today?', action: () => { addMsg('"Pulled in a 20lb red drum this morning!"'); discover('pier'); }},
      { text: '\u2753 Best fishing spots?', action: () => { addMsg('"Try the end of the pier at sunrise \u2014 flounder love it."'); discover('pier'); }},
      { text: '\ud83d\udc4b Nice to meet you, Pete!', action: () => { discover('pier'); }},
    ]
  },
  museum: {
    text: '"Welcome to the Museum of Coastal\nCarolina! We have exhibits on local\nmarine life and island history."',
    options: [
      { text: '\ud83d\udc1a Tell me about the exhibits', action: () => { addMsg('"We have a live touch tank and a loggerhead turtle exhibit!"'); discover('museum'); }},
      { text: '\ud83c\udfdb When was the museum built?', action: () => { addMsg('"We\'ve been here since 1999 \u2014 a real island gem."'); discover('museum'); }},
      { text: '\ud83d\udc4b Thanks!', action: () => { discover('museum'); }},
    ]
  },
  drift: {
    text: '"Hey! Welcome to Drift Coffee.\nWhat can I get started for you?"',
    options: [
      { text: '\u2615 What\'s your best drink?', action: () => { addMsg('"Our cold brew is legendary \u2014 perfect for a beach day."'); discover('drift'); }},
      { text: '\ud83e\udd50 Got any food?', action: () => { addMsg('"Fresh pastries and breakfast sandwiches every morning!"'); discover('drift'); }},
      { text: '\ud83d\udc4b Just browsing', action: () => { discover('drift'); }},
    ]
  },
  minigolf: {
    text: '"Arrr! Welcome to the mini golf!\n18 holes of pirate-themed fun!"',
    options: [
      { text: '\u26f3 How\'s the course?', action: () => { addMsg('"Best mini golf on the coast \u2014 real pirate ship on hole 9!"'); discover('minigolf'); }},
      { text: '\ud83c\udff4\u200d\u2620\ufe0f Love the pirate theme!', action: () => { addMsg('"Arrr, we take our theming seriously, matey!"'); discover('minigolf'); }},
      { text: '\ud83d\udc4b Maybe later', action: () => { discover('minigolf'); }},
    ]
  },
  '59causeway': {
    text: '"Welcome to 59 Causeway!\nGreat food, great views."',
    options: [
      { text: '\ud83c\udf7d What\'s good here?', action: () => { addMsg('"Everything \u2014 but the seafood platter is the move."'); discover('59causeway'); }},
      { text: '\ud83c\udf05 Nice location!', action: () => { addMsg('"Right on the causeway \u2014 can\'t beat the sunset views."'); discover('59causeway'); }},
      { text: '\ud83d\udc4b Thanks!', action: () => { discover('59causeway'); }},
    ]
  },
  sharkys: {
    text: '"Welcome to Sharky\'s! Tucked right\nunder the bridge on the waterway.\nFreshest seafood on the island."',
    options: [
      { text: '\ud83e\udd9e What\'s the catch of the day?', action: () => { addMsg('"Flounder, shrimp, and mahi \u2014 all off the boats today."'); discover('sharkys'); }},
      { text: '\ud83c\udf7a Great spot for a drink?', action: () => { addMsg('"Grab a seat on the back deck \u2014 watch the boats go by."'); discover('sharkys'); }},
      { text: '\ud83d\udc4b Thanks, Captain!', action: () => { discover('sharkys'); }},
    ]
  },
  sheffields: {
    text: '"Welcome to Sheffield\'s! We\'ve got\nbait, tackle, and frozen seafood.\nPlus snacks for the beach!"',
    options: [
      { text: '\ud83e\udea3 What bait do you recommend?', action: () => { addMsg('"Live shrimp for flounder, cut mullet for drum!"'); discover('sheffields'); }},
      { text: '\ud83e\uddca Check out the frozen seafood', action: () => { addMsg('"Fresh off the boats \u2014 shrimp, flounder, mahi."'); discover('sheffields'); }},
      { text: '\ud83d\udc4b Thanks!', action: () => { discover('sheffields'); }},
    ]
  },
  fishco: {
    text: '"OIB Fish Company \u2014 fishing charters,\ngear, and local knowledge.\nReady to catch the big one?"',
    options: [
      { text: '\ud83c\udfa3 Book a charter?', action: () => { addMsg('"We run offshore trips daily \u2014 king mackerel are running!"'); discover('fishco'); }},
      { text: '\ud83d\udc1f What\'s biting?', action: () => { addMsg('"Redfish in the ICW, flounder at the pier, kings offshore."'); discover('fishco'); }},
      { text: '\ud83d\udc4b Maybe next time', action: () => { discover('fishco'); }},
    ]
  },
};

// ─── Dialog UI functions ────────────────────────────────────────────
function openDialog(dialogKey) {
  const d = dialogs[dialogKey];
  if (!d) return;
  currentDialog = d;
  menuIndex = 0;
  dialogActive = true;
  dialogTextEl.textContent = d.text;
  renderDialogOptions();
  dialogEl.style.display = 'block';
  dialogBackdrop.style.display = 'block';
}

function renderDialogOptions() {
  if (!currentDialog) return;
  while (dialogOptionsEl.firstChild) dialogOptionsEl.removeChild(dialogOptionsEl.firstChild);
  currentDialog.options.forEach((opt, i) => {
    const li = document.createElement('li');
    li.textContent = opt.text;
    if (i === menuIndex) li.classList.add('selected');
    li.addEventListener('click', () => { menuIndex = i; selectDialogOption(); });
    dialogOptionsEl.appendChild(li);
  });
}

function selectDialogOption() {
  if (!currentDialog) return;
  const opt = currentDialog.options[menuIndex];
  closeDialog();
  if (opt && opt.action) opt.action();
}

function closeDialog() {
  dialogActive = false;
  currentDialog = null;
  dialogEl.style.display = 'none';
  dialogBackdrop.style.display = 'none';
}

// ─── Interaction logic ──────────────────────────────────────────────
function tryInteract() {
  if (dialogActive) return;
  const px = playerGroup.position.x;
  const pz = playerGroup.position.z;

  // 1. Check NPC proximity (distance < 2)
  for (const npc of npcs) {
    const ddx = px - npc.px;
    const ddz = pz - npc.pz;
    if (Math.sqrt(ddx * ddx + ddz * ddz) < 2) {
      openDialog(npc.def.dialog);
      return;
    }
  }

  // 2. Check building entrance proximity (distance < 3)
  for (const b of buildings) {
    const entranceX = b.x + b.w / 2;
    const entranceZ = b.z + b.d;
    const ddx = px - entranceX;
    const ddz = pz - entranceZ;
    if (Math.sqrt(ddx * ddx + ddz * ddz) < 3) {
      if (dialogs[b.type]) {
        openDialog(b.type);
      } else {
        addMsg(`${b.name} \u2014 looks interesting!`);
      }
      return;
    }
  }

  // 3. Beach tiles
  const row = Math.floor(pz);
  if (row >= 7 && row <= 10) {
    addMsg('The ocean breeze feels amazing. Nothing like OIB sand between your toes!');
    return;
  }

  // 4. Nothing nearby
  addMsg('Nothing to interact with here.');
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 5 — Buildings as Extruded Boxes
// ═══════════════════════════════════════════════════════════════════════

const buildings = [
  { x: 26, z: 14, w: 4, d: 3, name: '\u26f3 Pirate Mini Golf', wallColor: '#7ab87a', roofColor: '#4a8a4a', type: 'minigolf', height: 1.5 },
  { x: 20, z: 15, w: 4, d: 3, name: '\ud83c\udfdb Museum of Coastal Carolina', wallColor: '#e0d8c8', roofColor: '#8b6040', type: 'museum', height: 2.5 },
  { x: 34, z: 14, w: 4, d: 3, name: '\u2615 Drift Coffee & Kitchen', wallColor: '#d4b896', roofColor: '#884422', type: 'drift', height: 2 },
  { x: 27, z: 24, w: 5, d: 3, name: '\ud83c\udf7d 59 Causeway', wallColor: '#e8c090', roofColor: '#cc3333', type: '59causeway', height: 2 },
  { x: 27, z: 28, w: 6, d: 3, name: '\ud83e\udd9e Sharky\'s Restaurant', wallColor: '#d8e8d0', roofColor: '#2255aa', type: 'sharkys', height: 2.5 },
  { x: 22, z: 32, w: 4, d: 3, name: '\ud83c\udfea Sheffield\'s', wallColor: '#c8d8c0', roofColor: '#447744', type: 'sheffields', height: 2 },
  { x: 33, z: 32, w: 5, d: 3, name: '\ud83c\udfa3 OIB Fish Company', wallColor: '#c8d8e8', roofColor: '#224488', type: 'fishco', height: 2 },
];

// Mark building footprints as BUILDING on the map
buildings.forEach(b => {
  for (let r = b.z; r < b.z + b.d && r < MAP_H; r++) {
    for (let c = b.x; c < b.x + b.w && c < MAP_W; c++) {
      map[r][c] = TILE.BUILDING;
    }
  }
});

// Build each building
buildings.forEach(b => {
  const group = new THREE.Group();

  // Walls
  const wallGeo = new THREE.BoxGeometry(b.w, b.height, b.d);
  const wallMat = new THREE.MeshStandardMaterial({ color: b.wallColor });
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.position.set(b.x + b.w / 2, b.height / 2, b.z + b.d / 2);
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Roof (slight overhang)
  const roofGeo = new THREE.BoxGeometry(b.w + 0.3, 0.15, b.d + 0.3);
  const roofMat = new THREE.MeshStandardMaterial({ color: b.roofColor });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(b.x + b.w / 2, b.height + 0.075, b.z + b.d / 2);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Door (south face)
  const doorGeo = new THREE.BoxGeometry(0.5, 0.8, 0.05);
  const doorMat = new THREE.MeshStandardMaterial({ color: '#3a2a1a' });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(b.x + b.w / 2, 0.4, b.z + b.d + 0.02);
  group.add(door);

  // Windows flanking door
  const winGeo = new THREE.BoxGeometry(0.4, 0.4, 0.05);
  const winMat = new THREE.MeshStandardMaterial({ color: '#aaddff', emissive: '#446688', emissiveIntensity: 0.2 });
  [-1, 1].forEach(side => {
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(b.x + b.w / 2 + side * 1.0, 0.8, b.z + b.d + 0.02);
    group.add(win);
  });

  scene.add(group);

  // Floating label
  const div = document.createElement('div');
  div.textContent = b.name;
  div.style.cssText = 'color:#fff;font:bold 10px monospace;text-shadow:0 1px 3px rgba(0,0,0,0.8);white-space:nowrap;';
  const label = new CSS2DObject(div);
  label.position.set(b.x + b.w / 2, b.height + 0.8, b.z + b.d / 2);
  scene.add(label);
});

// ═══════════════════════════════════════════════════════════════════════
//  TASK 8 — NPCs with Patrol Routes
// ═══════════════════════════════════════════════════════════════════════

const npcDefs = [
  { x: 29, z: 5, name: 'Old Pete', color: '#cc4444', dialog: 'pier_pete', patrol: [[29,3],[29,7]] },
  { x: 21, z: 14, name: 'Museum Guide', color: '#44aa44', dialog: 'museum', patrol: [[21,13],[23,13]] },
  { x: 35, z: 14, name: 'Barista', color: '#77aadd', dialog: 'drift', patrol: [[34,13],[36,13]] },
  { x: 27, z: 12, name: 'Pirate Pete', color: '#884411', dialog: 'minigolf', patrol: [[26,12],[28,12]] },
  { x: 28, z: 26, name: 'Chef', color: '#ddaa33', dialog: '59causeway', patrol: [[27,25],[29,25]] },
  { x: 29, z: 30, name: 'Captain Ray', color: '#3366cc', dialog: 'sharkys', patrol: [[28,29],[31,29]] },
  { x: 28, z: 33, name: 'Clerk', color: '#ff99bb', dialog: 'sheffields', patrol: [[27,33],[29,33]] },
  { x: 34, z: 33, name: 'Captain Dave', color: '#224488', dialog: 'fishco', patrol: [[33,33],[36,33]] },
];

const npcs = npcDefs.map(def => {
  const sprite = makeBillboardSprite(def.color, '#2a2a2a');
  sprite.position.y = 0.6;

  const group = new THREE.Group();
  group.position.set(def.x + 0.5, 0, def.z + 0.5);
  group.add(sprite);

  // Name label
  const labelDiv = document.createElement('div');
  labelDiv.textContent = def.name;
  labelDiv.style.cssText = 'color:#fff;font:bold 10px monospace;text-shadow:0 1px 3px rgba(0,0,0,0.8);white-space:nowrap;';
  const label = new CSS2DObject(labelDiv);
  label.position.set(0, 1.5, 0);
  group.add(label);

  scene.add(group);

  return {
    def,
    group,
    sprite,
    px: def.x + 0.5,
    pz: def.z + 0.5,
    patrolIdx: 0,
    waitTimer: 0,
  };
});

function updateNPCs() {
  for (const npc of npcs) {
    // Billboard
    npc.sprite.quaternion.copy(camera.quaternion);

    if (npc.waitTimer > 0) {
      npc.waitTimer--;
      // Standing texture while waiting
      npc.sprite.material.map = npc.sprite.userData.texStand;
      npc.sprite.material.needsUpdate = true;
      continue;
    }

    const target = npc.def.patrol[npc.patrolIdx];
    const tx = target[0] + 0.5;
    const tz = target[1] + 0.5;
    const ddx = tx - npc.px;
    const ddz = tz - npc.pz;
    const dist = Math.sqrt(ddx * ddx + ddz * ddz);

    if (dist < 0.1) {
      npc.waitTimer = 120;
      npc.patrolIdx = (npc.patrolIdx + 1) % npc.def.patrol.length;
    } else {
      const spd = 0.02;
      npc.px += (ddx / dist) * spd;
      npc.pz += (ddz / dist) * spd;
      npc.group.position.set(npc.px, 0, npc.pz);

      // Walk animation
      npc.sprite.userData.animFrame = (npc.sprite.userData.animFrame || 0) + 1;
      if (npc.sprite.userData.animFrame % 10 === 0) {
        const useWalk = (Math.floor(npc.sprite.userData.animFrame / 10) % 2) === 1;
        npc.sprite.material.map = useWalk ? npc.sprite.userData.texWalk : npc.sprite.userData.texStand;
        npc.sprite.material.needsUpdate = true;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 6 — Load OIB Pier .glb Model
// ═══════════════════════════════════════════════════════════════════════

const gltfLoader = new GLTFLoader();
gltfLoader.load(
  'assets/oib-pier-clay.glb',
  (gltf) => {
    const pier = gltf.scene;
    pier.position.set(30, 0, 7);
    pier.scale.set(1.0, 1.0, 1.0);
    // Enable shadows on all meshes
    pier.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(pier);
    console.log('OIB Pier model loaded successfully');
  },
  undefined,
  (err) => {
    console.warn('Could not load pier model, skipping:', err);
  }
);

// ═══════════════════════════════════════════════════════════════════════
//  TASK 12 — Palm Trees
// ═══════════════════════════════════════════════════════════════════════

function createPalmTree() {
  const tree = new THREE.Group();

  // Trunk — slight lean
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#8b6914' });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1;
  trunk.rotation.x = 0.1;
  trunk.castShadow = true;
  tree.add(trunk);

  // Fronds group (for sway animation)
  const frondsGroup = new THREE.Group();
  frondsGroup.position.y = 2;

  const frondGeo = new THREE.PlaneGeometry(1.5, 0.3);
  const frondMat = new THREE.MeshStandardMaterial({ color: '#2a7c2a', side: THREE.DoubleSide });

  const frondCount = 6;
  for (let i = 0; i < frondCount; i++) {
    const frond = new THREE.Mesh(frondGeo, frondMat);
    const angle = (i / frondCount) * Math.PI * 2;
    frond.rotation.y = angle;
    frond.rotation.x = -0.8; // angle downward ~45 deg
    frond.position.set(
      Math.cos(angle) * 0.3,
      0,
      Math.sin(angle) * 0.3
    );
    frond.castShadow = true;
    frondsGroup.add(frond);
  }

  tree.add(frondsGroup);
  tree.frondsGroup = frondsGroup;

  // Coconuts
  const coconutGeo = new THREE.SphereGeometry(0.08, 6, 6);
  const coconutMat = new THREE.MeshStandardMaterial({ color: '#6b4226' });
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(coconutGeo, coconutMat);
    const a = (i / 3) * Math.PI * 2;
    nut.position.set(Math.cos(a) * 0.15, 1.85, Math.sin(a) * 0.15);
    tree.add(nut);
  }

  return tree;
}

// Hardcoded palm tree positions
const treePositions = [
  // Coastal road sides (row ~13 area)
  [5, 13], [10, 13], [15, 13], [40, 13], [45, 13], [50, 13], [55, 13],
  // Between buildings
  [18, 15], [25, 16], [32, 16], [38, 14],
  // Park area cluster (rows 18-22, cols 20-40)
  [20, 18], [25, 19], [30, 18], [35, 19], [22, 21], [28, 22], [33, 21],
  [38, 20], [40, 19], [17, 20],
  // Roundabout center
  [30, 12.5],
  // Scattered on grass
  [8, 16], [12, 25], [45, 18], [50, 22], [15, 30], [42, 28],
  // Near beach
  [8, 10.5], [20, 10.5], [40, 10.5], [52, 10.5],
];

const trees = [];
for (const [x, z] of treePositions) {
  const tree = createPalmTree();
  tree.position.set(x, 0, z);
  // Slight random rotation for variety
  tree.rotation.y = Math.random() * Math.PI * 2;
  scene.add(tree);
  trees.push(tree);
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 13 — Beach Props & Ambient Details
// ═══════════════════════════════════════════════════════════════════════

// ─── Beach Umbrellas ───────────────────────────────────────────────
const umbrellaColors = ['#ff4444', '#4488ff', '#44aa44', '#ffaa22'];
const umbrellaPositions = [
  [8, 8], [15, 9], [22, 8], [35, 9], [42, 8], [48, 9], [55, 8], [12, 9.5]
];

for (let i = 0; i < umbrellaPositions.length; i++) {
  const [ux, uz] = umbrellaPositions[i];
  const umbrellaGroup = new THREE.Group();

  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 4);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#6b4226' });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 0.5;
  umbrellaGroup.add(pole);

  // Canopy
  const canopyGeo = new THREE.ConeGeometry(0.5, 0.3, 8);
  const canopyMat = new THREE.MeshStandardMaterial({ color: umbrellaColors[i % umbrellaColors.length] });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 1.0;
  canopy.castShadow = true;
  umbrellaGroup.add(canopy);

  umbrellaGroup.position.set(ux, 0, uz);
  scene.add(umbrellaGroup);
}

// ─── Seagulls ──────────────────────────────────────────────────────
const seagulls = [];
const seagullMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });

for (let i = 0; i < 4; i++) {
  const gull = new THREE.Group();

  // Two wing planes forming a V
  const wingGeo = new THREE.PlaneGeometry(0.4, 0.08);
  const leftWing = new THREE.Mesh(wingGeo, seagullMat);
  leftWing.rotation.z = 0.3;
  leftWing.position.x = -0.15;
  gull.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, seagullMat);
  rightWing.rotation.z = -0.3;
  rightWing.position.x = 0.15;
  gull.add(rightWing);

  // Body dot
  const bodyGeo = new THREE.SphereGeometry(0.04, 4, 4);
  const body = new THREE.Mesh(bodyGeo, seagullMat);
  gull.add(body);

  gull.position.set(
    20 + i * 10,
    15 + Math.random() * 5,
    5 + Math.random() * 10
  );

  gull.userData.orbitRadius = 8 + Math.random() * 5;
  gull.userData.orbitSpeed = 0.15 + Math.random() * 0.1;
  gull.userData.orbitCenter = { x: gull.position.x, z: gull.position.z };
  gull.userData.leftWing = leftWing;
  gull.userData.rightWing = rightWing;

  scene.add(gull);
  seagulls.push(gull);
}

// ─── Boats on ICW ──────────────────────────────────────────────────
const boats = [];
for (let i = 0; i < 2; i++) {
  const boat = new THREE.Group();

  // Hull
  const hullGeo = new THREE.BoxGeometry(1.5, 0.3, 0.6);
  const hullMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.castShadow = true;
  boat.add(hull);

  // Cabin
  const cabinGeo = new THREE.BoxGeometry(0.5, 0.4, 0.4);
  const cabinMat = new THREE.MeshStandardMaterial({ color: '#4466aa' });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.y = 0.35;
  cabin.position.x = -0.2;
  cabin.castShadow = true;
  boat.add(cabin);

  boat.position.set(10 + i * 30, 0.15, 36.5);
  boat.userData.startX = boat.position.x;
  boat.userData.driftSpeed = 0.3 + i * 0.15;
  scene.add(boat);
  boats.push(boat);
}

// ─── Pier Flag ─────────────────────────────────────────────────────
const flagGroup = new THREE.Group();

const flagPoleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4);
const flagPoleMat = new THREE.MeshStandardMaterial({ color: '#333333' });
const flagPole = new THREE.Mesh(flagPoleGeo, flagPoleMat);
flagPole.position.y = 0.75;
flagGroup.add(flagPole);

const flagGeo = new THREE.PlaneGeometry(0.6, 0.4);
const flagMat = new THREE.MeshStandardMaterial({ color: '#cc2222', side: THREE.DoubleSide });
const flag = new THREE.Mesh(flagGeo, flagMat);
flag.position.set(0.3, 1.3, 0);
flagGroup.add(flag);

flagGroup.position.set(28, 0, 10.5); // Near pier entrance
scene.add(flagGroup);

// ─── Controls Hint ─────────────────────────────────────────────────
const controlsHintEl = document.createElement('div');
controlsHintEl.id = 'controls-hint';
controlsHintEl.textContent = 'WASD: Move | SPACE: Interact';
controlsHintEl.style.cssText = `
  position: fixed; bottom: 50px; left: 50%; transform: translateX(-50%);
  background: rgba(15,15,30,0.6); border: 1px solid rgba(80,80,120,0.3);
  border-radius: 8px; padding: 6px 16px; font: 11px monospace; color: rgba(255,255,255,0.5);
  z-index: 80; pointer-events: none; transition: opacity 0.6s ease; opacity: 1;
`;
document.getElementById('ui').appendChild(controlsHintEl);

let controlsHintVisible = true;
let firstMoveTime = 0;
let lastMoveTime = 0;
let playerHasMoved = false;

function updateControlsHint(elapsed) {
  const isMoving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD']
    || keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'];

  if (isMoving) {
    lastMoveTime = elapsed;
    if (!playerHasMoved) {
      playerHasMoved = true;
      firstMoveTime = elapsed;
    }
  }

  if (playerHasMoved && elapsed - firstMoveTime > 10 && controlsHintVisible) {
    controlsHintEl.style.opacity = '0';
    controlsHintVisible = false;
  }

  // Show again if idle > 15 seconds
  if (playerHasMoved && !isMoving && elapsed - lastMoveTime > 15 && !controlsHintVisible) {
    controlsHintEl.style.opacity = '1';
    controlsHintVisible = true;
    firstMoveTime = elapsed; // Reset so it can fade again
    playerHasMoved = false;
  }
}

function updateBeachProps(elapsed) {
  // Seagulls orbit and flap
  const hour = gameTime / 60;
  const dayTime = hour >= 8 && hour < 18;

  for (const gull of seagulls) {
    gull.visible = dayTime;
    if (!dayTime) continue;

    const t = elapsed * gull.userData.orbitSpeed;
    gull.position.x = gull.userData.orbitCenter.x + Math.cos(t) * gull.userData.orbitRadius;
    gull.position.z = gull.userData.orbitCenter.z + Math.sin(t) * gull.userData.orbitRadius;

    // Face direction of travel
    gull.rotation.y = -t + Math.PI / 2;

    // Wing flap
    const flap = Math.sin(elapsed * 4 + gull.userData.orbitRadius) * 0.4;
    gull.userData.leftWing.rotation.z = 0.3 + flap;
    gull.userData.rightWing.rotation.z = -0.3 - flap;
  }

  // Boats bob and drift
  for (let i = 0; i < boats.length; i++) {
    const boat = boats[i];
    boat.position.y = 0.15 + Math.sin(elapsed * 0.8 + i) * 0.05;
    boat.position.x += boat.userData.driftSpeed * 0.005;
    // Wrap when off screen
    if (boat.position.x > MAP_W + 5) {
      boat.position.x = -5;
    }
  }

  // Flag wave
  flag.rotation.y = Math.sin(elapsed * 2) * 0.3;
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 11 — Day/Night Cycle
// ═══════════════════════════════════════════════════════════════════════

let gameTime = 10 * 60; // start at 10:00 AM (in minutes)
let dayCount = 1;
const GAME_MINUTES_PER_REAL_SECOND = 1; // full day-night cycle = 24 real minutes

const clockEl = document.getElementById('game-clock');

// ─── Stars ─────────────────────────────────────────────────────────
const starCount = 100;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  starPositions[i * 3]     = (Math.random() - 0.5) * 80 + 30; // X spread around map center
  starPositions[i * 3 + 1] = 30 + Math.random() * 20;          // Y 30-50
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 60 + 20; // Z spread
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
const stars = new THREE.Points(starGeo, starMat);
stars.visible = false;
scene.add(stars);

// ─── Moon ──────────────────────────────────────────────────────────
const moonGeo = new THREE.SphereGeometry(1, 16, 16);
const moonMat = new THREE.MeshBasicMaterial({ color: '#ffffcc' });
const moon = new THREE.Mesh(moonGeo, moonMat);
moon.position.set(50, 35, 10);
moon.visible = false;
scene.add(moon);

// ─── Collect window meshes for night glow ──────────────────────────
// Windows already exist with emissive #446688. We'll store references to adjust intensity.
const windowMeshes = [];
scene.traverse(child => {
  if (child.isMesh && child.material && child.material.emissive) {
    const e = child.material.emissive;
    // Match window material color #aaddff
    if (child.material.color && Math.abs(child.material.color.r - 0.667) < 0.1
        && Math.abs(child.material.color.g - 0.867) < 0.1
        && Math.abs(child.material.color.b - 1.0) < 0.1) {
      // Clone material so we can adjust per-frame without affecting all
      child.material = child.material.clone();
      windowMeshes.push(child);
    }
  }
});

// ─── Sky color helpers ─────────────────────────────────────────────
const skyDay = new THREE.Color('#5bbfee');
const skySunset = new THREE.Color('#ff6622');
const skyNight = new THREE.Color('#0a0a2a');
const skyDawn = new THREE.Color('#ff9944');

const ambDay = new THREE.Color('#fff8e7');
const ambNight = new THREE.Color('#1a1a3a');

const sunColorDawn = new THREE.Color('#ffaa44');
const sunColorDay = new THREE.Color('#ffffff');
const sunColorSunset = new THREE.Color('#ff6622');
const sunColorNight = new THREE.Color('#334466');

const _tmpColor = new THREE.Color();
const _tmpColor2 = new THREE.Color();

function updateDayNight(delta, elapsed) {
  // Advance game clock
  gameTime += delta * GAME_MINUTES_PER_REAL_SECOND * 60;
  if (gameTime >= 1440) {
    gameTime -= 1440;
    dayCount++;
  }
  const hour = gameTime / 60;

  // ── Sun position ────────────────────────────────────────────────
  const sunAngle = ((hour - 6) / 12) * Math.PI; // 0 at 6am, PI at 6pm
  dirLight.position.set(
    30 + Math.cos(sunAngle) * 25,
    Math.sin(sunAngle) * 25 + 5,
    20 + Math.sin(sunAngle) * 10
  );

  // ── Sun color & intensity ──────────────────────────────────────
  if (hour >= 6 && hour < 8) {
    // Dawn
    const t = (hour - 6) / 2;
    dirLight.color.copy(sunColorDawn).lerp(sunColorDay, t);
    dirLight.intensity = 0.3 + t * 0.9;
  } else if (hour >= 8 && hour < 17) {
    // Day
    dirLight.color.copy(sunColorDay);
    dirLight.intensity = 1.2;
  } else if (hour >= 17 && hour < 20) {
    // Sunset
    const t = (hour - 17) / 3;
    dirLight.color.copy(sunColorDay).lerp(sunColorSunset, t);
    dirLight.intensity = 1.2 - t * 1.05;
  } else {
    // Night
    dirLight.color.copy(sunColorNight);
    dirLight.intensity = 0.15;
  }

  // ── Ambient light ──────────────────────────────────────────────
  if (hour >= 6 && hour < 8) {
    const t = (hour - 6) / 2;
    ambientLight.color.copy(ambNight).lerp(ambDay, t);
    ambientLight.intensity = 0.15 + t * 0.25;
  } else if (hour >= 8 && hour < 17) {
    ambientLight.color.copy(ambDay);
    ambientLight.intensity = 0.4;
  } else if (hour >= 17 && hour < 20) {
    const t = (hour - 17) / 3;
    ambientLight.color.copy(ambDay).lerp(ambNight, t);
    ambientLight.intensity = 0.4 - t * 0.25;
  } else {
    ambientLight.color.copy(ambNight);
    ambientLight.intensity = 0.15;
  }

  // ── Sky background ─────────────────────────────────────────────
  if (hour >= 8 && hour < 17) {
    scene.background.copy(skyDay);
  } else if (hour >= 17 && hour < 20) {
    const t = (hour - 17) / 3;
    scene.background.copy(skyDay).lerp(skySunset, t);
  } else if (hour >= 20 || hour < 4) {
    scene.background.copy(skyNight);
  } else if (hour >= 4 && hour < 6) {
    // Pre-dawn
    const t = (hour - 4) / 2;
    scene.background.copy(skyNight).lerp(skyDawn, t);
  } else if (hour >= 6 && hour < 8) {
    const t = (hour - 6) / 2;
    scene.background.copy(skyDawn).lerp(skyDay, t);
  }

  // ── Stars & moon ───────────────────────────────────────────────
  const isNight = hour >= 20 || hour < 6;
  stars.visible = isNight;
  moon.visible = isNight;
  if (isNight) {
    // Twinkle by adjusting size
    starMat.size = 0.25 + Math.sin(elapsed * 2) * 0.08;
    // Moon follows camera roughly
    moon.position.set(
      playerGroup.position.x + 20,
      35,
      playerGroup.position.z - 15
    );
  }

  // ── Window glow at night ───────────────────────────────────────
  const windowGlow = (hour >= 19 || hour < 6) ? 1.0 : 0.2;
  for (const win of windowMeshes) {
    win.material.emissiveIntensity = windowGlow;
  }

  // ── Clock UI ───────────────────────────────────────────────────
  const h = Math.floor(hour) % 24;
  const m = Math.floor(gameTime % 60);
  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  clockEl.textContent = `\ud83d\udd50 ${timeStr} \u2014 Day ${dayCount}`;
}

// ═══════════════════════════════════════════════════════════════════════
//  TASK 14 — Final Polish
// ═══════════════════════════════════════════════════════════════════════

// ─── Interaction Prompt ────────────────────────────────────────────
const interactPromptEl = document.getElementById('interact-prompt');

function updateInteractPrompt() {
  if (dialogActive) {
    interactPromptEl.classList.remove('visible');
    return;
  }

  const px = playerGroup.position.x;
  const pz = playerGroup.position.z;
  let promptText = '';

  // Check NPC proximity
  for (const npc of npcs) {
    const ddx = px - npc.px;
    const ddz = pz - npc.pz;
    if (Math.sqrt(ddx * ddx + ddz * ddz) < 2) {
      promptText = `Press SPACE \u2014 ${npc.def.name}`;
      break;
    }
  }

  // Check building proximity
  if (!promptText) {
    for (const b of buildings) {
      const entranceX = b.x + b.w / 2;
      const entranceZ = b.z + b.d;
      const ddx = px - entranceX;
      const ddz = pz - entranceZ;
      if (Math.sqrt(ddx * ddx + ddz * ddz) < 3) {
        promptText = `Press SPACE \u2014 ${b.name}`;
        break;
      }
    }
  }

  if (promptText) {
    interactPromptEl.textContent = promptText;
    interactPromptEl.classList.add('visible');
  } else {
    interactPromptEl.classList.remove('visible');
  }
}

// ─── Welcome Messages ──────────────────────────────────────────────
setTimeout(() => addMsg('\ud83c\udfd6 Welcome to Ocean Isle Beach, NC!'), 500);
setTimeout(() => addMsg('Explore the island and discover local spots!'), 1500);
setTimeout(() => addMsg('WASD to move, SPACE to interact'), 2500);

// ═══════════════════════════════════════════════════════════════════════
//  Animation Loop
// ═══════════════════════════════════════════════════════════════════════

const timer = new THREE.Timer();

function animate(timestamp) {
  requestAnimationFrame(animate);
  timer.update(timestamp);
  const delta = timer.getDelta();
  const elapsed = timer.getElapsed();

  // Water uniforms
  waterUniforms.uTime.value = elapsed;
  icwUniforms.uTime.value = elapsed;

  // Diamond bob
  diamond.position.y = 1.6 + Math.sin(elapsed * 3) * 0.1;
  diamond.rotation.y = elapsed * 2;

  // Player + Camera
  updatePlayer();
  updateCamera();

  // Billboard sprites face camera
  playerSprite.quaternion.copy(camera.quaternion);

  // NPC patrol + billboards
  updateNPCs();

  // Tree sway
  for (const tree of trees) {
    tree.frondsGroup.rotation.z = Math.sin(elapsed * 0.5 + tree.position.x * 0.3) * 0.05;
  }

  // Beach props & seagulls
  updateBeachProps(elapsed);
  updateControlsHint(elapsed);

  // Day/night cycle
  updateDayNight(delta, elapsed);

  // Zone discoveries & location label
  checkZoneDiscoveries();
  updateLocationLabel();

  // Interaction prompt
  updateInteractPrompt();

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();
