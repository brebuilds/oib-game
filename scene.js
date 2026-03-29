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
//  TASK 4 — Player Movement & Camera Follow
// ═══════════════════════════════════════════════════════════════════════

// Placeholder player
const playerGroup = new THREE.Group();
const playerBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 1.2, 0.4),
  new THREE.MeshStandardMaterial({ color: '#2288cc' })
);
playerBody.castShadow = true;
playerBody.position.y = 0.6;
playerGroup.add(playerBody);

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
window.addEventListener('keydown', e => { keys[e.code] = true; });
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
  if (keys['KeyW'] || keys['ArrowUp'])    dz = -1;
  if (keys['KeyS'] || keys['ArrowDown'])  dz =  1;
  if (keys['KeyA'] || keys['ArrowLeft'])  dx = -1;
  if (keys['KeyD'] || keys['ArrowRight']) dx =  1;

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
}

function updateCamera() {
  camera.position.x += (playerGroup.position.x - camera.position.x) * 0.05;
  camera.position.z += (playerGroup.position.z + 20 - camera.position.z) * 0.05;
  camera.position.y += (20 - camera.position.y) * 0.05;
  camera.lookAt(playerGroup.position.x, 0, playerGroup.position.z);
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

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();
