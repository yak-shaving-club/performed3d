// =========================================================================
// 7. THREE.JS 3D DRAGON SKY GATES & OBSTACLE SIMULATION ENGINE
// =========================================================================
// Cheap, allocation-free deterministic value-noise helpers for natural-looking procedural terrain.
// Optional `period` wraps the lattice so the result tiles seamlessly (used for textures).
function terrainHash2(ix, iy, period) {
    if (period) {
        ix = ((ix % period) + period) % period;
        iy = ((iy % period) + period) % period;
    }
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
}

function terrainValueNoise2(x, y, period) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = terrainHash2(ix, iy, period);
    const b = terrainHash2(ix + 1, iy, period);
    const c = terrainHash2(ix, iy + 1, period);
    const d = terrainHash2(ix + 1, iy + 1, period);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// Fractal Brownian motion in [0, 1]
function terrainFbm2(x, y, octaves, period) {
    let sum = 0, amp = 0.5, norm = 0, freq = 1;
    for (let o = 0; o < octaves; o++) {
        sum += terrainValueNoise2(x * freq, y * freq, period ? period * freq : 0) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum / norm;
}

// Ridged multifractal in [0, 1]: sharp crests and eroded gullies for alpine ranges
function terrainRidged2(x, y, octaves) {
    let sum = 0, amp = 0.5, norm = 0, freq = 1, weight = 1;
    for (let o = 0; o < octaves; o++) {
        let n = 1 - Math.abs(terrainValueNoise2(x * freq + o * 17.3, y * freq - o * 9.1) * 2 - 1);
        n *= n * weight;
        weight = Math.min(1, n * 2);
        sum += n * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2.03;
    }
    return sum / norm;
}

function terrainSmoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// Ground mesh lattice: vertices sit on a world-locked grid so geometry, colors and UVs never swim
const TERRAIN_GRID_WIDTH = 760;
const TERRAIN_GRID_SEGMENTS_X = 96;
const TERRAIN_GRID_CELL_Z = 8;
const TERRAIN_TEXTURE_TILE_SIZE = 32;
// Whole number of texture tiles; UV origin is re-based by this amount to keep float precision high
const TERRAIN_UV_REBASE_DISTANCE = TERRAIN_TEXTURE_TILE_SIZE * 64;

class DragonSky3DEngine {
    constructor(containerEl) {
        this.container = containerEl;
        this.initialized = false;
        this.flightZ = 0; // Continuous forward distance in 3D world units (halted until Start Flight is clicked)
        this.dragonCurrentY = GROUND_NEAR_TOUCH_ALTITUDE_Y;
        this.dragonVelocityY = 0;
        this.dragonSteerOffsetX = 0;
        this.dragonHeadingAngle = Math.atan(-getSimulatedTurnDerivativeX(0));
        this.dragonHeadingVelocity = 0;
        this.dragonLateralVelocityX = 0;
        this.wallContactSide = 0;
        this.dragonWorldX = getSimulatedTurnOffsetX(0);
        this.cameraCurrentY = GROUND_NEAR_TOUCH_ALTITUDE_Y + 2.2;
        this.cameraLookTargetY = 4.0;
        this.dragonBankAngle = 0;
        this.dragonRollAngle = 0;
        this.dragonPitchAngle = 0;
        this.wingFlapPhase = 0;

        this.gates = [];
        this.obstacles = [];
        this.dragonHunters = [];
        this.hunterArrows = [];
        this.fireballs = [];
        this.explosionFragments = [];
        this.trees = [];
        this.bushes = [];
        this.stones = [];
        this.clouds = [];
        this.birds = [];
        this.windAnimTime = 0;
        this.gateWindGeos = null;
        this.windBadgeTextureCache = new Map();
        this._windColBase = null;
        this._windColCrest = null;
        this.neckSegments = [];
        this.tailSegments = [];

        this.nextGateZ = -60;
        this.gateSpacingZ = 68;
        this.nextGateWorkoutSec = 0;
        this.baseElapsedSec = 0;
        this.lastSyncedElapsedSec = 0;
        this.subSec = 0;
        this.gateCounter = 0;
        this.lastClearedGateWorkoutSec = null;
        this.lastClearedGateAltitudeRatio = 0;

        this.initThreeScene();
    }

    initThreeScene() {
        if (typeof THREE === 'undefined' || !this.container) return;
        try {
            const width = Math.max(320, window.innerWidth || this.container.clientWidth || 1280);
            const height = Math.max(300, window.innerHeight || this.container.clientHeight || 720);

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x091526);
            this.scene.fog = new THREE.FogExp2(0x122640, 0.0022);

            this.camera = new THREE.PerspectiveCamera(68, width / height, 0.5, 750);
            this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.shadowMap.enabled = true;

            this.container.innerHTML = '';
            this.container.appendChild(this.renderer.domElement);

            // Sky Lighting
            const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x064e3b, 1.05);
            hemiLight.position.set(0, 120, 0);
            this.scene.add(hemiLight);

            const sunLight = new THREE.DirectionalLight(0xfef08a, 1.35);
            sunLight.position.set(60, 130, -80);
            this.scene.add(sunLight);

            const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
            rimLight.position.set(-50, 40, 60);
            this.scene.add(rimLight);

            this.buildTexturedSkyAndStars();
            this.buildGroundAndMountains();
            this.buildForestTrees();
            this.buildForestBushes();
            this.buildTerrainStones();
            this.buildVolumetricClouds();
            this.buildFlockOfBirds();
            this.ensureGateWindResources();
            this.buildActiveAvatar(state.avatarType || 'aero_wyvern');
            this.seedInitialGatesAndObstacles();

            window.addEventListener('resize', () => this.handleResize());
            this.initialized = true;
        } catch (err) {
            console.warn('Three.js initialization fallback:', err);
        }
    }

    handleResize() {
        if (!this.initialized || !this.container) return;
        const width = Math.max(320, window.innerWidth || this.container.clientWidth);
        const height = Math.max(300, window.innerHeight || this.container.clientHeight);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    createSkyDomeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Deep cosmic twilight-to-zenith vertical sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGrad.addColorStop(0.0, '#020617');
        skyGrad.addColorStop(0.28, '#071126');
        skyGrad.addColorStop(0.55, '#0f2342');
        skyGrad.addColorStop(0.78, '#17335c');
        skyGrad.addColorStop(1.0, '#1e3a5f');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Nebula & Milky Way atmospheric bands across the upper hemisphere
        const nebulaBands = [
            { x: 260, y: 120, rx: 320, ry: 75, rot: -0.22, c1: 'rgba(56, 189, 248, 0.16)', c2: 'rgba(139, 92, 246, 0.06)' },
            { x: 680, y: 150, rx: 360, ry: 85, rot: 0.18, c1: 'rgba(168, 85, 247, 0.15)', c2: 'rgba(236, 72, 153, 0.05)' },
            { x: 512, y: 95, rx: 440, ry: 55, rot: -0.08, c1: 'rgba(16, 185, 129, 0.13)', c2: 'rgba(56, 189, 248, 0.04)' },
            { x: 840, y: 210, rx: 240, ry: 60, rot: -0.28, c1: 'rgba(250, 204, 21, 0.10)', c2: 'rgba(249, 115, 22, 0.03)' }
        ];
        nebulaBands.forEach((b) => {
            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.rot);
            ctx.scale(1, b.ry / b.rx);
            const radGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, b.rx);
            radGrad.addColorStop(0.0, b.c1);
            radGrad.addColorStop(0.55, b.c2);
            radGrad.addColorStop(1.0, 'rgba(2, 6, 23, 0)');
            ctx.fillStyle = radGrad;
            ctx.beginPath();
            ctx.arc(0, 0, b.rx, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Crisp baked star clusters and cosmic dust specks in the sky texture
        for (let i = 0; i < 900; i++) {
            const sx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * canvas.width;
            const sy = Math.pow(Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5, 1.35) * (canvas.height * 0.72);
            const radius = (i % 19 === 0) ? 1.8 : (i % 5 === 0 ? 1.15 : 0.7);
            const alpha = 0.25 + ((i * 37) % 75) / 100;
            const palette = ['#ffffff', '#e0f2fe', '#fef08a', '#ddd6fe', '#fed7aa'];
            ctx.fillStyle = palette[i % palette.length];
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    buildTexturedSkyAndStars() {
        this.skyGroup = new THREE.Group();

        // 1. Textured Skybox Dome with Nebula, Aurora & Starfield CanvasTexture
        const skyDomeGeo = new THREE.SphereGeometry(680, 36, 24);
        const skyDomeMat = new THREE.MeshBasicMaterial({
            map: this.createSkyDomeTexture(),
            side: THREE.BackSide,
            depthWrite: false,
            fog: false
        });
        this.skyDomeMesh = new THREE.Mesh(skyDomeGeo, skyDomeMat);
        this.skyGroup.add(this.skyDomeMesh);

        // 2. 3D Starfield Point Cloud in the upper sky dome
        const starCount = 650;
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);
        const starPalette = [
            new THREE.Color(0xffffff),
            new THREE.Color(0xbae6fd),
            new THREE.Color(0xfef08a),
            new THREE.Color(0xe9d5ff),
            new THREE.Color(0xfed7aa)
        ];

        for (let i = 0; i < starCount; i++) {
            const theta = ((i * 2.39996) % (Math.PI * 2));
            const u = 0.14 + ((i * 0.618034) % 0.84);
            const phi = Math.acos(u); // Upper hemisphere above horizon
            const radius = 560 + (i % 7) * 14;

            starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            starPositions[i * 3 + 1] = radius * Math.cos(phi) + 12;
            starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

            const c = starPalette[i % starPalette.length];
            starColors[i * 3] = c.r;
            starColors[i * 3 + 1] = c.g;
            starColors[i * 3 + 2] = c.b;
        }

        const starsGeo = new THREE.BufferGeometry();
        starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starsGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

        this.starsMat = new THREE.PointsMaterial({
            size: 3.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            fog: false
        });
        this.starFieldPoints = new THREE.Points(starsGeo, this.starsMat);
        this.skyGroup.add(this.starFieldPoints);

        this.scene.add(this.skyGroup);
    }

    createTerrainSurfaceTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const size = canvas.width;

        // Seamlessly tiling, neutral-gray natural ground grain (soil clumps, turf, fine grit) generated
        // once at startup; vertex colors tint it per biome so no extra textures or draw calls are needed.
        const img = ctx.createImageData(size, size);
        const data = img.data;
        const basePeriod = 8;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = (x / size) * basePeriod;
                const v = (y / size) * basePeriod;
                const clumps = terrainFbm2(u, v, 4, basePeriod);
                const fine = terrainValueNoise2(u * 16, v * 16, basePeriod * 16);
                const grit = terrainHash2(x, y, size);
                const shade = 0.84 + (clumps - 0.5) * 0.42 + (fine - 0.5) * 0.12 + (grit - 0.5) * 0.08;
                const c = Math.max(0, Math.min(255, shade * 255));
                const idx = (y * size + x) * 4;
                // Slight warm earthy bias so the ground doesn't look plastic
                data[idx] = Math.min(255, c * 1.02);
                data[idx + 1] = c;
                data[idx + 2] = c * 0.94;
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);

        // Tiny grass blades and pebbles for close-range detail
        for (let i = 0; i < 2600; i++) {
            const px = 3 + terrainHash2(i, 11) * (size - 6);
            const py = 3 + terrainHash2(i, 23) * (size - 6);
            if (i % 4 === 0) {
                ctx.fillStyle = terrainHash2(i, 37) > 0.5 ? 'rgba(40, 32, 24, 0.22)' : 'rgba(255, 250, 240, 0.16)';
                ctx.beginPath();
                ctx.arc(px, py, 0.8 + terrainHash2(i, 41) * 1.4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const angle = (terrainHash2(i, 53) - 0.5) * 0.9;
                const len = 2 + terrainHash2(i, 67) * 3;
                ctx.strokeStyle = terrainHash2(i, 79) > 0.55 ? 'rgba(20, 30, 14, 0.18)' : 'rgba(250, 255, 235, 0.12)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + Math.sin(angle) * len, py - Math.cos(angle) * len);
                ctx.stroke();
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        // UVs are computed from world coordinates (1 UV unit = TERRAIN_TEXTURE_TILE_SIZE world units)
        texture.repeat.set(1, 1);
        // Anisotropic filtering keeps the ground crisp at grazing angles at negligible GPU cost
        if (this.renderer && this.renderer.capabilities) {
            texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        }
        return texture;
    }

    createRiverWaterTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Natural cross-channel water depth gradient: shallow turquoise edges to deep alpine blue-teal center
        const channelGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        channelGrad.addColorStop(0.0, 'rgba(56, 189, 248, 0.72)');
        channelGrad.addColorStop(0.08, 'rgba(14, 165, 233, 0.88)');
        channelGrad.addColorStop(0.24, '#0284c7');
        channelGrad.addColorStop(0.50, '#0369a1');
        channelGrad.addColorStop(0.76, '#0284c7');
        channelGrad.addColorStop(0.92, 'rgba(14, 165, 233, 0.88)');
        channelGrad.addColorStop(1.0, 'rgba(56, 189, 248, 0.72)');
        ctx.fillStyle = channelGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Submerged riverbed pebbles & darker depth eddies visible through clear alpine water
        for (let i = 0; i < 420; i++) {
            const px = (Math.sin(i * 97.3 + 13.7) * 0.5 + 0.5) * canvas.width;
            const py = (Math.cos(i * 151.9 + 29.1) * 0.5 + 0.5) * canvas.height;
            const distFromEdge = Math.min(px, canvas.width - px) / (canvas.width * 0.5);
            const rx = 3 + (i % 6) * 2.4;
            const ry = 4 + ((i * 3) % 7) * 2.8;
            ctx.fillStyle = (distFromEdge < 0.32)
                ? 'rgba(120, 113, 108, 0.18)'
                : ((i % 2 === 0) ? 'rgba(7, 89, 133, 0.22)' : 'rgba(20, 184, 166, 0.14)');
            ctx.beginPath();
            ctx.ellipse(px, py, rx, ry, (i % 5) * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Organic flowing current ribbons and caustic light bands
        for (let band = 0; band < 18; band++) {
            const baseX = (band + 0.5) * (canvas.width / 18);
            ctx.strokeStyle = (band % 3 === 0)
                ? 'rgba(186, 230, 253, 0.22)'
                : 'rgba(56, 189, 248, 0.18)';
            ctx.lineWidth = 2.5 + (band % 3) * 1.4;
            ctx.beginPath();
            for (let y = 0; y <= canvas.height; y += 16) {
                const waveX = baseX + Math.sin(y * 0.036 + band * 1.3) * 11 + Math.cos(y * 0.073 - band) * 5;
                if (y === 0) ctx.moveTo(waveX, y);
                else ctx.lineTo(waveX, y);
            }
            ctx.stroke();
        }

        // Rippling current streaks, whitewater rapids, and shoreline foam highlights
        for (let i = 0; i < 340; i++) {
            const x = (Math.sin(i * 73.1) * 0.5 + 0.5) * canvas.width;
            const y = (Math.cos(i * 139.7) * 0.5 + 0.5) * canvas.height;
            const edgeFactor = Math.abs(x - canvas.width * 0.5) / (canvas.width * 0.5);
            const len = 16 + (i % 6) * 14;
            const isFoam = (i % 4 === 0) || edgeFactor > 0.82;
            ctx.strokeStyle = isFoam ? 'rgba(240, 249, 255, 0.52)' : 'rgba(125, 211, 252, 0.34)';
            ctx.lineWidth = isFoam ? (1.8 + (i % 2) * 1.1) : (1.2 + (i % 3) * 0.8);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(
                x + Math.sin(i) * 6,
                y + len * 0.33,
                x - Math.cos(i) * 6,
                y + len * 0.66,
                x + Math.sin(i * 0.5) * 3,
                y + len
            );
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 24);
        return texture;
    }

    createTreeBarkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Vertical fissured bark ridges and craggy wood grain
        for (let x = 0; x < canvas.width; x += 4) {
            const ridgeShade = (x % 8 === 0) ? 'rgba(30, 15, 6, 0.42)' : 'rgba(146, 98, 57, 0.25)';
            ctx.strokeStyle = ridgeShade;
            ctx.lineWidth = 2 + (x % 3);
            ctx.beginPath();
            for (let y = 0; y <= canvas.height; y += 12) {
                const offset = Math.sin(y * 0.08 + x * 0.15) * 3.2;
                if (y === 0) ctx.moveTo(x + offset, y);
                else ctx.lineTo(x + offset, y);
            }
            ctx.stroke();
        }

        // Bark knots, crevices, and subtle lichen patches
        for (let i = 0; i < 240; i++) {
            const bx = (Math.sin(i * 83.7 + 19.1) * 0.5 + 0.5) * canvas.width;
            const by = (Math.cos(i * 137.3 + 47.9) * 0.5 + 0.5) * canvas.height;
            const w = 2 + (i % 4) * 2;
            const h = 6 + (i % 7) * 3;
            ctx.fillStyle = (i % 9 === 0)
                ? 'rgba(77, 124, 79, 0.28)'
                : ((i % 2 === 0) ? 'rgba(28, 14, 5, 0.36)' : 'rgba(120, 74, 38, 0.28)');
            ctx.fillRect(bx, by, w, h);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 3);
        return texture;
    }

    createTreeFoliageTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Neutral bright botanical base so material color tints pine needles and broadleaf canopies cleanly
        ctx.fillStyle = '#b8d8be';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Layered pine needle clusters and dappled leaf shadows
        for (let i = 0; i < 1100; i++) {
            const fx = (Math.sin(i * 113.1 + 7.9) * 0.5 + 0.5) * canvas.width;
            const fy = (Math.cos(i * 179.3 + 31.7) * 0.5 + 0.5) * canvas.height;
            const radius = 2.2 + (i % 5) * 1.4;
            if (i % 3 === 0) {
                ctx.fillStyle = 'rgba(15, 45, 28, 0.28)';
            } else if (i % 3 === 1) {
                ctx.fillStyle = 'rgba(236, 253, 245, 0.26)';
            } else {
                ctx.fillStyle = 'rgba(52, 118, 74, 0.24)';
            }
            ctx.beginPath();
            ctx.ellipse(fx, fy, radius * 1.4, radius * 0.75, (i * 0.618) % Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Crisp needle striations
        for (let i = 0; i < 500; i++) {
            const nx = (Math.sin(i * 67.3 + 53.1) * 0.5 + 0.5) * canvas.width;
            const ny = (Math.cos(i * 109.7 + 11.3) * 0.5 + 0.5) * canvas.height;
            const angle = ((i * 1.91) % Math.PI) - Math.PI * 0.5;
            ctx.strokeStyle = (i % 2 === 0) ? 'rgba(6, 38, 22, 0.30)' : 'rgba(209, 250, 229, 0.25)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(nx, ny);
            ctx.lineTo(nx + Math.cos(angle) * 6, ny + Math.sin(angle) * 6);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 3);
        return texture;
    }

    createStoneSurfaceTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Crystalline granite speckles, mineral veins, and weathered rock pores
        for (let i = 0; i < 1600; i++) {
            const sx = (Math.sin(i * 101.3 + 23.5) * 0.5 + 0.5) * canvas.width;
            const sy = (Math.cos(i * 163.7 + 61.9) * 0.5 + 0.5) * canvas.height;
            const sz = 1.5 + (i % 5) * 1.6;
            if (i % 4 === 0) {
                ctx.fillStyle = 'rgba(17, 24, 39, 0.30)';
            } else if (i % 4 === 1) {
                ctx.fillStyle = 'rgba(243, 244, 246, 0.28)';
            } else if (i % 4 === 2) {
                ctx.fillStyle = 'rgba(75, 85, 99, 0.25)';
            } else {
                ctx.fillStyle = 'rgba(156, 163, 175, 0.22)';
            }
            ctx.fillRect(sx, sy, sz, sz * (0.8 + (i % 3) * 0.3));
        }

        // Fracture lines and mineral quartz seams
        for (let k = 0; k < 28; k++) {
            let cx = (Math.sin(k * 43.1) * 0.5 + 0.5) * canvas.width;
            let cy = (Math.cos(k * 79.7) * 0.5 + 0.5) * canvas.height;
            ctx.strokeStyle = (k % 3 === 0) ? 'rgba(229, 231, 235, 0.35)' : 'rgba(31, 41, 55, 0.38)';
            ctx.lineWidth = 1.0 + (k % 2) * 0.8;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            for (let step = 0; step < 5; step++) {
                cx += Math.cos(k * 1.7 + step * 1.1) * 18;
                cy += Math.sin(k * 2.3 - step * 0.9) * 18;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    }

    /**
     * Evaluates natural meandering width and lateral micro-meander of the river at worldZ.
     */
    getRiverChannelProfileAtZ(worldZ) {
        const widthScale = 1.0
            + Math.sin(worldZ * 0.029 + 0.7) * 0.16
            + Math.cos(worldZ * 0.067 - 1.4) * 0.09;
        const meanderShiftX = Math.sin(worldZ * 0.043 + 1.1) * 1.35
            + Math.cos(worldZ * 0.089 - 0.5) * 0.55;
        const halfWidth = 8.5 * widthScale;
        return { widthScale, meanderShiftX, halfWidth };
    }

    /**
     * Evaluates complex multi-octave procedural terrain height at a given localX offset from
     * the canyon center and worldZ coordinate along the flight course.
     */
    getTerrainElevationAt(localX, worldZ) {
        const riverProfile = this.getRiverChannelProfileAtZ(worldZ);
        const relRiverX = localX - riverProfile.meanderShiftX;
        const distFromRiver = Math.abs(relRiverX);
        const riverHalfW = riverProfile.halfWidth;
        if (distFromRiver <= riverHalfW) {
            // Concave natural riverbed channel trough in the center of the canyon
            const normChannel = distFromRiver / Math.max(1.0, riverHalfW);
            return -0.68 + normChannel * normChannel * 0.42;
        }

        // Smooth riverbank transition into rolling valley floor
        const bankBlend = Math.min(1.0, Math.max(0.0, (distFromRiver - riverHalfW) / 18.0));
        const distFromCenter = Math.abs(localX);

        // Low-frequency domain warp breaks up regular patterns so landforms look organic
        const warpX = (terrainValueNoise2(localX * 0.012 + 31.7, worldZ * 0.012) - 0.5) * 30.0;
        const warpZ = (terrainValueNoise2(localX * 0.012, worldZ * 0.012 - 57.1) - 0.5) * 30.0;
        const wx = localX + warpX;
        const wz = worldZ + warpZ;

        // Fractal rolling meadows with a gentle rise toward the valley sides
        const rollingHills = (
            (terrainFbm2(wx * 0.022, wz * 0.022, 4) - 0.42) * 9.0
            + Math.max(0, distFromCenter - 10) * 0.05
        ) * bankBlend;

        // Steep canyon walls & eroded alpine ranges rising on both sides
        let mountainRise = 0;
        if (distFromCenter > 26) {
            const outDist = distFromCenter - 26;
            const baseWall = Math.pow(outDist * 0.135, 1.52);

            // Ridged multifractal: sharp crests, spurs and eroded gullies
            const ridges = terrainRidged2(wx * 0.011, wz * 0.011, 5);
            const jaggedPeaks = ridges * 42.0 * Math.min(1.8, outDist / 52.0);

            // Subtle stratified cliff ledges along the canyon walls
            const terraceWave = Math.sin(baseWall * 0.55) * 1.2;

            mountainRise = baseWall + jaggedPeaks + terraceWave;
        }

        return (rollingHills + mountainRise) * bankBlend;
    }

    /**
     * Height of the rendered, piecewise-linear ground mesh at (localX, worldZ). Ground vertices sit on a
     * world-locked lattice, so sampling the same triangles keeps vegetation and rocks exactly on the surface
     * instead of floating above or sinking into the coarser mesh.
     */
    getRenderedGroundHeightAt(localX, worldZ) {
        const cellX = TERRAIN_GRID_WIDTH / TERRAIN_GRID_SEGMENTS_X;
        const halfW = TERRAIN_GRID_WIDTH / 2;
        const gx = (localX + halfW) / cellX;
        const gz = worldZ / TERRAIN_GRID_CELL_Z;
        const ix = Math.max(0, Math.min(TERRAIN_GRID_SEGMENTS_X - 1, Math.floor(gx)));
        const iz = Math.floor(gz);
        const fx = Math.max(0, Math.min(1, gx - ix));
        const fz = gz - iz;
        const x0 = -halfW + ix * cellX;
        const x1 = x0 + cellX;
        const z0 = iz * TERRAIN_GRID_CELL_Z;
        const z1 = z0 + TERRAIN_GRID_CELL_Z;
        const hA = this.getTerrainElevationAt(x0, z0);
        const hB = this.getTerrainElevationAt(x0, z1);
        const hC = this.getTerrainElevationAt(x1, z1);
        const hD = this.getTerrainElevationAt(x1, z0);
        // PlaneGeometry splits every cell along the (x0, z1)-(x1, z0) diagonal
        if (fx + fz <= 1) return hA + (hD - hA) * fx + (hB - hA) * fz;
        return hC + (hB - hC) * (1 - fx) + (hD - hC) * (1 - fz);
    }

    /**
     * Averages normals of coincident vertices so non-indexed primitives (e.g. icosahedrons) shade smoothly
     * instead of looking faceted. Runs once per shared geometry at startup.
     */
    smoothGeometryNormals(geo) {
        geo.computeVertexNormals();
        const pos = geo.attributes.position;
        const nor = geo.attributes.normal;
        const keys = new Array(pos.count);
        const sums = new Map();
        for (let i = 0; i < pos.count; i++) {
            const k = Math.round(pos.getX(i) * 1000) + '_' + Math.round(pos.getY(i) * 1000) + '_' + Math.round(pos.getZ(i) * 1000);
            keys[i] = k;
            let acc = sums.get(k);
            if (!acc) {
                acc = [0, 0, 0];
                sums.set(k, acc);
            }
            acc[0] += nor.getX(i);
            acc[1] += nor.getY(i);
            acc[2] += nor.getZ(i);
        }
        for (let i = 0; i < pos.count; i++) {
            const acc = sums.get(keys[i]);
            const len = Math.hypot(acc[0], acc[1], acc[2]) || 1;
            nor.setXYZ(i, acc[0] / len, acc[1] / len, acc[2] / len);
        }
        nor.needsUpdate = true;
        return geo;
    }

    /**
     * Bakes parts ({ geometry, matrix, color, ao, topTint }) into one non-indexed geometry with vertex colors,
     * so a whole tree / bush / rock outcrop renders with a single draw call per material.
     * - ao: darkening toward the bottom of the merged object (cheap fake self-shadowing)
     * - topTint: { color, amount } blended onto upward-facing surfaces (moss, sun-bleached tips)
     */
    mergeColoredParts(parts) {
        const prepared = parts.map((p) => {
            const g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone();
            g.applyMatrix4(p.matrix);
            return { g, p };
        });
        let total = 0;
        let minY = Infinity;
        let maxY = -Infinity;
        prepared.forEach(({ g }) => {
            const pa = g.attributes.position;
            total += pa.count;
            for (let i = 0; i < pa.count; i++) {
                const y = pa.getY(i);
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        });
        const heightRange = Math.max(0.001, maxY - minY);

        const positions = new Float32Array(total * 3);
        const normals = new Float32Array(total * 3);
        const uvs = new Float32Array(total * 2);
        const colors = new Float32Array(total * 3);
        const tint = new THREE.Color();
        let offset = 0;
        prepared.forEach(({ g, p }) => {
            const pa = g.attributes.position;
            const na = g.attributes.normal;
            const ua = g.attributes.uv;
            for (let i = 0; i < pa.count; i++) {
                const o = offset + i;
                const x = pa.getX(i);
                const y = pa.getY(i);
                const z = pa.getZ(i);
                const ny = na ? na.getY(i) : 1;
                positions[o * 3] = x;
                positions[o * 3 + 1] = y;
                positions[o * 3 + 2] = z;
                normals[o * 3] = na ? na.getX(i) : 0;
                normals[o * 3 + 1] = ny;
                normals[o * 3 + 2] = na ? na.getZ(i) : 0;
                uvs[o * 2] = ua ? ua.getX(i) : 0;
                uvs[o * 2 + 1] = ua ? ua.getY(i) : 0;

                tint.copy(p.color);
                if (p.topTint) {
                    tint.lerp(p.topTint.color, terrainSmoothstep(0.45, 0.95, ny) * p.topTint.amount);
                }
                const heightT = (y - minY) / heightRange;
                const ao = 1.0 - (p.ao || 0) * (1.0 - heightT);
                const skyFacing = 0.84 + 0.16 * (0.5 + 0.5 * ny);
                // Position-keyed jitter so coincident vertices stay identical (no seams)
                const jitter = 0.9 + terrainHash2(Math.round(x * 40 + y * 13), Math.round(z * 40 - y * 29)) * 0.2;
                const shade = ao * skyFacing * jitter;
                colors[o * 3] = Math.min(1, tint.r * shade);
                colors[o * 3 + 1] = Math.min(1, tint.g * shade);
                colors[o * 3 + 2] = Math.min(1, tint.b * shade);
            }
            offset += pa.count;
            g.dispose();
        });

        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        merged.computeBoundingSphere();
        return merged;
    }

    buildGroundAndMountains() {
        // Complex Multi-Octave Textured Valley & Mountain Terrain locked in world coordinates
        const groundGeo = new THREE.PlaneGeometry(TERRAIN_GRID_WIDTH, 800, TERRAIN_GRID_SEGMENTS_X, 800 / TERRAIN_GRID_CELL_Z);
        groundGeo.rotateX(-Math.PI / 2);
        const gPos = groundGeo.attributes.position;
        this.groundBaseCoords = new Float32Array(gPos.count * 2);
        const gColors = new Float32Array(gPos.count * 3);
        for (let i = 0; i < gPos.count; i++) {
            this.groundBaseCoords[i * 2] = gPos.getX(i);
            this.groundBaseCoords[i * 2 + 1] = gPos.getZ(i);
            gColors[i * 3] = 0.05;
            gColors[i * 3 + 1] = 0.45;
            gColors[i * 3 + 2] = 0.32;
        }
        groundGeo.setAttribute('color', new THREE.BufferAttribute(gColors, 3));
        // Per-vertex scratch buffers reused every canyon update (no per-frame allocations)
        this.groundElevScratch = new Float32Array(gPos.count);
        this.groundShoreScratch = new Float32Array(gPos.count);

        this.terrainTexture = this.createTerrainSurfaceTexture();
        // Smooth-shaded matte ground: natural slopes instead of faceted low-poly look, same vertex count
        const groundMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: this.terrainTexture,
            vertexColors: true,
            specular: 0x0a0d10,
            shininess: 6,
            flatShading: false
        });
        this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
        this.groundMesh.frustumCulled = false;
        this.groundMesh.position.set(0, 0, -280);
        this.scene.add(this.groundMesh);

        // Winding Textured River Ribbon fixed in world coordinates in the exact middle of the canyon
        const riverGeo = new THREE.PlaneGeometry(17, 800, 18, 120);
        riverGeo.rotateX(-Math.PI / 2);
        const rPos = riverGeo.attributes.position;
        this.riverBaseCoords = new Float32Array(rPos.count * 2);
        const rColors = new Float32Array(rPos.count * 3);
        for (let i = 0; i < rPos.count; i++) {
            const rx = rPos.getX(i);
            const rz = rPos.getZ(i);
            this.riverBaseCoords[i * 2] = rx;
            this.riverBaseCoords[i * 2 + 1] = rz;
            const edgeRatio = Math.min(1.0, Math.abs(rx) / 8.5);
            // Deeper sapphire-teal center transitioning to bright foam-tinted turquoise shallows
            rColors[i * 3] = 0.12 + edgeRatio * 0.55;
            rColors[i * 3 + 1] = 0.62 + edgeRatio * 0.30;
            rColors[i * 3 + 2] = 0.88 + edgeRatio * 0.12;
        }
        riverGeo.setAttribute('color', new THREE.BufferAttribute(rColors, 3));
        this.riverTexture = this.createRiverWaterTexture();
        const riverMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: this.riverTexture,
            vertexColors: true,
            emissive: 0x0369a1,
            emissiveIntensity: 0.32,
            specular: 0xe0f2fe,
            shininess: 110,
            transparent: true,
            opacity: 0.92
        });
        this.riverMesh = new THREE.Mesh(riverGeo, riverMat);
        this.riverMesh.frustumCulled = false;
        this.riverMesh.position.set(0, 0.35, -280);
        this.scene.add(this.riverMesh);

        this.lastCanyonAnchorZ = null;
        this.updateCanyonAndRiverWorldGeometry(0, true);
    }

    /**
     * Updates the canyon ground and river vertices in quantized 8-unit world Z steps
     * so that at every worldZ coordinate, the river is fixed at x = getSimulatedTurnOffsetX(worldZ)
     * in the exact middle of the canyon and never shifts when the dragon banks or turns left/right.
     */
    updateCanyonAndRiverWorldGeometry(flightZ, forceUpdate = false) {
        if (!this.groundMesh || !this.riverMesh) return;
        const stepZ = 8.0; // Matches 800 / 100 Z-segment spacing
        const anchorZ = Math.floor(flightZ / stepZ) * stepZ - 280.0;
        if (!forceUpdate && this.lastCanyonAnchorZ === anchorZ) return;
        this.lastCanyonAnchorZ = anchorZ;

        this.groundMesh.position.set(0, 0, anchorZ);
        this.riverMesh.position.set(0, 0.35, anchorZ);

        const gGeo = this.groundMesh.geometry;
        const gPos = gGeo.attributes.position;
        const gCol = gGeo.attributes.color;
        const gUv = gGeo.attributes.uv;
        const elevScratch = this.groundElevScratch;
        const shoreScratch = this.groundShoreScratch;
        // UVs derived from world-space position so the texture stays glued to the terrain as the mesh
        // hops forward; the origin is only re-based by whole tiles, which is visually seamless
        const uvOriginZ = Math.floor(anchorZ / TERRAIN_UV_REBASE_DISTANCE) * TERRAIN_UV_REBASE_DISTANCE;
        for (let i = 0; i < gPos.count; i++) {
            const localX = this.groundBaseCoords[i * 2];
            const localZ = this.groundBaseCoords[i * 2 + 1];
            const worldZ = anchorZ + localZ;
            const canyonCenterX = getSimulatedTurnOffsetX(worldZ);
            const worldX = canyonCenterX + localX;
            const riverProfile = this.getRiverChannelProfileAtZ(worldZ);
            const distFromRiver = Math.abs(localX - riverProfile.meanderShiftX);
            const elevY = this.getTerrainElevationAt(localX, worldZ);
            gPos.setXYZ(i, worldX, elevY, localZ);
            gUv.setXY(i, worldX / TERRAIN_TEXTURE_TILE_SIZE, -(worldZ - uvOriginZ) / TERRAIN_TEXTURE_TILE_SIZE);
            elevScratch[i] = elevY;
            shoreScratch[i] = distFromRiver - riverProfile.halfWidth;
        }
        gPos.needsUpdate = true;
        gUv.needsUpdate = true;
        gGeo.computeVertexNormals();
        gGeo.computeBoundingSphere();

        // Slope- & altitude-aware biome coloring: grass on gentle ground, exposed rock on steep faces,
        // snow only where it can settle, patchy meadows and gravel shores along the river
        const gNorm = gGeo.attributes.normal;
        for (let i = 0; i < gPos.count; i++) {
            const localX = this.groundBaseCoords[i * 2];
            const worldZ = anchorZ + this.groundBaseCoords[i * 2 + 1];
            const elevY = elevScratch[i];
            const shoreDist = shoreScratch[i];
            const slope = 1.0 - Math.max(0, Math.min(1, gNorm.getY(i)));
            const patch = terrainValueNoise2(localX * 0.045, worldZ * 0.045);
            const detail = terrainValueNoise2(localX * 0.21 + 5.3, worldZ * 0.21) - 0.5;

            // Meadow grass varying between lush and sun-dried patches
            let r = 0.13 + patch * 0.15;
            let g = 0.31 + patch * 0.08;
            let b = 0.10 + patch * 0.03;

            // Darker conifer-covered highland slopes
            const forestT = terrainSmoothstep(6.0, 20.0, elevY) * (0.6 + patch * 0.4);
            r += (0.10 - r) * forestT;
            g += (0.22 - g) * forestT;
            b += (0.11 - b) * forestT;

            // Exposed granite on steep faces and above the tree line, with faint strata banding
            const rockT = Math.min(1, terrainSmoothstep(0.12, 0.32, slope) + terrainSmoothstep(24.0, 38.0, elevY) * 0.7);
            const strata = Math.sin(elevY * 0.9 + patch * 3.0) * 0.035;
            r += (0.36 + strata - r) * rockT;
            g += (0.35 + strata - g) * rockT;
            b += (0.35 + strata - b) * rockT;

            // Snow settles above a ragged snowline but slides off near-vertical cliffs
            const snowLine = 40.0 + (patch - 0.5) * 14.0;
            const snowT = terrainSmoothstep(snowLine, snowLine + 7.0, elevY) * (1.0 - terrainSmoothstep(0.38, 0.62, slope));
            r += (0.88 - r) * snowT;
            g += (0.91 - g) * snowT;
            b += (0.96 - b) * snowT;

            // Wet gravel & sandbars along the riverbank
            if (shoreDist < 5.2) {
                const shoreT = 1.0 - Math.max(0, shoreDist) / 5.2;
                r += (0.42 - r) * shoreT;
                g += (0.39 - g) * shoreT;
                b += (0.32 - b) * shoreT;
            }

            const variation = 1.0 + detail * 0.22;
            gCol.setXYZ(
                i,
                Math.max(0, Math.min(1, r * variation)),
                Math.max(0, Math.min(1, g * variation)),
                Math.max(0, Math.min(1, b * variation))
            );
        }
        gCol.needsUpdate = true;

        const rGeo = this.riverMesh.geometry;
        const rPos = rGeo.attributes.position;
        const rCol = rGeo.attributes.color;
        for (let i = 0; i < rPos.count; i++) {
            const localX = this.riverBaseCoords[i * 2];
            const localZ = this.riverBaseCoords[i * 2 + 1];
            const worldZ = anchorZ + localZ;
            const canyonCenterX = getSimulatedTurnOffsetX(worldZ);
            const riverProfile = this.getRiverChannelProfileAtZ(worldZ);
            const shapedLocalX = localX * riverProfile.widthScale + riverProfile.meanderShiftX;
            const edgeRatio = Math.min(1.0, Math.abs(localX) / 8.5);
            const ripple = Math.sin(worldZ * 0.21 + localX * 0.65) * 0.07
                + Math.cos(worldZ * 0.37 - localX * 0.95) * 0.045;
            const bankDepress = (1.0 - edgeRatio * edgeRatio) * 0.06;
            rPos.setXYZ(i, canyonCenterX + shapedLocalX, ripple + bankDepress, localZ);

            if (rCol) {
                const foamPulse = Math.max(0, Math.sin(worldZ * 0.19 + localX * 0.8)) * 0.12;
                const rr = Math.min(1.0, 0.10 + edgeRatio * 0.56 + foamPulse);
                const rg = Math.min(1.0, 0.58 + edgeRatio * 0.32 + foamPulse);
                const rb = Math.min(1.0, 0.86 + edgeRatio * 0.14);
                rCol.setXYZ(i, rr, rg, rb);
            }
        }
        rPos.needsUpdate = true;
        if (rCol) rCol.needsUpdate = true;
        rGeo.computeVertexNormals();
        rGeo.computeBoundingSphere();
    }

    /**
     * Deterministic per-object random value in [0, 1] that changes every time an object is recycled
     * (its slot baseZ shifts), so scenery never repeats in recognizable rows.
     */
    scatterRandom(index, baseZ, salt) {
        return terrainHash2(Math.imul(index + 1, 0x9E3779B1) ^ Math.imul(salt + 1, 40503), Math.floor(baseZ * 16) + salt * 9973);
    }

    /**
     * Low-frequency woodland field in [0, 1]: high values form forest patches, low values open meadows.
     */
    getForestDensityAt(localX, worldZ) {
        return terrainFbm2(localX * 0.021 + 113.7, worldZ * 0.021 - 41.3, 3);
    }

    getTerrainSlopeAt(localX, worldZ) {
        const d = 1.5;
        const dx = this.getTerrainElevationAt(localX + d, worldZ) - this.getTerrainElevationAt(localX - d, worldZ);
        const dz = this.getTerrainElevationAt(localX, worldZ + d) - this.getTerrainElevationAt(localX, worldZ - d);
        return Math.hypot(dx, dz) / (2 * d);
    }

    /**
     * Picks a natural spot for a scenery object near its slot baseZ via rejection sampling against a
     * density field, so objects gather into groves, thickets and boulder fields instead of regular rows.
     */
    scatterOnTerrain(entry, baseZ, opts) {
        entry.baseZ = baseZ;
        const idx = entry.index;
        let best = null;
        let bestDensity = -1;
        for (let a = 0; a < opts.attempts; a++) {
            const s = a * 4;
            const zPos = baseZ + (this.scatterRandom(idx, baseZ, s) - 0.5) * 2 * opts.zJitter;
            const rp = this.getRiverChannelProfileAtZ(zPos);
            const side = this.scatterRandom(idx, baseZ, s + 1) < 0.5 ? -1 : 1;
            const minD = opts.minDist(rp);
            const dist = minD + Math.pow(this.scatterRandom(idx, baseZ, s + 2), opts.distBias) * Math.max(0, opts.maxDist - minD);
            const localX = rp.meanderShiftX + side * dist;
            const density = opts.density(localX, zPos, dist, rp);
            if (this.scatterRandom(idx, baseZ, s + 3) < density) {
                return { localX, zPos };
            }
            if (density > bestDensity) {
                bestDensity = density;
                best = { localX, zPos };
            }
        }
        return best;
    }

    sampleTreeScatterPosition(treeEntry, baseZ) {
        return this.scatterOnTerrain(treeEntry, baseZ, {
            attempts: 14,
            zJitter: 10,
            distBias: 1.1,
            maxDist: 84,
            minDist: (rp) => rp.halfWidth + 4.4,
            density: (localX, zPos) => {
                // Woodland patches with denser groves inside, plus rare solitary trees in open meadows
                const canopy = terrainSmoothstep(0.42, 0.58, this.getForestDensityAt(localX, zPos));
                const grove = 0.45 + 0.55 * terrainFbm2(localX * 0.11 + 7.3, zPos * 0.11 - 2.9, 2);
                let d = 0.03 + canopy * grove * 0.97;
                // Fewer trees on cliffs and above the tree line
                d *= 1 - terrainSmoothstep(0.55, 1.15, this.getTerrainSlopeAt(localX, zPos));
                d *= 1 - terrainSmoothstep(26, 44, this.getTerrainElevationAt(localX, zPos));
                return d;
            }
        });
    }

    /**
     * Places and orients a tree group naturally onto the terrain near slot baseZ,
     * sinking the root base slightly into the ground so it never floats on slopes.
     */
    placeTreeNaturallyOnTerrain(treeEntry, baseZ) {
        const spot = this.sampleTreeScatterPosition(treeEntry, baseZ);
        const sideOffset = spot.localX;
        const zPos = spot.zPos;
        treeEntry.sideOffset = sideOffset;
        treeEntry.mesh.rotation.y = this.scatterRandom(treeEntry.index, baseZ, 101) * Math.PI * 2;
        const curveX = getSimulatedTurnOffsetX(zPos);
        const groundY = this.getRenderedGroundHeightAt(sideOffset, zPos);

        // Estimate local lateral terrain slope for subtle natural trunk lean
        const slopeDx = (
            this.getTerrainElevationAt(sideOffset + 1.5, zPos) -
            this.getTerrainElevationAt(sideOffset - 1.5, zPos)
        ) / 3.0;

        // Sink roots slightly into sloped ground so trunks never float on hillsides
        const rootSink = 0.28 + Math.min(0.65, Math.abs(slopeDx) * 0.45) * treeEntry.scale;
        treeEntry.mesh.position.set(curveX + sideOffset, Math.max(-0.15, groundY - rootSink), zPos);
        treeEntry.mesh.rotation.z = Math.max(-0.14, Math.min(0.14, -slopeDx * 0.09 + treeEntry.tiltZ));
        treeEntry.mesh.rotation.x = treeEntry.tiltX;
    }

    /**
     * Creates an organically displaced canopy geometry (cone or sphere) so foliage crowns
     * have natural branch irregular silhouettes rather than rigid geometric primitives.
     */
    createOrganicCanopyGeometry(baseGeo, jitterAmount = 0.14, seed = 1) {
        const geo = baseGeo.clone();
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            const radial = Math.hypot(vx, vz);
            if (radial > 0.05) {
                const angle = Math.atan2(vz, vx);
                const branchWave = 1.0
                    + Math.sin(angle * 5.0 + vy * 1.4 + seed) * jitterAmount
                    + Math.cos(angle * 3.0 - vy * 2.1 + seed * 1.7) * (jitterAmount * 0.65);
                const droopY = -radial * 0.08 * Math.abs(Math.sin(angle * 4.0 + seed));
                pos.setXYZ(i, vx * branchWave, vy + droopY, vz * branchWave);
            }
        }
        pos.needsUpdate = true;
        return this.smoothGeometryNormals(geo);
    }

    /**
     * Builds a single tree mesh group using one of 4 distinct natural tree models:
     * 0 = Multi-tier Alpine Spruce (4 layered organic bough cones + root flare)
     * 1 = Broadleaf Oak / Deciduous Canopy Tree (gnarled trunk, fork limbs, clustered leafy crown)
     * 2 = Tall Slender Cypress / Mountain Fir (tall tapered spire with dense overlapping tiers)
     * 3 = Forked Woodland Pine / Birch (twin-stemmed trunk with asymmetric spreading crowns)
     */
    createTreeModelVariant(modelType, variantSeed, barkMats, foliageMats, geometries) {
        const treeGroup = new THREE.Group();
        const barkMat = barkMats[variantSeed % barkMats.length];
        const foliageMat = foliageMats[variantSeed % foliageMats.length];
        const accentFoliageMat = foliageMats[(variantSeed + 1) % foliageMats.length];

        if (modelType === 0) {
            // Model 0: Multi-tier Alpine Spruce
            const trunk = new THREE.Mesh(geometries.spruceTrunk, barkMat);
            trunk.position.y = 1.55;
            treeGroup.add(trunk);

            const tierHeights = [2.7, 4.3, 5.75, 7.05];
            geometries.spruceTiers.forEach((tierGeo, tIdx) => {
                const tier = new THREE.Mesh(tierGeo, tIdx % 2 === 0 ? foliageMat : accentFoliageMat);
                tier.position.y = tierHeights[tIdx];
                tier.rotation.y = (variantSeed * 0.9 + tIdx * 1.15);
                treeGroup.add(tier);
            });
        } else if (modelType === 1) {
            // Model 1: Broadleaf Oak / Deciduous Canopy Tree with spreading limbs
            const trunk = new THREE.Mesh(geometries.oakTrunk, barkMat);
            trunk.position.y = 1.65;
            treeGroup.add(trunk);

            // Spreading wooden boughs
            [-1, 1].forEach((dir, bIdx) => {
                const branch = new THREE.Mesh(geometries.oakBranch, barkMat);
                branch.position.set(dir * 0.52, 2.55 + bIdx * 0.22, (bIdx === 0 ? 0.18 : -0.18));
                branch.rotation.z = -dir * 0.58;
                branch.rotation.x = (bIdx === 0 ? 0.22 : -0.22);
                treeGroup.add(branch);
            });

            // Multi-lobe organic leafy crown
            const crownOffsets = [
                { x: 0.0, y: 4.35, z: 0.0, sx: 1.15, sy: 0.95, sz: 1.12 },
                { x: -1.05, y: 3.75, z: 0.35, sx: 0.82, sy: 0.76, sz: 0.85 },
                { x: 1.02, y: 3.85, z: -0.30, sx: 0.85, sy: 0.78, sz: 0.80 },
                { x: 0.15, y: 4.95, z: 0.45, sx: 0.78, sy: 0.72, sz: 0.78 }
            ];
            crownOffsets.forEach((cOff, cIdx) => {
                const lobe = new THREE.Mesh(
                    geometries.oakCrownLobes[cIdx % geometries.oakCrownLobes.length],
                    cIdx % 2 === 0 ? foliageMat : accentFoliageMat
                );
                lobe.position.set(cOff.x, cOff.y, cOff.z);
                lobe.scale.set(cOff.sx, cOff.sy, cOff.sz);
                lobe.rotation.y = variantSeed * 0.7 + cIdx * 1.3;
                treeGroup.add(lobe);
            });
        } else if (modelType === 2) {
            // Model 2: Tall Slender Cypress / Alpine Fir Spire
            const trunk = new THREE.Mesh(geometries.firTrunk, barkMat);
            trunk.position.y = 1.9;
            treeGroup.add(trunk);

            const spireHeights = [2.6, 3.85, 5.05, 6.2, 7.3, 8.25];
            geometries.firTiers.forEach((tierGeo, sIdx) => {
                const spireTier = new THREE.Mesh(tierGeo, sIdx % 2 === 0 ? foliageMat : accentFoliageMat);
                spireTier.position.y = spireHeights[sIdx];
                spireTier.rotation.y = variantSeed * 0.5 + sIdx * 0.95;
                treeGroup.add(spireTier);
            });
        } else {
            // Model 3: Forked Woodland Pine / Subalpine Birch with twin trunks & asymmetric crowns
            const mainTrunk = new THREE.Mesh(geometries.forkMainTrunk, barkMat);
            mainTrunk.position.set(-0.18, 1.85, 0);
            mainTrunk.rotation.z = 0.14;
            treeGroup.add(mainTrunk);

            const secondaryTrunk = new THREE.Mesh(geometries.forkSubTrunk, barkMat);
            secondaryTrunk.position.set(0.45, 1.55, 0.18);
            secondaryTrunk.rotation.z = -0.26;
            secondaryTrunk.rotation.x = 0.12;
            treeGroup.add(secondaryTrunk);

            const leftCrown1 = new THREE.Mesh(geometries.forkCrownLower, foliageMat);
            leftCrown1.position.set(-0.42, 3.85, 0);
            treeGroup.add(leftCrown1);

            const leftCrown2 = new THREE.Mesh(geometries.forkCrownUpper, accentFoliageMat);
            leftCrown2.position.set(-0.48, 5.25, 0);
            treeGroup.add(leftCrown2);

            const rightCrown = new THREE.Mesh(geometries.forkSubCrown, accentFoliageMat);
            rightCrown.position.set(0.88, 3.25, 0.28);
            treeGroup.add(rightCrown);
        }

        return treeGroup;
    }

    buildForestTrees() {
        this.treeBarkTexture = this.createTreeBarkTexture();
        this.treeFoliageTexture = this.createTreeFoliageTexture();

        // One shared material per surface; natural per-tree hues & self-shadowing are baked into vertex colors
        this.treeBarkMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.treeBarkTexture, vertexColors: true });
        this.foliageMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.treeFoliageTexture, vertexColors: true });

        // Marker materials only identify part roles while the prototype trees are merged
        const barkMarker = new THREE.MeshBasicMaterial();
        const foliageMarkerA = new THREE.MeshBasicMaterial();
        const foliageMarkerB = new THREE.MeshBasicMaterial();

        const geometries = {
            spruceTrunk: new THREE.CylinderGeometry(0.26, 0.62, 3.1, 7),
            spruceTiers: [
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(2.55, 2.8, 9), 0.15, 1),
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(2.10, 2.5, 9), 0.15, 2),
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(1.58, 2.2, 8), 0.14, 3),
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(1.05, 1.9, 8), 0.12, 4)
            ],
            oakTrunk: new THREE.CylinderGeometry(0.38, 0.72, 3.3, 8),
            oakBranch: new THREE.CylinderGeometry(0.14, 0.26, 1.65, 6),
            oakCrownLobes: [
                this.createOrganicCanopyGeometry(new THREE.IcosahedronGeometry(1.85, 1), 0.16, 5),
                this.createOrganicCanopyGeometry(new THREE.IcosahedronGeometry(1.65, 1), 0.18, 6)
            ],
            firTrunk: new THREE.CylinderGeometry(0.22, 0.50, 3.8, 7),
            firTiers: [
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(1.75, 2.2, 8), 0.13, 7),
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(1.52, 2.0, 8), 0.13, 8),
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(1.30, 1.85, 8), 0.12, 9),
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(1.08, 1.7, 8), 0.12, 10),
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(0.84, 1.5, 7), 0.11, 11),
                this.createOrganicCanopyGeometry(new THREE.ConeGeometry(0.58, 1.35, 7), 0.10, 12)
            ],
            forkMainTrunk: new THREE.CylinderGeometry(0.24, 0.52, 3.7, 7),
            forkSubTrunk: new THREE.CylinderGeometry(0.18, 0.36, 2.8, 6),
            forkCrownLower: this.createOrganicCanopyGeometry(new THREE.ConeGeometry(2.15, 2.6, 8), 0.16, 13),
            forkCrownUpper: this.createOrganicCanopyGeometry(new THREE.ConeGeometry(1.55, 2.2, 8), 0.15, 14),
            forkSubCrown: this.createOrganicCanopyGeometry(new THREE.IcosahedronGeometry(1.42, 1), 0.16, 15)
        };

        // Natural palettes [main, accent]: conifers dark blue-green, broadleaf warmer, birch light & yellowish
        const foliagePalettes = [
            [[0x1f3d29, 0x2a4c30], [0x234430, 0x2f5436], [0x1b3625, 0x27472e]],
            [[0x3b5b26, 0x4b6b2d], [0x46632a, 0x567532], [0x405626, 0x5b6f2e]],
            [[0x1c3a2d, 0x274a35], [0x203f2b, 0x2c5034], [0x19352a, 0x244531]],
            [[0x4a6a2a, 0x5c7b34], [0x55722c, 0x678338], [0x4e6626, 0x60782f]]
        ];
        const barkColors = [0x7a5c44, 0x806248, 0x6e5440, 0xe6ded2];
        const colorVariants = 3;
        const treeGeoCache = [];
        for (let model = 0; model < 4; model++) {
            treeGeoCache.push([]);
            for (let v = 0; v < colorVariants; v++) {
                const proto = this.createTreeModelVariant(model, v * 7 + model, [barkMarker], [foliageMarkerA, foliageMarkerB], geometries);
                proto.updateMatrixWorld(true);
                const barkParts = [];
                const foliageParts = [];
                const palette = foliagePalettes[model][v];
                proto.children.forEach((child) => {
                    if (child.material === barkMarker) {
                        barkParts.push({ geometry: child.geometry, matrix: child.matrix, color: new THREE.Color(barkColors[model]), ao: 0.45 });
                    } else {
                        foliageParts.push({
                            geometry: child.geometry,
                            matrix: child.matrix,
                            color: new THREE.Color(child.material === foliageMarkerA ? palette[0] : palette[1]),
                            ao: 0.5,
                            topTint: { color: new THREE.Color(0x7d8f3a), amount: 0.22 }
                        });
                    }
                });
                treeGeoCache[model].push({
                    bark: this.mergeColoredParts(barkParts),
                    foliage: this.mergeColoredParts(foliageParts)
                });
            }
        }
        barkMarker.dispose();
        foliageMarkerA.dispose();
        foliageMarkerB.dispose();

        const treeCount = 290;
        for (let i = 0; i < treeCount; i++) {
            const modelType = i % 4;
            const cached = treeGeoCache[modelType][Math.floor(i / 4) % colorVariants];
            // Two draw calls per tree (bark + foliage) instead of one per trunk/branch/tier
            const treeGroup = new THREE.Group();
            treeGroup.add(new THREE.Mesh(cached.bark, this.treeBarkMaterial));
            treeGroup.add(new THREE.Mesh(cached.foliage, this.foliageMaterial));

            // Wide, natural variation in tree size (saplings, medium woodland trees, towering old-growth giants)
            const sizeRoll = (Math.sin(i * 59.17 + 9.3) * 0.5 + 0.5);
            const scale = 0.48 + Math.pow(sizeRoll, 1.25) * 1.75;
            const widthAspect = 0.86 + ((i * 17) % 9) * 0.035;
            const heightAspect = 0.90 + ((i * 23) % 11) * 0.032;
            treeGroup.scale.set(scale * widthAspect, scale * heightAspect, scale * widthAspect);
            treeGroup.rotation.y = (i * 2.39996) % (Math.PI * 2);

            const zPos = -((i * 520) / treeCount) + 25 + Math.sin(i * 19.7) * 4.5;
            const treeEntry = {
                mesh: treeGroup,
                index: i,
                modelType,
                scale,
                sideOffset: 20,
                tiltX: Math.sin(i * 31.7) * 0.04,
                tiltZ: Math.cos(i * 47.3) * 0.04
            };
            this.placeTreeNaturallyOnTerrain(treeEntry, zPos);

            this.scene.add(treeGroup);
            this.trees.push(treeEntry);
        }
    }

    /**
     * Places a bush or shrub naturally along riverbanks, forest edges, and in scattered meadow thickets.
     */
    placeBushNaturallyOnTerrain(bushEntry, baseZ) {
        const spot = this.scatterOnTerrain(bushEntry, baseZ, {
            attempts: 14,
            zJitter: 12,
            distBias: 1.35,
            maxDist: 72,
            minDist: (rp) => rp.halfWidth + 1.8,
            density: (localX, zPos, dist, rp) => {
                const thicket = 0.35 + 0.65 * terrainFbm2(localX * 0.14 - 3.1, zPos * 0.14 + 9.7, 2);
                // Lush riparian shrubs hugging the banks
                const riparian = 1 - terrainSmoothstep(2.0, 9.0, dist - rp.halfWidth);
                // Shrubs concentrate along woodland margins, sparse undergrowth beneath the canopy
                const forest = this.getForestDensityAt(localX, zPos);
                const edge = Math.exp(-Math.pow((forest - 0.44) / 0.06, 2));
                const under = terrainSmoothstep(0.46, 0.6, forest) * 0.22;
                let d = Math.max(riparian * 0.85, edge, under) * thicket + 0.02;
                d *= 1 - terrainSmoothstep(0.7, 1.3, this.getTerrainSlopeAt(localX, zPos));
                d *= 1 - terrainSmoothstep(30, 48, this.getTerrainElevationAt(localX, zPos));
                return d;
            }
        });
        const localX = spot.localX;
        const zPos = spot.zPos;
        bushEntry.mesh.rotation.y = this.scatterRandom(bushEntry.index, baseZ, 101) * Math.PI * 2;
        bushEntry.sideOffset = localX;
        const curveX = getSimulatedTurnOffsetX(zPos);
        const groundY = this.getRenderedGroundHeightAt(localX, zPos);
        const slopeDx = (
            this.getTerrainElevationAt(localX + 1.2, zPos) -
            this.getTerrainElevationAt(localX - 1.2, zPos)
        ) / 2.4;

        const rootSink = (0.22 + Math.min(0.45, Math.abs(slopeDx) * 0.32)) * bushEntry.scale;
        bushEntry.mesh.position.set(curveX + localX, Math.max(-0.15, groundY - rootSink), zPos);
        bushEntry.mesh.rotation.z = Math.max(-0.18, Math.min(0.18, -slopeDx * 0.11));
    }

    /**
     * Builds natural multi-model textured bushes and undergrowth shrubs:
     * - Rounded multi-lobe leafy meadow shrubs
     * - Spreading low alpine juniper / pine scrub bushes
     * - Wildflower / berry bramble thickets with colorful accent blossoms
     */
    buildForestBushes() {
        if (!this.treeFoliageTexture) {
            this.treeFoliageTexture = this.createTreeFoliageTexture();
        }
        if (!this.foliageMaterial) {
            this.foliageMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.treeFoliageTexture, vertexColors: true });
        }

        // Marker materials identify part roles; their natural colors are baked into merged vertex colors
        const markerColors = new Map();
        const makeMarker = (hex) => {
            const m = new THREE.MeshBasicMaterial();
            markerColors.set(m, new THREE.Color(hex));
            return m;
        };
        const bushMats = [makeMarker(0x2f4f24), makeMarker(0x3c5d2a), makeMarker(0x4a5c26), makeMarker(0x2a4630)];
        const blossomMats = [makeMarker(0xf2d16b), makeMarker(0xd25563), makeMarker(0xb592dc)];

        const lobeGeos = [
            this.createOrganicCanopyGeometry(new THREE.IcosahedronGeometry(1.05, 1), 0.18, 21),
            this.createOrganicCanopyGeometry(new THREE.IcosahedronGeometry(0.88, 1), 0.20, 22),
            this.createOrganicCanopyGeometry(new THREE.ConeGeometry(1.15, 1.45, 7), 0.16, 23)
        ];
        const berryGeo = this.smoothGeometryNormals(new THREE.IcosahedronGeometry(0.24, 1));

        // 12 merged prototypes cover every bush type (i % 3) x foliage color (i % 4) combination
        const bushPrototypeCount = 12;
        const bushGeos = [];
        const bushCount = 190;
        for (let i = 0; i < bushPrototypeCount; i++) {
            const bushGroup = new THREE.Group();
            const bushType = i % 3;
            const primaryMat = bushMats[i % bushMats.length];
            const secondaryMat = bushMats[(i + 1) % bushMats.length];

            if (bushType === 0) {
                // Type 0: Multi-lobe rounded woodland shrub
                const mounds = [
                    { x: 0.0, y: 0.72, z: 0.0, sx: 1.25, sy: 0.85, sz: 1.20 },
                    { x: -0.68, y: 0.55, z: 0.28, sx: 0.92, sy: 0.72, sz: 0.88 },
                    { x: 0.65, y: 0.58, z: -0.24, sx: 0.95, sy: 0.70, sz: 0.90 },
                    { x: 0.12, y: 0.52, z: 0.65, sx: 0.80, sy: 0.65, sz: 0.82 }
                ];
                mounds.forEach((m, mIdx) => {
                    const lobe = new THREE.Mesh(
                        lobeGeos[mIdx % 2],
                        mIdx % 2 === 0 ? primaryMat : secondaryMat
                    );
                    lobe.position.set(m.x, m.y, m.z);
                    lobe.scale.set(m.sx, m.sy, m.sz);
                    lobe.rotation.y = i * 0.8 + mIdx * 1.4;
                    bushGroup.add(lobe);
                });
            } else if (bushType === 1) {
                // Type 1: Spreading low alpine juniper / mountain scrub
                const scrubParts = [
                    { x: 0.0, y: 0.78, z: 0.0, sx: 1.35, sy: 0.92, sz: 1.35, rz: 0.0 },
                    { x: -0.75, y: 0.58, z: 0.22, sx: 1.05, sy: 0.75, sz: 1.05, rz: 0.28 },
                    { x: 0.78, y: 0.60, z: -0.20, sx: 1.02, sy: 0.78, sz: 1.02, rz: -0.26 }
                ];
                scrubParts.forEach((sp, sIdx) => {
                    const cone = new THREE.Mesh(
                        lobeGeos[2],
                        sIdx % 2 === 0 ? primaryMat : secondaryMat
                    );
                    cone.position.set(sp.x, sp.y, sp.z);
                    cone.scale.set(sp.sx, sp.sy, sp.sz);
                    cone.rotation.set(0, i * 0.9 + sIdx, sp.rz);
                    bushGroup.add(cone);
                });
            } else {
                // Type 2: Wildflower / berry bramble thicket
                const brambleLobes = [
                    { x: 0.0, y: 0.68, z: 0.0, sx: 1.18, sy: 0.82, sz: 1.15 },
                    { x: -0.58, y: 0.52, z: -0.32, sx: 0.88, sy: 0.68, sz: 0.86 },
                    { x: 0.55, y: 0.54, z: 0.36, sx: 0.85, sy: 0.66, sz: 0.88 }
                ];
                brambleLobes.forEach((b, bIdx) => {
                    const lobe = new THREE.Mesh(
                        lobeGeos[bIdx % 2],
                        bIdx % 2 === 0 ? primaryMat : secondaryMat
                    );
                    lobe.position.set(b.x, b.y, b.z);
                    lobe.scale.set(b.sx, b.sy, b.sz);
                    bushGroup.add(lobe);
                });

                // Accent wildflower / berry clusters on top of the thicket
                const accentMat = blossomMats[i % blossomMats.length];
                const blossomPositions = [
                    { x: -0.35, y: 1.12, z: 0.28 },
                    { x: 0.42, y: 1.05, z: -0.22 },
                    { x: 0.05, y: 1.24, z: -0.10 }
                ];
                blossomPositions.forEach((bp) => {
                    const bud = new THREE.Mesh(berryGeo, accentMat);
                    bud.position.set(bp.x, bp.y, bp.z);
                    bushGroup.add(bud);
                });
            }

            bushGroup.updateMatrixWorld(true);
            const isBlossom = (m) => blossomMats.includes(m);
            bushGeos.push(this.mergeColoredParts(bushGroup.children.map((child) => ({
                geometry: child.geometry,
                matrix: child.matrix,
                color: markerColors.get(child.material),
                ao: isBlossom(child.material) ? 0 : 0.55,
                topTint: isBlossom(child.material) ? null : { color: new THREE.Color(0x76883a), amount: 0.2 }
            }))));
        }
        markerColors.forEach((_, m) => m.dispose());

        for (let i = 0; i < bushCount; i++) {
            // Single draw call per bush (lobes + blossoms merged)
            const bushGroup = new THREE.Mesh(bushGeos[i % bushPrototypeCount], this.foliageMaterial);

            const sizeRoll = Math.sin(i * 47.9 + 3.7) * 0.5 + 0.5;
            const scale = 0.55 + Math.pow(sizeRoll, 1.15) * 1.35;
            const wideScale = scale * (0.95 + (i % 5) * 0.08);
            const heightScale = scale * (0.78 + (i % 4) * 0.09);
            bushGroup.scale.set(wideScale, heightScale, wideScale);
            bushGroup.rotation.y = (i * 1.87) % (Math.PI * 2);

            const zPos = -((i * 520) / bushCount) + 24 + Math.cos(i * 23.1) * 3.5;
            const bushEntry = {
                mesh: bushGroup,
                index: i,
                scale: heightScale,
                sideOffset: 15
            };
            this.placeBushNaturallyOnTerrain(bushEntry, zPos);

            this.scene.add(bushGroup);
            this.bushes.push(bushEntry);
        }
    }

    /**
     * Creates an organically faceted, weathered boulder geometry for riverside and hillside stones.
     */
    createWeatheredStoneGeometry(seed = 1) {
        const geo = new THREE.IcosahedronGeometry(1.0, 2);
        const pos = geo.attributes.position;
        const s1 = Math.sin(seed * 2.17 + 0.4);
        const s2 = Math.cos(seed * 3.53 + 1.2);
        for (let i = 0; i < pos.count; i++) {
            let vx = pos.getX(i);
            let vy = pos.getY(i);
            let vz = pos.getZ(i);
            // Large weathered lumps + fine fractal pitting for natural boulder silhouettes
            const lumps = terrainFbm2(vx * 1.3 + vy * 0.7 + seed * 5.1, vz * 1.3 - vy * 0.9 + seed * 2.3, 3) - 0.5;
            const n = 1.0
                + 0.14 * Math.sin(vx * 2.7 + seed * 1.3) * Math.cos(vz * 2.5 - seed)
                + 0.08 * Math.cos(vy * 3.1 + vx * 1.9 + s1)
                + lumps * 0.32;
            vx *= n * (1.15 + s1 * 0.18);
            vy *= n * (0.72 + Math.abs(s2) * 0.22);
            vz *= n * (1.05 - s1 * 0.14);
            // Flatten bottom slightly so stones sit naturally embedded in the ground
            if (vy < -0.25) {
                vy = -0.25 + (vy + 0.25) * 0.35;
            }
            pos.setXYZ(i, vx, vy, vz);
        }
        pos.needsUpdate = true;
        return this.smoothGeometryNormals(geo);
    }

    /**
     * Places a stone or boulder naturally on gravel bars, riverbanks, rocky slopes, and boulder fields.
     */
    placeStoneNaturallyOnTerrain(stoneEntry, baseZ) {
        const spot = this.scatterOnTerrain(stoneEntry, baseZ, {
            attempts: 14,
            zJitter: 14,
            distBias: 1.3,
            maxDist: 72,
            minDist: (rp) => rp.halfWidth - 1.5,
            density: (localX, zPos, dist, rp) => {
                const clump = 0.4 + 0.6 * terrainFbm2(localX * 0.2 + 5.3, zPos * 0.2 + 77.1, 2);
                // Gravel bars and bank boulders at the waterline
                const bank = Math.exp(-Math.pow((dist - rp.halfWidth - 0.5) / 2.6, 2));
                // Exposed rock on steep ground and scattered boulder fields
                const rocky = terrainSmoothstep(0.35, 0.9, this.getTerrainSlopeAt(localX, zPos));
                const boulderField = terrainSmoothstep(0.56, 0.7, terrainFbm2(localX * 0.05 + 51.0, zPos * 0.05 - 23.0, 3));
                return Math.max(bank * 0.9, rocky * 0.75, boulderField * 0.65) * clump + 0.015;
            }
        });
        const localX = spot.localX;
        const zPos = spot.zPos;
        stoneEntry.mesh.rotation.y = this.scatterRandom(stoneEntry.index, baseZ, 101) * Math.PI * 2;
        stoneEntry.sideOffset = localX;
        const curveX = getSimulatedTurnOffsetX(zPos);
        const groundY = this.getRenderedGroundHeightAt(localX, zPos);
        stoneEntry.mesh.position.set(
            curveX + localX,
            groundY - 0.18 * stoneEntry.scaleY,
            zPos
        );
    }

    buildTerrainStones() {
        this.stoneTexture = this.createStoneSurfaceTexture();

        // Matte rock: shared material, per-variant granite/sandstone tones, grime & moss baked into vertex colors
        this.stoneMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.stoneTexture, vertexColors: true });
        const stoneTones = [0xc9c4ba, 0xbfb1a2, 0xb3b6b8];
        const mossTint = { color: new THREE.Color(0x4f6a34), amount: 0.45 };
        const identity = new THREE.Matrix4();
        const subRockMatrix = new THREE.Matrix4();
        const stoneGeoCache = new Map();

        const stoneGeometries = [];
        for (let v = 0; v < 5; v++) {
            stoneGeometries.push(this.createWeatheredStoneGeometry(v + 1));
        }

        const stoneCount = 110;
        for (let i = 0; i < stoneCount; i++) {
            // Every third stone is a natural multi-rock outcrop with a companion cobble (merged: 1 draw call)
            const isOutcrop = i % 3 === 0;
            const geoIdx = i % stoneGeometries.length;
            const toneIdx = i % stoneTones.length;
            const cacheKey = geoIdx + '_' + toneIdx + '_' + isOutcrop;
            let stoneGeo = stoneGeoCache.get(cacheKey);
            if (!stoneGeo) {
                const parts = [{
                    geometry: stoneGeometries[geoIdx],
                    matrix: identity,
                    color: new THREE.Color(stoneTones[toneIdx]),
                    ao: 0.5,
                    topTint: toneIdx === 1 ? null : mossTint
                }];
                if (isOutcrop) {
                    subRockMatrix.compose(
                        new THREE.Vector3(0.85, -0.14, 0.42),
                        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.3),
                        new THREE.Vector3(0.58, 0.52, 0.62)
                    );
                    parts.push({
                        geometry: stoneGeometries[(i + 2) % stoneGeometries.length],
                        matrix: subRockMatrix,
                        color: new THREE.Color(stoneTones[(toneIdx + 1) % stoneTones.length]).multiplyScalar(0.92),
                        ao: 0.5,
                        topTint: mossTint
                    });
                }
                stoneGeo = this.mergeColoredParts(parts);
                stoneGeoCache.set(cacheKey, stoneGeo);
            }
            const stoneGroup = new THREE.Mesh(stoneGeo, this.stoneMaterial);
            const sizeFactor = 0.55 + Math.pow((Math.sin(i * 43.7 + 5.1) * 0.5 + 0.5), 1.4) * 2.15;
            const sx = sizeFactor * (0.9 + (i % 4) * 0.14);
            const sy = sizeFactor * (0.65 + (i % 3) * 0.16);
            const sz = sizeFactor * (0.88 + ((i + 1) % 4) * 0.13);
            stoneGroup.scale.set(sx, sy, sz);
            stoneGroup.rotation.set(
                (Math.sin(i * 17.3) * 0.18),
                (i * 1.93) % (Math.PI * 2),
                (Math.cos(i * 29.1) * 0.18)
            );

            const zPos = -((i * 520) / stoneCount) + 24;
            const stoneEntry = {
                mesh: stoneGroup,
                index: i,
                sideOffset: 12,
                scaleY: sy
            };
            this.placeStoneNaturallyOnTerrain(stoneEntry, zPos);

            this.scene.add(stoneGroup);
            this.stones.push(stoneEntry);
        }
    }

    createSingleCloudGeometry(seed = 0) {
        const geo = new THREE.SphereGeometry(1, 28, 20);
        const pos = geo.attributes.position;

        // Deterministic per-cloud variation for cumulus domes and side billows
        const s1 = Math.sin(seed * 1.73 + 0.5);
        const s2 = Math.cos(seed * 2.41 + 1.1);
        const s3 = Math.sin(seed * 3.17 + 2.3);

        // Overlapping cumulus lobes evaluated as a single continuous outer surface envelope
        const lobes = [
            { cx: 0.0, cy: 0.08, cz: 0.0, r: 1.05 },
            { cx: -0.12 + s1 * 0.14, cy: 0.58 + Math.abs(s2) * 0.16, cz: 0.04 * s3, r: 0.96 },
            { cx: 0.68 + s2 * 0.1, cy: 0.30 + s1 * 0.08, cz: -0.06 * s2, r: 0.86 },
            { cx: -0.72 - s1 * 0.1, cy: 0.24 + s3 * 0.08, cz: 0.07 * s1, r: 0.82 },
            { cx: 1.24 + s3 * 0.08, cy: -0.04, cz: 0.04, r: 0.68 },
            { cx: -1.22 - s2 * 0.08, cy: -0.06, cz: -0.04, r: 0.65 },
            { cx: 0.20 * s1, cy: 0.14, cz: 0.48 + s2 * 0.06, r: 0.76 },
            { cx: -0.20 * s2, cy: 0.16, cz: -0.48 - s1 * 0.06, r: 0.76 }
        ];

        const smoothK = 7.5;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            const len = Math.hypot(vx, vy, vz) || 1;
            const ux = vx / len;
            const uy = vy / len;
            const uz = vz / len;

            // Smooth-max of ray-sphere outer intersection distances across all cloud lobes
            let expSum = 0;
            for (let k = 0; k < lobes.length; k++) {
                const l = lobes[k];
                const b = ux * l.cx + uy * l.cy + uz * l.cz;
                const cSq = l.cx * l.cx + l.cy * l.cy + l.cz * l.cz;
                const disc = l.r * l.r - cSq + b * b;
                if (disc > 0) {
                    const t = b + Math.sqrt(disc);
                    if (t > 0) {
                        expSum += Math.exp(smoothK * t);
                    }
                }
            }
            const radialDist = expSum > 0 ? Math.log(expSum) / smoothK : 1.0;

            // Subtle organic billow ripples across the single continuous surface
            const ripple = 1.0
                + 0.045 * Math.sin(ux * 5.0 + seed) * Math.cos(uz * 4.5 - seed)
                + 0.03 * Math.sin(uy * 6.0 + ux * 3.5);

            let x = ux * radialDist * ripple * 4.6;
            let y = uy * radialDist * ripple * 4.2;
            let z = uz * radialDist * ripple * 4.0;

            // Flatten the underside for a classic flat-bottomed cumulus cloud profile
            if (y < 0) {
                y *= 0.36;
            }

            pos.setXYZ(i, x, y, z);
        }

        pos.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        return geo;
    }

    buildVolumetricClouds() {
        const cloudMat = new THREE.MeshLambertMaterial({
            color: 0xf8fafc,
            transparent: true,
            opacity: 0.48,
            depthWrite: false
        });

        const cloudGeometries = [];
        for (let v = 0; v < 6; v++) {
            cloudGeometries.push(this.createSingleCloudGeometry(v + 1));
        }

        for (let i = 0; i < 36; i++) {
            const cloudGeo = cloudGeometries[i % cloudGeometries.length];
            const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);

            const zPos = -Math.random() * 540 + 15;
            const xPos = (Math.random() - 0.5) * 170;
            const yPos = 24 + Math.random() * 62;
            const scale = 0.85 + (i % 5) * 0.14;
            cloudMesh.position.set(xPos, yPos, zPos);
            cloudMesh.scale.set(scale * (1.0 + (i % 3) * 0.1), scale, scale * (0.9 + (i % 2) * 0.15));
            cloudMesh.rotation.y = ((i * 1.37) % (Math.PI * 2));

            this.scene.add(cloudMesh);
            this.clouds.push({
                mesh: cloudMesh,
                baseX: xPos,
                driftSpeed: (Math.random() - 0.5) * 2.2
            });
        }
    }

    buildFlockOfBirds() {
        const wingGeo = new THREE.BoxGeometry(1.25, 0.08, 0.45);
        const birdMat = new THREE.MeshLambertMaterial({ color: 0xfef08a });

        for (let i = 0; i < 24; i++) {
            const birdGroup = new THREE.Group();
            const leftWingPivot = new THREE.Group();
            const rightWingPivot = new THREE.Group();

            const leftWing = new THREE.Mesh(wingGeo, birdMat);
            leftWing.position.x = -0.6;
            leftWingPivot.add(leftWing);

            const rightWing = new THREE.Mesh(wingGeo, birdMat);
            rightWing.position.x = 0.6;
            rightWingPivot.add(rightWing);

            birdGroup.add(leftWingPivot);
            birdGroup.add(rightWingPivot);

            const zPos = -Math.random() * 440;
            const xOffset = (Math.random() - 0.5) * 90;
            const yPos = 16 + Math.random() * 52;
            birdGroup.position.set(xOffset, yPos, zPos);

            this.scene.add(birdGroup);
            this.birds.push({
                group: birdGroup,
                leftWing: leftWingPivot,
                rightWing: rightWingPivot,
                flapOffset: Math.random() * Math.PI * 2,
                flapSpeed: 10 + Math.random() * 5,
                xOffset,
                yBase: yPos
            });
        }
    }

    /**
     * Initializes shared unit geometries and cached textures for 3D Donut Gate wind indicators:
     * - Upwind (slope <= -0.35): rising emerald 3D chevrons, flanking wind halo arcs, and LIFT badge.
     * - Downwind (slope >= 0.35): descending amber 3D chevrons, flanking wind halo arcs, and DRAFT badge.
     * - Flat (|slope| < 0.35): hidden so the sky and rings stay clean.
     */
    ensureGateWindResources() {
        if (this.gateWindGeos || typeof THREE === 'undefined') return;
        const shape = new THREE.Shape();
        const hw = 0.5;
        const height = 0.587;
        const thickness = 0.283;
        shape.moveTo(-hw, 0);
        shape.lineTo(0, height);
        shape.lineTo(hw, 0);
        shape.lineTo(hw, -thickness);
        shape.lineTo(0, height - thickness);
        shape.lineTo(-hw, -thickness);
        shape.closePath();

        const chevronGeo = new THREE.ExtrudeGeometry(shape, {
            depth: 0.65,
            bevelEnabled: true,
            bevelThickness: 0.022,
            bevelSize: 0.022,
            bevelSegments: 2
        });
        chevronGeo.center();

        const arcSpan = Math.PI * 0.46;
        const leftArcGeo = new THREE.RingGeometry(1.0, 1.062, 28, 1, Math.PI - arcSpan * 0.5, arcSpan);
        const rightArcGeo = new THREE.RingGeometry(1.0, 1.062, 28, 1, -arcSpan * 0.5, arcSpan);

        this.gateWindGeos = { chevronGeo, leftArcGeo, rightArcGeo };
        this._windColBase = new THREE.Color();
        this._windColCrest = new THREE.Color();
    }

    getWindBadgeTexture(slopePct, isUpwind) {
        const rounded = slopePct.toFixed(1);
        const key = `${isUpwind ? 'U' : 'D'}:${rounded}`;
        const cached = this.windBadgeTextureCache.get(key);
        if (cached) return cached;

        if (this.windBadgeTextureCache.size > 220) {
            const oldestKey = this.windBadgeTextureCache.keys().next().value;
            const oldestTex = this.windBadgeTextureCache.get(oldestKey);
            if (oldestTex) oldestTex.dispose();
            this.windBadgeTextureCache.delete(oldestKey);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const border = isUpwind ? '#34d399' : '#f97316';
        const textCol = isUpwind ? '#6ee7b7' : '#fdba74';
        const sign = slopePct > 0 ? '+' : '';
        const label = isUpwind
            ? `\u25B2 ${sign}${rounded}% LIFT`
            : `\u25BC ${sign}${rounded}% DRAFT`;

        const x = 24, y = 18, w = 464, h = 92, r = 44;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(8, 15, 30, 0.86)';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = border;
        ctx.stroke();

        ctx.font = '900 44px monospace';
        ctx.fillStyle = textCol;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = border;
        ctx.shadowBlur = 14;
        ctx.fillText(label, 256, 65);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        this.windBadgeTextureCache.set(key, tex);
        return tex;
    }

    createGateWindVisual() {
        this.ensureGateWindResources();
        if (!this.gateWindGeos) return null;

        const group = new THREE.Group();
        group.visible = false;

        const makeArcMesh = (geo) => {
            const mat = new THREE.MeshBasicMaterial({
                color: 0x10b981,
                transparent: true,
                opacity: 0.56,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            group.add(mesh);
            return { mesh, mat };
        };

        const leftArc = makeArcMesh(this.gateWindGeos.leftArcGeo);
        const rightArc = makeArcMesh(this.gateWindGeos.rightArcGeo);

        const flankChevrons = [];
        [-1, 1].forEach((side) => {
            for (let k = 0; k < 3; k++) {
                const mat = new THREE.MeshBasicMaterial({
                    color: 0x10b981,
                    transparent: true,
                    opacity: 0.75
                });
                const mesh = new THREE.Mesh(this.gateWindGeos.chevronGeo, mat);
                group.add(mesh);
                flankChevrons.push({ mesh, mat, side, index: k, baseX: 0, baseY: 0 });
            }
        });

        const verticalChevrons = [];
        for (let k = 0; k < 2; k++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0x10b981,
                transparent: true,
                opacity: 0.75
            });
            const mesh = new THREE.Mesh(this.gateWindGeos.chevronGeo, mat);
            group.add(mesh);
            verticalChevrons.push({ mesh, mat, index: k, baseY: 0 });
        }

        const badgeMat = new THREE.SpriteMaterial({
            transparent: true,
            opacity: 0.96,
            depthTest: true,
            depthWrite: false
        });
        const badgeSprite = new THREE.Sprite(badgeMat);
        badgeSprite.visible = false;
        badgeSprite.renderOrder = 3;
        group.add(badgeSprite);

        return {
            group,
            leftArc,
            rightArc,
            flankChevrons,
            verticalChevrons,
            badgeSprite,
            badgeMat,
            badgeKey: null,
            badgeBaseY: 0,
            badgeClamped: false,
            isUpwind: true
        };
    }

    disposeGateWindVisual(gate) {
        if (!gate || !gate.windVisual) return;
        const wv = gate.windVisual;
        wv.leftArc.mat.dispose();
        wv.rightArc.mat.dispose();
        wv.flankChevrons.forEach((c) => c.mat.dispose());
        wv.verticalChevrons.forEach((c) => c.mat.dispose());
        wv.badgeMat.dispose();
        gate.windVisual = null;
    }

    syncGateWindVisual(gate, donutRadius, tubeRadius, textOffsetY, gradAtGate) {
        if (!gate || !gate.windVisual) return;
        const wv = gate.windVisual;
        gate.gradAtGate = gradAtGate;
        gate.tubeRadius = tubeRadius;

        if (!Number.isFinite(gradAtGate) || Math.abs(gradAtGate) < 0.35) {
            wv.group.visible = false;
            wv.badgeSprite.visible = false;
            return;
        }

        wv.group.visible = true;
        const isUpwind = gradAtGate < 0;
        wv.isUpwind = isUpwind;

        const effR = Math.max(2.6, Math.min(7.5, donutRadius));
        const arcInnerR = donutRadius + tubeRadius * 0.96;
        const arcOuterR = arcInnerR * 1.062;
        wv.leftArc.mesh.scale.set(arcInnerR, arcInnerR, 1);
        wv.rightArc.mesh.scale.set(arcInnerR, arcInnerR, 1);

        const chevScaleXY = effR * 0.46;
        const flankX = arcOuterR + 0.22 + chevScaleXY * 0.5;
        const stackStepY = effR * 0.47;
        const chevRotZ = isUpwind ? 0 : Math.PI;

        wv.flankChevrons.forEach((entry) => {
            entry.mesh.scale.set(chevScaleXY, chevScaleXY, 0.46);
            entry.mesh.rotation.z = chevRotZ;
            entry.baseX = entry.side * flankX;
            entry.baseY = (entry.index - 1) * stackStepY;
            entry.mesh.position.set(entry.baseX, entry.baseY, 0);
        });

        const badgeH = Math.max(1.85, Math.min(2.65, effR * 0.48));
        wv.badgeSprite.scale.set(badgeH * 4.0, badgeH, 1);
        const nextBadgeKey = `${isUpwind ? 'U' : 'D'}:${gradAtGate.toFixed(1)}`;
        if (wv.badgeKey !== nextBadgeKey) {
            wv.badgeKey = nextBadgeKey;
            wv.badgeMat.map = this.getWindBadgeTexture(gradAtGate, isUpwind);
            wv.badgeMat.needsUpdate = true;
        }

        const vertScaleX = effR * 0.56;
        const vertScaleY = effR * 0.41;
        const vertStep = effR * 0.16 + 0.42;
        const idealBadgeY = isUpwind
            ? (-donutRadius - tubeRadius - 1.45 - vertStep - effR * 0.24)
            : (-donutRadius - tubeRadius - 1.45);
        const minLocalBadgeY = 1.85 - gate.gateY;
        wv.badgeClamped = idealBadgeY < minLocalBadgeY;
        wv.badgeBaseY = Math.max(minLocalBadgeY, idealBadgeY);

        const upwindStart = wv.badgeClamped
            ? (wv.badgeBaseY + badgeH * 0.60 + 0.55)
            : (-donutRadius - tubeRadius - 1.20 - vertStep);
        const downwindCrownTop = textOffsetY + 2.25 + vertStep;

        wv.verticalChevrons.forEach((entry) => {
            entry.mesh.scale.set(vertScaleX, vertScaleY, 0.43);
            entry.mesh.rotation.z = chevRotZ;
            entry.baseY = isUpwind
                ? (upwindStart + entry.index * vertStep)
                : (downwindCrownTop - entry.index * vertStep);
            entry.mesh.position.set(0, entry.baseY, 0);
        });

        this.animateGateWindVisual(gate, wv.badgeSprite.visible ? 0 : 99);
    }

    animateGateWindVisual(gate, upcomingWindRank) {
        if (!gate || !gate.windVisual || !gate.windVisual.group.visible) return;
        const wv = gate.windVisual;
        const isUpwind = wv.isUpwind;
        const absSlope = Math.abs(gate.gradAtGate || 0);
        const effR = Math.max(2.6, Math.min(7.5, gate.donutRadius || 4.8));

        if (gate.passed && gate.cleared) {
            this._windColBase.setHex(0x4ade80);
            this._windColCrest.setHex(0x86efac);
        } else if (isUpwind) {
            this._windColBase.setHex(0x10b981);
            this._windColCrest.setHex(0x6ee7b7);
        } else {
            this._windColBase.setHex(0xf97316);
            this._windColCrest.setHex(0xfdba74);
        }

        const intensity = Math.min(1.0, 0.58 + Math.min(7.0, absSlope) * 0.06) * (gate.passed ? 0.52 : 1.0);
        const waveSpeed = 3.0 + Math.min(8.0, absSlope) * 0.35;
        const dirSign = isUpwind ? 1 : -1;
        const gateOffset = (gate.workoutSec || 0) * 0.35;

        wv.flankChevrons.forEach((entry) => {
            const phase = this.windAnimTime * waveSpeed - dirSign * entry.index * 1.05 - gateOffset;
            const pulse = 0.5 + 0.5 * Math.sin(phase);
            entry.mesh.position.y = entry.baseY + Math.sin(phase) * (effR * 0.055) * dirSign;
            entry.mat.color.copy(this._windColBase).lerp(this._windColCrest, pulse * pulse);
            entry.mat.opacity = (0.34 + 0.66 * pulse) * intensity;
        });

        wv.verticalChevrons.forEach((entry) => {
            const phase = this.windAnimTime * waveSpeed - entry.index * 1.15 - gateOffset;
            const pulse = 0.5 + 0.5 * Math.sin(phase);
            entry.mesh.position.y = entry.baseY + Math.sin(phase) * (effR * 0.05) * dirSign;
            entry.mat.color.copy(this._windColBase).lerp(this._windColCrest, pulse * pulse);
            entry.mat.opacity = (0.40 + 0.60 * pulse) * intensity;
        });

        const haloPulse = 0.5 + 0.5 * Math.sin(this.windAnimTime * waveSpeed * 0.75 - gateOffset);
        wv.leftArc.mat.color.copy(this._windColBase).lerp(this._windColCrest, haloPulse * 0.45);
        wv.rightArc.mat.color.copy(wv.leftArc.mat.color);
        const arcOpacity = (0.42 + 0.28 * haloPulse) * intensity;
        wv.leftArc.mat.opacity = arcOpacity;
        wv.rightArc.mat.opacity = arcOpacity;

        const showBadge = !gate.passed && upcomingWindRank < 2;
        wv.badgeSprite.visible = showBadge;
        if (showBadge) {
            const camSideZ = (this.camera && this.camera.position.z < gate.worldZ) ? -1 : 1;
            const zOff = wv.badgeClamped
                ? camSideZ * ((gate.tubeRadius || 0.75) + 0.55)
                : camSideZ * 0.25;
            wv.badgeSprite.position.set(0, wv.badgeBaseY, zOff);
            wv.badgeMat.opacity = upcomingWindRank === 0 ? 0.96 : 0.82;
        }
    }

    /**
     * Avatar model builders and procedural textures are loaded from external `loop-kicker-journey-models.js`
     * (window.LoopKickerJourneyAvatarModels) and bound onto DragonSky3DEngine.prototype.
     */
    createDragonHornBoneTexture() {
        return window.LoopKickerJourneyAvatarModels.createDragonHornBoneTexture.call(this);
    }

    createCamberedWingPanelGeometry(origin, p1, p2, camberHeight = 0.24, radialSteps = 6, spanSteps = 6) {
        return window.LoopKickerJourneyAvatarModels.createCamberedWingPanelGeometry.call(
            this,
            origin,
            p1,
            p2,
            camberHeight,
            radialSteps,
            spanSteps
        );
    }

    createWyvernHideTexture() {
        return window.LoopKickerJourneyAvatarModels.createWyvernHideTexture.call(this);
    }

    createWyvernMembraneTexture() {
        return window.LoopKickerJourneyAvatarModels.createWyvernMembraneTexture.call(this);
    }

    buildAeroWyvern() {
        return window.LoopKickerJourneyAvatarModels.buildAeroWyvern.call(this);
    }

    updateAeroWyvern(dt, ctx) {
        return window.LoopKickerJourneyAvatarModels.updateAeroWyvern.call(this, dt, ctx);
    }

    updateAvatarDynamics(dt, ctx) {
        return window.LoopKickerJourneyAvatarModels.updateAvatarDynamics.call(this, dt, ctx);
    }

    resetAvatarAnimationParts() {
        return window.LoopKickerJourneyAvatarModels.resetAvatarAnimationParts.call(this);
    }

    /**
     * Builds a translucent cyan copy of the active avatar for the loaded ghost ride.
     * The avatar builders store animation parts on the engine, so the ghost is a static clone
     * instead of a second build.
     */
    rebuildGhostModel() {
        if (this.ghostGroup) {
            this.scene.remove(this.ghostGroup);
            this.ghostGroup.traverse((obj) => {
                if (!obj.material) return;
                (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((mat) => mat.dispose());
            });
            this.ghostGroup = null;
        }
        if (!state.ghost || !this.dragonGroup || !this.scene) return;

        const ghost = this.dragonGroup.clone(true);
        const lights = [];
        const toGhostMaterial = (mat) => {
            const ghostMat = mat.clone();
            ghostMat.transparent = true;
            ghostMat.opacity = (typeof mat.opacity === 'number' ? mat.opacity : 1) * 0.38;
            ghostMat.depthWrite = false;
            if (ghostMat.emissive) {
                ghostMat.emissive = new THREE.Color(0x22d3ee);
                ghostMat.emissiveIntensity = 0.6;
            } else if (ghostMat.color) {
                ghostMat.color.lerp(new THREE.Color(0x67e8f9), 0.5);
            }
            return ghostMat;
        };
        ghost.traverse((obj) => {
            if (obj.isLight) lights.push(obj);
            if (obj.material) {
                obj.material = Array.isArray(obj.material)
                    ? obj.material.map(toGhostMaterial)
                    : toGhostMaterial(obj.material);
            }
            obj.castShadow = false;
            obj.receiveShadow = false;
            obj.renderOrder = 2;
        });
        lights.forEach((light) => light.parent && light.parent.remove(light));

        this.ghostCurrentY = this.dragonCurrentY;
        this.ghostGroup = ghost;
        this.scene.add(ghost);
        this.updateGhost(0);
    }

    updateGhost(dt) {
        if (!this.ghostGroup) return;
        if (!state.ghost) {
            this.ghostGroup.visible = false;
            return;
        }
        const sec = state.elapsedSec;
        const subSec = state.isRunning ? Math.max(0, Math.min(1, this.subSec || 0)) : 0;
        const before = getGhostRideTotalsAfterSecond(sec - 1);
        const after = getGhostRideTotalsAfterSecond(sec);
        const ghostDistance = before.distance + (after.distance - before.distance) * subSec;
        const ownDistance = state.totalDistanceMeters + (state.isRunning ? (state.speedKmh / 3.6) * subSec : 0);
        const zOffset = Math.max(-GHOST_MAX_Z_OFFSET, Math.min(GHOST_MAX_Z_OFFSET, (ghostDistance - ownDistance) * GHOST_WORLD_UNITS_PER_METER));
        const ghostZ = this.flightZ - zOffset;

        const desiredY = wattsToSkyAltitudeY(getGhostRideWattsAtSecond(sec), state.ftp, state.currentGradientPct);
        if (typeof this.ghostCurrentY !== 'number' || isNaN(this.ghostCurrentY)) {
            this.ghostCurrentY = desiredY;
        } else {
            this.ghostCurrentY += (desiredY - this.ghostCurrentY) * Math.min(1, dt * 2.5);
        }
        const bob = Math.sin(performance.now() * 0.003) * 0.15;
        const heading = Math.atan(-getSimulatedTurnDerivativeX(ghostZ));

        this.ghostGroup.visible = true;
        this.ghostGroup.position.set(getSimulatedTurnOffsetX(ghostZ) + GHOST_LATERAL_OFFSET_X, this.ghostCurrentY + bob, ghostZ);
        this.ghostGroup.rotation.order = 'YXZ';
        this.ghostGroup.rotation.set(0, -heading, 0);
    }

    /**
     * Positions the camera according to state.cameraView (keys 1-5):
     * 1 chase, 2 far chase, 3 top-down, 4 front close, 5 front far.
     * Front views sit ahead of the avatar and retreat with it while looking back at it.
     * Switching views blends smoothly from the previous camera pose.
     */
    applyCameraPerspective(dt, { dragonWorldX, chasePos, chaseLook }) {
        const view = CAMERA_VIEWS[state.cameraView] ? state.cameraView : 1;
        const heading = this.dragonHeadingAngle || 0;
        const fwdX = Math.sin(heading);
        const fwdZ = -Math.cos(heading);
        const dY = this.dragonCurrentY;
        const dZ = this.flightZ;
        let pos;
        let look;
        let roll = 0;

        switch (view) {
            case 2:
                pos = [chasePos[0] - fwdX * 10, dY + 10.5, dZ + 36];
                look = [chaseLook[0], chaseLook[1] * 0.6 + dY * 0.4, chaseLook[2]];
                roll = this.dragonRollAngle * 0.08;
                break;
            case 3:
                pos = [dragonWorldX - fwdX * 6, dY + 42, dZ + 7];
                look = [dragonWorldX + fwdX * 10, dY, dZ - 10];
                break;
            case 4:
                pos = [dragonWorldX + fwdX * 11, dY + 1.8, dZ + fwdZ * 11];
                look = [dragonWorldX, dY + 0.4, dZ];
                break;
            case 5:
                pos = [dragonWorldX + fwdX * 30, dY + 7.5, dZ + fwdZ * 30];
                look = [dragonWorldX, dY, dZ];
                break;
            default:
                pos = chasePos;
                look = chaseLook;
                roll = this.dragonRollAngle * 0.14;
        }

        if (this.cameraViewApplied !== view) {
            const hadView = typeof this.cameraViewApplied === 'number';
            this.cameraViewApplied = view;
            this.cameraBlendPos = hadView
                ? [this.camera.position.x - pos[0], this.camera.position.y - pos[1], this.camera.position.z - pos[2]]
                : [0, 0, 0];
            this.cameraBlendLook = hadView && this.cameraLastLook
                ? [this.cameraLastLook[0] - look[0], this.cameraLastLook[1] - look[1], this.cameraLastLook[2] - look[2]]
                : [0, 0, 0];
        }

        const decay = Math.exp(-Math.max(0, dt) * 3.2);
        for (let i = 0; i < 3; i++) {
            this.cameraBlendPos[i] *= decay;
            this.cameraBlendLook[i] *= decay;
        }

        const finalLook = [look[0] + this.cameraBlendLook[0], look[1] + this.cameraBlendLook[1], look[2] + this.cameraBlendLook[2]];
        this.camera.position.set(pos[0] + this.cameraBlendPos[0], pos[1] + this.cameraBlendPos[1], pos[2] + this.cameraBlendPos[2]);
        this.camera.lookAt(finalLook[0], finalLook[1], finalLook[2]);
        if (view === 1 || view === 2) {
            this.camera.rotation.z = roll;
        }
        this.cameraLastLook = finalLook;
    }

    buildActiveAvatar(avatarType = 'aero_wyvern') {
        return window.LoopKickerJourneyAvatarModels.buildActiveAvatar.call(this, avatarType);
    }

    createFuchurPearlFurScaleTexture() {
        return window.LoopKickerJourneyAvatarModels.createFuchurPearlFurScaleTexture.call(this);
    }

    createFuchurSilkyManeTexture() {
        return window.LoopKickerJourneyAvatarModels.createFuchurSilkyManeTexture.call(this);
    }

    buildFuchurLuckdragon() {
        return window.LoopKickerJourneyAvatarModels.buildFuchurLuckdragon.call(this);
    }

    createETWrinkledSkinTexture() {
        return window.LoopKickerJourneyAvatarModels.createETWrinkledSkinTexture.call(this);
    }

    updateEtBikePedaling(crankAngle = 0) {
        return window.LoopKickerJourneyAvatarModels.updateEtBikePedaling.call(this, crankAngle);
    }

    buildBoyWithBicycleAndET() {
        return window.LoopKickerJourneyAvatarModels.buildBoyWithBicycleAndET.call(this);
    }

    createDeLoreanBrushedSteelTexture() {
        return window.LoopKickerJourneyAvatarModels.createDeLoreanBrushedSteelTexture.call(this);
    }

    createOutatimeLicensePlateTexture() {
        return window.LoopKickerJourneyAvatarModels.createOutatimeLicensePlateTexture.call(this);
    }

    createTimeCircuitsDisplayTexture() {
        return window.LoopKickerJourneyAvatarModels.createTimeCircuitsDisplayTexture.call(this);
    }

    buildBackToTheFutureDeLorean() {
        return window.LoopKickerJourneyAvatarModels.buildBackToTheFutureDeLorean.call(this);
    }

    createMarsAttacksChromeHullTexture() {
        return window.LoopKickerJourneyAvatarModels.createMarsAttacksChromeHullTexture.call(this);
    }

    createMartianBrainTexture() {
        return window.LoopKickerJourneyAvatarModels.createMartianBrainTexture.call(this);
    }

    buildMarsAttacksUfo() {
        return window.LoopKickerJourneyAvatarModels.buildMarsAttacksUfo.call(this);
    }

    /**
     * Builds a 3D extruded mesh for Target Gate Watts text ("138W") positioned above the gate torus.
     */
    create3DWattTextMesh(watts, colorHex) {
        const label = `${Math.round(watts)}W`;
        const glyphs = {
            '0': [[0,0,1,0,0,6,1,6],[0,5,3,5,3,6,0,6],[2,0,3,0,3,6,2,6],[0,0,3,0,3,1,0,1]],
            '1': [[1,0,2,0,2,6,1,6],[0,5,2,5,2,6,0,6],[0,0,3,0,3,1,0,1]],
            '2': [[0,5,3,5,3,6,0,6],[2,2.5,3,2.5,3,6,2,6],[0,2.5,3,2.5,3,3.5,0,3.5],[0,0,1,0,1,3.5,0,3.5],[0,0,3,0,3,1,0,1]],
            '3': [[0,5,3,5,3,6,0,6],[2,0,3,0,3,6,2,6],[0.5,2.5,3,2.5,3,3.5,0.5,3.5],[0,0,3,0,3,1,0,1]],
            '4': [[0,2.5,1,2.5,1,6,0,6],[0,2.5,3,2.5,3,3.5,0,3.5],[2,0,3,0,3,6,2,6]],
            '5': [[0,5,3,5,3,6,0,6],[0,2.5,1,2.5,1,6,0,6],[0,2.5,3,2.5,3,3.5,0,3.5],[2,0,3,0,3,3.5,2,3.5],[0,0,3,0,3,1,0,1]],
            '6': [[0,5,3,5,3,6,0,6],[0,0,1,0,1,6,0,6],[0,2.5,3,2.5,3,3.5,0,3.5],[2,0,3,0,3,3.5,2,3.5],[0,0,3,0,3,1,0,1]],
            '7': [[0,5,3,5,3,6,0,6],[2,0,3,0,3,6,2,6]],
            '8': [[0,0,1,0,1,6,0,6],[2,0,3,0,3,6,2,6],[0,5,3,5,3,6,0,6],[0,2.5,3,2.5,3,3.5,0,3.5],[0,0,3,0,3,1,0,1]],
            '9': [[0,5,3,5,3,6,0,6],[0,2.5,1,2.5,1,6,0,6],[2,0,3,0,3,6,2,6],[0,2.5,3,2.5,3,3.5,0,3.5],[0,0,3,0,3,1,0,1]],
            'W': [[0,0,0.8,0,0.8,6,0,6],[3.2,0,4,0,4,6,3.2,6],[1.6,0,2.4,0,2.4,3.8,1.6,3.8],[0,0,4,0,4,1,0,1]]
        };
        const textGroup = new THREE.Group();
        const mat = new THREE.MeshPhongMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.65,
            shininess: 90
        });
        const scale = 0.28;
        const depth = 0.36;
        let cursorX = 0;
        const charWidths = [];
        for (let i = 0; i < label.length; i++) {
            const ch = label[i];
            charWidths.push(ch === 'W' ? 4.0 : 3.0);
        }
        const spacing = 0.75;
        const totalWidth = charWidths.reduce((a, b) => a + b, 0) + Math.max(0, label.length - 1) * spacing;
        cursorX = -totalWidth * 0.5;

        for (let i = 0; i < label.length; i++) {
            const ch = label[i];
            const rects = glyphs[ch] || glyphs['0'];
            rects.forEach((r) => {
                const w = (r[2] - r[0]) * scale;
                const h = (r[7] - r[1]) * scale;
                const cx = (cursorX + (r[0] + r[2]) * 0.5) * scale;
                const cy = ((r[1] + r[7]) * 0.5) * scale;
                const boxGeo = new THREE.BoxGeometry(w, h, depth);
                const boxMesh = new THREE.Mesh(boxGeo, mat);
                boxMesh.position.set(cx, cy, 0);
                textGroup.add(boxMesh);
            });
            cursorX += charWidths[i] + spacing;
        }
        return { group: textGroup, material: mat, watts: Math.round(watts) };
    }

    /**
     * Orients a Donut Gate (torus & inner halo) perpendicular to the dragon's 3D flight path
     * so the dragon flies straight through the center of the torus along both horizontal curves
     * and vertical altitude climbs/descents.
     */
    alignGateToFlightPath(gateGroup, worldZ, workoutSec, gateY) {
        if (!gateGroup) return;
        const dx = getSimulatedTurnDerivativeX(worldZ);
        const yawY = Math.atan(dx);

        const prevSec = Math.max(0, workoutSec - 1);
        const nextSec = workoutSec + 1;
        const prevWatts = getTargetWattsAtSecond(state.workout, prevSec, state.ftp);
        const nextWatts = getTargetWattsAtSecond(state.workout, nextSec, state.ftp);
        const prevY = wattsToSkyAltitudeY(prevWatts, state.ftp, getGradientPctAtSecond(prevSec));
        const nextY = wattsToSkyAltitudeY(nextWatts, state.ftp, getGradientPctAtSecond(nextSec));
        const spanZ = Math.max(1, (nextSec - prevSec) * this.gateSpacingZ);
        const dyDz = (nextY - prevY) / spanZ;
        const horizStep = Math.hypot(1, dx);
        const pitchX = Math.max(-0.65, Math.min(0.65, Math.atan2(dyDz, horizStep)));

        gateGroup.rotation.order = 'YXZ';
        gateGroup.rotation.set(pitchX, yawY, 0);
    }

    /**
     * Synchronizes a Donut Gate's center position (Y), accuracy radius, 3D watt text above the torus, and color
     * with the exact desired watt value at its assigned `workoutSec`.
     */
    getUpcomingGateTargetWatts() {
        let next = null;
        for (const g of this.gates) {
            if (!g.passed && (!next || g.workoutSec < next.workoutSec)) next = g;
        }
        return next ? next.targetWatts : null;
    }

    syncGateToDesiredWatts(gate) {
        if (!gate) return;
        const baseWatts = getBaseTargetWattsAtSecond(state.workout, gate.workoutSec, state.ftp);
        const gradAtGate = getGradientPctAtSecond(gate.workoutSec);
        const targetWatts = getTargetWattsAtSecond(state.workout, gate.workoutSec, state.ftp);
        const gateY = wattsToSkyAltitudeY(targetWatts, state.ftp, gradAtGate);
        const donutRadius = getDonutRadiusForTargetWatts(targetWatts, state.ftp, gradAtGate);
        const tubeRadius = Math.max(0.32, Math.min(0.95, donutRadius * 0.16));

        gate.baseWatts = baseWatts;
        gate.targetWatts = targetWatts;
        gate.gateY = gateY;
        gate.centerY = gateY;
        gate.donutRadius = donutRadius;
        gate.torusRadius = donutRadius;
        gate.group.position.set(gate.gateX, gateY, gate.worldZ);
        this.alignGateToFlightPath(gate.group, gate.worldZ, gate.workoutSec, gateY);

        if (gate.baseDonutRadius && gate.baseDonutRadius > 0) {
            const radiusScale = donutRadius / gate.baseDonutRadius;
            if (gate.torusMesh) gate.torusMesh.scale.set(radiusScale, radiusScale, radiusScale);
            if (gate.innerHalo) gate.innerHalo.scale.set(radiusScale, radiusScale, radiusScale);
        }

        const frac = baseWatts / Math.max(100, state.ftp);
        let ringColor = 0x38bdf8;
        if (frac >= 1.05) ringColor = 0xf97316;
        else if (frac >= 0.90) ringColor = 0xfacc15;
        else if (frac >= 0.75) ringColor = 0x10b981;

        if (!gate.passed && gate.torusMat) {
            gate.torusMat.color.setHex(ringColor);
            gate.torusMat.emissive.setHex(ringColor);
        }

        // Keep 3D Target Gate Watts text positioned directly above the gate torus
        const textOffsetY = donutRadius + tubeRadius + 0.85;
        if (!gate.wattText3D || gate.wattText3D.watts !== Math.round(targetWatts)) {
            if (gate.wattText3D && gate.wattText3D.group) {
                gate.group.remove(gate.wattText3D.group);
            }
            gate.wattText3D = this.create3DWattTextMesh(targetWatts, gate.passed && gate.cleared ? 0x4ade80 : ringColor);
            gate.group.add(gate.wattText3D.group);
        } else if (!gate.passed && gate.wattText3D.material) {
            gate.wattText3D.material.color.setHex(ringColor);
            gate.wattText3D.material.emissive.setHex(ringColor);
        }
        if (gate.wattText3D && gate.wattText3D.group) {
            gate.wattText3D.group.position.set(0, textOffsetY, 0);
        }

        this.syncGateWindVisual(gate, donutRadius, tubeRadius, textOffsetY, gradAtGate);

        if (gate.linkedObstacle && !gate.linkedObstacle.destroyed && !gate.linkedObstacle.hitTriggered) {
            gate.linkedObstacle.obsY = gateY;
            gate.linkedObstacle.group.position.y = gateY;
        }
    }

    /**
     * Spawns a 3D Donut Gate (TorusGeometry) at `worldZ`.
     * Its geometric center `(gateX, gateY, worldZ)` is placed directly at the desired watt value's
     * sky altitude (`gateY = wattsToSkyAltitudeY(targetWatts, state.ftp)`), and its radius matches
     * the ±5% watt accuracy required to award points (`getDonutRadiusForTargetWatts`).
     */
    spawnDonutGate(worldZ, workoutSec) {
        if (!this.initialized) return;
        const resolvedWorkoutSec = Math.max(0, Math.round(workoutSec));
        const baseWatts = getBaseTargetWattsAtSecond(state.workout, resolvedWorkoutSec, state.ftp);
        const gradAtGate = getGradientPctAtSecond(resolvedWorkoutSec);
        const targetWatts = getTargetWattsAtSecond(state.workout, resolvedWorkoutSec, state.ftp);
        const gateY = wattsToSkyAltitudeY(targetWatts, state.ftp, gradAtGate);
        const donutRadius = getDonutRadiusForTargetWatts(targetWatts, state.ftp, gradAtGate);
        const gateX = getSimulatedTurnOffsetX(worldZ);

        const gateGroup = new THREE.Group();

        // Outer Glowing Donut Ring (TorusGeometry centered at local origin 0,0,0; radius scales with configurable accuracy)
        const torusRadius = donutRadius;
        const tubeRadius = Math.max(0.32, Math.min(0.95, torusRadius * 0.16));
        const torusGeo = new THREE.TorusGeometry(torusRadius, tubeRadius, 18, 44);
        const frac = baseWatts / Math.max(100, state.ftp);
        let ringColor = 0x38bdf8;
        if (frac >= 1.05) ringColor = 0xf97316;
        else if (frac >= 0.90) ringColor = 0xfacc15;
        else if (frac >= 0.75) ringColor = 0x10b981;

        const torusMat = new THREE.MeshPhongMaterial({
            color: ringColor,
            emissive: ringColor,
            emissiveIntensity: 0.5,
            shininess: 95
        });
        const torusMesh = new THREE.Mesh(torusGeo, torusMat);
        torusMesh.position.set(0, 0, 0);
        gateGroup.add(torusMesh);

        // Inner Energy Halo Ring (centered at local origin 0,0,0)
        const innerHaloOuter = Math.max(0.2, torusRadius - tubeRadius * 0.95);
        const innerHaloInner = Math.max(0.1, innerHaloOuter - Math.max(0.15, torusRadius * 0.07));
        const innerHaloGeo = new THREE.RingGeometry(innerHaloInner, innerHaloOuter, 36);
        const innerHaloMat = new THREE.MeshBasicMaterial({
            color: 0xfef08a,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        const innerHalo = new THREE.Mesh(innerHaloGeo, innerHaloMat);
        innerHalo.position.set(0, 0, 0);
        gateGroup.add(innerHalo);

        const windVisual = this.createGateWindVisual();
        if (windVisual) {
            gateGroup.add(windVisual.group);
        }

        gateGroup.position.set(gateX, gateY, worldZ);
        // Orient donut perpendicular to the 3D curved & pitched flight path so the dragon flies straight through the torus center
        this.alignGateToFlightPath(gateGroup, worldZ, resolvedWorkoutSec, gateY);

        this.scene.add(gateGroup);
        const gateObj = {
            group: gateGroup,
            torusMesh,
            innerHalo,
            torusMat,
            innerHaloMat,
            windVisual,
            gradAtGate,
            tubeRadius,
            worldZ,
            workoutSec: resolvedWorkoutSec,
            gateX,
            gateY,
            centerY: gateY,
            donutRadius,
            torusRadius,
            baseDonutRadius: donutRadius,
            baseWatts,
            targetWatts,
            passed: false,
            cleared: false,
            linkedObstacle: null
        };
        this.gates.push(gateObj);

        // Optionally spawn a destructible 3D obstacle between gates and evil dragon hunters on the riverbanks when enabled
        this.gateCounter += 1;
        if (state.renderObstacles && this.gateCounter % 2 === 0) {
            const obs = this.spawnObstacle(worldZ + this.gateSpacingZ * 0.48, gateY);
            gateObj.linkedObstacle = obs || null;
        }
        if (state.renderObstacles) {
            this.spawnDragonHunterPair(worldZ + this.gateSpacingZ * 0.32);
        }
        this.syncGateToDesiredWatts(gateObj);
    }

    /**
     * Spawns evil Dragon Hunters standing left and right from the river on the riverbanks.
     * When obstacles are enabled, they aim at the dragon and fire arrows pointed directly at the dragon.
     */
    spawnDragonHunter(worldZ, sideSign) {
        if (!this.initialized) return null;
        const canyonCenterX = getSimulatedTurnOffsetX(worldZ);
        const bankOffset = sideSign * (11.0 + Math.random() * 4.5); // Left (< -8.5) and right (> +8.5) from the river
        const hunterX = canyonCenterX + bankOffset;
        const groundY = Math.max(0.2, this.getTerrainElevationAt(bankOffset, worldZ));

        const hunterGroup = new THREE.Group();

        // Dark armored torso & cloak
        const cloakGeo = new THREE.ConeGeometry(1.15, 3.2, 8);
        const cloakMat = new THREE.MeshLambertMaterial({ color: 0x1e1b4b, flatShading: true });
        const cloakMesh = new THREE.Mesh(cloakGeo, cloakMat);
        cloakMesh.position.y = 1.6;
        hunterGroup.add(cloakMesh);

        // Crimson shoulder pauldrons
        const pauldronGeo = new THREE.BoxGeometry(1.9, 0.45, 0.95);
        const pauldronMat = new THREE.MeshLambertMaterial({ color: 0x991b1b });
        const pauldronMesh = new THREE.Mesh(pauldronGeo, pauldronMat);
        pauldronMesh.position.y = 2.75;
        hunterGroup.add(pauldronMesh);

        // Hooded head & glowing evil eyes
        const headGeo = new THREE.SphereGeometry(0.58, 10, 10);
        const headMat = new THREE.MeshLambertMaterial({ color: 0x312e81 });
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.y = 3.45;
        hunterGroup.add(headMesh);

        const eyeGeo = new THREE.SphereGeometry(0.11, 6, 6);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        [-0.2, 0.2].forEach((ex) => {
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(ex, 3.5, 0.5);
            hunterGroup.add(eye);
        });

        // Pivoting Bow / Crossbow Aim Group that tracks the dragon
        const bowPivot = new THREE.Group();
        bowPivot.position.set(0, 2.65, 0);
        const bowArcGeo = new THREE.TorusGeometry(0.95, 0.1, 8, 16, Math.PI);
        const bowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const bowArc = new THREE.Mesh(bowArcGeo, bowMat);
        bowArc.rotation.y = Math.PI / 2;
        bowPivot.add(bowArc);
        hunterGroup.add(bowPivot);

        hunterGroup.position.set(hunterX, groundY, worldZ);
        this.scene.add(hunterGroup);

        const hunterObj = {
            group: hunterGroup,
            bowPivot,
            worldZ,
            sideSign,
            bankOffset,
            hunterX,
            groundY,
            hasFired: false,
            fireCooldown: 0.4 + Math.random() * 0.7
        };
        this.dragonHunters.push(hunterObj);
        return hunterObj;
    }

    spawnDragonHunterPair(worldZ) {
        if (!this.initialized || !state.renderObstacles) return;
        this.spawnDragonHunter(worldZ, -1); // Left of the river
        this.spawnDragonHunter(worldZ - 14.0, 1); // Right of the river
    }

    /**
     * Fires an arrow from an evil dragon hunter pointed directly in the direction of the dragon.
     */
    fireHunterArrowAtDragon(hunter) {
        if (!this.initialized || !hunter || !this.dragonGroup) return null;
        const startPos = new THREE.Vector3(
            hunter.group.position.x,
            hunter.group.position.y + 2.8,
            hunter.group.position.z
        );
        const dragonPos = this.dragonGroup.position.clone();
        // Lead slightly or aim directly at the dragon's center mass
        const direction = new THREE.Vector3().subVectors(dragonPos, startPos);
        if (direction.lengthSq() < 0.001) {
            direction.set(0, 0, 1);
        } else {
            direction.normalize();
        }

        const arrowGroup = new THREE.Group();
        arrowGroup.position.copy(startPos);

        // Build arrow meshes aligned along local +Z so `arrowGroup.lookAt(...)` points the arrowhead directly along `direction`
        const shaftLen = 3.4;
        const shaftGeo = new THREE.CylinderGeometry(0.08, 0.08, shaftLen, 7);
        shaftGeo.rotateX(Math.PI / 2);
        const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
        const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
        arrowGroup.add(shaftMesh);

        const tipGeo = new THREE.ConeGeometry(0.26, 0.75, 8);
        tipGeo.rotateX(Math.PI / 2);
        const tipMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const tipMesh = new THREE.Mesh(tipGeo, tipMat);
        tipMesh.position.z = shaftLen * 0.5 + 0.32;
        arrowGroup.add(tipMesh);

        const fletchGeo = new THREE.BoxGeometry(0.45, 0.12, 0.65);
        const fletchMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        const fletchMesh = new THREE.Mesh(fletchGeo, fletchMat);
        fletchMesh.position.z = -shaftLen * 0.5 + 0.3;
        arrowGroup.add(fletchMesh);

        const targetPoint = startPos.clone().add(direction.clone().multiplyScalar(25.0));
        arrowGroup.lookAt(targetPoint);

        this.scene.add(arrowGroup);

        const arrowSpeed = 88.0;
        const arrowObj = {
            mesh: arrowGroup,
            direction: direction.clone(),
            speed: arrowSpeed,
            vx: direction.x * arrowSpeed,
            vy: direction.y * arrowSpeed,
            vz: direction.z * arrowSpeed,
            life: 3.5,
            hitTriggered: false
        };
        this.hunterArrows.push(arrowObj);
        return arrowObj;
    }

    handleArrowHitPenalty(arrow) {
        if (!arrow || arrow.hitTriggered) return;
        arrow.hitTriggered = true;
        this.scene.remove(arrow.mesh);

        // Deduct points when an arrow hits the dragon
        const penaltyPts = 75;
        state.totalScore = Math.max(0, state.totalScore - penaltyPts);
        state.streakSeconds = 0;
        state.comboMultiplier = 1.0;
        state.arrowHitsCount = (state.arrowHitsCount || 0) + 1;

        soundEngine.playObstacleHitPenalty();
        spawnArrowHitPenaltyPopup(penaltyPts);

        const arenaCard = document.getElementById('hudArenaCard');
        if (arenaCard) {
            arenaCard.classList.add('obstacle-hit-flash');
            setTimeout(() => arenaCard.classList.remove('obstacle-hit-flash'), 420);
        }

        updateLiveHud();
    }

    /**
     * Spawns a 3D Spiky Crystal/Meteor Obstacle in the dragon's flight path.
     * User must press SPACEBAR at the right moment to blast it with dragon fire,
     * or colliding with it decreases collected points!
     */
    spawnObstacle(worldZ, referenceY) {
        if (!this.initialized) return;
        const obsX = getSimulatedTurnOffsetX(worldZ);
        const obsY = referenceY;

        const obsGroup = new THREE.Group();

        // Core dark-crimson crystal octahedron
        const coreGeo = new THREE.OctahedronGeometry(2.6, 1);
        const coreMat = new THREE.MeshPhongMaterial({
            color: 0xe11d48,
            emissive: 0x881337,
            emissiveIntensity: 0.65,
            flatShading: true,
            shininess: 85
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        obsGroup.add(coreMesh);

        // Warning Laser Ring around the obstacle
        const warnRingGeo = new THREE.TorusGeometry(3.8, 0.18, 10, 28);
        const warnRingMat = new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.85
        });
        const warnRing = new THREE.Mesh(warnRingGeo, warnRingMat);
        obsGroup.add(warnRing);

        obsGroup.position.set(obsX, obsY, worldZ);
        this.scene.add(obsGroup);

        const obsObj = {
            group: obsGroup,
            coreMesh,
            warnRing,
            warnRingMat,
            worldZ,
            obsX,
            obsY,
            destroyed: false,
            hitTriggered: false
        };
        this.obstacles.push(obsObj);
        return obsObj;
    }

    seedInitialGatesAndObstacles(preserveVerticalCameraAndDragon = false) {
        if (!this.initialized) return;
        // Clear existing
        this.gates.forEach(g => {
            this.disposeGateWindVisual(g);
            this.scene.remove(g.group);
        });
        this.obstacles.forEach(o => this.scene.remove(o.group));
        this.dragonHunters.forEach(h => this.scene.remove(h.group));
        this.hunterArrows.forEach(a => this.scene.remove(a.mesh));
        this.gates = [];
        this.obstacles = [];
        this.dragonHunters = [];
        this.hunterArrows = [];
        this.flightZ = 0;
        this.nextGateZ = -60;
        this.baseElapsedSec = state.elapsedSec;
        this.lastSyncedElapsedSec = state.elapsedSec;
        this.subSec = 0;
        this.nextGateWorkoutSec = state.elapsedSec;
        this.gateCounter = 0;
        this.lastClearedGateWorkoutSec = null;
        this.lastClearedGateAltitudeRatio = 0;

        const initTargetWatts = getTargetWattsAtSecond(state.workout, state.elapsedSec, state.ftp);
        const initEffectiveWatts = Math.max(0, Number(state.actualWatts) || 0);
        const targetSkyY = wattsToSkyAltitudeY(initTargetWatts, state.ftp, state.currentGradientPct);
        const effectiveSkyY = wattsToSkyAltitudeY(initEffectiveWatts, state.ftp, state.currentGradientPct);
        if (!preserveVerticalCameraAndDragon) {
            this.dragonCurrentY = effectiveSkyY;
            this.dragonVelocityY = 0;
            this.dragonSteerOffsetX = 0;
            this.dragonHeadingAngle = Math.atan(-getSimulatedTurnDerivativeX(0));
            this.dragonHeadingVelocity = 0;
            this.dragonLateralVelocityX = 0;
            this.wallContactSide = 0;
            this.dragonHeadingAngle = Math.atan(-getSimulatedTurnDerivativeX(0));
            this.dragonHeadingVelocity = 0;
            this.dragonLateralVelocityX = 0;
            this.dragonBankAngle = 0;
            this.dragonRollAngle = 0;
            this.dragonPitchAngle = 0;
            this.wallContactSide = 0;
            this.dragonWorldX = getSimulatedTurnOffsetX(0);
            state.dragonSteerOffsetX = 0;
            state.dragonHeadingAngle = this.dragonHeadingAngle;
            state.dragonWorldX = this.dragonWorldX;
            this.cameraCurrentY = this.dragonCurrentY + 2.2;
            this.cameraLookTargetY = targetSkyY * 0.50 + this.dragonCurrentY * 0.50;
        } else {
            this.dragonWorldX = getSimulatedTurnOffsetX(0) + this.dragonSteerOffsetX;
            this.dragonHeadingAngle = Math.atan(-getSimulatedTurnDerivativeX(0));
            this.dragonHeadingVelocity = 0;
            this.dragonLateralVelocityX = 0;
            this.dragonBankAngle = 0;
            this.dragonRollAngle = 0;
            this.dragonPitchAngle = 0;
            this.wallContactSide = 0;
            state.dragonWorldX = this.dragonWorldX;
            state.dragonHeadingAngle = this.dragonHeadingAngle;
        }
        if (this.dragonGroup) {
            this.dragonGroup.position.set(this.dragonWorldX, this.dragonCurrentY, 0);
            this.dragonGroup.rotation.set(0, -this.dragonHeadingAngle, 0, 'YXZ');
        }

        this.updateCanyonAndRiverWorldGeometry(0, true);

        // Re-anchor forest trees, bushes, stones, clouds, and birds around flightZ = 0 so scenery is always visible on reset
        this.trees.forEach((t, i) => {
            const zPos = -((i * 520) / Math.max(1, this.trees.length)) + 20;
            this.placeTreeNaturallyOnTerrain(t, zPos);
        });
        this.bushes.forEach((b, i) => {
            const zPos = -((i * 520) / Math.max(1, this.bushes.length)) + 20;
            this.placeBushNaturallyOnTerrain(b, zPos);
        });
        this.stones.forEach((s, i) => {
            const zPos = -((i * 520) / Math.max(1, this.stones.length)) + 20;
            this.placeStoneNaturallyOnTerrain(s, zPos);
        });
        this.clouds.forEach((c, i) => {
            const zPos = -((i * 21) % 540) + 10;
            c.mesh.position.z = zPos;
            c.mesh.position.x = getSimulatedTurnOffsetX(zPos) + (Math.random() - 0.5) * 165;
        });
        this.birds.forEach((b, i) => {
            const zPos = -40 - ((i * 23) % 360);
            b.group.position.z = zPos;
            b.group.position.x = getSimulatedTurnOffsetX(zPos) + b.xOffset;
        });

        for (let i = 0; i < 8; i++) {
            this.spawnDonutGate(this.nextGateZ, this.nextGateWorkoutSec);
            this.nextGateZ -= this.gateSpacingZ;
            this.nextGateWorkoutSec += 1;
        }
    }

    /**
     * Finds the next undestroyed obstacle ahead of the dragon along the flight course.
     */
    findNextObstacleAhead() {
        if (!this.obstacles || this.obstacles.length === 0) return null;
        let nearestUntargeted = null;
        let minUntargetedDistZ = Infinity;
        let nearestAny = null;
        let minAnyDistZ = Infinity;

        for (const obs of this.obstacles) {
            if (obs.destroyed || obs.hitTriggered) continue;
            const distZ = this.flightZ - obs.worldZ; // positive when obstacle is ahead of dragon
            if (distZ >= -6.0) {
                if (distZ < minAnyDistZ) {
                    minAnyDistZ = distZ;
                    nearestAny = obs;
                }
                if (!obs.targetedByFireball && distZ < minUntargetedDistZ) {
                    minUntargetedDistZ = distZ;
                    nearestUntargeted = obs;
                }
            }
        }
        return nearestUntargeted || nearestAny;
    }

    /**
     * Checks whether firing is currently available:
     * Firing is ONLY available a few seconds (<= 3.0s) before the next undestroyed obstacle is reached!
     */
    getFireWindowStatus() {
        const FIRE_WINDOW_SECONDS = 3.0;
        const FIREBALL_POINT_COST = 15;
        if (!state.isRunning || !state.renderObstacles) {
            return { canFire: false, nextObs: null, secondsUntilReach: Infinity, pointCost: FIREBALL_POINT_COST };
        }
        const nextObs = this.findNextObstacleAhead();
        if (!nextObs || nextObs.targetedByFireball) {
            return { canFire: false, nextObs: null, secondsUntilReach: Infinity, pointCost: FIREBALL_POINT_COST };
        }
        const distZ = this.flightZ - nextObs.worldZ;
        const currentForwardSpeed = Math.max(58.0, (state.speedKmh || 34) * 2.35);
        const secondsUntilReach = distZ / currentForwardSpeed;
        const canFire = distZ >= -2.5 && secondsUntilReach <= FIRE_WINDOW_SECONDS;
        return {
            canFire,
            nextObs,
            secondsUntilReach,
            pointCost: FIREBALL_POINT_COST
        };
    }

    /**
     * Triggered when user presses SPACEBAR (or clicks Fire Breath button).
     * Firing is ONLY available a few seconds before the next obstacle is reached,
     * costs FIREBALL_POINT_COST points so shooting is not free, and launches a 3D fireball
     * directed EXACTLY to the next obstacle!
     */
    triggerDragonFireBreath() {
        if (!this.initialized) return false;

        const fireStatus = this.getFireWindowStatus();
        if (!fireStatus.canFire || !fireStatus.nextObs) {
            return false;
        }

        const nextObs = fireStatus.nextObs;
        const fireballCost = fireStatus.pointCost;

        // Deduct fireball point cost so shooting is not free
        state.totalScore = Math.max(0, state.totalScore - fireballCost);
        spawnFireballCostPopup(fireballCost);
        updateLiveHud();

        soundEngine.playDragonFireBlast();

        // Open the dragon's lower jaw briefly when breathing fire
        if (this.dragonJawGroup) {
            this.dragonJawGroup.rotation.x = 0.45;
            setTimeout(() => {
                if (this.dragonJawGroup) this.dragonJawGroup.rotation.x = 0;
            }, 220);
        }

        const dragonPos = this.dragonGroup.position;
        const fireballGroup = new THREE.Group();
        fireballGroup.position.set(dragonPos.x, dragonPos.y + 0.9, dragonPos.z - 5.2);

        const coreGeo = new THREE.SphereGeometry(1.05, 12, 12);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        fireballGroup.add(coreMesh);

        const flameAuraGeo = new THREE.ConeGeometry(1.45, 3.8, 10);
        flameAuraGeo.rotateX(-Math.PI / 2);
        const flameAuraMat = new THREE.MeshBasicMaterial({
            color: 0xf97316,
            transparent: true,
            opacity: 0.78
        });
        const flameAura = new THREE.Mesh(flameAuraGeo, flameAuraMat);
        flameAura.position.z = 1.2;
        fireballGroup.add(flameAura);

        this.scene.add(fireballGroup);

        const fireballSpeed = Math.max(290.0, (state.speedKmh || 35) * 4.8);
        const dir = new THREE.Vector3(0, 0, -1);

        nextObs.targetedByFireball = true;
        const targetPos = nextObs.group.position;
        dir.subVectors(targetPos, fireballGroup.position);
        const initialDist = dir.length();
        if (initialDist > 0.001) {
            dir.normalize();
        } else {
            dir.set(0, 0, -1);
        }
        fireballGroup.lookAt(targetPos);

        // If the next obstacle is already at point-blank range, shatter it immediately
        if (initialDist <= 10.0) {
            this.shatterObstacle(nextObs);
        }

        this.fireballs.push({
            mesh: fireballGroup,
            targetObs: nextObs,
            speed: fireballSpeed,
            vx: dir.x * fireballSpeed,
            vy: dir.y * fireballSpeed,
            vz: dir.z * fireballSpeed,
            life: 2.4
        });

        return true;
    }

    shatterObstacle(obs) {
        obs.destroyed = true;
        this.scene.remove(obs.group);

        // Spawn 3D fiery crystal explosion shards
        const shardGeo = new THREE.TetrahedronGeometry(0.75, 0);
        const shardColors = [0xfde047, 0xf97316, 0xf43f5e, 0x38bdf8];
        for (let i = 0; i < 18; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: shardColors[i % shardColors.length]
            });
            const shard = new THREE.Mesh(shardGeo, mat);
            shard.position.copy(obs.group.position);
            this.scene.add(shard);
            this.explosionFragments.push({
                mesh: shard,
                vx: (Math.random() - 0.5) * 34,
                vy: (Math.random() - 0.3) * 30,
                vz: (Math.random() - 0.5) * 34,
                life: 0.75
            });
        }

        state.obstaclesDestroyedCount += 1;
        soundEngine.playComboUp();
        updateLiveHud();
    }

    handleObstacleCollisionPenalty(obs) {
        obs.hitTriggered = true;
        this.scene.remove(obs.group);

        // Hitting an undestroyed obstacle decreases the collected points
        const penaltyPts = 150;
        state.totalScore = Math.max(0, state.totalScore - penaltyPts);
        state.streakSeconds = 0;
        state.comboMultiplier = 1.0;
        state.obstacleHitsCount += 1;

        soundEngine.playObstacleHitPenalty();
        spawnObstaclePenaltyPopup(penaltyPts);

        const arenaCard = document.getElementById('hudArenaCard');
        arenaCard.classList.add('obstacle-hit-flash');
        setTimeout(() => arenaCard.classList.remove('obstacle-hit-flash'), 480);

        updateLiveHud();
    }

    update(dt) {
        if (!this.initialized || !state.workout) return;

        // Game starts ONLY when "Start Flight" is clicked, and Pause halts the flight of the dragon!
        const isFlying = state.isRunning;
        const currentPedaledWatts = Math.max(0, Number(state.actualWatts) || 0);
        const isPedalingWatts = currentPedaledWatts > 0;
        const isMovingForward = isFlying && isPedalingWatts;

        if (state.elapsedSec !== this.lastSyncedElapsedSec) {
            if (Math.abs(state.elapsedSec - this.lastSyncedElapsedSec) > 1) {
                this.seedInitialGatesAndObstacles(true);
            } else {
                this.lastSyncedElapsedSec = state.elapsedSec;
                this.subSec = 0;
            }
        }

        const targetWatts = getTargetWattsAtSecond(state.workout, state.elapsedSec, state.ftp);
        // Preview at target-gate altitude on the Avatar Selection screen; during gameplay use strictly pedaled/simulated watts
        const effectiveWatts = (state.currentScreen === 'avatar' && !state.isRunning && currentPedaledWatts <= 0)
            ? targetWatts
            : currentPedaledWatts;

        // Stop forward motion when the user is not generating any watts (or when paused / not started)
        const prevFlightZ = this.flightZ;
        const prevCourseX = getSimulatedTurnOffsetX(prevFlightZ);
        const forwardSpeed = isMovingForward ? this.gateSpacingZ : 0.0;
        if (isMovingForward) {
            this.subSec = Math.min(0.999, this.subSec + dt);
            const elapsedSinceSeed = Math.max(0, (state.elapsedSec - this.baseElapsedSec) + this.subSec);
            this.flightZ = -elapsedSinceSeed * this.gateSpacingZ;
        }

        // Flight-simulator heading & 3D position integration:
        // Steering left/right adjusts the dragon's heading (yaw) and bank (roll) like an aircraft,
        // and the dragon's 3D X position advances according to `Math.sin(this.dragonHeadingAngle) * forwardSpeed * dt`,
        // while bounded so the dragon can never leave the canyon.
        // When steering is turned off (`!state.steeringEnabled`), the dragon automatically steers horizontally through the gates!
        const currentCourseX = getSimulatedTurnOffsetX(this.flightZ);
        const canyonDeltaX = currentCourseX - prevCourseX;
        const canyonTangentHeading = Math.atan(-getSimulatedTurnDerivativeX(this.flightZ));
        const lookaheadCourseX = getSimulatedTurnOffsetX(this.flightZ - 22);
        const turnDelta = lookaheadCourseX - currentCourseX;

        const keyboardSteerInput = (state.steerRightPressed ? 1 : 0) - (state.steerLeftPressed ? 1 : 0);
        const sensorSteerInput = bleSteeringSensor.connected
            ? (state.bleSteerInput || 0)
            : (phoneSteeringSensor.connected ? (state.phoneSteerInput || 0) : 0);
        const rawSteerInput = keyboardSteerInput !== 0
            ? keyboardSteerInput
            : sensorSteerInput;
        const steerInput = state.steeringEnabled
            ? Math.max(-1, Math.min(1, rawSteerInput))
            : 0;
        const stepDt = Math.min(0.05, Math.max(0.001, dt));

        if (!state.steeringEnabled) {
            // Auto-steer horizontally through the gates along the canyon centerline
            this.dragonWorldX = currentCourseX;
            this.dragonSteerOffsetX = 0;
            this.dragonHeadingAngle = canyonTangentHeading;
            this.dragonHeadingVelocity = 0;
            this.dragonLateralVelocityX = 0;
            this.wallContactSide = 0;
            state.dragonWorldX = this.dragonWorldX;
            state.dragonSteerOffsetX = 0;
            state.dragonHeadingAngle = this.dragonHeadingAngle;
        } else {
            // If the dragon is touching a canyon wall, keep it aligned with the canyon direction
            // while allowing steering inward away from the wall immediately
            if (this.wallContactSide === -1) {
                if (steerInput <= 0 || this.dragonHeadingAngle < canyonTangentHeading) {
                    this.dragonHeadingAngle = canyonTangentHeading;
                }
                if (steerInput <= 0 && this.dragonHeadingVelocity < 0) {
                    this.dragonHeadingVelocity = 0;
                }
            } else if (this.wallContactSide === 1) {
                if (steerInput >= 0 || this.dragonHeadingAngle > canyonTangentHeading) {
                    this.dragonHeadingAngle = canyonTangentHeading;
                }
                if (steerInput >= 0 && this.dragonHeadingVelocity > 0) {
                    this.dragonHeadingVelocity = 0;
                }
            }

            const useDirectPhoneHeading = phoneSteeringSensor.connected && !bleSteeringSensor.connected && keyboardSteerInput === 0;
            const minHeading = canyonTangentHeading - DRAGON_MAX_HEADING_ANGLE;
            const maxHeading = canyonTangentHeading + DRAGON_MAX_HEADING_ANGLE;

            if (useDirectPhoneHeading) {
                // Phone steering directly sets the avatar's absolute heading angle
                let targetHeading = Math.max(
                    minHeading,
                    Math.min(maxHeading, canyonTangentHeading + steerInput * DRAGON_MAX_HEADING_ANGLE)
                );
                if (this.wallContactSide === -1 && targetHeading < canyonTangentHeading) {
                    targetHeading = canyonTangentHeading;
                } else if (this.wallContactSide === 1 && targetHeading > canyonTangentHeading) {
                    targetHeading = canyonTangentHeading;
                }
                const prevHeading = this.dragonHeadingAngle;
                const nextHeading = prevHeading + (targetHeading - prevHeading) * Math.min(1, stepDt * DRAGON_STEER_INERTIA_ACCEL * 2.0);
                this.dragonHeadingAngle = Math.abs(targetHeading - nextHeading) < 0.0005 ? targetHeading : nextHeading;
                this.dragonHeadingVelocity = (this.dragonHeadingAngle - prevHeading) / stepDt;
                if (Math.abs(this.dragonHeadingVelocity) < 0.001) {
                    this.dragonHeadingVelocity = 0;
                }
            } else {
                // Smooth rotational inertia for left/right steering: accelerate turn rate on input, coast smoothly to 0 on release
                const targetYawRate = steerInput * DRAGON_HEADING_TURN_RATE;
                const steerInertiaRate = steerInput !== 0 ? DRAGON_STEER_INERTIA_ACCEL : DRAGON_STEER_INERTIA_DAMPING;
                this.dragonHeadingVelocity += (targetYawRate - this.dragonHeadingVelocity) * Math.min(1, stepDt * steerInertiaRate);
                if (steerInput === 0 && Math.abs(this.dragonHeadingVelocity) < 0.001) {
                    this.dragonHeadingVelocity = 0;
                }
                if (this.wallContactSide === -1 && this.dragonHeadingVelocity < 0) {
                    this.dragonHeadingVelocity = 0;
                } else if (this.wallContactSide === 1 && this.dragonHeadingVelocity > 0) {
                    this.dragonHeadingVelocity = 0;
                }
                if (steerInput !== 0 || this.dragonHeadingVelocity !== 0) {
                    this.dragonHeadingAngle = Math.max(
                        minHeading,
                        Math.min(maxHeading, this.dragonHeadingAngle + this.dragonHeadingVelocity * dt)
                    );
                }
            }

            // Advance the dragon's 3D world X position along its current heading vector with lateral inertia
            if (isMovingForward) {
                const directStepX = Math.sin(this.dragonHeadingAngle) * forwardSpeed * dt;
                const canyonHeadingStepX = Math.sin(canyonTangentHeading) * forwardSpeed * dt;
                const targetLateralVelX = (directStepX - canyonHeadingStepX) / Math.max(0.001, dt);
                this.dragonLateralVelocityX += (targetLateralVelX - this.dragonLateralVelocityX) * Math.min(1, stepDt * DRAGON_LATERAL_VELOCITY_SMOOTHING);
                if (this.wallContactSide === -1 && this.dragonLateralVelocityX < 0) {
                    this.dragonLateralVelocityX = 0;
                } else if (this.wallContactSide === 1 && this.dragonLateralVelocityX > 0) {
                    this.dragonLateralVelocityX = 0;
                }
                this.dragonWorldX += canyonDeltaX + this.dragonLateralVelocityX * dt;
            } else if (steerInput !== 0 || Math.abs(this.dragonHeadingVelocity) > 0.005 || Math.abs(this.dragonLateralVelocityX) > 0.05) {
                // Allow gentle lateral maneuvering with inertia when testing steering before pedaling
                const targetIdleVelX = (steerInput !== 0 || Math.abs(this.dragonHeadingVelocity) > 0.005)
                    ? Math.sin(this.dragonHeadingAngle - canyonTangentHeading) * 14.0
                    : 0;
                this.dragonLateralVelocityX += (targetIdleVelX - this.dragonLateralVelocityX) * Math.min(1, stepDt * DRAGON_LATERAL_VELOCITY_SMOOTHING);
                if (this.wallContactSide === -1 && this.dragonLateralVelocityX < 0) {
                    this.dragonLateralVelocityX = 0;
                } else if (this.wallContactSide === 1 && this.dragonLateralVelocityX > 0) {
                    this.dragonLateralVelocityX = 0;
                }
                this.dragonWorldX += this.dragonLateralVelocityX * dt;
            } else {
                this.dragonLateralVelocityX = 0;
            }

            const canyonClamped = clampDragonWorldXToCanyon(
                this.dragonWorldX,
                this.flightZ,
                this.dragonHeadingAngle,
                this.camera,
                steerInput
            );
            this.wallContactSide = canyonClamped.hitWallSide;
            if (canyonClamped.hitWallSide === -1) {
                // Touching left canyon wall: cancel leftward momentum into the wall, preserve rightward steering away from the wall
                if (this.dragonLateralVelocityX < 0) this.dragonLateralVelocityX = 0;
                if (this.dragonHeadingVelocity < 0) this.dragonHeadingVelocity = 0;
            } else if (canyonClamped.hitWallSide === 1) {
                // Touching right canyon wall: cancel rightward momentum into the wall, preserve leftward steering away from the wall
                if (this.dragonLateralVelocityX > 0) this.dragonLateralVelocityX = 0;
                if (this.dragonHeadingVelocity > 0) this.dragonHeadingVelocity = 0;
            }
            this.dragonWorldX = canyonClamped.worldX;
            this.dragonSteerOffsetX = canyonClamped.offsetX;
            this.dragonHeadingAngle = canyonClamped.headingAngle;
            state.dragonWorldX = this.dragonWorldX;
            state.dragonSteerOffsetX = this.dragonSteerOffsetX;
            state.dragonHeadingAngle = this.dragonHeadingAngle;
        }
        const dragonWorldX = this.dragonWorldX;

        // Target sky altitude vs Dragon actual altitude (almost touching ground when 0 watts)
        // Use second-order spring-damper vertical inertia so moving up/down accelerates and settles smoothly
        const desiredDragonY = wattsToSkyAltitudeY(effectiveWatts, state.ftp, state.currentGradientPct);
        const prevY = this.dragonCurrentY;
        const altitudeErrorY = desiredDragonY - this.dragonCurrentY;
        const verticalAccelY = altitudeErrorY * DRAGON_VERTICAL_SPRING - this.dragonVelocityY * DRAGON_VERTICAL_DAMPING;
        this.dragonVelocityY += verticalAccelY * stepDt;
        this.dragonVelocityY = Math.max(-DRAGON_MAX_VERTICAL_SPEED, Math.min(DRAGON_MAX_VERTICAL_SPEED, this.dragonVelocityY));
        this.dragonCurrentY += this.dragonVelocityY * stepDt;
        if (Math.abs(desiredDragonY - this.dragonCurrentY) < 0.01 && Math.abs(this.dragonVelocityY) < 0.02) {
            this.dragonCurrentY = desiredDragonY;
            this.dragonVelocityY = 0;
        }
        const climbRate = isMovingForward ? (this.dragonCurrentY - prevY) / Math.max(0.001, stepDt) : this.dragonVelocityY * 0.5;

        // Position and orient the 3D Dragon based on its 3D position and current heading
        this.dragonGroup.position.set(dragonWorldX, this.dragonCurrentY, this.flightZ);

        if (isMovingForward || steerInput !== 0 || Math.abs(this.dragonHeadingVelocity) > 0.005 || Math.abs(this.dragonVelocityY) > 0.02) {
            const normalizedYawRate = this.dragonHeadingVelocity / DRAGON_HEADING_TURN_RATE;
            const headingRelToCanyon = this.dragonHeadingAngle - canyonTangentHeading;
            const autoCourseBank = !state.steeringEnabled
                ? Math.max(-0.42, Math.min(0.42, -turnDelta * 0.032))
                : 0;
            const steerVisualRoll = (
                -steerInput * DRAGON_ROLL_STEER_INPUT_GAIN
                - normalizedYawRate * DRAGON_ROLL_YAW_RATE_GAIN
                - headingRelToCanyon * DRAGON_ROLL_HEADING_GAIN
                + autoCourseBank
            );
            const targetRoll = Math.max(
                -DRAGON_MAX_ROLL_ANGLE,
                Math.min(DRAGON_MAX_ROLL_ANGLE, steerVisualRoll)
            );
            const rollRate = (steerInput !== 0 || Math.abs(this.dragonHeadingVelocity) > 0.02)
                ? DRAGON_ROLL_SMOOTHING
                : DRAGON_ROLL_RECOVERY_SMOOTHING;
            this.dragonBankAngle += (targetRoll - this.dragonBankAngle) * Math.min(1, stepDt * rollRate);
            this.dragonRollAngle = this.dragonBankAngle;
            const targetPitch = Math.max(-0.52, Math.min(0.52, climbRate * 0.032));
            this.dragonPitchAngle += (targetPitch - this.dragonPitchAngle) * Math.min(1, stepDt * 4.8);
        } else {
            this.dragonBankAngle += (0 - this.dragonBankAngle) * Math.min(1, stepDt * DRAGON_ROLL_RECOVERY_SMOOTHING);
            this.dragonRollAngle = this.dragonBankAngle;
            this.dragonPitchAngle += (0 - this.dragonPitchAngle) * Math.min(1, stepDt * 4.8);
        }

        this.dragonGroup.rotation.order = 'YXZ';
        this.dragonGroup.rotation.y = -this.dragonHeadingAngle;
        this.dragonGroup.rotation.x = this.dragonPitchAngle;
        this.dragonGroup.rotation.z = this.dragonRollAngle;

        const rollLeanFactor = this.dragonRollAngle / DRAGON_MAX_ROLL_ANGLE;

        // Indicate the current watt value by flapping the wings of the dragon (or animating the selected avatar).
        // Do not flap the wings or wiggle the tail when no watts are pedaled.
        if (isPedalingWatts) {
            const wattRatio = Math.max(0.05, Math.min(2.5, currentPedaledWatts / Math.max(100, state.ftp || 200)));
            const wattFlapFrequency = 3.0 + wattRatio * 9.5;
            const wattFlapAmplitude = Math.min(0.95, 0.22 + wattRatio * 0.48);
            this.wingFlapPhase += dt * wattFlapFrequency;
            const innerAngle = Math.sin(this.wingFlapPhase) * wattFlapAmplitude;
            const outerAngle = Math.sin(this.wingFlapPhase - 0.55) * (wattFlapAmplitude * 0.78);
            if (this.leftWingPivot && this.rightWingPivot) {
                this.leftWingPivot.rotation.z = innerAngle;
                this.rightWingPivot.rotation.z = -innerAngle;
            }
            if (this.leftOuterWingPivot && this.rightOuterWingPivot) {
                this.leftOuterWingPivot.rotation.z = outerAngle;
                this.rightOuterWingPivot.rotation.z = -outerAngle;
            }

            // Subtle neck undulation + natural head/neck lean into the visual roll
            this.neckSegments.forEach((nSeg, idx) => {
                nSeg.position.x = Math.sin(this.wingFlapPhase * 0.5 + idx * 0.4) * 0.06 * Math.min(1.5, wattRatio) - rollLeanFactor * (0.05 * (idx + 1));
                nSeg.rotation.z = this.dragonRollAngle * (0.12 * (idx + 1));
            });
            if (this.dragonHeadGroup) {
                const headBaseY = (this.dragonHeadGroup.userData && typeof this.dragonHeadGroup.userData.baseY === 'number')
                    ? this.dragonHeadGroup.userData.baseY
                    : 1.18;
                this.dragonHeadGroup.position.y = headBaseY + Math.sin(this.wingFlapPhase) * 0.08 * Math.min(1.5, wattRatio);
                this.dragonHeadGroup.rotation.z = this.dragonRollAngle * 0.28;
                this.dragonHeadGroup.rotation.y = -rollLeanFactor * 0.22;
            }

            // Sinuous 10-segment whip tail motion (slower and gentler than wing flapping) with aerodynamic banking trail
            const tailWigglePhase = this.wingFlapPhase * 0.55;
            const tailWiggleScale = Math.min(0.95, 0.22 + wattRatio * 0.38);
            this.tailSegments.forEach((seg, idx) => {
                seg.position.x = Math.sin(tailWigglePhase - idx * 0.42) * (0.065 * (idx + 1)) * tailWiggleScale + rollLeanFactor * (0.045 * (idx + 1));
                seg.position.y = -0.04 * idx + Math.cos(tailWigglePhase - idx * 0.40) * (0.035 * (idx + 1)) * tailWiggleScale;
                seg.rotation.z = -this.dragonRollAngle * (0.045 * (idx + 1));
            });

            // Avatar-specific watt-driven animations (Fuchur ears/legs, E.T. BMX pedaling & wheels, DeLorean hover thrusters, Mars Attacks UFO spin)
            if (this.avatarAnimParts) {
                if (this.avatarAnimParts.leftEar && this.avatarAnimParts.rightEar) {
                    const earWave = Math.sin(this.wingFlapPhase * 0.85) * (0.32 * Math.min(1.5, wattRatio));
                    const earPitch = Math.cos(this.wingFlapPhase * 0.85) * (0.14 * Math.min(1.5, wattRatio));
                    this.avatarAnimParts.leftEar.rotation.z = -earWave;
                    this.avatarAnimParts.rightEar.rotation.z = earWave;
                    this.avatarAnimParts.leftEar.rotation.x = earPitch;
                    this.avatarAnimParts.rightEar.rotation.x = earPitch;
                    if (this.avatarAnimParts.forelegs && this.avatarAnimParts.hindlegs) {
                        const stride = Math.sin(this.wingFlapPhase * 0.65) * (0.24 * Math.min(1.4, wattRatio));
                        this.avatarAnimParts.forelegs.forEach((leg, i) => {
                            leg.rotation.x = i === 0 ? stride : -stride;
                        });
                        this.avatarAnimParts.hindlegs.forEach((leg, i) => {
                            leg.rotation.x = i === 0 ? -stride : stride;
                        });
                    }
                    if (this.avatarAnimParts.whiskerTendrils) {
                        const wWave = Math.sin(this.wingFlapPhase * 1.15) * (0.18 * Math.min(1.5, wattRatio));
                        this.avatarAnimParts.whiskerTendrils.forEach((w, i) => {
                            w.rotation.z = i === 0 ? -wWave : wWave;
                        });
                    }
                }
                if (this.avatarAnimParts.frontWheel && this.avatarAnimParts.rearWheel) {
                    const spinStep = dt * wattFlapFrequency * 1.35;
                    this.avatarAnimParts.frontWheel.rotation.x -= spinStep;
                    this.avatarAnimParts.rearWheel.rotation.x -= spinStep;
                    if (this.avatarAnimParts.crankPivot) {
                        const nextCrankAngle = this.avatarAnimParts.crankPivot.rotation.x - spinStep * 0.72;
                        this.updateEtBikePedaling(nextCrankAngle);
                    }
                    if (this.avatarAnimParts.glowingFingerTip) {
                        const glowPulse = 0.92 + Math.sin(this.wingFlapPhase * 1.8) * 0.16 * Math.min(1.5, wattRatio);
                        this.avatarAnimParts.glowingFingerTip.scale.set(glowPulse, glowPulse, glowPulse);
                    }
                    if (this.avatarAnimParts.heartLightMesh) {
                        const heartPulse = 0.90 + Math.sin(this.wingFlapPhase * 1.4) * 0.15 * Math.min(1.5, wattRatio);
                        this.avatarAnimParts.heartLightMesh.scale.set(0.95 * heartPulse, 1.15 * heartPulse, 0.65 * heartPulse);
                    }
                }
                if (this.avatarAnimParts.hoverWheelRings) {
                    const pulse = 0.88 + Math.sin(this.wingFlapPhase * 1.8) * 0.18 * Math.min(1.6, wattRatio);
                    this.avatarAnimParts.hoverWheelRings.forEach((ring) => {
                        ring.scale.set(pulse, pulse, 1);
                    });
                    if (this.avatarAnimParts.rearVentClusters) {
                        this.avatarAnimParts.rearVentClusters.forEach((vc) => {
                            vc.scale.set(1, pulse, 1);
                        });
                    }
                    if (this.avatarAnimParts.fluxCapacitorGroup) {
                        const fluxPulse = 0.90 + Math.sin(this.wingFlapPhase * 3.2) * 0.22 * Math.min(1.6, wattRatio);
                        this.avatarAnimParts.fluxCapacitorGroup.scale.set(fluxPulse, fluxPulse, fluxPulse);
                    }
                }
                if (this.avatarAnimParts.spinningDiscGroup) {
                    this.avatarAnimParts.spinningDiscGroup.rotation.y += dt * (2.2 + wattRatio * 4.5);
                    const ufoPulse = 0.88 + Math.sin(this.wingFlapPhase * 2.2) * 0.16 * Math.min(1.5, wattRatio);
                    if (this.avatarAnimParts.tractorHalo) {
                        this.avatarAnimParts.tractorHalo.scale.set(ufoPulse, ufoPulse, 1);
                    }
                    if (this.avatarAnimParts.rayTip) {
                        this.avatarAnimParts.rayTip.scale.set(ufoPulse, ufoPulse, ufoPulse);
                    }
                    if (this.avatarAnimParts.antennaBeacon) {
                        this.avatarAnimParts.antennaBeacon.scale.set(ufoPulse, ufoPulse, ufoPulse);
                    }
                }
            }
        } else {
            // When 0 watts are pedaled, keep wings resting and tail still (no flapping or tail wiggling), while still allowing visual roll lean
            if (this.leftWingPivot && this.rightWingPivot) {
                this.leftWingPivot.rotation.z = 0;
                this.rightWingPivot.rotation.z = 0;
            }
            if (this.leftOuterWingPivot && this.rightOuterWingPivot) {
                this.leftOuterWingPivot.rotation.z = 0;
                this.rightOuterWingPivot.rotation.z = 0;
            }
            this.neckSegments.forEach((nSeg, idx) => {
                nSeg.position.x = -rollLeanFactor * (0.05 * (idx + 1));
                nSeg.rotation.z = this.dragonRollAngle * (0.12 * (idx + 1));
            });
            if (this.dragonHeadGroup) {
                const headBaseY = (this.dragonHeadGroup.userData && typeof this.dragonHeadGroup.userData.baseY === 'number')
                    ? this.dragonHeadGroup.userData.baseY
                    : 1.18;
                this.dragonHeadGroup.position.y = headBaseY;
                this.dragonHeadGroup.rotation.z = this.dragonRollAngle * 0.28;
                this.dragonHeadGroup.rotation.y = -rollLeanFactor * 0.22;
            }
            this.tailSegments.forEach((seg, idx) => {
                seg.position.x = rollLeanFactor * (0.045 * (idx + 1));
                seg.position.y = -0.04 * idx;
                seg.rotation.z = -this.dragonRollAngle * (0.045 * (idx + 1));
            });
            if (this.avatarAnimParts) {
                if (this.avatarAnimParts.leftEar && this.avatarAnimParts.rightEar) {
                    this.avatarAnimParts.leftEar.rotation.z = 0;
                    this.avatarAnimParts.rightEar.rotation.z = 0;
                    this.avatarAnimParts.leftEar.rotation.x = 0;
                    this.avatarAnimParts.rightEar.rotation.x = 0;
                    if (this.avatarAnimParts.forelegs && this.avatarAnimParts.hindlegs) {
                        this.avatarAnimParts.forelegs.forEach((leg) => { leg.rotation.x = 0; });
                        this.avatarAnimParts.hindlegs.forEach((leg) => { leg.rotation.x = 0; });
                    }
                    if (this.avatarAnimParts.whiskerTendrils) {
                        this.avatarAnimParts.whiskerTendrils.forEach((w) => { w.rotation.z = 0; });
                    }
                }
                if (this.avatarAnimParts.crankPivot && this.avatarAnimParts.leftLeg && this.avatarAnimParts.rightLeg) {
                    this.updateEtBikePedaling(this.avatarAnimParts.crankPivot.rotation.x);
                }
                if (this.avatarAnimParts.hoverWheelRings) {
                    this.avatarAnimParts.hoverWheelRings.forEach((ring) => ring.scale.set(1, 1, 1));
                }
            }
        }

        // Per-avatar flight dynamics (Aero Wyvern, Fuchur, E.T. bike, DeLorean, UFO, Paramotor) layered on top of the generic animation
        this.updateAvatarDynamics(stepDt, {
            isPedaling: isPedalingWatts,
            isMovingForward,
            wattRatio: currentPedaledWatts / Math.max(100, state.ftp || 200),
            headingAngle: this.dragonHeadingAngle || 0,
            rollAngle: this.dragonRollAngle || 0,
            pitchAngle: this.dragonPitchAngle || 0,
            maxRollAngle: DRAGON_MAX_ROLL_ANGLE,
            verticalVelocity: this.dragonVelocityY || 0
        });

        this.updateGhost(stepDt);

        const tolW = getAccuracyToleranceWatts();

        // Chase Camera follows behind and slightly above the dragon, keeping the dragon in view while reflecting its heading and 3D position
        const camZ = this.flightZ + 16.5;
        const camX = dragonWorldX * 0.72 + getSimulatedTurnOffsetX(camZ) * 0.28 - Math.sin(this.dragonHeadingAngle) * 4.5;
        const desiredCamY = this.dragonCurrentY + 2.2;
        if (typeof this.cameraCurrentY !== 'number' || isNaN(this.cameraCurrentY)) {
            this.cameraCurrentY = desiredCamY;
        } else {
            this.cameraCurrentY += (desiredCamY - this.cameraCurrentY) * Math.min(1, dt * 4.5);
        }

        const lookTargetZ = this.flightZ - 36;
        const headingLookX = dragonWorldX + Math.sin(this.dragonHeadingAngle) * 28.0;
        const lookTargetX = headingLookX * 0.65 + getSimulatedTurnOffsetX(lookTargetZ) * 0.35;
        const targetGateSkyY = wattsToSkyAltitudeY(targetWatts, state.ftp, state.currentGradientPct);
        const desiredLookTargetY = targetGateSkyY * 0.50 + this.dragonCurrentY * 0.50;
        if (typeof this.cameraLookTargetY !== 'number' || isNaN(this.cameraLookTargetY)) {
            this.cameraLookTargetY = desiredLookTargetY;
        } else {
            this.cameraLookTargetY += (desiredLookTargetY - this.cameraLookTargetY) * Math.min(1, dt * 3.5);
        }

        this.applyCameraPerspective(dt, {
            dragonWorldX,
            chasePos: [camX, this.cameraCurrentY, camZ],
            chaseLook: [lookTargetX, this.cameraLookTargetY, lookTargetZ]
        });

        // Keep canyon floor & river fixed in world coordinates in the middle of the canyon
        this.updateCanyonAndRiverWorldGeometry(this.flightZ);
        if (this.skyGroup) {
            this.skyGroup.position.set(currentCourseX, 0, this.flightZ);
        }
        if (this.starsMat) {
            this.starsMat.opacity = 0.78 + Math.sin(performance.now() * 0.0025) * 0.18;
        }
        if (this.riverTexture && isMovingForward) {
            this.riverTexture.offset.y -= dt * 0.45;
        }

        if (isMovingForward) {
            // Recycle forest trees, bushes & stones as the dragon flies forward at high speed
            this.trees.forEach((t) => {
                if (t.mesh.position.z > this.flightZ + 28) {
                    this.placeTreeNaturallyOnTerrain(t, t.baseZ - 520);
                }
            });
            this.bushes.forEach((b) => {
                if (b.mesh.position.z > this.flightZ + 28) {
                    this.placeBushNaturallyOnTerrain(b, b.baseZ - 520);
                }
            });
            this.stones.forEach((s) => {
                if (s.mesh.position.z > this.flightZ + 28) {
                    this.placeStoneNaturallyOnTerrain(s, s.baseZ - 520);
                }
            });

            // Update & recycle volumetric clouds
            this.clouds.forEach((c) => {
                c.mesh.position.x += c.driftSpeed * dt;
                if (c.mesh.position.z > this.flightZ + 36) {
                    c.mesh.position.z -= 540;
                    c.mesh.position.x = getSimulatedTurnOffsetX(c.mesh.position.z) + (Math.random() - 0.5) * 170;
                }
            });

            // Animate & recycle flocks of birds
            this.birds.forEach((b) => {
                b.flapOffset += dt * b.flapSpeed;
                const flap = Math.sin(b.flapOffset) * 0.65;
                b.leftWing.rotation.z = flap;
                b.rightWing.rotation.z = -flap;
                b.group.position.z += 12.0 * dt;
                b.group.position.y = b.yBase + Math.sin(b.flapOffset * 0.5) * 0.5;
                if (b.group.position.z > this.flightZ + 24) {
                    b.group.position.z = this.flightZ - 380 - Math.random() * 60;
                    b.group.position.x = getSimulatedTurnOffsetX(b.group.position.z) + b.xOffset;
                }
            });
        }

        // Advance 3D gate wind chevron & halo wave phase (Upwind lift <= -0.35%, Downwind draft >= +0.35%)
        this.windAnimTime += dt * (isMovingForward ? 1.0 : 0.5);

        // Spawn new Donut Gates ahead & evaluate passing through gates
        while (this.nextGateZ > this.flightZ - 480) {
            this.spawnDonutGate(this.nextGateZ, this.nextGateWorkoutSec);
            this.nextGateZ -= this.gateSpacingZ;
            this.nextGateWorkoutSec += 1;
        }

        for (let i = this.gates.length - 1; i >= 0; i--) {
            const g = this.gates[i];
            this.syncGateToDesiredWatts(g);
            if (isMovingForward && g.innerHalo) {
                g.innerHalo.rotation.z += dt * 2.4; // rotate inner halo
            }

            if (isMovingForward && !g.passed && g.worldZ >= this.flightZ) {
                g.passed = true;
                const altitudeDiff = Math.abs(this.dragonCurrentY - g.gateY);
                const horizontalDiff = state.steeringEnabled ? Math.abs(dragonWorldX - g.gateX) : 0;
                const radialDistFromGateCenter = Math.hypot(horizontalDiff, altitudeDiff);
                const wattError = Math.abs(effectiveWatts - g.targetWatts);
                const missedGateLeftOrRight = state.steeringEnabled && horizontalDiff > g.donutRadius;
                if (state.actualWatts > 0 && wattError <= tolW && !missedGateLeftOrRight && altitudeDiff <= g.donutRadius && radialDistFromGateCenter <= g.donutRadius) {
                    // Cleared the Donut Gate!
                    g.cleared = true;
                    this.lastClearedGateWorkoutSec = g.workoutSec;
                    this.lastClearedGateAltitudeRatio = radialDistFromGateCenter / Math.max(0.001, g.donutRadius);
                    state.gatesPassedCount += 1;
                    g.torusMat.color.setHex(0x4ade80);
                    g.torusMat.emissive.setHex(0x4ade80);
                    g.innerHaloMat.opacity = 0.95;
                    if (g.wattText3D && g.wattText3D.material) {
                        g.wattText3D.material.color.setHex(0x4ade80);
                        g.wattText3D.material.emissive.setHex(0x4ade80);
                    }
                }
            }

            if (g.worldZ > this.flightZ + 30) {
                this.disposeGateWindVisual(g);
                this.scene.remove(g.group);
                this.gates.splice(i, 1);
            }
        }

        // Animate gate wind chevrons, side halos, and nearest upcoming LIFT / DRAFT slope badges
        let upcomingGateIdx = 0;
        let upcomingWindIdx = 0;
        for (let i = 0; i < this.gates.length; i++) {
            const g = this.gates[i];
            const gateIdxAhead = upcomingGateIdx;
            if (!g.passed) upcomingGateIdx += 1;
            if (!g.windVisual || !g.windVisual.group.visible) continue;
            let windRank = 99;
            if (!g.passed) {
                if (gateIdxAhead < 4 && upcomingWindIdx < 2) {
                    windRank = upcomingWindIdx;
                }
                upcomingWindIdx += 1;
            }
            this.animateGateWindVisual(g, windRank);
        }

        // Update Obstacles, Spacebar warning reticle & collision checks
        let obstacleInStrikeZone = false;
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            if (!state.renderObstacles) {
                this.scene.remove(obs.group);
                this.obstacles.splice(i, 1);
                continue;
            }
            if (obs.destroyed || obs.hitTriggered) {
                this.obstacles.splice(i, 1);
                continue;
            }

            if (isMovingForward) {
                obs.coreMesh.rotation.x += dt * 2.8;
                obs.coreMesh.rotation.y += dt * 3.4;
                obs.warnRing.rotation.z -= dt * 4.2;
            }

            const distAhead = this.flightZ - obs.worldZ;
            const secUntilObs = distAhead / Math.max(58.0, forwardSpeed || 68.0);
            if (distAhead >= 0 && secUntilObs <= 3.0) {
                obstacleInStrikeZone = true;
                obs.warnRingMat.color.setHex(0xef4444);
            }

            // Check if obstacle reached the dragon without being destroyed
            if (isMovingForward && obs.worldZ >= this.flightZ - 2.2) {
                if (obs.targetedByFireball) {
                    this.shatterObstacle(obs);
                } else {
                    const verticalDist = Math.abs(this.dragonCurrentY - obs.obsY);
                    const horizontalDist = Math.abs(dragonWorldX - obs.obsX);
                    if (verticalDist <= 7.5 && horizontalDist <= 5.5) {
                        this.handleObstacleCollisionPenalty(obs);
                    } else {
                        this.scene.remove(obs.group);
                    }
                }
                this.obstacles.splice(i, 1);
            }
        }

        // Update Evil Dragon Hunters standing left and right from the river & their fired arrows
        for (let i = this.dragonHunters.length - 1; i >= 0; i--) {
            const hunter = this.dragonHunters[i];
            if (!state.renderObstacles) {
                this.scene.remove(hunter.group);
                this.dragonHunters.splice(i, 1);
                continue;
            }
            // Turn hunter to face the dragon
            if (this.dragonGroup) {
                hunter.group.lookAt(dragonWorldX, hunter.group.position.y + 1.6, this.flightZ);
                if (hunter.bowPivot) {
                    hunter.bowPivot.lookAt(this.dragonGroup.position);
                }
            }
            const distAhead = this.flightZ - hunter.worldZ;
            if (isMovingForward && !hunter.hasFired && distAhead > 12.0 && distAhead <= 115.0) {
                hunter.fireCooldown -= dt;
                if (hunter.fireCooldown <= 0) {
                    hunter.hasFired = true;
                    this.fireHunterArrowAtDragon(hunter);
                }
            }
            if (hunter.worldZ > this.flightZ + 30) {
                this.scene.remove(hunter.group);
                this.dragonHunters.splice(i, 1);
            }
        }

        for (let i = this.hunterArrows.length - 1; i >= 0; i--) {
            const arrow = this.hunterArrows[i];
            if (!state.renderObstacles || arrow.hitTriggered) {
                this.scene.remove(arrow.mesh);
                this.hunterArrows.splice(i, 1);
                continue;
            }
            if (isMovingForward) {
                arrow.life -= dt;
                arrow.mesh.position.x += arrow.vx * dt;
                arrow.mesh.position.y += arrow.vy * dt;
                arrow.mesh.position.z += arrow.vz * dt;

                // Keep the arrow pointed directly in the direction of the dragon
                if (this.dragonGroup && arrow.mesh.position.z <= this.flightZ + 1.5) {
                    const toDragon = new THREE.Vector3().subVectors(this.dragonGroup.position, arrow.mesh.position);
                    if (toDragon.lengthSq() > 0.001) {
                        const lookTarget = arrow.mesh.position.clone().add(toDragon.normalize().multiplyScalar(10.0));
                        arrow.mesh.lookAt(lookTarget);
                    }
                }

                // Check collision between hunter arrow and dragon
                const dx = arrow.mesh.position.x - dragonWorldX;
                const dy = arrow.mesh.position.y - this.dragonCurrentY;
                const dz = arrow.mesh.position.z - this.flightZ;
                const distToDragon = Math.hypot(dx, dy, dz);
                if (distToDragon <= 3.8) {
                    this.handleArrowHitPenalty(arrow);
                    this.hunterArrows.splice(i, 1);
                    continue;
                }
            }
            if (arrow.life <= 0 || arrow.mesh.position.z > this.flightZ + 22) {
                this.scene.remove(arrow.mesh);
                this.hunterArrows.splice(i, 1);
            }
        }

        // Update Fire Breath availability (ONLY unlocked a few seconds before the next obstacle is reached)
        const fireStatus = this.getFireWindowStatus();
        const fireBtn = document.getElementById('fireBreathBtn');
        const fireBtnText = document.getElementById('fireBreathBtnText');
        if (fireBtn && fireBtnText) {
            if (fireStatus.canFire) {
                const secText = Math.max(0.1, fireStatus.secondsUntilReach).toFixed(1);
                fireBtn.disabled = false;
                fireBtn.className = 'px-3 py-1 rounded-xl bg-gradient-to-r from-rose-600 via-orange-500 to-amber-400 hover:from-rose-500 hover:to-yellow-300 text-gray-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-orange-500/30 flex items-center gap-1.5 cursor-pointer active:scale-95 transition';
                fireBtnText.innerHTML = `&#128293; Fire Breath [SPACE] (-${fireStatus.pointCost} PTS &bull; ${secText}s)`;
            } else {
                fireBtn.disabled = true;
                fireBtn.className = 'px-3 py-1 rounded-xl bg-gray-900/80 border border-gray-700 text-gray-400 font-black text-xs uppercase tracking-wider shadow flex items-center gap-1.5 cursor-not-allowed opacity-70 transition';
                fireBtnText.innerHTML = `&#128274; Fire Locked (-${fireStatus.pointCost} PTS)`;
            }
        }

        // Update active Fireballs directed exactly to the next obstacle & check projectile-obstacle hits
        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            const fb = this.fireballs[i];
            fb.life -= dt;

            if (!fb.targetObs || fb.targetObs.destroyed || fb.targetObs.hitTriggered) {
                fb.targetObs = this.findNextObstacleAhead();
                if (fb.targetObs) {
                    fb.targetObs.targetedByFireball = true;
                }
            }

            if (fb.targetObs && !fb.targetObs.destroyed && !fb.targetObs.hitTriggered) {
                const targetPos = fb.targetObs.group.position;
                const toTarget = new THREE.Vector3().subVectors(targetPos, fb.mesh.position);
                const distToTarget = toTarget.length();
                const stepDist = fb.speed * dt;

                if (distToTarget <= Math.max(4.5, stepDist * 1.25) || fb.mesh.position.z <= fb.targetObs.worldZ) {
                    fb.mesh.position.copy(targetPos);
                    this.shatterObstacle(fb.targetObs);
                    fb.life = 0;
                } else {
                    toTarget.normalize();
                    fb.vx = toTarget.x * fb.speed;
                    fb.vy = toTarget.y * fb.speed;
                    fb.vz = toTarget.z * fb.speed;
                    fb.mesh.position.x += fb.vx * dt;
                    fb.mesh.position.y += fb.vy * dt;
                    fb.mesh.position.z += fb.vz * dt;
                    fb.mesh.lookAt(targetPos);
                }
            } else {
                fb.mesh.position.x += fb.vx * dt;
                fb.mesh.position.y += fb.vy * dt;
                fb.mesh.position.z += fb.vz * dt;
            }

            if (fb.life <= 0) {
                this.scene.remove(fb.mesh);
                this.fireballs.splice(i, 1);
            }
        }

        // Update Explosion Shards
        for (let i = this.explosionFragments.length - 1; i >= 0; i--) {
            const ef = this.explosionFragments[i];
            ef.mesh.position.x += ef.vx * dt;
            ef.mesh.position.y += ef.vy * dt;
            ef.mesh.position.z += ef.vz * dt;
            ef.mesh.rotation.x += 5 * dt;
            ef.mesh.rotation.y += 5 * dt;
            ef.life -= dt;
            if (ef.life <= 0) {
                this.scene.remove(ef.mesh);
                this.explosionFragments.splice(i, 1);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}
